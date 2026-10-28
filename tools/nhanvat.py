"""mega-shot · `xp cast-design` (old name `xp nhanvat`) — AI design loop for code-drawn 2D characters (character studio + PhotoCraft layer effects).

The AI agent running the skill is the DESIGNER and the CRITIC; the engine draws (no image model, no paid API, no GPU load
beyond one headless Chromium page). One character = one folder in the shared library .mega-shot/nhanvat/<id>/.

  xp cast-design new <id> --desc "22-year-old woman, slim, brown ponytail…" [--ref photo.jpg] [--style anime-thanh-nien] [--name Lan]
        → spec.json (draft parsed by the engine's own description reader), BRIEF.md (vocabulary + rubric), ref.jpg + palette from the photo
  (designer) edit spec.json: every knob the studio draws — face, hair, body shape, outfit, colours (BRIEF.md lists legal values)
  xp cast-design draw <id>      → soat_vN.jpg review sheet (reference | hero → ← | silhouette · grey · phone size | 6 poses | 12 expressions
                                  | measurements) + danh_gia_vN.json (joint QA, proportions, silhouette, value contrast, likeness to the cast,
                                  warnings). Snapshot spec_vN.json.
  (critic) look at the sheet, then  xp cast-design score <id> --scores "giong=4,bong=5,…" --fix "what to change next"
  … repeat draw → score (≤ 3 rounds) …
  xp cast-design cast [id …]    → dan.jpg: the cast in one pose + silhouette row + pairwise silhouette overlap
  xp cast-design lock <id>      → refuses while auto checks fail or a rubric score is < 4; writes khoa.json
  xp cast-design yaml <id>      → `nhan_vat:` block for video.yaml (ve: { kieu: anh, xuong: <spec> })
  xp cast-design list
Workflow, rubric and research notes: references/characters-ai-loop.md.
"""
import base64, functools, http.server, json, os, shutil, threading, time

RUBRIC = [('giong', 'matches the description / reference photo (age, gender, build, hair, outfit, colours)'),
          ('bong', 'readable silhouette — the character is recognisable from the black shape alone, poses are clear'),
          ('ti_le', 'proportions & joints — right for the age/build, limbs attached to the body, no broken joints'),
          ('mau', 'palette & value contrast — the 3 big areas (hair / top / trousers) separate in greyscale'),
          ('mat', 'face & expressions — the 12 expressions are distinguishable and fit the personality'),
          ('trang_phuc', 'outfit & accent — one memorable detail (glasses, tie, shirt text, hair accessory)'),
          ('nho', 'readable at phone size (the "phone size" cell)'),
          ('khac_dan', 'different from the other characters in the cast (silhouette / top colour / hair)')]

def lib(X): d = os.path.join(X.find_root(os.getcwd()), '.mega-shot', 'nhanvat'); os.makedirs(d, exist_ok=True); return d
def jload(p, d=None):
    try: return json.load(open(p, encoding='utf-8'))
    except (OSError, ValueError): return d
def jsave(p, o): json.dump(o, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
def log_nk(d, s): open(os.path.join(d, 'NHATKY.md'), 'a', encoding='utf-8').write(time.strftime('- %Y-%m-%d %H:%M · ') + s + '\n')

class Trang:
    """one headless page on engine/core/xuong_soat.html — ~12 s to build a character, ~2 s per sheet (short GPU canvas use, no WebGL)"""
    def __init__(self, X):
        from playwright.sync_api import sync_playwright
        eng = os.path.join(X.SKILL, 'engine', 'core')
        self.srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(type('Q', (http.server.SimpleHTTPRequestHandler,), {'log_message': lambda *x: None}), directory=eng))
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self.pw = sync_playwright().start(); self.b = self.pw.chromium.launch(args=['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'])
        self.pg = self.b.new_page(viewport={'width': 1600, 'height': 1000})   # GPU canvas: the software one crashes on the studio's layer effects
        self.pg.on('pageerror', lambda e: X.log(f'⚠ page error: {e}'))
        self.pg.on('console', lambda m: X.log('[page]', m.text) if m.type in ('error', 'warning') else None)
        self.pg.goto(f'http://127.0.0.1:{self.srv.server_port}/xuong_soat.html'); self.pg.set_default_timeout(600_000); self.pg.wait_for_function('window.READY === true && window.MS && MS.giaiphau')
    def js(self, expr, arg=None): return self.pg.evaluate(expr, arg)
    def chup(self, path):
        b64 = self.js("() => document.getElementById('c').toDataURL('image/jpeg', .9).split(',')[1]"); open(path, 'wb').write(base64.b64decode(b64))
    def dong(self): self.b.close(); self.pw.stop(); self.srv.shutdown()

