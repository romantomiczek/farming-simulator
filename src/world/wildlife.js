import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { scene } from '../render/core.js';
import { rng, col, angDiff, clamp } from '../core/util.js';
import { terrainH } from './terrain.js';
import { PAD, POND, NO_TREES, FLAT, COW_PEN, HEN_RUN, circles, boxes } from './layout.js';
import { playAt } from '../audio.js';

/**
 * Animals that make the valley feel lived in: the farm dog, cats, hares, foxes, a small herd
 * of roe deer and a flock of crows that follows working machines.
 * Each species is one instanced body mesh (several colours via vertex colours) plus one
 * instanced mesh for the legs or wings, so the whole module costs about a dozen draw calls.
 */
const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
const _c = new THREE.Color();

/** Box with one colour baked in; [w, h, d], [x, y, z], optional rotation about x. */
function box(size, pos, hex, rx = 0) {
  const g = new THREE.BoxGeometry(...size);
  if (rx) g.rotateX(rx);
  g.translate(...pos);
  _c.set(hex);
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = _c.r; c[i * 3 + 1] = _c.g; c[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return g;
}
const merge = parts => mergeGeometries(parts.map(p => p.toNonIndexed()));

/* ---------- models (metres, facing +z, feet at y = 0) ---------- */
const MODELS = {
  dog: () => merge([
    box([0.3, 0.3, 0.72], [0, 0.52, 0], '#8a5a3c'), box([0.26, 0.2, 0.5], [0, 0.44, 0.04], '#e8dcc6'),
    box([0.26, 0.26, 0.3], [0, 0.76, 0.42], '#8a5a3c'), box([0.15, 0.13, 0.18], [0, 0.69, 0.62], '#e8dcc6'),
    box([0.06, 0.05, 0.05], [0, 0.73, 0.71], '#2a2420'),
    box([0.07, 0.14, 0.05], [-0.1, 0.94, 0.36], '#5e3e2a'), box([0.07, 0.14, 0.05], [0.1, 0.94, 0.36], '#5e3e2a'),
    box([0.06, 0.06, 0.34], [0, 0.72, -0.48], '#8a5a3c', -0.7),
  ]),
  cat: () => merge([
    box([0.17, 0.17, 0.4], [0, 0.29, 0], '#7d7468'), box([0.16, 0.15, 0.15], [0, 0.4, 0.25], '#7d7468'),
    box([0.04, 0.07, 0.03], [-0.05, 0.5, 0.25], '#5a524a'), box([0.04, 0.07, 0.03], [0.05, 0.5, 0.25], '#5a524a'),
    box([0.08, 0.06, 0.04], [0, 0.37, 0.33], '#e8e0d4'), box([0.04, 0.04, 0.36], [0, 0.46, -0.3], '#7d7468', -1.0),
  ]),
  ginger: () => merge([
    box([0.17, 0.17, 0.4], [0, 0.29, 0], '#d08a4a'), box([0.16, 0.15, 0.15], [0, 0.4, 0.25], '#d08a4a'),
    box([0.04, 0.07, 0.03], [-0.05, 0.5, 0.25], '#a8683a'), box([0.04, 0.07, 0.03], [0.05, 0.5, 0.25], '#a8683a'),
    box([0.08, 0.06, 0.04], [0, 0.37, 0.33], '#f2e6d6'), box([0.04, 0.04, 0.36], [0, 0.46, -0.3], '#d08a4a', -1.0),
  ]),
  hare: () => merge([
    box([0.2, 0.22, 0.4], [0, 0.2, 0], '#9b7f5f'), box([0.22, 0.12, 0.2], [0, 0.08, -0.08], '#8a6f52'),
    box([0.14, 0.14, 0.18], [0, 0.33, 0.2], '#9b7f5f'), box([0.04, 0.05, 0.04], [0, 0.32, 0.3], '#4a3a2a'),
    box([0.04, 0.22, 0.06], [-0.04, 0.48, 0.15], '#8a6f52', -0.25), box([0.04, 0.22, 0.06], [0.04, 0.48, 0.15], '#8a6f52', -0.25),
    box([0.08, 0.08, 0.06], [0, 0.22, -0.22], '#f2efe8'),
  ]),
  fox: () => merge([
    box([0.22, 0.24, 0.62], [0, 0.42, 0], '#d0652a'), box([0.18, 0.12, 0.4], [0, 0.32, 0.06], '#f2e8dc'),
    box([0.2, 0.2, 0.22], [0, 0.56, 0.38], '#d0652a'), box([0.1, 0.09, 0.18], [0, 0.5, 0.54], '#f2e8dc'),
    box([0.05, 0.05, 0.05], [0, 0.53, 0.63], '#222'),
    box([0.06, 0.12, 0.05], [-0.07, 0.71, 0.35], '#3a2a20'), box([0.06, 0.12, 0.05], [0.07, 0.71, 0.35], '#3a2a20'),
    box([0.14, 0.14, 0.42], [0, 0.38, -0.5], '#d0652a', 0.5), box([0.1, 0.1, 0.12], [0, 0.24, -0.7], '#f2efe8', 0.5),
  ]),
  deer: () => merge([
    box([0.36, 0.42, 0.95], [0, 0.95, 0], '#9a6b45'), box([0.3, 0.3, 0.12], [0, 0.98, -0.5], '#f2ece0'),
    box([0.16, 0.5, 0.18], [0, 1.3, 0.42], '#9a6b45', -0.45), box([0.18, 0.2, 0.3], [0, 1.55, 0.56], '#9a6b45'),
    box([0.08, 0.07, 0.06], [0, 1.52, 0.72], '#2a2420'),
    box([0.06, 0.14, 0.04], [-0.08, 1.7, 0.5], '#7a5236'), box([0.06, 0.14, 0.04], [0.08, 1.7, 0.5], '#7a5236'),
  ]),
  crow: () => merge([
    box([0.13, 0.12, 0.3], [0, 0.12, 0], '#1f2226'), box([0.1, 0.1, 0.1], [0, 0.18, 0.18], '#1f2226'),
    box([0.04, 0.03, 0.08], [0, 0.17, 0.26], '#55504a'), box([0.12, 0.02, 0.14], [0, 0.12, -0.2], '#1f2226'),
  ]),
};
const leg = (len, w, hex) => box([w, len, w], [0, -len / 2, 0], hex);
const wing = () => box([0.34, 0.02, 0.16], [0.17, 0, 0], '#25282c');

/* ---------- shared helpers ---------- */
function blocked(x, z) {
  if (x < FLAT.x0 - 60 || x > FLAT.x1 + 60 || z < FLAT.z0 - 60 || z > FLAT.z1 + 60) return true;
  for (const b of boxes) if (x > b.x0 - 0.3 && x < b.x1 + 0.3 && z > b.z0 - 0.3 && z < b.z1 + 0.3) return true;
  for (const c of circles) { const dx = x - c.x, dz = z - c.z; if (dx * dx + dz * dz < (c.r + 0.25) ** 2) return true; }
  return false;
}
const inRect = (x, z, r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
/** Random free point in rect r (tries a few times, falls back to the centre). */
function pickIn(R, r, avoidTown = false) {
  for (let k = 0; k < 12; k++) {
    const x = r.x0 + R() * (r.x1 - r.x0), z = r.z0 + R() * (r.z1 - r.z0);
    if (blocked(x, z)) continue;
    if (avoidTown && (NO_TREES.some(n => inRect(x, z, n)) || inRect(x, z, PAD) || Math.hypot(x - POND.x, z - POND.z) < POND.r + 2)) continue;
    return { x, z };
  }
  return { x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 };
}

/** Moving vehicles scare animals; parked ones do not. Returns the nearest one closer than r, or null. */
function threat(a, vehicles, r) {
  let best = null, bd = r;
  for (const v of vehicles) {
    if (!v.available || Math.abs(v.speed) < 0.4) continue;
    const d = Math.hypot(v.x - a.x, v.z - a.z);
    if (d < bd) { bd = d; best = v; }
  }
  return best ? { v: best, d: bd } : null;
}

/** Turns toward the target and moves; picks a new target when the way is blocked. Returns true on arrival. */
function moveTo(a, dt, speed, turn = 5) {
  const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
  if (d < 0.35) { a.v = 0; return true; }
  a.h += angDiff(a.h, Math.atan2(dx, dz)) * Math.min(1, dt * turn);
  const s = Math.min(speed, d * 3), nx = a.x + Math.sin(a.h) * s * dt, nz = a.z + Math.cos(a.h) * s * dt;
  if (blocked(nx, nz)) { a.v = 0; a.stuck = (a.stuck || 0) + dt; return a.stuck > 0.6 ? (a.stuck = 0, true) : false; }
  a.x = nx; a.z = nz; a.v = s; a.stuck = 0;
  return false;
}
/** Sets a flee target straight away from (x, z), with a little sideways jink. */
function fleeFrom(a, x, z, dist, R) {
  const ang = Math.atan2(a.x - x, a.z - z) + (R() - 0.5) * 0.9;
  a.tx = a.x + Math.sin(ang) * dist; a.tz = a.z + Math.cos(ang) * dist;
  a.fleeing = 2.5 + R() * 1.5;
}

/* ---------- species: instanced body (+ legs) with a gait ---------- */
const _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);
const _e = new THREE.Euler();

const allMeshes = [];
function species(geo, n, legs) {
  const body = new THREE.InstancedMesh(geo, mat, n);
  allMeshes.push(body);
  body.castShadow = true; body.receiveShadow = true; body.frustumCulled = false;
  scene.add(body);
  let legMesh = null;
  if (legs) {
    legMesh = new THREE.InstancedMesh(legs.geo, mat, n * 4);
    allMeshes.push(legMesh);
    legMesh.castShadow = true; legMesh.frustumCulled = false;
    scene.add(legMesh);
  }
  return {
    body, legMesh,
    /** Writes agent i: position, heading, bob, pitch; gait phase drives the legs. */
    put(i, a, bob = 0, pitch = 0) {
      _p.set(a.x, (a.y ?? terrainH(a.x, a.z)) + bob, a.z);
      _q.setFromEuler(_e.set(pitch, a.h, 0, 'YXZ'));
      _s.setScalar(a.s || 1);
      body.setMatrixAt(i, _m.compose(_p, _q, _s));
      if (!legMesh) return;
      const amp = Math.min(1, a.v / legs.full) * legs.swing;
      legs.hips.forEach(([x, y, z], k) => {
        const sw = Math.sin(a.phase + (k === 0 || k === 3 ? 0 : Math.PI)) * amp;
        _l.makeRotationX(sw).setPosition(x, y, z);
        legMesh.setMatrixAt(i * 4 + k, _l.premultiply(_m));
      });
    },
    flush() { body.instanceMatrix.needsUpdate = true; if (legMesh) legMesh.instanceMatrix.needsUpdate = true; },
  };
}
const quad = (len, w, hex, hx, hz, y, full, swing = 0.6) => ({
  geo: leg(len, w, hex), full, swing,
  hips: [[-hx, y, hz], [hx, y, hz], [-hx, y, -hz], [hx, y, -hz]],
});

/* ---------- build ---------- */
export function buildWildlife() {
  const R = rng(91);
  const YARD = { x0: -44, x1: 24, z0: -50, z1: -12 };
  const CATS = { x0: -42, x1: -20, z0: -46, z1: -12 };
  const VALLEY = { x0: FLAT.x0 + 4, x1: FLAT.x1 - 4, z0: FLAT.z0 + 4, z1: FLAT.z1 - 4 };
  const FOX_AREAS = [{ x0: -125, x1: -96, z0: -80, z1: 130 }, { x0: -50, x1: 150, z0: 132, z1: 160 }];
  const DEER_DAY = { x0: 70, x1: 250, z0: -125, z1: -98 }, DEER_DUSK = { x0: 70, x1: 250, z0: -96, z1: -55 };

  const dogS = species(MODELS.dog(), 1, quad(0.4, 0.08, '#6e4630', 0.1, 0.25, 0.42, 6, 0.8));
  const catS = [species(MODELS.cat(), 1, quad(0.2, 0.05, '#6a6258', 0.06, 0.14, 0.22, 2.5)), species(MODELS.ginger(), 1, quad(0.2, 0.05, '#b8763e', 0.06, 0.14, 0.22, 2.5))];
  const hareS = species(MODELS.hare(), 10);
  const foxS = species(MODELS.fox(), 2, quad(0.32, 0.06, '#2e2620', 0.07, 0.22, 0.34, 5, 0.75));
  const deerS = species(MODELS.deer(), 5, quad(0.78, 0.08, '#7a5236', 0.12, 0.36, 0.8, 7, 0.7));
  const crowS = species(MODELS.crow(), 12);
  const wings = new THREE.InstancedMesh(wing(), mat, 24);
  wings.castShadow = true; wings.frustumCulled = false; scene.add(wings); allMeshes.push(wings);

  const agent = (p, extra) => Object.assign({ x: p.x, z: p.z, h: R() * 6.28, tx: p.x, tz: p.z, v: 0, phase: R() * 6, wait: R() * 4, fleeing: 0 }, extra);
  const dog = agent({ x: -20, z: -24 }, { follow: null, barkT: 3 });
  const cats = [agent(pickIn(R, CATS)), agent(pickIn(R, CATS))];
  const hares = Array.from({ length: 10 }, () => agent(pickIn(R, VALLEY, true), { s: 0.9 + R() * 0.25 }));
  const foxes = FOX_AREAS.map(r => agent(pickIn(R, r), { area: r }));
  const herd = { ...pickIn(R, DEER_DAY), tx: 0, tz: 0, wait: 0 };
  const deer = Array.from({ length: 5 }, (_, k) => agent({ x: herd.x + (R() - 0.5) * 8, z: herd.z + (R() - 0.5) * 8 }, { s: k === 0 ? 1.1 : 0.85 + R() * 0.15, ox: (R() - 0.5) * 10, oz: (R() - 0.5) * 10 }));
  const flock = { x: 30, z: 20, mode: 'sit', t: 20 };
  const crows = Array.from({ length: 12 }, () => ({ x: 30 + (R() - 0.5) * 10, z: 20 + (R() - 0.5) * 10, y: 0, h: R() * 6.28, state: 'ground', ang: R() * 6.28, rad: 8 + R() * 8, alt: 14 + R() * 10, flap: R() * 6, tx: 0, tz: 0, wait: R() * 3, v: 0 }));
  let callT = 8;

  function wander(a, dt, area, walk, pause, avoidTown) {
    if (a.wait > 0) { a.wait -= dt; a.v = 0; return; }
    if (moveTo(a, dt, walk)) { const p = pickIn(R, area, avoidTown); a.tx = p.x; a.tz = p.z; a.wait = pause[0] + R() * (pause[1] - pause[0]); }
  }

  /** A worked field draws the crows: the machine with a tool in the ground (or harvesting). */
  function workingMachine(vehicles) {
    for (const v of vehicles) if (v.available && v.lowered && Math.abs(v.speed) > 0.8) return v;
    return null;
  }

  return {
    /** For tests and debugging. */
    agents: { dog, cats, hares, foxes, deer, crows, flock },
    /** Shows or hides every animal (developer panel). */
    setVisible(on) { for (const m of allMeshes) m.visible = on; },
    /** ctx = { vehicles, active, hour, cows, hens } */
    update(dt, ctx) {
      const { vehicles, hour } = ctx, night = hour < 5 || hour > 21, dusk = (hour > 4.5 && hour < 8.5) || (hour > 18 && hour < 22);
      const me = ctx.active;

      /* dog: runs alongside a machine passing the yard, barks, then trots home */
      {
        const a = dog, yardC = { x: -10, z: -30 };
        const near = vehicles.find(v => v.available && Math.abs(v.speed) > 1.2 && Math.hypot(v.x - yardC.x, v.z - yardC.z) < 45);
        if (near && !night) {
          if (a.follow !== near) { a.follow = near; playAt('bark', a.x, a.z, me); a.barkT = 4 + R() * 6; }
          const side = 3.2;
          a.tx = near.x + Math.cos(near.h) * side - Math.sin(near.h) * 1.5;
          a.tz = near.z - Math.sin(near.h) * side - Math.cos(near.h) * 1.5;
          moveTo(a, dt, Math.min(11, Math.abs(near.speed) + 2.5), 7);
          if ((a.barkT -= dt) < 0) { playAt('bark', a.x, a.z, me); a.barkT = 5 + R() * 8; }
        } else {
          if (a.follow) { a.follow = null; const p = pickIn(R, YARD); a.tx = p.x; a.tz = p.z; a.wait = 0; }
          wander(a, dt, YARD, night ? 0.6 : 1.4, night ? [20, 60] : [3, 12]);
        }
        a.phase += dt * (2 + a.v * 2.4);
        dogS.put(0, a, a.v > 3 ? Math.abs(Math.sin(a.phase)) * 0.05 : 0);
        dogS.flush();
      }

      /* cats: long naps, slow strolls, dart away from moving machines */
      cats.forEach((a, i) => {
        const t = threat(a, vehicles, 7);
        if (t && a.fleeing <= 0) fleeFrom(a, t.v.x, t.v.z, 8, R);
        if (a.fleeing > 0) { a.fleeing -= dt; moveTo(a, dt, 5, 8); } else wander(a, dt, CATS, 0.7, [8, 30]);
        a.phase += dt * (2 + a.v * 4);
        if (R() < dt / 90) playAt('meow', a.x, a.z, me);
        catS[i].put(0, a); catS[i].flush();
      });

      /* hares: hop between spots in the valley, bolt from machines with a zigzag */
      hares.forEach((a, i) => {
        const t = threat(a, vehicles, 16);
        if (t && a.fleeing <= 0) fleeFrom(a, t.v.x, t.v.z, 22 + R() * 10, R);
        if (a.fleeing > 0) {
          a.fleeing -= dt;
          if (R() < dt * 1.5) a.h += (R() - 0.5) * 1.4; // jink
          if (moveTo(a, dt, 9.5, 9)) a.fleeing = 0;
        } else wander(a, dt, VALLEY, 1.6, [2, 9], true);
        a.phase += dt * (a.v > 0.1 ? 6 + a.v * 0.8 : 0);
        const hop = a.v > 0.1 ? Math.abs(Math.sin(a.phase)) * (0.12 + a.v * 0.03) : 0;
        hareS.put(i, a, hop, a.v > 0.1 ? -Math.cos(a.phase) * 0.25 : 0);
      });
      hareS.flush();

      /* foxes: along the forest and the hills, busier at dusk and night */
      foxes.forEach((a, i) => {
        const t = threat(a, vehicles, 25);
        if (t && a.fleeing <= 0) fleeFrom(a, t.v.x, t.v.z, 30, R);
        if (a.fleeing > 0) { a.fleeing -= dt; if (moveTo(a, dt, 8, 6)) a.fleeing = 0; }
        else wander(a, dt, a.area, night || dusk ? 2.2 : 1.1, night || dusk ? [1, 5] : [6, 25]);
        a.phase += dt * (2 + a.v * 2.6);
        foxS.put(i, a);
      });
      foxS.flush();

      /* roe deer: rest on the southern slopes by day, graze the meadow at dawn and dusk */
      {
        const area = dusk || night ? DEER_DUSK : DEER_DAY;
        if ((herd.wait -= dt) <= 0 || !inRect(herd.x, herd.z, area)) {
          const p = pickIn(R, area); herd.x = p.x; herd.z = p.z; herd.wait = 25 + R() * 40;
        }
        let scare = null;
        for (const a of deer) { const t = threat(a, vehicles, 35); if (t) { scare = t.v; break; } }
        deer.forEach((a, i) => {
          if (scare && a.fleeing <= 0) fleeFrom(a, scare.x, scare.z, 40, R);
          if (a.fleeing > 0) { a.fleeing -= dt; if (moveTo(a, dt, 10, 4)) a.fleeing = 0; if (a.fleeing <= 0) { herd.x = a.x; herd.z = a.z; } }
          else {
            if (a.wait > 0) { a.wait -= dt; a.v = 0; }
            else {
              a.tx = herd.x + a.ox; a.tz = herd.z + a.oz;
              if (moveTo(a, dt, 1.3, 3)) { a.wait = 4 + R() * 12; a.ox = (R() - 0.5) * 12; a.oz = (R() - 0.5) * 12; }
            }
          }
          a.phase += dt * (1.5 + a.v * 1.5);
          const bound = a.v > 4 ? Math.abs(Math.sin(a.phase)) * 0.35 : 0;
          // grazing: head down while standing (pitch the whole body slightly)
          deerS.put(i, a, bound, a.v < 0.1 && !night ? 0.12 : 0);
        });
        deerS.flush();
      }

      /* crows: follow the plough, otherwise sit on a field or circle over the valley */
      {
        const w = workingMachine(vehicles);
        if (w) {
          flock.mode = 'follow';
          flock.x = w.x - Math.sin(w.h) * 14; flock.z = w.z - Math.cos(w.h) * 14;
        } else if ((flock.t -= dt) <= 0) {
          flock.mode = flock.mode === 'sit' || flock.mode === 'follow' ? 'circle' : 'sit';
          if (flock.mode === 'sit') { const p = pickIn(R, VALLEY, true); flock.x = p.x; flock.z = p.z; }
          flock.t = flock.mode === 'sit' ? 40 + R() * 60 : 15 + R() * 20;
        }
        crows.forEach((b, i) => {
          const t = threat(b, vehicles, 7);
          const wantGround = flock.mode !== 'circle';
          if (b.state === 'ground') {
            if (t || !wantGround || Math.hypot(b.x - flock.x, b.z - flock.z) > 30) { b.state = 'fly'; }
            else {
              // hop and peck around the flock centre
              if ((b.wait -= dt) <= 0) { b.tx = flock.x + (R() - 0.5) * 14; b.tz = flock.z + (R() - 0.5) * 10; b.wait = 0.6 + R() * 2.5; }
              const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz);
              if (d > 0.2) { b.h = Math.atan2(dx, dz); const s = Math.min(d, 1.4 * dt); b.x += (dx / d) * s; b.z += (dz / d) * s; b.v = 1; } else b.v = 0;
              b.y = b.v ? Math.abs(Math.sin(performance.now() / 90 + i)) * 0.06 : 0;
            }
          } else {
            // fly: circle over the flock centre, glide down when it wants to land
            b.ang += dt * (0.5 + (i % 3) * 0.08);
            const cx = flock.x + Math.cos(b.ang) * b.rad, cz = flock.z + Math.sin(b.ang) * b.rad;
            const landing = wantGround && !t && (flock.mode === 'follow' || b.y < 30);
            const ty = landing ? 0 : b.alt;
            const tx = landing ? flock.x + (R() - 0.5) * 2 + Math.cos(i * 2.4) * 5 : cx, tz = landing ? flock.z + Math.sin(i * 2.4) * 5 : cz;
            const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz) || 1;
            const sp = Math.min(13, 4 + d * 0.8);
            b.h += angDiff(b.h, Math.atan2(dx, dz)) * Math.min(1, dt * 3);
            b.x += Math.sin(b.h) * sp * dt; b.z += Math.cos(b.h) * sp * dt;
            b.y += clamp(ty - b.y, -5 * dt, 6 * dt) + (t ? 6 * dt : 0);
            b.flap += dt * (landing && b.y < 3 ? 8 : 14);
            b.v = sp;
            if (landing && b.y <= 0.05 && d < 6) { b.state = 'ground'; b.y = 0; b.wait = R() * 2; }
          }
          crowS.put(i, b, 0, 0);
          // wings: open and flapping in the air, folded on the ground
          const air = b.state === 'fly';
          const flap = air ? Math.sin(b.flap) * 0.7 + 0.1 : -0.15;
          for (let k = 0; k < 2; k++) {
            _l.makeRotationZ(flap);
            if (!air) _l.scale(_s.set(0.45, 1, 1));
            if (k) _l.premultiply(_m.makeRotationY(Math.PI));
            _l.premultiply(_m.makeTranslation(k ? -0.06 : 0.06, 0.15, 0));
            crowS.body.getMatrixAt(i, _m);
            wings.setMatrixAt(i * 2 + k, _l.premultiply(_m));
          }
        });
        crowS.flush(); wings.instanceMatrix.needsUpdate = true;
        if (R() < dt / 12) { const b = crows[(R() * crows.length) | 0]; playAt('crow', b.x, b.z, me); }
      }

      /* the farm animals' voices */
      if ((callT -= dt) <= 0) {
        callT = 6 + R() * 14;
        if (ctx.cows && R() < 0.6) playAt('moo', (COW_PEN.x0 + COW_PEN.x1) / 2, (COW_PEN.z0 + COW_PEN.z1) / 2, me);
        else if (ctx.hens) playAt('cluck', (HEN_RUN.x0 + HEN_RUN.x1) / 2, (HEN_RUN.z0 + HEN_RUN.z1) / 2, me);
      }
    },
  };
}
