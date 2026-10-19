import * as THREE from 'three';
import { scene } from '../render/core.js';
import { rng } from '../core/util.js';
import { groundH } from './terrain.js';
import { movers, nearShapes, DAIRY } from './layout.js';
import { MARKETS } from '../game/markets.js';
import { box, cyl, merge, JEANS, SKIN, BOOT } from './person.js';

/**
 * People in the village and the town: walkers on the pavements (they wait while a machine passes in
 * front of them), little groups chatting by the church and on the town square, and a buyer at every
 * intake who waves while you sell there. All of them share the farmer's body parts, drawn as
 * instanced meshes (a few draw calls for everybody); only people within sight are drawn, and the
 * walkers and talkers go home for the night. Each stands in the way of machines like a post
 * (movers), so a machine stops instead of driving through them.
 */
const R = rng(2024);

/* ---------- looks: shirt colours and what they wear on the head ---------- */
const LOOKS = [
  { shirt: '#4f7fa8', check: '#2c4f6e', head: 'cap', cap: '#c9b46a' },
  { shirt: '#6d8f4e', check: '#4a6633', head: 'hat', cap: '#6b5440' },
  { shirt: '#d9c27a', check: '#b49a52', head: 'hair', cap: '#5a3a26' },
  { shirt: '#9a6a9e', check: '#6e4672', head: 'hair', cap: '#2e241c' },
  { shirt: '#e8e2d6', check: '#c9c0ae', head: 'cap', cap: '#3a4d6b' },
];
function bodyGeo(L) {
  const head = L.head === 'cap'
    ? [box(0.24, 0.09, 0.25, L.cap, 0, 1.9, 0), box(0.22, 0.02, 0.12, L.cap, 0, 1.86, 0.17)]
    : L.head === 'hat'
      ? [cyl(0.24, 0.24, 0.03, L.cap, 0, 1.88, 0, 12), cyl(0.12, 0.14, 0.12, L.cap, 0, 1.95, 0, 10)]
      : [box(0.25, 0.12, 0.26, L.cap, 0, 1.88, -0.01), box(0.24, 0.26, 0.06, L.cap, 0, 1.72, -0.12)]; // hair, longer at the back
  return merge([
    box(0.36, 0.2, 0.22, JEANS, 0, 0.95, 0),
    box(0.42, 0.52, 0.25, L.shirt, 0, 1.3, 0),
    box(0.43, 0.06, 0.26, L.check, 0, 1.2, 0),
    box(0.2, 0.05, 0.2, L.shirt, 0, 1.58, 0),
    cyl(0.06, 0.07, 0.08, SKIN, 0, 1.6, 0, 8),
    box(0.22, 0.25, 0.23, SKIN, 0, 1.75, 0),
    box(0.05, 0.05, 0.05, SKIN, 0, 1.73, 0.13),
    ...head,
  ]);
}
const WHITE = '#ffffff';
const GEO = {
  thigh: merge([box(0.15, 0.44, 0.17, JEANS, 0, -0.21, 0)]),
  shin: merge([box(0.14, 0.38, 0.16, JEANS, 0, -0.19, 0), box(0.16, 0.1, 0.27, BOOT, 0, -0.42, 0.04)]),
  upper: merge([box(0.12, 0.3, 0.13, WHITE, 0, -0.15, 0)]), // tinted with the shirt colour
  fore: merge([box(0.11, 0.26, 0.11, WHITE, 0, -0.13, 0)]),
  hand: merge([box(0.1, 0.1, 0.1, SKIN, 0, 0, 0)]),
};
const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });

/* ---------- who is where (after the world is built: the buyers look for a free spot) ---------- */
const people = [];
let bodies = [], limbs = {};
const tint = new THREE.Color();

