import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { M, mk, B, CY, bake, glassMat, lampMat, beaconMat } from '../render/materials.js';
import { col } from '../core/util.js';

// Low-poly vehicle models. Local +z is forward, +x is the driver's left.
// Moving parts are separate groups; everything else is merged by bake(), so the small
// details below cost triangles but no extra draw calls.

const DARK = '#3a3f42', TYRE = '#2a2c2e', STEEL = '#b9bfc2', IRON = '#56595b', TAIL = '#c4473a';

/** Box with rounded (chamfered, flat-shaded) edges. */
const RB = (w, h, d, r, mat, x, y, z, p) => mk(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2) * 0.99), mat, x, y, z, p);

const _up = new THREE.Vector3(0, 1, 0);
/** Thin round bar from a to b ([x, y, z]). */
function rod(a, b, t, mat, p) {
  const A = new THREE.Vector3(...a), D = new THREE.Vector3(...b).sub(A);
  const m = mk(new THREE.CylinderGeometry(t, t, D.length(), 6), mat, A.x + D.x / 2, A.y + D.y / 2, A.z + D.z / 2, p);
  m.quaternion.setFromUnitVectors(_up, D.normalize());
  return m;
}

/** Curved mudguard: n flat segments on an arc around the x axis, centred at (x, cy, cz). Angle 0 = forward, π/2 = up. */
function arc(p, mat, x, cy, cz, r, a0, a1, n, width, thick = 0.06) {
  const seg = 2 * r * Math.sin((a1 - a0) / n / 2) + 0.03;
  for (let k = 0; k < n; k++) {
    const a = a0 + ((a1 - a0) * (k + 0.5)) / n;
    B(width, thick, seg, mat, x, cy + Math.sin(a) * r, cz + Math.cos(a) * r, p).rotation.x = Math.PI / 2 - a;
  }
}

/** Horizontal cooling louvres on a side panel at x. */
function louvres(p, mat, x, y0, y1, z, len, n) {
  for (let k = 0; k < n; k++) B(0.05, ((y1 - y0) / n) * 0.42, len, mat, x, y0 + ((k + 0.5) * (y1 - y0)) / n, z, p);
}

/** Rear-view mirrors on arms, one per side. */
function mirrors(p, half, y, z) {
  for (const sx of [-1, 1]) {
    rod([sx * half, y, z], [sx * (half + 0.42), y - 0.04, z + 0.18], 0.025, DARK, p);
    RB(0.06, 0.4, 0.26, 0.025, DARK, sx * (half + 0.45), y - 0.2, z + 0.2, p);
  }
}

/** Seat and steering wheel, seen through the cab glass. y = cab floor, z = cab centre. */
function cabInside(p, y, z) {
  RB(0.52, 0.14, 0.5, 0.05, DARK, 0, y + 0.45, z - 0.2, p);
  RB(0.5, 0.62, 0.12, 0.05, DARK, 0, y + 0.8, z - 0.45, p);
  rod([0, y + 0.05, z + 0.55], [0, y + 0.85, z + 0.32], 0.03, DARK, p);
  mk(new THREE.TorusGeometry(0.19, 0.025, 4, 14), DARK, 0, y + 0.87, z + 0.3, p).rotation.x = Math.PI / 2 - 0.55;
}

/**
 * Wheel: tyre with rounded shoulders, dished rim, hub and wheel nuts.
 * tread 'lug' = chevron lugs (tractors, harvesters), otherwise a road pattern.
 */
export function wheel(r, w, rimHex, tread = 'road') {
  const g = new THREE.Group(), spin = new THREE.Group();
  g.add(spin);
  const ri = r * 0.62, sh = Math.min(w * 0.25, r * 0.16);
  const prof = [[ri, -w / 2], [r - sh, -w / 2], [r - sh * 0.3, -w / 2 + sh * 0.3], [r, -w / 2 + sh],
    [r, w / 2 - sh], [r - sh * 0.3, w / 2 - sh * 0.3], [r - sh, w / 2], [ri, w / 2]].map(([a, b]) => new THREE.Vector2(a, b));
  mk(new THREE.LatheGeometry(prof, 22).rotateZ(Math.PI / 2), TYRE, 0, 0, 0, spin);
  mk(new THREE.CylinderGeometry(ri, ri, w * 0.84, 16), rimHex, 0, 0, 0, spin).rotation.z = Math.PI / 2;
  mk(new THREE.CylinderGeometry(r * 0.2, r * 0.25, w * 0.84 + 0.14, 8), rimHex, 0, 0, 0, spin).rotation.z = Math.PI / 2;
  const nut = r * 0.05 + 0.03;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    for (const s of [-1, 1]) B(0.05, nut, nut, TYRE, s * (w * 0.42 + 0.06), Math.cos(a) * r * 0.33, Math.sin(a) * r * 0.33, spin);
  }
  if (tread === 'lug') {
    const n = Math.max(12, Math.round(r * 20));
    for (let i = 0; i < n; i++) {
      for (const s of [-1, 1]) {
        const a = ((i + (s > 0 ? 0.5 : 0)) / n) * Math.PI * 2;
        B(w * 0.46, r * 0.09, r * 0.13, TYRE, s * w * 0.25, Math.cos(a) * r, Math.sin(a) * r, spin).rotation.set(a, s * 0.55, 0);
      }
    }
  } else {
    const n = Math.max(10, Math.round(r * 18));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      B(w * 0.8, r * 0.05, r * 0.09, TYRE, 0, Math.cos(a) * r, Math.sin(a) * r, spin).rotation.x = a;
    }
  }
  g.userData = { spin, r };
  return g;
}

/** Headlamps plus one spot light that only shines at night. */
function addLights(g, y, z, xs) {
  for (const x of xs) {
    B(0.36, 0.22, 0.06, DARK, x, y, z - 0.03, g);
    B(0.3, 0.16, 0.06, lampMat, x, y, z, g);
  }
  const sp = new THREE.SpotLight(0xfff1c8, 0, 48, 0.75, 0.6, 0);
  sp.position.set(0, y, z);
  const t = new THREE.Object3D(); t.position.set(0, 0, z + 18);
  g.add(sp, t); sp.target = t;
  return sp;
}

