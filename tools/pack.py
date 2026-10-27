"""mega-shot · `xp pack` — build a shareable zip: the skill (+ optional huashu-art-motion) + README/LICENSE/AGENTS.md at the zip root.

  xp pack                    → dist/mega-shot-v<VERSION>.zip — FULL build (mega-shot + vendor/huashu-art-motion + three.js), size-optimized:
                             three.js pruned to the files the engine imports (transitive), preview GIFs/large JPGs/showcase PNGs
                             re-encoded smaller at pack time (originals untouched; cache in <out>/.pack-cache)
  xp pack --raw              full build without pruning/re-encoding (largest)
  xp pack --no-huashu        without the drawn-styles skill
  xp pack --no-three         without engine/node_modules (recipient runs `xp setup --install three`)
  xp pack --out <dir>
  xp pack --lite             small build for other AI tools: no three.js, no huashu, no preview GIFs/videos, no web/ viewer,
                             + AGENTS.md / GEMINI.md (generic agent instructions) → dist/mega-shot-v<VERSION>-lite.zip
  (--no-models is accepted for backward compatibility and does nothing)

The repo root IS the skill; the zip lays it out as .claude/skills/mega-shot/. Never packed: .git, dist/, vendor/ (except huashu-art-motion),
.mega-shot/ (voices, API keys, music, downloaded assets, models), videos/, __pycache__, .venv, .env. Before writing the zip every text file
is scanned for secrets and personal paths; any hit aborts.
"""
import hashlib, io, json, os, re, time, zipfile

SKIP_DIRS = {'__pycache__', '.git', '.pytest_cache', '.venv'}
SKIP_FILES = ('.pyc', '.pyo', '.DS_Store', 'Thumbs.db')
TEXT = ('.py', '.js', '.mjs', '.html', '.css', '.md', '.yaml', '.yml', '.json', '.cmd', '.bat', '.txt', '.sh', '.toml', '.cfg', '')
PATTERNS = [
    (r'(?i)\b[A-Z]:[\\/]{1,2}Users[\\/]{1,2}(?!<)[^\\/\s"\']+', 'absolute user path'),
    (r'(?i)\b[D-Z]:[\\/](?!<)[\w .-]+[\\/]', 'absolute drive path'),
    (r'(?i)(PIXABAY|PEXELS|YOUTUBE)_API_KEY\s*=\s*[A-Za-z0-9-]{8,}', 'API key value'),
    (r'(?i)(STUDIO_PASSWORD|SYNC_TOKEN|SESSION_SECRET)\s*=\s*\S{4,}', 'secret value'),
    (r'\bsk-[A-Za-z0-9_-]{20,}', 'API token'),
    (r'[\w.+-]+@(?!(?:wikimedia\.org|example\.com|users\.noreply\.github\.com|anthropic\.com)\b)[\w-]+\.[a-z]{2,}', 'e-mail address'),
]
ALLOW = ('D:\\\\clips\\\\', 'D:\\clips\\', 'C:\\Windows', 'C:/Windows')          # examples in docs

def _files(base, rel, skip_dirs):
    for dp, dns, fns in os.walk(base):
        dns[:] = [d for d in dns if d not in skip_dirs]
        for f in fns:
            if f.endswith(SKIP_FILES): continue
            p = os.path.join(dp, f); yield p, os.path.join(rel, os.path.relpath(p, base)).replace(os.sep, '/')

def _scan(path, arc, strict):
    if not arc.lower().endswith(TEXT) or os.path.getsize(path) > 2_000_000: return []
    try: s = io.open(path, encoding='utf-8').read()
    except UnicodeDecodeError: return []
    hits = []
    for rx, what in (PATTERNS if strict else PATTERNS[2:5]):                      # third-party skill: secrets only
        for m in re.finditer(rx, s):
            if any(a in m.group(0) for a in ALLOW): continue
            line = s.count('\n', 0, m.start()) + 1; hits.append(f'{arc}:{line}: {what}: {m.group(0)[:60]}')
    return hits

