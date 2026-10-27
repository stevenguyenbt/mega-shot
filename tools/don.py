"""mega-shot · `xp don` — free disk space: once a video is posted EVERYWHERE it was scheduled, keep its small text files and delete its folder.

A folder videos/<name> is removed only when ALL of these hold:
  · it is known to be posted: every job for it in .mega-shot/social/hang_doi.json (TikTok / Facebook) is sent and the server says `completed`,
    and/or a channel topic in kenh/<id>/chu_de.yaml points to it with state `da-dang` and a YouTube id;
  · nothing for it is still pending anywhere: no social job waiting / posting / failed / missed, no topic `dang-lam` / `can-xem` / `loi`;
  · not a long Facebook video that came out as a Reel (`fb_kieu` VIDEO but link /reel/ → may be cut at ~90 s; kept so it can be re-posted);
  · no file was modified in the last hour (someone may still be working on it) and there is no `.giu` marker file (keep forever).
Before deleting, the small files are copied to kenh/<channel>/da_dang/<name>/ (or .mega-shot/luu/<name>/ when no channel is known):
video.yaml, nghien_cuu.md, kiem_chung.md, GHI_CONG.md, giay_phep.json, out/*.md, out/*.txt, out/subtitles/*.srt|txt.
A log line per deleted folder goes to .mega-shot/don_dep.jsonl.

  xp don            show what would be deleted and why the rest is kept (dry run)
  xp don --xoa      archive + delete (also run automatically at the end of `xp social run` and after `xp channel upload`)
"""
import datetime, glob, json, os, re, shutil, sys, time

GIU_FILES = ['video.yaml', 'nghien_cuu.md', 'kiem_chung.md', 'GHI_CONG.md', 'giay_phep.json']
FB_REEL_MAX = 88


def _jload(p, d):
    try: return json.load(open(p, encoding='utf-8'))
    except Exception: return d


def _norm(v): return (v or '').replace('\\', '/').strip('/').split('/')[-1]


def trang_thai(root):
    """{video name: {'posted': [...], 'pending': [...], 'kenh': channel id or None}}"""
    st = {}
    get = lambda n: st.setdefault(n, {'posted': [], 'pending': [], 'kenh': None})
    for j in _jload(os.path.join(root, '.mega-shot', 'social', 'hang_doi.json'), []):
        n = _norm(j.get('video'));
        if not n or j.get('trang_thai') == 'huy': continue
        e = get(n); tag = f"{j.get('dich')}"
        if j.get('trang_thai') in ('da-gui', 'da-hen') and j.get('may_chu') == 'completed':
            if j.get('platform') == 'facebook' and (j.get('giay') or 0) > FB_REEL_MAX and '/reel/' in (j.get('link') or ''):
                e['pending'].append(f'{tag}: {j["giay"]:.0f}s video was posted as a Reel (may be cut) — kept for re-posting')
            else: e['posted'].append(tag)
        else: e['pending'].append(f"{tag}: {j.get('trang_thai')}{'/' + j['may_chu'] if j.get('may_chu') else ''}")
        m = re.match(r'kenh/([^/]+)/', (j.get('kenh') or '')); e['kenh'] = e['kenh'] or (m.group(1) if m else None)
    try:
        import yaml
        for p in glob.glob(os.path.join(root, 'kenh', '*', 'chu_de.yaml')):
            cid = os.path.basename(os.path.dirname(p))
            T = yaml.safe_load(open(p, encoding='utf-8')) or []
            T = T if isinstance(T, list) else (T.get('chu_de') or [])
            for t in T:
                n = _norm(t.get('video'))
                if not n: continue
                e = get(n); e['kenh'] = e['kenh'] or cid
                if t.get('trang_thai') == 'da-dang' and (t.get('youtube') or {}).get('id'):
                    hen = str(t.get('dang_luc') or t.get('hen_dang') or '')                   # scheduled to go public later: keep until then (may still be edited)
                    try: tuong_lai = hen and datetime.datetime.fromisoformat(hen.replace('Z', '+00:00')).timestamp() > time.time()
                    except ValueError: tuong_lai = False
                    if tuong_lai: e['pending'].append(f'youtube:{cid}: scheduled to go public {hen} — kept until then')
                    else: e['posted'].append(f'youtube:{cid}')
                elif t.get('trang_thai') in ('dang-lam', 'can-xem', 'loi'): e['pending'].append(f"{cid}: topic {t.get('id')} is {t.get('trang_thai')}")
    except Exception as ex: print(f'[xp] (don) cannot read chu_de.yaml: {ex}')
    return st


