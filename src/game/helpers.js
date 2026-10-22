import { angDiff, fmt } from '../core/util.js';
import { G, condFactor } from './state.js';
import { CROPS, S_STUB, S_CULT, S_SOWN, S_RIPE, S_NONE, B_FERT, B_PLOW, B_FERT2, B_ROLL, B_MULCH, FERT_COST, HERB_COST, LIME_COST } from './crops.js';
import { sowable, WEED_SPRAYED } from './agro.js';
import { fieldAt, FIELDS } from '../world/fields.js';
import { vehicles, tools, toolLine, blockedAt, attachTool, labelOf, eyeOf } from '../vehicles/vehicles.js';
import { pushBales } from '../world/bales.js';
import { contractAllows } from './contracts.js';
import { isWet, season } from './weather.js';
import { toast, warn } from '../ui/toast.js';
import { HELPER_WAGE } from './balance.js';
import { DIESEL } from './economy.js';
import { route } from './roadnet.js';
import { startUnload, sellPoint } from './work.js';
import { bestMarket } from './markets.js';
import { trees, MATURE } from '../world/forest.js';
import { REACH, fell, sellLogs, bestWood, woodBuyerAt } from './forestry.js';

/**
 * Hired helpers drive a vehicle on their own. On a field the route is planned once: parallel lanes
 * (tool down) joined by U-turns (tool up), then one pass along each headland. The vehicle follows the
 * route exactly at working speed; the normal work() code does the field work, so everything (contracts,
 * bonuses, straw, money) behaves as if the player drove.
 * A helper sent from the office (remote) also drives there along the roads (roadnet.js), takes a full
 * harvester's grain to the best buyer and comes back to carry on, and drives home when the field is done.
 * The forestry harvester's helper fells mature trees he can reach and takes the wood to the best buyer.
 * Only one helper works at a time. Sent with a tractor and another implement, he first drives to where
 * the implement stands and hitches it.
 * Modes: fetch (to the implement), travel (to the field), field, sell (to a buyer), unload, back (to where
 * he stopped), home, and for wood: log (picking the next tree), approach, sellwood.
 */
export const WAGE = HELPER_WAGE; // Kč per hour of work; an hour = 60 s real time, so time speed-up does not inflate it
const PAD = 1.0; // how far inside the field edge the vehicle origin stays
const OVERHANG = 1.0; // how far the machine may stick out past the field edge on headland passes
const STUCK_S = 8; // seconds a helper waits at an obstacle before giving up
const FIELD_TOOLS = ['cultivator', 'plough', 'seeder', 'spreader', 'baler', 'mower', 'sprayer', 'roller', 'mulcher'];
const WHAT = { cultivator: 'kultivace', plough: 'orba', seeder: 'setí', spreader: 'hnojení', baler: 'lisování', mower: 'sečení', sprayer: 'postřik', roller: 'válení', mulcher: 'mulčování', harvest: 'sklizeň', wood: 'těžba dřeva' };

export const helpers = () => vehicles.filter(v => v.helper);
export const jobName = v => WHAT[v.type === 'forest' ? 'wood' : v.harvester ? 'harvest' : v.impl];

