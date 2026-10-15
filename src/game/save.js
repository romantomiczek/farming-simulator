import { G, dayOf } from './state.js';
import { CATALOG, resetMachines, applyOwnership } from './machines.js';
import { generateOffers } from './contracts.js';
import { CROPS, S_STUB, S_SOWN, S_RIPE } from './crops.js';
import { FIELDS, refreshField, flushFields, drawSigns, countFields, applyStart } from '../world/fields.js';
import { vehicles, combine, trailer, attachImpl, setHeader, sendHome, IMPL } from '../vehicles/vehicles.js';
import { bales, setBales, flushBales } from '../world/bales.js';
import { forester, IMPL as TOOLS } from '../vehicles/vehicles.js';
import { serializeForest, loadForest } from '../world/forest.js';
import { emptyFarm } from './farm.js';
import { serializeHelper, restoreHelper } from './helpers.js';
import { emptyStats, loadStats, loadGoals, GOALS, progressOf } from './goals.js';

const KEY = 'zlate-lany-v1';
// 1 = first release, 2 = grain trailer, 3 = bonus bits, straw, bales, combine header.
// Version 3 saves may hold 2 or 3 vehicles (the beet harvester came later); a missing one starts at home.
// 4 = economy: owned/leased machines, condition, fuel, loan, contracts. Older saves keep every machine.
// Older saves still load; missing data starts empty.
const VERSION = 4;

const b64 = {
  enc(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); },
  dec(str) { const s = atob(str), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; },
};

function stageOf(f, i) {
  const s = f.state[i];
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
  vehicles.forEach(v => { v.helper = null; sendHome(v); });
  Object.assign(vehicles[0], { seedCrop: 0, baleAcc: 0 });
  trailer.tank = { crop: -1, amount: 0, cap: 14000 };
  trailer.bales = 0;
  setBales([]);
  G.loan = 0;
  G.contracts = { offers: [], active: null };
  G.lastDay = dayOf(G.gameMin);
  G.farm = emptyFarm();
  G.stats = emptyStats(); G.goals = [];
  forester.logs = 0; forester.cutting = null; TOOLS.watertank.water = 0;
  loadForest(null);
  resetMachines(false);
  attachImpl('cultivator');
  setHeader('grain');
  G.active = combine;
  applyOwnership();
  afterLoad();
  generateOffers();
}

export function serialize() {
  return {
    v: VERSION, money: G.money, gameMin: G.gameMin, tsIdx: G.tsIdx, active: G.active.type,
    fields: FIELDS.map(f => ({
      owned: f.owned, state: b64.enc(f.state), crop: b64.enc(f.crop), dir: b64.enc(f.dir),
      growth: b64.enc(new Uint8Array(f.growth.buffer)), bonus: b64.enc(f.bonus), straw: b64.enc(f.straw),
    })),
    veh: vehicles.map(v => ({ x: v.x, z: v.z, h: v.h, tank: v.tank, seedCrop: v.seedCrop, impl: v.impl, header: v.header, baleAcc: v.baleAcc, fuel: v.fuel, helper: serializeHelper(v) })),
    loan: G.loan, machines: G.machines, cond: G.cond, contracts: G.contracts, lastDay: G.lastDay,
    farm: G.farm, stats: G.stats, goals: G.goals, forest: serializeForest(), logs: forester.logs, water: TOOLS.watertank.water,
    trailer: { tank: trailer.tank, bales: trailer.bales },
    bales: bales.map(b => ({ x: +b.x.toFixed(2), z: +b.z.toFixed(2), h: +b.h.toFixed(3) })),
  };
}

