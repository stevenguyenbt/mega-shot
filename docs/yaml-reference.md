# `video.yaml` / `loat.yaml` reference

Every key has an **English name** and the original **internal (Vietnamese) name**. Both work, in any mix; English keys
are translated right after the file is read (`tools/yaml_keys.py`). If a block contains both names for the same key,
the internal name wins and `xp` prints a warning. In `film.html`, scene data is always available under the internal
name (`c.data.chu`, `c.data.tieu_de`, …).

Values are not translated: enum values such as transitions (`fade | cut | tu-xu-ly`), overlay ids (`tia-nang`), graphic
kinds (`thanh-ty-le`) or 3D set ids keep their ids — they are listed with English explanations in [SKILL.md](../SKILL.md)
and [references/](../references/). Exception: `search.type: image` is accepted for `anh`.

Strings that look like numbers (`2015`, `10_1980`) must be quoted. Unknown scene keys are passed through to `film.html`.

## Minimal example

```yaml
name: deep-sea
format: 9x16            # 9x16 | 16x9 | 1x1
language: en
voice: { sample: documentarian, volume: 0.55, speed: 1.0 }
music: { file: .mega-shot/music/bg.mp3, volume: 0.6, duck: true }
style: { subtitle_style: box, title_style: tracking }
scenes:
  - id: opening
    search: [{ query: "deep sea anglerfish" }, { query: "ocean darkness particles" }]
    title: 11,000 m
    narration: Eleven thousand metres down, the pressure would crush a car like a can.
    subtitle: "**11,000 m** down, the pressure crushes a car like a can."
    labels: [{ text: "Mariana Trench", point: [.5, .4], at: .4 }]
```

## Key table

