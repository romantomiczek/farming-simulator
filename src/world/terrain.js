import * as THREE from 'three';
import { col, smooth, fbm, hash2, clamp } from '../core/util.js';

/** Height of the ground. The valley floor around the farm is exactly flat (0). */
export function terrainH(x, z) {
  const dx = Math.max(0, Math.abs(x) - 108), dz = Math.max(0, Math.abs(z - 25) - 123);
  const d = Math.hypot(dx, dz);
  if (d <= 0) return 0;
  return smooth(0, 70, d) * (6 + 24 * fbm(x * 0.012 + 3, z * 0.012 + 7)) + smooth(0, 30, d) * fbm(x * 0.05, z * 0.05) * 3;
}

export function buildTerrain(scene) {
  const g = new THREE.PlaneGeometry(1000, 1000, 150, 150);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, 25);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, terrainH(p.getX(i), p.getZ(i)));
  const t = g.toNonIndexed();
  g.dispose();
  t.computeVertexNormals();
  const pos = t.attributes.position, n = pos.count;
  const cols = new Float32Array(n * 3);
  const grass = ['#8fb556', '#86ad4f', '#97ba5c', '#80a84c'].map(col);
  const patch = { gold: col('#dcc276'), light: col('#b7cf7d'), brown: col('#a37c5a'), mint: col('#9cc58c') };
  const c = new THREE.Color();
  for (let f = 0; f < n; f += 3) {
    const cx = (pos.getX(f) + pos.getX(f + 1) + pos.getX(f + 2)) / 3;
    const cz = (pos.getZ(f) + pos.getZ(f + 1) + pos.getZ(f + 2)) / 3;
    const cy = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3;
    c.copy(grass[Math.floor(clamp(fbm(cx * 0.03, cz * 0.03) * 1.4 - 0.1, 0, 0.999) * 4)]);
    if (cy > 2.5) {
      // distant patchwork of fields on the hills
      const r = hash2(Math.floor((cx + 1000) / 46), Math.floor((cz + 1000) / 34));
      if (r < 0.2) c.copy(patch.gold);
      else if (r < 0.34) c.copy(patch.light);
      else if (r < 0.41) c.copy(patch.brown);
      else if (r < 0.47) c.copy(patch.mint);
    }
    c.multiplyScalar(cy > 0.5 ? 0.94 + hash2(cx, cz) * 0.1 : 0.98 + hash2(cx, cz) * 0.04);
    for (let k = 0; k < 3; k++) { cols[(f + k) * 3] = c.r; cols[(f + k) * 3 + 1] = c.g; cols[(f + k) * 3 + 2] = c.b; }
  }
  t.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const m = new THREE.Mesh(t, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  m.receiveShadow = true;
  scene.add(m);
  return m;
}
