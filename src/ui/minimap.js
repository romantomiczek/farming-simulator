import { FIELDS } from '../world/fields.js';
import { vehicles, trailer } from '../vehicles/vehicles.js';
import { G } from '../game/state.js';
import { BOUNDS, ROADS, PAD, POND, HOUSES, CHURCH, baleZone, fuelZone, FOREST, SAWMILL, COW_PEN, HEN_RUN, GREENHOUSES } from '../world/layout.js';
import { MARKETS } from '../game/markets.js';
import { bales } from '../world/bales.js';

// North-up map that follows the active vehicle. World +x is drawn to the left so the map
// matches the default camera view (looking north, +x on the left). The static layer (roads,
// buildings, zones) is drawn once for the whole valley at a fixed scale and scrolled.
const VIEW_M = 210; // metres shown across the minimap
const mm = document.getElementById('minimap'), ctx = mm.getContext('2d');
const bg = document.createElement('canvas');
let W = 0, H = 0, s = 1;
const bx = x => (BOUNDS.x1 + 6 - x) * s, by = z => (BOUNDS.z1 + 6 - z) * s; // world → static layer px

export function sizeMinimap() {
  const r = mm.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  if (!r.width) return;
  W = mm.width = Math.round(r.width * dpr); H = mm.height = Math.round(r.height * dpr);
  s = W / VIEW_M;
  bg.width = Math.ceil((BOUNDS.x1 - BOUNDS.x0 + 12) * s); bg.height = Math.ceil((BOUNDS.z1 - BOUNDS.z0 + 12) * s);
  const c = bg.getContext('2d');
  const rect = (x0, x1, z0, z1, fill) => { c.fillStyle = fill; c.fillRect(bx(x1), by(z1), (x1 - x0) * s, (z1 - z0) * s); };
  const ring = (z, color) => { c.strokeStyle = color; c.lineWidth = 1.5 * s; c.beginPath(); c.arc(bx(z.x), by(z.z), z.r * s, 0, 7); c.stroke(); };
  c.fillStyle = '#9fbe66'; c.fillRect(0, 0, bg.width, bg.height);
  rect(FOREST.x0, FOREST.x1, FOREST.z0, FOREST.z1, '#5f8a4f');
  ROADS.forEach(r => rect(r.x0, r.x1, r.z0, r.z1, '#e3d3b0'));
  rect(COW_PEN.x0, COW_PEN.x1, COW_PEN.z0, COW_PEN.z1, '#b2a372'); rect(HEN_RUN.x0, HEN_RUN.x1, HEN_RUN.z0, HEN_RUN.z1, '#c4b487');
  for (const g of GREENHOUSES) rect(g.x - 3.5, g.x + 3.5, g.z - 8, g.z + 8, '#d7ece8');
  rect(-44, -28, 119, 129, '#b9a07c');
  rect(PAD.x0, PAD.x1, PAD.z0, PAD.z1, '#ddd8ce');
  rect(-39, -25, -41, -31, '#c4614e'); rect(-38.5, -29.5, -22.5, -15.5, '#efe6d6'); rect(4, 20, -45, -35, '#a7afb0');
  for (const [x, z, w, d] of HOUSES) rect(x - d / 2, x + d / 2, z - w / 2, z + w / 2, '#e9ddc8');
  rect(CHURCH.x - 6, CHURCH.x + 7, CHURCH.z - 3.5, CHURCH.z + 3.5, '#f2ebdf');
  rect(132, 144, 67, 77, '#efe6d6'); rect(196, 214, 22, 33, '#d9dcd8'); rect(232, 248, 67, 77, '#e7dfd2');
  c.fillStyle = '#dfe1dc';
  for (const x of [15, 21.5]) { c.beginPath(); c.arc(bx(x), by(-19), 3 * s, 0, 7); c.fill(); }
  c.fillStyle = '#86b8c6'; c.beginPath(); c.arc(bx(POND.x), by(POND.z), POND.r * s, 0, 7); c.fill();
  MARKETS.forEach(m => ring(m, m.color));
  ring(baleZone, '#b07a4a'); ring(fuelZone, '#c8553f'); ring(SAWMILL, '#8a6a4a');
  c.font = '700 ' + Math.round(9 * s) + 'px Figtree, sans-serif'; c.textAlign = 'center';
  c.fillStyle = 'rgba(36,49,42,.8)';
  for (const m of MARKETS) c.fillText(m.short, bx(m.x), by(m.z) - m.r * s - 3 * s);
  c.fillText('Pila', bx(SAWMILL.x), by(SAWMILL.z) - SAWMILL.r * s - 3 * s);
}

