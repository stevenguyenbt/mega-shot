// mega-shot · nhanvat.js — 2D story characters on a real SKELETON (template `truyen`, references/story/README.md).
// Flat survival-channel look (tall thin figure, round head, dot eyes, brows that carry the emotion, jacket / trousers / boots),
// animated the way games do it:
//   · bone tree: pelvis → 3 spine joints → chest → neck → head; shoulder → upper arm → forearm → hand; hip → thigh → shin → foot.
//     Bones live in a shallow 3D body frame (forward f / up u / left l), so the same rig turns smoothly profile ↔ 3/4 ↔ front ↔ back.
//   · CLIPS (engine/core/nhanvat_clip.js): keyframed actions (spline-interpolated, anticipation → overshoot → settle baked in) and
//     procedural cycles (walk / run / panic run / climb) with ROOT MOTION — the step phase comes from the distance walked, so feet never slide.
//   · a per-character timeline (`hanh_dong`) = state machine: each entry cross-fades from the previous clip (spring-shaped weight);
//     upper-body clips (torch, point, wave…) layer over the walk; talking adds hand gestures + nods on stressed words.
//   · IK: two-bone legs keep planted feet on the (sloped) ground and lower the hips when needed; two-bone arms reach a point,
//     another character's hand / shoulder (`toi`), both ways at once when two people hold hands.
//   · secondary motion: deterministic windowed springs (same frame → same picture, render order free) for hair, backpack,
//     jacket hem, head follow-through and squash & stretch on landings; breathing, blinking, look-at (`nhin`) with eyes leading.
//   · simple skinning: torso / sleeves / trousers are smooth ribbons along the bones, so the jacket bends with the spine.
//
//   MS.nv.actor(spec) → actor            spec: { id, ve, x, y, s, huong: 1|-1, goc: ngang|3-4|thang|lung|lung-3-4, hd: [{ t, clip, mix, tu, xong,
//                                              huong, goc, bc, nhin, toi }], bc (expression), x1/y1 (walk target), di_tu/di_den (s), toc,
//                                              kieu_di, doc (ground slope), nhin, toi, words, nghe, t0g (global time of t = 0), toi_mau, den, ghe }
//   MS.nv.scene(x, actors, t)           draws all actors at local time t (resolves look-at + reach between them); returns per-actor anchors
//   MS.nv.draw(x, ve, o)                legacy single-character call (tu_the / bieu_cam / huong / track)
//   ve: { da, toc: { kieu: ngan|dai|bui|bac-bui|none, mau }, mu: { kieu: luoi-trai|non-la|none, mau }, ao: { mau, kieu: khoac|ao, tay: dai|ngan },
//         quan, giay, cao: 1, rong: 1, dau: 1, rau: none|ram, kinh: false, balo: '#color'|null, ao_phao: false,
  //       dau_den: true (Ifverse look: black round head, cream eyes / brows / mouth; mau_dau, mau_mat; no: <colour> hair bow, mu: { kieu: non-la } conical hat | { kieu: vu-tru } glass space helmet), vet: true|<colour> (chest smear) }
