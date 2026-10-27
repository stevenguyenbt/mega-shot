"""mega-shot · `xp channel` — automatic daily videos per YouTube channel, uploaded PRIVATE for the owner to review.

Files (project root):
  kenh/<id>/kenh.yaml     channel profile: niche, language, format, template, voice, music, style reference video, rules,
                          allowed extra sources (standing permission for THIS channel), schedule, upload settings
  kenh/<id>/chu_de.yaml   topic backlog: de-xuat (AI proposal) → duyet (approved) → dang-lam → da-dang (uploaded private)
                          | can-xem (failed a gate — needs the owner) | loi (error) | bo (rejected)
  kenh/<id>/nhat_ky.jsonl event log (one JSON per line)
  .mega-shot/youtube/client_secret.json   OAuth client (Google Cloud, "Desktop app") — the owner downloads it
  .mega-shot/youtube/token_<id>.json      per-channel authorisation (never printed, never packed)

Commands:
  xp channel list [--json]                         every channel + backlog counts + last result
  xp channel new <id> --name "…" [--like videos/x] create a profile (copies format/voice/music/style from a reference video)
  xp channel topics <id> [--add "Title | angle"] [--approve 1,3] [--reject 2] [--approve-all]
  xp channel next <id> [--json]                    claim the next approved topic → dang-lam; prints the video folder to create
  xp channel mark <id> <topic> <state> [--video videos/x] [--note "…"]
  xp channel auth <id>                             one-time Google sign-in for that channel (browser; the owner logs in)
  xp channel upload <id> <videos/x> [--topic t]    upload PRIVATE: title, description, tags, category, language, thumbnail, captions
  xp channel brief <id>                            the self-contained instruction block the scheduled Claude task follows
  xp channel schedule <id> [--at 03:00] [--days t2,t4|all|weekdays|weekend] [--per-night N]   per-channel run time
  xp channel due [--claim] [--json]                channels due now (the hourly task); --claim takes the run lock
  xp channel release                               free the run lock at the end of a run
The scheduled tasks (Claude desktop app, runs on this machine while the app is open) call these commands; see references/channels.md.
"""
import datetime, glob, json, os, re, sys, time

ROOT = None
STATES = ['de-xuat', 'duyet', 'dang-lam', 'da-dang', 'can-xem', 'loi', 'bo']
SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.force-ssl']


def _yaml():
    try:
        from ruamel.yaml import YAML
        y = YAML(); y.preserve_quotes = True; y.width = 4096; return y
    except ImportError: return None


def yload(p, d=None):
    if not os.path.exists(p): return d
    y = _yaml()
    with open(p, encoding='utf-8') as f: return (y.load(f) if y else __import__('yaml').safe_load(f)) or d


def ysave(p, data):
    os.makedirs(os.path.dirname(p), exist_ok=True); y = _yaml()
    with open(p, 'w', encoding='utf-8', newline='') as f:
        if y: y.dump(data, f)
        else: __import__('yaml').safe_dump(data, f, allow_unicode=True, sort_keys=False)


def kdir(cid): return os.path.join(ROOT, 'kenh', cid)
def profile(cid):
    p = yload(os.path.join(kdir(cid), 'kenh.yaml'))
    if not p: raise SystemExit(f'channel "{cid}" does not exist — xp channel new {cid} --name "…"')
    return p
def topics(cid):
    d = yload(os.path.join(kdir(cid), 'chu_de.yaml'), []) or []
    if isinstance(d, dict): d = d.get('chu_de') or []          # some channels use the {chu_de: [...]} form
    return [t for t in d if isinstance(t, dict)]
def save_topics(cid, T): ysave(os.path.join(kdir(cid), 'chu_de.yaml'), T)
def log_event(cid, **e):
    e = {'t': datetime.datetime.now().isoformat(timespec='seconds'), **e}
    with open(os.path.join(kdir(cid), 'nhat_ky.jsonl'), 'a', encoding='utf-8') as f: f.write(json.dumps(e, ensure_ascii=False) + '\n')
    _lock_touch()


# ---------------------------------------------------------------- schedule (lich) — one hourly task, per-channel time + days
# kenh.yaml → lich: {gio: "03:00", ngay: [t2, t3, t4, t5, t6, t7, cn], video_moi_dem: 1}
# The scheduled task wakes every hour and runs `xp channel due --claim`: channels whose time has passed today and that have not
# started today. A lock file stops two runs from sharing the GPU; every log_event refreshes it, it expires after LOCK_H hours.
DAYS = ['t2', 't3', 't4', 't5', 't6', 't7', 'cn']
LOCK_H = 6
def _lock_path(): return os.path.join(ROOT, '.mega-shot', 'kenh_dang_chay.json')
def _lock():
    try: L = json.load(open(_lock_path(), encoding='utf-8'))
    except Exception: return None
    age = time.time() - L.get('cap_nhat', 0)
    return L if age < LOCK_H * 3600 else None
def _lock_touch():
    p = _lock_path()
    if ROOT and os.path.exists(p):
        try: L = json.load(open(p, encoding='utf-8')); L['cap_nhat'] = time.time(); json.dump(L, open(p, 'w', encoding='utf-8'))
        except Exception: pass
def lich(P):
    L = dict(P.get('lich') or {}); g = str(L.get('gio') or '01:00')
    m = re.match(r'^(\d{1,2})(?::(\d{2}))?$', g.strip()); h, mi = (int(m.group(1)) % 24, int(m.group(2) or 0)) if m else (1, 0)
    ngay = [d for d in (L.get('ngay') or DAYS) if d in DAYS] or DAYS
    return {'gio': f'{h:02d}:{mi:02d}', 'ngay': ngay, 'video_moi_dem': int(L.get('video_moi_dem', 1) if L.get('video_moi_dem') is not None else 1)}
def _started_today(cid, day):
    lf = os.path.join(kdir(cid), 'nhat_ky.jsonl'); n = 0; empty = False
    if os.path.exists(lf):
        for l in open(lf, encoding='utf-8'):
            if not l.strip(): continue
            e = json.loads(l)
            if not str(e.get('t', '')).startswith(day): continue
            if e.get('su_kien') == 'bat-dau': n += 1
            if e.get('su_kien') == 'het-chu-de': empty = True
    return n, empty
