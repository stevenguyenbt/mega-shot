"""mega-shot · synthesised sound effects (nothing to download, no licence issues) + automatic placement on the timeline.

Sounds: vut (whoosh, scene change), bum (boom, numbers / first frame), dang (riser, before a reveal), tich (tick, cuts between clips), bot (water bubbles), nen-duoi-nuoc (underwater ambience).
video.yaml:  sfx: { muc: 1.0, am_nen: duoi-nuoc, tu_dong: true }   # muc = overall level (0 = off); am_nen: duoi-nuoc | khong | "tu-nhien:<name>" (a real recording, looped)
             tu_dong: false → do NOT auto-place whoosh/boom/riser/tick/bubbles; only the ambience bed + hand-written `am:` sounds (e.g. real whale song) — documentary style
             canh: [{ tiet_lo: true, … }]                 # riser 1.4 s before this scene
"""
import json, os, re, wave
import numpy as np

SR = 48000
rng = np.random.default_rng(7)

def _lp(x, a):
    """one-pole low-pass filter; a may vary over time (array)"""
    y = np.empty_like(x); acc = 0.0; a = np.broadcast_to(a, x.shape)
    for i in range(len(x)): acc += a[i] * (x[i] - acc); y[i] = acc
    return y

def _env(n, att, rel, shape=2.0):
    t = np.linspace(0, 1, n); a = int(n * att)
    e = np.ones(n); e[:a] = np.linspace(0, 1, a) ** shape if a else 1; e[a:] = (1 - np.linspace(0, 1, n - a)) ** (shape * rel)
    return e

def vut(var=0, dur=.55):
    """whoosh: noise through a filter sweeping up then down, panning left → right"""
    n = int(SR * dur); t = np.linspace(0, 1, n); x = rng.standard_normal(n)
    cut = .01 + .16 * np.sin(np.pi * t) ** 2 * (1.2 if var else 1); y = _lp(_lp(x, cut), cut) - _lp(_lp(x, cut * .2), cut * .2)   # 2-stage filter: soft, not harsh
    y *= _env(n, .62 if var else .5, .9, 2.4); y /= np.abs(y).max() + 1e-9
    pan = np.clip(t * 1.4 - .2, 0, 1) if var % 2 == 0 else np.clip(1.2 - t * 1.4, 0, 1)
    return np.stack([y * np.sqrt(1 - pan), y * np.sqrt(pan)], 1)

def bum(dur=1.4):
    """low boom: sine 62→34 Hz decaying + a short knock + low noise"""
    n = int(SR * dur); t = np.arange(n) / SR; f = 34 + 28 * np.exp(-t * 6); ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) * np.exp(-t * 3.2); y += .35 * _lp(rng.standard_normal(n), .02) * np.exp(-t * 14); y[:240] += np.hanning(480)[:240] * .5 * rng.standard_normal(240)
    y /= np.abs(y).max(); return np.stack([y, y], 1)

def dang(dur=1.4):
    """riser: noise + a sine sweeping 180→900 Hz, growing louder, cut off at the end"""
    n = int(SR * dur); t = np.linspace(0, 1, n); f = 180 * 5 ** t; ph = 2 * np.pi * np.cumsum(f) / SR
    nz = rng.standard_normal(n); y = .55 * np.sin(ph) + .5 * (_lp(_lp(nz, .03 + .12 * t), .03 + .12 * t) - _lp(nz, .01))
    y *= t ** 2.2; y[-300:] *= np.linspace(1, 0, 300); y /= np.abs(y).max()
    return np.stack([y * (1 - .3 * t), y * (.7 + .3 * t)], 1)

def tich(dur=.09):
    """soft tick on cuts between clips"""
    n = int(SR * dur); t = np.arange(n) / SR; y = np.sin(2 * np.pi * 1900 * t) * np.exp(-t * 70) + .3 * rng.standard_normal(n) * np.exp(-t * 200)
    y /= np.abs(y).max(); return np.stack([y, y], 1)

