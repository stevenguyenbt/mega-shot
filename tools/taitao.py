"""mega-shot · `xp taitao <image>` — ANALYSE + RECREATE AN IMAGE: same content, sharper, cleaner, larger (no external AI, only numpy + Pillow).

  xp taitao face.jpg [--scale 4] [--kieu tu-dong|phang|anh|lai] [--mau 0] [--out folder]

1. Analysis: size, grayscale or colour, noise level (σ), JPEG blocking level, "flatness" (flat artwork / photo / hybrid),
   dominant palette (k-means), background colour + subject box → <name>_phan_tich.json
2. Recreation: remove 8×8 blocking (only at block borders, only when the step is small) → edge-preserving denoise (self-guided filter)
   → Lanczos upscale → flat colour areas + ink lines rebuilt from the upscaled COLOUR LABELS (soft one-hot → argmax, 2× anti-aliasing)
   for vector-sharp edges → blended by a texture map (flat areas take the label version, detailed areas keep the photo) → thresholded sharpening.
   → <name>_taitao.png (+ <name>_so_sanh.jpg: left the original upscaled to the same size, right the recreation)
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter

def box(a, r):                                                     # mean filter (separable, integral image), keeps shape
    if r < 1: return a
    p = np.pad(a, ((r + 1, r), (r + 1, r)) + ((0, 0),) * (a.ndim - 2), mode='edge')
    c = p.cumsum(0); c = c[2 * r + 1:] - c[:-2 * r - 1]; c = c.cumsum(1); c = c[:, 2 * r + 1:] - c[:, :-2 * r - 1]
    return c / (2 * r + 1) ** 2

def guided(I, p, r, eps):                                          # He et al. guided filter (I gray guide, p channel)
    mI, mp = box(I, r), box(p, r); cov = box(I * p, r) - mI * mp; var = box(I * I, r) - mI * mI
    a = cov / (var + eps); b = mp - a * mI
    return box(a, r) * I + box(b, r)

def luma(x): return x[..., 0] * .299 + x[..., 1] * .587 + x[..., 2] * .114

def kmeans(px, k, it=14, seed=3):
    rng = np.random.default_rng(seed); C = px[rng.choice(len(px), k, replace=False)].copy()
    for _ in range(it):
        d = ((px[:, None, :] - C[None]) ** 2).sum(-1); lab = d.argmin(1)
        for j in range(k):
            m = lab == j
            if m.any(): C[j] = px[m].mean(0)
    return C, lab

def analyse(x):
    h, w = x.shape[:2]; L = luma(x)
    gray = float(np.mean(x.max(-1) - x.min(-1) < .045)) > .93
    lap = L[1:-1, 1:-1] * 4 - L[:-2, 1:-1] - L[2:, 1:-1] - L[1:-1, :-2] - L[1:-1, 2:]
    sigma = float(1.4826 * np.median(np.abs(lap - np.median(lap))) / np.sqrt(20))
    dx = np.abs(np.diff(L, axis=1)); cols = np.arange(dx.shape[1])
    blk = float(dx[:, cols % 8 == 7].mean() / max(1e-6, dx[:, cols % 8 != 7].mean())) if w > 16 else 1.0
    loc = np.sqrt(np.maximum(box(L * L, 2) - box(L, 2) ** 2, 0)); flat = float(np.mean(loc < .035))
    kieu = 'phang' if flat > .78 else 'anh' if flat < .45 else 'lai'
    bord = np.concatenate([x[0], x[-1], x[:, 0], x[:, -1]]); bg = np.median(bord, 0)
    dist = np.abs(x - bg).sum(-1); ys, xs = np.nonzero(dist > .12)
    bbox = [int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)] if len(xs) else [0, 0, w, h]
    sub = x[::max(1, int(np.sqrt(h * w / 6000)))][:, ::max(1, int(np.sqrt(h * w / 6000)))].reshape(-1, 3)
    C, lab = kmeans(sub, 10); share = np.bincount(lab, minlength=10) / len(lab); order = share.argsort()[::-1]
    pal = [{'mau': '#%02x%02x%02x' % tuple(int(v * 255) for v in C[i]), 'ty_le': round(float(share[i]), 3)} for i in order if share[i] > .005]
    return {'kich_thuoc': [w, h], 'anh_xam': gray, 'nhieu_sigma': round(sigma, 4), 'vo_khoi_jpeg': round(blk, 3), 'do_phang': round(flat, 3), 'kieu': kieu,
            'mau_nen': '#%02x%02x%02x' % tuple(int(v * 255) for v in bg), 'khung_chu_the': bbox, 'bang_mau': pal}

def deblock(x, strength=1.0, thr=.09):
    y = x.copy(); h, w = x.shape[:2]
    for axis in (1, 0):
        n = w if axis == 1 else h
        for b in range(8, n, 8):
            A = np.take(y, b - 1, axis=axis); B = np.take(y, b, axis=axis); d = B - A; m = (np.abs(d).max(-1, keepdims=True) < thr) * strength
            A2 = np.take(y, b - 2, axis=axis) if b >= 2 else A; B2 = np.take(y, b + 1, axis=axis) if b + 1 < n else B
            na = A + d * .33 * m; nb = B - d * .33 * m; na2 = A2 + d * .12 * m; nb2 = B2 - d * .12 * m
            idx = [slice(None)] * 3
            for k, v in ((b - 1, na), (b, nb), (b - 2, na2), (b + 1, nb2)):
                if 0 <= k < n: idx[axis] = k; y[tuple(idx)] = v
    return y

def restore(x, scale, kieu, ncol, info):
    h, w = x.shape[:2]; H, W = int(round(h * scale)), int(round(w * scale)); s = info['nhieu_sigma']
    if info['vo_khoi_jpeg'] > 1.08: x = deblock(x, strength=min(1, (info['vo_khoi_jpeg'] - 1) * 4))
    G = luma(x); eps = max(1e-4, (s * 2.2) ** 2)
    den = np.stack([guided(G, x[..., c], 2, eps) for c in range(3)], -1).clip(0, 1)            # edge-preserving denoise
    up = lambda a: np.asarray(Image.fromarray((a * 255).clip(0, 255).astype(np.uint8)).resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
    photo = up(den)
    # flat colour regions rebuilt from upscaled soft one-hot labels (crisp, vector-like boundaries), anti-aliased at 2×
    k = ncol or (6 if info['anh_xam'] else 12 if kieu == 'phang' else 10)
    C, lab = kmeans(den.reshape(-1, 3)[::1], k); lab = lab.reshape(h, w)
    S2 = (W * 2, H * 2); best = np.full((S2[1], S2[0]), -1.0, np.float32); arg = np.zeros((S2[1], S2[0]), np.int32)
    for j in range(k):
        m = Image.fromarray((box((lab == j) * 1.0, 1) * .6 + (lab == j) * .4).astype(np.float32), mode='F').resize(S2, Image.BICUBIC)
        m = np.asarray(m); sel = m > best; best[sel] = m[sel]; arg[sel] = j
    flat2 = C[arg]; flat = np.asarray(Image.fromarray((flat2 * 255).clip(0, 255).astype(np.uint8)).resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
    # texture map from the original (upscaled): flat → labels, detailed → photo; dark ink lines always from labels (crisp)
    Lp = luma(den); loc = np.sqrt(np.maximum(box(Lp * Lp, 2) - box(Lp, 2) ** 2, 0))
    tex = np.asarray(Image.fromarray((np.clip(loc / .09, 0, 1) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)).astype(np.float32)[..., None] / 255
    if kieu == 'phang': out = flat
    elif kieu == 'anh': out = photo
    else:
        # photo everywhere (keeps soft shading on skin); crisp label rebuild only for dark ink lines and the clean flat background
        Lf = luma(flat); bgc = np.array([int(info['mau_nen'][i:i + 2], 16) / 255 for i in (1, 3, 5)], np.float32)
        near = np.abs(den - bgc).sum(-1) < .07; bgm = np.zeros((h, w), bool); st = [(0, i) for i in range(w)] + [(h - 1, i) for i in range(w)] + [(i, 0) for i in range(h)] + [(i, w - 1) for i in range(h)]
        while st:                                                              # background = near-bg pixels CONNECTED to the border (white skin stays photo)
            yy, xx = st.pop()
            if bgm[yy, xx] or not near[yy, xx]: continue
            bgm[yy, xx] = True; st += [(yy + dy, xx + dx) for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= yy + dy < h and 0 <= xx + dx < w]
        bgu = np.asarray(Image.fromarray((box(bgm * 1.0, 1) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)).astype(np.float32) / 255
        dark = luma(den) < .3; comp = np.zeros((h, w), np.int32); big = np.zeros((h, w), bool); cid = 0          # keep only LARGE dark areas (hair, outlines) as ink
        for y0 in range(h):
            for x0 in np.nonzero(dark[y0] & (comp[y0] == 0))[0]:
                if comp[y0, x0]: continue
                cid += 1; st = [(y0, x0)]; cells = []
                while st:
                    yy, xx = st.pop()
                    if comp[yy, xx] or not dark[yy, xx]: continue
                    comp[yy, xx] = cid; cells.append((yy, xx)); st += [(yy + dy, xx + dx) for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= yy + dy < h and 0 <= xx + dx < w]
                if len(cells) > h * w * .004: ys_, xs_ = zip(*cells); big[list(ys_), list(xs_)] = True
        bigu = np.asarray(Image.fromarray((box(big * 1.0, 2) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)).astype(np.float32) / 255
        ink = (np.clip((.36 - Lf) / .12, 0, 1) * np.clip(bigu * 2, 0, 1))[..., None]; back = np.clip((bgu - .5) * 2.5 + .5, 0, 1)[..., None]
        w = np.maximum(ink * .9, back); out = photo * (1 - w) + flat * w
    # thresholded unsharp mask on luminance (sharpens edges, leaves smooth skin / flat fills alone)
    Lo = luma(out); rr = max(1, int(round(1.1 * scale ** .5))); bl = box(box(Lo, rr), rr)
    det = Lo - bl; det = np.where(np.abs(det) > .012, det, 0)
    out = (out + det[..., None] * (.8 if kieu != 'phang' else .25)).clip(0, 1)
    return out

def run(src, scale=4, kieu='tu-dong', ncol=0, out=None):
    im = Image.open(src).convert('RGB'); x = np.asarray(im).astype(np.float32) / 255
    info = analyse(x); k = info['kieu'] if kieu == 'tu-dong' else kieu
    y = restore(x, scale, k, ncol, info); base = os.path.splitext(os.path.basename(src))[0]; od = out or os.path.dirname(os.path.abspath(src)); os.makedirs(od, exist_ok=True)
    res = Image.fromarray((y * 255).astype(np.uint8)); p_out = os.path.join(od, base + '_taitao.png'); res.save(p_out)
    before = im.resize(res.size, Image.BICUBIC); cmp = Image.new('RGB', (res.width * 2 + 12, res.height), (30, 30, 34)); cmp.paste(before, (0, 0)); cmp.paste(res, (res.width + 12, 0))
    cmp.save(os.path.join(od, base + '_so_sanh.jpg'), quality=92)
    info.update(che_do=k, phong_to=scale, ket_qua=[res.width, res.height], tep=os.path.basename(p_out))
    json.dump(info, open(os.path.join(od, base + '_phan_tich.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return info, p_out

def main(a, X):
    info, p = run(a.anh, a.scale, a.kieu, a.mau, a.out)
    X.log(f"analysis: {info['kich_thuoc'][0]}×{info['kich_thuoc'][1]} · {'grayscale' if info['anh_xam'] else 'colour'} · noise σ={info['nhieu_sigma']} · blocking {info['vo_khoi_jpeg']} · flatness {info['do_phang']} → mode {info['che_do']}")
    X.log(f"recreated ×{info['phong_to']} → {p} ({info['ket_qua'][0]}×{info['ket_qua'][1]}) · comparison: {os.path.splitext(p)[0].replace('_taitao', '')}_so_sanh.jpg")

if __name__ == '__main__':
    import argparse; ap = argparse.ArgumentParser(); ap.add_argument('anh'); ap.add_argument('--scale', type=float, default=4); ap.add_argument('--kieu', default='tu-dong'); ap.add_argument('--mau', type=int, default=0); ap.add_argument('--out')
    a = ap.parse_args(); info, p = run(a.anh, a.scale, a.kieu, a.mau, a.out); print(json.dumps({k: v for k, v in info.items() if k != 'bang_mau'}, ensure_ascii=False)); print(p)