def next_run(P, now=None):
    """next datetime the channel is due (None when it never runs)."""
    now = now or datetime.datetime.now(); S = lich(P)
    if not P.get('bat', True) or S['video_moi_dem'] <= 0: return None
    h, mi = map(int, S['gio'].split(':'))
    for k in range(8):
        d = (now + datetime.timedelta(days=k)).replace(hour=h, minute=mi, second=0, microsecond=0)
        if DAYS[d.weekday()] in S['ngay'] and d > now: return d
    return None
# ---------------------------------------------------------------- weekly content plan (ke_hoach) — exact items with production + publish times
# kenh/<id>/ke_hoach/<week>/ke_hoach.yaml → `xp channel plan <id> <file>` imports items into chu_de.yaml as approved topics:
#   { id, tieu_de, loai: short|long, khung, kich_ban: <folder with video.yaml + nghien_cuu.md>, lam_tu: "2026-10-18T01:00" (local),
#     dang_luc: "2026-10-18T16:00:00Z" (UTC publish time) }
# A plan item is produced only from lam_tu on; upload schedules YouTube's own publishAt (the video goes public by itself at that
# time) when kenh.yaml → dang.tu_dong_cong_khai is true (the channel owner's standing permission). Otherwise everything stays PRIVATE.
def _dt(s):
    if not s: return None
    s = str(s).replace('Z', '+00:00')
    try: d = datetime.datetime.fromisoformat(s)
    except ValueError: return None
    return d
def _quota_reset(now=None):
    """next YouTube quota reset (midnight Pacific time) in local machine time, + 10 min"""
    from zoneinfo import ZoneInfo
    pt = datetime.datetime.now(ZoneInfo('America/Los_Angeles')); nxt = (pt + datetime.timedelta(days=1)).replace(hour=0, minute=10, second=0, microsecond=0)
    return nxt.astimezone().replace(tzinfo=None)
def _plan_ready(T, now=None):
    now = now or datetime.datetime.now()
    R = [t for t in T if t.get('trang_thai') == 'duyet' and t.get('lam_tu') and _dt(t['lam_tu']) and _dt(t['lam_tu']).replace(tzinfo=None) <= now]
    return sorted(R, key=lambda t: (t.get('loai') == 'long', str(t.get('dang_luc') or '')))   # Shorts (time-critical) first, long videos last
def _old_pool(T): return [t for t in T if t.get('trang_thai') == 'duyet' and not t.get('lam_tu')]

def due(now=None):
    now = now or datetime.datetime.now(); day = f'{now:%Y-%m-%d}'; out, skip = [], []
    for cid in channels():
        P = profile(cid); S = lich(P); h, mi = map(int, S['gio'].split(':'))
        auth = os.path.exists(os.path.join(ROOT, '.mega-shot', 'youtube', f'token_{cid}.json'))
        n, empty = _started_today(cid, day); why = None
        dang = any(t.get('trang_thai') == 'dang-lam' and not (t.get('thu_lai_tu') and _dt(t['thu_lai_tu']) and _dt(t['thu_lai_tu']).replace(tzinfo=None) > now) for t in topics(cid))       # previous run was interrupted → resume (does not count as done)
        if dang and P.get('bat', True) and auth: out.append({'kenh': cid, 'gio': S['gio'], 'con_lai': max(1, S['video_moi_dem'] - n + 1), 'tiep_tuc': True}); continue
        ready = _plan_ready(topics(cid), now)
        if ready and P.get('bat', True) and auth: out.append({'kenh': cid, 'gio': 'plan', 'con_lai': len(ready), 'ke_hoach': [t['id'] for t in ready]}); continue
        if not P.get('bat', True): why = 'paused'
        elif S['video_moi_dem'] <= 0: why = '0 videos/run'
        elif not auth: why = 'YouTube not authorised'
        elif DAYS[now.weekday()] not in S['ngay']: why = 'not scheduled today'
        elif (now.hour, now.minute) < (h, mi): why = f'not yet {S["gio"]}'
        elif n >= S['video_moi_dem']: why = f'already made {n} videos today'
        elif empty: why = 'no approved topics left'
        elif not _old_pool(topics(cid)): why = 'no approved topics (outside the weekly plan)'
        (skip if why else out).append({'kenh': cid, 'gio': S['gio'], 'con_lai': S['video_moi_dem'] - n, **({'ly_do': why} if why else {})})
    return out, skip
def slug(s):
    import unicodedata
    s = unicodedata.normalize('NFD', str(s).lower()).replace('đ', 'd')
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', ''.join(c for c in s if unicodedata.category(c) != 'Mn'))).strip('-')[:48]
def channels(): return sorted(os.path.basename(os.path.dirname(p)) for p in glob.glob(os.path.join(ROOT, 'kenh', '*', 'kenh.yaml')))


def summary(cid):
    P = profile(cid); T = topics(cid); cnt = {s: sum(1 for t in T if t.get('trang_thai') == s) for s in STATES}
    ev = []
    lf = os.path.join(kdir(cid), 'nhat_ky.jsonl')
    if os.path.exists(lf): ev = [json.loads(l) for l in open(lf, encoding='utf-8') if l.strip()][-8:]
    auth = os.path.exists(os.path.join(ROOT, '.mega-shot', 'youtube', f'token_{cid}.json'))
    nr = next_run(P)
    return {'id': cid, 'ten': str(P.get('ten', cid)), 'bat': bool(P.get('bat', True)), 'dinh_dang': dict(P.get('dinh_dang') or {}), 'dem': cnt,
            'da_uy_quyen': auth, 'chu_de': [dict(t) for t in T][-40:], 'nhat_ky': ev,
            'lich': lich(P), 'lan_toi': nr.isoformat(timespec='minutes') if nr else None}


# ---------------------------------------------------------------- commands
def c_list(a, X):
    S = [summary(c) for c in channels()]
    if a.json: print(json.dumps(S, ensure_ascii=False, default=str)); return
    if not S: X.log('no channels yet — xp channel new <id> --name "…" --like videos/<reference video>'); return
    for s in S:
        d = s['dem']; X.log(f"{'●' if s['bat'] else '○'} {s['id']:<14} {s['ten'][:28]:<28} {s['dinh_dang'].get('khung', '?')} {s['dinh_dang'].get('ngon_ngu', '?')} · "
                            f"proposed {d['de-xuat']} · approved {d['duyet']} · posted {d['da-dang']} · needs review {d['can-xem']} · errors {d['loi']} · "
                            f"{'YouTube ✓' if s['da_uy_quyen'] else 'YouTube not authorised'}")


