/** Mutable game state shared by all modules. Vehicles and fields live in their own modules. */
export const TIME_SCALES = [1, 5, 20];

export const G = {
  money: 150000,
  gameMin: 8 * 60, // game minutes since day 1, 00:00; 1 real second = 1 game minute at 1×
  tsIdx: 0,
  playing: false,
  active: null, // the vehicle the player drives
  flashT: 0, // money highlight timer
};
