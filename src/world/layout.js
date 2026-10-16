// Map layout in metres. +z is north, +x is east. The farmyard sits in the home valley in the
// middle of the map; the village and the first buyers lie east along the main road.
// Around it: forest in the west, rolling hills with big fields in the north, fish ponds in the
// south, the river with its meadows in the east and the town with the railway beyond it.

import MAP_EDITS from './map.json';

/**
 * Map editor (F9 → Editor mapy) saves fields, roads, ponds and forest plots to map.json.
 * Each saved section replaces the defaults below in place, so every importer sees the edited map.
 * MAP_DEFAULTS keeps the original values for the editor and for code that treats untouched home fields specially.
 */
export const MAP_DEFAULTS = {};
const num = v => typeof v === 'number' && Number.isFinite(v);
const CHECK = {
  fields: f => num(f.id) && num(f.x0) && num(f.z0) && num(f.w) && num(f.h) && f.w >= 4 && f.h >= 4,
  roads: r => num(r.w) && Array.isArray(r.pts) && r.pts.length >= 2 && r.pts.every(p => num(p[0]) && num(p[1])),
  ponds: p => num(p.x) && num(p.z) && num(p.rx) && num(p.rz),
  forestPlots: p => num(p.x0) && num(p.x1) && num(p.z0) && num(p.z1) && p.x1 > p.x0 && p.z1 > p.z0,
  river: p => Array.isArray(p) && num(p[0]) && num(p[1]),
};
function useEdits(key, arr) {
  MAP_DEFAULTS[key] = structuredClone(arr);
  const list = MAP_EDITS?.[key];
  if (Array.isArray(list) && list.length >= (key === 'river' ? 2 : 0) && list.every(CHECK[key])) arr.splice(0, arr.length, ...structuredClone(list));
  return arr;
}

/**
 * Buildings the map editor moves as a whole (buyers with their buildings, the sawmill, the animal
 * pens, the feed mixer and the dairy): map.json keeps only a shift [dx, dz] from the default place,
 * and every builder places its building, ring and collisions relative to the shifted anchor.
 */
MAP_DEFAULTS.places = {};
const SHIFTS = MAP_EDITS?.places && typeof MAP_EDITS.places === 'object' ? MAP_EDITS.places : {};
export const shiftOf = id => { const s = SHIFTS[id]; return Array.isArray(s) && num(s[0]) && num(s[1]) ? s : [0, 0]; };
const at = (id, x, z, more) => { const [dx, dz] = shiftOf(id); return { x: x + dx, z: z + dz, ...more }; };
const pen = (id, x0, x1, z0, z1, feed) => {
  const [dx, dz] = shiftOf(id);
  return { x0: x0 + dx, x1: x1 + dx, z0: z0 + dz, z1: z1 + dz, feed: { x: feed.x + dx, z: feed.z + dz, r: feed.r } };
};

/** Area vehicles may drive in. */
export const BOUNDS = { x0: -430, x1: 770, z0: -430, z1: 570 };
/** The original flat valley floor around the farm (height 0). */
export const HOME = { x0: -108, x1: 262, z0: -98, z1: 148 };

/**
 * Fields. sign = [x, z, rotationY] of the sale sign (fields 1–8 keep their old places; newer
 * fields get one placed automatically by the road); start = state in a new game (also used for
 * fields missing from an old save).
 * start.s: 'stub' | 'cult' | 'sown' | 'ripe'; crop = crop index; growth = game hours grown.
 * lanes: direction helpers drive in ('z' by default, 'x' where a building stands at the field end).
 * q = soil quality (yield multiplier); poly = outline when the field is not a rectangle
 * (cells outside it are grass); price is per field, computed from area and quality when missing.
 * meadow = grassland for hay instead of a field for crops.
 */