/** Does cell i of field f still need the vehicle's tool? */
function needs(f, v, i) {
  const s = f.state[i];
  if (s === S_NONE) return false;
  if (f.meadow) return v.type === 'tractor' && ((v.impl === 'mower' && s === S_RIPE) || (v.impl === 'baler' && !!f.straw[i]));
  if (v.impl === 'mower') return false;
  if (v.harvester) return s === S_RIPE && CROPS[f.crop[i]].header === v.header;
  switch (v.impl) {
    case 'cultivator': return s === S_STUB;
    case 'plough': return (s === S_STUB || s === S_CULT) && !(f.bonus[i] & B_PLOW);
    case 'seeder': return s === S_CULT && (!f.owned || sowable(v.seedCrop));
    case 'spreader':
      if (v.spreadLime) return f.owned && s !== S_RIPE && f.lime[i] > 0;
      return s !== S_RIPE && (!(f.bonus[i] & B_FERT) || (f.owned && s === S_SOWN && f.stage[i] >= 2 && !(f.bonus[i] & B_FERT2)));
    case 'sprayer': return s === S_SOWN && !(f.weed[i] & WEED_SPRAYED);
    case 'roller': return (s === S_CULT || (s === S_SOWN && f.stage[i] <= 1)) && !(f.bonus[i] & B_ROLL);
    case 'mulcher': return s === S_STUB && !(f.bonus[i] & B_MULCH);
    case 'baler': return !!f.straw[i];
  }
  return false;
}
export function workLeft(f, v) {
  let n = 0;
  for (let i = 0; i < f.n; i++) if (needs(f, v, i)) n++;
  return n;
}

/** Mature trees standing in the forest plots. */
const matureTrees = () => trees.reduce((n, t) => n + (t.g >= MATURE && !t.fall ? 1 : 0), 0);

/**
 * Can a helper take over vehicle v? Without a field: on the field where v stands (H key).
 * Returns { f } for field work, { wood: true } for the forestry harvester, or { why }.
 */
/** The machine a helper drives now, other than v: only one helper works at a time. */
export const busyHelper = v => vehicles.find(o => o !== v && o.helper) || null;
/** Tractor v as if implement im were hitched (for checking a job before the helper fetches it). */
const withTool = (v, im) => (im && im !== v.tool ? Object.assign(Object.create(v), { tool: im, impl: im.key }) : v);

/**
 * Can a helper take over vehicle v? Without a field: on the field where v stands (H key).
 * im = implement for a tractor (default: the one hitched; another one he fetches first).
 * Returns { f } for field work, { wood: true } for the forestry harvester, or { why }.
 */
export function canHire(v, target, im = v.tool) {
  if (v.type === 'jeep') return { why: 'Auto pomocník neřídí, to je na přejezdy.' };
  if (v.helper) return { why: 'Tenhle stroj už řídí pomocník.' };
  const other = busyHelper(v);
  if (other) return { why: 'Pomocník už pracuje (' + labelOf(other) + '). Najednou může pracovat jen jeden.' };
  if (v.fuel <= 1) return { why: 'Stroj nemá naftu.' };
  if (G.money < WAGE) return { why: 'Na mzdu pomocníka nemáš peníze.' };
  if (v.type === 'forest') return matureTrees() ? { wood: true } : { why: 'V lese teď není žádný vzrostlý strom.' };
  const f = target || fieldAt(v.x, v.z);
  if (!f) return { why: 'Zajeď na pole, které má pomocník obdělat, a stiskni H. Na vzdálené pole ho pošleš z Kanceláře.' };
  const w = v.type === 'tractor' ? withTool(v, im) : v;
  if (v.type === 'tractor' && !im) return { why: 'Traktor nemá nářadí. Zacouvej k nějakému a připoj ho klávesou Q.' };
  if (v.type === 'tractor' && im.on && im.on !== v) return { why: 'Nářadí je připojené k jinému traktoru.' };
  if (!f.owned && !contractAllows(f, w)) return { why: 'Na cizím poli může pomocník pracovat jen při zakázce s tímto nářadím.' };
  if (v.type === 'tractor' && !FIELD_TOOLS.includes(w.impl)) return { why: 'S přívěsem pomocník nepracuje. Odpoj ho (Q) a připoj polní nářadí.' };
  if (w.impl === 'seeder' && v.type === 'tractor' && !season().sow) return { why: 'V zimě se nesije.' };
  if (!workLeft(f, w)) return { why: 'Na poli ' + f.id + ' pomocník s tímhle strojem nemá co dělat.' };
  return { f };
}
/** The implements a helper could take with tractor v: its own field tool and the free ones. */
export const helperTools = v => tools.filter(t => FIELD_TOOLS.includes(t.key) && (t.on === v || !t.on));

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
      // The U-turn bulges r past the turn line, plus the machine's body: keep it within OVERHANG of the
      // field edge (the headland passes at the end harvest what this leaves near the edge).
      const r = Math.abs(order[k + 1] - order[k]) / 2, sg = Math.sign(order[k + 1] - order[k]), out = r + v.r * 0.85 - OVERHANG;
      let turnAl = d > 0 ? Math.max(oEnd(d), oStart(-d)) : Math.min(oEnd(d), oStart(-d));
      turnAl = d > 0 ? Math.max(oEnd(d), Math.min(turnAl, e1 - out)) : Math.min(oEnd(d), Math.max(turnAl, e0 + out));
      go(P(turnAl, order[k]), false);
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

