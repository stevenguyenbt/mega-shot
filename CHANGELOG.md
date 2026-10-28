# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning: [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
