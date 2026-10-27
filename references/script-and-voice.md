# Script and narration voice

## Writing the script (core: research → 4-layer frame → automatic scoring → fact-check)

### Step 1 — Research (mandatory, before writing a single word)
Search the web (reliable sources: scientific agencies, papers, museums, NOAA/NASA, encyclopedias…) and write `nghien_cuu.md` (*research notes*) next to the video:
```
## Facts (10–20, each line with its source)
- The Mariana Trench is ≈ 10,935 m deep — NOAA
## Mechanisms (why / how)
- Pressure rises ~1 atm every 10 m of water because of the weight of the water column above — NOAA
## Relatable comparisons
- 1,086 bar ≈ a car standing on every cm²… (computed — write down the calculation)
## Common misconceptions → what is true
## Open questions
```
The script may ONLY use what is in `nghien_cuu.md`. Every number shown on screen (`chu`, `phu_de`, `nhan`) must appear in that file — the checker verifies it.

### Step 2 — The 4-layer frame for each idea (1 idea = 1–2 scenes, 6–12 seconds)
1. **What** — the fact, with a number.
2. **Why / how** — the mechanism, told like you would to a friend ("because…", "thanks to…", "which makes…").
3. **What it means** — a comparison with everyday life, or the consequence for the viewer.
4. **Hook to the next idea** — a sentence that opens a loop ("But the strangest part lies even deeper…").

Weak (a list): "The Mariana Trench is almost eleven thousand meters deep. The pressure is a thousand times higher."
Strong (4 layers): "The Mariana Trench is almost eleven thousand meters deep. Every ten meters of water adds one more atmosphere, because the whole column presses down. At the bottom, each fingertip carries the weight of a car. And yet something lives there — how?"

### Short video structure, 75–100 s (TikTok/Reels)
- **0–1.5 s:** strongest shot + title visible from frame 0 + a boom (automatic). Opening sentence ≤ 18 words: a paradox, a number or a question.
- **Every 8–10 s:** a question → reveal → surprise loop. Mark reveal scenes with `tiet_lo: true` (riser before the scene).
- **Around 40% in:** a retention line ("and the strangest part is still to come").
- **Ending:** the most surprising answer + a question that invites comments; the last line can loop back to the first shot.
- **Density:** narration covers ≥ 85% of the duration, ≥ 1 new idea per 10 s, ≥ 40% of scenes have a "why" layer, ≥ 3 retention hooks.

### Step 3 — Automatic scoring: `xp check script` (before `xp narrate`)
Reports: estimated duration, voice coverage, depth, density, hooks, sentences > 28 words, big numbers without a comparison, repeated words, numbers missing from `nghien_cuu.md`. Works for Vietnamese and English (English word lists, proper nouns skipped in the repetition count; series episodes only need a closing question when `tap_cuoi: true`).
Below 8/10, fix the script first — fixing after the voice is generated is the most expensive path.

### Step 4 — Independent fact-check
Another agent compares the script with `nghien_cuu.md` and the original sources, listing wrong or overstated claims. Fix everything before generating the voice.

### Wording rules
- **Two text layers:** `loi` = text for the voice (numbers as words: "two thousand five hundred"); `phu_de` = displayed text (digits, `**keyword**` highlighted, `|` = line break).
- **Foreign/transliterated names:** spell them the way the voice pronounces correctly when it gets them wrong (Vietnamese-language example: write "Giu Đa" instead of the hyphenated "Giu-đa" for Judas); keep the standard spelling on labels and subtitles.
- **Sentences ≤ 28 words**, ideally 10–20; strong verbs; never open with "Today we are going to…".
- **Ideas from books:** paraphrase, no long quotes, credit the book at the end.

## Multiple languages

`ngon_ngu` (*language*) in video.yaml (vi, en, zh, ja, ko, fr, es, th, id…) drives:
- the voice (VoiceStudio receives the language name; pick a voice sample native to that language — see below);
- recognition checks (Whisper);
- subtitle wrapping (zh/ja/th wrap by character, others by word);
- sentence splitting, including East-Asian punctuation (。，、？！).

The default font falls back to Noto Sans CJK/Thai; install fonts if the machine lacks them.

## Narration voice

- Voice samples: `.mega-shot/voices/<sample>/ref.wav` + `ref.txt`. **Sample ≤ 10 s, transcript must match the audio exactly.** A long (32 s) sample made the voice insert stray phrases at the start of lines — a bug we hit.
- **Clone from the user's own file:** `xp voice add <audio-or-video> --name <name> --consent` (Demucs vocal isolation via VoiceStudio, automatic best 6–10 s segment, exact transcript, VoiceStudio clone profile, test sentence with a match score). Only with the user's confirmation that they own the voice or have explicit permission. A clean source (one speaker, no music over speech, no echo) clones best; a test match < 80% means try another source.
- **Use a sample native to the video's language.** A Vietnamese sample cloned into English gives an accent (and vice versa). English samples: `documentarian` (American, low, documentary — default for English), `storyteller` (British, elderly), `anchor` (American newsreader). They come from VoiceStudio's built-in archetype previews (`/archetypes/<id>/preview` + its `sample_script` as `ref.txt`).
- A fixed `seed` keeps the voice stable across lines; only a cloned sample keeps the same person.
- `xp narrate` caches audio by hash (text + language + sample) and only regenerates changed lines. `--redo <id>` forces regeneration.
- Warnings *match below 70%* or *inserted words at the start* (Vietnamese log text: "khớp < 70%", "chèn chữ đầu"): listen again; often Whisper just mishears a proper noun or writes digits/English spellings (the checker also compares against `phu_de`).
- Levels: voice 55%, background music 60% for shorts (series: voice 65%, music 35%), light auto-ducking (ratio 2.5; `tu_ha: 4` = stronger, `tu_ha: false` = off), automatic SFX (`sfx`), master normalized to −14 LUFS (`do_to`).
- Speed: `giong.toc_do: 1.08` (8% faster, pitch preserved). Pacing: 0.15 s gap, 0.25 s pause, scene boundaries snap to the music beat.
- VoiceStudio calls are serialized by a lock file; run long series one after another.