/* ---------- paths ---------- */
/** Line segments through points (off the field: tool up; road = drive at travel speed). */
function pathOf(pts, road = true) {
  const segs = [];
  for (let i = 1; i < pts.length; i++) { const s = line(pts[i - 1], pts[i], false); s.road = road; if (s.len > 0.05) segs.push(s); }
  return segs;
}
/** Where segment list path puts the vehicle at segment seg, distance s. */
function pointOn(path, seg, s) {
  const sg = path[seg];
  if (!sg) return null;
  if (sg.kind === 'line') { const t = sg.len ? s / sg.len : 0; return { x: sg.a.x + (sg.b.x - sg.a.x) * t, z: sg.a.z + (sg.b.z - sg.a.z) * t }; }
  const phi = s / sg.r, { C, r, d, sg: g, U, S } = sg;
  return { x: C.x + d * U.x * r * Math.sin(phi) - g * S.x * r * Math.cos(phi), z: C.z + d * U.z * r * Math.sin(phi) - g * S.z * r * Math.cos(phi) };
}
function setPath(v, mode, path, seg = 0, s = 0) {
  const hp = v.helper;
  hp.mode = mode; hp.path = path; hp.seg = seg; hp.s = s; hp.stuck = 0;
  hp.total = hp.done + path.slice(seg).reduce((a, x) => a + x.len, 0) - s;
}
const roadTo = (v, x, z) => pathOf(route(v.x, v.z, x, z));
/** On these trips (roads and the short legs to and from them) helpers drive past trees, hedges and sheds instead of stopping; they still wait for machines. */
const TRIPS = new Set(['fetch', 'travel', 'sell', 'back', 'home', 'sellwood', 'travel-wood']);

/* ---------- hiring ---------- */
function newHelper(v, extra) {
  v.helper = { job: 'field', field: null, mode: 'field', path: [], seg: 0, s: 0, work: null, resume: null, remote: false, after: null,
    wage: 0, time: 0, done: 0, total: 0, wait: null, check: 0, stuck: 0, tree: -1, triedRoad: false, ...extra };
  v.lowered = false;
  return v.helper;
}

/** H key: a helper takes over v where it stands (on a field, or the forestry harvester anywhere). */
export function hire(v) {
  const { f, wood, why } = canHire(v);
  if (why) { toast(why, 'bad'); return false; }
  if (wood) {
    newHelper(v, { job: 'wood', mode: 'log' });
    toast('Pomocník převzal ' + v.name + ' a kácí vzrostlé stromy. Mzda ' + fmt(WAGE) + ' Kč/h.', 'good');
    return true;
  }
  const hp = newHelper(v, { field: f });
  setPath(v, 'field', plan(v, f));
  hp.work = hp.path;
  toast('Pomocník převzal ' + v.name + ': ' + jobName(v) + ' pole ' + f.id + '. Mzda ' + fmt(WAGE) + ' Kč/h.', 'good');
  return true;
}

/**
 * Office: sends a helper with v to field f (or to the forest when f is null and v is the harvester).
 * He drives there along the roads, sells a full harvester's load on the way and comes home at the end.
 */
