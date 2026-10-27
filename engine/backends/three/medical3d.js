// mega-shot · medical3d — stylised glossy medical 3D ("what happens inside your body when…" shorts, template y-khoa).
// Clean, bright, cartoon-medical look: deep navy studio, glossy clear-coated organs, a semi-transparent glowing human shell
// (one smooth surface: signed-distance body → marching cubes), glowing particle streams. No gore, no real tissue textures.
// Everything is procedural (no downloads) and every frame is a pure function of time.
//   const C = clinic({ W, H }); const labels = C.draw(x, sceneKey, kind, { lt, D, t }, opts)  → [{ text, x, y, a }] (2D label anchors)
// Kinds (opts in brackets):
//   ly-ca-phe  coffee cup, steam, caffeine molecules rising           { phan_tu: true, nhan: "CAFFEINE" }
//   co-the     transparent human with organs                           { soi: [organs], bay: <organ>, bay_tu: 0.15, bay_den: 0.9, uong: [0.1, 0.7],
//                                                                        dong: nao|tim|gan|toan-than, muc: [1, 0.5], goc: truoc|nghieng|xoay, nhan: false, mo_hoi: true }
//              organs: nao tim phoi gan da-day ruot-non ruot-gia than thuong-than thuc-quan mach
//   da-day     stomach + small intestine close-up, absorption into a vessel  { hap_thu: true }
//   mach-mau   fly-through inside a blood vessel: red cells + caffeine (gold) { adrenaline: true, caffeine: true }
//   nao        brain turntable with glowing spots, optional push-in    { vao: true }
//   thu-the    synapse membrane: adenosine (blue) docks on receptors, caffeine (gold) takes the seats { chan: [0, 0.8] }
//   tim        beating heart (+ adrenal gland releasing adrenaline)    { nhip: [70, 80] (animation only), thuong_than: true, hormone: "CORTISOL" (label) }
//   gan        liver: caffeine molecules enter and split into three metabolites { chuyen_hoa: true }
//   phan-tu    one caffeine molecule turntable (ball-and-stick)        { chat: capsaicin }
//   luoi       tongue in a stylised mouth, chili bite, capsaicin spreading, heat glow, milk { ot, can: [a, b], nong: [0, 1], sua: [a, b] }
//   chim       stylised songbird pecks a chili, flies off dropping seeds { an: [0.15, 0.6], bay: 0.72 }
//   kenh-nhiet TRPV1 heat channels open, ions rush in                   { mo: [0, 0.9], nhiet: true, nhan_nhiet }
//   khop       finger-joint cut-away: bones, cartilage, capsule, synovial fluid; a gas cavity pops on the crack { keo: [a, b], rac: 0.5, bot: true, tan: [0, 1] }
//   ban-tay    x-ray hand, index finger flexes, knuckle flash on the crack { be: [a, b], rac: 0.55, tat_ca: true, soi: true }
//   ly-bia     glass of beer, foam, bubbles, gold ethanol molecules rising { phan_tu: false, nhan }
//   da         skin cut-away + female mosquito: land, fascicle probes, saliva, sucks, flies off; mast cells → histamine, wheal, itch on the nerve
//              { dap: [a, b], chich: [a, b], nuoc_bot: [a, b], hut: [a, b], bay: .9, mast: [a, b], sung: [0, 1], ngua: true, lop: true, gan: true, muoi: false }
//   mui        x-ray head in profile: irritant → trigeminal nerve → sneeze centre, deep breath, pressure, sneeze droplet cloud — or held in
//              { bui: [a, b], tin_hieu: [a, b], hit: [a, b], ap: [a, b], hat: .3, nin: true, lop: true, gan: mui|tai|hong }
//   (ly-ca-phe { sua: true } = cup of milk · da-day { mau_hat: 0xff4020 } particle colour · co-the { do_mat: true } alcohol flush on face/neck
//    gan { chat: 'ethanol', cham: true } ethanol → ADH → acetaldehyde → ALDH2 → acetate (cham = acetaldehyde piles up) · mach-mau / phan-tu { chat: 'ethanol' })
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { create3D, post } from './ms3d.js';
import { lathe, taper } from './geo3d.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (a, b, u) => a + (b - a) * u;
const sm = u => { u = clamp(u); return u * u * (3 - 2 * u); }, eio = u => { u = clamp(u); return u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const M = (g, m) => new THREE.Mesh(g, m);
const range = (v, u) => Array.isArray(v) ? lerp(v[0], v[1], u) : v;

// ---------- palette + materials (glossy, clean) ----------
export const COL = { bg: 0x061226, shell: 0x5fd4ff, brain: 0xf59ab0, heart: 0xe8384a, lung: 0xffb3c1, liver: 0xb8433c, stomach: 0xf58f80, gut: 0xf7b493,
  colon: 0xe6977a, kidney: 0xc0504a, adrenal: 0xffc24a, artery: 0xe5323e, vein: 0x4c74e0, gold: 0xffc23d, adeno: 0x58a6ff, coffee: 0x3a1f12, rbc: 0xd8222c, receptor: 0x8f7bff };
const gloss = (c, o = {}) => new THREE.MeshPhysicalMaterial({ color: c, roughness: o.r ?? .32, metalness: 0, clearcoat: o.cc ?? 1, clearcoatRoughness: o.ccr ?? .12,
  sheen: o.sheen ?? .12, sheenColor: new THREE.Color(o.sheenC ?? 0xffffff), sheenRoughness: .5, emissive: new THREE.Color(o.e ?? c), emissiveIntensity: o.ei ?? .06,
  transparent: o.op != null, opacity: o.op ?? 1, depthWrite: o.dw ?? (o.op == null), side: o.side ?? THREE.FrontSide, envMapIntensity: o.env ?? 1 });
// fresnel rim glow (x-ray hologram edge); additive, no depth write
function fresnel(color, { p = 2.4, k = 1.3, op = 1, base = .03 } = {}) {
  return new THREE.ShaderMaterial({ uniforms: { c: { value: new THREE.Color(color) }, p: { value: p }, k: { value: k }, o: { value: op }, b: { value: base } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 c; uniform float p, k, o, b; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1. - abs(dot(normalize(vN), normalize(vV))), p); gl_FragColor = vec4(c * (f * k + b) * o, 1.); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
}
const TEX = {};
function dotTex() { if (TEX.dot) return TEX.dot; const k = document.createElement('canvas'); k.width = k.height = 64; const g = k.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.3, 'rgba(255,255,255,.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(k); t.colorSpace = THREE.SRGBColorSpace; return TEX.dot = t; }
// N glowing points whose position is f(i, t, v) (return false to hide one)
function points(N, size, color, f, op = .95) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const P = new THREE.Points(geo, new THREE.PointsMaterial({ size, color, map: dotTex(), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  P.frustumCulled = false; const v = V3(0, 0, 0);
  P.tick = t => { for (let i = 0; i < N; i++) { const ok = f(i, t, v); if (ok === false) v.set(0, -999, 0); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; } geo.attributes.position.needsUpdate = true; };
  return P; }
const glowSprite = (size, color, op = 1) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.set(size, size, 1); return s; };
// studio backdrop: big inverted sphere with a vertical navy → teal gradient and a soft centre glow
function backdrop(top = 0x0b2a4a, bot = 0x030914, mid = 0x0f4a6a) {
  return new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { a: { value: new THREE.Color(top) }, b: { value: new THREE.Color(bot) }, m: { value: new THREE.Color(mid) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'uniform vec3 a, b, m; varying vec3 vP; void main(){ float h = vP.y * .5 + .5; vec3 c = mix(b, a, smoothstep(.2, .85, h)); c += m * .55 * pow(max(0., 1. - length(vP.xy - vec2(0., .05)) * 1.15), 2.); gl_FragColor = vec4(c, 1.); }' }));
}

// ---------- signed-distance human → one smooth surface (marching cubes), facing +z, feet at y = 0, 1.8 units tall ----------
const sdCaps = (p, a, b, r) => { const pa = p.clone().sub(a), ba = b.clone().sub(a), h = clamp(pa.dot(ba) / ba.dot(ba)); return pa.sub(ba.multiplyScalar(h)).length() - r; };
const sdEll = (p, c, r) => { const q = V3((p.x - c.x) / r.x, (p.y - c.y) / r.y, (p.z - c.z) / r.z), k0 = q.length(), q2 = V3(q.x / r.x, q.y / r.y, q.z / r.z), k1 = q2.length(); return k0 * (k0 - 1) / (k1 || 1e-6); };
const smin = (a, b, k) => { const h = clamp(.5 + .5 * (b - a) / k); return lerp(b, a, h) - k * h * (1 - h); };
function bodySDF(p) {
  const s = [], C = (a, b, r) => s.push(sdCaps(p, a, b, r)), E = (c, r) => s.push(sdEll(p, c, r));
  E(V3(0, 1.635, .005), V3(.083, .108, .098)); E(V3(0, 1.57, .03), V3(.055, .05, .055)); C(V3(0, 1.43, -.01), V3(0, 1.56, 0), .048);
  E(V3(0, 1.3, 0), V3(.165, .165, .105)); E(V3(0, 1.12, .012), V3(.14, .15, .1)); E(V3(0, .95, -.005), V3(.162, .1, .11));
  C(V3(-.15, 1.405, -.01), V3(.15, 1.405, -.01), .058);
  for (const sx of [-1, 1]) {
    C(V3(sx * .195, 1.4, -.01), V3(sx * .245, 1.14, -.02), .045); C(V3(sx * .245, 1.14, -.02), V3(sx * .275, .9, .02), .036);
    E(V3(sx * .282, .82, .03), V3(.026, .058, .02));
    C(V3(sx * .088, .93, 0), V3(sx * .1, .5, .005), .072); C(V3(sx * .1, .5, .005), V3(sx * .1, .09, -.02), .05);
    E(V3(sx * .1, .035, .045), V3(.043, .034, .105));
  }
  let d = s[0]; for (let i = 1; i < s.length; i++) d = smin(d, s[i], .035); return d;
}
let BODY_GEO = null;
function bodyGeometry(res = 104) {
  if (BODY_GEO) return BODY_GEO;
  const mc = new MarchingCubes(res, new THREE.MeshBasicMaterial(), false, false, 400000), half = .96, cy = .93, p = V3(0, 0, 0);
  for (let z = 0; z < res; z++) for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) {
    p.set((x - res / 2) / (res / 2) * half, (y - res / 2) / (res / 2) * half + cy, (z - res / 2) / (res / 2) * half);
    mc.field[res * res * z + res * y + x] = -bodySDF(p) * 40; }
  mc.isolation = 0; mc.update();
  const src = mc.geometry, n = mc.count, g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(src.attributes.position.array.slice(0, n * 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(src.attributes.normal.array.slice(0, n * 3), 3));
  g.scale(half, half, half); g.translate(0, cy, 0); g.computeBoundingSphere(); mc.geometry.dispose();
  return BODY_GEO = g;
}

// ---------- organs (unit-ish local sizes; caller scales/positions) ----------
function brainGeo() {
  const g = new THREE.SphereGeometry(1, 128, 96), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const w = Math.sin(7.5 * x + 2.2 * Math.sin(5 * y + 1)) * Math.sin(7.5 * y + 2.4 * Math.sin(4.3 * z)) * Math.sin(7.5 * z + 2 * Math.sin(6 * x + 2));
    let r = 1 - .075 * Math.pow(Math.abs(w), .55) + .03;                                   // gyri / sulci
    r -= .16 * Math.exp(-Math.pow(x / .07, 2)) * clamp((y + .2) * 2);                      // longitudinal fissure between the hemispheres
    r -= .1 * Math.exp(-Math.pow((y + .15 - .25 * z) / .08, 2)) * clamp(Math.abs(x) * 3 - .5) * clamp(-z + .6);   // lateral sulcus
    p.setXYZ(i, x * r * .82, y * r * (y < 0 ? .62 : .78), z * r * 1.02); }
  g.computeVertexNormals(); return g;
}
function cerebellumGeo() { const g = new THREE.SphereGeometry(1, 64, 48), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = 1 - .05 * Math.abs(Math.sin(y * 22)) - .12 * Math.exp(-Math.pow(x / .1, 2)); p.setXYZ(i, x * r * .9, y * r * .5, z * r * .6); }
  g.computeVertexNormals(); return g; }
function brain(scale = 1) {
  const G = new THREE.Group(), m = gloss(COL.brain, { r: .38, ei: .08 }), B = M(brainGeo(), m); G.add(B);
  const cb = at(M(cerebellumGeo(), gloss(0xe98aa2, { r: .4 })), 0, -.5, -.62); G.add(cb);
  const st = M(taper([[0, -.35, -.25], [0, -.8, -.35], [0, -1.15, -.32]], u => .2 * (1 - u * .35), { seg: 24, radial: 16 }), gloss(0xe07f95)); G.add(st);
  G.scale.setScalar(scale); G.userData.mat = m; return G;
}
function heart(scale = 1) {
  const G = new THREE.Group(), m = gloss(COL.heart, { r: .28, ei: .08 }), body = new THREE.Group(); G.add(body);
  const v = M(lathe([[0, -1], [.25, -.92], [.55, -.62], [.78, -.18], [.86, .2], [.8, .52], [.55, .74], [0, .8]], 64), m); v.rotation.z = .45; v.scale.set(1, 1, .82); body.add(v);
  const ra = at(M(new THREE.SphereGeometry(.42, 48, 32), m), -.55, .55, .05); ra.scale.set(1, .85, .85); body.add(ra);
  const la = at(M(new THREE.SphereGeometry(.36, 48, 32), m), .45, .7, -.15); body.add(la);
  const art = gloss(COL.artery, { r: .3 }), ven = gloss(COL.vein, { r: .3 });
  G.add(M(taper([[.05, .55, 0], [.1, 1.25, .05], [.55, 1.55, -.05], [.95, 1.2, -.2], [1.0, .6, -.35]], u => .2 * (1 - u * .15), { seg: 64, radial: 20, closed: false }), art));   // aortic arch
  G.add(M(taper([[.3, .5, .25], [.35, 1.05, .3], [-.05, 1.2, .1]], u => .17, { seg: 40, radial: 18, closed: false }), gloss(0x5f7fe8)));                            // pulmonary trunk
  G.add(M(taper([[-.6, .7, 0], [-.62, 1.5, -.02]], u => .15, { seg: 20, radial: 18, closed: false }), ven));                                                         // superior vena cava
  [[.25, 1.45, .02, .45, 1.95, .05], [.5, 1.52, -.05, .62, 1.98, -.05], [.75, 1.4, -.1, .95, 1.85, -.1]].forEach(([a, b, c, d, e, f]) => G.add(M(taper([[a, b, c], [d, e, f]], u => .07 * (1 - u * .3), { seg: 12, radial: 12, closed: false }), art)));
  // coronary vessels on the surface
  const cor = gloss(0xff6a5e, { r: .3, ei: .15 });
  [[[-.1, .45, .72], [.05, 0, .78], [.22, -.5, .62], [.3, -.85, .3]], [[.1, .5, .7], [.5, .2, .62], [.72, -.25, .4]]].forEach(P => body.add(M(taper(P, u => .045 * (1 - u * .6), { seg: 30, radial: 8 }), cor)));
  G.scale.setScalar(scale); G.userData.mat = m; G.userData.body = body; return G;
}
function stomachGeo() {   // J-shaped sac: oesophagus enters top-left, fundus bulges up-right, greater curvature sweeps down and back left to the pylorus
  const g = taper([[-.18, 1.0, 0], [-.12, .72, 0], [.12, .62, 0], [.42, .45, 0], [.55, .08, 0], [.42, -.32, 0], [.12, -.52, 0], [-.22, -.5, 0], [-.48, -.36, 0], [-.66, -.2, 0]],
    u => .1 + .34 * Math.pow(Math.sin(Math.PI * clamp(u * 1.08)), .8) * (1 - u * .45), { seg: 120, radial: 40 }), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * .72); g.computeVertexNormals(); return g;
}
function intestineCurve(seed = 3, R = 1, turns = 9) {
  const r = rng(seed), P = []; let a = 0;
  for (let i = 0; i <= turns * 10; i++) { const u = i / (turns * 10), row = Math.floor(u * turns), f = u * turns - row, dir = row % 2 ? -1 : 1;
    const y = lerp(.85, -.85, (row + sm(f > .85 ? (f - .85) / .15 : 0)) / turns) * R, x = dir * lerp(-.8, .8, clamp(f / .85)) * R * Math.sqrt(Math.max(.2, 1 - y * y / (R * R) * .7));
    a += .4; P.push(V3(x + Math.sin(a * 1.7 + r()) * .09 * R, y + Math.sin(a * 2.3 + row) * .1 * R + Math.sin(a * .7) * .05 * R, Math.cos(a * 1.3 + row) * .25 * R + Math.sin(i * .9) * .1 * R)); }
  return new THREE.CatmullRomCurve3(P);
}
function intestine(scale = 1) { const g = new THREE.TubeGeometry(intestineCurve(), 900, .085, 18, false), G = new THREE.Group(), m = gloss(COL.gut, { r: .35 }); G.add(M(g, m)); G.scale.setScalar(scale); G.userData.mat = m; return G; }
function colon(scale = 1) {
  const P = [[-.8, -.75, 0], [-.88, -.2, 0], [-.85, .7, .02], [-.4, .82, .1], [.4, .82, .1], [.85, .72, .02], [.9, -.1, 0], [.82, -.75, 0], [.45, -1.0, .02], [.1, -1.05, 0]];
  const G = new THREE.Group(), m = gloss(COL.colon, { r: .38 }); G.add(M(taper(P, u => .15 * (1 + .18 * Math.abs(Math.sin(u * 60))) * (u > .85 ? 1 - (u - .85) * 2.5 : 1), { seg: 300, radial: 24, closed: false }), m));
  G.scale.setScalar(scale); G.userData.mat = m; return G; }
function liverGeo() { const g = new THREE.SphereGeometry(1, 96, 64), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = clamp((x + 1) / 2), h = lerp(1, .22, Math.pow(t, 1.3));                      // big right lobe (−x, patient's right) tapering to the left lobe
    y = y * h * .78 + (y < 0 ? .25 * (1 - t) * -y * .2 : 0); if (y < 0) y *= .55;           // flat-ish underside
    x = x * 1.55; z = z * .85 * lerp(1, .5, t); p.setXYZ(i, x, y + .1 * Math.sin(x * 2), z); }
  g.computeVertexNormals(); return g; }
