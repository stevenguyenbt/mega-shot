"""mega-shot · mau.py — colour matching + film look for real-footage videos (template footage), idea borrowed from video-use.

Stock clips from Pixabay / Pexels / NOAA come from different cameras: one is blue and dark, the next warm and bright.
After `xp assets` extracts each clip's frames into build/layers/<scene>/, this module:
  1. measures every video shot (per-channel mean, luma p5/p50/p95) on a few sampled frames,
  2. sets a target = the median of all shots of the video (the video keeps its own overall look, outliers are pulled in),
  3. builds one per-channel LUT per shot: grey-balance gain toward the target (clamped), levels toward the target contrast,
     then the named look (curves), applied with PIL (C speed) + saturation,
  4. writes a before/after sheet build/mau/truoc_sau.jpg.
Frames are graded IN PLACE; build/layers/<scene>/.mau.json records the pre-grade stats and settings, so a second run
never stacks a grade on top of a grade (changing the look needs fresh frames: `xp assets <scene>` then `xp grade`).
Still images (archival photos, paintings) are not touched — their colour is part of the document.

video.yaml:  mau: { can: true, kieu: am-dien-anh | net-tuong-phan | khong, muc: 0.6 }
  can   — match shots to each other (default true)
  kieu  — look: am-dien-anh (warm cinematic: teal shadows / warm highlights, slightly desaturated),
          net-tuong-phan (neutral punch: S-curve contrast, no hue shift), khong (none, default)
  muc   — strength of the matching 0–1 (default 0.6; 1 = match fully)
"""
import os, json, glob
import numpy as np
from PIL import Image, ImageEnhance

LOOKS = {'khong', 'am-dien-anh', 'net-tuong-phan'}

def _shots(book, scene_ids):
    """video shots per scene: (scene, shot index, first frame, end frame) from giay_phep.json `shots` + `khung`."""
    out = []
    for sid in scene_ids:
        b = book.get(sid) or {}; sh = b.get('shots') or []; n = b.get('khung') or 0; d = f'build/layers/{sid}'
        if not n or not os.path.isdir(d): continue
        vs = [x for x in sh if x.get('k') == 'v']
        f0s = [x['f0'] for x in vs] + [n]
        for i, x in enumerate(vs): out.append((sid, i, x['f0'], f0s[i + 1]))
        if not sh: out.append((sid, 0, 0, n))
    return out

def _frames(sid, a, b):
    fs = sorted(glob.glob(f'build/layers/{sid}/*.jpg')); return fs[a:b]

def _stats(files, k=6):
    pick = [files[int(i)] for i in np.linspace(0, len(files) - 1, min(k, len(files)))] if files else []
    acc = []
    for f in pick:
        im = Image.open(f).convert('RGB'); im.thumbnail((160, 160)); acc.append(np.asarray(im, dtype=np.float32) / 255)
    if not acc: return None
    a = np.concatenate([x.reshape(-1, 3) for x in acc]); y = a @ np.array([.2126, .7152, .0722], np.float32)
    return {'rgb': a.mean(0).round(4).tolist(), 'p5': float(np.percentile(y, 5)), 'p50': float(np.median(y)), 'p95': float(np.percentile(y, 95))}

def _lut(st, tg, muc, kieu):
    """256-entry LUT per channel: gain (grey balance toward target), levels (p5/p95 toward target), look curve."""
    x = np.linspace(0, 1, 256, dtype=np.float32); out = []
    gain = np.clip(np.array(tg['rgb']) / np.maximum(np.array(st['rgb']), 1e-3), .85, 1.18) ** muc
    lo = st['p5'] + (tg['p5'] - st['p5']) * muc; hi = st['p95'] + (tg['p95'] - st['p95']) * muc
    s_lo, s_hi = st['p5'], max(st['p95'], st['p5'] + .05)
    scale = np.clip((hi - lo) / (s_hi - s_lo), .8, 1.25)                       # contrast change limited to ±20–25 %
    for c in range(3):
        v = (x * gain[c] - s_lo) * scale + lo
        if kieu == 'net-tuong-phan':
            vc = np.clip(v, 0, 1); v = v + .16 * (vc - .5) * (1 - np.abs(2 * vc - 1))                         # gentle S-curve: darker shadows, brighter highlights
        elif kieu == 'am-dien-anh':
            sh = np.clip(1 - v / .45, 0, 1); hl = np.clip((v - .55) / .45, 0, 1)
            v = v + [.018 * hl - .012 * sh, .004 * hl + .006 * sh, -.02 * hl + .022 * sh][c]                   # warm highlights, teal shadows
        out.append(np.clip(v, 0, 1))
    return [(o * 255 + .5).astype(np.uint8).tolist() for o in out]

