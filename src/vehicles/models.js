import * as THREE from 'three';
import { M, mk, B, CY, bake, glassMat, lampMat, beaconMat } from '../render/materials.js';
import { col } from '../core/util.js';

// Low-poly vehicle models. Local +z is forward, +x is the driver's left.
// Moving parts are separate groups; everything else is merged by bake().

export function wheel(r, w, rimHex) {
  const g = new THREE.Group(), spin = new THREE.Group();
  g.add(spin);
  const tire = mk(new THREE.CylinderGeometry(r, r, w, 16), '#2a2c2e', 0, 0, 0, spin); tire.rotation.z = Math.PI / 2;
  const rim = mk(new THREE.CylinderGeometry(r * 0.56, r * 0.56, w + 0.04, 10), rimHex, 0, 0, 0, spin); rim.rotation.z = Math.PI / 2;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const l = B(w * 1.04, r * 0.16, r * 0.22, '#2a2c2e', 0, Math.cos(a) * r * 0.97, Math.sin(a) * r * 0.97, spin);
    l.rotation.x = a;
  }
  g.userData = { spin, r };
  return g;
}

/** Headlamps plus one spot light that only shines at night. */
function addLights(g, y, z, xs) {
  for (const x of xs) B(0.32, 0.18, 0.08, lampMat, x, y, z, g);
  const sp = new THREE.SpotLight(0xfff1c8, 0, 48, 0.75, 0.6, 0);
  sp.position.set(0, y, z);
  const t = new THREE.Object3D(); t.position.set(0, 0, z + 18);
  g.add(sp, t); sp.target = t;
  return sp;
}

export function buildTractor() {
  const g = new THREE.Group(), body = '#5f9c7c', dark = '#3a3f42', cream = '#efe2b8';
  B(0.9, 0.55, 3.6, dark, 0, 0.85, 0.35, g);
  B(1.1, 0.95, 2.0, body, 0, 1.45, 1.15, g);
  B(1.16, 0.1, 2.06, '#4f8a6b', 0, 1.96, 1.15, g);
  B(1.02, 0.55, 0.45, dark, 0, 0.92, 2.35, g);
  B(0.9, 0.4, 0.06, '#2f3437', 0, 1.5, 2.16, g);
  B(1.8, 0.35, 1.8, body, 0, 1.6, -0.55, g);
  mk(new THREE.BoxGeometry(1.7, 1.45, 1.7), glassMat, 0, 2.5, -0.55, g, false);
  B(1.88, 0.16, 1.92, body, 0, 3.3, -0.55, g);
  for (const sx of [-0.83, 0.83]) for (const sz of [-1.36, 0.26]) B(0.1, 1.45, 0.1, dark, sx, 2.5, sz, g);
  for (const sx of [-1, 1]) B(0.66, 0.16, 1.9, body, sx * 1.0, 1.86, -0.7, g);
  CY(0.06, 0.06, 1.1, 6, dark, 0.42, 2.45, 1.85, g);
  B(0.32, 0.26, 0.5, dark, 0, 0.7, -1.6, g);
  const wheels = [], front = [];
  for (const sx of [-1, 1]) { const w = wheel(0.86, 0.6, cream); w.position.set(sx * 1.0, 0.86, -0.7); g.add(w); wheels.push(w); }
  for (const sx of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(sx * 0.84, 0.52, 1.55); g.add(p);
    const w = wheel(0.52, 0.42, cream); p.add(w); wheels.push(w); front.push(p);
  }
  const spot = addLights(g, 2.0, 2.2, [-0.4, 0.4]);
  B(0.16, 0.16, 0.16, beaconMat, 0.7, 3.46, -0.1, g);
  bake(g);
  return { group: g, wheels, front, rear: [], spot, exhaust: new THREE.Vector3(0.42, 3.05, 1.85) };
}

export function buildCultivator() {
  const g = new THREE.Group(), lift = new THREE.Group(); g.add(lift);
  const y = '#e0a640', dark = '#3a3f42';
  B(0.24, 0.24, 1.0, y, 0, 0.72, -0.4, lift);
  B(4.2, 0.22, 0.25, y, 0, 0.85, -0.95, lift);
  B(4.2, 0.22, 0.25, y, 0, 0.85, -1.75, lift);
  for (const sx of [-1, 1]) B(0.18, 0.2, 1.1, y, sx * 2.0, 0.85, -1.35, lift);
  B(1.6, 0.2, 0.2, y, 0, 0.85, -0.55, lift);
  for (let i = 0; i < 9; i++) B(0.08, 0.8, 0.08, dark, -1.84 + i * 0.46, 0.45, i % 2 ? -0.95 : -1.75, lift);
  const roller = new THREE.Group(); roller.position.set(0, 0.32, -2.4); lift.add(roller);
  const rc = mk(new THREE.CylinderGeometry(0.3, 0.3, 4.1, 10), '#6a6f72', 0, 0, 0, roller); rc.rotation.z = Math.PI / 2;
  for (const sx of [-1, 1]) B(0.12, 0.12, 0.8, y, sx * 2.0, 0.6, -2.05, lift);
  bake(g);
  return { group: g, lift, roller, up: 0.45, down: -0.2 };
}

