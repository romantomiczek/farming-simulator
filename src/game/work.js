import * as THREE from 'three';
import { lerp, fmt, plural } from '../core/util.js';
import { G } from './state.js';
import {
  CROPS, HEADERS, S_STUB, S_CULT, S_SOWN, S_RIPE, B_FERT, B_PLOW, FERT_COST, yieldMult, price, balePrice,
} from './crops.js';
import { fieldAt, drawCell, updCrop, drawMini } from '../world/fields.js';
import { IMPL, BALE_CELLS, toolLine, tractor, combine, trailer, trailerCenter } from '../vehicles/vehicles.js';
import { sellZone, baleZone } from '../world/layout.js';
import { bales, addBale, removeBale } from '../world/bales.js';
import { emit, CHAFF } from '../fx/particles.js';
import { toast, warn } from '../ui/toast.js';

const inZone = (zone, p) => Math.hypot(p.x - zone.x, p.z - zone.z) < zone.r;
export const inSell = p => inZone(sellZone, p);
export const inBaleZone = p => inZone(baleZone, p);

/**
 * Applies the vehicle's tool to the field cell under world point (x, z).
 * k = lateral offset from the vehicle's centre line (the combine drops straw near the middle).
 */
function applyCell(v, x, z, k, dirBit, res) {
  const f = fieldAt(x, z);
  if (!f) return;
  if (!f.owned) { res.notOwned = f; return; }
  res.onField = true;
  const i = Math.floor(x - f.x0) + Math.floor(z - f.z0) * f.w, s = f.state[i];
  let changed = false, setDir = true;
  if (v.type === 'tractor') {
    switch (v.impl) {
      case 'cultivator':
        if (s === S_STUB) { f.state[i] = S_CULT; f.straw[i] = 0; changed = true; }
        break;
      case 'plough':
        if ((s === S_STUB || s === S_CULT) && !(f.bonus[i] & B_PLOW)) { f.state[i] = S_CULT; f.bonus[i] |= B_PLOW; f.straw[i] = 0; changed = true; }
        break;
      case 'seeder':
        if (s === S_CULT) {
          const cr = CROPS[v.seedCrop];
          if (G.money < cr.seed) { res.blocked = 'money'; return; }
          G.money -= cr.seed;
          f.state[i] = S_SOWN; f.crop[i] = v.seedCrop; f.growth[i] = 0; f.stage[i] = 0;
          changed = true;
        } else if (s === S_STUB) res.stub = true;
        break;
      case 'spreader':
        if (s !== S_RIPE && !(f.bonus[i] & B_FERT)) {
          if (G.money < FERT_COST) { res.blocked = 'money'; return; }
          G.money -= FERT_COST; f.bonus[i] |= B_FERT; changed = true; setDir = false;
        }
        break;
      case 'baler':
        if (f.straw[i]) { f.straw[i] = 0; v.baleAcc++; changed = true; setDir = false; }
        break;
    }
  } else if (s === S_RIPE) {
    const c = f.crop[i], cr = CROPS[c], tk = v.tank;
    if (cr.header !== v.header) { res.blocked = 'header'; res.needHeader = cr.header; return; }
    if (tk.amount > 0 && tk.crop !== c) { res.blocked = 'mix'; return; }
    const y = cr.yield * yieldMult(f.bonus[i]);
    if (tk.amount + y > tk.cap) { res.blocked = 'full'; return; }
    tk.crop = c; tk.amount += y;
    f.state[i] = S_STUB; f.stage[i] = 0; f.bonus[i] = 0;
    f.straw[i] = cr.straw && Math.abs(k) < 0.9 ? 1 : 0;
    v.harvestT = 0.35;
    changed = true;
  }
  if (changed) {
    if (setDir) f.dir[i] = dirBit;
    drawCell(f, i); updCrop(f, i); drawMini(f, i);
    res.changed++;
  }
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
    for (let k = -W / 2 + 0.2; k <= W / 2 - 0.2 + 1e-6; k += 0.4) applyCell(v, px + rx * k, pz + rz * k, k, dirBit, res);
  }
  v.prevTool = { x: cx, z: cz };

  if (res.notOwned && !res.onField) warn('own', 'Pole ' + res.notOwned.id + ' ti nepatří. Koupit ho můžeš u cedule u cesty.');
  if (res.blocked === 'money') {
    v.lowered = false;
    warn('money', v.impl === 'spreader' ? 'Došly peníze na hnojivo. Prodej úrodu.' : 'Došly peníze na osivo. Prodej úrodu.');
  }
  if (res.blocked === 'full') warn('full', 'Zásobník je plný. Přelož zrno do přívěsu nebo jeď k silům.');
  if (res.blocked === 'mix') warn('mix', 'V zásobníku je jiná plodina. Nejdřív ji prodej.');
  if (res.blocked === 'header') warn('header', 'Na tuhle plodinu potřebuješ ' + HEADERS[res.needHeader].short + '. Vyměníš ho v kůlně.');
  if (res.stub && !res.changed) warn('stub', 'Secí stroj potřebuje zkultivovanou nebo zoranou půdu.', '');

  // baler: drop a bale behind the chamber every BALE_CELLS of straw
  if (v.type === 'tractor' && v.impl === 'baler') {
    while (v.baleAcc >= BALE_CELLS) {
      v.baleAcc -= BALE_CELLS;
      const bz = -1.75 - 4.2;
      if (addBale(v.x + sh * bz, v.z + ch * bz, v.h)) warn('bale', 'Lis vyhodil balík slámy.', '');
    }
  }

  if (res.onField && v.type === 'tractor' && Math.random() < dt * (v.impl === 'spreader' ? 70 : 45)) {
    const k = (Math.random() - 0.5) * W, im = IMPL[v.impl];
    const up = v.impl === 'spreader' ? 0.4 : 0.6 + Math.random() * 0.6;
    emit(cx + rx * k, v.impl === 'spreader' ? 0.6 : 0.3, cz + rz * k, im.dust, v.impl === 'spreader' ? 0.25 : 0.9 + Math.random() * 0.6,
      (Math.random() - 0.5) * 0.6 - sh * 0.6, up, (Math.random() - 0.5) * 0.6 - ch * 0.6, v.impl === 'spreader' ? 0.7 : 1.4 + Math.random() * 0.6, v.impl === 'spreader' ? 2 : 0);
  }
  if (v.type === 'combine' && v.harvestT > 0 && Math.random() < dt * 30) {
    const bx = v.x - sh * 3.6, bz = v.z - ch * 3.6;
    emit(bx + (Math.random() - 0.5) * 1.5, 1.4, bz + (Math.random() - 0.5) * 1.5, CHAFF, 0.7,
      -sh * 1.2 + (Math.random() - 0.5), 0.3 + Math.random() * 0.5, -ch * 1.2 + (Math.random() - 0.5), 1.8, 0.2);
  }
}

