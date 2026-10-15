import { G } from './state.js';
import { vehicles, IMPL, IMPL_ORDER, tractor, combine, trailer, attachImpl, setHeader, applyUpgrades } from '../vehicles/vehicles.js';
import { COWS, HENS, GREENHOUSE, WOOD } from './balance.js';

/**
 * Everything the player can own. key matches the vehicle type or implement key;
 * cornHeader is the combine's row header. Buildings and upgrades (noLease) can only be bought.
 * Prices in Kč.
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
  { key: 'baler', name: 'Lis na balíky', kind: 'Nářadí', price: 480000, desc: 'Lisuje slámu za kombajnem a seno z luk do kulatých balíků.' },
  { key: 'mower', name: 'Žací lišta', kind: 'Nářadí', price: 140000, desc: 'Záběr 3 m. Poseče louku a nechá řádek sena pro lis; tráva pak sama doroste.' },
  { key: 'trailer', name: 'Sklápěcí přívěs', kind: 'Nářadí', price: 150000, desc: '14 000 l zrna nebo 8 balíků.' },
  { key: 'watertank', name: 'Cisterna na vodu', kind: 'Nářadí', price: 70000, desc: '8 000 l vody z rybníka pro skleníky. V kůlně klávesa 7.' },
  { key: 'jeep', name: 'Jeep Lesák 4×4', kind: 'Osobní auto', price: 290000, desc: 'Rychlý terénní vůz, až 80 km/h. Nic netáhne a nepracuje, ale rychle tě doveze k poli, do lesa i do městečka. Mezerník troubí.' },
  { key: 'forest', name: 'Harvestor Les 8', kind: 'Lesnictví', price: WOOD.harvesterPrice, desc: 'Kácí vzrostlé stromy v lesních parcelách a veze až ' + WOOD.logCap + ' m³ dřeva na pilu nebo do dřevoskladu.' },
  { key: 'cows', name: 'Kravín s 10 kravami', kind: 'Budovy', price: COWS.price, noLease: true, desc: 'Krávy žerou kukuřici, ječmen nebo cukrovku a dávají mléko. Mléko se prodá samo o půlnoci.' },
  { key: 'hens', name: 'Kurník se 40 slepicemi', kind: 'Budovy', price: HENS.price, noLease: true, desc: 'Slepice žerou pšenici nebo ječmen a snášejí vejce. Vejce se prodají o půlnoci.' },
  { key: 'greenhouse1', name: 'Skleník s rajčaty', kind: 'Budovy', price: GREENHOUSE.price, noLease: true, desc: 'Pěstuje rajčata, potřebuje vodu z cisterny. Rajčata se prodají o půlnoci.' },
  { key: 'greenhouse2', name: 'Druhý skleník', kind: 'Budovy', price: GREENHOUSE.price, noLease: true, desc: 'Zdvojnásobí sklizeň rajčat i spotřebu vody.' },
  { key: 'upTractor', name: 'Výkonnější motor traktoru', kind: 'Vylepšení', price: 260000, noLease: true, desc: 'Traktor jede až 50 km/h a pracuje o 10 % rychleji.' },
  { key: 'upCultivator', name: 'Široký kultivátor', kind: 'Vylepšení', price: 140000, noLease: true, desc: 'Záběr kultivátoru 6,3 m místo 4,2 m.' },
  { key: 'upCombine', name: 'Větší zásobník kombajnu', kind: 'Vylepšení', price: 220000, noLease: true, desc: '13 000 l místo 9 000 l.' },
  { key: 'upTrailer', name: 'Nástavba přívěsu', kind: 'Vylepšení', price: 90000, noLease: true, desc: '22 000 l místo 14 000 l.' },
];
/** Buildings and upgrades have no wear. */
export const hasCondition = c => !c.noLease;
/** Called after every ownership change (the farmstead uses it to show its buildings). */
export const ownershipHooks = [];
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
  applyUpgrades({ tractor: has('upTractor'), cultivator: has('upCultivator'), combine: has('upCombine'), trailer: has('upTrailer') });
  ownershipHooks.forEach(f => f());
}

/** Why a machine cannot be sold or returned right now, or null. */
export function blockReason(key) {
  if (byKey[key].fixed) return 'Bez traktoru by farma nefungovala.';
  if (G.active?.type === key) return 'Právě v něm sedíš.';
  if (vehicles.find(x => x.type === key)?.helper) return 'Pracuje na něm pomocník.';
  if (tractor.helper && tractor.impl === key) return 'Pracuje s ním pomocník.';
  if (tractor.impl === key) return 'Je připojené k traktoru. V kůlně připoj jiné nářadí.';
  if (key === 'cornHeader' && combine.header === 'corn') return 'Je nasazený na kombajnu. V kůlně nasaď žací lištu.';
  const v = vehicles.find(x => x.type === key);
  if (v && (v.tank.amount > 0 || v.unloading)) return 'Nejdřív vyprázdni zásobník.';
  if (v?.logs > 0) return 'Nejdřív prodej dřevo na pile.';
  if (key === 'upCombine' && combine.tank.amount > 9000) return 'Zásobník kombajnu je plnější než 9 000 l.';
  if (key === 'upTrailer' && trailer.tank.amount > 14000) return 'Přívěs je plnější než 14 000 l.';
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
  if (has(key) || byKey[key].noLease || !pay(leaseUpfront(key))) return false;
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
