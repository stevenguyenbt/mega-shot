# Story films and code-drawn characters

Template `story` (old name `truyen`). Read `story/README.md` first. Character guides: `characters.md` (puppet.js),
`characters-ai-loop.md` (`xp cast-design`), `ve-lai.md` (`xp redraw`), `dung-dang.md` (`xp pose-editor`).

## Beat sheet

"What if you…" hook → named character + stakes in numbers → choice→cost loop with a RULE CARD per tip → twist ~25 % →
countdown → all-is-lost + silence → turn → theme line → cliffhanger end card.

## Characters and voices

`characters:` = character bible (look `ve`, voice `giong: { mau }`); a line spoken by a character has `speaker: <id>`
(`xp narrate` uses that voice).

Characters are jointed 2D skeletons animated like a game (`engine/core/nhanvat.js`, `nhanvat_clip.js`): 40+ keyframed +
procedural clips cross-faded by a per-character `hanh_dong` timeline, leg IK on sloped ground, arm IK onto other
characters, look-at, turns between angles, springs for hair/clothes, per-syllable lip-sync, 11+ expressions; clips
retarget to any body and look.

**Character studio without AI images:** `ve: { kieu: anh, xuong: { … } }` — vector parts + PhotoCraft-style layer
effects (`xuong_nhanvat.js`, `hieuung_lop.js`), anatomy solver from a text description `xuong.mo_ta` (Vietnamese-only
parser) with automatic joint QA, anime styles
(`xuong.phong_cach: anime|anime-manga|anime-mem|anime-chibi|anime-thanh-nien`), 19 body-shape presets, 13 hair styles
and `MS.xuong.ngauNhien(seed)` random casts; photo faces via `xuong.mat_anh` (clean low-res pictures first with
`xp restore <image>` — `taitao`, analyse and rebuild an image sharper/cleaner/larger, `--scale`); cut-out characters
from a drawn rig sheet (`tools/tachmanh.py`). Gallery `/ms/core/nhanvat_demo.html`, sheets
`engine/core/xuong_sheet.html`.

**AI design loop** (best quality, no image AI): `xp cast-design new <id> --desc … [--ref photo]` → you edit spec.json as
designer → `xp cast-design draw` review sheet (hero, silhouette/grey/phone tests, 6 clips, 12 expressions, contrast +
cast-likeness measurements) → you score 8 rubric items (`xp cast-design score`) → ≤ 3 rounds → `xp cast-design lock` →
`xp cast-design yaml`; library `.mega-shot/nhanvat/`, cast check `xp cast-design cast` (`characters-ai-loop.md`).

**Redraw a given flat/cel picture exactly** (avatar, sticker, cartoon) as layered SVG, recolour it, extend it (full
body) or turn it into a cut-out character: `xp redraw phan-tich <image>` → fix palette names → `xp redraw ve` (numeric
line/colour check) → `doi-mau` / `mo-rong` / `rig` (`ve-lai.md`).

**New actions without hand-written numbers:** `xp pose-editor mo [--nv <id>]` = FK pose & clip editor (drag joints,
keys with bezier curves, onion skin, save to the shared clip library); agent path: write clip JSON →
`xp pose-editor them` → `xp pose-editor soat` strip; `hanh_dong` entries accept `chuyen: vao-ra|nay|…` bezier
transitions (`dung-dang.md`, ideas from ArtCraft).

## Shots, dialogue, cards

Each line has `shots:` (1–4 camera shots: `set`, framing `khung`, camera `cam`, placements `nv`) drawn by
`engine/core/truyen.js` (code-drawn parallax sets with weather and light); dialogue 35–50 % of lines as question→answer
exchanges; `the_luat` rule cards, `hud`, `ket` end cards; subtitle style `giua` (big centred chunk; red danger words via
`style.danger_words` — `!!…!!` is shown literally, do not use it). `xp check script` has a story mode (`story:` key).
Every tip sourced + independently fact-checked; the story must make clear which choice was the mistake.

## Cartoon characters for any video (puppet.js)

Code-drawn characters with poses, expressions and lip-sync from the narration (`engine/core/puppet.js`). The user can
give a reference image of their own character → write a spec from it. Previews `characters/demo-*.gif`, guide
`characters.md`, `xp character demo` (`--still t`).
