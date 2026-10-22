import * as THREE from 'three';
import { rng, lerp, col, fbm, smooth, hash2 } from '../core/util.js';
import { broadleaf, birch, spruce, bush, broadleafLeaves, birchLeaves } from './treegeo.js';
import { leafTexture } from '../render/textures.js';
import { addWind } from '../render/wind.js';
import { groundH } from './terrain.js';
import {
  MAP_DEFAULTS,
  FIELD_DEFS, ROADS, PAD, POND, PONDS, NO_TREES, BOUNDS, PIT, FOREST_PLOTS, BRIDGES, TURBINES, RAIL, RIVER,
  circles, addBox, inRect, inPond, polyDist, riverDist,
} from './layout.js';
import { addSnow } from '../render/snow.js';

/**
 * Trees and hedges. A tree is one merged model (trunk + crown, vertex colours, a "leaf" flag so the
 * season tint only touches leaves; see treegeo.js), a broadleaf, a birch or a spruce. Trees are grouped into square tiles, one instanced mesh per
 * kind and tile, so tiles off screen cost nothing. Inside the playable area every tree blocks
 * vehicles; outside it the trees are scenery and the quality preset thins them (setDensity).
 *
 * Regions: dense spruce-and-beech forest in the west with clearings, groves in the farmland,
 * willows along the river, alleys along the roads, hedges along field edges, scattered trees on
 * the hills around the map.
 */
const TILE = 225;
/** Tiles whose nearest point is further than this use the low-detail tree models. */
const NEAR = 170;
/** Positions of the trees inside the playable area, flat [x, z, x, z, ...] (for the maps). */
export const treeDots = [];

/** Near and far model of each kind of tree (treegeo.js). */
const GEO = { decid: [broadleaf(1), broadleaf(0), broadleaf(1, 0.8)], birch: [birch(1), birch(0), birch(1, 0.8)], conif: [spruce(1), spruce(0)] };
/** Leaf cards round the near broadleaf and birch crowns (nothing for spruces: their tiers already look feathery). */
const LEAVES = { decid: broadleafLeaves(), birch: birchLeaves() };
const bushGeo = bush(1), bushLow = bush(0);

/** Season tint (material colour) on leaves only: trunks keep their own colour. */
function leafOnly(mat) {
  const prev = mat.onBeforeCompile, key = mat.customProgramCacheKey;
  mat.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float leaf;\nvarying float vLeaf;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLeaf = leaf;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLeaf;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb / max(diffuse, vec3(0.001)), diffuseColor.rgb, vLeaf);');
  };
  mat.customProgramCacheKey = () => key() + 'leaf';
  return mat;
}

