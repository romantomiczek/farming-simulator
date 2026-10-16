import * as THREE from 'three';
import { scene } from '../render/core.js';
import { clamp, lerp, col, angDiff } from '../core/util.js';
import { nearShapes, BOUNDS, movers, PARK, PAD, roadAt, inRect } from '../world/layout.js';
import { emit, SMOKE } from '../fx/particles.js';
import { flatPlane, glassMat, lampMat, beaconMat } from '../render/materials.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LOD } from './parts.js';
import { G, condFactor } from '../game/state.js';
import { buildTractor, buildCombine, buildBeetHarvester, buildForester, buildCultivator, buildSeeder, buildTrailer, buildPlough, buildSpreader, buildBaler, buildWaterTank, buildMower, buildJeep, buildSUV, buildPickup } from './models.js';
import { CROPS } from '../game/crops.js';
import { MODEL, START_MODEL, modelName } from '../game/catalog.js';
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

/** The model to build: the wanted one if it is of this kind, else the kind's start model. */
const modelFor = (kind, id) => (MODEL[id]?.kind === kind ? MODEL[id] : MODEL[START_MODEL[kind]]);

function makeTool(key, mid) {
  const s = TOOL_SPEC[key], m = modelFor(key, mid);
  const im = Object.assign(s.build(m.look), {
    key, model: m.id, name: modelName(m), width: m.width ?? s.width, workZ: s.workZ, speed: m.speed ?? s.speed, need: m.hp || 0, dust: s.dust, own: 'own', cond: 1, on: null,
  });
  if (key === 'trailer') {
    // drawbar = axle to eye; two or three collision circles along the body
    const L = im.bodyLen, n = L > 7 ? 3 : 2, shape = [];
    for (let k = 0; k < n; k++) shape.push([-2 + 1.1 + (k * (L - 2.2)) / (n - 1), 1.45]);
    Object.assign(im, { x: 0, z: 0, h: 0, tank: { crop: -1, amount: 0, cap: m.cap }, bales: 0, hay: 0, baleCap: im.baleMeshes.length, tipping: false, sold: 0, soldMoney: 0, soldCrop: 0, shape, centerZ: -2 + L / 2 });
  }
  if (key === 'watertank') Object.assign(im, { water: 0, waterCap: m.cap, milk: false });
  return im;
}

/** A new implement or trailer on its parking place. o = { id, model, own, cond, slot }. */
export function addTool(key, o = {}) {
  const im = makeTool(key, o.model);
  im.id = o.id || newId(key); noteId(im.id);
  im.own = o.own === 'lease' ? 'lease' : 'own'; im.cond = Number.isFinite(o.cond) ? o.cond : 1;
  im.slot = pickSlot(tools, t => t.key, key, o.slot);
  im.park = im.slot < 0 ? [...TOOL_SPEC[key].park] : tSlot(im.slot);
  if (im.slot >= 0 && key === 'trailer') im.park[1] += 0.5;
  tools.push(im);
  parkTool(im);
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
    im.h = 0; im.x = im.park[0]; im.z = im.park[1] - im.drawbar;
    im.group.position.set(im.x, 0, im.z); im.group.rotation.y = 0;
    scene.add(im.group);
    return;
  }
  scene.add(im.group);
  im.group.position.set(im.park[0], 0, im.park[1]);
  im.group.rotation.set(0, 0, 0);
  im.lift.position.y = im.up;
}

/** Words for messages: "jede s traktorem". */
const NOUN = { tractor: 'traktorem', combine: 'kombajnem', beet: 'sklízečem', forest: 'harvestorem', jeep: 'autem' };

