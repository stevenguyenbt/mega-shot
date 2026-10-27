"""Vectors for the film, all in lon/lat: shoreline rings per year (marching squares on the water
masks from tools/plates.py), the Natural Earth historic sea for the map layer, measured areas and
the measured distance from Muynak's old port to today's water.

usage: python -I tools/vectors.py <demo_dir>   ->  assets/vectors.json
"""
import sys, os, json, math
import numpy as np
from PIL import Image
from scipy import ndimage

DEMO = sys.argv[1]
PL = os.path.join(DEMO, 'assets/plates')
INFO = json.load(open(os.path.join(PL, 'plates.json')))
BASE_KM2 = 68000.0          # USGS Earthshots: "The Aral Sea once covered about 68,000 square kilometers"

# hand-checked points (lon, lat) on the 2025 / 2009 Landsat plates
MUYNAK_PORT = (59.030, 43.785)      # Muynak ship cemetery at the old harbour front
LANDING = (60.18, 44.93)            # dry floor of the eastern basin (salt crust), 2025


def mask(name):
    return np.asarray(Image.open(os.path.join(PL, name + '_w.png')), np.float32) / 255.0


def marching(F, L=0.5):
    """iso-lines of F at level L -> list of polylines in (x, y) pixel coords (pixel centres)."""
    H, W = F.shape
    a = F[:-1, :-1] > L; b = F[:-1, 1:] > L; c = F[1:, 1:] > L; d = F[1:, :-1] > L
    idx = a * 1 + b * 2 + c * 4 + d * 8
    ii, jj = np.nonzero((idx > 0) & (idx < 15))
    def ep(e, i, j):   # edge point
        if e == 0:   # top a-b
            fa, fb = F[i, j], F[i, j + 1]; t = (L - fa) / (fb - fa + 1e-12); return (j + t, i), ('h', i, j)
        if e == 1:   # right b-c
            fa, fb = F[i, j + 1], F[i + 1, j + 1]; t = (L - fa) / (fb - fa + 1e-12); return (j + 1, i + t), ('v', i, j + 1)
        if e == 2:   # bottom d-c
            fa, fb = F[i + 1, j], F[i + 1, j + 1]; t = (L - fa) / (fb - fa + 1e-12); return (j + t, i + 1), ('h', i + 1, j)
        fa, fb = F[i, j], F[i + 1, j]; t = (L - fa) / (fb - fa + 1e-12); return (j, i + t), ('v', i, j)
    TAB = {1: [(3, 0)], 2: [(0, 1)], 3: [(3, 1)], 4: [(1, 2)], 6: [(0, 2)], 7: [(3, 2)], 8: [(2, 3)],
           9: [(2, 0)], 11: [(2, 1)], 12: [(1, 3)], 13: [(1, 0)], 14: [(0, 3)]}
    pts = {}; adj = {}
    for i, j in zip(ii.tolist(), jj.tolist()):
        k = int(idx[i, j])
        if k in (5, 10):
            cen = (F[i, j] + F[i, j + 1] + F[i + 1, j] + F[i + 1, j + 1]) / 4 > L
            segs = [(3, 0), (1, 2)] if (k == 5) != cen else [(3, 2), (1, 0)]
            if k == 10: segs = [(0, 3), (2, 1)] if cen else [(0, 1), (2, 3)]
        else:
            segs = TAB[k]
        for e0, e1 in segs:
            p0, k0 = ep(e0, i, j); p1, k1 = ep(e1, i, j)
            pts[k0] = p0; pts[k1] = p1
            adj.setdefault(k0, []).append(k1); adj.setdefault(k1, []).append(k0)
    seen = set(); lines = []
    order = [k for k in adj if len(adj[k]) == 1] + [k for k in adj if len(adj[k]) != 1]
    for start in order:
        if start in seen: continue
        line = [start]; seen.add(start); cur = start
        while True:
            nx = [n for n in adj[cur] if n not in seen]
            if not nx:
                if len(line) > 2 and start in adj[cur]: line.append(start)   # closed loop
                break
            cur = nx[0]; seen.add(cur); line.append(cur)
        lines.append([pts[k] for k in line])
    return lines


