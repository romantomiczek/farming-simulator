import * as THREE from 'three';
import { scene } from '../render/core.js';
import { clamp, lerp, col, angDiff } from '../core/util.js';
import { nearShapes, BOUNDS, movers, PARK } from '../world/layout.js';
import { emit, SMOKE } from '../fx/particles.js';
import { flatPlane } from '../render/materials.js';
import { G, condFactor } from '../game/state.js';
import { buildTractor, buildCombine, buildBeetHarvester, buildForester, buildCultivator, buildSeeder, buildTrailer, buildPlough, buildSpreader, buildBaler, buildWaterTank, buildMower, buildJeep } from './models.js';
import { CROPS } from '../game/crops.js';
import { forestColliders } from '../world/forest.js';
import { pushBales } from '../world/bales.js';
import { groundH } from '../world/terrain.js';
import { WOOD } from '../game/balance.js';

/**
 * The fleet: every machine and every implement is its own piece (instance) with an id, owned or
 * leased, its own condition and load. vehicles = self-propelled machines, tools = implements and
 * trailers. Field tools ride rigidly on a tractor's hitch: width = working width, workZ = working
 * line behind the hitch, speed = max working speed (m/s). A trailer is articulated: it stays in the
 * scene and follows the hitch of the tractor it is attached to, see updateTrailers().
 * IMPL_ORDER is the order in the shed (keys 1–8).
 */
const TOOL_SPEC = {
  cultivator: { build: buildCultivator, name: 'Kultivátor', width: 4.2, workZ: -1.7, speed: 4.2, park: [8.5, -38.5], dust: col('#b48d68') },
  plough: { build: buildPlough, name: 'Pluh', width: 3.2, workZ: -2.2, speed: 3.1, park: [-12, -47.5], dust: col('#9b7656') },
  seeder: { build: buildSeeder, name: 'Secí stroj', width: 4.0, workZ: -1.5, speed: 4.2, park: [15.5, -38.5], dust: col('#c7a984') },
  spreader: { build: buildSpreader, name: 'Rozmetadlo', width: 12, workZ: -1.8, speed: 5.0, park: [-6.5, -47.5], dust: col('#f1eee6') },
  baler: { build: buildBaler, name: 'Lis na balíky', width: 2.0, workZ: -1.6, speed: 3.6, park: [-1, -47.5], dust: col('#eadba6') },
  trailer: { build: buildTrailer, name: 'Přívěs', width: 0, workZ: 0, speed: 4.2, park: [23.5, -37] },
  watertank: { build: buildWaterTank, name: 'Cisterna', width: 0, workZ: 0, speed: 4.2, park: [4.5, -48.5] },
  mower: { build: buildMower, name: 'Žací lišta', width: 3.0, workZ: -1.25, speed: 4.6, park: [12, -49], dust: col('#9cbf6a') },
};
export const IMPL_ORDER = ['cultivator', 'plough', 'seeder', 'spreader', 'baler', 'trailer', 'watertank', 'mower'];
/** Static facts about an implement kind (name, width) for the UI, also when none is owned. */
export const toolInfo = key => TOOL_SPEC[key];
export const isToolKey = key => key in TOOL_SPEC;
export const VEHICLE_TYPES = ['tractor', 'combine', 'beet', 'forest', 'jeep'];

export const vehicles = [];
export const tools = [];
/** Live subset of vehicles: the combines and beet harvesters. */
export const HARVESTERS = [];

const HITCH_Z = -1.75;
/** Distance from the trailer axle to its drawbar eye. */
export const TRAILER_L = 4.2;
/** Straw cells the baler needs for one bale. */
export const BALE_CELLS = 60;

let seq = 0;
const newId = prefix => prefix + '-' + ++seq;
/** Keeps generated ids clear of ids loaded from a save. */
export function noteId(id) { const n = +String(id).split('-').pop(); if (Number.isFinite(n) && n > seq) seq = n; }

export const firstOf = type => vehicles.find(v => v.type === type) || null;
export const trailers = () => tools.filter(t => t.key === 'trailer');
/** The trailer v tows, or null. */
export const towed = v => (v?.tool?.key === 'trailer' ? v.tool : null);
/* ---------- parking ---------- */
/**
 * Every piece has a parking place: slot -1 = the kind's own place by the shed (the first piece),
 * slot 0, 1, … = places in the machine park (PARK), one row for machines and two for implements.
 */
