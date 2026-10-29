#!/usr/bin/env bash
# mega-shot one-command installer for macOS (Apple Silicon or Intel) and Linux.
#
#   ./install.sh                     interactive: asks before every download/install
#   ./install.sh --yes               accept the recommended set (uv, FFmpeg, Chromium, fonts, speech model, agent links)
#   ./install.sh --project ~/videos  where your videos live (default ~/mega-shot-videos)
#   ./install.sh --with-voicestudio  also install the VoiceStudio narration app (~250 MB + voice models, AGPL-3.0)
#   ./install.sh --no-agents         do not link the skill into Claude Code / Codex / Antigravity / Gemini CLI / Cursor
#
# Everything comes from official sources: uv (astral.sh), Homebrew (brew.sh) + FFmpeg, Playwright's Chromium,
# Google Fonts (OFL), Whisper weights from Hugging Face, VoiceStudio's GitHub release (SHA-256 verified by xp setup).
# Nothing is installed with sudo except Homebrew's own installer (it asks for your password) or apt/dnf on Linux.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
YES=0; PROJECT="$HOME/mega-shot-videos"; VOICESTUDIO=0; AGENTS=1
while [ $# -gt 0 ]; do
  case "$1" in
    -y|--yes) YES=1 ;;
    --project) PROJECT="$2"; shift ;;
    --with-voicestudio) VOICESTUDIO=1 ;;
    --no-agents) AGENTS=0 ;;
    -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

say()  { printf '\033[1m[mega-shot]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[mega-shot] %s\033[0m\n' "$*"; }
ask()  {  # ask "question" default(Y|N) → 0 = yes
  local d="${2:-Y}" a
  if [ "$YES" = 1 ]; then [ "$d" = Y ]; return; fi
  if [ ! -t 0 ]; then [ "$d" = Y ]; return; fi
  read -r -p "[mega-shot] $1 [$( [ "$d" = Y ] && echo Y/n || echo y/N )] " a || true
  a="${a:-$d}"; [[ "$a" =~ ^[Yy] ]]
}

OS="$(uname -s)"; ARCH="$(uname -m)"
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$HOME/.cargo/bin"
case "$OS" in
  Darwin) say "macOS $(sw_vers -productVersion 2>/dev/null) · $ARCH · $(sysctl -n machdep.cpu.brand_string 2>/dev/null) · $(( $(sysctl -n hw.memsize) / 1073741824 )) GB"
          if [ "$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)" = 1 ]; then
            warn "this Terminal runs under Rosetta (x86_64). Open a native Terminal (arm64) for the fast Apple-GPU path, then run install.sh again."
          fi ;;
  Linux)  say "Linux · $ARCH" ;;
  *)      warn "unsupported OS $OS — on Windows use xp.cmd setup (see README)"; exit 1 ;;
esac

# 1 · uv (runs every xp command, brings its own Python)
if ! command -v uv >/dev/null 2>&1; then
  if ask "Install uv (Python runner from astral.sh, ~30 MB, MIT/Apache-2.0)?" Y; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
  else warn "uv is required — https://docs.astral.sh/uv/getting-started/installation/"; exit 1; fi
fi
say "uv: $(uv --version)"

# 2 · FFmpeg
if ! command -v ffmpeg >/dev/null 2>&1; then
  if [ "$OS" = Darwin ]; then
    if ! command -v brew >/dev/null 2>&1; then
      if ask "FFmpeg is installed with Homebrew, which is missing. Install Homebrew (brew.sh, asks for your password)?" Y; then
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv)"
      else warn "install FFmpeg yourself (https://ffmpeg.org/download.html) and run install.sh again"; exit 1; fi
    fi
    if ask "Install FFmpeg with Homebrew (~90 MB, LGPL/GPL)?" Y; then brew install ffmpeg; else exit 1; fi
  else
    if ask "Install FFmpeg with your package manager (sudo)?" Y; then "$HERE/xp" setup --install ffmpeg --quick --no-launch || true; else exit 1; fi
  fi
fi
command -v ffmpeg >/dev/null 2>&1 || { warn "FFmpeg still not found on PATH"; exit 1; }
say "ffmpeg: $(ffmpeg -version | head -1 | cut -c1-60)"

# 3 · the skill itself
chmod +x "$HERE/xp" "$HERE/install.sh" 2>/dev/null || true
mkdir -p "$PROJECT"; export MS_PROJECT="$PROJECT"; mkdir -p "$PROJECT/.mega-shot"
say "project folder (your videos, keys, voices): $PROJECT"

# 4 · recommended components (Chromium for rendering, fonts, the speech model picked for this computer)
PLAN="$(cd "$PROJECT" && "$HERE/xp" setup --json --quick --no-launch 2>/dev/null | python3 -c 'import json,sys
d=json.load(sys.stdin); w=[i for i in d["items"] if i["id"]=="whisper"]; print(w[0]["detail"] if w else "")' 2>/dev/null || true)"
[ -n "$PLAN" ] && say "speech recognition for this computer: $PLAN"
if ask "Install Chromium for rendering (~180 MB), thumbnail fonts (~1 MB) and the speech model above?" Y; then
  (cd "$PROJECT" && "$HERE/xp" setup --install chromium,fonts,whisper --quick --no-launch) || warn "some components failed — xp setup shows what is missing"
fi
if [ "$VOICESTUDIO" = 1 ] || { [ "$YES" = 0 ] && ask "Install VoiceStudio for narration (local voice cloning, ~250 MB + models, AGPL-3.0)?" N; }; then
  (cd "$PROJECT" && "$HERE/xp" setup --install voicestudio) || warn "VoiceStudio install failed — see xp setup"
fi

# 5 · make the skill visible to your AI agents
if [ "$AGENTS" = 1 ] && ask "Link mega-shot into Claude Code, Codex, Antigravity, Gemini CLI and Cursor skill folders?" Y; then
  (cd "$PROJECT" && "$HERE/xp" agents install) || true
fi

# 6 · summary
(cd "$PROJECT" && "$HERE/xp" setup --no-launch) || true
cat <<EOF

[mega-shot] done. Next:
  cd "$PROJECT"
  cp "$HERE/.env.example" .env      # add PIXABAY_API_KEY for stock footage (free)
  open your AI agent in this folder and ask: "make a 60-second vertical video about why octopuses have three hearts"
  (or by hand: $HERE/xp new hello --template blank)
EOF
