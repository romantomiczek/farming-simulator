import * as THREE from 'three';
import { renderer } from './core.js';
import { buildModel } from '../vehicles/vehicles.js';

/**
 * Pictures of the machine models for the shop. A small studio scene (ground disc, sky colour, sun and
 * sky light) is drawn with the game's own renderer into the corner of the canvas just before the
 * game frame, copied into a 2D canvas and stored as an image; the game frame then paints over the
 * corner. The studio has the same kinds of lights and fog as the game, so the game's shaders are
 * reused and nothing compiles.
 * thumbURL(id) returns a stored picture or asks for one (pictures are made one per frame, and
 * onThumb is told when one is ready). setViewer(canvas, id) shows a model turning in a canvas;
 * dragging turns it by hand.
 */
const TW = 432, TH = 190; // the shape of a shop card's picture
const studio = new THREE.Scene();
studio.background = new THREE.Color('#e4ebe1');
studio.fog = new THREE.Fog(0xe4ebe1, 5000, 6000); // same shader variant as the game's fogged scene
studio.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c0, 1.9));
const sun = new THREE.DirectionalLight(0xffffff, 4.2);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
studio.add(sun, sun.target);
for (let i = 0; i < 3; i++) { const s = new THREE.SpotLight(0xffffff, 0); studio.add(s, s.target); } // like the headlight pool
const ground = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: 0xd3d8cc, roughness: 1 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
studio.add(ground);
const cam = new THREE.PerspectiveCamera(30, TW / TH, 0.1, 400);

const urls = new Map(), queue = [];
const out = document.createElement('canvas'); out.width = TW; out.height = TH;
const ctx = out.getContext('2d');
let onThumb = null;
/** Called with the model id whenever a picture is ready. */
export const setThumbHandler = fn => { onThumb = fn; };
/** The stored picture of model id, or null (it is then made soon). */
export function thumbURL(id) {
  if (urls.has(id)) return urls.get(id);
  if (!queue.includes(id)) queue.push(id);
  return null;
}

let shown = null; // the model standing in the studio: { id, group }
function stage(id) {
  if (shown?.id === id) return shown;
  if (shown) { studio.remove(shown.group); shown.group.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); }
  const m = buildModel(id), g = m.group;
  if (m.cornHdr) m.cornHdr.visible = false;
  // the box of what is seen: hidden parts (spare headers, light anchors) would make the model look small
  const box = new THREE.Box3(), part = new THREE.Box3();
  g.updateMatrixWorld(true);
  (function add(o) {
    if (!o.visible) return;
    if (o.isMesh && o.geometry) { o.geometry.computeBoundingBox?.(); box.union(part.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld)); }
    for (const k of o.children) add(k);
  })(g);
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const corners = [];
  for (let i = 0; i < 8; i++) corners.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
  shown = { id, group: g, center: c, corners, radius: Math.max(size.x, size.z, size.y * 1.4) * 0.62, fits: new Map() };
  studio.add(g);
  ground.scale.setScalar(shown.radius * 2.6);
  const r = shown.radius;
  sun.position.set(c.x + r * 1.2, r * 3 + 6, c.z + r * 1.6); sun.target.position.copy(c);
  const sc = sun.shadow.camera; sc.left = sc.bottom = -r * 1.6; sc.right = sc.top = r * 1.6; sc.near = 0.5; sc.far = r * 8 + 20; sc.updateProjectionMatrix();
  return shown;
}
const v3 = new THREE.Vector3();
/** Puts the camera at yaw, d away from the model, and returns how far the model's box reaches on screen. */
function aim(yaw, d) {
  const s = shown, c = s.center;
  cam.position.set(c.x + Math.sin(yaw) * d * 0.85, c.y + d * 0.38, c.z + Math.cos(yaw) * d * 0.85);
  cam.lookAt(c); cam.updateMatrixWorld();
  let x0 = 1, x1 = -1, y0 = 1, y1 = -1;
  for (const p of s.corners) { v3.copy(p).project(cam); x0 = Math.min(x0, v3.x); x1 = Math.max(x1, v3.x); y0 = Math.min(y0, v3.y); y1 = Math.max(y1, v3.y); }
  return { x0, x1, y0, y1 };
}
/** The distance at which the model fills the picture at yaw (a few rounds, as perspective is not linear). */
function fitAt(yaw) {
  let d = shown.radius * 3;
  for (let i = 0; i < 4; i++) { const e = aim(yaw, d); d *= Math.max((e.x1 - e.x0) / 1.88, (e.y1 - e.y0) / 1.84); }
  const e = aim(yaw, d);
  return { d, cx: (e.x0 + e.x1) / 2, cy: (e.y0 + e.y1) / 2 };
}
/**
 * Camera for a picture of shape w × h at yaw. A still picture is fitted to its own view; the turning
 * model keeps the distance of its widest view, so it does not zoom as it turns.
 */
