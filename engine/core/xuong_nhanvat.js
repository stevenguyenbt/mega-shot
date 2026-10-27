// mega-shot · xuong_nhanvat.js — CHARACTER STUDIO: original 2D characters drawn entirely in code (vector parts) and finished with
// illustration layer styles (hieuung_lop.js: outline, cel shadow, rim, bevel — PhotoCraft algorithms), then delivered as a cut-out
// rig (parts + pivots + bone lengths + face sets) that nhanvat.js animates with the whole clip library. No AI images, no artist needed.
//
//   ve: { kieu: anh, xuong: { dang: tre-em|nguoi-lon|gia, da, toc: { kieu: xu|ngan|bob|bui, mau }, mat: { mau },
//         ao: { kieu: khoac-mo|thun|ba-ba, mau, mau_trong }, quan: { kieu: short|dai, mau }, giay: { kieu: the-thao|dep, mau },
//         kinh: { mau } | null, day_chuyen: '#d9b13b' | null, ma: 1 (cheeks), may: 1 (brow weight) } }
// Units: drawing px; K = 0.5 world units per px (same as the sheet rigs).
(() => {
  const MS = window.MS, L = () => MS.lop, K = .5, PI = Math.PI;
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; };
  const mix = (a, b, t) => MS.u.mix(a, b, t);
  const DANG = { 'tre-em': { dau: 1, than: 1, chan: 1, tay: 1, rong: 1 }, 'nguoi-lon': { dau: .82, than: 1.35, chan: 1.55, tay: 1.35, rong: .95 }, gia: { dau: .8, than: 1.3, chan: 1.35, tay: 1.3, rong: .92 } };
  // shared look: dark warm outline, cel shadow from the lower right, soft rim from the upper left
  const STYLE = (base, o = {}) => ({ net: { size: o.net ?? 5, mau: o.mau_net || mix(base, '#1a0f0a', .82) }, bong: { mau: mix(base, '#3a1f2a', .45), op: o.bong ?? .55, goc: -50, xa: o.xa ?? 18, mo: 0 },
    sang: { mau: '#fff8ee', op: o.sang ?? .28, co: 6 }, bevel: o.bevel === false ? null : { co: o.co ?? 26, goc: 130, cao: 42, op_sang: .25, op_toi: .12 }, nhieu: .02 });

  function build(sp) {
    if (sp.phong_cach && MS.xuong.styles && MS.xuong.styles[sp.phong_cach]) return MS.xuong.styles[sp.phong_cach](sp);   // other drawing styles (xuong_anime.js …)
    const D = DANG[sp.dang] || DANG['tre-em'], da = sp.da || '#f6d3b5', toc = sp.toc || {}, ao = sp.ao || {}, quan = sp.quan || {}, giay = sp.giay || {};
    const P = {}, IMG = {}, put = (name, canvas, def) => { IMG[name] = canvas; P[name] = { anh: name, ...def, goc: def.goc.map(v => v + (canvas.pad || 0)), ...(def.ngon ? { ngon: def.ngon.map(v => v + (canvas.pad || 0)) } : {}), ...(def.truc_x != null ? { truc_x: def.truc_x + (canvas.pad || 0), hang: def.hang.map(v => v + (canvas.pad || 0)) } : {}) }; };
    // ---------------- head (blank face) ----------------
    const HW = 300 * D.dau, HH = 320 * D.dau, hs = D.dau;
    const headShape = g => { g.save(); g.scale(hs, hs); g.fillStyle = da; g.beginPath(); g.ellipse(150, 160, 124, 128, 0, 0, 7); g.fill();
      const m = sp.ma ?? 1; g.beginPath(); g.ellipse(102, 222, 66 * m, 54 * m, -.2, 0, 7); g.ellipse(214, 226, 62 * m, 52 * m, .2, 0, 7); g.fill();   // cheeks (far one pokes out on the face side)
      g.beginPath(); g.ellipse(36, 182, 20, 27, 0, 0, 7); g.fill(); g.restore(); };                                                              // ear (back side)
    const hairShape = g => { g.save(); g.scale(hs, hs); g.fillStyle = toc.mau || '#22201f'; const k = toc.kieu || 'xu'; g.beginPath();
      if (k === 'xu') { g.moveTo(22, 196); g.bezierCurveTo(4, 70, 90, 18, 160, 26); g.bezierCurveTo(150, 4, 172, -10, 190, -2); g.bezierCurveTo(176, 8, 172, 20, 186, 32);
        g.bezierCurveTo(262, 44, 300, 110, 278, 182); g.lineTo(262, 122); g.lineTo(240, 150); g.lineTo(222, 100); g.lineTo(196, 132); g.lineTo(170, 92); g.lineTo(140, 130); g.lineTo(112, 96); g.lineTo(92, 140); g.lineTo(72, 112); g.lineTo(60, 170); g.lineTo(46, 150); g.closePath(); }
      else if (k === 'ngan') { g.moveTo(26, 190); g.bezierCurveTo(10, 60, 110, 22, 170, 30); g.bezierCurveTo(250, 38, 292, 100, 276, 170); g.bezierCurveTo(250, 112, 200, 96, 150, 104); g.bezierCurveTo(110, 110, 80, 124, 60, 160); g.closePath(); }
      else if (k === 'bob') { g.moveTo(14, 250); g.bezierCurveTo(0, 60, 100, 18, 170, 26); g.bezierCurveTo(262, 34, 300, 110, 286, 210); g.lineTo(270, 230); g.bezierCurveTo(268, 160, 250, 118, 214, 110);
        g.bezierCurveTo(200, 130, 150, 132, 112, 118); g.bezierCurveTo(80, 140, 70, 190, 64, 262); g.closePath(); }
      else if (k === 'bui') { g.moveTo(28, 186); g.bezierCurveTo(14, 70, 110, 28, 172, 34); g.bezierCurveTo(250, 42, 288, 100, 272, 162); g.bezierCurveTo(240, 108, 190, 92, 140, 100); g.bezierCurveTo(96, 108, 66, 130, 52, 168); g.closePath();
        g.moveTo(40, 70); g.arc(52, 62, 46, 0, 7); }
      g.fill(); g.restore(); };
    const head = cv(HW, HH);
    const H = L().ve(HW, HH, g => headShape(g), STYLE(da, { co: 40, bong: .5, xa: 22 }));
    const Hh = L().ve(HW, HH, g => hairShape(g), { ...STYLE(toc.mau || '#22201f', { co: 18, sang: .18 }), bevel: { co: 16, goc: 130, cao: 40, op_sang: .55, op_toi: .2, cel: .3 } });
    const headC = cv(H.width, H.height), hg = headC.getContext('2d'); hg.drawImage(H, 0, 0); hg.drawImage(Hh, H.pad - Hh.pad, H.pad - Hh.pad); headC.pad = H.pad;
    put('dau', headC, { goc: [140 * hs, 296 * hs], ngon: [146 * hs, 166 * hs] });
    // ---------------- face sets (drawn in head px; anchors on the head image) ----------------
    const iris = (sp.mat || {}).mau || '#3a2416', brW = sp.may ?? 1;
    const eyeSet = (kind) => { const c = cv(190 * hs, 110 * hs), g = c.getContext('2d'); g.scale(hs, hs); const E = [[52, 62, 1], [138, 62, .86]];
      const brow = (x0, y0, x1, y1, xm, ym) => L().nutMuc(g, Array.from({ length: 13 }, (_, i) => { const t = i / 12; return [(1 - t) ** 2 * x0 + 2 * t * (1 - t) * xm + t * t * x1, (1 - t) ** 2 * y0 + 2 * t * (1 - t) * ym + t * t * y1]; }), 6.5 * brW, toc.mau || '#22201f', .6);
      for (const [ex, ey, sx] of E) { g.save(); g.translate(ex, ey); g.scale(sx, 1);
        if (kind === 'nham' || kind === 'cuoi') { L().nutMuc(g, Array.from({ length: 11 }, (_, i) => { const a = PI * (kind === 'cuoi' ? 1 + i / 10 : .1 + i * .08); return kind === 'cuoi' ? [Math.cos(a) * 20, Math.sin(a) * 14 + 6] : [-20 + i * 4, Math.sin(i / 10 * PI) * 5]; }), 4, '#2a1a12'); g.restore(); continue; }
        const ry = kind === 'ngac' ? 28 : kind === 'met' || kind === 'quyet' ? 15 : 24, rx = kind === 'ngac' ? 21 : 19;
        g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(0, 2, rx, ry, 0, 0, 7); g.fill();
        g.save(); g.beginPath(); g.ellipse(0, 2, rx, ry, 0, 0, 7); g.clip();
        const ir = kind === 'ngac' ? 9 : 14; g.fillStyle = iris; g.beginPath(); g.ellipse(3, 5, ir, ir * 1.15, 0, 0, 7); g.fill(); g.fillStyle = '#120a06'; g.beginPath(); g.ellipse(3, 6, ir * .55, ir * .62, 0, 0, 7); g.fill();
        g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-3, -3, ir * .32, 0, 7); g.fill(); g.beginPath(); g.arc(8, 10, ir * .14, 0, 7); g.fill();
        if (kind === 'met' || kind === 'quyet') { g.fillStyle = da; g.fillRect(-30, -40, 60, kind === 'quyet' ? 36 : 40); }   // heavy lid
        g.restore();
        g.strokeStyle = '#2a1a12'; g.lineWidth = 3; g.beginPath(); g.ellipse(0, 2, rx, ry, 0, PI * .05, PI * .95); g.stroke();
        L().nutMuc(g, Array.from({ length: 12 }, (_, i) => { const a = PI * (1.02 + i / 11 * .96); return [Math.cos(a) * (rx + 1.5), Math.sin(a) * (ry + 1.5) + 2 + (kind === 'met' || kind === 'quyet' ? 9 : 0)]; }), 5, '#1c120c', .5);   // upper lash line
        g.restore(); }
      const B = { binh: [[24, 20, 76, 16, 50, 6], [112, 18, 160, 22, 136, 8]], cuoi: [[24, 18, 76, 14, 50, 2], [112, 14, 160, 20, 136, 2]], ngac: [[24, 10, 76, 4, 50, -8], [112, 4, 160, 10, 136, -8]],
        quyet: [[26, 14, 78, 28, 52, 16], [110, 28, 160, 14, 136, 16]], gian: [[26, 10, 78, 32, 52, 18], [110, 32, 160, 10, 136, 18]], so: [[26, 26, 76, 10, 50, 10], [112, 10, 160, 26, 136, 10]],
        met: [[24, 22, 76, 20, 50, 14], [112, 20, 160, 22, 136, 14]], nham: [[24, 20, 76, 16, 50, 8], [112, 18, 160, 22, 136, 8]], nghi: [[24, 22, 76, 18, 50, 12], [112, 6, 160, 14, 136, -2]] }[kind] || [];
      for (const b of B) brow(...b);
      c.pad = 0; return c; };
    for (const k of ['binh', 'cuoi', 'ngac', 'quyet', 'gian', 'so', 'met', 'nham', 'nghi']) put('mat_' + k, eyeSet(k), { goc: [95 * hs, 62 * hs] });
    const mouth = (kind) => { const c = cv(110 * hs, 80 * hs), g = c.getContext('2d'); g.scale(hs, hs); g.translate(55, 30); const dark = '#5a1f1c', ink = '#2a1210';
      if (kind === 'ngam' || kind === 'buon') { L().nutMuc(g, Array.from({ length: 11 }, (_, i) => { const x = -22 + i * 4.4; return [x, (kind === 'buon' ? -1 : 1) * (6 - (x * x) / 80)]; }), 3.6, ink); }
      else { const sh = { o: [9, 11, 0], a: [16, 18, 1], e: [20, 9, 2], to: [24, 20, 1], het: [26, 26, 1] }[kind] || [12, 12, 1];
        g.fillStyle = dark; g.beginPath(); if (kind === 'to') { g.moveTo(-sh[0], -4); g.quadraticCurveTo(0, 2, sh[0], -4); g.quadraticCurveTo(0, sh[1] * 1.6, -sh[0], -4); } else g.ellipse(0, 4, sh[0], sh[1], 0, 0, 7); g.fill();
        if (sh[2] === 2) { g.fillStyle = '#ffffff'; g.fillRect(-sh[0] * .8, -2, sh[0] * 1.6, 7); }
        if (kind !== 'o' && kind !== 'e') { g.fillStyle = '#e06a70'; g.beginPath(); g.ellipse(0, sh[1] * .75 + 2, sh[0] * .6, sh[1] * .35, 0, 0, 7); g.fill(); }
        g.strokeStyle = ink; g.lineWidth = 3.4; g.beginPath(); if (kind === 'to') { g.moveTo(-sh[0], -4); g.quadraticCurveTo(0, 2, sh[0], -4); g.quadraticCurveTo(0, sh[1] * 1.6, -sh[0], -4); } else g.ellipse(0, 4, sh[0], sh[1], 0, 0, 7); g.stroke(); }
      c.pad = 0; return c; };
    for (const k of ['ngam', 'buon', 'o', 'a', 'e', 'to', 'het']) put('mieng_' + k, mouth(k), { goc: [55 * hs, 30 * hs] });
    if (sp.kinh) { const c = cv(200 * hs, 80 * hs), g = c.getContext('2d'); g.scale(hs, hs); const col = sp.kinh.mau || '#e98a2a';
      for (const [x, r] of [[55, 30], [140, 26]]) { g.fillStyle = MS.u.rgba(col, .55); g.beginPath(); g.ellipse(x, 40, r, r * .92, 0, 0, 7); g.fill(); g.strokeStyle = '#3a2410'; g.lineWidth = 5; g.stroke();
        g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(x - r * .35, 40 - r * .4, r * .25, r * .12, -.6, 0, 7); g.fill(); }
      g.strokeStyle = '#3a2410'; g.lineWidth = 5; g.beginPath(); g.moveTo(84, 36); g.quadraticCurveTo(98, 28, 114, 36); g.stroke(); g.beginPath(); g.moveTo(25, 38); g.lineTo(2, 34); g.stroke();
      c.pad = 0; put('kinh', c, { goc: [97 * hs, 40 * hs] }); }
    // ---------------- torso ----------------
    const tw = 236 * D.rong, th = 288 * D.than, tcx = tw / 2;
    const torso = g => { const aoC = ao.mau || '#8fd0b0', inC = ao.mau_trong || '#f4f4f2', k = ao.kieu || 'khoac-mo';
      g.fillStyle = mix(da, '#c88a6a', .25); g.beginPath(); g.ellipse(tcx, 22, 34, 26, 0, 0, 7); g.fill();                                     // neck
      const body = () => { g.beginPath(); g.moveTo(tcx, 30);                       // rounded shoulders, soft pear-shaped belly
        for (const sd of [-1, 1]) { const X = v => tcx + sd * v * tw;
          if (sd < 0) { g.bezierCurveTo(X(.2), 28, X(.36), 30, X(.42), 44); g.bezierCurveTo(X(.5), 62, X(.47), 100, X(.46), th * .4); g.bezierCurveTo(X(.47), th * .62, X(.52), th * .8, X(.46), th * .97); g.lineTo(tcx, th * .97); }
          else { g.lineTo(X(.46), th * .97); g.bezierCurveTo(X(.52), th * .8, X(.47), th * .62, X(.46), th * .4); g.bezierCurveTo(X(.47), 100, X(.5), 62, X(.42), 44); g.bezierCurveTo(X(.36), 30, X(.2), 28, tcx, 30); } }
        g.closePath(); };
      if (k === 'khoac-mo') { g.fillStyle = aoC; body(); g.fill();                    // jacket, then the shirt showing through the open front, then lapels
        g.save(); body(); g.clip(); g.fillStyle = inC; g.beginPath(); g.moveTo(tcx - 26, 30); g.lineTo(tcx + 26, 30); g.lineTo(tcx + 44, th * .45); g.lineTo(tcx + 38, th); g.lineTo(tcx - 38, th); g.lineTo(tcx - 44, th * .45); g.closePath(); g.fill();
        g.fillStyle = mix(inC, '#9aa4b0', .25); g.fillRect(tcx - 44, th * .9, 88, th * .1); g.restore();
        g.fillStyle = mix(aoC, '#ffffff', .1); g.strokeStyle = mix(aoC, '#0d2a1e', .55); g.lineWidth = 3.5;
        for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(tcx + sd * 26, 32); g.lineTo(tcx + sd * 64, th * .2); g.lineTo(tcx + sd * 46, th * .3); g.lineTo(tcx + sd * 44, th * .45); g.closePath(); g.fill(); g.stroke(); } }
      else if (k === 'ba-ba') { g.fillStyle = aoC; body(); g.fill(); g.strokeStyle = mix(aoC, '#120a18', .5); g.lineWidth = 3.5; g.beginPath(); g.moveTo(tcx, 40); g.lineTo(tcx, th * .96); g.stroke();
        g.fillStyle = mix(aoC, '#120a18', .45); for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(tcx + 9, 70 + i * th * .2, 4.5, 0, 7); g.fill(); } }
      else { g.fillStyle = aoC; body(); g.fill(); g.fillStyle = mix(da, '#c88a6a', .2); g.beginPath(); g.ellipse(tcx, 40, 36, 16, 0, 0, PI); g.fill(); }
      if (sp.day_chuyen) { g.strokeStyle = mix(sp.day_chuyen, '#5a3a08', .5); g.fillStyle = sp.day_chuyen; g.lineWidth = 2;
        for (let i = 0; i <= 12; i++) { const a = PI * (.08 + .84 * i / 12), x = tcx - Math.cos(a) * 46, y = 42 + Math.sin(a) * 60; g.beginPath(); g.ellipse(x, y, 7, 5, a + (i % 2) * 1.3, 0, 7); g.fill(); g.stroke(); } } };
    const T = L().ve(tw, th, torso, STYLE(ao.mau || '#8fd0b0', { co: 30 }));
    put('than', T, { goc: [tcx, th * .9], ngon: [tcx, 18] });
    // ---------------- shorts / trousers waist ----------------
    const qw = tw * .9, qh = 130, qc = qw / 2, qcol = quan.mau || '#4a3428';
    const Q = L().ve(qw, qh, g => { g.fillStyle = qcol; g.beginPath(); g.moveTo(8, 0); g.lineTo(qw - 8, 0); g.bezierCurveTo(qw, 40, qw - 4, 90, qw - 30, qh - 6); g.lineTo(qc + 8, qh - 30); g.lineTo(qc - 8, qh - 30); g.lineTo(30, qh - 6); g.bezierCurveTo(4, 90, 0, 40, 8, 0); g.fill();
      g.strokeStyle = mix(qcol, '#000000', .45); g.lineWidth = 3; g.beginPath(); g.moveTo(10, 14); g.lineTo(qw - 10, 14); g.stroke(); }, STYLE(qcol, { co: 20 }));
    put('quan', Q, { goc: [qc, 60], ngon: [qc, -200] });
    // ---------------- legs (one continuous strip: trouser leg over the knee, shin, sock) ----------------
    const lw = 100 * D.rong, LT = 146 * D.chan, LS = 120 * D.chan, short = (quan.kieu || 'short') === 'short', lh = 12 + LT + LS + 26, ax = lw / 2;
    const C = L().ve(lw, lh, g => { const skin = da;
      g.fillStyle = skin; g.beginPath(); g.moveTo(ax - 27, 12 + LT - 10); g.lineTo(ax + 27, 12 + LT - 10); g.lineTo(ax + 24, 12 + LT + LS + 14); g.lineTo(ax - 24, 12 + LT + LS + 14); g.closePath(); g.fill();
      g.beginPath(); g.ellipse(ax, 12 + LT + 4, 30, 22, 0, 0, 7); g.fill();                                                                         // knee
      g.fillStyle = qcol; g.beginPath(); const bottom = short ? 12 + LT - 6 : 12 + LT + LS + 10;
      g.moveTo(ax - lw * .46, 0); g.lineTo(ax + lw * .46, 0); g.lineTo(ax + (short ? lw * .48 : 30), bottom); g.lineTo(ax - (short ? lw * .48 : 30), bottom); g.closePath(); g.fill();
      if (short) { g.strokeStyle = mix(qcol, '#000000', .45); g.lineWidth = 3; g.beginPath(); g.moveTo(ax - lw * .47, bottom - 12); g.lineTo(ax + lw * .47, bottom - 12); g.stroke(); }
      if (short) { g.fillStyle = '#f2f2f0'; g.fillRect(ax - 24, 12 + LT + LS - 4, 48, 22); } }, STYLE(qcol, { co: 22, bong: .45 }));
    put('chan', C, { goc: [ax, 12], kieu: 'day', truc_x: ax, hang: [12, 12 + LT, 12 + LT + LS] });
    // ---------------- shoe ----------------
    const gcol = giay.mau || '#f2f2f2', dep = giay.kieu === 'dep';
    const G = L().ve(140, 80, g => { if (dep) { g.fillStyle = mix(gcol, '#000000', .2); g.beginPath(); g.roundRect(4, 56, 132, 16, 8); g.fill(); g.fillStyle = da; g.beginPath(); g.ellipse(64, 46, 56, 18, 0, 0, 7); g.fill();
        g.strokeStyle = gcol; g.lineWidth = 8; g.beginPath(); g.moveTo(50, 30); g.lineTo(84, 60); g.stroke(); return; }
      g.fillStyle = gcol; g.beginPath(); g.moveTo(14, 18); g.bezierCurveTo(14, 4, 60, 2, 66, 16); g.bezierCurveTo(100, 22, 134, 36, 134, 58); g.lineTo(134, 66); g.lineTo(8, 66); g.closePath(); g.fill();
      g.fillStyle = mix(gcol, '#000000', .25); g.fillRect(6, 62, 130, 12); g.strokeStyle = giay.day || '#c8303a'; g.lineWidth = 5; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(60 + i * 12, 22 + i * 4); g.lineTo(78 + i * 12, 30 + i * 4); g.stroke(); } },
      STYLE(gcol, { co: 14, bong: .4 }));
    put('giay', G, { goc: [36, 18], ngon: [136, 18] });
    // ---------------- arms (strip: sleeve over the forearm, mitten hand; thumb towards the body) ----------------
    const aw = 92 * D.rong, AU = 128 * D.tay, AF = 108 * D.tay, ah = 14 + AU + AF + 62, ac = aw / 2, longS = ao.kieu === 'ba-ba';
    const arm = (thumbLeft) => L().ve(aw, ah, g => { const skin = da, aoC = ao.mau || '#8fd0b0';
      g.fillStyle = skin; g.beginPath(); g.moveTo(ac - 19, 14 + AU - 8); g.lineTo(ac + 19, 14 + AU - 8); g.lineTo(ac + 16, 14 + AU + AF + 4); g.lineTo(ac - 16, 14 + AU + AF + 4); g.closePath(); g.fill();
      const hy = 14 + AU + AF; g.beginPath(); g.ellipse(ac, hy + 22, 22, 27, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(ac + (thumbLeft ? -20 : 20), hy + 12, 9, 15, thumbLeft ? .5 : -.5, 0, 7); g.fill();   // mitten + thumb
      g.strokeStyle = mix(skin, '#5a2a1a', .5); g.lineWidth = 2.4; for (const dx of [-7, 2, 11]) { g.beginPath(); g.moveTo(ac + dx * (thumbLeft ? 1 : -1), hy + 36); g.lineTo(ac + dx * (thumbLeft ? 1 : -1), hy + 47); g.stroke(); }
      g.fillStyle = aoC; const end = longS ? 14 + AU + AF - 6 : 14 + AU + 4, wT = 25, wB = longS ? 19 : 28; g.beginPath(); g.moveTo(ac - wT, 0); g.bezierCurveTo(ac - wT - 6, 30, ac - wB - 2, end * .6, ac - wB, end); g.lineTo(ac + wB, end);
      g.bezierCurveTo(ac + wB + 2, end * .6, ac + wT + 6, 30, ac + wT, 0); g.closePath(); g.fill();
      if (!longS) { g.fillStyle = mix(aoC, '#ffffff', .12); g.beginPath(); g.roundRect(ac - wB - 4, end - 22, (wB + 4) * 2, 28, 12); g.fill(); g.strokeStyle = mix(aoC, '#0d2a1e', .55); g.lineWidth = 3; g.beginPath(); g.moveTo(ac - wB - 2, end - 9); g.lineTo(ac + wB + 2, end - 9); g.stroke(); } },
      STYLE(ao.mau || '#8fd0b0', { co: 20, bong: .5 }));
    put('tay_L', arm(true), { goc: [ac, 14], kieu: 'day', truc_x: ac, hang: [14, 14 + AU, 14 + AU + AF] });
    put('tay_R', arm(false), { goc: [ac, 14], kieu: 'day', truc_x: ac, hang: [14, 14 + AU, 14 + AU + AF] });
    // ---------------- rig ----------------
    const sp3 = (th * .9 - 18);
    const rig = { T: LT * K, S: LS * K, ank: 30 * K, foot: 100 * K, heel: 22 * K, hipW: 52 * D.rong * K, sp: [sp3 * .36 * K, sp3 * .34 * K, sp3 * .3 * K], neck: 4 * K,
      headUp: 130 * hs * K, headR: 128 * hs * K, shW: tw * .44 * K, shDrop: 30 * K, up: AU * K, fore: AF * K, hand: 30 * K };
    const flip = {}; for (const [k, im] of Object.entries(IMG)) { const c = cv(im.width, im.height), g = c.getContext('2d'); g.translate(im.width, 0); g.scale(-1, 1); g.drawImage(im, 0, 0); flip[k] = c; }
    const hp = headC.pad;
    return { ten: sp.ten || 'nhan-vat', ti_le_anh: K, rong_ngang: 1, rig, manh: P, img: IMG, flip,
      mat: { goc: [hp + 194 * hs, hp + 174 * hs], mieng: [hp + 204 * hs, hp + 250 * hs], co_mat: 1.32, co_mieng: 1.15, co_kinh: 1.32, nen_x: .92 },
      bieu_cam: { binh: 'mat_binh', so: 'mat_so', hoang: 'mat_ngac', ngac: 'mat_ngac', quyet: 'mat_quyet', gian: 'mat_gian', buon: 'mat_met', met: 'mat_met', nghi: 'mat_nghi', cuoi: 'mat_cuoi', vui: 'mat_cuoi', nham: 'mat_nham' },
      mieng: { ngam: 'mieng_ngam', o: 'mieng_o', a: 'mieng_a', e: 'mieng_e', to: 'mieng_to', het: 'mieng_het' },
      mieng_bieu_cam: { hoang: 'mieng_het', ngac: 'mieng_o', vui: 'mieng_to', cuoi: 'mieng_ngam', so: 'mieng_o', buon: 'mieng_buon', met: 'mieng_buon', gian: 'mieng_buon' } };
  }
  MS.xuong = { ...(MS.xuong || {}), build, DANG };
})();