(() => {
  const MS = window.MS, { clamp, lerp } = MS.u, PI = Math.PI;
  const sh = (c, k) => { const [r, g, b] = MS.u.hex(c); const f = v => Math.round(clamp(v * k / 255) * 255).toString(16).padStart(2, '0'); return '#' + f(r) + f(g) + f(b); };
  const sstep = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
  // step response of a damped spring (0 → 1, z < 1 overshoots a little): the shape of every blend / turn
  // cubic-bezier easing (CSS-style, endpoints 0,0 → 1,1; Newton solve on x) — ported from ArtCraft (github.com/storytold/artcraft,
  // timeline/interpolation.ts, MIT / Apache-2.0). Used by key easing (keys[i][2]) and timeline transitions (hd[i].chuyen).
  const EASE = { lin: [0, 0, 1, 1], vao: [.42, 0, 1, 1], ra: [0, 0, .58, 1], 'vao-ra': [.42, 0, .58, 1], 'nhanh-cham': [.16, 1, .3, 1],
    'cham-nhanh': [.7, 0, .84, 0], nay: [.34, 1.56, .64, 1], 'lay-da': [.6, -.28, .74, .05], 'lay-da-nay': [.68, -.55, .27, 1.55] };
  const easeOf = e => Array.isArray(e) && e.length === 4 ? e : EASE[e] || null;
  const bezAx = (t, a1, a2) => { const c = 3 * a1, b = 3 * (a2 - a1) - c, a = 1 - c - b; return ((a * t + b) * t + c) * t; };
  const bez = (E, x) => { if (x <= 0) return 0; if (x >= 1) return 1; let t = x;
    for (let i = 0; i < 8; i++) { const err = bezAx(t, E[0], E[2]) - x; if (Math.abs(err) < 1e-5) break; const c = 3 * E[0], b = 3 * (E[2] - E[0]) - c, a = 1 - c - b, d = (3 * a * t + 2 * b) * t + c; if (Math.abs(d) < 1e-6) break; t -= err / d; }
    return bezAx(Math.max(0, Math.min(1, t)), E[1], E[3]); };
  const spr = (t, w = 13, z = .78) => { if (t <= 0) return 0; const wd = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + z * w / wd * Math.sin(wd * t)); };

  // ---------------- rig (units at scale 1; total height ≈ 560 with hair) ----------------
  const BASE = { T: 124, S: 118, ank: 16, foot: 46, heel: 12, hipW: 15, sp: [64, 62, 56], neck: 22, headUp: 34, headR: 38, shW: 33, shDrop: 15, up: 100, fore: 92, hand: 12 };
  // RETARGETING: every clip is authored as joint ANGLES (+ foot targets that scale with the leg), so any body proportion plays the same
  // library. ve.dang = preset, ve.ti_le = { chan, tay, than, dau, vai } multipliers (legs, arms, spine, head, shoulder width).
  const DANG = { 'nguoi-lon': {}, 'tre-em': { chan: .68, tay: .72, than: .72, dau: 1.3, vai: .8 }, 'cao-gay': { chan: 1.12, tay: 1.1, than: 1.08, dau: .92, vai: .95 },
    'thap-dam': { chan: .8, tay: .9, than: .92, dau: 1.05, vai: 1.25, rong: 1.35 }, chibi: { chan: .5, tay: .58, than: .58, dau: 1.85, vai: .8 } };
  function rigOf(ve = {}) {
    const k = { ...(DANG[ve.dang] || {}), ...(ve.ti_le || {}) }, c = k.chan ?? 1, t = k.tay ?? 1, b = k.than ?? 1, h = (k.dau ?? 1) * (ve.dau || 1), v = k.vai ?? 1;
    const B0 = ve.kieu === 'anh' && CUT[ve.bo] ? { ...BASE, ...CUT[ve.bo].rig } : BASE;
    const r = { ...B0, T: B0.T * c, S: B0.S * c, ank: B0.ank * Math.sqrt(c), foot: B0.foot * Math.sqrt(c), heel: B0.heel * Math.sqrt(c), hipW: B0.hipW * v,
      sp: B0.sp.map(x => x * b), neck: B0.neck * b, headUp: B0.headUp * h, headR: B0.headR * h, shW: B0.shW * v, shDrop: B0.shDrop * b, up: B0.up * t, fore: B0.fore * t };
    r.H0 = r.T + r.S + r.ank - 5; r.LS = (r.T + r.S) / (BASE.T + BASE.S); r.W = (k.rong ?? 1) * v;
    // sit / lie hip height (clip hh): scaled by shin + ankle (the seat height), which differs from the whole-leg ratio on chibi cut-outs (short thighs)
    r.LSh = ve && ve.kieu === 'anh' && CUT[ve.bo] && CUT[ve.bo].tay_truoc ? (r.S + r.ank) / (BASE.S + BASE.ank) : r.LS; return r;
  }
  let R = rigOf(), H0 = R.H0, LS = 1, LSh = 1;
  const useRig = a => { R = a.R || (a.R = rigOf(a.ve)); H0 = R.H0; LS = R.LS; LSh = R.LSh ?? R.LS; };
  const DEF = { rot: 0, dx: 0, dy: 0, hh: BASE.T + BASE.S + BASE.ank - 5, hf: 0, sp: .03, sb: 0, tw: 0, nk: 0, hr: 0, hy: 0, sh: 0,
    aNp: .07, aNa: .1, aNe: .2, aFp: -.04, aFa: .1, aFe: .16, gN: 0, gF: 0, kN: 0, kF: 0, oN: 0, oF: 0,
    lNp: .04, lNa: .02, lNk: .06, lNf: 0, lFp: -.04, lFa: .02, lFk: .05, lFf: 0, pN: 1, pF: 1 };
  const CH = Object.keys(DEF);
  // N/F (near / far side, as authored) → R/L (character's right / left; right = l −1). nearL = lateral sign of the near side.
  const SIDE = { '-1': {}, '1': {} };
  for (const k of CH) for (const nl of [-1, 1]) { const n = nl < 0 ? 'R' : 'L', f = nl < 0 ? 'L' : 'R'; SIDE[nl][k] = k.replace(/^([al][NF]|[pgko][NF])/, m => m.replace('N', n).replace('F', f)); }
  const LR = Object.values(SIDE['-1']);
  const toLR = (P, nl) => { const o = {}; for (const k in P) o[SIDE[nl][k] || k.replace(/^f([NF])$/, (m, s) => 'f' + ((s === 'N') === (nl < 0) ? 'R' : 'L'))] = P[k]; return o; };

  // ---------------- clips ----------------
  const CLIPS = {};
  function addClips(lib) {
    for (const [name, c] of Object.entries(lib)) {
      if (c.fn) { CLIPS[name] = { ...c, name }; continue; }
      const base = { ...DEF, ...(c.base ? (typeof c.base === 'string' ? CLIPS[c.base].keys[0][1] : c.base) : {}) };
      let cur = base; const keys = c.keys.map(([t, v, e]) => { cur = { ...cur, ...v }; return [t, cur, e]; });
      CLIPS[name] = { ...c, name, keys, len: c.len ?? keys[keys.length - 1][0] };
    }
  }
  function sample(c, t) {                                                        // non-uniform Catmull-Rom through the keys
    const K = c.keys, n = K.length; if (n === 1) return { ...K[0][1] };
    const L = c.len; if (c.loop) t = ((t % L) + L) % L; else t = clamp(t, 0, K[n - 1][0]);
    let i = 0; while (i < n - 2 && t >= K[i + 1][0]) i++;
    const [t0, A, e] = K[i], [t1, B] = K[i + 1], dt = Math.max(1e-4, t1 - t0), s = clamp((t - t0) / dt);
    if (e === 'giu') return { ...A };
    const prev = i > 0 ? K[i - 1] : c.loop ? [K[n - 2][0] - L, K[n - 2][1]] : null, next = i + 2 < n ? K[i + 2] : c.loop ? [K[1][0] + L, K[1][1]] : null;
    const h00 = 2 * s * s * s - 3 * s * s + 1, h10 = s * s * s - 2 * s * s + s, h01 = -2 * s * s * s + 3 * s * s, h11 = s * s * s - s * s, o = {};
    const ez = e && e !== 'lin' ? easeOf(e) : null, se = ez ? bez(ez, s) : s;    // eased key: straight blend along a bezier timing curve
    for (const k in A) { const a = A[k], b = B[k]; if (typeof a !== 'number') { o[k] = s < .5 ? a : b; continue; }
      if (e === 'lin' || ez) { o[k] = a + (b - a) * se; continue; }
      const m0 = prev ? (b - prev[1][k]) / (t1 - prev[0]) : 0, m1 = next ? (next[1][k] - a) / (next[0] - t0) : 0;
      o[k] = h00 * a + h10 * dt * m0 + h01 * b + h11 * dt * m1; }
    return o;
  }

  // ---------------- locomotion (procedural cycles with root motion) ----------------
  const LOCO = { di: { v: 300, run: 0 }, chay: { v: 700, run: 1 }, 'chay-hoang': { v: 760, run: 1, panic: 1 }, leo: { v: 150, run: 0, climb: 1 }, 'di-cham': { v: 150, run: 0 } };
  const stepLen = (st, v) => st.run ? clamp(110 + .36 * v, 150, 340) : st.climb ? clamp(40 + .25 * v, 55, 95) : clamp(50 + .32 * v, 62, 205);
  function loco(style, d, v, L, gs, ph0) {                                       // → R/L channels with explicit ankle targets fR / fL
    const st = LOCO[style] || LOCO.di, run = st.run, beta = run ? .36 : st.climb ? .66 : .6, ph = d / (2 * L) + ph0, P = { ...toLR(DEF, -1) };
    const lift = (run ? 62 : st.climb ? 52 : 15 + L * .045) * LS;                // a walking foot only just clears the floor
    for (const [sd, off] of [['R', 0], ['L', .5]]) {
      const f0 = ((ph + off) % 1 + 1) % 1; let f, u = R.ank, p = PI / 2;
      if (f0 < beta) { const s = f0 / beta; f = L * beta * (1 - 2 * s);
        const toe = s > .62 ? Math.pow((s - .62) / .38, 1.4) * (run ? .75 : .6) : 0; p += (s < .16 ? .3 * (1 - s / .16) : 0) - toe; u += Math.sin(toe) * (R.foot - R.heel) * .9; }
      else { const s = (f0 - beta) / (1 - beta); f = -L * beta + 2 * L * beta * sstep(s); u += lift * Math.pow(Math.sin(PI * s), .85) + (run ? 18 * Math.sin(PI * s) : 0);
        p += -.65 * Math.pow(1 - s, 2) + .3 * Math.pow(s, 3); }
      P['f' + sd] = [f, u + gs * f, p]; P['p' + sd] = 0;
    }
    const c2 = Math.cos(4 * PI * (ph - (run ? .43 : .3))), sw = Math.cos(2 * PI * ph);
    P.hip = [run ? 14 : 4, H0 - (run ? 20 : st.climb ? 26 : 5) + (run ? 15 : 6) * c2];
    P.sp = run ? .3 + .03 * c2 : st.climb ? .55 : .07 + .02 * c2; P.tw = (run ? .16 : .1) * Math.sin(2 * PI * ph); P.nk = -P.sp * .55;
    const A = run ? .95 : clamp(.12 + L * .0012, .16, .32), sa = run ? sw : Math.cos(2 * PI * (ph - .035));   // walk: arms swing from the shoulder, trailing the legs a touch
    P.aRp = A * sa + (run ? .35 : .05); P.aLp = -A * sa + (run ? .35 : .05);
    P.aRe = run ? 1.45 + .2 * sw : .18 + .22 * Math.max(0, sa) + .04 * Math.max(0, -sa); P.aLe = run ? 1.45 - .2 * sw : .18 + .22 * Math.max(0, -sa) + .04 * Math.max(0, sa);   // elbow bends on the forward swing, nearly straight behind
    P.aRa = P.aLa = run ? .12 : .03;
    if (!run && !st.climb) P.sb = .01 * Math.sin(2 * PI * ph);                  // shoulders dip a hair over the stance leg (more warps the cut-out torso)
    if (st.panic) { const q = Math.sin(2 * PI * ph * 1.3); P.aRp = 1.6 + .9 * q; P.aLp = 1.4 - .9 * q; P.aRa = .35 + .25 * q; P.aLa = .4 - .2 * q; P.aRe = .5; P.aLe = .6; P.hy = .55 * sstep(Math.sin(PI * ph * .5) ** 2); P.nk = -.1; }
    if (st.climb) { const q = Math.sin(2 * PI * ph); P.aRp = 1.25 + .45 * q; P.aLp = 1.25 - .45 * q; P.aRe = .35 - .2 * q; P.aLe = .35 + .2 * q; P.nk = -.35; }
    return P;
  }

  // ---------------- timelines ----------------
  const GOC = { ngang: 1.5, '3-4': .95, thang: 0, lung: PI, 'lung-3-4': 2.25, nghieng: 1.25 };
  const SPEED = { cham: 150, vua: 300, nhanh: 520, chay: 750 };
  function actor(sp) {
    const a = { ...sp, s: (sp.s ?? 1) * ((sp.ve || {}).cao || 1), pha: sp.pha || 0 };
    a.hd = (sp.hd || []).map(e => ({ ...e })).sort((p, q) => p.t - q.t); if (!a.hd.length || a.hd[0].t > 0) a.hd.unshift({ t: 0, clip: sp.clip || 'dung' });
    for (const e of a.hd) { if (!CLIPS[e.clip]) e.clip = MAP[e.clip] || 'dung'; e.mix = e.mix ?? (CLIPS[e.clip].vao ?? .28); if (e.xong) e.tu = CLIPS[e.clip].len; }
    // walk path (root motion): x → x1 between di_tu and di_den (seconds); trapezoid velocity profile
    if (sp.x1 != null && Math.abs(sp.x1 - sp.x) > 1) {
      const dist = Math.abs(sp.x1 - sp.x), t0 = sp.di_tu ?? 0; let t1 = sp.di_den ?? sp.D ?? 3;
      const toc = typeof sp.toc === 'string' ? SPEED[sp.toc] : sp.toc; if (toc) t1 = t0 + dist / toc + .3;
      const T = Math.max(.3, t1 - t0), ac = Math.min(.42, T / 3), vmax = dist / (T - ac);
      const ly = sp.y1 ?? sp.y ?? 0;
      let style = sp.kieu_di || (LOCO[a.hd[0].clip] ? a.hd[0].clip : vmax > 560 ? 'chay' : 'di');
      a.path = { x0: sp.x, x1: sp.x1, y0: sp.y ?? 0, y1: ly, t0, T, ac, vmax, dist, dir: Math.sign(sp.x1 - sp.x), style, L: stepLen(LOCO[style] || LOCO.di, vmax) };
      if (a.doc == null && Math.abs(ly - (sp.y ?? 0)) > 2) a.doc = -(ly - (sp.y ?? 0)) / (sp.x1 - sp.x);
    }
    // facing events: initial, path direction, timeline entries with huong / goc
    const h0 = sp.huong || (a.path ? a.path.dir : 1), F = [{ t: -9, h: h0, g: sp.goc }];
    if (a.path && a.path.dir !== h0) F.push({ t: a.path.t0 - .15, h: a.path.dir });
    for (const e of a.hd) if (e.huong || e.goc) F.push({ t: e.t, h: e.huong || null, g: e.goc });
    F.sort((p, q) => p.t - q.t); for (let i = 1; i < F.length; i++) { F[i].h = F[i].h || F[i - 1].h; F[i].g = F[i].g || (F[i].h === F[i - 1].h ? F[i - 1].g : F[i - 1].g); }
    a.face = F; a.goc0 = sp.goc;
    a.dao = (sp.ve || {}).kieu === 'anh';                                       // cut-out art is drawn near-front: gestures go to the arm on the FACING side
    for (const e of a.hd) e.nl = a.dao ? 1 : -Math.sign(signAt(a, e.t + .2) || 1);   // cut-out: the facing-side arm is always L   // near side of this clip instance (lateral sign)
    a.bcs = [{ t: -9, bc: sp.bc || 'binh' }, ...a.hd.filter(e => e.bc || CLIPS[e.clip].bc).map(e => ({ t: e.t, bc: e.bc || CLIPS[e.clip].bc }))];
    a.gest = gestures(a.words || [], (a.t0g || 0), a.pha);
    a.ngheAcc = gestures(a.nghe || [], (a.t0g || 0), a.pha + 3).filter((g, i) => i % 2 === 0);
    a.sitting = a.hd.some(e => CLIPS[e.clip].ngoi);
    return a;
  }
  function pathAt(a, t) {
    const p = a.path; if (!p) return { x: a.x, y: a.y ?? 0, d: 0, v: 0 };
    const tau = clamp(t - p.t0, 0, p.T), { T, ac, vmax } = p; let s, v;
    if (tau < ac) { s = vmax * tau * tau / (2 * ac); v = vmax * tau / ac; }
    else if (tau < T - ac) { s = vmax * (ac / 2 + tau - ac); v = vmax; }
    else { s = p.dist - vmax * (T - tau) ** 2 / (2 * ac); v = vmax * (T - tau) / ac; }
    if (t < p.t0 || t > p.t0 + T) v = 0;
    const k = s / p.dist; return { x: lerp(p.x0, p.x1, k), y: lerp(p.y0, p.y1, k), d: s, v };
  }
  function signAt(a, t) {                                                        // smooth facing sign −1…1 (passes through 0 = front view)
    const F = a.face; let v = F[0].h;
    for (let i = 1; i < F.length; i++) { if (t < F[i].t) break; const dur = .38, e = spr((t - F[i].t) / dur * .9, 7, .82); v = lerp(v, F[i].h, e); }
    return v;
  }
  function gocAt(a, t) { const F = a.face; let g = F[0].g; for (const f of F) if (t >= f.t) g = f.g; return g; }
  // talking: accents on stressed words → gesture strokes (prepare → stroke → retract) + nods + brow raises
  function gestures(words, t0g, seed) {
    const out = []; let last = -9;
    words.forEach((w, i) => { const gap = i ? w[1] - words[i - 1][2] : 1, dur = w[2] - w[1], end = /[!?.,…]$/.test(w[0]);
      if ((i === 0 || gap > .16 || dur > .3 || end) && w[1] - last > .5) {
        const q = /\?/.test(w[0]) || (words[i + 1] && /\?/.test(words[i + 1][0])), h = hash(i + seed * 7.3);
        out.push({ t: w[1] - t0g, k: q && out.length ? 'nhun' : /!/.test(w[0]) ? 'manh' : ['beat', 'mo', 'beat2', 'chi', 'nguc', 'beat'][Math.floor(h * 6)], q }); last = w[1]; } });
    return out;
  }
  const GEST = { beat: { aNp: .55, aNe: .95, sp: .03, nk: .06 }, manh: { aNp: .8, aNe: .7, aNa: .1, sp: .06, nk: .1, aFp: .3, aFe: .6 }, beat2: { aFp: .55, aFe: .9, nk: .05 },
    mo: { aNp: .45, aNa: .38, aNe: .75, aFp: .4, aFa: .32, aFe: .65, sh: .06, nk: -.03 }, chi: { aNp: 1.15, aNe: -.05, nk: .03 }, nguc: { aNp: .45, aNe: 1.75, aNa: -.12, nk: .05 },
    nhun: { sh: .4, aNa: .28, aFa: .28, aNe: .55, aFe: .55, aNp: .15, aFp: .15, hr: .12 } };
  const env = (tau, hold = .16, rel = .5) => tau < -.24 ? 0 : tau < 0 ? sstep((tau + .24) / .24) : tau < hold ? 1 : 1 - sstep((tau - hold) / rel);

  // ---------------- pose evaluation ----------------
  function clipPose(a, i, t) {                                                   // timeline entry i (+ cross-fade from i−1), R/L space
    const e = a.hd[i], c = CLIPS[e.clip], lt = t - e.t + (e.tu || 0);
    let P = c.fn ? c.fn(lt, a) : sample(c, lt); P = toLR(P, e.nl); P._c = c;
    // e.chuyen: bezier transition (ArtCraft-style strip transition) instead of the spring-shaped cross-fade
    if (i > 0 && t - e.t < e.mix) { const ec = e.chuyen && easeOf(e.chuyen), w = ec ? bez(ec, (t - e.t) / e.mix) : spr((t - e.t) / e.mix * 1.05, 6.2, .8); const Q = clipPose(a, i - 1, t); return blend(Q, P, w); }
    return P;
  }
  let GS = 0;
  function feetOf(P) {                                                          // FK feet + hip height → explicit targets (root frame), like the walk layer
    if (P.fR) return P; const o = { ...P }, leg = {};
    for (const s of ['R', 'L']) { const a1 = P['l' + s + 'p'] - P.rot, a2 = a1 - P['l' + s + 'k']; leg[s] = { an: [Math.sin(a1) * R.T + Math.sin(a2) * R.S, -Math.cos(a1) * R.T - Math.cos(a2) * R.S], fp: a2 + PI / 2 + P['l' + s + 'f'] }; }
    let hf = -1e9, any = 0; for (const s of ['R', 'L']) if (P['p' + s] > .01) { any = 1; hf = Math.max(hf, R.ank + GS * (P.dx + leg[s].an[0]) - leg[s].an[1]); }
    const H = lerp(any ? hf : P.hh * LSh, P.hh * LSh, P.hf);
    for (const s of ['R', 'L']) { const pl = P['p' + s]; const f = P.dx + leg[s].an[0], gu = R.ank + GS * f; let u = H + P.dy + leg[s].an[1]; if (pl > 0) u = lerp(u, gu, pl);
      o['f' + s] = [f, u, lerp(leg[s].fp, PI / 2 + Math.atan(GS), pl)]; o['p' + s] = 0; }
    o.hip = [0, H]; return o;
  }
  function blend(A, B, w) {
    if (!!A.fR !== !!B.fR) { A = feetOf(A); B = feetOf(B); }
    const o = { _c: w < .5 ? A._c : B._c };
    for (const k in B) { if (k[0] === '_') continue; const a = A[k], b = B[k];
      if (Array.isArray(b) || Array.isArray(a)) { o[k] = a && b ? b.map((v, j) => lerp(a[j], v, w)) : (w < .5 ? a : b); continue; }
      o[k] = a == null ? b : lerp(a, b, w); }
    for (const k in A) if (!(k in o) && k[0] !== '_') o[k] = A[k];
    return o;
  }
  const UPPER = ['sp', 'sb', 'nk', 'hr', 'hy', 'sh', 'aRp', 'aRa', 'aRe', 'aLp', 'aLa', 'aLe', 'gR', 'gL', 'kR', 'kL', 'oR', 'oL'];
  function evalPose(a, t, lite) {
    let i = 0; for (let k = 0; k < a.hd.length; k++) if (t >= a.hd[k].t) i = k;
    const pa = pathAt(a, t), sg = signAt(a, t), gs = (a.doc || 0) * Math.sign(sg || 1); GS = gs;
    let P = clipPose(a, i, t); const c = CLIPS[a.hd[i].clip];
    // locomotion layer: speed-driven weight; upper-body clips keep the arms / head over the walk
    let wl = 0;
    if (a.path || c.loco) {
      const style = c.loco ? c.name : a.path ? a.path.style : 'di', st = LOCO[style] || LOCO.di;
      const v = a.path ? pa.v : st.v, d = a.path ? pa.d : st.v * Math.max(0, t - a.hd[i].t);
      wl = c.loco && !a.path ? 1 : sstep(v / 70);
      if (wl > 0) { const L = (a.path ? (a.path.style === style ? a.path.L : stepLen(st, a.path.vmax)) : stepLen(st, st.v)) * Math.sqrt(LS);
        const M = loco(style, d, v, L, gs, a.pha * .37);
        if (c.tren) { const U = {}; for (const k of UPPER) U[k] = P[k]; P = blend(P, M, wl); for (const k of UPPER) if (k !== 'sp') P[k] = U[k]; P.sp = lerp(M.sp, U.sp, .5); }
        else P = blend(P, M, wl); }
    }
    P.wl = wl;
    const yawMag = (() => { const g = gocAt(a, t); return lerp(GOC[g] ?? GOC['3-4'], g ? GOC[g] ?? 1.45 : 1.45, wl); })();
    // breathing (+ faster after running), idle micro-motion
    const br = Math.sin((t + a.pha) * 2.1);
    P.sp += br * .012; P.sh = (P.sh || 0) + br * .025;
    if (!lite) {
      // talk gestures (additive, in near/far space of the current facing)
      const nl = a.dao ? 1 : -Math.sign(sg || 1), busy = c.tay || c.tren ? .25 : 1, add = {};
      for (const g of a.gest) { const w = env(t - g.t) * (1 - wl * .6); if (w <= 0) continue; const G = GEST[g.k];
        for (const k in G) { const kk = SIDE[nl][k] || k, isArm = /^a/.test(k); add[kk] = (add[kk] || 0) + G[k] * w * (isArm ? busy : 1); } }
      const tg = (a.t0g || 0) + t, talking = (a.words || []).some(w => tg > w[1] - .3 && tg < w[2] + .4);
      if (talking) { add[SIDE[nl].aNe] = (add[SIDE[nl].aNe] || 0) + .22 * busy; add[SIDE[nl].aNp] = (add[SIDE[nl].aNp] || 0) + .08 * busy; }
      for (const g of a.ngheAcc) { const w = env(t - g.t - .35, .05, .35); if (w > 0) add.nk = (add.nk || 0) + .07 * w; }   // listener nods
      for (const k in add) P[k] = (P[k] || 0) + add[k];
    }
    return { P, pa, sg, yawMag, gs, c };
  }

  // ---------------- solve: legs IK + FK → 3D joints in the root frame ----------------
  const rotP = (f, u, q) => [f * Math.cos(q) + u * Math.sin(q), -f * Math.sin(q) + u * Math.cos(q)];
  function twoBone(J, P, L1, L2, bendSign) {                                     // sagittal plane, angles: 0 = down, + = forward
    const dx = P[0] - J[0], dy = P[1] - J[1], d = clamp(Math.hypot(dx, dy), Math.abs(L1 - L2) + 1, L1 + L2 - .01);
    const base = Math.atan2(dx, -dy), A = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const a1 = base + bendSign * A, k = [J[0] + Math.sin(a1) * L1, J[1] - Math.cos(a1) * L1], a2 = Math.atan2(P[0] - k[0], -(P[1] - k[1]));
    return { a1, a2, k };
  }
  function solve(a, t, lite) {
    useRig(a);
    const E = evalPose(a, t, lite), P = E.P, gs = E.gs;
    // feet: FK clip feet or explicit loco targets → hip height → IK
    if (R.gu) { const k = R.gu * (1 - P.hf); P.dx -= k * 26; for (const sd of ['N', 'F', 'R', 'L']) if (P['l' + sd + 'k'] != null) P['l' + sd + 'k'] += k * .35; }   // hunched body: hips back, knees soft, keeps balance
    const leg = {};
    for (const s of ['R', 'L']) {
      if (P['f' + s]) { leg[s] = { an: [P['f' + s][0], P['f' + s][1]], fp: P['f' + s][2], abs: true }; continue; }
      const a1 = P['l' + s + 'p'] - P.rot, a2 = a1 - P['l' + s + 'k'], kn = [Math.sin(a1) * R.T, -Math.cos(a1) * R.T];
      leg[s] = { an: [kn[0] + Math.sin(a2) * R.S, kn[1] - Math.cos(a2) * R.S], fp: a2 + PI / 2 + P['l' + s + 'f'] };
    }
    let hip;
    if (P.hip) hip = [P.hip[0] + P.dx, P.hip[1] + P.dy];
    else { let hf = -1e9, any = 0;
      for (const s of ['R', 'L']) if (P['p' + s] > .01) { any = 1; hf = Math.max(hf, R.ank + gs * (P.dx + leg[s].an[0]) - leg[s].an[1]); }
      hip = [P.dx, lerp(any ? hf : P.hh * LSh, P.hh * LSh, P.hf) + P.dy]; }
    for (const s of ['R', 'L']) { const L = leg[s]; if (!L.abs) L.an = [hip[0] + L.an[0], hip[1] + L.an[1]];
      const pl = P['p' + s] || 0, gu = R.ank + gs * L.an[0];
      if (pl > 0) { L.an[1] = lerp(L.an[1], gu, pl); L.fp = lerp(L.fp, PI / 2 + Math.atan(gs), pl); }
      if (Math.abs(P.rot) < .6) L.an[1] = Math.max(L.an[1], gu - 2); }
    // hips drop when a planted leg cannot reach
    const reach = (R.T + R.S) * .995;
    for (const s of ['R', 'L']) { const L = leg[s], df = L.an[0] - hip[0]; if ((P['p' + s] > .3 || L.abs) && Math.abs(df) < reach) { const top = L.an[1] + Math.sqrt(reach * reach - df * df); if (hip[1] > top) hip[1] = lerp(hip[1], top, L.abs ? 1 : P['p' + s]); } }
    for (const s of ['R', 'L']) { const L = leg[s], ik = twoBone(hip, L.an, R.T, R.S, 1); L.a1 = ik.a1; L.a2 = ik.a2; L.kn = ik.k;
      L.an = [ik.k[0] + Math.sin(ik.a2) * R.S, ik.k[1] - Math.cos(ik.a2) * R.S]; L.la = P['l' + s + 'a'] || 0; }
    // spine + head
    const nl = -Math.sign(E.sg || 1), cum = [.3, .65, 1], S = [[hip[0], hip[1], 0]], q = [];
    for (let k = 0; k < 3; k++) { const qq = P.rot + (P.sp + (R.gu || 0) * (1 - P.hf * .6)) * cum[k], rr = P.sb * cum[k] * nl; q.push(qq);
      const p = S[k]; S.push([p[0] + Math.sin(qq) * Math.cos(rr) * R.sp[k], p[1] + Math.cos(qq) * Math.cos(rr) * R.sp[k], p[2] + Math.sin(rr) * R.sp[k]]); }
    const q3 = q[2], N3 = S[3], gk = (R.gu || 0) * .75, qn = q3 + P.nk * .4 - gk * .5, qh0 = q3 + P.nk - gk, qh = Math.abs(P.rot) > .8 ? qh0 : clamp(qh0, -.55, .62 + Math.max(0, P.nk) * .5);   // hunched body, face still forward
    const Nk = [N3[0] + Math.sin(qn) * R.neck, N3[1] + Math.cos(qn) * R.neck, N3[2]];
    const hr = R.headR, Hc = [Nk[0] + Math.sin(qh) * R.headUp, Nk[1] + Math.cos(qh) * R.headUp, Nk[2]];
    // yaw per segment: hips lag, head leads the turn
    const mag = E.yawMag, sgH = signAt(a, t - .06), sgD = signAt(a, t + .09);
    const thH = sgH * mag, thC0 = E.sg * mag, thC = thC0 - Math.sign(thC0 || 1) * (P.tw || 0) * (1 - Math.abs(Math.sin(thC0)) * .2), thD = sgD * mag - Math.sign(sgD || 1) * (P.hy || 0);
    const J = { R, P, E, hip, S, q, q3, Nk, Hc, hr, qh, leg, nl, thH, thC, thD, arm: {}, gs, roll: P.hr * nl };
    if (!lite) for (const s of ['R', 'L']) armFK(J, s);
    return J;
  }
  function shoulder(J, s) { const R = J.R, sd = s === 'R' ? -1 : 1, N3 = J.S[3], q3 = J.q3; return [N3[0] - Math.sin(q3) * R.shDrop, N3[1] - Math.cos(q3) * R.shDrop + (J.P.sh || 0) * 12, sd * R.shW]; }
  function armFK(J, s) {
    const R = J.R;
    const P = J.P, sd = s === 'R' ? -1 : 1, a = P['a' + s + 'p'], b = P['a' + s + 'a'] + (R.tayMo || 0) * Math.max(0, Math.cos(a)), e = P['a' + s + 'e'], q3 = J.q3, Sh = shoulder(J, s);
    const d1 = rotP(Math.sin(a) * Math.cos(b), -Math.cos(a) * Math.cos(b), q3), El = [Sh[0] + d1[0] * R.up, Sh[1] + d1[1] * R.up, Sh[2] + sd * Math.sin(b) * R.up];
    const b2 = b * .7, d2 = rotP(Math.sin(a + e) * Math.cos(b2), -Math.cos(a + e) * Math.cos(b2), q3), Wr = [El[0] + d2[0] * R.fore, El[1] + d2[1] * R.fore, El[2] + sd * Math.sin(b2) * R.fore];
    J.arm[s] = { Sh, El, Wr, dir: d2, g: P['g' + s] || 0, k: P['k' + s] || 0, o: P['o' + s] || 0 };
  }
  function armIK(J, s, T, w) {                                                    // T in root frame [f, u, l]
    const R = J.R;
    const A = J.arm[s], Sh = A.Sh, sd = s === 'R' ? -1 : 1, q3 = J.q3;
    const dl = (T[2] - Sh[2]) * sd, [f, u] = rotP(T[0] - Sh[0], T[1] - Sh[1], -q3), dist = Math.hypot(f, u, dl);
    const b = clamp(Math.asin(clamp(dl / Math.max(1, dist), -1, 1)), -.35, 1.2);
    const ik = twoBone([0, 0], [f, u], R.up * Math.cos(b), R.fore * Math.cos(b * .7), -1);
    const P = J.P; P['a' + s + 'p'] = lerp(P['a' + s + 'p'], ik.a1, w); P['a' + s + 'e'] = lerp(P['a' + s + 'e'], ik.a2 - ik.a1, w); P['a' + s + 'a'] = lerp(P['a' + s + 'a'], b, w);
    armFK(J, s);
  }

  // ---------------- projection ----------------
  const pj = (p, th) => [p[0] * Math.sin(th) + p[2] * Math.cos(th), -p[1], p[0] * Math.cos(th) - p[2] * Math.sin(th)];
  const world = (a, J, p, th, at) => { const q = pj(p, th); return [at.x + q[0] * a.s, at.y + q[1] * a.s, q[2]]; };
  const toRoot = (a, J, X, Y, at, th, lat) => { const sx = (X - at.x) / a.s, sn = Math.sin(th); const f = Math.abs(sn) > .25 ? (sx - lat * Math.cos(th)) / sn : sx * Math.sign(sn || 1); return [f, -(Y - at.y) / a.s, lat]; };

  // ---------------- secondary motion: windowed springs (deterministic) ----------------
  function secondary(a, t) {
    const W = .75, dt = 1 / 32, n = Math.round(W / dt); let hx = 0, hy = 0, vx = 0, vy = 0, bx = 0, vbx = 0, cy = 0, vcy = 0, init = false, prev = null;
    for (let k = 0; k <= n; k++) {
      const tt = t - W + k * dt, J = solve(a, tt, true), pa = J.E.pa, th = J.thC;
      const head = pj(J.Hc, J.thD), chest = pj(J.S[2], th), X = pa.x + head[0] * a.s, Y = (pa.y || 0) + head[1] * a.s, CX = pa.x + chest[0] * a.s, CY = (pa.y || 0) - J.hip[1] * a.s;
      if (!init) { hx = X; hy = Y; bx = CX; cy = CY; init = true; }
      vx += (90 * (X - hx) - 9 * vx) * dt; vy += (90 * (Y - hy) - 9 * vy) * dt; hx += vx * dt; hy += vy * dt;     // hair / ponytail tip lag
      vbx += (60 * (CX - bx) - 8 * vbx) * dt; bx += vbx * dt;                                                  // backpack / hem lag
      vcy += (220 * (CY - cy) - 12 * vcy) * dt; cy += vcy * dt;                                                // squash spring on the hips
      prev = { X, Y, CX, CY };
    }
    return { hair: [hx - prev.X, hy - prev.Y], bag: bx - prev.CX, sq: clamp((cy - prev.CY) * .004, -.06, .07) };
  }

  // ---------------- expressions + mouth ----------------
  const EXPR = {   // brow inner / outer lift (+ up), eye scale, mouth: curve (+ smile), open, width
    binh: { bi: 0, bo: 0, eye: 1, cur: 0, o: 0, mw: 1 }, so: { bi: .9, bo: -.2, eye: 1.15, cur: -.25, o: .3, mw: .7 }, hoang: { bi: 1, bo: .6, eye: 1.4, cur: 0, o: .75, mw: .8 },
    quyet: { bi: -.8, bo: .25, eye: .9, cur: -.1, o: 0, mw: 1.1 }, buon: { bi: .8, bo: -.6, eye: .85, cur: -.55, o: 0, mw: .9 }, cuoi: { bi: .2, bo: .1, eye: .9, cur: .7, o: 0, mw: 1.2 },
    gian: { bi: -1, bo: .5, eye: .95, cur: -.5, o: .12, mw: 1 }, ngac: { bi: .9, bo: .9, eye: 1.3, cur: 0, o: .55, mw: .6 }, met: { bi: .3, bo: -.4, eye: .7, cur: -.2, o: .15, mw: .9 },
    nghi: { bi: -.3, bo: .5, eye: .95, cur: -.15, o: 0, mw: .8 }, vui: { bi: .5, bo: .3, eye: 1, cur: .85, o: .35, mw: 1.15 } };
  function exprAt(a, t) {
    const B = a.bcs; let cur = EXPR[B[0].bc] || EXPR.binh;
    for (let i = 1; i < B.length; i++) { if (t < B[i].t) break; const w = spr((t - B[i].t) / .3, 6, .85); const nx = EXPR[B[i].bc] || EXPR.binh; const o = {}; for (const k in cur) o[k] = lerp(cur[k], nx[k], w); cur = o; }
    return cur;
  }
  const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/đ/g, 'd');
  function viseme(words, tg) {                                                   // per syllable: open / width / round from the vowel, closures on m b p
    if (!words) return { o: 0, w: 1 };
    for (const [s, a, b] of words) { if (tg < a - .03 || tg > b + .05) continue;
      const k = clamp((tg - a) / Math.max(.06, b - a)), x = strip(s), v = (x.match(/[aeiouy]+/) || ['a'])[0];
      let o = .85, w = 1; if (/^(o|u)/.test(v)) { o = .62; w = .62; } else if (/^(i|y|e)/.test(v)) { o = .45; w = 1.18; }
      const closed = /^(m|b|p|ph)/.test(x) && k < .22, env2 = k < .3 ? sstep(k / .3) : 1 - .55 * sstep((k - .3) / .7);
      return { o: closed ? .05 : o * env2 * (tg > b ? 1 - (tg - b) / .05 : 1), w }; }
    return { o: 0, w: 1 };
  }

  // ---------------- drawing ----------------
  function capsule(x, A, B, ra, rb, col) {
    const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1e-3, nx = -dy / L, ny = dx / L; x.fillStyle = col;
    x.beginPath(); x.moveTo(A[0] + nx * ra, A[1] + ny * ra); x.lineTo(B[0] + nx * rb, B[1] + ny * rb); x.lineTo(B[0] - nx * rb, B[1] - ny * rb); x.lineTo(A[0] - nx * ra, A[1] - ny * ra); x.closePath(); x.fill();
    x.beginPath(); x.arc(A[0], A[1], ra, 0, 7); x.fill(); x.beginPath(); x.arc(B[0], B[1], rb, 0, 7); x.fill();
  }
  function smooth(x, pts) { const n = pts.length, m = i => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2];
    x.beginPath(); x.moveTo(...m(0)); for (let i = 1; i <= n; i++) { const p = pts[i % n], q = m(i); x.quadraticCurveTo(p[0], p[1], q[0], q[1]); } x.closePath(); }

  function drawActor(x, a, J, at, sec, look, tg) {
    useRig(a);
    if ((a.ve || {}).kieu === 'que') return drawStick(x, a, J, at, sec, look, tg);
    if ((a.ve || {}).kieu === 'anh' && CUT[a.ve.bo]) return drawCutout(x, a, J, at, sec, look, tg);
    const ve = a.ve || {}, s = a.s, Rw = (ve.rong || 1) * R.W, dark = a.toi_mau || 0;
    const K = c => dark ? MS.u.mix(c, '#0b0d12', dark) : c;
    const C = { da: ve.da || '#e8c4a0', ao: (ve.ao || {}).mau || '#7a5232', quan: ve.quan || '#3f5f8a', giay: ve.giay || '#3a2a20', toc: (ve.toc || {}).mau || '#2a1d17', mu: (ve.mu || {}).mau || '#3d5a3a' };
    if ((ve.toc || {}).kieu === 'bac-bui') C.toc = (ve.toc || {}).mau || '#c9c6c0';
    const sq = sec.sq, Wd = (p, th) => { const q = world(a, J, p, th, at); return [q[0] - (q[0] - at.x) * sq * .5, at.y + (q[1] - at.y) * (1 - sq), q[2]]; };   // squash & stretch about the feet
    const items = [], push = (z, fn) => items.push({ z, fn });
    const thH = J.thH, thC = J.thC, thD = J.thD;
    // ground shadow
    const hipLift = clamp((J.hip[1] - H0) / 120, -1, 1.5);
    x.fillStyle = `rgba(0,0,0,${.22 * (1 - clamp(hipLift, 0, 1) * .5)})`; x.beginPath(); x.ellipse(at.x + J.hip[0] * Math.sin(thH) * s, at.y + 2 - (J.gs * J.hip[0]) * s, 70 * s * (1 - hipLift * .2), 11 * s, 0, 0, 7); x.fill();
    // stool for sitting clips
    if (a.sitting && a.ghe !== false) { const sx = at.x + (-6) * Math.sin(thH) * s, top = at.y - (CLIPS.ngoi.keys[0][1].hh * LS - 22) * s;
      push(-200, () => { x.fillStyle = K('#5a4030'); x.fillRect(sx - 40 * s, top, 80 * s, 14 * s); x.fillStyle = K('#47331f'); x.fillRect(sx - 34 * s, top + 14 * s, 9 * s, at.y - top - 14 * s); x.fillRect(sx + 25 * s, top + 14 * s, 9 * s, at.y - top - 14 * s); }); }
    // legs
    for (const sd of ['R', 'L']) { const L = J.leg[sd], lat = (sd === 'R' ? -1 : 1) * (R.hipW + Math.sin(L.la) * 60);
      const hipJ = Wd([J.hip[0], J.hip[1], lat * .6], thH), kn = Wd([L.kn[0], L.kn[1], lat], thH), an = Wd([L.an[0], L.an[1], lat], thH), z = Math.min(15, kn[2]);
      const far = z < 0, col = far ? sh(C.quan, .74) : C.quan, gcol = far ? sh(C.giay, .78) : C.giay;
      const fd = [Math.sin(L.fp), -Math.cos(L.fp)], sole = [fd[1], -fd[0]];
      const heel = Wd([L.an[0] + sole[0] * R.ank * .55 - fd[0] * R.heel, L.an[1] + sole[1] * R.ank * .55 - fd[1] * R.heel, lat], thH),
            toe = Wd([L.an[0] + sole[0] * R.ank * .55 + fd[0] * (R.foot - R.heel), L.an[1] + sole[1] * R.ank * .55 + fd[1] * (R.foot - R.heel), lat], thH);
      const shin2 = [lerp(kn[0], an[0], .72), lerp(kn[1], an[1], .72)];
      push(z - 1, () => { capsule(x, hipJ, kn, 21 * Rw * s, 18 * Rw * s, K(col)); capsule(x, kn, an, 18 * Rw * s, 14 * Rw * s, K(col));
        capsule(x, shin2, an, 14.5 * Rw * s, 14 * Rw * s, K(gcol)); capsule(x, heel, toe, 12 * s, 9.5 * s, K(gcol)); });
    }
    // torso: skinned ribbon along the spine (hem → pelvis → waist → chest → shoulders → neck)
    const sp3 = J.S, q = J.q, th = k => lerp(thH, thC, k);
    const lvl = [[[sp3[0][0] - Math.sin(J.P.rot) * 30 + sec.bag * .04, sp3[0][1] - Math.cos(J.P.rot) * 30, 0], 38, 25, 0], [sp3[0], 36, 24, 0], [sp3[1], 33, 22, .33], [sp3[2], 37, 25, .66],
      [[sp3[3][0] - Math.sin(q[2]) * R.shDrop, sp3[3][1] - Math.cos(q[2]) * R.shDrop, 0], 41, 25, 1], [sp3[3], 17, 15, 1]];
    const T = lvl.map(([p, Wl, Dl, k]) => { const t2 = th(k), c = Wd(p, t2); return { c, w: Math.hypot(Wl * Rw * Math.cos(t2), Dl * Rw * Math.sin(t2)) * s, W: Wl * Rw * s, D: Dl * Rw * s, th: t2 }; });
    T[0].c[0] += sec.bag * .12 * s;                                             // hem trails the motion
    for (let k = 0; k < T.length; k++) { const A = T[Math.max(0, k - 1)].c, B = T[Math.min(T.length - 1, k + 1)].c, dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy) || 1; T[k].n = [-dy / L, dx / L]; }
    const edge = (t0, o) => [t0.c[0] + t0.n[0] * o, t0.c[1] + t0.n[1] * o];
    const outline = [...T.map(t0 => edge(t0, -t0.w)), ...T.slice().reverse().map(t0 => edge(t0, t0.w))];
    const sg = Math.sign(Math.sin(thC) || 1);
    push(20, () => {
      x.fillStyle = K(C.ao); smooth(x, outline); x.fill();
      x.save(); smooth(x, outline); x.clip();
      // far / back side shade: from the back silhouette to the near lateral line (W·cosθ) — empty when facing camera
      x.fillStyle = K(sh(C.ao, .8)); x.beginPath(); T.forEach((t0, k) => { const p = edge(t0, -sg * (t0.w + 3)); k ? x.lineTo(...p) : x.moveTo(...p); });
      T.slice().reverse().forEach(t0 => x.lineTo(...edge(t0, -sg * clamp(t0.W * Math.cos(t0.th), -t0.w, t0.w)))); x.closePath(); x.fill();
      if (ve.ao_phao) { x.fillStyle = K('#f07a1f'); x.beginPath(); [2, 3, 4].forEach((k, j) => { const p = edge(T[k], -T[k].w - 4); j ? x.lineTo(...p) : x.moveTo(...p); }); [4, 3, 2].forEach(k => x.lineTo(...edge(T[k], T[k].w + 4))); x.closePath(); x.fill();
        x.strokeStyle = K('#e8e3d8'); x.lineWidth = 8 * s; x.beginPath(); x.moveTo(...edge(T[2], -T[2].w)); x.lineTo(...edge(T[2], T[2].w)); x.stroke(); }
      // zip / front seam where the front centre faces us
      const fc = Math.cos(T[3].th); if ((ve.ao || {}).kieu === 'khoac' && fc > -.1) { x.strokeStyle = K(sh(C.ao, .62)); x.lineWidth = 3.5 * s; x.beginPath();
        [4, 3, 2, 1, 0].forEach((k, j) => { const p = edge(T[k], T[k].D * Math.sin(T[k].th)); j ? x.lineTo(...p) : x.moveTo(...p); }); x.stroke(); }
      if (ve.vet && fc > .15) { const c0 = edge(T[3], T[3].D * Math.sin(T[3].th) - T[3].W * .25 * Math.cos(T[3].th)), vs = 11 * s;   // a white smear on the chest (toothpaste)
        x.fillStyle = K(ve.vet === true ? '#f4f7fb' : ve.vet); x.beginPath(); x.ellipse(c0[0], c0[1], vs * 1.6 * fc, vs, -.2, 0, 7); x.ellipse(c0[0] + vs * fc, c0[1] + vs * .5, vs * .8 * fc, vs * .6, .4, 0, 7); x.fill(); x.fillRect(c0[0] + vs * .2, c0[1], vs * .5, vs * 1.6); }
      if ((ve.ao || {}).kieu === 'vest-mo' && fc > -.2) {                          // open jacket: bare chest / belly along the front centre
        const fo = k => T[k].D * Math.sin(T[k].th), hw = k => T[k].W * [.3, .42, .46, .5, .52, .5][k] * Math.max(.3, Math.cos(T[k].th));
        const L = [5, 4, 3, 2, 1, 0].map(k => edge(T[k], fo(k) - hw(k))), Rr = [0, 1, 2, 3, 4, 5].map(k => edge(T[k], fo(k) + hw(k)));
        x.fillStyle = K(C.da); x.beginPath(); [...L, ...Rr].forEach((p, i) => i ? x.lineTo(...p) : x.moveTo(...p)); x.closePath(); x.fill();
        x.strokeStyle = K(sh(C.ao, .65)); x.lineWidth = 5 * s; x.lineJoin = 'round'; for (const side of [L, Rr]) { x.beginPath(); side.forEach((p, i) => i ? x.lineTo(...p) : x.moveTo(...p)); x.stroke(); }
        if (ve.xam) { x.strokeStyle = K(ve.xam === true ? '#2f5d8a' : ve.xam); x.lineWidth = 3.2 * s;                   // tattoo swirls on chest + belly
          for (const [k, o, rr2] of [[3, -.55, 16], [3, .55, 16], [2, -.35, 12], [1, .3, 14]]) { const c = edge(T[k], fo(k) + o * hw(k)), q = rr2 * s;
            x.beginPath(); for (let a2 = 0; a2 < 12; a2 += .3) { const rad = q * (1 - a2 / 14); x.lineTo(c[0] + Math.cos(a2) * rad, c[1] + Math.sin(a2) * rad * .9); } x.stroke();
            x.beginPath(); x.arc(c[0], c[1], q * 1.15, 0, 7); x.stroke(); } }
      }
      if (ve.day_chuyen && fc > -.1) {                                              // chain necklace: links on a U from the neck sides to the chest
        const c4 = T[5], c3 = T[3], fo2 = T[4].D * Math.sin(T[4].th), w4 = T[5].W * 1.4 * Math.max(.35, Math.cos(T[4].th));
        x.strokeStyle = K(sh(ve.day_chuyen, .7)); x.fillStyle = K(ve.day_chuyen); x.lineWidth = 2 * s;
        for (let i = 0; i <= 14; i++) { const u = i / 14, ang = Math.PI * u, px = edge(c4, fo2 - Math.cos(ang) * w4), dy2 = Math.sin(ang) * (c3.c[1] - c4.c[1]) * .55;
          x.beginPath(); x.ellipse(px[0], px[1] + dy2, 6 * s, 4.2 * s, ang + (i % 2) * 1.2, 0, 7); x.fill(); x.stroke(); } }
      x.restore();
      if (ve.balo && Math.cos(thC) > .15) { x.strokeStyle = K(sh(ve.balo, .85)); x.lineWidth = 7 * s; for (const k of [-1, 1]) { const o = k * T[4].W * .5 * Math.cos(thC); x.beginPath(); x.moveTo(...edge(T[4], o)); x.lineTo(...edge(T[2], o * 1.1)); x.stroke(); } }
    });
    // backpack (sorted by depth: behind when facing us, in front when the back is turned)
    if (ve.balo) { const bp = [sp3[2][0] - Math.cos(q[1]) * 44, sp3[2][1] + Math.sin(q[1]) * 44 - 6, 0], c = Wd(bp, thC), z = 20 - 40 * Math.cos(thC), s1 = Wd(sp3[1], thC), s3 = Wd(sp3[3], thC), tilt = Math.atan2(s3[0] - s1[0], -(s3[1] - s1[1]));
      const wbag = Math.hypot(30 * Math.cos(thC), 20 * Math.sin(thC)) * s;
      push(z, () => { x.save(); x.translate(c[0] + sec.bag * .06 * s, c[1]); x.rotate(tilt + sec.bag * .0015); x.fillStyle = K(ve.balo); x.beginPath(); x.roundRect(-wbag, -70 * s, wbag * 2, 128 * s, 18 * s); x.fill();
        x.fillStyle = K(sh(ve.balo, .82)); x.beginPath(); x.roundRect(-wbag * .8, 0, wbag * 1.6, 46 * s, 10 * s); x.fill(); x.restore(); }); }
    // arms
    for (const sd of ['R', 'L']) { const A = J.arm[sd]; if (!A) continue;
      const Sh = Wd(A.Sh, thC), El = Wd(A.El, thC), Wr = Wd(A.Wr, thC), Hd = Wd([A.Wr[0] + A.dir[0] * 10, A.Wr[1] + A.dir[1] * 10, A.Wr[2]], thC);
      const z = (El[2] + Wr[2]) / 2 + 22 * Math.cos(thC) ** 2 + 6, far = Sh[2] < -4 && z < 20;
      const col = far ? sh(C.ao, .76) : C.ao, skin = far ? sh(C.da, .84) : C.da, short = (ve.ao || {}).tay === 'ngan';
      A.screen = { Sh, El, Wr, Hd, z };
      push(z, () => { capsule(x, Sh, El, 17 * Rw * s, 15 * Rw * s, K(col)); capsule(x, El, Wr, 15 * Rw * s, 13 * Rw * s, K(short ? skin : col));
        if (short) capsule(x, Sh, [lerp(Sh[0], El[0], .6), lerp(Sh[1], El[1], .6)], 18 * Rw * s, 16 * Rw * s, K(col));
        const ang = Math.atan2(Hd[1] - Wr[1], Hd[0] - Wr[0]), g = A.g;
        x.fillStyle = K(skin); x.beginPath(); x.ellipse(Hd[0], Hd[1], (12 + 4 * (1 - g)) * s, 11 * s, ang, 0, 7); x.fill();
        if (g < .5) { x.beginPath(); x.ellipse(Hd[0] + Math.cos(ang - 1.2 * sg) * 9 * s, Hd[1] + Math.sin(ang - 1.2 * sg) * 9 * s, 5 * s, 4 * s, ang, 0, 7); x.fill(); }   // thumb
        if (!far) { x.strokeStyle = K(sh(col, .7)); x.lineWidth = 3 * s; const c1 = [lerp(El[0], Wr[0], .86), lerp(El[1], Wr[1], .86)], dd = [Wr[0] - El[0], Wr[1] - El[1]], LL = Math.hypot(...dd) || 1;
          if (!short) { x.beginPath(); x.moveTo(c1[0] - dd[1] / LL * 13 * s, c1[1] + dd[0] / LL * 13 * s); x.lineTo(c1[0] + dd[1] / LL * 13 * s, c1[1] - dd[0] / LL * 13 * s); x.stroke(); } }
      }); }
    // neck + head
    const Nb = Wd(J.S[3], thC), Hc = Wd(J.Hc, thD), Nt = Wd(J.Nk, lerp(thC, thD, .5)), hr = J.hr * s;
    push(24, () => capsule(x, Nb, [lerp(Nt[0], Hc[0], .5), lerp(Nt[1], Hc[1], .5)], 9.5 * s, 9 * s, K(sh(C.da, .86))));
    const tk = (ve.toc || {}).kieu || 'ngan', mk = (ve.mu || {}).kieu;
    if (tk === 'dai') { const back = sph(-PI, -.2, J, thD, hr, Hc), sw = sec.hair; const z = 22 + back[2] * 8;
      const dn = Math.atan2(Nt[0] - Hc[0], Nt[1] - Hc[1]);   // hangs along the head's own down axis (lying → towards the feet)
      push(Math.min(z, 23), () => { x.fillStyle = K(C.toc); x.save(); x.translate(back[0] - sw[0] * .15, back[1]); x.rotate(-dn + clamp(-sw[0] * .004, -.4, .4)); x.beginPath(); x.ellipse(0, hr * .55, hr * 1.02, hr * 1.35, 0, 0, 7); x.fill(); x.restore(); }); }
    push(30, () => drawHead(x, a, J, Hc, hr, thD, C, K, ve, look, sec, tg));
    // torch in the near hand
    const nearS = J.nl < 0 ? 'R' : 'L', hand = J.arm[nearS] && J.arm[nearS].screen;
    if (hand && (a.den || J.E.c.prop === 'den')) { push(hand.z + .5, () => { const dx = hand.Hd[0] - hand.El[0], dy = hand.Hd[1] - hand.El[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      x.save(); x.translate(hand.Hd[0], hand.Hd[1]); x.rotate(Math.atan2(uy, ux)); x.fillStyle = K('#2b2b2e'); x.fillRect(-8 * s, -7 * s, 42 * s, 14 * s); x.fillStyle = K('#f6e7a8'); x.fillRect(32 * s, -8 * s, 6 * s, 16 * s); x.restore();
      if (a.den !== false && !dark) { const tip = [hand.Hd[0] + ux * 38 * s, hand.Hd[1] + uy * 38 * s], L2 = 900 * s, a0 = Math.atan2(uy, ux), spd = .3;
        const g = x.createRadialGradient(tip[0], tip[1], 8, tip[0], tip[1], L2); g.addColorStop(0, 'rgba(255,240,190,.5)'); g.addColorStop(1, 'rgba(255,240,190,0)');
        x.save(); x.globalCompositeOperation = 'lighter'; x.fillStyle = g; x.beginPath(); x.moveTo(...tip); x.arc(tip[0], tip[1], L2, a0 - spd, a0 + spd); x.closePath(); x.fill(); x.restore(); } }); }
    const prop = a.cam || ve.cam;
    if (hand && prop === 'giao') push(hand.z + .6, () => {                         // a long spear held upright (guards)
      const b0 = hand.Hd; x.strokeStyle = K('#6a4a2a'); x.lineWidth = 7 * s; x.lineCap = 'round'; x.beginPath(); x.moveTo(b0[0] + 26 * s, b0[1] + 170 * s); x.lineTo(b0[0] + 26 * s, b0[1] - 430 * s); x.stroke();
      x.fillStyle = K('#c9ccd0'); x.beginPath(); x.moveTo(b0[0] + 14 * s, b0[1] - 425 * s); x.lineTo(b0[0] + 26 * s, b0[1] - 495 * s); x.lineTo(b0[0] + 38 * s, b0[1] - 425 * s); x.closePath(); x.fill();
      x.fillStyle = K('#c8321f'); x.beginPath(); x.moveTo(b0[0] + 22 * s, b0[1] - 420 * s); x.lineTo(b0[0] + 2 * s, b0[1] - 392 * s); x.lineTo(b0[0] + 30 * s, b0[1] - 402 * s); x.fill(); });
    if (hand && prop === 'hoa-hong') push(hand.z + .6, () => {                     // a rose held upright in the near hand
      const b0 = hand.Hd, tip = [b0[0] + 8 * s, b0[1] - 120 * s];
      x.strokeStyle = K('#3f7a35'); x.lineWidth = 5 * s; x.lineCap = 'round'; x.beginPath(); x.moveTo(b0[0], b0[1] + 18 * s); x.quadraticCurveTo(b0[0] - 10 * s, b0[1] - 60 * s, tip[0], tip[1]); x.stroke();
      x.fillStyle = K('#4c8f3f'); x.beginPath(); x.ellipse(b0[0] - 16 * s, b0[1] - 52 * s, 16 * s, 7 * s, -.6, 0, 7); x.fill();
      x.fillStyle = K('#c8202a'); x.beginPath(); x.arc(tip[0], tip[1] - 14 * s, 22 * s, 0, 7); x.fill();
      x.fillStyle = K('#e0353d'); x.beginPath(); x.ellipse(tip[0] - 5 * s, tip[1] - 22 * s, 13 * s, 10 * s, .3, 0, 7); x.fill();
      x.strokeStyle = K('#8e121a'); x.lineWidth = 2.5 * s; x.beginPath(); for (let a2 = 0; a2 < 11; a2 += .35) { const rad = 17 * s * (1 - a2 / 12); x.lineTo(tip[0] + Math.cos(a2) * rad, tip[1] - 14 * s + Math.sin(a2) * rad * .85); } x.stroke(); });
    items.sort((p, q2) => p.z - q2.z); for (const it of items) it.fn();
    return { head: [Hc[0], Hc[1]], hand: hand ? hand.Hd : null };
  }
  // a point on the head sphere (yaw φ from the face, elevation ψ) → screen [x, y, depth]
  function sph(phi, psi, J, th, r, Hc) {
    let f = Math.cos(psi) * Math.cos(phi), l = Math.cos(psi) * Math.sin(phi), u = Math.sin(psi);
    const qh = J.qh, f2 = f * Math.cos(qh) + u * Math.sin(qh), u2 = -f * Math.sin(qh) + u * Math.cos(qh);   // nod: + pitches the face down
    const X = f2 * Math.sin(th) + l * Math.cos(th), Z = f2 * Math.cos(th) - l * Math.sin(th), ro = J.roll || 0;
    const xr = X * Math.cos(ro) + u2 * Math.sin(ro), yr = -u2 * Math.cos(ro) + X * Math.sin(ro);
    return [Hc[0] + xr * r, Hc[1] + yr * r, Z];
  }
  // region of the head above a line of elevation ψ(φ) (hairline / cap rim), closed over the top of the silhouette
  function capPath(x, J, th, r, Hc, line, grow = 1.06) {
    const N = 64, pts = [];
    for (let i = 0; i < N; i++) { const phi = -PI + 2 * PI * i / N, p = sph(phi, line(phi), J, th, r, Hc); pts.push(p); }
    let start = -1; for (let i = 0; i < N; i++) if (pts[i][2] >= 0 && pts[(i - 1 + N) % N][2] < 0) start = i;
    x.beginPath();
    if (start < 0) { const vis = pts[0][2] >= 0; if (vis) { pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); } return vis || isTopVisible(J, th, line); }
    const run = []; for (let k = 0; k < N; k++) { const p = pts[(start + k) % N]; if (p[2] < 0) break; run.push(p); }
    run.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]));
    const a0 = Math.atan2(run[run.length - 1][1] - Hc[1], run[run.length - 1][0] - Hc[0]), a1 = Math.atan2(run[0][1] - Hc[1], run[0][0] - Hc[0]);
    const cr = sph(0, PI / 2, J, th, r, Hc), up = Math.hypot(cr[0] - Hc[0], cr[1] - Hc[1]) > r * .25 ? Math.atan2(cr[1] - Hc[1], cr[0] - Hc[0]) : -PI / 2, norm = v => ((v % (2 * PI)) + 2 * PI) % (2 * PI), cw = norm(a1 - a0), passCW = norm(up - a0) <= cw;   // go the way that passes over the top
    x.arc(Hc[0], Hc[1], r * grow, a0, passCW ? a0 + cw : a0 - (2 * PI - cw), !passCW); x.closePath(); return true;
  }
  const isTopVisible = () => false;
  // second LOOK on the same skeleton + clips: stick figure (ve.kieu: 'que', ve.mau line colour, ve.da face fill). Proves the motion library is look-independent.
  // ---------------- cut-out characters: a drawn parts sheet pinned to the same skeleton (ve.kieu: 'anh', ve.bo: '<folder>/rig.json') ----------------
  // rig.json (tools/tachmanh.py + a per-character rig script): { ti_le_anh: K, rig: {bone lengths}, manh: { name: { anh, goc: pivot px, ngon: tip px } },
  //   mat: { goc: eyes on the head image, mieng: mouth, co_mat, co_mieng, co_kinh, nen_x }, bieu_cam: {expr → eye set}, mieng: {viseme → mouth}, mieng_bieu_cam }
  const CUT = {};
  async function loadCutout(url) {
    if (CUT[url]) return CUT[url];
    const spec = await (await fetch(url)).json(), dir = url.replace(/[^/]*$/, ''), img = {}, flip = {};
    await Promise.all(Object.entries(spec.manh).map(([k, p]) => new Promise(res => { const im = new Image(); im.onload = () => {
      img[k] = im; const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.translate(im.width, 0); g.scale(-1, 1); g.drawImage(im, 0, 0); flip[k] = c; res(); };
      im.onerror = res; im.src = dir + p.anh; })));
    return (CUT[url] = { ...spec, img, flip });
  }
  async function loadCast(cast) { for (const v of Object.values(cast || {})) { const ve = v.ve || v; if (ve.kieu !== 'anh') continue;
      if (ve.xuong && ve.xuong.mat_anh && MS.xuong) { MS.xuong.IMGS = MS.xuong.IMGS || {}; const u = ve.xuong.mat_anh;           // photo face: preload
        if (!MS.xuong.IMGS[u]) MS.xuong.IMGS[u] = await new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = u; }); }
      if (ve.xuong && MS.xuong) { const key = 'xuong:' + JSON.stringify(ve.xuong), mk = sp => ({ ...MS.xuong.build(sp), kinh_lat: false });   // character studio: drawn in code
        if (!CUT[key]) { CUT[key] = mk(ve.xuong); ve.bo = key;
          if (MS.giaiphau && CUT[key].giaiphau) { const rep = MS.giaiphau.dungVaKiem(ve, mk); CUT[key].kiem_dinh = rep;                    // QA: joints covered in every test pose, auto-fixed
            for (const n of CUT[key].giaiphau.notes) console.warn('[character] ' + n);
            if (!rep.ok) console.warn('[character ' + (ve.xuong.hinh_the || ve.xuong.ten || '') + '] joints still open after ' + rep.sua + ' repair passes: ' + rep.loi.slice(0, 4).map(l => l.tu_the + ' ' + l.khop + ' ' + l.phu).join(' · ')); } }
        ve.bo = key; }
      else if (ve.bo) await loadCutout(ve.bo); } }
  function drawCutout(x, a, J, at, sec, look, tg) {
    const ve = a.ve, C = CUT[ve.bo], s = a.s, sq = sec.sq, K0 = C.ti_le_anh * s;
    // oblique projection matched to the artwork's view: forward/back motion at full screen size (strides match root motion, no foot slide),
    // left/right body width kept wide (the parts are drawn near-front), mirrored by facing. depth = toward camera on the near side.
    const fb = Math.sin(J.thC) >= 0 ? 1 : -1, fh = Math.sin(J.thD) >= 0 ? 1 : -1, CL = C.rong_ngang ?? .9;
    // multi-view bodies (than_huong from xp ve-lai rig): projection coefficients interpolated on the body yaw (smooth turn), torso / shorts / shoes art = nearest view
    const TH = C.than_huong ? (() => { const y = Math.abs(Math.atan2(Math.sin(J.thC), Math.cos(J.thC))), L = C.than_huong; let i = 0; while (i < L.length - 2 && y > L[i + 1].yaw) i++;
      const A = L[i], B = L[i + 1], u = clamp((y - A.yaw) / (B.yaw - A.yaw)), nv = L.reduce((b, v) => Math.abs((v.chon ?? v.yaw) - y) < Math.abs((b.chon ?? b.yaw) - y) ? v : b);
      const fl = nv.yaw < .5 || nv.yaw > 2.6, m = (k) => fl ? nv[k] : lerp(A[k], B[k], u);   // front / back art: its own projection (art and limbs agree); 3/4 ↔ profile: blended
      return { y, cf: m('cf'), cl: m('cl'), vai: m('vai'), hau: nv.hau, vy: nv.yaw, giay: nv.giay, sk: Math.min(1, Math.sin(y) / .813) }; })() : null;
    const bn = nm => TH && TH.hau && C.manh[nm + '@' + TH.hau] ? nm + '@' + TH.hau : nm, TF = TH && TH.vy < .5, TB = TH && TH.vy > 2.6;
    const WdX = (p, ox = 0) => { const X = TH ? fb * (p[0] * TH.cf + p[2] * TH.cl + ox) : fb * (p[0] + p[2] * CL), Y = -p[1];
      return [at.x + X * s - X * s * sq * .5, at.y + Y * s * (1 - sq), TH ? p[0] * Math.cos(TH.y) - p[2] * TH.sk : -p[2]]; };
    const Wd = p => WdX(p);   // the whole body mirrors with the art: R side = back side, always nearer
    let LY = 'img'; const imOf = (name, side) => LY === 'img' ? (side > 0 ? C.img[name] : C.flip[name]) : ((C[side > 0 ? LY : LY + 'F'] || {})[name]);   // layer: art | rf (full outline) | rm (root-masked outline)
    const pin = (name, side) => { const p = C.manh[name], im = imOf(name, side), w = im.width;
      return { p, im, g: side > 0 ? p.goc : [w - p.goc[0], p.goc[1]], n: p.ngon ? (side > 0 ? p.ngon : [w - p.ngon[0], p.ngon[1]]) : null }; };
    const place = (name, A, B, side, dim) => { if (!imOf(name, side)) return; const { p, im, g, n } = pin(name, side), ai = Math.atan2(n[1] - g[1], n[0] - g[0]), as = Math.atan2(B[1] - A[1], B[0] - A[0]);
      x.save(); if (dim) x.filter = `brightness(${dim})`; x.translate(A[0], A[1]); x.rotate(as - ai); const sc = K0 * (p.ti_le || 1); x.scale(sc, sc); x.drawImage(im, -g[0], -g[1]); x.restore(); };
    // limb STRIP (one continuous image, upper segment drawn over the lower one at the joint) bent along joint polyline [A, B, C]:
    // thin horizontal slices, each placed on its bone (stretched to the bone's on-screen length) and rotated with a smooth blend around the joint
    const warp = (name, pts, side, dim) => { const p = C.manh[name], im = imOf(name, side); if (!im) return;
      const w = im.width, h = im.height, ax = side > 0 ? p.truc_x : w - p.truc_x, [r0, r1, r2] = p.hang, band = 3;
      const a1 = Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]), a2 = Math.atan2(pts[2][1] - pts[1][1], pts[2][0] - pts[1][0]);
      let d = a2 - a1; while (d > PI) d -= 2 * PI; while (d < -PI) d += 2 * PI;
      const f1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) / ((r1 - r0) * K0), f2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]) / ((r2 - r1) * K0), win = Math.min(r1 - r0, r2 - r1) * .36;
      x.save(); if (dim) x.filter = `brightness(${dim})`;
      for (let y = 0; y < h; y += band) { const yc = y + band / 2, up = yc <= r1, f = up ? f1 : f2, u = up ? (yc - r0) * K0 * f1 : (yc - r1) * K0 * f2, base = up ? pts[0] : pts[1], ag = up ? a1 : a2;
        const ang = a1 + d * sstep((yc - (r1 - win)) / (2 * win));
        x.save(); x.translate(base[0] + Math.cos(ag) * u, base[1] + Math.sin(ag) * u); x.rotate(ang - PI / 2); x.scale(K0, K0 * f); x.drawImage(im, 0, y, w, band + 3, -ax, -band / 2, w, band + 3); x.restore(); }   // slices overlap 3 px: no seam stripes on bent limbs
      x.restore(); };
    x.fillStyle = 'rgba(0,0,0,.2)'; x.beginPath(); x.ellipse(at.x, at.y + 2, 80 * s, 12 * s, 0, 0, 7); x.fill();
    const items = [], push = (z, f, b) => items.push({ z, f, b });   // b: body part (gets the seamless outline treatment)
    // stool for sitting clips (cut-outs return before the flat-look stool): seat just under the hips, behind the legs
    if (a.sitting && a.ghe !== false && C.tay_truoc) { const top = at.y - (CLIPS.ngoi.keys[0][1].hh * LSh - 14) * s, w = (R.hipW * 2 + R.T * .7) * s, sx = at.x - fb * R.T * .12 * s;
      push(17, () => { x.fillStyle = '#6a4a32'; x.strokeStyle = '#2a1a10'; x.lineWidth = 3 * s; x.beginPath(); x.roundRect(sx - w / 2, top, w, 12 * s, 4 * s); x.fill(); x.stroke();
        x.fillStyle = '#54392a'; for (const k of [-.36, .28]) { x.beginPath(); x.rect(sx + k * w - 5 * s, top + 12 * s, 10 * s, at.y - top - 12 * s); x.fill(); x.stroke(); } }); }
    const wlk = clamp(J.P.wl || 0), latK = 1 - .62 * wlk * (TH ? TH.sk : 1);       // walking: the legs swing in a 3/4 plane under the near-front torso (front / back views keep them apart)
    for (const sd of ['R', 'L']) { const L = J.leg[sd], lat = (sd === 'R' ? -1 : 1) * R.hipW * latK, fd = [Math.sin(L.fp), -Math.cos(L.fp)];
      const hipJ = Wd([J.hip[0], J.hip[1], lat], J.thH), kn = Wd([L.kn[0], L.kn[1], lat], J.thH), an = Wd([L.an[0], L.an[1], lat], J.thH), toe = Wd([L.an[0] + fd[0] * R.foot, L.an[1] + fd[1] * R.foot, lat], J.thH);
      const z = kn[2], dim = z < (TH ? -6 : 0) ? .84 : 0;
      // front / back views: the shoe is seen toe-on / heel-on (its own art, kept level)
      const shoe = () => TH && TH.giay && C.manh[TH.giay] && (TF || TB) ? place(TH.giay, an, [an[0] + fb, an[1]], fb, dim) : place('giay', an, toe, fb, dim);
      push(18.5 + z * .001, () => { if (C.manh.chan) warp('chan', [hipJ, kn, an], fb, dim); else { place('dui', hipJ, kn, fb, dim); place('cang_chan', kn, an, fb, dim); } shoe(); }, 1); }   // legs over the shorts waist, under the jacket
    const S = J.S.map((p, k) => Wd(p, lerp(J.thH, J.thC, k / 3)));
    push(19, () => place(bn('quan'), S[0], S[1], fb), 1);                               // shorts waist + crotch over the leg tops, under the jacket
    push(20, () => { if (C.manh.than && C.manh.than.kieu === 'day') warp('than', [S[3], S[1], S[0]], fb); else place(bn('than'), S[0], S[3], fb); }, 1);   // torso bends with the spine (waist) instead of a rigid board
    // tay_truoc cut-outs: the arm the clips author as NEAR (aN*, played on L) is the one drawn in front — the main action (wave, point, punch) stays visible
    const nearS = C.tay_truoc ? 'L' : 'R'; let hand = null; const hands = {};
    const dep = wlk * (J.E.c.tren || J.E.c.tay ? 0 : .42), sq3 = (p, o, k) => k < .999 ? [o[0] + (p[0] - o[0]) * k, p[1], p[2]] : p;   // walk arm swing: part of the forward/back travel goes into depth
    const kfOf = A => { const rch = Math.hypot(A.Wr[0] - A.Sh[0], A.Wr[1] - A.Sh[1], A.Wr[2] - A.Sh[2]) / (R.up + R.fore); return Math.min(1 - dep, lerp(.5, 1, sstep((rch - .7) / .24))); };   // folded arm → forward shown as depth
    for (const sd of ['R', 'L']) { const A = J.arm[sd]; if (!A) continue; const kf = kfOf(A), ox = TH ? (sd === 'R' ? -1 : 1) * TH.vai - TH.cl * A.Sh[2] : 0, Sh = WdX(A.Sh, ox), El = WdX(sq3(A.El, A.Sh, kf), ox), Wr = WdX(sq3(A.Wr, A.Sh, kf), ox), q3 = J.q3, fwd = p => (p[0] - A.Sh[0]) * Math.cos(q3) - (p[1] - A.Sh[1]) * Math.sin(q3), aL = R.up + R.fore,
        cross = (sd === 'R' ? -1 : 1) * A.Wr[2] < -R.shW * .3, front = Math.max(fwd(A.El), fwd(A.Wr)) > aL * .22 || cross, face = J.E.c.mat && front && fwd(A.Wr) > aL * .15 && A.Wr[1] > J.Nk[1] - R.neck,
        // body views: front = both arms hang over the shirt edges (a hand at the face in front of it); back = arms beside the back, anything reaching forward is hidden by the body
        z = TF ? (face ? 31 : 24) + (sd === nearS ? .1 : 0) : TB ? (front ? 19.2 : 24) + (sd === nearS ? .1 : 0)
          : C.tay_truoc ? (sd === nearS ? (face || A.Wr[1] > J.Nk[1] ? 30.6 : front ? 24.1 : 20.6) : face ? 31 : front ? 19.9 : 18)   // wide-shirt cut-outs (tay_truoc): near arm in front of torso, raised above the neck = in front of the big head; far arm forward = behind the torso (only what passes its front edge shows), at rest = hidden behind torso + shorts
          : face ? 31 + (sd === nearS ? .1 : 0) : front ? 24 + (sd === nearS ? .1 : 0) : sd === nearS ? (C.rf ? 20.6 : 19.7) : 19.6;   // 3/4: the near arm hangs IN FRONT of the torso side, the far arm behind it   // arms reaching forward / across the chest come in front of the torso (hands at the face: in front of it)   // sleeves tuck under the jacket shoulders; a hand crossing the body comes in front   // a raised near arm goes behind the big head
      if (sd === nearS) hand = { Hd: Wr, El, z }; hands[sd] = { Hd: Wr, El, z };
      push(z, () => { const arm = C.manh['tay_' + sd] ? 'tay_' + sd : 'tay'; if (C.manh[arm]) { warp(arm, [Sh, El, Wr], fb, z < 0 ? .84 : 0); const hp = A.k > .5 ? 'chi' : A.g > .5 ? 'nam' : A.o > .5 ? 'xoe' : 'tha', hn = 'ban_tay_' + hp + '_' + sd;   // posable hand piece
        if (C.manh[hn]) place(hn, Wr, [Wr[0] + (Wr[0] - El[0]), Wr[1] + (Wr[1] - El[1])], sd === 'R' ? fb : -fb, z < 0 ? .84 : 0); return; } place('tay_tren', Sh, El, fb, z < 0 ? .84 : 0); if (A.g > .5 && C.img.nam_tay) place('nam_tay', Wr, [Wr[0] + (Wr[0] - El[0]), Wr[1] + (Wr[1] - El[1])], fb, z < 0 ? .84 : 0); else place('cang_tay', El, Wr, fb, z < 0 ? .84 : 0); }, 1); }   // hands: both thumbs on the body's front side, so a raised hand keeps the thumb / index on top (the L art is drawn thumb-left)
    const propK = J.E.c.prop || a.cam || ve.cam, hr0 = (R.headR || 38) * s, hp = C.tay_truoc ? (R.hand || 22) * s * 2.3 : hr0;   // props sized by the hand on big-head cut-outs (chibi head ≠ phone size)
    if (hand && !TB && (propK === 'dt' || propK === 'hop')) { const Hf = hands.L || hand, both = Math.hypot(hand.Hd[0] - Hf.Hd[0], hand.Hd[1] - Hf.Hd[1]) < hp * 2.6, hold = Hf.Hd[1] < hand.Hd[1] ? Hf : hand;   // phone / box held in the hands (one hand: the raised one)
      const px = both ? (hand.Hd[0] + Hf.Hd[0]) / 2 : hold.Hd[0], py = (both ? (hand.Hd[1] + Hf.Hd[1]) / 2 : hold.Hd[1]) - hp * .25;
      if (propK === 'dt') {
        // the phone faces the EYES: screen toward the face, its plane square to the gaze. Side / 3-4 views show the back + edge with a thin lit screen rim; a front view shows the back.
        const hc = Wd(J.Hc, J.thD), side = Math.abs(Math.sin(J.thC)) > .45, ex = hc[0] + fb * hr0 * .45, ey = hc[1] + hr0 * .05;
        const PL = hp * 1.56, PW = hp * .84, ga = Math.atan2(ey - py, ex - px), PD = Math.hypot(ex - px, ey - py), th = hp * .22;
        push((both ? Math.max(hand.z, Hf.z) : hold.z) + .7, () => { x.save(); x.translate(px, py);
          if (side) {   // held up at 45°: top end toward the upper corner the character faces, screen toward the face (a slice of the lit screen shows in 3/4)
            if (C.tay_truoc) x.translate(fb * PL * .22, -PL * .05);   // short chibi arms: hold it a little out in front of the chin
            x.rotate(fb * PI / 4); x.translate(0, -PL * .2); const w = PW * .62, sg = -fb;
            x.fillStyle = '#15161b'; x.beginPath(); x.roundRect(-w / 2, -PL / 2, w, PL, w * .22); x.fill();
            const sx0 = sg < 0 ? -w / 2 + w * .1 : -w / 2 + w * .32, sw = w * .58, gr = x.createLinearGradient(0, -PL / 2, 0, PL / 2); gr.addColorStop(0, '#e8f3ff'); gr.addColorStop(1, '#a9c8f5');
            x.fillStyle = gr; x.beginPath(); x.roundRect(sx0, -PL / 2 + w * .14, sw, PL - w * .28, w * .1); x.fill();
            x.fillStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.roundRect(sx0 + sw * .12, -PL / 2 + w * .3, sw * .5, PL * .08, 2); x.fill(); x.roundRect(sx0 + sw * .12, -PL / 2 + w * .3 + PL * .13, sw * .7, PL * .05, 2); x.fill(); }
          else { x.rotate(-.08 * fb); x.fillStyle = '#15161b'; x.beginPath(); x.roundRect(-PW / 2, -PL / 2, PW, PL, hp * .14); x.fill();
            x.fillStyle = '#3a3d48'; x.beginPath(); x.arc(-PW * .24, -PL * .36, hp * .08, 0, 7); x.fill(); }
          x.restore(); });
        if (!TB) push(30.6, () => { x.save(); x.globalCompositeOperation = 'screen';
          const q = x.createRadialGradient(ex, ey, 0, ex, ey, hr0 * .75); q.addColorStop(0, 'rgba(120,170,255,.22)'); q.addColorStop(1, 'rgba(120,170,255,0)'); x.fillStyle = q; x.fillRect(ex - hr0, ey - hr0, hr0 * 2, hr0 * 2);
          if (side) { x.translate(px, py); x.rotate(ga); const g2 = x.createLinearGradient(0, 0, PD, 0); g2.addColorStop(0, 'rgba(150,195,255,.22)'); g2.addColorStop(1, 'rgba(150,195,255,0)');
            x.fillStyle = g2; x.beginPath(); x.moveTo(th * .5, -PL * .42); x.lineTo(PD, -hr0 * .32); x.lineTo(PD, hr0 * .32); x.lineTo(th * .5, PL * .42); x.closePath(); x.fill(); }
          x.restore(); }); }
      else { const bx = (hand.Hd[0] + Hf.Hd[0]) / 2 - fb * hp * .45, by = (hand.Hd[1] + Hf.Hd[1]) / 2 - hp * .5;   // box: held against the chest, forearms tucked under it (box drawn over the hands)
        push(Math.max(hand.z, Hf.z) + .7, () => { x.save(); x.translate(bx, by + hp * .15); x.fillStyle = '#c89a62'; x.fillRect(-hp * 1.3, -hp * .9, hp * 2.6, hp * 1.8); x.fillStyle = '#a87a46'; x.fillRect(-hp * 1.3, -hp * .9, hp * 2.6, hp * .3);
          x.fillStyle = 'rgba(240,230,200,.8)'; x.fillRect(-hp * .2, -hp * .9, hp * .4, hp * 1.8); x.restore(); }); } }
    if (hand && (J.E.c.prop === 'gay' || a.cam === 'gay' || ve.cam === 'gay')) push(hand.z + .2, () => { const H0w = hand.Hd, gx = H0w[0] + (H0w[0] - hand.El[0]) * .25;   // walking cane: hand → ground
      x.strokeStyle = '#3a2414'; x.lineWidth = 9 * s; x.lineCap = 'round'; x.beginPath(); x.moveTo(H0w[0], H0w[1] - 6 * s); x.lineTo(gx, at.y); x.stroke();
      x.strokeStyle = '#7a5232'; x.lineWidth = 5.5 * s; x.stroke(); x.beginPath(); x.arc(H0w[0] - 8 * s, H0w[1] - 6 * s, 8 * s, 0, PI, true); x.stroke(); });
    // head + face (eye set by expression / blink, mouth by viseme, glasses multiplied on top)
    const Nk = Wd(J.Nk, J.thC), Hc = Wd(J.Hc, J.thD);
    push(30, () => {
      // multi-view heads (cut-outs from xp ve-lai rig): pick the drawing nearest to the head yaw (goc + hy): front / 3-4 / profile / back; each view has its own face anchors and eye / mouth set (suffix @view); the back view has no face
      const yaw = Math.abs(Math.atan2(Math.sin(J.thD), Math.cos(J.thD)));
      let V = { ten: 'dau', hau: '', mat: C.mat }; if (C.dau_huong) { let best = 9; for (const v of C.dau_huong) if (C.manh[v.ten] && Math.abs((v.chon ?? v.yaw) - yaw) < best) { best = Math.abs((v.chon ?? v.yaw) - yaw); V = v; } }
      // front / back views: a nod (X) does not spin the head in the picture plane — it stays upright (tilt Z kept), the face slides + squashes a little
      const flat = C.dau_huong && (V.yaw < .5 || V.yaw > 2.6), nk0 = clamp(J.P.nk || 0, -.7, .7);
      const { p, im, g, n } = pin(V.ten, fh), ai = Math.atan2(n[1] - g[1], n[0] - g[0]), as = flat ? -PI / 2 + (J.P.hr || 0) * fb : Math.atan2(Hc[1] - Nk[1], Hc[0] - Nk[0]), sc = K0 * (p.ti_le || 1), w = im.width;
      x.save(); x.translate(Nk[0], Nk[1]); x.rotate(as - ai); x.scale(sc, sc * (flat ? 1 - Math.abs(nk0) * .07 : 1)); x.translate(-g[0], -g[1]); x.drawImage(im, 0, 0);
      const lt = tg - (a.t0g || 0); let bc = a.bcs[0].bc; for (const b of a.bcs) if (lt >= b.t) bc = b.bc;
      const hau = V.hau ? '@' + V.hau : '', sfx = nm => nm && C.img[nm + hau] ? nm + hau : nm;
      const eyes = sfx(blinkAt(a, lt) > .5 ? 'mat_nham' : (C.bieu_cam[bc] || 'mat_binh')), vz = viseme(a.words, tg);
      const mouth = sfx(vz.o > .12 ? C.mieng[vz.w < .8 ? 'o' : vz.w > 1.1 ? 'e' : vz.o > .7 ? 'a' : 'e'] : (C.mieng_bieu_cam[bc] || C.mieng.ngam));
      // pitch (X): eyes and mouth slide down on the face when the head nods down, up when it looks up
      const pdy = flat ? nk0 * (C.mat.cui ?? 26) : 0;
      const at2 = (anchor, name, k, nx = 1, side = fh) => { if (!C.img[name]) return; const q = pin(name, side), ax = fh > 0 ? anchor[0] : w - anchor[0];
        x.save(); x.translate(ax + (look ? look.eye[0] * 4 : 0), anchor[1] + pdy + (look ? look.eye[1] * 3 : 0)); x.scale(k * nx, k); x.drawImage(q.im, -q.g[0], -q.g[1]); x.restore(); };
      const M = V.mat ? { ...C.mat, ...V.mat } : null;
      if (M) { at2(M.goc, eyes, M.co_mat, M.nen_x); at2(M.mieng, mouth, M.co_mieng, M.nen_x);
        if (ve.kinh !== false && C.img.kinh) { x.save(); x.globalCompositeOperation = 'multiply'; at2(M.goc, 'kinh', M.co_kinh, M.nen_x, C.kinh_lat === false ? fh : -fh); x.restore(); } }
      x.restore(); });
    items.sort((p, q) => p.z - q.z); if (C.rf) { LY = 'rf'; for (const it of items) if (it.b) it.f(); }   // one continuous silhouette line under all body fills
    for (const it of items) { if (it.b && C.rm) { LY = 'rm'; it.f(); } LY = 'img'; it.f(); }
    return { head: [Hc[0], Hc[1]], hand: hand ? hand.Hd : null, hands: { R: hands.R && hands.R.Hd, L: hands.L && hands.L.Hd } };
  }
  function drawStick(x, a, J, at, sec, look, tg) {
    const ve = a.ve || {}, s = a.s, col = ve.mau || '#1d1d1f', lw = (ve.net || 11) * s * Math.sqrt(R.W), sq = sec.sq;
    const Wd = (p, th) => { const q = world(a, J, p, th, at); return [q[0] - (q[0] - at.x) * sq * .5, at.y + (q[1] - at.y) * (1 - sq), q[2]]; };
    const line = (pts, c, w) => { x.strokeStyle = c; x.lineWidth = w; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke(); };
    x.fillStyle = 'rgba(0,0,0,.18)'; x.beginPath(); x.ellipse(at.x, at.y + 2, 55 * s, 9 * s, 0, 0, 7); x.fill();
    const items = [];
    if (a.sitting && a.ghe !== false) { const top = at.y - (CLIPS.ngoi.keys[0][1].hh * LS - 22) * s, sx = at.x; items.push({ z: -200, f: () => { line([[sx - 40 * s, top], [sx + 40 * s, top]], col, lw * .8); line([[sx - 30 * s, top], [sx - 34 * s, at.y]], col, lw * .6); line([[sx + 30 * s, top], [sx + 34 * s, at.y]], col, lw * .6); } }); }
    for (const sd of ['R', 'L']) { const L = J.leg[sd], lat = (sd === 'R' ? -1 : 1) * R.hipW, fd = [Math.sin(L.fp), -Math.cos(L.fp)];
      const pts = [Wd([J.hip[0], J.hip[1], lat * .4], J.thH), Wd([L.kn[0], L.kn[1], lat], J.thH), Wd([L.an[0], L.an[1], lat], J.thH), Wd([L.an[0] + fd[0] * R.foot * .6, L.an[1] + fd[1] * R.foot * .6 - R.ank * .6, lat], J.thH)];
      items.push({ z: pts[1][2], f: () => line(pts, pts[1][2] < 0 ? MS.u.mix(col, '#888888', .35) : col, lw) }); }
    for (const sd of ['R', 'L']) { const A = J.arm[sd]; if (!A) continue; const pts = [Wd(J.S[3], J.thC), Wd(A.El, J.thC), Wd(A.Wr, J.thC)];
      const z = Wd(A.El, J.thC)[2] + 1; items.push({ z, f: () => { line(pts, z < 0 ? MS.u.mix(col, '#888888', .35) : col, lw); x.fillStyle = z < 0 ? MS.u.mix(col, '#888888', .35) : col; x.beginPath(); x.arc(pts[2][0], pts[2][1], lw * .75, 0, 7); x.fill(); } }); }
    const spine = J.S.map((p, k) => Wd(p, lerp(J.thH, J.thC, k / 3))); spine.push(Wd(J.Nk, J.thC));
    items.push({ z: 0, f: () => line(spine, col, lw * 1.1) });
    const Hc = Wd(J.Hc, J.thD), hr = R.headR * s;
    items.push({ z: 30, f: () => { drawHead(x, a, J, Hc, hr, J.thD, { da: ve.da || '#ffffff', toc: col, mu: col }, c => c, { ...ve, toc: { kieu: 'none' }, mu: null }, look, sec, tg);
      x.strokeStyle = col; x.lineWidth = lw * .8; x.beginPath(); x.ellipse(Hc[0], Hc[1], hr, hr * 1.04, 0, 0, 7); x.stroke(); } });
    items.sort((p, q) => p.z - q.z).forEach(it => it.f());
    const near = J.nl < 0 ? 'R' : 'L', A = J.arm[near];
    return { head: [Hc[0], Hc[1]], hand: A ? Wd(A.Wr, J.thC) : null };
  }
  // "dau_den" look (Ifverse-style explainer hero): big matte-black round head with a warm rim, large cream eye whites with dark pupils
  // that follow the gaze, thick cream brows that carry the emotion, a cream mouth that lip-syncs. No ears / nose / hair.
  function drawHeadDen(x, a, J, Hc, r, th, K, ve, look, tg) {
    const E = exprAt(a, tg - (a.t0g || 0)), s = a.s, cream = ve.mau_mat || '#f4ead4', ink = '#121014';
    x.fillStyle = K(ve.mau_dau || ink); x.beginPath(); x.ellipse(Hc[0], Hc[1], r, r * 1.02, J.roll || 0, 0, 7); x.fill();
    if (!a.toi_mau) { x.strokeStyle = 'rgba(255,214,150,.55)'; x.lineWidth = 2.2 * s; x.beginPath(); x.ellipse(Hc[0], Hc[1], r, r * 1.02, J.roll || 0, 0, 7); x.stroke(); }
    const tgl = tg - (a.t0g || 0), blink = blinkAt(a, tgl), gz = look ? look.eye : [0, 0];
    for (const k of [-1, 1]) {
      const e = sph(k * .38, .06, J, th, r, Hc); if (e[2] <= .05) continue; const fo = Math.sqrt(e[2]), ew = r * .27 * fo * (E.eye > 1.1 ? 1.1 : 1), eh = r * .22 * (1 - blink * .9) * (E.eye > 1.1 ? 1.22 : 1);
      x.fillStyle = K(cream); x.beginPath(); x.ellipse(e[0], e[1], ew, Math.max(eh, .8 * s), 0, 0, 7); x.fill();
      if (blink < .6) { x.save(); x.beginPath(); x.ellipse(e[0], e[1], ew, Math.max(eh, .8 * s), 0, 0, 7); x.clip(); x.fillStyle = K(ink);
        x.beginPath(); x.arc(e[0] + gz[0] * ew * .5 + k * ew * .04, e[1] + gz[1] * eh * .45 + eh * .12, r * .11, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(e[0] + gz[0] * ew * .5 + r * .05, e[1] + gz[1] * eh * .45 - r * .02, r * .035, 0, 7); x.fill(); x.restore(); }
      const acc = look ? look.brow : 0, bi = sph(k * .14, .42 + (E.bi + acc) * .09, J, th, r, Hc), bo = sph(k * .64, .42 + (E.bo + acc * .6) * .09, J, th, r, Hc);
      if (bi[2] > 0 || bo[2] > 0) { x.strokeStyle = K(cream); x.lineWidth = r * .13; x.lineCap = 'round'; x.beginPath(); x.moveTo(bi[0], bi[1]); x.lineTo(bo[0], bo[1]); x.stroke(); }
    }
    const vz = viseme(a.words, tg), op = Math.max(E.o * (vz.o > .05 ? .3 : 1), vz.o), mw = .3 * E.mw * (vz.o > .05 ? vz.w : 1), mc = sph(0, -.42, J, th, r, Hc);
    if (mc[2] > 0) { const L = sph(-mw, -.42 + E.cur * .1, J, th, r, Hc), R = sph(mw, -.42 + E.cur * .1, J, th, r, Hc), mid = sph(0, -.42 - E.cur * .1, J, th, r, Hc);
      x.lineCap = 'round';
      if (op > .1) { const bot = sph(0, -.44 - op * .26, J, th, r, Hc); x.fillStyle = K(cream); x.beginPath(); x.moveTo(L[0], L[1]); x.quadraticCurveTo(mid[0], mid[1] - 2 * s, R[0], R[1]); x.quadraticCurveTo(bot[0], bot[1] + op * 7 * s, L[0], L[1]); x.fill();
        if (op > .35 && !a.toi_mau) { x.fillStyle = K('#3a1f22'); x.beginPath(); x.ellipse(mc[0], mc[1] - op * 3 * s + op * 6 * s, Math.abs(R[0] - L[0]) * .3, op * 5 * s, 0, 0, 7); x.fill(); } }
      else { x.strokeStyle = K(cream); x.lineWidth = r * .1; x.beginPath(); x.moveTo(L[0], L[1]); x.quadraticCurveTo(mid[0], mid[1] + E.cur * 7 * s, R[0], R[1]); x.stroke(); } }
    if ((ve.mu || {}).kieu === 'luoi-trai') { const C2 = { mu: (ve.mu || {}).mau || '#c8321f' }; x.save(); x.beginPath(); x.ellipse(Hc[0], Hc[1], r * 1.1, r * 1.14, 0, 0, 7); x.clip();
      if (capPath(x, J, th, r, Hc, phi => .44 - .5 * (1 - Math.cos(phi)) / 2, 1.1)) { x.fillStyle = K(C2.mu); x.fill(); } x.restore(); }
    if ((ve.mu || {}).kieu === 'non-la') { const mc = (ve.mu || {}).mau || '#e3cf96', ap = [Hc[0], Hc[1] - r * 2.05], b0 = Hc[1] - r * .52, w = r * 1.95;   // conical hat over the black head
      x.fillStyle = K(mc); x.beginPath(); x.moveTo(Hc[0] - w, b0); x.lineTo(...ap); x.lineTo(Hc[0] + w, b0); x.quadraticCurveTo(Hc[0], b0 + r * .32, Hc[0] - w, b0); x.fill();
      x.strokeStyle = K(MS.u.mix(mc, '#000000', .2)); x.lineWidth = 2.2 * s; for (const k of [.35, .65]) { x.beginPath(); x.moveTo(lerp(ap[0], Hc[0] - w, k), lerp(ap[1], b0, k)); x.quadraticCurveTo(Hc[0], lerp(ap[1], b0 + r * .3, k), lerp(ap[0], Hc[0] + w, k), lerp(ap[1], b0, k)); x.stroke(); } }
    if ((ve.mu || {}).kieu === 'vu-tru') { const R2 = r * 1.5; x.fillStyle = 'rgba(170,215,255,.16)'; x.beginPath(); x.arc(Hc[0], Hc[1] + r * .1, R2, 0, 7); x.fill();   // astronaut glass helmet
      x.strokeStyle = a.toi_mau ? `rgba(160,175,195,${.85 - a.toi_mau * .4})` : 'rgba(230,240,255,.85)'; x.lineWidth = 4 * s; x.stroke(); x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 6 * s; x.lineCap = 'round'; x.beginPath(); x.arc(Hc[0], Hc[1] + r * .1, R2 * .82, -2.5, -1.9); x.stroke();
      x.fillStyle = K('#d9dde2'); x.beginPath(); x.ellipse(Hc[0], Hc[1] + r * .1 + R2 * .92, R2 * .8, R2 * .2, 0, 0, 7); x.fill(); }
    if (ve.no) { const b = sph(.55, .62, J, th, r * 1.04, Hc), bs = r * .3; x.save(); x.translate(b[0], b[1]); x.rotate(.35 + (J.roll || 0)); x.fillStyle = K(ve.no);   // hair bow (girls)
      for (const k of [-1, 1]) { x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(k * bs * 1.3, -bs * 1.1, k * bs * 1.5, 0); x.quadraticCurveTo(k * bs * 1.3, bs * 1.1, 0, 0); x.fill(); }
      x.fillStyle = K(MS.u.mix(ve.no, '#000000', .25)); x.beginPath(); x.arc(0, 0, bs * .38, 0, 7); x.fill(); x.restore(); }
  }
  function drawHead(x, a, J, Hc, r, th, C, K, ve, look, sec, tg) {
    if (ve.dau_den) return drawHeadDen(x, a, J, Hc, r, th, K, ve, look, tg);
    const E = exprAt(a, tg - (a.t0g || 0)), tk = (ve.toc || {}).kieu || 'ngan', mk = (ve.mu || {}).kieu, s = a.s;
    // bun behind?
    const bunP = sph(PI, .55, J, th, r * 1.18, Hc), bun = tk === 'bui' || tk === 'bac-bui';
    if (bun && bunP[2] < 0) { x.fillStyle = K(C.toc); x.beginPath(); x.arc(bunP[0], bunP[1], r * .42, 0, 7); x.fill(); }
    // ears + head
    for (const k of [-1, 1]) { const e = sph(k * PI / 2, .02, J, th, r * .98, Hc); if (e[2] > -.25 && e[2] < .97) { x.fillStyle = K(sh(C.da, .9)); x.beginPath(); x.ellipse(e[0], e[1], r * .2, r * .27, 0, 0, 7); x.fill(); } }
    x.fillStyle = K(C.da); x.beginPath(); x.ellipse(Hc[0], Hc[1], r * (ve.dau_rong || 1), r * 1.04, J.roll || 0, 0, 7); x.fill();
    if (ve.ma) for (const k of [-1, 1]) { const c = sph(k * .66, -.4, J, th, r, Hc); if (c[2] > -.45) { x.beginPath(); x.ellipse(c[0], c[1] + r * .06, r * .5 * (ve.ma === true ? 1 : ve.ma), r * .44 * (ve.ma === true ? 1 : ve.ma), 0, 0, 7); x.fill(); } }   // puffy cheeks
    const nose = sph(0, -.12, J, th, r * 1.07, Hc); if (nose[2] > -.1) { x.beginPath(); x.arc(nose[0], nose[1], r * .13, 0, 7); x.fill(); }
    // face
    const tgl = tg - (a.t0g || 0), blink = blinkAt(a, tgl), gz = look ? look.eye : [0, 0];
    for (const k of [-1, 1]) {
      const e = sph(k * .42, .06, J, th, r, Hc); if (e[2] <= .05) continue; const fo = Math.sqrt(e[2]), es = 4.7 * E.eye * s;
      x.fillStyle = K('#1d1714'); const ex = e[0] + gz[0] * 1.8 * s, ey = e[1] + gz[1] * 1.6 * s;
      if (ve.kinh === 'den') {} else if (blink > .5) { x.fillRect(ex - es * fo, ey - 1.2 * s, es * 2 * fo, 2.4 * s); }
      else { x.beginPath(); x.ellipse(ex, ey, es * fo, es * 1.12 * (1 - blink * .8), 0, 0, 7); x.fill(); if (!a.toi_mau) { x.fillStyle = 'rgba(255,255,255,.75)'; x.beginPath(); x.arc(ex + es * .35 * fo, ey - es * .4, es * .28, 0, 7); x.fill(); } }
      const acc = look ? look.brow : 0, bi = sph(k * .17, .3 + (E.bi + acc) * .085, J, th, r, Hc), bo = sph(k * .68, .3 + (E.bo + acc * .6) * .085, J, th, r, Hc);
      if (bi[2] > 0 || bo[2] > 0) { x.strokeStyle = K(tk === 'bac-bui' ? '#8a8580' : sh(C.toc, .9)); x.lineWidth = 3.8 * s * (ve.may === 'day' ? 3.2 : 1); x.lineCap = 'round'; x.beginPath(); x.moveTo(bi[0], bi[1]);
        if (ve.may === 'day') { const mid = sph(k * .42, .4 + (E.bi + E.bo) * .04 + acc * .06, J, th, r, Hc); x.quadraticCurveTo(mid[0], mid[1] - 6 * s, bo[0], bo[1]); } else x.lineTo(bo[0], bo[1]); x.stroke(); }
    }
    if (ve.kinh === 'den') {                                                        // dark sunglasses: two lenses + bridge + arm towards the ear
      const Ls = [-1, 1].map(k => sph(k * .4, .04, J, th, r, Hc)), vis = Ls.filter(e => e[2] > -.05);
      x.fillStyle = K('#141416'); x.strokeStyle = K('#141416'); x.lineWidth = 3.5 * s;
      for (const e of vis) { const fo = Math.sqrt(Math.max(.05, e[2])); x.beginPath(); x.ellipse(e[0], e[1], r * .36 * fo, r * .25, 0, 0, 7); x.fill();
        if (!a.toi_mau) { x.fillStyle = 'rgba(255,255,255,.25)'; x.beginPath(); x.ellipse(e[0] - r * .1 * fo, e[1] - r * .08, r * .1 * fo, r * .05, -.5, 0, 7); x.fill(); x.fillStyle = K('#141416'); } }
      if (vis.length === 2) { x.beginPath(); x.moveTo(Ls[0][0], Ls[0][1] - r * .05); x.lineTo(Ls[1][0], Ls[1][1] - r * .05); x.stroke(); }
      for (const k of [-1, 1]) { const ear = sph(k * 1.45, .04, J, th, r, Hc), ln = sph(k * .7, .04, J, th, r, Hc); if (ear[2] > -.2 && ln[2] > -.1) { x.beginPath(); x.moveTo(ln[0], ln[1]); x.lineTo(ear[0], ear[1]); x.stroke(); } }
    }
    if (ve.kinh === true) { x.strokeStyle = K('#222'); x.lineWidth = 2.5 * s; for (const k of [-1, 1]) { const e = sph(k * .42, .06, J, th, r, Hc); if (e[2] > .05) { x.beginPath(); x.ellipse(e[0], e[1], 10 * s * Math.sqrt(e[2]), 10 * s, 0, 0, 7); x.stroke(); } } }
    // mouth: expression + viseme
    const vz = viseme(a.words, tg), op = Math.max(E.o * (vz.o > .05 ? .3 : 1), vz.o), mw = .27 * E.mw * (vz.o > .05 ? vz.w : 1);
    const mc = sph(0, -.47, J, th, r, Hc);
    if (mc[2] > 0) { const L = sph(-mw, -.47 + E.cur * .1, J, th, r, Hc), Rr = sph(mw, -.47 + E.cur * .1, J, th, r, Hc), mid = sph(0, -.47 - E.cur * .08, J, th, r, Hc);
      x.fillStyle = K('#3a1f1a'); x.strokeStyle = K('#3a1f1a'); x.lineWidth = 3 * s; x.lineCap = 'round';
      if (op > .1) { const top = sph(0, -.43 + op * .02, J, th, r, Hc), bot = sph(0, -.47 - op * .26, J, th, r, Hc);
        x.beginPath(); x.moveTo(L[0], L[1]); x.quadraticCurveTo(top[0], top[1] - 2 * s, Rr[0], Rr[1]); x.quadraticCurveTo(bot[0], bot[1] + op * 6 * s, L[0], L[1]); x.fill();
        if (op > .4 && !a.toi_mau) { x.fillStyle = K('#c75b55'); x.beginPath(); x.ellipse(bot[0], bot[1] - 2 * s, 5 * s * Math.sqrt(mc[2]), 3 * s, 0, 0, 7); x.fill(); } }
      else { x.beginPath(); x.moveTo(L[0], L[1]); x.quadraticCurveTo(mid[0], mid[1] + E.cur * 6 * s, Rr[0], Rr[1]); x.stroke(); } }
    if (ve.rau === 'ram') { x.fillStyle = K(C.toc); x.save(); x.beginPath(); x.ellipse(Hc[0], Hc[1], r * 1.02, r * 1.06, 0, 0, 7); x.clip();
      const top = phi => -.32 + .1 * Math.cos(phi); x.beginPath(); for (let i = 0; i <= 24; i++) { const p = sph(-1.5 + 3 * i / 24, top(-1.5 + 3 * i / 24), J, th, r, Hc); i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]); }
      for (let i = 24; i >= 0; i--) { const p = sph(-1.5 + 3 * i / 24, -1.2, J, th, r, Hc); x.lineTo(p[0], p[1]); } x.closePath(); x.fill(); x.restore();
      const mL = sph(-mw * 1.1, -.47, J, th, r, Hc), mR = sph(mw * 1.1, -.47, J, th, r, Hc); if (mc[2] > 0 && op > .1) { x.fillStyle = K('#3a1f1a'); x.beginPath(); x.ellipse(mc[0], mc[1] + op * 5 * s, Math.abs(mR[0] - mL[0]) * .4, (3 + op * 7) * s, 0, 0, 7); x.fill(); } }
    // hair cap (not under a cap / conical hat: only the sides show)
    if (tk !== 'none') {
      const front = (ve.toc || {}).tran ?? (mk === 'luoi-trai' ? .5 : tk === 'bui' || tk === 'bac-bui' ? .5 : .42), backL = tk === 'dai' ? -.55 : -.18;
      const line = phi => { const c = (1 + Math.cos(phi)) / 2; return backL + (front - backL) * Math.pow(c, 1.6) - .1 * Math.exp(-(((Math.abs(phi) - 1.45) / .25) ** 2)); };
      x.save(); x.beginPath(); x.ellipse(Hc[0], Hc[1], r * 1.08, r * 1.12, 0, 0, 7); x.clip();
      if (capPath(x, J, th, r, Hc, line, 1.12)) { x.fillStyle = K(C.toc); x.fill(); }
      x.restore();
      if (tk === 'bui' || tk === 'bac-bui') { x.fillStyle = K(sh(C.toc, .9)); x.lineWidth = 2 * s; }
    }
    if (bun && bunP[2] >= 0) { x.fillStyle = K(C.toc); x.beginPath(); x.arc(bunP[0], bunP[1], r * .42, 0, 7); x.fill(); }
    // hats
    if (mk === 'luoi-trai') {
      x.save(); x.beginPath(); x.ellipse(Hc[0], Hc[1], r * 1.1, r * 1.14, 0, 0, 7); x.clip();
      if (capPath(x, J, th, r, Hc, phi => .44 - .5 * (1 - Math.cos(phi)) / 2, 1.1)) { x.fillStyle = K(C.mu); x.fill(); }
      x.restore();
      const rim = []; for (let i = 0; i <= 16; i++) rim.push(-1.05 + 2.1 * i / 16);
      const inner = rim.map(phi => sph(phi, .42, J, th, r, Hc)), outer = rim.map(phi => { const k = Math.cos(phi * PI / 2.1); return sph(phi * (1 - .3 * k), .42 - .2 * k, J, th, r * (1 + .72 * k), Hc); });
      const zb = sph(0, .2, J, th, r * 1.5, Hc)[2];
      x.fillStyle = K(sh(C.mu, .8)); x.beginPath(); outer.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); inner.reverse().forEach(p => x.lineTo(p[0], p[1])); x.closePath(); if (zb > -.6) { x.fill(); x.strokeStyle = x.fillStyle; x.lineWidth = 6 * s; x.lineJoin = 'round'; x.stroke(); }
    }
    if (mk === 'non-la') { const ap = [Hc[0], Hc[1] - r * 1.9], b0 = Hc[1] - r * .25; x.fillStyle = K(C.mu || '#e3cf96'); x.beginPath(); x.moveTo(Hc[0] - r * 1.9, b0); x.lineTo(...ap); x.lineTo(Hc[0] + r * 1.9, b0); x.quadraticCurveTo(Hc[0], b0 + r * .3, Hc[0] - r * 1.9, b0); x.fill();
      x.strokeStyle = K(sh(C.mu || '#e3cf96', .82)); x.lineWidth = 2 * s; for (const k of [.35, .65]) { x.beginPath(); x.moveTo(lerp(ap[0], Hc[0] - r * 1.9, k), lerp(ap[1], b0, k)); x.quadraticCurveTo(Hc[0], lerp(ap[1], b0 + r * .3, k), lerp(ap[0], Hc[0] + r * 1.9, k), lerp(ap[1], b0, k)); x.stroke(); } }
  }
  function blinkAt(a, t) {                                                       // seeded blink schedule + a blink at every turn
    let b = 0; const per = 3.1 + hash(a.pha * 3.3) * 1.4, ph = ((t + a.pha * 1.7) % per + per) % per; if (ph < .14) b = Math.sin(PI * ph / .14);
    for (const f of a.face) { const d = t - f.t; if (d > 0 && d < .16) b = Math.max(b, Math.sin(PI * d / .16)); }
    return b;
  }

  // ---------------- scene: all actors of a shot ----------------
  function scene(x, actors, t) {
    const J = actors.map(a => solve(a, t)), at = J.map(j => ({ x: j.E.pa.x, y: j.E.pa.y }));
    const byId = {}; actors.forEach((a, i) => byId[a.id] = i);
    const headW = i => { const q = pj(J[i].Hc, J[i].thD); return [at[i].x + q[0] * actors[i].s, at[i].y + q[1] * actors[i].s]; };
    const handW = (i, s) => { const A = J[i].arm[s]; const q = pj([A.Wr[0] + A.dir[0] * 10, A.Wr[1] + A.dir[1] * 10, A.Wr[2]], J[i].thC); return [at[i].x + q[0] * actors[i].s, at[i].y + q[1] * actors[i].s]; };
    const near = i => J[i].nl < 0 ? 'R' : 'L', farS = i => J[i].nl < 0 ? 'L' : 'R';
    // reach (toi): another character's hand / shoulder / head / back, or a world point; mutual hand-holding meets in the middle
    const toiAt = (a, tt) => { let v = a.toi; for (const e of a.hd) if (tt >= e.t && e.toi !== undefined) v = e.toi; return v; };
    const toiW = (a, tt) => { let w = a.toi ? 1 : 0; for (const e of a.hd) if (e.toi !== undefined && tt >= e.t) { const to = e.toi ? 1 : 0; w = lerp(w, to, sstep((tt - e.t) / .3)); } return w; };
    const jobs = [];
    const shW = (i, s) => { const q = pj(J[i].arm[s].Sh, J[i].thC); return [at[i].x + q[0] * actors[i].s, at[i].y + q[1] * actors[i].s]; };
    const meet = (i, si, j, sj) => {                                             // two hands meet: start in the middle, then alternate projections onto both reach disks
      const ha = handW(i, si), hb = handW(j, sj), A = shW(i, si), B = shW(j, sj), ra = (J[i].R.up + J[i].R.fore) * actors[i].s * .97, rb = (J[j].R.up + J[j].R.fore) * actors[j].s * .97;
      let M = [(ha[0] + hb[0]) / 2, (ha[1] + hb[1]) / 2];
      const pr = (C, r) => { const dx = M[0] - C[0], dy = M[1] - C[1], d = Math.hypot(dx, dy); if (d > r) M = [C[0] + dx / d * r, C[1] + dy / d * r]; };
      for (let k = 0; k < 6; k++) { pr(A, ra); pr(B, rb); } return M; };
    actors.forEach((a, i) => { const tv = toiAt(a, t); if (!tv) return; const w = toiW(a, t); if (w <= 0) return;
      const spec = typeof tv === 'string' ? { ai: tv } : Array.isArray(tv) ? { diem: tv } : tv, j = byId[spec.ai];
      const hands = spec.tay === 'ca-hai' ? [near(i), farS(i)] : spec.tay === 'xa' ? [farS(i)] : [near(i)];
      hands.forEach((hs, n) => { let P;
        if (spec.diem) P = spec.diem;
        else if (j != null) { const bp = spec.bo_phan || 'tay';
          if (bp === 'tay') { const ov = toiAt(actors[j], t), ot = ov && (typeof ov === 'string' ? ov : ov.ai) === a.id; const hb = handW(j, near(j)); P = ot ? meet(i, hs, j, near(j)) : hb; }
          else { const k = bp === 'dau' ? J[j].Hc : bp === 'lung' ? J[j].S[2] : shoulder(J[j], n ? farS(j) : near(j)); const q = pj(k, bp === 'dau' ? J[j].thD : J[j].thC);
            P = [at[j].x + q[0] * actors[j].s - (bp === 'lung' ? Math.sign(Math.sin(J[j].thC)) * 26 * actors[j].s : 0), at[j].y + q[1] * actors[j].s + (bp === 'vai' ? 6 : 0) * actors[j].s]; } }
        if (!P) return; if (spec.lech) P = [P[0] + spec.lech[0], P[1] + spec.lech[1]];
        jobs.push([i, hs, P, w]);
      });
    });
    for (const [i, hs, P, w] of jobs) armIK(J[i], hs, toRoot(actors[i], J[i], P[0], P[1], at[i], J[i].thC, J[i].arm[hs].Sh[2]), w);   // all targets were read before any arm moved
    // look-at: head yaw / pitch toward another character, the camera or a point; eyes lead
    const looks = actors.map((a, i) => { let v = a.nhin; for (const e of a.hd) if (t >= e.t && e.nhin !== undefined) v = e.nhin; if (!v) return null;
      const H = headW(i); let T;
      if (v === 'camera') { J[i].thD *= .3; return { eye: [0, 0], brow: 0 }; }
      if (typeof v === 'string' && byId[v] != null) T = headW(byId[v]); else if (Array.isArray(v)) T = v; else return null;
      const dx = T[0] - H[0], dy = T[1] - H[1], want = Math.sign(dx || 1) * 1.25, th = J[i].thC;
      J[i].thD = clamp(lerp(J[i].thD, want, .85), th - 1.2, th + 1.2); J[i].qh += clamp(Math.atan2(dy, Math.abs(dx) + 1) * .55, -.35, .35);
      const resid = Math.sign(dx) * clamp(Math.abs(want - J[i].thD), 0, 1); return { eye: [resid * .9 + Math.sign(dx) * .25, clamp(dy / 600, -.8, .8)], brow: 0 }; });
    // brow accents while talking
    actors.forEach((a, i) => { let b = 0; for (const g of a.gest) b = Math.max(b, env(t - g.t, .1, .4) * (g.q ? .6 : .3)); if (b) { looks[i] = looks[i] || { eye: [0, 0], brow: 0 }; looks[i].brow = b; } });
    const order = actors.map((a, i) => i).sort((p, q) => (actors[p].y ?? 0) - (actors[q].y ?? 0) || (actors[p].lop || 0) - (actors[q].lop || 0));
    const out = {};
    for (const i of order) { const a = actors[i], sec = a.lo_xo === false ? { hair: [0, 0], bag: 0, sq: 0 } : secondary(a, t);
      out[a.id] = drawActor(x, a, J[i], at[i], sec, looks[i], (a.t0g || 0) + t); out[a.id].root = at[i]; }
    return out;
  }
  const headAt = (a, t) => { const J = solve(a, t, true), q = pj(J.Hc, J.thD); return { x: J.E.pa.x + q[0] * a.s, y: J.E.pa.y + q[1] * a.s }; };
  const rootAt = (a, t) => { const p = pathAt(a, t); return { x: p.x, y: p.y }; };

  // legacy pose names → clips
  const MAP = { dung: 'dung', di: 'di', chay: 'chay', chi: 'chi', 'cam-den': 'cam-den', 'gio-tay': 'gio-tay', cui: 'cui', keo: 'keo', om: 'om', leo: 'leo', nga: 'nga', ngoi: 'ngoi', noi: 'dung' };
  function draw(x, ve, o) {                                                       // legacy: one character, o.t = local time
    const a = actor({ id: 'nv', ve, x: o.x, y: o.y, s: o.s, huong: o.huong, goc: o.goc, clip: MAP[o.tu_the] || o.tu_the || 'dung', bc: o.bieu_cam,
      hd: (o.track || []).map(e => ({ t: e.t, clip: MAP[e.tu_the] || e.tu_the || undefined, bc: e.bieu_cam })).filter(e => e.clip), words: o.words, toi_mau: o.toi, den: o.den, pha: o.pha });
    return scene(x, [a], o.t || 0).nv;
  }
  MS.nv = { loadCutout, loadCast, CUT, actor, scene, draw, rootAt, headAt, addClips, CLIPS, EXPR, MAP, DEF, H0, RIG: BASE, DANG, rigOf, solve, sample, LOCO };
  // joint screen positions at time t (pose editor handles, QA): same projection as the drawing (cut-out studio art or the stick/flat look)
  function khop(a, t) {
    const J = solve(a, t), at = { x: J.E.pa.x, y: J.E.pa.y }, C = a.ve && a.ve.kieu === 'anh' && CUT[a.ve.bo];
    const fb = Math.sin(J.thC) >= 0 ? 1 : -1, CL = C ? C.rong_ngang ?? .9 : 0;
    const W = (p, th) => C ? [at.x + fb * (p[0] + (p[2] || 0) * CL) * a.s, at.y - p[1] * a.s] : world(a, J, [p[0], p[1], p[2] || 0], th, at).slice(0, 2);
    const o = { hong: W([J.hip[0], J.hip[1], 0], J.thH), nguc: W(J.S[3], J.thC), co: W(J.Nk, J.thC), dau: W(J.Hc, J.thD), nl: J.nl, P: J.P };
    for (const s of ['R', 'L']) { const A = J.arm[s], L = J.leg[s], lat = (s === 'R' ? -1 : 1) * J.R.hipW;
      if (A) { o['vai' + s] = W(A.Sh, J.thC); o['khuyu' + s] = W(A.El, J.thC); o['cotay' + s] = W(A.Wr, J.thC); }
      o['goi' + s] = W([L.kn[0], L.kn[1], lat], J.thH); o['cochan' + s] = W([L.an[0], L.an[1], lat], J.thH); }
    return o;
  }
  Object.assign(MS.nv, { khop, EASE, bez, easeOf });
})();