function makeVehicle(type, mid) {
  const m = modelFor(type, mid), look = m.look;
  const v = {
    type, x: 0, z: 0, h: 0, speed: 0, steer: 0, thr: 0, lowered: false, prevTool: null, harvestT: 0, puffT: 0,
    tank: { crop: -1, amount: 0, cap: 9000 }, seedCrop: 0, unloading: false, sold: 0, soldMoney: 0, soldCrop: 0,
    moved: 0, movedCrop: 0, waiting: null, baleAcc: 0, available: true,
  };
  if (type === 'tractor') {
    Object.assign(v, { r: 1.9, wb: 2.4, vwork: 4.2, acc: 3.2, brk: 7, vrev: 3.6, mapCol: look.body || '#5f9c7c', home: [8.5, -36.5], fuelDrive: 0.05, fuelWork: 0.1 }, buildTractor(look));
    // a bigger tractor: longer wheelbase, hitch further back, a bit more diesel per hour
    Object.assign(v, { r: v.r * v.scale, wb: v.wb * v.scale, hitchZ: HITCH_Z * v.scale, vmax: m.kmh / 3.6, fuelCap: m.fuel, hp: m.hp, fuelDrive: 0.05 * m.hp / 140, fuelWork: 0.1 * m.hp / 140 });
  } else if (type === 'combine') {
    Object.assign(v, {
      gen: 'kombajnu', harvester: true, r: 3.0, wb: 3.6, vmax: 6.9, vwork: 2.8, acc: 1.8, brk: 5, vrev: 2.4,
      toolW: 5.4, toolZ: 4.4, header: 'grain', mapCol: '#cf5a4a', home: [-10, -8], chaff: col('#eadba6'), fuelCap: 500, fuelDrive: 0.08, fuelWork: 0.16,
    }, buildCombine(look));
    const s = v.scale;
    Object.assign(v, { r: 3.0 * s, wb: 3.6 * s, toolW: m.header, toolZ: 4.4 * s, fuelCap: m.fuel, pipeRate: m.unload, hdrScale: v.hdrScale });
    v.tank.cap = m.tank;
  } else if (type === 'beet') {
    Object.assign(v, {
      gen: 'sklízeče', harvester: true, r: 3.2, wb: 4.6, vmax: 6.4, vwork: 2.5, acc: 1.6, brk: 5, vrev: 2.2,
      toolW: 4.5, toolZ: 4.6, header: 'beet', mapCol: '#4d7c9e', home: [18, -27], chaff: col('#a98a66'), fuelCap: 600, fuelDrive: 0.09, fuelWork: 0.18,
    }, buildBeetHarvester(look));
    const s = v.scale;
    Object.assign(v, { r: 3.2 * s, wb: 4.6 * s, toolW: m.rows * 0.75, toolZ: 4.6 * s, fuelCap: m.fuel, vwork: 2.5 * (m.work || 1) });
    v.tank.cap = m.tank;
  } else if (type === 'forest') {
    Object.assign(v, {
      gen: 'harvestoru', r: 2.6, wb: 3.8, vmax: 8.3, vwork: 3, acc: 2.2, brk: 6, vrev: 3, mapCol: '#e0b13a',
      home: [0, 116], fuelCap: 300, fuelDrive: 0.07, fuelWork: 0.12, logs: 0, logCap: WOOD.logCap, cutting: null,
    }, buildForester(look));
    const s = v.scale;
    Object.assign(v, { r: 2.6 * s, wb: 3.8 * s, fuelCap: m.fuel, logCap: m.logs, cutSpeed: m.cut });
  } else if (type === 'jeep') {
    Object.assign(v, {
      gen: 'auta', r: 1.6, wb: 2.6, vmax: 22.2, vwork: 0, acc: 4.6, brk: 9, vrev: 5, mapCol: '#d9a441',
      home: [-27, -27], fuelCap: 70, fuelDrive: 0.022, fuelWork: 0,
    }, buildOf(m)(look));
    Object.assign(v, { r: m.r || 1.6, wb: m.wb || 2.6, vmax: m.kmh / 3.6, fuelCap: m.fuel, offroad: m.offroad });
  }
  Object.assign(v, { model: m.id, name: modelName(m), noun: NOUN[type] });
  v.hitchZ = v.hitchZ ?? HITCH_Z;
  v.fuel = v.fuelCap; v.y = 0; v.tool = null; v.impl = null; v.available = true;
  v.group.rotation.order = 'YXZ'; // heading, then pitch and roll on slopes
  return v;
}

