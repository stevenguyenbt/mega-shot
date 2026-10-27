# Setup — `xp setup`

## Install layout

- The skill folder (this repository) lives in `~/.claude/skills/mega-shot` (all projects) or
  `<project>/.claude/skills/mega-shot` (one project). The command is `<skill>/xp` (bash) or `<skill>\xp.cmd` (Windows).
- You run `xp` **from your own project folder**. Project data goes into `<project>/.mega-shot/` (voices, music, sound
  library, models, fonts, policy, tokens) and videos into `<project>/videos/<name>/`. The first `xp setup` in a folder
  creates `.mega-shot/` there (not allowed in your home folder; or set `MS_PROJECT=<folder>`). Later commands find the
  nearest parent folder that has `.mega-shot/`.
- **API keys** are read, first hit wins, from: process environment variables → `<project>/.env` (copy the skill's
  `.env.example`) → `<project>/.mega-shot/keys.env` (legacy). Known names: `PIXABAY_API_KEY`, `PEXELS_API_KEY`,
  `YOUTUBE_API_KEY`, `TRIPO_API_KEY`. Values are never printed or logged; keep both files out of git.

## What `xp setup` does

Run **`xp setup`** at the start of every session and on any new machine. It takes a few seconds, checks every
prerequisite, fixes what is safe (it starts the VoiceStudio backend **headless** if VoiceStudio is installed but not
running) and prints a **NEEDS YOUR INPUT** list. It never downloads, installs, or writes policy/keys by itself.

```
xp setup                          check everything (also saved to .mega-shot/setup_status.json)
xp setup --json                   same, machine-readable
xp setup --quick                  skip the browser launch test
xp setup --no-launch              do not start VoiceStudio
xp setup --install fonts,three    install approved items (ids: ffmpeg, chromium, three, fonts, huashu, birefnet, voicestudio)
xp setup --policy                 create .mega-shot/chinh_sach.json (auto-download policy) — only after the user agreed
```

Exit code: `0` = everything required for the footage workflow is ready; `1` = something required is missing.

## Protocol for the AI

1. Run `xp setup` (or `xp setup --json` to parse).
2. If the report ends with `READY` and nothing required is listed, continue with the user's request. Mention optional
   items briefly, at most once.
3. For each item under **NEEDS YOUR INPUT**, ask the user before acting — group them into one `AskUserQuestion` call
   where possible:
   - **APPROVE DOWNLOAD** (`install`): say what it is, its size and licence; on "yes" run `xp setup --install <id>[,<id>…]`.
   - **DECIDE** (`decide`): the auto-download policy — explain the sources (Pixabay, Pexels, NASA, Poly Haven,
     ambientCG), the commercial-use licences and the 1 GB/video limit; on "yes" run `xp setup --policy`.
   - **PROVIDE** (`provide`): API keys or a voice — tell the user exactly where to put keys (`.env` in the project,
     e.g. `PIXABAY_API_KEY=…`). Never ask them to paste secrets into chat; never print keys. For a voice, see below.
   - **DO MANUALLY** / **OPTIONAL** (`manual`, `manual-optional`): give the link/steps; do not do it for them
     (installing apps, drivers).
4. Re-run `xp setup` after changes and confirm `READY`.

## Prerequisites

