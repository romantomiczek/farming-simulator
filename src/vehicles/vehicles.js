import * as THREE from 'three';
import { scene } from '../render/core.js';
import { clamp, lerp, col, angDiff } from '../core/util.js';
import { nearShapes, BOUNDS, movers, PARK, PAD, roadAt, inRect, CHOPPER_HOME } from '../world/layout.js';
import { emit, SMOKE } from '../fx/particles.js';
import { flatPlane, glassMat, lampMat, beaconMat, dirtMaterials } from '../render/materials.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { LOD } from './parts.js';
import { G, condFactor } from '../game/state.js';
import { buildTractor, buildCombine, buildBeetHarvester, buildForester, buildCultivator, buildSeeder, buildTrailer, buildPlough, buildSpreader, buildBaler, buildWaterTank, buildMower, buildJeep, buildSUV, buildPickup, buildSprayer, buildRoller, buildMulcher, buildLivestock, buildManureSpreader, buildSlurryTank, PALLET_MAT, buildTedder, buildWindrower, buildWrapper, buildChopper } from './models.js';
import { CROPS } from '../game/crops.js';
import { MODEL, START_MODEL, modelName } from '../game/catalog.js';
import { forestColliders } from '../world/forest.js';
import { pushBales } from '../world/bales.js';
import { groundH } from '../world/terrain.js';
import { WOOD } from '../game/balance.js';
import { footprint, partOf, worldPart, boxPart, partCircle, partPart, resolve } from './body.js';

/**
 * The fleet: every machine and every implement is its own piece (instance) with an id, owned or
 * leased, its own condition and load. vehicles = self-propelled machines, tools = implements and
 * trailers. Mounted field tools ride rigidly on a tractor's hitch: width = working width, workZ = working
 * line behind the hitch, speed = max working speed (m/s). Trailed ones (trailed: the trailer, the baler,
 * the tank) are articulated: they stay in the scene and follow the hitch of the tractor they are
 * attached to on their own wheels, see updateTrailers().
 * A tractor hitches an implement by reversing up to it (Q) and leaves it where it stands (Q again).
 * IMPL_ORDER is the order the implements are listed in.
 */
const TOOL_SPEC = {
  cultivator: { build: buildCultivator, name: 'Kultivátor', width: 4.2, workZ: -1.7, speed: 4.2, park: [8.5, -38.5], dust: col('#b48d68') },
  plough: { build: buildPlough, name: 'Pluh', width: 3.2, workZ: -2.2, speed: 3.1, park: [-12, -47.5], dust: col('#9b7656') },
  seeder: { build: buildSeeder, name: 'Secí stroj', width: 4.0, workZ: -1.5, speed: 4.2, park: [15.5, -38.5], dust: col('#c7a984') },
  spreader: { build: buildSpreader, name: 'Rozmetadlo', width: 12, workZ: -1.8, speed: 5.0, park: [-6.5, -47.5], dust: col('#f1eee6') },
  baler: { build: buildBaler, name: 'Lis na balíky', width: 2.0, workZ: -1.6, speed: 3.6, park: [-1, -47.5], dust: col('#eadba6'), trailed: true },
  trailer: { build: buildTrailer, name: 'Přívěs', width: 0, workZ: 0, speed: 4.2, park: [23.5, -37], trailed: true },
  watertank: { build: buildWaterTank, name: 'Cisterna', width: 0, workZ: 0, speed: 4.2, park: [4.5, -48.5], trailed: true },
  mower: { build: buildMower, name: 'Žací lišta', width: 3.0, workZ: -1.25, speed: 4.6, park: [12, -49], dust: col('#9cbf6a') },
  // finer field work (game/agro.js): weeds, a firm seedbed and stones, chopped stubble
  sprayer: { build: buildSprayer, name: 'Postřikovač', width: 18, workZ: -2.05, speed: 5.0, park: [23.5, -49], dust: col('#e6efe8') },
  roller: { build: buildRoller, name: 'Válec', width: 6, workZ: -1.7, speed: 4.6, park: [-16.5, -50], dust: col('#a8865f') },
  mulcher: { build: buildMulcher, name: 'Mulčovač', width: 3, workZ: -1.2, speed: 3.6, park: [18.5, -49.5], dust: col('#d9c27a') },
  // animals and their dung (game/animals.js): parked west of the machine park, by the south road
  livestock: { build: buildLivestock, name: 'Přívěs na zvířata', width: 0, workZ: 0, speed: 4.2, park: [-2, -72], trailed: true },
  manure: { build: buildManureSpreader, name: 'Rozmetadlo hnoje', width: 10, workZ: -6.5, speed: 4.0, park: [-2, -83], dust: col('#5a4630'), trailed: true },
  slurry: { build: buildSlurryTank, name: 'Cisterna na kejdu', width: 12, workZ: -5.6, speed: 4.4, park: [-2, -94], dust: col('#6a5a3a'), trailed: true },
  // hay and silage (game/forage.js): beside the animal trailers
  tedder: { build: buildTedder, name: 'Obraceč', width: 7.6, workZ: -1.3, speed: 4.6, park: [-10, -72], dust: col('#9cbf6a') },
  windrower: { build: buildWindrower, name: 'Shrnovač', width: 6.8, workZ: -1.7, speed: 4.4, park: [-10, -83], dust: col('#9cbf6a') },
  wrapper: { build: buildWrapper, name: 'Ovíječ balíků', width: 0, workZ: 0, speed: 3.6, park: [-10, -94], trailed: true },
};
export const IMPL_ORDER = ['cultivator', 'plough', 'seeder', 'spreader', 'baler', 'trailer', 'watertank', 'mower', 'sprayer', 'roller', 'mulcher', 'manure', 'slurry', 'livestock', 'tedder', 'windrower', 'wrapper'];
/** Static facts about an implement kind (name, width) for the UI, also when none is owned. */
export const toolInfo = key => TOOL_SPEC[key];
export const isToolKey = key => key in TOOL_SPEC;
export const VEHICLE_TYPES = ['tractor', 'combine', 'beet', 'forest', 'jeep', 'chopper'];

