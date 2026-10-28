"""xp redraw (old name `xp ve-lai`) — redraw a flat illustration (flat / cel, ink lines) as SVG in code, recolour it, and extend it (e.g. to full body).

  xp redraw phan-tich <image> [--out folder]     → phan_tich.json (palette, ink, line widths, thin coloured lines, warnings) + phan_tich.jpg
     (the AI reads the printed summary; edits phan_tich.json if needed: rename colours, merge/drop colours, change loai) — then draws
  xp redraw ve <folder>                          → ve.svg + ve.png + so.jpg (original | drawing | difference) + so_zoom.jpg (worst tile) + so.json
  xp redraw doi-mau <folder> --doi "ao=#d5523f" [--doi "#5b9ead=#e9b23a"] [--name ao_do]
  xp redraw mo-rong <folder> --canvas 736x1280 [--dat 0,0] [--them them.json|them.svg] [--name toan_than]
     without --them: writes MO_RONG.md (style + the lines cut at the image edges) + a them.json template for the AI to continue
     with --them: joins <g id="duoi"> (under the original) + the original + <g id="tren"> → <name>.svg/.png
  xp redraw rig <folder> [--them rig_ve.json]   → cut-out character in .mega-shot/nhanvat/<id>/bo/ (see references/ve-lai.md)
  (English action aliases: analyse = phan-tich, draw = ve, recolor = doi-mau, extend = mo-rong)

Method (references/ve-lai.md): image upscaled ×3–4 (Lanczos) → every pixel = (1−a)·fill colour + a·ink (separates lines from
anti-aliasing; pure colours preferred) → fill labels mode-filtered, thin coloured lines kept → ink thresholded at HALF the local
maximum darkness (thin/faint lines do not break) → marching squares → RDP → Catmull-Rom. Nothing extra to install (numpy + pillow + playwright from xp).
"""
import colorsys, json, os, pathlib, re, shutil, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

PEN = 2500.0          # penalty per unit of ink: a pure colour wins unless the pixel really is mixed with ink


def hx(c): return '#%02x%02x%02x' % tuple(int(round(v)) for v in c)
def rgb(h): h = h.lstrip('#'); return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], np.float32)
def lum(c): return float(np.dot(c, [.299, .587, .114]))
def font(n):
    for f in ('C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
        if os.path.exists(f): return ImageFont.truetype(f, n)
    return ImageFont.load_default()
def filt(m, f): return np.asarray(Image.fromarray(m).filter(f))
def blur(a, s): return np.asarray(Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(s))).astype(np.float32) / 255


# ---------------- analysis ----------------
def unmix(im, fills, ink):
    """→ (label of the fill colour under the ink, ink coverage a) for every pixel."""
    v = ink - fills  # (k,3)
    best_r = best_a = best_k = None
    for k in range(len(fills)):
        d = im - fills[k]; a = np.clip((d @ v[k]) / float(v[k] @ v[k]), 0, 1)
        r = ((d - a[..., None] * v[k]) ** 2).sum(-1) + PEN * a
        if best_r is None: best_r, best_a, best_k = r, a, np.zeros(r.shape, np.int16)
        else: m = r < best_r; best_r = np.where(m, r, best_r); best_a = np.where(m, a, best_a); best_k = np.where(m, k, best_k)
    return best_k, best_a


def width_stats(mask):
    """line width (px) on the line ridge: number of erosions (MinFilter 3) survived → 2k+1."""
    T = np.zeros(mask.shape, np.int16); cur = mask.astype(np.uint8) * 255
    for k in range(1, 16):
        cur = filt(cur, ImageFilter.MinFilter(3))
        if not cur.any(): break
        T += cur > 0
    ridge = mask & (T >= filt(T.astype(np.uint8), ImageFilter.MaxFilter(3)))
    w = 2 * T[ridge] + 1
    return {'p10': float(np.percentile(w, 10)), 'median': float(np.median(w)), 'p90': float(np.percentile(w, 90))} if w.size else None


