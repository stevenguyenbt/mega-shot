# AGENTS.md — mega-shot video studio (for any coding agent: Claude Code, Codex, Cursor, Gemini CLI, Windsurf, Copilot agent, Aider…)

**mega-shot** turns one `video.yaml` into a finished video: script → narration → visuals → subtitles → music → export →
quality check → YouTube/TikTok publishing package. The full manual for agents is [`SKILL.md`](SKILL.md); topic guides
are in [`references/`](references/); human docs in [`docs/`](docs/). Read SKILL.md before doing anything.

`<skill>` below = the folder of this repository (e.g. `~/.claude/skills/mega-shot`). Run commands from the user's
**project folder** (where `.mega-shot/` and `videos/` live), not from inside the skill folder.

## What the agent needs
A terminal on the user's machine (not a plain chat window):
- **uv** (every `xp` command runs through `uv run`), **FFmpeg**, **Chromium** via Playwright (`xp setup --install chromium`).
- **Node.js/npm** only for 3D templates (`xp setup --install three`) and optional HyperFrames news graphics.
- **Narration:** VoiceStudio at `127.0.0.1:3900`, started headless by `xp` (`xp voicestudio start|stop|restart|status`).
  Without it: record or generate audio elsewhere and use `xp narrate --import-from <folder>`.

## Command
`<skill>/xp <command>` (bash/zsh) or `<skill>\xp.cmd <command>` (Windows). `xp --help` lists everything.

## Workflow (always in this order)
1. **`xp setup`** — show the user every item under **NEEDS YOUR INPUT**; install/download only what they approve
   (`xp setup --install <ids>`, `xp setup --policy`). Never print API keys or ask the user to paste them into chat —
   keys go in `<project>/.env` (template: `.env.example`).
2. **Ask the visual style** before writing (show `references/style-gallery.jpg`); confirm format (9:16 / 16:9 / series),
   language, length and voice.
3. `xp new <name> --format 9x16|16x9 --template footage|blank|threejs|blender|ai-image|manifesto|medical|news|philosophy`
4. Write `nghien_cuu.md` (research notes, sourced facts). Then `video.yaml`: `narration` = spoken text (numbers as
   words), `subtitle` = on-screen text, plus the `publish` block. `xp check script`, then an **independent fact-check**.
5. `xp narrate` → `xp assets` → open `build/tim/<scene>_phuong_an.jpg` (options sheet), pin good clips with `pick: <id>`.
6. `xp review` → `xp preview` (look at `build/thu.jpg`) → fix.
7. `xp mix` → `xp render` → `xp export` → `xp check` → `xp thumbnail`.
8. **English subtitles (always for YouTube):** if the video is not English, translate `out/subtitles/en.todo.json` into
   `out/subtitles/en.json` (same ids, keep `_cues_sha`) and run `xp subtitles`.
9. Deliver `out/*.mp4`, `out/youtube_dang_bai.md`, `out/anh_bia_*.jpg`, `out/subtitles/*.srt` + `*.txt`.

## Rules
- Reply in the user's language. YAML keys can be English or the original Vietnamese (`docs/yaml-reference.md`).
- **Downloads** only from sources in the approved policy (`.mega-shot/chinh_sach.json`); Wikimedia only per video
  (`extra_sources: [wikimedia]`) with the user's OK. Never take content from YouTube, TikTok or Google Images.
- **Voice cloning** only for a voice the user owns or has explicit permission for (`xp voice add … --consent`).
- **Sensitive topics** (history, religion, health, war): hedge debated claims, attribute every number, neutral tone
  (`references/sensitive-topics.md`).
- **Publishing** (`xp channel upload`, `xp social`) only with the account owner's explicit approval; YouTube uploads are PRIVATE.
- Ask before installing anything new; never delete user files.
