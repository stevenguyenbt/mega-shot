"""mega-shot · finds assets on openly licensed sources, scores them, downloads, credits them and prepares the frame layers.

In video.yaml a scene declares:
    tim: { q: "bamboo forest sunrise", loai: video }        # loai: video | anh | hdri | texture  (default video)
    tim: "milky way galaxy"                                  # shorthand = video
    tim: { q: "...", loai: anh, nguon: nasa }                # force a source
    tim: [{ q: "shark close up" }, { q: "shark school" }]    # several clips in one scene → quick cuts of 1.5–3 s, each clip taking its best-motion segment
Quality: candidates are scored by how much they must be ENLARGED to cover the frame (1080p landscape → 9:16 portrait needs ~1.8× → soft); vertical / 1440p / 4K clips win.
Frames are extracted with lanczos at 1.2× the target size (room for zoom), lightly sharpened, top-quality JPEG.
Output: tainguyen/<id>.<ext> (original file), build/layers/<id>/NNNNN.jpg (trimmed/fitted video), giay_phep.json + GHI_CONG.md.
Sources: pixabay (video/images, needs PIXABAY_API_KEY), pexels (video/images, needs PEXELS_API_KEY), nasa (images), polyhaven (hdri/texture).
"""
import json, math, os, sys, re, shutil, subprocess, time, urllib.error, urllib.parse, urllib.request

UA = {'User-Agent': 'mega-shot/1.0'}
TARGET = None                                                                  # (W, H) target frame ×1.2 — set in run()
_LAST = {}
def _get(url, headers=None, timeout=60):
    host = urllib.parse.urlparse(url).netloc
    if 'wikimedia.org' in host:                                                # Wikimedia rate-limits strictly: ≥ 1.5 s between calls
        time.sleep(max(0, _LAST.get(host, 0) + 1.5 - time.time())); _LAST[host] = time.time()
    for k in range(7):                                                         # 429/503 (rate limited): wait per Retry-After, then retry
        try: return urllib.request.urlopen(urllib.request.Request(url, headers={**UA, **(headers or {})}), timeout=timeout).read()
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or k == 6: raise
            time.sleep(min(90, float(e.headers.get('Retry-After') or 0) or 5 * 2 ** k)); _LAST[host] = time.time()
def _json(url, headers=None): return json.loads(_get(url, headers))
def _words(s): return set(re.sub(r'(?<=[a-z]{3})(es|s)$', '', w) for w in re.findall(r'[a-zà-ỹ0-9]+', s.lower()) if len(w) > 2)   # strip plural endings: hills = hill

# ---------------- source adapters: return a list of normalised candidates ----------------
def pixabay(q, loai, key, n=20):
    if loai == 'video':
        d = _json(f"https://pixabay.com/api/videos/?key={key}&q={urllib.parse.quote(q)}&per_page={n}&safesearch=true")
        out = []
        for h in d.get('hits', []):
            v = h['videos']; rs = [v[k] for k in ('large', 'medium', 'small') if v.get(k, {}).get('url')]
            # sharpest version that is not too heavy: if sharp enough for the target (upscale ≤ 1.15×) take the smallest that qualifies, else the largest ≤ 250 MB
            up = lambda r: max(TARGET[0] / max(r['width'], 1), TARGET[1] / max(r['height'], 1)) if TARGET else 1
            ok = [r for r in rs if up(r) <= 1.15 and r.get('size', 0) < 90e6] or [r for r in rs if up(r) <= 1.4 and r.get('size', 0) < 90e6]   # sharp but not too heavy (download budget per video)
            pick = min(ok, key=lambda r: r.get('size', 0)) if ok else min(rs, key=lambda r: (up(r), r.get('size', 0)))
            out.append({'nguon': 'pixabay', 'id': h['id'], 'url': pick['url'], 'w': pick['width'], 'h': pick['height'], 'mb': pick['size'] / 1e6, 'dur': h['duration'], 'tags': h['tags'],
                        'thumb': pick.get('thumbnail') or v.get('tiny', {}).get('thumbnail', ''), 'trang': h['pageURL'], 'tac_gia': h.get('user', ''), 'giay_phep': 'Pixabay Content License (commercial use, attribution not required)', 'diem_pho_bien': h.get('likes', 0)})
        return out
    d = _json(f"https://pixabay.com/api/?key={key}&q={urllib.parse.quote(q)}&image_type=photo&per_page={n}&safesearch=true")
    # the public API only returns ≤ 1280 px (fullHDURL 1920 px for approved accounts) — score sharpness on what is ACTUALLY downloaded, not the original
    fit = lambda h, m: (min(m, h['imageWidth']), round(h['imageHeight'] * min(m, h['imageWidth']) / h['imageWidth'])) if h['imageWidth'] >= h['imageHeight'] else (round(h['imageWidth'] * min(m, h['imageHeight']) / h['imageHeight']), min(m, h['imageHeight']))
    return [{'nguon': 'pixabay', 'id': h['id'], 'url': h.get('fullHDURL') or h['largeImageURL'], 'w': fit(h, 1920 if h.get('fullHDURL') else 1280)[0], 'h': fit(h, 1920 if h.get('fullHDURL') else 1280)[1], 'mb': h.get('imageSize', 0) / 1e6, 'dur': 0, 'tags': h['tags'], 'thumb': h['webformatURL'],
             'trang': h['pageURL'], 'tac_gia': h.get('user', ''), 'giay_phep': 'Pixabay Content License (commercial use, attribution not required)', 'diem_pho_bien': h.get('likes', 0)} for h in d.get('hits', [])]

