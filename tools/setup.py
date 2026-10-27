"""mega-shot · `xp setup` — check this machine, fix what is safe, and list everything that needs the user.

Run it FIRST in every new session or on a new machine. It never downloads or installs anything large, changes the
system, or writes policy/keys on its own: those items are listed under "NEEDS YOUR INPUT", and the AI must ask the
user (one question per decision) and only then re-run with the approved flags.

  xp setup                         check everything, start VoiceStudio if it is installed but not running
  xp setup --json                  same, machine-readable (also saved to .mega-shot/setup_status.json)
  xp setup --install fonts,three   download/install approved items (ids: ffmpeg, chromium, three, fonts, huashu, hyperframes, composer, birefnet, voicestudio)
  xp setup --policy                create .mega-shot/chinh_sach.json (auto-download policy) — only after the user agreed
  xp setup --quick                 skip the browser launch test (faster)

Exit code 0 = everything REQUIRED for the footage workflow is ready; 1 = something required is missing.
"""
import glob, json, os, platform, re, shutil, subprocess, sys, time, urllib.request

OK, FIXED, NEED, OPT, INFO = 'ok', 'fixed', 'missing', 'optional', 'info'
ICON = {OK: '✓', FIXED: '✓', NEED: '✗', OPT: '○', INFO: '·'}

# items the user can approve with --install <id>
INSTALL = {
    'ffmpeg':   {'what': 'FFmpeg (video/audio encoding) via winget (Windows) / Homebrew (macOS) / apt|dnf|pacman (Linux, asks for sudo)', 'size': '~90 MB', 'license': 'LGPL/GPL'},
    'huashu':   {'what': 'huashu-art-motion skill (drawn styles for `xp art`) — git clone github.com/alchaincyf/huashu-art-motion into vendor/', 'size': '~100 MB', 'license': 'MIT'},
    'chromium': {'what': 'Chromium for Playwright (headless rendering)', 'size': '~180 MB', 'license': 'BSD'},
    'three':    {'what': 'three.js for the 3D template (npm install in engine/)', 'size': '~30 MB', 'license': 'MIT'},
    'fonts':    {'what': 'Be Vietnam Pro Black/ExtraBold + Oswald (thumbnail fonts) from google/fonts', 'size': '~1 MB', 'license': 'SIL OFL 1.1'},
    'hyperframes': {'what': 'HyperFrames + GSAP + map data for news motion graphics (`xp hf`), npm into .mega-shot/tools/hyperframes (telemetry off)',
                    'size': '~150 MB', 'license': 'Apache-2.0 (HyperFrames), GSAP standard licence, ISC/BSD (d3-geo, topojson), public domain (Natural Earth)'},
    'composer': {'what': 'huashu-motion composer + real instrument samples for original music (`xp nhac`): git clone + sample build into .mega-shot/',
                 'size': '~300 MB', 'license': 'MIT (code), CC0 / CC BY (samples — see the huashu-motion repo)'},
    'birefnet': {'what': 'BiRefNet background-removal model (2.5D stills, thumbnail cut-outs) via rembg', 'size': '~973 MB', 'license': 'MIT'},
    'voicestudio': {'what': 'VoiceStudio desktop app (local voice cloning + TTS + Whisper, API :3900) from github.com/debpalash/VoiceStudio — Windows/macOS/Linux; macOS: xattr -cr',
                    'size': '~215–275 MB + voice models on first launch', 'license': 'AGPL-3.0'},
}
FONTS = {
    'BeVietnamPro-Black.ttf': 'https://github.com/google/fonts/raw/main/ofl/bevietnampro/BeVietnamPro-Black.ttf',
    'BeVietnamPro-ExtraBold.ttf': 'https://github.com/google/fonts/raw/main/ofl/bevietnampro/BeVietnamPro-ExtraBold.ttf',
    'OFL-BeVietnamPro.txt': 'https://github.com/google/fonts/raw/main/ofl/bevietnampro/OFL.txt',
    'Oswald[wght].ttf': 'https://github.com/google/fonts/raw/main/ofl/oswald/Oswald%5Bwght%5D.ttf',
    'OFL-Oswald.txt': 'https://github.com/google/fonts/raw/main/ofl/oswald/OFL.txt',
}
DEFAULT_POLICY = {
    'tu_tai': True,
    'nguon': ['pixabay', 'pexels', 'nasa', 'polyhaven', 'ambientcg'],
    'giay_phep': 'commercial use allowed (CC0, Pixabay/Pexels License, public domain)',
    'gioi_han_mb_moi_video': 1024,
    'ghi_chu': 'Created by `xp setup --policy` after the user agreed. Extra sources per video: nguon_them in video.yaml.',
}

