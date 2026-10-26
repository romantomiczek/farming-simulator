import { CROPS } from './crops.js';
import { has } from './machines.js';
import { G } from './state.js';
import { MODES } from './balance.js';
import { BUILDINGS } from './farm.js';
import { COW_PEN, HEN_RUN, SHEEP_PEN, PIG_PEN, BUYER_AT } from '../world/layout.js';

/**
 * Buyers. Each takes some crops (mult per crop index, or all) and drifts with its own phase,
 * so it pays to compare prices and drive further. Unload with F inside the buyer's ring.
 */
export const MARKETS = [
  { id: 'coop', name: 'Družstvo', short: 'Družstvo', x: 5, z: -24, r: 7.5, mult: { all: 0.95 }, phase: 0, color: '#e8b84a' },
  { id: 'mill', name: 'Mlýn Zlatý klas', short: 'Mlýn', ...BUYER_AT.mill, r: 7, mult: { 0: 1.12, 1: 1.1 }, phase: 1.7, color: '#d9a441' },
  { id: 'oil', name: 'Olejna', short: 'Olejna', ...BUYER_AT.oil, r: 7, mult: { 2: 1.12, 4: 1.14 }, phase: 3.1, color: '#c9b13a' },
  { id: 'sugar', name: 'Cukrovar a bioplynka', short: 'Cukrovar', ...BUYER_AT.sugar, r: 8, mult: { 5: 1.15, 3: 1.1 }, phase: 4.4, color: '#b79ec8' },
  // in the town beyond the river: further to drive, better prices
  { id: 'station', name: 'Nádraží – výkup obilí', short: 'Nádraží', x: 668, z: 30, r: 8, mult: { 0: 1.18, 1: 1.16, 2: 1.12 }, phase: 2.3, color: '#8fb0c4' },
  { id: 'feed', name: 'Krmivárna', short: 'Krmivárna', ...BUYER_AT.feed, r: 7.5, mult: { 3: 1.16, 1: 1.08, 5: 1.08 }, phase: 5.2, color: '#c49a6c' },
];

/** Feed troughs of the animal buildings: unloading there fills the fodder store instead of selling. */
export const FEEDERS = [
  { id: 'cowsFeed', name: 'Krmelec u kravína', short: 'Kravín', ...COW_PEN.feed, feed: 'cows' },
  { id: 'hensFeed', name: 'Krmelec u kurníku', short: 'Kurník', ...HEN_RUN.feed, feed: 'hens' },
  { id: 'sheepFeed', name: 'Krmelec u ovčína', short: 'Ovčín', ...SHEEP_PEN.feed, feed: 'sheep' },
  { id: 'pigsFeed', name: 'Krmelec u vepřína', short: 'Vepřín', ...PIG_PEN.feed, feed: 'pigs' },
];

export const accepts = (m, crop) => (m.feed ? BUILDINGS[m.feed].eats.includes(crop) : m.prod ? m.crops.includes(crop) : m.mult.all != null || m.mult[crop] != null);
const near = p => m => Math.hypot(p.x - m.x, p.z - m.z) < m.r;
export const marketAt = p => MARKETS.find(near(p)) || FEEDERS.find(m => has(m.feed) && near(p)(m)) || targetHooks.flatMap(f => f()).find(near(p)) || null;
/** Owned trough at p whose animals eat hay bales, or null. */
export const hayFeederAt = p => FEEDERS.find(m => has(m.feed) && BUILDINGS[m.feed].hay && near(p)(m)) || null;

/** Price in Kč/l at buyer m for crop at game minute t: multi-day swing plus a faster wobble. */
export function marketPrice(m, crop, t) {
  const c = CROPS[crop], d = t / 1440, k = (m.mult[crop] ?? m.mult.all) * (MODES[G.mode]?.sell ?? 1);
  return c.price * k * (1 + 0.14 * Math.sin((d * 2 * Math.PI) / 3.2 + crop * 2.1 + m.phase) + 0.05 * Math.sin(d * 2 * Math.PI * 1.7 + crop * 5.3 + m.phase * 2));
}

/** The buyer paying the most for crop right now: { m, p }. */
export function bestMarket(crop, t) {
  let best = null;
  for (const m of MARKETS) if (accepts(m, crop)) { const p = marketPrice(m, crop, t); if (!best || p > best.p) best = { m, p }; }
  return best;
}

/** Places a transport job can take crop to: buyers, owned feed troughs, and the farm's own production (production.js adds itself). */
export const targetHooks = [];
const allTargets = () => [...MARKETS, ...FEEDERS.filter(m => has(m.feed)), ...targetHooks.flatMap(f => f())];
export const targetsFor = crop => allTargets().filter(m => accepts(m, crop));
export const targetById = id => allTargets().find(m => m.id === id) || null;

/** Names of the buyers that take crop, for hints. */
export const buyersOf = crop => MARKETS.filter(m => accepts(m, crop)).map(m => m.name);
/** Animals that eat crop (owned buildings only). */
export const eatersOf = crop => FEEDERS.filter(m => has(m.feed) && accepts(m, crop)).map(m => m.short);
