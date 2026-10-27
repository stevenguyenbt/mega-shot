# Story films — "What if…" survival / story-driven explainers (template `truyen`)

Learned from a 6-minute reference film (flat 2D, "If the zombie apocalypse starts while you're on a farm…", 150+ shots).
The knowledge is real; the story is the delivery vehicle. Every tip must be true and sourced (`nghien_cuu.md`, fact-check agent).

## 1. Structure (75–100 s pilot; scale the same beats to 5–6 min)

| % | Beat | What happens | Example (flash-flood pilot) |
|---|---|---|---|
| 0–5 | **Hook "What if you…"** | 2nd person scenario + promise + one stupid mistake to avoid | "If a flash flood hits at midnight… don't run for the main road." |
| 5–15 | **Protagonist + stakes in numbers** | named character, place, what they have (counts), a clock | Minh, his grandmother, a house next to a stream, 3 days of rain |
| 15–45 | **Choice → cost loop** ×2–3 | each smart move = a TIP, each move creates a new problem; a RULE CARD per tip | the motorbike → 5 minutes lost; the main breaker; the go-bag |
| ~25 | **Twist** | the plan breaks: new information, the map changes | the road out runs along the stream — already flooded |
| 45–70 | **Escalation + countdown** | numbers shrink (30 cm → 50 → 80), the safe option closes | the water rises; grandma slips |
| ~70 | **All is lost** | silence beat, the character can't find the next move | |
| 70–85 | **Turn** | the tip applied under pressure saves them | climb the hill at right angles to the current, flash a light, call the emergency number |
| 85–95 | **Theme line** | one sentence the viewer remembers (not a tip — a truth) | "In a flood, what saves you is deciding to leave five minutes earlier." |
| 95–100 | **Cliffhanger → next episode** | a new threat + end card "NEXT EPISODE: …" | "…the next morning, the hill began to crack." |

Rules: a turn every 15–25 s · numbers make stakes (counts, distances, minutes) · one tip = one rule card ("FLOOD RULE #2 · PEOPLE FIRST, THINGS LATER") ·
DIALOGUE 35–50 % of lines (`truyen.ty_le_thoai` overrides), ≤ 12 words a line, in EXCHANGES (≥ 2 question → answer pairs; let characters say what the narrator would otherwise tell), each line reveals character or raises stakes · one deliberate SILENCE beat · never moralise twice.

## 2. Writing the lines (video.yaml)

- One scene = one spoken line (2–5 s). Narrator lines: `loi`; a character line: `ai: <id>` + `loi` (voice from `nhan_vat.<id>.giong`).
- `phu_de` = the on-screen chunk (big centred caption): short, **keywords** in `**…**`; danger words (red) are listed in `phong_cach.tu_do` — `!!…!!` is NOT parsed by the `giua` style and would show literally.
- `nhan_vat:` — the character bible: `{ ten, giong: { mau }, ve: { … look … }, tinh_cach, cau_cua_mieng }`. Same look in every shot.
- `the_luat: { so, chu, phu }` — rule card · `hud: { nhan, so, don_vi }` — counter card · `ban_do:` — top-down tactical map.
- `shots:` — 1–4 camera shots per line, cut on word timings (see §3). Write them; `xp review` shows the storyboard.

## 3. Shot grammar (one shot every 1.5–3 s)

| `khung` | Use | Camera (`cam`) |
|---|---|---|
| `toan` (wide) | place, geography, who is where | slow push `day`, lateral `lia` |
| `trung` (medium) | dialogue, action | slight push, `rung` (shake) on impact |
| `can` (close-up face) | emotion, a decision, a line of dialogue | push `day` |
| `vat` (insert) | the object of the tip: switch, bag, water mark | macro push |
| `tren` (top-down map) | plan, distances, the twist | zoom / pan with labels |
| `qua-vai` (over the shoulder) | dialogue: the speaker (`nhin`) seen past the listener's back (listener auto: bigger, darker, turned away) | push `day` |
| `phan-ung` (reaction) | close-up of the LISTENER while the other speaks (auto nods / blinks) | push `day` |
| `doi` (two-shot) | both characters, framed by heads + feet over the whole shot | `day` / `lui` / `theo` |

