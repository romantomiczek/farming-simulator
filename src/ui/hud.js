import { activeGoals, progressText } from '../game/goals.js';
import { fmt, fmt2, plural } from '../core/util.js';
import { G, TIME_SCALES } from '../game/state.js';
import {
  CROPS, HEADERS, STATE_NAMES, S_STUB, S_CULT, S_SOWN, S_RIPE, FERT_COST, FERT_BONUS, PLOW_BONUS, HERB_COST, LIME_COST, FERT2_BONUS, ROLL_BONUS, MULCH_BONUS, balePrice, hayPrice,
} from '../game/crops.js';
import { FIELDS, fieldAt } from '../world/fields.js';
import { bales } from '../world/bales.js';
import { BALE_CELLS, HARVESTERS, tools, trailers, towed, firstOf, toolInfo, labelOf, powerShare, towShare, loadOf, toolInReach, toolNearby } from '../vehicles/vehicles.js';
import { baleValue } from '../game/work.js';
import { fAction, gAction, inShed } from '../game/actions.js';
import { sowable, sowSeasons, sowableNow, LIME_DUE } from '../game/agro.js';
import { herd, herdName, animalValue, animalCost, palletsMoney, palletValue, PALLETS, palletsReady } from '../game/animals.js';
import { HERD, DUNG, PALLET, SILAGE, HAY_DRY } from '../game/balance.js';
import { bunkerState, forageIn, forageName } from '../game/forage.js';
import { SILO_CAP, siloTotal, siloValue, deliveryMarket, deliveryPrice, goodSale } from '../game/silo.js';
import { has } from '../game/machines.js';
import { marketPrice, bestMarket, buyersOf } from '../game/markets.js';
import { WX, season, dayInSeason, isWinter, isWet, forecast, weatherName, DAYS_PER_SEASON } from '../game/weather.js';
import { DIESEL, repairQuote, refuelLiters } from '../game/economy.js';
import { CTYPES, progress } from '../game/contracts.js';
import { WAGE, helpers, helperStatus, canHire } from '../game/helpers.js';
import { BUILDINGS, daysLeft, greenhouses, eatsText } from '../game/farm.js';
import { COWS } from '../game/balance.js';

const ANIMALS = { cows: 'Krávám', hens: 'Slepicím', sheep: 'Ovcím', pigs: 'Prasatům' };
import { logPrice, bestWood, woodBuyerAt } from '../game/forestry.js';
import { trees, volume, matureCount, nearestTree, MATURE } from '../world/forest.js';
import { person, machineInReach } from '../world/person.js';
import { WASH_PRICE, dirtOf } from '../game/dirt.js';
import { raceState } from '../game/festival.js';
import { settings, saveSettings } from '../core/settings.js';

const $ = id => document.getElementById(id);
const ui = {
  money: $('money'), moneyBox: $('moneyBox'), day: $('day'), time: $('time'), speed: $('speedBtn'), task: $('task'),
  prices: $('priceList'), vName: $('vName'), vChip: $('vChip'), vSpeed: $('vSpeed'), vKv: $('vKv'), vTank: $('vTank'),
  vTankLabel: $('vTankLabel'), vTankTxt: $('vTankTxt'), vTankBar: $('vTankBar'), vField: $('vField'), prompt: $('prompt'),
  shed: $('shedPanel'), shedList: $('shedList'), shedNote: $('shedNote'), wx: $('wxLine'), helpers: $('helperLine'),
  vFuelRow: $('vFuelRow'), job: $('jobLine'), dlv: $('dlvLine'), goal: $('goalLine'), icons: $('vIcons'), gear: $('vGear'),
  gSpeed: $('gSpeed'), gFuel: $('gFuel'), gCond: $('gCond'), gTicks: $('gTicks'), pricePanel: $('pricePanel'), pricesBtn: $('pricesBtn'),
};

// Only touch the DOM when a value actually changed: layout work is expensive on weak machines.
const last = {};
function setText(el, key, txt) { if (last[key] !== txt) { last[key] = txt; el.textContent = txt; } }
function setHTML(el, key, html) { if (last[key] !== html) { last[key] = html; el.innerHTML = html; } }