const vSlot = i => [PARK.x0 + PARK.vStep / 2 + 1 + i * PARK.vStep, PARK.vz];
const tSlot = i => [PARK.x0 + PARK.tStep / 2 + Math.floor(i / 2) * PARK.tStep, PARK.tz[i % 2] + 3];
/** Free place for a piece of kind key in list (wanted = place from a save, used when free). */
function pickSlot(list, kindOf, key, wanted) {
  const taken = new Set(list.map(p => p.slot));
  const primaryFree = !list.some(p => kindOf(p) === key && p.slot === -1);
  if (wanted === -1 && primaryFree) return -1;
  if (Number.isInteger(wanted) && wanted >= 0 && !taken.has(wanted)) return wanted;
  if (wanted == null && primaryFree) return -1;
  let i = 0;
  while (taken.has(i)) i++;
  return i;
}
/** Gravel under the machine park, as far east as the places in use. */
const parkPad = flatPlane(1, PARK.z1 - PARK.z0, '#d4ccb9', 0, 0.035, (PARK.z0 + PARK.z1) / 2, scene);
export const parkExtent = () => Math.max(PARK.minX,
  ...vehicles.filter(v => v.slot >= 0).map(v => vSlot(v.slot)[0] + PARK.vStep / 2),
  ...tools.filter(t => t.slot >= 0).map(t => tSlot(t.slot)[0] + PARK.tStep / 2));
let padX = 0;
function updParkPad() {
  const x1 = parkExtent();
  if (x1 === padX) return;
  padX = x1;
  parkPad.scale.x = x1 - PARK.x0; parkPad.position.x = (PARK.x0 + x1) / 2;
  parkHooks.forEach(f => f());
}
/** Called when the park grows or shrinks (the minimap redraws its ground). */
export const parkHooks = [];

/** Display name of a piece: its model, numbered when there are several of the kind. */
export function labelOf(p) {
  const same = p.type ? vehicles.filter(x => x.type === p.type) : tools.filter(x => x.key === p.key);
  return p.name + (same.length > 1 ? ' #' + (same.indexOf(p) + 1) : '');
}

function makeTool(key) {
  const s = TOOL_SPEC[key];
  const im = Object.assign(s.build(), { key, name: s.name, width: s.width, workZ: s.workZ, speed: s.speed, dust: s.dust, own: 'own', cond: 1, on: null });
  if (key === 'trailer') Object.assign(im, { x: 0, z: 0, h: 0, tank: { crop: -1, amount: 0, cap: 14000 }, bales: 0, hay: 0, baleCap: 8, tipping: false, sold: 0, soldMoney: 0, soldCrop: 0 });
  if (key === 'watertank') Object.assign(im, { water: 0, waterCap: 8000, milk: false });
  return im;
}

/** A new implement or trailer on its parking place. o = { id, own, cond, slot }. */
export function addTool(key, o = {}) {
  const im = makeTool(key);
  im.id = o.id || newId(key); noteId(im.id);
  im.own = o.own === 'lease' ? 'lease' : 'own'; im.cond = Number.isFinite(o.cond) ? o.cond : 1;
  im.slot = pickSlot(tools, t => t.key, key, o.slot);
  im.park = im.slot < 0 ? [...TOOL_SPEC[key].park] : tSlot(im.slot);
  if (im.slot >= 0 && key === 'trailer') im.park[1] += 0.5;
  tools.push(im);
  parkTool(im);
  applyUpgradesTo(im);
  updParkPad();
  return im;
}

function dispose(group) { group.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); }

export function removeTool(im) {
  parkTool(im);
  scene.remove(im.group); dispose(im.group);
  tools.splice(tools.indexOf(im), 1);
  updParkPad();
}

