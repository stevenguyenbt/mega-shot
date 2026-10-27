// mega-shot · reusable 3D model library: procedural Three.js models rebuilt from a reference image (xp model new / check),
// stored in <project>/.mega-shot/models3d/<name>/model.js and reused by every later video (sets3d `vat` / `them`, props3d `lib:<name>`).
// Workflow adapted from img2threejs (Apache-2.0, github.com/img2threejs/img2threejs) in a short form: reference → detail inventory →
// blockout → form → materials, with a 4-view comparison sheet against the reference after each pass (2–3 passes, not 5–8).
//
// model.js contract:
//   export const meta = { name, height: <metres-ish>, ref: 'ref.jpg', source, license };
//   export default function build({ THREE, mat3d, geo, person, o }) { const group = new THREE.Group(); …; return { group, update(s) {} }; }
//   · sits on y = 0, faces +z, real-ish proportions; s = { t, lt, D, u } for optional animation (pivots: name them, rotate in update)
import * as THREE from 'three';
import { mat3d, PRESETS } from './mats3d.js';
import * as geo from './geo3d.js';
import { person } from './people3d.js';

const MODS = {}, PEND = {};
export const modelURL = name => `/root/.mega-shot/models3d/${encodeURIComponent(name)}/model.js`;
export function loadModel(name) { return PEND[name] || (PEND[name] = import(modelURL(name)).then(m => (MODS[name] = m))); }
export const preload = names => Promise.all([...new Set(names.filter(Boolean))].map(loadModel));
export const has = name => !!MODS[name];

// new independent instance. o.cao = target height (scene units) → uniform scale; o.goc = rest yaw (radians)
export function instance(name, o = {}) {
  const mod = MODS[name]; if (!mod) throw new Error(`model "${name}" not preloaded (library3d.preload)`);
  const r = mod.default({ THREE, mat3d, PRESETS, geo, person, o }) || {}, inner = r.group || r, wrap = new THREE.Group(); wrap.add(inner);
  if (r.update) r.update({ t: 0, lt: 0, D: 1, u: 0 });                 // build animated parts before measuring the bounds
  inner.traverse(m => { if (m.isMesh) { m.castShadow = m.castShadow !== false; m.receiveShadow = true; } });
  const box = new THREE.Box3().setFromObject(inner), h = Math.max(1e-3, box.max.y - box.min.y);
  if (o.cao) { const k = o.cao / h; inner.scale.multiplyScalar(k); inner.position.y -= box.min.y * k; } else inner.position.y -= box.min.y;
  if (o.goc) wrap.rotation.y = o.goc;
  return { group: wrap, height: o.cao || h, meta: mod.meta || {}, update: s => r.update && r.update(s) };
}
// a person model (xp model new --nguoi): returns the people3d rig (walk / rest / pivots) built from its `nguoi` spec + chi_tiet()
export function personRig(name, over = {}) {
  const mod = MODS[name]; if (!mod || !mod.nguoi) throw new Error(`"${name}" is not a person model (xp model new ${name} --nguoi)`);
  const F = person({ ...mod.nguoi, ...over }); if (mod.chi_tiet) mod.chi_tiet(F, { THREE, mat3d, geo }); return F;
}
// names referenced by a timeline (canh3d: { kieu: vat, ten }, canh3d.them[].ten, vat3d: { kieu: "lib:<name>" } / { ten })
export function namesIn(TL) {
  const out = [];
  for (const s of TL.scenes || []) { const d = s.data || {}, c = d.canh3d, v = d.vat3d;
    if (c && typeof c === 'object') { if (c.ten) out.push(c.ten); (c.them || []).forEach(x => x && x.ten && out.push(x.ten));
      [c.nguoi, ...(c.nguoi_khac || [])].forEach(x => typeof x === 'string' && out.push(x)); }
    if (v) { if (v.ten) out.push(v.ten); if (typeof v.kieu === 'string' && v.kieu.startsWith('lib:')) out.push(v.kieu.slice(4)); } }
  return out;
}