export const vehicles = [];
export const tools = [];
/** Live subset of vehicles: the combines, beet harvesters and forage harvesters. */
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

/**
 * A trailed implement built with its origin at the drawbar eye (baler, tank): its own axle becomes
 * the point it turns about (x, z), like a trailer's. drawbar = axle to eye, originZ = axle to the
 * model's origin, shape = collision circles along the body behind the drawbar (local z from the axle, radius).
 */
function trailedShape(im) {
  const fp = footprint(im.group), axle = im.wheels.reduce((a, w) => a + w.position.z, 0) / im.wheels.length;
  const db = -axle, z0 = fp.z0, z1 = Math.min(fp.z1, -1.2), r = Math.max(0.6, Math.min(1.4, (fp.x1 - fp.x0) / 2 - 0.05));
  const n = Math.max(1, Math.ceil((z1 - z0 - 2 * r) / (1.4 * r)) + 1), shape = [];
  for (let k = 0; k < n; k++) shape.push([db + (n === 1 ? (z0 + z1) / 2 : z0 + r + (k * (z1 - z0 - 2 * r)) / (n - 1)), r]);
  Object.assign(im, { drawbar: db, originZ: db, shape, centerZ: db + (z0 + z1) / 2, sitLen: z1 - z0, sitWid: fp.x1 - fp.x0, sitOff: db + (z0 + z1) / 2 });
}

