import { G, dayOf } from './state.js';
import { CATALOG, startFleet, applyOwnership, isMachine } from './machines.js';
import { generateOffers } from './contracts.js';
import { CROPS, S_STUB, S_SOWN, S_RIPE, S_NONE } from './crops.js';
import { FIELDS, refreshField, flushFields, drawSigns, countFields, applyStart } from '../world/fields.js';
import {
  vehicles, tools, addVehicle, addTool, clearFleet, attachTool, setHeader, standFree, firstOf, IMPL_ORDER, VEHICLE_TYPES, isToolKey, hitchCart, headerOn, frontLoaderOn,
} from '../vehicles/vehicles.js';
import { serializeHeaps, setHeaps, HEAP_WHAT } from '../world/heaps.js';
import { SUPPLIES } from './supply.js';
import { HELPER_MAX, MODES } from './balance.js';
import { loadBuilt, syncBuilt } from './build.js';
import { BALE_KINDS } from '../world/bales.js';
import { bales, setBales, flushBales } from '../world/bales.js';
import { serializeForest, loadForest } from '../world/forest.js';
import { MAP_DEFAULTS } from '../world/layout.js';
import { emptyFarm } from './farm.js';
import { WITHER_H } from './agro.js';
import { SPECIES } from './animals.js';
import { PALLET_MAT } from '../vehicles/models.js';
import { emptySilo, emptyDeliveries, generateDeliveries, loadSilo, loadDeliveries } from './silo.js';
import { person, startOnFoot } from '../world/person.js';
import { serializeHelper, restoreHelper } from './helpers.js';
import { emptyStats, loadStats, loadGoals, GOALS, progressOf } from './goals.js';
import { emptyFest } from './festival.js';

const KEY = 'zlate-lany-v1';
// 1 = first release, 2 = grain trailer, 3 = bonus bits, straw, bales, combine header.
// Version 3 saves may hold 2 or 3 vehicles (the beet harvester came later); a missing one starts at home.
// 4 = economy: owned/leased machines, condition, fuel, loan, contracts. Older saves keep every machine.
// 5 = fleet: every machine and implement is a piece with an id (fleet, tools); older saves are converted.
// Older saves still load; missing data starts empty.
// 6 = game modes: a farm may start without a tractor, so a save without one gets none added.
const VERSION = 6;

const b64 = {
  enc(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); },
  dec(str) { const s = atob(str), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; },
};

function stageOf(f, i) {
  const s = f.state[i];
  if (f.meadow) return s === S_RIPE ? 4 : 0;
  if (s === S_RIPE) return f.growth[i] >= CROPS[f.crop[i]].hours + WITHER_H ? 5 : 4;
  if (s === S_SOWN) return Math.min(3, Math.floor((f.growth[i] / CROPS[f.crop[i]].hours) * 4));
  return 0;
}

function afterLoad() {
  FIELDS.forEach(refreshField);
  flushFields(); flushBales(); drawSigns(); countFields();
}

/** A new game in mode (balance.js MODES): the new farmer gets fields 1 and 2 and the starting fleet, the others money and a car. */
export function newGame(mode = 'farmer') {
  const M = MODES[mode] ? mode : 'farmer';
  G.mode = M; G.money = MODES[M].money; G.gameMin = 8 * 60; G.tsIdx = 0;
  G.built = []; syncBuilt(); // no buildings of the last game: their cells are field again
  FIELDS.forEach(applyStart); // ripe wheat on field 1, the rest as laid out in FIELD_DEFS
  if (!MODES[M].fields) for (const f of FIELDS) f.owned = false;
  setBales([]);
  G.loan = 0;
  G.contracts = { offers: [], active: null };
  G.lastDay = dayOf(G.gameMin);
  G.farm = emptyFarm();
  G.silo = emptySilo(); G.deliveries = emptyDeliveries();
  G.stats = emptyStats(); G.goals = []; G.fest = emptyFest();
  G.supplyPick = 'seed'; setHeaps([]);
  loadForest(null);
  startFleet(MODES[M].fleet);
  G.active = firstOf('combine') || vehicles[0];
  startOnFoot();
  applyOwnership();
  afterLoad();
  generateOffers();
  generateDeliveries();
}

