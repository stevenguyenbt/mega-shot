# YouTube thumbnails

A click-worthy thumbnail = **one emotional main image** (AI image, best real frame or archival image) + **a cut-out subject that pops from the background** + **≤ 4 words of very large text**. Vector/canvas drawing only handles the text → always start from a real or AI image.

## Workflow

1. `xp thumbnail new` in a video or series folder → `anh_bia.yaml` + `loi_nhac_anh_bia.md` (*AI prompts*) + `anh_bia/`.
2. **Claude writes** `loi_nhac_anh_bia.md`: 2–3 ideas, one English prompt each (format `## N. \`name.png\` — text: …` + a code block) so Studio shows copy buttons and drop zones.
3. **Claude picks real frames/images**: build a contact sheet (`ffmpeg … fps=8/dur,tile=4x2`) from the original `tainguyen/*.mp4` (higher resolution than build/), pick moments where the subject is large, sharp and moving → `nguon: "tap-02/tainguyen/x.mp4@19.6"`; archival stills work directly (`nguon: tap-04/tainguyen/herzl.jpg`).
4. **The user generates AI images** (ChatGPT/Gemini, 16:9) → drags them into Studio's **Thumbnails** tab, or saves `anh_bia/<name>.png`.
5. `xp thumbnail [name…]` → `out/anh_bia_<name>.jpg` (1280×720) + `out/anh_bia_xem_truoc.jpg` (YouTube home-page mock at desktop and phone sizes, with the real video duration). **Always check the preview** before delivering.

## Style `poster` (history documentary, "The ENTIRE History of …")

A large cut-out figure on the left (portrait or statue — one person, not a crowd), a DIFFERENT bright background image (city, landmark, or a history painting with smoke and fire), a heavy black slab-serif title (Rockwell Extra Bold with a white halo) at top right + an icon (`co:` svg/png, e.g. a self-drawn national flag) + a year range.

```yaml
- ten: poster-hadrian
  kieu: poster
  nguon: tap-02/tainguyen/bar-kokhba~2.jpg   # image containing the figure (gets cut out)
  nen: tap-02/tainguyen/titus~2.jpg          # background image
  tam_nen: [0.45, 0.5]                       # background focus (0–1)
  cao: 0.8                                   # figure height / frame (default .95) · x_chu_the: .25 (horizontal centre)
  co: anh_bia/co_israel.svg
  chu: ["ISRAEL", "3,000 YEARS"]
```

Matching title: "The ENTIRE History of X in N Minutes". Description: hook → list of every event covered (SEO) → a dramatic paragraph → commitment to sources/balance → chapters → sources → credits → ~14 hashtags.

## AI prompts — always include

- One subject, 60–70% of the height, in the **right third** (text on the left) or leave the **bottom third** dark (text at the bottom).
- Text area: "empty … fading to near black — clean negative space".
- Hyper-real, cinematic light, high contrast, strong eyes/mouth/motion.
- "16:9 landscape. No text, no letters, no watermark, no logo, no border." — text is placed by the tool (AI misspells Vietnamese diacritics).
- Avoid depicting real living politicians; prefer historical figures, statues or symbolic scenes.

## Text

- ≤ 4 words, 2 lines; curiosity or a number ("80% OF THE OCEAN / UNSEEN"). Don't repeat the video title — complement it.
- `*LINE` = accent box with black text; `^LINE` = accent-coloured text. Font: Be Vietnam Pro Black (full Vietnamese diacritics) or `font: oswald`; poster style uses Rockwell Extra Bold.
- Numbers on the thumbnail must match the video exactly.

## Keys in anh_bia.yaml

`nguon` (source image), `chu` (text lines), `bo_cuc` (layout: `trai` left | `phai` right | `duoi` bottom), `tach_nen` (cut out subject), `lat` (flip: auto|true|false), `nhan` (top badge), `mau_nhan` (accent colour), `mau_sang` (glow behind subject), `zoom`/`zoom_max`, `noi` (subject lift, 1.04), `vien` (outline), `sang_nen` (background brightness), `mo_nen` (background blur), `sang_chu_the` (subject brightness), `font: oswald`. Poster style: `kieu: poster`, `nen`, `tam_nen`, `co`, `cao`, `x_chu_the`, `mau_chu` (text colour).

## Pitfalls we hit

