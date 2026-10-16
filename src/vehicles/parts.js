import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M, mk, B, CY, lampMat } from '../render/materials.js';

/**
 * Parts shared by the machine models: surface materials (glossy paint, satin frame, rubber, steel),
 * a decal atlas (names, model numbers, number plates, warning stripes, grilles), detailed wheels,
 * hoses, extruded profiles for bonnets and mudguards, and lamp clusters.
 * Plain materials of one machine are merged into one draw call by bake() whatever their
 * roughness, so the extra surfaces cost triangles only.
 */

/**
 * LOD.low = true while the simplified model of a machine is built (seen from afar): plain boxes,
 * coarse wheels, no hoses, lamps, mirrors, wipers, steps or cab interior. See vehicles.js farModel().
 */
export const LOD = { low: false };

/* ---------- surfaces ---------- */
export const DARK = '#3a3f42', TYRE = '#26282a', STEEL = '#b9bfc2', IRON = '#56595b', TAIL = '#c4332a', AMBER = '#e8902a';
/** Glossy machine paint. */
export const P = hex => M(hex, { roughness: 0.36, metalness: 0.22, flatShading: false });
/** Satin dark frame, axles, brackets. */
export const F = hex => M(hex || DARK, { roughness: 0.62, metalness: 0.35, flatShading: false });
/** Bright steel: cylinders, rods, wearing parts. */
export const S = hex => M(hex || STEEL, { roughness: 0.28, metalness: 0.8, flatShading: false });
export const RUBBER = M(TYRE, { roughness: 0.94, metalness: 0, flatShading: false });
export const CHROME = M('#d9dde0', { roughness: 0.15, metalness: 0.95, flatShading: false });
export const tailMat = M(TAIL, { roughness: 0.2, metalness: 0.1, flatShading: false });
export const amberMat = M(AMBER, { roughness: 0.2, metalness: 0.1, flatShading: false });

/** Box with rounded edges (smooth with paint, faceted with flat materials). */
export const RB = (w, h, d, r, mat, x, y, z, p, seg = 2) =>
  mk(LOD.low ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.99), mat, x, y, z, p);

const _up = new THREE.Vector3(0, 1, 0);
/** Round bar from a to b ([x, y, z]). */
export function rod(a, b, t, mat, p, seg = 8) {
  if (LOD.low) seg = 4;
  const A = new THREE.Vector3(...a), D = new THREE.Vector3(...b).sub(A);
  const m = mk(new THREE.CylinderGeometry(t, t, D.length(), seg), mat, A.x + D.x / 2, A.y + D.y / 2, A.z + D.z / 2, p);
  m.quaternion.setFromUnitVectors(_up, D.normalize());
  return m;
}
/** Hydraulic ram from a to b: barrel (2/3) and chromed piston rod. */
export function ram(a, b, r, mat, p) {
  if (LOD.low) { rod(a, b, r, mat, p); return; }
  const m = a.map((v, i) => v + (b[i] - v) * 0.62);
  rod(a, m, r, mat, p);
  rod(m, b, r * 0.55, CHROME, p);
  CY(r * 1.25, r * 1.25, r * 1.4, 8, mat, ...a, p).quaternion.copy(new THREE.Quaternion().setFromUnitVectors(_up, new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize()));
}
/** Flexible hose through the points (smooth curve). */
export function hose(pts, r, p, mat = M('#1e2022', { roughness: 0.7, flatShading: false })) {
  if (LOD.low) return null;
  const c = new THREE.CatmullRomCurve3(pts.map(q => new THREE.Vector3(...q)));
  return mk(new THREE.TubeGeometry(c, Math.max(8, pts.length * 5), r, 6, false), mat, 0, 0, 0, p);
}

/**
 * A side profile (points [z, y] going round the outline) extruded across the machine,
 * centred on x, with rounded edges. Used for bonnets, cab roofs and tank covers.
 */
