import { FIELDS } from '../world/fields.js';
import { vehicles, tools } from '../vehicles/vehicles.js';
import { G } from '../game/state.js';
import {
  BOUNDS, ROADS, PAD, POND, HOUSES, CHURCH, baleZone, fuelZone, FOREST_PLOTS, SAWMILL, COW_PEN, HEN_RUN, GREENHOUSES,
  RIVER, RIVER_HALF, PONDS, PIT, RAIL, MEADOW_AREAS, BRIDGES, CHAPEL, WOOD_BUYERS, SHEEP_PEN, PIG_PEN, DAIRY, BUYER_AT,
} from '../world/layout.js';
import { treeDots } from '../world/vegetation.js';
import { MARKETS } from '../game/markets.js';
import { bales } from '../world/bales.js';

// North-up maps. World +x is drawn to the left so the maps match the default camera view
// (looking north, +x on the left). The minimap follows the active vehicle; the big map (M)
// shows the whole land. Both draw the same static layer (roads, water, forest, buildings).
const VIEW_M = 260; // metres shown across the minimap
const PAD_M = 6;
const mm = document.getElementById('minimap'), ctx = mm.getContext('2d');
let W = 0, H = 0, s = 1, bg = null;

/** Draws roads, water, trees, buildings and zones onto canvas c at sc px/m. */
function drawStatic(c, sc) {
  const bx = x => (BOUNDS.x1 + PAD_M - x) * sc, by = z => (BOUNDS.z1 + PAD_M - z) * sc;
  const rect = (x0, x1, z0, z1, fill) => { c.fillStyle = fill; c.fillRect(bx(x1), by(z1), (x1 - x0) * sc, (z1 - z0) * sc); };
  const ring = (z, color) => { c.strokeStyle = color; c.lineWidth = Math.max(1, 1.5 * sc); c.beginPath(); c.arc(bx(z.x), by(z.z), z.r * sc, 0, 7); c.stroke(); };
  const poly = (pts, width, color, cap = 'round') => {
    c.strokeStyle = color; c.lineWidth = width * sc; c.lineCap = cap; c.lineJoin = 'round';
    c.beginPath(); pts.forEach(([x, z], i) => (i ? c.lineTo(bx(x), by(z)) : c.moveTo(bx(x), by(z)))); c.stroke();
  };
  c.fillStyle = '#9fbe66'; c.fillRect(0, 0, c.canvas.width, c.canvas.height);
  MEADOW_AREAS.forEach(m => rect(m.x0, m.x1, m.z0, m.z1, '#b2cd72'));
  rect(PIT.x0, PIT.x1, PIT.z0, PIT.z1, '#cbbfa4');
  // trees: one dot each
  c.fillStyle = '#6f9a52';
  const r = Math.max(0.8, 2.2 * sc);
  for (let i = 0; i < treeDots.length; i += 2) c.fillRect(bx(treeDots[i]) - r / 2, by(treeDots[i + 1]) - r / 2, r, r);
  FOREST_PLOTS.forEach(P => rect(P.x0, P.x1, P.z0, P.z1, '#5f8a4f'));
  // water
  poly(RIVER, RIVER_HALF * 1.8, '#86b8c6');
  c.fillStyle = '#86b8c6';
  for (const p of PONDS) { c.beginPath(); c.ellipse(bx(p.x), by(p.z), p.rx * 0.88 * sc, p.rz * 0.88 * sc, 0, 0, 7); c.fill(); }
  c.beginPath(); c.arc(bx(POND.x), by(POND.z), POND.r * sc, 0, 7); c.fill();
  // roads, bridges, railway
  for (const rd of ROADS) poly(rd.pts, rd.w, rd.kind === 'road' ? '#e3d3b0' : '#d9c79f');
  for (const b of BRIDGES) { const ux = Math.cos(b.ang) * b.len / 2, uz = Math.sin(b.ang) * b.len / 2; poly([[b.x - ux, b.z - uz], [b.x + ux, b.z + uz]], b.w, '#cfcac0', 'butt'); }
  poly([[RAIL.x, RAIL.z0], [RAIL.x, RAIL.z1]], 3, '#8f8a82');
  // farm and village buildings
  rect(COW_PEN.x0, COW_PEN.x1, COW_PEN.z0, COW_PEN.z1, '#b2a372'); rect(HEN_RUN.x0, HEN_RUN.x1, HEN_RUN.z0, HEN_RUN.z1, '#c4b487');
  rect(SHEEP_PEN.x0, SHEEP_PEN.x1, SHEEP_PEN.z0, SHEEP_PEN.z1, '#a3b07a'); rect(PIG_PEN.x0, PIG_PEN.x1, PIG_PEN.z0, PIG_PEN.z1, '#a08a72');
  for (const g of GREENHOUSES) rect(g.x - 3.5, g.x + 3.5, g.z - 8, g.z + 8, '#d7ece8');
  rect(SAWMILL.x - 24, SAWMILL.x - 8, SAWMILL.z + 3, SAWMILL.z + 13, '#b9a07c');
  rect(PAD.x0, PAD.x1, PAD.z0, PAD.z1, '#ddd8ce');
  rect(-39, -25, -41, -31, '#c4614e'); rect(-38.5, -29.5, -22.5, -15.5, '#efe6d6'); rect(4, 20, -45, -35, '#a7afb0');
  for (const [x, z, w, d] of HOUSES) rect(x - d / 2, x + d / 2, z - w / 2, z + w / 2, '#e9ddc8');
  rect(CHURCH.x - 6, CHURCH.x + 7, CHURCH.z - 3.5, CHURCH.z + 3.5, '#f2ebdf');
  rect(CHAPEL.x - 4, CHAPEL.x + 4, CHAPEL.z - 3, CHAPEL.z + 3, '#f2ebdf');
  const { mill, oil, sugar } = BUYER_AT;
  rect(mill.x - 6, mill.x + 6, mill.z + 9, mill.z + 19, '#efe6d6'); rect(oil.x - 9, oil.x + 9, oil.z - 18, oil.z - 7, '#d9dcd8'); rect(sugar.x - 8, sugar.x + 8, sugar.z + 9, sugar.z + 19, '#e7dfd2');
  for (const b of townBlocks) rect(b.x0, b.x1, b.z0, b.z1, b.col);
  c.fillStyle = '#dfe1dc';
  for (const x of [15, 21.5]) { c.beginPath(); c.arc(bx(x), by(-19), 3 * sc, 0, 7); c.fill(); }
  MARKETS.forEach(m => ring(m, m.color));
  ring(baleZone, '#b07a4a'); ring(fuelZone, '#c8553f'); WOOD_BUYERS.forEach(w => ring(w, '#8a6a4a')); ring(DAIRY, '#f2efe6');
}
/** Town buildings for the maps (filled in by the town builder). */
export const townBlocks = [];

