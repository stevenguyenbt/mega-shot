# FAQ & troubleshooting

**Why do some files, folders and values have Vietnamese names?**
The project started in Vietnamese. All commands, flags and YAML keys have English names now (`docs/cli.md`,
`docs/yaml-reference.md`); the old names still work so existing videos never break. Internal file names
(`build/thu.jpg`, `giay_phep.json`, `out/dang_bai_mxh.md`) and enum values (`tia-nang`, `thanh-ty-le`) keep their ids;
they are explained in the docs.

**Do I need Claude Code?** No. It makes things much easier (the AI researches, writes `video.yaml`, checks output),
but `xp` is a normal CLI.

**Do I need a GPU?** No. An NVIDIA GPU makes narration and encoding much faster. Without WebCodecs hardware support the
renderer falls back to JPEG → x264 (~3× slower).

**Narration without VoiceStudio?** Record or generate one WAV per scene (`seg1.wav`, `seg2.wav`, … in scene order) and
run `xp narrate --import-from <folder>`. Word timestamps then come from the local Whisper listen-back.

**`xp assets` says there is no download policy.** Run `xp setup --policy` after deciding which sources you allow.

**`cannot connect to VoiceStudio`.** `xp voicestudio restart`; log: `.mega-shot/voicestudio/backend.log`. Right after a
fresh install, open the VoiceStudio app once so it finishes downloading its models. Don't run the app window and the
headless backend at the same time (both use port 3900).

**Chromium won't launch.** `xp setup --install chromium`; on Linux also `uv run --with playwright==1.63.0 python -m playwright install-deps chromium`.

**Footage looks soft in 9:16.** Landscape 1080p cropped to vertical is upscaled ~1.8×. Prefer vertical / 4K clips
(the search already scores this), or pin another option with `pick:`.

**The voice mispronounces names or numbers.** Write `narration` phonetically and keep the correct spelling in
`subtitle`; Vietnamese numbers are spelled out automatically (`tools/doc_so.py`).

**A YAML error mentions `*` or `:`.** A line starting with `**bold**` or containing `: ` must be quoted; `xp` quotes
`narration`/`subtitle`/`title` lines automatically and saves the file.

**Is anything uploaded automatically?** No. YouTube uploads (`xp channel upload`) are private and only run when you
call them; `xp social` only sends to adapters you configure.

**Licences of what I put in my videos?** Every downloaded asset is logged in the video's `giay_phep.json` and credited
in `GHI_CONG.md` / the publishing package. Music you add yourself needs `--license`. Only clone voices you own or have
permission to use.
