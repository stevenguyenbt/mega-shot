// mega-shot · critters — cute animal mascots drawn in code, each with its own silhouette and drawing style.
// Same API as MS.puppet: MS.critters.draw(g, C, { x, y, scale, t, track: [{ t, pose, expr }], words, flip })
//   const cat = MS.critters.create('mochi')            // mochi (cat, kawaii) · bao (panda, flat) · tuck (penguin, paper) · fizz (fox, watercolor) · hop (bunny, pixel)
// Poses: idle · wave · cheer · point · think · shrug · bounce   Expressions: neutral · happy · surprised · sad · angry · love · smug
// Origin = feet centre; a character is ~430 px tall at scale 1. Everything is a pure function of t (deterministic frames).
(() => {
  const MS = window.MS, { clamp, lerp, rgen } = MS.u;
  const spring = (t, d = 14, k = 170) => { if (t <= 0) return 0; const w0 = Math.sqrt(k), z = d / (2 * w0); if (z >= 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    const wd = w0 * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + z * w0 / wd * Math.sin(wd * t)); };
  const shade = (c, k) => { const [r, g, b] = MS.u.hex(c); const f = v => Math.round(clamp(v * k / 255) * 255).toString(16).padStart(2, '0'); return '#' + f(r) + f(g) + f(b); };

  // ---------- geometry ----------
  const E = (cx, cy, rx, ry, n = 28, rot = 0) => [...Array(n)].map((_, i) => { const a = i / n * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry; return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]; });
  const path = (g, p, closed = true) => { const n = p.length; g.beginPath();                    // smooth Catmull-Rom through points
    const P = i => closed ? p[(i + n) % n] : p[clamp(i, 0, n - 1)]; g.moveTo(...p[0]);
    for (let i = 0; i < (closed ? n : n - 1); i++) { const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]); }
    if (closed) g.closePath(); };
  const rotP = (p, cx, cy, a) => p.map(([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]);
  const bbox = p => { const xs = p.map(q => q[0]), ys = p.map(q => q[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };

  // ---------- styles ----------
  let ST = 'kawaii', INK = '#3b2a2a', LW = 6, JIT = null; const PAT = {};
  const jit = p => JIT ? p.map(([x, y]) => [x + (JIT() - .5) * 3, y + (JIT() - .5) * 3]) : p;
  const paper = (g, col) => { if (PAT[col]) return PAT[col]; const k = MS.u.canvas(96, 96), c = k.getContext('2d'), r = rgen(parseInt(col.slice(1), 16) % 9973);
    c.fillStyle = col; c.fillRect(0, 0, 96, 96); for (let i = 0; i < 1100; i++) { c.fillStyle = r() < .5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.08)'; c.fillRect(r() * 96, r() * 96, 1 + r() * 2, 1); }
    return PAT[col] = g.createPattern(k, 'repeat'); };
  // fill (+ outline) a closed shape in the current style; o.line = false → no outline, o.flat → no shading
  const blob = (g, pts, fill, o = {}) => { const p = jit(pts); path(g, p); const lw = o.lw ?? LW;
    if (ST === 'kawaii') { const [x0, y0, x1, y1] = bbox(p), gr = g.createRadialGradient(x0 + (x1 - x0) * .35, y0 + (y1 - y0) * .3, 0, (x0 + x1) / 2, (y0 + y1) / 2, Math.max(x1 - x0, y1 - y0) * .7);
      gr.addColorStop(0, shade(fill, 1.08)); gr.addColorStop(1, shade(fill, .93)); g.fillStyle = gr; g.fill(); if (o.line !== false) { g.lineJoin = 'round'; g.strokeStyle = o.ink || INK; g.lineWidth = lw; g.stroke(); } return; }
    if (ST === 'flat') { g.fillStyle = fill; g.fill(); if (!o.flat) { const [x0, y0, x1, y1] = bbox(p); g.save(); g.clip(); g.fillStyle = shade(fill, .88); g.beginPath(); g.ellipse(x1 + (x1 - x0) * .15, y1 + (y1 - y0) * .1, (x1 - x0) * .55, (y1 - y0) * .6, 0, 0, 7); g.fill(); g.restore(); } return; }
    if (ST === 'paper') { g.save(); g.shadowColor = 'rgba(40,25,10,.35)'; g.shadowBlur = 8; g.shadowOffsetX = 3; g.shadowOffsetY = 5; g.fillStyle = paper(g, fill); g.fill(); g.restore(); g.strokeStyle = shade(fill, 1.25); g.lineWidth = 2.2; g.stroke(); return; }
    if (ST === 'watercolor') { g.save(); g.globalAlpha = .55; g.fillStyle = fill; g.fill(); g.translate(3, 2.5); g.fill(); g.restore(); g.save(); g.globalAlpha = .4; g.strokeStyle = shade(fill, .75); g.lineWidth = 5; path(g, p); g.stroke(); g.restore();
      if (o.line !== false) { g.save(); g.strokeStyle = '#3a3440'; g.lineWidth = 2.2; g.globalAlpha = .85; path(g, jit(pts)); g.stroke(); g.restore(); } return; }
    g.fillStyle = fill; g.fill(); if (o.line !== false) { g.strokeStyle = o.ink || INK; g.lineWidth = lw * 1.1; g.lineJoin = 'round'; g.stroke(); } };   // pixel (drawn low-res)
  const line = (g, pts, col, w, closed = false) => { path(g, jit(pts), closed); g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); };

  // ---------- poses & expressions (blended with springs) ----------
  const POSES = {
    idle:   { armL: .25, armR: .25, hop: 0, tilt: 0, lean: 0, wave: 0 },
    wave:   { armL: .25, armR: 2.5, hop: 0, tilt: -.06, lean: 0, wave: 1 },
    cheer:  { armL: 2.7, armR: 2.7, hop: 1, tilt: 0, lean: 0, wave: 0 },
    point:  { armL: 1.55, armR: .25, hop: 0, tilt: -.05, lean: -.04, wave: 0 },
    think:  { armL: .25, armR: 2.2, hop: 0, tilt: .12, lean: .02, wave: 0, chin: 1 },
    shrug:  { armL: 1.25, armR: 1.25, hop: 0, tilt: .1, lean: 0, wave: 0 },
    bounce: { armL: .9, armR: .9, hop: .6, tilt: 0, lean: 0, wave: 0 },
  };
  const EXPR = {
    neutral:   { smile: .35 }, happy: { smile: 1, joy: 1 }, surprised: { smile: 0, wow: 1 }, sad: { smile: -.7, sad: 1 },
    angry: { smile: -.6, mad: 1 }, love: { smile: .9, love: 1 }, smug: { smile: .7, joy: .55, smug: 1 },
  };
  const blend = (a, b, p) => { const o = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) o[k] = lerp(a[k] ?? 0, b[k] ?? 0, p); return o; };
  const at = (track, t, key, lib, def) => { const ev = (track || []).filter(e => e[key]); let i = -1; ev.forEach((e, k) => { if (t >= e.t) i = k; });
    if (i < 0) return lib[ev[0] ? ev[0][key] : def] || lib[def]; const cur = lib[ev[i][key]] || lib[def], prev = i > 0 ? (lib[ev[i - 1][key]] || lib[def]) : cur;
    return blend(prev, cur, spring(t - ev[i].t, key === 'pose' ? 12 : 18, key === 'pose' ? 140 : 260)); };
  const talkAt = (words, t) => { if (!words) return 0; for (const [s, t0, t1] of words) if (t >= t0 && t < t1) { const n = Math.max(1, Math.round(String(s).length / 6)); return Math.pow(Math.sin(Math.PI * (((t - t0) / (t1 - t0) * n) % 1)), .7); } return 0; };
  const blinkAt = (t, seed) => { const per = 2.9 + (seed % 5) * .37, ph = (t + seed * .41) % per; return ph < .14 ? Math.sin(ph / .14 * Math.PI) : 0; };

  // ---------- face ----------
  function eyes(g, cx, cy, gap, r, F, blink, look, kind = 'dot') {
    [-1, 1].forEach(s => { const x = cx + s * gap / 2 + look * r * .5, y = cy;
      if (F.love > .5) { const k = r * 1.25; g.fillStyle = '#ff4f7b'; g.beginPath(); g.moveTo(x, y + k * .75); g.bezierCurveTo(x - k * 1.4, y - k * .2, x - k * .55, y - k * 1.15, x, y - k * .35); g.bezierCurveTo(x + k * .55, y - k * 1.15, x + k * 1.4, y - k * .2, x, y + k * .75); g.fill(); return; }
      if (F.joy > .5 || blink > .85) { const w2 = r * 1.05; line(g, [[x - w2, y + r * .35], [x, y - r * (F.joy > .5 ? .55 : -.15)], [x + w2, y + r * .35]], INK, r * .42); return; }
      const sc = 1 + .45 * (F.wow || 0), op = Math.max(.08, 1 - blink) * (F.sad > .5 ? .85 : 1);
      g.fillStyle = INK; g.beginPath(); g.ellipse(x, y, r * sc * (kind === 'big' ? 1.15 : .9), r * sc * (kind === 'big' ? 1.3 : 1.1) * op, 0, 0, 7); g.fill();
      if (op > .4) { g.fillStyle = '#fff'; g.beginPath(); g.arc(x - r * .3 * sc, y - r * .38 * sc, r * .34 * sc, 0, 7); g.fill(); g.beginPath(); g.arc(x + r * .32 * sc, y + r * .32 * sc, r * .14 * sc, 0, 7); g.fill(); }
      if (F.mad > .3) line(g, [[x - s * r * 1.2, y - r * 1.9], [x + s * r * .9, y - r * 1.2]], INK, r * .38);
      if (F.sad > .3) line(g, [[x - s * r * 1.1, y - r * 1.3], [x + s * r * .8, y - r * 1.8]], INK, r * .32);
      if (F.smug > .3 && s > 0) line(g, [[x - r * 1.1, y - r * 1.25], [x + r * 1.1, y - r * 1.6]], INK, r * .3); });
  }
  function mouth(g, cx, cy, w, F, open, kind = 'cat') {
    const op = clamp(open + (F.wow || 0) * .7, 0, 1.2);
    if (op > .1) { const h = w * .9 * op; g.fillStyle = '#7a2a35'; g.beginPath(); g.ellipse(cx, cy + h * .35, w * (.55 + .2 * (F.smile > 0 ? F.smile : 0)), h * .6 + 2, 0, 0, 7); g.fill();
      g.fillStyle = '#ff8fa3'; g.beginPath(); g.ellipse(cx, cy + h * .6, w * .32, h * .25, 0, 0, 7); g.fill(); return; }
    if (kind === 'cat') { const k = w * .45, d = F.smile * w * .25; line(g, [[cx - k * 2, cy - d * .3], [cx - k, cy + k * .6 + d], [cx, cy], [cx + k, cy + k * .6 + d], [cx + k * 2, cy - d * .3]], INK, w * .16); return; }
    const sm = F.smile * w * .45; line(g, [[cx - w * .6, cy - sm * .3], [cx, cy + sm * .6], [cx + w * .6, cy - sm * .3]], INK, w * .17);
  }
  const blush = (g, cx, cy, gap, r, a = .55) => { g.fillStyle = `rgba(255,120,140,${a})`; [-1, 1].forEach(s => { g.beginPath(); g.ellipse(cx + s * gap / 2, cy, r, r * .6, 0, 0, 7); g.fill(); }); };
  // paw/arm: capsule-ish tapered limb from shoulder, rotated outward by `a` (0 = down)
  const arm = (g, sx, sy, len, w, a, side, col, tip) => { const ang = side * a, ex = sx + Math.sin(ang) * len * side * side, ey = sy + Math.cos(ang) * len;
    const pts = [], n = 10; for (let i = 0; i <= n; i++) { const k = i / n, th = Math.PI * k; pts.push([sx + Math.cos(ang) * w * .5 * Math.cos(th) + 0, sy - Math.sin(ang) * w * .5 * Math.cos(th)]); }
    const nx = Math.cos(ang), ny = -Math.sin(ang), shape = [[sx + nx * w * .55, sy + ny * w * .55], [ex + nx * w * .42, ey + ny * w * .42], [ex + Math.sin(ang) * w * .45, ey + Math.cos(ang) * w * .45], [ex - nx * w * .42, ey - ny * w * .42], [sx - nx * w * .55, sy - ny * w * .55]];
    blob(g, shape, col); if (tip) blob(g, E(ex, ey, w * .45, w * .42, 16), tip, { lw: LW * .8 }); return [ex, ey]; };

  // ---------- species ----------
  const SPECIES = {
    // 1 · Mochi — chubby loaf cat (kawaii): merged head-body, tabby stripes, swishing striped tail
    mochi: { style: 'kawaii', name: 'Mochi', ink: '#4a3434', colors: { body: '#c9c3d3', belly: '#f4f0f7', stripe: '#8f87a0', ear: '#ffc2d1', nose: '#ff8fa3' },
      draw(g, s, c) { const B = c.colors, sq = s.squash, H = 300 * sq, Wd = 330 / Math.sqrt(sq), cy = -H / 2 - 6;
        // tail
        const tw = Math.sin(s.t * 3.1) * .35; line(g, rotP([[Wd * .38, cy + H * .25], [Wd * .62, cy + H * .05], [Wd * .7, cy - H * .25], [Wd * .6, cy - H * .45]], Wd * .38, cy + H * .25, tw), INK, 44); line(g, rotP([[Wd * .38, cy + H * .25], [Wd * .62, cy + H * .05], [Wd * .7, cy - H * .25], [Wd * .6, cy - H * .45]], Wd * .38, cy + H * .25, tw), B.body, 32);
        const tp = rotP([[Wd * .6, cy - H * .45]], Wd * .38, cy + H * .25, tw)[0]; [-.18, -.3].forEach((k, i) => { const q = rotP([[Wd * .68, cy + H * (k + .02)], [Wd * .76, cy + H * (k - .03)]], Wd * .38, cy + H * .25, tw); line(g, q, B.stripe, 7); });
        // ears
        [-1, 1].forEach(sd => { const ex = sd * Wd * .3, ey = cy - H * .42, wig = s.ear * sd * .12, ear = rotP([[ex - sd * 58, ey + 40], [ex - sd * 10, ey - 70], [ex + sd * 58, ey + 30]], ex, ey + 30, wig); blob(g, ear, B.body); blob(g, rotP([[ex - sd * 34, ey + 32], [ex - sd * 8, ey - 34], [ex + sd * 30, ey + 26]], ex, ey + 30, wig), B.ear, { line: false }); });
        // body (loaf)
        const body = [[-Wd * .5, cy + H * .32], [-Wd * .52, cy - H * .05], [-Wd * .4, cy - H * .38], [0, cy - H * .5], [Wd * .4, cy - H * .38], [Wd * .52, cy - H * .05], [Wd * .5, cy + H * .32], [Wd * .3, cy + H * .5], [-Wd * .3, cy + H * .5]];
        blob(g, body, B.body); blob(g, E(-Wd * .02, cy + H * .2, Wd * .3, H * .24), B.belly, { line: false });
        [-1, 0, 1].forEach(k => line(g, [[k * 26 - 8, cy - H * .47], [k * 26, cy - H * .36], [k * 26 + 6, cy - H * .28]], B.stripe, 9));
        [-1, 1].forEach(k => [0, 1].forEach(j => line(g, [[k * Wd * .5, cy - H * (.02 - j * .1)], [k * Wd * .42, cy - H * (.0 - j * .1)]], B.stripe, 8)));
        // face
        const fx = s.look * 10, fy = cy - H * .12; eyes(g, fx, fy, 128, 15, s.F, s.blink, s.look); blush(g, fx, fy + 34, 190, 24);
        blob(g, E(fx, fy + 22, 9, 6, 12), B.nose, { line: false }); mouth(g, fx, fy + 40, 34, s.F, s.talk, 'cat');
        line(g, [[fx - 95, fy + 20], [fx - 150, fy + 10]], INK, 3); line(g, [[fx - 95, fy + 32], [fx - 150, fy + 38]], INK, 3); line(g, [[fx + 95, fy + 20], [fx + 150, fy + 10]], INK, 3); line(g, [[fx + 95, fy + 32], [fx + 150, fy + 38]], INK, 3);
        // paws
        arm(g, -Wd * .3, cy + H * .18, 70, 46, s.armL, -1, B.body, B.body); arm(g, Wd * .3, cy + H * .18, 70, 46, s.armR, 1, B.body, B.body);
        [-1, 1].forEach(k => blob(g, E(k * Wd * .22, -10, 40, 22, 16), B.body)); } },
    // 2 · Bao — round panda (flat vector): big round head over a pear body, black eye patches, ears, limbs
    bao: { style: 'flat', name: 'Bao', ink: '#1f2430', colors: { white: '#f7f7f4', black: '#2b2f3a', cheek: '#ffb3c1', bamboo: '#7cc46a' },
      draw(g, s, c) { const B = c.colors, sq = s.squash, by = -120 * sq;
        [-1, 1].forEach(k => blob(g, E(k * 62, -26, 52, 40, 18), B.black));                                  // feet
        blob(g, E(0, by, 140 / Math.sqrt(sq), 132 * sq, 32), B.white, { flat: true }); blob(g, E(0, by + 20, 92, 86, 28), shade(B.white, .96), { flat: true });
        arm(g, -112, by - 40, 92, 62, s.armL, -1, B.black, B.black);
        const hy = by - 175 * sq, hr = 150, tilt = s.tilt; g.save(); g.translate(0, hy); g.rotate(tilt); g.translate(0, -hy);
        [-1, 1].forEach(k => { const w = s.ear * k * 6; blob(g, E(k * 112 + w, hy - 112, 46, 44, 18), B.black); });
        blob(g, E(0, hy, hr * 1.08, hr * .96, 36), B.white);
        [-1, 1].forEach(k => blob(g, E(k * 52 + s.look * 6, hy + 2, 38, 50, 20, k * -.5), B.black, { flat: true }));
        INK = '#fff'; eyes(g, s.look * 6, hy, 104, 12, s.F, s.blink, s.look); INK = c.ink;
        blush(g, 0, hy + 46, 190, 22, .7); blob(g, E(0, hy + 36, 16, 11, 14), B.black, { flat: true }); mouth(g, 0, hy + 58, 30, s.F, s.talk, 'smile');
        g.restore(); arm(g, 98, by - 40, 92, 62, s.armR, 1, B.black, B.black); } },
    // 3 · Tuck — egg penguin (paper cut-out): navy back, white heart face, orange beak + feet, red scarf, flapping flippers
    tuck: { style: 'paper', name: 'Tuck', ink: '#22263a', colors: { back: '#2f3d6b', belly: '#f6f3ea', beak: '#f59b2a', scarf: '#e0453a', feet: '#f59b2a' },
      draw(g, s, c) { const B = c.colors, sq = s.squash, cy = -205 * sq, h = 200 * sq, w = 150 / Math.sqrt(sq);
        [-1, 1].forEach(k => blob(g, E(k * 52, -12, 46, 18, 14), B.feet));
        const flap = Math.sin(s.t * 9) * .12 * (s.hop > .3 ? 1 : .3);
        const body = [[0, cy - h], [w * .72, cy - h * .72], [w, cy - h * .05], [w * .92, cy + h * .62], [w * .5, cy + h * .95], [-w * .5, cy + h * .95], [-w * .92, cy + h * .62], [-w, cy - h * .05], [-w * .72, cy - h * .72]];
        g.save(); const hy = cy - h * .45; g.translate(0, hy); g.rotate(s.tilt * .6); g.translate(0, -hy); blob(g, body, B.back);
        const face = [[0, cy - h * .5], [w * .3, cy - h * .82], [w * .7, cy - h * .55], [w * .74, cy + h * .4], [w * .4, cy + h * .86], [-w * .4, cy + h * .86], [-w * .74, cy + h * .4], [-w * .7, cy - h * .55], [-w * .3, cy - h * .82]];
        blob(g, face, B.belly); const fy = cy - h * .36; eyes(g, s.look * 8, fy, 92, 13, s.F, s.blink, s.look); blush(g, 0, fy + 40, 150, 20, .6);
        const op = clamp(s.talk + (s.F.wow || 0) * .6, 0, 1); blob(g, [[-26, fy + 30], [26, fy + 30], [0, fy + 52 + op * 10]], B.beak); if (op > .1) blob(g, [[-20, fy + 52 + op * 10], [20, fy + 52 + op * 10], [0, fy + 66 + op * 22]], shade(B.beak, .85));
        blob(g, [[-w * .85, cy + h * .02], [w * .85, cy + h * .02], [w * .82, cy + h * .2], [-w * .82, cy + h * .2]], B.scarf); blob(g, [[w * .35, cy + h * .14], [w * .6, cy + h * .14], [w * .66, cy + h * .58], [w * .42, cy + h * .55]], shade(B.scarf, .9));
        g.restore(); arm(g, -w * .9, cy + 20, 120, 40, s.armL + flap, -1, B.back); arm(g, w * .9, cy + 20, 120, 40, s.armR + flap, 1, B.back); } },
    // 4 · Fizz — fox (watercolor): pointy ears with dark tips, cheek fluff, white muzzle, huge swishing tail
    fizz: { style: 'watercolor', name: 'Fizz', ink: '#3a3440', colors: { fur: '#ef8a3c', white: '#fbf3e6', dark: '#4a3330', nose: '#3a2b2b' },
      draw(g, s, c) { const B = c.colors, sq = s.squash, cy = -150 * sq;
        const sw = Math.sin(s.t * 2.4) * .28, tail = rotP([[60, cy + 60], [170, cy + 20], [230, cy - 90], [190, cy - 190], [130, cy - 150], [120, cy - 60], [70, cy - 10]], 70, cy + 40, sw);
        blob(g, tail, B.fur); blob(g, rotP([[190, cy - 190], [230, cy - 90], [212, cy - 120], [150, cy - 150]], 70, cy + 40, sw), B.white);
        [-1, 1].forEach(k => blob(g, E(k * 46, -14, 34, 20, 14), B.dark));
        const body = [[-80, cy + 130], [-95, cy + 30], [-60, cy - 70], [60, cy - 70], [95, cy + 30], [80, cy + 130]]; blob(g, body, B.fur); blob(g, E(0, cy + 50, 48, 70, 20), B.white);
        arm(g, -62, cy - 30, 88, 36, s.armL, -1, B.fur, B.dark);
        const hy = cy - 150, hc = [0, hy]; g.save(); g.translate(0, hy + 40); g.rotate(s.tilt); g.translate(0, -hy - 40);
        [-1, 1].forEach(k => { const w = s.ear * k * .1, ear = rotP([[k * 40, hy - 70], [k * 110, hy - 205], [k * 135, hy - 50]], k * 90, hy - 60, w); blob(g, ear, B.fur); blob(g, rotP([[k * 95, hy - 160], [k * 110, hy - 205], [k * 124, hy - 150]], k * 90, hy - 60, w), B.dark, { line: false }); });
        const head = [[0, hy - 95], [95, hy - 80], [150, hy + 20], [120, hy + 60], [50, hy + 95], [0, hy + 105], [-50, hy + 95], [-120, hy + 60], [-150, hy + 20], [-95, hy - 80]]; blob(g, head, B.fur);
        blob(g, [[-118, hy + 30], [-40, hy + 10], [0, hy + 40], [40, hy + 10], [118, hy + 30], [50, hy + 98], [0, hy + 106], [-50, hy + 98]], B.white);
        eyes(g, s.look * 8, hy - 8, 106, 13, s.F, s.blink, s.look); blush(g, 0, hy + 34, 170, 18, .5);
        blob(g, E(0, hy + 40, 14, 10, 12), B.nose, { line: false }); mouth(g, 0, hy + 62, 28, s.F, s.talk, 'cat'); g.restore();
        arm(g, 62, cy - 30, 88, 36, s.armR, 1, B.fur, B.dark); } },
    // 5 · Hop — bunny (pixel art): long ears (one floppy), buck teeth, pom-pom tail, round body
    hop: { style: 'pixel', name: 'Hop', ink: '#2a2230', pixel: 7, colors: { fur: '#f6f1f4', inner: '#ffb6c9', nose: '#ff7aa0', carrot: '#ff9b3a' },
      draw(g, s, c) { const B = c.colors, sq = s.squash, cy = -120 * sq;
        blob(g, E(110, cy + 40, 34, 32, 16), B.fur);                                                           // tail puff
        [-1, 1].forEach(k => blob(g, E(k * 50, -14, 46, 24, 14), B.fur));
        arm(g, -84, cy - 10, 70, 40, s.armL, -1, B.fur, B.fur); blob(g, E(0, cy, 118 / Math.sqrt(sq), 112 * sq, 28), B.fur);
        const hy = cy - 150, fl = Math.sin(s.t * 2) * .08 + s.ear * .12;
        blob(g, rotP([[-70, hy - 70], [-95, hy - 280], [-40, hy - 290], [-30, hy - 80]], -50, hy - 70, -.12 + s.ear * -.08), B.fur); blob(g, rotP([[-64, hy - 90], [-78, hy - 255], [-50, hy - 262], [-42, hy - 95]], -50, hy - 70, -.12 + s.ear * -.08), B.inner, { line: false });
        blob(g, rotP([[30, hy - 80], [60, hy - 230], [190, hy - 260], [120, hy - 200], [72, hy - 70]], 50, hy - 70, fl), B.fur); blob(g, rotP([[45, hy - 100], [72, hy - 210], [150, hy - 236], [100, hy - 190], [64, hy - 95]], 50, hy - 70, fl), B.inner, { line: false });
        g.save(); g.translate(0, hy); g.rotate(s.tilt); g.translate(0, -hy); blob(g, E(0, hy, 135, 112, 30), B.fur);
        eyes(g, s.look * 8, hy - 6, 112, 15, s.F, s.blink, s.look); blush(g, 0, hy + 34, 180, 22, .7);
        blob(g, [[-12, hy + 22], [12, hy + 22], [0, hy + 34]], B.nose, { line: false }); mouth(g, 0, hy + 46, 28, s.F, s.talk, 'cat');
        if (s.talk < .1 && !(s.F.wow > .3)) blob(g, [[-10, hy + 52], [10, hy + 52], [10, hy + 68], [-10, hy + 68]], '#ffffff', { lw: 3 }); g.restore();
        arm(g, 84, cy - 10, 70, 40, s.armR, 1, B.fur, B.fur); } },
  };

  // ---------- public ----------
  const create = (id, over = {}) => { const sp = SPECIES[id] || SPECIES.mochi; return { id, sp, colors: { ...sp.colors, ...(over.colors || {}) }, ink: over.ink || sp.ink, style: over.style || sp.style, pixel: over.pixel || sp.pixel || 7, seed: id.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0) }; };
  const draw = (g, C, st) => {
    if (C.style === 'pixel' && !st._inner) { const px = st.pixel || C.pixel, cv = g.canvas, w0 = Math.ceil(cv.width / px), h0 = Math.ceil(cv.height / px);
      if (!C._off || C._off.width !== w0 || C._off.height !== h0) C._off = MS.u.canvas(w0, h0);
      const og = C._off.getContext('2d'), m = g.getTransform(); og.setTransform(1, 0, 0, 1, 0, 0); og.clearRect(0, 0, w0, h0); og.setTransform(m.a / px, m.b / px, m.c / px, m.d / px, m.e / px, m.f / px);
      draw(og, C, { ...st, _inner: true }); const d = og.getImageData(0, 0, w0, h0); for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] > 110 ? 255 : 0; og.putImageData(d, 0, 0);
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(C._off, 0, 0, w0 * px, h0 * px); g.restore(); return; }
    const t = st.t || 0, pose = at(st.track, t, 'pose', POSES, 'idle'), F = at(st.track, t, 'expr', EXPR, 'neutral');
    ST = C.style; INK = C.ink; LW = ST === 'pixel' ? 7 : 6; JIT = ST === 'paper' ? rgen(C.seed * 31 + Math.floor(t * 6)) : ST === 'watercolor' ? rgen(C.seed * 17 + Math.floor(t * 8)) : null;
    const hop = Math.abs(Math.sin(t * 6.5)) * 34 * pose.hop, breathe = Math.sin(t * 2.2 + C.seed) * .025, land = pose.hop > .2 ? Math.max(0, Math.cos(t * 6.5 * 2)) * .06 * pose.hop : 0;
    const s = { t, F, armL: pose.armL, armR: pose.armR + (pose.wave ? Math.sin(t * 11) * .35 * pose.wave : 0), tilt: pose.tilt + Math.sin(t * 1.4 + C.seed) * .03, hop, squash: 1 + breathe - land,
      ear: Math.sin(t * 3.3 + C.seed) * .5 + (pose.hop > .3 ? Math.sin(t * 13) * .5 : 0), talk: talkAt(st.words, t) * (st.talkGain ?? 1), blink: blinkAt(t, C.seed), look: Math.sin(t * .7 + C.seed) * .25 };
    g.save(); g.translate(st.x, st.y); g.scale((st.scale || 1) * (st.flip ? -1 : 1), st.scale || 1);
    g.fillStyle = 'rgba(0,0,0,.16)'; g.beginPath(); g.ellipse(0, 4, 150 * (1 - hop / 200), 22, 0, 0, 7); g.fill();
    g.translate(0, -hop); g.rotate(pose.lean); C.sp.draw(g, s, C); g.restore(); ST = 'kawaii'; JIT = null; };
  MS.critters = { create, draw, SPECIES, POSES, EXPR, IDS: Object.keys(SPECIES) };
})();
