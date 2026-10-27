"""mega-shot · kiemcat.py — self-check around every cut of the rendered video (idea borrowed from video-use's self-eval loop).

For each scene change and each in-scene camera cut (giay_phep.json `cat`) it decodes ±1.5 s of the FINAL video:
  · picture: a single-frame flash/glitch (frame differs from both neighbours while they match each other),
    a black dip that is not a planned fade, or a frozen stretch right after the cut;
  · sound: a click in the VOICE stem build/giong.wav (isolated 5 ms burst ≫ its surroundings — SFX ticks and music
    beats on a cut are intended, so the full mix is only checked for clipping);
and draws a filmstrip (8 frames) + waveform per cut into build/kiem_cat/, plus build/kiem_cat/tong.jpg with the
flagged cuts first. The model cannot listen: audio findings are numbers — say so when reporting.
Workflow (SKILL.md): xp check → look at tong.jpg → fix → re-render; at most 3 passes, then tell the user what is left.
"""
import os, json, subprocess
import numpy as np
from PIL import Image, ImageDraw

SR = 48000

def _gray(vid, t0, dur, w=96):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{max(0, t0):.3f}', '-i', vid, '-t', f'{dur:.3f}', '-vf', f'scale={w}:-2,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
    pr = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', vid], capture_output=True, text=True).stdout.strip().split(',')
    W, H = int(pr[0]), int(pr[1]); hh = int(round(w * H / W / 2) * 2); n = w * hh
    return np.frombuffer(raw[:len(raw) // n * n], np.uint8).reshape(-1, hh, w).astype(np.float32) / 255

def _audio(vid, t0, dur):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{max(0, t0):.3f}', '-i', vid, '-t', f'{dur:.3f}', '-vn', '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768

def _strip(vid, t, path, W, H, wave, flags):
    ts = [t - 1.5, t - 1, t - .5, t - .1, t + .1, t + .5, t + 1, t + 1.5]; tw = 120; th = int(tw * H / W); ims = []
    for x in ts:
        r = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{max(0, x):.3f}', '-i', vid, '-frames:v', '1', '-vf', f'scale={tw}:{th}', '-f', 'image2pipe', '-vcodec', 'png', '-'], capture_output=True).stdout
        try:
            from io import BytesIO; ims.append(Image.open(BytesIO(r)).convert('RGB'))
        except Exception: ims.append(Image.new('RGB', (tw, th), (40, 0, 0)))
    wh = 70; img = Image.new('RGB', (tw * 8 + 7 * 3, th + wh + 24), (16, 16, 20)); d = ImageDraw.Draw(img)
    for k, im in enumerate(ims): img.paste(im, (k * (tw + 3), 22))
    d.line([(4 * (tw + 3) - 2, 18), (4 * (tw + 3) - 2, th + 22)], fill=(255, 210, 90), width=2)
    if len(wave):
        Wd = img.width; seg = np.array_split(np.abs(wave), Wd); y0 = th + 24 + wh // 2
        for i, s in enumerate(seg):
            a = float(s.max()) if len(s) else 0; d.line([(i, y0 - a * wh / 2), (i, y0 + a * wh / 2)], fill=(120, 190, 255) if a < .98 else (255, 80, 80))
    d.text((4, 4), f'{t:.2f}s  ' + ('; '.join(flags) if flags else 'ok'), fill=(255, 120, 120) if flags else (200, 220, 200))
    img.save(path); return img

def check(vid, timeline, book, out='build/kiem_cat', voice='build/giong.wav'):
    voice = voice if voice and os.path.exists(voice) else None; os.makedirs(out, exist_ok=True)
    for f in os.listdir(out):
        if f.endswith('.png') or f.endswith('.jpg'): os.remove(os.path.join(out, f))
    cuts = []
    for k, sc in enumerate(timeline['scenes']):
        if k: cuts.append((sc['t0'], f"→ {sc['id']}", (sc.get('data') or {}).get('chuyen')))
        for c in (book.get(sc['id']) or {}).get('cat') or []: cuts.append((sc['t0'] + c, f"{sc['id']} camera angle", None))
    pr = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'json', vid], capture_output=True, text=True).stdout
    s0 = json.loads(pr)['streams'][0]; W, H = s0['width'], s0['height']; num, den = map(int, s0['r_frame_rate'].split('/')); fps = num / den
    res = []; imgs = []
    for idx, (t, name, kind) in enumerate(sorted(cuts)):
        flags = []
        g = _gray(vid, t - .5, 1.0);
        if len(g) >= 5:
            d = np.abs(np.diff(g, axis=0)).mean((1, 2)); lum = g.mean((1, 2))
            for i in range(1, len(g) - 1):
                skip = abs(np.abs(g[i + 1] - g[i - 1]).mean())
                if d[i - 1] > .08 and d[i] > .08 and skip < .35 * min(d[i - 1], d[i]): flags.append(f'single-frame flash at {t - .5 + i / fps:.2f}s'); break
            dk = np.where(lum < .03)[0]                                         # a black DIP: dark for a few frames, bright on BOTH sides (a cut into a dark scene is fine)
            if kind not in ('fade', 'toi-dan') and len(dk) and len(dk) <= 8 and lum[:dk[0]].max(initial=0) > .12 and lum[dk[-1] + 1:].max(initial=0) > .12: flags.append('brief black dip')
            post = d[len(d) // 2 + 1:]
            if len(post) > 12 and (post < .0004).all() and lum.mean() > .05: flags.append('frozen picture after the cut')       # truly identical frames (slow Ken Burns / fading titles still move)
        a = _audio(vid, t - .5, 1.0)
        if len(a) > SR // 2 and (np.abs(a) > .985).sum() > 3: flags.append('audio clipping')
        v = _audio(voice, t - .5, 1.0) if voice else np.zeros(0)                # clicks: only in the voice stem (SFX ticks / music beats on a cut are intended)
        if len(v) > SR // 2:
            dx = np.abs(np.diff(v)); k = int(np.argmax(dx)); loc = np.median(dx[max(0, k - 240):k + 240]) + 1e-4   # a click = ONE-sample step (speech bursts rise over many samples)
            nb = np.concatenate([dx[max(0, k - 24):max(0, k - 2)], dx[k + 3:k + 25]])
            if dx[k] > .2 and dx[k] > 10 * loc and (len(nb) == 0 or nb.max() < .4 * dx[k]): flags.append(f'click in the voice at {t - .5 + k / SR:.3f}s (step {dx[k]:.2f})')
        wave = _audio(vid, t - 1.5, 3.0)
        img = _strip(vid, t, os.path.join(out, f'cat_{idx + 1:02d}.png'), W, H, wave, flags)
        res.append({'t': round(t, 2), 'cat': name, 'loi': flags}); imgs.append((bool(flags), img))
    order = [im for f, im in imgs if f] + [im for f, im in imgs if not f]
    if order:
        sheet = Image.new('RGB', (order[0].width, sum(im.height + 4 for im in order[:14])), (8, 8, 10)); y = 0
        for im in order[:14]: sheet.paste(im, (0, y)); y += im.height + 4
        sheet.save(os.path.join(out, 'tong.jpg'), quality=88)
    json.dump(res, open(os.path.join(out, 'ket_qua.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return res
