"""mega-shot · `xp art` — render scenes in a huashu-art-motion explainer grammar, timed to the narration.

A scene in video.yaml can be drawn by the sibling skill huashu-art-motion instead of footage/canvas:

  - id: why-salty
    loi: "Rain dissolves minerals in rock. Rivers carry the salt to the sea…"
    huashu:
      grammar: y3_whiteboard        # t1_3b1b | t2_keynote_ui | t3_finance_chart | y1_kurzgesagt | y2_vox | y3_whiteboard | y4_storytime | y5_kinetic_type
      data: { … }                   # grammar-level data (see huashu references/09 §5 per grammar)
      cues:                         # same cue fields as huashu (kind, text, sub, image, data, dur)
        - { at: 0, kind: title, text: "Why is the sea salty?" }
        - { at_word: "minerals", kind: point, text: "Rain dissolves minerals" }    # at_word = appears when the narrator says this word
        - { at_word: "salt", lead: 0.3, kind: draw, text: "Rivers carry salt", data: { icon: stack } }

Run after `xp narrate` (needs build/timeline.json). The clip lasts exactly the scene (+ overlap for the transition),
leaves the subtitle band free (safe.bottom), is cached by its spec, and becomes a normal shot of the scene
(build/layers/<id>, giay_phep.json entry with `loai: huashu`) — subtitles, music, SFX and transitions work as usual.
Image paths in cues are relative to the video folder.
"""
import hashlib, json, os, re, shutil, subprocess, unicodedata

GRAMMARS = ['t1_3b1b', 't2_keynote_ui', 't3_finance_chart', 'y1_kurzgesagt', 'y2_vox', 'y3_whiteboard', 'y4_storytime', 'y5_kinetic_type']
SAFE_BOTTOM = {'16x9': 200, '9x16': 540, '1x1': 220}                            # keep the burned-in subtitle band clear

def _norm(w): return re.sub(r'[\W_]+', '', unicodedata.normalize('NFC', str(w).lower()))

def huashu_root(X):
    for p in (os.environ.get('HUASHU_SKILL'), os.path.join(os.path.dirname(X.SKILL), 'huashu-art-motion'), os.path.join(X.SKILL, 'vendor', 'huashu-art-motion')):
        if p and os.path.exists(os.path.join(p, 'scripts', 'engine', 'render.py')): return p
    X.die('huashu-art-motion skill not found next to mega-shot (.claude/skills/huashu-art-motion) — install it with `xp setup --install huashu` or set HUASHU_SKILL')

def _scene_words(tl, sc):
    """Words spoken inside this scene, with times relative to the scene start."""
    out = []
    for sub in tl.get('subs', []):
        for w in sub.get('w') or []:
            if sc['t0'] - .05 <= w[1] < sc['t1']: out.append((_norm(w[0]), w[1] - sc['t0']))
    return out

def _cue_time(X, cue, words, sid, used):
    if 'at' in cue: return float(cue['at'])
    target = _norm(cue['at_word']); n = int(cue.get('nth', 1))
    hits = [t for w, t in words if w == target or (len(target) > 3 and w.startswith(target))]
    if len(hits) < n:
        X.log(f"⚠ {sid}: word \"{cue['at_word']}\" not found in the narration — cue placed after the previous one"); return used + .8
    return max(0.0, hits[n - 1] + float(cue.get('lead', 0)))

def build_spec(X, s, sc, words, W, H, khung):
    h = sc['data']['huashu']; g = h.get('grammar')
    if g not in GRAMMARS: X.die(f"{sc['id']}: huashu.grammar must be one of {', '.join(GRAMMARS)}")
    dur = round(sc['t1'] - sc['t0'] + .6, 3)                                      # + overlap so the outgoing transition has frames
    cues, last = [], 0.0
    for c in h.get('cues') or []:
        t = _cue_time(X, c, words, sc['id'], last); last = t
        cue = {k: v for k, v in c.items() if k not in ('at_word', 'lead', 'nth')}; cue['at'] = round(t, 3)
        if cue.get('image') and not os.path.isabs(cue['image']) and not re.match(r'^(data:|https?:)', cue['image']): cue['image'] = os.path.abspath(cue['image'])
        cues.append(cue)
    spec = {'grammar': g, 'duration': dur, 'fps': 30, 'width': W, 'height': H, 'safe': {'top': 0, 'bottom': h.get('safe_bottom', SAFE_BOTTOM.get(khung, 200))},
            'data': h.get('data') or {}, 'cues': cues}
    return spec

def main(a, X):
    s = X.load_spec(); W, H = X.FORMATS[s['khung']]
    if not os.path.exists('build/timeline.json'): X.die('no build/timeline.json — run `xp narrate` first (clips are timed to the narration)')
    tl = json.load(open('build/timeline.json', encoding='utf-8'))
    scenes = [sc for sc in tl['scenes'] if (sc.get('data') or {}).get('huashu') and (not a.canh or sc['id'] in a.canh)]
    if not scenes: X.log('no scene with `huashu:` here'); return
    root = huashu_root(X); scripts = os.path.join(root, 'scripts'); os.makedirs('build/huashu', exist_ok=True)
    book = json.load(open('giay_phep.json', encoding='utf-8')) if os.path.exists('giay_phep.json') else {}
    env = {**os.environ, 'PYTHONUTF8': '1'}                                       # huashu reads the spec with the default encoding; UTF-8 keeps Vietnamese text intact
    for sc in scenes:
        sid = sc['id']; spec = build_spec(X, s, sc, _scene_words(tl, sc), W, H, s['khung'])
        key = hashlib.sha1(json.dumps(spec, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:12]
        sp, mp4 = os.path.abspath(f'build/huashu/{sid}.json'), os.path.abspath(f'build/huashu/{sid}.mp4')
        layers = f'build/layers/{sid}'; n = int(round(spec['duration'] * 30))
        if (book.get(sid) or {}).get('hash') == key and os.path.exists(mp4) and os.path.isdir(layers) and not a.redo:
            X.log(f'{sid}: unchanged (cached)'); continue
        json.dump(spec, open(sp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        X.log(f"{sid}: {spec['grammar']} · {spec['duration']}s · {len(spec['cues'])} cues")
        r = subprocess.run(['uv', 'run', '--quiet', '--with', 'playwright==1.63.0', 'python', os.path.join('engine', 'render.py'), '--spec', sp, '--out', mp4], cwd=scripts, env=env, capture_output=True, text=True, encoding='utf-8', errors='replace')
        if r.returncode or not os.path.exists(mp4): X.die(f'{sid}: huashu render failed:\n' + (r.stderr or r.stdout)[-1200:])
        shutil.rmtree(layers, ignore_errors=True); os.makedirs(layers)
        X.run(['ffmpeg', '-v', 'error', '-y', '-i', mp4, '-q:v', '2', '-start_number', '0', f'{layers}/%05d.jpg'])
        n = len([f for f in os.listdir(layers) if f.endswith('.jpg')])
        book[sid] = {'nguon': 'huashu', 'loai': 'huashu', 'grammar': spec['grammar'], 'hash': key, 'file': os.path.relpath(mp4).replace(os.sep, '/'),
                     'tac_gia': 'huashu-art-motion (drawn in code)', 'giay_phep': 'own work', 'khung': n, 'cat': [],
                     'shots': [{'k': 'v', 't0': 0.0, 't1': spec['duration'], 'f0': 0}]}
        json.dump(book, open('giay_phep.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        X.log(f'  → {n} frames · build/layers/{sid}')
    X.log('✓ huashu scenes ready — continue with `xp preview` / `xp render`')
