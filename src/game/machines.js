import { G } from './state.js';
import { vehicles, IMPL, IMPL_ORDER, tractor, combine, attachImpl, setHeader } from '../vehicles/vehicles.js';

/**
 * Everything the player can own. key matches the vehicle type or implement key;
 * cornHeader is the combine's row header. Prices in Kč.
 */
export const CATALOG = [
  { key: 'tractor', name: 'Traktor Brázda 140', kind: 'Traktory', price: 1450000, desc: '140 koní, tahá všechno nářadí a přívěs.', fixed: true },
  { key: 'combine', name: 'Kombajn Klas 7', kind: 'Sklízecí stroje', price: 3200000, desc: 'Obilí, řepka; s řádkovým adaptérem i kukuřice a slunečnice. Zásobník 9 000 l.' },
  { key: 'beet', name: 'Sklízeč cukrovky Bulva 6', kind: 'Sklízecí stroje', price: 4100000, desc: 'Šestiřádkový samojízdný sklízeč, zásobník 20 000 l.' },
  { key: 'cornHeader', name: 'Řádkový adaptér', kind: 'Adaptéry kombajnu', price: 320000, desc: 'Na kukuřici a slunečnici. Nasazuje se v kůlně.' },
  { key: 'cultivator', name: 'Kultivátor', kind: 'Nářadí', price: 180000, desc: 'Záběr 4,2 m, připraví strniště k setí.' },
  { key: 'plough', name: 'Pluh', kind: 'Nářadí', price: 220000, desc: 'Záběr 3,2 m, pomalejší, ale +15 % výnosu.' },
  { key: 'seeder', name: 'Secí stroj', kind: 'Nářadí', price: 260000, desc: 'Záběr 4 m, seje všech šest plodin.' },
  { key: 'spreader', name: 'Rozmetadlo', kind: 'Nářadí', price: 90000, desc: 'Záběr 12 m, hnojivo +25 % výnosu.' },
  { key: 'baler', name: 'Lis na balíky', kind: 'Nářadí', price: 480000, desc: 'Lisuje slámu za kombajnem do kulatých balíků.' },
  { key: 'trailer', name: 'Sklápěcí přívěs', kind: 'Nářadí', price: 150000, desc: '14 000 l zrna nebo 8 balíků.' },
];
export const byKey = Object.fromEntries(CATALOG.map(c => [c.key, c]));
export const START_OWNED = ['tractor', 'combine', 'cultivator', 'seeder', 'trailer'];

export const LEASE_UPFRONT = 0.05; // share of the price paid when leasing
export const LEASE_DAILY = 0.012; // share of the price charged every game day
const SELL_SHARE = 0.55; // resale value of a machine in new condition
const REPAIR_SHARE = 0.12; // full repair from 0 % costs this share of the price

export const has = key => !!G.machines[key];
export const sellValue = key => Math.round(byKey[key].price * SELL_SHARE * (G.cond[key] ?? 1));
export const leaseUpfront = key => Math.round(byKey[key].price * LEASE_UPFRONT);
export const leaseDaily = key => Math.round(byKey[key].price * LEASE_DAILY);
export const repairCost = key => Math.round(byKey[key].price * REPAIR_SHARE * (1 - (G.cond[key] ?? 1)));
export const dailyLeaseCost = () => CATALOG.reduce((a, c) => a + (G.machines[c.key] === 'lease' ? leaseDaily(c.key) : 0), 0);

/** allOwned = true for saves from before the shop existed: keep every machine the player had. */
export function resetMachines(allOwned) {
  G.machines = {}; G.cond = {};
  for (const c of CATALOG) { G.machines[c.key] = allOwned || START_OWNED.includes(c.key) ? 'own' : null; G.cond[c.key] = 1; }
}

/** Shows or hides machines to match ownership and fixes anything that points at a missing one. */
export function applyOwnership() {
  for (const v of vehicles) { v.available = has(v.type); v.group.visible = v.available; }
  for (const k of IMPL_ORDER) IMPL[k].group.visible = has(k);
  combine.cornHdr.visible = has('cornHeader');
  if (!has('cornHeader') && combine.header === 'corn') setHeader('grain');
  if (!has(tractor.impl)) { const k = IMPL_ORDER.find(has); if (k) attachImpl(k); }
  if (!G.active?.available) G.active = vehicles.find(v => v.available);
}

/** Why a machine cannot be sold or returned right now, or null. */
export function blockReason(key) {
  if (byKey[key].fixed) return 'Bez traktoru by farma nefungovala.';
  if (G.active?.type === key) return 'Právě v něm sedíš.';
  if (tractor.impl === key) return 'Je připojené k traktoru. V kůlně připoj jiné nářadí.';
  if (key === 'cornHeader' && combine.header === 'corn') return 'Je nasazený na kombajnu. V kůlně nasaď žací lištu.';
  const v = vehicles.find(x => x.type === key);
  if (v && (v.tank.amount > 0 || v.unloading)) return 'Nejdřív vyprázdni zásobník.';
  if (G.contracts.active && key === contractNeeds(G.contracts.active)) return 'Potřebuješ ho na rozpracovanou zakázku.';
  return null;
}
/** Catalog key of the machine a contract needs (set by contracts.js to avoid a circular import). */
export let contractNeeds = () => null;
export const setContractNeeds = fn => { contractNeeds = fn; };

function pay(amount) {
  if (G.money < amount) return false;
  G.money -= amount; G.flashT = 0.4;
  return true;
}
export function buy(key) {
  if (has(key) || !pay(byKey[key].price)) return false;
  G.machines[key] = 'own'; G.cond[key] = 1;
  applyOwnership();
  return true;
}
export function lease(key) {
  if (has(key) || !pay(leaseUpfront(key))) return false;
  G.machines[key] = 'lease'; G.cond[key] = 1;
  applyOwnership();
  return true;
}
/** Sells an owned machine or hands back a leased one. */
export function release(key) {
  if (!has(key) || blockReason(key)) return false;
  if (G.machines[key] === 'own') { G.money += sellValue(key); G.flashT = 0.4; }
  G.machines[key] = null;
  applyOwnership();
  return true;
}