def grade(spec, log, only=None, force=False):
    cfg = spec.get('mau') or {}
    if cfg.get('can') is False and cfg.get('kieu', 'khong') == 'khong': log('mau: off (mau.can: false)'); return
    kieu = cfg.get('kieu', 'khong'); muc = float(cfg.get('muc', .6)) if cfg.get('can', True) else 0.0
    if kieu not in LOOKS: raise SystemExit(f"mau.kieu must be one of {sorted(LOOKS)}")
    book = json.load(open('giay_phep.json', encoding='utf-8')) if os.path.exists('giay_phep.json') else {}
    sids = [c['id'] for c in spec.get('canh', [])]; shots = _shots(book, sids)
    if not shots: log('mau: no video clips (only stills / 3D) — skipped'); return
    marks = {sid: (json.load(open(f'build/layers/{sid}/.mau.json', encoding='utf-8')) if os.path.exists(f'build/layers/{sid}/.mau.json') else None) for sid in {s[0] for s in shots}}
    st = {}
    for sid, i, a, b in shots:                                                  # pre-grade stats: from the marker if already graded
        m = marks.get(sid); st[(sid, i)] = (m or {}).get('truoc', {}).get(str(i)) or _stats(_frames(sid, a, b))
    vals = [v for v in st.values() if v]
    tg = {'rgb': np.median([v['rgb'] for v in vals], 0).tolist(), 'p5': float(np.median([v['p5'] for v in vals])), 'p50': float(np.median([v['p50'] for v in vals])), 'p95': float(np.median([v['p95'] for v in vals]))}
    setting = {'kieu': kieu, 'muc': muc}; done = 0; skipped = []; pairs = []
    for sid in dict.fromkeys(s[0] for s in shots):
        if only and sid not in only: continue
        m = marks.get(sid)
        if m and not force:
            if m.get('cai_dat') != setting: skipped.append(sid)
            continue
        rec = {'cai_dat': setting, 'dich': tg, 'truoc': {}}
        for s_id, i, a, b in [s for s in shots if s[0] == sid]:
            S = st[(s_id, i)]
            if not S: continue
            rec['truoc'][str(i)] = S; lut = sum(_lut(S, tg, muc, kieu), []); fs = _frames(sid, a, b)
            sat = {'am-dien-anh': .93, 'net-tuong-phan': 1.05}.get(kieu, 1.0)
            before = Image.open(fs[len(fs) // 2]).convert('RGB').copy() if fs else None
            for f in fs:
                im = Image.open(f).convert('RGB').point(lut)
                if sat != 1: im = ImageEnhance.Color(im).enhance(sat)
                im.save(f, quality=96, subsampling=0)
            if before: pairs.append((f'{sid}#{i + 1}', before, Image.open(fs[len(fs) // 2]).convert('RGB')))
            done += 1
        json.dump(rec, open(f'build/layers/{sid}/.mau.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    if pairs: _sheet(pairs)
    log(f"mau: graded {done} clips · look {kieu} · level {muc:g}" + (' · compare build/mau/truoc_sau.jpg' if pairs else ''))
    if skipped: log(f"⚠ mau: {', '.join(skipped)} already graded with other settings — to change: xp assets {' '.join(skipped)} then xp grade")

def _sheet(pairs):
    from PIL import ImageDraw
    os.makedirs('build/mau', exist_ok=True); tw = 180; rows = []
    for name, a, b in pairs[:16]:
        th = int(tw * a.height / a.width); a, b = a.resize((tw, th)), b.resize((tw, th))
        r = Image.new('RGB', (tw * 2 + 6, th + 22), (20, 20, 24)); r.paste(a, (0, 22)); r.paste(b, (tw + 6, 22))
        ImageDraw.Draw(r).text((4, 4), f'{name}  truoc | sau', fill=(230, 230, 230)); rows.append(r)
    cols = 4; W_ = max(r.width for r in rows); H_ = max(r.height for r in rows); n = len(rows)
    sheet = Image.new('RGB', (W_ * min(cols, n), H_ * ((n + cols - 1) // cols)), (10, 10, 12))
    for k, r in enumerate(rows): sheet.paste(r, ((k % cols) * W_, (k // cols) * H_))
    sheet.save('build/mau/truoc_sau.jpg', quality=90)
