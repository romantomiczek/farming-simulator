import * as THREE from 'three';
import { scene } from '../render/core.js';
import { rng } from '../core/util.js';
import { snow } from '../render/snow.js';
import { wind } from '../render/wind.js';
import { heightGrid } from './terrain.js';
import { BOUNDS, ROADS, FIELD_DEFS, PONDS, POND, RIVER, RIVER_HALF, PIT, PAD, PARK, boxes } from './layout.js';
import { townBlocks } from '../ui/minimap.js';
import { parkExtent } from '../vehicles/vehicles.js';

/**
 * Blades of grass around the camera, as in Farming Simulator. One draw call: tufts of thin blades,
 * instanced, scattered over a square of TILE metres that moves with the camera on the GPU (each tuft
 * keeps its place on the ground and jumps to the far side when the square passes it, where it is
 * faded out). The vertex shader puts each tuft on the terrain (the same height grid as the wheels)
 * and leaves it out where a mask says there is no grass: roads, fields, yards, water and buildings.
 * Lit like the ground under it (normals up), not casting shadows, gone under snow.
 */
const TILE = 48, MAX_PER_M2 = 16, BLADES = 5;
const GRASS_COL = new THREE.Color('#6a8f3e');

/** One tuft: BLADES thin triangles leaning out from a small patch; aTip = 0 at the root, 1 at the tip. */
function tuftGeo() {
  const r = rng(91), pos = [], tip = [];
  for (let b = 0; b < BLADES; b++) {
    const a = r() * Math.PI * 2, ox = (r() - 0.5) * 0.3, oz = (r() - 0.5) * 0.3, h = 0.16 + r() * 0.16, w = 0.022 + r() * 0.014;
    const lean = 0.05 + r() * 0.09, lx = Math.cos(a) * lean, lz = Math.sin(a) * lean, px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    pos.push(ox - px, 0, oz - pz, ox + px, 0, oz + pz, ox + lx, h, oz + lz);
    tip.push(0, 0, 1);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aTip', new THREE.Float32BufferAttribute(tip, 1));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return g;
}

/** Where grass grows: white, painted black where it must not (1 px per metre over the playable area). */
function maskTexture() {
  const W = BOUNDS.x1 - BOUNDS.x0, H = BOUNDS.z1 - BOUNDS.z0, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), X = x => x - BOUNDS.x0, Z = z => z - BOUNDS.z0;
  c.fillStyle = '#fff'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#000'; c.strokeStyle = '#000'; c.lineCap = 'round'; c.lineJoin = 'round';
  const rect = (x0, x1, z0, z1, m = 0) => c.fillRect(X(x0 - m), Z(z0 - m), x1 - x0 + 2 * m, z1 - z0 + 2 * m);
  const line = (pts, w) => { c.lineWidth = w; c.beginPath(); pts.forEach(([x, z], i) => (i ? c.lineTo(X(x), Z(z)) : c.moveTo(X(x), Z(z)))); c.stroke(); };
  for (const r of ROADS) line(r.pts, r.w + (r.kind === 'road' ? 1.8 : 0.4));
  line(RIVER, RIVER_HALF * 2 + 2);
  for (const f of FIELD_DEFS) rect(f.x0, f.x0 + f.w, f.z0, f.z0 + f.h, 0.4);
  for (const p of PONDS) { c.beginPath(); c.ellipse(X(p.x), Z(p.z), p.rx + 1, p.rz + 1, 0, 0, 7); c.fill(); }
  c.beginPath(); c.arc(X(POND.x), Z(POND.z), POND.r + 2, 0, 7); c.fill();
  rect(PIT.x0, PIT.x1, PIT.z0, PIT.z1);
  rect(PAD.x0, PAD.x1, PAD.z0, PAD.z1, 1);
  rect(PARK.x0, parkExtent(), PARK.z0, PARK.z1, 1);
  for (const b of boxes) rect(b.x0, b.x1, b.z0, b.z1, 0.5);
  for (const b of townBlocks) rect(b.x0, b.x1, b.z0, b.z1);
  const t = new THREE.CanvasTexture(cv);
  t.flipY = false; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  return t;
}

/** Height grid as a float texture (read texel by texel, interpolated like the mesh triangles). */
function heightTexture() {
  const g = heightGrid(), t = new THREE.DataTexture(g.data, g.nx, g.nz, THREE.RedFormat, THREE.FloatType);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true;
  return { t, g };
}