def phan_tich(src, out):
    os.makedirs(out, exist_ok=True)
    I = Image.open(src).convert('RGB'); W, H = I.size; im = np.asarray(I).astype(np.float32)
    if pathlib.Path(src).resolve() != (pathlib.Path(out) / 'goc.png').resolve(): I.save(os.path.join(out, 'goc.png'))
    L8 = np.asarray(I.convert('L'))
    flat = (filt(L8, ImageFilter.MaxFilter(5)).astype(int) - filt(L8, ImageFilter.MinFilter(5))) < 12      # flat pixels (not anti-aliased edges)
    px = im[flat]; rs = np.random.default_rng(0); px = px[rs.choice(len(px), min(len(px), 200000), replace=False)]
    q = Image.fromarray(px.reshape(1, -1, 3).astype(np.uint8)).quantize(24, method=Image.Quantize.MEDIANCUT)
    C = np.array(q.getpalette()[:72], np.float32).reshape(-1, 3)
    for _ in range(10):   # k-means
        lab = ((px[:, None] - C[None]) ** 2).sum(-1).argmin(1)
        C = np.array([px[lab == k].mean(0) if (lab == k).any() else C[k] for k in range(len(C))], np.float32)
    n = np.bincount(lab, minlength=len(C)).astype(float)
    while True:   # merge close colours (difference < 18 RGB)
        keep = n > 0; idx = np.nonzero(keep)[0]; best = None
        for i in range(len(idx)):
            for j in range(i + 1, len(idx)):
                d = np.linalg.norm(C[idx[i]] - C[idx[j]])
                if d < 18 and (best is None or d < best[0]): best = (d, idx[i], idx[j])
        if not best: break
        _, i, j = best; C[i] = (C[i] * n[i] + C[j] * n[j]) / (n[i] + n[j]); n[i] += n[j]; n[j] = 0
    idx = [k for k in np.nonzero(n)[0] if n[k] / n.sum() > .0008]
    C = C[idx]; n = n[idx]
    # background = most common colour on the image border; ink = darkest colour
    border = np.concatenate([im[0], im[-1], im[:, 0], im[:, -1]])
    bg = int(np.bincount(((border[:, None] - C[None]) ** 2).sum(-1).argmin(1), minlength=len(C)).argmax())
    ink = int(np.argmin([lum(c) for c in C]))
    if lum(C[ink]) > 90: ink = None
    fills = [k for k in range(len(C)) if k != ink]
    lab, a = unmix(im, C[fills], C[ink] if ink is not None else np.zeros(3, np.float32))
    full = np.array(fills)[lab]
    if ink is not None: full = np.where(a > .55, ink, full)
    mau = []
    for k in range(len(C)):
        m = full == k; area = float(m.mean())
        core = filt(m.astype(np.uint8) * 255, ImageFilter.MinFilter(5)) > 0
        loai = 'nen' if k == bg else 'muc' if k == ink else ('mong' if m.sum() > 30 and core.sum() / max(1, m.sum()) < .2 else 'mang')
        mau.append({'ten': '', 'hex': hx(C[k]), 'ti_le': round(area * 100, 2), 'loai': loai})
    # suggested names: nen (background), muc (ink), then mau1..n by area
    order = sorted(range(len(mau)), key=lambda k: -mau[k]['ti_le']); c = 0
    for k in order:
        if mau[k]['loai'] == 'nen': mau[k]['ten'] = 'nen'
        elif mau[k]['loai'] == 'muc': mau[k]['ten'] = 'muc'
        else: c += 1; mau[k]['ten'] = f'mau{c}' + ('_mong' if mau[k]['loai'] == 'mong' else '')
    if ink is not None:   # ink colour = median of solid-ink pixels (not the cluster mean — dark hair/areas pull it lighter)
        mau[ink]['hex'] = hx(np.median(im[a > .97], 0)) if (a > .97).sum() > 50 else mau[ink]['hex']
    ws = width_stats(a > .5) if ink is not None else None
    notes = []
    if ws and ws['p10'] < 2.2: notes.append(f"thinnest lines ≈ {ws['p10']:.1f}px → drawn at ×4, half-darkness threshold (lines do not break)")
    nf = 1 - flat.mean()
    grad = float(((~flat) & ~(filt((a > .3).astype(np.uint8) * 255, ImageFilter.MaxFilter(7)) > 0)).mean())
    if grad > .05: notes.append(f'{grad * 100:.1f}% non-flat pixels outside the lines → the image has gradients/soft shading; a flat SVG loses this (add colours or hand-made gradients)')
    for i in range(len(C)):
        for j in range(i + 1, len(C)):
            if np.linalg.norm(C[i] - C[j]) < 30 and 'nen' not in (mau[i]['loai'], mau[j]['loai']):
                notes.append(f"{mau[i]['hex']} and {mau[j]['hex']} are close (difference {np.linalg.norm(C[i] - C[j]):.0f}) — check they really are two areas")
    small = [m['hex'] for m in mau if m['ti_le'] < .15 and m['loai'] not in ('muc',)]
    if small: notes.append('very rare colours (<0.15%): ' + ', '.join(small) + ' — small details or noise; drop them if not visible')
    S = 4 if (ws and ws['p10'] < 2.2 and W * H <= 900 * 900) else 3
    P = {'anh': 'goc.png', 'kich_thuoc': [W, H], 'ty_le_ve': S, 'mau': mau,
         'muc': {'hex': mau[ink]['hex'] if ink is not None else None, 'do_day': ws}, 'ghi_chu': notes, 'doi_mau': {}}
    json.dump(P, open(os.path.join(out, 'phan_tich.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # analysis sheet: colour swatches + ink mask + thin-line mask
    t = 260; sheet = Image.new('RGB', (t * 3 + 40, t + 60 + 34 * ((len(mau) + 3) // 4)), 'white'); d = ImageDraw.Draw(sheet); f = font(18)
    sc = lambda x: Image.fromarray(x).convert('RGB').resize((t, int(t * H / W)))
    sheet.paste(I.resize((t, int(t * H / W))), (0, 30)); sheet.paste(sc(((1 - a) * 255).astype(np.uint8)), (t + 20, 30))
    th = np.isin(full, [k for k in range(len(C)) if mau[k]['loai'] == 'mong']); sheet.paste(sc(((~th) * 255).astype(np.uint8)), (2 * t + 40, 30))
    for x, s in ((0, 'original'), (t + 20, 'ink (coverage)'), (2 * t + 40, 'thin coloured lines')): d.text((x, 4), s, fill='#222', font=f)
    for i, m in enumerate(sorted(mau, key=lambda m: -m['ti_le'])):
        x, y = (i % 4) * 205, t * H // W + 44 + (i // 4) * 34; d.rectangle([x, y, x + 28, y + 26], fill=m['hex'], outline='#888')
        d.text((x + 34, y + 3), f"{m['ten']} {m['hex']} {m['ti_le']}%", fill='#222', font=font(15))
    sheet.save(os.path.join(out, 'phan_tich.jpg'), quality=88)
    print(f'analysis {W}×{H} → {out}/phan_tich.json')
    for m in sorted(mau, key=lambda m: -m['ti_le']): print(f"  {m['ten']:<10} {m['hex']}  {m['ti_le']:>5}%  {m['loai']}")
    if ws: print(f"  ink line width: p10 {ws['p10']:.1f} · median {ws['median']:.1f} · p90 {ws['p90']:.1f} px · drawn at ×{S}")
    for s in notes: print('  ! ' + s)
    return P


# ---------------- drawing ----------------
def march(f, lv=.5):
    """marching squares → closed loops (pixel coordinates)."""
    f = np.pad(f, 1); a, b, c, d = f[:-1, :-1], f[:-1, 1:], f[1:, 1:], f[1:, :-1]
    idx = (a > lv) * 1 + (b > lv) * 2 + (c > lv) * 4 + (d > lv) * 8
    T = {1: [(3, 0)], 2: [(0, 1)], 3: [(3, 1)], 4: [(1, 2)], 5: [(3, 0), (1, 2)], 6: [(0, 2)], 7: [(3, 2)], 8: [(2, 3)], 9: [(2, 0)], 10: [(0, 1), (2, 3)],
         11: [(2, 1)], 12: [(1, 3)], 13: [(1, 0)], 14: [(0, 3)]}
    ip = lambda v0, v1: (lv - v0) / (v1 - v0 + 1e-9)
    def edge(y, x, e):
        if e == 0: return (0, y, x), (x + ip(a[y, x], b[y, x]), y)
        if e == 1: return (1, y, x + 1), (x + 1, y + ip(b[y, x], c[y, x]))
        if e == 2: return (0, y + 1, x), (x + ip(d[y, x], c[y, x]), y + 1)
        return (1, y, x), (x, y + ip(a[y, x], d[y, x]))
    pts, nxt = {}, {}
    ys, xs = np.nonzero((idx > 0) & (idx < 15))
    for y, x in zip(ys.tolist(), xs.tolist()):
        for e0, e1 in T[int(idx[y, x])]:
            k0, p0 = edge(y, x, e0); k1, p1 = edge(y, x, e1); pts[k0] = p0; pts[k1] = p1; nxt[k0] = k1
    loops, seen = [], set()
    for s in nxt:
        if s in seen: continue
        lp, k = [], s
        while k in nxt and k not in seen: seen.add(k); lp.append(pts[k]); k = nxt[k]
        if len(lp) > 6: loops.append(np.array(lp, np.float32) - 1)
    return loops


def rdp(P, eps):
    keep = np.zeros(len(P), bool); keep[0] = keep[-1] = True; st = [(0, len(P) - 1)]
    while st:
        i, j = st.pop()
        if j <= i + 1: continue
        A, B = P[i], P[j]; dv = B - A; nrm = float(np.hypot(*dv)) + 1e-9
        dist = np.abs((P[i + 1:j, 0] - A[0]) * dv[1] - (P[i + 1:j, 1] - A[1]) * dv[0]) / nrm
        k = int(dist.argmax())
        if dist[k] > eps: keep[i + 1 + k] = True; st += [(i, i + 1 + k), (i + 1 + k, j)]
    return P[keep]


def to_path(loop, eps):
    h = len(loop) // 2; P = np.vstack([rdp(loop[:h + 1], eps)[:-1], rdp(loop[h:], eps)[:-1]]); n = len(P)
    if n < 3: return ''
    s = [f'M{P[0][0]:.2f} {P[0][1]:.2f}']
    for i in range(n):   # Catmull-Rom → cubic bezier
        p0, p1, p2, p3 = P[i - 1], P[i], P[(i + 1) % n], P[(i + 2) % n]; c1 = p1 + (p2 - p0) / 6; c2 = p2 - (p3 - p1) / 6
        s.append(f'C{c1[0]:.2f} {c1[1]:.2f} {c2[0]:.2f} {c2[1]:.2f} {p2[0]:.2f} {p2[1]:.2f}')
    return ''.join(s) + 'Z'


def paths(field, S, eps=.22, lv=.5, minlen=10):
    return ' '.join(to_path(lp / S, eps) for lp in march(field, lv) if len(lp) > minlen)


def ve_lop(D, P):
    """→ list of layers [(name, hex, d)] in drawing order: fills → thin lines → ink."""
    S = P['ty_le_ve']; W, H = P['kich_thuoc']; I = Image.open(os.path.join(D, P['anh'])).convert('RGB')
    up = np.asarray(I.resize((W * S, H * S), Image.LANCZOS)).astype(np.float32)
    mau = P['mau']; ink = next((m for m in mau if m['loai'] == 'muc'), None); fl = [m for m in mau if m['loai'] != 'muc']
    lab, a = unmix(up, np.array([rgb(m['hex']) for m in fl]), rgb(ink['hex']) if ink else np.zeros(3, np.float32))
    thin = np.array([m['loai'] == 'mong' for m in fl])
    md = filt(lab.astype(np.uint8), ImageFilter.ModeFilter(2 * S + 1)).astype(np.int16)    # remove specks in the fills
    lab = np.where(thin[lab], lab, md)
    out = []; bgk = next((i for i, m in enumerate(fl) if m['loai'] == 'nen'), -1)
    nobg = (lab != bgk)
    for i in sorted(range(len(fl)), key=lambda i: (fl[i]['loai'] == 'mong', -fl[i]['ti_le'])):
        m = fl[i]
        if m['loai'] == 'nen': continue
        k = (lab == i).astype(np.float32)
        if m['loai'] == 'mong': f = blur(k, .3 * S)
        else: f = blur(filt((k * 255).astype(np.uint8), ImageFilter.MaxFilter(3)).astype(np.float32) / 255 * nobg, .45 * S)   # grow under the lines, never into the background
        d = paths(f, S)
        if d: out.append((m['ten'], m['hex'], d))
    if ink:   # ink: threshold at half the local maximum darkness → thin lines do not break, bold lines keep their width
        a = blur(a, .3 * S); M = filt((a * 255).astype(np.uint8), ImageFilter.MaxFilter(2 * S + 1)).astype(np.float32) / 255
        an = np.where(M > .12, a / np.clip(M, .12, 1), 0); K = rgb(ink['hex'])
        faint = M < .6          # faint lines (folds, secondary lines): filled with the fill colour mixed at the right darkness, not black
        for i, m in enumerate(fl):
            sel = faint & (lab == i) & (an > .5)
            if sel.sum() < 20 * S * S: continue
            for lo, hi in ((.12, .3), (.3, .45), (.45, .6)):
                ss = sel & (M >= lo) & (M < hi)
                if ss.sum() < 8 * S * S: continue
                k = float(np.median(M[ss])); col = hx(rgb(m['hex']) * (1 - k) + K * k)
                d = paths(np.where(faint & (lab == i) & (M >= lo) & (M < hi), an, 0), S, eps=.18)
                if d: out.append((f"{m['ten']}_net{int(k * 100)}", col, d))
        out.append((ink['ten'], ink['hex'], paths(np.where(faint, 0, an), S, eps=.18)))
        core = ((an > .5) & ~faint).astype(np.uint8) * 255   # thick ink areas (hair, black shadows): real colour measured from the image, leaving a ~1 px ink outline
        thick = filt(filt(core, ImageFilter.MinFilter(4 * S + 1)), ImageFilter.MaxFilter(2 * S + 1)) > 0
        if thick.sum() > 400 * S * S:
            col = np.median(up[thick], 0)
            if np.linalg.norm(col - K) > 14: out.append((ink['ten'] + '_mang', hx(col), paths(blur(thick.astype(np.float32), .4 * S), S, eps=.22)))
    return out


def recolor(layers, doi):
    """apply the colour map to the layers; faint lines <name>_netNN are recomputed = the new colour of <name> mixed with NN% ink (folds follow the shirt)."""
    doi = {k.lower(): v for k, v in (doi or {}).items()}; by = {n: c for n, c, _ in layers}; K = rgb(by.get('muc', '#000000'))
    out = []
    for n, c, d in layers:
        m = re.match(r'(.+)_net(\d+)$', n)
        if m and by.get(m.group(1), '').lower() in doi: c = hx(rgb(doi[by[m.group(1)].lower()]) * (1 - int(m.group(2)) / 100) + K * int(m.group(2)) / 100)
        else: c = doi.get(c.lower(), c)
        out.append((n, c, d))
    return out


def svg_of(layers, W, H, bg=None, doi=None, id_prefix=''):
    doi = {k.lower(): v for k, v in (doi or {}).items()}; s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">']
    if bg: s.append(f'<rect id="nen" width="{W}" height="{H}" fill="{doi.get(bg.lower(), bg)}"/>')
    for n, c, d in recolor(layers, doi): s.append(f'<path id="{id_prefix}{n}" fill="{c}" fill-rule="evenodd" d="{d}"/>')
    return '\n'.join(s + ['</svg>'])


def chup(svgs, W, H):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as pw:
        b = pw.chromium.launch(); pg = b.new_page(viewport={'width': W, 'height': H})
        for s in svgs: pg.goto(pathlib.Path(s).resolve().as_uri()); pg.screenshot(path=str(pathlib.Path(s).with_suffix('.png')))
        b.close()


def so_sanh(D, P, png):
    """colour difference + line comparison: missing / extra lines per 48 px tile → so.json, so.jpg, so_zoom.jpg (worst tile). Prints a short summary."""
    A = Image.open(os.path.join(D, P['anh'])).convert('RGB'); B = Image.open(png).convert('RGB').resize(A.size)
    a8, b8 = np.asarray(A).astype(np.float32), np.asarray(B).astype(np.float32); dif = np.abs(a8 - b8).mean(-1)
    mau = P['mau']; ink = next((m for m in mau if m['loai'] == 'muc'), None); fl = [m for m in mau if m['loai'] != 'muc']
    R = {'chenh_tb': round(float(dif.mean()), 2), 'lech_ro_pct': round(float((dif > 40).mean() * 100), 2)}
    if ink:
        F = np.array([rgb(m['hex']) for m in fl]); K = rgb(ink['hex'])
        io, ir = unmix(a8, F, K)[1] > .5, unmix(b8, F, K)[1] > .5
        dil = lambda m: filt(m.astype(np.uint8) * 255, ImageFilter.MaxFilter(3)) > 0
        miss, extra = io & ~dil(ir), ir & ~dil(io)
        R['net_iou'] = round(float((io & ir).sum() / max(1, (io | ir).sum())), 3)
        R['net_mat_pct'] = round(float(miss.sum() / max(1, io.sum()) * 100), 2); R['net_thua_pct'] = round(float(extra.sum() / max(1, ir.sum()) * 100), 2)
        wo, wr = width_stats(io), width_stats(ir); R['do_day_goc'], R['do_day_ve'] = wo and wo['median'], wr and wr['median']
        g = 48; tiles = []
        for y in range(0, A.size[1], g):
            for x in range(0, A.size[0], g):
                mm, ee = int(miss[y:y + g, x:x + g].sum()), int(extra[y:y + g, x:x + g].sum())
                if mm + ee > 12: tiles.append({'x': x, 'y': y, 'mat': mm, 'thua': ee})
        tiles.sort(key=lambda t: -(t['mat'] + t['thua'])); R['o_loi'] = tiles[:6]
    json.dump(R, open(os.path.join(D, 'so.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    W, H = A.size; S = Image.new('RGB', (W * 3 + 40, H), 'white')
    for i, x in enumerate([A, B, Image.fromarray(np.clip(dif * 3, 0, 255).astype(np.uint8)).convert('RGB')]): S.paste(x, (i * (W + 20), 0))
    S.save(os.path.join(D, 'so.jpg'), quality=88)
    t = (R.get('o_loi') or [{'x': W // 2 - 64, 'y': H // 2 - 64}])[0]; bx = (max(0, t['x'] - 40), max(0, t['y'] - 40), min(W, t['x'] + 88), min(H, t['y'] + 88))
    z = Image.new('RGB', ((bx[2] - bx[0]) * 4 * 2 + 10, (bx[3] - bx[1]) * 4), 'white')
    for i, x in enumerate([A, B]): z.paste(x.crop(bx).resize(((bx[2] - bx[0]) * 4, (bx[3] - bx[1]) * 4), Image.NEAREST), (i * ((bx[2] - bx[0]) * 4 + 10), 0))
    z.save(os.path.join(D, 'so_zoom.jpg'), quality=88)
    msg = f"vs original: mean difference {R['chenh_tb']}/255 · clearly off {R['lech_ro_pct']}%"
    if ink: msg += f" · line IoU {R['net_iou']} · missing {R['net_mat_pct']}% · extra {R['net_thua_pct']}% · width original {R['do_day_goc']} / drawn {R['do_day_ve']} px"
    print(msg)
    for t in R.get('o_loi', [])[:3]: print(f"  bad tile ({t['x']},{t['y']}) 48px: missing {t['mat']} · extra {t['thua']} px  → so_zoom.jpg shows the first one")
    return R


def ve(D, P, ten='ve', doi=None):
    W, H = P['kich_thuoc']; cache = os.path.join(D, '_lop.json')
    key = json.dumps([P['mau'], P['ty_le_ve'], os.path.getmtime(os.path.join(D, P['anh'])), os.path.getmtime(__file__)])
    if os.path.exists(cache) and json.load(open(cache, encoding='utf-8')).get('key') == key: layers = json.load(open(cache, encoding='utf-8'))['lop']
    else: layers = ve_lop(D, P); json.dump({'key': key, 'lop': layers}, open(cache, 'w', encoding='utf-8'))
    bg = next((m['hex'] for m in P['mau'] if m['loai'] == 'nen'), None)
    p = os.path.join(D, ten + '.svg'); open(p, 'w', encoding='utf-8').write(svg_of(layers, W, H, bg, doi)); chup([p], W, H)
    print(f'{ten}.svg {os.path.getsize(p) // 1024} KB · {len(layers)} layers')
    return p, layers


def map_doi(P, pairs):
    """'name=#hex' or '#old=#new' → {old_hex: new_hex}; thin-line colours of the same hue (hue difference < 25°) follow, keeping their relative lightness."""
    by = {m['ten']: m['hex'] for m in P['mau']}; out = {}
    for s in pairs:
        k, v = s.split('='); old = by.get(k.strip(), k.strip()).lower(); out[old] = v.strip()
        h0, l0, s0 = colorsys.rgb_to_hls(*(rgb(old) / 255)); ht, lt, st = colorsys.rgb_to_hls(*(rgb(v) / 255))
        for m in P['mau']:
            if m['hex'].lower() == old or m['loai'] not in ('mong', 'mang'): continue
            h, l, s2 = colorsys.rgb_to_hls(*(rgb(m['hex']) / 255))
            if min(abs(h - h0), 1 - abs(h - h0)) < 25 / 360 and abs(s2 - s0) < .25 and m['loai'] == 'mong':
                nl = min(1, max(0, lt + (l - l0))); ns = min(1, max(0, st * (s2 / s0 if s0 else 1)))
                out[m['hex'].lower()] = hx(np.array(colorsys.hls_to_rgb(ht, nl, ns)) * 255)
    return out


# ---------------- extend ----------------
def canh_cat(D, P):
    """cut image edges: the runs of ink + colour touching each edge (to continue the drawing in the right place)."""
    I = np.asarray(Image.open(os.path.join(D, P['anh'])).convert('RGB')).astype(np.float32); W, H = P['kich_thuoc']
    mau = P['mau']; C = np.array([rgb(m['hex']) for m in mau]); out = {}
    for name, line, coord in (('duoi', I[-1], 'x'), ('tren', I[0], 'x'), ('trai', I[:, 0], 'y'), ('phai', I[:, -1], 'y')):
        lab = ((line[:, None] - C[None]) ** 2).sum(-1).argmin(1); runs = []; i = 0
        while i < len(lab):
            j = i
            while j < len(lab) and lab[j] == lab[i]: j += 1
            if mau[lab[i]]['loai'] != 'nen' and j - i >= 2: runs.append(f"{mau[lab[i]]['ten']} {coord}={i}–{j - 1}")
            i = j
        if runs: out[name] = runs
    return out


def mo_rong(D, P, khung, dat, them, ten):
    W, H = P['kich_thuoc']; KW, KH = khung; ox, oy = dat
    _, layers = ve(D, P, '_tam') if not os.path.exists(os.path.join(D, '_lop.json')) else (None, json.load(open(os.path.join(D, '_lop.json'), encoding='utf-8'))['lop'])
    bg = next((m['hex'] for m in P['mau'] if m['loai'] == 'nen'), '#ffffff'); doi = {k.lower(): v for k, v in (P.get('doi_mau') or {}).items()}
    if not them:
        ink = P['muc']; ws = (ink.get('do_day') or {}).get('median') or 3
        cc = canh_cat(D, P)
        md = [f'# Extend the drawing — {D}', '', f'New canvas {KW}×{KH}; the original {W}×{H} is placed at ({ox},{oy}). Draw the additions in `them.json` (or `them.svg`), NEW CANVAS coordinates:',
              '`duoi` / `<g id="duoi">` = UNDER the original (the body continuing past the cut edge), `tren` / `<g id="tren">` = on top (an arm reaching forward…).', '',
              '## Style to keep', f"- ink `{ink['hex']}`, solid shapes (fill) or `stroke-width` ≈ {ws:.1f} px, `stroke-linecap/linejoin=round`; the outer outline thicker than inner lines, like the original",
              '- flat colours, no gradients, no shading (like the original); use exactly this palette:']
        md += [f"  - `{m['ten']}` {m['hex']} ({m['loai']}, {m['ti_le']}%)" for m in P['mau']]
        md += ['', '## Cut edges (continue from here; original-image coordinates + the placement offset)'] + [f'- {k}: ' + '; '.join(v) for k, v in cc.items()]
        md += ['', '## Process (references/ve-lai.md § Extend)',
               '1. DESIGN before drawing, write it in "phan_tich" of them.json: head count (chibi 2.5–3), viewing angle, line of action, centre of gravity',
               '   over the standing foot, a pose that fits the personality (what does the original face say?), a readable silhouette (arms apart from the body, legs not stiffly parallel).',
               '2. Place the SKELETON first ("xuong": shoulders, elbows, wrists, hips, knees, ankles, toes), then build shapes: arms/legs = tapering "ong" (thigh > calf > ankle),',
               '   shirt/trousers/shoes = smooth "khoi", sharp corners via "goc"; soft folds = "nep", bold details = "net". Shapes touching a cut edge start 4–6 px INSIDE the original, "vien": false.',
               f'3. `xp redraw mo-rong {D} --canvas {KW}x{KH} --dat {ox},{oy} --them them.json` → read the number line (lines, colours, joins); open mo_rong_soat.jpg only when needed. ≤ 3 rounds.']
        open(os.path.join(D, 'MO_RONG.md'), 'w', encoding='utf-8').write('\n'.join(md))
        tp = os.path.join(D, 'them.json')
        if not os.path.exists(tp):
            json.dump({'phan_tich': '…', 'xuong': {}, 'duoi': [], 'tren': []}, open(tp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('\n'.join(md[:3] + md[5:9]) + f'\n→ {D}/MO_RONG.md, them.json template'); return
    if them.endswith('.json'):   # skeleton + shapes → SVG (ve_them.py)
        import ve_them
        spec = json.load(open(them, encoding='utf-8')); by = {m['ten']: m['hex'] for m in P['mau']}; wi = (P['muc'].get('do_day') or {}).get('median') or 3
        g = ve_them.build(spec, lambda c: by.get(c, c), P['muc']['hex'], (wi, 1.1 * wi))
        src = f'<g id="duoi">{g["duoi"]}</g>\n<g id="tren">{g["tren"]}</g>\n</svg>'
    else: src = open(them, encoding='utf-8').read()
    for k, v in doi.items(): src = re.sub(re.escape(k), v, src, flags=re.I)   # the additions use the same palette → recolour them too
    grab = lambda gid: (re.search(rf'<g id="{gid}"[^>]*>(.*?)</g>\s*(?=<g id=|</svg>)', src, re.S) or [None, ''])[1]
    body = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {KW} {KH}" width="{KW}" height="{KH}">', f'<rect id="nen" width="{KW}" height="{KH}" fill="{doi.get(bg.lower(), bg)}"/>',
            f'<clipPath id="ngoai_goc"><path fill-rule="evenodd" d="M0 0H{KW}V{KH}H0Z M{ox + 2} {oy + 2}H{ox + W - 2}V{oy + H - 2}H{ox + 2}Z"/></clipPath>',   # the under layer never shows around the original
            f'<g id="duoi" clip-path="url(#ngoai_goc)">{grab("duoi")}</g>', f'<g id="goc" transform="translate({ox} {oy})">']
    body += [f'<path id="goc_{n}" fill="{c}" fill-rule="evenodd" d="{d}"/>' for n, c, d in recolor(layers, doi)]
    body += ['</g>', f'<g id="tren">{grab("tren")}</g>', '</svg>']
    p = os.path.join(D, ten + '.svg'); open(p, 'w', encoding='utf-8').write('\n'.join(body)); chup([p], KW, KH)
    print(f'{ten}.svg + {ten}.png ({KW}×{KH})'); soat_mo_rong(D, P, p[:-4] + '.png', (ox, oy), doi)


def soat_mo_rong(D, P, png, dat, doi):
    """the additions: line width vs the original, off-palette pixels, joins at the cut edges → 1 number line + mo_rong_soat.jpg (full figure | silhouette | join)."""
    I = Image.open(png).convert('RGB'); KW, KH = I.size; W, H = P['kich_thuoc']; ox, oy = dat; im = np.asarray(I).astype(np.float32)
    mau = [{**m, 'hex': doi.get(m['hex'].lower(), m['hex'])} for m in P['mau']]; ink = next(m for m in mau if m['loai'] == 'muc'); fl = [m for m in mau if m['loai'] != 'muc']
    F = np.array([rgb(m['hex']) for m in fl]); K = rgb(ink['hex']); lab, a = unmix(im, F, K)
    E = np.ones((KH, KW), bool); E[oy:oy + H, ox:ox + W] = False
    res = np.min(np.stack([(((im - f) - np.clip(((im - f) @ (K - f)) / float((K - f) @ (K - f)), 0, 1)[..., None] * (K - f)) ** 2).sum(-1) for f in F]), 0)
    bgc = rgb(next(m['hex'] for m in mau if m['loai'] == 'nen')); fg = np.abs(im - bgc).sum(-1) > 30
    lac = float(((res > 900) & E & fg).sum() / max(1, (E & fg).sum()) * 100)
    wE, wG = width_stats((a > .5) & E), (P['muc'].get('do_day') or {})
    msg = f"additions: median line {wE and wE['median']} px (original {wG.get('median')}) · off-palette {lac:.2f}%"
    rows = []   # cut edges inside the new canvas → compare the ink runs on both sides
    if oy + H < KH: rows.append(('bottom', im[oy + H - 4], im[oy + H + 4]))
    if oy > 0: rows.append(('top', im[oy + 3], im[oy - 5]))
    for name, r0, r1 in rows:
        run = lambda r: [((s + e) / 2) for s, e in _runs(unmix(r[None], F, K)[1][0] > .5)]
        A0, A1 = run(r0), run(r1); lost = [round(x) for x in A0 if not any(abs(x - y) < 7 for y in A1)]
        msg += f" · {name} edge: {len(A0) - len(lost)}/{len(A0)} lines joined" + (f' (broken at x≈{lost})' if lost else '')
    print(msg)
    t = 300; s = KH and t / KW; Wt, Ht = t, int(KH * s); sheet = Image.new('RGB', (Wt * 2 + 20 + 420, max(Ht, 420)), 'white')
    sheet.paste(I.resize((Wt, Ht), Image.LANCZOS), (0, 0)); sheet.paste(Image.fromarray(np.where(fg, 30, 235).astype(np.uint8)).convert('RGB').resize((Wt, Ht)), (Wt + 10, 0))
    cy = oy + H if oy + H < KH else oy; cx = ox + W // 2; bx = (max(0, cx - 105), max(0, cy - 70), min(KW, cx + 105), min(KH, cy + 70))
    sheet.paste(I.crop(bx).resize(((bx[2] - bx[0]) * 2, (bx[3] - bx[1]) * 2)), (Wt * 2 + 20, 0)); sheet.save(os.path.join(D, 'mo_rong_soat.jpg'), quality=88)


def kiem_logic(S):
    """anatomy + clothing logic check of a cut-out character (canvas px, 1 rig unit = 2 px) → prints ✓/⚠, returns the list of results"""
    r = S['rig']; k = 2.0; hip = S['than']['goc']; neck = S['than']['ngon']; out = []
    pts = lambda part, mau: [p for b in S[part]['duoi'] if b['loai'] == 'khoi' and b.get('mau') == mau for p in b['diem']]
    ao, quan = pts('than', 'ao'), pts('quan', S['quan']['duoi'][0]['mau']) if 'quan' in S else []
    leg = next((b for b in S.get('chan', {}).get('duoi', []) if b['loai'] == 'ong'), None); thigh = leg['diem'][0][2] if leg else 50
    def chk(ok, msg): out.append(('✓ ' if ok else '⚠ ') + msg); print('  ' + out[-1])
    sh_y = neck[1] + r['shDrop'] * k; wr = sh_y + (r['up'] + r['fore']) * k
    chk(hip[1] - 10 <= wr <= hip[1] + r['T'] * k * .55, f"hanging wrist at y≈{wr:.0f}: between hip ({hip[1]:.0f}) and mid-thigh ({hip[1] + r['T'] * k * .5:.0f})")
    if ao:
        hem = max(p[1] for p in ao); chk(hip[1] - 70 <= hem <= hip[1] + 25, f'shirt hem y≈{hem:.0f} around the hip (±): shirt neither too short nor dress-long')
        row = [p[0] for p in ao if abs(p[1] - sh_y) < 60] or [p[0] for p in ao]; half = (max(row) - min(row)) / 2
        chk(r['shW'] * k < half * .7, f"shoulder offset {r['shW'] * k:.0f} px < 70% of half the shirt width ({half:.0f}): arms grow from inside the shirt shoulders")
        cl = S.get('rong_ngang', 1.0); far = r['shW'] * k * cl + 30   # far hand's screen offset from the spine (+ half a hand)
        chk(S.get('tay_truoc', True) is False or far < half * .75, f'far hanging arm offset {far:.0f} px < 75% of half the torso ({half:.0f}): hidden by the body at 3/4 / side view, no impossible second arm')
        wide = (max(p[0] for p in ao if p[1] > hip[1] - 80) - min(p[0] for p in ao if p[1] > hip[1] - 80)); top = (max(p[0] for p in ao if p[1] < sh_y + 60) - min(p[0] for p in ao if p[1] < sh_y + 60))
        chk(wide <= top * 1.3, f'shirt hem width {wide:.0f} px ≤ 1.3 × shoulders ({top:.0f}): fitted shirt, not flared like a dress')
    if quan:
        bot = max(p[1] for p in quan); chk(hip[1] + r['T'] * k * .25 <= bot <= hip[1] + r['T'] * k * .85, f"shorts hem y≈{bot:.0f} above the knee ({hip[1] + r['T'] * k:.0f}), below the upper thigh")
        w = max(p[0] for p in quan) - min(p[0] for p in quan); need = 2 * r['hipW'] * k + thigh
        chk(need + 10 <= w <= need + 90, f'shorts width {w:.0f} px vs 2 legs + thigh {need:.0f} px: fitted (range +10…+90)')
        cx = (max(p[0] for p in quan) + min(p[0] for p in quan)) / 2; chk(abs(cx - hip[0]) < 20, f'shorts centre x≈{cx:.0f} matches the hip x={hip[0]:.0f}: both legs of the shorts sit on the legs')
    chk(abs(sum(r['sp']) * k - ((hip[0] - neck[0]) ** 2 + (hip[1] - neck[1]) ** 2) ** .5) < 25, f"rig spine {sum(r['sp']) * k:.0f} px = drawn torso (hip→neck)")
    for vn, v in S.get('huong_than', {}).items():   # every body view: sleeves sit on the shirt edge, shorts cover both legs at this view's leg spread
        a2 = [p for b in v['than']['duoi'] if b['loai'] == 'khoi' and b.get('mau') == 'ao' for p in b['diem']]
        q2 = [p for b in v['quan']['duoi'] if b['loai'] == 'khoi' for p in b['diem']] if 'quan' in v else []
        if a2:
            hx = (max(p[0] for p in a2) - min(p[0] for p in a2)) / 2; sl = 45
            chk(v['vai'] < 30 or hx - sl <= v['vai'] <= hx + sl * .6, f"[{vn}] arm {v['vai']} px from the spine, shirt edge {hx:.0f} px: sleeve sits on the shirt shoulder edge")
        if q2:
            w = max(p[0] for p in q2) - min(p[0] for p in q2); need = 2 * r['hipW'] * k * abs(v['cl']) + thigh
            chk(need + 10 <= w <= need + 200, f'[{vn}] shorts width {w:.0f} px ≥ 2 legs apart {2 * r["hipW"] * k * abs(v["cl"]):.0f} + thigh {thigh:.0f}: both legs covered')
            sp = abs(v['than']['ngon'][1] - v['than']['goc'][1]); chk(abs(sp - abs(neck[1] - hip[1])) < 25, f'[{vn}] torso height {sp:.0f} px = the 3/4 version: head joins the neck')
    return out


def rig(D, P, spec_path):
    """a movable cut-out character from the redrawn picture: head = cut from the original (lines kept as is), other parts = ve_them shapes in the same style.
    rig_ve.json (extended-canvas coordinates): { id, ten, rig: {T,S,ank,foot,heel,hipW,sp,neck,headUp,headR,shW,shDrop,up,fore,hand},
      dau: {khung:[x0,y0,x1,y1], cat:[x0,y0,x1,y1], goc, ngon},  than|quan|giay: {khung, duoi:[shapes], goc, ngon},
      chan|tay: {khung, duoi, truc_x, hang:[upper joint, middle, lower]} }  → .mega-shot/nhanvat/<id>/bo/rig.json + PNG (engine loadCutout)"""
    import ve_them
    from playwright.sync_api import sync_playwright
    S = json.load(open(spec_path, encoding='utf-8'))
    root = os.path.dirname(os.path.dirname(os.path.abspath(D))) if os.path.basename(os.path.dirname(os.path.abspath(D))) == 've-lai' else os.path.dirname(os.path.abspath(D))
    out = os.path.join(root, 'nhanvat', S['id'], 'bo'); os.makedirs(out, exist_ok=True)
    by = {m['ten']: m['hex'] for m in P['mau']}; doi = {k.lower(): v for k, v in (P.get('doi_mau') or {}).items()}
    wi = (P['muc'].get('do_day') or {}).get('median') or 3; ink = P['muc']['hex']
    layers = json.load(open(os.path.join(D, '_lop.json'), encoding='utf-8'))['lop']
    import mat_bieu_cam as MB
    def shapes_svg(sh): return ve_them.build({'duoi': sh}, lambda c: by.get(c, c), ink, (wi, 1.1 * wi))['duoi']
    def svg_part(name, p):
        x0, y0, x1, y1 = p['khung']; w, h = int(x1 - x0), int(y1 - y0)
        if name == 'dau':   # traced original head (+ 'xoa' skin patches that remove the baked eyes / mouth when the face is drawn separately)
            c = p['cat']; body = f'<clipPath id="k"><rect x="{c[0]}" y="{c[1]}" width="{c[2] - c[0]}" height="{c[3] - c[1]}"/></clipPath><g clip-path="url(#k)">' + ''.join(
                f'<path fill="{col}" fill-rule="evenodd" d="{d}"/>' for n, col, d in recolor(layers, doi)) + (shapes_svg(p['xoa']) if p.get('xoa') else '') + '</g>'
        else: body = shapes_svg(p['duoi'])
        for k, v in doi.items(): body = re.sub(re.escape(k), v, body, flags=re.I)
        return w, h, f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{x0} {y0} {w} {h}">{body}</svg>'
    # jobs: body parts, extra head views (huong_dau), face sets (eyes + brows per expression, mouths) for every view that has a face
    jobs = [(n, S[n]) for n in ('dau', 'than', 'quan', 'giay', 'chan', 'tay') if n in S]
    views = [('', S['dau'], S.get('mat_3_4'), S.get('yaw_3_4', .95))] + [(vn, v, v.get('mat_view'), v['yaw']) for vn, v in S.get('huong_dau', {}).items()]
    for vn, v, _, _ in views[1:]: jobs.append(('dau_' + vn, v))
    # body views (huong_than): torso / shorts / shoes drawn per view → parts 'than@thang' … (limb strips are shared by every view)
    HT = S.get('huong_than', {})
    for vn, v in HT.items():
        for n in ('than', 'quan', 'giay'):
            if n in v: jobs.append((f'{n}@{vn}', v[n]))
    face = {}
    for vn, v, fv, _ in views:
        if not fv: continue
        hau = '@' + vn if vn else ''; eyes, mouths = MB.bo_mat(fv)
        ax = sum(e[0] for e in fv['mat']) / len(fv['mat']); ay = sum(e[1] for e in fv['mat']) / len(fv['mat']); mx, my, _ = fv['mieng']
        for ten, sh in eyes.items(): jobs.append((f'mat_{ten}{hau}', {'khung': [ax - 150, ay - 95, ax + 150, ay + 70], 'duoi': sh, '_neo': [ax, ay]}))
        for k, sh in mouths.items(): jobs.append((f'mieng_{k}{hau}', {'khung': [mx - 34, my - 26, mx + 34, my + 32], 'duoi': sh, '_neo': [mx, my]}))
        ox, oy = v['khung'][:2]; face[vn] = {'goc': [round(ax - ox, 1), round(ay - oy, 1)], 'mieng': [round(mx - ox, 1), round(my - oy, 1)]}
    manh = {}
    with sync_playwright() as pw:
        b = pw.chromium.launch(); pg = b.new_page()
        for name, p in jobs:
            w, h, svg = svg_part(name if name == 'dau' else '_', p); x0, y0 = p['khung'][:2]
            pg.set_viewport_size({'width': w, 'height': h}); pg.set_content(f'<html><body style="margin:0;background:transparent">{svg}</body></html>')
            fn = name.replace('@', '_at_') + '.png'
            pg.screenshot(path=os.path.join(out, fn), omit_background=True, clip={'x': 0, 'y': 0, 'width': w, 'height': h})
            rel = lambda q: [round(q[0] - x0, 1), round(q[1] - y0, 1)]
            if name in ('chan', 'tay'):
                ent = {'kieu': 'day', 'truc_x': round(p['truc_x'] - x0, 1), 'hang': [round(v - y0, 1) for v in p['hang']]}
                if name == 'tay':
                    shutil.copy(os.path.join(out, 'tay.png'), os.path.join(out, 'tay_L.png')); shutil.copy(os.path.join(out, 'tay.png'), os.path.join(out, 'tay_R.png'))
                    manh['tay_L'] = {'anh': 'tay_L.png', **ent}; manh['tay_R'] = {'anh': 'tay_R.png', **ent}
                else: manh['chan'] = {'anh': 'chan.png', **ent}
            elif '_neo' in p: manh[name] = {'anh': fn, 'goc': rel(p['_neo'])}
            else: manh[name] = {'anh': fn, 'goc': rel(p['goc']), 'ngon': rel(p['ngon']), 'ti_le': 1}
        b.close()
    has_face = '' in face
    # tay_truoc: wide shirt → near arm in front of the torso
    R = {'ten': S.get('ten', S['id']), 'ti_le_anh': .5, 'rong_ngang': S.get('rong_ngang', 1.0), 'rig': S['rig'], 'manh': manh, 'tay_truoc': S.get('tay_truoc', True),
         'gioi_han': S.get('gioi_han', {'khuyu': 1.4, 'goi': 1.6}),
         'mat': {**(face.get('') or {'goc': [0, 0], 'mieng': [0, 0]}), 'co_mat': 1, 'co_mieng': 1, 'co_kinh': 1, 'nen_x': 1, 'cui': S.get('cui', 26)},
         'bieu_cam': {k: 'mat_' + v for k, v in MB.MAP_ENGINE.items()} if has_face else {},
         'mieng': dict(MB.MIENG_NOI) if has_face else {},
         'mieng_bieu_cam': {k: 'mieng_' + MB.BIEU_CAM[v][4] for k, v in MB.MAP_ENGINE.items()} if has_face else {},
         'nguon': {'ve_lai': os.path.abspath(D), 'ghi_chu': 'face drawn separately (xp redraw rig + mat_bieu_cam.py)' if has_face else 'face baked into the head (no expression changes)'}}
    if len(views) > 1: R['dau_huong'] = [{'ten': 'dau' if not vn else 'dau_' + vn, 'yaw': yw, 'hau': vn, 'mat': face.get(vn), **({'chon': v['chon']} if 'chon' in v else {})} for vn, v, fv, yw in views]
    if HT:
        # projection per body view, interpolated by the engine on the body yaw: X = cf·forward + cl·lateral, arms hang 'vai' (world) from the spine
        base = {'hau': '', 'yaw': S.get('yaw_3_4', .95), 'cf': 1.0, 'cl': R['rong_ngang'], 'vai': S['rig']['shW'] * R['rong_ngang']}
        R['than_huong'] = sorted([base] + [{'hau': vn, 'yaw': v['yaw'], 'cf': v['cf'], 'cl': v['cl'], 'vai': round(v['vai'] / 2 * (1 if v['cl'] >= 0 else -1), 1),
                                            'giay': f'giay@{vn}' if 'giay' in v else None, **({'chon': v['chon']} if 'chon' in v else {})} for vn, v in HT.items()], key=lambda e: e['yaw'])
    R['kiem_tra'] = kiem_logic(S)
    json.dump(R, open(os.path.join(out, 'rig.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    json.dump({'kieu': 'cat', 'ten': R['ten'], 'bo': 'bo/rig.json'}, open(os.path.join(out, '..', 'nhanvat.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"cut-out character {S['id']}: {', '.join(manh)} → {out}")


def _runs(m):
    out, i = [], 0
    while i < len(m):
        if m[i]:
            j = i
            while j < len(m) and m[j]: j += 1
            out.append((i, j - 1)); i = j
        else: i += 1
    return out


def main(a, X=None):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    if a.action == 'phan-tich':
        out = a.out or os.path.join(os.path.dirname(os.path.abspath(a.src)), pathlib.Path(a.src).stem + '_ve_lai'); phan_tich(a.src, out); return
    D = a.src; P = json.load(open(os.path.join(D, 'phan_tich.json'), encoding='utf-8'))
    if a.action == 've':
        p, _ = ve(D, P); so_sanh(D, P, p[:-4] + '.png')
    elif a.action == 'doi-mau':
        doi = map_doi(P, a.doi or []); P['doi_mau'] = {**P.get('doi_mau', {}), **doi}
        json.dump(P, open(os.path.join(D, 'phan_tich.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        ve(D, P, a.ten or 'doi_mau', {k.lower(): v for k, v in doi.items()}); print('recoloured:', ', '.join(f'{k}→{v}' for k, v in doi.items()))
    elif a.action == 'mo-rong':
        kw, kh = (int(v) for v in (a.khung or f"{P['kich_thuoc'][0]}x{P['kich_thuoc'][1] * 2}").lower().split('x'))
        ox, oy = (int(v) for v in (a.dat or '0,0').split(','))
        mo_rong(D, P, (kw, kh), (ox, oy), a.them and os.path.join(D, a.them) if a.them and not os.path.isabs(a.them) else a.them, a.ten or 'mo_rong')
    elif a.action == 'rig':
        f = a.them or 'rig_ve.json'; rig(D, P, f if os.path.isabs(f) else os.path.join(D, f))


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser(); ap.add_argument('action', choices=['phan-tich', 've', 'doi-mau', 'mo-rong', 'rig']); ap.add_argument('src')
    ap.add_argument('--out'); ap.add_argument('--doi', action='append'); ap.add_argument('--ten'); ap.add_argument('--khung'); ap.add_argument('--dat'); ap.add_argument('--them')
    main(ap.parse_args())
