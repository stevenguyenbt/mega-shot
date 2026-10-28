---
name: mega-shot
description: "Makes finished narrated videos from an idea, driven by one video.yaml: researched, fact-checked script; narration in a cloned or built-in voice (local VoiceStudio TTS, voice cloning from any audio/video file); visuals in a style chosen with the user (stock footage and archival images, 2.5D parallax, whiteboard, flat 2D, kinetic type, 35 painterly styles, Three.js or Blender 3D, AI images, news graphics, satellite imagery, code-drawn story characters); music mix at -14 LUFS; high-quality export plus phone preview; automatic quality checks; English subtitles (SRT); YouTube thumbnails; publishing package. Use when the user wants an explainer, history, timeline, news, medical, motivational or story video; a short vertical 9:16 video for TikTok, Reels or YouTube Shorts; a long 16:9 YouTube video or multi-episode series with chapters; subtitles; voice cloning; thumbnails; 3D or realistic visuals; or automated YouTube channel production."
license: MIT
compatibility: "Needs a terminal agent that can run shell commands; uv + FFmpeg; Chromium via Playwright; optional VoiceStudio (local TTS), Node.js, Blender; network access for stock footage/music search and optional downloads."
metadata:
  version: "2.2.0"
  author: "stevenguyenbt"
  homepage: "https://github.com/stevenguyenbt/mega-shot"
---

# mega-shot · Video studio

One video = a folder `videos/<name>/` with `video.yaml` (script + settings) and `film.html` (how each scene is drawn).
The framework handles narration, timing, subtitles, transitions, post-processing, mixing, export and QA. Output: a
high-quality upload file, a < 29 MB phone preview, subtitles and a publishing package in `videos/<name>/out/`.

## Running the CLI

- The CLI is `xp` (bash/zsh) or `xp.cmd` (Windows) **inside this skill's folder**. Run it by path **from the user's
  project folder**, never from inside the skill folder: `<skill-folder>/xp setup` or `<skill-folder>\xp.cmd setup`.
  Below it is written as just `xp`.
- Project data lives in `<project>/.mega-shot/`, videos in `<project>/videos/`. Requires `uv` and `ffmpeg`.
- Commands and YAML keys have English names; the old Vietnamese names still work (the engine was built in Vietnamese,
  so some file names like `nghien_cuu.md` research notes and `giay_phep.json` licence book stay Vietnamese). Inside
  `film.html`, `c.data.<key>` uses the internal Vietnamese names. Details: [references/workflow-details.md](references/workflow-details.md),
  [references/glossary.md](references/glossary.md).
- Works in any agent that reads Agent Skills (Claude Code, Codex, Antigravity, Gemini CLI, Cursor). `xp agents install`
  links this folder into their skills directories; `xp agents init` writes a short block into the project's AGENTS.md /
  GEMINI.md / CLAUDE.md. Sandbox/approval notes per agent: [docs/agents.md](docs/agents.md).
- Shell commands must be allowed to use the network (uv packages, stock search) and to start a local server on
  127.0.0.1 + headless Chromium (rendering). Some renders take minutes — let them finish.

## Mandatory rules

1. **Run `xp setup` first** (every new session or machine). It prints **NEEDS YOUR INPUT**: ask the user about every
   item (downloads with size + licence, the auto-download policy, keys, voice samples) and run
   `xp setup --install <ids>` / `xp setup --policy` only for what they approved. **Never download or install anything
   without approval** (assets outside the approved policy, models, tools, music).
2. **Never print, paste or commit API keys/tokens.** Keys come from environment variables or `<project>/.env` (template
   `.env.example` in the skill folder); tell the user where to put them, never ask them to paste keys into chat. Never
   type passwords — the user signs in themselves (`xp channel auth`).
3. **Ask the visual style first** (Step 0) and the subtitle/title text styles in the same round; never decide silently.
   Ask the user one question per decision; use your agent's question/choice tool if it has one.
4. **Research and fact-check before narration.** Write `nghien_cuu.md` (10–20 sourced facts) first; every number on
   screen has a source. After `xp check script` passes, fact-check the script against the sources: if you can run a
   second agent or reviewer, have it fact-check independently; otherwise do a separate careful pass yourself.
5. **Voice cloning needs consent:** only clone a voice the user owns or has explicit permission to use
   (`xp voice add … --consent`).
6. **Licences:** asset/music sources must allow commercial use; log every licence (`giay_phep.json`, `GIAY_PHEP.md`,
   `MUSIC_LICENSES.md`) and credit what needs credit. Never rip video/audio from YouTube/TikTok; online clips only
   through `xp clip`'s licence gate. Watching other videos is view-only: pause, mute and stop them when done.
