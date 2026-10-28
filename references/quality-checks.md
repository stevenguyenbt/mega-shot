# Quality checks

## Before rendering: `xp preview`

By default one frame from the middle of each scene; `--at <seconds>` renders a specific moment. Always also look at:
- frames **in the middle of a transition** (scene t0 + 0.5 s) — blending bugs show here;
- the **brightest** frame (glow, sun, lamps) — easy to blow out;
- the frame **with the most labels** — overlapping labels, covered faces;
- the **first and last** frames — black open/close, title.

Open full frames (`build/thu/NNN.jpg`) when the contact sheet is too small to judge.

## Before rendering: `xp review`

Besides dropped words, subtitle mismatches and text past the frame edge, `xp review` measures two things on the real page. Both are adapted from chaojifeng-video-design (MIT): its "前三秒" first-three-seconds rule and its explainer timing audit.

| Check | Threshold | Fix |
|---|---|---|
| Voice starts | ≤ 0.6 s | lower the opening `dem`, start on the hook line |
| First sentence finished | ≤ 3.5 s | split the opening sentence; put the curiosity first |
| Frame at 0.2 s | not black or empty (luma ≥ 4%, contrast ≥ 0.02) | open on the subject, not on black |
| Text on screen by 1 s | any text | add a hook title `chu` |
| Picture change 0 → 3 s | 16×16 luma difference ≥ 0.015 | motion or a cut in the first 3 s |
| Reading time of titles/labels/graphics (not the karaoke subtitle, ≥ 3 words) | shown ≥ 80% of 0.6 s + words ÷ rate (vi 3.2, en 3.0, zh/ja 6 chars/s) | `chu_giu`, `luc`, or fewer words |

Opening frames: `build/soat/mo_dau_0s.jpg`, `mo_dau_1s.jpg`, `mo_dau_3s.jpg`. Report: `build/soat/bao_cao.md` and `bao_cao.json`. Counters and years are skipped because they animate on purpose. Typewriter reveals count as one text. `--skip-read` skips the reading-time scan (it samples every 0.25 s, 0.5 s for videos over 2 minutes).

## After export: `xp check`

| Check | Threshold | Fix |
|---|---|---|
| Duration matches the timeline | ±0.2 s | render again |
| Size | phone preview < 29 MB | `xp export` compresses it automatically |
| Loudness | −16…−12 LUFS | `xp mix` already normalizes to −14 |
| Too dark / blown-out frames | luma < 4% / > 25% clipped | lower bloom/exposure |
| Static picture | ≥ 4 s | add Ken Burns or background motion |
| Voice | match ≥ 70%, no inserted words | fix the sentence, `xp narrate --redo` |
| Upload bitrate | ≥ 8 Mbps at 1080×1920 | `xp export` (CRF 17) — never shrink the upload file to 30 MB |
| One picture held per scene | ≤ 4 s for video (≤ 6.5 s for 2.5D/graphics/stills that get multi-angle shots) | more clips: `tim: [{q…}, {q…}]` |
| Text on the first frame | the first scene has a `chu` | add a hook title |
| Sound in the first second | an SFX hit | keep `sfx` on (default) |
| Voice coverage | ≥ 85% of the duration | denser script, shorter `nhip` |

## Before generating voice: `xp check script`

Score the script ≥ 8/10 (depth, comparisons, hooks, density, sources) + an independent agent fact-checks against `nghien_cuu.md`.
Errors caught by this step: "at 200 m it is almost completely dark" (wrong — blue light remains), "zooplankton produce oxygen" (it is *phyto*plankton), the 2024 "dark oxygen" study stated as fact (strongly disputed), and in a history series 22 issues (dates, hedging, balance) fixed before recording.

## Image sharpness

- 1080p landscape footage cropped to vertical = 1.78× upscale → soft. `xp assets` prints the upscale factor per clip (Vietnamese log text `phóng N×`) — avoid > 1.4×.
- Small stills: warning when upscaling > 1.6×.
- Frames extracted with Lanczos at 1.2× + light sharpening; canvas draws with `imageSmoothingQuality = 'high'`.

## Independent review

Before delivery, an agent that did not make the video watches `out/*.mp4` (extracted frames + transcript), scores it and lists issues with timestamps. The maker never grades their own work. For long series, run a second review after fixes.

The reviewer fills **`build/duyet_phim.md`** (written by `xp check`). It asks the director's six questions, adapted from chaojifeng-video-design's review method. Each is scored separately; one overall number would hide a failed dimension.

| # | Dimension | What fails |
|---|---|---|
| 1 | Sound | voice buried, SFX off the moment, clipped first or last word (judge by **listening**, not by LUFS or match %) |
| 2 | Picture | subject unclear, unreadable/covered/overflowing text, black/burnt/jumping frames at cuts |
| 3 | Look | font, colour, material, light or motion inconsistent with `phong_cach` and the channel (give the reason) |
| 4 | Pacing | no build → push → hit → rest; text too short to read; fast/loud mistaken for rhythm |
| 5 | Story | no hook in 3 s, scenes adding nothing new, no "why", flat ending (retell the video in 2 sentences) |
| 6 | Accuracy | numbers, names or dates not matching `nghien_cuu.md`; graphics wrong in scale or meaning; effects hiding evidence |

Rules:
- Every score cites what was actually watched or heard (time ranges). An unwatched or unheard dimension is `not reviewed`, never a pass.
- Automatic warnings are hints, not evidence.
- Pass = every dimension ≥ 7 and average ≥ 8.
- Fix only what failed, then re-check what that fix touches (voice change → timing/subtitles/mix; number change → source + graphic).