export const FIELD_DEFS = useEdits('fields', [
  { id: 1, x0: -70, z0: -5, w: 50, h: 45, owned: true, price: 0, sign: [-17.5, -3, Math.PI / 2], start: { s: 'ripe', crop: 0 } },
  { id: 2, x0: 0, z0: -5, w: 50, h: 45, owned: true, price: 0, sign: [-2.5, -3, -Math.PI / 2], start: { s: 'stub' } },
  { id: 3, x0: -70, z0: 56, w: 50, h: 44, owned: false, price: 420000, sign: [-17.5, 58, Math.PI / 2], start: { s: 'ripe', crop: 2, dir: 1 } },
  { id: 4, x0: 0, z0: 56, w: 58, h: 42, owned: false, price: 460000, sign: [-2.5, 58, -Math.PI / 2], start: { s: 'sown', crop: 1, growth: 2.4 } },
  { id: 5, x0: 80, z0: -5, w: 50, h: 45, owned: false, price: 480000, sign: [77.5, 42.4, 0], start: { s: 'ripe', crop: 1, dir: 1 } },
  { id: 6, x0: 80, z0: 56, w: 50, h: 44, owned: false, price: 450000, sign: [77.5, 53.8, Math.PI], start: { s: 'stub' } },
  { id: 7, x0: 175, z0: -40, w: 60, h: 60, owned: false, price: 820000, sign: [177, 22, 0], start: { s: 'sown', crop: 3, growth: 4 }, lanes: 'x' },
  { id: 8, x0: 195, z0: 80, w: 50, h: 50, owned: false, price: 560000, sign: [197, 77.8, Math.PI], start: { s: 'cult' }, lanes: 'x' },
  // north: rolling hills
  { id: 9, x0: -120, z0: 170, w: 80, h: 90, q: 0.95, start: { s: 'ripe', crop: 1 } },
  { id: 10, x0: 20, z0: 160, w: 120, h: 90, q: 1.05, start: { s: 'sown', crop: 0, growth: 3 } },
  { id: 11, x0: 190, z0: 160, w: 85, h: 110, q: 1.0, start: { s: 'stub' } },
  { id: 12, x0: -100, z0: 320, w: 140, h: 120, q: 0.9, start: { s: 'ripe', crop: 2 }, poly: [[-100, 320], [40, 320], [40, 395], [-5, 440], [-100, 440]] },
  { id: 13, x0: 190, z0: 330, w: 110, h: 130, q: 1.0, start: { s: 'cult' } },
  { id: 14, x0: 380, z0: 200, w: 160, h: 85, q: 1.1, start: { s: 'ripe', crop: 3 } },
  { id: 15, x0: 390, z0: 330, w: 150, h: 150, q: 1.0, start: { s: 'sown', crop: 4, growth: 2 }, poly: [[430, 330], [540, 330], [540, 480], [390, 480], [390, 370]] },
  { id: 16, x0: 570, z0: 350, w: 120, h: 170, q: 0.9, start: { s: 'stub' } },
  { id: 17, x0: 600, z0: 185, w: 90, h: 100, q: 1.05, start: { s: 'ripe', crop: 0 } },
  { id: 23, x0: 50, z0: 330, w: 100, h: 140, q: 0.95, start: { s: 'sown', crop: 1, growth: 1 } },
  // east lowland south of the town
  { id: 18, x0: 420, z0: -160, w: 90, h: 110, q: 1.15, start: { s: 'sown', crop: 5, growth: 4 } },
  { id: 19, x0: 580, z0: -180, w: 115, h: 120, q: 1.1, start: { s: 'stub' }, poly: [[580, -180], [695, -180], [695, -60], [640, -60], [580, -110]] },
  // south, towards the ponds
  { id: 20, x0: -100, z0: -190, w: 70, h: 60, q: 0.95, start: { s: 'cult' } },
  { id: 21, x0: 30, z0: -175, w: 150, h: 55, q: 1.0, start: { s: 'ripe', crop: 0, dir: 1 }, lanes: 'x' },
  { id: 22, x0: 200, z0: -200, w: 80, h: 85, q: 1.05, start: { s: 'sown', crop: 3, growth: 2 } },
  // meadows (hay): mowed with the mower, the grass grows back by itself
  { id: 24, x0: 228, z0: -335, w: 67, h: 75, meadow: true, q: 0.7, start: { s: 'ripe' } },
  { id: 25, x0: 358, z0: -235, w: 54, h: 180, meadow: true, q: 0.8, start: { s: 'ripe' } },
  { id: 26, x0: 134, z0: -288, w: 86, h: 40, meadow: true, q: 0.7, start: { s: 'ripe' } },
]);

