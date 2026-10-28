# Pose & clip editor — `xp pose-editor` (ideas from ArtCraft, rebuilt for the 2D rig)

Old command name: `xp dung-dang` (still accepted). Actions: `mo` (open), `them` (add), `soat` (check), `ds` (list),
`xoa` (remove) — the English words in brackets work too.

Make new actions for the code-drawn characters (nhanvat.js rig: `ve: { kieu: anh, xuong: … }` and the flat look) without
hand-writing channel numbers. You can drag the joints yourself, or the AI writes a clip and checks it from a rendered strip.
Saved clips go into one shared library, and `video.yaml` uses them like built-in clips.

## What was taken from ArtCraft (github.com/storytold/artcraft, MIT / Apache-2.0) — and what was not

ArtCraft is a Rust + Tauri desktop app. Most of it is a front end to paid AI image and video models. That does not fit
this skill: no third-party image AI, and no paid APIs without asking.

**Ideas adapted (re-implemented, no code copied):**
- **cubic-bezier easing** (Newton solve), as in its `timeline/interpolation.ts`;
- **FK bone posing**: a handle per joint, rotated in place, as in its `KinHelpers/FKHelper.ts`;
- **clip strips on a timeline** with an opt-in **bezier transition** between strips, and deterministic playhead-driven
  evaluation, as in its `animation/CharacterAnimationManager.ts`.

**Not taken:**
- the motion data (Sit / Idle / Walk / Dance…): GLBs on ArtCraft's CDN, Mixamo renders and MMD motion. Its NOTICE says these
  are *not* covered by the licence;
- the AI provider clients, the Tauri UI, the sound effects and the skyboxes.

The 3D side of this skill already ships three.js `SkeletonUtils` if a licensed Mixamo-rig clip is ever supplied.

## Engine additions (nhanvat.js, additive)

| Where | What |
|---|---|
| key easing, `keys[i][2]` | besides `giu` (hold) and `lin`, any preset or `[x1, y1, x2, y2]`. Presets: `vao` (ease in), `ra` (ease out), `vao-ra` (ease in-out), `nhanh-cham` (fast-slow), `cham-nhanh` (slow-fast), `nay` (overshoot), `lay-da` (anticipation), `lay-da-nay` (both). An eased key is a straight blend timed by the curve. Leaving it empty keeps the spline. |
| timeline transition, `hanh_dong[i].chuyen` | the same names or array. The cross-fade into this entry follows the bezier instead of the spring, over `mix` seconds. Example: `{ t: 3, clip: vay-chao-nay, mix: .4, chuyen: vao-ra }` |
| `MS.nv.khop(actor, t)` | screen position of every joint (hong, nguc, co, dau, vai/khuyu/cotay R/L, goi/cochan R/L). Used by the editor handles and available for QA. |
| `MS.nv.bez`, `MS.nv.EASE` | the easing solver and its presets |

## Action preview: `xuong_hanh_dong.html` (opened at `/` by `xp pose-editor mo`)

- **Left:** every clip, built-in and custom library, with a filter box. Arrow keys move through the list.
- **Centre:** the clip plays in a loop on a chosen library character (🔒 = locked, ✂ = cut-out). You can set facing, view,
  expression and speed.
- **Try a transition from** enters the clip from another clip with a `chuyen` curve (or the default spring) over `mix`
  seconds, so you can judge the timeline transition before writing it into video.yaml.
- **Below:** a 6-frame strip.
- **✎** opens the clip in the editor.

## Editor: `xp pose-editor mo [--nv <library id>] [--clip <name>] [--port 8765]`

Open `http://127.0.0.1:8765/xuong_dung_dang.html` (the command prints the URL; Ctrl+C stops the server).

**Handles:**
- orange dots = near side, blue = far side;
- elbow / knee rotate the shoulder / hip;
- wrist / ankle bend the elbow / knee;
- head nods; neck leans the spine; the green hip dot moves the body.

**Shift** drags the secondary channel: arm out, head tilt, hip roll, ankle.

The handles have no hand-written sign conventions. While you drag, a small numeric search moves that joint's channel until
the joint sits under the mouse, so it works for every body type, facing and view. Planted feet stay on the ground (IK).
Untick "feet on the ground" for jumps, kicks or sitting.

**Keys:**
- add a key at the playhead (**K**);
- copy the previous key, delete a key;
- set the curve into the next key;
- ghost poses of the neighbouring keys (onion skin);
- play with **Space**;
- settings: loop, upper-body-only (layers over a walk), default expression;
- load any built-in or custom clip as a starting point.

**Save to library** writes `.mega-shot/nhanvat/clips/<name>.json`. It then regenerates `engine/core/nhanvat_clip_rieng.js`,
which `templates/truyen/film.html`, `xuong_sheet.html` and the editor load after `nhanvat_clip.js`. Clip names: lowercase
ASCII letters, digits and hyphens. A library clip with the same name as a built-in overrides it; `xoa` brings the built-in back.

## AI path (no browser needed)

1. Write the clip JSON. It uses the same format as nhanvat_clip.js: `{ len, loop, tren?, bc?, keys: [[t, {channels}, curve?], …] }`.
   Channels you leave out carry over from the previous key. Angles are in radians, on the near (N) / far (F) side. The
   channel list is at the top of nhanvat_clip.js.
   - Put the anticipation, the strike (slight overshoot) and the settle on separate keys.
   - Use `lay-da` for the wind-up, `nay` for the pop, `vao-ra` for cycles, `ra` for the settle.