| Block | English key | Internal (Vietnamese) key |
|---|---|---|
| top level (video.yaml) | `name` | `ten` |
| top level (video.yaml) | `format` | `khung` |
| top level (video.yaml) | `language` | `ngon_ngu` |
| top level (video.yaml) | `loudness` | `do_to` |
| top level (video.yaml) | `voice` | `giong` |
| top level (video.yaml) | `music` | `nhac` |
| top level (video.yaml) | `scenes` | `canh` |
| top level (video.yaml) | `style` | `phong_cach` |
| top level (video.yaml) | `pacing` | `nhip` |
| top level (video.yaml) | `extra_sources` | `nguon_them` |
| top level (video.yaml) | `target_seconds` | `muc_tieu_giay` |
| top level (video.yaml) | `final_episode` | `tap_cuoi` |
| top level (video.yaml) | `publish` | `dang_bai` |
| top level (video.yaml) | `characters` | `nhan_vat` |
| top level (video.yaml) | `news` | `tin` |
| top level (video.yaml) | `story` | `truyen` |
| top level (video.yaml) | `grade` | `mau` |
| voice / giong | `sample` | `mau` |
| voice / giong | `volume` | `am_luong` |
| voice / giong | `speed` | `toc_do` |
| voice / giong | `retry_below` | `thu_lai_duoi` |
| voice / giong | `attempts` | `so_lan_thu` |
| voice / giong | `numbers` | `doc_so` |
| voice / giong | `pronounce` | `doc` |
| voice / giong | `pitch` | `cao_do` |
| music / nhac | `volume` | `am_luong` |
| music / nhac | `duck` | `tu_ha` |
| music / nhac | `from` | `tu` |
| music / nhac | `to` | `den` |
| music / nhac | `score` | `soan` |
| music / nhac | `keep` | `giu` |
| style / phong_cach | `kind` | `kieu` |
| style / phong_cach | `overlays` | `lop_phu` |
| style / phong_cach | `ocean_hud` | `hud_bien` |
| style / phong_cach | `danger_words` | `tu_do` |
| style / phong_cach | `label` | `nhan` |
| style / phong_cach | `chapter_label` | `nhan_chuong` |
| style / phong_cach | `subtitle_y` | `phu_de_y` |
| sfx | `level` | `muc` |
| sfx | `ambience` | `am_nen` |
| sfx | `ambience_level` | `nen_muc` |
| sfx | `auto` | `tu_dong` |
| sfx | `replace` | `thay` |
| pacing / nhip | `gap` | `dem` |
| pacing / nhip | `pause` | `nghi` |
| pacing / nhip | `tail` | `duoi` |
| grade / mau | `look` | `kieu` |
| grade / mau | `amount` | `muc` |
| grade / mau | `balance` | `can` |
| publish / dang_bai | `titles` | `tieu_de` |
| publish / dang_bai | `hook` | `moc` |
| publish / dang_bai | `topics` | `noi_dung` |
| publish / dang_bai | `drama` | `kich_tinh` |
| publish / dang_bai | `trust` | `cam_ket` |
| publish / dang_bai | `tags` | `tag` |
| scene (scenes[] / canh[]) | `narration` | `loi` |
| scene (scenes[] / canh[]) | `text` | `loi` |
| scene (scenes[] / canh[]) | `subtitle` | `phu_de` |
| scene (scenes[] / canh[]) | `title` | `chu` |
| scene (scenes[] / canh[]) | `title_box` | `chu_nen` |
| scene (scenes[] / canh[]) | `title_hold` | `chu_giu` |
| scene (scenes[] / canh[]) | `labels` | `nhan` |
| scene (scenes[] / canh[]) | `graphic` | `do_hoa` |
| scene (scenes[] / canh[]) | `year` | `nam` |
| scene (scenes[] / canh[]) | `search` | `tim` |
| scene (scenes[] / canh[]) | `transition` | `chuyen` |
| scene (scenes[] / canh[]) | `transition_length` | `chuyen_dai` |
| scene (scenes[] / canh[]) | `reveal` | `tiet_lo` |
| scene (scenes[] / canh[]) | `fade_to_dark` | `toi_dan` |
| scene (scenes[] / canh[]) | `darkness` | `toi_dan_den` |
| scene (scenes[] / canh[]) | `filter` | `loc` |
| scene (scenes[] / canh[]) | `gap` | `dem` |
| scene (scenes[] / canh[]) | `pause` | `nghi` |
| scene (scenes[] / canh[]) | `extra` | `them` |
| scene (scenes[] / canh[]) | `image` | `anh` |
| scene (scenes[] / canh[]) | `depth` | `do_sau` |
| scene (scenes[] / canh[]) | `sounds` | `am` |
| scene (scenes[] / canh[]) | `overlays` | `lop_phu` |
| scene (scenes[] / canh[]) | `drift` | `troi` |
| scene (scenes[] / canh[]) | `focus` | `tam` |
| scene (scenes[] / canh[]) | `speaker` | `ai` |
| scene (scenes[] / canh[]) | `dialogue` | `doi_dap` |
| scene (scenes[] / canh[]) | `heading` | `tieu_de` |
| scene (scenes[] / canh[]) | `duration` | `thoi_luong` |
| scene (scenes[] / canh[]) | `kind` | `kieu` |
| scene (scenes[] / canh[]) | `chapter` | `chuong` |
| scene (scenes[] / canh[]) | `quote` | `trich` |
| scene (scenes[] / canh[]) | `punchline` | `chot` |
| scene (scenes[] / canh[]) | `body_clock` | `dong_ho` |
| scene (scenes[] / canh[]) | `set3d` | `canh3d` |
| scene (scenes[] / canh[]) | `question` | `hoi` |
| scene (scenes[] / canh[]) | `source_note` | `nguon` |
| search item (search[] / tim[]) | `query` | `q` |
| search item (search[] / tim[]) | `type` | `loai` |
| search item (search[] / tim[]) | `source` | `nguon` |
| search item (search[] / tim[]) | `pick` | `chon` |
| search item (search[] / tim[]) | `start` | `tu` |
| search item (search[] / tim[]) | `center_x` | `tam_x` |
| search item (search[] / tim[]) | `file` | `tep` |
| search item (search[] / tim[]) | `crop` | `cat` |
| search item (search[] / tim[]) | `author` | `tac_gia` |
| search item (search[] / tim[]) | `license` | `giay_phep` |
| search item (search[] / tim[]) | `parallax` | `25d` |
| search item (search[] / tim[]) | `caption` | `chu_thich` |
| search item (search[] / tim[]) | `page` | `trang` |
| label (labels[] / nhan[]) | `text` | `chu` |
| label (labels[] / nhan[]) | `point` | `diem` |
| label (labels[] / nhan[]) | `at` | `luc` |
| label (labels[] / nhan[]) | `warning` | `canh_bao` |
| graphic / do_hoa | `kind` | `kieu` |
| graphic / do_hoa | `items` | `muc` |
| graphic / do_hoa | `label` | `ten` |
| graphic / do_hoa | `value` | `gt` |
| graphic / do_hoa | `unit` | `don_vi` |
| graphic / do_hoa | `ratio` | `ty_le` |
| graphic / do_hoa | `position` | `vi_tri` |
| quote / trich | `text` | `chu` |
| quote / trich | `source` | `nguon` |
| quote / trich | `at` | `luc` |
| news / tin | `channel` | `kenh` |
| news / tin | `date` | `ngay` |
| news / tin | `ticker_label` | `ticker_nhan` |
| image / anh | `description` | `mo_ta` |
| sound (sounds[] / am[]) | `name` | `ten` |
| sound (sounds[] / am[]) | `at_word` | `tu` |
| sound (sounds[] / am[]) | `at` | `luc` |
| sound (sounds[] / am[]) | `level` | `muc` |
| series (loat.yaml) | `name` | `ten` |
| series (loat.yaml) | `format` | `khung` |
| series (loat.yaml) | `language` | `ngon_ngu` |
| series (loat.yaml) | `voice` | `giong` |
| series (loat.yaml) | `music` | `nhac` |
| series (loat.yaml) | `style` | `phong_cach` |
| series (loat.yaml) | `loudness` | `do_to` |
| series (loat.yaml) | `pacing` | `nhip` |
| series (loat.yaml) | `extra_sources` | `nguon_them` |
| series (loat.yaml) | `target_seconds` | `muc_tieu_giay` |
| series (loat.yaml) | `title` | `tieu_de` |
| series (loat.yaml) | `tagline` | `mo_ta` |
| series (loat.yaml) | `intro` | `gioi_thieu` |
| series (loat.yaml) | `references` | `tham_khao` |
| series (loat.yaml) | `hashtags` | `hashtag` |
| series (loat.yaml) | `credit_overrides` | `ghi_cong_sua` |
| series (loat.yaml) | `opening` | `mo_dau` |
| series (loat.yaml) | `chapter_card` | `the_chuong` |
| series (loat.yaml) | `end_card` | `ket` |
| series (loat.yaml) | `episodes` | `tap` |
| episode (episodes[] / tap[]) | `folder` | `thu_muc` |
| episode (episodes[] / tap[]) | `title` | `tieu_de` |
| opening / mo_dau | `length` | `dai` |
| opening / mo_dau | `folder` | `thu_muc` |
| `xp new --template` | `blank` | `trong` |
| `xp new --template` | `canvas` | `trong` |
| `xp new --template` | `ai-image` | `anh-ai` |
| `xp new --template` | `manifesto` | `tuyen-ngon` |
| `xp new --template` | `medical` | `y-khoa` |
| `xp new --template` | `news` | `tin-tuc` |
| `xp new --template` | `story` | `truyen` |
| `xp new --template` | `philosophy` | `triet-ly` |

