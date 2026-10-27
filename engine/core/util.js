// mega-shot · shared utilities: easing, seeded rng, colour. No dependencies.
(() => {
  const MS = window.MS = window.MS || {};
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t;
  const eo3 = t => 1 - Math.pow(1 - clamp(t), 3);
  const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const sio = t => .5 - .5 * Math.cos(Math.PI * clamp(t));
  const back = (t, s = 1.4) => { t = clamp(t); return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
  const rgen = s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const hex = c => { c = c.length === 4 ? '#' + [...c.slice(1)].map(h => h + h).join('') : c; return [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); };
  const mix = (a, b, t) => { const x = hex(a), y = hex(b); return '#' + x.map((v, i) => Math.round(lerp(v, y[i], t)).toString(16).padStart(2, '0')).join(''); };
  const rgba = (c, a) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${clamp(a)})`; };
  const soft = (g, x, y, rx, ry, col, a, rot = 0) => { if (a <= 0) return; g.save(); g.translate(x, y); g.rotate(rot); g.scale(1, ry / rx); const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, 7); g.fill(); g.restore(); };
  const canvas = (w, h) => { const k = document.createElement('canvas'); k.width = w; k.height = h; return k; };
  MS.u = { clamp, lerp, eo3, eio, sio, back, rgen, hex, mix, rgba, soft, canvas };
})();