export function drawMinimap() {
  if (!W) return;
  const v = G.active;
  // keep the active vehicle centred, but do not scroll past the valley edges
  const ox = Math.min(Math.max(bx(v.x) - W / 2, 0), Math.max(0, bg.width - W));
  const oy = Math.min(Math.max(by(v.z) - H / 2, 0), Math.max(0, bg.height - H));
  const mx = x => bx(x) - ox, my = z => by(z) - oy;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#9fbe66'; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(bg, -ox, -oy);
  ctx.imageSmoothingEnabled = false;
  for (const f of FIELDS) {
    if (f.miniDirty) { f.miniCtx.putImageData(f.miniImg, 0, 0); f.miniDirty = false; }
    ctx.setTransform(-s, 0, 0, -s, mx(f.x0), my(f.z0));
    ctx.drawImage(f.mini, 0, 0);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = '800 ' + Math.round(12 * s) + 'px "Bricolage Grotesque", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of FIELDS) {
    const x = mx(f.x0 + f.w), y = my(f.z0 + f.h), w = f.w * s, h = f.h * s;
    if (x > W || y > H || x + w < 0 || y + h < 0) continue;
    const job = G.contracts.active?.field === f.id;
    ctx.lineWidth = Math.max(1, s * 0.9);
    ctx.strokeStyle = f.owned ? 'rgba(255,255,255,.9)' : job ? '#4d8a5d' : 'rgba(36,49,42,.55)';
    ctx.setLineDash(f.owned || job ? [] : [4 * s, 3 * s]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(36,49,42,.75)'; ctx.fillText(String(f.id), x + w / 2 + 0.8, y + h / 2 + 0.8);
    ctx.fillStyle = '#fff'; ctx.fillText(String(f.id), x + w / 2, y + h / 2);
  }
  ctx.fillStyle = '#f2dc8c'; ctx.strokeStyle = 'rgba(36,49,42,.6)'; ctx.lineWidth = 1;
  for (const b of bales) { ctx.beginPath(); ctx.arc(mx(b.x), my(b.z), Math.max(1.5, 0.9 * s), 0, 7); ctx.fill(); ctx.stroke(); }
  if (trailer.group.visible) {
    ctx.save();
    ctx.translate(mx(trailer.x + Math.sin(trailer.h) * 0.8), my(trailer.z + Math.cos(trailer.h) * 0.8));
    ctx.rotate(Math.atan2(-Math.cos(trailer.h), -Math.sin(trailer.h)));
    ctx.fillStyle = '#c8794a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, s * 0.8);
    ctx.fillRect(-2.8 * s, -1.3 * s, 5.6 * s, 2.6 * s); ctx.strokeRect(-2.8 * s, -1.3 * s, 5.6 * s, 2.6 * s);
    ctx.restore();
  }
  for (const u of vehicles) {
    if (!u.available) continue;
    const r = (u === v ? 7 : 5) * s;
    ctx.save();
    ctx.translate(mx(u.x), my(u.z));
    ctx.rotate(Math.atan2(-Math.cos(u.h), -Math.sin(u.h)));
    ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-r * 0.75, r * 0.68); ctx.lineTo(-r * 0.4, 0); ctx.lineTo(-r * 0.75, -r * 0.68); ctx.closePath();
    ctx.fillStyle = u.mapCol; ctx.fill();
    ctx.lineWidth = Math.max(1, s * (u === v ? 1.4 : 0.8)); ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.restore();
  }
}
