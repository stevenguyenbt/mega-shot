// mega-shot · image layers from an image sequence (Blender, AI, live footage…): MS.seq('build/layers/<id>') returns a draw(x, c) function.
// Frame = floor(lt * fps); when an image is missing (e.g. a scene extended during a transition) the nearest existing image is held.
(() => {
  const MS = window.MS;
  MS.seq = (dir, { fps = 30, ext = 'png', fit = 'cover' } = {}) => {
    const cache = new Map(); let last = null;
    const load = src => { if (cache.has(src)) return cache.get(src);
      const p = new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); cache.set(src, p);
      if (cache.size > 12) cache.delete(cache.keys().next().value); return p; };
    return async (x, c) => {
      const n = Math.max(0, Math.floor(c.lt * fps + 1e-6)); let im = await load(`${dir}/${String(n).padStart(5, '0')}.${ext}`);
      if (!im) im = last; if (!im) { x.fillStyle = '#000'; x.fillRect(0, 0, c.W, c.H); return; } last = im;
      x.imageSmoothingQuality = 'high';                                             // frame more than 1.2× larger → smooth downscale/zoom, keeping detail
      if (fit === 'cover') { const s = Math.max(c.W / im.width, c.H / im.height); x.drawImage(im, (c.W - im.width * s) / 2, (c.H - im.height * s) / 2, im.width * s, im.height * s); }
      else x.drawImage(im, 0, 0, c.W, c.H);
    };
  };
})();