def pexels(q, loai, key, n=20):
    H = {'Authorization': key}
    if loai == 'video':
        d = _json(f"https://api.pexels.com/videos/search?query={urllib.parse.quote(q)}&per_page={n}", H); out = []
        for v in d.get('videos', []):
            fs = sorted([f for f in v['video_files'] if f.get('height')], key=lambda f: abs(f['height'] - 1920 if f['height'] > f['width'] else f['height'] - 1080))
            if not fs: continue
            f = fs[0]; out.append({'nguon': 'pexels', 'id': v['id'], 'url': f['link'], 'w': f['width'], 'h': f['height'], 'mb': 0, 'dur': v['duration'], 'tags': v.get('url', '').split('/')[-2].replace('-', ' '),
                                   'thumb': v.get('image', ''), 'trang': v['url'], 'tac_gia': v.get('user', {}).get('name', ''), 'giay_phep': 'Pexels License (commercial use, attribution not required)', 'diem_pho_bien': 0})
        return out
    d = _json(f"https://api.pexels.com/v1/search?query={urllib.parse.quote(q)}&per_page={n}", H)
    return [{'nguon': 'pexels', 'id': p['id'], 'url': p['src']['original'], 'w': p['width'], 'h': p['height'], 'mb': 0, 'dur': 0, 'tags': p.get('alt', ''), 'thumb': p['src']['medium'], 'trang': p['url'],
             'tac_gia': p.get('photographer', ''), 'giay_phep': 'Pexels License (commercial use, attribution not required)', 'diem_pho_bien': 0} for p in d.get('photos', [])]

def nasa(q, loai, key=None, n=20):
    if loai != 'anh': return []
    d = _json(f"https://images-api.nasa.gov/search?q={urllib.parse.quote(q)}&media_type=image&page_size={n}")
    out = []
    for it in d.get('collection', {}).get('items', [])[:n]:
        m = it['data'][0]; links = it.get('links', [{}])
        out.append({'nguon': 'nasa', 'id': m['nasa_id'], 'url': None, 'w': 0, 'h': 0, 'mb': 0, 'dur': 0, 'tags': ' '.join([m.get('title', '')] + m.get('keywords', [])), 'thumb': links[0].get('href', ''),
                    'trang': f"https://images.nasa.gov/details/{m['nasa_id']}", 'tac_gia': m.get('photographer') or m.get('secondary_creator') or m.get('center', 'NASA'),
                    'giay_phep': 'NASA — usually not copyrighted (public domain); credit NASA, check the notes for third-party material', 'diem_pho_bien': 0, 'ghi_chu': (m.get('description', '') or '')[:200]})
    return out

def nasa_resolve(c):
    files = _json(f"https://images-api.nasa.gov/asset/{urllib.parse.quote(c['id'])}")['collection']['items']
    hrefs = [f['href'] for f in files if f['href'].lower().endswith(('.jpg', '.jpeg', '.png'))]
    for tag in ('~orig', '~large', '~medium'):
        for h in hrefs:
            if tag in h: return h.replace('http://', 'https://')
    return hrefs[0].replace('http://', 'https://') if hrefs else None

OK_LIC = re.compile(r'^(public domain|pd|cc0|cc[- ]by(-sa)?[- ]?\d?(\.\d)?|ogl|attribution$)', re.I)   # OGL = UK Open Government Licence; "Attribution" = Commons {{Attribution}} (any use, credit required, e.g. Agência Senado)
def wikimedia(q, loai, key=None, n=24):
    """Wikimedia Commons — ONLY public-domain / CC0 / CC BY / CC BY-SA images (credit author + licence). Download: the original (≤ 3840 px, ≤ 40 MB) or a STANDARD 3840/1920 px thumbnail — Wikimedia blocks (429) any width outside the standard list https://w.wiki/GHai."""
    if loai != 'anh': return []
    u = ('https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=%d&gsrsearch=%s'
         '&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=500' % (n, urllib.parse.quote(q + ' filetype:bitmap')))
    return _wm_pages(_json(u, {'User-Agent': 'mega-shot/1.0 (video research tool; contact via project owner)'}))

def wikimedia_id(pageid):
    """One Commons file by page id (`chon: <id>` that the keyword search did not return) — same licence filter and download size rules."""
    u = ('https://commons.wikimedia.org/w/api.php?action=query&format=json&pageids=%s&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=500' % urllib.parse.quote(str(pageid)))
    return _wm_pages(_json(u, {'User-Agent': 'mega-shot/1.0 (video research tool; contact via project owner)'}))

