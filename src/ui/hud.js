import { activeGoals, progressText } from '../game/goals.js';
import { fmt, fmt2, plural } from '../core/util.js';
import { G, TIME_SCALES } from '../game/state.js';
import {
  CROPS, HEADERS, STATE_NAMES, S_STUB, S_CULT, S_SOWN, S_RIPE, FERT_COST, FERT_BONUS, PLOW_BONUS, balePrice,
} from '../game/crops.js';
import { FIELDS, fieldAt } from '../world/fields.js';
import { bales } from '../world/bales.js';
import { IMPL, IMPL_ORDER, BALE_CELLS, HARVESTERS, tractor, combine, trailer } from '../vehicles/vehicles.js';
import { hasTrailer } from '../game/work.js';
import { fAction, inShed } from '../game/actions.js';
import { has } from '../game/machines.js';
import { marketPrice, bestMarket, buyersOf } from '../game/markets.js';
import { WX, season, dayInSeason, isWinter, isWet, forecast, weatherName, DAYS_PER_SEASON } from '../game/weather.js';
import { DIESEL, repairQuote, refuelLiters } from '../game/economy.js';
import { CTYPES, progress } from '../game/contracts.js';
import { WAGE, helpers, jobName, helperProgress, helperWaitText, canHire } from '../game/helpers.js';
import { BUILDINGS, daysLeft, greenhouses } from '../game/farm.js';
import { logPrice, bestWood, woodBuyerAt } from '../game/forestry.js';
import { trees, volume, matureCount, nearestTree, MATURE } from '../world/forest.js';

const $ = id => document.getElementById(id);
const ui = {
  money: $('money'), moneyBox: $('moneyBox'), day: $('day'), time: $('time'), speed: $('speedBtn'), task: $('task'),
  prices: $('priceList'), vName: $('vName'), vChip: $('vChip'), vSpeed: $('vSpeed'), vKv: $('vKv'), vTank: $('vTank'),
  vTankLabel: $('vTankLabel'), vTankTxt: $('vTankTxt'), vTankBar: $('vTankBar'), vField: $('vField'), prompt: $('prompt'),
  shed: $('shedPanel'), shedList: $('shedList'), shedNote: $('shedNote'), wx: $('wxLine'), helpers: $('helperLine'),
  vFuelTxt: $('vFuelTxt'), vFuelBar: $('vFuelBar'), job: $('jobLine'), goal: $('goalLine'),
};

// Only touch the DOM when a value actually changed: layout work is expensive on weak machines.
const last = {};
function setText(el, key, txt) { if (last[key] !== txt) { last[key] = txt; el.textContent = txt; } }
function setHTML(el, key, html) { if (last[key] !== html) { last[key] = html; el.innerHTML = html; } }

const full = tank => tank.amount >= tank.cap - 10;
const tankText = tank => fmt(tank.amount) + ' / ' + fmt(tank.cap) + ' l' + (tank.crop >= 0 && tank.amount > 0 ? ' · ' + CROPS[tank.crop].name : '');
const pct = x => Math.round(x * 100) + ' %';
const implLabel = k => { const im = IMPL[k]; return k === 'trailer' ? 'Sklápěcí přívěs' : k === 'watertank' ? 'Cisterna na vodu' : im.name + ' ' + String(im.width).replace('.', ',') + ' m'; };
const m3 = x => String((+x).toFixed(1)).replace('.', ',') + ' m³';

