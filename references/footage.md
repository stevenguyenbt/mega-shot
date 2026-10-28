# Footage, images and effects

Real footage, archival images, the user's own files, AI images/Blender stills, smart crop, built-in effects, colour
matching, scenes from online videos, and the lessons learned about asset search. Backend choice: `visual-backends.md`.

## Visuals step (workflow step 6)

- **Real footage / archival images:** `search: [{query: …}, {query: …}]` (2–3 clips per scene) → `xp assets`:
  candidates are scored by real sharpness after filling the frame, relevance to the query (no shared keyword = heavy
  penalty), file weight; the most dynamic segment of each clip is extracted (Lanczos 1.2× + light sharpening); stills
  get automatic 2.5D layers. **Always look at (open) `build/tim/<id>_phuong_an.jpg`** (*options sheet*); if wrong, pin
  `pick: <asset id>` (recommended — never drifts; ids in `build/tim/<id>.json`) or `pick: N`. Only downloads if
  `.mega-shot/chinh_sach.json` (*download policy*) allows it.
- **The user's own files** (product photos/videos, own footage):
  `search: [{ file: assets/x/photo.jpg, type: anh, crop: [x0, y0, x1, y1], parallax: false, author, license }]` — used
  as-is (copied into `tainguyen/<id>`), `crop` removes baked-in sale text/banners (fractions 0–1), `start` picks the
  start of a video; credits go to `giay_phep.json`. Ads: never before/after shots or cure/growth claims (platform
  health-ad policies) — inform first, product second.
- AI images: `xp prompts` → the user generates images → `anh/` → `xp images` · Blender: `xp blender <id> --only-frame 0`
  → `xp blender <id>` · one asset: `xp download polyhaven <id>`.
- **Smart crop:** landscape footage in a vertical frame is centred on the most detailed area (blown highlights
  penalized); override with `center_x: 0–1` per clip. Long clips are split into ~3 s wide/close "camera angles"; pin a
  segment with `start: <seconds>`.

## Effects (workflow step 7 — built into the footage template, kept subtle)

- Auto-rotating transitions (`phong` zoom, `lia` pan, `fade`, `lan-xuyen`, `gon-nuoc` ripple, `loe` flare).
- Overlays `style.overlays` / scene `overlays` (`tuyet-bien` marine snow, `anh-day-nuoc` caustics, `tia-nang` god rays,
  `bot-khi` bubbles).
- Punch-in when the title is a number.
- `graphic` (`kind`: `so-sanh-cao` height comparison, `dem-so` counter, `banh-tron` pie, `thanh-ty-le` ratio bar,
  `so-sanh` bar comparison, `da-kim-loai` metal rock).
- **3D ocean cross-section:** scene `bien3d: { tu, den, moc: [titanic, snailfish, challenger, sperm-whale], everest }`
  (0–11,000 m, probe dives `tu`→`den`; `backends/three/ocean3d.js`) + `style.ocean_hud: true` (live
  DEPTH/PRESSURE/TEMP/SUNLIGHT readout; footage scenes give `sau: m | [from, to]`; replaces `depth`).
- Depth gauge `depth` (shown when > 0); `reveal: true` (riser); `filter` (CSS colour filter); `fade_to_dark`;
  `title_box`; `zoom0 < 1` (image smaller than the frame, centred — e.g. a whole globe).

## Colour matching (footage)

After `xp assets`, `tools/mau.py` measures every VIDEO shot (per-channel mean, luma p5/p50/p95), pulls each toward the
video's median (grey balance clamped 0.85–1.18, contrast ±20 %) and applies an optional look:
`grade: { look: am-dien-anh (warm cinematic: teal shadows / warm highlights) | net-tuong-phan (neutral punch) | khong (none), amount: 0.6, balance: true }`.
Runs automatically; `xp grade [scene…]` for existing videos. Frames are graded in place with a `.mau.json` marker
(never stacks); changing the look = `xp assets <scene>` then `xp grade`. Stills are never graded. Check
`build/mau/truoc_sau.jpg`.

## Scenes from an online video — `xp clip <link>`

Licence gate FIRST (metadata via yt-dlp, nothing downloaded): allowed automatically = Creative Commons BY / BY-SA / CC0 /
public domain (NC/ND refused: monetised channels + an edit is a derivative), US-government hosts and official channels
(NASA, NOAA, USGS…), and the user's own channels listed in `.mega-shot/kenh_cua_toi.json`. Anything else is refused
unless the user passes `--consent "<who allowed it / why>"` for THAT link (logged in `.mega-shot/clip_quyen.jsonl`,
marked `tu_xac_nhan` → `xp channel upload` and `xp social` refuse the video; `MS_CHO_CLIP_TU_XAC_NHAN=1` for a manual
one-off). Then: download ≤ 1080p into `.mega-shot/tai_ve/clip/`, scene cuts + ~4 s windows, motion/sharpness,
burned-in captions/logos/end cards (OpenCV) with a suggested `crop`, transcript (local Whisper) →
`build/clip/<name>/canh.jpg` (look at it — faint captions can slip through), `goi_y.yaml` (ready `search` entries),
`canh.json`, `loi.md`. Studying a viral video's structure without reusing its pictures is always fine (transcript + cut
rhythm → write a NEW script).

Watching other videos in a browser is view-only: pause, mute and stop them when done; never download them outside
`xp clip`'s licence gate.

## Lessons learned (footage and images)

- 1080p landscape footage cropped to vertical needs 1.8× upscaling → soft: prefer vertical / 1440p / 4K clips (the
  search scores this).
- A scene is a sequence of CAMERA SHOTS in `search` order (video and stills interleaved, time split evenly;
  `giay_phep.json` → `shots`). A still held > 6.5 s is split into 2–4 angles: wide → close on the most detailed area →
  close on another area → pull back. Stills whose aspect ratio differs a lot from the frame (portraits, coins, maps) are
  shown whole over a blurred copy. Long scenes should have ≥ 2 sources.
- Candidates sharing no keyword with the query are heavily penalized; the log says "có thể lạc đề" (*possibly
  off-topic*) → check `*_phuong_an.jpg`. Pixabay queries work best generic + place name ("jerusalem old city");
  archival images work best with specific artifact/event names ("Tel Dan Stele"). Pixabay may simply not have real
  footage of some subjects (e.g. specific animals) — then pin a good still with `pick`. Check tags/`giay_phep.json`
  after `xp assets`.
- Multi-episode series: clips used in an EARLIER episode are avoided automatically. Pixabay photos via the API are
  ≤ 1280 px (sharpness is scored on the real download).
- `pick: <Wikimedia page id>` that the keyword search did not return is fetched directly by id — still compare
  `giay_phep.json` ids with `pick`. News-template captions (`caption`) follow the shot's photo id (`id`, `id~2`), not
  the angle index.
- Wikimedia (only when allowed for a video via `extra_sources`, or for a channel): only originals ≤ 3840 px or the
  standard 3840/1920 px thumbnails, ≥ 1.5 s between calls — non-standard sizes get HTTP 429. Quick lookup:
  `timkiem.wikimedia(q, 'anh')`, then `pick: <id>`.
