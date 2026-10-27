"""mega-shot · publish package ("dang bai" = posting): titles, description, tags, hashtags, credits, thumbnails — ready to paste.

Works in a series folder (loat.yaml → long YouTube video) and in a single-video folder (video.yaml → YouTube or TikTok/Reels/Shorts).
Runs automatically at the end of `xp series assemble` and `xp export`; re-run any time with `xp publish` (no re-render needed).

Optional block in loat.yaml / video.yaml (everything has a fallback):

  dang_bai:
    tieu_de: ["The ENTIRE History of Israel in {phut} Minutes", "…"]   # title options; {phut} = real length in minutes
    moc: "Hook paragraph — the first 2 lines show in search results."
    noi_dung: auto        # list of everything covered: auto = on-screen scene titles, or your own text
    kich_tinh: "A short dramatic paragraph."
    cam_ket: "Sources / balance statement."
    tag: [history of israel, …]                                          # YouTube tags (≤ 500 characters in total)
    caption: "Short caption for TikTok/Reels (vertical videos)."
  hashtag: [History, Israel, …]                                         # ≤ 15 (YouTube ignores ALL if > 60; the first 3 show above the title)

Outputs (out/):
  mo_ta_youtube.md      description only, paste-ready (≤ 5,000 characters, no < >)
  youtube_dang_bai.md   full package: titles (+ length check), description, tags, hashtags, pinned comment, thumbnails, checks
  ghi_cong_day_du.md    full credits with short links, split into parts ≤ 9,500 characters (pinned comments)
  dang_bai_mxh.md       vertical videos only: TikTok/Reels caption + hashtags + YouTube Shorts title
"""
import glob, html, json, os, re

LIM_TITLE, LIM_DESC, LIM_TAGS, LIM_CAPTION = 100, 5000, 500, 2200

def _yaml(p):
    import yaml
    import sys; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import yaml_keys   # English keys → internal names
    d = yaml.safe_load(open(p, encoding='utf-8')) or {}
    return yaml_keys.normalize_series(d) if os.path.basename(p) == 'loat.yaml' else yaml_keys.normalize(d) if os.path.basename(p) == 'video.yaml' else d

def _ts(t):
    t = int(round(t)); return f'{t // 3600}:{t % 3600 // 60:02d}:{t % 60:02d}' if t >= 3600 else f'{t // 60:02d}:{t % 60:02d}'

def _who(v, fix):
    """Clean author name: strip HTML/long parentheses/'unknown'; never cut at 'St.' 'A.' 'Co.'"""
    if str(v.get('id')) in fix: return fix[str(v.get('id'))]
    w = html.unescape(re.sub(r'<[^>]+>', '', str(v.get('tac_gia') or ''))).replace(chr(92), ' / ')
    w = re.sub(r'\s+', ' ', re.sub(r'\s*\([^)]{13,}\)', '', w)).strip()
    w = re.sub(r'(?i)^(photo(graph)? by|photographer:?)\s+', '', w)
    if not w or re.match(r'(?i)(wikimedia commons|not know|unknown|anonymous|n/a)', w):
        return 'Unknown photographer' if v.get('nguon') == 'wikimedia' else str(v.get('nguon') or '').capitalize()
    m = re.search(r'(?<=[a-z]{4})\.\s|[;|]', w)
    if m: w = w[:m.start()]
    w = w.strip(' .,'); return w if len(w) <= 60 else w[:58].rsplit(' ', 1)[0] + '…'

def _link(v): return f"https://commons.wikimedia.org/?curid={v['id']}" if v.get('nguon') == 'wikimedia' and v.get('id') else v.get('trang', '')
def _lic(v): return (v.get('giay_phep') or '').split('(')[0].strip() or '?'

def _context():
    """Series or single video → (kind, config, folders, language, name)."""
    if os.path.exists('loat.yaml'):
        L = _yaml('loat.yaml'); tm = (L.get('mo_dau') or {}).get('thu_muc')
        dirs = ([str(tm)] if tm else []) + [str(t['thu_muc']) for t in L.get('tap', [])]
        return 'series', L, dirs, str(L.get('ngon_ngu', 'vi')), L.get('ten') or os.path.basename(os.getcwd())
    S = _yaml('video.yaml'); P = _yaml('../loat.yaml') if os.path.exists('../loat.yaml') else {}
    for k in ('ngon_ngu', 'khung', 'hashtag', 'tham_khao'): S.setdefault(k, P.get(k))
    return 'video', S, ['.'], str(S.get('ngon_ngu') or 'vi'), S.get('ten') or os.path.basename(os.getcwd())

