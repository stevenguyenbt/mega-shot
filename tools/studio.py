"""mega-shot studio · local dashboard for every video and series.

xp studio [--port 3901]  → http://127.0.0.1:3901
- Reads state from the files in videos/ (no database of its own → always consistent with the command line).
- Runs xp steps through a queue (one job at a time: VoiceStudio/GPU can't run in parallel).
- Listens on 127.0.0.1 only; every write needs a session token (blocks foreign web pages); never serves .mega-shot/ (API keys).
"""
import hashlib, http.server, json, mimetypes, os, re, secrets, shutil, subprocess, sys, threading, time, urllib.parse

X = None                     # xp module (assigned in main)
ROOT = VIDEOS = XP = None
TOKEN = secrets.token_urlsafe(24)
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = None

# ---------------------------------------------------------------- utilities
def rel(p): return os.path.relpath(p, ROOT).replace(os.sep, '/')
def mt(p): return os.path.getmtime(p) if os.path.exists(p) else 0
def jload(p, d=None):
    try: return json.load(open(p, encoding='utf-8'))
    except Exception: return d
def yload(p):
    import yaml
    return yaml.safe_load(open(p, encoding='utf-8'))
def safe_dir(r):
    """relative path (e.g. videos/abc) → absolute, only inside videos/"""
    p = os.path.realpath(os.path.join(ROOT, r or ''))
    if not (p == os.path.realpath(VIDEOS) or p.startswith(os.path.realpath(VIDEOS) + os.sep)): raise ValueError('path outside videos/')
    return p

_vkey = {}
def voice_key(g):
    k = (g.get('mau', 'mark'), str(g.get('seed', 1234)))
    if k not in _vkey:
        vd = os.path.join(ROOT, '.mega-shot', 'voices', k[0])
        try: _vkey[k] = hashlib.sha1(open(os.path.join(vd, 'ref.wav'), 'rb').read() + open(os.path.join(vd, 'ref.txt'), encoding='utf-8').read().strip().encode() + k[1].encode()).hexdigest()[:10]
        except Exception: _vkey[k] = None
    return _vkey[k]

def spec_of(d):
    """read video.yaml like xp.load_spec (inheriting loat.yaml) but don't exit on error"""
    import yaml_keys; s = yaml_keys.normalize(yload(os.path.join(d, 'video.yaml')) or {})
    lp = os.path.join(d, '..', 'loat.yaml')
    if os.path.exists(lp):
        L = yaml_keys.normalize_series(yload(lp) or {})
        for k in ('khung', 'ngon_ngu', 'giong', 'phong_cach', 'do_to'):
            if k in L and k not in s: s[k] = L[k]
        s['_loat'] = True
    s.setdefault('khung', '9x16'); s.setdefault('ngon_ngu', 'vi'); s.setdefault('giong', {}); s.setdefault('canh', [])
    return s

# ---------------------------------------------------------------- status of one video
BUOC = [('kich_ban', 'Script'), ('giong', 'Voice'), ('hinh', 'Visuals / footage'), ('am', 'Audio mix'), ('render', 'Render'), ('xuat', 'Export')]
LENH = {'giong': [['giong']], 'am': [['am']], 'render': [['render']], 'xuat': [['xuat'], ['kiemtra']]}

