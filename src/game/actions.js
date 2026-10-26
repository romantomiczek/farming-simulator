import { playAt } from '../audio.js';
import { fmt } from '../core/util.js';
import { G, TIME_SCALES } from './state.js';
import { CROPS, HEADERS } from './crops.js';
import {
  sellPoint, inBaleZone, trailerInReach, trailerUnder, startUnload, stopUnload, startTipping, stopTipping, sellBales, startLoading, stopLoading,
} from './work.js';
import { inSiloLoad, siloCrop, cycleSiloCrop, siloSpace, siloCap, extraSilo } from './silo.js';
import { inBuiltShed } from './build.js';
import { atProd, prodTake, prodIn } from './production.js';
import { PALLET, PRODUCTION } from './balance.js';
import { sowable, sowSeasons, LIME_DUE } from './agro.js';
import {
  buildingAt, atDealer, atHall, atSlurry, atManure, trailerAtBuilding, loadAnimals, unloadAnimals, dealerAction, sellAnimals, buyAnimals,
  cycleBuyKind, palletsHere, loadPallets, sellPallets, herdName, productPallets,
} from './animals.js';
import { DUNG, SILAGE } from './balance.js';
import { atBunkerRing, bunkerAction, forageIn, forageTarget, atCows, cover, loadSilage } from './forage.js';
import { FERT_COST, LIME_COST } from './crops.js';
import { saveLocal } from './save.js';
import { has, returnLent } from './machines.js';
import { inFuel, refuel, repair } from './economy.js';
import { marketAt, buyersOf, hayFeederAt } from './markets.js';
import { hire, dismiss } from './helpers.js';
import { greenhouses, waterCap, feedHay, BUILDINGS } from './farm.js';
import { COWS } from './balance.js';
import { earn } from './goals.js';
import { inSawmill, treeInReach, fell, sellLogs } from './forestry.js';
import { POND_FILL, GREENHOUSE_WATER, MILK_LOAD, DAIRY } from '../world/layout.js';
import {
  trailerCenter, vehicles, towed, firstOf, HARVESTERS, setHeader, labelOf, toolInReach, toolNearby, dropTool, attachTool, HOPPER, cartInReach, nearestCart,
  headerOn, headerOff, hitchCart, unhitchCart, frontLoaderOn, frontLoaderOff,
} from '../vehicles/vehicles.js';
import { atStore, wantKind, toolAt, bagTrailerNear, bagStock, takeFromBags, pourInto, buyFill, fillCost, cycleSupply, supplyPick, buyBag, SUPPLIES } from './supply.js';
import { SUPPLY } from './balance.js';
import { hasLoader, doL, headPoint } from './loader.js';
import { keys } from '../core/input.js';
import { signs, drawSign } from '../world/fields.js';
import { shedZone } from '../world/layout.js';
import { cam, LOOK_UP } from '../render/camera.js';
import { toast } from '../ui/toast.js';
import { person, machineInReach, seat, leave } from '../world/person.js';
import { inWash, needsWash, startWash } from './dirt.js';
import { festAction, startRace, claimContest } from './festival.js';

export const inShed = v => (v.x > shedZone.x0 && v.x < shedZone.x1 && v.z > shedZone.z0 && v.z < shedZone.z1) || inBuiltShed(v);
export const nearSign = v => signs.find(s => !s.f.owned && Math.hypot(v.x - s.x, v.z - s.z) < 10);
export const otherHeader = v => (v.header === 'grain' ? (has('cornHeader') ? 'corn' : null) : 'grain');