7. **English subtitles (SRT) for every YouTube video**, delivered with the video (you translate `en.todo.json`).
8. **Nothing goes public without the owner:** channel uploads are private; never approve topics or publish on your own;
   ask before the first `xp social` post to each new account.

## Workflow (in order)

0. **Optional viral research** — offer it, never force it: `xp viral "<topic>"` ([references/viral-research.md](references/viral-research.md)).
1. **Style (always ask).** Send/show the user `references/style-gallery.jpg` (open the image file and share it) and
   ask: family first (real images / drawn 2D / 3D / art style & AI images), then the exact look, with a recommendation.
   Also show `references/text-styles/overview-subtitles.gif` + `overview-titles.gif` and recommend a pairing. Record
   `style: { kind, huashu, subtitle_style, title_style }` ([references/styles.md](references/styles.md), [references/text-styles.md](references/text-styles.md)).
2. **`xp new <name> --format 9x16|16x9|1x1 --template <t>`** — `footage` (recommended), `blank`, `threejs`, `blender`,
   `ai-image`, `manifesto`, `medical`, `news`, `story`, `philosophy`.
3. **Research → `nghien_cuu.md`** (search the web if your agent can): facts with sources, mechanisms, comparisons,
   misconceptions ([references/script-and-voice.md](references/script-and-voice.md), [references/sensitive-topics.md](references/sensitive-topics.md)).
4. **Script** in `video.yaml`: 4 layers per idea (what → why/how → what it means → hook to the next). `narration` =
   spoken, `subtitle` = on-screen (`**keyword**`, `|` line break). Also write the `publish` block ([references/publishing.md](references/publishing.md)).
5. **`xp check script`** → revise until ≥ 8/10 → independent fact-check (rule 4) → fix everything.
6. **Music (offer before narration):** `xp music brief` / `xp music check` / `xp music add`, or compose with
   `xp compose` ([references/music.md](references/music.md)). 16:9 long videos have no music by default.
7. **`xp narrate`** — VoiceStudio runs headless; `voice.speed` 1.1–1.2 suits dense shorts; fix ⚠ lines with
   `--redo <id>` ([references/voice.md](references/voice.md)).
8. **Visuals:** `search:` entries → `xp assets`, then **open `build/tim/<id>_phuong_an.jpg`** and pin `pick:` where
   wrong ([references/footage.md](references/footage.md), [references/visual-backends.md](references/visual-backends.md)). Other backends: `xp art`, `xp hf`,
   `xp blender`, `xp prompts`/`xp images`.
9. **`xp preview`** → open `build/thu.jpg` and mid-transition frames.
10. **`xp mix` → `xp review` → `xp render` → `xp export` → `xp check`.** Fix everything `review` lists before rendering;
    render is cached per scene, so fix only what broke, at most 3 passes. Open `build/kiem_cat/tong.jpg`. Have
    `build/duyet_phim.md` filled by an independent reviewer (second agent if available, otherwise a separate careful
    pass) — pass = every dimension ≥ 7, average ≥ 8 ([references/quality-checks.md](references/quality-checks.md)).
11. **English subtitles:** `xp subtitles` writes `out/subtitles/en.todo.json` for non-English videos → you translate it
    to `en.json` (same ids, keep `_cues_sha`) → run `xp subtitles` again.
12. **Deliver:** send/show the user the export and phone preview, and paste the title, caption and hashtags into chat
    (`out/youtube_dang_bai.md`, `out/dang_bai_mxh.md`).

Full step-by-step details: [references/workflow-details.md](references/workflow-details.md).

## Command table (most used)

| Command | What it does |
|---|---|
| `setup` | check prerequisites, list what needs the user (`--install <ids>`, `--policy`, `--json`) — run first |
| `new <name>` | new video from a template (`--format`, `--template`) |
| `viral "<topic>"` | optional viral research |
| `check script` | score the script before narration |
| `voice add\|list\|check` | clone a voice from an audio/video file (`--consent`), or `--archetype documentarian` |
| `music brief\|check\|add\|list` | find, score and add background music; `compose` = original ABC score |
| `narrate` | narration per scene (`--redo <ids>`, `--import-from <dir>`) |
| `assets [scene…]` | search, score, download and cut footage/images |
| `art` / `hf` / `blender` / `prompts`+`images` | huashu-art-motion / HyperFrames / Blender / AI-image scenes |
| `preview` | preview frames + contact sheet |
| `mix` · `review` · `render` · `export` · `check` | mix → pre-render review → cached render → export + publish package → QA |
| `all` | narrate → mix → render → export → check |
| `subtitles` | source-language + English SRT/TXT (`--langs ja,es`) |
| `series new\|run\|assemble` | long YouTube video from episodes |
| `thumbnail [new]` | YouTube thumbnails |
| `channel …` / `social …` | automatic private YouTube channels / posting via your own adapters |
| `studio` | local dashboard at http://127.0.0.1:3901 |

