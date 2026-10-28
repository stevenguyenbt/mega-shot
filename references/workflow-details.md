# Workflow details

The full version of the workflow summarised in `SKILL.md`. Footage-specific steps live in `footage.md`, voice in
`voice.md`, music and sound in `music.md`.

## Layout and naming

One video = a folder `videos/<name>/` with `video.yaml` (script + settings) and `film.html` (how each scene is drawn).
The framework handles narration, timing, subtitles, transitions, post-processing, mixing, export and QA.

The skill folder is wherever your agent installs skills (for example `~/.claude/skills/mega-shot` for Claude Code, or a
project-level skills folder; other agents use their own skills directory). Run the CLI from the **user's project
folder**, never from inside the skill folder: `<skill>/xp …` (bash/zsh) or `<skill>\xp.cmd …` (Windows); in these docs
it is just `xp`. Project data lives in `<project>/.mega-shot/`, videos in `<project>/videos/`. Requires `uv` and
`ffmpeg`. Engine regression tests: `tests/kiem_thu.py`.

**Naming note.** The engine was built in Vietnamese. Commands have English names (old Vietnamese names still work), and
every YAML key has an English name (`scenes`, `narration`, `subtitle`, `voice`, …) that is translated to the internal
Vietnamese key (`canh`, `loi`, `phu_de`, `giong`, …) when the file is read — both work and can be mixed; if a block has
both, the Vietnamese one wins. Full table: `python <skill>/tools/yaml_keys.py --markdown`. Inside `film.html`,
`c.data.<key>` always uses the **internal** names. Keys without an English name (e.g. `hf`, `ve_tinh`, `yk`, thumbnail
keys) are written as shown. File names (`nghien_cuu.md`, `giay_phep.json`, …) stay Vietnamese — see `glossary.md`.

## Start here — `xp setup`

**Always run `xp setup` first** (new session or new machine, a few seconds). It checks uv, FFmpeg, Chromium, the GPU
encoder, VoiceStudio (starts its backend headless — no window — if installed but not running), voice samples, API keys,
the download policy, models, fonts and the optional huashu-art-motion skill, and prints **NEEDS YOUR INPUT**. Before
doing anything else, ask the user about every listed item (approve downloads with size + licence, decide the download
policy, provide keys/voice samples) — then run `xp setup --install <ids>` / `xp setup --policy` only for what they
approved. Never download or install without approval; never print keys. API keys come from environment variables,
`<project>/.env` (template `.env.example` in the skill folder) or the legacy `.mega-shot/keys.env`; tell the user where
to put them, never ask them to paste keys into chat. Details: `setup.md`.

## Optional — viral research (offer it, never force it)

When the user gives a topic, **offer** (one question: "Run viral research first? ≈ 3–5 min") to study what already goes
viral. If yes: `xp viral "<topic>" [--q "alt query|English query"] [--format short|long]` → ranks top YouTube videos by
viral score (views ÷ subscribers, views/day, engagement) via the official API (metadata only; free `YOUTUBE_API_KEY`,
otherwise search the web and open pages if your agent can), then **watch the top 3–5 (plus 2–3 TikToks) in a browser if
your agent can — view only, pause and mute when done**, fill `viral_phan_tich.md` (hook 0–3 s, pacing, on-screen text,
structure, ending, title formula), extract 3–5 viral factors and propose 2–3 directions. Inspiration, not imitation:
never download or reuse others' video/audio/thumbnails/script text. `viral-research.md`.

## Step 0 — choose the visual style (always ask)

Before research or script, **ask the user which visual style they want** — never decide silently. Send/show
`references/style-gallery.jpg` (12 labelled examples) and ask (one question per decision; use your agent's
question/choice tool if it has one): family first (real images / drawn 2D / 3D / art style & AI images), then the exact
look, recommending one for the topic. Styles: real footage & archival images, 2.5D parallax stills, sketch/whiteboard,
stick-figure story, flat 2D (Kurzgesagt-like), Vox collage, kinetic typography, 3Blue1Brown math, keynote UI, finance
charts, 35 painterly art styles (huashu-art-motion), Three.js 3D, Blender photoreal, AI images, custom canvas — or mixed
per scene. Record it as `style: { kind: <id>, huashu: <grammar or art style> }`. Drawn styles come from the companion
skill **huashu-art-motion** (`xp setup --install huashu` clones it into `vendor/`, or install it as a sibling skill):
put `huashu: { grammar: …, cues: [...] }` on a scene and run `xp art` after `xp narrate` (cues can land on a spoken word
with `at_word`). Full menu, topic → style table and examples: `styles.md`.