/** A new machine on its parking place. o = { id, model, own, cond, slot }. */
export function addVehicle(type, o = {}) {
  const v = makeVehicle(type, o.model);
  v.id = o.id || newId(type); noteId(v.id);
  v.own = o.own === 'lease' ? 'lease' : 'own'; v.cond = Number.isFinite(o.cond) ? o.cond : 1;
  v.slot = pickSlot(vehicles, x => x.type, type, o.slot);
  if (v.slot >= 0) v.home = vSlot(v.slot);
  v.x = v.home[0]; v.z = v.home[1];
  scene.add(v.group);
  vehicles.push(v);
  if (v.harvester) HARVESTERS.push(v);
  if (v.type === 'combine') { v.headerPark = v.slot < 0 ? [-17, -27] : [v.home[0], v.home[1] - 9.5]; setHeader(v, 'grain'); }
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
  v.headerLift.add(on); on.position.set(0, 0, 0); on.rotation.set(0, 0, 0); on.scale.set(v.hdrScale, 1, 1);
  // in the yard the spare header keeps its size: the combine's scale is not around it there
  scene.add(off); off.position.set(v.headerPark[0], 0, v.headerPark[1]); off.rotation.set(0, 0, 0); off.scale.set(v.hdrScale * v.scale, v.scale, v.scale);
  if (v.lodFar) setFar(v, true);
}

/* ---------- tractor attachments ---------- */
/** Hitches implement im to tractor v (taking it off another tractor if needed); v's old tool goes back to its spot. */
export function attachTool(v, im) {
  if (v.tool && v.tool !== im) parkTool(v.tool);
  if (im.on && im.on !== v) parkTool(im);
  im.on = v; v.tool = im; v.impl = im.key;
  v.lowered = false;
  v.vwork = im.speed * powerShare(v, im);
  if (im.key === 'trailer') {
    // put the trailer straight behind the tractor
    im.h = v.h;
    const [hx, hz] = hitchPos(v);
    im.x = hx - Math.sin(im.h) * im.drawbar;
    im.z = hz - Math.cos(im.h) * im.drawbar;
    return;
  }
  v.group.add(im.group);
  im.group.position.set(0, 0, v.hitchZ);
  im.group.rotation.set(0, 0, 0);
}

/* ---------- power ---------- */
/** The least share of working speed a too weak tractor still manages. */
export const MIN_POWER = 0.35;
/**
 * Share of full working speed tractor v manages with implement im: its power against the power the
 * implement needs (MIN_POWER at least). 1 for anything that is not a tractor with a field tool.
 */
export const powerShare = (v, im) => (!im || !v.hp || !im.need ? 1 : clamp(v.hp / im.need, MIN_POWER, 1));
/** How full the load of implement t is (0..1), or -1 when it carries nothing. */
export function loadOf(t) {
  if (t?.key === 'trailer') return Math.max(t.tank.amount / t.tank.cap, t.bales / t.baleCap);
  if (t?.key === 'watertank') return t.water / t.waterCap;
  return -1;
}
/**
 * Share of top speed tractor v keeps with its trailer or tank: an empty one costs 40 % of what it
 * needs, a full one all of it; too little power slows the tractor down (to 45 % at worst).
 */
export function towShare(v) {
  const t = v.tool, load = loadOf(t);
  if (load < 0 || !v.hp || !t.need) return 1;
  return clamp(v.hp / (t.need * (0.4 + 0.6 * load)), 0.45, 1);
}

/** Working width and offset of the working line from the vehicle origin. */
export function toolLine(v) {
  if (v.type !== 'tractor') return { W: v.toolW, Z: v.toolZ };
  return v.tool ? { W: v.tool.width, Z: v.hitchZ + v.tool.workZ } : { W: 0, Z: v.hitchZ };
}

const hitchPos = v => [v.x + Math.sin(v.h) * v.hitchZ, v.z + Math.cos(v.h) * v.hitchZ];
const MAX_ARTICULATION = 1.3; // rad, the drawbar stops a full jackknife

