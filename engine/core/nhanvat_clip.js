// mega-shot · nhanvat_clip.js — the motion library for nhanvat.js (load right after it).
// A keyframed clip = { len, loop, keys: [[t, { channels… }], …], tren (can play over a walk), tay (hands busy: talk gestures shrink), mat (hands cover the face: drawn over it),
// ngoi (sitting: draws a stool), bc (default expression), prop, vao (blend-in seconds) }. Channels not given carry over from the
// previous key (first key: the neutral pose). Keys are joined by a spline, so put the ANTICIPATION (small opposite move), the
// STRIKE (slight overshoot) and the SETTLE as separate keys — that is what makes the motion read as alive instead of tweened.
// Angles in radians, authored for the NEAR (N) / FAR (F) side of the body (mapped to left / right by the facing at play time):
//   rot whole-body pitch (− = falls backwards) · sp spine lean (+ forward) · sb side bend · tw chest turn to camera · nk nod (+ down)
//   hr head tilt · hy head turn to camera · sh shrug · dx / dy hip shift (forward / up) · hh hip height when hf = 1 (sitting, lying)
//   a?p shoulder (0 = hanging, + forward / up, π = overhead) · a?a arm out to the side · a?e elbow · g? fist
//   l?p hip (+ forward) · l?k knee · l?f ankle · p? foot planted (IK on the ground) — ? = N | F
// Walk / run / panic run / climb are procedural (nhanvat.js `loco`, root motion from the path).
(() => {
  const nv = MS.nv, idle = t => nv.sample(nv.CLIPS.dung, t);
  const SIT = { hf: 1, hh: 128, sp: .12, lNp: 1.45, lNk: 1.45, lFp: 1.4, lFk: 1.5, aNp: .6, aNe: .85, aFp: .55, aFe: .9, nk: .05 };
  const LIE = { rot: -1.57, hf: 1, hh: 24, sp: 0, lNp: .05, lNk: .1, lFp: 0, lFk: .15, pN: 0, pF: 0, aNp: .12, aNe: .1, aFp: .1, aFe: .12, nk: -.08 };
  const FALLEN = { rot: -1.42, hf: 1, hh: 36, lNp: .8, lNk: .9, lFp: .4, lFk: .6, pN: 0, pF: 0, aNp: 2.2, aNe: .3, aFp: .6, aFe: .6, aNa: .2, aFa: .2, sp: -.05, nk: .3 };
  const STAND = { rot: 0, hf: 0, hh: nv.H0, dx: 0, dy: 0, sp: .03, nk: 0, hr: 0, sh: 0, aNp: .07, aNa: .1, aNe: .2, aFp: -.04, aFa: .1, aFe: .16, lNp: .04, lNk: .06, lFp: -.04, lFk: .05, pN: 1, pF: 1, gN: 0, gF: 0 };
  nv.addClips({
    // ---- idles ----
    dung: { loop: 1, keys: [[0, {}], [1, { dx: 3, sb: .025, hr: .03, aNp: .09, aFp: -.02, nk: .02 }], [2, { dx: 0, sb: 0, hr: 0, aNp: .07, aFp: -.04, nk: 0 }],
      [3, { dx: -3, sb: -.02, hr: -.025, aNp: .05, aFp: -.06 }], [4, { dx: 0, sb: 0, hr: 0, aNp: .07, aFp: -.04 }]] },
    'nhin-quanh': { loop: 1, tren: 1, keys: [[0, { hy: -.1 }], [.8, { hy: .55, nk: -.05 }], [1.6, { hy: .5 }], [2.4, { hy: -.45, nk: .04 }], [3.2, { hy: -.5 }], [4, { hy: -.1 }]] },
    'tho-doc': { loop: 1, bc: 'met', keys: [[0, { sp: .72, dx: -12, aNp: .8, aNe: .12, aFp: .75, aFe: .15, lNk: .35, lFk: .35, sh: .1, nk: -.1 }], [.45, { sp: .8, sh: -.04 }], [.9, { sp: .72, sh: .1 }]] },
    'run-ray': { loop: 1, tren: 1, tay: 1, bc: 'so', keys: [[0, { aNp: .5, aNe: 2.1, aNa: -.3, aFp: .45, aFe: 2.1, aFa: -.3, sh: .25, nk: .12, hr: .03, dx: 1 }], [.08, { hr: -.03, dx: -1 }], [.16, { hr: .03, dx: 1 }]] },
    'khoanh-tay': { loop: 1, tren: 1, tay: 1, keys: [[0, { aNp: .05, aNe: 1.55, aNa: -.35, aFp: .2, aFe: 1.65, aFa: -.1, sp: -.02 }], [2, { sp: 0, hr: .03 }], [4, { sp: -.02, hr: 0 }]] },   // forearms level across the chest
    'chong-nanh': { loop: 1, tren: 1, tay: 1, keys: [[0, { aNp: -.3, aNa: .8, aNe: 1.75, aFp: -.3, aFa: .8, aFe: 1.75, sp: -.05, sh: .05 }], [2, { sp: -.03, hr: .04 }], [4, { sp: -.05, hr: 0 }]] },
    'suy-nghi': { loop: 1, tren: 1, tay: 1, bc: 'nghi', keys: [[0, { aNp: .25, aNe: 2.45, aNa: -.15, aFp: .35, aFe: 1.6, aFa: -.25, nk: .08, hr: .1 }], [2, { hr: .14, nk: .1 }], [4, { hr: .1, nk: .08 }]] },
    // relaxed anime stances: weight on the far leg, hip pushed out, near knee loose, shoulders dropped (hands near the pockets) / scratching the head
    'dung-ngau': { loop: 1, keys: [[0, { dx: -5, sb: -.06, tw: .12, sp: -.03, sh: -.04, lNp: .2, lNk: .36, lFp: -.08, lFk: .02, aNp: -.16, aNa: .26, aNe: .9, aFp: -.1, aFa: .2, aFe: .75, hr: -.07, nk: -.03 }],
      [2, { sb: -.045, hr: -.045, dx: -4 }], [4, { sb: -.06, hr: -.07, dx: -5 }]] },
    'gai-dau': { loop: 1, tren: 1, tay: 1, bc: 'met', keys: [[0, { aNp: 2.55, aNa: .25, aNe: 2.25, hr: -.1, sh: .06 }], [.25, { aNe: 2.4 }], [.5, { aNe: 2.25 }]] },
    // ---- action library (after the stick-figure reference sheet): fight, work, sport, emotion, rest — hand poses g?/k?/o? = fist / point / open ----
    dam: { len: .7, vao: .08, keys: [[0, {}], [.12, { aNp: .9, aNe: 2.2, gN: 1, aFp: .8, aFe: 2.3, gF: 1, sp: .05, lNp: .25, lNk: .3, lFp: -.2, lFk: .15 }],
      [.24, { aNp: 1.55, aNe: .05, aNa: -.05, tw: .25, sp: .12, dx: 10, lNp: .35 }], [.42, { aNp: 1.5, aNe: .1 }], [.7, { aNp: .9, aNe: 2.2, tw: 0, dx: 0, sp: .05 }]] },
    'do-don': { loop: 1, keys: [[0, { aNp: .9, aNe: 2.2, gN: 1, aFp: .75, aFe: 2.35, gF: 1, lNp: .3, lNk: .35, lFp: -.25, lFk: .22, sp: .08, nk: .06, dy: 0 }], [.4, { dy: -4, lNk: .42, lFk: .3 }], [.8, { dy: 0, lNk: .35, lFk: .22 }]] },
    da: { len: 1, vao: .1, keys: [[0, {}], [.22, { lNp: .95, lNk: 1.6, pN: 0, aNa: .35, aFa: .35, gN: 1, gF: 1, sp: -.04 }], [.4, { lNp: 1.45, lNk: .05, pN: 0, sp: -.25, aNp: -.35, aFp: .7, aFe: 1.6 }],
      [.62, { lNp: 1.4, lNk: .1, pN: 0 }], [1, { lNp: .04, lNk: .06, pN: 1, sp: .03, aNp: .07, aFp: -.04, aFe: .16, aNa: .1, aFa: .1, gN: 0, gF: 0 }]] },
    'ngoi-xom': { len: .6, vao: .12, keys: [[0, {}], [.6, { lNp: 1.25, lNk: 2.3, lFp: 1.15, lFk: 2.25, sp: .45, aNp: .9, aNe: .6, aFp: .8, aFe: .7, dx: -6, nk: -.1 }]] },
    nang: { len: 1.8, vao: .1, keys: [[0, {}], [.5, { lNp: 1.15, lNk: 2.1, lFp: 1.05, lFk: 2.0, sp: .55, aNp: .55, aNe: .15, aFp: .5, aFe: .2, gN: .6, gF: .6, nk: -.1 }],
      [1.2, { lNp: .04, lNk: .06, lFp: -.04, lFk: .05, sp: -.08, aNp: .75, aNe: 1.25, aFp: .7, aFe: 1.3, nk: 0 }], [1.8, { sp: -.06 }]] },
    nem: { len: 1, vao: .1, keys: [[0, {}], [.3, { aNp: -1.0, aNa: .3, aNe: 1.2, gN: 1, aFp: 1.1, aFe: .3, tw: -.3, sp: -.1, lNp: -.25, lFp: .3, lFk: .2 }],
      [.48, { aNp: 2.3, aNe: .2, tw: .35, sp: .25, dx: 12, lNp: .35, lFp: -.3, aFp: -.4 }], [.62, { aNp: 1.3, aNe: .3, sp: .32, gN: 0, oN: 1 }], [1, { aNp: .4, aNe: .3, sp: .1, tw: 0, dx: 4, lNp: .1, lFp: -.05, aFp: 0 }]] },
    dao: { loop: 1, keys: [[0, { sp: .35, aNp: .9, aNe: .4, aFp: .6, aFe: .9, gN: 1, gF: 1, lNp: .4, lNk: .4, lFp: -.15 }], [.5, { sp: .7, aNp: .35, aNe: .2, aFp: .2, aFe: .5 }],
      [.85, { sp: .2, aNp: 1.35, aNe: .6, aFp: 1.05, aFe: 1.0 }], [1.2, { sp: .35, aNp: .9, aNe: .4, aFp: .6, aFe: .9 }]] },
    'co-vu': { loop: 1, bc: 'vui', keys: [[0, { aNp: 2.8, aNa: .45, aNe: .1, aFp: 2.7, aFa: .45, aFe: .1, oN: 1, oF: 1, dy: 0, lNk: .06, lFk: .05 }], [.15, { dy: -6, lNk: .35, lFk: .35 }], [.3, { dy: 0, lNk: .06, lFk: .05 }]] },
    'vuon-vai': { len: 2.4, vao: .2, keys: [[0, {}], [.8, { aNp: 3.0, aNe: .15, aFp: 3.0, aFe: .15, aNa: .15, aFa: .15, sp: -.12, nk: -.15, oN: 1, oF: 1, dy: 4 }], [1.6, { sp: -.15, nk: -.18 }],
      [2.4, { aNp: .07, aFp: -.04, aNe: .2, aFe: .16, aNa: .1, aFa: .1, sp: .03, nk: 0, oN: 0, oF: 0, dy: 0 }]] },
    mua: { loop: 1, bc: 'vui', keys: [[0, { sb: .12, dx: 6, aNp: 2.2, aNa: .5, aNe: .6, aFp: .5, aFa: .4, aFe: 1.4, lNk: .3, lFk: .05, hr: .12, oN: 1, oF: 1 }],
      [.5, { sb: -.12, dx: -6, aNp: .5, aNa: .4, aNe: 1.4, aFp: 2.2, aFa: .5, aFe: .6, lNk: .05, lFk: .3, hr: -.12 }], [1, { sb: .12, dx: 6, aNp: 2.2, aNa: .5, aNe: .6, aFp: .5, aFa: .4, aFe: 1.4, lNk: .3, lFk: .05, hr: .12 }]] },
    'cui-chao': { len: 1.4, vao: .1, keys: [[0, {}], [.5, { sp: .85, dx: -14, nk: .3, aNp: .25, aFp: .2 }], [1, { sp: .85 }], [1.4, { sp: .03, dx: 0, nk: 0, aNp: .07, aFp: -.04 }]] },
    khoc: { loop: 1, tren: 1, tay: 1, mat: 1, bc: 'buon', keys: [[0, { aNp: 1.05, aNe: 2.2, aNa: -.2, aFp: 1.0, aFe: 2.25, aFa: -.2, nk: .3, sp: .15, sh: .15 }], [.4, { sh: .05, nk: .34 }], [.8, { sh: .15, nk: .3 }]] },
    'vo-tay': { loop: 1, tren: 1, tay: 1, bc: 'vui', keys: [[0, { aNp: 1.15, aNe: 1.3, aNa: -.15, aFp: 1.1, aFe: 1.25, aFa: -.15, oN: 1, oF: 1 }], [.2, { aNe: .95, aFe: .9 }], [.4, { aNe: 1.3, aFe: 1.25 }]] },
    'ngoi-bo-goi': { len: .8, vao: .2, keys: [[0, {}], [.8, { hf: 1, hh: 30, rot: -.1, sp: .35, lNp: 1.95, lNk: 2.6, lFp: 1.9, lFk: 2.65, pN: 0, pF: 0, aNp: .95, aNe: .9, aFp: .9, aFe: .95, nk: .15 }]] },
    'chong-gay': { loop: 1, prop: 'gay', keys: [[0, { sp: .16, lNk: .16, lFk: .12, aNp: .5, aNe: .3, aNa: .15, gN: 1, nk: -.05 }], [2, { sp: .19, nk: -.02 }], [4, { sp: .16, nk: -.05 }]] },
    'chay-nuoc-rut': { loop: 1, tren: 1, keys: [[0, { aNp: 1.0, aNe: 2.0, gN: 1, aFp: -.6, aFe: 1.6, gF: 1, sp: .25 }], [.25, { aNp: -.6, aNe: 1.6, aFp: 1.0, aFe: 2.0 }], [.5, { aNp: 1.0, aNe: 2.0, aFp: -.6, aFe: 1.6 }]] },
    // ---- phone / desk (office drama): prop 'dt' = phone in the hands with screen light on the face, 'hop' = a carried box ----
    'xem-dt': { loop: 1, tren: 1, prop: 'dt', keys: [[0, { aNp: .55, aNe: 1.85, aNa: -.15, nk: .3, hr: .04 }], [2, { nk: .33 }], [4, { nk: .3 }]] },
    'go-dt': { loop: 1, tren: 1, tay: 1, prop: 'dt', keys: [[0, { aNp: .55, aNe: 1.9, aNa: -.3, aFp: .5, aFe: 1.95, aFa: -.35, nk: .32 }], [.14, { aNe: 1.8, aFe: 2.02 }], [.28, { aNe: 1.9, aFe: 1.95 }]] },
    'ngoi-go-dt': { loop: 1, tay: 1, prop: 'dt', keys: [[0, { hf: 1, hh: 46, sp: .14, lNp: 1.45, lNk: 2.3, lFp: 1.35, lFk: 2.4, pN: 0, pF: 0, aNp: .55, aNe: 1.9, aNa: -.3, aFp: .5, aFe: 1.95, aFa: -.35, nk: .34 }],
      [.14, { aNe: 1.8, aFe: 2.02 }], [.28, { aNe: 1.9, aFe: 1.95 }]] },
    'ngoi-xem-dt': { loop: 1, tay: 1, prop: 'dt', keys: [[0, { hf: 1, hh: 46, sp: .1, lNp: 1.45, lNk: 2.3, lFp: 1.35, lFk: 2.4, pN: 0, pF: 0, aNp: .6, aNe: 1.85, aNa: -.2, aFp: .1, aFe: .4, nk: .3 }], [2, { nk: .33, sp: .12 }], [4, { nk: .3, sp: .1 }]] },
    'ngoi-giuong': { loop: 1, keys: [[0, { hf: 1, hh: 46, sp: .1, lNp: 1.45, lNk: 2.3, lFp: 1.35, lFk: 2.4, pN: 0, pF: 0, aNp: .3, aNe: .5, aFp: .25, aFe: .5, nk: .1 }], [2, { sp: .14 }], [4, { sp: .1 }]] },
    'om-hop': { loop: 1, tren: 1, tay: 1, prop: 'hop', keys: [[0, { aNp: .42, aNe: 1.3, aNa: -.15, aFp: .4, aFe: 1.32, aFa: -.15, sp: -.06 }], [2, { sp: -.05 }], [4, { sp: -.06 }]] },   // elbows bent, forearms level under the box, leaning back a touch for the weight
    'ngoi-ban': { loop: 1, ngoi: 1, keys: [[0, { ...SIT, sp: .16, aNp: .42, aNe: 1.22, aFp: .38, aFe: 1.28, nk: .1 }], [.2, { aNe: 1.3, aFe: 1.2 }], [.4, { aNe: 1.2, aFe: 1.3 }], [3, { nk: .14, sp: .18 }], [6, { nk: .1, sp: .16 }]] },   // elbows bent, forearms level on the desk
    'day-dt': { len: 1.3, ngoi: 1, keys: [[0, { ...SIT, sp: .16, aNp: .42, aNe: 1.22, aFp: .38, aFe: 1.28, nk: .1 }], [.55, { aNp: 1.4, aNe: .2, sp: .2, nk: .02 }], [1.3, { aNp: 1.35, aNe: .25, sp: .18 }]] },
    // ---- gestures (upper body, can play over a walk) ----
    'cam-den': { loop: 1, tren: 1, tay: 1, prop: 'den', keys: [[0, { aNp: 1.2, aNe: .2, aNa: .06, sp: .05, aFp: .1, aFe: .35, gN: 1 }], [1.5, { aNp: 1.32, aNa: .12, nk: .04 }], [3, { aNp: 1.2, aNa: .06, nk: 0 }]] },
    chi: { len: 1.3, tren: 1, vao: .12, keys: [[0, {}], [.16, { aNp: -.3, aNe: 1.0, sp: -.04, sh: .06, nk: -.04 }], [.34, { aNp: 1.7, aNe: -.08, aNa: .06, sp: .08, dx: 8, nk: .03, sh: 0, kN: 1 }],
      [.55, { aNp: 1.52, aNe: .04, sp: .05, dx: 5 }], [1.3, { aNp: 1.55, aNe: .02 }]] },
    vay: { loop: 1, tren: 1, keys: [[0, { aNp: 2.6, aNa: .45, aNe: .3, hr: .06, sh: .05, oN: 1 }], [.45, { aNp: 2.66, aNa: .55, aNe: 1.0, hr: .03 }], [.9, { aNp: 2.6, aNa: .45, aNe: .3, hr: .06 }]] },
    'gio-tay': { loop: 1, tren: 1, keys: [[0, { aNp: 2.8, aFp: 2.65, aNe: .2, aFe: .25, aNa: .25, aFa: .25, sh: .15, nk: -.08, oN: 1, oF: 1 }], [.8, { aNp: 2.9, aFp: 2.75, sh: .2 }], [1.6, { aNp: 2.8, aFp: 2.65, sh: .15 }]] },
    'gat-dau': { loop: 1, tren: 1, keys: [[0, { nk: -.05 }], [.35, { nk: .22 }], [.7, { nk: -.05 }]] },
    'lac-dau': { loop: 1, tren: 1, keys: [[0, { hy: -.3, nk: .05 }], [.35, { hy: .3 }], [.7, { hy: -.3 }]] },
    'nam-tay': { len: .5, tren: 1, tay: 1, keys: [[0, {}], [.5, { aNp: .95, aNe: .25, aNa: .05, gN: 1, sp: .06 }]] },
    diu: { len: .5, tren: 1, tay: 1, keys: [[0, {}], [.5, { aNp: .35, aNe: .95, aNa: .1, aFp: .8, aFe: .5, gN: 1, gF: 1, sp: .1, hr: .08 }]] },
    // ---- whole body actions ----
    cui: { len: .8, keys: [[0, {}], [.15, { sp: -.05, lNk: .15, lFk: .15 }], [.55, { sp: .95, dx: -22, lNp: .75, lNk: 1.25, lFp: .45, lFk: 1.0, aNp: .95, aNe: .25, aFp: .8, aFe: .3, nk: .15 }],
      [.8, { sp: .9, dx: -20, lNp: .72, lNk: 1.2, lFp: .42, lFk: .98, aNp: .9, aNe: .3, aFp: .75, aFe: .35 }]] },
    'cui-nhat': { len: 1.9, tay: 1, keys: [[0, {}], [.15, { sp: -.04 }], [.6, { sp: .98, dx: -22, lNp: .78, lNk: 1.3, lFp: .45, lFk: 1.0, aNp: 1.0, aNe: .15, aFp: .8, aFe: .3, nk: .2 }],
      [.82, { gN: 1, aNp: 1.0, aNe: .2 }], [1.35, { sp: .08, dx: 0, lNp: .04, lNk: .08, lFp: -.04, lFk: .06, aNp: .6, aNe: 1.5, aFp: -.04, aFe: .2, nk: .1 }], [1.9, { sp: .04, aNp: .55, aNe: 1.45, nk: .08 }]] },
    keo: { loop: 1, tay: 1, bc: 'quyet', keys: [[0, { sp: -.32, rot: -.1, dx: -4, lNp: .5, lNk: .05, lFp: -.25, lFk: .45, aNp: 1.4, aNe: .12, aFp: 1.25, aFe: .2, gN: 1, gF: 1, nk: -.05 }],
      [.6, { sp: -.48, rot: -.16, dx: -10, aNe: .4, aFe: .5, nk: -.1 }], [1.2, { sp: -.32, rot: -.1, dx: -4, aNe: .12, aFe: .2, nk: -.05 }]] },
    day: { loop: 1, tay: 1, bc: 'quyet', keys: [[0, { sp: .35, rot: .1, lNp: .35, lNk: .5, lFp: -.55, lFk: .1, aNp: 1.45, aNe: .3, aFp: 1.4, aFe: .35, gN: 0, gF: 0 }],
      [.5, { dx: 8, aNe: .1, aFe: .15, sp: .42 }], [1, { dx: 0, aNe: .3, aFe: .35, sp: .35 }]] },
    om: { len: .9, tay: 1, keys: [[0, {}], [.25, { aNp: .9, aNa: .5, aNe: .5, aFp: .85, aFa: .45, aFe: .5 }], [.6, { aNp: 1.25, aNa: .35, aNe: 1.25, aFp: 1.2, aFa: .3, aFe: 1.3, sp: .1, hr: .12, nk: .12, dx: 6 }],
      [.9, { aNp: 1.2, aNa: .33, aNe: 1.2, aFp: 1.15, aFa: .3, aFe: 1.25, sp: .09, hr: .1, nk: .1, dx: 5 }]] },
    lay: { loop: 1, tay: 1, bc: 'hoang', keys: [[0, { sp: .5, dx: -6, lNk: .2, lFk: .25, aNp: 1.0, aNe: .35, aFp: .9, aFe: .4, gN: .6, gF: .6 }], [.18, { dx: 4, sp: .56, aNp: 1.08 }], [.36, { dx: -6, sp: .5, aNp: 1.0 }]] },
    'giat-minh': { len: .9, vao: .06, bc: 'hoang', keys: [[0, {}], [.08, { dy: 24, dx: -10, sp: -.22, aNp: .7, aNa: .05, aNe: 1.9, aFp: .6, aFa: -.1, aFe: 1.95, sh: .3, nk: -.15, pN: .2, pF: .2, oN: 1, oF: 1 }],
      [.24, { dy: 0, dx: -22, sp: -.12, lNk: .3, lFk: .3, pN: 1, pF: 1, sh: .2 }], [.9, { dx: -18, sp: -.06, aNp: .45, aNe: 1.7, aFp: .4, aFe: 1.75, sh: .1, nk: -.05, lNk: .12, lFk: .12 }]] },   // settles with both hands held near the chest
    nhay: { len: 1.25, keys: [[0, {}], [.3, { sp: .35, dx: -6, lNp: .6, lNk: 1.1, lFp: .5, lFk: 1.0, aNp: -.6, aFp: -.6, aNe: .3, nk: .1 }],
      [.45, { dy: 40, sp: -.05, dx: 0, lNp: .1, lNk: .05, lFp: -.1, lFk: .1, pN: 0, pF: 0, aNp: 2.6, aFp: 2.4, nk: -.1 }], [.62, { dy: 95, lNp: .5, lNk: .8, lFp: .3, lFk: .9 }],
      [.8, { dy: 0, sp: .3, lNp: .6, lNk: 1.0, lFp: .5, lFk: 1.0, pN: 1, pF: 1, aNp: .6, aFp: .5 }], [1.25, STAND]] },
    nga: { len: 1.3, vao: .08, bc: 'hoang', keys: [[0, {}], [.1, { lNp: .6, lNk: .1, pN: 0, aNp: 1.4, aNa: .5, aFp: 1.1, aFa: .4, aNe: .3, aFe: .4, sp: -.2, nk: -.15, dy: 4 }],
      [.4, { rot: -.85, hf: .85, hh: 110, dy: 0, lNp: .9, lNk: .3, lFp: .5, lFk: .8, pF: 0, aNp: 2.3, aFp: 2.0, aNa: .6, sp: -.1, nk: -.25 }],
      [.62, { rot: -1.45, hf: 1, hh: 34, lNp: 1.0, lNk: .4, lFp: .6, lFk: .9, aNp: 2.6, aFp: 1.6, aNe: .4, sp: -.05, nk: .25 }], [.75, { rot: -1.38, hh: 40, lNp: 1.15, lFp: .75, nk: .35 }],
      [1.3, FALLEN]] },
    'do-day': { len: 1.9, keys: [[0, FALLEN], [.5, { rot: -.6, hh: 48, sp: .3, aFp: -.5, aFe: .3, aNp: .6, aNe: .3, lNp: 1.3, lNk: 1.6, lFp: 1.1, lFk: 1.8, nk: .1 }],
      [1.0, { rot: 0, hf: .6, hh: 120, sp: .7, lNp: 1.2, lNk: 2.0, lFp: .2, lFk: 2.2, aNp: .9, aNe: .3, aFp: .4, pN: .6, pF: .3 }],
      [1.45, { hf: 0, sp: .3, lNp: .3, lNk: .5, lFp: 0, lFk: .4, pN: 1, pF: 1, aNp: .4, aNe: .4, aFp: .2, aFe: .3 }], [1.9, STAND]] },
    // ---- sitting / lying ----
    ngoi: { loop: 1, ngoi: 1, keys: [[0, SIT], [2, { sp: .16, hr: .03 }], [4, { sp: .12, hr: 0 }]] },
    'ngoi-xuong': { len: 1.1, ngoi: 1, vao: .1, keys: [[0, {}], [.35, { sp: .5, dx: -6, hh: 124, lNp: .65, lNk: .95, lFp: .6, lFk: 1.0, aNp: .55, aNe: .4, aFp: .5, aFe: .4 }],
      [.8, { hf: 1, hh: 124, sp: .22, dx: 0, lNp: 1.4, lNk: 1.4, lFp: 1.36, lFk: 1.45, aNp: .6, aNe: .8, aFp: .55, aFe: .85 }], [1.1, SIT]] },
    'dung-day': { len: 1.2, ngoi: 1, vao: .1, keys: [[0, SIT], [.3, { sp: .55, dx: 4, nk: .1 }], [.75, { hf: 0, sp: .2, lNp: .2, lNk: .3, lFp: .1, lFk: .3, aNp: .2, aNe: .3, aFp: .1, aFe: .3, dx: 0 }], [1.2, STAND]] },
    quy: { len: .8, keys: [[0, {}], [.4, { sp: .3, lNp: .9, lNk: 1.3, lFp: .2, lFk: 1.2 }], [.8, { hf: 1, hh: 142, sp: .15, lNp: 1.4, lNk: 1.45, lFp: -.05, lFk: 1.6, pN: 1, pF: 0, aNp: .5, aNe: .6 }]] },
    nam: { loop: 1, keys: [[0, LIE], [2, { sp: .02 }], [4, { sp: 0 }]] },
    'ngoi-day': { len: 1.4, vao: .1, keys: [[0, LIE], [.45, { rot: -1.2, sp: -.1, aNp: -.4, aNe: 1.2, aFp: -.4, aFe: 1.2, nk: .2 }],
      [1.0, { rot: -.1, sp: .25, hh: 30, aNp: .3, aNe: .3, aFp: .2, aFe: .3, lNp: 1.45, lNk: .1, lFp: 1.5, lFk: .05, nk: .1 }],
      [1.4, { rot: -.05, sp: .2, hh: 30, lNp: 1.5, lNk: .12, lFp: 1.52, lFk: .08, aNp: .35, aNe: .4, aFp: .3, aFe: .4, nk: .05 }]] },
    // ---- locomotion (procedural; the base pose is the idle, the walk layer drives legs / arms from the path) ----
    di: { loco: 1, fn: idle }, 'di-cham': { loco: 1, fn: idle }, chay: { loco: 1, fn: idle }, 'chay-hoang': { loco: 1, fn: idle, bc: 'hoang' }, leo: { loco: 1, fn: idle, bc: 'quyet' },
  });
  // aliases: talking idle, calling wave, legacy names
  nv.CLIPS.noi = nv.CLIPS.dung; nv.CLIPS['vay-goi'] = nv.CLIPS.vay;
})();
