/** Mutable game state shared by all modules. Vehicles and fields live in their own modules. */
export const TIME_SCALES = [1, 5, 20];

export const G = {
  money: 150000,
  gameMin: 8 * 60, // game minutes since day 1, 00:00; 1 real second = 1 game minute at 1×
  tsIdx: 0,
  playing: false,
  active: null, // the vehicle the player drives
  flashT: 0, // money highlight timer
  loan: 0,
  machines: {}, // catalog key → 'own' | 'lease' | null
  cond: {}, // catalog key → condition 0..1 (1 = new)
  lastDay: 0, // last day the daily costs were charged for
  contracts: { offers: [], active: null },
};

/** Speed multiplier from wear: full speed down to 50 % condition, then down to 70 % at 0. */
export const condFactor = c => (c >= 0.5 ? 1 : 0.7 + 0.6 * c);
export const dayOf = min => Math.floor(min / 1440);
