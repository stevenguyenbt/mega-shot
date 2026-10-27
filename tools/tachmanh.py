"""mega-shot · cuts a character PARTS SHEET (cut-out rig sheet) into individual transparent PNG pieces.

uv run --with pillow --with numpy python tachmanh.py <sheet.png> <output folder> [--gop 12] [--nen 236]

White/light background connected to the image edge → transparent (white areas INSIDE the outline, such as a tank top or shoes, are kept).
A piece = a connected region after growing by ±gop px (merges the eyes + eyebrows + nose of one face into one piece).
Writes <out>/manh_XX.png + <out>/manh.json [{id, bbox:[x0,y0,x1,y1], dien_tich}] + <out>/_ban_do.png (boxes + numbers) for naming the pieces.
"""
import json, os, sys
from collections import deque
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

src, out = sys.argv[1], sys.argv[2]
gop = int(sys.argv[sys.argv.index('--gop') + 1]) if '--gop' in sys.argv else 12
nen = int(sys.argv[sys.argv.index('--nen') + 1]) if '--nen' in sys.argv else 236
os.makedirs(out, exist_ok=True)
im = Image.open(src).convert('RGB'); A = np.asarray(im).astype(np.int16); H, W = A.shape[:2]
light = (A.min(axis=2) >= nen)
# background = light pixels connected to the border (BFS over a boolean grid)
bg = np.zeros((H, W), bool); q = deque()
for x in range(W):
    for y in (0, H - 1):
        if light[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
for y in range(H):
    for x in (0, W - 1):
        if light[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        yy, xx = y + dy, x + dx
        if 0 <= yy < H and 0 <= xx < W and light[yy, xx] and not bg[yy, xx]: bg[yy, xx] = True; q.append((yy, xx))
fg = ~bg
# soft alpha on the anti-aliased rim: pixels next to the background fade by their lightness
alpha = np.where(fg, 255, 0).astype(np.uint8)
grown = np.asarray(Image.fromarray(alpha).filter(ImageFilter.MaxFilter(gop * 2 + 1))) > 0
# label grown regions (4-connected BFS, row-run speedup)
lab = np.zeros((H, W), np.int32); n = 0
for y0 in range(H):
    xs = np.nonzero(grown[y0] & (lab[y0] == 0))[0]
    for x0 in xs:
        if lab[y0, x0]: continue
        n += 1; lab[y0, x0] = n; q = deque([(y0, x0)])
        while q:
            y, x = q.popleft()
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and grown[yy, xx] and not lab[yy, xx]: lab[yy, xx] = n; q.append((yy, xx))
info = []; rgba = np.dstack([np.asarray(im), alpha])
for k in range(1, n + 1):
    m0 = (lab == k) & fg
    if m0.sum() < 150: continue
    ys, xs = np.nonzero(m0)
    pieces = [m0]
    if ys.max() - ys.min() > 1.6 * (xs.max() - xs.min()):                       # tall stacks (thigh / shin / shoe, sleeve / forearm): split on empty rows
        rows = m0.any(axis=1); pieces = []; y = ys.min()
        while y <= ys.max():
            if not rows[y]: y += 1; continue
            e = y
            while e <= ys.max() and rows[e]: e += 1
            pm = np.zeros_like(m0); pm[y:e] = m0[y:e]; pieces.append(pm); y = e
    for m in pieces:
        c = int(m.sum())
        if c < 150: continue
        ys, xs = np.nonzero(m); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        crop = rgba[y0:y1, x0:x1].copy(); crop[..., 3] = np.where(m[y0:y1, x0:x1], crop[..., 3], 0)
        i = len(info); Image.fromarray(crop).save(os.path.join(out, f'manh_{i:02d}.png'))
        info.append({'id': i, 'bbox': [int(x0), int(y0), int(x1), int(y1)], 'dien_tich': c})
json.dump(info, open(os.path.join(out, 'manh.json'), 'w'), indent=1)
mp = im.copy(); d = ImageDraw.Draw(mp)
for p in info: b = p['bbox']; d.rectangle(b, outline=(255, 0, 0), width=3); d.text((b[0] + 4, b[1] + 2), str(p['id']), fill=(255, 0, 0))
mp.save(os.path.join(out, '_ban_do.png')); print(len(info), 'parts ->', out)