/* ---------- grain logistics: combine → intake / trailer, trailer → intake ---------- */

const PIPE_RATE = 1800; // l/s through the combine pipe
const TIP_RATE = 2600; // l/s when the trailer tips at the intake
const _v = new THREE.Vector3();

export const hasTrailer = () => tractor.impl === 'trailer';

/** Where the extended combine pipe ends, in world x/z (pipe swings out to the combine's left). */
export function pipeEnd() {
  const lx = 1.05 + 4.6, lz = -1.9, s = Math.sin(combine.h), c = Math.cos(combine.h);
  return { x: combine.x + c * lx + s * lz, z: combine.z - s * lx + c * lz };
}

/** True when the trailer body is under the (extended) combine pipe, with a little slack. */
export function trailerInReach() {
  if (!hasTrailer()) return false;
  const p = pipeEnd(), dx = p.x - trailer.x, dz = p.z - trailer.z;
  const s = Math.sin(trailer.h), c = Math.cos(trailer.h);
  const lx = dx * c - dz * s, lz = dx * s + dz * c; // into trailer-local coordinates
  return Math.abs(lx) < 1.8 && lz > -2.6 && lz < 4.2;
}

/** Same crop (or empty), and no bales on board. */
const trailerAccepts = crop => trailer.bales === 0 && (trailer.tank.amount <= 0 || trailer.tank.crop === crop);

function sellToast(who, onDone) {
  if (who.sold > 0) {
    toast('Prodáno ' + fmt(who.sold) + ' l ' + CROPS[who.soldCrop].gen + ' za ' + fmt(who.soldMoney) + ' Kč', 'good');
    onDone?.();
  }
  who.sold = 0; who.soldMoney = 0;
}

function stopCombine(onDone) {
  const c = combine;
  sellToast(c, onDone);
  if (c.moved > 0) { toast('Přeloženo ' + fmt(c.moved) + ' l ' + CROPS[c.movedCrop].gen + ' do přívěsu', 'good'); onDone?.(); }
  c.unloading = false; c.moved = 0; c.waiting = null;
  if (c.tank.amount <= 0) c.tank.crop = -1;
}

export function startCombineUnload() {
  const c = combine;
  c.unloading = true; c.sold = 0; c.soldMoney = 0; c.soldCrop = c.tank.crop; c.moved = 0; c.movedCrop = c.tank.crop; c.waiting = null;
}
export const stopCombineUnload = onDone => stopCombine(onDone);