def c_new(a, X):
    cid = slug(a.id); d = kdir(cid)
    if os.path.exists(os.path.join(d, 'kenh.yaml')) and not a.force: X.die(f'channel {cid} already exists (add --force to overwrite)')
    ref = {}
    if a.like:
        vy = os.path.join(ROOT, a.like, 'video.yaml') if not os.path.isabs(a.like) else os.path.join(a.like, 'video.yaml')
        ref = yload(vy, {}) or {}
        if not ref: X.die(f'cannot read {vy}')
    P = {
        'ten': a.name or cid, 'bat': True,
        'mo_ta': 'Channel niche and audience (1–3 sentences) — the AI uses it to propose topics and keep the channel voice.',
        'dinh_dang': {'khung': str(ref.get('khung', '16x9')), 'mau': 'footage', 'ngon_ngu': ref.get('ngon_ngu', 'vi'),
                      'do_dai_giay': ref.get('muc_tieu_giay') or [300, 420]},
        'video_mau': a.like or '',
        'giong': dict(ref.get('giong') or {'mau': 'mark', 'toc_do': 1.1}),
        'nhac': dict(ref.get('nhac') or {}),
        'phong_cach': dict(ref.get('phong_cach') or {}),
        'nguon_them': list(ref.get('nguon_them') or []),
        'quy_tac': ['Sourced research in nghien_cuu.md; verify independently before voice-over.',
                    'Sensitive topics (religion, politics, health): hedge, stay neutral, never assert what is disputed.',
                    'Do not repeat posted topics; every video gets its own angle.'],
        'lich': {'video_moi_dem': 1},
        'dang': {'che_do': 'private', 'danh_muc': 27, 'tag_chung': [], 'phu_de': True},
    }
    os.makedirs(d, exist_ok=True); ysave(os.path.join(d, 'kenh.yaml'), P)
    if not os.path.exists(os.path.join(d, 'chu_de.yaml')): save_topics(cid, [])
    log_event(cid, su_kien='tao-kenh', video_mau=a.like or ''); X.log(f'✓ kenh/{cid}/kenh.yaml — edit mo_ta, quy_tac, then: xp channel auth {cid}')


def c_topics(a, X):
    cid = a.id; T = topics(cid); ch = False
    for s in a.add or []:
        tt, _, goc = s.partition('|')
        T.append({'id': f"{datetime.date.today():%Y%m%d}-{slug(tt)}", 'tieu_de': tt.strip(), 'goc': goc.strip(), 'trang_thai': 'de-xuat',
                  'ngay': f"{datetime.date.today()}"}); ch = True
    def pick(spec, st):
        nonlocal ch
        idx = [int(x) for x in str(spec).split(',') if x.strip().isdigit()]
        for i in idx:
            if 1 <= i <= len(T): T[i - 1]['trang_thai'] = st; ch = True
    if a.approve: pick(a.approve, 'duyet')
    if a.reject: pick(a.reject, 'bo')
    if a.approve_all:
        for t in T:
            if t.get('trang_thai') == 'de-xuat': t['trang_thai'] = 'duyet'; ch = True
    if ch: save_topics(cid, T); log_event(cid, su_kien='cap-nhat-chu-de')
    for i, t in enumerate(T, 1): X.log(f"{i:>3}. [{t.get('trang_thai')}] {t.get('tieu_de')}" + (f" — {t.get('goc')}" if t.get('goc') else '') + (f" → {t.get('video')}" if t.get('video') else ''))


def c_next(a, X):
    cid = a.id; P = profile(cid); T = topics(cid)
    if not P.get('bat', True): X.log(f'channel {cid} is paused'); print(json.dumps({'kenh': cid, 'chu_de': None}) if a.json else ''); return
    t = next((t for t in T if t.get('trang_thai') == 'dang-lam' and t.get('video') and not (t.get('thu_lai_tu') and _dt(t['thu_lai_tu']) and _dt(t['thu_lai_tu']).replace(tzinfo=None) > datetime.datetime.now())), None)   # previous run interrupted / waiting for quota → continue in the same folder
    if t:
        t['tiep_tuc'] = True; save_topics(cid, T); log_event(cid, su_kien='tiep-tuc', chu_de=t['id'], video=t['video'])
        out = {'kenh': cid, 'chu_de': dict(t), 'tiep_tuc': True, 'ho_so': json.loads(json.dumps(P, default=str))}
        print(json.dumps(out, ensure_ascii=False, default=str) if a.json else f"(resuming) {t['id']} → {t['video']}"); return
    pr = _plan_ready(T)
    if pr:                                                                            # weekly plan: script already written → copy into the video folder
        t = pr[0]; vd = f"videos/{cid}-{t['id']}"; t.update(trang_thai='dang-lam', video=vd, bat_dau=datetime.datetime.now().isoformat(timespec='seconds'))
        dst = os.path.join(ROOT, vd)
        if not os.path.exists(os.path.join(dst, 'video.yaml')) and t.get('kich_ban'):
            import shutil
            src = t['kich_ban'] if os.path.isabs(t['kich_ban']) else os.path.join(ROOT, t['kich_ban'])
            shutil.copytree(src, dst, dirs_exist_ok=True)
            tpl = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'templates', str((P.get('dinh_dang') or {}).get('mau') or 'footage'), 'film.html')
            if os.path.exists(tpl) and not os.path.exists(os.path.join(dst, 'film.html')): shutil.copy(tpl, os.path.join(dst, 'film.html'))
        save_topics(cid, T); log_event(cid, su_kien='bat-dau', chu_de=t['id'], video=vd, ke_hoach=True, dang_luc=str(t.get('dang_luc') or ''))
        out = {'kenh': cid, 'chu_de': dict(t), 'ke_hoach': True, 'ho_so': json.loads(json.dumps(P, default=str))}
        print(json.dumps(out, ensure_ascii=False, default=str) if a.json else f"(plan) {t['id']} → {vd} · publish {t.get('dang_luc')}"); return
    t = next(iter(_old_pool(T)), None)
    if not t:
        log_event(cid, su_kien='het-chu-de'); X.log(f'channel {cid}: no approved topics left — propose more and approve them in Studio')
        if a.json: print(json.dumps({'kenh': cid, 'chu_de': None}))
        return
    t['trang_thai'] = 'dang-lam'; t['video'] = f"videos/{cid}-{datetime.date.today():%Y%m%d}-{slug(t['tieu_de'])[:32]}"; t['bat_dau'] = datetime.datetime.now().isoformat(timespec='seconds')
    save_topics(cid, T); log_event(cid, su_kien='bat-dau', chu_de=t['id'], video=t['video'])
    out = {'kenh': cid, 'chu_de': dict(t), 'ho_so': json.loads(json.dumps(P, default=str))}
    print(json.dumps(out, ensure_ascii=False, default=str) if a.json else f"{t['id']} → {t['video']}")


