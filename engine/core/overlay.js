// mega-shot · shared text layers: subtitles, titles/counters, annotation labels, chips, word-by-word text, film grain, vignette.
// All positions come from MS.FMT (frame format), so switching 16:9 ↔ 9:16 needs no scene edits.
(() => {
  const MS = window.MS, { clamp, lerp, eo3, back, rgen, canvas } = MS.u;
  // frame + safe area (TikTok/Reels/Shorts cover ~420px at the bottom, ~120px at the top)
  MS.FORMATS = {
    '9x16': { W: 1080, H: 1920, subY: 1440, subBot: 1500, subSize: 50, subMaxW: 760, bar: 0, headY: 150, tagX: 930, tagY0: 560, tagGap: 100 },   // must be ≤ 930: TikTok button column
    '16x9': { W: 1920, H: 1080, subY: 1025, subSize: 34, subMaxW: 1700, bar: 110, headY: 190, tagX: 1860, tagY0: 300, tagGap: 80 },
    '1x1': { W: 1080, H: 1080, subY: 960, subBot: 1010, subSize: 42, subMaxW: 940, bar: 0, headY: 110, tagX: 1044, tagY0: 260, tagGap: 84 },
  };
  MS.STYLE = { font: '"Segoe UI","Helvetica Neue","Noto Sans","Noto Sans CJK SC","Noto Sans Thai",Arial,sans-serif', accent: '#ffc46a', subBg: 'rgba(8,10,16,.6)', subFg: '#ffffff', subHot: '#ffd25a', subKey: '#8fdcff', accent2: '#7fd6ff', grain: 12 };
  const F = () => MS.FMT, S = () => MS.STYLE;
  // language-aware line breaking: has spaces → by word; zh/ja/th → by character
  const NOSPACE = /^(zh|ja|th|lo|km|my)/;
  MS.wrap = (x, text, maxW, lang = MS.LANG || 'vi') => {
    const units = NOSPACE.test(lang) ? [...text] : text.split(' '), sep = NOSPACE.test(lang) ? '' : ' ', lines = []; let cur = '';
    units.forEach(w => { const tr = cur ? cur + sep + w : w; if (x.measureText(tr).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tr; }); if (cur) lines.push(cur); return lines;
  };
  // balanced line breaking: keep the minimum number of lines but narrow the width until lines are even (no lone word on the last line)
  MS.wrapBal = (x, text, maxW, lang) => {
    const n = MS.wrap(x, text, maxW, lang).length; if (n < 2) return MS.wrap(x, text, maxW, lang);
    let lo = maxW / n * .8, hi = maxW;
    for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (MS.wrap(x, text, m, lang).length > n) lo = m; else hi = m; }
    return MS.wrap(x, text, hi, lang);
  };
  // ---------- subtitles: in the bottom area (not covering the picture), the word being read lights up, keywords/numbers are coloured ----------
  // s.w = [[word, t0, t1, key], …] produced by xp from Whisper timestamps; if missing, the whole sentence is one colour as before.
  MS.subtitle = (x, t, subs) => {
    const s = subs.find(o => t >= o.t0 && t < o.t1 + .12); if (!s) return;
    const style = MS.tfx ? MS.tfx.subStyle() : 'box'; if (style !== 'box' && MS.tfx.SUB[style]) return MS.tfx.SUB[style](x, t, s);   // animated subtitle styles (textfx.js)
    const f = F(), st = S(); x.save(); x.globalAlpha = clamp((t - s.t0) / .1) * clamp((s.t1 + .12 - t) / .12);
    x.font = `${f.bar ? 600 : 800} ${f.subSize}px ${st.font}`; x.textBaseline = 'middle'; x.textAlign = 'left'; x.lineJoin = 'round';
    const lines = MS.wrapBal(x, s.s, f.subMaxW), lh = f.subSize * 1.3, sp = x.measureText(' ').width;
    const ws = s.w || s.s.split(' ').map(w => [w, s.t0, s.t1, 0]); let k = 0;
    const L = lines.map(l => { const n = l.split(' ').length, r = ws.slice(k, k + n); k += n; return r; });
    const width = r => r.reduce((a, w) => a + x.measureText(w[0]).width, 0) + sp * (r.length - 1);
    let y0;
    if (!f.bar) { const bw = Math.max(...L.map(width)) + 60, bh = L.length * lh + 26, by = f.subBot ? f.subBot - bh : f.subY - bh / 2; y0 = by + 13 + lh / 2;
      x.fillStyle = st.subBg; x.beginPath(); x.roundRect(f.W / 2 - bw / 2, by, bw, bh, 24); x.fill(); }
    else y0 = f.subY - (L.length - 1) * lh / 2;
    L.forEach((r, li) => {
      let xx = f.W / 2 - width(r) / 2; const yy = y0 + li * lh;
      r.forEach(w => {
        const ww = x.measureText(w[0]).width, cur = t >= w[1] && t < w[2], bump = cur && w[3] ? 1 + .07 * Math.sin(Math.PI * clamp((t - w[1]) / Math.max(.15, w[2] - w[1]))) : 1;
        x.save(); x.translate(xx + ww / 2, yy); x.scale(bump, bump);
        x.lineWidth = 7; x.strokeStyle = 'rgba(0,0,0,.55)'; x.strokeText(w[0], -ww / 2, 0);
        x.fillStyle = cur ? (st.subHot || '#ffd25a') : w[3] ? (st.subKey || '#8fdcff') : st.subFg; x.fillText(w[0], -ww / 2, 0); x.restore();
        xx += ww + sp;
      });
    });
    x.restore();
  };
  // ---------- two-tier title (e.g. year + period name) ----------
  MS.header = (x, big, small, a = 1, smallP = 1) => {
    if (a <= 0) return; const f = F(); x.save(); x.globalAlpha = a; x.fillStyle = 'rgba(14,8,16,.55)'; x.beginPath(); x.roundRect(f.W / 2 - 320, f.headY - 72, 640, small ? 205 : 140, 40); x.fill();
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 20; x.font = `800 108px ${S().font}`; x.fillStyle = '#fff'; x.fillText(big, f.W / 2, f.headY);
    if (small) { x.globalAlpha = a * clamp(smallP); x.font = `600 50px ${S().font}`; x.fillStyle = '#ffe0b8'; x.fillText(small, f.W / 2, f.headY + 88 + 16 * (1 - eo3(smallP))); } x.restore();
  };
  // ---------- annotation label: dot at the anchor, leader line to the label column on the right ----------
  MS.tag = (x, label, ax, ay, p, o = {}) => {
    if (p <= 0) return; const f = F(), slot = o.slot || 0, Y = o.y ?? (f.tagY0 + slot * f.tagGap), q = eo3(p * 1.7), warn = o.warn;
    x.save(); x.font = `700 ${o.size || 40}px ${S().font}`; const txt = (warn ? '⚠ ' : '') + label, w = x.measureText(txt).width + 48, hh = (o.size || 40) + 28, bx = o.giua ? f.W / 2 - w / 2 : Math.max(f.tagX - w, 40);
    x.globalAlpha = clamp(p * 3);
    if (ax != null) {                                                             // no anchor point → label stands alone, no leader line
      x.strokeStyle = 'rgba(255,255,255,.95)'; x.lineWidth = 3; x.beginPath(); x.moveTo(ax, ay); x.lineTo(lerp(ax, bx + 6, q), lerp(ay, Y, q)); x.stroke();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(ax, ay, 7, 0, 7); x.fill(); x.strokeStyle = warn ? '#ff3b3b' : '#fff'; x.lineWidth = 2; x.beginPath(); x.arc(ax, ay, 13 + 4 * Math.sin(p * 9), 0, 7); x.stroke();
    }
    const sc = back(p, 1.2); x.translate(bx + w / 2, Y); x.scale(sc, sc);
    x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.roundRect(-w / 2 + 4, -hh / 2 + 6, w, hh, hh / 2); x.fill();
    x.fillStyle = warn ? '#e8323a' : (o.bg || 'rgba(255,255,255,.95)'); x.beginPath(); x.roundRect(-w / 2, -hh / 2, w, hh, hh / 2); x.fill();
    x.fillStyle = warn ? '#fff' : (o.fg || '#1a1016'); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, 0, 2); x.restore();
  };
  // ---------- chip (pill) pops in ----------
  MS.chip = (x, label, X, Y, p, bg = 'rgba(255,255,255,.92)', fg = '#140c02', size = 32) => {
    if (p <= 0) return; x.save(); x.font = `600 ${size}px ${S().font}`; const w = x.measureText(label).width + 48, h = size + 26; x.translate(X, Y); x.globalAlpha = clamp(p * 2.5); const sc = back(p, 1.2); x.scale(sc, sc);
    x.fillStyle = bg; x.beginPath(); x.roundRect(-w / 2, -h / 2, w, h, h / 2); x.fill(); x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(label, 0, 2); x.restore();
  };
  // ---------- word-by-word text (or character-by-character for zh/ja/th) ----------
  MS.words = (x, s, X, Y, t0, lt, size, col = '#fff', weight = 800) => {
    if (lt < t0) return; const a0 = x.globalAlpha; x.save(); x.font = `${weight} ${size}px ${S().font}`; const ns = NOSPACE.test(MS.LANG || 'vi'), ws = ns ? [...s] : s.split(' '), sp = ns ? 0 : x.measureText(' ').width;
    const tw = ws.reduce((a, w) => a + x.measureText(w).width, 0) + sp * (ws.length - 1); let xx = X - tw / 2; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.lineWidth = Math.max(4, size * .09); x.strokeStyle = 'rgba(0,0,0,.55)';
    ws.forEach((w, i) => { const q = eo3((lt - t0 - i * (ns ? .05 : .12)) / .45), yy = Y + 24 * (1 - q); x.globalAlpha = q * a0;   /* a0: overall opacity set by the caller (e.g. title fading) */ x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = 26; x.strokeText(w, xx, yy); x.shadowBlur = 0; x.fillStyle = typeof col === 'function' ? col(w) : col; x.fillText(w, xx, yy); xx += x.measureText(w).width + sp; }); x.restore();   // dark outline: readable on bright backgrounds
  };
  // ---------- 2D post-processing ----------
  let grainTex = null;
  MS.grain = (x, t, amt = S().grain) => { if (!grainTex) { grainTex = canvas(256, 256); const gx = grainTex.getContext('2d'), id = gx.createImageData(256, 256), r = rgen(9); for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = amt; } gx.putImageData(id, 0, 0); }
    const f = F(); x.save(); x.globalCompositeOperation = 'overlay'; x.translate(-((t * 977 | 0) % 256), -((t * 613 | 0) % 256)); x.fillStyle = x.createPattern(grainTex, 'repeat'); x.fillRect(0, 0, f.W + 256, f.H + 256); x.restore(); };
  MS.vignette = (x, a = .42) => { const f = F(), gr = x.createRadialGradient(f.W / 2, f.H / 2, Math.min(f.W, f.H) * .3, f.W / 2, f.H / 2, Math.max(f.W, f.H) * .55); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${a})`); x.fillStyle = gr; x.fillRect(0, 0, f.W, f.H); };
  MS.topShade = (x, a = .45, h = 330) => { const f = F(), gr = x.createLinearGradient(0, f.bar, 0, f.bar + h); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, f.bar, f.W, h); };
  MS.letterbox = x => { const f = F(); if (!f.bar) return; x.fillStyle = '#000'; x.fillRect(0, 0, f.W, f.bar); x.fillRect(0, f.H - f.bar, f.W, f.bar); };
})();
