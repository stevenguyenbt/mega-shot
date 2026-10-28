# Code-drawn cartoon characters (puppet.js)
> New clips: drag-to-pose editor + custom clip library + bezier transitions → [dung-dang.md](dung-dang.md) (`xp pose-editor`).

> Story-film characters (character studio, `ve: { kieu: anh, xuong }`) are designed with the AI loop `xp cast-design` — see [characters-ai-loop.md](characters-ai-loop.md). To turn a flat illustration into SVG / a cut-out character, see [ve-lai.md](ve-lai.md) (`xp redraw`).

Characters are **data specs** drawn by `engine/core/puppet.js`. The look is hand-drawn: thick ink outlines that "boil" (re-jitter about 10× per second) and flat colours. Each character is built on a jointed rig with:
- spring transitions between poses;
- 7 expressions;
- blinking and breathing;
- **lip-sync from the narration's word timestamps** (one mouth beat per Vietnamese syllable).

No images or AI are needed, and the same spec always draws the same character.

Previews: `references/characters/demo-talk.gif` (talking emperor: poses + expressions + lip-sync) and `demo-lineup.gif` (3 characters × 7 expressions). Regenerate them with `xp character demo` (`--still 2.5` for a quick PNG).

## From the user's reference image → spec (the AI does this)

When the user gives a character image (PNG/JPG; ideally front view, arms slightly away from the body, plain background; a PSD with layers is best):

1. **Rights:** confirm the user owns the drawing or has permission. Never rebuild another channel's characters, such as Historically or OverSimplified.
2. **Look at the image** (Read tool) and fill the spec below:
   - head shape and size relative to the body (big-head chibi ≈ 1.1–1.3);
   - skin, hair, outfit and trim colours (pick hex values from the image);
   - hair style, beard, hat, outfit type, emblem, armour;
   - body width and leg length.
3. Save it as `nhan_vat/<id>.json` in the video folder, or `.mega-shot/characters/<id>.json` for reuse across videos.
4. Render a still next to the reference (`xp character demo --still 1`, or a test scene). Compare and adjust the spec until the silhouette, palette and key features read the same. Show the user both side by side.
5. If a feature has no spec option (a special hat, a scar, a weapon), add a small drawing function to `puppet.js` (`drawHat` etc.). Keep the hand-drawn primitives `shape()`, `ell()` and `capsule()` so it matches the style.

Expect a **stylised redraw** in the engine's hand-drawn style, not a pixel copy. For a pixel-faithful puppet of a detailed drawing, a cut-out rig (image parts + pivots) would be needed. That mode is not built yet.

## Spec

```json
{
  "name": "emperor",
  "head": { "shape": "round | oval | square", "size": 1.15 },
  "hair": "bun | short | long | bald",
  "beard": "none | long | goatee | mustache",
  "hat": "crown | conical | helmet | scholar | none",
  "outfit": "robe | tunic",
  "emblem": "龍",
  "armor": false,
  "eyes": 1, "lids": true, "nose": "bulb | line", "glasses": false, "shading": true,
  "line": 7,
  "body": { "width": 1.1, "legs": 1, "torso": 1 },
  "colors": { "skin": "#f4c9a0", "hair": "#1f1a1a", "outfit": "#f2b632", "trim": "#c0392b", "belt": "#8e2b1f",
              "pants": "#3e4a5c", "shoes": "#2a1d18", "hat": "#1d1d24", "hat2": "#c8463a", "armor": "#a7b0ba", "ink": "#24160f" }
}
```

Built-in samples: `MS.puppet.SAMPLES.emperor`, `farmer` (conical hat), `general` (helmet + armour), `scholar` (glasses).

**Comic-history look** (pale skin, cel shading, bulb nose, heavy-lidded eyes, teeth when shouting) is the default: `shading: true`, `nose: bulb`, `lids: true`. It is inspired by popular history-cartoon channels, but every character is an original design. Never recreate a specific channel's characters.

## Animating