function makeTool(key, mid) {
  const s = TOOL_SPEC[key], m = modelFor(key, mid);
  const im = Object.assign(s.build(m.look), {
    key, model: m.id, name: modelName(m), width: m.width ?? s.width, workZ: m.workZ ?? s.workZ, speed: m.speed ?? s.speed, need: m.hp || 0, dust: s.dust, own: 'own', cond: 1, on: null,
  });
  if (key === 'trailer') {
    // drawbar = axle to eye; two or three collision circles along the body
    const L = im.bodyLen, n = L > 7 ? 3 : 2, shape = [];
    for (let k = 0; k < n; k++) shape.push([-2 + 1.1 + (k * (L - 2.2)) / (n - 1), 1.45]);
    Object.assign(im, { tank: { crop: -1, amount: 0, cap: m.cap }, bales: 0, hay: 0, baleCap: im.baleMeshes.length, tipping: false, sold: 0, soldMoney: 0, soldCrop: 0, shape, centerZ: -2 + L / 2 });
    Object.assign(im, { originZ: 0, sitLen: L * 0.57, sitWid: 2.3, sitOff: im.centerZ });
  } else if (s.trailed) trailedShape(im);
  if (key === 'watertank') Object.assign(im, { water: 0, waterCap: m.cap, milk: false });
  if (key === 'trailer') Object.assign(im, { pallets: [], forage: null, grass: 0, silage: 0, pickup: !!m.look.pickup }); // pallets (game/animals.js), chaff or silage (game/forage.js)
  if (key === 'livestock') Object.assign(im, { animals: { kind: null, n: 0, health: 1 }, buyKind: 'cows', animalCap: m.cap || 1 });
  if (key === 'manure' || key === 'slurry') Object.assign(im, { load: 0, loadCap: m.cap });
  if (s.trailed) Object.assign(im, { trailed: true, x: 0, z: 0, h: 0 });
  else {
    im.foot = footprint(im.group, im.group, im.wings || []); // collision shape while hitched (trailers have their circles; folding wings left out)
    im.part = partOf(im.foot); // and while it stands alone (x, z = hitch point, h = heading)
    Object.assign(im, { x: 0, z: 0, h: 0 });
  }
  im.dirtU = { value: 0 }; dirtMaterials(im.group, im.dirtU); // mud (game/dirt.js)
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
  if (im.on) { const v = im.on; v.tool = null; v.impl = null; v.lowered = false; im.on = null; refreshParts(v); }
  if (im.trailed) {
    im.tipping = false;
    im.h = 0; im.x = im.park[0]; im.z = im.park[1] - im.drawbar;
    scene.add(im.group);
    placeTrailed(im);
    return;
  }
  im.x = im.park[0]; im.z = im.park[1]; im.h = 0;
  standFree(im);
}

/** Puts a free implement (not a trailer) on the ground at its x, z, h: the hitch point and heading. */
export function standFree(im) {
  scene.add(im.group);
  const f = im.foot;
  sitOnGround(im.group, im.x, im.z, im.h, f.z1 - f.z0, f.x1 - f.x0, (f.z0 + f.z1) / 2);
  im.lift.position.y = im.up;
}

/** Puts trailed implement t on the ground: its axle at x, z, heading h. */
function placeTrailed(t) {
  const s = Math.sin(t.h), c = Math.cos(t.h);
  sitOnGround(t.group, t.x + s * t.originZ, t.z + c * t.originZ, t.h, t.sitLen, t.sitWid, t.sitOff - t.originZ);
}

/** Hitch eye of free implement t (where a tractor's hitch has to be) and its heading. */
export function eyeOf(t) {
  if (!t.trailed) return { x: t.x, z: t.z, h: t.h };
  return { x: t.x + Math.sin(t.h) * t.drawbar, z: t.z + Math.cos(t.h) * t.drawbar, h: t.h };
}
/** How near (m) the hitch has to be to the implement's eye, and how straight (rad) the tractor has to stand. */
const HITCH_REACH = 1.6, HITCH_ANGLE = { tool: 0.6, trailer: 1.0 };
/** The free implement tractor v can hitch where it stands (reversed up to it), or null. */
export function toolInReach(v) {
  if (v.type !== 'tractor' || v.tool) return null;
  const [hx, hz] = hitchPos(v);
  let best = null, bd = HITCH_REACH;
  for (const t of tools) {
    if (t.on) continue;
    const e = eyeOf(t), d = Math.hypot(e.x - hx, e.z - hz);
    if (d < bd && Math.abs(angDiff(v.h, e.h)) < HITCH_ANGLE[t.trailed ? 'trailer' : 'tool']) { best = t; bd = d; }
  }
  return best;
}
/** The nearest free implement behind tractor v that it is not yet close or straight enough to hitch (for a hint), or null. */
export function toolNearby(v, r = 6) {
  if (v.type !== 'tractor' || v.tool) return null;
  const [hx, hz] = hitchPos(v);
  let best = null, bd = r;
  for (const t of tools) {
    if (t.on) continue;
    const e = eyeOf(t), d = Math.hypot(e.x - hx, e.z - hz);
    if (d < bd) { best = t; bd = d; }
  }
  return best;
}
/** Unhitches v's implement and leaves it standing right where it is. Returns it. */
export function dropTool(v) {
  const im = v.tool;
  if (!im) return null;
  v.tool = null; v.impl = null; v.lowered = false; im.on = null;
  refreshParts(v);
  if (im.trailed) { im.tipping = false; return im; }
  const [hx, hz] = hitchPos(v);
  im.x = hx; im.z = hz; im.h = v.h;
  standFree(im);
  return im;
}

