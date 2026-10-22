import * as THREE from 'three';
import { renderer, scene } from '../render/core.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { M, CY, flatPlane, bake } from '../render/materials.js';
import { hash2, fmt, fmt2 } from '../core/util.js';
import { CROPS, SOIL, SOIL_PLOW, STRAW, GRASS, HAY, S_STUB, S_CULT, S_SOWN, S_RIPE, S_NONE, B_FERT, B_PLOW } from '../game/crops.js';
import { FIELD_DEFS, ROADS, circles, inPoly, polyDist, roadAt } from './layout.js';
import { levelOf, groundH } from './terrain.js';
import { G } from '../game/state.js';
import { addWind } from '../render/wind.js';
import { FIELD_PER_HA, MEADOW_PER_HA } from '../game/balance.js';
import { addSnow } from '../render/snow.js';
import { soilDetail, cropAtlas, CROP_TILE } from '../render/textures.js';

const CP = 4; // canvas pixels per field cell
// crop block without its bottom face (never visible): 10 triangles instead of 12
const cropGeo = (() => {
  const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0);
  const idx = Array.from(g.index.array), bottom = g.groups[3];
  idx.splice(bottom.start, bottom.count);
  g.setIndex(idx); g.clearGroups();
  return g;
})();
/**
 * Crop cards: n upright planes crossing at the cell centre, 1 m wide and 1 m tall (the instance scales
 * them), showing a picture from the crop atlas. Their normals point up, so the crop is lit like a
 * canopy whichever way a card faces.
 */
function cardGeo(n) {
  const parts = [];
  for (let k = 0; k < n; k++) {
    const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0); g.rotateY((k * Math.PI) / n + 0.3);
    const nr = g.attributes.normal; for (let i = 0; i < nr.count; i++) nr.setXYZ(i, 0, 1, 0);
    parts.push(g);
  }
  return mergeGeometries(parts);
}
const cardGeos = { 2: cardGeo(2), 3: cardGeo(3), 4: cardGeo(4) };
// crops sway in the wind: waves roll across the field
const cropMat = addWind(new THREE.MeshLambertMaterial({ color: 0xffffff }), { amp: 0.14, base: 0.2, spatial: 0.16 });
const ATLAS = cropAtlas();
/** Atlas tile of each instance (aTile) → its part of the texture; a little inset so tiles do not bleed. */
const TILE_UV = `
  #ifdef USE_MAP
    vMapUv = vec2(0.006 + vMapUv.x * 0.988, vMapUv.y * 0.99) * vec2(1.0 / 3.0, 0.5) + vec2(mod(aTile, 3.0) / 3.0, (1.0 - floor(aTile / 3.0)) * 0.5);
  #endif`;
function tiled(m, key) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aTile;').replace('#include <uv_vertex>', '#include <uv_vertex>' + TILE_UV);
    // both sides of a card are lit as the top of the canopy (no flipped normal on the back)
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n#ifdef DOUBLE_SIDED\nnormal *= faceDirection; nonPerturbedNormal = normal;\n#endif');
  };
  m.customProgramCacheKey = () => key;
  return m;
}
const cardMat = addWind(tiled(new THREE.MeshLambertMaterial({ color: new THREE.Color(1.3, 1.3, 1.3), map: ATLAS, alphaTest: 0.42, side: THREE.DoubleSide }), 'cards'), { amp: 0.14, base: 0.2, spatial: 0.16 });
const cardDepth = tiled(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: ATLAS, alphaTest: 0.42, side: THREE.DoubleSide }), 'cardsDepth');
/** Atlas tile of every crop, and of meadow grass. */
const TILE_OF = CROPS.map(c => CROP_TILE[c.tile] ?? 0), GRASS_TILE = CROP_TILE.grass;
/** How crops are drawn: 0 = blocks, 2–4 = crossing cards near the camera (see setCropStyle and updFieldLOD). */
let cropCards = 3;
/** The geometry for a chunk: a shared shape (base) plus the chunk's own atlas tile per instance. */
function chunkGeo(ch, base) {
  const g = new THREE.BufferGeometry();
  for (const [k, a] of Object.entries(base.attributes)) g.setAttribute(k, a);
  if (base.index) g.setIndex(base.index);
  g.setAttribute('aTile', ch.tile);
  return g;
}