export function buildTractor() {
  const g = new THREE.Group(), body = '#5f9c7c', bodyDk = '#4f8a6b', cream = '#efe2b8';
  // frame, bonnet with vents and pinstripe, grille, front weights
  B(0.9, 0.55, 3.6, DARK, 0, 0.85, 0.35, g);
  RB(1.1, 0.95, 2.0, 0.13, body, 0, 1.45, 1.15, g);
  RB(0.86, 0.1, 1.86, 0.04, bodyDk, 0, 1.93, 1.12, g);
  for (const sx of [-1, 1]) {
    louvres(g, DARK, sx * 0.555, 1.12, 1.68, 1.5, 0.8, 4);
    B(0.02, 0.06, 1.8, cream, sx * 0.556, 1.8, 1.12, g);
  }
  B(0.9, 0.66, 0.06, '#2f3437', 0, 1.42, 2.16, g);
  for (let k = 0; k < 5; k++) B(0.88, 0.04, 0.05, STEEL, 0, 1.17 + k * 0.125, 2.19, g);
  for (let k = 0; k < 4; k++) RB(1.0, 0.11, 0.42, 0.03, DARK, 0, 0.72 + k * 0.125, 2.4, g);
  B(1.5, 0.16, 0.22, DARK, 0, 0.52, 1.55, g);
  // cab: rounded roof, posts, seat and wheel, mirrors, roof work lights, beacon
  RB(1.8, 0.35, 1.8, 0.08, body, 0, 1.6, -0.55, g);
  mk(new THREE.BoxGeometry(1.7, 1.45, 1.7), glassMat, 0, 2.5, -0.55, g, false);
  RB(1.94, 0.2, 2.0, 0.08, body, 0, 3.32, -0.55, g);
  RB(1.4, 0.08, 1.4, 0.03, bodyDk, 0, 3.44, -0.6, g);
  for (const sx of [-0.83, 0.83]) for (const sz of [-1.36, 0.26]) B(0.1, 1.45, 0.1, DARK, sx, 2.5, sz, g);
  cabInside(g, 1.78, -0.55);
  mirrors(g, 0.9, 3.0, 0.2);
  for (const x of [-0.45, 0.45]) B(0.2, 0.12, 0.06, lampMat, x, 3.3, 0.48, g);
  B(0.16, 0.16, 0.16, beaconMat, 0.7, 3.5, -0.1, g);
  // step and handrail on the left, fuel tank on the right
  for (let k = 0; k < 2; k++) B(0.36, 0.05, 0.28, STEEL, 0.98, 0.72 + k * 0.4, 0.34, g);
  rod([0.95, 1.2, 0.45], [0.95, 2.4, 0.3], 0.025, DARK, g);
  RB(0.34, 0.46, 0.6, 0.12, body, -0.66, 1.02, 0.52, g);
  // curved rear mudguards with tail lights
  for (const sx of [-1, 1]) {
    arc(g, body, sx * 1.0, 0.86, -0.7, 1.0, Math.PI * 0.1, Math.PI * 0.9, 7, 0.7);
    B(0.12, 0.16, 0.06, TAIL, sx * 1.22, 1.32, -1.64, g);
  }
  // exhaust with silencer, air pre-cleaner
  CY(0.06, 0.06, 1.1, 6, DARK, 0.42, 2.45, 1.85, g);
  CY(0.11, 0.11, 0.5, 8, DARK, 0.42, 2.25, 1.85, g);
  CY(0.075, 0.06, 0.1, 6, IRON, 0.42, 3.03, 1.85, g);
  CY(0.07, 0.07, 0.8, 6, DARK, -0.42, 2.3, 1.85, g);
  CY(0.15, 0.1, 0.2, 8, STEEL, -0.42, 2.78, 1.85, g);
  // three-point linkage and PTO
  B(0.32, 0.26, 0.5, DARK, 0, 0.7, -1.6, g);
  for (const sx of [-1, 1]) rod([sx * 0.32, 0.6, -1.4], [sx * 0.42, 0.52, -2.15], 0.05, DARK, g);
  rod([0, 1.25, -1.45], [0, 1.0, -2.1], 0.05, DARK, g);
  CY(0.06, 0.06, 0.25, 8, STEEL, 0, 0.78, -1.9, g).rotation.x = Math.PI / 2;
  const wheels = [], front = [];
  for (const sx of [-1, 1]) { const w = wheel(0.86, 0.6, cream, 'lug'); w.position.set(sx * 1.0, 0.86, -0.7); g.add(w); wheels.push(w); }
  for (const sx of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(sx * 0.84, 0.52, 1.55); g.add(p);
    const w = wheel(0.52, 0.42, cream, 'lug'); p.add(w); wheels.push(w); front.push(p);
    arc(p, body, 0, 0, 0, 0.64, Math.PI * 0.2, Math.PI * 0.8, 5, 0.48, 0.05); // steers with the wheel
  }
  const spot = addLights(g, 2.0, 2.2, [-0.4, 0.4]);
  bake(g);
  return { group: g, wheels, front, rear: [], spot, exhaust: new THREE.Vector3(0.42, 3.05, 1.85) };
}

export function buildCultivator() {
  const g = new THREE.Group(), lift = new THREE.Group(); g.add(lift);
  const y = '#e0a640';
  B(0.24, 0.24, 1.0, y, 0, 0.72, -0.4, lift);
  RB(4.2, 0.22, 0.25, 0.05, y, 0, 0.85, -0.95, lift);
  RB(4.2, 0.22, 0.25, 0.05, y, 0, 0.85, -1.75, lift);
  for (const sx of [-1, 1]) B(0.18, 0.2, 1.1, y, sx * 2.0, 0.85, -1.35, lift);
  B(1.6, 0.2, 0.2, y, 0, 0.85, -0.55, lift);
  // headstock A-frame
  for (const sx of [-1, 1]) rod([sx * 0.42, 0.55, -0.15], [sx * 0.7, 0.85, -0.95], 0.05, y, lift);
  rod([0, 1.35, -0.2], [0, 0.95, -0.95], 0.05, y, lift);
  // spring tines: spring coil on the beam, shank down, steel point bent forward
  for (let i = 0; i < 9; i++) {
    const x = -1.84 + i * 0.46, z = i % 2 ? -0.95 : -1.75;
    CY(0.07, 0.07, 0.16, 8, DARK, x, 0.66, z, lift);
    B(0.07, 0.62, 0.07, DARK, x, 0.36, z - 0.06, lift).rotation.x = 0.18;
    B(0.08, 0.06, 0.3, STEEL, x, 0.06, z + 0.04, lift).rotation.x = -0.35;
  }
  // cage roller (turns with the ground)
  const roller = new THREE.Group(); roller.position.set(0, 0.32, -2.4); lift.add(roller);
  for (const sx of [-2.0, -1.0, 0, 1.0, 2.0]) CY(0.3, 0.3, 0.05, 12, '#6a6f72', sx, 0, 0, roller).rotation.z = Math.PI / 2;
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; B(4.05, 0.05, 0.05, '#6a6f72', 0, Math.cos(a) * 0.29, Math.sin(a) * 0.29, roller); }
  CY(0.05, 0.05, 4.1, 6, DARK, 0, 0, 0, roller).rotation.z = Math.PI / 2;
  for (const sx of [-1, 1]) B(0.12, 0.12, 0.8, y, sx * 2.0, 0.6, -2.05, lift);
  bake(g);
  return { group: g, lift, roller, up: 0.45, down: -0.2 };
}

