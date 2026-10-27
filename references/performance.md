# Performance — where the time goes and how it was cut

Reference numbers from a mid-range desktop (6-core/16-thread CPU, entry-level NVIDIA GPU with 6 GB VRAM, Windows 11). Reference job: a 15-minute history series (≈ 60 narration lines, ≈ 28,000 frames, ≈ 60 archival stills). Your numbers will differ; the ratios are what matter.

## Current timings

| Stage | Before | Now | How |
|---|---|---|---|
| Render (`xp render`, all episodes) | ~29 min (16 fps) | **~8.5 min (52–67 fps)** | In-browser hardware H.264 via WebCodecs (see below) |
| Assemble + preview (`xp series assemble`) | ~20 min | **~5–7 min** | Episodes and cards are joined as raw H.264 bytes (no re-encode); preview uses x264 `veryfast` |
| Single-video export (`xp export`) | x264 `slow` re-encode | **stream copy** | The WebCodecs master (~30 Mbps) is already upload quality |
| Narration (`xp narrate`, per line) | ~57 s | **~15–20 s** | `voice.num_step: 16` (default) — generation 15 s → 11 s; the listen-back moved from VoiceStudio's Whisper large-v3 to local faster-whisper `small` on the CPU (`tools/nghe.py`, ~6 s per 10 s line) |
| 2.5D layers (BiRefNet, per still) | ~34 s on CPU | unchanged | see "Still open" |

## Why rendering was slow

Drawing a frame on the canvas takes only **~2.6 ms**. The old path then spent **~44 ms on `toDataURL('image/jpeg')`**, ~10 ms on base64 transfer to Python, then decoded the JPEG and re-encoded with x264 → ~16 fps. Running several browsers in parallel did not help (2 workers 1.8×, 4+ workers slower: they contend for the same GPU read-back).

`encode_frames()` in `tools/xp.py` now creates a WebCodecs `VideoEncoder` (`avc1.640033`, 30 Mbps, keyframe every 2 s, Annex-B, `prefer-hardware` → `prefer-software` fallback), feeds it `VideoFrame(canvas)` and pulls encoded bytes back once per second of video. Quality vs the old JPEG path: PSNR ≈ 40 dB, SSIM ≈ 0.97 — visually identical. If WebCodecs is unavailable the old JPEG → x264 path is used automatically; force it with `MS_ENCODER=x264`.

Each render writes `build/raw.mp4` plus a sidecar `build/raw.h264`. Because every part shares codec, size and fps and starts on a keyframe with SPS/PPS, `xp series assemble` concatenates the sidecars byte-for-byte and muxes the series audio — no re-encode. If any part lacks a fresh sidecar, assembly falls back to the filter + x264 (`medium`) path.

**Pitfall:** never combine a raw `.h264` input with `-shortest` in ffmpeg — it silently drops the audio stream (no timestamps). Cut with `-t <seconds>` instead.

## Narration timing breakdown (per line, 6 GB GPU)

| Call | Time for 8 s of audio |
|---|---|
| `/generate` cold (first call) | 31 s |
| `/generate` warm, default steps | 15 s |
| `/generate` `num_step=16` | 11 s (chosen default — quality approved by ear) |
| `/generate` `num_step=8` | 5.6 s (audibly close; good for drafts) |
| `/v1/audio/transcriptions` (Whisper large-v3, word timestamps) | **36–52 s** |

With VoiceStudio's transcription, transcription was ~70 % of narration time (it provides word timestamps for karaoke subtitles and the match check). On a 6 GB GPU the voice model and Whisper large-v3 also could not stay loaded together, so every check swapped models. `xp narrate` therefore only synthesizes with VoiceStudio and transcribes locally with faster-whisper on the CPU; `MS_ASR=voicestudio` restores the old path, `MS_ASR_MODEL=medium` gives more accurate checks (~1.5 GB download).

## Still open (not enabled — each needs a download or a decision by the user)

1. **Overlap** the local transcription of one line with the GPU generation of the next.
2. **BiRefNet on the GPU** (onnxruntime-gpu, ~0.5 s per image) run while VoiceStudio is idle, or 2.5D only for stills that really need parallax: ~35 min → ~3–5 min on a fresh series. Needs ~0.6–1 GB.
3. **NVIDIA driver ≥ 610** enables NVENC in ffmpeg (older drivers are rejected with "Required: 13.1 Found: 13.0"). Would speed up the remaining x264 encodes (preview, fallbacks).
4. **Pipeline overlap:** generate narration for all episodes on the GPU while the CPU searches assets and builds 2.5D layers; render an episode as soon as its voice is done.
5. **Process:** approve visuals from `xp preview` contact sheets and fact-check the script BEFORE generating voice and rendering; after a fix, re-render only the affected episode (`xp series run --only tap-0N --steps render`).

Benchmarks to re-run after changes: `xp render` prints fps and encoder mode; `xp narrate` prints per-line timings.