/** What F would do right now for the active vehicle (on foot: buying the field at a sign), or null. Shared by doF() and the HUD prompts. */
export function fAction() {
  if (G.onFoot) {
    const s = nearSign(person), bunker = atBunkerRing(person) ? bunkerAction(null) : null;
    return festAction(person, false) || bunker || (s ? { kind: 'buy', sign: s } : null);
  }
  const v = G.active;
  const fest = festAction(v, v.type === 'tractor' && !v.helper);
  if (fest) return fest;
  if (inWash(v) && needsWash(v)) return { kind: 'wash', v };
  if (inFuel(v) && v.fuel < v.fuelCap - 1) return { kind: 'refuel', v };
  if (v.type === 'forest') {
    if (v.cutting) return null;
    if (v.logs > 0 && atProd(v, 'sawmill')) return PRODUCTION.sawmill.store - prodIn('sawmill') >= 0.5 ? { kind: 'logsIn' } : { kind: 'prodFull', name: 'Tvoje pila' };
    if (v.logs > 0 && inSawmill(v)) return { kind: 'sellLogs' };
    const i = treeInReach(v);
    if (i >= 0) return { kind: 'fell', i };
    return null;
  }
  if (v.type === 'tractor' && v.impl === 'livestock') {
    const t = v.tool, tc = trailerCenter(t), key = buildingAt(tc);
    if (key) return trailerAtBuilding(t, key);
    if (atDealer(tc)) return dealerAction(t);
  }
  if (v.type === 'tractor' && (v.impl === 'manure' || v.impl === 'slurry')) {
    const t = v.tool, tc = trailerCenter(t), slurry = v.impl === 'slurry', stock = slurry ? G.farm.slurry : G.farm.manure;
    if ((slurry ? atSlurry(tc) : atManure(tc)) && t.load < t.loadCap - 1) return stock >= 1 ? { kind: 'fillDung', t, slurry, l: Math.min(stock, t.loadCap - t.load) } : { kind: 'noDung', slurry };
  }
  if (v.type === 'tractor' && HOPPER[v.impl]) {
    // seed, fertiliser, lime and herbicide: at the store, or from big bags on a trailer standing by
    const im = v.tool, want = wantKind(v), p = toolAt(im);
    if (atStore(v) || atStore(p)) return im.fill.kind === want && im.fill.amount >= im.fillCap - 1 ? { kind: 'hopperFull', im } : { kind: 'fillHopper', im, what: want, cost: fillCost(im, want) };
    const tb = im.fill.amount < im.fillCap - 1 && (im.fill.kind === want || im.fill.amount < 1) ? bagTrailerNear(p, want) : null;
    if (tb) return { kind: 'bagFill', im, t: tb, what: want, l: Math.min(im.fillCap - (im.fill.kind === want ? im.fill.amount : 0), bagStock(tb, want)) };
  }
  if (v.type === 'tractor' && v.impl === 'watertank') {
    const w = v.tool, near = z => Math.hypot(v.x - z.x, v.z - z.z) < z.r;
    if (w.milk && w.water > 0 && near(DAIRY)) return { kind: 'sellMilk', w };
    if (near(MILK_LOAD) && has('cows') && G.farm.milk >= 1 && (w.milk || w.water <= 0) && w.water < w.waterCap - 1) return { kind: 'loadMilk', w };
    if (!w.milk && near(POND_FILL) && w.water < w.waterCap - 1) return { kind: 'fillWater', w };
    if (!w.milk && near(GREENHOUSE_WATER) && w.water > 0 && greenhouses() && G.farm.water < waterCap() - 1) return { kind: 'giveWater', w };
  }
  if (v.type === 'chopper') {
    const a = atBunkerRing(v) ? bunkerAction(null) : null; // the chopper packs the heap too, and its driver may cover it
    if (a) return a;
  } else if (v.harvester) {
    if (v.unloading) return { kind: 'stopUnload', h: v };
    if (v.tank.amount > 0 && sellPoint(v, v.tank.crop)) return { kind: 'sell', h: v, m: sellPoint(v, v.tank.crop) };
    if (v.tank.amount > 0 && marketAt(v)) return { kind: 'wrongMarket', m: marketAt(v), crop: v.tank.crop };
    if (v.tank.amount > 0 && trailerUnder(v)) return { kind: 'overload', h: v };
    if (v.type === 'combine' && inShed(v) && otherHeader(v)) return { kind: 'header', header: otherHeader(v) };
  } else {
    const t = towed(v), tc = t && trailerCenter(t);
    if (t?.tipping) return { kind: 'stopTip', t };
    // silage: chaff into the bunker, silage out of it, to the cows or the biogas plant
    if (atBunkerRing(tc || v)) { const a = bunkerAction(t); if (a) return a; }
    if (forageIn(t)) {
      const target = forageTarget(tc, t.forage.kind);
      if (target) return { kind: 'tipForage', t, target };
      if (t.forage.kind === 'chaff' && atCows(tc)) return { kind: 'chaffCows' };
    }
    if (t && t.pallets.includes('flour') && atProd(tc, 'bakery')) return PRODUCTION.bakery.store - prodIn('bakery') >= PALLET.flour ? { kind: 'flourIn', t } : { kind: 'prodFull', name: 'Tvoje pekárna' };
    if (t && productPallets(t).length && atHall(tc)) return { kind: 'sellPallets', t };
    if (t && !t.tank.amount && !t.bales && !forageIn(t) && t.pallets.length < t.baleCap) { const p = palletsHere(tc); if (p) return { kind: 'loadPallets', t, p }; }
    if (t?.loading) return { kind: 'stopLoad', t };
    if (t && t.key === 'trailer' && atStore(tc) && !t.tank.amount && !t.bales && !forageIn(t) && !t.pickup) {
      const k = supplyPick();
      return t.pallets.length < t.baleCap ? { kind: 'buyBag', t, what: k, cost: SUPPLY[k].bag * SUPPLY[k].price } : { kind: 'trailerFull' };
    }
    if (t && t.key === 'trailer' && inSiloLoad(tc) && !t.bales && !forageIn(t) && t.tank.amount < t.tank.cap - 1) {
      const crop = siloCrop();
      if (crop >= 0 && (t.tank.amount <= 0 || t.tank.crop === crop)) return { kind: 'loadSilo', t, crop };
    }
    if (t && t.tank.amount > 0 && sellPoint(tc, t.tank.crop)) return { kind: 'tip', t, m: sellPoint(tc, t.tank.crop) };
    if (t && t.tank.amount > 0 && marketAt(tc)) return { kind: 'wrongMarket', m: marketAt(tc), crop: t.tank.crop };
    { const m = t && hayFeederAt(tc); if (m && (t.hay > 0 || (m.feed === 'cows' && t.silage > 0))) return { kind: 'feedHay', t, m }; }
    if (t && t.bales > 0 && inBaleZone(tc)) return { kind: 'sellBales', t };
    if (t) for (const h of HARVESTERS) if (h.unloading && trailerInReach(h, t)) return { kind: 'stopUnload', h };
    if (t) for (const h of HARVESTERS) if (h.tank.amount > 0 && trailerInReach(h, t)) return { kind: 'overload', h };
  }
  const s = nearSign(v);
  if (s) return { kind: 'buy', sign: s };
  // anywhere else a trailer with grain or forage tips it onto a heap on the ground (a loader takes it up again)
  const tg = towed(v);
  if (tg && !tg.tipping && (tg.tank.amount > 0 || forageIn(tg) > 0)) return { kind: 'tipGround', t: tg };
  return null;
}

