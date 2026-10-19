import * as THREE from 'three';
import { scene } from '../render/core.js';
import { B, CY, mk, bake, flatten } from '../render/materials.js';
import { fmt } from '../core/util.js';
import { G, dayOf } from './state.js';
import { seasonIdx, dayInSeason, DAYS_PER_SEASON } from './weather.js';
import { earn } from './goals.js';
import { groundH } from '../world/terrain.js';
import { label } from '../world/buildings.js';
import { boxes } from '../world/layout.js';
import { NEIGHBOURS } from '../world/neighbours.js';
import { toast } from '../ui/toast.js';

/**
 * Dožínky, the harvest festival: on the last day of summer, by the main road east of the oil mill,
 * stalls with striped roofs, bunting, the harvest wreath on a pole and people. In the ring:
 *  - the harvest contest: F compares what you harvested this summer with the three neighbours;
 *    the first three win (once a year);
 *  - the tractor race (traktoriáda): F in a tractor starts the clock, a slalom through six gates
 *    of cones; a missed gate costs five seconds. The first finish of the year pays by the time,
 *    the best time ever is kept.
 * G.fest = { year, base (harvest litres at the start of summer), contest, race (claimed this year),
 * best (seconds) } is saved.
 */
export const FEST = { x: 240, z: 26, r: 5 };
const GATES = [[254, 22], [263, 30], [272, 22], [281, 30], [290, 22], [298, 30]];
const GATE_W = 4.6, PENALTY = 5, RACE_MAX = 150;
const PRIZES = [60000, 25000, 10000];
const RACE_PAY = t => (t < 35 ? 30000 : t < 50 ? 15000 : 5000);

const yearOf = day => Math.floor((day + DAYS_PER_SEASON) / (DAYS_PER_SEASON * 4));
const harvested = () => G.stats.harvest.reduce((a, b) => a + b, 0);
export const emptyFest = () => ({ year: -1, base: 0, contest: false, race: false, best: null });

/** Is it the festival now: the last day of summer, 9:00–20:00. */
export function festivalNow() {
  const day = dayOf(G.gameMin), h = (G.gameMin / 60) % 24;
  return seasonIdx(day) === 1 && dayInSeason() === DAYS_PER_SEASON && h >= 9 && h < 20;
}
const festivalDay = () => seasonIdx(dayOf(G.gameMin)) === 1 && dayInSeason() === DAYS_PER_SEASON;
export const inFest = p => Math.hypot(p.x - FEST.x, p.z - FEST.z) < FEST.r;

