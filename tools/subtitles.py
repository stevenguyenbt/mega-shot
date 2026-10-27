"""mega-shot · `xp subtitles` — sentence-level SRT captions for YouTube, source language + English (always) + any extra language.

  xp subtitles                 (in a video or series folder, after export / series assemble — both call it automatically)
                               → out/subtitles/cues.json + timing.json + <name>.<lang>.srt (source language)
                               → if the video is not English: out/subtitles/en.todo.json (cues to translate);
                                 once the AI has written out/subtitles/en.json → <name>.en.srt
                               → out/phu-de-<n>-ngon-ngu.zip
  xp subtitles --langs en,ja   also check/build these languages
  xp subtitles --status        only report what is missing (exit code 3 when a translation is missing or stale)

Cues merge the short burned-in subtitle lines (build/timeline.json) into full sentences (≤ 6.5 s, ≤ 110 chars),
restore punctuation from video.yaml `phu_de`, and never end a cue on "No." (e.g. "Dammam No. 7"). Series: every episode's
timeline is shifted by its start in the assembled video (build/ghep/phu_de_nguon.json, written by `series assemble`).

Translation contract (the AI agent does it — no external API): copy <lang>.todo.json to <lang>.json and replace every
value with the translation of the same cue. Keep "_cues_sha" unchanged: it ties the translation to the current cues, so a
re-narrated or re-timed video is detected as stale and must be re-translated.

Legacy CLI (still works): python subtitles.py cues <video dir> · python subtitles.py build <video dir> [langs…]
"""
import glob, hashlib, json, os, re, sys, zipfile

LINE = {'ja': 22, 'zh': 22, 'ko': 22}                                         # max characters per caption line
RTL = ('ar', 'he', 'fa')
LANG_NAME = {'en': 'English', 'vi': 'Vietnamese', 'ja': 'Japanese', 'zh': 'Chinese', 'ko': 'Korean', 'fr': 'French', 'es': 'Spanish', 'de': 'German'}