/** The farm intake (Družstvo) takes the crop: the coop's ring, where G stores instead of selling; a silo you built takes it at its outlet ring. */
const atIntake = (m, p) => m?.id === 'coop' || (p && extraSilo.loads.some(z => Math.hypot(p.x - z.x, p.z - z.z) < z.r));
/** What G would do: store the harvester's or trailer's grain in the farm silos at the intake, or null. */
export function gAction() {
  if (G.onFoot) return null;
  const v = G.active;
  if (v.type === 'chopper') return null;
  if (v.harvester) return !v.unloading && v.tank.amount > 0 && atIntake(sellPoint(v, v.tank.crop), v) ? { kind: 'store', h: v } : null;
  const t = towed(v), tc = t && trailerCenter(t);
  return t && !t.tipping && t.tank.amount > 0 && atIntake(sellPoint(tc, t.tank.crop), tc) ? { kind: 'storeTip', t } : null;
}
/** G: store in the silos. */
export function doG() {
  const a = gAction();
  if (!a) { if (!G.onFoot) toast('Úrodu uskladníš klávesou G v kruhu Družstva na statku (u sil).'); return; }
  if (siloSpace() < 1) { toast('Sila jsou plná (' + fmt(siloCap()) + ' l). Nalož část zásoby do přívěsu u výdeje a prodej ji.', 'bad'); return; }
  if (a.kind === 'store') startUnload(a.h, true); else startTipping(a.t, true);
}
/** C: at the silo outlet with a trailer the next stored crop; at the dealer the animals to buy; with the spreader fertiliser or lime; else the seed. */
export function doC() {
  const v = !G.onFoot && G.active, t = v && towed(v);
  if (t && t.key === 'trailer' && inSiloLoad(trailerCenter(t))) { cycleSiloCrop(); return; }
  if ((t && t.key === 'trailer' && atStore(trailerCenter(t))) || (hasLoader(v) && !v.ld.carry && atStore(headPoint(v)))) {
    const k = cycleSupply();
    toast('Ve skladu naložíš: ' + SUPPLIES[k].bag + ' (' + fmt(SUPPLY[k].bag) + ' ' + SUPPLIES[k].unit + ' za ' + fmt(SUPPLY[k].bag * SUPPLY[k].price) + ' Kč)');
    return;
  }
  if (v?.impl === 'livestock' && atDealer(trailerCenter(v.tool)) && !v.tool.animals.n) { cycleBuyKind(v.tool); return; }
  if (v?.type === 'tractor' && v.impl === 'spreader') {
    v.spreadLime = !v.spreadLime;
    toast(v.spreadLime ? 'Rozmetadlo sype vápno · ' + LIME_COST + ' Kč/m². Kyselá půda (po ' + LIME_DUE + ' sklizních) bere 15 % výnosu.' : 'Rozmetadlo sype hnojivo · ' + FERT_COST + ' Kč/m². Druhá dávka na vzrostlé plodiny dá dalších +10 %.');
    return;
  }
  cycleSeed();
}

