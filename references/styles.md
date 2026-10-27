# Visual styles — ask first, then build

mega-shot handles narration, timing, subtitles, music, export and QA for every style. The **look** comes from one of two engines in this project:

- **mega-shot templates** (`templates/…`): real footage & archival images, 2.5D stills, Three.js 3D, Blender, AI images, plain Canvas 2D.
- **huashu-art-motion** (sibling skill `.claude/skills/huashu-art-motion`): 8 explainer grammars (sketch/whiteboard, stick-figure story, Kurzgesagt-style flat 2D, Vox collage, kinetic typography, 3Blue1Brown math, keynote UI, finance charts) and 35 painterly art styles drawn in code.

Never pick the style silently. The style decides the template, the asset pipeline and the script's shot rhythm.

## The question (Step 0 — before research/script)

1. Send `references/style-gallery.jpg` (SendUserFile) — one labelled frame per style.
2. Ask with `AskUserQuestion` (header "Style"); multiSelect off; 4 options max per question, so ask in two steps when needed — family first, then the exact grammar/art style:
   - **Real images** — footage + archival photos with 2.5D parallax (documentaries, history, nature, places)
   - **Drawn / animated 2D** — sketch whiteboard, stick-figure story, flat Kurzgesagt-style, kinetic text, collage, math (explainers, tutorials, opinion)
   - **3D** — Three.js stylized or Blender realistic (objects, architecture, space, mechanisms)
   - **Art style / AI images** — one of 35 painterly styles, or AI-generated characters
   Recommend one based on the topic (table below) and mark it "(Recommended)". Mixing is allowed: a different style per scene where it helps (e.g. footage for places, whiteboard for the "why", kinetic type for the big number).
3. Record the answer in `video.yaml` / `loat.yaml`:
   ```yaml
   phong_cach: { kieu: sketch, huashu: y3_whiteboard }   # kieu = style family id below; huashu = grammar or art-style id when used
   ```
   Re-ask only if the user changes their mind; follow-up videos in a series inherit it.

## Style menu

| Id (`phong_cach.kieu`) | Looks like | Best for | Engine / how | Template | Speed |
|---|---|---|---|---|---|
| `footage` | Real video clips + archival photos | history, nature, places, news, documentaries | `tim:` per scene → `xp assets` (Pixabay/Pexels/NASA/Poly Haven; Wikimedia when allowed) | `footage` | fast |
| `parallax` (2.5D) | Photos or illustrations split into layers that move in depth, multi-angle shots | archival-heavy stories, portraits, paintings | stills in `tim:` (`loai: anh`) → BiRefNet layers + `MS.still25` / `MS.shots` | `footage` | fast |
| `sketch` | Hand-drawn whiteboard: the board writes as the narrator speaks, camera pans, final zoom-out | "why/how" reasoning, step-by-step, education | `huashu: { grammar: y3_whiteboard }` → `xp art` | `footage` (huashu scenes) | fast |
| `story` | Stick-figure character with poses, reaction cuts | personal stories, humour, first-person | `huashu: { grammar: y4_storytime }` (character frames: huashu `references/10-角色.md`) | `footage` | fast |
| `flat2d` | Kurzgesagt-like flat, glowing, infinite zoom between scales | science concepts, scale, "what's inside" | `huashu: { grammar: y1_kurzgesagt }` | `footage` | fast |
| `collage` | Vox-style desk of real documents, red pen, highlighter | news, history arguments with evidence | `huashu: { grammar: y2_vox }` with real images in `cues[].image` | `footage` | fast |
| `kinetic` | Words slam in on the beat, giant numbers, lists | lists, key numbers, quotes, chapter cards | `huashu: { grammar: y5_kinetic_type }` | `footage` | fast |
| `math` | 3Blue1Brown black background, shapes morph into the next idea | maths, ML, physics mechanisms | `huashu: { grammar: t1_3b1b }` | `footage` | fast |
| `keynote` | Dark glass cards, product UI, step tutorials | product launches, tutorials, specs | `huashu: { grammar: t2_keynote_ui }` (screenshots in cues) | `footage` | fast |
| `chart` | Honest animated charts: axes, data growing, one annotation | revenue, prices, shares, trends | `huashu: { grammar: t3_finance_chart }` | `footage` | fast |
| `painterly` | 35 code-drawn art styles (ink wash, Ghibli watercolour, Van Gogh, Monet, Bauhaus, Pop Art, 8-bit, shadow puppets, …) that are alive, not slideshows | art history, poetic/cultural pieces, travels through eras | huashu-art-motion full workflow (its `references/06` + `12` + `风格配方/INDEX.md`); use `xp narrate` for the voice and timeline, and `xp voice add` / `xp music add` for custom audio | huashu project | medium |
| `3d` | Stylized real-time 3D (PBR, HDRI lighting, rigged characters) | objects, mechanisms, space, architecture concepts | `ms3d.js` in film.html | `threejs` | fast |
| `blender` | Photoreal Cycles renders | landscapes, monuments, hero shots | `blender: canh/x.py` → `xp blender` | `blender` | slow (5–10 s/frame) |
| `ai-image` | AI-generated characters/scenes animated with Ken Burns, morphs | faces, people, fashion, beauty, fiction | `xp prompts` → user generates → `xp images` | `anh-ai` | depends on the user |
| `canvas` | Custom code-drawn infographics | anything bespoke | `draw(x, c)` | `trong` | medium |
| `mixed` | Per-scene choice from the rows above | long videos | footage template + `huashu:` scenes; 3D/Blender need a custom film.html | — | — |

