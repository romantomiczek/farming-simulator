import * as THREE from 'three';
import { scene } from '../render/core.js';
import { col } from '../core/util.js';

// Dust, chaff, exhaust and grain stream: one instanced mesh, ring buffer of particles.
const PMAX = 320;
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const mesh = new THREE.InstancedMesh(
  new THREE.IcosahedronGeometry(0.4, 0),
  new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }),
  PMAX,
);
mesh.frustumCulled = false;
scene.add(mesh);
/** The particle mesh (the developer panel can hide it). */
export const particleMesh = mesh;

const P = {
  x: new Float32Array(PMAX), y: new Float32Array(PMAX), z: new Float32Array(PMAX),
  vx: new Float32Array(PMAX), vy: new Float32Array(PMAX), vz: new Float32Array(PMAX),
  life: new Float32Array(PMAX).fill(9), max: new Float32Array(PMAX).fill(1),
  size: new Float32Array(PMAX), g: new Float32Array(PMAX),
};
const white = new THREE.Color(0xffffff);
for (let i = 0; i < PMAX; i++) { mesh.setMatrixAt(i, ZERO); mesh.setColorAt(i, white); }
let idx = 0, alive = 0;
const _m = new THREE.Matrix4();

export const CHAFF = col('#eadba6');
export const SMOKE = col('#8b8f8f');

export function emit(x, y, z, color, size, vx, vy, vz, life, grav = 0) {
  const i = idx; idx = (idx + 1) % PMAX;
  P.x[i] = x; P.y[i] = y; P.z[i] = z; P.vx[i] = vx; P.vy[i] = vy; P.vz[i] = vz;
  P.life[i] = 0; P.max[i] = life; P.size[i] = size; P.g[i] = grav;
  mesh.setColorAt(i, color);
  alive = PMAX;
}

export function updParticles(dt) {
  if (!alive) return; // nothing to animate, skip the buffer upload
  let n = 0;
  for (let i = 0; i < PMAX; i++) {
    if (P.life[i] >= P.max[i]) continue;
    P.life[i] += dt;
    const t = P.life[i] / P.max[i];
    if (t >= 1) { mesh.setMatrixAt(i, ZERO); continue; }
    n++;
    P.vy[i] -= P.g[i] * dt;
    P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; P.z[i] += P.vz[i] * dt;
    const s = P.size[i] * (0.5 + t * 1.6) * (1 - t * t);
    _m.makeScale(s, s, s); _m.setPosition(P.x[i], P.y[i], P.z[i]);
    mesh.setMatrixAt(i, _m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  if (!n) alive = 0;
}
