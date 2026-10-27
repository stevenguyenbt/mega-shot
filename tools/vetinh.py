"""mega-shot · `xp vetinh` — real satellite imagery plates for a place (the "Satellite Briefing" evidence style, adapted from
lemo-opuscar, MIT · references/evidence/). No keys, no Google/Bing/Esri/Mapbox basemaps.

  xp vetinh <name> --center LAT,LON [--km 20] [--date 2026-09-01/2026-10-20] [--cloud 15] [--to videos/x]
      → <video>/ve_tinh/<name>/: vung.jpg (region, NASA Blue Marble), giua.webp (Sentinel-2, 4× span), chi_tiet.webp (Sentinel-2,
        --km wide, 10 m pixels), meta.json (lon/lat box of every plate, scene ids + dates, credit line). Scenes: newest
        clear Sentinel-2 L2A pass in the window, mosaicked from several tiles when the box crosses one.
      --before 2022-01-01/2022-03-01 also fetches truoc.webp (same box as chi_tiet) for a before/after scan.

Imagery (all free to reuse with credit, logged in meta.json "credit"):
  Sentinel-2 L2A — "Contains modified Copernicus Sentinel data <year>" (Copernicus open licence), via Microsoft Planetary
  Computer STAC + data API (server reprojects to a lon/lat box). NASA Blue Marble: Next Generation via NASA GIBS (public domain).
Use in a scene: `ve_tinh: { thu_muc: ve_tinh/<name>, diem: [...], duong: [...], vung: [...] }` (templates/tin-tuc, engine/core/vetinh.js).
"""
import datetime, io, json, math, os, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

STAC = 'https://planetarycomputer.microsoft.com/api/stac/v1/search'
DATA = 'https://planetarycomputer.microsoft.com/api/data/v1/item/bbox'
WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi'
CHUNK = 1200


def http(url, data=None, tries=5, timeout=180):
    for k in range(tries):
        try:
            rq = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json', 'User-Agent': 'mega-shot/1.3 (news video)'})
            with urllib.request.urlopen(rq, timeout=timeout) as r: return r.read()
        except Exception:
            if k == tries - 1: raise
            time.sleep(2 + 3 * k)


def box(lat, lon, km_w, km_h):
    dlat = km_h / 111.32 / 2; dlon = km_w / (111.32 * math.cos(math.radians(lat))) / 2
    return [round(lon - dlon, 6), round(lat - dlat, 6), round(lon + dlon, 6), round(lat + dlat, 6)]


def size(b, lat, long_px):
    kw = (b[2] - b[0]) * 111.32 * math.cos(math.radians(lat)); kh = (b[3] - b[1]) * 111.32
    return (long_px, max(64, round(long_px * kh / kw))) if kw >= kh else (max(64, round(long_px * kw / kh)), long_px)


def search(b, when, cloud):
    body = {'collections': ['sentinel-2-l2a'], 'bbox': b, 'datetime': when, 'limit': 100,
            'query': {'eo:cloud_cover': {'lt': cloud}}, 'sortby': [{'field': 'datetime', 'direction': 'desc'}]}
    return json.loads(http(STAC, json.dumps(body).encode()))['features']