/** Words for messages: "jede s traktorem". */
const NOUN = { tractor: 'traktorem', combine: 'kombajnem', beet: 'sklízečem', forest: 'harvestorem', jeep: 'autem', chopper: 'řezačkou' };

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
  } else if (type === 'chopper') {
    // the forage harvester: a small buffer only, it blows the chaff into a trailer beside it (work.js)
    Object.assign(v, {
      gen: 'řezačky', harvester: true, r: 3.0, wb: 4.1, vmax: 8.3, vwork: 3.2, acc: 1.9, brk: 5, vrev: 2.5,
      toolW: 4.5, toolZ: 3.9, header: 'chop', mapCol: '#9ab83a', home: CHOPPER_HOME, fuelCap: 700, fuelDrive: 0.09, fuelWork: 0.2,
    }, buildChopper(look));
    const s = v.scale;
    Object.assign(v, { r: 3.0 * s, wb: 4.1 * s, toolW: m.header, toolZ: 3.9 * s, fuelCap: m.fuel, pipeRate: m.unload, vwork: 3.2 * (m.work || 1) });
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
  // collision body: the model's footprint without the pipe and the crane (they reach over things)
  v.bodyPart = partOf(footprint(v.group, v.group, [v.headerLift, v.pipe, v.crane].filter(Boolean)));
  v.inertia = ((2 * v.bodyPart.hx) ** 2 + (2 * v.bodyPart.hz) ** 2) / 12;
  v.pivotZ = pivotOf(v);
  v.seat = seatOf(v);
  v.mirrors = mirrorsOf(v);
  // mud (game/dirt.js): the machine and its headers get their own material copies
  v.dirtU = { value: 0 };
  for (const g of [v.group, v.grainHdr, v.cornHdr]) if (g) dirtMaterials(g, v.dirtU);
  v.yaw = 0; v.lat = 0; v.axS = 0; v.ayS = 0; v.hit = 0;
  refreshParts(v);
  return v;
}

/** Where the driver sits, in the machine's own frame (top of the seat cushion), or null. */
function seatOf(v) {
  let mark = null;
  v.group.traverse(o => { if (o.userData.seat) mark = o; });
  if (!mark) return null;
  v.group.updateMatrixWorld(true);
  const p = new THREE.Vector3().setFromMatrixPosition(mark.matrixWorld).applyMatrix4(new THREE.Matrix4().copy(v.group.matrixWorld).invert());
  return { x: p.x, y: p.y, z: p.z, wheel: mark.userData.seat };
}
/** Rear-view mirrors in the machine's own frame: [{ sx (+1 left, -1 right), x, y, z }]. */
function mirrorsOf(v) {
  const out = [], inv = new THREE.Matrix4(), p = new THREE.Vector3();
  v.group.updateMatrixWorld(true); inv.copy(v.group.matrixWorld).invert();
  v.group.traverse(o => { if (o.userData.mirror) { p.setFromMatrixPosition(o.matrixWorld).applyMatrix4(inv); out.push({ sx: o.userData.mirror, x: p.x, y: p.y, z: p.z }); } });
  return out;
}
/** Local z of the axle that does not steer: the machine turns about it (rear axle of a car, front axle of a combine). */
function pivotOf(v) {
  const steer = new Set([...v.front, ...v.rear]), inv = new THREE.Matrix4(), p = new THREE.Vector3(), zs = [];
  v.group.updateMatrixWorld(true); inv.copy(v.group.matrixWorld).invert();
  for (const w of v.wheels) {
    let steers = false;
    for (let o = w; o && o !== v.group; o = o.parent) if (steer.has(o)) steers = true;
    if (!steers) zs.push(p.setFromMatrixPosition(w.matrixWorld).applyMatrix4(inv).z);
  }
  return zs.length ? zs.reduce((a, b) => a + b, 0) / zs.length : 0;
}
/** The rectangles machine v collides with: its body, the header, a hitched implement. */
function refreshParts(v) {
  v.parts = [v.bodyPart];
  if (v.headerLift) {
    const fp = footprint(v.headerLift, v.group);
    if (Number.isFinite(fp.x0)) v.parts.push(partOf(fp));
  }
  if (v.tool?.foot) v.parts.push(partOf(v.tool.foot, v.hitchZ));
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
  refreshParts(v);
}

