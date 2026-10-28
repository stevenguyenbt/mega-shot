# News graphics, satellite scenes and the motion library

## Motion library — `chuyen-dong/`

From huashu-motion (MIT): 20 motion languages (what each *says*, when to use) + a technique cookbook (easing, mask
reveal, pill highlight, count-up, draw-on, stamp, chapter counter, continuity devices). Read the matching language file
in `chuyen-dong/languages/` (index `chuyen-dong/README.md`, techniques `chuyen-dong/techniques.md`) before designing new
graphics.

## HyperFrames motion graphics — template `news` + `xp hf`

News-style scenes in HTML + GSAP rendered by HyperFrames (HeyGen, Apache-2.0; install with
`npm i hyperframes gsap world-atlas d3-geo topojson-client` in `.mega-shot/tools/hyperframes` after asking; disable
telemetry). A scene gets
`hf: { kieu: tieu-de (headline) | ban-do (map) | con-so (number) | hai-phia (two sides) | dong-thoi-gian (timeline) | nguon (sources), … }`
(see `engine/hyperframes/tin-tuc.html`); top-level `news: { channel, date, ticker_label, ticker: [...] }` drives the
brand bar, date, live dot and ticker.

The template uses editorial-collage + data-story: pill highlight behind `**bold**` words, count-ups that land with a slam
+ drawn underline, paper cards settling with a 1–4° rotation, an "unverified" stamp, timeline entries that dim earlier
items, chapter counter `03/08`.

`xp hf [scene…]` (`--redo`) renders each scene (duration from the narration) to RGBA PNGs in `build/layers_hf/<id>/`
(cached per scene); `film.html` draws footage (`search`, optional) → HF graphics → karaoke subtitles, so narration,
review, render cache and cut checks work unchanged. Animation times can be `luc: "<word>"` = when the narration says that
word.

Maps: `vung: [lonMin, latMin, lonMax, latMax]`, `diem: [{ten, lat, lon, nhan, trai, dy, luc}]` —
`engine/hyperframes/ban_do.mjs` pre-projects Natural Earth (no network at render); Crimea is drawn hatched (annexed 2014,
not recognised by most states); labels auto-layout. Compositions must be deterministic: no `Math.random`, `Date.now`,
network. First scene `hf.dau: true` = headline visible on frame 0 (cover).

News scripts (`news:` present) are scored in news mode by `xp check script`: every scene with a number must say WHO
reported it.

**Neutrality for war/politics:** attribute every figure, put both sides' claims side by side with "could not be
independently verified", only use pages actually opened, never events that could not be verified, maps are
"illustrative locations, not front lines".

## Evidence Films / satellite scenes — `xp satellite` (`xp vetinh`)

Styles from lemo-opuscar, MIT; read `evidence/README.md`.
`xp satellite <name> --center LAT,LON --km 20 [--before <window>] --to videos/x` fetches real plates (NASA Blue Marble +
Sentinel-2 10 m, clearest recent pass, mosaicked, no keys) → scene `ve_tinh: { thu_muc, diem, duong, vung, truoc, mau_lai }`
in the news template: dive from region to place, analyst grey, reticle locks, range line with an amber km reading,
outlines, before/after scan, imagery credit chip. Never claim on screen what 10 m imagery cannot show; a claimed
area/front line says whose claim. The other 7 evidence styles are style prompts in `evidence/`.