def video_info(d, full=False):
    J = lambda *a: os.path.join(d, *a)
    R = {'loai': 'video', 'p': rel(d), 'ten': os.path.basename(d), 'buoc': {}, 'canh_bao': []}
    try: s = spec_of(d)
    except Exception as e:
        R.update(loi=f'video.yaml error: {e}', buoc={k: {'tt': 'loi' if k == 'kich_ban' else 'chua'} for k, _ in BUOC}); return R
    canh = [c for c in s['canh'] if isinstance(c, dict)]; R.update(ten=s.get('ten', R['ten']), khung=s['khung'], ngon_ngu=s['ngon_ngu'], so_canh=len(canh), trong_loat=bool(s.get('_loat')))
    words = sum(len(str(c.get('loi', '')).split()) for c in canh); R['so_chu'] = words
    tpl = 'trong'
    if os.path.exists(J('film.html')):
        h = open(J('film.html'), encoding='utf-8', errors='replace').read()
        tpl = 'threejs' if 'ms3d.js' in h else 'footage' if 'giay_phep.json' in h else 'anh-ai' if 'stills.js' in h else 'trong'
    if any(c.get('blender') for c in canh): tpl = 'blender'
    R['mau'] = tpl
    st = R['buoc']; ymt = mt(J('video.yaml'))
    st['kich_ban'] = {'tt': 'xong' if canh and words else 'chua', 'ghi': f'{len(canh)} scenes · {words} words'}
    # voice: compare hashes like xp narrate → know which lines were edited but not yet re-read
    need = [c for c in canh if c.get('loi')]; key = voice_key(s['giong']); ok = old = 0
    for c in need:
        w = J('build', 'audio', f"{c['id']}.wav"); m = jload(w + '.json', {})
        if not os.path.exists(w): continue
        if key and m.get('hash') and m['hash'] != hashlib.sha1((str(c['loi']) + s['ngon_ngu'] + key).encode('utf-8')).hexdigest()[:10]: old += 1
        else: ok += 1
    gk = jload(J('build', 'giong_kiemtra.json'), []) or []
    bad = [g['id'] for g in gk if isinstance(g, dict) and (g.get('giong_nhau', 1) < .7 or g.get('chen_dau'))]
    st['giong'] = {'tt': 'xong' if need and ok == len(need) else 'cu' if ok + old == len(need) and need else 'chua', 'ghi': f'{ok}/{len(need)} lines' + (f' · {old} lines edited since' if old else '')}
    if bad: st['giong']['canh_bao'] = f"re-listen: {', '.join(bad)}"
    # visuals: depends on the template
    tim = [c['id'] for c in canh if c.get('tim')]; bl = [c['id'] for c in canh if c.get('blender')]; an = [c for c in canh if c.get('anh')]
    hinh_mt = 0
    if tim:
        book = jload(J('giay_phep.json'), {}) or {}; n = sum(1 for i in tim if i in book and (not book[i].get('file') or os.path.exists(J(book[i]['file']))))
        st['hinh'] = {'tt': 'xong' if n == len(tim) else 'chua', 'ghi': f'{n}/{len(tim)} scenes with footage', 'lenh': [['timtainguyen']]}; hinh_mt = mt(J('giay_phep.json'))
    elif bl:
        n = sum(1 for i in bl if os.path.isdir(J('build', 'layers', i)) and len(os.listdir(J('build', 'layers', i))) > 5)
        st['hinh'] = {'tt': 'xong' if n == len(bl) else 'chua', 'ghi': f'{n}/{len(bl)} Blender scenes', 'lenh': [['blender']]}
    elif an:
        n = sum(1 for c in an if os.path.exists(J('build', 'anh', f"{c['anh'].get('file')}.png")))
        st['hinh'] = {'tt': 'xong' if n == len(an) else 'chua', 'ghi': f'{n}/{len(an)} AI images imported', 'lenh': [['anh']]}
    else: st['hinh'] = {'tt': 'xong', 'ghi': 'visuals built in code (film.html)', 'an': True}
    tl = J('build', 'timeline.json'); mix = J('build', 'mix.wav'); raw = J('build', 'raw.mp4')
    st['am'] = {'tt': 'xong' if mt(mix) >= mt(tl) > 0 else 'cu' if mt(mix) else 'chua'}
    src = max(mt(J('film.html')), mt(tl), hinh_mt, mt(mix))
    st['render'] = {'tt': 'xong' if mt(raw) >= src and mt(raw) else 'cu' if mt(raw) else 'chua'}
    if mt(raw): st['render']['ghi'] = f'{X.dur_of(raw):.0f} s' if full else ''
    outs = sorted([f for f in (os.listdir(J('out')) if os.path.isdir(J('out')) else []) if f.endswith('.mp4')], key=lambda f: -mt(J('out', f)))
    if R['trong_loat']: st['xuat'] = {'tt': 'xong' if st['render']['tt'] == 'xong' else 'chua', 'ghi': 'episode in a series: assembled at series level', 'an': True}
    else:
        o = J('out', outs[0]) if outs else None
        st['xuat'] = {'tt': 'xong' if o and mt(o) >= mt(raw) else 'cu' if o else 'chua'}
        if o: st['xuat']['ghi'] = f'{os.path.getsize(o) / 1048576:.1f} MB'; R['file'] = rel(o)
    kt = jload(J('build', 'kiemtra.json'))
    if kt and not R['trong_loat']: R['canh_bao'] += kt.get('canh_bao', []); R['thoi_luong'] = kt.get('thoi_luong')
    if not R.get('thoi_luong') and os.path.exists(tl): R['thoi_luong'] = (jload(tl, {}) or {}).get('dur')
    for k, _ in BUOC:
        if st[k].get('canh_bao'): R['canh_bao'].append(st[k]['canh_bao'])
    R['tiep'] = next((k for k, _ in BUOC if st[k]['tt'] != 'xong'), None)
    R['sua_luc'] = max(ymt, mt(raw), mt(J('out')))
    R['bia'] = rel(R['file']) if R.get('file') else rel(raw) if os.path.exists(raw) else None
    if R.get('file'): R['bia'] = R['file']
    if full:
        tld = jload(tl, {}) or {}; T = {x['id']: x for x in tld.get('scenes', [])}; book = jload(J('giay_phep.json'), {}) or {}
        sc = []
        for c in canh:
            w = J('build', 'audio', f"{c['id']}.wav"); m = (jload(w + '.json', {}) or {}).get('check', {})
            e = {'id': c['id'], 'loi': c.get('loi', ''), 'tim': c.get('tim'), 'chu': c.get('chu'), 'blender': c.get('blender'), 'anh': c.get('anh'),
                 'am': rel(w) if os.path.exists(w) else None, 'nghe_lai': m.get('nghe_lai'), 'khop': m.get('giong_nhau'), 'chen_dau': m.get('chen_dau'), 'dai': m.get('dur'),
                 't0': T.get(c['id'], {}).get('t0'), 't1': T.get(c['id'], {}).get('t1')}
            cj = jload(J('build', 'tim', f"{c['id']}.json"))
            if cj:
                b = book.get(c['id'], {})
                e['phuong_an'] = [{'so': i + 1, 'anh': rel(J('build', 'tim', f"{c['id']}_{i}.jpg")) if os.path.exists(J('build', 'tim', f"{c['id']}_{i}.jpg")) else None,
                                   'nguon': x.get('nguon'), 'ma': x.get('id'), 'tags': (x.get('tags') or '')[:70], 'dai': x.get('dur'), 'w': x.get('w'), 'h': x.get('h'),
                                   'dang_dung': str(x.get('id')) == str(b.get('id')) and x.get('nguon') == b.get('nguon')} for i, x in enumerate(cj[:5])]
            if c['id'] in book: e['tai_nguyen'] = {k: book[c['id']].get(k) for k in ('nguon', 'id', 'tac_gia', 'trang', 'giay_phep', 'mb')}
            sc.append(e)
        R['canh'] = sc; R['yaml'] = open(J('video.yaml'), encoding='utf-8').read()
        R['thu'] = [rel(J('build', 'thu', f)) for f in sorted(os.listdir(J('build', 'thu')))] if os.path.isdir(J('build', 'thu')) else []
        R['thu_mt'] = int(mt(J('build', 'thu.jpg')))
        R['files'] = files_of(d); R['kiemtra'] = kt; R['raw'] = rel(raw) if os.path.exists(raw) else None
        R['buoc_ten'] = BUOC; R['anh_bia'] = anhbia_info(d)
    return R

