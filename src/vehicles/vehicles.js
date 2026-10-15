import * as THREE from 'three';
import { scene } from '../render/core.js';
import { clamp, lerp, col, angDiff } from '../core/util.js';
import { circles, boxes, BOUNDS } from '../world/layout.js';
import { emit, SMOKE } from '../fx/particles.js';
import { G, condFactor } from '../game/state.js';
import { buildTractor, buildCombine, buildBeetHarvester, buildForester, buildCultivator, buildSeeder, buildTrailer, buildPlough, buildSpreader, buildBaler, buildWaterTank } from './models.js';
import { forestColliders } from '../world/forest.js';
import { pushBales } from '../world/bales.js';

/**
 * Tractor attachments. Field tools ride rigidly on the hitch: width = working width,
 * workZ = working line behind the hitch, speed = max working speed (m/s).
 * The trailer is articulated: it stays in the scene and follows the hitch, see updateTrailer().
 * IMPL_ORDER is the order in the shed (keys 1–7, F cycles).
 */
export const IMPL = {
  cultivator: Object.assign(buildCultivator(), { key: 'cultivator', name: 'Kultivátor', width: 4.2, workZ: -1.7, speed: 4.2, park: [8.5, -38.5], dust: col('#b48d68') }),
  plough: Object.assign(buildPlough(), { key: 'plough', name: 'Pluh', width: 3.2, workZ: -2.2, speed: 3.1, park: [-12, -47.5], dust: col('#9b7656') }),
  seeder: Object.assign(buildSeeder(), { key: 'seeder', name: 'Secí stroj', width: 4.0, workZ: -1.5, speed: 4.2, park: [15.5, -38.5], dust: col('#c7a984') }),
  spreader: Object.assign(buildSpreader(), { key: 'spreader', name: 'Rozmetadlo', width: 12, workZ: -1.8, speed: 5.0, park: [-6.5, -47.5], dust: col('#f1eee6') }),
  baler: Object.assign(buildBaler(), { key: 'baler', name: 'Lis na balíky', width: 2.0, workZ: -1.6, speed: 3.6, park: [-1, -47.5], dust: col('#eadba6') }),
  trailer: Object.assign(buildTrailer(), {
    key: 'trailer', name: 'Přívěs', park: [23.5, -37], x: 0, z: 0, h: 0, speed: 4.2,
    tank: { crop: -1, amount: 0, cap: 14000 }, bales: 0, baleCap: 8, tipping: false, sold: 0, soldMoney: 0, soldCrop: 0,
  }),
  watertank: Object.assign(buildWaterTank(), { key: 'watertank', name: 'Cisterna na vodu', width: 0, workZ: 0, speed: 4.2, park: [4.5, -48.5], water: 0, waterCap: 8000 }),
};
export const IMPL_ORDER = ['cultivator', 'plough', 'seeder', 'spreader', 'baler', 'trailer', 'watertank'];
export const trailer = IMPL.trailer;
const HITCH_Z = -1.75;
/** Distance from the trailer axle to its drawbar eye. */
export const TRAILER_L = 4.2;
/** Straw cells the baler needs for one bale. */
export const BALE_CELLS = 60;

export function parkImpl(im) {
  if (im === trailer) {
    trailer.tipping = false;
    trailer.h = 0; trailer.x = im.park[0]; trailer.z = im.park[1] - TRAILER_L;
    trailer.group.position.set(trailer.x, 0, trailer.z); trailer.group.rotation.y = 0;
    scene.add(trailer.group);
    return;
  }
  scene.add(im.group);
  im.group.position.set(im.park[0], 0, im.park[1]);
  im.group.rotation.y = 0;
  im.lift.position.y = im.up;
}
Object.values(IMPL).forEach(parkImpl);

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
      home: [0, 116], fuelCap: 300, fuelDrive: 0.07, fuelWork: 0.12, logs: 0, logCap: 18, cutting: null,
    }, buildForester());
  }
  v.x = v.home[0]; v.z = v.home[1]; v.fuel = v.fuelCap;
  scene.add(v.group);
  return v;
}
export const tractor = makeVehicle('tractor');
export const combine = makeVehicle('combine');
export const beeter = makeVehicle('beet');
export const forester = makeVehicle('forest');
export const vehicles = [tractor, combine, beeter, forester];
export const HARVESTERS = [combine, beeter];

/** Puts a vehicle back at its start position (new game, or missing in an old save). */
export function sendHome(v) {
  Object.assign(v, { x: v.home[0], z: v.home[1], h: 0, speed: 0, steer: 0, lowered: false, unloading: false, fuel: v.fuelCap });
  if (v.harvester) v.tank = { crop: -1, amount: 0, cap: v.tank.cap };
}

