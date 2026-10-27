"""mega-shot · background-music finder + quality check (Pixabay Music workflow).

  xp music brief                    read ./video.yaml → music brief (mood, genre, BPM, length, no vocals) + Pixabay Music search links
                                    → build/music/brief.md. The AI opens the links in the browser pane, shortlists tracks,
                                    the USER listens and clicks Download on the ones they like (Pixabay has no music API).
  xp music check [files…]           quality-check audio files (default: audio in ~/Downloads from the last 24 h)
        [--hours 24] [--no-vocals-check]
                                    → score 0–100 per track, energy chart, 30 s preview clips, best section to use,
                                      build/music/listen.html (play + compare). Then:
  xp music add <file> --name bg --license "Pixabay Content License · <track URL>" --use [--start s --duration s]

Checks: length vs video, loudness (LUFS), true peak / clipping, silence at the start, dips/lulls in the middle (the track
"drops out" under the narration), dynamics (LRA), energy steadiness, tempo (BPM), noise/field-recording detection
(spectral flatness) and SUNG VOCALS (VoiceStudio Demucs) — vocals fight the narration, so they are penalised hard.
"""
import glob, io, json, math, os, re, subprocess, time, urllib.parse

AUDIO = ('.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac', '.opus', '.webm')

def _dec(path, sr=22050, start=0, dur=None):
    import numpy as np
    cmd = ['ffmpeg', '-v', 'error', '-ss', str(start)] + (['-t', str(dur)] if dur else []) + ['-i', path, '-ac', '1', '-ar', str(sr), '-f', 'f32le', '-']
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, dtype=np.float32)

def _ebur(path):
    lo = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace').stderr
    g = lambda k: (re.findall(k + r':\s+(-?[\d.]+|-inf)', lo) or ['nan'])[-1]
    f = lambda v: float(v) if v not in ('nan', '-inf') else -99.0
    return f(g('I')), f(g('LRA')), f(g('Peak'))

def _bpm(x, sr):
    import numpy as np
    hop = 512; n = len(x) // hop
    if n < 64: return 0, 0
    fr = x[:n * hop].reshape(n, hop); e = np.sqrt((fr ** 2).mean(1) + 1e-12); flux = np.maximum(0, np.diff(np.log(e)))
    flux = flux - flux.mean(); ac = np.correlate(flux, flux, 'full')[len(flux) - 1:]; fps = sr / hop
    lags = np.arange(len(ac)); bpm = 60 * fps / np.maximum(lags, 1); m = (bpm >= 60) & (bpm <= 180)
    if not m.any(): return 0, 0
    k = lags[m][np.argmax(ac[m])]; strength = float(ac[k] / (ac[0] + 1e-9))
    return round(60 * fps / k), round(strength, 2)

def _flatness(x, sr):
    import numpy as np
    seg = x[: sr * 60]; n = 2048; frames = [seg[i:i + n] for i in range(0, len(seg) - n, n * 4)]
    if not frames: return 0
    S = np.abs(np.fft.rfft(np.array(frames) * np.hanning(n), axis=1)) + 1e-9
    return float(np.mean(np.exp(np.mean(np.log(S), 1)) / np.mean(S, 1)))