/* ---------- tractor attachments ---------- */
/** Hitches implement im to tractor v (taking it off another tractor if needed); v's old tool goes back to its spot. */
export function attachTool(v, im) {
  if (v.tool && v.tool !== im) parkTool(v.tool);
  if (im.on && im.on !== v) parkTool(im);
  im.on = v; v.tool = im; v.impl = im.key;
  v.lowered = false;
  v.vwork = im.speed * powerShare(v, im);
  if (im.trailed) {
    scene.add(im.group);
    // a trailer the tractor reversed up to keeps its angle, any other one goes straight behind the tractor
    const [hx, hz] = hitchPos(v), e = eyeOf(im);
    if (Math.hypot(e.x - hx, e.z - hz) > HITCH_REACH + 0.5) {
      im.h = v.h;
      im.x = hx - Math.sin(im.h) * im.drawbar;
      im.z = hz - Math.cos(im.h) * im.drawbar;
    }
    refreshParts(v);
    return;
  }
  v.group.add(im.group);
  im.group.position.set(0, 0, v.hitchZ);
  im.group.rotation.set(0, 0, 0);
  refreshParts(v);
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
  if (t?.key === 'trailer') return Math.max((t.tank.amount + (t.forage?.l || 0)) / t.tank.cap, t.bales / t.baleCap);
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
const MAX_ARTICULATION = 1.1; // rad, the drawbar stops a full jackknife before the body hits the tractor

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
  probe.x = x; probe.z = z; probe.r = r;
  for (const o of vehicles) if (!skip.includes(o)) for (const q of o.parts) { const k = partCircle(worldPart(o, q, wpBuf), probe, ctBuf); if (k) p += k.d; }
  for (const t of tools) if (t.trailed && !skip.includes(t)) { circBuf.length = 0; for (const c of trailerCircles(t, circBuf)) circ(c); }
  for (const t of tools) if (!t.on && t.part) { const k = partCircle(worldPart(t, t.part, wpBuf), probe, ctBuf); if (k) p += k.d; }
  for (const c of movers) circ(c);
  return p;
}
const circBuf = [], probe = { x: 0, z: 0, r: 0 }, wpBuf = {}, ctBuf = {};
/** True if a circle would sit noticeably inside a fixed obstacle or another vehicle. */
export const blockedAt = (x, z, r, self) => penetration(x, z, r, self.tool?.trailed ? [self, self.tool] : [self]) > 0.3;
const trailerBuf = [];
const trailerPen = t => { trailerBuf.length = 0; return trailerCircles(t, trailerBuf).reduce((a, c) => a + penetration(c.x, c.z, c.r, [t.on, t]), 0); };

/** Centre of trailer t's body in world space (for zone checks). */
export const trailerCenter = t => ({ x: t.x + Math.sin(t.h) * t.centerZ, z: t.z + Math.cos(t.h) * t.centerZ });

/** Every trailed implement: an attached one is dragged behind its tractor's hitch (also in reverse); all sit on the ground, trailers show their load. */
export function updateTrailers(dt) {
  for (const t of tools) if (t.trailed) updateTrailer(t, dt);
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
      v.x = v.prev.x; v.z = v.prev.z; v.h = v.prev.h;
      v.hit = Math.max(v.hit || 0, Math.abs(v.speed));
      v.speed *= -0.1; v.yaw = 0; v.lat = 0;
      ds = 0;
    }
    for (const w of t.wheels) w.userData.spin.rotation.x += ds / w.userData.r;
    trailerBuf.length = 0;
    for (const c of trailerCircles(t, trailerBuf)) pushBales(c.x, c.z, c.r);
  }
  placeTrailed(t);
  if (t.key === 'manure' && t.load !== undefined) { const f = t.load / t.loadCap; t.loadMesh.visible = f > 0.01; t.loadMesh.scale.y = Math.max(0.02, f * 0.95); }
  if (t.key !== 'trailer') return;
  t.palletMeshes.forEach((m, i) => { m.visible = i < t.pallets.length; if (m.visible) m.material = PALLET_MAT[t.pallets[i]]; });
  t.tip.rotation.x += ((t.tipping ? -0.6 : 0) - t.tip.rotation.x) * Math.min(1, dt * 1.5);
  const fl = t.forage?.l || 0, fill = (t.tank.amount + fl) / t.tank.cap;
  t.grain.visible = fill > 0;
  t.grain.scale.y = Math.max(0.02, fill * t.grainH);
  if (fl > 0) t.grainMat.color.copy(t.forage.kind === 'silage' ? SILAGE_HEAP : CHAFF_HEAP);
  else if (t.tank.crop >= 0) t.grainMat.color.copy(CROPS[t.tank.crop].heapCol);
  t.baleMeshes.forEach((m, i) => (m.visible = i < t.bales));
}

