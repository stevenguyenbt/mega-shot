"""mega-shot · API keys. Looked up in this order (first hit wins):
  1. process environment variables (e.g. PIXABAY_API_KEY=… in your shell or CI secrets)
  2. <project>/.env                      (copy .env.example → .env)
  3. <project>/.mega-shot/keys.env       (legacy location, still supported)
Values are never printed or logged. Both files are git-ignored.
"""
import os

NAMES = ('PIXABAY_API_KEY', 'PEXELS_API_KEY', 'YOUTUBE_API_KEY', 'TRIPO_API_KEY')


def _read(p):
    out = {}
    if not os.path.exists(p): return out
    for line in open(p, encoding='utf-8'):
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line: continue
        k, v = line.split('=', 1); k = k.strip().removeprefix('export ').strip(); v = v.strip().strip('"').strip("'")
        if v: out[k] = v
    return out


def load(root):
    """{NAME: value} from .mega-shot/keys.env, overridden by .env, overridden by the environment."""
    d = _read(os.path.join(root, '.mega-shot', 'keys.env'))
    d.update(_read(os.path.join(root, '.env')))
    d.update({k: v for k, v in os.environ.items() if k.endswith(('_API_KEY', '_TOKEN')) and v})
    return d


def get(root, name, default=None): return load(root).get(name, default)