/* ---------- combine headers ---------- */
const HEADER_PARK = [-17, -27];
/** Mounts the grain or row header on the combine; the other one waits in the yard. */
export function setHeader(key) {
  const on = key === 'corn' ? combine.cornHdr : combine.grainHdr;
  const off = key === 'corn' ? combine.grainHdr : combine.cornHdr;
  combine.header = key === 'corn' ? 'corn' : 'grain';
  combine.lowered = false;
  combine.headerLift.add(on); on.position.set(0, 0, 0); on.rotation.set(0, 0, 0);
  scene.add(off); off.position.set(HEADER_PARK[0], 0, HEADER_PARK[1]); off.rotation.set(0, 0, 0);
}
setHeader('grain');

/* ---------- tractor attachments ---------- */
export function attachImpl(key) {
  for (const k in IMPL) if (k !== key) parkImpl(IMPL[k]);
  const im = IMPL[key];
  tractor.impl = key;
  tractor.lowered = false;
  tractor.vwork = im.speed * (G.upgrades?.tractor ? 1.1 : 1);
  if (im === trailer) {
    // put the trailer straight behind the tractor
    trailer.h = tractor.h;
    const [hx, hz] = hitchPos();
    trailer.x = hx - Math.sin(trailer.h) * TRAILER_L;
    trailer.z = hz - Math.cos(trailer.h) * TRAILER_L;
    return;
  }
  tractor.group.add(im.group);
  im.group.position.set(0, 0, HITCH_Z);
  im.group.rotation.y = 0;
}

/** Working width and offset of the working line from the vehicle origin. */
export function toolLine(v) {
  return v.type === 'tractor'
    ? { W: IMPL[v.impl].width, Z: HITCH_Z + IMPL[v.impl].workZ }
    : { W: v.toolW, Z: v.toolZ };
}

const hitchPos = () => [tractor.x + Math.sin(tractor.h) * HITCH_Z, tractor.z + Math.cos(tractor.h) * HITCH_Z];
const MAX_ARTICULATION = 1.3; // rad, the drawbar stops a full jackknife

/** The trailer's collision shape: two circles along the body (local z, radius). */
const TRAILER_SHAPE = [[-0.9, 1.45], [2.3, 1.45]];
export function trailerCircles(out = []) {
  if (!trailer.group.visible) return out;
  const s = Math.sin(trailer.h), c = Math.cos(trailer.h);
  for (const [lz, r] of TRAILER_SHAPE) out.push({ x: trailer.x + s * lz, z: trailer.z + c * lz, r });
  return out;
}

/** How deep a circle sinks into buildings, trees, fences and other vehicles (skip = vehicles to ignore). */
function penetration(x, z, r, skip) {
  let p = 0;
  const circ = c => { const d = Math.hypot(x - c.x, z - c.z), m = c.r + r; if (d < m) p += m - d; };
  for (const c of circles) circ(c);
  treeBuf.length = 0;
  for (const c of forestColliders(treeBuf)) circ(c);
  for (const o of vehicles) if (o.available && !skip.includes(o)) circ(o);
  if (!skip.includes(trailer)) for (const c of trailerCircles([])) circ(c);
  for (const b of boxes) {
    if (b.off) continue;
    const d = Math.hypot(x - clamp(x, b.x0, b.x1), z - clamp(z, b.z0, b.z1));
    if (d < r) p += r - d;
  }
  return p;
}
/** True if a circle would sit noticeably inside a fixed obstacle or another vehicle. */
export const blockedAt = (x, z, r, self) => penetration(x, z, r, self === tractor && tractor.impl === 'trailer' ? [self, trailer] : [self]) > 0.3;
const trailerBuf = [];
const trailerNow = () => { trailerBuf.length = 0; return trailerCircles(trailerBuf); };
const trailerPen = () => trailerNow().reduce((a, c) => a + penetration(c.x, c.z, c.r, [tractor, trailer]), 0);

/** Centre of the trailer body in world space (for zone checks). */
export const trailerCenter = () => ({ x: trailer.x + Math.sin(trailer.h) * 0.8, z: trailer.z + Math.cos(trailer.h) * 0.8 });

