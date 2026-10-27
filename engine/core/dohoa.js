// mega-shot · animated graphics explaining figures (placed in the middle band, avoiding the title above and subtitles below).
// Scene declared in video.yaml:  do_hoa: { kieu: so-sanh-cao | dem-so | banh-tron | thanh-ty-le, … }
// Depth gauge running through the whole video:     do_sau: 200   (one value per scene; name/unit changed via phong_cach.thuoc)
(() => {
  const MS = window.MS, { clamp, eo3, eio, back } = MS.u;
  MS.dh = {};
  const S = () => MS.STYLE, F = () => MS.FMT;
  const so = (n, d = 0) => Number(n).toLocaleString(String(MS.LANG || 'vi').startsWith('vi') ? 'vi-VN' : 'en-US', { maximumFractionDigits: d });   // English: 22.9 instead of 22,9
  const un = u => u ? (/^[%‰°]/.test(u) ? u : ' ' + u) : '';                       // "33%" (no space), "5 km"
  const txt = (x, s, X, Y, size, col = '#fff', w = 800, al = 'center') => { x.font = `${w} ${size}px ${S().font}`; x.textAlign = al; x.textBaseline = 'middle'; x.lineJoin = 'round';
    x.lineWidth = Math.max(4, size * .1); x.strokeStyle = 'rgba(0,0,0,.6)'; x.strokeText(s, X, Y); x.fillStyle = col; x.fillText(s, X, Y); };
  const panel = (x, X, Y, w, h, a) => { x.save(); x.globalAlpha = a; x.fillStyle = 'rgba(6,14,26,.55)'; x.beginPath(); x.roundRect(X, Y, w, h, 34); x.fill(); x.strokeStyle = 'rgba(160,220,255,.25)'; x.lineWidth = 2; x.stroke(); x.restore(); };
  const ACC = () => S().accent2 || '#7fd6ff';

  // ---------- depth gauge (left of screen): log scale, needle slides smoothly between the scenes' values ----------
  MS.dh.thuoc = (x, t, TL) => {
    const pts = TL.scenes.filter(s => s.data && s.data.do_sau != null).map(s => [s.t0 + .3, +s.data.do_sau]); if (!pts.length) return;
    if (t < pts[0][0] - .4) return;                                               // only shown from the first scene that has do_sau, starting at 0
    const cur = TL.scenes.find(s => t >= s.t0 && t < s.t1) || {}, on = cur.data && cur.data.do_sau > 0;
    const nx = TL.scenes.find(s => s.t0 > t && s.t0 - t < .5), fadeOut = on ? (nx && !(nx.data && nx.data.do_sau > 0) ? clamp((nx.t0 - t) / .5) : 1) : 0; if (fadeOut <= 0) return;   // hidden in the above-water / closing scene
    let v = 0;
    for (let i = 0; i < pts.length; i++) { const [t0, d] = pts[i], prev = i ? pts[i - 1][1] : 0; if (t >= t0) v = prev + (d - prev) * eio(clamp((t - t0) / 1.4)); }
    const cfg = (TL.style && TL.style.thuoc) || {}, max = cfg.max || 11000, ticks = cfg.moc || [0, 200, 1000, 4000, 11000], unit = cfg.don_vi ?? 'm';
    const X = 58, Y0 = 560, Y1 = 1280, Y = d => Y0 + (Y1 - Y0) * Math.log10(1 + d) / Math.log10(1 + max);
    const a = clamp((t - pts[0][0] + .4) / .8) * fadeOut; x.save(); x.globalAlpha = a * .85;
    x.strokeStyle = 'rgba(220,240,255,.45)'; x.lineWidth = 3; x.beginPath(); x.moveTo(X, Y0); x.lineTo(X, Y1); x.stroke();
    ticks.forEach(d => { const y = Y(d); x.beginPath(); x.moveTo(X - 9, y); x.lineTo(X + 9, y); x.stroke(); x.globalAlpha = a * .7; txt(x, so(d), X + 18, y, 24, 'rgba(225,240,255,.9)', 600, 'left'); x.globalAlpha = a * .85; });
    const y = Y(v); x.globalAlpha = a; const g = x.createRadialGradient(X, y, 0, X, y, 26); g.addColorStop(0, 'rgba(127,214,255,.9)'); g.addColorStop(1, 'rgba(127,214,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(X, y, 26, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(X, y, 7, 0, 7); x.fill();
    txt(x, `${Math.round(v) ? '−' : ''}${so(Math.round(v))}${un(unit)}`, X + 22, y - 34, 30, ACC(), 800, 'left'); x.restore();
  };

  // ---------- history timeline (top strip): needle follows each scene's `nam` (negative = BCE) ----------
  MS.dh.thoigian = (x, t, TL) => {
    const pts = TL.scenes.filter(s => s.data && s.data.nam != null).map(s => [s.t0 + .3, +s.data.nam]); if (!pts.length || t < pts[0][0] - .4) return;
    const cfg = (TL.style && TL.style.thoi_gian) || {}, en = String(TL.lang || '').startsWith('en'), seg = cfg.doan || [[-1300, 0, 0, .38], [0, 1800, .38, .7], [1800, 2030, .7, 1]];
    const f = y => { for (const [a, b, u, v] of seg) if (y <= b) return u + (v - u) * (y - a) / (b - a); return 1; };
    let v = pts[0][1]; for (let i = 0; i < pts.length; i++) { const [t0, y] = pts[i], prev = i ? pts[i - 1][1] : y; if (t >= t0) v = prev + (y - prev) * eio(clamp((t - t0) / 1.6)); }
    const W = MS.FMT.W, X0 = W * .18, X1 = W * .82, Y = (MS.FMT.bar || 120) * .5, X = X0 + (X1 - X0) * f(v), a = clamp((t - pts[0][0] + .4) / .8);
    const lab = y => y < 0 ? `${-Math.round(y)} ${en ? 'BCE' : 'TCN'}` : `${Math.max(1, Math.round(y))}${y < 1000 ? (en ? ' CE' : '') : ''}`;   // year: no thousands separator
    x.save(); x.globalAlpha = a * .9; x.strokeStyle = 'rgba(230,220,200,.35)'; x.lineWidth = 2; x.beginPath(); x.moveTo(X0, Y); x.lineTo(X1, Y); x.stroke();
    x.strokeStyle = 'rgba(255,210,120,.85)'; x.lineWidth = 3; x.beginPath(); x.moveTo(X0, Y); x.lineTo(X, Y); x.stroke();
    (cfg.moc || [-1000, 1, 1000, 1900, 2000]).forEach(y => { const xx = X0 + (X1 - X0) * f(y); x.fillStyle = 'rgba(230,220,200,.55)'; x.fillRect(xx - 1, Y - 6, 2, 12); txt(x, lab(y), xx, Y + 24, 18, 'rgba(230,220,200,.75)', 600); });
    const g = x.createRadialGradient(X, Y, 0, X, Y, 22); g.addColorStop(0, 'rgba(255,210,120,.9)'); g.addColorStop(1, 'rgba(255,210,120,0)'); x.fillStyle = g; x.beginPath(); x.arc(X, Y, 22, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(X, Y, 6, 0, 7); x.fill(); txt(x, lab(v), X, Y - 26, 26, '#ffd27a', 800); x.restore();
  };

  // ---------- height/depth comparison: the mountain sinks into the trench, leaving water space above ----------
  MS.dh['so-sanh-cao'] = (x, c, d) => {
    const W = c.W, p = clamp((c.vt + .2) / Math.max(1.5, c.vdur * .7)), a = clamp(c.vt / .4 + .5) * (c.ra ? 0 : 1); if (a <= 0) return;
    const X0 = 150, X1 = W - 150, top = 560, bot = 1240, sea = top + 40, sau = d.sau || 10935, nui = d.nui || 8849, k = (bot - sea) / sau;
    panel(x, X0 - 40, top - 70, X1 - X0 + 80, bot - top + 140, a * .9); x.save(); x.globalAlpha = a;
    x.strokeStyle = 'rgba(140,210,255,.8)'; x.lineWidth = 3; x.beginPath(); x.moveTo(X0, sea); x.lineTo(X1, sea); x.stroke(); txt(x, d.mat || 'mặt biển', X0 + 10, sea - 28, 32, 'rgba(200,235,255,.95)', 700, 'left');
    const cx = (X0 + X1) / 2, tw = 300; x.fillStyle = 'rgba(10,30,60,.85)'; x.beginPath(); x.moveTo(cx - tw, sea); x.lineTo(cx - 80, bot); x.lineTo(cx + 80, bot); x.lineTo(cx + tw, sea); x.closePath(); x.fill();
    txt(x, `đáy ${so(sau)} m`, cx + 95, bot - 24, 32, ACC(), 800, 'left');
    const yb = bot, yt = yb - nui * k, drop = (1 - eio(p)) * (yb - sea + 80);                      // the mountain falls from the top to the seabed
    x.save(); x.beginPath(); x.rect(X0 - 40, top - 70, X1 - X0 + 80, bot - top + 140); x.clip(); x.translate(0, -drop); x.fillStyle = '#e8eef5'; x.beginPath(); x.moveTo(cx - 150, yb); x.lineTo(cx - 30, yt + 30); x.lineTo(cx, yt); x.lineTo(cx + 40, yt + 40); x.lineTo(cx + 150, yb); x.closePath(); x.fill();
    x.fillStyle = 'rgba(110,125,145,.9)'; x.beginPath(); x.moveTo(cx - 150, yb); x.lineTo(cx - 40, yt + 120); x.lineTo(cx + 150, yb); x.fill(); txt(x, d.ten_nui || 'Everest', cx - 165, yt + 70, 36, '#fff', 800, 'right'); x.restore();
    if (p > .95) { const q = eo3(clamp((p - .95) / .05)), y2 = yt; x.globalAlpha = a * q; x.strokeStyle = '#ffd25a'; x.lineWidth = 4; x.setLineDash([10, 8]);
      x.beginPath(); x.moveTo(cx + 60, sea + 6); x.lineTo(cx + 60, y2 - 6); x.stroke(); x.setLineDash([]); txt(x, d.nhan || `còn ~${so((sau - nui) / 1000, 1)} km nước`, cx + 80, (sea + y2) / 2, 34, '#ffd25a', 800, 'left'); }
    x.restore();
  };

  // ---------- counting number up ----------
  MS.dh['dem-so'] = (x, c, d) => {
    const a = clamp(c.vt / .3 + .3) * (c.ra ? 0 : 1); if (a <= 0) return; const p = eo3(clamp(c.vt / Math.max(1.2, c.vdur * .55)));
    const tu = d.tu ?? 0, den = d.den, v = d.log ? Math.exp(Math.log(Math.max(tu, 1)) + (Math.log(den) - Math.log(Math.max(tu, 1))) * p) : tu + (den - tu) * p, Y = d.y ?? 820;
    panel(x, 170, Y - 170, c.W - 300, 330, a * .85); x.save(); x.globalAlpha = a;
    const pop = 1 + .06 * Math.exp(-Math.max(0, c.vt - Math.max(1.2, c.vdur * .55)) * 8) * (p > .99 ? 1 : 0); x.translate(c.W / 2, Y - 20); x.scale(pop, pop);
    txt(x, (d.truoc || '') + so(Math.round(v)) + un(d.don_vi), 0, 0, 132, '#fff', 900); x.restore(); x.save(); x.globalAlpha = a;
    if (d.nhan) txt(x, d.nhan, c.W / 2, Y + 105, 38, ACC(), 700); x.restore();
  };

  // ---------- proportion circle ----------
  MS.dh['banh-tron'] = (x, c, d) => {
    const a = clamp(c.vt / .3 + .3) * (c.ra ? 0 : 1); if (a <= 0) return; const p = eio(clamp(c.vt / Math.max(1, c.vdur * .5))), r = 190, X = c.W / 2, Y = 830, v = d.ty_le * p;
    panel(x, X - 300, Y - 270, 600, 560, a * .85); x.save(); x.globalAlpha = a; x.lineCap = 'round';
    x.lineWidth = 42; x.strokeStyle = 'rgba(255,255,255,.15)'; x.beginPath(); x.arc(X, Y - 20, r, 0, 7); x.stroke();
    x.strokeStyle = d.mau || ACC(); x.beginPath(); x.arc(X, Y - 20, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v); x.stroke();
    txt(x, d.chu || `${Math.round(v * 100)}%`, X, Y - 20, 96, '#fff', 900); if (d.nhan) txt(x, d.nhan, X, Y + 235, 34, 'rgba(225,240,255,.95)', 700); x.restore();
  };

  // ---------- proportion bar ----------
  MS.dh['thanh-ty-le'] = (x, c, d) => {
    const a = clamp(c.vt / .3 + .3) * (c.ra ? 0 : 1); if (a <= 0) return; const p = eio(clamp(c.vt / Math.max(1, c.vdur * .5))), X0 = 190, X1 = c.W - 130, Y = 820, v = d.ty_le * p;
    panel(x, X0 - 40, Y - 150, X1 - X0 + 80, 300, a * .85); x.save(); x.globalAlpha = a;
    x.fillStyle = 'rgba(255,255,255,.14)'; x.beginPath(); x.roundRect(X0, Y - 26, X1 - X0, 52, 26); x.fill();
    x.fillStyle = d.mau || ACC(); x.beginPath(); x.roundRect(X0, Y - 26, Math.max(52, (X1 - X0) * v), 52, 26); x.fill();
    txt(x, d.chu || `${Math.round(v * 100)}%`, X0, Y - 85, 64, '#fff', 900, 'left'); if (d.nhan) txt(x, d.nhan, X0, Y + 78, 34, 'rgba(225,240,255,.95)', 700, 'left'); x.restore();
  };

  // ---------- multi-value comparison: horizontal bars growing together (e.g. tube worm 2 m vs human 1.7 m) ----------
  MS.dh['so-sanh'] = (x, c, d) => {
    const a = clamp(c.vt / .3 + .3) * (c.ra ? 0 : 1); if (a <= 0) return; const p = eio(clamp(c.vt / Math.max(1.2, c.vdur * .5))), it = d.muc || [], mx = Math.max(...it.map(m => m.gt));
    const side = d.vi_tri === 'phai' ? 1 : d.vi_tri === 'trai' ? -1 : 0;   // vi_tri: trai|phai → panel sits in the side strip (a portrait image/map in the middle stays uncovered)
    const ngang = c.H < 1400, rh = ngang ? Math.min(150, (c.H - 300) / Math.max(1, it.length)) : 150;   // landscape 16:9 frame: shrink row spacing to fit the height (previously rows 4–5 fell outside the frame)
    const X0 = side > 0 ? c.W * .655 : side < 0 ? 110 : 190, X1 = side > 0 ? c.W - 70 : side < 0 ? c.W * .345 : c.W - 130, Y = d.y ?? (ngang ? (c.H - 140 - it.length * rh) / 2 + 80 : side ? c.H * .52 : 900 - it.length * 75); panel(x, X0 - 40, Y - 80, X1 - X0 + 80, it.length * rh + 60, a * .85); x.save(); x.globalAlpha = a;
    it.forEach((m, i) => { const y = Y + i * rh, w = (X1 - X0 - 170) * m.gt / mx * p;   /* leave 170 px for the value label: no overflow past the edge */
      txt(x, m.ten, X0, y, 34, 'rgba(225,240,255,.95)', 700, 'left'); x.fillStyle = 'rgba(255,255,255,.14)'; x.beginPath(); x.roundRect(X0, y + 30, X1 - X0, 40, 20); x.fill();
      x.fillStyle = m.mau || (i ? 'rgba(200,215,235,.85)' : ACC()); x.beginPath(); x.roundRect(X0, y + 30, Math.max(40, w), 40, 20); x.fill();
      txt(x, `${so(m.gt * p, 1)}${un(d.don_vi)}`, X0 + Math.max(40, w) + 16, y + 50, 34, '#fff', 800, 'left'); });
    x.restore();
  };

  // ---------- metallic rock nodule on the seabed (polymetallic): electric arcs flash, releasing O₂ bubbles — illustrates the "tiny battery" hypothesis ----------
  MS.dh['da-kim-loai'] = (x, c, d) => {
    const a = clamp(c.vt / .4 + .2) * (c.ra ? 0 : 1); if (a <= 0) return; const W = c.W, Y = d.y ?? 1640, t = c.lt, r = MS.u.rgen(31);
    x.save(); x.globalAlpha = a;
    const g = x.createLinearGradient(0, Y - 220, 0, c.H); g.addColorStop(0, 'rgba(4,10,18,0)'); g.addColorStop(.45, 'rgba(4,10,18,.7)'); g.addColorStop(1, 'rgba(4,10,18,.9)'); x.fillStyle = g; x.fillRect(0, Y - 220, W, c.H - Y + 220);   // seabed backdrop fades up, no hard edge
    const nod = Array.from({ length: 8 }, (_, i) => [190 + i * 105 + r() * 35, Y - 10 + r() * 60, 34 + r() * 26, r() * 6.28]);
    nod.forEach(([nx, ny, nr]) => { const gg = x.createRadialGradient(nx - nr * .35, ny - nr * .4, nr * .1, nx, ny, nr); gg.addColorStop(0, '#6d7884'); gg.addColorStop(.5, '#2b333d'); gg.addColorStop(1, '#0d1116');
      x.fillStyle = gg; x.beginPath(); x.ellipse(nx, ny, nr * 1.15, nr * .8, 0, 0, 7); x.fill(); });
    for (let k = 0; k < nod.length - 1; k++) { const [x1, y1] = nod[k], [x2, y2] = nod[k + 1], ph = (t * 1.7 + k * .37) % 1; if (ph > .18) continue;   // short electric arc flashes, one after another
      x.strokeStyle = `rgba(150,220,255,${(1 - ph / .18) * .9})`; x.lineWidth = 2.5; x.shadowColor = '#8fdcff'; x.shadowBlur = 14; x.beginPath(); x.moveTo(x1, y1 - 20);
      for (let s = 1; s < 6; s++) x.lineTo(x1 + (x2 - x1) * s / 6, y1 - 20 + (y2 - y1) * s / 6 + Math.sin(t * 40 + s * 2 + k) * 10); x.lineTo(x2, y2 - 20); x.stroke(); x.shadowBlur = 0; }
    for (let b = 0; b < 16; b++) { const sx = nod[b % nod.length][0] + Math.sin(b * 7) * 20, life = (t * .35 + b * .137) % 1, by = Y - 40 - life * 700, bs = 5 + (b % 4) * 2;
      x.globalAlpha = a * (1 - life) * .9; x.strokeStyle = 'rgba(220,245,255,.95)'; x.lineWidth = 1.5; x.beginPath(); x.arc(sx + Math.sin(life * 9 + b) * 8, by, bs, 0, 7); x.stroke();
      if (b % 4 === 0) txt(x, 'O₂', sx + 24, by, 34, 'rgba(200,240,255,.95)', 800, 'left'); }
    x.restore();
  };

  MS.dh.ve = (x, c) => { const d = c.data.do_hoa; if (!d) return; const f = MS.dh[d.kieu]; if (f) f(x, c, d); };
})();
