// mega-shot · film assembly loop: reads build/timeline.json (created by `xp giong`), calls each scene's draw(),
// handles transitions, 2D post-processing, subtitles, fade in/out. Deterministic: everything is computed from t. render(t) may be async (loading images, 3D).
//
// MS.film({
//   scenes: { '<id>': { draw(x, c) {...}, prepare?: async () => {} }, '*': {...} },   // '*' = default
//   transition: { type: 'tu-dong' | 'fade' | 'phong' | 'lia' | 'loe' | 'lan-xuyen' | 'gon-nuoc' | 'cat', dur: .42 },   // needs fx.js; a scene overrides with chuyen:
//   overlay(x, c), post(x, t), topShade: true, vignette: .42, grain: true, subs: true,
// })
// c = { i, id, t, lt, D, ra (leaving: don't draw text), q (incoming transition progress, 0→1), vt (seconds since narration started), vdur, sc (scene), prev, next, W, H }
(() => {
  const MS = window.MS, { clamp, sio, canvas } = MS.u;
  MS.film = async (cfg) => {
    const TL = await (await fetch(cfg.timeline || 'build/timeline.json')).json();
    MS.TL = TL; MS.FMT = MS.FORMATS[TL.format]; MS.LANG = TL.lang; Object.assign(MS.STYLE, TL.style || {}, cfg.style || {});
    const { W, H } = MS.FMT, out = document.getElementById('c'); out.width = W; out.height = H;
    const g = out.getContext('2d'), A = canvas(W, H), B = canvas(W, H), S = TL.scenes;
    const def = id => cfg.scenes[id] || cfg.scenes['*'];
    for (const id of new Set(S.map(s => s.id))) { const d = def(id); if (d && d.prepare) await d.prepare(TL); }
    if (cfg.prepare) await cfg.prepare(TL);
    const trOf = i => { const d = S[i].data || {}; let type = d.chuyen || (cfg.transition || {}).type || 'fade';
      if (type === 'tu-dong') type = MS.fx ? MS.fx.VONG[(i - 1) % MS.fx.VONG.length] : 'fade';                 // automatic transition cycle, no immediate repeats
      return { type, dur: d.chuyen_dai ?? (cfg.transition || {}).dur ?? .8 }; };
    const ctxOf = (i, lt, t, ra = false) => { const sc = S[i], vs = sc.voice ? sc.voice.t0 - sc.t0 : 0, tr = trOf(i); return { i, id: sc.id, t, lt, D: sc.t1 - sc.t0, q: i > 0 && tr.type !== 'cut' ? clamp(lt / tr.dur) : 1, trDur: tr.dur, vt: lt - vs, vdur: sc.voice ? sc.voice.dur : 0, sc, data: sc.data || {}, prev: S[i - 1], next: S[i + 1], W, H, ra }; };   // ra = scene is leaving (dissolving into the next) → don't draw text
    const draw = async (x, i, lt, t, ra) => { x.save(); x.globalAlpha = 1; x.setTransform(1, 0, 0, 1, 0, 0); const d = def(S[i].id); if (!d) throw new Error('Missing scene: ' + S[i].id); await d.draw(x, ctxOf(i, lt, t, ra)); x.restore(); };
    window.render = async (t) => {
      t = clamp(t, 0, TL.dur - 1e-6); let i = 0; while (i < S.length - 1 && t >= S[i + 1].t0) i++;
      const lt = t - S[i].t0, tr = trOf(i);
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      if (i > 0 && lt < tr.dur && (tr.type === 'fade' || (cfg.allTransitions && tr.type !== 'cut' && tr.type !== 'cat'))) {   // allTransitions (opt-in): every transition type in MS.fx.TR is drawn; default keeps the old behaviour (fade only)
        const ax = A.getContext('2d'), bx = B.getContext('2d'); await draw(ax, i - 1, t - S[i - 1].t0, t, true); await draw(bx, i, lt, t);
        if (MS.fx && MS.fx.TR[tr.type]) MS.fx.TR[tr.type](g, A, B, clamp(lt / tr.dur), S[i].data || {});
        else { g.drawImage(A, 0, 0); g.globalAlpha = sio(lt / tr.dur); g.drawImage(B, 0, 0); g.globalAlpha = 1; }
      } else await draw(g, i, lt, t);
      // theme overlays (phong_cach.lop_phu, a scene overrides with lop_phu: [...] or false)
      const lp = (S[i].data || {}).lop_phu ?? (TL.style || {}).lop_phu; if (MS.fx && lp) MS.fx.lopPhu(g, t, lp, W, H, (S[i].data || {}).lop_phu_muc ?? 1);
      // huashu scenes (and `hau_ky: false`) keep their own look: no colour grade, vignette, top shade or grain on top
      const clean = (S[i].data || {}).huashu || (S[i].data || {}).hau_ky === false;
      if (cfg.post && !clean) cfg.post(g, t);
      if (cfg.vignette !== false && !clean) MS.vignette(g, cfg.vignette ?? .42);
      if (cfg.topShade && !clean) MS.topShade(g);
      if (cfg.grain !== false && !clean) MS.grain(g, t);
      MS.letterbox(g);
      if (MS.dh) { MS.dh.thuoc(g, t, TL); MS.dh.thoigian(g, t, TL); }                    // depth gauge / history timeline (nam:) — a marker running through the whole video (if a scene has do_sau)
      if (cfg.overlay) cfg.overlay(g, ctxOf(i, lt, t));
      if (cfg.subs !== false && !(cfg.hideSubs && cfg.hideSubs(t))) MS.subtitle(g, t, TL.subs);
      const fi = cfg.fadeIn ?? (H > W ? 0 : .6),   // portrait (TikTok/Reels): frame 0 must already be bright — it is the cover image and the hook
            fo = cfg.fadeOut ?? .8, fade = Math.max(1 - t / fi, (t - (TL.dur - fo)) / fo);
      if (fade > 0) { g.fillStyle = `rgba(0,0,0,${clamp(fade)})`; g.fillRect(0, 0, W, H); }
      return 1;
    };
    window.DUR = TL.dur; window.GPU = cfg.gpu ? cfg.gpu() : 'canvas2d'; window.READY = true;
    const h = +(location.hash.slice(1)); if (h) await window.render(h);
  };
})();
