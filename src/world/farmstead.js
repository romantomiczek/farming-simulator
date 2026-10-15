import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { scene } from '../render/core.js';
import { M, mk, B, CY, flatPlane, bake } from '../render/materials.js';
import { col, rng } from '../core/util.js';
import { COW_PEN, HEN_RUN, GREENHOUSES, GREENHOUSE_WATER, SAWMILL, boxes, circles } from './layout.js';

/**
 * Buildings you can buy (cow shed, hen house, greenhouses) and the sawmill. Each building is a
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
    const r = B(w + 0.6, 0.2, L, roofHex, x, h + Math.tan(ang) * d / 4, z + sg * d / 4, g);
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
  B(9, 0.25, 21, '#7b5a4e', sx, 3.7, sz, g);
  B(0.3, 3.6, 21, '#c9a582', p.x0 + 0.5, 1.8, sz, g);
  // feed and water troughs at the east fence, next to the feed ring
  B(1.0, 0.6, 8, '#8a6a52', p.x1 - 1.2, 0.3, p.z1 - 6, g);
  B(1.0, 0.5, 3, '#7a9fb4', p.x1 - 1.2, 0.25, p.z0 + 5, g);
  return g;
}

function buildHens() {
  const g = new THREE.Group(), p = HEN_RUN;
  flatPlane(p.x1 - p.x0, p.z1 - p.z0, '#b7a77a', (p.x0 + p.x1) / 2, 0.03, (p.z0 + p.z1) / 2, g);
  fence(g, 'hens', p.x0, p.x1, p.z0, p.z1);
  const hx = (p.x0 + p.x1) / 2, hz = p.z0 + 3;
  B(7, 2.6, 4, '#e9d7b5', hx, 1.3, hz, g);
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
  r.rotation.x = -Math.PI / 2; r.position.set(z.x, 0.06, z.z); parent.add(r);
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
    update(dt) {
      for (let i = 0; i < n; i++) {
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

/* ---------- sawmill (always there) ---------- */
function buildSawmill(st) {
  const g = new THREE.Group(); st.add(g);
  B(16, 5, 10, '#b9a07c', -36, 2.5, 124, g);
  gableRoof(g, 16, 10, 5, -36, 124, '#6c777d');
  for (let k = 0; k < 3; k++) for (let j = 0; j < 4; j++) {
    const lg = CY(0.35, 0.35, 5, 8, '#a5784f', -42 + j * 0.75, 0.35 + k * 0.62, 112, g);
    lg.rotation.x = Math.PI / 2;
  }
  boxes.push({ x0: -44, x1: -28, z0: 119, z1: 129 });
  circles.push({ x: -40.9, z: 112, r: 2.8 });
}

export function buildFarmstead() {
  const st = new THREE.Group();
  buildSawmill(st);
  scene.add(bake(st));
  const markers = new THREE.Group(); scene.add(markers);
  ring(SAWMILL, '#8a6a4a', markers);

  groups.cows = bake(buildCows());
  groups.hens = bake(buildHens());
  for (const gh of GREENHOUSES) groups[gh.key] = bake(buildGreenhouse(gh));
  for (const k in groups) { groups[k].visible = false; scene.add(groups[k]); }
  const rings = {
    cows: ring(COW_PEN.feed, '#7fa653', markers), hens: ring(HEN_RUN.feed, '#e0b13a', markers),
    water: ring(GREENHOUSE_WATER, '#6fb0c8', markers),
  };
  const cows = makeHerd(cowGeo(), 10, COW_PEN, ['#f2efe6', '#5b4636', '#8a5a3c', '#2f2f2f'], 0.35, 11);
  const hens = makeHerd(henGeo(), 40, HEN_RUN, ['#f4f1ea', '#b9733e', '#8a5a3c'], 0.8, 23);
  scene.add(cows.mesh, hens.mesh);

  return {
    /** Shows a building and turns its collisions on or off. */
    setOwned(key, on) {
      owned[key] = on;
      if (groups[key]) groups[key].visible = on;
      for (const b of boxes) if (b.owner === key) b.off = !on;
      if (key === 'cows') { cows.mesh.visible = on; rings.cows.visible = on; }
      if (key === 'hens') { hens.mesh.visible = on; rings.hens.visible = on; }
      rings.water.visible = !!(owned.greenhouse1 || owned.greenhouse2);
    },
    update(dt) {
      if (owned.cows) cows.update(dt);
      if (owned.hens) hens.update(dt);
    },
  };
}
