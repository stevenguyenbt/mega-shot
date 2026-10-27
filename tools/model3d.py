"""mega-shot · `xp model` — reusable procedural 3D models rebuilt from a reference image (library3d.js, references/models3d.md).

  xp model new <name> --from <image | pixabay:ID> [--license "…"] [--height 1.2] [--nguoi]   (--nguoi: a person fitted to the reference)
        → .mega-shot/models3d/<name>/ : ref.jpg, meta.json, NOTES.md (detail inventory), model.js (starter you then write)
  xp model check <name> [--time 0]   → review_<pass>.jpg + review.jpg : reference | front | three-quarter | side | grazing  (look at it, fix, repeat 2–3×)
  xp model list                   → every model with size, triangle count, source

The short loop is adapted from img2threejs (Apache-2.0, github.com/img2threejs/img2threejs): inventory → blockout → form →
materials, judging each pass against the reference under neutral, grazing and reference-matched light. Images from Pixabay are
downloaded through the API key in .mega-shot/keys.env (never printed); local images need the rights holder's licence in --license.
"""
import base64, functools, http.server, io, json, os, sys, re, shutil, threading, time, urllib.parse, urllib.request

STARTER = '''// {name} — procedural Three.js model (mega-shot model library). Reference: ref.jpg · {source}
// Contract: sits on y = 0, faces +z, height ≈ meta.height. Build with geo (roundedBox, lathe, fluted, taper, plate, blade, scatter, lump)
// and mat3d presets (wood, wood-varnish, wood-toy, steel, brushed-steel, iron, gold, bronze, copper, stone, marble, earth, glass,
// frosted-glass, water, fabric, silk, velvet, leather, fur, skin, ceramic, paper, wax, plastic …). Parts overlap 0.02–0.05.
export const meta = {meta};
export default function build({{ THREE, mat3d, geo, o }}) {{
  const G = new THREE.Group(), {{ roundedBox, lathe, taper }} = geo;
  // PASS 1 · blockout: main masses with correct proportions (compare silhouette in the front view)
  const body = new THREE.Mesh(roundedBox(.6, 1, .4), mat3d('matte-plastic', {{ color: 0x888888 }})); body.position.y = .5; G.add(body);
  // PASS 2 · form: bevels, tapers, secondary parts · PASS 3 · materials + small details (instanced repeats)
  return {{ group: G, update(s) {{}} }};
}}
'''
STARTER_PERSON = '''// {name} — a person rebuilt from ref.jpg with people3d.js (mega-shot model library) · {source}
// 1) fill `nguoi` from the reference (start from the closest thoi_dai preset, then override colours / hair / headwear / shoes)
// 2) add what the presets lack in chi_tiet(): emblems, jewellery, patterns, weapons, props — attach to F.B (body), F.head, F.aR.lo (right forearm) …
// Use in a scene: canh3d: {{ …, nguoi: {name} }} (main figure) or nguoi_khac: [{name}, …] (next figures). Fields: references/models3d.md
export const meta = {meta};
export const nguoi = {{ gioi: 'nam', da: 2, thoi_dai: 'hien-dai', toc: 'ngan', mau_toc: 'den' }};
export function chi_tiet(F, {{ THREE, mat3d, geo }}) {{}}
export default function build({{ THREE, mat3d, geo, person, o }}) {{
  const F = person({{ ...nguoi, ...(o.nguoi || {{}}) }}); chi_tiet(F, {{ THREE, mat3d, geo }});
  return {{ group: F.G, rig: F, update(s) {{ F.rest(); F.breathe(s.t || 0); }} }};
}}
'''
NOTES_PERSON = '''# {name} — character sheet (fill from ref.jpg before writing `nguoi`)

Reference: ref.jpg · {source} · licence: {license}
Who / era / role:

## Read from the reference
- gender · apparent age · skin tone (1 light … 6 deep):
- hair (style, colour) · beard / moustache:
- headwear (type, colour):
- garment layers top → bottom (type, length, sleeves, colours hex):
- collar / sash / belt / drape / cape:
- footwear:
- signature details (emblem, jewellery, weapon, prop, pattern) → chi_tiet():

## Pass log
- pass 1:
'''
NOTES = '''# {name} — detail inventory (fill before modelling; update after each check)

Reference: ref.jpg · {source} · licence: {license}

## Silhouette & proportions (front view)
- overall height : width : depth ≈
- main masses (top → bottom):

## Parts (one line each: shape primitive · size relative to height · material preset · colour hex)
-

## Materials
-

## Details worth modelling (only what reads at video size)
-

## Pass log
- pass 1 blockout:
- pass 2 form:
- pass 3 materials:
'''

def _keys(root):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import keys
    return keys.load(root)                                                        # env > .env > .mega-shot/keys.env

def _fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'mega-shot/1.0'})
    with urllib.request.urlopen(req, timeout=60) as r: return r.read()