def _moi_sua(d, giay=3600):
    t = time.time()
    for r, _, fs in os.walk(d):
        for f in fs:
            try:
                if t - os.path.getmtime(os.path.join(r, f)) < giay: return True
            except OSError: pass
    return False


def _kenh_tu_ten(root, n):
    for d in glob.glob(os.path.join(root, 'kenh', '*')):
        cid = os.path.basename(d)
        if n.startswith(cid + '-'): return cid
    return None


def luu(root, n, kenh):
    src = os.path.join(root, 'videos', n)
    dst = os.path.join(root, 'kenh', kenh, 'da_dang', n) if kenh and os.path.isdir(os.path.join(root, 'kenh', kenh)) else os.path.join(root, '.mega-shot', 'luu', n)
    os.makedirs(dst, exist_ok=True); copied = 0
    for f in GIU_FILES:
        if os.path.exists(os.path.join(src, f)): shutil.copy2(os.path.join(src, f), dst); copied += 1
    for f in glob.glob(os.path.join(src, 'out', '*.md')) + glob.glob(os.path.join(src, 'out', '*.txt')):
        shutil.copy2(f, dst); copied += 1
    for f in glob.glob(os.path.join(src, 'out', 'subtitles', '*.srt')) + glob.glob(os.path.join(src, 'out', 'subtitles', '*.txt')):
        os.makedirs(os.path.join(dst, 'subtitles'), exist_ok=True); shutil.copy2(f, os.path.join(dst, 'subtitles')); copied += 1
    return dst, copied


def _xoa(d):
    for k in range(3):
        try: shutil.rmtree(d); return True
        except Exception:
            time.sleep(2)
    # a process may still hold the folder open: empty what we can, then try the folder itself
    shutil.rmtree(d, ignore_errors=True)
    try: os.rmdir(d)
    except OSError: pass
    return not os.path.exists(d)


def chay(root, xoa=False, log=print, im_lang=False):
    st = trang_thai(root); vdir = os.path.join(root, 'videos'); freed = 0; done = []
    for n, e in sorted(st.items()):
        d = os.path.join(vdir, n)
        if not os.path.isdir(d) or not e['posted']: continue
        why = list(e['pending'])
        if os.path.exists(os.path.join(d, '.giu')): why.append('has a .giu file (keep)')
        if not why and _moi_sua(d): why.append('modified within the last hour')
        if why:
            if not im_lang: log(f"keep   {n}: " + '; '.join(why))
            continue
        size = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(d) for f in fs) / 1e6
        if not xoa: log(f"would delete {n} · {size:.0f} MB · posted: {', '.join(sorted(set(e['posted'])))}"); continue
        kenh = e['kenh'] or _kenh_tu_ten(root, n)
        dst, k = luu(root, n, kenh)
        ok = _xoa(d)
        if ok: freed += size; done.append(n)
        log(f"{'deleted' if ok else '⚠ could not delete (folder is open elsewhere)'} {n} · {size:.0f} MB · saved {k} files to {os.path.relpath(dst, root)}")
        if ok:
          with open(os.path.join(root, '.mega-shot', 'don_dep.jsonl'), 'a', encoding='utf-8') as f:
              f.write(json.dumps({'t': datetime.datetime.now().isoformat(timespec='seconds'), 'video': n, 'mb': round(size), 'xoa': ok,
                                'da_dang': sorted(set(e['posted'])), 'luu': os.path.relpath(dst, root).replace('\\', '/')}, ensure_ascii=False) + '\n')
    if xoa and done: log(f"✓ cleaned {len(done)} folders · freed ~{freed / 1024:.1f} GB")
    return done


def main(a, X):
    chay(X.find_root('.'), xoa=a.xoa, log=X.log)


if __name__ == '__main__':
    root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else '.')
    chay(root, xoa='--xoa' in sys.argv)
