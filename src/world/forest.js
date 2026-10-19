import * as THREE from 'three';
import { scene } from '../render/core.js';
import { M } from '../render/materials.js';
import { rng } from '../core/util.js';
import { addSnow } from '../render/snow.js';
import { spruceCrown } from './treegeo.js';
import { FOREST_PLOTS } from './layout.js';
import { groundH } from './terrain.js';
import { WOOD } from '../game/balance.js';

/**
 * Spruce plantations (north of the fields and two in the western forest). Each tree grows 0..1 over GROW_DAYS game days;
 * from MATURE it can be felled by the harvester, then a sapling is planted in its place.
 * Two instanced meshes (trunks, crowns); standing trees above 0.3 block vehicles.
 */
const GROW_DAYS = WOOD.growDays;
export const MATURE = 0.85;
const R = rng(31);
export const trees = [];
// plots in order: the first one is the original plantation, so old saves keep their tree indexes
for (const P of FOREST_PLOTS) {
  for (let x = P.x0 + 4; x < P.x1 - 2; x += 8.5) {
    for (let z = P.z0 + 4; z < P.z1 - 2; z += 8.5) {
      const t = { x: x + (R() - 0.5) * 3, z: z + (R() - 0.5) * 3, g: 0.6 + R() * 0.4, fall: 0, dir: 0, s: 0.85 + R() * 0.3 };
      t.y = groundH(t.x, t.z);
      trees.push(t);
    }
  }
}
/** Wood volume of a tree in m³. */
export const volume = t => +(WOOD.treeM3 * t.g * t.g * t.s).toFixed(2);

const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 1, 6).translate(0, 0.5, 0);
const crownGeo = spruceCrown(1); // height 1 from y = 0, radius 1, like the trees around the map
const trunks = new THREE.InstancedMesh(trunkGeo, M('#5b4434'), trees.length);
const crowns = new THREE.InstancedMesh(crownGeo, addSnow(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.92 })), trees.length);
for (const m of [trunks, crowns]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); }
const dummy = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0), axis = new THREE.Vector3(), q = new THREE.Quaternion();

/** Redraws one tree: height from growth, tipped over while falling. */
function draw(i) {
  const t = trees[i], g = Math.max(0.12, t.g), h = 9 * g * t.s;
  dummy.position.set(t.x, t.y, t.z);
  if (t.fall > 0) { axis.set(Math.cos(t.dir), 0, -Math.sin(t.dir)); q.setFromAxisAngle(axis, Math.min(1, t.fall) * Math.PI / 2 * 0.98); dummy.quaternion.copy(q); }
  else dummy.quaternion.identity();
  dummy.scale.set(g * t.s, h * 0.45, g * t.s); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
  dummy.position.y = t.y;
  const m = new THREE.Matrix4().compose(dummy.position, dummy.quaternion, new THREE.Vector3(1, 1, 1));
  const local = new THREE.Matrix4().compose(new THREE.Vector3(0, h * 0.25, 0), new THREE.Quaternion(), new THREE.Vector3(2.1 * g * t.s, h * 0.8, 2.1 * g * t.s));
  crowns.setMatrixAt(i, m.multiply(local));
}
export function redrawForest() { trees.forEach((_, i) => draw(i)); trunks.instanceMatrix.needsUpdate = true; crowns.instanceMatrix.needsUpdate = true; }
redrawForest();

/** Grows every tree by dh game hours (mult = season factor). */
export function growForest(dh, mult) {
  if (dh <= 0) return;
  let changed = false;
  for (let i = 0; i < trees.length; i++) {
    const t = trees[i];
    if (t.g < 1 && !t.fall) { t.g = Math.min(1, t.g + (dh * mult) / (GROW_DAYS * 24)); changed = true; draw(i); }
  }
  if (changed) { trunks.instanceMatrix.needsUpdate = true; crowns.instanceMatrix.needsUpdate = true; }
}

/** Nearest tree ready to fell within maxDist of (x, z), or -1. */
export function nearestMature(x, z, maxDist) {
  let best = -1, bd = maxDist;
  trees.forEach((t, i) => { if (t.g >= MATURE && !t.fall) { const d = Math.hypot(t.x - x, t.z - z); if (d < bd) { bd = d; best = i; } } });
  return best;
}

/** Nearest standing tree (any size) within maxDist, or -1. */
export function nearestTree(x, z, maxDist) {
  let best = -1, bd = maxDist;
  trees.forEach((t, i) => { if (!t.fall) { const d = Math.hypot(t.x - x, t.z - z); if (d < bd) { bd = d; best = i; } } });
  return best;
}

/** Starts felling tree i away from (fromX, fromZ). */
export function startFell(i, fromX, fromZ) { const t = trees[i]; t.dir = Math.atan2(t.x - fromX, t.z - fromZ); t.fall = 0.001; }

/** Advances a falling tree; returns true when it is down (then a sapling replaces it). */
export function stepFell(i, dt) {
  const t = trees[i];
  t.fall += dt * 0.6;
  draw(i);
  trunks.instanceMatrix.needsUpdate = true; crowns.instanceMatrix.needsUpdate = true;
  if (t.fall < 1.15) return false;
  t.fall = 0; t.g = 0.05; draw(i);
  return true;
}

/** Collision circles of the standing trees near (x, z) within r (all of them when x is omitted). */
export function forestColliders(out, x, z, r = 0) {
  if (x != null && !FOREST_PLOTS.some(P => x > P.x0 - r && x < P.x1 + r && z > P.z0 - r && z < P.z1 + r)) return out;
  for (const t of trees) {
    if (t.g <= 0.3 || t.fall) continue;
    if (x != null && (Math.abs(t.x - x) > r + 2 || Math.abs(t.z - z) > r + 2)) continue;
    out.push({ x: t.x, z: t.z, r: Math.max(0.2, 0.42 * t.g * t.s) }); // the trunk
  }
  return out;
}

export const matureCount = () => trees.filter(t => t.g >= MATURE).length;
export const serializeForest = () => trees.map(t => +t.g.toFixed(3));
export function loadForest(list) {
  trees.forEach((t, i) => { t.fall = 0; t.g = Number.isFinite(list?.[i]) ? Math.min(1, Math.max(0.05, list[i])) : 0.6 + R() * 0.4; });
  redrawForest();
}