export function sendHelper(v, f, im = v.tool) {
  const { f: field, wood, why } = canHire(v, f, im);
  if (why) { toast(why, 'bad'); return false; }
  if (wood) {
    newHelper(v, { job: 'wood', mode: 'log', remote: true });
    toast('Pomocník jede s harvestorem do lesa kácet. Mzda ' + fmt(WAGE) + ' Kč/h.', 'good');
    return true;
  }
  if (v.type === 'tractor' && im !== v.tool) {
    // first to where the implement stands: the tractor stops with its hitch over the implement's
    const e = eyeOf(im);
    newHelper(v, { field, remote: true, fetch: im });
    setPath(v, 'fetch', roadTo(v, e.x - Math.sin(e.h) * v.hitchZ, e.z - Math.cos(e.h) * v.hitchZ));
    toast('Pomocník jede s ' + v.noun + ' pro ' + labelOf(im).toLowerCase() + ' a pak na pole ' + field.id + ' (' + jobName(withTool(v, im)) + '). Mzda ' + fmt(WAGE) + ' Kč/h.', 'good');
    return true;
  }
  const hp = newHelper(v, { field, remote: true });
  fieldTrip(v, field);
  toast('Pomocník jede s ' + v.noun + ' na pole ' + field.id + ' (' + jobName(v) + '). Mzda ' + fmt(WAGE) + ' Kč/h.', 'good');
  return !!hp;
}
/** Along the roads to field, then the planned field route (helper already hired). */
function fieldTrip(v, field) {
  // plan the field from the road point nearest to the field, so the work starts at the corner by the road
  const way = route(v.x, v.z, field.x0 + field.w / 2, field.z0 + field.h / 2);
  way.pop(); // stop on the road, the field route takes over from there
  const entry = way[way.length - 1] || { x: v.x, z: v.z };
  const work = plan(Object.assign(Object.create(v), { x: entry.x, z: entry.z }), field);
  if (work[0] && !work[0].work) work[0].ghost = true; // from the road into the field corner, through the roadside trees
  const hp = v.helper;
  hp.work = work;
  setPath(v, 'travel', [...pathOf(way)]);
  hp.total += work.reduce((a, x) => a + x.len, 0);
}

/* ---------- saving ---------- */
const num = x => Number.isFinite(x);
const pt = p => p && num(p.x) && num(p.z);
const r3 = x => Math.round(x * 1000) / 1000;
const p3 = p => ({ x: r3(p.x), z: r3(p.z) });
const segOut = sg => (sg.kind === 'line'
  ? { kind: 'line', a: p3(sg.a), b: p3(sg.b), work: sg.work, road: !!sg.road, ghost: !!sg.ghost, len: r3(sg.len), h: r3(sg.h) }
  : { kind: 'arc', C: p3(sg.C), r: r3(sg.r), d: sg.d, sg: sg.sg, U: sg.U, S: sg.S, len: r3(sg.len) });
function segIn(sg) {
  if (sg?.kind === 'line' && pt(sg.a) && pt(sg.b) && num(sg.len) && num(sg.h)) return { kind: 'line', a: sg.a, b: sg.b, work: !!sg.work, road: !!sg.road, ghost: !!sg.ghost, len: sg.len, h: sg.h };
  if (sg?.kind === 'arc' && pt(sg.C) && num(sg.r) && sg.r > 0 && num(sg.d) && num(sg.sg) && pt(sg.U) && pt(sg.S) && num(sg.len)) {
    return { kind: 'arc', C: sg.C, r: sg.r, d: Math.sign(sg.d) || 1, sg: Math.sign(sg.sg) || 1, U: sg.U, S: sg.S, len: sg.len };
  }
  return null;
}
const pathIn = list => { if (!Array.isArray(list)) return null; const out = list.map(segIn); return out.every(Boolean) ? out : null; };
const MODES = ['fetch', 'travel', 'field', 'sell', 'unload', 'back', 'home', 'log', 'approach', 'sellwood', 'travel-wood'];

