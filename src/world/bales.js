import * as THREE from 'three';
import { scene } from '../render/core.js';
import { M } from '../render/materials.js';
import { baleGeo } from '../vehicles/models.js';
import { groundH } from './terrain.js';

// Round straw bales lying on the fields: one instanced mesh, positions in `bales`.
const MAX = 160;
const geo = baleGeo().translate(0, 0.75, 0);
const mesh = new THREE.InstancedMesh(geo, M('#e2c77d'), MAX);
mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.count = 0;
scene.add(mesh);

/** Bales on the ground: { x, z, h } (h = heading of the baler that dropped it). */
export const bales = [];
let dirty = true;
const dummy = new THREE.Object3D();

export function addBale(x, z, h) {
  if (bales.length >= MAX) return false;
  bales.push({ x, z, h });
  dirty = true;
  return true;
}
export function removeBale(i) { bales.splice(i, 1); dirty = true; }
export function setBales(list) {
  bales.length = 0;
  for (const b of list || []) if (Number.isFinite(b.x) && Number.isFinite(b.z) && bales.length < MAX) bales.push({ x: b.x, z: b.z, h: +b.h || 0 });
  dirty = true;
}

const BALE_R = 0.8;
/** A vehicle (circle at x, z with radius r) shoves bales out of its way. */
export function pushBales(x, z, r) {
  for (const b of bales) {
    const dx = b.x - x, dz = b.z - z, d = Math.hypot(dx, dz), m = r + BALE_R;
    if (d >= m || d < 1e-4) continue;
    b.x += (dx / d) * (m - d); b.z += (dz / d) * (m - d);
    dirty = true;
  }
}

export function flushBales() {
  if (!dirty) return;
  dirty = false;
  bales.forEach((b, i) => {
    dummy.position.set(b.x, groundH(b.x, b.z), b.z); dummy.rotation.set(0, b.h, 0); dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.count = bales.length;
  mesh.instanceMatrix.needsUpdate = true;
}