IMPORT_RX = re.compile(r"""(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]""")
ADDON_RX = re.compile(r"three/addons/([\w/.-]+\.js)")

def _three_needed(skill, hs, three):
    """Files of node_modules/three the engine really loads: build/three.module.js + every three/addons/* import found in
    mega-shot/huashu sources, closed over their relative imports."""
    seeds = {'package.json', 'LICENSE', 'build/three.module.js'}
    for base in (skill, hs):
        if not os.path.isdir(base): continue
        for p, _ in _files(base, '', SKIP_DIRS | {'node_modules', 'dist'}):
            if p.endswith(('.js', '.mjs', '.html')):
                try: seeds |= {'examples/jsm/' + m for m in ADDON_RX.findall(io.open(p, encoding='utf-8').read())}
                except UnicodeDecodeError: pass
    need, todo = set(), [x for x in seeds if os.path.exists(os.path.join(three, x))]
    while todo:
        f = todo.pop()
        if f in need: continue
        need.add(f)
        if not f.endswith('.js'): continue
        for m in IMPORT_RX.findall(io.open(os.path.join(three, f), encoding='utf-8').read()):
            if m == 'three': todo.append('build/three.module.js'); continue
            if m.startswith('three/addons/'): todo.append('examples/jsm/' + m[13:]); continue
            if m.startswith('.'):
                q = os.path.normpath(os.path.join(os.path.dirname(f), m)).replace(os.sep, '/')
                if os.path.exists(os.path.join(three, q)): todo.append(q)
    return need

def _slim(p, arc, cache, X):
    """Smaller copy of a preview GIF / large JPG (same name & format) via ffmpeg; original if not smaller."""
    low, size = arc.lower(), os.path.getsize(p)
    preview = '/assets/' in low or '/references/' in low                         # docs/showcase media, not engine inputs
    if not (low.endswith('.gif') and size > 300_000 or low.endswith(('.jpg', '.jpeg')) and size > 500_000 or low.endswith('.png') and preview and size > 500_000): return p
    st = os.stat(p); key = hashlib.sha1(f'{arc}|{size}|{st.st_mtime_ns}|v2'.encode()).hexdigest()[:20]
    out = os.path.join(cache, key + os.path.splitext(low)[1])
    if not os.path.exists(out):
        import subprocess
        if low.endswith('.gif'):
            vf = "fps=10,scale='min(400,iw)':-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle"
            cmd = ['ffmpeg', '-v', 'error', '-y', '-i', p, '-vf', vf, '-loop', '0', out]
        elif low.endswith('.png'):                                                # 8-bit palette PNG, same name
            vf = "scale='min(1600,iw)':-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=256:reserve_transparent=1[p];[b][p]paletteuse=dither=sierra2_4a"
            cmd = ['ffmpeg', '-v', 'error', '-y', '-i', p, '-vf', vf, '-frames:v', '1', out]
        else:
            w = 1920
            cmd = ['ffmpeg', '-v', 'error', '-y', '-i', p, '-vf', f"scale='min({w},iw)':-2:flags=lanczos", '-q:v', '4', out]
        r = subprocess.run(cmd, capture_output=True)
        if r.returncode or not os.path.exists(out): X.log('⚠', f'could not re-encode {arc} — packed as-is'); return p
    return out if os.path.getsize(out) < size * 0.9 else p

