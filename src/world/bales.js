import * as THREE from 'three';
import { scene } from '../render/core.js';
import { M } from '../render/materials.js';
import { baleGeo } from '../vehicles/models.js';
import { groundH } from './terrain.js';

/**
 * Round bales lying on the fields, one instanced mesh per kind: straw (golden), hay (green-grey),
 * grass pressed fresh (green, has to be wrapped or it is worth little) and wrapped silage (dark film).
 */
const MAX = 160;
export const BALE_KINDS = ['straw', 'hay', 'grass', 'silage'];
const geo = baleGeo().translate(0, 0.75, 0);
const make = (hex, opts) => {
  const m = new THREE.InstancedMesh(geo, M(hex, opts), MAX);
  m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.count = 0;
  scene.add(m);
  return m;
};
const MESH = { straw: make('#e2c77d'), hay: make('#b9b77a'), grass: make('#7fa24a'), silage: make('#2f3a2c', { roughness: 0.35, flatShading: false }) };

/** Bales on the ground: { x, z, h, kind } (h = heading of the baler that dropped it); hay = kind 'hay' (older code and saves). */
export const bales = [];
let dirty = true;
const dummy = new THREE.Object3D();
const kindOf = (kind, hay) => (BALE_KINDS.includes(kind) ? kind : hay ? 'hay' : 'straw');

export function addBale(x, z, h, kind = 'straw') {
  if (bales.length >= MAX) return false;
  const k = kind === true ? 'hay' : kind === false ? 'straw' : kindOf(kind);
  bales.push({ x, z, h, kind: k, hay: k === 'hay' });
  dirty = true;
  return true;
}
export function removeBale(i) { bales.splice(i, 1); dirty = true; }
/** A grass bale wrapped into silage. */
export function wrapBale(b) { b.kind = 'silage'; b.hay = false; dirty = true; }
export function setBales(list) {
  bales.length = 0;
  for (const b of list || []) {
    if (!Number.isFinite(b.x) || !Number.isFinite(b.z) || bales.length >= MAX) continue;
    const k = kindOf(b.kind, b.hay);
    bales.push({ x: b.x, z: b.z, h: +b.h || 0, kind: k, hay: k === 'hay' });
  }
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
  const n = { straw: 0, hay: 0, grass: 0, silage: 0 };
  for (const b of bales) {
    dummy.position.set(b.x, groundH(b.x, b.z), b.z); dummy.rotation.set(0, b.h, 0); dummy.updateMatrix();
    MESH[b.kind].setMatrixAt(n[b.kind]++, dummy.matrix);
  }
  for (const k of BALE_KINDS) { MESH[k].count = n[k]; MESH[k].instanceMatrix.needsUpdate = true; }
}
