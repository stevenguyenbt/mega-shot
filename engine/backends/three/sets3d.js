// mega-shot · full-frame stylised 3D "sets" for quote / philosophy / motivation shorts (template triet-ly).
// One cinematic stage (night-blue fog, warm key, cool rim, floating dust, bloom, AgX) + procedural set pieces built from
// primitives: wooden-mannequin figures, low-poly horses, architecture, nature. Every frame is a pure function of time.
//   const S = studio({ W, H }); S.draw(x, sceneKey, kind, { lt, D, t }, opts)
// Kinds: see SETS keys (hai-ngua, dua-ngua, dau-truong, ham-tap, cot-hy-lap, cay-nho, vach-dich, phong-ngu, so-tay, to-ong,
//        leu-tuyet, de-kiem, vang-lua, binh-minh, nui-dat, nhiet-ke, ngu-cong, the-he, giot-nuoc, duc-da, tang-da, piano, nha-hat, nep-chan, duong-chay, xe-nui, da-vo, ban-viet, domino, hieu-sach, doc-sach, pho-sach)
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { create3D, post } from './ms3d.js';
import { mat3d, PRESETS } from './mats3d.js';
import { roundedBox, lathe, fluted, taper, plate, blade, scatter, lump } from './geo3d.js';
import { instance, personRig, preload as libPreload, namesIn } from './library3d.js';
import { person } from './people3d.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (a, b, u) => a + (b - a) * u;
const eo3 = u => 1 - Math.pow(1 - clamp(u), 3), sm = u => { u = clamp(u); return u * u * (3 - 2 * u); };
const back = (u, s = 1.7) => { u = clamp(u) - 1; return 1 + (s + 1) * u * u * u + s * u * u; };
const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const COL = { bg: 0x0a0e18, gold: 0xe8b04a, warm: 0xffb866, cool: 0x7d96ff, stone: 0xa59b8a, marble: 0xe9e4da, wood: 0x6b4a32, red: 0xc8321f, earth: 0x7a5a3c, ink: 0x1d1a17, cream: 0xefe6d2, mann: 0xd8c3a0 };
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: o.r ?? .6, metalness: o.m ?? 0, emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1,
  transparent: o.op != null, opacity: o.op ?? 1, side: o.side ?? THREE.FrontSide, flatShading: !!o.flat, depthWrite: o.dw ?? true });
// mat(): physical material with micro-variation (mats3d.js); o.p = preset; transparent → plain standard (std)
const mat = (c, o = {}) => { if (o.op != null || o.std) return std(c, o);
  const p = o.p || (o.m >= .6 ? 'iron' : (o.r ?? .6) >= .85 ? 'stone' : 'matte-plastic'), b = PRESETS[p];
  return mat3d(p, { color: c, roughness: o.r ?? b.roughness, metalness: o.m ?? b.metalness ?? 0, emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 1, side: o.side, flat: o.flat,
    vary: o.vary ?? b.vary ?? (o.p ? .08 : .05), bump: o.bump ?? (o.p ? b.bump : p === 'stone' ? .35 : .08), repeat: o.rep || [1, 1], seed: o.seed ?? 1 }); };
const M = (g, m, cast = true) => { const k = new THREE.Mesh(g, m); k.castShadow = cast; k.receiveShadow = true; return k; };
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const TEX = {};
function glowTex(stops = [[0, 'rgba(255,230,180,1)'], [.3, 'rgba(255,170,80,.45)'], [1, 'rgba(255,140,40,0)']], key = 'glow') {
  if (TEX[key]) return TEX[key]; const k = document.createElement('canvas'); k.width = k.height = 128; const g = k.getContext('2d'), rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([p, c]) => rg.addColorStop(p, c)); g.fillStyle = rg; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(k); t.colorSpace = THREE.SRGBColorSpace; return TEX[key] = t; }
