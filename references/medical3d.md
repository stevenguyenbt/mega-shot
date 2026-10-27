# Medical 3D — template `medical` (`y-khoa`)

"This is what happens inside your body when…" shorts: a **body clock** runs on top of every scene (0 s → 10 min → 45 min → 1 h → 5–6 h), each time mark is a different stylised glossy 3D set, organ names are pinned to the 3D, and the video ends with a surprising fact + a comment question. The clock is a retention device: viewers wait to see the last number (the same reason running counters work in other viral shorts).

Look: deep navy studio with a teal centre glow, glossy clear-coated organs in clean saturated colours (cartoon-medical, never real tissue, never blood or gore — Facebook-safe), a semi-transparent human with a cyan fresnel rim, glowing particle streams. Everything is procedural (`engine/backends/three/medical3d.js`), no downloads, deterministic per frame.

```
xp new body-<n>-<topic> --format 9x16 --template medical
```

## Sets (`yk:` on a scene)

| id | What it shows | Options |
|---|---|---|
| `ly-ca-phe` | coffee cup on a saucer, steam, a caffeine molecule + gold molecules rising | `phan_tu: false`, `nhan: "CAFFEINE"`, `sua: true` (cup of milk) |
| `co-the` | transparent human with brain, lungs, heart, liver, stomach, small + large intestine, kidneys + adrenal glands, oesophagus, arteries/veins | `soi: [organs]` highlight (others go translucent, glow pulse, name labels) · `bay: <organ>` camera flies through the skin into that organ (`bay_tu`, `bay_den` = scene fractions) · `uong: [0.1, 0.7]` a swallowed bolus travels down the oesophagus · `dong: nao\|tim\|gan\|thuc-quan` gold caffeine stream along that path · `muc: [1, 0.5]` gold particles circulating everywhere, amount follows the level · `goc: truoc\|nghieng\|xoay` · `tam: [x, y, z, dist]` custom framing · `nhip: 75` heart animation · `mo_hoi: true` sweat beads on face/neck · `do_mat: true` alcohol flush (red glow spreads over face, neck, upper chest) |
| `da-day` | J-shaped stomach + coiled small intestine + a vessel; brown coffee swirls | `hap_thu: true` gold molecules cross the gut wall into the vessel (label "into the blood") · `mau_hat: 0xff4020` swirl colour |
| `mach-mau` | camera flies inside a blood vessel: tumbling red blood cells + gold caffeine molecules | `adrenaline: true` orange particles · `caffeine: false` · `chat: ethanol` (gold ethanol, label "alcohol") · `nhan` |
| `nao` | glossy brain with gyri, cerebellum, stem; sparks of activity | `vao: true` push-in in the second half |
| `thu-the` | neuron membrane with receptors; blue adenosine docks (receptor glows blue); with `chan` gold caffeine takes the seats and adenosine is pushed up and away | `chan: [0, 0.8]` share of receptors taken by caffeine over the scene |
| `tim` | beating glossy heart (aortic arch, pulmonary trunk, vena cava, coronaries), pulse ring | `nhip: [70, 80]` beat speed (animation only — do not show it as a measured value) · `thuong_than: true` kidney + adrenal gland releasing orange adrenaline toward the heart · `hormone: "CORTISOL"` renames the hormone label |
| `gan` | liver + gallbladder; gold caffeine molecules enter and split into three coloured metabolites ("ENZYME CYP1A2") | `chuyen_hoa: false` · `chat: ethanol` alcohol: gold ethanol → ADH → orange ACETALDEHYDE → ALDH2 → green acetate drifting away · `cham: true` ALDH2 slow (flush): acetaldehyde piles up, red glow |
| `phan-tu` | one molecule turntable, ball-and-stick: caffeine (C grey, N blue, O red), capsaicin (red-orange ring + chain) or ethanol (C₂H₅OH, white H) | `chat: capsaicin\|ethanol` · `nhan` |
| `luoi` | glossy tongue (median groove, papillae) in a lower-teeth arc; a red chili comes in for a bite, capsaicin spreads, the tongue turns hot red-orange, heat shimmer | `ot: false` · `can: [0.3, 0.6]` bite window · `nong: [0, 1]` heat · `sua: [0.1, 0.75]` milk washes over and cools it |
| `kenh-nhiet` | nerve membrane with TRPV1 heat channels (4 subunits around a pore); capsaicin docks (or heat waves arrive), channels open orange, ions rush in | `mo: [0, 0.9]` share open · `nhiet: true` heat instead of capsaicin · `nhan_nhiet: "HOT ~43°C"` |
| `khop` | finger-joint (MCP) cut-away: ivory bones with blue cartilage caps, translucent joint capsule, golden synovial fluid; pulling widens the gap and a cyan gas cavity pops (x-ray, shows through bone) with a flash ring + burst = the crack | `keo: [0.15, 0.78]` pull window · `rac: 0.82` crack moment (scene fraction — sync to the spoken word from `build/timeline.json` subs) · `bot: true` cavity already there · `tan: [0, 0.95]` cavity dissolving · `nhan: false` / `nhan_bot` |
| `ban-tay` | x-ray hand (cyan fresnel skin, ivory bones) palm to camera; index finger flexes, knuckle flashes on the crack | `be: [0.2, 0.55]` bend window · `rac: 0.58` · `tat_ca: true` all fingers bend · `soi: true` knuckle glow · `nhan` |
| `ly-bia` | tall clear glass of golden beer, foam head, rising bubbles; gold ethanol molecules float up (label "alcohol · ethanol") | `phan_tu: false` · `nhan` |
| `da` | skin cut-away block: opaque epidermis (wheal bump + redness via vertex colours), translucent dermis with a red capillary (flowing cells), blue vein, yellow nerve, purple mast cells, yellow fat lobules; a stylised female mosquito (striped legs/abdomen, iridescent wings) lands, its fascicle (6-needle bundle, gold) probes down to the capillary, green saliva spreads, the abdomen fills red, then it flies off; mast cells release magenta histamine; itch pulses run up the nerve | `muoi: false` · `dap: [0, .75]` land window · `bay: .9` fly-off · `chich: [a, b]` probe · `hut: [a, b]` suck (belly fills) · `nuoc_bot: [a, b]` saliva · `mast: [a, b]` histamine · `sung: [0, 1]` wheal + redness · `ngua: true` itch signal · `lop: true` layer labels (built-in Vietnamese: epidermis, dermis, capillary) · `gan: true` close-up on the bite · `nhan_muoi: false` / `nhan_voi` · `nhan: false` |
| `mui` | x-ray head + neck in profile (face → +x): nasal cavity with turbinates, mouth, pharynx, vocal folds, trachea, lung tops, brain + brainstem, yellow trigeminal nerve, Eustachian tube → eardrum; irritant specks enter, a nerve signal lights the sneeze centre, breath in, pressure glows orange, the sneeze blasts a droplet cloud out (camera shakes, pans to follow) — or, held in (`nin`), nose/mouth glow sealed, the airway flashes red, rings run up the Eustachian tube and the eardrum bulges | `bui: [a, b]` · `tin_hieu: [a, b]` · `hit: [a, b]` · `ap: [a, b]` (built-in label "ÁP LỰC TĂNG" = pressure rising; override with `nhan_ap`) · `hat: .3` sneeze moment · `nin: true` held in · `lop: true` labels · `gan: mui\|tai\|hong` close-up · `nhan_hat` · `nhan: false` |