Dialogue coverage (game-cutscene grammar): establish with `doi` → speaker A in `qua-vai` (over B) → B answers in `qua-vai` (over A) → `phan-ung` on whoever is hit by the line → back to `doi` for the action. Keep screen direction: A stays left, B right in every shot (the world positions do this automatically; never swap `x` between cuts). `cam: theo` follows a walking character.

Acts get grades: day / night-blue / flashback sepia / storm grey. A cut every 1.5–3 s; hold longer only on the silence beat.

## 4. Characters & motion (engine/core/nhanvat.js + nhanvat_clip.js — skeleton, clips, IK)

Characters are jointed skeletons (pelvis, 3 spine joints, neck, head, arms, legs, feet) that turn smoothly between `goc` angles
(`ngang` profile, `3-4`, `thang` front, `lung` back, `lung-3-4`) and play CLIPS that cross-fade like a game state machine.
`nv` placement keys: `x`, `y`, `huong`, `goc`, `bieu_cam`, `tu_the` (old single pose = first clip), and:
- `di: x2` (+ `y2`, `di_tu` / `di_den` 0–1 of the shot, `toc: cham|vua|nhanh|chay|<px/s>`, `kieu_di: di|di-cham|chay|chay-hoang|leo`) — walk with root motion; steps follow the distance so feet never slide; slopes come from `y → y2`.
- `hanh_dong: [{ t (s) | u (0–1), clip, mix, tu (start offset s), xong (start at the end pose), huong, goc, bieu_cam, nhin, toi }]` — the action timeline (blend `mix` s, default ~0.28).
- `nhin: <id> | camera | [x, y]` — head + eyes follow (default in 2-person shots: speaker looks at listener, listener at speaker).
- `toi: <id> | { ai, bo_phan: tay|vai|dau|lung, tay: gan|xa|ca-hai }` — arm IK onto another character (two characters reaching for each other's hands meet halfway); `toi_mau: 0–1` silhouette.
- A speaking character (`ai:` of the line, or `noi: true`) lip-syncs per syllable and gestures on stressed words; listeners nod.

Clips: idles `dung` `nhin-quanh` `tho-doc` `run-ray` `khoanh-tay` `chong-nanh` `suy-nghi` · upper-body (play over a walk) `cam-den` `chi` `vay` `gio-tay` `gat-dau` `lac-dau` `nam-tay` `diu` ·
whole body `cui` `cui-nhat` `keo` `day` `om` `lay` `giat-minh` `nhay` `nga` `do-day` `quy` · sitting / lying `ngoi` `ngoi-xuong` `dung-day` `nam` `ngoi-day` · locomotion `di` `di-cham` `chay` `chay-hoang` `leo`.
Expressions: `binh so hoang quyet buon cuoi gian ngac met nghi vui`.
REUSE ACROSS CHARACTERS (retargeting): clips store joint angles, never pixels of one body, so every clip plays on every character with no re-animation.
Body proportions per character: `ve.dang: nguoi-lon | tre-em | cao-gay | thap-dam | chibi` or `ve.ti_le: { chan, tay, than, dau, vai, rong }` (multipliers);
step length, hip height, sitting / lying heights and reach rescale automatically. Look per character: default flat-2D, or `ve.kieu: que` (stick figure, `ve.mau` line colour) —
a new look is one draw function over the same skeleton. New clips added to nhanvat_clip.js immediately work for every existing character.
Check it: `/ms/core/nhanvat_demo.html?retarget=1` (rows = clips, columns = body types).
Building a character FROM A REFERENCE PICTURE: pick `dang` / `ti_le` for the silhouette (head-to-body ratio first), then the look keys —
`dau_rong` (head width), `ma` (puffy cheeks), `may: day` (thick brows), `kinh: true|den` (glasses / sunglasses), `toc: { kieu, mau, tran }` (tran = forehead hairline 0.4–0.8),
`ao: { kieu: khoac|ao|vest-mo }`, `xam` (tattoo colour), `day_chuyen` (chain colour), `cam: hoa-hong` (held prop), `balo`, `ao_phao`, `rau`.
Compare side by side on `/ms/core/nhanvat_demo.html?mau=<url-encoded ve JSON>` (8 poses / angles). Voice: `giong: { mau, cao_do: +5 }` shifts pitch in semitones (child / cartoon voice) without changing timing.
CHARACTER STUDIO (preferred — no AI images): `ve: { kieu: anh, xuong: { dang: tre-em|nguoi-lon|gia, da, toc: { kieu: xu|ngan|bob|bui, mau }, mat: { mau }, ao: { kieu: khoac-mo|thun|ba-ba, mau, mau_trong },
quan: { kieu: short|dai, mau }, giay: { kieu: the-thao|dep, mau, day }, kinh: { mau }, day_chuyen, ma, may } }` — engine/core/xuong_nhanvat.js draws every part as vector shapes and finishes them with
illustration layer styles from engine/core/hieuung_lop.js (outline by exact distance transform, cel inner shadow, rim glow, bevel light, tapered ink — algorithms ported from PhotoCraft, MIT/Apache,
credit kept in the file), then hands the parts + pivots + bone lengths + eye/mouth sets to the cut-out renderer. ANATOMY CORE (engine/core/giaiphau.js): write the character in words — `xuong: { mo_ta: "cậu bé 8 tuổi, mập, tóc xù nâu, áo khoác xanh ngọc, quần short nâu, kính cam", phong_cach: anime }` (the keyword parser is Vietnamese-only, so `mo_ta` is written in Vietnamese — this example means "8-year-old boy, chubby, messy brown hair, turquoise jacket, brown shorts, orange glasses") —
the parser fills age / sex / build / hair / clothes / colours, the solver derives every length and joint width from one head height and an age-sex-build canon (user `ti_le` clamped
0.75–1.35 and rebalanced, notes printed as page warnings), parts are drawn around shared joint landmarks with a fixed overlap, and on load a QA pass renders 7 test poses in both
directions, measures coverage at every joint and auto-raises the overlap if a limb joint opens (`/ms/core/xuong_qa.html?mo_ta=a|b|c` shows the sheet + report). Cameras use the
character's region map (`MS.nv.vungAt`: face / head / upper body / full body) for can / trung / doi framing. Low-quality pictures: run `xp restore <image> [--scale 4]` first (analysis JSON + rebuilt `_taitao.png` + before/after) and point `mat_anh` at the result (multiply `mat_cat` / `mat_elip` by the scale). Photo face on a studio body: `mat_anh: face.jpg, mat_cat: [x, y, w, h],
mat_elip: [cx, cy, rx, ry]` (background removed by border-colour flood fill, feathered, outlined; the photo keeps its own eyes / mouth — no lip-sync on it).
DRAWING STYLES: `xuong.phong_cach: anime | anime-manga | anime-mem | anime-chibi | anime-thanh-nien` (thanh-nien: adult face + almond eyes driven by one row of numbers per expression in `EYE_NG` — lid, slope, low, R, ir, look; hair `bom`, outfits `so-mi|hoodie|blazer|thun` drawn by `torsoNG` with soft silhouettes and fold ink, relaxed clips `dung-ngau`, `gai-dau`; sheet page `xuong_sheet.html`, `?bo=1` wardrobe) (engine/core/xuong_anime.js, archetype `vai: chau|ba`) — the style is a set of knobs (line width / line colour from the fill, cel tone count + offsets, soft blur, rim, bevel, lash weight, blush) applied to the same character, so a new style = a new preset; gallery `/ms/core/xuong_demo.html?styles=…&zoom=…`. Add new hair / clothes / props as new drawing branches there; preview layer styles on

BODY CORE (adult style `anime-thanh-nien`) — one standard for every character, so shapes and motions stay reusable:
- **Shape = masses, not outlines.** `xuong.hinh_the: <preset>` + `xuong.khoi: { … }` overrides (giaiphau.js `HINH_THE`). Keys: `w` all widths, `cao` height, `chan / tay / than` lengths, `vai` shoulders, `nguc` chest, `eo` waist, `bung` belly (1 = flat), `bung_thap` belly low, `hong` hips, `dui` thighs, `bap_chan` calves, `bap_tay` arm mass, `co` neck, `gu` hunch (rad), `tuoi`, `gioi`, `tay_kieu`, `the_thao`. Presets (from the archetype sheets): vua, gay, om, mum-mim, cao-kheu, be-trai, be-gai, thieu-nien, ong-gia-gay, luc-si, rat-beo, vai-rong, nu-chien-binh, thap-dam, ba-lao-cong, dong-ho-cat, qua-le, qua-tao, nu-mum-mim. Old `than_hinh` values map onto these.
- The torso outline is the soft union of masses (neck, trapezius, deltoid, chest, waist column, belly, pelvis) in `xuong_anime.js` (`MASS`, `Wy`). Clothes are drawn on that hull: loose cuts drape from the chest to the belly line, fitted cuts (female, athletic, t-shirt) follow it. Limbs are organic profiles (`limb()`: deltoid → bicep → elbow → forearm → wrist; thigh → knee → calf → ankle), not tubes.
- **Posture comes from the body.** The rig gets `tayMo` (arms hang clear of a wide belly/chest, computed from the hull), `gu` (hunched spine, head kept forward, hips back and soft knees for balance), and a wider stance for thick thighs. Every clip plays unchanged on every shape.
- **Hands** are separate pieces pinned at the wrist: `tay_kieu: that | hoat-hinh | gang` × pose `tha | xoe | nam | chi`. Clips choose the pose with channels `g?` (fist), `k?` (point), `o?` (open), N/F like the arms.
- **Seamless joints**: body parts are built without a baked outline; each keeps its outline as a separate ring (`rf` full, `rm` with the root joint erased: shoulder sockets + neck on the torso, the top of each arm / leg / crotch piece, the wrist of each hand). The renderer draws every full ring first (one continuous silhouette line), then each part's masked ring + fill in depth order — no line where an arm grows out of the shoulder, but an arm in front of the chest keeps its line.
- **Torso outline = anatomical landmarks** (xuong_anime.js `prof`): half widths at neck, trapezius slope, shoulder point, deltoid, armpit/chest, waist (or belly), hips, hem — joined by a monotone cubic (PCHIP: smooth, no overshoot, no notches). Separate FRONT (+x, the side the face looks to) and BACK profiles for the 3/4 view: a belly or bust pushes forward, the seat pushes back, the back stays flat; mirrored when the character turns. Shoulders slope from the neck; the deltoid is never wider than the chest (no shoulder peaks) unless athletic. Arm clearance (`tayMo`) only clears the back-side bulk — the far arm hangs behind a belly as in real 3/4. Variable line weight: outlines are thin on the light side (top-left) and heavier on the shadow side. Debug every part image + outline rings with `xuong_manh.html?manh=than,tay_R&spec=…`.
- **Heavy bodies (rules from figure-drawing guides)**: the torso is one egg/oval — the tummy starts under the chest, is widest low, and its underside wraps in toward the waistband (the belly 'apron' hangs over the pants); in 3/4 the belly pushes FORWARD only, the back stays flat; chest narrower than the belly (no balloon, no pancake); neck short and thick, merging with the jaw (soft double chin) and flowing into the shoulders; thighs thick and touching (no thigh gap), tapering to small ankles; upper arms thick, tapering to the wrists; shirt folds are stress lines pointing at the belly, never horizontal hoops; keep `w` (overall width) moderate (≤ 1.25) and put the mass in `bung` / `dui` / `bap_tay`.
- **3/4 torso**: centre-front details (collar, tie, placket, buttons, print) sit toward the front side (`tcF`); the near arm hangs IN FRONT of the torso side, the far arm behind it.
- **Faces & hair for big casts** (engine/core/toc_nhanvat.js, load after giaiphau.js): `xuong.toc.kieu` = bom (spiky) | ngan (short, side-swept) | dau_dinh (buzz) | xoan (curly) | mai_lech (long side fringe) | dai (long) | duoi_ngua (ponytail) | hai_bim (twin tails) | bob | bui (bun) | vuot_nguoc (slicked back, shaved sides) | hoi (balding) | trui (bald); `toc.phu` = hair-tie colour. Face: `mat_dang` oval|tron|dai|vuong|nhon · `mat_kieu` thuong|tron|to|sac (upturned)|cup (droopy)|hep · `may_kieu` thuong|day|manh|ngang|cong|xech · `mui` gach|cham|cao|tron · `dau: [tan_nhang, not_ruoi, rau, ria, seo, ma_hong]` · `rang: nhon` (sharp grin, otherwise normal teeth). Random cast: `MS.xuong.ngauNhien(seed, { gioi, tuoi, hinh_the })` → a full, plausible spec (gender/age-weighted hair, face, eyes, skin, body shape, outfit, colours), reproducible per seed. Sheets: `xuong_sheet.html?mat=24&seed=1` (face/hair grid), `?dan=16&seed=40` (full-body random cast).
- **Waist & hips**: the garment outline finds the natural waist (narrowest point between chest and hip line), joins chest → waist → hips with smooth S-curves, and below the widest point (hips or belly) the fabric falls straight — it never tucks back in (no peplum ears, no bag shape). Female tops end near the hip line. The pants pelvis is a briefs-shaped piece (waist width → hip width → thighs → crotch) with no outline of its own; thigh tops are round caps hidden under it, and hip joints spread with wide hips so the outer thigh continues the hip line.
- **Bending torso**: the torso is a strip warped along the spine (neck → waist → hip, `kieu: 'day'`), so bows, squats, digging and dance sways curve at the waist; the head follows the spine only up to a limit (the neck compensates) so the face stays readable.
- **Arm depth**: an arm reaching forward or across the chest is drawn in front of the torso (behind the head). Only clips flagged `mat: 1` (hands on the face, e.g. `khoc`) draw the hands over the face.
- **Actions** (nhanvat_clip.js): idle (dung, dung-ngau, chong-gay with a cane, khoanh-tay, chong-nanh, suy-nghi, gai-dau), gestures (chi, vay, gio-tay, vo-tay, co-vu, khoc), fight (dam, do-don, da), work (nang, nem, dao, keo, day, lay), body (ngoi-xom, quy, ngoi, ngoi-bo-goi, nam, cui-chao, vuon-vai, mua, nhay, nga, do-day), locomotion (di, chay, chay-hoang, leo).
- QA pages: `xuong_sheet.html?hinh=1` (all shapes), `?dong=1[&hinh_the=…]` (all actions on one shape), `?bo=1` (outfits), `?clip=<clip>&t=<s>` (big close-up of one pose).
`/ms/core/hieuung_demo.html`. Film pages load hieuung_lop.js + xuong_nhanvat.js after nhanvat_clip.js.
CUT-OUT characters from a drawn parts sheet (looks exactly like the artwork, same clips / IK / lip-sync): `ve: { kieu: anh, bo: <folder>/bo/rig.json }`.
Pipeline: one AI-generated rig sheet (full figure + separated parts with rounded joint ends + blank-face head + eye sets + mouths + glasses, plain white)
→ `uv run --with pillow --with numpy python tools/tachmanh.py sheet.png manh --gop 3` (parts → manh/*.png + manh.json + _ban_do.png numbered map)
→ a small per-character rig script (one Python file next to the sheet, written per character) naming parts, pivot / tip points (sheet px), bone lengths, face anchors and
expression → eye-set / viseme → mouth tables → `bo/rig.json`. Film pages preload it (`MS.nv.loadCast`). Limbs MUST be strips (`strip()` in the rig script: upper segment pasted over the lower one at the joint, kind `day`) — the engine bends each strip along hip→knee→ankle / shoulder→elbow→wrist in thin slices, so knees and elbows never show cut lines; only head, torso, shorts/waist, shoes, fist stay rigid. Projection is matched to the near-front artwork (full stride sideways, body width kept, `rong_ngang`), gestures use the arm on the facing side (always `L`), each arm uses ITS OWN drawing (`tay_R` = back-side arm, `tay_L` = facing-side arm, thumbs towards the body — never reuse one arm for both), sleeves tuck under the jacket shoulders (arms drawn behind the torso unless the hand crosses the body), shoulders sit at the jacket's outer edge (`shW`), and the whole body mirrors with the art when facing left. One view (3/4) is mirrored for the other direction;
add a profile sheet for true side views. Copyrighted characters (anime, cartoons, mascots): fine for an internal test, but for anything published change the design enough that it is not a copy. Preview every clip: `/ms/core/nhanvat_demo.html` (`?clip=<name>`).
Staging tips: reach IK only works within arm length (~190 px at scale 1) — put the two characters close; a fallen character lies with the head on the BACK side (`huong` = the way they faced); sets have parallax layers and wind (`gio: 0–2`).

## 5. Checks before voice

`xp check script` (story mode when `truyen:` is present) + an independent agent: hook in the first line; ≥ 3 numbers; a rule card per tip;
a twist by 30 %; countdown; theme line; cliffhanger; every tip sourced; no dangerous advice; dialogue 35–50 % with ≥ 2 exchanges; every speaker visible in a shot of their line.