def files_of(d):
    out = []
    for f in sorted(os.listdir(os.path.join(d, 'out'))) if os.path.isdir(os.path.join(d, 'out')) else []:
        p = os.path.join(d, 'out', f); e = {'ten': f, 'p': rel(p), 'mb': round(os.path.getsize(p) / 1048576, 1), 'luc': int(mt(p))}
        if f.endswith(('.txt', '.md', '.srt')) and os.path.getsize(p) < 200_000: e['noi_dung'] = open(p, encoding='utf-8', errors='replace').read()
        out.append(e)
    for f in ('GHI_CONG.md', 'loi_nhac_anh.md'):
        if os.path.exists(os.path.join(d, f)): out.append({'ten': f, 'p': rel(os.path.join(d, f)), 'noi_dung': open(os.path.join(d, f), encoding='utf-8', errors='replace').read()})
    return out

def anhbia_info(d):
    """thumbnails: versions in anh_bia.yaml, images already made, AI image prompts"""
    yp = os.path.join(d, 'anh_bia.yaml'); R = {'co_cau_hinh': os.path.exists(yp), 'phien_ban': [], 'loi_nhac': []}
    if R['co_cau_hinh']:
        try: C = yload(yp) or {}
        except Exception as e: R['loi'] = f'anh_bia.yaml error: {e}'; C = {}
        for v in C.get('phien_ban', []) or []:
            src = str(v.get('nguon', '')); o = os.path.join(d, 'out', f"anh_bia_{v.get('ten')}.jpg"); f = src.rsplit('@', 1)[0]
            has = os.path.exists(os.path.join(d, f)) or (os.path.isdir(os.path.join(d, os.path.dirname(f) or '.')) and any(os.path.splitext(x)[0] == os.path.splitext(os.path.basename(f))[0] for x in os.listdir(os.path.join(d, os.path.dirname(f) or '.'))))
            R['phien_ban'].append({'ten': v.get('ten'), 'nguon': src, 'chu': v.get('chu', []), 'bo_cuc': v.get('bo_cuc', 'trai'), 'co_nguon': has, 'ai': not '@' in src,
                                   'anh': rel(o) if os.path.exists(o) else None, 'luc': int(mt(o))})
    xt = os.path.join(d, 'out', 'anh_bia_xem_truoc.jpg'); R['xem_truoc'] = rel(xt) if os.path.exists(xt) else None; R['xt_luc'] = int(mt(xt))
    lp = os.path.join(d, 'loi_nhac_anh_bia.md')
    if os.path.exists(lp):
        t = open(lp, encoding='utf-8').read()
        for m in re.finditer(r'^##\s+(.+?)\n(.*?)```\n(.*?)```', t, re.S | re.M):
            fn = re.search(r'`([\w\-]+)\.(?:png|jpg|webp)`', m.group(1)); R['loi_nhac'].append({'tieu_de': re.sub(r'[`*]', '', m.group(1)).strip(), 'ten': fn.group(1) if fn else None, 'prompt': m.group(3).strip()})
    return R

def loat_info(d, full=False):
    R = {'loai': 'loat', 'p': rel(d), 'ten': os.path.basename(d), 'canh_bao': []}
    import yaml_keys
    try: L = yaml_keys.normalize_series(yload(os.path.join(d, 'loat.yaml')) or {})
    except Exception as e: R['loi'] = f'loat.yaml error: {e}'; return R
    R.update(ten=L.get('ten', R['ten']), tieu_de=L.get('tieu_de', ''), mo_ta=L.get('mo_ta', ''), khung=L.get('khung', '16x9'))
    taps = []
    for t in L.get('tap', []) or []:
        td = os.path.join(d, str(t.get('thu_muc'))); i = video_info(td, full) if os.path.exists(os.path.join(td, 'video.yaml')) else {'p': rel(td), 'loi': 'episode folder missing', 'buoc': {}}
        i['tieu_de_tap'] = t.get('tieu_de', ''); taps.append(i)
    R['tap'] = taps; R['so_tap'] = len(taps); R['tap_xong'] = sum(1 for t in taps if t.get('buoc', {}).get('render', {}).get('tt') == 'xong')
    yt = os.path.join(d, 'out', f"{R['ten']}_youtube.mp4"); newest = max([mt(os.path.join(ROOT, t['p'], 'build', 'raw.mp4')) for t in taps] + [mt(os.path.join(d, 'loat.yaml'))])
    R['ghep'] = 'xong' if mt(yt) >= newest and mt(yt) else 'cu' if mt(yt) else 'chua'
    if mt(yt): R['file'] = rel(yt); R['thoi_luong'] = X.dur_of(yt) if full else None
    R['bia'] = rel(os.path.join(d, 'out', 'anh_bia.jpg')) if os.path.exists(os.path.join(d, 'out', 'anh_bia.jpg')) else next((t.get('bia') for t in taps if t.get('bia')), None)
    R['sua_luc'] = max([t.get('sua_luc', 0) for t in taps] + [mt(os.path.join(d, 'loat.yaml')), mt(yt)])
    for t in taps: R['canh_bao'] += [f"{os.path.basename(t['p'])}: {w}" for w in t.get('canh_bao', [])]
    if full: R['yaml'] = open(os.path.join(d, 'loat.yaml'), encoding='utf-8').read(); R['files'] = files_of(d); R['anh_bia'] = anhbia_info(d)
    return R

