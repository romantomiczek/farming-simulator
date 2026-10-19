import { col } from '../core/util.js';
import { G } from './state.js';
import { WASH, roadAt, inRect, PAD } from '../world/layout.js';
import { fieldAt } from '../world/fields.js';
import { emit } from '../fx/particles.js';
import { toast } from '../ui/toast.js';

/**
 * Dirty machines: a machine (and the implement or trailer behind it) gets dirty working the fields,
 * driving across them and off the roads, much faster in the mud after rain; rain rinses a little
 * off. The mud shows on the machine (materials.js, darker and blotchy low down). In the wash by the
 * barn F washes it in a few seconds for WASH_PRICE.
 */
export const WASH_PRICE = 250;
const WASH_S = 5;
const WATER = col('#dfeef3');

const setDirt = (p, d) => { if (p?.dirtU) p.dirtU.value = Math.max(0, Math.min(1, d)); };
const dirtOf = p => p?.dirtU?.value || 0;
export { dirtOf };

/** Every frame for every machine. wet = how wet the ground is 0..1, rain 0..1. */
export function updDirt(v, dt, wet, rain) {
  if (v.washT > 0) { washing(v, dt); return; }
  const sp = Math.abs(v.speed || 0);
  let gain = 0;
  if (sp > 0.3) {
    const field = fieldAt(v.x, v.z), off = !field && !roadAt(v.x, v.z, 1) && !inRect(v.x, v.z, PAD);
    // fully dirty after about half an hour of field work in dry weather, about 10 minutes in the mud
    if (field) gain = (v.lowered ? 0.0006 : 0.0003) * Math.min(1.5, sp / 3);
    else if (off) gain = 0.0002 * Math.min(1.5, sp / 4);
    gain *= 1 + 2 * wet; // mud
  }
  const rinse = rain * 0.0025;
  const d = dirtOf(v) + (gain - rinse) * dt;
  setDirt(v, d);
  const t = v.tool; // the implement or trailer behind
  if (t) setDirt(t, dirtOf(t) + (gain * 1.1 - rinse) * dt);
}

/** Inside the wash ring? */
export const inWash = v => Math.hypot(v.x - WASH.x, v.z - WASH.z) < WASH.r;
/** Worth washing (and not already in the wash)? */
export const needsWash = v => !(v.washT > 0) && Math.max(dirtOf(v), dirtOf(v.tool)) > 0.05;

/** F in the wash: pays and starts washing machine v with its implement. */
export function startWash(v) {
  if (G.money < WASH_PRICE) { toast('Na mytí nemáš peníze (' + WASH_PRICE + ' Kč).', 'bad'); return; }
  G.money -= WASH_PRICE; G.flashT = 0.4;
  v.washT = WASH_S; v.speed = 0;
  toast('Myčka: ' + WASH_PRICE + ' Kč, chvilku to potrvá.');
}

function washing(v, dt) {
  v.washT -= dt; v.speed = 0;
  const k = dt / WASH_S * 1.3;
  setDirt(v, dirtOf(v) - k); setDirt(v.tool, dirtOf(v.tool) - k);
  // water from the nozzles of the gantry and spray off the machine
  for (let i = 0; i < 3; i++) {
    const a = Math.random() * Math.PI * 2, r = 1.5 + Math.random() * 2.5;
    emit(v.x + Math.cos(a) * r, 3.6 + Math.random() * 0.8, v.z + Math.sin(a) * r, WATER, 0.25 + Math.random() * 0.2,
      -Math.cos(a) * 1.5, -2 - Math.random() * 2, -Math.sin(a) * 1.5, 0.8, 4);
  }
  if (v.washT <= 0) { v.washT = 0; setDirt(v, 0); setDirt(v.tool, 0); toast('Stroj je čistý.', 'good'); }
}
