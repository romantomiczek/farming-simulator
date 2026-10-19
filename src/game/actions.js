import { playAt } from '../audio.js';
import { fmt } from '../core/util.js';
import { G, TIME_SCALES } from './state.js';
import { CROPS, HEADERS } from './crops.js';
import {
  sellPoint, inBaleZone, trailerInReach, trailerUnder, startUnload, stopUnload, startTipping, stopTipping, sellBales,
} from './work.js';
import { saveLocal } from './save.js';
import { has } from './machines.js';
import { inFuel, refuel, repair } from './economy.js';
import { marketAt, buyersOf, hayFeederAt } from './markets.js';
import { hire, dismiss } from './helpers.js';
import { greenhouses, waterCap, feedHay, BUILDINGS } from './farm.js';
import { COWS } from './balance.js';
import { earn } from './goals.js';
import { inSawmill, treeInReach, fell, sellLogs } from './forestry.js';
import { POND_FILL, GREENHOUSE_WATER, MILK_LOAD, DAIRY } from '../world/layout.js';
import { trailerCenter, vehicles, tools, towed, firstOf, HARVESTERS, IMPL_ORDER, toolInfo, attachTool, setHeader, labelOf } from '../vehicles/vehicles.js';
import { keys } from '../core/input.js';
import { signs, drawSign } from '../world/fields.js';
import { shedZone } from '../world/layout.js';
import { cam, LOOK_UP } from '../render/camera.js';
import { toast } from '../ui/toast.js';
import { person, machineInReach, seat, leave } from '../world/person.js';
import { inWash, needsWash, startWash } from './dirt.js';

export const inShed = v => v.x > shedZone.x0 && v.x < shedZone.x1 && v.z > shedZone.z0 && v.z < shedZone.z1;
export const nearSign = v => signs.find(s => !s.f.owned && Math.hypot(v.x - s.x, v.z - s.z) < 10);
/** A piece of implement key that tractor v can hitch: its own, else one standing free. */
export const freeTool = (v, key) => tools.find(t => t.key === key && t.on === v) || tools.find(t => t.key === key && !t.on) || null;
/** Next implement in the shed's swap order that tractor v can hitch. */
export function otherImpl(v) {
  const i = IMPL_ORDER.indexOf(v.impl);
  for (let k = 1; k < IMPL_ORDER.length; k++) { const key = IMPL_ORDER[(i + k) % IMPL_ORDER.length]; if (freeTool(v, key)) return key; }
  return null;
}
export const otherHeader = v => (v.header === 'grain' ? (has('cornHeader') ? 'corn' : null) : 'grain');

/** What F would do right now for the active vehicle (on foot: buying the field at a sign), or null. Shared by doF() and the HUD prompts. */
export function fAction() {
  if (G.onFoot) { const s = nearSign(person); return s ? { kind: 'buy', sign: s } : null; }
  const v = G.active;
  if (inWash(v) && needsWash(v)) return { kind: 'wash', v };
  if (inFuel(v) && v.fuel < v.fuelCap - 1) return { kind: 'refuel', v };
  if (v.type === 'forest') {
    if (v.cutting) return null;
    if (v.logs > 0 && inSawmill(v)) return { kind: 'sellLogs' };
    const i = treeInReach(v);
    if (i >= 0) return { kind: 'fell', i };
    return null;
  }
  if (v.type === 'tractor' && v.impl === 'watertank') {
    const w = v.tool, near = z => Math.hypot(v.x - z.x, v.z - z.z) < z.r;
    if (w.milk && w.water > 0 && near(DAIRY)) return { kind: 'sellMilk', w };
    if (near(MILK_LOAD) && has('cows') && G.farm.milk >= 1 && (w.milk || w.water <= 0) && w.water < w.waterCap - 1) return { kind: 'loadMilk', w };
    if (!w.milk && near(POND_FILL) && w.water < w.waterCap - 1) return { kind: 'fillWater', w };
    if (!w.milk && near(GREENHOUSE_WATER) && w.water > 0 && greenhouses() && G.farm.water < waterCap() - 1) return { kind: 'giveWater', w };
  }
  if (v.harvester) {
    if (v.unloading) return { kind: 'stopUnload', h: v };
    if (v.tank.amount > 0 && sellPoint(v, v.tank.crop)) return { kind: 'sell', h: v, m: sellPoint(v, v.tank.crop) };
    if (v.tank.amount > 0 && marketAt(v)) return { kind: 'wrongMarket', m: marketAt(v), crop: v.tank.crop };
    if (v.tank.amount > 0 && trailerUnder(v)) return { kind: 'overload', h: v };
    if (v.type === 'combine' && inShed(v) && otherHeader(v)) return { kind: 'header', header: otherHeader(v) };
  } else {
    const t = towed(v), tc = t && trailerCenter(t);
    if (t?.tipping) return { kind: 'stopTip', t };
    if (t && t.tank.amount > 0 && sellPoint(tc, t.tank.crop)) return { kind: 'tip', t, m: sellPoint(tc, t.tank.crop) };
    if (t && t.tank.amount > 0 && marketAt(tc)) return { kind: 'wrongMarket', m: marketAt(tc), crop: t.tank.crop };
    if (t && t.hay > 0 && hayFeederAt(tc)) return { kind: 'feedHay', t, m: hayFeederAt(tc) };
    if (t && t.bales > 0 && inBaleZone(tc)) return { kind: 'sellBales', t };
    if (t) for (const h of HARVESTERS) if (h.unloading && trailerInReach(h, t)) return { kind: 'stopUnload', h };
    if (t) for (const h of HARVESTERS) if (h.tank.amount > 0 && trailerInReach(h, t)) return { kind: 'overload', h };
    if (v.type === 'tractor' && inShed(v) && otherImpl(v)) return { kind: 'swap', impl: otherImpl(v) };
  }
  const s = nearSign(v);
  if (s) return { kind: 'buy', sign: s };
  return null;
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
  if (v.type === 'tractor' && !v.tool) { toast('Traktor nemá nářadí. Připojíš ho v kůlně klávesami 1–8.'); return; }
  if (v.type === 'tractor' && v.impl === 'trailer') {
    toast('Přívěs nemá co spouštět. Úrodu vysypeš klávesou F ve výkupu, balíky prodáš F u stodoly.');
    return;
  }
  if (v.type === 'tractor' && v.impl === 'watertank') { toast('Cisternu naplníš klávesou F u rybníka a vodu vyleješ F u skleníků. Mléko nabereš F u kravína a prodáš v mlékárně v městečku.'); return; }
  if (v.type === 'forest') { toast('Strom pokácíš klávesou F, když stojíš u vzrostlého stromu.'); return; }
  if (v.type === 'jeep') { playAt('honk', v.x, v.z, v); return; }
  v.lowered = !v.lowered;
  v.prevTool = null;
  if (v.lowered && v.type === 'tractor' && v.impl === 'seeder' && G.money < CROPS[v.seedCrop].seed && !G.contracts.active) {
    v.lowered = false;
    toast('Nemáš peníze na osivo.', 'bad');
  }
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
  toast('Osivo: ' + c.name + ' · ' + c.seed + ' Kč/m² · zraje za ' + c.hours + ' h' + hdr);
}