const r2 = x => Math.round(x * 100) / 100;
export function serialize() {
  return {
    v: VERSION, mode: G.mode, money: G.money, gameMin: G.gameMin, tsIdx: G.tsIdx, active: G.active.id,
    onFoot: G.onFoot, person: { x: r2(person.x), z: r2(person.z), h: r2(person.h) },
    fields: FIELDS.map(f => ({
      id: f.id, x0: f.x0, z0: f.z0, owned: f.owned, state: b64.enc(f.state), crop: b64.enc(f.crop), dir: b64.enc(f.dir),
      growth: b64.enc(new Uint8Array(f.growth.buffer)), bonus: b64.enc(f.bonus), straw: b64.enc(f.straw),
      weed: b64.enc(f.weed), lime: b64.enc(f.lime), prev: b64.enc(f.prev), dmg: b64.enc(f.dmg),
    })),
    fleet: vehicles.map(v => ({
      id: v.id, type: v.type, model: v.model, own: v.own, cond: v.cond, slot: v.slot, x: r2(v.x), z: r2(v.z), h: v.h, fuel: v.fuel, tool: v.tool?.id ?? null,
      tank: v.harvester ? v.tank : undefined, seedCrop: v.seedCrop, baleAcc: v.baleAcc, hayAcc: v.hayAcc || 0, grassAcc: v.grassAcc || 0, header: v.header, logs: v.logs, helper: serializeHelper(v), dirt: r2(v.dirtU?.value || 0),
      spreadLime: v.spreadLime ? 1 : undefined, fl: v.fl ? 1 : undefined, carry: v.ld?.carry || undefined, transport: v.transport ? 1 : undefined,
    })),
    tools: tools.map(t => ({
      id: t.id, key: t.key, model: t.model, own: t.own, cond: t.cond, slot: t.slot, dirt: r2(t.dirtU?.value || 0),
      x: r2(t.x), z: r2(t.z), h: t.h, // where it stands (a hitched implement: thrown away on loading, a trailer keeps its angle)
      ...(t.key === 'trailer' ? { tank: t.tank, bales: t.bales, hay: t.hay || 0, grass: t.grass || 0, silage: t.silage || 0, pallets: t.pallets, forage: t.forage, bagUsed: t.bagUsed } : {}),
      ...(t.fill ? { fill: { kind: t.fill.kind, amount: Math.round(t.fill.amount * 10) / 10 } } : {}),
      ...(t.key === 'livestock' ? { animals: t.animals, buyKind: t.buyKind } : {}),
      ...(t.key === 'manure' || t.key === 'slurry' ? { load: Math.round(t.load) } : {}),
      ...(t.key === 'watertank' ? { water: t.water, milk: !!t.milk } : {}),
    })),
    loan: G.loan, machines: G.machines, cond: G.cond, contracts: G.contracts, lastDay: G.lastDay,
    farm: G.farm, stats: G.stats, goals: G.goals, forest: serializeForest(), fest: G.fest, silo: G.silo, deliveries: G.deliveries,
    bales: bales.map(b => ({ x: +b.x.toFixed(2), z: +b.z.toFixed(2), h: +b.h.toFixed(3), hay: b.hay ? 1 : 0, kind: b.kind })),
    heaps: serializeHeaps(), supplyPick: G.supplyPick, built: G.built,
  };
}

const OLD_ORDER = ['tractor', 'combine', 'beet', 'forest', 'jeep']; // vehicles by position in saves before version 5
/** Saves before version 5: one piece of everything that was owned or leased, with its old state. */
function oldFleet(d) {
  const st = key => {
    if (d.v < 4 || !d.machines) return 'own'; // saves from before the shop kept every machine
    const m = d.machines[key];
    return key === 'tractor' ? (m === 'lease' ? 'lease' : 'own') : m === 'own' || m === 'lease' ? m : null;
  };
  const cond = key => d.cond?.[key];
  const fleet = [], toolList = [];
  for (const key of IMPL_ORDER) {
    if (!st(key)) continue;
    const t = { id: key + '-old', key, own: st(key), cond: cond(key) };
    if (key === 'trailer') Object.assign(t, { tank: d.trailer?.tank, bales: d.trailer?.bales, hay: d.trailer?.hay });
    if (key === 'watertank') Object.assign(t, { water: d.water, milk: d.tankMilk });
    toolList.push(t);
  }
  OLD_ORDER.forEach((type, k) => {
    if (!st(type)) return;
    const s = d.veh[k] || {};
    const tool = type === 'tractor' ? (toolList.find(t => t.key === s.impl) || toolList[0])?.id ?? null : null;
    fleet.push({ ...s, id: type + '-old', type, own: st(type), cond: cond(type), tool, logs: type === 'forest' ? d.logs : 0, fresh: !d.veh[k] });
  });
  const active = fleet.find(e => e.type === d.active)?.id;
  return { fleet, tools: toolList, active };
}

