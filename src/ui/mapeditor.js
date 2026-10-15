import { G } from '../game/state.js';
import { CROPS } from '../game/crops.js';
import { MARKETS } from '../game/markets.js';
import { saveLocal } from '../game/save.js';
import { releaseAll } from '../core/input.js';
import {
  FIELD_DEFS, ROADS, PONDS, FOREST_PLOTS, MAP_DEFAULTS, BOUNDS, RIVER, RIVER_HALF, BRIDGES, FORD, RAIL, TOWN, PAD, POND,
  HOUSES, CHAPEL, PIT, WOOD_BUYERS, COW_PEN, HEN_RUN, polyDist, riverDist, inPond,
} from '../world/layout.js';
import { townBlocks } from './minimap.js';

/**
 * Map editor (F9 → Editor mapy): a top-down plan of the land in the same orientation as the big map
 * (north up, +x on the left). Fields, meadows, roads, ponds and forest plots can be moved, resized,
 * added and deleted. "Uložit a obnovit" sends the edited sections to the development server, which
 * writes src/world/map.json (see vite.config.js); the page then reloads and builds the new map.
 * River, town, railway, the farmyard and the buyers stay where they are.
 */

const KEYS = ['fields', 'roads', 'ponds', 'forestPlots'];
const SOURCE = { fields: FIELD_DEFS, roads: ROADS, ponds: PONDS, forestPlots: FOREST_PLOTS };
const DELETE = { fields: 'Smazat pole', roads: 'Smazat cestu', ponds: 'Smazat rybník', forestPlots: 'Smazat lesní parcelu' };
const STATES = [['stub', 'Strniště'], ['cult', 'Zkultivované'], ['sown', 'Oseté'], ['ripe', 'Zralé']];
const MIN_FIELD = 10;

const ed = {
  open: false, wrap: null, cv: null, c: null, side: null, W: 0, H: 0, dpr: 1,
  vx: 170, vz: 70, sc: 1, // view centre (m) and scale (px per m)
  data: null, sel: null, drag: null, tool: null, draft: [], dirty: false, closeArmed: false, wasPlaying: false, hover: null,
};
const clone = o => JSON.parse(JSON.stringify(o));
export const mapEditorOpen = () => ed.open;

/* ---------- coordinates (same mirrored view as the big map) ---------- */
const sx = x => ed.W / 2 + (ed.vx - x) * ed.sc;
const sy = z => ed.H / 2 + (ed.vz - z) * ed.sc;
const wx = px => ed.vx - (px - ed.W / 2) / ed.sc;
const wz = py => ed.vz - (py - ed.H / 2) / ed.sc;
const snap = (v, s = 1) => Math.round(v / s) * s;

/* ---------- markup ---------- */
function build() {
  const wrap = document.createElement('div');
  wrap.className = 'mapedit'; wrap.hidden = true;
  wrap.innerHTML = `<div class="mehead"><b>Editor mapy</b><span class="muted" id="meStatus"></span>
      <button class="chipbtn" data-me="close">Zavřít</button></div>
    <div class="mebody"><canvas id="meCanvas" aria-label="Plán kraje"></canvas><aside class="meside" id="meSide"></aside></div>`;
  document.body.append(wrap);
  ed.wrap = wrap; ed.cv = wrap.querySelector('canvas'); ed.c = ed.cv.getContext('2d'); ed.side = wrap.querySelector('#meSide');
  wrap.addEventListener('click', e => { const a = e.target.closest('[data-me]')?.dataset.me; if (a) ACTS[a]?.(); });
  ed.side.addEventListener('input', onProp);
  ed.side.addEventListener('change', onProp);
  ed.cv.addEventListener('pointerdown', onDown);
  ed.cv.addEventListener('pointermove', onMove);
  ed.cv.addEventListener('pointerup', onUp);
  ed.cv.addEventListener('pointercancel', onUp);
  ed.cv.addEventListener('dblclick', onDbl);
  ed.cv.addEventListener('wheel', onWheel, { passive: false });
  ed.cv.addEventListener('contextmenu', e => e.preventDefault()); // right button pans
  addEventListener('keydown', onKey);
  addEventListener('resize', () => { if (ed.open) { resize(); draw(); } });
}

export function toggleMapEditor(on = !ed.open) {
  if (!ed.wrap) build();
  if (on === ed.open) return;
  ed.open = on; ed.wrap.hidden = !on;
  if (on) {
    ed.wasPlaying = G.playing; G.playing = false; releaseAll();
    load(); resize();
    ed.vx = G.active ? G.active.x : 170; ed.vz = G.active ? G.active.z : 70; ed.sc = 0.9;
    draw(); panel();
  } else {
    G.playing = ed.wasPlaying; releaseAll();
  }
}

