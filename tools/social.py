"""mega-shot · `xp social` — optional, pluggable posting to social platforms (TikTok, Facebook, Instagram, …).

mega-shot ships NO posting backend. You connect your own through an *adapter*:

  folder   copy the video + caption into an outbox folder (e.g. a folder your scheduler / uploader watches) — no network
  webhook  HTTP POST (multipart: video file + JSON metadata) to an endpoint YOU control (n8n, Zapier, Make, your own server…)
  <name>   your own Python module: tools/social_adapters/<name>.py with `post(job, target, log) -> dict` (see tools/social_adapters/example_adapter.py)

Targets live in .mega-shot/social/targets.json (never committed). Secrets are NOT stored there: a webhook target names an
environment variable (`token_env`) whose value is sent as `Authorization: Bearer …`; put it in .env / .mega-shot/keys.env.

  xp social target add <alias> --adapter folder  --path D:/outbox [--platform tiktok]
  xp social target add <alias> --adapter webhook --url https://example.com/hook [--token-env MY_HOOK_TOKEN] [--platform facebook]
  xp social target add <alias> --adapter mymodule [--platform instagram]
  xp social target list | remove <alias>
  xp social post <videos/x> --to a,b [--at "2026-10-20 19:30"] [--caption "…"] [--title "…"]   queue (default: now)
  xp social run                      send every job whose time has come (run it from cron / Task Scheduler every few minutes)
  xp social list [--all] | cancel <job> | retry <job>

Caption: out/caption_<platform>.txt (first line = title) if present, else the "Caption" block of out/dang_bai_mxh.md
(written by `xp publish`). Videos containing consent-only clips (`tu_xac_nhan` in giay_phep.json) are refused.
Posts made through an adapter are usually PUBLIC — confirm with the account owner before the first post to a new account.
Queue: .mega-shot/social/hang_doi.json (states: cho = waiting, da-gui = sent, loi = failed, huy = cancelled, qua-gio = missed).
"""
import datetime, glob, importlib, json, os, re, shutil, subprocess, sys, time, uuid

MAX_MB = 280                                                                     # larger exports get an `_mxh.mp4` copy (~12 Mbps)
HERE = os.path.dirname(os.path.abspath(__file__))


def sdir(root): d = os.path.join(root, '.mega-shot', 'social'); os.makedirs(d, exist_ok=True); return d
def jload(p, d):
    try: return json.load(open(p, encoding='utf-8'))
    except Exception: return d
def jsave(p, data): json.dump(data, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
def now(): return datetime.datetime.now().astimezone()


# ---------- video folder → file + caption ----------
def video_file(vd, log):
    outs = sorted(f for f in glob.glob(os.path.join(vd, 'out', '*.mp4')) if not f.endswith(('_xem_thu.mp4', '_mxh.mp4')))
    vert = [f for f in outs if '9x16' in os.path.basename(f)] or outs
    if not vert: raise SystemExit(f'no video file in {vd}/out — run xp export first')
    src = vert[0]
    if os.path.getsize(src) <= MAX_MB * 1e6: return src
    dst = src[:-4].replace('_9x16', '') + '_mxh.mp4'
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src): return dst
    log(f'file is {os.path.getsize(src) / 1e6:.0f} MB > {MAX_MB} MB → making a social copy {os.path.basename(dst)} (~12 Mbps)')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-maxrate', '12M', '-bufsize', '24M',
                    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', dst], check=True)
    return dst


def caption_of(vd, platform=None):
    if platform:
        cp = os.path.join(vd, 'out', f'caption_{platform}.txt')
        if os.path.exists(cp):
            t = open(cp, encoding='utf-8').read().strip(); return t, t.split('\n')[0][:150]
    p = os.path.join(vd, 'out', 'dang_bai_mxh.md')
    if not os.path.exists(p): raise SystemExit(f'missing {p} — run xp publish first (or pass --caption)')
    s = open(p, encoding='utf-8').read()
    blocks = re.findall(r'^## ([^\n]+)\n\n```\n(.*?)\n```', s, re.M | re.S)
    cap = next((b for h, b in blocks if h.lower().startswith('caption')), '').strip()
    title = next((b for h, b in blocks if 'shorts' in h.lower() or 'title' in h.lower() or 'tiêu đề' in h.lower()), '').strip()
    title = re.sub(r'\s*#shorts\b', '', title, flags=re.I).strip() or cap.split('\n')[0][:90]
    return cap, title


def consent_clips(vd):
    G = jload(os.path.join(vd, 'giay_phep.json'), {})
    return [k for k, v in G.items() if isinstance(v, dict) and v.get('tu_xac_nhan')] if isinstance(G, dict) else []