export function buildSeeder() {
  const g = new THREE.Group(), lift = new THREE.Group(); g.add(lift);
  const blue = '#4f78a8', blueLt = '#6f97c4';
  B(0.24, 0.24, 1.0, DARK, 0, 0.72, -0.4, lift);
  B(4.0, 0.2, 0.25, DARK, 0, 0.75, -0.9, lift);
  RB(3.8, 0.95, 1.05, 0.08, blue, 0, 1.5, -1.15, lift);
  RB(3.92, 0.12, 1.16, 0.04, blueLt, 0, 2.03, -1.15, lift);
  for (const x of [-1.2, 0, 1.2]) B(0.3, 0.06, 0.06, DARK, x, 2.06, -0.55, lift); // lid handles
  for (const x of [-1.3, -0.45, 0.45, 1.3]) B(0.06, 0.9, 0.04, blueLt, x, 1.5, -0.62, lift); // ribs
  for (const sx of [-1.7, 1.7]) B(0.12, 0.8, 0.12, DARK, sx, 0.95, -1.15, lift);
  B(4.0, 0.16, 0.2, DARK, 0, 0.55, -1.6, lift);
  // seed tubes from the metering box down to the coulters
  for (let i = 0; i < 12; i++) {
    const x = -1.83 + i * 0.333;
    rod([x * 0.9, 1.02, -1.2], [x, 0.42, -1.6], 0.025, '#8a9196', lift);
    CY(0.22, 0.22, 0.05, 10, IRON, x, 0.28, -1.65, lift).rotation.z = Math.PI / 2;
  }
  // folded bout markers and the loading step
  for (const sx of [-1, 1]) {
    rod([sx * 1.95, 1.1, -1.1], [sx * 2.05, 2.4, -1.1], 0.04, DARK, lift);
    CY(0.18, 0.18, 0.04, 8, IRON, sx * 2.05, 2.45, -1.1, lift).rotation.z = Math.PI / 2;
  }
  B(1.4, 0.05, 0.35, STEEL, 0, 0.98, -0.45, lift);
  const wheels = [];
  for (const sx of [-1, 1]) { const w = wheel(0.36, 0.22, '#d7dde2'); w.position.set(sx * 2.15, 0.36, -0.95); lift.add(w); wheels.push(w); }
  bake(g);
  return { group: g, lift, wheels, up: 0.4, down: -0.05 };
}

/**
 * Grain trailer with a tipping body. Origin = centre of the tandem axle on the ground,
 * +z points to the drawbar eye (4.2 m ahead), which sits on the tractor hitch.
 */
export function buildTrailer() {
  const g = new THREE.Group(), body = '#c8794a', rib = '#b06a40', trim = '#e8a46f';
  B(1.0, 0.25, 5.8, DARK, 0, 0.72, 0.8, g);
  for (const z of [-1.6, 0, 1.6, 3.0]) B(2.0, 0.12, 0.14, DARK, 0, 0.84, z, g);
  // A-frame drawbar, eye and parking leg
  for (const sx of [-1, 1]) rod([sx * 0.48, 0.72, 2.9], [0, 0.66, 4.1], 0.06, DARK, g);
  B(0.2, 0.2, 1.2, DARK, 0, 0.66, 3.7, g);
  CY(0.12, 0.12, 0.1, 8, DARK, 0, 0.62, 4.2, g);
  rod([0.25, 0.7, 3.4], [0.25, 0.08, 3.4], 0.05, IRON, g);
  B(0.24, 0.04, 0.24, IRON, 0.25, 0.04, 3.4, g);
  const wheels = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-0.62, 0.62]) { const w = wheel(0.55, 0.4, '#d7dde2'); w.position.set(sx * 1.15, 0.55, sz); g.add(w); wheels.push(w); }
    B(0.5, 0.08, 2.5, DARK, sx * 1.15, 1.18, 0, g);
    for (const sz of [-1.25, 1.25]) B(0.5, 0.3, 0.04, DARK, sx * 1.15, 1.02, sz, g); // mud flaps
    B(0.14, 0.18, 0.06, TAIL, sx * 0.95, 0.82, -2.12, g);
  }
  B(0.9, 0.08, 0.06, '#e2c06a', 0, 0.75, -2.12, g); // reflector strip
  // tipping body hinged at the rear edge
  const tip = new THREE.Group(); tip.position.set(0, 0.95, -2.0); g.add(tip);
  B(2.4, 0.12, 5.6, body, 0, 0.06, 2.8, tip);
  for (const sx of [-1, 1]) {
    B(0.1, 1.3, 5.6, body, sx * 1.2, 0.71, 2.8, tip);
    RB(0.14, 0.14, 5.66, 0.04, trim, sx * 1.22, 1.3, 2.8, tip);
    for (let k = 0; k < 8; k++) B(0.06, 1.2, 0.1, rib, sx * 1.27, 0.7, 0.25 + k * 0.72, tip);
    B(0.06, 0.1, 5.5, rib, sx * 1.27, 0.2, 2.8, tip);
  }
  B(2.4, 1.3, 0.1, body, 0, 0.71, 5.55, tip);
  B(2.4, 1.3, 0.1, body, 0, 0.71, 0.05, tip);
  RB(2.5, 0.14, 0.16, 0.04, trim, 0, 1.3, 5.55, tip);
  for (const x of [-0.8, 0, 0.8]) B(0.08, 1.2, 0.06, rib, x, 0.7, -0.02, tip); // tailgate ribs
  for (const sx of [-1, 1]) CY(0.07, 0.07, 0.18, 8, DARK, sx * 1.05, 1.35, 0.0, tip).rotation.z = Math.PI / 2; // tailgate hinges
  for (let k = 0; k < 4; k++) B(0.36, 0.04, 0.06, DARK, -0.7, 0.3 + k * 0.28, 5.63, tip); // ladder
  const grainMat = new THREE.MeshStandardMaterial({ color: col('#e4bc52'), roughness: 1, flatShading: true });
  const gg = new THREE.BoxGeometry(2.25, 1, 5.4); gg.translate(0, 0.5, 0);
  const grain = mk(gg, grainMat, 0, 0.12, 2.8, tip);
  grain.userData.noBake = true; grain.visible = false;
  // up to 8 round bales, lying lengthwise in two layers; shown by count
  const baleMeshes = [];
  for (let layer = 0; layer < 2; layer++) {
    for (let j = 0; j < 4; j++) {
      const m = mk(baleGeo(), M('#e2c77d'), 0, 0.87 + layer * 1.45, 2.8 + (j - 1.5) * 1.3, tip);
      m.rotation.x = Math.PI / 2; m.userData.noBake = true; m.visible = false;
      baleMeshes.push(m);
    }
  }
  bake(g);
  return { group: g, tip, grain, grainMat, wheels, baleMeshes };
}

