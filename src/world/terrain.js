import * as THREE from 'three';
import { col, smooth, fbm, vnoise, hash2, clamp, lerp } from '../core/util.js';
import {
  BOUNDS, HOME, TOWN, FIELD_DEFS, RIVER_HALF, FORD, PONDS, PIT, CHAPEL, BRIDGES, MEADOW_AREAS, RAIL,
  riverDist, inRect, inPond,
} from './layout.js';

/**
 * Terrain (variant A): rolling hills whose height depends on the region, flattened into terraces
 * under the fields, the farm, the town and the chapel; a river valley with its channel and a ford,
 * fish ponds and a gravel pit carved in.
 * The playable area is a 5 m height grid; groundH() interpolates it exactly like the mesh triangles,
 * so wheels sit on the visible ground. Outside the bounds the land rises into hills (20 m mesh).
 */
const STEP = 5;

/** Natural hills before any terraces: higher in the western forest and the north, low along the river and in the south. */
function hills(x, z) {
  const west = smooth(-110, -220, x), north = smooth(150, 230, z);
  let amp = 8 + 9 * west + 5 * north * (1 - west);
  const dr = riverDist(x, z);
  const low = Math.max(1 - smooth(60, 170, dr), smooth(-130, -210, z) * smooth(-200, -120, x) * smooth(340, 300, x), inRect(x, z, TOWN, 60) ? 1 : 0);
  amp = lerp(amp, 2, low);
  let h = amp * Math.max(0, fbm(x * 0.0055 + 11, z * 0.0055 + 3) * 1.45 - 0.42) + fbm(x * 0.03, z * 0.03) * 0.04 * amp;
  // outside the playable area the land rises into the surrounding hills
  const dx = Math.max(0, x - BOUNDS.x1, BOUNDS.x0 - x), dz = Math.max(0, z - BOUNDS.z1, BOUNDS.z0 - z), d = Math.hypot(dx, dz);
  if (d > 0) h += smooth(0, 160, d) * (25 + 35 * fbm(x * 0.004 + 5, z * 0.004 + 9)) + smooth(0, 40, d) * fbm(x * 0.05, z * 0.05) * 3;
  // the river runs in a valley with a flat floor
  return h * smooth(14, 70, dr);
}

/** Flat terraces: [rect, level, margin]. Fields sit at the natural height of their centre. */
const FIELD_PAD = 6;
const levelCache = new Map();
/** Height of field def f (its terrace level, rounded to 0.5 m). */
const inHome = f => f.x0 + f.w <= HOME.x1 && f.x0 >= HOME.x0 && f.z0 >= HOME.z0 && f.z0 + f.h <= HOME.z1;
export function levelOf(f) {
  if (inHome(f)) return 0;
  if (!levelCache.has(f.id)) levelCache.set(f.id, Math.round(hills(f.x0 + f.w / 2, f.z0 + f.h / 2) * 2) / 2);
  return levelCache.get(f.id);
}
const ZONES = [
  { r: HOME, level: 0, m: 60 },
  { r: { x0: TOWN.x0, x1: RAIL.x + 20, z0: TOWN.z0, z1: TOWN.z1 }, level: 0, m: 50 },
  ...FIELD_DEFS.filter(f => !inHome(f)).map(f => ({
    r: { x0: f.x0 - FIELD_PAD, x1: f.x0 + f.w + FIELD_PAD, z0: f.z0 - FIELD_PAD, z1: f.z0 + f.h + FIELD_PAD }, level: levelOf(f), m: 22,
  })),
  { r: { x0: CHAPEL.x - 16, x1: CHAPEL.x + 16, z0: CHAPEL.z - 16, z1: CHAPEL.z + 16 }, level: Math.round(hills(CHAPEL.x, CHAPEL.z)), m: 18 },
];
const rectDist = (x, z, r) => Math.hypot(Math.max(0, r.x0 - x, x - r.x1), Math.max(0, r.z0 - z, z - r.z1));

