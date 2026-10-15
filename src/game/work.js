import * as THREE from 'three';
import { lerp, fmt, plural } from '../core/util.js';
import { G } from './state.js';
import {
  CROPS, HEADERS, S_STUB, S_CULT, S_SOWN, S_RIPE, B_FERT, B_PLOW, FERT_COST, yieldMult, balePrice,
} from './crops.js';
import { fieldAt, drawCell, updCrop, drawMini } from '../world/fields.js';
import { IMPL, BALE_CELLS, HARVESTERS, toolLine, tractor, trailer, trailerCenter } from '../vehicles/vehicles.js';
import { baleZone } from '../world/layout.js';
import { marketAt, accepts, marketPrice } from './markets.js';
import { BUILDINGS, space } from './farm.js';
import { bales, addBale, removeBale } from '../world/bales.js';
import { emit } from '../fx/particles.js';
import { toast, warn } from '../ui/toast.js';
import { contractAllows, contractCell } from './contracts.js';
import { season, isWet } from './weather.js';

const inZone = (zone, p) => Math.hypot(p.x - zone.x, p.z - zone.z) < zone.r;
/** The buyer at point p if it takes crop, else null. */
export const sellPoint = (p, crop) => { const m = marketAt(p); return m && accepts(m, crop) ? m : null; };
export const inBaleZone = p => inZone(baleZone, p);

/**
 * Applies the vehicle's tool to the field cell under world point (x, z).
 * k = lateral offset from the vehicle's centre line (the combine drops straw near the middle).
 */
function applyCell(v, x, z, k, dirBit, res) {
  const f = fieldAt(x, z);
  if (!f) return;
  const job = !f.owned; // working the neighbour's field on a contract: free seed and fertiliser, harvest goes to him
  if (job && !contractAllows(f, v)) { res.notOwned = f; return; }
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
          if (!season().sow) { res.blocked = 'winter'; return; }
          const crop = job ? G.contracts.active.crop : v.seedCrop, cr = CROPS[crop];
          if (!job) {
            if (G.money < cr.seed) { res.blocked = 'money'; return; }
            G.money -= cr.seed;
          }
          f.state[i] = S_SOWN; f.crop[i] = crop; f.growth[i] = 0; f.stage[i] = 0;
          changed = true;
        } else if (s === S_STUB) res.stub = true;
        break;
      case 'spreader':
        if (s !== S_RIPE && !(f.bonus[i] & B_FERT)) {
          if (!job) {
            if (G.money < FERT_COST) { res.blocked = 'money'; return; }
            G.money -= FERT_COST;
          }
          f.bonus[i] |= B_FERT; changed = true; setDir = false;
        }
        break;
      case 'baler':
        if (f.straw[i]) { f.straw[i] = 0; v.baleAcc++; changed = true; setDir = false; }
        break;
    }
  } else if (s === S_RIPE) {
    const c = f.crop[i], cr = CROPS[c], tk = v.tank;
    if (cr.header !== v.header) { res.blocked = 'header'; res.needHeader = cr.header; return; }
    if (isWet()) { res.blocked = 'wet'; return; }
    if (!job) {
      if (tk.amount > 0 && tk.crop !== c) { res.blocked = 'mix'; return; }
      const y = cr.yield * yieldMult(f.bonus[i]);
      if (tk.amount + y > tk.cap) { res.blocked = 'full'; return; }
      tk.crop = c; tk.amount += y;
    }
    f.state[i] = S_STUB; f.stage[i] = 0; f.bonus[i] = 0;
    f.straw[i] = cr.straw && Math.abs(k) < 0.9 ? 1 : 0;
    v.harvestT = 0.35;
    changed = true;
  }
  if (changed) {
    if (job) contractCell();
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

  if (res.notOwned && !res.onField) warn('own', 'Pole ' + res.notOwned.id + ' ti nepatří. Koupit ho můžeš u cedule u cesty, nebo na něm vzít zakázku v Kanceláři (K).');
  if (res.blocked === 'money') {
    v.lowered = false;
    warn('money', v.impl === 'spreader' ? 'Došly peníze na hnojivo. Prodej úrodu.' : 'Došly peníze na osivo. Prodej úrodu.');
  }
  if (res.blocked === 'full') warn('full', 'Zásobník je plný. Přelož úrodu do přívěsu nebo jeď k silům.');
  if (res.blocked === 'mix') warn('mix', 'V zásobníku je jiná plodina. Nejdřív ji prodej.');
  if (res.blocked === 'header') {
    warn('header', res.needHeader === 'beet' ? 'Cukrovku sklidí jen sklízeč cukrovky. Přesedni do něj klávesou Tab.'
      : v.header === 'beet' ? 'Sklízeč cukrovky sklízí jen cukrovku.'
      : 'Na tuhle plodinu potřebuješ ' + HEADERS[res.needHeader].short + '. Vyměníš ho v kůlně.');
  }
  if (res.blocked === 'wet') warn('wet', 'Za deště a hodinu po něm se nesklízí, plodiny musí oschnout.');
  if (res.blocked === 'winter') { v.lowered = false; warn('winter', 'V zimě se nesije. Počkej na jaro.'); }
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
  if (v.harvester && v.harvestT > 0 && Math.random() < dt * 30) {
    const bx = v.x - sh * 3.6, bz = v.z - ch * 3.6;
    emit(bx + (Math.random() - 0.5) * 1.5, 1.4, bz + (Math.random() - 0.5) * 1.5, v.chaff, 0.7,
      -sh * 1.2 + (Math.random() - 0.5), 0.3 + Math.random() * 0.5, -ch * 1.2 + (Math.random() - 0.5), 1.8, 0.2);
  }
}

