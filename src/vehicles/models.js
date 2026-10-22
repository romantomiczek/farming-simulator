import * as THREE from 'three';
import { M, mk, B, CY, bake, glassMat, beaconMat } from '../render/materials.js';
import { col } from '../core/util.js';
import {
  P, F, S, RUBBER, CHROME, RB, rod, ram, hose, profile, fender, decal, sideDecals, sideText, textDecal, wheel,
  headlamp, tailCluster, workLight, beacon, mirrors, cabInside, seatMark, glassFrame, wiper, steps, ATLAS, LOD,
} from './parts.js';

// Vehicle models. Local +z is forward, +x is the driver's left.
// Moving parts are separate groups; everything else is merged by bake(), so the small
// details below cost triangles but hardly any draw calls (paint, rubber and steel share one).

export { wheel };
const NO_SNOW = { snow: false, atlas: ATLAS }; // machines stay clean in winter; names and stripes merge with the paint
const BLACK = '#2a2d2f';

/**
 * Where the machine's headlights shine from (local y, z). The scene has a few spot lights that
 * environment.js gives to the machines nearest the camera, so more machines never mean more lights.
 */
const spotAt = (g, y, z) => ({ pos: new THREE.Vector3(0, y, z), target: new THREE.Vector3(0, 0, z + 18) });

/**
 * Cab of a self-propelled machine or tractor: glass with rounded corner posts, frames, a door on
 * the left with handle and hinges, roof with overhang, sun visor and work lights, wipers, mirrors
 * and the interior. o = { y (floor), z (centre), w, h, d, roof (material), lights, rearLights, bars, passenger }.
 */
function cab(g, o) {
  const { y, z, w, h, d } = o, top = y + h, post = F(BLACK);
  mk(new THREE.BoxGeometry(w - 0.06, h, d - 0.06), glassMat, 0, y + h / 2, z, g, false);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) RB(0.1, h, 0.1, 0.035, post, sx * (w / 2 - 0.05), y + h / 2, z + sz * (d / 2 - 0.05), g);
  for (const sz of [-1, 1]) { B(w, 0.07, 0.07, post, 0, y + 0.035, z + sz * (d / 2 - 0.035), g); B(w, 0.06, 0.06, post, 0, top - 0.03, z + sz * (d / 2 - 0.03), g); }
  for (const sx of [-1, 1]) { B(0.07, 0.07, d, post, sx * (w / 2 - 0.035), y + 0.035, z, g); B(0.06, 0.06, d, post, sx * (w / 2 - 0.03), top - 0.03, z, g); }
  // door on the left: frame, rubber seal line, handle and hinges on the front post
  const dz = z + d * 0.06, dw = d * 0.7;
  glassFrame(g, post, dw, h * 0.94, w / 2 - 0.01, y + h * 0.49, dz, Math.PI / 2, 0.035);
  B(0.035, 0.05, 0.2, CHROME, w / 2 + 0.03, y + h * 0.42, dz - dw / 2 + 0.16, g);
  for (const k of [0.25, 0.75]) CY(0.03, 0.03, 0.12, 8, post, w / 2 + 0.02, y + h * k, dz + dw / 2 + 0.02, g);
  // the right side has a split window with a vertical bar
  B(0.035, h * 0.94, 0.035, post, -w / 2 + 0.01, y + h * 0.49, z - d * 0.1, g);
  // roof: overhang all round, sloping visor at the front, raised centre
  const zf = z + d / 2, zb = z - d / 2;
  profile([[zb - 0.06, top], [zf + 0.12, top], [zf + 0.18, top + 0.11], [zf + 0.02, top + 0.22], [zb + 0.04, top + 0.22], [zb - 0.1, top + 0.12]], w + 0.18, 0.05, o.roof, 0, g);
  RB(w * 0.62, 0.1, d * 0.5, 0.04, o.roof, 0, top + 0.27, z - d * 0.12, g);
  B(w * 0.82, 0.02, 0.32, M('#26343a', { roughness: 0.3, flatShading: false }), 0, top - 0.09, zf - 0.22, g); // tinted sun visor
  if (!LOD.low) B(w - 0.14, 0.03, d - 0.14, M('#a7aba6', { roughness: 0.95, flatShading: false, emissive: col('#3c3f3c') }), 0, top - 0.05, z, g); // light headliner inside
  const n = o.lights || 2;
  for (let k = 0; k < n; k++) workLight(g, (k - (n - 1) / 2) * ((w - 0.4) / Math.max(1, n - 1)), top + 0.12, zf + 0.14, 0, 0.25);
  for (const sx of [-1, 1]) if (o.rearLights !== false) workLight(g, sx * (w / 2 - 0.25), top + 0.12, zb - 0.12, Math.PI, 0.25);
  wiper(g, 0.12, y + 0.12, zf + 0.01, h * 0.62, 0.55);
  if (o.bars) for (let k = 0; k < 5; k++) B(0.035, h * 0.92, 0.035, post, -w / 2 + 0.25 + k * ((w - 0.5) / 4), y + h / 2, zf + 0.06, g); // forestry guard
  cabInside(g, y, z, o.passenger ? w : 1.6);
  mirrors(g, w / 2, top - 0.25, zf - 0.15);
}

/** Open four-wheel-drive jeep: khaki body, canvas top over the rear, roll bar, spare wheel at the back. */
export function buildJeep() {
  const g = new THREE.Group(), body = P('#7d8a54'), bodyDk = P('#626e40'), canvas = M('#d8cfae', { roughness: 0.95, flatShading: false }), frame = F();
  RB(1.1, 0.3, 3.7, 0.05, frame, 0, 0.55, 0, g); // chassis
  // tub with door cut-outs and seams, bonnet with a raised centre and vents
  RB(1.78, 0.62, 3.9, 0.12, body, 0, 0.98, 0, g, 3);
  for (const sx of [-1, 1]) {
    B(0.012, 0.5, 0.02, F(BLACK), sx * 0.891, 1.0, 0.45, g); B(0.012, 0.5, 0.02, F(BLACK), sx * 0.891, 1.0, -0.55, g);
    B(0.03, 0.04, 0.16, CHROME, sx * 0.9, 1.12, -0.35, g); // door handle
    RB(0.22, 0.05, 1.3, 0.02, F(), sx * 0.98, 0.62, 0, g); // side step
    B(0.04, 0.16, 0.04, F(), sx * 0.92, 0.7, 0.5, g); B(0.04, 0.16, 0.04, F(), sx * 0.92, 0.7, -0.5, g);
  }
  profile([[0.55, 1.22], [1.98, 1.22], [1.98, 1.5], [1.85, 1.56], [0.55, 1.58]], 1.66, 0.06, body, 0, g);
  RB(0.7, 0.06, 1.1, 0.03, bodyDk, 0, 1.66, 1.25, g);
  for (const sx of [-1, 1]) for (let k = 0; k < 4; k++) B(0.18, 0.012, 0.05, F(BLACK), sx * 0.5, 1.645, 1.0 + k * 0.12, g);
  sideDecals('lesak', 0.7, 0.18, 0.83, 1.4, 1.25, g);
  // grille with slots, round lamps, bumper with winch and tow hooks, plate
  B(1.36, 0.32, 0.05, F(BLACK), 0, 1.33, 2.06, g);
  for (let k = 0; k < 7; k++) RB(0.08, 0.26, 0.04, 0.015, CHROME, -0.42 + k * 0.14, 1.33, 2.09, g);
  for (const sx of [-0.56, 0.56]) {
    CY(0.14, 0.14, 0.06, 16, CHROME, sx, 1.33, 2.09, g).rotation.x = Math.PI / 2;
    mk(new THREE.CylinderGeometry(0.115, 0.115, 0.04, 16), M('#fff4d6', { roughness: 0.1, flatShading: false }), sx, 1.33, 2.11, g).rotation.x = Math.PI / 2;
  }
  RB(1.95, 0.18, 0.22, 0.05, frame, 0, 0.66, 2.08, g); RB(1.95, 0.18, 0.22, 0.05, frame, 0, 0.66, -2.08, g);
  RB(0.5, 0.2, 0.22, 0.04, F(BLACK), 0, 0.88, 2.1, g); CY(0.08, 0.08, 0.4, 10, S(), 0, 0.88, 2.22, g).rotation.z = Math.PI / 2;
  for (const sx of [-1, 1]) mk(new THREE.TorusGeometry(0.06, 0.018, 6, 10, Math.PI), F(), sx * 0.7, 0.66, 2.22, g).rotation.y = Math.PI / 2;
  decal('plate2', 0.42, 0.21, 0, 0.66, 2.195, 0, g);
  // flared fenders over the wheels
  for (const sx of [-1, 1]) for (const sz of [-1.3, 1.3]) fender(g, bodyDk, sx * 0.93, 0.42, sz, 0.5, Math.PI * 0.1, Math.PI * 0.9, 0.36, 0.05);
  // windscreen frame and glass with wipers, roll bar, canvas top over the back seats
  RB(1.62, 0.07, 0.07, 0.02, frame, 0, 2.05, 0.5, g);
  for (const sx of [-0.78, 0.78]) RB(0.07, 0.68, 0.07, 0.02, frame, sx, 1.72, 0.5, g);
  mk(new THREE.BoxGeometry(1.5, 0.6, 0.04), glassMat, 0, 1.72, 0.5, g, false);
  for (const x of [-0.35, 0.35]) wiper(g, x, 1.45, 0.53, 0.42, 0.35);
  for (const sx of [-0.8, 0.8]) rod([sx, 1.3, -0.35], [sx, 2.2, -0.35], 0.04, frame, g);
  rod([-0.8, 2.2, -0.35], [0.8, 2.2, -0.35], 0.04, frame, g);
  RB(1.74, 0.14, 1.45, 0.05, canvas, 0, 2.25, -1.05, g);
  for (const sx of [-0.85, 0.85]) {
    B(0.04, 0.82, 1.4, canvas, sx, 1.82, -1.05, g);
    mk(new THREE.BoxGeometry(0.02, 0.32, 0.6), glassMat, sx * 1.03, 1.95, -1.05, g, false); // side window in the canvas
  }
  // seats and steering wheel, small mirrors on the windscreen frame
  for (const sx of [-0.4, 0.4]) { RB(0.5, 0.12, 0.5, 0.04, F(BLACK), sx, 1.35, -0.05, g); RB(0.5, 0.55, 0.1, 0.04, F(BLACK), sx, 1.62, -0.3, g); }
  seatMark(g, 0.4, 1.41, -0.05, { dy: 0.27, dz: 0.3, r: 0.17, tilt: 1.0 });
  RB(1.4, 0.12, 0.5, 0.04, F(BLACK), 0, 1.35, -1.05, g);
  mk(new THREE.TorusGeometry(0.17, 0.02, 6, 18), F(BLACK), 0.4, 1.68, 0.25, g).rotation.x = Math.PI / 2 - 1.0;
  for (const sx of [-1, 1]) { rod([sx * 0.8, 1.9, 0.5], [sx * 0.98, 1.95, 0.6], 0.015, frame, g); RB(0.05, 0.16, 0.2, 0.02, F(BLACK), sx * 1.0, 1.95, 0.62, g); }
  // spare wheel, tail lamps, jerrycan, plate
  const spare = wheel(0.4, 0.26, '#3a3f42', 'lug'); spare.rotation.y = Math.PI / 2; spare.position.set(0, 1.25, -2.1); g.add(spare);
  for (const sx of [-1, 1]) tailCluster(g, sx * 0.72, 1.02, -1.97);
  RB(0.26, 0.4, 0.16, 0.03, P('#c4473a'), 0.7, 1.45, -1.9, g);
  decal('plate2', 0.42, 0.21, 0, 0.66, -2.195, Math.PI, g);
  const wheels = [], front = [];
  for (const sx of [-1, 1]) { const w = wheel(0.42, 0.32, '#4f5458', 'lug'); w.position.set(sx * 0.86, 0.42, -1.3); g.add(w); wheels.push(w); }
  for (const sx of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(sx * 0.86, 0.42, 1.3); g.add(p);
    const w = wheel(0.42, 0.32, '#4f5458', 'lug'); p.add(w); wheels.push(w); front.push(p);
  }
  const spot = spotAt(g, 1.33, 2.1);
  bake(g, NO_SNOW);
  return { group: g, wheels, front, rear: [], spot, exhaust: new THREE.Vector3(-0.55, 0.5, -2.05) };
}

/** Shared bits of the closed cars: glass house with pillars, mirrors, lamps, plates and the steering wheels. */
function carWheels(g, r, w, rim, tread, x, zf, zr) {
  const wheels = [], front = [];
  for (const sx of [-1, 1]) { const wh = wheel(r, w, rim, tread); wh.position.set(sx * x, r, zr); g.add(wh); wheels.push(wh); }
  for (const sx of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(sx * x, r, zf); g.add(p);
    const wh = wheel(r, w, rim, tread); p.add(wh); wheels.push(wh); front.push(p);
  }
  return { wheels, front };
}
function carMirrors(g, x, y, z, mat) {
  for (const sx of [-1, 1]) {
    RB(0.08, 0.06, 0.12, 0.02, mat, sx * x, y - 0.02, z, g);
    RB(0.06, 0.16, 0.24, 0.03, mat, sx * (x + 0.13), y, z - 0.03, g);
  }
}

/**
 * Compact SUV (Dacia Duster): closed body with a glass house, roof rails, black wheel-arch cladding,
 * silver skid plates. o = look: body colour, trim, brand and model names.
 */
