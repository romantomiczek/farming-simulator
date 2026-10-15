import { angDiff, fmt } from '../core/util.js';
import { G, condFactor } from './state.js';
import { CROPS, S_STUB, S_CULT, S_RIPE, S_NONE, B_FERT, B_PLOW, FERT_COST } from './crops.js';
import { fieldAt, FIELDS } from '../world/fields.js';
import { vehicles, IMPL, toolLine, blockedAt } from '../vehicles/vehicles.js';
import { pushBales } from '../world/bales.js';
import { contractAllows } from './contracts.js';
import { isWet, season } from './weather.js';
import { toast, warn } from '../ui/toast.js';

/**
 * Hired helpers drive a vehicle over one field on their own. The route is planned once:
 * parallel lanes (tool down) joined by U-turns (tool up), then one pass along each headland.
 * The vehicle follows the route exactly at working speed; the normal work() code does the
 * field work, so everything (contracts, bonuses, straw, money) behaves as if the player drove.
 */
export const WAGE = 600; // Kč per hour of work; an hour = 60 s real time, so time speed-up does not inflate it
const PAD = 1.0; // how far inside the field edge the vehicle origin stays
const OVERHANG = 1.0; // how far the machine may stick out past the field edge on headland passes
const STUCK_S = 8; // seconds a helper waits at an obstacle before giving up
const FIELD_TOOLS = ['cultivator', 'plough', 'seeder', 'spreader', 'baler'];
const WHAT = { cultivator: 'kultivace', plough: 'orba', seeder: 'setí', spreader: 'hnojení', baler: 'lisování', harvest: 'sklizeň' };

export const helpers = () => vehicles.filter(v => v.helper);
export const jobName = v => WHAT[v.harvester ? 'harvest' : v.impl];

/** Does cell i of field f still need the vehicle's tool? */
function needs(f, v, i) {
  const s = f.state[i];
  if (s === S_NONE) return false;
  if (v.harvester) return s === S_RIPE && CROPS[f.crop[i]].header === v.header;
  switch (v.impl) {
    case 'cultivator': return s === S_STUB;
    case 'plough': return (s === S_STUB || s === S_CULT) && !(f.bonus[i] & B_PLOW);
    case 'seeder': return s === S_CULT;
    case 'spreader': return s !== S_RIPE && !(f.bonus[i] & B_FERT);
    case 'baler': return !!f.straw[i];
  }
  return false;
}
export function workLeft(f, v) {
  let n = 0;
  for (let i = 0; i < f.n; i++) if (needs(f, v, i)) n++;
  return n;
}

/** Can a helper take over vehicle v where it stands? { f } or { why }. */
export function canHire(v) {
  const f = fieldAt(v.x, v.z);
  if (!f) return { why: 'Zajeď na pole, které má pomocník obdělat, a stiskni H.' };
  if (!f.owned && !contractAllows(f, v)) return { why: 'Na cizím poli může pomocník pracovat jen při zakázce s tímto nářadím.' };
  if (v.type === 'tractor' && !FIELD_TOOLS.includes(v.impl)) return { why: 'S přívěsem pomocník nepracuje. Připoj v kůlně polní nářadí.' };
  if (v.impl === 'seeder' && v.type === 'tractor' && !season().sow) return { why: 'V zimě se nesije.' };
  if (v.fuel <= 1) return { why: 'Stroj nemá naftu.' };
  if (G.money < WAGE) return { why: 'Na mzdu pomocníka nemáš peníze.' };
  if (!workLeft(f, v)) return { why: 'Na poli ' + f.id + ' pomocník s tímhle strojem nemá co dělat.' };
  return { f };
}

/* ---------- route ---------- */
const line = (a, b, work) => ({ kind: 'line', a, b, work, len: Math.hypot(b.x - a.x, b.z - a.z), h: Math.atan2(b.x - a.x, b.z - a.z) });

