import { G } from './state.js';
import {
  vehicles, tools, VEHICLE_TYPES, isToolKey, firstOf, addVehicle, addTool, removeVehicle, removeTool, clearFleet, attachTool, setHeader, applyUpgrades,
} from '../vehicles/vehicles.js';
import { COWS, HENS, SHEEP, PIGS, MIXER, GREENHOUSE, WOOD } from './balance.js';

/**
 * Everything the player can own. key matches the vehicle type or implement key; machines and
 * implements are pieces in the fleet (vehicles.js), each owned or leased with its own condition.
 * cornHeader is the combine's row header. Buildings and upgrades (noLease) can only be bought;
 * they and the header live in G.machines / G.cond by key. Prices in Kč.
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
  { key: 'watertank', name: 'Cisterna', kind: 'Nářadí', price: 70000, desc: '8 000 l vody z rybníka pro skleníky, nebo mléka z kravína do mlékárny. V kůlně klávesa 7.' },
  { key: 'jeep', name: 'Jeep Lesák 4×4', kind: 'Osobní auto', price: 290000, desc: 'Rychlý terénní vůz, až 80 km/h. Nic netáhne a nepracuje, ale rychle tě doveze k poli, do lesa i do městečka. Mezerník troubí.' },
  { key: 'forest', name: 'Harvestor Les 8', kind: 'Lesnictví', price: WOOD.harvesterPrice, desc: 'Kácí vzrostlé stromy v lesních parcelách a veze až ' + WOOD.logCap + ' m³ dřeva na pilu nebo do dřevoskladu.' },
  { key: 'cows', name: 'Kravín s 10 kravami', kind: 'Budovy', price: COWS.price, noLease: true, desc: 'Krávy žerou kukuřici, ječmen, cukrovku nebo balíky sena a dávají mléko. Mléko se prodá samo o půlnoci, nebo ho cisternou odvezeš do mlékárny v městečku za ' + COWS.dairyPrice + ' Kč/l místo ' + COWS.milkPrice + '.' },
  { key: 'mixer', name: 'Míchací krmný vůz', kind: 'Budovy', price: MIXER.price, noLease: true, desc: 'Stojí u kravína a míchá krmnou směs. Když je v krmelci zrno, seno i cukrovka (každé aspoň ' + Math.round(MIXER.minShare * 100) + ' %), dávají krávy o ' + Math.round(MIXER.bonus * 100) + ' % víc mléka. Potřebuje kravín.' },
  { key: 'sheep', name: 'Ovčín s 16 ovcemi', kind: 'Budovy', price: SHEEP.price, noLease: true, desc: 'Ovce žerou balíky sena z luk a dávají vlnu. Vlna se prodá o půlnoci.' },
  { key: 'pigs', name: 'Vepřín s 12 prasaty', kind: 'Budovy', price: PIGS.price, noLease: true, desc: 'Prasata žerou kukuřici nebo ječmen. Vepřové se prodá o půlnoci.' },
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

/** Is key a machine or implement (pieces in the fleet) rather than a building, upgrade or header? */
export const isMachine = key => VEHICLE_TYPES.includes(key) || isToolKey(key);
/** The pieces of catalog key in the fleet. */
export const piecesOf = key => (VEHICLE_TYPES.includes(key) ? vehicles.filter(v => v.type === key) : tools.filter(t => t.key === key));
export const has = key => (isMachine(key) ? piecesOf(key).length > 0 : !!G.machines[key]);
/** 'own' | 'lease' | null: a machine's first piece, or a building, upgrade or header. */
export const status = key => (isMachine(key) ? piecesOf(key)[0]?.own ?? null : G.machines[key] || null);
/** Condition 0..1 of key (its first piece for machines). */
export const condOf = key => (isMachine(key) ? piecesOf(key)[0]?.cond ?? 1 : G.cond[key] ?? 1);
const priceOf = p => byKey[p.type || p.key].price;
/** What a piece fetches when sold, by its condition. */
export const sellValueOf = p => Math.round(priceOf(p) * SELL_SHARE * p.cond);
export const sellValue = key => (isMachine(key) ? sellValueOf(piecesOf(key)[0]) : Math.round(byKey[key].price * SELL_SHARE * (G.cond[key] ?? 1)));
export const leaseUpfront = key => Math.round(byKey[key].price * LEASE_UPFRONT);
export const leaseDaily = key => Math.round(byKey[key].price * LEASE_DAILY);
/** Full repair of piece p (machine or implement). */
export const repairCostOf = p => (p ? Math.round(priceOf(p) * REPAIR_SHARE * (1 - p.cond)) : 0);
export const dailyLeaseCost = () =>
  [...vehicles, ...tools].reduce((a, p) => a + (p.own === 'lease' ? leaseDaily(p.type || p.key) : 0), 0) +
  CATALOG.reduce((a, c) => a + (!isMachine(c.key) && G.machines[c.key] === 'lease' ? leaseDaily(c.key) : 0), 0);