def huashu_dir(skill):
    """huashu-art-motion: $HUASHU_SKILL, a sibling skill folder, or vendor/huashu-art-motion inside this repo."""
    for p in (os.environ.get('HUASHU_SKILL'), os.path.join(os.path.dirname(skill), 'huashu-art-motion'), os.path.join(skill, 'vendor', 'huashu-art-motion')):
        if p and os.path.exists(os.path.join(p, 'scripts', 'engine', 'render.py')): return p
    return None

def _ver(cmd):
    try: return subprocess.run(cmd, capture_output=True, text=True, timeout=30).stdout.strip().splitlines()[0]
    except Exception: return None

def _get(url, timeout=60):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'mega-shot-setup/1.0'}), timeout=timeout).read()

def _voicestudio_up(url='http://127.0.0.1:3900'):
    try: urllib.request.urlopen(url + '/health', timeout=5); return True
    except Exception: return False

VS_RELEASES = 'https://github.com/debpalash/VoiceStudio/releases/latest'      # official releases (AGPL-3.0) — the app's own updater uses this source

def _voicestudio_exe():
    """Installed VoiceStudio: .exe (Windows), .app bundle (macOS) or AppImage (Linux)."""
    home = os.path.expanduser('~'); sysname = platform.system()
    if sysname == 'Windows':
        cands = [os.path.join(os.environ.get('LOCALAPPDATA', ''), 'Programs', 'VoiceStudio', 'VoiceStudio.exe'),
                 os.path.join(os.environ.get('ProgramFiles', 'C:/Program Files'), 'VoiceStudio', 'VoiceStudio.exe')]
    elif sysname == 'Darwin':
        cands = ['/Applications/VoiceStudio.app', os.path.join(home, 'Applications', 'VoiceStudio.app')]
    else:
        cands = [os.path.join(home, '.local', 'bin', 'VoiceStudio.AppImage')] + sorted(glob.glob(os.path.join(home, 'Applications', 'VoiceStudio*.AppImage')))
    return next((p for p in cands if os.path.exists(p)), None)

def _voicestudio_launch(path):
    """Open an already-installed VoiceStudio (no download)."""
    if platform.system() == 'Darwin': subprocess.Popen(['open', path])
    elif platform.system() == 'Windows': subprocess.Popen([path], close_fds=True, creationflags=getattr(subprocess, 'DETACHED_PROCESS', 0))
    else: subprocess.Popen([path], close_fds=True, start_new_session=True)

def _voicestudio_asset(rel):
    """Release file for this OS/CPU: Windows .exe · macOS .zip (arm64 / x64) · Linux AppImage."""
    sysname, mach = platform.system(), platform.machine().lower()
    suffix = {'Windows': '-win-x64.exe', 'Linux': '-linux-x64.AppImage'}.get(sysname) or ('-mac-arm64.zip' if mach in ('arm64', 'aarch64') else '-mac-x64.zip')
    return next((x for x in rel.get('assets', []) if x['name'].endswith(suffix)), None)