export function cycleTime() { G.tsIdx = (G.tsIdx + 1) % TIME_SCALES.length; }

function swapImpl(v, key) {
  if (v.impl === key) return;
  const name = toolInfo(key).name;
  if (!has(key)) { toast(name + ' nevlastníš. Koupíš nebo pronajmeš ho v Kanceláři (K).', 'bad'); return; }
  const t = freeTool(v, key);
  if (!t) { toast(name + ' je připojený k jinému traktoru.', 'bad'); return; }
  attachTool(v, t);
  toast('Připojeno: ' + name, 'good');
}
function swapHeader(v, key) {
  if (v.header === key) return;
  if (key === 'corn' && !has('cornHeader')) { toast('Řádkový adaptér nevlastníš. Koupíš nebo pronajmeš ho v Kanceláři (K).', 'bad'); return; }
  setHeader(v, key);
  toast('Na kombajnu je ' + HEADERS[key].name.toLowerCase(), 'good');
}

/** Number key n (1-based) in the shed: pick that implement or header directly. */
export function pickInShed(n) {
  if (G.onFoot) return;
  const v = G.active;
  if (!inShed(v)) return;
  if (v.type === 'tractor' && IMPL_ORDER[n - 1]) swapImpl(v, IMPL_ORDER[n - 1]);
  if (v.type === 'combine' && n <= 2) swapHeader(v, n === 1 ? 'grain' : 'corn');
}

/** R in the shed: repair the vehicle and its attached tool. */
export function repairHere() {
  if (needSeat()) return;
  const v = G.active;
  if (!inShed(v)) { toast('Opravit stroj můžeš v kůlně.'); return; }
  repair(v);
  saveLocal();
}

/** The context action on F: refuel, sell, overload, swap implement or header, or buy a field. */
export function doF() {
  const a = fAction();
  if (!a) return;
  switch (a.kind) {
    case 'refuel': refuel(a.v); return;
    case 'wash': startWash(a.v); return;
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
    case 'feedHay': {
      const n = feedHay(a.m.feed, a.t.hay);
      if (!n) { toast('Krmelec (' + BUILDINGS[a.m.feed].name + ') je plný.', 'bad'); return; }
      a.t.hay -= n; a.t.bales -= n;
      toast('Vyloženo ' + n + (n === 1 ? ' balík' : n < 5 ? ' balíky' : ' balíků') + ' sena do krmelce · ' + a.m.short, 'good'); saveLocal(); return;
    }
    case 'stopUnload': stopUnload(a.h, saveLocal); return;
    case 'sell': case 'overload': startUnload(a.h); return;
    case 'tip': startTipping(a.t); return;
    case 'stopTip': stopTipping(a.t, saveLocal); return;
    case 'sellBales': sellBales(a.t, saveLocal); return;
    case 'wrongMarket': toast(a.m.name + ' nebere ' + CROPS[a.crop].gen + '. Vezme ji: ' + buyersOf(a.crop).join(', ') + '.', 'bad'); return;
    case 'swap': swapImpl(G.active, a.impl); return;
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
  if (G.contracts.active?.field === f.id) G.contracts.active = null; // your own field now
  G.contracts.offers = G.contracts.offers.filter(o => o.field !== f.id);
  drawSign(signs.find(s => s.f === f));
  toast('Pole ' + f.id + ' je tvoje. Úroda na něm patří tobě.', 'good');
  saveLocal();
  return true;
}