def c_plan(a, X):
    """xp channel plan <id> <ke_hoach.yaml> — import a weekly plan as approved topics (idempotent: same id → updated, not duplicated)."""
    cid = a.id; f = (a.rest or [None])[0]
    if not f: raise SystemExit('xp channel plan <id> kenh/<id>/ke_hoach/<week>/ke_hoach.yaml')
    f = f if os.path.isabs(f) else os.path.join(ROOT, f); items = yload(f, []) or []
    T = topics(cid); by = {t.get('id'): t for t in T}; n_new = n_upd = 0
    for it in items:
        it = dict(it); kb = it.get('kich_ban') or os.path.join(os.path.dirname(f), it['id'])
        if not os.path.exists(os.path.join(kb if os.path.isabs(kb) else os.path.join(ROOT, kb), 'video.yaml')): X.log(f"⚠ {it['id']}: no script yet ({kb}/video.yaml) — imported anyway, will error when its turn comes")
        rec = {'id': it['id'], 'tieu_de': it.get('tieu_de', it['id']), 'goc': it.get('goc', ''), 'trang_thai': 'duyet', 'loai': it.get('loai', 'short'),
               'khung': it.get('khung', '9x16' if it.get('loai', 'short') == 'short' else '16x9'), 'kich_ban': os.path.relpath(kb if os.path.isabs(kb) else os.path.join(ROOT, kb), ROOT).replace(os.sep, '/'),
               'lam_tu': str(it['lam_tu']), 'dang_luc': str(it['dang_luc']), 'tuan': os.path.basename(os.path.dirname(f))}
        if rec['id'] in by:
            if by[rec['id']].get('trang_thai') in ('dang-lam', 'da-dang'): continue
            by[rec['id']].update(rec); n_upd += 1
        else: T.append(rec); n_new += 1
    save_topics(cid, T); log_event(cid, su_kien='nhap-ke-hoach', tep=os.path.relpath(f, ROOT), moi=n_new, cap_nhat=n_upd)
    X.log(f'✓ {cid}: imported {n_new} new items, updated {n_upd} — see: xp channel topics {cid}')


def c_due(a, X):
    """which channels to make now; --claim also takes the run lock (nothing is due while another run holds it)."""
    L = _lock()
    if L:
        r = {'ban': True, 'kenh': [], 'tu': datetime.datetime.fromtimestamp(L['bat_dau']).isoformat(timespec='minutes'), 'dang_lam': L.get('kenh', [])}
        print(json.dumps(r, ensure_ascii=False)) if a.json else X.log(f"another run is in progress (since {r['tu']}) — skipping"); return
    out, skip = due()
    if a.claim and out:
        os.makedirs(os.path.dirname(_lock_path()), exist_ok=True)
        json.dump({'bat_dau': time.time(), 'cap_nhat': time.time(), 'kenh': [x['kenh'] for x in out]}, open(_lock_path(), 'w', encoding='utf-8'))
    if a.json: print(json.dumps({'ban': False, 'kenh': out, 'bo_qua': skip}, ensure_ascii=False)); return
    for x in out: X.log(f"▶ {x['kenh']} (schedule {x['gio']}) — making {x['con_lai']} videos")
    for x in skip: X.log(f"· {x['kenh']} — {x['ly_do']}")
    if not out: X.log('no channel is due')


def c_release(a, X):
    p = _lock_path()
    if os.path.exists(p): os.remove(p); X.log('✓ run lock released')
    else: X.log('no lock')


def c_schedule(a, X):
    """xp channel schedule <id> [--at 03:00] [--days t2,t4,t6|all|weekdays|weekend] [--per-night N] — or no options to show."""
    cid = a.id; p = os.path.join(kdir(cid), 'kenh.yaml'); P = profile(cid); L = dict(P.get('lich') or {}); ch = False
    if a.at:
        if not re.match(r'^\d{1,2}(:\d{2})?$', a.at.strip()): X.die('time format HH:MM, e.g. 03:00')
        h, _, mi = a.at.strip().partition(':'); L['gio'] = f'{int(h) % 24:02d}:{int(mi or 0):02d}'; ch = True
    if a.days:
        v = a.days.strip().lower()
        d = DAYS if v in ('all', 'moi-ngay') else DAYS[:5] if v in ('weekdays', 'ngay-thuong') else ['t7', 'cn'] if v in ('weekend', 'cuoi-tuan') else [x.strip() for x in v.split(',')]
        bad = [x for x in d if x not in DAYS]
        if bad: X.die(f'invalid day: {bad} — use {",".join(DAYS)}')
        L['ngay'] = [x for x in DAYS if x in d]; ch = True
    if a.per_night is not None: L['video_moi_dem'] = max(0, min(3, a.per_night)); ch = True
    if ch:
        P['lich'] = L; ysave(p, P); log_event(cid, su_kien='doi-lich', ghi_chu=json.dumps(lich(P), ensure_ascii=False))
    S = lich(P); nr = next_run(P)
    X.log(f"{cid}: {S['gio']} · {'every day' if len(S['ngay']) == 7 else ', '.join(S['ngay'])} · {S['video_moi_dem']} videos/run · next {nr:%a %d/%m %H:%M}" if nr else f"{cid}: {S['gio']} · not running (paused or 0 videos)")


