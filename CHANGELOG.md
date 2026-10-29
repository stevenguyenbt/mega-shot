# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning: [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2.3.0] — 2026-10-29 — macOS one-command install, Whisper sized for your machine

### Added
- `install.sh`: one-command setup for macOS (Apple Silicon and Intel) and Linux — uv, Homebrew + FFmpeg, Chromium,
  fonts, the speech model, agent links, project folder; asks before each step (`--yes`, `--with-voicestudio`, `--project`).
- `tools/hw.py`: hardware profile (chip, cores, RAM, NVIDIA VRAM, Rosetta) and the speech-recognition plan:
  mlx-whisper on Apple Silicon, CUDA on big NVIDIA GPUs, faster-whisper int8 on the CPU sized by cores/RAM; automatic
  CPU fallback in `tools/nghe.py`. `xp setup` shows it; `xp setup --install whisper` pre-downloads the model.
- CI job on an Apple Silicon Mac (macos-14): runs `./install.sh --yes`, the render test and `tests/test_asr.py`.

### Fixed
- `xp` and `install.sh` are executable in git (macOS/Linux `./xp` failed with "permission denied").
- `xp` finds uv/FFmpeg in Homebrew and `~/.local/bin` even when an agent app starts it with a minimal PATH.
- Headless Chromium uses Metal on macOS and GL on Linux (Direct3D flags only on Windows); Blender, Rockwell font and
  "open folder" work with macOS paths.

## [2.2.0] — 2026-10-28 — works with every agent

### Added
- `xp agents status|install|init|uninstall`: link the skill into the skills folders of Claude Code, OpenAI Codex,
  Google Antigravity, Gemini CLI and Cursor (symlink / Windows junction, or `--copy`), per user or per project, and write
  a mega-shot block into the project's AGENTS.md / GEMINI.md / CLAUDE.md.
- `agents/openai.yaml` (Codex display metadata, `$mega-shot`), `GEMINI.md` (imports AGENTS.md), `docs/agents.md`
  (per-agent install, sandbox and approval notes).
- `tests/test_skill_spec.py` (run in CI): SKILL.md must follow the Agent Skills spec — name, description ≤ 1024 chars,
  optional fields, body size, working links.

### Changed
- SKILL.md rewritten to the Agent Skills standard: 54 KB → 13 KB (~3.4k tokens) with `license`, `compatibility` and
  `metadata`; detailed guidance moved to new topic files (`references/workflow-details.md`, `footage.md`, `voice.md`,
  `music.md`, `news.md`, `story.md`, `more-tools.md`, `automation.md`, `glossary.md`). Nothing removed.
- Instructions are agent-neutral (no tool names specific to one agent); README / FAQ / getting started cover all agents.

## [2.1.0] — 2026-10-28

### Added
- `xp review`: first-3-seconds check (voice starts at once, hook sentence lands in ~3 s, frame 0 not empty, text on
  screen by 1 s, picture moves) with frames saved to `build/soat/mo_dau_*.jpg`, and a reading-time check for titles,
  labels and graphics (`--skip-read` to skip); report also as `build/soat/bao_cao.json`.
- `xp check`: 6-question film review → `build/duyet_phim.md`.
- `xp redraw` (old name `ve-lai`): redraw a flat/cel illustration as SVG in code — analyse, vectorize, line check,
  recolour, extend the canvas, build a cut-out rig (`references/ve-lai.md`).
- `xp pose-editor` (old name `dung-dang`): FK pose & clip editor for the 2D characters with a shared custom clip library
  (`engine/core/nhanvat_clip_rieng.js`, `references/dung-dang.md`).
- `xp cast-design` (old name `nhanvat`): AI design loop for code-drawn characters — description/photo → spec → review
  sheet → score → lock (`references/characters-ai-loop.md`).
- Character engine: new clips, joint limits and repair, new story sets in `truyen.js`; review sheet `xuong_soat.html`.

### Credits
- Ideas (no code or data) from ArtCraft (pose editor) and chaojifeng-video-design (opening and reading-time checks) — see THIRD_PARTY_NOTICES.md.

## [2.0.0] — 2026-10-27 — first open-source release

### Added
- English YAML keys for every documented option (`scenes`, `narration`, `subtitle`, `voice.sample`, `search.query`, …).
  The original Vietnamese keys keep working and can be mixed (`tools/yaml_keys.py`, `docs/yaml-reference.md`).
- English template names for `xp new --template` (`blank`, `ai-image`, `manifesto`, `medical`, `news`, `story`, `philosophy`).
- API keys from environment variables or `<project>/.env` (`.env.example`), besides the legacy `.mega-shot/keys.env`.
- `xp setup --install huashu` (optional drawn-styles skill into `vendor/`); FFmpeg install on macOS (Homebrew) and Linux (apt/dnf/pacman).
- `MS_PROJECT` to pin the project folder; on first run `xp setup` makes the current folder the project.
- Pluggable `xp social` (folder / webhook / custom-module adapters).
- README, docs/, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, THIRD_PARTY_NOTICES, CI, issue/PR templates, `pyproject.toml`, secret scanner.

### Changed
- CLI help, log messages, Studio UI, comments and docs are English-first. Old Vietnamese command and flag names
  (`giong`, `thu`, `xuat`, `loat chay`, `--lam-lai`, …) are still accepted.
- Templates ship with English example scripts and the built-in `documentarian` English voice; default voice sample is `documentarian`.

### Removed (specific to the original author's private setup)
- Remote phone viewer (hosted web app), `xp tinx` (private news backend), `xp flow` (browser automation), the private
  social-posting API client, and all of the author's channel profiles, voices, 3D model library and project data.

## 1.5.x — before open-sourcing
Internal versions (Vietnamese-only CLI and docs).