/** The pieces of a save, checked: known types, unique ids, at least one tractor. */
function readFleet(d) {
  const src = d.v >= 5 ? { fleet: d.fleet, tools: d.tools, active: d.active } : oldFleet(d);
  if (!Array.isArray(src.fleet) || !Array.isArray(src.tools)) throw new Error('bad fleet');
  const ids = new Set(), uniq = e => typeof e.id === 'string' && !ids.has(e.id) && ids.add(e.id);
  const fleet = src.fleet.filter(e => e && VEHICLE_TYPES.includes(e.type) && uniq(e));
  const toolList = src.tools.filter(e => e && isToolKey(e.key) && uniq(e));
  if (d.v < 6 && !fleet.some(e => e.type === 'tractor')) fleet.unshift({ id: 'tractor-new', type: 'tractor', own: 'own', fresh: true });
  if (!fleet.length) fleet.push({ id: 'jeep-new', type: 'jeep', own: 'own', fresh: true }); // something to sit in
  // the old engine upgrade (50 km/h): its tractors become the 50 km/h Case IH Puma 185
  if (d.machines?.upTractor) for (const e of fleet) if (e.type === 'tractor' && !e.model) e.model = 'case-puma-185';
  // the old bigger grain tank (13 000 l): its combines become the Case IH Axial-Flow 7250 (12 300 l)
  if (d.machines?.upCombine) for (const e of fleet) if (e.type === 'combine' && !e.model) e.model = 'caseih-7250';
  // the old wide cultivator (6,3 m) and trailer extension (22 000 l) became models of their own
  if (d.machines?.upCultivator) for (const e of toolList) if (e.key === 'cultivator' && !e.model) e.model = 'horsch-terrano-6';
  if (d.machines?.upTrailer) for (const e of toolList) if (e.key === 'trailer' && !e.model) e.model = 'fliegl-22';
  return { fleet, tools: toolList, active: src.active };
}

