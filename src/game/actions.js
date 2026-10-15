import { fmt } from '../core/util.js';
import { G, TIME_SCALES } from './state.js';
import { CROPS, HEADERS } from './crops.js';
import {
  sellPoint, inBaleZone, hasTrailer, trailerInReach, startUnload, stopUnload, startTipping, stopTipping, sellBales,
} from './work.js';
import { saveLocal } from './save.js';
import { has } from './machines.js';
import { inFuel, refuel, repair } from './economy.js';
import { marketAt, buyersOf } from './markets.js';
import { tractor, combine, trailer, trailerCenter, vehicles, HARVESTERS, IMPL, IMPL_ORDER, attachImpl, setHeader } from '../vehicles/vehicles.js';
import { signs, drawSign } from '../world/fields.js';
import { shedZone } from '../world/layout.js';
import { cam } from '../render/camera.js';
import { toast } from '../ui/toast.js';

export const inShed = v => v.x > shedZone.x0 && v.x < shedZone.x1 && v.z > shedZone.z0 && v.z < shedZone.z1;
export const nearSign = v => signs.find(s => !s.f.owned && Math.hypot(v.x - s.x, v.z - s.z) < 10);
/** Next owned attachment in the shed's swap order. */
export function otherImpl() {
  const i = IMPL_ORDER.indexOf(tractor.impl);
  for (let k = 1; k < IMPL_ORDER.length; k++) { const key = IMPL_ORDER[(i + k) % IMPL_ORDER.length]; if (has(key)) return key; }
  return null;
}
export const otherHeader = () => (combine.header === 'grain' ? (has('cornHeader') ? 'corn' : null) : 'grain');

/** What F would do right now for the active vehicle, or null. Shared by doF() and the HUD prompts. */
export function fAction() {
  const v = G.active;
  if (inFuel(v) && v.fuel < v.fuelCap - 1) return { kind: 'refuel', v };
  if (v.harvester) {
    if (v.unloading) return { kind: 'stopUnload', h: v };
    if (v.tank.amount > 0 && sellPoint(v, v.tank.crop)) return { kind: 'sell', h: v, m: sellPoint(v, v.tank.crop) };
    if (v.tank.amount > 0 && marketAt(v)) return { kind: 'wrongMarket', m: marketAt(v), crop: v.tank.crop };
    if (v.tank.amount > 0 && trailerInReach(v)) return { kind: 'overload', h: v };
    if (v === combine && inShed(v) && otherHeader()) return { kind: 'header', header: otherHeader() };
  } else {
    if (trailer.tipping) return { kind: 'stopTip' };
    if (hasTrailer() && trailer.tank.amount > 0 && sellPoint(trailerCenter(), trailer.tank.crop)) return { kind: 'tip', m: sellPoint(trailerCenter(), trailer.tank.crop) };
    if (hasTrailer() && trailer.tank.amount > 0 && marketAt(trailerCenter())) return { kind: 'wrongMarket', m: marketAt(trailerCenter()), crop: trailer.tank.crop };
    if (hasTrailer() && trailer.bales > 0 && inBaleZone(trailerCenter())) return { kind: 'sellBales' };
    for (const h of HARVESTERS) if (h.available && h.unloading && trailerInReach(h)) return { kind: 'stopUnload', h };
    for (const h of HARVESTERS) if (h.available && h.tank.amount > 0 && trailerInReach(h)) return { kind: 'overload', h };
    if (inShed(v) && otherImpl()) return { kind: 'swap', impl: otherImpl() };
  }
  const s = nearSign(v);
  if (s) return { kind: 'buy', sign: s };
  return null;
}

export function toggleTool() {
  const v = G.active;
  if (v.type === 'tractor' && v.impl === 'trailer') {
    toast('Přívěs nemá co spouštět. Zrno vysypeš klávesou F u sil, balíky prodáš F u stodoly.');
    return;
  }
  v.lowered = !v.lowered;
  v.prevTool = null;
  if (v.lowered && v.type === 'tractor' && v.impl === 'seeder' && G.money < CROPS[v.seedCrop].seed && !G.contracts.active) {
    v.lowered = false;
    toast('Nemáš peníze na osivo.', 'bad');
  }
}

