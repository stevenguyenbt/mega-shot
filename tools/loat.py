"""mega-shot · multi-episode series → one long YouTube video.

videos/<loat>/loat.yaml       shared config + episode list (frame, voice, style are inherited by the episodes)
videos/<loat>/tap-NN/         each episode is a normal mega-shot video (video.yaml + film.html), no music by default
Commands:
  xp series new <ten> --episodes 4 [--format 16x9] [--template footage]
  xp series run [--only tap-01 tap-02] [--steps narrate,assets,blender,mix,render]     (run inside the series folder)
  xp series assemble                                                              → out/<ten>_youtube.mp4 + chapters + subtitles + description + thumbnail
"""
import json, os, re, shutil, subprocess, sys, time

def fmt_ts(s, srt=False):
    h, m, sec = int(s // 3600), int(s % 3600 // 60), s % 60
    if srt: return f'{h:02d}:{m:02d}:{int(sec):02d},{int(round((sec - int(sec)) * 1000)):03d}'
    return f'{h}:{m:02d}:{int(sec):02d}' if h else f'{m:02d}:{int(sec):02d}'

def load_loat(die):
    import yaml
    if not os.path.exists('loat.yaml'): die('loat.yaml not found — run inside the series folder')
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import yaml_keys
    L = yaml_keys.normalize_series(yaml.safe_load(open('loat.yaml', encoding='utf-8'))); L.setdefault('khung', '16x9'); L.setdefault('tap', [])
    for t in L['tap']: t['thu_muc'] = str(t['thu_muc'])
    return L

def moi(a, X):
    root = X.find_root('.'); dst = os.path.join(root, 'videos', a.ten)
    if os.path.exists(dst): X.die(f'{dst} already exists')
    os.makedirs(dst); tpl = os.path.join(X.SKILL, 'templates', a.mau)
    if not os.path.isdir(tpl): X.die(f"no template '{a.mau}'")
    taps = []
    for k in range(1, a.so_tap + 1):
        d = os.path.join(dst, f'tap-{k:02d}'); shutil.copytree(tpl, d)
        y = open(os.path.join(d, 'video.yaml'), encoding='utf-8').read().replace('__TEN__', f'{a.ten}-tap-{k:02d}')
        y = '\n'.join(l for l in y.splitlines() if not re.match(r'^(khung|nhac|giong|ngon_ngu|format|music|voice|language):', l))   # taken from loat.yaml
        open(os.path.join(d, 'video.yaml'), 'w', encoding='utf-8').write(y + '\n'); taps.append(f'  - {{ folder: tap-{k:02d}, title: "Part {k} title" }}')
    open(os.path.join(dst, 'loat.yaml'), 'w', encoding='utf-8').write(f"""# Multi-episode series → one long YouTube video. The episodes inherit format/voice/style below.
# English keys are used here; the Vietnamese keys (ten, tieu_de, tap, …) also work — see docs/yaml-reference.md.
name: {a.ten}
title: "Long video title"
tagline: "One-sentence intro shown on the opening card and at the top of the YouTube description"
format: {a.khung}
language: en
loudness: -14
voice: {{ sample: documentarian, volume: 0.65, speed: 1.0, seed: 1234 }}
# music: {{ file: <path>.mp3, volume: 0.35, duck: true }}   # music for the whole long video — xp music add <file> --name bg --use
opening: {{ length: 4.5 }}                       # title card at the start of the video
chapter_card: {{ dai: 3.5, mau: "#ffc46a" }}     # "PART n" card before each episode (dai = seconds, mau = colour)
end_card: {{ dai: 15, tieu_de: "Thanks for watching", phu_de: "Subscribe to see the next part" }}   # ≥ 12 s: room for the YouTube end screen
hashtags: []                                   # 3–15 hashtags
publish:                                       # publishing pack (xp publish) — write it together with the script, see references/publishing.md
  titles: ["… in {{phut}} minutes"]               # {{phut}} = the real number of minutes
  hook: ""                                     # the first 2 lines show in search results
  topics: auto                                 # auto = the scene titles
  drama: ""
  trust: ""
  tags: []
episodes:
""" + '\n'.join(taps) + '\n')
    X.log(f'created series {dst} · {a.so_tap} episodes · template {a.mau} · frame {a.khung}')

def chay(a, X):
    L = load_loat(X.die); steps = (a.buoc or 'giong,tim,art,blender,am,render').split(','); here = os.getcwd()
    tm = (L.get('mo_dau') or {}).get('thu_muc')                                    # spoken teaser (mo_dau.thu_muc) runs along with the episodes
    for t in ([{'thu_muc': str(tm), 'tieu_de': 'teaser'}] if tm else []) + L['tap']:
        if a.tap and t['thu_muc'] not in a.tap: continue
        d = os.path.join(here, t['thu_muc']); X.log(f"══ {t['thu_muc']}: {t.get('tieu_de', '')}")
        y = open(os.path.join(d, 'video.yaml'), encoding='utf-8').read(); run = lambda *c: subprocess.run([sys.executable, os.path.join(X.SKILL, 'tools', 'xp.py'), *c], cwd=d, check=True)
        if 'giong' in steps: run('narrate')
        if 'tim' in steps and re.search(r'^\s*tim:', y, re.M): run('assets')
        if 'art' in steps and re.search(r'^\s*huashu:', y, re.M): run('art')
        if 'blender' in steps and re.search(r'^\s*blender:', y, re.M): run('blender')
        if 'am' in steps: run('mix')
        if 'render' in steps:
            raw = os.path.join(d, 'build', 'raw.mp4'); src = [os.path.join(d, f) for f in ('film.html', 'build/timeline.json', 'giay_phep.json') if os.path.exists(os.path.join(d, f))]
            core = os.path.join(X.SKILL, 'engine', 'core'); src += [os.path.join(core, f) for f in os.listdir(core) if f.endswith(('.js', '.html'))]   # engine changed → re-render
            if os.path.exists(raw) and all(os.path.getmtime(raw) > os.path.getmtime(f) for f in src) and not a.lam_lai: X.log('  render: reused (unchanged)')
            else: run('render')

def _render_card(X, q, out, dur, fps=30):
    import base64, urllib.parse
    page = 'ms/core/the.html?' + urllib.parse.urlencode(q)
    pw, b, pg, srv = X.browser(page); n = int(dur * fps)
    X.encode_frames(pg, n, fps, out, grab="(t)=>{render(t);return document.getElementById('c').toDataURL('image/jpeg',0.95).split(',')[1]}")
    b.close(); pw.stop(); srv.shutdown()

def ghep(a, X):
    L = load_loat(X.die); W, H = X.FORMATS[L['khung']]; os.makedirs('build/ghep', exist_ok=True); os.makedirs('out', exist_ok=True)
    acc = (L.get('the_chuong') or {}).get('mau', '#ffc46a'); cdur = (L.get('the_chuong') or {}).get('dai', 3.5); lang = L.get('ngon_ngu', 'vi')
    segs = []                                                                      # (kind, video, audio|None, duration, chapter title, episode)
    md = (L.get('mo_dau') or {}).get('dai', 4.5); tm = (L.get('mo_dau') or {}).get('thu_muc')
    if tm:                                                                         # spoken teaser: hook the viewer in the first second, then the title card
        if not os.path.exists(f'{tm}/build/raw.mp4'): X.die(f'{tm} (opening) is not rendered — run xp series run')
        tl = json.load(open(f'{tm}/build/timeline.json', encoding='utf-8')); segs.append(('tap', f'{tm}/build/raw.mp4', f'{tm}/build/mix.wav', int(tl['dur'] * 30) / 30, 'Mở đầu' if str(lang).startswith('vi') else 'Intro', tm))   # separate "Intro" chapter at 00:00
    _render_card(X, {'fmt': L['khung'], 'kieu': 'mo-dau', 'tieu_de': L.get('tieu_de', ''), 'phu_de': L.get('mo_ta', ''), 'dur': md, 'mau': acc, 'lang': lang}, 'build/ghep/mo_dau.mp4', md)
    segs.append(('the', 'build/ghep/mo_dau.mp4', None, md, None, None))          # merged into chapter 1 (YouTube: the first chapter starts at 00:00 and lasts ≥10 s)
    for k, t in enumerate(L['tap'], 1):
        d = t['thu_muc']; raw, mix = f'{d}/build/raw.mp4', f'{d}/build/mix.wav'
        if not (os.path.exists(raw) and os.path.exists(mix)): X.die(f'{d} is not fully rendered (missing build/raw.mp4 or build/mix.wav) — run xp series run')
        cp = f'build/ghep/the_{k:02d}.mp4'; _render_card(X, {'fmt': L['khung'], 'kieu': 'chuong', 'so': k, 'tieu_de': t.get('tieu_de', d), 'dur': cdur, 'mau': acc, 'lang': lang}, cp, cdur)
        tl = json.load(open(f'{d}/build/timeline.json', encoding='utf-8')); td = int(tl['dur'] * 30) / 30    # exact frame count rendered → no accumulating drift
        segs.append(('the', cp, None, cdur, t.get('tieu_de', d), None)); segs.append(('tap', raw, mix, td, None, d))
        X.log(f'{d}: {td:.1f}s')
    if L.get('ket'):
        kd = L['ket'].get('dai', 5); _render_card(X, {'fmt': L['khung'], 'kieu': 'ket', 'tieu_de': L['ket'].get('tieu_de', ''), 'phu_de': L['ket'].get('phu_de', ''), 'dur': kd, 'mau': acc, 'lang': lang}, 'build/ghep/ket.mp4', kd)
        segs.append(('the', 'build/ghep/ket.mp4', None, kd, None, None))
    total = sum(s[3] for s in segs)
    # ---- audio: each episode voice at its exact position + continuous music, ducked under speech ----
    ins, fc, n, t0, starts = [], '', 0, 0.0, []
    for s in segs:
        if s[0] == 'tap': ms = int(t0 * 1000); ins += ['-i', s[2]]; fc += f'[{n}]aformat=sample_rates=48000:channel_layouts=stereo,adelay={ms}|{ms}[v{n}];'; n += 1
        starts.append(t0); t0 += s[3]
    fc += ''.join(f'[v{i}]' for i in range(n)) + f'amix=inputs={n}:normalize=0,apad=whole_dur={total},atrim=0:{total}[vo];'
    m = L.get('nhac')
    if m and m.get('file'):
        md_ = X.dur_of(m['file']); reps = max(2, int(total // max(md_ - 6, 1)) + 2); xf = min(6, md_ / 3); mi = n; ins += sum([['-i', m['file']] for _ in range(reps)], [])
        fc += f'[{mi}][{mi + 1}]acrossfade=d={xf}[x1];' + ''.join(f'[x{r - 1}][{mi + r}]acrossfade=d={xf}[x{r}];' for r in range(2, reps))
        fc += f"[x{reps - 1}]atrim=0:{total},aformat=sample_rates=48000:channel_layouts=stereo,volume={m.get('am_luong', .35)},afade=t=in:d=2,afade=t=out:st={max(total - 5, 0)}:d=5[mu];"
        fc += '[vo]asplit=2[v][sc];[mu][sc]sidechaincompress=threshold=0.04:ratio=5:attack=40:release=600[md];[v][md]amix=inputs=2:normalize=0:duration=first[o]'
    else: fc += '[vo]anull[o]'
    X.run(['ffmpeg', '-v', 'error', '-y', *ins, '-filter_complex', fc, '-map', '[o]', '-ar', '48000', 'build/ghep/tieng_tho.wav'])
    tgt = L.get('do_to', -14); st = subprocess.run(['ffmpeg', '-i', 'build/ghep/tieng_tho.wav', '-af', f'loudnorm=I={tgt}:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace').stderr
    js = json.loads(st[st.rindex('{'):st.rindex('}') + 1])
    X.run(['ffmpeg', '-v', 'error', '-y', '-i', 'build/ghep/tieng_tho.wav', '-af', f"loudnorm=I={tgt}:TP=-1.5:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true", '-ar', '48000', 'build/ghep/tieng.wav'])
    # ---- high-quality YouTube export: join the video with the concat filter (each part trimmed to its length) + normalised audio, encoded once ----
    out = f"out/{L['ten']}_youtube.mp4"; vin = sum([['-i', s[1]] for s in segs], [])
    vf = ''.join(f'[{i}:v]trim=duration={s[3]:.4f},setpts=PTS-STARTPTS,scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps=30,setsar=1,format=yuv420p[s{i}];' for i, s in enumerate(segs))
    vf += ''.join(f'[s{i}]' for i in range(len(segs))) + f'concat=n={len(segs)}:v=1:a=0[v]'
    X.log(f'exporting {len(segs)} parts · {fmt_ts(total)} …')
    sides = [os.path.splitext(s_[1])[0] + '.h264' for s_ in segs]
    fresh = all(os.path.exists(f) and os.path.getmtime(f) >= os.path.getmtime(s_[1]) - 120 for f, s_ in zip(sides, segs))
    if fresh:                                                                     # every part rendered with WebCodecs (same codec/size/fps, keyframe first) → join bytes, no re-encode
        with open('build/ghep/video.h264', 'wb') as fo:
            for f in sides: fo.write(open(f, 'rb').read())
        X.run(['ffmpeg', '-v', 'error', '-y', '-r', '30', '-f', 'h264', '-i', 'build/ghep/video.h264', '-i', 'build/ghep/tieng.wav', '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-t', f'{total:.3f}', '-movflags', '+faststart', out])   # no -shortest with raw .h264 (drops audio)
    else:
        X.run(['ffmpeg', '-v', 'error', '-y', *vin, '-i', 'build/ghep/tieng.wav', '-filter_complex', vf, '-map', '[v]', '-map', f'{len(segs)}:a', '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-g', '60', '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', '-shortest', out])
    # ---- YouTube chapters, subtitles, description, thumbnail ----
    ch = [(starts[i], s[4]) for i, s in enumerate(segs) if s[4]]; ch[0] = (0.0, ch[0][1])
    ch_txt = '\n'.join(f'{fmt_ts(t)} {name}' for t, name in ch)
    warn = []
    if len(ch) < 3: warn.append('YouTube needs at least 3 chapters')
    if any(ch[i + 1][0] - ch[i][0] < 10 for i in range(len(ch) - 1)): warn.append('a chapter is shorter than 10 s (YouTube will not show chapters)')
    open('out/chuong_youtube.txt', 'w', encoding='utf-8').write(ch_txt + '\n')
    srt, k = [], 1
    for i, s in enumerate(segs):
        if s[0] != 'tap': continue
        tl = json.load(open(f'{s[5]}/build/timeline.json', encoding='utf-8'))
        for sub in tl['subs']: srt.append(f"{k}\n{fmt_ts(starts[i] + sub['t0'], True)} --> {fmt_ts(starts[i] + sub['t1'], True)}\n{sub['s']}\n"); k += 1
    open(f"out/{L['ten']}.srt", 'w', encoding='utf-8').write('\n'.join(srt))
    json.dump([[starts[i], s[5]] for i, s in enumerate(segs) if s[0] == 'tap'], open('build/ghep/phu_de_nguon.json', 'w', encoding='utf-8'), ensure_ascii=False)
    X.phu_de()                                                                    # sentence SRTs: source language + English (out/subtitles/)
    X.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{md * .6:.2f}', '-i', out, '-frames:v', '1', '-vf', 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720', 'out/anh_bia.jpg'])
    lo = subprocess.run(['ffmpeg', '-i', out, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace').stderr; lufs = re.findall(r'I:\s+(-?[\d.]+) LUFS', lo)
    X.log(f"{out} · {fmt_ts(X.dur_of(out))} · {os.path.getsize(out) / 1048576:.0f} MB · {lufs[-1] if lufs else '?'} LUFS · {len(ch)} chapters")
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import dangbai; dangbai.build(X)   # publishing pack: title, description, tags, hashtags, credits
    # preview to send to a phone (< 29 MB, 720p) — not for posting
    pv = f"out/{L['ten']}_xem_thu.mp4"; kb = max(250, int(26.5 * 8192 / total - 80 - 8))   # target 26.5 MB: leave room for single-pass encoder overshoot + the mp4 container
    for _ in range(3):                                                             # still > 28.5 MB (30 MB phone-send limit) → lower the bitrate, re-encode
        X.run(['ffmpeg', '-v', 'error', '-y', '-i', out, '-vf', 'scale=-2:720', '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', f'{kb}k', '-maxrate', f'{kb}k', '-bufsize', f'{kb * 2}k', '-c:a', 'aac', '-b:a', '80k', '-movflags', '+faststart', pv])
        if os.path.getsize(pv) <= 28.5 * 1048576: break
        kb = int(kb * 28.5 * 1048576 / os.path.getsize(pv) * .95)
    X.log('also: out/chuong_youtube.txt · out/' + L['ten'] + '.srt · out/youtube_dang_bai.md · out/mo_ta_youtube.md · out/anh_bia.jpg · ' + pv + f' ({os.path.getsize(pv) / 1048576:.0f} MB)')
    for w in warn: X.log('⚠', w)

def main(a, X):
    {'moi': moi, 'chay': chay, 'ghep': ghep}[a.lenh](a, X)