function liver(scale = 1) { const G = new THREE.Group(), m = gloss(COL.liver, { r: .3, ei: .07 }); G.add(M(liverGeo(), m));
  const gb = at(M(new THREE.SphereGeometry(.17, 32, 24), gloss(0x6fbf73, { r: .3 })), -.25, -.38, .35); gb.scale.set(.8, 1.4, .8); gb.rotation.z = .5; G.add(gb);   // gallbladder
  G.scale.setScalar(scale); G.userData.mat = m; return G; }
function kidneyGeo() { const g = new THREE.SphereGeometry(1, 48, 32), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), dent = .55 * Math.exp(-Math.pow(y / .35, 2)) * clamp(-x); p.setXYZ(i, (x + dent * .9) * .55, y, z * .4); }
  g.computeVertexNormals(); return g; }
function adrenalGeo() { const g = new THREE.ConeGeometry(.5, .6, 24, 6), p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * .45); g.computeVertexNormals(); return g; }
function kidneyPair(scale = 1) { const G = new THREE.Group(), km = gloss(COL.kidney, { r: .32 }), am = gloss(COL.adrenal, { r: .3, ei: .12 });
  for (const sx of [-1, 1]) { const k = at(M(kidneyGeo(), km), sx * .62, sx > 0 ? .1 : 0, 0); k.scale.x = sx; G.add(k);
    const a = at(M(adrenalGeo(), am), sx * .55, sx > 0 ? 1.18 : 1.08, 0); a.rotation.z = sx * -.3; a.scale.setScalar(.75); G.add(a); }
  G.scale.setScalar(scale); G.userData.mat = km; G.userData.adrenal = am; return G; }
function lung(sx) { const g = new THREE.SphereGeometry(1, 48, 32), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = y > 0 ? 1 - .35 * y * y : 1; p.setXYZ(i, x * .5 * r - (sx * x < 0 ? .12 * x * x : 0), y, z * .45 * r); }
  g.computeVertexNormals(); return g; }
// red blood cell: biconcave disc
let RBC_GEO = null; const rbcGeo = () => RBC_GEO ||= lathe([[0, .14], [.35, .2], [.7, .32], [.95, .22], [1, 0], [.95, -.22], [.7, -.32], [.35, -.2], [0, -.14]], 40);

// ---------- molecules ----------
// caffeine C8H10N4O2, ball-and-stick (heavy atoms + methyl groups), ~3 units across
function caffeineLayout() {
  const L = 1.4, hex = [...Array(6)].map((_, k) => { const a = (90 - 60 * k) * Math.PI / 180; return V3(L * Math.cos(a), L * Math.sin(a), 0); });
  const [C2, N3, C4, C5, C6, N1] = [hex[0], hex[1], hex[2], hex[3], hex[4], hex[5]];
  const mid = C4.clone().add(C5).multiplyScalar(.5), n = mid.clone().normalize(), c = mid.clone().addScaledVector(n, L / (2 * Math.tan(Math.PI / 5))), R = L / (2 * Math.sin(Math.PI / 5));
  const aA = Math.atan2(C4.y - c.y, C4.x - c.x), aB = Math.atan2(C5.y - c.y, C5.x - c.x); let s = Math.sign(Math.sin(aA - aB)) || 1;
  const pv = k => V3(c.x + R * Math.cos(aA + s * 2 * Math.PI / 5 * k), c.y + R * Math.sin(aA + s * 2 * Math.PI / 5 * k), 0);
  const N9 = pv(1), C8 = pv(2), N7 = pv(3);
  const out = (a, from, d) => a.clone().add(a.clone().sub(from).normalize().multiplyScalar(d));
  const O2 = out(C2, V3(0, 0, 0), 1.23), O6 = out(C6, V3(0, 0, 0), 1.23), M1 = out(N1, V3(0, 0, 0), 1.47), M3 = out(N3, V3(0, 0, 0), 1.47), M7 = out(N7, c, 1.47);
  const atoms = [[C2, 'C'], [N3, 'N'], [C4, 'C'], [C5, 'C'], [C6, 'C'], [N1, 'N'], [N9, 'N'], [C8, 'C'], [N7, 'N'], [O2, 'O'], [O6, 'O'], [M1, 'C'], [M3, 'C'], [M7, 'C']];
  const bonds = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [2, 6], [6, 7], [7, 8], [8, 3], [0, 9, 2], [4, 10, 2], [5, 11], [1, 12], [8, 13], [6, 7, 2]];
  const cen = atoms.reduce((a, [p]) => a.add(p), V3(0, 0, 0)).multiplyScalar(1 / atoms.length); atoms.forEach(([p]) => p.sub(cen));
  return { atoms, bonds };
}
const MOLM = {};
function molMats(tint) { const k = tint || 'std'; if (MOLM[k]) return MOLM[k];
  return MOLM[k] = tint ? { C: gloss(tint, { r: .25, ei: .5 }), N: gloss(tint, { r: .25, ei: .5 }), O: gloss(tint, { r: .25, ei: .5 }), bond: gloss(tint, { r: .3, ei: .3 }) }
    : { C: gloss(0x3a4352, { r: .25 }), N: gloss(0x3d7bff, { r: .22, ei: .12 }), O: gloss(0xff4a4a, { r: .22, ei: .12 }), bond: gloss(0xdfe6ef, { r: .3 }) }; }
function caffeine(scale = 1, tint = null) {
  const { atoms, bonds } = caffeineLayout(), mm = molMats(tint), G = new THREE.Group(), sph = new THREE.SphereGeometry(1, 32, 24), cyl = new THREE.CylinderGeometry(.12, .12, 1, 16);
  atoms.forEach(([p, e], i) => { const s = at(M(sph, mm[e]), p.x, p.y, p.z); s.scale.setScalar(e === 'O' ? .42 : e === 'N' ? .4 : i > 10 ? .36 : .4); G.add(s); });
  bonds.forEach(([a, b, order]) => { const A = atoms[a][0], B = atoms[b][0], d = B.clone().sub(A), L = d.length(), mid = A.clone().add(B).multiplyScalar(.5);
    const offs = order === 2 ? [-.14, .14] : [0], perp = V3(-d.y, d.x, 0).normalize();
    offs.forEach(o => { const c = M(cyl, mm.bond); c.position.copy(mid).addScaledVector(perp, o); c.scale.set(1, L, 1); c.quaternion.setFromUnitVectors(V3(0, 1, 0), d.clone().normalize()); G.add(c); }); });
  G.scale.setScalar(scale); return G;
}
// adenosine: stylised (purine double ring + ribose pentagon), soft blue
function adenosine(scale = 1) { const G = new THREE.Group(), m = gloss(COL.adeno, { r: .25, ei: .35 }), sph = new THREE.SphereGeometry(1, 24, 16);
  [[0, .5], [.6, .85], [1.2, .5], [1.2, -.2], [.6, -.55], [0, -.2], [-.65, .75], [-1.1, .25], [-.65, -.4], [.7, -1.3], [.2, -1.8], [.8, -2.35], [1.45, -2.0], [1.3, -1.35]].forEach(([x, y], i) => { const s = at(M(sph, m), x, y, 0); s.scale.setScalar(i > 8 ? .32 : .36); G.add(s); });
  G.scale.setScalar(scale); return G; }

// ethanol C2H5OH: two carbons + hydroxyl (O–H) + 5 hydrogens, ball-and-stick; tint = one-colour glow version (gold ethanol, orange acetaldehyde…)
function ethanol(scale = 1, tint = null) {
  const G = new THREE.Group(), mm = molMats(tint), Hm = tint ? mm.C : gloss(0xf2f5fa, { r: .25 }), sph = new THREE.SphereGeometry(1, 28, 20), cyl = new THREE.CylinderGeometry(.12, .12, 1, 14);
  const A = [[V3(-.75, -.25, 0), 'C'], [V3(.75, .25, 0), 'C'], [V3(1.95, -.55, 0), 'O'], [V3(2.95, -.05, 0), 'H'],
    [V3(-1.05, -1.3, .35), 'H'], [V3(-1.75, .35, .25), 'H'], [V3(-.75, -.05, -1.1), 'H'], [V3(.8, 1.3, .55), 'H'], [V3(.9, .7, -1.0), 'H']];
  A.forEach(([p, e]) => { const s = at(M(sph, e === 'H' ? Hm : mm[e]), p.x, p.y, p.z); s.scale.setScalar(e === 'H' ? .26 : e === 'O' ? .44 : .46); G.add(s); });
  [[0, 1], [1, 2], [2, 3], [0, 4], [0, 5], [0, 6], [1, 7], [1, 8]].forEach(([a, b]) => { const P = A[a][0], Q = A[b][0], d = Q.clone().sub(P), c = M(cyl, mm.bond);
    c.position.copy(P).add(Q).multiplyScalar(.5); c.scale.set(1, d.length(), 1); c.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize()); G.add(c); });
  G.children.forEach(c => c.position.x -= .6); G.scale.setScalar(scale); return G;
}

// ---------- mouth / chili ----------
// tongue: flattened ellipsoid (tip toward +z), median groove on top; tongueTop(x, z) = height of the upper surface (for papillae / particles)
const TONGUE = { a: .78, b: .24, c: 1.75 };
function tongueTop(x, z) { const { a, b, c } = TONGUE, q = 1 - x * x / (a * a) - z * z / (c * c); return q <= 0 ? 0 : b * Math.sqrt(q) - .09 * Math.exp(-Math.pow(x / .1, 2)) * clamp(1 - Math.abs(z) / c * .4); }
function tongueGeo() { const { a, b, c } = TONGUE, g = new THREE.SphereGeometry(1, 96, 64), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) * a, y = p.getY(i), z = p.getZ(i) * c, top = y > 0;
    p.setXYZ(i, x * (1 + .1 * clamp(-z / c) - .3 * clamp(z / c) ** 1.5), top ? tongueTop(x, z) * Math.min(1, y * 1.4 + .3) : y * b * .45, z); }
  g.computeVertexNormals(); return g; }
function chiliMesh() { const G = new THREE.Group();
  G.add(M(taper([[0, 0, 0], [.08, -.35, .05], [.1, -.8, .12], [.0, -1.25, .22], [-.15, -1.55, .3]], u => .15 * (1 - Math.pow(u, 1.6)) + .012, { seg: 64, radial: 24 }), gloss(0xc40d14, { r: .22, ei: .15, sheen: 0, env: .7 })));
  const cal = M(new THREE.ConeGeometry(.17, .12, 20), gloss(0x3f8a2a, { r: .4 })); cal.position.y = .03; cal.rotation.x = Math.PI; G.add(cal);
  G.add(M(taper([[0, .02, 0], [.02, .16, -.02], [.08, .26, -.06]], u => .035 * (1 - u * .4), { seg: 16, radial: 10 }), gloss(0x4e9a32, { r: .4 })));
  return G; }
// capsaicin: vanillyl ring (O–H and O–CH3) + amide link + branched 9-carbon tail (zig-zag), ball-and-stick, red-orange tint
function capsaicin(scale = 1) {
  const G = new THREE.Group(), m = gloss(0xff5a1e, { r: .25, ei: .45 }), mo = gloss(0xffc04a, { r: .25, ei: .5 }), bond = gloss(0xffd2b0, { r: .3, ei: .2 }), sph = new THREE.SphereGeometry(1, 20, 14), cyl = new THREE.CylinderGeometry(.12, .12, 1, 10);
  const P = []; for (let k = 0; k < 6; k++) { const a = (90 - 60 * k) * Math.PI / 180; P.push(V3(-4 + 1.4 * Math.cos(a), 1.4 * Math.sin(a), 0)); }
  const ring = P.slice(); P.push(V3(-4, 2.8, 0), V3(-5.3, -2.0, 0));                     // O on ring
  let prev = ring[1], x = -1.6, y = .7; const chain = []; for (let k = 0; k < 12; k++) { const p = V3(x, y, 0); chain.push(p); P.push(p); x += 1.25; y = k % 2 ? .7 : 0; }
  P.forEach((p, i) => { const s = at(M(sph, i === 6 || i === 7 || i === 9 ? mo : m), p.x, p.y, p.z); s.scale.setScalar(.4); G.add(s); });
  const link = (A, B) => { const d = B.clone().sub(A), c = M(cyl, bond); c.position.copy(A).add(B).multiplyScalar(.5); c.scale.set(1, d.length(), 1); c.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize()); G.add(c); };
  for (let k = 0; k < 6; k++) link(ring[k], ring[(k + 1) % 6]); link(ring[0], P[6]); link(ring[4], P[7]); link(prev, chain[0]); for (let k = 0; k < chain.length - 1; k++) link(chain[k], chain[k + 1]);
  const box = new THREE.Box3().setFromObject(G), cen = box.getCenter(V3(0, 0, 0)); G.children.forEach(c => c.position.sub(cen));
  G.scale.setScalar(scale); return G; }

// ---------- body rig: transparent human + organs at anatomical spots ----------
const ORG = { nao: [0, 1.665, -.005, .072], tim: [.028, 1.275, .045, .052], phoi: [0, 1.29, 0, .1], gan: [-.055, 1.155, .03, .085], 'da-day': [.06, 1.125, .03, .06],
  'ruot-non': [0, .985, .045, .09], 'ruot-gia': [0, 1.0, .03, .11], than: [0, 1.07, -.055, .06], 'thuong-than': [-.04, 1.115, -.055, .02], 'thuc-quan': [0, 1.42, .0, .04], mach: [0, 1.2, -.03, .1] };
export const ORGAN_NAMES = { nao: 'NÃO', tim: 'TIM', phoi: 'PHỔI', gan: 'GAN', 'da-day': 'DẠ DÀY', 'ruot-non': 'RUỘT NON', 'ruot-gia': 'RUỘT GIÀ', than: 'THẬN', 'thuong-than': 'TUYẾN THƯỢNG THẬN', 'thuc-quan': 'THỰC QUẢN', mach: 'MẠCH MÁU' };
function bodyRig() {
  const G = new THREE.Group(), geo = bodyGeometry();
  const skin = new THREE.MeshPhysicalMaterial({ color: 0x9fdcff, roughness: .18, metalness: 0, clearcoat: 1, clearcoatRoughness: .08, transparent: true, opacity: .1, depthWrite: false, envMapIntensity: 1.4, side: THREE.FrontSide });
  const rim = fresnel(COL.shell, { p: 2.2, k: 1.25, op: 1 }), shell = new THREE.Group(); shell.add(M(geo, skin), M(geo, rim)); shell.renderOrder = 10; shell.children.forEach(c => c.renderOrder = 10); G.add(shell);
  const O = {}, put = (k, obj) => { const [x, y, z, s] = ORG[k]; at(obj, x, y, z); obj.scale.multiplyScalar(s); G.add(obj); O[k] = obj; return obj; };
  put('nao', brain()); O.nao.rotation.y = 0;
  const lungM = gloss(COL.lung, { op: .28, r: .3, ei: .2 }); O.phoi = new THREE.Group(); [-1, 1].forEach(sx => O.phoi.add(at(M(lung(sx), lungM), sx * .78, 0, 0))); put('phoi', O.phoi); O.phoi.userData.mat = lungM;
  put('tim', heart()); put('gan', liver()); put('da-day', (() => { const g = new THREE.Group(), m = gloss(COL.stomach, { r: .3, ei: .07 }); g.add(M(stomachGeo(), m)); g.userData.mat = m; g.rotation.z = -.15; return g; })());
  put('ruot-gia', colon()); put('ruot-non', intestine()); O['ruot-non'].scale.set(.075, .07, .06); put('than', kidneyPair());
  // oesophagus (mouth → stomach) as a soft pink tube
  const eso = new THREE.CatmullRomCurve3([V3(0, 1.585, .055), V3(0, 1.52, .0), V3(0, 1.42, -.02), V3(.01, 1.3, -.03), V3(.03, 1.2, -.01), V3(.055, 1.17, .02)]);
  const esoM = gloss(0xf3a0a0, { op: .55, r: .3, ei: .1 }); O['thuc-quan'] = M(new THREE.TubeGeometry(eso, 60, .011, 12, false), esoM); O['thuc-quan'].userData.mat = esoM; G.add(O['thuc-quan']);
  // arteries / veins: aorta + carotids + iliacs + limb branches (thin glossy tubes)
  const art = gloss(COL.artery, { r: .3, ei: .15 }), vein = gloss(COL.vein, { r: .3, ei: .15 }), V = new THREE.Group(); V.userData.mat = art;
  const tube = (pts, r, m) => V.add(M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => V3(...p))), 64, r, 8, false), m));
  const aorta = [[.03, 1.3, .02], [.03, 1.37, 0], [-.005, 1.36, -.04], [-.01, 1.2, -.05], [-.005, 1.0, -.045], [0, .93, -.03]];
  tube(aorta, .008, art); [-1, 1].forEach(sx => { tube([[0, .93, -.03], [sx * .06, .88, -.01], [sx * .09, .6, 0], [sx * .1, .2, -.01]], .005, art); tube([[.015 * sx, 1.37, -.01], [sx * .025, 1.5, .0], [sx * .03, 1.6, .02]], .004, art);
    tube([[sx * .03, 1.38, -.02], [sx * .17, 1.39, -.01], [sx * .245, 1.14, -.02], [sx * .275, .88, .02]], .0035, art);
    tube([[sx * .02, .92, -.02], [sx * .075, .88, -.025], [sx * .105, .6, -.015], [sx * .11, .2, -.025]], .005, vein); tube([[sx * .012, 1.3, -.06], [sx * .035, 1.5, -.03], [sx * .04, 1.6, -.0]], .004, vein); });
  tube([[-.015, 1.32, -.06], [-.012, 1.1, -.07], [-.01, .93, -.05]], .007, vein);
  G.add(V); O.mach = V; O.mach.userData.path = new THREE.CatmullRomCurve3(aorta.map(p => V3(...p)));
  // flow paths for glowing particles
  const paths = {
    nao: new THREE.CatmullRomCurve3([V3(.06, 1.08, .02), V3(.03, 1.25, .02), V3(.03, 1.37, 0), V3(.025, 1.5, .0), V3(.03, 1.6, .02), V3(0, 1.67, .0)]),
    tim: new THREE.CatmullRomCurve3([V3(0, .98, .04), V3(-.01, 1.1, -.06), V3(-.005, 1.25, -.06), V3(.02, 1.28, .04)]),
    gan: new THREE.CatmullRomCurve3([V3(0, .98, .04), V3(-.03, 1.06, .02), V3(-.06, 1.13, .03), V3(-.08, 1.16, .03)]),
    'thuc-quan': eso };
  return { G, O, shell, skin, rim, paths };
}

