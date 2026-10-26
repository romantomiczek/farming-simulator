import { G } from './state.js';
import { CROPS, FERT_COST, LIME_COST, HERB_COST } from './crops.js';
import { SUPPLY } from './balance.js';
import { SUPPLY_STORE } from '../world/layout.js';
import { tools, HOPPER, trailerCenter } from '../vehicles/vehicles.js';

/**
 * Seed, fertiliser, lime and herbicide, as in Farming Simulator: the seeder, the spreader and the sprayer
 * carry them in their hoppers (im.fill = { kind, amount }, up to im.fillCap kg or l) instead of paying
 * as they go. They are bought at the farm store (F in its ring fills the hitched hopper), or as big bags
 * (IBC for the herbicide) loaded onto a trailer and driven out to the field, where F by the trailer
 * refills the hopper; a loader can lift a bag into the hopper too. A square metre takes the Kč/m² of
 * crops.js divided by the price per kg, so it costs what it did before. On a neighbour's contract the
 * neighbour supplies everything; a helper has a refill brought out (SUPPLY.delivery more).
 */
export const SUPPLIES = {
  seed: { name: 'Osivo', gen: 'osiva', unit: 'kg', bag: 'big bag osiva' },
  fert: { name: 'Hnojivo', gen: 'hnojiva', unit: 'kg', bag: 'big bag hnojiva' },
  lime: { name: 'Vápno', gen: 'vápna', unit: 'kg', bag: 'big bag vápna' },
  herb: { name: 'Postřik', gen: 'postřiku', unit: 'l', bag: 'IBC s postřikem' },
};
export const SUPPLY_KINDS = Object.keys(SUPPLIES);
export const isSupply = p => p in SUPPLIES;
/** kg (or l) of kind one square metre takes; seed depends on the crop. */
export const perM2 = (kind, crop = 0) => (kind === 'seed' ? CROPS[crop].seed : kind === 'fert' ? FERT_COST : kind === 'lime' ? LIME_COST : HERB_COST) / SUPPLY[kind].price;
/** What the implement tractor v pulls should carry now: seed, herbicide, or fertiliser or lime (C on the spreader). */
export const wantKind = v => (v.impl === 'spreader' ? (v.spreadLime ? 'lime' : 'fert') : HOPPER[v.impl] || null);
export const atStore = p => Math.hypot(p.x - SUPPLY_STORE.x, p.z - SUPPLY_STORE.z) < SUPPLY_STORE.r;
/** "650 / 800 kg osiva" */
export const fillText = im => Math.round(im.fill.amount).toLocaleString('cs-CZ') + ' / ' + im.fillCap.toLocaleString('cs-CZ') + ' ' + SUPPLIES[im.fill.kind].unit + ' ' + SUPPLIES[im.fill.kind].gen;

/** Takes amt from implement im's hopper if it holds kind; false when it is empty or holds something else. */
export function useHopper(im, kind, amt) {
  const f = im.fill;
  if (f.kind !== kind || f.amount < amt) return false;
  f.amount = Math.max(0, f.amount - amt);
  return true;
}
/** What filling im with kind up to the top costs (what is in it of another kind is bought back). */
export const fillCost = (im, kind, extra = 0) => (im.fillCap - (im.fill.kind === kind ? im.fill.amount : 0)) * SUPPLY[kind].price * (1 + extra);
/**
 * Fills implement im with kind as far as the money goes, at the price plus extra (a delivery). Something
 * else in the hopper is bought back first. Returns how much went in (0 = no money or full).
 */
export function buyFill(im, kind, extra = 0) {
  const f = im.fill;
  if (f.kind !== kind && f.amount > 0) { G.money += Math.round(f.amount * SUPPLY[f.kind].price); f.amount = 0; }
  f.kind = kind;
  const price = SUPPLY[kind].price * (1 + extra), l = Math.min(im.fillCap - f.amount, Math.floor(Math.max(0, G.money) / price));
  if (l < 1) return 0;
  f.amount += l; G.money -= Math.round(l * price); G.flashT = 0.4;
  return l;
}
/** Pours up to amt of kind into implement im (from a bag); returns how much went in. */
export function pourInto(im, kind, amt) {
  const f = im.fill;
  if (f.kind !== kind && f.amount > 0) return 0;
  f.kind = kind;
  const l = Math.min(amt, im.fillCap - f.amount);
  f.amount += l;
  return l;
}

/* ---------- big bags on a trailer ---------- */
/** Supply bags of kind on trailer t; t.bagUsed[kind] = how much of the top one is gone already. */
export const bagsOf = (t, kind) => t.pallets.reduce((n, p) => n + (p === kind ? 1 : 0), 0);
/** kg or l of kind left in trailer t's bags. */
export const bagStock = (t, kind) => bagsOf(t, kind) * SUPPLY[kind].bag - (t.bagUsed?.[kind] || 0);
/** Empties up to amt from trailer t's bags of kind, the open bag first; an empty bag goes off the trailer. Returns how much. */
export function takeFromBags(t, kind, amt) {
  let got = 0;
  t.bagUsed ||= {};
  while (got < amt - 1e-6 && bagsOf(t, kind)) {
    const left = SUPPLY[kind].bag - (t.bagUsed[kind] || 0), take = Math.min(left, amt - got);
    got += take; t.bagUsed[kind] = (t.bagUsed[kind] || 0) + take;
    if (t.bagUsed[kind] >= SUPPLY[kind].bag - 1e-6) { t.pallets.splice(t.pallets.lastIndexOf(kind), 1); t.bagUsed[kind] = 0; }
  }
  return got;
}
/** A trailer within r metres of point p with bags of kind on it, or null. */
export const bagTrailerNear = (p, kind, r = 12) =>
  tools.find(t => t.key === 'trailer' && bagsOf(t, kind) > 0 && (() => { const c = trailerCenter(t); return Math.hypot(c.x - p.x, c.z - p.z) < r; })()) || null;
/** Where implement im is: under its tractor's hitch, or where it stands. */
export function toolAt(im) {
  const v = im.on;
  if (!v) return { x: im.x - Math.sin(im.h) * 1.2, z: im.z - Math.cos(im.h) * 1.2 };
  const z = v.hitchZ - 1.2;
  return { x: v.x + Math.sin(v.h) * z, z: v.z + Math.cos(v.h) * z };
}
/** C at the store with a trailer: the next kind of bag F loads. */
export function cycleSupply() {
  G.supplyPick = SUPPLY_KINDS[(SUPPLY_KINDS.indexOf(G.supplyPick) + 1) % SUPPLY_KINDS.length];
  return G.supplyPick;
}
export const supplyPick = () => (SUPPLIES[G.supplyPick] ? G.supplyPick : 'seed');
/** Buys one big bag of kind onto trailer t. */
export function buyBag(t, kind) {
  const cost = SUPPLY[kind].bag * SUPPLY[kind].price;
  if (G.money < cost || t.pallets.length >= t.baleCap) return false;
  G.money -= cost; G.flashT = 0.4;
  t.pallets.push(kind);
  return true;
}
