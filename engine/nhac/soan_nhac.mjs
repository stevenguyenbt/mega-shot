// mega-shot · soan_nhac.mjs — perform an ABC score written for a video with huashu-motion's composer (real instrument samples)
// and fit it to the picture. No network: the sample pack lives in .mega-shot/tools/om-samples (OM_SAMPLES).
// in : JSON { duration, labels: { "scene:<id>": seconds, … }, marks: { name: seconds }, score: "<ABC>", hits: [{ name, at }],
//            music: { kit } }
// out: WAV (48 kHz stereo, −14 LUFS when alone) + a short report on stdout.
// Usage: node soan_nhac.mjs in.json out.wav <huashu-motion repo dir>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const [inp, outp, repo] = process.argv.slice(2);
const lib = f => pathToFileURL(path.join(repo, 'cli', 'lib', f)).href;
const { mixdown, toWav } = await import(lib('sound.js'));
const S = JSON.parse(fs.readFileSync(inp, 'utf8'));
const p0 = { id: S.id || 'video', duration: S.duration, labels: S.labels || {}, hits: S.hits || [], music: { ...(S.music || {}), marks: S.marks || {} } };
const r = mixdown(p0, { voiced: false, score: S.score });
fs.writeFileSync(outp, toWav(r.out2));
const c = r.composed;
console.log(JSON.stringify({
  wav: outp, duration: +r.p.duration.toFixed(2), lufs: +r.finalLufs.toFixed(1), peak: +r.peak.toFixed(1),
  title: c?.title, notes: c?.notes, voices: c?.voices, marks: c?.marks, unmatched: c?.unmatched,
  stretches: (c?.stretches || []).map(x => `${x.from}→${x.to} ${x.qpm.toFixed(1)}bpm ${(x.bend * 100).toFixed(1)}%`),
  ends: c ? +c.end.toFixed(2) : null, hits: r.hits.length,
}));
