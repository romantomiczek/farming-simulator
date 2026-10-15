import * as THREE from 'three';
import { scene } from '../render/core.js';
import { quality } from '../core/settings.js';

// Rain or snow around the camera target: one instanced mesh of thin streaks (or small flakes)
// recycled inside a box that follows the camera. Drop count follows the graphics preset.
const MAX = 900;
const AREA = 70, TOP = 32;
const mat = new THREE.MeshBasicMaterial({ color: 0xc8d6e0, transparent: true, opacity: 0.55, depthWrite: false });
const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 1.1, 0.05), mat, MAX);
mesh.frustumCulled = false; mesh.count = 0;
scene.add(mesh);
const px = new Float32Array(MAX), py = new Float32Array(MAX), pz = new Float32Array(MAX);
for (let i = 0; i < MAX; i++) { px[i] = (Math.random() - 0.5) * AREA; py[i] = Math.random() * TOP; pz[i] = (Math.random() - 0.5) * AREA; }
const m = new THREE.Matrix4();
const COUNTS = { low: 200, medium: 400, high: 600, ultra: 900 };

/** level 0..1 = how hard it rains; snow = slow white flakes instead of streaks. */
export function updRain(dt, target, level, snow) {
  const n = Math.round((COUNTS[quality().key] ?? 280) * level);
  mesh.count = n;
  if (!n) return;
  mat.color.set(snow ? 0xffffff : 0xc8d6e0);
  mat.opacity = snow ? 0.9 : 0.6;
  const fall = snow ? 2.2 : 22, sx = snow ? 3.5 : 1, sy = snow ? 0.12 : 1;
  for (let i = 0; i < n; i++) {
    py[i] -= fall * dt;
    if (snow) px[i] += Math.sin(py[i] * 0.7 + i) * dt * 0.6;
    if (py[i] < 0) { py[i] += TOP; px[i] = (Math.random() - 0.5) * AREA; pz[i] = (Math.random() - 0.5) * AREA; }
    m.makeScale(sx, sy, sx);
    m.setPosition(target.x + px[i], py[i], target.z + pz[i]);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
}