const SUV = { body: '#d9762b', trim: '#c4c8ca', brand: 'DACIA', model: 'DUSTER', text: '#fbf7ee', stroke: '#2a2d2f' };
export function buildSUV(o = {}) {
  const L = { ...SUV, ...o }, style = { fill: L.text, stroke: L.stroke };
  const g = new THREE.Group(), body = P(L.body), plast = F('#2a2d2f'), trim = S(L.trim), black = F(BLACK);
  RB(1.1, 0.25, 3.6, 0.05, F(), 0, 0.42, 0, g); // floor pan
  RB(1.8, 0.66, 4.3, 0.14, body, 0, 0.82, 0, g, 3);
  const bonnet = RB(1.74, 0.18, 1.45, 0.08, body, 0, 1.18, 1.38, g); bonnet.rotation.x = 0.06;
  for (const sx of [-1, 1]) B(0.6, 0.012, 0.02, F(BLACK), sx * 0.45, 1.275, 1.3, g); // bonnet creases
  // glass house, pillars, roof with rails
  mk(new THREE.BoxGeometry(1.6, 0.58, 2.1), glassMat, 0, 1.45, -0.42, g, false);
  const ws = mk(new THREE.BoxGeometry(1.52, 0.7, 0.03), glassMat, 0, 1.44, 0.82, g, false); ws.rotation.x = -0.62;
  for (const sx of [-1, 1]) {
    rod([sx * 0.79, 1.15, 1.05], [sx * 0.74, 1.75, 0.6], 0.045, body, g); // A pillar
    RB(0.07, 0.58, 0.12, 0.02, black, sx * 0.8, 1.45, -0.3, g); // B pillar
    RB(0.08, 0.58, 0.32, 0.03, body, sx * 0.79, 1.45, -1.35, g); // C pillar
    rod([sx * 0.62, 1.86, 0.45], [sx * 0.62, 1.86, -1.38], 0.02, trim, g); // roof rail
    for (const z of [0.4, -1.32]) B(0.05, 0.06, 0.08, trim, sx * 0.62, 1.83, z, g);
    for (const z of [0.85, -0.3]) B(0.012, 0.5, 0.02, F(BLACK), sx * 0.902, 0.86, z, g); // door seams
    for (const z of [0.4, -0.75]) B(0.03, 0.035, 0.16, CHROME, sx * 0.91, 1.02, z, g); // handles
    RB(0.06, 0.16, 4.0, 0.03, plast, sx * 0.9, 0.55, 0, g); // sill cladding
    for (const z of [1.33, -1.33]) fender(g, plast, sx * 0.86, 0.36, z, 0.42, Math.PI * 0.05, Math.PI * 0.95, 0.16, 0.06);
  }
  RB(1.66, 0.09, 2.25, 0.04, body, 0, 1.78, -0.4, g);
  RB(1.4, 0.06, 0.22, 0.02, body, 0, 1.76, -1.55, g); // spoiler
  // front: grille, lamps, bumper and skid plate; back: tailgate, lamps, plate, name
  B(1.0, 0.24, 0.04, black, 0, 1.0, 2.16, g);
  for (let k = 0; k < 3; k++) B(0.96, 0.02, 0.02, CHROME, 0, 0.92 + k * 0.08, 2.185, g);
  for (const sx of [-1, 1]) headlamp(g, sx * 0.64, 1.05, 2.15, 0.32, 0.11);
  RB(1.84, 0.26, 0.3, 0.08, plast, 0, 0.6, 2.06, g);
  const sk = B(0.9, 0.06, 0.32, trim, 0, 0.47, 2.12, g); sk.rotation.x = 0.4;
  decal('plate2', 0.42, 0.21, 0, 0.72, 2.215, 0, g);
  RB(1.84, 0.26, 0.28, 0.08, plast, 0, 0.6, -2.06, g);
  B(0.9, 0.06, 0.25, trim, 0, 0.47, -2.12, g);
  for (const sx of [-1, 1]) tailCluster(g, sx * 0.72, 1.06, -2.17);
  B(1.3, 0.012, 0.012, F(BLACK), 0, 1.17, -2.152, g); // tailgate seam
  decal('plate2', 0.42, 0.21, 0, 0.82, -2.172, Math.PI, g);
  textDecal(L.brand, 0.12, 0.6, 0, 1.0, -2.168, Math.PI, g, style);
  sideText(L.model, 0.1, 0.6, 0.905, 0.72, 1.55, g, style);
  carMirrors(g, 0.86, 1.3, 0.7, body);
  cabInside(g, 0.75, 0.0, 1.6, false);
  wiper(g, 0.1, 1.17, 1.05, 0.5, 0.9);
  const { wheels, front } = carWheels(g, 0.36, 0.24, '#b9bcbd', 'road', 0.79, 1.33, -1.33);
  const spot = spotAt(g, 1.05, 2.2);
  bake(g, NO_SNOW);
  return { group: g, wheels, front, rear: [], spot, scale: 1, exhaust: new THREE.Vector3(-0.5, 0.42, -2.15) };
}

/**
 * Double-cab pickup (Toyota Hilux): cab, open load bed with a roll bar, flared arches, big chrome grille.
 * o = look: body colour, brand and model names.
 */
const PICKUP = { body: '#e9e9e4', brand: 'TOYOTA', model: 'HILUX', text: '#2a2d2f', stroke: null };
export function buildPickup(o = {}) {
  const L = { ...PICKUP, ...o }, style = { fill: L.text, stroke: L.stroke };
  const g = new THREE.Group(), body = P(L.body), plast = F('#2a2d2f'), black = F(BLACK);
  RB(1.1, 0.25, 4.6, 0.05, F(), 0, 0.5, 0.15, g); // ladder frame
  RB(1.84, 0.72, 3.0, 0.14, body, 0, 0.92, 1.05, g, 3); // front and cab body
  const bonnet = RB(1.78, 0.2, 1.35, 0.08, body, 0, 1.32, 1.88, g); bonnet.rotation.x = 0.05;
  mk(new THREE.BoxGeometry(1.66, 0.6, 1.7), glassMat, 0, 1.6, 0.22, g, false);
  const ws = mk(new THREE.BoxGeometry(1.56, 0.72, 0.03), glassMat, 0, 1.6, 1.16, g, false); ws.rotation.x = -0.55;
  RB(1.72, 0.09, 1.65, 0.04, body, 0, 1.94, 0.18, g);
  for (const sx of [-1, 1]) {
    rod([sx * 0.82, 1.3, 1.38], [sx * 0.77, 1.9, 0.98], 0.05, body, g);
    RB(0.07, 0.6, 0.12, 0.02, black, sx * 0.83, 1.6, 0.3, g);
    RB(0.08, 0.6, 0.18, 0.03, body, sx * 0.82, 1.6, -0.6, g);
    for (const z of [1.25, 0.3]) B(0.012, 0.55, 0.02, F(BLACK), sx * 0.922, 0.98, z, g);
    for (const z of [0.85, -0.12]) B(0.03, 0.035, 0.16, CHROME, sx * 0.93, 1.16, z, g);
    RB(0.22, 0.05, 1.5, 0.02, plast, sx * 0.98, 0.58, 0.55, g); // side step
    for (const z of [1.65, -1.45]) fender(g, plast, sx * 0.88, 0.4, z, 0.47, Math.PI * 0.05, Math.PI * 0.95, 0.2, 0.07);
  }
  // load bed with walls, tailgate, roll bar
  RB(1.8, 0.12, 1.65, 0.03, F('#45494c'), 0, 0.98, -1.38, g);
  for (const sx of [-1, 1]) RB(0.07, 0.5, 1.65, 0.03, body, sx * 0.885, 1.25, -1.38, g);
  RB(1.84, 0.5, 0.07, 0.03, body, 0, 1.25, -0.56, g);
  RB(1.84, 0.5, 0.07, 0.03, body, 0, 1.25, -2.2, g);
  textDecal(L.brand, 0.16, 0.9, 0, 1.3, -2.24, Math.PI, g, style);
  for (const sx of [-1, 1]) rod([sx * 0.8, 1.5, -0.66], [sx * 0.8, 2.05, -0.66], 0.04, CHROME, g);
  rod([-0.8, 2.05, -0.66], [0.8, 2.05, -0.66], 0.04, CHROME, g);
  // front: chrome grille, lamps, bumper; back: lamps, bumper, plate
  RB(1.2, 0.36, 0.06, 0.03, CHROME, 0, 1.08, 2.56, g);
  for (let k = 0; k < 4; k++) B(1.1, 0.03, 0.03, F(BLACK), 0, 0.96 + k * 0.08, 2.59, g);
  for (const sx of [-1, 1]) headlamp(g, sx * 0.72, 1.18, 2.52, 0.3, 0.12);
  RB(1.9, 0.26, 0.32, 0.08, plast, 0, 0.7, 2.5, g);
  decal('plate2', 0.42, 0.21, 0, 0.72, 2.665, 0, g);
  RB(1.9, 0.2, 0.24, 0.06, CHROME, 0, 0.72, -2.32, g);
  for (const sx of [-1, 1]) tailCluster(g, sx * 0.86, 1.25, -2.24);
  decal('plate2', 0.42, 0.21, 0, 0.92, -2.245, Math.PI, g);
  sideText(L.model, 0.12, 0.7, 0.925, 0.82, 1.9, g, style);
  carMirrors(g, 0.9, 1.42, 1.0, body);
  cabInside(g, 0.95, 0.45, 1.6, false);
  wiper(g, 0.1, 1.33, 1.42, 0.55, 0.9);
  const { wheels, front } = carWheels(g, 0.4, 0.27, '#3a3f42', 'lug', 0.82, 1.65, -1.45);
  const spot = spotAt(g, 1.2, 2.6);
  bake(g, NO_SNOW);
  return { group: g, wheels, front, rear: [], spot, scale: 1, exhaust: new THREE.Vector3(-0.55, 0.45, -2.35) };
}

/**
 * Tractor. o = the model's look (catalog.js): body, dark, rim, roof and frame colours, scale (size against
 * the 140 hp Brázda), weights (front weights), duals (dual rear wheels), brand and model names with their
 * text colours, stripe. Everything sits in an inner group scaled by o.scale; the outer group carries the
 * implement on the hitch, so implements keep their size.
 */
