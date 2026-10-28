"""EXPRESSION generator for cut-out characters (xp redraw rig): every expression is declared ONCE as parameters (eyelids, brows, mouth),
then drawn for every head direction from that direction's eye / mouth positions → ve_them shapes (tapered ink strokes, ink fills, highlights).

  mat (lids): ngu (half-closed — like the original) · mo (open) · to (wide, small pupil) · nham (closed) · cuoi (happy ^) · hep (narrowed, angry) · buon (droopy, sad)
  may (brows): (inner end, outer end) — positive = lowered (angry), negative = raised (surprised / sad when the inner end rises)
  mieng (mouth): ngam (closed) · cuoi (smile) · nhech (smirk) · buon (sad) · o · a · e · to (wide open) · het (scream) · gian (angry) · so (afraid) · nghi (thinking)
"""

BIEU_CAM = {   # engine name → (near eyelid, far eyelid, near brow (inner, outer), far brow, mouth)
    'binh': ('ngu', 'ngu', (0, 2), (0, 2), 'ngam'),
    'met': ('ngu', 'ngu', (-2, 4), (-2, 4), 'ngam'),
    'cuoi': ('cuoi', 'cuoi', (-2, 1), (-2, 1), 'cuoi'),
    'vui': ('cuoi', 'cuoi', (-6, -4), (-6, -4), 'to'),
    'ngac': ('to', 'to', (-12, -9), (-12, -9), 'o'),
    'hoang': ('to', 'to', (-13, -12), (-13, -12), 'het'),
    'so': ('to', 'to', (-11, 3), (-11, 3), 'so'),
    'buon': ('buon', 'buon', (-9, 4), (-9, 4), 'buon'),
    'gian': ('hep', 'hep', (10, -5), (10, -5), 'gian'),
    'nghi': ('hep', 'mo', (4, -2), (-9, -9), 'nghi'),
    'tu_tin': ('ngu', 'ngu', (-4, -2), (-4, -2), 'nhech'),
    'quyet': ('mo', 'mo', (7, -3), (7, -3), 'ngam'),
    'nham': ('nham', 'nham', (0, 2), (0, 2), 'ngam'),
}
MAP_ENGINE = {'binh': 'binh', 'so': 'so', 'hoang': 'hoang', 'ngac': 'ngac', 'quyet': 'quyet', 'gian': 'gian', 'buon': 'buon', 'met': 'met', 'nghi': 'nghi',
              'cuoi': 'cuoi', 'vui': 'vui', 'nham': 'nham', 'tu_tin': 'tu_tin', 'chan': 'met'}
MIENG_NOI = {'ngam': 'mieng_ngam', 'o': 'mieng_o', 'a': 'mieng_a', 'e': 'mieng_e', 'to': 'mieng_to', 'het': 'mieng_het'}   # visemes (lip-sync)


def mat(kieu, cx, cy, w, inn):
    """one eye (without the brow). w = eye width (px), inn = +1 if the nose side is to the right."""
    u = w / 76.0; L, R = cx - w / 2, cx + w / 2; o = []
    if kieu == 'ngu':        # half-closed sleepy lid: heavy lid line + dark crescent under it + tiny catchlight (the original look)
        o.append({'loai': 'khoi', 'mau': 'muc', 'vien': False, 'diem': [[cx - w * .47 * inn, cy - 4 * u], [cx + w * .2 * inn, cy - 3 * u], [cx + w * .14 * inn, cy + 7 * u], [cx - w * .06 * inn, cy + 10 * u], [cx - w * .32 * inn, cy + 5 * u]]})
        o.append({'loai': 'net', 'diem': [[L, cy - 5 * u, 4 * u], [cx, cy - 4.5 * u, 6 * u], [R, cy - 2 * u, 4 * u]]})
        o.append({'loai': 'tron', 'mau': '#ffffff', 'vien': False, 'tam': [cx + w * .12 * inn, cy + 1.5 * u], 'r': 2.6 * u})
    elif kieu == 'mo':       # open: dark oval with two highlights + upper lash line
        o.append({'loai': 'elip', 'mau': 'muc', 'vien': False, 'tam': [cx, cy + 2 * u], 'rx': w * .2, 'ry': w * .27})
        o.append({'loai': 'tron', 'mau': '#ffffff', 'vien': False, 'tam': [cx + w * .06, cy - 4 * u], 'r': w * .07})
        o.append({'loai': 'tron', 'mau': '#ffffff', 'vien': False, 'tam': [cx - w * .07, cy + 9 * u], 'r': w * .035})
        o.append({'loai': 'net', 'diem': [[cx - w * .3, cy - w * .17, 3 * u], [cx, cy - w * .27, 5 * u], [cx + w * .3, cy - w * .19, 3 * u]]})
    elif kieu == 'to':       # wide (surprise / fear): white eye with outline + small dark pupil
        o.append({'loai': 'elip', 'mau': '#ffffff', 'tam': [cx, cy], 'rx': w * .27, 'ry': w * .32})
        o.append({'loai': 'tron', 'mau': 'muc', 'vien': False, 'tam': [cx + w * .03 * inn, cy + 1 * u], 'r': w * .09})
    elif kieu == 'nham':     # closed: soft downward arc
        o.append({'loai': 'net', 'diem': [[cx - w * .38, cy, 3 * u], [cx, cy + 6 * u, 5 * u], [cx + w * .38, cy, 3 * u]]})
    elif kieu == 'cuoi':     # happy closed ^
        o.append({'loai': 'net', 'diem': [[cx - w * .36, cy + 6 * u, 3 * u], [cx, cy - 6 * u, 5.5 * u], [cx + w * .36, cy + 6 * u, 3 * u]]})
    elif kieu == 'hep':      # narrowed (angry / squint): dark slit, top lid slanting down to the nose side
        o.append({'loai': 'khoi', 'mau': 'muc', 'vien': False, 'diem': [[cx - w * .4 * inn, cy - 6 * u], [cx + w * .38 * inn, cy + 1 * u], [cx + w * .3 * inn, cy + 6 * u], [cx - w * .3 * inn, cy + 4 * u]]})
        o.append({'loai': 'net', 'diem': [[cx - w * .42 * inn, cy - 7 * u, 4 * u], [cx + w * .4 * inn, cy, 5 * u]]})
    elif kieu == 'buon':     # droopy: lid slanting down to the outer side + crescent
        o.append({'loai': 'khoi', 'mau': 'muc', 'vien': False, 'diem': [[cx + w * .36 * inn, cy - 5 * u], [cx - w * .36 * inn, cy + 2 * u], [cx - w * .2 * inn, cy + 9 * u], [cx + w * .2 * inn, cy + 8 * u]]})
        o.append({'loai': 'net', 'diem': [[cx + w * .4 * inn, cy - 6 * u, 4 * u], [cx - w * .4 * inn, cy + 1 * u, 5 * u]]})
        o.append({'loai': 'tron', 'mau': '#ffffff', 'vien': False, 'tam': [cx, cy + 4 * u], 'r': 2.4 * u})
    return o


