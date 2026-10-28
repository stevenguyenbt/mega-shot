# Redraw an illustration in code — `xp redraw`

Old command name: `xp ve-lai` (still accepted). Actions: `phan-tich` (analyse), `ve` (draw), `doi-mau` (recolor),
`mo-rong` (extend), `rig` — the English words in brackets work too. Old flags `--khung` / `--ten` map to `--canvas` / `--name`.

Takes one flat/cel illustration (ink lines + flat colours: anime avatars, stickers, cartoon characters) and redraws it as a
clean, layered SVG. Colours can then be changed per region, and the picture can be extended with new parts in the same style
(for example a full body from a bust). The work is done by code (numpy + pillow + the Chromium of `xp`): no image AI, no
download, no paid API. Photos and soft painterly pictures are out of scope; the analysis warns when a picture has gradients.
Only redraw pictures the user owns or may use.

## Workflow: analyse first, then draw

```
xp redraw phan-tich <image> --out <folder>   → phan_tich.json + phan_tich.jpg; prints a ~10-line summary
    designer: read the summary, then fix phan_tich.json: name the colours (ao, da, toc…), merge or drop noise colours, set loai
xp redraw ve <folder>                         → ve.svg/ve.png, so.json, so.jpg (original | drawing | difference), so_zoom.jpg (worst 48 px tile ×4)
xp redraw doi-mau <folder> --doi "ao=#d5523f" --name ao_do   (repeatable; "#old=#new" also works)
xp redraw mo-rong <folder> --canvas 736x1260 --dat 0,0       → MO_RONG.md (style tokens + where lines are cut at the image edge) + them.json template
    designer: fill them.json (skeleton + shapes, see below), in new-canvas coordinates
xp redraw mo-rong <folder> --canvas 736x1260 --dat 0,0 --them them.json --name toan_than   → toan_than.svg/.png (recolour applies to it too)
xp redraw rig <folder> --them rig_ve.json     → cut-out character in .mega-shot/nhanvat/<id>/ (see the last section)
```

Without `--out`, the work folder is `<image name>_ve_lai/` next to the image. Put it under `.mega-shot/ve-lai/<name>/`
(`--out .mega-shot/ve-lai/<name>`) when you plan to `rig` it: `rig` then writes the character into the shared library
`.mega-shot/nhanvat/<id>/` (otherwise into `nhanvat/<id>/` next to the work folder).

The analysis records:
- **palette**: k-means on flat pixels only, then close colours are merged;
- **background**: the most common colour on the border;
- **ink**: the darkest colour, taken as the median of solidly inked pixels, so hair does not pull it lighter;
- **line width**: p10 / median / p90 at the stroke ridges;
- **thin colour lines**;
- **warnings**: colours that are nearly the same, tiny colours, gradients.

It also picks the drawing scale: ×4 when the thinnest lines are under about 2 px.

## Why lines do not break or stripe

1. The picture is upscaled ×3 or ×4 (Lanczos) before tracing, so the anti-aliasing ramps keep sub-pixel edge positions.
2. Each pixel is modelled as `(1 − a)·fill + a·ink`. Using ink costs a penalty, so pure colours win unless ink is really
   present. Fills therefore continue *under* the lines with no gaps, and the anti-aliased fringes are never mislabelled
   (that mislabelling causes stripes).
3. Ink is thresholded at **half of its local peak** (`a / localmax(a) > .5`). A strong line keeps its true width, and a
   faint or 1 px line still closes instead of breaking.
4. Faint lines (peak below 0.6, such as shirt folds) become their own layers. Each is coloured `fill + k·ink` at its measured
   strength, so folds are not drawn black and they follow a recolour (`<name>_netNN` layers).
5. Thick ink masses (hair) get the real colour measured from the picture, with a 1 px ink rim kept.
6. Fill labels pass a majority filter, which removes specks. Thin colour lines skip that filter so they are not dotted.
7. The tracing pipeline: marching squares → RDP simplification (0.2 px) → Catmull-Rom curves converted to cubic Béziers.

## Checks are numbers, not screenshots (token saving)

`ve` prints one line:
- mean colour difference and the share of clearly wrong pixels;
- **ink IoU**, missing and extra ink, and the median line width of the original against the drawing;
- the worst 48 px tiles.

Read the images only when a number is off. Then look at `so_zoom.jpg` (one tile ×4), not the full sheet. Targets: clearly
wrong pixels under 1.5 %, ink IoU at least 0.93, missing ink under 0.5 %, and line width within 0.5 px. Layers are cached in
`_lop.json`, so `doi-mau` and `mo-rong` run without re-tracing.

Typical result on a 736² bust with 1 px thinnest lines (traced at ×4): about 0.8–0.9 % clearly wrong pixels, ink IoU ≈ 0.95,
missing ink ≈ 0.02 %, line width 3.0 → 3.0 px.

## Extending (full body, more props): skeleton + shapes, not hand-written paths

`mo-rong --them them.json` (tools/ve_them.py). The AI describes **what** to draw. The builder handles **how**: smooth curves,
tapered limbs and an ink treatment that matches the original. A free-hand `them.svg` (`<g id="duoi">` / `<g id="tren">`)
still works, but it looks stiff (stick legs, mitten hands, one flat line weight), so do not use it for characters.