const TRACTOR = { body: '#5f9c7c', dark: '#4b8467', rim: '#efe2b8', roof: null, frame: '#3a3f42', scale: 1, weights: true, duals: false, brand: 'BRÁZDA', model: '140', text: '#f4ecd2', stroke: '#24312a', stripe: true };
export function buildTractor(o = {}) {
  const L = { ...TRACTOR, ...o }, sc = L.scale;
  const root = new THREE.Group(), g = new THREE.Group(); g.scale.setScalar(sc); root.add(g);
  const body = P(L.body), bodyDk = P(L.dark), cream = L.rim, frame = F(L.frame), black = F(BLACK), style = { fill: L.text, stroke: L.stroke };
  // --- chassis: engine and sump, gearbox, rear axle trumpets, oil filter and alternator
  RB(0.84, 0.48, 2.5, 0.08, frame, 0, 0.84, 0.95, g);
  RB(0.98, 0.74, 1.4, 0.1, frame, 0, 0.94, -0.72, g);
  for (const sx of [-1, 1]) CY(0.16, 0.24, 0.52, 16, frame, sx * 0.6, 0.86, -0.7, g).rotation.z = -sx * Math.PI / 2;
  CY(0.08, 0.08, 0.2, 10, P('#d9d2bd'), 0.47, 0.98, 1.35, g).rotation.z = Math.PI / 2;
  CY(0.12, 0.12, 0.06, 14, black, 0.18, 1.0, 2.24, g).rotation.x = Math.PI / 2;
  CY(0.07, 0.07, 0.06, 10, black, -0.2, 1.08, 2.24, g).rotation.x = Math.PI / 2;
  // --- front axle on its pivot with the steering ram
  RB(1.3, 0.17, 0.22, 0.05, frame, 0, 0.52, 1.55, g);
  CY(0.1, 0.1, 0.3, 10, frame, 0, 0.62, 1.55, g).rotation.x = Math.PI / 2;
  ram([-0.5, 0.58, 1.38], [0.42, 0.58, 1.36], 0.04, frame, g);
  // --- bonnet: sloping nose, grille between upright lamps, vents, name and stripe
  profile([[0.3, 1.1], [2.2, 1.1], [2.26, 1.45], [2.22, 1.75], [2.1, 1.92], [1.8, 1.99], [0.3, 2.03]], 1.0, 0.08, body, 0, g);
  B(0.48, 0.58, 0.02, F('#1a1c1d'), 0, 1.4, 2.335, g);
  decal('grid', 0.46, 0.56, 0, 1.4, 2.348, 0, g);
  for (const sx of [-1, 1]) headlamp(g, sx * 0.34, 1.42, 2.32, 0.12, 0.42);
  if (L.brand === 'BRÁZDA') decal('logo', 0.16, 0.16, 0, 1.76, 2.3, 0, g, 0.25);
  sideDecals('vent', 0.5, 0.42, 0.5, 1.48, 1.9, g);
  sideText(L.brand, 0.24, 1.3, 0.5, 1.8, 1.05, g, style);
  sideText(L.model, 0.19, 0.9, 0.5, 1.5, 1.35, g, style);
  if (L.stripe) sideDecals('stripe', 1.7, 0.22, 0.5, 1.2, 1.2, g);
  // --- front weights on the bracket (or just the bracket), tow pin
  RB(0.72, 0.42, 0.3, 0.05, frame, 0, 0.94, 2.38, g);
  if (L.weights) {
    for (let k = 0; k < 8; k++) {
      const x = -0.45 + k * 0.128;
      RB(0.1, 0.52, 0.46, 0.03, F(k % 2 ? '#3a3e41' : '#2f3336'), x, 0.92, 2.72, g);
      rod([x, 1.2, 2.6], [x, 1.2, 2.84], 0.018, F('#34383b'), g);
    }
    RB(1.04, 0.08, 0.5, 0.03, frame, 0, 1.22, 2.72, g);
  }
  CY(0.05, 0.05, 0.3, 8, S(), 0, 0.68, 2.6, g);
  // --- cab on its sill, with roof, wipers, mirrors and interior
  RB(1.86, 0.18, 1.86, 0.06, body, 0, 1.69, -0.55, g);
  cab(g, { y: 1.78, z: -0.55, w: 1.72, h: 1.45, d: 1.72, roof: L.roof ? P(L.roof) : body, lights: 4 });
  wiper(g, 0, 1.92, -1.42, 0.7, -0.4, Math.PI);
  beacon(g, 0.62, 3.47, -0.95, beaconMat);
  rod([-0.7, 3.46, -1.2], [-0.7, 4.15, -1.28], 0.008, black, g); // radio antenna
  rod([0.9, 1.9, 0.2], [0.9, 3.0, 0.2], 0.022, black, g); // grab handle by the door
  steps(g, 1.05, 0.62, 1.42, 0.5, 3);
  // --- exhaust up the right front post with a perforated heat shield, air intake on the left
  rod([-0.6, 1.25, 0.42], [-0.95, 1.6, 0.42], 0.06, black, g);
  CY(0.065, 0.065, 1.95, 10, black, -0.95, 2.55, 0.42, g);
  CY(0.1, 0.1, 0.85, 14, S('#aeb4b7'), -0.95, 2.35, 0.42, g);
  for (let k = 0; k < 5; k++) CY(0.102, 0.102, 0.03, 14, F('#5d6366'), -0.95, 2.0 + k * 0.18, 0.42, g);
  rod([-0.95, 3.5, 0.42], [-0.95, 3.66, 0.5], 0.06, black, g);
  CY(0.11, 0.08, 0.6, 12, body, 0.95, 2.45, 0.5, g);
  CY(0.14, 0.11, 0.18, 12, S(), 0.95, 2.86, 0.5, g);
  // --- fuel tank and AdBlue tank on the right, battery box on the left
  RB(0.36, 0.52, 0.7, 0.12, body, -0.68, 1.05, 0.55, g);
  CY(0.07, 0.07, 0.06, 12, black, -0.68, 1.33, 0.75, g);
  decal('fill', 0.2, 0.05, -0.862, 1.12, 0.55, -Math.PI / 2, g);
  RB(0.24, 0.2, 0.26, 0.06, P('#e9ecef'), -0.68, 1.42, 0.42, g); // AdBlue
  CY(0.045, 0.045, 0.05, 10, P('#2b5fb5'), -0.68, 1.54, 0.42, g);
  // --- rear mudguards with lamp clusters and work lights
  for (const sx of [-1, 1]) {
    fender(g, body, sx * 1.0, 0.86, -0.7, 0.96, Math.PI * 0.14, Math.PI * 0.97, 0.74, 0.07);
    rod([sx * 0.62, 1.5, -0.7], [sx * 0.66, 1.77, -0.7], 0.035, frame, g); // stay to the cab
    tailCluster(g, sx * 1.12, 1.18, -1.72);
    workLight(g, sx * 1.12, 1.98, -1.0, Math.PI, 0.3);
    decal('warnR', 0.22, 0.12, sx * 1.12, 0.98, -1.73, Math.PI, g);
  }
  // --- rear: lift arms with rams, lower links, top link, PTO, pick-up hitch, remote valves with hoses, plate
  RB(0.92, 0.5, 0.32, 0.05, frame, 0, 0.98, -1.48, g);
  for (const sx of [-1, 1]) {
    rod([sx * 0.3, 0.62, -1.45], [sx * 0.42, 0.55, -2.15], 0.05, frame, g);
    mk(new THREE.TorusGeometry(0.06, 0.02, 6, 12), S(), sx * 0.42, 0.55, -2.17, g).rotation.y = Math.PI / 2;
    rod([sx * 0.28, 1.3, -1.45], [sx * 0.32, 1.25, -1.95], 0.045, frame, g);
    rod([sx * 0.32, 1.25, -1.95], [sx * 0.38, 0.62, -1.9], 0.03, frame, g);
    ram([sx * 0.38, 0.72, -1.32], [sx * 0.31, 1.24, -1.84], 0.05, frame, g);
  }
  ram([0, 1.34, -1.52], [0, 1.08, -2.12], 0.04, frame, g);
  CY(0.05, 0.05, 0.22, 10, S(), 0, 0.8, -1.72, g).rotation.x = Math.PI / 2;
  mk(new THREE.CylinderGeometry(0.17, 0.17, 0.26, 12, 1, true, -Math.PI / 2, Math.PI), black, 0, 0.8, -1.7, g).rotation.x = Math.PI / 2;
  RB(0.2, 0.1, 0.4, 0.03, frame, 0, 0.5, -1.72, g);
  mk(new THREE.TorusGeometry(0.07, 0.025, 6, 12, Math.PI * 1.2), S(), 0, 0.56, -1.9, g).rotation.y = Math.PI / 2;
  RB(0.5, 0.16, 0.12, 0.03, frame, -0.36, 1.42, -1.66, g);
  const caps = ['#c4473a', '#2b5fb5', '#e8b84a', '#3f8f4a'];
  caps.forEach((c, k) => {
    const x = -0.53 + k * 0.115;
    CY(0.032, 0.032, 0.12, 8, S(), x, 1.42, -1.77, g).rotation.x = Math.PI / 2;
    CY(0.042, 0.042, 0.05, 8, P(c), x, 1.42, -1.84, g).rotation.x = Math.PI / 2;
  });
  B(0.46, 0.25, 0.03, black, 0, 1.68, -1.505, g);
  decal('plate', 0.42, 0.21, 0, 1.68, -1.524, Math.PI, g);
  // --- wheels: big rear, steering front with mudguards and hub reduction
  const wheels = [], front = [];
  for (const sx of [-1, 1]) for (const k of L.duals ? [1, 1.64] : [1]) { const w = wheel(0.86, 0.6, cream, 'lug'); w.position.set(sx * k, 0.86, -0.7); g.add(w); wheels.push(w); }
  for (const sx of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(sx * 0.84, 0.52, 1.55); g.add(p);
    const w = wheel(0.52, 0.42, cream, 'lug'); p.add(w); wheels.push(w); front.push(p);
    CY(0.17, 0.14, 0.16, 12, frame, -sx * 0.27, 0, 0, p).rotation.z = Math.PI / 2;
    fender(p, body, 0, 0, 0, 0.62, Math.PI * 0.18, Math.PI * 0.82, 0.48, 0.05); // steers with the wheel
    rod([-sx * 0.2, 0.1, 0], [-sx * 0.12, 0.6, 0], 0.025, frame, p);
  }
  const spot = spotAt(g, 1.45 * sc, 2.35 * sc);
  bake(root, NO_SNOW);
  for (const w of wheels) w.userData.r *= sc; // spin with the scaled radius
  return { group: root, wheels, front, rear: [], spot, exhaust: new THREE.Vector3(-0.95, 3.7, 0.52).multiplyScalar(sc), scale: sc };
}

/** Hoses from an implement's headstock up towards the tractor's remote valves (implement-local). */
function implHoses(lift, n = 2, y0 = 0.9, z0 = -0.45) {
  for (let k = 0; k < n; k++) {
    const x = -0.15 + k * 0.1;
    hose([[x, y0, z0], [x + 0.05, y0 + 0.35, z0 + 0.15], [x - 0.12, 1.3, 0.0], [-0.5 + k * 0.115, 1.42, 0.05]], 0.022, lift);
  }
}

/** Brand name on an implement: a decal facing back (or forward) at the given place. */
function brandOn(L, h, maxW, x, y, z, ry, p) {
  if (L.brand) textDecal(L.brand, h, maxW, x, y, z, ry, p, { fill: L.text || '#fbf7ee', stroke: L.stroke === undefined ? '#24312a' : L.stroke });
}

/** Cultivator. o = look: color, frame, width (m: beams, tines and roller follow it), brand. */
export function buildCultivator(o = {}) {
  const L = { color: '#e0a640', frame: '#3a3f42', width: 4.2, brand: null, ...o }, W = L.width, hw = W / 2;
  const g = new THREE.Group(), lift = new THREE.Group(); g.add(lift);
  const y = P(L.color), frame = F(L.frame);
  RB(0.24, 0.24, 1.0, 0.04, y, 0, 0.72, -0.4, lift);
  RB(W, 0.22, 0.25, 0.05, y, 0, 0.85, -0.95, lift);
  RB(W, 0.22, 0.25, 0.05, y, 0, 0.85, -1.75, lift);
  for (const sx of [-1, 1]) {
    RB(0.18, 0.2, 1.1, 0.04, y, sx * (hw - 0.1), 0.85, -1.35, lift);
    decal('warn', 0.5, 0.16, sx * (hw - 0.3), 0.85, -1.877, Math.PI, lift);
    tailCluster(lift, sx * (hw - 0.15), 1.08, -1.9);
  }
  brandOn(L, 0.16, Math.max(0.6, W - 1.6), 0, 0.85, -1.878, Math.PI, lift);
  RB(1.6, 0.2, 0.2, 0.04, y, 0, 0.85, -0.55, lift);
  // headstock A-frame with pins
  for (const sx of [-1, 1]) {
    rod([sx * 0.42, 0.55, -0.15], [sx * 0.7, 0.85, -0.95], 0.05, y, lift);
    CY(0.035, 0.035, 0.2, 8, S(), sx * 0.42, 0.55, -0.15, lift).rotation.z = Math.PI / 2;
  }
  rod([0, 1.35, -0.2], [0, 0.95, -0.95], 0.05, y, lift);
  implHoses(lift, 2, 0.95, -0.6);
  // spring tines: spring coil on the beam, shank down, steel point bent forward
  const n = Math.max(5, Math.round(W / 0.46));
  for (let i = 0; i < n; i++) {
    const x = -hw + 0.26 + (i * (W - 0.52)) / (n - 1), z = i % 2 ? -0.95 : -1.75;
    mk(new THREE.TorusGeometry(0.07, 0.022, 6, 12), frame, x, 0.66, z, lift).rotation.y = Math.PI / 2;
    mk(new THREE.TorusGeometry(0.07, 0.022, 6, 12), frame, x + 0.05, 0.66, z, lift).rotation.y = Math.PI / 2;
    B(0.07, 0.62, 0.07, frame, x, 0.36, z - 0.06, lift).rotation.x = 0.18;
    B(0.08, 0.06, 0.3, S(), x, 0.06, z + 0.04, lift).rotation.x = -0.35;
  }
  // cage roller (turns with the ground)
  const roller = new THREE.Group(); roller.position.set(0, 0.32, -2.4); lift.add(roller);
  const rings = Math.max(3, Math.round(W) + 1);
  for (let k = 0; k < rings; k++) mk(new THREE.TorusGeometry(0.29, 0.025, 6, 20), F('#6a6f72'), -hw + 0.1 + (k * (W - 0.2)) / (rings - 1), 0, 0, roller).rotation.y = Math.PI / 2;
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; B(W - 0.15, 0.05, 0.05, F('#6a6f72'), 0, Math.cos(a) * 0.29, Math.sin(a) * 0.29, roller); }
  CY(0.05, 0.05, W - 0.1, 8, frame, 0, 0, 0, roller).rotation.z = Math.PI / 2;
  for (const sx of [-1, 1]) RB(0.12, 0.12, 0.8, 0.03, y, sx * (hw - 0.1), 0.6, -2.05, lift);
  bake(g, NO_SNOW);
  return { group: g, lift, roller, up: 0.45, down: -0.2 };
}

/** Seed drill. o = look: body, light, frame, width (m: hopper, coulters, markers and wheels follow it), brand. */
export function buildSeeder(o = {}) {
  const L = { body: '#4f78a8', light: '#6f97c4', frame: '#3a3f42', width: 4.0, brand: null, ...o }, W = L.width, hw = W / 2;
  const g = new THREE.Group(), lift = new THREE.Group(); g.add(lift);
  const blue = P(L.body), blueLt = P(L.light), frame = F(L.frame);
  RB(0.24, 0.24, 1.0, 0.04, frame, 0, 0.72, -0.4, lift);
  RB(W, 0.2, 0.25, 0.04, frame, 0, 0.75, -0.9, lift);
  RB(W - 0.2, 0.95, 1.05, 0.08, blue, 0, 1.5, -1.15, lift, 3);
  RB(W - 0.08, 0.12, 1.16, 0.04, blueLt, 0, 2.03, -1.15, lift);
  const lids = Math.max(2, Math.round(W / 1.3));
  for (let k = 0; k < lids; k++) RB(0.3, 0.05, 0.06, 0.02, F(BLACK), (k - (lids - 1) / 2) * ((W - 0.8) / Math.max(1, lids - 1)), 2.06, -0.55, lift); // lid handles
  for (let k = 0; k <= lids; k++) B(0.06, 0.9, 0.04, blueLt, -hw + 0.4 + (k * (W - 0.8)) / lids, 1.5, -0.62, lift); // ribs
  decal('level', 0.5, 0.12, hw * 0.6, 1.75, -0.6, 0, lift);
  brandOn(L, 0.22, W * 0.6, 0, 1.55, -1.678, Math.PI, lift);
  for (const sx of [-1, 1]) RB(0.12, 0.8, 0.12, 0.03, frame, sx * (hw - 0.3), 0.95, -1.15, lift);
  RB(W, 0.16, 0.2, 0.04, frame, 0, 0.55, -1.6, lift);
  for (const sx of [-1, 1]) { decal('warn', 0.45, 0.14, sx * (hw - 0.25), 0.55, -1.702, Math.PI, lift); tailCluster(lift, sx * (hw - 0.3), 1.25, -1.72); }
  // seed tubes from the metering box down to the coulters, press wheels behind
  const n = Math.max(6, Math.round(W / 0.333));
  for (let i = 0; i < n; i++) {
    const x = -hw + 0.17 + (i * (W - 0.34)) / (n - 1);
    hose([[x * 0.9, 1.02, -1.2], [x * 0.95, 0.7, -1.45], [x, 0.42, -1.6]], 0.022, lift, M('#8a9196', { roughness: 0.5, flatShading: false }));
    CY(0.22, 0.22, 0.05, 14, S('#8d9396'), x, 0.28, -1.65, lift).rotation.z = Math.PI / 2;
    CY(0.1, 0.1, 0.06, 10, RUBBER, x, 0.1, -1.95, lift).rotation.z = Math.PI / 2;
    rod([x, 0.45, -1.65], [x, 0.12, -1.95], 0.015, frame, lift);
  }
  // folded bout markers and the loading step
  for (const sx of [-1, 1]) {
    rod([sx * (hw - 0.05), 1.1, -1.1], [sx * (hw + 0.05), 2.4, -1.1], 0.04, frame, lift);
    CY(0.18, 0.18, 0.04, 12, S('#8d9396'), sx * (hw + 0.05), 2.45, -1.1, lift).rotation.z = Math.PI / 2;
  }
  B(1.4, 0.05, 0.35, F(), 0, 0.98, -0.45, lift);
  decal('tread', 1.36, 0.32, 0, 1.006, -0.45, 0, lift, Math.PI / 2);
  implHoses(lift, 2, 1.0, -0.5);
  const wheels = [];
  for (const sx of [-1, 1]) { const w = wheel(0.36, 0.22, '#d7dde2'); w.position.set(sx * (hw + 0.15), 0.36, -0.95); lift.add(w); wheels.push(w); }
  bake(g, NO_SNOW);
  return { group: g, lift, wheels, up: 0.4, down: -0.05 };
}