/** On foot, the keys that work a machine only say how to get into one. */
const needSeat = () => { if (G.onFoot) toast('Jsi pěšky. Dojdi ke stroji a nastup klávesou E.'); return G.onFoot; };

/** V: the view from the driver's seat, or back to the camera behind the machine. */
export function toggleCabView() {
  if (G.onFoot) { toast('Pohled z kabiny je jen ve stroji. Nastup klávesou E.'); return; }
  cam.cab = !cam.cab;
  cam.look = 0; cam.lookUp = LOOK_UP;
  if (!cam.cab) cam.manual = -99;
}

/** E: get into the machine within reach, or out of the one you drive. */
export function toggleSeat() {
  if (!G.onFoot) {
    const why = leave();
    if (why) toast(why, 'bad');
    else { cam.yaw = person.h; cam.manual = -50; } // right behind the farmer: W walks the way he faces
    return;
  }
  const v = machineInReach();
  if (!v) { toast('Žádný stroj v dosahu. Dojdi až k němu (Tab tě přenese do dalšího stroje).'); return; }
  if (v.helper) { toast('Ve stroji pracuje pomocník. Propustíš ho v Kanceláři (K).', 'bad'); return; }
  seat(v);
  cam.manual = -99;
  toast('Sedíš v: ' + labelOf(v));
}

/** H: hire a helper for the vehicle you sit in (then hop to a free one), or send him home. */
export function toggleHelper() {
  if (needSeat()) return;
  const v = G.active;
  if (v.helper) { dismiss(v); return; }
  if (!hire(v)) return;
  const free = vehicles.find(o => o.available && !o.helper);
  if (free) { seat(free); cam.manual = -99; }
}

export function toggleTool() {
  if (needSeat()) return;
  const v = G.active;
  if (v.helper) { toast('Tenhle stroj řídí pomocník. Klávesou H ho propustíš.'); return; }
  if (v.type === 'tractor' && !v.tool) { toast('Traktor nemá nářadí. Zacouvej k nějakému a připoj ho klávesou Q.'); return; }
  if (v.type === 'tractor' && v.impl === 'trailer' && !v.tool.pickup) {
    toast('Přívěs nemá co spouštět. Úrodu vysypeš klávesou F ve výkupu, balíky prodáš F u stodoly.');
    return;
  }
  if (v.type === 'tractor' && v.impl === 'livestock') { toast('Zvířata naložíš a vyložíš klávesou F v kruhu u jejich budovy, prodáš nebo koupíš je u dobytčího trhu v městečku.'); return; }
  if (v.type === 'tractor' && (v.impl === 'manure' || v.impl === 'slurry') && !v.lowered && v.tool.load < 1) {
    toast(v.impl === 'slurry' ? 'Cisterna je prázdná. Naplníš ji klávesou F v kruhu u jímky na kejdu vedle kravína.' : 'Rozmetadlo je prázdné. Naplníš ho klávesou F v kruhu před hnojištěm u vepřína.', 'bad'); return;
  }
  if (v.type === 'tractor' && v.impl === 'watertank') { toast('Cisternu naplníš klávesou F u rybníka a vodu vyleješ F u skleníků. Mléko nabereš F u kravína a prodáš v mlékárně v městečku.'); return; }
  if (v.type === 'forest') { toast('Strom pokácíš klávesou F, když stojíš u vzrostlého stromu.'); return; }
  if (v.type === 'jeep') { playAt('honk', v.x, v.z, v); return; }
  if (v.type === 'combine' && v.transport) { toast('Lišta leží na vozíku. Nasaď ji zpátky klávesou L.', 'bad'); return; }
  if (v.type === 'loader') { toast('Manipulátor nabírá a pokládá klávesou L.'); return; }
  v.lowered = !v.lowered;
  v.prevTool = null;
}

/**
 * L: the loader (telehandler or front loader) picks up or puts down; in a combine the header goes onto
 * the header trailer behind it for the road, or back onto the combine.
 */