export function buildVillagers() {
  const add = (o, look = (R() * LOOKS.length) | 0) => people.push({ look, phase: R() * 10, wave: 0, h: 0, x: 0, z: 0, ...o, trousers: 0.75 + R() * 0.4 });
  // walkers on the village pavements (houses at x 155 and 181, the street at 168) and in the town
  for (const [x, z0, z1] of [[162, 58, 130], [174, 60, 128], [162, 70, 120], [174, 64, 132], [162, 90, 128]]) add({ kind: 'walk', path: [[x, z0], [x, z1]], t: R(), dir: R() < 0.5 ? 1 : -1, speed: 1.1 + R() * 0.4 });
  for (const [x0, z, x1] of [[415, 41.5, 560], [450, 54.5, 630], [520, 41.5, 640], [430, 54.5, 520]]) add({ kind: 'walk', path: [[x0, z], [x1, z]], t: R(), dir: R() < 0.5 ? 1 : -1, speed: 1.1 + R() * 0.4 });
  for (const [x, z0, z1] of [[474, 60, 150], [606, 60, 136]]) add({ kind: 'walk', path: [[x, z0], [x, z1]], t: R(), dir: 1, speed: 1.2 });
  // groups chatting: by the church and on the town square
  for (const [cx, cz, n] of [[180, 70, 2], [527, 58, 3], [596, 58, 2]]) { // by the church, between the houses on the square, by the shop
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + R(), x = cx + Math.cos(a) * 0.9, z = cz + Math.sin(a) * 0.9;
      add({ kind: 'chat', x, z, h: Math.atan2(cx - x, cz - z) });
    }
  }
  // at the harvest festival (last day of summer, by the road east of the oil mill): people at the stalls and by the wreath
  for (const [x, z, h] of [[256, 34.6, 0], [267, 34.4, 0.3], [278, 34.6, -0.2], [289, 34.5, 0], [248, 31, -1.6], [249.5, 29, -2.2], [270, 32, Math.PI], [271, 30.6, 0], [284, 31.6, 2.6], [285.2, 30.4, -0.6]]) add({ kind: 'fest', x, z, h });
  // a buyer at every intake, by the edge of its ring on a free spot, facing the middle
  const free = (x, z) => {
    let ok = true;
    nearShapes(x, z, 0.8, c => { if (Math.hypot(x - c.x, z - c.z) < c.r + 0.5) ok = false; }, b => { if (!b.off && x > b.x0 - 0.5 && x < b.x1 + 0.5 && z > b.z0 - 0.5 && z < b.z1 + 0.5) ok = false; });
    return ok;
  };
  for (const m of [...MARKETS, DAIRY]) {
    for (let k = 0; k < 16; k++) {
      const a = k * (Math.PI / 8) + 0.3, x = m.x + Math.cos(a) * (m.r + 1.6), z = m.z + Math.sin(a) * (m.r + 1.6);
      if (k < 15 && !free(x, z)) continue;
      add({ kind: 'work', market: m, x, z, h: Math.atan2(m.x - x, m.z - z) });
      break;
    }
  }
  for (const p of people) { p.mover = { x: p.x, z: p.z, r: 0.35 }; movers.push(p.mover); }

  /* ---------- instanced meshes: one per body look, one per limb part ---------- */
  const N = people.length;
  const counts = LOOKS.map((_, i) => people.filter(p => p.look === i).length);
  bodies = LOOKS.map((L, i) => new THREE.InstancedMesh(bodyGeo(L), mat, Math.max(1, counts[i])));
  limbs = Object.fromEntries(['thigh', 'shin', 'upper', 'fore', 'hand'].map(k => [k, new THREE.InstancedMesh(GEO[k], mat, N * 2)]));
  for (const m of [...bodies, ...Object.values(limbs)]) { m.frustumCulled = false; m.castShadow = m.isInstancedMesh && bodies.includes(m); m.receiveShadow = true; m.count = 0; scene.add(m); }
}

/** Whether a machine is right in front of person p (then a walker waits). */
function blocked(p, vehicles) {
  const fx = Math.sin(p.h), fz = Math.cos(p.h);
  for (const v of vehicles) {
    const dx = v.x - p.x, dz = v.z - p.z, ahead = dx * fx + dz * fz;
    if (ahead > -1 && ahead < 5 + (v.r || 2) && Math.abs(dx * fz - dz * fx) < (v.r || 2) + 1) return true;
  }
  return false;
}

const M = { root: new THREE.Matrix4(), a: new THREE.Matrix4(), b: new THREE.Matrix4(), t: new THREE.Matrix4(), r: new THREE.Matrix4() };
/** parent × translate(x, y, z) × rotateX(rx) × rotateZ(rz) into out. */
function joint(out, parent, x, y, z, rx, rz = 0) {
  M.t.makeTranslation(x, y, z);
  M.r.makeRotationX(rx);
  out.multiplyMatrices(parent, M.t).multiply(M.r);
  if (rz) out.multiply(M.r.makeRotationZ(rz));
  return out;
}

/**
 * Every frame. ctx = { dt, target (camera target), hour, vehicles, selling (set of markets where
 * grain or wood is being sold right now) }.
 */
