import * as THREE from 'three';
import { M } from '../render/materials.js';
import { rng, lerp, col } from '../core/util.js';
import { terrainH } from './terrain.js';
import { FIELD_DEFS, POND, circles, addBox } from './layout.js';

/**
 * Trees on the hills and in the valley, plus hedgerows along the outer field edges.
 * Everything is instanced (3 draw calls). Valley trees and hedges come first in each
 * instance buffer and are always drawn (they have collisions); hill trees are thinned
 * by the quality preset via InstancedMesh.count.
 */
export function buildVegetation(scene) {
  const R = rng(7), dummy = new THREE.Object3D();
  const blocked = (x, z, m) => {
    for (const f of FIELD_DEFS) if (x > f.x0 - m && x < f.x0 + f.w + m && z > f.z0 - m && z < f.z0 + f.h + m) return true;
    if (x > -14 - m && x < -6 + m && z > -52 && z < 108) return true;
    if (z > 44 - m && z < 52 + m && x > -76 && x < 64) return true;
    if (x > -48 - m && x < 28 + m && z > -54 - m && z < -10 + m) return true;
    if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 3 + m) return true;
    return false;
  };

  const valley = [], hills = [];
  for (let a = 0; a < 2600; a++) {
    const x = (R() - 0.5) * 760, z = (R() - 0.5) * 700 + 30;
    const h = terrainH(x, z);
    const inFlat = h < 0.01;
    if (inFlat && R() > 0.16) continue;
    if (!inFlat && R() > 0.55) continue;
    if (blocked(x, z, 4)) continue;
    const s = 0.75 + R() * 0.65, conifer = R() < (inFlat ? 0.2 : 0.42);
    const t = { x, y: h, z, s, conifer, r: R() };
    (inFlat ? valley : hills).push(t);
    if (inFlat && Math.abs(x) < 104 && z > -94 && z < 144) circles.push({ x, z, r: 0.9 * s });
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
  line(-73.5, -6, -73.5, 41); line(-73.5, 55, -73.5, 101); line(53, -6, 53, 41); line(61, 55, 61, 99);
  line(-70, 103, -20, 103); line(0, 101, 58, 101);

  const trees = valley.concat(hills);
  const decid = trees.filter(t => !t.conifer), conif = trees.filter(t => t.conifer);
  const decidValley = decid.filter(t => t.y < 0.01).length, conifValley = conif.filter(t => t.y < 0.01).length;

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

  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), M('#ffffff'), hedge.length + decid.length);
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
  const cones = new THREE.InstancedMesh(coneGeo, M('#ffffff'), conif.length);
  conif.forEach((t, i) => {
    dummy.position.set(t.x, t.y + t.s, t.z); dummy.rotation.set(0, t.r * 6, 0); dummy.scale.set(1.8 * t.s, 6.2 * t.s, 1.8 * t.s); dummy.updateMatrix();
    cones.setMatrixAt(i, dummy.matrix); cones.setColorAt(i, coneCols[(t.r * 3) | 0]);
  });

  for (const m of [trunks, crowns, cones]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }

  return {
    /** 0..1 share of hill trees to draw. Trunks are reordered to match, see trunkOrder. */
    setDensity(d) {
      const nd = decidValley + Math.round((decid.length - decidValley) * d);
      const nc = conifValley + Math.round((conif.length - conifValley) * d);
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