/** Labels for the static layer (buyers, sawmill, town). */
function drawLabels(c, sc, fontPx) {
  const bx = x => (BOUNDS.x1 + PAD_M - x) * sc, by = z => (BOUNDS.z1 + PAD_M - z) * sc;
  c.font = '700 ' + Math.round(fontPx) + 'px Figtree, sans-serif'; c.textAlign = 'center';
  c.fillStyle = 'rgba(36,49,42,.85)';
  for (const m of MARKETS) c.fillText(m.short, bx(m.x), by(m.z) - m.r * sc - fontPx * 0.4);
  for (const w of WOOD_BUYERS) c.fillText(w.short, bx(w.x), by(w.z) - w.r * sc - fontPx * 0.4);
  c.fillText('Mlékárna', bx(DAIRY.x), by(DAIRY.z) - DAIRY.r * sc - fontPx * 0.4);
}

export function sizeMinimap() {
  const r = mm.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  if (!r.width) return;
  W = mm.width = Math.round(r.width * dpr); H = mm.height = Math.round(r.height * dpr);
  s = W / VIEW_M;
  bg = document.createElement('canvas');
  bg.width = Math.ceil((BOUNDS.x1 - BOUNDS.x0 + PAD_M * 2) * s); bg.height = Math.ceil((BOUNDS.z1 - BOUNDS.z0 + PAD_M * 2) * s);
  const c = bg.getContext('2d');
  drawStatic(c, s);
  drawLabels(c, s, 9 * s);
  big.static = null; // redraw the big map's layer too
}

