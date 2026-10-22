import { fmt } from '../core/util.js';
import { CROPS } from './crops.js';
import { G } from './state.js';
import { has } from './machines.js';
import { toast } from '../ui/toast.js';
import { earn } from './goals.js';
import { COWS, HENS, SHEEP, PIGS, MIXER, HAY_BALE_FEED, GREENHOUSE as GH } from './balance.js';
import { herd, herdFactor, herdTick } from './animals.js';

/**
 * Animals and greenhouses. Storage lives in G.farm; production runs on game time
 * (per game hour), products are picked up and paid at midnight.
 * eats = crop indexes accepted as fodder (unloaded with F at the building's ring); hay = also eats
 * round bales of hay from the trailer (F at the same ring).
 */
export const BUILDINGS = {
  cows: { base: 10, name: 'Kravín', store: 'cowFeed', cap: COWS.feedStore, eats: [1, 3, 5], hay: true, use: COWS.feedPerHour, out: 'milk', make: COWS.milkPerHour, unit: 'l mléka', price: COWS.milkPrice, ring: 'zeleného kruhu u kravína' },
  hens: { base: 40, name: 'Kurník', store: 'henFeed', cap: HENS.feedStore, eats: [0, 1], use: HENS.feedPerHour, out: 'eggs', make: HENS.eggsPerHour, unit: 'vajec', price: HENS.eggPrice, ring: 'žlutého kruhu u kurníku' },
  sheep: { base: 16, name: 'Ovčín', store: 'sheepFeed', cap: SHEEP.feedStore, eats: [], hay: true, use: SHEEP.feedPerHour, out: 'wool', make: SHEEP.woolPerHour, unit: 'kg vlny', price: SHEEP.woolPrice, ring: 'světlého kruhu u ovčína' },
  pigs: { base: 12, name: 'Vepřín', store: 'pigFeed', cap: PIGS.feedStore, eats: [3, 1], use: PIGS.feedPerHour, out: 'pork', make: PIGS.meatPerHour, unit: 'kg vepřového', price: PIGS.meatPrice, ring: 'růžového kruhu u vepřína' },
};
const ACC = ['pšenici', 'ječmen', 'řepku', 'kukuřici', 'slunečnici', 'cukrovku'];
/** What building key eats, for the office ("ječmen, kukuřice, balíky sena"); acc = in the accusative for hints. */
export const eatsText = (key, acc) => [...BUILDINGS[key].eats.map(i => (acc ? ACC[i] : CROPS[i].name.toLowerCase())), ...(BUILDINGS[key].hay ? ['balíky sena'] : [])].join(', ');
export const GREENHOUSE = { use: GH.waterPerHour, make: GH.kgPerHour, price: GH.kgPrice, capPer: GH.waterStore }; // per greenhouse: l water/h, kg tomatoes/h

export const emptyFarm = () => ({
  cowFeed: 0, henFeed: 0, sheepFeed: 0, pigFeed: 0, water: 0, milk: 0, eggs: 0, wool: 0, pork: 0, tomatoes: 0, hungry: {},
  mix: { grain: 0, hay: 0, beet: 0 }, // what the cows' feed is made of, in litres
  herd: {}, slurry: 0, manure: 0, // herds and what they leave (animals.js)
  bunker: { chaff: 0, packed: 0, covered: false, ferment: 0, silage: 0 }, // the silage bunker (forage.js)
});
export const greenhouses = () => (has('greenhouse1') ? 1 : 0) + (has('greenhouse2') ? 1 : 0);
export const waterCap = () => greenhouses() * GREENHOUSE.capPer;
export const space = key => Math.max(0, BUILDINGS[key].cap - G.farm[BUILDINGS[key].store]);

/** Puts l litres of feed into building key's store; part = what it is, for the cows' mix. */
export function addFeed(key, l, part) {
  G.farm[BUILDINGS[key].store] += l;
  if (key === 'cows') G.farm.mix[part] += l;
}
export const partOf = crop => (crop === 5 ? 'beet' : 'grain');
/** Shares of grain, hay and beet in the cows' feed (0..1 each). */
export function mixShares() {
  const m = G.farm.mix, t = m.grain + m.hay + m.beet;
  return t > 0 ? { grain: m.grain / t, hay: m.hay / t, beet: m.beet / t } : { grain: 0, hay: 0, beet: 0 };
}
/** True when the mixer is bought and the feed is balanced enough for more milk. */
export function mixOk() {
  if (!has('mixer') || G.farm.cowFeed <= 0) return false;
  const s = mixShares();
  return s.grain >= MIXER.minShare && s.hay >= MIXER.minShare && s.beet >= MIXER.minShare;
}

/** Hay bales unloaded at building key's trough: puts in what fits, returns how many bales it took. */
export function feedHay(key, bales) {
  const n = Math.min(bales, Math.floor(space(key) / HAY_BALE_FEED));
  if (n > 0) addFeed(key, n * HAY_BALE_FEED, 'hay');
  return n;
}

/** Production for dh game hours. Starving animals produce nothing; the herd's size and health scale it (animals.js). */
export function farmTick(dh) {
  if (dh <= 0) return;
  const F = G.farm;
  for (const key in BUILDINGS) {
    if (!has(key)) continue;
    const b = BUILDINGS[key], h = herd(key), need = b.use * dh * (h.n / Math.max(1, b.base)), before = F[b.store];
    const make = b.make * herdFactor(key) * (key === 'cows' && mixOk() ? 1 + MIXER.bonus : 1);
    const fed = before >= need;
    if (!h.n) F.hungry[key] = false;
    else if (fed) { F[b.store] -= need; F[b.out] += make * dh; F.hungry[key] = false; }
    else { F[b.store] = 0; F.hungry[key] = true; }
    herdTick(key, dh, fed);
    if (key === 'cows') { const k = before > 0 ? F.cowFeed / before : 0; for (const p in F.mix) F.mix[p] *= k; }
  }
  const n = greenhouses();
  if (n) {
    const need = GREENHOUSE.use * n * dh;
    if (F.water >= need) { F.water -= need; F.tomatoes += GREENHOUSE.make * n * dh; F.dry = false; }
    else { F.water = 0; F.dry = true; }
  }
}

/** Midnight pickup: pays for milk (what the tank did not take to the dairy), eggs, wool, pork and tomatoes. */
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
  F.wool -= sell(F.wool, BUILDINGS.sheep.price, 'kg vlny');
  F.pork -= sell(F.pork, BUILDINGS.pigs.price, 'kg vepřového');
  F.tomatoes -= sell(F.tomatoes, GREENHOUSE.price, 'kg rajčat');
  if (total > 0) {
    G.money += total; earn(total); G.flashT = 0.4;
    toast('Odvoz z farmy: ' + parts.join(', ') + ' za ' + fmt(total) + ' Kč', 'good');
  }
}

/** Daily need and how long the stock lasts, for the office and hints. */
export function daysLeft(key) {
  if (key === 'water') { const n = greenhouses(); return n ? G.farm.water / (GREENHOUSE.use * n * 24) : Infinity; }
  const b = BUILDINGS[key], n = herd(key).n;
  return n ? G.farm[b.store] / (b.use * (n / b.base) * 24) : Infinity;
}