/** A trailer's collision shape: circles along the body (t.shape: local z, radius). */
export function trailerCircles(t, out = []) {
  const s = Math.sin(t.h), c = Math.cos(t.h);
  for (const [lz, r] of t.shape) out.push({ x: t.x + s * lz, z: t.z + c * lz, r });
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
export const trailerCenter = t => ({ x: t.x + Math.sin(t.h) * t.centerZ, z: t.z + Math.cos(t.h) * t.centerZ });

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
    const nx = hx - Math.sin(t.h) * t.drawbar, nz = hz - Math.cos(t.h) * t.drawbar;
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
  sitOnGround(t.group, t.x, t.z, t.h, t.bodyLen * 0.57, 2.3, t.centerZ);
  t.tip.rotation.x += ((t.tipping ? -0.6 : 0) - t.tip.rotation.x) * Math.min(1, dt * 1.5);
  const fill = t.tank.amount / t.tank.cap;
  t.grain.visible = fill > 0;
  t.grain.scale.y = Math.max(0.02, fill * t.grainH);
  if (t.tank.crop >= 0) t.grainMat.color.copy(CROPS[t.tank.crop].heapCol);
  t.baleMeshes.forEach((m, i) => (m.visible = i < t.bales));
}

/* ---------- level of detail ---------- */
/**
 * Seen from further than the preset's machineLod distance (from the camera), a machine or implement is drawn with a
 * simplified model of its kind (built once with LOD.low, everything merged into one geometry), and
 * all far pieces of one kind share one instanced mesh: a big fleet costs one draw call per kind.
 * The machine you drive and its implement always keep the detailed model. Loads (grain, bales, logs)
 * keep showing at any distance.
 */
const VEHICLE_BUILD = { tractor: buildTractor, combine: buildCombine, beet: buildBeetHarvester, forest: buildForester, jeep: buildJeep, suv: buildSUV, pickup: buildPickup };
/** The builder of model m: its own (look.builder, e.g. the SUV among the cars) or the kind's. */
const buildOf = m => VEHICLE_BUILD[m.look.builder] || TOOL_SPEC[m.kind]?.build || VEHICLE_BUILD[m.kind];
/** A fresh detailed model of model id, outside the game (shop pictures): what the builder returns. */
export const buildModel = id => buildOf(MODEL[id])(MODEL[id].look);
const KEEP = new Set(['position', 'normal', 'uv', 'color', 'surf']);
/** Lamps, glass and beacons become plain colours in the far model: [hex, roughness, metalness]. */
const FAR_PLAIN = new Map([[glassMat, ['#4b6470', 0.15, 0.3]], [lampMat, ['#fff4d6', 0.3, 0]], [beaconMat, ['#f0a03a', 0.3, 0]]]);
const farGeo = new Map(), farSets = new Map(), _c = new THREE.Color();
let farMat = null, whiteUV = [0, 0];

/** The far model of model id (one per model: colours, size and extras differ). */
function farModel(id) {
  if (farGeo.has(id)) return farGeo.get(id);
  LOD.low = true;
  let m;
  try { m = buildOf(MODEL[id])(MODEL[id].look); } finally { LOD.low = false; }
  if (m.cornHdr) m.cornHdr.parent?.remove(m.cornHdr); // the grain header stays on, the row header is the spare one
  m.group.updateMatrixWorld(true);
  const geos = [];
  m.group.traverse(o => {
    if (!o.isMesh || o.userData.noBake) return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!KEEP.has(k)) g.deleteAttribute(k);
    if (o.material.vertexColors) {
      if (!farMat) { farMat = o.material; const uv = g.attributes.uv; whiteUV = [uv.getX(0), uv.getY(0)]; }
    } else {
      const n = g.attributes.position.count, [hex, rough, metal] = FAR_PLAIN.get(o.material) || ['#' + o.material.color.getHexString(), o.material.roughness ?? 0.8, 0];
      _c.set(hex).convertSRGBToLinear();
      g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3).map((_, i) => [_c.r, _c.g, _c.b][i % 3]), 3));
      g.setAttribute('surf', new THREE.Float32BufferAttribute(new Float32Array(n * 2).map((_, i) => (i % 2 ? metal : rough)), 2));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2).map((_, i) => whiteUV[i % 2]), 2));
    }
    geos.push(g);
  });
  m.group.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
  if (m.cornHdr) m.cornHdr.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
  const geo = mergeGeometries(geos);
  geos.forEach(g => g.dispose());
  farGeo.set(id, geo);
  return geo;
}

