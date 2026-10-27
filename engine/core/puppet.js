// mega-shot · puppet — code-drawn 2D cartoon characters with a hand-drawn look.
// A character is DATA (spec): head shape, skin, hair, beard, hat, outfit, colours, proportions. The AI can write a spec
// by analysing a reference image (references/characters.md). The engine draws it with a jointed rig (FK bones),
// spring-driven pose changes, expressions, blinking, breathing and lip-sync from word timestamps; outlines "boil"
// (re-jittered ~10×/s) like hand-drawn animation.
//
//   const emp = MS.puppet.create(MS.puppet.SAMPLES.emperor)
//   MS.puppet.draw(x, emp, { x: 540, y: 1500, scale: 1, t, track: [{ t: 0, pose: 'idle', expr: 'neutral' }, { t: 2, pose: 'point', expr: 'smug' }], words })
(() => {
  const MS = window.MS, { clamp, lerp, rgen } = MS.u;
  const spring = (t, d = 14, k = 170) => { if (t <= 0) return 0; const w0 = Math.sqrt(k), z = d / (2 * w0); if (z >= 1) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    const wd = w0 * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + z * w0 / wd * Math.sin(wd * t)); };

  // ---------- hand-drawn primitives: jittered points + smooth closed/open curves ----------
  let R = Math.random, BOIL = 1.6;
  const jit = p => p.map(([x, y]) => [x + (R() - .5) * 2 * BOIL, y + (R() - .5) * 2 * BOIL]);
  const curve = (g, pts, closed = true, begin = true) => {
    const n = pts.length; if (n < 2) return; if (begin) g.beginPath();
    if (!closed) { g.moveTo(...pts[0]); for (let i = 1; i < n - 1; i++) { const m = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2]; g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]); } g.lineTo(...pts[n - 1]); return; }
    const mid = i => { const a = pts[i % n], b = pts[(i + 1) % n]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
    g.moveTo(...mid(0)); for (let i = 1; i <= n; i++) { const p = pts[i % n], m = mid(i); g.quadraticCurveTo(p[0], p[1], m[0], m[1]); } g.closePath();
  };
  let INK = '#24160f', LW = 7, CEL = true;
  const shift = (p, dx, dy) => p.map(([x, y]) => [x + dx, y + dy]);
  // cel shading (light from upper-left): a darker crescent on the lower-right + a soft highlight crescent on the upper-left
  const cel = (g, p, fill) => {
    const xs = p.map(q => q[0]), ys = p.map(q => q[1]), x0 = Math.min(...xs), y0 = Math.min(...ys), sz = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0); if (sz < 18) return;
    const d = Math.min(26, sz * .16); g.save(); curve(g, p); g.clip();
    g.beginPath(); g.rect(x0 - 40, y0 - 40, sz + 80, sz + 80); curve(g, shift(p, -d * .9, -d * .9), true, false); g.fillStyle = shade(fill, .76); g.fill('evenodd');
    if (sz > 60) { g.beginPath(); g.rect(x0 - 40, y0 - 40, sz + 80, sz + 80); curve(g, shift(p, d * .35, d * .35), true, false); g.fillStyle = shade(fill, 1.14); g.globalAlpha = .55; g.fill('evenodd'); }
    g.restore();
  };
  // sharp: straight edges (subdivided + jittered) for buildings, ground, boxes — curve() would round a rectangle into a blob
  const poly = (g, p, closed = true, begin = true) => { if (begin) g.beginPath(); g.moveTo(...p[0]); for (let i = 1; i < p.length; i++) g.lineTo(...p[i]); if (closed) g.closePath(); };
  const subdiv = (pts, closed, step = 34) => { const out = [], n = pts.length; for (let i = 0; i < (closed ? n : n - 1); i++) { const a = pts[i], b = pts[(i + 1) % n], k = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let j = 0; j < k; j++) out.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]); } if (!closed) out.push(pts[n - 1]); return out; };
  // ---------- drawing styles (S.style): doodle (default hand-drawn) · kawaii · flat · paper · watercolor · pixel ----------
  let STY = 'doodle'; const PAT = {};
  const bbox = p => { const xs = p.map(q => q[0]), ys = p.map(q => q[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
  const paperPat = (g, col) => { if (PAT[col]) return PAT[col]; const k = MS.u.canvas(96, 96), c2 = k.getContext('2d'), r2 = rgen(col.length * 97 + parseInt(col.slice(1), 16) % 997);
    c2.fillStyle = col; c2.fillRect(0, 0, 96, 96); for (let i = 0; i < 900; i++) { c2.fillStyle = r2() < .5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.07)'; c2.fillRect(r2() * 96, r2() * 96, 1 + r2() * 2, 1); }
    c2.strokeStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 14; i++) { c2.beginPath(); const x = r2() * 96, y = r2() * 96; c2.moveTo(x, y); c2.lineTo(x + r2() * 30 - 15, y + r2() * 30 - 15); c2.stroke(); }
    return PAT[col] = g.createPattern(k, 'repeat'); };
  const styled = (g, p, fill, closed, stroke, lw, flat, path) => {
    if (STY === 'kawaii') {                                                       // soft gradient fill, thick outline in a darker tone of the fill
      if (fill && closed) { const [x0, y0, x1, y1] = bbox(p), gr = g.createRadialGradient(x0 + (x1 - x0) * .32, y0 + (y1 - y0) * .28, 0, x0 + (x1 - x0) * .5, y0 + (y1 - y0) * .5, Math.max(x1 - x0, y1 - y0) * .75);
        gr.addColorStop(0, shade(fill, 1.12)); gr.addColorStop(1, shade(fill, .9)); g.fillStyle = gr; g.fill(); }
      if (stroke) { g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = fill && closed ? shade(fill, .55) : INK; g.lineWidth = lw * 1.25; g.stroke(); } return true; }
    if (STY === 'flat' || STY === 'pixel') {                                      // flat vector: no outline (pixel keeps a thin dark outline), one shadow crescent
      if (fill && closed) { g.fillStyle = fill; g.fill(); if (!flat) { const sv = CEL; cel(g, p, fill); } path(); }
      if (stroke && (STY === 'pixel' || !(fill && closed))) { g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = STY === 'pixel' ? lw * 1.1 : lw; g.stroke(); } return true; }
    if (STY === 'paper') {                                                        // paper cut-out: textured paper, drop shadow, pale cut edge
      if (fill && closed) { g.save(); g.shadowColor = 'rgba(0,0,0,.38)'; g.shadowBlur = 7; g.shadowOffsetX = 3; g.shadowOffsetY = 5; g.fillStyle = paperPat(g, fill); g.fill(); g.restore();
        g.strokeStyle = shade(fill, 1.22); g.lineWidth = 2; g.stroke(); }
      else if (stroke) { g.strokeStyle = INK; g.lineWidth = lw * .8; g.lineCap = 'round'; g.stroke(); } return true; }
    if (STY === 'watercolor') {                                                   // watercolour wash (2 offset translucent passes + pigment edge) + pencil line
      if (fill && closed) { g.save(); g.globalAlpha = .5; g.fillStyle = fill; g.fill(); g.translate(2.5, 2); g.fill(); g.restore();
        g.save(); g.globalAlpha = .35; g.strokeStyle = shade(fill, .78); g.lineWidth = 5; g.stroke(); g.restore(); }
      if (stroke) { g.save(); g.strokeStyle = '#3a3640'; g.globalAlpha = .85; g.lineWidth = Math.max(1.6, lw * .32); g.lineCap = 'round'; g.stroke(); g.translate(1.2, -.8); g.globalAlpha = .4; g.stroke(); g.restore(); } return true; }
    return false; };
  const shape = (g, pts, fill, { stroke = true, lw = LW, closed = true, flat = false, sharp = false } = {}) => {
    if (STY !== 'doodle') { const p = sharp ? jit(subdiv(pts, closed)) : jit(pts), path = () => (sharp ? poly(g, p, closed) : curve(g, p, closed)); path(); if (styled(g, p, fill, closed, stroke, lw, flat, path)) return; }
    if (sharp) { const p = jit(subdiv(pts, closed)); poly(g, p, closed);
      if (fill && closed) { g.fillStyle = fill; g.fill(); if (CEL && !flat) { const sv = curve; cel(g, p, fill); poly(g, p, closed); } }
      if (stroke) { g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = lw; g.stroke(); } return; }
    const p = jit(pts); curve(g, p, closed);
    if (fill && closed) { g.fillStyle = fill; g.fill(); if (CEL && !flat) { cel(g, p, fill); curve(g, p, closed); } }
    if (stroke) { g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = lw; g.stroke(); } };
  const ell = (cx, cy, rx, ry, n = 22, rot = 0) => [...Array(n)].map((_, i) => { const a = i / n * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry; return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]; });
  const capsule = (a, b, w, n = 8) => { const dx = b[0] - a[0], dy = b[1] - a[1], ang = Math.atan2(dy, dx), r = w / 2, out = [];
    for (let i = 0; i <= n; i++) { const t = ang - Math.PI / 2 - i / n * Math.PI; out.push([a[0] + Math.cos(t) * r, a[1] + Math.sin(t) * r]); }
    for (let i = 0; i <= n; i++) { const t = ang + Math.PI / 2 - i / n * Math.PI; out.push([b[0] + Math.cos(t) * r, b[1] + Math.sin(t) * r]); } return out; };
  const shade = (c, k) => { const [r, g, b] = MS.u.hex(c); const f = v => Math.round(clamp(v * k / 255) * 255).toString(16).padStart(2, '0'); return '#' + f(r) + f(g) + f(b); };

  // ---------- poses: joint angles (radians, 0 = arm hanging down) ----------
  // armL = viewer-left (front) arm: negative = outward; armR = viewer-right arm: positive = outward. [shoulder, elbow (relative)]
  const POSES = {
    idle:        { lean: 0, head: 0, armL: [-.1, .12], armR: [.1, -.12], legL: [-.05, 0], legR: [.05, 0] },
    point:       { lean: -.04, head: -.08, armL: [-1.55, -.12], armR: [.1, -.12], legL: [-.06, 0], legR: [.04, 0] },
    explain:     { lean: 0, head: .05, armL: [-.35, 1.75], armR: [.35, -1.75], legL: [-.05, 0], legR: [.05, 0] },
    shrug:       { lean: 0, head: .12, armL: [-.75, -1.55], armR: [.75, 1.55], legL: [-.05, 0], legR: [.05, 0] },
    cheer:       { lean: -.03, head: -.1, armL: [-2.6, -.25], armR: [2.6, .25], legL: [-.12, 0], legR: [.12, 0] },
    facepalm:    { lean: .06, head: .2, armL: [2.3, .7], armR: [.1, -.12], legL: [-.05, 0], legR: [.05, 0] },
    'arms-crossed': { lean: -.02, head: -.05, armL: [.5, 1.05], armR: [-.5, -1.05], legL: [-.08, 0], legR: [.08, 0] },
    angry:       { lean: .08, head: .04, armL: [-.45, -2.3], armR: [.7, -1.6], legL: [-.14, 0], legR: [.14, 0] },
  };
  // ---------- expressions: brows (inner lift, outer lift), eye openness, mouth curve/width, extras ----------
  const EXPR = {
    neutral:   { bi: 0, bo: 0, eye: 1, curve: .15, mw: 1 },
    happy:     { bi: .25, bo: .1, eye: .75, curve: .75, mw: 1.15, blush: .5 },
    angry:     { bi: -.75, bo: .35, eye: .85, curve: -.45, mw: .9, vein: 1 },
    surprised: { bi: .7, bo: .7, eye: 1.3, curve: 0, mw: .7, o: 1 },
    smug:      { bi: -.2, bo: .4, eye: .55, curve: .5, mw: .9, smirk: 1, browUp: 1 },
    sad:       { bi: .75, bo: -.3, eye: .8, curve: -.6, mw: .85 },
    worried:   { bi: .6, bo: -.1, eye: 1.05, curve: -.25, mw: .8, sweat: 1 },
  };
  const blend = (a, b, p) => { const o = {}; for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const va = a[k] ?? 0, vb = b[k] ?? 0; o[k] = Array.isArray(va) ? va.map((v, i) => lerp(v, vb[i], p)) : lerp(va, vb, p); } return o; };

  // ---------- track → current pose/expression with spring transitions ----------
  const at = (track, t, key, lib, def) => {
    const ev = (track || []).filter(e => e[key]); let i = -1; ev.forEach((e, k) => { if (t >= e.t) i = k; });
    if (i < 0) return lib[ev[0] ? ev[0][key] : def] || lib[def];
    const cur = lib[ev[i][key]] || lib[def], prev = i > 0 ? (lib[ev[i - 1][key]] || lib[def]) : cur;
    return blend(prev, cur, spring(t - ev[i].t, key === 'pose' ? 13 : 18, key === 'pose' ? 150 : 260));
  };
  // lip-sync: one open–close per spoken word (Vietnamese = one syllable per word); longer words get two beats
  const mouthOpen = (words, t) => { if (!words) return 0; for (const w of words) { const [s, t0, t1] = w; if (t >= t0 && t < t1) { const beats = Math.max(1, Math.round(String(s).length / 6)), ph = (t - t0) / (t1 - t0) * beats;
    return Math.pow(Math.sin(Math.PI * (ph % 1)), .7) * (/[aáàảãạăắằẳẵặâấầẩẫậoóòỏõọôốồổỗộơớờởỡợ]/i.test(s) ? 1 : .7); } } return 0; };
  const blinkAt = (t, seed) => { const per = 3.1 + (seed % 7) * .23, ph = (t + seed * .37) % per; return ph < .13 ? Math.sin(ph / .13 * Math.PI) : 0; };

  // ---------- parts ----------
  function drawHat(g, S, hx, hy, r) {
    const c = S.colors, k = S.hat;
    if (k === 'crown') {          // imperial mianguan: flat board + bead strings + cap
      shape(g, ell(hx, hy - r * .82, r * .55, r * .32), c.hat2 || '#1d1d24');
      shape(g, [[hx - r * 1.1, hy - r * 1.05], [hx + r * 1.1, hy - r * 1.15], [hx + r * 1.12, hy - r * .98], [hx - r * 1.08, hy - r * .9]], c.hat || '#1d1d24');
      for (let i = -4; i <= 4; i++) { const bx = hx + i * r * .22, top = hy - r * .97 - i * r * .01; g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(bx, top); g.lineTo(bx + (R() - .5) * 2, top + r * .42); g.stroke();
        for (let j = 1; j <= 3; j++) { g.fillStyle = j % 2 ? (c.bead || '#e8c35a') : '#d24b3a'; g.beginPath(); g.arc(bx, top + j * r * .13, r * .045, 0, 7); g.fill(); g.stroke(); } }
    } else if (k === 'conical') { // conical leaf hat (nón lá)
      shape(g, [[hx - r * 1.45, hy - r * .55], [hx, hy - r * 1.55], [hx + r * 1.45, hy - r * .55], [hx, hy - r * .42]], c.hat || '#e9d39a');
      g.strokeStyle = shade(c.hat || '#e9d39a', .72); g.lineWidth = 3; for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(hx, hy - r * 1.5); g.lineTo(hx + i * r * .55, hy - r * .5); g.stroke(); }
    } else if (k === 'helmet') {
      shape(g, [...ell(hx, hy - r * .35, r * 1.05, r * .85, 20).filter(p => p[1] < hy - r * .25), [hx + r * 1.1, hy - r * .2], [hx - r * 1.1, hy - r * .2]], c.hat || '#9aa3ad');
      shape(g, [[hx - r * .08, hy - r * 1.2], [hx + r * .08, hy - r * 1.2], [hx, hy - r * 1.6]], c.hat2 || '#c8463a');
    } else if (k === 'hardhat') {   // construction helmet
      shape(g, [...ell(hx, hy - r * .45, r * 1.02, r * .78, 22).filter(p => p[1] < hy - r * .4), [hx + r * 1.02, hy - r * .4], [hx - r * 1.02, hy - r * .4]], c.hat || '#f5c518');
      shape(g, [[hx - r * 1.25, hy - r * .44], [hx + r * 1.25, hy - r * .44], [hx + r * 1.2, hy - r * .3], [hx - r * 1.2, hy - r * .3]], c.hat || '#f5c518');
      shape(g, [[hx - r * .1, hy - r * 1.2], [hx + r * .1, hy - r * 1.2], [hx + r * .12, hy - r * .46], [hx - r * .12, hy - r * .46]], shade(c.hat || '#f5c518', .85), { flat: true });
    } else if (k === 'tophat') {
      shape(g, [[hx - r * .62, hy - r * .7], [hx + r * .62, hy - r * .7], [hx + r * .55, hy - r * 1.75], [hx - r * .55, hy - r * 1.75]], c.hat || '#1d1d24');
      shape(g, ell(hx, hy - r * .7, r * 1.05, r * .16, 18), c.hat || '#1d1d24');
      shape(g, [[hx - r * .6, hy - r * .95], [hx + r * .6, hy - r * .95], [hx + r * .6, hy - r * .8], [hx - r * .6, hy - r * .8]], c.hat2 || '#7a1f1f', { flat: true });
    } else if (k === 'cap') {         // flat cap
      shape(g, [...ell(hx, hy - r * .5, r * .98, r * .55, 20).filter(p => p[1] < hy - r * .45), [hx + r * .98, hy - r * .45], [hx - r * .98, hy - r * .45]], c.hat || '#5b4a3a');
      shape(g, [[hx - r * .2, hy - r * .5], [hx + r * 1.2, hy - r * .42], [hx + r * 1.05, hy - r * .3], [hx - r * .1, hy - r * .36]], shade(c.hat || '#5b4a3a', .8));
    } else if (k === 'nemes') {       // Egyptian striped head-cloth
      const a = c.hat || '#2f5fae', b = c.hat2 || '#e8c35a';
      shape(g, [[hx - r * 1.05, hy - r * .6], [hx + r * 1.05, hy - r * .6], [hx + r * 1.25, hy + r * .9], [hx + r * .85, hy + r * .95], [hx + r * .78, hy - r * .1], [hx - r * .78, hy - r * .1], [hx - r * .85, hy + r * .95], [hx - r * 1.25, hy + r * .9]], a);
      g.strokeStyle = b; g.lineWidth = r * .07; for (let i = 0; i < 4; i++) { const y = hy - r * .3 + i * r * .32; [-1, 1].forEach(s2 => { g.beginPath(); g.moveTo(hx + s2 * r * .86, y); g.lineTo(hx + s2 * r * 1.12, y + r * .06); g.stroke(); }); }
      shape(g, [...ell(hx, hy - r * .55, r * 1.02, r * .62, 20).filter(p => p[1] < hy - r * .5), [hx + r * 1.02, hy - r * .5], [hx - r * 1.02, hy - r * .5]], a);
      shape(g, [[hx - r * 1.0, hy - r * .58], [hx + r * 1.0, hy - r * .58], [hx + r * 1.0, hy - r * .45], [hx - r * 1.0, hy - r * .45]], b, { flat: true });
    } else if (k === 'feathers') {   // Sea Peoples / Philistine "feathered" headdress: band + row of upright strips
      for (let i = -5; i <= 5; i++) { const bx = hx + i * r * .17, tilt = i * .05; shape(g, [[bx - r * .07, hy - r * .55], [bx + r * .07, hy - r * .55], [bx + r * .05 + Math.sin(tilt) * r * .7, hy - r * 1.35], [bx - r * .05 + Math.sin(tilt) * r * .7, hy - r * 1.35]], i % 2 ? (c.hat || '#e8e0c8') : (c.hat2 || '#d4c7a0'), { lw: 4, flat: true }); }
      shape(g, [[hx - r * 1.02, hy - r * .66], [hx + r * 1.02, hy - r * .66], [hx + r * 1.02, hy - r * .44], [hx - r * 1.02, hy - r * .44]], c.trim || '#c0392b', { flat: true });
      for (let i = -4; i <= 4; i++) { g.fillStyle = '#e8c35a'; g.beginPath(); g.arc(hx + i * r * .22, hy - r * .55, r * .045, 0, 7); g.fill(); }
    } else if (k === 'headband') {
      shape(g, [[hx - r * 1.0, hy - r * .52], [hx + r * 1.0, hy - r * .6], [hx + r * 1.0, hy - r * .44], [hx - r * 1.0, hy - r * .36]], c.hat || '#b5452f', { flat: true });
      shape(g, [[hx + r * .95, hy - r * .5], [hx + r * 1.35, hy - r * .25], [hx + r * 1.2, hy - r * .15], [hx + r * .92, hy - r * .4]], c.hat || '#b5452f', { flat: true });
    } else if (k === 'captain') {     // sailor / captain cap with anchor badge
      shape(g, [...ell(hx, hy - r * .62, r * 1.0, r * .5, 20).filter(p => p[1] < hy - r * .55), [hx + r * 1.0, hy - r * .55], [hx - r * 1.0, hy - r * .55]], c.hat || '#f5f3ee');
      shape(g, [[hx - r * .95, hy - r * .6], [hx + r * .95, hy - r * .6], [hx + r * .95, hy - r * .44], [hx - r * .95, hy - r * .44]], c.hat2 || '#1f2a44', { flat: true });
      shape(g, [[hx - r * .2, hy - r * .5], [hx + r * 1.05, hy - r * .46], [hx + r * .9, hy - r * .34], [hx - r * .15, hy - r * .4]], c.hat2 || '#1f2a44');
      shape(g, ell(hx, hy - r * .82, r * .14, r * .14, 12), c.badge || '#e8b64a', { flat: true, lw: 3 });
    } else if (k === 'hood') {        // front rim of the hood
      g.save(); g.strokeStyle = shade(c.hat || '#f7b6c8', .8); g.lineWidth = r * .14; g.beginPath(); g.ellipse(hx, hy - r * .05, r * 1.18, r * 1.15, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke(); g.restore();
    } else if (k === 'scholar') {
      shape(g, [[hx - r * .7, hy - r * .8], [hx + r * .7, hy - r * .8], [hx + r * .6, hy - r * 1.25], [hx - r * .6, hy - r * 1.25]], c.hat || '#1d1d24');
      shape(g, ell(hx - r * .95, hy - r * .95, r * .32, r * .1, 12), c.hat || '#1d1d24'); shape(g, ell(hx + r * .95, hy - r * .95, r * .32, r * .1, 12), c.hat || '#1d1d24');
    }
  }
  function drawHead(g, S, hx, hy, ang, E, mouth, blink, t) {   // E may be replaced (kawaii blush)
    const r = S.head.size * 120, c = S.colors, w = r * (S.head.shape === 'square' ? 1.02 : S.head.shape === 'oval' ? .9 : 1), h = r * (S.head.shape === 'oval' ? 1.1 : S.head.shape === 'square' ? .95 : 1);
    g.save(); g.translate(hx, hy); g.rotate(ang); g.translate(-hx, -hy);
    // hair behind
    if (S.hair === 'long') shape(g, [...ell(hx, hy + r * .1, w * 1.08, h * 1.15, 20).filter(p => p[1] > hy - r * .4)], c.hair);
    if (S.hair === 'bun') shape(g, ell(hx, hy - h * 1.05, r * .32, r * .26), c.hair);
    // hood behind the head (kawaii hoodie) + animal ears
    if (S.hat === 'hood') shape(g, ell(hx, hy - r * .05, w * 1.3, h * 1.28, 26), c.hat || '#f7b6c8');
    if (S.ears) { const ec = c.earsColor || c.hat || c.hair, inner = c.earsInner || '#ffd6e0';
      [-1, 1].forEach(s2 => { if (S.ears === 'bunny') { shape(g, ell(hx + s2 * w * .45, hy - h * 1.45, r * .2, r * .6, 18, s2 * .15), ec); shape(g, ell(hx + s2 * w * .45, hy - h * 1.42, r * .1, r * .42, 14, s2 * .15), inner, { flat: true, lw: 3 }); }
        else if (S.ears === 'cat') { shape(g, [[hx + s2 * w * .35, hy - h * .85], [hx + s2 * w * .95, hy - h * 1.35], [hx + s2 * w * .95, hy - h * .55]], ec, { sharp: true }); }
        else { shape(g, ell(hx + s2 * w * .82, hy - h * .92, r * .34, r * .32, 18), ec); shape(g, ell(hx + s2 * w * .82, hy - h * .9, r * .18, r * .16, 14), inner, { flat: true, lw: 3 }); } }); }
    // ears + head
    shape(g, ell(hx - w * .98, hy + r * .1, r * .17, r * .22), c.skin); shape(g, ell(hx + w * .98, hy + r * .1, r * .17, r * .22), c.skin);
    const head = S.head.shape === 'square' ? [[hx - w, hy - h * .75], [hx + w, hy - h * .8], [hx + w * .95, hy + h * .55], [hx + w * .4, hy + h * .95], [hx - w * .4, hy + h * .95], [hx - w * .95, hy + h * .55]] : ell(hx, hy, w, h, 26);
    shape(g, head, c.skin);
    // hair top (cap of hair)
    if (S.hair && S.hair !== 'bald') shape(g, [...ell(hx, hy - h * .2, w * 1.02, h * .85, 22).filter(p => p[1] < hy - h * .35), [hx + w * .7, hy - h * .45], [hx, hy - h * .62], [hx - w * .7, hy - h * .45]], c.hair);
    // cheeks blush
    if (S.style === 'kawaii') E = { ...E, blush: Math.max(E.blush || 0, .7) };
    if (E.blush > .05) { g.fillStyle = `rgba(230,90,90,${.35 * E.blush})`; [[-1], [1]].forEach(([s]) => { g.beginPath(); g.ellipse(hx + s * w * .55, hy + h * .3, r * .17, r * .1, 0, 0, 7); g.fill(); }); }
    // eyes
    const ey = hy + h * .02, ex = w * .36, er = r * .17 * (S.eyes || 1), open = clamp(E.eye * (1 - blink), .04, 1.4);
    [-1, 1].forEach(s => { const cx = hx + s * ex;
      if (S.eyeStyle === 'sparkle' && open > .2) {                               // kawaii: big glossy iris, two highlights
        g.fillStyle = INK; g.beginPath(); g.ellipse(cx, ey, er * 1.05, er * 1.25 * Math.min(1, open), 0, 0, 7); g.fill();
        const gr = g.createLinearGradient(0, ey - er, 0, ey + er * 1.2); gr.addColorStop(0, c.eye || '#3a2a4a'); gr.addColorStop(1, shade(c.eye || '#7a5aa8', 1.5)); g.fillStyle = gr; g.beginPath(); g.ellipse(cx, ey + er * .1, er * .82, er * 1.0 * Math.min(1, open), 0, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx - er * .32, ey - er * .38, er * .32, er * .38, 0, 0, 7); g.fill(); g.beginPath(); g.arc(cx + er * .35, ey + er * .45, er * .14, 0, 7); g.fill();
      } else if (S.eyeStyle === 'dot' || (S.eyeStyle === 'sparkle' && open <= .2)) { g.fillStyle = INK; if (open > .2) { g.beginPath(); g.ellipse(cx, ey, er * .38, er * .5 * Math.min(1, open), 0, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx - er * .1, ey - er * .18, er * .12, 0, 7); g.fill(); }
        else { g.strokeStyle = INK; g.lineWidth = r * .06; g.beginPath(); g.arc(cx, ey - er * .2, er * .55, Math.PI * .15, Math.PI * .85); g.stroke(); } }
      else { shape(g, ell(cx, ey, er * .92, er * open, 16), '#fff', { lw: 5, flat: true }); }
      if (!S.eyeStyle && open > .2) { g.fillStyle = INK; g.beginPath(); g.arc(cx + s * er * .05 + Math.sin(t * .7) * er * .15, ey + er * .08, er * (S.lids ? .26 : .42) * Math.min(1, open), 0, 7); g.fill(); if (!S.lids) { g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + er * .12, ey - er * .08, er * .12, 0, 7); g.fill(); } }
      if (!S.eyeStyle && S.lids && open > .1) { g.strokeStyle = INK; g.lineWidth = r * .06; curve(g, jit([[cx - er * 1.05, ey - er * open * .35], [cx, ey - er * open * 1.02], [cx + er * 1.05, ey - er * open * .35]]), false); g.stroke();
        g.lineWidth = 3; curve(g, jit([[cx - er * .7, ey + er * open * 1.25], [cx, ey + er * open * 1.4], [cx + er * .7, ey + er * open * 1.25]]), false); g.stroke(); }
      // brows
      const inner = E.bi * r * .16, outer = E.bo * r * .12, lift = E.browUp && s > 0 ? r * .12 : 0, by = ey - er * 1.55 - lift;
      g.strokeStyle = INK; g.lineWidth = r * (S.style === 'kawaii' || S.style === 'flat' ? .05 : .085); g.lineCap = 'round'; curve(g, jit([[cx - s * er * 1.1, by - outer], [cx, by - (inner + outer) / 2 - r * .03], [cx + s * er * .9, by - inner]]), false); g.stroke(); });
    // nose
    if (S.nose === 'bulb') shape(g, ell(hx + r * .02, hy + h * .3, r * .17, r * .13, 16), shade(c.skin, .93), { lw: 5 });
    else { g.strokeStyle = INK; g.lineWidth = 5; curve(g, jit([[hx - r * .02, hy + h * .18], [hx + r * .07, hy + h * .3], [hx - r * .04, hy + h * .33]]), false); g.stroke(); }
    if (S.glasses) { g.strokeStyle = INK; g.lineWidth = 6; [-1, 1].forEach(s => { g.beginPath(); g.arc(hx + s * ex, ey, er * 1.45, 0, 7); g.fillStyle = 'rgba(255,255,255,.18)'; g.fill(); g.stroke(); });
      g.beginPath(); g.moveTo(hx - ex + er * 1.45, ey); g.quadraticCurveTo(hx, ey - er * .5, hx + ex - er * 1.45, ey); g.stroke(); }
    // beard / mustache (behind mouth for long beard)
    if (S.beard === 'long') shape(g, [[hx - w * .45, hy + h * .55], [hx + w * .45, hy + h * .55], [hx + r * .12, hy + h * 1.55], [hx, hy + h * 1.75], [hx - r * .12, hy + h * 1.55]], c.hair);
    if (S.beard === 'goatee') shape(g, [[hx - r * .2, hy + h * .78], [hx + r * .2, hy + h * .78], [hx, hy + h * 1.15]], c.hair);
    // mouth: curve + openness (lip-sync) + smirk / O
    const my = hy + h * .58, mw = r * .3 * E.mw, op = clamp(mouth + (E.o || 0) * .55, 0, 1.2), cv = E.curve * r * .14, sm = (E.smirk || 0) * r * .08;
    if (op > .08) { const oh = r * .22 * op; shape(g, [[hx - mw, my - cv * .4 - sm], [hx, my - oh * .25 + (cv < 0 ? -cv * .3 : 0)], [hx + mw, my - cv * .4 + sm], [hx + mw * .6, my + oh * .8], [hx, my + oh], [hx - mw * .6, my + oh * .8]], '#5a1f1f', { lw: 5 });
      g.fillStyle = '#e07a7a'; g.beginPath(); g.ellipse(hx, my + oh * .62, mw * .45, oh * .28, 0, 0, 7); g.fill();
      if (op > .35) { g.fillStyle = '#fbf7ec'; g.beginPath(); g.moveTo(hx - mw * .82, my - cv * .4 - sm + 3); g.lineTo(hx + mw * .82, my - cv * .4 + sm + 3); g.lineTo(hx + mw * .7, my + oh * .22); g.lineTo(hx - mw * .7, my + oh * .22); g.closePath(); g.fill(); } }
    else { g.strokeStyle = INK; g.lineWidth = 6; curve(g, jit([[hx - mw, my - cv - sm], [hx, my + cv * .6], [hx + mw, my - cv + sm]]), false); g.stroke(); }
    if (S.beard === 'mustache' || S.beard === 'long') { [-1, 1].forEach(s => shape(g, [[hx + s * r * .03, my - r * .12], [hx + s * mw * 1.3, my - r * .02], [hx + s * mw * 1.75, my + r * .22], [hx + s * mw * 1.1, my - r * .05]], c.hair, { lw: 4 })); }
    // extras
    if (E.sweat > .05) shape(g, [[hx + w * .8, hy - h * .5], [hx + w * .92, hy - h * .2], [hx + w * .8, hy - h * .12], [hx + w * .7, hy - h * .2]], '#8fd3ff', { lw: 4 });
    if (E.vein > .05) { g.strokeStyle = '#c0392b'; g.lineWidth = 6; [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([a, b]) => { g.beginPath(); g.moveTo(hx + w * .55 + a * r * .04, hy - h * .55 + b * r * .04); g.lineTo(hx + w * .55 + a * r * .13, hy - h * .55 + b * r * .13); g.stroke(); }); }
    drawHat(g, S, hx, hy, r);
    g.restore();
  }
  function limb(g, a, ang1, ang2, l1, l2, w, col, end, endCol) {
    const b = [a[0] + Math.sin(ang1) * l1, a[1] + Math.cos(ang1) * l1], c = [b[0] + Math.sin(ang1 + ang2) * l2, b[1] + Math.cos(ang1 + ang2) * l2];
    shape(g, capsule(a, b, w), col); shape(g, capsule(b, c, w * .9), col);
    if (end === 'hand') { shape(g, ell(c[0] + Math.sin(ang1 + ang2 + 1.2) * w * .38, c[1] + Math.cos(ang1 + ang2 + 1.2) * w * .38, w * .22, w * .2, 10), endCol, { lw: 5, flat: true }); shape(g, ell(c[0], c[1], w * .55, w * .6, 14), endCol, { flat: true }); } if (end === 'foot') shape(g, ell(c[0] + w * .3, c[1] + w * .15, w * .75, w * .42, 14), endCol);
    return c;
  }

  // ---------- public ----------
  const create = spec => ({ S: JSON.parse(JSON.stringify(spec)), seed: (spec.name || 'x').split('').reduce((a, c) => a + c.charCodeAt(0), 0) });
  const draw = (g, P, st) => {
    const S = P.S, c = S.colors, t = st.t || 0, sc = st.scale || 1, B = S.body || {};
    if (S.style === 'pixel' && !st._inner) {                                     // pixel art: draw at 1/px resolution, hard alpha, upscale without smoothing
      const px = st.pixel || S.pixel || 6, cv = g.canvas, w0 = Math.ceil(cv.width / px), h0 = Math.ceil(cv.height / px);
      if (!P._off || P._off.width !== w0 || P._off.height !== h0) P._off = MS.u.canvas(w0, h0);
      const og = P._off.getContext('2d'), m = g.getTransform(); og.setTransform(1, 0, 0, 1, 0, 0); og.clearRect(0, 0, w0, h0); og.setTransform(m.a / px, m.b / px, m.c / px, m.d / px, m.e / px, m.f / px);
      draw(og, P, { ...st, _inner: true, boil: 0 }); const d = og.getImageData(0, 0, w0, h0); for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] > 100 ? 255 : 0; og.putImageData(d, 0, 0);
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(P._off, 0, 0, w0 * px, h0 * px); g.restore(); return; }
    STY = S.style || 'doodle'; const fpsS = { paper: 6, watercolor: 8 }[STY], boilS = { kawaii: 0, flat: 0, pixel: 0, paper: 1.2, watercolor: 2.2 }[STY];
    R = rgen(P.seed * 1000 + Math.floor(t * (st.boilFps || fpsS || 10))); BOIL = st.boil ?? boilS ?? 1.6; CEL = S.shading !== false && STY !== 'kawaii' && STY !== 'watercolor'; INK = c.ink || (STY === 'watercolor' ? '#3a3640' : '#24160f'); LW = (S.line || 7);
    const pose = at(st.track, t, 'pose', POSES, 'idle'), E = at(st.track, t, 'expr', EXPR, 'neutral');
    const breathe = Math.sin(t * 2.1 + P.seed) * 4, sway = Math.sin(t * 1.3 + P.seed) * .02, talk = mouthOpen(st.words, t), blink = blinkAt(t, P.seed);
    g.save(); g.translate(st.x, st.y); g.scale(sc * (st.flip ? -1 : 1), sc);
    // ground shadow
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(0, 4, 140, 22, 0, 0, 7); g.fill();
    const legLen = 70 * (B.legs || 1), hip = [0, -legLen * 2 - 10], torsoH = 165 * (B.torso || 1), lean = pose.lean + sway, neck = [hip[0] + Math.sin(lean) * torsoH, hip[1] - Math.cos(lean) * torsoH + breathe];
    const shW = 74 * (B.width || 1), shL = [neck[0] - shW, neck[1] + 26], shR = [neck[0] + shW, neck[1] + 26], armW = 34 * (B.width || 1);
    const outfit = c.outfit, trim = c.trim || shade(outfit, .7);
    // back arm, legs
    limb(g, shR, pose.armR[0], pose.armR[1], 78, 70, armW, outfit, 'hand', c.skin);
    limb(g, [hip[0] - 34, hip[1]], pose.legL[0], pose.legL[1], legLen, legLen, 36, c.pants || shade(outfit, .6), 'foot', c.shoes || '#2a1d18');
    limb(g, [hip[0] + 34, hip[1]], pose.legR[0], pose.legR[1], legLen, legLen, 36, c.pants || shade(outfit, .6), 'foot', c.shoes || '#2a1d18');
    // torso: robe (long, flared) or tunic
    const robe = (S.outfit || 'robe') === 'robe', hemY = robe ? -24 : hip[1] + 18, hemW = robe ? 130 * (B.width || 1) : 92 * (B.width || 1);
    shape(g, [[shL[0] + 6, shL[1] - 8], [neck[0], neck[1] - 6], [shR[0] - 6, shR[1] - 8], [shR[0] + 10, shR[1] + 40], [hemW, hemY], [0, hemY + 8], [-hemW, hemY], [shL[0] - 10, shL[1] + 40]], outfit);
    // collar + belt + emblem
    g.strokeStyle = INK; g.lineWidth = LW; shape(g, [[neck[0] - 40, neck[1] + 2], [neck[0], neck[1] + 70], [neck[0] + 40, neck[1] + 2], [neck[0], neck[1] + 24]], trim);
    const beltY = lerp(neck[1], hemY, robe ? .5 : .78); shape(g, [[-hemW * .72, beltY - 14], [hemW * .72, beltY - 16], [hemW * .74, beltY + 14], [-hemW * .74, beltY + 16]], c.belt || trim);
    if (S.emblem) { g.save(); g.font = `900 46px ${MS.STYLE.font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = c.emblem || '#c0392b'; g.fillText(S.emblem, neck[0] + Math.sin(lean) * 40, beltY - 70); g.restore(); }
    if (S.outfit === 'vest') { const vy = lerp(neck[1], hemY, .35); [vy, vy + 70].forEach(yy => shape(g, [[-hemW * .66, yy - 9], [hemW * .66, yy - 11], [hemW * .68, yy + 9], [-hemW * .68, yy + 11]], '#e9eef2', { flat: true, lw: 4 })); }
    if (S.outfit === 'fur') for (let i = -3; i <= 3; i++) shape(g, [[i * hemW * .28 - 18, hemY - 4], [i * hemW * .28 + 18, hemY - 4], [i * hemW * .28, hemY + 26]], outfit, { lw: 5 });
    if (S.armor) for (let i = 0; i < 3; i++) shape(g, [[-hemW * .6, beltY + 30 + i * 34], [hemW * .6, beltY + 30 + i * 34], [hemW * .64, beltY + 58 + i * 34], [-hemW * .64, beltY + 58 + i * 34]], shade(c.armor || '#9aa3ad', 1 - i * .08));
    // head
    const headR = S.head.size * 120, hc = [neck[0] + Math.sin(lean) * headR * .9, neck[1] - headR * .92];
    drawHead(g, S, hc[0], hc[1], pose.head + lean * .5, E, talk * (st.talkGain ?? 1), blink, t);
    // front arm last (over body/head when gesturing)
    if (st.hold) { const hp = limb(g, shL, pose.armL[0], pose.armL[1], 78, 70, armW, outfit, null, c.skin); st.hold(g, hp, pose.armL[0] + pose.armL[1], t); shape(g, ell(hp[0], hp[1], armW * .55, armW * .6, 14), c.skin, { flat: true }); }
    else limb(g, shL, pose.armL[0], pose.armL[1], 78, 70, armW, outfit, 'hand', c.skin);
    g.restore(); STY = 'doodle';
  };
  const SAMPLES = {
    emperor: { name: 'emperor', head: { shape: 'round', size: 1.15 }, hair: 'bun', beard: 'long', hat: 'crown', outfit: 'robe', emblem: '龍', nose: 'bulb', lids: true,
      colors: { skin: '#f3e6d3', hair: '#1f1a1a', outfit: '#f2b632', trim: '#c0392b', belt: '#8e2b1f', hat: '#1d1d24', emblem: '#b03a2e' }, body: { width: 1.1 } },
    farmer: { name: 'farmer', head: { shape: 'oval', size: 1.05 }, hair: 'short', beard: 'none', hat: 'conical', outfit: 'tunic', nose: 'bulb',
      colors: { skin: '#ecd5bd', hair: '#2b2220', outfit: '#6b8f4e', trim: '#4e6a38', belt: '#7a5a3a', pants: '#3e4a5c', hat: '#e9d39a' }, body: { width: .95, legs: 1.05 } },
    general: { name: 'general', head: { shape: 'square', size: 1.1 }, hair: 'short', beard: 'goatee', hat: 'helmet', outfit: 'tunic', armor: true, nose: 'bulb', lids: true,
      colors: { skin: '#f0dcc6', hair: '#2a2020', outfit: '#5b3a8c', trim: '#d9a92e', belt: '#3a2a1a', pants: '#3b2f4a', hat: '#9aa3ad', hat2: '#c8463a', armor: '#d9a92e' }, body: { width: 1.2 } },
    scholar: { name: 'scholar', head: { shape: 'round', size: 1.12 }, hair: 'short', beard: 'mustache', hat: 'scholar', outfit: 'robe', nose: 'bulb', glasses: true, lids: true,
      colors: { skin: '#f3e8da', hair: '#2a2424', outfit: '#2f4f8f', trim: '#d9a92e', belt: '#1f2f55', hat: '#1d1d24' }, body: { width: 1 } },
    // ---- cute characters, one per drawing style (references/characters.md) ----
    mochi: { name: 'mochi', style: 'kawaii', head: { shape: 'round', size: 1.55 }, hair: 'short', hat: 'hood', ears: 'bear', outfit: 'tunic', eyeStyle: 'sparkle', eyes: 1.35,
      colors: { skin: '#ffe3d3', hair: '#5a3a2e', outfit: '#f7b6c8', hat: '#f7b6c8', earsInner: '#ffd6e0', pants: '#8fb8e8', shoes: '#6d5a8a', belt: '#f39bb5', trim: '#f39bb5', eye: '#5b3b8a' }, body: { torso: .72, legs: .62, width: .9 } },
    pip: { name: 'pip', style: 'flat', head: { shape: 'round', size: 1.3 }, hair: 'short', beard: 'mustache', glasses: true, outfit: 'robe', eyeStyle: 'dot',
      colors: { skin: '#f6c9a8', hair: '#d9d3ca', outfit: '#f4f6f8', trim: '#3d7be0', belt: '#3d7be0', pants: '#33415c', shoes: '#2b2f3a', ink: '#2b2f3a' }, body: { torso: .85, legs: .75, width: 1.05 } },
    coco: { name: 'coco', style: 'paper', head: { shape: 'oval', size: 1.35 }, hair: 'bun', hat: 'captain', outfit: 'tunic', eyeStyle: 'dot',
      colors: { skin: '#f1c7a1', hair: '#8a4422', outfit: '#2f5aa8', trim: '#f5f3ee', belt: '#e85d4a', pants: '#f5f3ee', shoes: '#4a2f22', hat: '#f5f3ee', hat2: '#1f2a44', badge: '#e8b64a', ink: '#2a2230' }, body: { torso: .78, legs: .7, width: .92 } },
    bo: { name: 'bo', style: 'pixel', head: { shape: 'round', size: 1.4 }, hair: 'short', hat: 'helmet', armor: true, outfit: 'tunic', eyeStyle: 'dot', pixel: 6,
      colors: { skin: '#ffd7b5', hair: '#3a2a20', outfit: '#c0392b', trim: '#f1c40f', belt: '#6b3d1f', pants: '#4a4a5a', shoes: '#2a2a2a', hat: '#b8c2cc', hat2: '#e74c3c', armor: '#b8c2cc', ink: '#1b1b24' }, body: { torso: .75, legs: .65, width: 1 } },
    lua: { name: 'lua', style: 'watercolor', head: { shape: 'round', size: 1.3 }, hair: 'bun', glasses: true, outfit: 'robe', eyeStyle: 'dot', nose: 'bulb',
      colors: { skin: '#f3d9c4', hair: '#e6e1d8', outfit: '#7b9e87', trim: '#c9845c', belt: '#a86a4a', pants: '#5d6b7a', shoes: '#5a4033' }, body: { torso: .82, legs: .7, width: 1.05 } },
  };
  // shared hand-drawn primitives for props and backgrounds (call MS.puppet.pen(t, seed) once per frame first)
  const pen = (t, seed = 1, { boil = 1.6, fps = 10, ink = '#24160f', lw = 7, cel: cs = true, style = 'doodle' } = {}) => { R = rgen(seed * 1000 + Math.floor(t * fps)); BOIL = boil; INK = ink; LW = lw; CEL = cs; STY = style; };
  MS.puppet = { create, draw, POSES, EXPR, SAMPLES, mouthOpen, pen, shape, ell, capsule, shade, curve: (g, pts, closed) => curve(g, jit(pts), closed) };
})();
