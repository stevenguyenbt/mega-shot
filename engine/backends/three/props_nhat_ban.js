// mega-shot · Japan disaster props for props3d.js (vat3d: { kieu: nhat-ban | hut-chim }).
//   nhat-ban — 3D relief of Japan (Natural Earth coastline, geo_nhat_ban.js) on a dark sea, plate boundaries drawn on as glowing
//              trenches, plate names, plate-motion arrows, and quake/eruption pins that land on spoken words (su_kien) with a ring pulse.
//              options: tam [lon, lat], ty_le, mang (true = trenches + plate names), mui_ten (plate arrows), ghim [{ ten, lon, lat, mau }],
//                       sang (highlight one trench: nhat-ban | nankai | sagami | kuril | izu | ryukyu)
//   hut-chim — subduction cross-section: the Pacific plate slides under Japan, the plate edge bends, snaps on the event word
//              (su_kien), the sea floor kicks up and a tsunami hump runs to the coast and grows as the water gets shallow.
//              options: nhan: { bien, dat, mang, ranh } (English/Vietnamese labels)
// Pure functions of time → deterministic frames. Outlines are approximate (storytelling, not survey-accurate).
import * as THREE from 'three';
import { mat3d } from './mats3d.js';
import { JAPAN } from './geo_nhat_ban.js';
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), eo3 = u => 1 - Math.pow(1 - clamp(u), 3);
const back = (u, s = 1.6) => { u = clamp(u) - 1; return 1 + (s + 1) * u * u * u + s * u * u; };
const M = (color, o = {}) => o.op ? new THREE.MeshStandardMaterial({ color, roughness: o.r ?? .5, metalness: o.m ?? 0, emissive: o.e ?? 0, emissiveIntensity: o.ei ?? 0, transparent: true, opacity: o.op, depthWrite: o.dw ?? true, side: o.side ?? THREE.FrontSide })
  : mat3d('matte-plastic', { color, roughness: o.r ?? .55, metalness: o.m ?? 0, emissive: o.e ?? 0, emissiveIntensity: o.ei ?? 0, vary: .05, bump: .05 });
const mesh = (g, m, cast = true) => { const k = new THREE.Mesh(g, m); k.castShadow = cast; k.receiveShadow = true; return k; };
function label(text, o = {}) {
  const k = document.createElement('canvas'); k.width = o.w || 1024; k.height = o.h || 160; const g = k.getContext('2d');
  if (o.bg) { g.fillStyle = o.bg; g.beginPath(); g.roundRect(4, 4, k.width - 8, k.height - 8, 18); g.fill(); }
  g.fillStyle = o.fg || '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `${o.wt || 800} ${o.size || 78}px BVP, Oswald, Arial`;
  if (o.vien !== false) { g.lineWidth = 10; g.strokeStyle = 'rgba(0,0,0,.65)'; g.strokeText(text, k.width / 2, k.height * .54); }
  g.fillText(text, k.width / 2, k.height * .54);
  const t = new THREE.CanvasTexture(k); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); sp.renderOrder = 10; sp.userData.ar = k.width / k.height; return sp; }

// approximate plate boundaries (lon, lat)
const TRENCH = {
  kuril: [[150, 45.6], [147.6, 43.6], [145.6, 42.2], [144.4, 41.0]],
  'nhat-ban': [[144.4, 41.0], [144.0, 39.2], [143.7, 37.6], [142.9, 36.0], [142.1, 34.9]],
  izu: [[142.1, 34.9], [142.3, 32.5], [142.5, 29.5], [142.7, 27]],
  sagami: [[139.2, 35.05], [139.8, 34.6], [140.7, 34.3], [142.1, 34.9]],
  nankai: [[138.6, 34.7], [137.6, 33.9], [136.4, 33.3], [135.0, 32.8], [133.6, 32.3], [132.4, 31.4], [131.5, 30.6]],
  ryukyu: [[131.5, 30.6], [130.6, 29.2], [129.2, 27.4], [127.6, 25.6]],
  tay: [[140.4, 46.5], [139.8, 43.5], [139.3, 41], [139.0, 38.8], [138.6, 37.2], [138.3, 36.0], [138.6, 34.7]],   // eastern Sea of Japan margin → central Japan (Eurasian/Amur vs North American/Okhotsk), debated
};
const PLATE = [
  { k: 'thai-binh-duong', en: 'PACIFIC PLATE', vi: 'MẢNG THÁI BÌNH DƯƠNG', at: [147.3, 36.2], col: '#ff8a6b' },
  { k: 'philippine', en: 'PHILIPPINE SEA PLATE', vi: 'MẢNG BIỂN PHILIPPINES', at: [136.2, 29.6], col: '#ffc46a' },
  { k: 'a-au', en: 'EURASIAN PLATE', vi: 'MẢNG Á-ÂU', at: [133.4, 39.8], col: '#9fd3ff' },
  { k: 'bac-my', en: 'NORTH AMERICAN PLATE', vi: 'MẢNG BẮC MỸ', at: [143.6, 45.0], col: '#b8f0c0' },
];