function load() {
  ed.data = Object.fromEntries(KEYS.map(k => [k, clone(SOURCE[k])]));
  ed.sel = null; ed.drag = null; ed.tool = null; ed.draft = []; ed.dirty = false; ed.closeArmed = false;
  status('');
}
function changed() { ed.dirty = true; ed.closeArmed = false; status('Neuložené změny'); }
function status(t) { ed.wrap.querySelector('#meStatus').textContent = t; }

function resize() {
  const r = ed.cv.getBoundingClientRect();
  ed.dpr = Math.min(devicePixelRatio || 1, 2);
  ed.W = Math.max(1, r.width); ed.H = Math.max(1, r.height);
  ed.cv.width = Math.round(ed.W * ed.dpr); ed.cv.height = Math.round(ed.H * ed.dpr);
}

/* ---------- drawing ---------- */
function draw() {
  const c = ed.c, d = ed.data;
  c.setTransform(ed.dpr, 0, 0, ed.dpr, 0, 0);
  c.fillStyle = '#7f9a58'; c.fillRect(0, 0, ed.W, ed.H);
  rect(BOUNDS.x0, BOUNDS.x1, BOUNDS.z0, BOUNDS.z1, '#9fbe66');
  grid();
  // fixed scenery
  rect(PIT.x0, PIT.x1, PIT.z0, PIT.z1, '#cbbfa4');
  rect(TOWN.x0, TOWN.x1, TOWN.z0, TOWN.z1, 'rgba(226,220,204,.55)');
  for (const b of townBlocks) rect(b.x0, b.x1, b.z0, b.z1, b.col);
  line(RIVER, RIVER_HALF * 1.8, '#86b8c6');
  for (const b of BRIDGES) rect(b.x - b.len / 2, b.x + b.len / 2, b.z - b.w / 2, b.z + b.w / 2, '#cfcac0');
  ring(FORD.x, FORD.z, FORD.r, '#5f97a8', [4, 3]);
  line([[RAIL.x, RAIL.z0], [RAIL.x, RAIL.z1]], 3, '#8f8a82');
  rect(PAD.x0, PAD.x1, PAD.z0, PAD.z1, '#ddd8ce');
  rect(COW_PEN.x0, COW_PEN.x1, COW_PEN.z0, COW_PEN.z1, '#b2a372'); rect(HEN_RUN.x0, HEN_RUN.x1, HEN_RUN.z0, HEN_RUN.z1, '#c4b487');
  c.fillStyle = '#86b8c6'; c.beginPath(); c.arc(sx(POND.x), sy(POND.z), POND.r * ed.sc, 0, 7); c.fill();
  for (const [x, z, w, dd] of HOUSES) rect(x - dd / 2, x + dd / 2, z - w / 2, z + w / 2, '#e9ddc8');
  rect(CHAPEL.x - 4, CHAPEL.x + 4, CHAPEL.z - 3, CHAPEL.z + 3, '#f2ebdf');
  // editable layers, bottom to top
  d.forestPlots.forEach((p, i) => rect(p.x0, p.x1, p.z0, p.z1, isSel('forestPlots', i) ? '#4e7a42' : '#5f8a4f'));
  d.ponds.forEach(p => { c.fillStyle = '#86b8c6'; c.beginPath(); c.ellipse(sx(p.x), sy(p.z), p.rx * ed.sc, p.rz * ed.sc, 0, 0, 7); c.fill(); });
  d.roads.forEach(r => line(r.pts, r.w, r.kind === 'road' ? '#e3d3b0' : '#d9c79f'));
  d.fields.forEach(f => drawField(f));
  // buyers (fixed) with names
  c.font = `700 ${Math.max(10, Math.min(13, 11 * ed.sc))}px Figtree, system-ui, sans-serif`; c.textAlign = 'center';
  for (const m of MARKETS) { ring(m.x, m.z, m.r, m.color); label(m.short, m.x, m.z + m.r + 3); }
  for (const w of WOOD_BUYERS) { ring(w.x, w.z, w.r, '#8a6a4a'); label(w.short, w.x, w.z + w.r + 3); }
  // field numbers on top
  c.font = `800 ${Math.max(11, Math.min(22, 14 * ed.sc))}px "Bricolage Grotesque", system-ui, sans-serif`;
  for (const f of d.fields) label(String(f.id), f.x0 + f.w / 2, f.z0 + f.h / 2, '#24312a', true);
  drawSelection();
  if (ed.tool === 'road' && ed.draft.length) {
    const pts = ed.hover ? [...ed.draft, ed.hover] : ed.draft;
    line(pts, 6, 'rgba(36,49,42,.55)');
    for (const p of ed.draft) dot(p[0], p[1], 4, '#24312a');
  }
  scaleBar();
}
function rect(x0, x1, z0, z1, fill, stroke) {
  const c = ed.c, l = sx(x1), t = sy(z1), w = (x1 - x0) * ed.sc, h = (z1 - z0) * ed.sc;
  if (fill) { c.fillStyle = fill; c.fillRect(l, t, w, h); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.strokeRect(l, t, w, h); }
}
function line(pts, width, color) {
  const c = ed.c;
  c.strokeStyle = color; c.lineWidth = Math.max(1.5, width * ed.sc); c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); pts.forEach(([x, z], i) => (i ? c.lineTo(sx(x), sy(z)) : c.moveTo(sx(x), sy(z)))); c.stroke();
}
function ring(x, z, r, color, dash) {
  const c = ed.c;
  c.strokeStyle = color; c.lineWidth = 2; c.setLineDash(dash || []);
  c.beginPath(); c.arc(sx(x), sy(z), Math.max(3, r * ed.sc), 0, 7); c.stroke(); c.setLineDash([]);
}
function dot(x, z, r, fill) { const c = ed.c; c.fillStyle = fill; c.beginPath(); c.arc(sx(x), sy(z), r, 0, 7); c.fill(); }
function label(text, x, z, color = '#24312a', halo = false) {
  const c = ed.c;
  c.textBaseline = 'middle';
  if (halo) { c.lineWidth = 4; c.strokeStyle = 'rgba(251,247,238,.85)'; c.strokeText(text, sx(x), sy(z)); }
  c.fillStyle = color; c.fillText(text, sx(x), sy(z));
}
function grid() {
  const c = ed.c, step = ed.sc > 1.5 ? 25 : ed.sc > 0.5 ? 50 : 100;
  c.strokeStyle = 'rgba(36,49,42,.07)'; c.lineWidth = 1; c.beginPath();
  for (let x = Math.ceil(wx(ed.W) / step) * step; x <= wx(0); x += step) { c.moveTo(sx(x), 0); c.lineTo(sx(x), ed.H); }
  for (let z = Math.ceil(wz(ed.H) / step) * step; z <= wz(0); z += step) { c.moveTo(0, sy(z)); c.lineTo(ed.W, sy(z)); }
  c.stroke();
}
function scaleBar() {
  const c = ed.c, m = ed.sc > 1.5 ? 25 : ed.sc > 0.5 ? 100 : 200, px = m * ed.sc, x = 16, y = ed.H - 18;
  c.fillStyle = 'rgba(251,247,238,.9)'; c.fillRect(x - 8, y - 18, px + 52, 28);
  c.strokeStyle = '#24312a'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - 4); c.lineTo(x, y); c.lineTo(x + px, y); c.lineTo(x + px, y - 4); c.stroke();
  c.fillStyle = '#24312a'; c.font = '600 12px Figtree, system-ui, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
  c.fillText(m + ' m', x + px + 6, y);
}
function drawField(f) {
  const c = ed.c, fill = f.meadow ? 'rgba(178,205,114,.9)' : 'rgba(226,203,128,.88)', edge = f.owned ? '#7a5b2e' : 'rgba(36,49,42,.45)';
  if (f.poly) {
    c.fillStyle = fill; c.strokeStyle = edge; c.lineWidth = 2;
    c.beginPath(); f.poly.forEach(([x, z], i) => (i ? c.lineTo(sx(x), sy(z)) : c.moveTo(sx(x), sy(z)))); c.closePath(); c.fill(); c.stroke();
  } else rect(f.x0, f.x0 + f.w, f.z0, f.z0 + f.h, fill, edge);
}
function isSel(kind, i) { return ed.sel && ed.sel.kind === kind && ed.sel.i === i; }
function drawSelection() {
  const s = ed.sel; if (!s) return;
  const c = ed.c, o = ed.data[s.kind][s.i];
  c.setLineDash([6, 4]);
  if (s.kind === 'fields') rect(o.x0, o.x0 + o.w, o.z0, o.z0 + o.h, null, '#24312a');
  if (s.kind === 'forestPlots') rect(o.x0, o.x1, o.z0, o.z1, null, '#24312a');
  if (s.kind === 'ponds') { c.strokeStyle = '#24312a'; c.lineWidth = 2; c.beginPath(); c.ellipse(sx(o.x), sy(o.z), o.rx * ed.sc, o.rz * ed.sc, 0, 0, 7); c.stroke(); }
  if (s.kind === 'roads') { c.setLineDash([]); line(o.pts, o.w + 1.5, 'rgba(36,49,42,.35)'); line(o.pts, o.w, o.kind === 'road' ? '#e3d3b0' : '#d9c79f'); }
  c.setLineDash([]);
  for (const h of handles()) {
    const on = s.pt === h.pt && h.pt != null;
    c.fillStyle = on ? '#e08a3a' : '#fbf7ee'; c.strokeStyle = '#24312a'; c.lineWidth = 2;
    c.beginPath(); c.rect(sx(h.x) - 5, sy(h.z) - 5, 10, 10); c.fill(); c.stroke();
  }
}