/**
 * Roads as centre lines with a width. kind: 'road' (gravel road) or 'dirt' (field and forest tracks).
 * Fields, buildings and trees keep clear of them; they are draped over the terrain.
 */
export const ROADS = useEdits('roads', [
  { id: 'main', w: 8, kind: 'road', pts: [[-74, 48], [262, 48], [338, 48], [420, 48], [640, 48], [700, 48]] },
  { id: 'farmN', w: 8, kind: 'road', pts: [[-10, -50], [-10, 124]] },
  { id: 'forestTrack', w: 4, kind: 'dirt', pts: [[-6, 106], [140, 106]] },
  { id: 'village', w: 8, kind: 'road', pts: [[168, -44], [168, 132]] },
  { id: 'farmN2', w: 6, kind: 'dirt', pts: [[-10, 124], [-10, 150], [-14, 200], [-16, 300]] },
  { id: 'villageN', w: 6, kind: 'dirt', pts: [[168, 132], [172, 160], [175, 230], [170, 300], [162, 420], [150, 520]] },
  { id: 'north', w: 6, kind: 'dirt', pts: [[-140, 305], [-16, 300], [170, 300], [338, 300], [450, 300], [620, 310], [750, 330]] },
  { id: 'west', w: 5, kind: 'dirt', pts: [[-74, 48], [-110, 48], [-160, 55], [-230, 35], [-300, 60], [-390, 45]] },
  { id: 'south', w: 6, kind: 'dirt', pts: [[-10, -52], [-10, -110], [5, -200], [0, -300], [-30, -400]] },
  { id: 'forestLoop', w: 5, kind: 'dirt', pts: [[5, -200], [-130, -215], [-210, -170], [-245, -60], [-230, 35]] },
  { id: 'ford', w: 5, kind: 'dirt', pts: [[5, -200], [150, -235], [300, -250], [336, -250], [380, -255], [470, -275], [560, -275]] },
  { id: 'townS', w: 6, kind: 'road', pts: [[520, 48], [520, -100], [560, -200], [560, -275]] },
  { id: 'townN', w: 6, kind: 'road', pts: [[480, 48], [480, 160]] },
  { id: 'townE', w: 6, kind: 'road', pts: [[600, 48], [600, 140]] },
]);

/** The river: centre line from north to south. Water is 14 m wide in a 16 m channel. */
export const RIVER = useEdits('river', [[300, 575], [320, 480], [350, 400], [338, 300], [310, 220], [320, 150], [340, 60], [330, -20], [305, -110], [320, -200], [336, -250], [350, -330], [345, -390], [330, -440]]);
export const RIVER_HALF = 8;
/** The ford: shallow water where the 'ford' track crosses the river (no bridge). */
export const FORD = { x: 336, z: -250, r: 12 };
MAP_DEFAULTS.ford = { ...FORD };
if (MAP_EDITS?.ford && num(MAP_EDITS.ford.x) && num(MAP_EDITS.ford.z)) Object.assign(FORD, { x: MAP_EDITS.ford.x, z: MAP_EDITS.ford.z });

/**
 * Bridges, found automatically wherever a road crosses the river away from the ford. The deck lies
 * along the road (ang = direction in the x–z plane); a slanting crossing gets a longer bridge.
 */
