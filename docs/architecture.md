# Architecture

```
            ┌──────────── video.yaml (script + settings, English or Vietnamese keys) ───────────┐
            │                                                                                    │
xp narrate ─┤ VoiceStudio (local TTS API :3900) → build/audio/<scene>.wav                        │
            │ faster-whisper listen-back → retry bad takes → word timestamps                      │
            └► build/timeline.json  (scene t0/t1, words, subtitle cues, transitions)              │
                                                                                                 │
visual backends (optional, per scene):                                                           │
  xp assets   stock search (Pixabay/Pexels/NASA/…) → score → download → best segment → 2.5D layers │
  xp art      huashu-art-motion grammars → PNG layers                                            │
  xp hf       HyperFrames HTML+GSAP → RGBA PNG layers                                            │
  xp blender  Blender scripts → image sequences                                                  │
            ▼                                                                                    │
xp render   film.html + engine/core/*.js (+ backends/three) in headless Chromium (Playwright)  ◄──┘
            per scene, cached in build/doan/, H.264 via WebCodecs (GPU) or JPEG → x264
            ▼
xp mix      voice stems + music (looped on the beat / composed score) + SFX → −14 LUFS build/mix.wav
xp export   mux → out/<name>_<format>.mp4 (CRF 17) + phone preview + xp publish + xp subtitles
xp check    cut self-check, ending check, loudness → report
```

## Repository layout

| Path | What |
|---|---|
| `xp`, `xp.cmd` | launchers: `uv run --no-project --with <deps> python tools/xp.py` |
| `tools/xp.py` | CLI: argument parsing, narration, timeline, render orchestration, mix, export, checks |
| `tools/*.py` | one module per feature (`setup`, `timkiem` asset search, `kichban` script scoring, `loat` series, `anhbia` thumbnails, `dangbai` publishing, `subtitles`, `studio`, `kenh` channels, `social`, `yaml_keys`, `keys`, …) |
| `engine/core/` | browser runtime: `film.js` (timeline player), `util.js`, `overlay.js` (subtitles, titles, labels), `textfx.js`, `stills.js`, `layers.js`, `fx.js`, character systems (`puppet.js`, `nhanvat*.js`, `xuong*.js`), `truyen.js` story sets |
| `engine/backends/three/` | Three.js scene kit (`ms3d.js`, materials, geometry, 3D sets, medical, ocean) |
| `engine/backends/blender/` | Blender studio kit (`msb.py`, `msb_lib.py`) |
| `engine/hyperframes/` | news composition + map pre-projection |
| `engine/nhac/` | ABC score performer for `xp compose` |
| `templates/<id>/` | starting `video.yaml` + `film.html` per style |
| `references/` | detailed guides the AI reads (styles, voice, thumbnails, story films, 3D, motion library, evidence films) |
| `docs/` | human documentation |
| `tests/kiem_thu.py` | regression test |

## Writing a `film.html`

```html
<script src="/ms/core/util.js"></script><script src="/ms/core/overlay.js"></script><script src="/ms/core/film.js"></script>
<script>
MS.film({
  scenes: {
    'opening': { draw(x, c) { x.fillStyle = '#123'; x.fillRect(0, 0, c.W, c.H); MS.words(x, c.data.tieu_de || c.id, c.W / 2, c.H * .4, .3, c.lt, 84); } },
    '*':       { draw(x, c) { /* default for every other scene */ } },
  },
  overlay(x, c) { /* drawn on top of every scene, before subtitles */ },
  prepare: async TL => { /* preload images etc. */ },
});
</script>
```

`c` gives `t` (global time), `lt` (scene-local time), `D` (scene duration), `q` (0→1 during the incoming transition),
`vt` / `vdur` (seconds since the line started / line duration), `data` (the scene's YAML keys, **internal names**),
`prev`, `W`, `H`. Library: `MS.subtitle · header · tag · chip · words · title · grain · vignette · topShade · letterbox ·
wrap · seq · still · still25 · shots · morph · at · img`. Rendering must be deterministic (seeded randomness only).

Each scene is rendered by seeking the page to exact frame times, so any Canvas 2D / WebGL drawing works. The engine
is served at `/ms/` by a local static server during render/preview.
