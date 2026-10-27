// mega-shot · vetinh.js — "Satellite Briefing" scenes (evidence style adapted from lemo-opuscar, MIT; references/evidence/satellite-briefing.md).
// Real satellite plates from `xp vetinh` (Sentinel-2 + NASA Blue Marble) under a camera that dives from the region to the place,
// an analyst's grey grade, and thin white measurement marks that sit on real coordinates. One finding per screen, in amber.
//
// scene YAML:
//   ve_tinh:
//     thu_muc: ve_tinh/<name>                # written by `xp vetinh <name> --center LAT,LON --km N`
//     cam: [{t: 0, km: 600}, {t: 2.4, km: 14, lat: 48.86, lon: 2.35}]   # optional; default: dive region → place over the first 45 %, then a slow creep
//     xam: 0.85                              # grey amount after the dive (0 = keep true colour); mau_lai: <s> → colour returns (the story turns)
//     diem: [{lat, lon, chu, phu, t}]        # reticle locks on a point, label on a leader line (phu = small second line)
//     duong: [{tu: [lat, lon], den: [lat, lon], t, chu, nguon}]   # range line grows with km ticks; the reading rolls in amber and lands
//     vung: [{diem: [[lat, lon], …], t, chu}] # outline drawn on (an area, a front line claimed by one side → say whose claim in `chu`)
//     truoc: {t, nhan_truoc, nhan_sau}       # scan from truoc.webp (xp vetinh --before) to the current plate
// Marks are screen-space only for instruments (scale bar, view width) — everything else is anchored to the ground.
(() => {
  const { clamp, eio, eo3 } = MS.u;
  const back = t => { const c = 1.9; t = clamp(t) - 1; return 1 + (c + 1) * t * t * t + c * t * t; };
  const KM = 111.32;

  MS.vetinh = async (dir, spec = {}) => {
    const meta = await (await fetch(dir + '/meta.json')).json();
    const plates = [];
    for (const p of meta.plates) plates.push({ ...p, img: await MS.img(dir + '/' + p.file) });
    const lat0 = meta.tam[0], cosl = Math.cos(lat0 * Math.PI / 180);
    const P = n => plates.find(p => p.ten === n);
    const kmW = p => (p.bbox[2] - p.bbox[0]) * KM * cosl;

    function camAt(t, D) {
      let K = spec.cam;
      if (!K || !K.length) {
        const v = P('vung'), g = P('giua'), d = P('chi_tiet');
        K = [{ t: 0, km: kmW(v) * .55 }, { t: D * .22, km: kmW(g) * .8 }, { t: D * .45, km: kmW(d) * .9 }, { t: D, km: kmW(d) * .72 }];
      }
      K = K.map(k => ({ lat: meta.tam[0], lon: meta.tam[1], ...k }));
      if (t <= K[0].t) return K[0];
      for (let i = 1; i < K.length; i++) if (t <= K[i].t) {
        const a = K[i - 1], b = K[i], u = eio((t - a.t) / Math.max(.01, b.t - a.t));
        return { km: Math.exp(Math.log(a.km) + (Math.log(b.km) - Math.log(a.km)) * u), lat: a.lat + (b.lat - a.lat) * u, lon: a.lon + (b.lon - a.lon) * u, last: i === K.length - 1 };
      }
      const z = K[K.length - 1]; return { ...z, km: z.km * (1 - .03 * clamp((t - z.t) / 4)) };   // holds keep creeping
    }

    function draw(x, c) {
      const { W, H } = c, t = c.lt, D = c.D, cam = camAt(t, D), ppk = W / cam.km;
      const S = (lat, lon) => [W / 2 + (lon - cam.lon) * KM * cosl * ppk, H / 2 + (cam.lat - lat) * KM * ppk];
      const rect = p => { const [x0, y0] = S(p.bbox[3], p.bbox[0]), [x1, y1] = S(p.bbox[1], p.bbox[2]); return [x0, y0, x1 - x0, y1 - y0]; };
      const diveEnd = spec.cam && spec.cam.length ? spec.cam[spec.cam.length - 1].t : D * .45;
      // ground: coarse → fine; a finer plate fades in once it is sharper than the screen
      let g = (spec.xam ?? .85) * eo3(clamp((t - diveEnd + .2) / .7));
      if (spec.mau_lai != null) g *= 1 - eo3(clamp((t - spec.mau_lai) / .8));
      x.save(); x.fillStyle = '#05080b'; x.fillRect(0, 0, W, H);
      x.filter = g > .01 ? `grayscale(${g}) contrast(${1 + .22 * g}) brightness(${1 - .12 * g})` : 'none';
      for (const n of ['vung', 'giua', 'chi_tiet']) {
        const p = P(n); if (!p || !p.img) continue; const r = rect(p);
        const a = n === 'vung' ? 1 : Math.min(clamp((p.img.width / r[2] - .3) / .4), eo3(clamp((r[2] / W - .75) / .5)));   // sharp enough AND already filling the frame → no small mismatched box mid-dive
        if (a <= 0) continue; x.globalAlpha = a; x.drawImage(p.img, ...r);
      }
      const tr = spec.truoc, pb = P('truoc');
      if (tr && pb && pb.img) {                                                   // before → after: a soft scan front moving down the frame
        const r = rect(pb), u = clamp((t - tr.t) / 1.1), yScan = -H * .1 + u * H * 1.2;
        x.globalAlpha = 1; x.save(); x.beginPath(); x.rect(0, yScan, W, H * 2); x.clip(); x.drawImage(pb.img, ...r); x.restore();
        if (u > 0 && u < 1) { const gr = x.createLinearGradient(0, yScan - 60, 0, yScan + 10); gr.addColorStop(0, 'rgba(220,235,255,0)'); gr.addColorStop(1, 'rgba(220,235,255,.35)'); x.filter = 'none'; x.fillStyle = gr; x.fillRect(0, yScan - 60, W, 70); }
      }
      x.restore();
      // marks (never graded): halo then hairline
      const line = (pts, w = 2.4, col = '#F2F5F6', dash) => { x.save(); x.lineJoin = x.lineCap = 'round'; if (dash) x.setLineDash(dash);
        for (const [lw, cs] of [[w + 4, 'rgba(0,0,0,.55)'], [w, col]]) { x.lineWidth = lw; x.strokeStyle = cs; x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke(); } x.restore(); };
      const text = (s, X0, Y0, fs, col = '#F2F5F6', wt = 800, al = 'left', fam = 'BVP') => { x.save(); x.font = `${wt} ${fs}px ${fam}, sans-serif`; x.textAlign = al; x.textBaseline = 'alphabetic';
        x.lineWidth = Math.max(3, fs * .14); x.strokeStyle = 'rgba(0,0,0,.6)'; x.strokeText(s, X0, Y0); x.fillStyle = col; x.fillText(s, X0, Y0); x.restore(); };
      const F = Math.min(W, H) / 1080, EN = meta.ngon_ngu === 'en', num = v => EN ? String(v) : String(v).replace('.', ',');
      for (const d of spec.diem || []) {                                          // reticle: brackets snap in with overshoot, then the label
        const u = clamp((t - (d.t ?? diveEnd)) / .5); if (u <= 0) continue;
        const [px, py] = S(d.lat, d.lon), s = (150 - 88 * back(u)) * F, k = s * .38;
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) line([[px + sx * s, py + sy * (s - k)], [px + sx * s, py + sy * s], [px + sx * (s - k), py + sy * s]], 2.6 * F);
        line([[px - 6 * F, py], [px + 6 * F, py]], 2 * F); line([[px, py - 6 * F], [px, py + 6 * F]], 2 * F);
        const v = clamp((t - (d.t ?? diveEnd) - .45) / .4);
        if (v > 0 && d.chu) { const lx = px + (px < W * .55 ? 1 : -1) * 120 * F, ly = py - 110 * F, al = px < W * .55 ? 'left' : 'right';
          x.save(); x.globalAlpha = v; line([[px + (px < W * .55 ? 1 : -1) * s * .7, py - s * .7], [lx, ly]], 2 * F);
          text(d.chu, lx + (al === 'left' ? 10 : -10) * F, ly - 8 * F, 40 * F, '#F2F5F6', 800, al);
          if (d.phu) text(d.phu, lx + (al === 'left' ? 10 : -10) * F, ly + 30 * F, 26 * F, '#c9d1d4', 600, al, 'OSW'); x.restore(); }
      }
      for (const v of spec.vung || []) {                                          // outline drawn on
        const u = clamp((t - (v.t ?? diveEnd)) / 1.4); if (u <= 0) continue;
        const pts = v.diem.map(([a, b]) => S(a, b)); pts.push(pts[0]);
        let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        line(pts, 2.6 * F, '#F2F5F6', [L * eo3(u), L]);
        if (v.chu && u > .6) { const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = Math.min(...pts.map(p => p[1])) - 18 * F; x.save(); x.globalAlpha = clamp((u - .6) / .3); text(v.chu, cx, cy, 30 * F, '#F2F5F6', 700, 'center', 'OSW'); x.restore(); }
      }
      for (const d of spec.duong || []) {                                         // range line + rolling reading (one finding, amber)
        const t0 = d.t ?? diveEnd, u = eio(clamp((t - t0) / 1.6)); if (t < t0) continue;
        const [ax, ay] = S(...d.tu), [bx, by] = S(...d.den), ex = ax + (bx - ax) * u, ey = ay + (by - ay) * u;
        const dk = KM * Math.hypot((d.den[0] - d.tu[0]), (d.den[1] - d.tu[1]) * cosl);
        line([[ax, ay], [ex, ey]], 4 * F);
        const step = dk > 60 ? 10 : dk > 15 ? 5 : 1, nx = -(by - ay), ny = bx - ax, nl = Math.hypot(nx, ny) || 1;
        for (let k = step; k < dk * u; k += step) { const f = k / dk, qx = ax + (bx - ax) * f, qy = ay + (by - ay) * f, tl = (k % (step * 5) ? 9 : 16) * F;
          line([[qx - nx / nl * tl, qy - ny / nl * tl], [qx + nx / nl * tl, qy + ny / nl * tl]], 2 * F); }
        const land = clamp((t - t0 - 1.6) / .25), val = dk * u, X1 = W * .64, Y1 = H * .30;
        text(d.chu || (EN ? 'DISTANCE' : 'KHOẢNG CÁCH'), X1, Y1 - 120 * F, 28 * F, '#F2F5F6', 600, 'left', 'OSW');
        x.save(); x.translate(X1, Y1); const sc = 1 + .12 * Math.sin(Math.PI * land); x.scale(sc, sc);
        text(`${val < 10 ? num(val.toFixed(1)) : Math.round(val)} km`, 0, 0, 110 * F, u < 1 ? 'rgba(255,190,85,.75)' : '#FFBE55', 300, 'left', 'OSW'); x.restore();
        text(d.nguon || (EN ? 'measured on satellite image' : 'đo trên ảnh vệ tinh'), X1, Y1 + 46 * F, 24 * F, '#c9d1d4', 500, 'left', 'OSW');
      }
      // instruments: view width + scale bar (screen space)
      const nice = [.1, .2, .5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000], bar = nice.find(n => n * ppk > 110 * F) || 1000, bx0 = W * .055, by0 = H * .175;
      line([[bx0, by0], [bx0 + bar * ppk, by0]], 3 * F); line([[bx0, by0 - 8 * F], [bx0, by0 + 8 * F]], 2 * F); line([[bx0 + bar * ppk, by0 - 8 * F], [bx0 + bar * ppk, by0 + 8 * F]], 2 * F);
      text(`${bar} km`, bx0 + bar * ppk + 14 * F, by0 + 9 * F, 26 * F, '#F2F5F6', 500, 'left', 'OSW');
      text(`${EN ? 'VIEW' : 'TẦM NHÌN'} ${cam.km < 10 ? num(cam.km.toFixed(1)) : Math.round(cam.km)} KM`, bx0, by0 + 44 * F, 24 * F, '#c9d1d4', 500, 'left', 'OSW');
    }
    draw.chu_thich = meta.chu_thich; draw.meta = meta;
    return draw;
  };
})();