| Id | Component | Needed for | Size / licence | How |
|---|---|---|---|---|
| `uv` | uv | every command; Python packages (playwright, pyyaml, pillow, numpy, ruamel.yaml, rembg, opencv…) install automatically on first use | small · MIT/Apache | manual: https://docs.astral.sh/uv/ |
| `ffmpeg` | FFmpeg + FFprobe on PATH | mixing, encoding, frame extraction | ~90 MB · LGPL/GPL | `xp setup --install ffmpeg` (Windows winget `Gyan.FFmpeg` · macOS Homebrew · Linux apt/dnf/pacman with sudo) |
| `chromium` | Playwright Chromium | rendering every frame | ~180 MB · BSD | `xp setup --install chromium` |
| `webcodecs` | in-browser H.264 encoder | fast render (~55 fps with GPU); falls back to JPEG→x264 (~16 fps) | — | automatic check |
| `gpu` | NVIDIA GPU / driver | VoiceStudio speed; NVENC in ffmpeg needs driver ≥ 610 | — | optional manual update |
| `voicestudio` | VoiceStudio (local API on :3900) | narration + word timestamps | ~215–275 MB + voice models · AGPL-3.0 | `xp setup --install voicestudio`: official release from github.com/debpalash/VoiceStudio for this OS/CPU, SHA-256 verified against the release's `SHA256SUMS.txt`, per-user install without admin (Windows silent installer · macOS unzip to /Applications + `xattr -cr` because the app is not notarized · Linux AppImage in `~/.local/bin`), then opened **once** so it builds its runtime and downloads its models. Afterwards it runs headless: `xp voicestudio start\|stop\|restart\|status` |
| `voices` | `.mega-shot/voices/<name>/ref.wav` + `ref.txt` | cloned narration voice (≤ 10 s sample + exact transcript) | — | quick start: `xp voice add --archetype documentarian` (built-in English narrator; also storyteller, anchor, librarian, calm-guide, explainer, teacher). Own voice: an audio/video file → `xp voice add <file> --name <name> --consent` |
| — | `.mega-shot/music/<name>.mp3` | background music | the user's licence | an audio/video file → `xp music add <file> --name <name> --license "…" [--use]` |
| `pixabay_api_key` | `PIXABAY_API_KEY` | stock footage/photo search (required for the footage workflow) | free key: https://pixabay.com/api/docs/ | user adds it to `.env` |
| `pexels_api_key` | `PEXELS_API_KEY` | second stock source | free key: https://www.pexels.com/api/ | optional |
| `youtube_api_key` | `YOUTUBE_API_KEY` | `xp viral`, `xp channel score` (metadata only) | free (Google Cloud → YouTube Data API v3 → API key) | optional |
| `policy` | `.mega-shot/chinh_sach.json` | automatic licensed downloads by `xp assets` | — | user decides → `xp setup --policy` |
| `birefnet` | BiRefNet model (via rembg) | 2.5D stills, thumbnail cut-outs | ~973 MB · MIT | `xp setup --install birefnet` (otherwise downloaded on first use) |
| `fonts` | Be Vietnam Pro Black/ExtraBold, Oswald | thumbnails (full Latin incl. Vietnamese diacritics) | ~1 MB · SIL OFL 1.1 | `xp setup --install fonts` |
| `rockwell` | Rockwell Extra Bold | poster-style thumbnail titles | Windows/Office font | info only (Georgia is used instead) |
| `three` | three.js in `engine/node_modules` | `threejs` template, 3D scenes | ~30 MB · MIT | `xp setup --install three` (needs Node.js/npm) |
| `blender` | Blender (`blender` on PATH, portable in `.mega-shot/tools/blender-*`, or `MS_BLENDER`) | `blender` template only | ~400 MB · GPL | manual-optional: https://www.blender.org/download/ |
| `huashu` | huashu-art-motion skill | drawn styles for `xp art` (sketch/whiteboard, flat 2D, kinetic type, 3b1b, 35 painterly styles) | ~100 MB · MIT | `xp setup --install huashu` (git clone of github.com/alchaincyf/huashu-art-motion into `vendor/`), or install it as a sibling skill, or set `HUASHU_SKILL` |
| `disk` | free disk space | a long series needs ~10–20 GB | — | info |

Every `--install` is appended to `.mega-shot/GIAY_PHEP_CAI_DAT.md` (*installed components + licences*).

## Optional extras (not checked by `xp setup`)

- **YouTube uploads** (`xp channel`): OAuth client in `.mega-shot/youtube/client_secret.json` — see `channels.md`.
- **Composed music** (`xp compose` (old name `xp nhac`)): instrument samples from the huashu-motion project — see `chuyen-dong/NGUON.md`.
- **HyperFrames** (`xp hf`, template `news`): `npm i hyperframes gsap world-atlas d3-geo topojson-client` in
  `.mega-shot/tools/hyperframes` — see SKILL.md.
- **Social posting** (`xp social`): you bring your own adapter (folder, webhook or Python module) — see SKILL.md.