## Files a video folder contains

| File | Meaning |
|---|---|
| `video.yaml` | script + settings |
| `film.html` | how scenes are drawn (copied from the template) |
| `nghien_cuu.md` | research notes (sourced facts) — write before the script |
| `giay_phep.json` | licence book: every downloaded asset with source, author, licence |
| `GHI_CONG.md` | credits for the description |
| `tainguyen/` | downloaded assets |
| `build/timeline.json` | timing of scenes, words and subtitles |
| `build/tim/<scene>_phuong_an.jpg` | footage options sheet ("phương án" = options) |
| `build/thu.jpg`, `build/thu/` | preview contact sheet and frames ("thử" = try) |
| `build/doan/` | per-scene render cache |
| `out/<name>_<format>.mp4` | upload-quality export |
| `out/*_xem_thu.mp4` | phone preview (< 29 MB) |
| `out/youtube_dang_bai.md` | YouTube publishing package ("đăng bài" = publish) |
| `out/dang_bai_mxh.md` | TikTok / Reels caption |
| `out/subtitles/*.srt`, `*.txt` | captions (source language + English) |
| `out/anh_bia_*.jpg` | thumbnails ("ảnh bìa") |
| `tap-NN/` + `loat.yaml` | episodes of a series ("tập" = episode, "loạt" = series) |
