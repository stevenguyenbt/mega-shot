# Third-party notices

mega-shot's own code and documentation are released under the licence in [`LICENSE`](LICENSE).
This file lists third-party material that is **bundled** in this repository, and the main third-party software that
mega-shot **downloads or calls at run time** (not bundled — each keeps its own licence).

## Bundled in this repository

| Path | Origin | Licence |
|---|---|---|
| `references/chuyen-dong/` (motion library: languages, techniques, sound, rhythm) | [alchaincyf/huashu-motion](https://github.com/alchaincyf/huashu-motion), © 2026 Huashu | MIT — [`references/chuyen-dong/LICENSE-huashu-motion.txt`](references/chuyen-dong/LICENSE-huashu-motion.txt) |
| `references/evidence/` (Evidence Films style prompts, director guide, satellite-briefing reference tools) | [lemomo-ai/lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar), © 2026 LemoLab. The lemo-opuscar demo films (CC BY 4.0) are **not** included. | MIT — [`references/evidence/LICENSE-lemo-opuscar.txt`](references/evidence/LICENSE-lemo-opuscar.txt) |
| `references/blender/*/` (Blender craft guides) | blender-skills contributors | MIT — [`references/blender/LICENSE-blender-skills.txt`](references/blender/LICENSE-blender-skills.txt) |
| `engine/backends/three/mats3d.js`, `geo3d.js`, `library3d.js`, `engine/core/model_view.html`, `tools/model3d.py` | Independent re-implementation that adapts material priors, geometry patterns and the reference-review workflow of [img2threejs](https://github.com/img2threejs/img2threejs). No img2threejs source files are included. | img2threejs is Apache-2.0; see the notice below |
| `engine/hyperframes/ban_do.mjs` (map pre-projection) | Uses Natural Earth data through the `world-atlas` npm package at run time | Natural Earth: public domain |

### img2threejs notice (Apache License 2.0)

> Parts of engine/backends/three/mats3d.js, geo3d.js, library3d.js, engine/core/model_view.html and tools/model3d.py
> adapt material priors, geometry patterns and the reference-review workflow from img2threejs
> (https://github.com/img2threejs/img2threejs), licensed under the Apache License 2.0.
> No img2threejs source files are bundled; the code here is an independent re-implementation.

### Ideas adapted (no code, data or assets copied)

| Where in mega-shot | Source of the idea | Licence of the source | What was taken |
|---|---|---|---|
| `xp pose-editor` (`tools/dung_dang.py`, `engine/core/xuong_dung_dang.html`, `xuong_hanh_dong.html`, easing/transition additions in `engine/core/nhanvat.js`) | [ArtCraft](https://github.com/storytold/artcraft) | MIT / Apache-2.0 | ideas only: FK bone posing with per-joint handles, clip strips on a timeline with opt-in bezier transitions, deterministic playhead evaluation, cubic-bezier easing. Re-implemented for the 2D rig; no ArtCraft code is copied, and its Mixamo / MMD motion data (not covered by its licence) is not used. |
| `xp review` first-3-seconds and reading-time checks (`soat_mo_dau`, `soat_doc_chu` in `tools/xp.py`), the 6-question film review sheet `build/duyet_phim.md` (`DUYET_6`) | chaojifeng-video-design ("前三秒" first-three-seconds rule, explainer timing audit, review-and-revision method) | MIT | ideas and thresholds only, re-implemented and measured on the rendered page; no code or text copied. |

### Preview images

`references/previews/`, `references/text-styles/`, `references/characters/` and the gallery images
`references/style-gallery.jpg`, `references/thumbnail-styles.jpg`, `references/fonts.jpg` are frames rendered by
mega-shot itself (code-drawn characters, text animations, 3D scenes) and by huashu-art-motion (MIT). Some gallery tiles
show footage/archival pictures that mega-shot downloaded from open sources (Pixabay Content License, NASA / US-government
public domain, Wikimedia Commons public-domain items) to demonstrate a style. If you redistribute these galleries
separately, re-check each tile's source or regenerate them from your own material.

## Downloaded or called at run time (not bundled)

| Component | Used for | Licence | How it gets installed |
|---|---|---|---|
| [uv](https://github.com/astral-sh/uv) | runs every `xp` command, installs Python packages | MIT / Apache-2.0 | by you (see README) |
| [FFmpeg](https://ffmpeg.org) | encoding, mixing, probing | LGPL-2.1+ / GPL (depending on build) | `xp setup --install ffmpeg` or your package manager |
| [Playwright](https://playwright.dev) + Chromium | headless rendering of every frame | Apache-2.0 (Playwright), BSD-3 (Chromium) | `uv` + `xp setup --install chromium` |
| [three.js](https://threejs.org) | 3D templates | MIT | `xp setup --install three` (npm, `engine/package.json`) |
| PyYAML, ruamel.yaml, Pillow, NumPy | config parsing, images | MIT, MIT, MIT-CMU (HPND), BSD-3 | `uv` on demand |
| [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | listen-back check + word timestamps | MIT (model weights: MIT, OpenAI Whisper) | `uv` on demand |
| [rembg](https://github.com/danielgatis/rembg) + BiRefNet | background removal | MIT / MIT | `xp setup --install birefnet` |
| [VoiceStudio](https://github.com/debpalash/VoiceStudio) | local TTS + voice cloning over a local HTTP API (separate program, not linked) | AGPL-3.0 | `xp setup --install voicestudio` (SHA-256 verified) |
| [huashu-art-motion](https://github.com/alchaincyf/huashu-art-motion) | drawn styles (`xp art`) | MIT | `xp setup --install huashu` (git clone into `vendor/`) |
| [huashu-motion](https://github.com/alchaincyf/huashu-motion) composer + instrument samples | original music (`xp nhac`) | MIT; samples CC0 / CC BY (see that project) | git clone (see `references/chuyen-dong/sound.md`) |
| [HyperFrames](https://github.com/heygen-com/hyperframes) + [GSAP](https://gsap.com) | news motion graphics (`xp hf`) | Apache-2.0; GSAP standard licence (free, not OSI) | npm, by you (see docs) |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp), OpenCV | `xp clip` (licence-checked clips only) | Unlicense, Apache-2.0 | `uv` on demand |
| google-api-python-client, google-auth-oauthlib | `xp channel` YouTube uploads (official API) | Apache-2.0 | `uv` on demand |
| Be Vietnam Pro, Oswald fonts | thumbnails | SIL OFL 1.1 | `xp setup --install fonts` (google/fonts) |
| Kenney sound packs | sound effects | CC0 | `xp sfx kenney add …` |
| Stock media (Pixabay, Pexels, NASA, Poly Haven, ambientCG, Wikimedia Commons) | visuals | each asset's own licence — logged per video in `giay_phep.json` / `GHI_CONG.md` | `xp assets`, only after you approve a download policy |
| Sentinel-2 (Copernicus) / NASA Blue Marble imagery | satellite scenes (`xp vetinh`) | Copernicus open data (attribution) / public domain | `xp vetinh` |

You are responsible for respecting the licence of every asset, voice and music track you put in your own videos.
Only clone voices you own or have explicit permission to use.
