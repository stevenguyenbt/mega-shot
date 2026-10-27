# Evidence Films — real material, every number measured or sourced

Source: [lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar) by LemoLab (code and docs MIT — `LICENSE-lemo-opuscar.txt`; the
demo films are CC BY 4.0 and are NOT copied here). Copied: the 8 "Evidence Films" style prompts (`<style>.md`), their
demo notes (`<style>.demo.md`, shot lists and score structure — grammar only, never reuse their story), `DIRECTOR.md`
(directing guide: §10 common failures, §11 checks before delivery, §12 copyright red lines) and the imagery tools of the
satellite demo (`satellite-briefing-tools/`, Landsat via Planetary Computer, Blue Marble via GIBS — reference code).

| Style | Fits | In mega-shot |
|---|---|---|
| `satellite-briefing` | news (wars, disasters, borders), climate, geography | **built**: `xp satellite` + scene `ve_tinh:` in templates/tin-tuc (engine/core/vetinh.js) |
| `archive-lighttable` | history, Bible-archaeology: documents and photos on a light table, loupe, index cards | style prompt — draw with the `trong` template / huashu collage |
| `briefing-board` | engineering / policy explainers on a pin board | style prompt |
| `data-physical` | big numbers built as physical objects (stacks, blocks) | style prompt (Three.js set) |
| `white-model` | cities, reconstruction, before/after on a white model | style prompt (Three.js) |
| `lidar-survey` | archaeology hidden under forest (laser-scan point clouds) | style prompt |
| `teardown` | products, devices: exploded views | style prompt |
| `microscope` | biology, materials | style prompt |

## Satellite scenes in a news video

```bash
xp satellite kherson --center 46.64,32.61 --km 20 --to videos/<bulletin>        # last 60 days, clearest Sentinel-2 first
xp satellite kherson --center 46.64,32.61 --km 20 --before 2022-01-01/2022-03-01 --to videos/<bulletin>   # + truoc.webp
```

```yaml
- id: kherson
  loi: …
  ve_tinh:
    thu_muc: ve_tinh/kherson
    diem: [{ lat: 46.6354, lon: 32.6169, chu: "Kherson", phu: "Sentinel-2 image · 2026-10-12", t: 3.2 }]
    duong: [{ tu: [46.63, 32.61], den: [46.75, 33.37], t: 4.4, chu: "TO NOVA KAKHOVKA", nguon: "measured on the satellite image" }]
    vung:  [{ diem: [[…], […], […]], t: 5, chu: "Area as claimed by …" }]    # a claim: say whose
    truoc: { t: 6 }                       # scan before → after (needs --before)
    mau_lai: 7.5                          # colour comes back where the story turns
```

Rules kept from the style: the ground is a real photograph (never drawn or generated); white hairlines = what was measured on the
image; ONE amber reading per screen; a claim (front line, territory) is labelled as whose claim — together with the neutral-news
rules ("could not be independently verified", Crimea etc.). The credit chip "SATELLITE IMAGE: SENTINEL-2 (ESA COPERNICUS) · NASA · <date>"
(written in Vietnamese when the video's `language` is not `en`) stays on screen for the whole shot; full credits in `ve_tinh/GIAY_PHEP.md`. Sentinel-2 at 10 m shows cities, rivers, fields, burn scars,
floods — not vehicles or single buildings: never claim on screen what 10 m cannot show.