export function switchVehicle() {
  // a running unload keeps going, so you can hop into the tractor and drive under the pipe
  const i = vehicles.indexOf(G.active);
  for (let k = 1; k <= vehicles.length; k++) {
    const v = vehicles[(i + k) % vehicles.length];
    if (v.available) { G.active = v; break; }
  }
  cam.manual = -99; // swing the camera behind the new vehicle
  toast('Sedíš v: ' + G.active.name);
}

export function cycleSeed() {
  tractor.seedCrop = (tractor.seedCrop + 1) % CROPS.length;
  const c = CROPS[tractor.seedCrop];
  const hdr = c.header === 'corn' ? ' · sklízí se řádkovým adaptérem' : c.header === 'beet' ? ' · sklízí se sklízečem cukrovky' : '';
  toast('Osivo: ' + c.name + ' · ' + c.seed + ' Kč/m² · zraje za ' + c.hours + ' h' + hdr);
}

export function cycleTime() { G.tsIdx = (G.tsIdx + 1) % TIME_SCALES.length; }

function swapImpl(key) {
  if (tractor.impl === key) return;
  if (!has(key)) { toast(IMPL[key].name + ' nevlastníš. Koupíš nebo pronajmeš ho v Kanceláři (K).', 'bad'); return; }
  attachImpl(key);
  toast('Připojeno: ' + IMPL[key].name, 'good');
}
function swapHeader(key) {
  if (combine.header === key) return;
  if (key === 'corn' && !has('cornHeader')) { toast('Řádkový adaptér nevlastníš. Koupíš nebo pronajmeš ho v Kanceláři (K).', 'bad'); return; }
  setHeader(key);
  toast('Na kombajnu je ' + HEADERS[key].name.toLowerCase(), 'good');
}

/** Number key n (1-based) in the shed: pick that implement or header directly. */
export function pickInShed(n) {
  const v = G.active;
  if (!inShed(v)) return;
  if (v.type === 'tractor' && IMPL_ORDER[n - 1]) swapImpl(IMPL_ORDER[n - 1]);
  if (v === combine && n <= 2) swapHeader(n === 1 ? 'grain' : 'corn');
}

/** R in the shed: repair the vehicle and its attached tool. */
export function repairHere() {
  const v = G.active;
  if (!inShed(v)) { toast('Opravit stroj můžeš v kůlně.'); return; }
  repair(v);
  saveLocal();
}

/** The context action on F: refuel, sell, overload, swap implement or header, or buy a field. */
export function doF() {
  const a = fAction();
  if (!a) return;
  switch (a.kind) {
    case 'refuel': refuel(a.v); return;
    case 'stopUnload': stopUnload(a.h, saveLocal); return;
    case 'sell': case 'overload': startUnload(a.h); return;
    case 'tip': startTipping(); return;
    case 'stopTip': stopTipping(saveLocal); return;
    case 'sellBales': sellBales(saveLocal); return;
    case 'wrongMarket': toast(a.m.name + ' nebere ' + CROPS[a.crop].gen + '. Vezme ji: ' + buyersOf(a.crop).join(', ') + '.', 'bad'); return;
    case 'swap': swapImpl(a.impl); return;
    case 'header': swapHeader(a.header); return;
  }
  const s = a.sign;
  if (G.money >= s.f.price) {
    G.money -= s.f.price; s.f.owned = true; G.flashT = 0.4;
    if (G.contracts.active?.field === s.f.id) G.contracts.active = null; // your own field now
    G.contracts.offers = G.contracts.offers.filter(o => o.field !== s.f.id);
    drawSign(s);
    toast('Pole ' + s.f.id + ' je tvoje. Úroda na něm patří tobě.', 'good');
    saveLocal();
  } else {
    toast('Na pole ' + s.f.id + ' ti chybí ' + fmt(s.f.price - G.money) + ' Kč.', 'bad');
  }
}
