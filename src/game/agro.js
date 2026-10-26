import {
  CROPS, S_STUB, S_CULT, S_SOWN, S_RIPE, S_NONE, B_FERT, B_PLOW, B_FERT2, B_ROLL, B_MULCH, B_STONE, B_ROT, B_MONO,
  FERT_BONUS, PLOW_BONUS, FERT2_BONUS, ROLL_BONUS, MULCH_BONUS, ROT_BONUS, MONO_LOSS,
} from './crops.js';
import { SEASONS, seasonIdx } from './weather.js';
import { G, dayOf } from './state.js';

/**
 * Field work beyond plough, seed and fertiliser, as in Farming Simulator 25. Every 1 m cell keeps:
 * - weeds (f.weed: level 0..3 in the low bits, WEED_SPRAYED once the sprayer has been over it):
 *   they come up while the crop grows unless it was sprayed, and cost up to a quarter of the yield;
 * - lime (f.lime: harvests since the cell was limed): from LIME_DUE harvests on the soil is sour;
 * - the crop before (f.prev, crop + 1): a different crop gives the rotation bonus, the same one a loss;
 * - bonus bits (crops.js): fertiliser once and twice, plough, roller, mulch, stones from ploughing;
 * - overripe: a ripe crop left standing WITHER_H game hours withers and gives half.
 * cellYield() puts it together; fieldYield() gives the field's breakdown for the office and the map.
 */
export const WEED_SPRAYED = 4, WEED_LOSS = [0, 0.05, 0.15, 0.25];
export const LIME_DUE = 3, LIME_LOSS = 0.15;
export const WITHER_H = 16, WITHER_LOSS = 0.5;
export const weedLevel = (f, i) => f.weed[i] & 3;

/** Yield multiplier of cell i (fertiliser, plough, rotation… and the losses), before the field's quality. */
export function cellYield(f, i) {
  const b = f.bonus[i];
  let m = 1 + (b & B_FERT ? FERT_BONUS : 0) + (b & B_FERT2 ? FERT2_BONUS : 0) + (b & B_PLOW ? PLOW_BONUS : 0)
    + (b & B_ROLL ? ROLL_BONUS : 0) + (b & B_MULCH ? MULCH_BONUS : 0) + (b & B_ROT ? ROT_BONUS : 0) - (b & B_MONO ? MONO_LOSS : 0);
  m *= 1 - WEED_LOSS[weedLevel(f, i)];
  if (f.lime[i] >= LIME_DUE) m *= 1 - LIME_LOSS;
  if (f.state[i] === S_RIPE && f.stage[i] === 5) m *= 1 - WITHER_LOSS;
  if (f.dmg[i]) m *= 1 - f.dmg[i] / 100; // hail and drought (game/climate.js)
  return m;
}

/** At sowing: the rotation bit from the crop grown here last time, clean of weeds. */
export function sowCell(f, i, crop) {
  const prev = f.prev[i] - 1;
  f.bonus[i] &= ~(B_ROT | B_MONO);
  if (prev >= 0) f.bonus[i] |= prev === crop ? B_MONO : B_ROT;
  f.weed[i] = 0; f.dmg[i] = 0;
}
/** At harvest: remember the crop, one more harvest since liming, the weeds go with the crop. */
export function harvestCell(f, i) {
  f.prev[i] = f.crop[i] + 1;
  if (f.lime[i] < 255) f.lime[i]++;
  f.weed[i] = 0; f.dmg[i] = 0;
}
/** A growing cell moved up a stage: weeds spread on unsprayed cells (most of them, not all). */
export function weedsGrow(f, i, stage) {
  const w = f.weed[i];
  if (w & WEED_SPRAYED || stage < 1) return false;
  const r = (f.jit[i] * 97.13 + stage * 0.377) % 1;
  if (r > 0.72 || (w & 3) >= 3) return false;
  f.weed[i] = (w & 3) + 1;
  return true;
}

/** Can crop k be sown now (its season in the calendar)? */
export const sowable = (k, min = G.gameMin) => CROPS[k].sowIn.includes(seasonIdx(dayOf(min)));
/** "léto, podzim" */
export const sowSeasons = k => CROPS[k].sowIn.map(s => SEASONS[s].name.toLowerCase()).join(', ');
/** Crops that may be sown now. */
export const sowableNow = () => CROPS.map((_, k) => k).filter(k => sowable(k));

/**
 * The yield breakdown of field f, as Farming Simulator shows it: each factor's effect in per cent on
 * the cells that carry a crop (or, on a bare field, on all of them, for what the next crop would get),
 * and the total against a field with nothing done to it.
 */
export function fieldYield(f) {
  let n = 0, sum = 0;
  const c = { fert: 0, fert2: 0, plow: 0, roll: 0, mulch: 0, rot: 0, mono: 0, weed: 0, lime: 0, wither: 0, stone: 0, dmg: 0 };
  const grown = f.cnt[S_SOWN] + f.cnt[S_RIPE] > f.area * 0.2;
  for (let i = 0; i < f.n; i++) {
    const s = f.state[i];
    if (s === S_NONE || (grown && s !== S_SOWN && s !== S_RIPE)) continue;
    const b = f.bonus[i];
    n++; sum += cellYield(f, i);
    if (b & B_FERT) c.fert++; if (b & B_FERT2) c.fert2++; if (b & B_PLOW) c.plow++; if (b & B_ROLL) c.roll++; if (b & B_MULCH) c.mulch++;
    if (b & B_ROT) c.rot++; if (b & B_MONO) c.mono++; if (b & B_STONE) c.stone++;
    c.weed += WEED_LOSS[weedLevel(f, i)];
    if (f.lime[i] >= LIME_DUE) c.lime++;
    if (s === S_RIPE && f.stage[i] === 5) c.wither++;
    c.dmg += f.dmg[i] / 100;
  }
  const k = x => (n ? x / n : 0), rows = [
    ['Hnojení', k(c.fert) * FERT_BONUS], ['Druhé hnojení', k(c.fert2) * FERT2_BONUS], ['Orba', k(c.plow) * PLOW_BONUS],
    ['Válení', k(c.roll) * ROLL_BONUS], ['Mulčování', k(c.mulch) * MULCH_BONUS], ['Osevní postup', k(c.rot) * ROT_BONUS - k(c.mono) * MONO_LOSS],
    ['Plevel', -k(c.weed)], ['Vápnění', -k(c.lime) * LIME_LOSS], ['Přezrálé', -k(c.wither) * WITHER_LOSS], ['Počasí', -k(c.dmg)],
  ].map(([label, v]) => ({ label, v }));
  return { total: n ? sum / n : 1, rows, q: f.q, stones: k(c.stone), grown, need: { lime: k(c.lime), weed: k(c.weed) } };
}

/** The office and map's short form: "výnos 118 % · hnojení +25 %, plevel −8 %". */
export function yieldLine(f) {
  const y = fieldYield(f), parts = y.rows.filter(r => Math.abs(r.v) >= 0.005).map(r => r.label.toLowerCase() + ' ' + (r.v > 0 ? '+' : '−') + Math.round(Math.abs(r.v) * 100) + ' %');
  return 'Výnos ' + Math.round(y.total * f.q * 100) + ' %' + (parts.length ? ' · ' + parts.join(', ') : '');
}