/** Helper state for the save file: job, the current route and how far along it, the field route to come back to. */
export function serializeHelper(v) {
  const hp = v.helper;
  if (!hp) return null;
  return {
    job: hp.job, field: hp.field?.id ?? null, mode: hp.mode, remote: hp.remote, after: hp.after, tree: hp.tree,
    seg: hp.seg, s: r3(hp.s), wage: Math.round(hp.wage), time: r3(hp.time), done: r3(hp.done), total: r3(hp.total),
    path: hp.path.map(segOut), work: hp.work && hp.work !== hp.path ? hp.work.map(segOut) : null, resume: hp.resume, fetch: hp.fetch?.id ?? null,
  };
}

/** Puts a saved helper back on its vehicle; quietly skips anything that does not check out. */
export function restoreHelper(v, d) {
  v.helper = null;
  if (!d) return false;
  const job = d.job === 'wood' && v.type === 'forest' ? 'wood' : 'field';
  const f = FIELDS.find(x => x.id === d.field);
  if (job === 'field' && (!f || (!f.owned && !contractAllows(f, v)))) return false;
  const path = pathIn(d.path);
  if (!path || (job === 'field' && !path.length)) return false;
  const work = d.work ? pathIn(d.work) : null;
  const mode = MODES.includes(d.mode) ? d.mode : 'field'; // saves from before the modes: a field route
  const fetch = mode === 'fetch' ? tools.find(t => t.id === d.fetch && (!t.on || t.on === v)) : null;
  if (mode === 'fetch' && !fetch) return false;
  const seg = Math.max(0, Math.min(Math.max(0, path.length - 1), d.seg | 0));
  newHelper(v, {
    job, field: job === 'field' ? f : null, mode, remote: !!d.remote, after: d.after === 'home' ? 'home' : null, tree: -1, fetch,
    path, seg, s: path.length ? Math.max(0, Math.min(path[seg].len, +d.s || 0)) : 0, work: work || (mode === 'field' ? path : null),
    resume: d.resume && num(d.resume.seg) && num(d.resume.s) ? d.resume : null,
    wage: Math.max(0, +d.wage || 0), time: Math.max(0, +d.time || 0), done: Math.max(0, +d.done || 0),
    total: num(d.total) && d.total > 0 ? d.total : path.reduce((a, s) => a + s.len, 0),
  });
  if (mode === 'approach') { v.helper.mode = 'log'; v.helper.path = []; } // pick the tree again
  return true;
}

export function dismiss(v, why) {
  const hp = v.helper;
  if (!hp) return;
  v.helper = null; v.lowered = false; v.speed = 0; v.steer = 0;
  const min = Math.round(hp.time); // one real second = one minute of work (60 s = 1 h)
  toast((why || 'Pomocník propuštěn.') + ' Odpracoval ' + Math.floor(min / 60) + ' h ' + (min % 60) + ' min za ' + fmt(hp.wage) + ' Kč.', why && /hotov/.test(why) ? 'good' : '');
}

