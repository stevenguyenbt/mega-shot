"""mega-shot · doc_so.py — turn numbers in a narration line into spoken Vietnamese before it goes to the voice model.

Why: `loi` was sent to VoiceStudio verbatim, so the voice model guessed how to read
"2.397", "3,1%", "1946", "17/10" — thousands separators and decimals came out wrong. Every line now passes through
`doc(text, lang, cfg)`; the subtitle (`phu_de`) keeps digits.

Rules (Vietnamese): "." = thousands separator, "," = decimal point (an English-style "3.5" — one or two digits after the
dot — is read as a decimal too); 2.050 → "hai nghìn không trăm năm mươi", 105 → "một trăm linh năm",
21 → "hai mươi mốt", 25 → "hai mươi lăm", 24 → "hai mươi tư", 15 → "mười lăm"; 3,1 → "ba phẩy một", 0,05 → "không phẩy không năm";
17/10/2026 → "mười bảy tháng mười năm hai nghìn không trăm hai mươi sáu"; tháng 4 → "tháng tư"; thứ 1 → "thứ nhất";
12–17 → "mười hai đến mười bảy"; −0,2 → "âm không phẩy hai"; % € $ km² °C ×.
Config `giong.doc_so: { nghin: nghìn | ngàn, linh: linh | lẻ, tu: tư | bốn }` (regional style) and
`giong.doc: { INSEE: "in xê", … }` (pronunciation dictionary, applied first, whole words only).
Self-test: uv run python tools/doc_so.py
"""
import re

SO = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']

def _chuc(n, o):                                   # 0..99
    c, d = divmod(n, 10)
    if c == 0: return SO[d]
    if c == 1: return 'mười' + ('' if d == 0 else ' lăm' if d == 5 else ' ' + SO[d])
    s = SO[c] + ' mươi'
    if d == 0: return s
    return s + ' ' + ('mốt' if d == 1 else o['tu'] if d == 4 else 'lăm' if d == 5 else SO[d])

def _tram(n, o, day=False):                        # 0..999; day = a non-leading group → "không trăm …"
    t, r = divmod(n, 100)
    if t == 0 and not day: return _chuc(r, o)
    s = SO[t] + ' trăm'
    if r == 0: return s
    if r < 10: return s + ' ' + o['linh'] + ' ' + SO[r]
    return s + ' ' + _chuc(r, o)

def doc_nguyen(n, o=None):
    o = o or OPT
    if n < 0: return 'âm ' + doc_nguyen(-n, o)
    if n < 1000: return _tram(n, o)
    ty, r = divmod(n, 10 ** 9)
    if ty: return doc_nguyen(ty, o) + ' tỷ' + ('' if r == 0 else ' ' + _duoi_ty(r, o, True))
    return _duoi_ty(n, o, False)

def _duoi_ty(n, o, day):                           # < 1e9
    parts, nhom = [], [(10 ** 6, 'triệu'), (1000, o['nghin']), (1, '')]
    first = not day
    for base, ten in nhom:
        g, n = divmod(n, base)
        if g == 0:
            if base == 1000 and parts and n and n < 100 and False: pass
            continue
        parts.append(_tram(g, o, day=not first) + (' ' + ten if ten else ''))
        first = False
    return ' '.join(parts) if parts else 'không'

def doc_thap_phan(nguyen, le, o=None):
    o = o or OPT
    s = doc_nguyen(int(nguyen), o) + ' ' + o['phay']
    z = len(le) - len(le.lstrip('0'))
    s += ' không' * z; rest = le[z:]
    if not rest: return s
    if len(rest) <= 2 and not o.get('le_tung_so'): return s + ' ' + doc_nguyen(int(rest), o)   # 3,73 → "… bảy mươi ba" (le_tung_so: "… bảy ba")
    return s + ' ' + ' '.join(SO[int(ch)] for ch in rest)