/** Bale places of a trailer body len metres long: two layers along it. */
export const trailerBales = len => Math.max(2, Math.floor((len - 0.4) / 1.3)) * 2;

/**
 * Grain trailer with a tipping body. o = look: body, rib, trim colours, len (body length), height
 * (walls), axles (1–3), brand. Origin = centre of the axles on the ground; +z points to the
 * drawbar eye (returned as drawbar), which sits on the tractor hitch. The body is hinged at z = −2.
 */
export function buildTrailer(o = {}) {
  const L = { body: '#c8794a', rib: '#b06a40', trim: '#e8a46f', len: 5.6, height: 1.3, axles: 2, brand: null, ...o };
  const Lb = L.len, Hb = L.height, eye = -2 + Lb + 1.6; // the eye well ahead of the body: room to turn behind the tractor's wheels
  const g = new THREE.Group(), body = P(L.body), rib = P(L.rib), trim = P(L.trim), frame = F();
  const z0 = -2.1, z1 = -2 + Lb + 0.1;
  RB(1.0, 0.25, z1 - z0, 0.04, frame, 0, 0.72, (z0 + z1) / 2, g);
  for (let z = -1.6; z < z1 - 0.3; z += 1.5) RB(2.0, 0.12, 0.14, 0.03, frame, 0, 0.84, z, g);
  // A-frame drawbar, eye, parking leg with crank, hoses and brake lines to the tractor
  for (const sx of [-1, 1]) rod([sx * 0.48, 0.72, z1 - 0.3], [0, 0.66, eye - 0.1], 0.06, frame, g);
  RB(0.2, 0.2, eye - z1, 0.04, frame, 0, 0.66, (eye + z1) / 2 - 0.1, g);
  mk(new THREE.TorusGeometry(0.1, 0.035, 6, 14), S(), 0, 0.62, eye, g).rotation.x = Math.PI / 2;
  rod([0.25, 0.7, eye - 0.8], [0.25, 0.08, eye - 0.8], 0.05, F('#56595b'), g);
  B(0.24, 0.04, 0.24, F('#56595b'), 0.25, 0.04, eye - 0.8, g);
  rod([0.25, 0.75, eye - 0.8], [0.4, 0.78, eye - 0.8], 0.015, S(), g);
  hose([[0.15, 0.78, eye - 1.0], [0.18, 0.95, eye - 0.5], [-0.1, 1.15, eye - 0.15], [-0.3, 1.42, eye + 0.1]], 0.025, g);
  hose([[-0.12, 0.78, eye - 1.0], [-0.15, 0.92, eye - 0.5], [-0.2, 1.1, eye - 0.15], [-0.42, 1.38, eye + 0.1]], 0.02, g, P('#c4473a'));
  hose([[-0.18, 0.78, eye - 1.0], [-0.22, 0.9, eye - 0.5], [-0.25, 1.08, eye - 0.15], [-0.5, 1.36, eye + 0.1]], 0.02, g, P('#e8b84a'));
  // tipping ram at the front of the chassis
  CY(0.12, 0.12, 0.7, 12, frame, 0, 1.2, z1 + 0.05, g); CY(0.08, 0.08, 0.2, 10, CHROME, 0, 1.62, z1 + 0.05, g);
  const wheels = [], axz = L.axles === 1 ? [0] : L.axles === 3 ? [-1.24, 0, 1.24] : [-0.62, 0.62], span = axz[axz.length - 1] - axz[0];
  for (const sx of [-1, 1]) {
    for (const sz of axz) { const w = wheel(0.55, 0.4, '#d7dde2'); w.position.set(sx * 1.15, 0.55, sz); g.add(w); wheels.push(w); }
    // leaf springs along the axles, mud flaps behind and in front of the wheels
    for (let k = 0; k < 4; k++) RB(0.12, 0.035, span + 0.9 - k * 0.25, 0.01, F('#46494b'), sx * 0.75, 0.62 - k * 0.04, 0, g);
    for (const sz of [axz[0] - 0.63, axz[axz.length - 1] + 0.63]) B(0.5, 0.3, 0.02, RUBBER, sx * 1.15, 1.02, sz, g);
    tailCluster(g, sx * 0.95, 0.86, -2.14);
    decal('warnR', 0.4, 0.14, sx * 0.95, 0.66, -2.13, Math.PI, g);
  }
  decal('plate2', 0.42, 0.21, 0, 0.82, -2.14, Math.PI, g);
  // tipping body hinged at the rear edge
  const tip = new THREE.Group(); tip.position.set(0, 0.95, -2.0); g.add(tip);
  const zc = Lb / 2, wy = 0.06 + Hb / 2;
  RB(2.4, 0.12, Lb, 0.03, body, 0, 0.06, zc, tip);
  for (const sx of [-1, 1]) {
    B(0.1, Hb, Lb, body, sx * 1.2, wy, zc, tip);
    RB(0.14, 0.14, Lb + 0.06, 0.04, trim, sx * 1.22, Hb, zc, tip);
    for (let z = 0.25; z < Lb - 0.1; z += 0.72) RB(0.07, Hb - 0.1, 0.1, 0.02, rib, sx * 1.27, wy, z, tip);
    RB(0.07, 0.1, Lb - 0.1, 0.02, rib, sx * 1.27, 0.2, zc, tip);
  }
  brandOn(L, 0.28, Lb * 0.5, 1.31, Hb * 0.62, zc, Math.PI / 2, tip);
  brandOn(L, 0.28, Lb * 0.5, -1.31, Hb * 0.62, zc, -Math.PI / 2, tip);
  B(2.4, Hb, 0.1, body, 0, wy, Lb - 0.05, tip);
  B(2.4, Hb, 0.1, body, 0, wy, 0.05, tip);
  RB(2.5, 0.14, 0.16, 0.04, trim, 0, Hb, Lb - 0.05, tip);
  for (const x of [-0.8, 0, 0.8]) RB(0.08, Hb - 0.1, 0.06, 0.02, rib, x, wy, -0.02, tip); // tailgate ribs
  for (const sx of [-1, 1]) {
    CY(0.07, 0.07, 0.18, 10, frame, sx * 1.05, Hb + 0.05, 0.0, tip).rotation.z = Math.PI / 2; // tailgate hinges
    rod([sx * 1.1, 0.15, -0.06], [sx * 1.1, 0.5, -0.08], 0.03, frame, tip); // tailgate locks
  }
  for (let k = 0; k * 0.28 < Hb - 0.2; k++) B(0.36, 0.04, 0.06, frame, -0.7, 0.3 + k * 0.28, Lb + 0.03, tip); // ladder
  for (const sx of [-0.88, -0.52]) B(0.04, Hb - 0.2, 0.04, frame, sx, wy + 0.02, Lb + 0.03, tip);
  const grainMat = new THREE.MeshStandardMaterial({ color: col('#e4bc52'), roughness: 1, flatShading: true });
  const gg = new THREE.BoxGeometry(2.25, 1, Lb - 0.2); gg.translate(0, 0.5, 0);
  const grain = mk(gg, grainMat, 0, 0.12, zc, tip);
  grain.userData.noBake = true; grain.visible = false;
  // round bales, lying lengthwise in two layers; shown by count
  const baleMeshes = [], cols = trailerBales(Lb) / 2;
  for (let layer = 0; layer < 2; layer++) {
    for (let j = 0; j < cols; j++) {
      const m = mk(baleGeo(), M('#e2c77d'), 0, 0.87 + layer * 1.45, zc + (j - (cols - 1) / 2) * 1.3, tip);
      m.rotation.x = Math.PI / 2; m.userData.noBake = true; m.visible = false;
      baleMeshes.push(m);
    }
  }
  bake(g, NO_SNOW);
  return { group: g, tip, grain, grainMat, wheels, baleMeshes, drawbar: eye, bodyLen: Lb, grainH: Hb * 0.88 };
}

/**
 * Combine. o = look: body, bodyLt, light, frame and rim colours, scale (size against the Klas 7), header
 * (cutting width in m: the headers are stretched to it), brand and model names with text colours.
 */
