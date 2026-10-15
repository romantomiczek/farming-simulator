import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { col } from '../core/util.js';
import { addSnow } from './snow.js';

const cache = new Map();
/** Shared flat-shaded material per colour + options, so meshes can be merged by material. */
export function M(hex, opts) {
  const k = hex + (opts ? JSON.stringify(opts) : '');
  if (!cache.has(k)) {
    cache.set(k, new THREE.MeshStandardMaterial(Object.assign({ color: col(hex), roughness: 0.88, metalness: 0, flatShading: true }, opts || {})));
  }
  return cache.get(k);
}

export function mk(geo, mat, x, y, z, parent, cast = true) {
  const m = new THREE.Mesh(geo, typeof mat === 'string' ? M(mat) : mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
export const B = (w, h, d, mat, x, y, z, p) => mk(new THREE.BoxGeometry(w, h, d), mat, x, y, z, p);
export const CY = (rt, rb, h, seg, mat, x, y, z, p) => mk(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, p);

/** Flat ground decal (road, pad, field border) lying on the terrain. */
export function flatPlane(w, d, hex, x, y, z, parent, opts) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M(hex, Object.assign({ flatShading: false, roughness: 1 }, opts || {})));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export const glassMat = new THREE.MeshStandardMaterial({ color: col('#b7dbe0'), roughness: 0.1, metalness: 0.15, transparent: true, opacity: 0.5 });
export const lampMat = new THREE.MeshStandardMaterial({ color: col('#fff4d6'), emissive: col('#ffe2a0'), emissiveIntensity: 0 });
export const beaconMat = new THREE.MeshStandardMaterial({ color: col('#f0a03a'), emissive: col('#ff9a2a'), emissiveIntensity: 0.4 });

/**
 * Moves every mesh inside nested groups of a static root up to the root (keeping its world
 * transform), so bake() can merge all of them by material. Only for things that never move.
 * The root must not be in the scene yet (identity transform).
 */
export function flatten(root) {
  root.updateMatrixWorld(true);
  const meshes = [];
  root.traverse(o => { if (o.isMesh && o.parent !== root) meshes.push(o); });
  for (const m of meshes) root.attach(m);
  for (const g of [...root.children]) if (!g.isMesh && g.children.length === 0) root.remove(g);
  return root;
}

const KEEP_ATTR = new Set(['position', 'normal', 'uv']);
const baseCompile = THREE.Material.prototype.onBeforeCompile;
/** A plain coloured material: no texture, transparency, glow or shader tweaks, so its colour can move into the vertices. */
const plain = m => m.isMeshStandardMaterial && !m.map && !m.transparent && m.opacity === 1 && !m.vertexColors &&
  m.emissive.r + m.emissive.g + m.emissive.b === 0 && m.onBeforeCompile === baseCompile;
const vcCache = new Map();
/** Shared vertex-coloured material for merged plain meshes with the same surface settings (with or without winter snow). */
function vcMat(m, snowy) {
  const k = [m.roughness, m.metalness, m.flatShading, m.side, snowy].join('|');
  if (!vcCache.has(k)) {
    const vm = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: m.roughness, metalness: m.metalness, flatShading: m.flatShading, side: m.side });
    vcCache.set(k, snowy ? addSnow(vm) : vm);
  }
  return vcCache.get(k);
}
/**
 * Merges the leaf meshes of every group into as few meshes as possible. Plain coloured materials are
 * merged together with their colours stored in the vertices (one mesh per surface type, e.g. a whole
 * machine body), the others (glass, lamps, textures) one mesh per material. Shadow flags are kept.
 * Sub-groups stay separate, so moving parts (wheels, lifts, reels) keep working.
 * This cuts draw calls from hundreds to a few dozen, which matters most on integrated GPUs.
 * Meshes with userData.noBake, multi-material meshes and instanced meshes are left alone.
 * opts.snow = false: no winter snow on the merged surfaces (machines).
 */
export function bake(root, opts = {}) {
  const snowy = opts.snow !== false;
  const visit = node => {
    const groups = new Map();
    for (const ch of [...node.children]) {
      const leaf = ch.isMesh && !ch.isInstancedMesh && ch.children.length === 0 && !Array.isArray(ch.material) && !ch.userData.noBake;
      if (!leaf) { if (!ch.isLight) visit(ch); continue; }
      const vc = plain(ch.material), mat = vc ? vcMat(ch.material, snowy) : ch.material;
      const key = mat.uuid + (ch.castShadow ? '|c' : '') + (ch.receiveShadow ? '|r' : '');
      if (!groups.has(key)) groups.set(key, { mat, cast: ch.castShadow, recv: ch.receiveShadow, geos: [] });
      ch.updateMatrix();
      const g = ch.geometry.index ? ch.geometry.toNonIndexed() : ch.geometry.clone();
      g.applyMatrix4(ch.matrix);
      for (const name of Object.keys(g.attributes)) if (!KEEP_ATTR.has(name)) g.deleteAttribute(name);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (vc) {
        const n = g.attributes.position.count, cols = new Float32Array(n * 3), c = ch.material.color; // linear, like the material colour
        for (let i = 0; i < n; i++) { cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
        g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      }
      g.clearGroups();
      groups.get(key).geos.push(g);
      node.remove(ch);
      ch.geometry.dispose();
    }
    for (const { mat, cast, recv, geos } of groups.values()) {
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos);
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = cast; m.receiveShadow = recv;
      node.add(m);
    }
  };
  visit(root);
  return root;
}