def _wm_pages(d):
    out = []
    strip = lambda h: re.sub(r'<[^>]+>', '', h or '').strip()
    for pg in (d.get('query', {}).get('pages', {}) or {}).values():
        ii = (pg.get('imageinfo') or [{}])[0]; md = ii.get('extmetadata', {}); lic = strip(md.get('LicenseShortName', {}).get('value'))
        if ii.get('mime') not in ('image/jpeg', 'image/png') or not OK_LIC.match(lic or ''): continue          # skip images with unclear / non-free licence
        ow, oh, th = ii.get('width', 0), ii.get('height', 0), ii.get('thumburl', '')
        sw = 3840 if ow > 3840 else 1920 if ow > 1920 and ii.get('size', 0) > 40e6 else 0                      # 0 = download the original (≤ 3840 px)
        url = th.replace('/500px-', f'/{sw}px-') if sw and '/500px-' in th else ii.get('url')
        if not sw or '/500px-' not in th: sw = ow
        out.append({'nguon': 'wikimedia', 'id': pg['pageid'], 'url': url, 'w': sw, 'h': round(oh * sw / max(ow, 1)),
                    'mb': 0, 'dur': 0, 'tags': pg.get('title', '').replace('File:', '') + ' ' + strip(md.get('ImageDescription', {}).get('value'))[:200], 'thumb': ii.get('thumburl', ''),
                    'trang': ii.get('descriptionurl', ''), 'tac_gia': strip(md.get('Artist', {}).get('value'))[:120] or 'Wikimedia Commons',
                    'giay_phep': f"{lic} (Wikimedia Commons{' — attribution required' if 'by' in lic.lower() else ''})", 'diem_pho_bien': 0})
    return out

def polyhaven(q, loai, key=None, n=20):
    t = {'hdri': 'hdris', 'texture': 'textures'}.get(loai)
    if not t: return []
    d = _json(f'https://api.polyhaven.com/assets?t={t}'); qw = _words(q)
    out = []
    for k, v in d.items():
        tg = ' '.join([v['name']] + v.get('tags', []) + v.get('categories', []))
        if qw & _words(tg): out.append({'nguon': 'polyhaven', 'id': k, 'url': None, 'w': 0, 'h': 0, 'mb': 0, 'dur': 0, 'tags': tg, 'thumb': f'https://cdn.polyhaven.com/asset_img/thumbs/{k}.png?width=256',
                                        'trang': f'https://polyhaven.com/a/{k}', 'tac_gia': ', '.join(v.get('authors', {}).keys()), 'giay_phep': 'CC0', 'diem_pho_bien': v.get('download_count', 0) / 1000})
    return out

SOURCES = {'video': ['pixabay', 'pexels'], 'anh': ['nasa', 'pixabay', 'pexels'], 'hdri': ['polyhaven'], 'texture': ['polyhaven']}
FUN = {'pixabay': pixabay, 'pexels': pexels, 'nasa': nasa, 'polyhaven': polyhaven, 'wikimedia': wikimedia}
KEYS = {'pixabay': 'PIXABAY_API_KEY', 'pexels': 'PEXELS_API_KEY'}

def score(c, q, need_dur, vertical):
    tw = _words(c['tags']); qw = _words(q); s = 4 * len(qw & tw) / max(len(qw), 1) - (6 if not qw & tw else 0)   # no shared keyword: almost certainly off-topic
    if c['dur']: s += 2 if c['dur'] >= need_dur else -1.5 * (1 - c['dur'] / need_dur)
    if c['w'] and c['h'] and TARGET:                                              # real sharpness: how much it must be enlarged to cover the frame
        up = max(TARGET[0] / 1.2 / c['w'], TARGET[1] / 1.2 / c['h']); c['phong'] = round(up, 2)
        s += 1 if up <= 1.0 else -3 * (up - 1.0)                                # 1080p landscape → portrait: 1.78× upscale → −2.3 points
    elif c['h']: s += 1 if min(c['w'], c['h']) >= 1080 else -1
    if c['w'] and c['h'] and vertical and c['h'] > c['w']: s += 2.5             # already vertical: no crop needed, light file
    if c.get('mb', 0) > 60: s -= min(2, (c['mb'] - 60) / 60)                      # file too heavy: eats the download budget
    if re.search(r'\bai[- ]?generated\b|\bgenerative\b|\bai art\b|\bmidjourney\b|\bstable diffusion\b', c['tags'].lower()): s -= 8   # AI-generated imagery: not for documentary footage of real events
    if re.search(r'\bgreen[- ]?screen\b|\bchroma[- ]?key\b|\bblue[- ]?screen\b|\balpha channel\b', c['tags'].lower()): s -= 12   # green screen for keying: using it directly would show a green frame
    return s + .3 * math.log10(1 + c.get('diem_pho_bien', 0))

