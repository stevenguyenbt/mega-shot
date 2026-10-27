# Motion library (from huashu-motion)

Copied verbatim from https://github.com/alchaincyf/huashu-motion (commit 3e92780), MIT licence — see LICENSE-huashu-motion.txt.
(`chuyen-dong` = *motion*; `NGUON` = *source*.)

Use it as a "dictionary" when designing HyperFrames/GSAP graphics (template `news` / `tin-tuc`, `engine/hyperframes/`) and huashu scenes:
- `README.md` — 4 layers: format → motion language → technique → picture & sound.
- `languages/` — 20 motion languages (what each one *says*, what it suits): news bulletins use **editorial-collage** + **data-story**; explainers use **mechanism**, **flat-world**; slogans/hooks use **kinetic-type**.
- `techniques.md` — recipes: easing, mask reveal, pill highlight, count-up, draw-on, stamp, chapter counter, continuity (flood, iris, whip, match cut…).
- `sound.md`, `rhythm.md` — writing ABC scores for `xp compose` (old name `xp nhac`) (marks `!mark:<scene id>!`, `!hit!`, `!rise(!…!rise)!`, `!stop(!…!stop)!`, dynamics `!p!…!f!`) and energy curves.

Mentions of `om …` / `OM.*` are huashu-motion's own commands; in mega-shot use `xp hf`, `xp compose` (old name `xp nhac`) and GSAP directly.
