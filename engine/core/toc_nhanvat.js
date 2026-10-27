// mega-shot · toc_nhanvat.js — HAIR STYLES + FACE VARIETY + RANDOM CAST for the adult anime studio (xuong_anime.js, phong_cach anime-thanh-nien).
// Load after xuong_anime.js. All shapes are drawn in the 300-unit head box (3/4 view, face looking to +x): cranium centre (150,146) r104,
// ear (58,196), eyes at y≈182 (x 152 / 240), brows y≈150, chin (228,288).
//
//   MS.toc.KIEU[name] = { front(g, H), back?(g, H), ten }     front = over the face, back = behind the head (long hair, tails, bob mass)
//   MS.toc.DANH_SACH                                           style names (for menus / generators)
//   MS.xuong.ngauNhien(seed, { gioi, tuoi, phong_cach })      → a complete, plausible studio spec (face, hair, eyes, body, outfit, colours)
//
// Face knobs read by xuong_anime.js (xuong spec): mat_dang oval|tron|dai|vuong|nhon · mat_kieu thuong|tron|to|sac|cup|hep ·
// may_kieu thuong|day|manh|ngang|cong|xech · mui gach|cham|cao|tron · dau: [tan_nhang, not_ruoi, rau, ria, seo, ma_hong]
(() => {
  const MS = window.MS, PI = Math.PI;
  const mix = (a, b, t) => MS.u.mix(a, b, t);
  // ---- helpers ----
  const P = (g, pts) => { g.moveTo(...pts[0]); for (let i = 1; i < pts.length; i++) g.lineTo(...pts[i]); };
  // locks: alternating root / tip points joined by bowed curves (every lock curls the same way)
  const locks = (g, pts, bow = .18, cx = 150, cy = 130) => { g.moveTo(...pts[0]);
    for (let i = 1; i <= pts.length; i++) { const p = pts[i - 1], q = pts[i % pts.length], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, dx = q[0] - p[0], dy = q[1] - p[1];
      g.quadraticCurveTo(mx - dy * bow + (cx - mx) * .06, my + dx * bow + (cy - my) * .06, q[0], q[1]); } g.closePath(); };
  const strands = (g, H, list, w = 1.8) => { g.strokeStyle = mix(H.c, '#2a0e08', .45); g.lineWidth = w; g.lineCap = 'round';
    for (const [a, b, c, d, e = 6] of list) { g.beginPath(); g.moveTo(a, b); g.quadraticCurveTo((a + c) / 2 + e, (b + d) / 2 - 4, c, d); g.stroke(); } };
  // shared cel shading (inside the hair only): darker band under the hairline / bangs, crown highlight streaks
  const shade = (g, H, o = {}) => { g.save(); g.globalCompositeOperation = 'source-atop';
    g.fillStyle = mix(H.c, '#3a1020', .2); g.beginPath(); g.moveTo(0, o.y0 ?? 236); g.bezierCurveTo(30, 150, 60, (o.yb ?? 122) + 2, 120, o.yb ?? 118);
    g.bezierCurveTo(180, (o.yb ?? 118) - 8, 240, (o.yb ?? 118) + 4, 310, (o.yb ?? 118) + 16); g.lineTo(310, 360); g.lineTo(0, 360); g.closePath(); g.fill();
    g.fillStyle = mix(H.c, '#3a1020', .22); g.beginPath(); g.moveTo(0, 50); g.quadraticCurveTo(26, 120, 60, 150); g.lineTo(0, 220); g.closePath(); g.fill();   // back of the head turns away
    if (o.hl !== false) { g.fillStyle = mix(H.c, '#fff4dc', .3); for (const [a, b, c, d] of o.hl || [[92, 54, 150, 38], [168, 30, 226, 44]]) { g.beginPath(); g.moveTo(a, b); g.quadraticCurveTo((a + c) / 2, b - 10, c, d); g.quadraticCurveTo((a + c) / 2, b + 10, a, b); g.fill(); } }
    g.restore(); };
  const tie = (g, x, y, col) => { g.save(); g.globalCompositeOperation = 'source-over'; g.fillStyle = col; g.beginPath(); g.ellipse(x, y, 11, 9, -.4, 0, 7); g.fill(); g.restore(); };

  const BOM = [[34, 238], [58, 196], [10, 168], [42, 136], [2, 92], [52, 82], [30, 34], [92, 50], [96, 4], [142, 36], [176, 0], [196, 40], [244, 22], [240, 66], [286, 76],
    [264, 104], [296, 146], [270, 146], [280, 196], [256, 150], [246, 194], [228, 132], [212, 178], [200, 126], [190, 200], [178, 128], [158, 166], [146, 120], [120, 160], [108, 124],
    [86, 156], [74, 132], [60, 170]];
  for (let i = 1; i < 18; i += 2) { const p = BOM[i]; p[0] = 150 + (p[0] - 150) * 1.2; p[1] = 140 + (p[1] - 140) * 1.2; }

  const NGAN = [[46, 238], [58, 204], [30, 190], [44, 156], [22, 124], [52, 104], [40, 66], [82, 70], [84, 30], [120, 50], [136, 16], [164, 42], [194, 20], [206, 54], [244, 42], [244, 82], [278, 92],
    [264, 120], [290, 146], [272, 152], [280, 186], [258, 152], [250, 184], [238, 142], [222, 172], [210, 134], [194, 166], [178, 130], [160, 160], [144, 126], [124, 154], [108, 128], [88, 156], [76, 142], [62, 180]];
  for (let i = 1; i < 18; i += 2) { const p = NGAN[i]; p[0] = 150 + (p[0] - 150) * 1.16; p[1] = 140 + (p[1] - 140) * 1.16; }   // shallow crown notches: neat, not spiky
  const MAI = [[40, 240], [58, 200], [28, 184], [42, 150], [18, 116], [50, 98], [36, 60], [82, 64], [84, 28], [122, 46], [140, 14], [168, 40], [198, 20], [210, 54], [248, 44], [248, 84], [282, 96],
    [268, 124], [296, 160], [278, 170], [290, 244], [262, 192], [256, 166], [236, 150], [214, 172], [198, 142], [176, 164], [160, 138], [136, 160], [118, 142], [96, 166], [82, 150], [64, 186]];
  for (let i = 1; i < 18; i += 2) { const p = MAI[i]; p[0] = 150 + (p[0] - 150) * 1.16; p[1] = 140 + (p[1] - 140) * 1.16; }
  const KIEU = {
    bom: { ten: 'rối nhọn', front(g, H) { g.fillStyle = H.c; g.beginPath(); locks(g, BOM, .2); g.fill(); shade(g, H);
      strands(g, H, [[150, 40, 186, 190], [120, 60, 136, 150], [200, 50, 236, 160], [90, 80, 84, 150], [230, 70, 268, 150], [60, 110, 30, 180]]); } },
    ngan: { ten: 'ngắn rẽ ngôi', front(g, H) { g.fillStyle = H.c; g.beginPath(); locks(g, NGAN, .07); g.fill(); shade(g, H, { yb: 128 });   // short neat: soft locks, side-swept fringe with forehead showing
      strands(g, H, [[124, 34, 100, 96, -4], [150, 40, 196, 128], [182, 42, 238, 124], [108, 60, 70, 150, -6], [86, 76, 46, 176, -6]], 2); } },
    dau_dinh: { ten: 'đầu đinh', front(g, H) { const c = mix(H.c, H.da, .3); g.fillStyle = c; g.beginPath(); g.moveTo(58, 216); g.bezierCurveTo(36, 150, 44, 58, 150, 40);
      g.bezierCurveTo(232, 34, 264, 78, 262, 118); g.quadraticCurveTo(222, 100, 182, 110); g.quadraticCurveTo(124, 116, 88, 146); g.quadraticCurveTo(70, 168, 66, 194); g.closePath(); g.fill();
      g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = mix(c, '#000000', .25); for (let i = 0; i < 160; i++) { const a = PI * (1.05 + .9 * ((i * 37) % 100) / 100), r = 60 + ((i * 53) % 40);
        g.beginPath(); g.arc(150 + Math.cos(a) * r, 140 + Math.sin(a) * r * .95, 1.2, 0, 7); g.fill(); } g.restore(); shade(g, { ...H, c }, { hl: [[110, 52, 170, 42]], yb: 126 }); } },
    xoan: { ten: 'xoăn', front(g, H) { g.fillStyle = H.c; g.beginPath(); g.arc(150, 140, 110, PI * .95, PI * 2.05); g.closePath(); g.fill();   // curls define the silhouette (base = skull, no box)
      const C = []; for (let k = 0; k <= 16; k++) { const a = PI * (1.0 + 1.0 * k / 16), rr = 22 + ((k * 7) % 4) * 6; C.push([150 + Math.cos(a) * (124 + (k % 2) * 6), 132 + Math.sin(a) * (84 + (k % 3) * 5), rr]); }   // dome kept inside the head box (top curls were clipped flat)
      for (const [x, y, r] of [[30, 178, 24], [26, 214, 20], [44, 244, 16], [280, 156, 18], [270, 182, 13], [252, 142, 16], [230, 150, 15], [206, 140, 17], [182, 152, 14], [158, 140, 16], [130, 150, 15], [104, 142, 18], [80, 156, 17], [58, 160, 20]]) C.push([x, y, r]);
      for (const [x, y, r] of C) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      shade(g, H, { yb: 126 }); g.save(); g.globalCompositeOperation = 'source-atop'; g.strokeStyle = mix(H.c, '#2a0e08', .4); g.lineWidth = 1.8;
      for (const [x, y, r] of C) { g.beginPath(); g.arc(x - r * .1, y + r * .1, r * .55, PI * .8, PI * 1.9); g.stroke(); } g.restore(); } },
    mai_lech: { ten: 'mái lệch dài', front(g, H) { g.fillStyle = H.c; g.beginPath(); locks(g, MAI, .1); g.fill(); shade(g, H, { yb: 130 });   // long side-swept fringe made of locks
      strands(g, H, [[110, 40, 250, 170, 16], [160, 34, 270, 210, 14], [90, 60, 180, 150, 10], [70, 90, 40, 200, -6]], 2); } },
    dai: { ten: 'dài thẳng', front(g, H) { g.fillStyle = H.c; g.beginPath(); g.moveTo(30, 232); g.bezierCurveTo(8, 110, 70, 24, 160, 22); g.bezierCurveTo(258, 24, 300, 110, 286, 230);
      g.lineTo(272, 200); g.quadraticCurveTo(262, 150, 236, 134); g.quadraticCurveTo(222, 168, 204, 176); g.quadraticCurveTo(196, 140, 168, 128); g.quadraticCurveTo(150, 166, 122, 172);
      g.quadraticCurveTo(118, 136, 92, 132); g.quadraticCurveTo(70, 170, 58, 222); g.closePath(); g.fill(); shade(g, H, { yb: 126 });
      strands(g, H, [[120, 50, 100, 140], [180, 40, 176, 120], [230, 60, 250, 150]], 2); },
      back(g, H) { g.fillStyle = mix(H.c, '#000000', .18); g.beginPath(); g.moveTo(40, 120); g.bezierCurveTo(4, 200, 8, 300, 44, 338); g.lineTo(120, 324); g.lineTo(180, 332); g.lineTo(262, 336);
        g.bezierCurveTo(298, 290, 300, 190, 270, 110); g.closePath(); g.fill(); } },
    duoi_ngua: { ten: 'đuôi ngựa', front(g, H) { g.fillStyle = H.c; g.beginPath(); g.moveTo(46, 226); g.bezierCurveTo(16, 160, 24, 60, 120, 32); g.bezierCurveTo(190, 14, 260, 40, 280, 104);
      g.bezierCurveTo(290, 140, 284, 168, 272, 182); g.quadraticCurveTo(258, 146, 246, 140); g.quadraticCurveTo(236, 156, 222, 164); g.quadraticCurveTo(214, 138, 204, 128);
      g.quadraticCurveTo(192, 150, 176, 158); g.quadraticCurveTo(170, 134, 158, 124); g.quadraticCurveTo(144, 146, 126, 152); g.quadraticCurveTo(120, 132, 110, 126);
      g.quadraticCurveTo(84, 150, 66, 178); g.quadraticCurveTo(58, 200, 54, 216); g.closePath(); g.fill(); shade(g, H, { yb: 124 });
      strands(g, H, [[150, 36, 60, 104, -10], [190, 36, 70, 96, -14], [230, 54, 80, 90, -16]], 2); tie(g, 44, 100, H.phu); },
      back(g, H) { g.fillStyle = mix(H.c, '#000000', .14); g.beginPath(); g.moveTo(56, 92); g.bezierCurveTo(4, 112, 2, 230, 16, 326); g.quadraticCurveTo(30, 292, 44, 250);
        g.bezierCurveTo(56, 200, 66, 150, 72, 112); g.closePath(); g.fill(); g.strokeStyle = mix(H.c, '#2a0e08', .4); g.lineWidth = 2; g.beginPath(); g.moveTo(44, 120); g.quadraticCurveTo(22, 210, 22, 300); g.stroke(); } },
    hai_bim: { ten: 'hai bím', front(g, H) { KIEU.bob.bangs(g, H, 156); shade(g, H, { yb: 126 }); tie(g, 44, 104, H.phu); tie(g, 262, 92, H.phu); },
      back(g, H) { g.fillStyle = mix(H.c, '#000000', .14); g.beginPath(); g.moveTo(52, 96); g.bezierCurveTo(6, 140, 6, 250, 20, 330); g.quadraticCurveTo(40, 262, 64, 150); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(250, 86); g.bezierCurveTo(298, 130, 300, 240, 288, 324); g.quadraticCurveTo(276, 250, 262, 140); g.closePath(); g.fill(); } },
    bob: { ten: 'bob ngang cằm', bangs(g, H, yb) { g.fillStyle = H.c; g.beginPath(); g.moveTo(36, 230); g.bezierCurveTo(8, 160, 30, 46, 150, 30); g.bezierCurveTo(254, 30, 296, 100, 284, 180);
        g.lineTo(272, 180); g.bezierCurveTo(266, 166, 258, yb, 248, yb); g.lineTo(96, yb + 4); g.quadraticCurveTo(76, yb + 4, 66, 186); g.quadraticCurveTo(58, 206, 54, 222); g.closePath(); g.fill(); },
      front(g, H) { this.bangs(g, H, 150); g.beginPath(); g.moveTo(272, 150); g.bezierCurveTo(298, 180, 296, 240, 290, 276); g.lineTo(258, 278); g.bezierCurveTo(266, 236, 262, 196, 252, 168); g.closePath(); g.fill();   // front lock framing the cheek
        shade(g, H, { yb: 120 }); strands(g, H, [[150, 40, 140, 140], [200, 44, 220, 140], [100, 56, 80, 140, -4], [278, 180, 274, 260, 2]], 2); },
      back(g, H) { g.fillStyle = mix(H.c, '#000000', .16); g.beginPath(); g.moveTo(44, 110); g.bezierCurveTo(6, 170, 10, 260, 32, 284); g.lineTo(160, 286); g.bezierCurveTo(150, 240, 140, 170, 120, 120); g.closePath(); g.fill(); } },
    bui: { ten: 'búi', front(g, H) { g.fillStyle = H.c; g.beginPath(); g.ellipse(46, 84, 48, 42, -.4, 0, 7); g.fill(); g.beginPath(); g.moveTo(48, 226); g.bezierCurveTo(22, 120, 70, 38, 160, 36);
      g.bezierCurveTo(240, 36, 284, 90, 276, 146); g.quadraticCurveTo(270, 176, 262, 196); g.quadraticCurveTo(258, 160, 246, 138); g.bezierCurveTo(222, 112, 184, 106, 150, 112);   // swept back, side lock in front of the ear
      g.bezierCurveTo(112, 118, 84, 134, 70, 166); g.quadraticCurveTo(64, 190, 60, 206); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(236, 124); g.quadraticCurveTo(252, 160, 244, 196); g.quadraticCurveTo(240, 160, 226, 132); g.closePath(); g.fill();                                    // a loose strand by the face
      shade(g, H, { yb: 132, hl: [[100, 52, 200, 44]] });
      g.save(); g.globalCompositeOperation = 'source-atop'; strands(g, H, [[256, 100, 70, 80, -10], [240, 70, 80, 64, -10], [204, 114, 60, 120, -8]], 2); g.strokeStyle = mix(H.c, '#2a0e08', .4); g.beginPath(); g.arc(46, 84, 28, -1.2, 2); g.stroke(); g.restore(); } },
    vuot_nguoc: { ten: 'vuốt ngược', front(g, H) { g.fillStyle = mix(H.c, H.da, .45); g.beginPath(); g.moveTo(52, 214); g.bezierCurveTo(38, 170, 44, 140, 66, 126); g.lineTo(96, 132); g.quadraticCurveTo(76, 170, 72, 206); g.closePath(); g.fill();   // shaved side
      g.fillStyle = H.c; g.beginPath(); g.moveTo(44, 160); g.bezierCurveTo(22, 80, 84, 18, 172, 22); g.bezierCurveTo(250, 26, 290, 68, 274, 116); g.quadraticCurveTo(236, 102, 196, 110); g.quadraticCurveTo(134, 118, 92, 136); g.quadraticCurveTo(62, 146, 44, 160); g.closePath(); g.fill();
      shade(g, H, { yb: 132, hl: [[90, 50, 230, 40]] }); strands(g, H, [[268, 104, 70, 70, -14], [260, 70, 80, 50, -12], [220, 110, 60, 110, -8]], 2); } },
    hoi: { ten: 'hói', front(g, H) { g.fillStyle = H.c; g.beginPath(); g.moveTo(44, 234); g.bezierCurveTo(18, 180, 26, 120, 66, 100); g.quadraticCurveTo(70, 140, 64, 190); g.quadraticCurveTo(58, 214, 54, 230); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(262, 120); g.quadraticCurveTo(276, 148, 270, 176); g.quadraticCurveTo(262, 150, 252, 136); g.closePath(); g.fill(); } },
    trui: { ten: 'trọc', front() {} },
  };
  const DANH_SACH = Object.keys(KIEU);
  MS.toc = { KIEU, DANH_SACH, locks, shade };

  // ---------------- random cast: plausible, varied, reproducible from a seed ----------------
  const rng = seed => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
  const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];
  const wpick = (r, W) => { const tot = W.reduce((a, [, w]) => a + w, 0); let x = r() * tot; for (const [v, w] of W) { if ((x -= w) <= 0) return v; } return W[W.length - 1][0]; };
  const DA = ['#fde8da', '#fbe0cc', '#f3d0b4', '#e6bc98', '#d6a47c', '#b98462', '#8f6248'];
  const TOC = ['#1e1a1c', '#2e2220', '#4a3326', '#6a4630', '#8a5a34', '#c08a4a', '#e0b870', '#e8892e', '#b8402e', '#3a3a4a'];
  const TOC_ANIME = ['#5a7ad0', '#d07ab0', '#6ab8a0', '#e8e0d0'];
  const MAT = ['#3a2418', '#5a3a22', '#7a4a2a', '#4a6a8a', '#3a7a5a', '#8a5a2a', '#6a4a8a', '#a8552e'];
  const AO = ['#f3f3ef', '#2c3550', '#d84a3a', '#3a3f58', '#2e7a5a', '#c8783a', '#a8c8e8', '#e9e4d8', '#f0a8b8', '#6a8a5a', '#8a6aa6', '#1e1c22'];
  const QUAN = ['#2a2a32', '#3a3a44', '#4a5a7a', '#55483c', '#2e3a52', '#6a5a48'];
  MS.xuong = MS.xuong || {};
  MS.xuong.ngauNhien = (seed = 1, o = {}) => { const r = rng(seed * 2654435761);
    const gioi = o.gioi || (r() < .5 ? 'nam' : 'nu'), nu = gioi === 'nu', tuoi = o.tuoi || wpick(r, [['thieu-nien', 4], ['nguoi-lon', 5], ['gia', 1]]), gia = tuoi === 'gia';
    const hinh = o.hinh_the || (nu ? wpick(r, [['vua', 5], ['dong-ho-cat', 2], ['qua-le', 2], ['qua-tao', 1], ['nu-mum-mim', 1], ['gay', 2], ['nu-chien-binh', 1]])
      : wpick(r, [['vua', 5], ['gay', 2], ['om', 1], ['cao-kheu', 1], ['vai-rong', 2], ['luc-si', 1], ['mum-mim', 1], ['rat-beo', 1], ['thap-dam', 1]]));
    const toc = gia ? (nu ? pick(r, ['bui', 'bob', 'ngan']) : pick(r, ['hoi', 'ngan', 'vuot_nguoc', 'dau_dinh']))
      : nu ? wpick(r, [['dai', 4], ['duoi_ngua', 3], ['bob', 3], ['hai_bim', 1], ['bui', 1], ['mai_lech', 2], ['xoan', 1]])
      : wpick(r, [['bom', 3], ['ngan', 4], ['dau_dinh', 2], ['vuot_nguoc', 2], ['xoan', 1], ['mai_lech', 2], ['duoi_ngua', .4], ['trui', .4]]);
    const tocMau = gia ? pick(r, ['#d2cdc6', '#b8b2aa', '#e4e0da']) : r() < .1 ? pick(r, TOC_ANIME) : pick(r, TOC);
    const ao = wpick(r, nu ? [['blazer', 2], ['thun', 3], ['so-mi', 2], ['hoodie', 2]] : [['so-mi', 3], ['thun', 3], ['hoodie', 2], ['blazer', 2]]);
    const dau = []; if (r() < .15) dau.push('tan_nhang'); if (r() < .12) dau.push('not_ruoi'); if (!nu && tuoi !== 'thieu-nien' && r() < .25) dau.push(r() < .5 ? 'rau' : 'ria'); if (r() < .05) dau.push('seo');
    return { ten: o.ten || 'NV' + seed, phong_cach: o.phong_cach || 'anime-thanh-nien', gioi, tuoi, hinh_the: hinh, da: pick(r, DA),
      toc: { kieu: toc, mau: tocMau, phu: pick(r, ['#e04a5a', '#3a6ab0', '#f0c040', '#ffffff', '#2a2a2a']) }, mat: { mau: pick(r, MAT) },
      mat_dang: wpick(r, [['oval', 4], ['tron', 2], ['dai', 1], ['vuong', nu ? .5 : 2], ['nhon', nu ? 2 : 1]]), mat_kieu: wpick(r, [['thuong', 4], ['tron', 2], ['to', nu ? 2 : .5], ['sac', 2], ['cup', 2], ['hep', 1]]),
      may_kieu: wpick(r, [['thuong', 4], ['day', nu ? .5 : 2], ['manh', nu ? 2 : 1], ['ngang', 1], ['cong', 1], ['xech', 1]]), mui: wpick(r, [['gach', 4], ['cham', 2], ['cao', 1], ['tron', 1]]), dau,
      ao: { kieu: ao, mau: pick(r, AO), mau_trong: '#f6f6f2', chu: '', xan: ao === 'so-mi' && r() < .3 ? 1 : 0 }, ca_vat: ao !== 'thun' && ao !== 'hoodie' && r() < .4 ? pick(r, ['#1c1b20', '#9a2a32', '#2a3a6a']) : null,
      quan: { kieu: nu && r() < .5 ? 'vay' : 'dai', mau: pick(r, QUAN) }, giay: r() < .5 ? { mau: '#f4f4f0', de: pick(r, ['#e04a3a', '#2a2a2a', '#3a6ab0']), day: '#2a2a2a' } : { mau: '#3a2a24', de: '#1a1416', day: '#3a2a24' } };
  };
})();
