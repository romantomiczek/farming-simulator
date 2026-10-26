import { G } from './state.js';
import { HERD, HEALTH, DUNG, PALLET } from './balance.js';
import { fmt, plural } from '../core/util.js';
import { toast } from '../ui/toast.js';
import { earn } from './goals.js';
import { has } from './machines.js';
import { LIVESTOCK, MARKET_HALL, SLURRY_PIT, MANURE_HEAP, COW_PEN, HEN_RUN, SHEEP_PEN, PIG_PEN, GREENHOUSE_WATER } from '../world/layout.js';

/**
 * The animals and the fields as one loop, as in Farming Simulator:
 * - every building has a herd (head count, health 0..1). Fed animals get healthier and breed up to the
 *   building's size; hungry ones get sick, and very sick ones die. Production follows the head count
 *   and the health (farm.js).
 * - cows and pigs leave slurry, cows, sheep and hens manure; they gather in the slurry pit and on the
 *   manure heap by the pens, and the slurry tanker or the manure spreader takes them to the fields,
 *   where they count as fertiliser, first and second dose, for free.
 * - animals are bought and sold at the livestock dealer in the town, carried in the livestock trailer;
 *   loaded and unloaded in the building's ring.
 * - eggs, wool and tomatoes are packed on pallets by the building; a trailer takes them to the market
 *   hall in the town, which pays PALLET.bonus more than the midnight pickup.
 */
export const SPECIES = Object.keys(HERD);
/** More room for a herd from cow sheds the player built (game/build.js sets it). */
export const extraCap = { cows: 0, pigs: 0, sheep: 0, hens: 0 };
export const herdCap = key => HERD[key].cap + (extraCap[key] || 0);
export const herdName = (key, n) => plural(n, HERD[key].one, HERD[key].few, HERD[key].many);
const ring = { cows: COW_PEN.feed, hens: HEN_RUN.feed, sheep: SHEEP_PEN.feed, pigs: PIG_PEN.feed };
const near = (p, z) => Math.hypot(p.x - z.x, p.z - z.z) < z.r;
/** The owned animal building whose ring point p is in, or null. */
export const buildingAt = p => SPECIES.find(k => has(k) && near(p, ring[k])) || null;
export const atDealer = p => near(p, LIVESTOCK);
export const atHall = p => near(p, MARKET_HALL);
export const atSlurry = p => near(p, SLURRY_PIT.fill);
export const atManure = p => near(p, MANURE_HEAP.fill);

/** The herd of building key, set up with its starting animals the first time it is owned. */
const NONE = Object.freeze({ n: 0, health: 1, breed: 0, sick: 0 });
export function herd(key) {
  const F = G.farm;
  if (!F.herd[key]) { if (!has(key)) return NONE; F.herd[key] = { n: HERD[key].start, health: 1, breed: 0, sick: 0 }; }
  return F.herd[key];
}
/** Share of the starting herd's production the herd gives now (head count × health). */
export const herdFactor = key => { const h = herd(key); return (h.n / HERD[key].start) * (0.4 + 0.6 * h.health); };

/** One building's animals over dh game hours: health, young, deaths, slurry and manure. fed = it had its feed. */
export function herdTick(key, dh, fed) {
  const h = herd(key), s = HERD[key], F = G.farm;
  if (!h.n) return;
  h.health = Math.max(0, Math.min(1, h.health + (fed ? HEALTH.up : -HEALTH.down) * dh));
  if (fed && h.health >= HEALTH.breedAbove && h.n < herdCap(key)) {
    h.breed += h.n * s.breed * dh;
    while (h.breed >= 1 && h.n < herdCap(key)) { h.breed -= 1; h.n++; toast(BORN[key] + ' Ve stádě je teď ' + herdName(key, h.n) + '.', 'good'); }
  }
  if (h.health < HEALTH.sickBelow) {
    h.sick += h.n * HEALTH.deathPerHour * dh;
    while (h.sick >= 1 && h.n > 0) { h.sick -= 1; h.n--; toast(DIED[key] + ' Zvířata hladoví, nakrm je.', 'bad'); }
  } else h.sick = 0;
  F.slurry = Math.min(DUNG.slurryCap, F.slurry + h.n * s.slurry * dh);
  F.manure = Math.min(DUNG.manureCap, F.manure + h.n * s.manure * dh);
}
const BORN = { cows: 'V kravíně se narodilo tele.', pigs: 'Ve vepříně se narodilo sele.', sheep: 'V ovčíně se narodilo jehně.', hens: 'V kurníku se vylíhlo kuře.' };
const DIED = { cows: 'V kravíně uhynula kráva.', pigs: 'Ve vepříně uhynulo prase.', sheep: 'V ovčíně uhynula ovce.', hens: 'V kurníku uhynula slepice.' };

/* ---------- the livestock trailer ---------- */
/** What the dealer pays for one animal of key now (its health counts). */
export const animalValue = (key, health = 1) => Math.round(HERD[key].price * (0.5 + 0.5 * health));
/** What a new animal costs at the dealer. */
export const animalCost = key => Math.round(HERD[key].price * 1.1);
/** Species the dealer sells you: the ones whose building you own. */
export const buyable = () => SPECIES.filter(k => has(k));