**Cartoon characters (optional):** code-drawn characters with poses, expressions and lip-sync from the narration
(`engine/core/puppet.js`). The user can give a reference image of their own character → write a spec from it. Previews
`references/characters/demo-*.gif`, guide `characters.md`, `xp character demo`.

**Text animation (same question round):** also send/show `references/text-styles/overview-subtitles.gif` (7 subtitle
styles) and `overview-titles.gif` (8 title styles), recommend a pairing. Record as
`style: { subtitle_style: <id>, title_style: <id> }` (scene override `title_style:`), then `xp timeline`.
Springs/interpolation like Remotion, driven by word timestamps. `text-styles.md`; regenerate previews: `xp text-styles`.

## Workflow (in this order)

1. **`xp new <name> --format 9x16 --template <template>`** — templates: `footage` (real footage/archival images,
   recommended), `blank` (Canvas 2D), `threejs`, `blender`, `ai-image`, `manifesto` (photocopy-halftone cut-outs, red 3D
   block words slammed in on the spoken word — `manifesto.md`), `medical` ("what happens inside your body when…" 3D —
   `medical3d.md`), `news` (HyperFrames graphics — `news.md`), `story` (2D story films — `story.md`,
   `story/README.md`), `philosophy` (3D sets + quote cards). Old names: `trong`, `anh-ai`, `tuyen-ngon`, `y-khoa`,
   `tin-tuc`, `truyen`, `triet-ly`.
2. **Research → `nghien_cuu.md`** (*research notes*, mandatory): 10–20 sourced facts, mechanisms (why/how), relatable
   comparisons, common misconceptions, open questions. Read `script-and-voice.md`.
3. **4-layer script** in `video.yaml` (what → why/how → what it means → hook to the next idea). `narration` = spoken
   text, `subtitle` = on-screen text (digits, `**keyword**` highlighting, `|` manual line break). Sensitive topics:
   `sensitive-topics.md`. **Also write the `publish` block** (title options, hook, topics, drama, trust line, tags,
   caption) — `publishing.md`.
4. **`xp check script`** → revise until ≥ 8/10. Then an **independent fact-check** of the script against
   `nghien_cuu.md` and the original sources (if you can run a second agent or reviewer, have it fact-check
   independently; otherwise do a separate careful pass yourself) — fix everything before generating voice.
5. **`xp narrate`** — VoiceStudio is started **headless** when not running (`xp voicestudio start|stop|restart|status`;
   the app window is only needed once, after install). Defaults: voice 55 % + music 60 % (light ducking;
   `music.duck: <ratio>` for more), `voice.speed: 1.08`. Dense short-form narration often feels slow at 1.0 — 1.1–1.2
   works well. Word timestamps are stored for karaoke subtitles. **Changing `speed` does not re-synthesize** (audio and
   timestamps are time-stretched) — use it to tune total length. On ⚠ warnings fix the sentence and
   `xp narrate --redo <id>`. More: `voice.md`.
6. **Visuals** — choose a backend with `visual-backends.md`. Real footage / archival images, the user's own files,
   AI images, Blender, single assets and smart crop: `footage.md`.
7. **Effects** (built into the footage template, kept subtle): transitions, overlays, graphics, 3D ocean cross-section,
   depth gauge, reveal, filter… — full list in `footage.md`.
8. **`xp preview`** → look at (open) `build/thu.jpg` and frames mid-transition. `quality-checks.md`.
9. **`xp mix` → `xp review` → `xp render` → `xp export` → `xp check`** (details in "Fix only what broke" below). `mix`
   adds sound effects automatically (whoosh/boom/riser/tick/ambience — `sfx`) and snaps scene cuts to the music beat.
   `export` writes a **high-quality upload file** (CRF 17, no size limit) plus a **preview under 29 MB** for phones,
   then runs **`xp publish`**: `out/youtube_dang_bai.md` (titles, description ≤ 5,000 chars, tags, hashtags,
   pinned-comment credits, thumbnails, limit checks) and, for vertical videos, `out/dang_bai_mxh.md` (TikTok/Reels
   caption + Shorts title). `xp check` also writes **`build/duyet_phim.md`**, the director's six-question sheet (sound,
   picture, look, pacing, story, accuracy). An independent reviewer that did not make the video fills it (a second
   agent if you can run one; otherwise a separate careful pass yourself): each dimension scored separately with what
   was actually watched/heard as evidence; anything not really watched or heard is `not reviewed`, which is not a pass.
   Pass = every dimension ≥ 7 and average ≥ 8 (`quality-checks.md`). When the video is done, paste the caption,
   hashtags and title into chat so the user can copy them.