/** Validates everything first and only then touches the game, so a bad file never half-loads. */
export function applySave(d) {
  if (!d || ![1, 2, 3, 4, 5, VERSION].includes(d.v) || !Array.isArray(d.fields) || !Array.isArray(d.v >= 5 ? d.fleet : d.veh)) return false;
  // Fields are matched by number (saves made before the map editor: by position in the original map).
  // A field the map editor resized starts fresh but stays bought; a deleted field is skipped.
  const decoded = new Map(), moved = new Set();
  d.fields.forEach((s, k) => {
    const id = Number.isFinite(s?.id) ? s.id : MAP_DEFAULTS.fields[k]?.id;
    const f = FIELDS.find(g => g.id === id);
    if (!f || decoded.has(f)) return;
    if ((Number.isFinite(s.x0) && s.x0 !== f.x0) || (Number.isFinite(s.z0) && s.z0 !== f.z0)) moved.add(f.id);
    const out = {
      owned: !!s.owned, state: b64.dec(s.state), crop: b64.dec(s.crop), dir: b64.dec(s.dir), growth: b64.dec(s.growth),
      bonus: s.bonus ? b64.dec(s.bonus) : new Uint8Array(f.n), straw: s.straw ? b64.dec(s.straw) : new Uint8Array(f.n),
      // saves from before field work had weeds, lime and the crop before: clean, limed, no rotation yet
      weed: s.weed ? b64.dec(s.weed) : new Uint8Array(f.n), lime: s.lime ? b64.dec(s.lime) : new Uint8Array(f.n), prev: s.prev ? b64.dec(s.prev) : new Uint8Array(f.n),
      dmg: s.dmg ? b64.dec(s.dmg) : new Uint8Array(f.n), // saves from before the weather did damage: none
    };
    const sized = ['state', 'crop', 'dir', 'bonus', 'straw', 'weed', 'lime', 'prev', 'dmg'].every(key => out[key].length === f.n) && out.growth.length === f.n * 4;
    if (!sized) { decoded.set(f, { owned: out.owned, fresh: true }); moved.add(f.id); return; }
    for (let i = 0; i < f.n; i++) if ((out.state[i] > S_RIPE && out.state[i] !== S_NONE) || out.crop[i] >= CROPS.length) throw new Error('bad cell');
    decoded.set(f, out);
  });
  const plan = readFleet(d); // throws on a broken fleet before anything changed
  G.built = []; syncBuilt(); // the buildings of the game so far go before the fields are set
  G.money = +d.money || 0; G.gameMin = +d.gameMin || 480; G.tsIdx = d.tsIdx | 0;
  G.mode = MODES[d.mode] ? d.mode : 'farmer';
  for (const f of FIELDS) {
    const s = decoded.get(f);
    if (!s || s.fresh) { applyStart(f); if (s) f.owned = s.owned; continue; } // new or resized field
    f.owned = s.owned; f.state.set(s.state); f.crop.set(s.crop); f.dir.set(s.dir); f.bonus.set(s.bonus); f.straw.set(s.straw);
    f.weed.set(s.weed); f.lime.set(s.lime); f.prev.set(s.prev); f.dmg.set(s.dmg);
    f.growth.set(new Float32Array(s.growth.buffer));
    for (let i = 0; i < f.n; i++) f.stage[i] = stageOf(f, i);
  }
  setBales(d.bales);
  setHeaps(d.heaps);
  G.built = loadBuilt(d.built); syncBuilt();
  G.supplyPick = SUPPLIES[d.supplyPick] ? d.supplyPick : 'seed';
  G.machines = {}; G.cond = {};
  for (const c of CATALOG) {
    if (isMachine(c.key)) continue;
    const m = d.v >= 4 && d.machines ? d.machines[c.key] : 'own'; // saves from before the shop kept everything
    G.machines[c.key] = m === 'own' || m === 'lease' || (m === 'borrow' && d.contracts?.active?.borrowed?.includes(c.key)) ? m : null;
    G.cond[c.key] = Math.max(0, Math.min(1, Number.isFinite(d.cond?.[c.key]) ? d.cond[c.key] : 1));
  }
  if (d.v >= 4 && d.machines) {
    G.loan = Math.max(0, +d.loan || 0);
    const ok = c => c && Number.isFinite(c.field) && Number.isFinite(c.target) && FIELDS.some(f => f.id === c.field); // the field may have been deleted in the map editor
    G.contracts = { offers: (d.contracts?.offers || []).filter(ok), active: ok(d.contracts?.active) ? d.contracts.active : null };
  } else {
    G.loan = 0;
    G.contracts = { offers: [], active: null };
  }
  // a lent machine without its contract (an odd file) goes back to the neighbour
  const lent = new Set(G.contracts.active?.borrowed || []);
  plan.fleet = plan.fleet.filter(e => e.own !== 'borrow' || lent.has(e.id));
  plan.tools = plan.tools.filter(e => e.own !== 'borrow' || lent.has(e.id));
  loadFleet(plan);
  G.lastDay = Number.isFinite(d.lastDay) ? d.lastDay : dayOf(G.gameMin);
  const farm = emptyFarm();
  for (const k in farm) if (Number.isFinite(farm[k]) && Number.isFinite(d.farm?.[k])) farm[k] = Math.max(0, d.farm[k]);
  for (const k in farm.mix) if (Number.isFinite(d.farm?.mix?.[k])) farm.mix[k] = Math.max(0, d.farm.mix[k]);
  if (!d.farm?.mix) farm.mix.grain = farm.cowFeed; // older saves: count what is there as grain
  // herds (older saves: the starting herd of every owned building, set up on first use)
  for (const k in d.farm?.herd || {}) {
    const h = d.farm.herd[k];
    if (h && Number.isFinite(h.n)) farm.herd[k] = { n: Math.max(0, Math.round(h.n)), health: Math.max(0, Math.min(1, +h.health || 0)), breed: +h.breed || 0, sick: +h.sick || 0 };
  }
  const bk = d.farm?.bunker; // the silage bunker (forage.js); older saves: empty
  if (bk) Object.assign(farm.bunker, { chaff: Math.max(0, +bk.chaff || 0), packed: Math.max(0, Math.min(1, +bk.packed || 0)), covered: !!bk.covered && bk.chaff > 0, ferment: Math.max(0, +bk.ferment || 0), silage: Math.max(0, +bk.silage || 0) });
  G.farm = farm;
  G.silo = loadSilo(d.silo); G.deliveries = loadDeliveries(d.deliveries);
  if (!G.deliveries.offers.length) generateDeliveries();
  loadForest(d.forest);
  G.active = vehicles.find(v => v.id === plan.active) || firstOf('combine') || vehicles[0];
  applyOwnership();
  afterLoad();
  if (!G.contracts.active && !G.contracts.offers.length) generateOffers();
  // helpers carry on where they were (after ownership and contracts are known)
  // a helper on a field the map editor moved or resized would follow the old path, so he goes home instead
  for (const e of plan.fleet) { const v = vehicles.find(x => x.id === e.id); if (v && !moved.has(e.helper?.field) && vehicles.filter(x => x.helper).length < HELPER_MAX) restoreHelper(v, e.helper); }
  if (G.active.helper) G.active = vehicles.find(v => !v.helper) || G.active;
  // on foot where he was (older saves: in the machine he drove)
  G.onFoot = !!d.onFoot && Number.isFinite(d.person?.x) && Number.isFinite(d.person?.z);
  if (G.onFoot) Object.assign(person, { x: d.person.x, z: d.person.z, h: num(d.person.h, 0), speed: 0 });
  G.stats = loadStats(d.stats);
  { const f = d.fest, e = emptyFest(); G.fest = f && Number.isFinite(f.year) ? { year: f.year, base: num(f.base, 0), contest: !!f.contest, race: !!f.race, best: Number.isFinite(f.best) ? f.best : null } : e; }
  // saves from before goals existed: whatever is already achieved counts as done, without a reward
  G.goals = d.stats ? loadGoals(d.goals) : GOALS.filter(g => progressOf(g) >= 1).map(g => g.id);
  return true;
}

