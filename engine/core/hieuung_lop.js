// mega-shot · hieuung_lop.js — illustration "layer styles" for code-drawn art (outline stroke, cel inner shadow, inner glow rim,
// bevel light, paper noise, tapered ink). Algorithms ported from PhotoCraft's CPU compositor (crates/compose/src/effects.rs,
// crates/paint, crates/engine/src/vector_cmds.rs stroke_points).
//   PhotoCraft: Copyright (c) 2026 ArtCraft Team and the PhotoCraft contributors — MIT License (https://opensource.org/licenses/MIT).
//
//   const part = MS.lop.ve(w, h, g => { g.fill(path) }, { net: { size, mau }, bong: { mau, goc, xa, mo, do_dam }, sang: {...}, vien_sang: {...}, nhieu })
//   → canvas with the styled part (transparent background). All maps are Float32 alpha arrays (0..1).
(() => {
  const MS = window.MS = window.MS || {};
  const INF = 1e20, EPS = .5 / 255;
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const hex = c => { c = c.replace('#', ''); if (c.length === 3) c = [...c].map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16)); };

  // ---- alpha map in / out ----
  function alphaOf(cv) { const { width: w, height: h } = cv, d = cv.getContext('2d').getImageData(0, 0, w, h).data, a = new Float32Array(w * h); for (let i = 0; i < w * h; i++) a[i] = d[i * 4 + 3] / 255; return a; }
  function paintMap(g, m, w, h, color, op = 1, blend = 'source-over') {           // coverage map → colour layer
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), im = x.createImageData(w, h), [r, gg, b] = hex(color);
    for (let i = 0; i < w * h; i++) { const k = i * 4; im.data[k] = r; im.data[k + 1] = gg; im.data[k + 2] = b; im.data[k + 3] = Math.round(clamp(m[i] * op) * 255); }
    x.putImageData(im, 0, 0); g.save(); g.globalCompositeOperation = blend; g.drawImage(c, 0, 0); g.restore();
  }
  // ---- exact Euclidean distance transform (Felzenszwalb–Huttenlocher, PhotoCraft dt1 / edt_nearest) ----
  function dt1(f, n, d, v, z) { let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) { let s; do { const p = v[k]; s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p); if (s <= z[k]) k--; else break; } while (k >= 0); k++; v[k] = q; z[k] = s; z[k + 1] = INF; }
    k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const dq = q - v[k]; d[q] = dq * dq + f[v[k]]; } }
  function edt(seed, w, h) {                                                     // seed[i] = true → distance 0; returns sqrt distance
    const n = Math.max(w, h), f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1), D = new Float64Array(w * h);
    for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = seed[y * w + x] ? 0 : INF; dt1(f, h, d, v, z); for (let y = 0; y < h; y++) D[y * w + x] = d[y]; }
    for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = D[y * w + x]; dt1(f, w, d, v, z); for (let x = 0; x < w; x++) D[y * w + x] = Math.sqrt(d[x]); }
    return D;
  }
  const distOutside = (a, w, h) => { const ins = a.map(v => v > EPS ? 1 : 0), D = edt(ins, w, h), o = new Float32Array(w * h); for (let i = 0; i < w * h; i++) o[i] = ins[i] ? -.5 : D[i] - .5 + (1 - 0); return o; };
  const distInside = (a, w, h) => { const out = a.map(v => v > EPS ? 0 : 1), D = edt(out, w, h), o = new Float32Array(w * h); for (let i = 0; i < w * h; i++) o[i] = out[i] ? -.5 : D[i] - .5; return o; };
  // ---- tent blur = two fractional box passes (PhotoCraft blur/tent/box_line) ----
  function boxLine(src, dst, n, stride, off, wdt) {
    const r = Math.ceil(wdt / 2 - .5), fr = clamp(wdt / 2 - (r - .5)), inv = 1 / wdt, at = i => src[off + clamp(i, 0, n - 1) * stride];
    for (let i = 0; i < n; i++) { let s = 0; for (let k = -r + 1; k <= r - 1; k++) s += at(i + k); s += fr * (at(i - r) + at(i + r)); dst[off + i * stride] = s * inv; }
  }
  function tent(m, w, h, wdt) { if (wdt <= 1) return m.slice(); wdt = Math.min(wdt, 512); let a = m.slice(), b = new Float32Array(w * h);
    for (let pass = 0; pass < 2; pass++) { for (let y = 0; y < h; y++) boxLine(a, b, w, 1, y * w, wdt); for (let x = 0; x < w; x++) boxLine(b, a, h, w, x, wdt); } return a; }
  function shift(m, w, h, dx, dy, fillOut = 0) { const o = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const sx = x - dx, sy = y - dy; o[y * w + x] = sx >= 0 && sy >= 0 && sx < w && sy < h ? m[sy * w + sx] : fillOut; } return o; }
  const offset = (ang, dist) => [Math.round(-Math.cos(ang * Math.PI / 180) * dist), Math.round(Math.sin(ang * Math.PI / 180) * dist)];
  const hashNoise = (x, y) => { let h = (Math.imul(x, 0x8da6b343) ^ Math.imul(y, 0xd8163841) ^ 0x9e3779b9) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0; return ((h >>> 8) & 0xffff) / 65536; };   // extra avalanche: no row banding

  // ---- the effects ----
  const E = {
    // outside stroke: thresholded distance field with a 1 px AA ramp, drawn UNDER the part
    net(a, w, h, size) { const d = distOutside(a, w, h), o = new Float32Array(w * h); for (let i = 0; i < w * h; i++) o[i] = a[i] > EPS ? 1 : clamp(size + .5 - d[i]); return o; },
    // inside stroke (inner line along the edge)
    net_trong(a, w, h, size) { const d = distInside(a, w, h), o = new Float32Array(w * h); for (let i = 0; i < w * h; i++) o[i] = a[i] > EPS ? clamp(size + .5 - d[i]) * a[i] : 0; return o; },
    // inner shadow: shifted (1 - alpha), choke, tent blur, × alpha  (size 0 → hard cel shadow)
    bong(a, w, h, { goc = 120, xa = 10, mo = 0, nghen = 0 } = {}) { const [dx, dy] = offset(goc, xa); let m = shift(a.map(v => 1 - v), w, h, dx, dy, 1);
      if (nghen > 0) { const r = Math.round(mo * nghen); if (r) { const d = distOutside(m, w, h); m = m.map((v, i) => Math.max(v, clamp(r + .5 - d[i]))); } }
      if (mo * (1 - nghen) > 1) m = tent(m, w, h, mo * (1 - nghen)); for (let i = 0; i < w * h; i++) m[i] *= a[i]; return m; },
    // drop shadow (outside the part, under it)
    bong_do(a, w, h, { goc = 120, xa = 8, mo = 8 } = {}) { const [dx, dy] = offset(goc, xa); let m = shift(a, w, h, dx, dy, 0); if (mo > 1) m = tent(m, w, h, mo); return m; },
    // inner glow, precise technique, edge source: linear falloff from the edge
    sang_mep(a, w, h, { co = 6, lan = 0 } = {}) { const d = distInside(a, w, h), solid = co * lan, o = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) { if (a[i] <= EPS) continue; const dd = d[i] + .5; o[i] = (dd <= solid ? 1 : clamp(1 - (dd - solid) / (co + 1 - solid))) * a[i]; } return o; },
    // bevel (smooth): height = tent(alpha), normal·light → highlight / shadow maps; cel: hard step
    bevel(a, w, h, { co = 12, sau = 1, goc = 120, cao = 30, cel = 0 } = {}) {
      const hm = tent(a, w, h, co), ds = sau * co, A = goc * Math.PI / 180, El = cao * Math.PI / 180, L = [Math.cos(A) * Math.cos(El), -Math.sin(A) * Math.cos(El), Math.sin(El)], se = Math.sin(El);
      const hi = new Float32Array(w * h), lo = new Float32Array(w * h);
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (a[i] <= EPS) continue;
        const gx = (hm[i + 1] - hm[i - 1]) * .5 * ds, gy = (hm[i + w] - hm[i - w]) * .5 * ds, nl = Math.hypot(gx, gy, 1), k = (-gx * L[0] - gy * L[1] + L[2]) / nl - se;
        let H = k > 0 ? clamp(k / (1 - se)) : 0, S = k < 0 ? clamp(-k / se) : 0; if (cel) { H = H > cel ? 1 : 0; S = S > cel ? 1 : 0; } hi[i] = H * a[i]; lo[i] = S * a[i]; }
      return { hi, lo };
    },
    nhieu(m, w, h, amt) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; m[i] = clamp(m[i] * (1 + (hashNoise(x, y) - .5) * 2 * amt)); } return m; },
  };

  // ---- one styled part: draw(g) paints the flat shape(s); styles follow PhotoCraft's paint order ----
  //   st: { net: {size, mau}, bong_do: {...,mau,op}, bong: {mau, op, goc, xa, mo, nghen}, sang: {mau, op, co}, bevel: {...,mau_sang, mau_toi, op}, nhieu: 0.04, pad }
  function ve(w, h, draw, st = {}) {
    const pad = st.pad ?? Math.ceil((st.net?.size || 0) + (st.bong_do ? (st.bong_do.xa || 8) + (st.bong_do.mo || 8) : 0) + 2), W = Math.ceil(w + pad * 2), H = Math.ceil(h + pad * 2);   // integer sizes: the maps index y·W + x
    const base = document.createElement('canvas'); base.width = W; base.height = H; const bx = base.getContext('2d'); bx.translate(pad, pad); draw(bx); bx.setTransform(1, 0, 0, 1, 0, 0);
    const a = alphaOf(base), out = document.createElement('canvas'); out.width = W; out.height = H; const g = out.getContext('2d');
    if (st.bong_do) paintMap(g, E.bong_do(a, W, H, st.bong_do), W, H, st.bong_do.mau || '#000000', st.bong_do.op ?? .35, 'source-over');
    if (st.net) paintMap(g, E.net(a, W, H, st.net.size), W, H, st.net.mau || '#2b1a10', 1);
    // the part itself + inner effects, clipped to its own alpha
    const body = document.createElement('canvas'); body.width = W; body.height = H; const px = body.getContext('2d'); px.drawImage(base, 0, 0);
    if (st.bong) paintMap(px, E.bong(a, W, H, st.bong), W, H, st.bong.mau || '#000000', st.bong.op ?? .35, st.bong.blend || 'multiply');
    if (st.sang) paintMap(px, E.sang_mep(a, W, H, st.sang), W, H, st.sang.mau || '#ffffff', st.sang.op ?? .35, st.sang.blend || 'screen');
    if (st.bevel) { const b = E.bevel(a, W, H, st.bevel); paintMap(px, b.hi, W, H, st.bevel.mau_sang || '#ffffff', st.bevel.op_sang ?? .45, 'screen'); paintMap(px, b.lo, W, H, st.bevel.mau_toi || '#000000', st.bevel.op_toi ?? .25, 'multiply'); }
    if (st.net_trong) paintMap(px, E.net_trong(a, W, H, st.net_trong.size), W, H, st.net_trong.mau || '#2b1a10', 1);
    if (st.nhieu) { const n = E.nhieu(new Float32Array(W * H).fill(.5), W, H, st.nhieu); paintMap(px, n.map((v, i) => Math.abs(v - .5) * 2 * a[i]), W, H, '#000000', .5, 'soft-light'); }
    px.globalCompositeOperation = 'destination-in'; px.drawImage(base, 0, 0);
    g.drawImage(body, 0, 0);
    out.pad = pad; return out;
  }
  // tapered ink line (PhotoCraft path.stroke simulatePressure): pressure = sin(π s / L), dabs every 0.1·diameter, build-up accumulation
  function nutMuc(g, pts, R, color = '#2b1a10', taper = 1) {
    const seg = []; let L = 0; for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); L += l; }
    g.save(); g.fillStyle = color; let s = 0, i = 0, acc = 0;
    while (i < seg.length) { const p = Math.max(.08, Math.pow(Math.sin(Math.PI * clamp(s / L)), taper)), r = R * p, step = Math.max(.5, .2 * r);
      const u = seg[i] ? acc / seg[i] : 0, x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); acc += step; s += step; while (i < seg.length && acc > seg[i]) { acc -= seg[i]; i++; } }
    g.restore();
  }
  MS.lop = { ve, nutMuc, E, edt, tent, alphaOf, paintMap };
})();