10. **English subtitles — ALWAYS, for every YouTube video (long, series or Shorts).** `export` and `series assemble` run
    **`xp subtitles`**: sentence-level captions in the source language → `out/subtitles/<name>.<lang>.srt` + `.txt`. If
    the video is not in English it also writes `out/subtitles/en.todo.json`; **you (the agent) translate it** — copy to
    `en.json`, replace every value with a faithful, natural English subtitle (same ids, nothing merged/split, keep
    hedges, standard English spelling of names/places, digits for numbers, keep `_cues_sha`) — and run `xp subtitles`
    again → `<name>.en.srt` + `<name>.en.txt` + `out/phu-de-<n>-ngon-ngu.zip`, listed in `youtube_dang_bai.md`. Never
    deliver a YouTube video without the English SRT. Re-narrated/re-timed video → the old translation is stale
    (`_cues_sha`) → translate again. Long cues are split automatically (≤ 2 lines × 42 chars). More languages:
    `xp subtitles --langs ja,es` (same `<lang>.todo.json` → `<lang>.json` flow).

## Fix only what broke (required; essential for long videos)

1. `xp narrate` — every line is listened back (local Whisper); a line matching < 0.8 is re-synthesized with up to 3
   other seeds and the best take kept (`voice.retry_below`, `voice.attempts`; raise to 0.9 / 5 for name-heavy scripts).
   Only changed lines are re-synthesized (`--redo <id>`). Do not re-check the whole narration with a big Whisper model
   afterwards — it is slow and the per-line check already ran.
2. `xp assets` (+ automatic colour matching) → **`xp review`** (seconds): dropped/garbled words per line (listen-back vs
   `narration`, number formatting ignored), `subtitle` text that says something different from the speech, and
   on-screen text drawn past the frame edge. It also checks **the first 3 seconds** (voice starts ≤ 0.6 s, first
   sentence done by ~3.5 s, the frame at 0.2 s not black/empty, text on screen by 1 s, picture changes by 3 s — frames
   in `build/soat/mo_dau_*.jpg`) and the **reading time** of on-screen text other than the karaoke subtitle (titles,
   labels, graphics: shown ≥ 0.6 s + words ÷ ~3/s; sampled every 0.25 s, `--skip-read` skips it). Report:
   `build/soat/bao_cao.md` + `.json`. It cannot see text burned into source footage — look at preview frames for that.
   **Fix everything it lists before rendering.** The voice model drops words in comma lists of proper names → one name
   per short sentence, or move a long list to its own scene.
