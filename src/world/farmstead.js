import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { scene } from '../render/core.js';
import { groundH } from './terrain.js';
import { M, MT, mk, B, CY, flatPlane, bake } from '../render/materials.js';
import { F } from '../vehicles/parts.js';
import { col, rng } from '../core/util.js';
import { COW_PEN, HEN_RUN, SHEEP_PEN, PIG_PEN, MIXER_AT, MILK_LOAD, GREENHOUSES, GREENHOUSE_WATER, SAWMILL, SLURRY_PIT, MANURE_HEAP, boxes, circles } from './layout.js';
import { HERD, DUNG, PALLET } from '../game/balance.js';
import { G } from '../game/state.js';
import { herd, palletsReady, PALLETS } from '../game/animals.js';
import { PALLET_MAT } from '../vehicles/models.js';

/**
 * Buildings you can buy (cow shed, hen house, sheep fold, pigsty, feed mixer, greenhouses) and the sawmill. Each building is a
 * group whose visibility and collisions follow ownership: setOwned(key, on). The animals are two
 * instanced meshes that wander slowly inside their runs.
 */
const groups = {};
const owned = {};

function addColl(key, b) { b.owner = key; b.off = true; boxes.push(b); }
function fence(g, key, x0, x1, z0, z1) {
  const wood = '#9a7b5e';
  const side = (ax, az, bx, bz) => {
    const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 2.5);
    for (let i = 0; i <= n; i++) { const t = i / n; B(0.16, 1.2, 0.16, wood, ax + (bx - ax) * t, 0.6, az + (bz - az) * t, g); }
    const ang = Math.atan2(bx - ax, bz - az);
    for (const y of [0.5, 1.0]) { const r = B(0.08, 0.12, L, wood, (ax + bx) / 2, y, (az + bz) / 2, g); r.rotation.y = ang; }
  };
  side(x0, z0, x1, z0); side(x1, z0, x1, z1); side(x1, z1, x0, z1); side(x0, z1, x0, z0);
  addColl(key, { x0: x0 - 0.3, x1: x1 + 0.3, z0: z0 - 0.3, z1: z1 + 0.3 });
}

function gableRoof(g, w, d, h, x, z, roofHex) {
  const ang = 0.5, L = d / 2 / Math.cos(ang) + 0.4;
  for (const sg of [1, -1]) {
    const r = B(w + 0.6, 0.2, L, MT(roofHex, roofHex === '#9a4f3e' ? 'tiles' : 'metal'), x, h + Math.tan(ang) * d / 4, z + sg * d / 4, g);
    r.rotation.x = sg * ang;
  }
}