const CHAFF_HEAP = col('#7d9a3c'), SILAGE_HEAP = col('#8f8a3e');

/* ---------- level of detail ---------- */
/**
 * Seen from further than the preset's machineLod distance (from the camera), a machine or implement is drawn with a
 * simplified model of its kind (built once with LOD.low, everything merged into one geometry), and
 * all far pieces of one kind share one instanced mesh: a big fleet costs one draw call per kind.
 * The machine you drive and its implement always keep the detailed model. Loads (grain, bales, logs)
 * keep showing at any distance.
 */
const VEHICLE_BUILD = { tractor: buildTractor, combine: buildCombine, beet: buildBeetHarvester, forest: buildForester, jeep: buildJeep, suv: buildSUV, pickup: buildPickup, chopper: buildChopper };
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
      g.setAttribute('surf', new THREE.Float32BufferAttribute(new Float32Array(n * 3).map((_, i) => (i % 3 === 0 ? rough : i % 3 === 1 ? metal : 0)), 3));
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

const posOf = p => (p.type || p.trailed ? p : p.on || p.group.position);
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

/* ---------- collisions ---------- */
const _wp = [], _op = {}, _ct = {}, _bp = {};
/** Every contact of v's rectangles in their current place: buildings, posts, trees, machines, trailers, traffic. */
function contactsOf(v, keep) {
  v.parts.forEach((p, i) => {
    const wp = worldPart(v, p, (_wp[i] ||= {}));
    const circle = c => { const k = partCircle(wp, c, _ct); if (k) keep(k); };
    nearShapes(wp.x, wp.z, wp.R + 1, circle, b => { if (!b.off) { const k = partPart(wp, boxPart(b, _bp), _ct); if (k) keep(k); } });
    treeBuf.length = 0;
    for (const c of forestColliders(treeBuf, wp.x, wp.z, wp.R + 2)) circle(c);
    for (const o of vehicles) {
      if (o === v || Math.abs(o.x - wp.x) > 30 || Math.abs(o.z - wp.z) > 30) continue;
      for (const q of o.parts) { const k = partPart(wp, worldPart(o, q, _op), _ct); if (k) keep(k); }
    }
    for (const c of movers) circle(c);
    // parked trailers and the trailers of other machines (not the one v tows)
    for (const t of tools) if (t.trailed && t !== v.tool) { circBuf.length = 0; for (const c of trailerCircles(t, circBuf)) circle(c); }
    // implements standing on their own
    for (const t of tools) {
      if (t.on || !t.part || Math.abs(t.x - wp.x) > 20 || Math.abs(t.z - wp.z) > 20) continue;
      const k = partPart(wp, worldPart(t, t.part, _op), _ct); if (k) keep(k);
    }
  });
}
/** Pushes v out of what it ran into (see body.js resolve) and keeps it on the map; remembers how hard it hit. */
function collide(v) {
  const hit = resolve(v, contactsOf);
  if (hit > 1.5) v.knock = 0.5;
  v.hit = Math.max(v.hit || 0, hit);
  const x = clamp(v.x, BOUNDS.x0, BOUNDS.x1), z = clamp(v.z, BOUNDS.z0, BOUNDS.z1);
  if (x !== v.x || z !== v.z) { v.hit = Math.max(v.hit, Math.abs(v.speed)); v.speed = 0; v.lat = 0; v.yaw = 0; }
  v.x = x; v.z = z;
  // bales roll aside: circles along each rectangle
  v.parts.forEach((p, i) => {
    const wp = worldPart(v, p, (_wp[i] ||= {})), r = Math.min(wp.hx, wp.hz), along = wp.hx > wp.hz;
    const n = Math.max(1, Math.ceil(Math.max(wp.hx, wp.hz) / r));
    for (let k = 0; k < n; k++) {
      const t = n === 1 ? 0 : (k / (n - 1) - 0.5) * 2 * (Math.max(wp.hx, wp.hz) - r);
      pushBales(wp.x + (along ? wp.axx : wp.azx) * t, wp.z + (along ? wp.axz : wp.azz) * t, r);
    }
  });
}