def _voicestudio_download_install(X):
    """Run ONLY after the user approved `xp setup --install voicestudio`: download the official release, verify SHA-256,
    install for the current user (no admin), on macOS clear the quarantine flag with `xattr -cr` (non-notarized app)."""
    import hashlib, tempfile
    api = VS_RELEASES.replace('https://github.com/', 'https://api.github.com/repos/').replace('/releases/latest', '/releases/latest')
    rel = json.loads(_get(api)); asset = _voicestudio_asset(rel)
    if not asset: X.die(f'no VoiceStudio build for {platform.system()} {platform.machine()} in release {rel.get("tag_name")}')
    sums = next((x for x in rel['assets'] if x['name'] == 'SHA256SUMS.txt'), None)
    want = {ln.split()[-1].lstrip('*'): ln.split()[0].lower() for ln in _get(sums['browser_download_url']).decode().splitlines() if len(ln.split()) >= 2} if sums else {}
    tmp = os.path.join(tempfile.mkdtemp(prefix='voicestudio-'), asset['name']); h = hashlib.sha256(); got = last = 0
    X.log(f'downloading {asset["name"]} ({asset["size"] / 1e6:.0f} MB, {rel.get("tag_name")}) from {VS_RELEASES}')
    with urllib.request.urlopen(urllib.request.Request(asset['browser_download_url'], headers={'User-Agent': 'mega-shot-setup/1.0'}), timeout=120) as r, open(tmp, 'wb') as fh:
        while True:
            b = r.read(1 << 20)
            if not b: break
            fh.write(b); h.update(b); got += len(b)
            if got - last > 25e6: last = got; X.log(f'  {got / 1e6:.0f} / {asset["size"] / 1e6:.0f} MB')
    exp = want.get(asset['name'])
    if not exp: X.die('the release publishes no SHA-256 for this file — not installing an unverified binary; install it manually from ' + VS_RELEASES)
    if exp != h.hexdigest(): X.die('SHA-256 mismatch — download corrupted or tampered; nothing was installed')
    X.log('  SHA-256 verified')
    sysname = platform.system()
    if sysname == 'Windows':
        X.log('installing for the current user (silent installer, no admin needed)…')
        subprocess.run([tmp, '/S'], check=True)                                # electron-builder NSIS → %LOCALAPPDATA%\Programs\VoiceStudio
    elif sysname == 'Darwin':
        dest = '/Applications' if os.access('/Applications', os.W_OK) else os.path.join(os.path.expanduser('~'), 'Applications'); os.makedirs(dest, exist_ok=True)
        X.log(f'unpacking into {dest}…'); subprocess.run(['ditto', '-x', '-k', tmp, dest], check=True)
        app = os.path.join(dest, 'VoiceStudio.app')
        if not os.path.exists(app): app = max(glob.glob(os.path.join(dest, 'VoiceStudio*.app')), key=os.path.getmtime)
        X.log(f'clearing the macOS quarantine flag (approved by the user): xattr -cr "{app}"')
        subprocess.run(['xattr', '-cr', app], check=True)                       # app is not notarized: otherwise Gatekeeper blocks the first launch
    else:
        dest = os.path.join(os.path.expanduser('~'), '.local', 'bin', 'VoiceStudio.AppImage'); os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copy(tmp, dest); os.chmod(dest, 0o755)
    try: os.remove(tmp)
    except OSError: pass
    lic = os.path.join(os.path.expanduser('~'), '.mega-shot-installs.log')
    open(lic, 'a', encoding='utf-8').write(f'{time.strftime("%Y-%m-%d")} · VoiceStudio {rel.get("tag_name")} · {asset["name"]} · sha256 {exp} · AGPL-3.0\n')

def install_voicestudio(X):
    """`xp setup --install voicestudio` (the user's approval): install it if missing, open it, wait for the API on :3900."""
    exe = _voicestudio_exe()
    if not exe:
        _voicestudio_download_install(X); exe = _voicestudio_exe()
        if not exe: X.die('installer finished but VoiceStudio was not found — open it once manually')
        X.log(f'installed: {exe}')
    X.log(f'opening VoiceStudio: {exe}'); _voicestudio_launch(exe)
    for k in range(90):                                                         # first launch prepares its backend + models: up to ~6 min
        time.sleep(4)
        if _voicestudio_up(): X.log('✓ VoiceStudio API is up on http://127.0.0.1:3900'); return
        if k % 15 == 14: X.log('  still preparing… (the first launch downloads its voice models)')
    X.log('VoiceStudio is open but the API is not up yet — let it finish its first-run setup, then run xp setup again')

