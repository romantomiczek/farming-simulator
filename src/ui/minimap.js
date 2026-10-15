import { FIELDS } from '../world/fields.js';
import { vehicles, trailer } from '../vehicles/vehicles.js';
import { G } from '../game/state.js';
import { BOUNDS, ROADS, PAD, POND, sellZone, baleZone, fuelZone } from '../world/layout.js';
import { bales } from '../world/bales.js';

// North-up map of the valley. World +x is drawn to the left so the map matches the
// default camera view (looking north, +x on the left).
const mm = document.getElementById('minimap'), ctx = mm.getContext('2d');
const bg = document.createElement('canvas');
const SPAN_X = BOUNDS.x1 - BOUNDS.x0, SPAN_Z = BOUNDS.z1 - BOUNDS.z0;
let W = 0, H = 0, sx = 1, sy = 1;
const mapX = x => (BOUNDS.x1 - x) * sx, mapY = z => (BOUNDS.z1 - z) * sy;

export function sizeMinimap() {
  const r = mm.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  if (!r.width) return;
  W = mm.width = Math.round(r.width * dpr); H = mm.height = Math.round(r.height * dpr);
  sx = W / SPAN_X; sy = H / SPAN_Z;
  bg.width = W; bg.height = H;
  const c = bg.getContext('2d');
  const rect = (x0, x1, z0, z1, fill) => { c.fillStyle = fill; c.fillRect(mapX(x1), mapY(z1), (x1 - x0) * sx, (z1 - z0) * sy); };
  c.fillStyle = '#9fbe66'; c.fillRect(0, 0, W, H);
  ROADS.forEach(r => rect(r.x0, r.x1, r.z0, r.z1, '#e3d3b0'));
  rect(PAD.x0, PAD.x1, PAD.z0, PAD.z1, '#ddd8ce');
  rect(-39, -25, -41, -31, '#c4614e'); rect(-38.5, -29.5, -22.5, -15.5, '#efe6d6'); rect(4, 20, -45, -35, '#a7afb0');
  c.fillStyle = '#dfe1dc';
  for (const x of [15, 21.5]) { c.beginPath(); c.arc(mapX(x), mapY(-19), 3 * sx, 0, 7); c.fill(); }
  c.fillStyle = '#86b8c6'; c.beginPath(); c.arc(mapX(POND.x), mapY(POND.z), POND.r * sx, 0, 7); c.fill();
  c.strokeStyle = '#e0a83a'; c.lineWidth = 1.5 * sx; c.beginPath(); c.arc(mapX(sellZone.x), mapY(sellZone.z), sellZone.r * sx, 0, 7); c.stroke();
  c.strokeStyle = '#b07a4a'; c.beginPath(); c.arc(mapX(baleZone.x), mapY(baleZone.z), baleZone.r * sx, 0, 7); c.stroke();
  c.strokeStyle = '#c8553f'; c.beginPath(); c.arc(mapX(fuelZone.x), mapY(fuelZone.z), fuelZone.r * sx, 0, 7); c.stroke();
}

export function drawMinimap() {
  if (!W) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(bg, 0, 0);
  ctx.imageSmoothingEnabled = false;
  for (const f of FIELDS) {
    if (f.miniDirty) { f.miniCtx.putImageData(f.miniImg, 0, 0); f.miniDirty = false; }
    ctx.setTransform(-sx, 0, 0, -sy, mapX(f.x0), mapY(f.z0));
    ctx.drawImage(f.mini, 0, 0);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const fs = Math.round(12 * sx);
  ctx.font = '800 ' + fs + 'px "Bricolage Grotesque", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of FIELDS) {
    const x = mapX(f.x0 + f.w), y = mapY(f.z0 + f.h), w = f.w * sx, h = f.h * sy;
    ctx.lineWidth = Math.max(1, sx * 0.9);
    ctx.strokeStyle = f.owned ? 'rgba(255,255,255,.9)' : 'rgba(36,49,42,.55)';
    ctx.setLineDash(f.owned ? [] : [4 * sx, 3 * sx]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(36,49,42,.75)'; ctx.fillText(String(f.id), x + w / 2 + 0.8, y + h / 2 + 0.8);
    ctx.fillStyle = '#fff'; ctx.fillText(String(f.id), x + w / 2, y + h / 2);
  }
  ctx.fillStyle = '#f2dc8c'; ctx.strokeStyle = 'rgba(36,49,42,.6)'; ctx.lineWidth = 1;
  for (const b of bales) { ctx.beginPath(); ctx.arc(mapX(b.x), mapY(b.z), Math.max(1.5, 0.9 * sx), 0, 7); ctx.fill(); ctx.stroke(); }
  // trailer: a small box along its heading
  if (trailer.group.visible) {
  ctx.save();
  ctx.translate(mapX(trailer.x + Math.sin(trailer.h) * 0.8), mapY(trailer.z + Math.cos(trailer.h) * 0.8));
  ctx.rotate(Math.atan2(-Math.cos(trailer.h), -Math.sin(trailer.h)));
  ctx.fillStyle = '#c8794a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, sx * 0.8);
  ctx.fillRect(-2.8 * sx, -1.3 * sx, 5.6 * sx, 2.6 * sx); ctx.strokeRect(-2.8 * sx, -1.3 * sx, 5.6 * sx, 2.6 * sx);
  ctx.restore();
  }
  for (const v of vehicles) {
    if (!v.available) continue;
    const s = (v === G.active ? 7 : 5) * sx;
    ctx.save();
    ctx.translate(mapX(v.x), mapY(v.z));
    ctx.rotate(Math.atan2(-Math.cos(v.h), -Math.sin(v.h)));
    ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(-s * 0.75, s * 0.68); ctx.lineTo(-s * 0.4, 0); ctx.lineTo(-s * 0.75, -s * 0.68); ctx.closePath();
    ctx.fillStyle = v.mapCol; ctx.fill();
    ctx.lineWidth = Math.max(1, sx * (v === G.active ? 1.4 : 0.8)); ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.restore();
  }
}