OPT = {'nghin': 'ngàn', 'linh': 'linh', 'tu': 'tư', 'phay': 'Phẩy'}   # 'ngàn': the mark voice garbles 'nghìn' (4/6 takes heard as "200 -300", "2 ngày 3") but reads 'ngàn' cleanly (6/6) — test 2026-10-19
THANG = {1: 'một', 4: 'tư'}

NUM = r'\d+\.\d{1,2}(?!\d)|(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?'

def _so(tok, o):
    """one numeric token as written ('2.397', '3,1', '3.5', '1946') → words"""
    if re.fullmatch(r'\d+\.\d{1,2}', tok): a, b = tok.split('.'); return doc_thap_phan(a, b, o)
    if ',' in tok: a, b = tok.split(','); return doc_thap_phan(a.replace('.', ''), b, o)
    return doc_nguyen(int(tok.replace('.', '')), o)

def _thang(m, o): m = int(m); return THANG.get(m, doc_nguyen(m, o)) if m != 4 else o['tu'] if o['tu'] == 'tư' else 'tư'

def doc(text, lang='vi', cfg=None):
    if not text or not str(lang).startswith('vi'): return text
    cfg = cfg or {}; o = {**OPT, **(cfg.get('doc_so') or {})}
    s = str(text)
    for k, v in (cfg.get('doc') or {}).items():                                   # pronunciation dictionary (acronyms, foreign names)
        s = re.sub(r'(?<!\w)' + re.escape(k) + r'(?!\w)', v, s)
    s = s.replace('−', '-').replace('‑', '-')
    s = re.sub(r'\b([Đđ]iều|[Kk]hoản|[Mm]ục) (\d+) ?[.,](\d+)\b',lambda m: f"{m[1]} {doc_nguyen(int(m[2]), o)} chấm {doc_nguyen(int(m[3]), o)}", s)   # legal article numbers: 49.3 → bốn mươi chín chấm ba
    s = re.sub(r'(?<![\d/])(\d{1,2})\s*[–—-]\s*(\d{1,2})/(\d{1,2})(?![\d/])', lambda m: f"{doc_nguyen(int(m[1]), o)} đến {m[2]}/{m[3]}", s)   # 12–17/10
    s = re.sub(r'(?<![\w.,])(\d{1,2})\s?[hH:](\d{2})(?!\d)', lambda m: f"{doc_nguyen(int(m[1]), o)} giờ {doc_nguyen(int(m[2]), o)}" if int(m[1]) < 25 and int(m[2]) < 60 else m[0], s)   # 17h30 / 17:30 → mười bảy giờ ba mươi
    s = re.sub(r'(?<![\w.,])(\d{1,2})\s?h(?![\w])', lambda m: f"{doc_nguyen(int(m[1]), o)} giờ" if int(m[1]) < 25 else m[0], s)   # 0h, 6h → không giờ, sáu giờ
    # dates: d/m/yyyy, d/m
    s = re.sub(r'(?<![\d/])(\d{1,2})/(\d{1,2})/(\d{4})(?![\d/])', lambda m: f"{doc_nguyen(int(m[1]), o)} tháng {_thang(m[2], o)} năm {doc_nguyen(int(m[3]), o)}", s)
    s = re.sub(r'(?<![\d/])(\d{1,2})/(\d{1,2})(?![\d/])', lambda m: f"{doc_nguyen(int(m[1]), o)} tháng {_thang(m[2], o)}" if 1 <= int(m[2]) <= 12 and 1 <= int(m[1]) <= 31 else m[0], s)
    s = re.sub(r'\btháng (\d{1,2})\b', lambda m: 'tháng ' + _thang(m[1], o) if 1 <= int(m[1]) <= 12 else m[0], s)
    s = re.sub(r'\bthứ 1\b', 'thứ nhất', s); s = re.sub(r'\bthứ 4\b', 'thứ tư', s)
    s = re.sub(r'\bquý 4\b', 'quý bốn', s)
    # ranges 12–17 / 2018-2025 → "… đến …"
    s = re.sub(rf'(?<![\w.,])({NUM})\s*[–—-]\s*({NUM})(?![\w])', lambda m: f"{m[1]} đến {m[2]}", s)
    # currency before the number: $5 → 5 đô la
    s = re.sub(rf'\$\s?({NUM})', r'\1 đô la', s)
    # sign: "-0,2" at a word start (not a hyphen inside a word / range)
    s = re.sub(rf'(^|[\s(“"])[-+]({NUM})', lambda m: m[1] + ('âm ' if m[0].strip(' (“"').startswith('-') else 'cộng ') + m[2], s)
    # units right after a number
    U = [('km²', 'ki lô mét vuông'), ('km2', 'ki lô mét vuông'), ('m²', 'mét vuông'), ('°C', 'độ C'), ('km/h', 'ki lô mét một giờ'), ('km', 'ki lô mét'),
         ('kg', 'ki lô gam'), ('%', 'phần trăm'), ('€', 'euro'), ('USD', 'đô la Mỹ'), ('VND', 'đồng'), ('×', 'lần'), ('x', 'lần')]
    for u, w in U:
        s = re.sub(rf'({NUM})\s?{re.escape(u)}(?![\w²])', rf'\1 {w}', s)
    s = re.sub(rf'(?<![\w.,])(?<!\w-)({NUM})(?![\w])', lambda m: _so(m[1], o), s)
    s = s.replace('%', ' phần trăm').replace('€', ' euro')
    s = re.sub(r'\b(nghìn|ngàn)\b', o['nghin'], s)
    s = re.sub(r'(?<!\w)(phẩy|Phẩy|PHẨY)(?!\w)', o['phay'], s)                 # VoiceStudio drops a lowercase 'phẩy' (0/9 takes said it: "ba một phần trăm"); 'Phẩy' is read 9/9 — test 2026-10-19                               # one style everywhere, also in numbers the writer spelled out
    return re.sub(r'[ \t]{2,}', ' ', s)