Every command and option: [references/glossary.md](references/glossary.md).

## video.yaml (compact)

```yaml
name: video-name
format: 9x16                 # 9x16 | 16x9 | 1x1
language: en
loudness: -14                # target LUFS
voice: { sample: documentarian, volume: 0.55, speed: 1.08 }
music: { file: <path>, volume: 0.6, duck: true }
style: { kind: footage, subtitle_style: box, title_style: word-rise }
scenes:
  - id: opening
    narration: Spoken line.
    subtitle: On-screen **keyword** line.
    title: Hook title
    search: [{ query: "deep sea anglerfish" }]
publish: { titles: ["…"], hook: "…", tags: [...] }
```

Quote strings that look like numbers (`"2015"`). Full key table: [docs/yaml-reference.md](docs/yaml-reference.md);
English ↔ internal names: [references/glossary.md](references/glossary.md); full example + `film.html` API:
[references/workflow-details.md](references/workflow-details.md).

## Where to read more

| Topic | File |
|---|---|
| Setup protocol, install layout, keys, prerequisites | [references/setup.md](references/setup.md) |
| Full workflow, fix-only-what-broke, cut self-check, project data, film.html, general lessons | [references/workflow-details.md](references/workflow-details.md) |
| Script writing, research, languages | [references/script-and-voice.md](references/script-and-voice.md) |
| Sensitive topics | [references/sensitive-topics.md](references/sensitive-topics.md) |
| Voice cloning, VoiceStudio, narration hygiene, Vietnamese numbers | [references/voice.md](references/voice.md) |
| Music search/check, composing, mixing, SFX, 16:9 sound rules | [references/music.md](references/music.md) |
| Visual styles menu and Step 0 question | [references/styles.md](references/styles.md) |
| Subtitle and title text styles | [references/text-styles.md](references/text-styles.md) |
| Choosing a visual backend | [references/visual-backends.md](references/visual-backends.md) |
| Footage, own files, smart crop, effects, colour grading, `xp clip`, asset lessons | [references/footage.md](references/footage.md) |
| News graphics (HyperFrames), satellite scenes, motion library | [references/news.md](references/news.md) |
| Evidence-film styles | [references/evidence/README.md](references/evidence/README.md) |
| Motion languages and techniques | [references/chuyen-dong/README.md](references/chuyen-dong/README.md) |
| Story films and code-drawn characters | [references/story.md](references/story.md), [references/story/README.md](references/story/README.md) |
| Cartoon characters (puppet.js) | [references/characters.md](references/characters.md) |
| Character AI design loop (`xp cast-design`) | [references/characters-ai-loop.md](references/characters-ai-loop.md) |
| Redraw an illustration (`xp redraw`) | [references/ve-lai.md](references/ve-lai.md) |
| Pose & clip editor (`xp pose-editor`) | [references/dung-dang.md](references/dung-dang.md) |
| Manifesto template | [references/manifesto.md](references/manifesto.md) |
| Series, thumbnails, 3D kit, people, medical — summaries | [references/more-tools.md](references/more-tools.md) |
| Long multi-episode series | [references/long-series.md](references/long-series.md) |
| YouTube thumbnails | [references/thumbnails.md](references/thumbnails.md) |
| 3D quality kit and model library | [references/models3d.md](references/models3d.md) |
| Blender modelling guides | [references/blender/README.md](references/blender/README.md) |
| Medical 3D template | [references/medical3d.md](references/medical3d.md) |
| Quality checks (preview, review, check, independent review) | [references/quality-checks.md](references/quality-checks.md) |
| Publishing package and subtitles | [references/publishing.md](references/publishing.md) |
| Automatic channels, social posting, clean-up, Studio | [references/automation.md](references/automation.md), [references/channels.md](references/channels.md) |
| Viral research | [references/viral-research.md](references/viral-research.md) |
| Performance and render speed | [references/performance.md](references/performance.md) |
| Every command, YAML key, file and tool | [references/glossary.md](references/glossary.md) |
