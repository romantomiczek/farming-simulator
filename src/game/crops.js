import * as THREE from 'three';
import { col, hexRgb } from '../core/util.js';

// Field cell states (one cell = 1 m²).
export const S_STUB = 0, S_CULT = 1, S_SOWN = 2, S_RIPE = 3;
export const STATE_NAMES = ['strniště', 'zkultivováno', 'roste', 'zralé'];

// Per-cell bonus bits, reset at harvest.
export const B_FERT = 1, B_PLOW = 2;
export const FERT_BONUS = 0.25, PLOW_BONUS = 0.15;
export const FERT_COST = 2; // Kč/m²

/** Yield multiplier from the cell's bonus bits. */
export const yieldMult = bits => 1 + (bits & B_FERT ? FERT_BONUS : 0) + (bits & B_PLOW ? PLOW_BONUS : 0);

// hours = game hours from sowing to ripe; seed = Kč/m²; yield = l/m²; price = base Kč/l.
// header = harvesting gear needed ('grain'/'corn' = combine headers, 'beet' = beet harvester);
// straw = leaves a straw windrow when harvested; heap = colour of the harvested crop in a tank.
// colors/h/fw are per visual stage 0..4 (0 = just sown, 4 = ripe); fw = row width share.
// New crops are appended, so crop indexes in old saves stay valid.
export const CROPS = [
  { name: 'Pšenice', gen: 'pšenice', hours: 6, seed: 6, yield: 8, price: 7.2, header: 'grain', straw: true,
    colors: ['#000000', '#8fbf5a', '#a7c35a', '#cbbd5a', '#e4bc52'], h: [0, 0.16, 0.48, 0.82, 0.95], fw: [0, 0.3, 0.7, 0.95, 1] },
  { name: 'Ječmen', gen: 'ječmene', hours: 5, seed: 5, yield: 8.5, price: 6.4, header: 'grain', straw: true,
    colors: ['#000000', '#94c460', '#b4c868', '#d4cd8c', '#e8d49c'], h: [0, 0.14, 0.42, 0.72, 0.8], fw: [0, 0.3, 0.7, 0.95, 1] },
  { name: 'Řepka', gen: 'řepky', hours: 8, seed: 9, yield: 4.6, price: 14.5, header: 'grain', straw: false,
    colors: ['#000000', '#7fb35a', '#6aa452', '#f0cd2e', '#8e8a4c'], h: [0, 0.2, 0.55, 1.05, 1.0], fw: [0, 0.4, 0.8, 1, 1] },
  { name: 'Kukuřice', gen: 'kukuřice', hours: 9, seed: 8, yield: 9.5, price: 6.0, header: 'corn', straw: false,
    colors: ['#000000', '#86bf58', '#5f9e45', '#4f8a3d', '#cdb67a'], h: [0, 0.3, 1.0, 2.0, 2.1], fw: [0, 0.3, 0.55, 0.72, 0.75] },
  { name: 'Slunečnice', gen: 'slunečnice', hours: 8, seed: 7, yield: 3.6, price: 16.0, header: 'corn', straw: false,
    colors: ['#000000', '#8cc25c', '#6fae4c', '#f2c230', '#6e5a3a'], h: [0, 0.25, 0.8, 1.55, 1.5], fw: [0, 0.35, 0.6, 0.8, 0.8] },
  { name: 'Cukrovka', gen: 'cukrovky', hours: 10, seed: 9, yield: 18, price: 3.6, header: 'beet', straw: false, heap: '#d9c9a4',
    colors: ['#000000', '#8cc25c', '#62a64a', '#4f9640', '#7a9c48'], h: [0, 0.12, 0.32, 0.48, 0.45], fw: [0, 0.35, 0.7, 0.9, 0.9] },
];
CROPS.forEach(c => { c.cols = c.colors.map(col); c.rgb = c.colors.map(hexRgb); c.heapCol = col(c.heap || c.colors[4]); });

export const HEADERS = {
  grain: { name: 'Žací lišta', short: 'žací lištu' },
  corn: { name: 'Řádkový adaptér', short: 'řádkový adaptér' },
  beet: { name: 'Vyorávací ústrojí', short: 'vyorávací ústrojí' },
};

function shades(hex, n, amt) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const c = new THREE.Color(hex);
    c.multiplyScalar(1 - amt + (2 * amt * k) / (n - 1));
    out.push('#' + c.getHexString());
  }
  return out;
}
/** Soil colours for the field textures: base fill and the darker row line. */
export const SOIL = {
  [S_STUB]: { base: shades('#d9c48e', 4, 0.05), line: shades('#c2a872', 4, 0.05), rgb: hexRgb('#d9c48e') },
  [S_CULT]: { base: shades('#83593f', 4, 0.06), line: shades('#684430', 4, 0.06), rgb: hexRgb('#83593f') },
  [S_SOWN]: { base: shades('#6d4833', 4, 0.06), line: shades('#563826', 4, 0.06), rgb: hexRgb('#6d4833') },
};
SOIL[S_RIPE] = SOIL[S_SOWN];
/** Ploughed, not yet sown: darker with deep double furrows. */
export const SOIL_PLOW = { base: shades('#6c4630', 4, 0.06), line: shades('#4c3021', 4, 0.06), rgb: hexRgb('#6c4630') };
export const STRAW = { base: '#e3b64a', line: '#b88d2e', rgb: hexRgb('#e3b64a') };

/** Straw bale price in Kč per bale. */
export function balePrice(t) {
  const d = t / 1440;
  return 1500 * (1 + 0.1 * Math.sin((d * 2 * Math.PI) / 4.1 + 1.3));
}
