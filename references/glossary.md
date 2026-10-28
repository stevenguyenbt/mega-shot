# Glossary — every command, YAML key, file and tool

Full YAML key table with defaults: `../docs/yaml-reference.md` (or `python <skill>/tools/yaml_keys.py --markdown`).

## Commands (`xp …`)

English names; old Vietnamese names (last column) still work.

| Command | What it does | Old name |
|---|---|---|
| `setup` | check prerequisites, fix what is safe, list what needs the user (`--install`, `--policy`, `--json`, `--quick`, `--no-launch`) — run first | `caidat` |
| `new <name>` | new video from a template (`--format 9x16\|16x9\|1x1`, `--template footage\|blank\|threejs\|blender\|ai-image\|manifesto\|medical\|news\|story\|philosophy`) | `moi` |
| `check script` | score the script before narration | `kiemtra kichban` |
| `narrate` | narration per scene (`--redo <ids>`, `--import-from <dir>` recorded audio) | `giong` |
| `timeline` | rebuild the timeline without generating voice | `mocthoigian` |
| `assets [scene…]` | search, score, download and cut footage/images | `timtainguyen` |
| `download polyhaven\|url <id>` | one asset + licence log (`--resolution`, `--name`, `--license`, `--source`) | `tainguyen` |
| `art [scene…]` | render `huashu:` scenes timed to the narration (`--redo`) | — |
| `prompts` / `images` | write AI image prompts / import AI images | `loinhac` / `anh` |
| `blender [scene…]` | Blender scenes (`--only-frame N`, `--draft`, `--redo`, `--from`) | — |
| `3d <script.py>` | one Blender still from a kit script (`--out`, `--samples`, `--size WxH`, `--draft`); styles anime-cel/do-choi/low-poly/noir/kinh-di | — |
| `preview` | preview frames + contact sheet (`--at 5,12,30`) | `thu` |
| `nhac` (`compose`) | perform the video's ABC score (`music.score`) on real instrument samples → `build/nhac_soan.wav` | — |
| `hf [scene…]` | render `hf:` HyperFrames scenes → `build/layers_hf/` (`--redo`) | — |
| `vetinh <name>` (`satellite`) | real satellite plates for a place (`--center`, `--km`, `--before`, `--to`) | — |
| `clip <link>` | licence-checked download + analysis of an online video → ready `search` entries (`--consent`, `--name`, `--no-words`) | — |
| `taitao <image>` (`restore`) | analyse and rebuild an image sharper/cleaner/larger (`--scale`) | — |
| `grade [scene…]` | colour-match footage shots + look (`--force`) | — |
| `mix` | mix voice, music, SFX | `am` |
| `review` | dropped words, subtitles vs speech, text overflowing the frame, the first 3 seconds, on-screen reading time — BEFORE rendering (`--skip-read`) | `soat` |
| `cast-design new\|draw\|score\|cast\|lock\|yaml\|list` | AI design loop for code-drawn 2D characters (`characters-ai-loop.md`) | `nhanvat` |
| `redraw phan-tich\|ve\|doi-mau\|mo-rong\|rig` | redraw a flat illustration as SVG, recolour, extend, cut-out rig (`ve-lai.md`) | `ve-lai` |
| `pose-editor mo\|them\|soat\|ds\|xoa` | FK pose & clip editor + shared clip library (`dung-dang.md`) | `dung-dang` |
| `render` | per-scene render with cache (`--scene id…`, `--full`) | — |
| `export` | upload file + phone preview + publishing package (`--limit 29`) | `xuat` |
| `check` | quality check of the export (+ cut self-check) | `kiemtra` |
| `all` | narrate → mix → render → export → check | `tatca` |
| `series new\|run\|assemble` | multi-episode series (`--episodes N`, `--only tap-03`, `--steps narrate,assets,blender,mix,render`, `--redo`) | `loat moi\|chay\|ghep` |
| `thumbnail [new\|…]` | YouTube thumbnails | `anhbia` |
| `model new\|check\|list` | reusable 3D models rebuilt from a reference image (`--from pixabay:<id>`, `--nguoi`, `--height`) | — |
| `publish` | publishing package: titles, description, tags, hashtags, captions, credits | `dangbai` |
| `subtitles` | caption files: source language + **English always** (+ `--langs ja,es`); untranslated → `<lang>.todo.json` (`--status` exits 3 if missing/stale) | — |
| `voicestudio start\|stop\|restart\|status` | the narration API headless (`--gui` opens the app); log `.mega-shot/voicestudio/backend.log` | — |
| `voice add\|list\|check` | clone a voice from an audio/video file (`--name`, `--consent`, `--lang`, `--max`, `--no-app`, `--archetype`) | — |
| `music add\|list\|brief\|check` | background music (`--start`, `--duration`, `--license`, `--use`, `--phone`) | — |
| `sfx kenney list\|add <pack…>\|all · sfx add · sfx search · sfx list` | sound library: kenney.nl CC0 packs → `.mega-shot/sfx/kenney/<pack>/`; natural sounds; use `sfx: { replace: { bum, tich, dang, bot, vut: "kenney:<pack>/<file>" } }` and scene `sounds: [{ name, at_word \| at, level }]` | — |
| `channel …` | automatic YouTube channels (`automation.md`, `channels.md`) | — |
| `social …` | posting through your own adapters (`automation.md`) | — |
| `don` (`cleanup`) | free disk after publishing (`--xoa` / `--delete` = really delete) | — |
| `studio` | local dashboard (`--port 3901`, `--open`) | — |
| `viral "<topic>"` | OPTIONAL viral research → `viral.md`, `viral_phan_tich.md` (`--q`, `--format`, `--lang`, `--region`, `--days`, `--n`) | — |
| `text-styles` | GIF previews of subtitle/title styles (`--only`, `--width`, `--fps`) | — |
| `character demo` | code-drawn character previews (`--still t`) | — |

