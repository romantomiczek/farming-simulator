import { stat, earn } from './goals.js';
import * as THREE from 'three';
import { lerp, fmt, plural, col } from '../core/util.js';
import { G } from './state.js';
import {
  CROPS, HEADERS, S_STUB, S_CULT, S_SOWN, S_RIPE, B_FERT, B_PLOW, B_FERT2, B_ROLL, B_MULCH, B_STONE, FERT_COST, HERB_COST, LIME_COST, balePrice, hayPrice, S_NONE,
} from './crops.js';
import { fieldAt, drawCell, updCrop, drawMini } from '../world/fields.js';
import { BALE_CELLS, HARVESTERS, toolLine, tools, towed, trailerCenter, eyeOf } from '../vehicles/vehicles.js';
import { baleZone, SILO_LOAD } from '../world/layout.js';
import { store, sale, siloCrop, takeOut, inSiloLoad, LOAD_RATE, SILO_CAP } from './silo.js';
import { marketAt, accepts } from './markets.js';
import { BUILDINGS, space, addFeed, partOf } from './farm.js';
import { bales, addBale, removeBale } from '../world/bales.js';
import { emit } from '../fx/particles.js';
import { pourStream } from '../fx/streams.js';
import { freshSoil } from '../fx/furrows.js';
import { groundH } from '../world/terrain.js';

