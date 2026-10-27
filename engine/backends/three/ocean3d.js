// mega-shot · ocean3d — 3D ocean cross-section for deep-sea explainers.
// A cut-away water column 0 → 11,000 m with coloured zones, a depth ruler, landmark markers and a glowing probe that dives
// from `tu` to `den` metres during the scene; the camera follows it. Optional Everest silhouette standing in the Challenger Deep.
//   const O = oceanStage({ W, H }); O.draw(x, { lt, D, t }, { tu: 0, den: 1000, moc: ['titanic', 'snailfish'], everest: false }) → current depth (m)
// Scale: piecewise so the bright upper ocean is not a sliver — 0–1,000 m takes 40 % of the column, 1,000–11,000 m the rest.
import * as THREE from 'three';
import { create3D, post } from './ms3d.js';

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (a, b, u) => a + (b - a) * u;
const io = u => { u = clamp(u); return u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
export const ZONES = [[0, 200, 'SUNLIGHT ZONE', 0x2f8fd0], [200, 1000, 'TWILIGHT ZONE', 0x14507f], [1000, 4000, 'MIDNIGHT ZONE', 0x10356a],
                      [4000, 6000, 'THE ABYSS', 0x0c2850], [6000, 11000, 'THE TRENCHES (HADAL)', 0x081a36]];
export const MARKS = { 'sperm-whale': [2000, 'Sperm whale dives · ~2,000 m'], titanic: [3800, 'Titanic wreck · ~3,800 m'],
                       snailfish: [8336, 'Deepest fish filmed · 8,336 m'], challenger: [10935, 'Challenger Deep · ~10,935 m'] };
const TOP = 0, H1 = 16, H2 = 24;                                                    // scene units: 0–1,000 m → 16 u, 1,000–11,000 m → 24 u
export const yOf = d => d <= 1000 ? TOP - d / 1000 * H1 : TOP - H1 - (d - 1000) / 10000 * H2;
export const zoneOf = d => (ZONES.find(z => d >= z[0] && d < z[1]) || ZONES[ZONES.length - 1])[2];

function label(text, { size = 64, color = '#e8f6ff', hw = .3 } = {}) {            // hw = height of the text line in scene units
  const k = document.createElement('canvas'), g = k.getContext('2d'), font = `700 ${size}px "Be Vietnam Pro", Arial`; g.font = font;
  k.width = Math.ceil(g.measureText(text).width + 24); k.height = Math.round(size * 1.5);
  g.font = font; g.textBaseline = 'middle'; g.shadowColor = 'rgba(0,0,0,.85)'; g.shadowBlur = 10; g.fillStyle = color; g.fillText(text, 12, k.height / 2);
  const t = new THREE.CanvasTexture(k); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false })); s.scale.set(hw * 1.5 * k.width / k.height, hw * 1.5, 1); s.center.set(0, .5); return s;
}

