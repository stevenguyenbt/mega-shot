// mega-shot · subtle visual effects: theme overlays + accents (punch-in, shake) + scene transitions.
// Deterministic: everything is computed from t (particles have fixed positions from a seed) → any frame renders to exactly one image.
(() => {
  const MS = window.MS, { clamp, eo3, eio, rgen, canvas } = MS.u;
  MS.fx = {};
  // ---------- overlays ----------
  const P = {};                                                                   // prebuilt particles per type
  const parts = (k, n, f) => P[k] || (P[k] = (() => { const r = rgen(k.length * 97 + n); return Array.from({ length: n }, () => f(r)); })());
  const L = {
    // marine snow: organic particles drift slowly down, fading with image depth (far layers small/faint, near layers large/soft)
    'tuyet-bien': (x, t, W, H, a) => {
      parts('tb', 140, r => [r(), r(), .4 + r() * 2.6, r() * 6.28, .3 + r() * .7]).forEach(([u, v, s, ph, z]) => {
        const y = ((v + t * .012 * (1 + s * .4)) % 1) * H, xx = (u + .01 * Math.sin(t * .4 + ph)) * W;
        x.globalAlpha = a * (.18 + .32 * z) * (.6 + .4 * Math.sin(t * 1.3 + ph)); x.fillStyle = '#dff4ff';
        x.beginPath(); x.arc(xx, y, s * (z > .85 ? 1.8 : 1), 0, 7); x.fill();
      });
    },
    // underwater caustics: interfering light patterns, drawn at low resolution then smoothly upscaled, blended additively
    'anh-day-nuoc': (() => {
      const cw = 96, ch = 170, cv = canvas(cw, ch), cx = cv.getContext('2d'), img = cx.createImageData(cw, ch);
      return (x, t, W, H, a) => {
        for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
          const u = i / cw * 7, v = j / ch * 12;
          const s = Math.sin(u + t * .9 + Math.sin(v * .8 + t * .6)) + Math.sin(v * 1.1 - t * .7 + Math.sin(u * 1.3 - t * .5)) + Math.sin((u + v) * .7 + t * .45);
          const c = Math.pow(clamp((s + 1.2) / 4.2), 5) * 255, k = (j * cw + i) * 4; img.data[k] = c * .8; img.data[k + 1] = c; img.data[k + 2] = c; img.data[k + 3] = 255;
        }
        cx.putImageData(img, 0, 0); x.save(); x.globalCompositeOperation = 'screen'; x.globalAlpha = a * .22; x.imageSmoothingQuality = 'high';
        const g = x.createLinearGradient(0, 0, 0, H); x.drawImage(cv, 0, 0, W, H); x.restore();
      };
    })(),
    // god rays through water: a few slanted light bands, swaying slowly
    'tia-nang': (x, t, W, H, a) => {
      x.save(); x.globalCompositeOperation = 'screen';
      parts('tn', 7, r => [r(), .04 + r() * .09, r() * 6.28, .5 + r() * .5]).forEach(([u, w, ph, k]) => {
        const cx0 = (u + .05 * Math.sin(t * .25 + ph)) * W, ang = -.18 + .05 * Math.sin(t * .2 + ph), len = H * 1.1;
        x.save(); x.translate(cx0, -40); x.rotate(ang); const g = x.createLinearGradient(0, 0, 0, len);
        g.addColorStop(0, `rgba(200,235,255,${a * .16 * k})`); g.addColorStop(1, 'rgba(200,235,255,0)'); x.fillStyle = g;
        x.globalAlpha = .6 + .4 * Math.sin(t * .8 + ph); x.fillRect(-w * W / 2, 0, w * W, len); x.restore();
      }); x.restore();
    },
    // rising air bubbles, slight wobble, with a bright rim
    'bot-khi': (x, t, W, H, a) => {
      parts('bk', 26, r => [r(), r(), 3 + r() * 9, r() * 6.28, .5 + r()]).forEach(([u, v, s, ph, sp]) => {
        const y = H - ((v + t * .05 * sp) % 1) * (H + 60), xx = u * W + 10 * Math.sin(t * 2 * sp + ph);
        x.globalAlpha = a * .55; x.strokeStyle = 'rgba(230,248,255,.9)'; x.lineWidth = 1.4; x.beginPath(); x.arc(xx, y, s, 0, 7); x.stroke();
        x.globalAlpha = a * .5; x.fillStyle = '#fff'; x.beginPath(); x.arc(xx - s * .35, y - s * .35, s * .22, 0, 7); x.fill();
      });
    },
  };
  MS.fx.lopPhu = (x, t, list, W, H, a = 1) => { if (!list) return; x.save(); for (const k of [].concat(list)) { const f = L[k]; if (f) f(x, t, W, H, a); } x.restore(); x.globalAlpha = 1; };
  MS.fx.LOP = Object.keys(L);

  // ---------- accent: gentle punch-in + decaying shake around the t0 mark (seconds within the scene) ----------
  MS.fx.nhan = (lt, moc = [], muc = 1) => {
    let z = 1, dx = 0, dy = 0;
    for (const m of moc) { const d = lt - m; if (d < 0 || d > .6) continue; const e = Math.exp(-d * 9); z += .035 * muc * e; dx += Math.sin(d * 70) * 7 * muc * e; dy += Math.cos(d * 55) * 5 * muc * e; }
    return { z, dx, dy };
  };

  // ---------- transitions: draw A (old scene) → B (new scene) onto g, p = 0→1 ----------
  const draw = (g, cv, s = 1, dx = 0, dy = 0, alpha = 1, blur = 0) => {
    const W = cv.width, H = cv.height; g.save(); g.globalAlpha = alpha; if (blur > .3) g.filter = `blur(${blur.toFixed(1)}px)`;
    g.translate(W / 2 + dx, H / 2 + dy); g.scale(s, s); g.drawImage(cv, -W / 2, -H / 2); g.restore();
  };
  // multi-octave value noise (fixed seed) for the "ink bleed" mask — computed once, deterministic
  const T = {}; let NZ = null;
  const noise = () => { if (NZ) return NZ; const w = 108, h = 192, r = rgen(1954), v = new Float32Array(w * h);
    const oct = [[42, .52], [19, .27], [8, .14], [3.5, .07]].map(([gs, a]) => { const gw = Math.ceil(w / gs) + 2, gh = Math.ceil(h / gs) + 2, gv = Array.from({ length: gw * gh }, () => r()); return [gs, a, gw, gv]; });
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { let s = 0;
      for (const [gs, a, gw, gv] of oct) { const fx = i / gs, fy = j / gs, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty), q = (a2, b2) => gv[b2 * gw + a2];
        s += a * ((q(x0, y0) * (1 - sx) + q(x0 + 1, y0) * sx) * (1 - sy) + (q(x0, y0 + 1) * (1 - sx) + q(x0 + 1, y0 + 1) * sx) * sy); }
      v[j * w + i] = s; }
    let lo = 1e9, hi = -1e9; for (const x of v) { lo = Math.min(lo, x); hi = Math.max(hi, x); } for (let k = 0; k < v.length; k++) v[k] = (v[k] - lo) / (hi - lo);
    return (NZ = { w, h, v }); };
  MS.fx.TR = {
    fade: (g, A, B, p) => { draw(g, A); draw(g, B, 1, 0, 0, MS.u.sio(p)); },
    // zoom-through: the old scene rushes toward the camera (zoom + blur), the new scene settles to its normal size
    phong: (g, A, B, p) => { const e = eio(p); draw(g, A, 1 + .22 * e, 0, 0, 1, 6 * e); draw(g, B, 1.12 - .12 * e, 0, 0, clamp(p * 1.8 - .25), 6 * (1 - e)); },
    // fast whip pan with motion blur
    lia: (g, A, B, p) => { const e = eio(p), W = A.width, sp = Math.sin(Math.PI * p);
      draw(g, A, 1, -W * .55 * e, 0, 1, 14 * sp); draw(g, B, 1, W * .55 * (1 - e), 0, clamp(p * 2.2 - .2), 14 * sp); },
    // soft flash in the middle
    loe: (g, A, B, p) => { draw(g, A); draw(g, B, 1, 0, 0, MS.u.sio(p)); g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = .5 * Math.sin(Math.PI * p) ** 2; g.fillStyle = '#eaf6ff'; g.fillRect(0, 0, A.width, A.height); g.restore(); },
    // dive-through: dives into the centre of the old scene (strong zoom, fading), the new scene surfaces from the depths
    'lan-xuyen': (g, A, B, p) => { const e = eio(p); draw(g, A, 1 + 1.1 * e * e, 0, 0, 1 - clamp((p - .35) / .5), 10 * e); draw(g, B, .86 + .14 * eo3(p), 0, 0, clamp((p - .3) / .6), 8 * (1 - p)); },
    // water ripple: the new scene appears through wavy curved slices that decay
    'gon-nuoc': (g, A, B, p) => { draw(g, A); const W = B.width, H = B.height, a = MS.u.sio(p), amp = 26 * (1 - p), sl = 12; g.save(); g.globalAlpha = a;
      for (let y = 0; y < H; y += sl) { const o = Math.sin(y * .018 + p * 9) * amp; g.drawImage(B, 0, y, W, sl, o, y, W, sl); } g.restore(); },
    // ===== cinematic transitions — used only when a scene sets `chuyen: <name>` and film.html enables allTransitions =====
    // film burn / light leak: an orange flare sweeps across, the new scene appears under the flash
    'chay-phim': (g, A, B, p, d = {}) => { const W = A.width, H = A.height, k = Math.sin(Math.PI * p), dir = d.chuyen_huong === -1 ? -1 : 1;
      draw(g, A, 1 + .03 * p); draw(g, B, 1.03 - .03 * p, 0, 0, MS.u.sio(clamp((p - .28) / .44)));
      const sx = W * (dir > 0 ? MS.u.lerp(-.35, 1.35, eio(p)) : MS.u.lerp(1.35, -.35, eio(p)));
      g.save(); g.globalCompositeOperation = 'screen';
      let r = g.createRadialGradient(sx, H * .38, 0, sx, H * .38, H * .85); r.addColorStop(0, `rgba(255,214,150,${.95 * k})`); r.addColorStop(.22, `rgba(255,150,60,${.75 * k})`); r.addColorStop(.55, `rgba(190,55,15,${.38 * k})`); r.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = r; g.fillRect(0, 0, W, H);
      const sx2 = W - sx * .7; r = g.createRadialGradient(sx2, H * .82, 0, sx2, H * .82, H * .5); r.addColorStop(0, `rgba(255,120,40,${.55 * k})`); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter'; g.globalAlpha = .32 * k ** 3; g.fillStyle = '#fff1dc'; g.fillRect(0, 0, W, H); g.restore(); },
    // dark zoom-through: rushes into a point of the old scene (darkening), the new scene bursts out of the shadows around the same point
    'xuyen-toi': (g, A, B, p, d = {}) => { const W = A.width, H = A.height, [fx, fy] = d.chuyen_tam || [.5, .45], cx = fx * W, cy = fy * H;
      const at = (cv, s, a, bl) => draw(g, cv, s, (cx - W / 2) * (1 - s), (cy - H / 2) * (1 - s), a, bl);
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      if (p < .5) { const e = eio(p / .5); at(A, 1 + 1.6 * e * e, 1, 9 * e); g.fillStyle = `rgba(0,0,0,${.78 * e ** 1.4})`; g.fillRect(0, 0, W, H); }
      else { const e = eo3((p - .5) / .5); at(B, 1.45 - .45 * e, 1, 7 * (1 - e)); g.fillStyle = `rgba(0,0,0,${.78 * (1 - e) ** 1.6})`; g.fillRect(0, 0, W, H); } },
    // whip pan with directional motion blur (several horizontally offset copies stacked)
    'lia-nhoe': (g, A, B, p, d = {}) => { const W = A.width, e = eio(p), dir = d.chuyen_huong === -1 ? -1 : 1, sp = 190 * Math.sin(Math.PI * p);
      const smear = (cv, dx) => { draw(g, cv, 1, dx, 0, 1, 2 * sp / 190); if (sp > 3) for (let k = 1; k <= 5; k++) { draw(g, cv, 1, dx + sp * k / 5, 0, .2); draw(g, cv, 1, dx - sp * k / 5, 0, .2); } };
      smear(A, -dir * W * e); smear(B, dir * W * (1 - e)); },
    // fade fully to black then back up, with projector flicker + film gate shake
    'den-nhay': (g, A, B, p) => { const W = A.width, H = A.height, n = Math.floor(p * 26), h = v => { const s = Math.sin(v * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
      const wy = (h(n) - .5) * 16 * Math.sin(Math.PI * p);
      if (p < .45) { draw(g, A, 1, 0, wy); g.fillStyle = `rgba(0,0,0,${eio(p / .45)})`; g.fillRect(0, 0, W, H); }
      else { draw(g, B, 1, 0, wy); g.fillStyle = `rgba(0,0,0,${1 - eio((p - .45) / .55)})`; g.fillRect(0, 0, W, H); }
      if (p > .25 && p < .85 && h(n + 7) > .55) { g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = .22 * h(n + 3); g.fillStyle = '#ffe9c8'; g.fillRect(0, 0, W, H); g.restore(); }
      g.save(); g.globalAlpha = .35 * Math.sin(Math.PI * p); g.fillStyle = '#d8d0c0'; for (let k = 0; k < 3; k++) { const x0 = h(n * 3 + k) * W; g.fillRect(x0, 0, 1.5, H); } g.restore(); },
    // ink bleed / smoke: the new scene soaks in through the noise mask, edges dark like ink
    'muc-loang': (g, A, B, p) => { const W = A.width, H = A.height, N = noise(), th = MS.u.lerp(-.12, 1.12, eio(p));
      if (!T.c || T.c.width !== W) { T.c = canvas(W, H); T.m = canvas(N.w, N.h); T.r = canvas(N.w, N.h); }
      const mx = T.m.getContext('2d'), rx = T.r.getContext('2d'), mi = mx.createImageData(N.w, N.h), ri = rx.createImageData(N.w, N.h);
      for (let k = 0; k < N.v.length; k++) { const v = N.v[k], a = clamp((th - v) / .07 + .5), ring = clamp(1 - Math.abs(th + .03 - v) / .05); mi.data[k * 4 + 3] = a * 255; ri.data[k * 4 + 3] = ring * 200; }
      mx.putImageData(mi, 0, 0); rx.putImageData(ri, 0, 0);
      const tc = T.c.getContext('2d'); tc.setTransform(1, 0, 0, 1, 0, 0); tc.globalCompositeOperation = 'source-over'; tc.clearRect(0, 0, W, H);
      tc.save(); const s = 1.06 - .06 * eo3(p); tc.translate(W / 2, H / 2); tc.scale(s, s); tc.drawImage(B, -W / 2, -H / 2); tc.restore();
      tc.globalCompositeOperation = 'destination-in'; tc.imageSmoothingQuality = 'high'; tc.drawImage(T.m, 0, 0, W, H); tc.globalCompositeOperation = 'source-over';
      draw(g, A, 1 + .04 * p); g.save(); g.globalAlpha = .85; g.imageSmoothingQuality = 'high'; g.filter = 'blur(6px)'; g.drawImage(T.r, 0, 0, W, H); g.restore(); g.drawImage(T.c, 0, 0); },
    // parallax slide: the new scene slides up while the old one recedes more slowly and darkens
    'truot-lop': (g, A, B, p, d = {}) => { const W = A.width, H = A.height, e = eio(p), dir = d.chuyen_huong === -1 ? -1 : 1;
      draw(g, A, 1 + .05 * e, 0, -dir * H * .28 * e); g.fillStyle = `rgba(0,0,0,${.65 * e})`; g.fillRect(0, 0, W, H);
      const y0 = dir * H * (1 - e); g.save(); const sh = g.createLinearGradient(0, y0 - dir * 90, 0, y0); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = sh; g.fillRect(0, Math.min(y0, y0 - dir * 90), W, 90); g.restore();
      draw(g, B, 1.08 - .08 * e, 0, y0); },
    // paper fold: the old scene folds like a map page, revealing the new scene underneath
    'gap-giay': (g, A, B, p) => { const W = A.width, H = A.height, e = eio(p), w = W * (1 - e);
      draw(g, B, 1.06 - .06 * e); g.fillStyle = `rgba(0,0,0,${.6 * (1 - e)})`; g.fillRect(0, 0, W, H);
      if (w > 1) { g.save(); g.drawImage(A, 0, 0, W, H, 0, 0, w, H); const sh = g.createLinearGradient(0, 0, w, 0); sh.addColorStop(0, `rgba(0,0,0,${.15 * e})`); sh.addColorStop(1, `rgba(0,0,0,${.75 * e})`); g.fillStyle = sh; g.fillRect(0, 0, w, H);
        g.fillStyle = `rgba(255,240,215,${.35 * Math.sin(Math.PI * p)})`; g.fillRect(w - 3, 0, 3, H); const cs = g.createLinearGradient(w, 0, w + 120, 0); cs.addColorStop(0, `rgba(0,0,0,${.5 * (1 - e)})`); cs.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = cs; g.fillRect(w, 0, 120, H); g.restore(); } },
    // flash cut: a short white flash on the beat of a big title, the new scene hits with a slight zoom then settles to size
    chop: (g, A, B, p) => { const W = A.width, H = A.height, c = .2;
      if (p < c) draw(g, A, 1 + .06 * (p / c)); else draw(g, B, 1.07 - .07 * eo3((p - c) / (1 - c)));
      g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = .9 * Math.exp(-Math.abs(p - c) * (p < c ? 22 : 9)); g.fillStyle = '#fff6e8'; g.fillRect(0, 0, W, H); g.restore(); },
    // slow dissolve with parallax drift — for calm, emotional beats
    'tan-troi': (g, A, B, p) => { const W = A.width, e = eio(p);
      draw(g, A, 1 + .05 * e, -W * .05 * e, 0); draw(g, B, 1.05 - .05 * e, W * .05 * (1 - e), 0, MS.u.sio(p), 3 * (1 - p)); },
    cat: (g, A, B, p) => draw(g, B),
  };
  MS.fx.VONG = ['phong', 'lia', 'fade', 'lan-xuyen', 'gon-nuoc', 'phong', 'loe'];   // auto cycle (moderate): no immediate repeats, few flashes
})();
