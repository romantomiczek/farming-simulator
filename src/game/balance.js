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

/**
 * How a new game starts (save.js newGame): money, whether the farm has its fields and machines, and the
 * buyers' prices (sell). New farmer = fields 1 and 2 and the starting fleet; farm manager = money and
 * nothing else; from scratch = a car and less money, and the buyers pay less.
 */
export const MODES = {
  farmer: { name: 'Nový farmář', money: 150000, fleet: true, fields: true, sell: 1 },
  manager: { name: 'Správce farmy', money: 1500000, fleet: false, fields: false, sell: 1 },
  scratch: { name: 'Začátek od nuly', money: 500000, fleet: false, fields: false, sell: 0.9 },
};

/** Hired helper, Kč per game hour of work (and of driving to the field); at most HELPER_MAX work at once. */
export const HELPER_WAGE = 1500, HELPER_MAX = 5;

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
/** Pallets of products (units on one pallet), and what the market hall in the town pays on top of the midnight pickup. */
export const PALLET = { eggs: 600, wool: 120, tomatoes: 300, flour: 500, bread: 400, oil: 200, planks: 2, bonus: 0.4, maxStack: 6 };

/**
 * Buildings you put up yourself (game/build.js): price, footprint w × d in metres, at most max of a kind.
 * A silo adds silo litres to the farm silos, a cow shed room for cows more cows; refund = share of the
 * price you get back for pulling one down.
 */
export const BUILDS = {
  silo: { price: 380000, w: 9, d: 9, max: 3, silo: 150000 },
  shed: { price: 260000, w: 16, d: 11, max: 2 },
  cowshed: { price: 520000, w: 18, d: 12, max: 2, cows: 20 },
  mill: { price: 900000, w: 12, d: 10, max: 1 },
  bakery: { price: 700000, w: 12, d: 9, max: 1 },
  oilmill: { price: 800000, w: 14, d: 9, max: 1 },
  sawmill: { price: 600000, w: 16, d: 10, max: 1 },
  refund: 0.5,
};
/**
 * The farm's own production (game/production.js), per game hour while there is input: in = litres of a
 * crop (crops), kg of flour (from flour pallets) or m³ of logs; make = units of out per hour, onto
 * pallets of PALLET[out]; price = Kč a unit (the market hall pays PALLET.bonus more); store = input the
 * building holds; outCap = full pallets it keeps before it stops.
 */
export const PRODUCTION = {
  mill: { crops: [0, 1], in: 800, out: 'flour', make: 600, store: 60000, price: 11 },
  bakery: { pallet: 'flour', in: 300, out: 'bread', make: 400, store: 6000, price: 14 },
  oilmill: { crops: [2, 4], in: 400, out: 'oil', make: 160, store: 40000, price: 40 },
  sawmill: { logs: true, in: 2, out: 'planks', make: 1.5, store: 60, price: 3200 },
  outCap: 20,
};

/**
 * Silage (game/forage.js): the bunker holds cap litres of chaff; it has to be packed (driven over)
 * before it is covered, then ferments for fermentH game hours. Chaff per square metre: maize from
 * the chopper, grass from the forage wagon or the chopper's pickup. What the biogas plant pays per
 * litre, and bale prices at the barn (grass unwrapped, wrapped silage).
 */
export const SILAGE = { cap: 300000, packNeed: 0.9, fermentH: 24, coverMin: 20000, cornPerM2: 30, grassPerM2: 12, chaffPrice: 0.6, silagePrice: 1.8, grassBale: 600, silageBale: 2200, wrapCost: 60, baleFeed: 1200 };
/** A mown windrow dries into hay by itself in dryH game hours; tedded grass in teddedH. */
export const HAY_DRY = { dryH: 6, teddedH: 1.5 };

/**
 * Seed, fertiliser, lime and herbicide (game/supply.js): sold at the farm store in big bags of bag kg
 * (an IBC of bag litres for the herbicide), price in Kč per kg or l. The seeder, the spreader and the
 * sprayer carry them in their hoppers and use the Kč/m² of crops.js divided by the price, so a square
 * metre costs what it did when it was paid as you drove. A helper has a refill brought out for
 * delivery more.
 */
export const SUPPLY = { seed: { price: 50, bag: 1000 }, fert: { price: 10, bag: 1000 }, lime: { price: 3, bag: 1000 }, herb: { price: 25, bag: 1000 }, delivery: 0.1 };

/** Loaders (game/loader.js): what the bucket holds (l) and how many round bales the grab carries. */
export const LOADER = { bucket: 2500, frontBucket: 1500, bales: 2, frontBales: 1, price: 260000 };
