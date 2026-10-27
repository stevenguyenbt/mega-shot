// mega-shot · anatomy3d — clean medical-style 3D anatomy for explainer videos (procedural, no downloads).
// Spine T1–L5 (17 vertebrae: body, pedicles, lamina, spinous + transverse processes, discs), 12 rib pairs, pelvis, scapulae,
// translucent body shell, and spinal-surgery hardware: pedicle screws, rods, brace, bone graft, spinal cord.
// Viewer looks at the patient's BACK: +z = posterior (toward camera), +x = patient's right, +y = up.
//   const R = spineRig({ shell: true }); scene.add(R.group);
//   R.pose({ A: 1, rot: 1 })        A = scoliosis amount (0 straight · 1 ≈ 55° Cobb thoracic), rot = axial-rotation factor
//   R.screws(u => …)                per-level insertion 0–1 ·  R.rods({ show, drop, follow })  ·  R.cobb() → { deg, top, bot }
//   R.headWorld(i, side) / R.vertWorld(i) → THREE.Vector3 (for 2D labels: project with the camera)
//   R.headsAt(A, rot) → screw-head positions (group-local) of a target pose = pre-bent rod shape for R.rods({ target })
import * as THREE from 'three';
import { mat3d } from './mats3d.js';
import { roundedBox, lathe, plate, lump } from './geo3d.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (a, b, u) => a + (b - a) * u;
const M = (g, m, cast = true) => { const k = new THREE.Mesh(g, m); k.castShadow = cast; k.receiveShadow = true; return k; };
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

export const N_VERT = 17, THORACIC = 12;
export const LEVELS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'L1', 'L2', 'L3', 'L4', 'L5'];

// ---------- materials ----------
export function anatomyMats() {
  return {
    bone: mat3d('ceramic', { color: 0xe6d8bb, roughness: .62, clearcoat: .05, vary: .07, bump: .14, seed: 3 }),
    boneHi: new THREE.MeshStandardMaterial({ color: 0xf3e6c8, roughness: .45, emissive: 0xffc870, emissiveIntensity: 0 }),
    disc: new THREE.MeshPhysicalMaterial({ color: 0x9fc3df, roughness: .35, transmission: 0, transparent: true, opacity: .85, clearcoat: .4 }),
    metal: mat3d('brushed-steel', { color: 0xc9d1da, roughness: .28, metalness: 1, seed: 5 }),
    rod: mat3d('brushed-steel', { color: 0xd8dde4, roughness: .22, metalness: 1, seed: 7 }),
    head: mat3d('aluminium', { color: 0x8fa9c7, roughness: .3, metalness: 1, seed: 9 }),
    graft: mat3d('stone', { color: 0xe4cfa0, roughness: .9, vary: .15, bump: .5, seed: 11 }),
    shell: new THREE.MeshPhysicalMaterial({ color: 0x9cc8ff, emissive: 0x16365e, emissiveIntensity: .6, roughness: .3, transparent: true, opacity: .14, depthWrite: false, side: THREE.DoubleSide, clearcoat: .6 }),
    brace: new THREE.MeshPhysicalMaterial({ color: 0xe9f1fa, roughness: .35, clearcoat: .6, transparent: true, opacity: .78, side: THREE.DoubleSide }),
    strap: new THREE.MeshStandardMaterial({ color: 0x1f4f8f, roughness: .7 }),
    cord: new THREE.MeshStandardMaterial({ color: 0xfff1b0, emissive: 0xffc94a, emissiveIntensity: 1.6, roughness: .4 }),
  };
}

// ---------- one vertebra (local frame: body anterior at -z, arch posterior at +z), size s ----------
function vertebra(i, m) {
  const t = i / (N_VERT - 1), s = lerp(.72, 1.08, t), lumbar = i >= THORACIC, G = new THREE.Group(); G.userData.s = s;
  const h = lerp(.12, .17, t) * 1.05, r = .19 * s;
  const body = M(lathe([[r * .97, -h / 2], [r, -h / 2 + .012], [r * .93, 0], [r, h / 2 - .012], [r * .97, h / 2]], 40), m.bone); body.scale.z = .82; at(body, 0, 0, -.2 * s); G.add(body);
  for (const sx of [-1, 1]) {
    const ped = M(new THREE.CylinderGeometry(.034 * s, .04 * s, .16 * s, 14).rotateX(Math.PI / 2), m.bone); at(ped, sx * .095 * s, .005, -.04 * s); G.add(ped);
    const tp = M(roundedBox(lumbar ? .2 * s : .16 * s, .045 * s, .05 * s, .018 * s), m.bone); at(tp, sx * (lumbar ? .2 : .175) * s, .01, lumbar ? .0 : .03 * s); tp.rotation.z = sx * (lumbar ? .05 : -.18); tp.rotation.y = sx * (lumbar ? 0 : .35); G.add(tp);
    const fac = M(new THREE.SphereGeometry(.035 * s, 14, 10), m.bone); at(fac, sx * .09 * s, h * .45, .07 * s); fac.scale.set(1, .7, .8); G.add(fac);
  }
  const lam = M(roundedBox(.2 * s, .085 * s, .05 * s, .02 * s), m.bone); at(lam, 0, 0, .075 * s); G.add(lam);
  const spLen = lumbar ? .17 * s : .24 * s, sp = M(roundedBox(.045 * s, lumbar ? .09 * s : .05 * s, spLen, .02 * s), m.bone);
  const spG = at(new THREE.Group(), 0, -.01, .09 * s); spG.rotation.x = lumbar ? .12 : .62; at(sp, 0, 0, spLen / 2); spG.add(sp); G.add(spG);
  G.userData.h = h; return G;
}

