import { G, dayOf } from './state.js';
import { CATALOG, startFleet, applyOwnership, isMachine } from './machines.js';
import { generateOffers } from './contracts.js';
import { CROPS, S_STUB, S_SOWN, S_RIPE, S_NONE } from './crops.js';
import { FIELDS, refreshField, flushFields, drawSigns, countFields, applyStart } from '../world/fields.js';
import {
  vehicles, tools, addVehicle, addTool, clearFleet, attachTool, setHeader, firstOf, IMPL_ORDER, VEHICLE_TYPES, isToolKey,
} from '../vehicles/vehicles.js';
import { bales, setBales, flushBales } from '../world/bales.js';
import { serializeForest, loadForest } from '../world/forest.js';
import { MAP_DEFAULTS } from '../world/layout.js';
import { emptyFarm } from './farm.js';
import { serializeHelper, restoreHelper } from './helpers.js';
import { emptyStats, loadStats, loadGoals, GOALS, progressOf } from './goals.js';

const KEY = 'zlate-lany-v1';
// 1 = first release, 2 = grain trailer, 3 = bonus bits, straw, bales, combine header.
// Version 3 saves may hold 2 or 3 vehicles (the beet harvester came later); a missing one starts at home.
// 4 = economy: owned/leased machines, condition, fuel, loan, contracts. Older saves keep every machine.
// 5 = fleet: every machine and implement is a piece with an id (fleet, tools); older saves are converted.
// Older saves still load; missing data starts empty.
const VERSION = 5;

const b64 = {
  enc(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); },
  dec(str) { const s = atob(str), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; },
};

function stageOf(f, i) {
  const s = f.state[i];
  if (f.meadow) return s === S_RIPE ? 4 : 0;
  if (s === S_RIPE) return 4;
  if (s === S_SOWN) return Math.min(3, Math.floor((f.growth[i] / CROPS[f.crop[i]].hours) * 4));
  return 0;
}

function afterLoad() {
  FIELDS.forEach(refreshField);
  flushFields(); flushBales(); drawSigns(); countFields();
}

export function newGame() {
  G.money = 150000; G.gameMin = 8 * 60; G.tsIdx = 0;
  FIELDS.forEach(applyStart); // ripe wheat on field 1, the rest as laid out in FIELD_DEFS
  setBales([]);
  G.loan = 0;
  G.contracts = { offers: [], active: null };
  G.lastDay = dayOf(G.gameMin);
  G.farm = emptyFarm();
  G.stats = emptyStats(); G.goals = [];
  loadForest(null);
  startFleet();
  G.active = firstOf('combine');
  applyOwnership();
  afterLoad();
  generateOffers();
}

