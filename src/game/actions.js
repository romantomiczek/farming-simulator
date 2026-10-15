import { fmt } from '../core/util.js';
import { G, TIME_SCALES } from './state.js';
import { CROPS } from './crops.js';
import { inSell, hasTrailer, trailerInReach, startCombineUnload, stopCombineUnload, startTipping, stopTipping } from './work.js';
import { saveLocal } from './save.js';
import { tractor, combine, trailer, trailerCenter, IMPL, IMPL_ORDER, attachImpl } from '../vehicles/vehicles.js';
import { signs, drawSign } from '../world/fields.js';
import { shedZone } from '../world/layout.js';
import { cam } from '../render/camera.js';
import { toast } from '../ui/toast.js';

export const inShed = v => v.x > shedZone.x0 && v.x < shedZone.x1 && v.z > shedZone.z0 && v.z < shedZone.z1;
export const nearSign = v => signs.find(s => !s.f.owned && Math.hypot(v.x - s.x, v.z - s.z) < 10);
/** Next attachment in the shed's swap order. */
export const otherImpl = () => IMPL_ORDER[(IMPL_ORDER.indexOf(tractor.impl) + 1) % IMPL_ORDER.length];

/** What F would do right now for the active vehicle, or null. Shared by doF() and the HUD prompts. */
export function fAction() {
  const v = G.active;
  if (v.type === 'combine') {
    if (combine.unloading) return { kind: 'stopCombine' };
    if (combine.tank.amount > 0 && inSell(combine)) return { kind: 'sellCombine' };
    if (combine.tank.amount > 0 && trailerInReach()) return { kind: 'overload' };
  } else {
    if (trailer.tipping) return { kind: 'stopTip' };
    if (hasTrailer() && trailer.tank.amount > 0 && inSell(trailerCenter())) return { kind: 'tip' };
    if (combine.unloading && trailerInReach()) return { kind: 'stopCombine' };
    if (combine.tank.amount > 0 && trailerInReach()) return { kind: 'overload' };
    if (inShed(v)) return { kind: 'swap', impl: otherImpl() };
  }
  const s = nearSign(v);
  if (s) return { kind: 'buy', sign: s };
  return null;
}

export function toggleTool() {
  const v = G.active;
  if (v.type === 'tractor' && v.impl === 'trailer') {
    toast('Přívěs nemá co spouštět. Vysypeš ho klávesou F ve žlutém kruhu u sil.');
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
  // a running combine unload keeps going, so you can hop into the tractor and drive under the pipe
  G.active =G.active === tractor ? combine : tractor;
  cam.manual = -99; // swing the camera behind the new vehicle
  toast('Sedíš v: ' + G.active.name);
}

export function cycleSeed() {
  tractor.seedCrop = (tractor.seedCrop + 1) % CROPS.length;
  const c = CROPS[tractor.seedCrop];
  toast('Osivo: ' + c.name + ' · ' + c.seed + ' Kč/m² · zraje za ' + c.hours + ' h');
}

export function cycleTime() { G.tsIdx = (G.tsIdx + 1) % TIME_SCALES.length; }

/** The context action on F: sell, overload, swap implement or buy a field, whichever applies. */
export function doF() {
  const a = fAction();
  if (!a) return;
  switch (a.kind) {
    case 'stopCombine': stopCombineUnload(saveLocal); return;
    case 'sellCombine': case 'overload': startCombineUnload(); return;
    case 'tip': startTipping(); return;
    case 'stopTip': stopTipping(saveLocal); return;
    case 'swap':
      attachImpl(a.impl);
      toast('Připojeno: ' + IMPL[a.impl].name, 'good');
      return;
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
