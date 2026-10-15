import { G } from './state.js';
import { CROPS, S_STUB, S_SOWN, S_RIPE } from './crops.js';
import { FIELDS, refreshField, flushFields, drawSigns, countFields } from '../world/fields.js';
import { vehicles, tractor, combine, attachImpl } from '../vehicles/vehicles.js';

const KEY = 'zlate-lany-v1';
const VERSION = 1;

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
  flushFields(); drawSigns(); countFields();
}

export function newGame() {
  G.money = 150000; G.gameMin = 8 * 60; G.tsIdx = 0;
  for (const f of FIELDS) { f.state.fill(S_STUB); f.crop.fill(0); f.growth.fill(0); f.stage.fill(0); f.dir.fill(0); }
  const [f1, , f3, f4] = FIELDS;
  f1.state.fill(S_RIPE); f1.crop.fill(0); f1.stage.fill(4); // ripe wheat to start with
  f3.state.fill(S_RIPE); f3.crop.fill(2); f3.stage.fill(4); f3.dir.fill(1); // canola, for sale
  f4.state.fill(S_SOWN); f4.crop.fill(1); // growing barley, for sale
  for (let i = 0; i < f4.n; i++) { f4.growth[i] = 2.4 + f4.jit[i] * 0.4; f4.stage[i] = stageOf(f4, i); }
  FIELDS.forEach((f, k) => (f.owned = k < 2));
  Object.assign(combine, { x: -10, z: -8, h: 0, speed: 0, lowered: false, unloading: false, tank: { crop: -1, amount: 0, cap: 9000 } });
  Object.assign(tractor, { x: 8.5, z: -36.5, h: 0, speed: 0, lowered: false, seedCrop: 0 });
  attachImpl('cultivator');
  G.active = combine;
  afterLoad();
}

export function serialize() {
  return {
    v: VERSION, money: G.money, gameMin: G.gameMin, tsIdx: G.tsIdx, active: G.active.type,
    fields: FIELDS.map(f => ({
      owned: f.owned, state: b64.enc(f.state), crop: b64.enc(f.crop), dir: b64.enc(f.dir),
      growth: b64.enc(new Uint8Array(f.growth.buffer)),
    })),
    veh: vehicles.map(v => ({ x: v.x, z: v.z, h: v.h, tank: v.tank, seedCrop: v.seedCrop, impl: v.impl })),
  };
}

/** Validates everything first and only then touches the game, so a bad file never half-loads. */
export function applySave(d) {
  if (!d || d.v !== VERSION || !Array.isArray(d.fields) || d.fields.length !== FIELDS.length || !Array.isArray(d.veh)) return false;
  const decoded = d.fields.map((s, k) => {
    const f = FIELDS[k];
    const out = { owned: !!s.owned, state: b64.dec(s.state), crop: b64.dec(s.crop), dir: b64.dec(s.dir), growth: b64.dec(s.growth) };
    if (out.state.length !== f.n || out.crop.length !== f.n || out.dir.length !== f.n || out.growth.length !== f.n * 4) throw new Error('bad field size');
    return out;
  });
  G.money = +d.money || 0; G.gameMin = +d.gameMin || 480; G.tsIdx = d.tsIdx | 0;
  decoded.forEach((s, k) => {
    const f = FIELDS[k];
    f.owned = s.owned; f.state.set(s.state); f.crop.set(s.crop); f.dir.set(s.dir);
    f.growth.set(new Float32Array(s.growth.buffer));
    for (let i = 0; i < f.n; i++) f.stage[i] = stageOf(f, i);
  });
  d.veh.forEach((s, k) => {
    const v = vehicles[k];
    if (!v) return;
    Object.assign(v, { x: +s.x || 0, z: +s.z || 0, h: +s.h || 0, speed: 0, lowered: false, unloading: false, seedCrop: s.seedCrop | 0 });
    if (s.tank) v.tank = { crop: s.tank.crop | 0, amount: +s.tank.amount || 0, cap: 9000 };
  });
  attachImpl(d.veh[0]?.impl === 'seeder' ? 'seeder' : 'cultivator');
  G.active = d.active === 'tractor' ? tractor : combine;
  afterLoad();
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