const COMBINE = { body: '#cf5a4a', bodyLt: '#dc6a58', light: '#ebe4d2', frame: '#3a3f42', rim: '#ebe4d2', scale: 1, header: 5.4, brand: 'KLAS', model: '7', text: '#fbf7ee', stroke: '#5a1f17' };
export function buildCombine(o = {}) {
  const L = { ...COMBINE, ...o }, sc = L.scale, style = { fill: L.text, stroke: L.stroke };
  const root = new THREE.Group(), g = new THREE.Group(); g.scale.setScalar(sc); root.add(g);
  const red = P(L.body), redLt = P(L.bodyLt), light = P(L.light), frame = F(L.frame), black = F(BLACK);
  const kx = L.header / (5.4 * sc), pipeLen = Math.max(4.6, (L.header / 2 + 1.6) / sc - 1.05);
  // --- chassis and body with panel seams, doors, vents, name and stripe
  RB(2.0, 0.7, 4.6, 0.08, frame, 0, 0.95, -0.4, g);
  RB(2.5, 2.2, 5.4, 0.16, red, 0, 2.3, -0.5, g, 3);
  RB(2.54, 0.14, 5.44, 0.05, light, 0, 1.25, -0.5, g);
  for (const sx of [-1, 1]) {
    for (const z of [-2.65, -1.55, -0.2, 1.0]) B(0.012, 1.85, 0.025, black, sx * 1.251, 2.33, z, g);
    B(0.012, 0.025, 4.9, black, sx * 1.251, 3.26, -0.5, g);
    for (const z of [-2.1, -0.85, 0.4]) B(0.03, 0.05, 0.22, CHROME, sx * 1.262, 2.3, z, g);
    for (const z of [-2.62, -1.52, -0.17]) for (const yy of [1.7, 2.9]) CY(0.025, 0.025, 0.12, 8, black, sx * 1.262, yy, z + 0.06, g);
  }
  sideText(L.brand, 0.42, 2.6, 1.25, 2.78, -0.35, g, style);
  sideText(L.model, 0.3, 1.6, 1.25, 2.38, -0.35, g, style);
  sideDecals('stripeR', 4.9, 0.2, 1.25, 1.5, -0.5, g);
  sideDecals('vent', 1.0, 0.85, 1.25, 2.35, -2.55, g);
  decal('fill', 0.24, 0.06, -1.264, 1.75, -1.1, -Math.PI / 2, g);
  // --- engine deck: housing, rotary radiator screen, intake, exhaust with silencer
  RB(2.3, 0.95, 1.3, 0.1, red, 0, 3.85, -2.55, g);
  B(1.6, 0.06, 0.9, F('#1a1c1d'), 0, 4.35, -2.55, g);
  decal('grid', 1.5, 0.82, 0, 4.384, -2.55, 0, g, Math.PI / 2);
  CY(0.46, 0.46, 0.1, 24, F('#45494c'), -1.17, 3.85, -2.55, g).rotation.z = Math.PI / 2;
  mk(new THREE.TorusGeometry(0.46, 0.03, 6, 24), light, -1.22, 3.85, -2.55, g).rotation.y = Math.PI / 2;
  CY(0.14, 0.14, 0.16, 12, light, -1.2, 3.85, -2.55, g).rotation.z = Math.PI / 2;
  for (let k = 0; k < 4; k++) B(0.03, 0.84, 0.05, black, -1.235, 3.85, -2.55, g).rotation.x = (k * Math.PI) / 4;
  CY(0.18, 0.18, 0.4, 14, frame, 0.6, 4.5, -2.85, g); CY(0.24, 0.2, 0.12, 14, S(), 0.6, 4.75, -2.85, g);
  CY(0.09, 0.09, 1.2, 10, black, -0.8, 4.85, -2.7, g);
  CY(0.16, 0.16, 0.6, 14, S('#aeb4b7'), -0.8, 4.75, -2.7, g);
  CY(0.12, 0.09, 0.12, 10, black, -0.8, 5.45, -2.7, g);
  // --- grain tank with flared extensions, rim, level window
  RB(2.35, 0.8, 2.6, 0.08, redLt, 0, 3.8, -0.9, g);
  for (const sx of [-1, 1]) B(0.06, 0.45, 2.6, redLt, sx * 1.27, 4.4, -0.9, g).rotation.z = -sx * 0.3;
  for (const sz of [-1, 1]) B(2.6, 0.45, 0.06, redLt, 0, 4.4, -0.9 + sz * 1.37, g).rotation.x = sz * 0.3;
  for (const sx of [-1, 1]) RB(0.07, 0.07, 2.84, 0.02, light, sx * 1.34, 4.62, -0.9, g);
  for (const sz of [-1, 1]) RB(2.74, 0.07, 0.07, 0.02, light, 0, 4.62, -0.9 + sz * 1.44, g);
  decal('level', 0.9, 0.22, 0.4, 3.9, 0.41, 0, g);
  const grainMat = new THREE.MeshStandardMaterial({ color: col('#e4bc52'), roughness: 1, flatShading: true });
  const gg = new THREE.BoxGeometry(2.15, 1, 2.4); gg.translate(0, 0.5, 0);
  const grain = mk(gg, grainMat, 0, 4.2, -0.9, g);
  grain.userData.noBake = true; grain.visible = false;
  // --- cab on the platform, beacons, front lamps on the body
  cab(g, { y: 3.4, z: 1.5, w: 1.95, h: 1.4, d: 1.5, roof: light, lights: 6, passenger: true });
  beacon(g, 0.8, 5.06, 0.95, beaconMat); beacon(g, -0.8, 5.06, 0.95, beaconMat);
  for (const sx of [-1, 1]) headlamp(g, sx * 0.95, 3.05, 2.22, 0.34, 0.16);
  decal('logo', 0.3, 0.3, 0, 2.95, 2.215, 0, g);
  // --- platform with railing on the right and the ladder up to it
  B(0.6, 0.06, 1.6, F(), -1.5, 3.36, 1.5, g);
  decal('tread', 0.56, 1.56, -1.5, 3.394, 1.5, 0, g, Math.PI / 2);
  for (const z of [0.75, 2.25]) rod([-1.78, 3.38, z], [-1.78, 4.3, z], 0.025, black, g);
  rod([-1.78, 4.3, 0.75], [-1.78, 4.3, 2.25], 0.025, black, g);
  rod([-1.78, 3.85, 0.75], [-1.78, 3.85, 2.25], 0.02, black, g);
  steps(g, -1.7, 0.6, 3.0, 2.5, 6, 0.24, 0.45);
  rod([-1.7, 0.6, 2.75], [-1.7, 3.4, 2.75], 0.025, black, g);
  // --- feeder house with chain covers and the header lift rams
  const fh = RB(1.4, 1.0, 1.9, 0.08, red, 0, 1.35, 2.95, g); fh.rotation.x = 0.16;
  for (const sx of [-1, 1]) {
    const c = B(0.04, 0.7, 1.7, black, sx * 0.72, 1.35, 2.95, g); c.rotation.x = 0.16;
    ram([sx * 0.55, 0.75, 2.05], [sx * 0.55, 0.98, 3.55], 0.06, frame, g);
  }
  // --- rear: chopper and spreader, steering axle with rams, lamps, warning stripes, plate
  RB(1.7, 0.6, 0.8, 0.1, frame, 0, 1.55, -3.4, g).rotation.x = 0.3;
  RB(1.9, 0.08, 0.9, 0.03, red, 0, 1.92, -3.5, g).rotation.x = 0.3;
  for (const sx of [-1, 1]) {
    CY(0.36, 0.36, 0.05, 16, F('#45494c'), sx * 0.45, 1.12, -3.8, g);
    for (let k = 0; k < 4; k++) B(0.62, 0.12, 0.03, S(), sx * 0.45, 1.2, -3.8, g).rotation.y = (k * Math.PI) / 4;
    tailCluster(g, sx * 1.05, 2.7, -3.24);
    workLight(g, sx * 0.9, 3.3, -3.24, Math.PI, 0.2);
    decal('warnR', 0.5, 0.18, sx * 0.92, 2.35, -3.22, Math.PI, g);
    ram([sx * 0.25, 0.68, -2.55], [sx * 0.95, 0.66, -2.65], 0.04, frame, g);
  }
  RB(2.2, 0.2, 0.26, 0.05, frame, 0, 0.62, -2.75, g);
  decal('plate2', 0.42, 0.21, 0, 1.95, -3.22, Math.PI, g);
  const wheels = [], rear = [];
  for (const sx of [-1, 1]) {
    const w = wheel(1.05, 0.75, L.rim, 'lug'); w.position.set(sx * 1.5, 1.05, 1.25); g.add(w); wheels.push(w);
    fender(g, red, sx * 1.5, 1.05, 1.25, 1.18, Math.PI * 0.42, Math.PI * 0.97, 0.84, 0.06); // rear half of the guard, clear of the header
    CY(0.28, 0.22, 0.4, 14, frame, sx * 1.02, 1.05, 1.25, g).rotation.z = -sx * Math.PI / 2; // final drive
  }
  for (const sx of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(sx * 1.2, 0.62, -2.75); g.add(p);
    const w = wheel(0.62, 0.45, L.rim, 'lug'); p.add(w); wheels.push(w); rear.push(p);
  }
  // headers: the grain header (with a spinning reel) and the row header for corn and sunflower.
  // Both are built here; the unused one is parked in the yard by setHeader() in vehicles.js.
  const header = new THREE.Group(); header.position.set(0, 0, 3.75); g.add(header);
  const hl = new THREE.Group(); header.add(hl);
  const grainHdr = new THREE.Group(); hl.add(grainHdr); grainHdr.scale.x = kx;
  RB(5.8, 0.35, 1.4, 0.05, red, 0, 0.55, 0.3, grainHdr);
  RB(5.8, 1.1, 0.15, 0.05, red, 0, 1.0, -0.35, grainHdr);
  RB(5.84, 0.08, 0.19, 0.02, light, 0, 1.5, -0.35, grainHdr);
  for (const sx of [-1, 1]) {
    RB(0.12, 0.9, 1.5, 0.03, red, sx * 2.9, 0.85, 0.3, grainHdr);
    decal('warnR', 1.0, 0.3, sx * 2.962, 0.95, 0.25, sx * Math.PI / 2, grainHdr);
    decal('warn', 0.3, 0.6, sx * 2.9, 0.9, 1.06, 0, grainHdr);
    const d = mk(new THREE.ConeGeometry(0.22, 0.9, 4), light, sx * 2.9, 0.55, 1.25, grainHdr); d.rotation.x = Math.PI / 2;
    B(0.1, 0.06, 1.2, S(), sx * 2.7, 0.33, 0.35, grainHdr); // skid shoe
  }
  B(5.6, 0.08, 0.2, F('#56595b'), 0, 0.42, 1.0, grainHdr);
  // knife guards along the cutter bar
  for (let i = 0; i < 28; i++) mk(new THREE.ConeGeometry(0.05, 0.28, 4), S(), -2.7 + i * 0.2, 0.42, 1.18, grainHdr).rotation.x = Math.PI / 2;
  // cross auger with flighting
  CY(0.2, 0.2, 5.4, 14, F('#56595b'), 0, 0.78, -0.05, grainHdr).rotation.z = Math.PI / 2;
  for (let i = 0; i < 18; i++) {
    const x = -2.55 + i * 0.3, f = CY(0.32, 0.32, 0.03, 14, S(), x, 0.78, -0.05, grainHdr);
    f.rotation.z = Math.PI / 2; f.rotation.y = x < 0 ? 0.25 : -0.25;
  }
  const reel = new THREE.Group(); reel.position.set(0, 1.62, 0.45); grainHdr.add(reel);
  const ax = mk(new THREE.CylinderGeometry(0.07, 0.07, 5.5, 8), frame, 0, 0, 0, reel); ax.rotation.z = Math.PI / 2;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    B(5.3, 0.08, 0.08, light, 0, Math.cos(a) * 0.55, Math.sin(a) * 0.55, reel);
    for (let t = 0; t < 12; t++) B(0.025, 0.3, 0.025, F('#56595b'), -2.5 + t * 0.455, Math.cos(a) * 0.7, Math.sin(a) * 0.7, reel).rotation.x = a;
  }
  for (const sx of [-2.7, 0, 2.7]) for (let k = 0; k < 3; k++) { const s = B(0.05, 1.1, 0.05, frame, sx, 0, 0, reel); s.rotation.x = (k * Math.PI) / 3; }
  for (const sx of [-1, 1]) {
    const arm = RB(0.1, 0.1, 1.4, 0.03, red, sx * 2.75, 1.45, 0.0, grainHdr); arm.rotation.x = -0.2;
    ram([sx * 2.62, 1.0, -0.35], [sx * 2.62, 1.4, 0.2], 0.04, frame, grainHdr); // reel lift ram
    hose([[sx * 2.55, 1.0, -0.4], [sx * 2.3, 1.3, -0.5], [sx * 1.2, 1.45, -0.45], [sx * 0.4, 1.2, -0.45]], 0.022, grainHdr);
  }
  const cornHdr = buildRowHeader(red, frame, light);
  hl.add(cornHdr); cornHdr.scale.x = kx;
  // unloading pipe, folded backwards; swings out to the left (+x) when unloading
  const pipe = new THREE.Group(); pipe.position.set(1.05, 4.05, -1.9); g.add(pipe);
  const pc = mk(new THREE.CylinderGeometry(0.17, 0.17, pipeLen, 14), red, 0, 0, -pipeLen / 2, pipe); pc.rotation.x = Math.PI / 2;
  for (let z = -0.6; z > -pipeLen + 0.4; z -= 0.85) mk(new THREE.TorusGeometry(0.18, 0.025, 6, 16), light, 0, 0, z, pipe);
  CY(0.22, 0.22, 0.3, 14, frame, 0, 0, -0.1, pipe).rotation.x = Math.PI / 2;
  RB(0.36, 0.5, 0.36, 0.05, frame, 0, -0.2, -pipeLen, pipe);
  CY(0.17, 0.2, 0.25, 12, RUBBER, 0, -0.55, -pipeLen, pipe);
  const spot = spotAt(g, 4.75 * sc, 2.3 * sc);
  bake(root, NO_SNOW);
  for (const w of wheels) w.userData.r *= sc;
  return {
    group: root, wheels, front: [], rear, headerLift: hl, grainHdr, cornHdr, reel, pipe, grain, grainMat, spot, scale: sc, hdrScale: kx,
    exhaust: new THREE.Vector3(-0.8, 5.5, -2.7).multiplyScalar(sc),
    pipeTip: new THREE.Vector3(0, -0.3, -pipeLen), // pipe-local spout, for the grain stream
    pipeReach: { lx: (1.05 + pipeLen) * sc, lz: -1.9 * sc }, // vehicle-local spout position when the pipe is out
  };
}

/** Round straw bale, axis along x, sitting on the ground at y = 0. */
export function baleGeo() { return new THREE.CylinderGeometry(0.75, 0.75, 1.2, 14).rotateZ(Math.PI / 2); }

/** Row header for corn and sunflower: pointed snouts between the rows. */
function buildRowHeader(red, dark, light) {
  const g = new THREE.Group();
  RB(5.8, 0.5, 1.0, 0.05, red, 0, 0.6, -0.1, g);
  RB(5.8, 0.9, 0.15, 0.05, red, 0, 1.0, -0.55, g);
  for (let i = 0; i < 8; i++) {
    const x = -2.6 + i * (5.2 / 7);
    const sn = mk(new THREE.ConeGeometry(0.26, 1.5, 8), i % 2 ? light : red, x, 0.6, 1.1, g);
    sn.rotation.x = Math.PI / 2; sn.rotation.y = Math.PI / 4; sn.scale.set(1, 1, 0.7);
  }
  for (const sx of [-1, 1]) decal('warnR', 0.8, 0.3, sx * 2.902, 0.75, -0.1, sx * Math.PI / 2, g);
  // gathering chains between the snouts
  for (let i = 0; i < 7; i++) B(0.06, 0.05, 1.1, F('#56595b'), -2.23 + i * (5.2 / 7), 0.72, 0.5, g);
  RB(5.6, 0.12, 0.3, 0.03, dark, 0, 0.32, 0.3, g);
  return g;
}

