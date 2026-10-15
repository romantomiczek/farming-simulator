import { fmt } from '../core/util.js';
import { G, TIME_SCALES } from './state.js';
import { CROPS } from './crops.js';
import { inSell } from './work.js';
import { saveLocal } from './save.js';
import { tractor, combine, IMPL, attachImpl } from '../vehicles/vehicles.js';
import { signs, drawSign } from '../world/fields.js';
import { shedZone } from '../world/layout.js';
import { cam } from '../render/camera.js';
import { toast } from '../ui/toast.js';

export const inShed = v => v.x > shedZone.x0 && v.x < shedZone.x1 && v.z > shedZone.z0 && v.z < shedZone.z1;
export const nearSign = v => signs.find(s => !s.f.owned && Math.hypot(v.x - s.x, v.z - s.z) < 10);
export const otherImpl = () => (tractor.impl === 'cultivator' ? 'seeder' : 'cultivator');

export function toggleTool() {
  const v = G.active;
  v.lowered = !v.lowered;
  v.prevTool = null;
  if (v.lowered && v.type === 'tractor' && v.impl === 'seeder' && G.money < CROPS[v.seedCrop].seed) {
    v.lowered = false;
    toast('Nemáš peníze na osivo.', 'bad');
  }
}

export function switchVehicle() {
  G.active.unloading = false;
  G.active = G.active === tractor ? combine : tractor;
  cam.manual = -99; // swing the camera behind the new vehicle
  toast('Sedíš v: ' + G.active.name);
}

export function cycleSeed() {
  tractor.seedCrop = (tractor.seedCrop + 1) % CROPS.length;
  const c = CROPS[tractor.seedCrop];
  toast('Osivo: ' + c.name + ' · ' + c.seed + ' Kč/m² · zraje za ' + c.hours + ' h');
}

export function cycleTime() { G.tsIdx = (G.tsIdx + 1) % TIME_SCALES.length; }

/** The context action on F: sell grain, swap implement or buy a field, whichever applies. */
export function doF() {
  const v = G.active;
  if (v.type === 'combine' && inSell(v) && v.tank.amount > 0) {
    v.unloading = !v.unloading;
    if (v.unloading) { v.sold = 0; v.soldMoney = 0; v.soldCrop = v.tank.crop; }
    return;
  }
  if (v.type === 'tractor' && inShed(v)) {
    const other = otherImpl();
    attachImpl(other);
    toast('Připojeno: ' + IMPL[other].name, 'good');
    return;
  }
  const s = nearSign(v);
  if (!s) return;
  if (G.money >= s.f.price) {
    G.money -= s.f.price; s.f.owned = true; G.flashT = 0.4;
    drawSign(s);
    toast('Pole ' + s.f.id + ' je tvoje. Úroda na něm patří tobě.', 'good');
    saveLocal();
  } else {
    toast('Na pole ' + s.f.id + ' ti chybí ' + fmt(s.f.price - G.money) + ' Kč.', 'bad');
  }
}
