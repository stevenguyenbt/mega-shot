"""Fetch NASA Blue Marble: Next Generation (public domain) from NASA GIBS WMS,
tiled, and stitch it into one lon/lat (EPSG:4326) image.

usage: python -I tools/fetch_gibs.py <demo_dir>
Writes assets/raw/gibs/world.jpg (whole Earth) and assets/raw/gibs/ca.jpg
(Central Asia). Every request URL goes to assets/raw/manifest.jsonl.
"""
import sys, os, io, json, time, datetime, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi'
LAYER = 'BlueMarble_NextGeneration'
JOBS = {
    # name: (west, south, east, north, width, height)
    'world': (-180, -90, 180, 90, 8192, 4096),
    'ca': (40, 30, 80, 60, 4800, 3600),
}
T = 1024


def get(url):
    for k in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'lemo-opuscar-film/1.0'}), timeout=120) as r:
                return r.read()
        except Exception:
            if k == 4:
                raise
            time.sleep(3 + 3 * k)


def main():
    demo = sys.argv[1]
    out = os.path.join(demo, 'assets/raw/gibs'); os.makedirs(out, exist_ok=True)
    log = open(os.path.join(demo, 'assets/raw/manifest.jsonl'), 'a')
    for name, (w, s, e, n, W, H) in JOBS.items():
        dst = os.path.join(out, name + '.jpg')
        if os.path.exists(dst):
            continue
        img = Image.new('RGB', (W, H))
        dx = (e - w) / W; dy = (n - s) / H
        tiles = [(x, y) for y in range(0, H, T) for x in range(0, W, T)]

        def one(xy):
            x, y = xy
            tw = min(T, W - x); th = min(T, H - y)
            bb = (n - (y + th) * dy, w + x * dx, n - y * dy, w + (x + tw) * dx)   # WMS 1.3.0 EPSG:4326 = lat,lon order
            url = (f'{WMS}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS={LAYER}&STYLES=&CRS=EPSG:4326'
                   f'&BBOX={bb[0]:.6f},{bb[1]:.6f},{bb[2]:.6f},{bb[3]:.6f}&WIDTH={tw}&HEIGHT={th}&FORMAT=image/jpeg')
            return xy, url, Image.open(io.BytesIO(get(url))).convert('RGB')

        with ThreadPoolExecutor(6) as ex:
            for (x, y), url, im in ex.map(one, tiles):
                img.paste(im, (x, y))
                log.write(json.dumps({'plate': 'gibs_' + name, 'url': url, 'accessed': datetime.date.today().isoformat()}) + '\n')
        img.save(dst, quality=93)
        print('wrote', dst, W, H)


if __name__ == '__main__':
    main()
