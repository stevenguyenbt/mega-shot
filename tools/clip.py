"""mega-shot · clip.py — `xp clip <link>`: take scenes from an online video into a mega-shot video, legally.

1. Licence gate (before anything is downloaded) — metadata via yt-dlp:
   allowed automatically: Creative Commons BY / BY-SA / CC0 / public domain (no NC, no ND — the channels are monetised and
   our edit is a derivative), US-government science hosts (nasa.gov, noaa.gov, usgs.gov, nps.gov), and the user's own
   channels listed in .mega-shot/kenh_cua_toi.json (["@handle" or channel id …]).
   Anything else needs `--consent "<who allowed it / why you may use it>"` — the user takes responsibility per link; the
   statement is logged in .mega-shot/clip_quyen.jsonl and marked `tu_xac_nhan` in giay_phep.json. `xp channel upload`
   refuses videos that contain such clips unless told otherwise (automated channels must never carry them).
2. Download ≤ 1080p MP4 with yt-dlp into .mega-shot/tai_ve/clip/ (cached).
3. Analysis → build/clip/<name>/: scene cuts (ffmpeg scene score), per scene motion / brightness / sharpness, burned-in text
   bands (OpenCV) with a suggested `cat` crop that removes them, transcript with timestamps (local faster-whisper),
   a contact sheet canh.jpg and goi_y.yaml — ready-to-paste `tim` entries ({tep, tu, cat, tac_gia, giay_phep, trang}).
"""
import os, re, json, time, subprocess, urllib.parse

GOV = ('nasa.gov', 'noaa.gov', 'usgs.gov', 'nps.gov', 'fws.gov', 'si.edu')
GOV_CHANNELS = {'@nasa', '@nasagoddard', '@nasajpl', '@nasavideo', '@noaaoceanexploration', '@oceanexplorergov', '@noaa', '@usgs', '@noaafisheries', '@nationalparkservice'}   # US-government works: public domain even when YouTube shows its "standard licence"
OK_LIC = re.compile(r'creative commons attribution(?!.*(non.?commercial|no.?deriv))|\bcc[- ]?by(?![- ]?(nc|nd))(-sa)?\b|\bcc0\b|public domain|publicdomain', re.I)

JS = {'js_runtimes': {'node': {}}}   # YouTube: needs a JS runtime + yt-dlp-ejs (pip yt-dlp[default]) for HD formats; Node is installed (deno is yt-dlp's default)

def _ydl():
    import yt_dlp
    return yt_dlp

def meta(url):
    y = _ydl()
    with y.YoutubeDL({'quiet': True, 'skip_download': True, 'noplaylist': True, **JS}) as d: return d.extract_info(url, download=False)

def licence(info, root):
    """→ (allowed: bool, licence text, reason)"""
    lic = (info.get('license') or '').strip(); host = urllib.parse.urlparse(info.get('webpage_url') or '').hostname or ''
    if lic and OK_LIC.search(lic):
        # A CC label only counts if the uploader owns the pictures: compilation / re-upload channels stick "CC BY" on other people's
        # stock and film footage (seen 2026-10-18: 7-follower "motivation compilation" channel of professional stock clips).
        desc = (info.get('description') or '') + ' ' + (info.get('title') or ''); subs = info.get('channel_follower_count') or 0
        sus = re.search(r'compilation|tổng hợp|mix 20\d\d|best of|no copyright|copyright free|free to use|reupload|re-upload', desc, re.I)
        if sus and subs < 5000 or subs < 50:
            return False, f'{lic} — BUT suspicious: channel has {subs} followers' + (f', looks like a compilation/re-upload ("{sus.group(0)}")' if sus else ''), ''
        return True, lic, 'open licence allows reuse'
    if any(host == g or host.endswith('.' + g) for g in GOV): return True, lic or 'Public domain (US Government work)', f'public material of {host}'
    if ('@' + str(info.get('uploader_id') or '').lstrip('@')).lower() in GOV_CHANNELS: return True, 'Public domain (US Government work)', f"US government channel {info.get('uploader_id')}"
    own = os.path.join(root, '.mega-shot', 'kenh_cua_toi.json')
    mine = json.load(open(own, encoding='utf-8')) if os.path.exists(own) else []
    ids = {str(info.get(k) or '') for k in ('channel_id', 'uploader_id', 'channel', 'uploader')} | {'@' + str(info.get('uploader_id') or '').lstrip('@')}
    if mine and ids & set(map(str, mine)): return True, 'video by the channel owner', 'your own channel (.mega-shot/kenh_cua_toi.json)'
    return False, lic or 'no licence stated (default: all rights reserved)', ''

