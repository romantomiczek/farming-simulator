import * as THREE from 'three';
import { col, hexRgb } from '../core/util.js';

// Field cell states (one cell = 1 m²).
export const S_STUB = 0, S_CULT = 1, S_SOWN = 2, S_RIPE = 3;
/** Cells outside a shaped field's outline (grass, never worked). */
export const S_NONE = 255;
export const STATE_NAMES = ['strniště', 'zkultivováno', 'roste', 'zralé'];

// Per-cell bonus bits, reset at harvest (game/agro.js works out the yield from them):
// fertilised, ploughed, fertilised a second time, rolled, stubble mulched, stones turned up by the
// plough, a different crop than last time (rotation), the same crop again (monoculture).
export const B_FERT = 1, B_PLOW = 2, B_FERT2 = 4, B_ROLL = 8, B_MULCH = 16, B_STONE = 32, B_ROT = 64, B_MONO = 128;
export const FERT_BONUS = 0.25, PLOW_BONUS = 0.15, FERT2_BONUS = 0.1, ROLL_BONUS = 0.05, MULCH_BONUS = 0.05, ROT_BONUS = 0.08, MONO_LOSS = 0.05;
export const FERT_COST = 2, HERB_COST = 1, LIME_COST = 1.5; // Kč/m² of fertiliser, herbicide, lime

// hours = game hours from sowing to ripe; seed = Kč/m²; yield = l/m²; price = base Kč/l.
// header = harvesting gear needed ('grain'/'corn' = combine headers, 'beet' = beet harvester);
// straw = leaves a straw windrow when harvested; heap = colour of the harvested crop in a tank.
// colors/h/fw are per visual stage 0..5 (0 = just sown, 4 = ripe, 5 = overripe, withered); fw = row width share;
// tile = picture in the crop atlas (render/textures.js); sowIn = seasons it may be sown in (0 spring, 1 summer, 2 autumn).
// New crops are appended, so crop indexes in old saves stay valid.
export const CROPS = [
  { name: 'Pšenice', gen: 'pšenice', hours: 6, seed: 6, yield: 8, price: 7.2, header: 'grain', straw: true, tile: 'cereal', sowIn: [1, 2],
    colors: ['#000000', '#8fbf5a', '#a7c35a', '#cbbd5a', '#e4bc52', '#a8936a'], h: [0, 0.16, 0.48, 0.82, 0.95, 0.85], fw: [0, 0.3, 0.7, 0.95, 1, 0.9] },
  { name: 'Ječmen', gen: 'ječmene', hours: 5, seed: 5, yield: 8.5, price: 6.4, header: 'grain', straw: true, tile: 'cereal', sowIn: [0, 1, 2],
    colors: ['#000000', '#94c460', '#b4c868', '#d4cd8c', '#e8d49c', '#aa9a78'], h: [0, 0.14, 0.42, 0.72, 0.8, 0.7], fw: [0, 0.3, 0.7, 0.95, 1, 0.9] },
  { name: 'Řepka', gen: 'řepky', hours: 8, seed: 9, yield: 4.6, price: 14.5, header: 'grain', straw: false, tile: 'rape', sowIn: [1, 2],
    colors: ['#000000', '#7fb35a', '#6aa452', '#f0cd2e', '#8e8a4c', '#6e664a'], h: [0, 0.2, 0.55, 1.05, 1.0, 0.9], fw: [0, 0.4, 0.8, 1, 1, 0.9] },
  { name: 'Kukuřice', gen: 'kukuřice', hours: 9, seed: 8, yield: 9.5, price: 6.0, header: 'corn', straw: false, tile: 'corn', sowIn: [0, 1],
    colors: ['#000000', '#86bf58', '#5f9e45', '#4f8a3d', '#cdb67a', '#9a8a62'], h: [0, 0.3, 1.0, 2.0, 2.1, 1.9], fw: [0, 0.3, 0.55, 0.72, 0.75, 0.7] },
  { name: 'Slunečnice', gen: 'slunečnice', hours: 8, seed: 7, yield: 3.6, price: 16.0, header: 'corn', straw: false, tile: 'sunflower', sowIn: [0, 1],
    colors: ['#000000', '#8cc25c', '#6fae4c', '#f2c230', '#6e5a3a', '#4e4232'], h: [0, 0.25, 0.8, 1.55, 1.5, 1.35], fw: [0, 0.35, 0.6, 0.8, 0.8, 0.75] },
  { name: 'Cukrovka', gen: 'cukrovky', hours: 10, seed: 9, yield: 18, price: 3.6, header: 'beet', straw: false, heap: '#d9c9a4', tile: 'beet', sowIn: [0],
    colors: ['#000000', '#8cc25c', '#62a64a', '#4f9640', '#7a9c48', '#8a8a52'], h: [0, 0.12, 0.32, 0.48, 0.45, 0.35], fw: [0, 0.35, 0.7, 0.9, 0.9, 0.8] },
];
CROPS.forEach(c => { c.cols = c.colors.map(col); c.rgb = c.colors.map(hexRgb); c.heapCol = col(c.heap || c.colors[4]); });

export const HEADERS = {
  grain: { name: 'Žací lišta', short: 'žací lištu' },
  corn: { name: 'Řádkový adaptér', short: 'řádkový adaptér' },
  beet: { name: 'Vyorávací ústrojí', short: 'vyorávací ústrojí' },
  chop: { name: 'Sběrač a kukuřičný adaptér', short: 'řezačku' },
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
/** Kč per round bale of hay (worth more than straw, swings on its own). */
export function hayPrice(t) {
  const d = t / 1440;
  return 2200 * (1 + 0.12 * Math.sin((d * 2 * Math.PI) / 3.6 + 4.0));
}

/**
 * Meadow grass (not a crop you sow, so not in CROPS): grows 0..4 like a crop over `hours`
 * game hours after mowing, is mowed with the mower into a hay swath, which the baler presses.
 */
export const GRASS = {
  name: 'Tráva', hours: 10,
  colors: ['#66903e', '#6c9637', '#629036', '#578534', '#4b7a2e'], h: [0.04, 0.1, 0.22, 0.36, 0.5], fw: [1, 1, 1, 1, 1],
  ground: ['#638b38', '#6a923d', '#5f8734', '#6e963f'], line: ['#557a2f', '#5c8230', '#51772c', '#608636'],
};
GRASS.cols = GRASS.colors.map(col); GRASS.rgb = GRASS.colors.map(hexRgb);
/** Hay swath left by the mower. */
export const HAY = { base: '#c2b866', line: '#a09748', rgb: hexRgb('#c2b866') };
/**
 * What lies on a mown meadow cell (its straw value): 1 fresh grass in a windrow, 2 tedded and still
 * wet (spread out), 3 dry hay in a windrow, 4 tedded and dry. A windrow dries into hay in
 * HAY_DRY.dryH game hours, tedded grass in HAY_DRY.teddedH; balers, the forage wagon and the
 * chopper pick up windrows only (the windrower turns spread grass back into one).
 */
export const SW_FRESH = 1, SW_TEDDED = 2, SW_HAY = 3, SW_TEDDED_DRY = 4;
const sw = (base, line) => ({ base, line, rgb: hexRgb(base) });
export const SWATH = [null, sw('#7f9f3e', '#62822c'), sw('#9bb455', '#86a046'), HAY, sw('#d0c676', '#b8ad5e')];
export const isWindrow = s => s === SW_FRESH || s === SW_HAY;