export function buildGrass() {
  const geo = tuftGeo(), n = TILE * TILE * MAX_PER_M2, r = rng(17), off = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) off.set([r() * TILE, r() * TILE, r() * Math.PI * 2, 0.55 + r() * 0.75], i * 4);
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
  geo.instanceCount = 0;
  const { t: hTex, g } = heightTexture();
  const U = {
    uCenter: { value: new THREE.Vector3() }, tH: { value: hTex }, tMask: { value: maskTexture() },
    uGrid: { value: new THREE.Vector4(g.x0, g.z0, g.step, 0) }, uGridN: { value: new THREE.Vector2(g.nx, g.nz) },
    uMaskR: { value: new THREE.Vector4(BOUNDS.x0, BOUNDS.z0, BOUNDS.x1 - BOUNDS.x0, BOUNDS.z1 - BOUNDS.z0) },
    uSnow: snow, windTime: wind.time, windStrength: wind.strength,
  };
  const mat = new THREE.MeshStandardMaterial({ color: GRASS_COL.clone(), roughness: 1, side: THREE.DoubleSide });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 aOff; attribute float aTip;
        uniform vec3 uCenter; uniform sampler2D tH; uniform sampler2D tMask; uniform vec4 uGrid; uniform vec2 uGridN; uniform vec4 uMaskR;
        uniform float uSnow; uniform float windTime; uniform float windStrength;
        varying float vTip; varying float vVar;
        float hAt(vec2 p) {
          vec2 f = (p - uGrid.xy) / uGrid.z;
          ivec2 i = clamp(ivec2(floor(f)), ivec2(0), ivec2(uGridN) - 2);
          vec2 u = clamp(f - vec2(i), 0.0, 1.0);
          float h00 = texelFetch(tH, i, 0).r, h10 = texelFetch(tH, i + ivec2(1, 0), 0).r;
          float h01 = texelFetch(tH, i + ivec2(0, 1), 0).r, h11 = texelFetch(tH, i + ivec2(1, 1), 0).r;
          return u.x + u.y <= 1.0 ? h00 + (h10 - h00) * u.x + (h01 - h00) * u.y : h11 + (h01 - h11) * (1.0 - u.x) + (h10 - h11) * (1.0 - u.y);
        }`)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
      .replace('#include <begin_vertex>', `
        vec2 corner = uCenter.xz - ${(TILE / 2).toFixed(1)};
        vec2 wp = corner + mod(aOff.xy - corner, ${TILE.toFixed(1)});
        float fade = 1.0 - smoothstep(${(TILE * 0.3).toFixed(1)}, ${(TILE * 0.48).toFixed(1)}, distance(wp, uCenter.xz));
        vec2 mUv = (wp - uMaskR.xy) / uMaskR.zw;
        float mask = (mUv.x < 0.0 || mUv.y < 0.0 || mUv.x > 1.0 || mUv.y > 1.0) ? 0.0 : texture2D(tMask, mUv).r;
        float s = aOff.w * smoothstep(0.0, 0.35, fade) * smoothstep(0.3, 0.9, mask) * (1.0 - smoothstep(0.1, 0.5, uSnow));
        float c = cos(aOff.z), sn = sin(aOff.z);
        vec3 transformed = position;
        transformed.xz = mat2(c, -sn, sn, c) * transformed.xz;
        transformed *= vec3(max(s, 0.25), s, max(s, 0.25));
        // wind bends the tips, in gusts rolling across the land
        float ph = dot(wp, vec2(0.8, 0.6)) * 0.35;
        float gust = sin(windTime * 1.7 - ph) * 0.6 + sin(windTime * 3.1 - ph * 1.9) * 0.25 + 0.3;
        transformed.xz += vec2(0.8, 0.6) * transformed.y * 0.35 * windStrength * gust;
        transformed += vec3(wp.x, hAt(wp) + 0.01, wp.y);
        vTip = aTip; vVar = fract(aOff.w * 7.31);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vTip; varying float vVar;')
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal *= faceDirection; nonPerturbedNormal = normal;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(0.55, 1.18, vTip) * (0.82 + 0.36 * vVar) * vec3(1.0 + vVar * 0.08, 1.0, 0.92);');
  };
  mat.customProgramCacheKey = () => 'grassblades';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.castShadow = false;
  scene.add(mesh);
  return {
    /** Per frame: center = where the grass square is, perM2 = density (0 = off), tint = the season's ground colour. */
    update(center, perM2, tint) {
      geo.instanceCount = Math.round(TILE * TILE * Math.min(MAX_PER_M2, perM2));
      mesh.visible = perM2 > 0 && snow.value < 0.5;
      U.uCenter.value.copy(center);
      mat.color.copy(GRASS_COL).multiply(tint);
    },
  };
}
