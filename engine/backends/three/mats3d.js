// mega-shot · physically based material library for stylised 3D (sets3d.js, props3d.js, model library).
// Starting priors follow the img2threejs material reference (Apache-2.0, github.com/img2threejs/img2threejs,
// docs/materials/THREEJS_MATERIAL_REFERENCE.md): metal = metalness 1 with the tint in the colour; dielectrics keep metalness 0;
// every surface gets micro-variation (procedural, tileable, seeded → deterministic) on colour, roughness and bump so nothing
// reads as flat plastic. No image downloads.
//   import { mat3d, PRESETS } from './mats3d.js';  mat3d('gold') · mat3d('wood', { color: 0x6b4a32, repeat: [2, 1] }) · mat3d('glass')
import * as THREE from 'three';

// preset → physical params + procedural grain kind (noise | wood | brushed | stone | marble | paper | fabric | none)
export const PRESETS = {
  'wood':          { color: 0x7a5236, roughness: .72, grain: 'wood', bump: .6 },
  'wood-varnish':  { color: 0x6b4428, roughness: .42, clearcoat: .75, clearcoatRoughness: .25, grain: 'wood', bump: .35 },
  'wood-toy':      { color: 0xd8c3a0, roughness: .48, clearcoat: .35, clearcoatRoughness: .4, grain: 'wood', bump: .2, vary: .06 },
  'steel':         { color: 0xc9ccd1, metalness: 1, roughness: .12, grain: 'noise', bump: .05, vary: .03 },
  'brushed-steel': { color: 0xbfc2c7, metalness: 1, roughness: .35, anisotropy: .85, grain: 'brushed', bump: .08 },
  'iron':          { color: 0x55585e, metalness: .85, roughness: .5, grain: 'noise', bump: .4, vary: .12 },
  'aluminium':     { color: 0xd2d5d9, metalness: 1, roughness: .3, anisotropy: .2, grain: 'brushed', bump: .05 },
  'copper':        { color: 0xc77a4a, metalness: 1, roughness: .28, grain: 'noise', bump: .08 },
  'brass':         { color: 0xc9a24e, metalness: 1, roughness: .3, grain: 'noise', bump: .06, vary: .06 },
  'bronze':        { color: 0xa8763c, metalness: 1, roughness: .32, grain: 'noise', bump: .15, vary: .1 },
  'gold':          { color: 0xf0c45a, metalness: 1, roughness: .22, grain: 'noise', bump: .04, vary: .04 },
  'stone':         { color: 0x8f877a, roughness: .78, grain: 'stone', bump: 1, vary: .16 },
  'marble':        { color: 0xece7de, roughness: .3, clearcoat: .3, clearcoatRoughness: .3, grain: 'marble', bump: .1, vary: .1 },
  'earth':         { color: 0x7a5a3c, roughness: .95, grain: 'stone', bump: 1.4, vary: .2 },
  'snow':          { color: 0xe9eef7, roughness: .82, sheen: .4, sheenColor: 0xffffff, grain: 'noise', bump: .5, vary: .05 },
  'fabric':        { color: 0x8a2b22, roughness: .85, sheen: .65, grain: 'fabric', bump: .25 },
  'silk':          { color: 0x8a2b22, roughness: .32, sheen: .85, anisotropy: .45, grain: 'fabric', bump: .05 },
  'velvet':        { color: 0x5a1a2a, roughness: .72, sheen: 1, grain: 'noise', bump: .1 },
  'skin':          { color: 0xd9a988, roughness: .52, clearcoat: .12, ior: 1.4, grain: 'noise', bump: .08, vary: .05 },
  'fur':           { color: 0x7a4a2a, roughness: .78, sheen: .45, grain: 'brushed', bump: .3, vary: .1 },
  'leather':       { color: 0x5c2a1a, roughness: .62, clearcoat: .08, grain: 'noise', bump: .35, vary: .1 },
  'glass':         { color: 0xffffff, roughness: .05, transmission: 1, ior: 1.5, thickness: .15, grain: 'none' },
  'frosted-glass': { color: 0xf2f6ff, roughness: .52, transmission: .85, ior: 1.5, thickness: .2, grain: 'none' },
  'water':         { color: 0xbfe0ff, roughness: .04, transmission: .9, ior: 1.33, thickness: .3, grain: 'none' },
  'plastic':       { color: 0xc8321f, roughness: .28, clearcoat: .2, ior: 1.5, grain: 'noise', bump: .03 },
  'matte-plastic': { color: 0x2a2a2e, roughness: .68, ior: 1.5, grain: 'noise', bump: .05 },
  'ceramic':       { color: 0xf1ece2, roughness: .26, clearcoat: .7, ior: 1.5, grain: 'noise', bump: .03, vary: .03 },
  'paper':         { color: 0xefe3c4, roughness: .9, grain: 'paper', bump: .15, vary: .05 },
  'wax':           { color: 0xd9a03a, roughness: .35, clearcoat: .4, sheen: .3, grain: 'noise', bump: .1, vary: .08 },
  'honey':         { color: 0xffb030, roughness: .12, transmission: .35, ior: 1.48, thickness: .4, emissive: 0xff8a10, emissiveIntensity: .35, grain: 'none' },
  'coal':          { color: 0x1c1410, roughness: .9, grain: 'stone', bump: .8, vary: .1 },
};

