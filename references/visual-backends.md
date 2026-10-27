# Choosing and using a visual backend

| Content | Backend | Speed | Notes |
|---|---|---|---|
| Real places, nature, history, archival documents | footage (`timtainguyen` + `stills.js`) | fast (download + extract) | Most realistic; needs licensed sources; multi-angle shots and 2.5D keep stills alive |
| Flat illustration, infographics, timelines with drawn characters | canvas2d | ~3 min per 1 min of video | Lowest risk, "cartoon" look |
| Abstract 3D, concepts, data, simple products | threejs (`ms3d.js`) | ~2 min per 1 min of video | Fast, lots of motion; rigged people look like mannequins |
| Scenery, architecture, landscapes that must look real | blender (`msb.py`) | 5–10 s per frame (Cycles 64 samples, RTX 3050) | Best-looking scenery; long background renders |
| Faces, close-up people | AI images + `stills.js` | the user generates the images | Most realistic people; motion limited to Ken Burns and morphs |

Backends can be mixed in one video: one backend per scene, the text/subtitle layer stays the same.

## footage — `templates/footage`

Declare `tim` (*search*) per scene: `{ q: "english keywords", loai: video|anh|hdri|texture, nguon: pixabay|pexels|nasa|polyhaven|wikimedia, chon: <id>, tu: <seconds>, tam_x: 0–1 }`. A list gives several shots per scene in order. `xp assets` writes `giay_phep.json` (asset/license book with `shots`, cut points, 2.5D layers, detail focus points) and `GHI_CONG.md` (credits). `film.html` draws scenes with `MS.shots(x, c, shots, assets)`.

## canvas2d

`draw(x, c)` paints straight onto the 2D context. Template: `templates/trong`. Flat character drawing helpers exist in older videos (`face.js`, `hair.js`, `figure.js`).

## threejs — `/ms/backends/three/ms3d.js`

```js
import { THREE, create3D, post, focus, hdri, sun, pbr, worldUV, model, character, reach, aimBone, vec } from '/ms/backends/three/ms3d.js';
const C = create3D({ W, H, fov: 32 });
const s0 = await hdri(C, 'polyhaven/<id>/<id>_4k.hdr');   // lighting + background + C.sunDir (sun auto-detected)
sun(C, { size: 30 });                                      // sunlight + shadows matching the HDRI
const m = await pbr('sand_01', { repeat: [100, 100] });   // Poly Haven material
const XB = await character('nhan-vat/Xbot.glb'); const h = XB.spawn({ clip: 'walk' }); h.pose(t);
reach(h.bones, 'L', pointOnGround);                        // simple IK: hand to a 3D point
post(C, { ao: true, dof: { focus: 9 }, bloom: .12, grade: { warmth: .03 } });
// in draw(x, c): update the scene from c.t, then C.draw(x)
```

Lesson: rotating bones with Euler angles goes wrong (arms point at the sky) — use `reach`/`aimBone`. `pbr()` returns a new material each call; set `repeat` from real size or use `worldUV(geo)`.

## blender — `engine/backends/blender/msb.py`

Declare `blender: canh/x.py` on the scene in video.yaml. Script:

```python
import msb
def build(ms, ctx):
    ms.hdri('polyhaven/<id>/<id>_4k.hdr', sun_azimuth=150)   # rotate the HDRI so the sun sits where you want
    ms.sun(strength=4, elevation=9)                          # raise the sun angle independently, keep sky colour
    mat = ms.pbr('sand_01', scale=160, macro=.5)             # macro: breaks visible texture tiling at distance
    ms.box('Block', (2, 2, 1), (0, 0, .5), mat); ms.cam = ms.camera(lens=32)
def animate(ms, ctx, t, lt):
    ms.look(ms.cam, msb.vlerp(A, B, msb.ease(lt / D)), target)
```

`xp blender <id> --only-frame 0` renders one test frame · `--draft` EEVEE at half resolution · no flag = full Cycles (resumable). In film.html: `const bg = MS.seq('build/layers/<id>')`, then `await bg(x, c)`.

**Studio kit and styles (msb_lib).** `ms` also inherits `Kit` from `msb_lib.py`:
- `phong_cach('anime-cel'|'do-choi'|'low-poly'|'noir'|'kinh-di')` sets the style pack. `anime-cel` uses EEVEE with toon bands and freestyle outlines; the others pick AgX looks.
- Materials: `vl(kind, color)`.
- Shapes: `khoi` (primitives with bevel and subsurf), `blob` (metaball → mesh fitted to its elements), `ong` (tube), `chu` (3D text), `rai` (scatter), `low_poly`.
- Light, background and camera: `den_3_diem`, `nen`, `bau_troi`, `may`.

To render one still, run `xp 3d <script.py> [--out x.png] [--samples 128] [--size 1080x1080] [--draft]`. Before modelling anything, read the routing table in `references/blender/README.md`: 94 craft guides covering characters, props, environments, styles, lighting and VFX.

Lessons: the default camera only sees 100 m (msb sets 20 km); a sun behind the subject leaves its face black — pick a side `sun_azimuth`; "puresky" HDRIs suit scenes with their own ground.

## AI images — `/ms/core/stills.js`

1. Declare `nhan_vat` (*character*: fixed face description, framing, lighting, style) and `anh: { file: "…", mo_ta, boi_canh }` (*image: file, description, setting*) per scene. **Quote file names** (YAML reads `10_1980` as a number).
2. `xp prompts` → `loi_nhac_anh.md` (*image prompts*). The user generates the reference image first, then uses it as a reference for the others.
3. Put the images in `anh/`, run `xp images` (normalizes, removes a green screen if `nen: xanh`).
4. film.html: `MS.still(x, img, c, { zoom, focus, pan })` (Ken Burns + breathing + handheld shake), `MS.morph(x, drawA, drawB, q, c)` (morph transition), `MS.at(r, fx, fy)` (anchor point in image ratio for labels).

Topics with people: appropriate clothing, described explicitly in the prompt; see `sensitive-topics.md`.
