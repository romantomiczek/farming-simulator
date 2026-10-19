import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng, clamp } from '../core/util.js';

/**
 * Tree and bush models, built once from code. Every geometry is non-indexed with position, normal,
 * colour and a "leaf" flag (1 = foliage, which takes the season tint). Crowns are lumpy clusters
 * (broadleaves) or drooping tiers of branches (spruce); their normals lean out from the middle of
 * the crown, so the light falls on the crown as a whole and it shades softly instead of facet by
 * facet. Colours carry the light inside the crown: dark underneath and deep inside, lighter on top
 * and at the tips. detail 1 = near model, 0 = far model (and the shadow casters).
 */

/** Same point → same number: shared corners of a lumpy crown move together, so it has no cracks. */
const h3 = (x, y, z) => {
  const s = Math.sin(Math.round(x * 997) * 0.1271 + Math.round(y * 997) * 0.2695 + Math.round(z * 997) * 0.3117) * 43758.5453;
  return s - Math.floor(s);
};
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3();
const _col = new THREE.Color(), _up = new THREE.Vector3(0, 1, 0);

/** Adds colour and leaf attributes and drops the uv, so all parts merge. */
function finish(g, colorAt, leaf) {
  const p = g.attributes.position, n = p.count, cols = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { colorAt(_a.fromBufferAttribute(p, i), _col, i); cols[i * 3] = _col.r; cols[i * 3 + 1] = _col.g; cols[i * 3 + 2] = _col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.setAttribute('leaf', new THREE.BufferAttribute(new Float32Array(n).fill(leaf), 1));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}

/** Bark: a tapered, slightly bent trunk from y0 to y1. bands = birch bark (dark marks). */
function trunk(y0, y1, r0, r1, seg, bend, hex, bands = null) {
  const h = y1 - y0, g = new THREE.CylinderGeometry(r1, r0, h, seg, bands ? 10 : 3, true).translate(0, y0 + h / 2, 0).toNonIndexed();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = (p.getY(i) - y0) / h; p.setX(i, p.getX(i) + bend * t * t); }
  const base = new THREE.Color(hex), dark = bands ? new THREE.Color(bands) : null;
  return finish(g, (v, c) => {
    const t = (v.y - y0) / h;
    c.copy(base).multiplyScalar(0.7 + 0.3 * t);
    if (dark && h3(Math.round(v.y * 3) / 3, Math.atan2(v.z, v.x) > 0 ? 1 : 0, 0) < 0.38) c.lerp(dark, 0.85);
  }, 0);
}

/** A bough from a to b (it disappears inside the crown). */
function branch(a, b, r, hex) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const g = new THREE.CylinderGeometry(r * 0.5, r, len, 4, 1, true).translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(_up, d.normalize())).translate(a.x, a.y, a.z);
  const c0 = new THREE.Color(hex).multiplyScalar(0.8);
  return finish(g.toNonIndexed(), (v, c) => c.copy(c0), 0);
}

/**
 * A crown made of lumpy clusters. blobs = [{ x, y, z, r, sy }], centre/rad = the whole crown (for the
 * normals and the shading), dark/light = deep-inside and sunlit leaf colours.
 */
