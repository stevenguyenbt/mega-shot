"""Split a still image into 2 layers for 2.5D motion (parallax): front layer = the subject (BiRefNet), back layer = the image with the subject area inpainted.

uv run --with "rembg[cpu]" python lop25d.py <model folder> <image> [<image> …]
→ <image>_tien.png (RGBA) + <image>_nen.jpg; prints JSON {file, dien_tich} per image. A subject that is too small (<3%) or too large (>75%) → skipped (bo_qua).
"""
import json, os, sys

os.environ['U2NET_HOME'] = sys.argv[1]
import cv2, numpy as np
from PIL import Image, ImageFilter
from rembg import new_session, remove

sess = new_session('birefnet-general')
for src in sys.argv[2:]:
    base = os.path.splitext(src)[0]; im = Image.open(src).convert('RGB')
    m = remove(im, session=sess, only_mask=True).convert('L'); a = np.asarray(m) / 255.0; area = float((a > .4).mean())
    if not .03 <= area <= .75: print(json.dumps({'file': src, 'dien_tich': round(area, 3), 'bo_qua': True}), flush=True); continue
    fg = im.convert('RGBA'); fg.putalpha(m.filter(ImageFilter.GaussianBlur(1.2))); fg.save(base + '_tien.png')
    # back layer: grow the subject region, inpaint (Telea) at low resolution, scale back up and replace only the inpainted area
    arr = np.asarray(im); h, w = arr.shape[:2]; s = min(1.0, 1400 / max(h, w))
    hole = cv2.dilate(((a > .15) * 255).astype(np.uint8), np.ones((25, 25), np.uint8))
    small = cv2.resize(arr, (int(w * s), int(h * s)), interpolation=cv2.INTER_AREA); hs = cv2.resize(hole, (int(w * s), int(h * s)), interpolation=cv2.INTER_NEAREST)
    fill = cv2.inpaint(cv2.cvtColor(small, cv2.COLOR_RGB2BGR), hs, 9, cv2.INPAINT_TELEA); fill = cv2.cvtColor(cv2.resize(fill, (w, h), interpolation=cv2.INTER_CUBIC), cv2.COLOR_BGR2RGB)
    k = cv2.GaussianBlur(hole.astype(np.float32) / 255, (0, 0), 6)[..., None]; out = (arr * (1 - k) + cv2.GaussianBlur(fill, (0, 0), 2) * k).astype(np.uint8)
    Image.fromarray(out).save(base + '_nen.jpg', quality=95)
    print(json.dumps({'file': src, 'dien_tich': round(area, 3)}), flush=True)