function plan(v, f) {
  const { W, Z } = toolLine(v);
  const alongX = f.lanes === 'x';
  const e0 = alongX ? f.x0 : f.z0, e1 = e0 + (alongX ? f.w : f.h); // along the lanes
  const c0 = alongX ? f.z0 : f.x0, c1 = c0 + (alongX ? f.h : f.w); // across the lanes
  const P = (al, ac) => (alongX ? { x: al, z: ac } : { x: ac, z: al });
  const U = alongX ? { x: 1, z: 0 } : { x: 0, z: 1 }, S = alongX ? { x: 0, z: 1 } : { x: 1, z: 0 };

  // lane centres for the tool
  const span = c1 - c0, n = W >= span ? 1 : Math.ceil((span - W) / (W * 0.92)) + 1;
  const lanes = [];
  for (let i = 0; i < n; i++) lanes.push(n === 1 ? (c0 + c1) / 2 : c0 + W / 2 + (i * (span - W)) / (n - 1));

  // headland width: room for the vehicle body in front of or behind the tool (Z < 0 = tool behind)
  const H = Math.abs(Z) + PAD + 0.5;
  const oStart = d => (d > 0 ? e0 + H : e1 - H) - d * Z;
  const oEnd = d => (d > 0 ? e1 - H : e0 + H) - d * Z;

  // start in the corner nearest to the vehicle
  let best = null;
  for (const rev of [false, true]) for (const d0 of [1, -1]) {
    const order = rev ? [...lanes].reverse() : lanes, p = P(oStart(d0), order[0]);
    const dist = Math.hypot(p.x - v.x, p.z - v.z);
    if (!best || dist < best.dist) best = { order, d0, dist };
  }
  const { order } = best;
  const segs = [];
  let pos = { x: v.x, z: v.z }, d = best.d0;
  const go = (to, work) => { const s = line(pos, to, work); if (s.len > 0.05) segs.push(s); pos = to; };

  go(P(oStart(d), order[0]), false);
  for (let k = 0; k < order.length; k++) {
    go(P(oEnd(d), order[k]), true);
    if (k < order.length - 1) {
      // Turn where the next lane must start. With the tool in front (combine) that is further out
      // than where this lane ends, so drive on with the tool up first; with the tool behind
      // (tractor) the next lane simply starts a few metres behind the turn.
      const turnAl = d > 0 ? Math.max(oEnd(d), oStart(-d)) : Math.min(oEnd(d), oStart(-d));
      go(P(turnAl, order[k]), false);
      const r = Math.abs(order[k + 1] - order[k]) / 2, sg = Math.sign(order[k + 1] - order[k]);
      const C = P(turnAl, (order[k] + order[k + 1]) / 2);
      segs.push({ kind: 'arc', C, r, d, sg, U, S, len: Math.PI * r });
      pos = P(turnAl, order[k + 1]);
      d = -d;
    }
  }
  // headland passes: tool along the middle of each end strip, across the whole field. The machine
  // may stick out at most OVERHANG past the field edge, so the header or the implement never
  // reaches into a hedge or a building next to the field.
  const front = v.harvester ? v.toolZ + 1 : 2.6, rear = v.harvester ? 3.4 : -Z + 1;
  const inFront = Math.max(PAD, front - OVERHANG), inRear = Math.max(PAD, rear - OVERHANG);
  const ends = [e0 + H / 2, e1 - H / 2].sort((a, b) => Math.abs((alongX ? pos.x : pos.z) - a) - Math.abs((alongX ? pos.x : pos.z) - b));
  for (const al of ends) {
    const cur = alongX ? pos.z : pos.x, up = cur - c0 < c1 - cur; // drive towards the far side
    go(P(al, up ? c0 + inRear : c1 - inRear), false);
    go(P(al, up ? c1 - inFront : c0 + inFront), true);
  }
  return segs;
}

/* ---------- hiring ---------- */
export function hire(v) {
  const { f, why } = canHire(v);
  if (!f) { toast(why, 'bad'); return false; }
  const path = plan(v, f);
  v.helper = { field: f, path, seg: 0, s: 0, wage: 0, time: 0, done: 0, total: path.reduce((a, s) => a + s.len, 0), wait: null, check: 0 };
  v.lowered = false;
  toast('Pomocník převzal ' + v.name + ': ' + jobName(v) + ' pole ' + f.id + '. Mzda ' + fmt(WAGE) + ' Kč/h.', 'good');
  return true;
}

