import * as THREE from 'three';
import { scene } from '../render/core.js';
import { ROADS, BOUNDS } from '../world/layout.js';
import { groundH } from '../world/terrain.js';
import { rng } from '../core/util.js';

/**
 * Wet ground after rain: puddles on the roads (they shine and fade as the ground dries) and darker
 * fields and grass (environment.js and fields.js darken by wetness()). wet = 1 while it rains, then
 * it dries over the hours until WX.wetUntil.
 */
const R = rng(4242), spots = [];
for (const r of ROADS) {
  for (let k = 1; k < r.pts.length; k++) {
    const [x0, z0] = r.pts[k - 1], [x1, z1] = r.pts[k], L = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / L, uz = (z1 - z0) / L;
    for (let d = 5; d < L - 5; d += 9 + R() * 14) {
      if (R() < 0.35) continue;
      const across = (R() - 0.5) * r.w * 0.6, x = x0 + ux * d - uz * across, z = z0 + uz * d + ux * across;
      if (x < BOUNDS.x0 || x > BOUNDS.x1 || z < BOUNDS.z0 || z > BOUNDS.z1) continue;
      spots.push({ x, z, a: Math.atan2(ux, uz) + (R() - 0.5) * 0.6, sx: 1 + R() * 2.2, sz: 0.7 + R() * 1.2 });
    }
  }
}
const mat = new THREE.MeshStandardMaterial({
  color: 0x5d6c74, roughness: 0.08, metalness: 0.35, transparent: true, opacity: 0, depthWrite: false,
  polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
});
const puddles = new THREE.InstancedMesh(new THREE.CircleGeometry(0.5, 12).rotateX(-Math.PI / 2), mat, spots.length);
{
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  spots.forEach((o, i) => { m.compose(p.set(o.x, groundH(o.x, o.z) + 0.05, o.z), q.setFromAxisAngle(Y, o.a), s.set(o.sx, 1, o.sz)); puddles.setMatrixAt(i, m); });
}
puddles.visible = false; puddles.receiveShadow = true; puddles.renderOrder = 1;
scene.add(puddles);

let wet = 0;
/** Are the puddles showing (for the smoke test)? */
export const puddlesShown = () => puddles.visible;
/** How wet the ground is now, 0..1 (smoothed). */
export const wetness = () => wet;
/** Every frame: rain 0..1, gameMin and wetUntil (game minutes) of the weather; winter = frozen, no puddles. */
export function updWet(dt, rain, gameMin, wetUntil, winter) {
  const drying = gameMin < wetUntil ? Math.min(1, (wetUntil - gameMin) / 90) : 0;
  const target = winter ? 0 : Math.max(Math.min(1, rain * 1.6), drying);
  wet += (target - wet) * Math.min(1, dt * (target > wet ? 0.5 : 0.08));
  puddles.visible = wet > 0.04;
  mat.opacity = wet * 0.75;
}
