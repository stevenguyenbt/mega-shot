# `xp` command reference

Run `xp <command> --help` for every flag. Run commands from your **project folder** (or inside a video folder
`videos/<name>/` for per-video commands). Old Vietnamese command and flag names are still accepted (table at the end).

## Setup & libraries

| Command | What it does |
|---|---|
| `xp setup` | check prerequisites, fix what is safe, list **NEEDS YOUR INPUT** (`--install <ids>`, `--policy`, `--json`, `--quick`, `--no-launch`). Install ids: `ffmpeg, chromium, three, fonts, huashu, hyperframes, composer, birefnet, voicestudio` |
| `xp voicestudio start\|stop\|restart\|status` | run the VoiceStudio TTS API headless (`--gui` opens the app) |
| `xp voice add <audio-or-video> --name N --consent` | clone a narration voice (≥ 15 s of one speaker); `xp voice add --archetype documentarian` for a built-in English narrator; `xp voice list`, `xp voice check <name>` |
| `xp music add <file> --name bg [--start s --duration s --license "…" --use]` | add background music (normalised, logged); `xp music list` |
| `xp music brief` / `xp music check [files]` | what music to look for (+ Pixabay Music links) / score downloaded candidates |
| `xp sfx kenney list\|add <pack…>` · `xp sfx search <words>` · `xp sfx add <file> --name --license --source` | sound-effect library |
| `xp studio [--port 3901 --open]` | local dashboard at http://127.0.0.1:3901 |

## One video

| Command | What it does |
|---|---|
| `xp new <name> --format 9x16\|16x9\|1x1 --template <t>` | new `videos/<name>/` — templates: `footage`, `blank`, `threejs`, `blender`, `ai-image`, `manifesto`, `medical`, `news`, `philosophy` |
| `xp check script` | score the script before narration |
| `xp narrate [--redo id…] [--import-from <dir>]` | narration per scene + word timestamps (VoiceStudio, or your `seg1.wav, seg2.wav…`) |
| `xp timeline` | rebuild timing without generating voice |
| `xp assets [scene…]` | search, score, download and cut footage/images for scenes with `search` |
| `xp grade [scene…]` | colour-match footage (runs after `assets` automatically) |
| `xp art [scene…]` | render `huashu:` drawn-style scenes |
| `xp hf [scene…]` | render `hf:` news motion graphics (HyperFrames) |
| `xp blender [scene…]` · `xp 3d <script.py>` | Blender scenes / one Blender still |
| `xp prompts` / `xp images` | AI-image prompts / import generated images |
| `xp compose` | perform the video's own ABC music score → `build/nhac_soan.wav` |
| `xp review [--skip-read]` | dropped words, subtitle ≠ speech, text off-frame, first 3 seconds, on-screen reading time — **before** rendering |
| `xp preview [--at 5,12,30]` | preview frames + contact sheet `build/thu.jpg` |
| `xp mix` | voice + music + SFX → `build/mix.wav` |
| `xp render [--scene id…] [--full]` | render (per-scene cache) |
| `xp export [--limit 29]` | upload file + phone preview + publishing package + subtitles |
| `xp check` | quality check of the export (cut self-check, ending, loudness) + `build/duyet_phim.md` 6-question review sheet |
| `xp all` | narrate → mix → render → export → check |
| `xp publish` · `xp subtitles [--langs ja,es]` · `xp thumbnail [new]` | publishing package · caption files · thumbnails |

## Series, channels, extras

| Command | What it does |
|---|---|
| `xp series new <name> --episodes N` · `xp series run [--only tap-02] [--steps …]` · `xp series assemble` | multi-episode → one long YouTube video |
| `xp channel …` | optional YouTube automation (official API, PRIVATE uploads) — [references/channels.md](../references/channels.md) |
| `xp social target\|post\|run\|list\|cancel\|retry` | optional posting through your adapter — [social-posting.md](social-posting.md) |
| `xp cleanup [--delete]` | free disk: archive text files and delete video folders already posted everywhere (dry run by default) |
| `xp viral "<topic>"` | optional viral research (YouTube Data API metadata) |
| `xp clip <url>` | licence-checked scenes from an online video (CC / public domain / your own channels) |
| `xp satellite <name> --center LAT,LON` | real satellite plates (Sentinel-2 + Blue Marble) |
| `xp restore <image>` | rebuild a low-quality image sharper / cleaner / larger |
| `xp model new\|check\|list` | reusable procedural 3D models from a reference image |
| `xp character demo` · `xp text-styles` | regenerate preview GIFs |
| `xp cast-design new\|draw\|score\|cast\|lock\|yaml\|list <id>` | AI design loop for code-drawn 2D characters — [characters-ai-loop.md](../references/characters-ai-loop.md) |
| `xp redraw phan-tich\|ve\|doi-mau\|mo-rong\|rig <image\|folder>` | redraw a flat illustration as SVG, recolour, extend, cut-out rig — [ve-lai.md](../references/ve-lai.md) |
| `xp pose-editor mo\|them\|soat\|ds\|xoa` | FK pose & clip editor + shared custom clip library — [dung-dang.md](../references/dung-dang.md) |
| `xp download polyhaven <id>` / `xp download url <link> --name --license --source` | one asset + licence log |
| `xp pack` | build a distributable zip (secret scan included) |

## Old (Vietnamese) names → English

| Old | New | | Old flag | New flag |
|---|---|---|---|---|
| `caidat` | `setup` | | `--khung` | `--format` |
| `moi` | `new` | | `--mau` | `--template` |
| `giong` | `narrate` | | `--nhap-tu` | `--import-from` |
| `mocthoigian` | `timeline` | | `--lam-lai` | `--redo` |
| `timtainguyen` | `assets` | | `--trang` | `--page` |
| `tainguyen` | `download` | | `--gioi-han` | `--limit` |
| `loinhac` / `anh` | `prompts` / `images` | | `--so-tap` | `--episodes` |
| `thu` | `preview` | | `--tap` | `--only` |
| `am` | `mix` | | `--buoc` | `--steps` |
| `soat` | `review` | | `--cong` / `--mo` | `--port` / `--open` |
| `xuat` | `export` | | `--nhap` | `--draft` |
| `kiemtra` (`kiemtra kichban`) | `check` (`check script`) | | `--tu` / `--chi` | `--from` / `--only-frame` |
| `tatca` | `all` | | `--do-phan-giai` | `--resolution` |
| `loat moi\|chay\|ghep` | `series new\|run\|assemble` | | `--ten` / `--giay-phep` / `--nguon` | `--name` / `--license` / `--source` |
| `anhbia` (`anhbia moi`) | `thumbnail` (`thumbnail new`) | | `--t` | `--at` |
| `dangbai` | `publish` | | `--xoa` | `--delete` |
| `nhac` · `don` · `vetinh` · `taitao` | `compose` · `cleanup` · `satellite` · `restore` | | | |
| `nhanvat` · `ve-lai` · `dung-dang` | `cast-design` · `redraw` · `pose-editor` | | | |