def _vocals(path, start, X):
    """Share of sung voice in a 40 s excerpt via VoiceStudio /clean-audio (Demucs vocal stem). None if VoiceStudio is unavailable."""
    import numpy as np, tempfile
    import library
    tmp = tempfile.mkdtemp(prefix='voc-'); ex = os.path.join(tmp, 'ex.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(start), '-t', '40', '-i', path, '-ac', '1', '-ar', '44100', ex], check=True)
    try:
        with X.KhoaGiong(X.find_root('.')): voc = library._post('/clean-audio', {}, {'audio': ('ex.wav', open(ex, 'rb').read())}, timeout=600)
    except Exception as e: X.log(f'  (vocal check skipped: {e})'); return None
    vp = os.path.join(tmp, 'voc.wav'); open(vp, 'wb').write(voc)
    a, v = _dec(ex), _dec(vp); n = min(len(a), len(v))
    if not n: return None
    r = float(np.sqrt((v[:n] ** 2).mean()) / (np.sqrt((a[:n] ** 2).mean()) + 1e-9))
    return round(r, 2)

def analyse(path, need, X, vocals=True):
    import numpy as np
    sr = 22050; x = _dec(path, sr); dur = len(x) / sr
    I, LRA, TP = _ebur(path); clip = float((np.abs(x) > .995).mean())
    win = int(sr * .5); n = len(x) // win; rms = 20 * np.log10(np.sqrt((x[:n * win].reshape(n, win) ** 2).mean(1)) + 1e-7)
    med = float(np.median(rms)) if n else -60
    lead = next((i * .5 for i, v in enumerate(rms) if v > med - 25), 0)
    body = [(i * .5, float(v)) for i, v in enumerate(rms) if 3 <= i * .5 <= dur - 6]
    lulls, cur = [], None                                                          # stretches ≥ 1 s more than 8 dB below the median (the music "drops out")
    for t, v in body:
        if v < med - 8: cur = cur or [t, t]; cur[1] = t + .5
        else:
            if cur and cur[1] - cur[0] >= 1.0: lulls.append([round(cur[0], 1), round(cur[1], 1)])
            cur = None
    sm = np.convolve(rms, np.ones(4) / 4, 'same') if n > 4 else rms; steady = float(np.std(sm[6:-12])) if n > 30 else 0
    bpm, beat = _bpm(x, sr); flat = _flatness(x, sr)
    # best section: the longest window without lulls (for nhac.tu / nhac.den)
    cuts = [0] + [v for l in lulls for v in l] + [dur]; segs = [(cuts[i], cuts[i + 1]) for i in range(0, len(cuts) - 1, 2)]
    best = max(segs, key=lambda s: s[1] - s[0]) if segs else (0, dur)
    voc = _vocals(path, min(max(0, dur * .3), max(0, dur - 40)), X) if vocals else None
    # score
    s, why = 100, []
    if dur < need * .6: s -= 25; why.append(f'short ({dur:.0f}s for a {need:.0f}s video: will loop)')
    elif dur < need: s -= 8; why.append(f'{dur:.0f}s < video {need:.0f}s (one crossfaded loop)')
    if lulls: s -= min(30, 12 * len(lulls)); why.append(f'{len(lulls)} dip(s) at ' + ', '.join(f'{a:.0f}–{b:.0f}s' for a, b in lulls[:3]))
    if lead > 2: s -= 6; why.append(f'{lead:.1f}s silent intro')
    if clip > .001 or TP > -.1: s -= 10; why.append(f'clipping (peak {TP:.1f} dBTP)')
    if flat > .3: s -= 25; why.append(f'noise-like (flatness {flat:.2f}: field recording/ambience?)')
    if steady > 6: s -= 10; why.append(f'uneven energy (σ {steady:.1f} dB)')
    if LRA > 14: s -= 6; why.append(f'very dynamic (LRA {LRA:.0f} LU: quiet parts vanish under the voice)')
    if voc is not None and voc > .35: s -= 40; why.append(f'SUNG VOCALS ({voc:.2f}): clashes with narration')
    elif voc is not None and voc > .2: s -= 15; why.append(f'some vocal/choir content ({voc:.2f})')
    return {'file': path, 'name': os.path.basename(path), 'dur': round(dur, 1), 'lufs': I, 'lra': LRA, 'peak': TP, 'clip': round(clip, 5), 'intro_silence': lead,
            'lulls': lulls, 'steadiness_db': round(steady, 1), 'bpm': bpm, 'beat': beat, 'flatness': round(flat, 3), 'vocals': voc,
            'best': [round(best[0], 1), round(best[1], 1)], 'score': max(0, s), 'notes': why, 'energy': [round(float(v), 1) for v in sm[::2]]}

def _chart(r, out):
    from PIL import Image, ImageDraw
    W, H = 900, 140; im = Image.new('RGB', (W, H), (18, 20, 28)); d = ImageDraw.Draw(im); e = r['energy']
    if not e: im.save(out); return
    lo, hi = min(e), max(e); xs = lambda i: i / max(1, len(e) - 1) * (W - 20) + 10; ys = lambda v: H - 15 - (v - lo) / max(1e-6, hi - lo) * (H - 30)
    for a, b in r['lulls']: x0, x1 = a / r['dur'] * (W - 20) + 10, b / r['dur'] * (W - 20) + 10; d.rectangle([x0, 0, x1, H], fill=(90, 30, 35))
    bx0, bx1 = r['best'][0] / r['dur'] * (W - 20) + 10, r['best'][1] / r['dur'] * (W - 20) + 10; d.rectangle([bx0, H - 8, bx1, H - 3], fill=(90, 200, 120))
    d.line([(xs(i), ys(v)) for i, v in enumerate(e)], fill=(255, 196, 106), width=2); im.save(out)

def _card(r, rank, out_png, chart_png):
    """1080×1080 card for phone previews: name, score, key facts, energy chart."""
    from PIL import Image, ImageDraw, ImageFont
    W = 1080; im = Image.new('RGB', (W, W), (16, 18, 26)); d = ImageDraw.Draw(im)
    def F(sz):
        for f in ('C:/Windows/Fonts/segoeuib.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'):
            if os.path.exists(f): return ImageFont.truetype(f, sz)
        return ImageFont.load_default()
    col = (46, 125, 79) if r['score'] >= 75 else (154, 107, 31) if r['score'] >= 50 else (138, 47, 47)
    d.rounded_rectangle([60, 70, 330, 190], 24, fill=col); d.text((195, 130), f"{r['score']}/100", font=F(64), fill='white', anchor='mm')
    d.text((370, 95), f"#{rank}", font=F(44), fill=(255, 196, 106)); d.text((60, 240), r['name'][:38], font=F(52), fill='white')
    facts = f"{r['dur']:.0f}s · {r['bpm'] or '?'} BPM · {r['lufs']:.1f} LUFS" + (f" · vocals {r['vocals']}" if r['vocals'] is not None else '')
    d.text((60, 320), facts, font=F(36), fill=(170, 175, 190))
    y = 390
    for n in (r['notes'] or ['✓ no issues found'])[:4]: d.text((60, y), '• ' + n[:60], font=F(32), fill=(255, 207, 138)); y += 48
    ch = Image.open(chart_png).resize((960, 150)); im.paste(ch, (60, 640))
    d.text((60, 820), f"best part {r['best'][0]:.0f}–{r['best'][1]:.0f}s · preview = 30 s" + (' + narration' if r.get('voice_mix') else ''), font=F(34), fill=(140, 200, 230))
    im.save(out_png)

def _voice_bed(dur=30):
    """First `dur` s of the video's narration (scene voice clips at their timeline positions) → wav, or None."""
    if not os.path.exists('build/timeline.json'): return None
    tl = json.load(open('build/timeline.json', encoding='utf-8')); ins, fc, n = [], '', 0
    for sc in tl['scenes']:
        v = sc.get('voice')
        if not v or v['t0'] >= dur or not os.path.exists(v['file']): continue
        ms = int(v['t0'] * 1000); ins += ['-i', v['file']]; fc += f'[{n}]adelay={ms}|{ms}[v{n}];'; n += 1
    if not n: return None
    out = os.path.join('build', 'music', '_voice30.wav')
    fc += ''.join(f'[v{i}]' for i in range(n)) + f'amix=inputs={n}:normalize=0,apad=whole_dur={dur},atrim=0:{dur},aformat=sample_rates=48000:channel_layouts=stereo[o]'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex', fc, '-map', '[o]', out], check=True); return out

def check(a, X, root):
    files = [f for f in (a.files or []) if f]
    if not files:
        dl = os.path.join(os.path.expanduser('~'), 'Downloads'); cut = time.time() - a.hours * 3600
        files = sorted([p for p in glob.glob(os.path.join(dl, '*')) if p.lower().endswith(AUDIO) and os.path.getmtime(p) >= cut], key=os.path.getmtime, reverse=True)
        if not files: X.die(f'no audio files in {dl} from the last {a.hours:.0f} h — download tracks first (xp music brief), or pass file paths')
    need = 90.0
    if os.path.exists('build/timeline.json'): need = json.load(open('build/timeline.json', encoding='utf-8'))['dur']
    out = os.path.join('build', 'music') if os.path.exists('video.yaml') or os.path.exists('loat.yaml') else os.path.join(root, '.mega-shot', 'music', 'check')
    os.makedirs(out, exist_ok=True); res = []
    for f in files:
        X.log(f'checking {os.path.basename(f)}…'); r = analyse(f, need, X, vocals=not a.no_vocals_check); res.append(r)
        slug = re.sub(r'[^a-z0-9]+', '-', os.path.splitext(r['name'])[0].lower()).strip('-')[:40]; r['slug'] = slug
        _chart(r, os.path.join(out, slug + '.png')); r['rank_png'] = os.path.join(out, slug + '.png')
        st = r['best'][0] + max(0, (r['best'][1] - r['best'][0]) * .25)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(st), '-t', '30', '-i', f, '-af', 'afade=t=in:d=1,afade=t=out:st=28:d=2', '-b:a', '160k', os.path.join(out, slug + '_30s.mp3')], check=True)
        X.log(f"  {r['score']:>3}/100 · {r['dur']:.0f}s · {r['bpm'] or '?'} BPM · {r['lufs']:.1f} LUFS" + (f" · vocals {r['vocals']}" if r['vocals'] is not None else '') + (' · ' + '; '.join(r['notes']) if r['notes'] else ' · clean'))
    res.sort(key=lambda r: -r['score'])
    if a.phone:                                                                   # phone previews to send in chat: card + 30 s (music alone, or mixed under the real narration)
        bed = _voice_bed(30); vol = 0.6
        for i, r in enumerate(res, 1):
            card = os.path.join(out, r['slug'] + '_card.png'); r['voice_mix'] = bool(bed); _card(r, i, card, r['rank_png'])
            clip = os.path.join(out, r['slug'] + '_30s.mp3'); mp4 = os.path.join(out, f"{i:02d}_{r['slug']}_preview.mp4")
            if bed: af = ['-i', bed, '-filter_complex', f'[1:a]volume={vol}[m];[2:a]volume=0.55,asplit[v][sc];[m][sc]sidechaincompress=threshold=0.04:ratio=2.5:attack=40:release=600[md];[v][md]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5[a]', '-map', '0:v', '-map', '[a]']
            else: af = ['-map', '0:v', '-map', '1:a']
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', '2', '-i', card, '-i', clip, *af, '-t', '30', '-c:v', 'libx264', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', mp4], check=True)
            r['phone_preview'] = mp4; X.log(f'  phone preview: {mp4}')
    json.dump(res, open(os.path.join(out, 'check.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    rows = ''.join(f"""<div class=t><div class=h><b>{i + 1}. {r['name']}</b><span class=s style="background:{'#2e7d4f' if r['score'] >= 75 else '#9a6b1f' if r['score'] >= 50 else '#8a2f2f'}">{r['score']}/100</span></div>
      <div class=m>{r['dur']:.0f}s · {r['bpm'] or '?'} BPM · {r['lufs']:.1f} LUFS · LRA {r['lra']:.0f} · peak {r['peak']:.1f} dBTP{' · vocals ' + str(r['vocals']) if r['vocals'] is not None else ''} · best part {r['best'][0]:.0f}–{r['best'][1]:.0f}s</div>
      <div class=n>{'; '.join(r['notes']) or '✓ no issues found'}</div><img src="{r['slug']}.png"><div class=p>30 s preview <audio controls preload=none src="{r['slug']}_30s.mp3"></audio> · full <audio controls preload=none src="{urllib.parse.quote('file:///' + r['file'].replace(os.sep, '/'), safe=':/')}"></audio></div>
      <code>xp music add "{r['file']}" --name bg --start {r['best'][0]:.0f} --duration {r['best'][1] - r['best'][0]:.0f} --license "Pixabay Content License · &lt;track URL&gt;" --use</code></div>""" for i, r in enumerate(res))
    html = f"""<!doctype html><meta charset=utf-8><title>Music check</title><style>body{{font:15px system-ui;background:#0e1016;color:#e8e8ee;max-width:960px;margin:24px auto}}.t{{background:#181b24;border-radius:12px;padding:14px;margin:12px 0}}
.h{{display:flex;justify-content:space-between;font-size:17px}}.s{{padding:2px 10px;border-radius:10px}}.m{{color:#aab;margin:6px 0}}.n{{color:#ffcf8a}}img{{width:100%;border-radius:6px;margin:8px 0}}code{{display:block;font-size:12px;color:#9cd;white-space:pre-wrap}}</style>
<h2>Background music check · video {need:.0f}s</h2><p>Red = dips where the music drops out · green bar = best continuous section · higher score = safer under narration.</p>{rows}"""
    io.open(os.path.join(out, 'listen.html'), 'w', encoding='utf-8').write(html)
    X.log(f'✓ {os.path.join(out, "listen.html")} · best: {res[0]["name"]} ({res[0]["score"]}/100)')

MOODS = [  # (keywords in script/style → Pixabay search terms, bpm range)
    (r'động lực|motivat|kỷ luật|discipline|thành công|success', ['motivational cinematic', 'inspiring epic', 'uplifting background'], (90, 130)),
    (r'vũ trụ|space|galaxy|đa vũ trụ|ý thức|cosmic', ['space ambient', 'cinematic ambient', 'documentary atmospheric'], (60, 95)),
    (r'lịch sử|history|cổ đại|ancient|đế chế|empire|kingdom', ['documentary history', 'epic orchestral', 'ancient world'], (70, 110)),
    (r'núi lửa|volcano|thảm hoạ|disaster|đáng sợ|danger', ['dark cinematic tension', 'epic suspense', 'dramatic trailer'], (70, 120)),
    (r'đại dương|ocean|biển|underwater|deep sea', ['underwater ambient', 'mysterious documentary', 'calm cinematic'], (60, 95)),
    (r'hài|funny|vui|cartoon|hoạt hình|puppet', ['quirky playful', 'funny cartoon background', 'light comedy'], (95, 130)),
    (r'khoa học|science|công nghệ|tech|explainer', ['corporate technology', 'curious science', 'light documentary'], (90, 120)),
]

def brief(a, X, root):
    import yaml
    y = 'video.yaml' if os.path.exists('video.yaml') else 'loat.yaml'
    if not os.path.exists(y): X.die('run inside a video folder (video.yaml) — or use: xp music check <files>')
    import sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import yaml_keys
    s = yaml.safe_load(open(y, encoding='utf-8')); s = yaml_keys.normalize_series(s) if os.path.basename(y) == 'loat.yaml' else yaml_keys.normalize(s); text = (json.dumps(s.get('phong_cach', {}), ensure_ascii=False) + ' ' + ' '.join(str(c.get('loi', '')) for c in s.get('canh', [])) + ' ' + str(s.get('ten', ''))).lower()
    style = json.dumps(s.get('phong_cach', {}), ensure_ascii=False).lower() + ' ' + str(s.get('ten', ''))
    rank = sorted(((len(re.findall(rx, text)) + 5 * len(re.findall(rx, style)), q, b) for rx, q, b in MOODS), key=lambda r: -r[0])   # visual style counts most (cartoon → playful)
    found = [(q, b) for n, q, b in rank if n > 0][:2] or [(['cinematic background', 'documentary background', 'inspiring ambient'], (80, 115))]
    terms = [t for q, _ in found for t in q][:5]; bpm = found[0][1]
    dur = json.load(open('build/timeline.json', encoding='utf-8'))['dur'] if os.path.exists('build/timeline.json') else None
    os.makedirs('build/music', exist_ok=True)
    links = [f'https://pixabay.com/music/search/{urllib.parse.quote(t)}/' for t in terms]
    md = [f'# Music brief · {s.get("ten", "")}', '', f'- **Length:** ≥ {dur:.0f} s (or a loopable track ≥ {dur * .6:.0f} s)' if dur else '- **Length:** ≥ 90 s',
          f'- **Tempo:** about {bpm[0]}–{bpm[1]} BPM', '- **No sung vocals / lyrics** (they fight the narration). Instrumental only.',
          '- **Steady energy**, no long breaks or silent drops in the middle, no big drop/outro before the end of the video.',
          '- **Mood keywords:** ' + ', '.join(terms), '', '## Pixabay Music searches (open in the browser pane; the user listens and clicks Download)', ''] + [f'- [{t}]({u})' for t, u in zip(terms, links)] + ['',
          '## Then', '', '1. `xp music check` (scans ~/Downloads from the last 24 h) → `build/music/listen.html`',
          '2. User picks one → `xp music add <file> --name bg --start <s> --duration <s> --license "Pixabay Content License · <track URL>" --use`',
          '3. `xp timeline` → `xp mix` and listen to `build/mix.wav`.']
    io.open('build/music/brief.md', 'w', encoding='utf-8').write('\n'.join(md) + '\n')
    X.log(f'✓ build/music/brief.md · {", ".join(terms)} · {bpm[0]}–{bpm[1]} BPM'); [X.log('  ' + u) for u in links]

def main(a, X, root):
    {'brief': brief, 'check': check}[a.action](a, X, root)
