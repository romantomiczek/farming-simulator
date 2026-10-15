import * as THREE from 'three';
import { mk, B, CY, bake, flatten } from '../render/materials.js';
import { rng } from '../core/util.js';
import { groundH } from './terrain.js';
import { gable, label, strip } from './buildings.js';
import { RAIL, STATION, PIT, CHAPEL, PONDS, WOOD_BUYERS, DAIRY, circles, addBox, roadAt } from './layout.js';
import { col } from '../core/util.js';
import { townBlocks } from '../ui/minimap.js';

/**
 * Everything in the new regions that is scenery or a place to sell: the town with its streets,
 * church, station and railway, the feed mill and the timber yard, the gravel pit, the chapel on the
 * hill, wayside crosses, pond dams, hunting stands and wood piles. Each region is its own static
 * root, flattened and merged by material (bake): a few draw calls each, and regions off screen are culled.
 */
const R = rng(404);
const WALLS = ['#efe6d6', '#e9d7b5', '#f1e2cf', '#dde3d6', '#f0dcc4', '#e6e6dc', '#efe1c9', '#e8d2c0'];
const ROOFS = ['#9a4f3e', '#6b5a52', '#a35a44', '#7b5a4e', '#5d6268', '#8a4c3c'];

/** A house at (x, z) with its front facing direction ry (0 = +z). Collision box and map block included. */
function house(st, x, z, ry, w, d, h = 4.2) {
  const g = new THREE.Group(); g.position.set(x, groundH(x, z), z); g.rotation.y = ry; st.add(g);
  const wall = WALLS[(R() * WALLS.length) | 0];
  gable(w, d, h, wall, ROOFS[(R() * ROOFS.length) | 0], g);
  for (const sx of [-w / 4, w / 4]) B(1.0, 1.0, 0.1, '#5d7d8c', sx, h * 0.6, d / 2 + 0.03, g);
  B(1.0, 2.0, 0.1, '#8a6a52', 0, 1.0, d / 2 + 0.03, g);
  if (R() < 0.5) B(0.7, 1.6, 0.7, '#b9a89a', w / 3, h + d * 0.36, 0, g); // chimney
  const along = Math.abs(Math.sin(ry)) < 0.5; // ridge along x
  const hx = along ? w / 2 : d / 2, hz = along ? d / 2 : w / 2;
  addBox(x - hx, x + hx, z - hz, z + hz);
  townBlocks.push({ x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz, col: '#e9ddc8' });
}

/** Houses along both sides of a straight street from a to b, skipping gaps (list of [from, to] along it). */
function street(st, ax, az, bx, bz, half, skip = []) {
  const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
  for (let d = 10; d < L - 6; d += 15 + R() * 4) {
    if (skip.some(([a, b]) => d > a && d < b)) continue;
    for (const side of [-1, 1]) {
      if (R() < 0.15) continue;
      const w = 8 + R() * 3, dep = 6.5 + R() * 1.5, off = half + 3 + dep / 2;
      const x = ax + ux * d + uz * off * side, z = az + uz * d - ux * off * side;
      if (roadAt(x, z, dep / 2 + 1)) continue;
      if (Math.hypot(x - DAIRY.x, z - DAIRY.z) < 16) continue; // the dairy's ring
      // the house sits at side·(uz, -ux) from the street; its front (local +z) points back at it
      house(st, x, z, Math.atan2(-side * uz, side * ux), w, dep);
    }
  }
}