export function buildSeeder() {
  const g = new THREE.Group(), lift = new THREE.Group(); g.add(lift);
  const blue = '#4f78a8', dark = '#3a3f42';
  B(0.24, 0.24, 1.0, dark, 0, 0.72, -0.4, lift);
  B(4.0, 0.2, 0.25, dark, 0, 0.75, -0.9, lift);
  B(3.8, 0.95, 1.05, blue, 0, 1.5, -1.15, lift);
  B(3.9, 0.12, 1.15, '#6f97c4', 0, 2.03, -1.15, lift);
  for (const sx of [-1.7, 1.7]) B(0.12, 0.8, 0.12, dark, sx, 0.95, -1.15, lift);
  B(4.0, 0.16, 0.2, dark, 0, 0.55, -1.6, lift);
  for (let i = 0; i < 12; i++) {
    const d = mk(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 10), '#55595c', -1.83 + i * 0.333, 0.28, -1.65, lift);
    d.rotation.z = Math.PI / 2;
  }
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
  const g = new THREE.Group(), body = '#c8794a', dark = '#3a3f42', trim = '#e8a46f';
  B(1.0, 0.25, 5.8, dark, 0, 0.72, 0.8, g);
  B(0.2, 0.2, 1.2, dark, 0, 0.66, 3.7, g);
  CY(0.12, 0.12, 0.1, 8, dark, 0, 0.62, 4.2, g);
  const wheels = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-0.62, 0.62]) { const w = wheel(0.55, 0.4, '#d7dde2'); w.position.set(sx * 1.15, 0.55, sz); g.add(w); wheels.push(w); }
    B(0.5, 0.08, 2.5, dark, sx * 1.15, 1.18, 0, g);
  }
  // tipping body hinged at the rear edge
  const tip = new THREE.Group(); tip.position.set(0, 0.95, -2.0); g.add(tip);
  B(2.4, 0.12, 5.6, body, 0, 0.06, 2.8, tip);
  for (const sx of [-1, 1]) {
    B(0.1, 1.3, 5.6, body, sx * 1.2, 0.71, 2.8, tip);
    B(0.12, 0.12, 5.64, trim, sx * 1.22, 1.3, 2.8, tip);
  }
  B(2.4, 1.3, 0.1, body, 0, 0.71, 5.55, tip);
  B(2.4, 1.3, 0.1, body, 0, 0.71, 0.05, tip);
  B(2.5, 0.12, 0.14, trim, 0, 1.3, 5.55, tip);
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
  const g = new THREE.Group(), red = '#cf5a4a', dark = '#3a3f42', light = '#ebe4d2';
  B(2.5, 2.2, 5.4, red, 0, 2.3, -0.5, g);
  B(2.0, 0.7, 4.6, dark, 0, 0.95, -0.4, g);
  B(2.35, 0.8, 2.6, '#dc6a58', 0, 3.8, -0.9, g);
  B(2.3, 0.95, 1.3, red, 0, 3.85, -2.55, g);
  B(1.6, 0.06, 0.9, '#2f3437', 0, 4.35, -2.55, g);
  B(2.52, 0.12, 5.42, light, 0, 1.25, -0.5, g);
  // grain heap in the open tank, scaled by fill level
  const grainMat = new THREE.MeshStandardMaterial({ color: col('#e4bc52'), roughness: 1, flatShading: true });
  const gg = new THREE.BoxGeometry(2.15, 1, 2.4); gg.translate(0, 0.5, 0);
  const grain = mk(gg, grainMat, 0, 4.2, -0.9, g);
  grain.userData.noBake = true; grain.visible = false;
  mk(new THREE.BoxGeometry(1.9, 1.4, 1.45), glassMat, 0, 4.1, 1.5, g, false);
  B(2.1, 0.15, 1.7, light, 0, 4.88, 1.5, g);
  for (const sx of [-0.92, 0.92]) for (const sz of [0.82, 2.18]) B(0.09, 1.4, 0.09, dark, sx, 4.1, sz, g);
  const fh = B(1.4, 1.0, 1.9, dark, 0, 1.35, 2.95, g); fh.rotation.x = 0.16;
  CY(0.09, 0.09, 1.2, 6, dark, -0.8, 4.85, -2.7, g);
  for (let k = 0; k < 5; k++) B(0.5, 0.05, 0.2, dark, -1.4, 0.7 + k * 0.5, 1.95, g);
  B(0.18, 0.18, 0.18, beaconMat, 0.85, 5.04, 1.0, g); B(0.18, 0.18, 0.18, beaconMat, -0.85, 5.04, 1.0, g);
  const wheels = [], rear = [];
  for (const sx of [-1, 1]) { const w = wheel(1.05, 0.75, light); w.position.set(sx * 1.5, 1.05, 1.25); g.add(w); wheels.push(w); }
  for (const sx of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(sx * 1.2, 0.62, -2.75); g.add(p);
    const w = wheel(0.62, 0.45, light); p.add(w); wheels.push(w); rear.push(p);
  }
  // headers: the grain header (with a spinning reel) and the row header for corn and sunflower.
  // Both are built here; the unused one is parked in the yard by setHeader() in vehicles.js.
  const header = new THREE.Group(); header.position.set(0, 0, 3.75); g.add(header);
  const hl = new THREE.Group(); header.add(hl);
  const grainHdr = new THREE.Group(); hl.add(grainHdr);
  B(5.8, 0.35, 1.4, red, 0, 0.55, 0.3, grainHdr);
  B(5.8, 1.1, 0.15, red, 0, 1.0, -0.35, grainHdr);
  for (const sx of [-1, 1]) {
    B(0.12, 0.9, 1.5, red, sx * 2.9, 0.85, 0.3, grainHdr);
    const d = mk(new THREE.ConeGeometry(0.22, 0.9, 4), light, sx * 2.9, 0.55, 1.25, grainHdr); d.rotation.x = Math.PI / 2;
  }
  B(5.6, 0.08, 0.2, '#56595b', 0, 0.42, 1.0, grainHdr);
  const reel = new THREE.Group(); reel.position.set(0, 1.62, 0.45); grainHdr.add(reel);
  const ax = mk(new THREE.CylinderGeometry(0.07, 0.07, 5.5, 6), dark, 0, 0, 0, reel); ax.rotation.z = Math.PI / 2;
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; B(5.3, 0.08, 0.08, light, 0, Math.cos(a) * 0.55, Math.sin(a) * 0.55, reel); }
  for (const sx of [-2.7, 0, 2.7]) for (let k = 0; k < 3; k++) { const s = B(0.05, 1.1, 0.05, dark, sx, 0, 0, reel); s.rotation.x = (k * Math.PI) / 3; }
  for (const sx of [-1, 1]) { const arm = B(0.1, 0.1, 1.4, red, sx * 2.75, 1.45, 0.0, grainHdr); arm.rotation.x = -0.2; }
  const cornHdr = buildRowHeader(red, dark, light);
  hl.add(cornHdr);
  // unloading pipe, folded backwards; swings out to the left (+x) when unloading
  const pipe = new THREE.Group(); pipe.position.set(1.05, 4.05, -1.9); g.add(pipe);
  const pc = mk(new THREE.CylinderGeometry(0.17, 0.17, 4.6, 8), red, 0, 0, -2.3, pipe); pc.rotation.x = Math.PI / 2;
  B(0.36, 0.5, 0.36, dark, 0, -0.2, -4.6, pipe);
  const spot = addLights(g, 4.75, 2.3, [-0.6, 0.6]);
  bake(g);
  return { group: g, wheels, front: [], rear, headerLift: hl, grainHdr, cornHdr, reel, pipe, grain, grainMat, spot, exhaust: new THREE.Vector3(-0.8, 5.5, -2.7) };
}