const num = (x, d) => (Number.isFinite(x) ? x : d);
const clamp01 = x => Math.max(0, Math.min(1, num(x, 1)));
/** Builds the fleet from a checked plan (readFleet): pieces, loads, positions, hitched implements, headers. */
function loadFleet(plan) {
  clearFleet();
  for (const e of plan.tools) {
    const t = addTool(e.key, { id: e.id, model: e.model, own: e.own, cond: clamp01(e.cond), slot: Number.isInteger(e.slot) ? e.slot : undefined });
    t.dirtU.value = Number.isFinite(e.dirt) ? clamp01(e.dirt) : 0;
    if (t.key === 'trailer') {
      const k = e.tank;
      t.tank = { crop: k ? k.crop | 0 : -1, amount: k ? Math.max(0, +k.amount || 0) : 0, cap: t.tank.cap };
      if (t.tank.amount <= 0) t.tank.crop = -1;
      t.bales = Math.min(t.baleCap, Math.max(0, e.bales | 0));
      t.hay = Math.min(t.bales, Math.max(0, e.hay | 0));
      t.grass = Math.min(t.bales - t.hay, Math.max(0, e.grass | 0));
      t.silage = Math.min(t.bales - t.hay - t.grass, Math.max(0, e.silage | 0));
      const fg = e.forage; // chaff or silage (forage.js); never together with grain or bales
      t.forage = fg && (fg.kind === 'chaff' || fg.kind === 'silage') && fg.l > 0 && !t.tank.amount && !t.bales ? { kind: fg.kind, l: Math.min(t.tank.cap, +fg.l) } : null;
      t.pallets = (Array.isArray(e.pallets) ? e.pallets : []).filter(p => p in PALLET_MAT).slice(0, t.baleCap - t.bales);
      t.bagUsed = {};
      for (const k in SUPPLIES) if (Number.isFinite(e.bagUsed?.[k])) t.bagUsed[k] = Math.max(0, e.bagUsed[k]);
    }
    // hoppers: older saves from before seed and fertiliser came in bags start full
    if (t.fill) t.fill = e.fill && SUPPLIES[e.fill.kind] && Number.isFinite(e.fill.amount) ? { kind: e.fill.kind, amount: Math.max(0, Math.min(t.fillCap, e.fill.amount)) } : { kind: t.fill.kind, amount: t.fillCap };
    if (t.key === 'livestock' && e.animals && SPECIES.includes(e.animals.kind) && e.animals.n > 0) {
      t.animals = { kind: e.animals.kind, n: Math.round(e.animals.n), health: Math.max(0, Math.min(1, +e.animals.health || 1)) };
    }
    if (t.key === 'livestock' && SPECIES.includes(e.buyKind)) t.buyKind = e.buyKind;
    if ((t.key === 'manure' || t.key === 'slurry') && Number.isFinite(e.load)) t.load = Math.max(0, Math.min(t.loadCap, e.load));
    if (Number.isFinite(e.x) && Number.isFinite(e.z)) { // left standing where it was unhitched
      t.x = e.x; t.z = e.z; t.h = num(e.h, 0);
      if (!t.trailed) standFree(t);
    }
    if (t.key === 'watertank') { t.water = Math.max(0, Math.min(t.waterCap, +e.water || 0)); t.milk = !!e.milk && t.water > 0; }
  }
  for (const e of plan.fleet) {
    const v = addVehicle(e.type, { id: e.id, model: e.model, own: e.own, cond: clamp01(e.cond), slot: Number.isInteger(e.slot) ? e.slot : undefined });
    v.dirtU.value = Number.isFinite(e.dirt) ? clamp01(e.dirt) : 0;
    if (e.fresh) continue; // missing in an old save: starts at home
    Object.assign(v, { x: num(+e.x, v.x), z: num(+e.z, v.z), h: num(+e.h, 0), seedCrop: (e.seedCrop | 0) % CROPS.length, baleAcc: e.baleAcc | 0, hayAcc: e.hayAcc | 0, grassAcc: e.grassAcc | 0 });
    v.fuel = Number.isFinite(e.fuel) ? Math.max(0, Math.min(v.fuelCap, e.fuel)) : v.fuelCap;
    if (e.tank && v.harvester) v.tank = { crop: v.type === 'chopper' ? -1 : e.tank.crop | 0, amount: Math.min(v.tank.cap * 1.5, Math.max(0, +e.tank.amount || 0)), cap: v.tank.cap };
    if (v.type === 'forest') v.logs = Math.max(0, Math.min(v.logCap, +e.logs || 0));
    if (v.type === 'combine') setHeader(v, e.header === 'corn' ? 'corn' : 'grain');
    v.spreadLime = !!e.spreadLime;
    if (e.fl && v.type === 'tractor' && G.machines.frontLoader && !vehicles.some(o => o.fl)) frontLoaderOn(v);
    if (v.ld && e.carry) v.ld.carry = carryIn(e.carry);
    const t = e.tool && tools.find(x => x.id === e.tool && !x.on);
    if (t && v.type === 'combine' && t.key === 'headercart') {
      const pos = { x: t.x, z: t.z, h: t.h };
      hitchCart(v, t);
      if (Math.hypot(pos.x - t.x, pos.z - t.z) < 8) Object.assign(t, pos);
      if (e.transport && v.toolW <= t.maxHeader + 0.05) headerOn(v, t);
    }
    if (t && v.type === 'tractor' && t.key !== 'headercart') {
      const pos = t.trailed ? { x: t.x, z: t.z, h: t.h } : null;
      attachTool(v, t);
      if (pos && Math.hypot(pos.x - t.x, pos.z - t.z) < 8) Object.assign(t, pos); // keep the trailer's saved angle
    }
  }
}