/** Mouldboard plough on a diagonal beam. o = look: color, bottoms (number of bodies), brand. */
export function buildPlough(o = {}) {
  const L = { color: '#bf4a3f', bottoms: 5, brand: null, ...o }, n = L.bottoms;
  const g = new THREE.Group(), lift = new THREE.Group(); g.add(lift);
  const red = P(L.color), frame = F(), steel = S('#c9cfd2');
  const bx = i => -0.55 + i * 0.3125, bz = i => -0.6 - i * 0.75, xe = bx(n - 1) + 0.15, ze = bz(n - 1) - 0.4;
  RB(0.9, 0.5, 0.4, 0.06, red, 0, 0.8, -0.25, lift);
  const beamLen = Math.hypot(xe + 0.65, ze + 0.3);
  const beam = RB(0.22, 0.22, beamLen, 0.04, red, (xe - 0.65) / 2, 0.85, (ze - 0.3) / 2, lift); beam.rotation.y = Math.atan2(xe + 0.65, ze + 0.3) + Math.PI;
  brandOn(L, 0.12, 0.8, 0, 0.8, -0.043, 0, lift);
  rod([0, 1.35, -0.1], [0.3, 0.95, -0.9], 0.05, red, lift);
  ram([-0.3, 1.05, -0.3], [0.2, 1.05, -1.2], 0.045, frame, lift); // width adjustment
  implHoses(lift, 2, 1.0, -0.35);
  for (let i = 0; i < n; i++) {
    const x = bx(i), z = bz(i);
    RB(0.1, 0.65, 0.12, 0.02, frame, x, 0.5, z, lift);
    CY(0.05, 0.05, 0.3, 8, S(), x, 0.82, z, lift).rotation.z = Math.PI / 2; // shear bolt
    // twisted mouldboard in two pieces, share point and landside, skimmer in front
    const mb = B(0.55, 0.5, 0.06, steel, x + 0.12, 0.24, z - 0.02, lift); mb.rotation.y = 0.6; mb.rotation.z = 0.25;
    const tw = B(0.4, 0.42, 0.06, steel, x + 0.42, 0.3, z - 0.28, lift); tw.rotation.y = 1.0; tw.rotation.z = 0.5;
    B(0.12, 0.05, 0.4, S('#8a9196'), x - 0.05, 0.03, z + 0.15, lift).rotation.y = 0.3;
    B(0.05, 0.22, 0.7, frame, x - 0.12, 0.13, z - 0.2, lift);
    const sk = B(0.22, 0.14, 0.03, steel, x - 0.05, 0.3, z + 0.45, lift); sk.rotation.y = 0.6;
    rod([x, 0.5, z + 0.2], [x - 0.05, 0.36, z + 0.45], 0.018, frame, lift);
  }
  rod([xe, 0.85, ze + 0.2], [xe + 0.4, 0.4, ze - 0.3], 0.05, red, lift);
  decal('warn', 0.4, 0.14, xe - 0.35, 0.85, ze + 0.07, Math.PI, lift);
  tailCluster(lift, xe + 0.05, 1.1, ze + 0.1);
  const w = wheel(0.4, 0.25, '#d7dde2'); w.position.set(xe + 0.4, 0.4, ze - 0.3); lift.add(w);
  bake(g, NO_SNOW);
  return { group: g, lift, wheels: [w], up: 0.5, down: -0.25 };
}

/** Twin-disc fertiliser spreader. o = look: body (hopper), accent, hopper (size factor), brand. */
export function buildSpreader(o = {}) {
  const L = { body: '#ecebe6', accent: '#e08a3a', hopper: 1, brand: null, ...o }, hs = L.hopper, top = 1.12 + 0.85 * hs;
  const g = new THREE.Group(), lift = new THREE.Group(); g.add(lift);
  const orange = P(L.accent), white = P(L.body), frame = F();
  RB(0.24, 0.24, 1.0, 0.04, frame, 0, 0.72, -0.4, lift);
  RB(1.6, 0.15, 1.2, 0.04, orange, 0, 0.75, -1.1, lift);
  RB(2.0 * hs, 0.85 * hs, 1.5, 0.08, white, 0, 1.12 + 0.425 * hs, -1.1, lift, 3);
  RB(2.0 * hs + 0.08, 0.1, 1.58, 0.03, orange, 0, top + 0.03, -1.1, lift);
  for (let k = 0; k < 6; k++) B(0.03, 0.03, 1.4, F('#56595b'), (-0.85 + k * 0.34) * hs, top + 0.1, -1.1, lift); // sieve
  for (let k = 0; k < 4; k++) B(1.84 * hs, 0.025, 0.025, F('#56595b'), 0, top + 0.1, -1.6 + k * 0.33, lift);
  const fun = mk(new THREE.ConeGeometry(0.95, 0.7, 4), white, 0, 0.8, -1.1, lift); fun.rotation.x = Math.PI; fun.rotation.y = Math.PI / 4;
  decal('level', 0.6, 0.14, 0, 1.12 + 0.6 * hs, -1.857, Math.PI, lift);
  brandOn(L, 0.18, 1.6 * hs, 0, 1.12 + 0.3 * hs, -1.858, Math.PI, lift);
  // guard bow around the discs, rear lamps and stripes
  rod([-0.95, 0.5, -1.6], [-0.95, 0.5, -2.25], 0.035, frame, lift);
  rod([0.95, 0.5, -1.6], [0.95, 0.5, -2.25], 0.035, frame, lift);
  rod([-0.95, 0.5, -2.25], [0.95, 0.5, -2.25], 0.035, frame, lift);
  for (const sx of [-1, 1]) { tailCluster(lift, sx * 0.85 * hs, 1.3, -1.87); decal('warnR', 0.3, 0.12, sx * 0.8 * hs, 1.05, -1.856, Math.PI, lift); }
  implHoses(lift, 1, 0.95, -0.55);
  const discs = [];
  for (const sx of [-0.4, 0.4]) {
    const d = new THREE.Group(); d.position.set(sx, 0.48, -1.75); lift.add(d);
    CY(0.38, 0.38, 0.04, 18, S('#9aa1a5'), 0, 0, 0, d);
    for (let k = 0; k < 4; k++) { const v = B(0.7, 0.08, 0.04, orange, 0, 0.05, 0, d); v.rotation.y = (k * Math.PI) / 4; }
    discs.push(d);
  }
  bake(g, NO_SNOW);
  return { group: g, lift, discs, up: 0.05, down: 0 };
}

/**
 * Disc mower. o = look: color, width, brand. Up to about 4 m one unit behind the tractor; a wider
 * (butterfly) mower has a unit behind and one on each side.
 */
export function buildMower(o = {}) {
  const L = { color: '#c4473a', width: 3, brand: null, ...o }, W = L.width;
  const g = new THREE.Group(), lift = new THREE.Group(); g.add(lift);
  const red = P(L.color), frame = F();
  const unit = (x, z, w) => {
    RB(w + 0.1, 0.12, 0.6, 0.03, F('#56595b'), x, 0.12, z, lift); // cutter bar
    // discs (hidden under the guard, so they stay still and merge with the rest)
    const n = Math.max(4, Math.round(w / 0.5));
    for (let i = 0; i < n; i++) CY(0.24, 0.24, 0.08, 14, S(), x - w / 2 + 0.25 + (i * (w - 0.5)) / (n - 1), 0.22, z, lift);
    RB(w + 0.2, 0.5, 0.95, 0.08, red, x, 0.55, z - 0.05, lift, 3); // guard
    RB(w, 0.06, 0.1, 0.02, P('#e8e4da'), x, 0.81, z + 0.39, lift);
    for (let k = 0; k < Math.round(w / 0.27); k++) B(0.02, 0.3, 0.2, RUBBER, x - w / 2 + 0.05 + k * 0.27, 0.2, z + 0.43, lift); // front curtain
    for (const sx of [-1, 1]) decal('warnR', 0.5, 0.18, x + sx * (w / 2 - 0.2), 0.55, z - 0.526, Math.PI, lift);
  };
  RB(0.24, 0.24, 0.9, 0.04, frame, 0, 0.72, -0.4, lift);
  for (const sx of [-1, 1]) rod([sx * 0.42, 0.55, -0.15], [sx * 0.6, 0.8, -0.9], 0.05, frame, lift);
  if (W > 4.5) {
    const sw = (W - 2.8) / 2; // two side units, the rear one closes the gap between them
    unit(0, -1.6, 3.0);
    for (const sx of [-1, 1]) {
      unit(sx * (W / 2 - sw / 2), -0.85, sw);
      rod([sx * 0.4, 0.95, -0.6], [sx * (W / 2 - sw / 2), 0.85, -0.85], 0.06, frame, lift); // folding arm
      ram([sx * 0.3, 1.15, -0.55], [sx * (W / 4), 1.05, -0.75], 0.04, frame, lift);
    }
    brandOn(L, 0.16, 1.4, 0, 0.6, -2.176, Math.PI, lift);
  } else {
    unit(0, -1.25, W);
    brandOn(L, 0.14, 1.2, 0, 0.62, -1.776, Math.PI, lift);
  }
  RB(0.3, 0.6, 0.3, 0.05, red, 0, 0.9, -0.75, lift); // gearbox
  CY(0.06, 0.06, 0.5, 8, S(), 0, 1.0, -0.4, lift).rotation.x = Math.PI / 2; // drive shaft
  mk(new THREE.ConeGeometry(0.12, 0.5, 8, 1, true), P('#e8b84a'), 0, 1.0, -0.4, lift).rotation.x = -Math.PI / 2;
  implHoses(lift, 1, 0.9, -0.6);
  bake(g, NO_SNOW);
  return { group: g, lift, up: 0.55, down: -0.05 };
}

/** Round baler: pickup in front, bale chamber behind, single axle. o = look: body, accent, brand. */
export function buildBaler(o = {}) {
  const L = { body: '#e7dfcf', accent: '#e08a3a', brand: null, ...o };
  const g = new THREE.Group();
  const cream = P(L.body), orange = P(L.accent), frame = F();
  RB(0.22, 0.22, 1.6, 0.04, frame, 0, 0.72, -0.8, g);
  CY(0.06, 0.06, 1.3, 8, S(), 0.12, 0.9, -0.75, g).rotation.x = Math.PI / 2; // drive shaft
  mk(new THREE.CylinderGeometry(0.11, 0.11, 1.1, 10, 1, true), P('#e8b84a'), 0.12, 0.9, -0.75, g).rotation.x = Math.PI / 2;
  const ch = mk(new THREE.CylinderGeometry(0.95, 0.95, 1.7, 28), cream, 0, 1.25, -2.7, g); ch.rotation.z = Math.PI / 2;
  for (const sx of [-1, 1]) {
    RB(0.08, 1.9, 2.1, 0.03, cream, sx * 0.9, 1.25, -2.65, g);
    RB(0.1, 0.2, 2.1, 0.03, orange, sx * 0.95, 2.1, -2.65, g);
    CY(0.12, 0.12, 0.12, 10, frame, sx * 0.96, 1.25, -2.65, g).rotation.z = Math.PI / 2; // roller bearing
    CY(0.08, 0.08, 0.14, 10, frame, sx * 0.96, 2.05, -3.4, g).rotation.z = Math.PI / 2; // tailgate hinge
    ram([sx * 0.96, 0.9, -1.9], [sx * 0.96, 1.9, -3.2], 0.05, frame, g); // tailgate ram
    tailCluster(g, sx * 0.75, 0.75, -3.74);
    decal('warnR', 0.4, 0.14, sx * 0.55, 0.55, -3.71, Math.PI, g);
    mk(new THREE.TorusGeometry(0.32, 0.04, 6, 18), frame, sx * 0.97, 1.25, -2.65, g).rotation.y = Math.PI / 2; // drive chain cover
  }
  brandOn(L, 0.2, 1.4, 0.945, 1.65, -2.35, Math.PI / 2, g);
  brandOn(L, 0.2, 1.4, -0.945, 1.65, -2.35, -Math.PI / 2, g);
  RB(1.9, 0.12, 0.3, 0.03, orange, 0, 2.2, -2.65, g);
  RB(1.2, 0.35, 0.5, 0.06, orange, 0, 2.45, -1.9, g); // net wrap box
  CY(0.12, 0.12, 0.9, 12, P('#f4f4f0'), 0, 2.45, -1.75, g).rotation.z = Math.PI / 2; // net roll
  implHoses(g, 2, 0.9, -0.3);
  const wheels = [];
  for (const sx of [-1, 1]) { const w = wheel(0.42, 0.28, '#d7dde2'); w.position.set(sx * 1.15, 0.42, -2.4); g.add(w); wheels.push(w); }
  const lift = new THREE.Group(); lift.position.set(0, 0, -1.5); g.add(lift);
  RB(2.0, 0.22, 0.55, 0.04, frame, 0, 0.3, 0, lift);
  for (let i = 0; i < 9; i++) { const t = B(0.04, 0.3, 0.04, S(), -0.9 + i * 0.225, 0.18, 0.25, lift); t.rotation.x = 0.5; }
  CY(0.12, 0.12, 2.0, 12, F('#56595b'), 0, 0.5, -0.1, lift).rotation.z = Math.PI / 2; // crop roller
  for (const sx of [-1, 1]) { const gw = wheel(0.15, 0.1, '#56595b'); gw.position.set(sx * 0.95, 0.15, 0.35); gw.userData.static = gw.userData.spin.userData.static = true; lift.add(gw); } // gauge wheels (merged, they do not turn)
  bake(g, NO_SNOW);
  return { group: g, lift, wheels, up: 0.25, down: 0 };
}

