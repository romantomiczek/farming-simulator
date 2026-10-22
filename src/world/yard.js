import * as THREE from 'three';
import { M, MT, B, CY, mk } from '../render/materials.js';
import { rng } from '../core/util.js';
import { addBox, circles } from './layout.js';

/**
 * Small things that make the farmyard look used: stacked pallets, IBC tanks in their cages, a pile
 * of old tyres, small square bales and a picket fence round the farmhouse garden. All static, merged
 * with the yard by bake(); they stand where no machine drives or parks (the implement row behind the
 * shed and the rings stay free) and block vehicles like the buildings do.
 */
const wood = () => MT('#b08d62', 'wood'), woodDark = () => MT('#8a6c4c', 'wood');

/** Euro pallet 1.2 × 0.8 m lying with its top at y + 0.144. */
function pallet(g, x, y, z, ry, r) {
  const p = new THREE.Group(); p.position.set(x, y, z); p.rotation.y = ry + (r() - 0.5) * 0.08; p.userData.static = true; g.add(p);
  const w = r() < 0.3 ? woodDark() : wood();
  for (let k = 0; k < 5; k++) B(1.2, 0.022, 0.1, w, 0, 0.133, -0.35 + k * 0.175, p); // top boards
  for (const dz of [-0.35, 0, 0.35]) for (const dx of [-0.5, 0, 0.5]) B(0.14, 0.078, 0.1, w, dx, 0.083, dz, p); // blocks
  for (const dz of [-0.35, 0, 0.35]) B(1.2, 0.022, 0.1, w, 0, 0.011, dz, p); // bottom boards
}
function palletStack(g, x, z, n, ry, r) { for (let k = 0; k < n; k++) pallet(g, x, k * 0.144, z, ry, r); }

/** IBC tank (1000 l): white tank in a steel cage on a pallet, filler cap and outlet tap. */
function ibc(g, x, z, ry) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.rotation.y = ry; p.userData.static = true; g.add(p);
  B(1.2, 0.15, 1.0, M('#2c2f31', { roughness: 0.8 }), 0, 0.075, 0, p);
  B(1.12, 0.95, 0.92, M('#e9ece6', { roughness: 0.45 }), 0, 0.64, 0, p);
  const steel = M('#a3abb0', { roughness: 0.4, metalness: 0.6 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(0.04, 1.0, 0.04, steel, sx * 0.58, 0.65, sz * 0.48, p);
  for (const y of [0.18, 0.5, 0.82, 1.14]) { for (const sz of [-1, 1]) B(1.18, 0.025, 0.025, steel, 0, y, sz * 0.48, p); for (const sx of [-1, 1]) B(0.025, 0.025, 0.98, steel, sx * 0.58, y, 0, p); }
  for (let k = -2; k <= 2; k++) for (const sz of [-1, 1]) B(0.025, 1.0, 0.025, steel, k * 0.23, 0.65, sz * 0.48, p);
  CY(0.12, 0.12, 0.06, 10, M('#3b6fa0', { roughness: 0.6 }), 0, 1.15, 0, p);
  CY(0.05, 0.05, 0.12, 8, M('#3a3d40'), 0.2, 0.3, 0.52, p).rotation.x = Math.PI / 2;
}

/** Old tyres, some lying in a pile, one leaning against it. */
function tyres(g, x, z, n, r) {
  const rub = M('#26282a', { roughness: 0.95, flatShading: false }), geo = new THREE.TorusGeometry(0.5, 0.2, 8, 18);
  for (let k = 0; k < n; k++) {
    const t = mk(geo, rub, x + (r() - 0.5) * 0.15, 0.2 + k * 0.36, z + (r() - 0.5) * 0.15, g);
    t.rotation.set(Math.PI / 2 + (r() - 0.5) * 0.12, 0, (r() - 0.5) * 0.12);
  }
  const lean = mk(geo, rub, x + 0.95, 0.6, z, g); lean.rotation.set(0.1, Math.PI / 2, 0.35);
}

/** Small square bales stacked in a block, w × d bales, h layers. */
function squareBales(g, x, z, w, d, h, r) {
  const mat = M('#d9c27a', { roughness: 1 });
  for (let k = 0; k < h; k++) for (let i = 0; i < w - (k === h - 1 ? 1 : 0); i++) for (let j = 0; j < d; j++) {
    const b = B(0.9, 0.38, 0.46, mat, x + i * 0.92 + (k % 2) * 0.2, 0.19 + k * 0.38, z + j * 0.48, g);
    b.rotation.y = (r() - 0.5) * 0.06;
  }
}

/** Picket fence from (x0, z0) to (x1, z1) with a gap of gap metres in the middle (a gate). */
function picket(g, x0, z0, x1, z1, gap = 0) {
  const L = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / L, uz = (z1 - z0) / L, ry = Math.atan2(ux, uz), w = MT('#e9e2d2', 'wood');
  for (let s = 0.05; s < L; s += 0.16) {
    if (gap && Math.abs(s - L / 2) < gap / 2) continue;
    const p = B(0.08, 0.95, 0.025, w, x0 + ux * s, 0.475, z0 + uz * s, g); p.rotation.y = ry + Math.PI / 2;
  }
  for (const y of [0.3, 0.75]) {
    if (!gap) { const r = B(0.05, 0.07, L, w, (x0 + x1) / 2, y, (z0 + z1) / 2, g); r.rotation.y = ry; continue; }
    const half = (L - gap) / 2;
    for (const t of [half / 2, L - half / 2]) { const r = B(0.05, 0.07, half, w, x0 + ux * t, y, z0 + uz * t, g); r.rotation.y = ry; }
  }
}

export function buildYard(st) {
  const g = new THREE.Group(), r = rng(83);
  st.add(g);
  // west of the barn: pallets, three IBC tanks, a tyre pile and bales
  palletStack(g, -44.6, -32.6, 7, 0, r); palletStack(g, -44.6, -34.0, 4, 0.04, r); palletStack(g, -43.2, -33.3, 2, Math.PI / 2, r);
  ibc(g, -44.7, -36.4, 0); ibc(g, -43.4, -36.4, 0.05); ibc(g, -44.7, -37.6, -0.03);
  tyres(g, -43.3, -39.6, 4, r);
  squareBales(g, -45.4, -31.2, 3, 1, 3, r);
  addBox(-45.9, -41.9, -40.4, -30.6);
  // by the diesel tank: tyres and a pallet
  tyres(g, 2.8, -44.3, 3, r); pallet(g, 2.8, 0, -42.6, 0.3, r);
  circles.push({ x: 2.9, z: -44.2, r: 1.0 }, { x: 2.8, z: -42.6, r: 0.75 });
  // garden fence north of the farmhouse with a gate on the path
  picket(g, -39.2, -14.0, -35.1, -14.0); picket(g, -32.9, -14.0, -28.8, -14.0);
  picket(g, -39.2, -15.4, -39.2, -14.0); picket(g, -28.8, -15.4, -28.8, -14.0);
  addBox(-39.4, -35.0, -14.2, -13.8); addBox(-33.0, -28.6, -14.2, -13.8);
}