def _entries(dirs):
    out, seen = [], set()
    for d in dirs:
        gp = os.path.join(d, 'giay_phep.json')
        for v in (json.load(open(gp, encoding='utf-8')).values() if os.path.exists(gp) else []):
            key = (v.get('nguon'), str(v.get('id')))
            if v.get('thay_cho') or key in seen or v.get('nguon') == 'huashu': continue
            seen.add(key); out.append(v)
    for gp in glob.glob('anh_bia/giay_phep_anh_bia.json'):                     # images used only on thumbnails
        for v in json.load(open(gp, encoding='utf-8')):
            out.append({'nguon': 'wikimedia', 'id': v['id'], 'tac_gia': v['tac_gia'], 'giay_phep': v['giay_phep'], 'trang': v.get('trang'), '_thumb': True})
    return out

def _topics(dirs):
    """Everything covered, from on-screen scene titles (skip pure dates/questions/very short teasers)."""
    seen, out = set(), []
    for d in dirs:
        p = os.path.join(d, 'video.yaml')
        if not os.path.exists(p): continue
        for c in _yaml(p).get('canh') or []:
            t = str(c.get('chu') or '').strip()
            if not t or '?' in t or not re.search(r'[^\W\d_]{3}', t) or re.fullmatch(r'[\d\s,./–-]*(BCE|CE|TCN|CN)?', t): continue
            if t.lower() not in seen: seen.add(t.lower()); out.append(t)
    return out

def _duration(kind, name, S):
    vids = sorted(glob.glob('out/*_youtube.mp4') + [f for f in glob.glob('out/*.mp4') if 'xem_thu' not in f])
    if vids:
        import subprocess
        r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', vids[0]], capture_output=True, text=True)
        try: return float(r.stdout.strip())
        except ValueError: pass
    tl = 'build/timeline.json'
    return json.load(open(tl, encoding='utf-8'))['dur'] if os.path.exists(tl) else 0

def _root():
    d = os.path.abspath('.')
    while d != os.path.dirname(d):
        if os.path.isdir(os.path.join(d, '.mega-shot')): return d
        d = os.path.dirname(d)
    return os.path.abspath('../..')

def _chapters_single(S, en):
    """YouTube chapters for a single 16:9 video from scenes with an on-screen title (chu) or an explicit `chuong:`.
    Rules: first at 0:00, ≥ 3 chapters, each ≥ 10 s apart (we use ≥ 25 s so chapters stay meaningful)."""
    tl = 'build/timeline.json'
    if not os.path.exists(tl): return ''
    sc = json.load(open(tl, encoding='utf-8')).get('scenes', []); out = []
    clean = lambda t: re.sub(r'\s+', ' ', str(t).replace('**', '').replace('|', ' ')).strip(' ·:-')
    for s in sc:
        d = s.get('data') or {}; name = d.get('chuong') or d.get('chu')
        if not name or not re.search(r'[^\W\d_]{3}', str(name)): continue
        if not out: out.append((0.0, clean(name))); continue
        if s['t0'] - out[-1][0] >= 25: out.append((s['t0'], clean(name)))
    if not out or out[0][0] != 0.0: out.insert(0, (0.0, 'Intro' if en else 'Mở đầu'))
    return '\n'.join(f'{_ts(t)} {n}' for t, n in out) if len(out) >= 3 else ''

def _channel():
    """Channel profile (kenh/<id>/kenh.yaml) this video belongs to: `kenh:` in video.yaml or listed in a chu_de.yaml."""
    root = _root(); me = os.path.basename(os.path.abspath('.'))
    try: S = _yaml('video.yaml') if os.path.exists('video.yaml') else {}
    except Exception: S = {}
    for kp in sorted(glob.glob(os.path.join(root, 'kenh', '*', 'kenh.yaml'))):
        cid = os.path.basename(os.path.dirname(kp))
        if S.get('kenh') == cid: return _yaml(kp)
        cp = os.path.join(os.path.dirname(kp), 'chu_de.yaml')
        if os.path.exists(cp) and any(isinstance(t, dict) and str(t.get('video', '')).rstrip('/').endswith('/' + me) for t in (_yaml_list(cp))): return _yaml(kp)
    return None

def _yaml_list(p):
    import yaml
    return yaml.safe_load(open(p, encoding='utf-8')) or []