// rib curve in the vertebra frame for side sx (+1 right), level k (0..11); returns TubeGeometry
function ribGeo(k, sx) {
  const L = [.55, .72, .84, .93, 1, 1.03, 1.03, 1, .95, .86, .62, .45][k], drop = .18 + k * .012;
  const P = [[.17, 0, .04], [.42, -.03 * L, .1], [.78 * L, -.14 * L - drop * .2, .02], [1.02 * L, -.3 * L - drop * .4, -.32 * L], [.98 * L, -.42 * L - drop * .6, -.7 * L], [.7 * L, -.5 * L - drop * .8, -.98 * L]];
  const pts = (k >= 10 ? P.slice(0, 5) : P).map(([x, y, z]) => new THREE.Vector3(sx * x, y, z));
  const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, .021, 8, false); g.scale(1, 1.35, 1); return g;
}

// ---------- the rig ----------
export function spineRig({ shell = true, ribs = true, pelvis = true, scapula = true, mats = anatomyMats(), top = 5.2 } = {}) {
  const m = mats, group = new THREE.Group(), V = [], D = [], base = [];
  let y = top;
  for (let i = 0; i < N_VERT; i++) {
    const v = vertebra(i, m), h = v.userData.h; y -= h / 2; base.push(y); y -= h / 2 + .05;
    v.userData.ribs = [];
    if (ribs && i < THORACIC) for (const sx of [-1, 1]) { const r = M(ribGeo(i, sx), m.bone); v.add(r); v.userData.ribs.push(r); }
    V.push(v); group.add(v);
  }
  for (let i = 0; i < N_VERT - 1; i++) { const d = M(new THREE.CylinderGeometry(.18, .18, .05, 32), m.disc, false); d.scale.z = .82; D.push(d); group.add(d); }
  const P = new THREE.Group(); group.add(P);                                       // pelvis + sacrum below L5
  if (pelvis) {
    const yb = base[N_VERT - 1] - .3;
    const sac = M(roundedBox(.34, .5, .2, .06), m.bone); sac.geometry.translate(0, -.25, 0); at(sac, 0, yb + .05, -.12); sac.rotation.x = .35; P.add(sac);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Shape(); ear.moveTo(0, 0); ear.bezierCurveTo(sx * .1, .3, sx * .55, .36, sx * .7, .1); ear.bezierCurveTo(sx * .78, -.12, sx * .62, -.42, sx * .36, -.5);
      ear.bezierCurveTo(sx * .2, -.54, sx * .06, -.4, 0, 0);
      const wing = M(plate(ear, .05, { bevel: .03 }), m.bone); wing.scale.setScalar(.82); at(wing, sx * .16, yb - .12, -.22); wing.rotation.y = -sx * .95; wing.rotation.x = .2; P.add(wing);
      const ring = M(new THREE.TorusGeometry(.15, .045, 10, 28, Math.PI * 1.4), m.bone); at(ring, sx * .28, yb - .62, -.3); ring.rotation.set(Math.PI / 2, 0, sx > 0 ? .3 : 2.8); P.add(ring);
    }
  }
  const SC = [];
  if (scapula) for (const sx of [-1, 1]) {
    const sh = [[0, 0], [.2, .04], [.46, .02], [.4, -.18], [.24, -.62], [.12, -.92], [.04, -.7], [-.02, -.3]].map(([a, b]) => [sx * a, b]);
    const s = M(plate(sh, .02, { bevel: .012 }), m.bone); s.scale.setScalar(.82); at(s, sx * .4, base[1] + .02, .16); s.rotation.y = -sx * .4; SC.push(s); group.add(s);
    const ridge = M(roundedBox(.42, .035, .05, .015), m.bone); at(ridge, sx * .22, -.12, .03); ridge.rotation.z = sx * .18; s.add(ridge);
  }
  // translucent body shell (torso + neck + head + upper arms), centred slightly anterior of the spine
  const SH = new THREE.Group(); group.add(SH);
  if (shell) {
    const prof = [[.02, .1], [.85, .25], [.92, .7], [.82, 1.35], [.74, 1.9], [.82, 2.6], [.95, 3.3], [1.0, 3.9], [1.12, 4.55], [1.02, 4.95], [.5, 5.3], [.3, 5.5], [.3, 5.85], [.02, 5.9]];
    const torso = M(lathe(prof.map(([r, yy]) => [r, yy]), 72), m.shell, false); torso.scale.z = .58; at(torso, 0, 0, -.3); SH.add(torso);
    const head = M(new THREE.SphereGeometry(.42, 40, 28), m.shell, false); head.scale.set(.9, 1.12, 1); at(head, 0, 6.3, -.32); SH.add(head);
    for (const sx of [-1, 1]) { const arm = M(new THREE.CapsuleGeometry(.2, 1.7, 8, 20), m.shell, false); at(arm, sx * 1.3, 3.75, -.32); arm.rotation.z = sx * .12; SH.add(arm); }
    SH.renderOrder = 5;
  }
  // hardware: pedicle screws on levels T3–L3 (both sides)
  const SCR = [];
  const shaftGeo = lathe(Array.from({ length: 25 }, (_, k) => [k % 2 ? .021 : .028, -.3 + k * .0125]).concat([[.03, .02]]).map(([r, yy], k, a) => k === 0 ? [.004, -.31] : [r, yy]), 20).rotateX(-Math.PI / 2);
  const tulip = new THREE.CylinderGeometry(.05, .045, .085, 20).rotateX(Math.PI / 2);
  for (let i = 2; i <= 14; i++) for (const sx of [-1, 1]) {
    const S = new THREE.Group(), sh = M(shaftGeo, m.metal), tu = M(tulip, m.head); at(tu, 0, 0, .06); S.add(sh, tu);
    const s = V[i].userData.s; S.userData = { i, sx, home: new THREE.Vector3(sx * .095 * s, .005, .2 * s) };
    S.visible = false; V[i].add(S); SCR.push(S);
  }
  // rods (rebuilt tubes) + spinal cord + graft chunks
  const rods = [null, null], cord = { mesh: null };
  const graft = [];
  for (let i = 2; i < 14; i++) for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) {
    const g = M(lump(.045, .25, i * 7 + k * 3 + (sx > 0 ? 1 : 0), 2), m.graft); g.userData = { i, sx, k }; g.visible = false; group.add(g); graft.push(g);
  }
  let curA = 0, curRot = 1;
  const xc = (t, A) => .66 * A * (.52 * Math.exp(-(((t - .4) / .19) ** 2)) - .34 * Math.exp(-(((t - .86) / .12) ** 2)));
  const R = { group, V, D, P, SH, SC, SCR, mats: m, base };
  R.pose = ({ A = 0, rot = 1, lean = 0 } = {}) => {
    curA = A; curRot = rot;
    for (let i = 0; i < N_VERT; i++) {
      const t = i / (N_VERT - 1), x = xc(t, A), dx = (xc(t + .01, A) - xc(t - .01, A)) / (.02 * (base[0] - base[N_VERT - 1]));
      const v = V[i]; v.position.set(x, base[i], 0); v.rotation.set(0, -1.1 * rot * x, Math.atan(dx), 'ZYX');
    }
    for (let i = 0; i < N_VERT - 1; i++) { const a = V[i], b = V[i + 1], d = D[i]; d.position.lerpVectors(a.position, b.position, .5); d.position.y = (base[i] - V[i].userData.h / 2 + base[i + 1] + V[i + 1].userData.h / 2) / 2;
      d.rotation.z = (a.rotation.z + b.rotation.z) / 2; d.rotation.y = (a.rotation.y + b.rotation.y) / 2; d.position.z = -.2 * lerp(a.userData.s, b.userData.s, .5); }
    SC.forEach((s, k) => { s.position.y = base[1] + .05 + (k ? 1 : -1) * A * .09; });   // uneven shoulders follow the curve
    if (SH.children.length) SH.rotation.z = -A * .045;
    group.updateMatrixWorld(true);
  };
  R.cobb = () => {                                                                   // thoracic Cobb angle (deg) from end-vertebra tilt
    let mx = -1e9, mn = 1e9, top = 0, bot = 0;
    for (let i = 0; i < 13; i++) { const z = V[i].rotation.z; if (z > mx) { mx = z; top = i; } if (z < mn) { mn = z; bot = i; } }
    return { deg: (mx - mn) * 180 / Math.PI, top: Math.min(top, bot), bot: Math.max(top, bot) };
  };
  R.screws = f => SCR.forEach((S, k) => { const u = clamp(f(S.userData.i, S.userData.sx, k)); S.visible = u > 0; const h = S.userData.home;
    S.position.set(h.x, h.y, h.z + (1 - u) * .55); S.rotation.set(0, 0, u * Math.PI * 7); });
  R.headWorld = (i, sx) => { const S = SCR.find(s => s.userData.i === i && s.userData.sx === sx); return S.localToWorld(new THREE.Vector3(0, 0, .06)); };
  R.vertWorld = (i, local = new THREE.Vector3(0, 0, 0)) => V[i].localToWorld(local.clone());
  R.rods = ({ show = 0, drop = 0, target = null, radius = .03 } = {}) => {     // target: Vector3[] per side (pre-bent shape); else follows screw heads
    for (const k of [0, 1]) {
      if (rods[k]) { group.remove(rods[k]); rods[k].geometry.dispose(); rods[k] = null; }
      if (show <= 0) continue;
      const sx = k ? 1 : -1, pts = (target ? target[k].map(p => p.clone()) : SCR.filter(s => s.userData.sx === sx).map(s => group.worldToLocal(s.localToWorld(new THREE.Vector3(0, 0, .06))))).map(p => p.add(new THREE.Vector3(0, 0, drop)));
      const a = pts[0].clone().add(pts[0].clone().sub(pts[1]).multiplyScalar(.35)), b = pts[pts.length - 1].clone().add(pts[pts.length - 1].clone().sub(pts[pts.length - 2]).multiplyScalar(.35));
      const n = Math.max(2, Math.round(show * (pts.length + 2)));
      const curve = new THREE.CatmullRomCurve3([a, ...pts, b]);
      const g = new THREE.TubeGeometry(curve, 120, radius, 12, false); g.setDrawRange(0, Math.floor(g.index.count * clamp(show)) - (Math.floor(g.index.count * clamp(show)) % 3));
      rods[k] = M(g, m.rod); group.add(rods[k]);
    }
  };
  R.headsAt = (A, rot = 1) => { const keepA = curA, keepR = curRot; R.pose({ A, rot }); R.screws(() => 1);
    const out = [-1, 1].map(sx => SCR.filter(s => s.userData.sx === sx).map(s => group.worldToLocal(s.localToWorld(new THREE.Vector3(0, 0, .06))))); R.pose({ A: keepA, rot: keepR }); return out; };
  R.cordUpdate = (show = 1, glow = 1.6) => {
    if (cord.mesh) { group.remove(cord.mesh); cord.mesh.geometry.dispose(); cord.mesh = null; }
    if (show <= 0) return; m.cord.emissiveIntensity = glow;
    const pts = V.map(v => group.worldToLocal(v.localToWorld(new THREE.Vector3(0, 0, .015))));
    pts.unshift(pts[0].clone().add(new THREE.Vector3(0, .5, 0)));
    cord.mesh = M(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, .036, 12, false), m.cord, false); group.add(cord.mesh);
  };
  R.graft = u => graft.forEach(g => { const { i, sx, k } = g.userData, uu = clamp(u * 1.6 - (i - 2) / 12 * .6); g.visible = uu > 0;
    const p = V[i].localToWorld(new THREE.Vector3(sx * .06, -.08 - k * .07, .13)); g.position.copy(group.worldToLocal(p)); g.scale.setScalar(.2 + .8 * uu); g.rotation.set(i, k * 2, sx); });
  R.fuse = (u, from = 2, to = 14) => { for (let i = from; i < to; i++) { const d = D[i]; d.material = u > .02 ? (d.userData.fm ||= m.disc.clone()) : m.disc;
      if (u > .02) { d.material.color.lerpColors(new THREE.Color(0x9fc3df), new THREE.Color(0xeee2c8), clamp(u)); d.material.opacity = lerp(.85, 1, u); } } };
  R.shellOpacity = o => { m.shell.opacity = o; SH.visible = o > .005; };
  R.pose({ A: 0 });
  return R;
}

// ---------- TLSO brace around the torso shell: opening at the back (+z) closed by straps ----------
export function brace(mats = anatomyMats()) {
  const G = new THREE.Group();
  const prof = [[.9, 1.0], [.96, 1.3], [.86, 1.9], [.8, 2.4], [.9, 3.0], [.96, 3.45]];
  const shellG = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r * 1.08, y)), 64, Math.PI * .62, Math.PI * 1.76); shellG.computeVertexNormals();
  const s = M(shellG, mats.brace); s.scale.z = .66; at(s, 0, 0, -.3); G.add(s);
  for (const y of [1.25, 1.85, 2.5, 3.15]) { const st = M(roundedBox(.62, .1, .03, .012), mats.strap); at(st, 0, y, .32); G.add(st); }
  return G;
}

// project a world point to canvas pixels
export function toScreen(p, camera, W, H) { const v = p.clone().project(camera); return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, z: v.z }; }
