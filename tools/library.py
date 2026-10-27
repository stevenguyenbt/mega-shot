"""mega-shot · voice and music library — turn any audio OR video file the user gives into a cloned narration voice or a background track.

  xp voice add <file> --name <name> --consent [--lang en] [--max 180] [--no-app]
      audio/video → extract audio → VoiceStudio /clean-audio (Demucs vocal isolation, removes music/noise)
      → Whisper word timestamps → pick the best 6–10 s of continuous speech (sentence boundaries, few pauses)
      → .mega-shot/voices/<name>/ref.wav + ref.txt (exact transcript) + meta.json
      → also saved as a clone profile in the VoiceStudio app (unless --no-app) → test sentence thu.wav + match score
      Use in video.yaml: giong: { mau: <name> }
  xp voice list

  xp music add <file> --name <name> [--start 0] [--duration 0] [--license "…"] [--use]
      audio/video → extract stereo audio → trim → loudness −16 LUFS + short fades → .mega-shot/music/<name>.mp3
      → licence note in .mega-shot/music/MUSIC_LICENSES.md; --use sets nhac.file in ./video.yaml or ./loat.yaml
  xp music list

Consent: only clone a voice the user owns or has explicit permission to use (`--consent` confirms it).
Music: the user is responsible for publishing rights; the declared licence is logged.
"""
import json, os, re, shutil, subprocess, sys, tempfile, time, uuid, urllib.request

VS = 'http://127.0.0.1:3900'
TEST_LINE = {'vi': 'Xin chào, đây là giọng đọc thử nghiệm cho video tiếp theo của bạn.',
             'en': 'Hello, this is a quick test of the cloned narration voice for your next video.'}
LANG_NAME = {'vi': 'Vietnamese', 'en': 'English', 'zh': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean', 'fr': 'French', 'es': 'Spanish', 'de': 'German', 'th': 'Thai', 'id': 'Indonesian'}

def _form(fields, files):
    bd = uuid.uuid4().hex; body = b''
    for k, v in fields.items(): body += f'--{bd}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode('utf-8')
    for k, (fn, data) in files.items(): body += f'--{bd}\r\nContent-Disposition: form-data; name="{k}"; filename="{fn}"\r\nContent-Type: audio/wav\r\n\r\n'.encode() + data + b'\r\n'
    return body + f'--{bd}--\r\n'.encode(), f'multipart/form-data; boundary={bd}'

def _vs_up():
    """Start the VoiceStudio backend headless if it is not answering (no app window)."""
    import voicestudio
    if not voicestudio.up(): voicestudio.start(getattr(sys.modules.get('__main__'), 'find_root', lambda d: os.getcwd())('.'))

def _post(path, fields, files, timeout=1800):
    body, ct = _form(fields, files)
    _vs_up()
    return urllib.request.urlopen(urllib.request.Request(VS + path, body, {'Content-Type': ct}), timeout=timeout).read()

def _probe(X, path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type:format=duration', '-of', 'json', path], capture_output=True, text=True)
    if r.returncode: X.die(f'cannot read {path}')
    j = json.loads(r.stdout); kinds = [s['codec_type'] for s in j.get('streams', [])]
    if 'audio' not in kinds: X.die(f'{path} has no audio track')
    return ('video' if 'video' in kinds else 'audio'), float(j.get('format', {}).get('duration') or 0)

def _transcribe(path, lang=None):
    f = {'model': 'whisper-1', 'response_format': 'verbose_json', 'timestamp_granularities[]': 'word'}
    if lang: f['language'] = lang
    try: open(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))), '.mega-shot', 'voicestudio', 'asr_tren_gpu'), 'w').write('library')   # see xp.asr_dau
    except Exception: pass
    r = json.loads(_post('/v1/audio/transcriptions', f, {'file': ('a.wav', open(path, 'rb').read())}))
    return r.get('text', '').strip(), [(w['word'].strip(), float(w['start']), float(w['end'])) for w in r.get('words') or [] if w['word'].strip()], (r.get('language') or lang or '')[:2]

