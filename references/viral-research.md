# Viral research (optional step)

Before writing the script, you can **offer** the user a quick study of what already goes viral on their topic. Do it only if the user agrees; it is never required. Ask with `AskUserQuestion`: "Run viral research first? (≈ 3–5 min)".

## What it does

1. `xp viral "<topic>" [--q "alt query|English query"] [--format short|long] [--lang vi] [--region VN]`
   - Calls the official **YouTube Data API v3** (metadata only: title, views, likes, comments, duration, upload date, channel subscribers).
   - Ranks videos by a **viral score** (0–100, relative inside the result set):
     - 45% **views ÷ subscribers**: above 1× means the video reached far beyond its channel's audience. This is the strongest viral signal, because big channels get views anyway.
     - 35% **views per day**.
     - 20% **engagement** ((likes + comments) ÷ views).
   - Summarises the leading group: median length, title formulas (% with numbers, questions, ':'/'|', emoji, CAPS), repeated title words and tags, and the most common upload hours (local time).
   - Writes `viral.md` (report + links), `build/viral/<slug>.json`, and a `viral_phan_tich.md` template. Outside a video folder, the files go to `.mega-shot/viral/<slug>/`.
   - Needs `YOUTUBE_API_KEY` (environment, project `.env`, or `.mega-shot/keys.env`). The key is free: Google Cloud Console → enable "YouTube Data API v3" → Credentials → API key. The free quota is ~10,000 units/day, and one query costs ≈ 102 units.
   - Without a key, it still writes the report skeleton with search links. You then research with WebSearch and the browser pane.
2. **TikTok has no public search API.** Use WebSearch (`site:tiktok.com <topic>`) and the in-app browser to look at 2–3 popular TikToks. View only.
3. **Watch the top 3–5 videos in the browser pane (view only).** Fill in `viral_phan_tich.md` per video:
   - hook in 0–3 s, first frame;
   - cuts in the first 10 s, on-screen text style;
   - voice, music, structure, retention lines;
   - ending/CTA, title and thumbnail formula.
4. Extract **3–5 shared viral factors**. Propose **2–3 directions** in a table: angle, opening hook line, title, length, visual style. Ask the user to pick one (or none) with `AskUserQuestion`.
5. Continue the normal workflow (style → research → script). Put the chosen hook and structure into the script, and the title formula into the `dang_bai` block.

## Rules (inspiration, not imitation)

- Never download, re-upload or reuse another creator's video, audio, music, thumbnail or script text. Do not copy their wording. Learn structure, pacing and formula only.
- Facts still come from your own research with sources (`nghien_cuu.md`), and footage still comes from licensed sources.
- Do not copy channel names, characters or branding. Do not imitate a specific creator's voice.
- Keep the user's own preferences (voice, music levels, subtitle position, length) over what the viral videos do.

## Reading the numbers

| Signal | Meaning |
|---|---|
| views ÷ subs > 3× | spread well beyond the channel's audience: study its hook and title closely |
| high views/day, young video | currently trending: the topic is hot now |
| engagement > 4% | strong emotion or debate: look at the ending question and comments |
| median length of the top group | target length for this topic and format |
| repeated title words | the keywords viewers search and click |