/* ---------- decorations (shown on the festival day only) ---------- */
let decor = null, cones = null;
const stallBoxes = [];
export function buildFestival() {
  const g = new THREE.Group(), stripes = ['#c8453a', '#e9c44a', '#3f7fa6', '#5f9c5c'];
  // four stalls along the road, backs to it
  [256, 267, 278, 289].forEach((x, i) => {
    const z = 37, y = groundH(x, z);
    B(4.2, 0.9, 1.4, '#a7865e', x, y + 0.45, z, g); // counter
    const b = { x0: x - 2.2, x1: x + 2.2, z0: z - 0.8, z1: z + 0.8, off: true }; boxes.push(b); stallBoxes.push(b); // in the way on the day only
    for (const sx of [-2, 2]) for (const sz of [-0.7, 0.7]) CY(0.06, 0.06, 2.4, 6, '#6b5440', x + sx, y + 1.2, z + sz, g);
    for (let k = 0; k < 6; k++) B(0.72, 0.08, 1.9, k % 2 ? '#f4efe4' : stripes[i], x - 1.8 + k * 0.72, y + 2.45, z - 0.15, g); // striped roof
    for (let k = 0; k < 5; k++) B(0.42, 0.3, 0.42, ['#d9a441', '#c8553f', '#7fa653', '#e8b84a', '#b58a5a'][(k + i) % 5], x - 1.6 + k * 0.8, y + 1.05, z, g); // goods
  });
  // bunting between poles, the harvest wreath on a tall pole
  const poles = [[250, 33], [262, 33], [273, 33], [284, 33], [295, 33]];
  for (const [x, z] of poles) CY(0.08, 0.1, 4.2, 6, '#6b5440', x, groundH(x, z) + 2.1, z, g);
  for (let p = 0; p < poles.length - 1; p++) {
    const [x0, z0] = poles[p], [x1] = poles[p + 1];
    for (let k = 1; k < 10; k++) {
      const x = x0 + ((x1 - x0) * k) / 10, sag = Math.sin((k / 10) * Math.PI) * 0.6, f = mk(new THREE.ConeGeometry(0.22, 0.45, 3), stripes[(p + k) % 4], x, groundH(x, z0) + 3.9 - sag, z0, g);
      f.rotation.x = Math.PI;
    }
  }
  const wy = groundH(246, 30);
  CY(0.1, 0.12, 6, 6, '#6b5440', 246, wy + 3, 30, g);
  const wreath = mk(new THREE.TorusGeometry(0.9, 0.28, 6, 14), '#d9b24a', 246, wy + 5.4, 30, g);
  wreath.rotation.y = Math.PI / 2;
  ['#c8453a', '#3f7fa6', '#f4efe4'].forEach((c, k) => B(0.04, 1.4, 0.1, c, 246, wy + 4.3, 30 + (k - 1) * 0.3, g)); // ribbons
  // the ring and the sign
  const ring = new THREE.Mesh(new THREE.RingGeometry(FEST.r - 0.5, FEST.r, 40), new THREE.MeshBasicMaterial({ color: 0xd9b24a, transparent: true, opacity: 0.8 }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(FEST.x, groundH(FEST.x, FEST.z) + 0.06, FEST.z);
  label(g, 'Dožínky', FEST.x, groundH(FEST.x, FEST.z) + 4.5, FEST.z - FEST.r - 0.6, 0);
  decor = bake(flatten(g));
  decor.add(ring);
  // cones of the gates: an orange one and a white one each side
  const cone = new THREE.ConeGeometry(0.28, 0.75, 8).translate(0, 0.375, 0);
  cones = new THREE.InstancedMesh(cone, new THREE.MeshStandardMaterial({ color: 0xe8743a, roughness: 0.6 }), GATES.length * 2);
  const m = new THREE.Matrix4();
  GATES.forEach(([x, z], i) => { for (const s of [0, 1]) { const zz = z + (s ? 1 : -1) * GATE_W / 2; m.makeTranslation(x, groundH(x, zz), zz); cones.setMatrixAt(i * 2 + s, m); } });
  cones.castShadow = true;
  decor.add(cones);
  decor.visible = false;
  scene.add(decor);
}

/* ---------- the race ---------- */
const race = { on: false, t: 0, gate: 0, penalty: 0, prevX: 0, v: null };
export const raceState = () => (race.on ? { gate: race.gate, of: GATES.length, t: race.t + race.penalty } : null);

export function startRace(v) {
  Object.assign(race, { on: true, t: 0, gate: 0, penalty: 0, prevX: v.x, v });
  toast('Traktoriáda: projeď slalomem šest bran mezi kužely co nejrychleji. Čas běží!', 'good');
}
function raceTick(dt, active) {
  if (!race.on) return;
  if (active !== race.v || !festivalNow()) { race.on = false; toast('Traktoriáda přerušena.', 'bad'); return; }
  race.t += dt;
  if (race.t > RACE_MAX) { race.on = false; toast('Traktoriáda: čas vypršel.', 'bad'); return; }
  const v = race.v, [gx, gz] = GATES[race.gate];
  if ((race.prevX - gx) * (v.x - gx) <= 0 && race.prevX !== v.x) {
    if (Math.abs(v.z - gz) > GATE_W / 2) { race.penalty += PENALTY; toast('Minul jsi bránu ' + (race.gate + 1) + ', +' + PENALTY + ' s.', 'bad'); }
    race.gate++;
    if (race.gate >= GATES.length) finishRace();
  }
  race.prevX = v.x;
}
function finishRace() {
  race.on = false;
  const t = race.t + race.penalty, f = G.fest, best = f.best == null || t < f.best;
  if (best) f.best = t;
  let msg = 'Traktoriáda: ' + t.toFixed(1).replace('.', ',') + ' s' + (race.penalty ? ' (z toho ' + race.penalty + ' s trestné)' : '') + (best ? ' · nový rekord!' : ' · rekord ' + f.best.toFixed(1).replace('.', ',') + ' s');
  if (!f.race) { const pay = RACE_PAY(t); f.race = true; G.money += pay; earn(pay); G.flashT = 0.4; msg += ' · výhra ' + fmt(pay) + ' Kč'; }
  toast(msg, 'good');
}

/* ---------- the harvest contest ---------- */
/** The contest table of this year: [{ name, l, you }] sorted, best first. */
export function contestTable() {
  const y = G.fest.year, you = Math.max(0, harvested() - G.fest.base);
  const rows = NEIGHBOURS.map((n, i) => ({ name: n.full, l: Math.round((12000 + i * 9000 + ((y * 7919 + i * 3571) % 14000)) / 100) * 100, you: false }));
  rows.push({ name: 'Ty', l: Math.round(you), you: true });
  return rows.sort((a, b) => b.l - a.l);
}
export function claimContest() {
  const rows = contestTable(), place = rows.findIndex(r => r.you), prize = PRIZES[place] || 0;
  G.fest.contest = true;
  if (prize) { G.money += prize; earn(prize); G.flashT = 0.4; }
  toast('Soutěž o největší úrodu: ' + rows.map((r, i) => (i + 1) + '. ' + r.name + ' ' + fmt(r.l) + ' l').join(' · ') +
    (prize ? ' · Jsi ' + (place + 1) + '., výhra ' + fmt(prize) + ' Kč!' : ' · Letos bez ceny, příští léto to vyjde.'), prize ? 'good' : '');
}

/** What F would do at the festival now, or null: { kind: 'race' | 'contest' }. */
export function festAction(p, inTractor) {
  if (!festivalNow() || !inFest(p) || race.on) return null;
  if (inTractor) return { kind: 'race' };
  if (!G.fest.contest) return { kind: 'contest' };
  return null;
}

/* ---------- every frame ---------- */
let announced = -1;
export function festivalTick(dt, active) {
  const day = dayOf(G.gameMin), y = yearOf(day);
  if (!G.fest) G.fest = emptyFest();
  // a new summer: the harvest counts from now on
  if (seasonIdx(day) === 1 && G.fest.year !== y) Object.assign(G.fest, { year: y, base: harvested(), contest: false, race: false });
  if (decor) { decor.visible = festivalDay(); for (const b of stallBoxes) b.off = !decor.visible; }
  if (festivalNow() && announced !== y) {
    announced = y;
    toast('Dnes jsou dožínky! Slavnost je u hlavní silnice za olejnou: soutěž o největší úrodu (F v kruhu) a traktoriáda (F v kruhu v traktoru).', 'good');
  }
  raceTick(dt, active);
}