function crown(blobs, detail, centre, rad, dark, light, seed) {
  const D = new THREE.Color(dark), L = new THREE.Color(light), top = centre.y + rad.y, bot = centre.y - rad.y;
  const parts = blobs.map((b, k) => {
    const g = new THREE.IcosahedronGeometry(1, detail), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      _a.fromBufferAttribute(p, i);
      const j = 0.74 + 0.5 * h3(_a.x + seed + k * 3.1, _a.y, _a.z);
      p.setXYZ(i, b.x + _a.x * b.r * j, b.y + _a.y * b.r * b.sy * j, b.z + _a.z * b.r * j);
    }
    g.computeVertexNormals(); // non-indexed: face normals
    const nm = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      _a.fromBufferAttribute(p, i).sub(centre); _a.set(_a.x / rad.x, (_a.y + rad.y * 0.25) / rad.y, _a.z / rad.x).normalize();
      _n.fromBufferAttribute(nm, i).multiplyScalar(0.3).add(_a.multiplyScalar(0.7)).normalize();
      nm.setXYZ(i, _n.x, _n.y, _n.z);
    }
    const tint = 0.9 + 0.2 * h3(k + seed, 1, 2);
    return finish(g, (v, c) => {
      const up = clamp((v.y - bot) / (top - bot), 0, 1);
      _b.copy(v).sub(centre);
      const out = clamp(Math.hypot(_b.x / rad.x, _b.y / rad.y, _b.z / rad.x), 0, 1);
      const lit = clamp(0.15 + 0.5 * up + 0.45 * out * out + (h3(v.x, v.y, v.z) - 0.5) * 0.2, 0, 1);
      c.copy(D).lerp(L, lit).multiplyScalar(tint);
    }, 1);
  });
  return parts;
}

/** Ring of cluster centres around the crown. */
function ring(R, n, y0, y1, dist, r0, r1, sy) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R() * 0.6, d = dist * (0.8 + R() * 0.35);
    out.push({ x: Math.cos(a) * d, y: y0 + R() * (y1 - y0), z: Math.sin(a) * d, r: r0 + R() * (r1 - r0), sy });
  }
  return out;
}

/** Broadleaf (lime, oak, maple): short trunk, wide round crown of clusters; about 9 m tall. */
export function broadleaf(detail) {
  const R = rng(11), centre = new THREE.Vector3(0, 6.1, 0), rad = new THREE.Vector3(3.2, 2.7, 0);
  const blobs = [{ x: 0.1, y: 6.9, z: -0.1, r: 2.1, sy: 0.85 }, ...ring(R, detail ? 5 : 2, 5.0, 6.4, 1.8, 1.5, 1.9, 0.82)];
  const parts = [trunk(-0.3, 4.4, 0.36, 0.2, detail ? 7 : 4, 0.25, '#5e4a3a')];
  if (detail) for (const b of blobs.slice(1, 4)) parts.push(branch(new THREE.Vector3(0.15, 3.0, 0), new THREE.Vector3(b.x * 0.75, b.y - 0.6, b.z * 0.75), 0.13, '#5e4a3a'));
  parts.push(...crown(blobs, detail, centre, rad, '#243d17', '#86a845', 1));
  return mergeGeometries(parts);
}

/** Birch: slim white trunk with dark marks, a narrow, light and airy crown; about 10 m tall. */
export function birch(detail) {
  const R = rng(23), centre = new THREE.Vector3(0, 6.6, 0), rad = new THREE.Vector3(2.1, 3.3, 0);
  const blobs = [{ x: 0, y: 8.2, z: 0, r: 1.3, sy: 1.3 }, ...ring(R, detail ? 5 : 2, 4.8, 7.6, 1.15, 0.95, 1.3, 1.25)];
  const parts = [trunk(-0.3, 8.6, 0.2, 0.07, detail ? 6 : 4, 0.35, detail ? '#e2ded2' : '#b9b5aa', detail ? '#2f2b27' : null)];
  parts.push(...crown(blobs, detail, centre, rad, '#36551f', '#a2c25a', 2));
  return mergeGeometries(parts);
}

/**
 * Spruce crown of height 1 from y = 0 (radius 1 at the bottom): drooping tiers of branches, each a
 * star-shaped cone whose tips hang lower than the gaps between them, with a dark underside.
 */