def ve_chu(heard, lang='vi', cfg=None):
    """Whisper writes numbers back as digits with stray spaces ("550 .000", "3 ,1 %") → join them and spell them out. NOT "3, 1" or "3-1":
    that is how Whisper writes a decimal whose 'phẩy' was NOT spoken (said: "3,1" / "3.1"), so it must stay a mismatch;
    so the listen-back can be compared word-for-word with the spoken text (a garbled number then shows up as a mismatch)."""
    if not heard or not str(lang).startswith('vi'): return heard
    h = re.sub(r'(\d) ?\. ?(\d{3})(?!\d)', r'\1.\2', heard)
    h = re.sub(r'(\d) ?\. ?(\d{3})(?!\d)', r'\1.\2', h)
    h = re.sub(r'(\d) ,(\d)', r'\1,\2', h)
    h = re.sub(r'(\d) \.(\d{1,2})(?!\d)', r'\1.\2', h)                         # "49 .3" 
    h = re.sub(r'(\d) %', r'\1%', h)
    return doc(h, lang, cfg)

NUMW = set('không một hai ba bốn năm sáu bảy tám chín mười mươi mốt tư lăm trăm nghìn ngàn triệu tỷ linh lẻ phẩy chấm'.split())

def _runs(text):
    w = re.sub(r'[^\w\s]', ' ', text.lower()).split(); out, cur = [], []
    for x in w + ['.']:
        if x in NUMW: cur.append(x)
        else:
            while cur and cur[-1] == 'không': cur.pop()                   # "… ba, không qua …": a trailing 'không' is the word "not"
            if len(cur) >= 2 and any(y in ('mươi', 'mười', 'trăm', 'nghìn', 'ngàn', 'triệu', 'tỷ', 'phẩy') for y in cur): out.append(' '.join(cur))
            cur = []
    return out

