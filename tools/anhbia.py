"""mega-shot · YouTube thumbnails (1280×720) from AI images you generate yourself or real video frames.

anh_bia.yaml (in the video or series folder):
  mau_nhan: "#ffd400"
  phien_ban:
    - ten: ca-map
      nguon: anh_bia/ca-map.png          # AI image you generate from loi_nhac_anh_bia.md · or "tap-02/tainguyen/bien-khoi.mp4@12.5" (a real frame)
      chu: ["SHARKS", "*NEVER SLEEP"]     # ≤ 4 words; "*" = accent-colour box, "^" = accent-colour text
      bo_cuc: trai                       # trai (text left, subject right) | phai | duoi
      tach_nen: true                     # subject pops out with a light outline (BiRefNet)
      lat: false                         # flip the image so the subject faces away from the text
      nhan: "PART 2"                     # small label in the top corner (optional)
    # "poster" style (like a history-documentary cover): large cut-out figure on the left, a DIFFERENT bright image as background,
    # very large black text top right + an icon (flag…) + a date line
    - ten: poster
      kieu: poster
      nguon: tap-04/tainguyen/herzl.jpg  # image with the figure (background will be removed)
      nen: tap-05/tainguyen/hom-nay~2.jpg   # background image
      tam_nen: [0.5, 0.6]                # background crop centre (0–1)
      co: anh_bia/co.svg                 # icon next to the first text line (optional)
      chu: ["ISRAEL", "1208 BCE – 2026"]
Commands:
  xp thumbnail new            → create a sample anh_bia.yaml + loi_nhac_anh_bia.md
  xp thumbnail [ten …]        → out/anh_bia_<ten>.jpg + out/anh_bia_xem_truoc.jpg (simulated YouTube home page, to check legibility at small size)
"""
import json, os, shutil, subprocess

def _src(X, spec, dst):
    """source → PNG: an image file, or video@seconds"""
    if '@' in spec and spec.rsplit('@', 1)[0].lower().endswith(('.mp4', '.mov', '.webm', '.mkv')):
        f, t = spec.rsplit('@', 1)
        if not os.path.exists(f): X.die(f'no video {f}')
        X.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(float(t)), '-i', f, '-frames:v', '1', dst])
    else:
        if not os.path.exists(spec):                                         # allow another extension (.jpg/.webp…) with the same name
            alt = [os.path.join(os.path.dirname(spec) or '.', f) for f in os.listdir(os.path.dirname(spec) or '.') if os.path.splitext(f)[0] == os.path.splitext(os.path.basename(spec))[0]] if os.path.isdir(os.path.dirname(spec) or '.') else []
            if not alt: return False
            spec = alt[0]
        from PIL import Image
        Image.open(spec).convert('RGB').save(dst)
    return True

def moi(X):
    if os.path.exists('anh_bia.yaml'): X.die('anh_bia.yaml already exists')
    os.makedirs('anh_bia', exist_ok=True)
    open('anh_bia.yaml', 'w', encoding='utf-8').write(__doc__.split('anh_bia.yaml (in the video or series folder):\n')[1].split('Commands:')[0].replace('\n  ', '\n').lstrip())
    open('loi_nhac_anh_bia.md', 'w', encoding='utf-8').write('# Thumbnail image prompts\n\nPaste each prompt into ChatGPT / Gemini, download the image, save it as `anh_bia/<name>.png`, then run `xp thumbnail`.\n\n'
        'General rules (already in every prompt): 16:9 landscape, photoreal, one clear subject, leave dark empty space for the text, NO text/logos in the image.\n')
    X.log('created anh_bia.yaml + loi_nhac_anh_bia.md + anh_bia/')