const treeBuf = [];

/* ---------- driving ---------- */
/**
 * Steering and grip of each kind of machine. grip = how hard the tyres push sideways (share of g on a
 * dry road), lock = full steering angle, rate/back = how fast the wheel turns and comes back (rad/s),
 * tau = how fast the machine follows the wheel (s), slide = the car's tail can step out, roll/pitch =
 * how the body leans (rad per g).
 */
const PHYS = {
  tractor: { grip: 0.7, lock: 0.55, rate: 1.1, back: 1.6, tau: 0.15, roll: 0.03, pitch: 0.02 },
  combine: { grip: 0.5, lock: 0.6, rate: 0.8, back: 1.2, tau: 0.25, roll: 0.02, pitch: 0.015 },
  beet: { grip: 0.5, lock: 0.6, rate: 0.8, back: 1.2, tau: 0.25, roll: 0.02, pitch: 0.015 },
  chopper: { grip: 0.52, lock: 0.62, rate: 0.85, back: 1.25, tau: 0.22, roll: 0.02, pitch: 0.015 },
  forest: { grip: 0.58, lock: 0.65, rate: 0.9, back: 1.3, tau: 0.2, roll: 0.025, pitch: 0.02 },
  jeep: { grip: 1.4, lock: 0.6, rate: 1.7, back: 2.6, tau: 0.08, roll: 0.06, pitch: 0.035, slide: true },
};
const GRAV = 9.81;
/** The ground under the wheels: wet after rain, snow in winter (set by the main loop). */
export const surface = { wet: false, snow: false };

/**
 * One step of driving machine v. input = { thr: -1..1, st: -1..1 } (st > 0 turns left), null = nobody
 * at the wheel. The machine turns about its fixed axle (pivotZ); the turn is limited by the grip of
 * the tyres: asked for more, a machine pushes on wide and loses speed, a car also slides and its
 * tail steps out. Then it is pushed out of whatever it ran into.
 */