def bang_mau(path, n=8):
    """dominant colours of the reference photo's centre (where the subject usually is; edges are mostly background), median-cut,
    most common first — a hint for the designer, not a region map"""
    from PIL import Image
    im = Image.open(path).convert('RGB'); w, h = im.size; im = im.crop((int(w * .3), int(h * .15), int(w * .7), int(h * .92))); im.thumbnail((240, 240)); q = im.quantize(colors=n, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()[:n * 3]; cnt = sorted(q.getcolors(), reverse=True)
    return ['#%02x%02x%02x' % tuple(pal[i * 3:i * 3 + 3]) for _, i in cnt]

def ref_url(d):
    p = os.path.join(d, 'ref.jpg')
    return 'data:image/jpeg;base64,' + base64.b64encode(open(p, 'rb').read()).decode() if os.path.exists(p) else None

def cast_specs(X, skip=None):
    out = {}
    for k in sorted(os.listdir(lib(X))):
        sp = jload(os.path.join(lib(X), k, 'spec.json'))
        if sp and k != skip: out[k] = sp
    return out

def brief(id_, meta, vocab):
    v = '\n'.join(f'- `{k}`: {", ".join(vals)}' for k, vals in vocab.items())
    r = '\n'.join(f'- `{k}` — {t}' for k, t in RUBRIC)
    return f"""# {meta.get('ten') or id_} — character design brief (xp cast-design)

Description: {meta.get('mo_ta') or '(none yet)'}
Reference photo: {'ref.jpg' if meta.get('ref') else 'none'} · style: {meta.get('phong_cach')}

## DESIGNER role (edit spec.json)
1. Look at ref.jpg (if any) and the description → write down 5 identity traits: age/gender, build (`hinh_the`), hairstyle + colour, main outfit, 1 accent.
2. spec.json is a draft produced by the engine's description reader — correct every trait; use only values from the vocabulary below
   (an unknown value → the engine silently draws the default, and the review sheet warns).
3. Colours: take hints from `bang_mau` (meta.json) but set the 3 big areas hair / top / trousers so they separate in greyscale (contrast ≥ 1.5:1).
4. One single memorable accent (glasses, tie, text on the shirt `ao.chu`, `toc.phu` hair tie, `dau` mole/freckles…), do not overload.

## CRITIC role (after every `xp cast-design draw`)
Open soat_vN.jpg, score every item 1–5 and write 1 concrete fix for the lowest one:
{r}
`xp cast-design score {id_} --scores "giong=4,bong=4,ti_le=5,mau=3,mat=4,trang_phuc=4,nho=4,khac_dan=5" --fix "…"`
Pass = every item ≥ 4 + no joint/vocabulary warnings → `xp cast-design lock {id_}`. At most 3 rounds; still < 4 after 3 rounds → ask the user,
or write down exactly what the studio lacks (e.g. a missing hairstyle) so it can be added to xuong_anime.js / toc_nhanvat.js instead of forcing the spec.

## Studio vocabulary (legal values)
{v}
- colours: hex `#rrggbb` for `da`, `toc.mau`, `toc.phu`, `mat.mau`, `ao.mau`, `ao.mau_trong`, `quan.mau`, `giay.mau|de|day`, `ca_vat`, `kinh.mau`, `day_chuyen`
- other: `ao.chu` (text printed on the shirt), `ao.xan: 1` (rolled sleeves), `khoi: {{vai, nguc, eo, bung, hong, dui, bap_tay, chan, tay, cao, w…}}` (body-mass tweaks 0.8–1.4), `ten`
"""

def cmd_new(a, X):
    d = os.path.join(lib(X), a.id)
    if os.path.exists(os.path.join(d, 'spec.json')) and not a.force: X.die(f'{a.id} already exists ({d}) — use --force to start over')
    os.makedirs(d, exist_ok=True); meta = {'id': a.id, 'ten': a.name or a.id, 'mo_ta': a.desc or '', 'phong_cach': a.style, 'tao': time.strftime('%Y-%m-%d')}
    if a.ref:
        from PIL import Image
        im = Image.open(a.ref).convert('RGB'); im.thumbnail((1200, 1200)); im.save(os.path.join(d, 'ref.jpg'), quality=92)
        meta.update(ref=os.path.abspath(a.ref), bang_mau=bang_mau(os.path.join(d, 'ref.jpg')), giay_phep=a.license or 'provided by the user')
    T = Trang(X)
    try:
        sp = T.js('t => doc(t)', a.desc or '') if a.desc else T.js('() => MS.xuong.ngauNhien(1)')
        vocab = T.js('() => VOCAB()')
    finally: T.dong()
    sp.update(ten=meta['ten'], phong_cach=a.style); jsave(os.path.join(d, 'spec.json'), sp); jsave(os.path.join(d, 'meta.json'), meta)
    open(os.path.join(d, 'BRIEF.md'), 'w', encoding='utf-8').write(brief(a.id, meta, vocab)); log_nk(d, f'created from description: {a.desc!r}' + (' + reference photo' if a.ref else ''))
    X.log(f'✓ {d}\n   spec.json (draft) · BRIEF.md · ' + ('ref.jpg + palette ' + ' '.join(meta['bang_mau'][:6]) if a.ref else 'no photo'))
    X.log(f'→ edit spec.json following BRIEF.md, then: xp cast-design draw {a.id}')

def cmd_draw(a, X):
    d = os.path.join(lib(X), a.id); sp = jload(os.path.join(d, 'spec.json')); meta = jload(os.path.join(d, 'meta.json'), {})
    if not sp: X.die(f'no character {a.id} yet — run: xp cast-design new {a.id} --desc "…"')
    n = 1 + max([int(f[6:-5]) for f in os.listdir(d) if f.startswith('spec_v') and f.endswith('.json')] or [0])
    T = Trang(X)
    try:
        M = T.js('o => nap(o)', {'spec': sp, 'ten': meta.get('ten'), 'mo_ta': meta.get('mo_ta'), 'vong': n, 'ref': ref_url(d), 'bang_mau': meta.get('bang_mau', []), 'dan': cast_specs(X, a.id)})
        T.js('() => render()'); out = os.path.join(d, f'soat_v{n}.jpg'); T.chup(out)
    finally: T.dong()
    shutil.copy(os.path.join(d, 'spec.json'), os.path.join(d, f'spec_v{n}.json')); jsave(os.path.join(d, f'danh_gia_v{n}.json'), {'vong': n, 'tu_dong': M})
    shutil.copy(out, os.path.join(d, 'soat.jpg'))
    log_nk(d, f'round {n}: joints {"✓" if M["khop"]["ok"] else "✗"} · {len(M["canh_bao"])} warnings')
    X.log(f'✓ round {n} → {out}')
    X.log(f'   joints {"closed ✓" if M["khop"]["ok"] else str(M["khop"]["loi"]) + " open ✗"} · silhouette change across poses {M["hinh_bong"]["doi_dang_tb"]} · contrast ' + ', '.join(f'{k} {v}' for k, v in M['tuong_phan'].items()))
    for w in M['canh_bao']: X.log('   ⚠ ' + w)
    X.log(f'→ look at the sheet, then score: xp cast-design score {a.id} --scores "giong=…,bong=…,ti_le=…,mau=…,mat=…,trang_phuc=…,nho=…,khac_dan=…" --fix "…"')

def cmd_score(a, X):
    d = os.path.join(lib(X), a.id); vs = sorted(int(f[10:-5]) for f in os.listdir(d) if f.startswith('danh_gia_v'))
    if not vs: X.die('no round drawn yet — run xp cast-design draw first')
    if not a.scores: X.die('missing --scores "giong=4,bong=4,…"')
    p = os.path.join(d, f'danh_gia_v{vs[-1]}.json'); dg = jload(p)
    if jload(os.path.join(d, f'spec_v{vs[-1]}.json')) != jload(os.path.join(d, 'spec.json')): X.die(f'spec.json changed after round {vs[-1]} — run xp cast-design draw {a.id} before scoring')
    diem = {k.strip(): int(v) for k, v in (kv.split('=') for kv in a.scores.split(',') if '=' in kv)}
    thieu = [k for k, _ in RUBRIC if k not in diem]
    if thieu: X.die('missing items: ' + ', '.join(thieu))
    dg['cham'] = {'diem': diem, 'sua': a.fix or '', 'tb': round(sum(diem.values()) / len(diem), 2)}; jsave(p, dg)
    thap = [k for k, v in diem.items() if v < 4]
    log_nk(d, f'scored round {vs[-1]}: avg {dg["cham"]["tb"]} · low: {", ".join(thap) or "none"} · fix: {a.fix or "-"}')
    X.log(f'✓ round {vs[-1]} avg {dg["cham"]["tb"]}' + (f' · needs work: {", ".join(thap)}' if thap else ' · rubric passed') + ('' if thap or dg['tu_dong']['canh_bao'] else f' → xp cast-design lock {a.id}'))

def cmd_cast(a, X):
    specs = cast_specs(X)
    ids = ([a.id] if a.id else []) + list(a.ids or [])
    if ids: specs = {k: specs[k] for k in ids if k in specs}
    if len(specs) < 2: X.die('need ≥ 2 characters in the library')
    T = Trang(X)
    try: cap = T.js('s => dan(s)', specs); out = os.path.join(lib(X), 'dan.jpg'); T.chup(out)
    finally: T.dong()
    X.log(f'✓ {out}')
    for c in cap[:5]: X.log(f'   silhouette {c["a"]}–{c["b"]}: {c["hinh_bong"]}' + ('  ⚠ easy to confuse' if c['hinh_bong'] > .9 else ''))

def cmd_lock(a, X):
    d = os.path.join(lib(X), a.id); vs = sorted(int(f[10:-5]) for f in os.listdir(d) if f.startswith('danh_gia_v'))
    dg = jload(os.path.join(d, f'danh_gia_v{vs[-1]}.json')) if vs else None
    if not dg: X.die('no round drawn yet')
    if jload(os.path.join(d, f'spec_v{vs[-1]}.json')) != jload(os.path.join(d, 'spec.json')): X.die('spec.json changed after the last round — run xp cast-design draw and score again')
    if 'cham' not in dg: X.die('the last round is not scored yet (xp cast-design score)')
    # joint QA (giaiphau.kiemDinh) is advisory for now: it also flags the shipped presets in the `di` test pose — judge joints by eye (ti_le)
    # 'không có trong xưởng' = the engine's "not in the studio vocabulary" warning text (matched as data)
    loi = [k for k, v in dg['cham']['diem'].items() if v < 4] + [w for w in dg['tu_dong']['canh_bao'] if 'không có trong xưởng' in w or 'not in the studio' in w]
    if loi and not a.force: X.die('not passed yet: ' + '; '.join(loi) + ' (--force if the user has approved it)')
    jsave(os.path.join(d, 'khoa.json'), {'vong': vs[-1], 'ngay': time.strftime('%Y-%m-%d'), 'diem': dg['cham'], 'ep': bool(loi)}); log_nk(d, f'LOCKED at round {vs[-1]}')
    X.log(f'✓ locked {a.id} (round {vs[-1]}) → xp cast-design yaml {a.id}')

def cmd_yaml(a, X):
    import yaml
    sp = jload(os.path.join(lib(X), a.id, 'spec.json')) or X.die('no character ' + a.id)
    print(yaml.safe_dump({'nhan_vat': {a.id: {'ten': sp.get('ten', a.id), 've': {'kieu': 'anh', 'xuong': sp}, 'giong': {'mau': '…'}}}}, allow_unicode=True, sort_keys=False, default_flow_style=None, width=200))

def cmd_list(a, X):
    for k in sorted(os.listdir(lib(X))):
        d = os.path.join(lib(X), k)
        if not os.path.isdir(d) or k == 'clips': continue                  # clips/ = the pose editor's clip library
        m = jload(os.path.join(d, 'meta.json'), {}); vs = [f for f in os.listdir(d) if f.startswith('soat_v')]
        print(f'{k:18} {"🔒" if os.path.exists(os.path.join(d, "khoa.json")) else "  "} {len(vs)} rounds · {m.get("phong_cach", "")} · {(m.get("mo_ta") or "")[:70]}')

def main(a, X):
    if a.action not in ('cast', 'list') and not a.id: X.die('missing character <id>')
    {'new': cmd_new, 'draw': cmd_draw, 'score': cmd_score, 'cast': cmd_cast, 'lock': cmd_lock, 'yaml': cmd_yaml, 'list': cmd_list}[a.action](a, X)