/* ---------- handles and hit testing ---------- */
/** Drag handles of the selection: { x, z, kind: 'corner' | 'pt' | 'rx' | 'rz', ... }. */
function handles() {
  const s = ed.sel; if (!s) return [];
  const o = ed.data[s.kind][s.i];
  if (s.kind === 'fields') {
    if (o.poly) return [];
    return [[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => ({ kind: 'corner', a, b, x: o.x0 + a * o.w, z: o.z0 + b * o.h }));
  }
  if (s.kind === 'forestPlots') return [[0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => ({ kind: 'corner', a, b, x: a ? o.x1 : o.x0, z: b ? o.z1 : o.z0 }));
  if (s.kind === 'ponds') return [{ kind: 'rx', x: o.x + o.rx, z: o.z }, { kind: 'rz', x: o.x, z: o.z + o.rz }];
  if (s.kind === 'roads') return o.pts.map(([x, z], pt) => ({ kind: 'pt', pt, x, z }));
  return [];
}
function hitHandle(px, py) {
  return handles().find(h => Math.abs(sx(h.x) - px) < 8 && Math.abs(sy(h.z) - py) < 8) || null;
}
/** Topmost editable object under the pointer: fields, then roads, ponds, forest plots. */
function hitObject(x, z) {
  const d = ed.data, tol = 6 / ed.sc;
  for (let i = d.fields.length - 1; i >= 0; i--) {
    const f = d.fields[i];
    if (x >= f.x0 && x <= f.x0 + f.w && z >= f.z0 && z <= f.z0 + f.h) return { kind: 'fields', i };
  }
  for (let i = d.roads.length - 1; i >= 0; i--) if (polyDist(x, z, d.roads[i].pts) < d.roads[i].w / 2 + tol) return { kind: 'roads', i };
  for (let i = d.ponds.length - 1; i >= 0; i--) if (inPond(x, z, d.ponds[i])) return { kind: 'ponds', i };
  for (let i = d.forestPlots.length - 1; i >= 0; i--) {
    const p = d.forestPlots[i];
    if (x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1) return { kind: 'forestPlots', i };
  }
  return null;
}

/* ---------- pointer ---------- */
function pos(e) { const r = ed.cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

function onDown(e) {
  const [px, py] = pos(e), x = wx(px), z = wz(py);
  ed.cv.setPointerCapture(e.pointerId);
  if (ed.tool === 'road') {
    if (e.button === 0) { ed.draft.push([snap(x, 0.5), snap(z, 0.5)]); draw(); }
    return;
  }
  if (e.button !== 0) { ed.drag = { kind: 'pan', px, py, vx: ed.vx, vz: ed.vz }; return; }
  const h = hitHandle(px, py);
  if (h) {
    if (h.kind === 'pt') ed.sel.pt = h.pt;
    ed.drag = { kind: 'handle', h, orig: clone(ed.data[ed.sel.kind][ed.sel.i]) };
    draw(); panel(); return;
  }
  const hit = hitObject(x, z);
  if (hit) {
    ed.sel = { ...hit, pt: null };
    ed.drag = { kind: 'move', x, z, orig: clone(ed.data[hit.kind][hit.i]), moved: false };
  } else {
    ed.sel = null;
    ed.drag = { kind: 'pan', px, py, vx: ed.vx, vz: ed.vz };
  }
  draw(); panel();
}

function onMove(e) {
  const [px, py] = pos(e), x = wx(px), z = wz(py);
  if (ed.tool === 'road') { ed.hover = [snap(x, 0.5), snap(z, 0.5)]; draw(); return; }
  const d = ed.drag;
  if (!d) { ed.cv.style.cursor = hitHandle(px, py) ? 'grab' : hitObject(x, z) ? 'move' : 'default'; return; }
  if (d.kind === 'pan') { ed.vx = d.vx + (px - d.px) / ed.sc; ed.vz = d.vz + (py - d.py) / ed.sc; draw(); return; }
  const s = ed.sel, o = ed.data[s.kind][s.i];
  if (d.kind === 'move') {
    const dx = x - d.x, dz = z - d.z;
    if (!d.moved && Math.hypot(dx, dz) * ed.sc < 3) return;
    d.moved = true;
    moveBy(o, d.orig, s.kind, dx, dz);
  } else resizeTo(o, d.orig, s.kind, d.h, x, z);
  changed(); draw(); panel();
}

function onUp() { ed.drag = null; }

function onDbl(e) {
  if (ed.tool === 'road') { finishRoad(); return; }
  const [px, py] = pos(e), x = wx(px), z = wz(py);
  const hit = hitObject(x, z);
  if (!hit || hit.kind !== 'roads') return;
  // insert a point on the nearest segment of the road
  const r = ed.data.roads[hit.i];
  let best = 1, bd = Infinity;
  for (let k = 1; k < r.pts.length; k++) {
    const dd = polyDist(x, z, [r.pts[k - 1], r.pts[k]]);
    if (dd < bd) { bd = dd; best = k; }
  }
  r.pts.splice(best, 0, [snap(x, 0.5), snap(z, 0.5)]);
  ed.sel = { kind: 'roads', i: hit.i, pt: best };
  changed(); draw(); panel();
}

function onWheel(e) {
  e.preventDefault();
  const [px, py] = pos(e), x = wx(px), z = wz(py);
  ed.sc = Math.min(8, Math.max(0.25, ed.sc * (e.deltaY > 0 ? 0.88 : 1.14)));
  ed.vx = x + (px - ed.W / 2) / ed.sc; ed.vz = z + (py - ed.H / 2) / ed.sc; // keep the point under the cursor
  draw();
}

function onKey(e) {
  if (!ed.open) return;
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  if (e.code === 'Escape') {
    e.preventDefault();
    if (ed.tool) { ed.tool = null; ed.draft = []; ed.hover = null; } else ed.sel = null;
    draw(); panel();
  } else if (e.code === 'Enter' && ed.tool === 'road') {
    e.preventDefault(); finishRoad();
  } else if (e.code === 'Delete' || e.code === 'Backspace') {
    e.preventDefault(); del();
  }
}

/* ---------- edits ---------- */
function moveBy(o, orig, kind, dx, dz) {
  if (kind === 'fields') {
    const mx = snap(dx), mz = snap(dz);
    o.x0 = orig.x0 + mx; o.z0 = orig.z0 + mz;
    if (orig.poly) o.poly = orig.poly.map(([x, z]) => [x + mx, z + mz]);
    delete o.sign; // the game puts a new sign by the nearest road
  } else if (kind === 'forestPlots') {
    const mx = snap(dx), mz = snap(dz);
    o.x0 = orig.x0 + mx; o.x1 = orig.x1 + mx; o.z0 = orig.z0 + mz; o.z1 = orig.z1 + mz;
  } else if (kind === 'ponds') {
    o.x = snap(orig.x + dx); o.z = snap(orig.z + dz);
  } else if (kind === 'roads') {
    o.pts = orig.pts.map(([x, z]) => [snap(x + dx, 0.5), snap(z + dz, 0.5)]);
  }
}

function resizeTo(o, orig, kind, h, x, z) {
  if (kind === 'fields') {
    const ax = h.a ? orig.x0 : orig.x0 + orig.w, az = h.b ? orig.z0 : orig.z0 + orig.h; // the fixed corner
    const nx = snap(x), nz = snap(z);
    const x0 = Math.min(ax, nx), x1 = Math.max(ax, nx), z0 = Math.min(az, nz), z1 = Math.max(az, nz);
    if (x1 - x0 < MIN_FIELD || z1 - z0 < MIN_FIELD) return;
    Object.assign(o, { x0, z0, w: x1 - x0, h: z1 - z0 });
    delete o.sign;
    if (!o.owned) delete o.price; // price follows the new area
  } else if (kind === 'forestPlots') {
    const ax = h.a ? orig.x0 : orig.x1, az = h.b ? orig.z0 : orig.z1, nx = snap(x), nz = snap(z);
    if (Math.abs(nx - ax) < 10 || Math.abs(nz - az) < 10) return;
    Object.assign(o, { x0: Math.min(ax, nx), x1: Math.max(ax, nx), z0: Math.min(az, nz), z1: Math.max(az, nz) });
  } else if (kind === 'ponds') {
    if (h.kind === 'rx') o.rx = Math.max(6, snap(Math.abs(x - o.x)));
    else o.rz = Math.max(6, snap(Math.abs(z - o.z)));
  } else if (kind === 'roads') {
    o.pts[h.pt] = [snap(x, 0.5), snap(z, 0.5)];
  }
}

function del() {
  const s = ed.sel; if (!s) return;
  const list = ed.data[s.kind];
  if (s.kind === 'roads' && s.pt != null && list[s.i].pts.length > 2) {
    list[s.i].pts.splice(s.pt, 1); s.pt = null;
  } else {
    list.splice(s.i, 1); ed.sel = null;
  }
  changed(); draw(); panel();
}

function finishRoad() {
  if (ed.draft.length >= 2) {
    const used = new Set(ed.data.roads.map(r => r.id));
    let n = 1; while (used.has('cesta' + n)) n++;
    ed.data.roads.push({ id: 'cesta' + n, w: 5, kind: 'dirt', pts: ed.draft });
    ed.sel = { kind: 'roads', i: ed.data.roads.length - 1, pt: null };
    changed();
  }
  ed.tool = null; ed.draft = []; ed.hover = null;
  draw(); panel();
}

function addAtCentre(kind) {
  const x = snap(ed.vx), z = snap(ed.vz), d = ed.data;
  if (kind === 'fields') {
    const id = Math.max(0, ...d.fields.map(f => f.id)) + 1;
    d.fields.push({ id, x0: x - 25, z0: z - 20, w: 50, h: 40, q: 1, start: { s: 'stub' } });
  } else if (kind === 'ponds') d.ponds.push({ x, z, rx: 30, rz: 20 });
  else if (kind === 'forestPlots') d.forestPlots.push({ x0: x - 30, x1: x + 30, z0: z - 25, z1: z + 25 });
  ed.sel = { kind, i: d[kind].length - 1, pt: null };
  changed(); draw(); panel();
}

/* ---------- side panel ---------- */
const numIn = (key, label, val, step = 1) => `<label class="devrow"><span>${label}</span><input type="number" data-k="${key}" value="${val ?? ''}" step="${step}"></label>`;
const chk = (key, label, on) => `<label class="devcheck"><input type="checkbox" data-k="${key}"${on ? ' checked' : ''}> ${label}</label>`;
const sel = (key, label, opts, val) => `<label class="devrow"><span>${label}</span><select data-k="${key}">${opts.map(([v, t]) => `<option value="${v}"${String(v) === String(val) ? ' selected' : ''}>${t}</option>`).join('')}</select></label>`;
const btn = (act, label, cls = '') => `<button class="chipbtn ${cls}" data-me="${act}">${label}</button>`;

function panel() {
  const s = ed.sel, d = ed.data;
  let props = '';
  if (s) {
    const o = d[s.kind][s.i];
    if (s.kind === 'fields') {
      const st = o.start || { s: 'stub' };
      props = `<h3>${o.meadow ? 'Louka' : 'Pole'} ${o.id}</h3>
        <div class="me2">${numIn('x0', 'Západ x', o.x0)}${numIn('z0', 'Jih z', o.z0)}${numIn('w', 'Šířka (m)', o.w)}${numIn('h', 'Délka (m)', o.h)}</div>
        <p class="muted">${Math.round(o.w * o.h / 100) / 100} ha${o.poly ? ' · nepravidelný tvar' : ''}</p>
        ${o.poly ? btn('rect', 'Převést na obdélník') : ''}
        ${numIn('id', 'Číslo pole', o.id)}
        ${chk('meadow', 'Louka (seno)', o.meadow)}
        ${chk('owned', 'Vlastní na začátku hry', o.owned)}
        ${sel('start.s', 'V nové hře', STATES, st.s)}
        ${o.meadow ? '' : sel('start.crop', 'Plodina', CROPS.map((c, i) => [i, c.name]), st.crop ?? 0)}
        ${numIn('q', 'Kvalita půdy', o.q ?? 1, 0.05)}
        ${numIn('price', 'Cena Kč (prázdné = podle plochy)', o.owned ? 0 : o.price, 10000)}`;
    } else if (s.kind === 'roads') {
      props = `<h3>Cesta ${o.id}</h3>
        ${sel('kind', 'Druh', [['road', 'Silnice (štěrk)'], ['dirt', 'Polní cesta']], o.kind)}
        ${numIn('w', 'Šířka (m)', o.w, 0.5)}
        <p class="muted">${o.pts.length} bodů${s.pt != null ? ' · vybraný bod ' + (s.pt + 1) : ''}. Táhni body, dvojklik na cestu přidá bod, Delete smaže vybraný bod.</p>`;
    } else if (s.kind === 'ponds') {
      props = `<h3>Rybník</h3><div class="me2">${numIn('x', 'Střed x', o.x)}${numIn('z', 'Střed z', o.z)}${numIn('rx', 'Poloosa x', o.rx)}${numIn('rz', 'Poloosa z', o.rz)}</div>`;
    } else if (s.kind === 'forestPlots') {
      props = `<h3>Lesní parcela</h3><div class="me2">${numIn('x0', 'x od', o.x0)}${numIn('x1', 'x do', o.x1)}${numIn('z0', 'z od', o.z0)}${numIn('z1', 'z do', o.z1)}</div>
        <p class="muted">Stromy pro harvestor se rozmístí znovu po uložení.</p>`;
    }
    props += `<div class="devbtns">${btn('del', s.kind === 'fields' && ed.data.fields[s.i].meadow ? 'Smazat louku' : DELETE[s.kind], 'danger')}</div>`;
  } else if (ed.tool === 'road') {
    props = `<h3>Nová cesta</h3><p class="muted">Klikáním přidávej body. Enter nebo dvojklik cestu dokončí, Esc ji zruší.</p>`;
  } else {
    props = `<h3>Plán kraje</h3><p class="muted">Klikni na pole, cestu, rybník nebo les a táhni. Rohy mění velikost.
      Prázdné místo posouvá pohled, kolečko přibližuje. Řeka, městečko, železnice, dvůr a výkupy zůstávají na místě.</p>`;
  }
  const warn = warnings();
  ed.side.innerHTML = `${props}
    <h4>Přidat</h4>
    <div class="devbtns">${btn('addField', 'Pole')}${btn('addRoad', 'Cestu')}${btn('addPond', 'Rybník')}${btn('addForest', 'Les')}</div>
    <h4>Kontrola ${warn.length ? `<span class="mewarnn">${warn.length}</span>` : ''}</h4>
    ${warn.length ? `<ul class="mewarn">${warn.slice(0, 12).map(w => `<li>${w}</li>`).join('')}${warn.length > 12 ? `<li>… a ${warn.length - 12} dalších</li>` : ''}</ul>` : '<p class="muted">Bez problémů.</p>'}
    <div class="mesave">
      ${btn('save', 'Uložit a obnovit', 'primary')}
      <div class="devbtns">${btn('discard', 'Zahodit změny')}${btn('defaults', 'Výchozí mapa')}</div>
      <p class="muted" id="meNote">Uloží se do src/world/map.json, hra se obnoví a postaví novou mapu. Rozehraná hra zůstane, pole se změněnou velikostí začne znovu.</p>
      <textarea id="meJson" hidden readonly></textarea>
    </div>`;
}

function onProp(e) {
  const k = e.target.dataset.k, s = ed.sel;
  if (!k || !s) return;
  if (e.type === 'input' && e.target.type !== 'number') return;
  const o = ed.data[s.kind][s.i], t = e.target;
  let v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? (t.value === '' ? null : +t.value) : t.value;
  if (t.type === 'number' && v != null && !Number.isFinite(v)) return;
  if (k.startsWith('start.')) {
    o.start = { ...(o.start || { s: 'stub' }) };
    o.start[k.slice(6)] = k === 'start.crop' ? +v : v;
    if (o.start.s === 'sown' && o.start.growth == null) o.start.growth = 2;
  } else if (k === 'price') {
    if (v == null) delete o.price; else o.price = Math.max(0, v);
  } else if (s.kind === 'fields' && (k === 'w' || k === 'h')) {
    if (v == null || v < MIN_FIELD) return;
    o[k] = Math.round(v); delete o.poly; delete o.sign; if (!o.owned) delete o.price;
  } else if (s.kind === 'fields' && (k === 'x0' || k === 'z0')) {
    if (v == null) return;
    const d = Math.round(v) - o[k];
    o[k] += d; if (o.poly) o.poly = o.poly.map(([x, z]) => (k === 'x0' ? [x + d, z] : [x, z + d])); delete o.sign;
  } else if (k === 'owned') {
    o.owned = v; o.price = v ? 0 : undefined; if (!v) delete o.price;
  } else if (k === 'meadow') {
    if (v) o.meadow = true; else delete o.meadow;
  } else {
    if (v == null) return;
    o[k] = v;
  }
  changed(); draw();
  if (e.type === 'change') panel();
}

/* ---------- checks ---------- */
const fieldName = f => (f.meadow ? 'Louka ' : 'Pole ') + f.id;
function samples(pts, step = 2) {
  const out = [];
  for (let k = 1; k < pts.length; k++) {
    const [ax, az] = pts[k - 1], [bx, bz] = pts[k], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let i = 0; i <= n; i++) out.push([ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n]);
  }
  return out;
}
function warnings() {
  const d = ed.data, out = [];
  const ids = new Map();
  for (const f of d.fields) ids.set(f.id, (ids.get(f.id) || 0) + 1);
  for (const [id, n] of ids) if (n > 1) out.push(`Číslo ${id} má ${n} pole. Každé pole potřebuje vlastní číslo.`);
  const rectOf = f => ({ x0: f.x0, x1: f.x0 + f.w, z0: f.z0, z1: f.z0 + f.h });
  const overlap = (a, b, m = 0) => a.x0 < b.x1 + m && b.x0 < a.x1 + m && a.z0 < b.z1 + m && b.z0 < a.z1 + m;
  const inside = (x, z, r, m) => x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;
  d.fields.forEach((f, i) => {
    const r = rectOf(f);
    if (r.x0 < BOUNDS.x0 || r.x1 > BOUNDS.x1 || r.z0 < BOUNDS.z0 || r.z1 > BOUNDS.z1) out.push(`${fieldName(f)} přesahuje hranici mapy.`);
    for (let j = i + 1; j < d.fields.length; j++) if (overlap(r, rectOf(d.fields[j]), 2)) out.push(`${fieldName(f)} a ${fieldName(d.fields[j])} se překrývají.`);
    for (const rd of d.roads) if (samples(rd.pts).some(([x, z]) => inside(x, z, r, rd.w / 2 - 0.5))) { out.push(`Cesta ${rd.id} vede přes ${fieldName(f).toLowerCase()}.`); }
    if (samples(RIVER, 3).some(([x, z]) => inside(x, z, r, RIVER_HALF))) out.push(`${fieldName(f)} leží na řece.`);
    for (const p of d.ponds) if (inPond(Math.max(r.x0, Math.min(p.x, r.x1)), Math.max(r.z0, Math.min(p.z, r.z1)), p)) out.push(`${fieldName(f)} zasahuje do rybníka.`);
    if (overlap(r, TOWN) || overlap(r, PAD)) out.push(`${fieldName(f)} zasahuje do ${overlap(r, PAD) ? 'dvora' : 'městečka'}.`);
  });
  for (const rd of d.roads) {
    const wet = samples(rd.pts).filter(([x, z]) => riverDist(x, z) < RIVER_HALF);
    const dry = ([x, z]) => BRIDGES.some(b => Math.abs(x - b.x) < b.len / 2 + 2 && Math.abs(z - b.z) < b.w / 2 + 2) || Math.hypot(x - FORD.x, z - FORD.z) < FORD.r;
    if (wet.some(p => !dry(p))) out.push(`Cesta ${rd.id} kříží řeku mimo most a brod.`);
    if (rd.pts.some(([x, z]) => x < BOUNDS.x0 || x > BOUNDS.x1 || z < BOUNDS.z0 || z > BOUNDS.z1)) out.push(`Cesta ${rd.id} vede za hranici mapy.`);
  }
  return [...new Set(out)];
}

/* ---------- saving ---------- */
/** Only the sections that differ from the built-in map go to map.json. */
function exportData() {
  const out = {};
  for (const k of KEYS) if (JSON.stringify(ed.data[k]) !== JSON.stringify(MAP_DEFAULTS[k])) out[k] = ed.data[k];
  return out;
}
async function send(data, doneMsg) {
  const note = ed.wrap.querySelector('#meNote'), ta = ed.wrap.querySelector('#meJson');
  try {
    const r = await fetch('/__map', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
    const res = await r.json().catch(() => ({}));
    if (!r.ok || !res.ok) throw new Error(res.error || 'HTTP ' + r.status);
    saveLocal(); // keep the game in progress
    ed.dirty = false; status(doneMsg);
    note.textContent = 'Uloženo do src/world/map.json. Hra se obnovuje…';
    setTimeout(() => location.reload(), 400);
  } catch (err) {
    // a build without the development server cannot write files: show the JSON to copy by hand
    note.textContent = 'Uložit do souboru jde jen při spuštění přes spustit.bat (vývojový server). Zkopíruj obsah níže do src/world/map.json.';
    ta.hidden = false; ta.value = JSON.stringify(data, null, 1); ta.select();
    try { navigator.clipboard?.writeText(ta.value); } catch { /* clipboard unavailable */ }
    status('Neuloženo: ' + (err.message || err));
  }
}

const ACTS = {
  close: () => {
    if (ed.dirty && !ed.closeArmed) { ed.closeArmed = true; status('Neuložené změny se ztratí. Klikni na Zavřít znovu.'); return; }
    toggleMapEditor(false);
  },
  save: () => send(exportData(), 'Uloženo'),
  discard: () => { load(); draw(); panel(); },
  defaults: () => { ed.data = Object.fromEntries(KEYS.map(k => [k, clone(MAP_DEFAULTS[k])])); ed.sel = null; changed(); draw(); panel(); status('Výchozí mapa, ulož ji tlačítkem Uložit a obnovit'); },
  del,
  rect: () => { const o = ed.data.fields[ed.sel.i]; delete o.poly; delete o.sign; if (!o.owned) delete o.price; changed(); draw(); panel(); },
  addField: () => addAtCentre('fields'),
  addPond: () => addAtCentre('ponds'),
  addForest: () => addAtCentre('forestPlots'),
  addRoad: () => { ed.tool = 'road'; ed.draft = []; ed.sel = null; draw(); panel(); },
};