def main(a, X):
    import yaml
    from PIL import Image, ImageDraw, ImageFont
    if a.ten and a.ten[0] == 'moi': return moi(X)
    if not os.path.exists('anh_bia.yaml'): X.die('no anh_bia.yaml yet — run: xp thumbnail new')
    C = yaml.safe_load(open('anh_bia.yaml', encoding='utf-8')) or {}; root = X.find_root('.')
    vs = [v for v in C.get('phien_ban', []) if not a.ten or v['ten'] in a.ten]
    if not vs: X.die('no versions in anh_bia.yaml')
    B = 'build/anh_bia'; os.makedirs(B, exist_ok=True); os.makedirs('out', exist_ok=True)
    # 1) source → PNG (flip if needed)
    miss = [v for v in vs if not _src(X, str(v['nguon']), f"{B}/{v['ten']}_nguon.png") or (v.get('nen') and not _src(X, str(v['nen']), f"{B}/{v['ten']}_nen.png")) or (v.get('nguon2') and not _src(X, str(v['nguon2']), f"{B}/{v['ten']}_nguon2.png"))]
    for v in miss: X.log(f"⚠ {v['ten']}: image {v['nguon']} is missing — skipped (generate it from loi_nhac_anh_bia.md)")
    vs = [v for v in vs if v not in miss]
    if not vs: X.die('no source images yet')
    # 2) background removal (one call for all images that need it, run in a separate environment with rembg) — results are cached by source-image content
    import hashlib
    def key(v): return hashlib.sha1(open(f"{B}/{v['ten']}_nguon.png", 'rb').read()).hexdigest()[:16]
    for v in vs:
        cj = json.load(open(f"{B}/{v['ten']}_cat.json", encoding='utf-8')) if os.path.exists(f"{B}/{v['ten']}_cat.json") else {}
        if v.get('tach_nen', True) and cj.get('key') == key(v) and os.path.exists(f"{B}/{v['ten']}_cat.png"): v['_bbox'], v['_dt'] = cj['bbox'], cj['dien_tich']
    need = [v for v in vs if v.get('tach_nen', True) and '_bbox' not in v]
    if need:
        X.log(f'removing background of {len(need)} images (BiRefNet, CPU)…')
        md = os.path.join(root, '.mega-shot', 'models'); os.makedirs(md, exist_ok=True)
        args = sum([[os.path.abspath(f"{B}/{v['ten']}_nguon.png"), os.path.abspath(f"{B}/{v['ten']}_cat.png")] for v in need], [])
        r = subprocess.run(['uv', 'run', '--quiet', '--with', 'rembg[cpu]', 'python', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tachnen.py'), md, *args], capture_output=True, text=True, encoding='utf-8', errors='replace')
        if r.returncode: X.die('background removal failed:\n' + r.stderr[-1500:])
        info = {os.path.basename(json.loads(l)['file']).rsplit('_cat', 1)[0]: json.loads(l) for l in r.stdout.splitlines() if l.startswith('{')}
        for v in need:
            i = info.get(v['ten'], {})
            if not i.get('bbox') or i.get('dien_tich', 0) < .01: X.log(f"⚠ {v['ten']}: no clear subject found — skipping the pop-out effect"); v['tach_nen'] = False
            else:
                v['_bbox'] = i['bbox']; v['_dt'] = i['dien_tich']
                json.dump({'key': key(v), 'bbox': i['bbox'], 'dien_tich': i['dien_tich']}, open(f"{B}/{v['ten']}_cat.json", 'w', encoding='utf-8'))
    # 3) build each version in the browser (text, outline, shadow via CSS)
    pw, b, pg, srv = None, None, None, None; outs = []
    for v in vs:
        cfg = {'nguon': f"/{B}/{v['ten']}_nguon.png", 'cat': f"/{B}/{v['ten']}_cat.png" if v.get('tach_nen', True) else None, 'bbox': v.get('_bbox') or v.get('bbox'),
               'chu': v.get('chu', []), 'bo_cuc': v.get('bo_cuc', 'trai'), 'mau_nhan': v.get('mau_nhan', C.get('mau_nhan', '#ffd400')), 'nhan': v.get('nhan'),
               **{k: v[k] for k in ('zoom', 'zoom_max', 'lat', 'noi', 'vien', 'mau_sang', 'mo_nen', 'sang_nen', 'sang_chu_the', 'font', 'kieu', 'tam_nen', 'cao', 'x_chu_the', 'mau_chu', 'tong', 'ti_le_chu', 'rong_chu', 'vi_tri_chu', 'font_tieu_de') if k in v}}
        if v.get('nen'): cfg['nen'] = f"/{B}/{v['ten']}_nen.png"
        if v.get('nguon2'): cfg['nguon2'] = f"/{B}/{v['ten']}_nguon2.png"
        cfg.update({k: val for k, val in v.items() if k not in cfg and k not in ('ten', 'nguon', 'nen', 'nguon2', 'co', 'tach_nen') and not k.startswith('_')})   # per-style keys (so, diem, nhan1, nam, mau_nen…)
        if v.get('co'): cfg['co'] = '/' + str(v['co']).replace(chr(92), '/').lstrip('/')
        jp = f"{B}/{v['ten']}.json"; json.dump(cfg, open(jp, 'w', encoding='utf-8'), ensure_ascii=False)
        url = f"ms/core/anhbia.html?cfg=/{jp}&v={os.path.getmtime(jp):.0f}"
        if not pg: pw, b, pg, srv = X.browser(url)
        else:
            pg.goto(f'http://127.0.0.1:{srv.server_port}/{url}'); pg.wait_for_function('window.READY === true', timeout=60000)
        o = f"out/anh_bia_{v['ten']}.jpg"; pg.screenshot(path=o, type='jpeg', quality=92, clip={'x': 0, 'y': 0, 'width': 1280, 'height': 720}); outs.append((v, o))
        X.log(f"{o} · {os.path.getsize(o) / 1024:.0f} KB" + (f" · subject {v['_dt']:.0%} of frame" if v.get('_dt') else ''))
    b.close(); pw.stop(); srv.shutdown()
    # 4) YouTube home-page style preview: desktop size (360×202) and phone/search size (168×94)
    allv = [(v, f"out/anh_bia_{v['ten']}.jpg") for v in C.get('phien_ban', []) if os.path.exists(f"out/anh_bia_{v['ten']}.jpg")]
    fdir = os.path.join(root, '.mega-shot', 'fonts'); F = lambda s, w='ExtraBold': ImageFont.truetype(os.path.join(fdir, f'BeVietnamPro-{w}.ttf'), s)
    n = len(allv); Wc = 40 + n * 380; im = Image.new('RGB', (max(Wc, 760), 560), '#0f0f0f'); d = ImageDraw.Draw(im)
    d.text((40, 18), 'Preview as on the YouTube home page', font=F(20), fill='#f1f1f1')
    title = C.get('tieu_de_video') or os.path.basename(os.getcwd())
    import glob; vid = sorted(glob.glob('out/*_youtube.mp4') + glob.glob('out/*.mp4'), key=lambda f: ('xem_thu' in f, f))
    dur = X.dur_of(vid[0]) if vid else 754; dlabel = (f"{int(dur // 3600)}:{int(dur % 3600 // 60):02d}:{int(dur % 60):02d}" if dur >= 3600 else f"{int(dur // 60)}:{int(dur % 60):02d}")
    for k, (v, o) in enumerate(allv):
        x = 40 + k * 380; t = Image.open(o).resize((360, 202), Image.LANCZOS); im.paste(t, (x, 56))
        d.rounded_rectangle((x + 360 - 52, 56 + 202 - 26, x + 360 - 6, 56 + 202 - 6), 4, fill='#000000cc'); d.text((x + 360 - 47, 56 + 202 - 26), dlabel, font=F(14, 'Black'), fill='white')
        d.ellipse((x, 270, x + 36, 306), fill='#3a3a3a'); d.text((x + 48, 268), title[:34], font=F(16), fill='#f1f1f1'); d.text((x + 48, 292), f"Version: {v['ten']}", font=F(13), fill='#aaaaaa')
        s = Image.open(o).resize((168, 94), Image.LANCZOS); im.paste(s, (x, 360)); d.text((x + 180, 362), 'Phone size /', font=F(13), fill='#aaaaaa'); d.text((x + 180, 380), 'search results', font=F(13), fill='#aaaaaa')
    d.text((40, 480), 'Tip: the text must be legible in the bottom row (small size). The bottom-right corner is covered by the duration label — do not put text there.', font=F(14), fill='#aaaaaa')
    d.text((40, 504), 'YouTube Studio > Test & compare: upload up to 3 versions and let YouTube pick the best performer.', font=F(14), fill='#aaaaaa')
    im.save('out/anh_bia_xem_truoc.jpg', quality=90); X.log(f'out/anh_bia_xem_truoc.jpg · {n} versions')
