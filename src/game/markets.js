import { CROPS } from './crops.js';

/**
 * Buyers. Each takes some crops (mult per crop index, or all) and drifts with its own phase,
 * so it pays to compare prices and drive further. Unload with F inside the buyer's ring.
 */
export const MARKETS = [
  { id: 'coop', name: 'Družstvo', short: 'Družstvo', x: 5, z: -24, r: 7.5, mult: { all: 0.95 }, phase: 0, color: '#e8b84a' },
  { id: 'mill', name: 'Mlýn Zlatý klas', short: 'Mlýn', x: 138, z: 58, r: 7, mult: { 0: 1.12, 1: 1.1 }, phase: 1.7, color: '#d9a441' },
  { id: 'oil', name: 'Olejna', short: 'Olejna', x: 205, z: 40, r: 7, mult: { 2: 1.12, 4: 1.14 }, phase: 3.1, color: '#c9b13a' },
  { id: 'sugar', name: 'Cukrovar a bioplynka', short: 'Cukrovar', x: 240, z: 58, r: 8, mult: { 5: 1.15, 3: 1.1 }, phase: 4.4, color: '#b79ec8' },
];

export const accepts = (m, crop) => m.mult.all != null || m.mult[crop] != null;
export const marketAt = p => MARKETS.find(m => Math.hypot(p.x - m.x, p.z - m.z) < m.r) || null;

/** Price in Kč/l at buyer m for crop at game minute t: multi-day swing plus a faster wobble. */
export function marketPrice(m, crop, t) {
  const c = CROPS[crop], d = t / 1440, k = m.mult[crop] ?? m.mult.all;
  return c.price * k * (1 + 0.14 * Math.sin((d * 2 * Math.PI) / 3.2 + crop * 2.1 + m.phase) + 0.05 * Math.sin(d * 2 * Math.PI * 1.7 + crop * 5.3 + m.phase * 2));
}

/** The buyer paying the most for crop right now: { m, p }. */
export function bestMarket(crop, t) {
  let best = null;
  for (const m of MARKETS) if (accepts(m, crop)) { const p = marketPrice(m, crop, t); if (!best || p > best.p) best = { m, p }; }
  return best;
}

/** Names of the buyers that take crop, for hints. */
export const buyersOf = crop => MARKETS.filter(m => accepts(m, crop)).map(m => m.name);
