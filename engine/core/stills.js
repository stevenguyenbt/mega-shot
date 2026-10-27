// mega-shot · bringing still images to life (AI images, photos): load images, Ken Burns (zoom/pan), breathing, handheld shake,
// "morph"-style image transitions (dissolve by brightness + blur), anchor points computed in image ratio for attaching labels.
(() => {
  const MS = window.MS, { clamp, lerp, sio, canvas } = MS.u;
  const cache = new Map();
  MS.img = src => { if (!cache.has(src)) cache.set(src, new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => { console.error('Missing image: ' + src); res(null); }; im.src = src; })); return cache.get(src); };
  MS.preload = async list => Promise.all(list.map(MS.img));

  // Compute the "cover" draw rect + camera motion. o: zoom [start, end], pan [[x0,y0],[x1,y1]] (ratio -1..1), focus [fx,fy] zoom centre (0..1)
  MS.kb = (im, W, H, u, o = {}) => {
    const z = lerp(...(o.zoom || [1.04, 1.12]), sio(u)) * (1 + (o.breathe ?? .004) * Math.sin((o.t || 0) * 1.7));
    const s = Math.max(W / im.width, H / im.height) * z, w = im.width * s, h = im.height * s;
    const [fx, fy] = o.focus || [.5, .42], pan = o.pan || [[0, 0], [0, 0]], px = lerp(pan[0][0], pan[1][0], sio(u)), py = lerp(pan[0][1], pan[1][1], sio(u));
    const sh = o.shake ?? 1.2, jx = Math.sin((o.t || 0) * 1.3) * sh + Math.sin((o.t || 0) * 2.9) * sh * .4, jy = Math.cos((o.t || 0) * 1.1) * sh;
    const x = W * fx - w * fx + px * (w - W) / 2 + jx, y = H * fy - h * fy + py * (h - H) / 2 + jy;
    return { x: w < W ? (W - w) / 2 + jx : clamp(x, W - w, 0), y: h < H ? (H - h) / 2 + jy : clamp(y, H - h, 0), w, h, s };   // smaller than the frame (zoom < 1, e.g. a whole globe) → centred on a dark background
  };
  MS.still = (x, im, c, o = {}) => { if (!im) return null; const r = MS.kb(im, c.W, c.H, o.u ?? c.lt / c.D, { ...o, t: c.t }); x.imageSmoothingQuality = 'high'; x.drawImage(im, r.x, r.y, r.w, r.h); return r; };
  // 2.5D: back layer (inpainted) drifts slowly, front layer (subject) drifts faster + zooms more → parallax, a still gains depth
  MS.still25 = (x, nen, tien, c, o = {}) => {
    if (!nen) return null; const u = o.u ?? c.lt / c.D, z = o.zoom || [1.06, 1.16], dz = z[1] - z[0];
    const rb = MS.kb(nen, c.W, c.H, u, { ...o, zoom: [z[0], z[0] + dz * .45], t: c.t }); x.imageSmoothingQuality = 'high'; x.drawImage(nen, rb.x, rb.y, rb.w, rb.h);
    if (tien) { const rf = MS.kb(tien, c.W, c.H, u, { ...o, zoom: [z[0], z[0] + dz * 1.35], t: c.t }), dx = (MS.u.sio(u) - .5) * c.W * (o.troi ?? .03);
      x.save(); x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 30; x.drawImage(tien, rf.x + dx, rf.y, rf.w, rf.h); x.restore(); }
    return rb;
  };
  // Scenes with several CAMERA ANGLES (book[id].shots from timkiem): video clips and images alternate in `tim` order.
  // A still longer than 6.5 s splits itself into 2–4 angles (~6 s/angle): wide → close on a detail-rich area (diem) → close on another area → pull back; .35 s dissolve between angles
  // (video → video still cuts straight). A = { seq, img: {bid: image}, lop: {bid: [back, front]}, diem: {bid: [[fx,fy],…]} }, o = { zoom0, zoom, tam, fps }.
  MS.shots = async (x, c, shots, A, o = {}) => {
    const fps = o.fps || 30, XF = .35, last = shots.length - 1, eio = MS.u.eio;
    const at = lt => { let i = 0; while (i < last && lt >= shots[i + 1].t0) i++; return i; };
    const subs = i => { const s = shots[i], L = (i === last ? Math.max(c.D, s.t1) : s.t1) - s.t0; return { L, n: s.k === 'a' && L > 6.5 && !o.mot_goc ? Math.min(4, Math.max(2, Math.ceil(L / 6))) : 1 }; };   // o.mot_goc: maps/prints — one slow push, no close-ups
    const draw = async (i, lt) => {
      const s = shots[i];
      if (s.k === 'v') { await A.seq(x, { ...c, lt: s.f0 / fps + Math.max(0, lt - s.t0) }); return { x: 0, y: 0, w: c.W, h: c.H, s: 1 }; }
      const { L, n } = subs(i), sl = L / n, j = Math.min(n - 1, Math.floor(Math.max(0, lt - s.t0) / sl)), u = clamp((lt - s.t0 - j * sl) / sl);
      const im = A.img[s.id], ly = A.lop[s.id], base = (ly && ly[0]) || im; if (!base) return null;
      const up = Math.max(c.W / base.width, c.H / base.height), zmax = Math.max(1.12, 2.1 / up);   // small image: don't zoom in too far (avoids breaking up)
      const pts = A.diem[s.id] || [[.4, .4], [.6, .55]], z0 = o.zoom0 ?? 1.04, dz = o.zoom ?? .1;
      // image far from the frame's aspect ratio (portrait, square coin, long map in a 16:9 frame): the wide angle shows the WHOLE image on its own blurred background,
      // close angles zoom only moderately — "cover" + deep zoom would leave only a nose/mouth, subject unrecognisable
      const ar = (base.width / base.height) / (c.W / c.H), lech = !o.day && (ar < .72 || ar > 1.6), fit = Math.min(c.W / base.width, c.H / base.height) / Math.max(c.W / base.width, c.H / base.height);
      const wide = (z, z2, f) => lech ? { zoom: [fit * .9, fit * .97], focus: [.5, .5] } : { zoom: [z, z2], focus: f };
      const dz1 = lech ? [fit * 1.38, fit * 1.3] : [Math.min(zmax, 1.4), Math.min(zmax, 1.4) - .08], dz2 = lech ? [fit * 1.16, fit * 1.26] : [Math.min(zmax, 1.24), Math.min(zmax, 1.24) + .08];   // off-ratio: close = whole image ×1.2–1.4 (face/coin stays intact)
      const F = [wide(z0, z0 + dz, o.tam || [.5, .45]),
                 { zoom: dz1, focus: pts[0] },
                 { zoom: dz2, focus: pts[1] || pts[0], pan: lech ? undefined : [[-.15, 0], [.15, 0]] },
                 wide(Math.min(zmax, 1.2), 1.06, [(pts[0][0] + .5) / 2, .5])][j];                                 // angle 4: pull back, wide again
      if (lech) {                                                                  // background: the same image filling the frame, blurred + darkened (every angle — the image doesn't cover the frame)
        x.save(); const f0 = x.filter && x.filter !== 'none' ? x.filter + ' ' : ''; x.filter = f0 + 'blur(28px) brightness(.42)';
        const r0 = MS.kb(base, c.W, c.H, u, { zoom: [1.12, 1.16], t: c.t }); x.drawImage(base, r0.x, r0.y, r0.w, r0.h); x.restore();
        x.save(); x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 40; const r = MS.still(x, im || base, c, { ...F, u }); x.restore(); return r;   // whole image: no 2.5D split (the inpainted back layer looks fake when its edge shows)
      }
      return ly ? MS.still25(x, ly[0], ly[1], c, { ...F, u }) : MS.still(x, im || base, c, { ...F, u });
    };
    const i = at(c.lt), s = shots[i], { L, n } = subs(i), j = Math.min(n - 1, Math.floor(Math.max(0, c.lt - s.t0) / (L / n)));
    const b0 = s.t0 + j * L / n, q = (c.lt - b0) / XF;                            // b0: when the current camera angle starts
    const hard = j === 0 && (i === 0 || (s.k === 'v' && shots[i - 1].k === 'v'));  // scene start (already has a transition) or video→video: hard cut
    if (q < 1 && !hard) { await draw(j > 0 ? i : i - 1, b0 - 1e-3); x.save(); x.globalAlpha = eio(clamp(q)); const r = await draw(i, c.lt); x.restore(); return r; }
    return draw(i, c.lt);
  };
  // point in the image (ratio 0..1) → frame coordinates, via MS.still's transform r
  MS.at = (r, fx, fy) => r ? [r.x + fx * r.w, r.y + fy * r.h] : [0, 0];

  // "Morph" transition: image B appears gradually by its own brightness (bright areas first), the transition edge has blur + a soft flash.
  const tmp = { a: null, b: null, m: null };
  MS.morph = (x, drawA, drawB, q, c, o = {}) => {
    if (q <= 0) return drawA(x); if (q >= 1) return drawB(x);
    if (!tmp.a || tmp.a.width !== c.W) { tmp.a = canvas(c.W, c.H); tmp.b = canvas(c.W, c.H); tmp.m = canvas(c.W >> 2, c.H >> 2); }
    const A = tmp.a.getContext('2d'), B = tmp.b.getContext('2d'), Mk = tmp.m.getContext('2d');
    A.setTransform(1, 0, 0, 1, 0, 0); B.setTransform(1, 0, 0, 1, 0, 0); drawA(A); drawB(B);
    // mask: brightness of image B (downscaled, blurred) against a threshold running with q
    const mw = tmp.m.width, mh = tmp.m.height; Mk.filter = 'blur(6px) grayscale(1)'; Mk.drawImage(tmp.b, 0, 0, mw, mh); Mk.filter = 'none';
    const id = Mk.getImageData(0, 0, mw, mh), d = id.data, soft = o.soft ?? .18, th = lerp(1 + soft, -soft, sio(q));
    for (let i = 0; i < d.length; i += 4) { const L = d[i] / 255; const a = clamp((L - th) / soft); d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = a * 255; }
    Mk.putImageData(id, 0, 0);
    x.drawImage(tmp.a, 0, 0); B.globalCompositeOperation = 'destination-in'; B.imageSmoothingEnabled = true; B.drawImage(tmp.m, 0, 0, c.W, c.H); B.globalCompositeOperation = 'source-over';
    x.drawImage(tmp.b, 0, 0);
    if (o.flash !== false) { x.save(); x.globalCompositeOperation = 'screen'; x.globalAlpha = Math.sin(Math.PI * q) * .22; x.fillStyle = o.flashColor || '#fff2dc'; x.fillRect(0, 0, c.W, c.H); x.restore(); }
  };
})();