export function doLoader() {
  if (needSeat()) return;
  const v = G.active;
  if (v.helper) { toast('Tenhle stroj řídí pomocník. Klávesou H ho propustíš.'); return; }
  if (v.type === 'combine') { headerCart(v); return; }
  if (!hasLoader(v)) {
    toast(v.type === 'tractor' ? (has('frontLoader') ? 'Traktor nemá čelní nakladač. Nasadíš ho v kůlně klávesou 1.' : 'Traktor nemá čelní nakladač. Koupíš ho v Kanceláři (K), Obchod → Nakladače.')
      : 'Klávesa L ovládá nakladač, manipulátor a vozík na lištu kombajnu.');
    return;
  }
  if (doL(v)) saveLocal();
}
function headerCart(v) {
  if (Math.abs(v.speed) > 0.5) { toast('Nejdřív zastav.'); return; }
  if (v.unloading || v.lowered) { toast('Nejdřív zvedni lištu a dokonči vykládání.'); return; }
  if (v.transport) { headerOff(v); toast('Lišta je zpátky na kombajnu. Prázdný vozík odpojíš klávesou Q, nebo ho táhni s sebou.', 'good'); saveLocal(); return; }
  const t = v.tool?.key === 'headercart' ? v.tool : cartInReach(v);
  if (!t) {
    const n = nearestCart(v);
    toast(!n ? 'Vozík na lištu nemáš. Koupíš ho v Kanceláři (K), Obchod → Sklízeče.' : 'Zacouvej zádí kombajnu k oji vozíku na lištu' + (n.d > 15 ? ' (stojí ' + fmt(n.d) + ' m odtud)' : '') + '.');
    return;
  }
  if (v.toolW > t.maxHeader + 0.05) { toast('Lišta ' + String(v.toolW).replace('.', ',') + ' m se na tenhle vozík nevejde, ten unese lištu do ' + t.maxHeader + ' m.', 'bad'); return; }
  headerOn(v, t);
  toast('Lišta leží na vozíku za kombajnem. Kombajn je teď úzký pro silnice a aleje. Na poli ji klávesou L nasadíš zpátky.', 'good');
  saveLocal();
}

/** Tab: the next machine within NEAR metres (all of them when none is near); Shift+Tab: the next of all machines. */
const NEAR = 150;
export function switchVehicle(all = keys.ShiftLeft || keys.ShiftRight) {
  // a running unload keeps going, so you can hop into the tractor and drive under the pipe
  const a = G.active, from = G.onFoot ? person : a, near = vehicles.filter(v => v === a || Math.hypot(v.x - from.x, v.z - from.z) < NEAR);
  const list = all || near.length < 2 ? vehicles : near;
  // on foot: into the nearest free machine (the one you left last if it is near), driving: the next one
  const next = G.onFoot
    ? [...list].filter(v => !v.helper).sort((p, q) => Math.hypot(p.x - from.x, p.z - from.z) - Math.hypot(q.x - from.x, q.z - from.z))[0] || a
    : list[(list.indexOf(a) + 1) % list.length];
  seat(next);
  cam.manual = -99; // swing the camera behind the new vehicle
  toast('Sedíš v: ' + labelOf(G.active) + (!all && near.length < 2 && vehicles.length > 1 ? ' · v okolí žádný jiný stroj nestojí' : ''));
}

export function cycleSeed() {
  const v = G.active.type === 'tractor' ? G.active : firstOf('tractor');
  if (!v) return;
  v.seedCrop = (v.seedCrop + 1) % CROPS.length;
  const c = CROPS[v.seedCrop];
  const hdr = c.header === 'corn' ? ' · sklízí se řádkovým adaptérem' : c.header === 'beet' ? ' · sklízí se sklízečem cukrovky' : '';
  toast('Osivo: ' + c.name + ' · ' + c.seed + ' Kč/m² · zraje za ' + c.hours + ' h' + hdr + ' · seje se: ' + sowSeasons(v.seedCrop) + (sowable(v.seedCrop) ? '' : ' (teď ne)'), sowable(v.seedCrop) ? '' : 'bad');
}

export function cycleTime() { G.tsIdx = (G.tsIdx + 1) % TIME_SCALES.length; }

