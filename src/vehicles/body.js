import * as THREE from 'three';
import { clamp } from '../core/util.js';

/**
 * Collision bodies of machines. A machine is one or more rectangles (parts) in its own frame,
 * measured from its 3D model: the body (without the unloading pipe and the crane, which reach over
 * things), the header of a combine or beet harvester and a hitched implement. Obstacles are circles
 * (trees, posts, trailers, traffic), axis-aligned boxes (buildings) and other machines' rectangles.
 * A contact has a normal (the way the machine has to go), a depth and the point where it touches.
 * resolve() pushes the machine out and turns it about that point, takes the speed into the obstacle
 * away (with a little bounce) and keeps the speed along it (with some friction): a machine slides
 * along a wall, and a corner that hits swings it round.
 *
 * Frames: a machine at (x, z) with heading h has its local z axis (forward) along (sin h, cos h)
 * and its local x axis (left) along (cos h, −sin h); turning by dh moves a point at arm a by
 * dh·(a.z, −a.x).
 */

const _b = new THREE.Box3(), _inv = new THREE.Matrix4(), _m = new THREE.Matrix4();
/** Footprint { x0, x1, z0, z1 } of the meshes under root, in the frame of object frame, without the subtrees in skip. */
export function footprint(root, frame = root, skip = []) {
  frame.updateMatrixWorld(true);
  _inv.copy(frame.matrixWorld).invert();
  const fp = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  (function add(o) {
    if (skip.includes(o)) return;
    if (o.isMesh && o.geometry) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      _b.copy(o.geometry.boundingBox).applyMatrix4(_m.multiplyMatrices(_inv, o.matrixWorld));
      fp.x0 = Math.min(fp.x0, _b.min.x); fp.x1 = Math.max(fp.x1, _b.max.x);
      fp.z0 = Math.min(fp.z0, _b.min.z); fp.z1 = Math.max(fp.z1, _b.max.z);
    }
    for (const k of o.children) add(k);
  })(root);
  return fp;
}
/** A rectangle part { cx, cz, hx, hz } from a footprint, a few centimetres smaller (mirrors, lamps). */
export const partOf = (fp, dz = 0, shrink = 0.06) =>
  ({ cx: (fp.x0 + fp.x1) / 2, cz: (fp.z0 + fp.z1) / 2 + dz, hx: Math.max(0.2, (fp.x1 - fp.x0) / 2 - shrink), hz: Math.max(0.2, (fp.z1 - fp.z0) / 2 - shrink) });

/** The part in the world: centre, axes and half sizes; R = radius of a circle around it. */
export function worldPart(v, p, out = {}) {
  const s = Math.sin(v.h), c = Math.cos(v.h);
  out.x = v.x + p.cx * c + p.cz * s; out.z = v.z - p.cx * s + p.cz * c;
  out.axx = c; out.axz = -s; out.azx = s; out.azz = c;
  out.hx = p.hx; out.hz = p.hz; out.R = Math.hypot(p.hx, p.hz);
  return out;
}
/** An axis-aligned box { x0, x1, z0, z1 } as a world part. */
export function boxPart(b, out = {}) {
  out.x = (b.x0 + b.x1) / 2; out.z = (b.z0 + b.z1) / 2;
  out.axx = 1; out.axz = 0; out.azx = 0; out.azz = 1;
  out.hx = (b.x1 - b.x0) / 2; out.hz = (b.z1 - b.z0) / 2; out.R = Math.hypot(out.hx, out.hz);
  return out;
}

/* ---------- contacts: { nx, nz (push direction for the part), d (depth), px, pz (point) } ---------- */
/** Part o against circle c { x, z, r }. */
export function partCircle(o, c, out) {
  const dx = c.x - o.x, dz = c.z - o.z;
  if (dx * dx + dz * dz > (o.R + c.r) ** 2) return null;
  const lx = dx * o.axx + dz * o.axz, lz = dx * o.azx + dz * o.azz;
  const qx = clamp(lx, -o.hx, o.hx), qz = clamp(lz, -o.hz, o.hz);
  let nlx, nlz, d;
  if (qx === lx && qz === lz) {
    // the circle's centre is inside: out through the nearest side
    const ex = o.hx - Math.abs(lx), ez = o.hz - Math.abs(lz);
    if (ex < ez) { nlx = -Math.sign(lx) || 1; nlz = 0; d = ex + c.r; } else { nlx = 0; nlz = -Math.sign(lz) || 1; d = ez + c.r; }
    out.px = c.x; out.pz = c.z;
  } else {
    const ex = lx - qx, ez = lz - qz, len = Math.hypot(ex, ez);
    if (len >= c.r) return null;
    nlx = -ex / len; nlz = -ez / len; d = c.r - len;
    out.px = o.x + qx * o.axx + qz * o.azx; out.pz = o.z + qx * o.axz + qz * o.azz;
  }
  out.nx = nlx * o.axx + nlz * o.azx; out.nz = nlx * o.axz + nlz * o.azz; out.d = d;
  return out;
}

