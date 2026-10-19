import { scene } from '../render/core.js';
import { G } from '../game/state.js';
import { CROPS, S_STUB, S_CULT, S_SOWN, S_RIPE, B_FERT, B_PLOW } from '../game/crops.js';
import { MODEL } from '../game/catalog.js';
import { CTYPES, generateOffers, setBusyFields } from '../game/contracts.js';
import { FIELDS, drawCell, updCrop, drawMini } from './fields.js';
import { ROADS, movers } from './layout.js';
import { buildModel, sitOnGround } from '../vehicles/vehicles.js';
import { emit, CHAFF } from '../fx/particles.js';
import { freshSoil } from '../fx/furrows.js';
import { col, angDiff, clamp } from '../core/util.js';
import { toast } from '../ui/toast.js';

/**
 * The neighbours: three farmers who own the fields you do not. Each offers you work on his fields
 * (contracts carry his name), and when you leave an offer lying for a while (OFFER_WAIT game
 * minutes) he does the job himself: his tractor with the right implement, or his combine, comes
 * onto the field and works it lane by lane. At most two of them work at once. One more neighbour
 * drives the roads with a tractor and a trailer. Their machines block yours (movers) and are heard
 * (the engine sounds of the traffic). Nothing of this is saved: offers come back after loading.
 */
export const NEIGHBOURS = [
  { id: 'novak', name: 'Novák', full: 'Josef Novák', tractor: 'zetor-forterra-150', combine: 'sampo-sr2045',
    ask: 'Na všechno sám nestačím, pomůžeš mi?', thanks: 'Díky, sousede, jsi zlatej.' },
  { id: 'dvorakova', name: 'Dvořáková', full: 'Marie Dvořáková', tractor: 'nh-t7-210', combine: 'df-c6205',
    ask: 'Syn je v Brně, potřebovala bych ruku.', thanks: 'To jste hodný, vezměte si pak na dvoře koláč.' },
  { id: 'svoboda', name: 'Svoboda', full: 'Petr Svoboda', tractor: 'case-puma-185', combine: 'caseih-7250',
    ask: 'Kombajn mám v servisu, zaplatím slušně.', thanks: 'Platí, jsi borec.' },
];
/** Who owns field f (the neighbours share the fields you have not bought). */
export const neighbourOf = fieldId => NEIGHBOURS[fieldId % NEIGHBOURS.length];

const OFFER_WAIT = 240; // game minutes an offer waits for you before the neighbour does it himself
const MAX_JOBS = 2;
const TOOL_OF = { cultivate: 'kult-42', plough: 'pluh-5', sow: 'seci-4', fertilize: 'rozm-12' };
const DUST = { cultivate: col('#b48d68'), plough: col('#9b7656'), sow: col('#c7a984'), fertilize: col('#f1eee6') };

/* ---------- a machine of a neighbour: model, collision circles, sound ---------- */
function machine(modelId, toolId) {
  const m = buildModel(modelId), look = MODEL[modelId].look || {}, sc = look.scale || 1;
  const o = { model: modelId, x: 0, z: 0, h: 0, speed: 0, vmax: (MODEL[modelId].kmh || 25) / 3.6, m, group: m.group, steer: 0, circles: [] };
  scene.add(m.group);
  if (m.cornHdr) m.cornHdr.visible = false;
  if (m.headerLift && m.grainHdr) m.headerLift.add(m.grainHdr);
  if (toolId) {
    const t = buildModel(toolId);
    m.group.add(t.group); t.group.position.set(0, 0, -1.75 * sc);
    if (t.lift) t.lift.position.y = t.down ?? 0;
    o.tool = t;
  }
  const n = m.headerLift ? 3 : 2;
  for (let k = 0; k < n; k++) { const c = { x: 0, z: 0, r: m.headerLift ? 2 : 1.4 }; o.circles.push(c); movers.push(c); }
  return o;
}
function remove(o) {
  scene.remove(o.group);
  for (const c of o.circles) movers.splice(movers.indexOf(c), 1);
  if (o.trailer) { scene.remove(o.trailer.group); for (const c of o.trailer.circles) movers.splice(movers.indexOf(c), 1); }
}
/** Places the model and its collision circles; spins the wheels. */
function place(o, dt, len = 3) {
  sitOnGround(o.group, o.x, o.z, o.h, len, 2.4, 0);
  for (const w of o.m.wheels || []) w.userData.spin.rotation.x += (o.speed * dt) / w.userData.r;
  for (const p of o.m.front || []) p.rotation.y = o.steer;
  const s = Math.sin(o.h), c = Math.cos(o.h);
  o.circles.forEach((ci, k) => { const z = (k - (o.circles.length - 1) / 2) * 3 + (o.tool ? 0.5 : 0); ci.x = o.x + s * z; ci.z = o.z + c * z; });
}
/** Something of yours (or you on foot) right in front of machine o: it waits. */
function blocked(o, others) {
  const fx = Math.sin(o.h) * Math.sign(o.speed || 1), fz = Math.cos(o.h) * Math.sign(o.speed || 1);
  for (const v of others) {
    const dx = v.x - o.x, dz = v.z - o.z, ahead = dx * fx + dz * fz;
    if (ahead > 0 && ahead < 9 && Math.abs(dx * fz - dz * fx) < 3.2) return true;
  }
  return false;
}