Organ ids for `soi` / `bay`: `nao tim phoi gan da-day ruot-non ruot-gia than thuong-than thuc-quan mach`. New topics reuse these sets (alcohol → `gan`, `nao`; crying → add a tear-gland set; mosquito bite → `da`; cuts/wounds can reuse `da` with `muoi: false`). Add sets to `SETS` in `medical3d.js` following the same `(o) → { G, mood, update(s, K) → labels }` shape; `update` returns `[{ text, p: Vector3, a }]` and the template draws the label pills.

## Scene overlays (template `y-khoa/film.html`)

- `dong_ho: [from, to]` body-clock seconds for this scene (counts up, log-eased for big jumps; one number = fixed). 0 → "0 GIÂY", 600 → "10 PHÚT", 3600 → "1 GIỜ", 5400 → "1 GIỜ 30 PHÚT", 21600 → "6 GIỜ", 172800 → "2 NGÀY" (whole days from 48 h); 0.1 → "0,1 GIÂY" (tenths below 1 s). Hide on a scene by leaving `dong_ho` out; `phong_cach.dong_ho: false` hides it everywhere. **Note:** the clock units and the built-in organ/set labels are currently drawn in Vietnamese (GIÂY = seconds, PHÚT = minutes, GIỜ = hours, NGÀY = days; "VÀO MÁU" = into the blood, "CỒN" = alcohol); set `nhan` on a set to override its label, or edit `clockText()` in `templates/y-khoa/film.html` for another language.
- `muc: { nhan: "CAFFEINE IN BLOOD", tu: 100, den: 50 }` level bar (percent) under the clock.
- `nguon: "EFSA 2015"` small source chip above the subtitles — every number on screen gets one.
- `chu` hook title under the clock (`chu_giu` fade) · `chot` gold stamp (`chot_luc` word) · `hoi: "How many cups|do you drink a day?"` comment-bait speech bubble (`|` = line break, `hoi_luc` = word).
- `phong_cach: { nhan: "INSIDE YOUR BODY", subtitle_style: giua, phu_de_y: 0.74 }` (brand line above the clock; big centred subtitles low enough to keep organs visible).

## Sound

Self-made CC0 body sounds (`tools/am_co_the.py`, already in `.mega-shot/sfx/tu-nhien/`): `tim-dap-72`, `tim-dap-84` (40 s heartbeat loops), `tieng-uc` (gulp), `soi-bung` (stomach gurgle), `lap-lanh` (molecule sparkle), `rac-khop` (knuckle crack), `vo-ve` (mosquito whine, 3 s, approaches then lands), `hat-xi` (sneeze: breathy inhale + burst). Use per scene: `am: [{ ten: "tu-nhien:tieng-uc", tu: "<spoken word>", muc: 0.5 }]`. Music: a quiet original score (`xp compose` (old name `xp nhac`), `am_luong` ≈ 0.3) so the voice stays clear.

## Content rules (health)

- Every number from NHS / Mayo Clinic / MSD Manual / EFSA / FDA / NCBI / peer-reviewed papers, written into `nghien_cuu.md` with URL + short quote; an **independent agent fact-checks the script before narration**.
- No treatment advice, no health promises, no "cures/burns/detox"; hedge variable effects ("in many people", "may"). Ranges, not single precise times, when the literature gives ranges.
- Caption ends with a disclaimer such as "For information only — not a substitute for medical advice." and lists sources.
- Put the clock only on sourced time marks — leave `dong_ho` out where the literature gives no timing.
