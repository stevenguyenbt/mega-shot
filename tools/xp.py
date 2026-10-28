"""mega-shot · xp — command-line video studio driven by video.yaml.

Start here:  xp setup                       check prerequisites, list what needs the user
Inside a video folder (where video.yaml is):
  xp new <name> [--format 9x16] [--template footage]   create videos/<name>
  xp check script                                       score the script before narration
  xp narrate [--redo ID …]                              narration per scene → build/timeline.json
  xp assets [scene …]                                   find, score, download and cut footage/images
  xp preview [--at 5,12,30]                             a few frames + contact sheet build/thu.jpg
  xp mix                                                voice + music + SFX → build/mix.wav
  xp render                                             every frame → build/raw.mp4
  xp export [--limit 29]                                upload file + phone preview + publish package
  xp check                                              quality check of the export
  xp all                                                narrate → mix → render → export → check
Series:      xp series new|run|assemble   ·  Thumbnails: xp thumbnail [new]  ·  Publishing: xp publish
Libraries:   xp voice add <audio|video> --name N --consent  ·  xp music add <audio|video> --name N [--use]  ·  xp music brief | check
Optional:    xp viral "<topic>" [--format short|long]   find & score viral videos on the topic before writing
Old Vietnamese command names (giong, thu, xuat, loat chay…) are still accepted.
"""
import argparse, base64, difflib, math, functools, hashlib, http.server, json, os, re, shutil, struct, subprocess, sys, threading, time, unicodedata, urllib.parse, urllib.request, uuid, wave

SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENGINE = os.path.join(SKILL, 'engine')
LANG_NAME = {'vi': 'Vietnamese', 'en': 'English', 'zh': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean', 'fr': 'French', 'es': 'Spanish', 'de': 'German', 'th': 'Thai', 'id': 'Indonesian', 'pt': 'Portuguese', 'ru': 'Russian'}
FORMATS = {'9x16': (1080, 1920), '16x9': (1920, 1080), '1x1': (1080, 1080)}
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def log(*a): print('[xp]', *a, flush=True)
def die(msg): print('[xp] ERROR:', msg, flush=True); sys.exit(1)
def run(cmd, **kw): return subprocess.run(cmd, check=True, **kw)

def find_root(start):
    """Project root = the nearest folder (walking up) that contains .mega-shot/ (voices, keys, shared assets).
    MS_PROJECT=<folder> overrides it; with neither, the start folder itself."""
    if os.environ.get('MS_PROJECT'): return os.path.abspath(os.environ['MS_PROJECT'])
    d = os.path.abspath(start)
    while True:
        if os.path.isdir(os.path.join(d, '.mega-shot')): return d
        p = os.path.dirname(d)
        if p == d: return os.path.abspath(start)
        d = p

def load_spec(path='video.yaml'):
    import yaml
    if not os.path.exists(path): die('video.yaml not found in the current folder')
    try:
        with open(path, encoding='utf-8') as f: s = yaml.safe_load(f)
    except yaml.YAMLError as e:
        # common mistake: a loi/phu_de/chu line starting with **bold** (YAML reads '*' as an alias) or containing ': ' / ' #' → quote it automatically, save, re-read
        L = open(path, encoding='utf-8').read().split('\n'); n = 0
        for i, l in enumerate(L):
            mm = re.match(r'^(\s+(?:-\s+)?(?:loi|phu_de|chu|chot|caption|moc|narration|text|subtitle|title|punchline|hook): )(.*)$', l)
            if mm and not mm.group(2).startswith(('"', "'", '>', '|')) and (mm.group(2).startswith('*') or ': ' in mm.group(2) or ' #' in mm.group(2)):
                L[i] = mm.group(1) + '"' + mm.group(2).replace('\\', '\\\\').replace('"', '\\"') + '"'; n += 1
        try:
            if not n: raise e
            s = yaml.safe_load('\n'.join(L)); open(path, 'w', encoding='utf-8', newline='').write('\n'.join(L))
            log(f'video.yaml: auto-quoted {n} line(s) (starting with ** or containing a colon)')
        except yaml.YAMLError as e2:
            m = getattr(e2, 'problem_mark', None)
            die(f"video.yaml has a syntax error{f' at line {m.line + 1}' if m else ''}: {getattr(e2, 'problem', e2)} — wrap any line containing a colon or # in double quotes")
    # an episode inside a series inherits shared settings from ../loat.yaml (the episode can override). Background music is handled by the assemble step → episodes default to no music.
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import yaml_keys
    yaml_keys.normalize(s, lambda m: log('⚠ ' + m))                             # English keys → internal names (both accepted)
    lp = os.path.join(os.path.dirname(os.path.abspath(path)), '..', 'loat.yaml')
    if os.path.exists(lp):
        with open(lp, encoding='utf-8') as f: L = yaml_keys.normalize_series(yaml.safe_load(f) or {})
        for k in ('khung', 'ngon_ngu', 'giong', 'phong_cach', 'do_to', 'nguon_them', 'sfx', 'nhip', 'muc_tieu_giay'):
            if k in L and k not in s: s[k] = L[k]
        s.setdefault('nhac', None); s['_loat'] = L.get('ten')
    s.setdefault('khung', '9x16'); s.setdefault('ngon_ngu', 'vi'); s.setdefault('giong', {}); s.setdefault('nhac', None)
    for c in s.get('canh') or []:                                                # doi_dap: two-presenter dialogue inside ONE scene (visuals run on; voices alternate)
        dd = c.get('doi_dap')                                                    # [{ ai: minh, loi, phu_de }] — ai → nhan_vat.<ai>.giong (or giong: on the line)
        if isinstance(dd, list) and dd:
            c['loi'] = ' '.join(str(x.get('loi', '')).strip() for x in dd)
            c['phu_de'] = '|'.join(str(x.get('phu_de') or x.get('loi', '')).strip() for x in dd)
    if s.get('nhac') and s['nhac'].get('file') and not os.path.exists(s['nhac']['file']):
        log(f"⚠ music file not found: {s['nhac']['file']} — continuing without background music (add one: xp music add <file> --name bg --use)"); s['nhac'] = None
    if s['khung'] not in FORMATS: die(f"unsupported format '{s['khung']}': {list(FORMATS)}")
    ids = [c['id'] for c in s['canh']]
    for c in s['canh']:
        if isinstance(c.get('anh'), dict) and not isinstance(c['anh'].get('file'), str): die(f"scene {c['id']}: the image file name must be quoted (YAML read {c['anh'].get('file')!r} as a number)")
        if not isinstance(c['id'], str): die(f"scene id {c['id']!r} must be text — put it in quotes")
        for k in ('chu', 'loi', 'phu_de'):                                     # `chu: 1099` → YAML reads a number; the engine needs a string
            if isinstance(c.get(k), (int, float)) and not isinstance(c.get(k), bool): c[k] = str(c[k])
    if len(ids) != len(set(ids)): die('duplicate scene id')
    return s

def dur_of(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True).stdout.strip()
    return float(out)

# ---------------------------------------------------------------- narration voice
class KhoaGiong:
    """Cross-process lock: every VoiceStudio call (synthesis, listen-back) is queued one at a time.
    Two jobs sent at once while a 6 GB GPU was nearly full once hung VoiceStudio completely. The OS lock is released automatically when the process dies."""
    def __init__(self, root): self.path = os.path.join(root, '.mega-shot', 'voicestudio.lock'); self.f = None
    def __enter__(self):
        self.f = open(self.path, 'a+')
        while True:
            try:
                if os.name == 'nt': import msvcrt; msvcrt.locking(self.f.fileno(), msvcrt.LK_NBLCK, 1)
                else: import fcntl; fcntl.flock(self.f, fcntl.LOCK_EX | fcntl.LOCK_NB)
                return self
            except OSError: time.sleep(1.5)
    def __exit__(self, *e):
        try:
            if os.name == 'nt': import msvcrt; self.f.seek(0); msvcrt.locking(self.f.fileno(), msvcrt.LK_UNLCK, 1)
        except OSError: pass
        self.f.close()

class VoiceStudio:
    """Narration through VoiceStudio's local API (started headless if not running — tools/voicestudio.py). Voice sample: .mega-shot/voices/<mau>/ref.wav + ref.txt (≤10 s)."""
    def __init__(self, cfg, root, lang):
        self.url = cfg.get('url', 'http://127.0.0.1:3900'); self.seed = str(cfg.get('seed', 1234)); self.lang = lang; self.root = root
        vd = os.path.join(root, '.mega-shot', 'voices', cfg.get('mau', 'documentarian'))
        if os.path.exists(os.path.join(vd, 'ref.wav')) and os.path.exists(os.path.join(vd, 'ref.txt')):
            self.ref = open(os.path.join(vd, 'ref.wav'), 'rb').read(); self.ref_text = open(os.path.join(vd, 'ref.txt'), encoding='utf-8').read().strip()
        elif cfg.get('_import'): self.ref, self.ref_text = b'', ''                 # --import-from: recorded audio, no voice sample needed
        else: die(f"voice sample '{os.path.basename(vd)}' not found in .mega-shot/voices/ — xp voice add --archetype documentarian (built-in English narrator), "
                  f"xp voice add <audio-or-video> --name <name> --consent, or narrate your own recordings with --import-from <folder>")
        self.key = hashlib.sha1(self.ref + self.ref_text.encode() + self.seed.encode()).hexdigest()[:10]
        self.denoise = 'true' if cfg.get('denoise') else 'false'                  # VoiceStudio denoise hard-gates every pause to digital silence → chopped sentence ends; off by default, mild afftdn instead
        self.khoa = KhoaGiong(root); self.num_step = str(cfg.get('num_step', 16))   # giong.num_step: inference steps (default 32 in VoiceStudio; 16 ≈ same quality, faster)
    def ping(self):
        for k in range(4):                                                     # the app may be busy synthesising for another job → slow to answer: wait longer, retry
            try: urllib.request.urlopen(self.url + '/v1/models', timeout=15); return True
            except Exception: time.sleep(5)
        return False
    def synth(self, text, duration=None):
        bd = uuid.uuid4().hex; body = b''
        f = {'text': text, 'language': LANG_NAME.get(self.lang, self.lang), 'ref_text': self.ref_text, 'seed': self.seed, 'num_step': self.num_step, 'denoise': self.denoise}
        if duration: f['duration'] = f'{duration:.2f}'                          # explicit length: VoiceStudio's own estimate can be too short → last word cut
        for k, v in f.items():
            body += f'--{bd}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode('utf-8')
        body += f'--{bd}\r\nContent-Disposition: form-data; name="ref_audio"; filename="ref.wav"\r\nContent-Type: audio/wav\r\n\r\n'.encode() + self.ref + f'\r\n--{bd}--\r\n'.encode()
        with self.khoa: return urllib.request.urlopen(urllib.request.Request(self.url + '/generate', body, {'Content-Type': f'multipart/form-data; boundary={bd}'}), timeout=900).read()
    def transcribe(self, path):
        """Listen back → (text, [[word, start, end], …]) — per-word timings so subtitles light up with the voice. Default: faster-whisper on CPU
        (tools/nghe.py) so VoiceStudio keeps only the voice model on the GPU; MS_ASR=voicestudio → use VoiceStudio's own Whisper."""
        if os.environ.get('MS_ASR', 'local') != 'voicestudio':
            try: return NgheLai.get(self.lang).nghe(path)
            except Exception as e: log(f'  local listen-back failed ({e}) → using VoiceStudio Whisper')
        asr_dau(self.root); bd = uuid.uuid4().hex; data = open(path, 'rb').read()
        fields = {'model': 'whisper-1', 'language': self.lang, 'response_format': 'verbose_json', 'timestamp_granularities[]': 'word'}
        body = ''.join(f'--{bd}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n' for k, v in fields.items()).encode() + \
               f'--{bd}\r\nContent-Disposition: form-data; name="file"; filename="a.wav"\r\nContent-Type: audio/wav\r\n\r\n'.encode() + data + f'\r\n--{bd}--\r\n'.encode()
        with self.khoa: r = json.loads(urllib.request.urlopen(urllib.request.Request(self.url + '/v1/audio/transcriptions', body, {'Content-Type': f'multipart/form-data; boundary={bd}'}), timeout=600).read())
        return r.get('text', ''), [[w['word'], round(w['start'], 3), round(w['end'], 3)] for w in r.get('words') or []]

class NgheLai:
    """One faster-whisper worker (tools/nghe.py, CPU) per xp run: the model loads once (~3 s), then ~0.5 s per second of audio.
    Model: env MS_ASR_MODEL (default small — already cached; medium/large-v3 = more accurate, slower)."""
    _w = None
    def __init__(self, lang):
        here = os.path.dirname(os.path.abspath(__file__)); self.lang = lang
        self.p = subprocess.Popen(['uv', 'run', '--quiet', '--with', 'faster-whisper', '--with', 'numpy', 'python', os.path.join(here, 'nghe.py'), '--model', os.environ.get('MS_ASR_MODEL', 'small')],
                                  stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, encoding='utf-8', errors='replace')
        hi = json.loads(self.p.stdout.readline() or '{}')
        if 'ready' not in hi: raise RuntimeError('could not start tools/nghe.py (faster-whisper)')
        import atexit; atexit.register(self.dong)                                 # never leave the worker (uv + python) running after xp exits
    def dong(self):
        try:
            self.p.stdin.close(); self.p.wait(timeout=5)
        except Exception:
            try: subprocess.run(['taskkill', '/F', '/T', '/PID', str(self.p.pid)], capture_output=True) if os.name == 'nt' else self.p.kill()
            except Exception: pass
    @classmethod
    def get(cls, lang):
        if cls._w is None or cls._w.p.poll() is not None: cls._w = cls(lang)
        return cls._w
    def nghe(self, path):
        self.p.stdin.write(json.dumps({'path': os.path.abspath(path), 'lang': self.lang}) + '\n'); self.p.stdin.flush()
        r = json.loads(self.p.stdout.readline() or '{"error": "worker exited"}')
        if 'error' in r: raise RuntimeError(r['error'])
        return r['text'], r['words']

def asr_dau(root):
    """Mark that VoiceStudio's own Whisper (large-v3, GPU, in-process — not listed by /model/loaded) has been loaded: it stays on
    the GPU and makes OmniVoice spill into system RAM, so the next narration restarts the backend first (vs_gon_gpu)."""
    try: os.makedirs(os.path.join(root, '.mega-shot', 'voicestudio'), exist_ok=True); open(os.path.join(root, '.mega-shot', 'voicestudio', 'asr_tren_gpu'), 'w').write(time.strftime('%F %T'))
    except Exception: pass

def vs_gon_gpu(url='http://127.0.0.1:3900', max_mb=3500, root=None):
    """Keep VoiceStudio lean on the 6 GB GPU before narrating: unload other models sitting on the GPU (e.g. its Whisper),
    flush the cache, and if the voice model has bloated (leak after long sessions: seen 8.8 GB → synthesis 25–80× slower)
    tell the caller to restart the backend. Returns True when a restart is needed."""
    mk = os.path.join(root, '.mega-shot', 'voicestudio', 'asr_tren_gpu') if root else None
    if mk and os.path.exists(mk): os.remove(mk); log('VoiceStudio: its Whisper is occupying the GPU → restarting for speed'); return True
    try:
        d = json.loads(urllib.request.urlopen(url + '/model/loaded', timeout=20).read())
        for m in d.get('models') or []:
            if m.get('id') != 'tts' and str(m.get('device', '')).startswith('cuda') and m.get('unloadable'):
                urllib.request.urlopen(urllib.request.Request(url + '/model/unload/' + urllib.parse.quote(m['id']), b'', method='POST'), timeout=60); log(f"VoiceStudio: unloaded {m.get('checkpoint') or m['id']} from the GPU")
        urllib.request.urlopen(urllib.request.Request(url + '/system/flush-memory', b'', method='POST'), timeout=60)
        d = json.loads(urllib.request.urlopen(url + '/model/loaded', timeout=20).read())
        tts = next((m for m in d.get('models') or [] if m.get('id') == 'tts'), None)
        if tts and (tts.get('vram_mb') or 0) > max_mb: log(f"VoiceStudio: voice model bloated to {tts['vram_mb'] / 1024:.1f} GB on the GPU → restarting for speed"); return True
    except Exception: pass
    return False

def cmd_channel(a):
    """xp channel … — tools/kenh.py. auth/upload need the Google API client: re-run once through uv with those packages."""
    if a.action in ('auth', 'upload'):
        try: import googleapiclient, google_auth_oauthlib  # noqa: F401
        except ImportError:
            here = os.path.dirname(os.path.abspath(__file__))
            r = subprocess.run(['uv', 'run', '--quiet', '--with', 'google-api-python-client', '--with', 'google-auth-oauthlib', '--with', 'pyyaml', '--with', 'ruamel.yaml',
                                'python', os.path.join(here, 'xp.py'), *sys.argv[1:]])
            sys.exit(r.returncode)
    if a.action not in ('list', 'due', 'release') and not a.id: die('channel name required: xp channel ' + a.action + ' <id>')
    if a.action == 'mark':
        if len(a.rest) < 2: die('xp channel mark <id> <topic> <state>')
        a.topic, a.state = a.rest[0], a.rest[1]
    if a.action == 'upload':
        a.video = a.video or (a.rest[0] if a.rest else None)
        if not a.video: die('xp channel upload <id> <videos/folder>')
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kenh
    kenh.main(a, sys.modules[__name__])

def vs_ensure(root, restart=False):
    """VoiceStudio API not answering → start the backend headless (no window); restart=True: the headless backend started by xp is hung → restart it."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import voicestudio
    if voicestudio.up(): 
        if not restart or not voicestudio._alive(voicestudio._pid(root)): return True
        log('headless VoiceStudio not responding to the API → restarting'); voicestudio.stop(root, log)
    return voicestudio.start(root, log)

def norm(s):
    s = unicodedata.normalize('NFC', s.lower())
    return re.sub(r'[\W_]+', ' ', s).strip()

def khop_doc(noi, heard, lang, cfg=None):
    """match between the words sent to the voice (numbers already spelled out by doc_so) and the listen-back (digits spelled out too)"""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import doc_so
    sim = similarity(noi, doc_so.ve_chu(heard, lang, cfg), lang); sai = doc_so.so_sai(noi, heard, lang, cfg)
    if sai: log(f"  misread number: «{'» · «'.join(sai[:3])}» not heard"); sim = min(sim, .5)   # a misread number fails the line → other seeds are tried
    return sim

def similarity(a, b, lang):
    a, b = norm(a), norm(b)
    if re.match(r'^(zh|ja|th)', lang): return difflib.SequenceMatcher(None, a.replace(' ', ''), b.replace(' ', '')).ratio()
    return difflib.SequenceMatcher(None, a.split(), b.split()).ratio()

# Narration hygiene (lesson learned: breathy "hit" sounds at sentence ends):
#  1. VoiceStudio `denoise` hard-gates every pause to digital silence → chopped sentence ends → always OFF (VoiceStudio.denoise).
#  2. A clone made from a noisy/music-backed or spliced sample reproduces that noise + breath/"hit" sounds at line ends —
#     check the sample with `xp voice check <name>` (noise floor, splices, clipped end) BEFORE using it.
#  3. Per line: strip a stray word/click before the first real word, shorten dead-air pauses, verify the last syllable decays
#     naturally (if it is cut while still loud → re-synthesize with a 15 % longer explicit duration).

def _pcm(path):
    with wave.open(path) as w: sr, ch, n = w.getframerate(), w.getnchannels(), w.getnframes(); x = struct.unpack(f'<{n * ch}h', w.readframes(n))
    return sr, [x[i] / 32768 for i in range(0, len(x), ch)]

def _db_frames(path, step=.02):
    import numpy as np
    with wave.open(path) as w: sr, ch = w.getframerate(), w.getnchannels(); x = np.frombuffer(w.readframes(w.getnframes()), '<i2').reshape(-1, ch)[:, 0].astype(np.float32) / 32768
    fr = int(sr * step); n = len(x) // fr
    return np.array([20 * np.log10(np.sqrt(np.mean(x[k * fr:(k + 1) * fr] ** 2)) + 1e-9) for k in range(n)])

def cut_cuoi(path):
    """True if the line ends while the voice is still loud (last syllable cut off)."""
    import numpy as np
    db = _db_frames(path)
    if len(db) < 20: return False
    speech = np.percentile(db, 75); end = db[-12:]                                                                 # last 240 ms
    return end.max() > speech - 12 and end[-3:].max() > speech - 20 and not (end < speech - 30).any()

def gon_lang(path, max_nghi=.42, giu=.32, nguong=-40):
    """tidy a narration file: drop an isolated click/breath before the first word (only when separated from speech by ≥ 0.1 s
    of quiet), trim dead air at the start to 50 ms, and shorten every pause longer than `max_nghi` s to `giu` s — 15 ms fades"""
    import numpy as np
    with wave.open(path) as w: sr, ch = w.getframerate(), w.getnchannels(); x = np.frombuffer(w.readframes(w.getnframes()), '<i2').reshape(-1, ch).astype(np.float32)
    fr = int(sr * .02); n = len(x) // fr
    if n < 10: return 0, 0
    db = np.array([20 * np.log10(np.sqrt(np.mean(x[i * fr:(i + 1) * fr] ** 2)) / 32768 + 1e-9) for i in range(n)]); loud = db >= nguong
    st = next((i for i in range(n - 10) if loud[i:i + 10].all()), 0)              # first 0.2 s of continuous speech
    k = st
    while k > 0 and loud[k - 1]: k -= 1                                            # walk back over the word's soft onset
    gap = 0
    while k - gap - 1 >= 0 and not loud[k - gap - 1]: gap += 1
    start = max(0, k - min(gap, 3)) if (gap >= 5 or not loud[:max(0, k - gap)].any()) else 0   # only cut junk that is clearly separated
    segs, i, cut = [], start, 0
    while i < n:
        j = i
        while j < n and loud[j] == loud[i]: j += 1
        segs.append((loud[i], i, j)); i = j
    out = []
    for q, (ld, a_, b_) in enumerate(segs):
        seg = x[a_ * fr:b_ * fr] if q < len(segs) - 1 else x[a_ * fr:]
        if not ld and 0 < q < len(segs) - 1 and (b_ - a_) * .02 > max_nghi:      # internal pause too long → keep head + tail of it
            h = int(sr * giu / 2); seg = np.concatenate([seg[:h], seg[-h:]]); cut += 1
        out.append(seg)
    y = np.concatenate(out) if out else x; xf = int(sr * .015); y[:xf] *= np.linspace(0, 1, xf)[:, None]
    with wave.open(path, 'wb') as w: w.setnchannels(ch); w.setsampwidth(2); w.setframerate(sr); w.writeframes(np.clip(y, -32768, 32767).astype('<i2').tobytes())
    return round(start * .02, 2), cut

def synth_sach(vs, text, out, lang):
    """synthesize one line cleanly: natural ending (retry if cut), no stray first word, no dead air"""
    raw = out + '.raw.wav'; open(raw, 'wb').write(vs.synth(text))
    for k in range(2):
        if not cut_cuoi(raw): break
        d = dur_of(raw) * 1.15 + .3; log(f'  sentence ending cut off → regenerating ({d:.1f}s)'); open(raw, 'wb').write(vs.synth(text, d))
    t0 = 0.0
    try:
        _, w = vs.transcribe(raw); tw = norm(text).split(); f1 = lambda t: (norm(t).split() or [''])[0]
        if len(w) > 1 and tw and f1(w[0][0]) != tw[0] and f1(w[1][0]) == tw[0]: t0 = max(0, w[1][1] - .06); log(f"  dropped stray word at the start: '{w[0][0]}'")
    except Exception: pass
    run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t0:.3f}', '-i', raw, '-af', 'afftdn=nr=8:nf=-45,afade=t=in:d=0.01', out]); os.remove(raw)
    t_dau, n_cat = gon_lang(out)
    if t_dau > .1 or n_cat: log(f'  tidied: removed {t_dau:.2f}s at the start · shortened {n_cat} long pause(s)')
    if cut_cuoi(out): log('  ⚠ sentence ending still cut off — listen to this line again, change the seed or add a few words')

def cmd_giong(a):
    s = load_spec(); root = find_root('.'); lang = s['ngon_ngu']; os.makedirs('build/audio', exist_ok=True)
    vs = VoiceStudio({**s['giong'], '_import': bool(a.nhap_tu)}, root, lang); g_cfg = s['giong']                # giong.thu_lai_duoi (0.8) / so_lan_thu (3): best-of-N on low-match lines
    need, ghep = [], {}                                                          # doi_dap scenes: each line is voiced separately (its own speaker), then joined
    for c in s['canh']:
        if not c.get('loi'): continue
        if isinstance(c.get('doi_dap'), list) and c['doi_dap']:
            parts = [{'id': f"{c['id']}__{k + 1}", 'loi': str(x['loi']).strip(), 'ai': x.get('ai'), **({'giong': x['giong']} if x.get('giong') else {})} for k, x in enumerate(c['doi_dap'])]
            need += parts; ghep[c['id']] = [p['id'] for p in parts]
            if a.lam_lai and c['id'] in a.lam_lai: a.lam_lai = list(a.lam_lai) + ghep[c['id']]
        else: need.append(c)
    imported = sorted(os.listdir(a.nhap_tu)) if a.nhap_tu else None
    if not a.nhap_tu and not (vs_ensure(root) and vs.ping()) and not vs_ensure(root, restart=True): die(f'cannot connect to VoiceStudio at {vs.url} — see .mega-shot/voicestudio/backend.log or run `xp voicestudio restart`')
    if not a.nhap_tu and vs_gon_gpu(vs.url, root=root):                                     # keep the GPU lean for the voice model (Whisper runs on CPU — NgheLai)
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import voicestudio
        voicestudio.stop(root, log); voicestudio.start(root, log)
    report = []
    toc0 = toc = float(s['giong'].get('toc_do', 1.0))                            # >1: read faster, pitch kept (atempo) · scene `toc_do:` overrides (pace for emphasis)
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import doc_so
    VS = {json.dumps(s['giong'], sort_keys=True, default=str): vs}
    def voice_for(c):                                                            # story videos: a line spoken by a character (`ai: minh`) uses nhan_vat.minh.giong; `giong:` on a scene overrides
        cfg = dict(s['giong']); cfg.update(((s.get('nhan_vat') or {}).get(c.get('ai')) or {}).get('giong') or {}); cfg.update(c.get('giong') or {})
        key = json.dumps(cfg, sort_keys=True, default=str)
        if key not in VS: VS[key] = VoiceStudio(cfg, root, lang)
        return VS[key]
    for k, c in enumerate(need):
        vs = voice_for(c); toc = float(c.get('toc_do') or toc0)
        noi = doc_so.doc(c['loi'], lang, g_cfg)                                  # numbers → spoken words (2.397, 3,1%, 17/10, 1946) — the voice model misreads digits
        if noi != c['loi']: log(f"{c['id']}: numbers spelled out → {noi[:90]}{'…' if len(noi) > 90 else ''}")
        hof = lambda tc: hashlib.sha1(((c['loi'] if noi == c['loi'] else noi + '|doc_so1') + lang + vs.key + (f'|{tc:g}' if tc != 1 else '')).encode('utf-8')).hexdigest()[:10]
        h = hof(toc); out = f"build/audio/{c['id']}.wav"; meta = out + '.json'
        old = json.load(open(meta, encoding='utf-8')) if os.path.exists(meta) else {}
        # only toc_do changed → stretch the existing file (atempo, pitch kept) + rescale per-word timings; do NOT re-synthesize / re-listen
        if old.get('hash') and old['hash'] != h and os.path.exists(out) and not a.nhap_tu and c['id'] not in (a.lam_lai or []):
            t_old = next((tc for tc in ([old['toc']] if old.get('toc') else []) + [1.0, 1.05, 1.08, 1.1, 1.12, 1.15, 1.18, 1.2, 1.25] if hof(tc) == old['hash']), None)   # only when the TEXT is unchanged
            if t_old:
                r = toc / t_old; tmp = out + '.tmp.wav'; run(['ffmpeg', '-v', 'error', '-y', '-i', out, '-af', f'atempo={r:.4f}', tmp]); os.replace(tmp, out)
                ck = old.get('check', {}); ck['tu'] = [[w, round(a_ / r, 3), round(b_ / r, 3)] for w, a_, b_ in ck.get('tu') or []]; ck['dur'] = round(dur_of(out), 2)
                old.update(hash=h, toc=toc, check=ck); json.dump(old, open(meta, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
                log(f"{c['id']}: speed changed {t_old:g} → {toc:g} (not re-synthesized) · {ck['dur']}s"); report.append(ck); continue
        if a.nhap_tu:
            src = os.path.join(a.nhap_tu, f'seg{k + 1}.wav')
            shutil.copy(src, out); old = {}; log(f"imported {c['id']} ← {src}")
        elif old.get('hash') == h and os.path.exists(out) and c['id'] not in (a.lam_lai or []):
            ck = old.get('check', {})
            if 'tu' not in ck and vs.ping():                                         # old file has no per-word timings → listen back once
                try: ck['nghe_lai'], ck['tu'] = vs.transcribe(out); json.dump(old, open(meta, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
                except Exception: pass
            log(f"{c['id']}: reused (unchanged)"); report.append(ck); continue
        else:
            log(f"{c['id']}: synthesizing…"); synth_sach(vs, noi, out, lang)
            if toc != 1:
                tmp = out + '.tmp.wav'; run(['ffmpeg', '-v', 'error', '-y', '-i', out, '-af', f'atempo={toc:.3f}', tmp]); os.replace(tmp, out)
        chk = {'id': c['id'], 'dur': round(dur_of(out), 2)}
        if vs.ping():
            try:
                tx, words = vs.transcribe(out); sim = khop_doc(noi, tx, lang, g_cfg)   # Whisper writes numbers as digits → spell them out and compare with the spoken words (a garbled number = mismatch)
                # best-of-N: a low match usually means OmniVoice dropped/garbled words (lists of proper names) → resample with other seeds, keep the best
                thr, extra = float(g_cfg.get('thu_lai_duoi', .8)), int(g_cfg.get('so_lan_thu', 3))
                if not a.nhap_tu and sim < thr and extra:
                    s0, alt = vs.seed, out + '.alt.wav'
                    for j in range(1, extra + 1):
                        vs.seed = str(int(s0) + 101 * j); synth_sach(vs, noi, alt, lang)
                        if toc != 1: tmp = alt + '.tmp.wav'; run(['ffmpeg', '-v', 'error', '-y', '-i', alt, '-af', f'atempo={toc:.3f}', tmp]); os.replace(tmp, alt)
                        tx2, w2 = vs.transcribe(alt); s2 = khop_doc(noi, tx2, lang, g_cfg)
                        log(f"  tried seed {vs.seed}: match {s2:.0%}" + (' ← better' if s2 > sim else ''))
                        if s2 > sim: os.replace(alt, out); tx, words, sim = tx2, w2, s2; chk['seed'] = int(vs.seed); chk['dur'] = round(dur_of(out), 2)
                        if sim >= thr: break
                    vs.seed = s0
                    if os.path.exists(alt): os.remove(alt)
                # chen_dau (stray insert at the start) = the listen-back has ≥2 extra words before the first matching run (not flagged when only the first word is misheard, e.g. "rạn" → "rạng")
                aw, bw = norm(noi).split(), norm(doc_so.ve_chu(tx, lang, g_cfg)).split(); blk = next((m for m in difflib.SequenceMatcher(None, aw, bw, autojunk=False).get_matching_blocks() if m.size >= 2), None)
                chk.update({'nghe_lai': tx, 'giong_nhau': round(sim, 3), 'chen_dau': bool(blk and blk.b - blk.a >= 2)})
                flag = ' ⚠' if sim < .7 or chk['chen_dau'] else ''
                log(f"  {chk['dur']}s · match {sim:.0%}{flag}")
            except Exception as e: chk['loi_kiem_tra'] = str(e)
        json.dump({'hash': h, 'toc': toc, 'check': chk}, open(meta, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); report.append(chk)
    for c in need:                                                               # character voices: `giong.cao_do` (semitones) — pitch shift with the SAME duration, word timings stay valid
        cfg = dict(s['giong']); cfg.update(((s.get('nhan_vat') or {}).get(c.get('ai')) or {}).get('giong') or {}); cfg.update(c.get('giong') or {})
        cd, out = float(cfg.get('cao_do', 0) or 0), f"build/audio/{c['id']}.wav"; meta = out + '.json'
        if not os.path.exists(meta): continue
        m = json.load(open(meta, encoding='utf-8'))
        if float(m.get('cao_do', 0)) == cd: continue
        src = out[:-4] + '.goc.wav'
        if 'cao_do' not in m or not os.path.exists(src): shutil.copy(out, src)          # keep the unshifted voice
        if cd:
            with wave.open(src) as w: sr = w.getframerate()
            k = 2 ** (cd / 12); run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', f'asetrate={sr * k:.0f},aresample={sr},atempo={1 / k:.6f}', out])
        else: shutil.copy(src, out)
        m['cao_do'] = cd; json.dump(m, open(meta, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); log(f"{c['id']}: pitch {cd:+g} semitones")
    GAP = float((s.get('nhip') or {}).get('doi_dap_nghi', .3))                 # pause between two presenters' turns
    for pid, ids in ghep.items():                                                # join the turns into the scene's own wav + merged word timings / check
        out = f"build/audio/{pid}.wav"; metas = [json.load(open(f"build/audio/{i}.wav.json", encoding='utf-8')) for i in ids]
        h = hashlib.sha1(('|'.join(m.get('hash', '') + str(m.get('cao_do', 0)) for m in metas) + f'|{GAP}').encode()).hexdigest()[:10]
        old = json.load(open(out + '.json', encoding='utf-8')) if os.path.exists(out + '.json') else {}
        if old.get('hash') != h or not os.path.exists(out):
            with wave.open(f"build/audio/{ids[0]}.wav") as w: sr, ch = w.getframerate(), w.getnchannels()
            fl = 'build/audio/_ghep.txt'; sil = f'build/audio/_lang_{sr}_{ch}.wav'
            run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', f'anullsrc=r={sr}:cl={"mono" if ch == 1 else "stereo"}', '-t', f'{GAP}', sil])
            with open(fl, 'w', encoding='utf-8') as f:
                for n, i in enumerate(ids): f.write(('' if not n else f"file '{os.path.abspath(sil)}'\n") + f"file '{os.path.abspath(f'build/audio/{i}.wav')}'\n")
            run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', fl, '-ar', str(sr), '-ac', str(ch), out])
        tu, t, tx, sims = [], 0.0, [], []
        for i, m in zip(ids, metas):
            ck = m.get('check', {}); tu += [[w_, round(a_ + t, 3), round(b_ + t, 3)] for w_, a_, b_ in ck.get('tu') or []]
            tx.append(ck.get('nghe_lai', '')); sims.append(ck.get('giong_nhau', 1)); t += dur_of(f"build/audio/{i}.wav") + GAP
        chk = {'id': pid, 'dur': round(dur_of(out), 2), 'nghe_lai': ' '.join(tx), 'giong_nhau': min(sims), 'chen_dau': any(m.get('check', {}).get('chen_dau') for m in metas), 'tu': tu, 'luot': ids}
        json.dump({'hash': h, 'toc': toc, 'check': chk}, open(out + '.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        report = [r for r in report if r.get('id') not in ids] + [chk]
        log(f"{pid}: dialogue {len(ids)} turns · {chk['dur']}s · lowest match {min(sims):.0%}")
    json.dump([{k: v for k, v in r.items() if k != 'tu'} for r in report], open('build/giong_kiemtra.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    bad = [r['id'] for r in report if r.get('giong_nhau', 1) < .7 or r.get('chen_dau')]
    if bad: log('⚠ listen again:', ', '.join(bad), '→ fix the line or run: xp narrate --redo', ' '.join(bad))
    cmd_mocthoigian(a)

# ---------------------------------------------------------------- timeline + subtitles
SPLIT = re.compile(r'.+?(?:[.,:;?!…]+(?=\s|$)|[。，、？！：；]+|$)')   # Latin punctuation only breaks when followed by whitespace → numbers like "1.000", "3,5" are not split
# syllable count when reading one displayed "word" (Vietnamese: each word ≈ 1 syllable; digits read longer: 1977 → 7, 1.000 → 2, 3/4 → 3)
def am_tiet(tok):
    d = re.sub(r'[^\d/%]', '', tok)
    if not d and re.search(r'[a-zA-Z]', tok) and not re.search(r'[à-ỹđ]', tok.lower()): return max(1, len(re.findall(r'[aeiouy]+', tok.lower())))   # English: count vowel groups
    if not d: return 1
    if '/' in d: return 3
    n = re.sub(r'\D', '', d); k = 0
    for i, ch in enumerate(n):
        pos = len(n) - 1 - i
        if ch != '0': k += 1 + (1 if pos % 3 else 0)
        if pos and pos % 3 == 0 and int(n[max(0, i - 2):i + 1] or 0): k += 1
    return max(1, k) + ('%' in d) * 2

NGAT_TRUOC = set('rằng được đến là và nhưng vì nên để khi mà thì từ có cho với hoặc nhờ giống như ngang'.split() + 'and but which who that because so when while after before until as where whose'.split())
KHONG_NGAT_SAU = set('một hai ba bốn năm sáu bảy tám chín mười phần trên dưới đáy của những các mỗi cả rất sẽ đã đang bị cho rằng tới đến hơn gần khoảng chưa'.split() + 'the a an of to in on at by for from with its their his her this that these those than more over nearly about'.split())

def make_subs(text, t0, dur, lang, words=None):
    """Split subtitles into short cues + per-word timings. words = Whisper timings [[word, start, end]] (seconds from the start of the voice file).
    The displayed text (phu_de) may differ from the spoken text (numbers written as digits) → mapped by cumulative syllable ratio.
    **word** in phu_de = keyword (coloured); numbers are highlighted automatically."""
    parts = [p.strip() for seg in text.split('|') for p in SPLIT.findall(seg) if p.strip()]   # "|" = a break chosen by the writer
    merged = []
    for p in parts:
        if merged and len(merged[-1]) < 14 and not re.search(r'[.?!。？！]$', merged[-1]): merged[-1] += ' ' + p
        else: merged.append(p)
    # a cue too long for 2 subtitle lines → split in two at the space nearest the middle (preferring after a comma)
    lim = 36 if re.match(r'^(zh|ja|th)', lang) else 60; res = []                  # ≤ 2 lines at the 800 px subtitle width
    for p in merged:
        while len(p.replace('**', '')) > lim and ' ' in p:
            mid = len(p) // 2; sp = [i for i, ch in enumerate(p) if ch == ' ']
            def cost(i):                                                         # break at phrase boundaries, never split "một phần | ba", "Trái | Đất", "đáy | biển" (Vietnamese examples)
                prev = p[:i].split()[-1].strip('*').lower(); nxt = p[i + 1:].split()[0].strip('*').lower()
                c_ = abs(i - mid) / max(len(p), 1)
                if p[i - 1] in ',;:': c_ -= .35
                if nxt in NGAT_TRUOC: c_ -= .2
                if prev in KHONG_NGAT_SAU or (prev[:1].isupper() and nxt[:1].isupper()): c_ += .6
                return c_
            cut = min(sp, key=cost); res.append(p[:cut]); p = p[cut + 1:]
        res.append(p)
    cues = [[(w, am_tiet(w)) for w in p.split()] for p in res]
    tot = sum(n for cue in cues for _, n in cue) or 1
    if words:                                                                    # time function proportional to syllables, anchored on the Whisper timings
        ws = [(am_tiet(w), st, en) for w, st, en in words]; wt = sum(n for n, _, _ in ws) or 1; pts = [(0.0, ws[0][1])]; acc = 0
        for n, st, en in ws: acc += n; pts.append((acc / wt, en))
        def at(f):
            for (f0, s0), (f1, s1) in zip(pts, pts[1:]):
                if f <= f1: return s0 + (s1 - s0) * ((f - f0) / (f1 - f0) if f1 > f0 else 0)
            return pts[-1][1]
        T = lambda f: t0 + min(at(f), dur)
    else: T = lambda f: t0 + dur * f
    out = []; acc = 0; trong = False                                              # trong = currently inside a multi-word **keyword** phrase
    for cue in cues:
        ww = []
        for w, n in cue:
            mo = w.startswith('**'); dong = bool(re.search(r'\*\*\W*$', w)) and (not mo or w.count('**') >= 2)
            k = mo or trong or bool(re.search(r'\d', w)); clean = w.replace('**', '')
            trong = (trong or mo) and not dong
            ww.append([clean, round(T(acc / tot), 3), round(T((acc + n) / tot), 3), 1 if k else 0]); acc += n
        out.append({'s': re.sub(r'[,:;，、：；]$', '', ' '.join(w[0] for w in ww)), 't0': ww[0][1], 't1': ww[-1][2], 'w': ww})
    for a_, b_ in zip(out, out[1:]): a_['t1'] = max(a_['t1'], min(b_['t0'], a_['t1'] + .25))   # hold the text a little longer if there is room
    return out

def cmd_mocthoigian(a=None):
    s = load_spec(); lang = s['ngon_ngu']; t = 0.0; scenes = []; subs = []
    if s.get('nhan_vat'): os.makedirs('build', exist_ok=True); json.dump(s['nhan_vat'], open('build/nhan_vat.json', 'w', encoding='utf-8'), ensure_ascii=False)   # story films: character bible for the page
    nh = s.get('nhip', {}); beats = nhip_nhac(s) if nh.get('khop_nhip', True) else []      # fast default pacing: 0.15 s lead-in, 0.25 s pause
    for k, c in enumerate(s['canh']):
        lead = c.get('dem', nh.get('dem_dau', .1) if k == 0 else nh.get('dem', .15)); after = c.get('nghi', nh.get('nghi', .25)); extra = c.get('them', 0)
        if k == len(s['canh']) - 1: extra = max(extra, float(nh.get('duoi', 1.5)) - after)   # ≥1.5 s after the last word: a 0.2 s tail got clipped by re-encodes and TikTok/FB loop → "cut mid-sentence" (lesson learned)
        if k and beats and scenes:                                               # move the scene boundary to the nearest music beat (±0.12 s) → cuts land on the beat
            pv = scenes[-1].get('voice') or {'t0': 0, 'dur': 0}; b = min(beats, key=lambda x: abs(x - t))
            if abs(b - t) <= .12 and b > pv['t0'] + pv['dur'] + .05: t = b; scenes[-1]['t1'] = round(t, 3)
        wav = f"build/audio/{c['id']}.wav"; sc = {'id': c['id'], 't0': round(t, 3), 'data': {k2: v for k2, v in c.items() if k2 not in ('id', 'loi')}}
        if c.get('loi'):
            if not os.path.exists(wav): die(f"missing narration for scene {c['id']} — run xp narrate")
            d = dur_of(wav); sc['voice'] = {'t0': round(t + lead, 3), 'dur': round(d, 3), 'file': wav}; sc['text'] = c['loi']
            mj = json.load(open(wav + '.json', encoding='utf-8')) if os.path.exists(wav + '.json') else {}
            subs += make_subs(str(c.get('phu_de') or c['loi']), t + lead, d, lang, mj.get('check', {}).get('tu')); t += lead + d + after + extra   # phu_de: displayed text, loi: spoken text
        else: t += c.get('thoi_luong', 3) + extra
        sc['t1'] = round(t, 3); scenes.append(sc)
    tl = {'format': s['khung'], 'lang': lang, 'dur': round(t, 3), 'scenes': scenes, 'subs': subs, 'style': s.get('phong_cach', {}), 'title': s.get('ten', '')}
    os.makedirs('build', exist_ok=True); json.dump(tl, open('build/timeline.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    log(f"timeline: {len(scenes)} scenes · {t:.1f}s · {len(subs)} subtitle lines")

def vong_nhip(s, f):
    """Loop points for a background track that has to repeat: (start, end, crossfade) on its beat grid, or None.
    start = first beat of a steady groove; end = a beat 2 beats before the last strong beat (skips the ending/fade); crossfade = 4 beats."""
    bt = nhip_nhac(s)
    if len(bt) < 24: return None
    import numpy as np
    P = float(np.median(np.diff(bt))); sr = 8000
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', str(sr), '-af', 'highpass=f=1500', '-f', 'f32le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, np.float32); w = int(.06 * sr)
    st = np.array([np.sqrt(np.mean(x[max(0, int(b * sr) - w):int(b * sr) + w] ** 2)) if int(b * sr) < len(x) else 0 for b in bt])
    strong = np.where(st >= .45 * np.median(st))[0]
    if len(strong) < 16: return None
    ok = st >= .45 * np.median(st); k1 = int(strong[-1]) - 2
    g8 = st >= .7 * np.median(st); k0 = next((k for k in range(len(bt) - 8) if g8[k:k + 8].all()), int(strong[0]))   # restart where the groove is steady (8 strong beats in a row), not in a sparse intro
    if (k1 - k0) * P < 12: return None
    return float(bt[k0]), float(bt[k1]), 4 * P


def nhip_nhac(s):
    """Beats of the background music (seconds): onset-energy detection + autocorrelation period (70–160 BPM). Cached in build/nhip.json per music file."""
    m = s.get('nhac') or {}
    if not m.get('file') or not os.path.exists(m['file']): return []
    key = f"{m['file']}|{os.path.getmtime(m['file'])}"; cp = 'build/nhip.json'
    if os.path.exists(cp):
        c = json.load(open(cp, encoding='utf-8'))
        if c.get('key') == key: return c['beats']
    import numpy as np
    sr = 8000; raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', m['file'], '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-'], capture_output=True).stdout
    x = np.frombuffer(raw, np.float32); hop = 80; fr = len(x) // hop                              # 100 frames/s
    e = np.sqrt((x[:fr * hop].reshape(fr, hop) ** 2).mean(1)); on = np.maximum(np.diff(np.log1p(e * 50), prepend=0), 0)
    on = on - np.convolve(on, np.ones(20) / 20, 'same'); on[on < 0] = 0
    L = min(len(on), 6000); ac = np.correlate(on[:L], on[:L], 'full')[L - 1:]; lo, hi = 6000 // 160, 6000 // 70
    per = lo + int(np.argmax(ac[lo:hi])); phase = int(np.argmax([on[p::per].sum() for p in range(per)]))
    beats = [round((phase + i * per) / 100, 3) for i in range((fr - phase) // per)]
    os.makedirs('build', exist_ok=True); json.dump({'key': key, 'bpm': round(6000 / per, 1), 'beats': beats}, open(cp, 'w', encoding='utf-8'))
    log(f'music tempo: {6000 / per:.0f} BPM'); return beats

# ---------------------------------------------------------------- audio
def voice_gain(path, target=-16.5):
    """dB to bring one narration clip to `target` LUFS (±6 dB), cached next to the clip."""
    cp = path + '.lufs'
    if os.path.exists(cp) and os.path.getmtime(cp) >= os.path.getmtime(path): L = float(open(cp).read())
    else:
        lo = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace').stderr
        m = re.findall(r'I:\s+(-?[\d.]+) LUFS', lo); L = float(m[-1]) if m else target; open(cp, 'w').write(str(L))
    return max(-6, min(6, target - L)) if L > -70 else 0

def cmd_am(a):
    if os.path.exists('build/timeline.json') and os.path.getmtime('video.yaml') > os.path.getmtime('build/timeline.json'):
        log('video.yaml is newer than the timeline → rebuilding the timeline before mixing'); cmd_mocthoigian()   # yaml edited (sfx/mix/music…) then mix: don't use a stale timeline
    s = load_spec(); tl = json.load(open('build/timeline.json', encoding='utf-8')); D = tl['dur']
    g = s['giong']; vol = g.get('am_luong', .55); ins = []; fc = ''; n = 0          # default voice 55% + music 60%, light ducking: loud music bed, quieter voice (tuned by ear)
    for sc in tl['scenes']:
        if 'voice' not in sc: continue
        ms = int(sc['voice']['t0'] * 1000); ins += ['-i', sc['voice']['file']]; gdb = voice_gain(sc['voice']['file'], g.get('lufs_cau', -16.5))
        fc += f'[{n}]afade=t=in:d=0.03,areverse,afade=t=in:d=0.03,areverse,volume={gdb:.2f}dB,adelay={ms}|{ms}[v{n}];'; n += 1   # 30 ms fades at both ends of every line: no click at joins (video-use rule)                  # every line brought to the same loudness → loud music still doesn't swamp a quiet line
    n_giong = n
    if n: fc += ''.join(f'[v{i}]' for i in range(n)) + f'amix=inputs={n}:normalize=0,apad=whole_dur={D},atrim=0:{D},aformat=sample_rates=48000:channel_layouts=stereo,volume={vol}[vo];'
    else:                                                                        # no narration at all (music/SFX-only videos, e.g. games/warm-ups): silent voice bed, no voice stem
        ins += ['-f', 'lavfi', '-t', f'{D:.3f}', '-i', 'anullsrc=r=48000:cl=stereo']; fc += '[0]aformat=sample_rates=48000:channel_layouts=stereo[vo];'; n = 1
    fc_giong = fc                                                  # voice-only stem → build/giong.wav (xp check looks for clicks at joins here; SFX/music hits are intended)
    m = s.get('nhac')
    if m and m.get('soan'):                                                      # composed for this video (xp nhac): exact length, no looping
        m = {**m, 'file': cmd_nhac(quiet=True), 'tu': 0, 'den': None}
    if m and m.get('file') and s.get('khung') == '16x9' and not m.get('giu'):          # long YouTube videos (16:9): voice + natural sound only (by design); nhac.giu: true to keep the music anyway
        log('16:9 YouTube → background music dropped (set nhac.giu: true to keep it)'); m = None
    if m and m.get('file'):
        tu, den = float(m.get('tu', 0)), m.get('den'); md = (float(den) if den else dur_of(m['file'])) - tu   # nhac.tu / nhac.den: use only part of the track (skip a silent stretch mid-track)
        reps = max(1, int(D // max(md - 8, 1)) + 1); xf = min(4, md / 3)
        # beat-aligned loop (lesson learned: the 4 s end↔start crossfade laid the fading outro over the intro → the beat stumbled ~3 s mid-video):
        # cut on a strong beat before the ending, restart on the first beat, crossfade a whole number of beats
        lp = vong_nhip(s, m['file']) if reps > 1 and not m.get('soan') and not m.get('tu') and not m.get('den') else None
        if lp: tu, den, xf = lp; md = den - tu; reps = max(1, int(D // max(md - xf, 1)) + 1); log(f'beat-aligned music loop: {tu:.2f}–{den:.2f}s, crossfade {xf:.2f}s ({reps} loops)')
        mi = n; ins += sum([['-i', m['file']] for _ in range(reps)], [])
        # trim silence at the start/end of the track before looping (a track with 4 s of silence at the start once left a hole in the music mid-video)
        trim = (f'atrim={tu}' + (f':{den}' if den else '') + ',asetpts=PTS-STARTPTS,' if tu or den else '') + 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse'
        if m.get('soan'): trim = 'anull'                                          # composed to the picture: keep its exact timing
        if lp: trim = f'atrim={tu:.3f}:{den:.3f},asetpts=PTS-STARTPTS'
        for r in range(reps): fc += f'[{mi + r}]{trim}[m{r}];'
        chain = '' if reps == 1 else f'[m0][m1]acrossfade=d={xf}[x1];'
        for r in range(2, reps): chain += f'[x{r - 1}][m{r}]acrossfade=d={xf}[x{r}];'
        last = '[m0]' if reps == 1 else f'[x{reps - 1}]'
        if reps > 1: fc += chain
        fc += f"{last}atrim=0:{D},aformat=sample_rates=48000:channel_layouts=stereo,volume={m.get('am_luong', .6)},afade=t=in:d=1.5,afade=t=out:st={max(D - 4, 0)}:d=4[mu];"
        if m.get('tu_ha', True): fc += f"[vo]asplit=2[v][sc];[mu][sc]sidechaincompress=threshold=0.04:ratio={float(m['tu_ha']) if not isinstance(m.get('tu_ha', True), bool) else 2.5}:attack=40:release=600[md];[v][md]amix=inputs=2:normalize=0:duration=first[o0]"
        else: fc += '[vo][mu]amix=inputs=2:normalize=0:duration=first[o0]'
    else: fc += '[vo]anull[o0]'
    # synthesized sound-effect layer (whoosh / boom / riser / tick / ambience) — tools/sfx.py
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import sfx
    book = json.load(open('giay_phep.json', encoding='utf-8')) if os.path.exists('giay_phep.json') else {}
    nfx = sfx.build_track(find_root('.'), s, tl, book)
    if nfx: fi = len([x for x in ins if x == '-i']); ins += ['-i', 'build/sfx.wav']; fc += f';[{fi}]aformat=sample_rates=48000:channel_layouts=stereo[fx];[o0][fx]amix=inputs=2:normalize=0:duration=first[o]'
    else: fc += ';[o0]anull[o]'
    run(['ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex', fc, '-map', '[o]', '-ar', '48000', 'build/mix_tho.wav'])
    if n_giong: run(['ffmpeg', '-v', 'error', '-y', *ins[:2 * n_giong], '-filter_complex', fc_giong.rstrip(';'), '-map', '[vo]', '-ar', '48000', 'build/giong.wav'])
    # normalize loudness for social media (2-pass loudnorm: measure, then adjust linearly, no distortion)
    tgt = s.get('do_to', -14); flt = f'loudnorm=I={tgt}:TP=-1.5:LRA=11'
    st = subprocess.run(['ffmpeg', '-i', 'build/mix_tho.wav', '-af', flt + ':print_format=json', '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace').stderr
    js = json.loads(st[st.rindex('{'):st.rindex('}') + 1])
    flt += f":measured_I={js['input_i']}:measured_TP={js['input_tp']}:measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true"
    run(['ffmpeg', '-v', 'error', '-y', '-i', 'build/mix_tho.wav', '-af', flt, '-ar', '48000', 'build/mix.wav'])
    log(f"build/mix.wav · {D:.1f}s · {js['input_i']} → {tgt} LUFS · {nfx} sound effects")

# ---------------------------------------------------------------- render (Playwright)
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def translate_path(self, path):
        p = path.split('?')[0].split('#')[0]
        if p.startswith('/ms/'): return os.path.join(ENGINE, *[x for x in p[4:].split('/') if x])
        if p.startswith('/root/'): return os.path.join(self.server.root, *[x for x in p[6:].split('/') if x])
        return super().translate_path(path)

def browser(page='film.html'):
    from playwright.sync_api import sync_playwright
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=os.getcwd())); srv.root = find_root('.')
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    pw = sync_playwright().start(); b = pw.chromium.launch(args=['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width': 1920, 'height': 1920})
    pg.on('console', lambda m: print('[page]', m.text) if m.type in ('error', 'warning') else None)
    errs = []; pg.on('pageerror', lambda e: (print('[page error]', e), errs.append(str(e))))
    pg.goto(f'http://127.0.0.1:{srv.server_port}/{page}'); t0 = time.time()
    while not pg.evaluate('window.READY === true'):          # stop immediately if the page errors, don't wait for the timeout
        if errs: b.close(); pw.stop(); srv.shutdown(); die(f'page error during init: {errs[0]}')
        if time.time() - t0 > 600: die('page not ready after 10 minutes')
        pg.wait_for_timeout(200)
    return pw, b, pg, srv

GRAB = "async (t)=>{await render(t);return document.getElementById('c').toDataURL('image/jpeg',0.95).split(',')[1]}"

# Hardware H.264 encoding INSIDE the browser (WebCodecs). Drawing a frame takes ~3 ms; the old path spent ~55 ms per frame
# on JPEG encoding + transfer + x264 → ~16 fps. WebCodecs on the GPU encoder runs ~50 fps with the same visual quality
# (PSNR ≈ 40 dB vs the JPEG path). Output is an Annex-B .h264 stream (SPS/PPS on every keyframe, keyframe every 2 s), so
# episodes and title cards can later be joined by plain byte concatenation — no re-encode when assembling a series.
ENC_BITRATE = 30_000_000
WC_INIT = """async ([w, h, fps, br]) => {
  const base = { codec: 'avc1.640033', width: w, height: h, bitrate: br, framerate: fps, latencyMode: 'quality', avc: { format: 'annexb' } };
  let cfg = null;
  for (const hw of ['prefer-hardware', 'prefer-software']) {
    try { const r = await VideoEncoder.isConfigSupported({ ...base, hardwareAcceleration: hw }); if (r.supported) { cfg = { ...base, hardwareAcceleration: hw }; break; } } catch (e) {} }
  if (!cfg) return null;
  window.__q = []; window.__err = null;
  window.__enc = new VideoEncoder({ output: ch => { const b = new Uint8Array(ch.byteLength); ch.copyTo(b); window.__q.push(b); }, error: e => { window.__err = String(e); } });
  window.__enc.configure(cfg); return cfg.hardwareAcceleration; }"""
WC_BATCH = """async ([a, k, fps, last]) => {
  const c = document.getElementById('c'), enc = window.__enc;
  for (let f = a; f < a + k; f++) {
    await render(f / fps);
    const fr = new VideoFrame(c, { timestamp: Math.round(f * 1e6 / fps), duration: Math.round(1e6 / fps) });
    enc.encode(fr, { keyFrame: f % (fps * 2) === 0 }); fr.close();
    while (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 1));
  }
  if (last) await enc.flush();
  if (window.__err) throw new Error(window.__err);
  const q = window.__q; window.__q = []; let n = 0; for (const b of q) n += b.length;
  const o = new Uint8Array(n); let p = 0; for (const b of q) { o.set(b, p); p += b.length; }
  let s = ''; for (let i = 0; i < o.length; i += 32768) s += String.fromCharCode.apply(null, o.subarray(i, i + 32768));
  return btoa(s); }"""

def encode_frames(pg, n, fps, out_mp4, audio=None, audio_br='192k', grab=None, progress=None):
    """Render frames 0..n-1 of the open page and write out_mp4 (+ sidecar .h264 for lossless joining).
    Uses in-browser hardware H.264 when available, else falls back to JPEG frames → x264."""
    w, h = pg.evaluate("() => { const c = document.getElementById('c'); return [c.width, c.height]; }")
    mode = pg.evaluate(WC_INIT, [w, h, fps, ENC_BITRATE]) if os.environ.get('MS_ENCODER') != 'x264' else None
    t0 = time.time(); side = os.path.splitext(out_mp4)[0] + '.h264'
    if mode:
        with open(side, 'wb') as fh:
            B = fps
            for a0 in range(0, n, B):
                k = min(B, n - a0); fh.write(base64.b64decode(pg.evaluate(WC_BATCH, [a0, k, fps, a0 + k >= n])))
                if progress and a0 % (fps * 10) == 0: progress(a0, n, time.time() - t0)
        aud = ['-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', audio_br] if audio else []
        # NOTE: never use -shortest with a raw .h264 input (no timestamps → ffmpeg silently drops the audio); cut with -t instead
        run(['ffmpeg', '-v', 'error', '-y', '-r', str(fps), '-f', 'h264', '-i', side, *aud, '-c:v', 'copy', '-t', f'{n / fps:.3f}', '-movflags', '+faststart', out_mp4])
        return f'webcodecs-{mode}', time.time() - t0
    if os.path.exists(side): os.remove(side)                                      # stale sidecar must not be joined later
    cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'image2pipe', '-framerate', str(fps), '-c:v', 'mjpeg', '-i', '-']
    if audio: cmd += ['-i', audio, '-c:a', 'aac', '-b:a', audio_br, '-shortest']
    ff = subprocess.Popen(cmd + ['-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', str(fps), out_mp4], stdin=subprocess.PIPE)
    for f in range(n):
        ff.stdin.write(base64.b64decode(pg.evaluate(grab or GRAB, f / fps)))
        if progress and f % (fps * 10) == 0: progress(f, n, time.time() - t0)
    ff.stdin.close(); ff.wait(); return 'jpeg-x264', time.time() - t0
def cmd_thu(a):
    tl = json.load(open('build/timeline.json', encoding='utf-8'))
    ts = [float(x) for x in a.t.split(',')] if a.t else [round(min(sc['t0'] + (sc['t1'] - sc['t0']) * .55, tl['dur'] - .05), 2) for sc in tl['scenes']]
    pw, b, pg, srv = browser(a.trang); shutil.rmtree('build/thu', ignore_errors=True); os.makedirs('build/thu')
    log('GPU:', pg.evaluate('window.GPU'))
    for k, t in enumerate(ts): open(f'build/thu/{k:03d}.jpg', 'wb').write(base64.b64decode(pg.evaluate(GRAB, t)))
    b.close(); pw.stop(); srv.shutdown()
    cols = min(len(ts), 7 if tl['format'] == '9x16' else 4); rows = (len(ts) + cols - 1) // cols; w = 270 if tl['format'] == '9x16' else 480
    run(['ffmpeg', '-v', 'error', '-y', '-i', 'build/thu/%03d.jpg', '-vf', f'scale={w}:-1,tile={cols}x{rows}', '-frames:v', '1', 'build/thu.jpg'])
    log(f'{len(ts)} frames → build/thu.jpg ({", ".join(map(str, ts))})')

def _engine_sig():
    """size+mtime of every engine file (core, backends, fonts loader) — any engine change invalidates the scene cache."""
    h = hashlib.sha1()
    for dp, _, fs in os.walk(ENGINE):
        if 'node_modules' in dp: continue
        for f in sorted(fs):
            if f.endswith(('.js', '.html', '.json', '.glsl')): st = os.stat(os.path.join(dp, f)); h.update(f'{f}{st.st_size}{st.st_mtime_ns}'.encode())
    return h.hexdigest()

def _scene_keys(tl, fps, page):
    """One cache key per scene = everything its frames depend on: the scene's own data/duration/subtitles/assets, the
    PREVIOUS scene (its tail is drawn during this scene's incoming transition), film.html, the engine, style, format.
    The scene start time is ignored (frames use local time) unless the video has a running timeline/depth bar (nam / do_sau)."""
    S = tl['scenes']; glob_t = any((s.get('data') or {}).get(k) is not None for s in S for k in ('nam', 'do_sau'))
    book = json.load(open('giay_phep.json', encoding='utf-8')) if os.path.exists('giay_phep.json') else {}
    common = hashlib.sha1((open(page, 'rb').read().hex() + _engine_sig() + json.dumps([tl.get('style'), tl.get('format'), tl.get('lang'), fps], sort_keys=True, ensure_ascii=False)).encode()).hexdigest()
    def asset(sid):
        m = [book.get(k) for k in book if k == sid or k.startswith(sid + '~')]; out = [m]
        for d in (f'build/layers/{sid}', f'build/layers_hf/{sid}'):            # footage frames + HyperFrames frames
            fl = sorted(os.listdir(d)) if os.path.isdir(d) else []
            out += [len(fl), max((os.path.getmtime(os.path.join(d, f)) for f in fl), default=0)]
        return out
    keys = []
    for i, sc in enumerate(S):
        f0, f1 = round(sc['t0'] * fps), (round(S[i + 1]['t0'] * fps) if i + 1 < len(S) else int(tl['dur'] * fps))
        subs = [[x['s'], round(x['t0'] - sc['t0'], 3), round(x['t1'] - sc['t0'], 3), [[w[0], round(w[1] - sc['t0'], 3), round(w[2] - sc['t0'], 3)] + w[3:] for w in x.get('w') or []]]
                for x in tl.get('subs') or [] if x['t1'] > sc['t0'] and x['t0'] < sc['t1']]
        prev = S[i - 1] if i else None
        k = json.dumps([common, sc['id'], sc.get('data'), f1 - f0, subs, asset(sc['id']), (sc.get('voice') or {}).get('t0', sc['t0']) - sc['t0'],
                        [prev['id'], prev.get('data'), round(prev['t1'] - prev['t0'], 3), asset(prev['id'])] if prev else None,
                        sc['t0'] if glob_t else None, tl['dur'] if i == len(S) - 1 else None], sort_keys=True, ensure_ascii=False, default=str)
        keys.append((i, sc['id'], f0, f1, hashlib.sha1(k.encode()).hexdigest()[:12]))
    return keys

TEXT_HOOK = """() => { if (window.__txtHook) return; window.__txtHook = true; window.__txt = [];
  const W = document.getElementById('c').width, H = document.getElementById('c').height;
  for (const fn of ['fillText', 'strokeText']) { const orig = CanvasRenderingContext2D.prototype[fn];
    CanvasRenderingContext2D.prototype[fn] = function (s, x, y, ...r) {
      try { if (this.canvas.width === W && this.canvas.height === H && this.globalAlpha > .15 && String(s).trim()) {
        const m = this.measureText(s), w = r[0] ? Math.min(m.width, r[0]) : m.width, al = this.textAlign, T = this.getTransform();
        let x0 = al === 'center' ? x - w / 2 : (al === 'right' || al === 'end') ? x - w : x; const X0 = T.a * x0 + T.c * y + T.e, X1 = T.a * (x0 + w) + T.c * y + T.e;
        if (X0 < -2 || X1 > W + 2) window.__txt.push([String(s).slice(0, 60), Math.round(X0), Math.round(X1)]);
        if (window.__all) window.__all.push([String(s).trim().slice(0, 160), Math.round(T.b * x0 + T.d * y + T.f)]); } } catch (e) {}
      return orig.call(this, s, x, y, ...r); }; } }"""

# frame statistics of the film canvas right after render(t): mean luma, contrast and a 16×16 luma grid (for "is anything there / is it moving")
FRAME_STATS = """async (t) => { await render(t); const c = document.getElementById('c'), k = document.createElement('canvas'); k.width = k.height = 16;
  const x = k.getContext('2d'); x.drawImage(c, 0, 0, 16, 16); const d = x.getImageData(0, 0, 16, 16).data, g = [];
  for (let i = 0; i < d.length; i += 4) g.push((0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255);
  const m = g.reduce((a, b) => a + b, 0) / g.length, sd = Math.sqrt(g.reduce((a, b) => a + (b - m) ** 2, 0) / g.length);
  return { m, sd, g, jpg: c.toDataURL('image/jpeg', .8) }; }"""

READ_RATE = {'vi': 3.2, 'en': 3.0, 'zh': 6.0, 'ja': 6.0, 'th': 5.0}   # words (or CJK/Thai characters) a viewer reads per second on screen

def soat_mo_dau(pg, s, tl):
    """The first 3 seconds (idea from chaojifeng-video-design "前三秒"): a scroller decides in ~3 s. Checks: the first spoken
    word starts at once, the first sentence lands inside ~3 s, frame 0 is not empty/black, something is written on screen
    by 1 s, and the picture changes in the first 3 s. Saves build/soat/mo_dau_<t>.jpg to look at."""
    bad, info = [], {}
    v = [sc['voice']['t0'] for sc in tl['scenes'] if sc.get('voice')]          # voice.t0 is absolute (timeline seconds)
    if v:
        info['giong_bat_dau'] = round(min(v), 2)
        if min(v) > .6: bad.append(('0–3s', 'opening', f'voice starts at {min(v):.1f}s — the first 3 seconds are when viewers decide to scroll; start the hook line at once (≤ 0.5 s), cut `dem`/leading silence'))
    subs = tl.get('subs') or []
    if subs:
        end = next((x['t1'] for x in subs if re.search(r'[.?!…。？！]["»”)]*$', x['s'].strip())), None) or subs[0]['t1']
        info['cau_dau_xong'] = round(end, 2)
        if end > 3.5: bad.append(('0–3s', 'opening', f'the first sentence ends at {end:.1f}s — the hook should land within ~3 s (split the first sentence, put the curious part first)'))
    os.makedirs('build/soat', exist_ok=True); fr = {}; T0 = .2                  # .2 s: after the template's short fade-in from black (fadeIn .12)
    for t in (T0, 1.0, 3.0):
        if t >= tl['dur']: continue
        pg.evaluate('() => { window.__all = []; }'); r = pg.evaluate(FRAME_STATS, t); r['txt'] = pg.evaluate('() => window.__all'); pg.evaluate('() => { window.__all = null; }')
        open(f'build/soat/mo_dau_{t:.0f}s.jpg', 'wb').write(base64.b64decode(r.pop('jpg').split(',', 1)[1])); fr[t] = r
    if T0 in fr and (fr[T0]['m'] < .04 or fr[T0]['sd'] < .02): bad.append(('0–3s', 'opening', f"the first frame is almost empty/dark (brightness {fr[T0]['m']:.0%}, contrast {fr[T0]['sd']:.2f}) — open on a picture with a subject, not on black"))
    if fr and not any(x['txt'] for t, x in fr.items() if t <= 1.0): bad.append(('0–3s', 'opening', 'no text on screen in the first second — add `chu` (a hook title) to the first scene'))
    if T0 in fr and 3.0 in fr:
        d = sum(abs(a_ - b_) for a_, b_ in zip(fr[T0]['g'], fr[3.0]['g'])) / len(fr[T0]['g']); info['doi_hinh_3s'] = round(d, 3)
        if d < .015: bad.append(('0–3s', 'opening', 'the picture at 0 s and at 3 s is almost identical — the first 3 seconds need clear motion or a cut'))
    return bad, info

def soat_doc_chu(pg, s, tl):
    """Reading windows (idea from chaojifeng-video-design explainer_timing_audit, but measured on the real page): every
    on-screen text that is NOT the karaoke subtitle (titles, labels, graphics, quotes) must stay up long enough to read:
    ≥ 0.6 s + words / READ_RATE. Samples render(t) every 0.25 s (0.5 s for videos > 2 min)."""
    lang = s.get('ngon_ngu', 'vi'); rate = READ_RATE.get(lang, 3.0); step = .25 if tl['dur'] <= 120 else .5
    subs = tl.get('subs') or []; cjk = lang in ('zh', 'ja', 'th')
    nsub = lambda t: ' '.join(norm(x['s']) for x in subs if x['t0'] - .4 <= t <= x['t1'] + .4)
    seen = {}                                                                    # text → [[first t, last t], …] (one entry per appearance)
    t = 0.0
    while t < tl['dur']:
        pg.evaluate('() => { window.__all = []; }'); pg.evaluate('async (t) => { await render(t); }', t)
        sub = nsub(t)
        for n in {norm(txt) for txt, _ in pg.evaluate('() => window.__all')}:
            if len(n) < 3 or sum(ch.isdigit() for ch in n) >= len(n.replace(' ', '')) * .5: continue   # counters / years animate on purpose
            if n in sub: continue                                                # the karaoke subtitle (read along with the voice)
            iv = seen.setdefault(n, [])
            if iv and t - iv[-1][1] <= step * 1.5: iv[-1][1] = t
            else: iv.append([t, t])
        t = round(t + step, 3)
    pg.evaluate('() => { window.__all = null; }')
    rows = sorted([[n, a_, b_] for n, iv in seen.items() for a_, b_ in iv], key=lambda r: (-len(r[0]), r[1]))
    for r in list(rows):                                                         # typewriter / word-by-word reveal: a prefix shown just before the full text is that text
        full = next((q for q in rows if q is not r and len(q[0]) > len(r[0]) and q[0].startswith(r[0]) and r[1] <= q[1] <= r[2] + step * 1.5), None)
        if full: full[1] = min(full[1], r[1]); rows.remove(r)
    bad = []
    for n, t0, t1 in sorted(rows, key=lambda r: r[1]):
        words = len(n.replace(' ', '')) if cjk else len(n.split())
        if words < 3 or t1 + step >= tl['dur'] - .05: continue                  # short labels read at a glance; text held to the very end is fine
        shown, need = t1 - t0 + step, .6 + words / rate
        if shown < need * .8: bad.append((f'{t0:.1f}s', f'text «{n[:70]}» is shown only ~{shown:.1f}s, needs ~{need:.1f}s to read ({words} words) — hold it longer (`chu_giu`, `luc`) or shorten it'))
    return bad[:12], len(rows)

def cmd_soat(a):
    """xp review — review BEFORE rendering (cheap, minutes saved on long videos):
    1. voice: words of `loi` missing from the listen-back (dropped words / garbled names), per scene;
    2. subtitles: `phu_de` that says something different from what is spoken;
    3. on-screen text: every title/quote/subtitle drawn past the left/right edge of the frame (measured in the browser at
       the middle of every subtitle cue and 1.5 s into every scene);
    4. the first 3 seconds: voice starts at once, first sentence lands in ~3 s, frame 0 not empty, text by 1 s, picture moves;
    5. reading time: titles/labels/graphics text (not the karaoke subtitle) held long enough to read (--skip-read to skip).
    Fix what it lists (xp narrate --redo <id>, edit phu_de/chu), then render — only changed scenes re-render."""
    s = load_spec(); tl = json.load(open('build/timeline.json', encoding='utf-8')); lang = s['ngon_ngu']; bad = []
    gk = {x['id']: x for x in (json.load(open('build/giong_kiemtra.json', encoding='utf-8')) if os.path.exists('build/giong_kiemtra.json') else [])}
    for c in s['canh']:
        if not c.get('loi'): continue
        k = gk.get(c['id']) or {}; tx = k.get('nghe_lai')
        if tx is None: bad.append((c['id'], 'voice', 'not listened back yet — run xp narrate')); continue
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import doc_so
        noi, txc = doc_so.doc(c['loi'], lang, s.get('giong')), doc_so.ve_chu(tx, lang, s.get('giong'))   # compare spoken words with the listen-back, numbers spelled out on both sides
        def lost(ref):                                                          # runs of ≥2 words of `ref` with nothing heard in their place
            aw, bw = norm(ref).split(), norm(txc).split(); out = []
            for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, aw, bw, autojunk=False).get_opcodes():
                if op == 'delete' and i2 - i1 >= 2 or op == 'replace' and i2 - i1 >= 3 and (j2 - j1) <= (i2 - i1) / 2: out.append(' '.join(aw[i1:i2]))
            return out
        miss = lost(noi) + [f'number «{r}»' for r in doc_so.so_sai(noi, tx, lang, s.get('giong'))]
        if miss: bad.append((c['id'], 'voice', 'may have lost words: «' + '» · «'.join(miss[:3]) + f"» (match {k.get('giong_nhau', 0):.0%})"))
        if c.get('phu_de'):
            pd = re.sub(r'\*\*|\|', ' ', str(c['phu_de'])); sim = similarity(c['loi'], pd, lang)
            if sim < .65: bad.append((c['id'], 'subtitle', f'subtitle differs from the spoken line ({sim:.0%} similar) — viewers would read one thing and hear another'))
    ts = sorted({round((x['t0'] + x['t1']) / 2, 2) for x in tl.get('subs') or []} | {round(min(sc['t0'] + 1.5, (sc['t0'] + sc['t1']) / 2), 2) for sc in tl['scenes']})
    pw, b, pg, srv = browser(getattr(a, 'trang', 'film.html')); pg.evaluate(TEXT_HOOK); over = {}
    for t in ts:
        pg.evaluate('() => { window.__txt = []; }'); pg.evaluate('async (t) => { await render(t); }', t)
        for txt, x0, x1 in pg.evaluate('() => window.__txt'):
            sc = next(x['id'] for x in reversed(tl['scenes']) if t >= x['t0']); over.setdefault((sc, txt), (t, x0, x1))
    hook, hook_info = soat_mo_dau(pg, s, tl); bad += hook                       # 4. the first 3 seconds
    n_doc = 0
    if not getattr(a, 'skip_read', False):                                       # 5. reading windows of on-screen text
        rd, n_doc = soat_doc_chu(pg, s, tl); bad += [(at, 'reading time', msg) for at, msg in rd]
    b.close(); pw.stop(); srv.shutdown()
    for (sc, txt), (t, x0, x1) in over.items(): bad.append((sc, 'text overflow', f'«{txt}» at {t:.1f}s drawn from x={x0} to {x1} (frame {FORMATS[s["khung"]][0]}px) — shorten it or wrap the line'))
    os.makedirs('build/soat', exist_ok=True)
    L = ['# Review before render', '', f'{len(ts)} text moments · {len([c for c in s["canh"] if c.get("loi")])} spoken lines · {n_doc} on-screen texts timed for reading', '',
         f"First 3 seconds: voice starts at {hook_info.get('giong_bat_dau', '?')}s · first sentence ends at {hook_info.get('cau_dau_xong', '?')}s · frames build/soat/mo_dau_0s.jpg, mo_dau_1s.jpg, mo_dau_3s.jpg", '']
    L += [f'- **{sid}** · {kind}: {msg}' for sid, kind, msg in bad] or ['✓ no voice / subtitle / text-overflow / opening / reading-time problems found']
    json.dump({'mo_dau': hook_info, 'viec': [{'cho': sid, 'loai': kind, 'loi': msg} for sid, kind, msg in bad]}, open('build/soat/bao_cao.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open('build/soat/bao_cao.md', 'w', encoding='utf-8').write('\n'.join(L) + '\n')
    for sid, kind, msg in bad: log(f'⚠ {sid} · {kind}: {msg}')
    log(f'review: {len(ts)} text moments · {len(bad)} to fix' + ('' if bad else ' ✓') + ' · build/soat/bao_cao.md')

def cmd_render(a):
    """Render per SCENE into build/doan/ (H.264 segments, each starting on a keyframe) and join them without re-encoding.
    A scene whose inputs did not change is reused, so fixing one line/scene re-renders only that scene (+ the next one,
    whose incoming transition shows it). --full: old single-pass render; --scene id…: force those scenes."""
    tl = json.load(open('build/timeline.json', encoding='utf-8')); fps = a.fps; n = int(tl['dur'] * fps)
    aud = 'build/mix.wav' if os.path.exists('build/mix.wav') else None
    keys = _scene_keys(tl, fps, a.trang) if not getattr(a, 'full', False) else []
    os.makedirs('build/doan', exist_ok=True); seg = lambda i, sid, key: f'build/doan/{i:03d}_{sid}_{key}.h264'
    todo = [k for k in keys if not os.path.exists(seg(k[0], k[1], k[4])) or k[1] in (getattr(a, 'scene', None) or [])]
    if keys and not todo and os.path.exists('build/raw.mp4') and all(os.path.getmtime(seg(k[0], k[1], k[4])) <= os.path.getmtime('build/raw.mp4') for k in keys) and (not aud or os.path.getmtime(aud) <= os.path.getmtime('build/raw.mp4')):
        log('build/raw.mp4 · all scenes unchanged — not re-rendering'); return
    pw, b, pg, srv = browser(a.trang); log('GPU:', pg.evaluate('window.GPU'), f'· {n} frames')
    w, h = pg.evaluate("() => { const c = document.getElementById('c'); return [c.width, c.height]; }")
    wc = keys and os.environ.get('MS_ENCODER') != 'x264' and pg.evaluate(WC_INIT, [w, h, fps, ENC_BITRATE])
    if not wc:                                                                   # no WebCodecs (or --full): single pass as before
        mode, dt = encode_frames(pg, n, fps, 'build/raw.mp4', aud, progress=lambda f, n, s: log(f'{f}/{n} · {s:.0f}s'))
        b.close(); pw.stop(); srv.shutdown(); log(f'build/raw.mp4 · {dt:.0f}s · {n / max(dt, .01):.0f} fps · {mode}'); return
    t0 = time.time(); nf = sum(k[3] - k[2] for k in todo)
    log(f"render {len(todo)}/{len(keys)} scenes · {nf}/{n} frames" + (f" (reusing {len(keys) - len(todo)} unchanged scenes)" if len(todo) < len(keys) else ''))
    for j, (i, sid, f0, f1, key) in enumerate(todo):
        if j: pg.evaluate(WC_INIT, [w, h, fps, ENC_BITRATE])                    # fresh encoder → the segment starts with a keyframe (clean join)
        with open(seg(i, sid, key) + '.tmp', 'wb') as fh:
            for a0 in range(f0, f1, fps): k_ = min(fps, f1 - a0); fh.write(base64.b64decode(pg.evaluate(WC_BATCH, [a0, k_, fps, a0 + k_ >= f1])))
        os.replace(seg(i, sid, key) + '.tmp', seg(i, sid, key)); log(f'  {sid}: {f1 - f0} frames · {time.time() - t0:.0f}s')
    b.close(); pw.stop(); srv.shutdown()
    keep = {os.path.basename(seg(i, sid, key)) for i, sid, _, _, key in keys}
    for f in os.listdir('build/doan'):
        if f not in keep: os.remove(os.path.join('build/doan', f))              # old versions of changed scenes
    with open('build/raw.h264', 'wb') as fo:
        for i, sid, _, _, key in keys: fo.write(open(seg(i, sid, key), 'rb').read())
    am = ['-i', aud, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '192k'] if aud else []
    run(['ffmpeg', '-v', 'error', '-y', '-r', str(fps), '-f', 'h264', '-i', 'build/raw.h264', *am, '-c:v', 'copy', '-t', f'{n / fps:.3f}', '-movflags', '+faststart', 'build/raw.mp4'])
    dt = time.time() - t0; log(f'build/raw.mp4 · {dt:.0f}s · {nf / max(dt, .01):.0f} fps · webcodecs-{wc} · joined {len(keys)} segments')

def cmd_xuat(a):
    """Two files: <name>_<format>.mp4 in high quality for PUBLISHING (CRF 17, ~10–16 Mbps, no size limit — TikTok/Reels re-compress,
    the cleaner the source the fewer blocking artefacts) + <name>_<format>_xem_thu.mp4 under the size limit (MB) to send to a phone."""
    s = load_spec(); os.makedirs('out', exist_ok=True); name = s.get('ten', os.path.basename(os.getcwd()))
    out = f"out/{name}_{s['khung']}.mp4"; pv = f"out/{name}_{s['khung']}_xem_thu.mp4"
    aud = ['-i', 'build/mix.wav', '-map', '0:v', '-map', '1:a', '-shortest'] if os.path.exists('build/mix.wav') else []
    if os.path.exists('build/raw.h264') and os.path.getmtime('build/raw.h264') >= os.path.getmtime('build/raw.mp4') - 120:   # rendered with WebCodecs
        run(['ffmpeg', '-v', 'error', '-y', '-i', 'build/raw.mp4', *aud, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', out])
    else:
        run(['ffmpeg', '-v', 'error', '-y', '-i', 'build/raw.mp4', *aud, '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-maxrate', '16M', '-bufsize', '24M',
             '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-g', '60', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', out])
    log(f'{out} · {os.path.getsize(out) / 1048576:.1f} MB · publish version (high quality)')
    lim = a.gioi_han * 1024 * 1024
    if os.path.getsize(out) <= lim: shutil.copy(out, pv)
    else:
        D = dur_of(out); kbps = int(lim * 8 * .94 / D / 1000) - 160
        run(['ffmpeg', '-v', 'error', '-y', '-i', 'build/raw.mp4', *aud, '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', f'{kbps}k', '-maxrate', f'{int(kbps * 1.4)}k', '-bufsize', f'{kbps * 2}k',
             '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', pv])
    log(f'{pv} · {os.path.getsize(pv) / 1048576:.1f} MB · phone preview version')
    phu_de()
    cmd_dangbai(a)

def phu_de(langs=None):
    """YouTube subtitles: SRT in the source language + English (always) — see tools/subtitles.py. Never breaks the export step."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import subtitles
    try: return subtitles.run('.', langs, log=lambda m: log(m))
    except (Exception, SystemExit) as e: log(f'⚠ subtitles: {e}')

def cmd_dangbai(a):
    """Publishing package (title, description, tags, hashtags, TikTok/Reels caption, credits) — see tools/dangbai.py."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import dangbai
    dangbai.build(sys.modules[__name__])

# ---------------------------------------------------------------- quality check
def frame_stats(path, w, h, step=1.0):
    sw, sh = 48, int(48 * h / w)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'fps={1 / step},scale={sw}:{sh},format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    n = sw * sh; frames = [raw[i:i + n] for i in range(0, len(raw) - n + 1, n)]; out = []
    for fr in frames: mean = sum(fr) / n; out.append({'sang': round(mean / 255, 3), 'chay': round(sum(1 for v in fr if v > 250) / n, 3), 'den': round(sum(1 for v in fr if v < 6) / n, 3), 'fr': fr})
    return out

def cmd_kichban(a):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kichban
    R = kichban.cham(load_spec()); os.makedirs('build', exist_ok=True); json.dump(R, open('build/kichban.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    log(f"script: {R.get('diem')}/10 · ~{R.get('thoi_luong_uoc')}s · voice coverage {R.get('giong_phu', 0):.0%} · {R.get('so_canh')} scenes · depth {R.get('ty_le_sau', 0):.0%} · {R.get('tin_moi_10s')} ideas/10s · {R.get('moc_giu_chan')} hooks")
    for w in R['canh_bao']: log('⚠', w)
    if not R['canh_bao']: log('✓ script passes')

DUYET_6 = [   # the director's six questions (adapted from chaojifeng-video-design review-and-revision.md) — each judged separately
    ('Sound', 'Voice is clear, music/SFX never cover it, sound effects land on the right moment, start and end feel natural (no clipped words).', 'LISTEN to the whole video with ears/headphones — not just the LUFS number or the match %'),
    ('Picture', 'Subject is clear, text is readable (no overflow, not covered, enough contrast), no black/burnt/jumpy frames at cuts.', 'look at the first frame, the busiest-text frame, the middle of every transition and the last frame'),
    ('Look', 'Fonts, colours, materials, lighting and motion style match the chosen style (`phong_cach`) and the channel.', 'write a concrete reason, not just "nice/ugly"'),
    ('Pacing', 'There is build → push → hit → rest; text stays up long enough to read; fast or loud is not the same as rhythm.', 'watch it in one go without skipping'),
    ('Story', 'The first 3 seconds hook; every scene adds new information or feeling; there is a turn / a "why"; the ending lands.', 'retell the video in 2 sentences — if you cannot, the thread is loose'),
    ('Accuracy', 'Numbers, names and years match the sources (`nghien_cuu.md`); graphics have correct proportions/meaning; effects serve the content and never hide the evidence.', 'check every number on screen against its source'),
]

def duyet_phim(vid, D, tl, R):
    """build/duyet_phim.md — the review sheet the INDEPENDENT reviewer fills after `xp check`: six dimensions scored
    separately with what was actually watched/heard as evidence. Automatic warnings are listed as hints, never as a pass."""
    sc = json.load(open('build/soat/bao_cao.json', encoding='utf-8')) if os.path.exists('build/soat/bao_cao.json') else None
    cuts = [round(x['t0'], 1) for x in tl['scenes'][1:]]
    L = ['# Film review — the director\'s 6 questions', '', f'Video: `{vid}` · {D:.1f}s · {len(tl["scenes"])} scenes', '',
         'The reviewer is NOT the person who made the video. Score every item separately /10 and write **which part you watched/heard** as evidence.',
         'An item not really watched/heard is marked `not reviewed` — it never counts as a pass. Pass = every item ≥ 7 and average ≥ 8.', '',
         '## Automatic hints (only to show where to look — they do not replace watching/listening)', '']
    L += [f'- ⚠ {w}' for w in R['canh_bao']] or ['- ✓ `xp check` has no warnings']
    if sc:
        md = sc.get('mo_dau') or {}
        L += [f"- First 3 seconds: voice starts {md.get('giong_bat_dau', '?')}s · first sentence ends {md.get('cau_dau_xong', '?')}s (frames `build/soat/mo_dau_*.jpg`)"]
        L += [f"- ⚠ pre-render review · {x['cho']} · {x['loai']}: {x['loi']}" for x in sc.get('viec') or []]
    else: L += ['- (`xp review` has not been run — no first-3-seconds / reading-time measurements)']
    L += ['', f"Moments to watch closely: 0–3s · scene cuts {cuts[:12]}{' …' if len(cuts) > 12 else ''} · {max(0, D - 3):.1f}s–end", '',
          '## Scores', '', '| # | Item | Score /10 | Watched/heard (evidence) | Problem (time) | Fix |', '|---|---|---|---|---|---|']
    L += [f'| {i} | **{n}** | | | | |' for i, (n, _, _) in enumerate(DUYET_6, 1)]
    L += ['', '### What each item checks', '']
    L += [f'{i}. **{n}** — {q} *How to review: {how}.*' for i, (n, q, how) in enumerate(DUYET_6, 1)]
    L += ['', '## Verdict', '', '- Average: ', '- Pass / Not yet: ', '- Fixes in order (scene/id · task · command, e.g. `xp narrate --redo <id>`, `xp render --scene <id>`): ', '']
    open('build/duyet_phim.md', 'w', encoding='utf-8').write('\n'.join(L))

def cmd_kiemtra(a):
    if getattr(a, 'loai', None) == 'kichban': return cmd_kichban(a)
    s = load_spec(); tl = json.load(open('build/timeline.json', encoding='utf-8')); name = s.get('ten', os.path.basename(os.getcwd()))
    vid = f"out/{name}_{s['khung']}.mp4" if os.path.exists(f"out/{name}_{s['khung']}.mp4") else 'build/raw.mp4'
    W, H = FORMATS[s['khung']]; R = {'video': vid, 'canh_bao': []}; warn = R['canh_bao'].append
    D = dur_of(vid); R['thoi_luong'] = round(D, 2)
    if abs(D - tl['dur']) > .2: warn(f"duration {D:.1f}s differs from the timeline's {tl['dur']:.1f}s")
    R['dung_luong_mb'] = round(os.path.getsize(vid) / 1048576, 1)
    br = R['dung_luong_mb'] * 8 / D if D else 0; R['mbps'] = round(br, 1)
    if br and br < 6 and W * H >= 1920 * 1080: warn(f'bitrate {br:.1f} Mbps is low for {W}×{H} — prone to blocking when posted (aim for ≥ 8 Mbps)')
    lo = subprocess.run(['ffmpeg', '-i', vid, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace').stderr
    m = re.findall(r'I:\s+(-?[\d.]+) LUFS', lo)
    if m: R['do_to_lufs'] = float(m[-1]); (warn(f"loudness {m[-1]} LUFS (social media should be −16…−12)") if not -17 <= float(m[-1]) <= -11 else None)
    st = frame_stats(vid, W, H); dark = [i for i, f in enumerate(st) if f['sang'] < .04 and 1 < i < len(st) - 2]; burn = [i for i, f in enumerate(st) if f['chay'] > .25]
    if dark: warn(f'frames too dark at seconds {dark[:8]}')
    if burn: warn(f'blown-out frames at seconds {burn[:8]}')
    still = 0; longest = 0; at = 0
    for i in range(1, len(st)):
        d = sum(abs(x - y) for x, y in zip(st[i]['fr'], st[i - 1]['fr'])) / len(st[i]['fr']); still = still + 1 if d < .6 else 0
        if still > longest: longest, at = still, i - still
    R['dung_yen_dai_nhat_s'] = longest
    if longest >= 4: warn(f'a stretch is almost static for {longest}s (from second {at}) — unless intended, add gentle motion')
    if os.path.exists('build/giong_kiemtra.json'):
        g = json.load(open('build/giong_kiemtra.json', encoding='utf-8')); R['giong'] = [{k: v for k, v in x.items() if k != 'nghe_lai'} for x in g]
        for x in g:
            if x.get('giong_nhau', 1) < .7: warn(f"voice in scene {x['id']} matches only {x['giong_nhau']:.0%} — listen again")
            if x.get('chen_dau'): warn(f"voice in scene {x['id']} may have a stray word inserted at the start")
    # viewer retention: long stills, text on the first frame, sound in the first second, voice covering enough of the duration
    book = json.load(open('giay_phep.json', encoding='utf-8')) if os.path.exists('giay_phep.json') else {}; segs = []
    for sc in tl['scenes']:
        b = book.get(sc['id'], {}); Ds = sc['t1'] - sc['t0']; cuts = [0] + list(b.get('cat') or []) + [Ds]
        if not b or b.get('loai') == 'huashu': continue                          # huashu / 3D / canvas scenes animate themselves (stillness is measured from the frames above)
        lim = 6.5 if b.get('lop') or (sc.get('data') or {}).get('do_hoa') else 4.0     # 2.5D images / animated graphics: motion is built in
        if b.get('shots'):                                                      # multiple camera angles: split the same way as MS.shots (image > 6.5 s → 2–4 angles)
            sh = b['shots']; cuts = sorted({0, Ds, *[x for x in (b.get('cat') or []) if x < Ds]})
            for i, s_ in enumerate(sh):
                end = Ds if i == len(sh) - 1 else min(Ds, s_['t1']); L = end - s_['t0']
                if s_['k'] == 'a' and L > 0: n = min(4, max(2, math.ceil(L / 6))) if L > 6.5 else 1; cuts += [s_['t0'] + j * L / n for j in range(n)]
            cuts = sorted(set(round(x, 2) for x in cuts if 0 <= x <= Ds))
            lim = 6.5 if any(s_['k'] == 'a' for s_ in sh) or (sc.get('data') or {}).get('do_hoa') else 5.0   # video clips move by nature: ≤ 5 s
        for u, v in zip(cuts, cuts[1:]):
            if v - u > lim: segs.append(f"{sc['id']} {v - u:.1f}s")
    if segs: warn('scenes stuck on one image too long (should be ≤ 3–4 s, add clips): ' + ', '.join(segs[:6]))
    d0 = (tl['scenes'][0].get('data') or {}) if tl['scenes'] else {}
    hs_title = any(c.get('kind') == 'title' and float(c.get('at', 1)) <= .1 for c in ((d0.get('huashu') or {}).get('cues') or []))   # huashu draws its own title at 0 s
    hf_title = (d0.get('hf') or {}).get('kieu') in ('tieu-de', None) and (d0.get('hf') or {}).get('dau')   # HyperFrames headline shown from frame 0
    if tl['scenes'] and not d0.get('chu') and not d0.get('mo') and not hs_title and not hf_title: warn("no text on the first frame (TikTok's auto-picked cover would be textless)")
    if os.path.exists('build/sfx.wav'):
        import wave
        with wave.open('build/sfx.wav') as w_: fr = w_.readframes(w_.getframerate())
        if max(abs(int.from_bytes(fr[i:i + 2], 'little', signed=True)) for i in range(0, len(fr), 64)) < 600: warn('no sound effect in the first second')
    vc = sum(sc['voice']['dur'] for sc in tl['scenes'] if sc.get('voice')) / max(tl['dur'], 1); R['giong_phu'] = round(vc, 2)
    if vc < .8: warn(f'voice covers only {vc:.0%} of the duration — many silences (target ≥ 85%)')
    lastv = next((sc for sc in reversed(tl['scenes']) if sc.get('voice')), None)  # the ending: guard against "cut mid-sentence" (lesson learned)
    if lastv:
        v0 = lastv['voice']['t0']; tail = D - (v0 + lastv['voice']['dur']); R['duoi_s'] = round(tail, 2)
        if tail < 1.0: warn(f'only {tail:.2f}s left after the last word — may be cut off on re-compression / when social media loops the video (aim for ≥ 1.5 s: run xp narrate to rebuild the timeline)')
        try:                                                                    # listen to the END OF THE EXPORTED FILE: is the last sentence complete?
            sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import doc_so
            wv = 'build/_duoi.wav'; run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{max(0, v0 - .2):.2f}', '-i', vid, '-vn', '-ac', '1', '-ar', '16000', wv])
            heard, _ = NgheLai.get(s['ngon_ngu']).nghe(wv)
            noi = doc_so.doc(str(next(c for c in s['canh'] if c['id'] == lastv['id'])['loi']), s['ngon_ngu'], s.get('giong'))
            nw, hw = norm(noi).split(), norm(doc_so.ve_chu(heard, s['ngon_ngu'], s.get('giong'))).split()
            R['duoi_nghe'] = heard
            if nw and hw and nw[-2:] != hw[-2:] and not set(nw[-2:]) <= set(hw[-4:]): warn(f"the last sentence may be cut off: spoken ending «{' '.join(nw[-3:])}» · heard «{' '.join(hw[-3:])}»")
            elif nw and not hw: warn('could not hear the last sentence in the exported file')
            os.remove(wv)
        except Exception as e: log(f'  (could not listen back to the ending: {e})')
    try:                                                                        # self-check ±1.5 s around every cut point (kiemcat.py, idea from video-use)
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import kiemcat
        kc = kiemcat.check(vid, tl, book); bad = [x for x in kc if x['loi']]; R['diem_cat'] = {'so': len(kc), 'loi': bad}
        for x in bad[:8]: warn(f"cut point {x['t']}s ({x['cat']}): {'; '.join(x['loi'])}")
        log(f"cut points: {len(kc)} · {len(bad)} to review · build/kiem_cat/tong.jpg")
    except Exception as e: log(f'⚠ could not run the cut-point check: {e}')
    json.dump(R, open('build/kiemtra.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    duyet_phim(vid, D, tl, R); log('6-question review sheet for an independent reviewer: build/duyet_phim.md')
    log(f"{vid} · {D:.1f}s · {R['dung_luong_mb']} MB · {R.get('do_to_lufs', '?')} LUFS")
    for w_ in R['canh_bao']: log('⚠', w_)
    if not R['canh_bao']: log('✓ no warnings')

def cmd_moi(a):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import yaml_keys
    root = find_root('.'); dst = os.path.join(root, 'videos', a.ten); a.mau = yaml_keys.TEMPLATES.get(a.mau, a.mau)   # English template names → folder
    if os.path.exists(dst): die(f'{dst} already exists')
    src = os.path.join(SKILL, 'templates', a.mau)
    if not os.path.isdir(src): die(f"no template '{a.mau}': {sorted(os.listdir(os.path.join(SKILL, 'templates')))} (English names: {', '.join(yaml_keys.TEMPLATES)})")
    shutil.copytree(src, dst)
    y = os.path.join(dst, 'video.yaml'); txt = open(y, encoding='utf-8').read().replace('__TEN__', a.ten).replace('__KHUNG__', a.khung); open(y, 'w', encoding='utf-8').write(txt)
    log(f'created {dst} from template {a.mau} · format {a.khung}')

# ---------------------------------------------------------------- assets + licence ledger
def cmd_tainguyen(a):
    """xp tainguyen polyhaven <id> [--do-phan-giai 2k]   |   xp tainguyen url <link> --ten <file> --giay-phep "..." --nguon "..." """
    root = find_root('.'); base = os.path.join(root, '.mega-shot', 'assets'); os.makedirs(base, exist_ok=True)
    book = os.path.join(base, 'giay_phep.json'); reg = json.load(open(book, encoding='utf-8')) if os.path.exists(book) else {}
    UA = {'User-Agent': 'mega-shot/1.0'}
    def fetch(url, dst):
        if os.path.exists(dst): log('already have', os.path.relpath(dst, root)); return
        os.makedirs(os.path.dirname(dst), exist_ok=True); data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=600).read(); open(dst, 'wb').write(data)
        log(f'downloaded {os.path.relpath(dst, root)} · {len(data) / 1048576:.1f} MB')
    if a.nguon_loai == 'polyhaven':
        get = lambda u: json.load(urllib.request.urlopen(urllib.request.Request(u, headers=UA)))
        info = get(f'https://api.polyhaven.com/info/{a.ma}'); files = get(f'https://api.polyhaven.com/files/{a.ma}'); res = a.do_phan_giai; d = os.path.join(base, 'polyhaven', a.ma); out = []
        kind = {0: 'hdri', 1: 'texture', 2: 'model'}[info['type']]
        if kind == 'hdri': f = files['hdri'][res]['hdr']; fetch(f['url'], os.path.join(d, f'{a.ma}_{res}.hdr')); out.append(f'{a.ma}_{res}.hdr')
        elif kind == 'texture':
            for m in ['Diffuse', 'nor_gl', 'Rough', 'AO', 'Displacement']:
                if m in files and res in files[m]: f = files[m][res]['jpg' if 'jpg' in files[m][res] else 'png']; nm = os.path.basename(f['url']); fetch(f['url'], os.path.join(d, nm)); out.append(nm)
        else:
            g = files['gltf'][res]['gltf']; fetch(g['url'], os.path.join(d, os.path.basename(g['url']))); out.append(os.path.basename(g['url']))
            for rel, inc in g.get('include', {}).items(): fetch(inc['url'], os.path.join(d, rel)); out.append(rel)
        reg[f'polyhaven/{a.ma}'] = {'loai': kind, 'ten': info['name'], 'tac_gia': list(info.get('authors', {}).keys()), 'giay_phep': 'CC0', 'nguon': f'https://polyhaven.com/a/{a.ma}', 'do_phan_giai': res, 'file': out, 'ngay': time.strftime('%Y-%m-%d')}
    else:
        if not (a.ten and a.giay_phep and a.nguon): die('downloading from a url needs --name, --license, --source')
        dst = os.path.join(base, a.ten); fetch(a.ma, dst)
        reg[a.ten.replace('\\', '/')] = {'loai': 'file', 'giay_phep': a.giay_phep, 'nguon': a.nguon, 'url': a.ma, 'ngay': time.strftime('%Y-%m-%d')}
    json.dump(reg, open(book, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    lines = ['# mega-shot asset licence ledger', '', '| Asset | Licence | Source |', '|---|---|---|'] + [f"| {k} | {v['giay_phep']} | {v['nguon']} |" for k, v in sorted(reg.items())]
    open(os.path.join(base, 'GIAY_PHEP.md'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')

# ---------------------------------------------------------------- AI characters: image prompts + image import
def cmd_loinhac(a):
    """Write loi_nhac_anh.md: consistent prompts for every character image (the user generates them with a familiar AI tool)."""
    s = load_spec(); nv = s.get('nhan_vat') or die('video.yaml is missing the nhan_vat section'); W, H = FORMATS[s['khung']]
    ar = {'9x16': '9:16 (portrait)', '16x9': '16:9 (landscape)', '1x1': '1:1 (square)'}[s['khung']]
    green = nv.get('nen') == 'xanh'
    anchor = ', '.join(x for x in [nv.get('mo_ta'), nv.get('khung_hinh'), nv.get('anh_sang'), nv.get('phong_cach')] if x)
    bg_rule = 'plain flat pure green background (#00FF00), no shadows on background' if green else ''
    tail = ', '.join(x for x in [bg_rule, nv.get('tranh', 'no text, no watermark, no logo, no extra people')] if x)
    L = [f"# Image generation prompts — {s.get('ten', '')}", '',
         f"Aspect ratio: **{ar}**, at least {W}×{H}px. Save each image under the exact file name in the `anh/` folder next to video.yaml (png/jpg/webp), then run `xp images`.", '',
         '## Keeping the character consistent',
         '1. Generate the **base** image first (prompt right below). Pick the best one and save it as `anh/goc.png`.',
         '2. For every following image: feed the base image in as a **reference image** (ChatGPT/Gemini: upload the image, then paste the prompt; Midjourney: `--cref`), keep the face unchanged and change only what is described.',
         '3. Keep the same framing (head and shoulders, eyes in the top third, looking straight ahead) so the scene transitions match.', '',
         '## Base image: `anh/goc.png`', '```', f"{anchor}, " + next((c['anh']['mo_ta'] for c in s['canh'] if (c.get('anh') or {}).get('file') == 'goc'), 'natural look, no makeup') + f", neutral studio backdrop, {tail}", '```', '']
    for c in s['canh']:
        im = c.get('anh')
        if not im or im.get('file') == 'goc': continue
        L += [f"## Scene `{c['id']}`: `anh/{im['file']}.png`", f"_{c.get('loi', '')[:110]}…_", '', '```',
              f"Same woman as the reference photo, keep her exact face and identity. {im['mo_ta']}. " + (f"Background: {im['boi_canh']}. " if im.get('boi_canh') and not green else '') + f"{anchor}, {tail}", '```', '']
    open('loi_nhac_anh.md', 'w', encoding='utf-8').write('\n'.join(L)); log(f"loi_nhac_anh.md · {sum(1 for c in s['canh'] if c.get('anh')) + 1} images to generate")

def cmd_anh(a):
    """Import images from anh/ → build/anh/<name>.png: normalize size (15% extra for Ken Burns), key out the green background if nen: xanh."""
    from PIL import Image
    import numpy as np
    s = load_spec(); nv = s.get('nhan_vat') or {}; W, H = FORMATS[s['khung']]; os.makedirs('build/anh', exist_ok=True)
    need = list(dict.fromkeys(['goc'] + [c['anh']['file'] for c in s['canh'] if c.get('anh')])); have = {os.path.splitext(f)[0]: f for f in os.listdir('anh')} if os.path.isdir('anh') else {}
    missing = [n for n in need if n not in have]
    for n in need:
        if n not in have: continue
        im = Image.open(os.path.join('anh', have[n])).convert('RGBA'); sc = max(W * 1.15 / im.width, H * 1.15 / im.height)
        if sc > 1.01: log(f'⚠ {have[n]} is small ({im.width}×{im.height}) — it will be upscaled and may look soft')
        im = im.resize((round(im.width * sc), round(im.height * sc)), Image.LANCZOS)
        if nv.get('nen') == 'xanh':
            arr = np.asarray(im).astype(np.float32); r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
            key = np.clip((g - np.maximum(r, b) - 25) / 60, 0, 1); arr[..., 3] = 255 * (1 - key)
            spill = np.maximum(g - np.maximum(r, b), 0) * (1 - key) * .8; arr[..., 1] -= spill          # remove green spill at the edges
            im = Image.fromarray(arr.clip(0, 255).astype(np.uint8), 'RGBA')
        im.save(f'build/anh/{n}.png'); log(f'build/anh/{n}.png · {im.width}×{im.height}')
    if missing: log('⚠ images still missing:', ', '.join(f'anh/{m}.png' for m in missing))
    else: log('✓ every scene has its image')

# ---------------------------------------------------------------- auto-find assets (video/images/hdri/texture)
def cmd_timtainguyen(a):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import timkiem
    s = load_spec(); W, H = FORMATS[s['khung']]
    timkiem.run(s, find_root('.'), log, die, W, H, dur_of, only=a.canh or None, fps=a.fps)
    import mau; mau.grade(s, log)                                               # colour-match the clips just extracted (mau.py) — segments already graded are skipped

HF_TOOLS = lambda root: os.path.join(root, '.mega-shot', 'tools', 'hyperframes')   # npm i hyperframes gsap world-atlas d3-geo topojson-client

def cmd_hf(a):
    """xp hf [scene…] — render scenes that have an `hf:` block with HyperFrames (HTML + GSAP, engine/hyperframes/<mau>.html)
    into RGBA PNG sequences build/layers_hf/<id>/ (drawn by templates/tin-tuc under mega-shot subtitles; cached per scene).
    hf: { mau: tin-tuc, kieu: tieu-de|ban-do|con-so|hai-phia|dong-thoi-gian|nguon, …data }. Times may be `luc: "<word>"`
    (when the narration says it); ban-do: vung [lonMin, latMin, lonMax, latMax], diem [{ten, lat, lon, nhan, mau, trai, luc}]."""
    root = find_root('.'); tools = HF_TOOLS(root); s = load_spec(); tl = json.load(open('build/timeline.json', encoding='utf-8'))
    if not os.path.exists(os.path.join(tools, 'node_modules', 'hyperframes')): die(f'HyperFrames not installed: cd {tools} && npm i hyperframes gsap world-atlas d3-geo topojson-client')
    hfdir = os.path.join(ENGINE, 'hyperframes'); fonts = os.path.join(root, '.mega-shot', 'fonts'); fps = 30
    words = [w for x in tl.get('subs') or [] for w in x.get('w') or []]
    chung = s.get('tin') or {}; done = 0
    spec_of = {c['id']: c for c in s.get('canh', [])}                             # hf data from video.yaml (the timeline copy may be stale)
    for sc in tl['scenes']:
        d = {**(sc.get('data') or {}), **spec_of.get(sc['id'], {})}; hf = d.get('hf')
        if not hf or (a.canh and sc['id'] not in a.canh): continue
        D = round(sc['t1'] - sc['t0'] + (d.get('chuyen_dai') or .45) + .1, 2)          # + incoming transition of the next scene
        def luc(x, fb):
            if isinstance(x, (int, float)): return float(x)
            w0 = norm(str(x)).split()[:1]
            for w in words:
                if w[1] >= sc['t0'] - .05 and w[1] < sc['t1'] and w0 and norm(w[0]) == w0[0]: return round(w[1] - sc['t0'], 2)
            return fb
        V = {**{k: v for k, v in chung.items()}, **{k: v for k, v in hf.items() if k not in ('mau', 'vung', 'diem')}, 'dur': D, 'nen': not d.get('tim'),
             'thu_tu': None, 'tong': None}
        dem = [x['id'] for x in tl['scenes'] if ((spec_of.get(x['id']) or {}).get('hf') or {}).get('dem', True) is not False]   # hf.dem: false = not counted (intro, sources)
        if sc['id'] in dem: V['thu_tu'], V['tong'] = dem.index(sc['id']) + 1, len(dem)   # chapter counter 01/07
        for k in ('t', 'ket_t', 'cau_hoi_t'):
            if k in V: V[k] = luc(V[k], 1.0)
        for blk in ('so', 'muc'):
            for i, it in enumerate(V.get(blk) or []):
                if 'luc' in it: it['t'] = luc(it.pop('luc'), .4 + i * 1.2)
        for side in ('trai', 'phai'):
            if isinstance(V.get(side), dict) and 'luc' in V[side]: V[side]['t'] = luc(V[side].pop('luc'), .5)
        pj = os.path.abspath(f"build/hf/{sc['id']}"); os.makedirs(os.path.join(pj, 'fonts'), exist_ok=True)
        if hf.get('vung'):                                                       # map: pre-project geometry + pins (node, no network at render)
            inp = os.path.join(pj, 'ban_do_vao.json'); outp = os.path.join(pj, 'ban_do.json')
            json.dump({'vung': hf['vung'], 'khung': list(FORMATS[s['khung']]), 'khu': hf.get('khu') or [40, 420, FORMATS[s['khung']][0] - 40, 1380], 'nuoc_chinh': hf.get('nuoc_chinh') or [], 'diem': hf.get('diem') or []}, open(inp, 'w', encoding='utf-8'), ensure_ascii=False)
            run(['node', os.path.join(hfdir, 'ban_do.mjs'), inp, outp, tools]); M = json.load(open(outp, encoding='utf-8'))
            for i, p in enumerate(M['diem']):
                if 'luc' in p: p['t'] = luc(p.pop('luc'), .6 + i * .5)
            V['map'] = M
        tpl = os.path.join(hfdir, f"{hf.get('mau', 'tin-tuc')}.html"); html = open(tpl, encoding='utf-8').read().replace('__DUR__', f'{D:g}')
        key = hashlib.sha1((html + json.dumps(V, sort_keys=True, ensure_ascii=False)).encode()).hexdigest()[:12]
        lay = os.path.abspath(f"build/layers_hf/{sc['id']}"); kf = os.path.join(lay, '.key')
        if os.path.exists(kf) and open(kf).read() == key and not a.lam_lai: log(f"{sc['id']}: hf unchanged"); continue
        open(os.path.join(pj, 'index.html'), 'w', encoding='utf-8').write(html)
        shutil.copy(os.path.join(tools, 'node_modules', 'gsap', 'dist', 'gsap.min.js'), pj)
        for f in ('BeVietnamPro-Black.ttf', 'BeVietnamPro-ExtraBold.ttf'): shutil.copy(os.path.join(fonts, f), os.path.join(pj, 'fonts', f))
        shutil.copy(os.path.join(fonts, 'Oswald[wght].ttf'), os.path.join(pj, 'fonts', 'Oswald.ttf'))
        json.dump(V, open(os.path.join(pj, 'bien.json'), 'w', encoding='utf-8'), ensure_ascii=False)
        tmp = os.path.join(pj, 'png'); shutil.rmtree(tmp, ignore_errors=True)
        t0 = time.time()
        r = subprocess.run(['npx', 'hyperframes', 'render', pj, '--format', 'png-sequence', '-o', tmp, '--fps', str(fps), '--variables-file', os.path.join(pj, 'bien.json'), '--quiet'],
                           cwd=tools, capture_output=True, text=True, encoding='utf-8', errors='replace', shell=os.name == 'nt')
        pngs = sorted(f for f in os.listdir(tmp) if f.endswith('.png')) if os.path.isdir(tmp) else []
        if r.returncode or not pngs: die(f"HyperFrames failed on scene {sc['id']}:\n{(r.stdout or '')[-800:]}\n{(r.stderr or '')[-1500:]}")
        os.makedirs(lay, exist_ok=True)
        for f in os.listdir(lay):                                                # clear old frames file by file (a shell may hold the folder open on Windows)
            if f.endswith('.png'): os.remove(os.path.join(lay, f))
        for i, f in enumerate(pngs): os.replace(os.path.join(tmp, f), os.path.join(lay, f'{i:05d}.png'))
        open(kf, 'w').write(key); done += 1; log(f"{sc['id']}: hf {hf.get('kieu')} · {len(pngs)} frames · {time.time() - t0:.0f}s")
    log(f'✓ hf: {done} scene(s) newly rendered · build/layers_hf/')

HM_REPO = lambda root: os.path.join(root, '.mega-shot', 'tham-khao', 'huashu-motion-src')   # git clone https://github.com/alchaincyf/huashu-motion (MIT)

def cmd_nhac(a=None, quiet=False):
    """xp nhac — perform the video's own score (`nhac: { soan: nhac.abc }`, ABC notation written for THIS video) with
    huashu-motion's composer on real instrument samples (.mega-shot/tools/om-samples), fitted to the scenes:
    `!mark:<scene id>!` lands on that scene's start. Output build/nhac_soan.wav (used by `xp mix` as the music bed)."""
    s = load_spec(); m = s.get('nhac') or {}; src = m.get('soan')
    if not src: die('video.yaml has no nhac.soan (the .abc score file written for this video)')
    root = find_root('.'); repo = HM_REPO(root); tl = json.load(open('build/timeline.json', encoding='utf-8'))
    if not os.path.exists(os.path.join(repo, 'cli', 'lib', 'sound.js')): die(f'huashu-motion not installed: git clone --depth 1 https://github.com/alchaincyf/huashu-motion.git "{repo}"')
    out = 'build/nhac_soan.wav'; inp = 'build/nhac_soan.json'
    spec = {'id': s.get('ten', 'video'), 'duration': round(tl['dur'], 3), 'score': open(src, encoding='utf-8').read(),
            'labels': {f"scene:{sc['id']}": round(sc['t0'], 3) for sc in tl['scenes']}, 'marks': m.get('moc') or {}, 'music': {'kit': m.get('bo_trong', 'cinematic')}}
    key = hashlib.sha1(json.dumps(spec, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:12]
    if os.path.exists(out) and os.path.exists(inp) and json.load(open(inp, encoding='utf-8')).get('key') == key: (None if quiet else log(f'{out} unchanged')); return out
    json.dump({**spec, 'key': key}, open(inp, 'w', encoding='utf-8'), ensure_ascii=False)
    env = {**os.environ, 'OM_SAMPLES': os.path.join(root, '.mega-shot', 'tools', 'om-samples')}
    r = subprocess.run(['node', os.path.join(ENGINE, 'nhac', 'soan_nhac.mjs'), inp, out, repo], capture_output=True, text=True, encoding='utf-8', errors='replace', env=env)
    if r.returncode: die('composing the score failed:\n' + (r.stderr or r.stdout)[-1500:])
    R = json.loads(r.stdout.strip().splitlines()[-1])
    log(f"{out} · {R['duration']}s · {R['lufs']} LUFS · «{R.get('title')}» · {R.get('notes')} notes · {' '.join(R.get('voices') or [])}")
    if R.get('marks'): log(f"  matched scenes: {' · '.join(R['marks'])}" + (f" · unmatched: {', '.join(R['unmatched'])}" if R.get('unmatched') else ''))
    for x in R.get('stretches') or []: log(f'  tempo {x}')
    if R.get('ends') and R['ends'] > R['duration'] + .3: log(f"⚠ the score is {R['ends']}s long, past the video's {R['duration']}s — it gets faded; remove some bars")
    return out

def cmd_clip(a):
    """xp clip <link> [--name x] [--consent "..."] [--lang vi] [--no-words] — licence-checked download + scene analysis (tools/clip.py)."""
    try: import yt_dlp, yt_dlp_ejs, cv2  # noqa: F401
    except ImportError:
        here = os.path.dirname(os.path.abspath(__file__))
        r = subprocess.run(['uv', 'run', '--quiet', '--with', 'yt-dlp[default]', '--with', 'opencv-python-headless', '--with', 'numpy', '--with', 'pillow', '--with', 'pyyaml', '--with', 'ruamel.yaml',
                            'python', os.path.join(here, 'xp.py'), *sys.argv[1:]])
        sys.exit(r.returncode)
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import clip
    clip.run(sys.modules[__name__], a.url, a.name, a.consent, a.lang, a.no_words)

def cmd_grade(a):
    """xp grade [scene…] [--force] — colour-match video shots of a footage video (+ look from `mau.kieu`), see tools/mau.py."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import mau
    mau.grade(load_spec(), log, only=a.canh or None, force=a.force)

# ---------------------------------------------------------------- Blender
def find_blender():
    import glob
    if os.environ.get('MS_BLENDER'): return os.environ['MS_BLENDER']
    c = sorted(glob.glob(os.path.join(find_root('.'), '.mega-shot', 'tools', 'blender-*', 'blender.exe')) + glob.glob(os.path.join(find_root('.'), '.mega-shot', 'tools', 'blender-*', 'blender')))
    if c: return c[-1]
    w = shutil.which('blender')
    if w: return w
    die('Blender not found — set MS_BLENDER or unpack Blender into .mega-shot/tools/')

def cmd_3d(a):
    """one 3D still from any build(ms, ctx) script (msb + msb_lib studio kit, references/blender/ guides)."""
    exe = find_blender(); script = os.path.abspath(a.script); W, H = (int(v) for v in a.size.lower().split('x'))
    out = os.path.abspath(a.out or os.path.splitext(script)[0] + '.png'); os.makedirs(os.path.dirname(out), exist_ok=True)
    cfg = {'root': find_root('.'), 'script': script, 'W': W, 'H': H, 'fps': 30, 'frames': 1, 't0': 0, 't1': 1, 'data': {}, 'out': os.path.dirname(out), 'anh': out,
           'quality': 'nhap' if a.draft else 'chuan', 'samples': a.samples}
    cp = os.path.join(os.path.dirname(out), '_3d_cfg.json'); json.dump(cfg, open(cp, 'w', encoding='utf-8'), ensure_ascii=False); t0 = time.time()
    p = subprocess.run([exe, '-b', '--python-exit-code', '1', '-P', os.path.join(ENGINE, 'backends', 'blender', 'msb.py'), '--', cp], capture_output=True, text=True, encoding='utf-8', errors='replace')
    os.remove(cp)
    if p.returncode or not os.path.exists(out): print(chr(10).join([l for l in p.stdout.splitlines() if 'Error' in l or 'Traceback' in l or 'line ' in l][-12:])); die('3D render failed')
    log(f'3D → {out} ({W}×{H}, {time.time() - t0:.0f}s)')

def cmd_blender(a):
    """xp blender <scene-id> [--draft] [--samples 96] — render an image sequence for a scene that has the `blender: canh/x.py` key."""
    tl = json.load(open('build/timeline.json', encoding='utf-8')); scs = {s['id']: s for s in tl['scenes']}
    ids = a.canh or [s['id'] for s in tl['scenes'] if (s.get('data') or {}).get('blender')]
    W, H = FORMATS[tl['format']]; exe = find_blender(); log('Blender:', exe)
    for cid in ids:
        sc = scs.get(cid) or die(f'no scene {cid}'); script = os.path.abspath(sc['data'].get('blender') or die(f'scene {cid} is missing the blender key'))
        tail = sc['data'].get('chuyen_dai', .8) + .2; D = sc['t1'] - sc['t0'] + tail; n = int(math.ceil(D * a.fps))
        scale = .5 if a.nhap else 1; out = os.path.abspath(f"build/layers/{cid}{'_nhap' if a.nhap else ''}")
        cfg = {'root': find_root('.'), 'script': script, 'W': int(W * scale), 'H': int(H * scale), 'fps': a.fps, 'frames': n, 't0': sc['t0'], 't1': sc['t1'], 'data': sc['data'],
               'out': out, 'quality': 'nhap' if a.nhap else 'chuan', 'samples': a.samples, 'force': a.lam_lai, 'from': a.tu or 0, 'only': a.chi}
        if a.chi is not None: cfg['from'] = a.chi; cfg['frames'] = a.chi + 1
        os.makedirs('build/blender', exist_ok=True); cp = os.path.abspath(f'build/blender/{cid}.json'); json.dump(cfg, open(cp, 'w', encoding='utf-8'), ensure_ascii=False)
        log(f"{cid}: {cfg['frames'] - cfg['from']} frames · {cfg['W']}×{cfg['H']} · {'EEVEE draft' if a.nhap else 'Cycles'} → {os.path.relpath(out)}")
        p = subprocess.Popen([exe, '-b', '--python-exit-code', '1', '-P', os.path.join(ENGINE, 'backends', 'blender', 'msb.py'), '--', cp], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace')
        for line in p.stdout:
            if line.startswith('[msb]') or 'Error' in line or 'Traceback' in line or line.startswith('  File'): print(line.rstrip(), flush=True)
        if p.wait(): die(f'Blender failed while rendering {cid}')

def cmd_tatca(a):
    cmd_giong(a); cmd_am(a); cmd_render(a); cmd_xuat(a); cmd_kiemtra(a)

# ---------------------------------------------------------------- command line (English names; old Vietnamese names still accepted)
LEGACY_CMD = {'moi': 'new', 'giong': 'narrate', 'tatca': 'all', 'mocthoigian': 'timeline', 'am': 'mix', 'thu': 'preview', 'xuat': 'export', 'kiemtra': 'check',
              'loat': 'series', 'anhbia': 'thumbnail', 'timtainguyen': 'assets', 'loinhac': 'prompts', 'anh': 'images', 'tainguyen': 'download', 'dangbai': 'publish', 'caidat': 'setup',
              'nhac': 'compose', 'don': 'cleanup', 'vetinh': 'satellite', 'taitao': 'restore',
              'nhanvat': 'cast-design', 've-lai': 'redraw', 'dung-dang': 'pose-editor'}
LEGACY_SUB = {'check': {'kichban': 'script'}, 'series': {'moi': 'new', 'chay': 'run', 'ghep': 'assemble'}, 'thumbnail': {'moi': 'new'}}
LEGACY_FLAG = {'--khung': '--format', '--mau': '--template', '--nhap-tu': '--import-from', '--lam-lai': '--redo', '--trang': '--page', '--gioi-han': '--limit',
               '--so-tap': '--episodes', '--tap': '--only', '--buoc': '--steps', '--cong': '--port', '--mo': '--open', '--nhap': '--draft', '--tu': '--from',
               '--chi': '--only-frame', '--do-phan-giai': '--resolution', '--ten': '--name', '--giay-phep': '--license', '--nguon': '--source', '--t': '--at'}

def english_argv(argv):
    """Translate old Vietnamese command/flag names so scripts, Studio and older docs keep working."""
    out = list(argv)
    if out and out[0] in LEGACY_CMD: out[0] = LEGACY_CMD[out[0]]
    if len(out) > 1 and out[0] in LEGACY_SUB and out[1] in LEGACY_SUB[out[0]]: out[1] = LEGACY_SUB[out[0]][out[1]]
    for i, t in enumerate(out):
        k = t.split('=', 1)[0]
        if k in LEGACY_FLAG: out[i] = LEGACY_FLAG[k] + t[len(k):]
    return out

def main():
    ap = argparse.ArgumentParser(prog='xp', description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter); sp = ap.add_subparsers(dest='cmd', required=True, metavar='command')
    mod = lambda name: (lambda a: (sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))), __import__(name).main(a, sys.modules[__name__])))
    p = sp.add_parser('setup', help='check prerequisites, fix what is safe, list what needs the user (run first)')
    p.add_argument('--install', help='comma list of approved items: ffmpeg, chromium, three, fonts, huashu, hyperframes, composer, birefnet, voicestudio'); p.add_argument('--policy', action='store_true', help='create .mega-shot/chinh_sach.json (only after the user agreed)')
    p.add_argument('--json', action='store_true'); p.add_argument('--quick', action='store_true', help='skip the browser test'); p.add_argument('--no-launch', action='store_true', help='do not start VoiceStudio')
    p.set_defaults(f=mod('setup'))
    p = sp.add_parser('new', help='create videos/<name> from a template'); p.add_argument('ten', metavar='name'); p.add_argument('--format', dest='khung', default='9x16', choices=list(FORMATS))
    p.add_argument('--template', dest='mau', default='trong', help='footage | blank | threejs | blender | ai-image | manifesto | medical | news | story | philosophy (old names: trong, anh-ai, tuyen-ngon, y-khoa, tin-tuc, truyen, triet-ly)'); p.set_defaults(f=cmd_moi)
    for nm, f, h in [('narrate', cmd_giong, 'generate the narration voice per scene → build/timeline.json'), ('all', cmd_tatca, 'narrate → mix → render → export → check')]:
        p = sp.add_parser(nm, help=h); p.add_argument('--import-from', dest='nhap_tu', help='use recorded audio files instead of VoiceStudio'); p.add_argument('--redo', dest='lam_lai', nargs='*', help='regenerate these scene ids (all if empty)')
        p.add_argument('--fps', type=int, default=30); p.add_argument('--page', dest='trang', default='film.html'); p.add_argument('--limit', dest='gioi_han', type=float, default=29); p.set_defaults(f=f)
    sp.add_parser('timeline', help='rebuild build/timeline.json without generating voice').set_defaults(f=cmd_mocthoigian)
    p = sp.add_parser('assets', help='search, score, download and cut footage/images for scenes with `tim`'); p.add_argument('canh', nargs='*', metavar='scene'); p.add_argument('--fps', type=int, default=30); p.set_defaults(f=cmd_timtainguyen)
    p = sp.add_parser('download', help='download one asset (polyhaven <id> | url <link>) and log its licence'); p.add_argument('nguon_loai', choices=['polyhaven', 'url'], metavar='kind'); p.add_argument('ma', metavar='id_or_url')
    p.add_argument('--resolution', dest='do_phan_giai', default='2k'); p.add_argument('--name', dest='ten'); p.add_argument('--license', dest='giay_phep'); p.add_argument('--source', dest='nguon'); p.set_defaults(f=cmd_tainguyen)
    p = sp.add_parser('art', help='render scenes with `huashu:` (sketch/whiteboard, Kurzgesagt 2D, kinetic type, 3b1b…) timed to the narration'); p.add_argument('canh', nargs='*', metavar='scene')
    p.add_argument('--redo', action='store_true'); p.set_defaults(f=mod('huashu'))
    sp.add_parser('prompts', help='write AI image prompts (ai-image template)').set_defaults(f=cmd_loinhac)
    sp.add_parser('images', help='import AI images from anh/').set_defaults(f=cmd_anh)
    p = sp.add_parser('blender', help='render Blender scenes'); p.add_argument('canh', nargs='*', metavar='scene'); p.add_argument('--draft', dest='nhap', action='store_true', help='EEVEE, half resolution')
    p.add_argument('--samples', type=int, default=96); p.add_argument('--fps', type=int, default=30); p.add_argument('--redo', dest='lam_lai', action='store_true'); p.add_argument('--from', dest='tu', type=int)
    p.add_argument('--only-frame', dest='chi', type=int, help='render a single test frame'); p.set_defaults(f=cmd_blender)
    p = sp.add_parser('preview', help='render a few frames + contact sheet build/thu.jpg'); p.add_argument('--at', dest='t', help='times in seconds, e.g. 5,12,30'); p.add_argument('--page', dest='trang', default='film.html'); p.set_defaults(f=cmd_thu)
    sp.add_parser('mix', help='mix narration + music + sound effects → build/mix.wav').set_defaults(f=cmd_am)
    p = sp.add_parser('review', aliases=['soat'], help='check voice (dropped words), subtitles vs speech, text overflowing the frame, the first 3 seconds and on-screen reading time BEFORE rendering'); p.add_argument('--page', dest='trang', default='film.html'); p.add_argument('--skip-read', action='store_true', help='skip the reading-time scan of on-screen text'); p.set_defaults(f=cmd_soat)
    p = sp.add_parser('render', help='render per scene (cached in build/doan/, unchanged scenes reused) → build/raw.mp4 (GPU H.264 in the browser)'); p.add_argument('--fps', type=int, default=30); p.add_argument('--page', dest='trang', default='film.html'); p.add_argument('--full', action='store_true', help='single-pass render of the whole video, no cache'); p.add_argument('--scene', nargs='+', metavar='id', help='force re-render of these scenes'); p.set_defaults(f=cmd_render)
    p = sp.add_parser('export', help='upload file + phone preview (< --limit MB) + publish package'); p.add_argument('--limit', dest='gioi_han', type=float, default=29); p.set_defaults(f=cmd_xuat)
    p = sp.add_parser('hf', help='render `hf:` scenes with HyperFrames (HTML + GSAP motion graphics: news maps, counters, headlines) → build/layers_hf/'); p.add_argument('canh', nargs='*', metavar='scene'); p.add_argument('--redo', dest='lam_lai', action='store_true'); p.set_defaults(f=cmd_hf)
    p = sp.add_parser('compose', help="perform the video's own ABC score (nhac.soan) on real instrument samples, fitted to the scenes → build/nhac_soan.wav"); p.set_defaults(f=cmd_nhac)
    p = sp.add_parser('clip', help='take scenes from an online video: licence check → download (yt-dlp) → scene/text/transcript analysis → ready `tim` entries'); p.add_argument('url'); p.add_argument('--name'); p.add_argument('--consent', help='only for sources without an open licence: who allowed it / why you may use it (logged; blocked on auto channels)'); p.add_argument('--lang'); p.add_argument('--no-words', action='store_true'); p.set_defaults(f=cmd_clip)
    p = sp.add_parser('grade', help='colour-match footage shots + film look (`mau: { kieu: am-dien-anh|net-tuong-phan|khong, muc: 0.6 }`); runs after `assets` automatically'); p.add_argument('canh', nargs='*', metavar='scene'); p.add_argument('--force', action='store_true', help='grade again even if already graded (stacks — prefer re-extracting)'); p.set_defaults(f=cmd_grade)
    p = sp.add_parser('check', help='quality check of the export · `check script` scores the script before narration'); p.add_argument('loai', nargs='?', choices=['script'], metavar='script'); p.set_defaults(f=cmd_kiemtra)
    p = sp.add_parser('publish', help='publishing package: titles, description, tags, hashtags, captions, credits'); p.set_defaults(f=cmd_dangbai)
    p = sp.add_parser('sfx', help='sound library: kenney.nl CC0 packs + natural sounds (kenney list | kenney add <pack…>|all | add <file> --name --license --source | search <words> | list)')
    p.add_argument('action', choices=['kenney', 'search', 'list', 'add']); p.add_argument('args', nargs='*')
    p.add_argument('--name'); p.add_argument('--license', dest='giay_phep'); p.add_argument('--source', dest='nguon_am'); p.add_argument('--start', type=float); p.add_argument('--duration', type=float)
    p.set_defaults(f=mod('sfxlib'))
    p = sp.add_parser('channel', help='automatic daily videos per YouTube channel, uploaded PRIVATE (list | new | topics | next | mark | auth | upload | brief) — references/channels.md')
    p.add_argument('action', choices=['list', 'new', 'topics', 'next', 'mark', 'auth', 'upload', 'brief', 'score', 'rate', 'due', 'release', 'schedule', 'plan']); p.add_argument('id', nargs='?'); p.add_argument('rest', nargs='*')
    p.add_argument('--vi', help='Vietnamese translation of the title (display only)'); p.add_argument('--goc-vi', dest='goc_vi'); p.add_argument('--ai', type=float, help='AI score 0–10'); p.add_argument('--why')
    p.add_argument('--name'); p.add_argument('--like', help='reference video folder (format, voice, music, style)'); p.add_argument('--force', action='store_true')
    p.add_argument('--add', action='append', help='"Title | angle" (repeatable)'); p.add_argument('--approve'); p.add_argument('--reject'); p.add_argument('--approve-all', action='store_true')
    p.add_argument('--json', action='store_true'); p.add_argument('--video'); p.add_argument('--note'); p.add_argument('--topic'); p.add_argument('--youtube-id', dest='yt_id', help='upload: update an already-uploaded video instead of uploading again')
    p.add_argument('--at', help='schedule: run time HH:MM'); p.add_argument('--days', help='schedule: t2,t3,…,cn | all | weekdays | weekend'); p.add_argument('--per-night', dest='per_night', type=int); p.add_argument('--claim', action='store_true', help='due: take the run lock')
    p.set_defaults(f=cmd_channel)
    p = sp.add_parser('social', help='OPTIONAL: queue posts for TikTok / Facebook / … through YOUR adapter (folder | webhook | custom module) — target | post | run | list | cancel | retry')
    p.add_argument('action', choices=['target', 'post', 'run', 'list', 'cancel', 'retry']); p.add_argument('rest', nargs='*')
    p.add_argument('--to', help='post: target aliases, comma separated'); p.add_argument('--at', help='post: "YYYY-MM-DD HH:MM" or "HH:MM" (local time); default now')
    p.add_argument('--caption'); p.add_argument('--title'); p.add_argument('--adapter', help='target add: folder | webhook | <module in tools/social_adapters>')
    p.add_argument('--platform', help='target add: tiktok | facebook | instagram | … (picks out/caption_<platform>.txt)'); p.add_argument('--path', help='target add (folder): outbox folder')
    p.add_argument('--url', help='target add (webhook): https endpoint you control'); p.add_argument('--token-env', dest='token_env', help='target add (webhook): env var holding the bearer token')
    p.add_argument('--late', type=float, default=3, help='run: skip jobs more than N hours past their slot'); p.add_argument('--all', action='store_true')
    p.set_defaults(f=mod('social'))
    p = sp.add_parser('cleanup', help='free disk: archive scripts/captions and delete video folders already posted everywhere (dry run unless --xoa)')
    p.add_argument('--delete', '--xoa', dest='xoa', action='store_true', help='really delete (also runs automatically after social run / channel upload)')
    p.set_defaults(f=mod('don'))
    p = sp.add_parser('satellite', help='real satellite plates for a place (Sentinel-2 + Blue Marble) for `ve_tinh:` scenes — references/evidence/')
    p.add_argument('name'); p.add_argument('--center', help='LAT,LON'); p.add_argument('--km', type=float, default=20, help='width of the detail plate')
    p.add_argument('--date', help='STAC datetime window, default last 60 days'); p.add_argument('--before', help='second window → truoc.jpg (before/after)')
    p.add_argument('--cloud', type=float, default=15); p.add_argument('--to', help='video folder')
    p.set_defaults(f=mod('vetinh'))
    p = sp.add_parser('3d', help='render one 3D still from a build(ms, ctx) script — studio kit: ms.phong_cach / ms.vl / ms.khoi / ms.blob / ms.den_3_diem / ms.bau_troi / ms.may (references/blender/)')
    p.add_argument('script'); p.add_argument('--out'); p.add_argument('--samples', type=int, default=128); p.add_argument('--size', default='1080x1080'); p.add_argument('--draft', action='store_true'); p.set_defaults(f=cmd_3d)
    p = sp.add_parser('restore', help='analyse an image and rebuild it sharper / cleaner / larger (JPEG deblock, edge-preserving denoise, crisp ink + flat colours from upscaled colour labels) → <name>_taitao.png + _so_sanh.jpg + _phan_tich.json')
    p.add_argument('anh'); p.add_argument('--scale', type=float, default=4); p.add_argument('--kieu', default='tu-dong', choices=['tu-dong', 'phang', 'anh', 'lai']); p.add_argument('--mau', type=int, default=0, help='colour count (0 = auto)'); p.add_argument('--out'); p.set_defaults(f=mod('taitao'))
    p = sp.add_parser('voicestudio', help='run the VoiceStudio narration API headless (start | stop | restart | status; --gui opens the app)')
    p.add_argument('action', choices=['start', 'stop', 'restart', 'status']); p.add_argument('--gui', action='store_true'); p.set_defaults(f=mod('voicestudio'))
    p = sp.add_parser('subtitles', help='YouTube caption files: source language + English (+ --langs) → out/subtitles/*.srt (runs automatically after export)')
    p.add_argument('--langs', help='extra languages, e.g. ja,es (English is always included)'); p.add_argument('--status', action='store_true', help='exit code 3 if a translation is missing/stale')
    p.set_defaults(f=mod('subtitles'))
    p = sp.add_parser('series', help='multi-episode series → long YouTube video'); p.add_argument('lenh', choices=['new', 'run', 'assemble'], metavar='{new,run,assemble}'); p.add_argument('ten', nargs='?', metavar='name')
    p.add_argument('--episodes', dest='so_tap', type=int, default=3); p.add_argument('--format', dest='khung', default='16x9', choices=list(FORMATS)); p.add_argument('--template', dest='mau', default='footage')
    p.add_argument('--only', dest='tap', nargs='*', help='only these episode folders'); p.add_argument('--steps', dest='buoc', help='comma list: narrate,assets,art,blender,mix,render'); p.add_argument('--redo', dest='lam_lai', action='store_true', help='force re-render')
    p.set_defaults(f=mod('loat'))
    p = sp.add_parser('thumbnail', help='YouTube thumbnails (`thumbnail new` creates the config)'); p.add_argument('ten', nargs='*', metavar='variant', help='"new" to create anh_bia.yaml, or variant names'); p.set_defaults(f=mod('anhbia'))
    p = sp.add_parser('voice', help='voice library: clone a narration voice from an audio or video file'); p.add_argument('action', choices=['add', 'list', 'check']); p.add_argument('file', nargs='?')
    p.add_argument('--name'); p.add_argument('--consent', action='store_true', help='the user owns this voice or has explicit permission to clone it'); p.add_argument('--lang')
    p.add_argument('--max', type=float, default=180, help='use only the first N seconds of the source'); p.add_argument('--no-app', action='store_true', help='do not create a VoiceStudio profile')
    p.add_argument('--force', action='store_true')
    p.add_argument('--archetype', help='use a built-in VoiceStudio narrator instead of a file: documentarian, storyteller, anchor, librarian, calm-guide, explainer, teacher')
    p.set_defaults(f=mod('library'))
    p = sp.add_parser('music', help='background music: add from a file, list, brief (what to look for + Pixabay Music links), check (quality score + listening page)'); p.add_argument('action', choices=['add', 'list', 'brief', 'check']); p.add_argument('files', nargs='*')
    p.add_argument('--hours', type=float, default=24, help='check: audio in ~/Downloads from the last N hours'); p.add_argument('--no-vocals-check', action='store_true'); p.add_argument('--phone', action='store_true', help='check: 30 s preview videos (card + music under the real narration) to send in chat')
    p.add_argument('--name'); p.add_argument('--start', type=float, default=0); p.add_argument('--duration', type=float, default=0); p.add_argument('--license')
    p.add_argument('--use', action='store_true', help='set as nhac.file in ./video.yaml or ./loat.yaml'); p.set_defaults(f=mod('library'))
    p = sp.add_parser('viral', help='OPTIONAL: find viral YouTube videos on a topic, score them, summarise patterns (references/viral-research.md)'); p.add_argument('topic')
    p.add_argument('--q', help='extra queries separated by |'); p.add_argument('--format', choices=['short', 'long', 'any'], default='short'); p.add_argument('--lang', default='en'); p.add_argument('--region', default='US')
    p.add_argument('--days', type=int, default=730, help='only videos from the last N days (0 = all)'); p.add_argument('--n', type=int, default=25); p.set_defaults(f=mod('viral'))
    p = sp.add_parser('text-styles', help='render GIF previews of the animated subtitle/title styles (references/text-styles/)'); p.add_argument('--only'); p.add_argument('--width', type=int, default=360); p.add_argument('--fps', type=int, default=20); p.set_defaults(f=mod('textstyles'))
    p = sp.add_parser('character', help='code-drawn cartoon characters: demo previews (references/characters.md)'); p.add_argument('action', choices=['demo', 'styles', 'critters'])
    p.add_argument('--still', type=float); p.add_argument('--width', type=int, default=360); p.add_argument('--fps', type=int, default=15); p.set_defaults(f=mod('character'))
    p = sp.add_parser('cast-design', help='AI design loop for code-drawn 2D characters: description/photo → spec → review sheet → score → lock (references/characters-ai-loop.md)')
    p.add_argument('action', choices=['new', 'draw', 'score', 'cast', 'lock', 'yaml', 'list']); p.add_argument('id', nargs='?'); p.add_argument('ids', nargs='*')
    p.add_argument('--desc'); p.add_argument('--ref'); p.add_argument('--license'); p.add_argument('--style', default='anime-thanh-nien'); p.add_argument('--name')
    p.add_argument('--scores'); p.add_argument('--fix'); p.add_argument('--force', action='store_true'); p.set_defaults(f=mod('nhanvat'))
    REDRAW = {'analyse': 'phan-tich', 'analyze': 'phan-tich', 'draw': 've', 'recolor': 'doi-mau', 'recolour': 'doi-mau', 'extend': 'mo-rong'}   # English aliases of the action names
    p = sp.add_parser('redraw', help='redraw a flat/cel illustration as SVG in code: analyse → vectorize → line check → recolour → extend (references/ve-lai.md)')
    p.add_argument('action', type=lambda v: REDRAW.get(v, v), choices=['phan-tich', 've', 'doi-mau', 'mo-rong', 'rig'], help='phan-tich (analyse) · ve (draw) · doi-mau (recolor) · mo-rong (extend) · rig')
    p.add_argument('src', help='image (phan-tich) or its work folder')
    p.add_argument('--out'); p.add_argument('--doi', action='append', help='name=#hex or #old=#new (repeatable)'); p.add_argument('--name', dest='ten', help='output name')
    p.add_argument('--canvas', '--format', dest='khung', help='WxH of the extended canvas'); p.add_argument('--dat', help='x,y of the original inside it'); p.add_argument('--them', help='mo-rong: them.json / SVG with <g id="duoi"> / <g id="tren">; rig: rig_ve.json')
    p.set_defaults(f=mod('ve_lai'))
    POSE = {'open': 'mo', 'add': 'them', 'check': 'soat', 'list': 'ds', 'remove': 'xoa'}
    p = sp.add_parser('pose-editor', help='FK pose & clip editor for 2D characters + shared custom clip library (references/dung-dang.md)')
    p.add_argument('action', type=lambda v: POSE.get(v, v), choices=['mo', 'them', 'soat', 'ds', 'xoa'], help='mo (open) · them (add) · soat (check) · ds (list) · xoa (remove)')
    p.add_argument('ten_hoac_file', nargs='?', help='clip name or JSON file')
    p.add_argument('--nv', help='library character id (.mega-shot/nhanvat/<id>)'); p.add_argument('--clip'); p.add_argument('--port', type=int, default=8765)
    p.add_argument('--name'); p.add_argument('--n', type=int, default=8); p.set_defaults(f=mod('dung_dang'))
    p = sp.add_parser('model', help='reusable procedural 3D models rebuilt from a reference image (references/models3d.md)'); p.add_argument('action', choices=['new', 'check', 'list'])
    p.add_argument('name', nargs='?'); p.add_argument('--from', dest='src', help='image path or pixabay:<id>'); p.add_argument('--license', default='')
    p.add_argument('--height', type=float, default=1.0, help='real-ish height (scene units ≈ metres)'); p.add_argument('--force', action='store_true')
    p.add_argument('--nguoi', action='store_true', help='a person (people3d.js) fitted to the reference: costume, hair, skin, colours')
    p.add_argument('--time', dest='t', type=float, default=0, help='animation time for the check renders'); p.add_argument('--size', type=int, default=640); p.set_defaults(f=mod('model3d'))
    p = sp.add_parser('pack', help='build a shareable zip of the skill (secret scan included)'); p.add_argument('--out'); p.add_argument('--no-huashu', action='store_true'); p.add_argument('--no-three', action='store_true'); p.add_argument('--lite', action='store_true', help='small build for other AI tools'); p.add_argument('--raw', action='store_true', help='no three.js pruning / media re-encoding'); p.add_argument('--no-models', action='store_true', help=argparse.SUPPRESS); p.set_defaults(f=mod('pack'))
    p = sp.add_parser('studio', help='local dashboard in the browser'); p.add_argument('--port', dest='cong', type=int, default=3901); p.add_argument('--open', dest='mo', action='store_true', help='open the browser'); p.set_defaults(f=mod('studio'))
    a = ap.parse_args(english_argv(sys.argv[1:]))
    # internal values (handlers were written with Vietnamese names)
    if getattr(a, 'loai', None) == 'script': a.loai = 'kichban'
    if a.cmd == 'series': a.lenh = {'new': 'moi', 'run': 'chay', 'assemble': 'ghep'}[a.lenh]
    if a.cmd == 'thumbnail' and a.ten and a.ten[0] == 'new': a.ten[0] = 'moi'
    if a.cmd == 'series' and a.buoc: a.buoc = ','.join({'narrate': 'giong', 'voice': 'giong', 'assets': 'tim', 'mix': 'am', 'art': 'art'}.get(x.strip(), x.strip()) for x in a.buoc.split(','))
    a.f(a)

if __name__ == '__main__': main()
