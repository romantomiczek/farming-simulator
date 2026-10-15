import * as THREE from 'three';
import { M, mk, B, CY, flatPlane, bake } from '../render/materials.js';
import { col } from '../core/util.js';
import { terrainH } from './terrain.js';
import { ROADS, PAD, POND, sellZone, baleZone, fuelZone, circles, addBox } from './layout.js';

/** House-shaped body: walls, triangular gables and a two-sided roof. Ridge runs along x. */
function gable(w, d, h, wall, roof, parent) {
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

function road(r, parent) {
  const w = r.x1 - r.x0, d = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  flatPlane(w, d, '#d8c59f', cx, 0.02, cz, parent);
  if (d > w) { flatPlane(1.1, d, '#c7b186', cx - 1.6, 0.025, cz, parent); flatPlane(1.1, d, '#c7b186', cx + 1.6, 0.025, cz, parent); }
  else { flatPlane(w, 1.1, '#c7b186', cx, 0.025, cz - 1.6, parent); flatPlane(w, 1.1, '#c7b186', cx, 0.025, cz + 1.6, parent); }
}

/** Builds the farmyard, roads, pond and wind turbines. Returns the turbine rotors to animate. */
export function buildFarm(scene) {
  const st = new THREE.Group();

  // ground decals
  ROADS.forEach(r => road(r, st));
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
  for (const [x, z] of [[-150, 40], [150, 95], [138, -70], [-120, 190]]) {
    const y0 = terrainH(x, z) - 0.5;
    CY(0.7, 1.4, 46, 10, '#f2f1ec', x, y0 + 23, z, st);
    B(1.8, 1.8, 4.2, '#f2f1ec', x, y0 + 46.5, z, st);
    const r = new THREE.Group(); r.position.set(x, y0 + 46.5, z + 2.3); scene.add(r);
    mk(new THREE.SphereGeometry(0.75, 8, 6), '#f2f1ec', 0, 0, 0, r);
    for (let k = 0; k < 3; k++) {
      const arm = new THREE.Group(); arm.rotation.z = (k * Math.PI * 2) / 3; r.add(arm);
      B(0.9, 17, 0.25, '#f2f1ec', 0, 9, 0, arm);
    }
    bake(r);
    rotors.push(r);
  }

  scene.add(bake(st));
  addZoneMarkers(scene);
  return { rotors };
}

/** Coloured ground rings that show where to sell grain and where to swap implements. */
function addZoneMarkers(scene) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(sellZone.r - 0.5, sellZone.r, 40),
    new THREE.MeshBasicMaterial({ color: col('#e8b84a'), transparent: true, opacity: 0.75 }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(sellZone.x, 0.06, sellZone.z); scene.add(ring);
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