function frame(yaw, w, h, turning) {
  cam.clearViewOffset(); cam.aspect = w / h; cam.updateProjectionMatrix();
  let f;
  if (turning) {
    const key = 'turn' + (w / h).toFixed(3);
    if (!shown.fits.has(key)) {
      let d = 0, cy = 0;
      for (let i = 0; i < 12; i++) { const x = fitAt(i / 12 * Math.PI * 2); d = Math.max(d, x.d); cy += x.cy / 12; }
      shown.fits.set(key, { d, cx: 0, cy });
    }
    f = shown.fits.get(key);
  } else f = fitAt(yaw);
  aim(yaw, f.d);
  cam.setViewOffset(w, h, f.cx * w / 2, -f.cy * h / 2, w, h); // the model in the middle of the picture
}
/** Draws the studio at yaw into the canvas corner and copies it into target (a 2D context of size w × h). */
function shoot(yaw, target, w, h, turning) {
  frame(yaw, w, h, turning);
  const pr = renderer.getPixelRatio(), size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const vw = w / pr, vh = h / pr;
  renderer.setViewport(0, 0, vw, vh); renderer.setScissor(0, 0, vw, vh); renderer.setScissorTest(true);
  renderer.render(studio, cam);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, size.x / pr, size.y / pr);
  target.drawImage(renderer.domElement, 0, size.y - h, w, h, 0, 0, target.canvas.width, target.canvas.height);
}

const viewer = { canvas: null, ctx: null, id: null, yaw: 0.6, drag: null, idle: 0 };
/** Shows model id turning in canvas cv (null to stop). */
export function setViewer(cv, id) {
  if (viewer.canvas === cv && viewer.id === id) return;
  viewer.canvas = cv; viewer.id = id; viewer.ctx = cv?.getContext('2d') || null; viewer.yaw = 0.6;
  if (!cv) return;
  cv.onpointerdown = e => { viewer.drag = e.clientX; viewer.idle = 0; cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = e => { if (viewer.drag == null) return; viewer.yaw -= (e.clientX - viewer.drag) * 0.01; viewer.drag = e.clientX; };
  cv.onpointerup = cv.onpointercancel = () => { viewer.drag = null; viewer.idle = 0; };
}

/**
 * Once per frame, before the game frame is drawn: the turning model in the shop detail, then one
 * picture from the queue.
 */
export function pumpPreviews(dt) {
  const v = viewer;
  if (v.canvas && !v.canvas.isConnected) setViewer(null, null);
  if (v.canvas) {
    if (v.drag == null && (v.idle += dt) > 1.5) v.yaw += dt * 0.5;
    stage(v.id);
    shoot(v.yaw, v.ctx, v.canvas.width, v.canvas.height, true);
  }
  const id = queue.shift();
  if (!id) return;
  stage(id);
  shoot(0.75, ctx, TW, TH);
  urls.set(id, out.toDataURL('image/jpeg', 0.86));
  onThumb?.(id);
}