/* ---------- speedometer: speed on the big arc, fuel and wear on the short arcs at the bottom ---------- */
const R_SPEED = 70, A0 = 135, A1 = 405, FUEL = [127, 97], COND = [53, 83];
const pt = (r, a) => { const t = (a * Math.PI) / 180; return (80 + r * Math.cos(t)).toFixed(1) + ' ' + (80 + r * Math.sin(t)).toFixed(1); };
/** SVG arc of radius r from angle a0 to a1 (degrees, clockwise from the right; a1 < a0 goes the other way). */
function arc(r, a0, a1) {
  if (Math.abs(a1 - a0) < 0.5) return '';
  return 'M' + pt(r, a0) + 'A' + r + ' ' + r + ' 0 ' + (Math.abs(a1 - a0) > 180 ? 1 : 0) + ' ' + (a1 > a0 ? 1 : 0) + ' ' + pt(r, a1);
}
$('gSpeedTrack').setAttribute('d', arc(R_SPEED, A0, A1));
$('gFuelTrack').setAttribute('d', arc(R_SPEED, ...FUEL));
$('gCondTrack').setAttribute('d', arc(R_SPEED, ...COND));
/** Tick marks and numbers for a scale up to top km/h (redrawn only when the scale changes). */
function gaugeScale(top) {
  if (last.scale === top) return;
  last.scale = top;
  const major = top > 60 ? 20 : 10, minor = major / 2;
  let h = '';
  for (let k = 0; k <= top; k += minor) {
    const a = A0 + ((A1 - A0) * k) / top, big = k % major === 0, t = (a * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
    const r0 = 61, r1 = big ? 55 : 58;
    h += '<line class="gtick' + (big ? ' major' : '') + '" x1="' + (80 + r0 * c).toFixed(1) + '" y1="' + (80 + r0 * s).toFixed(1) + '" x2="' + (80 + r1 * c).toFixed(1) + '" y2="' + (80 + r1 * s).toFixed(1) + '"/>';
    if (big) h += '<text class="glabel" x="' + (80 + 46 * c).toFixed(1) + '" y="' + (80 + 46 * s).toFixed(1) + '">' + k + '</text>';
  }
  ui.gTicks.innerHTML = h;
}
const setD = (el, key, d) => { if (last[key] !== d) { last[key] = d; el.setAttribute('d', d); } };
/** speed in km/h on a scale up to top; fuel and cond 0..1, or null to hide those arcs. */
function gauge(kmh, top, fuel, cond, gear) {
  gaugeScale(top);
  const f = Math.min(1, kmh / top);
  setD(ui.gSpeed, 'gs', arc(R_SPEED, A0, A0 + (A1 - A0) * Math.max(f, 0.004)));
  const parts = fuel != null;
  if (last.gparts !== parts) { last.gparts = parts; ui.vFuelRow.toggleAttribute('hidden', !parts); }
  if (parts) {
    setD(ui.gFuel, 'gf', arc(R_SPEED, FUEL[0], FUEL[0] + (FUEL[1] - FUEL[0]) * Math.max(0.02, fuel)));
    setD(ui.gCond, 'gc', arc(R_SPEED, COND[0], COND[0] + (COND[1] - COND[0]) * Math.max(0.02, cond)));
    ui.gFuel.classList.toggle('low', fuel < 0.15);
    ui.gCond.classList.toggle('low', cond < 0.3);
  }
  setText(ui.gear, 'gear', gear);
  ui.gear.classList.toggle('rev', gear === 'R');
}

/* ---------- implement icons next to the speedometer ---------- */
const ICON = {
  down: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
  up: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
  work: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4.5h-4.5"/>',
  fill: '<path d="M5 8h14l-1.6 12H6.6z"/><path d="M8.5 8V4.5h7V8"/>',
  bale: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16"/>',
  helper: '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 20.5a7 7 0 0 1 14 0"/>',
  fuel: '<path d="M5 20V5h8v15M4 20h10M5 10h8M13 8l4 3v6.5a1.5 1.5 0 0 0 3 0V9l-3-3"/>',
  trailer: '<path d="M3 6h13v9H3zM16 12h5"/><circle cx="8" cy="17.5" r="2"/>',
};
const ico = (name, cls, title) => '<div class="ico ' + cls + '" title="' + title + '"><svg viewBox="0 0 24 24">' + ICON[name] + '</svg></div>';
/** State of the implement as icons: lowered or raised, working, how full, helper, low fuel. */
function iconsFor(v, tr, working) {
  const out = [];
  const tool = v.harvester || (v.type === 'tractor' && v.tool && (!tr || tr.pickup) && v.impl !== 'livestock' && v.impl !== 'watertank') || v.type === 'forest';
  if (v.fuel < v.fuelCap * 0.15) out.push(ico('fuel', 'bad', 'Dochází nafta'));
  if (v.helper) out.push(ico('helper', v.helper.wait ? 'warn' : 'on', 'Pracuje pomocník'));
  // how full: grain tank, trailer, water or milk tank, the baler's chamber, the harvester's logs
  let fill = -1, txt = '', icon = 'fill';
  if (v.harvester) fill = v.tank.amount / v.tank.cap;
  else if (v.type === 'forest') fill = v.logs / v.logCap;
  else if (tr?.bales) { fill = tr.bales / tr.baleCap; txt = tr.bales + '/' + tr.baleCap; icon = 'bale'; }
  else if (tr) fill = Math.max(0, loadOf(tr));
  else if (v.impl === 'baler') { fill = v.baleAcc / BALE_CELLS; icon = 'bale'; }
  else if (v.impl === 'manure' || v.impl === 'slurry') fill = v.tool.load / v.tool.loadCap;
  else if (v.impl === 'livestock') { const a = v.tool.animals; fill = a.n ? a.n / HERD[a.kind].perTrailer : 0; txt = a.n ? String(a.n) : '0'; }
  if (fill >= 0) {
    const p = Math.round(Math.min(1, fill) * 100);
    out.push('<div class="ico fill" title="Naplnění"><svg viewBox="0 0 24 24">' + ICON[icon] + '</svg>' + (txt || p + ' %') + '<i><s style="width:' + p + '%"></s></i></div>');
  }
  if (tr) out.push(ico('trailer', 'on', 'Připojený přívěs'));
  if (tool) {
    out.push(ico('work', working ? 'on' : '', working ? 'Pracuje' : 'Nepracuje'));
    out.push(v.lowered ? ico('down', working ? 'on' : 'warn', 'Nářadí spuštěné') : ico('up', '', 'Nářadí zvednuté'));
  }
  return out.join('');
}

/** State of the machine you sit in, for the screens in its cab (render/cabview.js). */
export function cabScreen() {
  const v = G.active, tr = towed(v), m = Math.floor(G.gameMin % 1440);
  const kmh = Math.abs(v.speed) * 3.6, top = Math.max(20, Math.ceil((v.vmax * 3.6) / 10) * 10), working = v.lowered && Math.abs(v.speed) > 0.3;
  let fill = null, fillLabel = '';
  if (v.harvester) { fill = v.tank.amount / v.tank.cap; fillLabel = (v.type === 'chopper' ? 'Řezanka · ' : 'Zásobník · ') + fmt(v.tank.amount) + ' l'; }
  else if (v.type === 'forest') { fill = v.logs / v.logCap; fillLabel = 'Dřevo · ' + m3(v.logs); }
  else if (tr?.bales) { fill = tr.bales / tr.baleCap; fillLabel = 'Balíky · ' + tr.bales + ' / ' + tr.baleCap; }
  else if (tr) { fill = Math.max(0, loadOf(tr)); fillLabel = tr.key === 'watertank' ? (tr.milk ? 'Mléko' : 'Voda') : forageIn(tr) ? (tr.forage.kind === 'silage' ? 'Siláž · ' : 'Řezanka · ') + fmt(forageIn(tr)) + ' l' : 'Přívěs · ' + fmt(tr.tank.amount) + ' l'; }
  else if (v.impl === 'baler') { fill = v.baleAcc / BALE_CELLS; fillLabel = 'Komora lisu'; }
  const f = fieldAt(v.x, v.z);
  return {
    kmh, top, rpm: v.fuel > 0 ? 800 + Math.min(1, kmh / top) * 1250 + (working ? 300 : 0) : 0,
    fuel: v.fuel / v.fuelCap, fuelL: v.fuel, cond: Math.min(v.cond, v.tool ? v.tool.cond : 1),
    gear: v.speed < -0.3 ? 'R' : Math.abs(v.speed) > 0.3 ? 'D' : 'N', lowered: !!v.lowered, working,
    hasTool: !!(v.harvester || v.type === 'forest' || (v.tool && !tr)),
    tool: v.harvester ? HEADERS[v.header].name + ' ' + String(v.toolW).replace('.', ',') + ' m' : v.tool ? implLabel(v.impl, v.tool) : labelOf(v),
    fill, fillLabel, field: f ? (f.meadow ? 'Louka ' : 'Pole ') + f.id + (f.owned ? '' : ' · cizí') : '',
    clock: String((m / 60) | 0).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'),
  };
}

/** P or the "Ceny" button: shows or hides the price list. */
export function togglePrices(on = !settings.showPrices) {
  settings.showPrices = on; saveSettings();
  ui.pricePanel.hidden = !on;
  ui.pricesBtn.setAttribute('aria-pressed', String(on));
  if (on) updSlowUI();
}
ui.pricesBtn.onclick = () => togglePrices();

const full = tank => tank.amount >= tank.cap - 10;
const tankText = tank => fmt(tank.amount) + ' / ' + fmt(tank.cap) + ' l' + (tank.crop >= 0 && tank.amount > 0 ? ' · ' + CROPS[tank.crop].name : '');
const pct = x => Math.round(x * 100) + ' %';
const hrs = x => String(x).replace('.', ',');
/** Name of implement kind k (im = a piece of it, for its current width or load). */
const implLabel = (k, im) => (k === 'trailer' ? im?.name || 'Sklápěcí přívěs' : k === 'watertank' ? (im?.name || 'Cisterna') + (im?.milk ? ' s mlékem' : '')
  : (im?.name || toolInfo(k).name) + (/\d m$/.test(im?.name || '') || !(im?.width ?? toolInfo(k).width) ? '' : ' ' + String(im?.width ?? toolInfo(k).width).replace('.', ',') + ' m'));
const m3 = x => String((+x).toFixed(1)).replace('.', ',') + ' m³';
/** "140 / 350 k · práce 40 %" for the tractor panel: tractor power / what the implement needs. */
function powerText(v) {
  const t = v.tool;
  if (!t?.need) return v.hp + ' k';
  const s = v.hp + ' / ' + t.need + ' k', work = powerShare(v, t), tow = towShare(v);
  if (loadOf(t) >= 0) return s + (tow < 1 ? ' · jede ' + pct(tow) : ' · stačí');
  return s + (work < 1 ? ' · práce ' + pct(work) : ' · stačí');
}

function taskText() {
  const meadows = FIELDS.filter(f => f.owned && f.meadow), owned = FIELDS.filter(f => f.owned && !f.meadow), sum = k => owned.reduce((a, f) => a + f.cnt[k], 0);
  const straw = owned.reduce((a, f) => a + f.strawCnt, 0), hay = meadows.reduce((a, f) => a + f.strawCnt, 0);
  const grass = meadows.filter(f => f.cnt[S_RIPE] > f.area * 0.4).map(f => f.id);
  const ripe = owned.filter(f => f.cnt[S_RIPE] - f.ripeBeet > 0).map(f => f.id);
  const ripeBeet = owned.filter(f => f.ripeBeet > 0).map(f => f.id);
  const grainH = HARVESTERS.filter(h => h.type !== 'chopper'); // the chopper's chaff goes to a trailer, never to a buyer
  const fullH = grainH.find(h => full(h.tank));
  const waitingH = grainH.find(h => h.unloading && h.waiting === 'reach');
  const loadedH = grainH.find(h => h.tank.amount > 0);
  const chopWait = HARVESTERS.find(h => h.type === 'chopper' && h.waiting);
  // hay and silage: what lies on the meadows, the bunker, forage in trailers, grass bales to wrap
  const sw = k => meadows.reduce((a, f) => a + (f.swath?.[k] || 0), 0), freshSw = sw(1), teddedSw = sw(2) + sw(4), drySw = sw(3);
  const bk = G.farm.bunker, forageT = trailers().find(x => forageIn(x) > 0), grassBales = bales.filter(b => b.kind === 'grass').length;
  const unfert = owned.filter(f => f.cnt[S_SOWN] > f.area * 0.3 && f.fertShare < 0.5).map(f => f.id);
  const ids = test => owned.filter(test).map(f => f.id);
  const withering = ids(f => f.witherShare > 0.05), weedy = ids(f => f.weedShare > 0.2), stony = ids(f => f.stoneShare > 0.01 && f.cnt[S_RIPE] < f.area * 0.5);
  const sour = ids(f => f.limeShare > 0.5 && f.cnt[S_RIPE] < f.area * 0.5);
  const sickKey = Object.keys(HERD).find(k => has(k) && herd(k).n && herd(k).health < 0.5);
  const sickHerd = sickKey && BUILDINGS[sickKey].name + ': zvířata jsou nemocná (zdraví ' + pct(herd(sickKey).health) + '). Nakrm je, jinak začnou hynout.';
  const palletP = Object.keys(PALLETS).find(p => palletsReady(p) >= 3);
  const pallets = palletP && 'U ' + { eggs: 'kurníku', wool: 'ovčína', tomatoes: 'skleníků' }[palletP] + ' čeká ' + plural(palletsReady(palletP), 'paleta', 'palety', 'palet') + ' (' + PALLETS[palletP].label + '). Přívěsem je odvez do tržnice v městečku, zaplatí o ' + Math.round(PALLET.bonus * 100) + ' % víc než půlnoční odvoz.';
  const hungryKey = Object.keys(BUILDINGS).find(k => has(k) && daysLeft(k) < 0.4);
  const tl = trailers(), towing = tl.some(x => x.on), tractorNow = G.active.type === 'tractor' ? G.active : firstOf('tractor');
  const fullT = tl.find(x => full(x.tank)), balesFull = tl.find(x => x.bales >= x.baleCap), loadedT = tl.find(x => x.tank.amount > 0), balesT = tl.find(x => x.bales);
  const milk = tools.find(x => x.key === 'watertank' && x.milk && x.water > 0 && x.on === G.active);
  let t;
  if (fullH) {
    t = towing
      ? 'Zásobník ' + fullH.gen + ' je plný. Přistav přívěs vlevo od něj pod rouru a stiskni F, nebo jeď do výkupu.'
      : 'Zásobník ' + fullH.gen + ' je plný. Zajeď do kruhu výkupu a stiskni F, nejvíc teď platí ' + bestMarket(fullH.tank.crop, G.gameMin).m.name + '. V Družstvu na statku ho klávesou G uskladníš v silu a prodáš později.';
  } else if (fullT) t = 'Přívěs je plný. Odvez ho do výkupu (nejvíc platí ' + bestMarket(fullT.tank.crop, G.gameMin).m.name + ') a vysyp klávesou F.';
  else if (balesFull) t = 'Přívěs je plný balíků. Odvez je do hnědého kruhu u stodoly a prodej klávesou F.';
  else if (hungryKey) t = ANIMALS[hungryKey] + ' dochází krmivo. Vylož ' + eatsText(hungryKey, true).replace(/, ([^,]*)$/, ' nebo $1') + ' do ' + BUILDINGS[hungryKey].ring + ' (F).';
  else if (milk) t = 'V cisterně veze mléko. Prodej ho v mlékárně v městečku (F v kruhu u mlékárny).';
  else if (greenhouses() && daysLeft('water') < 0.4) t = has('watertank') ? 'Skleníkům dochází voda. Cisternu (připojíš ji klávesou Q) naplníš u rybníka a vyleješ v modrém kruhu u skleníků.' : 'Skleníkům dochází voda. Cisternu na vodu koupíš v Kanceláři (K).';
  else if (waitingH) t = (waitingH.type === 'combine' ? 'Kombajn' : 'Sklízeč') + ' vykládá. Najeď přívěsem vlevo od něj pod výsypnou rouru.';
  else if (chopWait) t = chopWait.waiting === 'full' ? 'Přívěs u řezačky je plný. Odvez ho k silážnímu žlabu za kravínem a přistav prázdný (Tab přepíná stroje).'
    : chopWait.waiting === 'mix' ? 'U řezačky stojí přívěs s něčím jiným. Na řezanku potřebuješ prázdný přívěs.'
    : 'Řezačka má zásobník skoro plný. Přívěs musí jet vlevo vedle ní pod výmetným komínem: přesedni do traktoru (Tab), nebo najmi pomocníka.';
  else if (forageT) t = forageT.forage.kind === 'silage' ? 'V přívěsu je siláž. Vysyp ji kravám (F v zeleném kruhu u kravína), nebo ji prodej v bioplynce u cukrovaru.'
    : bk.covered ? 'Silážní žlab je zakrytý a kvasí. Řezanku z přívěsu prodáš v bioplynce u cukrovaru (F).' : 'Odvez řezanku do silážního žlabu za kravínem a vysyp ji v jeho kruhu (F).';
  else if (!bk.covered && bk.chaff >= SILAGE.coverMin) t = bk.packed >= SILAGE.packNeed ? 'Řezanka ve žlabu je udusaná. Zakryj ji plachtou: F v kruhu žlabu, i pěšky. Za ' + SILAGE.fermentH + ' h z ní bude siláž.'
    : 'Ve žlabu je ' + fmt(bk.chaff) + ' l řezanky, udusaná na ' + pct(bk.packed) + '. Jezdi po ní traktorem tam a zpátky, až bude na ' + pct(SILAGE.packNeed) + ', zakryj ji (F).';
  else if ((ripe.length || ripeBeet.length) && isWet()) t = 'Prší, sklízet se teď nedá. Plodiny oschnou hodinu po dešti, mezitím můžeš kultivovat, hnojit nebo prodávat.';
  else if (ripe.length) t = 'Skliď zralé plodiny kombajnem na poli ' + ripe.join(' a ') + '. Spusť lištu mezerníkem.' +
    (withering.length ? ' Na poli ' + withering.join(' a ') + ' už přezrávají a dají jen polovinu.' : ' Zralé plodiny po ' + 16 + ' hodinách přezrají.');
  else if (ripeBeet.length) t = has('beet') ? 'Skliď cukrovku na poli ' + ripeBeet.join(' a ') + ' sklízečem cukrovky. Přesedneš do něj klávesou Tab.'
    : 'Cukrovka na poli ' + ripeBeet.join(' a ') + ' je zralá. Sklízeč cukrovky si pronajmi nebo kup v Kanceláři (K).';
  else if (loadedH) t = towing ? 'Přelož úrodu ze zásobníku ' + loadedH.gen + ' do přívěsu (F), nebo ji prodej ve výkupu.' : 'Prodej úrodu ze zásobníku ' + loadedH.gen + ' ve výkupu (F). Nejvíc teď platí ' + bestMarket(loadedH.tank.crop, G.gameMin).m.name + '.';
  else if (loadedT) t = 'Odvez úrodu v přívěsu do výkupu a vysyp ji klávesou F. Nejvíc teď platí ' + bestMarket(loadedT.tank.crop, G.gameMin).m.name + '.';
  else if (straw > 40) t = has('baler') ? 'Na poli leží řádky slámy. Zacouvej k lisu, připoj ho klávesou Q a slisuj je do balíků, než pole zkultivuješ.'
    : 'Na poli leží řádky slámy. Lis na balíky koupíš nebo pronajmeš v Kanceláři (K). Jinak slámu zaorej.';
  else if (drySw > 40) t = has('baler') ? 'Na louce leží řádky suchého sena. Připoj lis (Q) a slisuj je, seno se prodá dráž než sláma.'
    : 'Na louce leží řádky suchého sena. Lis na balíky koupíš nebo pronajmeš v Kanceláři (K).';
  else if (teddedSw > 40) t = has('windrower') ? 'Rozhozená tráva na louce schne (' + hrs(HAY_DRY.teddedH) + ' h). Pak ji shrň shrnovačem do řádku, jinak ji lis nesebere.'
    : 'Rozhozenou trávu musíš shrnout do řádku. Shrnovač koupíš v Kanceláři (K).';
  else if (freshSw > 40) t = 'Na louce leží čerstvě posečená tráva. Sama uschne na seno za ' + HAY_DRY.dryH + ' h, ' + (has('tedder') ? 'obracečem za ' : 's obracečem (Kancelář) za ') + hrs(HAY_DRY.teddedH) + ' h. Čerstvou ji můžeš slisovat na senáž, nebo ji sebrat samosběracím vozem či řezačkou na siláž.';
  else if (grassBales) t = 'Na louce leží ' + plural(grassBales, 'balík', 'balíky', 'balíků') + ' čerstvé trávy. ' + (has('wrapper') ? 'Ovíječem (Q, mezerník) je zabal do fólie: senáž je za ' + fmt(SILAGE.silageBale) + ' Kč místo ' + fmt(SILAGE.grassBale) + '.' : 'Ovíječ balíků koupíš v Kanceláři (K): zabalená senáž je za ' + fmt(SILAGE.silageBale) + ' Kč.');
  else if (bales.length) t = 'Na poli leží ' + plural(bales.length, 'balík', 'balíky', 'balíků') + '. Připoj přívěs (Q) a projeď kolem nich, naloží se samy. Prodáš je u stodoly.';
  else if (balesT) t = 'Odvez balíky v přívěsu do hnědého kruhu u stodoly a prodej je klávesou F.';
  else if (sum(S_STUB) > 0) t = tractorNow?.impl === 'cultivator' || tractorNow?.impl === 'plough'
    ? (has('plough') ? 'Zkultivuj nebo zoráš strniště. Pluh je pomalejší, ale dá +15 % výnosu.' : 'Zkultivuj strniště. Pluh (+15 % výnosu) koupíš v Kanceláři (K).')
    : 'Na strniště potřebuješ kultivátor nebo pluh. Odpoj nářadí klávesou Q, zacouvej k jednomu z nich a připoj ho (Q).';
  else if (sum(S_CULT) > 0 && isWinter()) t = 'Zima: nesije se a nic neroste. Zoráš strniště, opravíš stroje v kůlně (R), nebo počkáš na jaro (T zrychlí čas).';
  else if (stony.length && has('roller')) t = 'Na poli ' + stony.join(' a ') + ' jsou po orbě kameny, ničí lištu kombajnu. Uválcuj ho válcem (+5 % výnosu), před setím nebo hned po něm.';
  else if (sum(S_CULT) > 0) t = (tractorNow?.impl === 'seeder' ? 'Zasej zkultivovanou půdu. Osivo změníš klávesou C.' : 'Odpoj nářadí (Q), zacouvej k secímu stroji, připoj ho (Q) a zasej.') +
    ' Teď se seje: ' + sowableNow().map(k => CROPS[k].name.toLowerCase()).join(', ') + '. Jiná plodina než minule dá +8 %.';
  else if (unfert.length && has('spreader')) t = 'Pohnoj pole ' + unfert.join(' a ') + ' rozmetadlem (+25 % výnosu), dokud plodiny rostou.';
  else if (unfert.length && G.money > 90000 && !G.contracts.active) t = 'Rozmetadlo za 90 000 Kč z Kanceláře (K) přidá rostoucím plodinám 25 % výnosu.';
  else if (sickHerd) t = sickHerd;
  else if (G.farm.slurry > DUNG.slurryCap * 0.8 || G.farm.manure > DUNG.manureCap * 0.8) t = (G.farm.slurry > DUNG.slurryCap * 0.8 ? 'Jímka na kejdu' : 'Hnojiště') + ' je skoro plné. ' +
    (has('slurry') || has('manure') ? 'Vyvez ho na pole: hnojí stejně jako hnojivo, a zdarma.' : 'Cisternu na kejdu nebo rozmetadlo hnoje koupíš v Kanceláři (K), na poli nahradí hnojivo.');
  else if (pallets) t = pallets;
  else if (weedy.length) t = 'Na poli ' + weedy.join(' a ') + ' roste plevel a bere až 25 % výnosu. ' + (has('sprayer') ? 'Postříkej ho postřikovačem (' + HERB_COST + ' Kč/m²), dokud plodiny rostou.' : 'Postřikovač koupíš v Kanceláři (K).');
  else if (sour.length && has('spreader')) t = 'Pole ' + sour.join(' a ') + ' má kyselou půdu (−15 % výnosu). Rozmetadlo přepni klávesou C na vápno a pole vyvápni.';
  else if (has('forest') && matureCount() > 0 && sum(S_SOWN) > 0) t = 'Plodiny rostou. V lese na severu je ' + matureCount() + ' vzrostlých stromů: harvestorem je pokácíš (F) a dřevo prodáš na pile.';
  else if (grass.length) t = has('mower') ? 'Tráva na louce ' + grass.join(' a ') + ' je vysoká. Připoj žací lištu (Q) a poseč ji.'
    : 'Tráva na louce ' + grass.join(' a ') + ' je vysoká. Žací lištu koupíš v Kanceláři (K).';
  else if (goodSale()) { const g = goodSale(); t = CROPS[g.crop].name + ' je teď o ' + Math.round(g.up * 100) + ' % dražší než průměrně za 5 dní (' + fmt2(g.now) + ' Kč/l). V silu je ' + fmt(g.l) + ' l: nalož je přívěsem u výdeje ze sila (F) a prodej, nejvíc platí ' + bestMarket(g.crop, G.gameMin).m.name + '.'; }
  else if (G.contracts.offers.length && !G.contracts.active) t = 'Plodiny rostou. Mezitím si vydělej zakázkou u souseda: Kancelář (K) → Zakázky.';
  else if (sum(S_SOWN) > 0) t = isWinter() ? 'V zimě plodiny nerostou. Na jaře se rozrostou znovu, T zrychlí čas.' : 'Plodiny rostou. Klávesa T zrychlí čas.';
  else t = 'Všechno je hotové. V Kanceláři (K) najdeš zvířata, skleníky, harvestor do lesa i vylepšení strojů.';
  const cheapest = FIELDS.filter(f => !f.owned).sort((a, b) => a.price - b.price)[0];
  if (cheapest && G.money >= cheapest.price) t += ' Máš na koupi pole ' + cheapest.id + '.';
  if (G.onFoot) t = 'Jsi pěšky: dojdi ke stroji a nastup klávesou E. ' + t;
  return t;
}

function fPrompt(a) {
  if (!a) return null;
  switch (a.kind) {
    case 'race': return 'Traktoriáda: start' + (G.fest?.best != null ? ' · rekord ' + G.fest.best.toFixed(1).replace('.', ',') + ' s' : '') + (G.fest?.race ? '' : ' · výhra až 30 000 Kč');
    case 'contest': return 'Dožínky: výsledky soutěže o největší úrodu';
    case 'wash': return 'Umýt stroj' + (a.v.tool ? ' s nářadím' : '') + ' za ' + fmt(WASH_PRICE) + ' Kč';
    case 'refuel': { const l = refuelLiters(a.v); return l >= 1 ? 'Natankovat ' + fmt(l) + ' l nafty za ' + fmt(l * DIESEL) + ' Kč' : 'Na naftu nemáš peníze'; }
    case 'stopUnload': return a.h.store ? 'Zastavit ukládání do sila' : 'Zastavit vykládku ' + a.h.gen;
    case 'fell': return 'Pokácet strom · ' + m3(volume(trees[a.i]));
    case 'sellLogs': return 'Prodat ' + m3(G.active.logs) + ' dřeva za ' + fmt(G.active.logs * logPrice(G.gameMin, woodBuyerAt(G.active) || undefined)) + ' Kč';
    case 'fillWater': return 'Nabrat vodu z rybníka';
    case 'giveWater': return 'Vylít vodu do skleníků';
    case 'loadMilk': return 'Nabrat ' + fmt(Math.min(G.farm.milk, a.w.waterCap - a.w.water)) + ' l mléka';
    case 'sellMilk': return 'Prodat ' + fmt(a.w.water) + ' l mléka za ' + fmt(Math.floor(a.w.water) * COWS.dairyPrice) + ' Kč';
    case 'feedHay': { const n = a.t.hay + (a.m.feed === 'cows' ? a.t.silage || 0 : 0); return 'Vyložit ' + plural(n, 'balík', 'balíky', 'balíků') + (a.t.hay ? ' sena' : ' senáže') + ' do krmelce · ' + a.m.short; }
    case 'tipBunker': return 'Vysypat ' + fmt(forageIn(a.t)) + ' l řezanky do silážního žlabu';
    case 'tipForage': return a.target === 'cows' ? 'Vysypat ' + fmt(forageIn(a.t)) + ' l siláže do krmelce · Kravín'
      : a.target === 'bunker' ? 'Vysypat řezanku do žlabu' : 'Prodat ' + fmt(forageIn(a.t)) + ' l ' + forageName(a.t.forage.kind) + ' v bioplynce za ' + fmt(forageIn(a.t) * (a.t.forage.kind === 'silage' ? SILAGE.silagePrice : SILAGE.chaffPrice)) + ' Kč';
    case 'loadSilage': return 'Naložit ' + fmt(a.l) + ' l siláže ze žlabu';
    case 'cover': return 'Zakrýt žlab plachtou · ' + fmt(G.farm.bunker.chaff) + ' l řezanky';
    case 'packMore': return 'Žlab: udusáno ' + pct(a.p) + ', zakrýt až od ' + pct(SILAGE.packNeed);
    case 'bunkerShut': return 'Žlab je zakrytý a kvasí';
    case 'chaffCows': return 'Krávy žerou siláž, ne čerstvou řezanku';
    case 'sell': if (a.m.feed) return 'Vyložit ' + fmt(a.h.tank.amount) + ' l ' + CROPS[a.h.tank.crop].gen + ' do krmelce · ' + a.m.short;
      return 'Prodat ' + fmt(a.h.tank.amount) + ' l ' + CROPS[a.h.tank.crop].gen + ' za ' + fmt(a.h.tank.amount * marketPrice(a.m, a.h.tank.crop, G.gameMin)) + ' Kč';
    case 'wrongMarket': return a.m.name + ' nebere ' + CROPS[a.crop].gen + ' · vezme ji ' + buyersOf(a.crop).join(', ');
    case 'overload': return 'Přeložit ' + fmt(a.h.tank.amount) + ' l ' + CROPS[a.h.tank.crop].gen + ' do přívěsu';
    case 'tip': if (a.m.feed) return 'Vysypat ' + fmt(a.t.tank.amount) + ' l ' + CROPS[a.t.tank.crop].gen + ' do krmelce · ' + a.m.short;
      return 'Vysypat a prodat ' + fmt(a.t.tank.amount) + ' l za ' + fmt(a.t.tank.amount * marketPrice(a.m, a.t.tank.crop, G.gameMin)) + ' Kč';
    case 'stopTip': return 'Zastavit vysypávání';
    case 'loadSilo': return 'Naložit ze sila: ' + CROPS[a.crop].name + ' · ' + fmt(G.silo.stock[a.crop]) + ' l · C jiná plodina';
    case 'stopLoad': return 'Zastavit nakládání';
    case 'loadAnimals': return 'Naložit ' + herdName(a.key, a.n) + ' · ve stádě ' + herd(a.key).n;
    case 'unloadAnimals': return 'Vyložit ' + herdName(a.key, a.n) + ' do budovy';
    case 'wrongAnimals': return 'V přívěsu jsou jiná zvířata';
    case 'herdFull': return 'Budova je plná (' + HERD[a.key].cap + ')';
    case 'sellAnimals': return 'Prodat ' + herdName(a.t.animals.kind, a.t.animals.n) + ' za ' + fmt(a.money) + ' Kč';
    case 'buyAnimals': return 'Koupit ' + herdName(a.key, a.n) + ' za ' + fmt(a.cost) + ' Kč · C jiná zvířata';
    case 'noBuilding': return 'Nemáš žádnou budovu pro zvířata';
    case 'fillDung': return 'Naplnit ' + fmt(a.l) + ' l ' + (a.slurry ? 'kejdy' : 'hnoje');
    case 'noDung': return a.slurry ? 'Jímka na kejdu je prázdná' : 'Hnojiště je prázdné';
    case 'loadPallets': return 'Naložit palety: ' + PALLETS[a.p].label + ' · ' + Math.min(palletsReady(a.p), a.t.baleCap - a.t.pallets.length) + ' ks';
    case 'sellPallets': return 'Prodat ' + plural(a.t.pallets.length, 'paletu', 'palety', 'palet') + ' za ' + fmt(palletsMoney(a.t)) + ' Kč';
    case 'sellBales': return 'Prodat ' + plural(a.t.bales, 'balík', 'balíky', 'balíků') + ' za ' + fmt(baleValue(a.t).money) + ' Kč';
    case 'swap': return 'Vyměnit za ' + toolInfo(a.impl).name.toLowerCase();
    case 'header': return 'Vyměnit za ' + HEADERS[a.header].short;
    case 'buy': return 'Koupit pole ' + a.sign.f.id + ' za ' + fmt(a.sign.f.price) + ' Kč';
  }
  return null;
}

const condTxt = v => {
  let t = 'stroj ' + pct(v.cond);
  if (v.tool) t += ' · nářadí ' + pct(v.tool.cond);
  const d = Math.max(dirtOf(v), dirtOf(v.tool));
  if (d > 0.25) t += d > 0.65 ? ' · zablácený' : ' · špinavý';
  return '<dt>Stav</dt><dd' + (Math.min(v.cond, v.tool ? v.tool.cond : 1) < 0.3 ? ' class="down"' : '') + '>' + t + '</dd>' +
    '<dt>Nafta</dt><dd' + (v.fuel < v.fuelCap * 0.15 ? ' class="down"' : '') + '>' + fmt(v.fuel) + ' / ' + fmt(v.fuelCap) + ' l</dd>';
};

function toolKv(v) {
  if (v.type === 'forest') return '<dt>Dřevo</dt><dd>' + m3(v.logs) + ' / ' + v.logCap + ' m³</dd>' + condTxt(v);
  if (v.type === 'jeep') return '<dt>Vůz</dt><dd>4×4 · až ' + Math.round(v.vmax * 3.6) + ' km/h' + (v.offroad < 1 ? ' (mimo cesty ' + Math.round(v.vmax * v.offroad * 3.6) + ')' : '') + ' · <kbd>Mezerník</kbd> troubí</dd>' + condTxt(v);
  if (v.type === 'chopper') return '<dt>Adaptér</dt><dd>' + String(v.toolW).replace('.', ',') + ' m · kukuřice a řádky trávy</dd><dt>Řezanka</dt><dd>' + fmt(v.tank.amount) + ' / ' + fmt(v.tank.cap) + ' l · metá vlevo do přívěsu</dd>' + condTxt(v);
  if (v.harvester) return '<dt>Nářadí</dt><dd>' + HEADERS[v.header].name + ' ' + String(v.toolW).replace('.', ',') + ' m</dd>' + condTxt(v);
  const c = CROPS[v.seedCrop];
  let kv = '<dt>Nářadí</dt><dd>' + (v.tool ? implLabel(v.impl, v.tool) : 'bez nářadí') + '</dd>';
  kv += '<dt>Výkon</dt><dd' + (powerShare(v, v.tool) < 1 || towShare(v) < 1 ? ' class="down"' : '') + '>' + powerText(v) + '</dd>';
  if (v.impl === 'seeder') kv += '<dt>Osivo <kbd>C</kbd></dt><dd>' + c.name + ' · ' + c.seed + ' Kč/m²</dd>';
  if (v.impl === 'seeder') kv += '<dt>Kalendář</dt><dd' + (sowable(v.seedCrop) ? '' : ' class="down"') + '>' + (sowable(v.seedCrop) ? 'seje se: ' : 'teď ne, jen: ') + sowSeasons(v.seedCrop) + '</dd>';
  if (v.impl === 'plough') kv += '<dt>Účinek</dt><dd>+' + pct(PLOW_BONUS) + ' výnosu · vyorá kameny</dd>';
  if (v.impl === 'spreader') kv += v.spreadLime ? '<dt>Sype <kbd>C</kbd></dt><dd>vápno · ' + LIME_COST + ' Kč/m² · po ' + LIME_DUE + ' sklizních −15 %</dd>'
    : '<dt>Sype <kbd>C</kbd></dt><dd>hnojivo · ' + FERT_COST + ' Kč/m² · +' + pct(FERT_BONUS) + ', 2. dávka +' + pct(FERT2_BONUS) + '</dd>';
  if (v.impl === 'sprayer') kv += '<dt>Postřik</dt><dd>' + HERB_COST + ' Kč/m² · na rostoucí plodiny</dd>';
  if (v.impl === 'roller') kv += '<dt>Účinek</dt><dd>+' + pct(ROLL_BONUS) + ' výnosu · zatlačí kameny</dd>';
  if (v.impl === 'mulcher') kv += '<dt>Účinek</dt><dd>+' + pct(MULCH_BONUS) + ' výnosu · na strniště</dd>';
  if (v.impl === 'baler') kv += '<dt>Komora lisu</dt><dd>' + pct(v.baleAcc / BALE_CELLS) + '</dd>';
  if (v.impl === 'watertank') kv += '<dt>' + (v.tool.milk ? 'Mléko' : 'Voda') + '</dt><dd>' + fmt(v.tool.water) + ' / ' + fmt(v.tool.waterCap) + ' l</dd>';
  if (v.impl === 'trailer' && v.tool.bales) kv += '<dt>Balíky</dt><dd>' + v.tool.bales + ' / ' + v.tool.baleCap + '</dd>';
  if (v.impl === 'trailer' && v.tool.pickup) kv += '<dt>Sběrač</dt><dd>' + (v.lowered ? 'spuštěný' : 'zvednutý') + ' · řádky trávy → řezanka</dd>';
  if (v.impl === 'trailer' && forageIn(v.tool)) kv += '<dt>' + (v.tool.forage.kind === 'silage' ? 'Siláž' : 'Řezanka') + '</dt><dd>' + fmt(forageIn(v.tool)) + ' / ' + fmt(v.tool.tank.cap) + ' l</dd>';
  if (v.impl === 'tedder') kv += '<dt>Účinek</dt><dd>tráva uschne za ' + hrs(HAY_DRY.teddedH) + ' h místo ' + HAY_DRY.dryH + ' h</dd>';
  if (v.impl === 'windrower') kv += '<dt>Účinek</dt><dd>shrne rozhozenou trávu do řádku</dd>';
  if (v.impl === 'wrapper') kv += '<dt>Fólie</dt><dd>' + SILAGE.wrapCost + ' Kč za balík · jen čerstvá tráva</dd>';
  if (v.impl === 'trailer' && v.tool.pallets.length) kv += '<dt>Palety</dt><dd>' + v.tool.pallets.length + ' / ' + v.tool.baleCap + ' · ' + fmt(palletsMoney(v.tool)) + ' Kč v tržnici</dd>';
  if (v.impl === 'livestock') { const a = v.tool.animals; kv += '<dt>Zvířata</dt><dd>' + (a.n ? herdName(a.kind, a.n) + ' · zdraví ' + pct(a.health) : 'prázdný') + '</dd>'; }
  if (v.impl === 'manure' || v.impl === 'slurry') kv += '<dt>' + (v.impl === 'slurry' ? 'Kejda' : 'Hnůj') + '</dt><dd>' + fmt(v.tool.load) + ' / ' + fmt(v.tool.loadCap) + ' l · hnojí zdarma</dd>';
  return kv + condTxt(v);
}

function shedPanel(v) {
  const show = inShed(v) && (v.type === 'tractor' || v.type === 'combine');
  ui.shed.hidden = !show;
  if (!show) return;
  // a tractor changes implements by hand (Q), the combine picks its header here
  const items = v.type === 'tractor' ? []
    : [[1, HEADERS.grain.name + ' (obilí, řepka)', v.header === 'grain', true, true], [2, HEADERS.corn.name + ' (kukuřice, slunečnice)', v.header === 'corn', has('cornHeader'), true]];
  setHTML(ui.shedList, 'shed', items.map(([n, label, on, owned, free]) => '<li class="' + (on ? 'on' : '') + (owned && free ? '' : ' off') + '"><kbd>' + n + '</kbd><span>' + label +
    (!owned ? ' · nevlastníš' : free ? '' : ' · u jiného traktoru') + '</span></li>').join(''));
  const q = repairQuote(v);
  setHTML(ui.shedNote, 'shedNote', q >= 1 ? '<kbd>R</kbd> Opravit za ' + fmt(q) + ' Kč' : 'Stroj je v pořádku.');
}

/** On foot: the farmer instead of the machine, where the last machine is, getting in, buying a field. */
function footPanel() {
  const a = G.active, d = Math.round(Math.hypot(a.x - person.x, a.z - person.z));
  setText(ui.vName, 'vname', 'Pěšky');
  const sp = Math.abs(person.speed);
  setText(ui.vChip, 'chip', sp > 3 ? 'Běží' : person.speed < -0.3 ? 'Couvá' : sp > 0.3 ? 'Jde' : 'Stojí');
  ui.vChip.className = 'chip';
  setText(ui.vSpeed, 'spd', String(Math.round(sp * 3.6)));
  gauge(sp * 3.6, 30, null, null, person.speed < -0.3 ? 'R' : sp > 0.3 ? 'D' : 'N');
  setHTML(ui.icons, 'icons', '');
  setHTML(ui.vKv, 'kv', '<dt>Naposledy</dt><dd>' + labelOf(a) + ' · ' + fmt(d) + ' m</dd>');
  ui.vTank.hidden = true;
  ui.shed.hidden = true;
  const f = fieldAt(person.x, person.z);
  ui.vField.hidden = !f;
  if (f) setHTML(ui.vField, 'fl', '<b>' + (f.meadow ? 'Louka ' : 'Pole ') + f.id + '</b>' + (f.owned ? '' : ' · cizí'));
  const pr = [], m = machineInReach();
  if (m) pr.push(m.helper ? ['', 'Ve stroji ' + labelOf(m) + ' pracuje pomocník'] : ['E', 'Nastoupit: ' + labelOf(m)]);
  const fa = fPrompt(fAction());
  if (fa) pr.push(['F', fa]);
  if (person.speed > 0.3 && sp < 3) pr.push(['Shift', 'Běžet']);
  if (!m) pr.push(['Tab', 'Přenést se do nejbližšího stroje']);
  setHTML(ui.prompt, 'pr', pr.slice(0, 2).map(p => '<div>' + (p[0] ? '<kbd>' + p[0] + '</kbd>' : '') + '<span>' + p[1] + '</span></div>').join(''));
}

/** Every frame: money, clock, vehicle panel, shed panel and key prompts. */
export function updUI() {
  setText(ui.money, 'money', fmt(G.money));
  ui.moneyBox.classList.toggle('flash', G.flashT > 0);
  const day = Math.floor(G.gameMin / 1440) + 1, m = Math.floor(G.gameMin % 1440);
  setText(ui.day, 'day', 'Den ' + day);
  setText(ui.time, 'time', String((m / 60) | 0).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
  setText(ui.speed, 'ts', TIME_SCALES[G.tsIdx] + '×');
  if (G.onFoot) { footPanel(); return; }

  const v = G.active;
  const tr = towed(v), withTrailer = !!tr;
  setText(ui.vName, 'vname', labelOf(v));
  const working = v.lowered && v.speed > 0.3;
  const busy = (v.harvester && v.unloading) || (withTrailer && tr.tipping);
  const chip = v.helper ? ['Pomocník', v.helper.wait ? 'warn' : 'on'] : busy ? ['Vykládá', 'warn'] : working ? ['Pracuje', 'on'] : v.lowered ? ['Spuštěno', 'warn'] : ['Zvednuto', ''];
  setText(ui.vChip, 'chip', v.type === 'jeep' ? '4×4' : withTrailer && !busy ? 'Přívěs' : chip[0]);
  ui.vChip.className = 'chip ' + chip[1];
  const kmh = Math.abs(v.speed) * 3.6;
  setText(ui.vSpeed, 'spd', String(Math.round(kmh)));
  gauge(kmh, Math.max(20, Math.ceil((v.vmax * 3.6) / 10) * 10), v.fuel / v.fuelCap, Math.min(v.cond, v.tool ? v.tool.cond : 1),
    v.speed < -0.3 ? 'R' : Math.abs(v.speed) > 0.3 ? 'D' : 'N');
  setHTML(ui.icons, 'icons', iconsFor(v, tr, working));
  setHTML(ui.vKv, 'kv', toolKv(v));

  const fg = withTrailer && forageIn(tr) ? { amount: forageIn(tr), cap: tr.tank.cap, crop: -1 } : null;
  const tank = v.harvester ? v.tank : fg || (withTrailer && !tr.bales ? tr.tank : null);
  ui.vTank.hidden = !tank;
  if (tank) {
    setText(ui.vTankLabel, 'tlabel', v.type === 'chopper' ? 'Řezanka' : v.harvester ? 'Zásobník' : fg ? (tr.forage.kind === 'silage' ? 'Siláž' : 'Řezanka') : 'Přívěs');
    setText(ui.vTankTxt, 'tank', tankText(tank));
    ui.vTankBar.style.width = ((tank.amount / tank.cap) * 100).toFixed(1) + '%';
  }


  const f = fieldAt(v.x, v.z);
  ui.vField.hidden = !f;
  if (f) {
    const parts = [];
    const names = f.meadow ? ['dorůstá', '', '', 'k posečení'] : STATE_NAMES;
    f.cnt.forEach((c, k) => { if (c > 0) parts.push([c, names[k] + (k === S_SOWN ? ' (zralost ' + Math.round(f.prog * 100) + ' %)' : '')]); });
    parts.sort((a, b) => b[0] - a[0]);
    const job = G.contracts.active?.field === f.id;
    let line = '<b>' + (f.meadow ? 'Louka ' : 'Pole ') + f.id + '</b>' + (f.owned ? '' : job ? ' · zakázka' : ' · cizí') + ' · ' +
      parts.slice(0, 2).map(p => Math.max(1, Math.round((p[0] / f.area) * 100)) + ' % ' + p[1]).join(', ');
    if (f.fertShare > 0.01) line += ' · hnojeno ' + pct(f.fertShare);
    if (f.owned && !f.meadow) line += ' · výnos ' + Math.round(f.yieldAvg * f.q * 100) + ' %';
    if (f.weedShare > 0.05) line += ' · plevel ' + pct(f.weedShare);
    if (f.strawCnt > 0 && !f.meadow) line += ' · sláma ' + fmt(f.strawCnt) + ' m²';
    if (f.strawCnt > 0 && f.meadow) { const s = f.swath; line += ' · ' + [[s[1], 'tráva v řádku'], [s[2], 'schne'], [s[4], 'suchá rozhozená'], [s[3], 'seno v řádku']].filter(p => p[0] > 0).map(p => p[1] + ' ' + fmt(p[0]) + ' m²').join(', '); }
    setHTML(ui.vField, 'fl', line);
  }

  shedPanel(v);

  const pr = [], rs = raceState();
  if (rs) pr.push(['', 'Traktoriáda · brána ' + Math.min(rs.of, rs.gate + 1) + ' z ' + rs.of + ' · ' + rs.t.toFixed(1).replace('.', ',') + ' s']);
  if (v.helper) pr.push(['H', 'Propustit pomocníka']);
  if (v.type === 'forest' && !v.cutting) {
    const ti = nearestTree(v.x, v.z, 9);
    if (ti >= 0 && trees[ti].g < MATURE) pr.push(['', 'Strom ještě roste · ' + pct(trees[ti].g / MATURE)]);
    if (v.logs >= v.logCap - 0.5) pr.push(['', 'Harvestor je plný, odvez dřevo na pilu']);
  }
  const fa = fPrompt(fAction());
  if (fa) pr.push(['F', fa]);
  const ga = gAction();
  if (ga) pr.push(['G', 'Uskladnit do sila · volno ' + fmt(SILO_CAP - siloTotal()) + ' l']);
  if (!v.helper && f && !v.lowered && canHire(v).f) pr.push(['H', 'Najmout pomocníka · ' + fmt(WAGE) + ' Kč/h']);
  if (!v.helper && v.type === 'forest' && canHire(v).wood) pr.push(['H', 'Najmout pomocníka na těžbu · ' + fmt(WAGE) + ' Kč/h']);
  const waiting = HARVESTERS.find(h => h.unloading && h.waiting === 'reach');
  if (waiting) pr.push(['', 'Najeď přívěsem pod rouru ' + waiting.gen]);
  const tool = v.type === 'tractor' ? (['livestock', 'watertank'].includes(v.impl) ? null : v.tool?.name.toLowerCase()) : HEADERS[v.header]?.short; // the forestry harvester has none
  if (tool && f && (f.owned || G.contracts.active?.field === f.id) && !v.lowered && (!withTrailer || tr.pickup) && !v.helper) pr.push(['Mezerník', tr?.pickup ? 'Spustit sběrač' : 'Spustit ' + tool]);
  if (v.type === 'chopper' && v.waiting === 'reach') pr.push(['', 'Řezačka nemá kam metat: přívěs vlevo vedle ní']);
  if (f && f.owned && v.lowered && Math.abs(v.speed) < 0.3 && v.fuel > 0) pr.push(['W', 'Jeď, nářadí pracuje jen v pohybu']);
  if (v.fuel <= 0) pr.unshift(['K', 'Došla nafta: objednej dovoz v Kanceláři']);
  if (v.harvester && full(v.tank) && !fa) pr.push(['', 'Zásobník je plný']);
  if (v.type === 'tractor' && !v.helper) {
    const near = !v.tool && toolNearby(v), reach = near && toolInReach(v);
    if (reach) pr.unshift(['Q', 'Připojit: ' + labelOf(reach)]);
    else if (near) pr.push(['', 'Zacouvej závěsem k: ' + labelOf(near)]);
    else if (v.tool && Math.abs(v.speed) < 0.3 && !v.lowered) pr.push(['Q', 'Odpojit: ' + labelOf(v.tool)]);
  }
  setHTML(ui.prompt, 'pr', pr.slice(0, ga ? 3 : 2).map(p => '<div>' + (p[0] ? '<kbd>' + p[0] + '</kbd>' : '') + '<span>' + p[1] + '</span></div>').join(''));
}

/** Twice a second: next-step hint and the price list. */
const hhmm = min => { const m = Math.floor(min % 1440); return String((m / 60) | 0).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };

export function updSlowUI() {
  setText(ui.task, 'task', taskText());
  const fc = forecast(), winter = isWinter();
  setText(ui.wx, 'wx', season().name + ' · den ' + dayInSeason() + ' ze ' + DAYS_PER_SEASON + ' · ' + weatherName(WX.kind, winter) +
    (fc ? ', ' + weatherName(fc.kind, winter).toLowerCase() + ' od ' + hhmm(fc.at) : ''));
  const hs = helpers();
  ui.helpers.hidden = !hs.length;
  setHTML(ui.helpers, 'helpers', hs.map(h => '<span><b>Pomocník</b> · ' + labelOf(h) + ': ' + helperStatus(h) + ' · ' + fmt(h.helper.wage) + ' Kč</span>').join(''));
  const g = activeGoals()[0];
  ui.goal.hidden = !g;
  if (g) setHTML(ui.goal, 'goal', '<b>Cíl:</b> ' + g.title + ' · ' + progressText(g) + ' · ' + fmt(g.reward) + ' Kč');
  const c = G.contracts.active;
  ui.job.hidden = !c;
  if (c) {
    const left = c.deadline - G.gameMin, h = Math.max(0, Math.floor(left / 60));
    setHTML(ui.job, 'job', '<b>Zakázka:</b> ' + CTYPES[c.type].name.toLowerCase() + ' pole ' + c.field + ' · ' + pct(progress(c)) +
      ' · zbývá ' + (h >= 24 ? Math.floor(h / 24) + ' d ' + (h % 24) + ' h' : h + ' h') + ' · ' + fmt(c.reward) + ' Kč');
  }
  const ds = G.deliveries.active;
  ui.dlv.hidden = !ds.length;
  if (ds.length) {
    setHTML(ui.dlv, 'dlv', ds.map(d => {
      const left = Math.max(0, d.deadline - G.gameMin), hh = Math.floor(left / 60);
      return '<span><b>Dodávka:</b> ' + fmt(d.done) + ' / ' + fmt(d.amount) + ' l ' + CROPS[d.crop].gen + ' · ' + deliveryMarket(d).short + ' · ' + fmt2(deliveryPrice(d)) + ' Kč/l · zbývá ' +
        (hh >= 24 ? Math.floor(hh / 24) + ' d ' + (hh % 24) + ' h' : hh + ' h') + '</span>';
    }).join(''));
  }
  if (!settings.showPrices) return;
  let h = '';
  CROPS.forEach((c, k) => {
    const { m, p } = bestMarket(k, G.gameMin), d = p - marketPrice(m, k, G.gameMin - 60);
    h += '<li><span>' + c.name + '</span><span>' + fmt2(p) + '</span><span class="where">' + m.short + '</span><span class="' + (d >= 0 ? 'up' : 'down') + '">' + (d >= 0 ? '▲' : '▼') + '</span></li>';
  });
  const bp = balePrice(G.gameMin), bd = bp - balePrice(G.gameMin - 60);
  h += '<li class="sep"><span>Balík slámy</span><span>' + fmt(bp) + '</span><span class="where">Stodola</span><span class="' + (bd >= 0 ? 'up' : 'down') + '">' + (bd >= 0 ? '▲' : '▼') + '</span></li>';
  const hp = hayPrice(G.gameMin), hd = hp - hayPrice(G.gameMin - 60);
  h += '<li><span>Balík sena</span><span>' + fmt(hp) + '</span><span class="where">Stodola</span><span class="' + (hd >= 0 ? 'up' : 'down') + '">' + (hd >= 0 ? '▲' : '▼') + '</span></li>';
  h += '<li><span>Balík senáže</span><span>' + fmt(SILAGE.silageBale) + '</span><span class="where">Stodola</span><span></span></li>';
  h += '<li><span>Siláž l</span><span>' + fmt2(SILAGE.silagePrice) + '</span><span class="where">Bioplynka</span><span></span></li>';
  const { b: wb, p: lp } = bestWood(G.gameMin), ld = lp - logPrice(G.gameMin - 60, wb);
  h += '<li><span>Dřevo m³</span><span>' + fmt(lp) + '</span><span class="where">' + wb.short + '</span><span class="' + (ld >= 0 ? 'up' : 'down') + '">' + (ld >= 0 ? '▲' : '▼') + '</span></li>';
  const st = siloTotal();
  h += '<li class="sep silo"><span>V silu</span><span>' + fmt(st) + ' l</span><span class="where">' + (st ? fmt(siloValue()) + ' Kč' : 'prázdné') + '</span><span></span></li>';
  setHTML(ui.prices, 'prices', h);
}

ui.pricePanel.hidden = !settings.showPrices;
ui.pricesBtn.setAttribute('aria-pressed', String(!!settings.showPrices));