function taskText() {
  const owned = FIELDS.filter(f => f.owned), sum = k => owned.reduce((a, f) => a + f.cnt[k], 0);
  const straw = owned.reduce((a, f) => a + f.strawCnt, 0);
  const ripe = owned.filter(f => f.cnt[S_RIPE] - f.ripeBeet > 0).map(f => f.id);
  const ripeBeet = owned.filter(f => f.ripeBeet > 0).map(f => f.id);
  const fullH = HARVESTERS.find(h => full(h.tank));
  const waitingH = HARVESTERS.find(h => h.unloading && h.waiting === 'reach');
  const loadedH = HARVESTERS.find(h => h.tank.amount > 0);
  const unfert = owned.filter(f => f.cnt[S_SOWN] > f.area * 0.3 && f.fertShare < 0.5).map(f => f.id);
  let t;
  if (fullH) {
    t = hasTrailer()
      ? 'Zásobník ' + fullH.gen + ' je plný. Přistav přívěs vlevo od něj pod rouru a stiskni F, nebo jeď do výkupu.'
      : 'Zásobník ' + fullH.gen + ' je plný. Zajeď do kruhu výkupu a stiskni F, nejvíc teď platí ' + bestMarket(fullH.tank.crop, G.gameMin).m.name + '.';
  } else if (full(trailer.tank)) t = 'Přívěs je plný. Odvez ho do výkupu (nejvíc platí ' + bestMarket(trailer.tank.crop, G.gameMin).m.name + ') a vysyp klávesou F.';
  else if (trailer.bales >= trailer.baleCap) t = 'Přívěs je plný balíků. Odvez je do hnědého kruhu u stodoly a prodej klávesou F.';
  else if (has('cows') && daysLeft('cows') < 0.4) t = 'Krávám dochází krmivo. Vylož kukuřici, ječmen nebo cukrovku do zeleného kruhu u kravína (F).';
  else if (has('hens') && daysLeft('hens') < 0.4) t = 'Slepicím dochází krmivo. Vylož pšenici nebo ječmen do žlutého kruhu u kurníku (F).';
  else if (greenhouses() && daysLeft('water') < 0.4) t = has('watertank') ? 'Skleníkům dochází voda. Cisternu (kůlna, klávesa 7) naplníš u rybníka a vyleješ v modrém kruhu u skleníků.' : 'Skleníkům dochází voda. Cisternu na vodu koupíš v Kanceláři (K).';
  else if (waitingH) t = (waitingH === combine ? 'Kombajn' : 'Sklízeč') + ' vykládá. Najeď přívěsem vlevo od něj pod výsypnou rouru.';
  else if ((ripe.length || ripeBeet.length) && isWet()) t = 'Prší, sklízet se teď nedá. Plodiny oschnou hodinu po dešti, mezitím můžeš kultivovat, hnojit nebo prodávat.';
  else if (ripe.length) t = 'Skliď zralé plodiny kombajnem na poli ' + ripe.join(' a ') + '. Spusť lištu mezerníkem.';
  else if (ripeBeet.length) t = has('beet') ? 'Skliď cukrovku na poli ' + ripeBeet.join(' a ') + ' sklízečem cukrovky. Přesedneš do něj klávesou Tab.'
    : 'Cukrovka na poli ' + ripeBeet.join(' a ') + ' je zralá. Sklízeč cukrovky si pronajmi nebo kup v Kanceláři (K).';
  else if (loadedH) t = hasTrailer() ? 'Přelož úrodu ze zásobníku ' + loadedH.gen + ' do přívěsu (F), nebo ji prodej ve výkupu.' : 'Prodej úrodu ze zásobníku ' + loadedH.gen + ' ve výkupu (F). Nejvíc teď platí ' + bestMarket(loadedH.tank.crop, G.gameMin).m.name + '.';
  else if (trailer.tank.amount > 0) t = 'Odvez úrodu v přívěsu do výkupu a vysyp ji klávesou F. Nejvíc teď platí ' + bestMarket(trailer.tank.crop, G.gameMin).m.name + '.';
  else if (straw > 40) t = has('baler') ? 'Na poli leží řádky slámy. Připoj v kůlně lis a slisuj je do balíků, než pole zkultivuješ.'
    : 'Na poli leží řádky slámy. Lis na balíky koupíš nebo pronajmeš v Kanceláři (K). Jinak slámu zaorej.';
  else if (bales.length) t = 'Na poli leží ' + plural(bales.length, 'balík', 'balíky', 'balíků') + '. Připoj přívěs a projeď kolem nich, naloží se samy. Prodáš je u stodoly.';
  else if (trailer.bales) t = 'Odvez balíky v přívěsu do hnědého kruhu u stodoly a prodej je klávesou F.';
  else if (sum(S_STUB) > 0) t = tractor.impl === 'cultivator' || tractor.impl === 'plough'
    ? (has('plough') ? 'Zkultivuj nebo zoráš strniště. Pluh je pomalejší, ale dá +15 % výnosu.' : 'Zkultivuj strniště. Pluh (+15 % výnosu) koupíš v Kanceláři (K).')
    : 'Na strniště potřebuješ kultivátor nebo pluh. Vyměníš je v kůlně (klávesy 1–6).';
  else if (sum(S_CULT) > 0 && isWinter()) t = 'Zima: nesije se a nic neroste. Zoráš strniště, opravíš stroje v kůlně (R), nebo počkáš na jaro (T zrychlí čas).';
  else if (sum(S_CULT) > 0) t = tractor.impl === 'seeder' ? 'Zasej zkultivovanou půdu. Osivo změníš klávesou C.' : 'Připoj v kůlně secí stroj a zasej.';
  else if (unfert.length && has('spreader')) t = 'Pohnoj pole ' + unfert.join(' a ') + ' rozmetadlem (+25 % výnosu), dokud plodiny rostou.';
  else if (unfert.length && G.money > 90000 && !G.contracts.active) t = 'Rozmetadlo za 90 000 Kč z Kanceláře (K) přidá rostoucím plodinám 25 % výnosu.';
  else if (has('forest') && matureCount() > 0 && sum(S_SOWN) > 0) t = 'Plodiny rostou. V lese na severu je ' + matureCount() + ' vzrostlých stromů: harvestorem je pokácíš (F) a dřevo prodáš na pile.';
  else if (G.contracts.offers.length && !G.contracts.active) t = 'Plodiny rostou. Mezitím si vydělej zakázkou u souseda: Kancelář (K) → Zakázky.';
  else if (sum(S_SOWN) > 0) t = isWinter() ? 'V zimě plodiny nerostou. Na jaře se rozrostou znovu, T zrychlí čas.' : 'Plodiny rostou. Klávesa T zrychlí čas.';
  else t = 'Všechno je hotové. V Kanceláři (K) najdeš zvířata, skleníky, harvestor do lesa i vylepšení strojů.';
  const cheapest = FIELDS.filter(f => !f.owned).sort((a, b) => a.price - b.price)[0];
  if (cheapest && G.money >= cheapest.price) t += ' Máš na koupi pole ' + cheapest.id + '.';
  return t;
}