def so_sai(noi, heard, lang='vi', cfg=None):
    """spoken numbers (runs of number words in the text sent to the voice) that the listen-back does not contain — a whole-line
    match can stay > 90 % while "hai ngàn ba trăm" was heard as "200 -300", so numbers are checked one by one"""
    if not str(lang).startswith('vi'): return []
    DONG = {'tư': 'bốn', 'mốt': 'một', 'lăm': 'năm', 'lẻ': 'linh', 'nghìn': 'ngàn'}   # regional variants of the same number (244 = "… bốn mươi tư" = "… bốn mươi bốn")
    bo = lambda t: ' '.join(DONG.get(x, x) for x in t.split() if x != 'chấm')   # "49.3" spoken "bốn mươi chín ba" or "… chấm ba": same number
    H = lambda c: ' ' + bo(' '.join(re.sub(r'[^\w\s]', ' ', ve_chu(heard, lang, c).lower()).split())) + ' '
    c2 = {**(cfg or {}), 'doc_so': {**((cfg or {}).get('doc_so') or {}), 'le_tung_so': True}}   # decimals may be said digit by digit: "ba phẩy bảy ba"
    h, h2 = H(cfg), H(c2)
    return [r for r in _runs(noi) if ' ' + bo(r) + ' ' not in h and ' ' + bo(r) + ' ' not in h2]

if __name__ == '__main__':
    T = [('2.397 người', 'hai nghìn ba trăm chín mươi bảy người'), ('550.000', 'năm trăm năm mươi nghìn'), ('3,1%', 'ba phẩy một phần trăm'),
         ('-0,2%', 'âm không phẩy hai phần trăm'), ('giảm 0,2%', 'giảm không phẩy hai phần trăm'), ('năm 1946', 'năm một nghìn chín trăm bốn mươi sáu'),
         ('năm 2026', 'năm hai nghìn không trăm hai mươi sáu'), ('2.050', 'hai nghìn không trăm năm mươi'), ('105', 'một trăm linh năm'),
         ('21', 'hai mươi mốt'), ('25', 'hai mươi lăm'), ('24', 'hai mươi tư'), ('15', 'mười lăm'), ('10', 'mười'), ('1.000.000', 'một triệu'),
         ('1.002.003', 'một triệu không trăm linh hai nghìn không trăm linh ba'), ('3.595,5 tỷ €', 'ba nghìn năm trăm chín mươi lăm phẩy năm tỷ euro'),
         ('17/10/2026', 'mười bảy tháng mười năm hai nghìn không trăm hai mươi sáu'), ('ngày 17/10', 'ngày mười bảy tháng mười'), ('tháng 4', 'tháng tư'),
         ('12–17/10', 'mười hai đến mười bảy tháng mười'), ('2018-2025', 'hai nghìn không trăm mười tám đến hai nghìn không trăm hai mươi lăm'),
         ('0,05', 'không phẩy không năm'), ('3.5', 'ba phẩy năm'), ('52.000 €', 'năm mươi hai nghìn euro'), ('$106', 'một trăm linh sáu đô la'),
         ('21,3%', 'hai mươi mốt phẩy ba phần trăm'), ('100 km²', 'một trăm ki lô mét vuông'), ('thứ 1', 'thứ nhất'), ('2.500.000.000', 'hai tỷ năm trăm triệu'),
         ('1, 2 và 3', 'một, hai và ba'), ('điều 49.3', 'điều bốn mươi chín chấm ba'), ('Covid-19', 'Covid-19'), ('Q1', 'Q1')]
    bad = 0
    for a, b in T:
        r = doc(a, cfg={'doc_so': {'nghin': 'nghìn', 'phay': 'phẩy'}})
        if r != b: bad += 1; print('FAIL', a, '→', r, '| expected:', b)
    print(f'{len(T) - bad}/{len(T)} correct')
    print(doc('Ngày 17/10, 550.000 người.', cfg={'doc_so': {'nghin': 'ngàn', 'linh': 'lẻ'}}), '|', doc('105', cfg={'doc_so': {'linh': 'lẻ'}}))