/* ---------- saving ---------- */
const num = x => Number.isFinite(x);
const pt = p => p && num(p.x) && num(p.z);
const r3 = x => Math.round(x * 1000) / 1000;
const p3 = p => ({ x: r3(p.x), z: r3(p.z) });

/** Helper state for the save file: the planned route and how far along it the helper is. */
export function serializeHelper(v) {
  const hp = v.helper;
  if (!hp) return null;
  return {
    field: hp.field.id, seg: hp.seg, s: r3(hp.s), wage: Math.round(hp.wage), time: r3(hp.time), done: r3(hp.done), total: r3(hp.total),
    path: hp.path.map(sg => (sg.kind === 'line'
      ? { kind: 'line', a: p3(sg.a), b: p3(sg.b), work: sg.work, len: r3(sg.len), h: r3(sg.h) }
      : { kind: 'arc', C: p3(sg.C), r: r3(sg.r), d: sg.d, sg: sg.sg, U: sg.U, S: sg.S, len: r3(sg.len) })),
  };
}

/** Puts a saved helper back on its vehicle; quietly skips anything that does not check out. */
export function restoreHelper(v, d) {
  v.helper = null;
  if (!d || !Array.isArray(d.path) || !d.path.length) return false;
  const f = FIELDS.find(x => x.id === d.field);
  if (!f || (!f.owned && !contractAllows(f, v))) return false;
  const path = [];
  for (const sg of d.path) {
    if (sg?.kind === 'line' && pt(sg.a) && pt(sg.b) && num(sg.len) && num(sg.h)) path.push({ kind: 'line', a: sg.a, b: sg.b, work: !!sg.work, len: sg.len, h: sg.h });
    else if (sg?.kind === 'arc' && pt(sg.C) && num(sg.r) && sg.r > 0 && num(sg.d) && num(sg.sg) && pt(sg.U) && pt(sg.S) && num(sg.len)) {
      path.push({ kind: 'arc', C: sg.C, r: sg.r, d: Math.sign(sg.d) || 1, sg: Math.sign(sg.sg) || 1, U: sg.U, S: sg.S, len: sg.len });
    } else return false;
  }
  const seg = Math.max(0, Math.min(path.length - 1, d.seg | 0));
  v.helper = {
    field: f, path, seg, s: Math.max(0, Math.min(path[seg].len, +d.s || 0)),
    wage: Math.max(0, +d.wage || 0), time: Math.max(0, +d.time || 0), done: Math.max(0, +d.done || 0),
    total: num(d.total) && d.total > 0 ? d.total : path.reduce((a, s) => a + s.len, 0), wait: null, check: 0,
  };
  return true;
}

export function dismiss(v, why) {
  const hp = v.helper;
  if (!hp) return;
  v.helper = null; v.lowered = false; v.speed = 0; v.steer = 0;
  const min = Math.round(hp.time); // one real second = one minute of work (60 s = 1 h)
  toast((why || 'Pomocník propuštěn.') + ' Odpracoval ' + Math.floor(min / 60) + ' h ' + (min % 60) + ' min za ' + fmt(hp.wage) + ' Kč.', why && /hotov/.test(why) ? 'good' : '');
}

/** True if another vehicle stands right in front of v. */
function blocked(v) {
  const s = Math.sin(v.h), c = Math.cos(v.h);
  for (const o of vehicles) {
    if (o === v || !o.available) continue;
    const dx = o.x - v.x, dz = o.z - v.z, ahead = dx * s + dz * c;
    if (ahead > 0 && ahead < v.r + o.r + 3 && Math.abs(dx * c - dz * s) < v.r + o.r) return true;
  }
  return false;
}

