"""Turn raw Landsat composites (assets/raw/landsat/<plate>.npz) into film plates:

  assets/plates/<plate>.jpg     true colour, one shared stretch for every year (so years compare)
  assets/plates/<plate>_w.png   soft water mask (MNDWI / MSS NIR), cleaned to the sea basins
  assets/plates/plates.json     bbox, size, scene list, measured water area per plate

usage: python -I tools/plates.py <demo_dir> [plate ...]
"""
import sys, os, json, math
import numpy as np
from PIL import Image
from scipy import ndimage

DEMO = sys.argv[1]
RAW = os.path.join(DEMO, 'assets/raw/landsat')
OUT = os.path.join(DEMO, 'assets/plates'); os.makedirs(OUT, exist_ok=True)
REF = 'r2025'          # every plate is matched to this one's land
# one stretch for all plates (surface reflectance → display), chosen on the 2025 desert
LO, HI, GAMMA = 0.02, 0.42, 1 / 1.55


def load(name):
    z = np.load(os.path.join(RAW, name + '.npz'), allow_pickle=False)
    meta = json.loads(str(z['meta']))
    b = {n: z['bands'][i].astype(np.float32) for i, n in enumerate(meta['bands'])}
    return b, z['valid'], meta


def lonlat(meta):
    w, s, e, n = meta['plate']
    lon = w + (np.arange(meta['W']) + .5) * meta['dlon']
    lat = n - (np.arange(meta['H']) + .5) * meta['dlat']
    return lon, lat


def pix_area_km2(meta):
    lon, lat = lonlat(meta)
    return (meta['dlon'] * 111.32 * np.cos(np.radians(lat)) * meta['dlat'] * 110.57)[:, None]


def quantile_match(x, src_mask, ref_vals):
    """map x so that its distribution over src_mask matches ref_vals"""
    q = np.linspace(0.5, 99.5, 120)
    a = np.percentile(x[src_mask], q); r = np.percentile(ref_vals, q)
    a = np.maximum.accumulate(a + np.arange(len(a)) * 1e-6)
    return np.interp(x, a, r)


def clean_lines(b, valid, angle, win=21, along=61, thr=0.012):
    """Remove long straight streaks running at `angle` degrees on the plate (MSS scan-line dropouts at ~12 deg,
    request-chunk seams at 0 deg): rotate so they are horizontal, compare each pixel with the median of a
    tall across-line window, keep only residuals that persist along the line, replace them with that median.
    Water and coasts are left untouched (the shoreline is the measurement)."""
    nir = b.get('nir09', b.get('nir08'))
    wet = ndimage.binary_dilation((ndimage.median_filter(nir, 9) < 0.09) & valid, iterations=10)   # thin dark streaks are not water
    out = {}
    for k, x in b.items():
        r = ndimage.rotate(x, angle, reshape=True, order=1, mode='nearest') if angle else x
        w = (ndimage.rotate(wet.astype(np.float32), angle, reshape=True, order=0) > .5) if angle else wet
        med = ndimage.median_filter(r, size=(win, 1))
        res = r - med
        lr = ndimage.uniform_filter1d(res, along, axis=1)
        m = (np.abs(lr) > thr) & (np.abs(res) > thr * 1.2) & ~w
        m = ndimage.binary_dilation(m, structure=np.ones((3, 1)))
        if angle:
            H, W = x.shape
            mb = ndimage.rotate(m.astype(np.float32), -angle, reshape=True, order=1)
            fb = ndimage.rotate(med, -angle, reshape=True, order=1)
            oy = (mb.shape[0] - H) // 2; ox = (mb.shape[1] - W) // 2
            mb = mb[oy:oy + H, ox:ox + W] > .4; fb = fb[oy:oy + H, ox:ox + W]
        else:
            mb, fb = m, med
        y = x.copy(); y[mb] = fb[mb]; out[k] = y
    return out


