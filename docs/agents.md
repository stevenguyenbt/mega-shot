# Using mega-shot with other AI agents

mega-shot is packaged in the open **[Agent Skills](https://agentskills.io/specification)** format: a folder named
`mega-shot` with a `SKILL.md` (name + description + instructions), helper scripts and `references/`. Any agent that reads
Agent Skills can load it; agents that don't can still follow `AGENTS.md`. Under the hood everything is the same `xp`
command line, so the results are identical whichever agent drives it.

| Agent | Loads `SKILL.md` from | Also reads | Install with |
|---|---|---|---|
| **Claude Code** | `~/.claude/skills/`, `<project>/.claude/skills/` | `CLAUDE.md` | `xp agents install --for claude` |
| **OpenAI Codex** (CLI, IDE, app) | `~/.agents/skills/`, `<project>/.agents/skills/` | `AGENTS.md`, `agents/openai.yaml` | `xp agents install --for codex` |
| **Google Antigravity** (IDE, app, CLI) | `~/.gemini/config/skills/`, `<project>/.agents/skills/` | `AGENTS.md`, `GEMINI.md` | `xp agents install --for antigravity` |
| **Gemini CLI** | `~/.gemini/skills/`, `<project>/.agents/skills/` | `GEMINI.md` | `xp agents install --for gemini` |
| **Cursor** | `~/.cursor/skills/`, `<project>/.cursor/skills/` (also `.claude/skills`) | `AGENTS.md`, rules | `xp agents install --for cursor` |
| Copilot agent, Windsurf, Aider, Cline… | — | `AGENTS.md` | `xp agents init` (writes the instruction block) |

Paths follow each vendor's documentation at the time of writing; `xp agents status` shows what is installed where.

## Quick start (any agent)

```bash
git clone https://github.com/stevenguyenbt/mega-shot ~/mega-shot
cd ~/my-videos                              # your project folder (any empty folder)
~/mega-shot/xp agents install               # all agents, for every project on this computer
~/mega-shot/xp agents install --scope project   # or: only this project (+ AGENTS.md / GEMINI.md / CLAUDE.md block)
~/mega-shot/xp setup                        # prerequisites — the agent will also run this itself
```

On Windows use `xp.cmd`. Installs are symlinks (macOS/Linux) or directory junctions (Windows, no admin needed), so a
`git pull` in the clone updates every agent at once. Use `--copy` if your setup cannot follow links.

Then open the project in your agent and ask: *"make a 60-second vertical video about why octopuses have three hearts"*.
In Codex you can also call it explicitly with `$mega-shot`; in Gemini CLI run `/skills list` to check it is loaded.

## Agent-specific notes

mega-shot runs real programs (uv, FFmpeg, headless Chromium, a local server on `127.0.0.1`) and downloads packages and
licensed stock media. Agents that sandbox shell commands must allow that.

### OpenAI Codex
- The default `workspace-write` sandbox blocks network access. Allow it for this project, e.g. in `~/.codex/config.toml`:
  ```toml
  [sandbox_workspace_write]
  network_access = true
  ```
  or start Codex with approvals on request and approve the `xp` commands when asked.
- `uv` keeps its cache in your user folder; if writes there are refused, set `UV_CACHE_DIR` to a folder inside the project.
- Rendering opens a local web server on `127.0.0.1` and a headless browser — approve these if prompted.

### Google Antigravity
- Set the terminal execution policy so the agent may run `xp` commands (or approve each one). Long renders can take
  minutes; let the command finish rather than cancelling.
- The skill is found in `<project>/.agents/skills/mega-shot` (project) or `~/.gemini/config/skills/mega-shot` (all projects).
- Antigravity's browser can open `build/thu.jpg` / `out/*.mp4` to check results visually.

### Gemini CLI
- Gemini CLI asks for permission before activating a skill and before shell commands; approve `xp` commands (or use a
  trusted folder). `/skills reload` after installing.

### Cursor
- Use Agent mode (it can run terminal commands). Cursor also picks up the skill from `.claude/skills` or `.cursor/skills`.

### Claude Code
- Works out of the box. Copy [`docs/CLAUDE.project.md`](CLAUDE.project.md) into a project's `CLAUDE.md`, or use
  `xp agents install --scope project --for claude`.

## What every agent must do (from SKILL.md)

1. Run `xp setup` first; ask the user before any install or download; never print keys.
2. Ask the visual style, format, language, length and voice before writing.
3. Research and fact-check before narration; `xp review` before rendering; `xp check` after export.
4. Clone only voices the user owns or may use; publish only with the user's approval.

If your agent has a question/choice tool, it should use it for these decisions; otherwise it asks in chat and waits.