export function buildCombine() {
  const g = new THREE.Group(), red = '#cf5a4a', redLt = '#dc6a58', light = '#ebe4d2';
  RB(2.5, 2.2, 5.4, 0.16, red, 0, 2.3, -0.5, g);
  B(2.0, 0.7, 4.6, DARK, 0, 0.95, -0.4, g);
  RB(2.35, 0.8, 2.6, 0.08, redLt, 0, 3.8, -0.9, g);
  RB(2.3, 0.95, 1.3, 0.1, red, 0, 3.85, -2.55, g);
  B(1.6, 0.06, 0.9, '#2f3437', 0, 4.35, -2.55, g);
  B(2.52, 0.12, 5.42, light, 0, 1.25, -0.5, g);
  B(2.52, 0.06, 5.0, light, 0, 3.32, -0.6, g);
  // engine bay louvres and the rotary radiator screen
  for (const sx of [-1, 1]) louvres(g, DARK, sx * 1.255, 1.9, 3.0, -2.3, 1.5, 6);
  CY(0.42, 0.42, 0.1, 18, IRON, -1.17, 3.85, -2.55, g).rotation.z = Math.PI / 2;
  CY(0.14, 0.14, 0.16, 8, light, -1.18, 3.85, -2.55, g).rotation.z = Math.PI / 2;
  for (let k = 0; k < 4; k++) B(0.03, 0.8, 0.05, DARK, -1.23, 3.85, -2.55, g).rotation.x = (k * Math.PI) / 4;
  // flared grain tank extensions
  for (const sx of [-1, 1]) B(0.06, 0.45, 2.6, redLt, sx * 1.27, 4.4, -0.9, g).rotation.z = -sx * 0.3;
  for (const sz of [-1, 1]) B(2.6, 0.45, 0.06, redLt, 0, 4.4, -0.9 + sz * 1.37, g).rotation.x = sz * 0.3;
  // grain heap in the open tank, scaled by fill level
  const grainMat = new THREE.MeshStandardMaterial({ color: col('#e4bc52'), roughness: 1, flatShading: true });
  const gg = new THREE.BoxGeometry(2.15, 1, 2.4); gg.translate(0, 0.5, 0);
  const grain = mk(gg, grainMat, 0, 4.2, -0.9, g);
  grain.userData.noBake = true; grain.visible = false;
  // cab with rounded roof, wiper, interior, mirrors and work lights
  mk(new THREE.BoxGeometry(1.9, 1.4, 1.45), glassMat, 0, 4.1, 1.5, g, false);
  RB(2.14, 0.2, 1.76, 0.08, light, 0, 4.9, 1.5, g);
  for (const sx of [-0.92, 0.92]) for (const sz of [0.82, 2.18]) B(0.09, 1.4, 0.09, DARK, sx, 4.1, sz, g);
  B(0.04, 0.8, 0.03, DARK, 0.2, 4.0, 2.24, g).rotation.z = 0.5;
  cabInside(g, 3.4, 1.5);
  mirrors(g, 1.0, 4.65, 2.1);
  for (const x of [-0.75, -0.25, 0.25, 0.75]) B(0.2, 0.12, 0.06, lampMat, x, 4.92, 2.4, g);
  // ladder up to the cab platform with a handrail
  const fh = B(1.4, 1.0, 1.9, DARK, 0, 1.35, 2.95, g); fh.rotation.x = 0.16;
  for (let k = 0; k < 6; k++) B(0.5, 0.05, 0.2, DARK, -1.4, 0.6 + k * 0.48, 2.5, g);
  rod([-1.64, 0.45, 2.5], [-1.64, 3.45, 2.5], 0.03, DARK, g);
  B(0.55, 0.06, 1.2, STEEL, -1.48, 3.36, 1.45, g);
  rod([-1.74, 3.4, 0.9], [-1.74, 4.25, 0.9], 0.025, DARK, g);
  rod([-1.74, 4.25, 0.9], [-1.74, 4.25, 2.0], 0.025, DARK, g);
  CY(0.09, 0.09, 1.2, 6, DARK, -0.8, 4.85, -2.7, g);
  CY(0.12, 0.09, 0.12, 6, IRON, -0.8, 5.45, -2.7, g);
  B(0.18, 0.18, 0.18, beaconMat, 0.85, 5.06, 1.0, g); B(0.18, 0.18, 0.18, beaconMat, -0.85, 5.06, 1.0, g);
  // straw chopper and spreader discs at the back, tail lights
  RB(1.7, 0.6, 0.8, 0.1, DARK, 0, 1.55, -3.4, g).rotation.x = 0.3;
  for (const sx of [-1, 1]) {
    CY(0.36, 0.36, 0.05, 10, IRON, sx * 0.45, 1.12, -3.8, g);
    B(0.14, 0.2, 0.06, TAIL, sx * 1.12, 2.7, -3.23, g);
  }
  const wheels = [], rear = [];
  for (const sx of [-1, 1]) {
    const w = wheel(1.05, 0.75, light, 'lug'); w.position.set(sx * 1.5, 1.05, 1.25); g.add(w); wheels.push(w);
    arc(g, red, sx * 1.5, 1.05, 1.25, 1.2, Math.PI * 0.42, Math.PI * 0.95, 4, 0.8); // rear half of the guard, clear of the header
  }
  for (const sx of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(sx * 1.2, 0.62, -2.75); g.add(p);
    const w = wheel(0.62, 0.45, light, 'lug'); p.add(w); wheels.push(w); rear.push(p);
  }
  // headers: the grain header (with a spinning reel) and the row header for corn and sunflower.
  // Both are built here; the unused one is parked in the yard by setHeader() in vehicles.js.
  const header = new THREE.Group(); header.position.set(0, 0, 3.75); g.add(header);
  const hl = new THREE.Group(); header.add(hl);
  const grainHdr = new THREE.Group(); hl.add(grainHdr);
  B(5.8, 0.35, 1.4, red, 0, 0.55, 0.3, grainHdr);
  RB(5.8, 1.1, 0.15, 0.05, red, 0, 1.0, -0.35, grainHdr);
  B(5.82, 0.08, 0.17, light, 0, 1.5, -0.35, grainHdr);
  for (const sx of [-1, 1]) {
    B(0.12, 0.9, 1.5, red, sx * 2.9, 0.85, 0.3, grainHdr);
    const d = mk(new THREE.ConeGeometry(0.22, 0.9, 4), light, sx * 2.9, 0.55, 1.25, grainHdr); d.rotation.x = Math.PI / 2;
  }
  B(5.6, 0.08, 0.2, IRON, 0, 0.42, 1.0, grainHdr);
  // knife guards along the cutter bar
  for (let i = 0; i < 28; i++) mk(new THREE.ConeGeometry(0.05, 0.28, 4), STEEL, -2.7 + i * 0.2, 0.42, 1.18, grainHdr).rotation.x = Math.PI / 2;
  // cross auger with flighting
  CY(0.2, 0.2, 5.4, 10, IRON, 0, 0.78, -0.05, grainHdr).rotation.z = Math.PI / 2;
  for (let i = 0; i < 18; i++) {
    const x = -2.55 + i * 0.3, f = CY(0.32, 0.32, 0.03, 10, STEEL, x, 0.78, -0.05, grainHdr);
    f.rotation.z = Math.PI / 2; f.rotation.y = x < 0 ? 0.25 : -0.25;
  }
  const reel = new THREE.Group(); reel.position.set(0, 1.62, 0.45); grainHdr.add(reel);
  const ax = mk(new THREE.CylinderGeometry(0.07, 0.07, 5.5, 6), DARK, 0, 0, 0, reel); ax.rotation.z = Math.PI / 2;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    B(5.3, 0.08, 0.08, light, 0, Math.cos(a) * 0.55, Math.sin(a) * 0.55, reel);
    for (let t = 0; t < 12; t++) B(0.025, 0.3, 0.025, IRON, -2.5 + t * 0.455, Math.cos(a) * 0.7, Math.sin(a) * 0.7, reel).rotation.x = a;
  }
  for (const sx of [-2.7, 0, 2.7]) for (let k = 0; k < 3; k++) { const s = B(0.05, 1.1, 0.05, DARK, sx, 0, 0, reel); s.rotation.x = (k * Math.PI) / 3; }
  for (const sx of [-1, 1]) {
    const arm = B(0.1, 0.1, 1.4, red, sx * 2.75, 1.45, 0.0, grainHdr); arm.rotation.x = -0.2;
    rod([sx * 2.62, 1.0, -0.35], [sx * 2.62, 1.4, 0.2], 0.04, STEEL, grainHdr); // reel lift ram
  }
  const cornHdr = buildRowHeader(red, DARK, light);
  hl.add(cornHdr);
  // unloading pipe, folded backwards; swings out to the left (+x) when unloading
  const pipe = new THREE.Group(); pipe.position.set(1.05, 4.05, -1.9); g.add(pipe);
  const pc = mk(new THREE.CylinderGeometry(0.17, 0.17, 4.6, 10), red, 0, 0, -2.3, pipe); pc.rotation.x = Math.PI / 2;
  for (const z of [-0.6, -2.3, -4.0]) CY(0.2, 0.2, 0.08, 10, light, 0, 0, z, pipe).rotation.x = Math.PI / 2;
  B(0.36, 0.5, 0.36, DARK, 0, -0.2, -4.6, pipe);
  const spot = addLights(g, 4.75, 2.3, [-0.6, 0.6]);
  bake(g);
  return {
    group: g, wheels, front: [], rear, headerLift: hl, grainHdr, cornHdr, reel, pipe, grain, grainMat, spot,
    exhaust: new THREE.Vector3(-0.8, 5.5, -2.7),
    pipeTip: new THREE.Vector3(0, -0.3, -4.6), // pipe-local spout, for the grain stream
    pipeReach: { lx: 1.05 + 4.6, lz: -1.9 }, // vehicle-local spout position when the pipe is out
  };
}