def _browser_probe():
    """Launch headless Chromium; report WebCodecs hardware H.264 support (fast render path)."""
    import functools, http.server, tempfile, threading
    from playwright.sync_api import sync_playwright
    d = tempfile.mkdtemp(); open(os.path.join(d, 'index.html'), 'w').write('<canvas id=c width=1920 height=1080></canvas>')
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(http.server.SimpleHTTPRequestHandler, directory=d))
    threading.Thread(target=srv.serve_forever, daemon=True).start()       # WebCodecs needs a secure context: http://127.0.0.1 is one, about:blank is not
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'])
        pg = b.new_page(); pg.goto(f'http://127.0.0.1:{srv.server_port}/index.html')
        hw = pg.evaluate("""async () => { if (!('VideoEncoder' in window)) return 'none';
          for (const h of ['prefer-hardware', 'prefer-software']) { try { const r = await VideoEncoder.isConfigSupported({ codec: 'avc1.640033', width: 1920, height: 1080, bitrate: 30e6, framerate: 30, hardwareAcceleration: h }); if (r.supported) return h; } catch (e) {} }
          return 'none'; }""")
        b.close()
    srv.shutdown(); return hw

def check(X, root, quick=False, launch=True):
    items = []
    def add(id_, name, status, detail, why='', action='', ask=None):
        items.append({'id': id_, 'name': name, 'status': status, 'detail': detail, 'why': why, 'action': action, 'ask': ask})
    ms = os.path.join(root, '.mega-shot'); skill = X.SKILL

    # --- core tools ---
    v = _ver(['uv', '--version']); add('uv', 'uv (Python runner)', OK if v else NEED, v or 'not found', 'runs every xp command and installs Python packages on demand',
        '' if v else 'Install uv: https://docs.astral.sh/uv/getting-started/installation/', None if v else 'manual')
    ff, fp = _ver(['ffmpeg', '-version']), _ver(['ffprobe', '-version'])
    add('ffmpeg', 'FFmpeg + FFprobe', OK if ff and fp else NEED, (ff or 'ffmpeg not found')[:60], 'mixing, encoding, frame extraction',
        '' if ff and fp else 'xp setup --install ffmpeg   (or install manually and add to PATH)', None if ff and fp else 'install')

    # --- browser / rendering ---
    if quick: add('chromium', 'Chromium (Playwright)', INFO, 'not tested (--quick)', 'renders every frame')
    else:
        try:
            hw = _browser_probe()
            add('chromium', 'Chromium (Playwright)', OK, 'launches headless', 'renders every frame')
            add('webcodecs', 'In-browser H.264 encoder', OK if hw == 'prefer-hardware' else INFO, {'prefer-hardware': 'GPU hardware (~55 fps render)', 'prefer-software': 'software only (slower)', 'none': 'unavailable → JPEG/x264 fallback (~16 fps)'}.get(hw, hw), 'fast rendering (see references/performance.md)')
        except Exception as e:
            add('chromium', 'Chromium (Playwright)', NEED, f'cannot launch ({str(e).splitlines()[0][:80]})', 'renders every frame', 'xp setup --install chromium', 'install')
    smi = _ver(['nvidia-smi', '--query-gpu=name,driver_version,memory.total', '--format=csv,noheader'])
    if smi:
        drv = re.findall(r',\s*([\d.]+)\s*,', smi); major = float(drv[0].split('.')[0]) if drv else 0
        add('gpu', 'NVIDIA GPU / driver', OK if major >= 610 else INFO, smi, 'VoiceStudio, WebCodecs; NVENC in ffmpeg needs driver ≥ 610',
            '' if major >= 610 else 'Optional: update the NVIDIA driver to ≥ 610 to enable NVENC (https://www.nvidia.com/Download/index.aspx)', None if major >= 610 else 'manual-optional')
    else: add('gpu', 'NVIDIA GPU / driver', INFO, 'nvidia-smi not found', 'VoiceStudio runs much faster on an NVIDIA GPU')

    # --- narration ---
    up = _voicestudio_up(); exe = _voicestudio_exe(); started = False
    if not up and exe and launch:                                               # installed but not running → start the backend headless (no window)
        import voicestudio
        up = started = voicestudio.start(root, lambda m: None, wait=90)
    add('voicestudio', 'VoiceStudio (narration API :3900)', FIXED if started else OK if up else NEED,
        'started headless (no window)' if started else 'running' if up else ('installed but not responding' if exe else 'not installed'),
        'generates narration and word timestamps (local voice cloning)',
        '' if up else ('xp voicestudio restart   (headless backend; log .mega-shot/voicestudio/backend.log). Right after a fresh install open the app once so it finishes its runtime + models' if exe else
                       'xp setup --install voicestudio   (official release from github.com/debpalash/VoiceStudio for this OS/CPU, SHA-256 verified, '
                       'per-user install without admin; on macOS it also runs xattr -cr /Applications/VoiceStudio.app because the app is not notarized; '
                       'then opens it and waits for the API)'),
        None if up else ('manual' if exe else 'install'))
    voices = sorted(os.path.basename(os.path.dirname(p)) for p in glob.glob(os.path.join(ms, 'voices', '*', 'ref.wav')) if os.path.exists(os.path.join(os.path.dirname(p), 'ref.txt')))
    add('voices', 'Voice samples', OK if voices else NEED, ', '.join(voices) or 'none', 'cloned narration voice (≤ 10 s ref.wav + exact ref.txt)',
        '' if voices else 'Quick start: xp voice add --archetype documentarian (built-in English narrator). Own voice: ask the user for an audio OR video file of the voice (≥ 15 s of one person speaking; music is removed automatically) and confirm they own it or have permission → xp voice add <file> --name <name> --consent', None if voices else 'provide')

    # --- assets ---
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import keys as _keys
    keys = {k: True for k in _keys.load(root)}                                  # environment, .env, .mega-shot/keys.env — values never shown
    for k, label in (('PIXABAY_API_KEY', 'Pixabay API key'), ('PEXELS_API_KEY', 'Pexels API key')):
        req = k == 'PIXABAY_API_KEY'
        add(k.lower(), label, OK if keys.get(k) else (NEED if req else OPT), 'set' if keys.get(k) else 'not set',
            'search stock footage/photos' + ('' if req else ' (second source, optional)'),
            '' if keys.get(k) else f'Add {k}=<key> to .env (copy .env.example; free key: ' + ('https://pixabay.com/api/docs/' if req else 'https://www.pexels.com/api/') + ')', None if keys.get(k) else 'provide')
    add('youtube_api_key', 'YouTube API key', OK if keys.get('YOUTUBE_API_KEY') else OPT, 'set' if keys.get('YOUTUBE_API_KEY') else 'not set',
        'optional viral research (xp viral): metadata of top videos on a topic',
        '' if keys.get('YOUTUBE_API_KEY') else 'Optional: Google Cloud Console → enable "YouTube Data API v3" → Credentials → API key → add YOUTUBE_API_KEY=<key> to .env', None if keys.get('YOUTUBE_API_KEY') else 'provide')
    pol = os.path.join(ms, 'chinh_sach.json')
    add('policy', 'Auto-download policy', OK if os.path.exists(pol) else NEED, 'present' if os.path.exists(pol) else 'not set',
        'allows xp assets to download licensed assets automatically (sources, licence, MB limit per video)',
        '' if os.path.exists(pol) else 'Ask the user to approve auto-downloads from Pixabay/Pexels/NASA/Poly Haven/ambientCG (≤ 1 GB per video), then: xp setup --policy', None if os.path.exists(pol) else 'decide')
    model = glob.glob(os.path.join(ms, 'models', '**', 'birefnet-general*.onnx'), recursive=True)
    add('birefnet', 'BiRefNet model', OK if model else OPT, 'present' if model else 'not downloaded', '2.5D parallax stills, thumbnail cut-outs',
        '' if model else 'xp setup --install birefnet   (~973 MB; otherwise downloaded on first use)', None if model else 'install')
    fdir = os.path.join(ms, 'fonts'); miss = [f for f in FONTS if not os.path.exists(os.path.join(fdir, f))]
    add('fonts', 'Thumbnail fonts', OK if not miss else OPT, 'present' if not miss else f'missing {len(miss)} files', 'thumbnails with full Vietnamese diacritics',
        '' if not miss else 'xp setup --install fonts', None if not miss else 'install')
    rock = os.path.exists(os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'Fonts', 'ROCKEB.TTF'))
    add('rockwell', 'Rockwell Extra Bold', OK if rock else INFO, 'present' if rock else 'not installed (Georgia is used instead)', 'poster-style thumbnail titles')
    three = os.path.exists(os.path.join(skill, 'engine', 'node_modules', 'three', 'build', 'three.module.js'))
    add('three', 'three.js', OK if three else OPT, 'present' if three else 'not installed', '3D template (threejs) only',
        '' if three else 'xp setup --install three   (needs Node.js/npm)', None if three else 'install')
    cand =os.environ.get('MS_BLENDER') or shutil.which('blender') or next(iter(glob.glob(os.path.join(ms, 'tools', 'blender-*', 'blender.exe'))), None)
    add('blender', 'Blender', OK if cand else OPT, cand or 'not found', 'Blender template only (Cycles scenery)',
        '' if cand else 'Optional: unzip portable Blender into .mega-shot/tools/ (https://www.blender.org/download/) or set MS_BLENDER', None if cand else 'manual-optional')
    hs = huashu_dir(skill)
    add('huashu', 'huashu-art-motion skill', OK if hs else OPT, 'present' if hs else 'not installed', 'drawn styles: sketch/whiteboard, flat 2D, kinetic type, 3b1b, 35 painterly styles (xp art)',
        '' if hs else 'xp setup --install huashu   (git clone, MIT; or install the skill next to mega-shot / set HUASHU_SKILL)', None if hs else 'install')
    hf = os.path.exists(os.path.join(ms, 'tools', 'hyperframes', 'node_modules', 'hyperframes'))
    add('hyperframes', 'HyperFrames (news graphics)', OK if hf else OPT, 'present' if hf else 'not installed', 'news template motion graphics (xp hf)',
        '' if hf else 'xp setup --install hyperframes   (needs Node.js/npm)', None if hf else 'install')
    om = os.path.exists(os.path.join(ms, 'tham-khao', 'huashu-motion-src', 'cli', 'om.js')) and os.path.isdir(os.path.join(ms, 'tools', 'om-samples'))
    add('composer', 'Music composer + samples', OK if om else OPT, 'present' if om else 'not installed', 'original per-video music from an ABC score (xp compose)',
        '' if om else 'xp setup --install composer   (needs git + Node.js)', None if om else 'install')
    free = shutil.disk_usage(root).free / 1e9
    add('disk', 'Free disk space', OK if free >= 20 else INFO, f'{free:.0f} GB', 'a long series needs ~10–20 GB (assets, frames, masters)')
    return items

