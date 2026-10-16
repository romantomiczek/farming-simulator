import { stat, earn } from './goals.js';
import * as THREE from 'three';
import { lerp, fmt, plural } from '../core/util.js';
import { G } from './state.js';
import {
  CROPS, HEADERS, S_STUB, S_CULT, S_SOWN, S_RIPE, B_FERT, B_PLOW, FERT_COST, yieldMult, balePrice, hayPrice, S_NONE,
} from './crops.js';
import { fieldAt, drawCell, updCrop, drawMini } from '../world/fields.js';
import { BALE_CELLS, HARVESTERS, toolLine, tools, towed, trailerCenter } from '../vehicles/vehicles.js';
import { baleZone } from '../world/layout.js';
import { marketAt, accepts, marketPrice } from './markets.js';
import { BUILDINGS, space, addFeed, partOf } from './farm.js';
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
  if (s === S_NONE) return; // grass outside a shaped field
  let changed = false, setDir = true;
  if (f.meadow) {
    // meadows: only the mower and the baler do anything here
    const tool = v.type === 'tractor' ? v.impl : null;
    if (tool === 'mower' && s === S_RIPE) {
      f.state[i] = S_STUB; f.growth[i] = 0; f.stage[i] = 0;
      f.straw[i] = Math.abs(k) < 0.9 ? 1 : 0; // the swath lies in the middle of the cut
      changed = true; stat('mown');
    } else if (tool === 'baler' && f.straw[i]) {
      f.straw[i] = 0; v.baleAcc++; v.hayAcc = (v.hayAcc || 0) + 1; changed = true; setDir = false;
    } else if (tool !== 'mower' && tool !== 'baler') { res.meadow = f; return; }
    if (changed) {
      if (setDir) f.dir[i] = dirBit;
      drawCell(f, i); updCrop(f, i); drawMini(f, i);
      res.changed++;
    }
    res.onField = true;
    return;
  }
  if (v.type === 'tractor') {
    switch (v.impl) {
      case 'cultivator':
        if (s === S_STUB) { f.state[i] = S_CULT; f.straw[i] = 0; changed = true; stat('cult'); }
        break;
      case 'plough':
        if ((s === S_STUB || s === S_CULT) && !(f.bonus[i] & B_PLOW)) { f.state[i] = S_CULT; f.bonus[i] |= B_PLOW; f.straw[i] = 0; changed = true; stat('plough'); }
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
          changed = true; stat('sown');
        } else if (s === S_STUB) res.stub = true;
        break;
      case 'spreader':
        if (s !== S_RIPE && !(f.bonus[i] & B_FERT)) {
          if (!job) {
            if (G.money < FERT_COST) { res.blocked = 'money'; return; }
            G.money -= FERT_COST;
          }
          f.bonus[i] |= B_FERT; changed = true; setDir = false; stat('fert');
        }
        break;
      case 'baler':
        if (f.straw[i]) { f.straw[i] = 0; v.baleAcc++; changed = true; setDir = false; }
        break;
      case 'mower':
        res.noGrass = true;
        break;
    }
  } else if (s === S_RIPE) {
    const c = f.crop[i], cr = CROPS[c], tk = v.tank;
    if (cr.header !== v.header) { res.blocked = 'header'; res.needHeader = cr.header; return; }
    if (isWet()) { res.blocked = 'wet'; return; }
    if (!job) {
      if (tk.amount > 0 && tk.crop !== c) { res.blocked = 'mix'; return; }
      const y = cr.yield * yieldMult(f.bonus[i]) * f.q;
      if (tk.amount + y > tk.cap) { res.blocked = 'full'; return; }
      tk.crop = c; tk.amount += y; stat('harvest', y, c);
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
  if (res.meadow && !res.changed) warn('meadow', 'Louka ' + res.meadow.id + ': tady se jen seče žací lištou a lisuje seno. Polní nářadí ani kombajn tu nic neudělají.');
  if (res.noGrass && !res.changed) warn('noGrass', 'Žací lišta seče jen louky (u řeky a u rybníků).');

  // baler: drop a bale behind the chamber every BALE_CELLS of straw
  if (v.type === 'tractor' && v.impl === 'baler') {
    while (v.baleAcc >= BALE_CELLS) {
      v.baleAcc -= BALE_CELLS;
      const bz = v.hitchZ - 4.2;
      // a bale is hay when most of what went in came from a meadow
      const hay = (v.hayAcc || 0) >= BALE_CELLS / 2;
      v.hayAcc = Math.max(0, (v.hayAcc || 0) - BALE_CELLS);
      if (addBale(v.x + sh * bz, v.z + ch * bz, v.h, hay)) { stat(hay ? 'hay' : 'bales'); warn('bale', hay ? 'Lis vyhodil balík sena.' : 'Lis vyhodil balík slámy.', ''); }
    }
  }

  if (res.onField && v.tool && Math.random() < dt * (v.impl === 'spreader' ? 70 : 45)) {
    const k = (Math.random() - 0.5) * W, im = v.tool;
    const up = v.impl === 'spreader' ? 0.4 : 0.6 + Math.random() * 0.6;
    emit(cx + rx * k, (v.impl === 'spreader' ? 0.6 : 0.3) + (v.y || 0), cz + rz * k, im.dust, v.impl === 'spreader' ? 0.25 : 0.9 + Math.random() * 0.6,
      (Math.random() - 0.5) * 0.6 - sh * 0.6, up, (Math.random() - 0.5) * 0.6 - ch * 0.6, v.impl === 'spreader' ? 0.7 : 1.4 + Math.random() * 0.6, v.impl === 'spreader' ? 2 : 0);
  }
  if (v.harvester && v.harvestT > 0 && Math.random() < dt * 30) {
    const bx = v.x - sh * 3.6, bz = v.z - ch * 3.6;
    emit(bx + (Math.random() - 0.5) * 1.5, 1.4 + (v.y || 0), bz + (Math.random() - 0.5) * 1.5, v.chaff, 0.7,
      -sh * 1.2 + (Math.random() - 0.5), 0.3 + Math.random() * 0.5, -ch * 1.2 + (Math.random() - 0.5), 1.8, 0.2);
  }
}

/* ---------- crop logistics: harvester → intake / trailer, trailer → intake ---------- */

const PIPE_RATE = 1800; // l/s through a harvester pipe or elevator
const TIP_RATE = 2600; // l/s when the trailer tips at the intake
const _v = new THREE.Vector3();

/** Does v tow a trailer? */
export const hasTrailer = v => !!towed(v);
/** Is any trailer hitched to a tractor? */
const anyTowed = () => tools.some(t => t.key === 'trailer' && t.on);

/** Where the extended unloading pipe of harvester h ends, in world x/z (it swings out to the left). */
export function pipeEnd(h) {
  const { lx, lz } = h.pipeReach, s = Math.sin(h.h), c = Math.cos(h.h);
  return { x: h.x + c * lx + s * lz, z: h.z - s * lx + c * lz };
}

/** True when trailer t's body is under harvester h's (extended) pipe, with a little slack. */
export function trailerInReach(h, t) {
  if (!t?.on) return false;
  const p = pipeEnd(h), dx = p.x - t.x, dz = p.z - t.z;
  const s = Math.sin(t.h), c = Math.cos(t.h);
  const lx = dx * c - dz * s, lz = dx * s + dz * c; // into trailer-local coordinates
  return Math.abs(lx) < 1.8 && lz > -2.6 && lz < 4.2;
}
/** The hitched trailer under harvester h's pipe, or null. */
export const trailerUnder = h => tools.find(t => t.key === 'trailer' && trailerInReach(h, t)) || null;

/** Same crop (or empty), and no bales on board. */
const trailerAccepts = (t, crop) => t.bales === 0 && (t.tank.amount <= 0 || t.tank.crop === crop);

/** Hands amt litres of crop to buyer or feed trough m; returns how much was taken. */
function deliver(m, crop, amt, who) {
  if (m.feed) {
    const b = BUILDINGS[m.feed], take = Math.min(amt, space(m.feed));
    addFeed(m.feed, take, partOf(crop)); who.fed = (who.fed || 0) + take; who.fedAt = b.name; who.fedCrop = crop;
    if (take <= 0) warn('feedFull', 'Krmelec (' + b.name + ') je plný.');
    return take;
  }
  const pr = marketPrice(m, crop, G.gameMin);
  who.soldAt = m.name; who.sold += amt; who.soldMoney += amt * pr; G.money += amt * pr; earn(amt * pr); G.flashT = 0.4;
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
  const m = sellPoint(h, h.tank.crop), t = m ? null : trailerUnder(h);
  if (h.tank.amount <= 0) stopUnload(h, onDone);
  else if (!m && !anyTowed()) stopUnload(h, onDone);
  else if (!m && !t) h.waiting = 'reach';
  else if (t && !trailerAccepts(t, h.tank.crop)) {
    h.waiting = 'mix';
    warn('mixT', t.bales ? 'V přívěsu jsou balíky. Nejdřív je prodej u stodoly.' : 'V přívěsu je jiná plodina. Nejdřív ho prodej.');
  } else if (t && t.tank.amount >= t.tank.cap - 1) { h.waiting = 'full'; warn('fullT', 'Přívěs je plný. Odvez ho k silům.'); }
  else if (h.pipe.rotation.y < -1.3) { // pipe is out
    h.waiting = null;
    const crop = h.tank.crop;
    let amt = Math.min(h.tank.amount, (h.pipeRate || PIPE_RATE) * dt);
    if (t) {
      amt = Math.min(amt, t.tank.cap - t.tank.amount);
      t.tank.crop = crop; t.tank.amount += amt; h.moved += amt;
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
  for (const t of tools) if (t.key === 'trailer') trailerLogistics(t, dt, onDone);
}

function trailerLogistics(t, dt, onDone) {
  if (t.tipping) {
    const m = t.on && sellPoint(trailerCenter(t), t.tank.crop);
    if (!m || t.tank.amount <= 0) stopTipping(t, onDone);
    else if (t.tip.rotation.x < -0.5) { // body is up
      const crop = t.tank.crop, amt = deliver(m, crop, Math.min(t.tank.amount, TIP_RATE * dt), t);
      if (amt <= 0) { stopTipping(t, onDone); return; }
      t.tank.amount -= amt;
      _v.set((Math.random() - 0.5) * 1.8, 0.2, 0); t.tip.localToWorld(_v);
      pour(_v.x, _v.y, _v.z, crop, dt, 0.8);
    }
  }

  // auto-loading bales: any bale within reach of a hitched trailer's body jumps on board
  if (t.on && bales.length) {
    const tc = trailerCenter(t);
    for (let i = bales.length - 1; i >= 0; i--) {
      const b = bales[i];
      if (Math.hypot(b.x - tc.x, b.z - tc.z) > 3.4) continue;
      if (t.tank.amount > 0) { warn('baleGrain', 'V přívěsu je zrno. Balíky naložíš až do prázdného přívěsu.'); break; }
      if (t.bales >= t.baleCap) { warn('baleFull', 'Přívěs je plný balíků. Odvez je ke stodole.'); break; }
      removeBale(i); t.bales++; if (b.hay) t.hay = (t.hay || 0) + 1;
      warn('baleLoad', 'V přívěsu: ' + plural(t.bales, 'balík', 'balíky', 'balíků') + ' z ' + t.baleCap + '.', '');
    }
  }
}

export function startTipping(t) {
  t.tipping = true; t.fed = 0; t.sold = 0; t.soldMoney = 0; t.soldCrop = t.tank.crop;
}
export function stopTipping(t, onDone) {
  sellToast(t, onDone);
  t.tipping = false;
  if (t.tank.amount <= 0) t.tank.crop = -1;
}

/** What the bales in trailer t fetch at the barn now: straw and hay are priced apart. */
export function baleValue(t) {
  const hay = t.hay || 0, straw = t.bales - hay;
  return { straw, hay, money: Math.round(straw * balePrice(G.gameMin) + hay * hayPrice(G.gameMin)) };
}
/** Sells all bales from trailer t at the barn. */
export function sellBales(t, onDone) {
  const { straw, hay, money } = baleValue(t);
  if (!straw && !hay) return;
  G.money += money; earn(money); G.flashT = 0.4;
  t.bales = 0; t.hay = 0;
  const parts = [];
  if (straw) parts.push(plural(straw, 'balík', 'balíky', 'balíků') + ' slámy');
  if (hay) parts.push(plural(hay, 'balík', 'balíky', 'balíků') + ' sena');
  toast('Prodáno ' + parts.join(' a ') + ' za ' + fmt(money) + ' Kč', 'good');
  onDone?.();
}