## Topic → recommendation

| Topic / script | Recommend |
|---|---|
| History, geography, nature, news with real places | `footage` + `parallax` (archival), `kinetic` for key numbers |
| Science "why/how", education, explainers | `sketch` or `flat2d`; `math` when there are formulas |
| Personal story, opinion, humour | `story` |
| Business, finance, data | `chart` + `kinetic` |
| Product, software tutorial | `keynote` |
| Art, culture, poetry, "journey through eras" | `painterly` |
| Engineering, architecture, space objects | `3d` (or `blender` for hero shots) |
| Beauty, fashion, characters, fiction | `ai-image` |

## huashu scenes inside a mega-shot video

```yaml
canh:
  - id: why-salty
    loi: "Why is the sea salty? Rain dissolves minerals in rock, and rivers carry the salt to the sea."
    huashu:
      grammar: y3_whiteboard
      cues:
        - { at: 0, kind: title, text: "Why is the sea salty?" }
        - { at_word: "minerals", kind: point, text: "Rain dissolves minerals" }      # appears when the narrator says the word
        - { at_word: "rivers", lead: 0.3, kind: draw, text: "Rivers carry salt", data: { icon: stack } }
```

`xp narrate` → **`xp art`** → `xp preview` / `xp render`. `xp art` builds a huashu clip spec per scene (duration = the scene + transition overlap, cue times from the narration's word timestamps via `at_word` / `nth` / `lead`, subtitle band kept free), renders it with huashu's engine (UTF-8, cached by spec), and turns it into a normal shot of the scene: subtitles, music, SFX and transitions still apply, while mega-shot's colour grade/vignette/grain are skipped so the huashu look stays pure. Cue kinds per grammar: huashu `references/09-视频动画语法.md` §5 — an unknown `kind` draws nothing, so copy from that table. Omit `chu` on huashu scenes when the grammar already draws a title.

`xp series run` includes the `art` step automatically for scenes with `huashu:`.

## Manifesto (template `tuyen-ngon`)

Motivational / opinion shorts in an editorial "action manifesto" look: paper ↔ black spotlight scenes, people cut out and printed as photocopy halftone, red 3D block keywords timed to the narration, chapter label, closing question card. Details: `references/manifesto.md`.

## Medical 3D (template `y-khoa`)

"What happens inside your body when…" shorts: body clock on top, semi-transparent glowing human, glossy cartoon organs (brain, heart, liver, stomach, intestines, kidneys/adrenals, vessels), fly-in camera, receptor/molecule close-ups, organ labels pinned to the 3D. Sets, options, sound and health-content rules: `references/medical3d.md`.

## Philosophy / quote shorts in 3D (template `triet-ly`)

Full-frame stylised Three.js sets (`engine/backends/three/sets3d.js`): night-blue fog, warm key + cool rim, floating dust, bloom. Wooden-mannequin figures, low-poly horses and procedural architecture/nature. No downloads needed. Each scene picks a set with `canh3d: <id>` (or `{ kieu: <id>, …options }`):

| id | Set | id | Set |
|---|---|---|---|
| `hai-ngua` | thoroughbred + nag at the start line | `phong-ngu` | bedroom at dawn, figure in bed, window light warms |
| `dua-ngua` | race: fast horse bursts then stops, nag keeps walking | `so-tay` | open notebook, gold lines write themselves, candle |
| `dau-truong` | Greek amphitheatre, jeering crowd, red sound waves | `to-ong` | honeycomb rising cell by cell, bees |
| `ham-tap` | underground study: oil lamp, flipping hourglass, pebbles | `leu-tuyet` | army tents in snowfall, lit tent, flag |
| `cot-hy-lap` | podium, columns rise, figure raises an arm in a light shaft | `de-kiem` | anvil, hammer strikes, sparks, blade cools |
| `cay-nho` | vine grows on a trellis → leaves → flowers → ripe grapes | `vang-lua` | gold bar in fire, lifted out cooled and shining |
| `vach-dich` | nag breaks the finish tape, confetti, camera cranes up | `binh-minh` | sunrise over hills, figure raises both arms |
| `nui-dat` | earth mound missing its top, figure circles with a basket (`xong: true` → last basket, peak completes, sun burst) | `nhiet-ke` | pot on a stove, thermometer climbs to 99 °C |
| `ngu-cong` | two huge mountains, tiny figure with a yoke | `the-he` | generations in a chain passing baskets, mountain shrinks |
| `giot-nuoc` | water drop hollowing stone (time-lapse) | `duc-da` | chisel carves a glowing gold spiral into stone |
| `vat` | a library model (`ten:`) on a marble pedestal, turntable (`xp model`, references/models3d.md) | any set + `them: [{ ten, x, z, cao, xoay }]` | add library models into the set |

Overlays: `chu` (hook title), `trich: { chu, nguon, luc }` (quote card at the top with a gold quotation mark and the source; `luc` = first spoken word of the quote), `chot` (gold stamp line, `chot_luc` = word), `phong_cach.nhan` (corner series label). Write the source of every quote (book + chapter) and fact-check against the original before narration; never put the narrator's own comment inside quote marks.
Stylised people instead of mannequins: `phong_cach: { nguoi3d: true }` or per scene `canh3d: { …, nguoi: { gioi, da, toc, vay } }` (people3d.js, references/models3d.md).