const MIST = col('#e6efe8'), CLOD = col('#5a3d2a'), CLOD_LIGHT = col('#7a5638'), STRAW_C = col('#e3c46a'), HAY_C = col('#b8c46a'), LEAF_C = col('#6f9a45');
import { toast, warn } from '../ui/toast.js';
import { contractAllows, contractCell } from './contracts.js';
import { cellYield, sowCell, harvestCell, sowable, sowSeasons, WEED_SPRAYED } from './agro.js';
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
        if ((s === S_STUB || s === S_CULT) && !(f.bonus[i] & B_PLOW)) {
          f.state[i] = S_CULT; f.bonus[i] |= B_PLOW; f.straw[i] = 0; changed = true; stat('plough');
          if (f.jit[i] < 0.05) f.bonus[i] |= B_STONE; // the plough turns up stones here and there: roll them in
        }
        break;
      case 'roller': // before or just after sowing: firmer seedbed (+5 %), the stones pressed in
        if ((s === S_CULT || (s === S_SOWN && f.stage[i] <= 1)) && !(f.bonus[i] & B_ROLL)) {
          f.bonus[i] = (f.bonus[i] | B_ROLL) & ~B_STONE; changed = true; setDir = false; stat('rolled');
        }
        break;
      case 'mulcher': // chops the stubble and straw (+5 %); the field still needs cultivating
        if (s === S_STUB && !(f.bonus[i] & B_MULCH)) { f.bonus[i] |= B_MULCH; f.straw[i] = 0; changed = true; stat('mulched'); }
        break;
      case 'sprayer': // herbicide on the growing crop: the weeds die and do not come back this season
        if (s === S_SOWN && !(f.weed[i] & WEED_SPRAYED)) {
          if (!job) {
            if (G.money < HERB_COST) { res.blocked = 'money'; return; }
            G.money -= HERB_COST;
          }
          f.weed[i] = WEED_SPRAYED; changed = true; setDir = false; stat('sprayed');
        }
        break;
      case 'seeder':
        if (s === S_CULT) {
          if (!season().sow) { res.blocked = 'winter'; return; }
          const crop = job ? G.contracts.active.crop : v.seedCrop, cr = CROPS[crop];
          if (!job && !sowable(crop)) { res.blocked = 'calendar'; res.crop = crop; return; }
          if (!job) {
            if (G.money < cr.seed) { res.blocked = 'money'; return; }
            G.money -= cr.seed;
          }
          sowCell(f, i, crop);
          f.state[i] = S_SOWN; f.crop[i] = crop; f.growth[i] = 0; f.stage[i] = 0;
          changed = true; stat('sown');
        } else if (s === S_STUB) res.stub = true;
        break;
      case 'spreader':
        if (v.spreadLime && !job) { // lime: the soil is sweet again for LIME_DUE harvests
          if (s !== S_RIPE && f.lime[i] > 0) {
            if (G.money < LIME_COST) { res.blocked = 'money'; return; }
            G.money -= LIME_COST; f.lime[i] = 0; changed = true; setDir = false; stat('limed');
          }
          break;
        }
        // fertiliser: the first dose any time before harvest, a second one on the grown crop
        if (s !== S_RIPE && (!(f.bonus[i] & B_FERT) || (!job && s === S_SOWN && f.stage[i] >= 2 && !(f.bonus[i] & B_FERT2)))) {
          if (!job) {
            if (G.money < FERT_COST) { res.blocked = 'money'; return; }
            G.money -= FERT_COST;
          }
          f.bonus[i] |= f.bonus[i] & B_FERT ? B_FERT2 : B_FERT; changed = true; setDir = false; stat('fert');
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
      const y = cr.yield * cellYield(f, i) * f.q;
      if (tk.amount + y > tk.cap) { res.blocked = 'full'; return; }
      tk.crop = c; tk.amount += y; stat('harvest', y, c);
    }
    if (f.bonus[i] & B_STONE) { v.cond = Math.max(0, v.cond - 0.0004); res.stones = true; } // stones hit the header
    harvestCell(f, i);
    f.state[i] = S_STUB; f.stage[i] = 0; f.bonus[i] = 0; f.growth[i] = 0;
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
  // a trailed implement (baler) works where it really is, behind its own drawbar
  const e = v.tool?.trailed ? eyeOf(v.tool) : null, h = e ? e.h : v.h;
  const sh = Math.sin(h), ch = Math.cos(h), rx = ch, rz = -sh;
  const cx = e ? e.x + sh * v.tool.workZ : v.x + sh * Z, cz = e ? e.z + ch * v.tool.workZ : v.z + ch * Z;
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
    warn('money', v.impl === 'spreader' ? (v.spreadLime ? 'Došly peníze na vápno. Prodej úrodu.' : 'Došly peníze na hnojivo. Prodej úrodu.') : v.impl === 'sprayer' ? 'Došly peníze na postřik. Prodej úrodu.' : 'Došly peníze na osivo. Prodej úrodu.');
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
  if (res.blocked === 'calendar') { v.lowered = false; warn('calendar', CROPS[res.crop].name + ' se teď neseje (seje se: ' + sowSeasons(res.crop) + '). Klávesou C vyber jinou plodinu.'); }
  if (res.stones) warn('stones', 'Kameny na poli poškozují lištu. Po orbě pole uválcuj, válec je zatlačí do země.');
  if (res.stub && !res.changed) warn('stub', 'Secí stroj potřebuje zkultivovanou nebo zoranou půdu.', '');
  if (res.meadow && !res.changed) warn('meadow', 'Louka ' + res.meadow.id + ': tady se jen seče žací lištou a lisuje seno. Polní nářadí ani kombajn tu nic neudělají.');
  if (res.noGrass && !res.changed) warn('noGrass', 'Žací lišta seče jen louky (u řeky a u rybníků).');

  // baler: drop a bale behind the chamber every BALE_CELLS of straw
  if (v.type === 'tractor' && v.impl === 'baler') {
    while (v.baleAcc >= BALE_CELLS) {
      v.baleAcc -= BALE_CELLS;
      const bz = -4.2, bx = (e ? e.x : v.x + sh * v.hitchZ) + sh * bz, bzz = (e ? e.z : v.z + ch * v.hitchZ) + ch * bz;
      // a bale is hay when most of what went in came from a meadow
      const hay = (v.hayAcc || 0) >= BALE_CELLS / 2;
      v.hayAcc = Math.max(0, (v.hayAcc || 0) - BALE_CELLS);
      if (addBale(bx, bzz, h, hay)) {
        stat(hay ? 'hay' : 'bales'); warn('bale', hay ? 'Lis vyhodil balík sena.' : 'Lis vyhodil balík slámy.', '');
        // a puff of loose straw as the bale drops out
        for (let i = 0; i < 14; i++) emit(bx + (Math.random() - 0.5) * 1.4, 0.9 + (v.y || 0), bzz + (Math.random() - 0.5) * 1.4, hay ? HAY_C : STRAW_C, 0.3 + Math.random() * 0.25,
          (Math.random() - 0.5) * 2, 0.8 + Math.random(), (Math.random() - 0.5) * 2, 1.1, 4);
      }
    }
  }

  if (res.onField && v.impl === 'sprayer' && Math.random() < dt * 90) { // fine mist under the boom
    const k = (Math.random() - 0.5) * W;
    emit(cx + rx * k, 0.7 + (v.y || 0), cz + rz * k, MIST, 0.22, (Math.random() - 0.5) * 0.3, -0.4, (Math.random() - 0.5) * 0.3, 0.6, 1);
  }
  if (res.onField && v.tool && v.impl !== 'sprayer' && Math.random() < dt * (v.impl === 'spreader' ? 70 : 45)) {
    const k = (Math.random() - 0.5) * W, im = v.tool;
    const up = v.impl === 'spreader' ? 0.4 : 0.6 + Math.random() * 0.6;
    emit(cx + rx * k, (v.impl === 'spreader' ? 0.6 : 0.3) + (v.y || 0), cz + rz * k, im.dust, v.impl === 'spreader' ? 0.25 : 0.9 + Math.random() * 0.6,
      (Math.random() - 0.5) * 0.6 - sh * 0.6, up, (Math.random() - 0.5) * 0.6 - ch * 0.6, v.impl === 'spreader' ? 0.7 : 1.4 + Math.random() * 0.6, v.impl === 'spreader' ? 2 : 0);
  }
  if (v.harvester && v.harvestT > 0) {
    const p = v.bodyPart, back = p.cz - p.hz, bx = v.x + sh * back, bz = v.z + ch * back, y = v.y || 0;
    if (v.type === 'combine' && Math.random() < dt * 75) {
      // the chopper spreads straw and chaff in a fan behind the combine
      const fan = (Math.random() - 0.5) * 2, out = 3 + Math.random() * 2.2;
      emit(bx + rx * fan * 0.6, 1.5 + y, bz + rz * fan * 0.6, Math.random() < 0.65 ? STRAW_C : v.chaff, 0.32 + Math.random() * 0.3,
        -sh * out + rx * fan * 2.4, 0.5 + Math.random() * 0.9, -ch * out + rz * fan * 2.4, 1.3, 3);
    }
    if (v.type === 'beet' && Math.random() < dt * 40) {
      // the beet harvester drops soil behind it and throws beet leaves off at the front
      const fan = (Math.random() - 0.5) * W;
      emit(bx + rx * fan * 0.5, 1.0 + y, bz + rz * fan * 0.5, Math.random() < 0.5 ? CLOD : CLOD_LIGHT, 0.35 + Math.random() * 0.2, -sh * 1.5, 0.5, -ch * 1.5, 0.8, 9);
      emit(cx + rx * fan, 0.6 + y, cz + rz * fan, LEAF_C, 0.28, rx * (Math.random() - 0.5) * 3, 1.2 + Math.random(), rz * (Math.random() - 0.5) * 3, 1, 6);
    }
  }
  if (res.onField && v.impl === 'mulcher' && Math.random() < dt * 40) { // chopped straw blown out behind the hood
    const k = (Math.random() - 0.5) * W;
    emit(cx + rx * k, 0.4 + (v.y || 0), cz + rz * k, STRAW_C, 0.25, -sh * 1.2 + (Math.random() - 0.5), 0.8 + Math.random() * 0.6, -ch * 1.2 + (Math.random() - 0.5), 0.9, 5);
  }
  if (res.onField && (v.impl === 'plough' || v.impl === 'cultivator') && Math.random() < dt * (v.impl === 'plough' ? 45 : 28)) {
    // clods: the mouldboards turn the soil over to the right, the cultivator tines toss it up
    const k = (Math.random() - 0.5) * W, plough = v.impl === 'plough', side = plough ? -(1.1 + Math.random()) : (Math.random() - 0.5) * 0.8;
    emit(cx + rx * k, 0.3 + (v.y || 0), cz + rz * k, Math.random() < 0.6 ? CLOD : CLOD_LIGHT, 0.3 + Math.random() * 0.2,
      rx * side - sh * 0.5, 1.4 + Math.random() * 1.2, rz * side - ch * 0.5, 0.8, 9);
  }
  if (res.onField && v.impl === 'baler' && Math.random() < dt * 25) {
    // the pick-up lifts the windrow: loose straw and hay flicks up
    const k = (Math.random() - 0.5) * W;
    emit(cx + rx * k, 0.4 + (v.y || 0), cz + rz * k, v.hayAcc > 0 ? HAY_C : STRAW_C, 0.28, (Math.random() - 0.5), 1.2 + Math.random(), (Math.random() - 0.5), 0.9, 5);
  }
  // freshly worked soil stays darker behind the tool for a couple of minutes
  if (res.onField && (v.impl === 'cultivator' || v.impl === 'plough' || v.impl === 'seeder')) {
    v.freshAcc = (v.freshAcc || 0) + Math.abs(v.speed) * dt;
    if (v.freshAcc >= 1.2) {
      v.freshAcc = 0;
      const f = fieldAt(cx, cz);
      if (f) freshSoil(cx - sh * 0.6, f.y + 0.045, cz - ch * 0.6, v.h, W, 1.45, v.impl === 'plough' ? 1 : v.impl === 'seeder' ? 0.45 : 0.8);
    }
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

/** Hands amt litres of crop to buyer or feed trough m (or to the silos: who.store); returns how much was taken. */
function deliver(m, crop, amt, who) {
  if (who.store) {
    const take = store(crop, amt);
    who.stored = (who.stored || 0) + take; who.storedCrop = crop;
    if (take <= 0) warn('siloFull', 'Sila jsou plná (' + fmt(SILO_CAP) + ' l). Prodej část zásoby.');
    return take;
  }
  if (m.feed) {
    const b = BUILDINGS[m.feed], take = Math.min(amt, space(m.feed));
    addFeed(m.feed, take, partOf(crop)); who.fed = (who.fed || 0) + take; who.fedAt = b.name; who.fedCrop = crop;
    if (take <= 0) warn('feedFull', 'Krmelec (' + b.name + ') je plný.');
    return take;
  }
  const money = sale(m, crop, amt); // with the premium of a delivery contract, when there is one
  who.soldAt = m.name; who.sold += amt; who.soldMoney += money; G.money += money; earn(money); G.flashT = 0.4;
  return amt;
}

function sellToast(who, onDone) {
  if (who.stored > 0) { toast('Uskladněno ' + fmt(who.stored) + ' l ' + CROPS[who.storedCrop].gen + ' v silu · celkem ' + fmt(G.silo.stock[who.storedCrop]) + ' l', 'good'); onDone?.(); }
  who.stored = 0; who.store = false;
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

/** store = into the farm silos instead of selling (G at the farm intake). */
export function startUnload(h, store = false) {
  h.store = store;
  h.unloading = true; h.fed = 0; h.sold = 0; h.soldMoney = 0; h.soldCrop = h.tank.crop; h.moved = 0; h.movedCrop = h.tank.crop; h.waiting = null;
}

/** Grain falling from (x, y, z) down to y1: a solid stream (owner = the pouring machine) and a spray of kernels. */
function pour(owner, x, y, z, y1, crop, dt, spread = 0.4, width = 0.18) {
  pourStream(owner, x, y, z, y1, CROPS[crop].heapCol, width);
  if (Math.random() < dt * 30) emit(x, y1 + 0.2, z, CROPS[crop].heapCol, 0.35, (Math.random() - 0.5) * spread * 3, 1.2, (Math.random() - 0.5) * spread * 3, 0.5, 9);
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
    pour(h, _v.x, _v.y, _v.z, groundH(_v.x, _v.z) + (t ? 1.4 : 0.3), crop, dt);
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

/** Starts filling trailer t from the silo outlet with the chosen crop. */
export function startLoading(t) { t.loading = true; t.loaded = 0; t.loadCrop = siloCrop(); }
export function stopLoading(t, onDone) {
  if (t.loaded > 0) { toast('Naloženo ze sila ' + fmt(t.loaded) + ' l ' + CROPS[t.loadCrop].gen + ' · v silu zbývá ' + fmt(G.silo.stock[t.loadCrop]) + ' l', 'good'); onDone?.(); }
  t.loading = false; t.loaded = 0;
}
const _spout = { x: SILO_LOAD.x, z: SILO_LOAD.z };

function trailerLogistics(t, dt, onDone) {
  if (t.loading) {
    const crop = t.loadCrop, space = t.tank.cap - t.tank.amount;
    if (!t.on || !inSiloLoad(trailerCenter(t)) || crop < 0 || G.silo.stock[crop] <= 0 || space < 1 || !trailerAccepts(t, crop)) stopLoading(t, onDone);
    else {
      const amt = takeOut(crop, Math.min(space, LOAD_RATE * dt));
      t.tank.crop = crop; t.tank.amount += amt; t.loaded += amt;
      const c = trailerCenter(t);
      pour(_spout, c.x, 4.6, c.z, groundH(c.x, c.z) + 1.4, crop, dt, 0.5, 0.35);
    }
  }
  if (t.tipping) {
    const m = t.on && sellPoint(trailerCenter(t), t.tank.crop);
    if (!m || t.tank.amount <= 0) stopTipping(t, onDone);
    else if (t.tip.rotation.x < -0.5) { // body is up
      const crop = t.tank.crop, amt = deliver(m, crop, Math.min(t.tank.amount, TIP_RATE * dt), t);
      if (amt <= 0) { stopTipping(t, onDone); return; }
      t.tank.amount -= amt;
      _v.set(0, 0.2, 0); t.tip.localToWorld(_v);
      pour(t, _v.x, _v.y, _v.z, groundH(_v.x, _v.z) + 0.1, crop, dt, 0.8, 0.7);
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

export function startTipping(t, store = false) {
  t.store = store;
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
