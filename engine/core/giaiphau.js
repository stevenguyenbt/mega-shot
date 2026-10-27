// mega-shot · giaiphau.js — ANATOMY core of the character studio: description → balanced proportions → joint landmarks → rig, plus an
// automatic QA pass (joint coverage in test poses, auto-fix) and region maps (face / head / upper body / full body) for camera framing.
//
//   MS.giaiphau.doc(text)          "cậu bé 8 tuổi, mập, tóc xù nâu, áo khoác xanh ngọc, quần short nâu, kính cam" → studio spec   (Vietnamese description text; the keyword parser is Vietnamese-only)
//   MS.giaiphau.giai(spec)         → A: every length / width in drawing px, derived from one head height and an age / sex / build canon,
//                                     user ratios clamped and rebalanced; the SAME numbers drive drawing and rig (joints match by construction)
//   MS.giaiphau.kiemDinh(ve)       → { ok, loi: [{tu_the, khop, phu}], sua } after rendering test poses; rebuilds with more joint overlap if needed
//   MS.nv.vungAt(actor, t)         → { mat, dau, than_tren, toan_than } boxes in set coordinates (used by truyen.js framing)
(() => {
  const MS = window.MS, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // ---------- canon (head units: H = head height incl. hair; widths are HALF widths) ----------
  const CANON = {
    'tre-em':    { H: 300, tong: 4.5, co: .12, than: 1.0, tay: [.56, .5, .34], vai: .5, eo: .43, hong: .45, khop_hong: .2, chan_tl: [.5, .42],
                   d: { tay_tren: .25, khuyu: .2, co_tay: .16, dui: .36, goi: .27, co_chan: .2 }, ban_chan: .55 },
    'thieu-nien':{ H: 280, tong: 6.0, co: .16, than: 1.5, tay: [.8, .72, .42], vai: .62, eo: .46, hong: .5, khop_hong: .24, chan_tl: [.51, .43],
                   d: { tay_tren: .23, khuyu: .18, co_tay: .14, dui: .37, goi: .26, co_chan: .18 }, ban_chan: .6 },
    'nguoi-lon': { H: 262, tong: 6.8, co: .18, than: 1.8, tay: [.98, .88, .5], vai: .78, eo: .54, hong: .6, khop_hong: .28, chan_tl: [.52, .43],
                   d: { tay_tren: .26, khuyu: .2, co_tay: .15, dui: .43, goi: .3, co_chan: .2 }, ban_chan: .7 },
    gia:         { H: 256, tong: 6.3, co: .2, than: 1.75, tay: [.92, .84, .48], vai: .7, eo: .56, hong: .6, khop_hong: .26, chan_tl: [.51, .43],
                   d: { tay_tren: .29, khuyu: .22, co_tay: .17, dui: .42, goi: .3, co_chan: .2 }, ban_chan: .66 },
  };
  const NU = { vai: .86, hong: 1.08, eo: .86 }, BUILD = { gay: { w: .86, eo: .9 }, vua: { w: 1, eo: 1 }, map: { w: 1.14, eo: 1.3 }, 'the-thao': { w: 1.06, eo: .92, vai: 1.14 },
    om: { w: .78, eo: .86, vai: .94 }, beo: { w: 1.3, eo: 1.62, vai: 1.06 }, 'cao-gay': { w: .84, eo: .9, cao: 1.08 }, 'thap-dam': { w: 1.14, eo: 1.14, vai: 1.08, cao: .88 } };
  const CAO = { thap: .9, vua: 1, cao: 1.08 };                                                   // height: legs absorb the change
  // ---------- BODY SHAPES (hinh_the): one vector of region masses, mixable (preset + xuong.khoi overrides) ----------
  //   w all widths · cao height · chan / tay / than lengths · vai shoulders · nguc chest · eo waist · bung belly size (1 = flat) · bung_thap belly
  //   sits low (0..1) · hong hips · dui thighs · bap_chan calves · bap_tay arm mass · co neck · gu hunch (rad) · tuoi / gioi · tu_the posture hints
  const HINH_THE = {
    vua: {}, gay: { w: .86, eo: .92 }, om: { w: .78, eo: .86, vai: .94, co: .85 },
    'mum-mim': { w: 1.12, bung: 1.45, bung_thap: .55, nguc: 1.08, hong: 1.1, dui: 1.3, bap_tay: 1.25, co: 1.25, chan: .9, than: 1.04 },                // chubby guy
    'cao-kheu': { w: .82, cao: 1.1, chan: 1.08, tay: 1.1, than: 1.05, co: .85 },                                                        // lanky guy
    'be-trai': { tuoi: 'tre-em' }, 'be-gai': { tuoi: 'tre-em', gioi: 'nu' }, 'thieu-nien': { tuoi: 'thieu-nien', w: .9 },
    'ong-gia-gay': { tuoi: 'gia', w: .84, gu: .2, cao: 1.04, co: .85 },                                                                 // lanky old man (cane)
    'luc-si': { vai: 1.32, nguc: 1.38, eo: 1.1, bung: 1.12, bap_tay: 1.5, dui: 1.25, bap_chan: 1.2, co: 1.45, chan: .92, the_thao: 1 },  // burly bruiser
    'rat-beo': { w: 1.22, bung: 1.75, bung_thap: .6, nguc: 1.12, hong: 1.2, dui: 1.5, bap_tay: 1.4, co: 1.45, chan: .84, tay: .95, than: 1.08 },   // very heavy-set
    'vai-rong': { vai: 1.25, nguc: 1.12, eo: .86, hong: .9, bap_tay: 1.12, the_thao: 1 },                                              // slim, broad-shouldered
    'nu-chien-binh': { gioi: 'nu', cao: 1.08, vai: 1.16, nguc: 1.08, bap_tay: 1.3, dui: 1.2, bap_chan: 1.15, the_thao: 1 },            // amazon warrior
    'thap-dam': { cao: .86, w: 1.15, bung: 1.38, bung_thap: .4, vai: 1.12, dui: 1.35, bap_tay: 1.3, co: 1.35, chan: .8 },              // short and stout
    'ba-lao-cong': { tuoi: 'gia', gioi: 'nu', gu: .5, cao: .94, bung: 1.1 },                                                           // bent-backed crone
    'dong-ho-cat': { gioi: 'nu', nguc: 1.1, eo: .82, hong: 1.18, dui: 1.12 }, 'qua-le': { gioi: 'nu', vai: .9, hong: 1.35, dui: 1.4, eo: .95 },
    'qua-tao': { gioi: 'nu', w: 1.1, bung: 1.45, nguc: 1.15, hong: 1.05 }, 'nu-mum-mim': { gioi: 'nu', w: 1.15, bung: 1.35, hong: 1.28, dui: 1.45, bap_tay: 1.3, co: 1.2, chan: .9 },
  };
  const OLD_BUILD = { map: 'mum-mim', beo: 'rat-beo', 'cao-gay': 'cao-kheu', 'the-thao': 'vai-rong', 'thap-dam': 'thap-dam', gay: 'gay', om: 'om' };
  const khoiOf = sp => ({ ...(HINH_THE[sp.hinh_the] || HINH_THE[OLD_BUILD[sp.than_hinh]] || {}), ...(sp.khoi || {}) });
  const STYLE_HEAD = { anime: 1, 'anime-manga': 1, 'anime-mem': 1, 'anime-chibi': 1.55, 'anime-thanh-nien': 1.1, phang: 1.05, chibi: 1.45 };   // bigger head → fewer heads tall
  function giai(sp) {
    const Kh = khoiOf(sp), kv = (k, d = 1) => Kh[k] ?? d;
    const C = CANON[Kh.tuoi || sp.tuoi || sp.vai_tuoi] || CANON[{ chau: 'tre-em', ba: 'gia' }[sp.vai] || 'tre-em'], nu = (Kh.gioi || sp.gioi) === 'nu' || sp.vai === 'ba';
    const B = { w: kv('w'), eo: kv('eo'), vai: kv('vai'), cao: kv('cao') };
    const r = sp.ti_le || {}, R = k => clamp(r[k] ?? 1, .75, 1.35), notes = [];
    for (const k of Object.keys(r)) if (r[k] !== R(k)) notes.push(`ti_le.${k}=${r[k]} outside plausible range → ${R(k)}`);
    const H = C.H * (STYLE_HEAD[sp.phong_cach] || 1) * R('dau') ** .5, h = H;                    // px of one head
    const shd = STYLE_HEAD[sp.phong_cach] || 1, chib = shd > 1.3;                                // chibi: big head AND compact body (shorter torso / limbs, narrower)
    const tong = C.tong / shd ** (chib ? 1.12 : .55) * (B.cao || 1) * (CAO[sp.chieu_cao] || 1);
    const fat0 = Math.max(0, kv('bung', 1) - 1), than = C.than * R('than') * kv('than') * (chib ? .62 : 1), co = C.co * (chib ? .5 : 1) * (1 - Math.min(.45, fat0 * .5));   // heavy: shorter neck
    let chan = (tong - 1 - co - than) * R('chan') * kv('chan');                                               // legs absorb the rest → total stays balanced
    if (chan < (chib ? .7 : 1.2)) { notes.push('legs too short relative to torso → rebalanced'); chan = chib ? .7 : 1.2; }
    const sx = (nu ? NU.vai : 1) * B.w * (B.vai || 1) * R('vai') * (chib ? .72 : 1), hx = (nu ? NU.hong : 1) * B.w * (chib ? .72 : 1), ex = (nu ? NU.eo : 1) * B.eo * B.w * (chib ? .72 : 1);
    const bung = kv('bung', B.eo > 1.05 ? B.eo : 1), mass = { tay_tren: kv('bap_tay'), khuyu: kv('bap_tay') ** .6, co_tay: 1, dui: kv('dui'), goi: kv('dui') ** .55, co_chan: kv('bap_chan') ** .3 };
    const A = { H: h, hs: h / 300, nu, tuoi: Kh.tuoi || sp.tuoi, notes, w: B.w, bung, the_thao: !!Kh.the_thao || sp.than_hinh === 'the-thao', gu: kv('gu', 0), bap_chan: kv('bap_chan'), khoi: Kh,
      co: co * h, than: than * h,
      vai: C.vai * sx * h, eo: C.eo * ex * h, hong: C.hong * hx * h, khop_vai: C.vai * sx * h * .8, khop_hong: C.khop_hong * hx * h,
      tay_tren: C.tay[0] * R('tay') * kv('tay') * h * (chib ? .62 : 1), tay_duoi: C.tay[1] * R('tay') * kv('tay') * h * (chib ? .62 : 1), ban_tay: C.tay[2] * h * (chib ? .7 : 1),
      dui: chan * C.chan_tl[0] * h, cang: chan * C.chan_tl[1] * h, mat_ca: chan * (1 - C.chan_tl[0] - C.chan_tl[1]) * h, ban_chan: C.ban_chan * h,
      d: Object.fromEntries(Object.entries(C.d).map(([k, v]) => [k, v * h * (chib ? .7 : 1) * (k.startsWith('tay') || k === 'khuyu' || k === 'co_tay' ? B.w ** .6 : B.w ** .8) * (mass[k] || 1)])) };
    // torso masses (half widths, drawing px) — the outfit is drawn on the hull of these: neck, chest, belly, pelvis
    A.co_r = A.H * .11 * B.w ** 1.1 * kv('co'); A.nguc = A.vai * .86 * kv('nguc'); A.mong = A.hong * kv('hong');
    A.bung_r = A.eo * Math.max(1, bung * .92); A.bung_y = .5 + kv('bung_thap', .4) * .3;
    if (A.d.dui * .5 > A.khop_hong * .95) A.khop_hong = A.d.dui * .5 / .95;
    A.khop_hong = Math.max(A.khop_hong, A.mong * .9 - A.d.dui * .5);
    if (A.bung > 1.15) { A.d.dui = Math.max(A.d.dui, A.mong * .96); A.d.goi = Math.max(A.d.goi, A.d.dui * .64); A.khop_hong = Math.min(A.khop_hong, A.d.dui * .47); }   // heavy: thick thighs that touch (no thigh gap) and form the hips                           // wide hips: hip joints sit apart so the outer thigh meets the hip line                    // thick thighs: hip joints move apart (wider stance)
    A.chong = .55;                                                                                // joint overlap = 0.55 × joint width (raised by kiemDinh when needed)
    A.tong = h * tong;
    return A;
  }
  // ---------- description parser (Vietnamese) ----------
  const MAU = { 'đen': '#2a2426', 'trắng': '#f4f4f0', 'đỏ': '#d8403a', 'xanh dương': '#3a6ab8', 'xanh biển': '#3a6ab8', 'xanh lá': '#4a9a4a', 'xanh ngọc': '#7fc8c0', 'xanh lam': '#4a7ac8',
    'xanh': '#4a8ac0', 'vàng': '#f0c040', 'cam': '#f08a2a', 'tím': '#8a6aa6', 'hồng': '#f08aa8', 'nâu': '#6a4a36', 'xám': '#8a8a8e', 'bạc': '#d8d2cc', 'be': '#e8d8b8', 'kem': '#f2e8d0', 'đỏ đô': '#8a2a32' };
  const colorAfter = (t, word) => { const m = t.match(new RegExp(word + '[^,.;]*?(đỏ đô|xanh dương|xanh biển|xanh lá|xanh ngọc|xanh lam|xanh|đen|trắng|đỏ|vàng|cam|tím|hồng|nâu|xám|bạc|be|kem)')); return m ? MAU[m[1]] : null; };
  function doc(text) {
    const t = ' ' + String(text || '').toLowerCase() + ' ', has = re => re.test(t), sp = {};
    sp.tuoi = has(/\b(bà|ông|cụ|già)\b/) ? 'gia' : has(/(thiếu niên|học sinh cấp|cậu thiếu|cô thiếu)/) ? 'thieu-nien' : has(/(cậu bé|cô bé|em bé|bé |đứa trẻ|cháu|tuổi)/) && !has(/(\d{2,} tuổi)/) ? 'tre-em' : 'nguoi-lon';
    const age = t.match(/(\d+)\s*tuổi/); if (age) { const n = +age[1]; sp.tuoi = n < 11 ? 'tre-em' : n < 18 ? 'thieu-nien' : n < 60 ? 'nguoi-lon' : 'gia'; }
    sp.gioi = has(/\b(bà|cô|chị|gái|nữ|mẹ|cô bé|bé gái|em gái)\b/) ? 'nu' : 'nam';
    sp.than_hinh = has(/(mập|béo|mũm mĩm|tròn trịa)/) ? 'map' : has(/(vạm vỡ|cơ bắp|thể thao|lực lưỡng)/) ? 'the-thao' : has(/(rất béo|bụng bự|béo phì)/) ? 'beo' : has(/(thấp đậm|lùn mập|chắc nịch)/) ? 'thap-dam' : has(/(cao gầy|cao kều|lêu nghêu)/) ? 'cao-gay' : has(/(ốm nhom|gầy gò|còm)/) ? 'om' : has(/(gầy|ốm|mảnh khảnh)/) ? 'gay' : 'vua';
    sp.toc = { kieu: has(/tóc[^,]*búi/) ? 'bui' : has(/tóc[^,]*(rối|bờm|lởm chởm|nhọn|dựng)/) ? 'bom' : has(/tóc[^,]*(dài|ngang vai)/) ? 'dai' : has(/tóc[^,]*(ngắn gọn|húi|cắt ngắn)/) ? 'ngan' : sp.tuoi === 'gia' && sp.gioi === 'nu' ? 'bui' : sp.gioi === 'nu' ? 'dai' : 'tre',
      mau: colorAfter(t, 'tóc') || (sp.tuoi === 'gia' ? MAU['bạc'] : '#3b2a26') };
    sp.ao = { kieu: has(/áo bà ba/) ? 'ba-ba' : has(/sơ mi/) ? 'so-mi' : has(/hoodie|áo nỉ có mũ/) ? 'hoodie' : has(/blazer|áo vest|đồng phục/) ? 'blazer' : has(/áo khoác/) ? 'khoac-mo' : 'thun', mau: colorAfter(t, 'áo (?:khoác|bà ba|thun|phông|sơ mi)?') || (sp.tuoi === 'gia' ? '#8a6aa6' : '#7fc8c0'), mau_trong: '#fbfbf8' };
    sp.quan = { kieu: has(/(quần short|quần đùi|quần ngắn)/) ? 'short' : 'dai', mau: colorAfter(t, 'quần') || '#4a3c36' };
    sp.giay = { kieu: has(/(dép|guốc)/) || sp.tuoi === 'gia' ? 'dep' : 'the-thao', mau: colorAfter(t, '(?:giày|dép)') || (sp.tuoi === 'gia' ? '#7a5232' : '#f6f6f2') };
    if (has(/kính/)) sp.kinh = { mau: colorAfter(t, 'kính') || '#f0902a' };
    if (has(/dây chuyền/)) sp.day_chuyen = '#e8b83c';
    sp.chieu_cao = has(/(\bthấp\b|\blùn\b)/) ? 'thap' : has(/\bcao\b/) ? 'cao' : 'vua';
    if (has(/(chân váy|váy)/)) sp.quan = { ...sp.quan, kieu: 'vay' };
    if (has(/cà vạt/)) sp.ca_vat = colorAfter(t, 'cà vạt') || '#1e1c22';
    sp.mat = { mau: colorAfter(t, 'mắt') || '#6a3f26' };
    sp.da = has(/da ngăm/) ? '#d8a882' : has(/da trắng/) ? '#fde8da' : sp.tuoi === 'gia' ? '#f2d2bc' : '#fde4d2';
    sp.vai = sp.tuoi === 'gia' ? 'ba' : 'chau';
    return sp;
  }
  // ---------- regions + joint positions of a cut-out actor (same oblique projection as drawCutout) ----------
  function khopAt(a, t) {
    const J = MS.nv.solve(a, t), C = MS.nv.CUT[a.ve.bo], s = a.s, at = J.E.pa, fb = Math.sin(J.thC) >= 0 ? 1 : -1, CL = (C && C.rong_ngang) ?? .9;
    const P = p => [at.x + fb * (p[0] + p[2] * CL) * s, at.y - p[1] * s];
    const lat = sd => (sd === 'R' ? -1 : 1) * J.R.hipW, out = { co: P(J.Nk), dau: P(J.Hc), hong: P([J.hip[0], J.hip[1], 0]) };
    for (const sd of ['R', 'L']) { const A = J.arm[sd], L = J.leg[sd]; if (A) { out['vai_' + sd] = P(A.Sh); out['khuyu_' + sd] = P(A.El); out['co_tay_' + sd] = P(A.Wr); }
      out['hong_' + sd] = P([J.hip[0], J.hip[1], lat(sd)]); out['goi_' + sd] = P([L.kn[0], L.kn[1], lat(sd)]); out['co_chan_' + sd] = P([L.an[0], L.an[1], lat(sd)]); }
    return { J, k: out, hr: J.R.headR * s };
  }
  function vungAt(a, t) {
    const { k, hr } = khopAt(a, t), pts = Object.values(k), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const head = [k.dau[0] - hr * 1.15, k.dau[1] - hr * 1.25, hr * 2.3, hr * 2.4], feet = Math.max(...ys) + 12 * a.s;
    const box = (x0, y0, x1, y1) => [x0, y0, x1 - x0, y1 - y0];
    return { mat: [k.dau[0] - hr * .8, k.dau[1] - hr * .6, hr * 1.6, hr * 1.4], dau: head,
      than_tren: box(Math.min(...xs, head[0]), head[1], Math.max(...xs, head[0] + head[2]), k.hong[1] + hr * .3),
      toan_than: box(Math.min(...xs, head[0]) - 10, head[1], Math.max(...xs, head[0] + head[2]) + 10, feet) };
  }
  // ---------- QA: joint coverage in test poses ----------
  const POSES = [['dung', [{ t: 0, clip: 'dung' }], 1], ['di', [{ t: 0, clip: 'di' }], .45], ['gio-tay', [{ t: 0, clip: 'gio-tay' }], 1], ['chi', [{ t: 0, clip: 'chi' }], 1.2],
    ['ngoi', [{ t: 0, clip: 'ngoi' }], 1], ['vay', [{ t: 0, clip: 'vay' }], .4], ['nhay', [{ t: 0, clip: 'nhay' }], .62]];
  function kiemDinh(ve, opts = {}) {
    const C = MS.nv.CUT[ve.bo], W = 900, H = 1100, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d', { willReadFrequently: true });
    const loi = [], sheet = opts.sheet ? document.createElement('canvas') : null; if (sheet) { sheet.width = 300 * POSES.length; sheet.height = 380; }
    POSES.forEach(([name, hd, tt], i) => { for (const huong of [1, -1]) {
      const a = MS.nv.actor({ id: 'qa', ve, x: W / 2, y: H - 80, huong, goc: '3-4', hd: hd.map(e => ({ ...e })), lo_xo: false });
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); MS.nv.scene(g, [a], tt);
      const { k } = khopAt(a, tt), img = g.getImageData(0, 0, W, H).data, A = C.giaiphau;
      const width = (nm) => ({ vai: A.d.tay_tren, khuyu: A.d.khuyu, co_tay: A.d.co_tay, hong: A.d.dui, goi: A.d.goi, co_chan: A.d.co_chan, co: 46 * A.hs }[nm.split('_')[0]] || A.d.goi) * C.ti_le_anh * a.s;
      for (const [nm, p] of Object.entries(k)) { if (nm === 'dau' || nm === 'hong') continue; const r = width(nm) * .32; let n = 0, f = 0;
        for (let y = nm.startsWith('vai') ? 0 : -r; y <= r; y += 1.5) for (let x = -r; x <= r; x += 1.5) { if (x * x + y * y > r * r) continue; const X = Math.round(p[0] + x), Y = Math.round(p[1] + y); if (X < 0 || Y < 0 || X >= W || Y >= H) continue; n++; if (img[(Y * W + X) * 4 + 3] > 140) f++; }
        const phu = n ? f / n : 1; if (phu < (nm.startsWith('vai') ? .96 : .985)) loi.push({ tu_the: name + (huong < 0 ? '←' : '→'), khop: nm, phu: +phu.toFixed(3) }); }   // shoulder: only the armpit half counts (the top half is the silhouette edge, not a gap)
      if (sheet && huong === 1) sheet.getContext('2d').drawImage(c, 150, 120, 600, 900, i * 300, 0, 300, 380 * 300 / 300 * .95);
    } });
    return { ok: !loi.length, loi, sheet };
  }
  // build + QA + auto-fix: raise the joint overlap / round caps until every joint is covered (max 3 passes)
  function dungVaKiem(ve, buildFn) {
    let sua = 0, rep; for (let pass = 0; pass < 3; pass++) { rep = kiemDinh(ve); if (rep.ok || !rep.loi.some(l => /^(khuyu|goi|co_tay|co_chan|vai|hong)/.test(l.khop))) break; sua++; ve.xuong = { ...ve.xuong, _chong: Math.min(.9, (ve.xuong._chong || .55) + .12) }; MS.nv.CUT[ve.bo] = buildFn(ve.xuong); }
    return { ...rep, sua };
  }
  MS.giaiphau = { giai, doc, kiemDinh, dungVaKiem, khopAt, vungAt, CANON, MAU, HINH_THE };
  if (MS.nv) MS.nv.vungAt = vungAt;
})();
