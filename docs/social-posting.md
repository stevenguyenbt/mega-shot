# Posting to social platforms (`xp social`, optional)

mega-shot does not ship a posting service. `xp social` is a small queue that hands finished videos to an **adapter you
choose**. Posts made this way are usually public — confirm with the account owner before the first post to a new account.

## Adapters

| Adapter | What it does | Configure |
|---|---|---|
| `folder` | copies the video + `caption.txt` + `post.json` into an outbox folder (for a scheduler/uploader that watches it, or manual posting) | `--path <folder>` |
| `webhook` | `POST` multipart (`meta` JSON + `video` file) to an `https://` endpoint you control (n8n, Make, Zapier, your server). Reply JSON may contain `state` and `link`. | `--url`, optional `--token-env NAME` (bearer token read from that env var / `.env`) |
| `<module>` | your Python file `tools/social_adapters/<module>.py` with `post(job, target, log)` — see [`example_adapter.py`](../tools/social_adapters/example_adapter.py) | anything you add to the target |

```bash
xp social target add tiktok-outbox --adapter folder --path ~/outbox/tiktok --platform tiktok
xp social target add fb --adapter webhook --url https://hooks.example.com/post --token-env MY_HOOK_TOKEN --platform facebook
xp social post videos/my-video --to tiktok-outbox,fb --at "2026-11-01 19:30"
xp social run          # call this every few minutes from cron / Task Scheduler / a Claude scheduled task
xp social list --all
```

Caption: `out/caption_<platform>.txt` (first line = title) if it exists, else the *Caption* block of
`out/dang_bai_mxh.md` written by `xp publish`; or `--caption`. Videos containing consent-only clips are refused.
Targets live in `.mega-shot/social/targets.json` and never contain secrets.