# ---------------- pick the best segment + high-quality frame extraction ----------------
def best_windows(src, seg, dur, k=1):
    """k non-overlapping segments of length `seg` with the most motion and not too dark — returned in time order."""
    if dur <= seg * k + .3: return [round(min(i * seg, max(0, dur - seg)), 2) for i in range(k)]
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-vf', 'fps=4,scale=48:27,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    n = 48 * 27; fr = [raw[i:i + n] for i in range(0, len(raw) - n + 1, n)]
    if len(fr) < 3: return [0.0] * k
    mot = [0] + [sum(abs(a - b) for a, b in zip(fr[i], fr[i - 1])) / n for i in range(1, len(fr))]; lum = [sum(f) / n / 255 for f in fr]
    det = [(sum((v - l * 255) ** 2 for v in f) / n) ** .5 for f, l in zip(fr, lum)]                # detail/contrast: empty or evenly dark frames → low
    w = max(1, int(seg * 4)); sc = []
    for i in range(0, max(1, len(fr) - w)):
        m = sum(mot[i:i + w]) / w; l = sum(lum[i:i + w]) / w; dd = min(det[i:i + w])                 # take the least detailed frame in the window
        sc.append((m + .18 * dd - (40 if l < .07 else 0) - (12 if dd < 12 else 0) - (8 if i < 2 else 0), i))
    picks = []
    for v, i in sorted(sc, reverse=True):
        if all(abs(i - j) >= w for j in picks): picks.append(i)
        if len(picks) == k: break
    return sorted(round(min(i / 4, max(0, dur - seg)), 2) for i in picks) or [0.0]

def best_window(src, seg, dur):
    """Start second of the `seg`-long segment with the most motion and not too dark (sampled at 4 fps, small grayscale frames)."""
    if dur <= seg + .3: return 0.0
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-vf', 'fps=4,scale=48:27,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    n = 48 * 27; fr = [raw[i:i + n] for i in range(0, len(raw) - n + 1, n)]
    if len(fr) < 3: return 0.0
    mot = [0] + [sum(abs(a - b) for a, b in zip(fr[i], fr[i - 1])) / n for i in range(1, len(fr))]; lum = [sum(f) / n / 255 for f in fr]
    w = max(1, int(seg * 4)); best, bt = -1e9, 0.0
    for i in range(0, max(1, len(fr) - w)):
        m = sum(mot[i:i + w]) / w; l = sum(lum[i:i + w]) / w; sc = m - (40 if l < .06 else 0) - (8 if i < 2 else 0)   # avoid black segments and the first frames (often text/logo)
        if sc > best: best, bt = sc, i / 4
    return min(bt, max(0, dur - seg))

def best_cx(src, start, seg, W, H):
    """Smart crop: horizontal centre (0–1) of the vertical frame placed on the brightest, most detailed region of the segment (instead of always the middle)."""
    try:
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{start:.2f}', '-t', f'{max(seg, .5):.2f}', '-i', src, '-vf', 'fps=2,scale=96:-2,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
        pr = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src], capture_output=True, text=True).stdout.strip().split(',')
        sw, sh = int(pr[0]), int(pr[1]); h = round(96 * sh / sw / 2) * 2; n = 96 * h; fr = [raw[i:i + n] for i in range(0, len(raw) - n + 1, n)]
        if not fr or sw / sh <= W / H * 1.05: return .5                          # source already vertical / close to the frame → keep centred
        col = [0.0] * 96
        for f in fr:
            for xx in range(96):
                c_ = [f[y * 96 + xx] for y in range(h)]; m = sum(c_) / h; hi = sum(1 for v in c_ if v > 232) / h
                col[xx] += min(m, 150) * .35 + (sum((v - m) ** 2 for v in c_) / h) ** .5 - 160 * hi   # detail > brightness; subtract blown-out areas (sun, lamps)
        w = max(1, round(96 * (W / H) / (sw / sh))); best = max(range(0, 96 - w + 1), key=lambda i: sum(col[i:i + w]) + (2 * sum(col) / 96 * w) * (1 - abs((i + w / 2) / 96 - .5)) * .15)
        return (best + w / 2) / 96
    except Exception: return .5

def extract(src, out, start, seg, W, H, fps, n0, speed=1.0, loop=False, extra='', can=0, tam=None):
    """Cut [start, start+seg] → JPEG frames 1.2× the target frame (lanczos + light sharpening), numbered on from n0.
    can = 0 wide shot · 1/2 close-up shifted left/right (zoom 1.18) → the feel of several camera angles."""
    OW, OH = int(W * 1.2) // 2 * 2, int(H * 1.2) // 2 * 2; z = 1.18 if can else 1.0; SW, SH = int(OW * z) // 2 * 2, int(OH * z) // 2 * 2
    if tam is None: tam = best_cx(src, start, seg, W, H)                       # horizontal centre (0–1) relative to the TRUE width of the scaled image
    off = {0: 0, 1: -.06, 2: .06}[can]
    cx = f"'max(0,min(iw-{OW},{tam + off:.4f}*iw-{OW}/2))'"
    vf = (f"setpts={speed:.3f}*PTS," if speed != 1 else '') + f"scale={SW}:{SH}:force_original_aspect_ratio=increase:flags=lanczos,crop={OW}:{OH}:{cx}:(ih-{OH})/2,unsharp=5:5:0.45:5:5:0,fps={fps}" + (f",{extra}" if extra else '')
    tail = ['-t', f'{seg:.2f}', '-vf', vf, '-q:v', '1', '-start_number', str(n0), f'{out}/%05d.jpg']
    r = subprocess.run(['ffmpeg', '-v', 'error', '-y', *(['-stream_loop', '-1'] if loop else []), '-ss', f'{start:.2f}', '-i', src, *tail], capture_output=True, text=True, errors='replace')
    if r.returncode or re.search(r'error while decoding|Reference \d+ >= \d+|cabac decode|gray chroma', r.stderr or ''):
        # fast seek landed on a keyframe that is not a clean entry point (open GOP / recovery point) → green, blocky frames.
        # Redo with accurate (output) seeking: decode from the start of the file, slower but clean.
        subprocess.run(['ffmpeg', '-v', 'error', '-y', *(['-stream_loop', '-1'] if loop else []), '-i', src, '-ss', f'{start:.2f}', *tail], check=True)
    return len([f for f in os.listdir(out) if f.endswith('.jpg')])

