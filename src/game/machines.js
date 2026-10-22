import { G } from './state.js';
import {
  vehicles, tools, VEHICLE_TYPES, isToolKey, firstOf, addVehicle, addTool, removeVehicle, removeTool, clearFleet, attachTool, setHeader,
} from '../vehicles/vehicles.js';
import { COWS, HENS, SHEEP, PIGS, MIXER, GREENHOUSE } from './balance.js';
import { MODELS, MODEL, START_MODEL, modelName } from './catalog.js';
import { trailerBales } from '../vehicles/models.js';

/** Shop groups of the machine kinds, in shop order. */
const GROUP = {
  tractor: 'Traktory', combine: 'Sklízecí stroje', beet: 'Sklízecí stroje', cultivator: 'Nářadí', plough: 'Nářadí', seeder: 'Nářadí', spreader: 'Nářadí',
  baler: 'Nářadí', mower: 'Nářadí', sprayer: 'Nářadí', roller: 'Nářadí', mulcher: 'Nářadí', manure: 'Nářadí', slurry: 'Nářadí', livestock: 'Nářadí', trailer: 'Nářadí', watertank: 'Nářadí', jeep: 'Osobní auta', forest: 'Lesnictví',
};
const n = x => x.toLocaleString('cs-CZ');
const specs = m => (m.kind === 'tractor' ? ' ' + m.hp + ' koní, až ' + m.kmh + ' km/h, nádrž ' + m.fuel + ' l.'
  : m.kind === 'combine' ? ' Lišta ' + String(m.header).replace('.', ',') + ' m, zásobník ' + n(m.tank) + ' l, vykládání ' + n(m.unload) + ' l/s.'
  : m.kind === 'beet' ? ' ' + m.rows + ' řádků, zásobník ' + n(m.tank) + ' l.'
  : m.kind === 'forest' ? ' Uveze ' + m.logs + ' m³ dřeva.'
  : m.kind === 'jeep' ? ' Až ' + m.kmh + ' km/h, mimo cesty ' + Math.round(m.kmh * m.offroad) + ' km/h.'
  : m.kind === 'trailer' ? ' ' + n(m.cap) + ' l zrna nebo ' + trailerBales(m.look.len || 5.6) + ' balíků, potřebuje ' + m.hp + ' koní.'
  : m.kind === 'watertank' ? ' ' + n(m.cap) + ' l, potřebuje ' + m.hp + ' koní.'
  : m.kind === 'manure' || m.kind === 'slurry' ? ' ' + n(m.cap) + ' l, záběr ' + m.width + ' m, potřebuje ' + m.hp + ' koní.'
  : m.kind === 'livestock' ? ' Potřebuje ' + m.hp + ' koní.'
  : m.hp ? ' Záběr ' + String(m.width).replace('.', ',') + ' m, potřebuje ' + m.hp + ' koní.' : '');
const modelRows = kinds => MODELS.filter(m => kinds.includes(m.kind)).map(m => ({ key: m.id, name: modelName(m), kind: GROUP[m.kind], price: m.price, desc: m.desc + specs(m), machine: m.kind }));

/**
 * Everything the player can own. Machines and implements are models (catalog.js; key = model id),
 * bought as pieces into the fleet (vehicles.js), each owned or leased with its own condition.
 * cornHeader is the combine's row header. Buildings (noLease) can only be bought;
 * they and the header live in G.machines / G.cond by key. Prices in Kč.
 */
