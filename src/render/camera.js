import * as THREE from 'three';
import { camera } from './core.js';
import { glassMat } from './materials.js';
import { clamp, angDiff } from '../core/util.js';
import { keys } from '../core/input.js';
import { groundH } from '../world/terrain.js';

/**
 * Orbit camera following the active vehicle or the farmer. Mouse drag / Z,X rotate, wheel or pinch zooms.
 * Like in Farming Simulator it starts low and close behind the machine, so the horizon shows; the wheel
 * still zooms out to an overview. After 2.5 s without manual input it swings back behind the vehicle
 * while driving. In the cab view (V) it sits at the driver's eyes instead.
 * manual = -99 means "snap behind the vehicle now" (after switching vehicles).
 */
/** Lowest camera tilt: almost level, so the player can look at the horizon and the sky. */
const PITCH_MIN = 0.12;
/** Default tilt behind a machine and on foot: a few metres above the ground, the horizon in the upper third. */
export const PITCH_DEFAULT = 0.3;
/** In the cab the head bends a little down, so the wheel and the bonnet show; the view is wider than outside. */
export const LOOK_UP = -0.14, CAB_FOV = 72, FOV = 52;
export const cam = { yaw: 0, pitch: PITCH_DEFAULT, dist: 13, manual: -99, t: new THREE.Vector3(-10, 1, -4), foot: false, distOther: 6, cab: false, look: 0, lookUp: LOOK_UP, lookT: 0, v: null };
/** Cab view on (V): the camera sits at the driver's eyes; the mouse looks around, Z/X turn the head. */
export const inCab = v => cam.cab && v.type !== 'person' && !!v.seat;
/** Zoom range: close behind the farmer on foot, further out behind a machine. */
const zoomMin = () => (cam.foot ? 3.5 : 6), zoomMax = () => (cam.foot ? 40 : 120);
/** Starting distance behind a machine: a tractor about 11 m, a big combine or beet harvester more. */
export const camDistFor = v => clamp((v.bodyPart?.hz || 2.5) * 2.2 + 6, 10, 20);

export function bindCamera(canvas) {
  const ptrs = new Map();
  let pinch0 = 0, dist0 = 0;
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = cam.dist; }
  });
  canvas.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId);
    if (!p) return;
    if (ptrs.size === 1 && cam.cabNow) {
      // in the cab: turn the head (back to the road a moment after letting go)
      cam.look = clamp(cam.look - (e.clientX - p.x) * 0.005, -2.4, 2.4);
      cam.lookUp = clamp(cam.lookUp - (e.clientY - p.y) * 0.004, -0.8, 0.6);
      cam.lookT = performance.now() / 1000;
    } else if (ptrs.size === 1) {
      cam.yaw -= (e.clientX - p.x) * 0.006;
      cam.pitch = clamp(cam.pitch + (e.clientY - p.y) * 0.004, PITCH_MIN, 1.4);
      cam.manual = performance.now() / 1000;
    }
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 2 && pinch0 > 0) {
      const [a, b] = [...ptrs.values()];
      cam.dist = clamp((dist0 * pinch0) / Math.hypot(a.x - b.x, a.y - b.y), zoomMin(), zoomMax());
    }
  });
  const up = e => { ptrs.delete(e.pointerId); pinch0 = 0; };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e => { e.preventDefault(); cam.dist = clamp(cam.dist * (1 + Math.sign(e.deltaY) * 0.1), zoomMin(), zoomMax()); }, { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
}

const desired = new THREE.Vector3(), look = new THREE.Vector3();
let shake = 0, shakeT = 0;
/** A short shake of the view after a crash: a = strength 0..1. */
export function shakeCamera(a) { shake = Math.max(shake, a); }
const _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _eye = new THREE.Vector3();
/** Driver's eyes: above the seat cushion, a little forward. Camera turned by the machine (slopes) and the head. */
function cabCamera(dt, v, t) {
  if (keys.KeyZ) { cam.look = Math.min(2.4, cam.look + 1.7 * dt); cam.lookT = t; }
  if (keys.KeyX) { cam.look = Math.max(-2.4, cam.look - 1.7 * dt); cam.lookT = t; }
  if (t - cam.lookT > 2.5) { cam.look *= Math.exp(-dt * 3); cam.lookUp += (LOOK_UP - cam.lookUp) * Math.min(1, dt * 3); }
  v.group.updateMatrixWorld(true);
  _eye.set(v.seat.x, v.seat.y + 0.62, v.seat.z + 0.05);
  v.group.localToWorld(_eye);
  camera.position.copy(_eye);
  v.group.getWorldQuaternion(_q);
  _e.set(cam.lookUp, Math.PI + cam.look, 0);
  camera.quaternion.copy(_q).multiply(new THREE.Quaternion().setFromEuler(_e));
}