/** Beet harvester. o = look: body, dark, light, rim colours, scale, rows (the lifting unit is built row by row), names. */
const BEET = { body: '#4d7c9e', dark: '#426d8b', light: '#e8e4da', rim: '#e8e4da', scale: 1, rows: 6, brand: 'BULVA', model: '6', text: '#fbf7ee', stroke: '#1d3445' };
export function buildBeetHarvester(o = {}) {
  const L = { ...BEET, ...o }, sc = L.scale, style = { fill: L.text, stroke: L.stroke };
  const root = new THREE.Group(), g = new THREE.Group(); g.scale.setScalar(sc); root.add(g);
  const blue = P(L.body), blueDk = P(L.dark), light = P(L.light), frame = F(), black = F(BLACK);
  const sp = 0.75 / sc, W = L.rows * sp + 0.3; // rows 75 cm apart in the world
  RB(2.2, 0.8, 7.0, 0.08, frame, 0, 1.0, -0.6, g);
  RB(3.0, 2.0, 4.0, 0.14, blue, 0, 2.6, -1.8, g, 3);
  for (const sx of [-1, 1]) RB(0.14, 0.16, 4.1, 0.04, light, sx * 1.5, 3.65, -1.8, g); // bunker rim
  for (const sz of [-1, 1]) RB(3.1, 0.16, 0.14, 0.04, light, 0, 3.65, -1.8 + sz * 2.0, g);
  for (const sx of [-1, 1]) for (const z of [-3.2, -2.3, -1.4, -0.5]) RB(0.06, 1.7, 0.1, 0.02, blueDk, sx * 1.52, 2.6, z, g); // bunker ribs
  sideText(L.brand, 0.4, 2.6, 1.57, 3.05, -1.85, g, style);
  sideText(L.model, 0.28, 1.6, 1.57, 2.6, -1.85, g, style);
  sideDecals('stripeR', 3.8, 0.18, 1.501, 1.75, -1.8, g);
  // engine at the back with vents, exhaust and the radiator grille on top
  RB(2.4, 1.4, 1.5, 0.12, blue, 0, 2.3, -4.5, g);
  B(1.8, 0.06, 1.0, F('#1a1c1d'), 0, 3.02, -4.5, g);
  decal('grid', 1.7, 0.92, 0, 3.054, -4.5, 0, g, Math.PI / 2);
  sideDecals('vent', 1.0, 0.8, 1.2, 2.3, -4.5, g);
  CY(0.09, 0.09, 1.3, 10, black, -0.8, 3.6, -4.6, g);
  CY(0.15, 0.15, 0.55, 14, S('#aeb4b7'), -0.8, 3.45, -4.6, g);
  decal('fill', 0.24, 0.06, -1.204, 1.95, -4.2, -Math.PI / 2, g);
  // cab on its base, beacon, ladder
  RB(2.2, 0.9, 1.8, 0.1, blue, 0, 2.1, 2.3, g);
  for (const sx of [-1, 1]) headlamp(g, sx * 0.75, 2.2, 3.21, 0.36, 0.16);
  if (L.brand === 'BULVA') decal('logo', 0.28, 0.28, 0, 2.2, 3.205, 0, g);
  cab(g, { y: 2.55, z: 2.3, w: 2.05, h: 1.5, d: 1.65, roof: light, lights: 6, passenger: true });
  beacon(g, 0.9, 4.3, 1.75, beaconMat);
  steps(g, -1.55, 0.7, 2.4, 2.65, 5, 0.24, 0.45);
  rod([-1.55, 0.7, 2.9], [-1.55, 3.6, 2.9], 0.025, black, g);
  for (const sx of [-1, 1]) {
    tailCluster(g, sx * 1.0, 2.3, -5.28);
    workLight(g, sx * 0.9, 3.1, -5.27, Math.PI, 0.2);
    decal('warnR', 0.5, 0.18, sx * 0.85, 1.85, -5.26, Math.PI, g);
  }
  decal('plate2', 0.42, 0.21, 0, 1.75, -5.255, Math.PI, g);
  // beet heap in the bunker, scaled by fill level
  const grainMat = new THREE.MeshStandardMaterial({ color: col('#d9c9a4'), roughness: 1, flatShading: true });
  const gg = new THREE.BoxGeometry(2.8, 1, 3.8); gg.translate(0, 0.5, 0);
  const grain = mk(gg, grainMat, 0, 3.55, -1.8, g);
  grain.userData.noBake = true; grain.visible = false;
  const wheels = [], rear = [];
  for (const sx of [-1, 1]) {
    const w = wheel(1.05, 0.8, L.rim, 'lug'); w.position.set(sx * 1.6, 1.05, 1.4); g.add(w); wheels.push(w);
    fender(g, blue, sx * 1.6, 1.05, 1.4, 1.18, Math.PI * 0.4, Math.PI * 0.95, 0.88, 0.06);
  }
  for (const sx of [-1, 1]) {
    const p = new THREE.Group(); p.position.set(sx * 1.6, 1.05, -3.3); g.add(p);
    const w = wheel(1.05, 0.8, L.rim, 'lug'); p.add(w); wheels.push(w); rear.push(p);
  }
  // six-row lifting unit with a topper roller
  const header = new THREE.Group(); header.position.set(0, 0, 3.7); g.add(header);
  const hl = new THREE.Group(); header.add(hl);
  RB(W, 0.6, 1.3, 0.08, blue, 0, 0.75, 0.2, hl);
  RB(W, 0.12, 0.2, 0.03, light, 0, 1.1, 0.85, hl);
  for (const sx of [-1, 1]) {
    decal('warnR', 1.0, 0.36, sx * (W / 2 + 0.002), 0.75, 0.2, sx * Math.PI / 2, hl);
    hose([[sx * 1.6, 1.05, -0.2], [sx * 1.2, 1.4, -0.5], [sx * 0.6, 1.5, -0.7], [sx * 0.3, 1.6, -1.0]], 0.025, hl);
  }
  for (let i = 0; i < L.rows; i++) {
    const x = (i - (L.rows - 1) / 2) * sp;
    RB(0.22, 0.55, 0.9, 0.04, frame, x, 0.35, 0.8, hl);
    const c = mk(new THREE.CylinderGeometry(0.22, 0.22, 0.05, 14), S('#8d9396'), x + 0.15, 0.25, 1.2, hl); c.rotation.z = Math.PI / 2;
    B(0.08, 0.06, 0.35, S(), x - 0.1, 0.1, 1.25, hl).rotation.x = -0.3; // lifting share
  }
  const reel = new THREE.Group(); reel.position.set(0, 0.55, 1.35); hl.add(reel);
  const rc = mk(new THREE.CylinderGeometry(0.22, 0.22, W - 0.2, 12), F('#6a6f72'), 0, 0, 0, reel); rc.rotation.z = Math.PI / 2;
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; B(W - 0.3, 0.06, 0.12, light, 0, Math.cos(a) * 0.25, Math.sin(a) * 0.25, reel); }
  // unloading elevator, folded back along the left side
  const pipe = new THREE.Group(); pipe.position.set(1.3, 3.7, -0.5); g.add(pipe);
  RB(0.55, 0.35, 5.0, 0.05, blue, 0, 0, -2.5, pipe);
  RB(0.6, 0.12, 4.8, 0.03, light, 0, 0.22, -2.5, pipe);
  for (let k = 0; k < 10; k++) B(0.5, 0.04, 0.06, frame, 0, 0.3, -0.3 - k * 0.48, pipe); // elevator slats
  RB(0.6, 0.5, 0.4, 0.05, frame, 0, -0.2, -5.0, pipe);
  const spot = spotAt(g, 3.95 * sc, 3.15 * sc);
  bake(root, NO_SNOW);
  for (const w of wheels) w.userData.r *= sc;
  return {
    group: root, wheels, front: [], rear, headerLift: hl, reel, pipe, grain, grainMat, spot, scale: sc,
    exhaust: new THREE.Vector3(-0.8, 4.3, -4.6).multiplyScalar(sc),
    pipeTip: new THREE.Vector3(0, -0.3, -5.0),
    pipeReach: { lx: (1.3 + 5.0) * sc, lz: -0.5 * sc },
  };
}

/**
 * Tank for water (greenhouses) or milk (dairy). o = look: body, dark, len (tank length), r (radius),
 * axles (1 or 2), brand. The tank starts just behind the hitch and grows backwards.
 */
export function buildWaterTank(o = {}) {
  const L = { body: '#7a9fb4', dark: '#5f8396', len: 3.6, r: 0.95, axles: 1, brand: null, ...o };
  const len = L.len, r = L.r, zc = -0.6 - len / 2, yc = 0.8 + r, back = zc - len / 2;
  const g = new THREE.Group(), lift = new THREE.Group(); g.add(lift);
  const blue = P(L.body), blueDk = P(L.dark), frame = F();
  RB(0.22, 0.22, 1.4, 0.04, frame, 0, 0.7, -0.6, lift);
  RB(1.2, 0.2, len - 0.2, 0.04, frame, 0, 0.75, zc, lift);
  const t = mk(new THREE.CylinderGeometry(r, r, len, 32), blue, 0, yc, zc, lift); t.rotation.x = Math.PI / 2;
  const bands = Math.max(2, Math.round(len / 1.3));
  for (let k = 0; k <= bands; k++) mk(new THREE.TorusGeometry(r + 0.01, 0.04, 6, 32), blueDk, 0, yc, zc - len / 2 + 0.2 + (k * (len - 0.4)) / bands, lift);
  for (const sz of [-1, 1]) {
    const cap = mk(new THREE.SphereGeometry(r, 32, 8, 0, Math.PI * 2, 0, Math.PI / 2), blue, 0, yc, zc + sz * len / 2, lift);
    cap.rotation.x = sz * Math.PI / 2; cap.scale.set(1, 0.25, 1); // domed tank ends
  }
  for (const sx of [-1, 1]) brandOn(L, 0.3, len * 0.55, sx * (r + 0.02), yc, zc, sx * Math.PI / 2, lift);
  // manhole with clamps, catwalk, level gauge
  CY(0.25, 0.25, 0.2, 16, blueDk, 0, yc + r, zc, lift);
  CY(0.28, 0.28, 0.05, 16, frame, 0, yc + r + 0.11, zc, lift);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; B(0.05, 0.08, 0.05, S(), Math.cos(a) * 0.28, yc + r + 0.11, zc + Math.sin(a) * 0.28, lift); }
  const cw0 = back + 0.35, cw1 = zc - 0.45; // catwalk from the back to the manhole
  B(0.4, 0.03, cw1 - cw0, F(), 0, yc + r - 0.04, (cw0 + cw1) / 2, lift);
  decal('tread', 0.38, cw1 - cw0 - 0.04, 0, yc + r - 0.023, (cw0 + cw1) / 2, 0, lift, Math.PI / 2);
  for (const sx of [-1, 1]) for (const z of [cw0, cw1]) rod([sx * 0.2, yc + r - 0.05, z], [sx * 0.2, yc + r + 0.55, z], 0.018, frame, lift);
  for (const sx of [-1, 1]) rod([sx * 0.2, yc + r + 0.55, cw0], [sx * 0.2, yc + r + 0.55, cw1], 0.018, frame, lift);
  RB(0.06, r * 1.25, 0.06, 0.02, M('#9cc3d0', { roughness: 0.08, metalness: 0.3, flatShading: false }), r + 0.01, yc, -0.6 - 0.2, lift); // sight glass
  // filling pipe, valve and ladder at the back
  CY(0.08, 0.08, 0.5, 10, frame, 0, 1.05, back - 0.15, lift).rotation.x = Math.PI / 2;
  CY(0.12, 0.12, 0.12, 12, P('#c4473a'), 0, 1.05, back - 0.42, lift).rotation.x = Math.PI / 2;
  rod([0, 1.05, back - 0.2], [0.18, 1.25, back - 0.2], 0.02, S(), lift);
  for (let k = 0; k * 0.32 < yc + r - 1.0; k++) B(0.36, 0.04, 0.05, frame, 0.5, 0.9 + k * 0.32, back - 0.32, lift);
  for (const sx of [0.32, 0.68]) rod([sx, 0.8, back - 0.32], [sx, yc + r - 0.1, back - 0.2], 0.025, frame, lift);
  hose([[-0.6, 1.1, back + 0.1], [-0.95, 1.25, back + 0.7], [-0.98, 1.3, zc], [-0.95, 1.28, -1.6]], 0.06, lift); // suction hose in its holder
  const wheels = [], wz = zc - 0.2, axz = L.axles === 2 ? [wz - 0.6, wz + 0.6] : [wz];
  for (const sx of [-1, 1]) {
    for (const z of axz) {
      const w = wheel(0.5, 0.3, '#d7dde2'); w.position.set(sx * (r + 0.1), 0.5, z); lift.add(w); wheels.push(w);
      fender(lift, frame, sx * (r + 0.1), 0.5, z, 0.62, Math.PI * 0.15, Math.PI * 0.85, 0.38, 0.05);
    }
    tailCluster(lift, sx * 0.62, 0.78, back + 0.05);
  }
  decal('plate2', 0.42, 0.21, -0.3, 0.55, back + 0.06, Math.PI, lift);
  bake(g, NO_SNOW);
  return { group: g, lift, wheels, up: 0, down: 0 };
}