function buildCows() {
  const g = new THREE.Group(), p = COW_PEN;
  flatPlane(p.x1 - p.x0, p.z1 - p.z0, '#a39566', (p.x0 + p.x1) / 2, 0.03, (p.z0 + p.z1) / 2, g);
  fence(g, 'cows', p.x0, p.x1, p.z0, p.z1);
  // open shelter along the west side
  const sx = p.x0 + 4.5, sz = (p.z0 + p.z1) / 2;
  for (const dz of [-9, -3, 3, 9]) for (const dx of [-3.5, 3.5]) CY(0.15, 0.15, 3.6, 6, '#8a6a52', sx + dx, 1.8, sz + dz, g);
  B(9, 0.25, 21, MT('#7b5a4e', 'metal'), sx, 3.7, sz, g);
  B(0.3, 3.6, 21, MT('#c9a582', 'wood'), p.x0 + 0.5, 1.8, sz, g);
  // feed and water troughs at the east fence, next to the feed ring
  B(1.0, 0.6, 8, '#8a6a52', p.x1 - 1.2, 0.3, p.z1 - 6, g);
  B(1.0, 0.5, 3, '#7a9fb4', p.x1 - 1.2, 0.25, p.z0 + 5, g);
  // milk cooling tank by the milk ring (the tank trailer loads here)
  const m = MILK_LOAD;
  CY(1.1, 1.1, 2.6, 14, '#d5d9dc', m.x - 7.5, 1.6, m.z + 1, g); CY(1.15, 1.15, 0.15, 14, '#aab0b4', m.x - 7.5, 2.95, m.z + 1, g);
  for (const [dx, dz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) CY(0.06, 0.06, 0.4, 5, '#aab0b4', m.x - 7.5 + dx, 0.2, m.z + 1 + dz, g);
  const pipe = CY(0.08, 0.08, 4.5, 6, '#aab0b4', m.x - 5, 1.2, m.z + 1, g); pipe.rotation.z = Math.PI / 2;
  addColl('cows', { x0: m.x - 8.8, x1: m.x - 6.2, z0: m.z - 0.3, z1: m.z + 2.3 });
  return g;
}

function buildSheep() {
  const g = new THREE.Group(), p = SHEEP_PEN;
  flatPlane(p.x1 - p.x0, p.z1 - p.z0, '#8fa45e', (p.x0 + p.x1) / 2, 0.03, (p.z0 + p.z1) / 2, g);
  fence(g, 'sheep', p.x0, p.x1, p.z0, p.z1);
  // low wooden fold along the south side with an open front
  const fx = (p.x0 + p.x1) / 2, fz = p.z0 + 3.2;
  B(16, 2.4, 0.25, MT('#8a6a52', 'wood'), fx, 1.2, p.z0 + 0.6, g);
  for (const dx of [-8, 8]) B(0.25, 2.4, 5, MT('#8a6a52', 'wood'), fx + dx, 1.2, fz, g);
  gableRoof(g, 16, 5.4, 2.4, fx, fz, '#6b5a52');
  // hay rack by the feed ring
  B(1.4, 1.1, 3.2, '#9a7b5e', p.x1 - 1.4, 0.55, p.z1 - 4, g);
  B(1.2, 0.5, 3.0, '#c2b866', p.x1 - 1.4, 1.2, p.z1 - 4, g);
  return g;
}

function buildPigs() {
  const g = new THREE.Group(), p = PIG_PEN;
  flatPlane(p.x1 - p.x0, p.z1 - p.z0, '#7d6650', (p.x0 + p.x1) / 2, 0.03, (p.z0 + p.z1) / 2, g);
  fence(g, 'pigs', p.x0, p.x1, p.z0, p.z1);
  // brick sty on the west side, a mud wallow and the trough at the east fence
  const sx = p.x0 + 4.5, sz = (p.z0 + p.z1) / 2;
  B(8, 2.6, 12, MT('#c98f6e', 'brick'), sx, 1.3, sz, g);
  gableRoof(g, 8, 12, 2.6, sx, sz, '#9a4f3e');
  for (const dz of [-3.5, 0, 3.5]) B(0.1, 1.1, 1.1, '#5a3f30', sx + 4.02, 0.55, sz + dz, g);
  flatPlane(5, 4, '#5e4836', p.x0 + 14, 0.05, p.z0 + 6, g);
  B(1.0, 0.5, 6, '#8d9396', p.x1 - 1.2, 0.25, p.z1 - 5, g);
  return g;
}

/** Feed mixer wagon parked between the cow shed and the sheep: tub, auger chute and two wheels. */
function buildMixer() {
  const g = new THREE.Group(), { x, z } = MIXER_AT;
  B(5.2, 0.25, 1.6, '#3a3d40', x, 0.75, z, g);
  B(4.4, 1.6, 2.3, '#3f7f4a', x, 1.75, z, g);
  B(4.6, 0.15, 2.5, '#2f6b3b', x, 2.6, z, g);
  B(1.2, 0.5, 0.9, '#bfc3c6', x - 1, 1.1, z + 1.35, g); // discharge door
  const ch = B(1.6, 0.12, 0.5, '#bfc3c6', x - 1, 0.95, z + 2.0, g); ch.rotation.x = -0.35;
  B(2.2, 0.12, 0.12, '#3a3d40', x + 3.6, 0.55, z, g); // drawbar
  for (const sg of [1, -1]) {
    const w = CY(0.55, 0.55, 0.4, 14, '#262626', x + 0.4, 0.55, z + sg * 1.35, g); w.rotation.x = Math.PI / 2;
    const r = CY(0.3, 0.3, 0.42, 10, '#8d9396', x + 0.4, 0.55, z + sg * 1.35, g); r.rotation.x = Math.PI / 2;
  }
  B(0.1, 0.9, 0.1, '#3a3d40', x + 4.6, 0.45, z, g); // jack stand
  addColl('mixer', { x0: x - 2.7, x1: x + 4.8, z0: z - 1.5, z1: z + 1.5 });
  return g;
}

function buildHens() {
  const g = new THREE.Group(), p = HEN_RUN;
  flatPlane(p.x1 - p.x0, p.z1 - p.z0, '#b7a77a', (p.x0 + p.x1) / 2, 0.03, (p.z0 + p.z1) / 2, g);
  fence(g, 'hens', p.x0, p.x1, p.z0, p.z1);
  const hx = (p.x0 + p.x1) / 2, hz = p.z0 + 3;
  B(7, 2.6, 4, MT('#e9d7b5', 'plaster'), hx, 1.3, hz, g);
  gableRoof(g, 7, 4, 2.6, hx, hz, '#9a4f3e');
  B(0.9, 1.3, 0.1, '#8a6a52', hx, 0.65, hz + 2.03, g);
  B(0.6, 0.5, 0.1, '#5d7d8c', hx - 2.2, 1.7, hz + 2.03, g);
  return g;
}

const greenGlass = new THREE.MeshStandardMaterial({ color: col('#cfe7e4'), roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.35 });
function buildGreenhouse(gh) {
  const g = new THREE.Group(), w = 7, d = 16, h = 2.6, frame = '#e8e4da';
  for (const dx of [-w / 2, w / 2]) for (let k = 0; k <= 4; k++) B(0.12, h, 0.12, frame, gh.x + dx, h / 2, gh.z - d / 2 + (k * d) / 4, g);
  for (const dx of [-w / 2, w / 2]) B(0.12, 0.12, d, frame, gh.x + dx, h, gh.z, g);
  const glass = (gw, gh2, gd, x, y, z) => mk(new THREE.BoxGeometry(gw, gh2, gd), greenGlass, x, y, z, g, false);
  glass(0.05, h, d, gh.x - w / 2, h / 2, gh.z); glass(0.05, h, d, gh.x + w / 2, h / 2, gh.z);
  glass(w, h, 0.05, gh.x, h / 2, gh.z - d / 2); glass(w, h, 0.05, gh.x, h / 2, gh.z + d / 2);
  const ang = 0.42, L = w / 2 / Math.cos(ang);
  for (const sg of [1, -1]) {
    const r = mk(new THREE.BoxGeometry(L, 0.05, d), greenGlass, gh.x + sg * w / 4, h + Math.tan(ang) * w / 4, gh.z, g, false);
    r.rotation.z = -sg * ang;
    B(0.1, 0.1, d, frame, gh.x, h + Math.tan(ang) * w / 2, gh.z, g);
  }
  // three beds of tomato plants with red dots
  for (const bx of [-2.2, 0, 2.2]) {
    B(1.2, 0.3, d - 2, '#6d4833', gh.x + bx, 0.15, gh.z, g);
    for (let k = 0; k < 6; k++) {
      const pz = gh.z - d / 2 + 2 + k * 2.4;
      mk(new THREE.IcosahedronGeometry(0.5, 0), '#5f9e45', gh.x + bx, 0.9, pz, g).scale.y = 1.4;
      B(0.18, 0.18, 0.18, '#d8473a', gh.x + bx + 0.3, 1.0, pz + 0.2, g);
    }
  }
  addColl(gh.key, { x0: gh.x - w / 2 - 0.2, x1: gh.x + w / 2 + 0.2, z0: gh.z - d / 2 - 0.2, z1: gh.z + d / 2 + 0.2 });
  return g;
}

function ring(z, hex, parent) {
  const r = new THREE.Mesh(new THREE.RingGeometry(z.r - 0.5, z.r, 40), new THREE.MeshBasicMaterial({ color: col(hex), transparent: true, opacity: 0.75 }));
  r.rotation.x = -Math.PI / 2; r.position.set(z.x, groundH(z.x, z.z) + 0.06, z.z); parent.add(r);
  return r;
}

/* ---------- animals ---------- */
function cowGeo() {
  const parts = [
    new THREE.BoxGeometry(0.8, 0.75, 1.7).translate(0, 1.05, 0),
    new THREE.BoxGeometry(0.5, 0.5, 0.6).translate(0, 1.3, 1.05),
    ...[[-0.28, -0.6], [0.28, -0.6], [-0.28, 0.6], [0.28, 0.6]].map(([x, z]) => new THREE.BoxGeometry(0.18, 0.7, 0.18).translate(x, 0.35, z)),
  ];
  return mergeGeometries(parts);
}
function sheepGeo() {
  return mergeGeometries([
    new THREE.BoxGeometry(0.62, 0.55, 1.0).translate(0, 0.7, 0),
    new THREE.BoxGeometry(0.26, 0.3, 0.34).translate(0, 0.86, 0.6),
    ...[[-0.2, -0.32], [0.2, -0.32], [-0.2, 0.32], [0.2, 0.32]].map(([x, z]) => new THREE.BoxGeometry(0.1, 0.45, 0.1).translate(x, 0.22, z)),
  ]);
}
function pigGeo() {
  return mergeGeometries([
    new THREE.BoxGeometry(0.6, 0.5, 1.15).translate(0, 0.5, 0),
    new THREE.BoxGeometry(0.42, 0.38, 0.3).translate(0, 0.56, 0.7),
    new THREE.BoxGeometry(0.2, 0.16, 0.08).translate(0, 0.5, 0.88),
    ...[[-0.2, -0.38], [0.2, -0.38], [-0.2, 0.38], [0.2, 0.38]].map(([x, z]) => new THREE.BoxGeometry(0.12, 0.28, 0.12).translate(x, 0.14, z)),
  ]);
}
function henGeo() {
  return mergeGeometries([
    new THREE.BoxGeometry(0.28, 0.26, 0.4).translate(0, 0.28, 0),
    new THREE.BoxGeometry(0.16, 0.18, 0.16).translate(0, 0.45, 0.2),
    new THREE.BoxGeometry(0.06, 0.2, 0.06).translate(0, 0.1, 0),
  ]);
}

function makeHerd(geo, n, pen, colors, speed, seed) {
  const R = rng(seed), mesh = new THREE.InstancedMesh(geo, M('#ffffff'), n);
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  const pal = colors.map(col), a = [];
  const inside = () => ({ x: pen.x0 + 2 + R() * (pen.x1 - pen.x0 - 4), z: pen.z0 + 2 + R() * (pen.z1 - pen.z0 - 4) });
  for (let i = 0; i < n; i++) {
    const p = inside(), t = inside();
    a.push({ x: p.x, z: p.z, h: R() * 6.28, tx: t.x, tz: t.z, wait: R() * 5 });
    mesh.setColorAt(i, pal[i % pal.length]);
  }
  const dummy = new THREE.Object3D();
  return {
    mesh,
    /** Moves the first `count` animals (the herd's head count, up to the building's size). */
    update(dt, count = n) {
      mesh.count = Math.min(n, count);
      for (let i = 0; i < mesh.count; i++) {
        const an = a[i];
        if (an.wait > 0) an.wait -= dt;
        else {
          const dx = an.tx - an.x, dz = an.tz - an.z, d = Math.hypot(dx, dz);
          if (d < 0.3) { const t = inside(); an.tx = t.x; an.tz = t.z; an.wait = 2 + R() * 8; }
          else {
            an.h = Math.atan2(dx, dz);
            const step = Math.min(d, speed * dt);
            an.x += (dx / d) * step; an.z += (dz / d) * step;
          }
        }
        dummy.position.set(an.x, 0, an.z); dummy.rotation.set(0, an.h, 0); dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

/* ---------- slurry pit and manure heap (always there; animals fill them) ---------- */
function buildDung(markers) {
  const g = new THREE.Group(), concrete = MT('#b9b7ad', 'concrete'), { x, z, r } = SLURRY_PIT;
  // round concrete pit with a rim and a ladder, the slurry surface rises with the level
  CY(r, r, 2.2, 28, concrete, x, 1.1, z, g);
  CY(r + 0.15, r + 0.15, 0.2, 28, MT('#a8a69c', 'concrete'), x, 2.25, z, g);
  for (let k = 0; k < 6; k++) B(0.05, 0.05, 0.4, F(), x + r + 0.12, 0.3 + k * 0.38, z, g);
  B(1.2, 0.2, 2.4, F(), x + r + 0.6, 0.1, z, g); // pump stand by the filling ring
  CY(0.12, 0.12, 2.6, 8, F(), x + r + 0.5, 1.3, z + 0.7, g);
  circles.push({ x, z, r: r + 0.2 });
  const surf = mk(new THREE.CircleGeometry(r - 0.1, 28), M('#5a4a2e', { roughness: 0.3, flatShading: false }), x, 0.2, z, null, false);
  surf.rotation.x = -Math.PI / 2; surf.userData.noBake = true;
  // manure heap: a concrete pad with walls on three sides, the heap grows with the amount
  const m = MANURE_HEAP;
  B(10, 0.2, 7, concrete, m.x, 0.1, m.z, g);
  B(10, 1.4, 0.3, concrete, m.x, 0.8, m.z + 3.35, g);
  for (const sx of [-1, 1]) B(0.3, 1.4, 7, concrete, m.x + sx * 4.85, 0.8, m.z, g);
  boxes.push({ x0: m.x - 5, x1: m.x + 5, z0: m.z + 3.1, z1: m.z + 3.6 }, { x0: m.x - 5, x1: m.x - 4.6, z0: m.z - 3.5, z1: m.z + 3.5 }, { x0: m.x + 4.6, x1: m.x + 5, z0: m.z - 3.5, z1: m.z + 3.5 });
  const heap = mk(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M('#4a3a26', { roughness: 1 }), m.x, 0.2, m.z + 0.6, null);
  heap.userData.noBake = true; heap.scale.set(4.2, 0.01, 2.8);
  scene.add(bake(g), surf, heap);
  ring(SLURRY_PIT.fill, '#8a6a3a', markers); ring(MANURE_HEAP.fill, '#5a4630', markers);
  return {
    update() {
      const s = G.farm.slurry / DUNG.slurryCap, h = G.farm.manure / DUNG.manureCap;
      surf.position.y = 0.25 + s * 1.85;
      heap.visible = h > 0.005; heap.scale.y = 0.2 + h * 2.2; heap.scale.x = 2.6 + h * 1.8; heap.scale.z = 1.8 + h * 1.2;
    },
  };
}

/** Pallets of eggs, wool and tomatoes waiting by the hen house, the sheep fold and the greenhouses (shown by count). */
function buildPalletStacks() {
  const geo = new THREE.BoxGeometry(1.05, 1.0, 1.15).translate(0, 0.5, 0), stacks = [];
  for (const p of Object.keys(PALLETS)) {
    const meshes = [];
    for (let k = 0; k < PALLET.maxStack; k++) {
      const m = mk(geo, PALLET_MAT[p], 0, 0, 0, null);
      m.visible = false; scene.add(m); meshes.push(m);
    }
    stacks.push({ p, meshes });
  }
  return {
    update() {
      for (const { p, meshes } of stacks) {
        const at = PALLETS[p].at(), n = at ? Math.min(PALLET.maxStack, palletsReady(p)) : 0;
        meshes.forEach((m, k) => {
          m.visible = k < n;
          if (!m.visible) return;
          // in a row beside the ring, two high
          const x = at.x + at.r + 1.0 + Math.floor(k / 2) * 1.2, z = at.z - 0.6, y = groundH(x, z) + (k % 2) * 1.0;
          m.position.set(x, y, z);
        });
      }
    },
  };
}

/* ---------- sawmill (always there) ---------- */
function buildSawmill(st) {
  const { x, z } = SAWMILL, g = new THREE.Group(); g.position.set(x, groundH(x, z), z); st.add(g);
  B(16, 5, 10, MT('#b9a07c', 'wood'), -16, 2.5, 8, g);
  gableRoof(g, 16, 10, 5, -16, 8, '#6c777d');
  for (let k = 0; k < 3; k++) for (let j = 0; j < 4; j++) {
    const lg = CY(0.35, 0.35, 5, 8, '#a5784f', -22 + j * 0.75, 0.35 + k * 0.62, -4, g);
    lg.rotation.x = Math.PI / 2;
  }
  boxes.push({ x0: x - 24, x1: x - 8, z0: z + 3, z1: z + 13 });
  circles.push({ x: x - 20.9, z: z - 4, r: 2.8 });
}

export function buildFarmstead() {
  const st = new THREE.Group();
  buildSawmill(st);
  scene.add(bake(st));
  const markers = new THREE.Group(); scene.add(markers);
  ring(SAWMILL, '#8a6a4a', markers);

  groups.cows = bake(buildCows());
  groups.hens = bake(buildHens());
  groups.sheep = bake(buildSheep());
  groups.pigs = bake(buildPigs());
  groups.mixer = bake(buildMixer());
  for (const gh of GREENHOUSES) groups[gh.key] = bake(buildGreenhouse(gh));
  // a pen moved in the map editor onto a hill stands on its own terrace: lift the whole group
  const lift = { cows: COW_PEN, hens: HEN_RUN, sheep: SHEEP_PEN, pigs: PIG_PEN };
  const yOf = p => groundH((p.x0 + p.x1) / 2, (p.z0 + p.z1) / 2);
  for (const k in lift) groups[k].position.y = yOf(lift[k]);
  groups.mixer.position.y = groundH(MIXER_AT.x, MIXER_AT.z);
  for (const k in groups) { groups[k].visible = false; scene.add(groups[k]); }
  const rings = {
    cows: ring(COW_PEN.feed, '#7fa653', markers), hens: ring(HEN_RUN.feed, '#e0b13a', markers),
    water: ring(GREENHOUSE_WATER, '#6fb0c8', markers), milk: ring(MILK_LOAD, '#f2efe6', markers),
    sheep: ring(SHEEP_PEN.feed, '#d9d4c4', markers), pigs: ring(PIG_PEN.feed, '#e7a3a0', markers),
  };
  const cows = makeHerd(cowGeo(), HERD.cows.cap, COW_PEN, ['#f2efe6', '#5b4636', '#8a5a3c', '#2f2f2f'], 0.35, 11);
  const hens = makeHerd(henGeo(), HERD.hens.cap, HEN_RUN, ['#f4f1ea', '#b9733e', '#8a5a3c'], 0.8, 23);
  const sheep = makeHerd(sheepGeo(), HERD.sheep.cap, SHEEP_PEN, ['#ece6d8', '#e4dccb', '#f2eee4', '#3a3330'], 0.3, 37);
  const pigs = makeHerd(pigGeo(), HERD.pigs.cap, PIG_PEN, ['#e8b4a8', '#e2a99c', '#d99a8e', '#c48a7a'], 0.3, 41);
  scene.add(cows.mesh, hens.mesh, sheep.mesh, pigs.mesh);
  const herds = { cows, hens, sheep, pigs };
  for (const k in herds) herds[k].mesh.position.y = yOf(lift[k]);
  const dung = buildDung(markers), stacks = buildPalletStacks();
  let slowT = 0;

  return {
    /** Shows a building and turns its collisions on or off. */
    setOwned(key, on) {
      owned[key] = on;
      if (groups[key]) groups[key].visible = on;
      for (const b of boxes) if (b.owner === key) b.off = !on;
      if (herds[key]) { herds[key].mesh.visible = on; rings[key].visible = on; }
      if (key === 'cows') rings.milk.visible = on;
      rings.water.visible = !!(owned.greenhouse1 || owned.greenhouse2);
    },
    update(dt) {
      for (const k in herds) if (owned[k]) herds[k].update(dt, herd(k).n);
      if ((slowT -= dt) > 0) return;
      slowT = 0.5;
      dung.update();
      stacks.update();
    },
  };
}