def _best_window(words, lo=5.5, hi=10.0, ideal=8.5):
    """Best stretch of continuous speech: starts after a pause/sentence end, ends at a sentence end/pause, few internal gaps."""
    best, n = None, len(words)
    for i in range(n):
        start_ok = i == 0 or words[i][1] - words[i - 1][2] >= .25 or re.search(r'[.!?…。！？]$', words[i - 1][0])
        if not start_ok: continue
        for j in range(i, n):
            dur = words[j][2] - words[i][1]
            if dur > hi: break
            if dur < lo: continue
            end_ok = j == n - 1 or words[j + 1][1] - words[j][2] >= .25 or re.search(r'[.!?…。！？,]$', words[j][0])
            if not end_ok: continue
            gaps = [words[k + 1][1] - words[k][2] for k in range(i, j)]
            speech = sum(w[2] - w[1] for w in words[i:j + 1]) / dur
            score = -abs(dur - ideal) + 2 * bool(re.search(r'[.!?…。！？]$', words[j][0])) + 3 * speech - 4 * max([0] + [g - .7 for g in gaps if g > .7])
            if not best or score > best[0]: best = (score, i, j)
    return best

def _ffmpeg(*args): subprocess.run(['ffmpeg', '-v', 'error', '-y', *args], check=True)

def _speech_windows(path, lo=5.5, hi=10.0, ideal=8.5):
    """Candidate 5.5–10 s stretches of continuous speech, found with ffmpeg silencedetect (no transcription of the whole file:
    VoiceStudio's Whisper runs ~4× slower than real time and times out after 5 min). Best first."""
    total = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True).stdout.strip() or 0)
    best_runs = []
    for noise in (-35, -30, -40):                                                   # try a few thresholds: quiet rooms vs noisy sources
        err = subprocess.run(['ffmpeg', '-v', 'info', '-i', path, '-af', f'silencedetect=noise={noise}dB:d=0.28', '-f', 'null', '-'], capture_output=True, text=True, errors='replace').stderr
        starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', err)]; ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', err)]
        sil = list(zip(starts, ends + [total] * (len(starts) - len(ends))))
        edges = [0.0] + [e for _, e in sil]; stops = [st for st, _ in sil] + [total]
        speech = [(a, b) for a, b in zip(edges, stops) if b - a > .15]          # speech segments between silences
        cand = []
        for i in range(len(speech)):                                             # windows = consecutive segments; internal pauses are the silences between them
            for j in range(i, len(speech)):
                d = speech[j][1] - speech[i][0]
                if d > hi: break
                if d < lo: continue
                talk = sum(b - a for a, b in speech[i:j + 1]) / d
                pauses = [speech[k + 1][0] - speech[k][1] for k in range(i, j)]
                cand.append((-abs(d - ideal) + 4 * talk - 3 * max([0] + [g - .6 for g in pauses if g > .6]), speech[i][0], speech[j][1]))
        if cand: best_runs = sorted(cand, reverse=True); break
    return best_runs

ARCHETYPES = {'documentarian': 'feat_01_the_documentarian', 'storyteller': 'feat_03_the_storyteller', 'anchor': 'feat_16_the_anchor',
              'librarian': 'feat_00_the_librarian', 'calm-guide': 'feat_02_the_calm_guide', 'explainer': 'feat_23_the_explainer', 'teacher': 'feat_22_the_teacher'}