export function findBridges(roads, river, ford) {
  const out = [];
  for (const r of roads) {
    for (let k = 1; k < r.pts.length; k++) {
      const [ax, az] = r.pts[k - 1], [bx, bz] = r.pts[k], rx = bx - ax, rz = bz - az;
      for (let j = 1; j < river.length; j++) {
        const [cx, cz] = river[j - 1], [dx, dz] = river[j], sx = dx - cx, sz = dz - cz;
        const den = rx * sz - rz * sx;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((cx - ax) * sz - (cz - az) * sx) / den, u = ((cx - ax) * rz - (cz - az) * rx) / den;
        if (t < 0 || t > 1 || u < 0 || u > 1) continue;
        const x = ax + rx * t, z = az + rz * t;
        if (Math.hypot(x - ford.x, z - ford.z) < ford.r + 4) continue;
        if (out.some(b => Math.hypot(b.x - x, b.z - z) < 8)) continue;
        const sin = Math.abs(den) / (Math.hypot(rx, rz) * Math.hypot(sx, sz)); // 1 = square to the river
        out.push({ x, z, ang: Math.atan2(rz, rx), len: Math.round(Math.min(44, (2 * RIVER_HALF) / Math.max(0.4, sin) + 10)), w: r.w + 1, road: r.id });
      }
    }
  }
  return out;
}
/** Is (x, z) on bridge b's deck (pad = extra margin)? */
export function onBridge(b, x, z, pad = 0) {
  const ux = Math.cos(b.ang), uz = Math.sin(b.ang), dx = x - b.x, dz = z - b.z;
  return Math.abs(dx * ux + dz * uz) < b.len / 2 + pad && Math.abs(-dx * uz + dz * ux) < b.w / 2 + pad;
}
/** Fish ponds in the south: ellipses (rx, rz) with a dam on the downstream side. */
export const PONDS = useEdits('ponds', [
  { x: 72, z: -290, rx: 50, rz: 30 },
  { x: -90, z: -320, rx: 40, rz: 28 },
  { x: 170, z: -330, rx: 45, rz: 30 },
]);
export const BRIDGES = findBridges(ROADS, RIVER, FORD);
/** The gravel pit south of the town. */
export const PIT = { x0: 500, x1: 640, z0: -400, z1: -285, depth: 7 };
/** Town east of the river (flat ground), the railway and the station. */
export const TOWN = { x0: 395, x1: 650, z0: -40, z1: 175 };
export const RAIL = { x: 705, z0: -440, z1: 580 };
export const STATION = { x: 680, z: 90 };
/** Chapel on the northern hill and the wind turbines along the ridge. */
export const CHAPEL = { x: 140, z: 540 };
export const TURBINES = [[-120, 545], [20, 556], [270, 552], [430, 556], [580, 560], [-380, 300], [-390, -250], [760, -380]];

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
/** Meadows along the river and by the ponds (hay). */
export const MEADOW_AREAS = FIELD_DEFS.filter(f => f.meadow).map(f => ({ x0: f.x0 - 4, x1: f.x0 + f.w + 4, z0: f.z0 - 4, z1: f.z0 + f.h + 4 }));
/** Animal pens south-west of the farm. feed = ring where you unload fodder with F. */
export const COW_PEN = pen('cows', -96, -74, -50, -26, { x: -70, z: -21, r: 5 });
export const HEN_RUN = pen('hens', -66, -52, -50, -38, { x: -59, z: -33, r: 4.2 });
/** Sheep and pigs further south; the feed mixer wagon between the cow pen and the sheep. */
export const SHEEP_PEN = pen('sheep', -98, -72, -90, -64, { x: -66, z: -68, r: 4.5 });
export const PIG_PEN = pen('pigs', -56, -32, -88, -66, { x: -25, z: -70, r: 4.5 });
export const MIXER_AT = at('mixer', -84, -57);
/** Where the tank takes on milk at the cow shed, and the dairy in the town that buys it. */
export const MILK_LOAD = { x: COW_PEN.x0 + 8, z: COW_PEN.z1 + 5, r: 4.5 };
export const DAIRY = at('dairy', 500, 28, { r: 7.5 });
/** Grain buyers' rings (their buildings stand relative to them, see markets.js and buildings.js). */
export const BUYER_AT = {
  mill: at('mill', 138, 58), oil: at('oil', 205, 40), sugar: at('sugar', 240, 58), feed: at('feed', 548, 28),
};
export const SAWMILL = at('saw', -20, 116, { r: 7 });
/** Who buys wood: the sawmill at the farm road and the timber yard in the town (pays more, further away). */
export const WOOD_BUYERS = [
  { id: 'saw', name: 'Pila', short: 'Pila', x: SAWMILL.x, z: SAWMILL.z, r: SAWMILL.r, mult: 1, phase: 0.9 },
  { id: 'timber', name: 'Dřevosklad', short: 'Dřevosklad', ...at('timber', 440, 26), r: 7.5, mult: 1.15, phase: 2.6 },
];

