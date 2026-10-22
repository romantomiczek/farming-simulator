import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { col } from '../core/util.js';
import { addSnow } from './snow.js';
import { surfaceDetail, sharedGroundDetail } from './textures.js';

/**
 * Surface textures for buildings (opts.tex of M): projected from the three axes in the merged
 * material, so walls and roofs need no texture coordinates. Corrugated sheet, brick, boards,
 * concrete, plaster, sheet with level ribs (silos).
 */
export const TEX = { metal: 1, brick: 2, wood: 3, concrete: 4, plaster: 5, rings: 6, tiles: 7 };

const cache = new Map();
/**
 * Shared flat-shaded material per colour + options, so meshes can be merged by material.
 * opts.tex = a TEX kind: the surface texture once the mesh is merged by bake().
 */
export function M(hex, opts) {
  const k = hex + (opts ? JSON.stringify(opts) : '');
  if (!cache.has(k)) {
    const { tex, ...rest } = opts || {};
    const m = new THREE.MeshStandardMaterial(Object.assign({ color: col(hex), roughness: 0.88, metalness: 0, flatShading: true }, rest));
    if (tex) m.userData.tex = TEX[tex] ?? tex;
    cache.set(k, m);
  }
  return cache.get(k);
}
/** M(hex) with a surface texture (see TEX). */
export const MT = (hex, tex, opts) => M(hex, { ...opts, tex });

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
/** Windows: about two in three light up in the evening (atmosphere.js sets the glow), the rest stay dark. */
export const windowLit = new THREE.MeshStandardMaterial({ color: col('#5d7d8c'), roughness: 0.35, flatShading: true, emissive: col('#ffcc7a'), emissiveIntensity: 0 });
let winSeq = 0;
export const winMat = () => (winSeq++ % 3 === 2 ? M('#5d7d8c') : windowLit);
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
const WHITE = new THREE.Color(1, 1, 1);
const baseCompile = THREE.Material.prototype.onBeforeCompile;
/** A plain coloured material: no texture, transparency, glow or shader tweaks, so its colour can move into the vertices. */
const plain = m => m.isMeshStandardMaterial && !m.map && !m.transparent && m.opacity === 1 && !m.vertexColors &&
  m.emissive.r + m.emissive.g + m.emissive.b === 0 && m.onBeforeCompile === baseCompile;
const vcCache = new Map();
/** Dirt of a machine: a uniform per machine (dirtMaterials()); the rest of the world stays clean. */
const DIRT0 = { value: 0 };
const SURF_TEX = { value: null }, STAIN_TEX = { value: null };
/** Building surfaces (vSurf.z = TEX kind): pattern from the axis the face looks along, soft stains and a darker foot of the wall. */
const SURF_GLSL = `
  float sk = floor(vSurf.z + 0.5);
  // walls: u along the wall, v up; slopes: u along the ridge, v down the slope; flat: plan view.
  // Derivatives are taken here, outside the branch, so the texture reads below are skipped for
  // untextured surfaces (machines) instead of being run for every pixel anyway.
  vec3 sn = normalize(vObjN);
  vec2 hz = sn.xz; float hl = length(hz);
  vec2 dir = hl > 0.05 ? hz / hl : vec2(0.0, 1.0), perp = vec2(-dir.y, dir.x);
  vec2 wuv = abs(sn.y) > 0.92 ? vLocal.xz : abs(sn.y) > 0.3 ? vec2(dot(vLocal.xz, perp), dot(vLocal.xz, dir)) : vec2(dot(vLocal.xz, perp), vLocal.y);
  vec2 suv = vLocal.xz * 0.05 + vLocal.y * 0.031;
  vec2 gx = dFdx(wuv), gy = dFdy(wuv), sgx = dFdx(suv), sgy = dFdy(suv);
  if (sk > 0.5) {
    vec3 st = textureGrad(tSurf, wuv, gx, gy).rgb;
    float stain = textureGrad(tStain, suv, sgx, sgy).b;
    float grain = textureGrad(tStain, wuv * 0.41, gx * 0.41, gy * 0.41).g;
    float m = 1.0;
    if (sk < 1.5) m = 0.55 + 0.9 * st.r;
    else if (sk < 2.5) m = 0.5 + st.g;
    else if (sk < 3.5) m = 0.5 + st.b;
    else if (sk < 4.5) m = 0.78 + 0.44 * grain;
    else if (sk < 5.5) m = 0.9 + 0.2 * grain;
    else if (sk < 6.5) m = 0.55 + 0.9 * textureGrad(tSurf, wuv.yx, gx.yx, gy.yx).r;
    else m = 1.45 - textureGrad(tSurf, wuv * vec2(1.2, 0.33), gx * vec2(1.2, 0.33), gy * vec2(1.2, 0.33)).g;
    float foot = abs(sn.y) > 0.7 ? 1.0 : mix(0.78, 1.0, smoothstep(0.0, 1.4, vLocal.y));
    diffuseColor.rgb *= m * foot * mix(0.8, 1.06, smoothstep(0.25, 0.75, stain));
  }`;
