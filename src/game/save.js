import { G } from './state.js';
import { CROPS, S_STUB, S_SOWN, S_RIPE } from './crops.js';
import { FIELDS, refreshField, flushFields, drawSigns, countFields } from '../world/fields.js';
import { vehicles, combine, trailer, attachImpl, setHeader, sendHome, IMPL } from '../vehicles/vehicles.js';
import { bales, setBales, flushBales } from '../world/bales.js';

const KEY = 'zlate-lany-v1';
// 1 = first release, 2 = grain trailer, 3 = bonus bits, straw, bales, combine header.
// Version 3 saves may hold 2 or 3 vehicles (the beet harvester came later); a missing one starts at home.
// Older saves still load; missing data starts empty.
const VERSION = 3;

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
  for (const f of FIELDS) { f.state.fill(S_STUB); f.crop.fill(0); f.growth.fill(0); f.stage.fill(0); f.dir.fill(0); f.bonus.fill(0); f.straw.fill(0); }
  const [f1, , f3, f4] = FIELDS;
  f1.state.fill(S_RIPE); f1.crop.fill(0); f1.stage.fill(4); // ripe wheat to start with
  f3.state.fill(S_RIPE); f3.crop.fill(2); f3.stage.fill(4); f3.dir.fill(1); // canola, for sale
  f4.state.fill(S_SOWN); f4.crop.fill(1); // growing barley, for sale
  for (let i = 0; i < f4.n; i++) { f4.growth[i] = 2.4 + f4.jit[i] * 0.4; f4.stage[i] = stageOf(f4, i); }
  FIELDS.forEach((f, k) => (f.owned = k < 2));
  vehicles.forEach(sendHome);
  Object.assign(vehicles[0], { seedCrop: 0, baleAcc: 0 });
  trailer.tank = { crop: -1, amount: 0, cap: 14000 };
  trailer.bales = 0;
  setBales([]);
  attachImpl('cultivator');
  setHeader('grain');
  G.active = combine;
  afterLoad();
}

export function serialize() {
  return {
    v: VERSION, money: G.money, gameMin: G.gameMin, tsIdx: G.tsIdx, active: G.active.type,
    fields: FIELDS.map(f => ({
      owned: f.owned, state: b64.enc(f.state), crop: b64.enc(f.crop), dir: b64.enc(f.dir),
      growth: b64.enc(new Uint8Array(f.growth.buffer)), bonus: b64.enc(f.bonus), straw: b64.enc(f.straw),
    })),
    veh: vehicles.map(v => ({ x: v.x, z: v.z, h: v.h, tank: v.tank, seedCrop: v.seedCrop, impl: v.impl, header: v.header, baleAcc: v.baleAcc })),
    trailer: { tank: trailer.tank, bales: trailer.bales },
    bales: bales.map(b => ({ x: +b.x.toFixed(2), z: +b.z.toFixed(2), h: +b.h.toFixed(3) })),
  };
}

/** Validates everything first and only then touches the game, so a bad file never half-loads. */
export function applySave(d) {
  if (!d || ![1, 2, VERSION].includes(d.v) || !Array.isArray(d.fields) || d.fields.length !== FIELDS.length || !Array.isArray(d.veh)) return false;
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
    if (s.tank && v.harvester) v.tank = { crop: s.tank.crop | 0, amount: Math.max(0, +s.tank.amount || 0), cap: v.tank.cap };
  });
  const t = d.trailer?.tank;
  trailer.tank = t ? { crop: t.crop | 0, amount: Math.max(0, +t.amount || 0), cap: 14000 } : { crop: -1, amount: 0, cap: 14000 };
  trailer.bales = Math.min(trailer.baleCap, Math.max(0, d.trailer?.bales | 0));
  trailer.tipping = false;
  setBales(d.bales);
  attachImpl(IMPL[d.veh[0]?.impl] ? d.veh[0].impl : 'cultivator');
  setHeader(d.veh[1]?.header === 'corn' ? 'corn' : 'grain');
  G.active = vehicles.find(v => v.type === d.active) || combine;
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