def _music_credit(S, en):
    f = str((S.get('nhac') or {}).get('file') or '')
    if not f: return ''
    base = os.path.basename(f); lic = ''
    lp = os.path.join(_root(), '.mega-shot', 'music', 'MUSIC_LICENSES.md')
    if os.path.exists(lp):
        for l in open(lp, encoding='utf-8'):
            if base in l and 'licence:' in l: lic = l.split('licence:', 1)[1].strip()
    if re.search(r'(?i)pixabay|cc0|creative commons|public domain', lic): return (f'Music: {lic}' if en else f'Nhạc nền: {lic}')
    return 'Music: licensed for use by the channel.' if en else 'Nhạc nền: kênh đã được cấp phép sử dụng.'

def _sfx_credit(dirs):
    for d in dirs:
        p = os.path.join(d, 'video.yaml')
        if os.path.exists(p) and 'kenney' in open(p, encoding='utf-8').read(): return True
    return False

def build(X=None):
    log = (X.log if X else print)
    kind, C, dirs, lang, name = _context(); en = not lang.startswith('vi'); D = C.get('dang_bai') or {}
    T = (lambda e, v: e if en else v)
    dur = _duration(kind, name, C); mins = max(1, round(dur / 60)); vertical = str(C.get('khung', '16x9')) == '9x16'
    fix = {str(k): v for k, v in (C.get('ghi_cong_sua') or {}).items()}
    tags = [str(h).lstrip('#') for h in (D.get('hashtag') or C.get('hashtag') or [])]
    hashtags = ' '.join('#' + h.replace(' ', '') for h in tags)
    first = next(iter(_yaml(os.path.join(dirs[-1] if kind == 'video' else dirs[0], 'video.yaml')).get('canh') or [{}]), {}) if os.path.exists(os.path.join(dirs[-1] if kind == 'video' else dirs[0], 'video.yaml')) else {}
    titles = [str(t).replace('{phut}', str(mins)) for t in (D.get('tieu_de') or [C.get('tieu_de') or first.get('chu') or name])]
    def clean(t): return re.sub(r'\s+', ' ', str(t).replace('**', '').replace('|', ' ')).strip()
    if not D and kind == 'video':                                                 # no dang_bai block: hook = the first two spoken lines
        sc = (C.get('canh') or [])[:2]; D = {'moc': ' '.join(clean(c.get('phu_de') or c.get('loi') or '') for c in sc)}
    if kind == 'video' and not vertical and not os.path.exists('out/chuong_youtube.txt'):
        ch = _chapters_single(C, en)
        if ch: os.makedirs('out', exist_ok=True); open('out/chuong_youtube.txt', 'w', encoding='utf-8').write(ch + '\n')
    chapters = open('out/chuong_youtube.txt', encoding='utf-8').read().strip() if os.path.exists('out/chuong_youtube.txt') else ''
    K = _channel(); KD = dict((K or {}).get('dang') or {})

    # ---- description: hook → summary → chapters → key points → sources → ━ footer (channel, credits, music, sfx, AI narration, note, hashtags) ----
    H = lambda e, v: T(e, v).upper() if en else T(e, v)
    desc = []
    if D.get('moc'): desc += [str(D['moc']).strip()]
    else: desc += [x for x in (C.get('tieu_de'), C.get('mo_ta')) if x]
    summary = [str(x).strip() for x in (D.get('tom_tat'), C.get('gioi_thieu') if not D.get('tom_tat') else None, D.get('kich_tinh')) if x]
    if summary: desc += ['', ' '.join(summary)]
    if chapters and not vertical: desc += ['', '⏱ ' + H('Chapters', 'Mục lục'), chapters]
    nd = D.get('noi_dung', 'auto'); tp = _topics(dirs) if nd == 'auto' else [str(x) for x in (nd if isinstance(nd, list) else [nd]) if x]
    if tp and (len(tp) >= 3) and not (chapters and nd == 'auto'):                  # chapters already list the topics → skip duplicate bullets
        desc += ['', '📌 ' + H('In this video', 'Trong video này'), *[f'• {x}' for x in tp[:8]]]
    if C.get('tham_khao'): desc += ['', '📚 ' + H('Sources', 'Nguồn tham khảo'), *[f'• {x}' for x in C['tham_khao']]]
    footer = ['', '━━━━━━━━━━━━━━━━━━━━']
    about = str(KD.get('gioi_thieu_kenh') or D.get('kenh') or '').strip()
    if about: footer += ['🎬 ' + H('About this channel', 'Về kênh'), about]
    if KD.get('handle'): footer += ['🔔 ' + T('Subscribe for new episodes', 'Đăng ký để xem tập mới') + f": https://www.youtube.com/{KD['handle']}?sub_confirmation=1"]

    entries = _entries(dirs); credits_full = [f"- {_who(v, fix)} — {_lic(v)} — {_link(v)}" + (T(' (thumbnail)', ' (ảnh bìa)') if v.get('_thumb') else '') for v in entries]
    if entries:
        parts, cur = [], []
        for l in credits_full:
            if cur and len('\n'.join(cur + [l])) > 9500: parts.append(cur); cur = []
            cur.append(l)
        parts.append(cur); os.makedirs('out', exist_ok=True)
        open('out/ghi_cong_day_du.md', 'w', encoding='utf-8').write('\n\n'.join((f'--- {i + 1}/{len(parts)} ---\n' if len(parts) > 1 else '') + '\n'.join(pp) for i, pp in enumerate(parts)) + '\n')
    if D.get('cam_ket'): footer += ['', '⚠️ ' + H('Note', 'Lưu ý'), str(D['cam_ket']).strip()]
    if KD.get('ban_quyen', True): footer += ['', T('© ', '© ') + (str(K.get('dang', {}).get('kenh_youtube') or K.get('ten')) if K else name) + T(' — original script, research and edit.',
                                                                                          ' — kịch bản, nghiên cứu và dựng phim gốc.')]
    desc += footer
    if hashtags: desc += ['', ' '.join(hashtags.split()[:3])]                         # YouTube shows the first 3 above the title; more dilutes them
    text = re.sub(r'[<>]', '', '\n'.join(desc)).strip() + '\n'                    # YouTube rejects < and > in descriptions
    open('out/mo_ta_youtube.md', 'w', encoding='utf-8').write(text)

    # ---- checks ----
    warn = []
    for t in titles:
        if len(t) > LIM_TITLE: warn.append(T(f'title > {LIM_TITLE} characters: "{t[:40]}…"', f'tiêu đề > {LIM_TITLE} ký tự: "{t[:40]}…"'))
        elif len(t) > 70: warn.append(T(f'title > 70 characters is cut off in search: "{t[:40]}…"', f'tiêu đề > 70 ký tự bị cắt khi tìm kiếm: "{t[:40]}…"'))
    if len(text) > LIM_DESC: warn.append(T(f'description {len(text)} > 5,000 characters — shorten', f'mô tả {len(text)} > 5.000 ký tự — rút gọn'))
    tag_list = [str(t) for t in D.get('tag') or []]; tag_txt = ', '.join(tag_list)
    if len(tag_txt) > LIM_TAGS: warn.append(T(f'tags {len(tag_txt)} > 500 characters', f'thẻ tag {len(tag_txt)} > 500 ký tự'))
    if len(tags) > 15: warn.append(T('more than 15 hashtags — YouTube shows only some, and ignores all above 60', 'hơn 15 hashtag — YouTube chỉ hiện một phần, quá 60 thì bỏ hết'))
    if not C.get('dang_bai'): warn.append(T('no publish (dang_bai) block — write titles/hook/tags in the YAML (see references/publishing.md)', 'chưa có khối dang_bai — viết tiêu đề/móc/tag trong YAML (xem references/publishing.md)'))
    if not tags: warn.append(T('no hashtags (hashtags: […])', 'chưa có hashtag (hashtag: […])'))
    if kind == 'series' and not chapters: warn.append(T('no chapters yet — run xp series assemble', 'chưa có chương — chạy xp series assemble'))

    # ---- full package ----
    thumbs = sorted(f.replace(chr(92), '/') for f in glob.glob('out/anh_bia_*.jpg') if 'xem_truoc' not in f)
    P = [T(f'# Publish package — {titles[0]}', f'# Gói đăng bài — {titles[0]}'), '',
         T(f'Length {_ts(dur)} · language {lang} · generated by `xp publish`.', f'Thời lượng {_ts(dur)} · ngôn ngữ {lang} · tạo bởi `xp publish`.'), '',
         T('## Title (pick one — the first is recommended)', '## Tiêu đề (chọn 1 — đề xuất số 1)'), '']
    P += [f'{i}. {t}  ({len(t)} {T("chars", "ký tự")})' for i, t in enumerate(titles, 1)]
    P += ['', T(f'## Description ({len(text)} / 5,000 characters)', f'## Mô tả ({len(text)} / 5.000 ký tự)'), '', '```', text.rstrip(), '```']
    if tag_list: P += ['', T(f'## Tags ({len(tag_txt)} / 500 characters)', f'## Thẻ tag ({len(tag_txt)} / 500 ký tự)'), '', '```', tag_txt, '```']
    if entries: P += ['', T('## Pinned comment', '## Bình luận ghim'), '', T('Paste `out/ghi_cong_day_du.md` (full credits with links — required for CC BY / CC BY-SA images).', 'Dán nội dung `out/ghi_cong_day_du.md` (ghi công đầy đủ kèm link — bắt buộc với ảnh CC BY / CC BY-SA).')]
    if thumbs: P += ['', T('## Thumbnails (YouTube Studio › Test & compare: up to 3)', '## Ảnh bìa (YouTube Studio › Thử nghiệm & so sánh: tối đa 3)'), ''] + [f'- {t}' for t in thumbs]
    srts = sorted(glob.glob('out/subtitles/*.srt'))
    if srts or os.path.exists(f'out/{name}.srt'):
        P += ['', T('## Subtitles / captions', '## Phụ đề (CC)'), '']
        P += [f'- `{s.replace(chr(92), "/")}`' + (' + `.txt`' if os.path.exists(s[:-4] + '.txt') else '') for s in srts] or [f'- `out/{name}.srt`']
        P += ['', T('YouTube Studio › Subtitles › Add language › Upload file › **With timing** → the `.srt` (or **Without timing** → the `.txt` transcript, YouTube syncs it) — one file per language. Do NOT set the source language as default (subtitles are already burned in); the English track lets international viewers turn on CC and helps search.',
                    'YouTube Studio › Phụ đề › Thêm ngôn ngữ › Tải tệp lên › **Có thời gian** → tệp `.srt` (hoặc **Không có thời gian** → tệp `.txt`, YouTube tự khớp giờ) — mỗi ngôn ngữ một tệp. KHÔNG đặt phụ đề ngôn ngữ gốc làm mặc định (đã in sẵn trên hình); bản tiếng Anh giúp khán giả quốc tế bật CC và tăng khả năng được tìm thấy.')]
    if os.path.exists('out/subtitles/en.todo.json') and not any(s.endswith('.en.srt') for s in srts): warn.append(T('English subtitles not translated yet (out/subtitles/en.todo.json → en.json → xp subtitles)', 'phụ đề tiếng Anh chưa dịch (out/subtitles/en.todo.json → en.json → xp subtitles)'))
    P += ['', T('## Checks', '## Kiểm tra'), ''] + ([f'- ⚠ {w}' for w in warn] or [T('- ✓ all limits OK', '- ✓ mọi giới hạn đều đạt')])
    open('out/youtube_dang_bai.md', 'w', encoding='utf-8').write('\n'.join(P) + '\n')

    # ---- vertical videos: TikTok / Reels / Shorts ----
    if vertical:
        cap = str(D.get('caption') or D.get('moc') or C.get('mo_ta') or titles[0]).strip()
        short_tags = ' '.join('#' + h.replace(' ', '') for h in tags[:5])
        full = (cap + '\n\n' + short_tags).strip()
        M = [T('# TikTok / Reels / Shorts', '# TikTok / Reels / Shorts'), '', T(f'## Caption ({len(full)} / 2,200 characters)', f'## Caption ({len(full)} / 2.200 ký tự)'), '', '```', full, '```', '',
             T('## YouTube Shorts title', '## Tiêu đề YouTube Shorts'), '', '```', (titles[0] + ' #Shorts')[:LIM_TITLE], '```']
        if len(full) > LIM_CAPTION: M += ['', T('⚠ caption longer than 2,200 characters', '⚠ caption dài hơn 2.200 ký tự')]
        open('out/dang_bai_mxh.md', 'w', encoding='utf-8').write('\n'.join(M) + '\n')
    log(T(f'publish package: out/youtube_dang_bai.md · description {len(text)}/5000 · {len(titles)} titles · {len(tags)} hashtags',
          f'gói đăng bài: out/youtube_dang_bai.md · mô tả {len(text)}/5000 · {len(titles)} tiêu đề · {len(tags)} hashtag') + (' · out/dang_bai_mxh.md' if vertical else ''))
    for w in warn: log('⚠', w)
    return text

if __name__ == '__main__': build()
