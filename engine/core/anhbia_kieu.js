// mega-shot · thumbnail style library (1280×720). Each style = one proven click-through pattern; anh_bia.yaml picks it with `kieu:`.
// Inputs from tools/anhbia.py: c.nguon (main image), c.cat (cut-out PNG of the subject, when tach_nen), c.bbox (subject box 0–1),
// c.nen (second image used as background), c.nguon2 (second image for so-sanh), c.chu (text lines: "*" = accent box, "^" = accent colour),
// c.mau_nhan (accent colour) + per-style keys documented in references/thumbnails.md.
(() => {
  const W = 1280, H = 720, $ = s => document.querySelector(s);
  const load = src => new Promise(r => { if (!src) return r(null); const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; });
  const add = (tag, css = {}, par) => { const e = document.createElement(tag); Object.assign(e.style, { position: 'absolute' }, css); (par || $('#c')).append(e); return e; };
  const clean = () => { $('#c').innerHTML = ''; };
  // image covering a box, focus f = [fx, fy]
  const cover = (im, box = [0, 0, W, H], f = [.5, .5], css = {}, z = 1) => { if (!im) return null; const [x, y, w, h] = box, s = Math.max(w / im.naturalWidth, h / im.naturalHeight) * z, iw = im.naturalWidth * s, ih = im.naturalHeight * s;
    const wrap = add('div', { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', overflow: 'hidden' });
    const e = add('img', { left: Math.min(0, Math.max(w - iw, w / 2 - f[0] * iw)) + 'px', top: Math.min(0, Math.max(h - ih, h / 2 - f[1] * ih)) + 'px', width: iw + 'px', height: ih + 'px', maxWidth: 'none', ...css }, wrap); e.src = im.src; return wrap; };
  // cut-out subject: scale so its box height = hFrac·H, centre x at cx (px), feet at bottom (yb px)
  const subject = async (c, hFrac, cx, yb = H * 1.01, css = {}) => { const sj = await load(c.cat); if (!sj) return null; const bb = c.bbox || [.2, .05, .8, 1], iw = sj.naturalWidth, ih = sj.naturalHeight;
    const k = hFrac * H / ((bb[3] - bb[1]) * ih), e = add('img', { width: iw * k + 'px', height: ih * k + 'px', left: cx - (bb[0] + bb[2]) / 2 * iw * k + 'px', top: yb - bb[3] * ih * k + 'px', maxWidth: 'none', ...css }); e.src = sj.src; return e; };
  // text line auto-fitted to width (px); returns element
  const line = (t, { font = '900 100px BVP', color = '#fff', maxW = 600, maxFs = 160, stroke = 0, strokeC = '#000', shadow = '', upper = true, spacing = '-.01em', par, css = {} } = {}) => {
    const hl = t.startsWith('*'), ac = t.startsWith('^'); const d = add('div', { position: 'relative', font, color, whiteSpace: 'nowrap', lineHeight: 1.04, letterSpacing: spacing, textTransform: upper ? 'uppercase' : 'none', ...css }, par);
    d.textContent = hl || ac ? t.slice(1) : t; d._hl = hl; d._ac = ac; d._fit = () => { const w = d.getBoundingClientRect().width, fs = parseFloat(getComputedStyle(d).fontSize); d.style.fontSize = Math.min(maxFs, fs * maxW / w) + 'px';
      const f = parseFloat(d.style.fontSize); if (stroke) { d.style.paintOrder = 'stroke fill'; d.style.webkitTextStroke = `${f * stroke}px ${strokeC}`; } if (shadow) d.style.textShadow = shadow.replace(/F/g, f); }; return d; };
  const col = (css) => add('div', { display: 'flex', flexDirection: 'column', ...css });
  const fits = async els => { await document.fonts.ready; els.forEach(e => e._fit()); };
  const accent = (els, acc, ink = '#111') => els.forEach(d => { if (d._hl) Object.assign(d.style, { background: acc, color: ink, padding: '.04em .22em', borderRadius: '.08em', webkitTextStroke: '0', textShadow: 'none', alignSelf: 'flex-start', transform: 'rotate(-2deg)' }); else if (d._ac) d.style.color = acc; });
  const grain = (a = .08) => { const k = document.createElement('canvas'); k.width = 320; k.height = 180; const g = k.getContext('2d'), d = g.createImageData(320, 180); for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255 * a; } g.putImageData(d, 0, 0);
    const e = add('img', { inset: 0, width: W + 'px', height: H + 'px', mixBlendMode: 'overlay', imageRendering: 'pixelated' }); e.src = k.toDataURL(); };

  const K = {};
  // 1 · SỐ LỚN — one giant number does the talking (curiosity + specificity). Keys: so ("39 KM"), chu (1–2 small lines), x_chu_the
  K['big-number'] = async c => { clean(); const acc = c.mau_nhan || '#ffd400', bg = await load(c.nen || c.nguon);
    cover(bg, [0, 0, W, H], c.tam_nen || [.5, .5], { filter: `blur(${c.mo_nen ?? 2}px) brightness(${c.sang_nen ?? .45}) saturate(1.2)` });
    add('div', { inset: 0, background: 'linear-gradient(90deg,rgba(0,0,0,.85),rgba(0,0,0,.35) 55%,rgba(0,0,0,0))' });
    if (c.cat) { add('div', { inset: 0, background: `radial-gradient(circle 360px at ${W * (c.x_chu_the ?? .76)}px ${H * .55}px, ${acc}55, transparent 70%)`, mixBlendMode: 'screen' });
      await subject(c, c.cao ?? .95, W * (c.x_chu_the ?? .76), H * 1.01, { filter: `drop-shadow(0 0 3px #fff) drop-shadow(0 0 24px ${acc}) drop-shadow(0 20px 30px rgba(0,0,0,.7))` }); }
    const T = col({ left: '56px', top: '50%', transform: 'translateY(-50%)', alignItems: 'flex-start', gap: '6px' });
    const big = line(c.so || (c.chu || [])[0] || '', { font: '700 200px OSW', color: acc, maxW: W * .55, maxFs: 330, stroke: .02, strokeC: '#000', shadow: '0 calc(F*.05px) 0 #000, 0 0 calc(F*.25px) rgba(0,0,0,.8)', par: T, spacing: '0' });
    const rest = (c.so ? c.chu || [] : (c.chu || []).slice(1)).map(t => line(t, { font: '900 60px BVP', maxW: W * .5, maxFs: 76, stroke: .08, par: T }));
    await fits([big, ...rest]); big.style.textShadow = `0 ${parseFloat(big.style.fontSize) * .05}px 0 #000, 0 0 40px rgba(0,0,0,.8)`; accent(rest, acc);
    add('div', { left: '60px', top: (T.getBoundingClientRect().top - 18) + 'px', width: '120px', height: '10px', background: acc, borderRadius: '5px' }); };

  // 2 · COMPARE — split screen THEN vs NOW / A vs B (contrast = instant story). Keys: nguon (left), nguon2 (right), nhan1, nhan2, chu (bottom), vs ("VS" | "→")
  K['versus'] = async c => { clean(); const acc = c.mau_nhan || '#ffd400', a = await load(c.nguon), b = await load(c.nguon2 || c.nen);
    const L = add('div', { inset: 0, clipPath: 'polygon(0 0, 54% 0, 46% 100%, 0 100%)' }); const R = add('div', { inset: 0, clipPath: 'polygon(54% 0, 100% 0, 100% 100%, 46% 100%)' });
    const wa = cover(a, [0, 0, W * .56, H], c.tam1 || [.5, .5], { filter: `sepia(${c.cu === false ? 0 : .55}) contrast(1.1) brightness(.85)` }); L.append(wa);
    const wb = cover(b, [W * .44, 0, W * .56, H], c.tam2 || [.5, .5], { filter: 'saturate(1.25) contrast(1.08)' }); R.append(wb);
    add('div', { left: W * .5 - 9 + 'px', top: '-40px', width: '18px', height: H + 80 + 'px', background: acc, transform: 'rotate(6.3deg)', boxShadow: '0 0 30px rgba(0,0,0,.6)' });
    add('div', { inset: 0, background: 'linear-gradient(0deg,rgba(0,0,0,.8),rgba(0,0,0,0) 40%), linear-gradient(180deg,rgba(0,0,0,.55),rgba(0,0,0,0) 22%)' });
    const tag = (t, x, al) => { if (!t) return; const d = add('div', { top: '34px', [al]: x + 'px', font: '700 64px OSW', color: '#fff', background: 'rgba(0,0,0,.55)', padding: '2px 22px', borderRadius: '10px', letterSpacing: '.02em', border: `3px solid ${acc}` }); d.textContent = t; };
    tag(c.nhan1, 40, 'left'); tag(c.nhan2, 40, 'right');
    const vs = add('div', { left: W / 2 - 62 + 'px', top: H * .42 - 62 + 'px', width: '124px', height: '124px', borderRadius: '50%', background: acc, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 58px OSW', color: '#111', boxShadow: '0 10px 30px rgba(0,0,0,.6)' }); vs.textContent = c.vs || 'VS';
    const T = col({ left: '50%', bottom: '40px', transform: 'translateX(-50%)', alignItems: 'center' }); const ls = (c.chu || []).map(t => line(t, { maxW: W * .86, maxFs: 96, stroke: .08, shadow: '0 0 calc(F*.3px) rgba(0,0,0,.8)', par: T }));
    await fits(ls); accent(ls, acc); };

  // 3 · RED CIRCLE — red circle + arrow on the detail that matters ("look HERE"). Keys: diem [x, y, r] (0–1, r as share of height), chu (top-left box)
  K['red-circle'] = async c => { clean(); const red = c.mau_khoanh || '#ff2a2a', bg = await load(c.nguon); cover(bg, [0, 0, W, H], c.tam_nen || [.5, .5], { filter: `saturate(1.2) contrast(1.1) brightness(${c.sang_nen ?? .9})` });
    add('div', { inset: 0, background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,.55))' });
    const [dx, dy, dr] = c.diem || [.68, .5, .18], X = dx * W, Y = dy * H, R = dr * H;
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'); svg.setAttribute('width', W); svg.setAttribute('height', H); Object.assign(svg.style, { position: 'absolute', left: 0, top: 0 });
    const p = document.createElementNS(ns, 'path'), pts = []; for (let k = 0; k <= 42; k++) { const a = k / 40 * Math.PI * 2 + .3, rr = R * (1 + .06 * Math.sin(k * 1.7)); pts.push(`${X + Math.cos(a) * rr * 1.12},${Y + Math.sin(a) * rr}`); }
    p.setAttribute('d', 'M' + pts.join(' L')); Object.assign(p.style, { fill: 'none', stroke: red, strokeWidth: 12, strokeLinecap: 'round', strokeLinejoin: 'round', filter: 'drop-shadow(0 0 4px #000)' }); svg.append(p);
    const ax = Math.max(80, X - R * 1.12 - 260), ay = Math.min(H - 90, Y + R + 120), bx = X - R * .9, by = Y + R * .55;
    const ar = document.createElementNS(ns, 'path'); ar.setAttribute('d', `M${ax},${ay} Q${(ax + bx) / 2 - 20},${(ay + by) / 2 + 60} ${bx},${by}`); Object.assign(ar.style, { fill: 'none', stroke: red, strokeWidth: 12, strokeLinecap: 'round', filter: 'drop-shadow(0 0 4px #000)' }); svg.append(ar);
    const ang = Math.atan2(by - ((ay + by) / 2 + 30), bx - ((ax + bx) / 2 - 10)), hd = document.createElementNS(ns, 'path');
    hd.setAttribute('d', `M${bx},${by} L${bx - 42 * Math.cos(ang - .5)},${by - 42 * Math.sin(ang - .5)} L${bx - 42 * Math.cos(ang + .5)},${by - 42 * Math.sin(ang + .5)} Z`); hd.style.fill = red; svg.append(hd); $('#c').append(svg);
    const T = col({ left: '40px', top: '40px', alignItems: 'flex-start', gap: '8px' }); const ls = (c.chu || []).map((t, i) => line(t, { maxW: W * .5, maxFs: i ? 70 : 110, stroke: .08, shadow: '0 calc(F*.06px) 0 #000', par: T }));
    await fits(ls); accent(ls, c.mau_chu_nhan || '#ffd400'); };

  // 4 · NEWS — breaking-news / old newspaper front page (authority + urgency). Keys: nhan ("BREAKING" banner), chu (headline), ngay (date line)
  K['breaking-news'] = async c => { clean(); const red = c.mau_bao || '#d81e1e', bg = await load(c.nen || c.nguon);
    cover(bg, [0, 0, W, H], c.tam_nen || [.5, .4], { filter: `grayscale(1) contrast(1.25) brightness(${c.sang_nen ?? .75})` });
    add('div', { inset: 0, background: 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0 1.2px, transparent 1.6px) 0 0/6px 6px, linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(0,0,0,.6))', mixBlendMode: 'multiply' });
    if (c.cat) await subject(c, c.cao ?? .92, W * (c.x_chu_the ?? .75), H * 1.01, { filter: 'grayscale(.2) contrast(1.15) drop-shadow(0 0 2px #fff) drop-shadow(0 18px 28px rgba(0,0,0,.7))' });
    const ban = add('div', { left: 0, top: '36px', padding: '6px 34px 6px 40px', background: red, font: '700 52px OSW', color: '#fff', letterSpacing: '.06em', boxShadow: '0 8px 20px rgba(0,0,0,.5)' }); ban.textContent = c.nhan || 'BREAKING';
    const paper = add('div', { left: '40px', bottom: '46px', width: W * (c.cat ? .58 : .8) + 'px', padding: '18px 26px 14px', background: '#f3ecdc', boxShadow: '0 16px 40px rgba(0,0,0,.65)', transform: 'rotate(-2deg)' });
    const head = col({ position: 'relative', gap: '2px' }); paper.append(head);
    const ls = (c.chu || []).map(t => line(t, { font: '900 100px Georgia, "Times New Roman", serif', color: '#111', maxW: W * (c.cat ? .58 : .8) - 60, maxFs: 104, par: head, spacing: '-.02em' }));
    const dl = add('div', { position: 'relative', marginTop: '6px', borderTop: '3px double #111', paddingTop: '4px', font: '700 22px Georgia, serif', color: '#333', letterSpacing: '.08em', textTransform: 'uppercase' }, paper); dl.textContent = c.ngay || '';
    await fits(ls); accent(ls, red, '#fff'); };

  // 5 · MYSTERY — dark, cold, a spotlight and a giant "?" (open loop → curiosity). Keys: chu ("^" word in red), dau ("?")
  K['mystery'] = async c => { clean(); const red = c.mau_bi_an || '#ff3b30', bg = await load(c.nen || c.nguon);
    cover(bg, [0, 0, W, H], c.tam_nen || [.5, .5], { filter: `grayscale(.7) brightness(${c.sang_nen ?? .5}) contrast(1.2) hue-rotate(180deg) saturate(.6)` });
    add('div', { inset: 0, background: `radial-gradient(circle 380px at ${W * (c.x_chu_the ?? .7)}px ${H * .48}px, rgba(120,170,255,.22), rgba(0,0,0,.0) 60%), radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 30%, rgba(0,0,0,.85))` });
    const q = add('div', { right: c.cat ? '30px' : '120px', top: '-40px', font: '700 640px OSW', color: 'rgba(255,255,255,.07)', lineHeight: 1 }); q.textContent = c.dau || '?';
    if (c.cat) await subject(c, c.cao ?? .9, W * (c.x_chu_the ?? .72), H * 1.01, { filter: 'grayscale(.4) contrast(1.2) brightness(.95) drop-shadow(0 0 2px #9cc4ff) drop-shadow(0 0 30px rgba(110,160,255,.6))' });
    const T = col({ left: '56px', top: '50%', transform: 'translateY(-50%)', alignItems: 'flex-start', gap: '4px' });
    const ls = (c.chu || []).map(t => line(t, { font: '700 100px OSW', maxW: W * .5, maxFs: 150, shadow: '0 0 calc(F*.35px) rgba(0,0,0,.9)', par: T, spacing: '.01em' }));
    await fits(ls); accent(ls, red); ls.filter(d => d._ac).forEach(d => d.style.textShadow = `0 0 30px ${red}aa, 0 0 60px rgba(0,0,0,.9)`); };

  // 6 · TỐI GIẢN — flat colour field, one cut-out, 2–3 bold words (clean, premium, readable at phone size). Keys: mau_nen ("#0e3b5c"), chu
  K['minimal'] = async c => { clean(); const acc = c.mau_nhan || '#ffd400', bgc = c.mau_nen || '#12355b';
    add('div', { inset: 0, background: `radial-gradient(circle at 72% 45%, ${bgc}, #050b14 120%)` });
    add('div', { right: '-80px', top: '80px', width: '620px', height: '620px', borderRadius: '50%', background: acc, opacity: .9 });
    if (c.cat) await subject(c, c.cao ?? .96, W * (c.x_chu_the ?? .74), H * 1.01, { filter: 'drop-shadow(0 24px 30px rgba(0,0,0,.45))' });
    else { const im = await load(c.nguon); const w = cover(im, [W * .52, 90, 560, 540], [.5, .5]); w.style.borderRadius = '28px'; w.style.boxShadow = '0 30px 60px rgba(0,0,0,.5)'; }
    const T = col({ left: '64px', top: '50%', transform: 'translateY(-50%)', alignItems: 'flex-start', gap: '2px' });
    const ls = (c.chu || []).map(t => line(t, { font: '900 100px BVP', maxW: W * .44, maxFs: 150, par: T }));
    await fits(ls); accent(ls, acc); add('div', { left: '68px', top: (T.getBoundingClientRect().bottom + 16) + 'px', width: '140px', height: '12px', borderRadius: '6px', background: acc }); };

  // 7 · GIẤY CỔ — parchment, ink serif title, sepia image, wax seal with a year (history/heritage feel). Keys: chu, nam ("1515")
  K['parchment'] = async c => { clean(); const im = await load(c.nguon);
    add('div', { inset: 0, background: 'radial-gradient(ellipse at 50% 45%, #f1e2bd 0%, #dcc48f 55%, #8a6a3b 120%)' });
    add('div', { inset: 0, background: 'repeating-linear-gradient(8deg, rgba(120,80,30,.05) 0 2px, transparent 2px 9px)', mixBlendMode: 'multiply' }); grain(.1);
    if (c.cat) await subject(c, c.cao ?? .95, W * (c.x_chu_the ?? .74), H * 1.01, { filter: 'sepia(.65) contrast(1.15) drop-shadow(0 0 1px #3b2a12) drop-shadow(10px 16px 18px rgba(60,35,10,.45))' });
    else { const w = cover(im, [W * .5, 70, 580, 560], c.tam_nen || [.5, .5], { filter: 'sepia(.7) contrast(1.15)' }); Object.assign(w.style, { transform: 'rotate(2.5deg)', boxShadow: '0 18px 40px rgba(60,35,10,.55)', border: '14px solid #f6ead0' }); }
    const T = col({ left: '64px', top: '50%', transform: 'translateY(-52%)', alignItems: 'flex-start', gap: '4px' });
    const ls = (c.chu || []).map((t, i) => line(t, { font: `900 100px Georgia, "Times New Roman", serif`, color: '#2b1a08', maxW: W * .5, maxFs: i ? 84 : 128, upper: true, par: T, spacing: '0' }));
    await fits(ls); accent(ls, c.mau_muc || '#8b1a10', '#f6ead0');
    if (c.nam) { const s = add('div', { left: '70px', bottom: '46px', width: '150px', height: '150px', borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #c8322a, #7a0f0b 70%)', boxShadow: '0 8px 18px rgba(0,0,0,.45), inset 0 0 0 10px rgba(0,0,0,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 44px Georgia, serif', color: '#f3d9b0', transform: 'rotate(-12deg)' }); s.textContent = c.nam; } };

  // 8 · CINEMATIC — letterbox, teal-orange grade, grain, thin wide-spaced title (prestige documentary). Keys: chu (title, subtitle)
  K['cinematic'] = async c => { clean(); const bg = await load(c.nen || c.nguon); cover(bg, [0, 0, W, H], c.tam_nen || [.5, .5], { filter: `contrast(1.15) saturate(1.25) brightness(${c.sang_nen ?? .8})` });
    add('div', { inset: 0, background: 'linear-gradient(180deg, rgba(0,70,90,.35), rgba(255,120,30,.18))', mixBlendMode: 'soft-light' });
    if (c.cat) await subject(c, c.cao ?? .86, W * (c.x_chu_the ?? .5), H * .88, { filter: 'contrast(1.1) drop-shadow(0 20px 30px rgba(0,0,0,.6))' });
    add('div', { inset: 0, background: 'radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0) 40%, rgba(0,0,0,.7))' }); grain(.07);
    add('div', { left: 0, top: 0, width: W + 'px', height: '78px', background: '#000' }); add('div', { left: 0, bottom: 0, width: W + 'px', height: '78px', background: '#000' });
    const T = col({ left: '50%', bottom: '104px', transform: 'translateX(-50%)', alignItems: 'center', gap: '8px' });
    const [t1, ...r] = c.chu || []; const a = line(t1 || '', { font: '600 100px OSW', maxW: W * .84, maxFs: 120, spacing: '.18em', shadow: '0 0 calc(F*.3px) rgba(0,0,0,.85)', par: T });
    const ls = r.map(t => line(t, { font: '400 40px OSW', color: '#e8dccb', maxW: W * .7, maxFs: 44, spacing: '.4em', par: T })); await fits([a, ...ls]); accent([a, ...ls], c.mau_nhan || '#ffb347'); };

  // 9 · 3-TIER GOLD TITLE — AI painting full frame + "The ENTIRE / History / of …" gold block (poster engine with presets)
  K['gold-title'] = async c => { Object.assign(c, { kieu: 'poster', tong: c.tong || 'black-gold', ti_le_chu: c.ti_le_chu || [.6, 1, .36, .36], rong_chu: c.rong_chu || .44, vi_tri_chu: c.vi_tri_chu || [.74, .06], sang_nen: c.sang_nen ?? 1 }); if (!c.giu_chu_the) c.cat = null; await window.poster(c); };

  // English style ids; the old Vietnamese ids stay as aliases so existing anh_bia.yaml files keep working
  window.KIEU_ALIAS = { 'co-dien': 'classic', 'tieu-de': 'gold-title', 'so-lon': 'big-number', 'so-sanh': 'versus', 'khoanh-do': 'red-circle', 'bao-chi': 'breaking-news', 'bi-an': 'mystery', 'toi-gian': 'minimal', 'giay-co': 'parchment', 'dien-anh': 'cinematic' };
  window.KIEU = K;
})();