/** Q: unhitch the tractor's implement where it stands, or hitch the one the tractor has reversed up to. */
export function toggleHitch() {
  if (needSeat()) return;
  const v = G.active;
  if (v.type === 'combine') { combineHitch(v); return; }
  if (v.type !== 'tractor') { toast('Nářadí se připojuje jen k traktoru.'); return; }
  if (v.helper) { toast('Tenhle stroj řídí pomocník. Klávesou H ho propustíš.'); return; }
  if (Math.abs(v.speed) > 0.5) { toast('Nejdřív zastav.'); return; }
  if (v.tool) {
    if (v.tool.tipping) { toast('Přívěs právě vysypává.', 'bad'); return; }
    const im = dropTool(v);
    toast('Odpojeno: ' + labelOf(im) + '. Zůstalo stát tady.', 'good');
    return;
  }
  const t = toolInReach(v);
  if (!t) {
    toast(toolNearby(v) ? 'Zacouvej blíž a rovněji, závěs traktoru musí být přímo u oje nářadí.' : 'Za traktorem žádné nářadí nestojí. Zacouvej k němu zádí.');
    return;
  }
  attachTool(v, t);
  toast('Připojeno: ' + labelOf(t), 'good');
}
/** Q in a combine: hitches the (empty) header trailer it has reversed up to, or leaves it standing. */
function combineHitch(v) {
  if (Math.abs(v.speed) > 0.5) { toast('Nejdřív zastav.'); return; }
  if (v.tool) {
    if (v.transport) { toast('Na vozíku leží lišta. Nasaď ji klávesou L, pak vozík odpojíš.', 'bad'); return; }
    const t = unhitchCart(v);
    toast('Odpojeno: ' + labelOf(t) + '. Zůstal stát tady.', 'good');
    return;
  }
  const t = cartInReach(v);
  if (!t) { toast(nearestCart(v) ? 'Zacouvej zádí kombajnu k oji vozíku na lištu.' : 'Kombajn táhne jen vozík na lištu. Koupíš ho v Kanceláři (K).'); return; }
  hitchCart(v, t);
  toast('Připojeno: ' + labelOf(t) + '. Lištu na něj položíš klávesou L.', 'good');
}
function swapHeader(v, key) {
  if (v.header === key) return;
  if (v.transport) { toast('Lišta leží na vozíku. Nejdřív ji nasaď klávesou L.', 'bad'); return; }
  if (key === 'corn' && !has('cornHeader')) { toast('Řádkový adaptér nevlastníš. Koupíš nebo pronajmeš ho v Kanceláři (K).', 'bad'); return; }
  setHeader(v, key);
  toast('Na kombajnu je ' + HEADERS[key].name.toLowerCase(), 'good');
}

/** Number key n (1-based) in the shed: pick the combine's header directly. */
export function pickInShed(n) {
  if (G.onFoot) return;
  const v = G.active;
  if (v.type === 'tractor' && n === 1 && inShed(v)) { swapFrontLoader(v); return; }
  if (v.type === 'tractor') { toast('Nářadí vyměníš ručně: odpoj ho klávesou Q, zacouvej k jinému a připoj ho zase Q.' + (has('frontLoader') ? ' Čelní nakladač nasadíš v kůlně klávesou 1.' : '')); return; }
  if (!inShed(v)) return;
  if (v.type === 'combine' && n <= 2) swapHeader(v, n === 1 ? 'grain' : 'corn');
}
/** 1 in the shed with a tractor: mounts the front loader (from another tractor if it is on one) or takes it off. */
function swapFrontLoader(v) {
  if (v.fl) {
    if (v.ld.carry) { toast('Nejdřív polož, co nakladač veze (L).', 'bad'); return; }
    frontLoaderOff(v); toast('Čelní nakladač zůstal v kůlně.', 'good'); saveLocal(); return;
  }
  if (!has('frontLoader')) { toast('Čelní nakladač nemáš. Koupíš ho v Kanceláři (K), Obchod → Nakladače.', 'bad'); return; }
  const other = vehicles.find(o => o.fl);
  if (other?.ld.carry) { toast('Nakladač na ' + labelOf(other) + ' něco veze. Nejdřív to polož.', 'bad'); return; }
  if (other) frontLoaderOff(other);
  frontLoaderOn(v);
  toast('Čelní nakladač je na traktoru' + (other ? ' (sundaný z ' + labelOf(other) + ')' : '') + '. Klávesou L nabírá a pokládá.', 'good');
  saveLocal();
}

/** R in the shed: repair the vehicle and its attached tool. */
export function repairHere() {
  if (needSeat()) return;
  const v = G.active;
  if (!inShed(v)) { toast('Opravit stroj můžeš v kůlně.'); return; }
  repair(v);
  saveLocal();
}