/** Puts an implement back on its parking spot (detached from any tractor). */
export function parkTool(im) {
  if (im.on) { const v = im.on; v.tool = null; v.impl = null; v.lowered = false; im.on = null; }
  if (im.key === 'trailer') {
    im.tipping = false;
    im.h = 0; im.x = im.park[0]; im.z = im.park[1] - TRAILER_L;
    im.group.position.set(im.x, 0, im.z); im.group.rotation.y = 0;
    scene.add(im.group);
    return;
  }
  scene.add(im.group);
  im.group.position.set(im.park[0], 0, im.park[1]);
  im.group.rotation.set(0, 0, 0);
  im.lift.position.y = im.up;
}

function makeVehicle(type) {
  const v = {
    type, x: 0, z: 0, h: 0, speed: 0, steer: 0, thr: 0, lowered: false, prevTool: null, harvestT: 0, puffT: 0,
    tank: { crop: -1, amount: 0, cap: 9000 }, seedCrop: 0, unloading: false, sold: 0, soldMoney: 0, soldCrop: 0,
    moved: 0, movedCrop: 0, waiting: null, baleAcc: 0, available: true,
  };
  if (type === 'tractor') {
    Object.assign(v, { name: 'Traktor Brázda 140', r: 1.9, wb: 2.4, vmax: 11.1, vwork: 4.2, acc: 3.2, brk: 7, vrev: 3.6, impl: 'cultivator', mapCol: '#5f9c7c', home: [8.5, -36.5], fuelCap: 250, fuelDrive: 0.05, fuelWork: 0.1 }, buildTractor());
  } else if (type === 'combine') {
    Object.assign(v, {
      name: 'Kombajn Klas 7', gen: 'kombajnu', harvester: true, r: 3.0, wb: 3.6, vmax: 6.9, vwork: 2.8, acc: 1.8, brk: 5, vrev: 2.4,
      toolW: 5.4, toolZ: 4.4, header: 'grain', mapCol: '#cf5a4a', home: [-10, -8], chaff: col('#eadba6'), fuelCap: 500, fuelDrive: 0.08, fuelWork: 0.16,
    }, buildCombine());
  } else if (type === 'beet') {
    Object.assign(v, {
      name: 'Sklízeč cukrovky Bulva 6', gen: 'sklízeče', harvester: true, r: 3.2, wb: 4.6, vmax: 6.4, vwork: 2.5, acc: 1.6, brk: 5, vrev: 2.2,
      toolW: 4.5, toolZ: 4.6, header: 'beet', mapCol: '#4d7c9e', home: [18, -27], chaff: col('#a98a66'), fuelCap: 600, fuelDrive: 0.09, fuelWork: 0.18,
    }, buildBeetHarvester());
    v.tank.cap = 20000;
  } else if (type === 'forest') {
    Object.assign(v, {
      name: 'Harvestor Les 8', gen: 'harvestoru', r: 2.6, wb: 3.8, vmax: 8.3, vwork: 3, acc: 2.2, brk: 6, vrev: 3, mapCol: '#e0b13a',
      home: [0, 116], fuelCap: 300, fuelDrive: 0.07, fuelWork: 0.12, logs: 0, logCap: WOOD.logCap, cutting: null,
    }, buildForester());
  } else if (type === 'jeep') {
    Object.assign(v, {
      name: 'Jeep Lesák 4×4', gen: 'jeepu', r: 1.6, wb: 2.6, vmax: 22.2, vwork: 0, acc: 4.6, brk: 9, vrev: 5, mapCol: '#d9a441',
      home: [-27, -27], fuelCap: 70, fuelDrive: 0.022, fuelWork: 0,
    }, buildJeep());
  }
  v.fuel = v.fuelCap; v.y = 0; v.tool = null; v.impl = null; v.available = true;
  v.group.rotation.order = 'YXZ'; // heading, then pitch and roll on slopes
  return v;
}

/** A new machine on its parking place. o = { id, own, cond, slot }. */
export function addVehicle(type, o = {}) {
  const v = makeVehicle(type);
  v.id = o.id || newId(type); noteId(v.id);
  v.own = o.own === 'lease' ? 'lease' : 'own'; v.cond = Number.isFinite(o.cond) ? o.cond : 1;
  v.slot = pickSlot(vehicles, x => x.type, type, o.slot);
  if (v.slot >= 0) v.home = vSlot(v.slot);
  v.x = v.home[0]; v.z = v.home[1];
  scene.add(v.group);
  vehicles.push(v);
  if (v.harvester) HARVESTERS.push(v);
  if (v.type === 'combine') { v.headerPark = v.slot < 0 ? [-17, -27] : [v.home[0], v.home[1] - 9.5]; setHeader(v, 'grain'); }
  applyUpgradesTo(v);
  updParkPad();
  return v;
}

