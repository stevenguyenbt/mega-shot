# Multi-episode series → long YouTube video

A series is `videos/<series>/`: `loat.yaml` (*series config*) plus episode folders `tap-01/`, `tap-02/`… (*tap* = episode). Each episode is a normal mega-shot video: build, preview and fix it like a short video. Assembly adds the opening (optional narrated teaser + title card), "PART n" chapter cards, the end card, continuous music and the YouTube upload package.

## Commands

```
xp series new <name> --episodes 5 --format 16x9 --template footage   # new series + 5 episodes from a template
cd videos/<name>
xp series run                      # voice → asset search → blender → mix → render for every episode (unchanged ones are reused)
xp series run --only tap-03         # one episode only;  --steps narrate,mix  only some steps;  --redo  force re-render
xp series assemble                      # → out/<name>_youtube.mp4 + chuong_youtube.txt + <name>.srt + mo_ta_youtube.md + anh_bia.jpg
```

Preview an episode with `xp preview` inside its folder. Rendering is redone automatically when the episode files or the engine (`engine/core/*`) change.

## loat.yaml

```yaml
ten: ocean-mysteries
tieu_de: "Ocean Mysteries"             # title: opening card + first line of the YouTube description
mo_ta: "One-line tagline"              # tagline
khung: 16x9                            # long YouTube: 16x9. Episodes inherit khung, ngon_ngu, giong, phong_cach, do_to, nguon_them, sfx, nhip, muc_tieu_giay
ngon_ngu: en
giong: { mau: documentarian, am_luong: 0.65, toc_do: 1.0, seed: 1234 }
nhac: { file: …, am_luong: 0.35, tu_ha: true }   # music for the WHOLE long video; single episodes have no music by default
mo_dau: { dai: 3.5, thu_muc: teaser }  # opening: title card length; thu_muc = a NARRATED teaser folder (15–30 s, own video.yaml, question hook) placed BEFORE the title card — retention in the first seconds; gets its own "Intro" chapter
the_chuong: { dai: 3.5, mau: "#ffc46a" }   # chapter card: length, accent colour
ket: { dai: 15, tieu_de: "Thanks for watching", phu_de: "Subscribe…" }   # end card ≥ 12 s leaves room for YouTube end screens · remove the key = no end card
gioi_thieu: >-                         # intro paragraph in the description (SEO)
  …
tham_khao: ["Author, Book (year)", …]  # sources → description (recommended for contested topics)
hashtag: [History, …]
ghi_cong_sua: { 36334730: "Wellcome Collection" }   # fix bad author metadata (CC BY requires correct attribution)
tap:
  - { thu_muc: tap-01, tieu_de: "Chapter 1 title" }   # tieu_de = text on the card + YouTube chapter name
```

An episode can override any key in its own `video.yaml` (e.g. `muc_tieu_giay` for a longer final episode).

## Seamless script

- The last line of each episode **hooks** into the next ("But further from the shore…"). The next episode continues — no new greeting.
- Only episode 1 introduces the topic; only the last episode asks viewers to subscribe/comment (`tap_cuoi: true`).
- Same voice, same grade (`post`), same typography — use one template for all episodes.
- Each chapter ≥ 10 s (YouTube rule); 1–4 minutes per episode is comfortable to build and fix separately.
- A clip used in an earlier episode is not reused later (the teaser may reuse the best shots).

## Output (series/out/)

| File | Use |
|---|---|
| `<name>_youtube.mp4` | Upload: H.264 high CRF 18, AAC 256k, −14 LUFS, faststart, no size limit |
| `chuong_youtube.txt` | Paste into the description → YouTube chapters (first at 00:00, ≥ 3 chapters, each ≥ 10 s) |
| `<name>.srt` | Raw burned-in subtitle lines (legacy) — prefer `subtitles/` below |
| `subtitles/<name>.<lang>.srt` | Sentence-level captions: source language + **English** (translated by the AI from `subtitles/en.todo.json` → `en.json`, then `xp subtitles`). Upload each under Subtitles › Add language; do not set the source language as default (subtitles are burned in) |
| `youtube_dang_bai.md` | Publishing package (`xp publish`): title options, description, tags, hashtags, pinned comment, thumbnails, checks — see `publishing.md` |
| `mo_ta_youtube.md` | Description only ≤ 5,000 chars: hook, topics, drama, trust line, chapters, sources, compact credits by license, hashtags |
| `ghi_cong_day_du.md` | Full credits with short links (`commons.wikimedia.org/?curid=…`), split into parts ≤ 9,500 chars for pinned comments |
| `anh_bia.jpg` | Placeholder 1280×720 — replace with designed thumbnails (`xp thumbnail`) |
| `<name>_xem_thu.mp4` | 720p preview under 29 MB for phones — not for upload |

## Language versions

To publish the same series in another language, copy the series folder, translate `loi`/`phu_de`/`chu`/graphic labels per scene (keep `tim` so the same visuals are reused), switch `ngon_ngu` and the voice sample, copy `tainguyen/`, `giay_phep.json` and `build/tim/` to avoid re-downloading, then `xp series run` + `xp series assemble`. Example: `videos/history-x` (English) → `videos/history-x-vi` (Vietnamese).
