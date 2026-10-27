// mega-shot · stylised 3D people for sets3d.js and the model library: male / female, 6 skin tones, hair, beards, and
// PERIOD COSTUMES so a figure fits the era of the video (Egypt, Greece, Rome, medieval Europe, ancient China, old Vietnam,
// old Japan, Arabia, 19th century, peasants, modern).
// Same rig API as the wooden mannequin — { G, B, head, torso, aL, aR, lL, lR, rest(), walk(ph, amp), breathe(t) }; elbows
// (aL.lo / aR.lo) and knees (lL.lo / lR.lo) bend. Long robes damp the leg swing so legs never poke through the hem.
//
//   person({ thoi_dai, vai, gioi, da, … any field below overrides the era preset })
//     thoi_dai: hien-dai | ai-cap | ba-tu | hy-lap | la-ma | trung-co | trung-hoa | viet-nam-xua | nhat-ban | a-rap | the-ky-19
//     vai: vua (ruler headwear / colours of that era) | nong-dan (peasant: áo nâu, nón lá, barefoot)
//     trang_phuc: hien-dai (shirt + trousers / dress) | ao-dai (robe to the ankle) | tunic (to the knee, hem: dai_ao) |
//                 khoa-than (bare chest + kilt) | vay-dai (long gown, vay_xoe: wide) | ao-khoac (frock coat over trousers)
//     xe_ta: true (áo dài side slits, tunic) · do_dai_toc: 1–2 (long hair length)
//     ao, quan ('tran' = bare legs), tay_ao: dai | ngan | rong (wide bell) | xu (Persian: cloth hanging under the arm) | khong, vay: true (modern dress)
//     that_lung (sash colour, that_lung_rong: obi), khan_choang (draped toga / himation), ao_choang (back cape), co_ao: giao-linh | ai-cap | so-mi, vien (trim)
//     mu: non-la | mu-noi (flat cap) | khan-xep | khan-van | nemes | nguyet-que | mu-trum | hijab | khan-a-rap | mu-chop | mu-quan | vuong-mien | vuong-mien-ba-tu | mu-ba-tu | mu-phrygia | khan-quan | taj-safavi | mu-mobed, mau_mu
//     toc: ngan | dai | buoc | bui | bui-dinh | bui-gay | xoan | xoan-ngan | toc-gia | tet | troc, mau_toc · rau: ngan | dai | vuong | ria | ria-dai · chan: giay | dep | ung | tran
//     giap: hy-lap (linen cuirass + pteruges, mau_giap) · che_mieng: true (Zoroastrian padan veil) · long_vu: colour (plume on the turban)
//   person.random(seed, { thoi_dai, gioi, vai }) → varied spec for crowds (skin range of the era, varied colours)
import * as THREE from 'three';
import { mat3d } from './mats3d.js';
import { roundedBox, lathe, taper, lump, fluted } from './geo3d.js';