export const CATALOG = [
  ...modelRows(['tractor', 'combine', 'beet']),
  { key: 'cornHeader', name: 'Řádkový adaptér', kind: 'Adaptéry kombajnu', price: 320000, desc: 'Na kukuřici a slunečnici. Nasazuje se v kůlně.' },
  ...modelRows(['cultivator', 'plough', 'seeder', 'spreader', 'sprayer', 'roller', 'mulcher', 'baler', 'mower', 'trailer', 'watertank', 'manure', 'slurry', 'livestock', 'jeep', 'forest']),
  { key: 'cows', name: 'Kravín s 10 kravami', kind: 'Budovy', price: COWS.price, noLease: true, desc: 'Krávy žerou kukuřici, ječmen, cukrovku nebo balíky sena a dávají mléko. Mléko se prodá samo o půlnoci, nebo ho cisternou odvezeš do mlékárny v městečku za ' + COWS.dairyPrice + ' Kč/l místo ' + COWS.milkPrice + '.' },
  { key: 'mixer', name: 'Míchací krmný vůz', kind: 'Budovy', price: MIXER.price, noLease: true, desc: 'Stojí u kravína a míchá krmnou směs. Když je v krmelci zrno, seno i cukrovka (každé aspoň ' + Math.round(MIXER.minShare * 100) + ' %), dávají krávy o ' + Math.round(MIXER.bonus * 100) + ' % víc mléka. Potřebuje kravín.' },
  { key: 'sheep', name: 'Ovčín s 16 ovcemi', kind: 'Budovy', price: SHEEP.price, noLease: true, desc: 'Ovce žerou balíky sena z luk a dávají vlnu. Vlna se prodá o půlnoci.' },
  { key: 'pigs', name: 'Vepřín s 12 prasaty', kind: 'Budovy', price: PIGS.price, noLease: true, desc: 'Prasata žerou kukuřici nebo ječmen. Vepřové se prodá o půlnoci.' },
  { key: 'hens', name: 'Kurník se 40 slepicemi', kind: 'Budovy', price: HENS.price, noLease: true, desc: 'Slepice žerou pšenici nebo ječmen a snášejí vejce. Vejce se prodají o půlnoci.' },
  { key: 'greenhouse1', name: 'Skleník s rajčaty', kind: 'Budovy', price: GREENHOUSE.price, noLease: true, desc: 'Pěstuje rajčata, potřebuje vodu z cisterny. Rajčata se prodají o půlnoci.' },
  { key: 'greenhouse2', name: 'Druhý skleník', kind: 'Budovy', price: GREENHOUSE.price, noLease: true, desc: 'Zdvojnásobí sklizeň rajčat i spotřebu vody.' },
];
/** Buildings have no wear. */
export const hasCondition = c => !c.noLease;
/** Called after every ownership change (the farmstead uses it to show its buildings). */
export const ownershipHooks = [];
export const byKey = Object.fromEntries(CATALOG.map(c => [c.key, c]));
export const START_OWNED = ['tractor', 'combine', 'cultivator', 'seeder', 'trailer'].map(k => START_MODEL[k]);

export const LEASE_UPFRONT = 0.05; // share of the price paid when leasing
export const LEASE_DAILY = 0.012; // share of the price charged every game day
const SELL_SHARE = 0.55; // resale value of a machine in new condition
const REPAIR_SHARE = 0.12; // full repair from 0 % costs this share of the price

/** A machine kind (tractor, combine, cultivator, …): has('tractor') asks for any piece of the kind. */
const isKind = key => VEHICLE_TYPES.includes(key) || isToolKey(key);
/** Is key a machine model or kind (pieces in the fleet) rather than a building, upgrade or header? */
export const isMachine = key => isKind(key) || !!MODEL[key];
/** The pieces of a kind or of a model in the fleet. */
export const piecesOf = key => (VEHICLE_TYPES.includes(key) ? vehicles.filter(v => v.type === key) : isToolKey(key) ? tools.filter(t => t.key === key)
  : [...vehicles, ...tools].filter(p => p.model === key));
const kindOf = p => p.type || p.key;
export const has = key => (isMachine(key) ? piecesOf(key).length > 0 : !!G.machines[key]);
/** 'own' | 'lease' | null: a machine's first piece, or a building, upgrade or header. */
export const status = key => (isMachine(key) ? piecesOf(key)[0]?.own ?? null : G.machines[key] || null);
/** Condition 0..1 of key (its first piece for machines). */
export const condOf = key => (isMachine(key) ? piecesOf(key)[0]?.cond ?? 1 : G.cond[key] ?? 1);
const priceOf = p => byKey[p.model].price;
/** What a piece fetches when sold, by its condition. */
export const sellValueOf = p => Math.round(priceOf(p) * SELL_SHARE * p.cond);
export const sellValue = key => (isMachine(key) ? sellValueOf(piecesOf(key)[0]) : Math.round(byKey[key].price * SELL_SHARE * (G.cond[key] ?? 1)));
export const leaseUpfront = key => Math.round(byKey[key].price * LEASE_UPFRONT);
export const leaseDaily = key => Math.round(byKey[key].price * LEASE_DAILY);
/** Full repair of piece p (machine or implement). */
export const repairCostOf = p => (p ? Math.round(priceOf(p) * REPAIR_SHARE * (1 - p.cond)) : 0);
export const dailyLeaseCost = () =>
  [...vehicles, ...tools].reduce((a, p) => a + (p.own === 'lease' ? leaseDaily(p.model) : 0), 0) +
  CATALOG.reduce((a, c) => a + (!isMachine(c.key) && G.machines[c.key] === 'lease' ? leaseDaily(c.key) : 0), 0);