/**
 * Everything the editor can move: id, name, the anchor it is placed by and its footprint around
 * the anchor (dx0, dx1, dz0, dz1), which keeps trees away and levels the ground when moved off the flat.
 */
const anchorOf = { mill: BUYER_AT.mill, oil: BUYER_AT.oil, sugar: BUYER_AT.sugar, feed: BUYER_AT.feed, timber: WOOD_BUYERS[1], dairy: DAIRY, saw: SAWMILL, mixer: MIXER_AT };
const penFoot = (p, ax, az) => [Math.min(p.x0, p.feed.x - p.feed.r) - ax, Math.max(p.x1, p.feed.x + p.feed.r) - ax, Math.min(p.z0, p.feed.z - p.feed.r) - az, Math.max(p.z1, p.feed.z + p.feed.r) - az];
export const PLACES = [
  { id: 'mill', name: 'Mlýn', foot: [-9, 13, -8, 21] },
  { id: 'oil', name: 'Olejna', foot: [-11, 11, -20, 8] },
  { id: 'sugar', name: 'Cukrovar', foot: [-17, 11, -8, 21] },
  { id: 'feed', name: 'Krmivárna', foot: [-10, 15, -27, 8] },
  { id: 'timber', name: 'Dřevosklad', foot: [-18, 16, -20, 8] },
  { id: 'dairy', name: 'Mlékárna', foot: [-13, 15, -24, 8] },
  { id: 'saw', name: 'Pila', foot: [-25, 8, -9, 14] },
  { id: 'cows', name: 'Kravín', pen: COW_PEN, extra: MILK_LOAD },
  { id: 'hens', name: 'Kurník', pen: HEN_RUN },
  { id: 'sheep', name: 'Ovčín', pen: SHEEP_PEN },
  { id: 'pigs', name: 'Vepřín', pen: PIG_PEN },
  { id: 'mixer', name: 'Míchací vůz', foot: [-3, 5, -2, 2] },
].map(p => {
  const a = p.pen ? { x: p.pen.x0, z: p.pen.z0 } : anchorOf[p.id];
  let foot = p.foot || penFoot(p.pen, a.x, a.z);
  if (p.extra) foot = [Math.min(foot[0], p.extra.x - p.extra.r - a.x), Math.max(foot[1], p.extra.x + p.extra.r - a.x), Math.min(foot[2], p.extra.z - p.extra.r - a.z), Math.max(foot[3], p.extra.z + p.extra.r - a.z)];
  const [dx, dz] = shiftOf(p.id);
  return { id: p.id, name: p.name, x: a.x, z: a.z, shift: [dx, dz], foot, rect: { x0: a.x + foot[0], x1: a.x + foot[1], z0: a.z + foot[2], z1: a.z + foot[3] } };
});

/** Rectangles kept free of trees (village, buildings, town, meadows). */
export const NO_TREES = [
  { x0: 143, x1: 192, z0: 52, z1: 136 }, // village
  { x0: 0, x1: 350, z0: -100, z1: -56 }, // machine park, room for its parking places up to field 25
  { x0: 27, x1: 49, z0: -50, z1: -20 }, // greenhouses
  ...PLACES.map(p => ({ x0: p.rect.x0 - 5, x1: p.rect.x1 + 5, z0: p.rect.z0 - 5, z1: p.rect.z1 + 5 })),
  { x0: 6, x1: 142, z0: 106, z1: 140 },
  { x0: 395, x1: 720, z0: -40, z1: 175 }, // town and station
  { x0: 495, x1: 645, z0: -405, z1: -280 }, // gravel pit
  ...MEADOW_AREAS,
  { x0: 120, x1: 160, z0: 525, z1: 555 }, // chapel
];

