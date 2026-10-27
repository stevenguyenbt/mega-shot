"""mega-shot · `xp viral` — OPTIONAL viral research before writing a script.

  xp viral "<topic>" [--q "query 2|query 3"] [--format short|long|any] [--lang vi] [--region VN] [--days 730] [--n 25]

Finds the best-performing YouTube videos on a topic through the official YouTube Data API v3 (metadata only — nothing is
downloaded), scores how "viral" each one is and summarises the patterns, so the AI can then watch the top few in the
browser pane (view only) and propose 2–3 angles for the user to choose from (see references/viral-research.md).

Metrics per video
  views/day       views ÷ days since upload
  ratio           views ÷ channel subscribers  (> 1 = reached far beyond the channel's audience = the strongest viral signal)
  engagement      (likes + comments) ÷ views
  viral score     0–100, average percentile of ratio (45%), views/day (35%) and engagement (20%) inside this result set

Needs YOUTUBE_API_KEY in .mega-shot/keys.env (free, Google Cloud → YouTube Data API v3; ~10,000 units/day, one run of
one query ≈ 102 units). Without a key it still writes the report skeleton with search links (YouTube sorted by views,
TikTok search) for the AI to browse manually.

Outputs: in a video folder → ./build/viral/<slug>.json + ./viral.md (+ viral_phan_tich.md template); elsewhere →
<project>/.mega-shot/viral/<slug>/.
Rules: inspiration, not imitation — never download or reuse other creators' video, audio, thumbnails or script text.
"""
import collections, datetime as dt, io, json, math, os, sys, re, time, urllib.parse, urllib.request

API = 'https://www.googleapis.com/youtube/v3/'
VI = re.compile('[ăâđêôơưàảãạáằẳẵặắầẩẫậấèẻẽẹéềểễệếìỉĩịíòỏõọóồổỗộốờởỡợớùủũụúừửữựứỳỷỹỵý]', re.I)
STRIP = lambda t: re.sub(r'#\S+', '', t).strip()                                # drop hashtags when analysing titles
# stop-words (Vietnamese + English) used for the title keyword stats
STOP = set('''và của là có cho với những một các được không này đó khi thì để trong ra vào lại như bạn tôi mình ai gì
the a an of to in and is for on with how why what you your this that it are be from at by my me i we our video shorts short'''.split())