function fPrompt(a) {
  if (!a) return null;
  switch (a.kind) {
    case 'refuel': { const l = refuelLiters(a.v); return l >= 1 ? 'Natankovat ' + fmt(l) + ' l nafty za ' + fmt(l * DIESEL) + ' Kč' : 'Na naftu nemáš peníze'; }
    case 'stopUnload': return 'Zastavit vykládku ' + a.h.gen;
    case 'fell': return 'Pokácet strom · ' + m3(volume(trees[a.i]));
    case 'sellLogs': return 'Prodat ' + m3(G.active.logs) + ' dřeva za ' + fmt(G.active.logs * logPrice(G.gameMin, woodBuyerAt(G.active) || undefined)) + ' Kč';
    case 'fillWater': return 'Nabrat vodu z rybníka';
    case 'giveWater': return 'Vylít vodu do skleníků';
    case 'sell': if (a.m.feed) return 'Vyložit ' + fmt(a.h.tank.amount) + ' l ' + CROPS[a.h.tank.crop].gen + ' do krmelce · ' + a.m.short;
      return 'Prodat ' + fmt(a.h.tank.amount) + ' l ' + CROPS[a.h.tank.crop].gen + ' za ' + fmt(a.h.tank.amount * marketPrice(a.m, a.h.tank.crop, G.gameMin)) + ' Kč';
    case 'wrongMarket': return a.m.name + ' nebere ' + CROPS[a.crop].gen + ' · vezme ji ' + buyersOf(a.crop).join(', ');
    case 'overload': return 'Přeložit ' + fmt(a.h.tank.amount) + ' l ' + CROPS[a.h.tank.crop].gen + ' do přívěsu';
    case 'tip': if (a.m.feed) return 'Vysypat ' + fmt(trailer.tank.amount) + ' l ' + CROPS[trailer.tank.crop].gen + ' do krmelce · ' + a.m.short;
      return 'Vysypat a prodat ' + fmt(trailer.tank.amount) + ' l za ' + fmt(trailer.tank.amount * marketPrice(a.m, trailer.tank.crop, G.gameMin)) + ' Kč';
    case 'stopTip': return 'Zastavit vysypávání';
    case 'sellBales': return 'Prodat ' + plural(trailer.bales, 'balík', 'balíky', 'balíků') + ' za ' + fmt(trailer.bales * balePrice(G.gameMin)) + ' Kč';
    case 'swap': return 'Vyměnit za ' + IMPL[a.impl].name.toLowerCase();
    case 'header': return 'Vyměnit za ' + HEADERS[a.header].short;
    case 'buy': return 'Koupit pole ' + a.sign.f.id + ' za ' + fmt(a.sign.f.price) + ' Kč';
  }
  return null;
}