/** Two greenhouses between the farmyard and the pond; water = ring for the water tank. */
export const GREENHOUSES = [{ key: 'greenhouse1', x: 33, z: -40 }, { key: 'greenhouse2', x: 42, z: -40 }];
export const GREENHOUSE_WATER = { x: 37.5, z: -27, r: 4.5 };
/** Fill the water tank anywhere this close to the pond centre. */
export const POND_FILL = { x: 64, z: -42, r: 18 };
/** Forest plots for the harvester: the old plantation north of the fields and two in the western forest. */
export const FOREST = { x0: 12, x1: 138, z0: 110, z1: 137 };
export const FOREST_PLOTS = useEdits('forestPlots', [FOREST, { x0: -262, x1: -200, z0: 78, z1: 132 }, { x0: -335, x1: -272, z0: -62, z1: -8 }]);
/** Diesel pump next to the end of the road: refuel here with F. */
export const fuelZone = { x: -4.5, z: -38, r: 4.5 };
/** In front of the barn door: sell straw bales from the trailer here with F. */
export const baleZone = { x: -19, z: -36, r: 6 };
/** Machine shed: swap tractor implements and combine headers here (F or keys 1–6). */
export const shedZone = { x0: 4, x1: 20, z0: -46, z1: -31 };
/**
 * Machine park south of the yard, east of the south road: one row of places for machines (vz) and
 * two rows for implements (tz), growing east as the fleet grows. The first piece of each kind keeps
 * its place by the shed; further pieces park here.
 */
export const PARK = { x0: 2, z0: -98, z1: -58, vz: -68, tz: [-84, -93.5], vStep: 14, tStep: 8, minX: 46 };

/* ---------- geometry helpers ---------- */

/** Distance from (x, z) to segment a–b. */
export function segDist(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
  const t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)) : 0;
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}
/** Distance from (x, z) to a polyline [[x, z], ...]. */
export function polyDist(x, z, pts) {
  let d = Infinity;
  for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(x, z, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]));
  return d;
}
/** The road under (x, z) widened by pad metres, or null. */
export function roadAt(x, z, pad = 0) {
  for (const r of ROADS) if (polyDist(x, z, r.pts) < r.w / 2 + pad) return r;
  return null;
}
/** Is (x, z) inside polygon pts? */
export function inPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
export const inRect = (x, z, r, m = 0) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;
export const inPond = (x, z, p, m = 0) => ((x - p.x) / (p.rx + m)) ** 2 + ((z - p.z) / (p.rz + m)) ** 2 < 1;
export const riverDist = (x, z) => polyDist(x, z, RIVER);

/* ---------- static collision shapes, filled while the world is built ---------- */
export const circles = [];
export const boxes = [];
export const addBox = (x0, x1, z0, z1) => boxes.push({ x0, x1, z0, z1 });
/** Moving obstacles (cars, the train) as circles { x, z, r }, updated by the traffic every frame. */
export const movers = [];

/**
 * Spatial index over circles and boxes (cells of CELL metres), rebuilt whenever shapes were added.
 * Vehicles, helpers and animals ask it for the shapes near them instead of testing thousands of trees.
 */
const CELL = 16;
const grid = new Map();
let indexed = -1;
const key = (cx, cz) => cx * 100003 + cz;
function rebuild() {
  grid.clear();
  const put = (o, x0, x1, z0, z1) => {
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
      for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) {
        const k = key(cx, cz);
        let cell = grid.get(k);
        if (!cell) grid.set(k, (cell = { c: [], b: [] }));
        (o.r != null ? cell.c : cell.b).push(o);
      }
    }
  };
  for (const c of circles) put(c, c.x - c.r, c.x + c.r, c.z - c.r, c.z + c.r);
  for (const b of boxes) put(b, b.x0, b.x1, b.z0, b.z1);
  indexed = circles.length * 7919 + boxes.length;
}
const seen = new Set();
/** Calls onCircle / onBox for every static shape that may touch the circle (x, z, r). Each shape once. */
export function nearShapes(x, z, r, onCircle, onBox) {
  if (indexed !== circles.length * 7919 + boxes.length) rebuild();
  seen.clear();
  for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) {
    for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
      const cell = grid.get(key(cx, cz));
      if (!cell) continue;
      for (const c of cell.c) if (!seen.has(c)) { seen.add(c); onCircle(c); }
      if (onBox) for (const b of cell.b) if (!seen.has(b)) { seen.add(b); onBox(b); }
    }
  }
}
