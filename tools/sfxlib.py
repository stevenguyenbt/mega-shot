"""mega-shot · `xp sfx` — sound-effect library from kenney.nl (CC0 · public domain, commercial use, no attribution required).

  xp sfx kenney list                  packs available on kenney.nl (Audio category) and which are installed
  xp sfx kenney add <pack…> | all     download pack zip(s), keep ONLY audio files (.ogg/.wav/.mp3) → .mega-shot/sfx/kenney/<pack>/
  xp sfx search <words>               find sounds by name, e.g. "impact metal heavy", "click", "laser"
  xp sfx list                         installed sounds per pack

Use in video.yaml (mix step, tools/sfx.py):
  sfx: { thay: { bum: "kenney:impactPunch_heavy_000", tich: "click", vut: "swoosh" } }   # replace built-in sounds
  canh: [{ …, am: [{ ten: "laser", tu: "Saturn", muc: .4 }, { ten: "kenney:sci-fi-sounds/forceField_000", luc: 2.5 }] }]
        # ten = kenney:<pack>/<file> | kenney:<file> | search words · tu = spoken word in that scene · luc = seconds into the scene
Natural sounds (whales, dolphins, surf, rain, birds…) — .mega-shot/sfx/tu-nhien/<name>.wav, licence logged in GIAY_PHEP.md:
  xp sfx add <audio-or-video file> --name humpback-song --license "Public domain (NOAA)" --source <url> [--start s --duration s]
  use: am: [{ ten: "tu-nhien:humpback-song", tu: whale, muc: .5 }] · ambience bed: sfx: { am_nen: "tu-nhien:<name>" }
Downloads only from kenney.nl (source "kenney" in .mega-shot/chinh_sach.json); zips are data — nothing is executed; licence logged in .mega-shot/sfx/GIAY_PHEP.md.
"""
import io, json, os, re, subprocess, time, urllib.request, zipfile

BASE = 'https://kenney.nl'
PACKS = ['impact-sounds', 'interface-sounds', 'ui-audio', 'digital-audio', 'sci-fi-sounds', 'rpg-audio', 'casino-audio', 'music-jingles', 'voiceover-pack', 'voiceover-pack-fighter']
AUDIO = ('.ogg', '.wav', '.mp3')
UA = {'User-Agent': 'Mozilla/5.0 (mega-shot video tool)'}
SR = 48000


def kdir(root): return os.path.join(root, '.mega-shot', 'sfx', 'kenney')
def ndir(root): return os.path.join(root, '.mega-shot', 'sfx', 'tu-nhien')
def _get(url, timeout=120): return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout).read()
def _words(s): return set(w for w in re.findall(r'[a-z]+|\d+', re.sub(r'([a-z])([A-Z])', r'\1 \2', s).lower().replace('_', ' ').replace('-', ' ')) if len(w) > 1 or w.isdigit())


def allowed(root):
    p = os.path.join(root, '.mega-shot', 'chinh_sach.json')
    try: return 'kenney' in json.load(open(p, encoding='utf-8')).get('nguon', [])
    except Exception: return False


def zip_url(slug):
    html = _get(f'{BASE}/assets/{slug}').decode('utf-8', 'replace')
    m = re.search(r'(?:https://kenney\.nl)?(/media/pages/assets/' + re.escape(slug) + r'/[^"\'\s<>]+?\.zip)', html)
    if not m: raise RuntimeError(f'no zip download link found on {BASE}/assets/{slug}')
    lic = 'CC0' if re.search(r'CC0|publicdomain/zero', html) else '?'
    return BASE + m.group(1), lic


def add(root, slug, log=print):
    if slug not in PACKS: raise SystemExit(f'pack "{slug}" does not exist — xp sfx kenney list')
    url, lic = zip_url(slug)
    if lic != 'CC0': raise SystemExit(f'{slug}: the page does not state CC0 — not downloading')
    data = _get(url, timeout=600); out = os.path.join(kdir(root), slug); os.makedirs(out, exist_ok=True); n = 0
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        for info in z.infolist():
            name = os.path.basename(info.filename.replace('\\', '/'))                       # basename only: no path traversal
            if not name or info.is_dir() or not name.lower().endswith(AUDIO): continue
            with z.open(info) as src, open(os.path.join(out, name), 'wb') as dst: dst.write(src.read()); n += 1
    lp = os.path.join(root, '.mega-shot', 'sfx', 'GIAY_PHEP.md')
    with open(lp, 'a', encoding='utf-8') as f: f.write(f'- {time.strftime("%Y-%m-%d")} · Kenney "{slug}" · {n} files · CC0 1.0 (public domain) · {BASE}/assets/{slug}\n')
    index(root); log(f'✓ {slug}: {n} sounds · {len(data) / 1e6:.1f} MB zip · CC0 → .mega-shot/sfx/kenney/{slug}/')
    return n