/** Round straw bale, axis along x, sitting on the ground at y = 0. */
export function baleGeo() { return new THREE.CylinderGeometry(0.75, 0.75, 1.2, 14).rotateZ(Math.PI / 2); }

/** Row header for corn and sunflower: pointed snouts between the rows. */
function buildRowHeader(red, dark, light) {
  const g = new THREE.Group();
  B(5.8, 0.5, 1.0, red, 0, 0.6, -0.1, g);
  RB(5.8, 0.9, 0.15, 0.05, red, 0, 1.0, -0.55, g);
  for (let i = 0; i < 8; i++) {
    const x = -2.6 + i * (5.2 / 7);
    const sn = mk(new THREE.ConeGeometry(0.26, 1.5, 4), i % 2 ? light : red, x, 0.6, 1.1, g);
    sn.rotation.x = Math.PI / 2; sn.rotation.y = Math.PI / 4; sn.scale.set(1, 1, 0.7);
  }
  // gathering chains between the snouts
  for (let i = 0; i < 7; i++) B(0.06, 0.05, 1.1, IRON, -2.23 + i * (5.2 / 7), 0.72, 0.5, g);
  B(5.6, 0.12, 0.3, dark, 0, 0.32, 0.3, g);
  return g;
}

/** Mouldboard plough with five bottoms on a diagonal beam. */
export function buildPlough() {
  const g = new THREE.Group(), lift = new THREE.Group(); g.add(lift);
  const red = '#bf4a3f';
  RB(0.9, 0.5, 0.4, 0.06, red, 0, 0.8, -0.25, lift);
  const beam = RB(0.22, 0.22, 4.2, 0.04, red, 0, 0.85, -2.1, lift); beam.rotation.y = 0.32;
  rod([0, 1.35, -0.1], [0.3, 0.95, -0.9], 0.05, red, lift);
  for (let i = 0; i < 5; i++) {
    const t = i / 4, x = -0.55 + t * 1.25, z = -0.6 - t * 3.0;
    B(0.1, 0.65, 0.12, DARK, x, 0.5, z, lift);
    // twisted mouldboard in two pieces, share point and landside
    const mb = B(0.55, 0.5, 0.06, STEEL, x + 0.12, 0.24, z - 0.02, lift); mb.rotation.y = 0.6; mb.rotation.z = 0.25;
    const tw = B(0.4, 0.42, 0.06, STEEL, x + 0.42, 0.3, z - 0.28, lift); tw.rotation.y = 1.0; tw.rotation.z = 0.5;
    B(0.12, 0.05, 0.4, '#8a9196', x - 0.05, 0.03, z + 0.15, lift).rotation.y = 0.3;
    B(0.05, 0.22, 0.7, DARK, x - 0.12, 0.13, z - 0.2, lift);
  }
  rod([0.75, 0.85, -3.4], [1.15, 0.4, -3.9], 0.05, red, lift);
  const w = wheel(0.4, 0.25, '#d7dde2'); w.position.set(1.15, 0.4, -3.9); lift.add(w);
  bake(g);
  return { group: g, lift, wheels: [w], up: 0.5, down: -0.25 };
}