def bot(dur=1.2, k=9):
    """string of air bubbles: random upward-swept sine bloops"""
    n = int(SR * dur); y = np.zeros((n, 2))
    for _ in range(k):
        st = int(rng.uniform(0, .8) * n); L = int(SR * rng.uniform(.03, .08)); t = np.arange(L) / SR; f0 = rng.uniform(380, 1400)
        b = np.sin(2 * np.pi * np.cumsum(f0 * (1 + 6 * t)) / SR) * np.exp(-t * 45); p = rng.uniform(.2, .8); e = min(n, st + L)
        y[st:e, 0] += b[:e - st] * (1 - p); y[st:e, 1] += b[:e - st] * p
    return y / (np.abs(y).max() + 1e-9)

def nen_duoi_nuoc(dur):
    """underwater ambience: brown noise low-passed ~250 Hz, slowly modulated, different on each channel"""
    n = int(SR * dur); out = []
    for ch in range(2):
        x = np.cumsum(rng.standard_normal(n)); x -= _lp(x, .0005); y = _lp(x, .03); y *= 1 + .35 * np.sin(2 * np.pi * (.07 + .03 * ch) * np.arange(n) / SR)
        out.append(y / (np.abs(y).max() + 1e-9))
    return np.stack(out, 1)

def cache(root, name, fn):
    d = os.path.join(root, '.mega-shot', 'sfx'); os.makedirs(d, exist_ok=True); p = os.path.join(d, name + '.npy')
    if os.path.exists(p): return np.load(p)
    a = fn().astype(np.float32); np.save(p, a); return a