export function removeVehicle(v) {
  if (v.tool) parkTool(v.tool);
  if (v.type === 'combine') for (const hd of [v.grainHdr, v.cornHdr]) { hd.parent?.remove(hd); dispose(hd); }
  scene.remove(v.group); dispose(v.group);
  vehicles.splice(vehicles.indexOf(v), 1);
  if (v.harvester) HARVESTERS.splice(HARVESTERS.indexOf(v), 1);
  updParkPad();
}

/** Removes every machine and implement (new game, loading). */
export function clearFleet() {
  while (vehicles.length) removeVehicle(vehicles[vehicles.length - 1]);
  while (tools.length) removeTool(tools[tools.length - 1]);
  seq = 0;
}

/** Puts a vehicle back at its start position (new game, or missing in an old save). */
export function sendHome(v) {
  Object.assign(v, { x: v.home[0], z: v.home[1], h: 0, speed: 0, steer: 0, lowered: false, unloading: false, fuel: v.fuelCap });
  if (v.harvester) v.tank = { crop: -1, amount: 0, cap: v.tank.cap };
}

/* ---------- combine headers ---------- */
/** Mounts the grain or row header on combine v; the other one waits in the yard by the shed. */
export function setHeader(v, key) {
  const on = key === 'corn' ? v.cornHdr : v.grainHdr;
  const off = key === 'corn' ? v.grainHdr : v.cornHdr;
  v.header = key === 'corn' ? 'corn' : 'grain';
  v.lowered = false;
  v.headerLift.add(on); on.position.set(0, 0, 0); on.rotation.set(0, 0, 0);
  scene.add(off); off.position.set(v.headerPark[0], 0, v.headerPark[1]); off.rotation.set(0, 0, 0);
}

/* ---------- tractor attachments ---------- */
/** Hitches implement im to tractor v (taking it off another tractor if needed); v's old tool goes back to its spot. */
export function attachTool(v, im) {
  if (v.tool && v.tool !== im) parkTool(v.tool);
  if (im.on && im.on !== v) parkTool(im);
  im.on = v; v.tool = im; v.impl = im.key;
  v.lowered = false;
  v.vwork = im.speed * (G.upgrades?.tractor ? 1.1 : 1);
  if (im.key === 'trailer') {
    // put the trailer straight behind the tractor
    im.h = v.h;
    const [hx, hz] = hitchPos(v);
    im.x = hx - Math.sin(im.h) * TRAILER_L;
    im.z = hz - Math.cos(im.h) * TRAILER_L;
    return;
  }
  v.group.add(im.group);
  im.group.position.set(0, 0, HITCH_Z);
  im.group.rotation.set(0, 0, 0);
}

/** Working width and offset of the working line from the vehicle origin. */
export function toolLine(v) {
  if (v.type !== 'tractor') return { W: v.toolW, Z: v.toolZ };
  return v.tool ? { W: v.tool.width, Z: HITCH_Z + v.tool.workZ } : { W: 0, Z: HITCH_Z };
}

const hitchPos = v => [v.x + Math.sin(v.h) * HITCH_Z, v.z + Math.cos(v.h) * HITCH_Z];
const MAX_ARTICULATION = 1.3; // rad, the drawbar stops a full jackknife

/** A trailer's collision shape: two circles along the body (local z, radius). */
const TRAILER_SHAPE = [[-0.9, 1.45], [2.3, 1.45]];
export function trailerCircles(t, out = []) {
  const s = Math.sin(t.h), c = Math.cos(t.h);
  for (const [lz, r] of TRAILER_SHAPE) out.push({ x: t.x + s * lz, z: t.z + c * lz, r });
  return out;
}