2. `xp pose-editor them clip.json --name <name>` validates the clip: known channels, time order, angles in range, known curve
   names.
3. `xp pose-editor soat <name> [--nv <id>] [--n 8]` writes `<name>_soat.jpg`, n frames side by side. Look at that one strip only
   (token saving), fix, and repeat at most 3 times.
4. Use it in video.yaml: `hanh_dong: [{ t: 2, clip: <name>, mix: .3, chuyen: vao-ra }]`.

`xp pose-editor ds` lists the library; `xp pose-editor xoa <name>` removes a clip.

## Good clips — rules of thumb

- Each key carries a curve, laid out as anticipation → strike with overshoot → settle.
- Idles breathe (shoulder rise, spine) and shift weight (hip + side bend + opposite knee).
- The head lags the body; phone thumbs alternate.
- Check every clip on a chibi and on an adult character, so it reads on both proportions.
- Keep a built-in name's meaning. Example: a floor sit stays a floor sit; add a new name for a chair sit.
- Chibi arms cannot reach the top of the head or the hips. Scratch at the ear, and put akimbo hands on the waist.
- Phones are held at the belly / chest with the forearm level, not under the chin.

**Engine behaviour for cut-outs with `tay_truoc`:**
- the arm the clips author as near (aN*) is drawn in front; a far arm at rest is hidden behind the torso and shorts, and a far
  arm reaching forward shows only past the torso;
- a raised near arm is drawn in front of the big head;
- props are sized by the hand; no screen glow (flat art);
- a wooden stool is drawn for `ngoi` (sitting) clips;
- sit / lie hip height scales by shin + ankle (`LSh`).

The editor keeps the clip flags (prop, ngoi, tay…) when it loads, saves and draws QA strips.

**Phone (prop `dt`), all characters:** the phone is held up at 45°.
- Its top end points to the upper corner on the side the character faces, and the screen faces the face.
- In side / 3-4 views a slice of the lit screen shows, with a dark bezel and the hands under its lower half.
- A front view shows the back of the phone (with the camera dot).
- A faint light cone and a soft `screen`-blended glow go to the eyes.
- Cut-outs (`tay_truoc`): the phone is 2.3 × hand size and held a little in front of the chin, because chibi arms are short.

## Faces and head directions (XYZ), cut-outs from `xp redraw rig`

**Face:**
- `dau.xoa` paints skin over the baked eyes / brows / mouth, so the traced head becomes a clean head.
- `mat_3_4` (and `mat_view` per extra view) gives the eye centres `[cx, cy, width, nose side ±1]` and the mouth `[cx, cy, scale]`.
- `tools/mat_bieu_cam.py` draws every expression from parameters:
  - eyelid: ngu (sleepy, the original), mo (open), to (wide), nham (closed), cuoi (happy), hep (narrowed), buon (droopy);
  - brows: (inner, outer) offsets;
  - mouth: 12 shapes, including the lip-sync visemes o / a / e / to / het.
- Expressions: binh, met, cuoi, vui, ngac, hoang, so, buon, gian, nghi, tu_tin, quyet, nham. Blinking uses nham automatically.
  Talking uses the visemes.

**Head views (Y):**
- `huong_dau.thang` (front), `.ngang` (profile) and `.lung` (back) are drawn as `ve_them` shapes, each with its own neck pivot
  and face anchors. The 3/4 view is the traced original.
- The engine picks the view nearest to the head yaw = `goc` + `hy`, and loads the face set with the matching `@view` suffix.
  The back view has no face.
- In the action preview, with `goc` 3-4, `hy` +0.95 = front, 0 = 3/4, −0.55 = profile, −2.19 = back.

**Pitch (X, `nk`):**
- 3/4 and profile views rotate the head.
- Front and back views keep the head upright: the face slides by `cui` px and squashes slightly. This is why a front-view
  nod does not spin the head.

**Roll (Z, `hr`):** tilts the head in every view.

**Action preview:** Y / X / Z sliders and the front · 3/4 · profile · back buttons add the offsets on top of the playing
clip. The expression menu lists every face.

## Body in 4 directions (`huong_than`)

The body turns all the way round, like the head. In `rig_ve.json`, each `huong_than.<view>` entry has:
- `yaw`: the angle of the view (front 0, profile 1.5, back π; 3/4 is the original);
- `cf`, `cl`: the forward-back and left-right projection factors onto the screen;
- `vai`: the distance from the spine to the arm, in px;
- `chon` (optional): the angle used to pick the picture. Example: set 2.1 on the back view so the `lung-3-4` angle also uses
  the back picture. `huong_dau` entries accept this field too;
- `than`, `quan`, `giay`: the ve_them shapes of the shirt, shorts and shoes.

Arms and legs share the same tube strips in every view.

The engine picks the body picture by the body's yaw:
- **Front:** both arms hang at the shirt edges, shoes seen from the toe.
- **Back:** an arm reaching forward is hidden by the body, the phone is not shown, shoes seen from the heel.
- **3/4 ↔ profile:** the projection interpolates smoothly between the two views.

`kiem_logic` (in `xp redraw rig`) also checks every view: the sleeve sits on the shirt edge, the shorts cover both legs, the
torso is as tall as in the 3/4 version.