- Small subject + text over the subject → the layout zooms (≤ 2×) and pushes the subject to the opposite edge; the text box shrinks to the remaining space; a subject on the wrong side is flipped automatically.
- **The bottom-right corner is covered by YouTube's duration badge** → the `duoi` layout places text left of centre and above the bottom edge.
- No clear subject (a swarm of jellyfish, a landscape) → `tach_nen: false`, `bo_cuc: duoi`.
- Poster style: a group photo makes a messy cut-out that collides with the title — use a single figure.
- Cut-outs run on CPU (~20 s per image); results are cached by source-image content (changing text/layout does not cut again).

## Tools and licenses (`.mega-shot/`)

- `models/…/birefnet-general.onnx`: BiRefNet (MIT) via rembg, ~973 MB.
- `fonts/`: Be Vietnam Pro, Oswald (SIL OFL, licence files included); Rockwell comes from Windows.
- AI images: subject to the terms of the service the user generates them with. Archival images: keep the license/credit (CC BY needs attribution).

## Black-gold tone and the three-tier title

- `tong: black-gold` (old id `vang-den`; poster style): "black gold" look — dark, oil-black background, molten-gold glow behind the title, gold metallic title with a thin dark outline, gold rim light around the cut-out figure. `sang_nen: 1` keeps an AI painting's own colours under the gold title.
- Three-tier title like "The ENTIRE / **History** / of the Strait of / Hormuz in 7 Minutes": `chu: [...]` + `ti_le_chu: [.6, 1, .36, .36]` (relative size per line), `rong_chu: .42` (max width as a share of the frame), `vi_tri_chu: [x, y]` (centre-top of the block, 0–1). Use `tach_nen: false` with a full-frame AI painting.
- Best results: an AI painting split past ↔ present with one historical figure in the centre-left and an empty upper-right sky.

## Style library — `kieu:` (English ids; the old Vietnamese ids still work as aliases) (gallery: `references/thumbnail-styles.jpg`)

Pick 2–3 different styles per video and upload them to YouTube Studio → Test & Compare. Rules that apply to every style: ≤ 4–6 words, readable at 168×94, nothing important in the bottom-right corner (duration badge), one clear subject, numbers must match the video.

| `kieu` | Click trigger | Best for | Extra keys |
|---|---|---|---|
| `classic` (default) | cut-out subject that pops + huge words with an accent box | any topic with one strong figure/object | `bo_cuc`, `nhan`, `zoom`, `mau_sang` |
| `poster` | history-documentary poster; `tong: black-gold` | "The ENTIRE History of …" | `nen`, `co`, `cao`, `tong`, `ti_le_chu` |
| `gold-title` | AI painting + three-tier gold title ("The ENTIRE / History / of …") | flagship history videos with an AI painting | `ti_le_chu`, `rong_chu`, `vi_tri_chu`; use `tach_nen: false` |
| `big-number` | one giant number (specific + curious) | stats-driven topics ("39 KM", "$25B", "1,585") | `so`, `nen`, `x_chu_the`, `cao` |
| `versus` | split screen then ↔ now / A vs B (instant story) | change over time, rivals, before/after | `nguon2`, `nhan1`, `nhan2`, `vs`, `tam1`, `tam2`, `cu: false` (no sepia on the left) |
| `red-circle` | red circle + arrow ("look HERE") | maps, satellite images, a hidden detail | `diem: [x, y, r]` (0–1), `mau_khoanh` |
| `breaking-news` | breaking-news / newspaper front page (authority + urgency) | events, wars, disasters, scandals | `nhan` (banner), `ngay`, `mau_bao` |
| `mystery` | dark, cold spotlight + giant "?" (open loop) | mysteries, unanswered "why" questions | `dau`, `mau_bi_an`, `nen` |
| `minimal` | flat colour field, one cut-out, 2–3 words (premium, phone-readable) | explainers, economics, science | `mau_nen` |
| `parchment` | parchment, ink serif, sepia, wax seal with a year | ancient/medieval history, heritage | `nam`, `mau_muc` |
| `cinematic` | letterbox, teal-orange grade, grain, wide-spaced title | prestige documentaries, landscapes | `sang_nen` |

Text markers in `chu`: `*LINE` = accent box, `^LINE` = accent-coloured line (the marker must start the line).
