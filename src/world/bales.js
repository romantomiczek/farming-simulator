import * as THREE from 'three';
import { scene } from '../render/core.js';
import { M } from '../render/materials.js';
import { baleGeo } from '../vehicles/models.js';
import { groundH } from './terrain.js';

// Round bales lying on the fields: straw (golden) and hay (green-grey), one instanced mesh each.
const MAX = 160;
const geo = baleGeo().translate(0, 0.75, 0);
const make = hex => {
  const m = new THREE.InstancedMesh(geo, M(hex), MAX);
  m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.count = 0;
  scene.add(m);
  return m;
};
const strawMesh = make('#e2c77d'), hayMesh = make('#b9b77a');

/** Bales on the ground: { x, z, h, hay } (h = heading of the baler that dropped it). */
export const bales = [];
let dirty = true;
const dummy = new THREE.Object3D();

export function addBale(x, z, h, hay = false) {
  if (bales.length >= MAX) return false;
  bales.push({ x, z, h, hay: !!hay });
  dirty = true;
  return true;
}
export function removeBale(i) { bales.splice(i, 1); dirty = true; }
export function setBales(list) {
  bales.length = 0;
  for (const b of list || []) if (Number.isFinite(b.x) && Number.isFinite(b.z) && bales.length < MAX) bales.push({ x: b.x, z: b.z, h: +b.h || 0, hay: !!b.hay });
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
  let ns = 0, nh = 0;
  for (const b of bales) {
    dummy.position.set(b.x, groundH(b.x, b.z), b.z); dummy.rotation.set(0, b.h, 0); dummy.updateMatrix();
    if (b.hay) hayMesh.setMatrixAt(nh++, dummy.matrix); else strawMesh.setMatrixAt(ns++, dummy.matrix);
  }
  strawMesh.count = ns; hayMesh.count = nh;
  strawMesh.instanceMatrix.needsUpdate = true; hayMesh.instanceMatrix.needsUpdate = true;
}
