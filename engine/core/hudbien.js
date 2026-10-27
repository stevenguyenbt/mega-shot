// mega-shot · deep-sea instrument HUD: DEPTH · PRESSURE · TEMP · LIGHT + water-zone name + depth bar.
// Enable with phong_cach.hud_bien: true. Per scene: `sau: 500` (hold) or `sau: [0, 1000]` (dive from → to within the scene);
// a scene with `bien3d: { tu, den }` takes its depth from the 3D submersible automatically. Scenes without it → HUD hidden (fades out).
// The figures are TYPICAL values (open ocean, low latitude), marked "≈":
//   pressure ≈ 1 atm + 1 atm per ~10 m of seawater · sunlight ~1 % left at 200 m, treated as 0 below 1,000 m
//   temperature: ~20 °C surface → ~15 °C (200 m) → ~4 °C (1,000 m) → ~2 °C (4,000 m) → ~1.5 °C (trench floor)
(() => {
  const MS = window.MS, { clamp } = MS.u;
  const io = u => { u = clamp(u); return u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
  const ZONES = [[0, 200, 'SUNLIGHT ZONE', 'TẦNG ÁNH SÁNG'], [200, 1000, 'TWILIGHT ZONE', 'TẦNG CHẠNG VẠNG'], [1000, 4000, 'MIDNIGHT ZONE', 'TẦNG NỬA ĐÊM'],
                 [4000, 6000, 'THE ABYSS', 'VỰC THẲM'], [6000, 1e9, 'HADAL TRENCH', 'RÃNH SÂU']];
  const TEMP = [[0, 20], [200, 15], [1000, 4], [4000, 2], [11000, 1.5]];
  const temp = d => { for (let i = 1; i < TEMP.length; i++) if (d <= TEMP[i][0]) { const [a, ta] = TEMP[i - 1], [b, tb] = TEMP[i]; return ta + (tb - ta) * (d - a) / (b - a); } return 1.5; };
  const light = d => 100 * Math.pow(10, -2 * d / 200);                            // 100 % → 1 % at 200 m → 0.01 % at 400 m
  const vi = () => String(MS.LANG || 'en').startsWith('vi');
  const fmt = (n, k = 0) => Number(n).toLocaleString(vi() ? 'vi-VN' : 'en-US', { maximumFractionDigits: k, minimumFractionDigits: k });
  // scene depth at time lt (same curve as ocean3d.js)
  const depthOf = (d, lt, D) => { const b = d.bien3d; let tu, den;
    if (b) { tu = +(b.tu ?? 0); den = +(b.den ?? tu); } else if (d.sau != null) { [tu, den] = Array.isArray(d.sau) ? d.sau.map(Number) : [+d.sau, +d.sau]; } else return null;
    return tu + (den - tu) * io(clamp((lt - .3) / Math.max(.5, D - .9))); };
  const has = sc => sc && sc.data && (sc.data.bien3d || sc.data.sau != null);
  const box = (x, X, Y, w, h) => { x.fillStyle = 'rgba(3,12,22,.62)'; x.beginPath(); x.roundRect(X, Y, w, h, 14); x.fill();
    x.strokeStyle = 'rgba(127,227,255,.35)'; x.lineWidth = 2; x.stroke(); x.strokeStyle = '#7fe3ff'; x.lineWidth = 4; const L = 22;   // gauge-style corner brackets
    for (const [cx, cy, sx, sy] of [[X, Y, 1, 1], [X + w, Y, -1, 1], [X, Y + h, 1, -1], [X + w, Y + h, -1, -1]]) { x.beginPath(); x.moveTo(cx, cy + sy * L); x.lineTo(cx, cy); x.lineTo(cx + sx * L, cy); x.stroke(); } };
  const t = (x, s, X, Y, size, col, w = 800, al = 'left') => { x.font = `${w} ${size}px ${MS.STYLE.font}`; x.textAlign = al; x.textBaseline = 'middle'; x.fillStyle = col; x.fillText(s, X, Y); };

  MS.hud = MS.hud || {};
  MS.hud.depthOf = depthOf;
  MS.hud.bien = (x, c, dOverride) => {
    if (!has(c.sc) && dOverride == null) return;
    const d = Math.max(0, dOverride ?? depthOf(c.data, c.lt, c.D)), tall = c.H > c.W;
    const a = has(c.prev) ? 1 : clamp((c.lt - .1) / .45), nx = c.next, out = has(nx) ? 1 : clamp((c.D - c.lt) / .4);
    x.save(); x.globalAlpha = a * out;
    const Wb = tall ? 940 : 900, X = (c.W - Wb) / 2 - (tall ? 20 : 0), Y = tall ? 150 : 40, Hb = tall ? 200 : 170, cw = Wb / 4;
    box(x, X, Y, Wb, Hb);
    const pr = 1 + d / 10.06, li = light(d), zone = ZONES.find(z => d >= z[0] && d < z[1]);
    const cells = [
      ['DEPTH', d < 1 ? '0' : fmt(Math.round(d)), 'm', '#ffffff'],
      ['PRESSURE', '≈' + fmt(pr < 100 ? +pr.toFixed(pr < 10 ? 1 : 0) : Math.round(pr / 10) * 10, pr < 10 ? 1 : 0), 'atm', pr > 300 ? '#ff8a6a' : pr > 50 ? '#ffd27a' : '#ffffff'],
      ['TEMP', '≈' + fmt(temp(d), 1), '°C', temp(d) < 5 ? '#9fd8ff' : '#ffffff'],
      ['SUNLIGHT', d >= 1000 ? 'NONE' : li >= 1 ? fmt(li, li >= 10 ? 0 : 1) : li >= .01 ? fmt(li, 2) : '<0.01', d >= 1000 ? '' : '%', d >= 1000 ? '#ff8a6a' : '#ffffff']];
    if (vi()) { cells[0][0] = 'ĐỘ SÂU'; cells[1][0] = 'ÁP SUẤT'; cells[2][0] = 'NHIỆT ĐỘ'; cells[3][0] = 'ÁNH SÁNG'; if (d >= 1000) cells[3][1] = 'KHÔNG'; }
    cells.forEach(([lab, val, un, col], k) => { const cx = X + cw * k + cw / 2;
      if (k) { x.fillStyle = 'rgba(127,227,255,.22)'; x.fillRect(X + cw * k, Y + 26, 2, Hb - 52); }
      t(x, lab, cx, Y + (tall ? 46 : 40), tall ? 26 : 24, 'rgba(127,227,255,.9)', 700, 'center');
      x.font = `800 ${tall ? 56 : 50}px ${MS.STYLE.font}`; const vw = x.measureText(val).width; x.font = `700 ${tall ? 28 : 26}px ${MS.STYLE.font}`; const uw = un ? x.measureText(un).width + 8 : 0;
      t(x, val, cx - (vw + uw) / 2, Y + (tall ? 112 : 98), tall ? 56 : 50, col, 800); if (un) t(x, un, cx - (vw + uw) / 2 + vw + 8, Y + (tall ? 120 : 106), tall ? 28 : 26, 'rgba(225,240,255,.85)', 700); });
    // water zone + progress ticks 0 → 11,000 m at the bottom of the box
    const zy = Y + Hb - (tall ? 36 : 32), bx = X + 36, bw = Wb - 72;
    x.fillStyle = 'rgba(127,227,255,.18)'; x.fillRect(bx, zy + 18, bw, 6); x.fillStyle = '#7fe3ff'; x.fillRect(bx, zy + 18, bw * clamp(d / 11000), 6);
    t(x, '▼ ' + (zone ? zone[vi() ? 3 : 2] : ''), bx, zy - 2, tall ? 26 : 24, '#7fe3ff', 800);
    t(x, (vi() ? 'đáy sâu nhất ' : 'max ') + '≈11,000 m', bx + bw, zy - 2, tall ? 22 : 20, 'rgba(225,240,255,.6)', 600, 'right');
    // subtle scan line for the feel of a running instrument
    const sy = Y + ((c.t * 90) % Hb); x.fillStyle = 'rgba(127,227,255,.07)'; x.fillRect(X + 4, sy, Wb - 8, 3);
    x.restore();
  };
})();