def scan():
    out = []
    for n in sorted(os.listdir(VIDEOS)) if os.path.isdir(VIDEOS) else []:
        d = os.path.join(VIDEOS, n)
        try:
            if os.path.exists(os.path.join(d, 'loat.yaml')): out.append(loat_info(d))
            elif os.path.exists(os.path.join(d, 'video.yaml')): out.append(video_info(d))
        except Exception as e: out.append({'loai': 'video', 'p': rel(d), 'ten': n, 'loi': str(e), 'buoc': {}})
    out.sort(key=lambda r: -r.get('sua_luc', 0)); return out

def library():
    skip = {'build', 'tainguyen', 'node_modules', 'layers', '__pycache__'}; out = []
    for dp, dn, fn in os.walk(ROOT):
        dn[:] = [x for x in dn if not x.startswith('.') and x not in skip]
        for f in fn:
            if f.endswith('.mp4'): p = os.path.join(dp, f); out.append({'p': rel(p), 'ten': f, 'thu_muc': rel(dp), 'mb': round(os.path.getsize(p) / 1048576, 1), 'luc': int(mt(p))})
    return sorted(out, key=lambda x: -x['luc'])

def kenh_options():
    """Every option for the channel settings form — read from the real folders (voices, music, templates, sample videos, sound packs)."""
    ms = os.path.join(ROOT, '.mega-shot')
    ls = lambda d, f=lambda x: True: sorted(x for x in os.listdir(d) if f(x)) if os.path.isdir(d) else []
    return {
        'khung': [['9x16', 'Vertical 9:16 (Shorts/TikTok/Reels)'], ['16x9', 'Landscape 16:9 (YouTube)'], ['1x1', 'Square 1:1']],
        'mau': ls(os.path.join(X.SKILL, 'templates')),
        'ngon_ngu': [['vi', 'Tiếng Việt (Vietnamese)'], ['en', 'English'], ['ja', '日本語'], ['zh', '中文'], ['ko', '한국어'], ['fr', 'Français'], ['es', 'Español'], ['de', 'Deutsch']],
        'kieu_hinh': [['footage', 'Footage / real archival images'], ['parallax-25d', '2.5D still images'], ['sketch', 'Sketch / whiteboard'], ['stick-figure', 'Stick-figure storytelling'],
                      ['flat-2d', 'Flat 2D animation (Kurzgesagt-style)'], ['vox-collage', 'Vox-style cut-out collage'], ['kinetic-type', 'Kinetic typography'], ['3b1b', '3Blue1Brown-style maths'],
                      ['keynote-ui', 'Keynote-style UI'], ['finance-charts', 'Financial charts'], ['painterly', 'Painterly art (35 styles)'], ['puppet', 'Animated character narrator'],
                      ['threejs', '3D Three.js'], ['triet-ly', '3D philosophy / quotes'], ['y-khoa', '3D medical'], ['tuyen-ngon', 'Manifesto (photocopy + 3D red text)'], ['blender', 'Photoreal 3D Blender'], ['anh-ai', 'AI images']],
        'lop_phu': [['tuyet-bien', 'Marine snow (particles drifting underwater)'], ['anh-day-nuoc', 'Underwater sunlight'], ['tia-nang', 'Light rays'], ['bot-khi', 'Air bubbles']],
        'subtitle_style': ['box', 'karaoke-pop', 'highlight', 'word-burst', 'typewriter', 'blur-in', 'underline'],
        'title_style': ['word-rise', 'spring', 'mask-reveal', 'decode', 'shine', 'typewriter', 'tracking', 'stamp'],
        'giong': ls(os.path.join(ms, 'voices'), lambda x: not x.startswith('_') and os.path.exists(os.path.join(ms, 'voices', x, 'ref.wav'))),
        'nhac': ['../../.mega-shot/music/' + x for x in ls(os.path.join(ms, 'music'), lambda x: x.lower().endswith(('.mp3', '.wav', '.m4a')))],
        'video_mau': ['videos/' + x for x in ls(VIDEOS, lambda x: not x.startswith('_') and os.path.exists(os.path.join(VIDEOS, x, 'video.yaml')))],
        'am_nen': [['khong', 'None'], ['duoi-nuoc', 'Underwater (synthesised)']] + [[f'tu-nhien:{os.path.splitext(f)[0]}', f'Real sound: {os.path.splitext(f)[0]}'] for f in (sorted(os.listdir(os.path.join(ROOT, '.mega-shot', 'sfx', 'tu-nhien'))) if os.path.isdir(os.path.join(ROOT, '.mega-shot', 'sfx', 'tu-nhien')) else [])],
        'nguon_them': [['wikimedia', 'Wikimedia Commons (artefact photos, maps, old paintings — open licence, credited)']],
        'anh_bia': ['classic', 'poster', 'gold-title', 'big-number', 'versus', 'red-circle', 'breaking-news', 'mystery', 'minimal', 'parchment', 'cinematic'],
        'danh_muc': [[27, 'Education'], [28, 'Science & Technology'], [22, 'People & Blogs'], [24, 'Entertainment'], [1, 'Film & Animation'], [15, 'Pets & Animals'],
                     [19, 'Travel & Events'], [26, 'Howto & Style'], [25, 'News & Politics'], [17, 'Sports'], [10, 'Music'], [20, 'Gaming']],
        'kenney': ls(os.path.join(ms, 'sfx', 'kenney'), lambda x: os.path.isdir(os.path.join(ms, 'sfx', 'kenney', x)) and not x.startswith('_')),
    }