/** A loader's load from a save, checked: bales, a pallet or a bucket of something; anything odd is dropped. */
function carryIn(c) {
  if (c?.kind === 'bale' && Array.isArray(c.bales)) { const b = c.bales.filter(k => BALE_KINDS.includes(k)).slice(0, 3); return b.length ? { kind: 'bale', bales: b } : null; }
  if (c?.kind === 'pallet' && c.p in PALLET_MAT) return { kind: 'pallet', p: c.p, ...(Number.isFinite(c.left) ? { left: Math.max(0, c.left) } : {}) };
  if (c?.kind === 'heap' && HEAP_WHAT.includes(c.what) && c.l > 0) {
    const crop = c.what === 'crop' ? c.crop | 0 : -1;
    return crop < CROPS.length ? { kind: 'heap', what: c.what, crop, l: Math.min(5000, +c.l) } : null;
  }
  return null;
}

export function saveLocal() {
  try { localStorage.setItem(KEY, JSON.stringify(serialize())); } catch { /* storage unavailable */ }
}
export function loadLocal() {
  try { const raw = localStorage.getItem(KEY); return raw ? applySave(JSON.parse(raw)) : false; } catch { return false; }
}

export function exportFile() {
  const day = Math.floor(G.gameMin / 1440) + 1;
  const blob = new Blob([JSON.stringify(serialize())], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `zlate-lany-den-${day}.json`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function importFile(file) {
  let ok = false;
  try { ok = applySave(JSON.parse(await file.text())); } catch { ok = false; }
  if (ok) saveLocal();
  return ok;
}