/** Round straw bale, axis along x, sitting on the ground at y = 0. */
export function baleGeo() { return new THREE.CylinderGeometry(0.75, 0.75, 1.2, 14).rotateZ(Math.PI / 2); }

/** Row header for corn and sunflower: pointed snouts between the rows. */
function buildRowHeader(red, dark, light) {
  const g = new THREE.Group();
  B(5.8, 0.5, 1.0, red, 0, 0.6, -0.1, g);
  B(5.8, 0.9, 0.15, red, 0, 1.0, -0.55, g);
  for (let i = 0; i < 8; i++) {
    const x = -2.6 + i * (5.2 / 7);
    const sn = mk(new THREE.ConeGeometry(0.26, 1.5, 4), i % 2 ? light : red, x, 0.6, 1.1, g);
    sn.rotation.x = Math.PI / 2; sn.rotation.y = Math.PI / 4; sn.scale.set(1, 1, 0.7);
  }
  B(5.6, 0.12, 0.3, dark, 0, 0.32, 0.3, g);
  return g;
}

/** Mouldboard plough with five bottoms on a diagonal beam. */
export function buildPlough() {
  const g = new THREE.Group(), lift = new THREE.Group(); g.add(lift);
  const red = '#bf4a3f', dark = '#3a3f42', steel = '#b9bfc2';
  B(0.9, 0.5, 0.4, red, 0, 0.8, -0.25, lift);
  const beam = B(0.22, 0.22, 4.2, red, 0, 0.85, -2.1, lift); beam.rotation.y = 0.32;
  for (let i = 0; i < 5; i++) {
    const t = i / 4, x = -0.55 + t * 1.25, z = -0.6 - t * 3.0;
    B(0.1, 0.65, 0.12, dark, x, 0.5, z, lift);
    const mb = B(0.75, 0.5, 0.08, steel, x + 0.2, 0.22, z - 0.1, lift); mb.rotation.y = 0.75; mb.rotation.z = 0.35;
  }
  const w = wheel(0.4, 0.25, '#d7dde2'); w.position.set(1.15, 0.4, -3.9); lift.add(w);
  bake(g);
  return { group: g, lift, wheels: [w], up: 0.5, down: -0.25 };
}

