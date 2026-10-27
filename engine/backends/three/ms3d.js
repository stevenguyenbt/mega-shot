// mega-shot · backend Three.js realistic: HDRI (lighting + background + automatic sun-direction detection), Poly Haven PBR materials,
// skinned characters (cloning + deterministic poses), cinematic post-processing (AO, DoF, bloom, colour grading), MSAA.
// Used in film.html: <script type="importmap">{"imports":{"three":"/ms/node_modules/three/build/three.module.js","three/addons/":"/ms/node_modules/three/examples/jsm/"}}</script>
import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
export { THREE };

export const asset = p => `/root/.mega-shot/assets/${p}`;
const TL = new THREE.TextureLoader();

// ---------- init ----------
export function create3D({ W, H, fov = 35, exposure = 1, shadows = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.AgXToneMapping; renderer.toneMappingExposure = exposure; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = shadows; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(fov, W / H, .1, 5000);
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt); composer.setPixelRatio(1); composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const ctx = { THREE, renderer, scene, camera, composer, W, H, passes: {} };
  ctx.gpu = () => { const g = renderer.getContext(), e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'webgl'; };
  ctx.draw = (x) => { composer.render(); x.drawImage(renderer.domElement, 0, 0, W, H); };
  return ctx;
}

// ---------- post-processing (call after building the scene) ----------
const GRADE = {
  uniforms: { tDiffuse: { value: null }, contrast: { value: 1.06 }, saturation: { value: 1.05 }, warmth: { value: .04 }, lift: { value: .0 }, vignette: { value: .25 }, grainAmt: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float contrast, saturation, warmth, lift, vignette; varying vec2 vUv;
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; c = (c - .5) * contrast + .5 + lift; float l = dot(c, vec3(.2126,.7152,.0722));
      c = mix(vec3(l), c, saturation); c += vec3(warmth, warmth * .35, -warmth); float d = distance(vUv, vec2(.5)); c *= 1. - vignette * smoothstep(.35, .85, d);
      gl_FragColor = vec4(clamp(c, 0., 1.), 1.); }` };
export function post(ctx, { ao = true, dof = null, bloom = .18, grade = {} } = {}) {
  const { composer, scene, camera, W, H, passes } = ctx;
  // filter NaN/Inf right after rendering: one bad pixel gets spread by bloom/AO into a black rectangle (seen in practice)
  passes.sanitize = new ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (any(isnan(c)) || any(isinf(c))) c = vec4(0., 0., 0., 1.); gl_FragColor = min(max(c, vec4(0.)), vec4(64.)); }' });
  composer.addPass(passes.sanitize);
  if (ao) { passes.ao = new GTAOPass(scene, camera, W, H); passes.ao.output = GTAOPass.OUTPUT.Default; passes.ao.blendIntensity = .85; composer.addPass(passes.ao); }
  if (dof) { passes.dof = new BokehPass(scene, camera, { focus: dof.focus ?? 10, aperture: dof.aperture ?? .0004, maxblur: dof.maxblur ?? .008 }); composer.addPass(passes.dof); }
  if (bloom) { passes.bloom = new UnrealBloomPass(new THREE.Vector2(W, H), bloom, .5, .9); composer.addPass(passes.bloom); }
  composer.addPass(new OutputPass());
  passes.grade = new ShaderPass(GRADE); Object.entries(grade).forEach(([k, v]) => passes.grade.uniforms[k].value = v); composer.addPass(passes.grade);
  return passes;
}
export const focus = (ctx, dist) => { if (ctx.passes.dof) ctx.passes.dof.uniforms.focus.value = dist; };

// ---------- HDRI: ambient light + background + sun direction ----------
export async function hdri(ctx, path, { background = true, intensity = 1, bgIntensity = 1, rotation = 0, blur = 0 } = {}) {
  const tex = await new HDRLoader().loadAsync(asset(path)); tex.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(ctx.renderer); const env = pm.fromEquirectangular(tex).texture;
  ctx.scene.environment = env; ctx.scene.environmentIntensity = intensity; ctx.scene.environmentRotation.y = rotation;
  if (background) { ctx.scene.background = tex; ctx.scene.backgroundIntensity = bgIntensity; ctx.scene.backgroundBlurriness = blur; ctx.scene.backgroundRotation.y = rotation; }
  // find the brightest spot (the sun) → direction vector, rotation already applied
  const { data, width: w, height: h } = tex.image, stride = data.length / (w * h); let best = -1, bi = 0;
  const f = data instanceof Uint16Array ? THREE.DataUtils.fromHalfFloat : (v => v);
  for (let i = 0; i < w * h; i += 3) { const r = f(data[i * stride]), g = f(data[i * stride + 1]), b = f(data[i * stride + 2]), L = r * .2126 + g * .7152 + b * .0722; if (L > best) { best = L; bi = i; } }
  const u = (bi % w) / w, v = Math.floor(bi / w) / h, phi = u * Math.PI * 2 - Math.PI / 2 + rotation, theta = v * Math.PI;
  ctx.sunDir = new THREE.Vector3(-Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi)).normalize();
  return ctx.sunDir;
}
export function sun(ctx, { color = '#ffd7a8', intensity = 3, size = 40, target = new THREE.Vector3(), dist = 200, mapSize = 4096 } = {}) {
  const L = new THREE.DirectionalLight(color, intensity); L.castShadow = true; L.shadow.mapSize.set(mapSize, mapSize); L.shadow.bias = -.0002; L.shadow.normalBias = .03;
  Object.assign(L.shadow.camera, { left: -size, right: size, top: size, bottom: -size, near: 1, far: dist * 2 });
  L.position.copy(target).addScaledVector(ctx.sunDir || new THREE.Vector3(.5, .5, .5), dist); L.target.position.copy(target); ctx.scene.add(L, L.target); ctx.sunLight = L; return L;
}

// ---------- Poly Haven PBR materials ----------
const texCache = {};
async function ldTex(url, srgb) { if (!texCache[url]) texCache[url] = TL.loadAsync(url).then(t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }); return texCache[url]; }
export async function pbr(id, { res = '2k', repeat = [1, 1], color = '#ffffff', roughness = 1, normalScale = 1, aoIntensity = 1, disp = 0, ...extra } = {}) {
  const b = asset(`polyhaven/${id}/${id}_`), rep = t => { const c = t.clone(); c.repeat.set(...repeat); c.needsUpdate = true; return c; };
  const [map, nor, rough, ao, dp] = await Promise.all([ldTex(`${b}diff_${res}.jpg`, true), ldTex(`${b}nor_gl_${res}.jpg`), ldTex(`${b}rough_${res}.jpg`), ldTex(`${b}ao_${res}.jpg`).catch(() => null), disp ? ldTex(`${b}disp_${res}.jpg`) : null]);
  const m = new THREE.MeshStandardMaterial({ color, map: rep(map), normalMap: rep(nor), normalScale: new THREE.Vector2(normalScale, normalScale), roughnessMap: rep(rough), roughness, ...extra });
  if (ao) { m.aoMap = rep(ao); m.aoMapIntensity = aoIntensity; }
  if (dp) { m.displacementMap = rep(dp); m.displacementScale = disp; }
  return m;
}
// set UVs by real size (metres) so textures are not stretched across large/small blocks
export function worldUV(geo, scale = 1) {
  geo.computeBoundingBox(); const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) { const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    const [a, b] = ax > ay && ax > az ? [p.getZ(i), p.getY(i)] : ay > az ? [p.getX(i), p.getZ(i)] : [p.getX(i), p.getY(i)]; uv.setXY(i, a * scale, b * scale); }
  uv.needsUpdate = true; return geo;
}

// ---------- models + characters ----------
const GL = new GLTFLoader(), glCache = {};
export async function gltf(path) { if (!glCache[path]) glCache[path] = GL.loadAsync(asset(path)); return glCache[path]; }
export async function model(path, { scale = 1, shadow = true } = {}) { const g = await gltf(path), o = g.scene.clone(true); o.scale.setScalar(scale); o.traverse(m => { if (m.isMesh) { m.castShadow = shadow; m.receiveShadow = true; } }); return o; }
// skinned characters: spawn() creates an independent clone (own skeleton, own mixer). pose(t) sets a deterministic pose.
export async function character(path) {
  const g = await gltf(path);
  return {
    clips: g.animations.map(a => a.name),
    spawn({ material = null, clip = 'walk', speed = 1, offset = 0 } = {}) {
      const root = SkeletonUtils.clone(g.scene), mixer = new THREE.AnimationMixer(root), bones = {};
      root.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (material) o.material = material; } if (o.isBone) bones[o.name.replace(/^mixamorig:?/, '')] = o; });
      const anim = g.animations.find(a => a.name === clip) || g.animations[0], act = mixer.clipAction(anim); act.play();
      return { root, mixer, bones, pose(t) { mixer.setTime(t * speed + offset); } };
    },
  };
}
export const vec = (x, y, z) => new THREE.Vector3(x, y, z);
// Point a single bone at a world-space target (simple IK): rotate `bone` so the bone→child direction matches bone→target.
// Use after pose(t): aimBone(B.LeftArm, B.LeftForeArm, p); aimBone(B.LeftForeArm, B.LeftHand, p) → arm reaches p.
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _wq = new THREE.Quaternion();
export function aimBone(bone, child, target, weight = 1) {
  bone.updateWorldMatrix(true, true);
  _a.setFromMatrixPosition(bone.matrixWorld); _b.setFromMatrixPosition(child.matrixWorld).sub(_a).normalize();
  const want = target.clone().sub(_a).normalize(); _q.setFromUnitVectors(_b, want); if (weight < 1) _q.slerp(new THREE.Quaternion(), 1 - weight);
  bone.getWorldQuaternion(_wq); bone.parent.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(_q.multiply(_wq))); bone.updateWorldMatrix(false, true);
}
// Two-segment arm/leg to a target, keeping the elbow slightly bent
export function reach(B, side, target, bend = .08) {
  const S = side === 'L' ? 'Left' : 'Right', up = B[S + 'Arm'], lo = B[S + 'ForeArm'], hand = B[S + 'Hand'];
  const p = new THREE.Vector3(); up.getWorldPosition(p); const mid = p.clone().lerp(target, .5); mid.y -= bend;
  aimBone(up, lo, mid.lerp(target, .15)); aimBone(lo, hand, target);
}
