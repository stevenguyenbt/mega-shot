# Narration voice — cloning, VoiceStudio, narration hygiene

Script writing and language rules: `script-and-voice.md`. This file covers voices and the narration engine.

## Voice from the user's file

When the user wants their own (or a permitted) voice, ask for **an audio or video file** with ≥ 15 s of one person
speaking, and **confirm they own the voice or have explicit permission** (consent is mandatory for cloning). Then
`xp voice add <file> --name <name> --consent`: video → audio is extracted, VoiceStudio `/clean-audio` (Demucs) removes
music/noise, Whisper finds the best 6–10 s of continuous speech, the clip + exact transcript become
`.mega-shot/voices/<name>/`, a clone profile is saved in VoiceStudio, and a test sentence (`thu.wav`) is generated and
scored. No file? `xp voice add --archetype documentarian` (built-in English narrators: documentarian, storyteller,
anchor, librarian, calm-guide, explainer, teacher). Use with `voice: { sample: <name> }`. `xp voice list`;
`xp voice check` before using a voice for anything important.

Command: `voice add|list|check` — clone a voice from an audio/video file (`--name`, `--consent`, `--lang`, `--max`,
`--no-app`, `--archetype`).

## `xp narrate` (workflow step 5)

VoiceStudio is started **headless** when not running (`xp voicestudio start|stop|restart|status`; `--gui` opens the
app; log `.mega-shot/voicestudio/backend.log`; the app window is only needed once, after install). Defaults: voice 55 %
+ music 60 % (light ducking; `music.duck: <ratio>` for more), `voice.speed: 1.08`. Dense short-form narration often
feels slow at 1.0 — 1.1–1.2 works well. Word timestamps are stored for karaoke subtitles. **Changing `speed` does not
re-synthesize** (audio and timestamps are time-stretched) — use it to tune total length. On ⚠ warnings fix the sentence
and `xp narrate --redo <id>`. Recorded audio instead of TTS: `xp narrate --import-from <dir>`.

Every line is listened back (local Whisper); a line matching < 0.8 is re-synthesized with up to 3 other seeds and the
best take kept (`voice.retry_below`, `voice.attempts`; raise to 0.9 / 5 for name-heavy scripts). Only changed lines are
re-synthesized (`--redo <id>`). Do not re-check the whole narration with a big Whisper model afterwards — it is slow and
the per-line check already ran. The voice model drops words in comma lists of proper names → one name per short
sentence, or move a long list to its own scene.

## Lessons learned (voice)

- **Voice per language:** use a sample native to the video's language (English: `documentarian`, `storyteller`,
  `anchor`…). Transliterated hyphenated names may be mispronounced → write `narration` the way it should sound and keep
  the standard spelling in `subtitle`; test unusual names before running a whole series.
- **VoiceStudio runs headless:** `xp narrate` / `xp voice add` / `xp music check` start its backend in the background
  (`python -m uvicorn main:app --app-dir backend --port 3900` from the runtime the app installed, with the app's env, so
  voices, profiles and models are shared). All calls are serialized through `.mega-shot/voicestudio.lock`; still run
  series ONE AFTER ANOTHER (one GPU). Hung (port 3900 silent, GPU 0 %): `xp voicestudio restart` (narrate also
  restarts a hung backend itself). Don't open the app window while the headless backend runs (both want port 3900) —
  `xp voicestudio stop` first.
- **Narration speed on small GPUs:** a ~6 GB GPU cannot hold the voice model (~1.9 GB) and Whisper large-v3 together,
  so `xp narrate` only SYNTHESIZES with VoiceStudio; the listen-back and word timestamps run locally (`tools/nghe.py`,
  faster-whisper `small`, CPU int8, ~6 s per 10 s line), and the backend is restarted if the voice model bloats past
  3.5 GB. `MS_ASR=voicestudio` restores the old path; `MS_ASR_MODEL=medium` = more accurate checks (~1.5 GB download).
- **Narration hygiene:** VoiceStudio `denoise` hard-gates pauses (chopped sentence ends), so `xp narrate` sends
  `denoise=false`, applies a mild ffmpeg `afftdn`, drops a stray first word/click, shortens dead air > 0.42 s, and
  re-synthesizes a line whose last syllable is cut. The other cause of "breath"/noise at line ends is a bad clone sample
  (music bed, spliced segments, clipped end): run **`xp voice check`** and never use a flagged voice.
- `voice.num_step: 16` (default; 8 = fast drafts).
- **Numbers in Vietnamese narration** (Vietnamese-language videos only): `xp narrate` passes every line through
  `tools/doc_so.py`, which spells digits the Vietnamese way ("." thousands, "," decimal; e.g. `2.050` → "hai ngàn không
  trăm năm mươi", `17/10/2026` → "mười bảy tháng mười năm…") because the voice model misreads raw digits and dates.
  Options `voice.numbers: { nghin: nghìn|ngàn, linh: linh|lẻ, tu: tư|bốn, phay }`, pronunciation dictionary
  `voice.pronounce: { INSEE: "in xê" }`. Some cloned voices garble "nghìn" or drop a lowercase "phẩy" (decimal comma) —
  the defaults ("ngàn", capitalised "Phẩy") read reliably. Every spoken number is checked on its own; a misread number
  fails the line and other seeds are tried.