export function spruceCrown(detail) {
  const N = detail ? 9 : 4, K = detail ? 8 : 5, D = new THREE.Color('#14281a'), L = new THREE.Color('#4d7444');
  const pos = [], nor = [], cols = [];
  const vert = (x, y, z, nx, ny, nz, shade) => { pos.push(x, y, z); nor.push(nx, ny, nz); _col.copy(D).lerp(L, shade); cols.push(_col.r, _col.g, _col.b); };
  for (let i = 0; i < N; i++) {
    const t = i / N, yb = t * 0.86, tierH = (1 - yb) * (i === N - 1 ? 1 : 0.42), r = Math.pow(1 - t, 0.95) * (0.92 + 0.12 * h3(i, 0, 3));
    const apex = yb + tierH, under = yb + tierH * 0.3, rot = i * 0.9;
    const rim = [];
    for (let j = 0; j < K * 2; j++) {
      const a = rot + (j / (K * 2)) * Math.PI * 2, tip = j % 2 === 0, rr = r * (tip ? 1 : 0.6) * (0.9 + 0.2 * h3(i, j, 1));
      rim.push([Math.cos(a) * rr, yb - (tip ? 0.035 + 0.05 * r : 0), Math.sin(a) * rr, Math.cos(a), Math.sin(a), tip]);
    }
    const lightTop = 0.35 + 0.45 * t;
    for (let j = 0; j < rim.length; j++) {
      const p = rim[j], q = rim[(j + 1) % rim.length];
      // upper side, lit
      vert(0, apex, 0, 0, 1, 0, lightTop * 0.6);
      vert(p[0], p[1], p[2], p[3] * 0.75, 0.66, p[4] * 0.75, p[5] ? lightTop + 0.4 : lightTop * 0.75);
      vert(q[0], q[1], q[2], q[3] * 0.75, 0.66, q[4] * 0.75, q[5] ? lightTop + 0.4 : lightTop * 0.75);
      // underside, in shadow
      vert(0, under, 0, 0, -1, 0, 0);
      vert(q[0], q[1], q[2], q[3] * 0.5, -0.5, q[4] * 0.5, 0.12);
      vert(p[0], p[1], p[2], p[3] * 0.5, -0.5, p[4] * 0.5, 0.12);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.setAttribute('leaf', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3).fill(1), 1));
  // upper triangles face up, the underside faces down (as their normals say)
  const p = g.attributes.position, nm = g.attributes.normal;
  for (let i = 0; i < p.count; i += 3) {
    _a.fromBufferAttribute(p, i); _b.fromBufferAttribute(p, i + 1); _c.fromBufferAttribute(p, i + 2);
    const f = _b.clone().sub(_a).cross(_c.clone().sub(_a));
    const want = nm.getY(i) + nm.getY(i + 1) + nm.getY(i + 2);
    if (Math.sign(f.y) === Math.sign(want) || Math.abs(f.y) < 1e-9) continue;
    for (const attr of [p, nm, g.attributes.color]) {
      const x = attr.getX(i + 1), y = attr.getY(i + 1), z = attr.getZ(i + 1);
      attr.setXYZ(i + 1, attr.getX(i + 2), attr.getY(i + 2), attr.getZ(i + 2));
      attr.setXYZ(i + 2, x, y, z);
    }
  }
  return g;
}

/** Spruce: thin trunk, crown from 1.3 m to the top; about 11 m tall. */
export function spruce(detail) {
  const c = spruceCrown(detail).scale(2.6, 9.9, 2.6).translate(0, 1.3, 0);
  return mergeGeometries([trunk(-0.3, 8.5, 0.3, 0.06, detail ? 6 : 3, 0, '#5b4434'), c]);
}

/** Hedge bush around the origin, about 1 m in radius: two lumps near, one far. */
export function bush(detail) {
  const blobs = detail ? [{ x: -0.25, y: 0, z: 0, r: 0.85, sy: 0.9 }, { x: 0.35, y: 0.15, z: 0.1, r: 0.7, sy: 0.9 }] : [{ x: 0, y: 0, z: 0, r: 1, sy: 0.9 }];
  return mergeGeometries(crown(blobs, detail, new THREE.Vector3(0, 0, 0), new THREE.Vector3(1.1, 0.9, 0), '#22391a', '#6d9440', 3));
}
