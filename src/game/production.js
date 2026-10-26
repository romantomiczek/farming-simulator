import { G } from './state.js';
import { PRODUCTION, PALLET } from './balance.js';
import { PALLETS } from './animals.js';
import { targetHooks } from './markets.js';
import { builtOf, ringOf, BUILD_INFO } from './build.js';

/**
 * The farm's own production chains, as in Farming Simulator 25: the mill grinds wheat or barley into
 * flour, the bakery bakes bread from flour, the oil mill presses rapeseed or sunflower into oil and the
 * sawmill cuts logs into planks. The player builds them (game/build.js); each takes its input in the
 * ring in front of it (F: tip a trailer or a harvester's tank, unload flour pallets, put in the forestry
 * harvester's logs), works by the game hour and stacks what it makes on pallets in the same ring. A
 * trailer or a loader takes them to the market hall in the town (or flour to the bakery).
 * Stocks live in G.farm: <key>In = input, flour / bread / oil / planks = output not yet on a trailer.
 */
export const PROD_KEYS = ['mill', 'bakery', 'oilmill', 'sawmill'];
const inKey = key => key + 'In';
export const prodIn = key => G.farm[inKey(key)] || 0;
export const outOf = key => G.farm[PRODUCTION[key].out] || 0;
/** Are the output pallets of key stacked up to the limit (it stops)? */
export const prodFull = key => outOf(key) >= PRODUCTION.outCap * PALLET[PRODUCTION[key].out];
/** Production buildings that stand on the farm. */
export const productions = () => PROD_KEYS.filter(k => builtOf(k).length);
/** Puts up to amt into the store of production key; returns how much went in. */
export function prodTake(key, amt) {
  const take = Math.max(0, Math.min(amt, PRODUCTION[key].store - prodIn(key)));
  G.farm[inKey(key)] = prodIn(key) + take;
  return take;
}
/** Is point p in the ring of the farm's production key? */
export const atProd = (p, key) => builtOf(key).some(b => { const r = ringOf(b); return Math.hypot(p.x - r.x, p.z - r.z) < r.r; });

/** dh game hours of work: as much as the input allows, nothing while its pallets are full. */
export function prodTick(dh) {
  for (const key of productions()) {
    const r = PRODUCTION[key];
    if (prodFull(key)) continue;
    const use = Math.min(prodIn(key), r.in * dh);
    if (use <= 0) continue;
    G.farm[inKey(key)] -= use;
    G.farm[r.out] = outOf(key) + (use / r.in) * r.make;
  }
}
/** "mouka · 1 200 kg v zásobě, 3 palety" and so on, for the office. */
export const OUT_NAME = { flour: ['mouka', 'kg mouky'], bread: ['chléb', 'bochníků'], oil: ['olej', 'l oleje'], planks: ['prkna', 'm³ prken'] };
export const IN_NAME = { mill: 'l obilí', bakery: 'kg mouky', oilmill: 'l semen', sawmill: 'm³ kulatiny' };

// the output pallets wait in the building's ring: animals.js loads them from there, the market hall buys them
for (const key of PROD_KEYS) {
  const out = PRODUCTION[key].out, [label, unit] = OUT_NAME[out];
  PALLETS[out] = { label, unit, price: () => PRODUCTION[key].price, at: () => (builtOf(key)[0] ? ringOf(builtOf(key)[0]) : null) };
}
// the mill and the oil mill take a crop like a buyer does (F tips into them; a helper's transport can go there)
targetHooks.push(() => productions().filter(k => PRODUCTION[k].crops).map(k => {
  const r = ringOf(builtOf(k)[0]);
  return { id: 'prod-' + k, name: BUILD_INFO[k].mine, short: BUILD_INFO[k].name, x: r.x, z: r.z, r: r.r, prod: k, crops: PRODUCTION[k].crops };
}));