/** Twin-disc fertiliser spreader. */
export function buildSpreader() {
  const g = new THREE.Group(), lift = new THREE.Group(); g.add(lift);
  const orange = '#e08a3a', white = '#ecebe6', dark = '#3a3f42';
  B(0.24, 0.24, 1.0, dark, 0, 0.72, -0.4, lift);
  B(1.6, 0.15, 1.2, orange, 0, 0.75, -1.1, lift);
  B(2.0, 0.85, 1.5, white, 0, 1.55, -1.1, lift);
  B(2.06, 0.1, 1.56, orange, 0, 2.0, -1.1, lift);
  const fun = mk(new THREE.ConeGeometry(0.95, 0.7, 4), white, 0, 0.8, -1.1, lift); fun.rotation.x = Math.PI; fun.rotation.y = Math.PI / 4;
  const discs = [];
  for (const sx of [-0.4, 0.4]) {
    const d = new THREE.Group(); d.position.set(sx, 0.48, -1.75); lift.add(d);
    CY(0.38, 0.38, 0.04, 12, dark, 0, 0, 0, d);
    for (let k = 0; k < 4; k++) { const v = B(0.7, 0.08, 0.04, orange, 0, 0.05, 0, d); v.rotation.y = (k * Math.PI) / 4; }
    discs.push(d);
  }
  bake(g);
  return { group: g, lift, discs, up: 0.05, down: 0 };
}

/** Round baler: pickup in front, bale chamber behind, single axle. */
export function buildBaler() {
  const g = new THREE.Group();
  const cream = '#e7dfcf', orange = '#e08a3a', dark = '#3a3f42';
  B(0.22, 0.22, 1.6, dark, 0, 0.72, -0.8, g);
  const ch = mk(new THREE.CylinderGeometry(0.95, 0.95, 1.7, 16), cream, 0, 1.25, -2.7, g); ch.rotation.z = Math.PI / 2;
  for (const sx of [-1, 1]) {
    B(0.08, 1.9, 2.1, cream, sx * 0.9, 1.25, -2.65, g);
    B(0.1, 0.2, 2.1, orange, sx * 0.95, 2.1, -2.65, g);
  }
  B(1.9, 0.12, 0.3, orange, 0, 2.2, -2.65, g);
  const wheels = [];
  for (const sx of [-1, 1]) { const w = wheel(0.42, 0.28, '#d7dde2'); w.position.set(sx * 1.15, 0.42, -2.4); g.add(w); wheels.push(w); }
  const lift = new THREE.Group(); lift.position.set(0, 0, -1.5); g.add(lift);
  B(2.0, 0.22, 0.55, dark, 0, 0.3, 0, lift);
  for (let i = 0; i < 9; i++) { const t = B(0.04, 0.3, 0.04, steelHex, -0.9 + i * 0.225, 0.18, 0.25, lift); t.rotation.x = 0.5; }
  bake(g);
  return { group: g, lift, wheels, up: 0.25, down: 0 };
}
const steelHex = '#b9bfc2';
