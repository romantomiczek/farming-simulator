// Economy numbers in one place, so `npm run ekonomika` can print what each investment earns.
// No imports: the script loads this file outside the browser.
// Time: at 1× one game hour takes one real minute, a game day 24 minutes.
// Target: buildings and machines pay back in about 5–10 game days of normal play; fields stay the
// main income (a hectare of wheat pays back its price in about four harvests).

/** Fields: Kč per hectare (scaled by soil quality). */
export const FIELD_PER_HA = 1900000, MEADOW_PER_HA = 900000;

/** Animals, for the whole herd per game hour: feed in litres, products to the midnight pickup. */
export const COWS = { price: 650000, feedStore: 30000, feedPerHour: 80, milkPerHour: 400, milkPrice: 9, dairyPrice: 12 };
export const HENS = { price: 140000, feedStore: 1500, feedPerHour: 4, eggsPerHour: 48, eggPrice: 15 };
export const SHEEP = { price: 280000, feedStore: 8000, feedPerHour: 40, woolPerHour: 20, woolPrice: 90 };
export const PIGS = { price: 420000, feedStore: 20000, feedPerHour: 60, meatPerHour: 60, meatPrice: 48 };
/** A round bale of hay unloaded at a feed trough gives this many litres of feed. */
export const HAY_BALE_FEED = 1000;
/** Feed mixer at the cow shed: with grain, hay and beet each at least minShare of the feed, cows give bonus more milk. */
export const MIXER = { price: 220000, bonus: 0.25, minShare: 0.15 };

/** One greenhouse per game hour: water from the pond in, tomatoes out. */
export const GREENHOUSE = { price: 180000, waterStore: 6000, waterPerHour: 40, kgPerHour: 40, kgPrice: 24 };

/** Forestry: a full-grown tree of size 1 holds treeM3 of wood; trees grow from a sapling in growDays. */
export const WOOD = { harvesterPrice: 1600000, pricePerM3: 1500, treeM3: 3.6, logCap: 24, growDays: 3 };

/** Hired helper, Kč per game hour of work (and of driving to the field). */
export const HELPER_WAGE = 1500;

/**
 * Herds (game/animals.js): head count to start with and the most the building holds, value of a
 * healthy animal at the livestock dealer, how fast they breed (young per head and game hour when
 * fed and healthy), and what they leave in litres per head and hour: slurry and manure.
 */
export const HERD = {
  cows: { start: 10, cap: 20, price: 45000, breed: 1 / 240, slurry: 12, manure: 6, perTrailer: 6, one: 'kráva', few: 'krávy', many: 'krav', young: 'tele' },
  pigs: { start: 12, cap: 30, price: 9000, breed: 1 / 120, slurry: 8, manure: 0, perTrailer: 12, one: 'prase', few: 'prasata', many: 'prasat', young: 'sele' },
  sheep: { start: 16, cap: 32, price: 6000, breed: 1 / 200, slurry: 0, manure: 4, perTrailer: 12, one: 'ovce', few: 'ovce', many: 'ovcí', young: 'jehně' },
  hens: { start: 40, cap: 90, price: 300, breed: 1 / 60, slurry: 0, manure: 0.3, perTrailer: 60, one: 'slepice', few: 'slepice', many: 'slepic', young: 'kuře' },
};
/** Health 0..1: fed animals get better by healthUp an hour, hungry ones worse by healthDown; below sickBelow some die. */
export const HEALTH = { up: 0.03, down: 0.05, breedAbove: 0.75, sickBelow: 0.2, deathPerHour: 0.01 };
/** The farm's slurry pit and manure heap (litres), and how much the spreaders put on a square metre. */
export const DUNG = { slurryCap: 120000, manureCap: 80000, slurryPerM2: 2, manurePerM2: 1.5 };
/** Pallets of products, and what the market hall in the town pays on top of the midnight pickup. */
export const PALLET = { eggs: 600, wool: 120, tomatoes: 300, bonus: 0.4, maxStack: 6 };