def kenh_mod():
    """tools/kenh.py (xp channel) with the project's ROOT."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kenh, importlib
    mt = os.path.getmtime(kenh.__file__)                                       # reload when kenh.py is edited (no need to restart Studio)
    if getattr(kenh, '_mtime', mt) != mt: kenh = importlib.reload(kenh)
    kenh._mtime = mt; kenh.ROOT = ROOT; return kenh

mimetypes.add_type('image/webp', '.webp')                                  # Python on Windows doesn't know WebP by itself

def thumb(r):
    """image shown in Studio: mp4 → 480 px WebP frame, jpg/png → WebP (cached by modification time)"""
    p = os.path.realpath(os.path.join(ROOT, r))
    if not p.startswith(os.path.realpath(ROOT) + os.sep) or not os.path.exists(p): return None
    vid = p.endswith('.mp4')
    if not vid and not p.lower().endswith(('.jpg', '.jpeg', '.png')): return p
    c = os.path.join(CACHE, hashlib.sha1(f'{p}{mt(p)}'.encode()).hexdigest()[:16] + '.webp')     # WebP: much lighter for the Studio page
    if not os.path.exists(c):
        if vid:
            try: d = X.dur_of(p)
            except Exception: d = 2
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{d * .35:.2f}', '-i', p, '-frames:v', '1', '-vf', 'scale=480:-2', '-c:v', 'libwebp', '-quality', '78', c], check=False)
        else:                                                                    # image: keep enough detail to view (max 1600 px), just convert to WebP
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', p, '-vf', "scale='min(1600,iw)':-2", '-c:v', 'libwebp', '-quality', '82', c], check=False)
    return c if os.path.exists(c) else (None if vid else p)

# ---------------------------------------------------------------- job queue
JOBS, LOCK = [], threading.Lock()
CHO_PHEP = {'giong', 'timtainguyen', 'blender', 'anh', 'am', 'thu', 'render', 'xuat', 'kiemtra', 'loinhac', 'loat', 'anhbia'}
CHO_PHEP |= {'narrate', 'assets', 'images', 'mix', 'preview', 'export', 'check', 'prompts', 'series', 'thumbnail', 'publish'}   # English command names (xp.py also accepts the old ones)
SAVE = None

def add_job(cwd, cmds, ten):
    for c in cmds:
        if not c or c[0] not in CHO_PHEP: raise ValueError(f'command not allowed: {c}')
        if c[0] == 'loat' and (len(c) < 2 or c[1] not in ('chay', 'ghep')): raise ValueError('loat only allows chay/ghep')
        if any(not re.fullmatch(r'[\w\-.,=]+', str(x)) for x in c): raise ValueError('unexpected argument')
    j = {'id': secrets.token_hex(4), 'cwd': rel(cwd), 'cmds': cmds, 'ten': ten, 'tt': 'cho', 'log': [], 'tao': time.time(), 'bd': None, 'kt': None, 'tien_do': None}
    with LOCK: JOBS.append(j)
    return j

def persist():
    with LOCK: data = [{k: v for k, v in j.items() if k not in ('proc',)} | {'log': j['log'][-300:]} for j in JOBS[-40:]]
    json.dump(data, open(SAVE, 'w', encoding='utf-8'), ensure_ascii=False)

def worker():
    env = {**os.environ, 'PYTHONUTF8': '1', 'PYTHONUNBUFFERED': '1', 'PYTHONIOENCODING': 'utf-8'}
    while True:
        with LOCK: j = next((x for x in JOBS if x['tt'] == 'cho'), None)
        if not j: time.sleep(.4); continue
        j['tt'] = 'chay'; j['bd'] = time.time()
        for c in j['cmds']:
            if j['tt'] != 'chay': break
            j['log'].append(f'$ xp {" ".join(map(str, c))}')
            p = subprocess.Popen([sys.executable, XP, *map(str, c)], cwd=os.path.join(ROOT, j['cwd']), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace', env=env,
                                 creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0)); j['proc'] = p
            for line in p.stdout:
                line = line.rstrip()
                if not line: continue
                j['log'].append(line); del j['log'][:-4000]
                m = re.search(r'\b(\d+)/(\d+) · \d+s', line)
                if m and int(m.group(2)): j['tien_do'] = int(m.group(1)) / int(m.group(2))
            rc = p.wait(); j['proc'] = None; j['tien_do'] = None
            if rc and j['tt'] == 'chay': j['tt'] = 'loi'; j['log'].append(f'✗ stopped: command returned code {rc}')
        if j['tt'] == 'chay': j['tt'] = 'xong'
        j['kt'] = time.time(); persist()

def cancel(jid):
    with LOCK: j = next((x for x in JOBS if x['id'] == jid), None)
    if not j: return
    if j['tt'] == 'cho': j['tt'] = 'huy'; j['kt'] = time.time()
    elif j['tt'] == 'chay':
        j['tt'] = 'huy'; p = j.get('proc')
        if p:
            if os.name == 'nt': subprocess.run(['taskkill', '/T', '/F', '/PID', str(p.pid)], capture_output=True)
            else: p.kill()
        j['log'].append('■ cancelled')

def job_view(j, tu=None):
    v = {k: j[k] for k in ('id', 'cwd', 'cmds', 'ten', 'tt', 'tao', 'bd', 'kt', 'tien_do')}; v['so_dong'] = len(j['log']); v['dong_cuoi'] = j['log'][-1] if j['log'] else ''
    if tu is not None: v['log'] = j['log'][tu:]
    return v

# ---------------------------------------------------------------- script editing (keeps comments via ruamel)
def ruamel():
    from ruamel.yaml import YAML
    y = YAML(); y.preserve_quotes = True; y.width = 4096; y.indent(mapping=2, sequence=4, offset=2); return y

def sua_canh(d, cid, loi=None, q=None, chon=None):
    """Edit one scene in place (comments kept). Works with English keys (scenes/narration/search/query/pick) and the
    original Vietnamese ones (canh/loi/tim/q/chon): whichever the file already uses is written back."""
    y = ruamel(); p = os.path.join(d, 'video.yaml'); doc = y.load(open(p, encoding='utf-8'))
    K = lambda m, vi, en: en if (en in m and vi not in m) else vi                  # key name used by this block
    c = next((c for c in (doc.get('canh') or doc.get('scenes') or []) if c.get('id') == cid), None)
    if c is None: raise ValueError(f'no scene {cid}')
    if loi is not None: c[K(c, 'loi', 'narration') if 'text' not in c else 'text'] = loi.strip()
    if q is not None or chon is not None:
        from ruamel.yaml.comments import CommentedMap
        kt = K(c, 'tim', 'search'); t = c.get(kt)
        if isinstance(t, list): t = t[0]                                           # several clips: edit the first clip
        if isinstance(t, str): t = CommentedMap(q=t); c[kt] = t
        if t is None: t = CommentedMap(q=q or '', loai='video'); c[kt] = t
        if t.fa.flow_style() is None: t.fa.set_flow_style()
        kq, kc = K(t, 'q', 'query'), K(t, 'chon', 'pick')
        if q is not None and q != t.get(kq): t[kq] = q; t.pop('chon', None); t.pop('pick', None)
        if chon is not None: t[kc] = int(chon)
    y.dump(doc, open(p, 'w', encoding='utf-8'))

def them_tap(d):
    y = ruamel(); p = os.path.join(d, 'loat.yaml'); doc = y.load(open(p, encoding='utf-8')); en = 'episodes' in doc and 'tap' not in doc; taps = doc.get('episodes' if en else 'tap') or []
    k = len(taps) + 1
    while os.path.exists(os.path.join(d, f'tap-{k:02d}')): k += 1
    src = next((os.path.join(d, str(t.get('thu_muc') or t.get('folder'))) for t in reversed(taps) if os.path.exists(os.path.join(d, str(t.get('thu_muc') or t.get('folder')), 'film.html'))), None)
    nd = os.path.join(d, f'tap-{k:02d}'); os.makedirs(nd)
    if src: shutil.copy(os.path.join(src, 'film.html'), nd); [shutil.copytree(os.path.join(src, s), os.path.join(nd, s)) for s in ('canh',) if os.path.isdir(os.path.join(src, s))]
    else: shutil.copy(os.path.join(X.SKILL, 'templates', 'footage', 'film.html'), nd)
    open(os.path.join(nd, 'video.yaml'), 'w', encoding='utf-8').write(f"name: {doc.get('ten') or doc.get('name')}-tap-{k:02d}\n\nscenes:\n  - id: opening\n    search: {{ query: \"english keywords\", type: video }}\n    narration: The opening line of part {k}.\n")
    from ruamel.yaml.comments import CommentedMap
    m = CommentedMap(**({'folder': f'tap-{k:02d}', 'title': f'Part {k}'} if en else {'thu_muc': f'tap-{k:02d}', 'tieu_de': f'Phần {k}'})); m.fa.set_flow_style(); taps.append(m); doc['episodes' if en else 'tap'] = taps
    y.dump(doc, open(p, 'w', encoding='utf-8')); return f'tap-{k:02d}'

# ---------------------------------------------------------------- HTTP
class H(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    def log_message(self, *a): pass
    def send(self, code, body, ctype='application/json; charset=utf-8', extra=None):
        if isinstance(body, (dict, list)): body = json.dumps(body, ensure_ascii=False).encode()
        elif isinstance(body, str): body = body.encode()
        self.send_response(code); self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(body))); self.send_header('Cache-Control', 'no-store')
        for k, v in (extra or {}).items(): self.send_header(k, v)
        self.end_headers(); self.wfile.write(body)
    def host_ok(self): return (self.headers.get('Host') or '').split(':')[0] in ('127.0.0.1', 'localhost')
    def file(self, p, ctype=None):
        size = os.path.getsize(p); ctype = ctype or mimetypes.guess_type(p)[0] or 'application/octet-stream'
        rg = re.match(r'bytes=(\d*)-(\d*)', self.headers.get('Range') or ''); a, b = 0, size - 1
        if rg: a = int(rg.group(1) or 0); b = min(int(rg.group(2)) if rg.group(2) else size - 1, size - 1)
        self.send_response(206 if rg else 200); self.send_header('Content-Type', ctype); self.send_header('Accept-Ranges', 'bytes'); self.send_header('Content-Length', str(b - a + 1))
        if rg: self.send_header('Content-Range', f'bytes {a}-{b}/{size}')
        self.send_header('Cache-Control', 'no-cache'); self.end_headers()
        with open(p, 'rb') as f:
            f.seek(a); left = b - a + 1
            while left > 0:
                chunk = f.read(min(1 << 20, left))
                if not chunk: break
                try: self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError): return
                left -= len(chunk)

    def do_GET(self):
        if not self.host_ok(): return self.send(403, {'loi': 'host'})
        u = urllib.parse.urlparse(self.path); q = {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}
        try:
            if u.path == '/':
                h = open(os.path.join(HERE, 'studio.html'), encoding='utf-8').read().replace('__TOKEN__', TOKEN); return self.send(200, h, 'text/html; charset=utf-8')
            if u.path == '/api/tong-quan':
                with LOCK: dang = [job_view(j) for j in JOBS if j['tt'] in ('cho', 'chay')]
                return self.send(200, {'muc': scan(), 'viec': dang, 'goc': ROOT, 'xem': None})
            if u.path == '/api/video': return self.send(200, video_info(safe_dir(q['p']), True))
            if u.path == '/api/loat': return self.send(200, loat_info(safe_dir(q['p']), True))
            if u.path == '/api/thu-vien': return self.send(200, library())
            if u.path == '/api/kenh': K = kenh_mod(); return self.send(200, [K.summary(c) for c in K.channels()])
            if u.path == '/api/kenh/cau-hinh':                                   # channel profile + every option for the "Video style settings" form
                K = kenh_mod(); P = json.loads(json.dumps(K.profile(q['kenh']), default=str))
                return self.send(200, {'ho_so': P, 'lua_chon': kenh_options()})
            if u.path == '/api/mau': return self.send(200, sorted(os.listdir(os.path.join(X.SKILL, 'templates'))))
            if u.path == '/api/viec':
                with LOCK: return self.send(200, [job_view(j) for j in reversed(JOBS[-60:])])
            if u.path.startswith('/api/viec/'):
                with LOCK: j = next((x for x in JOBS if x['id'] == u.path.rsplit('/', 1)[1]), None)
                return self.send(200, job_view(j, int(q.get('tu', 0)))) if j else self.send(404, {'loi': 'no such job'})
            if u.path.startswith('/ref/'):                                     # style preview images (references/previews/*.webp) — read-only
                r = urllib.parse.unquote(u.path[5:]); base = os.path.realpath(os.path.join(X.SKILL, 'references'))
                p = os.path.realpath(os.path.join(base, r))
                if not p.startswith(os.path.join(base, 'previews') + os.sep) or not p.endswith('.webp') or not os.path.isfile(p):
                    return self.send(404, {'loi': 'not found'})
                return self.file(p)
            if u.path == '/bia':
                p = thumb(q.get('f', '')); return self.file(p) if p else self.send(404, b'', 'text/plain')
            if u.path.startswith('/f/'):
                r = urllib.parse.unquote(u.path[3:]); parts = r.split('/')
                if any(x.startswith('.') or x == '' for x in parts): return self.send(403, {'loi': 'forbidden'})
                p = os.path.realpath(os.path.join(ROOT, r))
                if not p.startswith(os.path.realpath(ROOT) + os.sep) or not os.path.isfile(p): return self.send(404, {'loi': 'no such file'})
                return self.file(p)
            self.send(404, {'loi': 'not found'})
        except Exception as e: self.send(500, {'loi': str(e)})

    def do_POST(self):
        if not self.host_ok() or self.headers.get('X-Studio') != TOKEN: return self.send(403, {'loi': 'invalid session — reload the page'})
        u = urllib.parse.urlparse(self.path); n = int(self.headers.get('Content-Length') or 0); b = json.loads(self.rfile.read(n) or b'{}')
        try:
            if u.path == '/api/chay':
                d = safe_dir(b['p']); j = add_job(d, b['cmds'], b.get('ten') or ' → '.join(c[0] for c in b['cmds'])); return self.send(200, job_view(j))
            if u.path == '/api/huy': cancel(b['id']); return self.send(200, {'ok': 1})
            if u.path == '/api/xoa-viec-cu':
                with LOCK: JOBS[:] = [j for j in JOBS if j['tt'] in ('cho', 'chay')]
                persist(); return self.send(200, {'ok': 1})
            if u.path == '/api/luu':
                d = safe_dir(b['p']); f = 'loat.yaml' if b.get('loat') else 'video.yaml'
                import yaml
                try: v = yaml.safe_load(b['text'])
                except Exception as e: return self.send(400, {'loi': f'YAML syntax error: {e}'})
                if not isinstance(v, dict) or (not b.get('loat') and not isinstance(v.get('canh'), list)): return self.send(400, {'loi': "missing 'canh' list"})
                open(os.path.join(d, f), 'w', encoding='utf-8').write(b['text']); return self.send(200, {'ok': 1})
            if u.path == '/api/sua-canh':
                sua_canh(safe_dir(b['p']), b['id'], b.get('loi'), b.get('q'), b.get('chon')); return self.send(200, {'ok': 1})
            if u.path == '/api/moi':
                ten = b.get('ten', '').strip().lower()
                if not re.fullmatch(r'[a-z0-9][a-z0-9-]{1,60}', ten): return self.send(400, {'loi': 'name may only contain lowercase letters (no accents), digits and hyphens (e.g. secrets-of-the-deep-ocean)'})
                if os.path.exists(os.path.join(VIDEOS, ten)): return self.send(400, {'loi': 'name already exists'})
                cmd = ['moi', ten, '--khung', b.get('khung', '9x16'), '--mau', b.get('mau', 'footage')] if b.get('loai') != 'loat' else \
                      ['loat', 'moi', ten, '--so-tap', str(int(b.get('so_tap', 3))), '--khung', b.get('khung', '16x9'), '--mau', b.get('mau', 'footage')]
                r = subprocess.run([sys.executable, XP, *cmd], cwd=ROOT, capture_output=True, text=True, encoding='utf-8', errors='replace')
                if r.returncode: return self.send(400, {'loi': (r.stdout + r.stderr).strip()[-400:]})
                return self.send(200, {'p': f'videos/{ten}', 'loai': b.get('loai', 'video')})
            if u.path == '/api/tai-anh':                                     # drag-and-drop an AI image into anh_bia/<ten>.<ext>
                import base64
                d = safe_dir(b['p']); ten = b.get('ten', ''); ext = (b.get('duoi') or 'png').lower().lstrip('.')
                if not re.fullmatch(r'[\w\-]{1,60}', ten) or ext not in ('png', 'jpg', 'jpeg', 'webp'): return self.send(400, {'loi': 'invalid image name or type'})
                data = base64.b64decode(b['du_lieu'].split(',', 1)[-1])
                if len(data) > 30 * 1048576: return self.send(400, {'loi': 'image too large (> 30 MB)'})
                os.makedirs(os.path.join(d, 'anh_bia'), exist_ok=True)
                for f in os.listdir(os.path.join(d, 'anh_bia')):
                    if os.path.splitext(f)[0] == ten: os.remove(os.path.join(d, 'anh_bia', f))
                open(os.path.join(d, 'anh_bia', f'{ten}.{ext}'), 'wb').write(data); return self.send(200, {'ok': 1})
            if u.path == '/api/kenh/chu-de':                                    # approve / drop / re-propose a topic, or add a topic by hand
                K = kenh_mod(); T = K.topics(b['kenh'])
                if b.get('them'):
                    tt, _, goc = str(b['them']).partition('|')
                    T.append({'id': f"{time.strftime('%Y%m%d')}-{K.slug(tt)}", 'tieu_de': tt.strip(), 'goc': goc.strip(), 'trang_thai': 'duyet', 'ngay': time.strftime('%Y-%m-%d')})
                else:
                    i = int(b['chi_so']); st = b['trang_thai']
                    if st not in ('duyet', 'bo', 'de-xuat') or not 0 <= i < len(T): return self.send(400, {'loi': 'invalid topic / status'})
                    if T[i].get('trang_thai') in ('dang-lam', 'da-dang'): return self.send(400, {'loi': 'topic is in progress or already posted'})
                    T[i]['trang_thai'] = st
                K.save_topics(b['kenh'], T); K.log_event(b['kenh'], su_kien='studio-chu-de'); return self.send(200, {'ok': 1})
            if u.path == '/api/kenh/cau-hinh':                                   # save the settings form → kenh/<id>/kenh.yaml (keeps other keys)
                K = kenh_mod(); cid = b['kenh']; P = K.profile(cid); new = b['ho_so']
                if not isinstance(new, dict): return self.send(400, {'loi': 'invalid data'})
                def merge(dst, src):
                    for k, v in src.items():
                        if isinstance(v, dict) and isinstance(dst.get(k), dict): merge(dst[k], v)
                        else: dst[k] = v
                merge(P, new); P['cap_nhat_cai_dat'] = time.strftime('%Y-%m-%d %H:%M')
                K.ysave(os.path.join(K.kdir(cid), 'kenh.yaml'), P); K.log_event(cid, su_kien='luu-cai-dat'); return self.send(200, {'ok': 1})
            if u.path == '/api/kenh/bat':
                K = kenh_mod(); P = K.profile(b['kenh']); P['bat'] = bool(b['bat']); K.ysave(os.path.join(K.kdir(b['kenh']), 'kenh.yaml'), P)
                K.log_event(b['kenh'], su_kien='bat' if b['bat'] else 'tam-dung'); return self.send(200, {'ok': 1})
            if u.path == '/api/them-tap': return self.send(200, {'tap': them_tap(safe_dir(b['p']))})
            if u.path == '/api/mo-thu-muc':
                d = safe_dir(b['p'])
                if os.name == 'nt': os.startfile(d)
                else: subprocess.Popen(['xdg-open', d])
                return self.send(200, {'ok': 1})
            self.send(404, {'loi': 'not found'})
        except (KeyError, ValueError) as e: self.send(400, {'loi': str(e)})
        except Exception as e: self.send(500, {'loi': f'{type(e).__name__}: {e}'})

def main(a, xp_module):
    global X, ROOT, VIDEOS, XP, CACHE, SAVE
    X = xp_module; ROOT = X.find_root('.'); VIDEOS = os.path.join(ROOT, 'videos'); XP = os.path.join(HERE, 'xp.py')
    CACHE = os.path.join(ROOT, '.mega-shot', 'studio', 'anh'); os.makedirs(CACHE, exist_ok=True); SAVE = os.path.join(ROOT, '.mega-shot', 'studio', 'viec.json')
    for j in jload(SAVE, []) or []:
        if j.get('tt') in ('cho', 'chay'): j['tt'] = 'huy'; j['log'] = j.get('log', []) + ['■ studio was shut down while the job was running']
        JOBS.append(j)
    threading.Thread(target=worker, daemon=True).start()
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', a.cong), H)
    X.log(f'studio: http://127.0.0.1:{a.cong}  (Ctrl+C to stop)')
    if a.mo:
        import webbrowser; webbrowser.open(f'http://127.0.0.1:{a.cong}')
    try: srv.serve_forever()
    except KeyboardInterrupt: pass