export function oceanStage({ W, H }) {
  const C = create3D({ W, H, fov: 42, exposure: 1.05 }), { scene, camera } = C;
  scene.background = new THREE.Color(0x01040a); scene.fog = new THREE.FogExp2(0x01040a, .01);
  scene.add(new THREE.AmbientLight(0x6f9fd0, .5)); const key = new THREE.DirectionalLight(0xbfe4ff, 1.4); key.position.set(6, 10, 8); scene.add(key);
  const G = new THREE.Group(); scene.add(G);
  // water column: one translucent slab per zone (front face cut away so we look inside)
  for (const [a, b, name, col] of ZONES) {
    const y0 = yOf(a), y1 = yOf(b), h = y0 - y1;
    const m = new THREE.MeshPhysicalMaterial({ color: col, transparent: true, opacity: .55, roughness: .2, transmission: 0, side: THREE.DoubleSide, depthWrite: false });
    const box = new THREE.Mesh(new THREE.BoxGeometry(3.4, h, 3), m); box.position.set(0, y0 - h / 2, -1.6); G.add(box);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineBasicMaterial({ color: 0x7fd8ff, transparent: true, opacity: .25 })); edge.position.copy(box.position); G.add(edge);
    const lb = label(name, { color: '#9fe3ff', hw: .24 }); lb.position.set(-1.6, y0 - .3, .2); G.add(lb);
  }
  // sea floor at 11,000 m + trench walls
  const floor = new THREE.Mesh(new THREE.BoxGeometry(4.4, .6, 3.6), new THREE.MeshStandardMaterial({ color: 0x1b1712, roughness: 1 })); floor.position.set(0, yOf(11000) - .3, -1.6); G.add(floor);
  // depth ruler on the right
  const ticks = [0, 200, 500, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 11000];
  for (const d of ticks) {
    const y = yOf(d), tk = new THREE.Mesh(new THREE.BoxGeometry(d % 1000 ? .25 : .5, .03, .03), new THREE.MeshBasicMaterial({ color: 0x9fe3ff })); tk.position.set(1.85, y, .4); G.add(tk);
    const l = label(d === 0 ? 'SURFACE' : `${d.toLocaleString('en-GB')} m`, { color: '#cfefff', hw: .2 }); l.position.set(2.1, y, .4); G.add(l);
  }
  // landmark markers (shown when listed in opts.moc)
  const MK = {};
  for (const [id, [d, text]] of Object.entries(MARKS)) {
    const grp = new THREE.Group(), y = yOf(d);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(.12, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffd27a })); dot.position.set(.2, y, .5); grp.add(dot);
    const ln = new THREE.Mesh(new THREE.BoxGeometry(1.8, .025, .025), new THREE.MeshBasicMaterial({ color: 0xffd27a })); ln.position.set(-.7, y, .5); grp.add(ln);
    const l = label(text, { color: '#ffd27a', hw: .22 }); l.position.set(-1.6, y + .3, .5); grp.add(l);
    grp.visible = false; G.add(grp); MK[id] = grp;
  }
  // Mount Everest (8,849 m) standing on the Challenger Deep floor: peak ends ~2,086 m below the surface
  const ev = new THREE.Group(); { const hTop = yOf(10935 - 8849), hBot = yOf(10935), h = hTop - hBot;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.5, h, 7, 1), new THREE.MeshStandardMaterial({ color: 0x8f97a3, roughness: .9, flatShading: true, transparent: true, opacity: .85 }));
    cone.position.set(0, hBot + h / 2, -1.6); ev.add(cone);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(.24, h * .16, 7, 1), new THREE.MeshStandardMaterial({ color: 0xf2f6fa, roughness: .6, flatShading: true })); cap.position.set(0, hTop - h * .08, -1.6); ev.add(cap);
    const l = label('Mount Everest · 8,849 m', { color: '#ffffff', hw: .75 }); l.position.set(-1.6, hTop + 1.4, .6); ev.add(l); }
  ev.visible = false; G.add(ev);
  // probe: glowing sphere + light + vertical trail
  const probe = new THREE.Group(); const core = new THREE.Mesh(new THREE.SphereGeometry(.12, 24, 16), new THREE.MeshBasicMaterial({ color: 0xbff3ff }));
  const halo = new THREE.Mesh(new THREE.SphereGeometry(.24, 24, 16), new THREE.MeshBasicMaterial({ color: 0x5fd0ff, transparent: true, opacity: .14, depthWrite: false }));
  const pl = new THREE.PointLight(0x7fdcff, 6, 9, 1.6); probe.add(core, halo, pl); probe.position.set(.2, 0, .2); scene.add(probe);
  const trail = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1, 8), new THREE.MeshBasicMaterial({ color: 0x5fd0ff, transparent: true, opacity: .5 })); scene.add(trail);
  // marine snow
  const N = 900, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * 6; pos[i * 3 + 1] = -Math.random() * 42; pos[i * 3 + 2] = (Math.random() - .3) * 5; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const snow = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xdff6ff, size: .05, transparent: true, opacity: .7, depthWrite: false })); scene.add(snow);
  post(C, { ao: false, bloom: .5, grade: { contrast: 1.08, saturation: 1.1, vignette: .45 } });
  let depth = 0;
  return {
    gpu: C.gpu,
    get depth() { return depth; },
    draw(x, s, o = {}) {
      const tu = +(o.tu ?? 0), den = +(o.den ?? tu), u = io(clamp((s.lt - .3) / Math.max(.5, s.D - .9)));
      depth = lerp(tu, den, u); const y = yOf(depth);
      probe.position.y = y; halo.scale.setScalar(1 + .15 * Math.sin(s.t * 6));
      const y0 = yOf(tu); trail.position.set(.2, (y0 + y) / 2, .2); trail.scale.y = Math.max(.001, y0 - y);
      for (const id in MK) MK[id].visible = (o.moc || []).includes(id) && depth >= MARKS[id][0] - 900;
      ev.visible = !!o.everest;
      snow.position.y = (s.t * .25) % 2;                                         // marine snow drifts down slowly
      const tall = H > W, dist = o.xa ?? (tall ? 13 : 9), side = Math.sin(s.t * .12) * .9, cx = tall ? .8 : .4;
      camera.position.set(cx + side + .6, y + .9, dist); camera.lookAt(cx, y - .4, -1);
      if (o.everest) { const k = clamp((s.lt - s.D * .35) / 1.8); camera.position.set(lerp(cx + side + .6, 4, k), lerp(y + .9, -24, k), lerp(dist, tall ? 40 : 26, k)); camera.lookAt(cx, lerp(y - .4, -26, k), -1.2); }
      C.draw(x); return depth;
    },
  };
}