/** Developer panel: people shown at all. */
export const villagersOpt = { on: true };
export function updVillagers(ctx) {
  if (!bodies.length) return;
  if (!villagersOpt.on) {
    for (const m of [...bodies, ...Object.values(limbs)]) { m.visible = false; m.count = 0; }
    for (const p of people) p.mover.r = 0;
    return;
  }
  const { dt, target, hour, vehicles, selling } = ctx, day = hour > 6 && hour < 21.5, t = performance.now() / 1000;
  const bodyN = LOOKS.map(() => 0);
  let n = 0;
  for (const p of people) {
    const out = (p.kind !== 'work' && !day) || (p.kind === 'fest' && !ctx.fest) || Math.abs(p.x - target.x) > 160 || Math.abs(p.z - target.z) > 160;
    p.mover.r = out && p.kind !== 'work' ? 0 : 0.35; // gone home: nothing to bump into
    if (out) continue;
    let moving = 0, swing = 0;
    if (p.kind === 'walk') {
      const [a, b] = p.path, L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (p.wait > 0) p.wait -= dt;
      else if (!blocked(p, vehicles)) {
        p.t += (p.dir * p.speed * dt) / L;
        if (p.t > 1 || p.t < 0) { p.t = Math.max(0, Math.min(1, p.t)); p.dir = -p.dir; p.wait = 1 + R() * 4; }
        moving = p.speed;
      }
      p.x = a[0] + (b[0] - a[0]) * p.t; p.z = a[1] + (b[1] - a[1]) * p.t;
      const want = Math.atan2((b[0] - a[0]) * p.dir, (b[1] - a[1]) * p.dir);
      p.h += Math.atan2(Math.sin(want - p.h), Math.cos(want - p.h)) * Math.min(1, dt * 6);
      p.phase += dt * moving * 2.9;
      swing = moving > 0 ? 0.45 : 0;
    }
    p.mover.x = p.x; p.mover.z = p.z;
    const waving = p.kind === 'work' && selling.has(p.market);
    const talk = p.kind === 'chat' || p.kind === 'fest' ? Math.max(0, Math.sin(t * 0.7 + p.phase * 3)) : 0;

    M.root.makeRotationY(p.h).setPosition(p.x, groundH(p.x, p.z), p.z);
    const s = Math.sin(p.phase);
    bodies[p.look].setMatrixAt(bodyN[p.look]++, M.root);
    for (let i = 0; i < 2; i++) {
      const sx = i ? 1 : -1, k = (i ? -s : s) * swing;
      joint(M.a, M.root, sx * 0.1, 0.92, 0, k);
      tint.setScalar(p.trousers);
      limbs.thigh.setMatrixAt(n * 2 + i, M.a); limbs.thigh.setColorAt(n * 2 + i, tint);
      joint(M.b, M.a, 0, -0.42, 0, Math.max(0, -k) * 1.1);
      limbs.shin.setMatrixAt(n * 2 + i, M.b); limbs.shin.setColorAt(n * 2 + i, tint);
      // arms: swinging, a hand moving while talking, the buyer's right arm waving over his head
      let ax = (i ? s : -s) * swing * 0.9, az = 0, el = -0.2;
      if (talk && i === (p.phase > 5 ? 1 : 0)) { ax = -0.9 * talk; el = -0.9 * talk; }
      if (waving && i === 0) { ax = -2.6; az = 0.35 * Math.sin(t * 7); el = -0.3; }
      joint(M.a, M.root, sx * 0.27, 1.53, 0, ax, az);
      tint.set(LOOKS[p.look].shirt);
      limbs.upper.setMatrixAt(n * 2 + i, M.a); limbs.upper.setColorAt(n * 2 + i, tint);
      joint(M.b, M.a, 0, -0.3, 0, el);
      limbs.fore.setMatrixAt(n * 2 + i, M.b); limbs.fore.setColorAt(n * 2 + i, tint);
      joint(M.a, M.b, 0, -0.3, 0, 0);
      limbs.hand.setMatrixAt(n * 2 + i, M.a);
    }
    n++;
  }
  bodies.forEach((m, i) => { m.count = bodyN[i]; m.visible = bodyN[i] > 0; m.instanceMatrix.needsUpdate = true; });
  for (const m of Object.values(limbs)) {
    m.count = n * 2; m.visible = n > 0;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
}

/** For the smoke test: where everybody is ({ kind, x, z, market id }). */
export const villagerSpots = () => people.map(p => ({ kind: p.kind, x: p.x, z: p.z, market: p.market?.id }));
/** For the smoke test: how many people are drawn now. */
export const villagersShown = () => (limbs.thigh ? limbs.thigh.count / 2 : 0);
