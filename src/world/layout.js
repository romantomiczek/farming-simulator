// Map layout in metres. +z is north, the farmyard sits south of the fields.

/** Area vehicles may drive in (the flat valley floor). */
export const BOUNDS = { x0: -100, x1: 100, z0: -90, z1: 140 };

export const FIELD_DEFS = [
  { id: 1, x0: -70, z0: -5, w: 50, h: 45, owned: true, price: 0, sign: [-17.5, -3, Math.PI / 2] },
  { id: 2, x0: 0, z0: -5, w: 50, h: 45, owned: true, price: 0, sign: [-2.5, -3, -Math.PI / 2] },
  { id: 3, x0: -70, z0: 56, w: 50, h: 44, owned: false, price: 420000, sign: [-17.5, 58, Math.PI / 2] },
  { id: 4, x0: 0, z0: 56, w: 58, h: 42, owned: false, price: 460000, sign: [-2.5, 58, -Math.PI / 2] },
];

export const ROADS = [
  { x0: -14, x1: -6, z0: -50, z1: 106 },
  { x0: -74, x1: 62, z0: 44, z1: 52 },
];
export const PAD = { x0: -46, x1: 26, z0: -52, z1: -12 };
export const POND = { x: 64, z: -42, r: 13 };

/** Grain intake next to the silos: unload the combine here with F. */
export const sellZone = { x: 5, z: -24, r: 7.5 };
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