def download(info, root, log):
    d = os.path.join(root, '.mega-shot', 'tai_ve', 'clip'); os.makedirs(d, exist_ok=True)
    base = re.sub(r'[^\w.-]+', '_', f"{info.get('extractor_key', 'web')}-{info.get('id')}").lower(); out = os.path.join(d, base + '.mp4')
    if os.path.exists(out): log(f'already have {os.path.relpath(out, root)}'); return out
    y = _ydl(); opts = {'quiet': True, 'noprogress': True, 'noplaylist': True, **JS, 'outtmpl': os.path.join(d, base + '.%(ext)s'), 'merge_output_format': 'mp4',
                        'format': 'bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]/bv*[height<=1080]+ba/b'}
    with y.YoutubeDL(opts) as dl: dl.download([info['webpage_url']])
    if not os.path.exists(out):
        alt = [f for f in os.listdir(d) if f.startswith(base + '.')]
        if alt: os.replace(os.path.join(d, alt[0]), out)
    log(f'downloaded {os.path.relpath(out, root)} · {os.path.getsize(out) / 1048576:.1f} MB'); return out

def _probe(f):
    r = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', f], capture_output=True, text=True).stdout)
    return r['streams'][0]['width'], r['streams'][0]['height'], float(r['format']['duration'])

def scenes(f, dur, thr=.18, min_len=.8):
    err = subprocess.run(['ffmpeg', '-hide_banner', '-i', f, '-an', '-vf', f"scale=320:-2,select='gt(scene,{thr})',showinfo", '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace').stderr
    cuts = [0.0] + [float(m) for m in re.findall(r'pts_time:([\d.]+)', err)] + [dur]; out = []
    for a, b in zip(cuts, cuts[1:]):
        if out and b - a < min_len: out[-1][1] = b                                # too short to use → merge into the previous scene
        else: out.append([a, b])
    res = []
    for a, b in out:                                                             # long takes / soft dissolves → ~4 s windows, each analysed on its own
        if b - a < .3: continue
        k = max(1, round((b - a) / 4)) if b - a > 6 else 1
        res += [(round(a + (b - a) * i / k, 2), round(a + (b - a) * (i + 1) / k, 2)) for i in range(k)]
    return res

def _frames(f, a, b, n=5, w=320):
    import numpy as np
    out = []
    for t in [a + (b - a) * (k + .5) / n for k in range(n)]:
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t:.3f}', '-i', f, '-frames:v', '1', '-vf', f'scale={w}:-2', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
        if raw: hh = len(raw) // (w * 3); out.append(np.frombuffer(raw[:w * hh * 3], np.uint8).reshape(hh, w, 3))
    return out