/** A new game: the starting fleet (tractor with the cultivator, combine, seeder, trailer), no buildings. */
export function startFleet() {
  clearFleet();
  G.machines = {}; G.cond = {};
  for (const c of CATALOG) if (!isMachine(c.key)) { G.machines[c.key] = null; G.cond[c.key] = 1; }
  for (const id of START_OWNED) addPiece(id, 'own');
  attachTool(firstOf('tractor'), tools.find(t => t.key === 'cultivator'));
}

/** Shows or hides machine parts to match ownership and fixes anything that points at a missing piece. */
export function applyOwnership() {
  for (const v of vehicles) {
    if (v.type !== 'combine') continue;
    v.cornHdr.visible = has('cornHeader');
    if (!has('cornHeader') && v.header === 'corn') setHeader(v, 'grain');
  }
  if (!vehicles.includes(G.active)) G.active = firstOf('combine') || vehicles[0];
  ownershipHooks.forEach(f => f());
}

/** Why piece p cannot be sold or returned right now, or null. */
export function blockReasonOf(p) {
  const key = kindOf(p);
  if (key === 'tractor' && piecesOf(key).length < 2) return 'Bez traktoru by farma nefungovala.';
  if (G.active === p && !G.onFoot) return 'Právě v něm sedíš.';
  if (p.helper) return 'Pracuje na něm pomocník.';
  if (p.on?.helper) return 'Pracuje s ním pomocník.';
  if (p.on) return 'Je připojené k traktoru. Nejdřív ho odpoj (Q).';
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
/** Adds a new piece of model id to the fleet; an implement goes on a tractor that has none. */
function addPiece(id, own) {
  const kind = MODEL[id].kind;
  if (!isToolKey(kind)) return addVehicle(kind, { own, model: id });
  const t = addTool(kind, { own, model: id });
  // a tractor without a tool, standing on its place, takes the new one right away
  const v = vehicles.find(x => x.type === 'tractor' && !x.tool && !x.helper && Math.hypot(x.x - x.home[0], x.z - x.home[1]) < 3);
  if (v) attachTool(v, t);
  return t;
}
/** A kind stands for its start model (buy('tractor') buys a Brázda 140). */
const modelKey = key => (isKind(key) ? START_MODEL[key] : key);
export function buy(key) {
  key = modelKey(key);
  if ((!isMachine(key) && has(key)) || !pay(byKey[key].price)) return false;
  if (isMachine(key)) addPiece(key, 'own');
  else { G.machines[key] = 'own'; G.cond[key] = 1; }
  applyOwnership();
  return true;
}
export function lease(key) {
  key = modelKey(key);
  if ((!isMachine(key) && has(key)) || byKey[key].noLease || !pay(leaseUpfront(key))) return false;
  if (isMachine(key)) addPiece(key, 'lease');
  else { G.machines[key] = 'lease'; G.cond[key] = 1; }
  applyOwnership();
  return true;
}
/**
 * Why piece p cannot go as a trade-in now, or null. Like selling, except that the last tractor and
 * the machine you sit in may go: the new one takes their place.
 */
export function tradeBlock(p) {
  if (p.own !== 'own') return 'Pronajatý stroj se vrací, ne prodává.';
  const why = blockReasonOf(p);
  return why === 'Bez traktoru by farma nefungovala.' || why === 'Právě v něm sedíš.' ? null : why;
}
/** Buys model key and sells piece old in the same go: you pay the difference. The new piece takes over old's implement and your seat. */
export function buyWithTrade(key, old) {
  const c = byKey[key];
  if (!c || !old || tradeBlock(old) || G.money + sellValueOf(old) < c.price) return false;
  const wasActive = G.active === old, tool = old.tool;
  G.money += sellValueOf(old);
  (old.type ? removeVehicle : removeTool)(old);
  if (!buy(key)) return false;
  const p = piecesOf(key).pop();
  if (tool && p.type === 'tractor' && tools.includes(tool) && !tool.on) attachTool(p, tool);
  if (wasActive) G.active = p;
  applyOwnership();
  return true;
}

/** Sells piece p if owned, hands it back if leased. */
export function releasePiece(p) {
  if (!p || blockReasonOf(p)) return false;
  if (p.own === 'own') { G.money += sellValueOf(p); G.flashT = 0.4; }
  (p.type ? removeVehicle : removeTool)(p);
  applyOwnership();
  return true;
}
/** Sells an owned building, upgrade or header, or hands back a leased one (machines: their first piece). */
export function release(key) {
  if (!has(key) || blockReason(key)) return false;
  if (isMachine(key)) return releasePiece(piecesOf(key)[0]);
  if (G.machines[key] === 'own') { G.money += sellValue(key); G.flashT = 0.4; }
  G.machines[key] = null;
  applyOwnership();
  return true;
}