function buildTown(st, scene) {
  const y0 = 0;
  // main road through the town, the northern and eastern streets
  street(st, 405, 48, 660, 48, 4, [[25, 45], [65, 85], [133, 160], [185, 205], [235, 260]]);
  street(st, 480, 56, 480, 160, 3, []);
  street(st, 600, 56, 600, 140, 3, []);
  // church with a tower on the little square
  const g = new THREE.Group(); g.position.set(540, y0, 100); g.rotation.y = Math.PI / 2; st.add(g);
  gable(14, 9, 7, '#f2ebdf', '#7b5a4e', g);
  B(4, 15, 4, '#f2ebdf', -8.8, 7.5, 0, g);
  const spire = mk(new THREE.ConeGeometry(3.2, 7, 4), '#5d6268', -8.8, 18.5, 0, g); spire.rotation.y = Math.PI / 4;
  B(1.2, 1.6, 0.1, '#5d7d8c', -8.8, 11, 2.05, g);
  addBox(535.5, 544.5, 86, 113);
  townBlocks.push({ x0: 535.5, x1: 544.5, z0: 86, z1: 113, col: '#f2ebdf' });
  // square
  strip([[520, 75], [560, 75]], -10, 10, 0.06, '#d8d2c4', st);
  label(scene, 'Městečko Lánov', 540, 3.2, 86.5 + 0.1, Math.PI);

  // feed mill: hall with a silo, ring on the main road
  B(16, 6, 9, '#d9dcd8', 548, 3, 10, st); B(16.6, 0.3, 9.6, '#6c777d', 548, 6.15, 10, st);
  CY(2.4, 2.4, 11, 14, '#e8e2c8', 560, 5.5, 4, st); mk(new THREE.ConeGeometry(2.5, 1.8, 14), '#c9b13a', 560, 11.9, 4, st);
  addBox(540, 556, 5.5, 14.5); circles.push({ x: 560, z: 4, r: 2.6 });
  townBlocks.push({ x0: 540, x1: 556, z0: 5.5, z1: 14.5, col: '#d9dcd8' });
  label(scene, 'Krmivárna', 548, 4.2, 14.6, 0);

  // dairy: white hall with a blue roof, two upright milk silos and the tank ring on the main road
  { const d = DAIRY, hx = d.x, hz = d.z - 18;
    B(15, 5.5, 9, '#f3f1ea', hx, 2.75, hz, st); B(15.6, 0.3, 9.6, '#4f6f8f', hx, 5.65, hz, st);
    B(3.2, 3.2, 0.12, '#9aa3a8', hx - 3, 1.6, hz + 4.53, st);
    for (const sz of [-1, 1]) for (const dx of [-6, -3.5, 1, 3.5, 6]) if (sz < 0 || dx > 0) B(1.4, 0.9, 0.1, '#5d7d8c', hx + dx, 3.8, hz + sz * 4.53, st);
    B(5, 3, 4, '#e6e8e4', hx - 9.5, 1.5, hz + 1, st); B(5.4, 0.25, 4.4, '#4f6f8f', hx - 9.5, 3.1, hz + 1, st); // office
    B(1.2, 0.9, 0.1, '#5d7d8c', hx - 9.5, 1.9, hz + 3.03, st);
    for (const dx of [5, 8.2]) { CY(1.4, 1.4, 9, 14, '#dde2e5', hx + dx + 4, 4.5, hz - 1, st); mk(new THREE.SphereGeometry(1.4, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#c9d0d4', hx + dx + 4, 9, hz - 1, st); circles.push({ x: hx + dx + 4, z: hz - 1, r: 1.5 }); }
    addBox(hx - 7.5, hx + 7.5, hz - 4.5, hz + 4.5); addBox(hx - 12, hx - 7, hz - 1, hz + 3);
    townBlocks.push({ x0: hx - 12, x1: hx + 7.5, z0: hz - 4.5, z1: hz + 4.5, col: '#f3f1ea' });
    label(scene, 'Mlékárna', hx + 2, 4.2, hz + 4.6, 0);
    const ring = new THREE.Mesh(new THREE.RingGeometry(d.r - 0.5, d.r, 40), new THREE.MeshBasicMaterial({ color: col('#f2efe6'), transparent: true, opacity: 0.8 }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(d.x, groundH(d.x, d.z) + 0.06, d.z); scene.add(ring); }

  // timber yard: log stacks and a hut
  const wb = WOOD_BUYERS[1];
  for (let k = 0; k < 3; k++) {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5 - r; c++) {
      const log = CY(0.35, 0.35, 6, 7, '#9b7a5a', wb.x - 14 + k * 9, 0.35 + r * 0.6, wb.z - 18 + c * 0.72 + r * 0.36, st); log.rotation.z = Math.PI / 2;
    }
    addBox(wb.x - 17 + k * 9, wb.x - 11 + k * 9, wb.z - 18.5, wb.z - 14);
  }
  B(5, 3, 4, '#c9a27a', wb.x + 12, 1.5, wb.z - 16, st); addBox(wb.x + 9.5, wb.x + 14.5, wb.z - 18, wb.z - 14);
  townBlocks.push({ x0: wb.x - 17, x1: wb.x + 15, z0: wb.z - 19, z1: wb.z - 13, col: '#b89a74' });
  label(scene, 'Dřevosklad', wb.x + 12, 3.6, wb.z - 13.9, 0);
}

function buildRailway(st, scene) {
  const pts = [[RAIL.x, RAIL.z0], [RAIL.x, RAIL.z1]];
  strip(pts, -2.2, 2.2, 0.1, '#a9a197', st);
  // sleepers and rails follow the ground
  for (let z = RAIL.z0 + 1; z < RAIL.z1; z += 1.4) {
    const y = groundH(RAIL.x, z);
    const s = B(2.6, 0.14, 0.32, '#6f5a48', RAIL.x, y + 0.2, z, st); s.castShadow = false;
  }
  for (const dx of [-0.72, 0.72]) strip(pts, dx - 0.05, dx + 0.05, 0.36, '#8c8f92', st);
  // station: building, platform with a canopy, grain silos by the buyer's ring
  const g = new THREE.Group(); g.position.set(STATION.x + 4, 0, STATION.z); g.rotation.y = -Math.PI / 2; st.add(g);
  gable(18, 8, 5.5, '#f0dcc4', '#8a4c3c', g);
  for (const sx of [-6, -2, 2, 6]) B(1.2, 1.6, 0.1, '#5d7d8c', sx, 3, 4.03, g);
  addBox(STATION.x, STATION.x + 8, STATION.z - 9, STATION.z + 9);
  townBlocks.push({ x0: STATION.x, x1: STATION.x + 8, z0: STATION.z - 9, z1: STATION.z + 9, col: '#f0dcc4' });
  strip([[RAIL.x - 3.4, STATION.z - 30], [RAIL.x - 3.4, STATION.z + 30]], -1.5, 1.5, 0.55, '#cfc8bb', st);
  for (let z = STATION.z - 24; z <= STATION.z + 24; z += 8) CY(0.1, 0.1, 3.2, 6, '#5d6268', RAIL.x - 3.4, 1.6, z, st);
  B(3.6, 0.2, 52, '#7b5a4e', RAIL.x - 3.4, 3.3, STATION.z, st);
  label(scene, 'Lánov', STATION.x + 4, 4.4, STATION.z, -Math.PI / 2);
  for (const [dx, dz] of [[-12, -16], [-4, -16], [4, -16]]) {
    const x = STATION.x + dx, z = 30 + dz;
    CY(3, 3, 12, 16, '#dfe1dc', x, 6, z, st); mk(new THREE.ConeGeometry(3.2, 2.2, 16), '#c9cdc7', x, 13.1, z, st);
    circles.push({ x, z, r: 3.2 });
  }
  townBlocks.push({ x0: STATION.x - 16, x1: STATION.x + 8, z0: 10, z1: 18, col: '#dfe1dc' });
  label(scene, 'Nádraží', STATION.x - 4, 3, 14 + 3.3, 0);
}

function buildPit(st) {
  // piles of gravel and sand on the floor, a conveyor and a parked excavator
  const piles = [[540, -360, 9, '#cbbfa4'], [570, -370, 7, '#d8c9a0'], [600, -345, 8, '#bfb29a'], [530, -320, 6, '#d8c9a0']];
  for (const [x, z, r, c] of piles) {
    mk(new THREE.ConeGeometry(r, r * 0.7, 9), c, x, groundH(x, z) + r * 0.35, z, st);
    circles.push({ x, z, r: r * 0.85 });
  }
  const yb = groundH(615, -330);
  const conv = B(1.2, 0.6, 26, '#c9a24a', 615, yb + 5, -318, st); conv.rotation.x = -0.33;
  for (const z of [-330, -318, -306]) CY(0.2, 0.2, 9, 6, '#6c777d', 615, yb + 2.5, z, st);
  circles.push({ x: 615, z: -318, r: 2 });
  const ex = new THREE.Group(); ex.position.set(575, groundH(575, -335), -335); ex.rotation.y = 0.7; st.add(ex);
  B(3, 0.8, 4.5, '#3a3f42', 0, 0.5, 0, ex); B(2.8, 2.4, 3, '#e0a640', 0, 2.1, -0.4, ex);
  const arm = B(0.6, 0.6, 6, '#e0a640', 0, 3.2, 3.2, ex); arm.rotation.x = -0.6;
  circles.push({ x: 575, z: -335, r: 3 });
  const hut = PIT.x0 + 6;
  B(6, 3, 4, '#b9bdb7', hut, groundH(hut, PIT.z1 + 8) + 1.5, PIT.z1 + 8, st);
  addBox(hut - 3, hut + 3, PIT.z1 + 6, PIT.z1 + 10);
}

function buildChapel(st) {
  const y = groundH(CHAPEL.x, CHAPEL.z);
  const g = new THREE.Group(); g.position.set(CHAPEL.x, y, CHAPEL.z); g.rotation.y = Math.PI; st.add(g);
  gable(6, 5, 3.6, '#f2ebdf', '#7b5a4e', g);
  B(2, 3, 2, '#f2ebdf', 0, 5.2, -1.2, g);
  const sp = mk(new THREE.ConeGeometry(1.6, 3, 4), '#5d6268', 0, 8.2, -1.2, g); sp.rotation.y = Math.PI / 4;
  B(0.15, 1.2, 0.15, '#3a3f42', 0, 10.2, -1.2, g); B(0.7, 0.15, 0.15, '#3a3f42', 0, 10.4, -1.2, g);
  B(1.0, 2.0, 0.1, '#8a6a52', 0, 1.0, 2.53, g);
  addBox(CHAPEL.x - 3.2, CHAPEL.x + 3.2, CHAPEL.z - 2.7, CHAPEL.z + 2.7);
  // lime trees around it are placed by the vegetation (the chapel area is kept clear)
}

/** Stone wayside crosses at crossroads in the fields. */
function buildCrosses(st) {
  for (const [x, z] of [[-22, 306], [176, 306], [11, -206], [-224, 41], [456, 306], [-136, -209]]) {
    const y = groundH(x, z);
    B(0.7, 1.6, 0.7, '#b9b2a6', x, y + 0.8, z, st);
    B(0.16, 1.4, 0.16, '#5d6268', x, y + 2.3, z, st); B(0.8, 0.16, 0.16, '#5d6268', x, y + 2.6, z, st);
    circles.push({ x, z, r: 0.6 });
  }
}

/** Dams on the south side of the fish ponds and a wooden jetty on the big one. */
function buildPonds(st) {
  for (const p of PONDS) {
    const z = p.z - p.rz - 3;
    const dam = B(p.rx * 1.3, 1.2, 5, '#8ea85c', p.x, groundH(p.x, z) + 0.2, z, st); dam.castShadow = false;
    B(1.4, 1.6, 1.4, '#8a8f88', p.x, groundH(p.x, z) + 1.0, z + 1, st); // outlet
  }
  const p = PONDS[0], jx = p.x + p.rx * 0.6, jz = p.z + p.rz * 0.75;
  B(1.6, 0.15, 8, '#9b7a5a', jx, 0.0, jz - 3, st);
  for (const dz of [-6, -3, 0]) for (const dx of [-0.7, 0.7]) CY(0.08, 0.08, 1.4, 5, '#7b6150', jx + dx, -0.6, jz + dz - 1, st);
}

/** Hunting stands at forest edges and stacks of wood by the forest plots. */
function buildForestBits(st) {
  for (const [x, z] of [[-158, -110], [-170, 210], [-150, 400], [-120, 120]]) {
    const y = groundH(x, z);
    for (const dx of [-0.8, 0.8]) for (const dz of [-0.8, 0.8]) CY(0.08, 0.1, 4.2, 5, '#7b6150', x + dx, y + 2.1, z + dz, st);
    B(2.2, 1.4, 2.2, '#8a6a4a', x, y + 4.7, z, st); B(2.6, 0.12, 2.6, '#5d4a3a', x, y + 5.5, z, st);
    circles.push({ x, z, r: 1.4 });
  }
  for (const [x, z] of [[-215, 70], [-264, -30]]) {
    const y = groundH(x, z);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6 - r; c++) {
      const log = CY(0.3, 0.3, 4, 7, '#9b7a5a', x, y + 0.3 + r * 0.52, z - 1.6 + c * 0.62 + r * 0.31, st); log.rotation.z = Math.PI / 2;
    }
    circles.push({ x, z, r: 2.4 });
  }
}

export function buildLandmarks(scene) {
  const region = fn => { const st = new THREE.Group(); fn(st); scene.add(bake(flatten(st))); };
  region(st => buildTown(st, scene));
  region(st => buildRailway(st, scene));
  region(buildPit);
  region(buildChapel);
  region(buildCrosses);
  region(buildPonds);
  region(buildForestBits);
}
