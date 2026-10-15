import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { scene } from '../render/core.js';
import { rng, col, clamp } from '../core/util.js';
import { groundH } from './terrain.js';
import { ROADS, RAIL, movers } from './layout.js';
import { playAt } from '../audio.js';

/**
 * Background traffic: a few cars driving the gravel roads (they keep to the right, turn at the
 * ends and wait when a machine stands in their lane) and a short train that runs along the
 * railway every few minutes. Cars and the train push the player's machines (see `movers`).
 * Two instanced meshes for the cars, two for the train.
 */
const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, flatShading: true });
function box(size, pos, hex) {
  const g = new THREE.BoxGeometry(...size).translate(...pos).toNonIndexed();
  const c = col(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.deleteAttribute('uv');
  return g;
}
const wheelGeo = (x, z) => {
  const g = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 8).rotateZ(Math.PI / 2).translate(x, 0.34, z).toNonIndexed();
  const n = g.attributes.position.count, a = new Float32Array(n * 3).fill(0.12);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv');
  return g;
};
// car: white paint (tinted per car by the instance colour), dark windows, black tyres; facing +z
const carGeo = mergeGeometries([
  box([1.7, 0.6, 4.0], [0, 0.6, 0], '#ffffff'), box([1.5, 0.55, 2.1], [0, 1.15, -0.25], '#ffffff'),
  box([1.52, 0.42, 1.9], [0, 1.17, -0.25], '#2e3a44'), box([1.72, 0.12, 0.2], [0, 0.55, 2.0], '#d9d9d0'),
  ...[[-0.8, 1.3], [0.8, 1.3], [-0.8, -1.3], [0.8, -1.3]].map(([x, z]) => wheelGeo(x, z)),
]);
const locoGeo = mergeGeometries([
  box([2.8, 2.6, 14], [0, 2.0, 0], '#c8553f'), box([2.9, 0.5, 14.2], [0, 3.5, 0], '#3a3f42'),
  box([2.6, 0.9, 3], [0, 3.2, 5], '#2e3a44'), box([2.9, 0.6, 14], [0, 0.6, 0], '#3a3f42'),
]);
const wagonGeo = mergeGeometries([
  box([2.8, 2.2, 13], [0, 2.0, 0], '#6f8f7a'), box([2.9, 0.6, 13], [0, 0.6, 0], '#3a3f42'), box([2.6, 0.2, 12.6], [0, 3.15, 0], '#cfc8bb'),
]);

const PAINT = ['#d9d4c6', '#7a9fb4', '#c4473a', '#4d7c5c', '#e0a640', '#5d6268', '#f2f1ec'].map(col);
const LANE = 1.8; // metres right of the centre line
const CAR_SPEED = 11, TRAIN_SPEED = 16;

export function buildTraffic() {
  const R = rng(77);
  const routes = ROADS.filter(r => r.kind === 'road');
  const N = 6;
  const cars = new THREE.InstancedMesh(carGeo, mat, N);
  cars.castShadow = true; cars.receiveShadow = true; cars.frustumCulled = false;
  scene.add(cars);
  const list = Array.from({ length: N }, (_, i) => {
    const road = routes[i % routes.length];
    const c = { road, seg: 0, t: R(), dir: R() < 0.5 ? 1 : -1, speed: CAR_SPEED, x: 0, z: 0, h: 0, r: 2.2, wait: 0 };
    c.seg = (R() * (road.pts.length - 1)) | 0;
    cars.setColorAt(i, PAINT[i % PAINT.length]);
    movers.push(c);
    return c;
  });

  // the train: locomotive and three wagons, enters at one end of the line every few minutes
  const loco = new THREE.InstancedMesh(locoGeo, mat, 1), wagons = new THREE.InstancedMesh(wagonGeo, mat, 3);
  for (const m of [loco, wagons]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); }
  const train = { z: RAIL.z0 - 80, dir: 1, wait: 30, horned: false, cars: [], hits: [] };
  for (let k = 0; k < 4; k++) train.cars.push({ x: RAIL.x, z: -9999 });
  // three collision circles per car, so nothing slips between them
  for (let k = 0; k < 12; k++) { const c = { x: RAIL.x, z: -9999, r: 2.4 }; train.hits.push(c); movers.push(c); }

  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();
  const place = (mesh, i, x, z, h) => {
    const y = groundH(x, z);
    _p.set(x, y, z); _q.setFromEuler(_e.set(0, h, 0)); mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
  };

  return {
    /** ctx = { vehicles, listener } */
    update(dt, ctx) {
      list.forEach((c, i) => {
        const pts = c.road.pts, a = pts[c.seg], b = pts[c.seg + 1];
        const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
        const fx = ux * c.dir, fz = uz * c.dir; // driving direction
        // wait for anything standing in the lane ahead
        let blocked = false;
        for (const v of ctx.vehicles) {
          if (!v.available) continue;
          const rx = v.x - c.x, rz = v.z - c.z, ahead = rx * fx + rz * fz, side = Math.abs(rx * fz - rz * fx);
          if (ahead > 0 && ahead < 10 && side < 3.2) blocked = true;
        }
        c.speed += ((blocked ? 0 : CAR_SPEED) - c.speed) * Math.min(1, dt * (blocked ? 4 : 0.8));
        c.t += (c.speed * dt * c.dir) / L;
        if (c.t > 1 || c.t < 0) {
          const next = c.seg + c.dir;
          if (next < 0 || next >= pts.length - 1) { c.dir = -c.dir; c.t = clamp(c.t, 0, 1); } // U-turn at the end of the road
          else { c.seg = next; c.t = c.dir > 0 ? c.t - 1 : c.t + 1; }
        }
        const px = a[0] + dx * c.t, pz = a[1] + dz * c.t;
        // keep right: the right of the driving direction (fx, fz) is (-fz, fx) in this world (+x is west on screen)
        c.x = px - fz * LANE; c.z = pz + fx * LANE; c.h = Math.atan2(fx, fz);
        place(cars, i, c.x, c.z, c.h);
      });
      cars.instanceMatrix.needsUpdate = true;

      // train
      if (train.wait > 0) {
        train.wait -= dt;
        if (train.wait <= 0) { train.dir = -train.dir; train.z = train.dir > 0 ? RAIL.z0 - 70 : RAIL.z1 + 70; train.horned = false; }
      } else {
        train.z += TRAIN_SPEED * dt * train.dir;
        if (!train.horned && Math.abs(train.z - 48) < 160) { train.horned = true; playAt('horn', RAIL.x, train.z, ctx.listener, 250); }
        if ((train.dir > 0 && train.z > RAIL.z1 + 70) || (train.dir < 0 && train.z < RAIL.z0 - 70)) train.wait = 120 + R() * 120;
      }
      const h = train.dir > 0 ? 0 : Math.PI;
      train.cars.forEach((c, k) => { c.z = train.z - train.dir * k * 14; c.x = RAIL.x; });
      train.hits.forEach((c, k) => { c.z = train.cars[(k / 3) | 0].z + ((k % 3) - 1) * 4.6; });
      place(loco, 0, RAIL.x, train.cars[0].z, h);
      for (let k = 1; k < 4; k++) place(wagons, k - 1, RAIL.x, train.cars[k].z, h);
      loco.instanceMatrix.needsUpdate = true; wagons.instanceMatrix.needsUpdate = true;
    },
    cars: list, train,
  };
}