def detail_points(path, k=2):
    """Centres of the k most detailed regions (coords 0..1), non-overlapping — targets for the close-up angles of still images."""
    from PIL import Image; import numpy as np
    im = Image.open(path).convert('L'); im.thumbnail((96, 96)); a = np.asarray(im, dtype=np.float32) / 255
    g = np.abs(np.diff(a, axis=0))[:, :-1] + np.abs(np.diff(a, axis=1))[:-1, :]; H_, W_ = g.shape
    wh, ww = max(2, int(H_ * .42)), max(2, int(W_ * .42)); ii = np.pad(g.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    box = ii[wh:, ww:] - ii[:-wh, ww:] - ii[wh:, :-ww] + ii[:-wh, :-ww]; pts = []
    for _ in range(k):
        y, x = np.unravel_index(np.argmax(box), box.shape); pts.append([round((x + ww / 2) / W_, 3), round((y + wh / 2) / H_, 3)])
        box[max(0, y - wh):y + wh, max(0, x - ww):x + ww] = -1
    return pts

# ---------------- main program ----------------
def run(spec, root, log, die, W, H, dur_of, only=None, fps=30):
    global TARGET
    TARGET = (int(W * 1.2), int(H * 1.2))
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import keys as _k
    keys = _k.load(root)                                                          # env > .env > .mega-shot/keys.env
    pol = json.load(open(os.path.join(root, '.mega-shot', 'chinh_sach.json'), encoding='utf-8')) if os.path.exists(os.path.join(root, '.mega-shot', 'chinh_sach.json')) else {'tu_tai': False}
    if not pol.get('tu_tai'): die('no auto-download policy yet (.mega-shot/chinh_sach.json) — ask the user first')
    budget = pol.get('gioi_han_mb_moi_video', 1024); allowed = set(pol.get('nguon', [])) | set(spec.get('nguon_them') or [])   # nguon_them: sources the user allows for THIS video only
    tl = json.load(open('build/timeline.json', encoding='utf-8')) if os.path.exists('build/timeline.json') else None
    book = json.load(open('giay_phep.json', encoding='utf-8')) if os.path.exists('giay_phep.json') else {}
    used = sum(v.get('mb', 0) for v in book.values()); os.makedirs('tainguyen', exist_ok=True); os.makedirs('build/tim', exist_ok=True); report = []
    vertical = H > W
    series_taken = set()                                                       # series: clips already used in EARLIER episodes (../tap-*/giay_phep.json)
    if os.path.exists('../loat.yaml'):
        here = os.path.basename(os.getcwd())
        try: import yaml; eps = [str(t['thu_muc']) for t in (__import__('yaml_keys').normalize_series(yaml.safe_load(open('../loat.yaml', encoding='utf-8')) or {})).get('tap', [])]
        except Exception: eps = []
        for d in (sorted(eps) if here in eps else []):                         # a teaser (mo_dau.thu_muc) is not in the episode list: it may reuse the best footage
            gp = os.path.join('..', d, 'giay_phep.json')
            if d < here and os.path.exists(gp):                               # earlier episodes keep their clips; later ones avoid them
                try: series_taken |= {(b.get('nguon'), str(b.get('id'))) for b in json.load(open(gp, encoding='utf-8')).values()}
                except Exception: pass
    ids = {c['id'] for c in spec['canh'] if c.get('tim')}
    for k in [k for k in book if k.split('~')[0] not in ids]: book.pop(k)        # scene removed from the script: drop it from the book, no longer counted as "used"
    used = sum(v.get('mb', 0) for v in book.values())                           # the MB budget only counts clips still in use
    for c in spec['canh']:
        T = c.get('tim')
        if not T or (only and c['id'] not in only): continue
        specs = [({'q': t} if isinstance(t, str) else t) for t in (T if isinstance(T, list) else [T])]
        sc = next((s for s in (tl or {}).get('scenes', []) if s['id'] == c['id']), None); need = (sc['t1'] - sc['t0'] + 1.2) if sc else 8
        for k in [k for k in book if k.startswith(c['id'] + '~') and int(k.split('~')[1]) > len(specs)]: book.pop(k)   # fewer clips → drop surplus entries
        srcs_done = []                                                          # (file, loai, spec) in clip order
        for j, t in enumerate(specs, 1):
            bid = c['id'] if j == 1 else f"{c['id']}~{j}"; loai = t.get('loai', 'video'); q = t.get('q') or os.path.splitext(os.path.basename(str(t.get('tep', ''))))[0]; seg_need = need / len(specs) + .3
            if t.get('tep'):                                                    # tep: an existing file (the user's own image/product video); cat: [x0, y0, x1, y1] 0–1 crop to remove text/borders
                src = t['tep'] if os.path.isabs(t['tep']) else os.path.join(os.getcwd(), t['tep'])
                if not os.path.exists(src): log(f"⚠ {bid}: file not found {t['tep']}"); continue
                ext = os.path.splitext(src)[1].lower() or ('.mp4' if loai == 'video' else '.jpg')
                if t.get('cat') and loai == 'video': ext = '.mp4'                  # a cropped clip is re-encoded to H.264 → .mp4 (H.264 in a .webm container is invalid)
                dst = f"tainguyen/{bid}{ext}"
                key = f"{os.path.abspath(src)}|{os.path.getmtime(src)}|{t.get('cat')}"
                if not (book.get(bid, {}).get('tep_key') == key and os.path.exists(dst)):
                    if t.get('cat'):
                        x0, y0, x1, y1 = t['cat']
                        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', f"crop=trunc(iw*{x1 - x0}/2)*2:trunc(ih*{y1 - y0}/2)*2:iw*{x0}:ih*{y0}", *(['-q:v', '2'] if loai == 'anh' else ['-c:v', 'libx264', '-crf', '16', '-an']), dst], check=True)
                    else: shutil.copy(src, dst)
                book[bid] = {'nguon': 'tep', 'id': os.path.basename(src), 'url': '', 'tags': q, 'tac_gia': t.get('tac_gia', 'provided by the user'), 'giay_phep': t.get('giay_phep', 'material provided by / licensed to the user'),
                             'trang': t.get('trang', ''), 'file': dst, 'mb': 0, 'q': q, 'loai': loai, 'tep_key': key, 'ngay': time.strftime('%Y-%m-%d'),
                             **({'tu_xac_nhan': True} if t.get('tu_xac_nhan') else {})}   # xp clip --consent: rights confirmed by the user
                log(f"{bid}: existing file {t['tep']}" + (f" · crop {t['cat']}" if t.get('cat') else ''))
            else:
                srcs = [t['nguon']] if t.get('nguon') else SOURCES[loai]; cands = []
                # cache search results per (keywords, type, source): API results reorder between calls → `chon: N` must match the preview the user saw
                cp = f"build/tim/{bid}.ds.json"; ck = f"{q}|{loai}|{','.join(srcs)}"; cache = json.load(open(cp, encoding='utf-8')) if os.path.exists(cp) else {}
                fresh = cache.get('key') != ck
                if not fresh:                                                       # re-score with the current rules (e.g. AI-image filter); order changed → redraw the options sheet
                    cands = cache['cands']; old = [str(x['id']) for x in cands]; cands.sort(key=lambda x: -score(x, q, seg_need, vertical))
                    if [str(x['id']) for x in cands] != old: fresh = True; json.dump({'key': ck, 'cands': cands}, open(cp, 'w', encoding='utf-8'), ensure_ascii=False)
                else:
                    for s_ in srcs:
                        if s_ not in allowed: continue
                        if s_ in KEYS and not keys.get(KEYS[s_]): continue
                        try: cands += FUN[s_](q, loai, keys.get(KEYS.get(s_, ''), None))
                        except Exception as e: log(f'  {s_}: search error ({e})')
                    cands.sort(key=lambda x: -score(x, q, seg_need, vertical))
                    if cands: json.dump({'key': ck, 'cands': cands}, open(cp, 'w', encoding='utf-8'), ensure_ascii=False)
                if not cands and str(t.get('chon', '')).isdigit() and int(t['chon']) > 1000 and 'wikimedia' in srcs and 'wikimedia' in allowed:   # search empty but a page id was pinned
                    try: cands = wikimedia_id(t['chon']); [score(x, q, seg_need, vertical) for x in cands]
                    except Exception as e: log(f"  wikimedia #{t['chon']}: lookup by id failed ({e})")
                if not cands: log(f"⚠ {bid}: nothing found for '{q}' ({loai}) — the scene will need generated visuals (3D/Blender)"); continue
                taken = {(b.get('nguon'), str(b.get('id'))) for k, b in book.items() if k != bid} | series_taken   # no repeated clips within a video, including other episodes of a series
                best = next((x for x in cands if (x['nguon'], str(x['id'])) not in taken), cands[0])
                if t.get('chon'):                                                   # chon: N (position in *_phuong_an.jpg, from 1) or an asset id
                    ch = t['chon']; pick = next((x for x in cands if str(x['id']) == str(ch)), None) if not (isinstance(ch, int) and ch <= len(cands)) else cands[ch - 1]
                    if not pick and 'wikimedia' in srcs and 'wikimedia' in allowed and str(ch).isdigit() and int(ch) > 1000:   # page id outside the search results: fetch that exact file
                        try: pick = (wikimedia_id(ch) or [None])[0]
                        except Exception as e: log(f'  wikimedia #{ch}: lookup by id failed ({e})')
                        if pick: score(pick, q, seg_need, vertical); cands.insert(0, pick); log(f"{bid}: fetched wikimedia #{ch} by id (not in the results for '{q}')")
                    if pick: best = pick
                    else: log(f"⚠ {bid}: no option '{ch}' — using option 1")
                    if (best['nguon'], str(best['id'])) in taken: log(f"⚠ {bid}: option {ch} duplicates a clip already used in another scene/clip — pick another number")
                elif not _words(q) & _words(best['tags']): log(f"⚠ {bid}: the best option shares no keyword with '{q}' (\"{best['tags'][:40]}\") — may be off-topic: see {bid}_phuong_an.jpg, change q or chon")
                json.dump([{k: v for k, v in x.items()} for x in cands[:6]], open(f"build/tim/{bid}.json", 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
                try:
                    if not fresh and os.path.exists(f"build/tim/{bid}_phuong_an.jpg"): raise StopIteration
                    thumbs = []
                    for i, x in enumerate(cands[:5]):
                        if x.get('thumb'): pp = f"build/tim/{bid}_{i}.jpg"; open(pp, 'wb').write(_get(x['thumb'])); thumbs.append(pp)
                    if thumbs: subprocess.run(['ffmpeg', '-v', 'error', '-y', *sum([['-i', pp] for pp in thumbs], []), '-filter_complex', ''.join(f'[{i}]scale=-2:200[v{i}];' for i in range(len(thumbs))) + ''.join(f'[v{i}]' for i in range(len(thumbs))) + f'hstack=inputs={len(thumbs)}' if len(thumbs) > 1 else '[0]scale=-2:200', f"build/tim/{bid}_phuong_an.jpg"], check=False)
                except (Exception, StopIteration): pass
                url = best['url'] or (nasa_resolve(best) if best['nguon'] == 'nasa' else None)
                if best['nguon'] == 'polyhaven':
                    log(f"{bid}: polyhaven/{best['id']} — use `xp download polyhaven {best['id']}` to fetch the {loai} version"); book[bid] = {**best, 'mb': 0}; continue
                ext = os.path.splitext(urllib.parse.urlparse(url).path)[1] or ('.mp4' if loai == 'video' else '.jpg'); dst = f"tainguyen/{bid}{ext}"
                prev = book.get(bid)
                same = next((e for k2, e in book.items() if k2 != bid and isinstance(e, dict) and e.get('url_tai') == url and e.get('file') and os.path.exists(e['file'])), None)
                if same and not (prev and prev.get('url_tai') == url and os.path.exists(dst)):   # same clip already downloaded for another scene → reuse the file, no re-download, not counted in the budget
                    used -= (prev or {}).get('mb', 0)
                    book[bid] = {**best, 'url_tai': url, 'file': same['file'], 'mb': 0, 'q': q, 'loai': loai, 'ngay': time.strftime('%Y-%m-%d')}
                    log(f"{bid}: reusing {same['file']} ({best['nguon']} #{best['id']})"); dst = same['file']
                elif not (prev and prev.get('url_tai') == url and os.path.exists(dst)):
                    for k_try in range(3):                                      # flaky network: retry instead of failing the whole run
                        try: data = _get(url, timeout=300); break
                        except Exception as e:
                            if k_try == 2: json.dump(book, open('giay_phep.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1); raise
                            log(f"  {bid}: network error ({str(e)[:60]}) — retrying"); time.sleep(5)
                    mb = len(data) / 1e6; used -= (prev or {}).get('mb', 0)
                    if used + mb > budget:
                        json.dump(book, open('giay_phep.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)   # keep the book of what was already downloaded so a rerun loses nothing
                        die(f'over the {budget} MB limit for this video — stopping ({used:.0f} MB used) · pick lighter clips or reuse already-downloaded ones')
                    open(dst, 'wb').write(data); used += mb
                    book[bid] = {**best, 'url_tai': url, 'file': dst, 'mb': round(mb, 1), 'q': q, 'loai': loai, 'ngay': time.strftime('%Y-%m-%d')}
                    json.dump(book, open('giay_phep.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)   # save the book after each download: an error midway means no re-download
                    log(f"{bid}: downloaded {best['nguon']} #{best['id']} · {mb:.1f} MB · {best.get('w')}×{best.get('h')}" + (f" · upscale {best['phong']}×" if best.get('phong') else '') + f" · \"{best['tags'][:50]}\"")
                else: log(f"{bid}: already have {dst}")
            if loai == 'anh':                                                   # images: check the real resolution
                try:
                    pr = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', dst], capture_output=True, text=True).stdout.strip().split(',')
                    iw, ih = int(pr[0]), int(pr[1]); up = max(W * 1.1 / iw, H * 1.1 / ih); book[bid].update(w=iw, h=ih, phong=round(up, 2))
                    if up > 1.6: log(f"⚠ {bid}: image {iw}×{ih} is small for the frame (upscale {up:.1f}×) — will look soft; pick a larger one (chon: N) if the scene matters")
                except Exception: pass
                base = os.path.splitext(dst)[0]                                 # 2.5D: split subject + inpaint background (BiRefNet, run separately in an env with rembg)
                if t.get('25d', True) and not (os.path.exists(base + '_nen.jpg') and os.path.getmtime(base + '_nen.jpg') > os.path.getmtime(dst)):
                    md = os.path.join(root, '.mega-shot', 'models')
                    r = subprocess.run(['uv', 'run', '--quiet', '--with', 'rembg[cpu]', '--with', 'opencv-python-headless', 'python', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lop25d.py'), md, os.path.abspath(dst)], capture_output=True, text=True, encoding='utf-8', errors='replace')
                    info = next((json.loads(l) for l in r.stdout.splitlines() if l.startswith('{')), {})
                    if r.returncode or not info: log(f"  {bid}: could not build the 2.5D layers ({(r.stderr or '')[-200:]})")
                    elif info.get('bo_qua'):
                        log(f"  {bid}: subject covers {info['dien_tich']:.0%} — not using 2.5D")
                        for f in (base + '_nen.jpg', base + '_tien.png'):                # delete stale layers from the previous image (if any)
                            if os.path.exists(f): os.remove(f)
                if t.get('25d', True) and os.path.exists(base + '_nen.jpg') and os.path.exists(base + '_tien.png'):
                    book[bid]['lop'] = {'nen': base + '_nen.jpg', 'tien': base + '_tien.png'}; log(f"  {bid}: 2.5D layers ready")
                else: book[bid].pop('lop', None)
                try: book[bid]['diem'] = detail_points(dst)
                except Exception: pass
            srcs_done.append((dst, loai, t, bid))
        if srcs_done and c['id'] not in book:                                     # first clip not found → the first one that was found stands in
            book[c['id']] = {**book[srcs_done[0][3]], 'thay_cho': srcs_done[0][3]}
        # a scene = a chain of CAMERA ANGLES in `tim` order: video clips (best-motion segment) and images (2.5D/Ken Burns) share the duration equally.
        # Video frames are concatenated into build/layers/<id> (MS.seq); `shots` records which [t0, t1) seconds each angle fills and its starting frame f0.
        if srcs_done:
            out = f"build/layers/{c['id']}"
            for _ in range(10):   # Windows: rmtree may not finish (locked files) → retry
                shutil.rmtree(out, ignore_errors=True)
                if not os.path.exists(out): break
                time.sleep(.5)
            os.makedirs(out, exist_ok=True); n = 0; cuts = []; shots = []
            share = need / len(srcs_done); tcur = 0.0
            for vi, (dst, kind, t, bid) in enumerate(srcs_done):
                if kind != 'video':
                    shots.append({'k': 'a', 't0': round(tcur, 3), 't1': round(tcur + share, 3), 'id': bid}); cuts.append(round(tcur, 3)); tcur += share; continue
                d = dur_of(dst); speed = 1.0; loop = False; s_need = share + .05; f0 = n
                if d < s_need: speed = s_need / d if s_need / d <= 1.3 else 1.0; loop = s_need / d > 1.3
                k = 1 if t.get('tu') is not None else max(1, min(3, round(s_need / t.get('doan', 3.2))))   # "cut angles": segments ≤ ~3.2 s
                part = s_need / k
                if loop and part <= d:                                           # clip shorter than the scene: spread segments evenly + alternate wide/close instead of an obvious loop
                    loop = False; speed = 1.0; starts = [round((d - part) * j / max(1, k - 1), 2) for j in range(k)]
                else: starts = [t['tu']] if t.get('tu') is not None else (best_windows(dst, part / speed, d, k) if not loop else [0.0])
                for j, st in enumerate(starts):
                    can = 0 if (vi + j) % 2 == 0 else (1 if j % 4 == 1 else 2)
                    cuts.append(round(tcur + (n - f0) / fps, 3)); n = extract(dst, out, st, part + .04, W, H, fps, n, speed, loop, t.get('mau', ''), can, t.get('tam_x'))   # tam_x: pin the horizontal centre (0–1) if needed
                book[bid]['cham'] = round(speed, 2); book[bid]['tu'] = starts
                shots.append({'k': 'v', 't0': round(tcur, 3), 't1': round(tcur + share, 3), 'f0': f0, 'id': bid}); tcur += share   # id: which tim entry (captions per photo/clip)
            book[c['id']]['khung'] = n; book[c['id']]['cat'] = sorted(set(cuts))[1:]      # cut points (seconds in the scene) → film.js adds an accent effect
            book[c['id']]['shots'] = shots
        report.append(c['id'])
    json.dump(book, open('giay_phep.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    L = ['# Asset credits', '', 'Paste the list below into the video description when publishing (not required for Pixabay/Pexels but good practice).', '']
    for cid, v in book.items(): L.append(f"- {cid}: {v.get('tac_gia') or v['nguon']} / {v['nguon']} — {v['trang']} ({v['giay_phep'].split('(')[0].strip()})")
    open('GHI_CONG.md', 'w', encoding='utf-8').write('\n'.join(L) + '\n')
    log(f'✓ {len(report)} scene(s) with assets · total {used:.0f}/{budget} MB · giay_phep.json, GHI_CONG.md, build/tim/*_phuong_an.jpg')
