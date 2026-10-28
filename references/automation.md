# Automatic channels, social posting, clean-up and Studio

## Automatic channels (YouTube, always PRIVATE)

`xp channel new|topics|score|rate|next|mark|auth|upload|brief|list|schedule|due|release|plan` with `kenh/<id>/kenh.yaml`
(niche, format, reference video, voice, music, rules, standing extra sources, schedule) and `kenh/<id>/chu_de.yaml`
(topic states `de-xuat` proposed → `duyet` approved → `dang-lam` in production → `da-dang` uploaded | `can-xem` needs
review | `loi` error | `bo` rejected). Uploads use the official YouTube Data API and are PRIVATE; only an explicit
per-channel opt-in (`dang.tu_dong_cong_khai`) lets YouTube publish at a scheduled time. Production runs from any
scheduler (your agent's scheduled tasks, cron, Windows Task Scheduler) calling `xp channel due --claim` → make the
video → `xp channel upload` → `xp channel release`. Never approve topics or make a video public on your own. The user
signs in themselves (`xp channel auth`); never type passwords. Full guide: `channels.md`.

## Posting to TikTok / Facebook / Instagram — `xp social` (optional, bring your own adapter)

mega-shot ships no posting backend. A target uses an adapter: `folder` (copies video + caption into an outbox folder
your uploader watches — no network), `webhook` (multipart POST of video + JSON metadata to an endpoint YOU control: n8n,
Zapier, Make, your own server; bearer token read from the env var named by `--token-env`), or your own module
`tools/social_adapters/<name>.py` with `post(job, target, log) -> dict` (see `example_adapter.py`).

- `xp social target add <alias> --adapter folder --path <dir> | --adapter webhook --url <https…> [--token-env VAR] [--platform tiktok]`
- `xp social target list|remove`
- `xp social post videos/x --to a,b [--at "YYYY-MM-DD HH:MM"] [--caption …] [--title …]` queues it
- `xp social run` sends due jobs (run it from cron / Task Scheduler every few minutes)
- `xp social list [--all] | cancel <job> | retry <job>`

Caption: `out/caption_<platform>.txt` (first line = title) if present, else the Caption block of `out/dang_bai_mxh.md`.
Exports over 280 MB get an `_mxh.mp4` copy (~12 Mbps). Targets live in `.mega-shot/social/targets.json` (no secrets in
it); queue `.mega-shot/social/hang_doi.json` (states `cho` waiting, `da-gui` sent, `loi` failed, `huy` cancelled,
`qua-gio` missed). Consent-only clips (`tu_xac_nhan`) are refused. Posts are usually PUBLIC — **confirm with the
account owner before the first post to each new account**. Facebook Reels via API take ~90 s, TikTok keeps longer
videos — post long vertical videos to Facebook as a normal page video (your adapter decides; `xp social` passes the
duration). More: `../docs/social-posting.md`.

## Disk clean-up — `xp cleanup` (`xp don`)

Dry run listing video folders that are fully published (every social job sent / channel topic uploaded);
`xp cleanup --delete` (old flag `--xoa`) copies their text files (script, research, licences, captions) to
`kenh/<id>/da_dang/<name>/` and deletes the folder. Folders with anything pending/failed, a `.giu` file, or edits in the
last hour are kept; log `.mega-shot/don_dep.jsonl`; `MS_KHONG_DON=1` disables the automatic run after `xp social run` /
`xp channel upload`.

## Studio (local dashboard)

`xp studio` (`--port 3901`, `--open`) → http://127.0.0.1:3901. Shows every video/series and channel, runs steps with one
click (one-at-a-time job queue), edits scene lines (keeps YAML comments), picks footage options visually, plays results,
copies YouTube description/chapters. State is read from files, so it always matches the CLI. Local only — never expose
its port or add tunnels/remote command endpoints. Code: `tools/studio.py` + `tools/studio.html`; style-picker previews
in `previews/` (rebuild: `uv run --with pillow python tools/build_previews.py`).