/** How deep a circle sinks into buildings, trees, fences, other vehicles and trailers (skip = pieces to ignore). */
function penetration(x, z, r, skip) {
  let p = 0;
  const circ = c => { const d = Math.hypot(x - c.x, z - c.z), m = c.r + r; if (d < m) p += m - d; };
  const box = b => {
    if (b.off) return;
    const d = Math.hypot(x - clamp(x, b.x0, b.x1), z - clamp(z, b.z0, b.z1));
    if (d < r) p += r - d;
  };
  nearShapes(x, z, r + 1, circ, box);
  treeBuf.length = 0;
  for (const c of forestColliders(treeBuf, x, z, r + 2)) circ(c);
  for (const o of vehicles) if (!skip.includes(o)) circ(o);
  for (const t of tools) if (t.key === 'trailer' && !skip.includes(t)) { circBuf.length = 0; for (const c of trailerCircles(t, circBuf)) circ(c); }
  for (const c of movers) circ(c);
  return p;
}
const circBuf = [];
/** True if a circle would sit noticeably inside a fixed obstacle or another vehicle. */
export const blockedAt = (x, z, r, self) => penetration(x, z, r, towed(self) ? [self, towed(self)] : [self]) > 0.3;
const trailerBuf = [];
const trailerPen = t => { trailerBuf.length = 0; return trailerCircles(t, trailerBuf).reduce((a, c) => a + penetration(c.x, c.z, c.r, [t.on, t]), 0); };

/** Centre of trailer t's body in world space (for zone checks). */
export const trailerCenter = t => ({ x: t.x + Math.sin(t.h) * 0.8, z: t.z + Math.cos(t.h) * 0.8 });

/** Every trailer: an attached one is dragged behind its tractor's hitch (also in reverse); all sit on the ground and show their load. */
export function updateTrailers(dt) {
  for (const t of tools) if (t.key === 'trailer') updateTrailer(t, dt);
}
function updateTrailer(t, dt) {
  const v = t.on;
  if (v) {
    const before = trailerPen(t), old = { x: t.x, z: t.z, h: t.h };
    const [hx, hz] = hitchPos(v);
    const dx = hx - t.x, dz = hz - t.z;
    if (Math.hypot(dx, dz) > 1e-3) t.h = Math.atan2(dx, dz);
    const rel = angDiff(v.h, t.h);
    if (Math.abs(rel) > MAX_ARTICULATION) t.h = v.h + Math.sign(rel) * MAX_ARTICULATION;
    const nx = hx - Math.sin(t.h) * TRAILER_L, nz = hz - Math.cos(t.h) * TRAILER_L;
    let ds = (nx - t.x) * Math.sin(t.h) + (nz - t.z) * Math.cos(t.h);
    t.x = nx; t.z = nz;
    // the trailer would run into something: undo this frame's move of tractor and trailer
    if (v.prev && trailerPen(t) > before + 1e-4) {
      Object.assign(t, old);
      v.x = v.prev.x; v.z = v.prev.z; v.h = v.prev.h; v.speed = 0;
      ds = 0;
    }
    for (const w of t.wheels) w.userData.spin.rotation.x += ds / w.userData.r;
    trailerBuf.length = 0;
    for (const c of trailerCircles(t, trailerBuf)) pushBales(c.x, c.z, c.r);
  }
  sitOnGround(t.group, t.x, t.z, t.h, 3.2, 2.3, 0.8);
  t.tip.rotation.x += ((t.tipping ? -0.6 : 0) - t.tip.rotation.x) * Math.min(1, dt * 1.5);
  const fill = t.tank.amount / t.tank.cap;
  t.grain.visible = fill > 0;
  t.grain.scale.y = Math.max(0.02, fill * 1.15);
  if (t.tank.crop >= 0) t.grainMat.color.copy(CROPS[t.tank.crop].heapCol);
  t.baleMeshes.forEach((m, i) => (m.visible = i < t.bales));
}

