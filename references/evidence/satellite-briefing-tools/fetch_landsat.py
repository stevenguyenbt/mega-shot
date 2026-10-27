"""Fetch co-registered Landsat plates (public domain, USGS) through the Microsoft
Planetary Computer STAC + data API. The server reprojects each scene to a
lon/lat bbox; we composite the scenes of one year onto one plate grid.

usage: python -I tools/fetch_landsat.py <demo_dir> <plate_name> [--list]
Plates are defined in tools/plates_spec.json. Raw arrays are cached in
assets/raw/landsat/<plate>/<item>.npz; the composite goes to
assets/raw/landsat/<plate>.npz (bands float32 0..1 reflectance-ish + valid mask).
Every request URL is appended to assets/raw/manifest.jsonl.
"""
import json, sys, os, io, math, time, urllib.request, urllib.parse, datetime
from concurrent.futures import ThreadPoolExecutor
import numpy as np

STAC = 'https://planetarycomputer.microsoft.com/api/stac/v1/search'
DATA = 'https://planetarycomputer.microsoft.com/api/data/v1/item/bbox'
CHUNK = 1400


def http(url, data=None, tries=5, timeout=180):
    for k in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json', 'User-Agent': 'lemo-opuscar-film/1.0'})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:
            if k == tries - 1:
                raise
            time.sleep(2 + 3 * k)


def search(spec):
    body = {'collections': [spec['collection']], 'bbox': spec['bbox'], 'datetime': spec['datetime'], 'limit': 250}
    q = {}
    if spec.get('platforms'):
        q['platform'] = {'in': spec['platforms']}
    if q:
        body['query'] = q
    feats = json.loads(http(STAC, json.dumps(body).encode()))['features']
    return feats


def choose(spec, feats):
    """One acquisition date per WRS path (adjacent rows then match), central paths first;
    rows the chosen date misses are filled from the best other date."""
    if spec.get('items'):
        byid = {f['id']: f for f in feats}
        return [byid[i] for i in spec['items'] if i in byid]
    target = datetime.datetime.fromisoformat(spec['target'])
    w, s_, e, n = spec['plate']; cx = (w + e) / 2; cy = (s_ + n) / 2
    ok = []
    for f in feats:
        p = f['properties']
        if any(x in f['id'] for x in spec.get('exclude', [])):   # e.g. a scene with a dust plume over the sea
            continue
        if p.get('eo:cloud_cover', 100) > spec.get('max_cloud', 20):
            continue
        if 'L1GS' in f['id'] or 'L1GT' in f['id']:
            continue
        bw, bs, be, bn = f['bbox']
        if be < w or bw > e or bn < s_ or bs > n:
            continue
        ok.append(f)
    def date(f): return f['properties']['datetime'][:10]
    def dd(f): return abs((datetime.datetime.fromisoformat(date(f)) - target).days)
    paths = {}
    for f in ok:
        paths.setdefault(f['properties']['landsat:wrs_path'], []).append(f)
    prim, rest = [], []
    for path, fs in paths.items():
        bydate = {}
        for f in fs:
            bydate.setdefault(date(f), []).append(f)
        best = max(bydate.values(), key=lambda g: (len({x['properties']['landsat:wrs_row'] for x in g}), -sum(x['properties'].get('eo:cloud_cover', 0) for x in g) / len(g) * .5 - dd(g[0]) * spec.get('date_w', 1.0)))
        prim += best
        rows = {x['properties']['landsat:wrs_row'] for x in best}
        for f in sorted(fs, key=lambda f: f['properties'].get('eo:cloud_cover', 0) * 3 + dd(f) * .25):
            r = f['properties']['landsat:wrs_row']
            if r not in rows:
                rows.add(r); rest.append(f)
    def central(f):
        bw, bs, be, bn = f['bbox']
        return abs((bw + be) / 2 - cx) + .3 * abs((bs + bn) / 2 - cy)
    return sorted(prim, key=central) + sorted(rest, key=central)


def grid(spec):
    w, s, e, n = spec['plate']
    dlon = spec['dlon']
    dlat = dlon * math.cos(math.radians(spec.get('lat0', 45.0)))
    W = int(round((e - w) / dlon)); H = int(round((n - s) / dlat))
    return w, n, dlon, dlat, W, H


