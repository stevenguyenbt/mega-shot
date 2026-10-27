# Automatic channels · `xp channel`

`xp channel` turns mega-shot into a small production line for one or more YouTube channels: you keep a backlog of
**approved topics** per channel, a scheduled job makes a video from the next approved topic, runs every quality gate,
and uploads it through the **official YouTube Data API** as **PRIVATE**. A human reviews it and switches it to Public.
A second (weekly) job can propose new topics for the human to approve.

Nothing here is required for making single videos — it is an optional layer on top of the normal workflow.

## Files

All channel data lives in the project folder (where you run `xp`):

| What | Where | Content |
|---|---|---|
| Channel profile | `kenh/<id>/kenh.yaml` | niche (`mo_ta`), format (`khung`, `mau` template, `ngon_ngu` language, `do_dai_giay` length), reference video, voice, music, style, `nguon_them` (extra sources this channel may always use), `quy_tac` (channel rules), upload settings (`danh_muc` category, `tag_chung` common tags, `phu_de` captions), schedule `lich` |
| Topic backlog | `kenh/<id>/chu_de.yaml` | one entry per topic with a state (below) |
| Event log | `kenh/<id>/nhat_ky.jsonl` | one JSON event per line, including YouTube links |
| YouTube authorisation | `.mega-shot/youtube/client_secret.json` + `token_<id>.json` | never printed, never shared, never committed |
| Studio | tab **Automatic channels** in `xp studio` | approve/reject topics, add topics by hand, pause/resume a channel, read the log, open private videos, edit every channel setting |

(`kenh` = channel, `chu_de` = topics, `nhat_ky` = log — internal Vietnamese file names, kept for compatibility.)

### Topic states

| State | Meaning |
|---|---|
| `de-xuat` | *proposed* — suggested by the AI (or added by hand), waiting for a human |
| `duyet` | *approved* — may be produced |
| `dang-lam` | *in production* — claimed by a run |
| `da-dang` | *uploaded* — on YouTube (private, or scheduled) |
| `can-xem` | *needs review* — failed a quality gate; a human must look at it |
| `loi` | *error* — a tool failed (VoiceStudio, network, render); see the note |
| `bo` | *rejected* — never produced |

Only `duyet` topics are ever produced. The AI may propose topics but never approves its own proposals unless the
user explicitly asked for that.

## Channel settings

Each channel has its own settings form in Studio (Automatic channels → settings), saved straight into `kenh/<id>/kenh.yaml`:

1. **Channel:** name, on/off, niche.
2. **Format:** frame, template, language, length, number of scenes, reference video.
3. **Visuals:** image type, overlays, accent colour, subtitle/title style, video vs. stills preference, huashu style, extra image sources.
4. **Voice:** sample, speed, volume.
5. **Music:** track, volume, ducking under speech.
6. **Sound effects:** level, ambience, preferred Kenney packs, replacements for the built-in boom/tick/riser.
7. **Content:** tone, opening style, structure, ending, audience, density, things to avoid, channel rules.
8. **Thumbnail:** on/off, styles, notes.
9. **YouTube upload:** category, common tags, common hashtags, captions, caption template. Privacy is always Private.
10. **Schedule:** run time, days, videos per run.

`xp channel brief <id>` prints all of this plus the full JSON. The scheduled job treats it as the rulebook, **with
priority over the reference video**; empty fields fall back to the reference video or the skill defaults.

## Commands

```
xp channel list [--json]                               # every channel, backlog counts, last result
xp channel new <id> --name "…" [--like videos/<ref>]   # new profile (copies format/voice/music/style from a reference video)
xp channel topics <id> [--add "Title | angle"] [--approve 1,3] [--reject 2] [--approve-all]
xp channel score <id> [--force]                        # market data for proposed/approved topics (≈100–200 API units each; needs YOUTUBE_API_KEY)
xp channel rate <id> <n> --ai 7.5 --why "…" [--vi "…"] # store the AI's score + reason for topic n (optional display translation)
xp channel next <id> [--json]                          # claim the next approved topic (→ dang-lam), prints the video folder to create
xp channel mark <id> <topic> <state> [--video videos/x] [--note "…"]
xp channel auth <id>                                   # one-time Google sign-in for that channel
xp channel upload <id> videos/<x> [--topic <topic>]    # upload PRIVATE: title, description, tags, category, language, thumbnail, captions
                                                       # (--youtube-id <id> updates an already uploaded video instead)
xp channel brief <id>                                  # the self-contained instruction block the scheduled job follows
xp channel schedule <id> [--at 03:00] [--days …] [--per-night N]   # per-channel run time (no options = show schedule + next run)
xp channel due [--claim] [--json]                      # channels due now; --claim takes the run lock
xp channel release                                     # free the run lock at the end of a run
xp channel plan <id> <ke_hoach.yaml>                   # import a weekly plan (below)
```

## YouTube API setup (once)

1. https://console.cloud.google.com → create a project (e.g. "mega-shot").
2. **APIs & Services → Library** → enable **YouTube Data API v3**.
3. **OAuth consent screen**: type **External**, fill in the app name and e-mail, and add the Google account(s) that
   manage the channels under **Test users**.
4. **Credentials → Create credentials → OAuth client ID** → type **Desktop app** → download the JSON →
   save it as `.mega-shot/youtube/client_secret.json`.
5. For each channel: `xp channel auth <id>`. A browser opens; **the channel owner signs in themselves** and picks the
   right YouTube channel (brand account if there is one). The AI never types passwords.