/* ---------- driving ---------- */
function collide(v) {
  let hit = false;
  const push = c => {
    const dx = v.x - c.x, dz = v.z - c.z, d = Math.hypot(dx, dz), min = c.r + v.r;
    if (d < min && d > 1e-4) { v.x += (dx / d) * (min - d); v.z += (dz / d) * (min - d); hit = true; }
  };
  const box = b => {
    if (b.off) return;
    const cx = clamp(v.x, b.x0, b.x1), cz = clamp(v.z, b.z0, b.z1), dx = v.x - cx, dz = v.z - cz, d = Math.hypot(dx, dz);
    if (d >= v.r) return;
    if (d > 1e-4) { v.x += (dx / d) * (v.r - d); v.z += (dz / d) * (v.r - d); }
    else {
      const opts = [[b.x0 - v.r - v.x, 0], [b.x1 + v.r - v.x, 0], [0, b.z0 - v.r - v.z], [0, b.z1 + v.r - v.z]];
      opts.sort((a, c) => Math.hypot(...a) - Math.hypot(...c));
      v.x += opts[0][0]; v.z += opts[0][1];
    }
    hit = true;
  };
  nearShapes(v.x, v.z, v.r + 1, push, box);
  treeBuf.length = 0;
  for (const c of forestColliders(treeBuf, v.x, v.z, v.r + 2)) push(c);
  for (const o of vehicles) if (o !== v) push(o);
  for (const c of movers) push(c);
  // parked trailers and the trailers of other vehicles are obstacles too (not the one v tows)
  for (const t of tools) if (t.key === 'trailer' && t !== v.tool) { circBuf.length = 0; for (const c of trailerCircles(t, circBuf)) push(c); }
  const x = clamp(v.x, BOUNDS.x0, BOUNDS.x1), z = clamp(v.z, BOUNDS.z0, BOUNDS.z1);
  if (x !== v.x || z !== v.z) hit = true;
  v.x = x; v.z = z;
  if (hit) v.speed *= 0.6;
  pushBales(v.x, v.z, v.r);
}

const treeBuf = [];

/** Bicycle-model driving. input = { thr: -1..1, st: -1..1 } (st > 0 turns left). */
export function drive(v, dt, input) {
  v.prev = { x: v.x, z: v.z, h: v.h };
  let thr = input ? input.thr : 0;
  const st = input ? input.st : 0;
  if (v.fuel <= 0) thr = 0; // engine stalls without diesel
  const cf = condFactor(v.cond), toolCf = v.tool ? condFactor(v.tool.cond) : 1;
  const vmax = (v.lowered ? v.vwork * toolCf : v.vmax) * cf;
  const maxSteer = lerp(0.62, 0.24, clamp(Math.abs(v.speed) / v.vmax, 0, 1));
  v.steer += (st * maxSteer - v.steer) * Math.min(1, dt * 5);
  if (thr > 0) v.speed += (v.speed < 0 ? v.brk : v.acc) * dt;
  else if (thr < 0) v.speed -= (v.speed > 0 ? v.brk : v.acc * 0.7) * dt;
  else v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 2.4 * dt);
  if (v.speed > vmax) v.speed = Math.max(vmax, v.speed - v.brk * dt);
  if (v.speed < -v.vrev) v.speed = -v.vrev;
  v.h += (v.speed / v.wb) * Math.tan(v.steer) * dt;
  v.x += Math.sin(v.h) * v.speed * dt;
  v.z += Math.cos(v.h) * v.speed * dt;
  collide(v);
  v.thr = thr;
}

/**
 * Places a vehicle body on the ground: height under its centre, pitch from the ground in front of
 * and behind it (len apart), roll from both sides (wid apart). off = centre offset along the body.
 * Returns the ground height.
 */
export function sitOnGround(group, x, z, h, len, wid, off) {
  const s = Math.sin(h), c = Math.cos(h), cx = x + s * off, cz = z + c * off;
  const hf = groundH(cx + (s * len) / 2, cz + (c * len) / 2), hb = groundH(cx - (s * len) / 2, cz - (c * len) / 2);
  const hl = groundH(cx + (c * wid) / 2, cz - (s * wid) / 2), hr = groundH(cx - (c * wid) / 2, cz + (s * wid) / 2);
  const y = Math.max(groundH(x, z), (hf + hb) / 2 - 0.05);
  group.rotation.order = 'YXZ';
  group.position.set(x, y, z);
  group.rotation.set(-Math.atan2(hf - hb, len), h, Math.atan2(hl - hr, wid));
  return y;
}

