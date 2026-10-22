import * as THREE from 'three';
import { rng } from '../core/util.js';

/**
 * Procedural textures drawn once at start (no image files): detail for the ground, the soil of the
 * fields, the roads and the atlas of crop stalks and leaves. All tile seamlessly.
 */

/** Value noise that repeats every `period` lattice cells (so the texture tiles). */
function tileNoise(seed) {
  const h = (ix, iy) => {
    let k = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 2147483647);
    k = Math.imul(k ^ (k >>> 13), 1274126177);
    return ((k ^ (k >>> 16)) >>> 0) / 4294967296;
  };
  return (x, y, period) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, m = v => ((v % period) + period) % period;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = h(m(ix), m(iy)), b = h(m(ix + 1), m(iy)), c = h(m(ix), m(iy + 1)), d = h(m(ix + 1), m(iy + 1));
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
}
/** Fractal noise of `oct` octaves on a canvas of size px, base period p lattice cells. */
const fractal = (n, x, y, size, p, oct) => {
  let s = 0, w = 0.5, tot = 0;
  for (let o = 0; o < oct; o++) { const q = p << o; s += n((x / size) * q, (y / size) * q, q) * w; tot += w; w *= 0.5; }
  return s / tot;
};

/** Rescales arr in place to mean 0.5 and the given spread (standard deviation), clamped to 0..1. */
function stretch(arr, sd) {
  let m = 0, v = 0;
  for (const x of arr) m += x;
  m /= arr.length;
  for (const x of arr) v += (x - m) ** 2;
  const k = sd / Math.sqrt(v / arr.length || 1);
  for (let i = 0; i < arr.length; i++) arr[i] = Math.max(0, Math.min(1, 0.5 + (arr[i] - m) * k));
  return arr;
}

function canvasTex(cv, { repeat = true, srgb = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(cv);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

/**
 * Ground detail, 256 px, sampled in world space (shaders scale it):
 * R = grass (fine blades and tufts), G = soil and gravel grain, B = soft noise for large patches.
 * Each channel averages about 0.5, so the shader can multiply by (0.5 + channel) and keep the colour.
 */
export function groundDetail() {
  const S = 256, cv = makeCanvas(S, S), ctx = cv.getContext('2d'), img = ctx.createImageData(S, S), d = img.data;
  const n1 = tileNoise(1), n2 = tileNoise(2), n3 = tileNoise(3), r = rng(11);
  const grass = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) grass[y * S + x] = fractal(n1, x, y, S, 16, 4) * 0.6 + 0.2;
  // blades seen from above: short bright and dark strokes in all directions
  for (let k = 0; k < 2600; k++) {
    const x0 = r() * S, y0 = r() * S, a = r() * Math.PI * 2, L = 2 + r() * 5, v = r() < 0.55 ? 0.32 : -0.3;
    for (let t = 0; t < L; t += 0.7) {
      const x = Math.floor(x0 + Math.cos(a) * t + S) % S, y = Math.floor(y0 + Math.sin(a) * t + S) % S;
      grass[y * S + x] += v * (1 - t / L * 0.5);
    }
  }
  const grain = new Float32Array(S * S), soft = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    grain[y * S + x] = fractal(n2, x, y, S, 32, 3) + (r() - 0.5) * 0.25;
    soft[y * S + x] = fractal(n3, x, y, S, 4, 3);
  }
  stretch(grass, 0.2); stretch(grain, 0.18); stretch(soft, 0.24);
  for (let i = 0; i < S * S; i++) {
    const o = i * 4;
    d[o] = grass[i] * 255; d[o + 1] = grain[i] * 255; d[o + 2] = soft[i] * 255; d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvasTex(cv);
}

/**
 * Soil of the fields, 512 px over 4 m: R = ploughed clods (round lumps lit from one side with dark
 * gaps), G = fine crumbs of cultivated soil, B = stubble (short light straws and stalk ends).
 */
export function soilDetail() {
  const S = 512, cv = makeCanvas(S, S), ctx = cv.getContext('2d'), img = ctx.createImageData(S, S), d = img.data;
  const n = tileNoise(5), r = rng(23);
  const clod = new Float32Array(S * S).fill(0.28), crumb = new Float32Array(S * S), stub = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    crumb[y * S + x] = 0.35 + fractal(n, x, y, S, 96, 2) * 0.3 + (r() - 0.5) * 0.3;
    stub[y * S + x] = 0.45 + fractal(n, x + 77, y, S, 32, 3) * 0.15;
  }
  const wrap = v => ((v % S) + S) % S;
  // clods: lumps 4–14 px (3–11 cm), brighter on the sun side
  for (let k = 0; k < 2200; k++) {
    const cx = r() * S, cy = r() * S, rad = 4 + r() * r() * 10;
    for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
      const q = (x * x + y * y) / (rad * rad);
      if (q > 1) continue;
      const i = wrap(Math.floor(cy + y)) * S + wrap(Math.floor(cx + x));
      clod[i] = Math.max(clod[i], 0.5 + (-(x + y) / rad) * 0.22 + (1 - q) * 0.12);
    }
  }
  // stubble: short straws lying around and upright stalk ends
  for (let k = 0; k < 1800; k++) {
    const x0 = r() * S, y0 = r() * S, a = r() * Math.PI * 2, L = 6 + r() * 14;
    for (let t = 0; t < L; t += 0.6) stub[wrap(Math.floor(y0 + Math.sin(a) * t)) * S + wrap(Math.floor(x0 + Math.cos(a) * t))] = 0.85;
  }
  for (let k = 0; k < 3000; k++) { const i = wrap(Math.floor(r() * S)) * S + wrap(Math.floor(r() * S)); stub[i] = 0.95; if (i + 1 < S * S) stub[i + 1] = 0.25; }
  for (let i = 0; i < S * S; i++) {
    const o = i * 4;
    d[o] = Math.min(255, clod[i] * 255); d[o + 1] = Math.max(0, Math.min(255, crumb[i] * 255)); d[o + 2] = Math.min(255, stub[i] * 255); d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvasTex(cv);
}