/* ---------- field jobs ---------- */
const jobs = [];
/** The fields the neighbours are working right now (contracts are not offered there). */
export const busyFields = () => jobs.map(j => j.f.id);
setBusyFields(busyFields, neighbourOf);

function startJob(offer) {
  const f = FIELDS.find(x => x.id === offer.field), nb = neighbourOf(f.id), harvest = offer.type === 'harvest';
  if (harvest && CROPS[offer.crop].header !== 'grain') return false; // the neighbours only have grain headers
  const o = machine(harvest ? nb.combine : nb.tractor, harvest ? null : TOOL_OF[offer.type]);
  const W = harvest ? MODEL[nb.combine].header : MODEL[TOOL_OF[offer.type]].width;
  // lanes along the longer side; the machine comes in at a corner
  const alongZ = f.h >= f.w, across = alongZ ? f.w : f.h, n = Math.max(1, Math.ceil(across / W)), pts = [];
  for (let i = 0; i < n; i++) {
    const c = Math.min(across - W / 2, W / 2 + i * W), a = -3, b = (alongZ ? f.h : f.w) + 3, [p, q] = i % 2 ? [b, a] : [a, b];
    pts.push(alongZ ? [f.x0 + c, f.z0 + p] : [f.x0 + p, f.z0 + c], alongZ ? [f.x0 + c, f.z0 + q] : [f.x0 + q, f.z0 + c]);
  }
  Object.assign(o, { x: pts[0][0], z: pts[0][1], h: Math.atan2(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) });
  jobs.push({ o, f, nb, type: offer.type, crop: offer.crop, W, pts, seg: 0, harvest, done: 0 });
  G.contracts.offers = G.contracts.offers.filter(x => x.field !== f.id);
  toast(nb.name + ' si ' + CTYPES[offer.type].name.toLowerCase() + ' pole ' + f.id + ' udělal sám, zakázka propadla.');
  return true;
}

/** Works the cells under the tool line of job j (back edge of the tool or the header). */
function workCells(j, cx, cz) {
  const { f, W, type } = j, rx = Math.cos(j.o.h), rz = -Math.sin(j.o.h);
  for (let k = -W / 2 + 0.25; k <= W / 2 - 0.25; k += 0.5) {
    const x = cx + rx * k, z = cz + rz * k, ix = Math.floor(x - f.x0), iz = Math.floor(z - f.z0);
    if (ix < 0 || iz < 0 || ix >= f.w || iz >= f.h) continue;
    const i = ix + iz * f.w, s = f.state[i];
    let ch = false;
    if (type === 'harvest' && s === S_RIPE) { f.state[i] = S_STUB; f.straw[i] = 0; ch = true; }
    else if (type === 'cultivate' && s === S_STUB) { f.state[i] = S_CULT; f.straw[i] = 0; ch = true; }
    else if (type === 'plough' && (s === S_STUB || s === S_CULT)) { f.state[i] = S_CULT; f.bonus[i] |= B_PLOW; f.straw[i] = 0; ch = true; }
    else if (type === 'sow' && s === S_CULT) { f.state[i] = S_SOWN; f.crop[i] = j.crop >= 0 ? j.crop : 0; f.growth[i] = 0; f.stage[i] = 0; ch = true; }
    else if (type === 'fertilize' && s !== S_RIPE && !(f.bonus[i] & B_FERT)) { f.bonus[i] |= B_FERT; ch = true; }
    if (ch) { f.dir[i] = Math.abs(rx) > Math.abs(rz) ? 0 : 1; drawCell(f, i); updCrop(f, i); drawMini(f, i); j.done++; }
  }
}