/** Validates everything first and only then touches the game, so a bad file never half-loads. */
export function applySave(d) {
  if (!d || ![1, 2, 3, VERSION].includes(d.v) || !Array.isArray(d.fields) || d.fields.length > FIELDS.length || !Array.isArray(d.veh)) return false;
  const decoded = d.fields.map((s, k) => {
    const f = FIELDS[k];
    const out = {
      owned: !!s.owned, state: b64.dec(s.state), crop: b64.dec(s.crop), dir: b64.dec(s.dir), growth: b64.dec(s.growth),
      bonus: s.bonus ? b64.dec(s.bonus) : new Uint8Array(f.n), straw: s.straw ? b64.dec(s.straw) : new Uint8Array(f.n),
    };
    for (const key of ['state', 'crop', 'dir', 'bonus', 'straw']) if (out[key].length !== f.n) throw new Error('bad field size');
    if (out.growth.length !== f.n * 4) throw new Error('bad field size');
    for (let i = 0; i < f.n; i++) if (out.state[i] > S_RIPE || out.crop[i] >= CROPS.length) throw new Error('bad cell');
    return out;
  });
  G.money = +d.money || 0; G.gameMin = +d.gameMin || 480; G.tsIdx = d.tsIdx | 0;
  FIELDS.forEach((f, k) => { if (!decoded[k]) applyStart(f); }); // fields added after the save was made
  decoded.forEach((s, k) => {
    const f = FIELDS[k];
    f.owned = s.owned; f.state.set(s.state); f.crop.set(s.crop); f.dir.set(s.dir); f.bonus.set(s.bonus); f.straw.set(s.straw);
    f.growth.set(new Float32Array(s.growth.buffer));
    for (let i = 0; i < f.n; i++) f.stage[i] = stageOf(f, i);
  });
  vehicles.forEach((v, k) => {
    const s = d.veh[k];
    if (!s) { sendHome(v); return; }
    Object.assign(v, { x: +s.x || 0, z: +s.z || 0, h: +s.h || 0, speed: 0, lowered: false, unloading: false, seedCrop: (s.seedCrop | 0) % CROPS.length, baleAcc: s.baleAcc | 0 });
    v.fuel = Number.isFinite(s.fuel) ? Math.max(0, Math.min(v.fuelCap, s.fuel)) : v.fuelCap;
    if (s.tank && v.harvester) v.tank = { crop: s.tank.crop | 0, amount: Math.max(0, +s.tank.amount || 0), cap: v.tank.cap };
  });
  const t = d.trailer?.tank;
  trailer.tank = t ? { crop: t.crop | 0, amount: Math.max(0, +t.amount || 0), cap: 14000 } : { crop: -1, amount: 0, cap: 14000 };
  trailer.bales = Math.min(trailer.baleCap, Math.max(0, d.trailer?.bales | 0));
  trailer.tipping = false;
  setBales(d.bales);
  if (d.v >= 4 && d.machines) {
    G.machines = {}; G.cond = {};
    for (const c of CATALOG) {
      const m = d.machines[c.key];
      G.machines[c.key] = m === 'own' || m === 'lease' ? m : null;
      G.cond[c.key] = Math.max(0, Math.min(1, Number.isFinite(d.cond?.[c.key]) ? d.cond[c.key] : 1));
    }
    G.machines.tractor = 'own';
    G.loan = Math.max(0, +d.loan || 0);
    const ok = c => c && Number.isFinite(c.field) && Number.isFinite(c.target);
    G.contracts = { offers: (d.contracts?.offers || []).filter(ok), active: ok(d.contracts?.active) ? d.contracts.active : null };
  } else {
    resetMachines(true);
    G.loan = 0;
    G.contracts = { offers: [], active: null };
  }
  G.lastDay = Number.isFinite(d.lastDay) ? d.lastDay : dayOf(G.gameMin);
  const farm = emptyFarm();
  for (const k in farm) if (k !== 'hungry' && Number.isFinite(d.farm?.[k])) farm[k] = Math.max(0, d.farm[k]);
  G.farm = farm;
  loadForest(d.forest);
  forester.logs = Math.max(0, Math.min(forester.logCap, +d.logs || 0)); forester.cutting = null;
  TOOLS.watertank.water = Math.max(0, Math.min(TOOLS.watertank.waterCap, +d.water || 0));
  attachImpl(IMPL[d.veh[0]?.impl] ? d.veh[0].impl : 'cultivator');
  setHeader(d.veh[1]?.header === 'corn' ? 'corn' : 'grain');
  G.active = vehicles.find(v => v.type === d.active) || combine;
  applyOwnership();
  afterLoad();
  if (!G.contracts.active && !G.contracts.offers.length) generateOffers();
  // helpers carry on where they were (after ownership and contracts are known)
  vehicles.forEach((v, k) => { v.helper = null; if (v.available) restoreHelper(v, d.veh[k]?.helper); });
  if (G.active.helper) G.active = vehicles.find(v => v.available && !v.helper) || G.active;
  G.stats = loadStats(d.stats);
  // saves from before goals existed: whatever is already achieved counts as done, without a reward
  G.goals = d.stats ? loadGoals(d.goals) : GOALS.filter(g => progressOf(g) >= 1).map(g => g.id);
  return true;
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