## YAML keys

English name (internal name): `name` (ten) · `format` (khung) · `language` (ngon_ngu) · `loudness` (do_to) · `voice`
(giong: `sample` mau, `volume` am_luong, `speed` toc_do, `retry_below`, `attempts`, `numbers` doc_so, `pronounce` doc,
`pitch` cao_do, `num_step`) · `music` (nhac: `file`, `volume`, `duck` tu_ha, `from`/`to` tu/den, `score` soan, `keep`
giu) · `sfx` (`level` muc, `ambience` am_nen, `ambience_level`, `auto` tu_dong, `replace` thay) · `pacing` (nhip: `gap`
dem, `pause` nghi, `tail` duoi) · `style` (phong_cach: `kind` kieu, `huashu`, `overlays` lop_phu, `subtitle_style`,
`title_style`, `danger_words` tu_do, `ocean_hud` hud_bien) · `grade` (mau: `look`, `amount`, `balance`) ·
`extra_sources` (nguon_them) · `target_seconds` (muc_tieu_giay) · `final_episode` (tap_cuoi) · `publish` (dang_bai:
`titles` tieu_de, `hook` moc, `topics` noi_dung, `drama` kich_tinh, `trust` cam_ket, `tags` tag, `caption`) ·
`characters` (nhan_vat) · `news` (tin) · `story` (truyen).

Scenes (`scenes` / canh): `narration` (loi) · `subtitle` (phu_de) · `title` / `title_box` / `title_hold` (chu / chu_nen
/ chu_giu) · `labels` (nhan: `text`, `point`, `at`, `warning`) · `graphic` (do_hoa: `kind`, `items`, `label`, `value`,
`unit`, `ratio`, `position`) · `year` (nam) · `search` (tim: `query` q, `type` loai video/anh=image, `source`, `pick`
chon, `start` tu, `center_x` tam_x, `file` tep, `crop` cat, `author`, `license`, `parallax` 25d, `caption` chu_thich) ·
`transition` / `transition_length` (chuyen / chuyen_dai) · `reveal` (tiet_lo) · `fade_to_dark` / `darkness` (toi_dan /
toi_dan_den) · `filter` (loc) · `gap` / `pause` / `extra` (dem / nghi / them) · `image` (anh: `file`, `description`) ·
`depth` (do_sau) · `sounds` (am) · `zoom0` / `zoom` / `drift` (troi) / `focus` (tam) · `speaker` (ai) · `chapter`
(chuong) · `quote` (trich) · `punchline` (chot) · `body_clock` (dong_ho) · `set3d` (canh3d) · `question` (hoi) ·
`source_note` (nguon).

**Series (`loat.yaml`)**: `title` (tieu_de) · `tagline` (mo_ta) · `intro` (gioi_thieu, description paragraph) ·
`references` (tham_khao) · `hashtags` · `credit_overrides` (ghi_cong_sua: `<asset id>: "Author"`) · `opening` (mo_dau:
`length`, `folder` narrated teaser) · `chapter_card` (the_chuong) · `end_card` (ket) · `episodes` (tap: `folder`,
`title`).

**Thumbnails (`anh_bia.yaml`, Vietnamese keys only)**: `phien_ban` variants · `ten` name · `nguon` source image (or
`video.mp4@seconds`) · `chu` text lines (`*` accent box, `^` accent colour) · `bo_cuc` layout (`trai` left / `phai`
right / `duoi` bottom) · `tach_nen` cut out subject · `lat` flip · `nhan` badge · `mau_nhan` accent colour · `kieu`
style · `nen` background image · `tam_nen` background focus · `co` icon/flag · `cao` figure height · `x_chu_the` figure
x.

## Files

`nghien_cuu.md` research notes · `giay_phep.json` asset/licence book (per video) · `GHI_CONG.md` credits ·
`tainguyen/` downloaded assets · `build/tim/` search candidates · `build/thu/` preview frames · `out/*_xem_thu.mp4`
phone preview · `out/youtube_dang_bai.md` full publishing package · `out/dang_bai_mxh.md` TikTok/Reels caption ·
`out/mo_ta_youtube.md` YouTube description · `out/chuong_youtube.txt` chapters · `out/ghi_cong_day_du.md` full credits
(pinned comment) · `tap-NN/` episode folders · `loat.yaml` series config · `anh_bia.yaml` thumbnail config.

## Tools

`setup.py` prerequisites · `keys.py` API keys · `yaml_keys.py` English YAML keys · `huashu.py` huashu-art-motion scenes
· `library.py` voice/music library · `timkiem.py` asset search · `kichban.py` script checker · `loat.py` series ·
`anhbia.py` thumbnails · `dangbai.py` publishing package · `subtitles.py` captions · `kenh.py` channels · `social.py`
posting adapters · `don.py` clean-up · `tachnen.py` background removal · `lop25d.py` 2.5D layers · `sfx.py` procedural
sound effects · `engine/core/dohoa.js` graphics · `the.html` title/chapter cards.