/* ---------- trips ---------- */
function goHome(v, msg) {
  const hp = v.helper;
  hp.after = null; v.lowered = false;
  setPath(v, 'home', roadTo(v, v.home[0], v.home[1]));
  if (msg) toast(msg, 'good');
}
/** Remote harvester: take the grain to the best buyer, then come back (or go home). */
function sellTrip(v, after) {
  const hp = v.helper, b = bestMarket(v.tank.crop, G.gameMin);
  if (!b) return false;
  hp.resume = hp.mode === 'field' ? { seg: hp.seg, s: hp.s } : hp.resume;
  hp.after = after || null; v.lowered = false;
  setPath(v, 'sell', roadTo(v, b.m.x, b.m.z));
  toast('Pomocník veze ' + fmt(v.tank.amount) + ' l ' + CROPS[v.tank.crop].gen + ' na výkup: ' + b.m.name + '.');
  return true;
}
function finishField(v) {
  const hp = v.helper, msg = 'Pomocník dokončil ' + jobName(v) + ' pole ' + hp.field.id;
  if (!hp.remote) { dismiss(v, msg + ' a je hotov.'); return; }
  if (v.harvester && v.tank.amount > v.tank.cap * 0.05 && sellTrip(v, 'home')) return;
  goHome(v, msg + ' a vrací se na dvůr.');
}
function onPathEnd(v) {
  const hp = v.helper;
  switch (hp.mode) {
    case 'fetch': {
      const im = hp.fetch;
      hp.fetch = null;
      if (!tools.includes(im) || (im.on && im.on !== v)) { dismiss(v, 'Pomocník nářadí nenašel, mezitím je připojené jinde.'); return; }
      attachTool(v, im);
      fieldTrip(v, hp.field);
      return;
    }
    case 'travel': setPath(v, 'field', hp.work); return;
    case 'field': finishField(v); return;
    case 'sell':
      if (v.tank.amount > 0 && sellPoint(v, v.tank.crop)) { startUnload(v); hp.mode = 'unload'; hp.path = []; return; }
      dismiss(v, 'Pomocník nedojel k výkupu a zastavil.'); return;
    case 'back': setPath(v, 'field', hp.work, hp.resume?.seg ?? 0, hp.resume?.s ?? 0); hp.resume = null; return;
    case 'home': dismiss(v, 'Pomocník ' + (hp.job === 'wood' ? 'skončil v lese' : 'je zpátky na dvoře') + ' a je hotov.'); return;
    case 'approach': {
      const t = trees[hp.tree];
      hp.path = []; hp.mode = 'log';
      if (t && t.g >= MATURE && !t.fall && Math.hypot(t.x - v.x, t.z - v.z) < REACH) { v.h = Math.atan2(t.x - v.x, t.z - v.z); fell(v, hp.tree); hp.triedRoad = false; }
      return;
    }
    case 'sellwood':
      if (woodBuyerAt(v)) sellLogs(v);
      hp.path = []; hp.mode = 'log';
      if (hp.after === 'home') goHome(v);
      return;
    case 'travel-wood': hp.path = []; hp.mode = 'log'; return;
  }
}