def c_mark(a, X):
    cid = a.id; T = topics(cid); t = next((t for t in T if t.get('id') == a.topic), None)
    if not t: X.die(f'topic {a.topic} not found')
    if a.state not in STATES: X.die(f'state must be one of: {", ".join(STATES)}')
    t['trang_thai'] = a.state
    if a.video: t['video'] = a.video
    if a.note: t['ghi_chu'] = a.note
    t['cap_nhat'] = datetime.datetime.now().isoformat(timespec='seconds'); save_topics(cid, T)
    log_event(cid, su_kien=a.state, chu_de=a.topic, ghi_chu=a.note or ''); X.log(f'{a.topic} → {a.state}')


# ---------------------------------------------------------------- YouTube
def _yt(cid, interactive=False, force=False):
    yd = os.path.join(ROOT, '.mega-shot', 'youtube'); cs = os.path.join(yd, 'client_secret.json'); tk = os.path.join(yd, f'token_{cid}.json')
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build
    cred = Credentials.from_authorized_user_file(tk, SCOPES) if os.path.exists(tk) and not force else None   # force: new consent (e.g. after the OAuth app left Testing); old token kept until the new one is saved
    if cred and cred.expired and cred.refresh_token:
        try: cred.refresh(Request()); open(tk, 'w').write(cred.to_json())
        except Exception as e:                                                       # invalid_grant: token expired/revoked (Testing-mode OAuth apps expire refresh tokens after 7 days)
            if not interactive: raise SystemExit(f'YouTube token for channel {cid} expired/revoked ({str(e)[:60]}) — run: xp channel auth {cid}')
            cred = None
    if not cred or not cred.valid:
        if not interactive: raise SystemExit(f'channel {cid} is not authorised for YouTube — run: xp channel auth {cid}')
        if not os.path.exists(cs): raise SystemExit(f'missing {os.path.relpath(cs, ROOT)} — create an OAuth client "Desktop app" in Google Cloud and save the JSON there (references/channels.md)')
        from google_auth_oauthlib.flow import InstalledAppFlow
        cred = InstalledAppFlow.from_client_secrets_file(cs, SCOPES).run_local_server(port=0, prompt='consent', open_browser=True)
        os.makedirs(yd, exist_ok=True); open(tk, 'w').write(cred.to_json())
    return build('youtube', 'v3', credentials=cred, cache_discovery=False)


def c_auth(a, X):
    yt = _yt(a.id, interactive=True, force=bool(getattr(a, 'force', False)))
    me = yt.channels().list(part='snippet', mine=True).execute().get('items', [])
    name = me[0]['snippet']['title'] if me else '?'; cid_yt = me[0]['id'] if me else ''; handle = me[0]['snippet'].get('customUrl', '') if me else ''
    P = profile(a.id); P.setdefault('dang', {}); P['dang']['kenh_youtube'] = name; P['dang']['kenh_youtube_id'] = cid_yt
    if handle: P['dang']['handle'] = handle if handle.startswith('@') else '@' + handle
    ysave(os.path.join(kdir(a.id), 'kenh.yaml'), P); log_event(a.id, su_kien='uy-quyen', kenh_youtube=name)
    X.log(f'✓ YouTube channel "{name}" authorised for {a.id} (token stored in .mega-shot/youtube/, never printed)')


def _package(vd):
    """Title / description / tags from out/youtube_dang_bai.md (written by xp publish)."""
    p = os.path.join(vd, 'out', 'youtube_dang_bai.md')
    if not os.path.exists(p): raise SystemExit(f'missing {p} — run xp export (or xp publish) first')
    s = open(p, encoding='utf-8').read()
    title = re.search(r'^1\. (.+?)\s+\(\d+ (?:chars|ký tự)\)\s*$', s, re.M)
    blocks = re.findall(r'^## ([^\n]+)\n\n```\n(.*?)\n```', s, re.M | re.S)       # heading = one line: a heading without a code block (Title) must not swallow the Description block
    desc = next((b for h, b in blocks if h.startswith(('Description', 'Mô tả'))), '')
    tags = next((b for h, b in blocks if h.startswith(('Tags', 'Thẻ tag'))), '')
    return (title.group(1).strip() if title else os.path.basename(vd)), desc.strip(), [t.strip() for t in tags.split(',') if t.strip()]


