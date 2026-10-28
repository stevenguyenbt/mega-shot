# Long series, thumbnails, 3D, people and medical — summaries

Short summaries with the essentials; each links to its full guide.

## Long YouTube video from several episodes

`xp series new <name> --episodes N --format 16x9` → write each episode (last line hooks into the next) →
`xp series run` → `xp series assemble` → `out/<name>_youtube.mp4` + chapters + .srt + publishing package + thumbnail.
Options: `--only tap-03`, `--steps narrate,assets,blender,mix,render`, `--redo`. Full guide: `long-series.md`.

## YouTube thumbnails

`xp thumbnail new` → write `loi_nhac_anh_bia.md` (AI image prompts) and/or pick the best real frames/archival images →
(optional) the user generates AI images and drops them into Studio → `xp thumbnail` → `out/anh_bia_*.jpg` + a YouTube
home-page preview. Eleven styles via `kieu:` (gallery `thumbnail-styles.jpg`): `classic`, `poster` (+ `tong:
black-gold`), `gold-title`, `big-number`, `versus`, `red-circle`, `breaking-news`, `mystery`, `minimal`, `parchment`,
`cinematic`. `poster` = history-documentary look (figure left over a different bright background, big black slab-serif
title + icon/flag + year range) pairs well with "The ENTIRE History of X" titles. Full guide: `thumbnails.md`.

## 3D quality kit and model library

Three.js scenes use physical materials with micro-variation (`mats3d.js`), bevelled/tapered/lathed geometry
(`geo3d.js`) and soft shadows. Objects you will reuse are rebuilt **once** from a reference photo with
`xp model new <name> --from pixabay:<id>`, then `xp model check` (2–3 passes against a 4-view sheet), and used via
`set3d: { kieu: vat, ten }`, `extra: [{ ten }]` or `vat3d: { ten }`. The library (`.mega-shot/models3d/`) starts empty.
Adapted from img2threejs (Apache-2.0). Command options: `model new|check|list` (`--from pixabay:<id>`, `--nguoi`,
`--height`). One Blender still from a kit script: `xp 3d <script.py>` (`--out`, `--samples`, `--size WxH`, `--draft`;
styles anime-cel/do-choi/low-poly/noir/kinh-di). Full guide: `models3d.md`; Blender guides: `blender/README.md`.

## People in a video → build them from a reference image

Every recurring character (historical figure, profession, narrator) is rebuilt from a reference picture (the user's
file, Pixabay, or Wikimedia when allowed): `xp model new <id> --from … --nguoi`, then `xp model check` (REFERENCE /
FRONT / SIDE / BACK). In scenes: `set3d: { …, nguoi: <id> }`. Background crowds may use `thoi_dai` era presets (Egypt,
Greece, Rome, medieval, China, old Vietnam, Japan, Arabia, 19th century). Full guide: `models3d.md`.

## Medical 3D — template `medical`

"What happens inside your body when…" shorts with a running BODY CLOCK (`body_clock: [from, to]` seconds), a different
stylised glossy 3D set per time mark from `engine/backends/three/medical3d.js` (procedural, no downloads, no gore):
`yk: ly-ca-phe | co-the | da-day | mach-mau | nao | thu-the | tim | gan | phan-tu | luoi | kenh-nhiet | khop | ban-tay | ly-bia | da | mui`.
`co-the` = semi-transparent human with organs: `soi: [organs]` highlights + labels, `bay: <organ>` flies the camera in.
Body sounds (CC0, `tools/am_co_the.py`): `tu-nhien:tim-dap-72|tieng-uc|soi-bung|lap-lanh|…`. Health rules: sources
from EFSA/FDA/NHS/MSD/PubMed in `nghien_cuu.md`, independent fact-check before narration, no treatment advice, caption
ends with a "not medical advice" disclaimer. Full guide: `medical3d.md`.