const condTxt = v => {
  let t = 'stroj ' + pct(G.cond[v.type] ?? 1);
  if (v.type === 'tractor') t += ' · nářadí ' + pct(G.cond[v.impl] ?? 1);
  return '<dt>Stav</dt><dd' + (Math.min(G.cond[v.type] ?? 1, v.type === 'tractor' ? G.cond[v.impl] ?? 1 : 1) < 0.3 ? ' class="down"' : '') + '>' + t + '</dd>';
};

function toolKv(v) {
  if (v.type === 'forest') return '<dt>Dřevo</dt><dd>' + m3(v.logs) + ' / ' + v.logCap + ' m³</dd>' + condTxt(v);
  if (v.harvester) return '<dt>Nářadí</dt><dd>' + HEADERS[v.header].name + ' ' + String(v.toolW).replace('.', ',') + ' m</dd>' + condTxt(v);
  const c = CROPS[v.seedCrop];
  let kv = '<dt>Nářadí</dt><dd>' + implLabel(v.impl) + '</dd>';
  if (v.impl === 'seeder') kv += '<dt>Osivo <kbd>C</kbd></dt><dd>' + c.name + ' · ' + c.seed + ' Kč/m²</dd>';
  if (v.impl === 'plough') kv += '<dt>Účinek</dt><dd>+' + pct(PLOW_BONUS) + ' výnosu</dd>';
  if (v.impl === 'spreader') kv += '<dt>Hnojivo</dt><dd>' + FERT_COST + ' Kč/m² · +' + pct(FERT_BONUS) + ' výnosu</dd>';
  if (v.impl === 'baler') kv += '<dt>Komora lisu</dt><dd>' + pct(v.baleAcc / BALE_CELLS) + '</dd>';
  if (v.impl === 'watertank') kv += '<dt>Voda</dt><dd>' + fmt(IMPL.watertank.water) + ' / ' + fmt(IMPL.watertank.waterCap) + ' l</dd>';
  if (v.impl === 'trailer' && trailer.bales) kv += '<dt>Balíky</dt><dd>' + trailer.bales + ' / ' + trailer.baleCap + '</dd>';
  return kv + condTxt(v);
}