**1. Design first** — the required `"phan_tich"` field. Write down:
- head height × number of heads (chibi 2.5–3);
- view;
- **line of action** (the gesture curve) and the weight-bearing foot;
- a pose that matches the personality the face shows (sleepy and chin-up gives a lean-back, hand-in-pocket pose);
- what continues from each cut edge (MO_RONG.md lists the ink and colour runs on the border).

**2. Skeleton**: `"xuong": {"goi_t": [x, y], …}`. Parts refer to joints as `"@goi_t"` or `"@goi_t+4,-2"`, so moving one
joint moves everything attached to it.

**3. Shapes**, listed back to front in `duoi` (under the original) or `tren` (over it):

| Part type | What it draws | How to use it |
|---|---|---|
| `ong` | tapered tube through `[x, y, width]` points (arms, legs) | give an organic profile: thigh > knee < calf > ankle |
| `khoi` | smooth closed shape (shirt, shorts, shoes, pocket) | indices in `goc` stay sharp (hem corners, the top corners at the cut edge) |
| `net` | ink line that tapers at both ends (knees, seams, laces) | — |
| `nep` | ink at 30 % strength (fabric folds) | it stays right after a recolour |
| `tron` / `elip` / `vong` | filled circle / ellipse (`tam`, `r` or `rx`/`ry`, `xoay`) · ink ring (`rong` = width) | eyes, buttons, glasses rims |
| any shape with `"vien": false` | shape with no outline | patches that must blend in: a pocket that hides a hand, the inside of a sleeve, a ground shadow |

Colours are palette names from phan_tich.json (`ao`, `da`, `muc`…) or `#hex`.

**4. Outline treatment, applied automatically:**
- Every outlined shape in a layer is first drawn with one thick ink stroke behind everything, then filled with a thin inner
  stroke. The outer silhouette therefore comes out about 1.6× thicker than the inner lines (as in cel art), and overlaps
  such as an arm over a shirt keep only the thin line.
- Line widths default to the widths measured in the original.
- The `duoi` layer is clipped outside the original's frame, so nothing leaks around it.

**Joining a cut edge:** start the shape 4–10 px *inside* the original. Mark both of its top corners as `goc`; otherwise the
curve bulges outward. Match each outline's x position to the runs listed in MO_RONG.md.

**Self-check, printed as one line:**
- median line width of the new parts against the original;
- share of off-palette pixels;
- for each cut edge, how many ink lines continue across it (and the x of each break).

It also writes `mo_rong_soat.jpg`: a full view, a black silhouette (does the pose read?) and the join ×2. Fix by numbers
first. Open the sheet once per round, and run at most 3 rounds.

**Design checklist for the critic:**
- the silhouette reads: limbs separated from the torso, legs not parallel posts;
- the pose fits the face;
- the weight sits over the standing foot;
- limbs taper; no straight tubes;
- folds pull toward the action (a hand in a pocket drags folds toward it);
- palette only;
- the joins are invisible.

## Make it move: `xp redraw rig <folder> --them rig_ve.json` (cut-out character for the 2D rig)

This turns the redrawn picture into a cut-out character in the format `nhanvat.js` loads with `loadCutout`. It then plays
every clip with IK, transitions and the pose editor (`xp pose-editor`, see [dung-dang.md](dung-dang.md)).

**Head:** cut straight from the traced original (`dau.cat` = the rectangle kept), so hat, hair, glasses and face keep the
exact lines. `dau.xoa` (optional) paints skin over the baked face so expressions can be drawn separately (`mat_3_4`, see
dung-dang.md § Faces).

**Other parts:** drawn as `ve_them` shapes in the same palette and line weight:
- `than` (torso) and `quan` (shorts): rigid, with `goc` = hip and `ngon` = neck or up;
- `giay` (shoe): `goc` = ankle, `ngon` = toe;
- `chan` (leg strip) and `tay` (arm strip): `truc_x` + `hang` = [hip/shoulder, knee/elbow, ankle/wrist] rows.
- optional extra views: `huong_dau` (head) and `huong_than` (body), see dung-dang.md.

**Rig numbers:** world units = drawing px × 0.5. Measure them from the full-body drawing: hip → neck = `sp` sum,
thigh / shin = `T` / `S`, ankle height = `ank`.

**Output:**
- `.mega-shot/nhanvat/<id>/bo/` (PNG parts + `rig.json`) and `nhanvat.json` (`kieu: cat`);
- an anatomy/clothing logic check (`kiem_logic`) printed as ✓ / ⚠ lines and stored in `rig.json` (`kiem_tra`);
- the action preview and the pose editor list the character with ✂.

**Wide shirts:** `tay_truoc` (default true) puts the near arm in front of the torso. Without it a wide shirt hides the arms.

**In a video:** copy `bo/` into the video folder, then use `ve: { kieu: anh, bo: <id>/bo/rig.json }`.

**Limits:**
- without a face set (`mat_3_4`), the face is baked into the head, so there is no expression or mouth swap;
- a raised near arm goes behind a big hat (the engine's head rule);
- check one QA strip per clip with `xp pose-editor soat <clip> --nv <id>`.