const corners = (o, k) => {
  const sx = k & 1 ? 1 : -1, sz = k & 2 ? 1 : -1;
  return [o.x + sx * o.hx * o.axx + sz * o.hz * o.azx, o.z + sx * o.hx * o.axz + sz * o.hz * o.azz];
};
const inside = (o, x, z) => {
  const dx = x - o.x, dz = z - o.z, lx = dx * o.axx + dz * o.axz, lz = dx * o.azx + dz * o.azz;
  return Math.abs(lx) <= o.hx + 1e-6 && Math.abs(lz) <= o.hz + 1e-6;
};
const tp = { x: 0, z: 0, n: 0 };
/** Middle of p's corners inside q that reach deepest along (nx, nz), into tp; false if none is inside. */
function touch(p, q, nx, nz) {
  let deep = -Infinity;
  const pts = [];
  for (let k = 0; k < 4; k++) {
    const [x, z] = corners(p, k);
    if (inside(q, x, z)) { const d = x * nx + z * nz; pts.push([x, z, d]); deep = Math.max(deep, d); }
  }
  tp.n = 0; tp.x = 0; tp.z = 0;
  for (const [x, z, d] of pts) if (d > deep - 0.05) { tp.x += x; tp.z += z; tp.n++; }
  if (tp.n) { tp.x /= tp.n; tp.z /= tp.n; }
  return tp.n > 0;
}
/** Part a against part b (rectangles, separating axes). */
export function partPart(a, b, out) {
  const dx = b.x - a.x, dz = b.z - a.z;
  if (dx * dx + dz * dz > (a.R + b.R) ** 2) return null;
  let best = Infinity, nx = 0, nz = 0;
  for (const [lx, lz] of [[a.axx, a.axz], [a.azx, a.azz], [b.axx, b.axz], [b.azx, b.azz]]) {
    const ra = a.hx * Math.abs(a.axx * lx + a.axz * lz) + a.hz * Math.abs(a.azx * lx + a.azz * lz);
    const rb = b.hx * Math.abs(b.axx * lx + b.axz * lz) + b.hz * Math.abs(b.azx * lx + b.azz * lz);
    const dist = dx * lx + dz * lz, over = ra + rb - Math.abs(dist);
    if (over <= 0) return null;
    if (over < best) { best = over; const sg = dist > 0 ? -1 : 1; nx = lx * sg; nz = lz * sg; }
  }
  // the touching point: the deepest corners of one rectangle inside the other (two corners equally
  // deep = a flat side: their middle), else between the two
  let px = a.x + dx / 2, pz = a.z + dz / 2;
  if (touch(a, b, -nx, -nz) || touch(b, a, nx, nz)) { px = tp.x; pz = tp.z; }
  out.nx = nx; out.nz = nz; out.d = best; out.px = px; out.pz = pz;
  return out;
}

/**
 * Pushes machine v out of its deepest contacts (up to four rounds) and answers the first one with an
 * impulse. contacts(v, keep) calls keep(contact) for every contact of v's parts in its current place.
 * Returns the speed (m/s) at which v ran into the obstacle (0 when it only touched).
 */
export function resolve(v, contacts) {
  let impact = 0;
  const I = v.inertia;
  for (let pass = 0; pass < 4; pass++) {
    let best = null;
    contacts(v, c => { if (!best || c.d > best.d) best = { ...c }; });
    if (!best || best.d < 0.002) break;
    const { nx, nz, d } = best, ax = best.px - v.x, az = best.pz - v.z;
    const k = az * nx - ax * nz, J = d / (1 + (k * k) / I);
    v.x += nx * J; v.z += nz * J; v.h += clamp((k * J) / I, -0.04, 0.04);
    if (pass) continue;
    // velocity of the touching point: forward speed, side slip (at the origin) and turning
    const s = Math.sin(v.h), c = Math.cos(v.h), lat = (v.lat || 0) - (v.yaw || 0) * v.pivotZ;
    let Vx = s * v.speed + c * lat, Vz = c * v.speed - s * lat, w = v.yaw || 0;
    const vn = (Vx + w * az) * nx + (Vz - w * ax) * nz;
    if (vn >= 0) continue; // already moving away
    impact = -vn;
    const j = (-(1 + 0.15) * vn) / (1 + (k * k) / I); // a little bounce
    Vx += nx * j; Vz += nz * j; w += (k * j) / I;
    // friction along the obstacle
    const tx = -nz, tz = nx, vt = (Vx + w * az) * tx + (Vz - w * ax) * tz, kt = az * tx - ax * tz;
    const jt = clamp(-vt / (1 + (kt * kt) / I), -0.15 * j, 0.15 * j);
    Vx += tx * jt; Vz += tz * jt; w += (kt * jt) / I;
    v.speed = Vx * s + Vz * c;
    v.yaw = w;
    v.lat = Vx * c - Vz * s + w * v.pivotZ;
  }
  return impact;
}