export const SKIN = { 1: 0xf3d3bd, 2: 0xe6b893, 3: 0xc98f62, 4: 0xa06a43, 5: 0x74482c, 6: 0x4b2c1b };          // light → deep
export const HAIR = { den: 0x1b1612, nau: 0x4a2f1e, 'nau-nhat': 0x8a5a34, vang: 0xc9a25e, do: 0x8a3a1e, bac: 0xb9b6b0 };
const CLOTH = [0x2f4a7a, 0xb8432f, 0x3f6b4a, 0xd9b45a, 0x6a3d6e, 0x1f2a36, 0xe8e2d6, 0x8a5a3a, 0x2f7a8a, 0xc96a8a];
// era presets: da = typical skin range for random crowds; nam / nu = costume; vua = ruler overrides; pal = colours varied in crowds
export const ERA = {
  'hien-dai':     { da: [1, 6], nam: {}, nu: {} },
  'ai-cap':       { da: [3, 5], pal: [0xf1ead8, 0xe8dcc0, 0xf4efe2],
    nam: { trang_phuc: 'khoa-than', ao: 0xf1ead8, co_ao: 'ai-cap', toc: 'toc-gia', chan: 'dep' },
    nu:  { trang_phuc: 'vay-dai', tay_ao: 'khong', ao: 0xf1ead8, co_ao: 'ai-cap', toc: 'toc-gia', chan: 'dep' }, vua: { mu: 'nemes' } },
  'hy-lap':       { da: [2, 4], pal: [0xece5d4, 0xd9cdb0, 0xc9d4dc],
    nam: { trang_phuc: 'tunic', tay_ao: 'ngan', ao: 0xece5d4, quan: 'tran', khan_choang: 0x3f5f8a, toc: 'xoan-ngan', rau: 'ngan', chan: 'dep' },
    nu:  { trang_phuc: 'vay-dai', tay_ao: 'ngan', ao: 0xece5d4, khan_choang: 0xb86a4a, toc: 'bui', chan: 'dep' }, vua: { mu: 'nguyet-que' } },
  'la-ma':        { da: [2, 4], pal: [0xe9e2d0, 0xd9c9a8, 0xb8a888],
    nam: { trang_phuc: 'tunic', tay_ao: 'ngan', ao: 0xb8432f, quan: 'tran', khan_choang: 0xece6d6, that_lung: 0x6a4a2a, toc: 'xoan-ngan', chan: 'dep' },
    nu:  { trang_phuc: 'vay-dai', tay_ao: 'ngan', ao: 0xd9c9a8, khan_choang: 0x8a2b4a, toc: 'bui', chan: 'dep' }, vua: { mu: 'nguyet-que', khan_choang: 0x6a1f4a, ao: 0xece6d6 } },
  'trung-co':     { da: [1, 2], pal: [0x5a4a2a, 0x3f5a3a, 0x6a2a20, 0x2f4a6a],
    nam: { trang_phuc: 'tunic', tay_ao: 'dai', ao: 0x5a4a2a, quan: 0x3a3a2a, that_lung: 0x2a1a10, ao_choang: 0x6a2a20, chan: 'ung', toc: 'ngan', rau: 'ngan' },
    nu:  { trang_phuc: 'vay-dai', tay_ao: 'dai', ao: 0x2f4a6a, that_lung: 0xc9a24e, mu: 'mu-trum', mau_mu: 0xece6d8, chan: 'giay' }, vua: { mu: 'vuong-mien', ao_choang: 0x8a1f2a } },
  'trung-hoa':    { da: [1, 3], pal: [0x2f3f5a, 0x3f5a4a, 0x6a3d3a, 0xb8432f, 0x5a4a6a],
    nam: { trang_phuc: 'ao-dai', tay_ao: 'rong', co_ao: 'giao-linh', ao: 0x2f3f5a, vien: 0xece6d8, that_lung: 0x1a1a1a, toc: 'bui-dinh', chan: 'giay' },
    nu:  { trang_phuc: 'ao-dai', tay_ao: 'rong', co_ao: 'giao-linh', ao: 0xb8432f, vien: 0xd9b45a, that_lung: 0x2a2a4a, toc: 'bui', chan: 'giay' }, vua: { mu: 'mu-quan', ao: 0xc9a03a, vien: 0x8a1f1a } },
  'viet-nam-xua': { da: [2, 3], pal: [0x1f1f2a, 0x2f3a5a, 0x8a2b22, 0x3f5a4a],
    nam: { trang_phuc: 'tunic', dai_ao: .38, tay_ao: 'dai', ao: 0x1f1f2a, quan: 0xece6d8, mu: 'khan-xep', mau_mu: 0x1f1f2a, chan: 'giay' },
    nu:  { trang_phuc: 'tunic', dai_ao: .3, tay_ao: 'dai', ao: 0x8a2b22, quan: 0x1f1f1f, mu: 'khan-van', mau_mu: 0x3a1a1a, toc: 'bui', chan: 'dep' },
    vua: { trang_phuc: 'ao-dai', tay_ao: 'rong', co_ao: 'giao-linh', ao: 0xd9a03a, vien: 0x8a1f1a, mu: 'mu-quan' } },
  'ba-tu':        { da: [2, 4], pal: [0x8a5a2a, 0x5a2a6a, 0x2f4a6a, 0xb8432f, 0x6a5a3a],
    nam: { trang_phuc: 'ao-dai', tay_ao: 'xu', ao: 0x8a5a2a, that_lung: 0x3a2a1a, toc: 'bui-gay', rau: 'vuong', mu: 'mu-ba-tu', mau_mu: 0x6a4a2a, chan: 'giay' },
    nu:  { trang_phuc: 'ao-dai', tay_ao: 'xu', ao: 0x6a3d6e, that_lung: 0xc9a24e, mu: 'mu-trum', mau_mu: 0xd9c9a8, toc: 'bui', chan: 'giay' },
    vua: { mu: 'vuong-mien-ba-tu', ao: 0x5a2a6a, that_lung: 0xc9a24e } },
  'nhat-ban':     { da: [1, 3], pal: [0x2a3a5a, 0xc96a8a, 0x3f5a4a, 0x6a3d6e],
    nam: { trang_phuc: 'ao-dai', tay_ao: 'rong', co_ao: 'giao-linh', ao: 0x2a3a5a, vien: 0xece6d8, that_lung: 0x8a7a5a, toc: 'bui-dinh', chan: 'dep' },
    nu:  { trang_phuc: 'ao-dai', tay_ao: 'rong', co_ao: 'giao-linh', ao: 0xc96a8a, vien: 0xf4efe6, that_lung: 0xd9b45a, that_lung_rong: true, toc: 'bui', chan: 'dep' } },
  'a-rap':        { da: [3, 5], pal: [0xf4f1ea, 0xe8e0d0],
    nam: { trang_phuc: 'ao-dai', tay_ao: 'dai', ao: 0xf4f1ea, mu: 'khan-a-rap', mau_mu: 0xf4f1ea, rau: 'ngan', chan: 'dep' },
    nu:  { trang_phuc: 'ao-dai', tay_ao: 'dai', ao: 0x1a1a1e, mu: 'hijab', mau_mu: 0x1a1a1e, chan: 'giay' } },
  'the-ky-19':    { da: [1, 3], pal: [0x1f1f24, 0x3a2a24, 0x2a3040],
    nam: { trang_phuc: 'ao-khoac', tay_ao: 'dai', ao: 0x1f1f24, quan: 0x3a3a40, co_ao: 'so-mi', mu: 'mu-chop', rau: 'ria', chan: 'giay', toc: 'ngan' },
    nu:  { trang_phuc: 'vay-dai', vay_xoe: true, tay_ao: 'dai', ao: 0x4a2a3a, toc: 'bui', chan: 'giay' } },
  'nong-dan':     { da: [2, 4], pal: [0x6a4a30, 0x5a3a24, 0x4a3a2a],
    nam: { trang_phuc: 'hien-dai', tay_ao: 'dai', ao: 0x6a4a30, quan: 0x3a2a1a, mu: 'non-la', chan: 'tran', toc: 'ngan' },
    nu:  { trang_phuc: 'hien-dai', tay_ao: 'dai', ao: 0x5a3a24, quan: 0x1f1a16, mu: 'non-la', chan: 'tran', toc: 'bui' } },
};
const SHADE = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();
const cache = {}, M = (key, make) => cache[key] || (cache[key] = make());
const fab = (c, double) => M('c' + c + (double ? 'd' : ''), () => mat3d('fabric', { color: c, repeat: [3, 3], sheen: .5, side: double ? THREE.DoubleSide : THREE.FrontSide }));
const resolve = o => { const g = o.gioi === 'nu' ? 'nu' : 'nam', E = ERA[o.thoi_dai] || ERA['hien-dai'];
  return { ...(E[g] || {}), ...(o.vai === 'vua' ? E.vua || {} : {}), ...(o.vai === 'nong-dan' ? ERA['nong-dan'][g] : {}), ...o }; };