/** Full terrain height at (x, z), including terraces, river channel, ponds and the pit. */
export function terrainH(x, z) {
  let h = hills(x, z);
  for (const zn of ZONES) {
    const d = rectDist(x, z, zn.r);
    if (d < zn.m) h = lerp(h, zn.level, 1 - smooth(0, zn.m, d));
  }
  // river channel, shallow at the ford
  const dr = riverDist(x, z);
  if (dr < RIVER_HALF) {
    let carve = 2.6 * (1 - (dr / RIVER_HALF) ** 2);
    const df = Math.hypot(x - FORD.x, z - FORD.z);
    if (df < FORD.r + 8) carve = lerp(Math.min(carve, 0.95), carve, smooth(FORD.r, FORD.r + 8, df));
    h -= carve;
  }
  for (const p of PONDS) {
    const e = ((x - p.x) / p.rx) ** 2 + ((z - p.z) / p.rz) ** 2;
    if (e < 1) h = Math.min(h, -2.2 * (1 - e));
  }
  if (inRect(x, z, PIT, 0)) {
    const din = Math.min(x - PIT.x0, PIT.x1 - x, z - PIT.z0, PIT.z1 - z);
    h -= PIT.depth * smooth(0, 14, din) + fbm(x * 0.08, z * 0.08) * 0.6 * smooth(8, 20, din);
  }
  return h;
}

/* ---------- height grid over the playable area ---------- */
const GX0 = BOUNDS.x0, GZ0 = BOUNDS.z0;
const NX = Math.round((BOUNDS.x1 - BOUNDS.x0) / STEP), NZ = Math.round((BOUNDS.z1 - BOUNDS.z0) / STEP);
let grid = null;
function buildGrid() {
  grid = new Float32Array((NX + 1) * (NZ + 1));
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) grid[j * (NX + 1) + i] = terrainH(GX0 + i * STEP, GZ0 + j * STEP);
}
const gh = (i, j) => grid[j * (NX + 1) + i];

/** River and pond water levels, for the water meshes. */
export const WATER_Y = -0.75, POND_Y = -0.6;

/**
 * Ground height as the player sees it: the terrain mesh (same triangles), bridge decks over the river.
 * Outside the playable area it falls back to terrainH.
 */
export function groundH(x, z) {
  if (!grid) buildGrid();
  for (const b of BRIDGES) {
    const ax = b.along === 'x' ? Math.abs(x - b.x) : Math.abs(z - b.z), ac = b.along === 'x' ? Math.abs(z - b.z) : Math.abs(x - b.x);
    if (ax < b.len / 2 && ac < b.w / 2) return 0.35;
  }
  const fx = (x - GX0) / STEP, fz = (z - GZ0) / STEP;
  if (fx < 0 || fz < 0 || fx >= NX || fz >= NZ) return terrainH(x, z);
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  // each grid square is split along the diagonal (i, j+1)–(i+1, j), as in the mesh
  const h00 = gh(i, j), h10 = gh(i + 1, j), h01 = gh(i, j + 1), h11 = gh(i + 1, j + 1);
  return u + v <= 1 ? h00 + (h10 - h00) * u + (h01 - h00) * v : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
}

/* ---------- mesh ---------- */
const grass = ['#8fb556', '#86ad4f', '#97ba5c', '#80a84c'].map(col);
const forestFloor = ['#6f9447', '#76994a', '#688c43'].map(col);
const C = {
  gold: col('#dcc276'), light: col('#b7cf7d'), brown: col('#a37c5a'), mint: col('#9cc58c'),
  mud: col('#b9a47c'), bed: col('#8a7a5e'), gravel: col('#cbbfa4'), gravel2: col('#b8aa8e'), meadow: col('#a7c96a'),
};

function faceColor(c, cx, cz, cy) {
  const inside = inRect(cx, cz, BOUNDS);
  c.copy(grass[Math.floor(clamp(vnoise(cx * 0.03, cz * 0.03) * 1.4 - 0.2, 0, 0.999) * 4)]);
  if (inside && cx < -150) c.lerp(forestFloor[Math.floor(hash2(cx * 0.1, cz * 0.1) * 2.999)], smooth(-150, -220, cx));
  if (MEADOW_AREAS.some(m => inRect(cx, cz, m, 4))) c.lerp(C.meadow, 0.7);
  if (cy < -1.3) c.copy(C.bed);
  else if (cy < -0.2) c.lerp(C.mud, 0.85);
  if (inRect(cx, cz, PIT, -2)) c.copy(hash2(cx, cz) > 0.5 ? C.gravel : C.gravel2);
  if (!inside && cy > 2.5) {
    // distant patchwork of fields on the surrounding hills
    const r = hash2(Math.floor((cx + 1000) / 46), Math.floor((cz + 1000) / 34));
    if (r < 0.2) c.copy(C.gold);
    else if (r < 0.34) c.copy(C.light);
    else if (r < 0.41) c.copy(C.brown);
    else if (r < 0.47) c.copy(C.mint);
  }
  c.multiplyScalar(cy > 0.5 ? 0.94 + hash2(cx, cz) * 0.1 : 0.98 + hash2(cx, cz) * 0.04);
}