// ---------- procedural tileable grain (value noise on a wrapped lattice → seamless) ----------
const SIZE = 256, CACHE = {};
function lattice(n, seed) { const a = new Float32Array(n * n); let s = seed * 9301 + 49297; for (let i = 0; i < a.length; i++) { s = (s * 9301 + 49297) % 233280; a[i] = s / 233280; } return a; }
function vnoise(L, n, x, y) { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const g = (i, j) => L[((j % n + n) % n) * n + ((i % n + n) % n)]; const a = g(xi, yi), b = g(xi + 1, yi), c = g(xi, yi + 1), d = g(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(Ls, x, y, oct = 5) { let s = 0, amp = .5, f = 1, n = 8; for (let o = 0; o < oct; o++) { s += amp * vnoise(Ls[o], n * f, x * f * n, y * f * n); amp *= .5; f *= 2; } return s; }
function field(kind, seed = 1) {
  const key = kind + seed; if (CACHE[key]) return CACHE[key];
  const Ls = [...Array(6)].map((_, o) => lattice(8 << o, seed * 31 + o)), out = new Float32Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) { const u = x / SIZE, v = y / SIZE; let h;
    if (kind === 'wood') { const t = fbm(Ls, u * .5, v * .5, 3); h = .5 + .5 * Math.sin((u * 18 + t * 6) * Math.PI); h = h * .7 + fbm(Ls, u * 4, v * .25, 3) * .3; }
    else if (kind === 'brushed') h = .55 * fbm(Ls, u * 6, v * .12, 4) + .45 * vnoise(Ls[5], 256, x, y * .02);
    else if (kind === 'stone') { const a = fbm(Ls, u, v, 6), c = Math.abs(fbm(Ls, u * 1.7 + 3, v * 1.7, 4) - .5); h = a * .8 + Math.min(1, c * 8) * .2; }
    else if (kind === 'marble') { const t = fbm(Ls, u, v, 5); h = .5 + .5 * Math.sin((u * 3 + v * 2 + t * 5) * Math.PI); h = Math.pow(h, 6) * .35 + .65 + (t - .5) * .1; }
    else if (kind === 'paper') h = .5 + (fbm(Ls, u * 2, v * 2, 6) - .5) * .5;
    else if (kind === 'fabric') h = .5 + .25 * Math.sin(x * Math.PI / 2) * Math.sin(y * Math.PI / 2) + (fbm(Ls, u, v, 3) - .5) * .4;
    else h = fbm(Ls, u, v, 6);
    out[y * SIZE + x] = Math.max(0, Math.min(1, h)); }
  return CACHE[key] = out;
}
function tex(f, map, srgb) {
  const k = document.createElement('canvas'); k.width = k.height = SIZE; const g = k.getContext('2d'), im = g.createImageData(SIZE, SIZE);
  for (let i = 0; i < f.length; i++) { const v = Math.round(map(f[i]) * 255); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(k); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
const TEXC = {};
function maps(kind, vary, rough, seed) {
  const key = [kind, vary, rough, seed].join(':'); if (TEXC[key]) return TEXC[key];
  const f = field(kind, seed);
  return TEXC[key] = {
    map: tex(f, h => 1 - vary + vary * h, true),                                          // colour: multiply ±vary around the base colour
    rough: tex(f, h => Math.max(.02, Math.min(1, rough * (1.18 - .36 * h))), false),       // worn high spots glossier, grooves matte
    bump: tex(f, h => h, false) };
}

// mat3d(preset, overrides): MeshPhysicalMaterial. overrides: any material param + color, repeat [u, v], seed, vary, bump (scale), grain
export function mat3d(preset = 'matte-plastic', o = {}) {
  const P = { ...(PRESETS[preset] || PRESETS['matte-plastic']), ...o }, { grain = 'noise', vary = .08, bump = .2, repeat = [1, 1], seed = 1 } = P;
  const m = new THREE.MeshPhysicalMaterial({ color: P.color, roughness: P.roughness ?? .6, metalness: P.metalness ?? 0, envMapIntensity: P.envMapIntensity ?? (P.metalness ? 1 : .7),
    clearcoat: P.clearcoat ?? 0, clearcoatRoughness: P.clearcoatRoughness ?? .2, sheen: P.sheen ?? 0, sheenRoughness: P.sheenRoughness ?? .6, sheenColor: new THREE.Color(P.sheenColor ?? P.color),
    transmission: P.transmission ?? 0, ior: P.ior ?? 1.5, thickness: P.thickness ?? 0, anisotropy: P.anisotropy ?? 0,
    emissive: P.emissive ?? 0x000000, emissiveIntensity: P.emissiveIntensity ?? 1, side: P.side ?? THREE.FrontSide, flatShading: !!P.flat,
    transparent: P.opacity != null || !!P.transparent, opacity: P.opacity ?? 1, depthWrite: P.depthWrite ?? true });
  if (grain !== 'none') { const M = maps(grain, vary, P.roughness ?? .6, seed), rep = t => { const c = t.clone(); c.repeat.set(...repeat); c.needsUpdate = true; return c; };
    m.map = rep(M.map); m.roughnessMap = rep(M.rough); m.roughness = 1; if (bump) { m.bumpMap = rep(M.bump); m.bumpScale = bump; } }
  return m;
}
