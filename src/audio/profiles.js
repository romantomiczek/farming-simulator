import { MODEL, MODELS } from '../game/catalog.js';

/**
 * How each machine model sounds. Every model plays one set of recorded engine loops (see engines.js):
 *   old     – old two-cylinder tractor (Ursus), for the Zetor Major
 *   tractor – modern four-cylinder turbo tractor (John Deere), the other tractors
 *   big     – big diesel at idle and at work (MAN, Komatsu): combines, beet and forest harvesters
 *   diesel  – diesel car or van (Tarpan, Mercedes): Duster, Hilux
 *   petrol  – petrol car (Volvo five-cylinder): Lesák
 * Within a set the models differ by pitch (a cheaper, smaller machine sounds higher), loudness and
 * turbo whistle. idle/max are the engine speeds the set's loops cover (rpm of the recordings).
 */
export const SET_RPM = {
  old: { idle: 987, work: 1500, max: 1800 },
  tractor: { idle: 807, work: 1500, max: 1900 },
  big: { idle: 530, work: 1440, max: 1580 },
  diesel: { idle: 720, work: 1600, max: 2400 },
  petrol: { idle: 854, work: 1500, max: 2050 },
};
const KIND_SET = { tractor: 'tractor', combine: 'big', beet: 'big', forest: 'big', jeep: 'diesel' };
const SPECIAL = {
  'zetor-major-80': { set: 'old', turbo: 0 },
  'claas-axion-870': { cvt: true },
  'fendt-942': { cvt: true },
  'sampo-sr2045': { turbo: 0, pitch: 1.14 },
  lesak: { set: 'petrol', turbo: 0, pitch: 0.94 },
  'dacia-duster': { pitch: 1.12, gain: 0.8 },
  'toyota-hilux': { pitch: 0.96 },
};

/** Where a model stands among the models of its kind by price: 0 = the cheapest, 1 = the dearest. */
function rank(m) {
  const same = MODELS.filter(x => x.kind === m.kind).sort((a, b) => a.price - b.price);
  return same.length > 1 ? same.indexOf(m) / (same.length - 1) : 0.5;
}

const cache = new Map();
/**
 * Sound profile of model id: { set, idle, work, max, pitch, gain, turbo, cvt, saw, car, fuel }.
 * car = the engine speed follows a gearbox; cvt = continuously variable gearbox (speed hardly changes
 * the engine speed, a quiet hydrostatic whine instead); saw = the felling head's saw (harvesters).
 */
export function profileOf(id) {
  if (cache.has(id)) return cache.get(id);
  const m = MODEL[id] || MODEL['brazda-140'], r = rank(m), sp = SPECIAL[m.id] || {};
  const set = sp.set || KIND_SET[m.kind] || 'tractor';
  const p = {
    set, ...SET_RPM[set],
    pitch: 1.1 - 0.2 * r, gain: 0.85 + 0.3 * r, turbo: 0.4 + 0.6 * r,
    cvt: false, saw: m.kind === 'forest', car: m.kind === 'jeep', fuel: set === 'petrol' ? 'petrol' : 'diesel',
    ...sp,
  };
  cache.set(id, p);
  return p;
}