def duration(f):
    try: return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], capture_output=True, text=True).stdout.strip())
    except Exception: return 0.0


def parse_at(s):
    if not s: return now()
    s = s.strip().replace('T', ' ')
    for fmt in ('%Y-%m-%d %H:%M', '%Y-%m-%d %H:%M:%S', '%H:%M'):
        try:
            d = datetime.datetime.strptime(s, fmt)
            if fmt == '%H:%M':
                n = now(); d = n.replace(hour=d.hour, minute=d.minute, second=0, microsecond=0)
                return d if d > n else d + datetime.timedelta(days=1)
            return d.astimezone()
        except ValueError: pass
    try: return datetime.datetime.fromisoformat(s).astimezone()
    except ValueError: raise SystemExit(f'cannot parse time "{s}" — use "2026-10-20 19:30" (local time) or "19:30"')


# ---------- adapters ----------
def _adapter_folder(job, t, log):
    out = os.path.join(os.path.expanduser(t['path']), time.strftime('%Y%m%d-%H%M') + '_' + re.sub(r'[^\w.-]+', '-', os.path.basename(job['video'])))
    os.makedirs(out, exist_ok=True); shutil.copy(job['file'], out)
    open(os.path.join(out, 'caption.txt'), 'w', encoding='utf-8').write(job['caption'] + '\n')
    jsave(os.path.join(out, 'post.json'), {k: job[k] for k in ('title', 'caption', 'platform', 'luc', 'dich')})
    return {'state': 'completed', 'link': out}


def _adapter_webhook(job, t, log):
    import urllib.request
    tok = os.environ.get(t['token_env']) if t.get('token_env') else None
    if t.get('token_env') and not tok:
        sys.path.insert(0, HERE); import keys; tok = keys.load(job['root']).get(t['token_env'])
        if not tok: raise RuntimeError(f"environment variable {t['token_env']} is not set (.env or .mega-shot/keys.env)")
    b = uuid.uuid4().hex; meta = json.dumps({k: job[k] for k in ('title', 'caption', 'platform', 'luc', 'dich', 'giay')}, ensure_ascii=False).encode()
    body = (f'--{b}\r\nContent-Disposition: form-data; name="meta"\r\nContent-Type: application/json\r\n\r\n'.encode() + meta +
            f'\r\n--{b}\r\nContent-Disposition: form-data; name="video"; filename="{os.path.basename(job["file"])}"\r\nContent-Type: video/mp4\r\n\r\n'.encode() +
            open(job['file'], 'rb').read() + f'\r\n--{b}--\r\n'.encode())
    h = {'Content-Type': f'multipart/form-data; boundary={b}', 'User-Agent': 'mega-shot'}
    if tok: h['Authorization'] = f'Bearer {tok}'
    with urllib.request.urlopen(urllib.request.Request(t['url'], data=body, headers=h, method='POST'), timeout=600) as r:
        txt = r.read().decode('utf-8', 'replace')
    try: res = json.loads(txt)
    except ValueError: res = {}
    return {'state': res.get('state', 'completed'), 'link': res.get('link') or res.get('url')}


def adapter(name):
    if name == 'folder': return _adapter_folder
    if name == 'webhook': return _adapter_webhook
    sys.path.insert(0, os.path.join(HERE, 'social_adapters'))
    try: return importlib.import_module(name).post
    except ImportError as e: raise SystemExit(f'adapter "{name}" not found: create tools/social_adapters/{name}.py with post(job, target, log) ({e})')


# ---------- commands ----------
def c_target(a, X, root):
    p = os.path.join(sdir(root), 'targets.json'); T = jload(p, {})
    act = (a.rest or ['list'])[0]
    if act == 'list':
        if not T: X.log('no targets yet — xp social target add <alias> --adapter folder|webhook|<module> …')
        for k, v in T.items(): X.log(f"  {k:<16} {v.get('adapter'):<8} {v.get('platform') or '-':<10} {v.get('path') or v.get('url') or ''}")
        return
    if len(a.rest) < 2: X.die(f'xp social target {act} <alias>')
    alias = a.rest[1]
    if act == 'remove': T.pop(alias, None); jsave(p, T); X.log(f'removed {alias}'); return
    if act != 'add': X.die('target: add | list | remove')
    ad = a.adapter or X.die('--adapter folder|webhook|<module> is required')
    t = {'adapter': ad, 'platform': a.platform or ''}
    if ad == 'folder': t['path'] = a.path or X.die('--path <outbox folder> is required for the folder adapter')
    if ad == 'webhook':
        t['url'] = a.url or X.die('--url is required for the webhook adapter')
        if not t['url'].startswith('https://') and not re.match(r'https?://(127\.0\.0\.1|localhost)[:/]', t['url']): X.die('webhook URL must be https:// (or a localhost address)')
        if a.token_env: t['token_env'] = a.token_env
    T[alias] = t; jsave(p, T); X.log(f'✓ target {alias} → {ad}')


