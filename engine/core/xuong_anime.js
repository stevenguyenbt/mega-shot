// mega-shot · xuong_anime.js — ANIME style for the character studio (xuong_nhanvat.js): same cut-out rig output, drawn with anime conventions
// (thin coloured lineart, 2-tone cel shading, big glossy eyes with gradient irises and layered highlights, clumped hair with an angel ring
// and a cast shadow on the forehead, blush hatching, cloth folds). Styles are presets of the same knobs, so one character description can be
// rendered as `anime` (TV anime), `anime-manga` (black ink, hard shadows) or `anime-mem` (soft lineless painting).
//
//   ve: { kieu: anh, xuong: { phong_cach: anime|anime-manga|anime-mem, vai: chau|ba (archetype), da, toc: { kieu: tre|bui, mau }, mat: { mau },
//         ao: { kieu: khoac-mo|ba-ba, mau, mau_trong }, quan: { kieu: short|dai, mau }, giay: { kieu: the-thao|dep, mau }, kinh: { mau } } }
(() => {
  const MS = window.MS, L = () => MS.lop, K = .5, PI = Math.PI;
  const mix = (a, b, t) => MS.u.mix(a, b, t), rgba = (c, a) => MS.u.rgba(c, a);
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; };
  const STYLES = {
    anime: { net: 3.2, netMau: .62, bong: [.42, .2], xa: [16, 30], mo: 0, sang: .22, bevel: .18, mi: 1, blush: 1 },
    'anime-manga': { net: 4.5, netMau: 1, bong: [.55, 0], xa: [14, 0], mo: 0, sang: 0, bevel: 0, mi: 1.25, blush: .5, den: true },
    'anime-chibi': { net: 3.4, netMau: .62, bong: [.4, .18], xa: [18, 32], mo: 0, sang: .26, bevel: .2, mi: 1.1, blush: 1.4 },
    'anime-mem': { net: 0, netMau: .4, bong: [.3, .14], xa: [16, 34], mo: 18, sang: .3, bevel: .25, mi: .9, blush: 1.2 },
    // teen / adult TV-manga look (thin dark lines, one hard cel tone): adult face, almond eyes, spiky hair, shirt + tie
    'anime-thanh-nien': { net: 2.4, netMau: .9, bong: [.36, 0], xa: [12, 0], mo: 0, sang: 0, bevel: 0, mi: .8, blush: .22, nguoi: true },
  };
  const VAI = {   // proportions in drawing px (K = .5 → world)
    chau: { dau: 1.06, tw: 200, th: 230, T: 128, S: 114, AU: 112, AF: 100, rong: 1.08 },
    ba: { dau: .9, tw: 214, th: 300, T: 186, S: 170, AU: 150, AF: 134, rong: 1 },
  };
  function build(sp) {
    if (sp.mo_ta) sp = { ...MS.giaiphau.doc(sp.mo_ta), ...sp };                            // a plain description fills every missing field
    const S = STYLES[sp.phong_cach] || STYLES.anime, A = MS.giaiphau.giai(sp); if (sp._chong) A.chong = sp._chong;
    const old = A.tuoi === 'gia' || sp.vai === 'ba', hs = A.hs;
    const da = sp.da || '#fbe3d0', toc = sp.toc || {}, hairC = toc.mau || (A.tuoi === 'gia' ? '#d2cdc6' : '#3a2a24'), ao = sp.ao || {}, quan = sp.quan || {}, giay = sp.giay || {};
    const lineOf = c => S.den ? '#141014' : mix(c, '#2a0e14', S.netMau);
    const style = (base, o = {}) => ({                                         // the style knobs → layer effects (hieuung_lop.js)
      net: S.net ? { size: (o.net ?? 1) * S.net, mau: lineOf(base) } : null,
      bong: S.bong[0] ? { mau: mix(base, S.den ? '#000000' : '#5a2a5a', S.den ? .7 : .42), op: S.bong[0] * (o.bong ?? 1), goc: -58, xa: (o.xa ?? 1) * S.xa[0], mo: S.mo, blend: 'multiply' } : null,
      sang: S.sang ? { mau: '#fff6f0', op: S.sang, co: 5 } : null,
      bevel: S.bevel ? { co: o.co ?? 22, goc: 125, cao: 45, op_sang: S.bevel, op_toi: S.bevel * .4 } : null, nhieu: .015, pad: o.pad });
    const second = (base, o = {}) => S.bong[1] ? { bong: { mau: mix(base, '#3a1240', .55), op: S.bong[1], goc: -58, xa: (o.xa ?? 1) * S.xa[1], mo: S.mo * 1.4, blend: 'multiply' } } : null;
    const P = {}, IMG = {}, RF = {}, RM = {}, put = (name, c, def, cut) => { const p = c.pad || 0; IMG[name] = c;
      if (c.ring) { RF[name] = c.ring; const m = cv(c.ring.width, c.ring.height), mg = m.getContext('2d'); mg.drawImage(c.ring, 0, 0);   // root-masked ring: no line where the part grows out of the body
        if (cut) { mg.globalCompositeOperation = 'destination-out'; mg.translate(p, p); mg.fillStyle = '#000'; mg.beginPath(); cut(mg); mg.fill(); } RM[name] = m; } P[name] = { anh: name, ...def, goc: def.goc.map(v => v + p), ...(def.ngon ? { ngon: def.ngon.map(v => v + p) } : {}),
      ...(def.truc_x != null ? { truc_x: def.truc_x + p, hang: def.hang.map(v => v + p) } : {}) }; };
    // body parts (adult): fill without outline + .ring (outline only). The renderer draws every ring first (one continuous silhouette line for the
    // whole body), then each part's root-masked ring + fill in depth order — so joints are seamless but overlapping limbs keep their line.
    const styledT = (w, h, draw, st, st2) => { if (!NG || !st.net) return styled(w, h, draw, st, st2);
      const sz = st.net.size, pad = Math.ceil(sz * 1.9 + 3), fill = styled(w, h, draw, { ...st, net: null, pad }, st2), mau = st.net.mau;
      const sil = (dx, dy, size) => { const c = L().ve(w, h, g => { g.translate(dx, dy); draw(g); }, { net: { size, mau }, pad, nhieu: 0 }), x = c.getContext('2d');
        x.globalCompositeOperation = 'source-in'; x.fillStyle = mau; x.fillRect(0, 0, c.width, c.height); return c; };           // whole silhouette (+ stroke) in line colour
      const ring = cv(fill.width, fill.height), rg = ring.getContext('2d'); rg.drawImage(sil(0, 0, sz * .55), 0, 0); rg.drawImage(sil(sz * .4, sz * .55, sz * 1.05), 0, 0);
      rg.globalCompositeOperation = 'destination-out'; rg.drawImage(fill, 0, 0); fill.ring = ring; return fill; };   // light side thin, shadow side heavy
    const styled = (w, h, draw, st, st2) => { const a = L().ve(w, h, draw, st); if (!st2) return a;   // + 2nd (deeper) cel tone, painted as a shadow map only
      const pad = a.pad, W = a.width, H = a.height, base = cv(W, H), bx = base.getContext('2d'); bx.translate(pad, pad); draw(bx);
      const al = L().alphaOf(base), m = L().E.bong(al, W, H, st2.bong); L().paintMap(a.getContext('2d'), m, W, H, st2.bong.mau, st2.bong.op, 'multiply'); return a; };
    const skinSh = mix(da, '#c8607a', .32);
    // ================= HEAD =================
    const HW = 300 * hs, HH = 340 * hs;
    const NG = !!S.nguoi;                                                            // adult face / eyes / mouth (old age = same face + grey hair + wrinkles)
    const faceShape = (g, col = da) => { g.save(); g.scale(hs, hs);
      if (NG) { const J = { tron: { f: .45, dy: -4 }, dai: { f: -.25, dy: 16 }, vuong: { sq: 1, f: .1 }, nhon: { f: -.35, dy: 8 } }[sp.mat_dang] || {}, sq = J.sq || 0, dy = J.dy || 0;   // face shapes
        const f = Math.max(-.6, Math.min(1, (A.w - 1) * 3 + (J.f || 0))), nw = 66 * A.w ** 1.2 * ((A.khoi && A.khoi.co) || 1); g.fillStyle = mix(col, skinSh, .3); g.beginPath(); g.roundRect(149 - nw / 2, 236, nw, 110, 18); g.fill();   // neck width follows the build
        g.fillStyle = col; g.beginPath(); g.arc(150, 146, 104, PI * .9, PI * 2.1); g.fill(); g.beginPath(); g.moveTo(48, 160);   // separate fills: opposite windings would cut a hole
        g.bezierCurveTo(48 - f * 6, 226 + f * 34 + dy * .3, 112 - f * 44 + sq * 34, 282 + f * 16 + dy + sq * 12, 188 - sq * 8, 298 + f * 6 + dy); g.quadraticCurveTo(214 + f * 4, 302 + f * 8 + dy + sq * 3, 228 + f * 12 + sq * 8, 288 + f * 4 + dy * .6); g.bezierCurveTo(248 + f * 16 + sq * 8, 266 + f * 4 + dy * .4, 258 + f * 12, 234, 258, 196); g.lineTo(254, 120); g.lineTo(48, 120); g.closePath(); g.fill();   // fuller cheeks / rounder chin when heavier
        g.beginPath(); g.ellipse(58, 196, 15, 26, -.12, 0, 7); g.fill(); g.restore(); return; }
      g.fillStyle = mix(col, skinSh, .35); g.beginPath(); g.roundRect(124, 236, 60, 78, 22); g.fill();   // neck under the chin
      g.fillStyle = col; g.beginPath(); g.arc(150, 152, 112, 0, 7); g.fill();
      g.beginPath(); g.moveTo(44, 150); g.bezierCurveTo(46, old ? 250 : 236, old ? 104 : 112, old ? 300 : 292, old ? 176 : 172, old ? 300 : 288);
      g.bezierCurveTo(old ? 226 : 214, old ? 296 : 286, old ? 254 : 250, old ? 262 : 258, 262, 196); g.lineTo(262, 150); g.closePath(); g.fill();
      g.beginPath(); g.ellipse(56, 200, 18, 27, -.1, 0, 7); g.fill(); g.restore(); };
    const tips = old ? null : [[270, 186], [246, 150], [222, 176], [192, 140], [166, 172], [134, 136], [108, 166], [80, 132], [56, 170]];
    const BOM = [[34, 238], [58, 196], [10, 168], [42, 136], [2, 92], [52, 82], [30, 34], [92, 50], [96, 4], [142, 36], [176, 0], [196, 40], [244, 22], [240, 66], [286, 76],
      [264, 104], [296, 146], [270, 146], [280, 196], [256, 150], [246, 194], [228, 132], [212, 178], [200, 126], [190, 200], [178, 128], [158, 166], [146, 120], [120, 160], [108, 124],
      [86, 156], [74, 132], [60, 170]];
    for (let i = 1; i < 18; i += 2) { const p = BOM[i]; p[0] = 150 + (p[0] - 150) * 1.2; p[1] = 140 + (p[1] - 140) * 1.2; }   // shallow notches on the crown: smooth volume, a few flicks                                    // messy spiky hair: alternating lock tips and roots, crown → bangs
    const TK = NG && MS.toc && MS.toc.KIEU[toc.kieu], HP = { c: hairC, da, phu: toc.phu || '#e04a5a' };   // adult hair styles: toc_nhanvat.js
    const hairShape = g => { g.save(); g.scale(hs, hs); g.fillStyle = hairC; g.beginPath(); if (TK) { TK.front(g, HP); g.restore(); return; }
      if (toc.kieu === 'bom' && (!old || NG)) { g.moveTo(...BOM[0]);
        for (let i = 1; i <= BOM.length; i++) { const p = BOM[i - 1], q = BOM[i % BOM.length], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, dx = q[0] - p[0], dy = q[1] - p[1];   // same-sign bow on both sides = every lock curls the same way
          g.quadraticCurveTo(mx - dy * .2 + (150 - mx) * .06, my + dx * .2 + (130 - my) * .06, q[0], q[1]); }
        g.closePath(); g.fill(); g.globalCompositeOperation = 'source-atop';
        g.fillStyle = mix(hairC, '#5a1a10', .3); g.beginPath(); g.moveTo(0, 230); g.bezierCurveTo(30, 150, 60, 120, 120, 112); g.bezierCurveTo(180, 104, 240, 116, 300, 130); g.lineTo(300, 260); g.lineTo(0, 260); g.closePath(); g.fill();   // cel shade: underside of the bangs + back of the head
        g.beginPath(); g.moveTo(0, 60); g.quadraticCurveTo(30, 130, 70, 150); g.lineTo(0, 200); g.closePath(); g.fill();
        g.fillStyle = mix(hairC, '#fff2d8', .22); for (const [a, b, c2, d] of [[96, 50, 150, 34], [170, 26, 226, 40]]) { g.beginPath(); g.moveTo(a, b); g.quadraticCurveTo((a + c2) / 2, b - 10, c2, d); g.quadraticCurveTo((a + c2) / 2, b + 12, a, b); g.fill(); }
        g.strokeStyle = mix(hairC, '#3a1408', .45); g.lineWidth = 1.8;
        for (const [a, b, c2, d] of [[150, 40, 186, 190], [120, 60, 136, 150], [200, 50, 236, 160], [90, 80, 84, 150], [230, 70, 268, 150], [60, 110, 30, 180], [170, 70, 200, 118]]) { g.beginPath(); g.moveTo(a, b); g.quadraticCurveTo((a + c2) / 2 + 6, (b + d) / 2 - 4, c2, d); g.stroke(); } }
      else if (toc.kieu === 'dai' && (!old || NG)) { g.moveTo(30, 230); g.bezierCurveTo(8, 110, 70, 24, 160, 22); g.bezierCurveTo(258, 24, 300, 110, 284, 226);     // long hair, front: side-swept bangs
        g.lineTo(270, 196); g.quadraticCurveTo(262, 150, 236, 132); g.quadraticCurveTo(222, 168, 204, 176); g.quadraticCurveTo(196, 140, 168, 128); g.quadraticCurveTo(150, 166, 122, 172);
        g.quadraticCurveTo(118, 136, 92, 132); g.quadraticCurveTo(70, 170, 58, 220); g.closePath(); g.fill();
        g.globalCompositeOperation = 'source-atop'; g.fillStyle = mix(hairC, '#ffffff', .42); g.beginPath(); g.moveTo(82, 74); g.quadraticCurveTo(160, 44, 240, 70); for (let x = 240; x >= 82; x -= 16) g.lineTo(x - 8, 82 + (x % 32 ? 12 : 3)); g.closePath(); g.fill();
        g.strokeStyle = mix(hairC, '#000000', .35); g.lineWidth = 2.2; for (const [a, b, c2, d] of [[120, 50, 100, 140], [180, 40, 176, 120], [230, 60, 250, 150]]) { g.beginPath(); g.moveTo(a, b); g.quadraticCurveTo((a + c2) / 2 + 8, (b + d) / 2, c2, d); g.stroke(); } }
      else if (!old) { g.moveTo(34, 214); g.bezierCurveTo(10, 120, 60, 24, 160, 22); g.quadraticCurveTo(150, 0, 176, -6); g.quadraticCurveTo(168, 10, 182, 24);   // cowlick
        g.bezierCurveTo(262, 34, 298, 104, 282, 196); g.lineTo(266, 192);
        for (let i = 1; i < tips.length; i++) { const [x0, y0] = tips[i - 1], [x1, y1] = tips[i], vx = (x0 + x1) / 2, vy = Math.min(y0, y1) - 16; g.quadraticCurveTo(x0 - 4, (y0 + vy) / 2, vx, vy); g.quadraticCurveTo(x1 + 2, (y1 + vy) / 2, x1, y1); }
        g.lineTo(44, 168); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(40, 160); g.quadraticCurveTo(26, 210, 38, 250); g.quadraticCurveTo(54, 210, 58, 170); g.fill();           // sideburn lock
        g.globalCompositeOperation = 'source-atop';                                 // highlights + strands stay inside the hair
        // angel ring
        g.fillStyle = mix(hairC, '#ffffff', .42); g.beginPath(); g.moveTo(78, 78); g.quadraticCurveTo(150, 46, 238, 72); for (let x = 238; x >= 78; x -= 16) g.lineTo(x - 8, 80 + (x % 32 ? 12 : 3) * (x > 150 ? 1 : 1.2)); g.closePath(); g.fill();
        g.strokeStyle = mix(hairC, '#000000', .35); g.lineWidth = 2.4; for (const [a, b, c2, d] of [[110, 60, 90, 130], [170, 40, 160, 110], [222, 58, 236, 120], [70, 110, 58, 160]]) { g.beginPath(); g.moveTo(a, b); g.quadraticCurveTo((a + c2) / 2 + 8, (b + d) / 2, c2, d); g.stroke(); } }
      else { g.moveTo(38, 196); g.bezierCurveTo(22, 100, 80, 34, 160, 32); g.bezierCurveTo(246, 32, 290, 96, 276, 176); g.bezierCurveTo(256, 120, 220, 102, 186, 112);    // swept-back grey hair, side part
        g.bezierCurveTo(150, 100, 108, 112, 82, 138); g.bezierCurveTo(66, 154, 56, 176, 52, 200); g.closePath(); g.fill();
        g.beginPath(); g.ellipse(46, 92, 52, 46, -.4, 0, 7); g.fill();                                                                      // bun at the back
        g.globalCompositeOperation = 'source-atop';
        g.strokeStyle = mix(hairC, '#5a5050', .45); g.lineWidth = 2.6; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(84 + i * 30, 46 + Math.abs(i - 2.5) * 6); g.quadraticCurveTo(60 + i * 30, 110, 60 + i * 22, 168); g.stroke(); }
        g.beginPath(); g.arc(46, 92, 30, -1.2, 2); g.stroke(); g.fillStyle = mix(hairC, '#ffffff', .5); g.beginPath(); g.ellipse(150, 58, 70, 10, -.1, 0, 7); g.fill();
        g.globalCompositeOperation = 'source-over'; g.strokeStyle = '#7a4a2a'; g.lineWidth = 6; g.beginPath(); g.moveTo(10, 70); g.lineTo(88, 110); g.stroke(); }   // hairpin
      g.restore(); };
    const backHair = g => { g.save(); g.scale(hs, hs); g.fillStyle = mix(hairC, '#000000', .18); g.beginPath(); g.moveTo(40, 120); g.bezierCurveTo(6, 200, 10, 300, 44, 336); g.lineTo(120, 322); g.lineTo(180, 330);
      g.lineTo(262, 334); g.bezierCurveTo(296, 290, 300, 190, 270, 110); g.closePath(); g.fill(); g.restore(); };
    const H = styled(HW, HH, g => faceShape(g), style(da, { co: 40, xa: 1.2 }), second(da, { xa: 1 }));
    const Hh = styled(HW, HH, g => hairShape(g), style(hairC, { co: 18, net: 1.1 }), second(hairC));
    const head = cv(H.width, H.height), hg = head.getContext('2d'), pad = H.pad;
    const backFn = TK ? (TK.back ? g => { g.save(); g.scale(hs, hs); TK.back(g, HP); g.restore(); } : null) : toc.kieu === 'dai' && (!old || NG) ? backHair : null;
    if (backFn) { const Bh = styled(HW, HH, backFn, style(hairC, { co: 18 }), second(hairC)); hg.drawImage(Bh, pad - Bh.pad, pad - Bh.pad); }   // long hair / tails / bob mass behind the face   // long hair behind the face
    hg.drawImage(H, 0, 0);
    // face details on the head: hair cast shadow, nose, blush, (grandma) laugh lines
    const fx = cv(H.width, H.height), fg = fx.getContext('2d'); fg.translate(pad, pad);
    fg.save(); fg.translate(4 * hs, 14 * hs); hairShape(fg); fg.restore(); fg.globalCompositeOperation = 'source-in'; fg.fillStyle = rgba(skinSh, .55); fg.fillRect(-pad, -pad, fx.width, fx.height);
    fg.globalCompositeOperation = 'source-over'; fg.save(); fg.scale(hs, hs);
    const muiK = NG ? sp.mui || 'gach' : 'gach'; fg.strokeStyle = lineOf(da); fg.lineWidth = 2.4; fg.beginPath();                                       // nose
    if (muiK === 'cham') { fg.fillStyle = rgba(lineOf(da), .55); fg.ellipse(240, 232, 3.4, 2.4, 0, 0, 7); fg.fill(); }
    else if (muiK === 'cao') { fg.moveTo(232, 190); fg.quadraticCurveTo(250, 222, 238, 238); fg.stroke(); }
    else if (muiK === 'tron') { fg.moveTo(232, 226); fg.quadraticCurveTo(250, 222, 248, 236); fg.quadraticCurveTo(240, 242, 232, 236); fg.stroke(); }
    else { fg.moveTo(238, 220); fg.quadraticCurveTo(246, 232, 236, 236); fg.stroke(); }
    if (NG) for (const m of sp.dau || []) { const ln = lineOf(da);
      if (m === 'tan_nhang') { fg.fillStyle = rgba(mix(da, '#7a3a20', .6), .7); for (let i = 0; i < 14; i++) { const x = (i < 8 ? 132 : 228) + ((i * 37) % 28), y = 214 + ((i * 53) % 18); fg.beginPath(); fg.arc(x, y, 1.6, 0, 7); fg.fill(); } }
      else if (m === 'not_ruoi') { fg.fillStyle = mix(ln, '#000000', .3); fg.beginPath(); fg.arc(226, 262, 2.6, 0, 7); fg.fill(); }
      else if (m === 'rau') { fg.fillStyle = rgba(mix(hairC, '#202020', .3), .28); for (let i = 0; i < 90; i++) { const a = .15 + 1.5 * ((i * 41) % 100) / 100, r = 46 + ((i * 29) % 14); fg.beginPath(); fg.arc(196 + Math.cos(a) * r * .8, 236 + Math.sin(a) * r * .9, 1.1, 0, 7); fg.fill(); } }
      else if (m === 'ria') { fg.fillStyle = mix(hairC, '#202020', .2); fg.beginPath(); fg.moveTo(196, 252); fg.quadraticCurveTo(214, 238, 236, 250); fg.quadraticCurveTo(214, 246, 196, 252); fg.fill(); }
      else if (m === 'seo') { fg.strokeStyle = rgba(mix(da, '#8a3a3a', .6), .8); fg.lineWidth = 2.6; fg.beginPath(); fg.moveTo(214, 196); fg.lineTo(236, 226); fg.stroke(); fg.lineWidth = 1.4; for (let k = 0; k < 3; k++) { fg.beginPath(); fg.moveTo(216 + k * 7, 210 + k * 6); fg.lineTo(226 + k * 7, 204 + k * 6); fg.stroke(); } }
      else if (m === 'ma_hong') { const gr = fg.createRadialGradient(150, 236, 2, 150, 236, 30); gr.addColorStop(0, rgba('#ff6a7a', .45)); gr.addColorStop(1, rgba('#ff6a7a', 0)); fg.fillStyle = gr; fg.beginPath(); fg.ellipse(150, 236, 38, 20, 0, 0, 7); fg.fill(); } }
    if (S.blush) for (const [x, y, r] of [[152, 236, 26], [246, 230, 18]]) { const gr = fg.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, rgba('#ff7a8a', .38 * S.blush)); gr.addColorStop(1, rgba('#ff7a8a', 0)); fg.fillStyle = gr; fg.beginPath(); fg.ellipse(x, y, r * 1.3, r * .7, 0, 0, 7); fg.fill();
      if (!old && !NG) { fg.strokeStyle = rgba('#e0506a', .55); fg.lineWidth = 2; for (let k = -1; k <= 1; k++) { fg.beginPath(); fg.moveTo(x + k * 9 - 4, y + 5); fg.lineTo(x + k * 9 + 4, y - 5); fg.stroke(); } } }
    if (NG && A.bung > 1.2) { fg.strokeStyle = rgba(lineOf(da), .4); fg.lineWidth = 2; fg.beginPath(); fg.moveTo(150, 312); fg.quadraticCurveTo(196, 334, 238, 304); fg.stroke(); }   // soft double chin
    if (old && NG) { fg.strokeStyle = rgba(lineOf(da), .55); fg.lineWidth = 1.8; for (const [a, b, c2, d, e, f] of [[118, 190, 112, 200, 112, 212], [258, 186, 262, 196, 262, 206], [196, 228, 186, 250, 196, 266], [90, 132, 150, 124, 210, 132], [100, 146, 150, 140, 200, 146]]) { fg.beginPath(); fg.moveTo(a, b); fg.quadraticCurveTo(c2, d, e, f); fg.stroke(); } }   // crow's feet, smile line, forehead lines
    else if (old) { fg.strokeStyle = rgba(lineOf(da), .6); fg.lineWidth = 2; for (const [a, b, c2, d, e, f] of [[120, 258, 128, 274, 142, 282], [252, 250, 254, 264, 248, 272], [122, 200, 114, 208, 110, 218], [264, 192, 270, 200, 270, 210]]) { fg.beginPath(); fg.moveTo(a, b); fg.quadraticCurveTo(c2, d, e, f); fg.stroke(); } }
    fg.restore(); fg.globalCompositeOperation = 'destination-in'; fg.drawImage(H, -pad, -pad);
    hg.drawImage(fx, 0, 0); hg.drawImage(Hh, pad - Hh.pad, pad - Hh.pad); head.pad = pad;
    put('dau', head, { goc: [154 * hs, 300 * hs], ngon: [150 * hs, 160 * hs] });
    // ---- photo face (xuong.mat_anh): the user's picture becomes the head; light background removed, outlined in the style, neck added ----
    const photo = sp.mat_anh && MS.xuong.IMGS && MS.xuong.IMGS[sp.mat_anh];
    if (photo) { const pw = photo.naturalWidth, ph = photo.naturalHeight, src = cv(pw, ph), sg = src.getContext('2d'); sg.drawImage(photo, 0, 0);
      const cut = sp.mat_cat || [0, 0, pw, ph], [cx0, cy0, cw, ch] = cut, im = sg.getImageData(cx0, cy0, cw, ch), d = im.data, N = cw * ch;
      // background = pixels connected to the crop border whose colour is close to the border's median colour (robust to JPEG noise)
      const bord = []; for (let x0 = 0; x0 < cw; x0++) bord.push(x0, (ch - 1) * cw + x0); for (let y = 0; y < ch; y++) bord.push(y * cw, y * cw + cw - 1);
      const med = [0, 1, 2].map(k => { const v = bord.map(i => d[i * 4 + k]).sort((p, q) => p - q); return v[v.length >> 1]; }), tol = sp.mat_nguong ?? 26;
      const near = i => Math.abs(d[i * 4] - med[0]) + Math.abs(d[i * 4 + 1] - med[1]) + Math.abs(d[i * 4 + 2] - med[2]) < tol * 3;
      const bg = new Uint8Array(N), st = [...bord]; while (st.length) { const i = st.pop(); if (bg[i] || !near(i)) continue; bg[i] = 1; const x0 = i % cw, y = (i / cw) | 0; if (x0 > 0) st.push(i - 1); if (x0 < cw - 1) st.push(i + 1); if (y > 0) st.push(i - cw); if (y < ch - 1) st.push(i + cw); }
      const al = new Float32Array(N); for (let i = 0; i < N; i++) al[i] = bg[i] ? 0 : 1;
      if (sp.mat_elip) { const [ex, ey, erx, ery] = sp.mat_elip; for (let i = 0; i < N; i++) { const x0 = i % cw, y = (i / cw) | 0, q = ((x0 - ex) / erx) ** 2 + ((y - ey) / ery) ** 2; if (q > 1) al[i] = 0; } }   // keep only the head (drops hands / collar in the photo)
      const soft = MS.lop.tent(al, cw, ch, 2.2); for (let i = 0; i < N; i++) d[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, (soft[i] - .25) / .6)) * 255);   // feathered, slightly choked edge
      const face = cv(cw, ch); face.getContext('2d').putImageData(im, 0, 0);
      const scl = A.H * .92 / ch, fw = cw * scl, fh = ch * scl, nw = Math.min(fw * .3, A.H * .24), nh = A.H * .28;
      const P2 = L().ve(fw, fh + nh * .6, g => { g.fillStyle = mix(da, skinSh, .3); g.beginPath(); g.roundRect(fw / 2 - nw / 2, fh - nh * .6, nw, nh * 1.2, nw * .3); g.fill(); g.drawImage(face, 0, 0, fw, fh); },
        { net: S.net ? { size: S.net * 1.2, mau: '#2a2024' } : null, nhieu: 0 });
      put('dau', P2, { goc: [fw / 2, fh + nh * .15], ngon: [fw / 2, fh * .45] });
    }
    // ================= EYES (sets per expression) =================
    const iris = (sp.mat || {}).mau || '#5a3a2a', irisL = mix(iris, '#ffd9a0', .55), lash = S.den ? '#120c10' : mix(hairC, '#140810', .6);
    // adult almond eyes: iris taller than the opening (cut by both lids), upper lid edge = max(lid curve, eyelid line) so every expression is
    // one set of numbers — lid (top cover), slope (+ angry: inner corner down, − sad), low (cheek squint), R (opening), ir (iris), look (gaze x)
    const EYE_NG = { binh: { lid: .14 }, met: { lid: .48, low: .08 }, cuoi: { lid: .08, low: .5, ir: .95 }, tu_tin: { lid: .34, low: .26, slope: .1, look: 3 },
      ngac: { R: 1.3, ir: .58, pup: .5 }, so: { R: 1.25, ir: .48, pup: .4, slope: -.2 }, quyet: { lid: .26, slope: .32, low: .1 }, gian: { lid: .3, slope: .55, ir: .82, low: .12 },
      buon: { lid: .22, slope: -.45 }, nghi: { lid: .28, look: 6, slope: .08 } };
    const adultEyes = (g, kind, ink, arc) => {
      const BR = { binh: [0, 0], met: [4, 0], cuoi: [-4, -2], tu_tin: [-3, 4], ngac: [-12, -2], so: [-8, -8], quyet: [3, 9], gian: [6, 14], buon: [-3, -12], nghi: [0, 6], nham: [0, 0] }[kind] || [0, 0];
      for (const [ex, ey, sx, inn] of [[70, 74, 1, 1], [158, 74, .84, -1]]) { g.save(); g.translate(ex, ey); g.scale(sx, 1);
        const EK = { tron: { rx: .95, ry: 1.28, ir: 1.04 }, to: { rx: 1.1, ry: 1.5, ir: 1.08 }, sac: { ry: .82, tilt: .4 }, cup: { ry: 1.05, tilt: -.32, lid: .06 }, hep: { ry: .7, lid: .06 } }[sp.mat_kieu] || {};   // eye shapes
        const E0 = EYE_NG[kind] || EYE_NG.binh, E = { ...E0, lid: Math.min(.62, (E0.lid || 0) + (old ? .14 : 0) + (EK.lid || 0)) }, rx = 30 * (EK.rx || 1), ry = 13.5 * (E.R || 1) * (EK.ry || 1), tl = (EK.tilt || 0) * ry * .9 * inn / rx,
          up = x => { const t = (x + rx) / (2 * rx); return 3 - 4 * t - (ry * 1.62) * Math.sin(PI * t) ** .8 + tl * x; },
          lo = x => { const t = (x + rx) / (2 * rx); return 3 - 4 * t + ry * 1.18 * Math.sin(PI * t) ** .9 + tl * x * .6; };
        const lidY = x => up(0) + (E.lid || 0) * (lo(0) - up(0)) + (E.slope || 0) * ry * (x * inn) / rx, lowY = x => lo(0) - (E.low || 0) * (lo(0) - up(0)) * (1 - .4 * (x / rx) ** 2);
        const N = 18, xs = Array.from({ length: N }, (_, i) => -rx + 2 * rx * i / (N - 1)), top = xs.map(x => [x, Math.max(up(x), Math.min(lidY(x), lo(x) - 1.5))]), bot = xs.map(x => [x, Math.min(lo(x), Math.max(lowY(x), up(x) + 1.5))]);
        if (kind === 'nham') { ink(xs.map(x => [x, 3 - x * .08 + 4 * (1 - (x / rx) ** 2)]), 3.6); ink([[-rx * inn, 4], [-rx * inn - 6 * inn, 0]], 1.4); g.restore(); continue; }
        g.save(); g.beginPath(); top.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); for (let i = N - 1; i >= 0; i--) g.lineTo(...bot[i]); g.closePath(); g.clip();
        g.fillStyle = '#fbf8f3'; g.fillRect(-40, -40, 80, 80);
        const ir = ry * 1.05 * (E.ir || 1) * (EK.ir || 1) / (E.R || 1) / (EK.ry || 1) ** .5 * 1.05, cx = (E.look || 0) + 2, cy = 1;
        const gr = g.createLinearGradient(0, cy - ir, 0, cy + ir); gr.addColorStop(0, mix(iris, '#000000', .55)); gr.addColorStop(.5, iris); gr.addColorStop(1, irisL);
        g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, ir, 0, 7); g.fill(); g.strokeStyle = mix(iris, '#000000', .65); g.lineWidth = 1.6; g.stroke();
        g.fillStyle = mix(iris, '#000000', .75); g.beginPath(); g.arc(cx, cy, ir * (E.pup || .42), 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(cx - ir * .38, cy - ir * .3, ir * .2, 0, 7); g.fill(); g.beginPath(); g.arc(cx + ir * .42, cy + ir * .36, ir * .08, 0, 7); g.fill();
        g.fillStyle = rgba(mix(da, '#6a3a5a', .5), .35); g.beginPath(); top.forEach(([x, y], i) => i ? g.lineTo(x, y + 4.5) : g.moveTo(x, y + 4.5)); g.lineTo(rx, -30); g.lineTo(-rx, -30); g.closePath(); g.fill();   // lid shadow
        g.restore();
        ink(top, (A.nu ? 6 : 4.8) * S.mi / .8, lash, .42); if (A.nu) for (let k = 0; k < 3; k++) { const o = top[inn > 0 ? k * 2 : N - 1 - k * 2]; ink([o, [o[0] - (9 - k * 2) * inn, o[1] - 7 + k * 2]], 1.5, lash, .3); }                                                         // upper lid (thickest line on the face)
        ink(bot.filter(([x]) => x * inn > -rx * .2), 1.3, rgba(lash, .85), .5);                       // lower lid, outer part only
        const cr = xs.filter(x => x * inn > -rx * .55).map(x => [x, Math.min(up(x), lidY(x)) - 5 - 2 * (1 - (x / rx) ** 2)]); if ((E.lid || 0) < .4) ink(cr, .9, rgba(lash, .55), .5);   // double-lid crease
        const oc = top[inn > 0 ? 0 : N - 1]; ink([oc, [oc[0] - 7 * inn, oc[1] - 3]], 1.6, lash, .4);   // outer corner flick
        if (kind === 'so') for (const k of [-1, 1]) ink([[k * (rx + 5), -8], [k * (rx + 9), -2]], .9, rgba(lash, .7), .5);
        g.restore(); }
      const MK = { day: { w: 1.75 }, manh: { w: .6 }, ngang: { b: 0 }, cong: { b: 2.2 }, xech: { t: 6 } }[sp.may_kieu] || {};   // brow shapes
      const brow = (x0, y0, x1, y1, bend) => ink(Array.from({ length: 12 }, (_, i) => { const t = i / 11; return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - bend * (MK.b ?? 1) * Math.sin(PI * t)]; }), 3.4 * (sp.may || 1) * (MK.w || 1), lash, .3);
      const dy = BR[0], tl = BR[1] + (MK.t || 0); brow(46, 50 + dy - tl * .4, 98, 48 + dy + tl, 6); brow(136, 48 + dy + tl * .9, 180, 50 + dy - tl * .35, 4);   // inner ends (toward the nose) carry the tilt
    };
    const eyeSet = kind => { const c = cv(220 * hs, 130 * hs), g = c.getContext('2d'); g.scale(hs, hs);
      const ink = (pts, r, col = lash, tp = .55) => L().nutMuc(g, pts, r * S.mi, col, tp), arc = (cx, cy, rx, ry, a0, a1, n = 14) => Array.from({ length: n }, (_, i) => { const a = a0 + (a1 - a0) * i / (n - 1); return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
      const eyes = [[70, 70, 1], [158, 70, .82]];
      if (NG) { adultEyes(g, kind, ink, arc); c.pad = 0; return c; }
      for (const [ex, ey, sx] of eyes) { g.save(); g.translate(ex, ey); g.scale(sx, 1);
        const rx = old ? 21 : 26, ry = old ? 13 : 32;
        if (kind === 'cuoi' || kind === 'nham' || (old && kind === 'binh')) {               // closed / smiling crescents (grandma's default gentle smile)
          ink(kind === 'nham' ? arc(0, -2, rx, 6, .1, PI - .1) : arc(0, 10, rx, old ? 10 : 14, PI + .15, 2 * PI - .15), old ? 4.4 : 5);
          if (old) ink(arc(rx + 6, 0, 8, 8, -.6, .6, 6), 1.6, rgba(lash, .7), .4);
          g.restore(); continue; }
        const lid = kind === 'met' || kind === 'quyet' ? .45 : kind === 'gian' ? .35 : 0, R = kind === 'ngac' ? 1.12 : 1;
        g.save(); g.beginPath(); g.ellipse(0, 4, rx * R, ry * R, 0, 0, 7); g.clip();
        g.fillStyle = '#ffffff'; g.fillRect(-60, -60, 120, 120);
        const ir = (kind === 'ngac' ? .6 : .82) * rx, gr = g.createLinearGradient(0, -ry, 0, ry); gr.addColorStop(0, mix(iris, '#000000', .45)); gr.addColorStop(.55, iris); gr.addColorStop(1, irisL);
        g.fillStyle = gr; g.beginPath(); g.ellipse(4, 8, ir, ir * 1.28, 0, 0, 7); g.fill(); g.strokeStyle = mix(iris, '#000000', .6); g.lineWidth = 2.5; g.stroke();
        g.fillStyle = mix(iris, '#000000', .72); g.beginPath(); g.ellipse(4, 6, ir * .45, ir * .62, 0, 0, 7); g.fill();
        g.fillStyle = rgba(irisL, .85); g.beginPath(); g.ellipse(6, ir * .95, ir * .55, ir * .22, 0, 0, 7); g.fill();               // lower iris glow
        g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.ellipse(-ir * .35, -ir * .45, ir * .36, ir * .3, -.4, 0, 7); g.fill(); g.beginPath(); g.arc(ir * .55, ir * .55, ir * .14, 0, 7); g.fill();
        g.fillStyle = rgba('#9ab0d0', .35); g.fillRect(-60, -60, 120, 60 * .0 + ry * .25 + 6 - ry);                                          // lid shadow on the white
        if (lid) { g.fillStyle = da; g.fillRect(-60, -60, 120, 60 - ry + ry * 2 * lid); }
        g.restore();
        const top = -ry * R + 4 + ry * 2 * lid;
        ink([...arc(0, 4 + ry * 2 * lid * .5, rx * R + 2, ry * R * (1 - lid) + 1, PI * 1.05, PI * 1.95, 16), [rx * R + 10, top + 4]], old ? 4 : 6.5);   // upper lash line + flick
        ink(arc(0, 4, rx * R * .85, ry * R + 1, PI * .22, PI * .68, 8), old ? 1.4 : 1.8, rgba(lash, .8), .5);                         // lower lash
        g.restore(); }
      const brow = (x0, y0, xm, ym, x1, y1) => ink(Array.from({ length: 12 }, (_, i) => { const t = i / 11; return [(1 - t) ** 2 * x0 + 2 * t * (1 - t) * xm + t * t * x1, (1 - t) ** 2 * y0 + 2 * t * (1 - t) * ym + t * t * y1]; }), (old ? 3.2 : 3.6) * (sp.may || 1), old ? mix(hairC, '#6a5a50', .4) : lash, (sp.may || 1) > 1.5 ? .35 : .7);   // sp.may: brow weight (2.5 = thick cartoon brows)
      const dy = { ngac: -12, so: -6, gian: 10, quyet: 6, buon: -4, nghi: 0, met: 4 }[kind] || 0, tilt = { gian: 12, quyet: 8, so: -10, buon: -12 }[kind] || 0;
      brow(42, 26 + dy + tilt, 70, 18 + dy, 96, 24 + dy - tilt * .5); brow(140, 24 + dy - tilt * .5, 160, 16 + dy, 180, 24 + dy + tilt * .6);
      if (kind === 'nghi') brow(140, 12, 160, 4, 180, 14);
      c.pad = 0; return c; };
    for (const k of ['binh', 'cuoi', 'ngac', 'quyet', 'gian', 'so', 'met', 'nham', 'nghi', 'buon', 'tu_tin']) put('mat_' + k, eyeSet(k), { goc: [114 * hs, 70 * hs] });
    const mouth = kind => { const c = cv(90 * hs, 70 * hs), g = c.getContext('2d'); g.scale(hs, hs); g.translate(45, 26); const ln = lineOf(da), inside = '#8a2c38';
      if (kind === 'nhech') { L().nutMuc(g, Array.from({ length: 10 }, (_, i) => { const x = -11 + i * 2.6; return [x, 2 - Math.max(0, x + 2) ** 2 / 30]; }), 2.4, ln, .55); L().nutMuc(g, [[13, -5], [15, -1]], 1.2, ln, .5); }   // smirk: one corner up + dimple
      else if (kind === 'cuoi_rang') { g.fillStyle = inside; g.beginPath(); g.moveTo(-17, -2); g.quadraticCurveTo(0, 1, 18, -5); g.quadraticCurveTo(12, 17, -2, 17); g.quadraticCurveTo(-14, 15, -17, -2); g.fill();   // grin, sharp teeth
        g.save(); g.clip(); g.fillStyle = '#fbfaf6';
        if (sp.rang === 'nhon') { g.beginPath(); g.moveTo(-18, -4); g.lineTo(19, -7); for (let x = 18; x >= -17; x -= 5) { g.lineTo(x - 2.5, 6 - (x - 18) * .03); g.lineTo(x - 5, 1.5 - (x - 18) * .05); } g.closePath(); g.fill();   // sharp teeth (only when asked: xuong.rang = nhon)
          g.beginPath(); g.moveTo(-14, 18); for (let x = -14; x <= 14; x += 5) { g.lineTo(x + 2.5, 11.5); g.lineTo(x + 5, 18); } g.closePath(); g.fill(); }
        else { g.fillRect(-20, -8, 40, 12); g.strokeStyle = rgba(ln, .25); g.lineWidth = 1; for (const x of [-8, 0, 8]) { g.beginPath(); g.moveTo(x, -2); g.lineTo(x, 3); g.stroke(); } g.fillStyle = '#e06878'; g.beginPath(); g.ellipse(0, 14, 9, 4, 0, 0, 7); g.fill(); }   // normal teeth + tongue
        g.restore();
        g.strokeStyle = ln; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-17, -2); g.quadraticCurveTo(0, 1, 18, -5); g.quadraticCurveTo(12, 17, -2, 17); g.quadraticCurveTo(-14, 15, -17, -2); g.stroke(); }
      else if (NG && kind === 'ngam') L().nutMuc(g, Array.from({ length: 8 }, (_, i) => { const x = -9 + i * 2.6; return [x, 1 + x * .06 - x * x / 140]; }), 2.1, ln, .6);
      else if (kind === 'ngam' || kind === 'buon') L().nutMuc(g, Array.from({ length: 9 }, (_, i) => { const x = -13 + i * 3.25; return [x, (kind === 'buon' ? -1 : 1) * (4 - x * x / 50)]; }), 2.6, ln, .6);
      else { const [w, h] = { o: [7, 9], a: [11, 14], e: [14, 7], to: [16, 15], het: [17, 20] }[kind] || [9, 9];
        g.fillStyle = inside; g.beginPath(); if (kind === 'to' || kind === 'a') { g.moveTo(-w, 0); g.quadraticCurveTo(0, 3, w, 0); g.quadraticCurveTo(w * .6, h * 1.4, 0, h * 1.35); g.quadraticCurveTo(-w * .6, h * 1.4, -w, 0); } else g.ellipse(0, 3, w, h, 0, 0, 7); g.fill();
        g.fillStyle = '#f07a88'; g.beginPath(); g.ellipse(0, h * .9, w * .55, h * .35, 0, 0, 7); g.fill(); if (kind === 'e') { g.fillStyle = '#fff'; g.fillRect(-w * .8, -1, w * 1.6, 5); }
        g.strokeStyle = ln; g.lineWidth = 2.4; g.stroke(); }
      c.pad = 0; return c; };
    for (const k of ['ngam', 'buon', 'o', 'a', 'e', 'to', 'het', 'nhech', 'cuoi_rang']) put('mieng_' + k, mouth(k), { goc: [45 * hs, 26 * hs] });
    if (sp.kinh) { const c = cv(220 * hs, 90 * hs), g = c.getContext('2d'); g.scale(hs, hs); const col = sp.kinh.mau || '#e98a2a';
      for (const [x, r] of [[70, 34], [158, 28]]) { const gr = g.createLinearGradient(0, 45 - r, 0, 45 + r); gr.addColorStop(0, rgba(col, .7)); gr.addColorStop(1, rgba(mix(col, '#ffe0a0', .5), .45)); g.fillStyle = gr; g.beginPath(); g.ellipse(x, 45, r, r * .9, 0, 0, 7); g.fill();
        g.strokeStyle = '#3a2614'; g.lineWidth = 4; g.stroke(); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3; g.beginPath(); g.arc(x, 45, r * .7, PI * 1.1, PI * 1.45); g.stroke(); }
      g.strokeStyle = '#3a2614'; g.lineWidth = 4; g.beginPath(); g.moveTo(102, 40); g.quadraticCurveTo(114, 32, 128, 40); g.stroke(); g.beginPath(); g.moveTo(36, 40); g.lineTo(8, 34); g.stroke();
      c.pad = 0; put('kinh', c, { goc: [114 * hs, 45 * hs] }); }
    // ================= BODY — every size comes from the anatomy A (giaiphau.js); joints are landmarks shared by drawing and rig =================
    const ov = w => w * A.chong;                                                       // joint overlap past each joint
    const aoC = ao.mau || '#7cc6c0', inC = ao.mau_trong || '#fbfbf8', kAo = ao.kieu || 'khoac-mo', fold = mix(aoC, '#1a2a3a', .4);
    // torso landmarks (torso px): neck base y0, shoulder sockets (±A.khop_vai, yS), waist, hip line yH (= hip joints), hem
    const y0 = 20, yS = y0 + A.H * (NG ? .15 : .12), yH = y0 + A.than, thC = yH + A.H * (NG ? (A.nu ? .08 : A.bung > 1.12 ? .07 : .16) : .1);
    // BODY OUTLINE (adult): half width at anatomical landmarks — neck, trapezius slope, shoulder point, deltoid, armpit/chest, waist, (belly), hips —
    // joined by a monotone cubic (PCHIP: smooth, never overshoots, extremes stay at the landmarks). Every body shape only changes the landmark widths.
    const pchip = (X, Y) => { const n = X.length, d = [], m = new Array(n).fill(0); for (let i = 0; i < n - 1; i++) d.push((Y[i + 1] - Y[i]) / (X[i + 1] - X[i]));
      for (let i = 1; i < n - 1; i++) if (d[i - 1] * d[i] > 0) { const w1 = 2 * (X[i + 1] - X[i]) + (X[i] - X[i - 1]), w2 = (X[i + 1] - X[i]) + 2 * (X[i] - X[i - 1]); m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
      m[0] = d[0]; m[n - 1] = d[n - 2];
      return y => { if (y <= X[0]) return Y[0]; if (y >= X[n - 1]) return Y[n - 1]; let k = 0; while (y > X[k + 1]) k++; const h = X[k + 1] - X[k], t = (y - X[k]) / h, t2 = t * t, t3 = t2 * t;
        return (2 * t3 - 3 * t2 + 1) * Y[k] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * Y[k + 1] + (t3 - t2) * h * m[k + 1]; }; };
    // 3/4 view: the FRONT side of the outline (+x, where the face looks) and the BACK side (−x) are separate profiles — a belly or bust pushes
    // forward, the seat pushes back, the back stays flat. Mirrored automatically when the character turns.
    const prof = F => { if (!NG) return () => 0; const XS0 = A.khop_vai, dU0 = A.d.tay_tren, fat = Math.max(0, A.bung - 1), heavy = A.bung > 1.12;
      const chest0 = Math.max(heavy ? Math.max(A.nguc, A.bung_r * .8) : A.nguc, XS0 + dU0 * .1);                        // heavy: broad chest (no snowman shoulders)
      const chest = F ? Math.max(chest0 + (A.nu ? A.H * .03 : 0), heavy ? A.bung_r * (1 + fat * .12) * .78 : 0) : chest0 * (1 - fat * .12);   // heavy: chest flows into the belly (one oval), no balloon
      const waist = A.nu || A.the_thao ? A.eo : Math.max(A.eo * 1.04, chest0 * .87);
      const belly = F ? A.bung_r * (1 + fat * .12) : Math.max(waist, A.bung_r * (1 - fat * .26));   // belly forward, back side stays slim                         // belly forward, back flat
      const hips0 = A.nu ? A.mong : Math.max(A.mong * .96, waist), hips = hips0 * (F ? (A.nu ? .93 : .97) : (A.nu ? 1.07 : 1.02));   // seat on the back side
      const hem = heavy ? (F ? belly * .88 : Math.max(hips, belly * .98)) : A.nu ? hips * .98 : Math.max(hips, waist);
      const delt = Math.min(XS0 + dU0 * .28, Math.max(chest0, XS0) * (A.the_thao ? 1.07 : 1)) * (F ? .97 : 1);   // deltoid never wider than the chest (no shoulder peaks) unless athletic
      const K = [[y0 - 4, A.co_r * .95], [y0 + A.H * .05, XS0 * (.58 + Math.min(.14, fat * .14))], [y0 + A.H * .11, XS0 * .93 * (1 + Math.min(.06, fat * .06))], [yS + A.H * .05, delt], [yS + A.H * .2, chest]];   // neck → trapezius → shoulder → deltoid → armpit
      if (heavy) K.push([y0 + A.than * A.bung_y, Math.max(belly, chest * (F ? 1 : .9))]); else K.push([y0 + A.than * (A.nu ? .6 : .64), waist]);
      if (heavy && F) K.push([yH - A.H * .04, belly * .82], [thC, belly * .6]);                                              // belly underside wraps in toward the waistband
      else K.push([yH + (A.nu ? A.H * .03 : 0), heavy ? Math.max(hips, belly * .95) : hips], [thC, hem]);
      K.sort((a, b) => a[0] - b[0]); for (let i = 1; i < K.length; i++) if (K[i][0] <= K[i - 1][0]) K[i][0] = K[i - 1][0] + 1;
      return pchip(K.map(k => k[0]), K.map(k => k[1])); };
    const WyF = prof(true), WyB = prof(false), Wy = y => Math.max(WyF(y), WyB(y));
    const maxW = NG ? Math.max(...Array.from({ length: 64 }, (_, i) => Wy(y0 + (thC - y0) * i / 63))) : 0;
    const tw = NG ? 2 * maxW * 1.1 + 60 : 2 * Math.max(A.vai, A.hong) + 16, tc = tw / 2;
    const XS = A.khop_vai, OUT = NG ? Wy(yS + A.H * .1) : Math.max(A.vai, XS + A.d.tay_tren * .45), WAIST = NG ? Wy(y0 + A.than * .62) : A.eo, HIP = NG ? Wy(yH) : A.hong;
    const body = g => { g.beginPath(); g.moveTo(tc, y0 + 4);
      for (const sd of [-1, 1]) { const X = v => tc + sd * v; const pts = [[X(A.H * .13), y0 + 2], [X(OUT * .8), y0 + 4], [X(OUT), yS + A.d.tay_tren * .2], [X(OUT * .98), yS + A.H * .3], [X(WAIST), y0 + A.than * .6], [X(HIP), yH], [X(HIP * 1.02), thC]];
        if (sd < 0) { g.bezierCurveTo(pts[0][0], pts[0][1], pts[1][0], pts[1][1], pts[2][0], pts[2][1]); g.bezierCurveTo(pts[3][0], pts[3][1], pts[4][0], pts[4][1], pts[5][0], pts[5][1]); g.lineTo(pts[6][0], pts[6][1]); g.lineTo(tc, thC); }
        else { g.lineTo(pts[6][0], pts[6][1]); g.lineTo(pts[5][0], pts[5][1]); g.bezierCurveTo(pts[4][0], pts[4][1], pts[3][0], pts[3][1], pts[2][0], pts[2][1]); g.bezierCurveTo(pts[1][0], pts[1][1], pts[0][0], pts[0][1], tc, y0 + 4); } }
      g.closePath(); };
    // ---- adult outfits (anime-thanh-nien): sloped shoulders, loose untucked hem, tapered fold ink; ao.kieu so-mi | hoodie | blazer | thun ----
    const inkC = mix(aoC, '#1a1020', .62), fl = (g, pts, r = 1.6, col = inkC) => { const P2 = [];                                    // quadratic fold through 3 points
      for (let i = 0; i <= 10; i++) { const t = i / 10, [a1, b1, c1] = pts; P2.push([(1 - t) ** 2 * a1[0] + 2 * t * (1 - t) * b1[0] + t * t * c1[0], (1 - t) ** 2 * a1[1] + 2 * t * (1 - t) * b1[1] + t * t * c1[1]]); } L().nutMuc(g, P2, r, col, .5); };
    const hemY = thC - 12, bodyNG = (g, loose = 1.06, wave = 1) => { const N = 56, top = y0 + 1, ys = Array.from({ length: N + 1 }, (_, i) => top + (hemY - top) * i / N);
      const heavy = A.bung > 1.12, drape = loose > 1.065 && !A.nu && !A.the_thao && !heavy, iC = ys.findIndex(y => y > yS + A.H * .2);   // chest line
      const shape = (W, front) => { const sm = ys.map(y => W(y) * loose + 2);
        if (drape) for (let i = iC + 1; i <= N; i++) sm[i] = Math.max(sm[i], sm[i - 1] * .992);                                     // loose cut: hangs from the chest
        let iW = iC; for (let i = iC; i <= N && ys[i] < yH; i++) if (sm[i] < sm[iW]) iW = i;                                        // natural waist
        let iM = iW; for (let i = iW; i <= N; i++) if (sm[i] > sm[iM]) iM = i;                                                      // widest point below it
        for (let i = iM + 1; i <= N; i++) sm[i] = front && heavy ? sm[i] : Math.max(sm[i], sm[i - 1] * .996);                     // fabric falls from there (wraps a little under a belly)
        sm[N] *= .9; sm[N - 1] *= .955; sm[N - 2] *= .98; sm[N - 3] *= .993; return sm; };                                          // rounded hem corners
      const smF = shape(WyF, true), smB = shape(WyB, false);
      const curve = P => { for (let i = 1; i < P.length - 1; i++) g.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2); g.lineTo(...P[P.length - 1]); };   // smooth, not a polyline
      g.beginPath(); g.moveTo(tc - smB[0], ys[0]); curve(ys.map((y, i) => [tc - smB[i], y]));                                    // back side
      g.quadraticCurveTo(tc - smB[N] * .5, hemY + 9 * wave, tc, hemY + 3 * wave); g.quadraticCurveTo(tc + smF[N] * .5, hemY - 4 * wave, tc + smF[N], hemY);
      curve(ys.map((y, i) => [tc + smF[i], y]).reverse()); g.closePath(); };                                                     // front side
    const tcF = tc + OUT * .1;                                                       // 3/4 view: the centre-front line sits toward the front side
    const tieNG = (g, n) => { const tieC = sp.ca_vat || '#1e1c22'; g.fillStyle = tieC; g.beginPath(); g.moveTo(tcF - n * .32, y0 + A.H * .05); g.lineTo(tcF + n * .32, y0 + A.H * .05); g.lineTo(tcF + n * .2, y0 + A.H * .13); g.lineTo(tcF - n * .2, y0 + A.H * .13); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(tcF - n * .18, y0 + A.H * .12); g.quadraticCurveTo(tcF + n * .3, y0 + A.than * .4, tcF + n * .5, y0 + A.than * .7); g.lineTo(tcF + n * .08, y0 + A.than * .79); g.lineTo(tcF - n * .36, y0 + A.than * .68); g.quadraticCurveTo(tcF - n * .1, y0 + A.than * .4, tcF - n * .18, y0 + A.H * .12); g.fill();
      fl(g, [[tcF - n * .02, y0 + A.H * .15], [tcF + n * .1, y0 + A.than * .45], [tcF + n * .08, y0 + A.than * .74]], 1, mix(tieC, '#ffffff', .3)); };
    const collarNG = (g, n, col) => { g.fillStyle = col; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(tcF + sd * n * 1.25, y0 - 2); g.lineTo(tcF + sd * n * .15, y0 + A.H * .07); g.lineTo(tcF + sd * n * .45, y0 + A.H * .17); g.lineTo(tcF + sd * n * 1.75, y0 + A.H * .07); g.closePath(); g.fill();
      L().nutMuc(g, [[tcF + sd * n * 1.25, y0 - 2], [tcF + sd * n * .15, y0 + A.H * .07], [tcF + sd * n * .45, y0 + A.H * .17], [tcF + sd * n * 1.75, y0 + A.H * .07], [tcF + sd * n * 1.25, y0 - 2]], 1.3, inkC, .8); } };
    const torsoNG = g => { const tc = tcF, n = A.H * .1, k = kAo, hoodie = k === 'hoodie', blazer = k === 'blazer';
      if (hoodie) { g.fillStyle = mix(aoC, '#000000', .18); g.beginPath(); g.ellipse(tc - n * .3, y0 + A.H * .02, A.H * .2, A.H * .085, -.06, 0, 7); g.fill(); }        // hood folded behind the neck
      const LO = (hoodie ? 1.07 : blazer ? 1.06 : k === 'thun' ? 1.02 : 1.06) * (A.nu || A.the_thao ? .97 : 1); g.fillStyle = aoC; bodyNG(g, LO, hoodie ? .2 : 1); g.fill(); g.save(); bodyNG(g, LO, hoodie ? .2 : 1); g.clip();   // details stay inside the garment
      if (k === 'so-mi') { fl(g, [[tc + 3, y0 + A.H * .12], [tc + 1, y0 + A.than * .6], [tc + 4, hemY + 2]], 1.2);
        if (sp.ca_vat) tieNG(g, n); else { g.fillStyle = mix(da, skinSh, .3); g.beginPath(); g.moveTo(tc - n * .75, y0); g.lineTo(tc + n * .75, y0); g.lineTo(tc + 2, y0 + A.H * .16); g.closePath(); g.fill(); }
        if (!sp.ca_vat) for (let i = 0; i < 4; i++) { g.fillStyle = mix(aoC, '#7a7a80', .4); g.beginPath(); g.arc(tc + 5, y0 + A.H * .22 + i * A.than * .2, A.H * .011, 0, 7); g.fill(); }
        collarNG(g, n, mix(aoC, '#ffffff', .4));
        fl(g, [[tc - OUT * .64, yS + A.H * .1], [tc - OUT * .42, yS + A.H * .11], [tc - OUT * .2, yS + A.H * .1]], 1.1); }                                   // pocket top
      else if (hoodie) { g.fillStyle = mix(aoC, '#000000', .1); g.beginPath(); g.ellipse(tc, y0 + 4, A.H * .11, A.H * .05, 0, 0, PI); g.fill();
        g.strokeStyle = mix(aoC, '#ffffff', .55); g.lineWidth = 3; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(tc + sd * A.H * .045, y0 + A.H * .06); g.quadraticCurveTo(tc + sd * A.H * .05, y0 + A.H * .18, tc + sd * A.H * .035, y0 + A.H * .3); g.stroke();
          g.fillStyle = mix(aoC, '#ffffff', .7); g.fillRect(tc + sd * A.H * .035 - 3, y0 + A.H * .3, 6, 10); }
        const pt = hemY - A.H * .3; g.strokeStyle = inkC; g.lineWidth = 1.6; g.beginPath(); g.moveTo(tc - HIP * .55, pt); g.lineTo(tc + HIP * .55, pt); g.lineTo(tc + HIP * .78, hemY - A.H * .07); g.moveTo(tc - HIP * .55, pt); g.lineTo(tc - HIP * .78, hemY - A.H * .07); g.stroke();   // kangaroo pocket
        g.fillStyle = mix(aoC, '#000000', .12); g.fillRect(tc - HIP * 1.02, hemY - A.H * .06, HIP * 2.04, A.H * .06 + 6);                                           // ribbed hem
        g.strokeStyle = rgba(inkC, .5); g.lineWidth = 1; for (let x = -HIP; x < HIP; x += 7) { g.beginPath(); g.moveTo(tc + x, hemY - A.H * .055); g.lineTo(tc + x, hemY + 4); g.stroke(); } }
      else if (blazer) { const V = y0 + A.than * .5; g.fillStyle = inC; g.beginPath(); g.moveTo(tc - n * 1.1, y0); g.lineTo(tc + n * 1.1, y0); g.lineTo(tc + n * .1, V); g.closePath(); g.fill();
        if (sp.ca_vat) { g.save(); g.beginPath(); g.moveTo(tc - n * 1.1, y0); g.lineTo(tc + n * 1.1, y0); g.lineTo(tc + n * .1, V); g.closePath(); g.clip(); tieNG(g, n); g.restore(); }
        collarNG(g, n * .8, mix(inC, '#ffffff', .3));
        g.fillStyle = mix(aoC, '#ffffff', .1); for (const sd of [-1, 1]) { const pts = [[tc + sd * n * 1.15, y0], [tc + sd * n * 1.9, y0 + A.H * .1], [tc + sd * n * 1.55, y0 + A.H * .15], [tc + sd * n * 1.7, y0 + A.H * .2], [tc + n * .1, V + 4]];
          g.beginPath(); pts.forEach(([X, Y], i) => i ? g.lineTo(X, Y) : g.moveTo(X, Y)); g.closePath(); g.fill(); L().nutMuc(g, [...pts, pts[0]], 1.3, inkC, .8); }               // lapels with notch
        fl(g, [[tc + n * .1, V + 4], [tc + n * .3, (V + hemY) / 2], [tc + n * .15, hemY + 4]], 1.4);
        g.fillStyle = mix(aoC, '#000000', .45); for (const yy of [V + A.H * .06, V + A.H * .2]) { g.beginPath(); g.arc(tc + n * .5, yy, A.H * .014, 0, 7); g.fill(); }
        fl(g, [[tc - HIP * .85, hemY - A.H * .2], [tc - HIP * .55, hemY - A.H * .19], [tc - HIP * .25, hemY - A.H * .2]], 1.2); fl(g, [[tc + OUT * .3, yS + A.H * .1], [tc + OUT * .5, yS + A.H * .09], [tc + OUT * .7, yS + A.H * .1]], 1.1); }
      else { g.fillStyle = mix(da, skinSh, .3); g.beginPath(); g.ellipse(tc, y0 + 2, A.H * .1, A.H * .05, 0, 0, PI); g.fill();                                       // t-shirt: crew neck + print
        L().nutMuc(g, Array.from({ length: 9 }, (_, i) => { const a1 = PI * i / 8; return [tc - Math.cos(a1) * A.H * .11, y0 + 2 + Math.sin(a1) * A.H * .06]; }), 1.6, inkC, .7);
        if (ao.hinh !== false) { g.fillStyle = ao.hinh || mix(aoC, '#000000', .55); g.font = `900 ${A.H * .12}px sans-serif`; g.textAlign = 'center'; g.fillText(ao.chu || '★', tc + 4, y0 + A.than * .5); } }
      if (A.nu) for (const sd of [-1, 1]) fl(g, [[tc + sd * OUT * .62, yS + A.H * .2], [tc + sd * OUT * .32, yS + A.H * .28], [tc + sd * OUT * .06, yS + A.H * .21]], 1.3);
      else if (A.the_thao) for (const sd of [-1, 1]) fl(g, [[tc + sd * OUT * .7, yS + A.H * .16], [tc + sd * OUT * .38, yS + A.H * .25], [tc + sd * OUT * .06, yS + A.H * .2]], 1.2);
      if (A.bung > 1.2) { const yB = y0 + A.than * A.bung_y, bx = tc + WAIST * .45;                                       // stress lines from the armpits toward the belly's front, + underside hint
        fl(g, [[tc - OUT * .7, yS + A.H * .24], [tc - WAIST * .1, yB - A.H * .12], [bx - WAIST * .1, yB - A.H * .02]], 1.2); fl(g, [[tc + OUT * .55, yS + A.H * .2], [tc + WAIST * .55, yB - A.H * .14], [bx + WAIST * .1, yB - A.H * .05]], 1);
        fl(g, [[tc - WAIST * .2, thC - A.H * .1], [bx - WAIST * .05, thC - A.H * .06], [tc + WAIST * .85, thC - A.H * .16]], 1.1); }
      // folds shared by every cut: armpit pulls, waist bunching, hem creases
      for (const sd of [-1, 1]) { fl(g, [[tc + sd * OUT * .86, yS + A.H * .14], [tc + sd * OUT * .62, yS + A.H * .26], [tc + sd * WAIST * .5, y0 + A.than * .55]], 1.6);
        fl(g, [[tc + sd * OUT * .8, yS + A.H * .26], [tc + sd * OUT * .66, yS + A.H * .32], [tc + sd * WAIST * .62, y0 + A.than * .64]], 1.1); }
      if (!hoodie) { fl(g, [[tc - HIP * .72, hemY - A.H * .13], [tc - HIP * .62, hemY - A.H * .06], [tc - HIP * .58, hemY + 3]], 1.3); fl(g, [[tc + HIP * .34, hemY - A.H * .1], [tc + HIP * .4, hemY - A.H * .04], [tc + HIP * .46, hemY - 2]], 1.2); }
      else fl(g, [[tc - HIP * .7, hemY - A.H * .14], [tc - HIP * .3, hemY - A.H * .1], [tc - HIP * .1, hemY - A.H * .15]], 1.2); g.restore(); };
    const torso = g => { if (NG) return torsoNG(g); g.fillStyle = aoC; body(g); g.fill();
      if (kAo === 'khoac-mo') { g.save(); body(g); g.clip(); const n = A.H * .09; g.fillStyle = inC; g.beginPath(); g.moveTo(tc - n, y0); g.lineTo(tc + n, y0); g.lineTo(tc + n * 1.5, yS + A.than * .4); g.lineTo(tc + n * 1.35, thC); g.lineTo(tc - n * 1.35, thC); g.lineTo(tc - n * 1.5, yS + A.than * .4); g.closePath(); g.fill();
        if (!A.nu) { g.fillStyle = '#e8584a'; g.beginPath(); g.arc(tc + 2, y0 + A.than * .42, A.H * .045, 0, 7); g.fill(); } g.restore();
        g.fillStyle = mix(aoC, '#ffffff', .12); g.strokeStyle = fold; g.lineWidth = 2.6; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(tc + s * n, y0 + 2); g.lineTo(tc + s * n * 2.4, y0 + A.than * .2); g.lineTo(tc + s * n * 1.6, y0 + A.than * .28); g.lineTo(tc + s * n * 1.5, y0 + A.than * .5); g.closePath(); g.fill(); g.stroke(); } }
      else if (kAo === 'so-mi') { const n = A.H * .1, tie = sp.ca_vat, tieC = tie || '#1e1c22';                                       // collared shirt (+ tie)
        g.strokeStyle = fold; g.lineWidth = 2; g.beginPath(); g.moveTo(tc + 3, y0 + A.H * .1); g.lineTo(tc + 2, thC - 4); g.stroke();
        if (!tie) { g.fillStyle = mix(da, skinSh, .3); g.beginPath(); g.moveTo(tc - n * .7, y0); g.lineTo(tc + n * .7, y0); g.lineTo(tc, y0 + A.H * .13); g.closePath(); g.fill(); }
        else { g.fillStyle = tieC; g.beginPath(); g.moveTo(tc - n * .32, y0 + A.H * .05); g.lineTo(tc + n * .32, y0 + A.H * .05); g.lineTo(tc + n * .2, y0 + A.H * .13); g.lineTo(tc - n * .2, y0 + A.H * .13); g.closePath(); g.fill();
          g.beginPath(); g.moveTo(tc - n * .18, y0 + A.H * .12); g.lineTo(tc + n * .2, y0 + A.H * .12); g.lineTo(tc + n * .48, y0 + A.than * .72); g.lineTo(tc + n * .05, y0 + A.than * .8); g.lineTo(tc - n * .4, y0 + A.than * .7); g.closePath(); g.fill();
          g.strokeStyle = mix(tieC, '#ffffff', .25); g.lineWidth = 1.4; g.beginPath(); g.moveTo(tc - n * .05, y0 + A.H * .14); g.lineTo(tc + n * .02, y0 + A.than * .76); g.stroke(); }
        g.fillStyle = mix(aoC, '#ffffff', .3); g.strokeStyle = fold; g.lineWidth = 2.2;
        for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(tc + sd * n * 1.25, y0 - 2); g.lineTo(tc + sd * n * .2, y0 + A.H * .07); g.lineTo(tc + sd * n * .5, y0 + A.H * .16); g.lineTo(tc + sd * n * 1.7, y0 + A.H * .07); g.closePath(); g.fill(); g.stroke(); }
        g.beginPath(); g.moveTo(tc - OUT * .62, yS + A.H * .1); g.lineTo(tc - OUT * .2, yS + A.H * .1); g.lineTo(tc - OUT * .22, yS + A.H * .24); g.lineTo(tc - OUT * .6, yS + A.H * .24); g.stroke();      // pocket
        g.lineWidth = 1.6; for (const [a1, b1, c1, d1] of [[-.85, .45, -.55, .7], [.7, .55, .45, .85], [-.4, .88, -.1, .96]]) { g.beginPath(); g.moveTo(tc + a1 * OUT, y0 + b1 * A.than); g.quadraticCurveTo(tc + (a1 + c1) / 2 * OUT + 6, y0 + (b1 + d1) / 2 * A.than, tc + c1 * OUT, y0 + d1 * A.than); g.stroke(); } }
      else if (kAo === 'ba-ba') { g.strokeStyle = fold; g.lineWidth = 2.6; g.beginPath(); g.moveTo(tc - A.H * .07, y0 + 2); g.quadraticCurveTo(tc, y0 + A.H * .07, tc + A.H * .07, y0 + 2); g.stroke(); g.beginPath(); g.moveTo(tc + 6, y0 + A.H * .06); g.lineTo(tc + 3, thC - 4); g.stroke();
        g.fillStyle = mix(aoC, '#ffffff', .55); for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(tc + 12, y0 + A.H * .14 + i * A.than * .22, A.H * .014, 0, 7); g.fill(); }
        g.strokeStyle = rgba(mix(aoC, '#ffffff', .4), .7); g.lineWidth = 1.6; for (let i = 0; i < 9; i++) { const x = tc - OUT * .7 + (i % 3) * OUT * .7, y = y0 + A.than * .2 + Math.floor(i / 3) * A.than * .28; g.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * 2 * PI; g.ellipse(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 4, 2.2, a, 0, 7); } g.stroke(); } }
      else { g.strokeStyle = fold; g.lineWidth = 2.6; g.fillStyle = mix(da, skinSh, .3); g.beginPath(); g.ellipse(tc, y0 + 2, A.H * .1, A.H * .045, 0, 0, PI); g.fill(); g.stroke();
        g.fillStyle = sp.ao.hinh || mix(aoC, '#ffffff', .65); g.beginPath(); g.arc(tc + 4, y0 + A.than * .42, A.H * .08, 0, 7); g.fill(); }
      g.strokeStyle = fold; g.lineWidth = 2.2; g.beginPath(); g.moveTo(tc - WAIST * .8, y0 + A.than * .6); g.quadraticCurveTo(tc - WAIST * .6, y0 + A.than * .7, tc - WAIST * .75, y0 + A.than * .82); g.moveTo(tc + OUT * .8, yS + A.H * .2); g.quadraticCurveTo(tc + OUT * .65, yS + A.H * .28, tc + OUT * .82, yS + A.H * .36); g.stroke();
      if (sp.day_chuyen) { g.strokeStyle = mix(sp.day_chuyen, '#5a3a08', .5); g.fillStyle = sp.day_chuyen; g.lineWidth = 1.6; for (let i = 0; i <= 10; i++) { const a = PI * (.1 + .8 * i / 10), x = tc - Math.cos(a) * A.H * .1, y = y0 + 6 + Math.sin(a) * A.H * .14; g.beginPath(); g.ellipse(x, y, 5, 3.6, a + (i % 2) * 1.3, 0, 7); g.fill(); g.stroke(); } } };
    put('than', styledT(tw, thC, torso, style(aoC, { co: 26 }), second(aoC)), { goc: [tc, yH], ngon: [tc, y0], ...(NG ? { kieu: 'day', truc_x: tc, hang: [y0, yH - A.than * .36, yH] } : {}) },
      g => { for (const sd of [-1, 1]) g.ellipse(tc + sd * XS, yS, A.d.tay_tren * .95, A.d.tay_tren * 1.05, 0, 0, 7); g.ellipse(tc, y0, (A.co_r || A.H * .1) * 1.4, A.H * .07, 0, 0, 7); });   // shoulders + neck
    // organic limb outline: smooth closed curve through a half-width profile [[y, halfWidth], …] (muscle bulges instead of straight tubes)
    const limb = (g, cx, pts) => { const P = [...pts.map(([y, w]) => [cx - w, y]), ...pts.slice().reverse().map(([y, w]) => [cx + w, y])], n = P.length;
      g.beginPath(); g.moveTo((P[n - 1][0] + P[0][0]) / 2, (P[n - 1][1] + P[0][1]) / 2);
      for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; g.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); } g.closePath(); };
    // ================= WAIST / CROTCH (over the leg tops, under the jacket hem) =================
    const vay = quan.kieu === 'vay', qcol = quan.mau || '#5a4436', qw = 2 * HIP * (vay ? 1.6 : 1) + 8, qc = qw / 2, qTop = A.H * .14, qh = qTop + (vay ? A.dui * .62 : Math.max(ov(A.d.dui) + A.H * .1, A.H * .22, NG ? A.H * .2 : 0));
    if (vay) put('quan', styledT(qw, qh, g => { const hb = HIP * 1.32, pl = 9; g.fillStyle = qcol; g.beginPath(); g.moveTo(qc - HIP * .96, 0); g.lineTo(qc + HIP * .96, 0); g.lineTo(qc + hb, qh - 8);
        for (let i = pl; i >= 0; i--) { const x0 = qc - hb + 2 * hb * i / pl; g.lineTo(x0, qh - 8 + (i % 2 ? 6 : 0)); } g.closePath(); g.fill();
        g.strokeStyle = mix(qcol, '#000000', .4); g.lineWidth = 1.6; for (let i = 1; i < pl; i++) { const t = i / pl; g.beginPath(); g.moveTo(qc - HIP * .9 + 1.8 * HIP * t, A.H * .05); g.lineTo(qc - hb + 2 * hb * t, qh - 6); g.stroke(); }
        g.fillStyle = mix(qcol, '#000000', .2); g.fillRect(qc - HIP * .96, 0, HIP * 1.92, A.H * .05); }, style(qcol, { co: 18 }), second(qcol)), { goc: [qc, qTop], ngon: [qc, qTop - 200] }, g => g.rect(-60, -60, qw + 120, 60 + A.H * .03));
    else
    if (NG && !vay) put('quan', styledT(qw, qh, g => { const HT = A.nu ? HIP * .98 : Math.min(HIP * .98, (A.khop_hong + A.d.dui * .5) * 1.12), TH = Math.max(A.khop_hong + A.d.dui * .52, A.nu ? HT * .86 : 0), cy = qTop + A.H * .15;   // pelvis = hips → thighs → crotch
        const W0 = Math.min(HT, Wy(yH - qTop) * .96); g.fillStyle = qcol; g.beginPath(); g.moveTo(qc - W0, 0); g.lineTo(qc + W0, 0); g.bezierCurveTo(qc + W0, qTop * .45, qc + HT, qTop * .7, qc + HT, qTop); g.bezierCurveTo(qc + HT, qTop + A.H * .04, qc + TH, qTop + A.H * .04, qc + TH * .96, qTop + A.H * .06);   // waist → hips → thigh
        g.bezierCurveTo(qc + TH * .8, cy, qc + A.H * .05, cy + A.H * .02, qc, cy); g.bezierCurveTo(qc - A.H * .05, cy + A.H * .02, qc - TH * .8, cy, qc - TH * .96, qTop + A.H * .06);
        g.bezierCurveTo(qc - TH, qTop + A.H * .04, qc - HT, qTop + A.H * .04, qc - HT, qTop); g.bezierCurveTo(qc - HT, qTop * .7, qc - W0, qTop * .45, qc - W0, 0); g.closePath(); g.fill();
        L().nutMuc(g, [[qc + 3, A.H * .06], [qc + 2, qTop], [qc, cy - A.H * .03]], 1.1, mix(qcol, '#000000', .5), .5); }, style(qcol, { co: 18 }), second(qcol)), { goc: [qc, qTop], ngon: [qc, qTop - 200] }, g => g.rect(-60, -60, qw + 120, qh + 120));   // fly seam; no own outline (the union silhouette draws it)
    else put('quan', styledT(qw, qh, g => { const HB = NG ? Math.min(HIP * .9, A.khop_hong + A.d.dui * .56) / .9 : HIP; g.fillStyle = qcol; g.beginPath(); g.moveTo(qc - HIP * .96, 0); g.lineTo(qc + HIP * .96, 0); g.bezierCurveTo(qc + HIP * 1.04, qTop, qc + HB, qh * .8, qc + HB * .9, qh - 4);
      g.lineTo(qc + 6, qh - A.H * .07); g.lineTo(qc - 6, qh - A.H * .07); g.lineTo(qc - HB * .9, qh - 4); g.bezierCurveTo(qc - HB, qh * .8, qc - HIP * 1.04, qTop, qc - HIP * .96, 0); g.fill();
      g.strokeStyle = mix(qcol, '#000000', .4); g.lineWidth = 2.4; g.beginPath(); g.moveTo(qc - HIP * .9, 10); g.lineTo(qc + HIP * .9, 10); g.moveTo(qc, 12); g.lineTo(qc, qh - A.H * .09); g.stroke(); }, style(qcol, { co: 18 }), second(qcol)), { goc: [qc, qTop], ngon: [qc, qTop - 200] }, g => g.rect(-60, -60, qw + 120, 60 + qh * .62));
    // ================= LEGS — one strip; widths at hip / knee / ankle shared with the joints =================
    const short = (quan.kieu || 'short') === 'short', dT = A.d.dui, dK = A.d.goi, dA = A.d.co_chan, lw = Math.max(dT, dK) + 14, ax = lw / 2;
    const r0 = ov(dT) + 4, r1 = r0 + A.dui, r2 = r1 + A.cang, lh = r2 + ov(dA) + A.mat_ca * .6;
    put('chan', styledT(lw, lh, g => { g.fillStyle = da;
        if (NG) { const bc = A.bap_chan || 1, sk = [[r0 - dT * .22, dT * .36], [r0, dT * .5], [r0 + A.dui * .32, dT * .48], [r1 - A.dui * .14, dK * .52], [r1, dK * .5], [r1 + A.cang * .26, dK * .56 * bc], [r1 + A.cang * .55, dK * .45 * bc], [r2 - A.cang * .12, dA * .55], [r2, dA * .5], [lh - 1, dA * .5]];
          g.fillStyle = da; limb(g, ax, sk); g.fill();
          if (vay) { g.fillStyle = quan.tat || '#2a2a30'; limb(g, ax, [[r2 - A.cang * .3, dA * .58], [r2, dA * .54], [lh, dA * .54]]); g.fill(); return; }
          const bottom = short ? r0 + A.dui * .72 : lh - 6, hb = short ? dT * .58 : dA * .82, cap = [[r0 - dT * .3, dT * .2], [r0 - dT * .18, dT * .42]], pts = short ? [...cap, [r0, dT * .55 + 5], [r0 + A.dui * .4, dT * .56 + 3], [bottom, hb]]
            : [...cap, [r0, dT * .5 + 6], [r0 + A.dui * .35, dT * .49 + 4], [r1 - A.dui * .1, dK * .55 + 4], [r1, dK * .55 + 4], [r1 + A.cang * .3, dK * .58 + 4], [bottom - A.H * .12, hb * .96], [bottom - 4, hb], [bottom, hb]];
          g.fillStyle = qcol; limb(g, ax, pts); g.fill();
          if (!short) { const pc = mix(qcol, '#000000', .5), f3 = (a1, b1, c1, r) => { const P2 = []; for (let i = 0; i <= 8; i++) { const t = i / 8; P2.push([(1 - t) ** 2 * a1[0] + 2 * t * (1 - t) * b1[0] + t * t * c1[0], (1 - t) ** 2 * a1[1] + 2 * t * (1 - t) * b1[1] + t * t * c1[1]]); } L().nutMuc(g, P2, r, pc, .5); };
            f3([ax - dK * .42, r1 - A.H * .07], [ax - dK * .08, r1 - A.H * .015], [ax + dK * .22, r1 - A.H * .06], 1.3); f3([ax - dK * .28, r1 + A.H * .05], [ax, r1 + A.H * .085], [ax + dK * .36, r1 + A.H * .045], 1);
            f3([ax - hb * .85, bottom - A.H * .15], [ax - hb * .15, bottom - A.H * .09], [ax + hb * .5, bottom - A.H * .14], 1.2); f3([ax - hb * .55, bottom - A.H * .065], [ax + hb * .1, bottom - A.H * .02], [ax + hb * .75, bottom - A.H * .075], 1);
            f3([ax - dT * .28, A.H * .1], [ax - dT * .1, A.H * .2], [ax - dT * .22, A.H * .32], 1); }
          return; }
        g.beginPath(); g.moveTo(ax - dK * .5, r1); g.bezierCurveTo(ax - dK * .56, r1 + A.cang * .35, ax - dA * .55, r2 - A.cang * .2, ax - dA * .5, r2); g.lineTo(ax - dA * .5, lh - 2); g.lineTo(ax + dA * .5, lh - 2); g.lineTo(ax + dA * .5, r2);
        g.bezierCurveTo(ax + dA * .55, r2 - A.cang * .2, ax + dK * .56, r1 + A.cang * .35, ax + dK * .5, r1); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(ax - dT * .5, r0); g.lineTo(ax + dT * .5, r0); g.lineTo(ax + dK * .5, r1); g.lineTo(ax - dK * .5, r1); g.closePath(); g.fill(); g.beginPath(); g.ellipse(ax, r1, dK * .55, dK * .45, 0, 0, 7); g.fill(); if (NG) { g.beginPath(); g.ellipse(ax - dK * .04, r1 + A.cang * .3, dK * .52 * (A.bap_chan || 1), A.cang * .26, 0, 0, 7); g.fill(); }   // thigh + knee cap (+ calf)
        if (vay) { g.fillStyle = quan.tat || '#2a2a30'; g.fillRect(ax - dA * .56, r2 - A.cang * .3, dA * 1.12, lh - r2 + A.cang * .3); return; }   // skirt: bare legs, socks
        const bottom = short ? r0 + A.dui * .72 : lh - 6; g.fillStyle = qcol; g.beginPath(); g.moveTo(ax - dT * .5 - 4, 0); g.lineTo(ax + dT * .5 + 4, 0);
        const hb = short ? dT * .55 : dA * (NG ? .82 : .62); g.lineTo(ax + hb, bottom); g.lineTo(ax - hb, bottom); g.closePath(); g.fill();
        if (NG && !short) { const pc = mix(qcol, '#000000', .5), f3 = (a1, b1, c1, r) => { const P2 = []; for (let i = 0; i <= 8; i++) { const t = i / 8; P2.push([(1 - t) ** 2 * a1[0] + 2 * t * (1 - t) * b1[0] + t * t * c1[0], (1 - t) ** 2 * a1[1] + 2 * t * (1 - t) * b1[1] + t * t * c1[1]]); } L().nutMuc(g, P2, r, pc, .5); };
          f3([ax - dK * .45, r1 - A.H * .08], [ax - dK * .1, r1 - A.H * .02], [ax + dK * .2, r1 - A.H * .07], 1.4); f3([ax - dK * .3, r1 + A.H * .05], [ax, r1 + A.H * .09], [ax + dK * .4, r1 + A.H * .04], 1.1);   // knee
          f3([ax - hb * .9, bottom - A.H * .16], [ax - hb * .2, bottom - A.H * .1], [ax + hb * .5, bottom - A.H * .15], 1.3); f3([ax - hb * .6, bottom - A.H * .07], [ax + hb * .1, bottom - A.H * .02], [ax + hb * .8, bottom - A.H * .08], 1.1);   // ankle break
          f3([ax - dT * .3, A.H * .1], [ax - dT * .1, A.H * .2], [ax - dT * .25, A.H * .32], 1.1); }
        g.strokeStyle = mix(qcol, '#000000', .4); g.lineWidth = 2.2; g.beginPath(); g.moveTo(ax + dT * .1, r0); g.quadraticCurveTo(ax + 2, bottom * .5, ax + dT * .14, bottom - 6); g.stroke();
        if (short) { g.fillStyle = '#f6f6f2'; g.fillRect(ax - dA * .5, r2 - 6, dA, lh - r2); } }, style(qcol, { co: 18 }), second(qcol)), { goc: [ax, r0], kieu: 'day', truc_x: ax, hang: [r0, r1, r2] }, g => g.rect(-60, -60, lw + 120, 60 + r0 + dT * .3));
    // ================= SHOES (ankle pivot over the strip's ankle) =================
    const gc = giay.mau || '#f4f4f4', dep = giay.kieu === 'dep', FL = A.ban_chan, sh2 = A.mat_ca + 12;   // shoe height = ankle height of the rig
    put('giay', styled(FL + 10, sh2 + 12, g => { const hx = FL * .22;
      if (dep) { g.fillStyle = mix(gc, '#000', .2); g.beginPath(); g.roundRect(2, sh2 - 6, FL, 12, 6); g.fill(); g.fillStyle = da; g.beginPath(); g.ellipse(FL * .45, sh2 - 14, FL * .42, sh2 * .32, 0, 0, 7); g.fill(); g.strokeStyle = gc; g.lineWidth = 7; g.beginPath(); g.moveTo(FL * .36, sh2 * .4); g.lineTo(FL * .6, sh2 - 4); g.stroke(); return; }
      g.fillStyle = gc; g.beginPath(); g.moveTo(hx - dA * .5, 8); g.bezierCurveTo(hx - dA * .5, -2, hx + dA * .6, -2, hx + dA * .6, 10); g.bezierCurveTo(FL * .7, 14, FL, sh2 * .5, FL, sh2 - 6); g.lineTo(FL, sh2); g.lineTo(2, sh2); g.closePath(); g.fill();
      g.fillStyle = giay.de || '#e8584a'; g.fillRect(0, sh2 - 6, FL + 2, 10); g.strokeStyle = giay.day || '#3a6ab0'; g.lineWidth = 4; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(hx + dA * .4 + i * 10, 14 + i * 4); g.lineTo(hx + dA * .4 + 16 + i * 10, 20 + i * 4); g.stroke(); } },
      style(gc, { co: 12, net: .9 })), { goc: [FL * .22, 10], ngon: [FL, 10] });
    // ================= ARMS — strip from the shoulder socket; sleeve cap covers the socket, cuff covers the forearm =================
    const dU = A.d.tay_tren, dE = A.d.khuyu, dW = A.d.co_tay, HL = A.ban_tay, longS = kAo === 'ba-ba' || (kAo === 'so-mi' && !ao.xan) || kAo === 'hoodie' || kAo === 'blazer', aw = Math.max(dU, HL * .8) + 22, ac = aw / 2;
    const q0 = Math.max(ov(dU), dU * .5 + 3) + 4, q1 = q0 + A.tay_tren, q2 = q1 + A.tay_duoi, ah = q2 + HL + 6;
    const arm = thumbLeft => styledT(aw, ah, g => { const sd = thumbLeft ? -1 : 1;
      if (NG) { const bt = A.the_thao ? 1.08 : 1, sk = [[q0 - dU * .02, dU * .24], [q0 + dU * .12, dU * .42], [q0 + dU * .3, dU * .48], [q0 + A.tay_tren * .38, dU * .48 * bt], [q1 - A.tay_tren * .12, dE * .5], [q1, dE * .48],
          [q1 + A.tay_duoi * .22, dE * .55 * bt], [q1 + A.tay_duoi * .62, dW * .62], [q2, dW * .5], [q2 + 8, dW * .48]];
        g.fillStyle = da; limb(g, ac, sk); g.fill();
        const end = longS ? q2 - (kAo === 'blazer' ? 16 : 4) : ao.xan ? q1 + 18 : q1 + 6, ease = kAo === 'hoodie' ? 1.22 : 1.14, slv = sk.filter(([y]) => y < end - 2).map(([y, w]) => [y, w * ease + 3]);
        const wEnd = longS ? dW * .5 + 7 : dE * .5 + 7; slv.push([end - 6, wEnd + 1], [end, wEnd]);
        if (kAo === 'blazer') { g.fillStyle = inC; g.beginPath(); g.roundRect(ac - dW * .5 - 4, q2 - 22, dW + 8, 20, 4); g.fill(); }                          // shirt cuff peeking out of the blazer
        g.fillStyle = aoC; limb(g, ac, slv); g.fill();
        const ic = mix(aoC, '#1a1020', .62), z = (a1, b1, c1, r) => { const P2 = []; for (let i = 0; i <= 8; i++) { const t = i / 8; P2.push([(1 - t) ** 2 * a1[0] + 2 * t * (1 - t) * b1[0] + t * t * c1[0], (1 - t) ** 2 * a1[1] + 2 * t * (1 - t) * b1[1] + t * t * c1[1]]); } L().nutMuc(g, P2, r, ic, .5); };
        if (longS) { z([ac - dE * .5, q1 - 16], [ac, q1 - 4], [ac + dE * .4, q1 - 14], 1.2); z([ac - dE * .3, q1 + 4], [ac + 2, q1 + 13], [ac + dE * .5, q1 + 2], 1); z([ac + dE * .45, q1 + 22], [ac, q1 + 29], [ac - dE * .3, q1 + 23], .9);
          z([ac - wEnd, end - 26], [ac - 2, end - 20], [ac + wEnd * .6, end - 30], .9); }
        z([ac - dU * .2, q0 + A.H * .06], [ac + 3, q0 + A.H * .14], [ac - 2, q0 + A.H * .22], 1.1);
        const cuff = kAo === 'hoodie' ? mix(aoC, '#000000', .12) : mix(aoC, '#ffffff', .15);
        if (longS) { const cb = kAo === 'hoodie' ? 16 : 14; g.save(); limb(g, ac, slv); g.clip(); g.fillStyle = cuff; g.fillRect(ac - 200, end - cb, 400, cb + 20); g.restore(); L().nutMuc(g, [[ac - wEnd + 2, end - cb], [ac + wEnd - 2, end - cb]], .9, ic, .6); }   // cuff = bottom band of the sleeve
        else if (ao.xan) { g.fillStyle = cuff; g.beginPath(); g.roundRect(ac - wEnd - 2, end - 22, (wEnd + 2) * 2, 24, 9); g.fill(); z([ac - wEnd, end - 11], [ac, end - 8], [ac + wEnd, end - 12], 1); }
        return; }
      g.fillStyle = da; g.beginPath(); g.moveTo(ac - dE * .5, q1 - 6); g.lineTo(ac + dE * .5, q1 - 6); g.lineTo(ac + dW * .5, q2 + 2); g.lineTo(ac - dW * .5, q2 + 2); g.closePath(); g.fill();
      if (NG) { }                                                                   // adult hands: separate posable pieces (ban_tay_*), see HANDS
      else { const hw = Math.max(dW * 1.15, HL * .5); g.beginPath(); g.moveTo(ac - dW * .55, q2 - 2); g.bezierCurveTo(ac - hw * .62, q2 + HL * .55, ac - hw * .36, q2 + HL * .95, ac + 2, q2 + HL); g.bezierCurveTo(ac + hw * .4, q2 + HL * .95, ac + hw * .62, q2 + HL * .5, ac + dW * .55, q2 - 2); g.closePath(); g.fill();
      g.beginPath(); g.ellipse(ac + sd * hw * .52, q2 + HL * .3, hw * .2, HL * .28, -sd * .45, 0, 7); g.fill();
      g.strokeStyle = lineOf(da); g.lineWidth = 1.8; for (const dx of [-.2, .05, .3]) { g.beginPath(); g.moveTo(ac - sd * dx * hw, q2 + HL * .62); g.lineTo(ac - sd * dx * hw, q2 + HL * .9); g.stroke(); } }
      if (NG && kAo === 'blazer') { g.fillStyle = inC; g.beginPath(); g.roundRect(ac - dW * .5 - 4, q2 - 22, dW + 8, 20, 4); g.fill(); }                       // shirt cuff peeking out of the blazer
      g.fillStyle = aoC; const end = longS ? q2 - (NG && kAo === 'blazer' ? 16 : 4) : NG && ao.xan ? q1 + 18 : q1 + 6, wT = dU * (NG ? .38 : kAo === 'so-mi' ? .44 : .5) + 3, wB = longS ? dW * .5 + (NG ? 7 : 3) : dE * .5 + 7; g.beginPath(); g.moveTo(ac - wT, q0); if (NG) g.ellipse(ac, q0, wT, wT * .62, 0, PI, 0); else g.arc(ac, q0, wT, PI, 0);   // adult: flat cap hides under the deltoid   // round sleeve cap centred on the shoulder joint
      g.bezierCurveTo(ac + wT + 2, q0 + (end - q0) * .4, ac + wB + 2, end * .75, ac + wB, end); g.lineTo(ac - wB, end); g.bezierCurveTo(ac - wB - 2, end * .75, ac - wT - 2, q0 + (end - q0) * .4, ac - wT, q0); g.closePath(); g.fill();
      g.strokeStyle = fold; g.lineWidth = 2.2; g.beginPath(); g.moveTo(ac - 6, end * .38); g.quadraticCurveTo(ac + 8, end * .48, ac + 2, end * .62); g.stroke();
      if (NG) { const ic = mix(aoC, '#1a1020', .62), z = (a1, b1, c1, r) => { const P2 = []; for (let i = 0; i <= 8; i++) { const t = i / 8; P2.push([(1 - t) ** 2 * a1[0] + 2 * t * (1 - t) * b1[0] + t * t * c1[0], (1 - t) ** 2 * a1[1] + 2 * t * (1 - t) * b1[1] + t * t * c1[1]]); } L().nutMuc(g, P2, r, ic, .5); };
        if (longS) { z([ac - dE * .5, q1 - 16], [ac, q1 - 4], [ac + dE * .4, q1 - 14], 1.3); z([ac - dE * .3, q1 + 4], [ac + 2, q1 + 14], [ac + dE * .5, q1 + 2], 1.1); z([ac + dE * .45, q1 + 22], [ac, q1 + 30], [ac - dE * .3, q1 + 24], 1);   // elbow folds
          z([ac - wB, end - 26], [ac - 2, end - 20], [ac + wB * .6, end - 30], 1); }
        z([ac - wT * .4, q0 + A.H * .06], [ac + 3, q0 + A.H * .14], [ac - 2, q0 + A.H * .22], 1.2);
        const cuff = kAo === 'hoodie' ? mix(aoC, '#000000', .12) : mix(aoC, '#ffffff', .15);
        if (longS) { g.fillStyle = cuff; g.beginPath(); g.roundRect(ac - wB, end - (kAo === 'hoodie' ? 16 : 14), wB * 2, kAo === 'hoodie' ? 18 : 16, 5); g.fill(); L().nutMuc(g, [[ac - wB, end - 14], [ac + wB, end - 14]], 1, ic, .6); }
        else if (ao.xan) { g.fillStyle = cuff; g.beginPath(); g.roundRect(ac - wB - 2, end - 22, (wB + 2) * 2, 24, 8); g.fill(); z([ac - wB, end - 11], [ac, end - 8], [ac + wB, end - 12], 1.1); } }
      else if ((!longS && kAo === 'khoac-mo') || kAo === 'so-mi') { g.fillStyle = mix(aoC, '#ffffff', .1); g.beginPath(); g.roundRect(ac - wB - 3, end - 20, (wB + 3) * 2, 24, 10); g.fill(); g.stroke(); } }, style(aoC, { co: 16 }), second(aoC));
    // ================= HANDS (adult): style x pose pieces pinned at the wrist, pointing along the forearm =================
    //   tay_kieu: that (5 fingers, knuckle lines) | hoat-hinh (3 fat fingers + thumb) | gang (mitten) · pose: tha (relaxed) | xoe (spread) | nam (fist) | chi (point)
    //   the pose comes from clip channels g? (fist), k? (point), o? (open) — nhanvat.js picks the piece per frame
    if (NG) { const HK = A.khoi.tay_kieu || sp.tay_kieu || 'that', cart = HK === 'hoat-hinh', mit = HK === 'gang', ln = lineOf(da);
      const hand = (pose, thumbLeft) => { const sd = thumbLeft ? -1 : 1, pw = dW * 1.34 * (cart ? 1.15 : 1), fw = pw * (cart ? .3 : .24), wy = 8, py = wy + HL * .44, hw2 = pw * 1.3 + 16, W = hw2 * 2, Hh = wy + HL * 1.12 + 12, cx = W / 2;
        const Ls = cart ? [.44, .5, .44] : [.46, .52, .48, .38], nF = Ls.length, xs = Ls.map((_, k) => cx + sd * ((nF - 1) / 2 - k) / (nF - 1) * pw * .74);
        return styledT(W, Hh, g => { g.fillStyle = da; g.strokeStyle = da; g.lineCap = 'round';
          g.beginPath(); g.moveTo(cx - dW * .52, wy - 6); g.bezierCurveTo(cx - pw * .52, wy + HL * .12, cx - pw * .53, py - HL * .1, cx - pw * .46, py + 2); g.lineTo(cx + pw * .46, py + 2);
          g.bezierCurveTo(cx + pw * .53, py - HL * .1, cx + pw * .52, wy + HL * .12, cx + dW * .52, wy - 6); g.closePath(); g.fill();                                   // palm
          const ink = (pts, r = 1.1) => L().nutMuc(g, pts, r, ln, .5), thumb = (a0, len) => { g.lineWidth = fw * 1.15; const bx = cx + sd * pw * .42, by = wy + HL * .14;
            g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx + sd * Math.sin(a0) * len * .6, by + Math.cos(a0) * len * .5, bx + sd * Math.sin(a0 * .6) * len, by + Math.cos(a0 * .6) * len); g.stroke(); };
          if (pose === 'nam' || pose === 'chi') {                                                                     // fist: rounded block, knuckle bumps, thumb across
            g.beginPath(); g.roundRect(cx - pw * .52, py - HL * .08, pw * 1.04, HL * .34, pw * .2); g.fill();
            for (let k = 0; k < 4; k++) { const x0 = cx - pw * .39 + k * pw * .26; g.beginPath(); g.arc(x0, py + HL * .24, pw * .14, 0, PI); g.fill(); if (k) ink([[x0 - pw * .13, py + HL * .1], [x0 - pw * .13, py + HL * .3]], .9); }
            ink([[cx - pw * .45, py + HL * .06], [cx, py + HL * .09], [cx + pw * .45, py + HL * .06]], 1);
            if (pose === 'chi') { g.lineWidth = fw; const x0 = xs[0]; g.beginPath(); g.moveTo(x0, py); g.lineTo(x0 + (cx - x0) * .1, py + HL * .62); g.stroke(); ink([[x0 - sd * fw * .5, py + HL * .1], [x0 - sd * fw * .5, py + HL * .35]], .9); }
            g.lineWidth = fw * 1.1; g.beginPath(); g.moveTo(cx + sd * pw * .48, wy + HL * .16); g.quadraticCurveTo(cx + sd * pw * .5, py + HL * .1, cx - sd * pw * .05, py + HL * .08); g.stroke();
            ink([[cx + sd * pw * .4, py - HL * .02], [cx + sd * pw * .1, py + HL * .1], [cx - sd * pw * .04, py + HL * .09]], 1); }
          else if (mit) { g.beginPath(); g.roundRect(cx - pw * .5, py - 4, pw, HL * (pose === 'xoe' ? .5 : .46), [4, 4, pw * .5, pw * .5]); g.fill(); thumb(pose === 'xoe' ? 1.1 : .5, HL * .42); ink([[cx + sd * pw * .3, wy + HL * .2], [cx + sd * pw * .38, wy + HL * .44]]); }
          else { const spread = pose === 'xoe' ? 1 : 0;
            Ls.forEach((L0, k) => { const x0 = xs[k], a = spread * sd * (((nF - 1) / 2 - k) / (nF - 1)) * .7, len = L0 * HL * (spread ? 1.04 : 1); g.lineWidth = fw;
              const tx = spread ? x0 + Math.sin(a) * len : cx + (x0 - cx) * .82, ty = py + Math.cos(a) * len - fw * .5;
              g.beginPath(); g.moveTo(x0, py - fw * .3); g.quadraticCurveTo((x0 + tx) / 2 + (spread ? 0 : (cx - x0) * .08), (py + ty) / 2, tx, ty); g.stroke();
              if (!cart) ink([[x0 + (tx - x0) * .45 - fw * .3, py + (ty - py) * .45], [x0 + (tx - x0) * .45 + fw * .3, py + (ty - py) * .45]], .7); });          // finger joint creases
            if (!spread) for (let k = 0; k < nF - 1; k++) { const mx = (xs[k] + xs[k + 1]) / 2, L1 = Math.min(Ls[k], Ls[k + 1]) * HL; ink([[mx, py + L1 * .1], [cx + (mx - cx) * .9, py + L1 * .5], [cx + (mx - cx) * .84, py + L1 * .78]]); }
            thumb(spread ? 1.15 : .45, HL * .44); ink([[cx + sd * pw * .28, wy + HL * .22], [cx + sd * pw * .36, wy + HL * .42], [cx + sd * pw * .34, wy + HL * .52]]);
            if (spread && !cart) ink([[cx - pw * .3, py - HL * .04], [cx, py - HL * .12], [cx + pw * .25, py - HL * .02]], .9); }          // palm crease
          g.lineCap = 'butt'; }, style(da, { co: 10, net: .9 })); };
      for (const pose of ['tha', 'xoe', 'nam', 'chi']) for (const [nm, tl] of [['L', true], ['R', false]]) { const c = hand(pose, tl); put('ban_tay_' + pose + '_' + nm, c, { goc: [c.width / 2 - c.pad, 8], ngon: [c.width / 2 - c.pad, 100] }, g => g.rect(-60, -60, 600, 68 + dW * .4)); } }
    const armCut = g => g.rect(-60, -60, aw + 120, 60 + q0 + dU * .35);
    put('tay_L', arm(true), { goc: [ac, q0], kieu: 'day', truc_x: ac, hang: [q0, q1, q2] }, armCut);
    put('tay_R', arm(false), { goc: [ac, q0], kieu: 'day', truc_x: ac, hang: [q0, q1, q2] }, armCut);
    // ================= RIG = the same landmarks =================
    let tayMo = 0; if (NG) for (let yy = yS + A.tay_tren * .45; yy < yS + A.tay_tren + A.tay_duoi * .8; yy += 6) { const need = WyB(yy) * 1.02 - A.d.tay_tren * .3 - XS; if (need > 0) tayMo = Math.max(tayMo, Math.atan2(need, yy - yS)); }   // arms clear the BACK-side bulk (the belly is in front: the far arm simply hangs behind it)
    const rig = { tayMo: Math.min(.35, tayMo), gu: A.gu || 0, T: A.dui * K, S: A.cang * K, ank: A.mat_ca * K, foot: A.ban_chan * .78 * K, heel: A.ban_chan * .22 * K, hipW: A.khop_hong * K,
      sp: [A.than * .36 * K, A.than * .34 * K, A.than * .3 * K], neck: A.co * .3 * K, headUp: 138 * hs * K, headR: 125 * hs * K, shW: XS * K, shDrop: (yS - y0) * K,
      up: A.tay_tren * K, fore: A.tay_duoi * K, hand: HL * .7 * K };
    if (photo) for (const k of Object.keys(P)) if (/^(mat_|mieng_|kinh)/.test(k)) { delete P[k]; delete IMG[k]; }   // the photo keeps its own eyes, mouth (no drawn glasses)
    const mirror = S0 => { const o = {}; for (const [k, im] of Object.entries(S0)) { const c = cv(im.width, im.height), g = c.getContext('2d'); g.translate(im.width, 0); g.scale(-1, 1); g.drawImage(im, 0, 0); o[k] = c; } return o; };
    const flip = mirror(IMG), rfF = mirror(RF), rmF = mirror(RM);
    return { ten: sp.ten || 'anime', giaiphau: A, ti_le_anh: K, rong_ngang: 1, rig, manh: P, img: IMG, flip, kinh_lat: false, ...(Object.keys(RF).length ? { rf: RF, rfF, rm: RM, rmF } : {}),
      mat: { goc: [pad + 196 * hs, pad + (NG ? 178 : 190) * hs], mieng: [pad + (NG ? 210 : 210) * hs, pad + (NG ? 256 : 256) * hs], co_mat: 1, co_mieng: NG ? 1.05 : 1, co_kinh: 1, nen_x: .92 },
      bieu_cam: { binh: 'mat_binh', so: 'mat_so', hoang: 'mat_ngac', ngac: 'mat_ngac', quyet: 'mat_quyet', gian: 'mat_gian', buon: 'mat_buon', met: 'mat_met', nghi: 'mat_nghi', cuoi: 'mat_cuoi', vui: 'mat_cuoi', nham: 'mat_nham', tu_tin: 'mat_tu_tin', chan: 'mat_met' },
      mieng: { ngam: 'mieng_ngam', o: 'mieng_o', a: 'mieng_a', e: 'mieng_e', to: 'mieng_to', het: 'mieng_het' },
      mieng_bieu_cam: { hoang: 'mieng_het', ngac: 'mieng_o', vui: 'mieng_to', cuoi: 'mieng_ngam', so: 'mieng_o', buon: 'mieng_buon', met: 'mieng_buon', gian: 'mieng_buon', ...(NG ? { vui: 'mieng_cuoi_rang', cuoi: 'mieng_nhech', tu_tin: 'mieng_nhech', quyet: 'mieng_ngam', met: 'mieng_ngam' } : {}) } };
  }
  MS.xuong = MS.xuong || {}; MS.xuong.styles = MS.xuong.styles || {}; for (const k of Object.keys(STYLES)) MS.xuong.styles[k] = build; MS.xuong.STYLES_ANIME = STYLES;
})();