/** Draws fields, bales and machines over a map whose origin px is (ox, oy) on the layer at scale sc. */
function drawDynamic(c, sc, ox, oy, w, h, opts) {
  const mx = x => (BOUNDS.x1 + PAD_M - x) * sc - ox, my = z => (BOUNDS.z1 + PAD_M - z) * sc - oy;
  c.imageSmoothingEnabled = false;
  for (const f of FIELDS) {
    if (f.miniDirty) { f.miniCtx.putImageData(f.miniImg, 0, 0); f.miniDirty = false; }
    const x = mx(f.x0 + f.w), y = my(f.z0 + f.h);
    if (x > w || y > h || x + f.w * sc < 0 || y + f.h * sc < 0) continue;
    c.setTransform(-sc, 0, 0, -sc, mx(f.x0), my(f.z0));
    c.drawImage(f.mini, 0, 0);
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.font = '800 ' + Math.round(opts.font) + 'px "Bricolage Grotesque", sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  for (const f of FIELDS) {
    const x = mx(f.x0 + f.w), y = my(f.z0 + f.h), fw = f.w * sc, fh = f.h * sc;
    if (x > w || y > h || x + fw < 0 || y + fh < 0) continue;
    const job = G.contracts.active?.field === f.id;
    c.lineWidth = Math.max(1, opts.line);
    c.strokeStyle = f.owned ? 'rgba(255,255,255,.9)' : job ? '#4d8a5d' : 'rgba(36,49,42,.55)';
    c.setLineDash(f.owned || job ? [] : [4 * opts.line, 3 * opts.line]);
    if (f.poly) { c.beginPath(); f.poly.forEach(([px, pz], i) => (i ? c.lineTo(mx(px), my(pz)) : c.moveTo(mx(px), my(pz)))); c.closePath(); c.stroke(); }
    else c.strokeRect(x, y, fw, fh);
    c.setLineDash([]);
    c.fillStyle = 'rgba(36,49,42,.75)'; c.fillText(String(f.id), x + fw / 2 + 0.8, y + fh / 2 + 0.8);
    c.fillStyle = '#fff'; c.fillText(String(f.id), x + fw / 2, y + fh / 2);
  }
  c.fillStyle = '#f2dc8c'; c.strokeStyle = 'rgba(36,49,42,.6)'; c.lineWidth = 1;
  for (const b of bales) { c.beginPath(); c.arc(mx(b.x), my(b.z), Math.max(1.5, 0.9 * sc), 0, 7); c.fill(); c.stroke(); }
  for (const trailer of tools) {
    if (trailer.key !== 'trailer') continue;
    c.save();
    c.translate(mx(trailer.x + Math.sin(trailer.h) * 0.8), my(trailer.z + Math.cos(trailer.h) * 0.8));
    c.rotate(Math.atan2(-Math.cos(trailer.h), -Math.sin(trailer.h)));
    const k = opts.icon / 7;
    c.fillStyle = '#c8794a'; c.strokeStyle = '#fff'; c.lineWidth = Math.max(1, k * 0.8);
    c.fillRect(-2.8 * k, -1.3 * k, 5.6 * k, 2.6 * k); c.strokeRect(-2.8 * k, -1.3 * k, 5.6 * k, 2.6 * k);
    c.restore();
  }
  for (const u of vehicles) {
    const r = u === G.active ? opts.icon : opts.icon * 0.72;
    c.save();
    c.translate(mx(u.x), my(u.z));
    c.rotate(Math.atan2(-Math.cos(u.h), -Math.sin(u.h)));
    c.beginPath(); c.moveTo(r, 0); c.lineTo(-r * 0.75, r * 0.68); c.lineTo(-r * 0.4, 0); c.lineTo(-r * 0.75, -r * 0.68); c.closePath();
    c.fillStyle = u.mapCol; c.fill();
    c.lineWidth = Math.max(1, r * (u === G.active ? 0.2 : 0.12)); c.strokeStyle = '#fff'; c.stroke();
    c.restore();
    if (opts.names) {
      c.font = '700 ' + Math.round(opts.font * 0.8) + 'px Figtree, sans-serif'; c.fillStyle = '#24312a';
      c.fillText(u.name.split(' ')[0] + (u.helper ? ' · pomocník' : ''), mx(u.x), my(u.z) - r - opts.font * 0.6);
    }
  }
}

