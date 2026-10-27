# Contributing to mega-shot

Thanks for helping! mega-shot is a video studio driven by one `video.yaml`: a Python CLI (`tools/xp.py`) orchestrates
narration, asset search, a browser-based Canvas/Three.js renderer (`engine/`) and FFmpeg.

## Ground rules

- **No secrets, ever.** Never commit `.env`, `.mega-shot/`, `videos/`, API keys, OAuth tokens, personal paths or e-mail
  addresses. CI and `xp pack` run a secret scan (`python tools/secret_scan.py`) — run it before you open a PR.
- **No copyrighted media.** Only add images/audio/fonts you made yourself or that are CC0 / public domain / under a
  compatible licence, and list third-party material in `THIRD_PARTY_NOTICES.md`.
- **Backward compatibility.** Existing videos use Vietnamese YAML keys and command names. Don't rename internal keys;
  add English names as aliases (`tools/yaml_keys.py`, the `LEGACY_*` tables in `tools/xp.py`).
- **Ask before downloading.** Code that downloads or installs something goes through `xp setup --install <id>` or an
  explicit user flag, shows size + licence, and logs the licence.

## Development setup

```bash
git clone <your fork> mega-shot && cd mega-shot
uv --version && ffmpeg -version          # prerequisites
./xp setup --quick                        # Windows: xp.cmd setup --quick
uv run --with ruff ruff check tools tests
uv run --with playwright==1.63.0 --with pyyaml --with pillow --with numpy --with ruamel.yaml python tests/kiem_thu.py
```

The regression test renders frames of the blank template in 9:16, 16:9 and Chinese line wrapping with a synthetic
voice and checks the English/Vietnamese YAML key aliases. It needs FFmpeg and Chromium (`./xp setup --install chromium`)
but no GPU, VoiceStudio or API keys.

## Code style

- Match the surrounding code: compact, one idea per line, aligned trailing comments where the file already does that.
- New user-facing text (CLI help, log messages, docs) and comments in **English**.
- New YAML keys: choose the internal name, add the English alias in `tools/yaml_keys.py`, regenerate
  `docs/yaml-reference.md` (`python tools/yaml_keys.py --markdown`).
- Rendering must stay deterministic (no `Math.random()` / `Date.now()` in film code; use the seeded helpers in `engine/core/util.js`).

## Pull requests

1. One topic per PR; say what changed and how you tested it (attach a preview frame or contact sheet for visual changes).
2. `ruff check`, `tests/kiem_thu.py` and the secret scan pass.
3. Update `CHANGELOG.md` under *Unreleased*.

By contributing you agree that your contribution is licensed under the repository licence (`LICENSE`).
