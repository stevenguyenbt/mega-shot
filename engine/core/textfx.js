// mega-shot · textfx — animated subtitles and titles, Remotion-style motion: physics springs + time interpolation.
// Load: <script src="/ms/core/textfx.js"></script> after overlay.js. Pick styles in video.yaml:
//   phong_cach: { subtitle_style: highlight, title_style: spring }   (whole video)  ·  scene: title_style: stamp   (that scene's title)
// Subtitles: box · karaoke-pop · highlight · word-burst · typewriter · blur-in · underline
// Titles:    word-rise · spring · mask-reveal · decode · shine · typewriter · tracking · stamp
// Previews (GIF): references/text-styles/ · regenerate: xp text-styles · old Vietnamese ids/keys still work (ALIAS below)
(() => {
  const MS = window.MS, { clamp, lerp, rgba } = MS.u;

  // ---------- physics spring: damped oscillation normalised from→to (same parameters as Remotion's spring(); t in seconds) ----------
  const spring = (t, { damping = 10, stiffness = 100, mass = 1, from = 0, to = 1 } = {}) => {
    if (t <= 0) return from;
    const w0 = Math.sqrt(stiffness / mass), z = damping / (2 * Math.sqrt(stiffness * mass)); let v;
    if (z < 1) { const wd = w0 * Math.sqrt(1 - z * z); v = 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + (z * w0 / wd) * Math.sin(wd * t)); }
    else v = 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    return from + (to - from) * v;
  };
  const interp = (v, a, b, o0, o1, ease) => { let p = clamp((v - a) / (b - a)); if (ease) p = ease(p); return o0 + (o1 - o0) * p; };
  const eo = p => 1 - Math.pow(1 - p, 3);
  const F = () => MS.FMT, S = () => MS.STYLE;
  const font = (w, px) => `${w} ${px}px ${S().titleFont || S().font}`;
  const stroke = (x, s, X, Y, lw, col = 'rgba(0,0,0,.62)') => { x.lineJoin = 'round'; x.lineWidth = lw; x.strokeStyle = col; x.strokeText(s, X, Y); };
  const HOT = () => S().subHot || '#ffd25a', KEY = () => S().subKey || '#8fdcff', ACC = () => S().accent || '#ffc46a';

  // ---------- subtitle layout: balanced lines, keeps per-word timestamps ----------
  const words = s => s.w || s.s.split(' ').map((w, i, a) => [w, s.t0 + (s.t1 - s.t0) * i / a.length, s.t0 + (s.t1 - s.t0) * (i + 1) / a.length, 0]);
  // zh/ja/th: no spaces → phrase chunks fill lines greedily; a chunk wider than the line is cut by character (timing split proportionally)
  const NOSPACE = /^(zh|ja|th|lo|km|my)/;
  const linesNoSpace = (x, ws, maxW) => {
    const L = [[]]; let cw = 0;
    const put = q => { const w = x.measureText(q[0]).width; if (cw + w > maxW && L[L.length - 1].length) { L.push([]); cw = 0; } L[L.length - 1].push(q); cw += w; };
    ws.forEach(q => {
      const s = q[0].trim(); if (!s) return;
      if (x.measureText(s).width <= maxW) return put([s, q[1], q[2], q[3]]);
      const ch = [...s]; let a = 0;
      while (a < ch.length) { let b = a + 1; const room = L[L.length - 1].length ? maxW - cw : maxW;
        while (b < ch.length && x.measureText(ch.slice(a, b + 1).join('')).width <= Math.max(room, maxW * .3)) b++;
        if (x.measureText(ch.slice(a, b).join('')).width > room && L[L.length - 1].length) { L.push([]); cw = 0; continue; }
        put([ch.slice(a, b).join(''), q[1] + (q[2] - q[1]) * a / ch.length, q[1] + (q[2] - q[1]) * b / ch.length, q[3]]); a = b; }
    });
    return L;
  };
  const layout = (x, s, size, weight, maxW) => {
    x.font = font(weight, size); const ns = NOSPACE.test(MS.LANG || 'vi'), ws = words(s), sp = ns ? 0 : x.measureText(' ').width, lh = size * 1.32; let k = 0;
    const L = ns ? linesNoSpace(x, s.w || [[s.s.replace(/ /g, ''), s.t0, s.t1, 0]], maxW)
      : MS.wrapBal(x, s.s, maxW).map(l => { const n = l.split(' ').length, r = ws.slice(k, k + n); k += n; return r; });
    const f = F(), tot = L.length * lh, y0 = (f.subBot ? f.subBot - 24 - tot : f.subY - tot / 2) + lh / 2, out = [];
    L.forEach((r, li) => { const w = r.reduce((a, q) => a + x.measureText(q[0]).width, 0) + sp * (r.length - 1); let xx = f.W / 2 - w / 2;
      r.forEach(q => { const ww = x.measureText(q[0]).width; out.push({ s: q[0], t0: q[1], t1: q[2], key: q[3], x: xx, w: ww, y: y0 + li * lh, line: li }); xx += ww + sp; }); });
    return { items: out, lh, top: y0 - lh / 2, bottom: y0 + (L.length - .5) * lh, width: Math.max(...out.map(o => o.x + o.w)) - Math.min(...out.map(o => o.x)) };
  };
  const curIdx = (items, t) => { let c = -1; items.forEach((o, i) => { if (t >= o.t0) c = i; }); return c; };
  const fadeOf = (s, t) => clamp((t - s.t0) / .1) * clamp((s.t1 + .12 - t) / .12);

  const SUB = {
    // story films: one short UPPERCASE chunk in the middle of the frame (≈ 60 % height), condensed type, thin outline;
    // **keywords** yellow, words listed in phong_cach.tu_do (danger words) red; the chunk pops in, no box
    'giua'(x, t, s) {
      const f = F(), size = Math.round(f.subSize * 1.08), up = { ...s, s: s.s.toUpperCase(), w: s.w && s.w.map(w => [String(w[0]).toUpperCase(), w[1], w[2], w[3]]) };
      const Lo = layout(x, up, size, 700, f.W * .78), cy = f.H * (S().phu_de_y ?? .6), dy = cy - (Lo.top + Lo.bottom) / 2;
      const red = new Set((S().tu_do || []).map(w => String(w).toUpperCase())), pop = spring(t - s.t0, { damping: 13, stiffness: 260 });
      x.save(); x.globalAlpha = fadeOf(s, t); x.textBaseline = 'middle'; x.textAlign = 'left'; x.font = font(700, size);   // same face layout() measured with (phong_cach.titleFont, e.g. OSW)
      x.translate(f.W / 2, cy); x.scale(.9 + .1 * pop, .9 + .1 * pop); x.translate(-f.W / 2, -cy);
      Lo.items.forEach(o => { const bare = o.s.replace(/[.,!?…:;"“”]/g, ''), col = red.has(bare) ? (S().giua_do || '#ff4b4b') : o.key ? (S().giua_key || '#ffc93c') : '#f7f4ee';   // phong_cach.giua_key / giua_do override the colours
        x.lineJoin = 'round'; x.lineWidth = size * .14; x.strokeStyle = 'rgba(10,10,12,.85)'; x.strokeText(o.s, o.x, o.y + dy); x.fillStyle = col; x.fillText(o.s, o.x, o.y + dy); });
      x.restore();
    },
    // TikTok storytime look: sentence-case Be Vietnam Pro, YELLOW with a thick dark outline, low in the frame (phong_cach.phu_de_y, default .74);
    // words appear as they are spoken; **keywords** white (phong_cach.vang / vang_key override the colours)
    'vang-duoi'(x, t, s) {
      const f = F(), st = S(), old = st.titleFont; st.titleFont = 'BVP, "Be Vietnam Pro", sans-serif'; const size = Math.round(f.subSize * (st.phu_de_co || 1.04)), Lo = layout(x, s, size, 800, f.subMaxW || f.W * .76); st.titleFont = old;
      const cy = f.H * (st.phu_de_y ?? .74), dy = cy - (Lo.top + Lo.bottom) / 2;
      x.save(); x.globalAlpha = fadeOf(s, t); x.textBaseline = 'middle'; x.textAlign = 'left'; x.font = `800 ${size}px BVP, "Be Vietnam Pro", sans-serif`; x.lineJoin = 'round';
      Lo.items.forEach(o => { const p = clamp((t - o.t0 + .08) / .14); if (p <= 0) return; x.save(); x.globalAlpha *= p; x.translate(0, (1 - p) * 10);
        x.lineWidth = size * .22; x.strokeStyle = 'rgba(14,10,6,.92)'; x.strokeText(o.s, o.x, o.y + dy); x.fillStyle = o.key ? (st.vang_key || '#ffffff') : (st.vang || '#ffd23f'); x.fillText(o.s, o.x, o.y + dy); x.restore(); });
      x.restore();
    },
    // no box, thick outline; the spoken word springs up, words not yet spoken are dimmed
    'karaoke-pop'(x, t, s) {
      const f = F(), size = f.subSize * 1.12, Lo = layout(x, s, size, 900, f.subMaxW), dy = (1 - spring(t - s.t0, { damping: 14, stiffness: 170 })) * 34;
      x.save(); x.globalAlpha = fadeOf(s, t); x.textBaseline = 'middle'; x.textAlign = 'center'; x.font = font(900, size);
      Lo.items.forEach((o, i) => {
        const nx = Lo.items[i + 1], end = nx && nx.line === o.line ? Math.max(o.t1, nx.t0) : o.t1, cur = t >= o.t0 && t < end, spoken = t >= o.t0;
        const sc = cur ? lerp(1, 1.16, spring(t - o.t0, { damping: 8, stiffness: 230 })) : spoken ? lerp(1.16, 1, spring(t - end, { damping: 14, stiffness: 200 })) : 1;
        x.save(); x.translate(o.x + o.w / 2, o.y + dy); x.scale(sc, sc); x.globalAlpha *= spoken ? 1 : .55;
        x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 18; stroke(x, o.s, 0, 0, size * .2, 'rgba(0,0,0,.8)'); x.shadowBlur = 0;
        x.fillStyle = cur ? HOT() : o.key ? KEY() : '#fff'; x.fillText(o.s, 0, 0); x.restore();
      }); x.restore();
    },
    // an accent pill springs from the previous word to the spoken one (CapCut/TikTok look)
    'highlight'(x, t, s) {
      const f = F(), size = f.subSize * 1.06, Lo = layout(x, s, size, 800, f.subMaxW), ci = curIdx(Lo.items, t), padX = size * .26, padY = size * .16;
      x.save(); x.globalAlpha = fadeOf(s, t); x.textBaseline = 'middle'; x.textAlign = 'left'; x.font = font(800, size);
      if (ci >= 0) {
        const a = Lo.items[Math.max(0, ci - 1)], b = Lo.items[ci], p = ci === 0 ? 1 : spring(t - b.t0, { damping: 16, stiffness: 280 }), pop = spring(t - Lo.items[0].t0, { damping: 12, stiffness: 220 });
        const bx = lerp(a.x, b.x, p) - padX, bw = lerp(a.w, b.w, p) + padX * 2, by = lerp(a.y, b.y, p) - size / 2 - padY, bh = size + padY * 2;
        x.save(); x.translate(bx + bw / 2, by + bh / 2); x.scale(pop, pop); x.rotate(-.02); x.fillStyle = ACC(); x.shadowColor = rgba(ACC(), .55); x.shadowBlur = 22;
        x.beginPath(); x.roundRect(-bw / 2, -bh / 2, bw, bh, size * .28); x.fill(); x.restore();
      }
      Lo.items.forEach((o, i) => { const on = i === ci; if (!on) { x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 12; stroke(x, o.s, o.x, o.y, size * .16); x.shadowBlur = 0; }
        x.fillStyle = on ? '#140d04' : o.key ? KEY() : '#fff'; x.fillText(o.s, o.x, o.y); });
      x.restore();
    },
    // 1–3 big words at a time pop in with the voice (fast-paced shorts)
    'word-burst'(x, t, s) {
      const f = F(), ws = words(s), chunks = []; let cur = [];
      ws.forEach((w, i) => { cur.push(w); const len = cur.map(q => q[0]).join(' ').length; if (cur.length >= 3 || len >= 14 || w[3] || /[,.!?;:]$/.test(w[0]) || i === ws.length - 1) { chunks.push(cur); cur = []; } });
      let ch = chunks[0]; chunks.forEach(c => { if (t >= c[0][1] - .05) ch = c; }); if (!ch) return;
      let size = f.subSize * 1.9; x.save(); x.font = font(900, size); const sp = x.measureText(' ').width;
      let w = ch.reduce((a, q) => a + x.measureText(q[0]).width, 0) + sp * (ch.length - 1); if (w > f.subMaxW) { size *= f.subMaxW / w; x.font = font(900, size); w = f.subMaxW; }
      const sp2 = x.measureText(' ').width, Y = f.subBot ? f.subBot - size * .9 : f.subY - size * .2; let xx = f.W / 2 - w / 2;
      x.globalAlpha = clamp((s.t1 + .12 - t) / .12); x.textBaseline = 'middle'; x.textAlign = 'center';
      ch.forEach(q => { const ww = x.measureText(q[0]).width, p = spring(t - q[1] + .05, { damping: 10, stiffness: 260 }), on = t >= q[1] && t < q[2] + .05;
        if (p > 0) { x.save(); x.translate(xx + ww / 2, Y + (1 - p) * size * .25); x.rotate((1 - p) * -.08); x.scale(.55 + .45 * p, .55 + .45 * p); x.globalAlpha *= clamp(p * 2.2);
          x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = 24; stroke(x, q[0], 0, 0, size * .2, 'rgba(0,0,0,.85)'); x.shadowBlur = 0;
          x.fillStyle = q[3] ? ACC() : on ? HOT() : '#fff'; x.fillText(q[0], 0, 0); x.restore(); }
        xx += ww + sp2; });
      x.restore();
    },
    // characters type in with the voice, blinking cursor (fixed layout, no reflow)
    'typewriter'(x, t, s) {
      const f = F(), size = f.subSize, Lo = layout(x, s, size, 700, f.subMaxW), st = S();
      x.save(); x.globalAlpha = fadeOf(s, t); x.font = font(700, size); x.textBaseline = 'middle'; x.textAlign = 'left';
      if (!f.bar) { const bw = Lo.width + 64, bh = Lo.bottom - Lo.top + 30; x.fillStyle = st.subBg; x.beginPath(); x.roundRect(f.W / 2 - bw / 2, Lo.top - 15, bw, bh, 22); x.fill(); }
      let last = null;
      Lo.items.forEach(o => { const ch = [...o.s], k = t < o.t0 ? 0 : Math.ceil(clamp((t - o.t0) / Math.max(.06, (o.t1 - o.t0) * .75)) * ch.length); if (!k) return;
        const sub = ch.slice(0, k).join(''); stroke(x, sub, o.x, o.y, 6, 'rgba(0,0,0,.5)'); x.fillStyle = o.key ? KEY() : '#fff'; x.fillText(sub, o.x, o.y); last = { x: o.x + x.measureText(sub).width, y: o.y }; });
      if (last && (t * 2.4) % 1 < .62) { x.fillStyle = ACC(); x.fillRect(last.x + 5, last.y - size * .48, size * .11, size * .96); }
      x.restore();
    },
    // each word rises from blur to sharp over a soft dark band (documentary)
    'blur-in'(x, t, s) {
      const f = F(), size = f.subSize * 1.04, Lo = layout(x, s, size, 700, f.subMaxW), a = fadeOf(s, t);
      x.save(); const gy = Lo.top - 110, g = x.createLinearGradient(0, gy, 0, Lo.bottom + 90); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.55, `rgba(0,0,0,${.5 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, gy, f.W, Lo.bottom + 90 - gy); x.globalAlpha = a; x.font = font(700, size); x.textBaseline = 'middle'; x.textAlign = 'left';
      Lo.items.forEach(o => { const p = eo(clamp((t - o.t0 + .15) / .4)); if (p <= 0) return; x.save(); x.globalAlpha *= p; x.filter = p < .98 ? `blur(${(1 - p) * 10}px)` : 'none';
        x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 14; x.fillStyle = o.key ? KEY() : t >= o.t0 && t < o.t1 ? '#fff4dc' : '#fff'; x.fillText(o.s, o.x, o.y + (1 - p) * 22); x.restore(); });
      x.restore();
    },
    // clean white text, an accent underline follows the spoken word
    'underline'(x, t, s) {
      const f = F(), size = f.subSize * 1.02, Lo = layout(x, s, size, 800, f.subMaxW), ci = curIdx(Lo.items, t);
      x.save(); x.globalAlpha = fadeOf(s, t); x.font = font(800, size); x.textBaseline = 'middle'; x.textAlign = 'left';
      Lo.items.forEach((o, i) => { x.save(); x.globalAlpha *= t >= o.t0 ? 1 : .62; x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 16; stroke(x, o.s, o.x, o.y, size * .13, 'rgba(0,0,0,.5)'); x.shadowBlur = 0;
        x.fillStyle = o.key ? KEY() : '#fff'; x.fillText(o.s, o.x, o.y); x.restore(); });
      if (ci >= 0) { const o = Lo.items[ci], p = spring(t - o.t0, { damping: 18, stiffness: 300 }); x.fillStyle = ACC(); x.shadowColor = rgba(ACC(), .7); x.shadowBlur = 14;
        x.beginPath(); x.roundRect(o.x, o.y + size * .58, Math.max(4, o.w * p), size * .13, size * .065); x.fill(); }
      x.restore();
    },
  };

  // ---------- titles ----------
  const chars = (x, s, ls = 0) => { const c = [...s], w = c.map(q => x.measureText(q).width), tot = w.reduce((a, b) => a + b, 0) + ls * (c.length - 1); let xx = -tot / 2; return { c, pos: c.map((q, i) => { const p = xx + w[i] / 2; xx += w[i] + ls; return p; }), w, tot }; };
  const glyph = (x, q, X, Y, size, col) => { stroke(x, q, X, Y, Math.max(4, size * .09), 'rgba(0,0,0,.58)'); x.fillStyle = col; x.fillText(q, X, Y); };
  let shineC = null;
  const TITLE = {
    // letters spring in one after another with a light bounce
    'spring'(x, s, X, Y, tt, size, col) { const L = chars(x, s);
      L.c.forEach((q, i) => { const p = spring(tt - i * .032, { damping: 9, stiffness: 210 }); if (p <= 0) return; x.save(); x.translate(X + L.pos[i], Y + (1 - p) * size * .4); x.scale(p, p); x.globalAlpha *= clamp(p * 3); glyph(x, q, 0, 0, size, col); x.restore(); }); },
    // text slides up from behind a mask line, an accent bar draws underneath
    'mask-reveal'(x, s, X, Y, tt, size, col) { const w = x.measureText(s).width, p = spring(tt, { damping: 17, stiffness: 150 });
      x.save(); x.beginPath(); x.rect(X - w / 2 - 60, Y - size * .8, w + 120, size * 1.42); x.clip(); glyph(x, s, X, Y + (1 - p) * size * 1.25, size, col); x.restore();
      const b = interp(tt, .05, .5, 0, 1, eo); x.fillStyle = ACC(); x.beginPath(); x.roundRect(X - w / 2, Y + size * .64, w * b, size * .085, size * .04); x.fill(); },
    // random glyphs cycle, then lock into the real letters
    'decode'(x, s, X, Y, tt, size, col) { const L = chars(x, s), G = 'ABCDEFGHKLMNOPQRSTUVXY0123456789#%&@$', fr = Math.floor(tt * 28);
      L.c.forEach((q, i) => { const r = .08 + i * .045; if (q === ' ') return; const done = tt >= r, a = clamp((tt + .1) / .2);
        const g = done ? q : G[(fr * 7 + i * 13) % G.length]; x.save(); x.globalAlpha *= done ? 1 : a * .9; glyph(x, g, X + L.pos[i], Y, size, done ? col : ACC()); x.restore(); }); },
    // a light sweep passes over the text (repeats every 3.2 s)
    'shine'(x, s, X, Y, tt, size, col) { const p = spring(tt, { damping: 16, stiffness: 120 }), w = x.measureText(s).width;
      x.save(); x.globalAlpha *= clamp(tt / .3); x.translate(X, Y); x.scale(.94 + .06 * p, .94 + .06 * p); glyph(x, s, 0, 0, size, col);
      const ph = ((tt - .35) % 3.2 + 3.2) % 3.2, pos = interp(ph, 0, .9, -.35, 1.35);
      if (tt > .35 && ph < .95) { const W2 = Math.ceil(w + 40), H2 = Math.ceil(size * 1.6); if (!shineC || shineC.width < W2 || shineC.height < H2) shineC = MS.u.canvas(W2 + 200, H2 + 40);
        const o = shineC.getContext('2d'); o.setTransform(1, 0, 0, 1, 0, 0); o.clearRect(0, 0, shineC.width, shineC.height); o.font = x.font; o.textAlign = 'center'; o.textBaseline = 'middle';
        o.fillStyle = '#fff'; o.fillText(s, W2 / 2, H2 / 2); o.globalCompositeOperation = 'source-in';
        const gx = pos * W2, g = o.createLinearGradient(gx - W2 * .14, 0, gx + W2 * .14, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,248,225,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        o.fillStyle = g; o.fillRect(0, 0, W2, H2); o.globalCompositeOperation = 'source-over'; x.globalCompositeOperation = 'lighter'; x.drawImage(shineC, 0, 0, W2, H2, -W2 / 2, -H2 / 2, W2, H2); }
      x.restore(); },
    // letters appear one by one, blinking cursor
    'typewriter'(x, s, X, Y, tt, size, col) { const L = chars(x, s), n = Math.floor(clamp(tt / (.045 * L.c.length)) * L.c.length + 1e-6);
      L.c.slice(0, n).forEach((q, i) => glyph(x, q, X + L.pos[i], Y, size, col));
      const cx = X - L.tot / 2 + L.w.slice(0, n).reduce((a, b) => a + b, 0) + 8; if (n < L.c.length || (tt * 2.2) % 1 < .6) { x.fillStyle = ACC(); x.fillRect(cx, Y - size * .5, size * .1, size); } },
    // wide blurred tracking tightens into sharp text (cinematic)
    'tracking'(x, s, X, Y, tt, size, col) { const p = spring(tt, { damping: 20, stiffness: 80 }), L = chars(x, s, (1 - p) * size * .55);
      x.save(); x.globalAlpha *= clamp(tt / .45); if (p < .97) x.filter = `blur(${(1 - p) * 12}px)`; L.c.forEach((q, i) => glyph(x, q, X + L.pos[i], Y, size, col)); x.restore(); },
    // slams down from 2.6×, shakes, flashes, accent frame
    'stamp'(x, s, X, Y, tt, size, col) { const p = spring(tt, { damping: 11, stiffness: 300 }), sc = lerp(2.6, 1, p), hit = Math.max(0, tt - .1);
      const sh = tt > .1 ? 12 * Math.exp(-hit * 12) * Math.sin(tt * 95) : 0, w = x.measureText(s).width;
      x.save(); x.globalAlpha *= clamp(tt / .07); x.translate(X + sh, Y); x.rotate(lerp(-.16, -.035, p)); x.scale(sc, sc);
      x.strokeStyle = ACC(); x.lineWidth = size * .07; x.beginPath(); x.roundRect(-w / 2 - size * .3, -size * .72, w + size * .6, size * 1.44, size * .14); x.stroke();
      glyph(x, s, 0, 0, size, col); x.restore();
      if (tt > .08 && tt < .55) { x.save(); x.globalCompositeOperation = 'lighter'; const a = .5 * Math.exp(-hit * 7); const g = x.createRadialGradient(X, Y, 0, X, Y, w * .8); g.addColorStop(0, rgba(ACC(), a)); g.addColorStop(1, rgba(ACC(), 0)); x.fillStyle = g; x.fillRect(X - w, Y - w, w * 2, w * 2); x.restore(); } },
  };

  // old Vietnamese ids → English ids (videos made before the rename keep working)
  const ALIAS = { hop: 'box', 'nen-tu': 'highlight', 'tung-tu': 'word-burst', 'go-chu': 'typewriter', 'mo-blur': 'blur-in', 'gach-chan': 'underline',
    'go-tu': 'word-rise', 'lo-xo': 'spring', 'mat-na': 'mask-reveal', 'giai-ma': 'decode', 'quet-sang': 'shine', 'go-may': 'typewriter', 'gian-chu': 'tracking', 'dong-dau': 'stamp' };
  const id = k => ALIAS[k] || k;
  // subtitle style: phong_cach.subtitle_style (old key: phu_de) → 'box' = classic box from overlay.js
  const subStyle = () => id(S().subtitle_style || S().phu_de || 'box');
  // MS.title replaces MS.words for scene titles. style: argument → scene title_style → phong_cach.title_style → 'word-rise' (words rise, as before)
  MS.title = (x, s, X, Y, t0, lt, size, col = '#fff', style) => {
    style = id(style || S().title_style || S().chu_kieu || 'word-rise'); s = String(s).normalize('NFC');
    if (style === 'word-rise' || !TITLE[style]) return MS.words(x, s, X, Y, t0, lt, size, col);
    const tt = lt - t0; if (tt <= 0) return;
    x.save(); x.font = font(900, size); const f = F(), maxW = f.W * (f.H > f.W ? .7 : .78), w = x.measureText(s).width;   // auto-shrink: stay clear of the TikTok button column
    if (w > maxW) { size = Math.floor(size * maxW / w); x.font = font(900, size); }
    x.textAlign = 'center'; x.textBaseline = 'middle'; TITLE[style](x, s, X, Y, tt, size, col); x.restore();
  };
  MS.tfx = { spring, interp, SUB, TITLE, ALIAS, subStyle, SUB_IDS: ['box', ...Object.keys(SUB)], TITLE_IDS: ['word-rise', ...Object.keys(TITLE)] };
})();
