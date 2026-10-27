"""Build the small preview tiles Studio shows in its style pickers (references/previews/…).

Run once after changing the source sheets:  uv run --with pillow python tools/build_previews.py
  kieu/<id>.webp     visual style  ← references/style-gallery.jpg + huashu-art-motion overviews + frames of sample videos
  anh-bia/<id>.webp  thumbnail style ← references/thumbnail-styles.jpg
  chu/<name>.webp    animated subtitle / title styles ← references/text-styles/*.gif (16:9 crop around the text, animated WebP)
Everything is WebP so the Studio page stays light.
"""
import os, subprocess, sys, tempfile
from PIL import Image, ImageFilter

SKILL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(SKILL, 'references'); OUT = os.path.join(REF, 'previews')
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(SKILL)))
W, H = 480, 270


def tile(im, out):
    """fit to 16:9: crop when close to 16:9, otherwise show whole over a blurred copy of itself."""
    im = im.convert('RGB'); r = im.width / im.height
    if abs(r - W / H) < .25:
        if r > W / H: nw = int(im.height * W / H); im = im.crop(((im.width - nw) // 2, 0, (im.width + nw) // 2, im.height))
        else: nh = int(im.width * H / W); im = im.crop((0, (im.height - nh) // 2, im.width, (im.height + nh) // 2))
        im = im.resize((W, H), Image.LANCZOS)
    else:
        bg = im.resize((W, int(W / r)) if r < W / H else (int(H * r), H), Image.LANCZOS)
        bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2, (bg.width + W) // 2, (bg.height + H) // 2)).filter(ImageFilter.GaussianBlur(14))
        bg = Image.blend(bg, Image.new('RGB', (W, H), (0, 0, 0)), .35)
        fg = im.resize((int(H * r), H), Image.LANCZOS) if r < W / H else im.resize((W, int(W / r)), Image.LANCZOS)
        bg.paste(fg, ((W - fg.width) // 2, (H - fg.height) // 2)); im = bg
    os.makedirs(os.path.dirname(out), exist_ok=True); im.save(out, 'WEBP', quality=80, method=6); print('✓', os.path.relpath(out, SKILL))


def frame(video, t):
    p = os.path.join(tempfile.gettempdir(), 'ms_prev.jpg')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t), '-i', video, '-frames:v', '1', p], check=True)
    return Image.open(p)


def main():
    g = Image.open(os.path.join(REF, 'style-gallery.jpg'))
    xs, ys = [14, 508, 1002, 1496], [14, 342, 670]
    ids = ['footage', 'parallax-25d', 'sketch', 'stick-figure', 'flat-2d', 'vox-collage', 'kinetic-type', '3b1b', 'painterly', 'threejs', 'blender', 'anh-ai']
    for i, k in enumerate(ids):
        x, y = xs[i % 4], ys[i // 4]; top = 0   # the gallery tiles no longer carry header strips
        tile(g.crop((x, y + top, x + 480, y + 270)), os.path.join(OUT, 'kieu', k + '.webp'))
    hu = os.path.join(SKILL, '..', 'huashu-art-motion', 'assets', '动画语法')
    for k, f, x0 in [('keynote-ui', 't2_keynote_ui_总览.jpg', 1920), ('finance-charts', 't3_finance_chart_总览.jpg', 0)]:
        p = os.path.join(hu, f)
        if os.path.exists(p): tile(Image.open(p).crop((x0, 56, x0 + 960, 596)), os.path.join(OUT, 'kieu', k + '.webp'))
    extra = [x.split(',') for x in os.environ.get('MS_PREVIEW_VIDEOS', '').split(';') if x.count(',') == 2]   # optional: MS_PREVIEW_VIDEOS='triet-ly,<video folder>,9;…' → style tile from a frame of your own video
    for k, v, t in extra:
        p = os.path.join(ROOT, 'videos', v, 'out', f'{v}_9x16.mp4')
        if os.path.exists(p): tile(frame(p, float(t)), os.path.join(OUT, 'kieu', k + '.webp'))
    t = Image.open(os.path.join(REF, 'thumbnail-styles.jpg'))
    ids = ['classic', 'poster', 'gold-title', 'big-number', 'versus', 'red-circle', 'breaking-news', 'mystery', 'minimal', 'parchment', 'cinematic']
    for i, k in enumerate(ids):
        x, y = [20, 520, 1020][i % 3], [80, 428, 776, 1124][i // 3]
        tile(t.crop((x, y, x + 480, y + 270)), os.path.join(OUT, 'anh-bia', k + '.webp'))
    gifs(os.path.join(REF, 'text-styles'), os.path.join(OUT, 'chu'))


def gifs(src, dst, w=360, step=2):
    """animated GIF (9:16) → animated WebP 16:9 cropped around the text (subtitles sit at ~72 %, titles at ~44 % of the height),
    every 2nd frame (same duration) — same card shape as the other pickers and far lighter than the GIFs."""
    from PIL import ImageSequence
    os.makedirs(dst, exist_ok=True)
    for f in sorted(os.listdir(src)):
        if not f.endswith('.gif') or f.startswith('overview'): continue
        im = Image.open(os.path.join(src, f)); fr, du = [], []
        cy = .72 if f.startswith('subtitle') else .44
        for i, x in enumerate(ImageSequence.Iterator(im)):
            if i % step: continue
            x = x.convert('RGB'); ch = int(x.width * 9 / 16); y0 = max(0, min(x.height - ch, int(x.height * cy - ch / 2)))
            fr.append(x.crop((0, y0, x.width, y0 + ch)).resize((w, int(w * 9 / 16)), Image.LANCZOS)); du.append(x.info.get('duration', im.info.get('duration', 40)) * step)
        out = os.path.join(dst, f[:-4] + '.webp')
        fr[0].save(out, 'WEBP', save_all=True, append_images=fr[1:], duration=du, loop=0, quality=70, method=4)
        print('✓', os.path.relpath(out, SKILL), f'{os.path.getsize(out) // 1024} KB')


if __name__ == '__main__': main()