export function drawMinimap() {
  if (!W || !bg) return;
  const v = G.active;
  const vx = (BOUNDS.x1 + PAD_M - v.x) * s, vy = (BOUNDS.z1 + PAD_M - v.z) * s;
  // keep the active vehicle centred, but do not scroll past the map edges
  const ox = Math.min(Math.max(vx - W / 2, 0), Math.max(0, bg.width - W));
  const oy = Math.min(Math.max(vy - H / 2, 0), Math.max(0, bg.height - H));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#9fbe66'; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(bg, -ox, -oy);
  drawDynamic(ctx, s, ox, oy, W, H, { font: 12 * s, line: s * 0.9, icon: 7 * s, names: false });
  if (big.open) drawBigMap();
}

/* ---------- big map (M) ---------- */
const big = { open: false, static: null, sc: 1, ox: 0, oy: 0, canvas: null, ctx: null };
export const bigMapOpen = () => big.open;

function ensureBig() {
  if (big.canvas) return;
  const wrap = document.createElement('div');
  wrap.id = 'bigMap'; wrap.className = 'bigmap'; wrap.hidden = true;
  wrap.innerHTML = '<div class="bighead"><b>Mapa</b><span class="muted">Klikni na svůj stroj a přesedneš do něj · M zavře</span><button class="chipbtn" id="bigClose">Zavřít</button></div><canvas id="bigCanvas" aria-label="Mapa celého kraje"></canvas>';
  document.body.append(wrap);
  big.wrap = wrap; big.canvas = wrap.querySelector('canvas'); big.ctx = big.canvas.getContext('2d');
  wrap.querySelector('#bigClose').onclick = () => toggleBigMap(false);
  big.canvas.addEventListener('click', e => {
    const r = big.canvas.getBoundingClientRect(), k = big.canvas.width / r.width;
    const px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k;
    const x = BOUNDS.x1 + PAD_M - (px + big.ox) / big.sc, z = BOUNDS.z1 + PAD_M - (py + big.oy) / big.sc;
    const hit = vehicles.filter(u => u.available && !u.helper).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
    if (hit && Math.hypot(hit.x - x, hit.z - z) < 30 / Math.min(1, big.sc) && big.onPick) big.onPick(hit);
  });
}

function drawBigMap() {
  const cv = big.canvas, r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
  if (!w || !h) return;
  if (cv.width !== w || cv.height !== h || !big.static) {
    cv.width = w; cv.height = h;
    const mw = BOUNDS.x1 - BOUNDS.x0 + PAD_M * 2, mh = BOUNDS.z1 - BOUNDS.z0 + PAD_M * 2;
    big.sc = Math.min(w / mw, h / mh);
    big.ox = -(w - mw * big.sc) / 2; big.oy = -(h - mh * big.sc) / 2;
    big.static = document.createElement('canvas');
    big.static.width = Math.ceil(mw * big.sc); big.static.height = Math.ceil(mh * big.sc);
    const c = big.static.getContext('2d');
    drawStatic(c, big.sc);
    drawLabels(c, big.sc, 12 * dpr);
  }
  const c = big.ctx;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#7f9c58'; c.fillRect(0, 0, w, h);
  c.drawImage(big.static, -big.ox, -big.oy);
  drawDynamic(c, big.sc, big.ox, big.oy, w, h, { font: 13 * dpr, line: dpr, icon: 9 * dpr, names: true });
}

/** onPick(vehicle) is called when the player clicks one of their machines. */
export function toggleBigMap(on = !big.open, onPick) {
  ensureBig();
  if (onPick) big.onPick = onPick;
  big.open = on; big.wrap.hidden = !on;
  if (on) drawBigMap();
}
