# Getting started

This walks through a real-footage short (9:16) from an empty folder. With Claude Code you can simply ask
*"make a 60-second vertical video about why octopuses have three hearts, real footage style"* — the AI runs these steps
and asks you at each decision. Below is what happens, so you can also do it by hand.

## 0. Setup (once per machine / project)

```bash
mkdir my-videos && cd my-videos
xp setup                                   # read NEEDS YOUR INPUT
xp setup --install chromium,fonts,voicestudio
xp setup --policy                          # allow licensed auto-downloads (Pixabay, Pexels, NASA, Poly Haven, ambientCG; ≤ 1 GB/video)
cp ~/.claude/skills/mega-shot/.env.example .env   # add PIXABAY_API_KEY (free)
xp voice add --archetype documentarian     # built-in English narrator (or: xp voice add me.mp4 --name me --consent)
```

## 1. Choose a style and create the video

Look at `references/style-gallery.jpg` (12 families) and `references/text-styles/` (subtitle/title animations).

```bash
xp new octopus --format 9x16 --template footage
cd videos/octopus
```

## 2. Research, then script

Write `nghien_cuu.md` (research notes): 10–20 sourced facts, mechanisms, comparisons, misconceptions.
Then edit `video.yaml` — every scene: **what → why/how → what it means → hook to the next scene**.

```yaml
scenes:
  - id: hook
    search: [{ query: "octopus swimming reef" }, { query: "octopus close up eye" }]
    title: 3 HEARTS
    narration: An octopus has three hearts, and one of them stops every time it swims.
    subtitle: An octopus has **3 hearts** — and one stops when it swims.
```

`narration` is spoken (write numbers as words if your voice misreads digits); `subtitle` is displayed (`**word**`
highlights, `|` forces a line break). Add the `publish` block (titles, hook, tags) — see `references/publishing.md`.

```bash
xp check script        # aim for ≥ 8/10; then have someone (or a second AI agent) fact-check against nghien_cuu.md
```

## 3. Voice, footage, review

```bash
xp narrate             # every line is listened back; bad takes are regenerated
xp assets              # look at build/tim/<scene>_phuong_an.jpg — pin a better option with  search: { …, pick: <id> }
xp review              # dropped words, subtitle ≠ speech, text off-frame → fix before rendering
xp preview             # build/thu.jpg
```

Fix a line → `xp narrate --redo <scene>` re-generates only that line.

## 4. Music, render, export

```bash
xp music brief                                       # what to look for + Pixabay Music links
xp music add ~/Downloads/track.mp3 --name bg --license "Pixabay Content License · <url>" --use
xp mix && xp render && xp export && xp check
xp thumbnail new && xp thumbnail                     # YouTube thumbnails
```

You get `out/octopus_9x16.mp4`, a phone preview, `out/youtube_dang_bai.md` (titles, description, tags, credits),
`out/dang_bai_mxh.md` (TikTok/Reels caption) and `out/subtitles/` (SRT + TXT; English is always produced — for a
non-English video translate `en.todo.json` → `en.json` and run `xp subtitles`).

Changed one scene? `xp render` re-renders only that scene (and the next one, for its transition).

## Long YouTube videos

```bash
xp series new rome --episodes 5 --format 16x9 --template footage
# write each tap-NN/video.yaml (the last line of each episode hooks into the next)
xp series run && xp series assemble        # → out/rome_youtube.mp4 + chapters + SRT + description
```

## Other styles

`--template blank` (your own Canvas drawing), `threejs`, `blender`, `ai-image`, `manifesto`, `medical`, `news`,
`philosophy`; drawn styles with `huashu:` scenes + `xp art` (needs `xp setup --install huashu`). See
[SKILL.md](../SKILL.md) and `references/styles.md`.