def cmd_new(a, X, root):
    d = os.path.join(root, '.mega-shot', 'models3d', a.name)
    if os.path.exists(os.path.join(d, 'model.js')) and not a.force: X.die(f'{d} already has model.js (use --force to re-create the starter files)')
    if not a.src: X.die('--from <image path | pixabay:ID> is required')
    os.makedirs(d, exist_ok=True); src, lic = a.src, a.license
    m = re.match(r'pixabay:(\d+)$', src)
    if m:
        key = _keys(root).get('PIXABAY_API_KEY') or X.die('PIXABAY_API_KEY missing in .mega-shot/keys.env')
        h = json.loads(_fetch(f'https://pixabay.com/api/?key={key}&id={m.group(1)}')).get('hits') or X.die(f'Pixabay image {m.group(1)} not found')
        h = h[0]; open(os.path.join(d, 'ref.jpg'), 'wb').write(_fetch(h.get('largeImageURL') or h['webformatURL']))
        src, lic = h['pageURL'], lic or f"Pixabay Content License · {h.get('user', '')}"
    else:
        if not os.path.exists(src): X.die(f'image not found: {src}')
        if not lic: X.die('local image: add --license "…" (who owns it / permission) before using it as a reference')
        from PIL import Image
        Image.open(src).convert('RGB').save(os.path.join(d, 'ref.jpg'), quality=94)
        src = os.path.basename(src)                                                # never store a local path (privacy, shareable library)
    meta = {'name': a.name, 'height': a.height, 'ref': 'ref.jpg', 'source': src, 'license': lic, 'created': time.strftime('%Y-%m-%d')}
    json.dump(meta, open(os.path.join(d, 'meta.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    if a.nguoi: meta['height'] = 1.76; meta['kind'] = 'nguoi'
    open(os.path.join(d, 'model.js'), 'w', encoding='utf-8').write((STARTER_PERSON if a.nguoi else STARTER).format(name=a.name, source=src, meta=json.dumps(meta, ensure_ascii=False)))
    if not os.path.exists(os.path.join(d, 'NOTES.md')) or a.force: open(os.path.join(d, 'NOTES.md'), 'w', encoding='utf-8').write((NOTES_PERSON if a.nguoi else NOTES).format(name=a.name, source=src, license=lic))
    X.log(f'✓ {os.path.relpath(d, root)} · ref.jpg + meta.json + NOTES.md + model.js (starter)')
    X.log('next: look at ref.jpg → fill NOTES.md → write model.js → xp model check ' + a.name)

def _server(X, root):
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(X.Handler, directory=X.ENGINE)); srv.root = root
    threading.Thread(target=srv.serve_forever, daemon=True).start(); return srv

def cmd_check(a, X, root):
    d = os.path.join(root, '.mega-shot', 'models3d', a.name)
    if not os.path.exists(os.path.join(d, 'model.js')): X.die(f'no model "{a.name}" — xp model new {a.name} --from …')
    from PIL import Image, ImageDraw, ImageFont
    from playwright.sync_api import sync_playwright
    srv = _server(X, root); S = a.size; shots = {}
    with sync_playwright() as pw:
        b = pw.chromium.launch(args=['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']); pg = b.new_page(viewport={'width': S, 'height': S})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: m.type == 'error' and errs.append(m.text))
        pg.goto(f'http://127.0.0.1:{srv.server_port}/core/model_view.html?ten={urllib.parse.quote(a.name)}&size={S}&v={time.time()}')
        t0 = time.time()
        while not pg.evaluate('window.READY === true'):
            err = pg.evaluate('window.ERR || null') or (errs[0] if errs else None)
            if err: b.close(); srv.shutdown(); X.die(f'model.js error: {err}')
            if time.time() - t0 > 120: b.close(); srv.shutdown(); X.die('model view not ready after 120 s')
            pg.wait_for_timeout(150)
        meta = pg.evaluate('window.META')
        for v in pg.evaluate('window.VIEWS'): shots[v] = Image.open(io.BytesIO(base64.b64decode(pg.evaluate(f'render({v!r}, {a.t})').split(',', 1)[1]))).convert('RGB')
        b.close()
    srv.shutdown()
    ref = Image.open(os.path.join(d, 'ref.jpg')).convert('RGB'); ref.thumbnail((S, S)); rc = Image.new('RGB', (S, S), (142, 147, 155)); rc.paste(ref, ((S - ref.width) // 2, (S - ref.height) // 2))
    tiles = [('reference', rc)] + list(shots.items()); sheet = Image.new('RGB', (S * len(tiles), S + 44), (24, 26, 30)); g = ImageDraw.Draw(sheet)
    try: f = ImageFont.truetype(os.path.join(root, '.mega-shot', 'fonts', 'BeVietnamPro-ExtraBold.ttf'), 24)
    except Exception: f = ImageFont.load_default()
    for i, (lab, im) in enumerate(tiles): sheet.paste(im, (i * S, 44)); g.text((i * S + 14, 9), lab.upper(), fill=(255, 211, 106) if i == 0 else (230, 230, 230), font=f)
    n = len([x for x in os.listdir(d) if re.match(r'review_\d+\.jpg$', x)]) + 1
    sheet.save(os.path.join(d, f'review_{n}.jpg'), quality=90); sheet.save(os.path.join(d, 'review.jpg'), quality=90)
    X.log(f'✓ {os.path.relpath(os.path.join(d, "review.jpg"), root)} (pass {n}) · size {meta.get("size")} · {meta.get("triangles")} triangles')
    if meta.get('triangles', 0) > 400_000: X.log('⚠ heavy model (> 400k triangles) — lower segments or use scatter() instancing')

def cmd_list(a, X, root):
    base = os.path.join(root, '.mega-shot', 'models3d'); found = False
    for n in sorted(os.listdir(base)) if os.path.isdir(base) else []:
        mf = os.path.join(base, n, 'meta.json')
        if not os.path.exists(os.path.join(base, n, 'model.js')): continue
        m = json.load(open(mf, encoding='utf-8')) if os.path.exists(mf) else {}; found = True
        rv = len([x for x in os.listdir(os.path.join(base, n)) if re.match(r'review_\d+\.jpg$', x)])
        X.log(f'{n:22} height {m.get("height", "?")} · {rv} review pass(es) · {m.get("source", "")}')
    if not found: X.log('no models yet — xp model new <name> --from pixabay:<id>')

def main(a, X):
    root = X.find_root('.')
    if a.action != 'list' and not a.name: X.die('name required: xp model ' + a.action + ' <name>')
    {'new': cmd_new, 'check': cmd_check, 'list': cmd_list}[a.action](a, X, root)