/** Mud on a machine's vertex-coloured surfaces: thicker low down, blotchy (blocky noise suits the low-poly look). */
const DIRT_GLSL = `
  float mudK = 0.0;
  if (uDirt > 0.001) {
    float hgt = clamp(vLocal.y / 2.6, 0.0, 1.0);
    float n1 = fract(sin(dot(floor(vLocal * 2.1), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    float n2 = fract(sin(dot(floor(vLocal * 5.6), vec3(39.3, 11.1, 71.7))) * 24634.63);
    float cover = uDirt * (1.25 - hgt) + (n1 * 0.6 + n2 * 0.4 - 0.5) * 0.55;
    mudK = smoothstep(0.32, 0.55, cover);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.48, 0.38), uDirt * 0.22 * (1.0 - hgt)); // a film of dust
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.30, 0.22, 0.15) * (0.75 + 0.5 * n2), mudK * 0.9);
  }`;
/**
 * Shared vertex-coloured material for merged plain meshes (with or without winter snow). Colour,
 * roughness and metalness come from the vertices (attribute surf = roughness, metalness), and
 * flat-shaded meshes get face normals when merged, so glossy paint, rubber, steel and matt walls
 * of one object all end up in one draw call.
 */
function vcMat(m, snowy, atlas) {
  const k = m.side + '|' + snowy + '|' + (atlas ? atlas.mat.uuid : '');
  if (!vcCache.has(k)) {
    const vm = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, metalness: 1, side: m.side });
    if (atlas) { vm.map = atlas.mat.map; vm.alphaTest = 0.5; }
    // a function (not an arrow): a machine's own copy binds its own dirt uniform (this.userData.dirt)
    vm.onBeforeCompile = function (sh) {
      sh.uniforms.uDirt = this?.userData?.dirt || DIRT0;
      SURF_TEX.value ??= surfaceDetail(); STAIN_TEX.value ??= sharedGroundDetail();
      sh.uniforms.tSurf = SURF_TEX; sh.uniforms.tStain = STAIN_TEX;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 surf;\nvarying vec3 vSurf;\nvarying vec3 vLocal;\nvarying vec3 vObjN;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSurf = surf;\nvLocal = position;\nvObjN = normal;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vSurf;\nvarying vec3 vLocal;\nvarying vec3 vObjN;\nuniform float uDirt;\nuniform sampler2D tSurf;\nuniform sampler2D tStain;')
        .replace('#include <color_fragment>', '#include <color_fragment>' + DIRT_GLSL + SURF_GLSL)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(roughness * vSurf.x, 1.0, mudK);')
        .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = metalness * vSurf.y * (1.0 - mudK);')
        // the sky map (envmap.js) only adds reflections here: the hemisphere light already gives the diffuse light
        .replace('#include <lights_fragment_maps>', THREE.ShaderChunk.lights_fragment_maps.replace('iblIrradiance += getIBLIrradiance( geometryNormal );', ''));
    };
    vm.customProgramCacheKey = () => 'surf';
    vcCache.set(k, snowy ? addSnow(vm) : vm);
  }
  return vcCache.get(k);
}
/**
 * Merges the leaf meshes of every group into as few meshes as possible. Plain coloured materials are
 * merged together with their colours stored in the vertices (one mesh per surface type, e.g. a whole
 * machine body), the others (glass, lamps, textures) one mesh per material. Shadow flags are kept.
 * Sub-groups stay separate, so moving parts (wheels, lifts, reels) keep working; groups marked
 * userData.static (a lamp or wiper placed as a unit) are dissolved into their parent first.
 * This cuts draw calls from hundreds to a few dozen, which matters most on integrated GPUs.
 * Meshes with userData.noBake, multi-material meshes and instanced meshes are left alone.
 * opts.snow = false: no winter snow on the merged surfaces (machines).
 * opts.atlas = { mat, white: [u, v] }: decals drawn with atlas.mat merge with the plain meshes too;
 * the merged material samples the atlas, and plain meshes point at its white texel.
 */