def text_boxes(img):
    """Burned-in captions / lower thirds / watermarks: wide, short, high-contrast horizontal bands → boxes [x0,y0,x1,y1] 0–1."""
    import cv2, numpy as np
    g = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY); H, W = g.shape
    grad = cv2.morphologyEx(g, cv2.MORPH_GRADIENT, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    _, bw = cv2.threshold(grad, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    bw = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (max(9, W // 30), 3)))
    cnts, _ = cv2.findContours(bw, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE); out = []
    for c in cnts:
        x, y, w, h = cv2.boundingRect(c)
        if w > W * .12 and H * .025 < h < H * .14 and w / h > 3:
            fill = cv2.countNonZero(bw[y:y + h, x:x + w]) / (w * h)
            if fill > .45: out.append([round(x / W, 3), round(y / H, 3), round((x + w) / W, 3), round((y + h) / H, 3)])
    return out

def crop_for(boxes):
    """Suggest `cat: [x0, y0, x1, y1]` keeping the picture but dropping text bands near the top/bottom edges."""
    y0, y1 = 0.0, 1.0
    for b in boxes:
        if b[1] > .6: y1 = min(y1, b[1] - .02)
        elif b[3] < .4: y0 = max(y0, b[3] + .02)
    return None if (y0, y1) == (0.0, 1.0) or y1 - y0 < .5 else [0, round(y0, 3), 1, round(y1, 3)]

def run(X, url, name=None, consent=None, lang=None, no_words=False):
    log, die = X.log, X.die; root = X.find_root('.')
    try: info = meta(url)
    except Exception as e: die(f'could not read the video info: {e}')
    ok, lic, why = licence(info, root)
    title, who = info.get('title', ''), info.get('uploader') or info.get('channel') or '?'
    log(f"«{title[:70]}» · {who} · {info.get('duration', 0):.0f}s · licence: {lic}")
    if not ok and not consent:
        die('this source has NO licence allowing reuse (Content ID / copyright strikes / YouTube "reused content").\n'
            '  If you have the rights (your own video, written permission from the author, a purchased licence…) run again with\n'
            '  --consent "<who allowed it / why you may use it>" — you take responsibility for this link; the statement is logged.')
    if not ok:
        q = os.path.join(root, '.mega-shot', 'clip_quyen.jsonl')
        open(q, 'a', encoding='utf-8').write(json.dumps({'t': time.strftime('%F %T'), 'url': info.get('webpage_url'), 'tieu_de': title, 'kenh': who, 'giay_phep_goc': lic, 'xac_nhan': consent}, ensure_ascii=False) + '\n')
        log(f'⚠ used on your own confirmation: "{consent}" — logged in .mega-shot/clip_quyen.jsonl; automated channels will not accept this clip')
    else: log(f'✓ allowed: {why}')
    f = download(info, root, log); W, H, D = _probe(f)
    name = name or re.sub(r'[^\w-]+', '-', (info.get('id') or 'clip')).strip('-').lower(); out = os.path.join('build', 'clip', name); os.makedirs(out, exist_ok=True)
    sc = scenes(f, D); log(f'{len(sc)} scenes · {W}×{H} · {D:.0f}s')
    if min(W, H) < 720: log(f'⚠ source is only {W}×{H} — will look soft in a 1080×1920 vertical frame; use only for short/secondary scenes or find an HD copy')
    words = []
    if not no_words:
        wav = os.path.join(out, 'tieng.wav'); subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f, '-vn', '-ac', '1', '-ar', '16000', wav], check=False)
        if os.path.exists(wav) and os.path.getsize(wav) > 32000:
            try: words = X.NgheLai.get(lang or info.get('language') or None).nghe(wav)[1]
            except Exception as e: log(f'⚠ could not transcribe: {e}')
            if len(words) < max(3, D / 10): log('audio: almost no speech (music / ambience only) — dropping the transcript'); words = []   # Whisper invents "you" on music
    import numpy as np
    rows = []; sheet = []
    for k, (a, b) in enumerate(sc):
        fr = _frames(f, a, b, n=6); boxes = []
        for im in fr: boxes += text_boxes(im)
        g = [im.mean(2) for im in fr]; mot = float(np.mean([np.abs(g[i + 1] - g[i]).mean() for i in range(len(g) - 1)])) if len(g) > 1 else 0
        import cv2
        sharp = float(np.mean([cv2.Laplacian(x.astype(np.uint8), cv2.CV_64F).var() for x in g])) if g else 0
        said = ' '.join(w[0] for w in words if a <= w[1] < b)
        rows.append({'so': k + 1, 'tu': a, 'den': b, 'dai': round(b - a, 2), 'chuyen_dong': round(mot, 1), 'sang': round(float(np.mean(g)) / 255, 2) if g else 0,
                     'net': round(sharp), 'chu_in_san': boxes[:4], 'cat_goi_y': crop_for(boxes), 'loi': said[:300]})
        if fr: sheet.append((k + 1, a, b, fr[len(fr) // 2], bool(boxes)))
    lic_txt = lic if ok else f'self-confirmed by the user: {consent} (original licence: {lic})'
    meta_out = {'url': info.get('webpage_url'), 'tieu_de': title, 'tac_gia': who, 'giay_phep': lic_txt, 'tu_xac_nhan': not ok, 'file': f, 'canh': rows}
    json.dump(meta_out, open(os.path.join(out, 'canh.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    _sheet(sheet, os.path.join(out, 'canh.jpg'))
    best = sorted(rows, key=lambda r: (not r['dai'] >= 2, bool(r['chu_in_san']), bool(r['chu_in_san']) and not r['cat_goi_y'], -min(r['chuyen_dong'], 25) - min(r['net'], 400) / 40))[:8]   # clean windows first
    L = [f'# Suggested scenes from: {title}', f'# {info.get("webpage_url")} · {who} · {lic_txt}', '# Paste into the `tim:` of the scene you want (xp assets will cut the exact segment, grade it and credit it).', '']
    for r in best:
        e = {'tep': f.replace('\\', '/'), 'tu': r['tu'], 'tac_gia': who, 'giay_phep': lic_txt, 'trang': info.get('webpage_url')}
        if r['cat_goi_y']: e['cat'] = r['cat_goi_y']
        if not ok: e['tu_xac_nhan'] = True
        L.append(f"# scene {r['so']} · {r['tu']}–{r['den']}s · motion {r['chuyen_dong']} · {'burned-in text → cat suggested' if r['chu_in_san'] else 'clean'}" + (f" · speech: {r['loi'][:80]}" if r['loi'] else ''))
        L.append('- ' + json.dumps(e, ensure_ascii=False))
    open(os.path.join(out, 'goi_y.yaml'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
    if words: open(os.path.join(out, 'loi.md'), 'w', encoding='utf-8').write('\n'.join(f"[{r['tu']:.1f}–{r['den']:.1f}] {r['loi']}" for r in rows if r['loi']) + '\n')
    log(f"✓ {out}/canh.jpg (view scenes) · goi_y.yaml (paste into tim) · canh.json" + (' · loi.md' if words else '') + f" · {sum(1 for r in rows if r['chu_in_san'])} scene(s) with burned-in text")

def _sheet(items, path):
    from PIL import Image, ImageDraw
    if not items: return
    tw = 220; th = int(tw * items[0][3].shape[0] / items[0][3].shape[1]); cols = 5; rows = (len(items[:40]) + cols - 1) // cols
    S = Image.new('RGB', (cols * (tw + 4), rows * (th + 22)), (12, 12, 14)); d = ImageDraw.Draw(S)
    for i, (k, a, b, im, txt) in enumerate(items[:40]):
        x, y = (i % cols) * (tw + 4), (i // cols) * (th + 22); S.paste(Image.fromarray(im).resize((tw, th)), (x, y + 20))
        d.text((x + 3, y + 3), f'#{k} {a:.1f}-{b:.1f}s' + (' TEXT' if txt else ''), fill=(255, 120, 120) if txt else (220, 220, 220))
    S.save(path, quality=88)
