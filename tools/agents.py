"""mega-shot · `xp agents` — make the skill available to other AI coding agents, not only Claude Code.

mega-shot follows the open Agent Skills format (SKILL.md + scripts/references), so the same folder works in every agent
that reads it. This command links the skill folder into the place each agent scans and writes a short instruction block
into your project's AGENTS.md / GEMINI.md / CLAUDE.md so agents without skill support still know how to drive `xp`.

  xp agents status                                 where each agent looks, and whether mega-shot is there
  xp agents install [--for all|claude,codex,antigravity,gemini,cursor] [--scope user|project] [--copy] [--force]
  xp agents init [--for …]                         write/refresh the mega-shot block in <project>/AGENTS.md, GEMINI.md, CLAUDE.md
  xp agents uninstall [--for …] [--scope …]        remove only the links/copies this command created

Where each agent discovers skills (folder name must be `mega-shot`, the skill's `name`):
  claude       user ~/.claude/skills/            project <p>/.claude/skills/
  codex        user ~/.agents/skills/            project <p>/.agents/skills/
  antigravity  user ~/.gemini/config/skills/     project <p>/.agents/skills/   (+ legacy ~/.gemini/antigravity/skills/ if present)
  gemini       user ~/.gemini/skills/            project <p>/.agents/skills/
  cursor       user ~/.cursor/skills/            project <p>/.cursor/skills/   (Cursor also reads .claude/skills and .agents/skills)

Links: a symlink on macOS/Linux, a directory junction on Windows (no admin rights needed). `--copy` copies instead
(updates then need `xp agents install --force` again). Nothing is written outside these folders.
"""
import os, platform, re, shutil, subprocess, sys

H = os.path.expanduser('~')
USER = {
    'claude': [os.path.join(H, '.claude', 'skills')],
    'codex': [os.path.join(H, '.agents', 'skills')],
    'antigravity': [os.path.join(H, '.gemini', 'config', 'skills')],
    'gemini': [os.path.join(H, '.gemini', 'skills')],
    'cursor': [os.path.join(H, '.cursor', 'skills')],
}
LEGACY = {'antigravity': [os.path.join(H, '.gemini', 'antigravity', 'skills'), os.path.join(H, '.gemini', 'antigravity-cli', 'skills')]}
PROJECT = {'claude': ['.claude/skills'], 'codex': ['.agents/skills'], 'antigravity': ['.agents/skills'], 'gemini': ['.agents/skills'], 'cursor': ['.cursor/skills']}
NAME = 'mega-shot'
MARK0, MARK1 = '<!-- mega-shot:start -->', '<!-- mega-shot:end -->'


def _agents(spec):
    if not spec or spec == 'all': return list(USER)
    out = [x.strip().lower() for x in spec.split(',') if x.strip()]
    bad = [x for x in out if x not in USER]
    if bad: raise SystemExit(f'unknown agent(s): {", ".join(bad)} — choose from: all, {", ".join(USER)}')
    return out


def _targets(agents, scope, root):
    seen, out = set(), []
    for a in agents:
        dirs = USER[a] + [d for d in LEGACY.get(a, []) if os.path.isdir(d)] if scope == 'user' else [os.path.join(root, d) for d in PROJECT[a]]
        for d in dirs:
            p = os.path.normpath(os.path.join(d, NAME))
            if p not in seen: seen.add(p); out.append((a, p))
    return out


def _same(p, skill):
    try: return os.path.exists(p) and os.path.samefile(p, skill)
    except OSError: return False


def _is_link(p):
    if os.path.islink(p): return True
    if platform.system() == 'Windows' and os.path.isdir(p):
        try: return bool(os.readlink(p))                                        # junctions are readable as links on Python ≥ 3.8
        except (OSError, ValueError): return False
    return False


def _link(src, dst, copy):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    if copy:
        shutil.copytree(src, dst, ignore=shutil.ignore_patterns('.git', '__pycache__', 'dist', 'node_modules', '.mega-shot', 'videos'))
        open(os.path.join(dst, '.mega-shot-copy'), 'w').write(src + '\n'); return 'copied'
    if platform.system() == 'Windows':
        r = subprocess.run(['cmd', '/c', 'mklink', '/J', dst, src], capture_output=True, text=True)
        if r.returncode: raise OSError(r.stderr.strip() or r.stdout.strip())
        return 'junction'
    os.symlink(src, dst, target_is_directory=True); return 'symlink'