def rdp(P, eps):
    P = np.asarray(P)
    if len(P) < 3: return P
    keep = np.zeros(len(P), bool); keep[0] = keep[-1] = True
    st = [(0, len(P) - 1)]
    while st:
        i0, i1 = st.pop()
        if i1 - i0 < 2: continue
        a, b = P[i0], P[i1]; ab = b - a; n = np.hypot(*ab)
        seg = P[i0 + 1:i1]
        d = np.abs(ab[0] * (seg[:, 1] - a[1]) - ab[1] * (seg[:, 0] - a[0])) / n if n > 0 else np.hypot(*(seg - a).T)
        k = int(np.argmax(d))
        if d[k] > eps:
            keep[i0 + 1 + k] = True; st += [(i0, i0 + 1 + k), (i0 + 1 + k, i1)]
    return P[keep]


def to_ll(info, line):
    w, s, e, n = info['plate']
    return [[round(w + (x + .5) * info['dlon'], 5), round(n - (y + .5) * info['dlat'], 5)] for x, y in line]


def length_km(ll):
    a = np.radians(np.asarray(ll)); lat = (a[1:, 1] + a[:-1, 1]) / 2
    dx = np.diff(a[:, 0]) * np.cos(lat); dy = np.diff(a[:, 1])
    return float(np.sum(np.hypot(dx, dy)) * 6371.0)