def install(X, root, ids):
    ms = os.path.join(root, '.mega-shot'); done = []
    for i in ids:
        if i not in INSTALL: X.die(f'unknown install id "{i}" — choose from: {", ".join(INSTALL)}')
        X.log(f'installing {i}: {INSTALL[i]["what"]} ({INSTALL[i]["size"]}, {INSTALL[i]["license"]})')
        if i == 'ffmpeg':
            sysname = platform.system()
            if sysname == 'Windows':
                X.run(['winget', 'install', '--id', 'Gyan.FFmpeg', '-e', '--accept-source-agreements', '--accept-package-agreements'])
                X.log('ffmpeg installed — open a new terminal so PATH is refreshed')
            elif sysname == 'Darwin':
                if not shutil.which('brew'): X.die('Homebrew not found — install it from https://brew.sh, then run: brew install ffmpeg')
                X.run(['brew', 'install', 'ffmpeg'])
            else:
                pm = next(([m, *args] for m, args in (('apt-get', ['install', '-y', 'ffmpeg']), ('dnf', ['install', '-y', 'ffmpeg']), ('pacman', ['-S', '--noconfirm', 'ffmpeg'])) if shutil.which(m)), None)
                if not pm: X.die('no apt-get/dnf/pacman found — install ffmpeg with your package manager')
                X.log('running: sudo ' + ' '.join(pm)); X.run(['sudo', *pm])
        elif i == 'huashu':
            if huashu_dir(X.SKILL): X.log('huashu-art-motion already present'); continue
            if not shutil.which('git'): X.die('git not found — install git, or download https://github.com/alchaincyf/huashu-art-motion into vendor/huashu-art-motion')
            X.run(['git', 'clone', '--depth', '1', 'https://github.com/alchaincyf/huashu-art-motion', os.path.join(X.SKILL, 'vendor', 'huashu-art-motion')])
        elif i == 'chromium':
            X.run([sys.executable, '-m', 'playwright', 'install', 'chromium'])
        elif i == 'three':
            npm = shutil.which('npm') or shutil.which('npm.cmd')
            if not npm: X.die('npm not found — install Node.js LTS first (https://nodejs.org)')
            X.run([npm, 'install', '--no-audit', '--no-fund'], cwd=os.path.join(X.SKILL, 'engine'))
        elif i == 'fonts':
            fd = os.path.join(ms, 'fonts'); os.makedirs(fd, exist_ok=True)
            for name, url in FONTS.items():
                p = os.path.join(fd, name)
                if not os.path.exists(p): open(p, 'wb').write(_get(url)); X.log(f'  {name}')
        elif i == 'voicestudio':
            install_voicestudio(X)
        elif i == 'hyperframes':
            npm = shutil.which('npm') or shutil.which('npm.cmd')
            if not npm: X.die('npm not found — install Node.js LTS first (https://nodejs.org)')
            d = os.path.join(ms, 'tools', 'hyperframes'); os.makedirs(d, exist_ok=True)
            if not os.path.exists(os.path.join(d, 'package.json')): open(os.path.join(d, 'package.json'), 'w').write('{"name": "ms-hyperframes", "private": true}\n')
            X.run([npm, 'install', '--no-audit', '--no-fund', 'hyperframes', 'gsap', 'world-atlas', 'd3-geo', 'topojson-client'], cwd=d,
                  env={**os.environ, 'HYPERFRAMES_TELEMETRY': '0', 'DO_NOT_TRACK': '1'})
        elif i == 'composer':
            node = shutil.which('node') or X.die('node not found — install Node.js LTS first (https://nodejs.org)')
            git = shutil.which('git') or X.die('git not found — install git first')
            repo = os.path.join(ms, 'tham-khao', 'huashu-motion-src')
            if not os.path.exists(os.path.join(repo, 'cli', 'om.js')):
                X.run([git, 'clone', '--depth', '1', 'https://github.com/alchaincyf/huashu-motion', repo])
            env = {**os.environ, 'OM_SAMPLES': os.path.join(ms, 'tools', 'om-samples')}
            if platform.system() == 'Windows' and not shutil.which('bsdtar'):        # the sample builder calls bsdtar; Windows ships it as tar.exe
                b = os.path.join(ms, 'tools', 'bin'); os.makedirs(b, exist_ok=True)
                src = os.path.join(os.environ.get('WINDIR', 'C:\\Windows'), 'System32', 'tar.exe')
                if os.path.exists(src) and not os.path.exists(os.path.join(b, 'bsdtar.exe')): shutil.copy(src, os.path.join(b, 'bsdtar.exe'))
                env['PATH'] = b + os.pathsep + env.get('PATH', '')
            X.run([node, 'cli/om.js', 'samples', 'build'], cwd=repo, env=env)
        elif i == 'birefnet':
            md = os.path.join(ms, 'models'); os.makedirs(md, exist_ok=True)
            X.run(['uv', 'run', '--quiet', '--with', 'rembg[cpu]', 'python', '-c', 'import os,sys; os.environ["U2NET_HOME"]=sys.argv[1]; from rembg import new_session; new_session("birefnet-general"); print("ok")', md])
        done.append(i)
    lic = os.path.join(ms, 'GIAY_PHEP_CAI_DAT.md')                               # licence log for installed components
    with open(lic, 'a', encoding='utf-8') as fh:
        for i in done: fh.write(f'- {time.strftime("%Y-%m-%d")} · {INSTALL[i]["what"]} · {INSTALL[i]["license"]}\n')
    return done

