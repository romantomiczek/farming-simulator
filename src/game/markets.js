import { CROPS } from './crops.js';
import { has } from './machines.js';
import { BUILDINGS } from './farm.js';
import { COW_PEN, HEN_RUN } from '../world/layout.js';

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

/** Feed troughs of the animal buildings: unloading there fills the fodder store instead of selling. */
export const FEEDERS = [
  { id: 'cowsFeed', name: 'Krmelec u kravína', short: 'Kravín', ...COW_PEN.feed, feed: 'cows' },
  { id: 'hensFeed', name: 'Krmelec u kurníku', short: 'Kurník', ...HEN_RUN.feed, feed: 'hens' },
];

export const accepts = (m, crop) => (m.feed ? BUILDINGS[m.feed].eats.includes(crop) : m.mult.all != null || m.mult[crop] != null);
const near = p => m => Math.hypot(p.x - m.x, p.z - m.z) < m.r;
export const marketAt = p => MARKETS.find(near(p)) || FEEDERS.find(m => has(m.feed) && near(p)(m)) || null;

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
/** Animals that eat crop (owned buildings only). */
export const eatersOf = crop => FEEDERS.filter(m => has(m.feed) && accepts(m, crop)).map(m => m.short);
