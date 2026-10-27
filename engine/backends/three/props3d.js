// mega-shot · stylised 3D props composited over 2D scenes (transparent WebGL canvas → drawImage).
// Matte "editorial" palette (red / cream / ink / brushed metal), key + rim light, soft contact shadow. Everything is a pure
// function of time → deterministic frames. Used by templates/tuyen-ngon; see references/manifesto.md (vat3d).
//   const S = stage({ W, H }); S.draw(x, 'dong-ho', { fx, fy, co, lt, D, t, ev }, opts)
// Props: bong-den · dong-ho · lich · o-vuong · song · thap · cau-thang · cua · ta · dong-ho-cat · ban-do · gieng-dau · thung-dau · tau-dau
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mat3d } from './mats3d.js';
import { instance, preload as libPreload, namesIn } from './library3d.js';
import { JP_PROPS } from './props_nhat_ban.js';
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), eo3 = u => 1 - Math.pow(1 - clamp(u), 3);
const back = (u, s = 1.6) => { u = clamp(u) - 1; return 1 + (s + 1) * u * u * u + s * u * u; };
const C = { red: 0xd42a1e, red2: 0x8f160f, cream: 0xefe8dc, ink: 0x1b1b1b, metal: 0xb8b2a8, gold: 0xe0b44c, warm: 0xffd9a0 };
// physical materials with micro-variation (mats3d.js); transparent ones stay standard
const M = (color, o = {}) => o.op ? new THREE.MeshStandardMaterial({ color, roughness: o.r ?? .55, metalness: o.m ?? 0, emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 0, transparent: true, opacity: o.op })
  : mat3d(o.m >= .6 ? 'iron' : 'matte-plastic', { color, roughness: o.r ?? .55, metalness: o.m ?? 0, emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 0, vary: .05, bump: .06 });