export function drive(v, dt, input) {
  v.prev = { x: v.x, z: v.z, h: v.h };
  let thr = input ? input.thr : 0;
  const st = input ? input.st : 0, P = PHYS[v.type], u0 = v.speed;
  if (v.fuel <= 0) thr = 0; // engine stalls without diesel
  const cf = condFactor(v.cond), toolCf = v.tool ? condFactor(v.tool.cond) : 1;
  let vmax = (v.lowered ? v.vwork * toolCf : v.vmax * towShare(v)) * cf;
  // cars built for the road are slower in the fields and the forest
  if (v.offroad < 1 && (v.offT = (v.offT || 0) - dt) <= 0) { v.offT = 0.25; v.offRoad = !roadAt(v.x, v.z, 1.5) && !inRect(v.x, v.z, PAD, 4); }
  if (v.offroad < 1 && v.offRoad) vmax *= v.offroad;

  // steering wheel: turns at a steady rate and comes back faster; at speed full lock is cut to
  // what the tyres hold on a dry road, so that steering with the keys stays drivable
  const lock = Math.min(P.lock, Math.atan((0.98 * P.grip * GRAV * v.wb) / Math.max(1, u0 * u0)));
  const rate = (st ? P.rate : P.back) * dt;
  v.steer += clamp(st * lock - v.steer, -rate, rate);

  if (thr > 0) v.speed += (v.speed < 0 ? v.brk : v.acc) * dt;
  else if (thr < 0) v.speed -= (v.speed > 0 ? v.brk : v.acc * 0.7) * dt;
  else v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 2.4 * dt);
  if (v.speed > vmax) v.speed = Math.max(vmax, v.speed - v.brk * dt);
  if (v.speed < -v.vrev) v.speed = -v.vrev;

  // grip: less off the road (cars), on wet ground and on snow; for a moment after a crash the
  // machine skids and turns on before the tyres catch it again
  const knock = v.knock > 0;
  if (knock) v.knock -= dt;
  const mu = P.grip * (v.type === 'jeep' && v.offRoad ? 0.7 : 1) * (surface.wet ? 0.8 : 1) * (surface.snow ? 0.65 : 1) * (knock ? 0.5 : 1);
  const amax = mu * GRAV, u = v.speed, want = (u / v.wb) * Math.tan(v.steer), lim = amax / Math.max(Math.abs(u), 0.5);
  const over = Math.abs(want) - lim;
  const turn = over > 0 ? Math.sign(want) * lim * (P.slide ? 1.15 : 1) : want;
  if (over > 0) v.speed -= Math.sign(u) * Math.min(Math.abs(u), over * Math.abs(u) * 0.5 * dt); // scrubbing tyres
  v.yaw += (turn - v.yaw) * (1 - Math.exp(-dt / (P.tau * (knock ? 6 : 1))));
  if (P.slide || knock) {
    // side slip at the fixed axle: the tyres pull it back as far as their grip goes
    const side = clamp(u * v.yaw - v.lat / 0.08, -amax, amax);
    v.lat = clamp(v.lat + (side - u * v.yaw) * dt, -Math.abs(u) - 3, Math.abs(u) + 3);
    v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), Math.abs(v.lat) * 0.4 * dt);
  } else v.lat = 0;

  const s = Math.sin(v.h), c = Math.cos(v.h), side = v.lat - v.yaw * v.pivotZ;
  v.x += (s * v.speed + c * side) * dt;
  v.z += (c * v.speed - s * side) * dt;
  v.h += v.yaw * dt;
  // for the body's lean
  const k = Math.min(1, dt * 5);
  v.axS += ((v.speed - u0) / Math.max(dt, 1e-3) - v.axS) * k;
  v.ayS += (v.speed * v.yaw - v.ayS) * k;
  if (v.speed || v.yaw || v.lat || input) collide(v);
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
  // the body leans out of a turn and dips its nose when braking (only on the model)
  if (!v.helper) {
    const P = PHYS[v.type];
    v.group.rotation.z += P.roll * clamp(v.ayS / GRAV, -1, 1);
    v.group.rotation.x -= P.pitch * clamp(v.axS / GRAV, -1, 1);
  }
  for (const w of v.wheels) w.userData.spin.rotation.x += (v.speed * dt) / w.userData.r;
  for (const p of v.front) p.rotation.y = v.steer;
  for (const p of v.rear) p.rotation.y = -v.steer;
  const k = Math.min(1, dt * 4);
  if (v.type === 'tractor') {
    const im = v.tool;
    if (im?.lift) {
      im.lift.position.y += ((v.lowered ? im.down : im.up) - im.lift.position.y) * k;
      if (im.roller && v.lowered) im.roller.rotation.x += (v.speed * dt) / 0.3;
      if (im.wheels && v.lowered && !im.trailed) for (const w of im.wheels) w.userData.spin.rotation.x += (v.speed * dt) / w.userData.r;
      if (im.discs && v.lowered) im.discs.forEach((d, i) => (d.rotation.y += (i ? 1 : -1) * dt * 18));
      // booms and side sections unfold when lowered and fold for the road when raised
      if (im.wings) for (const w of im.wings) { const u = w.userData; w.rotation[u.axis] += ((v.lowered ? u.open : u.shut) - w.rotation[u.axis]) * k * 0.6; }
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
    if (v.lowered && v.header !== 'corn') v.reel.rotation.x += dt * (v.header === 'beet' || v.header === 'chop' ? 6 : 2.6);
    // the chopper's spout is out whenever it works or still has chaff in it
    const out = v.type === 'chopper' ? v.lowered || v.tank.amount > 0 : v.unloading;
    v.pipe.rotation.y += ((out ? -Math.PI / 2 : 0) - v.pipe.rotation.y) * Math.min(1, dt * 2.5);
    if (v.grain) {
      v.grain.visible = v.tank.amount > 0;
      v.grain.scale.y = Math.max(0.02, (v.tank.amount / v.tank.cap) * 0.7);
      if (tankCropColor) v.grainMat.color.copy(tankCropColor);
    }
  }
  v.puffT -= dt;
  if (((v === G.active && !G.onFoot) || v.helper) && v.puffT <= 0 && (v.thr > 0 || v.lowered)) {
    v.puffT = 0.12;
    v.group.updateMatrixWorld(true);
    _v.copy(v.exhaust); v.group.localToWorld(_v);
    emit(_v.x, _v.y, _v.z, SMOKE, 0.35, (Math.random() - 0.5) * 0.3, 1.4, (Math.random() - 0.5) * 0.3, 1.3);
  }
}