export function bake(root, opts = {}) {
  const snowy = opts.snow !== false;
  root.updateMatrixWorld(true);
  const dissolve = node => {
    for (let found = true; found;) {
      found = false;
      for (const ch of [...node.children]) {
        if (!ch.userData.static) continue;
        for (const m of [...ch.children]) node.attach(m);
        node.remove(ch); found = true;
      }
    }
  };
  const visit = node => {
    dissolve(node);
    const groups = new Map();
    for (const ch of [...node.children]) {
      const leaf = ch.isMesh && !ch.isInstancedMesh && ch.children.length === 0 && !Array.isArray(ch.material) && !ch.userData.noBake;
      if (!leaf) { if (!ch.isLight) visit(ch); continue; }
      const atlas = opts.atlas, decal = !!atlas && ch.material === atlas.mat;
      const vc = plain(ch.material) || decal, mat = vc ? vcMat(ch.material, snowy, atlas) : ch.material;
      const cast = ch.castShadow || decal; // decals lie on the body, so they may join its shadow-casting mesh
      const key = mat.uuid + (cast ? '|c' : '') + (ch.receiveShadow ? '|r' : '');
      if (!groups.has(key)) groups.set(key, { mat, cast, recv: ch.receiveShadow, geos: [] });
      ch.updateMatrix();
      const g = ch.geometry.index ? ch.geometry.toNonIndexed() : ch.geometry.clone();
      g.applyMatrix4(ch.matrix);
      for (const name of Object.keys(g.attributes)) if (!KEEP_ATTR.has(name)) g.deleteAttribute(name);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (vc) {
        const n = g.attributes.position.count, cols = new Float32Array(n * 3), surf = new Float32Array(n * 3), m = ch.material, c = decal ? WHITE : m.color; // linear, like the material colour
        const tex = decal ? 0 : m.userData.tex || 0;
        for (let i = 0; i < n; i++) { cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; surf[i * 3] = m.roughness; surf[i * 3 + 1] = m.metalness; surf[i * 3 + 2] = tex; }
        if (atlas && !decal) { const uv = g.attributes.uv; for (let i = 0; i < n; i++) uv.setXY(i, atlas.white[0], atlas.white[1]); }
        g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
        g.setAttribute('surf', new THREE.BufferAttribute(surf, 3));
        if (m.flatShading) g.computeVertexNormals(); // non-indexed here, so these are face normals
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

/**
 * Gives the machine (or implement) under root its own copies of the shared vertex-coloured materials,
 * bound to the uniform dirt = { value: 0..1 }. The copies use the same shader program: no compiling,
 * no extra draw calls.
 */
export function dirtMaterials(root, dirt) {
  const copies = new Map();
  root.traverse(o => {
    if (!o.isMesh || !o.material || Array.isArray(o.material) || o.material.customProgramCacheKey?.() !== 'surf') return;
    let c = copies.get(o.material);
    if (!c) {
      c = o.material.clone();
      c.onBeforeCompile = o.material.onBeforeCompile; c.customProgramCacheKey = o.material.customProgramCacheKey;
      c.userData = { dirt };
      copies.set(o.material, c);
    }
    o.material = c;
  });
}
