"""mega-shot · scores the script BEFORE the voice is generated: `xp check script`.

Measures against the "4 layers" frame (what → why → meaning → hook to the next idea) in references/script-and-voice.md:
information density, depth (sentences explaining cause/mechanism), big numbers with a comparison, opening hook, retention hooks,
a closing question, overlong sentences, repeated words, estimated duration, and every number must appear in nghien_cuu.md.
The keyword lists below are LINGUISTIC DATA for analysing Vietnamese scripts (and an English set); only the feedback is English.
"""
import json, os, re

TOC_GOC = 3.3                        # syllables/second of the default Vietnamese voice at toc_do = 1 (re-measured 10/2026: 3.54 at 1.08)
NHAN_QUA = r'\b(vì|do|bởi|nhờ|nên|khiến|làm cho|tức là|nghĩa là|nói cách khác|cơ chế|như thế nào|vì sao|tại sao|thế nên|bởi vậy|là do)\b'
SO_SANH = r'\b(bằng|như|gấp|tương đương|hơn cả|so với|nghĩa là|tức là|cỡ|ngang|chẳng khác|giống như|lớn hơn|cao hơn|sâu hơn|nặng hơn)\b'
MOC = r'(\?|\bnhưng\b|\bvà điều\b|\bchưa phải\b|\bcòn\b|\bđiều kỳ lạ\b|\bbí ẩn\b|\bthật ra\b|\bhóa ra\b|\bhoá ra\b)'
# English: same measures, different keywords (speed unit = words/second)
EN = dict(
    NHAN_QUA=r"\b(because|since|so|that's why|which is why|due to|thanks to|meaning|in other words|how|why|led to|caused|resulted in|therefore|as a result|this is why|sparked|triggered|in order to|partly to|meant to|which gave|which means|fed each other|drove|forced|exhausted|so that)\b",
    SO_SANH=r"\b(like|as|than|times|equal|equivalent|compared|bigger|smaller|twice|half|the size of|roughly|about the same)\b",
    MOC=r"(\?|\bbut\b|\band yet\b|\bstill\b|\bthen\b|\bwhat came next\b|\bstrangest\b|\bit turned out\b|\bhowever\b|\bmystery\b)",
    DUNG=set('the a an and of to in on at by for from with is was were are be been it its this that these those they their them he his she her we our you your as or but not no so than then there which who what when where'.split()),
    TOC=2.45, HOOK=r'\d|\?|never|first|only|oldest|more than|million|thousand|why|how')
DUNG = set('và là của có được những các một này đó cho với trong khi thì mà để không đã sẽ người ta nó họ chúng bạn mình rất nhiều cũng như hơn từ ở lại ra vào lên xuống nhất nữa'.split())

def so_trong(text):
    """numbers written as digits (thousands separators stripped) — used to cross-check nghien_cuu.md"""
    return [re.sub(r'[.,](?=\d{3}\b)', '', n) for n in re.findall(r'\d[\d.,]*\d|\d', text)]