def c_upload(a, X):
    from googleapiclient.http import MediaFileUpload
    cid = a.id; P = profile(cid); D = dict(P.get('dang') or {}); vd = os.path.join(ROOT, a.video) if not os.path.isabs(a.video) else a.video
    vids = sorted(f for f in glob.glob(os.path.join(vd, 'out', '*.mp4')) if not f.endswith('_xem_thu.mp4'))
    if not vids: X.die(f'no video file in {vd}/out — run xp export first')
    gp = os.path.join(vd, 'giay_phep.json'); tx = [k for k, v in (json.load(open(gp, encoding='utf-8')) if os.path.exists(gp) else {}).items() if isinstance(v, dict) and v.get('tu_xac_nhan')]
    if tx and os.environ.get('MS_CHO_CLIP_TU_XAC_NHAN') != '1':                 # xp clip --consent: rights confirmed by the owner, not by a licence → never auto-published
        X.die(f"video contains clips used only on the channel owner's confirmation ({', '.join(tx[:4])}) — not auto-posted. The owner posts it, or set MS_CHO_CLIP_TU_XAC_NHAN=1 for this one run.")
    title, desc, tags = _package(vd); tags = (tags + list(D.get('tag_chung') or []))[:30]
    import yaml_keys; spec = yaml_keys.normalize(yload(os.path.join(vd, 'video.yaml'), {}) or {}); lang = str(spec.get('ngon_ngu', 'vi'))
    yt = _yt(cid)
    body = {'snippet': {'title': title[:100], 'description': desc[:5000], 'tags': tags, 'categoryId': str(D.get('danh_muc', 27)),
                        'defaultLanguage': lang, 'defaultAudioLanguage': lang},
            'status': {'privacyStatus': 'private', 'selfDeclaredMadeForKids': False, 'containsSyntheticMedia': True,   # always PRIVATE: the owner reviews, then switches it to Public
                       'license': 'youtube', 'embeddable': True, 'publicStatsViewable': True}}
    T0 = topics(cid); tp = next((t for t in T0 if t.get('id') == a.topic), None) if a.topic else None
    hen = None
    if tp and tp.get('dang_luc') and D.get('tu_dong_cong_khai') and not a.yt_id:   # weekly plan + owner allows scheduled auto-publish
        now = datetime.datetime.now(datetime.timezone.utc); at = _dt(tp['dang_luc'])
        at = at if at and at.tzinfo else (at.replace(tzinfo=datetime.timezone.utc) if at else None)
        if tp.get('loai') == 'long' and (not at or at < now + datetime.timedelta(hours=20)): at = now + datetime.timedelta(hours=24)   # long video: stay private ≥ 1 day
        if at and at > now + datetime.timedelta(minutes=15):
            hen = at.astimezone(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'); body['status']['publishAt'] = hen       # YouTube switches it to Public on time
        elif tp.get('loai') != 'long':
            body['status']['privacyStatus'] = 'public'; hen = 'ngay'                           # Short past its slot → publish now (owner allowed)
    if a.yt_id:                                                                      # update an ALREADY uploaded video: title/description/tags/status, thumbnail, playlist (no re-upload)
        old = yt.videos().list(part='status', id=a.yt_id).execute().get('items', [])
        if not old: X.die(f'video {a.yt_id} not found on this channel')
        body['status']['privacyStatus'] = old[0]['status']['privacyStatus']          # keep the current privacy (never switches to Public by itself)
        yt.videos().update(part='snippet,status', body={'id': a.yt_id, **body}).execute()
        vid = a.yt_id; url = f'https://youtu.be/{vid}'; X.log(f'✓ updated metadata of {url} ({body["status"]["privacyStatus"]})')
    else:
        X.log(f'uploading PRIVATE: {os.path.basename(vids[0])} ({os.path.getsize(vids[0]) / 1048576:.0f} MB) → "{title}"')
        def _send(b):
            req = yt.videos().insert(part='snippet,status', body=b, notifySubscribers=b['status'].get('privacyStatus') == 'public' or bool(b['status'].get('publishAt')),
                                     media_body=MediaFileUpload(vids[0], chunksize=16 * 1024 * 1024, resumable=True, mimetype='video/mp4'))
            r, last = None, -1
            while r is None:
                st, r = req.next_chunk()
                if st and int(st.progress() * 10) != last: last = int(st.progress() * 10); X.log(f'  {st.progress():.0%}')
            return r
        try: resp = _send(body)
        except Exception as e:
            if 'quotaExceeded' in str(e) or 'uploadLimitExceeded' in str(e):              # daily quota exhausted: keep the video, retry after the reset
                if tp:
                    T1 = topics(cid)
                    for t in T1:
                        if t.get('id') == tp['id']: t['thu_lai_tu'] = _quota_reset().isoformat(timespec='minutes')
                    save_topics(cid, T1)
                log_event(cid, su_kien='het-han-muc', chu_de=a.topic or '', video=a.video)
                X.log(f'⚠ YouTube upload quota exhausted today — keeping the video, will retry from {_quota_reset():%H:%M %d/%m} (local time)'); raise SystemExit(3)                                                       # YouTube rejected the schedule / public → upload PRIVATE anyway, no video lost
            if not (body['status'].get('publishAt') or body['status'].get('privacyStatus') == 'public'): raise
            X.log(f'⚠ YouTube rejected scheduling/public ({str(e)[:140]}) — uploading PRIVATE, the owner switches to Public manually')
            body['status'].pop('publishAt', None); body['status']['privacyStatus'] = 'private'; hen = None; resp = _send(body)
        vid = resp['id']; url = f'https://youtu.be/{vid}'
        st = (yt.videos().list(part='status', id=vid).execute().get('items') or [{}])[0].get('status', {})
        X.log(f"✓ {url} ({st.get('privacyStatus', '?')}" + (f", auto-public at {st.get('publishAt')} UTC" if st.get('publishAt') else '') + ')')
        if hen and hen != 'ngay' and not st.get('publishAt'): X.log('⚠ YouTube did not accept the publish time (publishAt) — video stays PRIVATE; the owner must switch it to Public manually')
    thumbs = sorted(f for f in glob.glob(os.path.join(vd, 'out', 'anh_bia_*.jpg')) if 'xem_truoc' not in f)
    if thumbs:
        try: yt.thumbnails().set(videoId=vid, media_body=MediaFileUpload(thumbs[0], mimetype='image/jpeg')).execute(); X.log(f'  thumbnail: {os.path.basename(thumbs[0])}')
        except Exception as e: X.log(f'  ⚠ could not set the thumbnail ({str(e)[:120]}) — the channel needs phone verification for custom thumbnails')
    if D.get('phu_de', True) and not a.yt_id and not (tp and tp.get('loai') == 'short'):   # Short: skip caption upload (400 units each) to stay within the 6 videos/day quota; YouTube auto-generates captions
        for srt in sorted(glob.glob(os.path.join(vd, 'out', 'subtitles', '*.srt'))):
            L = srt.rsplit('.', 2)[-2]
            try:
                yt.captions().insert(part='snippet', body={'snippet': {'videoId': vid, 'language': L, 'name': {'vi': 'Tiếng Việt', 'en': 'English'}.get(L, L), 'isDraft': False}},
                                     media_body=MediaFileUpload(srt, mimetype='application/octet-stream')).execute(); X.log(f'  captions {L}')
            except Exception as e: X.log(f'  ⚠ captions {L}: {str(e)[:120]}')
    if a.topic:
        T = topics(cid)
        for t in T:
            if t.get('id') == a.topic: t.update(trang_thai='da-dang', youtube={'id': vid, 'url': url}, cap_nhat=datetime.datetime.now().isoformat(timespec='seconds'))
        save_topics(cid, T)
    pl = None if a.yt_id else _playlist_for(D, title, desc)                           # dang.danh_sach_phat: "Name" | { "Name": [keywords…] } · update: no duplicate adds
    if not thumbs: X.log('  ⚠ no thumbnail yet (out/anh_bia_*.jpg) — create it with xp thumbnail, then re-run with --youtube-id ' + vid)
    if pl:
        try:
            pid = next((x['id'] for x in yt.playlists().list(part='snippet', mine=True, maxResults=50).execute().get('items', []) if x['snippet']['title'] == pl), None)
            if not pid: pid = yt.playlists().insert(part='snippet,status', body={'snippet': {'title': pl, 'defaultLanguage': lang}, 'status': {'privacyStatus': 'public'}}).execute()['id']
            yt.playlistItems().insert(part='snippet', body={'snippet': {'playlistId': pid, 'resourceId': {'kind': 'youtube#video', 'videoId': vid}}}).execute(); X.log(f'  playlist: {pl}')
        except Exception as e: X.log(f'  ⚠ playlist: {str(e)[:120]}')
    log_event(cid, su_kien='da-dang', chu_de=a.topic or '', video=a.video, youtube=url, tieu_de=title, hen_dang=hen or '')
    if D.get('xoa_sau_dang') and not a.yt_id: _clean_after_upload(cid, vd, vid, X)
    try:                                                                          # free disk once posted everywhere (tools/don.py; other channels + TikTok/FB)
        if os.environ.get('MS_KHONG_DON') != '1':
            import don; don.chay(ROOT, xoa=True, log=X.log, im_lang=True)
    except Exception as e: X.log(f'(auto-clean) skipped: {e}')


def _clean_after_upload(cid, vd, vid, X):
    """dang.xoa_sau_dang: true — after a successful upload, keep the light text files in kenh/<id>/da_dang/<folder>/ and delete videos/<folder> to free disk."""
    import shutil
    vd = os.path.abspath(vd); base = os.path.abspath(os.path.join(ROOT, 'videos'))
    if os.path.dirname(vd) != base: X.log(f'  ⚠ not deleting {vd}: only folders directly inside videos/ are deleted'); return
    keep = os.path.join(ROOT, 'kenh', cid, 'da_dang', os.path.basename(vd)); os.makedirs(keep, exist_ok=True)
    for pat in ('video.yaml', 'nghien_cuu.md', 'giay_phep.json', 'GHI_CONG.md', 'out/*.md', 'out/*.txt', 'out/subtitles/*'):
        for f in glob.glob(os.path.join(vd, pat)):
            if os.path.isfile(f): shutil.copy2(f, keep)
    with open(os.path.join(keep, 'youtube.txt'), 'w', encoding='utf-8') as fh: fh.write(f'https://youtu.be/{vid}\n')
    mb = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(vd) for f in fs) / 1048576
    bad = []
    shutil.rmtree(vd, onerror=lambda fn, p, e: bad.append(p))
    if bad: X.log(f'  ⚠ {vd} not fully deleted ({len(bad)} files locked) — delete manually later')
    else: X.log(f'  🗑 deleted {os.path.relpath(vd, ROOT)} (~{mb:.0f} MB); kept the text files in {os.path.relpath(keep, ROOT)}')
    log_event(cid, su_kien='xoa-sau-dang', video=os.path.relpath(vd, ROOT), mb=round(mb), giu=os.path.relpath(keep, ROOT))