// ---------- coffee cup ----------
function cup(liquid = COL.coffee) {
  const G = new THREE.Group(), cer = gloss(0xf6f1ea, { r: .18, ei: 0, sheen: .2 }), saucerM = gloss(0xeee7dc, { r: .2, ei: 0 });
  G.add(M(lathe([[.0, 0], [.55, 0], [.62, .05], [.7, .4], [.82, 1.1], [.86, 1.32], [.82, 1.34], [.76, 1.12], [.63, .45], [.55, .14], [0, .14]], 96), cer));
  const h = M(new THREE.TorusGeometry(.3, .07, 20, 48, Math.PI * 1.25), cer); h.position.set(.86, .72, 0); h.rotation.z = -Math.PI * .62; G.add(h);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(.79, 64), new THREE.MeshPhysicalMaterial({ color: liquid, roughness: .08, clearcoat: 1, clearcoatRoughness: .02, emissive: 0x1a0a04, emissiveIntensity: .3 }));
  coffee.rotation.x = -Math.PI / 2; coffee.position.y = 1.12; G.add(coffee);
  const crema = new THREE.Mesh(new THREE.RingGeometry(.55, .79, 64), new THREE.MeshPhysicalMaterial({ color: 0x9a5a2c, roughness: .4, transparent: true, opacity: .55, depthWrite: false })); crema.rotation.x = -Math.PI / 2; crema.position.y = 1.121; G.add(crema);
  const saucer = M(lathe([[0, -.06], [1.5, -.04], [1.6, .06], [1.55, .09], [1.1, .02], [0, 0]], 96), saucerM); G.add(saucer);
  return G;
}