const r2 = x => Math.round(x * 100) / 100;
export function serialize() {
  return {
    v: VERSION, money: G.money, gameMin: G.gameMin, tsIdx: G.tsIdx, active: G.active.id,
    fields: FIELDS.map(f => ({
      id: f.id, x0: f.x0, z0: f.z0, owned: f.owned, state: b64.enc(f.state), crop: b64.enc(f.crop), dir: b64.enc(f.dir),
      growth: b64.enc(new Uint8Array(f.growth.buffer)), bonus: b64.enc(f.bonus), straw: b64.enc(f.straw),
    })),
    fleet: vehicles.map(v => ({
      id: v.id, type: v.type, model: v.model, own: v.own, cond: v.cond, slot: v.slot, x: r2(v.x), z: r2(v.z), h: v.h, fuel: v.fuel, tool: v.tool?.id ?? null,
      tank: v.harvester ? v.tank : undefined, seedCrop: v.seedCrop, baleAcc: v.baleAcc, hayAcc: v.hayAcc || 0, header: v.header, logs: v.logs, helper: serializeHelper(v),
    })),
    tools: tools.map(t => ({
      id: t.id, key: t.key, model: t.model, own: t.own, cond: t.cond, slot: t.slot,
      ...(t.key === 'trailer' ? { x: r2(t.x), z: r2(t.z), h: t.h, tank: t.tank, bales: t.bales, hay: t.hay || 0 } : {}),
      ...(t.key === 'watertank' ? { water: t.water, milk: !!t.milk } : {}),
    })),
    loan: G.loan, machines: G.machines, cond: G.cond, contracts: G.contracts, lastDay: G.lastDay,
    farm: G.farm, stats: G.stats, goals: G.goals, forest: serializeForest(),
    bales: bales.map(b => ({ x: +b.x.toFixed(2), z: +b.z.toFixed(2), h: +b.h.toFixed(3), hay: b.hay ? 1 : 0 })),
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
  if (!fleet.some(e => e.type === 'tractor')) fleet.unshift({ id: 'tractor-new', type: 'tractor', own: 'own', fresh: true });
  // the old engine upgrade (50 km/h): its tractors become the 50 km/h Case IH Puma 185
  if (d.machines?.upTractor) for (const e of fleet) if (e.type === 'tractor' && !e.model) e.model = 'case-puma-185';
  // the old bigger grain tank (13 000 l): its combines become the Case IH Axial-Flow 7250 (12 300 l)
  if (d.machines?.upCombine) for (const e of fleet) if (e.type === 'combine' && !e.model) e.model = 'caseih-7250';
  return { fleet, tools: toolList, active: src.active };
}

/** Validates everything first and only then touches the game, so a bad file never half-loads. */
export function applySave(d) {
  if (!d || ![1, 2, 3, 4, VERSION].includes(d.v) || !Array.isArray(d.fields) || !Array.isArray(d.v >= 5 ? d.fleet : d.veh)) return false;
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
    };
    const sized = ['state', 'crop', 'dir', 'bonus', 'straw'].every(key => out[key].length === f.n) && out.growth.length === f.n * 4;
    if (!sized) { decoded.set(f, { owned: out.owned, fresh: true }); moved.add(f.id); return; }
    for (let i = 0; i < f.n; i++) if ((out.state[i] > S_RIPE && out.state[i] !== S_NONE) || out.crop[i] >= CROPS.length) throw new Error('bad cell');
    decoded.set(f, out);
  });
  const plan = readFleet(d); // throws on a broken fleet before anything changed
  G.money = +d.money || 0; G.gameMin = +d.gameMin || 480; G.tsIdx = d.tsIdx | 0;
  for (const f of FIELDS) {
    const s = decoded.get(f);
    if (!s || s.fresh) { applyStart(f); if (s) f.owned = s.owned; continue; } // new or resized field
    f.owned = s.owned; f.state.set(s.state); f.crop.set(s.crop); f.dir.set(s.dir); f.bonus.set(s.bonus); f.straw.set(s.straw);
    f.growth.set(new Float32Array(s.growth.buffer));
    for (let i = 0; i < f.n; i++) f.stage[i] = stageOf(f, i);
  }
  setBales(d.bales);
  G.machines = {}; G.cond = {};
  for (const c of CATALOG) {
    if (isMachine(c.key)) continue;
    const m = d.v >= 4 && d.machines ? d.machines[c.key] : 'own'; // saves from before the shop kept everything
    G.machines[c.key] = m === 'own' || m === 'lease' ? m : null;
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
  loadFleet(plan);
  G.lastDay = Number.isFinite(d.lastDay) ? d.lastDay : dayOf(G.gameMin);
  const farm = emptyFarm();
  for (const k in farm) if (Number.isFinite(farm[k]) && Number.isFinite(d.farm?.[k])) farm[k] = Math.max(0, d.farm[k]);
  for (const k in farm.mix) if (Number.isFinite(d.farm?.mix?.[k])) farm.mix[k] = Math.max(0, d.farm.mix[k]);
  if (!d.farm?.mix) farm.mix.grain = farm.cowFeed; // older saves: count what is there as grain
  G.farm = farm;
  loadForest(d.forest);
  G.active = vehicles.find(v => v.id === plan.active) || firstOf('combine') || vehicles[0];
  applyOwnership();
  afterLoad();
  if (!G.contracts.active && !G.contracts.offers.length) generateOffers();
  // helpers carry on where they were (after ownership and contracts are known)
  // a helper on a field the map editor moved or resized would follow the old path, so he goes home instead
  for (const e of plan.fleet) { const v = vehicles.find(x => x.id === e.id); if (v && !moved.has(e.helper?.field)) restoreHelper(v, e.helper); }
  if (G.active.helper) G.active = vehicles.find(v => !v.helper) || G.active;
  G.stats = loadStats(d.stats);
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
    if (t.key === 'trailer') {
      const k = e.tank;
      t.tank = { crop: k ? k.crop | 0 : -1, amount: k ? Math.max(0, +k.amount || 0) : 0, cap: t.tank.cap };
      if (t.tank.amount <= 0) t.tank.crop = -1;
      t.bales = Math.min(t.baleCap, Math.max(0, e.bales | 0));
      t.hay = Math.min(t.bales, Math.max(0, e.hay | 0));
      if (Number.isFinite(e.x) && Number.isFinite(e.z)) { t.x = e.x; t.z = e.z; t.h = num(e.h, 0); }
    }
    if (t.key === 'watertank') { t.water = Math.max(0, Math.min(t.waterCap, +e.water || 0)); t.milk = !!e.milk && t.water > 0; }
  }
  for (const e of plan.fleet) {
    const v = addVehicle(e.type, { id: e.id, model: e.model, own: e.own, cond: clamp01(e.cond), slot: Number.isInteger(e.slot) ? e.slot : undefined });
    if (e.fresh) continue; // missing in an old save: starts at home
    Object.assign(v, { x: num(+e.x, v.x), z: num(+e.z, v.z), h: num(+e.h, 0), seedCrop: (e.seedCrop | 0) % CROPS.length, baleAcc: e.baleAcc | 0, hayAcc: e.hayAcc | 0 });
    v.fuel = Number.isFinite(e.fuel) ? Math.max(0, Math.min(v.fuelCap, e.fuel)) : v.fuelCap;
    if (e.tank && v.harvester) v.tank = { crop: e.tank.crop | 0, amount: Math.max(0, +e.tank.amount || 0), cap: v.tank.cap };
    if (v.type === 'forest') v.logs = Math.max(0, Math.min(v.logCap, +e.logs || 0));
    if (v.type === 'combine') setHeader(v, e.header === 'corn' ? 'corn' : 'grain');
    const t = e.tool && tools.find(x => x.id === e.tool && !x.on);
    if (t && v.type === 'tractor') {
      const pos = t.key === 'trailer' ? { x: t.x, z: t.z, h: t.h } : null;
      attachTool(v, t);
      if (pos && Math.hypot(pos.x - t.x, pos.z - t.z) < 8) Object.assign(t, pos); // keep the trailer's saved angle
    }
  }
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