export function buildVegetation(scene) {
  const R = rng(7);
  const fieldRects = FIELD_DEFS.map(f => ({ x0: f.x0, x1: f.x0 + f.w, z0: f.z0, z1: f.z0 + f.h }));
  /** Places where no tree may stand (m = extra margin). */
  const blocked = (x, z, m) => {
    for (const r of fieldRects) if (inRect(x, z, r, Math.max(7, 4 + m))) return true; // room for machines turning at the field edge
    for (const r of NO_TREES) if (inRect(x, z, r, m)) return true;
    if (inRect(x, z, PAD, 2 + m) || inRect(x, z, PIT, 4 + m)) return true;
    for (const P of FOREST_PLOTS) if (inRect(x, z, P, 3 + m)) return true;
    if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 3 + m) return true;
    for (const p of PONDS) if (inPond(x, z, p, 6 + m)) return true;
    for (const b of BRIDGES) if (Math.hypot(x - b.x, z - b.z) < b.len / 2 + 4) return true;
    for (const [tx, tz] of TURBINES) if (Math.hypot(x - tx, z - tz) < 5) return true;
    if (Math.abs(x - RAIL.x) < 6 + m) return true;
    if (riverDist(x, z) < 11 + m) return true;
    for (const r of ROADS) if (polyDist(x, z, r.pts) < r.w / 2 + 1.8 + m) return true;
    return false;
  };

  // the same rules rasterised once (2 m cells over the playable area), for the thousands of forest candidates
  const MS = 2, MX0 = BOUNDS.x0 - 10, MZ0 = BOUNDS.z0 - 10, MW = Math.ceil((BOUNDS.x1 - BOUNDS.x0 + 20) / MS), MH = Math.ceil((BOUNDS.z1 - BOUNDS.z0 + 20) / MS);
  const mask = new Uint8Array(MW * MH);
  const fillRect = (r, m) => {
    for (let j = Math.max(0, Math.floor((r.z0 - m - MZ0) / MS)); j <= Math.min(MH - 1, Math.floor((r.z1 + m - MZ0) / MS)); j++)
      for (let i = Math.max(0, Math.floor((r.x0 - m - MX0) / MS)); i <= Math.min(MW - 1, Math.floor((r.x1 + m - MX0) / MS)); i++) mask[j * MW + i] = 1;
  };
  const fillDisc = (x, z, rad) => {
    for (let j = Math.max(0, Math.floor((z - rad - MZ0) / MS)); j <= Math.min(MH - 1, Math.floor((z + rad - MZ0) / MS)); j++)
      for (let i = Math.max(0, Math.floor((x - rad - MX0) / MS)); i <= Math.min(MW - 1, Math.floor((x + rad - MX0) / MS)); i++)
        if (Math.hypot(MX0 + (i + 0.5) * MS - x, MZ0 + (j + 0.5) * MS - z) < rad + MS * 0.71) mask[j * MW + i] = 1;
  };
  const fillLine = (pts, rad) => {
    for (let k = 1; k < pts.length; k++) {
      const [x0, z0] = pts[k - 1], [x1, z1] = pts[k], L = Math.hypot(x1 - x0, z1 - z0);
      for (let d = 0; d <= L; d += MS) fillDisc(x0 + ((x1 - x0) * d) / L, z0 + ((z1 - z0) * d) / L, rad);
    }
  };
  fieldRects.forEach(r => fillRect(r, 4)); NO_TREES.forEach(r => fillRect(r, 0));
  fillRect(PAD, 2); fillRect(PIT, 4); FOREST_PLOTS.forEach(r => fillRect(r, 3));
  fillDisc(POND.x, POND.z, POND.r + 3);
  for (const b of BRIDGES) fillDisc(b.x, b.z, b.len / 2 + 4);
  for (const [tx, tz] of TURBINES) fillDisc(tx, tz, 5);
  fillRect({ x0: RAIL.x, x1: RAIL.x, z0: BOUNDS.z0 - 10, z1: BOUNDS.z1 + 10 }, 6);
  fillLine(RIVER, 11);
  for (const r of ROADS) fillLine(r.pts, r.w / 2 + 1.8);
  for (const p of PONDS) fillRect({ x0: p.x - p.rx, x1: p.x + p.rx, z0: p.z - p.rz, z1: p.z + p.rz }, 6); // the box around the ellipse: ponds sit in the open
  const masked = (x, z) => {
    const i = Math.floor((x - MX0) / MS), j = Math.floor((z - MZ0) / MS);
    return i < 0 || j < 0 || i >= MW || j >= MH ? blocked(x, z, 0) : mask[j * MW + i] === 1;
  };

  /* ---------- candidates ---------- */
  // t = { x, y, z, s, sy (height scale), r, kind: 'decid' | 'birch' | 'conif', solid (blocks vehicles), rank (thinning order) }
  const trees = [];
  const OUT = 500, X0 = BOUNDS.x0 - OUT, X1 = BOUNDS.x1 + OUT, Z0 = BOUNDS.z0 - OUT, Z1 = BOUNDS.z1 + OUT;
  // a birch among the broadleaves is picked by position, so the rest of the layout stays as it was
  const add = (x, z, s, conifer, solid) => {
    const r = R();
    trees.push({ x, z, y: groundH(x, z), s, sy: s * (0.85 + 0.3 * hash2(x * 0.37, z * 0.53)), r, kind: conifer ? 'conif' : hash2(x, z) < 0.2 ? 'birch' : 'decid', solid, rank: solid ? 0 : R() });
  };
  const CELL = 6;
  for (let gx = X0; gx < X1; gx += CELL) {
    for (let gz = Z0; gz < Z1; gz += CELL) {
      const x = gx + R() * CELL, z = gz + R() * CELL, roll = R();
      const inside = inRect(x, z, BOUNDS, 6);
      let p, conifP;
      if (inside) {
        const forest = smooth(-130, -175, x + (fbm(x * 0.01, z * 0.01) - 0.5) * 60);
        const clearing = fbm(x * 0.012 + 3, z * 0.012 + 8) < 0.33;
        const grove = fbm(x * 0.008 + 40, z * 0.008 - 7) > 0.63;
        const bank = riverDist(x, z) < 30;
        p = lerp(grove ? 0.45 : bank ? 0.18 : 0.012, clearing ? 0.04 : 0.8, forest);
        conifP = forest > 0.5 ? 0.68 : 0.25;
        if (bank && forest < 0.5) conifP = 0.05;
      } else {
        const west = x < BOUNDS.x0 + 40;
        p = west ? 0.12 : 0.03;
        conifP = 0.42;
      }
      if (roll > p) continue;
      if (inside ? masked(x, z) : blocked(x, z, -3)) continue;
      add(x, z, 0.75 + R() * 0.65, R() < conifP, inside);
    }
  }
  // alleys along the gravel roads
  for (const r of ROADS) {
    if (r.kind !== 'road' && r.id !== 'south') continue;
    for (let k = 1; k < r.pts.length; k++) {
      const [x0, z0] = r.pts[k - 1], [x1, z1] = r.pts[k], L = Math.hypot(x1 - x0, z1 - z0);
      const nx = (z1 - z0) / L, nz = -(x1 - x0) / L, off = r.w / 2 + 3;
      for (let d = 6; d < L - 6; d += 11) {
        for (const sg of [-1, 1]) {
          const x = x0 + ((x1 - x0) * d) / L + nx * off * sg, z = z0 + ((z1 - z0) * d) / L + nz * off * sg;
          if (R() < 0.12 || blocked(x, z, -1.4)) continue;
          add(x, z, 0.95 + R() * 0.2, false, true);
        }
      }
    }
  }
  for (const t of trees) if (t.solid) { circles.push({ x: t.x, z: t.z, r: 0.42 * t.s }); treeDots.push(t.x, t.z); } // the trunk, not the crown

  /* ---------- hedges ---------- */
  const hedge = [];
  const hedgeBlocked = (x, z) => fieldRects.some(r => inRect(x, z, r, 0.5)) || NO_TREES.some(r => inRect(x, z, r)) ||
    ROADS.some(r => polyDist(x, z, r.pts) < r.w / 2 + 1.2) || riverDist(x, z) < 10 || PONDS.some(p => inPond(x, z, p, 4));
  const line = (x0, z0, x1, z1, box) => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(L / 1.5);
    for (let k = 0; k <= n; k++) {
      const t = k / n, x = lerp(x0, x1, t) + (R() - 0.5) * 0.6, z = lerp(z0, z1, t) + (R() - 0.5) * 0.6;
      if (!box && hedgeBlocked(x, z)) continue;
      const s = 0.8 + R() * 0.6;
      hedge.push({ x, z, y: groundH(x, z), s, r: R() });
      if (!box) circles.push({ x, z, r: 0.75 * s });
    }
    if (box) addBox(Math.min(x0, x1) - 1, Math.max(x0, x1) + 1, Math.min(z0, z1) - 1, Math.max(z0, z1) + 1);
  };
  // the home fields: hedges only on the outer sides; the northern ends of fields 3 and 4 border the forest track
  // (only while those fields sit where they were drawn; moved home fields get the general rule below)
  const asDrawn = id => {
    const f = FIELD_DEFS.find(g => g.id === id), d = MAP_DEFAULTS.fields.find(g => g.id === id);
    return !!f && !!d && f.x0 === d.x0 && f.z0 === d.z0 && f.w === d.w && f.h === d.h;
  };
  if (asDrawn(1)) line(-73.5, -6, -73.5, 41, true);
  if (asDrawn(3)) line(-73.5, 55, -73.5, 101, true);
  if (asDrawn(2)) line(53, -6, 53, 41, true);
  if (asDrawn(4)) line(61, 55, 61, 99, true);
  // the new fields: a hedge (mez) along the side away from their sign
  for (const f of FIELD_DEFS) {
    if ((f.id <= 8 && asDrawn(f.id)) || f.poly) continue;
    const roadDist = (x, z) => Math.min(...ROADS.map(r => polyDist(x, z, r.pts)));
    const sides = [
      [f.x0 - 3.5, f.z0, f.x0 - 3.5, f.z0 + f.h], [f.x0 + f.w + 3.5, f.z0, f.x0 + f.w + 3.5, f.z0 + f.h],
      [f.x0, f.z0 - 3.5, f.x0 + f.w, f.z0 - 3.5], [f.x0, f.z0 + f.h + 3.5, f.x0 + f.w, f.z0 + f.h + 3.5],
    ];
    sides.sort((a, b) => roadDist((b[0] + b[2]) / 2, (b[1] + b[3]) / 2) - roadDist((a[0] + a[2]) / 2, (a[1] + a[3]) / 2));
    line(...sides[0], false);
  }

  /* ---------- meshes per tile ---------- */
  const decidMat = addSnow(leafOnly(addWind(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9 }), { amp: 0.035, base: 3.2, spatial: 0.05 })));
  const conifMat = addSnow(addWind(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.92 }), { amp: 0.018, base: 2, spatial: 0.05 }));
  // leaf cards: cut out of the leaf texture, both sides lit as the outside of the crown, swaying a little more than the crown
  const cardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.85, map: leafTexture(), alphaTest: 0.5, side: THREE.DoubleSide });
  cardMat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal *= faceDirection; nonPerturbedNormal = normal;'); };
  cardMat.customProgramCacheKey = () => 'leafcards';
  const leafMat = addSnow(leafOnly(addWind(cardMat, { amp: 0.045, base: 3.2, spatial: 0.05 })));
  const tint = [col('#ffffff'), col('#f2ffe6'), col('#e6f2d9'), col('#fff7e0'), col('#dcebd0')];
  const dummy = new THREE.Object3D(), c = new THREE.Color();
  const tiles = new Map();
  for (const t of trees) {
    const k = Math.floor((t.x - X0) / TILE) + ',' + Math.floor((t.z - Z0) / TILE) + t.kind;
    if (!tiles.has(k)) tiles.set(k, []);
    tiles.get(k).push(t);
  }
  const meshes = [];
  for (const list of tiles.values()) {
    list.sort((a, b) => a.rank - b.rank || a.r - b.r); // solid trees first (rank 0, mixed so a prefix thins evenly), then scenery in thinning order
    const kind = list[0].kind;
    const m = new THREE.InstancedMesh(GEO[kind][0], kind === 'conif' ? conifMat : decidMat, list.length);
    list.forEach((t, i) => {
      dummy.position.set(t.x, t.y - 0.15, t.z); dummy.rotation.set(0, t.r * 6.28, 0); dummy.scale.set(t.s, t.sy, t.s); dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, c.copy(tint[(t.r * tint.length) | 0]).multiplyScalar(0.92 + t.r * 0.14));
    });
    m.computeBoundingSphere();
    m.castShadow = false; m.receiveShadow = true; // shadows come from the near casters below
    if (LEAVES[kind]) { // the cards share the trees' transforms and tints; shown with the near models only
      const lm = new THREE.InstancedMesh(LEAVES[kind], leafMat, list.length);
      lm.instanceMatrix = m.instanceMatrix; lm.instanceColor = m.instanceColor; lm.boundingSphere = m.boundingSphere;
      lm.receiveShadow = true; lm.visible = false;
      scene.add(lm);
      m.userData.leaves = lm;
    }
    m.userData.ranks = list.map(t => t.rank);
    m.userData.solid = list.filter(t => t.rank === 0).length;
    m.userData.base = list.length;
    m.userData.geo = GEO[kind];
    let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
    for (const t of list) { bx0 = Math.min(bx0, t.x); bx1 = Math.max(bx1, t.x); bz0 = Math.min(bz0, t.z); bz1 = Math.max(bz1, t.z); }
    m.userData.box = { x0: bx0, x1: bx1, z0: bz0, z1: bz1 };
    scene.add(m);
    meshes.push(m);
  }
  const hedges = new THREE.InstancedMesh(bushGeo, decidMat, hedge.length);
  hedge.forEach((t, i) => {
    dummy.position.set(t.x, t.y + 0.75 * t.s, t.z); dummy.rotation.set(0, t.r * 6, 0); dummy.scale.set(1.3 * t.s, t.s, 1.3 * t.s); dummy.updateMatrix();
    hedges.setMatrixAt(i, dummy.matrix); hedges.setColorAt(i, c.copy(tint[(t.r * tint.length) | 0]).multiplyScalar(0.85 + t.r * 0.2));
  });
  hedges.computeBoundingSphere();
  hedges.castShadow = true; hedges.receiveShadow = true;
  scene.add(hedges);

  /*
   * Shadow casters: the trees near the camera only, in the simple models. Their material writes neither
   * colour nor depth, so they are invisible in the view, but the shadow pass (which uses its own depth
   * material) draws them. Drawing whole tiles into the shadow map cost more than the trees themselves.
   */
  const CS = 50, cells = new Map();
  for (const t of trees) {
    const k = Math.floor(t.x / CS) + ',' + Math.floor(t.z / CS);
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(t);
  }
  const casterMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const casters = Object.fromEntries(Object.entries(GEO).map(([k, g]) => [k, new THREE.InstancedMesh(g[1], casterMat, 1500)]));
  for (const m of Object.values(casters)) { m.castShadow = true; m.frustumCulled = false; m.count = 0; scene.add(m); }
  let lastX = Infinity, lastZ = Infinity, lastR = 0;
  function updCasters(x, z, r) {
    if (Math.hypot(x - lastX, z - lastZ) < 8 && Math.abs(r - lastR) < 5) return;
    lastX = x; lastZ = z; lastR = r;
    const n = { decid: 0, birch: 0, conif: 0 };
    for (let cx = Math.floor((x - r) / CS); cx <= Math.floor((x + r) / CS); cx++) {
      for (let cz = Math.floor((z - r) / CS); cz <= Math.floor((z + r) / CS); cz++) {
        for (const t of cells.get(cx + ',' + cz) || []) {
          if (Math.abs(t.x - x) > r || Math.abs(t.z - z) > r || n[t.kind] >= 1500) continue;
          dummy.position.set(t.x, t.y - 0.15, t.z); dummy.rotation.set(0, t.r * 6.28, 0); dummy.scale.set(t.s, t.sy, t.s); dummy.updateMatrix();
          casters[t.kind].setMatrixAt(n[t.kind]++, dummy.matrix);
        }
      }
    }
    for (const k in casters) { casters[k].count = n[k]; casters[k].instanceMatrix.needsUpdate = true; }
  }

  return {
    leafMat: decidMat,
    count: trees.length + hedge.length,
    /**
     * Near tiles get the detailed models, far ones the simple ones; far tiles draw only part of their trees
     * (q = quality preset: treeNear, treeFar, treeFarKeep, hedgeLow, casterK). Call a few times a second.
     */
    updLOD(x, z, shadowR, q) {
      updCasters(x, z, shadowR * (q.casterK ?? 1) + 12);
      const near = q.treeNear ?? NEAR, far = q.treeFar ?? Infinity, keep = q.treeFarKeep ?? 1;
      for (const m of meshes) {
        const b = m.userData.box, d = Math.hypot(Math.max(0, b.x0 - x, x - b.x1), Math.max(0, b.z0 - z, z - b.z1));
        const lv = !!q.leaves && d < near && m.userData.geo[2]; // with leaf cards the clusters inside are a little smaller
        m.geometry = m.userData.geo[d >= near ? 1 : lv ? 2 : 0];
        // thin only tiles made of playable-area trees; mixed and scenery tiles follow setDensity alone
        const thin = d >= far && m.userData.solid === m.userData.ranks.length;
        m.count = thin ? Math.ceil(m.userData.base * keep) : m.userData.base;
        const lm = m.userData.leaves;
        if (lm) { lm.visible = !!lv && m.count > 0; lm.count = m.count; }
      }
      hedges.geometry = q.hedgeLow ? bushLow : bushGeo;
    },
    /** 0..2: share of the scenery trees outside the playable area (0.5 at density 1, all at 2). */
    setDensity(d) {
      const keep = Math.min(1, d / 2);
      for (const m of meshes) {
        const r = m.userData.ranks;
        let n = 0;
        while (n < r.length && (r[n] === 0 || r[n] < keep)) n++;
        m.count = m.userData.base = n;
      }
    },
  };
}