def main(a, X):
    skill = X.SKILL; root = skill                                                 # the repo root IS the skill
    ver = open(os.path.join(skill, 'VERSION'), encoding='utf-8').read().strip() if os.path.exists(os.path.join(skill, 'VERSION')) else '0.0.0'
    out_dir = os.path.abspath(a.out or os.path.join(root, 'dist')); os.makedirs(out_dir, exist_ok=True)
    if a.lite: a.no_three = a.no_huashu = True
    zpath = os.path.join(out_dir, f'mega-shot-v{ver}{"-lite" if a.lite else ""}.zip')
    items = []                                                                    # (path, arcname, strict scan)
    ms_skip = set(SKIP_DIRS) | ({'node_modules'} if a.no_three else set()) | ({'web', 'dist'} if a.lite else set())
    TOP_SKIP = {'dist', 'vendor', '.mega-shot', 'videos'}                         # repo-root folders that are never part of the skill
    ROOT_DOCS = ('README.md', 'LICENSE', 'AGENTS.md')                             # these go to the zip root instead
    NEVER = ('.env', 'keys.env')
    heavy = lambda arc: a.lite and arc.lower().endswith(('.gif', '.mp4', '.webm', '.mov'))      # lite: drop preview animations (regenerable)
    hs = os.path.join(skill, 'vendor', 'huashu-art-motion')
    three = os.path.join(skill, 'engine', 'node_modules', 'three'); NM = '.claude/skills/mega-shot/engine/node_modules/three/'
    keep3 = None if a.no_three or a.raw or not os.path.isdir(three) else _three_needed(skill, hs, three)
    pruned = lambda arc: keep3 is not None and arc.startswith(NM) and arc[len(NM):] not in keep3
    def keep(p, arc):
        rel = arc[len('.claude/skills/mega-shot/'):]
        return not (rel.split('/')[0] in TOP_SKIP or rel in ROOT_DOCS or os.path.basename(rel) in NEVER or heavy(arc) or pruned(arc))
    items += [(p, arc, 'node_modules' not in arc) for p, arc in _files(skill, '.claude/skills/mega-shot', ms_skip) if keep(p, arc)]
    if not a.no_huashu and os.path.isdir(hs): items += [(p, arc, False) for p, arc in _files(hs, '.claude/skills/huashu-art-motion', set(SKIP_DIRS))]
    for f in ROOT_DOCS:
        if os.path.exists(os.path.join(root, f)): items.append((os.path.join(root, f), f, True))
    if os.path.exists(os.path.join(root, 'AGENTS.md')): items.append((os.path.join(root, 'AGENTS.md'), 'GEMINI.md', True))   # Gemini CLI reads GEMINI.md
    if keep3 is not None: X.log(f'  three.js pruned to {len(keep3)} files the engine imports')
    if not a.raw:                                                                 # smaller preview media (originals untouched)
        cache = os.path.join(out_dir, '.pack-cache'); os.makedirs(cache, exist_ok=True)
        before = sum(os.path.getsize(p) for p, _, _ in items)
        items = [(_slim(p, arc, cache, X), arc, strict) for p, arc, strict in items]
        X.log(f'  media re-encoded: {(before - sum(os.path.getsize(p) for p, _, _ in items)) / 1048576:.1f} MB saved')
    hits = [h for p, arc, strict in items for h in _scan(p, arc, strict)]
    if hits:
        for h in hits[:40]: X.log('✗', h)
        X.die(f'{len(hits)} possible secret/personal item(s) found — fix them (or extend ALLOW in tools/pack.py for harmless examples) and run again')
    man = {'name': 'mega-shot', 'version': ver, 'built': time.strftime('%Y-%m-%d %H:%M'), 'files': len(items), 'includes_huashu': not a.no_huashu and os.path.isdir(hs), 'includes_three': not a.no_three, 'lite': bool(a.lite), 'three_pruned': keep3 is not None, 'media_reencoded': not a.raw, 'sha256': {}}
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p, arc, _ in items:
            data = open(p, 'rb').read(); z.writestr(arc, data); man['sha256'][arc] = hashlib.sha256(data).hexdigest()
        z.writestr('package-manifest.json', json.dumps(man, ensure_ascii=False, indent=1))
    X.log(f'✓ {zpath} · {len(items)} files · {os.path.getsize(zpath) / 1048576:.1f} MB · secret scan clean')
    X.log('  recipient: unzip into the project root → open it in Claude Code → ask for a video (see README.md)')
