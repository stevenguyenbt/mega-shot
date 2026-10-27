// mega-shot · procedural geometry patterns for stylised 3D (sets3d.js, props3d.js, model library).
// Patterns adapted from img2threejs (Apache-2.0, github.com/img2threejs/img2threejs, grimoire/build/geometry_patterns.md):
// real bevels instead of sharp boxes (catch-lights), tapered sweeps with parallel-transport frames for anything that ends in a
// point (tails, horns, hair locks, blades — never a constant-radius tube), blade grind (thickness tapers spine → edge),
// lathe for revolved objects, instancing for repeats, parts overlap 0.02–0.05 so nothing floats.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
const sm = u => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };

// box with real rounded edges: r ≈ 2–8 % of the smallest side, 2–4 segments = soft catch-light
export const roundedBox = (w, h, d, r = null, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, r ?? Math.min(w, h, d) * .08);

// revolved profile [[radius, y], …] bottom → top; smooth normals across the seam
export function lathe(profile, seg = 64) { const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(1e-4, r), y)), seg); g.computeVertexNormals(); return g; }

// fluted column shaft: N flutes cut into a cylinder, slight entasis (swell at 1/3 height)
export function fluted(r = .3, h = 4, flutes = 16, depth = .035, seg = 96, hs = 24) {
  const g = new THREE.CylinderGeometry(r, r, h, seg, hs, true), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), t = y / h + .5;
    const ent = 1 + .04 * Math.sin(Math.min(1, t * 1.5) * Math.PI) - .06 * t, k = (r - depth * Math.max(0, Math.cos(a * flutes)) ** 2) * ent / r; p.setXYZ(i, x * k, y, z * k); }
  g.computeVertexNormals(); return g;
}

// tapered sweep along points with radius(u) (0 → 1 along the spine); parallel-transport frames (no 180° flips); closed tip
export function taper(points, radius = u => .1 * (1 - u), { seg = 64, radial = 12, closed = true, rz = null } = {}) {
  const curve = points.isCurve ? points : new THREE.CatmullRomCurve3(points.map(p => p.isVector3 ? p : new THREE.Vector3(...p)));
  const P = [], T = [], N = [], B = [];
  for (let i = 0; i <= seg; i++) { const u = i / seg; P.push(curve.getPointAt(u)); T.push(curve.getTangentAt(u).normalize()); }
  let n = Math.abs(T[0].y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0); n = n.sub(T[0].clone().multiplyScalar(n.dot(T[0]))).normalize();
  for (let i = 0; i <= seg; i++) { if (i) { const ax = new THREE.Vector3().crossVectors(T[i - 1], T[i]), s = ax.length(); if (s > 1e-6) n.applyAxisAngle(ax.normalize(), Math.asin(Math.min(1, s))); }
    N.push(n.clone()); B.push(new THREE.Vector3().crossVectors(T[i], n).normalize()); }
  const pos = [], idx = [], ry = typeof radius === 'function' ? radius : u => radius[Math.min(radius.length - 1, Math.round(u * (radius.length - 1)))], rzf = rz || ry;
  for (let i = 0; i <= seg; i++) { const u = i / seg, a = ry(u), b = rzf(u);
    for (let j = 0; j <= radial; j++) { const th = j / radial * Math.PI * 2, c = Math.cos(th), s = Math.sin(th); const v = P[i].clone().addScaledVector(N[i], c * a).addScaledVector(B[i], s * b); pos.push(v.x, v.y, v.z); } }
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) { const a = i * (radial + 1) + j, b = a + radial + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }   // outward winding (normal = B × T direction)
  if (closed) { const c0 = pos.length / 3; pos.push(P[0].x, P[0].y, P[0].z); for (let j = 0; j < radial; j++) idx.push(c0, j + 1, j); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

// extruded plate with bevel (plaques, leaves, keys, anvil faces). shape: THREE.Shape or [[x, y], …]
export function plate(shape, depth = .1, { bevel = .02, seg = 3, center = true } = {}) {
  const s = Array.isArray(shape) ? new THREE.Shape(shape.map(([x, y]) => new THREE.Vector2(x, y))) : shape;
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: seg, curveSegments: 24 });
  if (center) g.translate(0, 0, -depth / 2); g.computeVertexNormals(); return g;
}

// blade along +x: spine at y = +w/2, cutting edge at y = -w/2, tip at x = len. Thickness tapers spine → edge (blade grind)
export function blade(len = 2, w = .22, thick = .05, { tip = .25 } = {}) {
  const s = new THREE.Shape(); s.moveTo(0, -w / 2); s.lineTo(len - tip, -w / 2); s.quadraticCurveTo(len - tip * .3, -w / 2, len, w * .1); s.lineTo(len - tip * .5, w / 2); s.lineTo(0, w / 2); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 16, steps: 1 }); g.translate(0, 0, -thick / 2);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), h = (y + w / 2) / w; p.setZ(i, p.getZ(i) * (.08 + .92 * sm(h * 1.4))); }
  g.computeVertexNormals(); return g;
}

// n instances of geo with material; place(i, dummy) sets dummy.position/rotation/scale
export function scatter(geo, material, n, place) {
  const im = new THREE.InstancedMesh(geo, material, n), d = new THREE.Object3D();
  for (let i = 0; i < n; i++) { d.position.set(0, 0, 0); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); place(i, d); d.updateMatrix(); im.setMatrixAt(i, d.matrix); }
  im.castShadow = im.receiveShadow = true; return im;
}

// organic lump: sphere with smooth low-frequency displacement (rocks, bread, fruit, clouds). k = amplitude 0–.3
export function lump(r = 1, k = .15, seed = 1, detail = 4) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(r, detail)), p = g.attributes.position, ph = [seed * 1.7, seed * 2.3, seed * 3.1];
  for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i), n = v.clone().normalize();
    const d = Math.sin(n.x * 3 + ph[0]) * Math.cos(n.y * 2.6 + ph[1]) * .6 + Math.sin(n.z * 4.1 + n.x * 2 + ph[2]) * .4; v.addScaledVector(n, d * k * r); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}