/** Twin-disc fertiliser spreader. */
export function buildSpreader() {
  const g = new THREE.Group(), lift = new THREE.Group(); g.add(lift);
  const orange = '#e08a3a', white = '#ecebe6';
  B(0.24, 0.24, 1.0, DARK, 0, 0.72, -0.4, lift);
  B(1.6, 0.15, 1.2, orange, 0, 0.75, -1.1, lift);
  RB(2.0, 0.85, 1.5, 0.08, white, 0, 1.55, -1.1, lift);
  RB(2.08, 0.1, 1.58, 0.03, orange, 0, 2.0, -1.1, lift);
  for (let k = 0; k < 6; k++) B(0.03, 0.03, 1.4, IRON, -0.85 + k * 0.34, 2.07, -1.1, lift); // sieve
  const fun = mk(new THREE.ConeGeometry(0.95, 0.7, 4), white, 0, 0.8, -1.1, lift); fun.rotation.x = Math.PI; fun.rotation.y = Math.PI / 4;
  // guard bow around the discs
  rod([-0.95, 0.5, -1.6], [-0.95, 0.5, -2.25], 0.035, DARK, lift);
  rod([0.95, 0.5, -1.6], [0.95, 0.5, -2.25], 0.035, DARK, lift);
  rod([-0.95, 0.5, -2.25], [0.95, 0.5, -2.25], 0.035, DARK, lift);
  const discs = [];
  for (const sx of [-0.4, 0.4]) {
    const d = new THREE.Group(); d.position.set(sx, 0.48, -1.75); lift.add(d);
    CY(0.38, 0.38, 0.04, 12, DARK, 0, 0, 0, d);
    for (let k = 0; k < 4; k++) { const v = B(0.7, 0.08, 0.04, orange, 0, 0.05, 0, d); v.rotation.y = (k * Math.PI) / 4; }
    discs.push(d);
  }
  bake(g);
  return { group: g, lift, discs, up: 0.05, down: 0 };
}

/** Round baler: pickup in front, bale chamber behind, single axle. */
/** Rear disc mower: 3 m cutter bar with discs under a red guard, A-frame headstock. */
export function buildMower() {
  const g = new THREE.Group(), lift = new THREE.Group(); g.add(lift);
  const red = '#c4473a';
  B(0.24, 0.24, 0.9, DARK, 0, 0.72, -0.4, lift);
  for (const sx of [-1, 1]) rod([sx * 0.42, 0.55, -0.15], [sx * 0.6, 0.8, -0.9], 0.05, DARK, lift);
  RB(3.1, 0.12, 0.6, 0.03, IRON, 0, 0.12, -1.25, lift); // cutter bar
  // discs (hidden under the guard, so they stay still and merge with the rest)
  for (let i = 0; i < 6; i++) CY(0.24, 0.24, 0.08, 10, STEEL, -1.25 + i * 0.5, 0.22, -1.25, lift);
  RB(3.2, 0.5, 0.95, 0.08, red, 0, 0.55, -1.3, lift); // guard
  B(3.0, 0.06, 0.1, '#e8e4da', 0, 0.81, -0.86, lift);
  B(0.3, 0.6, 0.3, red, 0, 0.9, -0.75, lift); // gearbox
  bake(g);
  return { group: g, lift, up: 0.55, down: -0.05 };
}

export function buildBaler() {
  const g = new THREE.Group();
  const cream = '#e7dfcf', orange = '#e08a3a';
  B(0.22, 0.22, 1.6, DARK, 0, 0.72, -0.8, g);
  const ch = mk(new THREE.CylinderGeometry(0.95, 0.95, 1.7, 18), cream, 0, 1.25, -2.7, g); ch.rotation.z = Math.PI / 2;
  for (const sx of [-1, 1]) {
    RB(0.08, 1.9, 2.1, 0.03, cream, sx * 0.9, 1.25, -2.65, g);
    B(0.1, 0.2, 2.1, orange, sx * 0.95, 2.1, -2.65, g);
    CY(0.12, 0.12, 0.12, 8, DARK, sx * 0.96, 1.25, -2.65, g).rotation.z = Math.PI / 2; // roller bearing
    CY(0.08, 0.08, 0.14, 8, DARK, sx * 0.96, 2.05, -3.4, g).rotation.z = Math.PI / 2; // tailgate hinge
    rod([sx * 0.96, 0.9, -1.9], [sx * 0.96, 1.9, -3.2], 0.05, STEEL, g); // tailgate ram
    B(0.12, 0.16, 0.06, TAIL, sx * 0.8, 0.75, -3.72, g);
  }
  B(1.9, 0.12, 0.3, orange, 0, 2.2, -2.65, g);
  RB(1.2, 0.35, 0.5, 0.06, orange, 0, 2.45, -1.9, g); // net wrap box
  const wheels = [];
  for (const sx of [-1, 1]) { const w = wheel(0.42, 0.28, '#d7dde2'); w.position.set(sx * 1.15, 0.42, -2.4); g.add(w); wheels.push(w); }
  const lift = new THREE.Group(); lift.position.set(0, 0, -1.5); g.add(lift);
  B(2.0, 0.22, 0.55, DARK, 0, 0.3, 0, lift);
  for (let i = 0; i < 9; i++) { const t = B(0.04, 0.3, 0.04, STEEL, -0.9 + i * 0.225, 0.18, 0.25, lift); t.rotation.x = 0.5; }
  CY(0.12, 0.12, 2.0, 8, IRON, 0, 0.5, -0.1, lift).rotation.z = Math.PI / 2; // crop roller
  bake(g);
  return { group: g, lift, wheels, up: 0.25, down: 0 };
}

/**
 * Self-propelled six-row sugar beet harvester: lifting unit in front, cab, big bunker in the middle,
 * unloading elevator on the left that swings out like the combine pipe.
 */
