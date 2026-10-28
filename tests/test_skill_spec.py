"""Checks that SKILL.md follows the open Agent Skills spec (agentskills.io) so Claude Code, Codex, Antigravity, Gemini CLI
and Cursor all load it: name rules, description ≤ 1024 chars, optional fields, body size, and that every relative link exists.
Run: python tests/test_skill_spec.py   (exit 1 on any problem)"""
import os, re, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
import yaml
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s = open(os.path.join(ROOT, 'SKILL.md'), encoding='utf-8').read()
m = re.match(r'^---\n(.*?)\n---\n(.*)$', s, re.S)
errors = []
if not m: print('FAIL: SKILL.md must start with YAML frontmatter'); sys.exit(1)
fm, body = yaml.safe_load(m.group(1)), m.group(2)
name, desc = str(fm.get('name', '')), str(fm.get('description', ''))
if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', name) or len(name) > 64: errors.append(f'name {name!r}: 1–64 lowercase letters/digits/single hyphens')
if name != 'mega-shot': errors.append('name must be "mega-shot" (the folder name agents install it under)')
if not 1 <= len(desc) <= 1024: errors.append(f'description is {len(desc)} chars (must be 1–1024)')
if 'compatibility' in fm and not 1 <= len(str(fm['compatibility'])) <= 500: errors.append('compatibility must be 1–500 chars')
if 'metadata' in fm and not (isinstance(fm['metadata'], dict) and all(isinstance(v, str) for v in fm['metadata'].values())):
    errors.append('metadata must map strings to strings')
lines, size = body.count('\n'), len(body.encode('utf-8'))
if lines > 500: errors.append(f'body has {lines} lines (keep ≤ 500; move details to references/)')
if size > 32000: errors.append(f'body is {size} bytes (~{size // 4} tokens; aim ≤ ~20 KB)')
for link in re.findall(r'\]\(([^)#\s]+)', body):
    if re.match(r'[a-z]+://', link) or link.startswith('mailto:'): continue
    if not os.path.exists(os.path.join(ROOT, link)): errors.append(f'broken link: {link}')
for p in ('agents/openai.yaml',):
    try: yaml.safe_load(open(os.path.join(ROOT, p), encoding='utf-8'))
    except Exception as e: errors.append(f'{p}: {e}')
for e in errors: print('FAIL:', e)
print(f'SKILL.md: name={name} · description {len(desc)} chars · body {lines} lines / {size} bytes · ' + ('OK' if not errors else f'{len(errors)} problem(s)'))
sys.exit(1 if errors else 0)
