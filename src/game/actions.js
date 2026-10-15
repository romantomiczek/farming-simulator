import { fmt } from '../core/util.js';
import { G, TIME_SCALES } from './state.js';
import { CROPS, HEADERS } from './crops.js';
import {
  inSell, inBaleZone, hasTrailer, trailerInReach, startUnload, stopUnload, startTipping, stopTipping, sellBales,
} from './work.js';
import { saveLocal } from './save.js';
import { tractor, combine, trailer, trailerCenter, vehicles, HARVESTERS, IMPL, IMPL_ORDER, attachImpl, setHeader } from '../vehicles/vehicles.js';
import { signs, drawSign } from '../world/fields.js';
import { shedZone } from '../world/layout.js';
import { cam } from '../render/camera.js';
import { toast } from '../ui/toast.js';

export const inShed = v => v.x > shedZone.x0 && v.x < shedZone.x1 && v.z > shedZone.z0 && v.z < shedZone.z1;
export const nearSign = v => signs.find(s => !s.f.owned && Math.hypot(v.x - s.x, v.z - s.z) < 10);
/** Next attachment in the shed's swap order. */
export const otherImpl = () => IMPL_ORDER[(IMPL_ORDER.indexOf(tractor.impl) + 1) % IMPL_ORDER.length];
export const otherHeader = () => (combine.header === 'grain' ? 'corn' : 'grain');

/** What F would do right now for the active vehicle, or null. Shared by doF() and the HUD prompts. */
export function fAction() {
  const v = G.active;
  if (v.harvester) {
    if (v.unloading) return { kind: 'stopUnload', h: v };
    if (v.tank.amount > 0 && inSell(v)) return { kind: 'sell', h: v };
    if (v.tank.amount > 0 && trailerInReach(v)) return { kind: 'overload', h: v };
    if (v === combine && inShed(v)) return { kind: 'header', header: otherHeader() };
  } else {
    if (trailer.tipping) return { kind: 'stopTip' };
    if (hasTrailer() && trailer.tank.amount > 0 && inSell(trailerCenter())) return { kind: 'tip' };
    if (hasTrailer() && trailer.bales > 0 && inBaleZone(trailerCenter())) return { kind: 'sellBales' };
    for (const h of HARVESTERS) if (h.unloading && trailerInReach(h)) return { kind: 'stopUnload', h };
    for (const h of HARVESTERS) if (h.tank.amount > 0 && trailerInReach(h)) return { kind: 'overload', h };
    if (inShed(v)) return { kind: 'swap', impl: otherImpl() };
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
  if (v.lowered && v.type === 'tractor' && v.impl === 'seeder' && G.money < CROPS[v.seedCrop].seed) {
    v.lowered = false;
    toast('Nemáš peníze na osivo.', 'bad');
  }
}

export function switchVehicle() {
  // a running unload keeps going, so you can hop into the tractor and drive under the pipe
  G.active = vehicles[(vehicles.indexOf(G.active) + 1) % vehicles.length];
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
  attachImpl(key);
  toast('Připojeno: ' + IMPL[key].name, 'good');
}
function swapHeader(key) {
  if (combine.header === key) return;
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

/** The context action on F: sell, overload, swap implement or header, or buy a field. */
export function doF() {
  const a = fAction();
  if (!a) return;
  switch (a.kind) {
    case 'stopUnload': stopUnload(a.h, saveLocal); return;
    case 'sell': case 'overload': startUnload(a.h); return;
    case 'tip': startTipping(); return;
    case 'stopTip': stopTipping(saveLocal); return;
    case 'sellBales': sellBales(saveLocal); return;
    case 'swap': swapImpl(a.impl); return;
    case 'header': swapHeader(a.header); return;
  }
  const s = a.sign;
  if (G.money >= s.f.price) {
    G.money -= s.f.price; s.f.owned = true; G.flashT = 0.4;
    drawSign(s);
    toast('Pole ' + s.f.id + ' je tvoje. Úroda na něm patří tobě.', 'good');
    saveLocal();
  } else {
    toast('Na pole ' + s.f.id + ' ti chybí ' + fmt(s.f.price - G.money) + ' Kč.', 'bad');
  }
}