/* ---------- crop logistics: harvester → intake / trailer, trailer → intake ---------- */

const PIPE_RATE = 1800; // l/s through a harvester pipe or elevator
const TIP_RATE = 2600; // l/s when the trailer tips at the intake
const _v = new THREE.Vector3();

export const hasTrailer = () => tractor.impl === 'trailer';

/** Where the extended unloading pipe of harvester h ends, in world x/z (it swings out to the left). */
export function pipeEnd(h) {
  const { lx, lz } = h.pipeReach, s = Math.sin(h.h), c = Math.cos(h.h);
  return { x: h.x + c * lx + s * lz, z: h.z - s * lx + c * lz };
}

/** True when the trailer body is under harvester h's (extended) pipe, with a little slack. */
export function trailerInReach(h) {
  if (!hasTrailer()) return false;
  const p = pipeEnd(h), dx = p.x - trailer.x, dz = p.z - trailer.z;
  const s = Math.sin(trailer.h), c = Math.cos(trailer.h);
  const lx = dx * c - dz * s, lz = dx * s + dz * c; // into trailer-local coordinates
  return Math.abs(lx) < 1.8 && lz > -2.6 && lz < 4.2;
}

/** Same crop (or empty), and no bales on board. */
const trailerAccepts = crop => trailer.bales === 0 && (trailer.tank.amount <= 0 || trailer.tank.crop === crop);

/** Hands amt litres of crop to buyer or feed trough m; returns how much was taken. */
function deliver(m, crop, amt, who) {
  if (m.feed) {
    const b = BUILDINGS[m.feed], take = Math.min(amt, space(m.feed));
    G.farm[b.store] += take; who.fed = (who.fed || 0) + take; who.fedAt = b.name; who.fedCrop = crop;
    if (take <= 0) warn('feedFull', 'Krmelec (' + b.name + ') je plný.');
    return take;
  }
  const pr = marketPrice(m, crop, G.gameMin);
  who.soldAt = m.name; who.sold += amt; who.soldMoney += amt * pr; G.money += amt * pr; G.flashT = 0.4;
  return amt;
}

