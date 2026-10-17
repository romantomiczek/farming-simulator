import * as THREE from 'three';
import { scene } from '../render/core.js';
import { clamp, angDiff } from '../core/util.js';
import { G } from '../game/state.js';
import { nearShapes, BOUNDS, movers } from './layout.js';
import { groundH } from './terrain.js';
import { forestColliders } from './forest.js';
import { vehicles, tools, trailerCircles } from '../vehicles/vehicles.js';
import { worldPart, partCircle } from '../vehicles/body.js';

/**
 * The farmer on foot. Walks and runs (Shift) where the camera looks (W/S/A/D), turns toward where he
 * goes, climbs the terrain and bumps into buildings, fences, tree trunks, machines, trailers, traffic
 * and water. E gets into the machine within REACH metres of him (seat()), and out of the machine he
 * drives: he steps out beside the cab (exitAt()). G.onFoot tells which one the player is; G.active
 * stays the machine he drove last.
 */
export const REACH = 2.5;
const R = 0.35, WALK = 2.2, RUN = 6.5;

/* ---------- model: legs, arms and the body with the head are separate meshes, legs and arms swing ---------- */
const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
const _c = new THREE.Color();
function paint(geo, color, x = 0, y = 0, z = 0) {
  geo = geo.toNonIndexed().translate(x, y, z);
  _c.set(color);
  const n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
const box = (w, h, d, color, x, y, z) => paint(new THREE.BoxGeometry(w, h, d), color, x, y, z);
const cyl = (r0, r1, h, color, x, y, z, seg = 10) => paint(new THREE.CylinderGeometry(r0, r1, h, seg), color, x, y, z);
const merge = parts => { const g = mergeAll(parts); g.computeVertexNormals(); return g; };
function mergeAll(list) {
  const n = list.reduce((a, g) => a + g.attributes.position.count, 0), pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) { pos.set(g.attributes.position.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
const JEANS = '#3c5576', SHIRT = '#b5463a', CHECK = '#7d2c25', SKIN = '#e0b08f', BOOT = '#4a3a2c', CAP = '#3f6b45';

/** A farmer: shirt and check colours; legs bend at the knee, arms at the elbow. */
function buildFarmer(shirt, check) {
  const g = new THREE.Group();
  // body: hips, checked shirt, collar, head, nose, ears, cap with a brim
  const body = new THREE.Mesh(merge([
    box(0.36, 0.2, 0.22, JEANS, 0, 0.95, 0),
    box(0.42, 0.52, 0.25, shirt, 0, 1.3, 0),
    box(0.43, 0.06, 0.26, check, 0, 1.18, 0), box(0.43, 0.06, 0.26, check, 0, 1.38, 0), box(0.06, 0.53, 0.26, check, 0.1, 1.3, 0),
    box(0.2, 0.05, 0.2, shirt, 0, 1.58, 0),
    cyl(0.06, 0.07, 0.08, SKIN, 0, 1.6, 0, 8),
    box(0.22, 0.25, 0.23, SKIN, 0, 1.75, 0),
    box(0.05, 0.05, 0.05, SKIN, 0, 1.73, 0.13),
    box(0.03, 0.07, 0.05, SKIN, 0.12, 1.75, 0), box(0.03, 0.07, 0.05, SKIN, -0.12, 1.75, 0),
    box(0.24, 0.09, 0.25, CAP, 0, 1.9, 0), box(0.22, 0.02, 0.12, CAP, 0, 1.86, 0.17),
  ]), mat);
  g.add(body);
  // two-part limbs: thigh from the hip and shin from the knee, upper arm from the shoulder and forearm from the elbow
  const joint = (parent, parts, x, y) => { const p = new THREE.Group(); p.position.set(x, y, 0); p.add(new THREE.Mesh(merge(parts), mat)); parent.add(p); return p; };
  const legs = [-1, 1].map(s => {
    const hip = joint(g, [box(0.15, 0.44, 0.17, JEANS, 0, -0.21, 0)], s * 0.1, 0.92);
    const knee = joint(hip, [box(0.14, 0.38, 0.16, JEANS, 0, -0.19, 0), box(0.16, 0.1, 0.27, BOOT, 0, -0.42, 0.04)], 0, -0.42);
    return { hip, knee };
  });
  const arms = [-1, 1].map(s => {
    const sh = joint(g, [box(0.12, 0.3, 0.13, shirt, 0, -0.15, 0)], s * 0.27, 1.53);
    const el = joint(sh, [box(0.11, 0.26, 0.11, shirt, 0, -0.13, 0), box(0.1, 0.1, 0.1, SKIN, 0, -0.3, 0)], 0, -0.3);
    return { sh, el };
  });
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(g);
  return { group: g, legs, arms };
}

/** The player's farmer and the helper (blue shirt), who sits in the machine he drives. */
const model = buildFarmer(SHIRT, CHECK), helperModel = buildFarmer('#4f7fa8', '#2c4f6e');
export const person = { type: 'person', name: 'Pěšky', x: -35.4, z: -13.5, h: 1.36, y: 0, speed: 0, vmax: RUN, phase: 0, step: false, group: model.group };

/* ---------- moving ---------- */
const _wp = {}, _ct = {}, me = { x: 0, z: 0, r: R }, treeBuf = [], circBuf = [];
/** Pushes the farmer out of buildings, fences, trees, machines, trailers, traffic and water (river and ponds are circles). */
function pushOut() {
  me.x = person.x; me.z = person.z;
  const circle = c => {
    const dx = me.x - c.x, dz = me.z - c.z, d = Math.hypot(dx, dz), m = c.r + R;
    if (d < m && d > 1e-4) { me.x += (dx / d) * (m - d); me.z += (dz / d) * (m - d); }
  };
  const boxOut = b => {
    if (b.off) return;
    const cx = clamp(me.x, b.x0, b.x1), cz = clamp(me.z, b.z0, b.z1), dx = me.x - cx, dz = me.z - cz, d = Math.hypot(dx, dz);
    if (d >= R) return;
    if (d > 1e-4) { me.x += (dx / d) * (R - d); me.z += (dz / d) * (R - d); return; }
    const opts = [[b.x0 - R - me.x, 0], [b.x1 + R - me.x, 0], [0, b.z0 - R - me.z], [0, b.z1 + R - me.z]].sort((a, c) => Math.hypot(...a) - Math.hypot(...c));
    me.x += opts[0][0]; me.z += opts[0][1];
  };
  nearShapes(me.x, me.z, R + 1, circle, boxOut);
  treeBuf.length = 0;
  for (const c of forestColliders(treeBuf, me.x, me.z, R + 2)) circle(c);
  for (const v of vehicles) {
    if (Math.abs(v.x - me.x) > 25 || Math.abs(v.z - me.z) > 25) continue;
    for (const p of v.parts) {
      const k = partCircle(worldPart(v, p, _wp), me, _ct);
      if (k) { me.x -= k.nx * k.d; me.z -= k.nz * k.d; } // the contact pushes the machine: the farmer goes the other way
    }
  }
  for (const t of tools) if (t.key === 'trailer') { circBuf.length = 0; for (const c of trailerCircles(t, circBuf)) circle(c); }
  for (const c of movers) circle(c);
  person.x = clamp(me.x, BOUNDS.x0, BOUNDS.x1); person.z = clamp(me.z, BOUNDS.z0, BOUNDS.z1);
}

/**
 * One step on foot. input = { thr, st } from W/S/A/D, camYaw = where the camera looks, run = Shift.
 * The farmer goes where the keys point as seen from the camera and turns that way.
 */
export function walk(dt, input, camYaw, run) {
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
  let dx = 0, dz = 0;
  if (input) { dx = fx * input.thr - rx * input.st; dz = fz * input.thr - rz * input.st; }
  const len = Math.hypot(dx, dz), want = len > 0.01 ? (run ? RUN : WALK) : 0;
  person.speed += clamp(want - person.speed, -12 * dt, 8 * dt);
  if (len > 0.01) person.h += angDiff(person.h, Math.atan2(dx, dz)) * Math.min(1, dt * 12);
  person.x += Math.sin(person.h) * person.speed * dt;
  person.z += Math.cos(person.h) * person.speed * dt;
  pushOut();
}

/** Puts rig on parent (the scene or a machine); its meshes show unless the machine is drawn far. */
function moveTo(rig, parent, far = false) {
  if (rig.group.parent !== parent) parent.add(rig.group);
  rig.group.traverse(o => { if (o.isMesh) o.visible = !far; });
}
/** Sitting at the wheel: thighs forward, shins down, hands on the wheel. */
function sit(rig, v) {
  if (!v?.seat) { rig.group.visible = false; return; }
  if (rig.group.parent !== v.group) moveTo(rig, v.group, v.lodFar);
  rig.group.visible = true;
  rig.group.position.set(v.seat.x, v.seat.y - 0.84, v.seat.z + 0.02);
  rig.group.rotation.set(0, 0, 0);
  for (const l of rig.legs) { l.hip.rotation.x = -1.45; l.knee.rotation.x = 1.4; }
  for (const a of rig.arms) { a.sh.rotation.x = -0.65; a.el.rotation.x = -0.85; }
}

/**
 * Every frame: the farmer walks in the world, or sits in the machine he drives; the helper sits in
 * the machine he works with. Walking: legs and arms swing with the stride, knees bend, a little
 * bounce when running.
 */
export function showPerson(dt) {
  const hv = vehicles.find(v => v.helper);
  if (hv) sit(helperModel, hv); else helperModel.group.visible = false;
  const g = model.group;
  if (!G.onFoot) {
    if (G.active.helper) g.visible = false; // the helper took the seat
    else sit(model, G.active);
    return;
  }
  if (g.parent !== scene) moveTo(model, scene);
  g.visible = true;
  const before = Math.sin(person.phase);
  person.phase += dt * person.speed * 2.9;
  if (person.speed > 0.5 && Math.sign(Math.sin(person.phase)) !== Math.sign(before)) person.step = true; // a foot touches the ground
  const run = person.speed > WALK + 0.5, swing = Math.min(1, person.speed / WALK) * (run ? 0.85 : 0.5), s = Math.sin(person.phase);
  model.legs.forEach((l, i) => {
    const k = i ? -s : s;
    l.hip.rotation.x = k * swing;
    l.knee.rotation.x = Math.max(0, -k) * swing * (run ? 1.6 : 1.1); // the knee bends when the leg swings back
  });
  model.arms.forEach((a, i) => {
    a.sh.rotation.x = (i ? s : -s) * swing * 0.9;
    a.el.rotation.x = -(run ? 1.1 : 0.25) * Math.min(1, person.speed / WALK);
  });
  person.y = groundH(person.x, person.z);
  g.position.set(person.x, person.y + Math.abs(Math.cos(person.phase)) * 0.04 * swing, person.z);
  g.rotation.set(0, person.h, 0);
}

/** A new game: the farmer stands at the farmhouse door, facing the yard. */
export function startOnFoot() {
  Object.assign(person, { x: -35.4, z: -13.5, h: 1.36, speed: 0 });
  G.onFoot = true;
}

/* ---------- getting in and out ---------- */
/** The machine within reach of the farmer (the nearest, by the distance to its body), or null. */
export function machineInReach() {
  let best = null, bd = Infinity;
  const probe = { x: person.x, z: person.z, r: REACH };
  for (const v of vehicles) {
    if (Math.abs(v.x - person.x) > 20 || Math.abs(v.z - person.z) > 20) continue;
    const k = partCircle(worldPart(v, v.parts[0], _wp), probe, _ct);
    if (k && REACH - k.d < bd) { bd = REACH - k.d; best = v; }
  }
  return best;
}
/** Gets into machine v: it becomes the one you drive and the farmer sits in its cab. */
export function seat(v) {
  G.active = v;
  G.onFoot = false;
}
/** Where the farmer stands up when leaving v: beside the cab on the left, else on the right, behind, in front. */
export function exitAt(v) {
  const p = v.bodyPart, s = Math.sin(v.h), c = Math.cos(v.h), cz = p.cz + p.hz * 0.2;
  for (const [lx, lz] of [[p.cx + p.hx + 0.6, cz], [p.cx - p.hx - 0.6, cz], [p.cx, p.cz - p.hz - 0.8], [p.cx, p.cz + p.hz + 0.8]]) {
    const x = v.x + lx * c + lz * s, z = v.z - lx * s + lz * c;
    person.x = x; person.z = z; pushOut();
    if (Math.hypot(person.x - x, person.z - z) < 0.15) return true;
  }
  return false;
}
/** Steps out of the machine you drive (it must stand still). Returns a message when it cannot. */
export function leave() {
  const v = G.active;
  if (Math.abs(v.speed) > 1.5) return 'Nejdřív zastav.';
  if (!exitAt(v)) return 'Kolem stroje není místo, kam vystoupit.';
  person.h = v.h; person.speed = 0;
  v.thr = 0;
  G.onFoot = true;
  return null;
}