3. `xp render` renders PER SCENE into `build/doan/` and joins the H.264 segments without re-encoding (identical to a
   single pass: same frame count, PSNR ≈ 46 dB). A scene is reused when its own data/duration/subtitles/assets, the
   previous scene (its tail shows in this scene's incoming transition), film.html and the engine are unchanged → fixing
   one scene re-renders it + the next one. `--scene <id>` forces a scene, `--full` = single pass. Videos with a running
   timeline/depth bar (`year`, `depth`) also key on the scene start time.
4. `xp export` → `xp check` → fix → `xp render` (only changed scenes) → **at most 3 passes**, then report what is left.

**Cut self-check:** `xp check` inspects ±1.5 s around every scene change and in-scene cut of the FINAL video
(`tools/kiemcat.py`): single-frame flash, short black dip (a cut INTO a dark scene is fine), frozen picture after a cut,
clipping, and clicks in the VOICE stem `build/giong.wav` (SFX ticks and beats on cuts are intended, not flagged). It
draws filmstrip + waveform per cut → **always open `build/kiem_cat/tong.jpg`** (flagged cuts first) and also look for
what it cannot see (overlay hiding subtitles, title overflowing). You cannot listen: report audio findings as numbers.
`xp check` also listens to the END of the export and warns if the closing sentence is cut; the last scene always gets
≥ 1.5 s after the last word (`pacing.tail`).

## Project data — `<project>/.mega-shot/`

- `voices/<sample>/ref.wav` + `ref.txt`: voice sample ≤ 10 s with an exact transcript.
- `music/`, `sfx/` (Kenney packs, `tu-nhien/` natural sounds), `assets/` + `GIAY_PHEP.md` (licence/credit log for
  publishing).
- `models/` (BiRefNet for cut-outs), `fonts/` (Be Vietnam Pro, Oswald), `models3d/` (your 3D library), `tools/`
  (portable Blender — xp finds it, or set `MS_BLENDER` —, HyperFrames, instrument samples).
- `chinh_sach.json`: auto-download policy (allowed sources, licences, MB limit per video). `keys.env`: legacy key file
  (prefer `<project>/.env`). `youtube/`: OAuth client + per-channel tokens. Never print or share any of these secrets.

## video.yaml (full example)

```yaml
name: video-name           # ten
format: 9x16               # khung: 9x16 | 16x9 | 1x1 → safe areas, font sizes, subtitle position
language: en               # ngon_ngu: any language; zh/ja/th wrap by character
loudness: -14              # do_to: target LUFS
voice: { sample: documentarian, volume: 0.55, speed: 1.08, seed: 1234 }   # giong: { mau, am_luong, toc_do, seed }
music: { file: <path>, volume: 0.6, duck: true }    # nhac: loops on its beat grid if shorter than the video; from/to = use only those seconds
style: { kind: footage, subtitle_style: box, title_style: word-rise }      # phong_cach
scenes:                    # canh
  - id: opening
    narration: Spoken line.            # loi — numbers may be digits or words
    subtitle: On-screen **keyword** line.   # phu_de
    title: Hook title                  # chu
    search: [{ query: "deep sea anglerfish" }]   # tim: [{ q }]
    # optional: gap/pause/extra (seconds), transition: fade|cut|tu-xu-ly, transition_length,
    # blender: canh/x.py, image: { file: "…", description }, and any custom key (read in film.html via c.data.<internal key>)
publish: { titles: ["…"], hook: "…", tags: [...] }  # dang_bai
```

Strings that look like numbers (`10_1980`, `2015`) must be quoted. Every key: `glossary.md` and
`../docs/yaml-reference.md`.

## film.html

```html
<script src="/ms/core/util.js"></script><script src="/ms/core/overlay.js"></script><script src="/ms/core/film.js"></script>
<!-- per backend: /ms/core/layers.js (image sequences) · /ms/core/stills.js (stills, shots) · module /ms/backends/three/ms3d.js -->
<script>
MS.film({ scenes: { '<id>': { draw(x, c) { … } }, '*': { … } }, overlay(x, c) { … }, prepare: async TL => { … } });
</script>
```

`c`: `t`, `lt` (local time), `D` (scene duration), `q` (0→1 during the incoming transition), `vt`/`vdur` (seconds since
the line started, line duration), `data` (the scene's YAML keys, internal names: `c.data.chu`, `c.data.loi`…), `prev`,
`W`, `H`.
Library: `MS.subtitle · header · tag · chip · words · grain · vignette · topShade · letterbox · wrap · seq · still · still25 · shots · morph · at · img`.
Labels synced to narration: `MS.tag(x, text, ax, ay, (c.vt - c.vdur * 0.4) / .5, { slot: k, warn })`.

## Lessons learned (general)

Footage-specific lessons: `footage.md`. Voice: `voice.md`. Music/sound: `music.md`.

- Visuals must always move a little (the checker flags stills ≥ 4 s).
- Text on bright backgrounds: `MS.header` with a backing, or `topShade: true`. Several labels in one scene: `slot` 0, 1,
  2 so they never overlap.
- Glow blows out easily; glossy floors mirror the HDRI as grey patches — check the brightest frame.
- 3D: rotate bones with `reach/aimBone`, never by adding Euler angles. Blender: far enough `clip_end`, sun from the
  side. Before modelling (characters, props, scenery), read 1–3 guides from the table in `blender/README.md`, build
  with the `msb_lib` kit, and look at a draft render before the final.
- **Never squeeze the upload file into 30 MB** (1.9 Mbps at 1080×1920 = blocky). Upload the high-quality file; send
  `_xem_thu.mp4` to phones.
- Narration must be dense and deep (≥ 40 % of scenes explain "why", every big number gets a comparison).
- Subtitles live in the lower area (never centred on screen), except the story/medical `giua` style.
- **Render speed:** `xp render` encodes H.264 in the browser (WebCodecs, ~55 fps with a GPU) and keeps a `.h264`
  sidecar so `xp series assemble` joins episodes and `xp export` stream-copies; fallback JPEG→x264 automatically
  (`MS_ENCODER=x264` forces it). `voice.num_step: 16` (default; 8 = fast drafts). Never use ffmpeg `-shortest` with raw
  `.h264` input (drops audio). `performance.md`.
- A numeric title (`title: 1099`) is coerced to a string; titles over busy backgrounds get a dark box by default
  (`title_box: false` disables it) and fade out after ~6.5 s (`title_hold: <seconds>`).
- **Platform length limits:** Facebook Reels via API take ~90 s, TikTok keeps longer videos — post long vertical videos
  to Facebook as a normal page video (your adapter decides; `xp social` passes the duration).