/** Fine soil detail for the field planes (clods, crumbs, stubble). */
const SOIL_TEX = { value: soilDetail() };
/**
 * Surface kind of a cell for the soil detail, stored ×40 in each field's kind map:
 * 0 crop on top, 1 stubble, 2 cultivated or freshly sown, 3 ploughed, 4 meadow grass, 5 windrow.
 */
const K_CROP = 0, K_STUB = 1, K_CULT = 2, K_PLOW = 3, K_GRASS = 4, K_ROW = 5;
/**
 * The field plane's material: its painted canvas plus soil detail in world space chosen by the kind
 * map, and a ragged edge where the field meets the grass border (rectangular fields).
 */
function fieldMat(f) {
  const m = new THREE.MeshStandardMaterial({ map: f.tex, roughness: 1, alphaTest: f.poly ? 0.5 : 0 });
  const kind = { value: f.kindTex }, size = { value: new THREE.Vector2(f.w, f.h) }, ragged = { value: f.poly ? 0 : 1 };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { tKind: kind, tSoil: SOIL_TEX, uSize: size, uRagged: ragged });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tKind; uniform sampler2D tSoil; uniform vec2 uSize; uniform float uRagged; varying vec3 vFPos;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec2 fuv = vec2(vMapUv.x, 1.0 - vMapUv.y);
          float kind = floor(texture2D(tKind, fuv).r * 6.375 + 0.5);
          vec4 sd = texture2D(tSoil, vFPos.xz * 0.25), sd2 = texture2D(tSoil, vFPos.xz * 0.061 + 0.3);
          float k = 0.5 + (sd.g - 0.5) * 0.5, amp = 0.6;
          if (kind == 1.0) { k = sd.b * 0.7 + sd2.g * 0.3; amp = 0.95; }
          else if (kind == 2.0) { k = sd.g * 0.65 + sd2.g * 0.35; amp = 1.1; }
          else if (kind == 3.0) { k = sd.r * 0.75 + sd2.r * 0.25; amp = 1.5; }
          else if (kind == 4.0 || kind == 5.0) { k = sd.g * 0.5 + sd2.b * 0.5; amp = 0.8; }
          diffuseColor.rgb *= clamp(1.0 + (k - 0.5) * amp, 0.4, 1.6);
          // ragged edge: the border grass shows through in a noisy band of up to half a metre
          vec2 cell = fuv * uSize;
          float edge = min(min(cell.x, uSize.x - cell.x), min(cell.y, uSize.y - cell.y));
          if (uRagged > 0.5 && edge < 0.55 && sd2.g * 0.75 + sd.g * 0.25 > edge * 1.6 + 0.12) discard;
        }`);
  };
  m.customProgramCacheKey = () => 'fieldsoil';
  return addSnow(m);
}
const _m = new THREE.Matrix4(), _s = new THREE.Matrix4(), _c = new THREE.Color();
export const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
/** Crops are drawn in square chunks of CHUNK cells; chunks far from the camera are hidden (see updFieldLOD). */
const CHUNK = 64;
const PRICE_PER_HA = FIELD_PER_HA;
/** Visual stage of regrowing meadow grass from its growth hours. */
const grassStage = g => Math.min(3, Math.floor((g / GRASS.hours) * 4));

/** Sale sign for a new field: by the edge nearest to a road, facing it. */
function autoSign(f) {
  const cx = f.x0 + f.w / 2, cz = f.z0 + f.h / 2;
  // 4.5 m out, clear of machines turning on the headland
  const edges = [[f.x0 + f.w + 4.5, cz, Math.PI / 2], [f.x0 - 4.5, cz, -Math.PI / 2], [cx, f.z0 + f.h + 4.5, 0], [cx, f.z0 - 4.5, Math.PI]];
  let best = edges[0], bd = Infinity;
  for (const e of edges) { const d = Math.min(...ROADS.map(r => polyDist(e[0], e[1], r.pts))); if (d < bd) { bd = d; best = e; } }
  return best;
}

/**
 * Each field is a grid of 1 m cells. Per cell we keep state, crop, growth (game hours),
 * visual stage, work direction, bonus bits (fertilised / ploughed) and a straw windrow flag. The soil is a canvas texture (row lines follow the
 * direction the tool drove, crops paint their colour so far fields look right), the crop is one instanced box per cell,
 * in chunks. Fields with an outline (poly) have S_NONE cells outside it; f.area counts the real cells.
 * f.y = the field's terrace height.
 */
// grass borders of all fields, merged into one mesh after the fields are built
const borders = new THREE.Group();
export const FIELDS = FIELD_DEFS.map(def => {
  const f = { ...def, ownedStart: def.owned ?? false, q: def.q ?? 1 };
  f.n = f.w * f.h;
  f.y = levelOf(def);
  f.state = new Uint8Array(f.n); f.crop = new Uint8Array(f.n); f.growth = new Float32Array(f.n);
  f.stage = new Uint8Array(f.n); f.dir = new Uint8Array(f.n); f.jit = new Float32Array(f.n);
  f.bonus = new Uint8Array(f.n); f.straw = new Uint8Array(f.n);
  // wheel ruts: track = 1 + orientation * 4 + offset in pixels, trackS = state + 1 when it was made
  // (a rut disappears as soon as a tool works the cell); not saved
  f.track = new Uint8Array(f.n); f.trackS = new Uint8Array(f.n);
  for (let i = 0; i < f.n; i++) f.jit[i] = hash2((i % f.w) + f.id * 1000, ((i / f.w) | 0) * 1.37);
  f.mask = null; f.area = f.n;
  if (f.poly) {
    f.mask = new Uint8Array(f.n);
    for (let i = 0; i < f.n; i++) f.mask[i] = inPoly(f.x0 + (i % f.w) + 0.5, f.z0 + ((i / f.w) | 0) + 0.5, f.poly) ? 1 : 0;
    f.area = f.mask.reduce((a, b) => a + b, 0);
  }
  f.meadow = !!def.meadow;
  f.price = def.price ?? Math.round(((f.area / 10000) * (f.meadow ? MEADOW_PER_HA : PRICE_PER_HA) * f.q) / 10000) * 10000;
  f.sign = def.sign || autoSign(f);
  f.cnt = [0, 0, 0, 0]; f.prog = 0; f.strawCnt = 0; f.fertShare = 0;

  f.canvas = document.createElement('canvas'); f.canvas.width = f.w * CP; f.canvas.height = f.h * CP;
  f.ctx = f.canvas.getContext('2d');
  f.tex = new THREE.CanvasTexture(f.canvas);
  f.tex.colorSpace = THREE.SRGBColorSpace;
  f.tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  f.upT = 0;
  f.kind = new Uint8Array(f.n);
  f.kindTex = new THREE.DataTexture(f.kind, f.w, f.h, THREE.RedFormat, THREE.UnsignedByteType);
  f.kindTex.needsUpdate = true;

  if (!f.poly) flatPlane(f.w + 1.4, f.h + 1.4, '#647f3c', f.x0 + f.w / 2, f.y + 0.012, f.z0 + f.h / 2, borders);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(f.w, f.h), fieldMat(f));
  plane.rotation.x = -Math.PI / 2; plane.position.set(f.x0 + f.w / 2, f.y + 0.03, f.z0 + f.h / 2); plane.receiveShadow = true;
  scene.add(plane);
  f.plane = plane;

  f.mini = document.createElement('canvas'); f.mini.width = f.w; f.mini.height = f.h;
  f.miniCtx = f.mini.getContext('2d'); f.miniImg = f.miniCtx.createImageData(f.w, f.h);

  // crop chunks
  f.chunks = [];
  f.cpr = Math.ceil(f.w / CHUNK); // chunks per row
  for (let cz = 0; cz < f.h; cz += CHUNK) {
    for (let cx = 0; cx < f.w; cx += CHUNK) {
      const cw = Math.min(CHUNK, f.w - cx), chh = Math.min(CHUNK, f.h - cz);
      const tile = new THREE.InstancedBufferAttribute(new Float32Array(cw * chh), 1);
      const mesh = new THREE.InstancedMesh(cropGeo, cropMat, cw * chh);
      mesh.castShadow = true; mesh.receiveShadow = true;
      // fixed bounds so chunks off screen (and outside the shadow area) are skipped entirely
      const x0 = f.x0 + cx, z0 = f.z0 + cz;
      mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(x0 + cw / 2, f.y + 1, z0 + chh / 2), Math.hypot(cw, chh) / 2 + 3);
      for (let k = 0; k < cw * chh; k++) { mesh.setMatrixAt(k, ZERO); mesh.setColorAt(k, _c.set(0xffffff)); }
      scene.add(mesh);
      // on = which cells show a crop, filled = how many: empty chunks (stubble, ploughed land) are not drawn at all
      f.chunks.push({ mesh, tile, cx, cz, cw, x0, z0, x1: x0 + cw, z1: z0 + chh, dirty: false, on: new Uint8Array(cw * chh), filled: 0 });
    }
  }
  return f;
});

scene.add(bake(borders));

/** Chunk and instance index of cell i. */
function chunkOf(f, i) {
  const ix = i % f.w, iz = (i / f.w) | 0;
  const ch = f.chunks[((iz / CHUNK) | 0) * f.cpr + ((ix / CHUNK) | 0)];
  return [ch, (iz - ch.cz) * ch.cw + (ix - ch.cx)];
}

/**
 * Hides crop chunks further than dist metres from (x, z) (the painted ground stands in for them), and far
 * signs. Chunks closer than cardDist show the crossing cards, further ones the cheaper solid blocks
 * (cut-out cards far away cost a lot of overdraw and look the same as blocks from there).
 */
export function updFieldLOD(x, z, dist, cardDist = 90) {
  for (const s of signs) s.g.visible = Math.hypot(s.x - x, s.z - z) < 100;
  for (const f of FIELDS) {
    for (const ch of f.chunks) {
      const d = Math.hypot(Math.max(0, ch.x0 - x, x - ch.x1), Math.max(0, ch.z0 - z, z - ch.z1));
      ch.mesh.visible = d < dist && ch.filled > 0;
      const cards = cropCards > 0 && d < cardDist + (ch.cards ? 6 : 0);
      if (cards !== ch.cards && ch.boxGeo) {
        ch.cards = cards;
        ch.mesh.geometry = cards ? ch.cardGeo : ch.boxGeo;
        ch.mesh.material = cards ? cardMat : cropMat;
        ch.mesh.customDepthMaterial = cards ? cardDepth : undefined;
      }
    }
  }
}

/** Puts a field into its new-game state from FIELD_DEFS.start. */
export function applyStart(f) {
  const st = f.start || { s: 'stub' };
  const S = { stub: S_STUB, cult: S_CULT, sown: S_SOWN, ripe: S_RIPE }[st.s] ?? S_STUB;
  f.state.fill(S); f.crop.fill(st.crop || 0); f.growth.fill(0); f.stage.fill(S === S_RIPE ? 4 : 0);
  f.dir.fill(st.dir || 0); f.bonus.fill(0); f.straw.fill(0); f.track.fill(0);
  if (S === S_SOWN) {
    const hours = CROPS[st.crop || 0].hours;
    for (let i = 0; i < f.n; i++) { f.growth[i] = (st.growth || 0) + f.jit[i] * 0.4; f.stage[i] = Math.min(3, Math.floor((f.growth[i] / hours) * 4)); }
  }
  applyMask(f);
  f.owned = f.ownedStart;
}
/** Cells outside the outline are never part of the field. */
export function applyMask(f) {
  if (f.mask) for (let i = 0; i < f.n; i++) if (!f.mask[i]) { f.state[i] = S_NONE; f.stage[i] = 0; f.straw[i] = 0; f.bonus[i] = 0; }
}

export function fieldAt(x, z) {
  for (const f of FIELDS) if (x >= f.x0 && x < f.x0 + f.w && z >= f.z0 && z < f.z0 + f.h) return f;
  return null;
}

/** CSS colours of the crops' growth stages, darkened, for painting the ground under them. */
const cropCss = CROPS.map(c => c.colors.map(hex => '#' + _c.set(hex).multiplyScalar(0.72).getHexString()));
const cropLine = CROPS.map(c => c.colors.map(hex => '#' + _c.set(hex).multiplyScalar(0.55).getHexString()));

export function drawCell(f, i) {
  const ix = i % f.w, iz = (i / f.w) | 0, px = ix * CP, py = iz * CP, s = f.state[i], j = f.jit[i];
  const v = Math.floor(j * 3.999), ctx = f.ctx, along = f.dir[i] === 0;
  f.texDirty = true;
  if (s === S_NONE) { ctx.clearRect(px, py, CP, CP); return; }
  if (f.meadow) {
    // grass, or the hay swath the mower left
    ctx.fillStyle = f.straw[i] ? HAY.base : GRASS.ground[v]; ctx.fillRect(px, py, CP, CP);
    ctx.fillStyle = f.straw[i] ? HAY.line : GRASS.line[v];
    if (along) ctx.fillRect(px + 1 + (v & 1), py, 1, CP); else ctx.fillRect(px, py + 1 + (v & 1), CP, 1);
    return;
  }
  if (f.straw[i]) {
    // straw windrow left by the combine
    ctx.fillStyle = STRAW.base; ctx.fillRect(px, py, CP, CP);
    ctx.fillStyle = STRAW.line;
    if (along) ctx.fillRect(px + 1 + (v & 1), py, 1, CP); else ctx.fillRect(px, py + 1 + (v & 1), CP, 1);
    return;
  }
  const st = s === S_RIPE ? 4 : s === S_SOWN ? f.stage[i] : 0;
  if (st >= 2) {
    // grown crop: the ground takes its colour, so chunks drawn flat in the distance still read as a field
    const c = f.crop[i];
    ctx.fillStyle = cropCss[c][st]; ctx.fillRect(px, py, CP, CP);
    ctx.fillStyle = cropLine[c][st];
    if (along) ctx.fillRect(px + 2, py, 1, CP); else ctx.fillRect(px, py + 2, CP, 1);
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
  const t = f.track[i];
  if (t && f.trackS[i] === s + 1) {
    ctx.fillStyle = s === S_STUB ? 'rgba(92, 72, 46, 0.6)' : 'rgba(36, 24, 14, 0.45)';
    const o = (t - 1) & 3;
    if ((t - 1) >> 2) ctx.fillRect(px, py + o, CP, 2); else ctx.fillRect(px + o, py, 2, CP);
  }
}

/** A wheel at (x, z) heading h leaves a rut in the field cell under it. */
export function markTrack(x, z, h) {
  const f = fieldAt(x, z);
  if (!f) return;
  const ix = (x - f.x0) | 0, iz = (z - f.z0) | 0, i = iz * f.w + ix;
  if (f.straw[i] || f.state[i] === S_NONE) return;
  const alongX = Math.abs(Math.sin(h)) > Math.abs(Math.cos(h));
  const frac = alongX ? z - f.z0 - iz : x - f.x0 - ix;
  const t = 1 + (alongX ? 4 : 0) + Math.min(2, (frac * CP) | 0);
  const tag = f.state[i] + 1;
  if (f.track[i] === t && f.trackS[i] === tag) return;
  f.track[i] = t; f.trackS[i] = tag;
  drawCell(f, i);
}

/** Surface kind of cell i for the soil detail (see fieldMat). */
function kindOf(f, i) {
  const s = f.state[i];
  if (s === S_NONE) return K_CROP;
  if (f.meadow) return f.straw[i] ? K_ROW : K_GRASS;
  if (f.straw[i]) return K_ROW;
  if (s === S_RIPE || (s === S_SOWN && f.stage[i] >= 2)) return K_CROP;
  if (s === S_STUB) return K_STUB;
  return s === S_CULT && f.bonus[i] & B_PLOW ? K_PLOW : K_CULT;
}

export function drawMini(f, i) {
  const s = f.state[i], d = f.miniImg.data, o = i * 4;
  f.miniDirty = true;
  const kd = kindOf(f, i) * 40;
  if (f.kind[i] !== kd) { f.kind[i] = kd; f.kindDirty = true; }
  if (s === S_NONE) { d[o + 3] = 0; return; }
  let rgb;
  if (f.meadow) rgb = f.straw[i] ? HAY.rgb : GRASS.rgb[s === S_RIPE ? 4 : grassStage(f.growth[i])];
  else if (s === S_RIPE) rgb = CROPS[f.crop[i]].rgb[4];
  else if (s === S_SOWN && f.stage[i] > 0) rgb = CROPS[f.crop[i]].rgb[f.stage[i]];
  else if (f.straw[i]) rgb = STRAW.rgb;
  else if (s === S_CULT && f.bonus[i] & B_PLOW) rgb = SOIL_PLOW.rgb;
  else rgb = SOIL[s].rgb;
  d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255;
}

export function updCrop(f, i) {
  const s = f.state[i];
  const st = f.meadow ? (s === S_RIPE ? 4 : s === S_STUB && !f.straw[i] ? grassStage(f.growth[i]) : 0) : s === S_RIPE ? 4 : s === S_SOWN ? f.stage[i] : 0;
  const [ch, k] = chunkOf(f, i);
  ch.dirty = true; f.cropDirty = true;
  const show = st === 0 ? 0 : 1;
  if (ch.on[k] !== show) { ch.on[k] = show; ch.filled += show ? 1 : -1; }
  if (!show) { ch.mesh.setMatrixAt(k, ZERO); return; }
  const cr = f.meadow ? GRASS : CROPS[f.crop[i]], j = f.jit[i];
  const row = (f.dir[i] === 0 ? i % f.w : (i / f.w) | 0) & 1, ix = i % f.w, iz = (i / f.w) | 0;
  // cards vary more in height; the outermost cells stay lower, so the field has no hard wall at its edge
  const edge = !f.poly && (ix === 0 || iz === 0 || ix === f.w - 1 || iz === f.h - 1) ? 0.8 : 1;
  const hgt = cr.h[st] * (cropCards ? 0.86 + j * 0.24 + row * 0.03 : 0.95 + j * 0.08 + row * 0.03) * edge, fw = cr.fw[st];
  const tl = f.meadow ? GRASS_TILE : TILE_OF[f.crop[i]];
  if (ch.tile.array[k] !== tl) { ch.tile.array[k] = tl; ch.tile.needsUpdate = true; }
  const sx = f.dir[i] === 0 ? fw : 1, sz = f.dir[i] === 0 ? 1 : fw;
  // quarter turns vary the sheaf pattern between cells (a plain block looks the same either way)
  _m.makeRotationY(((j * 4) | 0) * Math.PI / 2).premultiply(_s.makeScale(sx, hgt, sz));
  _m.setPosition(f.x0 + (i % f.w) + 0.5, f.y + 0.03, f.z0 + ((i / f.w) | 0) + 0.5);
  ch.mesh.setMatrixAt(k, _m);
  _c.copy(cr.cols[st]).multiplyScalar(0.95 + j * 0.06 + row * 0.05);
  ch.mesh.setColorAt(k, _c);
}

export function refreshField(f) { f.track.fill(0); applyMask(f); paintAll(f); for (let i = 0; i < f.n; i++) { updCrop(f, i); drawMini(f, i); } f.upT = 0; }

/* Whole-field repaint straight into pixels: the same picture as drawCell for every cell, but one
   putImageData instead of hundreds of thousands of fillRect calls (matters for the big fields). */
const rgbCache = new Map();
const rgb = hex => { let c = rgbCache.get(hex); if (!c) { const n = parseInt(hex.slice(1), 16); c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; rgbCache.set(hex, c); } return c; };
function paintAll(f) {
  const W = f.w * CP, img = f.ctx.createImageData(W, f.h * CP), d = img.data;
  const px1 = (x, y, c) => { const o = (y * W + x) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; };
  const fill = (px, py, c) => { for (let y = 0; y < CP; y++) for (let x = 0; x < CP; x++) px1(px + x, py + y, c); };
  const col = (x, py, c) => { for (let y = 0; y < CP; y++) px1(x, py + y, c); };
  const row = (px, y, c) => { for (let x = 0; x < CP; x++) px1(px + x, y, c); };
  for (let i = 0; i < f.n; i++) {
    const s = f.state[i];
    if (s === S_NONE) continue; // stays transparent
    const px = (i % f.w) * CP, py = ((i / f.w) | 0) * CP, j = f.jit[i], v = Math.floor(j * 3.999), along = f.dir[i] === 0;
    if (f.meadow) {
      const hay = f.straw[i];
      fill(px, py, rgb(hay ? HAY.base : GRASS.ground[v]));
      const ln = rgb(hay ? HAY.line : GRASS.line[v]);
      if (along) col(px + 1 + (v & 1), py, ln); else row(px, py + 1 + (v & 1), ln);
      continue;
    }
    if (f.straw[i]) {
      fill(px, py, rgb(STRAW.base));
      if (along) col(px + 1 + (v & 1), py, rgb(STRAW.line)); else row(px, py + 1 + (v & 1), rgb(STRAW.line));
      continue;
    }
    const st = s === S_RIPE ? 4 : s === S_SOWN ? f.stage[i] : 0;
    if (st >= 2) {
      fill(px, py, rgb(cropCss[f.crop[i]][st]));
      if (along) col(px + 2, py, rgb(cropLine[f.crop[i]][st])); else row(px, py + 2, rgb(cropLine[f.crop[i]][st]));
      continue;
    }
    const plowed = s === S_CULT && f.bonus[i] & B_PLOW, pal = plowed ? SOIL_PLOW : SOIL[s];
    fill(px, py, rgb(pal.base[v]));
    const ln = rgb(pal.line[v]);
    if (plowed) { if (along) { col(px, py, ln); col(px + 2, py, ln); } else { row(px, py, ln); row(px, py + 2, ln); } }
    else if (along) col(px + 2, py, ln); else row(px, py + 2, ln);
    if (s === S_STUB && j > 0.45) px1(px + ((j * 13) | 0) % 4, py + ((j * 29) | 0) % 4, rgb('#ecdcab'));
    if (f.bonus[i] & B_FERT && j < 0.6) px1(px + ((j * 7) | 0) % 4, py + ((j * 17) | 0) % 4, rgb(s === S_STUB ? '#cfc6ad' : '#a58e78'));
  }
  f.ctx.putImageData(img, 0, 0);
  f.texDirty = true;
}

/**
 * Uploads changed textures and instance buffers. Big field textures (up to 3 MB) go up at most
 * about 8 times a second while they change, small ones every frame.
 */
export function flushFields() {
  const now = performance.now();
  for (const f of FIELDS) {
    if (f.texDirty && (f.n < 6000 || now - f.upT > 120)) { f.tex.needsUpdate = true; f.texDirty = false; f.upT = now; }
    if (f.kindDirty && (f.n < 6000 || now - (f.kindT || 0) > 150)) { f.kindTex.needsUpdate = true; f.kindDirty = false; f.kindT = now; }
    if (f.cropDirty) {
      for (const ch of f.chunks) {
        if (!ch.dirty) continue;
        ch.mesh.instanceMatrix.needsUpdate = true;
        if (ch.mesh.instanceColor) ch.mesh.instanceColor.needsUpdate = true;
        ch.dirty = false;
      }
      f.cropDirty = false;
    }
  }
}

/** Advances growth of every sown cell by dh game hours (called twice a second with the time gathered meanwhile). */
export function growFields(dh) {
  if (dh <= 0) return;
  for (const f of FIELDS) {
    if (f.meadow) { growMeadow(f, dh); continue; }
    if (!f.cnt[S_SOWN] && f.counted) continue; // nothing growing here
    const st = f.state, gr = f.growth;
    for (let i = 0; i < f.n; i++) {
      if (st[i] !== S_SOWN) continue;
      const cr = CROPS[f.crop[i]], g = (gr[i] += dh);
      if (g >= cr.hours) { st[i] = S_RIPE; f.stage[i] = 4; updCrop(f, i); drawMini(f, i); drawCell(f, i); }
      else {
        const s = Math.min(3, Math.floor((g / cr.hours) * 4));
        if (s !== f.stage[i]) { f.stage[i] = s; updCrop(f, i); drawMini(f, i); if (s >= 2) drawCell(f, i); }
      }
    }
  }
}

const HOURS = CROPS.map(c => c.hours), IS_BEET = CROPS.map(c => c.header === 'beet');
/** Recounts cell states, growth progress, straw, fertiliser and ripe beet of one field. */
/** Mowed grass grows back (not under a hay swath that still lies there). */
function growMeadow(f, dh) {
  if (!f.cnt[S_STUB] && f.counted) return;
  const st = f.state, gr = f.growth;
  for (let i = 0; i < f.n; i++) {
    if (st[i] !== S_STUB || f.straw[i]) continue;
    const before = grassStage(gr[i]);
    gr[i] += dh;
    if (gr[i] >= GRASS.hours) { st[i] = S_RIPE; f.stage[i] = 4; updCrop(f, i); drawMini(f, i); }
    else if (grassStage(gr[i]) !== before) { updCrop(f, i); drawMini(f, i); }
  }
}

export function countField(f) {
  const c = [0, 0, 0, 0], st = f.state, cr = f.crop;
  let pg = 0, straw = 0, fert = 0, ripeBeet = 0;
  for (let i = 0; i < f.n; i++) {
    const s = st[i];
    if (s === S_NONE) continue;
    c[s]++;
    if (s === S_SOWN) pg += f.growth[i] / HOURS[cr[i]];
    else if (s === S_RIPE && IS_BEET[cr[i]]) ripeBeet++;
    straw += f.straw[i];
    fert += f.bonus[i] & B_FERT;
  }
  f.cnt = c; f.prog = c[2] ? pg / c[2] : 0; f.counted = true;
  f.strawCnt = straw; f.fertShare = fert / f.area; f.ripeBeet = ripeBeet;
}
export function countFields() { for (const f of FIELDS) countField(f); }
let rr = 0;
/** Cheap periodic recount: the field under (x, z) plus a few others in turn (all of them every few seconds). */
export function countSomeFields(x, z) {
  const here = fieldAt(x, z);
  if (here) countField(here);
  for (let k = 0; k < 4; k++) { const f = FIELDS[rr++ % FIELDS.length]; if (f !== here) countField(f); }
}

export function setCropShadows(on) { for (const f of FIELDS) for (const ch of f.chunks) ch.mesh.castShadow = on; }
/**
 * n = 0: crops are coloured blocks (cheapest, for weak graphics); 2, 3 or 4: crossing cards with
 * stalks, ears and leaves (more cards = denser crop). Changing it re-makes the cells' transforms.
 */
export function setCropStyle(n) {
  n = [0, 2, 3, 4].includes(n) ? n : 3;
  const changed = n !== cropCards;
  cropCards = n;
  for (const f of FIELDS) for (const ch of f.chunks) {
    ch.boxGeo ??= chunkGeo(ch, cropGeo);
    ch.cardGeo = n ? chunkGeo(ch, cardGeos[n]) : null;
    ch.cards = false;
    ch.mesh.geometry = ch.boxGeo; ch.mesh.material = cropMat; ch.mesh.customDepthMaterial = undefined; // updFieldLOD brings the cards in
  }
  if (changed) for (const f of FIELDS) for (let i = 0; i < f.n; i++) if (f.state[i] !== S_NONE) updCrop(f, i);
}

/* ---------- field signs ---------- */
export const signs = FIELDS.map(f => {
  const [x, z, ry] = f.sign;
  const g = new THREE.Group(); g.position.set(x, groundH(x, z), z); g.rotation.y = ry; scene.add(g);
  CY(0.07, 0.07, 2.4, 6, '#7a6250', -1.1, 1.2, 0, g); CY(0.07, 0.07, 2.4, 6, '#7a6250', 1.1, 1.2, 0, g);
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), side = M('#e9dfc8');
  // a plain board plus a separate face with the text: 2 draw calls (a box with 6 material groups costs 6)
  const board = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.4, 0.12), side);
  board.position.y = 2.0; board.castShadow = true; g.add(board);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.4), face);
  front.position.set(0, 2.0, 0.061); front.userData.noBake = true; g.add(front);
  bake(g);
  if (!roadAt(x, z, 1)) circles.push({ x, z, r: 0.6 }); // a sign that ended up on a road (map editor) does not block it
  return { f, x, z, cv, tex, g };
});

export function drawSign(s) {
  const c = s.cv.getContext('2d'), f = s.f;
  c.fillStyle = f.owned ? '#f4ecd8' : '#f3d27a'; c.fillRect(0, 0, 512, 256);
  c.strokeStyle = 'rgba(36,49,42,.35)'; c.lineWidth = 8; c.strokeRect(10, 10, 492, 236);
  c.fillStyle = '#24312a'; c.font = '800 92px "Bricolage Grotesque", "Trebuchet MS", sans-serif'; c.textBaseline = 'alphabetic';
  c.fillText((f.meadow ? 'Louka ' : 'Pole ') + f.id, 34, 112);
  c.font = '600 40px Figtree, "Segoe UI", sans-serif';
  const ha = fmt2(f.area / 10000) + ' ha';
  c.fillText((f.owned ? (f.meadow ? 'Tvoje louka · ' : 'Tvoje pole · ') : 'Na prodej · ') + ha, 34, 168);
  const job = G.contracts?.active?.field === f.id;
  if (job) { c.fillStyle = '#4d8a5d'; c.font = '700 40px Figtree, "Segoe UI", sans-serif'; c.fillText('Tvoje zakázka', 34, 220); }
  else if (!f.owned) { c.font = '700 42px Figtree, "Segoe UI", sans-serif'; c.fillText(fmt(f.price) + ' Kč', 34, 220); }
  s.tex.needsUpdate = true;
}
export const drawSigns = () => signs.forEach(drawSign);

/** Wet soil is darker: k = how wet the ground is, 0..1 (fx/wet.js). */
export function setFieldWet(k) {
  const c = 1 - 0.28 * k;
  for (const f of FIELDS) f.plane?.material.color.setScalar(c);
}