def may(cx, cy, w, inn, d_in, d_out):
    """brow: a short stroke above the eye; the inner (nose-side) and outer ends rise / drop with the expression"""
    u = w / 76.0; by = cy - w * .5
    return [{'loai': 'net', 'diem': [[cx + w * .3 * inn, by + d_in * u, 2.6 * u], [cx + w * .08 * inn, by + (d_in + d_out) / 2 * u - 1.5 * u, 4 * u], [cx - w * .16 * inn, by + d_out * u, 2.6 * u]]}]


def mieng(kieu, cx, cy, s=1.0):
    k = lambda pts: [[cx + a * s, cy + b * s] for a, b in pts]
    kn = lambda pts: [[cx + a * s, cy + b * s, wd * s] for a, b, wd in pts]
    if kieu == 'ngam': return [{'loai': 'net', 'diem': kn([(-8, -1, 2), (0, 0, 3.2), (8, 1, 2)])}]
    if kieu == 'cuoi': return [{'loai': 'net', 'diem': kn([(-12, -3, 2), (0, 4, 3.4), (12, -3, 2)])}]
    if kieu == 'nhech': return [{'loai': 'net', 'diem': kn([(-8, 1, 2), (4, 0, 3.2), (12, -5, 2)])}]
    if kieu == 'buon': return [{'loai': 'net', 'diem': kn([(-11, 4, 2), (0, -3, 3.2), (11, 4, 2)])}]
    if kieu == 'gian': return [{'loai': 'net', 'diem': kn([(-12, 3, 2.4), (0, -2, 4), (12, 3, 2.4)])}]
    if kieu == 'so': return [{'loai': 'net', 'diem': kn([(-12, 2, 2), (-6, -2, 3), (0, 2, 3), (6, -2, 3), (12, 2, 2)])}]
    if kieu == 'nghi': return [{'loai': 'net', 'diem': kn([(-2, 1, 2), (8, 0, 3), (13, -2, 2)])}]
    if kieu == 'o': return [{'loai': 'elip', 'mau': 'muc', 'vien': False, 'tam': [cx, cy + 2 * s], 'rx': 6 * s, 'ry': 8 * s}]
    tongue = lambda y, rx: {'loai': 'elip', 'mau': 'ma_hong', 'vien': False, 'tam': [cx, cy + y * s], 'rx': rx * s, 'ry': 4 * s}
    if kieu == 'a': return [{'loai': 'khoi', 'mau': 'muc', 'vien': False, 'diem': k([(-12, -4), (12, -4), (8, 10), (-8, 10)])}, tongue(7, 6)]
    if kieu == 'e': return [{'loai': 'khoi', 'mau': 'muc', 'vien': False, 'diem': k([(-13, -3), (13, -3), (10, 5), (-10, 5)])}]
    if kieu == 'to': return [{'loai': 'khoi', 'mau': 'muc', 'vien': False, 'diem': k([(-16, -4), (16, -4), (10, 12), (0, 15), (-10, 12)])}, tongue(10, 8)]
    if kieu == 'het': return [{'loai': 'elip', 'mau': 'muc', 'vien': False, 'tam': [cx, cy + 4 * s], 'rx': 12 * s, 'ry': 16 * s}, tongue(14, 8)]
    return []


def bo_mat(view):
    """→ {expression_name: shapes}, {mouth_kind: shapes} for one head direction.
    view = {'mat': [[cx, cy, w, inn], …] (1–2 eyes, the first is the near eye), 'mieng': [cx, cy, s]}"""
    eyes = view['mat']; out = {}
    for ten, (k_gan, k_xa, m_gan, m_xa, _) in BIEU_CAM.items():
        sh = []
        for i, (cx, cy, w, inn) in enumerate(eyes):
            sh += mat(k_gan if i == 0 else k_xa, cx, cy, w, inn); d = m_gan if i == 0 else m_xa; sh += may(cx, cy, w, inn, *d)
        out[ten] = sh
    mx, my, s = view['mieng']; m = {k: mieng(k, mx, my, s) for k in ('ngam', 'cuoi', 'nhech', 'buon', 'gian', 'so', 'nghi', 'o', 'a', 'e', 'to', 'het')}
    return out, m
