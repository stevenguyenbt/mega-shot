# Video production in this project

<!-- Copy this file into your project's CLAUDE.md (or append it) so Claude Code uses mega-shot for video requests. -->

This project uses the **mega-shot** skill (installed in `~/.claude/skills/mega-shot` or `.claude/skills/mega-shot`) —
an end-to-end video studio: script → narration → visuals → subtitles → music → export → QA → publishing package.
Optional: **huashu-art-motion** for drawn styles (`xp setup --install huashu`).

When the user asks for a video:
1. Run `xp setup` first (from this project folder) and ask the user about every item under **NEEDS YOUR INPUT**
   before installing or downloading anything. Never print API keys; never ask the user to paste keys into chat.
2. **Ask the visual style** (Step 0 in mega-shot's SKILL.md): show `references/style-gallery.jpg` and ask with a question card.
3. Confirm format (9:16 short / 16:9 YouTube / multi-episode series), language, length and voice before writing the script.
4. Follow the workflow in mega-shot's SKILL.md — research and fact-check before narration, independent review before delivery.
5. Reply to the user in their language.

Voice cloning: only a voice the user owns or has explicit permission to use (`xp voice add … --consent`).
Downloads: only from sources the user approved (`xp setup --policy`); licences are logged per video.
