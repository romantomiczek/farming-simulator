import { CROPS } from './crops.js';
import { G, dayOf } from './state.js';
import { MARKETS, accepts, marketPrice, bestMarket } from './markets.js';
import { fmt, rng, plural } from '../core/util.js';
import { toast } from '../ui/toast.js';
import { earn, stat } from './goals.js';
import { SILO_LOAD } from '../world/layout.js';

/**
 * The farm's grain store and delivery contracts, the main money decision in Farming Simulator:
 * sell the harvest now, or store it in the silos and sell it when the price is up.
 * - Storing: G in the ring of the farm intake (Družstvo) instead of F (selling) unloads the
 *   harvester or trailer into the silos, each crop on its own, SILO_CAP litres in all.
 * - Taking out: a trailer in the ring under the silos' outlet, F loads the chosen crop (C picks
 *   another one), and you drive it to the buyer that pays most.
 * - Delivery contracts: "N litres of a crop to a buyer within a few days for a premium". Every
 *   litre of that crop sold there counts and is paid with the premium; not delivered in time,
 *   the contract lapses (no penalty, the premium is lost).
 */
export const SILO_CAP = 200000;
/** Litres a second that run from the silo outlet into a trailer. */
export const LOAD_RATE = 900;
export const emptySilo = () => ({ stock: CROPS.map(() => 0), pick: 0 });
export const siloTotal = () => G.silo.stock.reduce((a, b) => a + b, 0);
export const siloSpace = () => Math.max(0, SILO_CAP - siloTotal());
/** What the stock would fetch now at the best buyer of each crop. */
export const siloValue = () => G.silo.stock.reduce((a, l, k) => a + l * (l > 0 ? bestMarket(k, G.gameMin).p : 0), 0);
export const inSiloLoad = p => Math.hypot(p.x - SILO_LOAD.x, p.z - SILO_LOAD.z) < SILO_LOAD.r;

/** Puts up to amt litres of crop into the silos; returns how much went in. */
export function store(crop, amt) {
  const take = Math.min(amt, siloSpace());
  G.silo.stock[crop] += take;
  return take;
}
/** Takes up to amt litres of crop out; returns how much came out. */
export function takeOut(crop, amt) {
  const take = Math.min(amt, G.silo.stock[crop]);
  G.silo.stock[crop] -= take;
  if (G.silo.stock[crop] < 0.5) G.silo.stock[crop] = 0;
  return take;
}
/** The crop to load at the outlet: the chosen one if there is any left, else the one with most. */
export function siloCrop() {
  const s = G.silo.stock;
  if (s[G.silo.pick] > 0.5) return G.silo.pick;
  let best = -1;
  s.forEach((l, k) => { if (l > 0.5 && (best < 0 || l > s[best])) best = k; });
  return best;
}
/** C at the outlet: the next crop that is in store. */
export function cycleSiloCrop() {
  const s = G.silo.stock, n = CROPS.length;
  for (let k = 1; k <= n; k++) {
    const c = (G.silo.pick + k) % n;
    if (s[c] > 0.5) { G.silo.pick = c; toast('Ze sila se bude nakládat: ' + CROPS[c].name + ' · ' + fmt(s[c]) + ' l'); return; }
  }
  toast('V silu nic není.', 'bad');
}

/** The best price of crop now against its average over the last `days` days (hour by hour). */
export function priceTrend(crop, days = 5) {
  let sum = 0, n = 0;
  for (let t = G.gameMin - days * 1440; t <= G.gameMin; t += 60, n++) sum += bestMarket(crop, t).p;
  const now = bestMarket(crop, G.gameMin).p;
  return { now, avg: sum / n, up: now / (sum / n) - 1 };
}
/** The stored crop whose price is furthest above its average (at least `min`), or null. */
export function goodSale(min = 0.06) {
  let best = null;
  G.silo.stock.forEach((l, k) => { if (l < 1000) return; const t = priceTrend(k); if (t.up >= min && (!best || t.up > best.up)) best = { crop: k, l, ...t }; });
  return best;
}

/* ---------- delivery contracts ---------- */
export const emptyDeliveries = () => ({ offers: [], active: [] });
const MAX_ACTIVE = 2;
const marketOf = id => MARKETS.find(m => m.id === id);
/** The buyer of contract d. */
export const deliveryMarket = d => marketOf(d.market);
/** What contract d pays per litre now (the buyer's price with the premium). */
export const deliveryPrice = d => marketPrice(deliveryMarket(d), d.crop, G.gameMin) * (1 + d.bonus);