function pour(x, y, z, crop, dt, spread = 0.4) {
  if (Math.random() < dt * 40) emit(x, y, z, CROPS[crop].cols[4], 0.4, (Math.random() - 0.5) * spread, -1, (Math.random() - 0.5) * spread, 0.9, 6);
}

/**
 * Runs every frame. The combine pipe sells at the intake or fills the trailer when the trailer
 * is under it; if neither, it waits with the pipe out (c.waiting says why, the HUD shows it).
 * The trailer sells grain by tipping inside the intake ring and picks up bales it passes.
 */
export function updateLogistics(dt, onDone) {
  const c = combine;
  if (c.unloading) {
    const toTrailer = !inSell(c) && trailerInReach();
    if (c.tank.amount <= 0) stopCombine(onDone);
    else if (!inSell(c) && !hasTrailer()) stopCombine(onDone);
    else if (!inSell(c) && !toTrailer) c.waiting = 'reach';
    else if (toTrailer && !trailerAccepts(c.tank.crop)) {
      c.waiting = 'mix';
      warn('mixT', trailer.bales ? 'V přívěsu jsou balíky. Nejdřív je prodej u stodoly.' : 'V přívěsu je jiná plodina. Nejdřív ho prodej.');
    } else if (toTrailer && trailer.tank.amount >= trailer.tank.cap - 1) { c.waiting = 'full'; warn('fullT', 'Přívěs je plný. Odvez ho k silům.'); }
    else if (c.pipe.rotation.y < -1.3) { // pipe is out
      c.waiting = null;
      const crop = c.tank.crop;
      let amt = Math.min(c.tank.amount, PIPE_RATE * dt);
      if (toTrailer) {
        amt = Math.min(amt, trailer.tank.cap - trailer.tank.amount);
        trailer.tank.crop = crop; trailer.tank.amount += amt; c.moved += amt;
      } else {
        const pr = price(crop, G.gameMin);
        c.sold += amt; c.soldMoney += amt * pr; G.money += amt * pr; G.flashT = 0.4;
      }
      c.tank.amount -= amt;
      _v.set(0, -0.3, -4.6); c.pipe.localToWorld(_v);
      pour(_v.x, _v.y, _v.z, crop, dt);
    }
  }

  const t = trailer;
  if (t.tipping) {
    if (!hasTrailer() || !inSell(trailerCenter()) || t.tank.amount <= 0) stopTipping(onDone);
    else if (t.tip.rotation.x < -0.5) { // body is up
      const crop = t.tank.crop, amt = Math.min(t.tank.amount, TIP_RATE * dt), pr = price(crop, G.gameMin);
      t.tank.amount -= amt; t.sold += amt; t.soldMoney += amt * pr; G.money += amt * pr; G.flashT = 0.4;
      _v.set((Math.random() - 0.5) * 1.8, 0.2, 0); t.tip.localToWorld(_v);
      pour(_v.x, _v.y, _v.z, crop, dt, 0.8);
    }
  }

  // auto-loading bales: any bale within reach of the trailer body jumps on board
  if (hasTrailer() && bales.length) {
    const tc = trailerCenter();
    for (let i = bales.length - 1; i >= 0; i--) {
      const b = bales[i];
      if (Math.hypot(b.x - tc.x, b.z - tc.z) > 3.4) continue;
      if (t.tank.amount > 0) { warn('baleGrain', 'V přívěsu je zrno. Balíky naložíš až do prázdného přívěsu.'); break; }
      if (t.bales >= t.baleCap) { warn('baleFull', 'Přívěs je plný balíků. Odvez je ke stodole.'); break; }
      removeBale(i); t.bales++;
      warn('baleLoad', 'V přívěsu: ' + plural(t.bales, 'balík', 'balíky', 'balíků') + ' z ' + t.baleCap + '.', '');
    }
  }
}

export function startTipping() {
  trailer.tipping = true; trailer.sold = 0; trailer.soldMoney = 0; trailer.soldCrop = trailer.tank.crop;
}
export function stopTipping(onDone) {
  sellToast(trailer, onDone);
  trailer.tipping = false;
  if (trailer.tank.amount <= 0) trailer.tank.crop = -1;
}

/** Sells all bales from the trailer at the barn. */
export function sellBales(onDone) {
  const n = trailer.bales, pr = balePrice(G.gameMin);
  if (!n) return;
  G.money += n * pr; G.flashT = 0.4;
  trailer.bales = 0;
  toast('Prodáno ' + plural(n, 'balík', 'balíky', 'balíků') + ' slámy za ' + fmt(n * pr) + ' Kč', 'good');
  onDone?.();
}
