import * as THREE from 'three';
import { scene, hemi, sun } from './core.js';
import { skyEnv } from './environment.js';

/**
 * Map of the surroundings (image-based light): a tiny scene with the sky gradient, the glow of the
 * sun and the ground below, turned into a PMREM so glossy paint, glass and water reflect the sky.
 * Re-made only when the sky colours have changed noticeably (dawn, dusk, clouds), about a
 * millisecond each time. Only shiny and merged materials get it (machines, buildings, glass, water):
 * the ground, fields, grass and roads are matt, and the map would cost every pixel of them.
 */
const envScene = new THREE.Scene();
const U = {
  zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, ground: { value: new THREE.Color() },
  sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, glow: { value: 0 },
};
envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, toneMapped: false, uniforms: U,
  vertexShader: 'varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform vec3 zenith, horizon, ground, sunCol, sunDir; uniform float glow; varying vec3 vDir;
    void main() {
      vec3 d = normalize(vDir);
      vec3 c = d.y > 0.0 ? mix(horizon, zenith, pow(d.y, 0.55)) : mix(horizon * 0.8, ground, smoothstep(0.0, 0.2, -d.y));
      c += sunCol * pow(max(dot(d, sunDir), 0.0), 12.0) * glow;
      gl_FragColor = vec4(c, 1.0);
    }`,
})));

/** How strongly the map lights and reflects on the materials that get it. */
const INTENSITY = 0.55;
let pmrem = null, rt = null, on = false, scanT = 0;
const last = { h: new THREE.Color(), z: new THREE.Color(), s: new THREE.Vector3(), t: -1e9 };
const changed = () => {
  const d = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
  return d(last.h, skyEnv.horizon) > 0.02 || d(last.z, skyEnv.zenith) > 0.02 || last.s.distanceTo(skyEnv.sunDir) > 0.08;
};
/** Shiny or merged (machines, buildings) standard materials: those reflect the sky. */
const wants = m => m.isMeshStandardMaterial && (m.customProgramCacheKey?.().includes('surf') || m.roughness < 0.5 || m.metalness > 0.3);

/** Gives the current map to every material that wants it (machines bought later get it on the next scan). */
function assign(tex) {
  const seen = new Set();
  scene.traverse(o => {
    if (!o.material || Array.isArray(o.material) || seen.has(o.material)) return;
    const m = o.material; seen.add(m);
    if (!wants(m) || m.envMap === tex) return;
    if (!m.envMap !== !tex) m.needsUpdate = true; // the shader changes only when the map comes or goes
    m.envMap = tex; m.envMapIntensity = INTENSITY;
  });
}

/** Turns the map on or off (quality preset). */
export function setEnvMap(renderer, enable) {
  on = enable;
  if (!enable) { assign(null); return; }
  pmrem ??= new THREE.PMREMGenerator(renderer);
  last.t = -1e9;
  updEnvMap(renderer, 0);
}

/** Every frame (cheap unless the sky changed or a scan is due): re-makes the map, hands it out. */
export function updEnvMap(renderer, dt) {
  if (!on) return;
  scanT -= dt;
  const now = performance.now();
  if (now - last.t >= 500 && (!rt || changed())) {
    last.t = now; last.h.copy(skyEnv.horizon); last.z.copy(skyEnv.zenith); last.s.copy(skyEnv.sunDir);
    U.horizon.value.copy(skyEnv.horizon); U.zenith.value.copy(skyEnv.zenith);
    U.ground.value.copy(hemi.groundColor).multiplyScalar(0.55 * (0.25 + 0.75 * skyEnv.day));
    U.sunDir.value.copy(skyEnv.sunDir); U.sunCol.value.copy(sun.color);
    U.glow.value = skyEnv.day * (1 - skyEnv.overcast) * 1.5;
    const old = rt;
    rt = pmrem.fromScene(envScene, 0, 0.1, 100);
    assign(rt.texture);
    old?.dispose();
    scanT = 3;
  } else if (scanT <= 0) { scanT = 3; assign(rt.texture); }
}