def _market(cid, t, P, X, root):
    """YouTube market data for one topic (viral.search): median views, median views÷subscribers, market score 0–10."""
    import math, statistics, viral
    key = viral._keys(root).get('YOUTUBE_API_KEY')
    if not key: raise SystemExit('missing YOUTUBE_API_KEY in .mega-shot/keys.env (used for the market score)')
    D = dict(P.get('dinh_dang') or {}); lang = str(D.get('ngon_ngu', 'vi')); fmt = 'short' if str(D.get('khung')) == '9x16' else 'long'
    q = re.sub(r'[^\w\s\'-]', ' ', str(t.get('tieu_de', ''))).strip()
    region = 'GB' if lang == 'en' else 'VN'
    rows, units = viral.search(key, [q], fmt, lang, region, 730, 15, lambda m: None)
    if len(rows) < 5:                                                            # title too narrow → search again with the core keywords
        stop = {'why', 'how', 'what', 'the', 'a', 'an', 'of', 'for', 'and', 'to', 'in', 'on', 'off', 'is', 'are', 'can', 'that', 'it', 'its', 'you', 'go', 'one', 'ever', 'year', 'started',
                'và', 'của', 'là', 'có', 'những', 'một', 'các', 'được', 'cho', 'với', 'khi', 'thì', 'ai', 'gì', 'sao', 'ra'}
        core = [w for w in re.findall(r"[\w']+", q.lower()) if w not in stop and not w.isdigit()][:4]
        if core and ' '.join(core) != q.lower():
            r2, u2 = viral.search(key, [' '.join(core)], fmt, lang, region, 730, 15, lambda m: None); units += u2
            if len(r2) > len(rows): rows, q = r2, ' '.join(core)
    if not rows: return {'so_video': 0, 'diem': 0.0, 'don_vi_api': units, 'truy_van': q}
    mv = statistics.median(r['views'] for r in rows); mr = statistics.median(r['ratio'] for r in rows)
    diem = 10 * min(1, max(0, .6 * math.log10(max(mr, 1)) / 2 + .4 * (math.log10(max(mv, 1)) - 4) / 2.5))   # 100× & 3M view → 10
    return {'so_video': len(rows), 'truy_van': q, 'trung_vi_view': int(mv), 'trung_vi_ty_le': round(mr, 1), 'diem': round(diem, 1),
            'top': [{'tieu_de': r['title'][:90], 'view': r['views'], 'ty_le': round(r['ratio'], 1), 'url': r['url']} for r in rows[:3]],
            'ngay': f"{datetime.date.today()}", 'don_vi_api': units}


def _du_kien(t):
    tt = t.get('thi_truong') or {}; m, ai = tt.get('diem'), t.get('diem_ai')
    if tt and int(tt.get('so_video', 0)) < 5: m = None                                   # little search data ≠ a market score of 0 → use the AI score only
    if m is None and ai is None: return None
    return round(.6 * float(m or 0) + .4 * float(ai if ai is not None else m), 1) if m is not None else round(float(ai), 1)


