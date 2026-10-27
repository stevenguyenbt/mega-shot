# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Use GitHub's private vulnerability reporting
("Security" tab → "Report a vulnerability": https://github.com/stevenguyenbt/mega-shot/security/advisories/new).
Include steps to reproduce and the affected version (`VERSION`). We aim to reply within 7 days.

## Design notes for users

- **Keys stay local.** API keys are read from environment variables, `<project>/.env` or `<project>/.mega-shot/keys.env`
  and are never printed, logged or packed. Both files are git-ignored. Rotate any key you ever pasted into a chat,
  issue or screenshot.
- **Studio binds to 127.0.0.1 only** and checks the `Host` header and a per-run token. Do not expose it through tunnels
  or port forwarding.
- **No inbound network paths.** mega-shot opens no remote command endpoints. `xp social` only *sends* to adapters you
  configure; webhook URLs must be `https://` (or localhost) and tokens are referenced by environment-variable name.
- **Verified installs.** `xp setup --install voicestudio` refuses binaries whose SHA-256 does not match the release's
  `SHA256SUMS.txt`. Other installs use official sources (winget / Homebrew / apt, npm, PyPI via uv, GitHub).
- **Downloaded media is untrusted input.** Assets are processed by FFmpeg / Pillow / OpenCV — keep them updated.

## Supported versions

Only the latest release receives security fixes.