const glow = (size, color = 0xffffff, op = 1, key) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(key === 'w' ? [[0, 'rgba(255,255,255,1)'], [.35, 'rgba(255,255,255,.4)'], [1, 'rgba(255,255,255,0)']] : undefined, key), color, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.set(size, size, 1); return s; };
function textSprite(text, o = {}) {
  const k = document.createElement('canvas'); k.width = o.w || 512; k.height = o.h || 256; const g = k.getContext('2d');
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(k), transparent: true, depthWrite: false }));
  s.set = txt => { if (s._t === txt) return; s._t = txt; g.clearRect(0, 0, k.width, k.height); g.font = `900 ${o.size || 150}px BVP, Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 14; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(txt, k.width / 2, k.height / 2); g.fillStyle = o.color || '#ffd36a'; g.fillText(txt, k.width / 2, k.height / 2); s.material.map.needsUpdate = true; };
  s.material.map.colorSpace = THREE.SRGBColorSpace; s.set(text); s.scale.set(o.sx || 2, (o.sx || 2) * k.height / k.width, 1); return s; }
// time-lapse particles helper: N points whose position is f(i, t) → updated each frame
function points(N, size, color, f, o = {}) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const P = new THREE.Points(geo, new THREE.PointsMaterial({ size, color, map: glowTex([[0, 'rgba(255,255,255,1)'], [.35, 'rgba(255,255,255,.4)'], [1, 'rgba(255,255,255,0)']], 'pt'), transparent: true, opacity: o.op ?? .9, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
  P.frustumCulled = false; P.tick = t => { const v = new THREE.Vector3(); for (let i = 0; i < N; i++) { f(i, t, v); pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; } geo.attributes.position.needsUpdate = true; }; return P; }

// ---------- characters ----------
// wooden art-mannequin, 1.9 units tall, faces +z; limbs pivot at shoulder / hip (rotation.x swings forward/back)
// people mode (studio({ nguoi }) / scene canh3d.nguoi): figures become stylised people (people3d.js) instead of wooden mannequins.
// The first figure of a scene takes canh3d.nguoi (spec); the rest get varied genders / skin tones from a seed.
let PPL = null, PPL_SCENE = null, PPL_LIST = [], PPL_ERA = null, PPL_N = 0, PPL_SEED = 1;   // PPL_ERA: canh3d.thoi_dai → period costumes for every figure of the scene
function figure(o = {}) {
  if (PPL || PPL_LIST.length || PPL_ERA) { const era = PPL_ERA ? { thoi_dai: PPL_ERA } : {}, pick = PPL_LIST[PPL_N]; PPL_N++;
    if (typeof pick === 'string') return personRig(pick, { size: o.size ?? 1 });           // character rebuilt from a reference image (xp model new --nguoi)
    const base = pick && typeof pick === 'object' ? { ...era, ...pick } : person.random(PPL_SEED + PPL_N * 7, { ...(typeof PPL === 'object' && PPL ? PPL : {}), ...era });
    return person({ ...base, size: o.size ?? 1 }); }
  const m = o.mat || mat(o.color ?? COL.mann, { p: 'wood-toy' }), G = new THREE.Group(), B = new THREE.Group(); G.add(B);
  const torso = at(M(new THREE.CapsuleGeometry(.22, .5, 6, 16), m), 0, 1.16, 0); torso.scale.set(1, 1, .78); B.add(torso);
  const head = at(M(new THREE.SphereGeometry(.16, 24, 16), m), 0, 1.78, 0); head.scale.set(1, 1.12, 1); B.add(head);
  const neck = at(M(new THREE.CylinderGeometry(.06, .07, .14, 10), m), 0, 1.6, 0); B.add(neck);
  const limb = (len, r, x, y, parent = B) => { const p = at(new THREE.Group(), x, y, 0), k = at(M(new THREE.CapsuleGeometry(r, len, 4, 10), m), 0, -len / 2 - r * .5, 0); p.add(k);
    const j = at(M(new THREE.SphereGeometry(r * 1.15, 12, 8), m), 0, 0, 0); p.add(j); parent.add(p); return p; };
  const aL = limb(.56, .065, -.31, 1.47), aR = limb(.56, .065, .31, 1.47), lL = limb(.7, .085, -.12, .8), lR = limb(.7, .085, .12, .8);
  [aL, aR].forEach(a => { const h = at(M(new THREE.SphereGeometry(.075, 16, 12), m), 0, -.72, .01); h.scale.set(.9, 1.15, .7); a.add(h); });
  [lL, lR].forEach(l => l.add(at(M(roundedBox(.15, .08, .26, .035), m), 0, -.86, .06)));
  const pel = at(M(new THREE.SphereGeometry(.2, 20, 14), m), 0, .82, 0); pel.scale.set(1.05, .6, .8); B.add(pel);
  G.scale.setScalar(o.size ?? 1);
  const F = { G, B, head, torso, aL, aR, lL, lR,
    rest() { [aL, aR, lL, lR].forEach(p => p.rotation.set(0, 0, 0)); aL.rotation.z = -.12; aR.rotation.z = .12; B.position.y = 0; B.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0); },
    walk(ph, amp = .55) { F.rest(); const s = Math.sin(ph); lL.rotation.x = s * amp; lR.rotation.x = -s * amp; aL.rotation.x = -s * amp * .8; aR.rotation.x = s * amp * .8; B.position.y = Math.abs(Math.cos(ph)) * .04; },
    breathe(t) { torso.scale.y = 1 + Math.sin(t * 2) * .015; head.rotation.y = Math.sin(t * .6) * .15; } };
  F.rest(); return F;
}
// low-poly horse, faces +x, ~2.2 units tall at the head
function horse(o = {}) {
  const m = mat(o.color ?? 0x8a3d16, { p: 'fur', r: o.r ?? .35, vary: .05 }), mm = mat(o.mane ?? 0x241710, { p: 'fur', r: .7 }), hoofM = mat(0x1a1410, { r: .7 });
  const G = new THREE.Group(), B = new THREE.Group(); G.add(B); const L = o.len ?? 1, T = o.thick ?? 1;
  const body = at(M(new THREE.SphereGeometry(.5, 32, 20), m), 0, 1.38, 0); body.scale.set(1.65 * L, .82 * T, .7 * T); B.add(body);
  const neck = at(new THREE.Group(), .62 * L, 1.55, 0); B.add(neck); neck.rotation.z = -.62;
  const nk = at(M(new THREE.CapsuleGeometry(.17 * T, .55, 6, 12), m), 0, .38, 0); neck.add(nk);
  const crest = at(M(roundedBox(.08, .7, .07), mm), -.15, .4, 0); neck.add(crest);
  const head = at(new THREE.Group(), 0, .74, 0); neck.add(head); head.rotation.z = -1.35;
  const hd = at(M(new THREE.CapsuleGeometry(.12, .36, 6, 12), m), 0, .22, 0); head.add(hd); hd.scale.set(1, 1, .85);
  [-1, 1].forEach(sz => { const ear = at(M(new THREE.ConeGeometry(.045, .16, 6), m), -.07, -.02, sz * .07); ear.rotation.z = .5; head.add(ear);
    const eye = at(M(new THREE.SphereGeometry(.028, 8, 6), mat(0x0a0806, { r: .2 })), .02, .12, sz * .095); head.add(eye); });
  const legs = [];
  [[.52, .2], [.52, -.2], [-.52, .2], [-.52, -.2]].forEach(([x, z]) => {
    const up = at(new THREE.Group(), x * L, 1.18, z * T); B.add(up); up.add(at(M(new THREE.CapsuleGeometry(.085 * T, .42, 4, 10), m), 0, -.3, 0));
    const lo = at(new THREE.Group(), 0, -.56, 0); up.add(lo); lo.add(at(M(new THREE.CapsuleGeometry(.055, .4, 4, 8), m), 0, -.26, 0));
    lo.add(at(M(new THREE.CylinderGeometry(.07, .08, .09, 10), hoofM), 0, -.53, 0)); legs.push({ up, lo }); });
  const tail = at(new THREE.Group(), -.8 * L, 1.5, 0); B.add(tail);
  [[0, 0], [.03, .04], [-.03, -.04]].forEach(([dx, dz], k) => tail.add(M(taper([[0, 0, dz], [-.12 + dx, -.25, dz], [-.1 + dx, -.55, dz * 1.5], [-.02, -.85 - k * .05, dz * 2]], u => .075 * (1 - u * .85) + .01, { seg: 32, radial: 8 }), mm)));
  tail.rotation.z = .5;
  for (let k = 0; k < 7; k++) { const v = k / 6, st = M(taper([[-.13, .08 + v * .62, 0], [-.22, .02 + v * .62, (k % 2 ? .05 : -.05)], [-.26, -.1 + v * .62, (k % 2 ? .08 : -.08)]], u => .045 * (1 - u), { seg: 12, radial: 6 }), mm); neck.add(st); }
  const H = { G, B, neck, head, legs, tail,
    gallop(ph, amp = .7) { const sw = [0, .35, Math.PI, Math.PI + .35];
      legs.forEach((g, i) => { const s = Math.sin(ph + sw[i]); g.up.rotation.z = s * amp * (i < 2 ? 1 : -.9); g.lo.rotation.z = Math.max(0, -Math.sin(ph + sw[i] + .8)) * amp * (i < 2 ? -1.2 : 1.2); });
      B.position.y = Math.abs(Math.sin(ph)) * .12 * amp; B.rotation.z = Math.sin(ph) * .06 * amp; neck.rotation.z = -.62 + Math.sin(ph + .6) * .12 * amp; tail.rotation.z = .9 + Math.sin(ph) * .2; },
    walk(ph, amp = .35) { const sw = [0, Math.PI, Math.PI * .5, Math.PI * 1.5];
      legs.forEach((g, i) => { const s = Math.sin(ph + sw[i]); g.up.rotation.z = s * amp; g.lo.rotation.z = Math.max(0, -Math.sin(ph + sw[i] + .9)) * amp * (i < 2 ? -1.3 : 1.3); });
      B.position.y = Math.abs(Math.sin(ph * 2)) * .03; neck.rotation.z = -.62 + Math.sin(ph * 2) * .05; tail.rotation.z = .55 + Math.sin(ph) * .08; },
    idle(t, droop = 0) { legs.forEach(g => { g.up.rotation.z = 0; g.lo.rotation.z = 0; }); B.position.y = Math.sin(t * 1.6) * .008;
      neck.rotation.z = -.62 + Math.sin(t * .9) * .05 - droop * .55; tail.rotation.z = .5 + Math.sin(t * 1.3) * .15; legs[0].up.rotation.z = Math.max(0, Math.sin(t * .7)) * .25 * (1 - droop); legs[0].lo.rotation.z = -legs[0].up.rotation.z * 1.4; } };
  return H;
}
const ground = (r, color = 0x151a24, o = {}) => { const g = M(new THREE.CircleGeometry(r, 64).rotateX(-Math.PI / 2), mat(color, { r: o.r ?? .85, m: o.m ?? 0 }), false); g.receiveShadow = true; return g; };
function bumpy(geo, amp, seed = 1, f = 1.3) { const p = geo.attributes.position, r = rng(seed), ph = [r() * 9, r() * 9, r() * 9];
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = Math.sin(x * f + ph[0]) * Math.cos(z * f * 1.3 + ph[1]) + .5 * Math.sin((x + z) * f * 2.1 + ph[2]) + .25 * Math.sin(y * f * 3.7 + x * 2.3);
    const L = Math.hypot(x, y, z) || 1; p.setXYZ(i, x + x / L * n * amp, y + Math.max(0, y) / L * n * amp * .6, z + z / L * n * amp); }
  geo.computeVertexNormals(); return geo; }
function basket(m) { const g = new THREE.Group(); g.add(M(new THREE.CylinderGeometry(.22, .16, .26, 14, 1, true), m || mat(0x9a7448, { r: .9, side: THREE.DoubleSide })));
  const soil = at(M(new THREE.SphereGeometry(.2, 12, 8), mat(COL.earth, { p: 'earth', flat: true, rep: [3, 3] })), 0, .1, 0); soil.scale.y = .45; g.add(soil); return g; }

// ---------- sets: each returns { G, mood?, update(s, K) } — s = { lt, D, t, u (lt/D) }; K.cam(px,py,pz, lx,ly,lz) ----------
const SETS = {
  // showcase one library model (xp model new): marble pedestal, slow turntable, orbiting camera. { kieu: vat, ten: <model>, cao: 2.2 }
  'vat'(o) { const G = new THREE.Group(), mar = mat(COL.marble, { p: 'marble' }), cao = o.cao ?? 2.2;
    const I = instance(o.ten, { cao }), sz = new THREE.Box3().setFromObject(I.group).getSize(new THREE.Vector3()), pk = Math.max(1, Math.max(sz.x, sz.z) * .62 / 1.3);   // pedestal grows with wide models
    const ped = at(M(lathe([[1.5, 0], [1.5, .12], [1.35, .18], [1.3, .5], [1.42, .56], [1.42, .62]], 64), mar), 0, 0, 0); ped.scale.set(pk, 1, pk); G.add(ped, ground(30));
    at(I.group, 0, .62, 0); G.add(I.group);
    const sp = at(new THREE.SpotLight(0xffe2b0, 45, 22, .45, .6, 1.3), 2.5, 8, 3); sp.target.position.set(0, 1.2, 0); sp.castShadow = true; sp.shadow.radius = 6; sp.shadow.blurSamples = 12; G.add(sp, sp.target);
    return { G, mood: { key: .5, rim: 1.4 }, update(s, K) { I.update(s); I.group.rotation.y = (o.goc ?? 0) + s.t * (o.quay ?? .35);
      const a = .5 + s.u * .6, d = Math.max(cao, Math.max(sz.x, sz.z) * .8) * 2.4 + 2.5; K.cam(Math.sin(a) * d, .62 + cao * (.75 - s.u * .2), Math.cos(a) * d, 0, .62 + cao * .5, 0); } }; },
  'hai-ngua'(o) { const G = new THREE.Group();
    const A = horse({ color: 0x8b3a12, r: .26, m: .3, mane: 0xd9a441 }), N = horse({ color: 0x6f665b, r: .95, m: 0, thick: .82, len: .96, mane: 0x3b342c });
    at(A.G, 0, 0, -1.15); at(N.G, 0, 0, 1.15); G.add(A.G, N.G, ground(30));
    const line = at(M(new THREE.PlaneGeometry(.14, 7).rotateX(-Math.PI / 2), mat(COL.cream, { e: COL.cream, ei: .5 }), false), 1.55, .012, 0); G.add(line);
    [-1, 1].forEach(s => { const p = at(M(new THREE.CylinderGeometry(.05, .05, 1.6, 10), mat(COL.cream, { r: .4 })), 1.55, .8, s * 3.3); G.add(p); });
    const halo = at(glow(5, 0xffc070, .35), .2, 1.7, -1.15); G.add(halo);
    return { G, update(s, K) { A.idle(s.t); N.idle(s.t + 1.7, .25); halo.material.opacity = .25 + .1 * Math.sin(s.t * 2);
      K.cam(lerp(6.4, 5.2, sm(s.u)), lerp(1.1, 1.5, s.u), lerp(6.2, 4.6, sm(s.u)), .3, 1.25, 0); } }; },

  'dua-ngua'(o) { const G = new THREE.Group();
    const A = horse({ color: 0x8b3a12, r: .26, m: .3, mane: 0xd9a441 }), N = horse({ color: 0x6f665b, r: .95, m: 0, thick: .82, len: .96, mane: 0x3b342c });
    at(A.G, 0, 0, -1.1); at(N.G, 0, 0, 1.1); G.add(A.G, N.G);
    const track = at(M(new THREE.PlaneGeometry(40, 5.5).rotateX(-Math.PI / 2), mat(0x3a2f25, { r: .95 }), false), 14, .005, 0); G.add(track, ground(60));
    for (let i = 0; i < 12; i++) { const p = at(M(new THREE.CylinderGeometry(.05, .05, 1.2, 8), mat(i % 2 ? COL.cream : COL.red, { r: .5 })), i * 3, .6, -3); G.add(p);
      if (i % 3 === 0) { const n = textSprite(`${i * 10}`, { color: '#efe6d2', size: 120, sx: .9 }); at(n, i * 3, 1.5, -3); G.add(n); } }
    const dust = points(70, .35, 0xb89a74, (i, t, v) => { const r = rng(i + 7), k = (t * 1.8 + r()) % 1; v.set(-0.6 - k * 2.2 + A.G.position.x, .1 + k * .6 * r(), -1.1 + (r() - .5) * .8); }, { op: .35 });
    G.add(dust);
    return { G, update(s, K) { const stop = Math.min(1.7, s.D * .2), xa = 10 * eo3(s.lt / stop), xn = s.lt * 1.05;
      A.G.position.x = xa; if (s.lt < stop) A.gallop(s.lt * 13, .8 * (1 - sm((s.lt - stop + .4) / .4))); else A.idle(s.t, sm((s.lt - stop) / 1.2));
      N.G.position.x = xn; N.walk(s.lt * 4.6, .38); dust.visible = s.lt < stop; dust.tick(s.t);
      const hi = Math.max(xa, xn), lo = Math.min(xa, xn); K.cam(lo - 3.8, 2.6, 3.4, hi + 1.5, .9, -.2); } }; },

  'dau-truong'(o) { const G = new THREE.Group(), stone = mat(0x6e665a, { p: 'stone', rep: [6, 1] });
    for (let i = 0; i < 7; i++) { const h = .38 * (i + 1); G.add(at(M(new THREE.CylinderGeometry(3.2 + i * .75, 3.2 + i * .75, h, 72, 1, false, Math.PI / 2, Math.PI), stone), 0, h / 2, 0)); }
    const stage = at(M(new THREE.CylinderGeometry(1.4, 1.5, .18, 48), mat(COL.marble, { p: 'marble' })), 0, .09, 1); G.add(stage, ground(40, 0x1a1712));
    const crowd = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.12, .25, 4, 8), mat(0x2b241e, { r: .8 }), 120), r = rng(4), base = [];
    for (let k = 0; k < 120; k++) { const i = k % 6, a = Math.PI / 2 + .1 + r() * (Math.PI - .2), R = 3.55 + i * .75; base.push([Math.sin(a) * R, .38 * (i + 1) + .25, Math.cos(a) * R, r() * 6]); }
    crowd.castShadow = true; G.add(crowd);
    const F = figure({ color: COL.mann }); at(F.G, 0, .18, 1); F.G.rotation.y = Math.PI; G.add(F.G);
    const waves = [...Array(5)].map(() => { const w = M(new THREE.TorusGeometry(1, .035, 8, 64, Math.PI).rotateX(-Math.PI / 2), mat(0xff3020, { e: 0xff2010, ei: 2.2, op: .8, dw: false }), false); G.add(w); return w; });
    const dm = new THREE.Object3D();
    return { G, mood: { key: .45, rim: 1.2 }, update(s, K) {
      base.forEach(([x, y, z, ph], k) => { dm.position.set(x, y + Math.max(0, Math.sin(s.t * 7 + ph)) * .12, z); dm.updateMatrix(); crowd.setMatrixAt(k, dm.matrix); }); crowd.instanceMatrix.needsUpdate = true;
      waves.forEach((w, k) => { const p = ((s.lt * .55 + k / 5) % 1), R = lerp(7.5, 1.4, p); w.scale.set(R, 1, R); w.position.set(0, 1.2 + p * .2, .6 * p); w.material.opacity = Math.sin(p * Math.PI) * .85 * sm(s.lt / .8); });
      F.rest(); F.aR.rotation.x = -1.2 + Math.sin(s.t * 3) * .2 * (1 - s.u); F.head.rotation.x = sm((s.u - .45) / .3) * .5; F.B.rotation.x = sm((s.u - .45) / .3) * .12;
      const a = .35 + s.u * .4; K.cam(Math.sin(a) * 10.5, 6.2 - s.u * 1.5, Math.cos(a) * 10.5 + 1, 0, 1.2, -1.2); } }; },

  'ham-tap'(o) { const G = new THREE.Group(), wall = mat(0x3a332b, { r: .95, flat: true }), wood = mat(COL.wood, { p: 'wood' });
    G.add(at(M(roundedBox(9, 5, .4), wall), 0, 2.5, -2.2), at(M(roundedBox(.4, 5, 7), wall), -3.6, 2.5, 0), ground(20, 0x24201b));
    for (let i = 0; i < 18; i++) { const b = at(M(roundedBox(.9, .42, .1), mat(0x4a4137, { r: .95 })), -3.6 + (i % 6) * 1.5 + (Math.floor(i / 6) % 2) * .75, .6 + Math.floor(i / 6) * 1.3, -1.98); G.add(b); }
    const top = at(M(roundedBox(2.6, .12, 1.4), wood), 0, 1.02, 0); G.add(top);
    [[-1.15, -.6], [1.15, -.6], [-1.15, .6], [1.15, .6]].forEach(([x, z]) => G.add(at(M(roundedBox(.1, 1, .1), wood), x, .5, z)));
    const bowl = at(M(new THREE.SphereGeometry(.16, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(0x9a6b2e, { p: 'bronze' })), -.75, 1.25, .1); G.add(bowl);
    const flame = at(glow(.5, 0xffb050, 1), -.75, 1.42, .1), halo = at(glow(3.2, 0xff9a40, .45), -.75, 1.45, .1), L = at(new THREE.PointLight(0xffa850, 9, 9, 1.6), -.75, 1.6, .2);
    L.castShadow = true; L.shadow.mapSize.set(1024, 1024); G.add(flame, halo, L);
    const hg = at(new THREE.Group(), .55, 1.08, -.1), glass = mat(0xdfe8ff, { r: .05, op: .25, dw: false }), sandM = mat(0xd9b46a, { r: .8 });
    [-1, 1].forEach(s => { hg.add(at(M(new THREE.CylinderGeometry(.05 + .0, .2, .3, 20, 1, true).rotateZ(s < 0 ? 0 : Math.PI), glass, false), 0, .2 + s * .16 + .16, 0));
      hg.add(at(M(new THREE.CylinderGeometry(.24, .24, .04, 20), wood), 0, s < 0 ? 0 : .66, 0)); });
    [0, 2.1, 4.2].forEach(a => hg.add(at(M(new THREE.CylinderGeometry(.018, .018, .66, 6), wood), Math.cos(a) * .21, .33, Math.sin(a) * .21)));
    const sTop = at(M(new THREE.ConeGeometry(.17, .22, 20), sandM), 0, .45, 0), sBot = at(M(new THREE.ConeGeometry(.19, .22, 20), sandM), 0, .13, 0); hg.add(sTop, sBot);
    const piv = at(new THREE.Group(), .55, 1.41, -.1); hg.position.set(0, -.33, 0); piv.add(hg); G.add(piv);
    const peb = [...Array(9)].map((_, k) => { const p = M(new THREE.DodecahedronGeometry(.055, 0), mat(0x8c8478, { r: .7, flat: true })); G.add(p); return p; });
    const plate = at(M(new THREE.CylinderGeometry(.3, .24, .06, 24), mat(0x6e5a44, { r: .8 })), .1, 1.11, .35); G.add(plate);
    const scroll = at(M(new THREE.CylinderGeometry(.06, .06, .8, 12).rotateZ(Math.PI / 2), mat(COL.cream, { r: .9 })), -.1, 1.14, -.35); G.add(scroll);
    const F = figure(); at(F.G, 1.7, 0, .3); F.G.rotation.y = -1.4; G.add(F.G);
    return { G, mood: { key: .12, hemi: .15, rim: .5, fog: .05 }, update(s, K) {
      const fl = .85 + .15 * Math.sin(s.t * 17) * Math.sin(s.t * 7.3); L.intensity = 9 * fl; flame.scale.set(.45 * fl, .62 * fl, 1); halo.material.opacity = .4 * fl;
      const per = 2.6, k = Math.floor(s.lt / per), ph = s.lt / per - k, fu = sm((ph - .82) / .18); piv.rotation.z = (k + fu) * Math.PI;
      const fill = k % 2 ? 1 - ph : ph; sTop.scale.setScalar(Math.max(.05, 1 - Math.min(1, ph / .82))); sBot.scale.setScalar(Math.max(.05, Math.min(1, ph / .82)));
      peb.forEach((p, i) => { const t0 = .4 + i * .9, u = clamp((s.lt - t0) / .5); p.visible = s.lt > t0; const r = rng(i + 3); p.position.set(.1 + (r() - .5) * .3, lerp(2.4, 1.18 + r() * .04, u * u), .35 + (r() - .5) * .25); p.rotation.set(i, i * 2, s.lt * (1 - u) * 6); });
      F.rest(); F.breathe(s.t); F.head.rotation.x = .35; F.aR.rotation.x = -.9 + Math.sin(s.t * 2.2) * .25; F.aL.rotation.x = -.5;
      const a = -.5 + s.u * .7; K.cam(Math.sin(a) * 4.2, 2.1 - s.u * .3, Math.cos(a) * 4.2, .1, 1.25, 0); } }; },

  'cot-hy-lap'(o) { const G = new THREE.Group(), mar = mat(COL.marble, { p: 'marble', rep: [1, 2] });
    [[2.2, .25], [1.7, .5], [1.2, .75]].forEach(([r, y]) => G.add(at(M(new THREE.CylinderGeometry(r, r + .05, .25, 48), mar), 0, y - .125, 0)));
    const F = figure(); at(F.G, 0, .75, 0); G.add(F.G, ground(40, 0x161820));
    const cols = [...Array(8)].map((_, k) => { const a = Math.PI * (1.05 + k / 7 * .9), c = new THREE.Group(); c.add(at(M(fluted(.28, 3.7, 20, .03), mar), 0, 2.05, 0), at(M(lathe([[.36, 0], [.36, .08], [.3, .14], [.3, .2]], 32), mar), 0, .12, 0), at(M(lathe([[.3, 0], [.34, .06], [.42, .14], [.42, .18]], 32), mar), 0, 3.82, 0));
      c.add(at(M(roundedBox(.75, .18, .75), mar), 0, 4.08, 0), at(M(roundedBox(.7, .14, .7), mar), 0, .07, 0)); at(c, Math.cos(a) * 4.2, 0, Math.sin(a) * 4.2); G.add(c); return c; });
    const shaft = at(M(new THREE.CylinderGeometry(.6, 2.2, 9, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: .07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), false), 0, 5, 0);
    const sp = at(new THREE.SpotLight(0xffe0a0, 60, 20, .4, .5, 1.2), 0, 9, .5); sp.target.position.set(0, .8, 0); sp.castShadow = true; G.add(shaft, sp, sp.target);
    return { G, mood: { key: .5, rim: 1.4 }, update(s, K) { cols.forEach((c, k) => { c.position.y = -4.3 * (1 - eo3((s.lt - .3 - k * .35) / 1.2)); });
      F.rest(); F.breathe(s.t); const up = sm((s.lt - 1) / 1.5); F.aR.rotation.x = -2.6 * up; F.aR.rotation.z = .2; F.head.rotation.x = -.15 * up; shaft.material.opacity = .04 + .06 * up;
      K.cam(lerp(2.5, 4.5, sm(s.u)), lerp(1.2, 5.5, sm(s.u)), lerp(8.5, 7.5, s.u), 0, lerp(1.6, 1.4, s.u), 0); } }; },

  'cay-nho'(o) { const G = new THREE.Group(), wood = mat(COL.wood, { p: 'wood' });
    G.add(at(M(roundedBox(.14, 3, .14), wood), -2.2, 1.5, 0), at(M(roundedBox(.14, 3, .14), wood), 2.2, 1.5, 0), at(M(roundedBox(4.7, .12, .12), wood), 0, 2.95, 0), ground(30, 0x1d1a14));
    const pts = [[-2, 0, .15], [-2.05, .8, .2], [-1.9, 1.8, .15], [-2, 2.7, .2], [-1.3, 2.95, .25], [-.4, 2.75, .2], [.5, 3.0, .22], [1.3, 2.8, .2], [2.1, 2.95, .2]].map(p => new THREE.Vector3(...p));
    const curve = new THREE.CatmullRomCurve3(pts), tube = M(new THREE.TubeGeometry(curve, 240, .05, 8), mat(0x4b3420, { r: .8 })); G.add(tube); const total = tube.geometry.index.count;
    const leafM = mat(0x4c8a3a, { r: .6, side: THREE.DoubleSide }), r = rng(5);
    const leaves = [...Array(26)].map((_, k) => { const u = .06 + k / 26 * .92, p = curve.getPointAt(u), l = M(new THREE.SphereGeometry(.16, 10, 6), leafM); l.scale.set(1, .12, .8);
      l.position.copy(p).add(new THREE.Vector3((r() - .5) * .3, (r() - .3) * .25, (r() - .2) * .35)); l.rotation.set(r() * 1.2, r() * 6, r() * .8); l.userData.u = u; G.add(l); return l; });
    const clusters = [.5, .62, .74, .86, .96].map((u, k) => { const c = new THREE.Group(), p = curve.getPointAt(u); at(c, p.x, p.y - .25, p.z + .12);
      const gm = mat(0x5a8a35, { r: .25, m: .05 }); c.userData.m = gm;
      for (let i = 0; i < 14; i++) { const row = Math.floor(Math.sqrt(i * 2)), g = M(new THREE.SphereGeometry(.07, 12, 8), gm); const a = i * 2.4; g.position.set(Math.cos(a) * (.16 - row * .03), -row * .1, Math.sin(a) * (.16 - row * .03)); c.add(g); }
      const fl = at(glow(.5, 0xfff4e0, 0), 0, 0, 0); c.add(fl); c.userData.fl = fl; G.add(c); return c; });
    return { G, update(s, K) { const grow = sm(s.u / .45); tube.geometry.setDrawRange(0, Math.floor(total * grow / 6) * 6);
      leaves.forEach(l => { const v = clamp((grow - l.userData.u) / .08); l.visible = v > 0; l.scale.set(v, .12 * v, .8 * v); });
      clusters.forEach((c, k) => { const fl = sm((s.u - .42 - k * .02) / .1) * (1 - sm((s.u - .6) / .08)); c.userData.fl.material.opacity = fl * .9;
        const g = sm((s.u - .55 - k * .02) / .25); c.scale.setScalar(Math.max(.001, g)); c.userData.m.color.setHex(0x5a8a35).lerp(new THREE.Color(0x4a1f5c), sm((s.u - .72) / .2)); });
      const a = -.3 + s.u * .45; K.cam(Math.sin(a) * 11.5, 2.4 + s.u * .4, Math.cos(a) * 11.5, 0, 1.8, 0); } }; },

  'vach-dich'(o) { const G = new THREE.Group(), N = horse({ color: 0x6f665b, r: .95, m: 0, thick: .82, len: .96, mane: 0x3b342c }); G.add(N.G, ground(60));
    const track = at(M(new THREE.PlaneGeometry(40, 5.5).rotateX(-Math.PI / 2), mat(0x3a2f25, { r: .95 }), false), 0, .005, 0); G.add(track);
    [-1, 1].forEach(sz => G.add(at(M(new THREE.CylinderGeometry(.07, .07, 2.4, 10), mat(COL.cream, { r: .4 })), 0, 1.2, sz * 2.3)));
    const tapes = [-1, 1].map(sz => { const p = at(new THREE.Group(), 0, 1.5, sz * 2.3), t = at(M(roundedBox(.04, .1, 2.3), mat(COL.red, { e: COL.red, ei: .3 })), 0, 0, -sz * 1.15); p.add(t); G.add(p); return p; });
    if (o.bang) { const ban = textSprite(o.bang, { color: '#ffd36a', size: 170, sx: 2.2 }); at(ban, 0, 2.9, 0); G.add(ban); }
    const conf = points(160, .22, 0xffd070, (i, t, v) => { const r = rng(i + 11), dt = Math.max(0, t), a = r() * 6.28, sp = 1 + r() * 3; v.set(Math.cos(a) * sp * dt * .6, 1.4 + (2 + r() * 3) * dt - 2.5 * dt * dt, Math.sin(a) * sp * dt); }, { op: .95 });
    G.add(conf);
    return { G, mood: { key: 1.1 }, update(s, K) { const cross = s.D * .45, x = lerp(-6, 4, s.u); N.G.position.x = x; N.walk(s.lt * 4.6, .4);
      const b = s.lt - cross; tapes.forEach((p, k) => p.rotation.y = b > 0 ? (k ? -1 : 1) * Math.min(1.4, b * 3) : 0); conf.visible = b > 0 && b < 2.5; conf.tick(b);
      const up = sm((s.u - .55) / .45); K.cam(x + 1.5 - up * 1.5, lerp(1.8, 10, up), lerp(7.5, 6, up), lerp(x, 0, up * .5), lerp(1.1, 3 + up * 4, up), 0); } }; },

  'phong-ngu'(o) { const G = new THREE.Group(), wall = mat(0x2a2f3c, { r: .9 }), wood = mat(0x5a3d28, { p: 'wood-varnish' });
    G.add(at(M(roundedBox(2.2, 5, .3), wall), -2.6, 2.5, -2), at(M(roundedBox(2.2, 5, .3), wall), 2.6, 2.5, -2), at(M(roundedBox(3, 1.2, .3), wall), 0, .6, -2), at(M(roundedBox(3, 1.2, .3), wall), 0, 4.4, -2), ground(20, 0x1c1814));
    const winM = new THREE.MeshBasicMaterial({ color: 0x4a64a0 }), win = at(new THREE.Mesh(new THREE.PlaneGeometry(3, 2.6), winM), 0, 2.5, -2.1); G.add(win);
    G.add(at(M(roundedBox(.08, 2.6, .12), wood), 0, 2.5, -1.95), at(M(roundedBox(3, .08, .12), wood), 0, 2.5, -1.95));
    const sunL = at(new THREE.DirectionalLight(0x9fbaff, 2.5), 0, 4, -6); sunL.target.position.set(.5, 0, 2); sunL.castShadow = true; G.add(sunL, sunL.target);
    const curtains = [-1, 1].map(sx => { const g = new THREE.PlaneGeometry(1.1, 3.2, 12, 1), c = at(M(g, mat(0x8a2b22, { p: 'fabric', side: THREE.DoubleSide, rep: [3, 6] })), sx * 1.25, 2.6, -1.8); c.userData.p0 = g.attributes.position.array.slice(); G.add(c); return c; });
    const frame = at(M(roundedBox(2.4, .45, 3.6), wood), .9, .23, .6), mat1 = at(M(roundedBox(2.2, .3, 3.4), mat(0xe8e0d0, { p: 'fabric', rep: [4, 4] })), .9, .6, .6);
    const pil = at(M(new THREE.CapsuleGeometry(.22, .9, 4, 12).rotateZ(Math.PI / 2), mat(0xf2ede4, { p: 'fabric', rep: [2, 2] })), .9, .85, -.8); const blanket = at(M(roundedBox(2.3, .3, 2.4), mat(0x3d5a8a, { p: 'fabric', rep: [4, 4] })), .9, .82, 1.1);
    G.add(frame, mat1, pil, blanket); const F = figure(); F.G.rotation.x = -Math.PI / 2; at(F.G, .9, .95, 1.25); F.lL.visible = F.lR.visible = false; G.add(F.G);   // legs are under the blanket
    const motes = points(90, .06, 0xcfe0ff, (i, t, v) => { const r = rng(i + 21); v.set(-1.2 + r() * 2.6, .8 + ((r() * 3 + t * .05) % 3), -1.7 + r() * 3.6); }, { op: .6 }); G.add(motes);
    return { G, mood: { key: .15, hemi: .3, rim: .6, fog: .03 }, update(s, K) { const warm = sm((s.u - .3) / .7); winM.color.setHex(0x4a64a0).lerp(new THREE.Color(0xd99a5a), warm); sunL.color.copy(winM.color); sunL.intensity = 2 + warm * 2;
      curtains.forEach((c, k) => { const p = c.geometry.attributes.position, p0 = c.userData.p0; for (let i = 0; i < p.count; i++) p.setZ(i, p0[i * 3 + 2] + Math.sin(p0[i * 3] * 5 + s.t * 1.4 + k) * .08 * (.5 - p0[i * 3 + 1] / 3.2)); p.needsUpdate = true; });
      F.rest(); F.breathe(s.t); F.aR.rotation.z = sm((s.u - .7) / .2) * 1.3; motes.tick(s.t);
      K.cam(lerp(4.8, 3.6, sm(s.u)), lerp(2.6, 2.2, s.u), lerp(5.5, 4.4, sm(s.u)), .6, 1.2, -.2); } }; },

  'so-tay'(o) { const G = new THREE.Group(), desk = at(M(roundedBox(6, .2, 4), mat(0x4a3322, { p: 'wood-varnish', rep: [2, 1] })), 0, -.1, 0); G.add(desk);
    const cover = at(M(roundedBox(3.3, .08, 2.3), mat(0x5c2a1a, { p: 'leather' })), 0, .04, 0); G.add(cover);
    const page = sx => { const g = new THREE.PlaneGeometry(1.55, 2.1, 16, 1).rotateX(-Math.PI / 2), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setY(i, Math.sin((x / 1.55 + .5) * Math.PI) * .08); } g.computeVertexNormals();
      return at(M(g, mat(0xefe3c4, { p: 'paper', side: THREE.DoubleSide })), sx * .8, .1, 0); }; G.add(page(-1), page(1));
    const lines = [...Array(9)].map((_, k) => { const l = at(M(roundedBox(1.2, .005, .045), mat(COL.gold, { e: 0xffb648, ei: 1.6, m: .5 }), false), 0, .19, -.8 + k * .2); l.geometry.translate(.6, 0, 0); l.position.x = .2; G.add(l); return l; });
    const lL = [...Array(9)].map((_, k) => { const l = at(M(new THREE.BoxGeometry(1.1 - (k % 3) * .2, .004, .035), mat(0x3a2a1a, { r: .9 }), false), -.8, .19, -.8 + k * .2); G.add(l); return l; });
    const quill = new THREE.Group(); quill.add(at(M(new THREE.ConeGeometry(.12, 1.1, 8), mat(0xf4efe6, { r: .8 })), 0, .55, 0)); quill.rotation.set(.5, 0, -.5); G.add(quill);
    const cand = at(M(new THREE.CylinderGeometry(.14, .14, .7, 20), mat(0xf1e6cf, { p: 'wax', r: .5 })), -2.2, .35, -1), fl = at(glow(.45, 0xffb050, 1), -2.2, .8, -1), L = at(new THREE.PointLight(0xffb060, 6, 8, 1.5), -2.2, 1, -1);
    L.castShadow = true; G.add(cand, fl, L);
    return { G, mood: { key: .2, hemi: .2, rim: .5 }, update(s, K) { const w = clamp(s.lt / Math.max(2, s.D * .85)) * lines.length; let tip = null;
      lines.forEach((l, k) => { const v = clamp(w - k); l.scale.x = Math.max(.001, v); l.visible = v > 0; if (v > 0 && v < 1) tip = new THREE.Vector3(.2 + 1.2 * v, .2, -.8 + k * .2); });
      if (!tip) tip = new THREE.Vector3(1.4, .2, .8); quill.position.copy(tip).add(new THREE.Vector3(Math.sin(s.t * 18) * .015, 0, 0)); const fk = .9 + .1 * Math.sin(s.t * 15); L.intensity = 6 * fk; fl.scale.set(.4 * fk, .55 * fk, 1);
      K.cam(lerp(1.2, .6, s.u), lerp(4.6, 3.6, sm(s.u)), lerp(3.6, 2.7, sm(s.u)), .3, 0, -.1); } }; },

  'to-ong'(o) { const G = new THREE.Group(), cells = [], wax = mat(0xd9a03a, { r: .35, m: .2 }), honey = mat(0xffb030, { e: 0xff9a20, ei: .9, r: .2 });
    for (let q = -4; q <= 4; q++) for (let r = -4; r <= 4; r++) { const s3 = -q - r; if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s3)) > 4) continue;
      const x = .9 * (q + r / 2) * 1.0, z = .9 * r * .866, d = Math.max(Math.abs(q), Math.abs(r), Math.abs(s3)), c = new THREE.Group();
      c.add(M(new THREE.CylinderGeometry(.5, .5, 1, 6, 1, true), mat(0xd9a03a, { p: 'wax', side: THREE.DoubleSide })));
      if ((q * 7 + r * 3 + 40) % 3 === 0) c.add(at(M(new THREE.CylinderGeometry(.44, .44, .9, 6), honey), 0, -.05, 0));
      c.rotation.y = Math.PI / 6; at(c, x, 0, z); c.userData.d = d + ((q * 13 + r * 7 + 50) % 5) * .12; cells.push(c); G.add(c); }
    G.add(ground(30, 0x1a140c));
    const bees = [...Array(9)].map((_, k) => { const b = new THREE.Group(), y = mat(0xf2c12e, { r: .4 }), bl = mat(0x1a1410, { r: .5 });
      const bd = M(new THREE.SphereGeometry(.12, 14, 10), y); bd.scale.set(1.5, 1, 1); b.add(bd); [-.06, .06].forEach(x => { const st = at(M(new THREE.CylinderGeometry(.122, .122, .04, 14).rotateZ(Math.PI / 2), bl), x, 0, 0); st.scale.set(1, 1, 1); b.add(st); });
      const wg = [-1, 1].map(s => { const w = at(M(new THREE.SphereGeometry(.12, 10, 6), mat(0xffffff, { op: .5, r: .1, dw: false }), false), 0, .1, s * .12); w.scale.set(.7, .08, 1); b.add(w); return w; });
      b.userData = { wg, k }; G.add(b); return b; });
    return { G, update(s, K) { cells.forEach(c => { const u = eo3((s.lt - .2 - c.userData.d * .45) / .6); c.scale.set(1, Math.max(.001, u), 1); c.position.y = .5 * u - .02; });
      bees.forEach(b => { const k = b.userData.k, a = s.t * (.8 + k * .07) + k * .7, R = 2 + (k % 3) * 1.1; b.position.set(Math.cos(a) * R, 1.6 + Math.sin(s.t * 1.7 + k) * .4 + (k % 2) * .5, Math.sin(a) * R); b.rotation.y = -a - Math.PI / 2;
        b.userData.wg.forEach((w, i) => w.rotation.x = Math.sin(s.t * 60 + k) * .6 * (i ? 1 : -1)); });
      const a = .4 + s.u * .6; K.cam(Math.sin(a) * 7, 5.5 - s.u * 1.5, Math.cos(a) * 7, 0, .4, 0); } }; },

  'leu-tuyet'(o) { const G = new THREE.Group(); G.add(ground(60, 0x8a95ab));
    const tent = (x, z, s, lit) => { const g = new THREE.Group(); const t = M(new THREE.ConeGeometry(1.7, 2.3, 4, 1), mat(0x7d6a4e, { p: 'fabric', flat: true, e: 0xff8030, ei: lit ? .1 : .0, rep: [3, 3] })); t.position.y = 1.15; t.rotation.y = Math.PI / 4; g.add(t);
      const door = at(M(new THREE.PlaneGeometry(.7, 1.1), new THREE.MeshBasicMaterial({ color: lit ? 0xffa050 : 0x3a2a1a })), 0, .55, 1.21); door.rotation.x = -.38; g.add(door);
      if (lit) { const L = at(new THREE.PointLight(0xff9a40, 8, 7, 1.6), 0, .8, 1.6); g.add(L); g.add(at(glow(2.2, 0xff9a40, .5), 0, .6, 1.3)); } at(g, x, 0, z); g.scale.setScalar(s); G.add(g); return g; };
    tent(0, 0, 1, true); tent(-4.5, -4, .9, false); tent(4, -5, .9, true); tent(-1.5, -9, .8, false);
    const pole = at(M(new THREE.CylinderGeometry(.04, .04, 3.4, 8), mat(0x3a2a1a)), 1.6, 1.7, .6); G.add(pole);
    const flag = at(M(new THREE.PlaneGeometry(.9, .55, 10, 1), mat(0x8a1f1a, { p: 'fabric', side: THREE.DoubleSide })), 2.05, 3.1, .6); flag.userData.p0 = flag.geometry.attributes.position.array.slice(); G.add(flag);
    const snow = points(1400, .07, 0xffffff, (i, t, v) => { const r = rng(i + 31); v.set(-8 + r() * 16 + Math.sin(t * .7 + i) * .3, 8 - ((r() * 8 + t * (.6 + r() * .5)) % 8), -10 + r() * 16); }, { op: .85 }); G.add(snow);
    return { G, mood: { key: .35, hemi: .55, rim: 1, fog: .045, bg: 0x0b1222 }, update(s, K) { snow.tick(s.t);
      const p = flag.geometry.attributes.position, p0 = flag.userData.p0; for (let i = 0; i < p.count; i++) p.setZ(i, p0[i * 3 + 2] + Math.sin(p0[i * 3] * 5 - s.t * 5) * .08 * (p0[i * 3] + .45)); p.needsUpdate = true;
      K.cam(lerp(4.5, 3, sm(s.u)), lerp(2.2, 1.7, s.u), lerp(11, 8, sm(s.u)), 0, 1.3, -2); } }; },

  'de-kiem'(o) { const G = new THREE.Group(), iron = mat(0x4a4e58, { p: 'iron' });
    const anv = M(plate([[-.95, .7], [1.2, .7], [1.2, .98], [-.95, .98], [-1.15, .9], [-.95, .82], [-.35, .62], [-.3, .25], [-.55, 0], [.55, 0], [.3, .25], [.35, .62]], .62, { bevel: .03 }), iron);
    const horn = M(taper([[1.18, .86, 0], [1.6, .84, 0], [1.95, .8, 0]], u => .14 * (1 - u) + .01, { seg: 24, radial: 16, rz: u => .2 * (1 - u) + .01 }), iron);
    G.add(anv, horn, at(M(new THREE.CylinderGeometry(.9, 1.1, .2, 6), mat(0x3a2a1e, { r: .9 })), 0, .1, 0), ground(30, 0x14110e));
    const bladeM = mat(0x9ea3aa, { p: 'steel', r: .25, e: 0xff5a10, ei: 2 }), bl = M(blade(2.1, .24, .05), bladeM); bl.rotation.x = -Math.PI / 2; at(bl, -.9, 1.02, 0); G.add(bl);
    G.add(at(M(roundedBox(.12, .1, .7), mat(0x6b4a2a)), -1.0, 1.05, 0), at(M(new THREE.CylinderGeometry(.05, .05, .6, 10).rotateZ(Math.PI / 2), mat(0x4a2f1c)), -1.35, 1.05, 0));
    const hp = at(new THREE.Group(), -.1, 1.6, -1.2); hp.add(at(M(new THREE.CylinderGeometry(.05, .05, 1.3, 10), mat(0x5a3d26)), 0, 0, .65).rotateX(Math.PI / 2)); hp.add(at(M(roundedBox(.28, .28, .5), iron), 0, 0, 1.3)); G.add(hp);
    const flash = at(new THREE.PointLight(0xffa040, 0, 6, 1.5), .1, 1.4, 0), heat = at(new THREE.PointLight(0xff5010, 4, 4, 1.5), .1, 1.25, 0); G.add(flash, heat);
    const per = .95, sparks = points(220, .09, 0xffc060, (i, t, v) => { const n = Math.floor(t / per), dt = t - n * per, r = rng(i + n * 977), a = r() * 6.28, sp = 1.5 + r() * 3.5;
      v.set(.1 + Math.cos(a) * sp * dt, 1.1 + (1 + r() * 3) * dt - 4.9 * dt * dt, Math.sin(a) * sp * dt * .7); if (dt > .6 * r() + .2) v.set(0, -10, 0); }); G.add(sparks);
    return { G, mood: { key: .25, hemi: .2, rim: 1.2 }, update(s, K) { const ph = (s.lt % per) / per, swing = ph < .75 ? sm(ph / .75) : 1 - sm((ph - .75) / .25) * 1;
      hp.rotation.x = lerp(1.15, -.32, ph < .78 ? Math.pow(ph / .78, 3) : 1 - (ph - .78) / .22); const hit = ph < .78 ? 0 : 1 - (ph - .78) / .22; flash.intensity = hit * 25;
      const cool = sm(s.u); bladeM.emissiveIntensity = lerp(2.4, .25, cool) + hit * .4; heat.intensity = lerp(5, .8, cool); sparks.tick(s.lt + per * .78 - .0); sparks.visible = s.lt > per * .78;
      K.cam(lerp(3, 2.2, s.u), lerp(2.4, 1.9, s.u), lerp(6.5, 5.2, sm(s.u)), .2, .95, 0); } }; },

  'vang-lua'(o) { const G = new THREE.Group(), r = rng(9); G.add(ground(30, 0x120e0b));
    const coal = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.16, 0), mat(0x1c1410, { p: 'coal', e: 0xff3a08, ei: .8, flat: true }), 90), dm = new THREE.Object3D();
    for (let i = 0; i < 90; i++) { const a = r() * 6.28, R = Math.sqrt(r()) * 1.3; dm.position.set(Math.cos(a) * R, .08 + r() * .12, Math.sin(a) * R); dm.rotation.set(r() * 3, r() * 3, 0); dm.scale.setScalar(.7 + r() * .6); dm.updateMatrix(); coal.setMatrixAt(i, dm.matrix); } G.add(coal);
    const g = new THREE.BoxGeometry(1.3, .38, .62, 1, 1, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * .82); p.setZ(i, p.getZ(i) * .75); } g.computeVertexNormals();
    const goldM = mat(0xf2c14e, { p: 'gold', e: 0xff4a10, ei: 2.2 }), bar = at(M(g, goldM), 0, .45, 0); G.add(bar);
    const flames = [...Array(26)].map((_, k) => { const f = glow(1, k % 3 ? 0xff7a20 : 0xffc050, .8); G.add(f); return f; });
    const L = at(new THREE.PointLight(0xff6a20, 12, 8, 1.4), 0, 1.2, .3); G.add(L);
    return { G, mood: { key: .3, hemi: .25, rim: 1.4, env: .6 }, update(s, K) { const lift = sm((s.u - .55) / .3), cool = sm((s.u - .5) / .4);
      flames.forEach((f, k) => { const rr = rng(k + 5), ph = (s.t * (1.2 + rr() * .8) + rr()) % 1, a = rr() * 6.28, R = rr() * 1.1; f.position.set(Math.cos(a) * R, .2 + ph * 1.8, Math.sin(a) * R); const sc = (1 - ph) * (.7 + rr() * .6) * (1 - lift * .8); f.scale.set(sc, sc * 1.5, 1); f.material.opacity = .7 * (1 - ph); });
      goldM.emissiveIntensity = lerp(2.2, 0, cool); bar.position.y = .45 + lift * 1.3; bar.rotation.y = s.t * .4 + lift * 1.2; bar.rotation.z = lift * .25; L.intensity = 12 * (1 - lift * .5) * (.9 + .1 * Math.sin(s.t * 13));
      const a = s.u * 1.2; K.cam(Math.sin(a) * 3.6, 1.6 + lift * .8, Math.cos(a) * 3.6, 0, .6 + lift * 1.1, 0); } }; },

  'binh-minh'(o) { const G = new THREE.Group();
    const skyM = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { k: { value: 0 } }, vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'uniform float k; varying vec3 vP; void main(){ float h = vP.y; vec3 night = mix(vec3(.03,.05,.12), vec3(.01,.02,.06), clamp(h*2.,0.,1.)); vec3 dawn = mix(vec3(.62,.3,.12), vec3(.12,.17,.36), clamp(h*2.5,0.,1.)); vec3 c = mix(night, dawn, k); c += vec3(.8,.45,.2) * pow(max(0., dot(vP, normalize(vec3(0.,.05,-1.)))), 24.) * k; gl_FragColor = vec4(c,1.); }' });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 32, 16), skyM); G.add(sky);
    const hill = new THREE.PlaneGeometry(80, 80, 80, 80).rotateX(-Math.PI / 2), hp = hill.attributes.position; for (let i = 0; i < hp.count; i++) { const x = hp.getX(i), z = hp.getZ(i); hp.setY(i, Math.sin(x * .15) * .8 + Math.cos(z * .2 + x * .05) * .7 + Math.exp(-(x * x + (z - 1) * (z - 1)) / 6) * .8 - .8); } hill.computeVertexNormals();
    G.add(M(hill, mat(0x1a1d22, { r: .95 })));
    const sunM = new THREE.MeshBasicMaterial({ color: 0xffb35a }), sunS = at(new THREE.Mesh(new THREE.SphereGeometry(3, 32, 16), sunM), 0, -4, -60), sg = at(glow(40, 0xffa050, .9), 0, -4, -59); G.add(sunS, sg);
    const F = figure({ color: 0x2a2420 }); at(F.G, 0, 0, 1); F.G.rotation.y = Math.PI; G.add(F.G);
    const sunL = at(new THREE.DirectionalLight(0xffb070, 0), 0, 3, -40); G.add(sunL);
    return { G, mood: { key: .1, hemi: .3, rim: .4, fog: .012 }, update(s, K) { const k = sm(s.u / .8); skyM.uniforms.k.value = k; sunS.position.y = lerp(-4, 6, eo3(s.u)); sg.position.y = sunS.position.y; sg.material.opacity = .4 + .5 * k; sunL.intensity = 3 * k;
      F.rest(); F.breathe(s.t); const up = sm((s.u - .55) / .3); F.aL.rotation.z = -.12 - 2.4 * up; F.aR.rotation.z = .12 + 2.4 * up; F.head.rotation.x = -.25 * up;
      K.cam(lerp(1.5, .4, s.u), lerp(1.4, 2.8, sm(s.u)), lerp(6, 7.5, s.u), 0, lerp(1.4, 2.4, s.u), -10); } }; },

  'nui-dat'(o) { const G = new THREE.Group(), xong = !!o.xong, pts = [];
    for (let i = 0; i <= 24; i++) { const h = i / 24 * 2.7; pts.push(new THREE.Vector2(Math.max(.42, 3.4 * Math.pow(1 - h / 3.15, 1.25)), h)); } pts.push(new THREE.Vector2(.3, 2.62), new THREE.Vector2(.001, 2.58));
    const mound = M(bumpy(new THREE.LatheGeometry(pts, 64), .08, 3, 2.2), mat(COL.earth, { p: 'earth', flat: true, rep: [3, 3] })); G.add(mound, ground(40, 0x18140f)); G.scale.setScalar(.75);
    const cap = at(M(bumpy(new THREE.ConeGeometry(.48, .7, 24, 3), .04, 7, 4), mat(0x8a6644, { r: 1, flat: true })), 0, 3.0, 0); G.add(cap);
    const F = figure(), bk = basket(); at(bk, .35, 1.75, 0); F.G.add(bk); G.add(F.G);
    const burst = at(glow(9, 0xffd080, 0), 0, 3.4, -1.5); G.add(burst); const dust = points(80, .12, 0xc8a070, (i, t, v) => { const r = rng(i + 2), dt = t % 1; v.set((r() - .5) * .8 * dt * 2, 2.8 + .5 * dt - 1.2 * dt * dt, (r() - .5) * .8 * dt * 2); }, { op: .5 }); G.add(dust);
    return { G, mood: { key: .9 }, update(s, K) { F.rest();
      if (xong) { const put = sm((s.u - .25) / .35); at(F.G, .7, 2.55, .5); F.G.rotation.y = -.8; F.aR.rotation.x = -1.6 * (1 - put * .3); bk.rotation.z = -put * 1.6; cap.scale.setScalar(Math.max(.001, put)); cap.position.y = 2.55 + .35 * put;
        burst.material.opacity = sm((s.u - .55) / .3) * .9; dust.visible = put > 0 && put < 1; dust.tick(s.t);
        const a = .4 + s.u * .5; K.cam(Math.sin(a) * 9, 2.5 + s.u * 2, Math.cos(a) * 9, 0, 2.4, 0); }
      else { cap.visible = false; dust.visible = false; const w = s.lt * .5; at(F.G, Math.cos(-w) * 3.6, 0, Math.sin(-w) * 3.6 + .0); F.G.rotation.y = w + Math.PI; F.walk(s.lt * 5, .45); F.aR.rotation.x = -2.6;
        const a = -.2 + s.u * .4; K.cam(Math.sin(a) * 10, 2 + s.u * 2.5, Math.cos(a) * 10, 0, 1.8 + s.u * .6, 0); } } }; },

  'nhiet-ke'(o) { const G = new THREE.Group(); G.add(ground(20, 0x161515));
    G.add(at(M(roundedBox(2.6, .8, 2), mat(0x2b2b2e, { r: .5, m: .6 })), 0, .4, 0)); const ring = at(M(new THREE.TorusGeometry(.75, .06, 8, 32).rotateX(Math.PI / 2), mat(0x1a1a1a, { e: 0xff3a10, ei: .9 })), 0, .82, 0); G.add(ring);
    G.add(at(M(new THREE.CylinderGeometry(.95, .85, 1.1, 40, 1, true), mat(0x9aa0a8, { p: 'brushed-steel', side: THREE.DoubleSide })), 0, 1.4, 0));
    const water = at(M(new THREE.CircleGeometry(.92, 40).rotateX(-Math.PI / 2), mat(0x8fb0c8, { r: .08, m: .3 })), 0, 1.75, 0); water.userData.p0 = water.geometry.attributes.position.array.slice(); G.add(water);
    const th = at(new THREE.Group(), 1.9, 0, .2); G.add(th);
    th.add(at(M(new THREE.CylinderGeometry(.12, .12, 3.2, 20), mat(0xe8f0ff, { r: .05, op: .22, dw: false }), false), 0, 2.0, 0), at(M(new THREE.SphereGeometry(.24, 20, 14), mat(0xd02818, { e: 0xff2010, ei: .6 })), 0, .3, 0));
    const col = at(M(new THREE.CylinderGeometry(.06, .06, 1, 12), mat(0xd02818, { e: 0xff2010, ei: .7 })), 0, .5, 0); col.geometry.translate(0, .5, 0); th.add(col);
    for (let i = 0; i <= 10; i++) th.add(at(M(roundedBox(i % 5 ? .1 : .2, .02, .02), mat(0xffffff, { e: 0xffffff, ei: .3 }), false), .2, .5 + i * .28, 0));
    const lab = textSprite('20°C', { color: '#ffffff', size: 150, sx: 1.6 }); at(lab, .3, 3.3, .6); G.add(lab);
    const steam = [...Array(10)].map((_, k) => { const g = glow(1.2, 0xdfe8ff, 0, 'w'); G.add(g); return g; });
    return { G, mood: { key: .6 }, update(s, K) { const tmp = Math.round(lerp(20, 99, eo3(s.u / .75))); col.scale.y = .02 + (tmp - 20) / 80 * 2.75; lab.set(`${tmp}°C`);
      const p = water.geometry.attributes.position, p0 = water.userData.p0, j = sm((s.u - .6) / .4) * .015; for (let i = 0; i < p.count; i++) p.setY(i, p0[i * 3 + 1] + Math.sin(p0[i * 3] * 9 + s.t * 4) * Math.cos(p0[i * 3 + 2] * 7 - s.t * 3) * j); p.needsUpdate = true;
      steam.forEach((g, k) => { const rr = rng(k + 1), ph = (s.t * .25 + rr()) % 1; g.position.set((rr() - .5) * 1.2, 1.9 + ph * 2, (rr() - .5) * 1.2); g.material.opacity = (tmp - 60) / 40 * .2 * Math.sin(ph * Math.PI); });
      K.cam(lerp(1.6, 2, s.u), lerp(2.9, 2.6, s.u), lerp(8.2, 7, sm(s.u)), .9, 1.9, 0); } }; },

  'ngu-cong'(o) { const G = new THREE.Group(), rock = mat(0x5d5a58, { p: 'stone', flat: true, rep: [3, 3] });
    [[-5, -9, 7, 10], [5.5, -11, 8, 11.5]].forEach(([x, z, r, h], k) => { const m = M(bumpy(new THREE.ConeGeometry(r, h, 40, 14), .5, k + 11, .7), rock); at(m, x, h / 2 - .3, z); G.add(m);
      const snow = M(bumpy(new THREE.ConeGeometry(r * .28, h * .28, 30, 4), .12, k + 3, 1.5), mat(0xe8ecf4, { p: 'snow', flat: true })); at(snow, x, h - .3 - h * .14 + .02, z); G.add(snow); });
    G.add(ground(80, 0x2a2620)); const house = new THREE.Group(); house.add(at(M(roundedBox(1.4, .9, 1.1), mat(0x8a7356, { r: .9 })), 0, .45, 0), at(M(new THREE.ConeGeometry(1.1, .7, 4).rotateY(Math.PI / 4), mat(0x4a3a2a, { r: .9 })), 0, 1.25, 0)); at(house, -2.6, 0, 1.2); G.add(house);
    const F = figure({ size: .62 }), yoke = new THREE.Group(); yoke.add(at(M(new THREE.CylinderGeometry(.03, .03, 1.6, 8).rotateZ(Math.PI / 2), mat(0x6b4a32)), 0, 0, 0));
    [-1, 1].forEach(s => { const b = basket(); at(b, s * .75, -.55, 0); yoke.add(b, at(M(new THREE.CylinderGeometry(.01, .01, .5, 4), mat(0x3a2a1a)), s * .75, -.25, 0)); }); at(yoke, 0, 1.5, 0); yoke.rotation.y = Math.PI / 2; F.G.add(yoke); G.add(F.G);
    return { G, mood: { key: .9, fog: .02 }, update(s, K) { const per = 6, ph = (s.lt % per) / per, dir = ph < .5 ? 1 : -1, x = ph < .5 ? lerp(-1.2, 1.6, ph * 2) : lerp(1.6, -1.2, (ph - .5) * 2);
      at(F.G, x, 0, 1.6 - Math.abs(Math.sin(ph * Math.PI)) * 1.2); F.G.rotation.y = dir > 0 ? Math.PI * .6 : -Math.PI * .4; F.walk(s.lt * 6, .45); F.aL.rotation.x = -.6; F.aR.rotation.x = -.6; yoke.rotation.z = Math.sin(s.lt * 6) * .05;
      K.cam(lerp(1.5, .5, s.u), lerp(1.2, 2.4, sm(s.u)), lerp(10, 8, sm(s.u)), 0, lerp(3.5, 4.5, s.u), -6); } }; },

  'the-he'(o) { const G = new THREE.Group(), rock = mat(0x5d5a58, { p: 'stone', flat: true, rep: [3, 3] });
    const mtn = M(bumpy(new THREE.ConeGeometry(7, 10, 40, 14), .5, 11, .7), rock); at(mtn, -4, 0, -12); mtn.geometry.translate(0, 5, 0); G.add(mtn, ground(80, 0x2a2620));
    const n = 9, figs = [...Array(n)].map((_, k) => { const F = figure({ size: [.62, .9, 1, .95, .8, 1.02, .7, .98, .85][k], color: [0xd8c3a0, 0xc9b08a, 0xe2d1b3][k % 3] }); const p = new THREE.Vector3(lerp(-3, 2.5, k / (n - 1)), 0, lerp(-8, 2.5, k / (n - 1)));
      F.G.position.copy(p); F.G.rotation.y = Math.atan2(-5.5, -10.5) + Math.PI; F.p = p; G.add(F.G); return F; });
    const bks = [...Array(4)].map(() => { const b = basket(); G.add(b); return b; });
    return { G, mood: { key: .55, hemi: 1.3, fog: .022 }, update(s, K) { mtn.scale.set(1, lerp(1, .55, sm(s.u)), 1);
      figs.forEach((F, k) => { const v = back((s.lt - .2 - k * .45) / .5, 1.2); F.G.scale.setScalar(Math.max(.001, v) * [.62, .9, 1, .95, .8, 1.02, .7, .98, .85][k]); F.rest(); F.aL.rotation.x = F.aR.rotation.x = -1 + Math.sin(s.t * 3 + k) * .25; });
      bks.forEach((b, j) => { const f = ((s.lt * .9 + j * (n - 1) / 4) % (n - 1)), i = Math.floor(f), u = f - i, a = figs[i].p, c = figs[Math.min(n - 1, i + 1)].p; b.position.lerpVectors(a, c, u); b.position.y = 1.3 + Math.sin(u * Math.PI) * .4; b.visible = s.lt > 4; });
      K.cam(lerp(6, 4.5, s.u), lerp(2.2, 3.4, sm(s.u)), lerp(6.5, 3.5, sm(s.u)), lerp(0, -1.5, s.u), 1, lerp(-1, -5, s.u)); } }; },

  'giot-nuoc'(o) { const G = new THREE.Group(), stone = mat(0x625d56, { r: .8, flat: false });
    const body = at(M(new THREE.CylinderGeometry(2.1, 2.3, 1.4, 48, 3, true), stone), 0, -.72, 0); G.add(body, at(ground(30, 0x101318), 0, -1.42, 0));
    const lathe = (depth, sig) => { const pts = []; for (let i = 40; i >= 0; i--) { const r = i / 40 * 2.1; pts.push(new THREE.Vector2(Math.max(.0005, r), -depth * Math.exp(-r * r / (sig * sig * 2)))); } return new THREE.LatheGeometry(pts, 96); };
    const top = M(lathe(.03, .1), mat(0x5f5a53, { p: 'stone', rep: [2, 2] }), false); top.receiveShadow = false; G.add(top);
    const pool = at(M(new THREE.CircleGeometry(.5, 40).rotateX(-Math.PI / 2), mat(0x9fc2e0, { r: .02, m: .4, op: .55, dw: false }), false), 0, 0, 0); G.add(pool);
    const drop = M(new THREE.SphereGeometry(.045, 16, 12), mat(0xcfe6ff, { r: .02, m: .3, op: .9 })); drop.scale.y = 1.6; G.add(drop);
    const ring = M(new THREE.TorusGeometry(1, .012, 6, 48).rotateX(Math.PI / 2), mat(0xdff0ff, { e: 0x9fd0ff, ei: .6, op: .8, dw: false }), false); G.add(ring);
    const spl = points(30, .06, 0xcfe6ff, (i, t, v) => { const r = rng(i + 4), a = r() * 6.28, sp = .5 + r(); v.set(Math.cos(a) * sp * t, .5 * (1 + r() * 2) * t - 4.9 * t * t, Math.sin(a) * sp * t); }); G.add(spl);
    const tip = at(M(new THREE.ConeGeometry(.12, .5, 10).rotateX(Math.PI), mat(0x4a4744, { r: .9 })), 0, 4.2, 0); G.add(tip);
    return { G, mood: { key: 1, rim: 1.4, hemi: .5 }, update(s, K) { const depth = .03 + .3 * sm(s.u), sig = .1 + .12 * s.u;
      top.geometry.dispose(); top.geometry = lathe(depth, sig);
      pool.visible = false;
      const per = 1.1, ph = (s.lt % per) / per, fall = clamp(ph / .55); drop.visible = ph < .55; drop.position.set(0, lerp(4, -depth, fall * fall), 0);
      const sp = clamp((ph - .55) / .45); ring.visible = ph > .55; ring.scale.setScalar(.1 + sp * 1.3); ring.position.y = -depth + .03; ring.material.opacity = (1 - sp) * .8; spl.visible = ph > .55 && ph < .9; spl.position.y = -depth; spl.tick((ph - .55) * per);
      K.cam(lerp(3.2, 2.5, s.u), lerp(3.6, 2.8, sm(s.u)), lerp(3.2, 2.5, s.u), 0, -.2, 0); } }; },

  'duc-da'(o) { const G = new THREE.Group(), slab = at(M(bumpy(new THREE.BoxGeometry(4, 5, .6, 16, 20, 2), .03, 5, 4), mat(0x8c8579, { r: .9 })), 0, 2.5, 0); G.add(slab, ground(30, 0x15130f));
    const pts = []; for (let i = 0; i <= 160; i++) { const a = i / 160 * Math.PI * 6, R = .15 + i / 160 * 1.45; pts.push(new THREE.Vector3(Math.cos(a) * R, 2.6 + Math.sin(a) * R * 1.15, .31)); }
    const curve = new THREE.CatmullRomCurve3(pts), tube = M(new THREE.TubeGeometry(curve, 600, .045, 6), mat(COL.gold, { e: 0xffb040, ei: 1.5, m: .6, r: .3 }), false), total = tube.geometry.index.count; G.add(tube);
    const groove = M(new THREE.TubeGeometry(curve, 600, .07, 6), mat(0x3a352e, { r: 1 }), false); groove.position.z = -.06; G.add(groove);
    const chisel = new THREE.Group(); chisel.add(at(M(new THREE.CylinderGeometry(.05, .05, .9, 10), mat(0x8a8f96, { p: 'steel', r: .3 })), 0, .45, 0), at(M(new THREE.CylinderGeometry(.09, .09, .25, 12), mat(0x5a3d26)), 0, .95, 0)); chisel.rotation.set(.9, 0, -.5); G.add(chisel);
    const chips = points(60, .07, 0xd8cfc0, (i, t, v) => { const n = Math.floor(t / .45), dt = t - n * .45, r = rng(i + n * 131), a = r() * 6.28; v.set(Math.cos(a) * dt * 1.2, Math.sin(a) * dt * .8 + 1.5 * dt - 4.9 * dt * dt, .4 + r() * dt * 1.5); }, { op: .8 }); G.add(chips);
    return { G, mood: { key: .55, rim: 1.2 }, update(s, K) { const pr = sm(s.u / .92); const c = Math.floor(total * pr / 6) * 6; tube.geometry.setDrawRange(0, c); groove.geometry.setDrawRange(0, c);
      const tp = curve.getPointAt(Math.max(.001, pr)); chisel.position.copy(tp).add(new THREE.Vector3(0, 0, Math.abs(Math.sin(s.t * 14)) * .08)); chips.position.copy(tp); chips.tick(s.t);
      K.cam(lerp(1.2, -.6, s.u) + tp.x * .3, lerp(2.4, 2.8, s.u), lerp(5.5, 4, sm(s.u)), tp.x * .3, 2.6, 0); } }; },

  // a brick factory compound burning at night (Edison, West Orange, Dec 1914): saw-tooth roofs, a chimney, windows glowing, roaring flames,
  // embers and smoke; an old man in the foreground watches with his hands behind his back.
  // { xay: true } → morning after: the same buildings rebuilt, warm lit windows, a clean chimney plume, the man walks toward the gate
  // { ngay: [0, 21] } → day counter "NGÀY n" over the roofs (with xay) · { gan: true } closer camera on the man
  'chay-xuong'(o) { const G = new THREE.Group(), xay = !!o.xay, r = rng(41), brick = mat(xay ? 0x8a4a34 : 0x3a2620, { p: 'stone', rep: [3, 2] }), roofM = mat(xay ? 0x4a4e58 : 0x1a1616, { p: 'iron' });
    G.add(ground(80, xay ? 0x3a3a36 : 0x100c0a));
    const wins = [], builds = [[-5.5, -7, 4.2, 3.2, 5], [0, -9, 6.5, 4.2, 6], [5.8, -7.5, 4.6, 3.4, 5], [-2.6, -14, 5, 5.2, 5], [3.4, -14.5, 5.5, 4.6, 5]];
    builds.forEach(([x0, z0, w, h, d], k) => { const b = at(M(new THREE.BoxGeometry(w, h, d), brick), x0, h / 2, z0); G.add(b);
      for (let i = 0; i < 3; i++) { const t0 = M(new THREE.ConeGeometry(.9, .9, 4, 1).rotateY(Math.PI / 4), roofM); t0.scale.set(w / 3 / 1.25, 1, d / 1.25); at(t0, x0 - w / 3 + i * w / 3, h + .45, z0); G.add(t0); }
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const wm = std(0x1a1410, { e: xay ? 0xffc070 : 0xff5a10, ei: 0 }); const wq = at(M(new THREE.PlaneGeometry(w * .14, h * .2), wm, false), x0 - w * .36 + i * w * .24, h * (.3 + j * .38), z0 + d / 2 + .01); G.add(wq); wins.push({ wm, k, ph: r() * 6 }); } });
    const chim = at(M(new THREE.CylinderGeometry(.45, .6, 9, 16), brick), 2.8, 4.5, -11); G.add(chim);
    const flames = xay ? [] : [...Array(70)].map((_, k) => { const f = glow(2.2, k % 3 ? 0xff6a18 : 0xffb040, .85); G.add(f); return f; });
    const smoke = [...Array(xay ? 12 : 40)].map(() => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex([[0, 'rgba(60,55,52,.9)'], [.5, 'rgba(40,36,34,.45)'], [1, 'rgba(30,28,26,0)']], 'smk'), transparent: true, depthWrite: false, opacity: .8 })); G.add(sp); return sp; });
    const embers = xay ? null : points(160, .12, 0xffa040, (i, t, v) => { const rr = rng(i + 7), ph = (t * (.25 + rr() * .3) + rr()) % 1; v.set((rr() - .5) * 16 + Math.sin(t + i) * .6, 2 + ph * 12, -9 + (rr() - .5) * 8); }); if (embers) G.add(embers);
    const fireL = at(new THREE.PointLight(0xff5a18, xay ? 0 : 60, 40, 1.4), 0, 5, -6); G.add(fireL);
    const F = figure({ color: 0x3a3430 }); G.add(F.G); const hair = at(M(new THREE.SphereGeometry(.17, 16, 12), mat(0xe8e4dc, { r: .9 })), 0, 1.86, .02); hair.scale.set(1.05, .7, 1.05); F.B.add(hair);
    const day = o.ngay ? textSprite('NGÀY ' + o.ngay[0], { color: '#ffd36a', size: 120, sx: 2.6 }) : null; if (day) { at(day, 0, 8.4, -9); G.add(day); }
    return { G, mood: xay ? { key: .9, rim: .8, hemi: .6, fog: .01 } : { key: .12, hemi: .15, rim: 1.4, fog: .02 }, update(s, K) { const t = s.t;
      wins.forEach(w => { w.wm.emissiveIntensity = xay ? .55 : 1.6 + Math.sin(t * 7 + w.ph) * .6; });
      flames.forEach((f, k) => { const rr = rng(k + 3), b = builds[k % builds.length], ph = (t * (.8 + rr() * .7) + rr()) % 1; f.position.set(b[0] + (rr() - .5) * b[2], b[3] + ph * 5.5, b[1] + (rr() - .5) * b[4]);
        const sc = (1 - ph) * (3 + rr() * 3); f.scale.set(sc, sc * 1.5, 1); f.material.opacity = .85 * (1 - ph); });
      smoke.forEach((sp, k) => { const rr = rng(k + 11), ph = (t * (xay ? .08 : .12) + rr()) % 1; if (xay) { sp.position.set(2.8 + ph * 3, 9.5 + ph * 6, -11); const sc = 1 + ph * 4; sp.scale.set(sc, sc, 1); sp.material.opacity = .35 * (1 - ph); sp.material.color.setHex(0xeeeeee); }
        else { const b = builds[k % builds.length]; sp.position.set(b[0] + (rr() - .5) * 4 + ph * 4, b[3] + 3 + ph * 16, b[1]); const sc = 3 + ph * 9; sp.scale.set(sc, sc, 1); sp.material.opacity = .75 * (1 - ph); } });
      if (embers) embers.tick(t); fireL.intensity = xay ? 0 : 50 + Math.sin(t * 9) * 12 + Math.sin(t * 3.7) * 8;
      if (day) day.set('NGÀY ' + Math.round(lerp(o.ngay[0], o.ngay[1], sm(s.u / .85))));
      F.rest(); if (xay) { F.G.rotation.y = Math.PI; at(F.G, .4, 0, lerp(4.5, 1.5, sm(s.u))); F.walk(s.lt * 4.5, .45); }
      else { F.G.rotation.y = Math.PI; at(F.G, .6, 0, 4.2); F.breathe(t); F.aL.rotation.x = .5; F.aR.rotation.x = .5; F.aL.rotation.z = .35; F.aR.rotation.z = -.35; F.head.rotation.x = -.18; }
      if (o.gan) K.cam(lerp(1.6, 1.1, s.u), 1.75, lerp(7.2, 6.4, sm(s.u)), .3, 1.6, 2); else K.cam(lerp(3.5, 1.5, s.u), lerp(3.2, 4, s.u), lerp(16, 13, sm(s.u)), 0, 3.2, -6); } }; },

  // boulder blocking a path; { bac: true } → the boulder sinks and its stone rises as steps the figure climbs ("the obstacle becomes the way")
  'tang-da'(o) { const G = new THREE.Group(), bac = !!o.bac, stone = mat(0x5d5a58, { p: 'stone', flat: true, rep: [3, 3] });
    G.add(ground(60, 0x15130f), at(M(new THREE.PlaneGeometry(3, 40).rotateX(-Math.PI / 2), mat(0x3a2f25, { r: .95 }), false), 0, .005, -6));
    const rock = at(M(lump(1.7, .22, 4, 4), stone), 0, 1.35, -.6); rock.scale.set(1.15, .85, .9); G.add(rock);
    const steps = [...Array(6)].map((_, i) => { const b = M(bumpy(new THREE.BoxGeometry(2.3, .4, .62, 8, 2, 4), .025, i + 2, 3), stone); b.geometry.translate(0, .2, 0); at(b, 0, i * .4, 1.2 - i * .55); b.scale.y = .001; b.visible = false; G.add(b); return b; });
    const top = at(glow(5, 0xffd080, 0), 0, 3.4, -2.4); G.add(top);
    const F = figure(); F.G.rotation.y = Math.PI; G.add(F.G);
    return { G, mood: { key: .8, rim: 1.3 }, update(s, K) { F.rest(); let fz, fy = 0;
      if (!bac) { const w = sm(s.u / .6); fz = lerp(6.5, 2.2, w); F.walk(s.lt * 5, .5 * (1 - sm((s.u - .5) / .12))); F.head.rotation.x = -.45 * sm((s.u - .55) / .2); }
      else { const sink = sm((s.u - .05) / .3); rock.position.y = 1.35 - 3.2 * sink; rock.rotation.y = sink * .4;
        steps.forEach((b, i) => { const v = eo3((s.u - .12 - i * .04) / .22); b.visible = v > 0; b.scale.y = Math.max(.001, v); });
        const c = clamp((s.u - .45) / .45) * 6; if (c <= 0) { fz = 2.4; F.breathe(s.t); F.head.rotation.x = -.3; }
        else { const k = Math.min(5, Math.floor(c)), f = c - k, ph = sm(f); fz = lerp(1.2 - k * .55 + .55, 1.2 - k * .55, ph); fy = lerp(k * .4, (k + 1) * .4, ph); if (c >= 6) { fz = 1.2 - 5 * .55; fy = 2.4; }
          F.walk(c * Math.PI, .6 * (c < 6 ? 1 : 0)); }
        top.material.opacity = sm((s.u - .8) / .2) * .8;
        if (c >= 6) { const up = sm((s.u - .93) / .07); F.aL.rotation.z = -.12 - 2.4 * up; F.aR.rotation.z = .12 + 2.4 * up; } }
      at(F.G, 0, fy, fz);
      K.cam(lerp(2.4, 1.2, s.u), lerp(1.1, 1.7 + fy * .6, s.u), fz + lerp(5.2, 4.4, s.u), 0, lerp(1.7, 1.9 + fy * .5, s.u), lerp(-1, fz - 2, s.u)); } }; },

  // night street after a riot: smoke, litter, smashed shop windows on both sides — and one bookshop untouched, warm light on full shelves, a
  // reader in a flat cap sitting outside with coffee and a book beside a hand-written "WELCOME / OPEN" board.
  // { goc: xa | gan | ke } camera (wide street · close on the reader · along the shelves) · { bong: true } dark silhouettes hurry past without stopping
  'hieu-sach'(o) { const G = new THREE.Group(), r = rng(31), wood = mat(0x4a2a18, { p: 'wood-varnish', rep: [2, 2] }), stone = mat(0x6d665c, { p: 'stone', rep: [4, 2] });
    G.add(ground(60, 0x2a2826)); G.add(at(M(roundedBox(30, .14, 2.2, .02), mat(0x55504a, { p: 'stone', rep: [10, 1] })), 0, .07, -1.1));
    G.add(at(M(new THREE.PlaneGeometry(30, 7), stone, false), 0, 3.5, -2.2));
    const pane = (w, h) => M(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0x9ab0c0, roughness: .05, metalness: .3, transparent: true, opacity: .18, depthWrite: false }), false);
    // the bookshop: warm interior, shelves of coloured spines, wooden frame, sign board above
    const shop = new THREE.Group(); G.add(shop); shop.add(at(M(new THREE.PlaneGeometry(4.4, 3.2), mat(0x3a2412, { e: 0xffa850, ei: .18 }), false), 0, 1.75, -2.15));
    const spineCols = [0x7a2a1e, 0x1f3a5a, 0x2f4a2a, 0x8a6a2a, 0xd8cdb4, 0x5a2a4a, 0xb8432f, 0xe8dcc0], spine = new THREE.BoxGeometry(1, 1, 1);
    for (let row = 0; row < 6; row++) { shop.add(at(M(roundedBox(4.2, .05, .45, .01), wood), 0, .55 + row * .45, -1.95)); let x = -2.05;
      while (x < 2.05) { const w = .04 + r() * .05, h = .26 + r() * .12, b = M(spine, mat(spineCols[Math.floor(r() * spineCols.length)], { r: .7 }), false); b.scale.set(w, h, .3); b.position.set(x + w / 2, .58 + row * .45 + h / 2, -1.95); b.rotation.z = r() < .08 ? .2 : 0; shop.add(b); x += w + .006; } }
    [[-2.25, 1.75, .14, 3.4], [2.25, 1.75, .14, 3.4], [0, 3.45, 4.6, .16], [0, .2, 4.6, .4], [-.75, 1.9, .07, 3.1]].forEach(([x, y, w, h]) => shop.add(at(M(roundedBox(w, h, .16, .02), wood), x, y, -1.55)));
    shop.add(at(pane(1.45, 3), -1.5, 1.95, -1.5), at(pane(2.95, 3), .75, 1.95, -1.5));
    const signC = document.createElement('canvas'); signC.width = 1024; signC.height = 160; const sg = signC.getContext('2d'); sg.fillStyle = '#3a2214'; sg.fillRect(0, 0, 1024, 160); sg.font = '700 96px Georgia, serif'; sg.fillStyle = '#e8c27a'; sg.textAlign = 'center'; sg.textBaseline = 'middle'; sg.fillText('LIBRAIRIE', 512, 84);
    const sT = new THREE.CanvasTexture(signC); sT.colorSpace = THREE.SRGBColorSpace; shop.add(at(new THREE.Mesh(new THREE.PlaneGeometry(4.4, .7), new THREE.MeshStandardMaterial({ map: sT, roughness: .6 })), 0, 3.95, -1.5));
    for (let i = 0; i < 3; i++) { const l = at(glow(1.2, 0xffc070, .5), -1.4 + i * 1.4, 3.2, -1.7); shop.add(l); }
    // neighbours: dark interiors, smashed glass shards, half-open bent shutters
    [-1, 1].forEach(sd => { for (let k = 0; k < 2; k++) { const cx = sd * (4.9 + k * 4.6), g = new THREE.Group(); at(g, cx, 0, 0); G.add(g);
      g.add(at(M(new THREE.PlaneGeometry(4.2, 3), mat(0x0e0d0c, { r: 1 }), false), 0, 1.7, -2.15), at(M(roundedBox(4.4, .3, .2, .02), mat(0x2a2a2e, { r: .6, m: .5 })), 0, 3.3, -1.55));
      const sh = at(M(new THREE.BoxGeometry(4.1, 1.2, .04, 12, 4, 1), mat(0x6a6e74, { p: 'steel', r: .5 })), 0, 2.6, -1.55); sh.rotation.x = .25; sh.rotation.z = (r() - .5) * .2; g.add(sh);
      for (let s = 0; s < 9; s++) { const sz = .25 + r() * .5, sv = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(sz, r() * sz * .3), new THREE.Vector2(r() * sz, sz * 1.4)]));
        const piece = M(sv, new THREE.MeshStandardMaterial({ color: 0xb8c8d4, roughness: .05, metalness: .4, transparent: true, opacity: .35, side: THREE.DoubleSide, depthWrite: false }), false);
        if (s < 5) at(piece, -1.9 + r() * 3.6, .5 + r() * 1.6, -1.52); else { at(piece, -1.8 + r() * 3.6, .155, -1.2 + r() * .9); piece.rotation.x = -Math.PI / 2; } g.add(piece); }
      g.add(at(M(new THREE.PlaneGeometry(1.2 + r(), .8 + r() * .5), mat([0xc8321f, 0x2f7a8a, 0xd9b45a][k + (sd > 0 ? 1 : 0)], { r: .9 }), false), (r() - .5) * 2, 1.2, -2.13)); } });
    // litter: cans + paper
    for (let i = 0; i < 26; i++) { const can = M(new THREE.CylinderGeometry(.035, .035, .12, 10), mat([0xc8321f, 0xb8c0c8, 0x2f6a3a][i % 3], { r: .4, m: .6 })); can.rotation.set(Math.PI / 2, 0, r() * 6); at(can, (r() - .5) * 14, .035 + (r() < .3 ? .14 : 0), -1.9 + r() * 5); G.add(can); }
    for (let i = 0; i < 18; i++) { const p = M(new THREE.PlaneGeometry(.18, .13), mat(0xe8e2d6, { r: .9 }), false); p.rotation.set(-Math.PI / 2, 0, r() * 6); at(p, (r() - .5) * 14, .012, -1.5 + r() * 4.5); G.add(p); }
    // the reader: seated, flat cap, coffee cup to the lips every few seconds, book on the lap
    const chair = new THREE.Group(); chair.add(at(M(roundedBox(.55, .05, .5, .02), wood), 0, .5, 0), at(M(roundedBox(.55, .7, .05, .02), wood), 0, .88, -.24)); [[-.24, -.2], [.24, -.2], [-.24, .2], [.24, .2]].forEach(([x, z]) => chair.add(at(M(roundedBox(.04, .5, .04, .01), wood), x, .25, z))); at(chair, .9, .14, -.6); G.add(chair);
    const F = figure({ size: .95 }); G.add(F.G); const cup = new THREE.Group(); cup.add(M(new THREE.CylinderGeometry(.045, .035, .07, 14), mat(0xf4efe4, { r: .3 }))); at(cup, 0, -.3, .06); (F.aR.lo || F.aR).add(cup);
    const book = M(roundedBox(.34, .03, .24, .01), mat(0x8a2a1e, { r: .6 })); G.add(book);
    const bC = document.createElement('canvas'); bC.width = 512; bC.height = 600; const bg = bC.getContext('2d'); bg.fillStyle = '#f2ead6'; bg.fillRect(0, 0, 512, 600); bg.fillStyle = '#2a2420'; bg.font = '700 120px "Comic Sans MS", "Segoe Print", cursive'; bg.textAlign = 'center'; bg.fillText('WELCOME', 256, 190); bg.fillText('/', 256, 320); bg.fillText('OPEN', 256, 460);
    const bT = new THREE.CanvasTexture(bC); bT.colorSpace = THREE.SRGBColorSpace; const board = new THREE.Group(); board.add(at(new THREE.Mesh(new THREE.PlaneGeometry(.6, .7), new THREE.MeshStandardMaterial({ map: bT, roughness: .9 })), 0, .85, .02), at(M(roundedBox(.66, .76, .03, .01), wood), 0, .85, -.01));
    [-.3, .3].forEach(x => board.add(at(M(roundedBox(.04, 1.25, .04, .01), wood), x, .62, -.05))); board.rotation.x = -.18; at(board, .25, .14, .15); board.rotation.y = .25; G.add(board);
    const smoke = [...Array(16)].map((_, i) => { const g = glow(3 + r() * 4, 0xb8bcc4, .14, 'w'); g.userData = { x: (r() - .5) * 18, y: .8 + r() * 3, z: -.5 + r() * 5, v: .1 + r() * .25 }; G.add(g); return g; });
    const flare = at(glow(9, 0xff7a30, .25), -9, 1.5, 3); G.add(flare);
    const shadows = o.bong ? [...Array(4)].map((_, k) => { const P = figure({ size: .95 + k * .04, mat: mat(0x0c0c10, { r: 1 }) }); G.add(P.G); return P; }) : [];
    return { G, mood: { key: .6, rim: 1.5, hemi: .55, fog: .03 }, update(s, K) {
      F.rest(); at(F.G, .9, -.22, -.38); F.G.rotation.y = -.15; F.lL.rotation.x = F.lR.rotation.x = -1.45; if (F.lL.lo) F.lL.lo.rotation.x = F.lR.lo.rotation.x = 1.45;
      const sip = Math.max(0, Math.sin((s.t * .7) % (Math.PI * 2))) ** 3; F.aR.rotation.x = lerp(-.7, -1.9, sip); F.aR.rotation.z = -.2; if (F.aR.lo) F.aR.lo.rotation.x = lerp(-.6, -1.5, sip); F.aL.rotation.x = -.6; F.head.rotation.x = lerp(.35, -.05, sip);
      at(book, .92, .69, -.08); book.rotation.y = -.15;
      smoke.forEach((g, i) => { const d = g.userData; g.position.set(d.x + Math.sin(s.t * .1 + i) * 1.5 + s.t * d.v, d.y + Math.sin(s.t * .2 + i * 2) * .3, d.z); g.material.opacity = .1 + .06 * Math.sin(s.t * .3 + i); });
      flare.material.opacity = .2 + .08 * Math.sin(s.t * 7) * Math.sin(s.t * 3.1);
      shadows.forEach((P, k) => { const ph = ((s.lt * .55 + k * .27) % 1); at(P.G, lerp(-10, 10, ph), 0, 1.6 + k * .5); P.G.rotation.y = Math.PI / 2; P.walk(s.lt * 9 + k, .7); });
      if (o.goc === 'gan') K.cam(lerp(2.4, 2.0, s.u), lerp(1.25, 1.15, s.u), lerp(2.2, 1.7, sm(s.u)), .75, .95, -.6);
      else if (o.goc === 'ke') K.cam(lerp(-1.6, 1.4, sm(s.u)), 2.0, .9, lerp(-1.2, 1.2, sm(s.u)), 1.9, -1.9);
      else K.cam(lerp(-3.4, -2.2, s.u), lerp(2.4, 1.9, s.u), lerp(7.5, 5.6, sm(s.u)), .3, 1.4, -1); } }; },

  // a reader in an armchair: glowing letters lift off the page and stream into the head, where they stay as a warm light.
  // { lay: true } halfway through the book is pulled away out of frame — the light in the head remains
  'doc-sach'(o) { const G = new THREE.Group(); G.add(ground(30, 0x14110e));
    const arm = new THREE.Group(), fab = mat(0x5a2a22, { p: 'fabric', rep: [2, 2] }); arm.add(at(M(roundedBox(.9, .4, .8, .08), fab), 0, .35, 0), at(M(roundedBox(.9, .9, .2, .08), fab), 0, .85, -.35), at(M(roundedBox(.16, .55, .8, .06), fab), -.45, .55, 0), at(M(roundedBox(.16, .55, .8, .06), fab), .45, .55, 0)); G.add(arm);
    const lampG = at(glow(.8, 0xffc070, .35), -1.1, 1.9, .2); G.add(lampG, at(M(new THREE.CylinderGeometry(.02, .02, 1.8, 8), mat(0x2a2a2a, { m: .7 })), -1.1, .9, .2));
    const F = figure({ size: .95 }); G.add(F.G);
    const book = new THREE.Group(); book.add(at(M(roundedBox(.2, .015, .28, .005), mat(0xf2ead6, { r: .8 })), -.1, 0, 0), at(M(roundedBox(.2, .015, .28, .005), mat(0xf2ead6, { r: .8 })), .1, 0, 0), at(M(roundedBox(.42, .01, .3, .005), mat(0x7a2a1e)), 0, -.012, 0)); G.add(book);
    const head = new THREE.Vector3(0, 1.62, .05), letters = points(160, .05, 0xffd890, () => {}, { op: .95 }); G.add(letters);
    const core = glow(.32, 0xffd890, 0); G.add(core);
    const hand = new THREE.Group(); hand.add(M(new THREE.CapsuleGeometry(.06, .6, 4, 10).rotateZ(Math.PI / 2), mat(0x0b0b0e, { r: 1 }))); G.add(hand);
    return { G, mood: { key: .5, rim: 1.2, hemi: .5 }, update(s, K) {
      F.rest(); at(F.G, 0, -.16, .05); F.lL.rotation.x = F.lR.rotation.x = -1.45; if (F.lL.lo) F.lL.lo.rotation.x = F.lR.lo.rotation.x = 1.45; F.aL.rotation.x = F.aR.rotation.x = -.95; F.aL.rotation.z = .35; F.aR.rotation.z = -.35; F.head.rotation.x = .38;
      const taken = o.lay ? sm((s.u - .5) / .18) : 0, bp = new THREE.Vector3(0, .98, .42);
      book.position.copy(bp).add(new THREE.Vector3(taken * 2.4, taken * .6, taken * .8)); book.rotation.set(-.5, 0, taken * .6); book.visible = taken < .98;
      hand.visible = false; hand.position.copy(book.position).add(new THREE.Vector3(.38, .02, 0));
      const feed = 1 - taken; letters.tick = undefined; const pos = letters.geometry.attributes.position;
      for (let i = 0; i < 160; i++) { const rr = rng(i + 5), ph = (s.t * .35 + rr()) % 1, a = (rr() - .5) * .3; const from = bp, p = new THREE.Vector3().lerpVectors(from, head, ph); p.x += Math.sin(ph * Math.PI) * a + Math.sin(s.t + i) * .02; p.y += Math.sin(ph * Math.PI) * .25;
        if (ph < .02 && feed < .5) p.set(0, -9, 0); pos.setXYZ(i, p.x, p.y, p.z); } pos.needsUpdate = true; letters.material.opacity = .9 * Math.max(feed, .0) + .0;
      core.position.copy(head); core.material.opacity = Math.min(.95, .15 + s.u * 1.2); core.scale.setScalar(.5 + Math.min(1, s.u * 1.4) * .5 + Math.sin(s.t * 2) * .03);
      K.cam(lerp(1.6, 1.1, s.u), lerp(1.55, 1.7, s.u), lerp(3.1, 2.5, sm(s.u)), 0, 1.25, .1); } }; },

  // book street at night (al-Mutanabbi style): stalls and books laid out on cloths along a narrow old street, left overnight with nobody
  // guarding them; lamps, a moon, a slow dolly along the stalls. { sang: true } morning light, sellers back at the stalls
  'pho-sach'(o) { const G = new THREE.Group(), r = rng(57), sang = !!o.sang; G.add(ground(60, sang ? 0x6a5a48 : 0x2a241e));
    [-1, 1].forEach(sd => { for (let k = 0; k < 7; k++) { const h = 3 + r() * 2.2, b = M(roundedBox(2.6, h, 1.6, .05), mat([0xb89a72, 0xa88a62, 0xc8aa82][k % 3], { p: 'stone', rep: [2, 2] })); at(b, sd * 3.2, h / 2, -k * 2.7 + 2); G.add(b);
      for (let w = 0; w < 3; w++) G.add(at(M(new THREE.PlaneGeometry(.4, .6), mat(0x1a140e, { e: sang ? 0 : 0xffb060, ei: r() < .4 ? .6 : 0 }), false), sd * 1.89, 1.6 + w * .9, -k * 2.7 + 2 + (r() - .5)).rotateY(-sd * Math.PI / 2)); } });
    const cols = [0x7a2a1e, 0x1f3a5a, 0x2f4a2a, 0x8a6a2a, 0xd8cdb4, 0xb8432f, 0xe8dcc0, 0x3a2a4a];
    for (let k = 0; k < 9; k++) { const sd = k % 2 ? 1 : -1, z = 2.6 - k * 1.9, cloth = M(new THREE.PlaneGeometry(1.2, 1.5), mat([0x8a3a2a, 0x3a5a6a, 0x6a5a3a][k % 3], { p: 'fabric', rep: [2, 2] }), false); cloth.rotation.x = -Math.PI / 2; at(cloth, sd * 1.25, .012, z); G.add(cloth);
      for (let i = 0; i < 22; i++) { const b = M(roundedBox(.2 + r() * .1, .04 + r() * .05, .28, .01), mat(cols[Math.floor(r() * cols.length)], { r: .7 })); at(b, sd * 1.25 + (r() - .5) * 1, .03 + (i > 15 ? .07 : 0), z + (r() - .5) * 1.3); b.rotation.y = (r() - .5) * .4; G.add(b); } }
    const moon = at(glow(4, 0xdfe8ff, sang ? 0 : .7), 2, 9, -14); G.add(moon); const sun = at(glow(10, 0xffd8a0, sang ? .5 : 0), -3, 8, -16); G.add(sun);
    const lamps = [...Array(4)].map((_, k) => { const l = at(glow(1.4, 0xffb860, sang ? 0 : .8), k % 2 ? 1.95 : -1.95, 2.6, 1.5 - k * 3.4); G.add(l); return l; });
    const sellers = sang ? [...Array(3)].map((_, k) => { const P = figure({ size: .95 }); at(P.G, (k % 2 ? 1 : -1) * 2.0, 0, 1.5 - k * 3.6); P.G.rotation.y = (k % 2 ? -1 : 1) * Math.PI / 2; G.add(P.G); return P; }) : [];
    return { G, mood: { key: sang ? 1.1 : .45, rim: sang ? .8 : 1.3, hemi: sang ? 1.1 : .45, fog: .03 }, update(s, K) {
      lamps.forEach((l, k) => l.material.opacity = sang ? 0 : .7 + Math.sin(s.t * 5 + k) * .06); sellers.forEach((P, k) => { P.rest(); P.breathe(s.t + k); });
      K.cam(lerp(.3, -.2, s.u), lerp(1.7, 1.5, s.u), lerp(5.5, 1.2, sm(s.u)), 0, .6, lerp(-4, -8, s.u)); } }; },

  // domino amplification (Whitehead 1983): a chain of N dominoes, each 1.5× the previous; the falling wave runs along the row while the
  // world rescales so the domino now falling always fills the frame (camera effectively pulls back exponentially). Counter: domino number +
  // real height from 5 mm. { n: 29, do: 0.8 } = count and the moment (scene fraction) the last one lands · { toa: true } skyscraper beside the
  // last domino · { tu: 0, den: 12 } index range for this scene (continue the chain across scenes; the last one only falls when den = n − 1) · { cho: true } nothing falls yet (the row waits, slow orbit) · { dem: false } hides the counter ({ dem_tu: 2.5 } shows it after 2.5 s, e.g. under a scene title) · { dung: true } the last domino stays standing · { het: 0.85 } reach `den` at this scene fraction · { moc: [[6.4, 15], [9, 23]] } keyframes [scene seconds, domino index] (sync to spoken numbers)
  'domino'(o) { const N = o.n ?? 29, R = 1.5, H0 = 5, G = new THREE.Group(), body = mat(0x17171b, { r: .28, m: .1 }), pipM = mat(0xf4efe4, { r: .4 }), W = new THREE.Group();
    W.add(G); const fl = ground(60, 0x1a1714); fl.scale.setScalar(40); W.add(fl);
    const size = i => Math.pow(R, i), xs = [0]; for (let i = 1; i < N; i++) xs.push(xs[i - 1] + .62 * size(i - 1) + .2 * size(i));
    const unit = roundedBox(.5, 1, .14, .03), pip = new THREE.CircleGeometry(.055, 20);
    const D = [...Array(N)].map((_, i) => { const g = new THREE.Group(), s = size(i), m = M(unit, body); m.position.y = .5; g.add(m);
      [[0, .78], [0, .5], [0, .22]].forEach(([x, y], k) => { if (k === 1 && i % 2) return; const p = M(pip, pipM, false); p.position.set(x + (k === 1 ? 0 : (k ? -.12 : .12)), y, .072); p.rotation.y = 0; g.add(p); const q = p.clone(); q.position.z = -.072; q.rotation.y = Math.PI; g.add(q); });
      const piv = new THREE.Group(); piv.position.set(xs[i] + .07 * s, 0, 0); g.position.set(-.07, 0, 0); g.rotation.y = Math.PI / 2; piv.add(g); piv.scale.setScalar(s); G.add(piv); return piv; });
    const tower = new THREE.Group(); if (o.toa) { const s = size(N - 1) * .96, tw = M(roundedBox(.34, 1, .34, .01), mat(0x2a3446, { r: .25, m: .6 })); tw.position.y = .5; tower.add(tw);
      const winM = new THREE.MeshBasicMaterial({ color: 0xffd58a }); for (let r = 0; r < 26; r++) for (let c = 0; c < 4; c++) if (rng(r * 7 + c)() > .35) { const w = new THREE.Mesh(new THREE.PlaneGeometry(.05, .018), winM); w.position.set(-.12 + c * .08, .05 + r * .036, .171); tower.add(w); }
      tower.add(at(M(new THREE.CylinderGeometry(.004, .01, .12, 6), mat(0x8a8f96, { m: .8 })), 0, 1.06, 0)); tower.scale.setScalar(s); tower.position.set(xs[N - 1] + .2 * size(N - 1), 0, -.9 * size(N - 1)); G.add(tower); }
    if (N > 18) { const P = figure(), ph = 1800 / H0; P.G.scale.setScalar(ph / 1.9); P.G.position.set(xs[15] - .1 * size(15), 0, .55 * size(15)); P.G.rotation.y = -.6; G.add(P.G); }   // a 1.8 m person for scale beside domino 16
    const dust = points(120, .06, 0xd8ccb8, (i, t, v) => { const r = rng(i + 9), a = r() * 6.28, sp = .6 + r() * 1.6; v.set(Math.cos(a) * sp * t * 1.4, Math.max(0, .1 + 1.2 * t * r() - 1.5 * t * t), Math.sin(a) * sp * t); }, { op: .55 }); W.add(dust);
    const cnt = textSprite('1', { color: '#ffd36a', size: 150, sx: 1.6, w: 1024 }), hl = textSprite('5 mm', { color: '#fbf3e2', size: 110, sx: 1.6, w: 1024 }); W.add(cnt, hl);
    const fmt = mm => mm < 10 ? `${mm.toFixed(1).replace('.', ',')} mm` : mm < 1000 ? `${Math.round(mm / 10).toLocaleString('vi-VN')} cm` : mm < 1e6 ? `${(mm / 1000 >= 100 ? Math.round(mm / 1000) : (mm / 1000).toFixed(1).replace('.', ',')).toLocaleString('vi-VN')} m` : `${(mm / 1e6).toFixed(1).replace('.', ',')} km`;
    return { G: W, mood: { key: .85, rim: 1.3 }, update(s, K) { const t0 = o.tu ?? 0, end = o.do ?? .8;
      const den = o.den ?? N - 1, fin = den >= N - 1 && !o.dung, k = o.cho ? t0 : o.moc ? (() => { const P = [[0, t0], ...o.moc]; let j = P.findIndex(q => q[0] > s.lt); if (j < 0) return P[P.length - 1][1]; const A = P[j - 1], B = P[j]; return lerp(A[1], B[1], sm((s.lt - A[0]) / (B[0] - A[0]))); })() : t0 + (den - t0) * Math.pow(clamp(s.u / (fin ? end : (o.het ?? 1))), 1.12);           // continuous wave index
      D.forEach((p, i) => { const f = i === N - 1 ? 0 : clamp(k - i + .15); p.rotation.z = -1.32 * (f * f * (3 - 2 * f)); p.visible = i <= k + 6; });
      const ff = o.cho || !fin ? 0 : clamp((s.u - end) / .1); D[N - 1].rotation.z = -1.32 * ff * ff; const landed = ff >= 1, tl = s.u - end - .1;
      const kf = Math.min(k, N - 1), sc = Math.pow(R, kf), xf = lerp(xs[Math.floor(kf)], xs[Math.min(N - 1, Math.ceil(kf))], kf - Math.floor(kf));
      const zoom = 1; G.scale.setScalar(1 / (sc * zoom)); G.position.set(-xf / (sc * zoom) - .2, 0, 0);
      const idx = Math.min(N, Math.floor(kf + 1.0001)); cnt.visible = hl.visible = o.dem !== false && s.lt >= (o.dem_tu ?? 0); cnt.set(`QUÂN ${idx}`); hl.set(fmt(H0 * Math.pow(R, idx - 1))); at(cnt, .55, 2.05, 0); at(hl, .55, 1.72, 0);
      dust.visible = landed && tl < .25; if (dust.visible) { dust.position.set(.9, 0, 0); dust.tick(tl * s.D); }
      const sh = landed ? Math.max(0, 1 - tl / .06) * .05 * Math.sin(s.t * 80) : 0;
      const a = o.cho ? .5 + s.u * .4 : .62 + s.u * .2, d = 5.2 + (o.toa ? sm((kf - (N - 4)) / 3) * 1.5 : 0); K.cam(Math.sin(a) * d + .3 + sh, 1.5 + (o.toa ? sm((kf - (N - 4)) / 3) * .6 : 0), Math.cos(a) * d, .55, .75, -.2); } }; },

  // writing desk before dawn: a seated figure writes by an oil lamp, a pocket watch on the desk sweeps a gold quarter-hour ring and every
  // completed ring sends a page onto the growing stack; the window brightens toward sunrise.
  // { dem: [0, 3000], don_vi: "chữ" } → running counter above the desk · { sach: 47 } → books stack into a tower, counter of books · { gio: true } → "5:30" clock label · { goc: mat } → side view (writer in profile, window behind)
  'ban-viet'(o) { const G = new THREE.Group(), wood = mat(0x4a2e1c, { p: 'wood-varnish', rep: [2, 1] }), paper = mat(0xf1e9d6, { r: .85 }), brass = mat(0xc9a24e, { p: 'gold', r: .3, m: .9 });
    G.add(ground(40, 0x1a1512));
    const wall = at(M(new THREE.PlaneGeometry(14, 7), mat(0x2a2420, { r: .95 }), false), 0, 3.5, -2.2); G.add(wall);
    const winC = document.createElement('canvas'); winC.width = 64; winC.height = 128; const wg = winC.getContext('2d'); const wTex = new THREE.CanvasTexture(winC); wTex.colorSpace = THREE.SRGBColorSpace;
    const win = at(new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2), new THREE.MeshBasicMaterial({ map: wTex })), 1.6, 2.7, -2.18); G.add(win);
    [[0, 1.12, 1.7, .08], [0, -1.12, 1.7, .08], [-.82, 0, .08, 2.3], [.82, 0, .08, 2.3], [0, 0, .05, 2.2], [0, 0, 1.6, .05]].forEach(([x, y, w, h]) => G.add(at(M(roundedBox(w, h, .06, .01), wood), 1.6 + x, 2.7 + y, -2.15)));
    const desk = new THREE.Group(); desk.add(at(M(roundedBox(2.6, .1, 1.2, .03), wood), 0, .82, 0)); [[-1.2, -.5], [1.2, -.5], [-1.2, .5], [1.2, .5]].forEach(([x, z]) => desk.add(at(M(roundedBox(.08, .8, .08, .02), wood), x, .4, z))); G.add(desk);
    const chair = new THREE.Group(); chair.add(at(M(roundedBox(.6, .06, .55, .02), wood), 0, .5, 0), at(M(roundedBox(.6, .8, .05, .02), wood), 0, .92, .27)); [[-.26, -.24], [.26, -.24], [-.26, .24], [.26, .24]].forEach(([x, z]) => chair.add(at(M(roundedBox(.05, .5, .05, .01), wood), x, .25, z))); at(chair, -.35, 0, .95); G.add(chair);
    const lamp = new THREE.Group(); lamp.add(at(M(new THREE.CylinderGeometry(.13, .16, .12, 20), brass), 0, .06, 0), at(M(new THREE.SphereGeometry(.12, 20, 14), mat(0xfff0d0, { op: .35, dw: false }), false), 0, .24, 0));
    const flame = at(glow(.9, 0xffb860, .9), 0, .24, 0); lamp.add(flame); at(lamp, -1.0, .87, -.3); G.add(lamp);
    const watch = new THREE.Group(); watch.add(M(new THREE.CylinderGeometry(.2, .2, .04, 32), brass), at(M(new THREE.CircleGeometry(.17, 32).rotateX(-Math.PI / 2), mat(0xf6f0e2, { r: .5 }), false), 0, .021, 0));
    const ringG = () => new THREE.RingGeometry(.12, .16, 48, 1, 0, .001).rotateX(-Math.PI / 2); const ring = at(new THREE.Mesh(ringG(), new THREE.MeshBasicMaterial({ color: 0xffc04a, transparent: true, opacity: .95, side: THREE.DoubleSide })), 0, .024, 0); watch.add(ring);
    const hand = at(M(roundedBox(.012, .006, .15, .003), mat(0x1a1a1a)), 0, .026, 0, false); hand.geometry.translate(0, 0, -.07); watch.add(hand); at(watch, .75, .89, .15); G.add(watch);
    const sheet = () => M(new THREE.BoxGeometry(.42, .006, .58), paper, false); const pad = at(sheet(), -.25, .875, .2); G.add(pad);
    const stack = new THREE.Group(); at(stack, .95, .87, -.32); G.add(stack); const pages = [...Array(60)].map((_, i) => { const p = sheet(); p.position.y = i * .012; p.rotation.y = (rng(i + 3)() - .5) * .12; p.visible = false; stack.add(p); return p; });
    const fly = sheet(); G.add(fly);
    const books = o.sach ? [...Array(Math.min(48, o.sach))].map((_, i) => { const r = rng(i + 11), b = M(roundedBox(.62 + r() * .14, .055 + r() * .02, .44, .012), mat([0x6a1f1f, 0x1f3a5a, 0x2f4a2a, 0x5a3a1a, 0x3a2a4a][i % 5], { r: .7 })); b.rotation.y = (r() - .5) * .3; b.visible = false; G.add(b); return b; }) : [];
    const F = figure({ size: .95 }); G.add(F.G); F.G.rotation.y = Math.PI;
    const cnt = o.dem || o.sach ? textSprite('0', { color: '#ffd36a', size: 140, sx: 1.9, w: 1024 }) : null; if (cnt) { at(cnt, -.35, 1.7, -.7); G.add(cnt); }
    const clock = o.gio ? textSprite('5:30', { color: '#fbf3e2', size: 120, sx: 1.1 }) : null; if (clock) { at(clock, 1.6, 2.7, -1.9); clock.material.depthTest = false; clock.renderOrder = 5; G.add(clock); }
    return { G, mood: { key: .55, rim: 1.1, hemi: .8 }, update(s, K) { const day = sm(s.u);
      const top = [`rgb(${lerp(20, 255, day) | 0},${lerp(28, 170, day) | 0},${lerp(60, 110, day) | 0})`, `rgb(${lerp(10, 120, day) | 0},${lerp(14, 110, day) | 0},${lerp(40, 160, day) | 0})`];
      const gr = wg.createLinearGradient(0, 128, 0, 0); gr.addColorStop(0, top[0]); gr.addColorStop(1, top[1]); wg.fillStyle = gr; wg.fillRect(0, 0, 64, 128); wTex.needsUpdate = true;
      flame.material.opacity = .75 + Math.sin(s.t * 13) * .08 + Math.sin(s.t * 7.3) * .06;
      F.rest(); at(F.G, -.35, -.36, .78); F.lL.rotation.x = F.lR.rotation.x = -1.45; if (F.lL.lo) { F.lL.lo.rotation.x = F.lR.lo.rotation.x = 1.45; }
      F.B.rotation.x = .22; F.head.rotation.x = .35; F.aL.rotation.x = -.9; F.aL.rotation.z = .3; F.aR.rotation.x = -.95 + Math.sin(s.t * 9) * .05; F.aR.rotation.z = -.15 + Math.sin(s.t * 4.1) * .08; if (F.aR.lo) F.aR.lo.rotation.x = -.5;
      const per = Math.max(1.6, s.D / 6), q = (s.lt % per) / per, n = Math.floor(s.lt / per);
      ring.geometry.dispose(); ring.geometry = new THREE.RingGeometry(.12, .16, 48, 1, Math.PI / 2, -Math.max(.001, q * Math.PI * 2)).rotateX(-Math.PI / 2); hand.rotation.y = -q * Math.PI * 2;
      const shown = o.sach ? 0 : Math.min(pages.length, n * 3 + 3); pages.forEach((p, i) => p.visible = i < shown);
      const f = clamp((q - .82) / .18); fly.visible = !o.sach && f > 0; if (fly.visible) { fly.position.set(lerp(-.25, .95, f), .88 + Math.sin(f * Math.PI) * .5 + shown * .012 * f, lerp(.2, -.32, f)); fly.rotation.z = Math.sin(f * Math.PI) * .6; }
      if (o.sach) { const k = Math.round(lerp(1, books.length, sm(s.u / .85))); books.forEach((b, i) => { const v = i < k; b.visible = v; at(b, 1.8 + (i % 2) * .02, i * .075 + .04, .4); }); if (cnt) at(cnt, 1.8, k * .075 + .35, .4); }
      if (cnt) cnt.set(o.sach ? String(Math.round(lerp(1, o.sach, sm(s.u / .85)))) + ' cuốn' : (Math.round(lerp(o.dem[0], o.dem[1], sm(s.u)) / 10) * 10).toLocaleString('vi-VN') + ' ' + (o.don_vi || 'chữ'));
      if (clock) clock.set(`${5 + Math.floor((30 + 180 * s.u) / 60)}:${String(Math.floor(30 + 180 * s.u) % 60).padStart(2, '0')}`);
      if (o.sach) { const h = books.length * .075 * sm(s.u / .85); K.cam(lerp(-.6, -1.2, s.u), lerp(1.8, 1.5 + h * .6, sm(s.u)), lerp(5.2, 6.4, s.u), 1.1, lerp(1.2, .9 + h * .55, sm(s.u)), 0); }
      else if (o.goc === 'mat') K.cam(lerp(-3.3, -2.8, s.u), lerp(1.8, 1.65, s.u), lerp(2.3, 1.9, sm(s.u)), .2, 1.3, -.85);   // side view from the left: writer in profile, window behind
      else K.cam(lerp(2.6, 2.0, s.u), lerp(2.05, 1.8, s.u), lerp(3.0, 2.4, sm(s.u)), -.15, 1.05, -.15); } }; },

  // the 101st blow: a figure swings a sledgehammer at a boulder, a blow counter races 1 → 100 with no visible crack, then at 101 the boulder
  // splits in two (fresh pale core, dust burst, warm light). { vo: 0.62 } = split moment as a fraction of the scene · { dem: false } hides the counter ({ dem_tu: 2.5 } shows it after 2.5 s, e.g. under a scene title) · { dung: true } the last domino stays standing · { het: 0.85 } reach `den` at this scene fraction · { moc: [[6.4, 15], [9, 23]] } keyframes [scene seconds, domino index] (sync to spoken numbers)
  'da-vo'(o) { const G = new THREE.Group(), vo = o.vo ?? .62, R = 1.25, rock = mat(0x6d665e, { p: 'stone', flat: true, rep: [2, 2] }), core = mat(0xb9ad98, { p: 'stone', r: .95 });
    G.add(ground(50, 0x16130f));
    const half = sx => { const g = new THREE.Group(), s = M(bumpy(new THREE.SphereGeometry(R, 48, 32, sx > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI), .07, 17, 2.2), rock);
      const cap = M(new THREE.CircleGeometry(R * .93, 40).rotateY(sx > 0 ? -Math.PI / 2 : Math.PI / 2), core, false); g.add(s, cap); g.scale.set(1.1, .82, .95); at(g, 0, R * .78, 0); G.add(g); return g; };
    const hL = half(-1), hR = half(1);
    const flash = at(glow(4.5, 0xffd9a0, 0), 0, R * .8, .3); G.add(flash);
    const burst = points(90, .1, 0xd8ccb8, (i, t, v) => { const r = rng(i + 5), a = r() * 6.28, sp = 1.2 + r() * 2.2; v.set(Math.cos(a) * sp * t, R * .8 + Math.sin(a) * sp * .7 * t + 1.2 * t - 4.9 * t * t, (r() - .3) * sp * t); }, { op: .9 }); G.add(burst);
    const chips = points(24, .06, 0xe0d4c0, (i, t, v) => { const per = .55, n = Math.floor(t / per), dt = t - n * per, r = rng(i + n * 71), a = r() * 3.14 + 1.6; v.set(Math.cos(a) * dt * 1.3, Math.sin(a) * dt + 1.3 * dt - 4.9 * dt * dt, (r() - .5) * dt); }, { op: .8 }); G.add(chips);
    const F = figure(), ham = new THREE.Group(); ham.add(at(M(new THREE.CylinderGeometry(.035, .04, 1.05, 8).rotateX(Math.PI / 2), mat(0x6b4a32, { p: 'wood' })), 0, 0, .45),
      at(M(roundedBox(.34, .2, .2, .04), mat(0x4e5156, { p: 'iron' })), 0, 0, .98)); at(ham, 0, -.74, .02); F.aR.add(ham);
    at(F.G, -2.15, 0, .35); F.G.rotation.y = Math.PI / 2; G.add(F.G);
    const cnt = o.dem === false ? null : textSprite('1', { color: '#ffd36a', size: 170, sx: 1.7 }); if (cnt) { at(cnt, 0, R * 1.95, 0); G.add(cnt); }
    return { G, mood: { key: .9, rim: 1.3 }, update(s, K) { const per = .55, split = s.u >= vo, k = split ? 1 : Math.min(100, 1 + Math.floor(99 * Math.pow(s.u / (vo - .02), 1.6)));
      F.rest(); const ph = (s.lt % per) / per, up = split ? sm((s.u - vo) / .2) * .3 : (ph < .6 ? sm(ph / .6) : 1 - eo3((ph - .6) / .4));
      F.aR.rotation.x = lerp(-1.05, -2.9, up); F.aL.rotation.x = lerp(-1.0, -2.6, up); F.B.rotation.x = lerp(.28, -.08, up); F.lL.rotation.x = .3; F.lR.rotation.x = -.25; F.head.rotation.x = .2;
      if (cnt) { cnt.set(split ? '101' : String(k)); const pop = split ? 1 + .35 * Math.max(0, 1 - (s.u - vo) / .06) : 1; cnt.scale.set(1.4 * pop, 1.4 * pop * .5, 1); }
      const d = split ? eo3((s.u - vo) / .18) : 0; hL.position.x = -d * .32; hR.position.x = d * .42; hL.rotation.z = d * .2; hR.rotation.z = -d * .24;
      flash.material.opacity = split ? Math.max(0, 1 - (s.u - vo) / .25) * .9 : 0; burst.visible = split && s.u - vo < .3; burst.tick((s.u - vo) * s.D);
      chips.visible = !split; chips.position.set(-R * .9, R * .9, .2); chips.tick(s.lt);
      const shake = split ? Math.max(0, 1 - (s.u - vo) / .08) * .06 * Math.sin(s.t * 90) : 0;
      K.cam(lerp(.9, .3, s.u) + shake, lerp(2.2, 2.5, s.u), lerp(9.2, 8, sm(s.u)), -.75, 1.05, 0); } }; },

  // a lone figure hammering a passage through a rock ridge: the rock face recedes as the cut deepens, chips fly on every blow, light breaks through at the end.
  // { nam: [1960, 1982] } → year counter over the ridge · { tu: 0, den: 1 } → cut progress range · { xong: true } → finished passage, villagers walk through toward the camera
  'xe-nui'(o) { const G = new THREE.Group(), xong = !!o.xong, rock = mat(0x6a625a, { p: 'stone', flat: true, rep: [3, 3] }), L = 7, H = 4.4, gap = 1.9;
    G.add(ground(70, 0x17140f), at(M(new THREE.PlaneGeometry(gap, 26).rotateX(-Math.PI / 2), mat(0x3a2f25, { r: .95 }), false), 0, .006, -2));
    [-1, 1].forEach(sx => { const b = M(bumpy(new THREE.BoxGeometry(7, H, L + 1, 28, 18, 28), .28, sx > 0 ? 21 : 22, 1.1), rock); at(b, sx * (3.5 + gap / 2), H / 2 - .2, 0); G.add(b);
      const cap = M(bumpy(new THREE.ConeGeometry(4.2, 3.2, 28, 6), .3, sx > 0 ? 5 : 6, .9), rock); at(cap, sx * (3.9 + gap / 2), H + 1.1, -.6); cap.scale.z = .9; G.add(cap); });
    const fg = new THREE.BoxGeometry(gap + .3, H + .4, L + 1, 10, 18, 30); fg.translate(0, (H + .4) / 2 - .2, (L + 1) / 2); const fill = at(M(bumpy(fg, .1, 9, 2.2), rock), 0, 0, -(L + 1) / 2); G.add(fill);
    const sun = at(glow(7, 0xffd28a, 0), 0, 1.6, -L / 2 - 2.5); G.add(sun);
    const hammer = (F) => { const h = new THREE.Group(); h.add(at(M(new THREE.CylinderGeometry(.03, .035, .62, 8).rotateX(Math.PI / 2), mat(0x6b4a32, { p: 'wood' })), 0, 0, .28),
      at(M(roundedBox(.2, .12, .13, .03), mat(0x55585e, { p: 'iron' })), 0, 0, .6)); at(h, 0, -.74, .02); F.aR.add(h); return h; };
    const F = figure(), ham = xong ? null : hammer(F); F.G.rotation.y = Math.PI; G.add(F.G);
    const folk = xong ? [...Array(4)].map((_, k) => { const P = figure({ size: [.95, .7, 1, .85][k], color: [0xd8c3a0, 0xc9b08a, 0xe2d1b3, 0xcfb894][k] }); G.add(P.G); return P; }) : [];
    const chips = points(70, .08, 0xe0d4c0, (i, t, v) => { const per = .7, n = Math.floor(t / per), dt = t - n * per, r = rng(i + n * 97), a = r() * 6.28;
      v.set(Math.cos(a) * dt * 1.6, 1.2 + Math.sin(a) * dt * .9 + 1.6 * dt - 4.9 * dt * dt, dt * (.6 + r() * 1.4)); }, { op: .85 }); G.add(chips);
    const dust = points(40, .35, 0xb8a888, (i, t, v) => { const r = rng(i + 3), ph = (t * .15 + r()) % 1; v.set((r() - .5) * gap, .3 + ph * 2.5, (r() - .5) * 1.5); }, { op: .12 }); G.add(dust);
    const yr = o.nam ? textSprite(String(o.nam[0]), { color: '#ffd36a', size: 150, sx: 1.5 }) : null; if (yr) G.add(yr);
    return { G, mood: { key: .85, rim: 1.35, fog: .016 }, update(s, K) {
      const pr = xong ? 1 : lerp(o.tu ?? 0, o.den ?? 1, sm(s.u)), face = -L / 2 - .5 + (L + 1) * (1 - pr); fill.scale.z = Math.max(.001, 1 - pr); fill.visible = pr < .995;
      sun.material.opacity = xong ? .95 : sm((pr - .85) / .15) * .95;
      if (yr) { yr.set(String(Math.round(lerp(o.nam[0], o.nam[1], xong ? 1 : sm(s.u))))); at(yr, 0, 2.6, face + .5); yr.visible = !xong; }
      if (!xong) { F.rest(); at(F.G, .15, 0, face + .78); const per = .7, ph = (s.lt % per) / per, up = ph < .62 ? sm(ph / .62) : 1 - eo3((ph - .62) / .38);
        F.aR.rotation.x = lerp(-1.25, -2.75, up); F.aL.rotation.x = -1.1; F.aL.rotation.z = .25; F.B.rotation.x = lerp(.18, -.05, up); F.head.rotation.x = .25;
        F.lL.rotation.x = .25; F.lR.rotation.x = -.15; chips.visible = true; chips.position.set(0, 0, face + .05); chips.tick(s.lt + .43); dust.position.z = face + .8; dust.tick(s.t);
        const back = lerp(7.5, 5.4, sm(s.u)), cz = face + back, cx = cz > L / 2 + .6 ? lerp(1.6, .45, sm(s.u * 2.5)) : .45; K.cam(cx, lerp(3.2, 2.5, s.u), cz, 0, 1.4, face - .6); }
      else { chips.visible = false; dust.visible = false; F.G.rotation.y = 0; at(F.G, .2, 0, lerp(-1.5, 3.2, sm(s.u))); F.walk(s.lt * 5, .5);
        folk.forEach((P, k) => { P.G.rotation.y = 0; at(P.G, [-.45, .5, -.3, .35][k], 0, lerp(-1.5, 3.2, sm(s.u)) - 1.4 - k * 1.25); P.walk(s.lt * 5 + k, .5); });
        K.cam(lerp(.8, .3, s.u), lerp(1.6, 2.2, s.u), lerp(9, 7.5, sm(s.u)), 0, 1.4, -3); } } }; },

  // grand piano on a dark stage, figure playing, glowing notes and sound rings; { diec: true } → notes grey out and the rings stop reaching far (deafness)
  'piano'(o) { const G = new THREE.Group(), diec = !!o.diec, lac = mat(0x0c0c0e, { r: .18, m: .1 }), ivory = mat(0xf2ede2, { r: .4 }), ebon = mat(0x111111, { r: .3 });
    G.add(ground(40, 0x161311));
    const body = M(plate([[-.85, 0], [.85, 0], [.85, .8], [.55, 1.4], [.1, 2.1], [-.35, 2.5], [-.85, 2.55]], .38, { bevel: .03, center: false }).rotateX(-Math.PI / 2), lac); at(body, 0, .62, 0); G.add(body);
    const lid = M(plate([[-.85, 0], [.85, 0], [.85, .8], [.55, 1.4], [.1, 2.1], [-.35, 2.5], [-.85, 2.55]], .03, { bevel: .01, center: false }).rotateX(-Math.PI / 2), lac); const lidP = at(new THREE.Group(), -.85, 1.02, 0); lid.position.x = .85; lidP.add(lid); lidP.rotation.z = .65; G.add(lidP);
    G.add(at(M(new THREE.CylinderGeometry(.012, .012, 1.1, 6), mat(0x222222)), .5, 1.3, -1.3));
    [[-.7, .15], [.7, .15], [-.6, -2.2]].forEach(([x, z]) => G.add(at(M(new THREE.CylinderGeometry(.07, .05, .62, 10), lac), x, .31, z)));
    G.add(at(M(roundedBox(1.75, .06, .32), ivory), 0, .99, .15));
    for (let i = 0; i < 24; i++) if ([1, 2, 4, 5, 6].includes(i % 7)) G.add(at(M(roundedBox(.035, .04, .18), ebon), -.82 + i * .071 - .035, 1.03, .09));
    G.add(at(M(roundedBox(.9, .08, .38), mat(0x2a1a12, { p: 'leather' })), 0, .52, 1.0)); [[-.38, .85], [.38, .85], [-.38, 1.15], [.38, 1.15]].forEach(([x, z]) => G.add(at(M(roundedBox(.05, .5, .05), lac), x, .25, z)));
    const F = figure(); F.G.rotation.y = Math.PI; at(F.G, 0, -.28, 1.05); G.add(F.G);
    const spot = at(new THREE.SpotLight(0xffe0b0, 70, 18, .45, .5, 1.2), .5, 7, 2); spot.target.position.set(0, .8, .3); spot.castShadow = true; G.add(spot, spot.target);
    const notes = [...Array(14)].map((_, k) => { const n = textSprite(k % 3 ? '♪' : '♫', { color: '#ffd36a', size: 190, sx: .3, w: 256, h: 256 }); G.add(n); return n; });
    const rings = [...Array(4)].map(() => { const r = M(new THREE.TorusGeometry(1, .012, 6, 96).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd36a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }), false); r.position.set(0, 1.1, -.6); G.add(r); return r; });
    const grey = new THREE.Color(0x7a8494);
    return { G, mood: { key: .3, hemi: .25, rim: 1.1 }, update(s, K) { const fade = diec ? sm(s.u / .85) : 0;
      F.rest(); F.lL.rotation.x = F.lR.rotation.x = -1.45; F.aL.rotation.x = -1.05 + Math.sin(s.t * 7) * .06 * (1 - fade * .7); F.aR.rotation.x = -1.05 + Math.sin(s.t * 7 + 1.7) * .06 * (1 - fade * .7);
      F.aL.rotation.z = -.3; F.aR.rotation.z = .3; F.B.rotation.x = .12 + Math.sin(s.t * 1.3) * .03 + fade * .12; F.head.rotation.x = .2 + fade * .35;
      notes.forEach((n, k) => { const r = rng(k + 41), per = 3 + r() * 1.5, ph = ((s.t + r() * per) % per) / per, reach = 1 - fade * .65; n.position.set(-.6 + r() * 1.4 + Math.sin(s.t + k) * .2, 1.2 + ph * 2.2 * reach, -.4 - r() * 1.3);
        n.material.opacity = Math.sin(Math.PI * Math.min(1, ph)) * (1 - fade * .55); n.material.color.setRGB(1, 1, 1).lerp(grey, fade); });
      rings.forEach((r, k) => { const ph = ((s.t * .45 + k / 4) % 1), R = .4 + ph * 5 * (1 - fade * .8); r.scale.setScalar(R); r.material.opacity = (1 - ph) * .5 * (1 - fade * .6); r.material.color.setHex(0xffd36a).lerp(grey, fade); });
      const a = .9 - s.u * .7; K.cam(Math.sin(a) * 4.6, lerp(2.6, 2.1, s.u), Math.cos(a) * 4.6 + .4, 0, 1.25, -.3); } }; },

  // concert hall: conductor on a podium with his back to a full audience; { quay: true } → a singer turns him round and the hall waves handkerchiefs and hats
  'nha-hat'(o) { const G = new THREE.Group(), quay = o.quay !== false, wood = mat(0x4a2c1a, { p: 'wood-varnish', rep: [4, 4] }), red = mat(0x7a1c18, { p: 'fabric', rep: [3, 3] });
    G.add(at(M(new THREE.PlaneGeometry(30, 30).rotateX(-Math.PI / 2), mat(0x2a1a12, { r: .7 }), false), 0, 0, 0));
    G.add(at(M(roundedBox(10, .5, 4), wood), 0, .25, -3.2), at(M(roundedBox(14, 8, .4), mat(0x3a2418, { r: .8 })), 0, 4, -5.4));
    [-5.5, 5.5].forEach(x => G.add(at(M(roundedBox(1.6, 8, .5), red), x, 4, -4.9)));
    for (let i = 0; i < 9; i++) { const st = new THREE.Group(); st.add(at(M(new THREE.CylinderGeometry(.02, .02, 1.1, 6), mat(0x222222, { m: .6, r: .4 })), 0, .55, 0), at(M(roundedBox(.45, .32, .02), mat(0x2a2a2a)), 0, 1.15, 0));
      st.children[1].rotation.x = -.4; at(st, -3.6 + i * .9, .5, -2.6 - (i % 2) * .7); G.add(st); }
    const pod = at(M(roundedBox(1.1, .35, 1.1), wood), 0, .175, .2); G.add(pod);
    const C = figure({ color: 0x2b2522 }), Sg = figure({ color: 0xd8c3a0 }); at(C.G, 0, .35, .2); at(Sg.G, -1.1, .5, -1.6); G.add(C.G, Sg.G);
    const head = M(new THREE.SphereGeometry(.13, 10, 8), mat(0xc9a27e, { r: .6 })), body = M(new THREE.CapsuleGeometry(.18, .35, 4, 8), red), aud = [];
    const hh = new THREE.InstancedMesh(head.geometry, head.material, 96), bb = new THREE.InstancedMesh(body.geometry, mat(0x2a2330, { r: .8 }), 96), d = new THREE.Object3D();
    let n = 0; for (let row = 0; row < 8; row++) for (let i = 0; i < 12; i++) { const x = (i - 5.5) * .62 + (row % 2) * .31, z = 2.4 + row * .75, y = row * .22; aud.push([x, y, z]);
      d.position.set(x, y + .45, z); d.rotation.set(0, 0, 0); d.scale.setScalar(1); d.updateMatrix(); bb.setMatrixAt(n, d.matrix); d.position.y = y + .88; d.updateMatrix(); hh.setMatrixAt(n, d.matrix); n++; }
    G.add(hh, bb); for (let row = 0; row < 8; row++) G.add(at(M(roundedBox(8, .22, .75), mat(0x2a1a12, { r: .8 }), false), 0, row * .22 - .11 + .22, 2.4 + row * .75));
    const wave = points(140, .22, 0xffffff, (i, t, v) => { const a = aud[i % aud.length], r = rng(i + 7); v.set(a[0] + Math.sin(t * 6 + i) * .18, a[1] + 1.35 + Math.abs(Math.sin(t * 5 + r() * 6)) * .35, a[2]); }, { op: .9 });
    wave.visible = false; G.add(wave);
    const chand = [-3, 0, 3].map(x => { const g = at(glow(2.2, 0xffd59a, .7), x, 6.2, 1.5), L = at(new THREE.PointLight(0xffcf90, 6, 12, 1.5), x, 6, 1.5); G.add(g, L); return L; });
    return { G, mood: { key: .55, hemi: .45, rim: .9, fog: .02 }, update(s, K) { const turn = quay ? sm((s.u - .42) / .25) : 0, cheer = quay ? sm((s.u - .55) / .15) : 0;
      C.rest(); C.breathe(s.t); C.G.rotation.y = lerp(Math.PI, 0, turn); const beat = Math.sin(s.t * 6) * (1 - turn); C.aR.rotation.x = -1.6 + beat * .45; C.aL.rotation.x = -1.3 - beat * .3; if (turn > .9) { C.aR.rotation.x = -.3; C.aL.rotation.x = -.3; C.head.rotation.x = -.15; }
      Sg.rest(); Sg.breathe(s.t); const walk = quay ? sm((s.u - .3) / .14) : 0; at(Sg.G, lerp(-1.1, -.55, walk), lerp(.5, .35, walk), lerp(-1.6, .1, walk)); Sg.G.rotation.y = lerp(0, 1.2, walk); Sg.aR.rotation.x = -1.3 * walk * (1 - sm((s.u - .7) / .1)); Sg.aR.rotation.z = .5 * walk;
      wave.visible = cheer > 0; wave.material.opacity = .9 * cheer; wave.tick(s.t); chand.forEach(L => L.intensity = 6 + cheer * 4);
      const back = sm((s.u - .5) / .4); K.cam(lerp(1.6, .8, back), lerp(1.9, 3.2, back), lerp(-3.4, 8.5, back), lerp(0, 0, back), lerp(1.6, 1.4, back), lerp(.2, 2.8, back)); } }; },

  // rehab room: a child between parallel bars with a steel brace on the left leg; { buoc: true } → walks the bars, the brace comes off and falls, then walks free
  'nep-chan'(o) { const G = new THREE.Group(), buoc = !!o.buoc, wood = mat(0x8a6a48, { p: 'wood', rep: [3, 1] }), steel = mat(0xb8bec8, { p: 'steel', r: .25, m: .9 });
    G.add(at(M(new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2), mat(0x5a4636, { p: 'wood-varnish', rep: [6, 6] }), false), 0, 0, 0), at(M(roundedBox(14, 5, .3), mat(0x3c4552, { r: .9 })), 0, 2.5, -4));
    [-.55, .55].forEach(x => { G.add(at(M(new THREE.CylinderGeometry(.035, .035, 4.2, 12).rotateX(Math.PI / 2), steel), x, 1.0, -.6));
      [-2.5, 1.3].forEach(z => G.add(at(M(new THREE.CylinderGeometry(.03, .03, 1, 10), steel), x, .5, z))); });
    const braceOf = () => { const b = new THREE.Group(); [-.1, .1].forEach(x => b.add(at(M(new THREE.CylinderGeometry(.013, .013, .82, 8), steel), x, -.43, 0)));
      [-.14, -.46, -.78].forEach(y => { const r = M(new THREE.TorusGeometry(.11, .018, 8, 24).rotateX(Math.PI / 2), mat(0x3a2a1e, { p: 'leather' })); r.position.y = y; b.add(r); });
      b.add(at(M(roundedBox(.2, .05, .3), steel), 0, -.86, .05)); return b; };
    const F = figure({ size: .78 }), onLeg = braceOf(); F.lL.add(onLeg); G.add(F.G);
    const floor = braceOf(); floor.rotation.z = Math.PI / 2; floor.visible = false; G.add(floor);
    const win = at(glow(6, 0xffe2b0, .5), 2.5, 3.2, -3.8), L = at(new THREE.PointLight(0xffd9a0, 10, 14, 1.4), 2, 3, -2); L.castShadow = true; G.add(win, L);
    const free = at(glow(3, 0xffd36a, 0), 0, 1, 1.5); G.add(free);
    return { G, mood: { key: .45, hemi: .4, rim: .9 }, update(s, K) { F.rest(); let z = -1.6, y = 0;
      if (!buoc) { F.breathe(s.t); F.aL.rotation.z = -.55; F.aR.rotation.z = .55; F.aL.rotation.x = F.aR.rotation.x = -.35; F.B.rotation.z = Math.sin(s.t * 1.1) * .04; F.lL.rotation.x = .05; }
      else { const w = sm(s.u / .55); z = lerp(-2.2, .9, w); const ph = s.lt * (w < 1 ? 3.2 : 5.5);
        if (s.u < .55) { F.walk(ph, .28); F.aL.rotation.set(-.35, 0, -.55); F.aR.rotation.set(-.35, 0, .55); F.B.rotation.z = Math.sin(ph) * .06; }
        const off = s.u > .6; onLeg.visible = !off; floor.visible = off; if (off) { const d = sm((s.u - .6) / .08); at(floor, -.12, lerp(.5, .05, d), .9); floor.rotation.x = d * 1.4; }
        if (s.u >= .55) { const g = sm((s.u - .66) / .3); z = .9 + g * 2.2; F.walk(s.lt * 5.5, .5 * (s.u > .66 ? 1 : 0)); free.material.opacity = g * .6; at(free, 0, 1, z); } }
      at(F.G, 0, y, z); F.G.rotation.y = 0;
      const a = buoc ? lerp(.55, .15, s.u) : .5 - s.u * .35; K.cam(Math.sin(a) * 4.4, lerp(1.5, 1.3, s.u), z + Math.cos(a) * 4.4, 0, .9, z - .3); } }; },

  // Olympic track at night: runner sprints in lane 4 past three rivals, crowd flashes; { huy: N } → N medals rise and spin in front of her; { dong: true } → bronze
  'duong-chay'(o) { const G = new THREE.Group(), N = o.huy ?? 0, metal = o.dong ? mat(0xb5703a, { p: 'bronze', r: .3, m: .9 }) : mat(0xf2c14e, { p: 'gold', r: .25, m: 1 });
    G.add(at(M(new THREE.PlaneGeometry(8.4, 140).rotateX(-Math.PI / 2), mat(0xa63a28, { r: .85, rep: [4, 60] }), false), 0, .005, 0), ground(90, 0x1d3a22));
    for (let k = 0; k <= 8; k++) G.add(at(M(new THREE.PlaneGeometry(.05, 140).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf2efe8 }), false), -4.2 + k * 1.05, .01, 0));
    const fin = at(M(new THREE.PlaneGeometry(8.4, .25).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff }), false), 0, .012, 30); G.add(fin);
    [-1, 1].forEach(sd => { for (let r = 0; r < 6; r++) G.add(at(M(roundedBox(1.1, .5, 140), mat(0x22252c, { r: .9 }), false), sd * (8 + r * 1.1), .25 + r * .55, 0)); });
    const crowd = points(700, .16, 0xffffff, (i, t, v) => { const r = rng(i + 3), sd = r() < .5 ? -1 : 1, row = Math.floor(r() * 6); v.set(sd * (8 + row * 1.1), .9 + row * .55, -60 + r() * 120); }, { op: .55 }); crowd.tick(0); G.add(crowd);
    [-1, 1].forEach(sd => [-30, 0, 30].forEach(z => G.add(at(glow(9, 0xe8f0ff, .7), sd * 15, 14, z))));
    const runners = [0, 1, 2, 3].map(k => { const F = figure({ color: k ? 0xb8a58a : COL.mann }); G.add(F.G); return F; }), lanes = [-.52, -1.57, .53, 1.58];
    const medals = [...Array(N)].map((_, k) => { const m = new THREE.Group(); m.add(M(new THREE.CylinderGeometry(.32, .32, .06, 48).rotateX(Math.PI / 2), metal), at(M(new THREE.TorusGeometry(.32, .03, 8, 48), metal), 0, 0, 0));
      m.add(at(M(roundedBox(.16, .7, .02), mat(0x2b4fa0, { p: 'fabric' })), 0, .62, -.02)); G.add(m); return m; });
    return { G, mood: { key: 1, hemi: .55, rim: 1.2, fog: .012 }, update(s, K) { crowd.material.opacity = .4 + .3 * Math.abs(Math.sin(s.t * 3));
      const stop = N ? sm((s.u - .5) / .15) : 0, run = lerp(s.lt, .5 * s.D + (s.lt - .5 * s.D) * .2, N && s.u > .5 ? 1 : 0); let hz = 0;
      runners.forEach((F, k) => { const sp = k ? 7.4 - k * .25 : 8, z = -20 + run * sp, ph = run * sp * 1.25; F.rest(); F.walk(ph, k || !stop ? .95 : .95 * (1 - stop)); F.B.rotation.x = .18 * (k ? 1 : 1 - stop);
        F.aL.rotation.x *= 1.4; F.aR.rotation.x *= 1.4; at(F.G, lanes[k], 0, z); if (!k) hz = z; });
      if (N && stop > .9) { const F = runners[0]; F.rest(); F.breathe(s.t); const up = sm((s.u - .62) / .15); F.aL.rotation.z = -.12 - 2.5 * up; F.aR.rotation.z = .12 + 2.5 * up; }
      medals.forEach((m, k) => { const v = eo3((s.u - .62 - k * .07) / .25); m.visible = v > 0; at(m, lanes[0] + (k - (N - 1) / 2) * .8, 1.2 + v * 1.25, hz + .4); m.rotation.y = s.t * 1.6 + k; m.scale.setScalar(Math.max(.001, v)); });
      const front = N ? sm((s.u - .5) / .3) : 0; K.cam(lanes[0] + lerp(5.6, .5, front), lerp(1.7, 1.8, front), hz + lerp(-1.6, 6.4, front), lanes[0], lerp(1.0, 1.75, front), hz + lerp(1.2, 0, front)); } }; },
};

export function studio({ W, H, nguoi = null }) {
  PPL = nguoi || null;
  const C = create3D({ W, H, fov: 48, exposure: 1.05 }), { scene, camera, renderer } = C;
  scene.background = new THREE.Color(COL.bg); scene.fog = new THREE.FogExp2(COL.bg, .035);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .35;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const hemi = new THREE.HemisphereLight(0x8fa4d8, 0x1a140f, .5), key = new THREE.SpotLight(0xffd7a0, 140, 40, .6, .55, 1.4), rim = new THREE.DirectionalLight(COL.cool, 1.4);
  key.position.set(4, 9, 6); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0004; key.shadow.normalBias = .02; key.shadow.radius = 7; key.shadow.blurSamples = 16; rim.position.set(-6, 5, -8); scene.add(hemi, key, key.target, rim);
  const dust = points(380, .05, 0xffe6c0, (i, t, v) => { const r = rng(i + 101); v.set(-9 + r() * 18 + Math.sin(t * .2 + i) * .4, (r() * 7 + t * (.05 + r() * .08)) % 7, -9 + r() * 18); }, { op: .55 }); scene.add(dust);
  post(C, { ao: false, bloom: .32, grade: { contrast: 1.08, saturation: 1.05, warmth: .03, vignette: .5 } });
  const cache = {}, D = { key: 1, hemi: 1, rim: 1, fog: .035, env: .35, bg: COL.bg };
  const K = { cam(px, py, pz, lx, ly, lz) { camera.position.set(px, py, pz); camera.lookAt(lx, ly, lz); } };
  const S = { C, gpu: C.gpu, KINDS: Object.keys(SETS) };
  S.draw = (x, sceneKey, kind, s, o = {}) => { if (!SETS[kind]) throw new Error('sets3d: unknown set ' + kind);
    const id = sceneKey + ':' + kind; if (!cache[id]) { PPL_LIST = [o.nguoi ?? null, ...(o.nguoi_khac || [])].filter((x, i) => i || x); if (!o.nguoi && o.nguoi_khac) PPL_LIST.unshift(null); PPL_ERA = o.thoi_dai ?? null; PPL_N = 0; PPL_SEED = [...id].reduce((a, ch) => a * 31 + ch.charCodeAt(0) & 0xffff, 7); cache[id] = SETS[kind](o); PPL_LIST = []; PPL_ERA = null; scene.add(cache[id].G);
      cache[id].libs = (o.them || []).map(x => { const I = instance(x.ten, { cao: x.cao ?? 1.8, goc: x.xoay }); at(I.group, x.x ?? 0, x.y ?? 0, x.z ?? 0); cache[id].G.add(I.group); return I; }); }
    for (const k in cache) cache[k].G.visible = k === id;
    const P = cache[id], m = { ...D, ...(P.mood || {}), ...(o.mood || {}) };
    hemi.intensity = .5 * m.hemi; key.intensity = 140 * m.key; rim.intensity = 1.4 * m.rim; scene.fog.density = m.fog; scene.environmentIntensity = m.env; scene.background.setHex(m.bg); scene.fog.color.setHex(m.bg);
    const ss = { ...s, u: clamp(s.lt / Math.max(.1, s.D)) }; P.update(ss, K); P.libs.forEach(I => I.update(ss)); dust.tick(s.t); C.draw(x); };
  S.preload = TL => libPreload(namesIn(TL));   // await before drawing scenes that use library models
  return S;
}
