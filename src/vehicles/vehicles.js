import * as THREE from 'three';
import { scene } from '../render/core.js';
import { clamp, lerp, col, angDiff } from '../core/util.js';
import { circles, boxes, BOUNDS } from '../world/layout.js';
import { emit, SMOKE } from '../fx/particles.js';
import { G } from '../game/state.js';
import { buildTractor, buildCombine, buildCultivator, buildSeeder, buildTrailer } from './models.js';

/**
 * Tractor attachments. Field tools ride rigidly on the hitch (workZ = working line behind it).
 * The trailer is articulated: it stays in the scene and follows the hitch, see updateTrailer().
 * ORDER is the swap order in the shed.
 */
export const IMPL = {
  cultivator: Object.assign(buildCultivator(), { key: 'cultivator', name: 'Kultivátor', width: 4.2, workZ: -1.7, park: [8.5, -38.5], dust: col('#b48d68') }),
  seeder: Object.assign(buildSeeder(), { key: 'seeder', name: 'Secí stroj', width: 4.0, workZ: -1.5, park: [15.5, -38.5], dust: col('#c7a984') }),
  trailer: Object.assign(buildTrailer(), {
    key: 'trailer', name: 'Přívěs', park: [23.5, -37], x: 0, z: 0, h: 0,
    tank: { crop: -1, amount: 0, cap: 14000 }, tipping: false, sold: 0, soldMoney: 0, soldCrop: 0,
  }),
};
export const IMPL_ORDER = ['cultivator', 'seeder', 'trailer'];
export const trailer = IMPL.trailer;
const HITCH_Z = -1.75;
/** Distance from the trailer axle to its drawbar eye. */
export const TRAILER_L = 4.2;

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
  };
  if (type === 'tractor') {
    Object.assign(v, { name: 'Traktor Brázda 140', r: 1.9, wb: 2.4, vmax: 11.1, vwork: 4.2, acc: 3.2, brk: 7, vrev: 3.6, impl: 'cultivator', mapCol: '#5f9c7c' }, buildTractor());
  } else {
    Object.assign(v, { name: 'Kombajn Klas 7', r: 3.0, wb: 3.6, vmax: 6.9, vwork: 2.8, acc: 1.8, brk: 5, vrev: 2.4, toolW: 5.4, toolZ: 4.4, mapCol: '#cf5a4a' }, buildCombine());
  }
  scene.add(v.group);
  return v;
}
export const tractor = makeVehicle('tractor');
export const combine = makeVehicle('combine');
export const vehicles = [tractor, combine];

export function attachImpl(key) {
  for (const k in IMPL) if (k !== key) parkImpl(IMPL[k]);
  const im = IMPL[key];
  tractor.impl = key;
  tractor.lowered = false;
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

const hitchPos = () => [tractor.x + Math.sin(tractor.h) * HITCH_Z, tractor.z + Math.cos(tractor.h) * HITCH_Z];
const MAX_ARTICULATION = 1.3; // rad, the drawbar stops a full jackknife

/** Centre of the trailer body in world space (for zone checks). */
export const trailerCenter = () => ({ x: trailer.x + Math.sin(trailer.h) * 0.8, z: trailer.z + Math.cos(trailer.h) * 0.8 });

/** Drags the trailer axle behind the hitch (follows the tractor, also in reverse). */
export function updateTrailer(dt, cropColor) {
  if (tractor.impl === 'trailer') {
    const [hx, hz] = hitchPos();
    const dx = hx - trailer.x, dz = hz - trailer.z;
    if (Math.hypot(dx, dz) > 1e-3) trailer.h = Math.atan2(dx, dz);
    const rel = angDiff(tractor.h, trailer.h);
    if (Math.abs(rel) > MAX_ARTICULATION) trailer.h = tractor.h + Math.sign(rel) * MAX_ARTICULATION;
    const nx = hx - Math.sin(trailer.h) * TRAILER_L, nz = hz - Math.cos(trailer.h) * TRAILER_L;
    const ds = (nx - trailer.x) * Math.sin(trailer.h) + (nz - trailer.z) * Math.cos(trailer.h);
    trailer.x = nx; trailer.z = nz;
    for (const w of trailer.wheels) w.userData.spin.rotation.x += ds / w.userData.r;
  }
  trailer.group.position.set(trailer.x, 0, trailer.z);
  trailer.group.rotation.y = trailer.h;
  trailer.tip.rotation.x += ((trailer.tipping ? -0.6 : 0) - trailer.tip.rotation.x) * Math.min(1, dt * 1.5);
  const fill = trailer.tank.amount / trailer.tank.cap;
  trailer.grain.visible = fill > 0;
  trailer.grain.scale.y = Math.max(0.02, fill * 1.15);
  if (cropColor) trailer.grainMat.color.copy(cropColor);
}

/** Working width and offset of the working line from the vehicle origin. */
export function toolLine(v) {
  return v.type === 'tractor'
    ? { W: IMPL[v.impl].width, Z: HITCH_Z + IMPL[v.impl].workZ }
    : { W: v.toolW, Z: v.toolZ };
}

function collide(v) {
  let hit = false;
  const push = (c) => {
    const dx = v.x - c.x, dz = v.z - c.z, d = Math.hypot(dx, dz), min = c.r + v.r;
    if (d < min && d > 1e-4) { v.x += (dx / d) * (min - d); v.z += (dz / d) * (min - d); hit = true; }
  };
  for (const c of circles) push(c);
  for (const o of vehicles) if (o !== v) push(o);
  for (const b of boxes) {
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
}

/** Bicycle-model driving. input = { thr: -1..1, st: -1..1 } (st > 0 turns left). */
export function drive(v, dt, input) {
  const thr = input ? input.thr : 0, st = input ? input.st : 0;
  const vmax = v.lowered ? v.vwork : v.vmax;
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
/** Moves meshes to match the simulation: wheels, steering, lifts, reel, pipe, grain heap, exhaust. */
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
      if (im.wheels && v.lowered) for (const w of im.wheels) w.userData.spin.rotation.x += (v.speed * dt) / w.userData.r;
    }
  } else {
    v.headerLift.position.y += ((v.lowered ? 0 : 0.6) - v.headerLift.position.y) * k;
    if (v.lowered) v.reel.rotation.x += dt * 2.6;
    v.pipe.rotation.y += ((v.unloading ? -Math.PI / 2 : 0) - v.pipe.rotation.y) * Math.min(1, dt * 2.5);
    v.grain.visible = v.tank.amount > 0;
    v.grain.scale.y = Math.max(0.02, (v.tank.amount / v.tank.cap) * 0.7);
    if (tankCropColor) v.grainMat.color.copy(tankCropColor);
  }
  v.puffT -= dt;
  if (v === G.active && v.puffT <= 0 && (v.thr > 0 || v.lowered)) {
    v.puffT = 0.12;
    v.group.updateMatrixWorld(true);
    _v.copy(v.exhaust); v.group.localToWorld(_v);
    emit(_v.x, _v.y, _v.z, SMOKE, 0.35, (Math.random() - 0.5) * 0.3, 1.4, (Math.random() - 0.5) * 0.3, 1.3);
  }
}
