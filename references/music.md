# Music and sound

Finding stock music, using the user's file, composing an original score, looping, sound effects and the 16:9
no-music rule.

## Finding background music (offer it before narration)

Pixabay Music has a good commercial-use library but no music API, so: `xp music brief` (in the video folder) writes
`build/music/brief.md` from the script and style (mood keywords, BPM range, length, instrumental only) with Pixabay
Music search links → open them in a browser if your agent can, shortlist 3–5 tracks and **post their track-page links
in chat**; the **user downloads** the ones they like → `xp music check` (scans ~/Downloads from the last 24 h, or pass
files) scores each 0–100: length vs video, loudness, clipping, silent intro, **mid-track drop-outs**, energy steadiness,
BPM, field-recording detection and **sung vocals** (Demucs; vocals clash with narration) → `build/music/listen.html`
(30 s previews, energy chart, best continuous section); `--phone` also makes `NN_<track>_preview.mp4` (score card + 30 s
of the track **mixed under the video's real narration**) to send to the user → user picks →
`xp music add <file> --name bg --start <s> --duration <s> --license "Pixabay Content License · <track URL>" --use` →
`xp timeline` → `xp mix`. Never scrape or auto-download from Pixabay Music; never put tracks with vocals under
narration unless the user insists.

## Background music from a file

Ask for **an audio or video file** (and its licence);
`xp music add <file> --name <name> [--start s --duration s] [--license "…"] [--use]` extracts, trims, normalizes to
−16 LUFS with fades, stores `.mega-shot/music/<name>.mp3`, logs the licence in `MUSIC_LICENSES.md`; `--use` sets
`music.file` in the current `video.yaml`/`loat.yaml`. `xp music list`.

Command: `music add|list|brief|check` (`--start`, `--duration`, `--license`, `--use`, `--phone`).

## Original music per video — `xp compose` (old name `xp nhac`)

Composer from [huashu-motion](https://github.com/alchaincyf/huashu-motion), MIT: write a score for THIS video in ABC
notation (`nhac.abc` in the video folder; `!mark:<scene id>!` at each scene start, `!hit!` on the reveal,
`!rise(! … !rise)!` builds, dynamics `!p! … !f!`, `!fermata!` at the end; voices
`V:<name> inst=<piano|strings|lowstr|pizz|harp|horn|marimba|vibes|flute|guzheng|erhu|dizi|bass|…> role=melody gain=`),
set `music: { score: nhac.abc, volume: 0.3–0.6, duck: true }`, run `xp compose` → `build/nhac_soan.wav` (46
real-instrument sample sets, CC0/CC-BY; ~10 s; tempo bends ≤ 3–5 % so every mark lands on its scene; no network).
`xp mix` uses it automatically. For multi-section scores, generate the ABC from a per-scene chord plan with a small
script so every voice has identical bar lengths (examples: `engine/nhac/vi_du_tao_nhac_tin.py` news bed,
`engine/nhac/vi_du_dong_luc.abc` motivational score). Composed beds have no hiss, unlike many stock tracks. Read
`chuyen-dong/sound.md` + `chuyen-dong/rhythm.md` first.

One-time setup (ask first — downloads):
`git clone --depth 1 https://github.com/alchaincyf/huashu-motion .mega-shot/tham-khao/huashu-motion-src`, then in that
folder `OM_SAMPLES=<project>/.mega-shot/tools/om-samples node cli/om.js samples build` (needs `bsdtar` on PATH — on
Windows copy `C:\Windows\System32\tar.exe` to `.mega-shot/tools/bin/bsdtar.exe`).

## Mixing

`xp mix` mixes voice, music and SFX (old name `am`), adds sound effects automatically (whoosh/boom/riser/tick/ambience —
`sfx`) and snaps scene cuts to the music beat. Defaults: voice 55 % + music 60 % (light ducking; `music.duck: <ratio>`
for more); target loudness `loudness: -14` LUFS.

- **Looping background music:** a track shorter than the video is looped on its beat grid (restart on the first beat of
  the steady groove, cut 2 beats before the last strong beat so the outro is never used, 4-beat crossfade; log "nhạc
  lặp khớp phách"). Explicit `music.from/to` or a composed `music.score` bypass it.
- **Long YouTube videos (16:9) have NO background music** by default — `xp mix` drops `music` for 16:9 unless
  `music.keep: true`. Documentary sound = voice + quiet bed (`sfx.ambience: duoi-nuoc | "tu-nhien:<name>"`,
  `sfx.ambience_level`) + REAL animal/nature sounds placed with scene `sounds:` only when the scene shows them;
  `sfx.auto: false` turns off whoosh/boom/riser/tick.
- Add natural sounds: `xp sfx add <file> --name … --license … --source …` → `.mega-shot/sfx/tu-nhien/` (licence
  logged), use `tu-nhien:<name>`. Legal sources beyond the policy (NOAA, NASA, Freesound CC0…) are fine with the licence
  logged; never rip audio from YouTube/TikTok.
- Sound library: `xp sfx kenney list|add <pack…>|all · sfx add · sfx search · sfx list` — kenney.nl CC0 packs →
  `.mega-shot/sfx/kenney/<pack>/`; natural sounds; use
  `sfx: { replace: { bum, tich, dang, bot, vut: "kenney:<pack>/<file>" } }` and scene
  `sounds: [{ name, at_word | at, level }]`.