def mosaic(b, W, H, feats, log):
    """Newest clear date first; fill the box from that date's tiles, then older ones, until ≥ 99 % covered."""
    from PIL import Image
    out = Image.new('RGBA', (W, H)); used = []
    bydate = {}
    for f in feats: bydate.setdefault(f['properties']['datetime'][:10], []).append(f)
    best = {d: min(f['properties']['eo:cloud_cover'] for f in fs) for d, fs in bydate.items()}
    for day in sorted(bydate, key=lambda d: (-(best[d] // 5), d), reverse=True):   # clearest first (5 % cloud buckets), newest within a bucket
        for f in sorted(bydate[day], key=lambda f: f['properties']['eo:cloud_cover']):
            fb = f['bbox']
            if fb[2] < b[0] or fb[0] > b[2] or fb[3] < b[1] or fb[1] > b[3]: continue
            tiles = [(x, y) for y in range(0, H, CHUNK) for x in range(0, W, CHUNK)]
            def one(xy):
                x, y = xy; tw, th = min(CHUNK, W - x), min(CHUNK, H - y)
                dx, dy = (b[2] - b[0]) / W, (b[3] - b[1]) / H
                bb = (b[0] + x * dx, b[3] - (y + th) * dy, b[0] + (x + tw) * dx, b[3] - y * dy)
                u = f"{DATA}/{bb[0]:.6f},{bb[1]:.6f},{bb[2]:.6f},{bb[3]:.6f}/{tw}x{th}.png?" + urllib.parse.urlencode({'collection': 'sentinel-2-l2a', 'item': f['id'], 'assets': 'visual', 'nodata': 0})
                return xy, Image.open(io.BytesIO(http(u))).convert('RGBA')
            with ThreadPoolExecutor(4) as ex:
                layer = Image.new('RGBA', (W, H))
                for (x, y), im in ex.map(one, tiles): layer.paste(im, (x, y))
            a = layer.getchannel('A')
            if not a.getbbox(): continue
            hole = out.getchannel('A').point(lambda v: 255 if v < 10 else 0)
            out.paste(layer, (0, 0), Image.composite(a, Image.new('L', (W, H), 0), hole))
            used.append({'id': f['id'], 'date': day, 'cloud': round(f['properties']['eo:cloud_cover'], 1)})
            cov = sum(1 for v in out.getchannel('A').getdata() if v > 10) / (W * H)
            log(f"  + {f['id'][:38]} ({day}, cloud {f['properties']['eo:cloud_cover']:.0f}%) → coverage {cov * 100:.0f}%")
            if cov > .99: return out, used
    return out, used                                                             # RGBA: holes stay transparent → the coarser plate shows through


def feather(im, frac=.09):
    """Fade the plate's alpha over its outer edge so a finer plate dissolves into the coarser one (no visible box)."""
    import numpy as np
    from PIL import Image
    a = np.asarray(im, np.float32).copy(); H, W = a.shape[:2]; m = max(8, int(min(W, H) * frac))
    rx = np.clip(np.minimum(np.arange(W), np.arange(W)[::-1]) / m, 0, 1); ry = np.clip(np.minimum(np.arange(H), np.arange(H)[::-1]) / m, 0, 1)
    ramp = np.minimum.outer(ry, rx); ramp = ramp * ramp * (3 - 2 * ramp)
    a[..., 3] *= ramp
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def blue_marble(b, W, H):
    from PIL import Image
    u = (f'{WMS}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=BlueMarble_NextGeneration&STYLES=&CRS=EPSG:4326'
         f'&BBOX={b[1]:.6f},{b[0]:.6f},{b[3]:.6f},{b[2]:.6f}&WIDTH={W}&HEIGHT={H}&FORMAT=image/jpeg')
    return Image.open(io.BytesIO(http(u))).convert('RGB')


def main(a, X):
    root = X.find_root('.')
    vd = a.to or '.'
    vd = vd if os.path.isabs(vd) else os.path.join(os.getcwd(), vd)
    if not os.path.exists(os.path.join(vd, 'video.yaml')): X.die(f'{vd} is not a video folder (video.yaml missing) — use --to videos/<name>')
    if not a.center: X.die('--center LAT,LON is required (e.g. --center 46.64,32.61)')
    lat, lon = (float(v) for v in a.center.split(','))
    out = os.path.join(vd, 've_tinh', a.name); os.makedirs(out, exist_ok=True)
    today = datetime.date.today()
    when = a.date or f'{today - datetime.timedelta(days=60)}/{today}'
    import re as _re; _vy = open(os.path.join(vd, 'video.yaml'), encoding='utf-8').read()
    _k = _re.search(r'^khung:\s*(\S+)', _vy, _re.M); _l = _re.search(r'^ngon_ngu:\s*(\S+)', _vy, _re.M)
    wide = bool(_k and _k.group(1).strip('"\'') == '16x9'); lang = (_l.group(1).strip('"\'') if _l else 'vi')
    km = a.km; tall = 9 / 16 if wide else 16 / 9                                  # plates follow the frame: tall for 9:16, wide for 16:9
    P = {'chi_tiet': box(lat, lon, km, km * tall), 'giua': box(lat, lon, km * 4, km * 4 * tall), 'vung': box(lat, lon, max(400, km * 25), max(400, km * 25) * tall)}
    meta = {'ten': a.name, 'tam': [lat, lon], 'km': km, 'tao': today.isoformat(), 'plates': [], 'credit': [], 'ngon_ngu': lang}
    X.log(f'region {P["vung"]} · NASA Blue Marble'); w, h = size(P['vung'], lat, 1600)
    blue_marble(P['vung'], w, h).save(os.path.join(out, 'vung.jpg'), quality=92)
    meta['plates'].append({'ten': 'vung', 'file': 'vung.jpg', 'bbox': P['vung'], 'nguon': 'NASA Blue Marble (GIBS)'})
    for name, long_px in (('giua', 1800), ('chi_tiet', 2200)):
        feats = search(P[name], when, a.cloud)
        if not feats: X.die(f'no low-cloud Sentinel-2 imagery (< {a.cloud}%) in {when} — relax --cloud or --date')
        w, h = size(P[name], lat, long_px); X.log(f'{name}: {w}×{h} px, {len(feats)} candidate scenes')
        im, used = mosaic(P[name], w, h, feats, X.log); feather(im).save(os.path.join(out, name + '.webp'), quality=90)
        meta['plates'].append({'ten': name, 'file': name + '.webp', 'bbox': P[name], 'nguon': 'Sentinel-2 L2A', 'canh': used})
    if a.before:
        feats = search(P['chi_tiet'], a.before, a.cloud)
        if feats:
            w, h = size(P['chi_tiet'], lat, 2200); im, used = mosaic(P['chi_tiet'], w, h, feats, X.log); im.save(os.path.join(out, 'truoc.webp'), quality=90)
            meta['plates'].append({'ten': 'truoc', 'file': 'truoc.webp', 'bbox': P['chi_tiet'], 'nguon': 'Sentinel-2 L2A', 'canh': used})
        else: X.log(f'⚠ no low-cloud "before" imagery in {a.before}')
    years = sorted({c['date'][:4] for p in meta['plates'] for c in p.get('canh', [])})
    dates = sorted({c['date'] for p in meta['plates'] if p['ten'] == 'chi_tiet' for c in p.get('canh', [])})
    meta['ngay_anh'] = dates[-1] if dates else None
    meta['credit'] = [f"Contains modified Copernicus Sentinel data {', '.join(years)} (Copernicus open licence) — via Microsoft Planetary Computer",
                      'NASA Blue Marble: Next Generation, NASA GIBS (public domain)']
    if lang == 'en': meta["chu_thich"] = f"SATELLITE IMAGE: SENTINEL-2 (ESA COPERNICUS) · NASA · {dates[-1]}" if dates else "SATELLITE IMAGE: NASA BLUE MARBLE"
    else: meta["chu_thich"] = f"ẢNH VỆ TINH: SENTINEL-2 (ESA COPERNICUS) · NASA · {dates[-1][8:10]}/{dates[-1][5:7]}/{dates[-1][:4]}" if dates else "ẢNH VỆ TINH: SENTINEL-2 (ESA COPERNICUS) · NASA"
    json.dump(meta, open(os.path.join(out, 'meta.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    with open(os.path.join(vd, 've_tinh', 'GIAY_PHEP.md'), 'a', encoding='utf-8') as f:
        f.write(f"- {a.name} ({meta['ngay_anh']}, centre {lat},{lon}): " + ' · '.join(meta['credit']) + '\n')
    X.log(f"✓ {os.path.relpath(out, os.getcwd())} · detail plate dated {meta['ngay_anh']} · use: ve_tinh: {{ thu_muc: ve_tinh/{a.name} }}")