/** New offers for the day: three buyers away from the farm want a crop, with a premium of 12–30 %. */
export function generateDeliveries() {
  const day = dayOf(G.gameMin), r = rng(day * 7919 + 17), out = [];
  r(); r(); // the first numbers of nearby seeds are alike
  const crops = CROPS.map((_, k) => k); // shuffled: three different crops
  for (let i = crops.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [crops[i], crops[j]] = [crops[j], crops[i]]; }
  for (let k = 0; k < 3; k++) {
    const crop = crops[k];
    const ms = MARKETS.filter(m => m.id !== 'coop' && accepts(m, crop));
    if (!ms.length) continue;
    const m = ms[Math.floor(r() * ms.length)], days = 2 + Math.floor(r() * 3);
    const amount = Math.round((6 + r() * 20) * (crop === 5 ? 2 : 1)) * 1000; // beet comes in bigger loads
    const id = 'd-' + day + '-' + k;
    if (G.deliveries.active.some(d => d.id === id)) continue;
    out.push({ id, crop, market: m.id, amount, bonus: Math.round((0.12 + r() * 0.18) * 100) / 100, days });
  }
  G.deliveries.offers = out;
}

export function acceptDelivery(id) {
  const D = G.deliveries, o = D.offers.find(x => x.id === id);
  if (!o || D.active.length >= MAX_ACTIVE) return false;
  D.active.push({ ...o, done: 0, deadline: G.gameMin + o.days * 1440 });
  D.offers = D.offers.filter(x => x !== o);
  toast('Dodávka přijata: ' + fmt(o.amount) + ' l ' + CROPS[o.crop].gen + ' do ' + deliveryMarket(o).short + ' do ' + plural(o.days, 'dne', 'dnů', 'dnů') + ' za +' + Math.round(o.bonus * 100) + ' %.', 'good');
  return true;
}
export const canAcceptDelivery = () => G.deliveries.active.length < MAX_ACTIVE;

/**
 * Selling amt litres of crop at buyer m: the part that goes towards an active delivery there is paid
 * with the premium. Returns the money for the whole amount (the caller adds it).
 */
export function sale(m, crop, amt) {
  const pr = marketPrice(m, crop, G.gameMin);
  let money = amt * pr, left = amt;
  for (const d of G.deliveries.active) {
    if (left <= 0 || d.market !== m.id || d.crop !== crop || d.done >= d.amount) continue;
    const part = Math.min(left, d.amount - d.done);
    d.done += part; left -= part; money += part * pr * d.bonus;
    if (d.done >= d.amount - 0.5) {
      d.done = d.amount; stat('deliveries');
      toast('Dodávka splněna: ' + fmt(d.amount) + ' l ' + CROPS[d.crop].gen + ' do ' + m.short + '. Příplatek +' + Math.round(d.bonus * 100) + ' % je ve výdělku.', 'good');
    }
  }
  return money;
}

/** Drops finished contracts and those past their deadline. Call a few times a second. */
export function checkDeliveries() {
  const D = G.deliveries, before = D.active.length;
  D.active = D.active.filter(d => {
    if (d.done >= d.amount) return false;
    if (G.gameMin > d.deadline) {
      toast('Dodávka ' + CROPS[d.crop].gen + ' do ' + deliveryMarket(d).short + ' propadla: dovezl jsi ' + fmt(d.done) + ' z ' + fmt(d.amount) + ' l.', 'bad');
      return false;
    }
    return true;
  });
  return D.active.length !== before;
}

/** Saved state back, with anything odd left out. */
export function loadSilo(d) {
  const s = emptySilo();
  if (Array.isArray(d?.stock)) d.stock.forEach((l, k) => { if (k < s.stock.length && Number.isFinite(l)) s.stock[k] = Math.max(0, l); });
  if (Number.isInteger(d?.pick) && d.pick >= 0 && d.pick < CROPS.length) s.pick = d.pick;
  return s;
}
export function loadDeliveries(d) {
  const ok = x => x && Number.isInteger(x.crop) && x.crop >= 0 && x.crop < CROPS.length && marketOf(x.market) && Number.isFinite(x.amount) && Number.isFinite(x.bonus);
  return {
    offers: (d?.offers || []).filter(ok),
    active: (d?.active || []).filter(x => ok(x) && Number.isFinite(x.deadline) && Number.isFinite(x.done)),
  };
}