def ts(x):
    h = int(x // 3600); m = int(x % 3600 // 60); s = x % 60
    return f'{h:02d}:{m:02d}:{int(s):02d},{int(round((s - int(s)) * 1000)):03d}'


def wrap(t, n=42):
    if len(t) <= n: return t
    w = t.split(' '); best = None
    for i in range(1, len(w)):
        a, b = ' '.join(w[:i]), ' '.join(w[i:]); sc = max(len(a), len(b))
        if best is None or sc < best[0]: best = (sc, a + '\n' + b)
    return best[1] if best else t


def _split(t0, t1, text, n):
    """A cue longer than two caption lines → consecutive parts (cut at punctuation nearest the middle), time shared by length."""
    if len(text) <= 2 * n or ' ' not in text: return [(t0, t1, text)]
    w = text.split(' '); mid = len(text) / 2; best = None; acc = 0
    for i in range(1, len(w)):
        acc += len(w[i - 1]) + 1
        sc = abs(acc - mid) - (len(text) * .25 if re.search(r'[,;:.!?…—]$', w[i - 1]) else 0)
        if best is None or sc < best[0]: best = (sc, i)
    a, b = ' '.join(w[:best[1]]), ' '.join(w[best[1]:]); tm = t0 + (t1 - t0) * len(a) / len(text)
    return _split(t0, tm, a, n) + _split(tm, t1, b, n)


def _srt(rows, n):
    parts = [p for t0, t1, text in rows for p in _split(t0, t1, text, n)]
    return '\n'.join(f"{i}\n{ts(t0)} --> {ts(t1)}\n{wrap(t, n)}\n" for i, (t0, t1, t) in enumerate(parts, 1))


def _write(sd, name, L, rows):
    """<name>.<L>.srt (timed captions) + <name>.<L>.txt (plain transcript, one sentence per line — YouTube can auto-sync it)."""
    enc = 'utf-8-sig' if L in RTL else 'utf-8'
    open(os.path.join(sd, f'{name}.{L}.srt'), 'w', encoding=enc).write(_srt(rows, LINE.get(L, 42)))
    open(os.path.join(sd, f'{name}.{L}.txt'), 'w', encoding=enc).write('\n'.join(t for _, _, t in rows) + '\n')


def _yaml(p):
    import yaml, yaml_keys
    d = yaml.safe_load(open(p, encoding='utf-8'))
    return yaml_keys.normalize_series(d) if os.path.basename(p) == 'loat.yaml' else yaml_keys.normalize(d)


def _sources(vd):
    """[(offset seconds, episode dir)] + (name, source language)."""
    if os.path.exists(os.path.join(vd, 'loat.yaml')):
        L = _yaml(os.path.join(vd, 'loat.yaml')); f = os.path.join(vd, 'build', 'ghep', 'phu_de_nguon.json')
        if not os.path.exists(f): raise SystemExit('series: run `xp series assemble` first (it records where each episode starts)')
        src = [(o, os.path.join(vd, d)) for o, d in json.load(open(f, encoding='utf-8'))]
        lang = _yaml(os.path.join(src[0][1], 'video.yaml')).get('ngon_ngu', 'vi') if src else 'vi'
        return src, L.get('ten') or os.path.basename(os.path.abspath(vd)), lang
    d = _yaml(os.path.join(vd, 'video.yaml'))
    return [(0.0, vd)], d.get('ten') or os.path.basename(os.path.abspath(vd)), d.get('ngon_ngu', 'vi')


def _episode_cues(ep, off):
    tl = json.load(open(os.path.join(ep, 'build', 'timeline.json'), encoding='utf-8')); d = _yaml(os.path.join(ep, 'video.yaml'))
    full = re.sub(r'\s+', ' ', ' '.join(re.sub(r'\*\*|!!', '', str(c.get('phu_de') or c.get('loi') or '')).replace('|', ' ') for c in d['canh'])).strip().split(' ')
    n = lambda w: re.sub(r'[^\w]', '', w.lower())
    pos, segs = 0, []
    for s in tl.get('subs', []):
        ws = s['s'].split(); k = len(ws); j = pos
        while j < len(full) and [n(x) for x in full[j:j + k]] != [n(x) for x in ws]: j += 1
        if j >= len(full): j = pos
        segs.append((off + s['t0'], off + s['t1'], ' '.join(full[j:j + k]) or s['s'])); pos = j + k
    out, cur = [], None
    for t0, t1, t in segs:
        ends = re.search(r'[.!?…]["”»]?$', cur['text']) and not re.search(r'\bNo\.$', cur['text']) if cur else True
        if cur and cur['t1'] - cur['t0'] < 6.5 and not ends and len(cur['text']) + len(t) < 110: cur['text'] += ' ' + t; cur['t1'] = t1
        else: cur = {'t0': t0, 't1': t1, 'text': t}; out.append(cur)
    return out


def cues(vd):
    src, name, lang = _sources(vd)
    out = [c for off, ep in src for c in _episode_cues(ep, off)]
    sd = os.path.join(vd, 'out', 'subtitles'); os.makedirs(sd, exist_ok=True)
    for i, c in enumerate(out): c['id'] = i + 1
    body = [{'id': c['id'], 'text': c['text']} for c in out]
    json.dump(body, open(os.path.join(sd, 'cues.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    json.dump([{'id': c['id'], 't0': round(c['t0'], 3), 't1': round(c['t1'], 3)} for c in out], open(os.path.join(sd, 'timing.json'), 'w'))
    _write(sd, name, lang, [(c['t0'], c['t1'], c['text']) for c in out])
    sha = hashlib.sha1(json.dumps(body, ensure_ascii=False).encode('utf-8')).hexdigest()[:16]
    return out, name, lang, sha, sd


def _todo(sd, L, src_lang, out, sha, name):
    todo = {'_cues_sha': sha,
            '_instructions': (f'Translate every value from {LANG_NAME.get(src_lang, src_lang)} into natural, faithful {LANG_NAME.get(L, L)} subtitles. '
                              'One cue = one value, same ids, nothing merged or split. Keep the meaning and hedges exactly (no added facts), '
                              'use the standard spelling of names and places in that language, numbers as digits, ≤ 84 characters per cue when possible. '
                              f'Save the result as out/subtitles/{L}.json (keep "_cues_sha"), then run: xp subtitles')}
    todo.update({str(c['id']): c['text'] for c in out})
    json.dump(todo, open(os.path.join(sd, f'{L}.todo.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def _build_lang(sd, L, out, sha, name, timing):
    p = os.path.join(sd, f'{L}.json')
    if not os.path.exists(p): return 'missing', None
    D = json.load(open(p, encoding='utf-8'))
    if D.get('_cues_sha') not in (None, sha): return 'stale', 'the cues changed since it was translated (re-narrated/re-timed) — translate en.todo.json again'
    miss = [c['id'] for c in timing if not str(D.get(str(c['id'])) or '').strip()]
    if miss: return 'incomplete', f'missing ids {miss[:10]}'
    same = sum(1 for c in out if D[str(c['id'])].strip() == c['text'].strip() and len(c['text']) > 12)
    if same > max(2, len(out) * .2): return 'untranslated', f'{same} cues are identical to the source text'
    _write(sd, name, L, [(c['t0'], c['t1'], D[str(c['id'])].strip()) for c in timing])
    return 'ok', None


def run(vd='.', langs=None, log=print):
    """Returns {lang: status}. Always (re)creates the source-language SRT and the .todo.json for missing translations."""
    out, name, src_lang, sha, sd = cues(vd)
    timing = [{'id': c['id'], 't0': c['t0'], 't1': c['t1']} for c in out]
    want = [x for x in dict.fromkeys(['en'] + list(langs or [])) if x and x != src_lang]
    res = {src_lang: 'ok'}
    for L in want:
        st, msg = _build_lang(sd, L, out, sha, name, timing); res[L] = st
        if st != 'ok': _todo(sd, L, src_lang, out, sha, name)
        elif os.path.exists(os.path.join(sd, f'{L}.todo.json')): os.remove(os.path.join(sd, f'{L}.todo.json'))
        if st == 'ok': log(f'✓ subtitles {L}: out/subtitles/{name}.{L}.srt + .txt' + (f' · ⚠ {msg}' if msg else ''))
        else: log(f'⚠ TRANSLATION NEEDED for {L} subtitles ({st}{": " + msg if msg else ""}) → AI translates out/subtitles/{L}.todo.json → save out/subtitles/{L}.json → re-run `xp subtitles`')
    for f in glob.glob(os.path.join(sd, f'{name}.*.srt')) + glob.glob(os.path.join(sd, f'{name}.*.txt')):   # drop files of languages whose translation is stale/missing
        L = f[len(os.path.join(sd, name)) + 1:-4]
        if res.get(L) not in (None, 'ok'): os.remove(f)
    srts = sorted(glob.glob(os.path.join(sd, f'{name}.*.srt')))
    files = sorted(srts + glob.glob(os.path.join(sd, f'{name}.*.txt')))
    for z in glob.glob(os.path.join(vd, 'out', 'phu-de-*-ngon-ngu.zip')): os.remove(z)
    z = os.path.join(vd, 'out', f'phu-de-{len(srts)}-ngon-ngu.zip')
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as f:
        for s in files: f.write(s, os.path.basename(s))
    log(f'{len(out)} subtitle cues · {len(srts)} languages ({", ".join(os.path.basename(s)[len(name) + 1:-4] for s in srts)}) · SRT + TXT → out/subtitles/ + {os.path.relpath(z, vd)}')
    return res


def main(a, X):
    langs = [x.strip() for x in (a.langs or '').split(',') if x.strip()]
    res = run('.', langs, log=lambda m: X.log(m))
    if a.status and any(v != 'ok' for v in res.values()): sys.exit(3)


if __name__ == '__main__':                                                      # legacy CLI
    cmd, vd, *rest = sys.argv[1:]
    if cmd == 'cues': o = cues(vd); print(f'{len(o[0])} cues · {o[4]}')
    else: run(vd, rest)