function jobTick(j, dt, others) {
  const o = j.o, [tx, tz] = j.pts[j.seg + 1], dx = tx - o.x, dz = tz - o.z, d = Math.hypot(dx, dz);
  const want = Math.atan2(dx, dz), turn = angDiff(o.h, want);
  const vmax = Math.abs(turn) > 0.3 ? 1.6 : j.harvest ? 2.4 : 3;
  o.speed += ((blocked(o, others) ? 0 : vmax) - o.speed) * Math.min(1, dt * 2);
  o.h += clamp(turn, -0.9 * dt, 0.9 * dt);
  o.steer = clamp(turn, -0.5, 0.5);
  o.x += Math.sin(o.h) * o.speed * dt; o.z += Math.cos(o.h) * o.speed * dt;
  if (d < 1.2) j.seg++;
  // the tool line: the header in front of a combine, the implement behind a tractor
  const off = j.harvest ? 4.6 : -3.3, cx = o.x + Math.sin(o.h) * off, cz = o.z + Math.cos(o.h) * off;
  if (Math.abs(turn) < 0.4) workCells(j, cx, cz);
  if (j.harvest && o.m.reel) o.m.reel.rotation.x += dt * 2.6;
  // dust, chaff and fresh soil
  if (o.speed > 0.5 && Math.random() < dt * 20) {
    if (j.harvest) emit(o.x - Math.sin(o.h) * 6, 1.5, o.z - Math.cos(o.h) * 6, CHAFF, 0.5, -Math.sin(o.h), 0.5, -Math.cos(o.h), 1.4, 1);
    else emit(cx + (Math.random() - 0.5) * j.W * Math.cos(o.h), 0.4, cz - (Math.random() - 0.5) * j.W * Math.sin(o.h), DUST[j.type], 0.9, 0, 0.6, 0, 1.4);
  }
  if (!j.harvest && j.type !== 'fertilize' && Math.abs(turn) < 0.4 && (j.fresh = (j.fresh || 0) + o.speed * dt) > 1.2) {
    j.fresh = 0; freshSoil(cx, j.f.y + 0.045, cz, o.h, j.W, 1.45, j.type === 'plough' ? 1 : 0.6);
  }
  place(o, dt, j.harvest ? 3.6 : 2.4);
  return j.seg >= j.pts.length - 1;
}

/* ---------- the neighbour on the road: a small tractor with a trailer on the main road ---------- */
let road = null;
function buildRoadTractor() {
  const o = machine('zetor-major-80'), t = buildModel('bss-10');
  scene.add(t.group);
  o.trailer = { m: t, group: t.group, x: 0, z: 0, h: 0, circles: [{ x: 0, z: 0, r: 1.4 }, { x: 0, z: 0, r: 1.4 }] };
  for (const c of o.trailer.circles) movers.push(c);
  const r = ROADS.find(x => x.id === 'main');
  road = { o, pts: r.pts, seg: 0, t: 0.05, dir: 1, lane: 1.8 };
  o.vmax = 8;
}
function roadTick(dt, others) {
  const R = road, o = R.o, a = R.pts[R.seg], b = R.pts[R.seg + 1];
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), fx = (dx / L) * R.dir, fz = (dz / L) * R.dir;
  const stop = blocked(o, others);
  // something standing in the road for a while: he turns round and goes the other way
  R.wait = stop ? (R.wait || 0) + dt : 0;
  if (R.wait > 4) { R.dir = -R.dir; R.wait = 0; o.h += Math.PI; R.snap = true; }
  o.speed += ((stop ? 0 : o.vmax) - o.speed) * Math.min(1, dt * 1.5);
  R.t += (o.speed * dt * R.dir) / L;
  if (R.t > 1 || R.t < 0) {
    const next = R.seg + R.dir;
    if (next < 0 || next >= R.pts.length - 1) { R.dir = -R.dir; R.t = clamp(R.t, 0, 1); }
    else { R.seg = next; R.t = R.dir > 0 ? R.t - 1 : R.t + 1; }
  }
  const px = a[0] + dx * R.t, pz = a[1] + dz * R.t;
  const want = Math.atan2(fx, fz);
  o.h += angDiff(o.h, want) * Math.min(1, dt * 2);
  o.x = px - fz * R.lane; o.z = pz + fx * R.lane;
  place(o, dt, 2.2);
  // the trailer follows the hitch
  const T = o.trailer, hx = o.x - Math.sin(o.h) * 1.6, hz = o.z - Math.cos(o.h) * 1.6;
  T.h = Math.atan2(hx - T.x, hz - T.z) || o.h;
  if (R.snap || Math.hypot(hx - T.x, hz - T.z) > 20) { T.h = o.h; R.snap = false; } // turned round or placed: straight behind
  T.x = hx - Math.sin(T.h) * T.m.drawbar; T.z = hz - Math.cos(T.h) * T.m.drawbar;
  sitOnGround(T.group, T.x, T.z, T.h, T.m.bodyLen * 0.57, 2.3, -2 + T.m.bodyLen / 2);
  for (const w of T.m.wheels || []) w.userData.spin.rotation.x += (o.speed * dt) / w.userData.r;
  T.circles.forEach((c, k) => { const z = -1 - k * 2.6; c.x = T.x + Math.sin(T.h) * z; c.z = T.z + Math.cos(T.h) * z; });
}