const mesh = (g, m, cast = true) => { const k = new THREE.Mesh(g, m); k.castShadow = cast; k.receiveShadow = true; return k; };
function floor(r = 1.6, y = -1) { const f = new THREE.Mesh(new THREE.CircleGeometry(r, 48).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: .32 })); f.position.y = y; f.receiveShadow = true; return f; }
function label(text, o = {}) {                                                   // canvas texture (Vietnamese diacritics OK)
  const k = document.createElement('canvas'); k.width = o.w || 512; k.height = o.h || 512; const g = k.getContext('2d');
  g.fillStyle = o.bg || '#efe8dc'; g.fillRect(0, 0, k.width, k.height); g.fillStyle = o.fg || '#d42a1e'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 ${o.size || 300}px BVP, Arial`; g.fillText(text, k.width / 2, k.height * (o.y ?? .55));
  if (o.sub) { g.fillStyle = '#1b1b1b'; g.font = `800 ${o.subSize || 60}px BVP, Arial`; g.fillText(o.sub, k.width / 2, k.height * .14); }
  const t = new THREE.CanvasTexture(k); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

// approximate outlines (lon, lat) for the stylised map — not survey-accurate borders
const GEO = {
  peninsula: [[34.9,29.5],[36.5,27.0],[38.0,24.5],[39.1,21.5],[41.0,19.0],[42.6,16.5],[43.3,13.0],[45.0,12.8],[48.0,14.0],[52.2,15.6],[55.0,17.0],[57.0,18.9],[58.5,20.4],[59.8,22.5],[58.6,23.6],[56.4,24.9],[56.36,25.25],[56.37,25.6],[56.45,25.95],[56.5,26.2],[56.42,26.36],[56.3,26.38],[56.22,26.27],[56.15,26.2],[56.08,26.05],[56.0,25.9],[55.95,25.79],[55.5,25.6],[54.0,24.1],[52.0,24.0],[51.6,25.0],[51.2,26.1],[50.8,24.8],[50.1,25.9],[49.6,26.9],[48.5,28.0],[48.0,29.9],[47.7,30.1],[46.5,29.1],[44.7,29.2],[42.0,31.1],[39.2,32.2],[37.0,31.5],[36.0,29.9]],
  north: [[34.9,29.5],[36.0,29.9],[37.0,31.5],[39.2,32.2],[42.0,31.1],[44.7,29.2],[46.5,29.1],[47.7,30.1],[48.6,31.5],[47.5,33.5],[44.0,34.5],[40.0,34.6],[37.0,34.0],[35.5,33.0],[34.4,31.4]],
  saudi: [[34.95,29.35],[36.07,29.19],[37.98,30.5],[37.0,31.5],[39.2,32.16],[40.4,31.95],[42.08,31.1],[44.7,29.18],[46.57,29.1],[47.46,28.99],[48.42,28.55],[49.6,26.9],[50.15,25.95],[50.8,24.75],[51.58,24.25],[52.0,23.0],[55.0,22.7],[55.67,22.0],[55.0,20.0],[52.0,19.0],[49.12,18.62],[48.18,18.17],[47.0,17.0],[46.0,17.25],[44.0,17.4],[43.4,17.5],[43.2,16.67],[42.78,16.35],[41.0,19.0],[39.1,21.5],[38.0,24.5],[36.5,27.0],[35.0,28.0]],
  iran: [[48.5,30.0],[49.5,30.0],[50.3,29.3],[50.85,28.9],[51.3,28.0],[52.6,27.4],[53.8,26.8],[54.9,26.55],[55.3,26.72],[55.75,27.0],[56.1,27.15],[56.27,27.2],[56.6,27.1],[56.9,27.0],[57.1,26.6],[57.3,26.1],[57.5,25.75],[57.77,25.64],[58.5,25.6],[59.6,25.4],[61.6,25.15],[61.8,27.0],[61.0,31.0],[60.8,34.5],[61.0,36.6],[56.0,38.0],[53.9,37.3],[50.0,37.4],[48.8,38.4],[44.8,39.7],[44.0,37.3],[45.5,35.0],[46.2,33.0],[47.8,31.4]],
  islands: [[[55.27,26.62],[55.6,26.78],[55.95,26.86],[56.25,26.95],[56.2,27.0],[55.9,26.95],[55.5,26.86],[55.27,26.72]],
            [[56.42,27.02],[56.5,27.03],[56.51,27.09],[56.44,27.1]], [[56.33,26.84],[56.39,26.84],[56.39,26.88],[56.33,26.88]],
            [[55.0,25.86],[55.06,25.86],[55.06,25.9],[55.0,25.9]], [[55.27,26.24],[55.33,26.24],[55.33,26.28],[55.27,26.28]], [[55.12,26.22],[55.16,26.22],[55.16,26.25],[55.12,26.25]]],
};
// wide stylised map of the ancient Near East (lon 14-80, lat 8-47): land block with the seas cut out + empire extents.
// Hand-traced approximate outlines for storytelling, not survey-accurate borders.
const WIDE = {
  med: [[14, 32.5], [20, 30.6], [25, 31.7], [29.5, 31.2], [32.3, 31.3], [34.6, 31.9], [35.9, 34.7], [36.1, 36.7], [32.6, 36.1], [29.6, 36.3], [28.2, 36.8], [27.2, 37.9], [26.4, 39.3], [26.2, 40.5], [23.8, 40.6], [22.9, 40.4], [23.5, 38.2], [22.2, 37.0], [21.1, 37.9], [20.7, 39.4], [19.4, 40.4], [19.5, 41.8], [18.5, 42.4], [16.3, 43.4], [14.2, 45.2], [14, 45.5], [14, 44], [15.5, 42], [18.5, 40.2], [16.5, 38.8], [15.6, 38], [15.7, 40], [14, 40.8], [12.5, 41.4], [11, 42.4], [10.3, 43.5], [8.8, 44.4], [7.5, 43.8], [5, 43.3], [3.1, 43], [3.2, 41.9], [0.5, 40.5], [0, 38.7], [-2, 36.7], [-5.6, 36], [-5.3, 35.9], [-2.9, 35.3], [-1, 35.7], [1, 36.5], [3, 36.8], [5, 36.8], [8.6, 36.9], [9.8, 37.3], [10.2, 37.2], [11, 37], [10.5, 36], [10, 34.3], [11.5, 33.2]],
  black: [[27.5, 42.5], [28, 41.3], [29.1, 41.2], [31.5, 41.2], [33.5, 42], [35.2, 42], [37.5, 41.1], [39.7, 41], [41.5, 41.5], [41.6, 42.6], [40, 43.5], [38, 44.5], [36.6, 45.3], [35, 45], [33.5, 44.5], [32.5, 45.4], [33.5, 46], [31.5, 46.6], [30.2, 45.8], [29.6, 45.2], [28.7, 44], [28, 43.3]],
  caspian: [[47, 44.7], [49, 46.3], [51.5, 46.9], [53, 46.2], [53.2, 44.5], [51.3, 43.2], [52.7, 41.7], [53, 40.4], [53.9, 40], [53.8, 38], [54, 37.3], [53, 36.8], [51, 36.7], [49.5, 37.6], [48.9, 38.4], [49.3, 40.3], [50.3, 40.4], [49.2, 41.5], [48, 42.8], [47.5, 43.5]],
  aral: [[58.5, 46.5], [60.5, 46.6], [61.5, 45.5], [61, 44], [59, 43.6], [58.3, 45]],
  south: [[77, 8], [76.5, 9.5], [75, 12.5], [74, 15], [73, 18], [72.8, 20], [72.6, 21.8], [70.3, 22.6], [68.5, 23.7], [67, 24.8], [66.5, 25.4], [61.6, 25.2], [58.8, 25.6], [57.3, 25.9], [56.5, 27.1], [56, 27], [54.5, 26.6], [52.5, 27.4], [51.2, 28.2], [50.6, 29.5], [49, 30.1], [48, 29.9], [48.5, 28.5], [49.6, 27], [50.1, 26], [50.8, 24.8], [51.6, 24.2], [52.5, 24.3], [54, 24.2], [55.6, 25.5], [56.3, 26.3], [56.4, 24.8], [57.5, 23.6], [58.6, 23.6], [59.8, 22.5], [58.5, 20.5], [57.7, 19], [55.5, 17.5], [52.5, 16.2], [48.5, 14], [45, 12.8], [43.4, 12.6], [42.7, 15], [41.2, 17.8], [39.2, 21.4], [38.1, 24], [36.6, 26], [34.8, 28], [33.8, 28.2], [32.6, 29.9], [32.7, 29.4], [33.5, 27.5], [35, 24], [36.5, 22], [37.3, 19], [38.8, 17], [39.8, 15.5], [41.6, 13.6], [43.2, 12.2], [44.5, 10.6], [51, 11.8], [51.2, 10.4], [50, 8]],
  persia: [[20, 32.8], [23, 32.6], [25, 31.6], [29.5, 31.2], [32.3, 31.3], [34.5, 31.8], [35.9, 34.7], [36.1, 36.7], [30, 36.3], [27.2, 37.9], [26.3, 40.0], [24.5, 40.8], [23, 41], [22.5, 42.2], [26, 42.6], [28, 41.6], [29.1, 41.2], [33.5, 42], [37.5, 41.1], [41.5, 41.5], [44, 42.5], [47.5, 42.8], [49.2, 41.5], [49.3, 40.3], [48.9, 38.4], [51, 36.7], [53.9, 37.2], [56, 42], [60, 44], [64, 44], [68, 44.5], [70.5, 42.5], [73, 40], [73, 37], [74, 35], [75.5, 32], [73.5, 29], [71, 25.5], [68, 23.8], [67, 24.8], [61.6, 25.2], [58.8, 25.6], [57.3, 25.9], [56.5, 27.1], [54.5, 26.6], [52.5, 27.4], [51.2, 28.2], [50.6, 29.5], [48, 29.9], [47, 29.2], [44.5, 29.2], [42, 31], [39, 31.5], [36.5, 29.8], [34.8, 29.5], [32.6, 29.9], [33.5, 27.5], [35, 24], [32.9, 23.8], [31, 22.3], [28, 22.3], [25, 24], [25, 29], [22, 30], [20, 30.6]],
  sasanian: [[35.8, 34.5], [38.5, 37], [42, 38.5], [44, 41.5], [47.5, 42.5], [49.2, 41.5], [49.3, 40.3], [48.9, 38.4], [51, 36.7], [53.9, 37.2], [56, 38.5], [60, 39], [64, 38.5], [67.5, 37], [70, 34], [69, 30], [67, 25], [61.6, 25.2], [58.8, 25.6], [57.3, 25.9], [56.5, 27.1], [54.5, 26.6], [52.5, 27.4], [51.2, 28.2], [50.6, 29.5], [48, 29.9], [47, 29.2], [44.5, 30.5], [41, 33], [38.5, 34.5]],
  parthia: [[38.5, 36.5], [42, 37.5], [44, 39], [47, 39.5], [48.9, 38.4], [51, 36.7], [53.9, 37.2], [56, 39], [60, 39.5], [64, 38.5], [66.5, 36.5], [66, 32], [64, 28.5], [61.6, 25.2], [58.8, 25.6], [57.3, 25.9], [56.5, 27.1], [54.5, 26.6], [52.5, 27.4], [51.2, 28.2], [50.6, 29.5], [48, 29.9], [47, 29.2], [44.5, 30.5], [41, 33], [39, 35]],
  ott1300: [[29.2, 40.6], [30.4, 40.9], [31.2, 40.3], [30.6, 39.6], [29.5, 39.6], [28.9, 40.1]],
  ott1453: [[19.4, 40.4], [19.5, 41.8], [19.4, 42.6], [20.6, 43.6], [22.5, 44.5], [25, 44], [27.5, 44], [28.6, 43.6], [28, 42], [28, 41.6], [29.1, 41.2], [31.5, 41.2], [33.5, 42], [35.2, 42],
    [36.6, 41.3], [37, 40], [35.4, 38.7], [34, 37.6], [32.4, 36.6], [30.5, 36.8], [29, 36.8], [27.3, 37.6], [26.4, 39.3], [26.2, 40.5], [24, 40.8], [22.9, 40.4], [22.3, 39.4], [21.2, 39.3], [20.2, 39.8]],
  ott1566a: [[26.2, 40.5], [26.4, 39.3], [27.2, 37.9], [28.2, 36.8], [29.6, 36.3], [32.6, 36.1], [36.1, 36.7], [39, 37], [42, 37.5], [44, 39], [43, 41], [41.5, 41.5], [39.7, 41], [37.5, 41.1],
    [35.2, 42], [33.5, 42], [31.5, 41.2], [29.1, 41.2], [28, 41.6], [28, 43], [28.6, 44], [29.7, 45.2], [28, 46.3], [26, 47.8], [22.5, 48.2], [20, 47.8], [17.5, 46.8], [16.4, 46], [15.9, 45],
    [15.8, 44.2], [17, 43.5], [18.5, 42.4], [19.5, 41.8], [19.4, 40.4], [20.7, 39.4], [21.1, 37.9], [22.2, 37], [23.5, 38.2], [22.9, 40.4], [23.8, 40.6]],
  ott1566b: [[34.6, 31.9], [35.9, 34.7], [36.1, 36.7], [39, 37], [42, 37.5], [44.5, 37], [46, 35.5], [47.5, 33], [48.5, 30.5], [47.5, 29.5], [44.5, 29.2], [40.5, 27.5], [39, 24], [40.4, 20.5],
    [39.2, 21.4], [37.3, 24.5], [35, 28], [34.8, 29.5]],
  ott1566c: [[-1.6, 35.1], [-1, 35.7], [1, 36.5], [3, 36.8], [5, 36.8], [8.6, 36.9], [9.8, 37.3], [10.2, 37.2], [11, 37], [10.5, 36], [10, 34.3], [11.5, 33.2], [14, 32.5], [20, 30.6], [25, 31.7],
    [29.5, 31.2], [32.3, 31.3], [34.6, 31.9], [34.8, 29.5], [33.5, 27.5], [35, 24], [33.4, 22], [25, 22], [24, 26], [19, 29], [14, 29.5], [10, 31], [8, 33], [2, 33.5], [-1.6, 34]],
  ott1914a: [[26, 40.1], [26.4, 39.3], [27.2, 37.9], [28.2, 36.8], [29.6, 36.3], [32.6, 36.1], [36.1, 36.7], [39, 37], [42, 37.5], [44, 39], [43, 41], [41.5, 41.5], [39.7, 41], [37.5, 41.1],
    [35.2, 42], [33.5, 42], [31.5, 41.2], [29.1, 41.2], [28, 41.6], [28, 42], [26.6, 42], [26.3, 41.2]],
  ott1914b: [[34.6, 31.9], [35.9, 34.7], [36.1, 36.7], [39, 37], [42, 37.5], [44.5, 37], [46, 35.5], [47.5, 33], [48.5, 30.5], [47.5, 29.5], [44.5, 29.2], [40.5, 27.5], [39, 24], [40.4, 20.5],
    [42.6, 16.5], [43.3, 12.8], [42.3, 15.5], [39.2, 21.4], [37.3, 24.5], [35, 28], [34.8, 29.5]],
};
const CITY = { riyadh: [46.72, 24.71, 'Riyadh'], mecca: [39.83, 21.42, 'Mecca'], makkah: [39.83, 21.42, 'Mecca'], medina: [39.61, 24.47, 'Medina'], jeddah: [39.17, 21.54, 'Jeddah'],
  dammam: [50.10, 26.43, 'Dammam'], dhahran: [50.11, 26.29, 'Dhahran'], diriyah: [46.57, 24.73, 'Diriyah'], hegra: [37.95, 26.79, 'Hegra'], alula: [37.92, 26.62, 'AlUla'], neom: [35.2, 28.0, 'NEOM'],
  taif: [40.41, 21.27, 'Taif'], hail: [41.69, 27.52, "Ha'il"], tabuk: [36.57, 28.38, 'Tabuk'], kuwait: [47.98, 29.37, 'Kuwait'], sanaa: [44.21, 15.37, "Sana'a"], muscat: [58.41, 23.59, 'Muscat'],
  doha: [51.53, 25.29, 'Doha'], dubai: [55.27, 25.2, 'Dubai'], bahrain: [50.58, 26.22, 'Bahrain'], baghdad: [44.37, 33.31, 'Baghdad'], amman: [35.93, 31.95, 'Amman'], jerusalem: [35.21, 31.77, 'Jerusalem'],
  rastanura: [50.16, 26.64, 'Ras Tanura'], yanbu: [38.06, 24.09, 'Yanbu'], hormuz: [56.3, 26.6, 'Strait of Hormuz'], abha: [42.5, 18.22, 'Abha'], jizan: [42.55, 16.89, 'Jizan'],
  abqaiq: [49.67, 25.94, 'Abqaiq'], ghawar: [49.3, 24.9, 'Ghawar'], petra: [35.44, 30.33, 'Petra'], damascus: [36.29, 33.51, 'Damascus'], aden: [45.03, 12.8, 'Aden'], shabwah: [47.0, 15.37, 'Shabwah'], gaza: [34.47, 31.5, 'Gaza'], sibilla: [44.9, 26.4, 'Sibilla'],
  bandarabbas: [56.27, 27.18, 'Bandar Abbas'], hormuzisland: [56.46, 27.06, 'Hormuz Island'], qeshm: [55.9, 26.82, 'Qeshm'], larak: [56.36, 26.86, 'Larak'], musandam: [56.3, 26.2, 'Musandam'],
  khasab: [56.24, 26.18, 'Khasab'], fujairah: [56.33, 25.12, 'Fujairah'], abumusa: [55.03, 25.88, 'Abu Musa'], tunb: [55.3, 26.26, 'Greater Tunb'], basra: [47.78, 30.51, 'Basra'], kharg: [50.33, 29.26, 'Kharg Island'],
  bushehr: [50.84, 28.97, 'Bushehr'],
  persepolis: [52.89, 29.93, 'Persepolis'], pasargadae: [53.17, 30.2, 'Pasargadae'], susa: [48.25, 32.19, 'Susa'], babylon: [44.42, 32.54, 'Babylon'], sardis: [28.04, 38.49, 'Sardis'],
  memphis: [31.25, 29.85, 'Memphis'], ecbatana: [48.52, 34.8, 'Ecbatana'], bactra: [66.9, 36.76, 'Bactra'], athens: [23.73, 37.98, 'Athens'], marathon: [23.97, 38.15, 'Marathon'],
  gaugamela: [43.3, 36.6, 'Gaugamela'], ctesiphon: [44.58, 33.09, 'Ctesiphon'], merv: [61.84, 37.66, 'Merv'], behistun: [47.44, 34.39, 'Behistun'], carrhae: [39.03, 36.87, 'Carrhae'],
  constantinople: [28.98, 41.01, 'Constantinople'], istanbul: [28.98, 41.01, 'Istanbul'], bursa: [29.06, 40.19, 'Bursa'], sogut: [30.18, 40.02, 'Söğüt'], edirne: [26.56, 41.68, 'Edirne'], gallipoli: [26.67, 40.41, 'Gallipoli'], kosovo: [21.1, 42.7, 'Kosovo'], nicopolis: [24.9, 43.7, 'Nicopolis'], ankara: [32.85, 39.93, 'Ankara'], chaldiran: [44.0, 39.1, 'Chaldiran'], cairo: [31.24, 30.04, 'Cairo'], belgrade: [20.46, 44.79, 'Belgrade'], rhodes: [28.22, 36.43, 'Rhodes'], mohacs: [18.68, 45.99, 'Mohács'], vienna: [16.37, 48.21, 'Vienna'], buda: [19.04, 47.5, 'Buda'], lepanto: [21.83, 38.39, 'Lepanto'], algiers: [3.06, 36.75, 'Algiers'], tunis: [10.18, 36.8, 'Tunis'], aleppo: [37.16, 36.2, 'Aleppo'], sevastopol: [33.52, 44.6, 'Crimea'], athens2: [23.73, 37.98, 'Athens'], taxila: [72.8, 33.75, 'Taxila'], nineveh: [43.15, 36.36, 'Nineveh'], salamis: [23.5, 37.95, 'Salamis'], thermopylae: [22.54, 38.8, 'Thermopylae'],
  nahavand: [48.37, 34.19, 'Nahavand'], yazd: [54.37, 31.9, 'Yazd'], sanjan: [72.85, 20.2, 'Sanjan'], tyre: [35.2, 33.27, 'Tyre'], tabriz: [46.29, 38.08, 'Tabriz'], nishapur: [58.8, 36.21, 'Nishapur'], shiraz: [52.53, 29.59, 'Shiraz'], qadisiyyah: [44.6, 31.8, 'Qadisiyyah'], edessa: [38.79, 37.16, 'Edessa'], alexandria: [29.92, 31.2, 'Alexandria'], gwadar: [62.33, 25.13, 'Gwadar'], abudhabi: [54.37, 24.45, 'Abu Dhabi'], tehran: [51.39, 35.69, 'Tehran'], isfahan: [51.67, 32.65, 'Isfahan'] };
function tanker(sc = 1) {                                                         // low-poly crude tanker, bow towards +x
  const T = new THREE.Group(), hull = new THREE.Shape(); hull.moveTo(-.5, -.1); hull.lineTo(.42, -.1); hull.quadraticCurveTo(.55, 0, .42, .1); hull.lineTo(-.5, .1); hull.closePath();
  const hg = new THREE.ExtrudeGeometry(hull, { depth: .09, bevelEnabled: false }); hg.rotateX(-Math.PI / 2); hg.translate(0, -.045, 0);
  const red = mesh(hg, M(0x9c1d16, { r: .6 })); red.scale.y = .5; red.position.y = -.02; T.add(red);
  const top = mesh(hg.clone(), M(0x1e2a33, { r: .55 })); top.scale.y = .55; top.position.y = .025; T.add(top);
  const deck = mesh(new THREE.BoxGeometry(.8, .006, .17), M(0x5b6b4a, { r: .8 })); deck.position.set(-.02, .052, 0); T.add(deck);
  const br = mesh(new THREE.BoxGeometry(.1, .1, .15), M(0xf2f0ea, { r: .5 })); br.position.set(-.43, .1, 0); T.add(br);
  const fun = mesh(new THREE.CylinderGeometry(.018, .022, .06, 12), M(C.red)); fun.position.set(-.47, .17, 0); T.add(fun);
  for (let k = 0; k < 5; k++) { const pp = mesh(new THREE.CylinderGeometry(.008, .008, .5, 6).rotateZ(Math.PI / 2), M(0xc9a227, { m: .5 })); pp.position.set(.02, .06, -.05 + k * .025); T.add(pp); }
  T.scale.setScalar(sc); return T; }
const PROPS = {
  // light bulb: glows, flickers, goes out at `ev` (inspiration leaving)
  'bong-den'(o) { const G = new THREE.Group(), pts = [];
    pts.push(new THREE.Vector2(.28, -.38)); for (let i = 0; i <= 28; i++) { const th = -1.05 + i / 28 * (Math.PI / 2 + 1.05); pts.push(new THREE.Vector2(Math.max(.005, .62 * Math.cos(th)), .65 + .62 * Math.sin(th))); }   // neck + glass globe
    const glassM = new THREE.MeshStandardMaterial({ color: 0xfff6e2, roughness: .08, transparent: true, opacity: .42, emissive: C.warm, emissiveIntensity: 0 });
    const glass = mesh(new THREE.LatheGeometry(pts, 48), glassM, false); G.add(glass);
    const filM = M(0x553311, { e: 0xffb050, ei: 0 }), fil = mesh(new THREE.TorusGeometry(.16, .025, 8, 32, Math.PI), filM, false); fil.position.y = .55; G.add(fil);
    for (let i = 0; i < 4; i++) { const b = mesh(new THREE.CylinderGeometry(.3 - i * .012, .3 - i * .012, .09, 32), M(C.metal, { m: .7, r: .35 })); b.position.y = -.42 - i * .1; G.add(b); }
    const tip = mesh(new THREE.CylinderGeometry(.12, .2, .12, 24), M(C.ink)); tip.position.y = -.85; G.add(tip);
    const L = new THREE.PointLight(0xffc070, 0, 6, 1.6); L.position.y = .55; G.add(L); G.add(floor(1.4, -.92));
    const hk = document.createElement('canvas'); hk.width = hk.height = 256; const hg = hk.getContext('2d'), rg = hg.createRadialGradient(128, 128, 0, 128, 128, 128);
    rg.addColorStop(0, 'rgba(255,214,150,.9)'); rg.addColorStop(.35, 'rgba(255,170,80,.35)'); rg.addColorStop(1, 'rgba(255,150,60,0)'); hg.fillStyle = rg; hg.fillRect(0, 0, 256, 256);
    const haloM = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(hk), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), halo = new THREE.Sprite(haloM); halo.scale.setScalar(3.2); halo.position.y = .62; G.add(halo);
    return { G, update(s) { const ev = s.ev, lt = s.lt; let on = lt < ev ? 1 : 0;
      if (lt > ev - .6 && lt < ev) on = Math.sin(lt * 53) > .2 ? 1 : .25;                   // flicker before dying
      if (lt >= ev && lt < ev + .25) on = Math.sin(lt * 80) > .5 ? .5 : 0;
      glassM.emissiveIntensity = on * 1.6; glassM.opacity = .35 + on * .45; filM.emissiveIntensity = on * 5; L.intensity = on * 8; haloM.opacity = on; G.rotation.y = Math.sin(s.t * .5) * .3; } }; },
  // alarm clock: hands at `gio` (e.g. 6:00), rings (shakes, hammer) from `ev`
  'dong-ho'(o) { const G = new THREE.Group(), body = new THREE.Group(); G.add(body);
    const cas = mesh(new THREE.CylinderGeometry(.85, .85, .5, 48).rotateX(Math.PI / 2), M(C.red, { r: .4 })); body.add(cas);
    const face = mesh(new THREE.CircleGeometry(.72, 48), M(C.cream, { r: .7 }), false); face.position.z = .26; body.add(face);
    for (let i = 0; i < 12; i++) { const tk = mesh(new THREE.BoxGeometry(.04, i % 3 ? .08 : .15, .02), M(C.ink), false); const a = i / 12 * Math.PI * 2; tk.position.set(Math.sin(a) * .6, Math.cos(a) * .6, .27); tk.rotation.z = -a; body.add(tk); }
    const hand = (len, w) => { const p = new THREE.Group(), h = mesh(new THREE.BoxGeometry(w, len, .03), M(C.ink), false); h.position.y = len / 2 - .05; p.add(h); p.position.z = .29; body.add(p); return p; };
    const hh = hand(.38, .06), mm = hand(.56, .04); const pin = mesh(new THREE.CylinderGeometry(.05, .05, .06, 16).rotateX(Math.PI / 2), M(C.red)); pin.position.z = .31; body.add(pin);
    const bells = [-1, 1].map(sx => { const b = mesh(new THREE.SphereGeometry(.32, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M(C.metal, { m: .8, r: .3 })); b.position.set(sx * .5, .78, 0); b.rotation.z = -sx * .55; body.add(b); return b; });
    const ham = mesh(new THREE.BoxGeometry(.06, .3, .06), M(C.metal, { m: .8 })); ham.position.set(0, .98, 0); body.add(ham);
    [-1, 1].forEach(sx => { const l = mesh(new THREE.CylinderGeometry(.04, .06, .35, 12), M(C.ink)); l.position.set(sx * .5, -.9, 0); l.rotation.z = sx * .45; body.add(l); });
    G.add(floor(1.5, -1.05)); const [gh, gm] = String(o.gio || '6:00').split(':').map(Number);
    return { G, update(s) { const ring = s.lt >= s.ev, sh = ring ? Math.sin(s.lt * 62) : 0;
      mm.rotation.z = -((gm || 0) / 60) * Math.PI * 2 - (ring ? 0 : (s.ev - s.lt) * -.02); hh.rotation.z = -(((gh % 12) + (gm || 0) / 60) / 12) * Math.PI * 2;
      body.rotation.z = sh * .07; body.position.x = sh * .03; ham.rotation.z = sh * .6; bells.forEach((b, i) => b.position.y = .78 + (ring ? Math.abs(Math.sin(s.lt * 62 + i)) * .02 : 0));
      G.rotation.y = -.35 + Math.sin(s.t * .4) * .2; } }; },
  // desk calendar flipping from `tu` to `den` (number), with `chu` label on the binder
  'lich'(o) { const G = new THREE.Group(), tu = o.tu ?? 1, den = o.den ?? 21, tex = {};
    const T = n => tex[n] || (tex[n] = label(String(n), { sub: o.chu || 'NGÀY', size: n > 99 ? 220 : 300 }));
    const base = mesh(new THREE.BoxGeometry(1.9, 2.1, .3), M(C.cream, { r: .8 })); G.add(base);
    const bar = mesh(new THREE.BoxGeometry(1.95, .38, .38), M(C.red, { r: .45 })); bar.position.y = 1.15; G.add(bar);
    for (let i = 0; i < 4; i++) { const r = mesh(new THREE.TorusGeometry(.1, .025, 8, 24), M(C.metal, { m: .8, r: .3 })); r.position.set(-.6 + i * .4, 1.15, .2); G.add(r); }
    const pageM = new THREE.MeshStandardMaterial({ map: T(tu), roughness: .85 }), page = mesh(new THREE.PlaneGeometry(1.8, 1.95), pageM, false); page.position.set(0, -.02, .16); G.add(page);
    const flipM = new THREE.MeshStandardMaterial({ map: T(tu), roughness: .85, side: THREE.DoubleSide }), fp = new THREE.Group(), flip = mesh(new THREE.PlaneGeometry(1.8, 1.95), flipM, false);
    flip.position.y = -.975; fp.add(flip); fp.position.set(0, .955, .17); G.add(fp); G.add(floor(1.7, -1.1));
    return { G, update(s) { const span = Math.max(.6, s.ev), n = den - tu, f = clamp(s.lt / span) * n, k = Math.min(n, Math.floor(f)), ph = f - k;
      const cur = tu + k, done = k >= n; pageM.map = T(done ? den : cur + 1); flipM.map = T(cur); fp.visible = !done; fp.rotation.x = done ? 0 : -eo3(ph) * Math.PI * .95;
      G.rotation.y = -.3 + Math.sin(s.t * .35) * .18; G.rotation.x = -.08; } }; },
  // grid of `so` tiles rising one by one; `thieu`: index of a missed tile (stays dark and low, the rest continue)
  'o-vuong'(o) { const G = new THREE.Group(), n = o.so ?? 66, cols = o.cot ?? 11, rows = Math.ceil(n / cols), sz = .26, gap = .06, tiles = [];
    const plate = mesh(new THREE.BoxGeometry(cols * (sz + gap) + .2, .08, rows * (sz + gap) + .2), M(C.ink, { r: .9 })); plate.position.y = -.08; G.add(plate);
    for (let i = 0; i < n; i++) { const c = i % cols, r = Math.floor(i / cols), miss = i === o.thieu, last = i === n - 1;
      const tm = mesh(new THREE.BoxGeometry(sz, sz, sz), M(miss ? 0x3a3a3a : last ? C.red : (i % 7 === 6 ? C.red : C.cream), { r: .5 })); tm.position.set((c - (cols - 1) / 2) * (sz + gap), 0, (r - (rows - 1) / 2) * (sz + gap)); G.add(tm); tiles.push(tm); }
    G.add(floor(2.4, -.13));
    return { G, update(s) { const span = Math.max(1, s.D * (o.lap_day ?? .75));
      tiles.forEach((tm, i) => { const u = clamp((s.lt - .3 - i / n * span) / .25), miss = i === o.thieu; tm.scale.setScalar(miss ? .6 : Math.max(.001, back(u)));
        tm.position.y = miss ? -.08 : sz / 2 * back(u) - .02; tm.visible = u > 0 || miss; });
      G.rotation.x = .75; G.rotation.y = Math.sin(s.t * .3) * .25; } }; },
  // emotional ups & downs: a row of bars riding a travelling sine wave + a red ribbon
  'song'(o) { const G = new THREE.Group(), N = 15, bars = [];
    for (let i = 0; i < N; i++) { const b = mesh(new THREE.BoxGeometry(.17, 1, .17), M(i % 2 ? C.cream : C.red, { r: .5 })); b.position.x = (i - (N - 1) / 2) * .21; G.add(b); bars.push(b); }
    G.add(floor(2, -1.02));
    return { G, update(s) { bars.forEach((b, i) => { const h = .25 + .85 * (.5 + .5 * Math.sin(i * .7 - s.t * 2.6)) * eo3(s.lt / .6); b.scale.y = h * 1.8; b.position.y = -1 + h * .9; });
      G.rotation.y = Math.sin(s.t * .3) * .35; G.rotation.x = .25; } }; },
  // tower: `so` blocks drop and stack one after another (small daily effort piling up)
  'thap'(o) { const G = new THREE.Group(), n = o.so ?? 9, bl = [];
    for (let i = 0; i < n; i++) { const b = mesh(new THREE.BoxGeometry(.9, .22, .9), M(i % 3 === 2 ? C.red : C.cream, { r: .5 })); G.add(b); bl.push(b); }
    G.add(floor(1.4, -1));
    return { G, update(s) { const span = Math.max(1, s.D * .8);
      bl.forEach((b, i) => { const t0 = .2 + i / n * span, u = clamp((s.lt - t0) / .35), y = -1 + .11 + i * .23; b.visible = u > 0;
        b.position.y = y + (1 - eo3(u)) * 2.5 - (u > .7 ? Math.sin((u - .7) / .3 * Math.PI) * .03 : 0); b.rotation.y = i * .12 + (1 - u) * .8; });
      G.rotation.y = s.t * .25; } }; },
  // stairs with a little figure hopping up one step at a time
  'cau-thang'(o) { const G = new THREE.Group(), n = o.so ?? 7, w = .36, h = .26;
    for (let i = 0; i < n; i++) { const st = mesh(new THREE.BoxGeometry(1.1, h * (i + 1), w), M(i === n - 1 ? C.red : C.cream, { r: .6 })); st.position.set(0, -1 + h * (i + 1) / 2, -i * w + n * w / 2 - w / 2); G.add(st); }
    const man = new THREE.Group(), bodyM = M(C.ink, { r: .5 }); const torso = mesh(new THREE.CapsuleGeometry(.09, .22, 6, 12), bodyM); torso.position.y = .25; man.add(torso);
    const head = mesh(new THREE.SphereGeometry(.09, 20, 14), M(C.red)); head.position.y = .5; man.add(head); G.add(man); G.add(floor(1.8, -1));
    return { G, update(s) { const span = Math.max(1, s.D * .85), f = clamp((s.lt - .3) / span) * (n - 1), k = Math.floor(f), ph = f - k, z0 = n * w / 2 - w / 2 + w * .9;
      const yA = -1 + h * k + (k ? h : 0), yB = -1 + h * (k + 1) + h; man.position.y = (k === 0 && ph === 0 ? -1 : yA + (yB - yA) * eo3(ph)) + Math.sin(Math.PI * ph) * .18;
      man.position.z = z0 - w * (k + eo3(ph)); man.rotation.y = Math.PI; G.rotation.y = -.9 + Math.sin(s.t * .3) * .15; G.rotation.x = .25; } }; },
  // door that swings open at `ev`, light pours out
  'cua'(o) { const G = new THREE.Group(), fr = M(C.red, { r: .5 });
    [[-.72, 0, .14, 2.3], [.72, 0, .14, 2.3], [0, 1.15, 1.58, .14]].forEach(([x, y, w, h]) => { const b = mesh(new THREE.BoxGeometry(w, h, .25), fr); b.position.set(x, y, 0); G.add(b); });
    const glowM = new THREE.MeshBasicMaterial({ color: 0xfff1d0 }), glow = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.16), glowM); glow.position.set(0, 0, -.05); G.add(glow);
    const hinge = new THREE.Group(); hinge.position.set(-.65, 0, .04); G.add(hinge);
    const door = mesh(new THREE.BoxGeometry(1.3, 2.16, .08), M(0x2a1f1a, { r: .6 })); door.position.x = .65; hinge.add(door);
    const knob = mesh(new THREE.SphereGeometry(.05, 16, 12), M(C.gold, { m: .8, r: .3 })); knob.position.set(1.15, 0, .07); hinge.add(knob);
    const spillM = new THREE.MeshBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.6).rotateX(-Math.PI / 2), spillM); spill.position.set(0, -1.07, 1.3); G.add(spill);
    const L = new THREE.SpotLight(0xffe2b0, 0, 8, .7, .6); L.position.set(0, .3, -1); L.target.position.set(0, -1, 3); G.add(L, L.target); G.add(floor(2, -1.08));
    return { G, update(s) { const u = eo3((s.lt - s.ev) / 1.4); hinge.rotation.y = -u * 1.35; glowM.color.setScalar(.35 + .65 * u); spillM.opacity = u * .55; L.intensity = u * 40;
      G.rotation.y = .35 + Math.sin(s.t * .3) * .08; G.rotation.x = .12; } }; },
  // dumbbell turning slowly
  'ta'(o) { const G = new THREE.Group(), D = new THREE.Group(); G.add(D);
    const bar = mesh(new THREE.CylinderGeometry(.07, .07, 2, 24).rotateZ(Math.PI / 2), M(C.metal, { m: .85, r: .3 })); D.add(bar);
    [-1, 1].forEach(sx => [0, 1].forEach(k => { const p = mesh(new THREE.CylinderGeometry(.5 - k * .1, .5 - k * .1, .14, 40).rotateZ(Math.PI / 2), M(k ? C.red : C.ink, { r: .45 })); p.position.x = sx * (.62 + k * .16); D.add(p); }));
    G.add(floor(1.6, -.75));
    return { G, update(s) { D.rotation.x = s.t * .8; D.position.y = Math.sin(s.t * 1.6) * .06; G.rotation.y = -.5 + Math.sin(s.t * .3) * .3; G.rotation.x = .2; } }; },
  // hourglass: sand flows over the scene
  'dong-ho-cat'(o) { const G = new THREE.Group(), glassM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .05, transparent: true, opacity: .3 });
    const pts = []; for (let i = 0; i <= 20; i++) { const a = i / 20, y = -.9 + a * 1.8; pts.push(new THREE.Vector2(.08 + Math.pow(Math.abs(a - .5) * 2, 1.4) * .52, y)); }
    G.add(mesh(new THREE.LatheGeometry(pts, 40), glassM, false));
    [-1, 1].forEach(sy => { const c = mesh(new THREE.CylinderGeometry(.72, .72, .12, 40), M(C.red, { r: .45 })); c.position.y = sy * .98; G.add(c); });
    const sandM = M(C.gold, { r: .9 }), top = mesh(new THREE.ConeGeometry(.5, .6, 32).rotateX(Math.PI), sandM), bot = mesh(new THREE.ConeGeometry(.55, .6, 32), sandM), fall = mesh(new THREE.CylinderGeometry(.015, .015, .9, 8), sandM);
    top.position.y = .35; bot.position.y = -.62; fall.position.y = -.42; G.add(top, bot, fall); G.add(floor(1.3, -1.05));
    return { G, update(s) { const u = clamp(s.lt / s.D); top.scale.set(1 - u * .8, 1 - u * .85, 1 - u * .8); bot.scale.set(.25 + u * .75, .15 + u * .85, .25 + u * .75); bot.position.y = -.9 + .3 * (.15 + u * .85);
      G.rotation.y = s.t * .3; } }; },
  // 3D map of the Arabian Peninsula (stylised, approximate borders): landmass rises, Saudi Arabia lifts in green, city pins pop in.
  // o.ghim: ["riyadh", "mecca", …] or [{ ten, lon, lat }]; pin k appears at s.evs[k] (from su_kien list) or spread over the scene.
  // o.vung: "saudi" (default) | "ban-dao" (whole peninsula only) · o.mau: hex for the highlighted country
  // 3D map (stylised, approximate borders): land rises, one country lifts in colour, city pins pop in, tankers sail a lane.
  // o.tam: [lon, lat] centre (default Arabia) · o.ty_le: zoom (default .32 map units per degree) · o.vung: saudi (default) | iran | ban-do (none)
  // o.ghim: ["riyadh", …] or [{ ten, lon, lat }] — pin k appears at s.evs[k] (su_kien words) or spread over the scene · o.mau: hex for the highlight
  // o.tuyen: [[lon, lat], …] shipping lane, o.tau: number of tankers (default 3), o.toc: laps per 10 s · o.thuoc: { tu: [lon, lat], den: [lon, lat], chu: "39 km" }
  'ban-do'(o) { const G = new THREE.Group(), Mp = new THREE.Group(); G.add(Mp);
    const [LON0, LAT0] = o.tam || [45.5, 23.5], K = o.ty_le ?? .32, P = ([lo, la]) => new THREE.Vector2((lo - LON0) * K, (la - LAT0) * K), zoomed = K > .5;
    const shape = pts => { const s = new THREE.Shape(); pts.map(P).forEach((v, i) => i ? s.lineTo(v.x, v.y) : s.moveTo(v.x, v.y)); s.closePath(); return s; };
    const ext = (pts, d, m) => { const g = new THREE.ExtrudeGeometry(shape(pts), { depth: d, bevelEnabled: true, bevelSize: .015, bevelThickness: .015, bevelSegments: 2 }); g.rotateX(-Math.PI / 2); return mesh(g, m); };
    const sea = mesh(zoomed ? new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2) : new THREE.CircleGeometry(4.6, 64).rotateX(-Math.PI / 2), M(0x1d3c56, { r: .35, m: .1 })); sea.position.y = -.02; Mp.add(sea);
    const sand = M(0xd8c39a, { r: .85 }), sand2 = M(0xc9b48a, { r: .9 }), hiM = M(o.mau ? parseInt(String(o.mau).replace('#', ''), 16) : (o.vung === 'iran' ? 0x2e7d4f : 0x1f7a4d), { r: .5 });
    const lands = [ext(GEO.peninsula, .08, sand), ext(GEO.north, .06, sand2), ext(GEO.iran, o.vung === 'iran' ? .2 : .08, o.vung === 'iran' ? hiM : sand2)];
    GEO.islands.forEach(pt => lands.push(ext(pt, .06, sand))); lands.forEach(l => Mp.add(l));
    const sa = (o.vung || 'saudi') === 'saudi' ? ext(GEO.saudi, .22, hiM) : null; if (sa) Mp.add(sa);
    const pins = (o.ghim || []).map(p => typeof p === 'string' ? { ten: CITY[p.toLowerCase()]?.[2] || p, lon: CITY[p.toLowerCase()]?.[0], lat: CITY[p.toLowerCase()]?.[1] } : p).filter(p => p.lon != null).map(p => {
      const g = new THREE.Group(), v = P([p.lon, p.lat]); g.position.set(v.x, .24, -v.y);
      const stem = mesh(new THREE.CylinderGeometry(.012, .012, .32, 8), M(C.ink)); stem.position.y = .16; g.add(stem);
      const head = mesh(new THREE.SphereGeometry(.06, 20, 14), M(C.red, { r: .35, e: 0x550000, ei: .4 })); head.position.y = .34; g.add(head);
      const t = label(p.ten, { w: 512, h: 128, size: 72, y: .55, bg: 'rgba(10,14,20,.6)', fg: '#ffffff' }), sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
      sp.scale.set(1.3, .325, 1); sp.position.y = .56; g.add(sp); Mp.add(g); return g; });
    let ruler = null; if (o.thuoc) { const a = P(o.thuoc.tu), b = P(o.thuoc.den), L = a.distanceTo(b); ruler = new THREE.Group();
      const bar = mesh(new THREE.BoxGeometry(L, .03, .03), M(C.red, { e: 0x660000, ei: .5 })); bar.position.set((a.x + b.x) / 2, .12, -(a.y + b.y) / 2); bar.rotation.y = Math.atan2(b.y - a.y, b.x - a.x); ruler.add(bar);
      [a, b].forEach(v => { const e = mesh(new THREE.SphereGeometry(.045, 14, 10), M(C.red)); e.position.set(v.x, .12, -v.y); ruler.add(e); });
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: label(o.thuoc.chu || '', { w: 512, h: 128, size: 80, y: .55, bg: 'rgba(160,20,10,.85)', fg: '#ffffff' }), transparent: true, depthTest: false }));
      sp.scale.set(1.2, .3, 1); sp.position.set((a.x + b.x) / 2 + .55, .45, -(a.y + b.y) / 2); ruler.add(sp); Mp.add(ruler); }
    const lane = (o.tuyen || []).map(P), ships = []; if (lane.length > 1) { const seg = []; let tot = 0; for (let k = 1; k < lane.length; k++) { const d = lane[k].distanceTo(lane[k - 1]); seg.push(d); tot += d; }
      const at = u => { let d = u * tot, k = 0; while (k < seg.length - 1 && d > seg[k]) { d -= seg[k]; k++; } const a = lane[k], b = lane[k + 1], f = Math.min(1, d / seg[k]); return [a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, Math.atan2(b.y - a.y, b.x - a.x)]; };
      const n = o.tau ?? 3, sc = o.co_tau ?? .2; for (let k = 0; k < n; k++) { const sh = tanker(sc); Mp.add(sh); ships.push(sh); }
      ships.at = at; }
    return { G, update(s) { const u = eo3(s.lt / .9); lands.forEach(l => l.scale.y = Math.max(.01, u)); if (sa) sa.scale.y = Math.max(.01, eo3((s.lt - .5) / .9));
      pins.forEach((g, k) => { const t0 = (s.evs && s.evs[k] != null) ? s.evs[k] : .9 + k * Math.max(.5, (s.D - 1.6) / Math.max(1, pins.length)); g.scale.setScalar(Math.max(.001, back(clamp((s.lt - t0) / .4)))); });
      if (ruler) ruler.scale.setScalar(Math.max(.001, back(clamp((s.lt - (s.ev ?? 1.2)) / .5))));
      ships.forEach((sh, k) => { const [x, y, a] = ships.at(((s.t * (o.toc ?? .6) / 10) + k / ships.length) % 1); sh.position.set(x, .03 + Math.sin(s.t * 2 + k) * .004, -y); sh.rotation.y = a; sh.visible = s.lt > .8; });
      Mp.rotation.y = Math.sin(s.t * .12) * .12 - .05; G.rotation.x = .95 - .1 * eo3(s.lt / s.D); } }; },
  // wide ancient-world map: land block with seas cut out, raised empire (vung: persia | parthia | sasanian | ott1300 | ott1453 | ott1566a/b/c | ott1914a/b), city pins, routes with riders
  'ban-do-co'(o) { const G = new THREE.Group(), Mp = new THREE.Group(); G.add(Mp);
    const [LON0, LAT0] = o.tam || [47, 30.5], K = o.ty_le ?? .1, P = ([lo, la]) => new THREE.Vector2((lo - LON0) * K, (la - LAT0) * K);
    const path = (pts, cls = THREE.Shape) => { const sh = new cls(); pts.map(P).forEach((v, i) => i ? sh.lineTo(v.x, v.y) : sh.moveTo(v.x, v.y)); sh.closePath(); return sh; };
    const ext = (sh, d, m, bev = .012) => { const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelSize: bev, bevelThickness: bev, bevelSegments: 2 }); g.rotateX(-Math.PI / 2); return mesh(g, m); };
    const sea = mesh(new THREE.PlaneGeometry(9, 5.6).rotateX(-Math.PI / 2), M(0x1d3c56, { r: .35, m: .1 })); sea.position.y = -.02; Mp.add(sea);
    const land = path([[-9.5, 8], [80, 8], [80, 52], [-9.5, 52]]); ['med', 'black', 'caspian', 'aral', 'south'].forEach(k => land.holes.push(path(WIDE[k], THREE.Path)));
    const ground = ext(land, .06, M(0xa89878, { r: .9 })); Mp.add(ground);
    const regions = [].concat(o.vung || []).filter(k => WIDE[k]).map((k, i) => { const col = { persia: 0x9a3a1c, parthia: 0x5a2f6e, sasanian: 0x1f6a4a, ott1300: 0xb0201f, ott1453: 0xb0201f, ott1914a: 0xb0201f, ott1914b: 0xb0201f }[k] ?? (k.startsWith('ott') ? 0xb0201f : 0x9a3a1c);
      const r = ext(path(WIDE[k]), .14, M(o.mau ? parseInt(String(o.mau).replace('#', ''), 16) : col, { r: .45 }), .02); r.position.y = .002 * i; Mp.add(r); return r; });
    const pins = (o.ghim || []).map(p => typeof p === 'string' ? { ten: CITY[p.toLowerCase()]?.[2] || p, lon: CITY[p.toLowerCase()]?.[0], lat: CITY[p.toLowerCase()]?.[1] } : p).filter(p => p.lon != null).map(p => {
      const g = new THREE.Group(), v = P([p.lon, p.lat]); g.position.set(v.x, .16, -v.y);
      const stem = mesh(new THREE.CylinderGeometry(.008, .008, .2, 8), M(C.ink)); stem.position.y = .1; g.add(stem);
      const head = mesh(new THREE.SphereGeometry(.04, 20, 14), M(C.gold, { r: .3, e: 0x553300, ei: .4 })); head.position.y = .21; g.add(head);
      const t = label(p.ten, { w: 512, h: 128, size: 72, y: .55, bg: 'rgba(10,14,20,.65)', fg: '#ffffff' }), sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
      sp.scale.set(.9, .225, 1); sp.position.y = .37; g.add(sp); Mp.add(g); return g; });
    const routes = (o.tuyen || []).map(r => { const pts = r.map(c => typeof c === 'string' ? CITY[c.toLowerCase()] : c).filter(Boolean).map(c => { const v = P(c); return new THREE.Vector3(v.x, .2, -v.y); });
      const curve = new THREE.CatmullRomCurve3(pts), tube = mesh(new THREE.TubeGeometry(curve, 120, .014, 6), M(C.red, { e: 0x881100, ei: .7 })); Mp.add(tube); const total = tube.geometry.index.count;
      const riders = [0, .33, .66].map(() => { const k = mesh(new THREE.SphereGeometry(.035, 12, 8), M(0xffe2a0, { e: 0xffb040, ei: 2 })); Mp.add(k); return k; }); return { curve, tube, total, riders }; });
    let title = null; if (o.nhan) { title = new THREE.Sprite(new THREE.SpriteMaterial({ map: label(o.nhan, { w: 2048, h: 160, size: 96, y: .55, bg: 'rgba(0,0,0,0)', fg: '#fff3d6' }), transparent: true, depthTest: false }));
      const v = P(o.nhan_o || [47, 47.5]); title.position.set(v.x, .5, -v.y); title.scale.set(5.2, .4, 1); Mp.add(title); }
    return { G, update(s) { const u = eo3(s.lt / .9); ground.scale.y = Math.max(.01, u);
      regions.forEach((r, i) => r.scale.y = Math.max(.01, eo3((s.lt - .4 - i * .3) / .9)));
      pins.forEach((g, k) => { const t0 = (s.evs && s.evs[k] != null) ? s.evs[k] : .9 + k * Math.max(.4, (s.D - 1.6) / Math.max(1, pins.length)); g.scale.setScalar(Math.max(.001, back(clamp((s.lt - t0) / .4)))); });
      routes.forEach(rt => { const pr = eo3((s.lt - .8) / 1.6); rt.tube.geometry.setDrawRange(0, Math.floor(rt.total * pr / 6) * 6); rt.riders.forEach((k, i) => { const v = (s.t * .12 + i / 3) % 1; k.position.copy(rt.curve.getPointAt(v * pr)); k.visible = pr > .05; }); });
      if (title) title.material.opacity = clamp((s.lt - 1) / .6);
      Mp.rotation.y = Math.sin(s.t * .1) * .06; G.rotation.x = .9 - .08 * eo3(s.lt / s.D); } }; },
  // oil tanker riding a gentle swell (standalone prop)
  'tau-dau'(o) { const G = new THREE.Group(), sh = tanker(1.6); G.add(sh);
    const water = mesh(new THREE.CircleGeometry(2.6, 64).rotateX(-Math.PI / 2), M(0x1f4a6b, { r: .25, m: .2 }), false); water.position.y = -.12; G.add(water);
    const wake = mesh(new THREE.PlaneGeometry(1.6, .5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .25 }), false); wake.position.set(-1.6, -.1, 0); G.add(wake);
    return { G, update(s) { sh.position.y = Math.sin(s.t * 1.3) * .03; sh.rotation.z = Math.sin(s.t * 1.1) * .025; sh.rotation.x = Math.sin(s.t * .9) * .02; wake.material.opacity = .18 + .08 * Math.sin(s.t * 3);
      G.rotation.y = -.6 + Math.sin(s.t * .2) * .2; G.rotation.x = .28; } }; },
  // oil pumpjack (nodding donkey): walking beam rocks, crank + counterweights turn
  'gieng-dau'(o) { const G = new THREE.Group(), steel = M(0x2b2b2b, { r: .5, m: .4 }), red = M(C.red, { r: .45 }), yel = M(C.gold, { r: .5 });
    const base = mesh(new THREE.BoxGeometry(2.6, .12, .7), M(0x8a8478, { r: .9 })); base.position.y = -.94; G.add(base);
    [-1, 1].forEach(sz => { const leg = mesh(new THREE.BoxGeometry(.08, 1.25, .08), steel); leg.position.set(.05, -.3, sz * .22); leg.rotation.x = -sz * .16; G.add(leg); });
    const beamP = new THREE.Group(); beamP.position.set(.05, .3, 0); G.add(beamP);
    const beam = mesh(new THREE.BoxGeometry(2.1, .14, .16), yel); beamP.add(beam);
    const horse = mesh(new THREE.CylinderGeometry(.42, .42, .18, 24, 1, false, -Math.PI / 2.2, Math.PI / 1.1).rotateX(Math.PI / 2), red); horse.position.set(-1.05, -.05, 0); beamP.add(horse);
    const rod = mesh(new THREE.CylinderGeometry(.02, .02, 1.4, 8), steel); G.add(rod);
    const crankP = new THREE.Group(); crankP.position.set(.95, -.55, 0); G.add(crankP);
    [-1, 1].forEach(sz => { const cw = mesh(new THREE.BoxGeometry(.5, .32, .08), red); cw.position.set(0, -.28, sz * .2); crankP.add(cw); });
    const gear = mesh(new THREE.CylinderGeometry(.22, .22, .3, 24).rotateX(Math.PI / 2), steel); gear.position.set(1.05, -.62, 0); G.add(gear);
    const pit = mesh(new THREE.BoxGeometry(.05, 1, .05), steel); G.add(pit);
    const well = mesh(new THREE.CylinderGeometry(.09, .12, .25, 16), steel); well.position.set(-1.1, -.8, 0); G.add(well); G.add(floor(1.9, -1));
    return { G, update(s) { const a = s.t * 2.2, ang = Math.sin(a) * .28; crankP.rotation.z = -a; beamP.rotation.z = ang;
      const hx = -1.05 * Math.cos(ang) + .05, hy = .3 - 1.05 * Math.sin(ang) - .05; rod.position.set(-1.1, (hy - .8) / 2 - .05, 0); rod.scale.y = Math.max(.1, (hy + .8) / 1.4);
      const tx = .95 * Math.cos(ang) + .05, ty = .3 + .95 * Math.sin(ang), cx = .95 + Math.sin(-a) * .28, cy = -.55 - Math.cos(-a) * .28 * -1;
      pit.position.set((tx + cx) / 2, (ty + cy) / 2, .2); pit.scale.y = Math.hypot(tx - cx, ty - cy); pit.rotation.z = Math.atan2(tx - cx, ty - cy) * -1;
      G.rotation.y = -.45 + Math.sin(s.t * .25) * .15; G.rotation.x = .12; } }; },
  // oil barrels dropping into a pyramid (rows 4-3-2-1)
  'thung-dau'(o) { const G = new THREE.Group(), bars = [], rows = o.hang ?? 4;
    for (let r = 0; r < rows; r++) for (let i = 0; i < rows - r; i++) { const b = new THREE.Group(), body = mesh(new THREE.CylinderGeometry(.24, .24, .62, 28), M(i % 2 ? 0x1f5f8b : C.red, { r: .4, m: .3 }));
      b.add(body); [-.2, 0, .2].forEach(y => { const ring = mesh(new THREE.TorusGeometry(.245, .015, 6, 28).rotateX(Math.PI / 2), M(0x222222, { m: .5 })); ring.position.y = y; b.add(ring); });
      b.position.set((i - (rows - r - 1) / 2) * .52, -1 + .31 + r * .63, 0); b.userData.y = b.position.y; G.add(b); bars.push(b); }
    G.add(floor(1.6, -1));
    return { G, update(s) { const span = Math.max(1, s.D * .7); bars.forEach((b, i) => { const u = clamp((s.lt - .2 - i / bars.length * span) / .35); b.visible = u > 0; b.position.y = b.userData.y + (1 - eo3(u)) * 2.2; });
      G.rotation.y = -.3 + Math.sin(s.t * .3) * .2; G.rotation.x = .12; } }; },
};

Object.assign(PROPS, JP_PROPS);   // nhat-ban (3D Japan + plates), hut-chim (subduction → tsunami)

export function stage({ W, H }) {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(W, H, false); r.setClearColor(0x000000, 0); r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; r.shadowMap.enabled = true; r.shadowMap.type = THREE.VSMShadowMap;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, W / H, .1, 100); cam.position.set(0, 0, 12); cam.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x40342a, 1.25));
  const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(-5, 7, 7); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -6, right: 6, top: 8, bottom: -8, near: .5, far: 40 }); key.shadow.radius = 7; key.shadow.blurSamples = 16; key.shadow.bias = -.0006; scene.add(key);
  scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), .04).texture; scene.environmentIntensity = .45;
  const rim = new THREE.DirectionalLight(0xff7050, 1.8); rim.position.set(6, 3, -6); scene.add(rim);
  const halfH = 12 * Math.tan(15 * Math.PI / 180), cache = {};
  const S = { renderer: r, scene, cam, gpu: () => { const g = r.getContext(), e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'webgl'; } };
  S.KINDS = Object.keys(PROPS);
  // s = { lt, D, t, ev (event second in scene time) } · p = placement { fx, fy (0–1 screen centre), co (scale) } · o = prop options
  // library models (xp model new): kind "lib:<name>" or o.ten → normalised to ~2 units tall like the built-in props, slow turntable
  const libProp = name => { const I = instance(name, { cao: 2 }), G = new THREE.Group(); I.group.position.y = -1; G.add(I.group, floor(1.5, -1)); return { G, update(s) { I.update(s); I.group.rotation.y = Math.sin(s.t * .4) * .5; } }; };
  S.preload = TL => libPreload(namesIn(TL));
  S.draw = (x, key, kind, s, p, o = {}) => { if (o.ten) kind = 'lib:' + o.ten; const lib = typeof kind === 'string' && kind.startsWith('lib:'); if (!lib && !PROPS[kind]) return;
    const id = key + ':' + kind; if (!cache[id]) { cache[id] = lib ? libProp(kind.slice(4)) : PROPS[kind](o); scene.add(cache[id].G); }
    for (const k in cache) cache[k].G.visible = k === id;
    const P = cache[id], a = W / H, z = (p.co ?? 1) * back(clamp((s.lt - (p.vao ?? .1)) / .55), 1.3);
    P.G.position.set((p.fx - .5) * 2 * halfH * a, (.5 - p.fy) * 2 * halfH, 0); P.G.scale.setScalar(Math.max(.001, z)); P.update(s);
    r.render(scene, cam); x.drawImage(r.domElement, 0, 0, W, H); };
  return S;
}