export function person(spec = {}) {
  const o = resolve(spec), nu = o.gioi === 'nu', H = (o.cao ?? (nu ? 1.64 : 1.76)) / 1.76, sk = SKIN[o.da ?? 2] ?? o.da, hairC = HAIR[o.mau_toc] ?? o.mau_toc ?? HAIR.den;
  const kind = o.trang_phuc || 'hien-dai', mainC = o.ao ?? (nu ? 0xb8432f : 0x2f4a7a), pantsC = o.quan ?? (nu ? 0x1f2a36 : 0x3a3a42), bareLegs = o.quan === 'tran';
  // skin without clearcoat: clearcoat gives hot glare under spotlights
  const skin = M('s' + sk, () => mat3d('skin', { color: sk, clearcoat: 0, roughness: .62, envMapIntensity: .5 })), cloth = fab(mainC), pants = bareLegs ? skin : fab(pantsC);
  const hair = M('h' + hairC, () => mat3d('fur', { color: hairC, roughness: .55, sheen: .7, sheenColor: SHADE(hairC, 1.8), vary: .12 }));
  const leather = M('lea', () => mat3d('leather', { color: 0x2a211b })), sandal = M('san', () => mat3d('leather', { color: 0x7a5232 })), gold = M('gold', () => mat3d('gold', { color: 0xe0b44c }));
  const lip = M('l' + sk, () => mat3d('skin', { color: SHADE(sk, .72), roughness: .45 })), white = M('w', () => mat3d('ceramic', { color: 0xf4f1ea })), iris = M('i', () => mat3d('plastic', { color: 0x231a14, roughness: .15, clearcoat: 1 }));
  const mesh = (g, m) => { const k = new THREE.Mesh(g, m); k.castShadow = true; k.receiveShadow = true; return k; };
  const curls = (pts, r, m) => { const im = new THREE.InstancedMesh(new THREE.SphereGeometry(r, 10, 8), m, pts.length), d = new THREE.Object3D();
    pts.forEach((p, i) => { d.position.set(p[0], p[1], p[2]); d.updateMatrix(); im.setMatrixAt(i, d.matrix); }); im.castShadow = im.receiveShadow = true; return im; };
  const G = new THREE.Group(), B = new THREE.Group(); G.add(B);
  const sh = nu ? .165 : .19, hip = nu ? .115 : .1, hipY = .93, shY = 1.43;
  const robe = kind === 'ao-dai' || kind === 'vay-dai';
  // ---- torso: shirt / robe / bare chest (khoa-than male) ----
  const tp = nu ? [[.0, hipY - .02], [.158, hipY - .015], [.165, hipY + .05], [.13, 1.08], [.125, 1.13], [.15, 1.24], [.155, 1.3], [.16, 1.37], [.12, 1.43], [.05, 1.47], [0, 1.47]]
                : [[.0, hipY - .02], [.153, hipY - .015], [.155, hipY + .06], [.15, 1.08], [.16, 1.2], [.18, 1.32], [.175, 1.4], [.12, 1.45], [.05, 1.48], [0, 1.48]];
  const torsoM = kind === 'khoa-than' && !nu ? skin : cloth, torso = mesh(lathe(tp, 40), torsoM); torso.scale.z = .62; B.add(torso);
  // ---- lower garment (lathe profile bottom → top so it faces outwards); front opening for coats ----
  const skirt = (hemY, hemR, topY, topR, m, open = 0, slits = 0) => { const pts = [[hemR * .97, hemY], [hemR, hemY + .01], [(hemR + topR) / 2 + .015, (hemY + topY) / 2], [topR, topY]].map(([r, y]) => new THREE.Vector2(r, y));
    const mk = (a0, len) => { const g = new THREE.LatheGeometry(pts, 24, a0, len); g.computeVertexNormals(); const k = mesh(g, fab(mainC, true)); k.scale.z = .8; B.add(k); return k; };
    if (slits) { mk(-Math.PI / 2 + slits, Math.PI - 2 * slits); return mk(Math.PI / 2 + slits, Math.PI - 2 * slits); }   // áo dài: front + back panels, side slits from the waist
    const g = new THREE.LatheGeometry(pts, 40, open / 2, Math.PI * 2 - open); g.computeVertexNormals(); const k = mesh(g, open ? fab(m === cloth ? mainC : 0x222222, true) : m); k.scale.z = .8; B.add(k); return k; };
  if (kind === 'hien-dai') { if (o.vay) skirt(.57, .205, 1.07, .13, cloth);
    else { const seat = mesh(lathe([[0, hipY - .1], [.12, hipY - .09], [.152, hipY - .03], [.148, hipY + .02], [0, hipY + .02]], 32), pants); seat.scale.z = .62; B.add(seat); } }
  else if (kind === 'ao-dai') skirt(.07, .25, 1.0, .16, cloth);
  else if (kind === 'vay-dai') skirt(.06, o.vay_xoe ? .36 : .25, 1.02, .14, cloth);
  else if (kind === 'tunic') { if (o.xe_ta) skirt(o.dai_ao ?? .55, .2, .98, .16, cloth, 0, .32); else skirt(o.dai_ao ?? .55, .23, 1.0, .16, cloth);
    if (o.xe_ta) { const seat = mesh(lathe([[0, hipY - .1], [.12, hipY - .09], [.152, hipY - .03], [.148, hipY + .02], [0, hipY + .02]], 32), pants); seat.scale.z = .62; B.add(seat); } }
  else if (kind === 'khoa-than') skirt(.6, .2, hipY + .04, .158, cloth);
  else if (kind === 'ao-khoac') { skirt(.5, .22, 1.0, .165, cloth, .9);
    const seat = mesh(lathe([[0, hipY - .1], [.12, hipY - .09], [.152, hipY - .03], [.148, hipY + .02], [0, hipY + .02]], 32), pants); seat.scale.z = .62; B.add(seat); }
  // ---- sash / belt, draped toga, cape, collars ----
  if (o.that_lung != null) { const w = o.that_lung_rong ? .07 : .025, band = mesh(lathe([[.165, 1.0 - w], [.17, 1.0 - w + .01], [.17, 1.0 + w - .01], [.165, 1.0 + w]], 40), fab(o.that_lung)); band.scale.z = .66; B.add(band); }
  if (o.khan_choang != null) { const m = fab(o.khan_choang);
    B.add(mesh(taper([[-.17, 1.45, .02], [-.08, 1.32, .125], [.05, 1.14, .13], [.15, .99, .1], [.185, .92, 0], [.1, .96, -.125], [-.08, 1.2, -.125], [-.18, 1.4, -.06], [-.18, 1.45, .02]], u => .062, { seg: 72, radial: 12, closed: false }), m));
    B.add(mesh(taper([[-.18, 1.42, -.02], [-.2, 1.2, -.11], [-.19, .9, -.1], [-.17, .7, -.08]], u => .05 - u * .01, { seg: 24, radial: 10 }), m)); }
  if (o.ao_choang != null) { const cape = mesh(new THREE.CylinderGeometry(.2, .33, 1.05, 28, 1, true, Math.PI / 2 + .15, Math.PI - .3), fab(o.ao_choang, true)); cape.position.set(0, .92, -.03); cape.scale.z = .75; B.add(cape);
    [-1, 1].forEach(s => B.add(mesh(new THREE.SphereGeometry(.018, 10, 8), gold).translateX(s * .12).translateY(1.43).translateZ(.06))); }
  if (o.co_ao === 'giao-linh') { const tm = fab(o.vien ?? 0xece6d8);
    B.add(mesh(taper([[-.075, 1.47, .055], [0, 1.31, .118], [.1, 1.1, .108]], u => .02, { seg: 20, radial: 8, closed: false }), tm));
    B.add(mesh(taper([[.075, 1.47, .055], [.035, 1.37, .11], [0, 1.31, .114]], u => .02, { seg: 12, radial: 8, closed: false }), tm)); }
  if (o.co_ao === 'ai-cap') { const c1 = mesh(lathe([[.2, 1.385], [.19, 1.4], [.13, 1.445], [.065, 1.47]], 40), gold); c1.scale.z = .72; B.add(c1);
    const c2 = mesh(lathe([[.165, 1.413], [.17, 1.418], [.12, 1.452], [.115, 1.45]], 40), M('lapis', () => mat3d('ceramic', { color: 0x2a4a9a }))); c2.scale.z = .73; B.add(c2); }
  if (o.co_ao === 'so-mi') { B.add(mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-.06, 1.46), new THREE.Vector2(.06, 1.46), new THREE.Vector2(0, 1.22)])), white).translateZ(.112));
    B.add(mesh(roundedBox(.05, .03, .02, .008), M('crav', () => mat3d('silk', { color: 0x1a1a1e }))).translateY(1.44).translateZ(.11)); }
  if (o.giap === 'hy-lap') { const gm = fab(o.mau_giap ?? 0xece3cf), trim = M('gtrim', () => mat3d('gold', { color: 0xc9a24e }));
    const cu = mesh(lathe([[.0, .98], [.168, .98], [.172, 1.08], [.178, 1.2], [.192, 1.32], [.186, 1.4], [.13, 1.45], [.05, 1.47], [0, 1.47]], 40), gm); cu.scale.z = .66; B.add(cu);
    const band = mesh(lathe([[.17, 1.0], [.176, 1.005], [.176, 1.035], [.17, 1.04]], 40), trim); band.scale.z = .68; B.add(band);
    [-1, 1].forEach(s => { const fl = mesh(roundedBox(.11, .03, .14, .01), gm); fl.position.set(s * .12, 1.465, .0); B.add(fl); });
    const pt = new THREE.InstancedMesh(roundedBox(.05, .16, .012, .005), gm, 22), d = new THREE.Object3D();
    for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2; d.position.set(Math.sin(a) * .175, .91, Math.cos(a) * .175 * .72); d.rotation.set(0, a, 0); d.updateMatrix(); pt.setMatrixAt(i, d.matrix); }
    pt.castShadow = true; B.add(pt);
    const gor = mesh(new THREE.CircleGeometry(.03, 20), trim); gor.position.set(0, 1.27, .127); B.add(gor); }
  // ---- neck + head ----
  const neck = mesh(new THREE.CylinderGeometry(.045, .052, .12, 16), skin); neck.position.y = 1.5; B.add(neck);
  const head = new THREE.Group(); head.position.set(0, 1.565, 0); B.add(head);
  const skull = mesh(new THREE.SphereGeometry(.105, 32, 24), skin); skull.scale.set(nu ? .92 : .96, 1.14, 1.02); skull.position.y = .06; head.add(skull);
  const jaw = mesh(new THREE.SphereGeometry(.08, 24, 16), skin); jaw.scale.set(nu ? .86 : .94, .78, .86); jaw.position.set(0, .012, .008); head.add(jaw);
  [-1, 1].forEach(s => { const ear = mesh(new THREE.SphereGeometry(.024, 12, 10), skin); ear.scale.set(.5, 1, .8); ear.position.set(s * .1, .055, -.005); head.add(ear);
    const eye = mesh(new THREE.SphereGeometry(.017, 16, 12), white); eye.scale.set(1, .85, .6); eye.position.set(s * .036, .075, .092); head.add(eye);
    const ir = mesh(new THREE.SphereGeometry(.0105, 14, 10), iris); ir.position.set(s * .036, .075, .1); head.add(ir);
    const brow = mesh(roundedBox(.038, .007, .01, .003), hair); brow.position.set(s * .037, .104, .094); brow.rotation.z = -s * (nu ? .12 : .06); head.add(brow); });
  const nose = mesh(new THREE.SphereGeometry(.016, 12, 10), skin); nose.scale.set(.9, 1.1, 1.1); nose.position.set(0, .045, .108); head.add(nose);
  const mouth = mesh(new THREE.TorusGeometry(.022, .0045, 6, 16, Math.PI * .8), lip); mouth.rotation.z = Math.PI * 1.1; mouth.position.set(0, .018, .094); head.add(mouth);
  // ---- beard ----
  if (o.rau === 'ngan' || o.rau === 'dai') { const bd = mesh(new THREE.SphereGeometry(.092, 24, 14, -Math.PI * .05, Math.PI * 1.1, Math.PI * .6, Math.PI * .32), hair); bd.scale.set(1, 1.1, 1.05); bd.position.set(0, .045, .016); head.add(bd);
    if (o.rau === 'dai') head.add(mesh(taper([[0, -.02, .085], [0, -.12, .105], [0, -.26, .1]], u => .05 * (1 - u * .75), { seg: 16, radial: 12 }), hair)); }
  if (o.rau === 'vuong') { const blk = mesh(roundedBox(.135, .23, .085, .03), hair); blk.position.set(0, -.085, .072); head.add(blk);
    const cp = []; for (let r = 0; r < 8; r++) for (let c = 0; c < 6; c++) cp.push([(c - 2.5) * .022 + (r % 2) * .006, -.005 - r * .027, .118]);
    for (let r = 0; r < 5; r++) [-1, 1].forEach(sd => cp.push([sd * .07, .02 - r * .04, .07]));
    head.add(curls(cp, .0125, hair)); }
  if (o.rau === 'ria-dai') [-1, 1].forEach(s => head.add(mesh(taper([[0, .032, .106], [s * .035, .025, .1], [s * .07, -.01, .085], [s * .085, -.05, .07]], u => .011 * (1 - u * .7), { seg: 16, radial: 6 }), hair)));
  else if (o.rau) [-1, 1].forEach(s => head.add(mesh(taper([[0, .032, .106], [s * .025, .028, .1], [s * .042, .012, .088]], u => .008 * (1 - u * .6), { seg: 8, radial: 6 }), hair)));
  // ---- hair (skipped under full head coverings) ----
  const mu = o.mu, covered = ['nemes', 'hijab', 'mu-trum', 'khan-a-rap'].includes(mu), style = o.toc ?? (nu ? 'dai' : 'ngan');
  if (style !== 'troc' && !covered) {
    const curly = style === 'xoan' || style === 'xoan-ngan', capG = style === 'xoan' ? lump(.112, .1, 3, 3) : style === 'xoan-ngan' ? lump(.108, .06, 5, 3) : new THREE.SphereGeometry(.113, 32, 20, 0, Math.PI * 2, 0, Math.PI * .6);
    const cap = mesh(capG, hair); cap.scale.set(nu ? .95 : 1, curly ? 1.02 : 1.12, curly ? 1.02 : 1.06); cap.position.set(0, style === 'xoan' ? .1 : style === 'xoan-ngan' ? .085 : .07, curly ? -.02 : -.012); cap.rotation.x = curly ? 0 : -.55; head.add(cap);
    if (!curly) { const fr = mesh(new THREE.SphereGeometry(.108, 24, 12, -Math.PI * .42, Math.PI * .84, Math.PI * .08, Math.PI * .17), hair); fr.scale.set(nu ? .96 : 1, 1.1, 1.06); fr.position.set(0, .075, .004); head.add(fr); }
    if (style === 'dai') for (let k = 0; k < 9; k++) { const a = -1.2 + k * .3, x = Math.sin(a) * .1, z = -Math.cos(a) * .09;
      const L = o.do_dai_toc ?? 1; head.add(mesh(taper([[x, .1, z], [x * 1.15, -.02, z - .01], [x * 1.25, -.16 * L, z - .03 - .02 * (L - 1)], [x * 1.2, -.28 * L, z - .02 - .04 * (L - 1)]], u => .03 * (1 - u * .6), { seg: 16, radial: 8 }), hair)); }
    if (style === 'buoc') { head.add(mesh(lump(.04, .1, 2, 2), hair).translateY(.11).translateZ(-.1)); head.add(mesh(taper([[0, .1, -.12], [0, .02, -.16], [0, -.12, -.15], [0, -.2, -.12]], u => .036 * (1 - u * .8), { seg: 20, radial: 10 }), hair)); }
    if (style === 'tet') head.add(mesh(taper([[0, .08, -.11], [0, -.05, -.14], [0, -.25, -.13], [0, -.4, -.11]], u => .03 * (1 - u * .5), { seg: 24, radial: 10 }), hair));
    if (style === 'bui') { const bun = mesh(lump(.05, .08, 4, 2), hair); bun.position.set(0, .17, -.06); head.add(bun); }
    if (style === 'bui-gay') { const mass = mesh(new THREE.SphereGeometry(.1, 24, 16), hair); mass.scale.set(1.15, .85, .75); mass.position.set(0, -.02, -.085); head.add(mass);
      const cp = []; for (let r = 0; r < 5; r++) for (let c = 0; c < 9; c++) { const a = (c / 8 - .5) * 2.2, y = .04 - r * .028; cp.push([Math.sin(a) * .11, y, -.085 - Math.cos(a) * .07]); }
      head.add(curls(cp, .016, hair)); }
    if (style === 'bui-dinh') { const bun = mesh(lump(.042, .06, 6, 2), hair); bun.position.set(0, .215, -.01); head.add(bun); head.add(mesh(new THREE.CylinderGeometry(.004, .004, .14, 6).rotateZ(Math.PI / 2), gold).translateY(.215).translateZ(-.01)); }
    if (style === 'toc-gia') { const bob = mesh(new THREE.CylinderGeometry(.122, .135, .2, 36, 1, true, .85, Math.PI * 2 - 1.7), M('wig', () => mat3d('fur', { color: 0x141110, roughness: .5, sheen: .6, side: THREE.DoubleSide }))); bob.position.y = .02; head.add(bob); }
  }
  // ---- headwear ----
  const mc = o.mau_mu, hm = c => fab(c ?? 0x1a1a1a), hm2 = c => fab(c ?? 0x1a1a1a, true);
  if (mu === 'non-la') { const straw = M('straw', () => mat3d('wood', { color: 0xd9c08a, roughness: .8, repeat: [4, 1], side: THREE.DoubleSide })); const c = mesh(new THREE.ConeGeometry(.29, .15, 40, 1, true), straw); c.position.y = .225; head.add(c); }
  if (mu === 'khan-xep' || mu === 'khan-van') { const big = mu === 'khan-van', t = mesh(new THREE.TorusGeometry(big ? .108 : .1, big ? .045 : .034, 12, 36), hm(mc)); t.rotation.x = Math.PI / 2 - .2; t.scale.set(1.04, 1.14, 1); t.position.set(0, big ? .13 : .115, -.008); head.add(t);
    if (big) { const top = mesh(new THREE.SphereGeometry(.1, 24, 12, 0, Math.PI * 2, 0, Math.PI * .45), hm(mc)); top.position.set(0, .12, -.01); head.add(top); } }
  if (mu === 'nemes') { const gm = gold, cap = mesh(new THREE.SphereGeometry(.122, 32, 20, 0, Math.PI * 2, 0, Math.PI * .58), gm); cap.scale.set(1.02, 1.1, 1.08); cap.position.set(0, .07, -.01); cap.rotation.x = -.35; head.add(cap);
    const band = mesh(new THREE.TorusGeometry(.115, .01, 8, 40), M('lapis', () => mat3d('ceramic', { color: 0x2a4a9a }))); band.rotation.x = Math.PI / 2 - .35; band.position.set(0, .1, .0); head.add(band);
    [-1, 1].forEach(s => { const lap = mesh(roundedBox(.07, .22, .022, .008), gm); lap.position.set(s * .1, -.07, .03); lap.rotation.z = s * .12; head.add(lap); });
    head.add(mesh(taper([[0, .02, -.11], [0, -.12, -.13], [0, -.22, -.11]], u => .05 * (1 - u * .4), { seg: 10, radial: 10 }), gm));
    const ur = mesh(new THREE.SphereGeometry(.012, 10, 8), gm); ur.position.set(0, .15, .1); head.add(ur); }
  if (mu === 'nguyet-que') { const lm = M('laurel', () => mat3d('gold', { color: 0x9a8a3a, roughness: .35 })), ring = mesh(new THREE.TorusGeometry(.112, .005, 6, 40), lm); ring.rotation.x = Math.PI / 2 - .25; ring.position.y = .115; head.add(ring);
    for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2, leaf = mesh(new THREE.SphereGeometry(.016, 8, 6), lm); leaf.scale.set(.5, .25, 1.4); leaf.position.set(Math.sin(a) * .114, .115 + Math.cos(a) * .028, Math.cos(a) * .114); leaf.rotation.y = a; leaf.rotation.x = .6; head.add(leaf); } }
  if (mu === 'mu-trum' || mu === 'hijab' || mu === 'khan-a-rap') { const m2 = hm2(mc ?? (mu === 'khan-a-rap' ? 0xf4f1ea : 0xece6d8)), gap = mu === 'hijab' ? 1.5 : 1.8;
    const hood = mesh(new THREE.SphereGeometry(.128, 32, 20, Math.PI / 2 + gap / 2, Math.PI * 2 - gap, 0, Math.PI * .72), m2); hood.scale.set(1, 1.12, 1.08); hood.position.set(0, .065, -.008); head.add(hood);
    const drape = mesh(new THREE.CylinderGeometry(.13, mu === 'hijab' ? .2 : .19, .26, 32, 1, true, mu === 'hijab' ? 0 : gap / 2, mu === 'hijab' ? Math.PI * 2 : Math.PI * 2 - gap), m2); drape.position.y = -.1; drape.scale.z = .9; head.add(drape);
    if (mu === 'khan-a-rap') [0, .028].forEach(dy => { const ag = mesh(new THREE.TorusGeometry(.112, .011, 8, 40), M('agal', () => mat3d('fabric', { color: 0x141414 }))); ag.rotation.x = Math.PI / 2 - .1; ag.position.set(0, .15 + dy, -.01); head.add(ag); }); }
  if (mu === 'mu-chop') { const hm3 = M('felt', () => mat3d('velvet', { color: 0x141418, sheen: .4 })), c = mesh(new THREE.CylinderGeometry(.09, .095, .18, 32), hm3); c.position.y = .25; head.add(c);
    const brim = mesh(new THREE.CylinderGeometry(.15, .15, .012, 40), hm3); brim.position.y = .165; head.add(brim); const band = mesh(new THREE.CylinderGeometry(.096, .096, .03, 32), fab(0x3a1a1a)); band.position.y = .185; head.add(band); }
  if (mu === 'mu-noi') { const fm = M('flatcap' + (o.mau_mu ?? 0x3a3832), () => mat3d('fabric', { color: o.mau_mu ?? 0x3a3832 })), c = mesh(new THREE.SphereGeometry(.125, 32, 16, 0, Math.PI * 2, 0, Math.PI * .5), fm); c.scale.set(1.04, .5, 1.12); c.position.set(0, .13, -.005); head.add(c);   // flat cap: low crown + short peak
    const peak = mesh(new THREE.CylinderGeometry(.1, .1, .012, 32, 1, false, -Math.PI * .5, Math.PI), fm); peak.scale.set(1, 1, .55); peak.position.set(0, .14, .09); peak.rotation.x = .12; head.add(peak); }
  if (mu === 'mu-quan') { const bm = M('ksa', () => mat3d('velvet', { color: 0x141414, sheen: .3 })), c = mesh(new THREE.SphereGeometry(.118, 32, 16, 0, Math.PI * 2, 0, Math.PI * .5), bm); c.scale.set(1.02, .9, 1.05); c.position.y = .1; head.add(c);
    const back = mesh(new THREE.SphereGeometry(.07, 20, 12), bm); back.position.set(0, .16, -.06); back.scale.set(1.2, 1, .8); head.add(back);
    [-1, 1].forEach(s => { const w = mesh(roundedBox(.16, .045, .008, .004), bm); w.position.set(s * .17, .16, -.07); w.rotation.z = s * .08; head.add(w); }); }
  if (mu === 'vuong-mien-ba-tu') { const gm = M('goldD', () => mat3d('gold', { color: 0xe0b44c, side: THREE.DoubleSide })), band = mesh(new THREE.CylinderGeometry(.122, .112, .12, 40, 1, true), gm); band.position.y = .16; head.add(band);
    const top = mesh(new THREE.CircleGeometry(.12, 40).rotateX(-Math.PI / 2), gm); top.position.y = .215; head.add(top);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2, t = mesh(roundedBox(.045, .045, .012, .004), gold); t.position.set(Math.sin(a) * .121, .24, Math.cos(a) * .121); t.rotation.y = a; head.add(t); }
    const ring = mesh(new THREE.TorusGeometry(.118, .006, 6, 40), gold); ring.rotation.x = Math.PI / 2; ring.position.y = .11; head.add(ring); }
  if (mu === 'mu-ba-tu') { const fm = M('kid' + (mc ?? 0), () => mat3d('fabric', { color: mc ?? 0x6a4a2a, roughness: .8 })), c = mesh(fluted(.115, .13, 18, .008, 72, 2), fm); c.position.y = .17; head.add(c);
    const top = mesh(new THREE.CircleGeometry(.112, 36).rotateX(-Math.PI / 2), fm); top.position.y = .235; head.add(top); }
  if (mu === 'mu-phrygia') { const pm = fab(mc ?? 0x8a2b22), cap = mesh(new THREE.SphereGeometry(.122, 28, 18, 0, Math.PI * 2, 0, Math.PI * .58), pm); cap.scale.set(1, 1.18, 1.08); cap.position.set(0, .06, -.01); cap.rotation.x = -.25; head.add(cap);
    head.add(mesh(taper([[0, .17, -.03], [0, .25, .0], [0, .27, .06], [0, .23, .1]], u => .06 * (1 - u * .8), { seg: 20, radial: 14 }), pm));   // soft peak curling forward
    [-1, 1].forEach(s => { const fl = mesh(roundedBox(.03, .16, .07, .012), pm); fl.position.set(s * .105, -.04, .0); head.add(fl); }); }   // cheek flaps
  if (mu === 'khan-quan' || mu === 'taj-safavi') { const tm = fab(mc ?? 0xf1ece0);
    for (let k = 0; k < 3; k++) { const t = mesh(new THREE.TorusGeometry(.108 - k * .012, .032, 10, 32), tm); t.rotation.x = Math.PI / 2 - .12 + k * .05; t.rotation.z = (k - 1) * .18; t.position.set(0, .13 + k * .035, -.01); head.add(t); }
    const dome = mesh(new THREE.SphereGeometry(.1, 24, 12, 0, Math.PI * 2, 0, Math.PI * .5), tm); dome.position.set(0, .15, -.01); dome.scale.y = 1.1; head.add(dome);
    if (mu === 'taj-safavi') { const baton = mesh(new THREE.CylinderGeometry(.02, .028, .2, 12), fab(0xb01e1e)); baton.position.y = .3; head.add(baton); }
    if (o.long_vu) head.add(mesh(taper([[0, .2, .09], [.01, .3, .11], [.03, .38, .09]], u => .022 * (1 - u * .85), { seg: 16, radial: 8, rz: u => .008 }), fab(o.long_vu))); }
  if (mu === 'mu-mobed') { const wm = fab(mc ?? 0xf4f1ea), c = mesh(new THREE.CylinderGeometry(.11, .118, .14, 32), wm); c.position.y = .16; head.add(c);
    const top = mesh(new THREE.SphereGeometry(.11, 24, 10, 0, Math.PI * 2, 0, Math.PI * .5), wm); top.position.y = .23; top.scale.y = .4; head.add(top); }
  if (o.che_mieng) { const v = mesh(roundedBox(.11, .1, .01, .004), fab(0xf4f1ea)); v.position.set(0, .015, .108); head.add(v);
    [-1, 1].forEach(s => { const st = mesh(new THREE.TorusGeometry(.105, .003, 4, 24, Math.PI * .45), fab(0xf4f1ea)); st.rotation.set(Math.PI / 2, 0, s > 0 ? -Math.PI * .1 : Math.PI * 1.1 - Math.PI * .45 + Math.PI * .45); st.position.y = .03; head.add(st); }); }
  if (mu === 'vuong-mien') { const ring = mesh(new THREE.CylinderGeometry(.115, .11, .05, 40, 1, true), M('goldD', () => mat3d('gold', { color: 0xe0b44c, side: THREE.DoubleSide }))); ring.position.y = .145; head.add(ring);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, p = mesh(new THREE.ConeGeometry(.016, .05, 6), gold); p.position.set(Math.sin(a) * .113, .19, Math.cos(a) * .113); head.add(p); }
    const gem = mesh(new THREE.SphereGeometry(.012, 10, 8), M('ruby', () => mat3d('plastic', { color: 0xb01020, roughness: .1, clearcoat: 1 }))); gem.position.set(0, .145, .117); head.add(gem); }
  // ---- limbs ----
  const sleeve = o.tay_ao ?? (robe || kind === 'tunic' || kind === 'ao-khoac' ? 'dai' : nu ? 'ngan' : 'dai'), bareArms = kind === 'khoa-than' && !nu;
  const armM = bareArms ? skin : cloth;
  const arm = s => { const up = new THREE.Group(); up.position.set(s * (sh - .01), shY - .03, 0); B.add(up);
    up.add(mesh(new THREE.SphereGeometry(.047, 16, 12), sleeve === 'khong' || bareArms ? skin : cloth).translateX(-s * .01));
    const longS = sleeve === 'dai' || sleeve === 'rong' || sleeve === 'xu';
    up.add(mesh(taper([[0, 0, 0], [0, -.15, 0], [0, -.3, 0]], u => (longS ? .05 : .042) - u * .01, { seg: 8, radial: 14, closed: false }), longS && !bareArms ? armM : skin));
    if (sleeve === 'ngan' && !bareArms) up.add(mesh(new THREE.CylinderGeometry(.05, .054, .14, 18), cloth).translateY(-.06));
    const lo = new THREE.Group(); lo.position.y = -.29; up.add(lo); up.lo = lo;
    lo.add(mesh(taper([[0, .03, 0], [0, -.12, .005], [0, -.25, 0]], u => (longS ? .04 : .033) - u * (longS ? .012 : .008), { seg: 8, radial: 12, closed: false }), (sleeve === 'dai' || sleeve === 'xu') && !bareArms ? cloth : skin));
    if (sleeve === 'rong') { const bg = lathe([[.12, -.22], [.095, -.15], [.064, -.04], [.05, .04]], 24), bell = mesh(bg, cloth), lining = mesh(bg, M('lin' + mainC, () => new THREE.MeshLambertMaterial({ color: SHADE(mainC, .35), side: THREE.BackSide })));
      bell.position.z = lining.position.z = -.01; lo.add(bell, lining); }   // dark matte lining (Lambert): fabric sheen on back faces glows white under the key light
    if ((sleeve === 'dai' || sleeve === 'xu') && !bareArms) lo.add(mesh(new THREE.CylinderGeometry(.03, .03, .03, 12), skin).translateY(-.255));
    if (sleeve === 'xu') { const dr = mesh(roundedBox(.02, .26, .15, .008), fab(mainC)); dr.position.set(0, -.15, -.075); dr.rotation.x = -.12; lo.add(dr);   // Persian sleeve: spare cloth hangs under the forearm
      const du = mesh(roundedBox(.02, .2, .1, .008), fab(mainC)); du.position.set(0, -.18, -.05); up.add(du); }
    const hand = mesh(new THREE.SphereGeometry(.042, 16, 12), skin); hand.scale.set(.78, 1.12, .42); hand.position.set(0, -.3, .005); lo.add(hand);   // rounded palm: a flat box face blows out under the key light
    const th = mesh(new THREE.CapsuleGeometry(.011, .03, 4, 8), skin); th.position.set(-s * .03, -.28, .02); th.rotation.z = s * .5; lo.add(th);
    if (o.co_ao === 'ai-cap') { const br = mesh(new THREE.TorusGeometry(.04, .008, 6, 20), gold); br.rotation.x = Math.PI / 2; br.position.y = -.2; lo.add(br); }
    return up; };
  const chan = o.chan ?? 'giay';
  const leg = s => { const up = new THREE.Group(); up.position.set(s * hip * .75, hipY - .04, 0); B.add(up);
    const legM = (kind === 'hien-dai' && o.vay) || kind === 'khoa-than' || bareLegs ? skin : robe ? cloth : pants;
    up.add(mesh(taper([[0, .02, 0], [0, -.2, .005], [0, -.43, 0]], u => (nu ? .075 : .08) - u * .022, { seg: 8, radial: 16, closed: false }), legM));
    const lo = new THREE.Group(); lo.position.y = -.43; up.add(lo); up.lo = lo;
    lo.add(mesh(taper([[0, .04, 0], [0, -.15, -.008], [0, -.41, 0]], u => .057 - u * .022 + Math.sin(u * Math.PI) * .008, { seg: 10, radial: 14, closed: false }), legM));
    if (chan === 'ung') lo.add(mesh(taper([[0, -.16, 0], [0, -.3, 0], [0, -.42, 0]], u => .055 - u * .005, { seg: 4, radial: 14 }), leather));
    if (chan === 'giay' || chan === 'ung') { const foot = mesh(roundedBox(.085, .06, .22, .025), leather); foot.position.set(0, -.43, .045); lo.add(foot); }
    else { const foot = mesh(roundedBox(.075, .05, .2, .022), skin); foot.position.set(0, -.43, .045); lo.add(foot);
      if (chan === 'dep') { const sole = mesh(roundedBox(.085, .014, .22, .005), sandal); sole.position.set(0, -.458, .045); lo.add(sole); const st = mesh(new THREE.TorusGeometry(.04, .006, 6, 16, Math.PI), sandal); st.position.set(0, -.44, .07); lo.add(st); } }
    return up; };
  const aL = arm(-1), aR = arm(1), lL = leg(-1), lR = leg(1);
  G.scale.setScalar(H * (o.size ?? 1));
  const legK = robe ? .4 : kind === 'tunic' || kind === 'ao-khoac' ? .8 : 1;
  const F = { G, B, head, torso, aL, aR, lL, lR, spec: o,
    rest() { [aL, aR, lL, lR].forEach(p => { p.rotation.set(0, 0, 0); p.lo.rotation.set(0, 0, 0); }); aL.rotation.z = -.1; aR.rotation.z = .1; aL.lo.rotation.x = aR.lo.rotation.x = -.12; B.position.y = 0; B.rotation.set(0, 0, 0); head.rotation.set(0, 0, 0); },
    walk(ph, amp = .55) { F.rest(); const s = Math.sin(ph), la = amp * legK; lL.rotation.x = s * la; lR.rotation.x = -s * la;
      lL.lo.rotation.x = Math.max(0, -Math.sin(ph - .6)) * la * 1.3; lR.lo.rotation.x = Math.max(0, Math.sin(ph - .6)) * la * 1.3;
      aL.rotation.x = -s * amp * .75; aR.rotation.x = s * amp * .75; aL.lo.rotation.x = -.25 - Math.max(0, s) * .3; aR.lo.rotation.x = -.25 - Math.max(0, -s) * .3; B.position.y = Math.abs(Math.cos(ph)) * .03; B.rotation.y = s * .05; },
    breathe(t) { torso.scale.y = 1 + Math.sin(t * 2) * .01; head.rotation.y = Math.sin(t * .6) * .15; } };
  F.rest(); return F;
}
// varied spec from a seed: gender (unless given), skin within the era's range, hair, colours from the era palette
person.random = (seed = 1, o = {}) => { let x = seed * 9301 + 49297; const r = () => (x = (x * 9301 + 49297) % 233280) / 233280;
  const E = ERA[o.thoi_dai] || ERA['hien-dai'], nu = o.gioi ? o.gioi === 'nu' : r() < .5, [d0, d1] = E.da || [1, 6], da = d0 + Math.floor(r() * (d1 - d0 + 1));
  const hc = da >= 4 || ['ai-cap', 'trung-hoa', 'viet-nam-xua', 'nhat-ban', 'a-rap', 'nong-dan'].includes(o.thoi_dai) ? (r() < .85 ? 'den' : 'nau') : ['den', 'nau', 'nau-nhat', 'vang', 'do'][Math.floor(r() * 5)], pick = a => a[Math.floor(r() * a.length)];
  const base = { gioi: nu ? 'nu' : 'nam', da, mau_toc: o.gia ? 'bac' : hc };
  if (!o.thoi_dai || o.thoi_dai === 'hien-dai') return { ...base, toc: da >= 5 && r() < .4 ? 'xoan' : nu ? pick(['dai', 'buoc', 'bui', 'xoan', 'dai']) : pick(['ngan', 'ngan', 'xoan', 'troc', 'ngan']),
    ao: pick(CLOTH), quan: pick([0x1f2a36, 0x3a3a42, 0x5a4a3a, 0x2f3f5a]), vay: nu && r() < .35, tay_ao: r() < .5 ? 'dai' : 'ngan', ...o };
  const preset = { ...(E[base.gioi] || {}), ...(o.vai === 'vua' ? E.vua || {} : {}) };
  return { ...base, ...(E.pal && preset.ao != null && r() < .6 ? { ao: pick(E.pal) } : {}), ...(preset.rau && r() < .4 ? { rau: undefined } : {}), ...o };
};
