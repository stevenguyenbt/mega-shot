"""Cut out the subject with BiRefNet (rembg, MIT licence) — runs on CPU, no GPU needed.

uv run --with "rembg[cpu]" python tachnen.py <model folder> <input image> <output png> [<input image> <output png> …]
The model (~1 GB) is downloaded once into .mega-shot/models/. Prints the area ratio + subject bounding box so the compositing step can lay out the frame.
"""
import json, os, sys

os.environ['U2NET_HOME'] = sys.argv[1]
from PIL import Image, ImageFilter
from rembg import new_session, remove

sess = new_session('birefnet-general')
args = sys.argv[2:]
for src, dst in zip(args[::2], args[1::2]):
    im = Image.open(src).convert('RGB')
    m = remove(im, session=sess, only_mask=True).convert('L')
    m = m.filter(ImageFilter.GaussianBlur(.8))                           # soft edge, less jagged
    out = im.convert('RGBA'); out.putalpha(m); out.save(dst)
    bb = m.point(lambda v: 255 if v > 96 else 0).getbbox()
    area = sum(1 for v in m.resize((96, 54)).getdata() if v > 96) / (96 * 54)
    print(json.dumps({'file': dst, 'bbox': [b / s for b, s in zip(bb, (*im.size, *im.size))] if bb else None, 'dien_tich': round(area, 3)}), flush=True)
