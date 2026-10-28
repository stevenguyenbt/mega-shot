// mega-shot · truyen.js — story films (template `truyen`, references/story/README.md): code-drawn flat 2D SETS with parallax
// layers and living scenery (wind in trees / grass, layered rain + splashes, flowing water, flickering windows, lightning that
// lights the scene), a CAMERA with shot framings incl. dialogue coverage, skeletal characters (nhanvat.js + nhanvat_clip.js),
// and story graphics (rule cards, counters, tactical map, end card). A scene = one spoken line; `shots:` cuts 1–4 shots inside it.
//
// shot: { set, at (0–1 of the line, default even split), khung: toan|trung|can|vat|qua-vai|phan-ung|doi, nhin: <character id to frame>,
//         cam: day|lui|lia|lia-trai|rung|tinh|theo, nv: [ … ], nuoc (0–1), mua, chop (lightning), duc, mau: dem|ngay|hoi-tuong|xam|binh-minh,
//         gio (wind 0–2), gat, tui: [...], ban_do: { … }, nut, nuoc_truoc, muoi (n mosquitoes flying), muoi_to (their size) }
// nv:   { ai, x (0–1 of set width), y (px, + = lower/closer), s, huong: 1|-1, goc: ngang|3-4|thang|lung|lung-3-4,
//         tu_the (legacy pose = first clip), bieu_cam, di: x2 (walk to), y2, di_tu / di_den (0–1 of the shot), toc: cham|vua|nhanh|chay|<px/s>,
//         kieu_di: di|di-cham|chay|chay-hoang|leo, hanh_dong: [{ t (s) | u (0–1), clip, mix, tu, xong, huong, goc, bieu_cam, nhin, toi }],
//         ve: { … } (per-shot look override, e.g. { vet: false }), nhin: <id>|camera, toi: <id> | { ai, bo_phan: tay|vai|dau|lung, tay: gan|xa|ca-hai }, noi: true (lip-sync), toi_mau (silhouette 0–1), den, ghe }
// bong: [{ ai, chu (| = new line), u (pop-in 0–1 of the shot), toi: true (dark inner-critic bubble), co (font px) }] = thought bubble over a head; scene-level `bong: "text"` = over the speaker
// scene: nghi_tham: true = the line is a THOUGHT (speaker's lips stay shut, listeners don't nod) · the_luat: { so, chu, phu, nhan (badge label, default "LUẬT LŨ") } · hud: { nhan, so, tu, don_vi } · ket: { tap_sau, chu, hoi (comment question, | = new line), nut (button text, false = none) } — give the last scene `them: 3` so the card holds
(() => {
  const { clamp, lerp, eio, eo3, rgen, mix } = MS.u;
  const WW = 1600, G = 1480;                                                     // set width (world units) and ground line
  const spring = (t, d = 13, k = 210) => { if (t <= 0) return 0; const w0 = Math.sqrt(k), z = d / (2 * w0), wd = w0 * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + z * w0 / wd * Math.sin(wd * t)); };
  const rr = (x, a, b, w, h, r, f) => { x.fillStyle = f; x.beginPath(); x.roundRect(a, b, w, h, r); x.fill(); };
  const poly = (x, pts, f) => { x.fillStyle = f; x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.fill(); };
  const txt = (x, s, a, b, size, col, al = 'center', w = 700, fam = 'OSW', maxW = 0) => { x.font = `${w} ${size}px ${fam}, ${MS.STYLE.font}`; if (maxW) { const m = x.measureText(s).width; if (m > maxW) { size = Math.floor(size * maxW / m); x.font = `${w} ${size}px ${fam}, ${MS.STYLE.font}`; } } x.textAlign = al; x.textBaseline = 'middle'; x.fillStyle = col; x.fillText(s, a, b); };

  // ---------------- living scenery ----------------
  const wind = (o, t, seed) => (o.gio ?? 1) * (Math.sin(t * 1.3 + seed) * .6 + Math.sin(t * 2.9 + seed * 1.7) * .3 + Math.max(0, Math.sin(t * .45 + seed * .3)) ** 6 * 1.4);
  function sky(x, top, bot, h = 1920) { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, top); g.addColorStop(1, bot); x.fillStyle = g; x.fillRect(-1200, -1200, WW + 2400, h + 2400); }
  function clouds(x, t, col, y0 = 300) { const R = rgen(21); x.fillStyle = col; for (let k = 0; k < 7; k++) { const cx = ((R() * (WW + 1600) + t * (14 + R() * 18)) % (WW + 1600)) - 800, cy = y0 + R() * 420, s = .7 + R() * .9;
    x.beginPath(); for (const [dx, dy, r] of [[0, 0, 120], [110, 20, 95], [-110, 25, 90], [50, -50, 85]]) x.ellipse(cx + dx * s, cy + dy * s, r * s * 1.4, r * s * .7, 0, 0, 7); x.fill(); } }
  function hills(x, y, amp, col, seed) { const R = rgen(seed); x.fillStyle = col; x.beginPath(); x.moveTo(-1200, 3400); for (let i = -1200; i <= WW + 1200; i += 80) x.lineTo(i, y - amp * (.5 + .5 * Math.sin(i * .004 + seed) + .3 * R())); x.lineTo(WW + 1200, 3400); x.fill(); }
  function tree(x, a, b, s, col, t, o, seed = a) {                                // canopy sways with the wind (pivot at the trunk top)
    const sw = wind(o, t, seed * .013) * .035; rr(x, a - 8 * s, b - 120 * s, 16 * s, 124 * s, 4, mix(col, '#000000', .45));
    x.save(); x.translate(a, b - 110 * s); x.rotate(sw); x.fillStyle = col;
    x.beginPath(); x.ellipse(0, -65 * s, 70 * s, 95 * s, 0, 0, 7); x.ellipse(-38 * s, -30 * s, 46 * s, 50 * s, 0, 0, 7); x.ellipse(40 * s, -38 * s, 44 * s, 52 * s, 0, 0, 7); x.fill();
    x.fillStyle = mix(col, '#ffffff', .07); x.beginPath(); x.ellipse(-18 * s, -95 * s, 34 * s, 40 * s, 0, 0, 7); x.fill(); x.restore(); }
  function grass(x, y, t, o, col, x0 = -600, x1 = WW + 600, step = 34, h = 34) {   // tufts along a ground line, swaying
    x.strokeStyle = col; x.lineWidth = 5; x.lineCap = 'round'; const R = rgen(5);
    for (let i = x0; i < x1; i += step * (.6 + R())) { const w = wind(o, t, i * .01) * .22, hh = h * (.6 + R() * .8);
      for (const d of [-7, 0, 7]) { x.beginPath(); x.moveTo(i + d, y); x.quadraticCurveTo(i + d + w * hh * .4, y - hh * .6, i + d * 1.6 + w * hh, y - hh); x.stroke(); } } }
  function water(x, y0, y1, t, muddy, flow = 1) {                               // moving water: gradient, wave crest, current streaks, foam
    const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, mix('#2f4f63', '#6b5536', muddy)); g.addColorStop(1, mix('#1a2c3a', '#3e2f1e', muddy));
    x.fillStyle = g; x.beginPath(); x.moveTo(-1200, y1 + 1400); for (let i = -1200; i <= WW + 1200; i += 40) x.lineTo(i, y0 + Math.sin(i * .012 - t * 2.2 * flow) * 6 + Math.sin(i * .031 + t * 3.1) * 3); x.lineTo(WW + 1200, y1 + 1400); x.fill();
    x.strokeStyle = mix('#8fb3c7', '#c8ab7a', muddy); x.globalAlpha = .6; x.lineWidth = 5; x.beginPath(); for (let i = -1200; i <= WW + 1200; i += 40) { const yy = y0 + Math.sin(i * .012 - t * 2.2 * flow) * 6 + Math.sin(i * .031 + t * 3.1) * 3; i > -1200 ? x.lineTo(i, yy) : x.moveTo(i, yy); } x.stroke();
    x.lineWidth = 4; x.lineCap = 'round'; x.globalAlpha = .5;
    const R = rgen(7); for (let k = 0; k < 46; k++) { const yy = y0 + 14 + R() * Math.max(20, (y1 - y0) * .9), L = 60 + R() * 140, xx = ((R() * (WW + 1600) + t * (240 + 260 * R()) * flow) % (WW + 1600)) - 800;
      x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + L, yy + Math.sin(t * 3 + k) * 3); x.stroke(); }
    x.globalAlpha = 1;
  }
  function house(x, a, b, s, lit, t) {
    rr(x, a - 260 * s, b - 330 * s, 520 * s, 330 * s, 6, '#6e5844'); rr(x, a - 260 * s, b - 330 * s, 260 * s, 330 * s, 6, '#7c6650');
    poly(x, [[a - 310 * s, b - 320 * s], [a, b - 520 * s], [a + 310 * s, b - 320 * s]], '#4b5257');
    const fl = lit ? .8 + .2 * Math.sin(t * 13) * Math.sin(t * 5.3) : 0;            // oil-lamp flicker
    rr(x, a + 70 * s, b - 250 * s, 120 * s, 100 * s, 6, lit ? mix('#c99a45', '#f4d27a', fl) : '#2c3238'); rr(x, a - 170 * s, b - 200 * s, 90 * s, 200 * s, 4, '#3d2e22');
    if (lit) { const g = x.createRadialGradient(a + 130 * s, b - 200 * s, 10, a + 130 * s, b - 200 * s, 280 * s); g.addColorStop(0, `rgba(255,214,120,${.3 * fl + .05})`); g.addColorStop(1, 'rgba(255,214,120,0)'); x.fillStyle = g; x.fillRect(a - 200 * s, b - 480 * s, 680 * s, 560 * s); }
  }
  function palm(x, a, b, s, t, o, seed) {                                       // coconut palm: curved trunk, swaying fronds, coconuts
    const sw = wind(o, t, seed * 2.3) * .06, top = [a + 120 * s, b - 560 * s]; x.strokeStyle = '#8a6a44'; x.lineWidth = 34 * s; x.lineCap = 'round'; x.beginPath(); x.moveTo(a, b); x.quadraticCurveTo(a + 10 * s, b - 300 * s, top[0], top[1]); x.stroke();
    x.strokeStyle = 'rgba(90,60,30,.35)'; x.lineWidth = 4 * s; for (let k = 1; k < 10; k++) { const q = k / 10, px = lerp(a, top[0], q * q), py = lerp(b, top[1], q); x.beginPath(); x.moveTo(px - 16 * s, py); x.lineTo(px + 16 * s, py - 6 * s); x.stroke(); }
    x.save(); x.translate(...top); x.rotate(sw); for (let k = 0; k < 7; k++) { const ang = -Math.PI + k * Math.PI / 6 + Math.sin(t * 1.2 + k) * .05, L = 300 * s; x.strokeStyle = '#3f7a35'; x.lineWidth = 12 * s; x.beginPath(); x.moveTo(0, 0);
      const ex = Math.cos(ang) * L, ey = Math.sin(ang) * L * .5 + 80 * s; x.quadraticCurveTo(Math.cos(ang) * L * .5, Math.sin(ang) * L * .5 - 60 * s, ex, ey); x.stroke();
      x.strokeStyle = '#4f9a42'; x.lineWidth = 5 * s; for (let q = 2; q < 9; q++) { const u = q / 10, px = lerp(0, ex, u), py = lerp(0, ey, u) - Math.sin(u * Math.PI) * 50 * s; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 26 * s, py + 40 * s); x.moveTo(px, py); x.lineTo(px - 26 * s, py + 40 * s); x.stroke(); } }
    x.fillStyle = '#6a4a2a'; for (const [cx, cy] of [[-20, 24], [18, 30], [0, 44]]) { x.beginPath(); x.arc(cx * s, cy * s, 20 * s, 0, 7); x.fill(); } x.restore(); }
  function muoiVe(x, s, t, k, cai = true) {                                     // one mosquito facing right at (0,0), ~60·s wide: striped abdomen, long legs, buzzing wings, proboscis (female) / bushy antennae (male)
    const fl = Math.abs(Math.sin(t * 55 + k * 1.7)); x.lineCap = 'round';
    x.fillStyle = 'rgba(225,235,245,.55)'; x.beginPath(); x.ellipse(-8 * s, -14 * s - fl * 4 * s, 26 * s, 7 * s, -.25 - fl * .5, 0, 7); x.fill(); x.beginPath(); x.ellipse(-4 * s, -12 * s - fl * 2 * s, 22 * s, 6 * s, -.1 - fl * .3, 0, 7); x.fill();
    x.strokeStyle = '#2a2420'; x.lineWidth = 1.6 * s; for (const [hx, d1, d2] of [[-2, -20, -10], [4, 2, 18], [8, 22, 34]]) { x.beginPath(); x.moveTo(hx * s, 4 * s); x.lineTo((hx + d1 * .5) * s, 16 * s); x.lineTo((hx + d1) * s, 30 * s); x.lineTo((hx + d2) * s, 38 * s); x.stroke(); }
    x.save(); x.rotate(.22); for (let j = 0; j < 6; j++) { x.fillStyle = j % 2 ? '#f2efe6' : '#2a2420'; x.beginPath(); x.ellipse((-14 - j * 7) * s, 0, 5 * s, (6 - j * .5) * s, 0, 0, 7); x.fill(); } x.restore();
    x.fillStyle = '#3a2e26'; x.beginPath(); x.ellipse(0, 0, 11 * s, 9 * s, 0, 0, 7); x.fill(); x.fillStyle = '#f2efe6'; x.fillRect(-4 * s, -6 * s, 8 * s, 2 * s);
    x.fillStyle = '#2a2420'; x.beginPath(); x.arc(13 * s, 1 * s, 6 * s, 0, 7); x.fill(); x.fillStyle = '#6a8fc0'; x.beginPath(); x.arc(15 * s, -1 * s, 2.4 * s, 0, 7); x.fill();
    x.strokeStyle = '#2a2420'; x.lineWidth = 1.8 * s; x.beginPath(); x.moveTo(18 * s, 3 * s); x.lineTo((cai ? 42 : 32) * s, (cai ? 14 : 10) * s); x.stroke();
    x.lineWidth = 1.2 * s; for (const d of [-1, 1]) { x.beginPath(); x.moveTo(16 * s, -3 * s); x.lineTo(30 * s, (-10 + d * 3) * s); x.stroke(); if (!cai) for (let q = 1; q < 6; q++) { const px = (16 + q * 2.6) * s, py = (-3 - q * 1.4 + d * q * .6) * s; x.beginPath(); x.moveTo(px - 4 * s, py - 5 * s); x.lineTo(px + 4 * s, py + 5 * s); x.stroke(); } }
  }
  function muoiBay(x, t, n, s = 1) {                                            // shot.muoi: n mosquitoes zig-zagging in the world (s = size)
    for (let k = 0; k < n; k++) { const ph = k * 2.3, bx = WW * (.12 + .76 * ((k * .37) % 1)) + Math.sin(t * 1.6 + ph) * 140 + Math.sin(t * 4.3 + ph) * 26, by = 560 + ((k * .53) % 1) * 700 + Math.sin(t * 2.4 + ph * 1.7) * 90;
      x.save(); x.translate(bx, by); x.scale(Math.cos(t * 1.6 + ph) >= 0 ? s : -s, s); muoiVe(x, 1.1, t, k, true); x.restore(); } }
  const haze = (x, col, a) => { x.fillStyle = MS.u.rgba(col, a); x.fillRect(-2000, -2000, WW + 4000, 6000); };
  const flash = (t, o) => o.chop ? Math.max(0, 1 - ((t * 1.7) % 2.3) / .09) + Math.max(0, 1 - Math.abs(((t * 1.7) % 2.3) - .2) / .05) * .7 : 0;   // double flash

  // ---------------- sets (world units: x 0..WW, ground at G; o.L(p, fn) = parallax layer, p 0 far … 1 ground plane) ----------------
  const SETS = {
    'nha-dem'(x, t, o) { const L = o.L, f = flash(t, o);
      L(.05, () => { sky(x, mix('#0b1220', '#3a4a66', f * .6), '#1c2a3a'); clouds(x, t, mix('#141e2c', '#4a5a78', f * .5)); });
      L(.25, () => { hills(x, 900, 260, '#121c26', 3); haze(x, '#1c2a3a', .25); });
      L(.5, () => { hills(x, 1100, 180, '#18242e', 8); for (let i = 0; i < 6; i++) tree(x, 120 + i * 300 + (i % 2) * 80, 1260, 1.3, '#1d3226', t, o); });
      L(1, () => { rr(x, -1200, 1240, WW + 2400, 1400, 0, '#22301f'); house(x, 560, G - 40, 1.05, o.den !== false, t); grass(x, 1250, t, o, '#2c4128', -600, 1100, 60, 28);
        water(x, 1560 - (o.nuoc || 0) * 320, 2400, t, o.duc ?? .2, 1.4); }); },
    'trong-nha'(x, t, o) { rr(x, -1200, -1200, WW + 2400, 5200, 0, '#2a211b'); for (let i = -800; i < WW + 800; i += 120) rr(x, i, -800, 116, 3600, 0, i % 240 ? '#2f251e' : '#2c231c');
      const f = flash(t, o); rr(x, 980, 520, 380, 420, 8, mix('#101822', '#c9d6ea', clamp(f)));
      if (o.mua !== false) { x.save(); x.beginPath(); x.rect(980, 520, 380, 420); x.clip(); x.strokeStyle = 'rgba(160,185,210,.35)'; x.lineWidth = 2; const R = rgen(3);
        for (let k = 0; k < 40; k++) { const rx = 980 + (R() * 380 + t * 40) % 380, ry = 520 + (R() * 420 + t * 900) % 420; x.beginPath(); x.moveTo(rx, ry); x.lineTo(rx - 6, ry + 30); x.stroke(); } x.restore(); }
      x.strokeStyle = '#4a3a2c'; x.lineWidth = 18; x.strokeRect(980, 520, 380, 420); x.beginPath(); x.moveTo(1170, 520); x.lineTo(1170, 940); x.stroke();
      if (f > 0) { x.fillStyle = `rgba(200,215,240,${.18 * clamp(f)})`; x.beginPath(); x.moveTo(980, 940); x.lineTo(1360, 940); x.lineTo(1200, G); x.lineTo(640, G); x.fill(); }
      rr(x, 110, 1180, 620, 30, 6, '#4d3a2b'); rr(x, 120, 1150, 120, 34, 14, '#cfc6b4'); rr(x, 130, 1210, 24, 270, 4, '#3b2c20'); rr(x, 686, 1210, 24, 270, 4, '#3b2c20');   // bed + pillow
      const fl = .85 + .15 * Math.sin(t * 11) * Math.sin(t * 4.3); rr(x, 840, 1130, 26, 50, 6, '#3a2a1c'); x.fillStyle = mix('#c98a3a', '#ffd27a', fl); x.beginPath(); x.ellipse(853, 1112, 8, 16, Math.sin(t * 6) * .1, 0, 7); x.fill();   // oil lamp
      const g = x.createRadialGradient(853, 1112, 5, 853, 1112, 420); g.addColorStop(0, `rgba(255,200,120,${.22 * fl})`); g.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = g; x.fillRect(430, 690, 850, 850);
      rr(x, -1200, G, WW + 2400, 1400, 0, '#1f1813'); if (o.nuoc) water(x, G - o.nuoc * 260, 2600, t, .65, .5); },
    'cau-dao'(x, t, o) { rr(x, -1200, -1200, WW + 2400, 5200, 0, '#2b2620'); rr(x, 420, 520, 760, 980, 30, '#a9adb0'); rr(x, 460, 560, 680, 900, 22, '#c9cdd0');
      txt(x, 'CẦU DAO TỔNG', 800, 640, 64, '#3a3f44'); const u = eo3(clamp(((o.u || 0) - (o.gat ?? .4)) / .18));
      rr(x, 700, 760, 200, 520, 30, '#2f3338'); const ly = lerp(820, 1110, u); rr(x, 720, ly, 160, 150, 24, u > .5 ? '#d23b3b' : '#4caf50');
      txt(x, 'ON', 800, 800, 44, '#9aa0a6'); txt(x, 'OFF', 800, 1340, 44, u > .5 ? '#d23b3b' : '#9aa0a6');
      if (u > 0 && u < 1) { x.strokeStyle = '#ffe680'; x.lineWidth = 6; for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(800, ly); x.lineTo(800 + Math.cos(k) * 120, ly + Math.sin(k * 2) * 90); x.stroke(); } } },
    'tui'(x, t, o) { rr(x, -1200, -1200, WW + 2400, 5200, 0, '#5a4636'); for (let i = -800; i < 3200; i += 160) rr(x, -1200, i, WW + 2400, 6, 0, '#4f3d2f');
      const items = o.tui || ['ĐÈN PIN', 'NƯỚC', 'ÁO PHAO', 'GIẤY TỜ', 'CÒI', 'SẠC'];
      items.forEach((s, i) => { const c0 = i % 2, r0 = Math.floor(i / 2), p = spring((o.u || 0) * (o.D || 3) - .25 - i * .32), cx = 520 + c0 * 560, cy = 640 + r0 * 360;
        if (p <= 0) return; x.save(); x.translate(cx, cy); x.scale(p, p); rr(x, -200, -130, 400, 260, 26, '#efe9dc');
        const ic = { 'ĐÈN PIN': '🔦', 'NƯỚC': '💧', 'ÁO PHAO': '🦺', 'GIẤY TỜ': '📄', 'CÒI': '📯', 'SẠC': '🔋', 'THUỐC': '💊' }[s] || '•';
        txt(x, ic, 0, -30, 96, '#222', 'center', 400, 'sans-serif'); txt(x, s, 0, 80, 46, '#2b2b2b'); x.restore(); }); },
    'suoi'(x, t, o) { const L = o.L, d = o.duc ?? 1;
      L(.05, () => { sky(x, '#0c141c', '#16222c'); clouds(x, t, '#121c26', 200); });
      L(.4, () => { rr(x, -1200, 700, WW + 2400, 2400, 0, '#1b2620'); for (let i = 0; i < 6; i++) tree(x, 60 + i * 330, 820, 1.2, '#16271d', t, o); haze(x, '#16222c', .2); });
      L(1, () => { water(x, 980, 2400, t, d, 2.2 + d * 1.5);
        if (d > .5) for (let k = 0; k < 3; k++) { const xx = ((t * 380 + k * 600) % (WW + 1200)) - 600, yy = 1180 + k * 160 + Math.sin(t * 2 + k) * 10; x.save(); x.translate(xx, yy); x.rotate(.15 * Math.sin(t * 1.4 + k)); rr(x, -140, -16, 280, 32, 14, '#4a3524'); rr(x, 60, -50, 14, 40, 6, '#4a3524'); x.restore(); }
        if (o.am) for (let k = 0; k < 4; k++) { x.strokeStyle = `rgba(220,200,160,${.35 - k * .07})`; x.lineWidth = 5; x.beginPath(); x.arc(240, 700, 120 + k * 70 + (t * 90) % 70, -0.6, .6); x.stroke(); } }); },
    'duong'(x, t, o) { const L = o.L;
      L(.05, () => { sky(x, '#0c141c', '#1a2632'); clouds(x, t, '#141e28', 250); });
      L(.3, () => { hills(x, 1000, 200, '#141e26', 5); for (let i = 0; i < 5; i++) tree(x, 100 + i * 380, 1150, .9, '#17251c', t, o); haze(x, '#1a2632', .25); });
      L(1, () => { rr(x, -1200, 1180, WW + 2400, 1600, 0, '#2a2f2a'); rr(x, -1200, 1300, WW + 2400, 180, 0, '#3b3d3c'); grass(x, 1300, t, o, '#33402f', -600, WW + 600, 70, 26);
        const lv = o.nuoc ?? .4; water(x, 1480 - lv * 300, 2400, t, .8, 2);
        if (o.khung !== 'can' && o.khung !== 'qua-vai' && o.khung !== 'phan-ung') { x.save(); x.translate(1080, 1480); rr(x, -12, -520, 24, 560, 6, '#d8d4c8');                    // depth pole: 15 / 30 / 60 cm marks
          [[15, '#ffc93c'], [30, '#f08a24'], [60, '#e5383b']].forEach(([cm, col]) => { const yy = -cm * 5.2; rr(x, -60, yy - 5, 120, 10, 4, col); txt(x, cm + ' cm', -80, yy, 46, col, 'right'); }); x.restore(); } }); },
    'doi'(x, t, o) { const L = o.L;
      L(.05, () => { sky(x, '#0b1320', '#16202c'); clouds(x, t, '#121a28', 200); });
      L(.35, () => { hills(x, 900, 240, '#132019', 12); haze(x, '#16202c', .25); });
      L(1, () => { poly(x, [[-1200, 2600], [-1200, 1700], [-400, 1500], [600, 1100], [1300, 560], [2800, 300], [2800, 2600]], '#1d2c22');
        for (let i = 0; i < 7; i++) tree(x, 300 + i * 230, 1360 - i * 140, 1, '#14231a', t, o);
        x.strokeStyle = '#2a3b2b'; x.lineWidth = 5; const R = rgen(9); for (let k = 0; k < 40; k++) { const gx = -300 + R() * 2000, gy = 1500 - (gx + 400) * .55 + 10, w = wind(o, t, k) * 6; x.beginPath(); x.moveTo(gx, gy); x.quadraticCurveTo(gx + w, gy - 20, gx + w * 2, gy - 34); x.stroke(); }
        if (o.nuoc) water(x, 1700 - o.nuoc * 380, 2600, t, .85, 2); }); },
    'dinh-doi'(x, t, o) { const L = o.L, dawn = o.mau === 'binh-minh';
      L(.05, () => { sky(x, dawn ? '#3a4b6a' : '#0b1320', dawn ? '#d9a27a' : '#1a2430'); clouds(x, t, dawn ? '#8a7a8a' : '#141c28', 250);
        if (dawn) { const g = x.createRadialGradient(1300, 1150, 20, 1300, 1150, 700); g.addColorStop(0, 'rgba(255,210,150,.55)'); g.addColorStop(1, 'rgba(255,210,150,0)'); x.fillStyle = g; x.fillRect(0, 300, WW + 400, 1400); } });
      L(.45, () => { water(x, 1180, 2400, t, .8, .6); for (let i = 0; i < 6; i++) poly(x, [[100 + i * 260, 1200], [180 + i * 260, 1120], [260 + i * 260, 1200]], '#3a3a3e'); });
      L(1, () => { poly(x, [[-1200, 2600], [-1200, 1600], [-400, 1540], [500, 1380], [1300, 1420], [2000, 1600], [2800, 1700], [2800, 2600]], '#22311f'); grass(x, 1440, t, o, '#2f432c', 200, 1500, 60, 30); }); },
    'nut'(x, t, o) { rr(x, -1200, -1200, WW + 2400, 5200, 0, '#4a3a2a'); const p = clamp(o.nut ?? (o.u || 0) * 1.2), R = rgen(4);
      x.strokeStyle = '#120c08'; x.lineWidth = 16; x.lineJoin = 'round'; x.beginPath(); let px = 200, py = 700; x.moveTo(px, py);
      for (let k = 0; k < 14 * p; k++) { px += 90; py += (R() - .5) * 160; x.lineTo(px, py); } x.stroke(); },
    'ban-do'(x, t, o) { const m = o.ban_do || {}, u = o.u || 0; rr(x, -1200, -1200, WW + 2400, 5200, 0, '#24331f');
      for (let k = 0; k < 7; k++) { x.strokeStyle = `rgba(150,190,120,${.12 + k * .03})`; x.lineWidth = 4; x.beginPath(); x.ellipse(1250, 600, 520 - k * 70, 380 - k * 50, -.3, 0, 7); x.stroke(); }   // hill contours
      txt(x, m.doi || 'ĐỒI', 1250, 600, 56, '#bfe0a0');
      x.strokeStyle = '#3f7fb3'; x.lineWidth = 70; x.lineCap = 'round'; x.beginPath(); x.moveTo(-100, 300); x.bezierCurveTo(400, 700, 300, 1200, 800, 1500); x.lineTo(1700, 2000); x.stroke();   // stream
      x.setLineDash([30, 50]); x.lineDashOffset = -t * 120; x.strokeStyle = 'rgba(200,230,255,.5)'; x.lineWidth = 8; x.stroke(); x.setLineDash([]);
      const road = u > (m.ngap_luc ?? .4) ? '#e5383b' : '#c9b48a'; x.setLineDash([40, 26]); x.strokeStyle = road; x.lineWidth = 26; x.beginPath(); x.moveTo(-100, 420); x.bezierCurveTo(520, 760, 430, 1260, 920, 1560); x.lineTo(1700, 1900); x.stroke(); x.setLineDash([]);
      txt(x, m.duong || 'ĐƯỜNG RA LỘ', 1180, 1700, 46, road); rr(x, 560, 1020, 150, 120, 10, '#d8cfc0'); txt(x, m.nha || 'NHÀ', 635, 1190, 44, '#f0e9dc');
      const a = eio(clamp((u - (m.mui_ten ?? .55)) / .35));
      if (a > 0) { x.strokeStyle = '#ffc93c'; x.lineWidth = 18; x.beginPath(); x.moveTo(690, 1020); x.lineTo(lerp(690, 1150, a), lerp(1020, 700, a)); x.stroke(); txt(x, m.huong || 'LÊN ĐỒI', 1000, 960, 50, '#ffc93c'); } },
    'san'(x, t, o) { const L = o.L, day = o.mau !== 'dem';                        // daytime yard: sky, hills, fence, trees, grass — for dialogue scenes
      L(.05, () => { sky(x, day ? '#7fb0d0' : '#0b1220', day ? '#d6e6e0' : '#1c2a3a'); clouds(x, t, day ? 'rgba(255,255,255,.75)' : '#141e2c', 200); });
      L(.3, () => { hills(x, 1000, 220, day ? '#7f9f7a' : '#121c26', 4); haze(x, day ? '#cfe0dc' : '#1c2a3a', .25); });
      L(.6, () => { hills(x, 1150, 120, day ? '#6d905f' : '#18242e', 9); for (let i = 0; i < 5; i++) tree(x, 80 + i * 380, 1240, 1.25, day ? '#4f7a45' : '#1d3226', t, o); });
      L(1, () => { rr(x, -1200, 1300, WW + 2400, 1400, 0, day ? '#7a9a55' : '#22301f'); house(x, 1250, G - 60, .9, !day, t);
        x.fillStyle = day ? '#8a6a48' : '#3a2e22'; for (let i = -400; i < 900; i += 70) x.fillRect(i, 1250, 14, 120); x.fillRect(-400, 1270, 1300, 12); x.fillRect(-400, 1320, 1300, 12);
        grass(x, 1490, t, o, day ? '#5f8a44' : '#2c4128', -600, WW + 600, 46, 36); }); },
    'den'(x) { rr(x, -1200, -1200, WW + 2400, 5200, 0, '#050505'); },
    // child's bedroom, morning: warm wall, sunny window with rays, bed + blanket, desk fan, a big wall calendar (o.lich: "2006", o.thang: "THÁNG 6")
    // o.mau: 'dem' = night (dark window, moon, bedside lamp) · o.dong_ho: "03:00" = digital clock on the bedside table
    'phong-ngu'(x, t, o) { const dem = o.mau === 'dem'; rr(x, -1200, -1200, WW + 2400, 5200, 0, dem ? '#5b5470' : '#e9c79a'); for (let i = -800; i < WW + 800; i += 90) rr(x, i, -800, 6, 2300, 0, 'rgba(160,110,70,.12)');
      rr(x, 1010, 420, 470, 560, 10, '#9fd3f0'); const g0 = x.createLinearGradient(0, 420, 0, 980); g0.addColorStop(0, dem ? '#0b1430' : '#8cc8f0'); g0.addColorStop(1, dem ? '#22305a' : '#ffe7b0'); x.fillStyle = g0; x.fillRect(1020, 430, 450, 540);
      if (dem) { const R = rgen(3); for (let k = 0; k < 26; k++) { x.fillStyle = `rgba(255,255,240,${.4 + .5 * Math.abs(Math.sin(t * (1 + R()) + k))})`; x.fillRect(1030 + R() * 430, 440 + R() * 500, 4, 4); }
        x.fillStyle = '#fff6d8'; x.beginPath(); x.arc(1370, 540, 50, 0, 7); x.fill(); x.fillStyle = '#0f1a3a'; x.beginPath(); x.arc(1392, 528, 44, 0, 7); x.fill(); }
      else { x.fillStyle = 'rgba(255,255,255,.85)'; for (const [a, b, r] of [[1120, 560, 46], [1180, 545, 56], [1240, 565, 40]]) { x.beginPath(); x.ellipse(a + Math.sin(t * .2) * 10, b, r * 1.4, r * .6, 0, 0, 7); x.fill(); } }
      x.strokeStyle = '#8a5a34'; x.lineWidth = 22; x.strokeRect(1010, 420, 470, 560); x.beginPath(); x.moveTo(1245, 420); x.lineTo(1245, 980); x.stroke();
      if (!dem) { x.fillStyle = `rgba(255,236,180,${.2 + .04 * Math.sin(t)})`; x.beginPath(); x.moveTo(1010, 980); x.lineTo(1480, 980); x.lineTo(1000, G); x.lineTo(380, G); x.fill(); }
      else { x.fillStyle = 'rgba(170,190,255,.08)'; x.beginPath(); x.moveTo(1010, 980); x.lineTo(1480, 980); x.lineTo(1100, G); x.lineTo(560, G); x.fill(); }
      if (dem || o.dong_ho) { rr(x, 760, 1240, 200, 26, 6, '#7a5032'); rr(x, 776, 1266, 16, 214, 4, '#5a3a24'); rr(x, 928, 1266, 16, 214, 4, '#5a3a24');   // bedside table
        if (dem) { rr(x, 800, 1130, 16, 110, 4, '#3a3a3a'); poly(x, [[760, 1140], [856, 1140], [836, 1080], [780, 1080]], '#f2d79a'); const g = x.createRadialGradient(808, 1150, 10, 808, 1180, 520); g.addColorStop(0, 'rgba(255,214,140,.42)'); g.addColorStop(1, 'rgba(255,214,140,0)'); x.fillStyle = g; x.fillRect(280, 640, 1060, 1100); }
        if (o.dong_ho) { rr(x, 850, 1170, 104, 70, 10, '#1b1b1f'); txt(x, String(o.dong_ho), 902, 1206, 40, '#ff5a4a', 'center', 600, 'OSW'); } }
      rr(x, 300, 300, 330, 400, 8, '#fbf6ea'); rr(x, 300, 300, 330, 80, 8, '#c8321f'); txt(x, o.thang || 'THÁNG 6', 465, 342, 46, '#fff'); txt(x, o.lich || '2006', 465, 520, 150, '#2a2420', 'center', 700);
      txt(x, String(o.ngay || 'CHỦ NHẬT'), 465, 640, 40, '#8a5a34'); rr(x, 455, 270, 20, 40, 6, '#5a4a3a');
      rr(x, -60, 1150, 760, 60, 14, '#7a5032'); rr(x, -40, 1100, 720, 70, 30, '#f6efe2'); rr(x, 60, 1130, 640, 70, 26, '#4f87c4'); rr(x, -50, 1060, 170, 80, 30, '#ffffff'); rr(x, -60, 1210, 30, 270, 6, '#5a3a24'); rr(x, 670, 1210, 30, 270, 6, '#5a3a24');
      const fa = t * 18; rr(x, 1280, 1300, 18, 180, 6, '#d9d4c8'); rr(x, 1240, 1460, 100, 24, 10, '#d9d4c8'); x.save(); x.translate(1289, 1260); x.fillStyle = 'rgba(90,150,200,.55)'; for (let k = 0; k < 3; k++) { x.beginPath(); x.ellipse(Math.cos(fa + k * 2.09) * 34, Math.sin(fa + k * 2.09) * 34, 30, 16, fa + k * 2.09, 0, 7); x.fill(); } x.strokeStyle = '#d9d4c8'; x.lineWidth = 5; x.beginPath(); x.arc(0, 0, 70, 0, 7); x.stroke(); x.restore();
      rr(x, -1200, G, WW + 2400, 1400, 0, dem ? '#4a3e44' : '#b98a5c'); for (let i = -1200; i < WW + 1200; i += 160) rr(x, i, G, 4, 1400, 0, 'rgba(90,60,30,.25)');
      if (dem) { const g = x.createRadialGradient(808, 1150, 10, 808, 1180, 700); g.addColorStop(0, 'rgba(255,200,120,.32)'); g.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = g; x.fillRect(100, 450, 1420, 1500); } },
    // living room at night lit by a CRT TV (o.tv: bong-da | tin-tuc), sofa, cabinet, a family photo frame
    'phong-khach'(x, t, o) { rr(x, -1200, -1200, WW + 2400, 5200, 0, '#2b2f45'); rr(x, -1200, G, WW + 2400, 1400, 0, '#3a3044');
      const fl = .8 + .2 * Math.sin(t * 9) * Math.sin(t * 3.7); rr(x, 520, 980, 560, 300, 14, '#5a3a28'); rr(x, 600, 700, 400, 300, 40, '#2a2a2e'); rr(x, 630, 725, 340, 245, 26, '#0c1410');
      x.save(); x.beginPath(); x.roundRect(630, 725, 340, 245, 26); x.clip();
      if ((o.tv || 'bong-da') === 'bong-da') { rr(x, 630, 725, 340, 245, 0, mix('#2f7a3a', '#4aa04f', fl)); x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 3; x.strokeRect(650, 745, 300, 205); x.beginPath(); x.moveTo(800, 745); x.lineTo(800, 950); x.stroke(); x.beginPath(); x.arc(800, 848, 34, 0, 7); x.stroke();
        for (let k = 0; k < 8; k++) { x.fillStyle = k % 2 ? '#2a5ad0' : '#f2f2f2'; x.beginPath(); x.arc(680 + ((k * 61 + t * 30 * (k % 3 + 1)) % 240), 780 + (k * 37) % 150, 6, 0, 7); x.fill(); } x.fillStyle = '#fff'; x.beginPath(); x.arc(800 + Math.sin(t * 2) * 60, 850 + Math.cos(t * 1.4) * 30, 4, 0, 7); x.fill(); }
      else { rr(x, 630, 725, 340, 245, 0, mix('#1c3a6a', '#2a5090', fl)); rr(x, 650, 900, 300, 40, 0, '#c8321f'); }
      x.fillStyle = 'rgba(255,255,255,.06)'; for (let y = 725; y < 970; y += 4) x.fillRect(630, y, 340, 1); x.restore();
      const g = x.createRadialGradient(800, 850, 30, 800, 1100, 900); g.addColorStop(0, `rgba(120,200,160,${.22 * fl})`); g.addColorStop(1, 'rgba(120,200,160,0)'); x.fillStyle = g; x.fillRect(-200, 400, 2000, 1500);
      rr(x, 120, 420, 220, 170, 6, '#6a4a30'); rr(x, 138, 438, 184, 134, 4, '#c9b38a'); rr(x, 1240, 420, 220, 170, 6, '#6a4a30'); rr(x, 1258, 438, 184, 134, 4, '#9ab0c0');
      rr(x, -300, 1240, 520, 120, 30, '#7a3a3a'); rr(x, -300, 1160, 520, 110, 40, '#8a4444'); },
    // dusk city skyline (thumbnail look; o.bay = hurricane-force eastward wind + flying debris): deep blue → warm horizon, three layers of buildings with warm rim light, glowing dust motes
    'thanh-pho'(x, t, o) { const L = o.L, dem = o.mau === 'dem';
      L(.05, () => { sky(x, dem ? '#0a1430' : '#1d3f8a', dem ? '#24305a' : '#f2b86a'); const R = rgen(5); x.fillStyle = 'rgba(255,255,255,.8)'; for (let k = 0; k < 60; k++) { const a = R() * (WW + 1600) - 800, b = R() * 700 - 300; x.globalAlpha = .3 + .5 * Math.abs(Math.sin(t * (1 + R()) + k)); x.fillRect(a, b, 3, 3); } x.globalAlpha = 1;
        const gl = x.createRadialGradient(400, 1100, 50, 400, 1100, 1200); gl.addColorStop(0, dem ? 'rgba(255,200,120,.15)' : 'rgba(255,214,140,.55)'); gl.addColorStop(1, 'rgba(255,214,140,0)'); x.fillStyle = gl; x.fillRect(-800, -400, 3200, 2800); });
      const city = (seed, y, hmin, hmax, col, rim, win) => { const R = rgen(seed); let a = -1100; while (a < WW + 1100) { const w = 70 + R() * 130, h = hmin + R() * (hmax - hmin); rr(x, a, y - h, w, h + 1400, 0, col); x.fillStyle = rim; x.fillRect(a, y - h, 7, h); x.fillRect(a, y - h, w, 5);
          if (win) { x.fillStyle = win; for (let yy = y - h + 30; yy < y - 20; yy += 46) for (let xx = a + 18; xx < a + w - 20; xx += 34) if (R() > .55) x.fillRect(xx, yy, 14, 20); } a += w + 6; } };
      L(.2, () => city(11, 1180, 220, 520, dem ? '#1c2648' : '#7f8fb8', dem ? 'rgba(255,210,150,.15)' : 'rgba(255,220,160,.55)', null));
      L(.45, () => city(12, 1300, 160, 420, dem ? '#141c38' : '#4a5a8a', 'rgba(255,200,130,.5)', dem ? 'rgba(255,214,140,.7)' : null));
      L(.8, () => city(13, 1480, 120, 300, dem ? '#0e1428' : '#2c3a64', 'rgba(255,190,120,.6)', 'rgba(255,214,140,.55)'));
      L(1, () => { rr(x, -1200, G, WW + 2400, 1400, 0, dem ? '#0b0f1e' : '#1f2848'); const R = rgen(9); for (let k = 0; k < 40; k++) { const a = R() * (WW + 800) - 400, b = 200 + R() * 1200, ph = (t * .08 + R()) % 1;
        x.fillStyle = `rgba(255,214,140,${.6 * Math.sin(ph * Math.PI)})`; x.beginPath(); x.arc(a + Math.sin(t + k) * 20, b - ph * 160, 3 + R() * 3, 0, 7); x.fill(); } });
      if (o.bay) L(1, () => { const R = rgen(77), k0 = clamp(o.bay === true ? 1 : o.bay);   // o.bay: violent eastward wind with flying debris
        x.strokeStyle = 'rgba(230,235,255,.55)'; x.lineCap = 'round'; for (let k = 0; k < 70 * k0; k++) { const y0 = R() * 1700 - 100, sp = 1800 + R() * 2200, L0 = 160 + R() * 320, xx = ((R() * 3600 + t * sp) % 3600) - 1000; x.lineWidth = 2 + R() * 4; x.beginPath(); x.moveTo(xx, y0); x.lineTo(xx + L0, y0 + 6); x.stroke(); }
        const items = ['#d9452f', '#f0c04a', '#e8e4da', '#4f9a52', '#3f6f8a']; for (let k = 0; k < 18 * k0; k++) { const y0 = 300 + R() * 1200, sp = 900 + R() * 1400, xx = ((R() * 3600 + t * sp) % 3600) - 1000; x.save(); x.translate(xx, y0 + Math.sin(t * 5 + k) * 30); x.rotate(t * (3 + R() * 6) + k);
          if (k % 6 === 0) { rr(x, -50, -18, 100, 36, 10, '#2a2630'); x.fillStyle = '#121016'; x.beginPath(); x.arc(-30, 22, 14, 0, 7); x.arc(30, 22, 14, 0, 7); x.fill(); } else rr(x, -18 - (k % 3) * 8, -12, 36 + (k % 3) * 16, 24, 4, items[k % items.length]); x.restore(); } }); },
    // Vietnamese street at night after a big win: shophouses, a crowd of silhouettes waving red flags, motorbike headlights streaming past, confetti
    // o.vui: 0 = quiet street (no crowd), 1 = celebration (default)
    'pho-dem'(x, t, o) { const L = o.L, vui = o.vui ?? 1;
      L(.05, () => { sky(x, '#0b1024', '#2a2244'); const g = x.createRadialGradient(800, 1300, 50, 800, 1300, 1300); g.addColorStop(0, `rgba(255,120,80,${.25 * vui})`); g.addColorStop(1, 'rgba(255,120,80,0)'); x.fillStyle = g; x.fillRect(-800, -400, 3200, 2800); });
      L(.4, () => { const R = rgen(31); let a = -1100; while (a < WW + 1100) { const w = 150 + R() * 90, h = 520 + R() * 380; rr(x, a, 1380 - h, w, h + 1400, 0, ['#3a2e3e', '#2e2a3a', '#40303a'][Math.floor(R() * 3)]);
          for (let yy = 1380 - h + 50; yy < 1300; yy += 110) for (let xx = a + 22; xx < a + w - 40; xx += 60) rr(x, xx, yy, 34, 54, 4, R() > .35 ? `rgba(255,${190 + R() * 40 | 0},120,.75)` : '#1a1622');
          if (R() > .4) { rr(x, a + 10, 1380 - h + 10, w - 20, 40, 4, ['#c8321f', '#2f6ac8', '#e0a43a'][Math.floor(R() * 3)]); } a += w + 4; } });
      L(1, () => { rr(x, -1200, 1380, WW + 2400, 1400, 0, '#1c1a24'); rr(x, -1200, 1370, WW + 2400, 16, 0, '#4a4452');
        for (let k = 0; k < 14; k++) { const sp = 260 + (k % 4) * 90, ph = ((t * sp + k * 420) % (WW + 2000)) - 1000, y = 1440 + (k % 3) * 22, dir = k % 2 ? 1 : -1, xx = dir > 0 ? ph : WW - ph;
          const g = x.createLinearGradient(xx, 0, xx + dir * 260, 0); g.addColorStop(0, 'rgba(255,240,200,.9)'); g.addColorStop(1, 'rgba(255,240,200,0)'); x.fillStyle = g; x.fillRect(Math.min(xx, xx + dir * 260), y, 260, 6);
          rr(x, xx - 30, y - 34, 60, 34, 10, '#2a2630'); x.fillStyle = '#121016'; x.beginPath(); x.arc(xx, y - 52, 14, 0, 7); x.fill(); }
        if (vui > 0) { const R = rgen(44); for (let k = 0; k < 26; k++) { const a = (R() * (WW + 600)) - 300, s = .8 + R() * .5, b = 1380 + R() * 30, jump = Math.max(0, Math.sin(t * (4 + R() * 2) + k)) * 18 * vui;
            x.fillStyle = '#0e0c12'; x.beginPath(); x.arc(a, b - 150 * s - jump, 22 * s, 0, 7); x.fill(); rr(x, a - 20 * s, b - 128 * s - jump, 40 * s, 120 * s, 12 * s, '#0e0c12');
            if (k % 3 === 0) { const fx = a + 18 * s, fy = b - 230 * s - jump; rr(x, fx, fy, 4, 110 * s, 2, '#0e0c12'); x.fillStyle = '#d42a1e'; x.beginPath(); x.moveTo(fx + 4, fy); for (let q = 0; q <= 8; q++) x.lineTo(fx + 4 + q * 9 * s, fy + Math.sin(t * 7 + q * .8 + k) * 6); for (let q = 8; q >= 0; q--) x.lineTo(fx + 4 + q * 9 * s, fy + 50 * s + Math.sin(t * 7 + q * .8 + k) * 6); x.fill();
              x.fillStyle = '#ffd23a'; x.beginPath(); x.arc(fx + 40 * s, fy + 25 * s + Math.sin(t * 7 + 4 * .8 + k) * 6, 9 * s, 0, 7); x.fill(); } }
          const C = rgen(8); for (let k = 0; k < 70; k++) { const a = C() * (WW + 400) - 200, ph = (t * (.15 + C() * .2) + C()) % 1; x.fillStyle = ['#ffd23a', '#d42a1e', '#ffffff'][k % 3]; x.save(); x.translate(a + Math.sin(t * 2 + k) * 30, -100 + ph * 1600); x.rotate(t * 3 + k); x.fillRect(-6, -3, 12, 6); x.restore(); } } });
      if (o.bien_bao) L(1, () => { const bx = (o.bien_x ?? .62) * WW, ag = clamp(o.bien_bao === true ? 0 : o.bien_bao), sw = Math.sin(t * 1.7) * .04 * ag;   // a street sign; ao giac 0–1 = it becomes "a person"
        x.save(); x.translate(bx, G); x.rotate(sw); rr(x, -9, -560, 18, 560, 6, '#8e939a'); rr(x, -40, -12, 80, 16, 6, '#5e636a');
        x.fillStyle = '#2f62c8'; x.beginPath(); x.arc(0, -620, 90, 0, 7); x.fill(); x.strokeStyle = '#f2f2f2'; x.lineWidth = 9; x.beginPath(); x.arc(0, -620, 82, 0, 7); x.stroke();
        if (ag < .5) { x.strokeStyle = '#d23b3b'; x.lineWidth = 16; x.beginPath(); x.arc(0, -620, 60, 0, 7); x.stroke(); x.beginPath(); x.moveTo(-42, -662); x.lineTo(42, -578); x.stroke(); }
        if (ag > 0) { x.globalAlpha = ag; for (const k of [-1, 1]) { x.fillStyle = '#f4ead4'; x.beginPath(); x.ellipse(k * 30, -640, 20, 17, 0, 0, 7); x.fill(); x.fillStyle = '#121014'; x.beginPath(); x.arc(k * 30 - 6, -637, 8, 0, 7); x.fill(); }
          x.strokeStyle = '#f4ead4'; x.lineWidth = 8; x.lineCap = 'round'; x.beginPath(); x.arc(0, -604, 30, .25, Math.PI - .25); x.stroke();
          x.strokeStyle = '#8e939a'; x.lineWidth = 14; x.beginPath(); x.moveTo(0, -420); x.quadraticCurveTo(-60 - Math.sin(t * 3) * 20, -380, -90, -330 - Math.sin(t * 3) * 40); x.stroke(); x.globalAlpha = 1; }   // a waving "arm"
        x.restore(); }); },
    // classroom: green chalkboard (o.bang text), rows of small desks, window light on the left
    'lop-hoc'(x, t, o) { rr(x, -1200, -1200, WW + 2400, 5200, 0, '#f0deb0'); rr(x, -1200, -1200, WW + 2400, 1700, 0, '#e8d4a4'); rr(x, -1200, 1000, WW + 2400, 60, 0, '#7aa07a');
      rr(x, 300, 380, 1000, 520, 16, '#5a3a24'); rr(x, 320, 400, 960, 480, 10, '#2f5a46'); const lines = String(o.bang || 'Thứ Hai|Tập viết: a ă â').split('|');
      lines.forEach((s, i) => txt(x, s, 800, 520 + i * 110, i ? 64 : 58, 'rgba(240,240,230,.92)', 'center', 400, 'BVP'));
      rr(x, 1320, 840, 120, 18, 4, '#d9d4c8'); rr(x, -200, 430, 360, 500, 10, '#a8d8f0'); x.strokeStyle = '#8a5a34'; x.lineWidth = 16; x.strokeRect(-200, 430, 360, 500);
      for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) { const a = 120 + k * 380 + r * 60, b = 1250 + r * 160; rr(x, a, b, 260, 26, 6, '#c08a52'); rr(x, a + 20, b + 26, 14, 150 - r * 40, 3, '#7a5032'); rr(x, a + 226, b + 26, 14, 150 - r * 40, 3, '#7a5032'); }
      rr(x, -1200, G, WW + 2400, 1400, 0, '#c9a878'); },
    // school corridor: windows on the far wall, a row of lockers, notice board, ceiling lights, a crowd of student silhouettes
    // o.dong: [texts] = thought bubbles over the first silhouettes (or a number = silhouettes without bubbles; 0 = empty corridor)
    // o.soi: 'mot' = dark corridor + one spotlight on the first character · 'tat-ca' = a spotlight on every student
    'truong-hoc'(x, t, o) { const L = o.L, dong = o.dong ?? 6, texts = Array.isArray(dong) ? dong : [], nDong = Array.isArray(dong) ? Math.max(6, dong.length) : dong;
      L(.15, () => { rr(x, -1200, -1200, WW + 2400, 5200, 0, '#dfe6e4'); rr(x, -1200, -1200, WW + 2400, 1460, 0, '#e9ede6');
        for (let i = -3; i < 7; i++) { const a = i * 420 + 40; rr(x, a, 300, 300, 330, 10, '#7fa9c4'); const g = x.createLinearGradient(0, 300, 0, 630); g.addColorStop(0, '#9fd0ef'); g.addColorStop(1, '#e8f1e0'); x.fillStyle = g; x.fillRect(a + 12, 312, 276, 306);
          x.fillStyle = 'rgba(255,255,255,.8)'; x.beginPath(); x.ellipse(a + 110 + Math.sin(t * .2 + i) * 14, 400, 60, 22, 0, 0, 7); x.fill(); x.strokeStyle = '#6f8d9c'; x.lineWidth = 10; x.strokeRect(a, 300, 300, 330); x.beginPath(); x.moveTo(a + 150, 300); x.lineTo(a + 150, 630); x.stroke(); }
        for (let i = -3; i < 8; i++) { rr(x, i * 300 + 80, 90, 160, 22, 8, '#fdfbe8'); const g = x.createRadialGradient(i * 300 + 160, 110, 10, i * 300 + 160, 260, 320); g.addColorStop(0, 'rgba(255,250,220,.35)'); g.addColorStop(1, 'rgba(255,250,220,0)'); x.fillStyle = g; x.fillRect(i * 300 - 160, 100, 640, 420); } });
      L(.55, () => { rr(x, -1200, 660, WW + 2400, 40, 0, '#b9c6c4');
        for (let i = -12; i < 26; i++) { const a = i * 116; rr(x, a, 720, 110, 640, 6, i % 7 === 3 ? '#e0a43a' : '#3f7f9a'); rr(x, a + 6, 726, 98, 628, 4, i % 7 === 3 ? '#e8b24a' : '#4a8eaa');
          for (let k = 0; k < 4; k++) rr(x, a + 26, 760 + k * 16, 58, 6, 3, 'rgba(20,40,50,.45)'); rr(x, a + 82, 1000, 12, 60, 4, '#d8dde0'); }
        rr(x, 640, 470, 330, 200, 8, '#a57a4e'); rr(x, 652, 482, 306, 176, 6, '#c99a64'); [[680, 500, '#fbf6ea'], [790, 520, '#ffe08a'], [880, 498, '#bfe3f3']].forEach(([a, b, c0], k) => { x.save(); x.translate(a + 40, b + 55); x.rotate((k - 1) * .06); rr(x, -40, -50, 80, 100, 3, c0); x.fillStyle = '#d23b3b'; x.beginPath(); x.arc(0, -42, 6, 0, 7); x.fill(); x.restore(); }); });
      L(1, () => { rr(x, -1200, 1360, WW + 2400, 1600, 0, '#c9c2b4'); for (let i = -1200; i < WW + 1200; i += 150) { x.strokeStyle = 'rgba(120,110,95,.28)'; x.lineWidth = 3; x.beginPath(); x.moveTo(i, 1360); x.lineTo(i + (i - WW / 2) * .5, 2900); x.stroke(); }
        for (let y = 1420; y < 2900; y += 80 + (y - 1360) * .4) { x.fillStyle = 'rgba(120,110,95,.2)'; x.fillRect(-1200, y, WW + 2400, 3); }
        const soi = o.soi, dark = soi ? .55 : 0;
        if (dark) { x.fillStyle = `rgba(10,12,24,${dark})`; x.fillRect(-1200, -1200, WW + 2400, 5200); }
        const cone = (cx, a0) => { const g = x.createLinearGradient(0, 0, 0, G); g.addColorStop(0, `rgba(255,236,170,${.05 * a0})`); g.addColorStop(1, `rgba(255,236,170,${.42 * a0})`); x.fillStyle = g;
          x.beginPath(); x.moveTo(cx - 40, -300); x.lineTo(cx + 40, -300); x.lineTo(cx + 170, G); x.lineTo(cx - 170, G); x.closePath(); x.fill(); x.fillStyle = `rgba(255,240,190,${.5 * a0})`; x.beginPath(); x.ellipse(cx, G, 190, 34, 0, 0, 7); x.fill(); };
        const R = rgen(17), crowd = []; for (let k = 0; k < nDong; k++) { const bx = 330 + (k + .5) * 940 / nDong + (R() - .5) * 60, sc = .78 + R() * .2, sp = (R() - .5) * 40, bb = 1384 + R() * 20; crowd.push({ bx: bx + Math.sin(t * .5 + k) * 10 + sp * t * .1, sc, bb, k }); }
        const hero = (o.nv || [])[0], hx = hero ? hero.x * WW : WW / 2;
        if (soi === 'tat-ca') crowd.forEach(p => cone(p.bx, .8 + .2 * Math.sin(t * 2 + p.k)));
        crowd.forEach(p => { const { bx, sc, bb, k } = p, bob = Math.abs(Math.sin(t * 3.2 + k * 1.3)) * 5;           // students: dark silhouettes with backpacks
          x.fillStyle = soi ? '#2a2c3a' : '#55606e'; x.beginPath(); x.arc(bx, bb - 300 * sc - bob, 44 * sc, 0, 7); x.fill(); rr(x, bx - 40 * sc, bb - 256 * sc - bob, 80 * sc, 170 * sc, 26 * sc, x.fillStyle);
          rr(x, bx - 30 * sc, bb - 96 * sc, 24 * sc, 96 * sc, 8, x.fillStyle); rr(x, bx + 6 * sc, bb - 96 * sc, 24 * sc, 96 * sc, 8, x.fillStyle); rr(x, bx + (k % 2 ? 26 : -66) * sc, bb - 240 * sc - bob, 40 * sc, 90 * sc, 12, soi ? '#3a3040' : '#7a5a6a'); });
        if (soi === 'mot' || soi === 'tat-ca') cone(hx, 1);
        texts.forEach((s, k) => { const p = crowd[k]; if (!p || !s) return; const pp = spring((o.u || 0) * (o.D || 3) - .15 - k * .35); if (pp <= 0) return;
          const row = Math.floor(k / 2) % 2, bxs = [[560, 1040], [1040, 560]][row][k % 2], by = row ? 560 : 800, cx = (o.nv || [])[0] ? hx : WW / 2, bx2 = bxs + (cx - WW / 2) * .5;   // two columns × two rows around the frame centre
          x.strokeStyle = 'rgba(255,255,255,.7)'; x.setLineDash([6, 10]); x.lineWidth = 4; x.beginPath(); x.moveTo(p.bx, p.bb - 300 * p.sc - 60); x.lineTo(bx2, by); x.stroke(); x.setLineDash([]);
          bubbleW(x, bx2, by, s, pp, 38, 420, false); }); }); },
    // insert: close-up of the red hoodie with a big white toothpaste smear that splats in
    'vet-ao'(x, t, o) { rr(x, -1200, -1200, WW + 2400, 5200, 0, '#c63a2a'); for (let i = -1200; i < WW + 1200; i += 26) { x.fillStyle = 'rgba(0,0,0,.05)'; x.fillRect(i, -1200, 10, 5200); }
      rr(x, 770, -1200, 60, 5200, 0, '#9a2a1f'); for (let y = -800; y < 3000; y += 34) rr(x, 780, y, 40, 16, 4, '#d8d4c8');
      x.fillStyle = 'rgba(0,0,0,.18)'; x.beginPath(); x.ellipse(800, 380, 520, 90, 0, 0, 7); x.fill();
      const p = spring((o.u || 0) * (o.D || 3) - .25, 10, 260); if (p <= 0) return; x.save(); x.translate(560, 1180); x.scale(p, p); x.rotate(-.2);
      x.fillStyle = '#f4f7fb'; x.beginPath(); x.ellipse(0, 0, 150, 70, 0, 0, 7); x.ellipse(110, 40, 70, 46, .4, 0, 7); x.ellipse(-120, -30, 60, 40, -.3, 0, 7); x.fill();
      x.fillStyle = '#9fd8ff'; x.beginPath(); x.ellipse(-20, -6, 120, 22, 0, 0, 7); x.fill(); x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(-50, -22, 40, 12, 0, 0, 7); x.fill();
      const drip = clamp(((o.u || 0) - .35) * 1.6) * 120; rr(x, 60, 30, 34, 60 + drip, 17, '#f4f7fb'); x.restore(); },
    // Thăng Long 1010: Red River bank under the earthen ramparts of Đại La, a wooden gate tower, thatched huts, bamboo.
    // o.thuyen: royal dragon boats on the river (drift in) · o.rong: 0–1 a golden "dragon" of cloud rising (legend) · o.mau: 'dem' night · o.cong: false hides the gate
    'thang-long'(x, t, o) { const L = o.L, dem = o.mau === 'dem';
      L(.05, () => { sky(x, dem ? '#0a1430' : '#8fc3dc', dem ? '#2a3354' : '#f4dcae'); clouds(x, t, dem ? 'rgba(60,70,100,.6)' : 'rgba(255,255,255,.8)', 180);
        if (dem) { x.fillStyle = '#fff6d8'; x.beginPath(); x.arc(1250, 330, 60, 0, 7); x.fill(); const R = rgen(4); for (let k = 0; k < 50; k++) { x.fillStyle = `rgba(255,255,240,${.3 + .5 * Math.abs(Math.sin(t + k))})`; x.fillRect(R() * 2400 - 400, R() * 700 - 200, 3, 3); } } });
      L(.2, () => { hills(x, 1010, 160, dem ? '#1a2a32' : '#86a98a', 6); haze(x, dem ? '#2a3354' : '#e8e0c8', .25); });
      const rg = clamp(o.rong || 0);
      if (rg > 0) L(.25, () => { const up = (o.u || 0) * 260, k0 = 1050 - up; x.save(); x.globalAlpha = rg; x.lineCap = 'round'; x.lineJoin = 'round';           // the legend: a golden dragon rising out of the clouds
        const pts = []; for (let i = 0; i <= 40; i++) { const q = i / 40; pts.push([300 + q * 1000, k0 - q * 520 + Math.sin(q * 9 + t * 2.4) * 70 * (1 - q * .4)]); }
        for (const [w, c] of [[70, 'rgba(255,240,190,.35)'], [44, '#f2b632'], [26, '#ffd76a']]) { x.strokeStyle = c; x.lineWidth = w; x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(...p) : x.moveTo(...p)); x.stroke(); }
        for (let i = 4; i < 40; i += 3) { const [a, b] = pts[i]; poly(x, [[a - 14, b - 18], [a, b - 46], [a + 14, b - 18]], '#e8a21e'); }
        const [hx, hy] = pts[40]; x.fillStyle = '#f2b632'; x.beginPath(); x.ellipse(hx + 20, hy, 70, 46, -.5, 0, 7); x.fill(); x.fillStyle = '#7a2a10'; x.beginPath(); x.arc(hx + 40, hy - 14, 9, 0, 7); x.fill();
        x.strokeStyle = '#ffd76a'; x.lineWidth = 8; for (const d of [-1, 1]) { x.beginPath(); x.moveTo(hx + 30, hy - 30); x.quadraticCurveTo(hx + 90, hy - 90 + d * 20, hx + 150, hy - 70 + d * 40 + Math.sin(t * 3) * 10); x.stroke(); }
        clouds(x, t * .5, 'rgba(255,250,235,.9)', k0 + 40); x.restore(); });
      L(.45, () => { poly(x, [[-1200, 1210], [-1200, 1060], [-200, 1020], [1700, 1020], [2800, 1060], [2800, 1210]], dem ? '#3a2e26' : '#9a7650');   // earthen rampart of Đại La
        rr(x, -1200, 1010, WW + 2400, 22, 6, dem ? '#2a3a2a' : '#6f9a52'); for (let i = -1200; i < WW + 1200; i += 90) rr(x, i, 1060 + (i % 180 ? 30 : 70), 50, 8, 4, 'rgba(60,40,20,.25)');
        if (o.cong !== false) { const gx = 1120; rr(x, gx - 170, 860, 340, 200, 4, dem ? '#3a2a22' : '#7a4a2e'); rr(x, gx - 70, 950, 140, 110, 60, '#2a1c14');      // gate tower
          for (const c of [-150, -60, 60, 150]) rr(x, gx + c - 10, 860, 20, 200, 3, dem ? '#4a2a1e' : '#9a3a24');
          poly(x, [[gx - 240, 880], [gx - 190, 820], [gx + 190, 820], [gx + 240, 880], [gx + 200, 860], [gx - 200, 860]], dem ? '#2a2420' : '#4a3a30');
          poly(x, [[gx - 150, 820], [gx - 110, 760], [gx + 110, 760], [gx + 150, 820]], dem ? '#2a2420' : '#4a3a30'); rr(x, gx - 110, 780, 220, 40, 4, dem ? '#3a2a22' : '#8a5a34');
          for (const d of [-1, 1]) { x.strokeStyle = dem ? '#2a2420' : '#4a3a30'; x.lineWidth = 12; x.lineCap = 'round'; x.beginPath(); x.moveTo(gx + d * 230, 878); x.quadraticCurveTo(gx + d * 262, 870, gx + d * 270, 840); x.stroke(); }
          for (const d of [-1, 1]) { rr(x, gx + d * 120 - 3, 640, 6, 140, 2, '#5a3a24'); x.fillStyle = '#e0a43a'; x.beginPath(); x.moveTo(gx + d * 120 + 3, 645); for (let q = 0; q <= 6; q++) x.lineTo(gx + d * 120 + 3 + q * 12, 650 + Math.sin(t * 5 + q) * 6); for (let q = 6; q >= 0; q--) x.lineTo(gx + d * 120 + 3 + q * 12, 690 + Math.sin(t * 5 + q) * 6); x.fill(); } }
        for (const hx of [180, 470]) { rr(x, hx - 90, 940, 180, 90, 4, dem ? '#3a3026' : '#b08a5a'); poly(x, [[hx - 130, 950], [hx, 860], [hx + 130, 950]], dem ? '#4a4030' : '#c9a85a'); rr(x, hx - 20, 975, 40, 55, 3, '#3a2a1c'); } });
      L(.7, () => { water(x, 1220, 1420, t, 1, .6); if (o.thuyen) { const dx = ((o.u || 0) * 160) + Math.sin(t * .8) * 6;               // royal boats with dragon prows and yellow flags
          for (const [bx, sc] of [[150, 1], [620, .8], [-260, .7]]) { const X0 = bx + dx * sc, Y0 = 1290 - (1 - sc) * 70 + Math.sin(t * 1.6 + bx) * 4; x.save(); x.translate(X0, Y0); x.scale(sc, sc);
            poly(x, [[-260, -20], [240, -20], [200, 30], [-220, 30]], '#7a2a1a'); rr(x, -250, -30, 480, 16, 6, '#c8a23a'); rr(x, -120, -110, 200, 80, 8, '#9a3a24'); poly(x, [[-140, -110], [-20, -150], [100, -110]], '#5a2a1a');
            x.strokeStyle = '#c8a23a'; x.lineWidth = 14; x.lineCap = 'round'; x.beginPath(); x.moveTo(240, -20); x.quadraticCurveTo(300, -40, 290, -100); x.stroke(); x.fillStyle = '#c8a23a'; x.beginPath(); x.ellipse(290, -110, 26, 18, -.4, 0, 7); x.fill();
            rr(x, -12, -260, 8, 150, 2, '#4a3020'); x.fillStyle = '#f2c23a'; x.beginPath(); x.moveTo(-4, -255); for (let q = 0; q <= 6; q++) x.lineTo(-4 + q * 14, -250 + Math.sin(t * 5 + q + bx) * 7); for (let q = 6; q >= 0; q--) x.lineTo(-4 + q * 14, -205 + Math.sin(t * 5 + q + bx) * 7); x.fill();
            for (let q = -3; q <= 3; q++) { x.strokeStyle = '#4a3020'; x.lineWidth = 5; x.beginPath(); x.moveTo(q * 60, 20); x.lineTo(q * 60 - 30 + Math.sin(t * 3 + q) * 12, 70); x.stroke(); } x.restore(); } } });
      L(1, () => { rr(x, -1200, 1400, WW + 2400, 1600, 0, dem ? '#2a2620' : '#8a7a52'); rr(x, -1200, 1396, WW + 2400, 14, 6, dem ? '#3a3428' : '#a8946a');
        for (const bx of [-120, 1500]) for (let k = 0; k < 7; k++) { const sw = wind(o, t, k + bx) * 18, h = 520 + k * 40; x.strokeStyle = dem ? '#1e2a1e' : '#5f8a3a'; x.lineWidth = 12; x.beginPath(); x.moveTo(bx + k * 22, 1420); x.quadraticCurveTo(bx + k * 22 + sw * .3, 1420 - h * .5, bx + k * 22 + sw, 1420 - h); x.stroke();   // bamboo
          x.fillStyle = dem ? '#22301f' : '#6f9a45'; for (let q = 0; q < 4; q++) { x.beginPath(); x.ellipse(bx + k * 22 + sw * (.5 + q * .12) + (q % 2 ? 30 : -30), 1420 - h * (.55 + q * .12), 38, 9, (q % 2 ? .5 : -.5), 0, 7); x.fill(); } }
        grass(x, 1420, t, o, dem ? '#2c3a26' : '#7a9a4a', -600, WW + 600, 60, 26); }); },
    // deserted island: tropical sky, turquoise sea with a horizon boat, beach with foam, swaying coconut palms
    // o.thuyen: 'xa' = a small boat crossing the horizon (with o.u) · 'gan' = a fishing boat at the shore · o.lua: 1–3 signal fires in a triangle (o.khoi: white smoke)
    // o.dua: x (0–1) = the coconut "friend" with a face drawn on it, on the sand
    'dao-hoang'(x, t, o) { const L = o.L, nf = o.lua || 0;
      L(.05, () => { sky(x, '#3f8fd0', '#cfeaf0'); const g = x.createRadialGradient(1250, 300, 20, 1250, 300, 380); g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(.25, 'rgba(255,240,180,.6)'); g.addColorStop(1, 'rgba(255,240,180,0)'); x.fillStyle = g; x.fillRect(800, -100, 900, 800); clouds(x, t, 'rgba(255,255,255,.85)', 250); });
      L(.25, () => { const g = x.createLinearGradient(0, 960, 0, 1330); g.addColorStop(0, '#2a86b8'); g.addColorStop(1, '#3fc0c8'); x.fillStyle = g; x.fillRect(-1200, 960, WW + 2400, 1400);
        x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 3; const R = rgen(12); for (let k = 0; k < 50; k++) { const yy = 980 + R() * 330, xx = ((R() * (WW + 2400) + t * 20 * (1 + R())) % (WW + 2400)) - 1200, w = 30 + R() * 70; x.beginPath(); x.moveTo(xx, yy); x.quadraticCurveTo(xx + w / 2, yy - 5, xx + w, yy); x.stroke(); }
        if (o.thuyen === 'xa') { const bx = -300 + (o.u || 0) * 2200; poly(x, [[bx - 40, 958], [bx + 40, 958], [bx + 30, 972], [bx - 30, 972]], '#2a3440'); rr(x, bx - 4, 900, 5, 58, 2, '#2a3440'); poly(x, [[bx + 1, 905], [bx + 1, 952], [bx + 34, 952]], '#e8e4da'); } });
      L(.6, () => { if (o.thuyen === 'gan') { const by = 1300 + Math.sin(t * 1.4) * 6; x.save(); x.translate(1180, by); poly(x, [[-260, -40], [250, -40], [200, 40], [-210, 40]], '#2f6ac8'); rr(x, -260, -50, 510, 18, 6, '#e8e4da'); rr(x, -60, -140, 120, 90, 8, '#d23b3b'); rr(x, -6, -330, 10, 290, 3, '#4a3020'); x.restore(); }
        palm(x, 80, 1380, 1.25, t, o, 0); palm(x, 1480, 1380, 1.1, t, o, 1); });
      L(1, () => { rr(x, -1200, 1340, WW + 2400, 1700, 0, '#f0d9a0'); const g = x.createLinearGradient(0, 1340, 0, 1460); g.addColorStop(0, '#e2c486'); g.addColorStop(1, 'rgba(240,217,160,0)'); x.fillStyle = g; x.fillRect(-1200, 1340, WW + 2400, 120);
        x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 8; x.lineCap = 'round'; x.beginPath(); for (let i = -1200; i <= WW + 1200; i += 30) { const yy = 1342 + Math.sin(i * .01 + t * 1.8) * 6 + Math.max(0, Math.sin(t * .9)) * 10; i > -1200 ? x.lineTo(i, yy) : x.moveTo(i, yy); } x.stroke();
        const R = rgen(8); for (let k = 0; k < 30; k++) { x.fillStyle = 'rgba(180,150,100,.35)'; x.beginPath(); x.ellipse(R() * (WW + 1600) - 800, 1400 + R() * 600, 6 + R() * 8, 3, 0, 0, 7); x.fill(); }
        const tri = [[900, 1470], [1200, 1470], [1050, 1360]];
        for (let k = 0; k < Math.min(3, nf); k++) { const [fx, fy] = tri[k]; for (const d of [-1, 1]) { x.strokeStyle = '#5a3a24'; x.lineWidth = 12; x.beginPath(); x.moveTo(fx - 50 * d, fy + 10); x.lineTo(fx + 30 * d, fy - 40); x.stroke(); }
          const fl = .85 + .15 * Math.sin(t * 13 + k); for (const [c, w, h] of [['#e5383b', 62, 160], ['#f08a24', 46, 124], ['#ffd23a', 28, 80]]) { x.fillStyle = c; x.beginPath(); x.moveTo(fx - w, fy); x.quadraticCurveTo(fx - w * .6, fy - h * fl * .6, fx + Math.sin(t * 7 + k) * 8, fy - h * fl); x.quadraticCurveTo(fx + w * .6, fy - h * fl * .6, fx + w, fy); x.fill(); }
          if (o.khoi) for (let q = 0; q < 9; q++) { const ph = ((t * .25 + q / 9 + k * .13) % 1), r0 = 30 + ph * 110; x.fillStyle = `rgba(245,245,245,${.55 * (1 - ph)})`; x.beginPath(); x.arc(fx + Math.sin(ph * 6 + k) * 30 + ph * 80, fy - 120 - ph * 900, r0, 0, 7); x.fill(); } }
        if (o.dua != null) { const dx = o.dua * WW, dy = 1478; x.fillStyle = 'rgba(0,0,0,.18)'; x.beginPath(); x.ellipse(dx, dy + 4, 60, 12, 0, 0, 7); x.fill(); x.fillStyle = '#6a4a2a'; x.beginPath(); x.ellipse(dx, dy - 50, 58, 54, 0, 0, 7); x.fill(); x.fillStyle = '#7d5a34'; x.beginPath(); x.ellipse(dx - 14, dy - 66, 26, 18, -.4, 0, 7); x.fill();
          x.strokeStyle = '#1a120c'; x.lineWidth = 5; x.lineCap = 'round'; for (const d of [-1, 1]) { x.beginPath(); x.arc(dx + d * 18, dy - 60, 6, 0, 7); x.stroke(); } x.beginPath(); x.arc(dx, dy - 42, 18, .3, Math.PI - .3); x.stroke(); } }); },
    // Hoa Lư: limestone karst towers rising from rice paddies and a slow river (the old capital, hemmed in by mountains)
    'hoa-lu'(x, t, o) { const L = o.L;
      L(.05, () => { sky(x, '#a9cfe0', '#f0e2c0'); clouds(x, t, 'rgba(255,255,255,.75)', 220); });
      const karst = (seed, base, hmin, hmax, col, n) => { const R = rgen(seed); for (let k = 0; k < n; k++) { const a = -900 + k * (3400 / n) + R() * 120, w = 160 + R() * 160, h = hmin + R() * (hmax - hmin);
        x.fillStyle = col; x.beginPath(); x.moveTo(a - w * .6, base); x.bezierCurveTo(a - w * .65, base - h * .7, a - w * .4, base - h, a, base - h); x.bezierCurveTo(a + w * .4, base - h, a + w * .65, base - h * .7, a + w * .6, base); x.fill();
        x.fillStyle = 'rgba(40,70,40,.35)'; x.beginPath(); x.ellipse(a - w * .15, base - h * .8, w * .2, h * .08, -.3, 0, 7); x.fill(); } };
      L(.2, () => { karst(3, 1150, 380, 640, '#8fa79a', 9); haze(x, '#e6e8dc', .3); });
      L(.45, () => karst(7, 1250, 300, 560, '#5f7f62', 8));
      L(.75, () => { water(x, 1250, 1420, t, .15, .3); x.strokeStyle = 'rgba(120,160,90,.6)'; x.lineWidth = 4; for (let i = -1200; i < WW + 1200; i += 60) { x.beginPath(); x.moveTo(i, 1380); x.lineTo(i + 8, 1350); x.stroke(); } });
      L(1, () => { rr(x, -1200, 1400, WW + 2400, 1600, 0, '#7f9a52'); grass(x, 1420, t, o, '#5f8a3a', -600, WW + 600, 50, 30); }); },
    // Hội An (Faifo) 17th c.: far bank of wooden shophouses with dark tile roofs and lanterns, the covered Japanese bridge (Chùa Cầu),
    // the Thu Bồn river with trading junks, a near-bank wooden wharf with jars and silk bales.
    // o.thuyen: n junks (0–4, default 3) · o.boi: 0–1 silting (sandbars rise, water shrinks, ships gone) · o.mau: 'dem' (lanterns glow) · o.cau: false hides the bridge
    'hoi-an'(x, t, o) { const L = o.L, dem = o.mau === 'dem', boi = clamp(o.boi || 0), nt = Math.round((o.thuyen ?? 3) * (1 - boi));
      const lantern = (a, b, s, col) => { const sw = Math.sin(t * 1.7 + a * .01) * .08; x.save(); x.translate(a, b); x.rotate(sw); x.strokeStyle = '#3a2a1c'; x.lineWidth = 3 * s; x.beginPath(); x.moveTo(0, -30 * s); x.lineTo(0, 0); x.stroke();
        if (dem) { const g = x.createRadialGradient(0, 30 * s, 4, 0, 30 * s, 110 * s); g.addColorStop(0, 'rgba(255,190,90,.45)'); g.addColorStop(1, 'rgba(255,190,90,0)'); x.fillStyle = g; x.fillRect(-120 * s, -80 * s, 240 * s, 240 * s); }
        x.fillStyle = dem ? mix(col, '#ffe0a0', .35) : col; x.beginPath(); x.ellipse(0, 30 * s, 22 * s, 30 * s, 0, 0, 7); x.fill(); rr(x, -12 * s, -2 * s, 24 * s, 6 * s, 2, '#d9a43a'); rr(x, -12 * s, 58 * s, 24 * s, 6 * s, 2, '#d9a43a');
        x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 2 * s; x.beginPath(); x.ellipse(0, 30 * s, 10 * s, 30 * s, 0, 0, 7); x.stroke(); x.restore(); };
      const roof = (a, b, w, col) => { poly(x, [[a - w / 2 - 30, b], [a - w / 2 + 20, b - 70], [a + w / 2 - 20, b - 70], [a + w / 2 + 30, b]], col);
        x.strokeStyle = 'rgba(0,0,0,.22)'; x.lineWidth = 4; for (let i = a - w / 2; i < a + w / 2; i += 18) { x.beginPath(); x.moveTo(i, b - 66); x.lineTo(i - 8, b - 2); x.stroke(); } rr(x, a - w / 2 + 14, b - 78, w - 28, 12, 5, mix(col, '#000000', .2)); };
      L(.05, () => { sky(x, dem ? '#0c1630' : '#9ccbe0', dem ? '#3a2a44' : '#f6e2b4'); clouds(x, t, dem ? 'rgba(70,70,110,.5)' : 'rgba(255,255,255,.8)', 200);
        if (dem) { x.fillStyle = '#fff3d0'; x.beginPath(); x.arc(320, 340, 54, 0, 7); x.fill(); const R = rgen(9); for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(255,255,240,${.3 + .5 * Math.abs(Math.sin(t + k))})`; x.fillRect(R() * 2400 - 400, R() * 650 - 150, 3, 3); } } });
      L(.15, () => { hills(x, 980, 120, dem ? '#1c2634' : '#8fae9a', 11); haze(x, dem ? '#2a2a44' : '#efe4c8', .3); });
      L(.4, () => { const wall = dem ? ['#4a3a2c', '#3e3226', '#54402e'] : ['#b88a58', '#a87a4a', '#c79a62'], rf = dem ? '#2a2020' : '#5a3a2e';   // far bank: shophouses
        for (let k = -6; k < 14; k++) { const a = k * 200 + 40, w = 180, h = 150 + (k * 37 % 3) * 30, b = 1080; if (o.cau !== false && a > 560 && a < 1040) continue;
          rr(x, a - w / 2, b - h, w, h, 3, wall[(k + 60) % 3]); rr(x, a - 50, b - 90, 100, 90, 3, dem ? '#2a1c12' : '#5a3a24');
          rr(x, a - 46, b - h + 20, 92, 40, 3, dem ? mix('#7a5a2a', '#f2c36a', .6 + .2 * Math.sin(t * 9 + k)) : '#6a4a2e');
          for (let q = -1; q <= 1; q++) rr(x, a + q * 30 - 3, b - h + 20, 6, 40, 1, dem ? '#3a2a1c' : '#8a6a44'); roof(a, b - h, w, rf);
          if ((k + 30) % 3 === 0) lantern(a - 70, b - h + 14, .8, '#d23b2e'); }   // only a few lanterns (the lantern-lined street is modern)
        if (o.cau !== false) { const gx = 800, b = 1080;                                   // Chùa Cầu: arched covered bridge with a little tiled roof
          x.strokeStyle = dem ? '#3a2a20' : '#7a4a2e'; x.lineWidth = 26; x.beginPath(); x.moveTo(gx - 170, b); x.quadraticCurveTo(gx, b - 60, gx + 170, b); x.stroke();
          for (const c of [-150, -90, -30, 30, 90, 150]) rr(x, gx + c - 6, b - 140 + Math.abs(c) * .25, 12, 110 - Math.abs(c) * .25, 2, dem ? '#5a2a1e' : '#a8402a');
          rr(x, gx - 165, b - 70 + 8, 330, 10, 3, dem ? '#3a2a20' : '#7a4a2e');
          poly(x, [[gx - 200, b - 120], [gx - 150, b - 175], [gx + 150, b - 175], [gx + 200, b - 120]], rf); rr(x, gx - 160, b - 186, 320, 14, 6, mix(rf, '#000000', .2));
          for (const d of [-1, 1]) { x.strokeStyle = rf; x.lineWidth = 10; x.lineCap = 'round'; x.beginPath(); x.moveTo(gx + d * 160, b - 182); x.quadraticCurveTo(gx + d * 185, b - 186, gx + d * 192, b - 210); x.stroke(); }
          poly(x, [[gx + 40, b - 175], [gx + 80, b - 230], [gx + 180, b - 230], [gx + 210, b - 175]], rf);
          lantern(gx - 60, b - 120, .7, '#d23b2e'); lantern(gx + 60, b - 120, .7, '#d23b2e'); }
        rr(x, -1200, 1078, WW + 2400, 26, 4, dem ? '#2e2a26' : '#8a7a62'); });
      L(.62, () => { water(x, 1110, 1390, t, .35 + boi * .3, .35);                         // the Thu Bồn — silting turns it into sandbars
        if (boi > 0) { x.fillStyle = mix('#c9a86a', '#d9c08a', .5); x.globalAlpha = clamp(boi * 1.6);
          for (const [cx, cy, w] of [[200, 1250, 520], [900, 1180, 640], [1450, 1300, 560], [-500, 1200, 600], [2100, 1220, 560]]) { x.beginPath(); x.ellipse(cx, cy, w * (.4 + boi * .8), 26 + boi * 70, 0, 0, 7); x.fill(); }
          x.globalAlpha = clamp(boi * 1.2 - .3); grass(x, 1240, t, o, '#7a9a4a', -400, 2000, 70, 22 * boi); x.globalAlpha = 1; }
        for (let k = 0; k < nt; k++) { const bx = [-80, 640, 1260, 300][k], sc = [1, .78, .9, .62][k], X0 = bx + Math.sin(t * .5 + k) * 10 + (o.u || 0) * 50 * (k % 2 ? -1 : 1), Y0 = 1300 - (1 - sc) * 160 + Math.sin(t * 1.3 + k * 2) * 4;
          x.save(); x.translate(X0, Y0); x.scale(sc * (k % 2 ? -1 : 1), sc);                 // trading junk: curved hull, high stern, batten sails
          poly(x, [[-280, -50], [-240, 20], [230, 20], [300, -70], [250, -40], [-200, -40]], dem ? '#2a1c14' : '#5a3a22'); rr(x, -250, -54, 520, 14, 5, dem ? '#4a3020' : '#8a5a2e');
          rr(x, 160, -120, 120, 70, 6, dem ? '#3a2418' : '#7a4a2a'); x.fillStyle = '#f2efe6'; x.beginPath(); x.arc(-230, -18, 10, 0, 7); x.fill(); x.fillStyle = '#1a120c'; x.beginPath(); x.arc(-230, -18, 5, 0, 7); x.fill();
          for (const [mx, mh, mw, sc2] of [[-40, 380, 200, k % 2 ? '#c46a3a' : '#d9b07a'], [140, 280, 150, '#c9925a']]) { rr(x, mx - 5, -40 - mh, 10, mh, 2, '#3a2a1c');
            const top = -40 - mh + 20, bot = -80, sw = Math.sin(t * .9 + k) * 6; x.fillStyle = dem ? mix(sc2, '#1a1a2a', .55) : sc2; x.beginPath(); x.moveTo(mx + 6, top); x.lineTo(mx + mw + sw, top + 20); x.lineTo(mx + mw * 1.05 + sw, bot); x.lineTo(mx + 6, bot); x.fill();
            x.strokeStyle = 'rgba(60,30,10,.5)'; x.lineWidth = 4; for (let q = 1; q < 6; q++) { const yy = lerp(top, bot, q / 6); x.beginPath(); x.moveTo(mx + 6, yy); x.lineTo(mx + mw * (1 + q * .01) + sw, yy + 6); x.stroke(); } }
          if (k === 0) { rr(x, -42, -470, 4, 50, 1, '#3a2a1c'); x.fillStyle = '#c46a3a'; x.beginPath(); x.moveTo(-38, -470); for (let q = 0; q <= 5; q++) x.lineTo(-38 + q * 13, -468 + Math.sin(t * 5 + q) * 4); x.lineTo(30, -446); x.lineTo(-38, -436); x.fill(); }   // plain pennant (no national flags — none existed in 1620)
          x.restore(); } });
      L(1, () => { rr(x, -1200, 1400, WW + 2400, 1600, 0, dem ? '#2a2420' : '#8a7458'); rr(x, -1200, 1386, WW + 2400, 26, 4, dem ? '#3a2e24' : '#a07e56');   // wooden wharf
        x.strokeStyle = 'rgba(40,25,10,.3)'; x.lineWidth = 4; for (let i = -1200; i < WW + 1200; i += 70) { x.beginPath(); x.moveTo(i, 1412); x.lineTo(i - 40, 3000); x.stroke(); }
        for (let i = -1200; i < WW + 1200; i += 260) rr(x, i, 1360, 22, 60, 4, dem ? '#2a1c12' : '#5a3a24');
        for (const [jx, k] of [[-40, 0], [40, 1], [1500, 2], [1580, 3]]) { const c = ['#8a4a2a', '#5a6a7a', '#7a5a3a', '#6a4a8a'][k]; x.fillStyle = 'rgba(0,0,0,.18)'; x.beginPath(); x.ellipse(jx, 1482, 46, 10, 0, 0, 7); x.fill();   // ceramic jars & silk bales
          if (k % 2) { rr(x, jx - 50, 1400, 100, 80, 10, dem ? mix(c, '#000', .5) : c); x.strokeStyle = 'rgba(255,255,255,.3)'; x.lineWidth = 4; x.beginPath(); x.moveTo(jx - 50, 1440); x.lineTo(jx + 50, 1440); x.stroke(); }
          else { x.fillStyle = dem ? mix(c, '#000', .5) : c; x.beginPath(); x.ellipse(jx, 1440, 40, 46, 0, 0, 7); x.fill(); rr(x, jx - 20, 1388, 40, 14, 5, mix(c, '#000', .3)); } }
        lantern(-200, 1180, 1.1, '#d23b2e'); rr(x, -206, 1150, 12, 330, 3, '#3a2a1c'); lantern(1800, 1180, 1.1, '#e8a21e'); rr(x, 1794, 1150, 12, 330, 3, '#3a2a1c'); }); },
    // insert: a sheet of paper — what you wrote (Quốc ngữ) next to what people wrote in 1010 (chữ Hán). o.chu1, o.chu2, o.nhan1, o.nhan2
    'giay'(x, t, o) { rr(x, -1200, -1200, WW + 2400, 5200, 0, '#5a4636'); const p = spring((o.u || 0) * (o.D || 3) - .1);
      x.save(); x.translate(800, 1180); x.rotate(-.03); x.scale(.9 + .1 * clamp(p), .9 + .1 * clamp(p)); rr(x, -520, -420, 1040, 840, 12, '#efe3c4'); for (let y = -360; y < 400; y += 70) { x.fillStyle = 'rgba(150,120,80,.15)'; x.fillRect(-480, y, 960, 3); }
      txt(x, o.nhan1 || 'BẠN VIẾT', -250, -320, 44, '#8a5a34', 'center', 600); txt(x, o.nhan2 || 'NĂM 1010', 250, -320, 44, '#8a5a34', 'center', 600);
      x.fillStyle = 'rgba(138,90,52,.4)'; x.fillRect(-2, -360, 4, 720);
      txt(x, o.chu1 || 'HÀ NỘI', -250, -40, 130, '#1d1d22', 'center', 700, 'BVP', 440); const q = clamp((o.u || 0) * 2.2 - .5);
      x.globalAlpha = q; txt(x, o.chu2 || '昇龍', 250, -40, 210, '#1d1d22', 'center', 400, '"Microsoft YaHei","SimSun",serif', 440); x.globalAlpha = 1;
      if (o.gach !== false && (o.u || 0) > .6) { x.strokeStyle = '#d23b3b'; x.lineWidth = 12; x.lineCap = 'round'; const k = clamp(((o.u || 0) - .6) / .25); x.beginPath(); x.moveTo(-420, 120); x.lineTo(lerp(-420, -80, k), lerp(120, -200, k)); x.stroke(); txt(x, '?', -250, 200, 120, '#d23b3b', 'center', 700); }
      x.restore(); },
    // deep space: twinkling star layers + faint nebula. Options:
    // o.trai_dat: Earth (o.quay 0–1 spin speed, 0 = stopped; o.nhan_quay label on the rotation arrow) · o.ho_den: 'nho' | 'lon' black hole with accretion disk
    // o.soi_mi: 0–1 a person stretched into a noodle falling toward the hole · o.mo: 0–1 the faint red ghost of someone frozen at the horizon
    // o.tram: a space station · o.anh_eht: an orange ring in the style of the 2019 EHT image (labelled MINH HOẠ)
    'vu-tru'(x, t, o) { const L = o.L;
      L(.02, () => { rr(x, -1600, -1600, WW + 3200, 5600, 0, '#05060f'); const g = x.createRadialGradient(300, 500, 50, 300, 500, 900); g.addColorStop(0, 'rgba(90,60,160,.25)'); g.addColorStop(1, 'rgba(90,60,160,0)'); x.fillStyle = g; x.fillRect(-800, -400, 2400, 2000);
        const g2 = x.createRadialGradient(1300, 1300, 50, 1300, 1300, 800); g2.addColorStop(0, 'rgba(40,120,170,.2)'); g2.addColorStop(1, 'rgba(40,120,170,0)'); x.fillStyle = g2; x.fillRect(400, 500, 1800, 1700);
        const R = rgen(31); for (let k = 0; k < 220; k++) { const a = R() * (WW + 2400) - 1200, b = R() * 3200 - 900, s0 = R() < .1 ? 4 : 2; x.fillStyle = `rgba(255,255,255,${.25 + .6 * Math.abs(Math.sin(t * (.5 + R() * 2) + k))})`; x.fillRect(a, b, s0, s0); } });
      L(.15, () => { const R = rgen(7); for (let k = 0; k < 60; k++) { x.fillStyle = 'rgba(220,230,255,.8)'; x.beginPath(); x.arc(R() * (WW + 2400) - 1200, R() * 3200 - 900, 2.5, 0, 7); x.fill(); } });
      if (o.tram) L(.35, () => { const sx = 360 + Math.sin(t * .2) * 20, sy = 330 + Math.cos(t * .25) * 10; x.save(); x.translate(sx, sy); x.rotate(-.12 + Math.sin(t * .2) * .03);
        rr(x, -230, -8, 460, 16, 4, '#9aa3ad'); for (const d of [-1, 1]) for (const e of [150, 210]) { rr(x, d * e - 26, -110, 52, 90, 3, '#1f3f7a'); rr(x, d * e - 26, 20, 52, 90, 3, '#1f3f7a'); x.strokeStyle = 'rgba(160,200,255,.5)'; x.lineWidth = 2; x.strokeRect(d * e - 26, -110, 52, 90); x.strokeRect(d * e - 26, 20, 52, 90); }
        rr(x, -70, -40, 140, 80, 30, '#d9dde2'); rr(x, -20, -26, 40, 22, 8, '#ffd76a'); x.fillStyle = `rgba(255,80,80,${.5 + .5 * Math.sin(t * 4)})`; x.beginPath(); x.arc(70, -30, 6, 0, 7); x.fill(); x.restore(); });
      if (o.trai_dat) L(.5, () => { const cx = 800, cy = 760, r = 360, sp = (o.quay ?? 1);
        const gl = x.createRadialGradient(cx, cy, r * .9, cx, cy, r * 1.25); gl.addColorStop(0, 'rgba(110,180,255,.45)'); gl.addColorStop(1, 'rgba(110,180,255,0)'); x.fillStyle = gl; x.beginPath(); x.arc(cx, cy, r * 1.25, 0, 7); x.fill();
        x.save(); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.clip(); x.fillStyle = '#2a6fc0'; x.fillRect(cx - r, cy - r, r * 2, r * 2);
        const off = (t * 60 * sp) % (r * 4); const R = rgen(5), land = []; for (let k = 0; k < 9; k++) land.push([R() * r * 4, cy - r * .8 + R() * r * 1.6, 60 + R() * 120, 40 + R() * 90]);
        for (const [lx, ly, w, h] of land) for (const rep of [-r * 4, 0]) { let px = cx - r * 2 + ((lx + off) % (r * 4)) + rep; const k2 = (px - cx) / r; if (Math.abs(k2) > 1.3) continue;
          x.fillStyle = '#4f9a52'; x.beginPath(); x.ellipse(px, ly, w * Math.max(.2, Math.sqrt(Math.max(0, 1 - k2 * k2))), h, 0, 0, 7); x.fill(); x.fillStyle = 'rgba(220,200,140,.6)'; x.beginPath(); x.ellipse(px + w * .2, ly - h * .2, w * .3, h * .35, 0, 0, 7); x.fill(); }
        x.fillStyle = 'rgba(255,255,255,.55)'; for (let k = 0; k < 7; k++) { const px = cx - r + ((k * 173 + t * 90 * sp) % (r * 2.4)) - r * .2, py = cy - r * .7 + k * r * .22; x.beginPath(); x.ellipse(px, py, 90, 14, 0, 0, 7); x.fill(); }
        const sh = x.createLinearGradient(cx - r * .2, 0, cx + r, 0); sh.addColorStop(0, 'rgba(0,0,20,0)'); sh.addColorStop(1, 'rgba(0,0,20,.7)'); x.fillStyle = sh; x.fillRect(cx - r, cy - r, r * 2, r * 2); x.restore();
        x.setLineDash([16, 14]); x.strokeStyle = 'rgba(255,214,106,.8)'; x.lineWidth = 4; x.beginPath(); x.ellipse(cx, cy, r, r * .12, 0, 0, Math.PI); x.stroke(); x.setLineDash([]);
        if (sp > 0) { x.strokeStyle = '#ffd76a'; x.lineWidth = 10; x.lineCap = 'round'; x.beginPath(); x.ellipse(cx, cy - r * .02, r * 1.18, r * .3, 0, Math.PI * 1.08, Math.PI * 1.92); x.stroke();
          const ax = cx + r * 1.18 * Math.cos(Math.PI * 1.92), ay = cy - r * .02 + r * .3 * Math.sin(Math.PI * 1.92); poly(x, [[ax + 26, ay + 10], [ax - 22, ay - 26], [ax - 18, ay + 22]], '#ffd76a');
          if (o.nhan_quay) txt(x, o.nhan_quay, cx, cy - r * 1.42, 64, '#ffd76a', 'center', 700); } });
      if (o.sao_kim) L(.5, () => { const cx = 800, cy = 760, r = 360, sp = (o.quay ?? 1);   // Venus: cream-yellow cloud globe; o.quay > 0 → reversed (retrograde) spin arrow + o.nhan_quay
        const gl = x.createRadialGradient(cx, cy, r * .9, cx, cy, r * 1.3); gl.addColorStop(0, 'rgba(255,210,130,.45)'); gl.addColorStop(1, 'rgba(255,210,130,0)'); x.fillStyle = gl; x.beginPath(); x.arc(cx, cy, r * 1.3, 0, 7); x.fill();
        x.save(); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.clip(); const g = x.createLinearGradient(0, cy - r, 0, cy + r); g.addColorStop(0, '#f0d8a0'); g.addColorStop(.5, '#e2b56a'); g.addColorStop(1, '#c99050'); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2);
        for (let k = 0; k < 9; k++) { const yy = cy - r * .85 + k * r * .21, off = ((-t * 26 * sp * (1 + (k % 3) * .2)) % (r * 3) + r * 3) % (r * 3); x.fillStyle = k % 2 ? 'rgba(255,240,205,.35)' : 'rgba(170,110,50,.22)';
          for (const rep of [-r * 3, 0, r * 3]) { x.beginPath(); x.ellipse(cx - r * 1.5 + off + rep, yy + Math.sin(k) * 10, r * .9, 18 + (k % 3) * 8, .06 * Math.sin(k * 2), 0, 7); x.fill(); } }
        const sh = x.createLinearGradient(cx - r * .2, 0, cx + r, 0); sh.addColorStop(0, 'rgba(20,6,0,0)'); sh.addColorStop(1, 'rgba(20,6,0,.65)'); x.fillStyle = sh; x.fillRect(cx - r, cy - r, r * 2, r * 2); x.restore();
        if (sp > 0) { x.strokeStyle = '#ffd76a'; x.lineWidth = 10; x.lineCap = 'round'; x.beginPath(); x.ellipse(cx, cy - r * .02, r * 1.18, r * .3, 0, Math.PI * 1.08, Math.PI * 1.92); x.stroke();
          const ax = cx + r * 1.18 * Math.cos(Math.PI * 1.08), ay = cy - r * .02 + r * .3 * Math.sin(Math.PI * 1.08); poly(x, [[ax - 26, ay + 10], [ax + 22, ay - 26], [ax + 18, ay + 22]], '#ffd76a');
          if (o.nhan_quay) txt(x, o.nhan_quay, cx, cy - r * 1.42, 64, '#ffd76a', 'center', 700); } });
      if (o.ho_den || o.anh_eht) L(.5, () => { const cx = 800, cy = 700, r = o.anh_eht ? 230 : o.ho_den === 'lon' ? 300 : 110;
        if (o.anh_eht) { for (let k = 0; k < 14; k++) { x.strokeStyle = `rgba(255,${150 + k * 6},60,${.07 + k * .015})`; x.lineWidth = 120 - k * 7; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke(); }
          x.fillStyle = 'rgba(255,220,140,.5)'; x.beginPath(); x.ellipse(cx + 40, cy + r * .85, 140, 50, 0, 0, 7); x.fill(); x.fillStyle = '#05060f'; x.beginPath(); x.arc(cx, cy, r * .62, 0, 7); x.fill(); txt(x, 'MINH HOẠ', cx, cy - r * 1.55, 36, 'rgba(255,255,255,.6)', 'center', 500); return; }
        const lens = x.createRadialGradient(cx, cy, r, cx, cy, r * 3.2); lens.addColorStop(0, 'rgba(255,190,110,.35)'); lens.addColorStop(1, 'rgba(255,190,110,0)'); x.fillStyle = lens; x.beginPath(); x.arc(cx, cy, r * 3.2, 0, 7); x.fill();
        const disk = (from, to) => { for (let k = 0; k < 8; k++) { const rr2 = r * (1.5 + k * .28); x.strokeStyle = `rgba(255,${120 + k * 14},${40 + k * 8},${.75 - k * .07})`; x.lineWidth = r * .16; x.beginPath(); x.ellipse(cx, cy, rr2, rr2 * .22, -.12, from, to); x.stroke(); }
          x.strokeStyle = 'rgba(255,245,210,.6)'; x.lineWidth = 3; for (let k = 0; k < 10; k++) { const a0 = (t * (1.2 - k * .05) + k * .7) % (Math.PI * 2), rr2 = r * (1.6 + (k % 5) * .4); if ((a0 > from && a0 < to) || (a0 + Math.PI * 2 > from && a0 + Math.PI * 2 < to)) { x.beginPath(); x.ellipse(cx, cy, rr2, rr2 * .22, -.12, a0, a0 + .5); x.stroke(); } } };
        disk(Math.PI, Math.PI * 2);
        x.strokeStyle = 'rgba(255,230,170,.9)'; x.lineWidth = r * .08; x.beginPath(); x.arc(cx, cy, r * 1.08, 0, 7); x.stroke(); x.fillStyle = '#000'; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
        disk(0, Math.PI);
        if (o.mo) { const m = clamp(o.mo); x.save(); x.globalAlpha = .9 * m * (.6 + .4 * Math.sin(t * .8)); x.fillStyle = '#d9452f'; x.beginPath(); x.ellipse(cx + r * 1.25, cy - r * .55, 18, 30, .4, 0, 7); x.fill(); x.fillStyle = '#8a2a20'; x.beginPath(); x.arc(cx + r * 1.22, cy - r * .8, 16, 0, 7); x.fill(); x.restore(); }
        if (o.soi_mi) { const s0 = clamp(o.soi_mi), ln = 160 + s0 * 760, ang = -.9, wob = Math.sin(t * 3) * .04; x.save(); x.translate(cx + r * 1.1, cy - r * .9); x.rotate(ang + wob);   // the noodle: feet nearest the hole
          const w0 = 46 * (1 - s0 * .65); rr(x, -w0 * .4, 0, w0 * .8, ln * .38, w0 * .4, '#3a4a6a'); rr(x, -w0 * .55, -ln * .36, w0 * 1.1, ln * .4, w0 * .5, '#d9452f');
          x.fillStyle = '#121014'; x.beginPath(); x.ellipse(0, -ln * .36 - 34 * (1 + s0), 38 * (1 - s0 * .5), 40 * (1 + s0 * 1.4), 0, 0, 7); x.fill();
          x.fillStyle = 'rgba(180,220,255,.25)'; x.strokeStyle = 'rgba(220,240,255,.7)'; x.lineWidth = 3; x.beginPath(); x.ellipse(0, -ln * .36 - 34 * (1 + s0), 56 * (1 - s0 * .4), 58 * (1 + s0 * 1.2), 0, 0, 7); x.fill(); x.stroke(); x.restore(); } }); },
    // insert: a big red button on a pedestal with a label plate, pulsing glow (o.chu label, o.bam: 0–1 moment it gets pressed)
    'nut-do'(x, t, o) { rr(x, -1200, -1200, WW + 2400, 5200, 0, '#2a2733'); for (let i = -1200; i < WW + 1200; i += 120) { x.fillStyle = 'rgba(255,214,58,.18)'; x.save(); x.translate(i, 1560); x.rotate(-.6); x.fillRect(0, 0, 50, 400); x.restore(); }
      const pr = o.bam != null && (o.u || 0) > o.bam ? 1 : 0, glow = .5 + .5 * Math.sin(t * 5);
      const g = x.createRadialGradient(800, 1080, 30, 800, 1080, 520); g.addColorStop(0, `rgba(255,60,60,${.25 + .2 * glow})`); g.addColorStop(1, 'rgba(255,60,60,0)'); x.fillStyle = g; x.fillRect(200, 500, 1200, 1200);
      rr(x, 560, 1180, 480, 300, 20, '#4a4a55'); rr(x, 520, 1150, 560, 60, 16, '#5c5c68'); rr(x, 610, 1270, 380, 110, 10, '#d9d4c8'); txt(x, o.chu || 'DỪNG TRÁI ĐẤT', 800, 1305, 46, '#1d1d22', 'center', 700, 'OSW', 360); txt(x, o.chu2 || '1 GIÂY', 800, 1355, 36, '#c8321f', 'center', 700, 'OSW', 360);
      x.fillStyle = '#8a1a1a'; x.beginPath(); x.ellipse(800, 1150, 190, 50, 0, 0, 7); x.fill(); const top = 1150 - (pr ? 40 : 120); x.fillStyle = '#e5383b'; x.beginPath(); x.ellipse(800, 1150, 170, 44, 0, 0, Math.PI); x.lineTo(630, top); x.ellipse(800, top, 170, 60, 0, Math.PI, 0); x.closePath(); x.fill();
      x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.ellipse(740, top - 10, 60, 18, -.2, 0, 7); x.fill(); },
    // insert: a lottery ticket being checked number by number against the result row; matches turn green one after another, then a stamp
    // o.so: [6 numbers] · o.ket: [6 result numbers] (default = o.so) · o.dau: 0–1 when matching starts · o.dong_dau: text of the stamp (false = none)
    've-so'(x, t, o) { rr(x, -1200, -1200, WW + 2400, 5200, 0, '#3a2e26'); const u = o.u || 0, so = o.so || ['05', '12', '23', '31', '40', '52'], ket = o.ket || so, st = o.dau ?? .1;
      x.save(); x.translate(800, 1120); x.rotate(-.04); rr(x, -520, -470, 1040, 900, 18, '#fbf3df'); rr(x, -520, -470, 1040, 120, 18, '#d23b3b'); txt(x, o.chu || 'XỔ SỐ TỰ CHỌN 6/55', 0, -410, 54, '#fff', 'center', 700, 'OSW', 900);
      txt(x, 'VÉ CỦA BẠN', -420, -270, 34, '#8a5a34', 'left', 600); txt(x, 'KẾT QUẢ', -420, 30, 34, '#8a5a34', 'left', 600);
      so.forEach((n, i) => { const cx = -375 + i * 150, hit = String(n) === String(ket[i]) && u > st + i * .1; x.fillStyle = hit ? '#3f8f4e' : '#ffffff'; x.strokeStyle = hit ? '#2a6a36' : '#c9b38a'; x.lineWidth = 6;
        x.beginPath(); x.arc(cx, -170, 58, 0, 7); x.fill(); x.stroke(); txt(x, String(n), cx, -168, 60, hit ? '#fff' : '#1d1d22', 'center', 700);
        x.fillStyle = '#f2c23a'; x.beginPath(); x.arc(cx, 130, 58, 0, 7); x.fill(); txt(x, String(ket[i]), cx, 132, 60, '#1d1d22', 'center', 700); });
      const sp = spring((u - st - .62) * (o.D || 3), 10, 220); if (o.dong_dau !== false && sp > 0) { x.save(); x.translate(160, 320); x.rotate(-.18); x.scale(sp, sp); x.strokeStyle = '#d23b3b'; x.lineWidth = 12; x.strokeRect(-330, -70, 660, 140);
        txt(x, o.dong_dau || 'TRÚNG ĐỘC ĐẮC', 0, 4, 84, '#d23b3b', 'center', 700, 'OSW', 620); x.restore(); }
      x.restore(); },
    // insert: a phone filling the frame, notifications stacking in one by one with a vibration shake. o.tin: ["Tên|Nội dung", …] · o.gio: clock text
    'dien-thoai'(x, t, o) { rr(x, -1200, -1200, WW + 2400, 5200, 0, '#20222e'); const u = o.u || 0, tin = o.tin || [], sh = Math.sin(t * 60) * 5 * (Math.sin(t * 2.2) > .3 ? 1 : 0);
      x.save(); x.translate(800 + sh, 1180); rr(x, -380, -780, 760, 1560, 80, '#0d0e12'); rr(x, -350, -750, 700, 1500, 60, '#1b2a44'); const g = x.createLinearGradient(0, -750, 0, 750); g.addColorStop(0, '#2b4c7a'); g.addColorStop(1, '#141c2e'); x.fillStyle = g; x.beginPath(); x.roundRect(-350, -750, 700, 1500, 60); x.fill();
      rr(x, -80, -730, 160, 30, 15, '#0d0e12'); txt(x, o.gio || '06:02', 0, -560, 130, '#f4f4f8', 'center', 300, 'OSW');
      tin.forEach((m, i) => { const p = spring(u * (o.D || 3) - .2 - i * ((o.D || 3) * .7 / Math.max(1, tin.length)), 12, 240); if (p <= 0) return; const [ten, nd] = String(m).split('|'), y = -360 + i * 190;
        x.save(); x.translate(0, y); x.scale(.9 + .1 * p, .9 + .1 * p); x.globalAlpha = clamp(p * 1.5); rr(x, -320, -75, 640, 160, 30, 'rgba(245,245,250,.94)'); x.fillStyle = ['#e5383b', '#3f8f4e', '#2f6ac8', '#e0a43a', '#8a4ad0'][i % 5]; x.beginPath(); x.arc(-245, 5, 44, 0, 7); x.fill();
        txt(x, (ten || '?')[0], -245, 7, 46, '#fff', 'center', 700); txt(x, ten || '', -180, -28, 36, '#1d1d22', 'left', 700, 'BVP', 470); txt(x, nd || '', -180, 30, 34, '#4a4a55', 'left', 500, 'BVP', 470); x.restore(); });
      x.restore(); },
    // inside a space-station module: white wall panels, racks, yellow handrails, laptops, cables, drifting objects and a water sphere;
    // o.cua_so: true → round window with Earth turning, day/night sweeping past (o.nhanh: 0–1 speeds it up: 16 sunrises a day)
    // o.thuoc: x (0–1) → a height ruler on the wall (o.cao_them: cm shown as a gold bar above the old mark)
    'tram-trong'(x, t, o) { const L = o.L;
      L(.25, () => { rr(x, -1200, -1200, WW + 2400, 5200, 0, '#d7dde3'); rr(x, -1200, -1200, WW + 2400, 520, 0, '#b9c2cc'); rr(x, -1200, 1400, WW + 2400, 1600, 0, '#aeb7c2');
        for (let i = -6; i < 12; i++) { const a = i * 200; rr(x, a + 8, 540, 184, 820, 14, i % 3 ? '#e6eaee' : '#dfe4ea'); for (let k = 0; k < 3; k++) rr(x, a + 30, 600 + k * 250, 140, 160, 10, ['#c9d1d9', '#eef1f4', '#cfd7de'][(i + k) % 3]);
          if (i % 4 === 1) { rr(x, a + 40, 640, 120, 80, 6, '#2b3442'); rr(x, a + 48, 648, 104, 64, 4, `rgba(80,200,230,${.6 + .2 * Math.sin(t * 2 + i)})`); rr(x, a + 50, 720, 100, 10, 3, '#9aa3ad'); } }
        x.strokeStyle = '#f2c23a'; x.lineWidth = 16; x.lineCap = 'round'; for (const y of [560, 1360]) { x.beginPath(); x.moveTo(-1200, y); x.lineTo(WW + 1200, y); x.stroke(); }
        x.strokeStyle = 'rgba(60,70,90,.35)'; x.lineWidth = 6; for (let k = 0; k < 5; k++) { x.beginPath(); x.moveTo(-1200, 500 + k * 6); for (let xx = -1200; xx < WW + 1200; xx += 120) x.quadraticCurveTo(xx + 60, 470 + k * 6 + Math.sin(k + xx) * 20, xx + 120, 500 + k * 6); x.stroke(); }
        if (o.cua_so) { const cx = 1180, cy = 860, R = 230, sp = .3 + (o.nhanh || 0) * 6;
          x.save(); x.beginPath(); x.arc(cx, cy, R, 0, 7); x.clip(); rr(x, cx - R, cy - R, 2 * R, 2 * R, 0, '#020512');
          const ph = (t * sp) % (Math.PI * 2), ex = cx + 40, ey = cy + R * 1.9, ER = R * 1.75;
          const g = x.createRadialGradient(ex, ey, ER * .2, ex, ey, ER); g.addColorStop(0, '#2f7fc8'); g.addColorStop(1, '#174a8a'); x.fillStyle = g; x.beginPath(); x.arc(ex, ey, ER, 0, 7); x.fill();
          x.fillStyle = 'rgba(95,196,122,.85)'; for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + Math.sin(ph + k * 1.1) * .9; x.beginPath(); x.ellipse(ex + Math.cos(a) * ER * .8, ey + Math.sin(a) * ER * .8, 70, 30, a, 0, 7); x.fill(); }
          const day = .5 + .5 * Math.cos(ph); x.fillStyle = `rgba(4,8,30,${.75 * (1 - day)})`; x.beginPath(); x.arc(ex, ey, ER, 0, 7); x.fill();
          x.strokeStyle = 'rgba(120,200,255,.8)'; x.lineWidth = 8; x.beginPath(); x.arc(ex, ey, ER + 4, 0, 7); x.stroke();
          const sr = Math.max(0, Math.cos(ph - .3)) ** 30; if (sr > .01) { const q = x.createRadialGradient(cx - 120, ey - ER, 5, cx - 120, ey - ER, 260); q.addColorStop(0, `rgba(255,236,190,${sr})`); q.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = q; x.fillRect(cx - R, cy - R, 2 * R, 2 * R); }
          x.restore(); x.strokeStyle = '#8a95a3'; x.lineWidth = 34; x.beginPath(); x.arc(cx, cy, R + 14, 0, 7); x.stroke(); for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; x.fillStyle = '#5a6472'; x.beginPath(); x.arc(cx + Math.cos(a) * (R + 14), cy + Math.sin(a) * (R + 14), 7, 0, 7); x.fill(); } }
        if (o.thuoc != null) { const rx = o.thuoc * WW; rr(x, rx - 28, 640, 56, 840, 6, '#fbf6ea'); for (let k = 0; k <= 16; k++) { const y = 1480 - k * 50; rr(x, rx - 28, y - 2, k % 2 ? 22 : 40, 4, 1, '#3a3a40'); }
          const old = 1480 - 560; rr(x, rx - 50, old - 4, 100, 8, 3, '#2f6ac8'); const add = clamp((o.u || 0) * 1.6 - .2) * (o.cao_them || 5) * 10; rr(x, rx - 22, old - add, 44, add, 4, 'rgba(242,194,58,.9)'); }
      });
      L(.6, () => { const R = rgen(5);                                                 // drifting objects (zero-g)
        for (let k = 0; k < 7; k++) { const bx = R() * WW, by = 640 + R() * 600, ph = R() * 6, xx = bx + Math.sin(t * .3 + ph) * 60, yy = by + Math.sin(t * .45 + ph * 2) * 40; x.save(); x.translate(xx, yy); x.rotate(t * (.2 + R() * .3) + ph);
          if (k % 3 === 0) { const q = x.createRadialGradient(-6, -8, 2, 0, 0, 26); q.addColorStop(0, 'rgba(255,255,255,.95)'); q.addColorStop(1, 'rgba(120,200,240,.55)'); x.fillStyle = q; x.beginPath(); x.ellipse(0, 0, 26 + Math.sin(t * 3 + k) * 2, 26 - Math.sin(t * 3 + k) * 2, 0, 0, 7); x.fill(); }
          else if (k % 3 === 1) { rr(x, -26, -34, 52, 68, 10, '#e8e2d6'); rr(x, -26, -34, 52, 18, 8, '#e0a43a'); }
          else { rr(x, -40, -5, 80, 10, 5, '#2f6ac8'); } x.restore(); } }); },
    // Venus surface: murky orange overcast sky, cloud bands racing overhead (super-rotation), a faint diffuse glow where the Sun is
    // (o.mat_troi: x 0–1, false = none), volcanic ridges, a flat plain of cracked basalt slabs (as in the Venera 13 photos), heat shimmer.
    // o.venera: x 0–1 → a Venera-style lander (o.tat: true = dead, no light) · o.may: true → cloud level ~50 km: cloud sea, a floating
    // balloon habitat in the distance and a metal deck at G to stand on (HAVOC-style concept)
    'sao-kim'(x, t, o) { const L = o.L, su = WW * (o.mat_troi ?? .7);
      const glow = (cx, cy, r, col, a) => { const g = x.createRadialGradient(cx, cy, 5, cx, cy, r); g.addColorStop(0, MS.u.rgba(col, a)); g.addColorStop(1, MS.u.rgba(col, 0)); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); };
      const puffs = (y, col, sp, seed, s = 1) => { const R = rgen(seed); x.fillStyle = col; x.beginPath(); for (let k = 0; k < 26; k++) { const P = WW + 3200, xx = ((R() * P + t * sp) % P) - 1600, r = (90 + R() * 120) * s; x.ellipse(xx, y + R() * 50, r * 1.6, r * .7, 0, 0, 7); } x.fill(); rr(x, -1600, y + 30 * s, WW + 3200, 3000, 0, col); };
      if (o.may) {
        L(.05, () => { sky(x, '#b8742e', '#f6deb0'); if (o.mat_troi !== false) { glow(su, 360, 640, '#fffbe8', .85); x.fillStyle = '#fffbea'; x.beginPath(); x.arc(su, 360, 64, 0, 7); x.fill(); } });
        L(.25, () => { puffs(1180, '#e2b878', -6, 41, .8); haze(x, '#f0d29a', .25); });
        L(.5, () => { const bx = 820, by = 600 + Math.sin(t * .8) * 14;                      // distant balloon habitat
          x.strokeStyle = 'rgba(80,70,60,.6)'; x.lineWidth = 4; for (const d of [-1, 1]) { x.beginPath(); x.moveTo(bx + d * 150, by + 150); x.lineTo(bx + d * 60, by + 280); x.stroke(); }
          const g = x.createLinearGradient(0, by - 200, 0, by + 200); g.addColorStop(0, '#f4f2ec'); g.addColorStop(1, '#a9a49a'); x.fillStyle = g; x.beginPath(); x.ellipse(bx, by, 300, 190, 0, 0, 7); x.fill();
          x.strokeStyle = 'rgba(120,110,100,.35)'; x.lineWidth = 3; for (let k = -2; k <= 2; k++) { x.beginPath(); x.ellipse(bx, by, Math.abs(k) * 70 + 4, 190, 0, 0, 7); x.stroke(); }
          rr(x, bx - 90, by + 270, 180, 60, 14, '#7c838c'); for (let k = 0; k < 4; k++) rr(x, bx - 70 + k * 40, by + 285, 24, 20, 4, `rgba(255,214,120,${.6 + .3 * Math.sin(t * 2 + k)})`);
          puffs(1320, '#ecc98c', 10, 43, .9); });
        L(1, () => { puffs(1560, '#f4dcaa', 18, 47, 1.2);
          rr(x, -1400, G, WW + 2800, 38, 6, '#8a9098'); rr(x, -1400, G + 38, WW + 2800, 30, 0, '#5c626a');      // deck we stand on
          for (let i = -1400; i < WW + 1400; i += 220) rr(x, i, G - 150, 14, 150, 4, '#6c727a'); rr(x, -1400, G - 160, WW + 2800, 16, 8, '#a3a9b1'); rr(x, -1400, G - 84, WW + 2800, 8, 4, '#8a9098'); });
        return; }
      L(.05, () => { sky(x, '#5a3416', '#e3a656'); if (o.mat_troi !== false) glow(su, 380, 560, '#fff0c0', .45);
        for (let k = 0; k < 9; k++) { const yy = -260 + k * 125, w = 900 + (k % 3) * 300, P = w + 520, off = (t * (60 + k * 14) + k * 377) % P; x.fillStyle = MS.u.rgba(k % 2 ? '#f0c27a' : '#7a4620', .2);
          for (let xx = -1700 - off; xx < WW + 1700; xx += P) { x.beginPath(); x.ellipse(xx + w / 2, yy, w / 2, 34 + (k % 3) * 12, 0, 0, 7); x.fill(); } } });
      L(.2, () => { const R = rgen(17); x.fillStyle = '#a0602e'; x.beginPath(); x.moveTo(-1500, 1600); for (let i = -1500; i <= WW + 1500; i += 90) x.lineTo(i, 1080 - 240 * Math.max(0, Math.sin(i * .0021 + 1.3)) ** 2 - 50 * R()); x.lineTo(WW + 1500, 1600); x.fill();
        poly(x, [[820, 1090], [1090, 820], [1220, 812], [1500, 1090]], '#8e5228'); poly(x, [[1090, 820], [1220, 812], [1190, 860], [1110, 866]], '#6e3e1e');   // shield volcano
        haze(x, '#e0a050', .28); });
      L(.45, () => { rr(x, -1500, 1130, WW + 3000, 1800, 0, '#a8682f'); const R = rgen(19); for (let k = 0; k < 9; k++) { x.fillStyle = 'rgba(110,62,28,.45)'; x.beginPath(); x.ellipse(R() * (WW + 2400) - 1200, 1170 + R() * 120, 200 + R() * 260, 16 + R() * 14, 0, 0, 7); x.fill(); } haze(x, '#e0a050', .12); });
      L(1, () => { const g = x.createLinearGradient(0, 1300, 0, 2100); g.addColorStop(0, '#93582a'); g.addColorStop(1, '#5e3618'); x.fillStyle = g; x.fillRect(-1500, 1300, WW + 3000, 1800);
        const R = rgen(23), sl = []; for (let k = 0; k < 34; k++) sl.push([R() * (WW + 2800) - 1400, 1320 + R() * 640, 110 + R() * 230, 16 + R() * 26, R()]); sl.sort((a, b) => a[1] - b[1]);
        for (const [cx, cy, w, h, q] of sl) { const s = .6 + (cy - 1320) / 900; poly(x, [[cx - w * s, cy], [cx - w * s * .8, cy - h * s], [cx + w * s * .85, cy - h * s * 1.1], [cx + w * s, cy]], mix('#8a5228', '#a8703a', q));
          x.strokeStyle = 'rgba(255,205,140,.35)'; x.lineWidth = 3; x.beginPath(); x.moveTo(cx - w * s * .8, cy - h * s); x.lineTo(cx + w * s * .85, cy - h * s * 1.1); x.stroke();
          x.strokeStyle = 'rgba(50,25,10,.4)'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(cx - w * s * .2, cy - h * s); x.lineTo(cx - w * s * .05, cy); x.moveTo(cx + w * s * .4, cy - h * s * 1.05); x.lineTo(cx + w * s * .5, cy); x.stroke(); }
        if (o.venera != null) { x.save(); x.translate(o.venera * WW, 1478);                    // Venera-style lander: landing ring, sphere, drag disc, antenna
          x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.ellipse(0, 6, 220, 28, 0, 0, 7); x.fill(); x.fillStyle = '#6f7378'; x.beginPath(); x.ellipse(0, -18, 190, 40, 0, 0, 7); x.fill(); x.fillStyle = '#4a4d52'; x.beginPath(); x.ellipse(0, -24, 150, 26, 0, 0, 7); x.fill();
          for (let k = -7; k <= 7; k++) rr(x, k * 24 - 5, -8, 10, 22, 2, '#5a5d62');
          x.strokeStyle = '#8a8e94'; x.lineWidth = 12; x.lineCap = 'round'; for (const d of [-1, 1]) { x.beginPath(); x.moveTo(d * 120, -30); x.lineTo(d * 62, -150); x.stroke(); }
          const sg = x.createRadialGradient(-35, -240, 10, 0, -200, 115); sg.addColorStop(0, '#ece8de'); sg.addColorStop(1, '#8a8580'); x.fillStyle = sg; x.beginPath(); x.arc(0, -200, 108, 0, 7); x.fill();
          rr(x, -110, -212, 220, 18, 6, '#b0aaa0'); for (const d of [-1, 1]) { x.fillStyle = '#2a2a30'; x.beginPath(); x.arc(d * 58, -168, 14, 0, 7); x.fill(); }
          rr(x, -14, -334, 28, 36, 4, '#a9a39a'); x.fillStyle = '#c9c4ba'; x.beginPath(); x.ellipse(0, -336, 200, 30, 0, 0, 7); x.fill(); x.strokeStyle = '#8a857c'; x.lineWidth = 6; x.stroke();
          x.strokeStyle = '#e0dcd2'; x.lineWidth = 6; x.beginPath(); x.moveTo(0, -360); for (let k = 1; k <= 8; k++) x.lineTo(k % 2 ? 14 : -14, -360 - k * 14); x.stroke();
          if (!o.tat) { x.fillStyle = `rgba(90,255,140,${.4 + .6 * (Math.sin(t * 5) > 0)})`; x.beginPath(); x.arc(70, -240, 9, 0, 7); x.fill(); }
          x.fillStyle = 'rgba(255,140,40,.14)'; x.beginPath(); x.arc(0, -200, 108, 0, 7); x.fill(); x.restore(); }
        x.lineCap = 'round'; for (let k = 0; k < 12; k++) { const bx = -200 + k * 170, ph = (t * .35 + k * .37) % 1; x.strokeStyle = `rgba(255,225,170,${.09 * Math.sin(ph * Math.PI)})`; x.lineWidth = 26; x.beginPath();   // heat shimmer
          for (let q = 0; q <= 8; q++) { const yy = 1440 - ph * 700 - q * 40, xx = bx + Math.sin(q * .9 + t * 3 + k) * 14; q ? x.lineTo(xx, yy) : x.moveTo(xx, yy); } x.stroke(); } }); },
    // insert: inner Solar System (not to scale) — the Sun on the left, Mercury, Venus, Earth on their orbits with names;
    // o.nhiet: true → temperature tags pop in (o.nhiet_sk = Venus text) · o.chan: true → Venus wrapped in a thick yellow 'blanket', heat trapped inside
    'he-mat-troi'(x, t, o) { const u = o.u || 0, cy = 1080, sx = -170;
      rr(x, -1200, -1200, WW + 2400, 5200, 0, '#05060f'); const R = rgen(33); for (let k = 0; k < 160; k++) { x.fillStyle = `rgba(255,255,255,${.2 + .5 * Math.abs(Math.sin(t * (.4 + R()) + k))})`; x.fillRect(R() * (WW + 1600) - 800, R() * 2600, 3, 3); }
      const sg = x.createRadialGradient(sx, cy, 60, sx, cy, 820); sg.addColorStop(0, 'rgba(255,240,180,1)'); sg.addColorStop(.42, 'rgba(255,190,70,.95)'); sg.addColorStop(.5, 'rgba(255,150,40,.35)'); sg.addColorStop(1, 'rgba(255,120,30,0)'); x.fillStyle = sg; x.beginPath(); x.arc(sx, cy, 820, 0, 7); x.fill();
      const P = [['SAO THUỶ', 520, 30, '#a9a39a', 'Ban ngày ~430°C'], ['SAO KIM', 900, 64, '#e6c27a', o.nhiet_sk || '~464°C ngày lẫn đêm'], ['TRÁI ĐẤT', 1360, 66, '#3a7fd0', 'TB ~15°C']];
      P.forEach(([ten, r, pr, col, nh], i) => { const px = sx + r, a0 = Math.asin(Math.min(1, 640 / r));
        x.strokeStyle = 'rgba(200,210,240,.35)'; x.lineWidth = 3; x.setLineDash([12, 12]); x.beginPath(); x.arc(sx, cy, r, -a0, a0); x.stroke(); x.setLineDash([]);
        if (i === 1 && o.chan) { const pu = 1 + .04 * Math.sin(t * 2.5); const hg = x.createRadialGradient(px, cy, pr * .9, px, cy, pr * 2.3 * pu); hg.addColorStop(0, 'rgba(255,200,90,.75)'); hg.addColorStop(1, 'rgba(255,170,60,0)'); x.fillStyle = hg; x.beginPath(); x.arc(px, cy, pr * 2.3 * pu, 0, 7); x.fill();
          x.strokeStyle = '#e5383b'; x.lineWidth = 6; x.lineCap = 'round'; for (let k = 0; k < 5; k++) { const ph = (t * .6 + k / 5) % 1, ang = k * 1.26 + t * .2, rr0 = pr * (1.1 + .9 * (ph < .5 ? ph * 2 : 2 - ph * 2)); x.globalAlpha = .8; x.beginPath(); x.arc(px, cy, rr0, ang, ang + .5); x.stroke(); } x.globalAlpha = 1;
          x.strokeStyle = '#ffd23a'; x.lineWidth = 5; for (let k = 0; k < 3; k++) { const ph = (t * .8 + k / 3) % 1, yy = cy - 60 + k * 60, x0 = lerp(px - 330, px - pr * 1.4, ph); x.globalAlpha = 1 - ph * .4; x.beginPath(); x.moveTo(x0 - 60, yy); x.lineTo(x0, yy); x.stroke(); poly(x, [[x0 + 14, yy], [x0 - 4, yy - 12], [x0 - 4, yy + 12]], '#ffd23a'); } x.globalAlpha = 1; }
        const g = x.createRadialGradient(px - pr * .35, cy - pr * .35, 2, px, cy, pr); g.addColorStop(0, mix(col, '#ffffff', .45)); g.addColorStop(1, mix(col, '#000000', .25)); x.fillStyle = g; x.beginPath(); x.arc(px, cy, pr, 0, 7); x.fill();
        txt(x, ten, px, cy - pr - 70 - (i === 1 && o.chan ? 60 : 0), 46, i === 1 ? '#ffd36a' : '#e6e8ee', 'center', 700, 'OSW', 360);
        if (o.nhiet) { const p = spring(u * (o.D || 3) - .3 - i * .45, 12, 240); if (p > 0) { x.save(); x.translate(px, cy + pr + 110 + (i === 1 && o.chan ? 60 : 0)); x.scale(p, p); const hot = i === 1; x.font = `700 40px OSW, ${MS.STYLE.font}`; const w = Math.min(420, x.measureText(nh).width + 48);
          rr(x, -w / 2, -36, w, 72, 36, hot ? '#e5383b' : 'rgba(244,239,227,.92)'); txt(x, nh, 0, 2, 40, hot ? '#ffffff' : '#1d1d22', 'center', 700, 'OSW', w - 30); x.restore(); } } });
      txt(x, 'MINH HOẠ · KHÔNG THEO TỈ LỆ', 800, cy + 300, 30, 'rgba(255,255,255,.5)', 'center', 500); },
    // insert: horizontal bar comparison that grows in. o.tieu_de · o.thanh: [{ chu, so, don_vi, mau }] (bars scale to the largest value)
    'so-sanh'(x, t, o) { const u = o.u || 0, B = o.thanh || [], mx = Math.max(1, ...B.map(b => b.so));
      rr(x, -1200, -1200, WW + 2400, 5200, 0, '#14121c'); for (let i = -1200; i < WW + 1200; i += 80) rr(x, i, -1200, 2, 5200, 0, 'rgba(255,255,255,.035)');
      if (o.tieu_de) txt(x, o.tieu_de, 800, 470, 58, '#ffd36a', 'center', 700, 'OSW', 1200);
      B.forEach((b, i) => { const y = 640 + i * 230, p = eo3(clamp((u * (o.D || 3) - .25 - i * .55) / 1.1)), w = 1100 * b.so / mx * p;
        txt(x, b.chu, 250, y - 52, 44, '#e6e8ee', 'left', 600, 'OSW', 1100); rr(x, 250, y - 18, 1100, 76, 14, 'rgba(255,255,255,.08)'); if (w > 4) rr(x, 250, y - 18, w, 76, 14, b.mau || '#3f8f4e');
        if (p > 0) txt(x, Math.round(b.so * p) + ' ' + (b.don_vi || ''), Math.max(250 + w - 20, 520), y + 20, 50, '#ffffff', 'right', 700, 'OSW'); }); },
    // ===== OFFICE-DRAMA SETS ("Chuyện công sở") =====
    // young adult's rented room: back wall, window with city lights (o.mau: 'sang' = morning), fairy lights, posters, desk + laptop (o.laptop_sang), clock (o.dong_ho), bed with mattress top at G-260
    // fruit orchard in blossom: sky, hills, rows of flowering trees, grass with wildflowers.
    // o.ong: n bees buzzing between the flowers (0 = none — the silent orchard) · o.qua: 0–1 fruit on the trees (red apples)
    // o.co_ve: true → farm workers on ladders dabbing flowers with brushes (hand pollination) · o.hoa: false = bare green trees · o.mau: 'xam' = dull grey sky
    'vuon-qua'(x, t, o) { const L = o.L, xam = o.mau === 'xam', nb = o.ong || 0, hoa = o.hoa !== false, qua = o.qua || 0;
      const tr = (a, b, s, seed) => { const sw = wind(o, t, seed) * .03; rr(x, a - 12 * s, b - 170 * s, 24 * s, 174 * s, 5, '#6b4a33');
        x.save(); x.translate(a, b - 160 * s); x.rotate(sw); x.fillStyle = xam ? '#6f8a66' : '#5f9a4f'; x.beginPath(); x.ellipse(0, -70 * s, 130 * s, 100 * s, 0, 0, 7); x.ellipse(-90 * s, -20 * s, 70 * s, 60 * s, 0, 0, 7); x.ellipse(90 * s, -24 * s, 70 * s, 60 * s, 0, 0, 7); x.fill();
          const R = rgen(seed * 7 + 3); if (hoa) for (let k = 0; k < 34; k++) { const px = (R() - .5) * 280 * s, py = -70 * s + (R() - .5) * 170 * s; x.fillStyle = R() < .5 ? '#fbe3ec' : '#ffffff'; for (let p = 0; p < 5; p++) { x.beginPath(); x.arc(px + Math.cos(p * 1.26) * 6 * s, py + Math.sin(p * 1.26) * 6 * s, 5 * s, 0, 7); x.fill(); } x.fillStyle = '#f2c23a'; x.beginPath(); x.arc(px, py, 3 * s, 0, 7); x.fill(); }
          const Q = rgen(seed * 11 + 5); for (let k = 0; k < Math.round(qua * 14); k++) { const px = (Q() - .5) * 250 * s, py = -40 * s + (Q() - .5) * 150 * s; x.fillStyle = '#d23a2e'; x.beginPath(); x.arc(px, py, 14 * s, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.4)'; x.beginPath(); x.arc(px - 4 * s, py - 5 * s, 4 * s, 0, 7); x.fill(); }
          x.restore(); };
      L(.05, () => { sky(x, xam ? '#9aa3a8' : '#7fb8e0', xam ? '#cfd3d2' : '#e4f0e6'); clouds(x, t, xam ? 'rgba(235,235,235,.7)' : 'rgba(255,255,255,.8)', 220); });
      L(.3, () => { hills(x, 980, 200, xam ? '#8f9c8c' : '#88b07e', 6); haze(x, xam ? '#cfd3d2' : '#dcebe0', .3); for (let i = 0; i < 9; i++) tr(-300 + i * 260, 1120, .55, i + 40); });
      L(.6, () => { hills(x, 1180, 60, xam ? '#7d8c74' : '#79a865', 2); for (let i = 0; i < 6; i++) tr(-200 + i * 400, 1300, .85, i + 20);
        if (o.co_ve) for (const [a, b] of [[260, 1300], [1100, 1300]]) { x.strokeStyle = '#a07a4a'; x.lineWidth = 8; x.beginPath(); x.moveTo(a - 40, b); x.lineTo(a - 10, b - 200); x.moveTo(a + 30, b); x.lineTo(a + 40, b - 200); x.stroke(); for (let k = 1; k < 6; k++) { x.beginPath(); x.moveTo(a - 40 + k * 6, b - k * 36); x.lineTo(a + 30 + k * 2, b - k * 36); x.stroke(); }
          const hy = b - 230, arm = Math.sin(t * 6 + a) * .5; rr(x, a - 18, hy, 36, 70, 12, '#3e6fb0'); x.fillStyle = '#e8c39e'; x.beginPath(); x.arc(a, hy - 20, 20, 0, 7); x.fill(); poly(x, [[a - 34, hy - 30], [a, hy - 58], [a + 34, hy - 30]], '#e8d28a');
          x.strokeStyle = '#3e6fb0'; x.lineWidth = 12; x.lineCap = 'round'; x.beginPath(); x.moveTo(a + 10, hy + 10); x.lineTo(a + 40 + Math.cos(-1 + arm) * 40, hy - 20 + Math.sin(-1 + arm) * 40); x.stroke();
          x.strokeStyle = '#7a5a3a'; x.lineWidth = 5; const bx = a + 40 + Math.cos(-1 + arm) * 40, by = hy - 20 + Math.sin(-1 + arm) * 40; x.beginPath(); x.moveTo(bx, by); x.lineTo(bx + 30, by - 30); x.stroke(); x.fillStyle = '#f2c23a'; x.beginPath(); x.arc(bx + 32, by - 32, 7, 0, 7); x.fill(); } });
      L(1, () => { rr(x, -1200, 1320, WW + 2400, 1400, 0, xam ? '#7f8f6a' : '#86b05a'); const R = rgen(9);
        for (let k = 0; k < 40; k++) { const a = -500 + R() * (WW + 1000), b = 1400 + R() * 200; x.fillStyle = ['#ffd84a', '#ffffff', '#e86aa0'][k % 3]; x.beginPath(); x.arc(a, b, 7, 0, 7); x.fill(); }
        grass(x, 1490, t, o, xam ? '#6a7a52' : '#5f8a44', -600, WW + 600, 46, 36);
        for (let k = 0; k < nb; k++) { const ph = k * 2.1, bx = WW * (.1 + .8 * ((k * .37) % 1)) + Math.sin(t * 1.3 + ph) * 160 + Math.sin(t * 3.1 + ph) * 30, by = 900 + ((k * .53) % 1) * 450 + Math.sin(t * 2.2 + ph * 1.7) * 80;
          x.save(); x.translate(bx, by); x.rotate(Math.sin(t * 2 + ph) * .3); x.fillStyle = 'rgba(255,255,255,.75)'; const fl = Math.abs(Math.sin(t * 40 + k)) * 10 + 4; x.beginPath(); x.ellipse(-4, -14, 9, fl, -.4, 0, 7); x.ellipse(6, -14, 9, fl, .4, 0, 7); x.fill();
            rr(x, -16, -10, 32, 22, 11, '#f2b92a'); x.fillStyle = '#2a2420'; x.fillRect(-6, -10, 5, 22); x.fillRect(4, -10, 5, 22); x.beginPath(); x.arc(-17, 0, 7, 0, 7); x.fill(); x.restore(); } }); },
    // fruit stall at a Vietnamese market: striped awning, wooden counter, crates of apples / oranges / watermelons / longans,
    // rice sacks + bread that never need bees. o.vang: 0–1 crates go empty (rice & bread stay) · o.gia: ['TÁO|50K', …] price tags
    // o.tang: 0–1 → prices struck out, new price (×n, o.nhan default 'x5') stamped in red
    'quay-qua'(x, t, o) { const v = o.vang || 0, tg = o.tang || 0;          // compact: everything sits in x 440–1160 so a 9:16 frame keeps it
      rr(x, -1200, -1200, WW + 2400, 5200, 0, '#e8d9bd'); rr(x, -1200, G, WW + 2400, 1400, 0, '#8a7a66');
      for (let i = -6; i < 16; i++) poly(x, [[i * 120, 380], [i * 120 + 120, 380], [i * 120 + 100, 560], [i * 120 - 20, 560]], i % 2 ? '#d9452f' : '#f4efe4');
      for (let i = -6; i < 16; i++) { x.fillStyle = i % 2 ? '#d9452f' : '#f4efe4'; x.beginPath(); x.arc(i * 120 + 40, 560, 60, 0, Math.PI); x.fill(); }
      rr(x, 420, 1080, 760, 400, 16, '#9a6a3e'); rr(x, 420, 1080, 760, 26, 10, '#b98552'); rr(x, 440, 900, 720, 20, 6, '#7a5232');
      const crate = (a, b, col, r, n, e) => { rr(x, a, b, 220, 120, 10, '#c79a62'); rr(x, a, b + 50, 220, 10, 0, '#a77a46'); const R = rgen(a); const k = Math.round(n * (1 - e));
        for (let i = 0; i < k; i++) { const px = a + 26 + (i % 6) * 34 + (Math.floor(i / 6) % 2) * 15, py = b - 8 - Math.floor(i / 6) * (r * 1.3); x.fillStyle = col; x.beginPath(); x.arc(px, py + R() * 5, r, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.arc(px - r * .3, py - r * .3, r * .3, 0, 7); x.fill(); } };
      crate(450, 780, '#d23a2e', 18, 18, v); crate(690, 780, '#f29a2e', 18, 18, clamp(v * 1.1)); crate(930, 780, '#b58a52', 12, 24, v);
      const wk = Math.round(3 * (1 - v)); for (let i = 0; i < wk; i++) { x.fillStyle = '#3f8a3a'; x.beginPath(); x.ellipse(860 + i * 100, 1040, 52, 40, 0, 0, 7); x.fill(); x.strokeStyle = '#2a6a2a'; x.lineWidth = 6; x.beginPath(); x.ellipse(860 + i * 100, 1040, 26, 40, 0, 0, 7); x.stroke(); }
      for (let i = 0; i < 3; i++) { x.fillStyle = '#d9a35a'; x.beginPath(); x.ellipse(500 + i * 80, 1050, 46, 20, -.2, 0, 7); x.fill(); } txt(x, 'BÁNH MÌ', 580, 1130, 30, '#f4efe4');
      rr(x, 720, 960, 110, 120, 24, '#e9dcb8'); txt(x, 'GẠO', 775, 1020, 34, '#7a5a3a');
      (o.gia || []).forEach((g, i) => { const [ten, gia] = String(g).split('|'), a = 560 + i * 240, b = 640; x.save(); x.translate(a, b); x.rotate(Math.sin(i * 2.3 + t * 1.5) * .05);
        x.strokeStyle = '#6a5040'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, -80); x.lineTo(0, -40); x.stroke();
        rr(x, -90, -40, 180, 84, 10, '#fffaf0'); txt(x, ten, 0, -12, 28, '#3a3030'); txt(x, gia, 0, 22, 34, '#3a3030');
        if (tg > 0) { const s = eo3(clamp(tg * 1.4)); x.strokeStyle = '#d9452f'; x.lineWidth = 7; x.beginPath(); x.moveTo(-70, 22); x.lineTo(-70 + 140 * s, 22); x.stroke(); const s2 = eo3(clamp(tg * 1.4 - .4)); if (s2 > 0) { x.globalAlpha = s2; x.rotate(-.18); txt(x, o.nhan || '×5', 50, -62, 54 * (1.5 - .5 * s2), '#d9452f', 'center', 800); x.globalAlpha = 1; } }
        x.restore(); }); },
    // macro close-up of mosquitoes on a soft blurred background. o.con: [{ x, y, s, cai (female: plain antennae, proboscis) | duc (male: bushy antennae), nhan }]
    // default = one big female in the middle. o.mau: 'dem' = night bokeh · o.hoa: true = a flower (males drink nectar)
    'muoi-can'(x, t, o) { const dem = o.mau === 'dem', g = x.createRadialGradient(800, 1000, 100, 800, 1000, 1500); g.addColorStop(0, dem ? '#2c3456' : '#cfe6c4'); g.addColorStop(1, dem ? '#0c0f1e' : '#6f9a68'); x.fillStyle = g; x.fillRect(-1200, -1200, WW + 2400, 5200);
      const R = rgen(3); for (let k = 0; k < 14; k++) { const bx = R() * WW, by = 300 + R() * 1500, r = 40 + R() * 110; x.fillStyle = dem ? `rgba(255,214,140,${.06 + R() * .1})` : `rgba(255,255,255,${.08 + R() * .12})`; x.beginPath(); x.arc(bx + Math.sin(t * .3 + k) * 20, by, r, 0, 7); x.fill(); }
      if (o.hoa) { x.strokeStyle = '#4f7a3a'; x.lineWidth = 16; x.beginPath(); x.moveTo(1150, 1900); x.quadraticCurveTo(1100, 1500, 1160, 1220); x.stroke(); for (let p = 0; p < 7; p++) { x.fillStyle = '#f6d8e6'; x.beginPath(); x.ellipse(1160 + Math.cos(p * .9) * 70, 1180 + Math.sin(p * .9) * 70, 60, 34, p * .9, 0, 7); x.fill(); } x.fillStyle = '#f2c23a'; x.beginPath(); x.arc(1160, 1180, 40, 0, 7); x.fill(); }
      for (const [k, m] of (o.con || [{ x: .5, y: 1000, s: 5, cai: true }]).entries()) { const mx = m.x * WW + Math.sin(t * 1.1 + k) * 18, my = m.y + Math.sin(t * 1.7 + k * 2) * 14;
        x.save(); x.translate(mx, my); x.scale(m.huong || 1, 1); muoiVe(x, m.s || 4, t, k, !m.duc); x.restore();
        if (m.nhan) { const w = 30 * String(m.nhan).length + 60; rr(x, mx - w / 2, my + 30 * (m.s || 4) + 10, w, 84, 16, m.duc ? '#3e6fb0' : '#d9452f'); txt(x, m.nhan, mx, my + 30 * (m.s || 4) + 52, 48, '#ffffff'); } } },
    // stagnant water around a Vietnamese house: water jar (lu), old tyre, flower-pot saucer, a coconut shell; wriggling larvae (o.lang_quang 0–1)
    // o.do: 0–1 → the containers get emptied / the jar lid goes on (prevention) · o.muoi via the generic shot.muoi overlay
    'nuoc-dong'(x, t, o) { const L = o.L, lq = o.lang_quang ?? 1, dk = eo3(clamp(o.do === true ? (o.u || 0) * 1.5 - .2 : (o.do || 0)));   // o.do: true = animate over the shot
      L(.15, () => { rr(x, -1200, -1200, WW + 2400, 5200, 0, '#c9b48e'); rr(x, -1200, 300, WW + 2400, 900, 0, '#e2cf9e'); for (let i = -6; i < 14; i++) rr(x, i * 220, 300, 6, 900, 0, 'rgba(120,90,50,.18)');
        rr(x, 980, 420, 360, 420, 10, '#6e8fb0'); rr(x, 1000, 440, 320, 380, 6, '#a8c8e0'); x.strokeStyle = '#4a5a6a'; x.lineWidth = 12; x.strokeRect(1000, 440, 320, 380); x.beginPath(); x.moveTo(1160, 440); x.lineTo(1160, 820); x.stroke();
        rr(x, 120, 520, 260, 660, 10, '#5a3e2a'); rr(x, 150, 560, 200, 600, 8, '#6e4c34'); rr(x, -1200, 1180, WW + 2400, 40, 0, '#9a8466'); });
      L(1, () => { rr(x, -1200, 1220, WW + 2400, 1600, 0, '#8a8a7e'); for (let i = -1200; i < WW + 1200; i += 200) rr(x, i, 1220, 4, 1600, 0, 'rgba(0,0,0,.1)');
        const wl = (a, b, w, h, lv) => { if (lv <= 0) return; const y = b + h * (1 - lv); x.fillStyle = '#4f6a4a'; x.beginPath(); x.ellipse(a, y, w, Math.max(6, h * .16), 0, 0, 7); x.fill();
          x.strokeStyle = 'rgba(200,230,200,.45)'; x.lineWidth = 3; x.beginPath(); x.ellipse(a + Math.sin(t) * 6, y, w * .7, Math.max(4, h * .1), 0, 0, 7); x.stroke();
          const R = rgen(a); for (let k = 0; k < Math.round(lq * lv * 7); k++) { const px = a + (R() - .5) * w * 1.4, py = y + 4 + R() * 10, ph = t * 9 + k * 2; x.strokeStyle = '#2a2a22'; x.lineWidth = 4; x.lineCap = 'round'; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.sin(ph) * 8, py + 10, px + Math.sin(ph + 1) * 4, py + 22); x.stroke(); } };
        rr(x, 330, 1040, 360, 360, 130, '#8a4e2e'); rr(x, 350, 1060, 320, 40, 20, '#a8623a'); x.fillStyle = '#6e3c22'; x.beginPath(); x.ellipse(510, 1048, 180, 42, 0, 0, 7); x.fill(); wl(510, 1040, 150, 60, 1 - dk);   // water jar
        if (dk > 0) { x.save(); x.translate(510, 1036 - (1 - dk) * 260); x.rotate((1 - dk) * -.5); rr(x, -200, -26, 400, 52, 24, '#c9a06a'); rr(x, -40, -60, 80, 40, 16, '#a87a4a'); x.restore(); }
        x.fillStyle = '#1e1e1e'; x.beginPath(); x.ellipse(1080, 1360, 200, 86, 0, 0, 7); x.fill(); x.fillStyle = '#3a3a3a'; x.beginPath(); x.ellipse(1080, 1342, 115, 40, 0, 0, 7); x.fill(); wl(1080, 1302, 100, 40, (1 - dk) * .9);   // old tyre
        x.save(); x.translate(760, 1560); x.rotate(dk * .9); rr(x, -110, -24, 220, 34, 14, '#b8643a'); x.restore(); if (dk < .5) wl(760, 1520, 90, 30, 1 - dk * 2);   // pot saucer (tipped out)
        x.fillStyle = '#6a4a2a'; x.beginPath(); x.arc(1200, 1560, 64, Math.PI, 0); x.fill(); if (dk < .5) wl(1200, 1500, 50, 40, (1 - dk * 2) * .8);   // coconut shell
        if (dk > .2) { x.globalAlpha = clamp((dk - .2) * 2); x.fillStyle = 'rgba(120,150,180,.5)'; x.beginPath(); x.ellipse(860, 1610, 200, 26, 0, 0, 7); x.ellipse(1240, 1610, 140, 22, 0, 0, 7); x.fill(); x.globalAlpha = 1; } }); },
    'phong-tro'(x, t, o) { const L = o.L, dem = o.mau !== 'sang' && o.mau !== 'binh-minh';
      L(.15, () => { rr(x, -1200, -1200, WW + 2400, 5200, 0, dem ? '#2c2a44' : '#eadbc6');
        const wx = 940, wy = 380, ww = 540, wh = 620, g = x.createLinearGradient(0, wy, 0, wy + wh); g.addColorStop(0, dem ? '#0a1028' : '#bfe0f4'); g.addColorStop(1, dem ? '#2a3562' : '#fde6c4'); x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
        const R = rgen(7); for (let k = 0; k < 9; k++) { const bx = wx + 8 + k * 60, bh = 140 + R() * 320; rr(x, bx, wy + wh - bh, 52, bh, 2, dem ? '#141a34' : '#9fb4c8');
          if (dem) for (let j = 0; j < bh / 36 - 1; j++) if (R() > .42) { const on = Math.sin(t * .35 + k * 7 + j * 3) > -.7; x.fillStyle = on ? 'rgba(255,214,140,.85)' : 'rgba(255,214,140,.12)'; x.fillRect(bx + 8 + (j % 2) * 22, wy + wh - bh + 14 + j * 36, 10, 14); } }
        if (dem) { x.fillStyle = '#fff6d8'; x.beginPath(); x.arc(wx + 430, wy + 96, 36, 0, 7); x.fill(); }
        x.strokeStyle = dem ? '#1c1a2c' : '#8a6a4a'; x.lineWidth = 20; x.strokeRect(wx, wy, ww, wh); x.beginPath(); x.moveTo(wx + ww / 2, wy); x.lineTo(wx + ww / 2, wy + wh); x.stroke();
        x.fillStyle = dem ? '#4a3a5e' : '#d49a88'; poly(x, [[wx - 70, wy - 30], [wx + 60, wy - 30], [wx + 20, wy + wh + 60], [wx - 90, wy + wh + 60]], x.fillStyle); poly(x, [[wx + ww - 60, wy - 30], [wx + ww + 70, wy - 30], [wx + ww + 90, wy + wh + 60], [wx + ww - 20, wy + wh + 60]], x.fillStyle);
        for (let k = 0; k < 24; k++) { const lx = -140 + k * 78, ly = 300 + Math.sin(k * .9) * 24, a = dem ? .5 + .4 * Math.sin(t * 2.2 + k * 1.3) : .25;
          x.fillStyle = `rgba(255,${196 + (k % 3) * 18},120,${a})`; x.beginPath(); x.arc(lx, ly, 10, 0, 7); x.fill(); if (dem) { const q = x.createRadialGradient(lx, ly, 2, lx, ly, 40); q.addColorStop(0, `rgba(255,210,140,${a * .35})`); q.addColorStop(1, 'rgba(255,210,140,0)'); x.fillStyle = q; x.fillRect(lx - 40, ly - 40, 80, 80); } }
        rr(x, 150, 430, 230, 310, 8, dem ? '#46557a' : '#7aa0c8'); rr(x, 175, 460, 180, 120, 6, dem ? '#5d6c90' : '#a8c4e0'); rr(x, 420, 480, 180, 230, 8, dem ? '#7a4a5e' : '#e0a08a'); txt(x, '✿', 510, 590, 90, dem ? '#a87a90' : '#fff3e8', 'center', 400, 'sans-serif');
        rr(x, 1040, 1040, 520, 30, 6, '#6a4a34'); rr(x, 1060, 1070, 20, 410, 4, '#4a3424'); rr(x, 1520, 1070, 20, 410, 4, '#4a3424');                                     // desk (adult height)
        if (o.laptop !== false) { rr(x, 1190, 880, 250, 160, 10, '#2a2a30'); rr(x, 1202, 892, 226, 136, 6, o.laptop_sang ? '#dfe9ff' : '#3a4664'); rr(x, 1160, 1034, 310, 14, 6, '#3a3a40');
          if (o.laptop_sang) { const q = x.createRadialGradient(1315, 960, 20, 1315, 960, 520); q.addColorStop(0, 'rgba(190,215,255,.35)'); q.addColorStop(1, 'rgba(190,215,255,0)'); x.fillStyle = q; x.fillRect(800, 620, 1030, 1040); } }
        if (o.dong_ho) { rr(x, 1074, 970, 100, 62, 8, '#1b1b1f'); txt(x, String(o.dong_ho), 1124, 1002, 34, '#ff5a4a', 'center', 600, 'OSW'); }
        rr(x, 1460, 950, 60, 90, 10, '#c7a27a'); for (let k = 0; k < 5; k++) { x.fillStyle = '#5f8a54'; x.beginPath(); x.ellipse(1490 + Math.cos(k * 1.3) * 26, 920 - k * 8, 26, 12, k, 0, 7); x.fill(); } });
      L(1, () => { rr(x, -1200, G, WW + 2400, 1400, 0, dem ? '#3a3046' : '#b98a5c'); for (let i = -1200; i < WW + 1200; i += 150) rr(x, i, G, 4, 1400, 0, 'rgba(0,0,0,.12)');
        rr(x, 40, G - 440, 80, 440, 14, '#6a4a34'); rr(x, 100, G - 210, 760, 120, 12, '#7a5a40'); rr(x, 100, G - 268, 760, 70, 22, '#f2ece2');                       // headboard, frame, mattress
        rr(x, 120, G - 312, 190, 70, 32, '#ffffff'); rr(x, 360, G - 286, 500, 90, 34, dem ? '#5a6a9e' : '#8ab0d8'); rr(x, 360, G - 286, 500, 18, 10, 'rgba(255,255,255,.25)');
        rr(x, 130, G - 90, 26, 90, 4, '#4a3424'); rr(x, 810, G - 90, 26, 90, 4, '#4a3424'); }); },
    // open-plan office: windows with sky + skyline (o.mau: ngay | binh-minh | chieu | dem), whiteboard (o.bang: [lines]), digital wall clock (o.dong_ho),
    // a back row of desks with monitors (o.man_hinh: lit screens), plants; o.vang = empty office, lights half off. Foreground desks: o.ban (see FRONT)
    'van-phong'(x, t, o) { const L = o.L, m = o.mau || 'ngay', dem = m === 'dem', vang = !!o.vang;
      const bang = () => { rr(x, 70, 1060, 560, 330, 10, '#f8f8f6'); x.strokeStyle = '#9aa0a8'; x.lineWidth = 8; x.strokeRect(70, 1060, 560, 330); [].concat(o.bang).forEach((s, i) => txt(x, s, 350, 1120 + i * 70, i ? 40 : 46, i ? '#c0392b' : '#1d3d7a', 'center', 600, 'BVP', 520)); };
      const SKY = { ngay: ['#8cc0e6', '#e6f0f4'], 'binh-minh': ['#f4b48a', '#fde2c4'], chieu: ['#e89a6a', '#f8d4a8'], dem: ['#0b1230', '#2a3a68'], 'hoi-tuong': ['#c8b8a0', '#efe4d0'] }[m] || ['#8cc0e6', '#e6f0f4'];
      L(.06, () => { sky(x, SKY[0], SKY[1], 2000); const R = rgen(31); for (let k = 0; k < 16; k++) { const bx = -900 + k * 230 + R() * 60, bh = 300 + R() * 500; rr(x, bx, 1020 - bh, 180, bh + 400, 4, dem ? '#151c38' : mix(SKY[0], '#40506a', .55));
          for (let j = 0; j < 10; j++) if (R() > .5) { x.fillStyle = dem ? 'rgba(255,214,140,.7)' : 'rgba(255,255,255,.35)'; x.fillRect(bx + 20 + (j % 3) * 50, 1060 - bh + j * 40, 26, 16); } }
        if (m === 'binh-minh') { const q = x.createRadialGradient(1300, 900, 20, 1300, 900, 900); q.addColorStop(0, 'rgba(255,220,160,.8)'); q.addColorStop(1, 'rgba(255,220,160,0)'); x.fillStyle = q; x.fillRect(200, 0, 2400, 1800); } });
      L(.22, () => { const wall = dem || vang && m !== 'binh-minh' ? '#3a3d4c' : '#ecebe6'; x.fillStyle = wall; x.beginPath(); x.rect(-1400, -1200, WW + 2800, 5200);
        for (let i = -3; i < 6; i++) x.rect(-80 + i * 420, 280, 360, 760); x.fill('evenodd');                                                                                   // wall with window holes
        for (let i = -3; i < 6; i++) { x.strokeStyle = dem ? '#22252f' : '#c9ccd2'; x.lineWidth = 14; x.strokeRect(-80 + i * 420, 280, 360, 760); x.beginPath(); x.moveTo(100 + i * 420, 280); x.lineTo(100 + i * 420, 1040); x.stroke(); }
        if (m === 'binh-minh') { x.save(); x.globalCompositeOperation = 'lighter'; for (let i = -1; i < 4; i++) { x.fillStyle = 'rgba(255,190,120,.10)'; x.beginPath(); x.moveTo(-80 + i * 420, 1040); x.lineTo(280 + i * 420, 1040); x.lineTo(720 + i * 420, G + 200); x.lineTo(240 + i * 420, G + 200); x.fill(); } x.restore(); }
        if (o.bang && !o.bang_dung) bang();
        if (o.dong_ho) { rr(x, 690, 1080, 200, 84, 12, '#1b1b1f'); txt(x, String(o.dong_ho), 790, 1124, 52, '#ff5a4a', 'center', 600, 'OSW'); } });
      L(.5, () => { for (let i = -2; i < 7; i++) { const cx = -60 + i * 330, top = 1190; rr(x, cx - 140, top, 280, 18, 4, '#9a8a78'); rr(x, cx - 130, top + 18, 260, 150, 4, '#857664');
          rr(x, cx - 70, top - 120, 140, 96, 8, '#2a2c34'); rr(x, cx - 62, top - 112, 124, 80, 5, o.man_hinh && !vang ? (i % 2 ? '#bfe0ff' : '#cfe8d8') : '#3c4252'); rr(x, cx - 8, top - 24, 16, 26, 3, '#2a2c34');
          rr(x, cx - 160, top - 70, 10, 238, 3, '#b8bcc4'); if (i % 3 === 1) { rr(x, cx + 90, top - 60, 50, 60, 8, '#d9b48a'); for (let k = 0; k < 4; k++) { x.fillStyle = '#5c8a50'; x.beginPath(); x.ellipse(cx + 115 + Math.cos(k * 1.6) * 22, top - 74 - k * 10, 24, 11, k, 0, 7); x.fill(); } } }
        if (vang) { x.fillStyle = 'rgba(20,22,34,.25)'; x.fillRect(-1400, -1200, WW + 2800, 5200); } });
      if (o.bang && o.bang_dung) L(1, () => { for (const lx of [130, 570]) { rr(x, lx - 9, 1380, 18, G - 1380, 4, '#8d939c'); rr(x, lx - 60, G - 14, 120, 14, 6, '#6d727a'); } rr(x, 62, 1052, 576, 346, 12, 'rgba(0,0,0,.16)'); bang(); });   // o.bang_dung: standing whiteboard in the near layer, so tam / zoom aim at it exactly
      L(1, () => { rr(x, -1400, G, WW + 2800, 1400, 0, dem ? '#2e3240' : '#6a707e'); x.fillStyle = 'rgba(255,255,255,.04)'; for (let i = -1400; i < WW + 1400; i += 90) x.fillRect(i, G, 3, 1400); }); },
    // insert: a messenger app on a phone filling the frame. o.chat = { ten, tv (members), gio, cu (old 2017 look), ngay (date chip), lo_ten (u: the group name flashes red),
    //   tin: [{ ai, nd, minh }], go: { nd, tu, den } (typed into the input box over u), gui (u: send), xem: [[u, n], …] ("Đã xem n"),
    //   nhap: { ten, tu, den } (typing indicator), thu_hoi (u: long-press → recall), he_thong: [u, text] (system pill), thanh_vien: { tu, ds: [...], noi } }
    'chat'(x, t, o) { const c = o.chat || {}, u = o.u || 0, D = o.D || 3, cu = !!c.cu, PW = 840, PH = 1660, sp = (k, d = 12, s = 240) => spring((u - k) * D, d, s);
      rr(x, -1200, -1200, WW + 2400, 5200, 0, cu ? '#2a2620' : '#15161d'); for (let k = 0; k < 9; k++) { const q = x.createRadialGradient(150 + k * 180, 300 + (k % 3) * 700, 10, 150 + k * 180, 300 + (k % 3) * 700, 260); q.addColorStop(0, `rgba(90,110,180,${.08 + .04 * Math.sin(t + k)})`); q.addColorStop(1, 'rgba(90,110,180,0)'); x.fillStyle = q; x.fillRect(-200, -300, 2000, 2600); }
      x.save(); x.translate(800, 1180); rr(x, -PW / 2 - 26, -PH / 2 - 26, PW + 52, PH + 52, 98, '#0b0c10'); rr(x, -PW / 2, -PH / 2, PW, PH, 78, cu ? '#efe6d2' : '#eef1f6');
      x.save(); x.beginPath(); x.roundRect(-PW / 2, -PH / 2, PW, PH, 78); x.clip();
      txt(x, c.gio || '23:04', -PW / 2 + 74, -PH / 2 + 46, 30, '#1d1d22', 'left', 700, 'BVP'); txt(x, '▮▮▮  ◔', PW / 2 - 70, -PH / 2 + 46, 24, '#1d1d22', 'right', 700, 'sans-serif');
      const HB = -PH / 2 + 84, hot = c.lo_ten != null ? clamp((u - c.lo_ten) / .08) : 0, pul = hot ? .5 + .5 * Math.sin(t * 9) : 0;
      rr(x, -PW / 2, HB, PW, 136, 0, cu ? '#8a8f96' : mix('#2f6ae0', '#d32f2f', hot * (.6 + .4 * pul)));
      txt(x, '‹', -PW / 2 + 40, HB + 66, 64, '#fff', 'center', 400, 'sans-serif'); x.fillStyle = cu ? '#b0a48a' : '#ffd36a'; x.beginPath(); x.arc(-PW / 2 + 118, HB + 68, 44, 0, 7); x.fill(); txt(x, (c.ten || '?')[0], -PW / 2 + 118, HB + 70, 44, '#1d1d22', 'center', 700, 'BVP');
      x.save(); const ns = 1 + hot * .06 * (1 + pul); x.translate(-PW / 2 + 182, HB + 50); x.scale(ns, ns); txt(x, c.ten || '', 0, 0, 38, '#ffffff', 'left', 700, 'BVP', PW - 300); x.restore();
      txt(x, c.tv ? `${c.tv} thành viên` : 'Đang hoạt động', -PW / 2 + 182, HB + 98, 27, hot ? '#ffe2e2' : 'rgba(255,255,255,.85)', 'left', 600, 'BVP');
      if (c.ngay) { rr(x, -130, HB + 160, 260, 50, 25, 'rgba(0,0,0,.12)'); txt(x, c.ngay, 0, HB + 186, 26, '#4a4a55', 'center', 600, 'BVP'); }
      const IT = PH / 2 - 150, typed = c.go, sent = typed && c.gui != null && u >= c.gui, msgs = (c.tin || []).map(m => ({ ...m })); if (sent) msgs.push({ minh: true, nd: typed.nd, moi: true });
      if (c.thu_hoi != null && u >= c.thu_hoi + .05) { const own = [...msgs].reverse().find(m => m.minh); if (own) own.thu_hoi = true; }
      const seen = (c.xem || []).reduce((a, [k, n]) => u >= k ? n : a, 0), typing = c.nhap && u >= c.nhap.tu && u < c.nhap.den;
      let y = IT - 30; if (typing) y -= 130; if (seen) y -= 56; const W0 = PW * .64, F = 33; x.font = `600 ${F}px BVP, ${MS.STYLE.font}`;
      const wrap = s => { const out = []; let cur = ''; for (const w of String(s).split(' ')) { const tr = cur ? cur + ' ' + w : w; if (x.measureText(tr).width > W0 && cur) { out.push(cur); cur = w; } else cur = tr; } if (cur) out.push(cur); return out; };
      let lastOwnY = null; for (let i = msgs.length - 1; i >= 0 && y > HB + 230; i--) { const m = msgs[i], lines = m.thu_hoi ? ['Tin nhắn đã được thu hồi'] : wrap(m.nd), bw = Math.min(W0, Math.max(...lines.map(l => x.measureText(l).width))) + 56, bh = lines.length * 46 + 34, nameH = m.minh ? 0 : 34;
        const p = m.moi ? sp(c.gui, 11, 260) : 1; if (p <= 0) continue; y -= bh + nameH; const bx = m.minh ? PW / 2 - 34 - bw : -PW / 2 + 110;
        x.save(); x.translate(bx + bw / 2, y + nameH + bh / 2); x.scale(.7 + .3 * p, .7 + .3 * p); x.globalAlpha = clamp(p * 1.4); x.translate(-(bx + bw / 2), -(y + nameH + bh / 2));
        if (!m.minh) { x.fillStyle = ['#e0a43a', '#3f8f4e', '#8a4ad0', '#e5383b'][i % 4]; x.beginPath(); x.arc(-PW / 2 + 62, y + nameH + bh - 24, 26, 0, 7); x.fill(); txt(x, (m.ai || '?')[0], -PW / 2 + 62, y + nameH + bh - 22, 26, '#fff', 'center', 700, 'BVP');
          txt(x, m.ai || '', bx + 14, y + 16, 25, '#6a6f7a', 'left', 600, 'BVP'); }
        rr(x, bx, y + nameH, bw, bh, 26, m.thu_hoi ? 'rgba(0,0,0,.06)' : m.minh ? (cu ? '#d9caa8' : '#d8e8ff') : '#ffffff');
        lines.forEach((l, k) => { x.font = `${m.thu_hoi ? 'italic 500' : '600'} ${F}px BVP, ${MS.STYLE.font}`; x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = m.thu_hoi ? '#8a8f99' : '#1d1d22'; x.fillText(l, bx + 28, y + nameH + 40 + k * 46); });
        x.restore(); if (m.minh && lastOwnY == null) lastOwnY = { y: y + nameH + bh, x: bx + bw }; y -= 22; }
      if (seen && lastOwnY) { const pp = sp((c.xem.find(([, n]) => n === seen) || [0])[0], 14, 300); x.save(); x.globalAlpha = clamp(pp * 2); txt(x, `Đã xem ${seen}`, lastOwnY.x - 8, lastOwnY.y + 30, 28, seen >= 10 ? '#d32f2f' : '#5a6070', 'right', 700, 'BVP');
        for (let k = 0; k < Math.min(seen, 7); k++) { x.fillStyle = ['#e0a43a', '#3f8f4e', '#8a4ad0', '#e5383b', '#2f6ac8'][k % 5]; x.beginPath(); x.arc(lastOwnY.x - 190 - k * 30, lastOwnY.y + 30, 13, 0, 7); x.fill(); } x.restore(); }
      if (typing) { const ty = IT - 30 - (seen ? 56 : 0) - 100; txt(x, c.nhap.ten + ' đang nhập…', -PW / 2 + 110, ty - 10, 25, '#6a6f7a', 'left', 600, 'BVP'); rr(x, -PW / 2 + 110, ty + 8, 150, 76, 38, '#ffffff');
        for (let k = 0; k < 3; k++) { x.fillStyle = '#8a8f99'; x.beginPath(); x.arc(-PW / 2 + 150 + k * 36, ty + 46 - Math.max(0, Math.sin(t * 9 - k * .9)) * 12, 9, 0, 7); x.fill(); } }
      if (c.he_thong && u >= c.he_thong[0]) { const pp = sp(c.he_thong[0]); x.save(); x.globalAlpha = clamp(pp * 1.5); rr(x, -300, IT - 120, 600, 64, 32, 'rgba(211,47,47,.92)'); txt(x, c.he_thong[1], 0, IT - 88, 28, '#fff', 'center', 700, 'BVP', 560); x.restore(); }
      if (c.thu_hoi != null && u > c.thu_hoi - .16 && u < c.thu_hoi + .05) { const pp = sp(c.thu_hoi - .16, 14, 320); x.fillStyle = `rgba(10,12,20,${.45 * clamp(pp)})`; x.fillRect(-PW / 2, -PH / 2, PW, PH);
        x.save(); x.translate(PW / 2 - 300, IT - 420); x.scale(clamp(pp), clamp(pp)); rr(x, -150, -130, 300, 290, 26, '#ffffff'); ['Trả lời', 'Sao chép', 'Thu hồi'].forEach((s, k) => { const on = k === 2 && u > c.thu_hoi - .05; if (on) rr(x, -140, -122 + k * 92, 280, 84, 18, 'rgba(211,47,47,.15)'); txt(x, s, -110, -80 + k * 92, 32, k === 2 ? '#d32f2f' : '#1d1d22', 'left', 700, 'BVP'); }); x.restore(); }
      rr(x, -PW / 2, IT, PW, 150, 0, '#ffffff'); rr(x, -PW / 2 + 30, IT + 30, PW - 170, 90, 45, '#eef0f4');
      if (typed && !sent) { const p = clamp((u - typed.tu) / Math.max(.01, typed.den - typed.tu)), ch = [...String(typed.nd)], n = Math.floor(ch.length * p); let s = ch.slice(0, n).join(''); x.font = `600 31px BVP, ${MS.STYLE.font}`; while (s.length && x.measureText(s).width > PW - 250) s = s.slice(1);
        x.textAlign = 'left'; x.textBaseline = 'middle'; x.fillStyle = '#1d1d22'; x.fillText(s, -PW / 2 + 62, IT + 76); if ((t * 2.2) % 1 < .6) { const cw = x.measureText(s).width; x.fillStyle = '#2f6ae0'; x.fillRect(-PW / 2 + 64 + cw, IT + 56, 4, 40); } }
      else txt(x, 'Nhập tin nhắn…', -PW / 2 + 62, IT + 76, 31, '#9aa0aa', 'left', 500, 'BVP');
      const press = c.gui != null ? Math.exp(-Math.abs(u - c.gui) * D * 6) : 0; x.save(); x.translate(PW / 2 - 76, IT + 75); x.scale(1 - .18 * press, 1 - .18 * press); x.fillStyle = '#2f6ae0'; x.beginPath(); x.arc(0, 0, 46, 0, 7); x.fill(); txt(x, '➤', 4, 2, 44, '#fff', 'center', 400, 'sans-serif'); x.restore();
      if (press > .05) { x.strokeStyle = `rgba(47,106,224,${press})`; x.lineWidth = 6; x.beginPath(); x.arc(PW / 2 - 76, IT + 75, 46 + (1 - press) * 70, 0, 7); x.stroke(); }
      if (c.thanh_vien && u >= c.thanh_vien.tu) { const tv = c.thanh_vien, pp = sp(tv.tu, 14, 200), top = lerp(PH / 2, -PH / 2 + 300, eo3(clamp(pp))); rr(x, -PW / 2, top, PW, PH, 40, '#ffffff'); txt(x, `Thành viên (${c.tv || tv.ds.length})`, -PW / 2 + 50, top + 60, 36, '#1d1d22', 'left', 700, 'BVP');
        tv.ds.forEach((s, k) => { const ry = top + 140 + k * 96, on = k === tv.noi && u > tv.tu + .25; if (on) { rr(x, -PW / 2 + 20, ry - 44, PW - 40, 88, 20, `rgba(211,47,47,${.12 + .1 * Math.sin(t * 8)})`); x.strokeStyle = '#d32f2f'; x.lineWidth = 4; x.beginPath(); x.roundRect(-PW / 2 + 20, ry - 44, PW - 40, 88, 20); x.stroke(); }
          x.fillStyle = ['#e0a43a', '#3f8f4e', '#8a4ad0', '#e5383b', '#2f6ac8'][k % 5]; x.beginPath(); x.arc(-PW / 2 + 80, ry, 32, 0, 7); x.fill(); const [nm, vt] = String(s).split('|'); txt(x, nm, -PW / 2 + 130, ry - (vt ? 12 : 0), 31, '#1d1d22', 'left', 700, 'BVP'); if (vt) txt(x, vt, -PW / 2 + 130, ry + 24, 24, on ? '#d32f2f' : '#7a7f8a', 'left', 600, 'BVP'); }); }
      x.restore(); const gl = x.createLinearGradient(-PW / 2, -PH / 2, PW / 2, PH / 2); gl.addColorStop(0, 'rgba(255,255,255,.07)'); gl.addColorStop(.5, 'rgba(255,255,255,0)'); x.fillStyle = gl; x.beginPath(); x.roundRect(-PW / 2, -PH / 2, PW, PH, 78); x.fill();
      if (cu) { x.fillStyle = 'rgba(150,110,60,.12)'; x.beginPath(); x.roundRect(-PW / 2, -PH / 2, PW, PH, 78); x.fill(); }
      x.restore(); },
    // insert: laptop on a dark desk, a document being typed (and deleted). o.doc = { tieu_de, dong: [lines], go: [tu, den], xoa: [tu, den, con (0–1 kept)], gio: ['01:12', '03:00'] }
    'laptop'(x, t, o) { const d = o.doc || {}, u = o.u || 0; rr(x, -1200, -1200, WW + 2400, 5200, 0, '#121218'); rr(x, -1200, 1700, WW + 2400, 1600, 0, '#3a2c22');
      const q = x.createRadialGradient(800, 1150, 50, 800, 1150, 1100); q.addColorStop(0, 'rgba(200,220,255,.20)'); q.addColorStop(1, 'rgba(200,220,255,0)'); x.fillStyle = q; x.fillRect(-400, 0, 2400, 2400);
      x.save(); x.translate(800, 1120); rr(x, -640, -440, 1280, 840, 28, '#1d1e24'); rr(x, -612, -412, 1224, 784, 12, '#f7f7f5'); rr(x, -612, -412, 1224, 66, 0, '#2b5797'); txt(x, 'Tài liệu – Word', -580, -379, 28, '#fff', 'left', 600, 'BVP');
      const hm = s => { const [h, m] = String(s).split(':').map(Number); return h * 60 + m; }, [g0, g1] = d.gio || ['01:12', '01:12'], mm = Math.round(lerp(hm(g0), hm(g1), clamp(u))), clock = `${String(Math.floor(mm / 60) % 24).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`;
      rr(x, -612, 318, 1224, 54, 0, '#20232c'); txt(x, clock, 580, 345, 30, '#ffffff', 'right', 600, 'OSW');
      rr(x, -420, -320, 840, 620, 4, '#ffffff'); x.strokeStyle = '#e2e2e2'; x.lineWidth = 2; x.strokeRect(-420, -320, 840, 620); txt(x, d.tieu_de || 'ĐƠN XIN NGHỈ VIỆC', 0, -262, 40, '#1d1d22', 'center', 700, 'BVP', 760);
      const full = (d.dong || []).join('\n'), ch = [...full], [a0, a1] = d.go || [0, .6], [x0, x1, keep] = d.xoa || [2, 2, 1], typedN = Math.floor(ch.length * clamp((u - a0) / Math.max(.01, a1 - a0))), del = clamp((u - x0) / Math.max(.01, x1 - x0)), n = Math.round(typedN * (1 - del * (1 - (keep ?? .3))));
      const vis = ch.slice(0, n).join('').split('\n'); let cx = -380, cy = -190; vis.forEach((l, i) => { txt(x, l, -380, -190 + i * 52, 29, '#2a2a30', 'left', 500, 'BVP', 770); cy = -190 + i * 52; x.font = `500 29px BVP, ${MS.STYLE.font}`; cx = -380 + Math.min(770, x.measureText(l).width); });
      if ((t * 2.2) % 1 < .6) rr(x, cx + 4, cy - 20, 4, 40, 1, '#1d1d22'); if (del > 0 && del < 1) { rr(x, cx - 220, cy - 22, 224, 44, 4, 'rgba(47,106,224,.25)'); }
      rr(x, -720, 400, 1440, 64, 18, '#2a2b31'); x.restore(); },
    // insert: cork notice board, a new A4 notice drops in with a pin. o.bang = { tieu_de, phu, dong: [lines], ky, dau (stamp text, appears at u .55) }
    'bang-tin'(x, t, o) { const b = o.bang || {}, u = o.u || 0, D = o.D || 3; rr(x, -1200, -1200, WW + 2400, 5200, 0, '#d9d2c4'); rr(x, 120, 380, 1360, 1480, 18, '#6a4a2e'); rr(x, 150, 410, 1300, 1420, 10, '#c49260');
      const R = rgen(8); x.fillStyle = 'rgba(90,60,30,.25)'; for (let k = 0; k < 500; k++) x.fillRect(150 + R() * 1300, 410 + R() * 1420, 3, 3);
      [[260, 520, '#ffe680', -.08, 'Sinh nhật Hà\n12/11 🎂'], [1230, 560, '#a8e0ff', .06, 'Họp sáng\nthứ Hai'], [300, 1560, '#ffb3c6', .05, 'Team\nbuilding!'], [1220, 1580, '#c8f0b0', -.05, 'Ai mượn\nsạc thì trả 😠']].forEach(([px, py, col, r, s]) => { x.save(); x.translate(px, py); x.rotate(r); rr(x, -110, -100, 220, 200, 6, col); String(s).split('\n').forEach((l, i) => txt(x, l, 0, -30 + i * 50, 32, '#3a3a40', 'center', 600, 'BVP', 200)); x.restore(); });
      const p = spring(u * D - .2, 11, 200); if (p > 0) { x.save(); x.translate(800, 1090); x.rotate(-.025 * (1 - p) - .01); x.scale(.85 + .15 * p, .85 + .15 * p); x.globalAlpha = clamp(p * 1.6);
        rr(x, -390, -520, 780, 1040, 6, '#ffffff'); rr(x, -390, -520, 780, 120, 6, '#2f6ae0'); txt(x, b.tieu_de || 'THÔNG BÁO', 0, -460, 54, '#ffffff', 'center', 700, 'BVP', 720); txt(x, b.phu || '', 0, -340, 36, '#1d3d7a', 'center', 700, 'BVP', 720);
        (b.dong || []).forEach((l, i) => { const q = eo3(clamp((u - .3 - i * .12) / .15)); x.globalAlpha = clamp(p * 1.6) * q; txt(x, '✓', -330, -200 + i * 130, 54, '#3f8f4e', 'center', 700, 'sans-serif'); txt(x, l, -280, -200 + i * 130, 38, '#1d1d22', 'left', 700, 'BVP', 640); });
        x.globalAlpha = clamp(p * 1.6); if (b.ky) txt(x, b.ky, 330, 420, 32, '#4a4a55', 'right', 600, 'BVP'); x.restore();
        x.fillStyle = '#d32f2f'; x.beginPath(); x.arc(800, 600, 26, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.arc(792, 592, 8, 0, 7); x.fill(); }
      if (b.dau && u > .55) { const q = spring((u - .55) * D, 10, 300); x.save(); x.translate(1050, 1380); x.rotate(-.18); x.scale(1.6 - .6 * q, 1.6 - .6 * q); x.globalAlpha = clamp(q); x.strokeStyle = '#d32f2f'; x.lineWidth = 10; x.beginPath(); x.roundRect(-250, -64, 500, 128, 16); x.stroke(); txt(x, b.dau, 0, 4, 48, '#d32f2f', 'center', 700, 'BVP', 470); x.restore(); } },
    // insert: an office drawer seen from above, sliding open on the folded letter and closing again. o.mo (u fully open), o.dong (u starts closing), o.thu: label on the envelope
    'ngan-keo'(x, t, o) { const u = o.u || 0, mo = o.mo ?? .2, dong = o.dong ?? .7, k = u < dong ? eo3(clamp(u / Math.max(.05, mo))) : 1 - eio(clamp((u - dong) / .22));
      rr(x, -1200, -1200, WW + 2400, 5200, 0, '#5c4330'); const R = rgen(12); x.strokeStyle = 'rgba(40,25,15,.35)'; x.lineWidth = 3; for (let i = 0; i < 26; i++) { const yy = R() * 2600; x.beginPath(); x.moveTo(-200, yy); x.bezierCurveTo(400, yy + 40, 1100, yy - 30, 1800, yy + 20); x.stroke(); }
      const top = 520, h = 980, oy = lerp(-h + 120, 0, k); x.save(); x.beginPath(); x.rect(-1200, top - 40, WW + 2400, 2600); x.clip();
      rr(x, 260, top + oy, 1080, h, 14, '#3d2a1e'); rr(x, 290, top + oy + 30, 1020, h - 60, 10, '#2c1f16');
      x.save(); x.translate(800, top + oy + h / 2); x.rotate(-.04); rr(x, -340, -230, 680, 460, 8, '#f6f2e8'); x.strokeStyle = '#d8d0bc'; x.lineWidth = 3; x.beginPath(); x.moveTo(-340, -230); x.lineTo(0, 30); x.lineTo(340, -230); x.stroke(); txt(x, o.thu || 'ĐƠN XIN NGHỈ VIỆC', 0, 110, 44, '#3a3a40', 'center', 700, 'BVP', 620); x.restore();
      rr(x, 360, top + oy + 110, 160, 24, 10, '#e8b83c'); rr(x, 1100, top + oy + 760, 120, 120, 60, '#cfd6e0'); x.restore();
      rr(x, 220, top + oy + h - 20, 1160, 240, 18, '#7a5a40'); rr(x, 700, top + oy + h + 80, 200, 40, 20, '#c9a46a'); },
    // insert: a desk from above — the resignation letter, a coffee, and a phone sliding across (o.day: [tu, den]); the phone shows an old chat (o.chu_dt)
    'ban-tay'(x, t, o) { const u = o.u || 0, [d0, d1] = o.day || [.15, .55], k = eo3(clamp((u - d0) / Math.max(.01, d1 - d0)));
      rr(x, -1200, -1200, WW + 2400, 5200, 0, '#8a6a4c'); const R = rgen(14); x.strokeStyle = 'rgba(60,40,25,.25)'; x.lineWidth = 4; for (let i = 0; i < 30; i++) { const yy = R() * 2800; x.beginPath(); x.moveTo(-200, yy); x.bezierCurveTo(500, yy + 50, 1100, yy - 40, 1800, yy + 10); x.stroke(); }
      x.save(); x.translate(520, 1500); x.rotate(.08); rr(x, -300, -200, 600, 400, 8, '#f6f2e8'); txt(x, 'ĐƠN XIN NGHỈ VIỆC', 0, 60, 40, '#3a3a40', 'center', 700, 'BVP', 560); x.restore();
      x.fillStyle = '#e9e4da'; x.beginPath(); x.arc(1240, 700, 130, 0, 7); x.fill(); x.fillStyle = '#5a3a24'; x.beginPath(); x.arc(1240, 700, 100, 0, 7); x.fill(); x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 6; x.beginPath(); x.arc(1240, 700, 60, Math.sin(t) , Math.sin(t) + 1.2); x.stroke();
      const px = lerp(980, 900, k), py = lerp(-200, 980, k); x.save(); x.translate(px, py); x.rotate(lerp(.5, -.08, k)); rr(x, -200, -380, 400, 760, 50, '#0b0c10'); rr(x, -180, -360, 360, 720, 38, '#efe6d2');
      rr(x, -180, -360, 360, 90, 0, '#8a8f96'); txt(x, '12/08/2017', 0, -240, 24, '#6a6255', 'center', 600, 'BVP'); (o.chu_dt || []).forEach((l, i) => { rr(x, -150 + (i % 2) * 60, -190 + i * 120, 240, 90, 18, i % 2 ? '#d9caa8' : '#ffffff'); txt(x, l, -130 + (i % 2) * 60, -145 + i * 120, 20, '#2a2a30', 'left', 600, 'BVP', 200); });
      x.restore(); },
    // closing card: soft dark bokeh, lines appear one by one (prefix "!" = yellow), small series badge (o.nhan). o.dong: [lines]
    'chu'(x, t, o) { const u = o.u || 0, D = o.D || 3, L = o.dong || []; const g = x.createRadialGradient(800, 1300, 50, 800, 1300, 1600); g.addColorStop(0, '#22253a'); g.addColorStop(1, '#07080c'); x.fillStyle = g; x.fillRect(-1200, -1200, WW + 2400, 5200);
      const R = rgen(19); for (let k = 0; k < 22; k++) { const bx = R() * WW, by = 300 + R() * 2000, r = 30 + R() * 90, a = .05 + .05 * Math.sin(t * .8 + k); x.fillStyle = `rgba(255,${200 + R() * 40},150,${a})`; x.beginPath(); x.arc(bx + Math.sin(t * .2 + k) * 30, by - (t * 12 % 200), r, 0, 7); x.fill(); }
      if (o.nhan) { const q = eo3(clamp(u * D / .5)); x.globalAlpha = q; rr(x, 800 - 250, 760, 500, 64, 32, 'rgba(255,211,106,.15)'); txt(x, o.nhan, 800, 793, 28, '#ffd36a', 'center', 700, 'BVP', 470); x.globalAlpha = 1; }
      L.forEach((l, i) => { const st = (o.nhip || .9) * i + .3, q = eo3(clamp((u * D - st) / .6)); if (q <= 0) return; const y = (o.y0 || 1000) + i * 150; x.save(); x.globalAlpha = q; x.translate(0, (1 - q) * 30);
        const yel = String(l).startsWith('!'); txt(x, yel ? l.slice(1) : l, 800, y, yel ? 104 : 90, yel ? '#ffd36a' : '#f4efe3', 'center', 700, 'BVP', 1280); x.restore(); }); },
  };
  // FOREGROUND layers drawn OVER the characters (desks they sit behind…): FRONT[set](x, t, o)
  const FRONT = {
    'van-phong'(x, t, o) { for (const b of o.ban || []) { const cx = b.x * WW, w = b.w || 600, top = G - (b.cao || 440);
      rr(x, cx - w / 2, top, w, 34, 6, '#8a6a4c'); rr(x, cx - w / 2 + 12, top + 34, w - 24, G - top + 20, 4, '#76583e'); rr(x, cx - w / 2 + 40, top + 80, w - 80, 6, 3, 'rgba(0,0,0,.18)');
      if (b.laptop !== false) { rr(x, cx - 140, top - 170, 280, 172, 12, '#c9ccd2'); x.fillStyle = '#e8eaee'; x.beginPath(); x.arc(cx, top - 86, 18, 0, 7); x.fill(); }
      if (b.ten) { rr(x, cx + w / 2 - 230, top - 54, 200, 54, 6, '#2a2c34'); txt(x, b.ten, cx + w / 2 - 130, top - 27, 24, '#e8d9a8', 'center', 700, 'BVP', 190); }
      if (b.coc !== false) { rr(x, cx - w / 2 + 50, top - 70, 56, 70, 10, '#f2efe8'); } } },
  };
  // thought / speech-style bubble (cloud tail toward the anchor point below it); dark = the inner critic
  function bubbleW(x, ax, ay, s, p, size, maxW, dark) {
    const lines = String(s).split('|'); x.font = `700 ${size}px BVP, ${MS.STYLE.font}`; const w = Math.min(maxW, Math.max(...lines.map(l => x.measureText(l).width)) + size * 1.4), h = lines.length * size * 1.25 + size * .9;
    x.save(); x.translate(ax, ay); x.scale(p, p); x.globalAlpha = clamp(p * 1.5);
    const bg = dark ? '#191820' : '#fbf8f0', fg = dark ? '#ff8f7a' : '#1d1d22';
    x.fillStyle = bg; for (const [dx, dy, r] of [[0, 0, size * .16], [size * .25, -size * .55, size * .26]]) { x.beginPath(); x.arc(dx, dy, r, 0, 7); x.fill(); }
    const by = -size * 1.0 - h; rr(x, -w / 2, by, w, h, h / 2.4, bg); if (dark) { x.strokeStyle = 'rgba(255,120,100,.6)'; x.lineWidth = 3; x.beginPath(); x.roundRect(-w / 2, by, w, h, h / 2.4); x.stroke(); }
    lines.forEach((l, i) => txt(x, l, 0, by + size * .45 + size * .62 + i * size * 1.25, size, fg, 'center', 700, 'BVP', w - size * .8)); x.restore();
  }
  const RAIN_SETS = new Set(['nha-dem', 'suoi', 'duong', 'doi', 'dinh-doi']);

  // ---------------- camera ----------------
  const Z0 = H => H / 1900;                                                      // the wide-shot zoom: parallax reference
  function frameOf(shot, A, W, H, D) {                                           // portrait framings: by visible HEIGHT of the set
    const k = shot.khung || 'toan', nv = shot.nv || [], wi = nv.findIndex(n => n.ai === shot.nhin), who = A[wi >= 0 ? wi : 0];
    const mid = a => { const p0 = MS.nv.rootAt(a, 0), p1 = MS.nv.rootAt(a, D); return shot.cam === 'theo' ? p0 : { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }; };
    if (!who && !['vat'].includes(k) && !['cau-dao', 'tui', 'ban-do', 'nut', 'den', 'chat', 'laptop', 'bang-tin', 'ngan-keo', 'ban-tay', 'chu', 'he-mat-troi', 'so-sanh'].includes(shot.set)) return { z: H / 1900, x: WW / 2, y: G - 620 };
    if (!who || ['vat'].includes(k) || ['cau-dao', 'tui', 'ban-do', 'nut', 'den', 'giay', 'vet-ao', 'nut-do', 've-so', 'dien-thoai', 'he-mat-troi', 'so-sanh', 'chat', 'laptop', 'bang-tin', 'ngan-keo', 'ban-tay', 'chu'].includes(shot.set)) return { z: H / 1920 * .78, x: WW / 2, y: 1420 };   // inserts sit in the upper half: the centred caption owns ~60 % height
    const m = mid(who), gy = m.y, sc = who.s;
    if (who.ve && who.ve.kieu === 'anh' && MS.nv.vungAt && MS.nv.CUT[who.ve.bo]) {                 // region map of the real drawing (face / upper body / full body)
      const V = MS.nv.vungAt(who, D * .5), c = b => [b[0] + b[2] / 2, b[1] + b[3] / 2];
      if (k === 'can' || k === 'phan-ung') { const z = .3 * H / V.dau[3], [cx, cy] = c(V.dau); return { z, x: cx, y: cy + .13 * H / z }; }
      if (k === 'trung' && !(A.length > 1 && !shot.nhin)) { const z = .6 * H / V.than_tren[3], [cx, cy] = c(V.than_tren); return { z, x: cx, y: cy + .05 * H / z }; }
      if (k === 'doi' || (k === 'trung' && A.length > 1 && !shot.nhin)) { const Bs = A.map(a => a.ve && a.ve.kieu === 'anh' && MS.nv.CUT[a.ve.bo] ? MS.nv.vungAt(a, D * .5).toan_than : null).filter(Boolean);
        if (Bs.length === A.length) { const x0 = Math.min(...Bs.map(b => b[0])), x1 = Math.max(...Bs.map(b => b[0] + b[2])), y0 = Math.min(...Bs.map(b => b[1])), y1 = Math.max(...Bs.map(b => b[1] + b[3]));
          const z = Math.min(.82 * W / (x1 - x0), .62 * H / (y1 - y0)); return { z, x: (x0 + x1) / 2, y: (y0 + y1) / 2 + .06 * H / z }; } }
    }
    const hd = (() => { const h1 = MS.nv.headAt(who, D * .3), h2 = MS.nv.headAt(who, D * .75); return { x: (h1.x + h2.x) / 2, y: (h1.y + h2.y) / 2 }; })();
    if ((k === 'trung' && A.length > 1 && !shot.nhin) || k === 'doi') {           // two-shot: frame every root AND head over the shot
      const xs = A.flatMap(a => [mid(a).x, MS.nv.headAt(a, D * .3).x, MS.nv.headAt(a, D * .8).x]), hs = A.flatMap(a => [MS.nv.headAt(a, D * .3).y, MS.nv.headAt(a, D * .8).y]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), top = Math.min(...hs), z = Math.min(H / 1250, W * .8 / (x1 - x0 + 260));
      const ground = Math.max(...A.map(a => mid(a).y)); return { z, x: (x0 + x1) / 2, y: Math.min(ground - .2 * H / z, top + .36 * H / z) }; }   // two-shot
    if (k === 'trung') return { z: H / 1150, x: lerp(m.x, hd.x, .5), y: Math.min(gy - 380 * sc, hd.y + 300 * sc) };
    if (k === 'can' || k === 'phan-ung') { const hr = ((who.R || {}).headR || 38) * sc; return { z: Math.min(H / 640 / sc, .1 * H / hr), x: hd.x, y: hd.y + Math.max(120 * sc, 2.2 * hr) }; }   // sized by the character's own head
    if (k === 'qua-vai') { const other = A.find(a => a !== who); const ox = other ? (other.x0 ?? mid(other).x) : m.x - 300; return { z: H / 820, x: lerp(ox, m.x, .6), y: Math.min(gy - 430 * sc, hd.y + 260 * sc) }; }
    return { z: H / 1900, x: lerp(WW / 2, m.x, .5), y: G - 620 };
  }
  function camAt(shot, f, u, D, A) {
    const m = shot.cam || 'day', e = eio(u); let z = f.z, x = f.x, y = f.y, rot = 0;
    if (m === 'day') z *= 1 + .07 * e; else if (m === 'lui') z *= 1.08 - .07 * e;
    else if (m === 'lia') x += lerp(-90, 90, e); else if (m === 'lia-trai') x += lerp(90, -90, e);
    else if (m === 'theo' && A.length) { const nv = shot.nv || [], wi = Math.max(0, nv.findIndex(n => n.ai === shot.nhin)); const p = MS.nv.rootAt(A[wi], u * D); x = p.x; z *= 1 + .03 * e; }
    else if (m === 'zoom') z *= 1 + (shot.zoom ?? .55) * eo3(clamp(u / .2)) + .03 * e;                  // crash zoom: snaps in during the first fifth, then drifts
    else if (m === 'lui-nhanh') z *= 1 + (shot.zoom ?? .5) * (1 - eo3(clamp(u / .35)));                // fast pull-back reveal
    else if (m === 'nghieng') { rot = lerp(0, shot.goc_nghieng ?? -.07, eio(u)); z *= 1 + .06 * e; }   // dutch tilt: the world slips
    else if (m === 'len') { y += lerp(180, -180, e); z *= 1 + .02 * e; } else if (m === 'xuong') { y += lerp(-180, 180, e); z *= 1 + .02 * e; }   // tilt up / down
    else if (m === 'tho') { z *= 1 + .025 * Math.sin(u * D * 1.6); y += Math.sin(u * D * 1.1) * 8; }   // handheld breathing (held, uneasy)
    else if (m !== 'tinh') z *= 1 + .03 * e;                                    // nothing ever freezes
    if (m === 'rung' || shot.rung) { const a = 14 * (1 - u * .6); x += Math.sin(u * D * 41) * a; y += Math.cos(u * D * 37) * a; rot = Math.sin(u * D * 23) * .006; z *= 1.04; }
    return { z, x, y, rot };
  }
  const GRADE = { dem: ['#5d74a8', .45], 'hoi-tuong': ['#c9a271', .5], xam: ['#9aa1a6', .4], 'binh-minh': ['#ffd0a0', .35], ngay: null };

  // ---------------- characters of a shot ----------------
  const LOCO = new Set(['di', 'chay', 'leo', 'chay-hoang', 'di-cham']);
  function actorsOf(sh, d, c, ctx, D, t0g) {
    const key = D.toFixed(3) + '|' + t0g.toFixed(3); if (sh.__A && sh.__A.key === key) return sh.__A.A;
    const nv = sh.nv || [], sceneT0 = c.t - c.lt, words = (ctx.words || []).filter(w => w[1] >= sceneT0 - .05 && w[1] < sceneT0 + c.D), many = nv.length > 1;
    const A = nv.map((n, k) => {
      const cast = (ctx.cast || {})[n.ai] || {}, tu = n.tu_the, loco = LOCO.has(tu), speaks = !d.nghi_tham && (n.noi || (d.ai && d.ai === n.ai));   // nghi_tham: a thought line, lips stay shut
      const hd = (n.hanh_dong || []).map(e => ({ ...e, t: e.t ?? (e.u ?? 0) * D, clip: e.clip || MS.nv.MAP[e.tu_the] || e.tu_the, bc: e.bc || e.bieu_cam }));
      if (!hd.length || hd[0].t > 0) hd.unshift({ t: 0, clip: tu && !(loco && n.di != null) ? (MS.nv.MAP[tu] || tu) : 'dung' });
      const other = nv.find(m => m.ai !== n.ai);
      return MS.nv.actor({ id: n.ai, ve: n.ve ? { ...(cast.ve || {}), ...n.ve } : (cast.ve || {}), x: n.x * WW, y: G + (n.y ?? 0), s: n.s ?? 1, huong: n.huong, goc: n.goc, hd, bc: n.bieu_cam,
        x1: n.di != null ? n.di * WW : null, y1: n.di != null ? G + (n.y2 ?? n.y ?? 0) : null, di_tu: (n.di_tu ?? 0) * D, di_den: (n.di_den ?? 1) * D, D, toc: n.toc,
        kieu_di: n.kieu_di || (loco ? tu : null), doc: n.doc, words: speaks ? words : null, nghe: !speaks && d.ai && !d.nghi_tham ? words : null, t0g,
        nhin: n.nhin ?? (many && other && sh.khung !== 'qua-vai' ? (speaks || (d.ai && nv.some(m => m.ai === d.ai)) ? (speaks ? other.ai : d.ai) : null) : null),
        toi: n.toi_vat ?? (typeof n.toi === 'number' ? null : n.toi), toi_mau: n.toi_mau ?? n.toi_bong ?? (typeof n.toi === 'number' ? n.toi : 0), den: n.den, ghe: n.ghe, pha: k * 1.7 + (n.x || 0) * 3, lop: n.lop || 0 });
    });
    if (sh.khung === 'qua-vai' && A.length > 1) {                                // over-the-shoulder: the listener comes towards the camera (bigger, darker, back turned)
      const who = A.find(q => q.id === (sh.nhin || d.ai)) || A[0], L = A.find(q => q !== who), dir = Math.sign(L.x - who.x) || -1;
      L.x0 = L.x; L.s *= 1.45; L.x += (who.x - L.x) * .28; L.y += 260; L.toi_mau = Math.max(L.toi_mau || 0, .5); L.lop = 9; L.lo_xo = false;
      L.face = [{ t: -9, h: -dir, g: 'lung-3-4' }]; L.hd.forEach(e => e.nl = dir); L.nhin = null; }
    Object.defineProperty(sh, '__A', { enumerable: false, writable: true, configurable: true, value: { key, A } }); return A;
  }

  // ---------------- story graphics ----------------
  function ruleCard(x, W, H, r, lt) {
    const p = spring(lt - (r.t ?? .2)); if (p <= 0) return; x.save(); x.translate(W / 2, H * .2); x.scale(.6 + .4 * p, .6 + .4 * p); x.globalAlpha = clamp(p * 1.6); x.rotate(-.015);
    rr(x, -330, -150, 660, 300, 18, '#f4efe3'); rr(x, -330, -150, 660, 14, 0, '#3f8f4e');
    rr(x, -150, -116, 300, 46, 23, '#3f8f4e'); txt(x, `${r.nhan || 'LUẬT LŨ'} #${r.so}`, 0, -93, 30, '#f4efe3', 'center', 600);
    txt(x, r.chu, 0, -10, 84, '#1d1d1f', 'center', 700, 'OSW', 600); if (r.phu) txt(x, r.phu, 0, 72, 40, '#5a5a5e', 'center', 500, 'OSW', 600); x.restore();
  }
  function hudCard(x, W, H, h, lt) {
    const p = spring(lt - (h.t ?? .15)); if (p <= 0) return; const v = lerp(h.tu ?? 0, h.so, eo3(clamp((lt - (h.t ?? .15)) / 1.1)));
    x.save(); x.translate(W * .5, H * .17); x.scale(p, p); rr(x, -300, -115, 600, 230, 24, 'rgba(244,239,227,.96)'); rr(x, -300, -115, 10, 230, 0, h.do ? '#d23b3b' : '#3f8f4e');
    txt(x, h.nhan, -265, -70, 34, '#3a3a3e', 'left', 600, 'OSW', 530); txt(x, (h.dau || '') + Math.round(v), -265, 28, 120, h.do ? '#d23b3b' : '#1d1d1f', 'left', 700);
    txt(x, h.don_vi || '', 265, 50, 54, '#3a3a3e', 'right', 600); x.restore();
  }
  function moCard(x, W, H, m, lt, D) {   // opening hook, visible from frame one (the TikTok cover): mo: { nhan (series pill), chu ('|' = new line, leading '!' = yellow), y (0–1), vao (fade in), ra (fade out at the scene end) }
    const a = (m.vao ? clamp(lt / .3) : 1) * (m.ra ? clamp((D - lt) / .35) : 1); if (a <= 0) return; x.save(); x.globalAlpha = a; let y = H * (m.y ?? .1);
    if (m.nhan) { x.font = `700 30px BVP, ${MS.STYLE.font}`; const w = x.measureText(m.nhan).width + 56; rr(x, W / 2 - w / 2, y - 27, w, 54, 27, 'rgba(10,10,16,.66)'); txt(x, m.nhan, W / 2, y, 30, '#ffd36a', 'center', 700, 'BVP'); y += 96; }
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    for (const l of String(m.chu || '').split('|')) { const yel = l.startsWith('!'), t = yel ? l.slice(1) : l; let sz = 70; x.font = `800 ${sz}px BVP, ${MS.STYLE.font}`;
      const w = x.measureText(t).width; if (w > W * .9) { sz *= W * .9 / w; x.font = `800 ${sz}px BVP, ${MS.STYLE.font}`; }
      x.lineWidth = sz * .22; x.strokeStyle = 'rgba(12,9,6,.92)'; x.strokeText(t, W / 2, y); x.fillStyle = yel ? '#ffd23f' : '#ffffff'; x.fillText(t, W / 2, y); y += sz * 1.18; }
    x.restore();
  }
  function endCard(x, W, H, k, lt) {
    const p = eo3(clamp(lt / .8)); x.save(); x.globalAlpha = p; rr(x, 0, 0, W, H, 0, 'rgba(8,10,14,.9)');
    txt(x, 'TẬP SAU', W / 2, H * .42, 40, '#c9c9cc', 'center', 500); txt(x, k.tap_sau, W / 2, H * .48, 112, '#f7f4ee', 'center', 700, 'OSW', W * .9);
    rr(x, W / 2 - 90, H * .52, 180, 6, 3, '#e5383b'); if (k.chu) txt(x, k.chu, W / 2, H * .57, 38, '#c9c9cc', 'center', 500);
    if (k.hoi) { const q = eo3(clamp((lt - .7) / .6)); x.globalAlpha = p * q; String(k.hoi).split('|').forEach((l, i) => txt(x, l, W / 2, H * .65 + i * 52, 44, '#ffd36a', 'center', 600, 'OSW', W * .86)); x.globalAlpha = p; }   // comment question
    if (k.nut !== false) { const q = eo3(clamp((lt - 1.2) / .5)), pu = 1 + .05 * Math.sin(lt * 5); if (q > 0) { x.save(); x.translate(W / 2, H * .79); x.scale(q * pu, q * pu);   // subscribe pill
      rr(x, -170, -40, 340, 80, 40, '#e5383b'); txt(x, '▶  ' + (k.nut || 'THEO DÕI'), 0, 0, 40, '#ffffff', 'center', 700); x.restore(); } }
    x.restore();
  }
  function rain(x, W, H, t, cam, heavy = 1) {                                    // three depth layers drifting with the camera
    for (const [n, len, w, a, sp, par] of [[90, 30, 1.6, .22, 1300, .3], [70, 46, 2.4, .32, 1700, .7], [16, 90, 4.5, .28, 2300, 1.4]]) {
      const R = rgen(11 + n); x.strokeStyle = `rgba(190,210,230,${a})`; x.lineWidth = w; x.beginPath();
      for (let k = 0; k < n * heavy; k++) { const rx = ((R() * W - cam.x * cam.z * par * .3 + t * 70) % W + W) % W, ry = (R() * H + t * sp * (.85 + R() * .3)) % H; x.moveTo(rx, ry); x.lineTo(rx - len * .2, ry + len); }
      x.stroke(); }
  }
  function splashes(x, t, y, x0 = -400, x1 = WW + 400) { const R = rgen(13); x.strokeStyle = 'rgba(200,215,235,.45)'; x.lineWidth = 3;
    for (let k = 0; k < 60; k++) { const per = .35 + R() * .3, ph = ((t + R() * per) % per) / per, xx = x0 + R() * (x1 - x0), yy = y + R() * 60 - 20; if (ph > .5) continue; const r = 6 + ph * 40;
      x.globalAlpha = 1 - ph * 2; x.beginPath(); x.ellipse(xx, yy, r, r * .28, 0, Math.PI, 0); x.stroke(); } x.globalAlpha = 1; }

  // ---------------- one scene ----------------
  MS.truyen = { WW, G, SETS, draw(x, c, ctx) {
    const d = c.data, shots = d.shots && d.shots.length ? d.shots : [{ set: 'den' }], n = shots.length, u0 = clamp(c.lt / Math.max(.1, c.D));
    let i = 0; for (let k = 0; k < n; k++) if (u0 >= (shots[k].at ?? k / n)) i = k;
    const sh = shots[i], a = sh.at ?? i / n, b = i + 1 < n ? (shots[i + 1].at ?? (i + 1) / n) : 1, D = (b - a) * c.D, ls = c.lt - a * c.D, u = clamp(ls / Math.max(.1, D));
    const W = c.W, H = c.H, A = actorsOf(sh, d, c, ctx, D, c.t - ls), f0 = frameOf(sh, A, W, H, D), f = { ...f0, ...(sh.tam ? { x: sh.tam[0], y: sh.tam[1] } : {}), z: f0.z * (sh.phong || 1) }, cam = camAt(sh, f, u, D, A), o = { ...sh, u, D };   // shot.tam = [x, y] aim point, shot.phong = zoom factor
    x.save(); x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    const base = (zz, cx, cy) => { x.setTransform(1, 0, 0, 1, 0, 0); x.translate(W / 2, H / 2); x.rotate(cam.rot); x.scale(zz, zz); x.translate(-cx, -cy); };
    const ax = WW / 2, ay = G - 620, z0 = Z0(H);
    o.L = (p, fn) => { x.save(); const zz = z0 * Math.pow(cam.z / z0, p); base(zz, ax + (cam.x - ax) * p, ay + (cam.y - ay) * p); fn(); x.restore(); };   // parallax layer
    base(cam.z, cam.x, cam.y);
    (SETS[sh.set] || SETS.den)(x, c.t, o);
    base(cam.z, cam.x, cam.y);
    MS.nv.scene(x, A, ls);
    if (FRONT[sh.set]) FRONT[sh.set](x, c.t, o);
    if (sh.nuoc_truoc && SETS[sh.set]) { const lv = sh.nuoc_truoc; x.save(); x.globalAlpha = .85; x.beginPath(); x.rect(-1200, G - lv * 300, WW + 2400, 1200); x.clip();
      const g = x.createLinearGradient(0, G - lv * 300, 0, G + 200); g.addColorStop(0, 'rgba(90,72,48,.75)'); g.addColorStop(1, 'rgba(50,38,24,.95)'); x.fillStyle = g; x.fillRect(-1200, G - lv * 300, WW + 2400, 1200);
      x.strokeStyle = 'rgba(200,180,140,.5)'; x.lineWidth = 4; x.beginPath(); for (let k = -1200; k <= WW + 1200; k += 30) { const yy = G - lv * 300 + Math.sin(k * .03 - c.t * 4) * 4; k > -1200 ? x.lineTo(k, yy) : x.moveTo(k, yy); } x.stroke(); x.restore(); }   // water in FRONT of the legs
    if (sh.muoi) muoiBay(x, c.t, sh.muoi, sh.muoi_to || 1);
    const wet = sh.mua ?? RAIN_SETS.has(sh.set); if (wet && SETS[sh.set] && !['cau-dao', 'tui', 'ban-do', 'nut', 'den', 'trong-nha'].includes(sh.set)) splashes(x, c.t, G - (sh.nuoc_truoc || 0) * 300);
    x.restore();
    const bongs = [...(sh.bong || []), ...(d.bong && !(sh.bong || []).length ? [typeof d.bong === 'string' ? { ai: d.ai, chu: d.bong } : { ai: d.ai, ...d.bong }] : [])];
    for (const bg of bongs) { const ac = A.find(q => q.id === bg.ai); if (!ac || !bg.chu) continue; const hp = MS.nv.headAt(ac, ls), hr = ((ac.R || {}).headR || 38) * ac.s * cam.z * 1.15;   // thought bubble over a head (screen space)
      const sx = W / 2 + (hp.x - cam.x) * cam.z, sy = H / 2 + (hp.y - cam.y) * cam.z, pp = spring(c.lt - a * c.D - (bg.u ?? .12) * D, 12, 240); if (pp <= 0) continue;
      const size = bg.co || 50, top = sy - hr - 18; bubbleW(x, clamp(sx + hr * .5, W * .32, W * .68), Math.max(H * .06 + size * 2.6, top), bg.chu, pp, size, W * .8, !!bg.toi); }
    if (wet && sh.set !== 'trong-nha') rain(x, W, H, c.t, cam, sh.mua_to ?? 1);
    const fl = flash(c.t, sh); if (fl > 0) { x.fillStyle = `rgba(220,230,255,${.3 * clamp(fl)})`; x.fillRect(0, 0, W, H); }
    const gr = GRADE[sh.mau || (RAIN_SETS.has(sh.set) ? 'dem' : 'ngay')]; if (gr) { x.save(); x.globalCompositeOperation = 'multiply'; x.fillStyle = mix('#ffffff', gr[0], gr[1]); x.fillRect(0, 0, W, H); x.restore(); }
    if (sh.mau === 'hoi-tuong') { x.save(); x.globalCompositeOperation = 'color'; x.fillStyle = 'rgba(160,120,74,.55)'; x.fillRect(0, 0, W, H); x.restore(); }
    if (d.the_luat) ruleCard(x, W, H, d.the_luat, c.lt);
    if (d.hud) hudCard(x, W, H, d.hud, c.lt);
    if (d.ket && c.vt > c.vdur + .15) endCard(x, W, H, d.ket, c.vt - c.vdur - .15);   // end card after the last line
    if (i > 0 && ls < .06 && !sh.vao) { x.fillStyle = `rgba(0,0,0,${.35 * (1 - ls / .06)})`; x.fillRect(0, 0, W, H); }   // hard cut flash-frame
    if (sh.vao) { const T = { quet: .22, trang: .28, den: .55, mo: .4 }[sh.vao] || .25, k = 1 - clamp(ls / T);                     // shot entry: whip | white flash | from black | blur-in
      if (k > 0) { if (sh.vao === 'trang') { x.fillStyle = `rgba(255,255,255,${k * .9})`; x.fillRect(0, 0, W, H); }
        else if (sh.vao === 'den') { x.fillStyle = `rgba(0,0,0,${eio(k)})`; x.fillRect(0, 0, W, H); }
        else { x.save(); x.globalAlpha = sh.vao === 'quet' ? .85 : .9; x.filter = `blur(${(sh.vao === 'quet' ? 26 : 16) * k}px)`; x.drawImage(x.canvas, sh.vao === 'quet' ? -W * .18 * k * (sh.huong_quet || 1) : 0, 0); x.restore(); } } }
    if (d.mo) moCard(x, W, H, d.mo, c.lt, c.D);
  } };
})();