// ---------- sets: (o) → { G, mood?, update(s, K) → labels[] } ----------
const SETS = {
  'ly-ca-phe'(o) {
    const G = new THREE.Group(), c = cup(o.sua ? 0xb9b2a6 : COL.coffee); G.add(c); if (o.sua) c.children.forEach(k => { if (k.geometry && k.geometry.type === 'RingGeometry') k.visible = false; });
    const table = M(new THREE.CylinderGeometry(6, 6, .2, 96), gloss(0x0d1828, { r: .55, ei: 0, cc: .25, env: .4 })); table.position.y = -.17; G.add(table);
    const steam = points(160, .16, 0xdbe8ff, (i, t, v) => { const r = rng(i + 3), life = 3.2, ph = (t / life + r()) % 1, a = r() * 6.28, rr = .5 * r();
      v.set(Math.cos(a) * rr + Math.sin(t * 1.3 + i) * .12 * ph, 1.2 + ph * 2.2, Math.sin(a) * rr + Math.cos(t * 1.1 + i) * .1 * ph); }, .25); G.add(steam);
    const mols = [...Array(o.phan_tu === false ? 0 : 7)].map((_, k) => { const m = caffeine(.11, k ? COL.gold : null); G.add(m); return m; });
    return { G, mood: o.sua ? { key: .65, env: .55, hemi: .7 } : { key: 1.1, env: .9 }, update(s, K) { steam.tick(s.t);
      mols.forEach((m, k) => { const r = rng(k * 11 + 5), d = .6 + k * .38, u = clamp((s.lt - d) / 3.2); m.visible = u > 0; const a = r() * 6.28 + s.lt * .3;
        m.position.set(Math.cos(a) * (.25 + .9 * u) * (k ? 1 : 0), 1.3 + u * (k ? 2.2 : 1.55) + (k ? 0 : .1), Math.sin(a) * (.25 + .9 * u) * (k ? 1 : .2) + (k ? 0 : .3));
        m.rotation.set(s.lt * .6 + k, s.lt * .8 + k * 2, 0); m.scale.setScalar((k ? .07 : .16) * sm(u * 3)); });
      const a = .35 + s.u * .5; K.cam(Math.sin(a) * 7.6, 3.6 - s.u * .5, Math.cos(a) * 7.6, 0, 1.45, 0);
      return mols[0] && mols[0].visible && o.nhan !== false ? [{ text: o.nhan || 'CAFFEINE', p: mols[0].position.clone().add(V3(0, .45, 0)), a: sm((s.lt - 1.6) / .5) }] : []; } };
  },

  // glass of beer: tall clear glass, amber beer, foam head, rising bubbles; gold ethanol molecules float up { phan_tu: false, nhan: "CỒN · ETHANOL" }
  'ly-bia'(o) {
    const G = new THREE.Group(), prof = [[0, 0], [.6, 0], [.66, .06], [.7, .5], [.86, 2.5], [.9, 2.62]];
    const glass = M(lathe(prof, 96), new THREE.MeshPhysicalMaterial({ color: 0xe6f6ff, roughness: .04, clearcoat: 1, clearcoatRoughness: .02, transparent: true, opacity: .07, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: .8 }));
    const rimG = M(lathe(prof, 96), fresnel(0xbfeaff, { p: 3.2, k: .7, op: .6 })); glass.renderOrder = rimG.renderOrder = 5;
    const beer = M(lathe([[0, .1], [.62, .1], [.66, .5], [.78, 1.95], [0, 1.95]], 96), gloss(0xe09400, { r: .1, ei: .75, e: 0xf09000, env: .8, sheen: 0 }));
    const foamM = gloss(0xf4ead2, { r: .7, ei: .04, cc: .1, sheen: .3, env: .6 }), foam = M(lathe([[0, 1.94], [.785, 1.94], [.83, 2.2], [.8, 2.36], [0, 2.4]], 96), foamM);
    const bumps = new THREE.InstancedMesh(new THREE.SphereGeometry(.1, 14, 10), foamM, 60), d = new THREE.Object3D(), r0 = rng(17);
    for (let i = 0; i < 60; i++) { const a = r0() * 6.28, rr = Math.sqrt(r0()) * .72; d.position.set(Math.cos(a) * rr, 2.33 + r0() * .06, Math.sin(a) * rr); d.scale.setScalar(.7 + r0() * .8); d.updateMatrix(); bumps.setMatrixAt(i, d.matrix); }
    G.add(beer, foam, bumps, glass, rimG);
    const bub = points(140, .05, 0xfff2c0, (i, t, v) => { const r = rng(i + 5), ph = (t * (.25 + r() * .2) + r()) % 1, a = r() * 6.28, rr = .1 + r() * .55; v.set(Math.cos(a) * rr * (.85 + ph * .2), .2 + ph * 1.7, Math.sin(a) * rr * (.85 + ph * .2)); }, .8); G.add(bub);
    const table = M(new THREE.CylinderGeometry(6, 6, .2, 96), gloss(0x0d1828, { r: .55, ei: 0, cc: .25, env: .4 })); table.position.y = -.1; G.add(table);
    const mols = [...Array(o.phan_tu === false ? 0 : 6)].map((_, k) => { const m = ethanol(k ? .12 : .2, COL.gold); G.add(m); return m; });
    return { G, mood: { key: 1.05, env: .95 }, update(s, K) { bub.tick(s.t);
      mols.forEach((m, k) => { const r = rng(k * 13 + 3), dl = .8 + k * .45, u = clamp((s.lt - dl) / 3.2), a = r() * 6.28 + s.lt * .3; m.visible = u > 0;
        m.position.set(Math.cos(a) * (.2 + 1.0 * u) * (k ? 1 : .3), 2.5 + u * (k ? 1.8 : 1.15), Math.sin(a) * (.2 + 1.0 * u) * (k ? 1 : .3) + (k ? 0 : .3));
        m.rotation.set(s.lt * .6 + k, s.lt * .8 + k * 2, 0); m.scale.setScalar((k ? .12 : .2) * sm(u * 3)); });
      const a = .3 + s.u * .45; K.cam(Math.sin(a) * 9.6, 3.0 - s.u * .4, Math.cos(a) * 9.6, 0, 2.0, 0);
      return mols[0] && mols[0].visible && o.nhan !== false ? [{ text: o.nhan || 'CỒN · ETHANOL', p: mols[0].position.clone().add(V3(0, .5, 0)), a: sm((s.lt - 1.8) / .5) }] : []; } };
  },

  'co-the'(o) {
    const R = bodyRig(), G = R.G, soi = new Set([].concat(o.soi || [])), all = Object.keys(R.O);
    all.forEach(k => { const m = R.O[k].userData.mat; if (m && soi.size && !soi.has(k)) { m.userData.base ??= m.opacity; m.transparent = true; m.opacity = .35; m.depthWrite = false; } });
    const fl = M(new THREE.CircleGeometry(1.4, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x1d6fa8, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false })); G.add(fl);
    const ringM = new THREE.MeshBasicMaterial({ color: 0x5fd4ff, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false });
    const ring = M(new THREE.RingGeometry(.62, .64, 96).rotateX(-Math.PI / 2), ringM); ring.position.y = .002; G.add(ring);
    // swallowed coffee bolus along the oesophagus
    const bol = glowSprite(.06, 0xc0743a, 1); G.add(bol);
    // caffeine particles: along a path (dong) or circulating everywhere (toan-than) — count follows muc
    const path = o.dong && R.paths[o.dong], N = 90;
    const circ = [R.paths.nao, R.paths.tim, R.paths.gan, new THREE.CatmullRomCurve3([V3(0, .93, -.03), V3(.09, .6, 0), V3(.1, .2, -.01)]), new THREE.CatmullRomCurve3([V3(0, .93, -.03), V3(-.09, .6, 0), V3(-.1, .2, -.01)]),
      new THREE.CatmullRomCurve3([V3(.03, 1.38, -.02), V3(.17, 1.39, -.01), V3(.245, 1.14, -.02), V3(.275, .88, .02)]), new THREE.CatmullRomCurve3([V3(-.03, 1.38, -.02), V3(-.17, 1.39, -.01), V3(-.245, 1.14, -.02), V3(-.275, .88, .02)])];
    let lvl = 1;
    const caf = points(N, .022, COL.gold, (i, t, v) => { const r = rng(i * 7 + 1), c = path || circ[i % circ.length], u = (t * (.18 + r() * .1) + r()) % 1;
      if (o.dong === undefined && o.muc === undefined) return false; if (r() > lvl) return false; c.getPointAt(u, v); v.x += (r() - .5) * .012; v.z += (r() - .5) * .012; }); G.add(caf);
    // { mo_hoi: true } sweat beads on forehead / face / neck slide down the skin (thermoregulation reflex)
    const sweat = points(o.mo_hoi ? 110 : 0, .024, 0xbfeeff, (i, t, v) => { const r = rng(i + 31), a = (r() - .5) * 2.2, y0 = 1.62 + r() * .1 - (i % 3 === 2 ? .2 : 0), ph = (t * (.08 + r() * .06) + r()) % 1;
      if (sm(lvlS) < r()) return false; const rr = i % 3 === 2 ? .05 : .085; v.set(Math.sin(a) * rr, y0 - ph * .12, Math.cos(a) * rr * 1.05 + .005); }, 1); G.add(sweat); let lvlS = 0;
    // { do_mat: true } alcohol flush: warm red glow spreads over face, neck and upper chest
    const flush = o.do_mat ? [[0, 1.6, .075, .2], [0, 1.53, .05, .14], [0, 1.4, .08, .26]].map(([x, y, z, sz]) => { const g = glowSprite(sz * 1.3, 0xff2a1a, 0); at(g, x, y, z); g.renderOrder = 12; G.add(g); return g; }) : [];
    const glowAt = {}; soi.forEach(k => { const [x, y, z, s] = ORG[k] || ORG.mach; const g = glowSprite(s * 3.2, k === 'thuong-than' ? COL.adrenal : 0x7fe3ff, .0); at(g, x, y, z + .02); G.add(g); glowAt[k] = g; });
    return { G, mood: { key: .9, env: 1 }, update(s, K) {
      const pulse = .5 + .5 * Math.sin(s.t * 4.2);
      soi.forEach(k => { const ob = R.O[k]; if (ob && k !== 'tim' && k !== 'mach') { ob.userData.s0 ??= ob.scale.clone(); const w = 1 + (k === 'ruot-gia' || k === 'ruot-non' || k === 'da-day' ? .045 * Math.sin(s.t * 5) : .02 * pulse); ob.scale.set(ob.userData.s0.x * w, ob.userData.s0.y * (2 - w), ob.userData.s0.z * w); } });   // highlighted organs breathe; gut organs squeeze (peristalsis)
      soi.forEach(k => { const m = R.O[k] && R.O[k].userData.mat; if (m) m.emissiveIntensity = .12 + .28 * pulse * sm(s.lt / .6); if (k === 'thuong-than') R.O.than.userData.adrenal.emissiveIntensity = .2 + .8 * pulse; glowAt[k].material.opacity = (.25 + .3 * pulse) * sm(s.lt / .6); });
      const hb = 1 + .05 * Math.max(0, Math.sin(s.t * Math.PI * 2 * (o.nhip || 75) / 60)) ** 8; R.O.tim.userData.body.scale.setScalar(hb);
      if (o.uong) { const u = clamp((s.u - o.uong[0]) / (o.uong[1] - o.uong[0])); bol.visible = u > 0 && u < 1; R.paths['thuc-quan'].getPointAt(sm(u), bol.position); bol.scale.setScalar(.05 + .02 * Math.sin(s.t * 9)); } else bol.visible = false;
      lvl = o.muc !== undefined ? range(o.muc, sm(s.u)) : 1; caf.tick(s.t); lvlS = o.mo_hoi ? clamp(s.lt / 2.5) : 0; sweat.tick(s.t);
      flush.forEach((g, i) => { g.material.opacity = (1 + .2 * Math.sin(s.t * 2 + i)) * sm((s.lt - .3 - i * .5) / 2); });
      ring.scale.setScalar(1 + .04 * Math.sin(s.t * 1.5)); R.G.rotation.y = o.goc === 'xoay' ? -.5 + s.u * 1.0 : o.goc === 'nghieng' ? -.55 : Math.sin(s.t * .25) * .12;
      // camera: wide body shot → optional fly-in to an organ (shell fades as we pass through the skin)
      const tgt = o.bay && ORG[o.bay], wide = { p: V3(.35, 1.2, 2.55), l: V3(0, 1.08, 0) };
      if (o.tam) { const [x, y, z, d] = o.tam; wide.p.set(x + d * .25, y + .05, z + d); wide.l.set(x, y, z); }
      let p = wide.p.clone(), l = wide.l.clone();
      if (tgt) { const u = eio((s.u - (o.bay_tu ?? .15)) / ((o.bay_den ?? .9) - (o.bay_tu ?? .15))), [x, y, z, sz] = tgt, w = V3(x, y, z).applyAxisAngle(V3(0, 1, 0), R.G.rotation.y);
        p.lerp(w.clone().add(V3(sz * .7, sz * .4, sz * 3.2)), u); l.lerp(w, u); R.skin.opacity = .1 * (1 - sm((u - .55) / .3)); R.rim.uniforms.o.value = 1 - .85 * sm((u - .5) / .4); }
      else { p.add(V3(Math.sin(s.t * .2) * .05, 0, -s.u * .25)); R.skin.opacity = .1; R.rim.uniforms.o.value = 1; }
      K.cam(p.x, p.y, p.z, l.x, l.y, l.z);
      return o.nhan === false ? [] : [...soi].map((k, i) => { const [x, y, z, sz] = ORG[k] || ORG.mach; return { text: ORGAN_NAMES[k] || k, p: V3(x, y, z).applyAxisAngle(V3(0, 1, 0), R.G.rotation.y).add(V3(0, sz * .6, 0)), a: sm((s.lt - .5 - i * .35) / .4) }; }); } };
  },

  'da-day'(o) {
    const G = new THREE.Group(), stM = gloss(COL.stomach, { r: .28, ei: .08 }), st = M(stomachGeo(), stM); st.scale.setScalar(1.25); st.position.set(.3, .9, 0); st.rotation.z = -.1; G.add(st);
    const gut = intestine(1.1); gut.position.set(-.2, -1.35, 0); gut.scale.set(1.25, .9, .8); G.add(gut);
    const vesM = gloss(COL.artery, { r: .25, ei: .2 }), vc = new THREE.CatmullRomCurve3([V3(-2.4, -2.1, .55), V3(-1.4, -1.6, .75), V3(-.4, -1.15, .8), V3(.8, -1.0, .7), V3(1.9, -.5, .45), V3(2.6, .4, .1)]);
    G.add(M(new THREE.TubeGeometry(vc, 120, .1, 20, false), vesM));
    const cap = new THREE.CatmullRomCurve3([V3(-.1, -.95, .25), V3(.05, -1.0, .55), V3(.1, -1.02, .75)]);
    const brown = points(70, .09, o.mau_hat ?? 0xb06a32, (i, t, v) => { const r = rng(i + 2), u = (t * .09 + r()) % 1, a = r() * 6.28; v.set(.3 + Math.cos(a + t) * .45 * r() + (u > .7 ? -(u - .7) * 2.2 : 0), .55 + Math.sin(a * 2 + t * .7) * .35 * r() - u * .6, .3 + Math.sin(a) * .2); }, .8); G.add(brown);
    const gold = points(60, .075, COL.gold, (i, t, v) => { if (!o.hap_thu) return false; const r = rng(i + 40), u = (t * (.22 + r() * .12) + r()) % 1;
      if (u < .45) { cap.getPointAt(u / .45, v); v.x += (r() - .5) * .9; } else { vc.getPointAt(clamp(.45 + (u - .45) * 1.1), v); v.y += (r() - .5) * .08; v.z += .05; } }); G.add(gold);
    return { G, mood: { key: 1, env: 1 }, update(s, K) { brown.tick(s.t); gold.tick(s.t); st.scale.setScalar(1.25 * (1 + .015 * Math.sin(s.t * 2.2))); gut.rotation.z = Math.sin(s.t * .8) * .015;
      const a = -.25 + s.u * .45; K.cam(Math.sin(a) * 9, .2 + s.u * -.3, Math.cos(a) * 9, 0, -.25 - s.u * .3, 0);
      return [{ text: 'DẠ DÀY', p: V3(.6, 1.9, .3), a: sm((s.lt - .4) / .4) }, { text: 'RUỘT NON', p: V3(-1.3, -.5, .5), a: sm((s.lt - 1) / .4) }, ...(o.hap_thu ? [{ text: 'VÀO MÁU', p: V3(1.6, -.55, .6), a: sm((s.lt - 1.8) / .4) }] : [])]; } };
  },

  'mach-mau'(o) {
    const G = new THREE.Group(), L = 60, path = new THREE.CatmullRomCurve3([...Array(13)].map((_, i) => V3(Math.sin(i * .9) * 1.6, Math.cos(i * .7) * 1.2, -i * L / 12)));
    const wallM = new THREE.MeshPhysicalMaterial({ color: 0xc8303c, roughness: .35, clearcoat: .8, clearcoatRoughness: .2, side: THREE.BackSide, emissive: 0x3a0610, emissiveIntensity: .35, sheen: .4, sheenColor: new THREE.Color(0xff8a8a) });
    const wall = M(new THREE.TubeGeometry(path, 400, 1.6, 48, false), wallM); G.add(wall);
    const cells = new THREE.InstancedMesh(rbcGeo(), gloss(COL.rbc, { r: .3, ei: .12, sheen: .5, sheenC: 0xff9a9a }), 140); cells.frustumCulled = false; G.add(cells);
    const mols = [...Array(o.caffeine === false ? 0 : 14)].map(() => { const m = o.chat === 'ethanol' ? ethanol(.16, COL.gold) : caffeine(.09, COL.gold); G.add(m); return m; });
    const adr = points(o.adrenaline ? 160 : 0, .14, 0xff9a3c, (i, t, v) => { const r = rng(i + 77), u = ((r() + t * .006 * (1 + r())) % 1); path.getPointAt(u, v); v.x += (r() - .5) * 2; v.y += (r() - .5) * 2; }, .9); G.add(adr);
    const d = new THREE.Object3D(), pv = V3(0, 0, 0), tv = V3(0, 0, 0);
    return { G, mood: { key: .5, env: .6, bg: 0x2a0508, fog: .06 }, update(s, K) {
      for (let i = 0; i < 140; i++) { const r = rng(i + 1), u = (r() + s.t * (.008 + r() * .006)) % 1; path.getPointAt(u, pv); const a = r() * 6.28, rr = .25 + r() * 1.05;
        d.position.set(pv.x + Math.cos(a) * rr, pv.y + Math.sin(a) * rr, pv.z); d.rotation.set(s.t * (r() - .5) * 2 + r() * 6, s.t * (r() - .5) * 1.5 + r() * 6, 0); d.scale.setScalar(.28); d.updateMatrix(); cells.setMatrixAt(i, d.matrix); }
      cells.instanceMatrix.needsUpdate = true;
      mols.forEach((m, k) => { const r = rng(k * 5 + 9), u = (r() * .5 + .05 + s.t * .012) % 1; path.getPointAt(u, m.position); const a = r() * 6.28; m.position.x += Math.cos(a) * .7; m.position.y += Math.sin(a) * .7; m.rotation.set(s.t * .7 + k, s.t * .5, k); });
      adr.tick(s.t);
      const u = .02 + s.lt * .0105; path.getPointAt(u, pv); path.getPointAt(Math.min(1, u + .02), tv); K.cam(pv.x, pv.y, pv.z, tv.x, tv.y, tv.z);
      const near = mols.filter(m => m.position.distanceTo(pv) < 9 && m.position.clone().sub(pv).dot(tv.clone().sub(pv)) > 0).sort((a, b) => a.position.distanceTo(pv) - b.position.distanceTo(pv))[0];
      return near && o.nhan !== false ? [{ text: o.nhan || (o.chat === 'ethanol' ? 'CỒN' : 'CAFFEINE'), p: near.position.clone().add(V3(0, .35, 0)), a: sm((s.lt - .8) / .5) }] : []; } };
  },

  'nao'(o) {
    const G = new THREE.Group(), B = brain(1.3); G.add(B);
    const sparks = points(140, .09, 0x9fe8ff, (i, t, v) => { const r = rng(i + 13), a = r() * 6.28, b = r() * 3.14, on = Math.sin(t * (1.5 + r() * 3) + r() * 9) > .55;
      if (!on) return false; v.set(Math.sin(b) * Math.cos(a) * 1.08, Math.cos(b) * .95 + .05, Math.sin(b) * Math.sin(a) * 1.3); }, .95); if (!o.hanh_nhan) G.add(sparks);
    // hanh_nhan: [a, b] — x-ray brain: thalamus (blue) relays a signal from the eyes to the two amygdalae (orange-red, light up in the window), then down the brainstem
    let HN = null;
    if (o.hanh_nhan) {
      B.traverse(c => { if (c.material) { c.material = c.material.clone(); c.material.transparent = true; c.material.opacity = .26; c.material.depthWrite = false; } });
      B.add(M(brainGeo(), fresnel(0x5fd4ff, { p: 2.2, k: 1.1, base: .02 })));
      const amM = gloss(0xb06a50, { r: .25, ei: .2, e: 0xff4a10, op: 1 }), am = [-1, 1].map(sx => { const a = at(M(new THREE.SphereGeometry(.12, 32, 24), amM), sx * .3, -.3, .22); a.scale.set(1, .8, 1.35); a.renderOrder = 5; B.add(a); return a; });
      const thM = gloss(0x58a6ff, { r: .25, ei: .25, op: 1 }), th = at(M(new THREE.SphereGeometry(.13, 32, 24), thM), 0, -.02, -.05); th.scale.set(1.5, .8, 1); th.renderOrder = 5; B.add(th);
      const glow = am.map(a => { const g = glowSprite(1.1, 0xff5a1a, 0); g.position.copy(a.position); g.renderOrder = 6; B.add(g); return g; });
      const eyeP = V3(0, -.32, .82), path = sx => new THREE.CatmullRomCurve3([eyeP.clone().setX(sx * .25), V3(sx * .1, -.1, .5), V3(0, -.02, -.05), V3(sx * .2, -.2, .12), V3(sx * .3, -.3, .22)]);
      const P1 = [path(-1), path(1)], P2 = new THREE.CatmullRomCurve3([V3(0, -.3, .1), V3(0, -.45, -.2), V3(0, -.8, -.34), V3(0, -1.15, -.32)]), w = o.hanh_nhan;
      const sig = points(90, .16, 0xffd27a, (i, t, v) => { const r = rng(i + 71), u0 = (s => s)(clamp((HN.u - w[0]) / Math.max(.05, w[1] - w[0]))), k = (r() * .35 + HN.lt * .9) % 1;
        if (u0 <= 0) return false; if (i < 60) { if (k > u0 * 1.4) return false; P1[i % 2].getPointAt(k, v); } else { if (u0 < .5) return false; P2.getPointAt(k, v); } v.x += (r() - .5) * .04; }, .95);
      B.add(sig); HN = { am, amM, glow, sig, thM, u: 0, lt: 0 };
    }
    return { G, mood: { key: 1, env: 1 }, update(s, K) { sparks.tick(s.t); B.rotation.y = (o.hanh_nhan ? -.95 + s.u * .35 : -.7 + s.u * .9); B.userData.mat.emissiveIntensity = .08 + .06 * Math.sin(s.t * 3);
      const d = o.hanh_nhan ? 8.4 - s.u * .9 : o.vao ? lerp(7.4, 2.6, eio((s.u - .45) / .55)) : 7.4 - s.u * .6; K.cam((o.hanh_nhan ? .2 : .6) * d / 7.4, .6 + .3 * d / 7.4, d, 0, (o.hanh_nhan ? -.25 : .05), 0);
      if (HN) { HN.u = s.u; HN.lt = s.lt; HN.sig.tick(s.t); const w = o.hanh_nhan, on = sm((s.u - w[0]) / .12), pulse = .6 + .4 * Math.sin(s.t * 9);
        HN.amM.emissiveIntensity = .15 + 2.6 * on * pulse; HN.amM.color.setHex(on > .5 ? 0xff7a3a : 0xb06a50); HN.glow.forEach(g => g.material.opacity = .85 * on * pulse); HN.am.forEach(a => a.scale.set(1 + .15 * on * pulse, .8, 1.35));
        HN.thM.emissiveIntensity = .25 + .8 * sm((s.u - w[0] + .05) / .1) * (1 - .6 * on);
        if (o.nhan === false) return [];
        const wp = HN.am[1].getWorldPosition(V3(0, 0, 0)), tp = B.localToWorld(V3(0, -.02, -.05));
        return [{ text: o.nhan_hn || 'HẠCH HẠNH NHÂN', p: wp, a: on }, { text: 'ĐỒI THỊ', p: tp, a: sm((s.lt - .5) / .4) * (1 - on) }]; }
      return o.nhan === false ? [] : [{ text: 'NÃO', p: V3(0, 1.45, 0), a: sm((s.lt - .4) / .4) }]; } };
  },

  // mat — glossy eye close-up: sclera, brown iris, black pupil, clear cornea with highlight, upper + lower lids.
  //   gian: [a, b] pupil dilates in the window · co: true pupil small throughout · chop: .2 startle blink at that scene fraction · mo_to: [a, b] lids open wide (fear)
  //   nhan_gian (label while dilating, default "ĐỒNG TỬ GIÃN") · gan: true closer · nhan: false
  'mat'(o) {
    const G = new THREE.Group(), E = new THREE.Group(); G.add(E);
    { const sc = M(new THREE.SphereGeometry(1, 96, 64, 0, Math.PI * 2, .455, Math.PI - .455), gloss(0xf6f1ee, { r: .3, ei: .04, side: THREE.DoubleSide })); sc.rotation.x = Math.PI / 2; E.add(sc); }
    const vein = gloss(0xe58a8a, { r: .4, ei: .05 }), r0 = rng(17);
    for (let k = 0; k < 7; k++) { const a = r0() * 6.28, pts = []; for (let j = 0; j < 6; j++) { const rr = .62 + j * .07, b = a + (r0() - .5) * .25 * j; pts.push([Math.cos(b) * rr, Math.sin(b) * rr, Math.sqrt(Math.max(0, 1.004 - rr * rr))]); }
      E.add(M(taper(pts, u => .008 * (1 - u * .6), { seg: 20, radial: 6, closed: false }), vein)); }
    const k = document.createElement('canvas'); k.width = k.height = 512; const g = k.getContext('2d');
    const rg = g.createRadialGradient(256, 256, 40, 256, 256, 256); rg.addColorStop(0, '#2a1608'); rg.addColorStop(.35, '#7a4520'); rg.addColorStop(.75, '#a8662c'); rg.addColorStop(.95, '#3a210c'); rg.addColorStop(1, '#1a0e05');
    g.fillStyle = rg; g.fillRect(0, 0, 512, 512); const rs = rng(5);
    for (let i = 0; i < 420; i++) { const a = rs() * 6.28, l0 = 60 + rs() * 40, l1 = 170 + rs() * 80; g.strokeStyle = rs() < .5 ? 'rgba(220,150,80,.35)' : 'rgba(40,20,8,.35)'; g.lineWidth = 1 + rs() * 2.5;
      g.beginPath(); g.moveTo(256 + Math.cos(a) * l0, 256 + Math.sin(a) * l0); g.lineTo(256 + Math.cos(a + (rs() - .5) * .1) * l1, 256 + Math.sin(a + (rs() - .5) * .1) * l1); g.stroke(); }
    const it = new THREE.CanvasTexture(k); it.colorSpace = THREE.SRGBColorSpace;
    const iris = at(M(new THREE.CircleGeometry(.44, 96), new THREE.MeshPhysicalMaterial({ map: it, roughness: .45, clearcoat: .6, emissive: new THREE.Color(0x3a1c08), emissiveIntensity: .25 })), 0, 0, .898); E.add(iris);
    const pupil = at(M(new THREE.CircleGeometry(.44, 96), new THREE.MeshBasicMaterial({ color: 0x050505 })), 0, 0, .9); E.add(pupil);
    const corM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .02, clearcoat: 1, clearcoatRoughness: .02, transparent: true, opacity: .14, depthWrite: false, envMapIntensity: 2.5 });
    const cor = M(new THREE.SphereGeometry(.56, 64, 32, 0, Math.PI * 2, 0, .95), corM); cor.rotation.x = Math.PI / 2; cor.position.z = .5; E.add(cor);
    const hl = glowSprite(.11, 0xffffff, .8); hl.position.set(-.16, .18, 1.08); E.add(hl);
    const skin = gloss(0xe8a58c, { r: .45, ei: .08, sheen: .5, sheenC: 0xffd2c0 }), lash = gloss(0x1a0f0a, { r: .6 });
    const lid = up => { const L = new THREE.Group(), sh = M(new THREE.SphereGeometry(1.07, 96, 48, 0, Math.PI * 2, up ? 0 : Math.PI / 2, Math.PI / 2), skin); L.add(sh);
      const rim = M(new THREE.TorusGeometry(1.07, .045, 16, 96, Math.PI), skin); rim.rotation.x = Math.PI / 2; L.add(rim);
      const ls = at(M(new THREE.TorusGeometry(1.09, .022, 8, 96, Math.PI), lash), 0, .03, 0); ls.rotation.x = Math.PI / 2 - .12; if (up) L.add(ls); return L; };
    const UL = lid(true), LL = lid(false); G.add(UL, LL);
    return { G, mood: { key: 1.05, env: 1.1 }, update(s, K) {
      const pr = o.co ? .26 : o.gian ? lerp(.3, .66, eio((s.u - o.gian[0]) / Math.max(.05, o.gian[1] - o.gian[0]))) : .36;
      pupil.scale.setScalar(pr + .006 * Math.sin(s.t * 2.3));
      const wide = o.mo_to ? sm((s.u - o.mo_to[0]) / Math.max(.05, o.mo_to[1] - o.mo_to[0])) : 0, tb = (o.chop ?? -9) * s.D, bl = clamp(1.15 * Math.exp(-Math.pow((s.lt - tb) / .16, 2)));
      UL.rotation.x = lerp(-.95 - .35 * wide, 0, bl); LL.rotation.x = lerp(.62 + .12 * wide, 0, bl);
      E.rotation.set(.04 * Math.sin(s.t * .7), .06 * Math.sin(s.t * .5), 0);
      const d = o.gan ? 5.4 - s.u * .4 : 6.4 - s.u * .7, a = -.28 + s.u * .14; K.cam(Math.sin(a) * d, .22, Math.cos(a) * d, 0, -.02, 0);
      if (o.nhan === false) return [];
      const dil = o.gian ? sm((s.u - o.gian[0]) / .15) : 0;
      return [{ text: o.gian ? (o.nhan_gian || 'ĐỒNG TỬ GIÃN') : 'ĐỒNG TỬ', p: V3(.05, -.62, 1.05), a: o.gian ? dil : sm((s.lt - .5) / .4) }]; } };
  },

  'thu-the'(o) {
    const G = new THREE.Group(), mem = new THREE.PlaneGeometry(14, 10, 140, 100).rotateX(-Math.PI / 2), mp = mem.attributes.position;
    for (let i = 0; i < mp.count; i++) mp.setY(i, .08 * Math.sin(mp.getX(i) * 1.3) * Math.cos(mp.getZ(i) * 1.1));
    mem.computeVertexNormals(); G.add(M(mem, gloss(0x3b2fa6, { r: .4, ei: .05, sheen: .3, sheenC: 0xb9a8ff })));
    const bumps = new THREE.InstancedMesh(new THREE.SphereGeometry(.09, 12, 8), gloss(0x5a4ed0, { r: .35, ei: .05 }), 900), d = new THREE.Object3D(), r0 = rng(4);
    for (let i = 0; i < 900; i++) { d.position.set((r0() - .5) * 14, .05, (r0() - .5) * 10); d.scale.set(1, .5, 1); d.updateMatrix(); bumps.setMatrixAt(i, d.matrix); } G.add(bumps);
    const recM = [], rec = [], slots = [[-2.2, -.6], [-.7, .3], [.8, -.4], [2.2, .4], [-1.4, 1.6], [1.5, 1.7], [0, -1.8], [-2.8, 1.2], [2.9, -1.5]];
    slots.forEach(([x, z], k) => { const m = gloss(COL.receptor, { r: .25, ei: .25 }), g = M(lathe([[.0, 0], [.42, 0], [.5, .25], [.42, .62], [.3, .7], [.24, .5], [.0, .45]], 48), m); at(g, x, .02, z); G.add(g); rec.push(g); recM.push(m); });
    const cafs = slots.map(() => { const m = caffeine(.095, COL.gold); G.add(m); return m; }), ads = slots.map(() => { const m = adenosine(.13); G.add(m); return m; });
    const free = [...Array(10)].map(() => { const m = adenosine(.11); G.add(m); return m; });
    return { G, mood: { key: 1, env: 1, bg: 0x0a0a2a }, update(s, K) { const ch = o.chan ? range(o.chan, sm(s.u * 1.15)) : 0;
      slots.forEach(([x, z], k) => { const r = rng(k + 31), blocked = r() < ch * 1.05 && k / slots.length < ch + .12, tIn = .3 + r() * 1.2, u = clamp((s.lt - tIn) / 1.4);
        const C = cafs[k], A = ads[k]; C.visible = blocked; A.visible = !blocked;
        const tgt = V3(x, .85, z), fromC = V3(x + (r() - .5) * 3, 3.2, z + (r() - .5) * 2);
        if (blocked) { C.position.lerpVectors(fromC, tgt, eio(u)); C.rotation.set(s.lt * (1 - u) * 2, k, 0); recM[k].emissive.setHex(0x8a6a10); recM[k].emissiveIntensity = .2 + .5 * u; }
        else { A.position.lerpVectors(V3(x + (r() - .5) * 3, 3.2, z + (r() - .5) * 2), tgt, eio(u)); A.rotation.set(-Math.PI / 2 * u, k, 0); recM[k].emissive.setHex(0x2a6aff); recM[k].emissiveIntensity = .15 + .55 * u * (o.chan ? .6 : 1); } });
      free.forEach((A, k) => { const r = rng(k + 90), a = r() * 6.28 + s.t * (.2 + r() * .3); A.position.set(Math.cos(a) * (2 + r() * 3), 1.6 + Math.sin(s.t * .8 + k) * .5 + (o.chan ? 1.2 * sm(s.u) : 0), Math.sin(a) * (1.5 + r() * 2)); A.rotation.set(s.t * .3 + k, s.t * .4, 0); A.visible = !!o.chan || s.u > .1; });
      const a = -.15 + s.u * .3; K.cam(Math.sin(a) * 6.2, 4.2 - s.u * .6, Math.cos(a) * 6.2, 0, .5, 0);
      const C0 = cafs.find(c => c.visible), A0 = ads.find(c => c.visible);
      return o.nhan === false ? [] : [...(A0 ? [{ text: 'ADENOSINE', p: A0.position.clone().add(V3(0, .45, 0)), a: sm((s.lt - 1.2) / .4) }] : []), ...(C0 ? [{ text: 'CAFFEINE', p: C0.position.clone().add(V3(0, .45, 0)), a: sm((s.lt - 1.8) / .4) }] : []),
        { text: 'THỤ THỂ', p: V3(slots[2][0], .2, slots[2][1] + .6), a: sm((s.lt - .5) / .4) * (o.chan ? 0 : 1) }]; } };
  },

  'tim'(o) {
    const G = new THREE.Group(), Hh = heart(1); G.add(Hh); Hh.rotation.y = -.25;
    const kp = o.thuong_than ? kidneyPair(.9) : null; if (kp) { kp.position.set(2.1, -1.6, -.6); G.add(kp); }
    const adr = points(o.thuong_than ? 120 : 0, .07, 0xffa53a, (i, t, v) => { const r = rng(i + 5), u = (t * (.15 + r() * .1) + r()) % 1; v.set(lerp(2.6, .3, u) + (r() - .5) * .3, lerp(-.5, .3, u) + Math.sin(u * 6 + i) * .15, lerp(-.6, .4, u) + (r() - .5) * .3); }); G.add(adr);
    const ring = M(new THREE.TorusGeometry(1.7, .012, 8, 128), new THREE.MeshBasicMaterial({ color: 0xff6a7a, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false })); G.add(ring);
    return { G, mood: { key: 1, env: 1, bg: 0x140a24 }, update(s, K) { const bpm = range(o.nhip || 72, sm(s.u)), ph = (s.t * bpm / 60) % 1;
      const beat = Math.exp(-Math.pow((ph - .08) / .05, 2)) * .09 + Math.exp(-Math.pow((ph - .3) / .06, 2)) * .05; Hh.userData.body.scale.setScalar(1 - beat * .9 + .02); Hh.userData.mat.emissiveIntensity = .08 + beat * 3;
      ring.scale.setScalar(1 + ph * .5); ring.material.opacity = .5 * (1 - ph); ring.position.set(0, .2, 0);
      if (kp) kp.userData.adrenal.emissiveIntensity = .3 + .6 * (.5 + .5 * Math.sin(s.t * 5)); adr.tick(s.t);
      const a = .25 - s.u * .35, d = o.thuong_than ? 10.5 : 7.6; K.cam(Math.sin(a) * d + (o.thuong_than ? .8 : 0), .6, Math.cos(a) * d, o.thuong_than ? .8 : 0, o.thuong_than ? -.3 : .3, 0);
      return o.nhan === false ? [] : [{ text: 'TIM', p: V3(-.3, 1.35, .2), a: sm((s.lt - .4) / .4) }, ...(kp ? [{ text: 'TUYẾN THƯỢNG THẬN', p: V3(2.6, -.35, -.6), a: sm((s.lt - 1) / .4) }, { text: o.hormone || 'ADRENALINE', p: V3(1.4, .5, 0), a: sm((s.lt - 1.8) / .4) }] : [])]; } };
  },

  // { chat: 'ethanol' } alcohol: gold ethanol enters → ADH → orange acetaldehyde → ALDH2 → green acetate drifts away;
  // { cham: true } ALDH2 slow (flush): orange acetaldehyde piles up around the liver with a red glow
  'gan'(o) {
    if (o.chat === 'ethanol') {
      const G = new THREE.Group(), L = liver(1.25); L.rotation.y = .25; G.add(L);
      const N = 7, eth = [...Array(N)].map(() => { const m = ethanol(.13, COL.gold); G.add(m); return m; });
      const ald = [...Array(N)].map(() => { const m = ethanol(.11, 0xff5a24); G.add(m); return m; }), ace = [...Array(N)].map(() => { const m = ethanol(.09, 0x7fe08a); G.add(m); return m; });
      const glow = glowSprite(3.4, o.cham ? 0xff3a1a : 0xffb070, 0); glow.position.set(0, .1, .6); G.add(glow);
      const end = k => V3(-.55 + k * .2, .15 + Math.sin(k * 1.7) * .25, 1.0), hold = o.cham ? 99 : 1.4;
      return { G, mood: { key: 1, env: 1 }, update(s, K) { L.userData.mat.emissiveIntensity = .07 + .05 * Math.sin(s.t * 2);
        let firstA = null, firstG = null, nA = 0;
        eth.forEach((m, k) => { const d = k * .6 + .2, u = clamp((s.lt - d) / 1.6), e = end(k); m.visible = u > 0 && u < 1;
          m.position.set(lerp(-3.6, e.x, eio(u)), lerp(2 - k * .35, e.y, eio(u)), lerp(1.1, e.z, u)); m.rotation.set(s.lt + k, s.lt * .7, 0);
          const ta = s.lt - d - 1.6, a = ald[k], g = ace[k], r = rng(k * 9 + 4), w = V3(e.x + .5 + r() * .6, e.y - .35 + r() * .9, 1.15 + r() * .3);
          a.visible = ta > 0 && ta < hold; if (a.visible) { nA++; a.position.lerpVectors(e, w, eio(ta / 1.2)); a.position.y += Math.sin(s.t * 2 + k) * .04; a.rotation.set(s.t * .8 + k, s.t * .6, 0); if (!firstA) firstA = a; }
          const tg = ta - hold; g.visible = tg > 0 && tg < 2.6; if (g.visible) { const ang = k * 1.9; g.position.set(w.x + Math.cos(ang) * 2.4 * eio(tg / 2.6), w.y + Math.sin(ang) * 1.5 * eio(tg / 2.6) + tg * .2, w.z + tg * .15); g.rotation.set(s.t + k, s.t * .9, 0); if (!firstG) firstG = g; } });
        glow.material.opacity = o.cham ? .15 + .07 * nA + .05 * Math.sin(s.t * 3) : .22 + .08 * Math.sin(s.t * 3);
        const a = -.2 + s.u * .4; K.cam(Math.sin(a) * 8.6, .9, Math.cos(a) * 8.6, 0, .1, 0);
        if (o.nhan === false) return [];
        return [{ text: 'GAN', p: V3(-.9, 1.25, .5), a: sm((s.lt - .4) / .4) }, { text: 'ADH', p: end(0).add(V3(-.35, -.45, 0)), a: sm((s.lt - 1.6) / .4) },
          ...(firstA ? [{ text: 'ACETALDEHYDE', p: firstA.position.clone().add(V3(0, .38, 0)), a: sm((s.lt - 2.2) / .4) }] : []),
          ...(firstG ? [{ text: 'ALDH2 → ACETATE', p: firstG.position.clone().add(V3(0, -.42, 0)), a: sm((s.lt - 3.4) / .4) }] : [])]; } };
    }
    const G = new THREE.Group(), L = liver(1.25); L.rotation.y = .25; G.add(L);
    const cols = [0x7fe08a, 0xff8ad8, 0x8ad8ff], mols = [...Array(o.chuyen_hoa === false ? 0 : 6)].map((_, k) => { const m = caffeine(.07, COL.gold); G.add(m); return m; });
    const bits = [...Array(18)].map((_, k) => { const m = caffeine(.04, cols[k % 3]); G.add(m); return m; });
    const glow = glowSprite(3, 0xffb070, .0); glow.position.set(0, .1, .6); G.add(glow);
    return { G, mood: { key: 1, env: 1 }, update(s, K) { L.userData.mat.emissiveIntensity = .07 + .05 * Math.sin(s.t * 2);
      mols.forEach((m, k) => { const d = k * .55 + .2, u = clamp((s.lt - d) / 1.6); m.visible = u > 0 && u < 1; m.position.set(lerp(-3.4, -.2 + k * .15, eio(u)), lerp(1.8 - k * .4, .2, eio(u)), lerp(1, .9, u)); m.rotation.set(s.lt + k, s.lt * .7, 0); });
      bits.forEach((b, j) => { const k = Math.floor(j / 3), d = k * .55 + 1.8, u = clamp((s.lt - d) / 2.2), a = (j % 3) * 2.1 + k; b.visible = u > 0;
        b.position.set(-.2 + k * .15 + Math.cos(a) * 2.2 * eio(u), .2 + Math.sin(a) * 1.4 * eio(u) + u * .3, .9 + u * .4); b.rotation.set(s.lt + j, s.lt * .9, 0); });
      glow.material.opacity = .25 + .1 * Math.sin(s.t * 3);
      const a = -.2 + s.u * .4; K.cam(Math.sin(a) * 8.6, .9, Math.cos(a) * 8.6, 0, .1, 0);
      return o.nhan === false ? [] : [{ text: 'GAN', p: V3(-.9, 1.1, .5), a: sm((s.lt - .4) / .4) }, ...(o.chuyen_hoa !== false ? [{ text: 'ENZYME CYP1A2', p: V3(.2, -.85, 1), a: sm((s.lt - 1.6) / .4) }] : [])]; } };
  },

  // tongue in a stylised mouth (lower teeth arc), glossy papillae; a red chili comes in for a bite, capsaicin (red-orange particles)
  // spreads over the tongue and the surface glows with "heat". { ot: true } chili · { can: [0.1, 0.35] } bite window (scene fractions)
  // { nong: [0, 1] } heat glow over the scene · { sua: [0.3, 1] } milk washes over the tongue and the glow fades (fat/casein)
  'luoi'(o) {
    const PINK = new THREE.Color(0xe0566c), HOT = new THREE.Color(0xff2a10);
    const G = new THREE.Group(), tm = gloss(0xe0566c, { r: .4, ei: .05, sheen: .35, sheenC: 0xffb0bc }), T = M(tongueGeo(), tm); G.add(T);
    const pap = new THREE.InstancedMesh(new THREE.SphereGeometry(.018, 8, 6), gloss(0xea6c80, { r: .45, ei: .05 }), 700), d = new THREE.Object3D(), r0 = rng(21);
    for (let i = 0; i < 700; i++) { let x, z; do { x = (r0() - .5) * 1.8; z = (r0() - .5) * 3; } while (x * x / .81 + z * z / 2.25 > .9); d.position.set(x, tongueTop(x, z) - .005, z); d.scale.setScalar(.6 + r0() * .8); d.updateMatrix(); pap.setMatrixAt(i, d.matrix); }
    G.add(pap);
    const gum = gloss(0xe8707e, { r: .4 }), tooth = gloss(0xf8f4ec, { r: .2, ei: 0, sheen: .1 });
    const arc = k => { const a = lerp(-1.25, 1.25, k); return V3(Math.sin(a) * 1.25, -.05, Math.cos(a) * 1.55 - .1); };
    G.add(M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([...Array(9)].map((_, i) => arc(i / 8))), 80, .14, 16, false), gum));
    for (let i = 0; i < 14; i++) { const p = arc((i + .5) / 14), t = M(lathe([[0, 0], [.09, .02], [.1, .16], [.07, .24], [0, .25]], 24), tooth); t.position.copy(p); t.position.y += .05; t.scale.set(1, 1, .8); t.lookAt(0, t.position.y, 0); G.add(t); }
    const chili = o.ot === false ? null : chiliMesh(); if (chili) G.add(chili);
    const cap = points(220, .07, 0xff5a1e, (i, t, v) => { const r = rng(i + 61), sp = clamp((lt - (o.can ? o.can[1] * D : 1)) / 3.5), rr = Math.sqrt(r()) * sp; if (sp <= 0 || r() > heat * 1.4 + .1) return false;
      const a = r() * 6.28, x = Math.cos(a) * rr * .85, z = .9 + Math.sin(a) * rr * 2 - rr * .4; v.set(x, tongueTop(x, z) + .05 + Math.sin(t * 3 + i) * .02, z); }, .9); G.add(cap);
    const shimmer = points(120, .12, 0xffa040, (i, t, v) => { const r = rng(i + 7), ph = (t * .5 + r()) % 1; if (r() > heat) return false; v.set((r() - .5) * 1.6, .3 + ph * 1.4, (r() - .5) * 2.6); }, .35); G.add(shimmer);
    const milk = points(o.sua ? 260 : 0, .14, 0xffffff, (i, t, v) => { const r = rng(i + 3), u = clamp((s_u - o.sua[0]) / Math.max(.05, o.sua[1] - o.sua[0])); if (u <= 0) return false; const x = (r() - .5) * 1.7, z = lerp(-1.6, 1.6, r()) * Math.min(1, u * 1.6); v.set(x, tongueTop(x, z) + .06 + r() * .05 * u, z); }, .7); G.add(milk);
    let lt = 0, D = 1, heat = 0, s_u = 0;
    return { G, mood: { key: 1, env: .9, bg: 0x1a0710 }, update(s, K) { lt = s.lt; D = s.D; s_u = s.u;
      heat = (o.nong ? range(o.nong, sm(s.u)) : 0) * (o.sua ? 1 - sm((s.u - o.sua[0]) / .5) * .7 : 1);
      tm.color.lerpColors(PINK, HOT, clamp(heat * (.9 + .1 * Math.sin(s.t * 6)))); tm.emissive.setHex(0xff2a00); tm.emissiveIntensity = .05 + heat * .6;
      if (chili) { const b = o.can ? clamp((s.u - o.can[0]) / (o.can[1] - o.can[0])) : 0, pull = o.can ? sm((s.u - o.can[1]) / .2) : 0;
        chili.position.set(lerp(1.5, .7, eio(b)) + pull * 1.8, lerp(2.1, .5, eio(b)) + pull * 1.2, lerp(1.2, .75, eio(b))); chili.scale.setScalar(.9); chili.rotation.set(0, -.35, -Math.PI / 2 + .3 - b * .12); chili.visible = pull < .98; }
      cap.tick(s.t); shimmer.tick(s.t); milk.tick(s.t); T.rotation.y = Math.sin(s.t * .5) * .03;
      const a = .3 - s.u * .3; K.cam(Math.sin(a) * 3.2, 2.9 - s.u * .2, Math.cos(a) * 3.2 + 2.2, 0, -.1, .1);
      return o.nhan === false ? [] : [{ text: 'LƯỠI', p: V3(-.5, .45, -.6), a: sm((s.lt - .4) / .4) }, ...(chili && o.can ? [{ text: 'CAPSAICIN', p: V3(.1, .5, 1.1), a: sm((s.u - o.can[1]) * D / .5) * (heat > .2 ? 1 : 0) }] : []),
        ...(o.sua ? [{ text: 'SỮA', p: V3(.4, .45, .2), a: sm((s.u - o.sua[0]) * D / .5) }] : [])]; } };
  },

  // TRPV1 heat channels in a nerve-cell membrane: four subunits around a pore; when capsaicin docks (or heat arrives) the channel opens,
  // glows orange and ions stream into the cell → "burning" signal. { mo: [0, 0.9] } share of channels open over the scene · { nhiet: true } heat waves instead of capsaicin
  'kenh-nhiet'(o) {
    const G = new THREE.Group(), mem = new THREE.PlaneGeometry(14, 10, 140, 100).rotateX(-Math.PI / 2), mp = mem.attributes.position;
    for (let i = 0; i < mp.count; i++) mp.setY(i, .07 * Math.sin(mp.getX(i) * 1.2) * Math.cos(mp.getZ(i) * 1.3));
    mem.computeVertexNormals(); G.add(M(mem, gloss(0x7a2f5a, { r: .4, ei: .05, sheen: .3, sheenC: 0xffb0d0 })));
    const bumps = new THREE.InstancedMesh(new THREE.SphereGeometry(.09, 12, 8), gloss(0x9a3f70, { r: .35, ei: .05 }), 900), d = new THREE.Object3D(), r0 = rng(9);
    for (let i = 0; i < 900; i++) { d.position.set((r0() - .5) * 14, .05, (r0() - .5) * 10); d.scale.set(1, .5, 1); d.updateMatrix(); bumps.setMatrixAt(i, d.matrix); } G.add(bumps);
    const slots = [[-2, -.4], [0, .5], [2.1, -.3], [-1, 1.9], [1.2, 2.0], [-2.9, 1.3], [3, 1.2]], CH = slots.map(([x, z], k) => { const g = new THREE.Group(), m = gloss(0x4fb3ff, { r: .28, ei: .2 }), subs = [];
      for (let q = 0; q < 4; q++) { const p = new THREE.Group(), c = M(new THREE.CapsuleGeometry(.17, .55, 8, 16), m); c.position.set(.24, .3, 0); p.add(c); p.rotation.y = q * Math.PI / 2; g.add(p); subs.push(c); }
      at(g, x, 0, z); G.add(g); const mol = o.nhiet ? null : capsaicin(.07); if (mol) G.add(mol); return { g, m, subs, mol, x, z, k }; });
    const ions = points(260, .07, 0xbff4ff, (i, t, v) => { const c = CH[i % CH.length], r = rng(i + 17), u = (t * (.5 + r() * .4) + r()) % 1; if (c.open < .5) return false; v.set(c.x + (r() - .5) * .12, lerp(1.6, -1.2, u), c.z + (r() - .5) * .12); }, .95); G.add(ions);
    const waves = points(o.nhiet ? 240 : 0, .16, 0xff8a3a, (i, t, v) => { const r = rng(i + 5), ph = (t * .35 + r()) % 1; v.set((r() - .5) * 9, 3.2 - ph * 2.6, (r() - .5) * 6 + Math.sin(t * 2 + i) * .1); }, .45); G.add(waves);
    return { G, mood: { key: 1, env: 1, bg: 0x14061a }, update(s, K) { const fr = o.mo ? range(o.mo, sm(s.u * 1.1)) : 0;
      CH.forEach(c => { const r = rng(c.k + 3), on = r() * .9 + .05 < fr, tIn = .3 + r() * 1.2, u = on ? clamp((s.lt - tIn) / 1.2) : 0; c.open = u;
        c.subs.forEach(sb => { sb.parent.rotation.z = 0; sb.position.x = .24 + .12 * eio(u); sb.rotation.z = -.15 * eio(u); });
        c.m.color.setHex(u > .5 ? 0xff7a2a : 0x4fb3ff); c.m.emissive.setHex(u > .5 ? 0xff5010 : 0x4fb3ff); c.m.emissiveIntensity = .2 + .7 * u * (.8 + .2 * Math.sin(s.t * 7));
        if (c.mol) { c.mol.visible = on; c.mol.position.lerpVectors(V3(c.x + (r() - .5) * 3, 3.4, c.z + (r() - .5) * 2), V3(c.x + .45, 1.0, c.z + .2), eio(clamp((s.lt - tIn + 1) / 1.6))); c.mol.rotation.set(s.lt * .7 + c.k, s.lt * .4, 0); } });
      ions.tick(s.t); waves.tick(s.t);
      const a = -.2 + s.u * .35; K.cam(Math.sin(a) * 9, 6.2 - s.u * .6, Math.cos(a) * 9, 0, .3, .4);
      const C0 = CH.find(c => c.open > .5);
      return o.nhan === false ? [] : [{ text: 'TRPV1', p: V3(CH[1].x, 1.1, CH[1].z), a: sm((s.lt - .5) / .4) },
        ...(C0 && C0.mol ? [{ text: 'CAPSAICIN', p: C0.mol.position.clone().add(V3(0, .45, 0)), a: sm((s.lt - 1.8) / .4) }] : []),
        ...(o.nhiet ? [{ text: o.nhan_nhiet || 'NHIỆT', p: V3(-2.4, 2.4, .5), a: sm((s.lt - .8) / .4) }] : [])]; } };
  },

  // stylised songbird on a chili plant: hops, pecks a red chili (no reaction — birds don't feel capsaicin), then flies off and drops seeds.
  // { bay: 0.7 } scene fraction when it takes off · { an: [0.15, 0.6] } pecking window
  'chim'(o) {
    const G = new THREE.Group(), body = gloss(0x3f8fd8, { r: .35, ei: .06 }), belly = gloss(0xf2e3c4, { r: .4 }), wingM = gloss(0x2a5f9e, { r: .35 }), beakM = gloss(0xf2a23a, { r: .3 }), eyeM = gloss(0x111111, { r: .1, ei: 0 });
    const B = new THREE.Group(), bd = M(new THREE.SphereGeometry(.5, 32, 24), body); bd.scale.set(1, .85, 1.35); B.add(bd);
    const bl = M(new THREE.SphereGeometry(.42, 32, 24), belly); bl.scale.set(.9, .75, 1.1); bl.position.set(0, -.12, .12); B.add(bl);
    const H = at(new THREE.Group(), 0, .42, .5); B.add(H); H.add(M(new THREE.SphereGeometry(.32, 32, 24), body));
    const beak = M(new THREE.ConeGeometry(.09, .32, 16), beakM); beak.rotation.x = Math.PI / 2; beak.position.set(0, -.04, .38); H.add(beak);
    [-1, 1].forEach(sx => { const e = M(new THREE.SphereGeometry(.055, 16, 12), eyeM); e.position.set(sx * .2, .08, .2); H.add(e); const hl = M(new THREE.SphereGeometry(.018, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); hl.position.set(sx * .22, .11, .245); H.add(hl); });
    const W = [-1, 1].map(sx => { const p = at(new THREE.Group(), sx * .42, .12, 0), w = M(new THREE.SphereGeometry(.4, 24, 16), wingM); w.scale.set(.18, .55, 1); w.position.set(sx * .05, -.05, -.15); p.add(w); B.add(p); return p; });
    const tail = M(new THREE.ConeGeometry(.22, .6, 4), wingM); tail.scale.z = .3; tail.rotation.x = -Math.PI / 2 - .4; tail.position.set(0, .05, -.8); B.add(tail);
    [-1, 1].forEach(sx => B.add(at(M(new THREE.CylinderGeometry(.03, .03, .35, 8), beakM), sx * .14, -.55, .05)));
    B.scale.setScalar(.8); G.add(B);
    // chili plant: stem, leaves, three hanging chilies
    const stem = gloss(0x3f7a2a, { r: .45 }), leaf = gloss(0x4e9a32, { r: .4 });
    G.add(M(taper([[-.4, -3, 0], [-.3, -1.6, 0], [-.1, -.85, .05], [.9, -.6, .1], [2.2, -.7, 0]], u => .07 * (1 - u * .6) + .015, { seg: 40, radial: 10 }), stem));
    [[1.4, -.66, .3, .4], [1.9, -.72, -.25, -.5], [.4, -.7, -.3, 2.6], [-.25, -1.3, .25, 1.2]].forEach(([x, y, z, r]) => { const l = M(new THREE.SphereGeometry(.35, 20, 12), leaf); l.scale.set(.25, .06, .7); l.position.set(x, y, z); l.rotation.y = r; G.add(l); });
    const chilis = [[.75, -.62, .15], [1.6, -.68, .1], [2.05, -.72, -.15]].map(([x, y, z], k) => { const c = chiliMesh(); c.scale.setScalar(.55); c.position.set(x, y, z); c.rotation.set(0, k, .15); G.add(c); return c; });
    const seeds = points(40, .06, 0xf7e7a0, (i, t, v) => { if (fly < .05) return false; const r = rng(i + 4), ti = clamp(fly * 3 - r()); if (ti <= 0) return false; v.set(bx + (r() - .5) * .4 - 1.2 * ti, by - 4 * ti * ti, bz + (r() - .5) * .4); }, .9); G.add(seeds);
    let fly = 0, bx = 0, by = 0, bz = 0;
    return { G, mood: { key: 1.05, env: .9, bg: 0x0b2238 }, update(s, K) {
      const an = o.an || [.15, .6], tk = o.bay ?? .72; fly = clamp((s.u - tk) / (1 - tk));
      const peck = s.u > an[0] && s.u < an[1] ? Math.max(0, Math.sin((s.lt) * 9)) : 0;
      bx = .55 + Math.sin(s.t * 1.5) * .03 + fly * fly * 4; by = -.18 + Math.abs(Math.sin(s.t * 3)) * .02 * (1 - fly) + fly * 3.2; bz = .35 - fly * 1.5;
      B.position.set(bx, by, bz); B.rotation.set(peck * .35 - fly * .3, -.5 + (1 - fly) * 0 + Math.sin(s.t * .7) * .1, 0); H.rotation.x = peck * .5;
      const flap = fly > 0 ? Math.sin(s.t * 28) * 1.1 : Math.sin(s.t * 2) * .05; W[0].rotation.z = flap; W[1].rotation.z = -flap;
      chilis[0].scale.setScalar(.55 * (1 - .35 * clamp((s.u - an[0]) / (an[1] - an[0])))); seeds.tick(s.t);
      const a = .45 - s.u * .3; K.cam(Math.sin(a) * 5.4 + .7, .9 + s.u * .4, Math.cos(a) * 5.4, .8 + fly * .8, -.2 + fly * 1.2, 0);
      return o.nhan === false ? [] : [{ text: o.nhan || 'CHIM', p: V3(bx, by + .75, bz), a: sm((s.lt - .4) / .4) * (1 - fly) }]; } };
  },

  // finger joint (MCP) cut-away: two glossy bones with blue cartilage caps inside a translucent joint capsule filled with synovial fluid.
  // Pulling widens the gap until a gas cavity suddenly forms (Kawchuk 2015, real-time MRI) with a flash ring = the "crack".
  // { keo: [0.15, 0.5] } pull window · { rac: 0.5 } crack moment (scene fraction) · { bot: true } cavity already there · { tan: [0, 1] } cavity dissolving · { nhan: false } only the bubble label
  'khop'(o) {
    const G = new THREE.Group(), boneM = gloss(0xc4ab80, { r: .45, ei: 0, sheen: .15, sheenC: 0xfff0d0, env: .45 }), cartM = gloss(0x4fa8f0, { r: .16, ei: .12, side: THREE.DoubleSide, env: .8 });
    const toX = g => { g.rotation.z = -Math.PI / 2; return g; };
    G.add(toX(M(lathe([[0, -3.4], [.3, -3.4], [.31, -1.8], [.36, -1.05], [.48, -.62], [.52, -.36], [.46, -.13], [.3, -.03], [0, 0]]), boneM)));
    G.add(toX(M(lathe([[.535, -.36], [.475, -.12], [.31, -.015], [0, .018]]), cartM)));
    const P = new THREE.Group(); G.add(P);
    P.add(toX(M(lathe([[0, .15], [.26, .09], [.43, 0], [.49, .16], [.44, .46], [.33, .92], [.29, 2], [.28, 3.4], [0, 3.4]]), boneM)));
    P.add(toX(M(lathe([[0, .125], [.26, .065], [.43, -.025]]), cartM)));
    const capG = lathe([[.4, -1.05], [.6, -.62], [.71, -.12], [.7, .3], [.58, .72], [.4, 1.1]]), CAP = new THREE.Group(); G.add(CAP);
    CAP.add(toX(M(capG, gloss(0x6fd8ff, { op: .13, dw: false, side: THREE.DoubleSide, r: .25 }))), toX(M(capG, fresnel(COL.shell, { p: 2, k: 1.1 }))));
    const fluid = M(new THREE.SphereGeometry(1, 40, 28), gloss(0xffcf4a, { op: .5, dw: false, ei: .45, r: .2 })); G.add(fluid);
    const cav = M(new THREE.SphereGeometry(.26, 40, 28), gloss(0x8ff0ff, { ei: 1.1, e: 0x30c8ff, r: .1 })), cavGlow = glowSprite(1.3, 0x5fe0ff, .9); G.add(cav, cavGlow);
    [cav, cavGlow].forEach(m => { m.material.depthTest = false; m.material.transparent = true; m.renderOrder = 5; });   // x-ray: the cavity shows through the bone ends
    const ring = M(new THREE.TorusGeometry(1, .025, 8, 96), new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); G.add(ring);
    let tc = -1, gx = 0;
    const burst = points(90, .08, 0xdff8ff, (i, t, v) => { if (tc < 0 || tc > .7) return false; const r = rng(i + 41), a = r() * 6.28, b = (r() - .5) * 3, d = .15 + tc * (1.2 + r() * 1.4);
      v.set(gx + Math.cos(a) * Math.cos(b) * d, Math.sin(a) * Math.cos(b) * d, Math.sin(b) * d * .6); }, .9); G.add(burst);
    G.rotation.z = .5;
    return { G, mood: { key: 1, env: 1, bg: 0x081a30 }, update(s, K) {
      const k = o.keo ? sm((s.u - o.keo[0]) / Math.max(.05, o.keo[1] - o.keo[0])) : 0;
      tc = o.rac == null || o.rac === false ? -1 : s.lt - o.rac * s.D; const cr = tc >= 0;
      const gap = o.bot ? .2 : .05 + .2 * k + (cr ? .12 * sm(tc / .12) : 0); P.position.x = gap; gx = gap / 2;
      CAP.scale.set(1 + gap * .7, 1, 1); CAP.position.x = gap / 2;
      fluid.position.set(gap / 2, 0, 0); fluid.scale.set(.1 + gap * .8, .5, .5);
      const sz = (o.bot ? 1 : cr ? sm(tc / .1) : 0) * (o.tan ? 1 - range(o.tan, sm(s.u)) : 1);
      cav.visible = cavGlow.visible = sz > .01; cav.position.set(gap / 2, 0, 0); cav.scale.set(Math.max(.01, sz) * .75, Math.max(.01, sz) * 1.15, Math.max(.01, sz) * 1.15);
      cavGlow.position.copy(cav.position); cavGlow.material.opacity = .5 * sz + (cr && tc < .4 ? .6 * (1 - tc / .4) : 0);
      ring.visible = cr && tc < .6; ring.position.set(gap / 2, 0, .1); ring.scale.setScalar(.25 + tc * 2.6); ring.rotation.z = -G.rotation.z; ring.material.opacity = cr ? .9 * (1 - tc / .6) : 0;
      burst.tick(s.t);
      const a = -.3 + s.u * .4, d = 8.4 - s.u * .9; K.cam(Math.sin(a) * d + .1, .4, Math.cos(a) * d, .1, 0, 0);
      G.updateMatrixWorld(true); const w = (x, y, z) => G.localToWorld(V3(x, y, z));
      const L = o.nhan === false ? [] : [{ text: 'XƯƠNG', p: w(-1.5, .55, 0), a: sm((s.lt - .4) / .4) }, { text: 'SỤN', p: w(-.2, -.62, .25), a: sm((s.lt - .9) / .4) },
        { text: 'BAO KHỚP', p: w(.1, .82, 0), a: sm((s.lt - 1.4) / .4) }, { text: 'DỊCH KHỚP', p: w(gap / 2 + .05, -.42, .5), a: sm((s.lt - 1.9) / .4) * (sz > .3 ? 0 : 1) }];
      if (sz > .3) L.push({ text: o.nhan_bot || 'BỌT KHÍ', p: w(gap / 2, .4, .3), a: o.bot ? sm((s.lt - .5) / .4) : sm((tc - .3) / .4) });
      return L; } };
  },

  // x-ray hand (cyan fresnel skin, ivory bones), palm to camera; the index finger flexes and its knuckle flashes on the crack.
  // { be: [0.2, 0.55] } bend window · { rac: 0.55 } crack moment · { tat_ca: true } all four fingers bend · { soi: true } knuckle glow · { nhan }
  'ban-tay'(o) {
    const G = new THREE.Group(), sG = gloss(0x5fd4ff, { op: .1, dw: false, r: .3 }), sF = fresnel(COL.shell, { p: 2.2, k: 1.15 }), bM = gloss(0xf3e6cc, { r: .35, ei: .08 });
    const cap = (a, b, r, m, par) => { const d = b.clone().sub(a), g = M(new THREE.CapsuleGeometry(r, Math.max(.001, d.length()), 10, 20), m); g.position.copy(a).add(b).multiplyScalar(.5); g.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize()); par.add(g); return g; };
    const limb = (a, b, r, par, bone = true) => { cap(a, b, r, sG, par); cap(a, b, r, sF, par); if (bone) cap(a, b, r * .42, bM, par); };
    const palm = new THREE.Group(); G.add(palm);
    [sG, sF].forEach(m => { const p = M(new THREE.SphereGeometry(1, 48, 32), m); p.scale.set(.92, 1.05, .3); palm.add(p); });
    limb(V3(0, -.9, 0), V3(0, -3.6, 0), .5, palm, false); [-.17, .17].forEach(x => cap(V3(x, -1, 0), V3(x * 1.2, -3.6, 0), .085, bM, palm));
    const XS = [-.6, -.2, .2, .58], LEN = [[.5, .32, .24], [.56, .36, .26], [.5, .33, .25], [.4, .26, .2]], RAD = [.15, .155, .145, .125], BY = [.92, .98, .94, .84];
    const F = XS.map((x, k) => { cap(V3(x * .5, -.8, 0), V3(x, BY[k] - .05, 0), .07, bM, palm); const J = []; let par = palm, y0 = BY[k];
      LEN[k].forEach((L, q) => { const j = at(new THREE.Group(), q ? 0 : x, q ? LEN[k][q - 1] : y0, 0); par.add(j); limb(V3(0, 0, 0), V3(0, L, 0), RAD[k] * (1 - q * .08), j); j.add(M(new THREE.SphereGeometry(RAD[k] * .5, 16, 12), bM)); J.push(j); par = j; });
      return J; });
    const th = at(new THREE.Group(), -.72, -.3, .08), th2 = at(new THREE.Group(), 0, .5, 0); th.rotation.z = .75; palm.add(th); th.add(th2); limb(V3(0, 0, 0), V3(0, .5, 0), .17, th); limb(V3(0, 0, 0), V3(0, .36, 0), .16, th2);
    const glow = glowSprite(.9, 0x9fe8ff, 0), ring = M(new THREE.TorusGeometry(1, .02, 8, 96), new THREE.MeshBasicMaterial({ color: 0xbff4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); G.add(glow, ring);
    return { G, mood: { key: 1, env: 1 }, update(s, K) {
      const b = o.be ? sm((s.u - o.be[0]) / Math.max(.05, o.be[1] - o.be[0])) : 0, tc = o.rac == null ? -1 : s.lt - o.rac * s.D;
      F.forEach((J, k) => { const on = k === 0 || o.tat_ca; J[0].rotation.x = on ? 1.15 * b : .08; J[1].rotation.x = on ? .9 * b : .1; J[2].rotation.x = on ? .5 * b : .08; });
      palm.rotation.y = Math.sin(s.t * .5) * .08; G.updateMatrixWorld(true); const kn = F[0][0].localToWorld(V3(0, 0, .05));
      glow.position.copy(kn); glow.material.opacity = (o.soi ? .35 + .25 * Math.sin(s.t * 4) : 0) + (tc >= 0 && tc < .5 ? .9 * (1 - tc / .5) : 0);
      ring.visible = tc >= 0 && tc < .6; ring.position.copy(kn); ring.scale.setScalar(.12 + Math.max(0, tc) * 1.6); ring.material.opacity = ring.visible ? .9 * (1 - tc / .6) : 0;
      const a = .2 - s.u * .3; K.cam(Math.sin(a) * 8.8, .6, Math.cos(a) * 8.8, 0, .3, 0);
      return o.nhan === false ? [] : [{ text: o.nhan || 'KHỚP NGÓN TAY', p: kn.clone().add(V3(-.2, .35, 0)), a: sm((s.lt - .5) / .4) }]; } };
  },

  // skin block cut-away (opaque epidermis, translucent dermis with a capillary + vein, mast cells, a nerve, fat lobules) + a stylised female mosquito.
  // { muoi: false } no mosquito · { dap: [0, .15] } lands · { bay: .9 } flies off · { chich: [a, b] } fascicle probes down to the capillary
  // { hut: [a, b] } blood drawn up, abdomen fills red · { nuoc_bot: [a, b] } saliva spreads · { mast: [a, b] } mast cells release histamine
  // { sung: [0, 1] } wheal + redness · { ngua: true } itch signal runs along the nerve · { lop: true } layer labels · { gan: true } close-up · { nhan: false }
  'da'(o) {
    const G = new THREE.Group(), HW = 3.2, ZF = .9, ZB = -1.7, HD = (ZF - ZB) / 2, ZC = (ZF + ZB) / 2, win = (w, u) => w ? sm((u - w[0]) / Math.max(.05, w[1] - w[0])) : 0;
    let swell = -1;
    // epidermis: top slab, displaced top surface (wheal) + vertex colours (redness)
    const epG = new THREE.BoxGeometry(HW * 2, .28, HD * 2, 160, 1, 84), epP = epG.attributes.position, ep0 = Float32Array.from(epP.array), epN = Float32Array.from(epG.attributes.normal.array);
    const epC = new Float32Array(epP.count * 3); epG.setAttribute('color', new THREE.BufferAttribute(epC, 3));
    const epM = gloss(0xffffff, { r: .5, ei: .02, sheen: .35, sheenC: 0xffe0d0, cc: .5 }); epM.vertexColors = true;
    const ep = M(epG, epM); ep.position.set(0, -.14, ZC); G.add(ep);
    const cSkin = new THREE.Color(0xf0b096), cRed = new THREE.Color(0xff2a2a), cTmp = new THREE.Color();
    const setSwell = w => { if (Math.abs(w - swell) < .004) return; swell = w;
      for (let i = 0; i < epP.count; i++) { const x = ep0[i * 3], y0 = ep0[i * 3 + 1], z = ep0[i * 3 + 2] + ZC, d2 = x * x + z * z;
        if (y0 > 0) epP.setY(i, y0 + .36 * w * Math.exp(-d2 / .5) + .01 * Math.sin(x * 9) * Math.sin(z * 7));
        cTmp.copy(cSkin).lerp(cRed, epN[i * 3 + 1] > .5 ? Math.min(1, 1.1 * w * Math.exp(-d2 / 1.6)) : 0); epC[i * 3] = cTmp.r; epC[i * 3 + 1] = cTmp.g; epC[i * 3 + 2] = cTmp.b; }
      epP.needsUpdate = true; epG.attributes.color.needsUpdate = true; epG.computeVertexNormals(); };
    setSwell(0);
    // dermis (translucent, x-ray rim) + fat lobules
    const dG = new THREE.BoxGeometry(HW * 2, 1.75, HD * 2), derm = M(dG, gloss(0xf7a0a8, { op: .26, dw: false, r: .3, ei: .1 })), dRim = M(dG, fresnel(0xffb0c0, { p: 1.6, k: .35 }));
    derm.position.set(0, -.28 - .875, ZC); dRim.position.copy(derm.position); derm.renderOrder = dRim.renderOrder = 4; G.add(derm, dRim);
    const fat = new THREE.InstancedMesh(new THREE.SphereGeometry(.3, 24, 16), gloss(0xffc94a, { r: .3, ei: .45 }), 72), dd = new THREE.Object3D(), rf = rng(23);
    for (let i = 0; i < 72; i++) { dd.position.set(-HW + .25 + (i % 12) * .52 + rf() * .1, -2.32 - Math.floor(i / 12) % 2 * .42 + rf() * .08, ZB + .35 + Math.floor(i / 24) * .85 + rf() * .15); dd.scale.setScalar(.85 + rf() * .35); dd.updateMatrix(); fat.setMatrixAt(i, dd.matrix); }
    G.add(fat);
    // capillary (red) + deeper vein (blue), blood cells flowing
    const capC = new THREE.CatmullRomCurve3([V3(-HW, -.85, .3), V3(-1.4, -1.05, .1), V3(-.2, -.95, .05), V3(.2, -.97, 0), V3(1.4, -.8, -.2), V3(HW, -1.0, .1)]);
    const veinC = new THREE.CatmullRomCurve3([V3(-HW, -1.55, -.5), V3(-1, -1.45, -.3), V3(1, -1.6, -.6), V3(HW, -1.5, -.4)]);
    G.add(M(new THREE.TubeGeometry(capC, 200, .1, 20), gloss(COL.artery, { r: .22, ei: .2 })), M(new THREE.TubeGeometry(veinC, 160, .13, 20), gloss(COL.vein, { r: .25, ei: .15 })));
    const rbc = points(70, .09, 0xff6a6a, (i, t, v) => { const r = rng(i + 3); capC.getPointAt((t * .07 + r()) % 1, v); v.y += (r() - .5) * .06; }, .9); G.add(rbc);
    // nerve fibre (yellow) rising to just under the epidermis, + an itch pulse
    const nerveC = new THREE.CatmullRomCurve3([V3(-2.1, -2.0, .5), V3(-1.4, -1.5, .4), V3(-.8, -.85, .45), V3(-.45, -.42, .35), V3(-.3, -.33, .2)]);
    G.add(M(new THREE.TubeGeometry(nerveC, 120, .04, 12), gloss(0xffe27a, { r: .25, ei: .35 })));
    const itch = [0, 1, 2].map(() => { const g = glowSprite(.4, 0xffe9a0, 0); G.add(g); return g; });
    // mast cells (purple, granular) around the bite, histamine (pink) puffs
    const MP = [[-.6, -.55, .15], [.65, -.6, .1], [-.25, -.75, -.5], [.9, -1.25, -.1], [-.95, -1.2, -.2], [.35, -1.35, .25], [-.15, -.5, -.3]].map(a => V3(...a));
    const mastM = gloss(0xa77bff, { r: .3, ei: .15 }), masts = MP.map(p => { const m = at(M(new THREE.SphereGeometry(.1, 28, 20), mastM), p.x, p.y, p.z); G.add(m); return m; });
    let mastU = 0, salU = 0, suckU = 0;
    const gran = points(MP.length * 10, .045, 0xd8b8ff, (i, t, v) => { const p = MP[i % MP.length], r = rng(i + 61), a = r() * 6.28, b = r() * 3.14; v.set(p.x + Math.cos(a) * Math.sin(b) * .09, p.y + Math.cos(b) * .09, p.z + Math.sin(a) * Math.sin(b) * .09); }, .9); gran.material.blending = THREE.NormalBlending; gran.material.color.setHex(0x5a2fc0); G.add(gran);
    const hist = points(300, .34, 0xe0189a, (i, t, v) => { if (mastU <= 0) return false; const p = MP[i % MP.length], r = rng(i + 91), ph = (t * (.25 + r() * .2) + r()) % 1;
      if (r() > mastU) return false; const a = r() * 6.28, b = (r() - .5) * 2.4, d = .14 + ph * (.5 + r() * .5); v.set(p.x + Math.cos(a) * Math.cos(b) * d, Math.min(-.3, p.y + Math.sin(b) * d * .7), p.z + Math.sin(a) * Math.cos(b) * d); }, .95); hist.material.blending = THREE.NormalBlending; G.add(hist);   // normal blend: additive pink vanishes on the pink dermis
    // fascicle (the needle bundle) probing from the skin surface down to the capillary
    const fasC = new THREE.CatmullRomCurve3([V3(0, .05, 0), V3(.02, -.3, .04), V3(.16, -.58, .14), V3(.06, -.76, .2), V3(.2, -.86, .04)]);
    const fasG = new THREE.TubeGeometry(fasC, 100, .022, 10), fas = M(fasG, gloss(0xffb347, { r: .2, ei: .55 })); G.add(fas);
    const tipGlow = glowSprite(.35, 0xffd07a, 0); G.add(tipGlow);
    const sal = points(160, .16, 0x7dffc0, (i, t, v) => { if (salU <= 0) return false; const r = rng(i + 7), a = r() * 6.28, b = (r() - .5) * 2.6, d = salU * (.15 + .7 * Math.sqrt(r())) + .03 * Math.sin(t * 2 + i);
      v.set(.12 + Math.cos(a) * Math.cos(b) * d, -.7 + Math.sin(b) * d * .5, .12 + Math.sin(a) * Math.cos(b) * d); if (v.y > -.32) v.y = -.32; }, .8); G.add(sal);
    const up = points(60, .06, 0xff3b3b, (i, t, v) => { if (suckU <= 0) return false; const r = rng(i + 13), u = 1 - (t * .9 + r()) % 1; if (u < 0) return false; fasC.getPointAt(u, v); }, 1); G.add(up);
    // mosquito (local: proboscis tip at origin, body up-left)
    const MQ = new THREE.Group(), mq = new THREE.Group(); mq.scale.setScalar(.6); MQ.add(mq); G.add(MQ);
    const bodyM = gloss(0x353a46, { r: .38, ei: .04, sheen: .6, sheenC: 0xbfd8ff }), bandM = gloss(0xeef2f8, { r: .4, ei: .25 }), eyeM = gloss(0x1a0d1c, { r: .1, ei: .02 });
    const cap = (a, b, r, m) => { const d = b.clone().sub(a), g = M(new THREE.CapsuleGeometry(r, Math.max(.001, d.length()), 6, 10), m); g.position.copy(a).add(b).multiplyScalar(.5); g.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize()); mq.add(g); return g; };
    const head = V3(-.46, 1.1, 0), thx = V3(-.82, 1.36, 0);
    cap(V3(0, .02, 0), head, .024, bodyM);
    mq.add(at(M(new THREE.SphereGeometry(.15, 32, 24), bodyM), head.x, head.y, head.z));
    [-1, 1].forEach(sz => { mq.add(at(M(new THREE.SphereGeometry(.105, 24, 16), eyeM), head.x + .02, head.y + .04, sz * .085)); cap(head.clone().add(V3(.02, .08, sz * .05)), head.clone().add(V3(.32, .55, sz * .22)), .012, bodyM); });
    const tm = M(new THREE.SphereGeometry(1, 40, 28), bodyM); tm.scale.set(.34, .27, .26); tm.position.copy(thx); mq.add(tm);
    [-1, 1].forEach(sz => { const st = M(new THREE.SphereGeometry(1, 20, 14), bandM); st.scale.set(.2, .03, .03); at(st, thx.x + .03, thx.y + .24, sz * .07); mq.add(st); });
    const ABD = at(new THREE.Group(), thx.x - .25, thx.y + .02, 0); ABD.rotation.z = -.28; mq.add(ABD);
    const abM = gloss(0x353a46, { r: .3, ei: .05, sheen: .6, sheenC: 0xbfd8ff }), ab = M(new THREE.SphereGeometry(1, 40, 28), abM); ab.scale.set(.7, .17, .17); ab.position.x = -.68; ABD.add(ab);
    const bands = [-.25, -.55, -.85, -1.12].map(x => { const rr = .17 * Math.sqrt(Math.max(0, 1 - Math.pow((x + .68) / .7, 2))); const b = M(new THREE.TorusGeometry(rr + .004, .018, 8, 40), bandM); b.rotation.y = Math.PI / 2; b.position.x = x; ABD.add(b); return b; });
    const wingM = new THREE.MeshPhysicalMaterial({ color: 0xd8f0ff, roughness: .1, transparent: true, opacity: .32, side: THREE.DoubleSide, depthWrite: false, iridescence: 1, iridescenceIOR: 1.6, envMapIntensity: 1.2 });
    const wings = [-1, 1].map(sz => { const p = at(new THREE.Group(), thx.x, thx.y + .2, sz * .08), w = M(new THREE.CircleGeometry(1, 40), wingM); w.scale.set(.8, .15, 1); w.position.set(-.75, 0, 0); w.rotation.x = Math.PI / 2;
      const wr = M(new THREE.CircleGeometry(1, 40), fresnel(0xbfeaff, { p: 1, k: .25 })); wr.scale.copy(w.scale); wr.position.copy(w.position); wr.rotation.copy(w.rotation); p.add(w, wr); p.rotation.y = sz * .3; mq.add(p); return p; });
    [[.35, .75, .06, .55], [-.6, .95, -.75, .82], [-1.2, 1.5, -2.0, 1.25]].forEach(([kx, ky, fx, fz], k) => [-1, 1].forEach(sz => {
      const a = thx.clone().add(V3(k * .08 - .05, -.18, sz * .08)), kn = V3(kx, ky + .4, sz * fz * .75), ft = V3(fx, k === 2 ? 1.05 : 0, sz * fz); cap(a, kn, .022, bodyM); cap(kn, ft, .016, bodyM); }));
    const blood = new THREE.Color(0xc8142a), grey = new THREE.Color(0x353a46);
    return { G, mood: { key: 1, env: 1 }, update(s, K) {
      const u = s.u, ch = win(o.chich, u), hu = win(o.hut, u), wv = range(o.sung ?? 0, sm(u));
      mastU = win(o.mast, u); salU = win(o.nuoc_bot, u); suckU = hu > 0 && hu < 1 ? 1 : 0; setSwell(wv);
      // mosquito: land → sit → fly off
      const land = o.dap ? win(o.dap, u) : 1, off = o.bay != null ? sm((u - o.bay) / .12) : 0, flying = land < 1 || off > 0;
      MQ.visible = o.muoi !== false; MQ.position.set((1 - land) * 1.4 - off * 2.2, (1 - land) * 2.6 + off * 3.2 + .36 * wv * 0, (1 - land) * .8);
      MQ.rotation.set(0, -.9, (1 - land) * -.15 + off * .25);
      wings.forEach((w, k) => { w.rotation.x = flying ? (k ? 1 : -1) * (.2 + .7 * Math.abs(Math.sin(s.t * 47 + k))) : (k ? 1 : -1) * .05; });
      const fill = o.hut ? hu : 0; ABD.scale.set(1 + .12 * fill, 1 + .7 * fill, 1 + .7 * fill); abM.color.copy(grey).lerp(blood, fill); abM.emissive.copy(abM.color); abM.emissiveIntensity = .05 + .6 * fill;
      bands.forEach(b => { b.scale.set(1 + .7 * fill, 1 + .7 * fill, .6); b.visible = fill < .45; });
      // fascicle: grows in while probing, stays while sucking, out when the mosquito leaves
      const fasU = (o.chich ? ch : o.hut ? 1 : 0) * (1 - off); fas.visible = fasU > .01; fasG.setDrawRange(0, Math.floor(100 * fasU) * 10 * 6);
      fasC.getPointAt(Math.max(.01, fasU), tipGlow.position); tipGlow.material.opacity = fas.visible ? .8 : 0;
      rbc.tick(s.t); gran.tick(s.t); hist.tick(s.t); sal.tick(s.t); up.tick(s.t);
      masts.forEach((m, i) => m.scale.setScalar(1 + mastU * (.15 + .1 * Math.sin(s.t * 6 + i))));
      mastM.emissiveIntensity = .15 + .6 * mastU;
      itch.forEach((g, i) => { const ph = (s.t * .55 + i / 3) % 1; nerveC.getPointAt(1 - ph, g.position); g.material.opacity = o.ngua ? .9 * Math.sin(ph * Math.PI) * sm(s.lt / .6) : 0; });
      // camera
      if (o.gan) { const a = -.15 + u * .2; K.cam(Math.sin(a) * 4.6 - .1, .35, Math.cos(a) * 4.6, -.3, .05, 0); }
      else { const a = -.28 + u * .36, d = 7.2 - u * .5; K.cam(Math.sin(a) * d, .55, Math.cos(a) * d, -.1, -.35, 0); }
      G.updateMatrixWorld(true);
      if (o.nhan === false) return [];
      const L = [], f = (t0) => sm((s.lt - t0) / .4);
      if (MQ.visible && o.nhan_muoi !== false && !(o.hut && hu > .15 && hu < 1)) L.push({ text: o.nhan_muoi || 'MUỖI CÁI', p: mq.localToWorld(V3(-.9, 2.0, 0)), a: f(.4) * (1 - off) });
      if (o.lop) L.push({ text: 'BIỂU BÌ', p: V3(-1.15, -.12, ZF), a: f(.6) }, { text: 'TRUNG BÌ', p: V3(-1.15, -.62, ZF), a: f(1.0) }, { text: 'MAO MẠCH', p: capC.getPointAt(.3), a: f(1.4) });
      if (o.chich && ch > .25 && salU <= .3) L.push({ text: o.nhan_voi || 'VÒI CHÍCH', p: fasC.getPointAt(.45).add(V3(.12, 0, 0)), a: sm((ch - .25) / .2) * (1 - off) });
      if (salU > .3) L.push({ text: 'NƯỚC BỌT', p: V3(.3, -.78, .25), a: sm((salU - .3) / .2) });
      if (o.hut && hu > .15 && hu < 1) L.push({ text: 'HÚT MÁU', p: mq.localToWorld(V3(-1.5, 1.2, .1)), a: sm((hu - .15) / .15) });
      if (mastU > .1 && !o.ngua) L.push({ text: 'TẾ BÀO MAST', p: MP[4].clone().add(V3(0, .25, 0)), a: sm((mastU - .1) / .2) }, { text: 'HISTAMINE', p: MP[1].clone().add(V3(.15, .3, 0)), a: sm((mastU - .4) / .2) });
      if (o.ngua) L.push({ text: 'DÂY THẦN KINH', p: nerveC.getPointAt(.25), a: f(.6) });
      return L; } };
  },

  // sneeze: x-ray head + neck in profile (face → +x): nasal cavity, mouth, pharynx, larynx, trachea, lung tops, brain + brainstem
  // ("sneeze centre"), trigeminal nerve, Eustachian tube → eardrum. { bui: [a, b] } irritant specks enter the nose · { tin_hieu: [a, b] } nerve
  // signal to the brainstem · { hit: [a, b] } deep breath in (lungs swell) · { ap: [a, b] } pressure builds (airway glows orange)
  // { hat: .6 } the sneeze: droplet cloud out of nose + mouth · { nin: true } held in: nose/mouth sealed, the blast rebounds — pressure rings
  // run up the Eustachian tube (eardrum bulges) and the throat walls flash red · { gan: mui|tai|hong } close-up · { nhan: false }
  'mui'(o) {
    const G = new THREE.Group(), W = new THREE.Group(); G.add(W);
    // head shell (signed distance → marching cubes, cached)
    if (!TEX.headGeo) {
      const sdf = p => { const s = [], C = (a, b, r) => s.push(sdCaps(p, a, b, r)), E = (c, r) => s.push(sdEll(p, c, r));
        E(V3(-.1, 1.0, 0), V3(1.0, .95, .78)); E(V3(.35, .38, 0), V3(.62, .62, .56)); E(V3(.55, -.05, 0), V3(.32, .26, .3));
        C(V3(.86, .78, 0), V3(1.1, .38, 0), .11); E(V3(1.0, .34, 0), V3(.17, .1, .15)); E(V3(.86, .08, 0), V3(.13, .08, .22));
        C(V3(0, -.15, 0), V3(-.05, -1.4, 0), .42); E(V3(-.1, -1.85, 0), V3(.75, .5, 1.35));
        for (const sz of [-1, 1]) E(V3(-.2, .6, sz * .77), V3(.17, .27, .09));
        let d = s[0]; for (let i = 1; i < s.length; i++) d = smin(d, s[i], .12); return d; };
      const res = 96, half = 2.25, cy = -.15, mc = new MarchingCubes(res, new THREE.MeshBasicMaterial(), false, false, 400000), p = V3(0, 0, 0);
      for (let z = 0; z < res; z++) for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) {
        p.set((x - res / 2) / (res / 2) * half, (y - res / 2) / (res / 2) * half + cy, (z - res / 2) / (res / 2) * half); mc.field[res * res * z + res * y + x] = -sdf(p) * 20; }
      mc.isolation = 0; mc.update(); const n = mc.count, g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(mc.geometry.attributes.position.array.slice(0, n * 3), 3)); g.setAttribute('normal', new THREE.BufferAttribute(mc.geometry.attributes.normal.array.slice(0, n * 3), 3));
      g.scale(half, half, half); g.translate(0, cy, 0); g.computeBoundingSphere(); mc.geometry.dispose(); TEX.headGeo = g; }
    const skin = new THREE.MeshPhysicalMaterial({ color: 0x9fdcff, roughness: .18, clearcoat: 1, transparent: true, opacity: .1, depthWrite: false, envMapIntensity: 1.4 }), rim = fresnel(COL.shell, { p: 2.2, k: 1.2 });
    const shell = new THREE.Group(); shell.add(M(TEX.headGeo, skin), M(TEX.headGeo, rim)); shell.children.forEach(c => c.renderOrder = 10); W.add(shell);
    // airway
    const airC = new THREE.CatmullRomCurve3([V3(1.03, .33, 0), V3(.8, .46, 0), V3(.5, .55, 0), V3(.22, .52, 0), V3(.06, .36, 0), V3(.04, .02, 0), V3(.1, -.35, 0), V3(.15, -.6, 0), V3(.12, -1.2, 0), V3(.06, -1.85, 0)]);
    const mouthC = new THREE.CatmullRomCurve3([V3(.88, .08, 0), V3(.6, .1, 0), V3(.3, .12, 0), V3(.06, .04, 0)]);
    const airM = gloss(0xf58fa0, { r: .25, ei: .12 }), mthM = gloss(0xf07f90, { r: .25, ei: .1, op: .75, dw: false });
    W.add(M(new THREE.TubeGeometry(airC, 220, .085, 18), airM), M(new THREE.TubeGeometry(mouthC, 80, .07, 14), mthM));
    [[.75, .5], [.55, .58], [.35, .56]].forEach(([x, y], i) => { const t = M(new THREE.SphereGeometry(1, 28, 16), gloss(0xff9fb0, { r: .3, ei: .15 })); t.scale.set(.15 - i * .015, .045, .1); at(t, x, y - .05, 0); t.rotation.z = .2; W.add(t); });   // turbinates
    const fold = [-1, 1].map(sz => { const f = M(new THREE.SphereGeometry(1, 20, 12), gloss(0xffe0e6, { r: .3, ei: .2 })); f.scale.set(.08, .02, .045); at(f, .15, -.6, sz * .045); W.add(f); return f; });   // vocal folds
    const lungs = new THREE.Group(), lungM = gloss(COL.lung, { op: .55, r: .3, ei: .5 }); [-1, 1].forEach(sx => lungs.add(at(M(lung(sx), lungM), sx * .78, 0, 0))); lungs.rotation.y = Math.PI / 2; lungs.scale.setScalar(.75); at(lungs, .0, -2.2, 0); W.add(lungs);
    const br = brain(); br.scale.setScalar(.62); at(br, -.12, 1.08, 0); br.rotation.y = Math.PI / 2; W.add(br);
    const stemC = new THREE.CatmullRomCurve3([V3(-.25, .72, 0), V3(-.22, .45, 0), V3(-.18, .15, 0)]); W.add(M(new THREE.TubeGeometry(stemC, 40, .07, 14), gloss(0xf59ab0, { r: .3, ei: .12 })));
    const center = glowSprite(.55, 0xffd27a, 0); at(center, -.22, .45, .02); W.add(center);
    const nerveC = new THREE.CatmullRomCurve3([V3(.62, .52, .08), V3(.4, .72, .12), V3(.1, .72, .12), V3(-.2, .5, .08)]); W.add(M(new THREE.TubeGeometry(nerveC, 60, .022, 10), gloss(0xffe27a, { r: .25, ei: .4 })));
    const sig = [0, 1, 2].map(() => { const g = glowSprite(.3, 0xfff0b0, 0); W.add(g); return g; });
    // Eustachian tube + eardrum (near side)
    const eusC = new THREE.CatmullRomCurve3([V3(.12, .5, .06), V3(0, .56, .3), V3(-.15, .6, .55)]); W.add(M(new THREE.TubeGeometry(eusC, 40, .025, 10), gloss(0xffb0c0, { r: .3, ei: .15 })));
    const drumM = gloss(0xffc8b0, { r: .25, ei: .15, side: THREE.DoubleSide }), drum = M(new THREE.SphereGeometry(.11, 28, 12, 0, Math.PI * 2, 0, .6), drumM); drum.geometry.translate(0, -.11 * Math.cos(.6), 0); drum.rotation.x = Math.PI / 2; at(drum, -.17, .6, .62); drum.scale.set(1, .4, 1); W.add(drum);
    const rings = [0, 1, 2].map(() => { const r = M(new THREE.TorusGeometry(.06, .012, 8, 32), new THREE.MeshBasicMaterial({ color: 0xff7a5a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); W.add(r); return r; });
    const press = [.18, .3, .42, .52, .62, .72].map(u => { const g = glowSprite(.65, 0xff6a00, 0); airC.getPointAt(u, g.position); W.add(g); return g; });
    const seal = [V3(1.1, .3, 0), V3(.95, .08, 0)].map(p => { const g = glowSprite(.32, 0xff4a4a, 0); g.position.copy(p); W.add(g); return g; });
    // particles: irritant specks, breath in, droplet cloud
    let buiU = 0, hitU = 0, tc = -1;
    const specks = points(40, .07, 0xd8ff6a, (i, t, v) => { if (buiU <= 0) return false; const r = rng(i + 5), u = clamp(buiU * 1.3 - r() * .3);
      v.set(lerp(1.9 + r() * .6, .8 + r() * .25, u), lerp(.15 + r() * .4, .45 + (r() - .5) * .08, u), (r() - .5) * .3 * (1 - u)); }, 1);
    const breath = points(90, .05, 0xbfeaff, (i, t, v) => { if (hitU <= 0 || hitU >= 1) return false; const r = rng(i + 9), u = (t * .7 + r()) % 1; (i % 3 ? airC : mouthC).getPointAt(i % 3 ? u : u * .999, v); }, .8);
    const drops = points(600, .075, 0xdff6ff, (i, t, v) => { if (o.nin || tc < 0 || tc > 3) return false; const r = rng(i + 77), mouth = i % 3 === 0, sp = .9 + r() * 2.2, a = (r() - .5) * .9, b = (r() - .5) * .9, d = sp * (1 - Math.exp(-tc * 1.6)) / 1.6;
      v.set((mouth ? .95 : 1.1) + Math.cos(a) * d, (mouth ? .08 : .3) + Math.sin(a) * d * .6 - .25 * tc * tc * r(), Math.sin(b) * d * .5); }, .9);
    W.add(specks, breath, drops);
    return { G, mood: { key: .95, env: 1 }, update(s, K) {
      const u = s.u; buiU = o.bui ? sm((u - o.bui[0]) / Math.max(.05, o.bui[1] - o.bui[0])) : 0; hitU = o.hit ? clamp((u - o.hit[0]) / Math.max(.05, o.hit[1] - o.hit[0])) : 0;
      const sg = o.tin_hieu ? clamp((u - o.tin_hieu[0]) / Math.max(.05, o.tin_hieu[1] - o.tin_hieu[0])) : -1, ap = o.ap ? sm((u - o.ap[0]) / Math.max(.05, o.ap[1] - o.ap[0])) : 0;
      tc = o.hat == null ? -1 : s.lt - o.hat * s.D; const out = tc >= 0;
      specks.tick(s.t); breath.tick(s.t); drops.tick(s.t);
      sig.forEach((g, i) => { const p = clamp(sg * 1.3 - i * .15); nerveC.getPointAt(p, g.position); g.material.opacity = sg > 0 && sg < 1 ? .9 * Math.sin(p * Math.PI) : 0; });
      center.material.opacity = o.tin_hieu ? clamp(sg * 1.5) * (.6 + .4 * Math.sin(s.t * 8)) : 0;
      const full = Math.max(sm(hitU), ap, o.hat != null && !out ? 0 : 0), deflate = out && !o.nin ? sm(tc / .25) : 0;
      lungs.scale.setScalar(.75 * (1 + .14 * full * (1 - deflate)));
      fold.forEach((f, k) => f.position.z = (k ? 1 : -1) * (ap > .3 && !(out && !o.nin) ? .02 : .045));
      // pressure: builds along the airway; on a normal sneeze it vents out, held in it rebounds
      const held = o.nin && out, hp = held ? 1 - .5 * sm((tc - .8) / 1.5) : ap * (out ? 1 - sm(tc / .2) : 1);
      press.forEach((g, i) => { g.material.opacity = hp * (.55 + .35 * Math.sin(s.t * 9 + i)); g.material.color.setHex(held ? 0xff2a1a : 0xff6a00); });
      airM.emissive.setHex(held ? 0xff3020 : ap > .02 && !out ? 0xff7a30 : 0xf58fa0); airM.emissiveIntensity = .12 + (held ? .5 + .3 * Math.sin(s.t * 12) : out ? 0 : .5 * ap);
      seal.forEach(g => g.material.opacity = o.nin && (ap > .1 || out) ? .7 + .2 * Math.sin(s.t * 6) : 0);
      rings.forEach((r, i) => { const ph = held ? (tc * .9 + i / 3) % 1 : -1; r.visible = ph >= 0; if (ph >= 0) { eusC.getPointAt(ph, r.position); r.lookAt(eusC.getPointAt(Math.min(1, ph + .05))); r.material.opacity = .9 * Math.sin(ph * Math.PI); } });
      drum.scale.set(1, .4 + (held ? 2.2 * sm(tc / .3) * (1 - .4 * sm((tc - 1) / 1.5)) : 0), 1); drumM.color.setHex(held ? 0xff5a40 : 0xffc8b0); drumM.emissive.copy(drumM.color); drumM.emissiveIntensity = held ? .6 : .15;
      // camera
      const T = { mui: [.75, .45, 0, 2.6], tai: [.25, .4, .2, 3.6], hong: [.12, -.3, 0, 2.8] }[o.gan];
      const shake = out && tc < .3 ? .03 * Math.sin(s.t * 70) * (1 - tc / .3) : 0;
      if (T) { const [x, y, z, d] = T, a = .25 - u * .2; K.cam(x + Math.sin(a) * d + shake, y + .15, z + Math.cos(a) * d, x, y, z); }
      else { const a = .22 - u * .3, d = 7.4 - u * .5, lx = o.hat != null && !o.nin ? .25 + .45 * sm((tc + .3) / .8) : .25; K.cam(lx + Math.sin(a) * d + shake, -.05, Math.cos(a) * d, lx, -.25, 0); }
      W.updateMatrixWorld(true);
      if (o.nhan === false) return [];
      const f = t0 => sm((s.lt - t0) / .4), L = [];
      if (o.bui || o.lop) L.push({ text: 'KHOANG MŨI', p: V3(.62, .7, 0), a: f(.4) });
      if (o.tin_hieu) L.push({ text: 'DÂY THẦN KINH', p: nerveC.getPointAt(.45).add(V3(0, .12, 0)), a: f(.5) }, { text: 'TRUNG TÂM HẮT HƠI', p: V3(-.3, .3, 0), a: sm((sg - .7) / .2) });
      if (o.hit || o.lop) L.push({ text: 'PHỔI', p: V3(.45, -1.75, 0), a: f(.6) });
      if (o.ap && ap > .2 && !out) L.push({ text: o.nhan_ap || 'ÁP LỰC TĂNG', p: V3(.35, -.6, 0), a: sm((ap - .2) / .2) });
      if (o.nin && ap > .1) L.push({ text: 'BỊT MŨI + MIỆNG', p: V3(1.15, .55, 0), a: sm((ap - .1) / .2) });
      if (held) L.push({ text: 'MÀNG NHĨ', p: V3(-.35, .85, .6), a: sm((tc - .2) / .3) }, { text: 'HỌNG', p: V3(.4, -.15, 0), a: sm((tc - .5) / .3) });
      if (out && !o.nin) L.push({ text: o.nhan_hat || 'GIỌT BẮN', p: V3(1.9, .45, 0), a: sm((tc - .15) / .3) * (1 - sm((tc - 2) / .4)) });
      if (o.lop) L.push({ text: 'KHÍ QUẢN', p: V3(.4, -1.1, 0), a: f(1.0) });
      return L; } };
  },

  'phan-tu'(o) {
    const G = new THREE.Group(), m = o.chat === 'capsaicin' ? capsaicin(.24) : o.chat === 'ethanol' ? ethanol(.55) : caffeine(.6); G.add(m);
    return { G, mood: { key: 1.1, env: 1.1 }, update(s, K) { m.rotation.set(Math.sin(s.t * .4) * .35, -.6 + s.u * 1.6, o.chat === 'capsaicin' ? 1.0 : 0); K.cam(0, .3, 8.6 - s.u * .9, 0, 0, 0);
      return o.nhan === false ? [] : [{ text: o.nhan || (o.chat === 'capsaicin' ? 'CAPSAICIN' : o.chat === 'ethanol' ? 'ETHANOL · C₂H₅OH' : 'CAFFEINE · C₈H₁₀N₄O₂'), p: V3(0, 1.35, 0), a: sm((s.lt - .4) / .4) }]; } };
  },
};

