import * as THREE from 'three';
import { scene } from '../render/core.js';

/**
 * Freshly worked soil: behind a cultivator, plough or seeder the ground is darker for a couple of
 * minutes (moist earth turned up), then it dries to the field's colour. Patches as wide as the
 * tool lie along its path; they darken what is under them (multiply blending), so one instanced
 * mesh draws them all.
 */
const N = 1200, FADE = 120; // patches kept, seconds until a patch has dried
const mat = new THREE.MeshBasicMaterial({
  color: 0xffffff, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  blending: THREE.CustomBlending, blendSrc: THREE.DstColorFactor, blendDst: THREE.ZeroFactor, blendEquation: THREE.AddEquation,
});
const mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, N);
mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.count = 0;
scene.add(mesh);
const born = new Float32Array(N).fill(-1e9);
let next = 0, clock = 0, upT = 0;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), Y = new THREE.Vector3(0, 1, 0);

/** A patch of fresh soil centred at (x, y, z), w wide across heading h and len long; dark = 0..1 how dark. */
export function freshSoil(x, y, z, h, w, len, dark = 1) {
  const i = next; next = (next + 1) % N;
  mesh.count = Math.max(mesh.count, next === 0 ? N : next);
  _m.compose(_p.set(x, y, z), _q.setFromAxisAngle(Y, h), _s.set(w, 1, len));
  mesh.setMatrixAt(i, _m);
  born[i] = clock - (1 - dark) * FADE * 0.5;
  mesh.setColorAt(i, _c.setScalar(1 - 0.32 * dark));
  mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
}

/** How many patches of fresh soil lie on the fields (for the smoke test). */
export const furrowCount = () => mesh.count;

/** Every frame: patches dry out (their colour goes back to white, which leaves the soil as it is). */
export function updFurrows(dt) {
  clock += dt;
  if ((upT -= dt) > 0 || !mesh.count) return;
  upT = 0.5;
  for (let i = 0; i < mesh.count; i++) {
    const t = (clock - born[i]) / FADE;
    mesh.setColorAt(i, _c.setScalar(t >= 1 ? 1 : 1 - 0.32 * (1 - t) * (1 - t)));
  }
  mesh.instanceColor.needsUpdate = true;
}