```js
const emp = MS.puppet.create(spec);
MS.puppet.draw(x, emp, {
  x: 540, y: 1500, scale: 1.4, t,                       // feet position, size, scene time (s)
  track: [{ t: 0, pose: 'idle', expr: 'neutral' }, { t: 1.2, pose: 'point', expr: 'smug' }],
  words,                                                // [[word, t0, t1], …] → lip-sync (scene-local seconds)
  flip: false, boil: 1.6, boilFps: 10, talkGain: 1,
});
```

- **Poses:** `idle`, `point`, `explain`, `shrug`, `cheer`, `facepalm`, `arms-crossed`, `angry`. Changes spring in; you can add new ones to `MS.puppet.POSES` as joint angles.
- **Expressions:** `neutral`, `happy`, `angry` (vein mark), `surprised`, `smug` (one brow up), `sad`, `worried` (sweat drop).
- **Hand-drawn feel:** `boil` is the jitter in px (0 = static clean lines); `boilFps` is how often the lines redraw (8–12 = classic hand-drawn).

## Drawing styles (`style:` in the spec) and the five ready-made cute characters

All styles share the same rig, so every pose, expression, blink, breathing and lip-sync works in every style.
Preview GIFs: `references/characters/style-*.gif` and `styles-lineup.gif` (`xp character styles`; `--still 2.5` for PNG frames).

| `style` | Look | Ready-made character (`SAMPLES`) |
|---|---|---|
| `doodle` (default) | hand-drawn ink line that "boils", cel shading | emperor, farmer, general, scholar |
| `kawaii` | chibi proportions, soft gradient fills, thick outline in a darker tone of each colour, always-on blush | `mochi` — girl in a pink bear-ear hoodie, sparkle eyes |
| `flat` | flat vector shapes, no outline, one shadow crescent (Kurzgesagt-like) | `pip` — Professor Pip, round scientist with glasses and lab coat |
| `paper` | paper cut-out: textured paper, drop shadows, pale cut edges, 6 fps stop-motion jitter | `coco` — Captain Coco, little sea captain |
| `pixel` | 8-bit pixel art (drawn at 1/`pixel` resolution, hard alpha, nearest-neighbour upscale) | `bo` — Sir Bo, tiny knight |
| `watercolor` | translucent washes + pigment edge + double pencil line | `lua` — Granny Lua, storyteller grandma |

New spec keys: `style`, `eyeStyle: sparkle | dot` (default: classic white eyes), `ears: bear | cat | bunny` (+ `colors.earsColor`, `colors.earsInner`),
`hat: hood | captain` (+ `colors.badge`), `pixel: 6` (pixel size), `colors.eye` (iris colour for sparkle eyes). Chibi proportions: `head.size` 1.3–1.6 with `body: { torso: .7–.85, legs: .6–.75 }`.

Use one in a video (footage template): `phong_cach: { dan_chuyen: mochi }` — any id not defined in `phong_cach.nhan_vat` falls back to
`MS.puppet.SAMPLES[id]`; to customise, copy the sample into `nhan_vat: { mochi: { …spec… } }` and edit colours/hat/style. Scenes then use `dan: [[0, explain, happy]]` or `canh_hh: { vai: [{ ai: mochi }] }`.
Note: `pixel` renders in screen space, so camera zooms in a scene do not scale it.

## Animal mascots — `engine/core/critters.js` (recommended for cute explainers)

Five animals with their own silhouettes and drawing styles (preview: `references/characters/critter-*.gif`, `critters-lineup.gif`; `xp character critters`):

| id | Character | Style | Signature motion |
|---|---|---|---|
| `mochi` | Mochi the Cat — chubby loaf cat, tabby stripes | kawaii | tail swish, ear twitch |
| `bao` | Bao the Panda — round panda, black eye patches | flat | ear wiggle, big waves |
| `tuck` | Tuck the Penguin — egg body, red scarf | paper (stop-motion) | flipper flaps, hops |
| `fizz` | Fizz the Fox — pointy ears, huge white-tipped tail | watercolor | tail sweep, head tilt |
| `hop` | Hop the Bunny — long ears (one floppy), buck teeth | pixel | floppy-ear bounce |