def _get(path, **q):
    url = API + path + '?' + urllib.parse.urlencode({k: v for k, v in q.items() if v not in (None, '')})
    req = urllib.request.Request(url, headers={'User-Agent': 'mega-shot/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=40) as r: return json.load(r)
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', 'replace')
        raise RuntimeError(f'YouTube API {e.code}: ' + (json.loads(body).get('error', {}).get('message', body[:200]) if body.startswith('{') else body[:200]))

def _dur(iso):
    m = re.match(r'P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', iso or '')
    if not m: return 0
    d, h, mi, s = (int(x or 0) for x in m.groups()); return d * 86400 + h * 3600 + mi * 60 + s

def _pct(vals):
    order = sorted(vals); n = len(order)
    return [(sum(1 for x in order if x < v) + .5 * sum(1 for x in order if x == v)) / n * 100 if n else 0 for v in vals]

def _fmt(n):
    n = float(n or 0)
    for d, u in ((1e9, 'B'), (1e6, 'M'), (1e3, 'K')):
        if n >= d: return f'{n / d:.1f}{u}'
    return f'{n:.0f}'

def _mmss(s): return f'{s // 60}:{s % 60:02d}'

def _slug(s):
    import unicodedata
    s = unicodedata.normalize('NFD', s.lower().replace('đ', 'd')); s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')[:50] or 'chu-de'

def _keys(root):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import keys
    return keys.load(root)                                                        # env > .env > .mega-shot/keys.env

def search(key, queries, fmt, lang, region, days, n, log):
    after = (dt.datetime.utcnow() - dt.timedelta(days=days)).strftime('%Y-%m-%dT%H:%M:%SZ') if days else None
    vdur = {'short': 'short', 'long': 'medium', 'any': None}[fmt]; ids = []; units = 0
    for q in queries:
        r = _get('search', part='snippet', type='video', q=q, order='viewCount', maxResults=50, relevanceLanguage=lang,
                 regionCode=region, videoDuration=vdur, publishedAfter=after, key=key); units += 100
        ids += [it['id']['videoId'] for it in r.get('items', []) if it['id'].get('videoId') not in ids]
        if fmt == 'long':                                                       # 'medium' = 4–20 min; add > 20 min too
            r = _get('search', part='snippet', type='video', q=q, order='viewCount', maxResults=25, relevanceLanguage=lang,
                     regionCode=region, videoDuration='long', publishedAfter=after, key=key); units += 100
            ids += [it['id']['videoId'] for it in r.get('items', []) if it['id'].get('videoId') not in ids]
    vids = []
    for i in range(0, len(ids), 50):
        r = _get('videos', part='snippet,statistics,contentDetails', id=','.join(ids[i:i + 50]), key=key); units += 1; vids += r.get('items', [])
    chans = {}
    cids = list({v['snippet']['channelId'] for v in vids})
    for i in range(0, len(cids), 50):
        r = _get('channels', part='statistics,snippet', id=','.join(cids[i:i + 50]), key=key); units += 1
        for c in r.get('items', []): chans[c['id']] = c
    now = dt.datetime.utcnow(); rows = []; ads = foreign = 0
    for v in vids:
        st, sn = v.get('statistics', {}), v['snippet']; d = _dur(v['contentDetails'].get('duration'))
        if fmt == 'short' and d > 180: continue                                # Shorts are ≤ 3 min
        ch = chans.get(sn['channelId'], {}); subs = int(ch.get('statistics', {}).get('subscriberCount') or 0); hidden = ch.get('statistics', {}).get('hiddenSubscriberCount')
        pub = dt.datetime.strptime(sn['publishedAt'][:19], '%Y-%m-%dT%H:%M:%S'); age = max((now - pub).days, 1)
        views, likes, com = int(st.get('viewCount') or 0), int(st.get('likeCount') or 0), int(st.get('commentCount') or 0)
        if views < 1000: continue
        eng0 = (likes + com) / views; ratio0 = views / max(subs, 100)
        if ratio0 > 300 and eng0 < .002: ads += 1; continue                   # paid ads: huge views relative to the channel but almost no interaction
        if lang == 'vi' and not (VI.search(sn['title']) or str(sn.get('defaultAudioLanguage') or sn.get('defaultLanguage') or '').startswith('vi')): foreign += 1; continue
        rows.append({'id': v['id'], 'url': f"https://www.youtube.com/{'shorts/' if d <= 180 else 'watch?v='}{v['id']}", 'title': sn['title'], 'channel': sn['channelTitle'],
                     'subs': subs, 'subs_hidden': bool(hidden), 'views': views, 'likes': likes, 'comments': com, 'dur': d, 'published': sn['publishedAt'], 'age_days': age,
                     'views_day': views / age, 'ratio': views / max(subs, 100), 'eng': (likes + com) / views, 'tags': sn.get('tags', [])[:15], 'lang': sn.get('defaultAudioLanguage') or sn.get('defaultLanguage', ''),
                     'thumb': sn.get('thumbnails', {}).get('high', {}).get('url', '')})
    if rows:
        pr, pv, pe = _pct([math.log10(r['ratio']) for r in rows]), _pct([r['views_day'] for r in rows]), _pct([r['eng'] for r in rows])
        for r, a, b, c in zip(rows, pr, pv, pe): r['score'] = round(.45 * a + .35 * b + .2 * c)
    rows.sort(key=lambda r: -r['score']); log(f'{len(rows)} videos · skipped {ads} ads, {foreign} in another language · ~{units} API quota units')
    return rows[:n], units

def patterns(rows, tz_h):
    if not rows: return {}
    top = rows[:max(5, len(rows) // 2)]; T = [STRIP(r['title']) or r['title'] for r in top]
    import unicodedata
    T = [unicodedata.normalize('NFC', t) for t in T]
    def grams(t):                                                             # Vietnamese: count 2-syllable phrases ("động lực"), other languages: single words
        ws = [w for w in re.findall(r'\w+', t.lower()) if not w.isdigit()]
        if any(VI.search(w) for w in ws): return {f'{x} {y}' for x, y in zip(ws, ws[1:]) if not (x in STOP and y in STOP)}
        return {w for w in ws if len(w) > 2 and w not in STOP}
    words = collections.Counter(g for t in T for g in grams(t))
    tags = collections.Counter(t.lower() for r in top for t in r['tags'])
    hours = collections.Counter((dt.datetime.strptime(r['published'][:19], '%Y-%m-%dT%H:%M:%S') + dt.timedelta(hours=tz_h)).hour for r in top)
    durs = sorted(r['dur'] for r in top)
    share = lambda f: round(100 * sum(1 for t in T if f(t)) / len(T))
    return {'n_top': len(top), 'median_dur': durs[len(durs) // 2], 'dur_range': [durs[0], durs[-1]],
            'pct_number': share(lambda t: re.search(r'\d', t)), 'pct_question': share(lambda t: '?' in t),
            'pct_emoji': share(lambda t: re.search('[\U0001F300-\U0001FAFF☀-➿]', t)),
            'pct_caps': share(lambda t: any(len(w) >= 4 and w.isupper() for w in re.findall(r'\w+', t))), 'pct_colon': share(lambda t: re.search(r'[:|–-]', t)),
            'median_title_len': sorted(len(t) for t in T)[len(T) // 2],
            'words': words.most_common(15), 'tags': tags.most_common(15), 'hours': sorted(hours.items(), key=lambda x: -x[1])[:4],
            'median_ratio': sorted(r['ratio'] for r in top)[len(top) // 2], 'median_eng': sorted(r['eng'] for r in top)[len(top) // 2]}

def report(topic, queries, fmt, rows, pat, units, links, tz_h):
    L = [f'# Viral research: {topic}', '',
         f'_{time.strftime("%Y-%m-%d %H:%M")} · queries: {", ".join(queries)} · format: {fmt} · source: YouTube Data API (metadata only)'
         + (f' · ~{units} quota units_' if units else '_'), '',
         "> For structural reference only. Do not download or reuse other creators' footage, audio, music, thumbnails or script text.", '']
    if rows:
        L += ['## Top videos (ranked by viral score)', '', '| # | Video | Channel | Subs | Views | Views/day | Views÷Subs | Engagement | Length | Age | Score |', '|---|---|---|---|---|---|---|---|---|---|---|']
        for i, r in enumerate(rows, 1):
            t = r['title'].replace('|', '/')[:70]
            L.append(f"| {i} | [{t}]({r['url']}) | {r['channel'][:22]} | {'hidden' if r['subs_hidden'] else _fmt(r['subs'])} | {_fmt(r['views'])} | {_fmt(r['views_day'])} | "
                     f"{r['ratio']:.1f}× | {100 * r['eng']:.1f}% | {_mmss(r['dur'])} | {r['age_days']}d | **{r['score']}** |")
        p = pat
        L += ['', '## Patterns in the top group', '',
              f"- **Duration:** median {_mmss(p['median_dur'])} (from {_mmss(p['dur_range'][0])} to {_mmss(p['dur_range'][1])}).",
              f"- **Titles:** median length {p['median_title_len']} chars · {p['pct_number']}% contain a number · {p['pct_question']}% are questions · {p['pct_colon']}% contain ':'/'|'/'–' · {p['pct_emoji']}% have emoji · {p['pct_caps']}% have an ALL-CAPS word.",
              f"- **Reach:** median views÷subs {p['median_ratio']:.1f}× · median engagement {100 * p['median_eng']:.1f}%.",
              f"- **Recurring title keywords:** {', '.join(f'{w} ({c})' for w, c in p['words'])}.",
              f"- **Common tags:** {', '.join(f'{w} ({c})' for w, c in p['tags']) or '—'}.",
              f"- **Posting hours (UTC{tz_h:+d}):** {', '.join(f'{h}h ({c})' for h, c in p['hours'])}.", '']
    else:
        L += ['## No YouTube data', '', 'No `YOUTUBE_API_KEY` (or no results). The AI researches via web search and the links below (view only).', '']
    L += ['## Links to review (in-app browser, view only)', ''] + [f'- [{k}]({u})' for k, u in links] + ['',
          '## Next steps for the AI', '',
          '1. Open the 3–5 highest-scoring videos (and 2–3 TikToks on the same topic) in the in-app browser. View only, no downloads.',
          '2. Fill in `viral_phan_tich.md`: 0–3 s hook, first frame, cutting rhythm, on-screen text, voice, music, structure, ending, title and thumbnail formula.',
          '3. Extract 3–5 shared viral factors. Propose 2–3 directions (angle + hook + title + duration + style) for the user to choose from.',
          '4. The chosen direction must be **original** content: self-researched facts, self-written script, licensed visuals.']
    return '\n'.join(L) + '\n'

TEMPLATE = '''# Viral analysis — {topic}

> Learn the structure, do not copy. For each video: note your own observations, do NOT transcribe the script.

## Video 1: <title> — <link> — <views, views÷subs>
- **0–3 s hook:** (type: paradox / number / question / shocking image / promise) …
- **First frame (auto thumbnail):** any text, what text, colours …
- **Rhythm:** number of cuts in the first 10 s ≈ … ; sentence length …
- **On-screen text:** position, size, keyword highlighting, karaoke-style subtitles? …
- **Voice & music:** voice (male/female, fast/slow, emotion), music (driving/soft), sound effects …
- **Structure:** (countdown / story / Q&A / comparison / before–after) …
- **Retention:** "but…", "and the strangest part…", end-to-start loop …
- **Ending & call to action:** comment question? loop? …
- **Title / thumbnail:** formula …

(repeat for videos 2–5)

## Shared viral factors (3–5 points)
1. …

## Proposals for your video (for the user to choose)
| Direction | Angle | Opening hook | Title | Duration | Visual style |
|---|---|---|---|---|---|
| A | … | … | … | … | … |
| B | … | … | … | … | … |
| C | … | … | … | … | … |
'''

def main(a, X):
    root = X.find_root('.')
    if not os.path.isdir(os.path.join(root, '.mega-shot')): root = os.path.dirname(os.path.dirname(os.path.dirname(X.SKILL)))
    topic = a.topic.strip(); queries = [topic] + [q.strip() for q in (a.q or '').split('|') if q.strip()]; slug = _slug(topic)
    in_video = os.path.exists('video.yaml') or os.path.exists('loat.yaml')
    out_dir = os.path.join('build', 'viral') if in_video else os.path.join(root, '.mega-shot', 'viral', slug); os.makedirs(out_dir, exist_ok=True)
    md_path = 'viral.md' if in_video else os.path.join(out_dir, 'viral.md'); tpl_path = 'viral_phan_tich.md' if in_video else os.path.join(out_dir, 'viral_phan_tich.md')
    tz_h = {'VN': 7, 'TH': 7, 'ID': 7, 'US': -5, 'GB': 0, 'JP': 9, 'KR': 9, 'IN': 5}.get((a.region or '').upper(), 0)
    qq = urllib.parse.quote(topic)
    links = [('YouTube — sorted by views', f'https://www.youtube.com/results?search_query={qq}&sp=CAM%253D'),
             ('YouTube Shorts', f'https://www.youtube.com/results?search_query={qq}+%23shorts&sp=CAM%253D'),
             ('TikTok — search', f'https://www.tiktok.com/search?q={qq}'),
             ('Google Trends', f'https://trends.google.com/trends/explore?q={qq}' + (f'&geo={a.region.upper()}' if a.region else ''))]
    key = _keys(root).get('YOUTUBE_API_KEY'); rows, units = [], 0
    if key:
        try: rows, units = search(key, queries, a.format, a.lang, a.region, a.days, a.n, X.log)
        except RuntimeError as e: X.log(f'⚠ {e} — writing only the report skeleton + links')
    else:
        X.log('⚠ no YOUTUBE_API_KEY (.env or .mega-shot/keys.env) — writing only the report skeleton + links (the AI researches via web search / browser)')
        X.log('  get a free key: Google Cloud Console → create a project → enable "YouTube Data API v3" → Credentials → API key → add YOUTUBE_API_KEY=… to .env')
    pat = patterns(rows, tz_h)
    json.dump({'topic': topic, 'queries': queries, 'format': a.format, 'lang': a.lang, 'region': a.region, 'made': time.strftime('%Y-%m-%d %H:%M'), 'units': units,
               'videos': rows, 'patterns': pat, 'links': links}, open(os.path.join(out_dir, slug + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    io.open(md_path, 'w', encoding='utf-8').write(report(topic, queries, a.format, rows, pat, units, links, tz_h))
    if not os.path.exists(tpl_path): io.open(tpl_path, 'w', encoding='utf-8').write(TEMPLATE.format(topic=topic))
    X.log(f'✓ {md_path}' + (f' · {len(rows)} videos · median {_mmss(pat["median_dur"])} · views÷subs {pat["median_ratio"]:.1f}×' if rows else ''))
    X.log(f'  next: the AI watches the top 3–5 videos in the browser (view only) → fills {tpl_path} → proposes 2–3 directions for the user')