def fetch_scene(demo, name, spec, f, log):
    rs = spec.get('resampling', 'bilinear')
    cache = os.path.join(demo, 'assets/raw/landsat', name + ('' if rs == 'bilinear' else '_' + rs), f['id'] + '.npz')
    if os.path.exists(cache):
        return cache
    w0, n0, dlon, dlat, W, H = grid(spec)
    bw, bs, be, bn = f['bbox']
    x0 = max(0, int(math.floor((bw - w0) / dlon))); x1 = min(W, int(math.ceil((be - w0) / dlon)))
    y0 = max(0, int(math.floor((n0 - bn) / dlat))); y1 = min(H, int(math.ceil((n0 - bs) / dlat)))
    if x1 <= x0 or y1 <= y0:
        return None
    bands = spec['bands']
    nb = len(bands)
    arr = np.zeros((nb, y1 - y0, x1 - x0), np.uint16)
    msk = np.zeros((y1 - y0, x1 - x0), np.uint8)
    jobs = []
    for cy in range(y0, y1, CHUNK):
        for cx in range(x0, x1, CHUNK):
            cw = min(CHUNK, x1 - cx); ch = min(CHUNK, y1 - cy)
            bb = (w0 + cx * dlon, n0 - (cy + ch) * dlat, w0 + (cx + cw) * dlon, n0 - cy * dlat)
            qs = [('collection', spec['collection']), ('item', f['id'])] + [('assets', b) for b in bands] + [('resampling', rs), ('reproject', rs)]
            url = f"{DATA}/{bb[0]:.6f},{bb[1]:.6f},{bb[2]:.6f},{bb[3]:.6f}/{cw}x{ch}.npy?" + urllib.parse.urlencode(qs)
            jobs.append((cx, cy, cw, ch, url))

    def get(j):
        cx, cy, cw, ch, url = j
        raw = http(url)
        a = np.load(io.BytesIO(raw), allow_pickle=False)
        return j, a

    with ThreadPoolExecutor(4) as ex:
        for (cx, cy, cw, ch, url), a in ex.map(get, jobs):
            arr[:, cy - y0:cy - y0 + ch, cx - x0:cx - x0 + cw] = a[:nb]
            msk[cy - y0:cy - y0 + ch, cx - x0:cx - x0 + cw] = (a[nb] > 0)
            log.write(json.dumps({'plate': name, 'item': f['id'], 'url': url, 'accessed': datetime.date.today().isoformat()}) + '\n')
    os.makedirs(os.path.dirname(cache), exist_ok=True)
    np.savez_compressed(cache, arr=arr, msk=msk, x0=x0, y0=y0)
    return cache


def dropouts(arr):
    """thin structures where every MSS band is near zero (scan-line dropouts); wide dark areas (water) are kept"""
    from scipy import ndimage
    low = arr.max(0) < 15
    wide = ndimage.binary_opening(low, structure=np.ones((5, 5)))
    return ndimage.binary_dilation(low & ~wide, iterations=1)


SCAN_DEG = 12.1     # MSS scan lines run at this angle (down-right) on the lon/lat plate grid around the Aral


def destripe(a, off=12, grow=11, thr=0.025):
    """MSS scan-line dropouts: long, thin, straight streaks along the scan direction. Rotate so the scan
    lines are horizontal; a pixel belongs to a streak when it differs from the land 12 px above and below
    it, consistently along 61 px of scan line. Streak pixels are replaced by the average of the land above
    and below; water and coasts are left alone (the shoreline is the measurement)."""
    from scipy import ndimage
    nir = a[-1]
    wet = ndimage.binary_dilation(nir < 0.09, iterations=14)
    for b in range(a.shape[0]):
        x = a[b]
        r = ndimage.rotate(x, SCAN_DEG, reshape=True, order=1, mode='nearest')
        w = ndimage.rotate(wet.astype(np.float32), SCAN_DEG, reshape=True, order=0) > .5
        nb = 0.5 * (np.roll(r, off, 0) + np.roll(r, -off, 0))
        d = r - nb
        dl = ndimage.uniform_filter1d(d, 61, axis=1)
        core = (np.abs(dl) > thr) & ~w
        m = ndimage.binary_dilation(core, structure=np.ones((grow, 1))) & ~w
        fix = np.where(m, nb, r)
        H, W = x.shape
        mb = ndimage.rotate(m.astype(np.float32), -SCAN_DEG, reshape=True, order=1)
        fb = ndimage.rotate(fix, -SCAN_DEG, reshape=True, order=1)
        oy = (mb.shape[0] - H) // 2; ox = (mb.shape[1] - W) // 2
        mb = mb[oy:oy + H, ox:ox + W]; fb = fb[oy:oy + H, ox:ox + W]
        sel = mb > 0.5
        x[sel] = fb[sel]
    return a


