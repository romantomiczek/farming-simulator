import * as THREE from 'three';
import { scene, camera } from './core.js';
import { rng } from '../core/util.js';

/**
 * Sky dome (gradient, sun with glow, moon), stars and low-poly clouds.
 * The dome follows the camera and its horizon colour equals the fog colour, so distant
 * terrain melts into the sky. Everything here ignores fog and casts no shadows.
 * Cost: 3 draw calls (dome, stars, cloud puffs).
 */
const R = 380; // dome radius; stays inside camera.far on every preset (view 320 → far 470)

const domeMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
  uniforms: {
    zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() },
    sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, sunVis: { value: 1 },
    glow: { value: 0 }, moonDir: { value: new THREE.Vector3(0, 1, 0) }, moonVis: { value: 0 }, skyAlpha: { value: 1 },
  },
  vertexShader: /* glsl */`
    varying vec3 vDir;
    void main() {
      vDir = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 zenith, horizon, sunCol, sunDir, moonDir;
    uniform float sunVis, glow, moonVis, skyAlpha;
    varying vec3 vDir;
    void main() {
      vec3 d = normalize(vDir);
      float h = max(d.y, 0.0);
      vec3 c = mix(horizon, zenith, pow(h, 0.55));
      float s = max(dot(d, sunDir), 0.0);
      // warm band around the low sun at dawn and dusk, soft halo, sharp disc
      c += sunCol * glow * pow(s, 4.0) * (1.0 - h) * 0.55;
      c += sunCol * sunVis * (pow(s, 64.0) * 0.35 + smoothstep(0.9990, 0.9994, s) * 2.0);
      float m = max(dot(d, moonDir), 0.0);
      c += vec3(0.75, 0.8, 0.95) * moonVis * (smoothstep(0.9993, 0.9996, m) * 0.9 + pow(m, 200.0) * 0.12);
      gl_FragColor = vec4(c, skyAlpha); // 0 under post-processing: the sky stays out of tone mapping and occlusion
      #include <colorspace_fragment>
    }`,
});
/** Post-processing marks the sky with alpha 0 (on screen the alpha must stay 1, or the page shows through). */
export const setSkyAlpha = a => { domeMat.uniforms.skyAlpha.value = a; };
const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 16), domeMat);
dome.renderOrder = -10;
dome.frustumCulled = false;
scene.add(dome);

/* ---------- stars ---------- */
const rs = rng(31), starPos = [];
for (let i = 0; i < 700; i++) {
  const y = 0.08 + rs() * 0.92, a = rs() * Math.PI * 2, r = Math.sqrt(1 - y * y);
  starPos.push(Math.cos(a) * r * (R - 10), y * (R - 10), Math.sin(a) * r * (R - 10));
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color: 0xdfe8ff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
const stars = new THREE.Points(starGeo, starMat);
stars.renderOrder = -9;
stars.frustumCulled = false;
scene.add(stars);

/* ---------- clouds: clusters of flattened puffs, wrapped around the camera ---------- */
const SPAN = 640, rc = rng(57), clouds = [];
for (let i = 0; i < 34; i++) {
  const puffs = [], n = 4 + ((rc() * 4) | 0), len = 18 + rc() * 26;
  for (let k = 0; k < n; k++) {
    const t = n === 1 ? 0 : k / (n - 1) - 0.5, mid = 1 - Math.abs(t) * 1.2;
    puffs.push({ x: t * len + (rc() - 0.5) * 6, y: rc() * 3 * mid, z: (rc() - 0.5) * 10, s: 7 + rc() * 7 * mid });
  }
  clouds.push({ x: (rc() - 0.5) * SPAN, z: (rc() - 0.5) * SPAN, y: 68 + rc() * 32, puffs });
}
const puffCount = clouds.reduce((a, c) => a + c.puffs.length, 0);
const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, fog: false, emissive: 0x000000 });
const puffs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), cloudMat, puffCount);
puffs.frustumCulled = false;
puffs.renderOrder = -8;
scene.add(puffs);

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const wrap = v => ((((v + SPAN / 2) % SPAN) + SPAN) % SPAN) - SPAN / 2;
let drift = 0;

/**
 * Called every frame from updEnv with the colours it already computed.
 * env = { horizon, zenith, sunDir (visual), sunCol, day 0..1, dawn 0..1, overcast 0..1, rain 0..1 }
 */
/** Developer panel: show or hide parts of the sky. */
export const skyParts = { dome, stars, clouds: puffs };

export function updSky(dt, env) {
  const cp = camera.position;
  dome.position.copy(cp);
  stars.position.copy(cp);

  const u = domeMat.uniforms;
  u.horizon.value.copy(env.horizon);
  u.zenith.value.copy(env.zenith);
  u.sunDir.value.copy(env.sunDir);
  u.sunCol.value.copy(env.sunCol);
  const clear = 1 - env.overcast;
  u.sunVis.value = env.day * clear * clear;
  u.glow.value = env.dawn * clear;
  u.moonDir.value.set(-env.sunDir.x, Math.abs(env.sunDir.y) * 0.7 + 0.25, -env.sunDir.z).normalize();
  u.moonVis.value = (1 - env.day) * clear;
  starMat.opacity = Math.max(0, 1 - env.day * 1.6) * clear * 0.9;

  // more and greyer clouds when it is overcast; they always drift east
  drift += dt * (2.2 + env.overcast * 3);
  const shown = Math.round(18 + env.overcast * (clouds.length - 18));
  cloudMat.color.setScalar(1 - env.rain * 0.45 - env.overcast * 0.12);
  cloudMat.emissive.copy(env.horizon).multiplyScalar(0.25 + 0.25 * (1 - env.day));
  let i = 0;
  clouds.forEach((c, k) => {
    const x = wrap(c.x + drift - cp.x), z = wrap(c.z - cp.z);
    // shrink near the wrap edge so clouds never pop in or out
    const edge = Math.max(Math.abs(x), Math.abs(z)) / (SPAN / 2);
    const vis = k < shown ? Math.min(1, (1 - edge) * 5) : 0;
    for (const p of c.puffs) {
      _p.set(cp.x + x + p.x, c.y + p.y, cp.z + z + p.z);
      _s.set(p.s * 1.25, p.s * 0.55, p.s).multiplyScalar(vis);
      puffs.setMatrixAt(i++, _m.compose(_p, _q, _s));
    }
  });
  puffs.instanceMatrix.needsUpdate = true;
}
