/** Mutable game state shared by all modules. Vehicles and fields live in their own modules. */
export const TIME_SCALES = [1, 5, 20];

/**
 * Developer switches (the panel behind F9). Defaults mean "normal game".
 * timeMult multiplies the chosen time speed; freezeTime stops the clock (machines still drive).
 */
export const DEV = { timeMult: 1, freezeTime: false, wildlife: true, tracks: true, wind: true };

export const G = {
  money: 150000,
  gameMin: 8 * 60, // game minutes since day 1, 00:00; 1 real second = 1 game minute at 1×
  tsIdx: 0,
  playing: false,
  active: null, // the vehicle the player drives (or drove last, when on foot)
  onFoot: false, // the player walks (world/person.js) instead of driving G.active
  flashT: 0, // money highlight timer
  loan: 0,
  machines: {}, // catalog key → 'own' | 'lease' | null
  cond: {}, // catalog key → condition 0..1 (1 = new)
  lastDay: 0, // last day the daily costs were charged for
  contracts: { offers: [], active: null },
  silo: { stock: [0, 0, 0, 0, 0, 0], pick: 0 }, // grain in the farm silos (game/silo.js)
  deliveries: { offers: [], active: [] }, // delivery contracts (game/silo.js)
  farm: { cowFeed: 0, henFeed: 0, sheepFeed: 0, pigFeed: 0, water: 0, milk: 0, eggs: 0, wool: 0, pork: 0, tomatoes: 0, hungry: {}, mix: { grain: 0, hay: 0, beet: 0 } }, // see farm.js emptyFarm()
  stats: null, // see goals.js emptyStats()
  goals: [], // ids of finished goals
};

/** Speed multiplier from wear: full speed down to 50 % condition, then down to 70 % at 0. */
export const condFactor = c => (c >= 0.5 ? 1 : 0.7 + 0.6 * c);
export const dayOf = min => Math.floor(min / 1440);
