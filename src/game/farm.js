import { fmt } from '../core/util.js';
import { G } from './state.js';
import { has } from './machines.js';
import { toast } from '../ui/toast.js';
import { earn } from './goals.js';

/**
 * Animals and greenhouses. Storage lives in G.farm; production runs on game time
 * (per game hour), products are picked up and paid at midnight.
 * eats = crop indexes accepted as fodder (unloaded with F at the building's ring).
 */
export const BUILDINGS = {
  cows: { name: 'Kravín', store: 'cowFeed', cap: 30000, eats: [1, 3, 5], use: 2 * 10, out: 'milk', make: 6 * 10, unit: 'l mléka', price: 9 },
  hens: { name: 'Kurník', store: 'henFeed', cap: 8000, eats: [0, 1], use: 0.25 * 40, out: 'eggs', make: 0.1 * 40, unit: 'vajec', price: 15 },
};
export const GREENHOUSE = { use: 40, make: 10, price: 24, capPer: 6000 }; // per greenhouse: l water/h, kg tomatoes/h

export const emptyFarm = () => ({ cowFeed: 0, henFeed: 0, water: 0, milk: 0, eggs: 0, tomatoes: 0, hungry: {} });
export const greenhouses = () => (has('greenhouse1') ? 1 : 0) + (has('greenhouse2') ? 1 : 0);
export const waterCap = () => greenhouses() * GREENHOUSE.capPer;
export const space = key => Math.max(0, BUILDINGS[key].cap - G.farm[BUILDINGS[key].store]);

/** Production for dh game hours. Starving animals produce nothing. */
export function farmTick(dh) {
  if (dh <= 0) return;
  const F = G.farm;
  for (const key in BUILDINGS) {
    if (!has(key)) continue;
    const b = BUILDINGS[key], need = b.use * dh;
    if (F[b.store] >= need) { F[b.store] -= need; F[b.out] += b.make * dh; F.hungry[key] = false; }
    else { F[b.store] = 0; F.hungry[key] = true; }
  }
  const n = greenhouses();
  if (n) {
    const need = GREENHOUSE.use * n * dh;
    if (F.water >= need) { F.water -= need; F.tomatoes += GREENHOUSE.make * n * dh; F.dry = false; }
    else { F.water = 0; F.dry = true; }
  }
}

/** Midnight pickup: pays for milk, eggs and tomatoes. */
export function sellProducts() {
  const F = G.farm, parts = [];
  let total = 0;
  const sell = (amount, price, label) => {
    const n = Math.floor(amount);
    if (n < 1) return 0;
    total += n * price; parts.push(fmt(n) + ' ' + label);
    return n;
  };
  F.milk -= sell(F.milk, BUILDINGS.cows.price, 'l mléka');
  F.eggs -= sell(F.eggs, BUILDINGS.hens.price, 'vajec');
  F.tomatoes -= sell(F.tomatoes, GREENHOUSE.price, 'kg rajčat');
  if (total > 0) {
    G.money += total; earn(total); G.flashT = 0.4;
    toast('Odvoz z farmy: ' + parts.join(', ') + ' za ' + fmt(total) + ' Kč', 'good');
  }
}

/** Daily need and how long the stock lasts, for the office and hints. */
export function daysLeft(key) {
  if (key === 'water') { const n = greenhouses(); return n ? G.farm.water / (GREENHOUSE.use * n * 24) : Infinity; }
  const b = BUILDINGS[key];
  return G.farm[b.store] / (b.use * 24);
}
