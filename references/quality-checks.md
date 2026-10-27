# Quality checks

## Before rendering: `xp preview`

By default one frame from the middle of each scene; `--at <seconds>` renders a specific moment. Always also look at:
- frames **in the middle of a transition** (scene t0 + 0.5 s) — blending bugs show here;
- the **brightest** frame (glow, sun, lamps) — easy to blow out;
- the frame **with the most labels** — overlapping labels, covered faces;
- the **first and last** frames — black open/close, title.

Open full frames (`build/thu/NNN.jpg`) when the contact sheet is too small to judge.

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