/** Drags the trailer axle behind the hitch (follows the tractor, also in reverse). */
export function updateTrailer(dt, cropColor) {
  if (tractor.impl === 'trailer') {
    const before = trailerPen(), old = { x: trailer.x, z: trailer.z, h: trailer.h };
    const [hx, hz] = hitchPos();
    const dx = hx - trailer.x, dz = hz - trailer.z;
    if (Math.hypot(dx, dz) > 1e-3) trailer.h = Math.atan2(dx, dz);
    const rel = angDiff(tractor.h, trailer.h);
    if (Math.abs(rel) > MAX_ARTICULATION) trailer.h = tractor.h + Math.sign(rel) * MAX_ARTICULATION;
    const nx = hx - Math.sin(trailer.h) * TRAILER_L, nz = hz - Math.cos(trailer.h) * TRAILER_L;
    let ds = (nx - trailer.x) * Math.sin(trailer.h) + (nz - trailer.z) * Math.cos(trailer.h);
    trailer.x = nx; trailer.z = nz;
    // the trailer would run into something: undo this frame's move of tractor and trailer
    if (tractor.prev && trailerPen() > before + 1e-4) {
      Object.assign(trailer, old);
      tractor.x = tractor.prev.x; tractor.z = tractor.prev.z; tractor.h = tractor.prev.h; tractor.speed = 0;
      ds = 0;
    }
    for (const w of trailer.wheels) w.userData.spin.rotation.x += ds / w.userData.r;
    for (const c of trailerNow()) pushBales(c.x, c.z, c.r);
  }
  trailer.group.position.set(trailer.x, 0, trailer.z);
  trailer.group.rotation.y = trailer.h;
  trailer.tip.rotation.x += ((trailer.tipping ? -0.6 : 0) - trailer.tip.rotation.x) * Math.min(1, dt * 1.5);
  const fill = trailer.tank.amount / trailer.tank.cap;
  trailer.grain.visible = fill > 0;
  trailer.grain.scale.y = Math.max(0.02, fill * 1.15);
  if (cropColor) trailer.grainMat.color.copy(cropColor);
  trailer.baleMeshes.forEach((m, i) => (m.visible = i < trailer.bales));
}

/* ---------- driving ---------- */
function collide(v) {
  let hit = false;
  const push = c => {
    const dx = v.x - c.x, dz = v.z - c.z, d = Math.hypot(dx, dz), min = c.r + v.r;
    if (d < min && d > 1e-4) { v.x += (dx / d) * (min - d); v.z += (dz / d) * (min - d); hit = true; }
  };
  for (const c of circles) push(c);
  treeBuf.length = 0;
  for (const c of forestColliders(treeBuf)) push(c);
  for (const o of vehicles) if (o !== v && o.available) push(o);
  // a parked trailer, or the trailer of another vehicle, is an obstacle too (not for the tractor towing it)
  if (!(v === tractor && tractor.impl === 'trailer')) for (const c of trailerNow()) push(c);
  for (const b of boxes) {
    if (b.off) continue;
    const cx = clamp(v.x, b.x0, b.x1), cz = clamp(v.z, b.z0, b.z1), dx = v.x - cx, dz = v.z - cz, d = Math.hypot(dx, dz);
    if (d >= v.r) continue;
    if (d > 1e-4) { v.x += (dx / d) * (v.r - d); v.z += (dz / d) * (v.r - d); }
    else {
      const opts = [[b.x0 - v.r - v.x, 0], [b.x1 + v.r - v.x, 0], [0, b.z0 - v.r - v.z], [0, b.z1 + v.r - v.z]];
      opts.sort((a, c) => Math.hypot(...a) - Math.hypot(...c));
      v.x += opts[0][0]; v.z += opts[0][1];
    }
    hit = true;
  }
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
  const cf = condFactor(G.cond[v.type] ?? 1), toolCf = v.type === 'tractor' ? condFactor(G.cond[v.impl] ?? 1) : 1;
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

const _v = new THREE.Vector3();
/** Moves meshes to match the simulation: wheels, steering, lifts, reel, discs, pipe, grain heap, exhaust. */
export function visual(v, dt, tankCropColor) {
  v.group.position.set(v.x, 0, v.z);
  v.group.rotation.y = v.h;
  for (const w of v.wheels) w.userData.spin.rotation.x += (v.speed * dt) / w.userData.r;
  for (const p of v.front) p.rotation.y = v.steer;
  for (const p of v.rear) p.rotation.y = -v.steer;
  const k = Math.min(1, dt * 4);
  if (v.type === 'tractor') {
    const im = IMPL[v.impl];
    if (im.lift) {
      im.lift.position.y += ((v.lowered ? im.down : im.up) - im.lift.position.y) * k;
      if (im.roller && v.lowered) im.roller.rotation.x += (v.speed * dt) / 0.3;
      if (im.wheels && (v.lowered || im === IMPL.baler || im === IMPL.watertank)) for (const w of im.wheels) w.userData.spin.rotation.x += (v.speed * dt) / w.userData.r;
      if (im.discs && v.lowered) im.discs.forEach((d, i) => (d.rotation.y += (i ? 1 : -1) * dt * 18));
    }
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

/** Applies bought upgrades to the machines (called whenever ownership changes). */
export function applyUpgrades(up) {
  G.upgrades = up;
  tractor.vmax = up.tractor ? 13.9 : 11.1;
  tractor.vwork = IMPL[tractor.impl].speed * (up.tractor ? 1.1 : 1);
  IMPL.cultivator.width = up.cultivator ? 6.3 : 4.2;
  IMPL.cultivator.group.scale.x = up.cultivator ? 1.5 : 1;
  combine.tank.cap = up.combine ? 13000 : 9000;
  trailer.tank.cap = up.trailer ? 22000 : 14000;
  trailer.tip.scale.y = up.trailer ? 1.35 : 1;
}