/** Is the straight way from v to (x, z) free of trees, buildings and machines? */
function clearWay(v, x, z) {
  const L = Math.hypot(x - v.x, z - v.z), n = Math.ceil(L / 1.5);
  for (let k = 1; k <= n; k++) if (blockedAt(v.x + ((x - v.x) * k) / n, v.z + ((z - v.z) * k) / n, v.r * 0.85, v)) return false;
  return true;
}
/** Forestry: decide the next step when the harvester stands idle. */
function nextWoodStep(v) {
  const hp = v.helper;
  const mature = [];
  trees.forEach((t, i) => { if (t.g >= MATURE && !t.fall) mature.push(i); });
  const full = v.logs >= v.logCap - 3;
  if (full || (!mature.length && v.logs > 0)) {
    const b = bestWood(G.gameMin).b;
    hp.after = mature.length ? null : 'home';
    setPath(v, 'sellwood', roadTo(v, b.x, b.z));
    toast('Pomocník veze ' + String(v.logs.toFixed(1)).replace('.', ',') + ' m³ dřeva: ' + b.name + '.');
    return;
  }
  if (!mature.length) { goHome(v, 'Les je vytěžený, pomocník se vrací na dvůr.'); hp.after = null; return; }
  mature.sort((a, b) => Math.hypot(trees[a].x - v.x, trees[a].z - v.z) - Math.hypot(trees[b].x - v.x, trees[b].z - v.z));
  for (const i of mature.slice(0, 30)) {
    const t = trees[i], d = Math.hypot(t.x - v.x, t.z - v.z);
    if (d > 90) break;
    if (d < REACH - 0.5) { hp.tree = i; hp.mode = 'approach'; onPathEnd(v); return; }
    const k = (d - (REACH - 2.5)) / d, x = v.x + (t.x - v.x) * k, z = v.z + (t.z - v.z) * k;
    if (clearWay(v, x, z)) { hp.tree = i; setPath(v, 'approach', pathOf([{ x: v.x, z: v.z }, { x, z }], false)); return; }
  }
  // nothing reachable from here: drive along the roads closer to the nearest mature tree, once
  if (!hp.triedRoad) {
    hp.triedRoad = true;
    const t = trees[mature[0]], way = route(v.x, v.z, t.x, t.z);
    way.pop();
    setPath(v, 'travel-wood', pathOf(way));
    return;
  }
  if (v.logs > 0) { hp.triedRoad = false; hp.after = 'home'; const b = bestWood(G.gameMin).b; setPath(v, 'sellwood', roadTo(v, b.x, b.z)); return; }
  goHome(v, 'Pomocník nenašel strom, ke kterému by s harvestorem dojel, a vrací se.');
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

  if (v.fuel < v.fuelCap * 0.1) {
    // helpers order diesel to the machine instead of stopping: the price plus 10 % for the delivery
    const l = Math.floor(v.fuelCap - v.fuel), cost = Math.round(l * DIESEL * 1.1);
    if (G.money >= cost) { G.money -= cost; v.fuel = v.fuelCap; toast('Pomocníkovi s ' + v.noun + ' přivezli ' + fmt(l) + ' l nafty za ' + fmt(cost) + ' Kč.'); }
  }
  if (v.fuel <= 0) { dismiss(v, 'Pomocníkovi došla nafta a nemáš na další.'); return; }
  if (G.money < 0) { dismiss(v, 'Nemáš na mzdu, pomocník odchází.'); return; }
  hp.check -= dt;
  if (hp.check <= 0 && hp.mode === 'field' && hp.job === 'field') {
    hp.check = 1;
    const f = hp.field;
    if (!workLeft(f, v)) { finishField(v); return; }
    if (!f.owned && !contractAllows(f, v)) { if (hp.remote) goHome(v, 'Zakázka skončila, pomocník se vrací na dvůr.'); else dismiss(v, 'Zakázka skončila, pomocník odchází.'); return; }
  }
  const cost = { seeder: CROPS[v.seedCrop]?.seed, spreader: v.spreadLime ? LIME_COST : FERT_COST, sprayer: HERB_COST }[v.impl];
  if (hp.mode === 'field' && v.type === 'tractor' && cost && G.money < cost && hp.field.owned) {
    dismiss(v, 'Došly peníze na ' + { seeder: 'osivo', spreader: v.spreadLime ? 'vápno' : 'hnojivo', sprayer: 'postřik' }[v.impl] + ', pomocník odchází.'); return;
  }

  // waiting states that do not move the vehicle
  if (hp.mode === 'unload') {
    v.speed = 0; v.thr = 0; hp.wait = null;
    if (!v.unloading || v.tank.amount <= 0) {
      if (hp.after === 'home') goHome(v);
      else { const p = pointOn(hp.work, hp.resume?.seg ?? 0, hp.resume?.s ?? 0) || { x: v.x, z: v.z }; setPath(v, 'back', roadTo(v, p.x, p.z)); }
    }
    return;
  }
  if (hp.job === 'wood' && v.cutting) { v.speed = 0; v.thr = 0; hp.wait = null; return; }
  if (hp.job === 'wood' && hp.mode === 'log') { v.speed = 0; nextWoodStep(v); return; }

  let wait = null;
  if (hp.mode === 'field' && v.harvester && v.tank.amount >= v.tank.cap * 0.97) {
    if (hp.remote && sellTrip(v)) return;
    wait = 'full';
  } else if (hp.mode === 'field' && v.harvester && isWet()) wait = 'wet';
  else if (!(hp.pass > 0) && blocked(v)) {
    wait = 'blocked';
    // two machines waiting for each other on a trip would wait forever: after a few seconds squeeze past
    if (TRIPS.has(hp.mode) && (hp.blockT = (hp.blockT || 0) + dt) > 4) { hp.pass = 6; hp.blockT = 0; wait = null; }
  } else hp.blockT = 0;
  if (hp.pass > 0) hp.pass -= dt;
  hp.wait = wait;
  if (wait) {
    v.speed = 0; v.thr = 0;
    if (wait === 'full') warn('hfull' + v.type, 'Pomocník čeká: zásobník ' + v.gen + ' je plný. Přistav přívěs pod rouru a stiskni F.');
    return;
  }

  if (!hp.path.length) { onPathEnd(v); return; }
  const cf = condFactor(v.cond), toolCf = v.tool ? condFactor(v.tool.cond) : 1;
  let seg = hp.path[hp.seg], segI = hp.seg, s = hp.s;
  const speed = seg.work ? v.vwork * cf * toolCf : seg.road ? Math.min(v.vmax, 9) * cf : seg.kind === 'arc' ? v.vwork * 0.7 * cf : Math.min(v.vmax, 6) * cf;
  s += speed * dt;
  while (s >= seg.len) {
    s -= seg.len; segI++;
    if (segI >= hp.path.length) { hp.seg = segI; onPathEnd(v); return; }
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
  if (!TRIPS.has(hp.mode) && !seg.ghost && blockedAt(nx, nz, v.r * 0.85, v) && !blockedAt(v.x, v.z, v.r * 0.85, v)) {
    v.speed = 0; v.thr = 0; hp.wait = 'blocked';
    hp.stuck = (hp.stuck || 0) + dt;
    if (hp.stuck > (hp.mode === 'field' ? STUCK_S : STUCK_S * 3)) {
      if (hp.job === 'wood' && hp.mode === 'approach') { hp.mode = 'log'; hp.path = []; hp.stuck = 0; return; } // try another tree
      dismiss(v, 'Pomocník narazil na překážku ' + (hp.field ? 'u pole ' + hp.field.id : 'cestou') + ' a zastavil.');
    }
    return;
  }
  hp.stuck = 0;
  hp.seg = segI; hp.s = s; hp.done += speed * dt;
  v.lowered = !!seg.work;
  v.speed = speed; v.thr = 1;
  v.x = nx; v.z = nz; v.h = nh; v.steer = steer;
  pushBales(v.x, v.z, v.r);
}

/** Progress 0..1 of the whole job (travel, field and trips). */
export const helperProgress = v => Math.min(1, v.helper.done / Math.max(1, v.helper.total));
export const helperWaitText = { full: 'čeká na vyložení', wet: 'čeká, až oschne', blocked: 'čeká, něco mu stojí v cestě' };
export const helperModeText = {
  fetch: 'jede pro nářadí', travel: 'jede na pole', sell: 'veze úrodu na výkup', unload: 'vykládá na výkupu', back: 'vrací se na pole', home: 'jede domů',
  log: 'hledá strom', approach: 'jede ke stromu', sellwood: 'veze dřevo', 'travel-wood': 'jede do lesa',
};
/** One line about what the helper on v is doing (HUD and office). */
export function helperStatus(v) {
  const hp = v.helper;
  const what = hp.job === 'wood' ? 'těžba dřeva' + (v.cutting ? ' · kácí' : '') : jobName(v) + ' pole ' + hp.field.id;
  const mode = hp.mode !== 'field' && helperModeText[hp.mode] ? ' · ' + helperModeText[hp.mode] : '';
  return what + mode + (hp.job === 'field' ? ' · ' + Math.round(helperProgress(v) * 100) + ' %' : '') + (hp.wait ? ' · ' + helperWaitText[hp.wait] : '');
}