def build_track(root, spec, tl, book, out='build/sfx.wav'):
    """Place effects on the timeline → build/sfx.wav (stereo 48 kHz). Returns the number of effects placed."""
    cfg = spec.get('sfx') or {}; muc = 1.0 if cfg.get('muc') is None else float(cfg['muc'])
    D = tl['dur']; N = int(D * SR) + SR; buf = np.zeros((N, 2), np.float32); cnt = 0
    S = {k: cache(root, k, f) for k, f in {'vut0': lambda: vut(0), 'vut1': lambda: vut(1), 'bum': bum, 'dang': dang, 'tich': tich, 'bot': bot}.items()}
    def put(a, t, g):
        nonlocal cnt
        i = int(max(0, t) * SR); j = min(N, i + len(a))
        if j > i: buf[i:j] += a[:j - i] * g * muc; cnt += 1
    if muc <= 0: return 0
    import unicodedata
    try:                                                                              # kenney.nl sound library (CC0) — tools/sfxlib.py
        import sfxlib
        for k in list(S):                                                             # sfx.thay: { bum: "kenney:…", tich: "click", vut: "…" }
            b = 'vut' if k.startswith('vut') else k
            if (cfg.get('thay') or {}).get(b):
                a = sfxlib.load(root, cfg['thay'][b])
                if a is not None: S[k] = a
    except ImportError: sfxlib = None
    nm = lambda w: re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFD', str(w).lower()).encode('ascii', 'ignore').decode())
    WORDS = [(nm(w[0]), w[1]) for sub in tl.get('subs', []) for w in (sub.get('w') or [])]
    sc = tl['scenes']
    auto = cfg.get('tu_dong', True) is not False
    if auto: put(S['bum'], 0.0, .42)                                                 # first frame: a light boom → grabs the ear immediately
    for k, s in enumerate(sc):
        d = s.get('data') or {}
        if auto: _auto(put, S, k, s, d, book)
        _tay(put, sfxlib, root, sc, k, s, d, D, WORDS, nm, S)
    _nen(root, cfg, buf, N, D, muc)
    buf = np.clip(buf[:int(D * SR)], -1, 1)
    with wave.open(out, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((buf * 32767).astype('<i2').tobytes())
    return cnt

def _auto(put, S, k, s, d, book):
    """auto-placed effects: whoosh on scene change, boom when the title is a number, riser before a reveal, tick on clip cuts, bubbles"""
    if k: put(S[f'vut{k % 2}'], s['t0'] - .33, .16)                              # whoosh: peak lands on the scene change
    if k and re.search(r'[0-9]', str(d.get('chu', ''))): put(S['bum'], s['t0'] + .28, .30)   # title is a number → low boom when the text appears
    if d.get('tiet_lo'): put(S['dang'], s['t0'] - 1.4, .14)
    for c in (book.get(s['id'], {}).get('cat') or []): put(S['tich'], s['t0'] + c, .05)  # cuts between clips inside the scene
    if d.get('bot'): put(S['bot'], s['t0'] + .2, .10)

def _tay(put, sfxlib, root, sc, k, s, d, D, WORDS, nm, S=None):
    """hand-placed sounds per scene — am: [{ ten, tu: <spoken word> | luc: <seconds into the scene> | u: <0–1 of the scene>, muc, dai: <max seconds>, tu_giay: <skip the start of the recording> }]
    dai defaults to the end of the scene + 1 s (long recordings such as whale song don't spill into other scenes); fade in/out 0.4 / 1.2 s"""
    S = S or {}
    for e in (d.get('am') or []):
        ten = str(e.get('ten', '')); bi = 'vut0' if ten == 'vut' else ten                # built-ins: bum, tich, dang, bot, vut
        a = S[bi] if bi in S else sfxlib.load(root, ten) if sfxlib else None
        if a is None: continue
        if e.get('tu_giay'): a = a[int(float(e['tu_giay']) * SR):]
        t_end = (sc[k + 1]['t0'] if k + 1 < len(sc) else D) + 1 - s['t0']
        L = int(SR * min(float(e.get('dai', t_end)), t_end + 99 if e.get('dai') else t_end))
        if len(a) > L:
            a = a[:L].copy(); f = min(len(a), int(SR * 1.2)); a[-f:] *= np.linspace(1, 0, f)[:, None]
            fi = min(len(a), int(SR * .4)); a[:fi] *= np.linspace(0, 1, fi)[:, None]
        t1 = sc[k + 1]['t0'] if k + 1 < len(sc) else D; t = s['t0'] + float(e.get('luc', 0))
        if e.get('sau_loi') and s.get('voice'):                                   # sau_loi: true → right after the line ends (pair with `them:` so the sound plays in the clear)
            t = s['voice']['t0'] + s['voice']['dur'] + .25
        elif e.get('tu'):
            w0 = nm(str(e['tu']).split()[0]); t = next((tt for ww, tt in WORDS if s['t0'] - .05 <= tt < t1 and ww == w0), t)
        elif e.get('u') is not None: t = s['t0'] + float(e['u']) * (t1 - s['t0'])            # u: fraction of the scene (follows the picture when the voice is re-timed)
        put(a, t, float(e.get('muc', .35)))

def _nen(root, cfg, buf, N, D, muc):
    """ambience bed for the whole video: duoi-nuoc (synthesised) or "tu-nhien:<name>" (a real file, looped with crossfade) · sfx.nen_muc = level (default .1)"""
    nen, g = cfg.get('am_nen', 'khong'), float(cfg.get('nen_muc', .1))
    bed = None
    if nen == 'duoi-nuoc': bed = cache(root, f'nen{int(D) + 2}', lambda: nen_duoi_nuoc(int(D) + 2))
    elif isinstance(nen, str) and ':' in nen:
        try:
            import sfxlib; a = sfxlib.load(root, nen)
        except ImportError: a = None
        if a is not None and len(a) > SR * 2:
            xf = min(SR, len(a) // 4); bed = a.copy()
            while len(bed) < N:                                                        # loop with a 1 s crossfade for a seamless join
                r = np.linspace(0, 1, xf)[:, None]; bed[-xf:] = bed[-xf:] * (1 - r) + a[:xf] * r; bed = np.concatenate([bed, a[xf:]])
    if bed is None: return
    n = min(N, len(bed)); fade = np.ones(n); fade[:SR] = np.linspace(0, 1, SR); fade[-SR:] = np.linspace(1, 0, SR); buf[:n] += bed[:n] * fade[:, None] * g * muc