/** Orbit around the target cam.t at yaw, pitch and distance. */
function orbitCamera() {
  const cp = Math.cos(cam.pitch) * cam.dist;
  camera.position.set(cam.t.x - Math.sin(cam.yaw) * cp, cam.t.y + Math.sin(cam.pitch) * cam.dist, cam.t.z - Math.cos(cam.yaw) * cp);
  // never under a hill behind the vehicle
  camera.position.y = Math.max(camera.position.y, groundH(camera.position.x, camera.position.z) + 2);
  // when the camera is tilted low, aim a little above the vehicle so the horizon comes into view
  look.copy(cam.t); look.y += Math.max(0, 0.5 - cam.pitch) * 6;
  camera.lookAt(look);
}

const _f = new THREE.Vector3(), focus = new THREE.Vector3();
/** Where the sun's shadows centre: ahead of the target when the camera looks low towards the horizon. */
export function viewFocus() {
  camera.getWorldDirection(_f); _f.y = 0;
  const n = _f.length(), ahead = cam.cabNow ? 20 : clamp((0.6 - cam.pitch) * 60, 0, 20);
  focus.copy(cam.t);
  if (n > 1e-3) focus.addScaledVector(_f, ahead / n);
  return focus;
}

const gc = new THREE.Vector3();
/** Middle of the patch of grass blades: a little ahead of the camera, where the near ground is seen. */
export function grassCentre() {
  camera.getWorldDirection(_f); _f.y = 0;
  const n = _f.length();
  gc.copy(camera.position);
  if (n > 1e-3) gc.addScaledVector(_f, 14 / n);
  return gc;
}

export function updateCamera(dt, v) {
  const t = performance.now() / 1000, foot = v.type === 'person', cab = inCab(v);
  // the cab needs a near clipping plane close to the eyes (the wheel), outside it would waste depth precision
  if (cab !== cam.cabNow) {
    cam.cabNow = cab; camera.near = cab ? 0.08 : 0.5; camera.fov = cab ? CAB_FOV : FOV; camera.updateProjectionMatrix();
    glassMat.opacity = cab ? 0.15 : 0.5; // a windscreen right before the eyes would look milky
  }
  // getting out or in: each has its own zoom
  if (foot !== cam.foot) { const d = cam.dist; cam.dist = cam.distOther; cam.distOther = d; cam.foot = foot; }
  // each machine keeps its own zoom; the first time you sit in one the camera starts at its size
  if (!foot && v !== cam.v) {
    if (cam.v) cam.v.camDist = cam.dist;
    cam.dist = v.camDist ?? camDistFor(v); cam.v = v;
  }
  if (!cab && keys.KeyZ) { cam.yaw += 1.7 * dt; cam.manual = t; }
  if (!cab && keys.KeyX) { cam.yaw -= 1.7 * dt; cam.manual = t; }
  if (cam.manual === -99) {
    const d = angDiff(cam.yaw, v.h);
    cam.yaw += d * Math.min(1, dt * 3);
    if (Math.abs(d) < 0.01) cam.manual = -50;
  } else if (foot ? t - cam.manual > 1 : t - cam.manual > 2.5 && v.speed > 0.8) {
    // behind a driving machine, and behind the farmer (he turns quickly, so the camera keeps up)
    cam.yaw += angDiff(cam.yaw, v.h) * Math.min(1, dt * (foot ? 5 : 1.2));
  }
  if (foot) desired.set(v.x, (v.y || 0) + 1.3, v.z);
  else desired.set(v.x + Math.sin(v.h) * 3, (v.y || 0) + 1, v.z + Math.cos(v.h) * 3);
  cam.t.lerp(desired, 1 - Math.exp(-dt * 6));
  if (cab) { cam.yaw = v.h; cabCamera(dt, v, t); } // the orbit waits behind the machine for leaving the cab view
  else orbitCamera();
  if (shake > 0.002) {
    // a few fast wobbles of the view that die away
    shakeT += dt;
    camera.rotateX(Math.sin(shakeT * 47) * shake * 0.012);
    camera.rotateY(Math.sin(shakeT * 61 + 1) * shake * 0.01);
    camera.rotateZ(Math.sin(shakeT * 37 + 2) * shake * 0.007);
    shake *= Math.exp(-dt * 6);
  }
}
