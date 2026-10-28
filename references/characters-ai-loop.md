# Characters by AI design loop — `xp cast-design` (studio + PhotoCraft effects, AI as designer and critic)

Old command name: `xp nhanvat` (still accepted).

The studio already draws every part in code (xuong_nhanvat.js / xuong_anime.js, PhotoCraft layer effects in hieuung_lop.js,
anatomy in giaiphau.js). The weak link was the **spec**: the description reader (`giaiphau.doc`) is a regex parser. It
misses words (a "blue skirt" can come out brown, a moustache can be ignored, "short hair" on a 58-year-old can come out as
teen spiky hair), and nobody checked the result. This loop puts the AI agent that runs the skill in two roles: **designer**
(writes the spec) and **critic** (scores a fixed review sheet). The engine draws, and the tool measures what eyes miss.
There is no image model, no paid API and no extra install. One headless Chromium page builds a character in about 12 s and
draws a sheet in about 2 s on the GPU canvas. It is light, but avoid running it while a long render is using the GPU.

## Research summary

| Option | What it is | Verdict |
|---|---|---|
| A. AI writes the spec once (text/photo → parameters) | 3D-GPT style: an LLM extracts procedural parameters from a description ([3D-GPT](https://arxiv.org/pdf/2310.12945)), with the legal values given in the prompt to stop invented keys ([ProxyBuild](https://arxiv.org/pdf/2609.23386)) | needed, but on its own it is blind: it never sees the drawing |
| B. **Render → critique → revise loop** | the same model drafts the code/params, looks at its own render and fixes it ([IntroSVG, CVPR 2026](https://arxiv.org/html/2603.09312v1), [Render-in-the-Loop](https://arxiv.org/pdf/2604.20730); image targets: [RefineSVG](https://arxiv.org/pdf/2607.27699)) | **chosen**: big quality gains come from seeing the render; we add hard measurements so the critic is not only taste |
| C. AI writes new drawing code per character | the LLM generates canvas/SVG for hair, clothes… | only for studio GAPS (new hair / garment types) and added to the shared library, never per video: per-character code breaks the shared rig and clip library |
| D. Pose & expression library | already exists (40+ clips, 12 expressions, retargeting) | reused as-is: the sheet shows 6 clips and 12 expressions, so a spec is judged in motion, not as one pin-up |
| E. Consistency in a series | diffusion needs identity tricks ([The Chosen One](https://rss.boorghani.com/?p=215932)); code characters are consistent by construction | one locked `spec.json` per character in a shared library; the cast check measures *variety between* characters instead |
| F. Style presets | `phong_cach` (anime, anime-manga, anime-mem, anime-chibi, anime-thanh-nien) | kept; the spec carries the style, and the sheet compares like with like |

**Recommendation: A + B with measurements (A feeds B).** The AI drafts the spec using the vocabulary the engine really
draws. It reviews one fixed sheet (reference | hero → ← | silhouette · grey · phone size | 6 clips | 12 expressions |
measurements) and scores 8 rubric items. It revises at most 3 rounds. Anything the studio cannot draw becomes a studio
task (option C), not a forced spec.

## Workflow

```
xp cast-design new <id> --desc "<description>" [--ref photo.jpg --license "…"] [--style anime-thanh-nien] [--name Name]
   → .mega-shot/nhanvat/<id>/ spec.json (draft from the engine's own reader) · BRIEF.md (vocabulary + rubric) · ref.jpg · meta.json (palette of the photo centre)
DESIGNER: read BRIEF.md + look at ref.jpg → fix spec.json (wrong colours, missed features, face knobs, one memorable accent)
xp cast-design draw <id>    → soat_vN.jpg + danh_gia_vN.json + spec_vN.json (each round snapshotted; NHATKY.md logs all)
CRITIC: open soat_vN.jpg → xp cast-design score <id> --scores "giong=4,bong=4,ti_le=4,mau=4,mat=4,trang_phuc=4,nho=4,khac_dan=4" --fix "<one concrete change>"
   repeat draw → score, max 3 rounds
xp cast-design cast [ids…]  → .mega-shot/nhanvat/dan.jpg: cast in one pose + silhouette row + pairwise silhouette overlap
xp cast-design lock <id>    → khoa.json; refused while any score < 4, the spec changed after the last draw, or a value is outside the vocabulary (--force only with the user's OK)
xp cast-design yaml <id>    → paste under nhan_vat: in video.yaml (ve: { kieu: anh, xuong: … }) — the same spec in every video of a series
xp cast-design list
```

Rubric (1–5): `giong` likeness to the description/photo · `bong` silhouette readable · `ti_le` proportions and joints
(judge by eye in the clips) · `mau` the big masses separate in grey · `mat` 12 expressions tell apart · `trang_phuc` one
memorable accent · `nho` reads at phone size · `khac_dan` distinct from the rest of the cast.

Automatic measurements on the sheet:
- vocabulary: an unknown value would silently fall back to a default, so it is flagged;
- WCAG value contrast for skin–hair, skin–shirt, shirt–trousers and hair–shirt (warning below 1.35, target 1.5);
- silhouette: frame fill, width/height, and how much the 6 clips change the shape (≥ 0.25 reads well);
- likeness to every other library character (silhouette IoU plus shirt/hair contrast; warning when the silhouette is > 0.9 and the colours are close);
- the engine's joint QA (`giaiphau.kiemDinh`).

**Known issue:** joint QA can report gaps in the `di` test pose even for the shipped presets. It is shown but advisory, so
judge joints by eye under `ti_le`.

## What a typical run looks like

- Text-only descriptions usually need 1–2 rounds: the reader gets a colour or an age wrong, the designer corrects
  `tuoi`, `toc`, colours and adds one accent, and the second round passes (average ≥ 4).
- When the studio lacks a garment or headwear (for example a long split-flap dress or a conical hat), the score stays
  below 4 after 3 rounds and the cast check may also flag a silhouette that overlaps another character. That is the
  intended outcome: the loop stops and names the studio task (add the garment to xuong_anime.js) instead of forcing a spec.

## Rules
- The AI only edits the spec. Drawing code changes go into the shared studio files (xuong_anime.js, toc_nhanvat.js) and
  are checked with `xuong_sheet.html` close-ups.
- A photo reference is a costume/style study, never a likeness of a living private person. Store the photo's licence in
  `--license` (default: "provided by the user").
- No third-party image AI in this loop. Ask the user before any download, install or paid API.