def clean_rows(b, valid):
    """1-px horizontal seams where server request chunks meet: a row that differs from the rows above and
    below consistently along 61 px (water included: the sea is smooth there)"""
    out = {}
    for k, x in b.items():
        up = np.roll(x, 1, 0); dn = np.roll(x, -1, 0)
        d = x - 0.5 * (up + dn)
        dl = ndimage.uniform_filter1d(d, 61, axis=1)
        bad = (np.abs(dl) > 0.003) & (np.abs(d) > 0.003)
        y = x.copy(); y[bad] = 0.5 * (up[bad] + dn[bad]); out[k] = y
    return out


def destreak_rgb(img, wet, angles=(11.2, 11.8, 12.4, 13.0), win=25, along=81, thr=0.012):
    """Last pass on the finished colour plate: long straight streaks (darker or brighter than the land
    around them) at the MSS scan angles are replaced by the across-streak median. Water is left alone."""
    for ang in angles:
        lum = img.mean(-1)
        r = ndimage.rotate(lum, ang, reshape=True, order=1, mode='nearest')
        w = ndimage.rotate(wet.astype(np.float32), ang, reshape=True, order=0) > .5
        med = ndimage.median_filter(r, size=(win, 1))
        res = r - med
        lr = ndimage.uniform_filter1d(res, along, axis=1)
        m = (np.abs(lr) > thr) & (np.abs(res) > thr) & ~w
        m = ndimage.binary_dilation(m, structure=np.ones((5, 1)))
        H, W = lum.shape
        mb = ndimage.rotate(m.astype(np.float32), -ang, reshape=True, order=1)
        oy = (mb.shape[0] - H) // 2; ox = (mb.shape[1] - W) // 2
        mb = mb[oy:oy + H, ox:ox + W] > .3
        if not mb.any(): continue
        for c in range(3):
            ch = ndimage.rotate(img[..., c], ang, reshape=True, order=1, mode='nearest')
            mc = ndimage.median_filter(ch, size=(win, 1))
            fb = ndimage.rotate(mc, -ang, reshape=True, order=1)[oy:oy + H, ox:ox + W]
            img[..., c][mb] = fb[mb]
    return img


def water(b, valid, meta):
    if 'swir16' in b:
        mndwi = (b['green'] - b['swir16']) / (b['green'] + b['swir16'] + 1e-6)
        ndwi = (b['green'] - b['nir08']) / (b['green'] + b['nir08'] + 1e-6)
        w = np.clip((mndwi - 0.0) / 0.25, 0, 1) * np.clip((ndwi + 0.15) / 0.2, 0, 1)
    else:   # MSS: water is black in the 0.8-1.1 um band
        nir = b['nir09']
        ndwi = (b['green'] - nir) / (b['green'] + nir + 1e-6)
        w = np.clip((ndwi - 0.15) / 0.2, 0, 1) * np.clip((0.085 - nir) / 0.04, 0, 1)
    w = ndimage.gaussian_filter(w, 1.0) * valid
    return w


def historic_mask(meta):
    """the Natural Earth historic Aral Sea polygon, rasterised on this plate (slightly grown)"""
    from PIL import ImageDraw
    ne = json.load(open(os.path.join(DEMO, 'assets/raw/ne/ne_10m_lakes_historic.geojson')))
    w0, s, e, n0 = meta['plate']
    im = Image.new('L', (meta['W'], meta['H']), 0); d = ImageDraw.Draw(im)
    for f in ne['features']:
        if f['properties'].get('name') != 'Aral Sea': continue
        g = f['geometry']; polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
        for poly in polys:
            for k, ring in enumerate(poly):
                pts = [((x - w0) / meta['dlon'], (n0 - y) / meta['dlat']) for x, y in ring]
                d.polygon(pts, fill=255 if k == 0 else 0)
    m = np.asarray(im) > 0
    return ndimage.binary_dilation(m, iterations=max(1, int(0.03 / meta['dlon'])))


