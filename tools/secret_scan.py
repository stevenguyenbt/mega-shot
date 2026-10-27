"""mega-shot · secret / personal-data scanner for the repository (used by CI, `xp pack` and contributors).

  python tools/secret_scan.py [folder]      scan every text file (default: the repo root); exit 1 on any hit

Looks for API keys and tokens (Google, OpenAI-style, Stripe-style, GitHub, Slack, AWS, private keys, JWTs, key=value
assignments of *_API_KEY / *_TOKEN / *_SECRET / PASSWORD), e-mail addresses, and absolute personal paths
(C:\\Users\\<name>, /Users/<name>, /home/<name>, other drive letters). Add harmless examples to ALLOW.
"""
import os, re, sys

SKIP_DIRS = {'.git', 'node_modules', 'vendor', 'dist', '__pycache__', '.mega-shot', 'videos', '.venv', '.ruff_cache'}
TEXT = ('.py', '.js', '.mjs', '.html', '.css', '.md', '.yaml', '.yml', '.json', '.cmd', '.bat', '.txt', '.sh', '.toml', '.cfg', '.example', '.abc', '')
PATTERNS = [
    (r'AIza[0-9A-Za-z_-]{35}', 'Google API key'),
    (r'\bsk[-_](?:live|test|proj|ant)?[-_]?[A-Za-z0-9_-]{20,}', 'secret token (sk-…)'),
    (r'\bgh[pousr]_[A-Za-z0-9]{30,}', 'GitHub token'),
    (r'\bxox[abprs]-[A-Za-z0-9-]{10,}', 'Slack token'),
    (r'\bAKIA[0-9A-Z]{16}\b', 'AWS access key'),
    (r'-----BEGIN [A-Z ]*PRIVATE KEY-----', 'private key'),
    (r'\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}', 'JWT'),
    (r'(?i)\b[A-Z0-9_]*(API_KEY|TOKEN|SECRET|PASSWORD)\s*[=:]\s*["\']?[A-Za-z0-9/+_.-]{12,}', 'credential assignment'),
    (r'[\w.+-]+@(?!(?:example\.(?:com|org)|users\.noreply\.github\.com|anthropic\.com|wikimedia\.org)\b)[\w-]+\.[a-z]{2,}\b', 'e-mail address'),
    (r'(?i)\b[A-Z]:[\\/]{1,2}Users[\\/]{1,2}(?!<|you\b|name\b|USER\b|%)[^\\/\s"\'`]+', 'personal Windows path'),
    (r'(?<![\w.])/(?:Users|home)/(?!<|you\b|user\b|name\b|runner\b|\$)[a-z][\w.-]+', 'personal Unix path'),
    (r'(?i)\b[D-Z]:[\\/](?!<|path\b|clips\b)[\w .-]+[\\/]', 'absolute drive path'),
]
ALLOW = ('secrets.token', 'os.environ', 'YOUR_KEY', 'your-key', '<key>', 'xxxx', 'sk-...', 'example.com')


def scan(base):
    hits = []
    for dp, dns, fns in os.walk(base):
        dns[:] = [d for d in dns if d not in SKIP_DIRS]
        for f in fns:
            p = os.path.join(dp, f); rel = os.path.relpath(p, base).replace(os.sep, '/')
            if not f.lower().endswith(TEXT) or os.path.getsize(p) > 2_000_000 or rel == 'tools/secret_scan.py': continue
            try: s = open(p, encoding='utf-8').read()
            except (UnicodeDecodeError, OSError): continue
            for rx, what in PATTERNS:
                for m in re.finditer(rx, s):
                    if any(a in m.group(0) for a in ALLOW): continue
                    hits.append(f'{rel}:{s.count(chr(10), 0, m.start()) + 1}: {what}: {m.group(0)[:16]}…')
    return hits


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    base = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    h = scan(base)
    for x in h: print(x)
    print(f'{len(h)} possible secret(s) / personal item(s)' if h else 'secret scan: clean'); sys.exit(1 if h else 0)