/** Drives a helper-controlled vehicle along its route. Call instead of drive(). */
export function helperTick(v, dt) {
  const hp = v.helper;
  hp.time += dt;
  const pay = (WAGE / 60) * dt;
  G.money -= pay; hp.wage += pay;

  hp.check -= dt;
  if (hp.check <= 0) {
    hp.check = 1;
    const f = hp.field;
    if (!workLeft(f, v)) { dismiss(v, 'Pomocník dokončil ' + jobName(v) + ' pole ' + f.id + ' a je hotov.'); return; }
    if (!f.owned && !contractAllows(f, v)) { dismiss(v, 'Zakázka skončila, pomocník odchází.'); return; }
  }
  if (v.fuel <= 0) { dismiss(v, 'Pomocníkovi došla nafta.'); return; }
  if (G.money < 0) { dismiss(v, 'Nemáš na mzdu, pomocník odchází.'); return; }
  if (v.type === 'tractor' && ((v.impl === 'seeder' && G.money < CROPS[v.seedCrop].seed) || (v.impl === 'spreader' && G.money < FERT_COST)) && hp.field.owned) {
    dismiss(v, 'Došly peníze na ' + (v.impl === 'seeder' ? 'osivo' : 'hnojivo') + ', pomocník odchází.'); return;
  }

  let wait = null;
  if (v.harvester && v.tank.amount >= v.tank.cap * 0.97) wait = 'full';
  else if (v.harvester && isWet()) wait = 'wet';
  else if (blocked(v)) wait = 'blocked';
  hp.wait = wait;
  if (wait) {
    v.speed = 0; v.thr = 0;
    if (wait === 'full') warn('hfull' + v.type, 'Pomocník čeká: zásobník ' + v.gen + ' je plný. Přistav přívěs pod rouru a stiskni F.');
    return;
  }

  const cf = condFactor(G.cond[v.type] ?? 1), toolCf = v.type === 'tractor' ? condFactor(G.cond[v.impl] ?? 1) : 1;
  let seg = hp.path[hp.seg], segI = hp.seg, s = hp.s;
  const speed = seg.work ? v.vwork * cf * toolCf : seg.kind === 'arc' ? v.vwork * 0.7 * cf : Math.min(v.vmax, 6) * cf;
  s += speed * dt;
  while (s >= seg.len) {
    s -= seg.len; segI++;
    if (segI >= hp.path.length) { dismiss(v, 'Pomocník projel celé pole ' + hp.field.id + ' a je hotov.'); return; }
    seg = hp.path[segI];
  }
  // where the route puts the vehicle next
  let nx, nz, nh, steer = 0;
  if (seg.kind === 'line') {
    const t = s / seg.len;
    nx = seg.a.x + (seg.b.x - seg.a.x) * t; nz = seg.a.z + (seg.b.z - seg.a.z) * t;
    nh = v.h + angDiff(v.h, seg.h) * Math.min(1, dt * 4);
  } else {
    const phi = s / seg.r, { C, r, d, sg, U, S } = seg;
    const sn = Math.sin(phi), cs = Math.cos(phi);
    nx = C.x + (d * U.x * r * sn) - sg * S.x * r * cs;
    nz = C.z + (d * U.z * r * sn) - sg * S.z * r * cs;
    nh = Math.atan2(d * U.x * cs + sg * S.x * sn, d * U.z * cs + sg * S.z * sn);
    steer = 0.45 * Math.sign(d * U.z * sg * S.x - d * U.x * sg * S.z); // > 0 = turning left
  }
  // never drive through a building, fence, tree or parked machine: wait, and give up if it stays
  if (blockedAt(nx, nz, v.r * 0.85, v) && !blockedAt(v.x, v.z, v.r * 0.85, v)) {
    v.speed = 0; v.thr = 0; hp.wait = 'blocked';
    hp.stuck = (hp.stuck || 0) + dt;
    if (hp.stuck > STUCK_S) dismiss(v, 'Pomocník narazil na překážku u pole ' + hp.field.id + ' a zastavil.');
    return;
  }
  hp.stuck = 0;
  hp.seg = segI; hp.s = s; hp.done += speed * dt;
  v.lowered = !!seg.work;
  v.speed = speed; v.thr = 1;
  v.x = nx; v.z = nz; v.h = nh; v.steer = steer;
  pushBales(v.x, v.z, v.r);
}

/** Progress 0..1 of the planned route. */
export const helperProgress = v => Math.min(1, v.helper.done / Math.max(1, v.helper.total));
export const helperWaitText = { full: 'čeká na vyložení', wet: 'čeká, až oschne', blocked: 'čeká, něco mu stojí v cestě' };
