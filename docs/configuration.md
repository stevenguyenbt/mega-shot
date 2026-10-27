# Configuration

## Project folder

mega-shot keeps code (this repository) and your data apart. Your **project** is any folder you run `xp` in:

```
my-project/
├── .env                  # your API keys (copy from .env.example) — git-ignored
├── .mega-shot/           # private data, created by `xp setup` — never commit
│   ├── chinh_sach.json   # auto-download policy ("chính sách" = policy)
│   ├── keys.env          # legacy key file (still read)
│   ├── voices/<name>/    # ref.wav + ref.txt per narration voice
│   ├── music/  sfx/  fonts/  models/  assets/  tools/
│   └── setup_status.json
├── videos/<name>/        # one folder per video (video.yaml, film.html, build/, out/)
└── kenh/<id>/            # optional: YouTube channel automation profiles
```

How `xp` finds the project: `MS_PROJECT` if set → otherwise the nearest parent folder that contains `.mega-shot/` →
otherwise the current folder (on first `xp setup`).

## API keys

Read in this order (first wins): environment variables → `<project>/.env` → `<project>/.mega-shot/keys.env`.
Values are never printed. See [`.env.example`](../.env.example).

| Key | Needed for |
|---|---|
| `PIXABAY_API_KEY` | stock footage/photos (`xp assets`, footage template) — free |
| `PEXELS_API_KEY` | second stock source (optional) — free |
| `YOUTUBE_API_KEY` | `xp viral`, `xp channel score` (optional) |
| `TRIPO_API_KEY` | `tools/tripo.py` (optional, paid service) |

YouTube uploads (`xp channel`) use OAuth instead: `.mega-shot/youtube/client_secret.json` (a "Desktop app" OAuth client
you create in Google Cloud) and per-channel tokens — see [references/channels.md](../references/channels.md).

## Download policy

`xp assets` downloads only when `.mega-shot/chinh_sach.json` exists. `xp setup --policy` creates it after you agree:

```jsonc
{ "tu_tai": true,                               // auto-download allowed
  "nguon": ["pixabay", "pexels", "nasa", "polyhaven", "ambientcg"],   // allowed sources
  "giay_phep": "commercial use allowed (CC0, Pixabay/Pexels License, public domain)",
  "gioi_han_mb_moi_video": 1024 }               // MB limit per video
```

Extra sources for one video only: `extra_sources: [wikimedia]` in its `video.yaml`.

## Environment variables

| Variable | Effect |
|---|---|
| `MS_PROJECT` | project folder |
| `MS_BLENDER` | Blender executable |
| `HUASHU_SKILL` | path to huashu-art-motion (otherwise sibling skill folder or `vendor/`) |
| `MS_ENCODER=x264` | force CPU encoding instead of in-browser WebCodecs |
| `MS_ASR=voicestudio`, `MS_ASR_MODEL=medium` | narration listen-back engine / Whisper model size |
| `MS_KHONG_DON=1` | never auto-delete posted video folders |
| `MS_AUTO_CLEAN=1` | let `xp social run` clean up posted folders |
| `MS_CHO_CLIP_TU_XAC_NHAN=1` | allow posting a video that contains consent-only clips (one-off) |

## Optional components

| `xp setup --install …` | Enables |
|---|---|
| `voicestudio` | narration (TTS + cloning) |
| `three` | Three.js templates (`threejs`, `medical`, `philosophy`) |
| `huashu` | drawn styles (`xp art`) |
| `hyperframes` | news motion graphics (`xp hf`) |
| `composer` | original music (`xp compose`) |
| `birefnet` | background removal (2.5D stills, thumbnails) |
| `fonts` | thumbnail fonts (OFL) |

Blender: install it yourself (or unzip a portable build into `.mega-shot/tools/`) and set `MS_BLENDER` if it is not on PATH.
