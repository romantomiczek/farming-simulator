import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M, mk, B, CY, flatPlane, bake, flatten } from '../render/materials.js';
import { col } from '../core/util.js';
import { groundH, WATER_Y, POND_Y } from './terrain.js';
import { ROADS, PAD, POND, HOUSES, CHURCH, RIVER, RIVER_HALF, BRIDGES, FORD, PONDS, TURBINES, baleZone, fuelZone, circles, addBox } from './layout.js';
import { MARKETS } from '../game/markets.js';
import { buildLandmarks } from './landmarks.js';
import { WOOD_BUYERS } from './layout.js';

/** House-shaped body: walls, triangular gables and a two-sided roof. Ridge runs along x. */
export function gable(w, d, h, wall, roof, parent) {
  B(w, h, d, wall, 0, h / 2, 0, parent);
  const rh = d * 0.36;
  const s = new THREE.Shape();
  s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, rh); s.lineTo(-d / 2, 0);
  const pg = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false });
  pg.rotateY(Math.PI / 2);
  pg.translate(-w / 2, h, 0);
  mk(pg, wall, 0, 0, 0, parent);
  const ang = Math.atan2(rh, d / 2), L = Math.hypot(d / 2, rh) + 0.5;
  for (const sg of [1, -1]) {
    const r = B(w + 0.8, 0.26, L, roof, 0, 0, 0, parent);
    r.rotation.x = sg * ang;
    r.position.set(0, h + rh / 2 + Math.cos(ang) * 0.14, sg * (d / 4 + Math.sin(ang) * 0.14 + 0.1));
  }
}

/**
 * A strip along polyline pts, from offset a to offset b across it (negative = left), draped over
 * the ground (lift metres above it). Samples every ~2.5 m so it follows the terrain triangles.
 */