/**
 * Road surfaces, across the road (u) × 12 m along it (v): asphalt with darker wheel paths and the
 * line paint in its own texture (R = edge lines, G = dashed centre line), a dirt track with two
 * packed ruts and grass in the middle, and gravel for the shoulders.
 */
export function roadTextures() {
  const W = 256, H = 512, r = rng(31), n = tileNoise(7);
  const asphalt = makeCanvas(W, H), a = asphalt.getContext('2d'), ai = a.createImageData(W, H), ad = ai.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, o = (y * W + x) * 4;
    const wheel = Math.exp(-(((u - 0.28) / 0.07) ** 2)) + Math.exp(-(((u - 0.72) / 0.07) ** 2));
    let v = 78 + (fractal(n, x, y, W, 8, 3) - 0.5) * 22 + (r() - 0.5) * 26 - wheel * 7;
    if (r() < 0.025) v += 40; // light aggregate
    ad[o] = v; ad[o + 1] = v + 1; ad[o + 2] = v + 4; ad[o + 3] = 255;
  }
  a.putImageData(ai, 0, 0);
  // repaired patches and cracks
  a.fillStyle = 'rgba(30,32,34,0.12)';
  for (let k = 0; k < 2; k++) a.fillRect(r() * W * 0.7, r() * H, 30 + r() * 50, 20 + r() * 60);
  a.strokeStyle = 'rgba(20,20,22,0.5)'; a.lineWidth = 1;
  for (let k = 0; k < 10; k++) { a.beginPath(); let x = r() * W, y = r() * H; a.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (r() - 0.5) * 14; y += r() * 10; a.lineTo(x, y); } a.stroke(); }

  const lines = makeCanvas(64, H), l = lines.getContext('2d');
  l.fillStyle = '#000'; l.fillRect(0, 0, 64, H);
  l.fillStyle = '#f00'; l.fillRect(2, 0, 2, H); l.fillRect(60, 0, 2, H); // edge lines (0.12 m of an 8 m road)
  l.fillStyle = '#0f0'; l.fillRect(30, 0, 3, H * 0.25); // centre dashes: 3 m paint, 9 m gap
  const linesTex = canvasTex(lines, { aniso: 8 }); linesTex.generateMipmaps = true;

  const dirt = makeCanvas(W, H), dc = dirt.getContext('2d'), di = dc.createImageData(W, H), dd = di.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, o = (y * W + x) * 4, nn = fractal(n, x + 31, y, W, 8, 3), grain = (r() - 0.5) * 30;
    const rut = Math.exp(-(((u - 0.27) / 0.09) ** 2)) + Math.exp(-(((u - 0.73) / 0.09) ** 2));
    const grassK = Math.min(1, Math.max(0, (1 - rut * 1.6) * (0.55 + nn * 0.9) - 0.15 + Math.max(0, Math.abs(u - 0.5) - 0.4) * 6));
    const soil = [150 + grain, 126 + grain, 92 + grain * 0.8].map(c => c - rut * 18);
    const grass = [108 + grain * 0.6, 132 + grain * 0.6, 70 + grain * 0.5];
    for (let c = 0; c < 3; c++) dd[o + c] = soil[c] + (grass[c] - soil[c]) * grassK;
    if (r() < 0.02) { dd[o] += 50; dd[o + 1] += 45; dd[o + 2] += 40; } // pebbles
    dd[o + 3] = 255;
  }
  dc.putImageData(di, 0, 0);

  const gravel = makeCanvas(128, 128), gc = gravel.getContext('2d'), gi = gc.createImageData(128, 128), gd = gi.data;
  for (let i = 0; i < 128 * 128; i++) {
    const v = (r() - 0.5) * 60, o = i * 4;
    gd[o] = 176 + v; gd[o + 1] = 164 + v; gd[o + 2] = 140 + v * 0.9; gd[o + 3] = 255;
  }
  gc.putImageData(gi, 0, 0);
  return { asphalt: canvasTex(asphalt, { srgb: true }), lines: linesTex, dirt: canvasTex(dirt, { srgb: true }), gravel: canvasTex(gravel, { srgb: true }) };
}