export function profile(pts, width, bevel, mat, x, p, curve = 8) {
  const sh = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const t = LOD.low ? 0 : Math.min(bevel, width / 3);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: width - 2 * t, bevelEnabled: t > 0, bevelThickness: t, bevelSize: t, bevelSegments: 3, curveSegments: LOD.low ? 1 : curve });
  geo.rotateY(-Math.PI / 2); geo.translate(width / 2 - t, 0, 0);
  return mk(geo, mat, x, 0, 0, p);
}
/** Curved mudguard over a wheel: arc from angle a0 to a1 (0 = forward, π/2 = up) of radius r around (cy, cz). */
export function fender(p, mat, x, cy, cz, r, a0, a1, width, thick = 0.07) {
  const pts = [], n = LOD.low ? 4 : 16;
  for (let k = 0; k <= n; k++) { const a = a0 + ((a1 - a0) * k) / n; pts.push([cz + Math.cos(a) * (r + thick), cy + Math.sin(a) * (r + thick)]); }
  for (let k = n; k >= 0; k--) { const a = a0 + ((a1 - a0) * k) / n; pts.push([cz + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return profile(pts, width, Math.min(0.03, thick / 2), mat, x, p, 4);
}

/* ---------- decals ---------- */
// Cells of the atlas in pixels [x, y, w, h] on a 1024 × 1024 canvas.
const CELLS = {
  brazda: [0, 0, 512, 128], n140: [512, 0, 256, 128], logo: [768, 0, 128, 128], plate: [896, 0, 128, 64], plate2: [896, 64, 128, 64],
  klas: [0, 128, 640, 128], warn: [640, 128, 256, 64], warnR: [640, 192, 256, 64],
  bulva: [0, 256, 768, 128], grid: [768, 256, 256, 256],
  les: [0, 384, 512, 128], lesak: [512, 384, 256, 128],
  vent: [0, 512, 256, 256], tread: [256, 512, 256, 256], stripe: [512, 512, 512, 64], stripeR: [512, 576, 512, 64],
  fill: [512, 640, 256, 64], level: [768, 640, 256, 64], white: [992, 992, 32, 32],
};
const cv = document.createElement('canvas'); cv.width = cv.height = 1024;
const decalTex = new THREE.CanvasTexture(cv);
decalTex.colorSpace = THREE.SRGBColorSpace; decalTex.anisotropy = 4;
export const decalMat = new THREE.MeshStandardMaterial({
  map: decalTex, alphaTest: 0.5, roughness: 0.4, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
});

function drawAtlas() {
  const c = cv.getContext('2d');
  c.clearRect(0, 0, 1024, 1024);
  const FONT = '"Bricolage Grotesque", "Arial Black", "Segoe UI", sans-serif';
  const text = (cell, t, fill, stroke, size, style = 'italic 800') => {
    const [x, y, w, h] = CELLS[cell];
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.font = `${style} ${size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const fit = Math.min(1, (w * 0.94) / c.measureText(t).width);
    c.translate(x + w / 2, y + h / 2 + 4); c.scale(fit, 1);
    if (stroke) { c.lineWidth = 10; c.lineJoin = 'round'; c.strokeStyle = stroke; c.strokeText(t, 0, 0); }
    c.fillStyle = fill; c.fillText(t, 0, 0);
    c.restore();
  };
  text('brazda', 'BRÁZDA', '#f4ecd2', '#24312a', 104);
  text('n140', '140', '#f4ecd2', '#24312a', 104);
  text('klas', 'KLAS 7', '#fbf7ee', '#5a1f17', 108);
  text('bulva', 'BULVA 6', '#fbf7ee', '#1d3445', 108);
  text('les', 'LES 8', '#26282a', null, 108);
  text('lesak', 'LESÁK', '#efe6c8', '#2f3524', 92);
  // round badge with an ear of wheat
  { const [x, y, w] = CELLS.logo, r = w / 2 - 6, cx = x + w / 2, cy = y + w / 2;
    c.fillStyle = '#24312a'; c.beginPath(); c.arc(cx, cy, r + 4, 0, 7); c.fill();
    c.fillStyle = '#e8b84a'; c.beginPath(); c.arc(cx, cy, r - 4, 0, 7); c.fill();
    c.strokeStyle = '#24312a'; c.lineWidth = 6; c.beginPath(); c.moveTo(cx, cy + r * 0.7); c.lineTo(cx, cy - r * 0.55); c.stroke();
    c.fillStyle = '#24312a';
    for (let k = 0; k < 4; k++) for (const s of [-1, 1]) {
      c.beginPath(); c.ellipse(cx + s * 11, cy - r * 0.45 + k * 17, 7, 13, s * 0.6, 0, 7); c.fill();
    } }
  // number plates: white with a blue strip
  for (const [cell, t] of [['plate', '1ZL 0140'], ['plate2', '1ZL 0007']]) {
    const [x, y, w, h] = CELLS[cell];
    c.fillStyle = '#1f2326'; c.fillRect(x + 2, y + 6, w - 4, h - 12);
    c.fillStyle = '#f4f4f0'; c.fillRect(x + 5, y + 9, w - 10, h - 18);
    c.fillStyle = '#2b5fb5'; c.fillRect(x + 5, y + 9, 14, h - 18);
    c.fillStyle = '#1f2326'; c.font = `700 28px "Segoe UI", Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(t, x + w / 2 + 7, y + h / 2 + 1, w - 30);
  }
  // red and white warning stripes, both directions
  for (const [cell, dir] of [['warn', 1], ['warnR', -1]]) {
    const [x, y, w, h] = CELLS[cell];
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.fillStyle = '#f4f4f0'; c.fillRect(x, y, w, h); c.fillStyle = '#d2352b';
    for (let k = -2; k < 10; k++) {
      const x0 = x + k * 48;
      c.beginPath(); c.moveTo(x0, y + (dir > 0 ? h : 0)); c.lineTo(x0 + 24, y + (dir > 0 ? h : 0)); c.lineTo(x0 + 24 + h * 0.8, y + (dir > 0 ? 0 : h)); c.lineTo(x0 + h * 0.8, y + (dir > 0 ? 0 : h)); c.fill();
    }
    c.restore();
  }
  // radiator grille: steel bars, see-through gaps
  { const [x, y, w, h] = CELLS.grid;
    c.fillStyle = '#9aa1a5';
    for (let k = 0; k <= 16; k++) c.fillRect(x, y + k * (h / 16) - 3, w, 6);
    for (let k = 0; k <= 8; k++) c.fillRect(x + k * (w / 8) - 2, y, 4, h);
    c.fillRect(x, y, w, 8); c.fillRect(x, y + h - 8, w, 8); c.fillRect(x, y, 8, h); c.fillRect(x + w - 8, y, 8, h); }
  // cooling vents: dark slots in a pressed panel
  { const [x, y, w, h] = CELLS.vent;
    c.fillStyle = '#1c1f21';
    for (let r = 0; r < 7; r++) for (let k = 0; k < 3; k++) {
      const rx = x + 14 + k * ((w - 28) / 3), ry = y + 16 + r * ((h - 32) / 7);
      c.beginPath(); c.roundRect(rx + 4, ry + 6, (w - 28) / 3 - 8, (h - 32) / 7 - 14, 8); c.fill();
    } }
  // checker plate for steps and platforms
  { const [x, y, w, h] = CELLS.tread;
    c.fillStyle = '#9fa6a9'; c.fillRect(x, y, w, h);
    c.fillStyle = '#c9cfd2';
    for (let r = 0; r < 12; r++) for (let k = 0; k < 12; k++) {
      c.save(); c.translate(x + 11 + k * 21, y + 11 + r * 21); c.rotate((r + k) % 2 ? 0.785 : -0.785); c.fillRect(-7, -2, 14, 4); c.restore();
    } }
  // two-tone body stripes
  for (const [cell, a, b] of [['stripe', '#f4ecd2', '#24312a'], ['stripeR', '#fbf7ee', '#3a3f42']]) {
    const [x, y, w, h] = CELLS[cell];
    c.fillStyle = a; c.fillRect(x, y + 6, w, 22); c.fillStyle = b; c.fillRect(x, y + 36, w, 10);
  }
  // fuel filler and tank level labels
  { const [x, y, w, h] = CELLS.fill; c.fillStyle = '#26282a'; c.fillRect(x, y, w, h); c.fillStyle = '#e8b84a'; c.font = `700 40px "Segoe UI", Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('DIESEL', x + w / 2, y + h / 2 + 2); }
  { const [x, y, w, h] = CELLS.level; c.fillStyle = '#26282a'; c.fillRect(x, y, w, h);
    for (let k = 0; k < 10; k++) { c.fillStyle = k < 7 ? '#e8b84a' : '#5a5f62'; c.fillRect(x + 12 + k * 23, y + 14, 16, h - 28); } }
  c.fillStyle = '#ffffff'; c.fillRect(...CELLS.white); // plain parts sample this texel when merged with the decals
  decalTex.needsUpdate = true;
}
drawAtlas();
document.fonts?.ready.then(drawAtlas);

/** For bake(): decals merge with the plain parts of a machine into one mesh (see bake opts.atlas). */
export const ATLAS = { mat: decalMat, white: [(CELLS.white[0] + 16) / 1024, 1 - (CELLS.white[1] + 16) / 1024] };

/**
 * Decal from the atlas: a w × h plane at (x, y, z) facing direction ry (0 = +z, π/2 = +x).
 * tilt leans it back (for sloping surfaces), flip mirrors it.
 */
export function decal(name, w, h, x, y, z, ry, p, tilt = 0, flip = false) {
  if (LOD.low && w * h < 0.15) return null; // small labels vanish in the distance
  const [cx, cy, cw, ch] = CELLS[name], geo = new THREE.PlaneGeometry(w, h), uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = flip ? 1 - uv.getX(i) : uv.getX(i), v = uv.getY(i);
    uv.setXY(i, (cx + u * cw) / 1024, 1 - (cy + (1 - v) * ch) / 1024);
  }
  const m = mk(geo, decalMat, x, y, z, p, false);
  m.rotation.set(-tilt, ry, 0, 'YXZ');
  return m;
}
/** The same decal on both sides of a body of half width hx (reads front to back on the left, back to front on the right). */
export function sideDecals(name, w, h, hx, y, z, p) {
  decal(name, w, h, hx + 0.008, y, z, Math.PI / 2, p);
  decal(name, w, h, -hx - 0.008, y, z, -Math.PI / 2, p);
}

/* ---------- wheels ---------- */
const geoCache = new Map();
const cached = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key).clone(); };
const _o = new THREE.Object3D();
const place = (geo, x, y, z, rx = 0, ry = 0, rz = 0) => { _o.position.set(x, y, z); _o.rotation.set(rx, ry, rz); _o.updateMatrix(); return geo.applyMatrix4(_o.matrix); };

/** Tyre with a bulging sidewall (axis along x). */
function tyreGeo(r, w, ri) {
  return cached(`tyre${r}|${w}`, () => {
    const sh = Math.min(w * 0.22, r * 0.17), pts = [];
    const side = (s, list) => {
      // from the rim bead out over the sidewall bulge to the tread shoulder
      for (let k = 0; k <= 5; k++) {
        const t = k / 5, rr = ri + (r - sh - ri) * t;
        list.push([rr, s * (w / 2 - 0.01 + Math.sin(t * Math.PI) * w * 0.035)]);
      }
      for (let k = 1; k <= 4; k++) { const a = (k / 4) * Math.PI / 2; list.push([r - sh + Math.sin(a) * sh, s * (w / 2 - sh + Math.cos(a) * sh)]); }
    };
    const a = [], b = [];
    side(-1, a); side(1, b);
    for (const [x, y] of [...a, ...b.reverse()]) pts.push(new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 40).rotateZ(Math.PI / 2);
  });
}
/** Chevron lugs (tractor and harvester tyres) or a block road pattern, merged into one geometry. */
function treadGeo(r, w, kind) {
  return cached(`tread${r}|${w}|${kind}`, () => {
    const parts = [];
    if (kind === 'lug') {
      const n = Math.max(14, Math.round(r * 22)), lh = r * 0.075, lw = r * 0.12;
      for (let i = 0; i < n; i++) for (const s of [-1, 1]) {
        const a = ((i + (s > 0 ? 0.5 : 0)) / n) * Math.PI * 2;
        // the lug runs from the middle out over the shoulder, at an angle
        parts.push(place(new THREE.BoxGeometry(w * 0.5, lh, lw), s * w * 0.24, Math.cos(a) * (r + lh * 0.3), Math.sin(a) * (r + lh * 0.3), a, s * 0.62, 0));
        parts.push(place(new THREE.BoxGeometry(0.05, r * 0.16, lw * 0.9), s * (w / 2 - 0.005), Math.cos(a + s * 0.02) * (r - r * 0.06), Math.sin(a + s * 0.02) * (r - r * 0.06), a, 0, 0));
      }
    } else {
      const n = Math.max(16, Math.round(r * 30));
      for (let i = 0; i < n; i++) for (const s of [-1, 0, 1]) {
        const a = ((i + (s === 0 ? 0.5 : 0)) / n) * Math.PI * 2;
        parts.push(place(new THREE.BoxGeometry(w * (s ? 0.26 : 0.3), r * 0.035, r * 0.11), s * w * 0.3, Math.cos(a) * r, Math.sin(a) * r, a, 0, 0));
      }
    }
    return mergeGeometries(parts);
  });
}

/**
 * Wheel: tyre with bulging sidewalls and tread, dished rim with lip rings, hand holes, hub,
 * wheel nuts and valve. tread 'lug' = chevron lugs, otherwise a road pattern.
 * Returns a group whose userData.spin turns with the ground.
 */
export function wheel(r, w, rimHex, tread = 'road') {
  const g = new THREE.Group(), spin = new THREE.Group();
  g.add(spin);
  g.userData = { spin, r };
  if (LOD.low) {
    mk(new THREE.CylinderGeometry(r, r, w, 12), RUBBER, 0, 0, 0, spin).rotation.z = Math.PI / 2;
    mk(new THREE.CylinderGeometry(r * 0.6, r * 0.6, w + 0.02, 8), P(rimHex), 0, 0, 0, spin).rotation.z = Math.PI / 2;
    return g;
  }
  const ri = r * 0.6, rim = P(rimHex), dark = F('#2f3335');
  mk(tyreGeo(r, w, ri), RUBBER, 0, 0, 0, spin);
  mk(treadGeo(r, w, tread), RUBBER, 0, 0, 0, spin);
  // rim barrel and lips, both sides
  mk(new THREE.CylinderGeometry(ri * 0.98, ri * 0.98, w * 0.9, 24, 1, true), rim, 0, 0, 0, spin).rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) mk(new THREE.TorusGeometry(ri, Math.max(0.018, r * 0.025), 6, 28), rim, s * w * 0.44, 0, 0, spin).rotation.y = Math.PI / 2;
  // dished centre disc with hand holes, set in towards the machine (−x side is outside on the left wheels; both sides are drawn)
  const hk = Math.min(1, w / 0.6); // hub depth follows the tyre width
  for (const s of [-1, 1]) {
    const dx = s * w * 0.18;
    mk(new THREE.CylinderGeometry(ri * 0.96, ri * 0.96, 0.03, 24), rim, dx, 0, 0, spin).rotation.z = Math.PI / 2;
    const holes = r > 0.5 ? 8 : 5;
    for (let k = 0; k < holes; k++) {
      const a = (k / holes) * Math.PI * 2;
      mk(new THREE.CylinderGeometry(ri * 0.13, ri * 0.13, 0.035, 10), dark, dx + s * 0.002, Math.cos(a) * ri * 0.62, Math.sin(a) * ri * 0.62, spin).rotation.z = Math.PI / 2;
    }
    // hub, cap and nuts
    mk(new THREE.CylinderGeometry(r * 0.2, r * 0.24, 0.12 * hk, 16), rim, dx + s * 0.07 * hk, 0, 0, spin).rotation.z = Math.PI / 2;
    mk(new THREE.CylinderGeometry(r * 0.09, r * 0.13, 0.12 * hk, 12), F('#45494c'), dx + s * 0.17 * hk, 0, 0, spin).rotation.z = Math.PI / 2;
    const nuts = r > 0.6 ? 10 : 6, nr = Math.max(0.02, r * 0.03);
    for (let k = 0; k < nuts; k++) {
      const a = (k / nuts) * Math.PI * 2;
      mk(new THREE.CylinderGeometry(nr, nr, 0.06 * hk, 6), S(), dx + s * 0.14 * hk, Math.cos(a) * r * 0.17, Math.sin(a) * r * 0.17, spin).rotation.z = Math.PI / 2;
    }
  }
  // valve stem
  mk(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 5), dark, w * 0.2, ri * 0.85, 0, spin).rotation.z = Math.PI / 2;
  return g;
}

/* ---------- lamps ---------- */
/** Headlamp: dark housing, chrome bezel and a lens that glows at night. */
export function headlamp(p, x, y, z, w = 0.3, h = 0.18, ry = 0) {
  if (LOD.low) { const b = B(w + 0.06, h + 0.06, 0.08, lampMat, x, y, z, p); b.rotation.y = ry; return b; }
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.userData.static = true; p.add(g);
  RB(w + 0.08, h + 0.08, 0.1, 0.03, F('#2a2d2f'), 0, 0, -0.04, g);
  RB(w + 0.03, h + 0.03, 0.03, 0.012, CHROME, 0, 0, 0.012, g);
  RB(w, h, 0.03, 0.02, lampMat, 0, 0, 0.022, g);
  return g;
}
/** Rear lamp cluster: tail light, indicator and reflector in a housing, facing −z. */
export function tailCluster(p, x, y, z, ry = 0) {
  if (LOD.low) return B(0.34, 0.12, 0.06, tailMat, x, y, z, p);
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.userData.static = true; p.add(g);
  RB(0.36, 0.14, 0.08, 0.02, F('#2a2d2f'), 0, 0, 0.03, g);
  B(0.15, 0.1, 0.03, tailMat, -0.08, 0, -0.012, g);
  B(0.1, 0.1, 0.03, amberMat, 0.1, 0, -0.012, g);
  return g;
}
/** Square work light on a bracket, facing ry. */
export function workLight(p, x, y, z, ry = 0, tilt = 0.15) {
  if (LOD.low) return null;
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(tilt, ry, 0, 'YXZ'); g.userData.static = true; p.add(g);
  RB(0.2, 0.15, 0.1, 0.025, F('#2a2d2f'), 0, 0, 0, g);
  B(0.16, 0.11, 0.02, lampMat, 0, 0, 0.051, g);
  return g;
}
/** Amber beacon on a round base. */
export function beacon(p, x, y, z, mat) {
  if (LOD.low) { B(0.2, 0.25, 0.2, mat, x, y + 0.12, z, p); return; }
  CY(0.11, 0.13, 0.05, 12, F('#2a2d2f'), x, y + 0.025, z, p);
  CY(0.085, 0.1, 0.17, 12, mat, x, y + 0.13, z, p);
  mk(new THREE.SphereGeometry(0.085, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat, x, y + 0.215, z, p);
}

/* ---------- cab ---------- */
/** Mirrors on two-part arms, one per side; half = half cab width at the arm, facing forward. */
export function mirrors(p, half, y, z) {
  if (LOD.low) return;
  for (const sx of [-1, 1]) {
    rod([sx * half, y, z], [sx * (half + 0.36), y + 0.06, z + 0.12], 0.022, F(), p);
    rod([sx * (half + 0.36), y + 0.06, z + 0.12], [sx * (half + 0.48), y - 0.02, z + 0.16], 0.022, F(), p);
    RB(0.07, 0.44, 0.28, 0.03, F('#2a2d2f'), sx * (half + 0.5), y - 0.2, z + 0.17, p);
    B(0.02, 0.38, 0.22, M('#9fb8c0', { roughness: 0.05, metalness: 0.9, flatShading: false }), sx * (half + 0.5) - sx * 0.035, y - 0.2, z + 0.17, p);
  }
}
/** Driver's seat with armrest, steering column, dashboard, wheel, joystick console and pedals. y = cab floor. */
export function cabInside(p, y, z, w = 1.6) {
  if (LOD.low) return;
  const seat = F('#2c3033'), trim = F('#45494c');
  RB(0.54, 0.14, 0.5, 0.06, seat, 0, y + 0.48, z - 0.2, p);
  RB(0.52, 0.66, 0.13, 0.06, seat, 0, y + 0.86, z - 0.47, p).rotation.x = -0.12;
  RB(0.4, 0.15, 0.08, 0.04, seat, 0, y + 1.25, z - 0.52, p); // headrest
  CY(0.05, 0.08, 0.38, 8, trim, 0, y + 0.22, z - 0.2, p); // suspension
  RB(0.12, 0.1, 0.42, 0.04, seat, -0.33, y + 0.66, z - 0.12, p); // armrest
  RB(0.16, 0.36, 0.5, 0.04, trim, -0.48, y + 0.42, z - 0.1, p); // side console
  rod([-0.48, y + 0.6, z + 0.02], [-0.48, y + 0.76, z + 0.06], 0.022, trim, p);
  mk(new THREE.SphereGeometry(0.04, 8, 6), M('#c4473a', { roughness: 0.4, flatShading: false }), -0.48, y + 0.78, z + 0.07, p);
  for (const dx of [-0.42, -0.36]) rod([dx, y + 0.6, z - 0.18], [dx + 0.01, y + 0.7, z - 0.16], 0.012, trim, p);
  // column with the dashboard and a screen
  rod([0, y + 0.05, z + 0.62], [0, y + 0.8, z + 0.38], 0.05, trim, p);
  RB(0.5, 0.2, 0.18, 0.04, trim, 0, y + 0.8, z + 0.46, p).rotation.x = -0.5;
  B(0.2, 0.12, 0.01, M('#2e5a50', { roughness: 0.2, flatShading: false }), 0.05, y + 0.84, z + 0.4, p).rotation.x = -0.5;
  mk(new THREE.TorusGeometry(0.19, 0.022, 6, 20), seat, 0, y + 0.9, z + 0.3, p).rotation.x = Math.PI / 2 - 0.6;
  for (const dx of [-0.12, 0.12]) rod([dx, y + 0.08, z + 0.62], [dx, y + 0.3, z + 0.52], 0.012, trim, p);
  for (const dx of [-0.14, 0.14]) B(0.08, 0.02, 0.12, trim, dx, y + 0.3, z + 0.5, p);
  if (w > 1.8) RB(0.34, 0.45, 0.3, 0.05, seat, w / 2 - 0.35, y + 0.55, z - 0.35, p); // passenger seat
}
/** Thin frame bars around a glass pane centred at (x, y, z), w × h, facing ry. */
export function glassFrame(p, mat, w, h, x, y, z, ry, t = 0.045) {
  if (LOD.low) return null;
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; g.userData.static = true; p.add(g);
  B(w, t, t, mat, 0, h / 2, 0, g); B(w, t, t, mat, 0, -h / 2, 0, g);
  B(t, h, t, mat, w / 2, 0, 0, g); B(t, h, t, mat, -w / 2, 0, 0, g);
  return g;
}
/** Windscreen wiper lying on the glass: pivot at (x, y, z), arm length L at angle a from vertical. */
export function wiper(p, x, y, z, L, a, ry = 0) {
  if (LOD.low) return;
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.set(0, ry, a); g.userData.static = true; p.add(g);
  CY(0.03, 0.03, 0.04, 8, F('#202325'), 0, 0, 0, g).rotation.x = Math.PI / 2;
  B(0.025, L, 0.02, F('#202325'), 0, L / 2, 0.015, g);
  B(0.035, L * 0.8, 0.03, F('#202325'), 0.02, L * 0.55, 0.025, g);
}
/** Steps with checker plates and a grab rail, hung from a bracket at x (outer edge), stepping up from y0 to y1. */
export function steps(p, x, y0, y1, z, n, depth = 0.26, width = 0.42) {
  if (LOD.low) return;
  const s = Math.sign(x) || 1;
  for (let k = 0; k < n; k++) {
    const y = y0 + ((y1 - y0) * k) / Math.max(1, n - 1);
    B(width, 0.035, depth, F(), x - s * width / 2, y, z, p);
    decal('tread', width - 0.02, depth - 0.02, x - s * width / 2, y + 0.019, z, 0, p, Math.PI / 2);
  }
  for (const dz of [-depth / 2, depth / 2]) B(0.03, y1 - y0 + 0.1, 0.05, F(), x, (y0 + y1) / 2, z + dz, p);
}
