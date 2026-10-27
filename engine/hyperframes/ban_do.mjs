// mega-shot · ban_do.mjs — pre-project a map for a HyperFrames news scene (no network at render time).
// in : JSON { vung: [lonMin, latMin, lonMax, latMax], khung: [W, H], khu: [x0, y0, x1, y1] (target box in px),
//            nuoc_chinh: [ISO numeric ids to highlight], diem: [{ ten, lat, lon, ... }] }
// out: JSON { nuoc: [{ id, d, chinh }], diem: [{ ...same, x, y }], vien: d (outline of the highlighted countries) }
// Geometry: Natural Earth via world-atlas (public domain), 50m. Usage: node ban_do.mjs in.json out.json [modulesDir]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const [inp, outp, mods] = process.argv.slice(2);
const req = createRequire(path.join(mods || process.cwd(), 'noop.js'));
const d3 = req('d3-geo'), topojson = req('topojson-client');
const atlas = JSON.parse(fs.readFileSync(req.resolve('world-atlas/countries-50m.json'), 'utf8'));
const S = JSON.parse(fs.readFileSync(inp, 'utf8'));
const [lo0, la0, lo1, la1] = S.vung, [x0, y0, x1, y1] = S.khu || [0, 0, ...S.khung];
const box = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[lo0, la0], [lo0, la1], [lo1, la1], [lo1, la0], [lo0, la0]]] } };
const proj = d3.geoMercator().fitExtent([[x0, y0], [x1, y1]], box), gp = d3.geoPath(proj);
const feats = topojson.feature(atlas, atlas.objects.countries).features;
const main = new Set((S.nuoc_chinh || []).map(String));
const nuoc = [];
for (const f of feats) {
  const id = String(f.id).padStart(3, '0'), b = d3.geoBounds(f);
  const wraps = b[0][0] > b[1][0];                                                  // crosses the antimeridian (Russia): bounds are inverted
  if (!wraps && (b[1][0] < lo0 - 15 || b[0][0] > lo1 + 15) || b[1][1] < la0 - 10 || b[0][1] > la1 + 10) continue;   // far outside the view
  let geo = f.geometry;
  if (id === '643' && geo.type === 'MultiPolygon') {                               // Natural Earth puts Crimea inside Russia (de facto). Split it out:
    const isCrimea = poly => { const c = d3.geoCentroid({ type: 'Polygon', coordinates: poly }); return c[0] > 32.3 && c[0] < 36.8 && c[1] > 44.2 && c[1] < 46.3; };
    const cr = geo.coordinates.filter(isCrimea);
    if (cr.length) { geo = { type: 'MultiPolygon', coordinates: geo.coordinates.filter(p => !isCrimea(p)) };
      const dc = gp({ type: 'MultiPolygon', coordinates: cr });                    // internationally recognised as Ukraine; annexed by Russia in 2014
      if (dc) nuoc.push({ id: 'crimea', ten: 'Crimea', d: dc.replace(/(\.\d)\d+/g, '$1'), chinh: main.has('804'), tranh_chap: true }); } }
  const d = gp({ type: 'Feature', geometry: geo }); if (d) nuoc.push({ id, ten: f.properties.name, d: d.replace(/(\.\d)\d+/g, '$1'), chinh: main.has(id) || main.has(String(+id)) });
}
const diem = (S.diem || []).map(p => { const [x, y] = proj([p.lon, p.lat]); return { ...p, x: Math.round(x), y: Math.round(y) }; });
fs.writeFileSync(outp, JSON.stringify({ nuoc, diem, khung: S.khung }));
console.log(`ban_do: ${nuoc.length} regions · ${diem.length} points → ${outp}`);
