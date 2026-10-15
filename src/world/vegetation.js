import * as THREE from 'three';
import { M } from '../render/materials.js';
import { addWind } from '../render/wind.js';
import { rng, lerp, col } from '../core/util.js';
import { terrainH } from './terrain.js';
import { FIELD_DEFS, ROADS, PAD, POND, NO_TREES, BOUNDS, circles, addBox } from './layout.js';

/**
 * Trees on the hills and in the valley, plus hedgerows along the outer field edges.
 * Everything is instanced (3 draw calls). Valley trees and hedges come first in each
 * instance buffer and are always drawn (they have collisions), then hill trees, then an extra
 * batch of hill trees for "Ultra"; the quality preset trims the tail via InstancedMesh.count.
 */
export function buildVegetation(scene) {
  const R = rng(7), dummy = new THREE.Object3D();
  const blocked = (x, z, m) => {
    const inRect = (x0, x1, z0, z1) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m;
    for (const f of FIELD_DEFS) if (inRect(f.x0, f.x0 + f.w, f.z0, f.z0 + f.h)) return true;
    for (const r of ROADS) if (inRect(r.x0, r.x1, r.z0, r.z1)) return true;
    for (const r of NO_TREES) if (inRect(r.x0, r.x1, r.z0, r.z1)) return true;
    if (inRect(PAD.x0 - 2, PAD.x1 + 2, PAD.z0 - 2, PAD.z1 + 2)) return true;
    if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 3 + m) return true;
    return false;
  };

  const valley = [], hills = [];
  for (let a = 0; a < 3200; a++) {
    const x = (R() - 0.5) * 900 + 77, z = (R() - 0.5) * 700 + 30;
    const h = terrainH(x, z);
    const inFlat = h < 0.01;
    if (inFlat && R() > 0.16) continue;
    if (!inFlat && R() > 0.55) continue;
    if (blocked(x, z, 4)) continue;
    const s = 0.75 + R() * 0.65, conifer = R() < (inFlat ? 0.2 : 0.42);
    const t = { x, y: h, z, s, conifer, r: R() };
    (inFlat ? valley : hills).push(t);
    if (inFlat && x > BOUNDS.x0 - 4 && x < BOUNDS.x1 + 4 && z > BOUNDS.z0 - 4 && z < BOUNDS.z1 + 4) circles.push({ x, z, r: 0.9 * s });
  }

  // a second, independent batch of hill trees used only above density 1 ("Ultra");
  // its own generator so the valley trees and their collisions never change
  const R2 = rng(11), extra = [];
  for (let a = 0; a < 3200; a++) {
    const x = (R2() - 0.5) * 900 + 77, z = (R2() - 0.5) * 700 + 30;
    const h = terrainH(x, z);
    if (h < 0.01 || R2() > 0.55 || blocked(x, z, 4)) continue;
    extra.push({ x, y: h, z, s: 0.75 + R2() * 0.65, conifer: R2() < 0.42, r: R2() });
  }

  const hedge = [];
  const line = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(L / 1.5);
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      hedge.push({ x: lerp(x0, x1, t) + (R() - 0.5) * 0.6, z: lerp(z0, z1, t) + (R() - 0.5) * 0.6, s: 0.8 + R() * 0.6, r: R() });
    }
    addBox(Math.min(x0, x1) - 1, Math.max(x0, x1) + 1, Math.min(z0, z1) - 1, Math.max(z0, z1) + 1);
  };
  // hedges only on the outer sides; the northern ends of fields 3 and 4 border the forest track
  line(-73.5, -6, -73.5, 41); line(-73.5, 55, -73.5, 101); line(53, -6, 53, 41); line(61, 55, 61, 99);

  const trees = valley.concat(hills, extra);
  const decid = trees.filter(t => !t.conifer), conif = trees.filter(t => t.conifer);
  const decidValley = decid.filter(t => t.y < 0.01).length, conifValley = conif.filter(t => t.y < 0.01).length;
  const decidHills = hills.filter(t => !t.conifer).length, conifHills = hills.length - decidHills;

  const greens = ['#6f9a4a', '#7fa653', '#5e8a43', '#93ad5a', '#86a24c'].map(col);
  const coneCols = ['#4f7a4a', '#5b8650', '#46704a'].map(col);
  const c = new THREE.Color();

  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 1, 6); trunkGeo.translate(0, 0.5, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, M('#7b6150'), trees.length);
  // trunks in the same order as crowns+cones so one count works for both
  const trunkOrder = decid.concat(conif);
  trunkOrder.forEach((t, i) => {
    dummy.position.set(t.x, t.y, t.z); dummy.rotation.set(0, 0, 0);
    dummy.scale.set(t.s, (t.conifer ? 1.4 : 2.4) * t.s, t.s); dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
  });

  // own material (not the shared white one): its colour is the season tint for leaves and hedges
  const leafMat = addWind(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, flatShading: true }), { amp: 0.04, base: -1, spatial: 0.05 });
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), leafMat, hedge.length + decid.length);
  hedge.forEach((t, i) => {
    dummy.position.set(t.x, 0.75 * t.s, t.z); dummy.rotation.set(0, t.r * 6, 0); dummy.scale.set(1.3 * t.s, t.s, 1.3 * t.s); dummy.updateMatrix();
    crowns.setMatrixAt(i, dummy.matrix); crowns.setColorAt(i, c.copy(greens[2 + ((t.r * 3) | 0)]).multiplyScalar(0.85 + t.r * 0.2));
  });
  decid.forEach((t, k) => {
    const i = hedge.length + k;
    dummy.position.set(t.x, t.y + 3.9 * t.s, t.z); dummy.rotation.set(0, t.r * 6, 0); dummy.scale.set(2.2 * t.s, 2.0 * t.s, 2.2 * t.s); dummy.updateMatrix();
    crowns.setMatrixAt(i, dummy.matrix); crowns.setColorAt(i, c.copy(greens[(t.r * 5) | 0]).multiplyScalar(0.92 + t.r * 0.14));
  });

  const coneGeo = new THREE.ConeGeometry(1, 1, 7); coneGeo.translate(0, 0.5, 0);
  // own material (the shared white one is used elsewhere) so only the conifers get the wind
  const coneMat = addWind(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, flatShading: true }), { amp: 0.02, base: 0.15, spatial: 0.05 });
  const cones = new THREE.InstancedMesh(coneGeo, coneMat, conif.length);
  conif.forEach((t, i) => {
    dummy.position.set(t.x, t.y + t.s, t.z); dummy.rotation.set(0, t.r * 6, 0); dummy.scale.set(1.8 * t.s, 6.2 * t.s, 1.8 * t.s); dummy.updateMatrix();
    cones.setMatrixAt(i, dummy.matrix); cones.setColorAt(i, coneCols[(t.r * 3) | 0]);
  });

  for (const m of [trunks, crowns, cones]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }

  return {
    leafMat,
    /** 0..1 = share of the hill trees to draw, 1..2 adds the extra batch. Trunks are reordered to match, see trunkOrder. */
    setDensity(d) {
      const pick = (valleyN, hillN, all) => valleyN + Math.round(hillN * Math.min(1, d)) + Math.round((all - valleyN - hillN) * Math.max(0, d - 1));
      const nd = pick(decidValley, decidHills, decid.length);
      const nc = pick(conifValley, conifHills, conif.length);
      crowns.count = hedge.length + nd;
      cones.count = nc;
      // trunk buffer: [decid..., conif...]; rebuild the visible prefix order once per change
      let i = 0;
      const put = t => { dummy.position.set(t.x, t.y, t.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(t.s, (t.conifer ? 1.4 : 2.4) * t.s, t.s); dummy.updateMatrix(); trunks.setMatrixAt(i++, dummy.matrix); };
      decid.slice(0, nd).forEach(put); conif.slice(0, nc).forEach(put);
      trunks.count = i;
      trunks.instanceMatrix.needsUpdate = true;
    },
  };
}