def rings_of(name, min_km=12, sigma=1.4, eps=0.6, clip=None):
    info = INFO[name]
    F = ndimage.gaussian_filter(mask(name), sigma)
    out = []
    H, W = F.shape
    for L0 in marching(F):
        # drop the parts of a contour that run along the plate's border (water cut by the plate edge is not a shore)
        pieces, cur = [], []
        for x, y in L0:
            if x < 8 or y < 8 or x > W - 9 or y > H - 9:
                if len(cur) > 2: pieces.append(cur)
                cur = []
            else:
                cur.append((x, y))
        if len(cur) > 2: pieces.append(cur)
        for L in pieces:
            L = rdp(L, eps)
            ll = to_ll(info, L)
            if len(ll) < 3 or length_km(ll) < min_km: continue
            if clip:
                w, s_, e, n = clip
                if not any(w <= x <= e and s_ <= y <= n for x, y in ll): continue
            out.append(ll)
    return out


ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
TENS = 'zero ten twenty thirty forty fifty sixty seventy eighty ninety'.split()
def words(n):
    if n < 20: return ONES[n]
    if n < 100: return TENS[n // 10] + ('' if n % 10 == 0 else '-' + ONES[n % 10])
    h, r = divmod(n, 100)
    return ONES[h] + ' hundred' + ('' if r == 0 else ' and ' + words(r))


def hav(lo1, la1, lo2, la2):
    p1, p2 = np.radians(la1), np.radians(la2)
    a = np.sin((p2 - p1) / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(np.radians(lo2 - lo1) / 2) ** 2
    return 2 * 6371.0088 * np.arcsin(np.sqrt(a))


def nearest_water(name, lon, lat, seed=None):
    """nearest water pixel; with seed=(lon, lat), only the water body that contains the seed"""
    info = INFO[name]; m = mask(name) > .5
    w, s, e, n = info['plate']
    if seed:
        lab, _ = ndimage.label(m)
        sx = int((seed[0] - w) / info['dlon']); sy = int((n - seed[1]) / info['dlat'])
        r = 8; ids = np.unique(lab[max(0, sy - r):sy + r, max(0, sx - r):sx + r]); ids = ids[ids > 0]
        m = np.isin(lab, ids)
    ys, xs = np.nonzero(m)
    lo = w + (xs + .5) * info['dlon']; la = n - (ys + .5) * info['dlat']
    d = hav(lon, lat, lo, la); i = int(np.argmin(d))
    return float(d[i]), [round(float(lo[i]), 5), round(float(la[i]), 5)]


def crossings(lines, lat):
    """longitudes where polylines cross the parallel `lat`"""
    out = []
    for L in lines:
        P = np.asarray(L)
        for (x0, y0), (x1, y1) in zip(P[:-1], P[1:]):
            if (y0 - lat) * (y1 - lat) < 0:
                out.append(x0 + (lat - y0) / (y1 - y0) * (x1 - x0))
    return out


def crossings_line(lines, A, B):
    """points where polylines cross segment A-B (lon/lat), with the parameter along A-B"""
    A = np.asarray(A, float); B = np.asarray(B, float); out = []
    for L in lines:
        P = np.asarray(L)
        for p, q in zip(P[:-1], P[1:]):
            r = B - A; s_ = q - p; den = r[0] * s_[1] - r[1] * s_[0]
            if abs(den) < 1e-12: continue
            u = ((p[0] - A[0]) * s_[1] - (p[1] - A[1]) * s_[0]) / den
            v = ((p[0] - A[0]) * r[1] - (p[1] - A[1]) * r[0]) / den
            if 0 <= u <= 1 and 0 <= v <= 1: out.append((u, (A + u * r).tolist()))
    return out


def main():
    V = {'base_km2': BASE_KM2, 'rings': {}, 'area': {}, 'north': {}, 'points': {}}
    for y in (1977, 1989, 2000, 2009, 2014, 2025):
        name = f'r{y}'
        if name not in INFO: continue
        V['rings'][str(y)] = rings_of(name, clip=(57.6, 43.3, 62.2, 47.2))
        a = INFO[name]['water_km2']
        V['area'][str(y)] = {'km2': a, 'pct': round(100 * a / BASE_KM2, 1)}
        print(y, f'{a:,.0f} km2', f"{100 * a / BASE_KM2:.1f}%", 'rings', len(V['rings'][str(y)]), sum(len(l) for l in V['rings'][str(y)]), 'pts')
    # north sea rings from the detail plates (only the part around the north basin)
    for y in (2001, 2009, 2025):
        name = f'ko{y}'
        if name not in INFO: continue
        V['north'][str(y)] = rings_of(name, min_km=6, sigma=1.2, eps=0.5)
    # Natural Earth: the historic sea (map layer) and today's two seas
    ne = json.load(open(os.path.join(DEMO, 'assets/raw/ne/ne_10m_lakes_historic.geojson')))
    for f in ne['features']:
        if f['properties'].get('name') == 'Aral Sea':
            g = f['geometry']; polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
            V['historic'] = [[[round(x, 4), round(y, 4)] for x, y in ring] for poly in polys for ring in poly]
    # area of the historic polygon (spherical excess approx via local projection)
    def parea(ring):
        r = np.radians(np.asarray(ring)); lat0 = r[:, 1].mean()
        x = r[:, 0] * np.cos(lat0) * 6371.0088; y = r[:, 1] * 6371.0088
        return abs(0.5 * np.sum(x[:-1] * y[1:] - x[1:] * y[:-1]))
    V['historic_km2'] = round(parea(V['historic'][0]) - sum(parea(r) for r in V['historic'][1:]), 0)
    print('NE historic polygon', V['historic_km2'], 'km2')
    V['points']['muynak'] = list(MUYNAK_PORT)
    V['points']['landing'] = list(LANDING)
    # Muynak -> today's sea: the remaining South Aral (its western basin), measured on the 2025 mosaic
    WEST_SEED = (58.45, 44.9)
    for name in ('mu2025', 'r2025'):
        if name in INFO:
            try:
                d, p = nearest_water(name, *MUYNAK_PORT, seed=WEST_SEED if name == 'r2025' else None)
            except ValueError:
                continue
            V['points']['edge_' + name] = p; V['points']['dist_' + name] = round(d, 1)
            print('Muynak -> nearest sea water on', name, f'{d:.1f} km at', p)
    d = V['points'].get('dist_r2025')
    if d:
        V['points']['edge'] = V['points']['edge_r2025']; V['points']['dist_km'] = d
        V['points']['dist_txt'] = str(int(d + .5))
        V['points']['dist_say'] = words(int(d + .5))
    # transect across the eastern basin: where each year's shore crosses it (east-most crossing)
    TLAT = 45.05
    V['transect'] = [[61.55, TLAT], [58.2, TLAT]]
    V['cross'] = {}
    for y, lines in V['rings'].items():
        xs = [x for x in crossings(lines, TLAT) if 58.2 <= x <= 61.55]
        if xs: V['cross'][y] = [round(max(xs), 4), TLAT]
    print('transect crossings', V['cross'])
    json.dump(V, open(os.path.join(DEMO, 'assets/vectors.json'), 'w'), separators=(',', ':'))
    print('wrote assets/vectors.json', os.path.getsize(os.path.join(DEMO, 'assets/vectors.json')) // 1024, 'KB')


if __name__ == '__main__':
    main()