def to_refl(spec, arr):
    a = arr.astype(np.float32)
    if spec['collection'] == 'landsat-c2-l2':
        return np.clip(a * 2.75e-5 - 0.2, 0, 1)   # USGS C2 L2 surface reflectance scale/offset
    return a / 255.0                               # MSS L1 DN (8-bit) as-is


def main():
    demo, name = sys.argv[1], sys.argv[2]
    specs = json.load(open(os.path.join(demo, 'tools/plates_spec.json')))
    spec = specs[name]
    feats = search(spec)
    sel = choose(spec, feats)
    print(f'{name}: {len(feats)} found, {len(sel)} chosen')
    for f in sel:
        p = f['properties']; print('  ', f['id'], p['datetime'][:10], 'cc', p.get('eo:cloud_cover'))
    if '--list' in sys.argv:
        return
    os.makedirs(os.path.join(demo, 'assets/raw'), exist_ok=True)
    w0, n0, dlon, dlat, W, H = grid(spec)
    nb = len(spec['bands'])
    comp = np.zeros((nb, H, W), np.float32)
    have = np.zeros((H, W), bool)
    src = np.full((H, W), 255, np.uint8)      # which scene (index into meta.scenes) each pixel came from
    used = []
    from scipy import ndimage
    with open(os.path.join(demo, 'assets/raw/manifest.jsonl'), 'a') as log:
        for f in sel:
            c = fetch_scene(demo, name, spec, f, log)
            if not c:
                continue
            z = np.load(c, allow_pickle=False)
            x0, y0 = int(z['x0']), int(z['y0'])
            a = to_refl(spec, z['arr']); m = z['msk'].astype(bool)
            m &= (z['arr'][:2] > 0).all(0)          # dropped lines / fill are DN 0 (not low reflectance: water SWIR is ~0)
            if spec['collection'] == 'landsat-c2-l1': m &= ~dropouts(z['arr'])   # MSS dropout lines: thin rows with every band near zero
            m = ndimage.binary_erosion(m, iterations=3 if spec.get('resampling') == 'nearest' else 6)   # scene rims: resampling against nodata
            if spec['collection'] == 'landsat-c2-l1':
                a = destripe(a, 3, 3, .02) if spec.get('resampling') == 'nearest' else destripe(a)
            h, w = m.shape
            sub = have[y0:y0 + h, x0:x0 + w]
            ov = m & sub
            if ov.sum() > 4000:
                for b in range(nb):
                    r = np.median(comp[b, y0:y0 + h, x0:x0 + w][ov]) / max(1e-4, np.median(a[b][ov]))
                    a[b] *= float(np.clip(r, .75, 1.33))
            put = m & ~sub
            # feather: inside the overlap, blend the new scene in over 40 px from the old coverage's edge
            if ov.any():
                d = ndimage.distance_transform_edt(sub)
                wgt = np.clip(1 - d / 40.0, 0, 1) * ov
                for b in range(nb):
                    cb = comp[b, y0:y0 + h, x0:x0 + w]
                    cb[ov] = cb[ov] * (1 - wgt[ov]) + a[b][ov] * wgt[ov]
            for b in range(nb):
                comp[b, y0:y0 + h, x0:x0 + w][put] = a[b][put]
            src[y0:y0 + h, x0:x0 + w][put] = len(used)
            sub |= put
            used.append({'id': f['id'], 'date': f['properties']['datetime'][:10], 'cloud': f['properties'].get('eo:cloud_cover'), 'pixels': int(put.sum())})
    # gap fill: holes left by missing / cloudy rows are filled from a wider window with a looser cloud limit
    if (~have).mean() > 0.002 and spec.get('fill_datetime'):
        fs = dict(spec); fs['datetime'] = spec['fill_datetime']; fs['max_cloud'] = spec.get('fill_cloud', 40)
        cand = [f for f in search(fs) if f['id'] not in {u['id'] for u in used} and 5 <= int(f['properties']['datetime'][5:7]) <= 10 and f['properties'].get('eo:cloud_cover', 100) <= fs['max_cloud']]   # summer only; fill may use L1GS (systematic) scenes
        cand.sort(key=lambda f: (('L1GS' in f['id']) * 50 + f['properties'].get('eo:cloud_cover', 100)))
        # holes worth filling: inside the plate, away from its rim (the rim may simply lie outside every path)
        rim = 40
        hole = ~have; hole[:rim] = hole[-rim:] = False; hole[:, :rim] = hole[:, -rim:] = False
        tried = 0
        with open(os.path.join(demo, 'assets/raw/manifest.jsonl'), 'a') as log:
            for f in cand:
                if hole.sum() < 2000 or tried >= spec.get('fill_max', 8):
                    break
                bw, bs, be, bn = f['bbox']
                # the footprint is a rotated square: test only its central 60 %
                cxm, cym = (bw + be) / 2, (bs + bn) / 2; hw, hh = (be - bw) * .3, (bn - bs) * .3
                x0 = max(0, int((cxm - hw - w0) / dlon)); x1 = min(W, int((cxm + hw - w0) / dlon) + 1)
                y0 = max(0, int((n0 - cym - hh) / dlat)); y1 = min(H, int((n0 - cym + hh) / dlat) + 1)
                if x1 <= x0 or y1 <= y0 or hole[y0:y1, x0:x1].sum() < 2000:
                    continue
                tried += 1
                c = fetch_scene(demo, name, spec, f, log)
                if not c:
                    continue
                z = np.load(c, allow_pickle=False)
                x0, y0 = int(z['x0']), int(z['y0'])
                a = to_refl(spec, z['arr']); m = z['msk'].astype(bool) & (z['arr'][:2] > 0).all(0)
                if spec['collection'] == 'landsat-c2-l1': m &= ~dropouts(z['arr'])
                m = ndimage.binary_erosion(m, iterations=14 if spec['collection'] == 'landsat-c2-l1' else 6)
                if spec['collection'] == 'landsat-c2-l1':
                    a = destripe(a, 3, 3, .02) if spec.get('resampling') == 'nearest' else destripe(a)
                h, w = m.shape
                sub = have[y0:y0 + h, x0:x0 + w]
                ov = m & sub
                if ov.sum() > 4000:
                    for b in range(nb):
                        r = np.median(comp[b, y0:y0 + h, x0:x0 + w][ov]) / max(1e-4, np.median(a[b][ov]))
                        a[b] *= float(np.clip(r, .75, 1.33))
                put = m & ~sub
                for b in range(nb):
                    comp[b, y0:y0 + h, x0:x0 + w][put] = a[b][put]
                src[y0:y0 + h, x0:x0 + w][put] = len(used)
                sub |= put
                hole[y0:y0 + h, x0:x0 + w] &= ~put
                used.append({'id': f['id'], 'date': f['properties']['datetime'][:10], 'cloud': f['properties'].get('eo:cloud_cover'), 'pixels': int(put.sum()), 'fill': True})
    # thin holes (scan-line dropouts the overlapping scenes did not cover): fill from the neighbours
    gap = ~have & (ndimage.distance_transform_edt(~have) <= 5)
    if gap.any():
        wv = ndimage.gaussian_filter(have.astype(np.float32), 2.5)
        for b in range(nb):
            fv = ndimage.gaussian_filter(comp[b] * have, 2.5)
            comp[b][gap] = (fv / np.maximum(wv, 1e-6))[gap]
        have |= gap & (wv > 0.05)
    out = os.path.join(demo, 'assets/raw/landsat', name + '.npz')
    np.savez_compressed(out, bands=comp.astype(np.float16), valid=have, src=src, meta=json.dumps({'name': name, 'bands': spec['bands'], 'plate': spec['plate'], 'dlon': dlon, 'dlat': dlat, 'W': W, 'H': H, 'scenes': used}))
    print(f'wrote {out}  {W}x{H}  coverage {have.mean():.3f}')
    for u in used:
        print('   used', u)


if __name__ == '__main__':
    main()