def c_post(a, X, root):
    vd = os.path.abspath(a.rest[0] if a.rest else '.')
    T = jload(os.path.join(sdir(root), 'targets.json'), {})
    to = [x.strip() for x in (a.to or '').split(',') if x.strip()] or X.die('--to <alias,…> is required (xp social target list)')
    for x in to:
        if x not in T: X.die(f'unknown target {x} — xp social target add {x} …')
    cc = consent_clips(vd)
    if cc and os.environ.get('MS_CHO_CLIP_TU_XAC_NHAN') != '1': X.die(f'video uses consent-only clips {cc} — refusing to post automatically')
    f = video_file(vd, X.log); at = parse_at(a.at); Q = jload(os.path.join(sdir(root), 'hang_doi.json'), [])
    for x in to:
        pf = T[x].get('platform') or None
        cap, title = (a.caption, a.title or a.caption.split('\n')[0][:90]) if a.caption else caption_of(vd, pf)
        j = {'id': uuid.uuid4().hex[:8], 'video': os.path.relpath(vd, root).replace(os.sep, '/'), 'file': f, 'dich': x, 'platform': pf,
             'title': title[:150], 'caption': cap, 'luc': at.isoformat(timespec='minutes'), 'giay': duration(f), 'trang_thai': 'cho', 'tao': now().isoformat(timespec='seconds')}
        Q.append(j); X.log(f"queued {j['id']} · {x} · {j['luc']} · {os.path.basename(f)}")
    jsave(os.path.join(sdir(root), 'hang_doi.json'), Q)


def c_run(a, X, root):
    qp = os.path.join(sdir(root), 'hang_doi.json'); Q = jload(qp, []); T = jload(os.path.join(sdir(root), 'targets.json'), {})
    n = now(); late = datetime.timedelta(hours=a.late)
    for j in Q:
        if j.get('trang_thai') != 'cho': continue
        at = datetime.datetime.fromisoformat(j['luc'])
        if at > n: continue
        if n - at > late: j['trang_thai'] = 'qua-gio'; X.log(f"{j['id']} missed its slot by more than {a.late:g} h — not posted (xp social retry {j['id']})"); continue
        t = T.get(j['dich'])
        if not t: j['trang_thai'] = 'loi'; j['loi'] = 'target removed'; continue
        X.log(f"posting {j['id']} → {j['dich']} ({t['adapter']})")
        try:
            r = adapter(t['adapter'])({**j, 'root': root}, t, X.log) or {}
            j.update(trang_thai='da-gui', may_chu=r.get('state', 'completed'), link=r.get('link'), gui=now().isoformat(timespec='seconds'))
            X.log(f"  ✓ {j.get('link') or 'sent'}")
        except Exception as e:
            j.update(trang_thai='loi', loi=str(e)[:300]); X.log(f'  ✗ {e}')
        jsave(qp, Q)
    jsave(qp, Q)
    if os.environ.get('MS_KHONG_DON') != '1' and os.environ.get('MS_AUTO_CLEAN') == '1':
        sys.path.insert(0, HERE); import don; don.chay(root, xoa=True, log=X.log, im_lang=True)


def c_list(a, X, root):
    for j in jload(os.path.join(sdir(root), 'hang_doi.json'), []):
        if a.all or j.get('trang_thai') in ('cho', 'loi', 'qua-gio'):
            X.log(f"{j['id']}  {j['trang_thai']:<8} {j['luc']}  {j['dich']:<14} {j['video']}  {j.get('link') or j.get('loi') or ''}")


def c_cancel(a, X, root, retry=False):
    qp = os.path.join(sdir(root), 'hang_doi.json'); Q = jload(qp, [])
    jid = (a.rest or [None])[0] or X.die('job id required (xp social list)')
    j = next((x for x in Q if x['id'] == jid), None) or X.die(f'no job {jid}')
    if retry: j.update(trang_thai='cho', luc=now().isoformat(timespec='minutes')); j.pop('loi', None)
    else: j['trang_thai'] = 'huy'
    jsave(qp, Q); X.log(f"{jid} → {j['trang_thai']}")


def main(a, X):
    root = X.find_root('.')
    {'target': c_target, 'post': c_post, 'run': c_run, 'list': c_list,
     'cancel': c_cancel, 'retry': lambda a, X, r: c_cancel(a, X, r, retry=True)}[a.action](a, X, root)