def cham(spec, here='.'):
    toc = float(spec.get('giong', {}).get('toc_do', 1.0)); nh = spec.get('nhip', {}); canh = [c for c in spec.get('canh', []) if c.get('loi')]
    en = str(spec.get('ngon_ngu', 'vi')).startswith('en'); L = EN if en else dict(NHAN_QUA=NHAN_QUA, SO_SANH=SO_SANH, MOC=MOC, DUNG=DUNG, TOC=TOC_GOC, HOOK=r'\d|\?|một|hai|ba|nghìn|triệu|tỉ|hơn|chưa|không ai|ít ai')
    W, R = [], {}
    if not canh: return {'diem': 0, 'canh_bao': ['no narration text yet']}
    am = [len(str(c['loi']).split()) for c in canh]; voice = sum(am) / (L['TOC'] * toc)
    gaps = nh.get('dem_dau', .1) + (len(canh) - 1) * nh.get('dem', .15) + len(canh) * nh.get('nghi', .25) + sum(c.get('them', 0) for c in canh)
    dur = voice + gaps; R.update(thoi_luong_uoc=round(dur, 1), giong_phu=round(voice / dur, 2), so_canh=len(canh), am_tiet=sum(am))
    lo, hi = spec.get('muc_tieu_giay', [75, 100])
    if not lo <= dur <= hi: W.append(f'estimated duration {dur:.0f}s (target {lo}–{hi}s)')
    # opening hook: short, with a number / question / paradox
    l0 = str(canh[0]['loi']); w0 = len(re.split(r'(?<=[.?!])\s+', l0.strip())[0].split())          # only the FIRST sentence is the hook
    if w0 > 22: W.append(f'opening line is {w0} words — cut to ≤ 18 words to get straight in')
    if not re.search(L['HOOK'], l0.lower()): W.append('opening line lacks a hook (number, question or paradox)')
    # depth: share of scenes that explain cause/mechanism
    sau = [c['id'] for c in canh if re.search(L['NHAN_QUA'], str(c['loi']).lower())]; R['ty_le_sau'] = round(len(sau) / len(canh), 2)
    tin = bool(spec.get('tin'))                                                   # news bulletin (template tin-tuc): facts + attribution, not an explainer
    if (R['ty_le_sau'] < .4 and not tin) or (tin and not sau): W.append(f"only {len(sau)}/{len(canh)} scenes explain why/how — need ≥ 40% (add layer 2 of the 4-layer frame)")
    # big numbers need an easy-to-picture comparison (in the same scene or the next one)
    for i, c in enumerate(canh):
        txt = ' '.join(str(c.get(k, '')) for k in ('loi', 'phu_de', 'chu')).lower(); nxt = str(canh[i + 1]['loi']).lower() if i + 1 < len(canh) else ''
        txt = re.sub(r'năm (một|hai) nghìn[^,.?!]*|năm \d{4}|\b\d{1,4}\s*(bce|ce|bc|ad)\b|\b(in|by|since|until|from|to|of|around|after|before)\s+(the\s+)?\d{3,4}s?\b|\b(1[0-9]{3}|20[0-9]{2})\b', '', txt)   # years (1977, 70 CE, in 1948) need no comparison
        big = re.search(r'\b(nghìn|triệu|tỉ|phần trăm|phần tư|nửa|gấp|thousand|million|billion|percent|half|quarter)\b|\d[\d,]{2,}|%', txt)
        if big and not tin and not (re.search(L['SO_SANH'], txt) or re.search(L['SO_SANH'], nxt)): W.append(f"{c['id']}: big number has no easy-to-picture comparison")
    # density: at least one new piece of information (figure or explanation) every ~10 seconds
    so_y = sum(len(re.findall(r'\d[\d.,]*|nghìn|triệu|tỉ|phần|thousand|million|centur', str(c['loi']).lower())) + len(re.findall(L['NHAN_QUA'], str(c['loi']).lower())) for c in canh)   # idea count: numbers/years + explanatory sentences
    R['tin_moi_10s'] = round(so_y / max(dur / 10, 1), 2)
    if R['tin_moi_10s'] < 1: W.append(f"information density {R['tin_moi_10s']} ideas/10s — need ≥ 1")
    # retention hooks + closing line
    moc = [c['id'] for c in canh[1:-1] if re.search(L['MOC'], str(c['loi']).lower())]; R['moc_giu_chan'] = len(moc)
    if tin:                                                                       # every scene with a number must say who reported it
        NGUON = r'theo|cho biết|ghi nhận|tuyên bố|nói|ước tính|công bố|according|said|says|reported|claims'
        for c in canh:
            if re.search(r'\d|trăm|nghìn|triệu|tỷ', str(c['loi'])) and not re.search(NGUON, str(c['loi']), re.I) and c is not canh[0]: W.append(f"{c['id']}: the news item has figures but does not say who reported them (according to…, … said)")
    if len(moc) < (2 if tin else 3): W.append(f'only {len(moc)} retention hooks (question, "but…", "the strange part…") — need ≥ 3')
    if '?' not in str(canh[-1]['loi']) and not (spec.get('_loat') and not spec.get('tap_cuoi')): W.append('closing line has no question to draw comments')   # mid-series episode: ends on a hook to the next episode
    # long sentences, repeated words
    for c in canh:
        for cau in re.split(r'(?<=[.?!])\s+', str(c['loi'])):
            if len(cau.split()) > 28: W.append(f"{c['id']}: sentence of {len(cau.split())} words — split it in two for easier listening")
    dem = {}
    for c in canh:
        for w in re.findall(r'[A-Za-zÀ-ỹđĐ]+', str(c['loi'])):
            if en and w[:1].isupper(): continue                                      # English: repeated proper names are natural
            w = w.lower()
            if len(w) > 3 and w not in L['DUNG']: dem[w] = dem.get(w, 0) + 1
    lap = [f'{w}×{n}' for w, n in sorted(dem.items(), key=lambda x: -x[1]) if n > max(4, len(canh) // 2)]
    if lap: W.append('repeated words: ' + ', '.join(lap[:5]))
    # sources: numbers shown on screen must appear in nghien_cuu.md
    nc = os.path.join(here, 'nghien_cuu.md')
    if not os.path.exists(nc) and os.path.exists(os.path.join(here, '..', 'nghien_cuu.md')): nc = os.path.join(here, '..', 'nghien_cuu.md')   # episode in a series: use the shared research
    if not os.path.exists(nc): W.append('missing nghien_cuu.md (the research step is mandatory — see references/script-and-voice.md)')
    else:
        doc = open(nc, encoding='utf-8').read(); have = set(so_trong(doc))
        for c in canh:
            for n in so_trong(' '.join(str(c.get(k, '')) for k in ('phu_de', 'chu')) + ' ' + ' '.join(str(x.get('chu', '')) for x in c.get('nhan', []) or [])):
                if n not in have and len(n) > 1: W.append(f"{c['id']}: number {n} is not in nghien_cuu.md")
    if spec.get('truyen'):                                                       # story film (template truyen, references/story/README.md)
        W[:] = [w for w in W if not w.startswith(('only ', 'closing line has', 'opening line lacks', 'information density')) and 'big number' not in w]   # explainer quotas → replaced by story beats below
        if not re.match(r'\s*(nếu|if|what if)\b', l0.lower()): W.append('story: the opening line should be a "What if you…" premise')
        luat = [c['id'] for c in canh if c.get('the_luat')]; R['the_luat'] = len(luat)
        if len(luat) < 2: W.append(f'story: only {len(luat)} rule card(s) — each tip needs one (≥ 2)')
        thoai = [c for c in canh if c.get('ai')]; R['ty_le_thoai'] = round(len(thoai) / len(canh), 2)
        lo_t, hi_t = spec.get('truyen', {}).get('ty_le_thoai', [.35, .5]) if isinstance(spec.get('truyen'), dict) else (.35, .5)
        if R['ty_le_thoai'] < lo_t: W.append(f"story: dialogue is only {R['ty_le_thoai']:.0%} of lines — need {lo_t:.0%}–{hi_t:.0%}: let characters say what the narrator is telling")
        if R['ty_le_thoai'] > hi_t + .1: W.append(f"story: dialogue is {R['ty_le_thoai']:.0%} of lines — keep ≤ {hi_t:.0%}, leave the rest to the narrator for information")
        doi = sum(1 for a, b in zip(canh, canh[1:]) if a.get('ai') and b.get('ai') and a['ai'] != b['ai']); R['luot_doi_dap'] = doi
        if len(thoai) >= 3 and doi < 2: W.append(f'story: only {doi} exchange(s) (two consecutive lines by two different characters) — need ≥ 2 question–answer pairs')
        for c in thoai:
            n = len(str(c['loi']).split())
            if n > 14: W.append(f"{c['id']}: dialogue line of {n} words — keep dialogue ≤ 12 words, split into two turns")
            nv = [x.get('ai') for sh in (c.get('shots') or []) for x in (sh.get('nv') or [])]
            if c.get('shots') and c['ai'] not in nv: W.append(f"{c['id']}: {c['ai']} is speaking but appears in no shot (no lip-sync visible) — add to `nv` or use an over-the-shoulder / phan-ung shot")
        ngoat = [i for i, c in enumerate(canh) if c.get('the_luat') or c.get('hud') or re.search(r'nhưng|bỗng|vậy mà|sai lầm|đột nhiên|but |suddenly|mistake', str(c['loi']).lower())]
        per = dur / len(canh); gap = max([b - a for a, b in zip([0] + ngoat, ngoat + [len(canh)])] or [0]) * per
        if gap > 25: W.append(f'story: a {gap:.0f}s stretch has no turn/card/new information — need a twist every 15–25 s')
        if not canh[-1].get('ket'): W.append('story: the last scene has no `ket: { tap_sau }` (hook to the next episode)')
        for c in canh:
            if not c.get('shots'): W.append(f"{c['id']}: no shots yet (storyboard)")
    diem = max(0, round(10 - .7 * len(W), 1)); R['diem'] = diem; R['canh_bao'] = W
    return R
