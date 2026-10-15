import * as THREE from 'three';
import { renderer, scene } from '../render/core.js';
import { M, CY, flatPlane, bake } from '../render/materials.js';
import { hash2, fmt, fmt2 } from '../core/util.js';
import { CROPS, SOIL, SOIL_PLOW, STRAW, S_STUB, S_CULT, S_SOWN, S_RIPE, B_FERT, B_PLOW } from '../game/crops.js';
import { FIELD_DEFS, circles } from './layout.js';
import { G } from '../game/state.js';

const CP = 4; // canvas pixels per field cell
const cropGeo = new THREE.BoxGeometry(1, 1, 1); cropGeo.translate(0, 0.5, 0);
const cropMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
const _m = new THREE.Matrix4(), _c = new THREE.Color();
export const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Each field is a grid of 1 m cells. Per cell we keep state, crop, growth (game hours),
 * visual stage, work direction, bonus bits (fertilised / ploughed) and a straw windrow flag. The soil is a canvas texture (row lines follow the
 * direction the tool drove), the crop is one instanced box per cell.
 */
export const FIELDS = FIELD_DEFS.map(def => {
  const f = { ...def };
  f.n = f.w * f.h;
  f.state = new Uint8Array(f.n); f.crop = new Uint8Array(f.n); f.growth = new Float32Array(f.n);
  f.stage = new Uint8Array(f.n); f.dir = new Uint8Array(f.n); f.jit = new Float32Array(f.n);
  f.bonus = new Uint8Array(f.n); f.straw = new Uint8Array(f.n);
  for (let i = 0; i < f.n; i++) f.jit[i] = hash2((i % f.w) + f.id * 1000, ((i / f.w) | 0) * 1.37);
  f.cnt = [0, 0, 0, 0]; f.prog = 0; f.strawCnt = 0; f.fertShare = 0;

  f.canvas = document.createElement('canvas'); f.canvas.width = f.w * CP; f.canvas.height = f.h * CP;
  f.ctx = f.canvas.getContext('2d');
  f.tex = new THREE.CanvasTexture(f.canvas);
  f.tex.colorSpace = THREE.SRGBColorSpace;
  f.tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const border = new THREE.Group();
  flatPlane(f.w + 1.4, f.h + 1.4, '#86a654', f.x0 + f.w / 2, 0.012, f.z0 + f.h / 2, border);
  scene.add(border);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(f.w, f.h), new THREE.MeshStandardMaterial({ map: f.tex, roughness: 1 }));
  plane.rotation.x = -Math.PI / 2; plane.position.set(f.x0 + f.w / 2, 0.03, f.z0 + f.h / 2); plane.receiveShadow = true;
  scene.add(plane);

  f.mini = document.createElement('canvas'); f.mini.width = f.w; f.mini.height = f.h;
  f.miniCtx = f.mini.getContext('2d'); f.miniImg = f.miniCtx.createImageData(f.w, f.h);

  f.crops = new THREE.InstancedMesh(cropGeo, cropMat, f.n);
  f.crops.castShadow = true; f.crops.receiveShadow = true; f.crops.frustumCulled = false;
  for (let i = 0; i < f.n; i++) { f.crops.setMatrixAt(i, ZERO); f.crops.setColorAt(i, _c.set(0xffffff)); }
  scene.add(f.crops);
  return f;
});

export function fieldAt(x, z) {
  for (const f of FIELDS) if (x >= f.x0 && x < f.x0 + f.w && z >= f.z0 && z < f.z0 + f.h) return f;
  return null;
}

export function drawCell(f, i) {
  const ix = i % f.w, iz = (i / f.w) | 0, px = ix * CP, py = iz * CP, s = f.state[i], j = f.jit[i];
  const v = Math.floor(j * 3.999), ctx = f.ctx, along = f.dir[i] === 0;
  if (f.straw[i]) {
    // straw windrow left by the combine
    ctx.fillStyle = STRAW.base; ctx.fillRect(px, py, CP, CP);
    ctx.fillStyle = STRAW.line;
    if (along) ctx.fillRect(px + 1 + (v & 1), py, 1, CP); else ctx.fillRect(px, py + 1 + (v & 1), CP, 1);
    f.texDirty = true;
    return;
  }
  const plowed = s === S_CULT && f.bonus[i] & B_PLOW;
  const pal = plowed ? SOIL_PLOW : SOIL[s];
  ctx.fillStyle = pal.base[v]; ctx.fillRect(px, py, CP, CP);
  ctx.fillStyle = pal.line[v];
  if (plowed) { // deep double furrows
    if (along) { ctx.fillRect(px, py, 1, CP); ctx.fillRect(px + 2, py, 1, CP); } else { ctx.fillRect(px, py, CP, 1); ctx.fillRect(px, py + 2, CP, 1); }
  } else if (along) ctx.fillRect(px + 2, py, 1, CP); else ctx.fillRect(px, py + 2, CP, 1);
  if (s === S_STUB && j > 0.45) { ctx.fillStyle = '#ecdcab'; ctx.fillRect(px + ((j * 13) | 0) % 4, py + ((j * 29) | 0) % 4, 1, 1); }
  if (f.bonus[i] & B_FERT && j < 0.6) { // a few fertiliser granules
    ctx.fillStyle = s === S_STUB ? '#cfc6ad' : '#a58e78';
    ctx.fillRect(px + ((j * 7) | 0) % 4, py + ((j * 17) | 0) % 4, 1, 1);
  }
  f.texDirty = true;
}