/* ---------- every frame ---------- */
let pickT = 3;
/**
 * ctx = { dt, playing, target (camera target), others: your machines and you on foot }. Returns the
 * neighbours' machines (for the engine sounds).
 */
/** Developer panel: the neighbours' machines at all. */
export const neighboursOpt = { on: true };
export function updNeighbours(ctx) {
  const { dt, playing, others, target } = ctx;
  if (!road) buildRoadTractor();
  if (!neighboursOpt.on) {
    for (const j of jobs) remove(j.o);
    jobs.length = 0;
    road.o.group.visible = road.o.trailer.group.visible = false;
    for (const c of [...road.o.circles, ...road.o.trailer.circles]) { c.x = c.z = -9999; }
    sounds.length = 0;
    return sounds;
  }
  if (!playing) return sounds;
  // a neighbour takes over an offer you left lying (not where you are working right now)
  if ((pickT -= dt) <= 0) {
    pickT = 3;
    if (jobs.length < MAX_JOBS) {
      const old = G.contracts.offers.filter(x => G.gameMin - (x.at ?? G.gameMin) > OFFER_WAIT && !jobs.some(j => j.f.id === x.field)
        && !others.some(v => { const f = FIELDS.find(ff => ff.id === x.field); return v.x > f.x0 - 5 && v.x < f.x0 + f.w + 5 && v.z > f.z0 - 5 && v.z < f.z0 + f.h + 5; }));
      if (old.length) startJob(old[0]);
    }
  }
  for (let i = jobs.length - 1; i >= 0; i--) {
    if (jobTick(jobs[i], dt, others)) {
      const j = jobs[i];
      remove(j.o); jobs.splice(i, 1);
      generateOffers();
    }
  }
  roadTick(dt, others);
  // only within sight: far machines are not drawn
  for (const o of [road.o, ...jobs.map(j => j.o)]) {
    const far = Math.abs(o.x - target.x) > 260 || Math.abs(o.z - target.z) > 260;
    o.group.visible = !far; if (o.trailer) o.trailer.group.visible = !far;
  }
  sounds.length = 0;
  sounds.push(road.o, ...jobs.map(j => j.o));
  return sounds;
}
const sounds = [];
/** For the smoke test and the developer panel: what the neighbours do. */
export const neighbourJobs = () => jobs.map(j => ({ field: j.f.id, type: j.type, who: j.nb.name, done: j.done, seg: j.seg, of: j.pts.length - 1 }));
/** Developer panel: offers become old enough for the neighbours now. */
export function ageOffers() { for (const x of G.contracts.offers) x.at = G.gameMin - OFFER_WAIT - 1; pickT = 0; }
/** For the smoke test: where the neighbours' machines are. */
export const neighbourMachines = () => [road?.o, ...jobs.map(j => j.o)].filter(Boolean).map(o => ({ x: o.x, z: o.z, speed: o.speed, model: o.model }));