def main(a, X):
    root = X.find_root('.')                                                       # nearest folder with .mega-shot/, or MS_PROJECT, or the current folder
    if not os.path.isdir(os.path.join(root, '.mega-shot')):                     # first run: the current folder becomes the project
        if os.path.realpath(root) == os.path.realpath(os.path.expanduser('~')):
            X.die('run xp setup inside a project folder (not your home folder), or set MS_PROJECT=<folder>')
        os.makedirs(os.path.join(root, '.mega-shot'), exist_ok=True); X.log(f'new project: {root} (data in .mega-shot/, videos in videos/)')
    if a.install: install(X, root, [x.strip() for x in a.install.split(',') if x.strip()])
    if a.policy:
        p = os.path.join(root, '.mega-shot', 'chinh_sach.json')
        if os.path.exists(p): X.log('policy already exists — left unchanged: .mega-shot/chinh_sach.json')
        else: json.dump({**DEFAULT_POLICY, 'ngay': time.strftime('%Y-%m-%d')}, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); X.log('created .mega-shot/chinh_sach.json')
    items = check(X, root, quick=a.quick, launch=not a.no_launch)
    required_missing = [i for i in items if i['status'] == NEED]
    asks = [i for i in items if i['ask']]
    json.dump({'time': time.strftime('%Y-%m-%d %H:%M'), 'ready': not required_missing, 'items': items}, open(os.path.join(root, '.mega-shot', 'setup_status.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    if a.json: print(json.dumps({'ready': not required_missing, 'items': items}, ensure_ascii=False, indent=1)); sys.exit(0 if not required_missing else 1)
    print('\nmega-shot setup · ' + root)
    print('-' * 78)
    for i in items: print(f" {ICON[i['status']]} {i['name']:<34} {i['detail'][:40]}")
    print('-' * 78)
    print(' ✓ ready  ✗ required, missing  ○ optional  · info')
    if asks:
        print('\n=== NEEDS YOUR INPUT (the AI must ask the user before acting) ===')
        kinds = {'install': 'APPROVE DOWNLOAD', 'decide': 'DECIDE', 'provide': 'PROVIDE', 'manual': 'DO MANUALLY', 'manual-optional': 'OPTIONAL'}
        for n, i in enumerate(asks, 1):
            extra = f" [{INSTALL[i['id']]['size']}, {INSTALL[i['id']]['license']}]" if i['ask'] == 'install' and i['id'] in INSTALL else ''
            req = '' if i['ask'] == 'manual-optional' else (' · required' if i['status'] == NEED else ' · optional')
            print(f" {n}. [{kinds[i['ask']]}{req}] {i['name']}{extra}\n    why: {i['why']}\n    → {i['action']}")
    print('\n' + ('READY: the footage workflow can run.' if not required_missing else f'NOT READY: {len(required_missing)} required item(s) missing.'))
    sys.exit(0 if not required_missing else 1)