export function drawMini(f, i) {
  const s = f.state[i];
  let rgb;
  if (s === S_RIPE) rgb = CROPS[f.crop[i]].rgb[4];
  else if (s === S_SOWN && f.stage[i] > 0) rgb = CROPS[f.crop[i]].rgb[f.stage[i]];
  else if (f.straw[i]) rgb = STRAW.rgb;
  else if (s === S_CULT && f.bonus[i] & B_PLOW) rgb = SOIL_PLOW.rgb;
  else rgb = SOIL[s].rgb;
  const d = f.miniImg.data, o = i * 4;
  d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255;
  f.miniDirty = true;
}

export function updCrop(f, i) {
  const s = f.state[i];
  const st = s === S_RIPE ? 4 : s === S_SOWN ? f.stage[i] : 0;
  f.cropDirty = true;
  if (st === 0) { f.crops.setMatrixAt(i, ZERO); return; }
  const cr = CROPS[f.crop[i]], j = f.jit[i];
  const row = (f.dir[i] === 0 ? i % f.w : (i / f.w) | 0) & 1;
  const hgt = cr.h[st] * (0.95 + j * 0.08 + row * 0.03), fw = cr.fw[st];
  const sx = f.dir[i] === 0 ? fw : 1, sz = f.dir[i] === 0 ? 1 : fw;
  _m.makeScale(sx, hgt, sz);
  _m.setPosition(f.x0 + (i % f.w) + 0.5, 0.03, f.z0 + ((i / f.w) | 0) + 0.5);
  f.crops.setMatrixAt(i, _m);
  _c.copy(cr.cols[st]).multiplyScalar(0.95 + j * 0.06 + row * 0.05);
  f.crops.setColorAt(i, _c);
}

export function refreshField(f) { for (let i = 0; i < f.n; i++) { drawCell(f, i); updCrop(f, i); drawMini(f, i); } }

/** Uploads changed textures and instance buffers once per frame. */
export function flushFields() {
  for (const f of FIELDS) {
    if (f.texDirty) { f.tex.needsUpdate = true; f.texDirty = false; }
    if (f.cropDirty) {
      f.crops.instanceMatrix.needsUpdate = true;
      if (f.crops.instanceColor) f.crops.instanceColor.needsUpdate = true;
      f.cropDirty = false;
    }
  }
}

/** Advances growth of every sown cell by dh game hours. */
export function growFields(dh) {
  if (dh <= 0) return;
  for (const f of FIELDS) {
    const st = f.state, gr = f.growth;
    for (let i = 0; i < f.n; i++) {
      if (st[i] !== S_SOWN) continue;
      const cr = CROPS[f.crop[i]], g = (gr[i] += dh);
      if (g >= cr.hours) { st[i] = S_RIPE; f.stage[i] = 4; updCrop(f, i); drawMini(f, i); }
      else {
        const s = Math.min(3, Math.floor((g / cr.hours) * 4));
        if (s !== f.stage[i]) { f.stage[i] = s; updCrop(f, i); drawMini(f, i); }
      }
    }
  }
}

export function countFields() {
  for (const f of FIELDS) {
    const c = [0, 0, 0, 0];
    let pg = 0, straw = 0, fert = 0, ripeBeet = 0;
    for (let i = 0; i < f.n; i++) {
      const s = f.state[i]; c[s]++;
      if (s === S_SOWN) pg += f.growth[i] / CROPS[f.crop[i]].hours;
      if (f.straw[i]) straw++;
      if (f.bonus[i] & B_FERT) fert++;
      if (s === S_RIPE && CROPS[f.crop[i]].header === 'beet') ripeBeet++;
    }
    f.cnt = c; f.prog = c[2] ? pg / c[2] : 0;
    f.strawCnt = straw; f.fertShare = fert / f.n; f.ripeBeet = ripeBeet;
  }
}

export function setCropShadows(on) { for (const f of FIELDS) f.crops.castShadow = on; }

/* ---------- field signs ---------- */
export const signs = FIELDS.map(f => {
  const [x, z, ry] = f.sign;
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  CY(0.07, 0.07, 2.4, 6, '#7a6250', -1.1, 1.2, 0, g); CY(0.07, 0.07, 2.4, 6, '#7a6250', 1.1, 1.2, 0, g);
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), side = M('#e9dfc8');
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.4, 0.12), [side, side, side, side, face, side]);
  board.position.y = 2.0; board.castShadow = true; g.add(board);
  bake(g);
  circles.push({ x, z, r: 0.6 });
  return { f, x, z, cv, tex };
});

export function drawSign(s) {
  const c = s.cv.getContext('2d'), f = s.f;
  c.fillStyle = f.owned ? '#f4ecd8' : '#f3d27a'; c.fillRect(0, 0, 512, 256);
  c.strokeStyle = 'rgba(36,49,42,.35)'; c.lineWidth = 8; c.strokeRect(10, 10, 492, 236);
  c.fillStyle = '#24312a'; c.font = '800 92px "Bricolage Grotesque", "Trebuchet MS", sans-serif'; c.textBaseline = 'alphabetic';
  c.fillText('Pole ' + f.id, 34, 112);
  c.font = '600 40px Figtree, "Segoe UI", sans-serif';
  const ha = fmt2((f.w * f.h) / 10000) + ' ha';
  c.fillText(f.owned ? 'Tvoje pole · ' + ha : 'Na prodej · ' + ha, 34, 168);
  const job = G.contracts?.active?.field === f.id;
  if (job) { c.fillStyle = '#4d8a5d'; c.font = '700 40px Figtree, "Segoe UI", sans-serif'; c.fillText('Tvoje zakázka', 34, 220); }
  else if (!f.owned) { c.font = '700 42px Figtree, "Segoe UI", sans-serif'; c.fillText(fmt(f.price) + ' Kč', 34, 220); }
  s.tex.needsUpdate = true;
}
export const drawSigns = () => signs.forEach(drawSign);
