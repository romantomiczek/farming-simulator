// Map layout in metres. +z is north, the farmyard sits south of the first fields,
// the village and the buyers lie east along the main road.

/** Area vehicles may drive in (the flat valley floor minus a margin). */
export const BOUNDS = { x0: -100, x1: 255, z0: -90, z1: 140 };
/** Flat valley floor; hills rise outside it. */
export const FLAT = { x0: -108, x1: 262, z0: -98, z1: 148 };

/**
 * Fields. sign = [x, z, rotationY] of the sale sign; start = state in a new game
 * (also used for fields missing from an old save).
 * start.s: 'stub' | 'cult' | 'sown' | 'ripe'; crop = crop index; growth = game hours grown.
 * lanes: direction helpers drive in ('z' by default, 'x' where a building stands at the field end).
 */
export const FIELD_DEFS = [
  { id: 1, x0: -70, z0: -5, w: 50, h: 45, owned: true, price: 0, sign: [-17.5, -3, Math.PI / 2], start: { s: 'ripe', crop: 0 } },
  { id: 2, x0: 0, z0: -5, w: 50, h: 45, owned: true, price: 0, sign: [-2.5, -3, -Math.PI / 2], start: { s: 'stub' } },
  { id: 3, x0: -70, z0: 56, w: 50, h: 44, owned: false, price: 420000, sign: [-17.5, 58, Math.PI / 2], start: { s: 'ripe', crop: 2, dir: 1 } },
  { id: 4, x0: 0, z0: 56, w: 58, h: 42, owned: false, price: 460000, sign: [-2.5, 58, -Math.PI / 2], start: { s: 'sown', crop: 1, growth: 2.4 } },
  { id: 5, x0: 80, z0: -5, w: 50, h: 45, owned: false, price: 480000, sign: [82, 42.4, 0], start: { s: 'ripe', crop: 1, dir: 1 } },
  { id: 6, x0: 80, z0: 56, w: 50, h: 44, owned: false, price: 450000, sign: [82, 53.8, Math.PI], start: { s: 'stub' } },
  { id: 7, x0: 175, z0: -40, w: 60, h: 60, owned: false, price: 820000, sign: [177, 22, 0], start: { s: 'sown', crop: 3, growth: 4 }, lanes: 'x' },
  { id: 8, x0: 195, z0: 80, w: 50, h: 50, owned: false, price: 560000, sign: [197, 77.8, Math.PI], start: { s: 'cult' }, lanes: 'x' },
];

export const ROADS = [
  { x0: -14, x1: -6, z0: -50, z1: 106 }, // farm road north
  { x0: -74, x1: 250, z0: 44, z1: 52 }, // main road east to the village
  { x0: 164, x1: 172, z0: -44, z1: 132 }, // village street
];
export const PAD = { x0: -46, x1: 26, z0: -52, z1: -12 };
export const POND = { x: 64, z: -42, r: 13 };
/** Village houses: [x, z, width, depth, wall, roof, rotationY]. */
export const HOUSES = [
  [155, 63, 9, 7, '#efe6d6', '#9a4f3e', Math.PI / 2], [155, 78, 8, 7, '#e9d7b5', '#6b5a52', Math.PI / 2],
  [155, 93, 10, 7, '#f1e2cf', '#a35a44', Math.PI / 2], [155, 108, 8, 6, '#dde3d6', '#7b5a4e', Math.PI / 2],
  [155, 122, 9, 7, '#efe6d6', '#5d6268', Math.PI / 2], [181, 82, 9, 7, '#f0dcc4', '#9a4f3e', -Math.PI / 2],
  [181, 97, 8, 7, '#e6e6dc', '#a35a44', -Math.PI / 2], [181, 112, 10, 7, '#efe1c9', '#6b5a52', -Math.PI / 2],
  [181, 126, 8, 6, '#e9d7b5', '#9a4f3e', -Math.PI / 2],
];
export const CHURCH = { x: 184, z: 64 };
/** Rectangles kept free of trees (village, buyers). */
export const NO_TREES = [
  { x0: 143, x1: 192, z0: 52, z1: 136 }, { x0: 128, x1: 150, z0: 52, z1: 78 },
  { x0: 192, x1: 220, z0: 22, z1: 46 }, { x0: 226, x1: 256, z0: 50, z1: 80 },
];

/** Diesel pump next to the end of the road: refuel here with F. */
export const fuelZone = { x: -4.5, z: -38, r: 4.5 };
/** In front of the barn door: sell straw bales from the trailer here with F. */
export const baleZone = { x: -19, z: -36, r: 6 };
/** Machine shed: swap tractor implements and combine headers here (F or keys 1–6). */
export const shedZone = { x0: 4, x1: 20, z0: -46, z1: -31 };

// Static collision shapes, filled while the world is built.
export const circles = [];
export const boxes = [];
export const addBox = (x0, x1, z0, z1) => boxes.push({ x0, x1, z0, z1 });