/** F at a building with the livestock trailer: load its animals (empty trailer) or unload into it. */
export function trailerAtBuilding(t, key) {
  const h = herd(key), s = HERD[key], a = t.animals;
  if (a.n > 0) {
    if (a.kind !== key) return { kind: 'wrongAnimals', t, key };
    const n = Math.min(a.n, herdCap(key) - h.n);
    return n > 0 ? { kind: 'unloadAnimals', t, key, n } : { kind: 'herdFull', key };
  }
  const n = Math.min(h.n, s.perTrailer);
  return n > 0 ? { kind: 'loadAnimals', t, key, n } : null;
}
export function loadAnimals(t, key, n) {
  const h = herd(key);
  t.animals = { kind: key, n, health: h.health }; h.n -= n;
  toast('Naloženo ' + herdName(key, n) + '. U dobytčího trhu v městečku je prodáš, nebo je vylož v jiné budově.', 'good');
}
export function unloadAnimals(t, key, n) {
  const h = herd(key), a = t.animals;
  h.health = (h.health * h.n + a.health * n) / (h.n + n); h.n += n; a.n -= n;
  if (!a.n) t.animals = { kind: null, n: 0, health: 1 };
  toast('Vyloženo ' + herdName(key, n) + ' · ve stádě ' + herdName(key, h.n) + '.', 'good');
}
/** F at the dealer: sell what is in the trailer, or buy animals of the picked kind into the empty trailer. */
export function dealerAction(t) {
  const a = t.animals;
  if (a.n > 0) return { kind: 'sellAnimals', t, money: a.n * animalValue(a.kind, a.health) };
  const ks = buyable();
  if (!ks.length) return { kind: 'noBuilding' };
  const key = ks.includes(t.buyKind) ? t.buyKind : ks[0], n = HERD[key].perTrailer;
  return { kind: 'buyAnimals', t, key, n, cost: n * animalCost(key) };
}
export function sellAnimals(t) {
  const a = t.animals, money = a.n * animalValue(a.kind, a.health);
  G.money += money; earn(money); G.flashT = 0.4;
  toast('Dobytčí trh koupil ' + herdName(a.kind, a.n) + ' za ' + fmt(money) + ' Kč.', 'good');
  t.animals = { kind: null, n: 0, health: 1 };
}
export function buyAnimals(t, key, n) {
  const cost = n * animalCost(key);
  if (G.money < cost) { toast('Na ' + herdName(key, n) + ' ti chybí ' + fmt(cost - G.money) + ' Kč.', 'bad'); return; }
  G.money -= cost; t.animals = { kind: key, n, health: 1 };
  toast('Koupeno ' + herdName(key, n) + ' za ' + fmt(cost) + ' Kč. Odvez je do své budovy a vylož klávesou F v jejím kruhu.', 'good');
}
/** C at the dealer: the next kind of animal to buy. */
export function cycleBuyKind(t) {
  const ks = buyable();
  if (!ks.length) { toast('Zvířata koupíš, až budeš mít budovu (Kancelář → Obchod → Budovy).', 'bad'); return; }
  t.buyKind = ks[(ks.indexOf(t.buyKind) + 1) % ks.length];
  toast('U trhu koupíš: ' + herdName(t.buyKind, HERD[t.buyKind].perTrailer) + ' za ' + fmt(HERD[t.buyKind].perTrailer * animalCost(t.buyKind)) + ' Kč.');
}

/* ---------- pallets ---------- */
/** Products packed on pallets and where they wait: eggs at the hen house, wool at the fold, tomatoes at the greenhouses. */
export const PALLETS = {
  eggs: { label: 'vejce', at: () => (has('hens') ? HEN_RUN.feed : null), price: () => 15, unit: 'vajec' },
  wool: { label: 'vlna', at: () => (has('sheep') ? SHEEP_PEN.feed : null), price: () => 90, unit: 'kg vlny' },
  tomatoes: { label: 'rajčata', at: () => (has('greenhouse1') || has('greenhouse2') ? GREENHOUSE_WATER : null), price: () => 24, unit: 'kg rajčat' },
};
/** Full pallets of product p ready to be picked up. */
export const palletsReady = p => Math.floor(G.farm[p] / PALLET[p]);
/** The product whose pallets wait where point p is, or null. */
export const palletsHere = pt => Object.keys(PALLETS).find(p => { const z = PALLETS[p].at(); return z && near(pt, z) && palletsReady(p) > 0; }) || null;
/** What one pallet of p fetches at the market hall. */
export const palletValue = p => Math.round(PALLET[p] * PALLETS[p].price() * (1 + PALLET.bonus));
/** The pallets of products on trailer t that the market hall buys (not big bags of seed or fertiliser). */
export const productPallets = t => t.pallets.filter(p => p in PALLETS);
/** Loads as many full pallets of p as fit into trailer t. */
export function loadPallets(t, p) {
  const n = Math.min(palletsReady(p), t.baleCap - t.pallets.length);
  if (n <= 0) return 0;
  G.farm[p] -= n * PALLET[p];
  for (let k = 0; k < n; k++) t.pallets.push(p);
  toast('Naloženo ' + plural(n, 'paleta', 'palety', 'palet') + ': ' + PALLETS[p].label + '. V tržnici v městečku za ně dostaneš o ' + Math.round(PALLET.bonus * 100) + ' % víc.', 'good');
  return n;
}
/** Sells every pallet of products in trailer t at the market hall (big bags stay on). */
export function sellPallets(t) {
  const sold = productPallets(t), money = sold.reduce((a, p) => a + palletValue(p), 0), n = sold.length;
  G.money += money; earn(money); G.flashT = 0.4;
  t.pallets = t.pallets.filter(p => !(p in PALLETS));
  toast('Tržnice koupila ' + plural(n, 'paletu', 'palety', 'palet') + ' za ' + fmt(money) + ' Kč.', 'good');
}
/** Money the pallets in trailer t would fetch now. */
export const palletsMoney = t => productPallets(t).reduce((a, p) => a + palletValue(p), 0);