Poses: `idle, wave, cheer, point, think, shrug, bounce` · expressions: `neutral, happy, surprised, sad, angry, love, smug` (+ blink, breathing, lip-sync from word timestamps).
In a footage video: `phong_cach: { dan_chuyen: fizz }` (narrator in the corner) and scenes with `dan: [[0, wave, happy], [.5, point, surprised]]`, or
`canh_hh: { nen: giay-co, vai: [{ ai: bao, x: .35, noi: true, dien: [[0, cheer, love]] }, { ai: tuck, x: .65 }] }`.
Code: `MS.critters.create('mochi', { colors: { body: '#f2d7b6' } })` recolours a mascot; `style:` can be overridden too.

## Bring your own 3D model — `engine/backends/blender/rig_glb.py`

Accepted: **`.glb` / `.gltf`** (best — mesh + textures + rig + animations in one file), `.fbx`, `.obj` (static). `.blend` opens directly in Blender.
Put each delivered model in its own folder `.mega-shot/models3d/<name>/` (unzip there; never run anything from it) and record its licence.

For an un-rigged **T-pose chibi biped** (typical AI-generated mascot, e.g. Meshy/Tripo exports with `*_pbr.glb`):
1. Inspect + four views (front/¾/side/back) to see the pose and facing (character must face −Y, feet at z = 0).
2. Measure landmarks (slice the mesh: head bottom, arm line, legs, tail centre-line) → `landmarks.json` (keys in the script docstring).
3. `blender -b --factory-startup --python rig_glb.py -- model.glb <out> landmarks.json [--frames 72] [--size 900] [--still] [--name cat]`
   → welds UV-seam vertices (avoids cracks), builds the armature (root, spine, head, ears, upper/fore arms, legs, tail chain),
   automatic weights confined per body region + weight smoothing, lowers the T-pose arms, keys a looping idle
   (breathing, sway, head tilt, cheek-height wave, ear twitch, tail wave), renders in the studio set and saves `<name>_rigged.blend`.
Example: `.mega-shot/models3d/capybara-dau/` (see the Tripo section below).
Limits: no lip-sync/blink when the eyes and mouth are painted in the texture; chibi arms are short, so waves stay below the head.
If a model already has a rig and animations (FBX/GLB from Mixamo etc.), import it and render its actions instead of re-rigging.

## Photos → 3D model with Tripo3D (`tools/tripo.py`, key `TRIPO_API_KEY` in `.env` or the environment)

1. Put 4 views in `.mega-shot/models3d/<name>/anh/` — front, left (the character's own left: in the side view the nose points to the viewer's LEFT), back, right.
2. `python tools/tripo.py balance` (credits) → `python tools/tripo.py multiview <dir> front.png left.png back.png right.png`
   (≈ 40 credits, 2–4 min) → `model.glb` (PBR: colour + normal + ORM, 4K) + `preview.webp` + `task.json`. Single photo: `tripo.py image <dir> photo.png`.
3. `normalize_glb.py -- model.glb model_norm.glb --height 1.9 --yaw-deg -90 --decimate .25` (face −Y, feet on the floor, lighter mesh, textures kept).
4. If the AI painted a region the wrong colour (Tripo coloured the capybara's brown muzzle red like the hat):
   `retint_glb.py -- in.glb out.glb '{"box":[x0,x1,y0,y1,z0,z1],"match":"red","hue":.055,"sat":.5,"val":.5}'` — recolours only matching texels
   inside the box, keeps the shading detail.
5. Rig + render with `rig_glb.py` (landmarks.json; for round plush bodies add `arm_front_y` / `leg_front_y` so limbs move without dragging the belly).
Example: `.mega-shot/models3d/capybara-dau/` (model_fix.glb, landmarks.json, capy-rigged.gif/.mp4/.png, capy_rigged.blend).
Uploading photos sends them to Tripo's servers — only for images the user owns or may use.