/** One flat-shaded patch of terrain (nx × nz squares of sx × sz m); height(i, j) gives the vertex heights; skirt hangs its edges down. */
function patch(x0, z0, nx, nz, sx, sz, height, material, skirt) {
  const skirtTris = skirt ? (nx + nz) * 2 * 4 : 0, maxTri = nx * nz * 2 + skirtTris;
  const pos = new Float32Array(maxTri * 9), cols = new Float32Array(maxTri * 9), c = new THREE.Color();
  let n = 0;
  const P = (i, j) => [x0 + i * sx, height(i, j), z0 + j * sz];
  const tri = (a, b, d) => {
    pos.set(a, n); pos.set(b, n + 3); pos.set(d, n + 6);
    faceColor(c, (a[0] + b[0] + d[0]) / 3, (a[2] + b[2] + d[2]) / 3, (a[1] + b[1] + d[1]) / 3);
    for (let k = 0; k < 9; k += 3) { cols[n + k] = c.r; cols[n + k + 1] = c.g; cols[n + k + 2] = c.b; }
    n += 9;
  };
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = P(i, j), b = P(i + 1, j), d = P(i, j + 1), e = P(i + 1, j + 1);
      // split along (i, j+1)–(i+1, j), matching groundH(); counter-clockwise seen from above
      tri(a, d, b); tri(b, d, e);
    }
  }
  if (skirt) {
    // vertical strips under the outer edges hide cracks against the coarser hills beyond
    const drop = (p, q) => { const p2 = [p[0], p[1] - 3, p[2]], q2 = [q[0], q[1] - 3, q[2]]; tri(p, q, p2); tri(q, q2, p2); tri(p, p2, q); tri(q, p2, q2); };
    for (const [edge, n] of [['s', nx], ['n', nx], ['w', nz], ['e', nz]]) {
      if (!skirt[edge]) continue;
      for (let k = 0; k < n; k++) {
        const [p, q] = edge === 's' ? [P(k, 0), P(k + 1, 0)] : edge === 'n' ? [P(k, nz), P(k + 1, nz)] : edge === 'w' ? [P(0, k), P(0, k + 1)] : [P(nx, k), P(nx, k + 1)];
        drop(p, q);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, n), 3));
  g.setAttribute('color', new THREE.BufferAttribute(cols.subarray(0, n), 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, material);
  m.receiveShadow = true;
  return m;
}

/**
 * Builds the terrain: the playable area in 6 tiles (5 m grid) and the surrounding hills in
 * coarser patches. Tiles are culled separately. Returns { material, group }.
 */
export function buildTerrain(scene) {
  if (!grid) buildGrid();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
  const group = new THREE.Group();
  const TX = 3, TZ = 2, tnx = NX / TX, tnz = NZ / TZ;
  for (let tj = 0; tj < TZ; tj++) {
    for (let ti = 0; ti < TX; ti++) {
      const i0 = ti * tnx, j0 = tj * tnz;
      group.add(patch(GX0 + i0 * STEP, GZ0 + j0 * STEP, tnx, tnz, STEP, STEP, (i, j) => gh(i0 + i, j0 + j), material,
        { s: tj === 0, n: tj === TZ - 1, w: ti === 0, e: ti === TX - 1 }));
    }
  }
  // surrounding hills: four strips, one mesh each (few triangles, so culling them finer is not worth a draw call)
  const OUT = 520, CS = 20, B = BOUNDS;
  const strips = [
    [B.x0 - OUT, B.x1 + OUT, B.z0 - OUT, B.z0], [B.x0 - OUT, B.x1 + OUT, B.z1, B.z1 + OUT],
    [B.x0 - OUT, B.x0, B.z0, B.z1], [B.x1, B.x1 + OUT, B.z0, B.z1],
  ];
  for (const [x0, x1, z0, z1] of strips) {
    const nx = Math.round((x1 - x0) / CS), nz = Math.round((z1 - z0) / CS), sx = (x1 - x0) / nx, sz = (z1 - z0) / nz;
    group.add(patch(x0, z0, nx, nz, sx, sz, (i, j) => terrainH(x0 + i * sx, z0 + j * sz), material, null));
  }
  scene.add(group);
  return { material, group };
}
