import * as THREE from 'three';
import { lerp, fmt } from '../core/util.js';
import { G } from './state.js';
import { CROPS, S_STUB, S_CULT, S_SOWN, S_RIPE, price } from './crops.js';
import { fieldAt, drawCell, updCrop, drawMini } from '../world/fields.js';
import { IMPL, toolLine } from '../vehicles/vehicles.js';
import { sellZone } from '../world/layout.js';
import { emit, CHAFF } from '../fx/particles.js';
import { toast, warn } from '../ui/toast.js';

export const inSell = v => Math.hypot(v.x - sellZone.x, v.z - sellZone.z) < sellZone.r;

/** Applies the vehicle's tool to the field cell under world point (x, z). */
function applyCell(v, x, z, dirBit, res) {
  const f = fieldAt(x, z);
  if (!f) return;
  if (!f.owned) { res.notOwned = f; return; }
  res.onField = true;
  const i = Math.floor(x - f.x0) + Math.floor(z - f.z0) * f.w, s = f.state[i];
  let changed = false;
  if (v.type === 'tractor') {
    if (v.impl === 'cultivator') {
      if (s === S_STUB) { f.state[i] = S_CULT; changed = true; }
    } else if (s === S_CULT) {
      const cr = CROPS[v.seedCrop];
      if (G.money < cr.seed) { res.blocked = 'money'; return; }
      G.money -= cr.seed;
      f.state[i] = S_SOWN; f.crop[i] = v.seedCrop; f.growth[i] = 0; f.stage[i] = 0;
      changed = true;
    } else if (s === S_STUB) res.stub = true;
  } else if (s === S_RIPE) {
    const c = f.crop[i], cr = CROPS[c], tk = v.tank;
    if (tk.amount > 0 && tk.crop !== c) { res.blocked = 'mix'; return; }
    if (tk.amount + cr.yield > tk.cap) { res.blocked = 'full'; return; }
    tk.crop = c; tk.amount += cr.yield;
    f.state[i] = S_STUB; f.stage[i] = 0; v.harvestT = 0.35;
    changed = true;
  }
  if (changed) { f.dir[i] = dirBit; drawCell(f, i); updCrop(f, i); drawMini(f, i); res.changed++; }
}

/**
 * Sweeps the working line from last frame's position to this frame's, so fast driving
 * or a frame drop never leaves gaps in the field.
 */
export function work(v, dt) {
  if (v.harvestT > 0) v.harvestT -= dt;
  if (!v.lowered || v.speed < 0.3) { v.prevTool = null; return; }
  const { W, Z } = toolLine(v);
  const sh = Math.sin(v.h), ch = Math.cos(v.h), rx = ch, rz = -sh;
  const cx = v.x + sh * Z, cz = v.z + ch * Z;
  let p = v.prevTool;
  if (!p || Math.hypot(cx - p.x, cz - p.z) > 4) p = { x: cx, z: cz };
  const steps = Math.max(1, Math.ceil(Math.hypot(cx - p.x, cz - p.z) / 0.45));
  const dirBit = Math.abs(sh) > Math.abs(ch) ? 1 : 0;
  const res = { changed: 0, onField: false };
  for (let s = 1; s <= steps; s++) {
    const t = s / steps, px = lerp(p.x, cx, t), pz = lerp(p.z, cz, t);
    for (let k = -W / 2 + 0.2; k <= W / 2 - 0.2 + 1e-6; k += 0.4) applyCell(v, px + rx * k, pz + rz * k, dirBit, res);
  }
  v.prevTool = { x: cx, z: cz };

  if (res.notOwned && !res.onField) warn('own', 'Pole ' + res.notOwned.id + ' ti nepatří. Koupit ho můžeš u cedule u cesty.');
  if (res.blocked === 'money') { v.lowered = false; warn('money', 'Došly peníze na osivo. Prodej úrodu.'); }
  if (res.blocked === 'full') warn('full', 'Zásobník je plný. Jeď k výkupu u sil.');
  if (res.blocked === 'mix') warn('mix', 'V zásobníku je jiná plodina. Nejdřív ji prodej.');
  if (res.stub && !res.changed) warn('stub', 'Secí stroj potřebuje zkultivovanou půdu.', '');

  if (res.onField && v.type === 'tractor' && Math.random() < dt * 45) {
    const k = (Math.random() - 0.5) * W;
    emit(cx + rx * k, 0.3, cz + rz * k, IMPL[v.impl].dust, 0.9 + Math.random() * 0.6,
      (Math.random() - 0.5) * 0.6 - sh * 0.6, 0.6 + Math.random() * 0.6, (Math.random() - 0.5) * 0.6 - ch * 0.6, 1.4 + Math.random() * 0.6);
  }
  if (v.type === 'combine' && v.harvestT > 0 && Math.random() < dt * 30) {
    const bx = v.x - sh * 3.6, bz = v.z - ch * 3.6;
    emit(bx + (Math.random() - 0.5) * 1.5, 1.4, bz + (Math.random() - 0.5) * 1.5, CHAFF, 0.7,
      -sh * 1.2 + (Math.random() - 0.5), 0.3 + Math.random() * 0.5, -ch * 1.2 + (Math.random() - 0.5), 1.8, 0.2);
  }
}

const _v = new THREE.Vector3();
/** Combine unloading at the intake: grain flows out of the pipe and turns into money. */
export function unload(v, dt, onDone) {
  if (!v.unloading) return;
  if (!inSell(v) || v.tank.amount <= 0) {
    if (v.sold > 0) {
      toast('Prodáno ' + fmt(v.sold) + ' l ' + CROPS[v.soldCrop].gen + ' za ' + fmt(v.soldMoney) + ' Kč', 'good');
      onDone?.();
    }
    v.unloading = false; v.sold = 0; v.soldMoney = 0;
    if (v.tank.amount <= 0) v.tank.crop = -1;
    return;
  }
  if (v.pipe.rotation.y > -1.3) return; // wait until the pipe has swung out
  const amt = Math.min(v.tank.amount, 1800 * dt), pr = price(v.tank.crop, G.gameMin);
  v.tank.amount -= amt; v.sold += amt; v.soldMoney += amt * pr; G.money += amt * pr; G.flashT = 0.4;
  if (Math.random() < dt * 40) {
    _v.set(0, -0.3, -4.6); v.pipe.localToWorld(_v);
    emit(_v.x, _v.y, _v.z, CROPS[v.tank.crop].cols[4], 0.4, (Math.random() - 0.5) * 0.4, -1, (Math.random() - 0.5) * 0.4, 0.9, 6);
  }
}