export function buildBeetHarvester() {
  const g = new THREE.Group(), blue = '#4d7c9e', light = '#e8e4da';
  B(2.2, 0.8, 7.0, DARK, 0, 1.0, -0.6, g);
  RB(3.0, 2.0, 4.0, 0.14, blue, 0, 2.6, -1.8, g);
  for (const sx of [-1, 1]) B(0.14, 0.16, 4.1, light, sx * 1.5, 3.65, -1.8, g); // bunker rim
  for (const sz of [-1, 1]) B(3.1, 0.16, 0.14, light, 0, 3.65, -1.8 + sz * 2.0, g);
  for (const sx of [-1, 1]) for (const z of [-3.2, -2.3, -1.4, -0.5]) B(0.05, 1.7, 0.1, '#426d8b', sx * 1.52, 2.6, z, g); // bunker ribs
  RB(2.4, 1.4, 1.5, 0.12, blue, 0, 2.3, -4.5, g);
  B(1.8, 0.06, 1.0, '#2f3437', 0, 3.02, -4.5, g);
  for (const sx of [-1, 1]) louvres(g, DARK, sx * 1.205, 1.8, 2.8, -4.5, 1.2, 5);
  RB(2.2, 0.9, 1.8, 0.1, blue, 0, 2.1, 2.3, g);
  mk(new THREE.BoxGeometry(2.0, 1.5, 1.6), glassMat, 0, 3.3, 2.3, g, false);
  RB(2.3, 0.18, 1.9, 0.07, light, 0, 4.14, 2.3, g);
  for (const sx of [-0.96, 0.96]) for (const sz of [1.55, 3.05]) B(0.09, 1.5, 0.09, DARK, sx, 3.3, sz, g);
  cabInside(g, 2.55, 2.3);
  mirrors(g, 1.05, 3.85, 2.95);
  for (const x of [-0.8, -0.3, 0.3, 0.8]) B(0.2, 0.12, 0.06, lampMat, x, 4.18, 3.2, g);
  CY(0.09, 0.09, 1.3, 6, DARK, -0.8, 3.6, -4.6, g);
  B(0.18, 0.18, 0.18, beaconMat, 0.9, 4.32, 2.0, g);
  for (let k = 0; k < 5; k++) B(0.5, 0.05, 0.2, DARK, -1.35, 0.7 + k * 0.42, 2.6, g); // ladder
  for (const sx of [-1, 1]) B(0.14, 0.2, 0.06, TAIL, sx * 1.0, 2.3, -5.26, g);
  // beet heap in the bunker, scaled by fill level
  const grainMat = new THREE.MeshStandardMaterial({ color: col('#d9c9a4'), roughness: 1, flatShading: true });
  const gg = new THREE.BoxGeometry(2.8, 1, 3.8); gg.translate(0, 0.5, 0);
  const grain = mk(gg, grainMat, 0, 3.55, -1.8, g);
  grain.userData.noBake = true; grain.visible = false;
  const wheels = [], rear = [];
  for (const sx of [-1, 1]) { const w = wheel(1.05, 0.8, light, 'lug'); w.position.set(sx * 1.6, 1.05, 1.4); g.add(w); wheels.push(w); }
  for (const sx of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(sx * 1.6, 1.05, -3.3); g.add(p);
    const w = wheel(1.05, 0.8, light, 'lug'); p.add(w); wheels.push(w); rear.push(p);
  }
  // six-row lifting unit with a topper roller
  const header = new THREE.Group(); header.position.set(0, 0, 3.7); g.add(header);
  const hl = new THREE.Group(); header.add(hl);
  RB(4.8, 0.6, 1.3, 0.08, blue, 0, 0.75, 0.2, hl);
  B(4.8, 0.12, 0.2, light, 0, 1.1, 0.85, hl);
  for (let i = 0; i < 6; i++) {
    const x = -1.875 + i * 0.75;
    B(0.22, 0.55, 0.9, DARK, x, 0.35, 0.8, hl);
    const c = mk(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 10), IRON, x + 0.15, 0.25, 1.2, hl); c.rotation.z = Math.PI / 2;
    B(0.08, 0.06, 0.35, STEEL, x - 0.1, 0.1, 1.25, hl).rotation.x = -0.3; // lifting share
  }
  const reel = new THREE.Group(); reel.position.set(0, 0.55, 1.35); hl.add(reel);
  const rc = mk(new THREE.CylinderGeometry(0.22, 0.22, 4.6, 8), '#6a6f72', 0, 0, 0, reel); rc.rotation.z = Math.PI / 2;
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; B(4.5, 0.06, 0.12, light, 0, Math.cos(a) * 0.25, Math.sin(a) * 0.25, reel); }
  // unloading elevator, folded back along the left side
  const pipe = new THREE.Group(); pipe.position.set(1.3, 3.7, -0.5); g.add(pipe);
  B(0.55, 0.35, 5.0, blue, 0, 0, -2.5, pipe);
  B(0.6, 0.12, 4.8, light, 0, 0.22, -2.5, pipe);
  for (let k = 0; k < 10; k++) B(0.5, 0.04, 0.06, DARK, 0, 0.3, -0.3 - k * 0.48, pipe); // elevator slats
  B(0.6, 0.5, 0.4, DARK, 0, -0.2, -5.0, pipe);
  const spot = addLights(g, 3.95, 3.15, [-0.7, 0.7]);
  bake(g);
  return {
    group: g, wheels, front: [], rear, headerLift: hl, reel, pipe, grain, grainMat, spot,
    exhaust: new THREE.Vector3(-0.8, 4.3, -4.6),
    pipeTip: new THREE.Vector3(0, -0.3, -5.0),
    pipeReach: { lx: 1.3 + 5.0, lz: -0.5 },
  };
}

/** Water tank on a single axle, for the greenhouses. */
export function buildWaterTank() {
  const g = new THREE.Group(), lift = new THREE.Group(); g.add(lift);
  const blue = '#7a9fb4', blueDk = '#5f8396';
  B(0.22, 0.22, 1.4, DARK, 0, 0.7, -0.6, lift);
  B(1.2, 0.2, 3.4, DARK, 0, 0.75, -2.4, lift);
  const t = mk(new THREE.CylinderGeometry(0.95, 0.95, 3.6, 18), blue, 0, 1.75, -2.4, lift); t.rotation.x = Math.PI / 2;
  for (const dz of [-1.3, 0, 1.3]) { const b = mk(new THREE.CylinderGeometry(0.98, 0.98, 0.12, 18), blueDk, 0, 1.75, -2.4 + dz, lift); b.rotation.x = Math.PI / 2; }
  for (const dz of [-1.8, 1.8]) {
    const cap = mk(new THREE.SphereGeometry(0.95, 18, 5, 0, Math.PI * 2, 0, Math.PI / 2), blue, 0, 1.75, -2.4 + dz, lift);
    cap.rotation.x = Math.sign(dz) * Math.PI / 2; cap.scale.set(1, 0.25, 1); // domed tank ends
  }
  CY(0.25, 0.25, 0.2, 10, blueDk, 0, 2.75, -2.4, lift);
  CY(0.28, 0.28, 0.05, 10, DARK, 0, 2.86, -2.4, lift);
  // filling pipe, valve and ladder at the back
  CY(0.08, 0.08, 0.5, 8, DARK, 0, 1.05, -4.35, lift).rotation.x = Math.PI / 2;
  CY(0.12, 0.12, 0.12, 8, '#c4473a', 0, 1.05, -4.62, lift).rotation.x = Math.PI / 2;
  for (let k = 0; k < 5; k++) B(0.36, 0.04, 0.05, DARK, 0.5, 0.9 + k * 0.32, -4.52, lift);
  for (const sx of [0.32, 0.68]) rod([sx, 0.8, -4.52], [sx, 2.6, -4.4], 0.025, DARK, lift);
  const wheels = [];
  for (const sx of [-1, 1]) {
    const w = wheel(0.5, 0.3, '#d7dde2'); w.position.set(sx * 1.05, 0.5, -2.6); lift.add(w); wheels.push(w);
    arc(lift, DARK, sx * 1.05, 0.5, -2.6, 0.62, Math.PI * 0.15, Math.PI * 0.85, 5, 0.38, 0.05);
    B(0.12, 0.16, 0.06, TAIL, sx * 0.55, 0.75, -4.12, lift);
  }
  bake(g);
  return { group: g, lift, wheels, up: 0, down: 0 };
}

