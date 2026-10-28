"""Shape builder for `xp redraw mo-rong --them them.json`: the AI describes the added drawing as a SKELETON + SHAPES, never hand-written paths.

them.json:
{ "phan_tich": "proportions, viewing angle, pose, line of action…",  (required: think before drawing)
  "xuong": { "hong": [x, y], "goi_t": [x, y], … },                 (named joints; a point inside a part can be written "@goi_t" or "@goi_t+4,-2")
  "net": { "trong": 2.8, "ngoai": 4.6 },                            (default: line widths measured from the original; outer ≈ 1.6×)
  "duoi": [ parts… ],   "tren": [ parts… ] }                        (duoi = under the original, tren = on top; order = back → front)

parts (colour = a name from phan_tich.json, e.g. "da", "ao", or #hex):
  {"loai": "ong",  "mau": "da", "diem": [[x, y, width], …]}       tapered tube through the points (arms, legs, neck) — round ends, width smoothly interpolated
  {"loai": "khoi", "mau": "ao", "diem": [[x, y], …], "goc": [i…]}   smooth closed shape (Catmull-Rom); "goc" = indices of sharp corners (hem, shoe tip)
  {"loai": "net",  "diem": [[x, y, width], …]}                     ink stroke tapered at both ends (elbow, knee, shoelace, strong fold)
  {"loai": "nep",  "diem": [[x, y, width], …]}                     soft fold = 30% ink (still the right shade after recolouring)
  {"loai": "tron" | "elip", "tam": [x, y], "r" | "rx", "ry", "xoay"}  filled circle / ellipse · "vong" = ink ring (glasses rims, "rong" = width)
  add "vien": false to drop the outline (patches joined to a cut edge); "dam": 0.3 for nep.

Outline: all shapes/tubes of a layer are first drawn as one THICK stroke behind (one continuous outer silhouette), then the
colour + thin inner line, so the outer line is naturally thicker than the inner lines, like the original; where an arm
overlaps the shirt only the thin line remains.
"""
import numpy as np

def _pt(p, X):
    if isinstance(p, str) and p.startswith('@'):
        name, _, off = p[1:].partition('+'); b = X[name]; dx, dy = (float(v) for v in off.split(',')) if off else (0, 0)
        return [b[0] + dx, b[1] + dy]
    return p

def _pts(P, X):
    out = []
    for p in P:
        if isinstance(p, str): out.append(_pt(p, X))
        elif isinstance(p[0], str): q = _pt(p[0], X); out.append(q + list(p[1:]))
        else: out.append(list(p))
    return np.array(out, float)

def cr(P, closed, n=10, sharp=()):
    """dense uniform Catmull-Rom → smooth polyline; 'sharp' indices keep their corner."""
    m = len(P); out = []
    rng = range(m) if closed else range(m - 1)
    for i in rng:
        i0, i2, i3 = (i - 1) % m, (i + 1) % m, (i + 2) % m
        if not closed: i0, i3 = max(i - 1, 0), min(i + 2, m - 1)
        p0, p1, p2, p3 = P[i0], P[i], P[i2], P[i3]
        if i in sharp: p0 = p1
        if i2 in sharp: p3 = p2
        for t in np.linspace(0, 1, n, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    if not closed: out.append(P[-1])
    return np.array(out)

def d_of(poly, closed=True):
    s = 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in poly[:, :2]); return s + ('Z' if closed else '')

def ribbon(P, taper=0.0, cap=True):
    """tube/stroke: centre line (x, y, width) → closed polygon; taper > 0 = tapered at both ends (ink stroke)."""
    C = cr(P, False, 12); xy, w = C[:, :2], np.maximum(C[:, 2], .3)
    seg = np.diff(xy, axis=0); L = np.concatenate([[0], np.cumsum(np.hypot(*seg.T))]); t = L / max(L[-1], 1e-6)
    if taper: w = w * np.clip(np.minimum(t, 1 - t) / taper, .08, 1) ** .7
    tg = np.gradient(xy, axis=0); tg /= np.maximum(np.hypot(*tg.T), 1e-6)[:, None]; nm = np.stack([-tg[:, 1], tg[:, 0]], 1)
    left, right = xy + nm * (w / 2)[:, None], xy - nm * (w / 2)[:, None]
    def capf(c, r, d0, back):   # half-circle end cap
        a0 = np.arctan2(d0[1], d0[0]); A = np.linspace(a0 + np.pi / 2, a0 - np.pi / 2, 9) if not back else np.linspace(a0 - np.pi / 2, a0 - 3 * np.pi / 2, 9)
        return np.stack([c[0] + np.cos(A) * r, c[1] + np.sin(A) * r], 1)
    if cap and not taper:
        poly = np.vstack([left, capf(xy[-1], w[-1] / 2, tg[-1], False), right[::-1], capf(xy[0], w[0] / 2, -tg[0], False)])
    else: poly = np.vstack([left, right[::-1]])
    return poly

def _ellipse(cx, cy, rx, ry, rot=0.0, n=48):
    t = np.linspace(0, 2 * np.pi, n, endpoint=False); c, s = np.cos(rot), np.sin(rot)
    x, y = np.cos(t) * rx, np.sin(t) * ry
    return np.stack([cx + x * c - y * s, cy + x * s + y * c], 1)


def shape(b, X):
    if b['loai'] in ('tron', 'elip', 'vong'):   # circle / ellipse (filled) · ring (ink stroke, e.g. glasses rims)
        cx, cy = _pt(b['tam'], X); rx = b.get('rx', b.get('r', 10)); ry = b.get('ry', b.get('r', rx))
        return _ellipse(cx, cy, rx, ry, b.get('xoay', 0.0))
    P = _pts(b['diem'], X)
    if b['loai'] == 'khoi': return cr(P, True, 10, set(b.get('goc', [])))
    if b['loai'] == 'ong': return ribbon(P)
    return ribbon(P, taper=.22)

def build(spec, color, ink, widths):
    """→ {'duoi': svg, 'tren': svg}"""
    X = spec.get('xuong', {}); nt = spec.get('net', {}); wi = nt.get('trong', widths[0]); wo = nt.get('ngoai', widths[1])
    out = {}
    for layer in ('duoi', 'tren'):
        parts = spec.get(layer, []); back, front = [], []
        for b in parts:
            poly = shape(b, X); d = d_of(poly)
            if b['loai'] == 'vong':
                front.append(f'<path d="{d}" fill="none" stroke="{color(b.get("mau", ink)) if b.get("mau") else ink}" stroke-width="{b.get("rong", 8)}" stroke-linejoin="round"/>'); continue
            if b['loai'] in ('tron', 'elip'): b = {**b, 'loai': 'khoi'}
            if b['loai'] in ('khoi', 'ong'):
                if b.get('vien', True): back.append(f'<path d="{d}"/>')
                st = f' stroke="{ink}" stroke-width="{wi:.2f}" stroke-linejoin="round"' if b.get('vien', True) else ''
                front.append(f'<path d="{d}" fill="{color(b["mau"])}"{st}/>')
            elif b['loai'] == 'net': front.append(f'<path d="{d}" fill="{ink}"/>')
            else: front.append(f'<path d="{d}" fill="{ink}" fill-opacity="{b.get("dam", .3)}"/>')
        g = f'<g fill="{ink}" stroke="{ink}" stroke-width="{2 * wo:.2f}" stroke-linejoin="round">' + ''.join(back) + '</g>' if back else ''
        out[layer] = g + ''.join(front)
    return out