function shedPanel(v) {
  const show = inShed(v) && (v === tractor || v === combine);
  ui.shed.hidden = !show;
  if (!show) return;
  const items = v.type === 'tractor'
    ? IMPL_ORDER.map((k, i) => [i + 1, implLabel(k), tractor.impl === k, has(k)])
    : [[1, HEADERS.grain.name + ' (obilí, řepka)', combine.header === 'grain', true], [2, HEADERS.corn.name + ' (kukuřice, slunečnice)', combine.header === 'corn', has('cornHeader')]];
  setHTML(ui.shedList, 'shed', items.map(([n, label, on, owned]) => '<li class="' + (on ? 'on' : '') + (owned ? '' : ' off') + '"><kbd>' + n + '</kbd><span>' + label + (owned ? '' : ' · nevlastníš') + '</span></li>').join(''));
  const q = repairQuote(v);
  setHTML(ui.shedNote, 'shedNote', q >= 1 ? '<kbd>R</kbd> Opravit za ' + fmt(q) + ' Kč' : 'Stroj je v pořádku.');
}

/** Every frame: money, clock, vehicle panel, shed panel and key prompts. */
export function updUI() {
  setText(ui.money, 'money', fmt(G.money));
  ui.moneyBox.classList.toggle('flash', G.flashT > 0);
  const day = Math.floor(G.gameMin / 1440) + 1, m = Math.floor(G.gameMin % 1440);
  setText(ui.day, 'day', 'Den ' + day);
  setText(ui.time, 'time', String((m / 60) | 0).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
  setText(ui.speed, 'ts', TIME_SCALES[G.tsIdx] + '×');

  const v = G.active;
  const withTrailer = v.type === 'tractor' && v.impl === 'trailer';
  setText(ui.vName, 'vname', v.name);
  const working = v.lowered && v.speed > 0.3;
  const busy = (v.harvester && v.unloading) || (withTrailer && trailer.tipping);
  const chip = v.helper ? ['Pomocník', v.helper.wait ? 'warn' : 'on'] : busy ? ['Vykládá', 'warn'] : working ? ['Pracuje', 'on'] : v.lowered ? ['Spuštěno', 'warn'] : ['Zvednuto', ''];
  setText(ui.vChip, 'chip', withTrailer && !busy ? 'Přívěs' : chip[0]);
  ui.vChip.className = 'chip ' + chip[1];
  setText(ui.vSpeed, 'spd', String(Math.round(Math.abs(v.speed) * 3.6)));
  setHTML(ui.vKv, 'kv', toolKv(v));

  const tank = v.harvester ? v.tank : withTrailer && !trailer.bales ? trailer.tank : null;
  ui.vTank.hidden = !tank;
  if (tank) {
    setText(ui.vTankLabel, 'tlabel', v.harvester ? 'Zásobník' : 'Přívěs');
    setText(ui.vTankTxt, 'tank', tankText(tank));
    ui.vTankBar.style.width = ((tank.amount / tank.cap) * 100).toFixed(1) + '%';
  }

  setText(ui.vFuelTxt, 'fuel', fmt(v.fuel) + ' / ' + fmt(v.fuelCap) + ' l');
  ui.vFuelBar.style.width = ((v.fuel / v.fuelCap) * 100).toFixed(1) + '%';
  ui.vFuelBar.classList.toggle('low', v.fuel < v.fuelCap * 0.15);

  const f = fieldAt(v.x, v.z);
  ui.vField.hidden = !f;
  if (f) {
    const parts = [];
    f.cnt.forEach((c, k) => { if (c > 0) parts.push([c, STATE_NAMES[k] + (k === S_SOWN ? ' (zralost ' + Math.round(f.prog * 100) + ' %)' : '')]); });
    parts.sort((a, b) => b[0] - a[0]);
    const job = G.contracts.active?.field === f.id;
    let line = '<b>Pole ' + f.id + '</b>' + (f.owned ? '' : job ? ' · zakázka' : ' · cizí') + ' · ' +
      parts.slice(0, 2).map(p => Math.max(1, Math.round((p[0] / f.area) * 100)) + ' % ' + p[1]).join(', ');
    if (f.fertShare > 0.01) line += ' · hnojeno ' + pct(f.fertShare);
    if (f.strawCnt > 0) line += ' · sláma ' + fmt(f.strawCnt) + ' m²';
    setHTML(ui.vField, 'fl', line);
  }

  shedPanel(v);

  const pr = [];
  if (v.helper) pr.push(['H', 'Propustit pomocníka']);
  if (v.type === 'forest' && !v.cutting) {
    const ti = nearestTree(v.x, v.z, 9);
    if (ti >= 0 && trees[ti].g < MATURE) pr.push(['', 'Strom ještě roste · ' + pct(trees[ti].g / MATURE)]);
    if (v.logs >= v.logCap - 0.5) pr.push(['', 'Harvestor je plný, odvez dřevo na pilu']);
  }
  const fa = fPrompt(fAction());
  if (fa) pr.push(['F', fa]);
  if (!v.helper && f && !v.lowered && canHire(v).f) pr.push(['H', 'Najmout pomocníka · ' + fmt(WAGE) + ' Kč/h']);
  const waiting = HARVESTERS.find(h => h.unloading && h.waiting === 'reach');
  if (waiting) pr.push(['', 'Najeď přívěsem pod rouru ' + waiting.gen]);
  const tool = v.type === 'tractor' ? IMPL[v.impl].name.toLowerCase() : HEADERS[v.header]?.short; // the forestry harvester has none
  if (tool && f && (f.owned || G.contracts.active?.field === f.id) && !v.lowered && !withTrailer && !v.helper) pr.push(['Mezerník', 'Spustit ' + tool]);
  if (f && f.owned && v.lowered && Math.abs(v.speed) < 0.3 && v.fuel > 0) pr.push(['W', 'Jeď, nářadí pracuje jen v pohybu']);
  if (v.fuel <= 0) pr.unshift(['K', 'Došla nafta: objednej dovoz v Kanceláři']);
  if (v.harvester && full(v.tank) && !fa) pr.push(['', 'Zásobník je plný']);
  setHTML(ui.prompt, 'pr', pr.slice(0, 2).map(p => '<div>' + (p[0] ? '<kbd>' + p[0] + '</kbd>' : '') + '<span>' + p[1] + '</span></div>').join(''));
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
  setHTML(ui.helpers, 'helpers', hs.map(h => '<span><b>Pomocník</b> · ' + h.name.split(' ')[0] + ': ' + jobName(h) + ' pole ' + h.helper.field.id + ' · ' +
    pct(helperProgress(h)) + (h.helper.wait ? ' · ' + helperWaitText[h.helper.wait] : '') + ' · ' + fmt(h.helper.wage) + ' Kč</span>').join(''));
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
  let h = '';
  CROPS.forEach((c, k) => {
    const { m, p } = bestMarket(k, G.gameMin), d = p - marketPrice(m, k, G.gameMin - 60);
    h += '<li><span>' + c.name + '</span><span>' + fmt2(p) + '</span><span class="where">' + m.short + '</span><span class="' + (d >= 0 ? 'up' : 'down') + '">' + (d >= 0 ? '▲' : '▼') + '</span></li>';
  });
  const bp = balePrice(G.gameMin), bd = bp - balePrice(G.gameMin - 60);
  h += '<li class="sep"><span>Balík slámy</span><span>' + fmt(bp) + '</span><span class="where">Stodola</span><span class="' + (bd >= 0 ? 'up' : 'down') + '">' + (bd >= 0 ? '▲' : '▼') + '</span></li>';
  const { b: wb, p: lp } = bestWood(G.gameMin), ld = lp - logPrice(G.gameMin - 60, wb);
  h += '<li><span>Dřevo m³</span><span>' + fmt(lp) + '</span><span class="where">' + wb.short + '</span><span class="' + (ld >= 0 ? 'up' : 'down') + '">' + (ld >= 0 ? '▲' : '▼') + '</span></li>';
  setHTML(ui.prices, 'prices', h);
}