6. Check: `xp channel list` shows "YouTube ✓".

Good to know:
- **Unverified Google project:** uploads are **locked to Private** by YouTube — which is exactly the review workflow.
  In "Testing" mode the token expires after **7 days** (run `xp channel auth <id>` again); moving the app to
  "In production" avoids that (videos still upload private).
- **Quota:** 10,000 units/day per project; one upload costs ~1,600 units → about 6 uploads/day. More channels → more projects.
- **Custom thumbnails** need a phone-verified channel.

## Scheduling

mega-shot does not install a scheduler for channels. Use whatever you have; the job is always the same:

1. `xp channel due --claim --json` — which channels are due now (and take the run lock). Nothing due → stop.
2. For each due channel: `xp channel brief <id>`, `xp channel next <id> --json`, then the normal workflow
   (research → script → fact-check → narrate → assets → review → render → export → check), then
   `xp channel upload <id> videos/<x> --topic <topic>` — or `xp channel mark … can-xem|loi --note …` if a gate failed.
3. `xp channel release`.

Step 2 needs an AI agent (it writes and fact-checks the script), so the usual choice is a **scheduled Claude Code
run**. Options:

- **Claude scheduled tasks** (Claude desktop app): an hourly task whose prompt is the three steps above, plus a weekly
  task that proposes ~7 new topics per channel (`xp channel topics <id> --add …`) for a human to approve. If the app is
  closed at the scheduled time, the task runs when it is opened again.
- **cron** (Linux/macOS): e.g. `13 * * * * cd /path/to/project && claude -p "$(cat channel-job.md)"`.
- **Windows Task Scheduler**: an hourly trigger that runs `claude -p …` in the project folder.

Waking up hourly and letting `xp channel due` decide is simpler than one scheduler entry per channel.

### Per-channel schedule

`kenh.yaml → lich: { gio: "03:00", ngay: [t2, t3, t4, t5, t6, t7, cn], video_moi_dem: 1 }` —
`gio` = local start time, `ngay` = days (`t2`…`t7` = Monday…Saturday, `cn` = Sunday), `video_moi_dem` = videos per
run; default 01:00 every day, 1 video. Set it in Studio or with
`xp channel schedule <id> --at 03:00 --days t2,t4,t6|all|weekdays|weekend --per-night 1`.

A channel is due when: it is enabled, authorised, today is in `ngay`, `gio` has passed, fewer than `video_moi_dem`
videos were started today, and there is at least one approved topic.
The lock `.mega-shot/kenh_dang_chay.json` prevents two runs at once (they would share the GPU); every log event
refreshes it and it expires after 6 hours without activity. Channels whose times overlap, or that become due while a
run is still going, are made at the next wake-up the same day — give each channel its own production time.

The machine must be on, with the GPU free and VoiceStudio available (it is started headless automatically). Do not
render videos by hand while a scheduled run is working.

## Quality gates (no upload if one fails)

- The **independent fact-check** still finds errors that could not be fixed → `can-xem`.
- **`xp check`** still reports serious problems (loudness, stills held too long, missing files) → `can-xem`.
- The **script breaks a channel rule**, or a sensitive topic goes beyond what hedging can handle → `can-xem`.
- A **tool error** (VoiceStudio, network, render) → `loi` with a note.

Videos are always uploaded **private**. No command makes a video public on its own — that is the channel owner's
decision (the only exception is the opt-in scheduled publishing below).

## Weekly plan — `xp channel plan`

For a fixed production calendar instead of "one video per run":

- `kenh/<id>/ke_hoach/<year>-W<week>/` holds `KE_HOACH.md` (human-readable plan), `ke_hoach.yaml` (machine-readable)
  and one folder per item with a finished, fact-checked script (`video.yaml` + `nghien_cuu.md`).
- `ke_hoach.yaml` items: `{ id, tieu_de: <title>, loai: short|long, khung, kich_ban: <script folder>,
  lam_tu: "YYYY-MM-DDTHH:MM" (local time production may start), dang_luc: "…Z" (publish time, UTC) }`.
- `xp channel plan <id> <ke_hoach.yaml>` imports/updates the items as `duyet` topics (no duplicates).
- `xp channel due`: items whose `lam_tu` has passed make the channel due (shorts before long videos). `xp channel next`
  copies the script folder into `videos/<channel>-<id>` together with the template's `film.html`.
- **Opt-in scheduled publishing:** only when the channel owner sets `dang.tu_dong_cong_khai: true` in `kenh.yaml` does
  `xp channel upload --topic` set YouTube's own `publishAt` from `dang_luc` (YouTube switches the video to Public at
  that time; a time already past → public now). Without the flag everything stays PRIVATE. If YouTube rejects the
  publish time, the video stays private and the log says so.
- **Delete after upload (opt-in):** `dang.xoa_sau_dang: true` → after a successful upload the light text files
  (`video.yaml`, `nghien_cuu.md`, `giay_phep.json`, `out/*.md|*.txt`, subtitles) are copied to
  `kenh/<id>/da_dang/<folder>/` and `videos/<folder>` is deleted to free disk space. Only folders directly inside
  `videos/` are removed; never when updating with `--youtube-id`; logged as `xoa-sau-dang`. To change such a video
  later, rebuild it from its script. Manual clean-up: `xp cleanup` (dry run) / `xp cleanup --delete`; a `.giu` file in a video
  folder keeps it.