def clean(w, meta, min_km2=25.0):
    """keep water bodies inside the historic sea that are larger than min_km2; close small gaps"""
    m = w > 0.5
    m = ndimage.binary_opening(m, iterations=1)
    m = ndimage.binary_closing(m, iterations=2)
    lab, n = ndimage.label(m)
    if n == 0: return m
    pa = float(pix_area_km2(meta).mean())
    sizes = ndimage.sum(m, lab, range(1, n + 1)) * pa
    hist = historic_mask(meta)
    inside = ndimage.sum(hist, lab, range(1, n + 1)) > 0
    keep = np.zeros(n + 1, bool); keep[1:] = (sizes >= min_km2) & inside
    sea = keep[lab]
    # fill islands smaller than ~3 km2 so contours stay readable
    holes = ndimage.binary_fill_holes(sea) & ~sea
    hl, hn = ndimage.label(holes)
    if hn:
        hs = ndimage.sum(holes, hl, range(1, hn + 1)) * pa
        sea |= np.isin(hl, 1 + np.where(hs < 3.0)[0])
    return sea


# water seed points (lon, lat): open water somewhere in each basin in each year it existed
SEEDS = [(59.2, 45.3), (58.5, 44.9), (58.35, 44.3), (60.6, 45.4), (59.9, 44.5), (61.05, 46.35), (60.3, 46.45), (61.3, 46.6), (59.6, 46.0), (58.6, 45.9), (61.4, 46.25), (60.75, 46.15), (60.2, 46.0), (59.35, 45.65)]


def bmng_on(meta):
    """NASA Blue Marble (Central Asia, 2004 composite) resampled onto this plate, display units 0..1"""
    ca = np.asarray(Image.open(os.path.join(DEMO, 'assets/raw/gibs/ca.jpg')).convert('RGB'), np.float32) / 255
    lon, lat = lonlat(meta)
    xi = np.clip(((lon - 40) / 40 * ca.shape[1]).astype(int), 0, ca.shape[1] - 1)
    yi = np.clip(((60 - lat) / 30 * ca.shape[0]).astype(int), 0, ca.shape[0] - 1)
    return ca[yi[:, None], xi[None, :]]


def normalise_scenes(img, src, valid, wsoft, meta, scenes):
    """one gain per scene and channel so every scene agrees with Blue Marble on stable land
    (outside the historic sea, not water, not salt-white); gains are smoothed across seams"""
    bm = bmng_on(meta)
    hist = historic_mask(meta)
    hist = ndimage.binary_dilation(hist, iterations=max(1, int(0.25 / meta['dlon'])))
    land = valid & ~hist & (wsoft < .05) & (img.max(-1) < .92) & (img.min(-1) > .04)
    G = np.ones((len(scenes) + 1, 3), np.float32)
    for k in range(len(scenes)):
        sel = land & (src == k)
        if sel.sum() < 3000: continue
        for c in range(3):
            G[k, c] = np.clip(np.median(bm[..., c][sel]) / max(1e-3, np.median(img[..., c][sel])), .6, 1.6)
    # scenes without enough stable land: borrow the median gain
    good = [k for k in range(len(scenes)) if (land & (src == k)).sum() >= 3000]
    if good:
        med = np.median(G[good], 0)
        for k in range(len(scenes)):
            if k not in good: G[k] = med
    G[-1] = np.median(G[:-1], 0)
    idx = np.where(src == 255, len(scenes), np.minimum(src, len(scenes)))
    gf = G[idx]
    sig = max(2.0, 8.0 / (meta['dlon'] * 111.32 * .7))          # ~8 km
    for c in range(3):
        gf[..., c] = ndimage.gaussian_filter(gf[..., c], sig)
    return np.clip(img * gf, 0, 1), G