def c_score(a, X):
    """xp channel score <id> [--force]: market data for proposed/approved topics (≈100–200 YouTube API units per topic)."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    cid = a.id; P = profile(cid); T = topics(cid); n = 0; het = False
    for t in T:
        if t.get('trang_thai') not in ('de-xuat', 'duyet') or (t.get('thi_truong') and not a.force): continue
        try: t['thi_truong'] = _market(cid, t, P, X, ROOT)
        except RuntimeError as e:
            if '403' in str(e) or '429' in str(e) or 'uota' in str(e):              # daily YouTube search quota exhausted → keep what was scored, stop gracefully
                X.log(f'⚠ YouTube API quota exhausted today — scored {n} topics; re-run after the quota resets'); het = True; break
            raise
        t['du_kien'] = _du_kien(t); n += 1
        m = t['thi_truong']; X.log(f"{t['tieu_de'][:60]:<60} · median {m.get('trung_vi_view', 0):,} views · {m.get('trung_vi_ty_le', 0)}× · market {m['diem']}/10")
        save_topics(cid, T)
    if not het: X.log(f'✓ {n} topics market-scored' if n else 'no new topics to score (--force to re-score)')


def c_rate(a, X):
    """xp channel rate <id> <index> --vi "VI title" [--goc-vi "…"] --ai 7.5 --why "short reason" — a Vietnamese translation to read + the AI score."""
    cid = a.id; T = topics(cid)
    try: i = int(a.rest[0]) - 1
    except (IndexError, ValueError): raise SystemExit('xp channel rate <id> <index in xp channel topics> --vi … --ai … --why …')
    if not 0 <= i < len(T): raise SystemExit('invalid index')
    t = T[i]
    if a.vi: t['tieu_de_vi'] = a.vi
    if a.goc_vi: t['goc_vi'] = a.goc_vi
    if a.ai is not None: t['diem_ai'] = round(max(0, min(10, float(a.ai))), 1)
    if a.why: t['ly_do_ai'] = a.why
    t['du_kien'] = _du_kien(t); save_topics(cid, T); X.log(f"{i + 1}. {t.get('tieu_de')} · AI {t.get('diem_ai')} · expected {t.get('du_kien')}")


def _playlist_for(D, title, desc):
    """Playlist name: a string, or a map {name: [keywords]} → first name whose keywords appear in the title/description."""
    P = D.get('danh_sach_phat')
    if not P: return None
    if isinstance(P, str): return P
    txt = (title + ' ' + desc).lower(); first = None
    for name, kws in dict(P).items():
        first = first or name
        if any(str(k).lower() in txt for k in (kws or [])): return name
    return first


def c_brief(a, X):
    """Instruction block the AI task reads before making a video — lists EVERY channel setting (Studio form → kenh.yaml). Settings here take priority over the reference video."""
    P = json.loads(json.dumps(profile(a.id), default=str)); g = lambda k: P.get(k) or {}
    D, PC, G, N, S, ND, AB, DG = g('dinh_dang'), g('phong_cach'), g('giong'), g('nhac'), g('sfx'), g('noi_dung'), g('anh_bia'), g('dang')
    j = lambda v: json.dumps(v, ensure_ascii=False)
    L = [f"CHANNEL: {P.get('ten')} ({a.id}) · {'ENABLED' if P.get('bat', True) else 'PAUSED'}",
         f"DESCRIPTION / NICHE: {P.get('mo_ta', '')}",
         '— FORMAT —',
         f"frame {D.get('khung')} · template {D.get('mau')} · language {D.get('ngon_ngu')} · length {D.get('do_dai_giay')} s · suggested scenes {D.get('so_canh') or 'auto'}",
         f"REFERENCE VIDEO (imitate the structure of video.yaml/film.html; the settings below TAKE PRIORITY over it): {P.get('video_mau') or '(none)'}",
         '— VISUALS —',
         f"visual style: {PC.get('kieu') or 'per template'} · overlays: {PC.get('lop_phu') or []} · accent colour: {PC.get('accent') or 'default'}",
         f"subtitles: {PC.get('subtitle_style') or 'highlight'} · titles: {PC.get('title_style') or 'word-rise'} · huashu: {PC.get('huashu') or '—'} · asset priority: {PC.get('uu_tien') or 'balance video/images'}",
         f"extra sources allowed (standing permission for this channel): {P.get('nguon_them') or []} — otherwise only sources in .mega-shot/chinh_sach.json",
         '— AUDIO —',
         f"voice: {G.get('mau')} · speed {G.get('toc_do', 1.0)} · volume {G.get('am_luong', .55)}",
         f"music: {N.get('file') or 'NO background music (drop the nhac key from video.yaml entirely, even if the reference video has music)'} · volume {N.get('am_luong', .6)} · auto-duck under speech {N.get('tu_ha', True)}" + (' · 16:9 → xp mix drops the music unless nhac.giu: true' if D.get('khung') == '16x9' else ''),
         f"effects: level {S.get('muc', 1.0)} · ambience {S.get('am_nen', 'khong')} (level {S.get('nen_muc', .1)}) · automatic whoosh/boom/riser {'ON' if S.get('tu_dong', True) is not False else 'OFF — copy sfx.tu_dong: false into video.yaml, use only real sounds via am:'} · sound overrides {j(S.get('thay') or {})} · preferred Kenney packs {S.get('kenney') or []}",
         '— CONTENT —',
         f"tone: {ND.get('giong_van') or '—'}",
         f"opening (0–5 s): {ND.get('mo_dau') or '—'}",
         f"body structure: {ND.get('cau_truc') or '—'}",
         f"ending + call to action: {ND.get('ket') or '—'}",
         f"audience: {ND.get('doi_tuong') or '—'} · information density: {ND.get('mat_do') or 'dense, deep'}",
         f"AVOID: {ND.get('tranh') or '—'}",
         'CHANNEL RULES: ' + ' | '.join(map(str, P.get('quy_tac') or [])),
         '— THUMBNAIL & POSTING —',
         f"thumbnail: {'yes' if AB.get('bat', True) else 'no'} · style {AB.get('kieu') or ['classic']} · notes {AB.get('ghi_chu') or '—'}",
         f"YouTube: always PRIVATE · category {DG.get('danh_muc', 27)} · common tags {DG.get('tag_chung') or []} · hashtags {DG.get('hashtag') or []} · captions {DG.get('phu_de', True)}",
         f"caption template: {DG.get('caption') or '—'}",
         f"schedule: {(P.get('lich') or {}).get('video_moi_dem', 1)} videos/run",
         'FULL CONFIG (JSON): ' + j(P)]
    print('\n'.join(L))

def main(a, X):
    global ROOT; ROOT = X.find_root('.')
    {'list': c_list, 'new': c_new, 'topics': c_topics, 'next': c_next, 'mark': c_mark, 'auth': c_auth, 'upload': c_upload, 'brief': c_brief,
     'score': c_score, 'rate': c_rate, 'due': c_due, 'release': c_release, 'schedule': c_schedule, 'plan': c_plan}[a.action](a, X)
