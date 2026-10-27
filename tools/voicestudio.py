"""mega-shot · `xp voicestudio` — run the VoiceStudio narration API headless (no app window).

  xp voicestudio start        start the backend in the background (hidden, survives after xp exits) and wait for :3900
  xp voicestudio stop         stop the headless backend started by xp (never touches an app window the user opened)
  xp voicestudio restart      stop + start (use when it hangs: port silent, GPU 0%)
  xp voicestudio status       running? headless or app? runtime path, log file
  xp voicestudio start --gui  open the normal app instead

VoiceStudio = an Electron window + a Python backend (uvicorn `main:app --app-dir backend` on 127.0.0.1:3900). The window is
only a client: xp starts the same backend directly, from the same runtime the app installed (runtime-location.json →
<root>/project/.venv), with the app's environment, so voices, clone profiles and models are shared with the app.
The FIRST launch after installing must still go through the app (`xp setup --install voicestudio`) — it builds the runtime
and downloads the models. Narration (`xp narrate`, `xp voice add`) calls ensure() and starts it headless automatically.

Log: .mega-shot/voicestudio/backend.log · pid: .mega-shot/voicestudio/backend.pid
"""
import json, os, platform, signal, subprocess, sys, time, urllib.request

URL = 'http://127.0.0.1:3900'
PORT = 3900


def up(url=URL, timeout=5):
    try: urllib.request.urlopen(url + '/health', timeout=timeout); return True
    except Exception: return False


def _user_data():
    s, home = platform.system(), os.path.expanduser('~')
    if s == 'Windows': return os.path.join(os.environ.get('APPDATA', os.path.join(home, 'AppData', 'Roaming')), 'VoiceStudio')
    if s == 'Darwin': return os.path.join(home, 'Library', 'Application Support', 'VoiceStudio')
    return os.path.join(os.environ.get('XDG_CONFIG_HOME', os.path.join(home, '.config')), 'VoiceStudio')


def runtime():
    """(project dir, python) of the backend runtime the app installed, or (None, reason)."""
    ud = _user_data(); roots = []
    try: roots.append(json.load(open(os.path.join(ud, 'runtime-location.json'), encoding='utf-8'))['root'])
    except Exception: pass
    roots.append(os.path.join(ud, 'runtime'))
    for r in roots:
        proj = os.path.join(r, 'project')
        py = os.path.join(proj, '.venv', 'Scripts', 'python.exe') if os.name == 'nt' else os.path.join(proj, '.venv', 'bin', 'python')
        if os.path.exists(os.path.join(proj, 'backend', 'main.py')) and os.path.exists(py): return proj, py
    return None, 'VoiceStudio runtime not found — install it and open the app once (xp setup --install voicestudio)'


def _env():
    env = dict(os.environ)
    for k in ('PYTHONHOME', 'PYTHONPATH', 'VIRTUAL_ENV', 'UV_PROJECT_ENVIRONMENT'): env.pop(k, None)
    env.update(PYTHONUNBUFFERED='1', PYTHONUTF8='1', OMNIVOICE_PORT=str(PORT))   # same as the app's childEnv()
    if os.name == 'nt': env.update(TORCHDYNAMO_DISABLE='1', HF_HUB_DISABLE_SYMLINKS='1', HF_HUB_DISABLE_SYMLINKS_WARNING='1', FOR_DISABLE_CONSOLE_CTRL_HANDLER='1')
    return env


def _dir(root):
    d = os.path.join(root, '.mega-shot', 'voicestudio'); os.makedirs(d, exist_ok=True); return d


def _pid(root):
    try: return int(open(os.path.join(_dir(root), 'backend.pid')).read().strip())
    except Exception: return None


def _alive(pid):
    if not pid: return False
    if os.name == 'nt':
        r = subprocess.run(['tasklist', '/FI', f'PID eq {pid}', '/NH'], capture_output=True, text=True, errors='replace')
        return str(pid) in r.stdout
    try: os.kill(pid, 0); return True
    except OSError: return False


def start(root, log=print, wait=240):
    """Start the backend hidden in the background; True when :3900 answers."""
    if up(): return True
    proj, py = runtime()
    if not proj: log(py); return False
    d = _dir(root); lf = open(os.path.join(d, 'backend.log'), 'ab')
    cmd = [py, '-m', 'uvicorn', 'main:app', '--app-dir', 'backend', '--host', '127.0.0.1', '--port', str(PORT)]
    kw = dict(cwd=proj, env=_env(), stdin=subprocess.DEVNULL, stdout=lf, stderr=subprocess.STDOUT, close_fds=True)
    if os.name == 'nt':
        base = 0x08000000 | 0x00000200                                          # CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP
        try: p = subprocess.Popen(cmd, creationflags=base | 0x01000000, **kw)    # + CREATE_BREAKAWAY_FROM_JOB: outlive `uv run`'s job object
        except OSError: p = subprocess.Popen(cmd, creationflags=base, **kw)
    else: p = subprocess.Popen(cmd, start_new_session=True, **kw)
    open(os.path.join(d, 'backend.pid'), 'w').write(str(p.pid))
    log(f'VoiceStudio: starting headless (pid {p.pid}, no window) · log .mega-shot/voicestudio/backend.log')
    t = time.time()
    while time.time() - t < wait:
        if up(timeout=3): log(f'✓ VoiceStudio API up on {URL} ({time.time() - t:.0f}s, headless)'); return True
        if p.poll() is not None:
            tail = open(os.path.join(d, 'backend.log'), 'rb').read()[-1200:].decode('utf-8', 'replace')
            log(f'✗ backend exited (code {p.returncode}) — last log lines:\n{tail}'); return False
        time.sleep(2)
    log('✗ backend did not answer in time — see .mega-shot/voicestudio/backend.log'); return False


def stop(root, log=print):
    pid = _pid(root)
    if not _alive(pid): log('no headless VoiceStudio backend started by xp is running'); return False
    if os.name == 'nt': subprocess.run(['taskkill', '/PID', str(pid), '/T', '/F'], capture_output=True)
    else:
        try: os.killpg(pid, signal.SIGTERM)
        except OSError: pass
    for _ in range(20):
        if not up(timeout=1): break
        time.sleep(.5)
    try: os.remove(os.path.join(_dir(root), 'backend.pid'))
    except OSError: pass
    log(f'VoiceStudio headless backend stopped (pid {pid})'); return True


def ensure(root, log=print):
    """Narration entry point: API up already (app or headless) → True; otherwise start headless."""
    return up() or start(root, log)


def status(root, log=print):
    pid = _pid(root); proj, py = runtime(); h = _alive(pid)
    log(f'API {URL}: ' + ('UP' if up() else 'down') + (f' · headless backend pid {pid}' if h else ' · (not started by xp — the app, or nothing)' if up() else ''))
    log(f'runtime: {proj or py}')
    return up()


def main(a, X):
    root = X.find_root('.')
    if a.action == 'start' and getattr(a, 'gui', False):
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import setup
        exe = setup._voicestudio_exe() or X.die('VoiceStudio app not installed (xp setup --install voicestudio)'); setup._voicestudio_launch(exe); X.log(f'opened {exe}'); return
    ok = {'start': lambda: start(root, X.log), 'stop': lambda: stop(root, X.log) or True,
          'restart': lambda: (stop(root, X.log), start(root, X.log))[1], 'status': lambda: status(root, X.log)}[a.action]()
    if not ok: sys.exit(1)