def voice_from_archetype(a, X, root):
    """Built-in VoiceStudio narrator (synthetic, no consent needed): download its preview + script as the reference sample."""
    aid = ARCHETYPES.get(a.archetype, a.archetype); name = a.name or a.archetype
    vd = os.path.join(root, '.mega-shot', 'voices', name)
    if os.path.exists(os.path.join(vd, 'ref.wav')) and not a.force: X.die(f'voice "{name}" already exists — use --force to replace it')
    X.vs_ensure(root)
    try: info = json.loads(urllib.request.urlopen(f'{VS}/archetypes/{aid}', timeout=15).read())
    except Exception as e: X.die(f'VoiceStudio archetype "{aid}" not available ({e}) — known: {", ".join(ARCHETYPES)}; is VoiceStudio running? (xp setup)')
    X.log(f"archetype {info.get('name')} · {info.get('instruct')} — rendering its preview (first time can take a minute)…")
    wav = urllib.request.urlopen(f'{VS}/archetypes/{aid}/preview', timeout=600).read()
    os.makedirs(vd, exist_ok=True); open(os.path.join(vd, 'ref.wav'), 'wb').write(wav)
    open(os.path.join(vd, 'ref.txt'), 'w', encoding='utf-8').write(info.get('sample_script', '').strip() + '\n')
    lang = {'English': 'en'}.get(info.get('language'), (info.get('language') or 'en')[:2].lower())
    json.dump({'name': name, 'source': f'VoiceStudio archetype {aid}', 'language': lang, 'created': time.strftime('%Y-%m-%d %H:%M'), 'consent': 'synthetic built-in voice'},
              open(os.path.join(vd, 'meta.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    X.log(f'✓ voice "{name}" ready ({lang}) — use it: giong: {{ mau: {name} }}')

def voice_add(a, X, root):
    if getattr(a, 'archetype', None): return voice_from_archetype(a, X, root)
    if not a.consent:
        X.die('voice cloning needs consent: clone only your own voice or one you have explicit permission to use. Ask the user, then re-run with --consent')
    if not os.path.exists(a.file): X.die(f'file not found: {a.file}')
    name = re.sub(r'[^a-z0-9_-]+', '-', (a.name or os.path.splitext(os.path.basename(a.file))[0]).lower()).strip('-')
    vd = os.path.join(root, '.mega-shot', 'voices', name)
    if os.path.exists(os.path.join(vd, 'ref.wav')) and not a.force: X.die(f'voice "{name}" already exists — choose another --name or add --force')
    kind, dur = _probe(X, a.file); X.log(f'input: {kind}, {dur:.0f}s')
    if not X.vs_ensure(root): X.die('VoiceStudio API is not available on :3900 — see .mega-shot/voicestudio/backend.log or run `xp voicestudio restart`')
    tmp = tempfile.mkdtemp(); raw = os.path.join(tmp, 'raw.wav'); clean = os.path.join(tmp, 'clean.wav')
    _ffmpeg('-i', a.file, '-vn', '-t', str(a.max), '-ac', '1', '-ar', '44100', raw)          # video → its audio track; long files: first --max seconds
    X.log('isolating the voice (VoiceStudio /clean-audio, Demucs)…'); t = time.time()
    try: open(clean, 'wb').write(_post('/clean-audio', {}, {'audio': ('raw.wav', open(raw, 'rb').read())})); X.log(f'  done in {time.time() - t:.0f}s')
    except Exception as e:
        X.log(f'  /clean-audio failed ({e}) — using a simple denoise instead'); _ffmpeg('-i', raw, '-af', 'highpass=f=80,afftdn=nf=-25', clean)
    X.log('finding the best 6–10 s of clear speech…')
    wins = _speech_windows(clean)
    if not wins: X.die('no 5.5–10 s stretch of continuous speech — give a cleaner recording (≥ 15 s, one speaker, no music over the voice, few long pauses)')
    lang = a.lang
    _, s0, s1 = wins[0]; s0, s1 = max(0, s0 - .1), s1 + .15
    os.makedirs(vd, exist_ok=True); ref = os.path.join(vd, 'ref.wav')
    _ffmpeg('-ss', f'{s0:.3f}', '-to', f'{s1:.3f}', '-i', clean, '-af', f'afade=t=in:d=0.02,afade=t=out:st={s1 - s0 - .03:.3f}:d=0.03,loudnorm=I=-18:TP=-2', '-ar', '44100', '-ac', '1', '-sample_fmt', 's16', ref)
    try: rt, wds, lang2 = _transcribe(ref, lang or None)                         # transcript of the exact clip only (must match the audio word for word)
    except Exception as e: X.die(f'VoiceStudio transcription failed ({str(e)[:80]}) — retry; if it repeats, restart VoiceStudio (`xp setup`)')
    lang = lang or lang2 or 'en'
    if len(wds) < 6: X.die('the chosen clip has too few words — the source may be mostly music or noise; give a cleaner recording')
    open(os.path.join(vd, 'ref.txt'), 'w', encoding='utf-8').write(rt + '\n')
    meta = {'name': name, 'source': os.path.abspath(a.file), 'source_kind': kind, 'segment': [round(s0, 2), round(s1, 2)], 'seconds': round(s1 - s0, 2),
            'language': lang, 'created': time.strftime('%Y-%m-%d %H:%M'), 'consent': 'confirmed by the user (--consent)'}
    X.log(f'reference: {s1 - s0:.1f}s from {s0:.1f}s · language {lang} · "{rt[:80]}"')
    if not a.no_app:                                                              # visible in the VoiceStudio app as a clone profile
        try:
            r = json.loads(_post('/profiles', {'name': f'mega-shot · {name}', 'ref_text': rt, 'language': LANG_NAME.get(lang, lang), 'kind': 'clone'}, {'ref_audio': ('ref.wav', open(ref, 'rb').read())}))
            meta['voicestudio_profile'] = r.get('id') or (r.get('profile') or {}).get('id'); X.log(f'  saved in VoiceStudio as "mega-shot · {name}"')
        except Exception as e: X.log(f'  (could not create the VoiceStudio profile: {str(e)[:80]} — the voice still works in mega-shot)')
    line = TEST_LINE.get(lang, TEST_LINE['en']); X.log('test sentence…')
    wav = _post('/generate', {'text': line, 'language': LANG_NAME.get(lang, lang), 'ref_text': rt, 'seed': '1234', 'num_step': '16'}, {'ref_audio': ('ref.wav', open(ref, 'rb').read())})
    test = os.path.join(vd, 'thu.wav'); open(test, 'wb').write(wav)
    heard, _, _ = _transcribe(test, lang)
    import difflib; norm = lambda s: re.sub(r'[\W_]+', ' ', s.lower()).split()
    match = difflib.SequenceMatcher(None, norm(line), norm(heard)).ratio(); meta['test_match'] = round(match, 2)
    json.dump(meta, open(os.path.join(vd, 'meta.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    shutil.rmtree(tmp, ignore_errors=True)
    for pr in ref_check(ref): X.log(f'⚠ voice sample: {pr} — give a cleaner file (one speaker, no music, ≥ 15 s continuous)')
    X.log(f'✓ voice "{name}" ready · test match {match:.0%} · listen: {test}')
    X.log(f'  use it: giong: {{ mau: {name} }}   (in video.yaml or loat.yaml)')
    if match < .8: X.log('⚠ low test match — listen to thu.wav; a cleaner source (one speaker, no music, no echo) gives a better clone')

def ref_check(path):
    """quality of a reference sample → list of problems (empty = clean). A noisy / music-backed / spliced / clipped sample makes
    every generated line carry noise and odd breath or "hit" sounds at sentence ends."""
    import numpy as np, wave
    with wave.open(path) as w: sr, ch = w.getframerate(), w.getnchannels(); x = np.frombuffer(w.readframes(w.getnframes()), '<i2').reshape(-1, ch)[:, 0].astype(np.float32) / 32768
    fr = int(sr * .05); db = np.array([20 * np.log10(np.sqrt(np.mean(x[i:i + fr] ** 2)) + 1e-9) for i in range(0, len(x) - fr, fr)])
    speech, floor = np.percentile(db, 80), np.percentile(db[db > -150], 5) if (db > -150).any() else -99
    P = []
    if speech - floor < 25: P.append(f'loud background (floor {floor:.0f} dB, voice {speech:.0f} dB — need a gap of ≥ 25 dB): music/noise would be cloned along with the voice')
    if (db < -120).sum() >= 2 and ((db[:-2] < -120) & (db[2:] > speech - 15)).any(): P.append('hard splice (absolute silence, then sound straight away): the sample was joined from several pieces')
    if db[-1] > speech - 15: P.append('ends while the voice is still loud (cut mid-word): the model learns to end sentences abruptly')
    if len(x) / sr < 5: P.append(f'too short ({len(x) / sr:.1f}s, should be 6–10 s continuous)')
    return P

def voice_check(a, X, root):
    names = [a.file] if a.file else sorted(d for d in os.listdir(os.path.join(root, '.mega-shot', 'voices')) if os.path.exists(os.path.join(root, '.mega-shot', 'voices', d, 'ref.wav')))
    for n in names:
        P = ref_check(os.path.join(root, '.mega-shot', 'voices', n, 'ref.wav'))
        X.log(f"{'✓' if not P else '⚠'} {n}" + ('' if not P else ': ' + ' · '.join(P)))

def voice_list(a, X, root):
    for d in sorted(os.listdir(os.path.join(root, '.mega-shot', 'voices'))):
        p = os.path.join(root, '.mega-shot', 'voices', d)
        if not os.path.exists(os.path.join(p, 'ref.wav')): continue
        m = json.load(open(os.path.join(p, 'meta.json'), encoding='utf-8')) if os.path.exists(os.path.join(p, 'meta.json')) else {}
        txt = open(os.path.join(p, 'ref.txt'), encoding='utf-8').read().strip() if os.path.exists(os.path.join(p, 'ref.txt')) else ''
        print(f" {d:<16} {m.get('language', '?'):<3} {m.get('seconds', '')!s:<6} \"{txt[:60]}\"")

def _set_music(X, path):
    y = 'loat.yaml' if os.path.exists('loat.yaml') else 'video.yaml' if os.path.exists('video.yaml') else None
    if not y: X.log('(no video.yaml / loat.yaml here — add it yourself: music: { file: ' + path + ' })'); return
    s = open(y, encoding='utf-8').read()
    en = bool(re.search(r'^(scenes|episodes|name):', s, re.M))                     # file written with English keys → write English keys
    blk = f'music: {{ file: {path}, volume: 0.6, duck: true }}' if en else f'nhac: {{ file: {path}, am_luong: 0.6, tu_ha: true }}'
    m = re.search(r'^(nhac|music):.*$', s, re.M)
    if m and 'file:' in m.group(0): s = s[:m.start()] + re.sub(r'file:\s*[^,}]+', 'file: ' + path, m.group(0), count=1) + s[m.end():]
    elif m: s = s[:m.start()] + blk + s[m.end():]
    else:
        anchor = next((x for x in ('\nscenes:', '\ncanh:', '\nepisodes:', '\ntap:') if x in s), None)
        s = s.replace(anchor, '\n' + blk + anchor, 1) if anchor else s + '\n' + blk + '\n'
    open(y, 'w', encoding='utf-8').write(s); X.log(f'  {y}: music file = {path}')

def music_add(a, X, root):
    if not os.path.exists(a.file): X.die(f'file not found: {a.file}')
    kind, dur = _probe(X, a.file)
    name = re.sub(r'[^a-z0-9_-]+', '-', (a.name or os.path.splitext(os.path.basename(a.file))[0]).lower()).strip('-')
    md = os.path.join(root, '.mega-shot', 'music'); os.makedirs(md, exist_ok=True); out = os.path.join(md, name + '.mp3')
    length = (a.duration or max(0, dur - a.start))
    trim = ['-ss', str(a.start)] + (['-t', str(a.duration)] if a.duration else [])
    fo = max(0, length - 2.5)
    _ffmpeg(*trim, '-i', a.file, '-vn', '-ac', '2', '-ar', '48000', '-af', f'loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=in:d=1,afade=t=out:st={fo:.2f}:d=2.5', '-c:a', 'libmp3lame', '-b:a', '256k', out)
    lic = a.license or 'user-provided — the user is responsible for publishing rights'
    with open(os.path.join(md, 'MUSIC_LICENSES.md'), 'a', encoding='utf-8') as fh:
        fh.write(f"- {time.strftime('%Y-%m-%d')} · {name}.mp3 · from {os.path.basename(a.file)} ({kind}, {a.start:.0f}s +{length:.0f}s) · licence: {lic}\n")
    p = out.replace(chr(92), '/'); X.log(f'✓ music "{name}" · {length:.0f}s · −16 LUFS → {p}')
    if a.use: _set_music(X, p)
    else: X.log(f'  use it: nhac: {{ file: {p}, am_luong: 0.6, tu_ha: true }}   (or re-run with --use)')

def music_list(a, X, root):
    md = os.path.join(root, '.mega-shot', 'music')
    for f in sorted(os.listdir(md)) if os.path.isdir(md) else []:
        if f.endswith('.mp3'):
            d = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', os.path.join(md, f)], capture_output=True, text=True).stdout.strip()
            print(f" {f[:-4]:<24} {float(d or 0):6.0f}s  {os.path.join(md, f)}")

def main(a, X):
    root = X.find_root('.')
    if not os.path.isdir(os.path.join(root, '.mega-shot')):                     # outside the project: use the project that contains this skill
        root = os.path.dirname(os.path.dirname(os.path.dirname(X.SKILL)))
    if a.cmd == 'music':
        a.file = (a.files or [None])[0]
        if a.action in ('brief', 'check'): import musicqa; return musicqa.main(a, X, root)
    {('voice', 'add'): voice_add, ('voice', 'list'): voice_list, ('voice', 'check'): voice_check, ('music', 'add'): music_add, ('music', 'list'): music_list}[(a.cmd, a.action)](a, X, root)