/** The context action on F: refuel, sell, overload, swap the combine's header, or buy a field. */
export function doF() {
  const a = fAction();
  if (!a) return;
  switch (a.kind) {
    case 'refuel': refuel(a.v); return;
    case 'wash': startWash(a.v); return;
    case 'race': startRace(G.active); return;
    case 'contest': claimContest(); saveLocal(); return;
    case 'fell': fell(G.active, a.i); return;
    case 'sellLogs': sellLogs(G.active, saveLocal); return;
    case 'fillWater': { const w = a.w, l = w.waterCap - w.water; w.water = w.waterCap; toast('Nabráno ' + fmt(l) + ' l vody z rybníka.', 'good'); return; }
    case 'giveWater': {
      const w = a.w, l = Math.min(w.water, waterCap() - G.farm.water);
      w.water -= l; G.farm.water += l;
      toast('Skleníky dostaly ' + fmt(l) + ' l vody.', 'good'); saveLocal(); return;
    }
    case 'loadMilk': {
      const w = a.w, l = Math.floor(Math.min(G.farm.milk, w.waterCap - w.water));
      w.milk = true; w.water += l; G.farm.milk -= l;
      toast('Nabráno ' + fmt(l) + ' l mléka. V mlékárně v městečku ho prodáš za ' + COWS.dairyPrice + ' Kč/l.', 'good'); saveLocal(); return;
    }
    case 'sellMilk': {
      const w = a.w, l = Math.floor(w.water), money = l * COWS.dairyPrice;
      w.water = 0; w.milk = false; G.money += money; earn(money); G.flashT = 0.4;
      toast('Mlékárna koupila ' + fmt(l) + ' l mléka za ' + fmt(money) + ' Kč', 'good'); saveLocal(); return;
    }
    case 'feedHay': { // hay bales; the cows also take wrapped silage bales
      const t = a.t, sil = a.m.feed === 'cows' ? t.silage || 0 : 0, n = feedHay(a.m.feed, t.hay + sil);
      if (!n) { toast('Krmelec (' + BUILDINGS[a.m.feed].name + ') je plný.', 'bad'); return; }
      const hay = Math.min(t.hay, n), s = n - hay;
      t.hay -= hay; t.silage = (t.silage || 0) - s; t.bales -= n;
      toast('Vyloženo ' + n + (n === 1 ? ' balík' : n < 5 ? ' balíky' : ' balíků') + (s ? (hay ? ' sena a senáže' : ' senáže') : ' sena') + ' do krmelce · ' + a.m.short, 'good'); saveLocal(); return;
    }
    case 'tipBunker': case 'tipForage': startTipping(a.t); return;
    case 'loadSilage': loadSilage(a.t, a.l); saveLocal(); return;
    case 'cover': cover(); saveLocal(); return;
    case 'packMore': toast('Řezanka ve žlabu je udusaná jen na ' + Math.round(a.p * 100) + ' %. Jezdi po ní traktorem tam a zpátky, zakrýt jde od ' + Math.round(SILAGE.packNeed * 100) + ' %.', 'bad'); return;
    case 'bunkerShut': toast('Žlab je zakrytý a kvasí. Řezanku teď prodáš v bioplynce u cukrovaru.', 'bad'); return;
    case 'chaffCows': toast('Krávy dostávají siláž, ne čerstvou řezanku. Vysyp ji do silážního žlabu, udusej, zakryj a nech zkvasit.', 'bad'); return;
    case 'stopUnload': stopUnload(a.h, saveLocal); return;
    case 'sell': case 'overload': startUnload(a.h); return;
    case 'tip': startTipping(a.t); return;
    case 'tipGround': startTipping(a.t, false, true); return;
    case 'logsIn': { const v = G.active, l = prodTake('sawmill', v.logs); v.logs -= l; toast('Na pilu složeno ' + String(l.toFixed(1)).replace('.', ',') + ' m³ kulatiny. Prkna budou na paletách v kruhu před pilou.', 'good'); saveLocal(); return; }
    case 'flourIn': {
      let n = 0;
      while (a.t.pallets.includes('flour') && PRODUCTION.bakery.store - prodIn('bakery') >= PALLET.flour) { a.t.pallets.splice(a.t.pallets.indexOf('flour'), 1); prodTake('bakery', PALLET.flour); n++; }
      toast('Do pekárny vyloženo ' + n + (n === 1 ? ' paleta' : n < 5 ? ' palety' : ' palet') + ' mouky.', 'good'); saveLocal(); return;
    }
    case 'prodFull': toast(a.name + ' má plný sklad. Počkej, až zpracuje, co má.', 'bad'); return;
    case 'fillHopper': {
      const l = buyFill(a.im, a.what);
      if (!l) { toast('Na ' + SUPPLIES[a.what].name.toLowerCase() + ' nemáš peníze.', 'bad'); return; }
      toast('Naplněno ' + fmt(l) + ' ' + SUPPLIES[a.what].unit + ' ' + SUPPLIES[a.what].gen + ' za ' + fmt(l * SUPPLY[a.what].price) + ' Kč.', 'good'); saveLocal(); return;
    }
    case 'hopperFull': toast('Zásobník je plný.'); return;
    case 'bagFill': {
      const l = pourInto(a.im, a.what, takeFromBags(a.t, a.what, a.l));
      toast('Ze big bagů nasypáno ' + fmt(l) + ' ' + SUPPLIES[a.what].unit + ' ' + SUPPLIES[a.what].gen + ' · na přívěsu zbývá ' + fmt(bagStock(a.t, a.what)) + ' ' + SUPPLIES[a.what].unit, 'good'); saveLocal(); return;
    }
    case 'buyBag':
      if (!buyBag(a.t, a.what)) { toast('Na ' + SUPPLIES[a.what].bag + ' nemáš peníze (' + fmt(a.cost) + ' Kč).', 'bad'); return; }
      toast('Naložen ' + SUPPLIES[a.what].bag + ' za ' + fmt(a.cost) + ' Kč · na přívěsu ' + a.t.pallets.length + ' z ' + a.t.baleCap + '. C vybere jiný.', 'good'); saveLocal(); return;
    case 'trailerFull': toast('Přívěs je plný.', 'bad'); return;
    case 'loadSilo': startLoading(a.t); return;
    case 'loadAnimals': loadAnimals(a.t, a.key, a.n); saveLocal(); return;
    case 'unloadAnimals': unloadAnimals(a.t, a.key, a.n); saveLocal(); return;
    case 'wrongAnimals': toast('V přívěsu je ' + herdName(a.t.animals.kind, a.t.animals.n) + '. Vylož je v jejich budově, nebo je prodej na dobytčím trhu.', 'bad'); return;
    case 'herdFull': toast('Budova je plná, víc zvířat se do ní nevejde.', 'bad'); return;
    case 'sellAnimals': sellAnimals(a.t); saveLocal(); return;
    case 'buyAnimals': buyAnimals(a.t, a.key, a.n); saveLocal(); return;
    case 'noBuilding': toast('Zvířata můžeš koupit, až budeš mít jejich budovu (Kancelář → Obchod → Budovy).', 'bad'); return;
    case 'fillDung': {
      a.t.load += a.l; if (a.slurry) G.farm.slurry -= a.l; else G.farm.manure -= a.l;
      toast('Naplněno ' + fmt(a.l) + ' l ' + (a.slurry ? 'kejdy' : 'hnoje') + '. Na poli ho rozmetáš mezerníkem: hnojí jako hnojivo, zdarma.', 'good'); saveLocal(); return;
    }
    case 'noDung': toast(a.slurry ? 'Jímka na kejdu je prázdná. Kejdu dávají krávy a prasata.' : 'Hnojiště je prázdné. Hnůj dávají krávy, ovce a slepice.', 'bad'); return;
    case 'loadPallets': loadPallets(a.t, a.p); saveLocal(); return;
    case 'sellPallets': sellPallets(a.t); saveLocal(); return;
    case 'stopLoad': stopLoading(a.t, saveLocal); return;
    case 'stopTip': stopTipping(a.t, saveLocal); return;
    case 'sellBales': sellBales(a.t, saveLocal); return;
    case 'wrongMarket': toast(a.m.name + ' nebere ' + CROPS[a.crop].gen + '. Vezme ji: ' + buyersOf(a.crop).join(', ') + '.', 'bad'); return;
    case 'header': swapHeader(G.active, a.header); return;
  }
  buyField(a.sign.f);
}

/** Buys field f (at its sign or from the office). Returns true when bought. */
export function buyField(f) {
  if (f.owned) return false;
  if (G.money < f.price) {
    toast('Na pole ' + f.id + ' ti chybí ' + fmt(f.price - G.money) + ' Kč.', 'bad');
    return false;
  }
  G.money -= f.price; f.owned = true; G.flashT = 0.4;
  if (G.contracts.active?.field === f.id) { returnLent(G.contracts.active.borrowed); G.contracts.active = null; } // your own field now: the neighbour takes his machine back
  G.contracts.offers = G.contracts.offers.filter(o => o.field !== f.id);
  drawSign(signs.find(s => s.f === f));
  toast('Pole ' + f.id + ' je tvoje. Úroda na něm patří tobě.', 'good');
  saveLocal();
  return true;
}