def main():
    names = sys.argv[2:] or sorted(f[:-4] for f in os.listdir(RAW) if f.endswith('.npz'))
    rb, rv, rm = load(REF)
    ref_lum = {}
    # reference land: valid, not water, not cloud-bright
    rw = water(rb, rv, rm) > 0.2
    for k in ('red', 'green', 'blue'):
        v = rb[k][rv & ~rw]
        ref_lum[k] = v[np.random.default_rng(1).integers(0, v.size, 400000)]
    info = json.load(open(os.path.join(OUT, 'plates.json'))) if os.path.exists(os.path.join(OUT, 'plates.json')) else {}
    for name in names:
        b, valid, meta = load(name)
        if name == 'r1977':        # Landsat 2 MSS: scan-line dropouts and chunk seams
            b = clean_rows(b, valid)
            for _ in range(3):
                b = clean_lines(b, valid, 12.1, thr=0.009)
        wsoft = water(b, valid, meta)
        if 'blue' not in b:   # MSS false → natural-looking colour by matching each channel to the reference land
            land = valid & (wsoft < 0.2)
            rgb = {'red': quantile_match(b['red'], land, ref_lum['red']), 'green': quantile_match(b['green'], land, ref_lum['green'])}
            rgb['blue'] = quantile_match(b['green'] * .6 + b['red'] * .4, land, ref_lum['blue'])
            # water in MSS visible bands is too bright after matching: darken by the nir water signal
            for k in rgb:
                rgb[k] = rgb[k] * (1 - .45 * wsoft)
        else:
            rgb = {k: b[k] for k in ('red', 'green', 'blue')}
            if name != REF and name.startswith('r'):
                land = valid & (wsoft < 0.2)
                for k in rgb:   # gentle match (half way) so sensors agree without erasing real change
                    m = quantile_match(rgb[k], land, ref_lum[k])
                    rgb[k] = rgb[k] * .5 + m * .5
        img = np.stack([rgb['red'], rgb['green'], rgb['blue']], -1)
        img = np.clip((img - LO) / (HI - LO), 0, 1) ** GAMMA
        z = np.load(os.path.join(RAW, name + '.npz'), allow_pickle=False)
        if 'src' in z.files:
            img, G = normalise_scenes(img, z['src'], valid, wsoft, meta, meta['scenes'])
            # gap-fill scenes come from other dates or systematic processing: match their water to the main scenes'
            src = z['src']; fills = [k for k, sc in enumerate(meta['scenes']) if sc.get('fill')]
            wet = (wsoft > 0.5) & valid
            main = wet & ~np.isin(src, fills)
            for k in fills:
                sel = wet & (src == k)
                if sel.sum() > 500 and main.sum() > 5000:
                    g = np.median(img[main], 0) / np.maximum(np.median(img[sel], 0), 1e-3)
                    w = ndimage.gaussian_filter(sel.astype(np.float32), 3)[..., None]
                    img = img * (1 - w) + np.clip(img * g, 0, 1) * w
        img[~valid] = bmng_on(meta)[~valid]          # holes at the rims: Blue Marble underneath
        if name == 'r1977':
            wet = ndimage.binary_dilation(ndimage.median_filter(wsoft, 9) > .3, iterations=8)
            img = destreak_rgb(img, wet)
            # inside the sea: faint horizontal seams and scan streaks on near-black water
            core = ndimage.binary_erosion(ndimage.median_filter(wsoft, 9) > .5, iterations=6)
            img = destreak_rgb(img, ~core, angles=(0.0, 12.1), win=15, along=61, thr=0.004)
        if name == 'r1989':        # a thin bright streak (contrail / scan glitch) across the open water
            core = ndimage.binary_erosion(ndimage.median_filter(wsoft, 9) > .5, iterations=4)
            img = destreak_rgb(img, ~core, angles=(-21.0, -18.0, -15.5, -13.0, -10.0), win=17, along=41, thr=0.01)
        Image.fromarray((img * 255 + .5).astype(np.uint8)).save(os.path.join(OUT, name + '.jpg'), quality=92)
        sea = clean(wsoft, meta)
        soft = ndimage.gaussian_filter(sea.astype(np.float32), 1.2)
        Image.fromarray((soft * 255 + .5).astype(np.uint8)).save(os.path.join(OUT, name + '_w.png'), optimize=True)
        area = float((sea * pix_area_km2(meta)).sum())
        info[name] = {'plate': meta['plate'], 'W': meta['W'], 'H': meta['H'], 'dlon': meta['dlon'], 'dlat': meta['dlat'],
                      'scenes': meta['scenes'], 'water_km2': round(area, 1), 'coverage': round(float(valid.mean()), 4)}
        print(f"{name}: {meta['W']}x{meta['H']} water {area:,.0f} km2 coverage {valid.mean():.3f}")
    json.dump(info, open(os.path.join(OUT, 'plates.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