def index(root):
    items = []
    for slug in sorted(os.listdir(kdir(root))) if os.path.isdir(kdir(root)) else []:
        d = os.path.join(kdir(root), slug)
        if not os.path.isdir(d): continue
        for f in sorted(os.listdir(d)):
            if f.lower().endswith(AUDIO):
                stem = os.path.splitext(f)[0]; items.append({'id': f'{slug}/{stem}', 'file': os.path.join(d, f), 'tags': sorted(_words(stem) | _words(slug))})
    if os.path.isdir(ndir(root)):                                                     # natural sounds the user added (xp sfx add)
        for f in sorted(os.listdir(ndir(root))):
            if f.lower().endswith(AUDIO): stem = os.path.splitext(f)[0]; items.append({'id': f'tu-nhien/{stem}', 'file': os.path.join(ndir(root), f), 'tags': sorted(_words(stem) | {'tu', 'nhien', 'nature'})})
    os.makedirs(kdir(root), exist_ok=True); json.dump(items, open(os.path.join(kdir(root), 'index.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    return items


def items(root):
    p = os.path.join(kdir(root), 'index.json')
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else index(root)


def search(root, q, n=12):
    want = _words(q); out = []
    for it in items(root):
        tg = set(it['tags']); s = len(want & tg) + sum(.5 for w in want if any(t.startswith(w) for t in tg if t not in want))
        if s: out.append((s, it))
    out.sort(key=lambda x: (-x[0], x[1]['id'])); return [it for _, it in out[:n]]


def resolve(root, ref):
    """'kenney:<pack>/<stem>' | 'kenney:<stem>' | search words → file path (or None)."""
    r = str(ref).strip(); its = items(root)
    if r.startswith('tu-nhien:'):
        p = next((os.path.join(ndir(root), f) for f in (os.listdir(ndir(root)) if os.path.isdir(ndir(root)) else []) if os.path.splitext(f)[0] == r[9:]), None)
        return p
    if r.startswith('kenney:'):
        k = r[7:]; hit = next((it for it in its if it['id'] == k or it['id'].split('/', 1)[1] == k), None)
        return hit['file'] if hit else None
    res = search(root, r, 1); return res[0]['file'] if res else None


def load(root, ref):
    """Decode a library sound to float32 stereo 48 kHz (cached as .npy next to the procedural sounds)."""
    import numpy as np
    f = resolve(root, ref)
    if not f: return None
    cdir = os.path.join(root, '.mega-shot', 'sfx', '_cache'); os.makedirs(cdir, exist_ok=True)
    cp = os.path.join(cdir, re.sub(r'[^\w.-]+', '_', os.path.relpath(f, os.path.dirname(kdir(root)))) + '.npy')
    if os.path.exists(cp) and os.path.getmtime(cp) >= os.path.getmtime(f): return np.load(cp)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.float32).reshape(-1, 2).copy(); pk = float(np.abs(a).max() or 1); a /= pk
    np.save(cp, a); return a


def main(a, X):
    root = X.find_root('.')
    if a.action == 'kenney':
        sub = (a.args or ['list'])[0]; rest = (a.args or [])[1:]
        inst = set(os.listdir(kdir(root))) if os.path.isdir(kdir(root)) else set()
        if sub == 'list':
            for s in PACKS: X.log(f"{'✓' if s in inst else '·'} {s:<24} {BASE}/assets/{s}")
            X.log('CC0 · download: xp sfx kenney add <pack…> | all'); return
        if sub == 'add':
            if not allowed(root): X.die('source "kenney" is not in .mega-shot/chinh_sach.json — ask the user, then add "kenney" to the nguon list')
            for s in (PACKS if rest == ['all'] else rest): add(root, s, X.log)
            return
        X.die('xp sfx kenney list | add <pack…> | all')
    if a.action == 'add':                                                             # natural sound from a file the user provides / an approved source
        if not a.args or not a.name or not a.giay_phep: X.die('xp sfx add <file> --name <name> --license "<licence>" [--source <url>] [--start s --duration s]')
        src = a.args[0]; os.makedirs(ndir(root), exist_ok=True); out = os.path.join(ndir(root), re.sub(r'[^\w-]+', '-', a.name.lower()).strip('-') + '.wav')
        cut = (['-ss', str(a.start)] if a.start else []) + (['-t', str(a.duration)] if a.duration else [])
        subprocess.run(['ffmpeg', '-v', 'error', '-y', *cut, '-i', src, '-vn', '-ac', '2', '-ar', str(SR), '-af', 'loudnorm=I=-20:TP=-2,afade=t=in:d=0.05', out], check=True)
        with open(os.path.join(root, '.mega-shot', 'sfx', 'GIAY_PHEP.md'), 'a', encoding='utf-8') as f:
            f.write(f'- {time.strftime("%Y-%m-%d")} · tu-nhien/{os.path.basename(out)} · {a.giay_phep} · source: {a.nguon_am or os.path.basename(src)}\n')
        index(root); X.log(f'✓ tu-nhien:{os.path.splitext(os.path.basename(out))[0]} → {out}'); return
    if a.action == 'search':
        q = ' '.join(a.args or [])
        for it in search(root, q, 20): X.log(('tu-nhien:' + it['id'][9:]) if it['id'].startswith('tu-nhien/') else f"kenney:{it['id']}")
        return
    if a.action == 'list':
        from collections import Counter
        c = Counter(it['id'].split('/')[0] for it in items(root))
        for k, v in sorted(c.items()): X.log(f'{k:<24} {v} sounds')
        if not c: X.log('none yet — xp sfx kenney add impact-sounds interface-sounds')