/**
 * Crop atlas, 3 × 2 tiles of 256 px: cereal stalks with ears, rapeseed, maize, sunflower, beet
 * leaves, meadow grass. White-ish on transparent: the crop's stage colour tints it. The picture
 * stands on the bottom edge of the tile and reaches its top at the crop's full height.
 */
export const CROP_TILE = { cereal: 0, rape: 1, corn: 2, sunflower: 3, beet: 4, grass: 5 };
export function cropAtlas() {
  const T = 256, cv = makeCanvas(T * 3, T * 2), c = cv.getContext('2d'), r = rng(47);
  const shade = (k) => { const v = Math.round(200 + k * 55); return 'rgb(' + v + ',' + v + ',' + v + ')'; };
  const tile = (i, fn) => { c.save(); c.translate((i % 3) * T, Math.floor(i / 3) * T); c.beginPath(); c.rect(0, 0, T, T); c.clip(); fn(); c.restore(); };
  const stalk = (x, top, w, k) => { c.strokeStyle = shade(k); c.lineWidth = w; c.beginPath(); c.moveTo(x, T); c.quadraticCurveTo(x + (r() - 0.5) * 10, (T + top) / 2, x + (r() - 0.5) * 12, top); c.stroke(); };
  const leaf = (x, y, len, ang, wid, k) => {
    c.fillStyle = shade(k); c.beginPath(); c.moveTo(x, y);
    const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len, nx = -Math.sin(ang) * wid, ny = Math.cos(ang) * wid;
    c.quadraticCurveTo((x + ex) / 2 + nx, (y + ey) / 2 + ny - len * 0.15, ex, ey);
    c.quadraticCurveTo((x + ex) / 2 - nx * 0.3, (y + ey) / 2 - ny * 0.3 - len * 0.1, x, y); c.fill();
  };
  tile(CROP_TILE.cereal, () => {
    for (let k = 0; k < 46; k++) {
      const x = 4 + r() * (T - 8), top = 6 + r() * 40, kk = r() * 0.6 - 0.4;
      stalk(x, top + 30, 2.2, kk);
      c.fillStyle = shade(kk + 0.4); // the ear
      c.beginPath(); c.ellipse(x + (r() - 0.5) * 6, top + 16, 3.2, 15, (r() - 0.5) * 0.3, 0, Math.PI * 2); c.fill();
      if (r() < 0.6) leaf(x, T - 40 - r() * 80, 26 + r() * 20, -Math.PI / 2 + (r() < 0.5 ? -1 : 1) * (0.7 + r() * 0.5), 3, kk - 0.2);
    }
  });
  tile(CROP_TILE.rape, () => {
    for (let k = 0; k < 26; k++) {
      const x = 6 + r() * (T - 12), top = 8 + r() * 50, kk = r() * 0.6 - 0.4;
      stalk(x, top, 2.5, kk);
      for (let b = 0; b < 4; b++) { const by = top + 10 + b * 24; c.strokeStyle = shade(kk); c.lineWidth = 1.6; c.beginPath(); c.moveTo(x, by); c.lineTo(x + (r() - 0.5) * 40, by - 12); c.stroke(); }
      for (let b = 0; b < 12; b++) { c.fillStyle = shade(0.3 + r() * 0.7); c.beginPath(); c.arc(x + (r() - 0.5) * 30, top + r() * 26, 3 + r() * 2.5, 0, 7); c.fill(); }
      for (let b = 0; b < 3; b++) leaf(x, T - 30 - r() * 100, 30 + r() * 20, -Math.PI / 2 + (r() - 0.5) * 2.4, 9, kk - 0.2);
    }
  });
  tile(CROP_TILE.corn, () => {
    for (let k = 0; k < 9; k++) {
      const x = 14 + k * 28 + (r() - 0.5) * 10, top = 4 + r() * 18, kk = r() * 0.6 - 0.4;
      stalk(x, top + 20, 6, kk);
      c.strokeStyle = shade(kk + 0.3); c.lineWidth = 2; // tassel
      for (let b = 0; b < 5; b++) { c.beginPath(); c.moveTo(x, top + 22); c.lineTo(x + (r() - 0.5) * 22, top); c.stroke(); }
      for (let b = 0; b < 7; b++) { const y = top + 50 + b * 26; leaf(x, y, 50 + r() * 30, (b % 2 ? -0.5 : Math.PI + 0.5) + (r() - 0.5) * 0.6, 7, kk - 0.1); }
      if (r() < 0.8) { c.fillStyle = shade(0.2); c.beginPath(); c.ellipse(x + 6, T * 0.55, 6, 18, 0.3, 0, 7); c.fill(); } // cob
    }
  });
  tile(CROP_TILE.sunflower, () => {
    for (let k = 0; k < 6; k++) {
      const x = 22 + k * 42 + (r() - 0.5) * 12, top = 12 + r() * 26, kk = r() * 0.5 - 0.3;
      stalk(x, top + 16, 6, kk);
      for (let b = 0; b < 5; b++) leaf(x, top + 60 + b * 36, 34 + r() * 14, (b % 2 ? -0.3 : Math.PI + 0.3) + (r() - 0.5) * 0.5, 16, kk - 0.1);
      c.fillStyle = shade(0.45); c.beginPath(); c.ellipse(x, top + 14, 22, 16, (r() - 0.5) * 0.6, 0, 7); c.fill(); // head
      c.fillStyle = shade(-0.75); c.beginPath(); c.ellipse(x, top + 15, 12, 9, 0, 0, 7); c.fill();
    }
  });
  tile(CROP_TILE.beet, () => {
    for (let k = 0; k < 14; k++) {
      const x = 10 + r() * (T - 20), kk = r() * 0.6 - 0.3;
      for (let b = 0; b < 7; b++) leaf(x, T - 2, 70 + r() * 110, -Math.PI / 2 + (r() - 0.5) * 2.2, 22 + r() * 10, kk + (r() - 0.5) * 0.2);
    }
  });
  tile(CROP_TILE.grass, () => {
    for (let k = 0; k < 260; k++) {
      const x = r() * T, len = 70 + r() * 180, kk = r() * 0.7 - 0.45, bend = (r() - 0.5) * 40;
      c.strokeStyle = shade(kk); c.lineWidth = 1.5 + r() * 1.5; c.beginPath(); c.moveTo(x, T); c.quadraticCurveTo(x + bend * 0.3, T - len * 0.5, x + bend, T - len); c.stroke();
    }
  });
  const t = canvasTex(cv, { repeat: false, srgb: true, aniso: 4 });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