export const JP_PROPS = {
  'nhat-ban'(o) {
    const G = new THREE.Group(), Mp = new THREE.Group(); G.add(Mp); Mp.position.z = -.55; const vi = o.ngon_ngu === 'vi';
    const [LON0, LAT0] = o.tam || [137.5, 37.2], K = o.ty_le ?? .27, cosl = Math.cos(LAT0 * Math.PI / 180);
    const P = ([lo, la]) => new THREE.Vector2((lo - LON0) * K * cosl * 1.25, (la - LAT0) * K);
    const V3 = (ll, y) => { const v = P(ll); return new THREE.Vector3(v.x, y, -v.y); };
    const sea = mesh(new THREE.PlaneGeometry(14, 10).rotateX(-Math.PI / 2), M(0x10304d, { r: .35, m: .15 }), false); sea.position.y = -.02; Mp.add(sea);
    const land = M(0xcdb98e, { r: .85 }), green = M(0x5f8f55, { r: .8 });
    const islands = JAPAN.map(r => { const s = new THREE.Shape(); r.map(P).forEach((v, i) => i ? s.lineTo(v.x, v.y) : s.moveTo(v.x, v.y));
      const g = new THREE.ExtrudeGeometry(s, { depth: .1, bevelEnabled: true, bevelSize: .012, bevelThickness: .02, bevelSegments: 2 }); g.rotateX(-Math.PI / 2);
      const m = mesh(g, [green, land]); Mp.add(m); return m; });
    const trenches = [], names = [];
    if (o.mang !== false) {
      for (const [k, pts] of Object.entries(TRENCH)) { const hot = o.sang === k, curve = new THREE.CatmullRomCurve3(pts.map(p => V3(p, .03)));
        const tube = mesh(new THREE.TubeGeometry(curve, 90, hot ? .03 : .018, 6), new THREE.MeshStandardMaterial({ color: hot ? 0xff3b2f : 0xff6b3d, emissive: hot ? 0xff2a10 : 0xc0340f, emissiveIntensity: hot ? 2.2 : 1.1, roughness: .4 }), false);
        tube.userData.n = tube.geometry.index.count; tube.userData.hot = hot; Mp.add(tube); trenches.push(tube); }
      for (const p of PLATE) { const sp = label(vi ? p.vi : p.en, { fg: p.col, size: 64, w: 1024, h: 120 }); const v = V3(p.at, .12); sp.position.copy(v); sp.scale.set(1.9, 1.9 / sp.userData.ar, 1); Mp.add(sp); names.push(sp); } }
    const arrows = [];
    if (o.mui_ten !== false && o.mang !== false) for (const [a, b] of [[[148.6, 37.4], [146.0, 38.0]], [[137.6, 29.3], [136.4, 30.6]]]) {
      const A = V3(a, .1), B = V3(b, .1), d = B.clone().sub(A), L = d.length(), g = new THREE.Group(), mat = M(0xffffff, { e: 0x777777, ei: .4 });
      const shaft = mesh(new THREE.CylinderGeometry(.025, .025, L * .75, 10), mat); shaft.rotation.z = -Math.PI / 2; shaft.position.x = L * .375; g.add(shaft);
      const head = mesh(new THREE.ConeGeometry(.07, L * .25, 14), mat); head.rotation.z = -Math.PI / 2; head.position.x = L * .875; g.add(head);
      g.position.copy(A); g.rotation.y = Math.atan2(-d.z, d.x); g.userData.A = A.clone(); g.userData.d = d.clone().normalize(); Mp.add(g); arrows.push(g); }
    const pins = (o.ghim || []).map(p => { const g = new THREE.Group(); g.position.copy(V3([p.lon, p.lat], .12)); const col = new THREE.Color(p.mau || '#ffd25a');
      const stem = mesh(new THREE.CylinderGeometry(.01, .01, .34, 8), M(0x1b1b1b)); stem.position.y = .17; g.add(stem);
      const head = mesh(new THREE.SphereGeometry(.06, 20, 14), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .8, roughness: .3 })); head.position.y = .36; g.add(head);
      const ring = new THREE.Mesh(new THREE.RingGeometry(.08, .11, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .9, depthWrite: false })); ring.position.y = .02; g.add(ring);
      const sp = label(p.ten, { size: 70, w: 1024, h: 130, bg: 'rgba(8,12,20,.72)' }); sp.scale.set(1.5, 1.5 / sp.userData.ar, 1); sp.position.set(p.trai ? -.85 : .85, .55 + (p.dy || 0), 0); g.add(sp);
      g.userData = { ring, sp }; Mp.add(g); return g; });
    return { G, update(s) {
      const u = eo3(s.lt / .9); islands.forEach(m => m.scale.y = Math.max(.01, u));
      trenches.forEach((tb, k) => { const pr = eo3((s.lt - .5 - k * .12) / 1.3); tb.geometry.setDrawRange(0, Math.floor(tb.userData.n * pr / 6) * 6);
        if (tb.userData.hot) tb.material.emissiveIntensity = 1.6 + .9 * Math.sin(s.t * 5); });
      names.forEach((sp, k) => sp.material.opacity = clamp((s.lt - 1.1 - k * .2) / .5));
      arrows.forEach((g, k) => { const ph = ((s.t * .35 + k * .5) % 1); g.position.copy(g.userData.A).addScaledVector(g.userData.d, ph * .25); g.visible = s.lt > 1.4; g.children.forEach(c => { c.material.transparent = true; c.material.opacity = Math.sin(Math.PI * ph) * .95; }); });
      pins.forEach((g, k) => { const t0 = (s.evs && s.evs[k] != null) ? s.evs[k] : 1.2 + k * Math.max(.6, (s.D - 2) / Math.max(1, pins.length)), a = clamp((s.lt - t0) / .4);
        g.scale.setScalar(Math.max(.001, back(a))); const rp = ((s.lt - t0) % 1.6) / 1.6; g.userData.ring.scale.setScalar(1 + rp * 7); g.userData.ring.material.opacity = s.lt > t0 ? (1 - rp) * .85 : 0; });
      const k = clamp(s.lt / s.D); Mp.rotation.y = -.12 + .24 * k * k * (3 - 2 * k); G.rotation.x = .9 - .16 * k; G.position.y = -.15 * k;   // slow orbit + tilt so the shot never sits still
    } };
  },

  'hut-chim'(o) {
    const G = new THREE.Group(), N = Object.assign({ bien: 'PACIFIC OCEAN', dat: 'JAPAN', mang: 'PACIFIC PLATE', ranh: 'TRENCH' }, o.nhan || {});
    const DZ = 1.6, ext = (pts, m) => { const s = new THREE.Shape(); pts.forEach(([a, b], i) => i ? s.lineTo(a, b) : s.moveTo(a, b)); const g = new THREE.ExtrudeGeometry(s, { depth: DZ, bevelEnabled: false }); g.translate(0, 0, -DZ / 2); return mesh(g, m); };
    const rock = M(0x8a6a4a, { r: .9 }), rock2 = M(0x6e5238, { r: .9 }), slabM = M(0x3c4652, { r: .7, e: 0x000000 }), grass = M(0x6f9a5a, { r: .8 });
    // overriding plate (Japan) with a separate bendable tip
    G.add(ext([[-3.6, -1.9], [-3.6, .9], [-.9, .9], [-.2, .35], [-.55, -.5], [-1.4, -1.9]], rock));
    const top = ext([[-3.6, .9], [-3.6, 1.0], [-1.0, 1.0], [-.9, .9]], grass); G.add(top);
    const tipPivot = new THREE.Group(); tipPivot.position.set(-.2, .35, 0); G.add(tipPivot);
    const tip = ext([[0, 0], [1.25, -.62], [.95, -.86], [-.35, -.85]], rock2); tipPivot.add(tip);
    // subducting slab (Pacific plate)
    const slab = ext([[3.6, -.2], [1.05, -.55], [-1.2, -1.95], [-.35, -1.95], [1.35, -1.0], [3.6, -.68]], slabM); G.add(slab);
    const stripes = []; for (let k = 0; k < 7; k++) { const st = mesh(new THREE.BoxGeometry(.06, .02, DZ * .98), M(0xd0d6de, { e: 0x333333, ei: .3 }), false); G.add(st); stripes.push(st); }
    const slabPt = u => u < .5 ? new THREE.Vector3(3.6 - (3.6 - 1.05) * u * 2, -.2 - .35 * u * 2 + .005, 0) : new THREE.Vector3(1.05 - 2.25 * (u - .5) * 2, -.55 - 1.4 * (u - .5) * 2 + .005, 0);
    // houses on the coast
    for (let k = 0; k < 5; k++) { const h = mesh(new THREE.BoxGeometry(.13, .12 + (k % 2) * .06, .16), M(k % 2 ? 0xe9e1d0 : 0xd8cbb0)); h.position.set(-2.6 + k * .32, 1.06 + (k % 2) * .03, (k % 3 - 1) * .4); G.add(h);
      const r = mesh(new THREE.ConeGeometry(.12, .09, 4), M(0x8f2b1e)); r.rotation.y = Math.PI / 4; r.position.set(h.position.x, 1.16 + (k % 2) * .09, h.position.z); G.add(r); }
    // sea: water body + animated surface (shore at x ≈ -0.95)
    const NX = 120, X0 = -.95, X1 = 3.6, surfG = new THREE.PlaneGeometry(X1 - X0, DZ, NX, 1).rotateX(-Math.PI / 2); surfG.translate((X0 + X1) / 2, 0, 0);
    const surf = new THREE.Mesh(surfG, new THREE.MeshStandardMaterial({ color: 0x2f7fb4, roughness: .15, metalness: .1, transparent: true, opacity: .82, side: THREE.DoubleSide })); surf.position.y = .62; G.add(surf);
    const body = new THREE.Mesh(new THREE.BoxGeometry(X1 - X0, .5, DZ), new THREE.MeshStandardMaterial({ color: 0x1d5f8c, transparent: true, opacity: .35, depthWrite: false })); body.position.set((X0 + X1) / 2, .37, 0); G.add(body);
    const base = surfG.attributes.position.array.slice();
    // labels
    const L = (txt, x, y, s = 1.5, col) => { const sp = label(txt, { size: 70, fg: col || '#fff' }); sp.scale.set(s, s / sp.userData.ar, 1); sp.position.set(x, y, DZ / 2 + .05); G.add(sp); return sp; };
    const lb = [L(N.dat, -2.3, 1.55, 2.6), L(N.bien, 2.3, 1.05, 2.8, '#bfe6ff'), L(N.mang, 2.4, -1.25, 2.6, '#ffd2c2'), L(N.ranh, 1.1, .02, 1.8, '#ffb39a')];
    const star = new THREE.Mesh(new THREE.SphereGeometry(.09, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffd25a, transparent: true })); star.position.set(.45, -.62, DZ / 2 + .02); G.add(star);
    const shock = new THREE.Mesh(new THREE.RingGeometry(.1, .14, 48), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, depthTest: false })); shock.position.copy(star.position); G.add(shock);
    return { G, update(s) {
      const ev = s.ev ?? s.D * .5, pre = clamp(s.lt / Math.max(.5, ev)), post = s.lt - ev;
      // slab creeps toward Japan (stripes move), the tip is dragged down until the snap
      stripes.forEach((st, k) => { const u = ((k / 7 + s.t * .045) % 1), p = slabPt(u), q = slabPt(Math.min(1, u + .01)); st.position.set(p.x, p.y, 0); st.rotation.z = Math.atan2(q.y - p.y, q.x - p.x); });
      const bend = post < 0 ? -.16 * eo3(pre) : -.16 * Math.exp(-post * 6) * Math.cos(post * 22) + .03 * Math.exp(-post * 2);
      tipPivot.rotation.z = bend;
      tip.material.emissive = new THREE.Color(0x5a0a00); tip.material.emissiveIntensity = post < 0 ? .9 * pre * pre : Math.max(0, .9 * (1 - post * 3));
      star.material.opacity = post >= 0 ? Math.max(0, 1 - post * .9) : 0; star.scale.setScalar(post >= 0 ? 1 + 1.5 * Math.min(1, post * 3) : .001);
      shock.material.opacity = post >= 0 ? Math.max(0, .9 - post * .9) : 0; shock.scale.setScalar(post >= 0 ? 1 + post * 9 : .001);
      // water: hump above the trench after the snap, splits; the landward wave slows and grows in shallow water
      const a = surfG.attributes.position.array;
      for (let i = 0; i < a.length; i += 3) { const x0 = base[i]; let y = Math.sin(x0 * 3 + s.t * 1.6) * .008;
        if (post > 0) { const sp = .9, A0 = .2 * Math.min(1, post * 4), xl = 1.0 - sp * post * (1 - .25 * clamp(post / 2.6)), xr = 1.0 + sp * 1.3 * post;
          const grow = 1 + 1.8 * clamp((1.0 - xl) / 2), wl = .22 / Math.sqrt(grow);
          y += A0 * grow * Math.exp(-((x0 - xl) ** 2) / wl) + A0 * .7 * Math.exp(-((x0 - xr) ** 2) / .3); }
        a[i + 1] = base[i + 1] + y; }
      surfG.attributes.position.needsUpdate = true; surfG.computeVertexNormals();
      lb.forEach((sp, k) => sp.material.opacity = clamp((s.lt - .4 - k * .25) / .5));
      G.rotation.y = -.16 + Math.sin(s.t * .15) * .04; G.rotation.x = .12;
    } };
  },
};