/** Forestry harvester with a crane and a log bunk at the back. */
export function buildForester() {
  const g = new THREE.Group(), yel = '#e0b13a', yelDk = '#c99a2c', light = '#e8e4da';
  B(2.2, 0.9, 6.6, DARK, 0, 1.15, -0.6, g);
  RB(2.3, 1.2, 2.2, 0.12, yel, 0, 2.0, 1.6, g);
  mk(new THREE.BoxGeometry(2.0, 1.4, 1.6), glassMat, 0, 3.3, 1.6, g, false);
  RB(2.3, 0.18, 1.9, 0.07, yel, 0, 4.08, 1.6, g);
  for (const sx of [-0.95, 0.95]) for (const sz of [0.85, 2.35]) B(0.09, 1.4, 0.09, DARK, sx, 3.3, sz, g);
  // window guards (forestry cabs have bars over the glass)
  for (let k = 0; k < 4; k++) B(0.04, 1.3, 0.04, DARK, -0.6 + k * 0.4, 3.3, 2.43, g);
  cabInside(g, 2.6, 1.6);
  mirrors(g, 1.02, 3.75, 2.2);
  for (const x of [-0.7, 0.7]) B(0.2, 0.12, 0.06, lampMat, x, 4.12, 2.5, g);
  RB(2.2, 1.0, 1.4, 0.1, yel, 0, 2.0, -0.6, g);
  for (const sx of [-1, 1]) louvres(g, DARK, sx * 1.105, 1.6, 2.4, -0.6, 1.1, 4);
  CY(0.08, 0.08, 1.2, 6, DARK, 0.7, 3.0, -0.9, g);
  CY(0.1, 0.08, 0.1, 6, IRON, 0.7, 3.62, -0.9, g);
  B(0.16, 0.16, 0.16, beaconMat, 0.85, 4.27, 1.2, g);
  // articulation joint, log bunk with stanchions
  CY(0.3, 0.3, 0.6, 10, IRON, 0, 1.15, 0.4, g);
  B(2.3, 0.2, 3.4, DARK, 0, 1.7, -3.0, g);
  for (const sx of [-1.1, 1.1]) for (const sz of [-4.4, -1.7]) RB(0.16, 1.6, 0.16, 0.04, yel, sx, 2.5, sz, g);
  for (const sz of [-4.4, -1.7]) B(2.4, 0.12, 0.16, yelDk, 0, 1.85, sz, g);
  B(2.3, 1.5, 0.08, DARK, 0, 2.5, -1.4, g); // headboard
  for (let k = 0; k < 5; k++) B(2.2, 0.04, 0.1, IRON, 0, 1.9 + k * 0.28, -1.36, g);
  for (const sx of [-1, 1]) B(0.14, 0.2, 0.06, TAIL, sx * 0.95, 1.4, -3.92, g);
  const logs = [];
  for (let k = 0; k < 12; k++) {
    const row = k % 4, layer = Math.floor(k / 4);
    const l = mk(new THREE.CylinderGeometry(0.24, 0.24, 3.6, 7), '#a5784f', -0.75 + row * 0.5, 2.05 + layer * 0.45, -3.0, g);
    l.rotation.x = Math.PI / 2; l.userData.noBake = true; l.visible = false; logs.push(l);
  }
  const wheels = [], rear = [];
  for (const sz of [1.4, -1.3, -3.6]) for (const sx of [-1, 1]) {
    const w = wheel(0.75, 0.6, light, 'lug');
    if (sz === 1.4) { const p = new THREE.Group(); p.position.set(sx * 1.25, 0.75, sz); g.add(p); p.add(w); rear.push(p); }
    else { w.position.set(sx * 1.25, 0.75, sz); g.add(w); }
    wheels.push(w);
  }
  // crane: turret, boom with hydraulic rams and the felling head (rotates toward the tree while cutting)
  const crane = new THREE.Group(); crane.position.set(0, 2.6, 0.1); g.add(crane);
  CY(0.45, 0.55, 0.6, 12, yel, 0, 0.3, 0, crane);
  CY(0.5, 0.5, 0.08, 12, DARK, 0, 0.05, 0, crane);
  const boom = new THREE.Group(); boom.position.set(0, 0.6, 0); crane.add(boom);
  const b1 = RB(0.3, 0.3, 4.2, 0.05, yel, 0, 0.8, 1.8, boom); b1.rotation.x = -0.35;
  const b2 = RB(0.24, 0.24, 3.2, 0.04, yel, 0, 1.0, 5.2, boom); b2.rotation.x = 0.5;
  rod([0.22, 0.05, 0.2], [0.22, 1.25, 2.6], 0.07, STEEL, boom);
  rod([-0.22, 0.05, 0.2], [-0.22, 1.25, 2.6], 0.07, STEEL, boom);
  rod([0, 1.75, 3.4], [0, 1.15, 5.6], 0.06, STEEL, boom);
  RB(0.6, 0.7, 0.5, 0.06, DARK, 0, 0.2, 6.6, boom);
  for (const sx of [-1, 1]) B(0.08, 0.5, 0.12, yel, sx * 0.32, -0.1, 6.75, boom).rotation.z = sx * 0.3; // grapple arms
  CY(0.32, 0.32, 0.04, 12, STEEL, 0, -0.18, 6.6, boom); // saw disc guard
  const spot = addLights(g, 2.5, 2.75, [-0.6, 0.6]);
  bake(g);
  return { group: g, wheels, front: rear, rear: [], crane, boom, logMeshes: logs, spot, exhaust: new THREE.Vector3(0.7, 3.7, -0.9) };
}