def c_status(a, X, skill, root):
    X.log(f'skill folder: {skill}')
    for scope in ('user', 'project'):
        for ag, p in _targets(list(USER), scope, root):
            st = 'this skill' if _same(p, skill) else ('other copy' if os.path.exists(os.path.join(p, 'SKILL.md')) else '—')
            X.log(f'  {scope:<7} {ag:<12} {st:<11} {p}')


def c_install(a, X, skill, root):
    for ag, p in _targets(_agents(a.agents_for), a.scope, root):
        if _same(p, skill): X.log(f'✓ {ag:<12} already here: {p}'); continue
        if os.path.exists(p) or os.path.islink(p):
            if not a.force: X.log(f'· {ag:<12} {p} exists (another mega-shot?) — keep it, or re-run with --force'); continue
            _remove(p, X)
        try: how = _link(skill, p, a.copy); X.log(f'✓ {ag:<12} {how}: {p}')
        except OSError as e: X.log(f'✗ {ag:<12} could not link {p} ({e}) — try --copy')
    X.log('next: restart the agent (or reload skills: Codex /skills, Gemini CLI /skills reload) and ask it for a video')
    if a.scope == 'project': c_init(a, X, skill, root)


def _remove(p, X):
    if _is_link(p) or os.path.islink(p):
        (os.rmdir if platform.system() == 'Windows' and not os.path.islink(p) else os.unlink)(p)
    elif os.path.exists(os.path.join(p, '.mega-shot-copy')): shutil.rmtree(p)
    else: X.die(f'{p} is a real folder not created by `xp agents` — remove it yourself if you are sure')


def c_uninstall(a, X, skill, root):
    for ag, p in _targets(_agents(a.agents_for), a.scope, root):
        if not (os.path.exists(p) or os.path.islink(p)): continue
        if os.path.realpath(p) == os.path.realpath(skill) and not (_is_link(p) or os.path.islink(p)): X.log(f'· {ag:<12} {p} is the skill itself — left alone'); continue
        _remove(p, X); X.log(f'✓ removed {p}')


def _block(skill):
    xp = os.path.join(skill, 'xp.cmd' if platform.system() == 'Windows' else 'xp')
    return f"""{MARK0}
## Video production with mega-shot

This project uses the **mega-shot** video skill (Agent Skills format). Full instructions: `{os.path.join(skill, 'SKILL.md')}` — read it
before working on any video request. The CLI is `{xp}` (run it from this project folder; `--help` lists commands).

1. Run `xp setup` first and ask the user about every item under **NEEDS YOUR INPUT** before installing or downloading anything.
   Never print API keys or ask for them in chat — they go in `.env` (see `.env.example` in the skill folder).
2. Ask which visual style the user wants (show `references/style-gallery.jpg` from the skill folder), plus format, language, length, voice.
3. Research and fact-check before narration; follow the workflow in SKILL.md (`xp new` → script → `xp check script` → `xp narrate`
   → `xp assets` → `xp review` → `xp mix` → `xp render` → `xp export` → `xp check`).
4. Clone only voices the user owns or may use (`--consent`); download only from sources the user approved; publish only with approval.
5. Reply in the user's language.
{MARK1}
"""


def c_init(a, X, skill, root):
    files = ['AGENTS.md', 'GEMINI.md', 'CLAUDE.md']
    sel = _agents(getattr(a, 'agents_for', None))
    if 'gemini' not in sel and 'antigravity' not in sel: files.remove('GEMINI.md')
    if 'claude' not in sel: files.remove('CLAUDE.md')
    blk = _block(skill)
    for f in files:
        p = os.path.join(root, f); s = open(p, encoding='utf-8').read() if os.path.exists(p) else ''
        if f == 'GEMINI.md' and os.path.exists(os.path.join(root, 'AGENTS.md')) and '@AGENTS.md' in s: X.log(f'· {f} already imports AGENTS.md'); continue
        new = re.sub(re.escape(MARK0) + r'.*?' + re.escape(MARK1) + r'\n?', blk, s, flags=re.S) if MARK0 in s else (s.rstrip() + '\n\n' + blk if s.strip() else blk)
        if new != s: open(p, 'w', encoding='utf-8').write(new); X.log(f'✓ {f}: mega-shot block {"updated" if MARK0 in s else "added"}')
        else: X.log(f'· {f}: up to date')


def main(a, X):
    skill = os.path.realpath(X.SKILL); root = X.find_root('.')
    if a.action in ('install', 'uninstall') and a.scope == 'project' and os.path.realpath(root) == skill:
        X.die('run this from your PROJECT folder (not from inside the skill folder), or use --scope user')
    {'status': c_status, 'install': c_install, 'uninstall': c_uninstall, 'init': c_init}[a.action](a, X, skill, root)
