# Blender playbook (94 guides) — how to use them in mega-shot

The folders here are an MIT-licensed set of Blender craft guides (see `LICENSE-blender-skills.txt`). They were written for driving Blender over MCP; **in mega-shot you never use MCP** — every guide's "execute" step becomes Python in a scene script that calls the studio kit `engine/backends/blender/msb_lib.py` (class `Kit`, inherited by `msb.MS`). Read the guide for *what good looks like* (proportions, lighting ratios, palettes, checklists); write the result with the kit.

## 1. Route the request (read 1–3 guides, not all)

Start from `blender-director/SKILL.md` only when the request is vague. Otherwise pick directly:

| Request | Read | Kit style (`ms.phong_cach`) |
|---|---|---|
| Character / mascot / toy figure | `character-artist`, `character-archetypes`, `chibi-style` or `cartoon-style` | `do-choi` |
| Creature / animal | `creature-artist`, `sculpting` | `do-choi` / default |
| Prop, food, product shot | `prop-artist`, `materials`, `lookdev` | default / `anime-cel` |
| Vehicle, machine, hard edges | `vehicle-artist`, `hard-surface` | default |
| Landscape, island, biome | `environment-artist`, `biome-worlds`, `vegetation-artist`, `set-dressing` | `low-poly` / default |
| Interior, architecture | `archviz`, `brutalist-mood`, `liminal-space-style` | default |
| Historical scene | `historical-worlds`, `scene-assembly` | default |
| Fantasy / sci-fi / post-apocalypse | `fantasy-worlds`, `sci-fi-punk-worlds`, `apocalypse-worlds` | default / `kinh-di` |
| Anime / manga / comic look | `anime-style`, `manga-style`, `comic-book-style` | `anime-cel` |
| Low-poly, voxel, isometric, PSX | `lowpoly-style`, `voxel-style`, `isometric-style`, `psx-horror-style` | `low-poly` |
| Horror, noir, gritty | `horror-style`, `noir-style`, `dark-gritty-mood`, `folk-horror-style` | `kinh-di` / `noir` |
| Cozy, dreamy, surreal | `cozy-wholesome-mood`, `dream-surreal-mood` | `do-choi` |
| Lighting / camera / compositing | `lighting`, `camera-cinematography`, `compositing`, `rendering` | — |
| Particles, smoke, water, cloth | `vfx-fx`, `physics-sim`, `cloth-sim` | — |
| Procedural scattering, geometry nodes | `procedural-modeling`, `geometry-nodes` | — |
| Animation | `animation`, `rigging` | — |
| Matching a reference image | `references/reference-image-match.md`, `references/visual-match-checklist.md` | match the reference |

Ignore the game-export guides (`*-export`, `lod-pipeline`, `retopology`, `uv-workflow`, `genre-*`) unless the user is building a game asset.

## 2. Write the scene with the kit

```python
# canh/x.py  →  xp 3d canh/x.py   (single image)   or   blender: canh/x.py in video.yaml  →  xp blender <id>
def build(ms, ctx):
    ms.phong_cach('do-choi')                         # anime-cel | do-choi | low-poly | noir | kinh-di | default
    ms.nen('#e8d8c4', .35)                           # or ms.bau_troi(cao=24, phuong_vi=150, nang=2.2)
    da = ms.vl('da', '#f6c9a8')                      # materials: da vinyl nhua su vai len kim-loai kinh nuoc go be-tong gach phat-sang dat-set toon mo
    ms.blob('than', [('ELLIPSOID', (0, 0, .3), .15, (1, .9, 1.1)), ('BALL', (0, 0, .6), .12)], da)   # soft organic mass, fitted to its elements
    ms.khoi('hop', (0, .5, .6), (.4, .2, .3), ms.vl('su', '#f4f2ee'))      # primitives: cau hop tru non xuyen nang (bevel + subsurf built in)
    ms.ong([(0, 0, 0), (.1, 0, .2), (.2, 0, .3)], .02, da)                  # tube along points (limbs, noodles, cables)
    ms.rai(obj, 16, (-3, 3, -2, 2), seed=4)                                 # scatter copies (trees, rocks)
    ms.den_3_diem(target=(0, 0, .4), dist=2.4, key=260)                     # three-point light, ratio set by style
    ms.may((0, 0, .4), dist=1.8, az=-40, el=10, lens=50, fstop=2.8)         # camera
```

Also available: `ms.chu(text…)` 3D text and `ms.low_poly(obj, ratio)` (facet a mesh). The old `msb.MS` helpers (`hdri`, `sun`, `pbr`, `box`, `camera`, `look`) still work in the same script.

## 3. Check before you call it done

- Render at `--draft` / `--samples 32`, **look at the PNG**, fix the shape that reads wrong (floating parts, intersecting lids, black faces), then render final.
- Use the guide's checklist (`references/validation-checklist.md`, `qa-review`) as the review list.
- Worked examples: `videos/_nhanvat2/3d-thu/` (a = toy character, b = low-poly island, c = anime-cel ramen).