/** A new game: the starting fleet (tractor with the cultivator, combine, seeder, trailer), no buildings. */
export function startFleet() {
  clearFleet();
  G.machines = {}; G.cond = {};
  for (const c of CATALOG) if (!isMachine(c.key)) { G.machines[c.key] = null; G.cond[c.key] = 1; }
  for (const key of START_OWNED) (isToolKey(key) ? addTool : addVehicle)(key);
  attachTool(firstOf('tractor'), tools.find(t => t.key === 'cultivator'));
}

/** Shows or hides machine parts to match ownership and fixes anything that points at a missing piece. */
export function applyOwnership() {
  for (const v of vehicles) {
    if (v.type !== 'combine') continue;
    v.cornHdr.visible = has('cornHeader');
    if (!has('cornHeader') && v.header === 'corn') setHeader(v, 'grain');
  }
  // a tractor that lost its tool takes a free one
  for (const v of vehicles) if (v.type === 'tractor' && !v.tool) { const t = tools.find(x => !x.on); if (t) attachTool(v, t); }
  if (!vehicles.includes(G.active)) G.active = firstOf('combine') || vehicles[0];
  applyUpgrades({ tractor: has('upTractor'), cultivator: has('upCultivator'), combine: has('upCombine'), trailer: has('upTrailer') });
  ownershipHooks.forEach(f => f());
}

/** Why piece p cannot be sold or returned right now, or null. */
export function blockReasonOf(p) {
  const key = p.type || p.key;
  if (byKey[key].fixed && piecesOf(key).length < 2) return 'Bez traktoru by farma nefungovala.';
  if (G.active === p) return 'Právě v něm sedíš.';
  if (p.helper) return 'Pracuje na něm pomocník.';
  if (p.on?.helper) return 'Pracuje s ním pomocník.';
  if (p.on) return 'Je připojené k traktoru. V kůlně připoj jiné nářadí.';
  if (p.harvester && (p.tank.amount > 0 || p.unloading)) return 'Nejdřív vyprázdni zásobník.';
  if (p.logs > 0) return 'Nejdřív prodej dřevo na pile.';
  if (p.key === 'trailer' && (p.tank.amount > 0 || p.bales > 0)) return 'Nejdřív vyprázdni přívěs.';
  if (p.key === 'watertank' && p.milk && p.water > 0) return 'V cisterně je mléko. Prodej ho v mlékárně.';
  if (G.contracts.active && key === contractNeeds(G.contracts.active) && piecesOf(key).length < 2) return 'Potřebuješ ho na rozpracovanou zakázku.';
  return null;
}
/** Why catalog key cannot be sold or returned right now, or null. */
export function blockReason(key) {
  if (isMachine(key)) return piecesOf(key)[0] ? blockReasonOf(piecesOf(key)[0]) : null;
  if (key === 'cornHeader' && vehicles.some(v => v.type === 'combine' && v.header === 'corn')) return 'Je nasazený na kombajnu. V kůlně nasaď žací lištu.';
  if (key === 'upCombine' && vehicles.some(v => v.type === 'combine' && v.tank.amount > 9000)) return 'Zásobník kombajnu je plnější než 9 000 l.';
  if (key === 'upTrailer' && tools.some(t => t.key === 'trailer' && t.tank.amount > 14000)) return 'Přívěs je plnější než 14 000 l.';
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
/** Adds a new piece of machine key to the fleet; an implement goes on a tractor that has none. */
function addPiece(key, own) {
  if (!isToolKey(key)) return addVehicle(key, { own });
  const t = addTool(key, { own });
  const v = vehicles.find(x => x.type === 'tractor' && !x.tool && !x.helper);
  if (v) attachTool(v, t);
  return t;
}
export function buy(key) {
  if (has(key) || !pay(byKey[key].price)) return false;
  if (isMachine(key)) addPiece(key, 'own');
  else { G.machines[key] = 'own'; G.cond[key] = 1; }
  applyOwnership();
  return true;
}
export function lease(key) {
  if (has(key) || byKey[key].noLease || !pay(leaseUpfront(key))) return false;
  if (isMachine(key)) addPiece(key, 'lease');
  else { G.machines[key] = 'lease'; G.cond[key] = 1; }
  applyOwnership();
  return true;
}
/** Sells an owned machine or hands back a leased one (machines: its first piece). */
export function release(key) {
  if (!has(key) || blockReason(key)) return false;
  if (isMachine(key)) {
    const p = piecesOf(key)[0];
    if (p.own === 'own') { G.money += sellValueOf(p); G.flashT = 0.4; }
    (isToolKey(key) ? removeTool : removeVehicle)(p);
  } else {
    if (G.machines[key] === 'own') { G.money += sellValue(key); G.flashT = 0.4; }
    G.machines[key] = null;
  }
  applyOwnership();
  return true;
}