const _v = new THREE.Vector3();
/** Moves meshes to match the simulation: wheels, steering, lifts, reel, discs, pipe, grain heap, exhaust. */
export function visual(v, dt, tankCropColor) {
  v.y = sitOnGround(v.group, v.x, v.z, v.h, v.wb, v.r * 1.1, 0);
  for (const w of v.wheels) w.userData.spin.rotation.x += (v.speed * dt) / w.userData.r;
  for (const p of v.front) p.rotation.y = v.steer;
  for (const p of v.rear) p.rotation.y = -v.steer;
  const k = Math.min(1, dt * 4);
  if (v.type === 'tractor') {
    const im = v.tool;
    if (im?.lift) {
      im.lift.position.y += ((v.lowered ? im.down : im.up) - im.lift.position.y) * k;
      if (im.roller && v.lowered) im.roller.rotation.x += (v.speed * dt) / 0.3;
      if (im.wheels && (v.lowered || im.key === 'baler' || im.key === 'watertank')) for (const w of im.wheels) w.userData.spin.rotation.x += (v.speed * dt) / w.userData.r;
      if (im.discs && v.lowered) im.discs.forEach((d, i) => (d.rotation.y += (i ? 1 : -1) * dt * 18));
    }
  } else if (v.type === 'jeep') {
    // nothing to animate besides wheels and steering
  } else if (v.type === 'forest') {
    // crane turns toward the tree being cut, then swings back over the bunk
    const target = v.cutting ? v.cutting.ang : 0;
    v.crane.rotation.y += (target - v.crane.rotation.y) * Math.min(1, dt * 3);
    v.boom.rotation.x += ((v.cutting ? 0.25 : 0) - v.boom.rotation.x) * Math.min(1, dt * 3);
    const n = Math.ceil((v.logs / v.logCap) * v.logMeshes.length);
    v.logMeshes.forEach((m, i) => (m.visible = i < n));
  } else {
    v.headerLift.position.y += ((v.lowered ? 0 : 0.6) - v.headerLift.position.y) * k;
    if (v.lowered && v.header !== 'corn') v.reel.rotation.x += dt * (v.header === 'beet' ? 6 : 2.6);
    v.pipe.rotation.y += ((v.unloading ? -Math.PI / 2 : 0) - v.pipe.rotation.y) * Math.min(1, dt * 2.5);
    v.grain.visible = v.tank.amount > 0;
    v.grain.scale.y = Math.max(0.02, (v.tank.amount / v.tank.cap) * 0.7);
    if (tankCropColor) v.grainMat.color.copy(tankCropColor);
  }
  v.puffT -= dt;
  if ((v === G.active || v.helper) && v.puffT <= 0 && (v.thr > 0 || v.lowered)) {
    v.puffT = 0.12;
    v.group.updateMatrixWorld(true);
    _v.copy(v.exhaust); v.group.localToWorld(_v);
    emit(_v.x, _v.y, _v.z, SMOKE, 0.35, (Math.random() - 0.5) * 0.3, 1.4, (Math.random() - 0.5) * 0.3, 1.3);
  }
}

/** Applies bought upgrades to every machine (called whenever ownership changes). */
export function applyUpgrades(up) {
  G.upgrades = up;
  for (const v of vehicles) applyUpgradesTo(v);
  for (const t of tools) applyUpgradesTo(t);
}
/** One machine or implement: the upgrades bought so far (also for pieces added later). */
function applyUpgradesTo(o) {
  const up = G.upgrades || {};
  if (o.type === 'tractor') { o.vmax = up.tractor ? 13.9 : 11.1; if (o.tool) o.vwork = o.tool.speed * (up.tractor ? 1.1 : 1); }
  if (o.type === 'combine') o.tank.cap = up.combine ? 13000 : 9000;
  if (o.key === 'cultivator') { o.width = up.cultivator ? 6.3 : 4.2; o.group.scale.x = up.cultivator ? 1.5 : 1; }
  if (o.key === 'trailer') { o.tank.cap = up.trailer ? 22000 : 14000; o.tip.scale.y = up.trailer ? 1.35 : 1; }
}
