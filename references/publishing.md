# Publishing package (titles, description, tags, hashtags, captions)

`xp publish` (*dang bai* = posting) builds everything needed to publish, ready to paste. It runs automatically at the end of `xp export` (single video) and `xp series assemble` (series), and can be re-run any time without re-rendering — e.g. after editing titles or adding thumbnails.

**Write the `dang_bai` block together with the script (workflow step 3)**, in the video's language, using only facts that are in the video.

## Config (in `video.yaml` or `loat.yaml`)

```yaml
dang_bai:
  tieu_de:                                   # title options (first = recommended); {phut} = real length in minutes
    - "The ENTIRE History of Israel in {phut} Minutes"
    - "The ENTIRE History of Israel: 3,000 Years in {phut} Minutes"
  moc: >-                                    # hook: the first ~2 lines are what people see in search and under the video
    The history of Israel: a narrow strip of land … every empire that wanted it.
  noi_dung: auto                             # everything covered (SEO): auto = on-screen scene titles, or write the list yourself
  tom_tat: >-                                # 2–3 sentence summary with secondary keywords (after the hook)
    …
  kich_tinh: >-                              # short dramatic paragraph
    The Assyrians scattered its north. The Babylonians burned its Temple. …
  cam_ket: >-                                # trust statement: sources, balance on contested topics
    Contested events are presented with the main views of historians and of both peoples.
  tag: [history of israel, israel documentary, …]   # YouTube tags, ≤ 500 characters in total
  caption: "…"                               # vertical videos: TikTok/Reels caption (defaults to `moc`)
hashtag: [HistoryOfIsrael, Israel, History, …]       # top-level (series) or inside dang_bai; 3–15 is the sweet spot
tham_khao: ["Author, Book (year)", …]                # sources → description
```

Without a `dang_bai` block the tool still works (hook = the first two spoken lines, title = first on-screen title) but warns.

## Description formula (professional, SEO) — written automatically by `xp publish`

```
<Hook: 1–2 sentences, main keyword in the first sentence>           ← dang_bai.moc  (the 2 lines shown in search)
<Summary: 2–3 sentences with secondary keywords>                     ← dang_bai.tom_tat (+ kich_tinh)
⏱ CHAPTERS                                                          ← automatic (16:9): series → assembly; single video →
00:00 …                                                                 scenes with `chu` (or `chuong:`), ≥ 25 s apart, ≥ 3
📌 IN THIS VIDEO  (only when there are no chapters)                  ← noi_dung (auto = scene titles, or a list)
📚 SOURCES                                                           ← tham_khao
━━━━━━━━━━━━━━━━━━━━  footer
🎬 ABOUT THIS CHANNEL + 🔔 Subscribe link                            ← kenh.yaml dang.gioi_thieu_kenh / dang.handle (or dang_bai.kenh)
⚠️ NOTE                                                               ← dang_bai.cam_ket (sources, balance, scope)
© <channel> — original script, research and edit.
#tag1 #tag2 #tag3                                                    ← only the first 3 hashtags (shown above the title)
```

Rules: hook + summary carry the keywords naturally (no keyword stuffing); chapters need a real on-screen title per section —
write `chuong: "Short chapter name"` on the scene that opens a section when `chu` is not a good chapter name; the video belongs to
a channel via `kenh: <id>` in video.yaml (a channel topic → video link from `xp channel next` also works). Shorts (9:16) skip chapters.
The description has no audio/credits block (keeps it short); full media credits go to `out/ghi_cong_day_du.md` for the pinned comment.

Uploads (`xp channel upload`) send the full set: title, this description, tags (+ channel tags), category, default language and
audio language, made-for-kids = no, synthetic-media disclosure, standard licence, embeddable, public stats, no subscriber
notification, custom thumbnail, captions (all SRTs), and the channel playlist (`dang.danh_sach_phat`: a name, or
{name: [keywords]} matched against title/description). `--youtube-id <id>` updates an already-uploaded video's metadata
without re-uploading (privacy kept as it is).

Title pattern that works for history explainers: "The ENTIRE History of X in N Minutes" (≤ 70 characters so it is not cut in search).

## Outputs (`out/`)

| File | Contents |
|---|---|
| `youtube_dang_bai.md` | Full package: title options with lengths, description, tags, pinned-comment instructions, thumbnail list, subtitle note, limit checks |
| `mo_ta_youtube.md` | Description only — paste into YouTube |
| `ghi_cong_day_du.md` | Full credits with links — pinned comment |
| `dang_bai_mxh.md` | Vertical videos: TikTok/Reels caption + first 5 hashtags + YouTube Shorts title (also read by `xp social`) |
| `caption_<platform>.txt` | Optional, written by you or the AI: a per-platform caption (first line = title) that `xp social` prefers over `dang_bai_mxh.md` |

## Subtitles (English always)

`xp export` / `xp series assemble` call `xp subtitles`. Source-language SRT is automatic; for a non-English video the AI translates `out/subtitles/en.todo.json` → `out/subtitles/en.json` (same ids, keep `_cues_sha`) and runs `xp subtitles` → `<name>.en.srt` + `<name>.en.txt` (transcript without timing). `youtube_dang_bai.md` lists every SRT with upload steps and warns while the English file is missing.

## Limits checked automatically

| Item | Limit |
|---|---|
| YouTube title | ≤ 100 characters (warns above 70: cut off in search) |
| YouTube description | ≤ 5,000 characters; `<` and `>` are removed (YouTube rejects them) |
| YouTube tags | ≤ 500 characters in total |
| Hashtags | ≤ 15 recommended (YouTube ignores all of them above 60; the first 3 appear above the title) |
| TikTok/Reels caption | ≤ 2,200 characters |
| Chapters | first at 00:00, ≥ 3 chapters, each ≥ 10 s (checked by `xp series assemble`) |
