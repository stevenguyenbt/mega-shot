# Manifesto style — template `tuyen-ngon`

Editorial "action manifesto" look for motivational / opinion shorts: grey-beige paper scenes alternate with black spotlight scenes; people are cut out of photos and printed like a photocopy (clustered-dot halftone, white paper edge); key words slam in as **red 3D block letters** exactly when they are spoken; a chapter label sits top-left ("01 / TUYÊN NGÔN KỶ LUẬT"); the video ends on a white question card that pulls comments.

```bash
xp new <name> --format 9x16 --template tuyen-ngon
xp narrate && xp assets && xp preview          # then mix → render → export → check
```

## Scene keys (`video.yaml`)

| Key | Meaning |
|---|---|
| `kieu` | `chu-3d` big red 3D word(s) · `cat-dan` cut-out person + word · `khung` 1–2 photos in tilted paper frames + 3D word · `the` question card |
| `nen` | `toi` (black + spotlight + dust) or `giay` (paper). Defaults: `chu-3d`/`the` → `toi`, others → `giay` |
| `chu` | the keyword (`|` = second line). For `the`: lines separated by `|`, a line wrapped in `**…**` is red |
| `chu_tren` / `chu_duoi` | small spaced line above / below the keyword |
| `do: true` | `cat-dan` uses the red 3D word instead of black ink |
| `vi_tri` | `trai` / `giua` / `phai` — where the cut-out stands |
| `co` | cut-out size multiplier (default 1) |
| `chuong` | chapter number from this scene on (label text: `phong_cach.nhan_chuong`) |
| `tim` | `{ q: "…", loai: anh }` — photos. `cat-dan` needs a person/object that BiRefNet can cut out (3–75 % of the frame); otherwise the photo is shown framed. A `chu-3d` scene with `tim` shows the photo faint behind the word |
| `vat3d` | a stylised 3D prop rendered with Three.js over the scene (`engine/backends/three/props3d.js`): `{ kieu, x, y, co, su_kien, … }` — see below |

## 3D props (`vat3d`)

`x`/`y` = screen centre (0–1), `co` = size, `su_kien: "<word>"` = the prop's event fires when that word is spoken (fallback `luc: 0–1` of the scene). In a `chu-3d` scene the keyword moves up and the prop sits under it (default `y: .52`); in other scenes the default is a small prop at the top.

| `kieu` | What it does | Options |
|---|---|---|
| `bong-den` | light bulb glowing, flickers and dies at the event | — |
| `dong-ho` | red alarm clock, rings (shakes) from the event | `gio: "6:00"` |
| `lich` | desk calendar flipping pages, lands on `den` at the event | `tu`, `den`, `chu` (label) |
| `o-vuong` | grid of tiles rising one by one | `so`, `cot`, `thieu` (missed tile index), `lap_day` (fill share of scene) |
| `song` | bars riding a wave — ups and downs | — |
| `thap` | blocks dropping and stacking | `so` |
| `cau-thang` | stairs with a figure hopping up | `so` |
| `cua` | door swings open at the event, light pours out | — |
| `ta` | dumbbell turning | — |
| `dong-ho-cat` | hourglass draining over the scene | — |

Photos: `phong_cach.anh: mau` (default — colour-graded stickers with a thick paper edge and an offset red risograph shadow) or `photocopy` (black-and-white halftone).

**Timing:** each word slams in when its first word is spoken (matched against the word timestamps of `phu_de`), so keep the keyword's words in `phu_de` (e.g. `chu: 66 DAYS` ↔ `phu_de: … **66 days** …`). No match → it appears shortly after the scene starts.

## Look notes

- Halftone is computed once per image in `prepare` (≈ 0.1 s per photo) — motion is a slow push, slide-in with spring, slight drift.
- Hard cuts with a 0.1 s flash (white on paper scenes, black on dark scenes) instead of dissolves; the mix adds whooshes/booms on cuts.
- Subtitles: light paper box, black text, red current word (`phong_cach.subtitle_style: box`, colours set by the template).
- Music: dark cinematic build, ~60–90 BPM, no vocals (`xp music brief` / `xp music check`).
- Fonts: Be Vietnam Pro Black (Vietnamese diacritics) + Oswald for the label — installed by `xp setup --install fonts`.
- Write your own lines; take the style, never another creator's script or images.