// ---------- studio ----------
export function clinic({ W, H }) {
  const C = create3D({ W, H, fov: 40, exposure: 1.08, shadows: false }), { scene, camera, renderer } = C;
  scene.background = new THREE.Color(COL.bg); scene.fog = new THREE.FogExp2(COL.bg, .0);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = 1;
  const bd = backdrop(); scene.add(bd);
  const hemi = new THREE.HemisphereLight(0xbfe6ff, 0x10203a, .9), key = new THREE.DirectionalLight(0xfff2e6, 2.0), rim = new THREE.DirectionalLight(0x5fd4ff, 2.2), fill = new THREE.DirectionalLight(0xff9ec0, .7);
  key.position.set(3, 5, 6); rim.position.set(-5, 3, -6); fill.position.set(-4, -1, 4); scene.add(hemi, key, rim, fill);
  const motes = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: .03, color: 0x9fe8ff, map: dotTex(), transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false }));
  { const r = rng(7), a = new Float32Array(600 * 3); for (let i = 0; i < 600; i++) { a[i * 3] = (r() - .5) * 16; a[i * 3 + 1] = (r() - .2) * 8; a[i * 3 + 2] = (r() - .5) * 16; } motes.geometry.setAttribute('position', new THREE.BufferAttribute(a, 3)); } scene.add(motes);
  post(C, { ao: false, bloom: .26, grade: { contrast: 1.06, saturation: 1.12, warmth: 0, vignette: .45 } });
  const cache = {}, D = { key: 1, hemi: 1, rim: 1, env: .75, bg: COL.bg, fog: 0 };
  const K = { cam(px, py, pz, lx, ly, lz) { camera.position.set(px, py, pz); camera.lookAt(lx, ly, lz); } };
  const S = { C, gpu: C.gpu, KINDS: Object.keys(SETS) };
  S.draw = (x, sceneKey, kind, s, o = {}) => { if (!SETS[kind]) throw new Error('medical3d: unknown set ' + kind + ' (' + Object.keys(SETS).join(', ') + ')');
    const id = sceneKey + ':' + kind; if (!cache[id]) { cache[id] = SETS[kind](o); scene.add(cache[id].G); }
    for (const k in cache) cache[k].G.visible = k === id;
    const P = cache[id], m = { ...D, ...(P.mood || {}), ...(o.mood || {}) };
    hemi.intensity = .9 * m.hemi; key.intensity = 2.0 * m.key; rim.intensity = 2.2 * m.rim; scene.environmentIntensity = m.env; scene.fog.density = m.fog; scene.fog.color.setHex(m.bg); bd.visible = !m.fog;
    motes.visible = kind !== 'mach-mau'; motes.rotation.y = s.t * .02;
    const ss = { ...s, u: clamp(s.lt / Math.max(.1, s.D)) }, labels = P.update(ss, K) || []; camera.updateMatrixWorld(); C.draw(x);
    return labels.filter(l => l.a > 0).map(l => { const v = l.p.clone().project(camera); return { text: l.text, x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, a: l.a, behind: v.z > 1 }; }).filter(l => !l.behind);
  };
  return S;
}
