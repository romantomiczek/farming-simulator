import { hash2 } from '../core/util.js';
import { G, dayOf } from './state.js';

/**
 * Seasons of DAYS_PER_SEASON game days. The game starts in summer (the first crops are ripe).
 * growth = crop growth speed, rain = chance of rain per 4-hour slot, sow = sowing allowed.
 * terrain/leaves = colour multipliers (linear RGB, may exceed 1 to lighten).
 */
export const DAYS_PER_SEASON = 3;
export const SEASONS = [
  { name: 'Jaro', growth: 1.0, rain: 0.3, sow: true, terrain: [0.98, 1.06, 0.96], leaves: [1.05, 1.15, 0.95] },
  { name: 'Léto', growth: 1.15, rain: 0.16, sow: true, terrain: [1.06, 1.0, 0.86], leaves: [1, 1, 1] },
  { name: 'Podzim', growth: 0.85, rain: 0.35, sow: true, terrain: [1.25, 0.98, 0.7], leaves: [2.1, 1.05, 0.45] },
  { name: 'Zima', growth: 0, rain: 0.3, sow: false, terrain: [1.45, 1.45, 1.5], leaves: [1.25, 1.0, 0.85] },
];
export const seasonIdx = day => (Math.floor(day / DAYS_PER_SEASON) + 1) % 4;
export const season = () => SEASONS[seasonIdx(dayOf(G.gameMin))];
export const dayInSeason = () => (dayOf(G.gameMin) % DAYS_PER_SEASON) + 1;
export const isWinter = () => seasonIdx(dayOf(G.gameMin)) === 3;

/** Weather changes in 4-hour slots, decided by a seeded hash so a save always sees the same sky. */
const SLOT = 240;
export function weatherAt(min) {
  const day = dayOf(min), slot = Math.floor((min % 1440) / SLOT);
  const r = hash2(day * 13.7 + slot * 1.3, 4.1 + day * 0.31);
  const s = SEASONS[seasonIdx(day)];
  if (r < s.rain) return 'rain';
  if (r < s.rain + 0.3) return 'cloudy';
  return 'clear';
}
export const weatherName = (kind, winter) => (kind === 'rain' ? (winter ? 'Sněží' : 'Prší') : kind === 'cloudy' ? 'Oblačno' : 'Jasno');

/** Current weather; rain and cloud are smoothed 0..1 levels for rendering. */
/** force = 'clear' | 'cloudy' | 'rain' overrides the forecast (developer panel), null = normal weather. */
export const WX = { kind: 'clear', rain: 0, cloud: 0, wetUntil: 0, force: null };

export function updateWeather(dt) {
  WX.kind = WX.force || weatherAt(G.gameMin);
  if (WX.kind === 'rain') WX.wetUntil = G.gameMin + 60; // crops stay wet an hour after the rain
  const k = Math.min(1, dt * 0.4);
  WX.rain += ((WX.kind === 'rain' ? 1 : 0) - WX.rain) * k;
  WX.cloud += ((WX.kind === 'clear' ? 0 : 1) - WX.cloud) * k;
}
/** Harvesting is not possible in the rain and for an hour after it. */
export const isWet = () => WX.kind === 'rain' || G.gameMin < WX.wetUntil;

/** Next change of weather within a day: { kind, at } or null. */
export function forecast() {
  const start = Math.floor(G.gameMin / SLOT) * SLOT;
  for (let k = 1; k <= 6; k++) {
    const at = start + k * SLOT, kind = weatherAt(at);
    if (kind !== WX.kind) return { kind, at };
  }
  return null;
}
