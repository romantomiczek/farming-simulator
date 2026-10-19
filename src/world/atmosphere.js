import * as THREE from 'three';
import { scene, camera } from '../render/core.js';
import { CY, B, bake, flatten, lampMat, windowLit } from '../render/materials.js';
import { clamp, smooth, col } from '../core/util.js';
import { groundH } from './terrain.js';
import { circles, riverDist, roadAt, HOUSES } from './layout.js';
import { treeDots } from './vegetation.js';
import { trees as forestTrees } from './forest.js';
import { emit } from '../fx/particles.js';
import { sunDir } from '../render/environment.js';

/**
 * Small things that make the countryside feel alive, all cheap:
 *  - morning mist: from dawn to about nine the fog closes in, thickest down by the river;
 *  - a rainbow opposite the sun when a shower ends in daylight;
 *  - windows that light up in the evening (about two in three), street lamps in the village, the
 *    town and the corners of the yard, with warm pools of light on the ground;
 *  - leaves drifting down from the trees around you in autumn;
 *  - fireflies over the grass on summer nights;
 *  - smoke from the chimneys of the farmhouse and the village houses (more when it is cold).
 * buildAtmosphere() once, updAtmosphere() every frame after the sky and fog were set.
 */

/* ---------- street lamps ---------- */
const LAMPS = [];
{
  const add = (x, z, ax, az) => { if (!roadAt(x, z, 0.6)) LAMPS.push({ x, z, ax, az }); };
  // the village street (x 168): alternating sides, the arm reaching over the road
  for (let z = 58, k = 0; z <= 130; z += 24, k++) add(168 + (k % 2 ? 5.6 : -5.6), z, k % 2 ? -1 : 1, 0);
  // the town: the main road and the two side streets
  for (let x = 410, k = 0; x <= 640; x += 34, k++) add(x, 48 + (k % 2 ? 5.6 : -5.6), 0, k % 2 ? -1 : 1);
  for (let z = 64, k = 0; z <= 156; z += 30, k++) { add(480 + (k % 2 ? 4.6 : -4.6), z, k % 2 ? -1 : 1, 0); add(600 + (k % 2 ? -4.6 : 4.6), z + 8, k % 2 ? 1 : -1, 0); }
  // the corners of the farmyard
  for (const [x, z] of [[-45, -14], [24, -14], [24, -50]]) add(x, z, x < 0 ? 1 : -1, 0);
}
const poolMat = new THREE.MeshBasicMaterial({ color: col('#ffcf86'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
let pools = null;

/* ---------- chimneys: the farmhouse and every village house ---------- */
export const CHIMNEYS = [{ x: -31.4, y: 7.4, z: -20 }]; // y = top above the ground
for (const [x, z, w, d, , , ry] of HOUSES) {
  const lx = w * 0.28, top = 4.2 + d * 0.36 + 0.7;
  CHIMNEYS.push({ x: x + Math.cos(ry) * lx, y: top, z: z - Math.sin(ry) * lx });
}

/* ---------- rainbow: a soft band around the point opposite the sun ---------- */
// a real rainbow is 42° wide, more than the camera sees: 30° keeps the whole arch in view
// inside the sky dome (380 m) and the camera's far plane on every preset (470 m on Low)
const BOW_D = 300, BOW_R = BOW_D * Math.tan((30 * Math.PI) / 180);
const bow = new THREE.Mesh(
  new THREE.RingGeometry(BOW_R * 0.95, BOW_R * 1.03, 128, 1, 0, Math.PI),
  new THREE.ShaderMaterial({
    uniforms: { opacity: { value: 0 }, r0: { value: BOW_R * 0.95 }, r1: { value: BOW_R * 1.03 } },
    vertexShader: 'varying vec3 vP; void main() { vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float opacity, r0, r1; varying vec3 vP;
      vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
      void main() {
        float t = clamp((length(vP.xy) - r0) / (r1 - r0), 0.0, 1.0);   // 0 inside (violet) .. 1 outside (red)
        float band = smoothstep(0.0, 0.18, t) * smoothstep(1.0, 0.82, t);
        float foot = smoothstep(0.0, 0.25 * r1, vP.y);                    // fades into the ground haze
        gl_FragColor = vec4(hue(0.78 * (1.0 - t)), opacity * band * foot * 0.55);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
  }),
);
bow.visible = false; bow.frustumCulled = false; bow.renderOrder = 2;
scene.add(bow);
const bowState = { t: 0, life: 0, wasRain: 0 };
/** Developer panel: a rainbow now (it shows while the sun is up and not too high). */
export const showRainbow = () => { bowState.life = 75; };

/* ---------- fireflies ---------- */
const NF = 60;
const ffGeo = new THREE.BufferGeometry();
ffGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NF * 3), 3));
ffGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NF * 3), 3));
const flies = new THREE.Points(ffGeo, new THREE.PointsMaterial({ size: 0.5, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
flies.frustumCulled = false; flies.visible = false;
scene.add(flies);
const fly = Array.from({ length: NF }, () => ({ x: 0, z: 0, y: 0, ph: Math.random() * 10, sp: 0.6 + Math.random(), set: false }));

/** Lamps (posts into the static scene, pools of light as one instanced mesh) and window lights. */
export function buildAtmosphere() {
  const g = new THREE.Group();
  for (const l of LAMPS) {
    const y = groundH(l.x, l.z);
    CY(0.07, 0.11, 5.2, 6, '#474c4f', l.x, y + 2.6, l.z, g);
    B(Math.abs(l.ax) * 1.1 + 0.08, 0.08, Math.abs(l.az) * 1.1 + 0.08, '#474c4f', l.x + l.ax * 0.55, y + 5.15, l.z + l.az * 0.55, g);
    B(0.42, 0.16, 0.42, '#3d4245', l.x + l.ax * 1.1, y + 5.05, l.z + l.az * 1.1, g);
    B(0.3, 0.05, 0.3, lampMat, l.x + l.ax * 1.1, y + 4.95, l.z + l.az * 1.1, g);
    circles.push({ x: l.x, z: l.z, r: 0.2 });
  }
  scene.add(bake(flatten(g)));
  const disc = new THREE.CircleGeometry(5, 20).rotateX(-Math.PI / 2);
  pools = new THREE.InstancedMesh(disc, poolMat, LAMPS.length);
  const m = new THREE.Matrix4();
  LAMPS.forEach((l, i) => { const x = l.x + l.ax * 1.4, z = l.z + l.az * 1.4; m.makeTranslation(x, groundH(x, z) + 0.08, z); pools.setMatrixAt(i, m); });
  pools.receiveShadow = false; pools.visible = false; pools.renderOrder = 1;
  scene.add(pools);
}

const MIST = new THREE.Color(0.86, 0.88, 0.88);
let leafT = 0, smokeT = 0, nearT = 0;
const nearTrees = [];
const LEAF = ['#d98c2b', '#c8642a', '#e3b23c', '#9a5a2a', '#b8492c'].map(col), SMOKE = col('#b9b6b0');

/**
 * Every frame after updEnv(). ctx = { dt, target (where the camera looks), hour, day (0 night .. 1
 * day), wx: { rain, cloud }, season (name), wind (0..1) }.
 */
export function updAtmosphere(ctx) {
  const { dt, target, hour, day, wx, season, wind } = ctx, night = 1 - day;

  // windows: lit from dusk to before midnight and early in the morning, a few through the night
  const evening = smooth(17.5, 19.5, hour) * (1 - smooth(22.5, 23.5, hour)) + smooth(5, 5.6, hour) * (1 - smooth(6.8, 7.6, hour));
  windowLit.emissiveIntensity = night * (0.25 + 1.25 * evening);
  if (pools) { pools.visible = night > 0.05; poolMat.opacity = night * 0.34; }

  // morning mist: the fog closes in from dawn to about nine, thickest by the river
  const morning = smooth(4.5, 6, hour) * (1 - smooth(7.8, 9.6, hour)) * (1 - wx.rain);
  if (morning > 0.01) {
    const valley = 1 - smooth(25, 140, riverDist(target.x, target.z));
    const k = morning * (0.35 + 0.65 * valley);
    scene.fog.far *= 1 - 0.68 * k;
    scene.fog.near = Math.min(scene.fog.near, scene.fog.far * 0.18);
    scene.fog.color.lerp(MIST, 0.45 * k);
    scene.background = scene.fog.color;
  }

  // rainbow when a shower ends while the sun is up and not too high
  if (wx.rain > 0.3) bowState.wasRain = 120; // seconds the end of the rain may come after it was heavy
  else bowState.wasRain = Math.max(0, bowState.wasRain - dt);
  const sunUp = sunDir.y > 0.04 && sunDir.y < 0.62 && day > 0.6;
  if (bowState.wasRain > 0 && wx.rain < 0.06 && sunUp && bowState.life <= 0) { bowState.life = 75; bowState.wasRain = 0; }
  if (bowState.life > 0) {
    bowState.life -= dt;
    const a = Math.min(1, (75 - bowState.life) / 6) * Math.min(1, bowState.life / 18) * (sunUp ? 1 : 0);
    bow.visible = a > 0.01;
    bow.material.uniforms.opacity.value = a;
    // centred on the point opposite the sun, below the horizon by the sun's height
    const hx = -sunDir.x, hz = -sunDir.z, hl = Math.hypot(hx, hz) || 1;
    bow.position.set(camera.position.x + (hx / hl) * BOW_D, camera.position.y - BOW_D * Math.tan(Math.asin(clamp(sunDir.y, 0, 0.99))), camera.position.z + (hz / hl) * BOW_D);
    bow.lookAt(camera.position.x, bow.position.y, camera.position.z);
  } else bow.visible = false;

  // trees near you for the leaves (refreshed now and then)
  if ((nearT -= dt) <= 0) {
    nearT = 1;
    nearTrees.length = 0;
    for (let i = 0; i < treeDots.length; i += 2) if (Math.abs(treeDots[i] - target.x) < 40 && Math.abs(treeDots[i + 1] - target.z) < 40) nearTrees.push([treeDots[i], treeDots[i + 1], 1]);
    for (const t of forestTrees) if (t.g > 0.3 && !t.fall && Math.abs(t.x - target.x) < 40 && Math.abs(t.z - target.z) < 40) nearTrees.push([t.x, t.z, t.g * t.s]);
  }
  if (season === 'Podzim' && nearTrees.length && (leafT -= dt) <= 0) {
    leafT = 0.12 / Math.min(4, 0.5 + nearTrees.length / 10);
    const [x, z, s] = nearTrees[(Math.random() * nearTrees.length) | 0];
    const ox = (Math.random() - 0.5) * 4 * s, oz = (Math.random() - 0.5) * 4 * s;
    emit(x + ox, groundH(x + ox, z + oz) + 3 + Math.random() * 4 * s, z + oz, LEAF[(Math.random() * LEAF.length) | 0], 0.32,
      0.4 + wind * 1.6 + (Math.random() - 0.5) * 0.6, -0.7 - Math.random() * 0.3, (Math.random() - 0.5) * 0.8, 6.5);
  }

  // chimney smoke within sight: more in winter, autumn and spring mornings and evenings
  const cold = season === 'Zima' ? 1 : season === 'Léto' ? 0.25 : 0.6;
  if ((smokeT -= dt) <= 0) {
    smokeT = 0.32 / Math.max(0.2, cold * (0.6 + 0.4 * Math.max(evening, morning)));
    for (const c of CHIMNEYS) {
      if (Math.abs(c.x - target.x) > 130 || Math.abs(c.z - target.z) > 130) continue;
      const y = c.y + groundH(c.x, c.z);
      emit(c.x, y, c.z, SMOKE, 1.1, 0.25 + wind * 0.9, 0.75 + Math.random() * 0.3, 0.12, 6);
    }
  }

  // fireflies over the grass on warm nights
  const on = season === 'Léto' && night > 0.75 && wx.rain < 0.1;
  flies.visible = on;
  if (on) {
    const pos = ffGeo.attributes.position.array, colr = ffGeo.attributes.color.array, t = performance.now() / 1000;
    fly.forEach((f, i) => {
      if (!f.set || Math.abs(f.x - target.x) > 24 || Math.abs(f.z - target.z) > 24) {
        const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 18;
        f.x = target.x + Math.cos(a) * r; f.z = target.z + Math.sin(a) * r; f.set = true;
        f.y = groundH(f.x, f.z) + 0.4 + Math.random() * 1.4;
      }
      f.x += Math.sin(t * 0.7 * f.sp + f.ph) * dt * 0.5; f.z += Math.cos(t * 0.6 * f.sp + f.ph * 2) * dt * 0.5;
      pos[i * 3] = f.x; pos[i * 3 + 1] = f.y + Math.sin(t * f.sp + f.ph) * 0.25; pos[i * 3 + 2] = f.z;
      const glow = Math.max(0, Math.sin(t * 1.7 * f.sp + f.ph)) ** 6;
      colr[i * 3] = 0.75 * glow; colr[i * 3 + 1] = 1 * glow; colr[i * 3 + 2] = 0.35 * glow;
    });
    ffGeo.attributes.position.needsUpdate = true; ffGeo.attributes.color.needsUpdate = true;
  }
}
