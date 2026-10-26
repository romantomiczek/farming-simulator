import { hash2 } from '../core/util.js';
import { G, dayOf } from './state.js';

/**
 * Seasons of DAYS_PER_SEASON game days. The game starts in summer (the first crops are ripe).
 * growth = crop growth speed, rain = chance of rain per 4-hour slot, sow = sowing allowed,
 * storm = share of the rainy slots that are thunderstorms, hail = share of the storms that bring hail
 * (it damages the crops, game/climate.js), drought = chance that a day is a dry one: no rain, and the
 * growing crops lose yield. terrain/leaves = colour multipliers (linear RGB, may exceed 1 to lighten).
 */
export const DAYS_PER_SEASON = 3;
export const SEASONS = [
  { name: 'Jaro', growth: 1.0, rain: 0.3, sow: true, storm: 0.2, hail: 0.3, drought: 0, terrain: [0.98, 1.06, 0.96], leaves: [1.05, 1.15, 0.95] },
  { name: 'Léto', growth: 1.15, rain: 0.16, sow: true, storm: 0.55, hail: 0.35, drought: 0.3, terrain: [1.06, 1.0, 0.86], leaves: [1, 1, 1] },
  { name: 'Podzim', growth: 0.85, rain: 0.35, sow: true, storm: 0.1, hail: 0.15, drought: 0, terrain: [1.25, 0.98, 0.7], leaves: [2.1, 1.05, 0.45] },
  { name: 'Zima', growth: 0, rain: 0.3, sow: false, storm: 0, hail: 0, drought: 0, terrain: [1.45, 1.45, 1.5], leaves: [1.25, 1.0, 0.85] },
];
export const seasonIdx = day => (Math.floor(day / DAYS_PER_SEASON) + 1) % 4;
export const season = () => SEASONS[seasonIdx(dayOf(G.gameMin))];
export const dayInSeason = () => (dayOf(G.gameMin) % DAYS_PER_SEASON) + 1;
export const isWinter = () => seasonIdx(dayOf(G.gameMin)) === 3;

/** Weather changes in 4-hour slots, decided by a seeded hash so a save always sees the same sky. */
const SLOT = 240;
/** Is game day `day` a dry day (summer drought: no rain at all)? Never the first day of a game. */
export const droughtDay = day => day > 0 && hash2(day * 3.17 + 0.5, 9.4) < SEASONS[seasonIdx(day)].drought;
export function weatherAt(min) {
  const day = dayOf(min), slot = Math.floor((min % 1440) / SLOT);
  const r = hash2(day * 13.7 + slot * 1.3, 4.1 + day * 0.31);
  const s = SEASONS[seasonIdx(day)];
  if (droughtDay(day)) return 'clear';
  if (r < s.rain) {
    if (hash2(day * 5.9 + slot * 2.3, 1.7 + slot) >= s.storm) return 'rain';
    return hash2(day * 8.1 + slot * 0.7, 3.3) < s.hail ? 'hail' : 'storm';
  }
  if (r < s.rain + 0.3) return 'cloudy';
  return 'clear';
}
/** Rain, a thunderstorm or hail: it pours (snow in winter). */
export const isRainy = kind => kind === 'rain' || kind === 'storm' || kind === 'hail';
export const weatherName = (kind, winter) => (isRainy(kind) && winter ? 'Sněží' : kind === 'rain' ? 'Prší' : kind === 'storm' ? 'Bouřka' : kind === 'hail' ? 'Krupobití' : kind === 'cloudy' ? 'Oblačno' : 'Jasno');

/**
 * Current weather; rain and cloud are smoothed 0..1 levels for rendering, bolt = a lightning flash
 * (1 when it strikes, fading), thunder counts the strikes (the sound follows), drought = a dry day.
 * force = 'clear' | 'cloudy' | 'rain' | 'storm' | 'hail' overrides the forecast (developer panel), null = normal weather.
 */
export const WX = { kind: 'clear', rain: 0, cloud: 0, wetUntil: 0, force: null, bolt: 0, boltT: 0, thunder: 0, drought: false };

export function updateWeather(dt) {
  WX.kind = WX.force || weatherAt(G.gameMin);
  WX.drought = !WX.force && droughtDay(dayOf(G.gameMin));
  const wet = isRainy(WX.kind);
  if (wet) WX.wetUntil = G.gameMin + 60; // crops stay wet an hour after the rain
  const k = Math.min(1, dt * 0.4);
  WX.rain += ((wet ? 1 : 0) - WX.rain) * k;
  WX.cloud += ((WX.kind === 'clear' ? 0 : 1) - WX.cloud) * k;
  // lightning every few seconds in a storm (not in winter's snow)
  WX.bolt = Math.max(0, WX.bolt - dt * 4);
  if ((WX.kind === 'storm' || WX.kind === 'hail') && !isWinter() && WX.rain > 0.5 && (WX.boltT -= dt) <= 0) {
    WX.bolt = 1; WX.thunder++; WX.boltT = 3 + Math.random() * 7;
  }
}
/** Harvesting is not possible in the rain and for an hour after it. */
export const isWet = () => isRainy(WX.kind) || G.gameMin < WX.wetUntil;

/** Which 4-hour slot game minute min is in (the hail hits once per slot). */
export const slotOf = min => Math.floor(min / SLOT);
/** Next change of weather within a day: { kind, at } or null. */
export function forecast() {
  const start = Math.floor(G.gameMin / SLOT) * SLOT;
  for (let k = 1; k <= 6; k++) {
    const at = start + k * SLOT, kind = weatherAt(at);
    if (kind !== WX.kind) return { kind, at };
  }
  return null;
}