function sellToast(who, onDone) {
  if (who.fed > 0) { toast('Vyloženo ' + fmt(who.fed) + ' l ' + CROPS[who.fedCrop].gen + ' do krmelce · ' + who.fedAt, 'good'); onDone?.(); }
  who.fed = 0;
  if (who.sold > 0) {
    toast('Prodáno ' + fmt(who.sold) + ' l ' + CROPS[who.soldCrop].gen + ' za ' + fmt(who.soldMoney) + ' Kč · ' + who.soldAt, 'good');
    onDone?.();
  }
  who.sold = 0; who.soldMoney = 0;
}

export function stopUnload(h, onDone) {
  sellToast(h, onDone);
  if (h.moved > 0) { toast('Přeloženo ' + fmt(h.moved) + ' l ' + CROPS[h.movedCrop].gen + ' do přívěsu', 'good'); onDone?.(); }
  h.unloading = false; h.moved = 0; h.waiting = null;
  if (h.tank.amount <= 0) h.tank.crop = -1;
}

export function startUnload(h) {
  h.unloading = true; h.fed = 0; h.sold = 0; h.soldMoney = 0; h.soldCrop = h.tank.crop; h.moved = 0; h.movedCrop = h.tank.crop; h.waiting = null;
}

function pour(x, y, z, crop, dt, spread = 0.4) {
  if (Math.random() < dt * 40) emit(x, y, z, CROPS[crop].heapCol, 0.4, (Math.random() - 0.5) * spread, -1, (Math.random() - 0.5) * spread, 0.9, 6);
}

/** One harvester's unloading: sells at the intake or fills the trailer under its pipe, else waits. */
function unloadHarvester(h, dt, onDone) {
  if (!h.unloading) return;
  const m = sellPoint(h, h.tank.crop), toTrailer = !m && trailerInReach(h);
  if (h.tank.amount <= 0) stopUnload(h, onDone);
  else if (!m && !hasTrailer()) stopUnload(h, onDone);
  else if (!m && !toTrailer) h.waiting = 'reach';
  else if (toTrailer && !trailerAccepts(h.tank.crop)) {
    h.waiting = 'mix';
    warn('mixT', trailer.bales ? 'V přívěsu jsou balíky. Nejdřív je prodej u stodoly.' : 'V přívěsu je jiná plodina. Nejdřív ho prodej.');
  } else if (toTrailer && trailer.tank.amount >= trailer.tank.cap - 1) { h.waiting = 'full'; warn('fullT', 'Přívěs je plný. Odvez ho k silům.'); }
  else if (h.pipe.rotation.y < -1.3) { // pipe is out
    h.waiting = null;
    const crop = h.tank.crop;
    let amt = Math.min(h.tank.amount, PIPE_RATE * dt);
    if (toTrailer) {
      amt = Math.min(amt, trailer.tank.cap - trailer.tank.amount);
      trailer.tank.crop = crop; trailer.tank.amount += amt; h.moved += amt;
    } else {
      amt = deliver(m, crop, amt, h);
      if (amt <= 0) { stopUnload(h, onDone); return; }
    }
    h.tank.amount -= amt;
    _v.copy(h.pipeTip); h.pipe.localToWorld(_v);
    pour(_v.x, _v.y, _v.z, crop, dt);
  }
}

/**
 * Runs every frame. Harvester pipes sell at the intake or fill the trailer when it is under them;
 * if neither, they wait with the pipe out (h.waiting says why, the HUD shows it).
 * The trailer sells grain by tipping inside the intake ring and picks up bales it passes.
 */
export function updateLogistics(dt, onDone) {
  for (const h of HARVESTERS) unloadHarvester(h, dt, onDone);

  const t = trailer;
  if (t.tipping) {
    const m = hasTrailer() && sellPoint(trailerCenter(), t.tank.crop);
    if (!m || t.tank.amount <= 0) stopTipping(onDone);
    else if (t.tip.rotation.x < -0.5) { // body is up
      const crop = t.tank.crop, amt = deliver(m, crop, Math.min(t.tank.amount, TIP_RATE * dt), t);
      if (amt <= 0) { stopTipping(onDone); return; }
      t.tank.amount -= amt;
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
  trailer.tipping = true; trailer.fed = 0; trailer.sold = 0; trailer.soldMoney = 0; trailer.soldCrop = trailer.tank.crop;
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