/** The instanced mesh that draws the far pieces of one kind (grows when needed). */
function farSet(kind, need) {
  let s = farSets.get(kind);
  if (s && s.cap >= need) return s;
  const geo = farModel(kind), cap = Math.max(4, need * 2);
  if (s) { scene.remove(s.mesh); s.mesh.dispose(); }
  const mesh = new THREE.InstancedMesh(geo, farMat, cap);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.count = 0;
  scene.add(mesh);
  s = { mesh, cap, n: 0 };
  farSets.set(kind, s);
  return s;
}

/** The meshes of piece p's detailed model (not its loads, not an implement hitched to it, not a parked header). */
function nearMeshes(p, out = []) {
  const walk = o => {
    if (o !== p.group && tools.some(t => t.group === o)) return;
    if (o.isMesh) { if (!o.userData.noBake) out.push(o); return; }
    for (const c of o.children) walk(c);
  };
  walk(p.group);
  return out;
}
function setFar(p, far) {
  p.lodFar = far;
  for (const m of nearMeshes(p)) m.visible = !far;
  if (p.type === 'combine') { // the spare header in the yard is always detailed
    const spare = p.header === 'corn' ? p.grainHdr : p.cornHdr;
    spare.traverse(o => { if (o.isMesh && !o.userData.noBake) o.visible = true; });
  }
}

const posOf = p => (p.type || p.key === 'trailer' ? p : p.on || p.group.position);
const lodKind = p => p.model;
/**
 * Every frame after the camera moved: picks the detailed or the far model for every piece and
 * writes the far pieces into their kind's instanced mesh. eye = camera position, dist = machineLod (metres from the camera).
 */
/** Triangles of each kind's far model (for the developer panel and measurements). */
export const farStats = () => Object.fromEntries([...farGeo].map(([k, g]) => [k, g.attributes.position.count / 3]));

export function updLOD(eye, dist) {
  const counts = new Map();
  const decide = p => {
    const q = posOf(p), d = Math.hypot(q.x - eye.x, q.z - eye.z, eye.y);
    const far = p !== G.active && !(p.on && p.on === G.active) && d > dist + (p.lodFar ? -4 : 0);
    if (far !== !!p.lodFar) setFar(p, far);
    if (far) counts.set(lodKind(p), (counts.get(lodKind(p)) || 0) + 1);
  };
  vehicles.forEach(decide); tools.forEach(decide);
  for (const [kind, s] of farSets) { s.n = 0; if (!counts.has(kind)) { s.mesh.count = 0; s.mesh.visible = false; } }
  for (const [kind, n] of counts) farSet(kind, n);
  const put = p => {
    if (!p.lodFar) return;
    const s = farSets.get(lodKind(p));
    p.group.updateWorldMatrix(true, false);
    s.mesh.setMatrixAt(s.n++, p.group.matrixWorld);
  };
  vehicles.forEach(put); tools.forEach(put);
  for (const [kind, s] of farSets) if (counts.has(kind)) { s.mesh.count = s.n; s.mesh.visible = true; s.mesh.instanceMatrix.needsUpdate = true; }
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
  let vmax = (v.lowered ? v.vwork * toolCf : v.vmax * towShare(v)) * cf;
  // cars built for the road are slower in the fields and the forest
  if (v.offroad < 1 && (v.offT = (v.offT || 0) - dt) <= 0) { v.offT = 0.25; v.offRoad = !roadAt(v.x, v.z, 1.5) && !inRect(v.x, v.z, PAD, 4); }
  if (v.offroad < 1 && v.offRoad) vmax *= v.offroad;
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
