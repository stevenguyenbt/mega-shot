"""Procedural body sounds for anatomy / medical videos (self-made, CC0): heartbeat loops, gulp, stomach gurgle, molecule sparkle, knuckle crack.
usage: python am_co_the.py <out_dir>"""
import sys, os, wave, numpy as np
SR = 48000; rng = np.random.default_rng(7); out = sys.argv[1]; os.makedirs(out, exist_ok=True)

def lp(x, a):  # one-pole low-pass
    y = np.empty_like(x); s = 0.0
    for i, v in enumerate(x): s += a * (v - s); y[i] = s
    return y

def save(name, x):
    x = x / (np.abs(x).max() + 1e-9) * .9
    st = np.stack([x, x], 1) if x.ndim == 1 else x
    with wave.open(os.path.join(out, name + '.wav'), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype('<i2').tobytes())

def thump(f0, dur, decay):
    t = np.arange(int(SR * dur)) / SR; f = f0 * (1 + .6 * np.exp(-t * 30))
    ph = 2 * np.pi * np.cumsum(f) / SR; env = (1 - np.exp(-t * 400)) * np.exp(-t * decay)
    return np.sin(ph) * env + .25 * np.sin(2 * ph) * env * np.exp(-t * 20)

def heartbeat(bpm, secs):
    n = int(SR * secs); x = np.zeros(n); per = 60 / bpm; t = 0.0
    lub, dub = thump(52, .25, 16), thump(68, .2, 22) * .7
    while t < secs:
        for snd, off in ((lub, 0), (dub, .3 * per ** .5 * .55)):
            i = int((t + off) * SR); j = min(n, i + len(snd))
            if j > i: x[i:j] += snd[:j - i]
        t += per * (1 + rng.normal(0, .01))
    return lp(x, .2)

def gulp():
    t = np.arange(int(SR * .55)) / SR
    f = 260 * np.exp(-((t - .12) / .09) ** 2) + 140                       # tongue/throat formant sweep
    ph = 2 * np.pi * np.cumsum(f) / SR; env = np.exp(-((t - .13) / .07) ** 2) + .5 * np.exp(-((t - .33) / .06) ** 2)
    bubble = np.sin(2 * np.pi * np.cumsum(420 * np.exp(-((t - .33) / .05) ** 2) + 200) / SR) * np.exp(-((t - .33) / .04) ** 2) * .6
    noise = lp(rng.standard_normal(len(t)), .08) * env * .5
    return lp(np.sin(ph) * env + bubble + noise, .3)

def gurgle(secs=3.5):
    n = int(SR * secs); x = np.zeros(n)
    for _ in range(26):                                                    # small bubbles rising in pitch
        d = rng.uniform(.04, .16); t = np.arange(int(SR * d)) / SR; f0 = rng.uniform(90, 260)
        b = np.sin(2 * np.pi * np.cumsum(f0 * (1 + 1.8 * t / d)) / SR) * np.sin(np.pi * t / d) ** 2
        i = int(rng.uniform(0, secs - d) * SR); x[i:i + len(b)] += b * rng.uniform(.3, 1)
    rumble = lp(rng.standard_normal(n), .01) * 3 * np.sin(np.pi * np.arange(n) / n) ** 2
    return lp(x + rumble, .15) * np.sin(np.pi * np.arange(n) / n) ** .5

def sparkle():
    t = np.arange(int(SR * 1.2)) / SR; x = np.zeros(len(t))
    for k in range(9):
        t0 = k * .09 + rng.uniform(0, .03); f = rng.uniform(1800, 3600); e = np.where(t > t0, np.exp(-(t - t0) * 18), 0)
        x += np.sin(2 * np.pi * f * t) * e * (1 - k / 12)
    return x * .5

save('tim-dap-72', heartbeat(72, 40)); save('tim-dap-84', heartbeat(84, 40))
save('tieng-uc', gulp()); save('soi-bung', gurgle()); save('lap-lanh', sparkle())
def crack():                                                               # knuckle crack: sharp broadband click + short hollow pop + tiny second tick
    t = np.arange(int(SR * .35)) / SR; x = np.zeros(len(t))
    for t0, g, a in ((.02, 1, .9), (.034, .45, .6)):
        e = np.where(t > t0, np.exp(-(t - t0) * 900), 0); x += rng.standard_normal(len(t)) * e * g
        x += np.sin(2 * np.pi * 190 * (t - t0)) * np.where(t > t0, np.exp(-(t - t0) * 70), 0) * a * g
    return x - lp(x, .02)                                                  # high-pass: crisp, no boom

save('rac-khop', crack())
print('ok')
def buzz(secs=3.0):                                                        # mosquito whine: ~470 Hz wingbeat + harmonics, wobble, approaches then lands (fades)
    t = np.arange(int(SR * secs)) / SR
    f = 470 * (1 + .03 * np.sin(2 * np.pi * 5.3 * t) + .015 * np.sin(2 * np.pi * 11.7 * t) + .04 * (t / secs))
    ph = 2 * np.pi * np.cumsum(f) / SR; x = sum(np.sin(k * ph) / k ** 1.1 for k in range(1, 9))
    env = np.clip(t / (secs * .55), 0, 1) ** 1.5 * (1 + .25 * np.sin(2 * np.pi * 3.1 * t)) * np.clip((secs - t) / .25, 0, 1)
    return (x - lp(x, .03)) * env

save('vo-ve', buzz())
print('ok')
def sneeze():                                                              # "ha… CHOO": rising breathy inhale, then an explosive band-passed noise burst with a short tonal "choo"
    t = np.arange(int(SR * 1.3)) / SR; n = rng.standard_normal(len(t))
    inh = lp(n, .05) * np.clip(t / .55, 0, 1) ** 2 * (t < .6) * .35
    t0 = .62; e = np.where(t > t0, np.exp(-(t - t0) * 9) * (1 - np.exp(-(t - t0) * 300)), 0)
    burst = (lp(n, .5) - lp(n, .04)) * e
    tone = np.sin(2 * np.pi * 330 * (t - t0) * (1 - .3 * (t - t0))) * e * .25
    return inh + burst + tone

save('hat-xi', sneeze())
print('ok')