export function strip(pts, a, b, lift, hex, parent, yFn = groundH) {
  const pos = [];
  const pt = (x, z, nx, nz, o) => { const px = x + nx * o, pz = z + nz * o; return [px, yFn(px, pz) + lift, pz]; };
  for (let k = 1; k < pts.length; k++) {
    const [x0, z0] = pts[k - 1], [x1, z1] = pts[k], L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / 2.5));
    const nx = (z1 - z0) / L, nz = -(x1 - x0) / L; // left normal (looking along the road)
    // extend each segment a little so joints have no gaps
    const ex = ((x1 - x0) / L) * Math.max(Math.abs(a), Math.abs(b)) * 0.5, ez = ((z1 - z0) / L) * Math.max(Math.abs(a), Math.abs(b)) * 0.5;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const sx0 = x0 + (x1 - x0) * t0 - (i === 0 && k > 1 ? ex : 0), sz0 = z0 + (z1 - z0) * t0 - (i === 0 && k > 1 ? ez : 0);
      const sx1 = x0 + (x1 - x0) * t1, sz1 = z0 + (z1 - z0) * t1;
      const p0a = pt(sx0, sz0, nx, nz, a), p0b = pt(sx0, sz0, nx, nz, b), p1a = pt(sx1, sz1, nx, nz, a), p1b = pt(sx1, sz1, nx, nz, b);
      pos.push(...p0a, ...p0b, ...p1b, ...p0a, ...p1b, ...p1a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  // keep faces pointing up whichever way the strip was wound
  const nrm = g.attributes.normal;
  if (nrm.count && nrm.getY(0) < 0) { for (let i = 0; i < pos.length; i += 9) { for (let c = 0; c < 3; c++) { const t = pos[i + 3 + c]; pos[i + 3 + c] = pos[i + 6 + c]; pos[i + 6 + c] = t; } } g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); }
  const m = new THREE.Mesh(g, M(hex, { flatShading: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Gravel roads with two wheel ruts, field tracks with grass in the middle. */
function road(r, parent) {
  const h = r.w / 2;
  if (r.kind === 'road') {
    strip(r.pts, -h, h, 0.07, '#d8c59f', parent);
    strip(r.pts, -h * 0.55, -h * 0.25, 0.09, '#c7b186', parent);
    strip(r.pts, h * 0.25, h * 0.55, 0.09, '#c7b186', parent);
  } else {
    strip(r.pts, -h, h, 0.07, '#cbb48a', parent);
    strip(r.pts, -0.45, 0.45, 0.09, '#98b25e', parent);
  }
}

/** River water, the ponds, bridges and the collision shapes that keep vehicles out of the water. */
function buildWater(st) {
  const water = { flatShading: false, roughness: 0.25, metalness: 0.1 };
  strip(RIVER, -(RIVER_HALF - 0.6), RIVER_HALF - 0.6, 0, '#7fb0bf', st, () => WATER_Y);
  for (const p of PONDS) {
    const w = mk(new THREE.CircleGeometry(1, 40), M('#86b8c6', water), p.x, POND_Y, p.z, st, false);
    w.rotation.x = -Math.PI / 2; w.scale.set(p.rx * 0.88, p.rz * 0.88, 1);
    // collision: circles filling the ellipse, shrunk so the shore stays drivable
    const n = Math.ceil((p.rx * 2) / 8);
    for (let k = 0; k <= n; k++) {
      const x = p.x - p.rx * 0.75 + (k / n) * p.rx * 1.5, rz = p.rz * Math.sqrt(Math.max(0, 1 - ((x - p.x) / p.rx) ** 2)) * 0.75;
      if (rz > 2) circles.push({ x, z: p.z, r: rz });
    }
    // reeds along the shore
    for (let a = 0; a < 6.28; a += 0.35) {
      const x = p.x + Math.cos(a) * p.rx * 0.86, z = p.z + Math.sin(a) * p.rz * 0.86;
      const reed = CY(0.5, 0.7, 1.6, 5, '#7f9a52', x, POND_Y + 0.6, z, st); reed.castShadow = false;
    }
  }
  for (const b of BRIDGES) {
    const g = new THREE.Group(); g.position.set(b.x, 0, b.z); g.rotation.y = b.along === 'x' ? 0 : Math.PI / 2; st.add(g);
    B(b.len, 0.5, b.w, '#a9a59a', 0, 0.1, 0, g);
    for (const s of [-1, 1]) {
      B(b.len, 0.12, 0.15, '#7b6150', 0, 1.15, s * (b.w / 2 - 0.1), g);
      for (let k = -b.len / 2 + 1; k <= b.len / 2 - 1; k += 2.5) B(0.15, 1.0, 0.15, '#7b6150', k, 0.6, s * (b.w / 2 - 0.1), g);
    }
    for (const s of [-1, 1]) CY(0.6, 0.7, 3, 8, '#9d988c', s * 3, -1.2, 0, g);
    // railings block the sides
    for (const s of [-1, 1]) {
      if (b.along === 'x') addBox(b.x - b.len / 2, b.x + b.len / 2, b.z + s * (b.w / 2) - 0.2, b.z + s * (b.w / 2) + 0.2);
      else addBox(b.x + s * (b.w / 2) - 0.2, b.x + s * (b.w / 2) + 0.2, b.z - b.len / 2, b.z + b.len / 2);
    }
  }
  // the river blocks vehicles except on the bridges and at the ford
  for (let k = 1; k < RIVER.length; k++) {
    const [x0, z0] = RIVER[k - 1], [x1, z1] = RIVER[k], L = Math.hypot(x1 - x0, z1 - z0);
    for (let d = 0; d < L; d += 4) {
      const x = x0 + ((x1 - x0) * d) / L, z = z0 + ((z1 - z0) * d) / L;
      if (BRIDGES.some(b => Math.hypot(x - b.x, z - b.z) < b.len / 2 + 2)) continue;
      if (Math.hypot(x - FORD.x, z - FORD.z) < FORD.r) continue;
      circles.push({ x, z, r: RIVER_HALF - 2.5 });
    }
  }
}

/** Builds the farmyard, roads, pond and wind turbines. Returns the turbine rotors to animate. */
export function buildFarm(scene) {
  // separate static roots, each merged by material: off-screen regions are culled as a whole
  const st = new THREE.Group(), lines = new THREE.Group(), towers = new THREE.Group(), village = new THREE.Group();

  // ground decals
  ROADS.forEach(r => road(r, lines));
  buildWater(lines);
  flatPlane(PAD.x1 - PAD.x0, PAD.z1 - PAD.z0, '#d3cec3', (PAD.x0 + PAD.x1) / 2, 0.03, (PAD.z0 + PAD.z1) / 2, st);
  const rim = mk(new THREE.CircleGeometry(POND.r + 1.5, 28), M('#d8cfa6', { flatShading: false, roughness: 1 }), POND.x, 0.03, POND.z, st, false);
  rim.rotation.x = -Math.PI / 2;
  const water = mk(new THREE.CircleGeometry(POND.r - 0.2, 28), M('#86b8c6', { flatShading: false, roughness: 0.25, metalness: 0.1 }), POND.x, 0.05, POND.z, st, false);
  water.rotation.x = -Math.PI / 2;
  circles.push({ x: POND.x, z: POND.z, r: POND.r - 0.5 });

  // barn
  { const g = new THREE.Group(); g.position.set(-32, 0, -36); st.add(g);
    gable(14, 10, 6, '#c4614e', '#5d6268', g);
    B(0.12, 4.4, 4.2, '#f2ebdf', 7.06, 2.2, 0, g);
    for (const sg of [1, -1]) { const br = B(0.14, 0.22, 5.6, '#f2ebdf', 7.1, 2.2, 0, g); br.rotation.x = sg * Math.atan2(4.4, 4.2); }
    B(0.12, 0.9, 1.4, '#f2ebdf', 7.06, 7.0, 0, g);
    addBox(-39.2, -24.8, -41.2, -30.8); }

  // farmhouse with a flower bed
  { const g = new THREE.Group(); g.position.set(-34, 0, -19); st.add(g);
    gable(9, 7, 4.2, '#efe6d6', '#7b5a4e', g);
    for (const x of [-2.8, 0.2, 2.8]) B(1.1, 1.1, 0.1, '#5d7d8c', x, 2.6, 3.52, g);
    B(1.1, 2.1, 0.1, '#8a6a52', -1.4, 1.05, 3.52, g);
    B(0.8, 2.2, 0.8, '#b9a89a', 2.6, 6.2, -1, g);
    for (let i = 0; i < 9; i++) { const b = mk(new THREE.IcosahedronGeometry(0.55, 0), i % 3 ? '#7fa653' : '#e48a7a', -4 + i * 1.05, 0.45, 4); b.scale.y = 0.8; g.add(b); }
    addBox(-38.6, -29.4, -22.6, -15.4); }

  // machine shed, open towards the fields (+z)
  B(16.4, 5.2, 0.4, '#a7afb0', 12, 2.6, -45, st);
  B(0.4, 5.2, 10, '#a7afb0', 4, 2.6, -40, st);
  B(0.4, 5.2, 10, '#a7afb0', 20, 2.6, -40, st);
  const roof = B(17.4, 0.3, 11.4, '#6c777d', 12, 5.45, -40, st); roof.rotation.x = -0.05;
  flatPlane(15.4, 10.6, '#c5c0b4', 12, 0.04, -39.6, st);
  addBox(3.7, 20.3, -45.3, -44.7); addBox(3.7, 4.3, -45, -35); addBox(19.7, 20.3, -45, -35);

  // silos, conveyor and the intake canopy
  for (const [x, z] of [[15, -19], [21.5, -19]]) {
    CY(3, 3, 13, 18, '#dfe1dc', x, 6.5, z, st);
    for (let k = 1; k < 5; k++) CY(3.05, 3.05, 0.18, 18, '#b9bdb7', x, k * 2.7, z, st);
    mk(new THREE.ConeGeometry(3.2, 2.4, 18), '#c9cdc7', x, 14.2, z, st);
    circles.push({ x, z, r: 3.2 });
  }
  const conv = B(0.7, 0.7, 15.5, '#c9a24a', 9.8, 7.4, -21.5, st);
  conv.lookAt(15, 13.5, -19);
  for (const [x, z] of [[0.6, -28.4], [9.4, -28.4], [0.6, -19.6], [9.4, -19.6]]) {
    CY(0.18, 0.18, 6.8, 8, '#6c777d', x, 3.4, z, st);
    circles.push({ x, z, r: 0.35 });
  }
  B(10, 0.3, 10, '#5f8d8a', 5, 6.9, -24, st);
  flatPlane(4, 6, '#4a4f52', 5, 0.045, -24, st);
  for (let k = 0; k < 6; k++) flatPlane(3.6, 0.12, '#7b8286', 5, 0.05, -26.5 + k, st);

  // round bales and a water tank
  for (const [x, y] of [[-23, 0.75], [-21.5, 0.75], [-20, 0.75], [-22.25, 2.05], [-20.75, 2.05]]) {
    const b = CY(0.75, 0.75, 1.3, 14, '#e2c77d', x, y, -46, st); b.rotation.z = Math.PI / 2;
  }
  circles.push({ x: -21.5, z: -46, r: 2.6 });
  B(3.2, 1.6, 1.6, '#7a9fb4', -42, 0.8, -46, st); addBox(-43.6, -40.4, -46.8, -45.2);

  // diesel station: overhead tank on legs and a pump
  { const fx = fuelZone.x + 4.2, fz = fuelZone.z;
    const tank = CY(1.0, 1.0, 3.4, 14, '#c8553f', fx + 1.6, 2.6, fz, st); tank.rotation.x = Math.PI / 2;
    for (const dz of [-1.2, 1.2]) for (const dx of [-0.6, 0.6]) CY(0.07, 0.07, 1.6, 6, '#6c777d', fx + 1.6 + dx, 0.8, fz + dz, st);
    B(0.6, 1.5, 0.45, '#e8e4da', fx, 0.75, fz, st);
    B(0.62, 0.4, 0.47, '#c8553f', fx, 1.35, fz, st);
    circles.push({ x: fx + 0.8, z: fz, r: 1.6 }); }

  // wind turbine towers
  const rotors = [];
  for (const [x, z] of TURBINES) {
    const y0 = groundH(x, z) - 0.5;
    circles.push({ x, z, r: 1.6 });
    CY(0.7, 1.4, 46, 10, '#f2f1ec', x, y0 + 23, z, towers);
    B(1.8, 1.8, 4.2, '#f2f1ec', x, y0 + 46.5, z, towers);
    const r = new THREE.Group(); r.position.set(x, y0 + 46.5, z + 2.3); scene.add(r);
    // hub and three blades in one mesh: one draw call per rotor
    const parts = [new THREE.SphereGeometry(0.75, 8, 6)];
    for (let k = 0; k < 3; k++) parts.push(new THREE.BoxGeometry(0.9, 17, 0.25).translate(0, 9, 0).rotateZ((k * Math.PI * 2) / 3));
    mk(mergeGeometries(parts.map(g => g.toNonIndexed())), '#f2f1ec', 0, 0, 0, r);
    rotors.push(r);
  }

  buildVillage(village);
  buildBuyers(village, scene);
  buildLandmarks(scene);
  for (const g of [st, lines, towers, village]) scene.add(bake(flatten(g)));
  addZoneMarkers(scene);
  return { rotors };
}

/** Village along the street east of the farm: houses on both sides and a small church. */
function buildVillage(st) {
  for (const [x, z, w, d, wall, roof, ry] of HOUSES) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; st.add(g);
    gable(w, d, 4.2, wall, roof, g);
    for (const sx of [-w / 4, w / 4]) B(1.0, 1.0, 0.1, '#5d7d8c', sx, 2.5, d / 2 + 0.03, g);
    B(1.0, 2.0, 0.1, '#8a6a52', 0, 1.0, d / 2 + 0.03, g);
    addBox(x - d / 2, x + d / 2, z - w / 2, z + w / 2);
  }
  const g = new THREE.Group(); g.position.set(CHURCH.x + 2, 0, CHURCH.z); st.add(g);
  gable(10, 7, 6, '#f2ebdf', '#7b5a4e', g);
  B(3.2, 12, 3.2, '#f2ebdf', -6.6, 6, 0, g);
  const spire = mk(new THREE.ConeGeometry(2.6, 5, 4), '#5d6268', -6.6, 14.5, 0, g); spire.rotation.y = Math.PI / 4;
  B(1.0, 1.4, 0.1, '#5d7d8c', -6.6, 9, 1.65, g);
  addBox(CHURCH.x - 6.2, CHURCH.x + 7.4, CHURCH.z - 3.6, CHURCH.z + 3.6);
}

/** Name boards on buildings; far ones are hidden (each is a draw call), see updLabels. */
export const labels = [];
export function updLabels(x, z) { for (const m of labels) m.visible = Math.hypot(m.position.x - x, m.position.z - z) < 220; }

/** Text board for a building facade (kept out of bake: it has its own texture). */
export function label(scene, text, x, y, z, ry) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const c = cv.getContext('2d');
  c.fillStyle = '#24312a'; c.fillRect(0, 0, 512, 128);
  c.fillStyle = '#fbf7ee'; c.font = '800 64px "Bricolage Grotesque", "Trebuchet MS", sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 68);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  m.position.set(x, y, z); m.rotation.y = ry; scene.add(m);
  labels.push(m);
  document.fonts?.ready.then(() => { c.fillStyle = '#24312a'; c.fillRect(0, 0, 512, 128); c.fillStyle = '#fbf7ee'; c.fillText(text, 256, 68); tex.needsUpdate = true; });
}

/** Mill, oil mill and sugar factory along the main road, plus a label on the farm intake. */
function buildBuyers(st, scene) {
  // mill: tall gabled building with two small silos
  { const g = new THREE.Group(); g.position.set(138, 0, 72); st.add(g);
    gable(12, 10, 9, '#efe6d6', '#8a5a44', g);
    for (const x of [-3.5, 0, 3.5]) for (const y of [3, 6.5]) B(1.1, 1.3, 0.1, '#5d7d8c', x, y, -5.03, g);
    for (const dz of [-2.5, 2.5]) { CY(1.8, 1.8, 11, 14, '#dfe1dc', 9, 5.5, dz, g); mk(new THREE.ConeGeometry(1.9, 1.6, 14), '#c9cdc7', 9, 11.8, dz, g); circles.push({ x: 147, z: 72 + dz, r: 2 }); }
    addBox(132, 144, 67, 77);
    label(scene, 'Mlýn', 138, 6, 66.9, Math.PI); }
  // oil mill: hall and three tanks
  { B(18, 5, 6, '#d9dcd8', 205, 2.5, 25, st);
    B(18.6, 0.3, 6.6, '#6c777d', 205, 5.15, 25, st);
    for (const x of [198, 205, 212]) { CY(2.2, 2.2, 7, 16, '#e8e2c8', x, 3.5, 30.5, st); CY(2.25, 2.25, 0.3, 16, '#c9b13a', x, 7.1, 30.5, st); circles.push({ x, z: 30.5, r: 2.3 }); }
    addBox(196, 214, 22, 28);
    label(scene, 'Olejna', 205, 3.6, 28.08, 0); }
  // sugar factory and biogas: big hall, chimney, two green domes
  { const g = new THREE.Group(); g.position.set(240, 0, 72); st.add(g);
    gable(16, 10, 7, '#e7dfd2', '#5d6268', g);
    CY(0.9, 1.3, 22, 12, '#b9a89a', 10, 11, -2, g);
    CY(1.0, 1.0, 1.2, 12, '#c8553f', 10, 21.5, -2, g);
    addBox(232, 248, 67, 77); circles.push({ x: 250, z: 70, r: 1.5 });
    for (const [dx, dz] of [[-12, 6], [-12, -4]]) {
      const d = mk(new THREE.SphereGeometry(4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#6f9a6a', dx, 0, dz, g);
      d.scale.y = 0.7; circles.push({ x: 240 + dx, z: 72 + dz, r: 4 });
    }
    label(scene, 'Cukrovar', 240, 5, 66.9, Math.PI); }
  label(scene, 'Družstvo', 5, 7.6, -18.88, 0);
}

/** Coloured ground rings that show where to sell grain and where to swap implements. */
function addZoneMarkers(scene) {
  for (const m of MARKETS) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(m.r - 0.5, m.r, 40),
      new THREE.MeshBasicMaterial({ color: col(m.color), transparent: true, opacity: 0.75 }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(m.x, groundH(m.x, m.z) + 0.06, m.z); scene.add(ring);
  }
  const wb = WOOD_BUYERS[1];
  const woodRing = new THREE.Mesh(new THREE.RingGeometry(wb.r - 0.5, wb.r, 40),
    new THREE.MeshBasicMaterial({ color: col('#8a6a4a'), transparent: true, opacity: 0.75 }));
  woodRing.rotation.x = -Math.PI / 2; woodRing.position.set(wb.x, groundH(wb.x, wb.z) + 0.06, wb.z); scene.add(woodRing);
  const baleRing = new THREE.Mesh(new THREE.RingGeometry(baleZone.r - 0.5, baleZone.r, 40),
    new THREE.MeshBasicMaterial({ color: col('#b07a4a'), transparent: true, opacity: 0.75 }));
  baleRing.rotation.x = -Math.PI / 2; baleRing.position.set(baleZone.x, 0.06, baleZone.z); scene.add(baleRing);
  const fuelRing = new THREE.Mesh(new THREE.RingGeometry(fuelZone.r - 0.5, fuelZone.r, 40),
    new THREE.MeshBasicMaterial({ color: col('#c8553f'), transparent: true, opacity: 0.75 }));
  fuelRing.rotation.x = -Math.PI / 2; fuelRing.position.set(fuelZone.x, 0.06, fuelZone.z); scene.add(fuelRing);
  const sq = new THREE.Mesh(new THREE.RingGeometry(5.6, 6.0, 4, 1),
    new THREE.MeshBasicMaterial({ color: col('#7fb2a4'), transparent: true, opacity: 0.7 }));
  sq.rotation.x = -Math.PI / 2; sq.rotation.z = Math.PI / 4; sq.position.set(12, 0.06, -34.5); sq.scale.set(1.35, 0.55, 1); scene.add(sq);
}