/** Forestry harvester. o = look: body, dark, frame and rim colours, scale, names. */
const FORESTER = { body: '#e0b13a', dark: '#c99a2c', frame: '#3a3f42', rim: '#e8e4da', scale: 1, brand: 'LES', model: '8', text: '#26282a', stroke: null };
export function buildForester(o = {}) {
  const L = { ...FORESTER, ...o }, sc = L.scale, style = { fill: L.text, stroke: L.stroke };
  const root = new THREE.Group(), g = new THREE.Group(); g.scale.setScalar(sc); root.add(g);
  const yel = P(L.body), yelDk = P(L.dark), frame = F(L.frame), black = F(BLACK);
  RB(2.2, 0.9, 6.6, 0.08, frame, 0, 1.15, -0.6, g);
  // front frame with the cab and engine hood
  RB(2.3, 1.2, 2.2, 0.12, yel, 0, 2.0, 1.6, g, 3);
  for (const sx of [-1, 1]) headlamp(g, sx * 0.75, 2.2, 2.72, 0.32, 0.16);
  RB(2.1, 0.22, 0.25, 0.05, frame, 0, 1.15, 2.8, g); // push plate
  cab(g, { y: 2.6, z: 1.6, w: 2.05, h: 1.4, d: 1.65, roof: yel, lights: 4, bars: true });
  beacon(g, 0.85, 4.25, 1.15, beaconMat);
  RB(2.2, 1.0, 1.4, 0.1, yel, 0, 2.0, -0.6, g, 3);
  sideDecals('vent', 0.9, 0.7, 1.1, 2.0, -0.6, g);
  sideText(L.brand + ' ' + L.model, 0.34, 2.0, 1.15, 2.05, 1.6, g, style);
  CY(0.08, 0.08, 1.2, 10, black, 0.7, 3.0, -0.9, g);
  CY(0.13, 0.13, 0.5, 14, S('#aeb4b7'), 0.7, 2.85, -0.9, g);
  CY(0.1, 0.08, 0.1, 10, black, 0.7, 3.62, -0.9, g);
  decal('fill', 0.24, 0.06, -1.104, 1.75, -0.4, -Math.PI / 2, g);
  steps(g, -1.4, 0.75, 2.2, 0.4, 4, 0.24, 0.4);
  // articulation joint with steering rams, log bunk with stanchions
  CY(0.3, 0.3, 0.6, 14, F('#56595b'), 0, 1.15, 0.4, g);
  for (const sx of [-1, 1]) ram([sx * 0.7, 1.2, 0.0], [sx * 0.45, 1.2, 0.85], 0.05, frame, g);
  RB(2.3, 0.2, 3.4, 0.04, frame, 0, 1.7, -3.0, g);
  for (const sx of [-1.1, 1.1]) for (const sz of [-4.4, -1.7]) RB(0.16, 1.6, 0.16, 0.04, yel, sx, 2.5, sz, g);
  for (const sz of [-4.4, -1.7]) RB(2.4, 0.12, 0.16, 0.03, yelDk, 0, 1.85, sz, g);
  B(2.3, 1.5, 0.08, frame, 0, 2.5, -1.4, g); // headboard
  for (let k = 0; k < 5; k++) B(2.2, 0.04, 0.1, F('#56595b'), 0, 1.9 + k * 0.28, -1.36, g);
  for (const sx of [-1, 1]) {
    tailCluster(g, sx * 0.95, 1.4, -3.94);
    decal('warnR', 0.5, 0.16, sx * 0.6, 1.72, -4.71, Math.PI, g);
    // bogie beams over the rear wheel pairs
    RB(0.2, 0.36, 2.9, 0.06, frame, sx * 0.85, 0.85, -2.45, g);
  }
  decal('plate2', 0.42, 0.21, 0, 1.2, -3.92, Math.PI, g);
  const logs = [];
  for (let k = 0; k < 12; k++) {
    const row = k % 4, layer = Math.floor(k / 4);
    const l = mk(new THREE.CylinderGeometry(0.24, 0.24, 3.6, 7), '#a5784f', -0.75 + row * 0.5, 2.05 + layer * 0.45, -3.0, g);
    l.rotation.x = Math.PI / 2; l.userData.noBake = true; l.visible = false; logs.push(l);
  }
  const wheels = [], rear = [];
  for (const sz of [1.4, -1.3, -3.6]) for (const sx of [-1, 1]) {
    const w = wheel(0.75, 0.6, L.rim, 'lug');
    if (sz === 1.4) { const p = new THREE.Group(); p.position.set(sx * 1.25, 0.75, sz); g.add(p); p.add(w); rear.push(p); }
    else { w.position.set(sx * 1.25, 0.75, sz); g.add(w); }
    wheels.push(w);
  }
  // crane: turret, boom with hydraulic rams and hoses, and the felling head (rotates toward the tree while cutting)
  const crane = new THREE.Group(); crane.position.set(0, 2.6, 0.1); g.add(crane);
  CY(0.45, 0.55, 0.6, 16, yel, 0, 0.3, 0, crane);
  CY(0.5, 0.5, 0.08, 16, frame, 0, 0.05, 0, crane);
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; CY(0.03, 0.03, 0.1, 6, S(), Math.cos(a) * 0.46, 0.08, Math.sin(a) * 0.46, crane); }
  const boom = new THREE.Group(); boom.position.set(0, 0.6, 0); crane.add(boom);
  const b1 = RB(0.3, 0.3, 4.2, 0.05, yel, 0, 0.8, 1.8, boom); b1.rotation.x = -0.35;
  const b2 = RB(0.24, 0.24, 3.2, 0.04, yel, 0, 1.0, 5.2, boom); b2.rotation.x = 0.5;
  CY(0.12, 0.12, 0.4, 12, frame, 0, 1.55, 3.6, boom).rotation.z = Math.PI / 2; // knuckle
  ram([0.22, 0.05, 0.2], [0.22, 1.25, 2.6], 0.07, frame, boom);
  ram([-0.22, 0.05, 0.2], [-0.22, 1.25, 2.6], 0.07, frame, boom);
  ram([0, 1.75, 3.4], [0, 1.15, 5.6], 0.06, frame, boom);
  for (const sx of [-1, 1]) {
    hose([[sx * 0.1, 0.25, 0.1], [sx * 0.16, 0.9, 1.0], [sx * 0.17, 1.55, 2.6], [sx * 0.16, 1.85, 3.5], [sx * 0.14, 1.45, 4.8], [sx * 0.12, 0.85, 6.0], [sx * 0.1, 0.55, 6.45]], 0.035, boom);
  }
  RB(0.6, 0.7, 0.5, 0.06, black, 0, 0.2, 6.6, boom);
  RB(0.64, 0.12, 0.54, 0.03, yel, 0, 0.58, 6.6, boom);
  CY(0.1, 0.1, 0.2, 10, CHROME, 0, 0.7, 6.6, boom); // rotator
  for (const sx of [-1, 1]) {
    B(0.08, 0.5, 0.12, yel, sx * 0.32, -0.1, 6.75, boom).rotation.z = sx * 0.3; // grapple arms
    CY(0.09, 0.09, 0.14, 10, F('#56595b'), sx * 0.31, 0.0, 6.92, boom).rotation.x = Math.PI / 2; // feed rollers
  }
  CY(0.32, 0.32, 0.04, 16, S(), 0, -0.18, 6.6, boom); // saw disc guard
  const spot = spotAt(g, 2.5 * sc, 2.75 * sc);
  bake(root, NO_SNOW);
  for (const w of wheels) w.userData.r *= sc;
  return { group: root, wheels, front: rear, rear: [], crane, boom, logMeshes: logs, spot, scale: sc, exhaust: new THREE.Vector3(0.7, 3.7, -0.9).multiplyScalar(sc) };
}

/**
 * A wing of a folding implement: a group hinged at (x, y, z) that turns about `axis` from `shut`
 * (transport, raised) to `open` (working, lowered); vehicles.js moves it with the lift.
 */
function wing(lift, x, y, z, axis, open, shut) {
  const w = new THREE.Group(); w.position.set(x, y, z); w.rotation[axis] = shut; lift.add(w);
  w.userData = { axis, open, shut };
  return w;
}

/**
 * Mounted field sprayer: a tank on a frame and a boom of `width` metres. Raised, both halves of the
 * boom swing forward beside the tractor (transport); lowered, they open out with nozzles every half metre.
 * o = look: body (tank), frame, width, brand.
 */
export function buildSprayer(o = {}) {
  const L = { body: '#e9ebe6', frame: '#2f6fb0', width: 18, brand: null, ...o }, W = L.width, HINGE = 1.45, half = W / 2 - HINGE;
  const g = new THREE.Group(), lift = new THREE.Group(); g.add(lift);
  const tank = P(L.body), frame = P(L.frame), steel = S(), nozzle = F('#2a2d2f');
  RB(0.24, 0.24, 1.0, 0.04, frame, 0, 0.72, -0.4, lift);
  RB(1.5, 0.16, 1.5, 0.04, frame, 0, 0.62, -1.15, lift);
  RB(1.4, 1.05, 1.3, 0.3, tank, 0, 1.25, -1.15, lift, 3); // the tank, rounded
  CY(0.18, 0.18, 0.12, 12, F('#2a2d2f'), 0, 1.84, -1.15, lift); // filler lid
  decal('level', 0.5, 0.12, 0.55, 1.2, -1.82, Math.PI, lift);
  brandOn(L, 0.16, 1.1, 0, 1.45, -1.81, Math.PI, lift);
  RB(0.3, 1.2, 0.2, 0.04, frame, 0, 1.15, -1.95, lift); // boom mast
  B(HINGE * 2, 0.12, 0.12, frame, 0, 0.95, -2.05, lift); // centre section
  for (let x = -1.25; x <= 1.25; x += 0.5) B(0.04, 0.12, 0.04, nozzle, x, 0.86, -2.05, lift);
  const wings = [];
  for (const sx of [-1, 1]) {
    // hinge at the end of the centre section, outside the tractor's wheels; open = along ±x, shut = folded forward
    const w = wing(lift, sx * HINGE, 0.95, -2.05, 'y', 0, -sx * Math.PI * 0.5);
    const seg = Math.max(2, Math.round(half / 3));
    for (let k = 0; k < seg; k++) {
      const x0 = (k * half) / seg, len = half / seg;
      B(len, 0.09 - k * 0.01, 0.09, frame, sx * (x0 + len / 2), 0.0, 0, w);
      rod([sx * x0, 0.0, 0], [sx * (x0 + len), 0.28 - k * 0.05, 0], 0.02, frame, w); // truss
    }
    for (let x = 0.5; x < half; x += 0.5) B(0.03, 0.1, 0.03, nozzle, sx * x, -0.09, 0, w);
    B(0.05, 0.4, 0.05, frame, sx * (half - 0.05), -0.2, 0, w); // end guard
    wings.push(w);
  }
  for (const sx of [-1, 1]) tailCluster(lift, sx * 0.6, 1.0, -1.82);
  implHoses(lift, 2, 0.95, -0.55);
  bake(g, NO_SNOW);
  return { group: g, lift, wings, up: 0.35, down: 0.05 };
}

/**
 * Cambridge roller: rings of steel on three sections; the side sections fold up for transport.
 * o = look: color, width, brand.
 */
export function buildRoller(o = {}) {
  const L = { color: '#d9472f', width: 6, brand: null, ...o }, W = L.width, side = (W - 2.6) / 2;
  const g = new THREE.Group(), lift = new THREE.Group(); g.add(lift);
  const red = P(L.color), frame = F(), steel = S('#8f979b');
  RB(0.24, 0.24, 1.2, 0.04, red, 0, 0.72, -0.5, lift);
  RB(2.8, 0.22, 0.25, 0.05, red, 0, 0.95, -1.25, lift);
  brandOn(L, 0.14, 1.2, 0, 0.95, -1.38, Math.PI, lift);
  const drum = (p, x, w) => { // rings on a shaft, turning as the roller rolls
    const d = new THREE.Group(); d.position.set(x, 0.32, -1.7); p.add(d);
    const spin = new THREE.Group(); d.add(spin); d.userData = { spin, r: 0.32 };
    CY(0.06, 0.06, w, 8, steel, 0, 0, 0, spin).rotation.z = Math.PI / 2;
    for (let k = 0; k < Math.round(w / 0.16); k++) { const r = mk(new THREE.TorusGeometry(0.28, 0.05, 6, 12), steel, -w / 2 + 0.08 + k * 0.16, 0, 0, spin); r.rotation.y = Math.PI / 2; }
    return d;
  };
  const drums = [drum(lift, 0, 2.6)];
  for (const sx of [-1, 1]) RB(0.12, 0.6, 0.12, 0.03, frame, sx * 1.25, 0.65, -1.7, lift);
  const wings = [];
  for (const sx of [-1, 1]) {
    // hinge at the edge of the middle section: open = flat on the ground, shut = standing up
    const w = wing(lift, sx * 1.3, 0.32, 0, 'z', 0, sx * Math.PI * 0.5);
    RB(side, 0.18, 0.22, 0.04, red, sx * side / 2, 0.62, -1.25, w);
    for (const dz of [-1.25]) RB(0.1, 0.4, 0.1, 0.03, frame, sx * (side - 0.1), 0.45, dz - 0.2, w);
    const d = drum(w, sx * side / 2, side - 0.1); d.position.y = 0;
    drums.push(d);
    decal('warnR', 0.5, 0.16, sx * (side - 0.3), 0.62, -1.38, Math.PI, w);
    wings.push(w);
  }
  ram([0, 1.15, -0.6], [0, 1.0, -1.2], 0.04, frame, lift);
  implHoses(lift, 2, 0.95, -0.55);
  bake(g, NO_SNOW);
  return { group: g, lift, wings, wheels: drums, up: 0.5, down: 0 };
}

/** Flail mulcher: a hood over a rotor and a rear roller, chops stubble and straw. o = look: color, width, brand. */
export function buildMulcher(o = {}) {
  const L = { color: '#2f8f3a', width: 3, brand: null, ...o }, W = L.width;
  const g = new THREE.Group(), lift = new THREE.Group(); g.add(lift);
  const body = P(L.color), frame = F();
  RB(0.24, 0.24, 0.8, 0.04, frame, 0, 0.72, -0.4, lift);
  RB(W, 0.55, 1.0, 0.12, body, 0, 0.45, -1.15, lift, 3); // hood
  RB(W + 0.06, 0.08, 0.2, 0.03, P('#e8e4da'), 0, 0.75, -0.7, lift);
  for (const sx of [-1, 1]) RB(0.06, 0.6, 1.1, 0.02, body, sx * (W / 2 + 0.03), 0.35, -1.15, lift); // side skids
  for (let k = 0; k < Math.round(W / 0.3); k++) B(0.02, 0.28, 0.16, RUBBER, -W / 2 + 0.15 + k * 0.3, 0.17, -0.64, lift); // front curtain
  RB(0.5, 0.4, 0.4, 0.05, body, 0, 0.85, -0.85, lift); // gearbox
  CY(0.06, 0.06, 0.5, 8, S(), 0, 0.95, -0.45, lift).rotation.x = Math.PI / 2;
  const roll = new THREE.Group(); roll.position.set(0, 0.16, -1.75); lift.add(roll);
  CY(0.15, 0.15, W - 0.1, 12, S('#9aa1a5'), 0, 0, 0, roll).rotation.z = Math.PI / 2;
  for (const sx of [-1, 1]) decal('warnR', 0.5, 0.18, sx * (W / 2 - 0.3), 0.45, -1.66, Math.PI, lift);
  brandOn(L, 0.14, 1.2, 0, 0.5, -1.656, Math.PI, lift);
  implHoses(lift, 1, 0.9, -0.55);
  bake(g, NO_SNOW);
  return { group: g, lift, roller: roll, up: 0.45, down: 0 };
}
