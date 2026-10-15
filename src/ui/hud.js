import { fmt, fmt2, plural } from '../core/util.js';
import { G, TIME_SCALES } from '../game/state.js';
import {
  CROPS, HEADERS, STATE_NAMES, S_STUB, S_CULT, S_SOWN, S_RIPE, FERT_COST, FERT_BONUS, PLOW_BONUS, price, balePrice,
} from '../game/crops.js';
import { FIELDS, fieldAt } from '../world/fields.js';
import { bales } from '../world/bales.js';
import { IMPL, IMPL_ORDER, BALE_CELLS, tractor, combine, trailer } from '../vehicles/vehicles.js';
import { hasTrailer } from '../game/work.js';
import { fAction, inShed } from '../game/actions.js';

const $ = id => document.getElementById(id);
const ui = {
  money: $('money'), moneyBox: $('moneyBox'), day: $('day'), time: $('time'), speed: $('speedBtn'), task: $('task'),
  prices: $('priceList'), vName: $('vName'), vChip: $('vChip'), vSpeed: $('vSpeed'), vKv: $('vKv'), vTank: $('vTank'),
  vTankLabel: $('vTankLabel'), vTankTxt: $('vTankTxt'), vTankBar: $('vTankBar'), vField: $('vField'), prompt: $('prompt'),
  shed: $('shedPanel'), shedList: $('shedList'),
};

// Only touch the DOM when a value actually changed: layout work is expensive on weak machines.
const last = {};
function setText(el, key, txt) { if (last[key] !== txt) { last[key] = txt; el.textContent = txt; } }
function setHTML(el, key, html) { if (last[key] !== html) { last[key] = html; el.innerHTML = html; } }

const full = tank => tank.amount >= tank.cap - 10;
const tankText = tank => fmt(tank.amount) + ' / ' + fmt(tank.cap) + ' l' + (tank.crop >= 0 && tank.amount > 0 ? ' · ' + CROPS[tank.crop].name : '');
const pct = x => Math.round(x * 100) + ' %';
const implLabel = k => { const im = IMPL[k]; return k === 'trailer' ? 'Sklápěcí přívěs' : im.name + ' ' + String(im.width).replace('.', ',') + ' m'; };

function taskText() {
  const owned = FIELDS.filter(f => f.owned), sum = k => owned.reduce((a, f) => a + f.cnt[k], 0);
  const straw = owned.reduce((a, f) => a + f.strawCnt, 0);
  const ripe = owned.filter(f => f.cnt[S_RIPE] > 0).map(f => f.id);
  const unfert = owned.filter(f => f.cnt[S_SOWN] > f.n * 0.3 && f.fertShare < 0.5).map(f => f.id);
  let t;
  if (full(combine.tank)) {
    t = hasTrailer()
      ? 'Zásobník kombajnu je plný. Přistav přívěs vlevo od kombajnu pod rouru a stiskni F, nebo jeď k silům.'
      : 'Zásobník kombajnu je plný. Zajeď do žlutého kruhu u sil a stiskni F. Rychlejší je připojit v kůlně přívěs.';
  } else if (full(trailer.tank)) t = 'Přívěs je plný. Odvez ho do žlutého kruhu u sil a vysyp klávesou F.';
  else if (trailer.bales >= trailer.baleCap) t = 'Přívěs je plný balíků. Odvez je do hnědého kruhu u stodoly a prodej klávesou F.';
  else if (combine.unloading && combine.waiting === 'reach') t = 'Kombajn vykládá. Najeď přívěsem vlevo od kombajnu pod výsypnou rouru.';
  else if (ripe.length) t = 'Skliď zralé plodiny kombajnem na poli ' + ripe.join(' a ') + '. Spusť lištu mezerníkem.';
  else if (combine.tank.amount > 0) t = hasTrailer() ? 'Přelož zrno z kombajnu do přívěsu (F), nebo ho prodej u sil.' : 'Prodej zrno z kombajnu ve výkupu u sil (F).';
  else if (trailer.tank.amount > 0) t = 'Odvez zrno v přívěsu k silům a vysyp ho klávesou F.';
  else if (straw > 40) t = 'Na poli leží řádky slámy. Připoj v kůlně lis a slisuj je do balíků, než pole zkultivuješ.';
  else if (bales.length) t = 'Na poli leží ' + plural(bales.length, 'balík', 'balíky', 'balíků') + '. Připoj přívěs a projeď kolem nich, naloží se samy. Prodáš je u stodoly.';
  else if (trailer.bales) t = 'Odvez balíky v přívěsu do hnědého kruhu u stodoly a prodej je klávesou F.';
  else if (sum(S_STUB) > 0) t = tractor.impl === 'cultivator' || tractor.impl === 'plough'
    ? 'Zkultivuj nebo zoráš strniště. Pluh je pomalejší, ale dá +15 % výnosu.'
    : 'Na strniště potřebuješ kultivátor nebo pluh. Vyměníš je v kůlně (klávesy 1–6).';
  else if (sum(S_CULT) > 0) t = tractor.impl === 'seeder' ? 'Zasej zkultivovanou půdu. Osivo změníš klávesou C.' : 'Připoj v kůlně secí stroj a zasej.';
  else if (unfert.length) t = 'Pohnoj pole ' + unfert.join(' a ') + ' rozmetadlem (+25 % výnosu), dokud plodiny rostou.';
  else if (sum(S_SOWN) > 0) t = 'Plodiny rostou. Klávesa T zrychlí čas.';
  else t = 'Všechno je hotové.';
  const cheapest = FIELDS.filter(f => !f.owned).sort((a, b) => a.price - b.price)[0];
  if (cheapest && G.money >= cheapest.price) t += ' Máš na koupi pole ' + cheapest.id + '.';
  return t;
}

function fPrompt(a) {
  if (!a) return null;
  switch (a.kind) {
    case 'stopCombine': return 'Zastavit vykládku kombajnu';
    case 'sellCombine': return 'Prodat ' + fmt(combine.tank.amount) + ' l ' + CROPS[combine.tank.crop].gen + ' za ' + fmt(combine.tank.amount * price(combine.tank.crop, G.gameMin)) + ' Kč';
    case 'overload': return 'Přeložit ' + fmt(combine.tank.amount) + ' l ' + CROPS[combine.tank.crop].gen + ' do přívěsu';
    case 'tip': return 'Vysypat a prodat ' + fmt(trailer.tank.amount) + ' l za ' + fmt(trailer.tank.amount * price(trailer.tank.crop, G.gameMin)) + ' Kč';
    case 'stopTip': return 'Zastavit vysypávání';
    case 'sellBales': return 'Prodat ' + plural(trailer.bales, 'balík', 'balíky', 'balíků') + ' za ' + fmt(trailer.bales * balePrice(G.gameMin)) + ' Kč';
    case 'swap': return 'Vyměnit za ' + IMPL[a.impl].name.toLowerCase();
    case 'header': return 'Vyměnit za ' + HEADERS[a.header].short;
    case 'buy': return 'Koupit pole ' + a.sign.f.id + ' za ' + fmt(a.sign.f.price) + ' Kč';
  }
  return null;
}

function toolKv(v) {
  if (v.type === 'combine') return '<dt>Nářadí</dt><dd>' + HEADERS[v.header].name + ' 5,4 m</dd>';
  const c = CROPS[v.seedCrop];
  let kv = '<dt>Nářadí</dt><dd>' + implLabel(v.impl) + '</dd>';
  if (v.impl === 'seeder') kv += '<dt>Osivo <kbd>C</kbd></dt><dd>' + c.name + ' · ' + c.seed + ' Kč/m²</dd>';
  if (v.impl === 'plough') kv += '<dt>Účinek</dt><dd>+' + pct(PLOW_BONUS) + ' výnosu</dd>';
  if (v.impl === 'spreader') kv += '<dt>Hnojivo</dt><dd>' + FERT_COST + ' Kč/m² · +' + pct(FERT_BONUS) + ' výnosu</dd>';
  if (v.impl === 'baler') kv += '<dt>Komora lisu</dt><dd>' + pct(v.baleAcc / BALE_CELLS) + '</dd>';
  if (v.impl === 'trailer' && trailer.bales) kv += '<dt>Balíky</dt><dd>' + trailer.bales + ' / ' + trailer.baleCap + '</dd>';
  return kv;
}

function shedPanel(v) {
  const show = inShed(v);
  ui.shed.hidden = !show;
  if (!show) return;
  const items = v.type === 'tractor'
    ? IMPL_ORDER.map((k, i) => [i + 1, implLabel(k), tractor.impl === k])
    : [[1, HEADERS.grain.name + ' (obilí, řepka)', combine.header === 'grain'], [2, HEADERS.corn.name + ' (kukuřice, slunečnice)', combine.header === 'corn']];
  setHTML(ui.shedList, 'shed', items.map(([n, label, on]) => '<li' + (on ? ' class="on"' : '') + '><kbd>' + n + '</kbd><span>' + label + '</span></li>').join(''));
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
  const busy = (v.type === 'combine' && v.unloading) || (withTrailer && trailer.tipping);
  const chip = busy ? ['Vykládá', 'warn'] : working ? ['Pracuje', 'on'] : v.lowered ? ['Spuštěno', 'warn'] : ['Zvednuto', ''];
  setText(ui.vChip, 'chip', withTrailer && !busy ? 'Přívěs' : chip[0]);
  ui.vChip.className = 'chip ' + chip[1];
  setText(ui.vSpeed, 'spd', String(Math.round(Math.abs(v.speed) * 3.6)));
  setHTML(ui.vKv, 'kv', toolKv(v));

  const tank = v.type === 'combine' ? v.tank : withTrailer && !trailer.bales ? trailer.tank : null;
  ui.vTank.hidden = !tank;
  if (tank) {
    setText(ui.vTankLabel, 'tlabel', v.type === 'combine' ? 'Zásobník' : 'Přívěs');
    setText(ui.vTankTxt, 'tank', tankText(tank));
    ui.vTankBar.style.width = ((tank.amount / tank.cap) * 100).toFixed(1) + '%';
  }

  const f = fieldAt(v.x, v.z);
  ui.vField.hidden = !f;
  if (f) {
    const parts = [];
    f.cnt.forEach((c, k) => { if (c > 0) parts.push([c, STATE_NAMES[k] + (k === S_SOWN ? ' (zralost ' + Math.round(f.prog * 100) + ' %)' : '')]); });
    parts.sort((a, b) => b[0] - a[0]);
    let line = '<b>Pole ' + f.id + '</b>' + (f.owned ? '' : ' · cizí') + ' · ' +
      parts.slice(0, 2).map(p => Math.max(1, Math.round((p[0] / f.n) * 100)) + ' % ' + p[1]).join(', ');
    if (f.fertShare > 0.01) line += ' · hnojeno ' + pct(f.fertShare);
    if (f.strawCnt > 0) line += ' · sláma ' + fmt(f.strawCnt) + ' m²';
    setHTML(ui.vField, 'fl', line);
  }

  shedPanel(v);

  const pr = [];
  const fa = fPrompt(fAction());
  if (fa) pr.push(['F', fa]);
  if (combine.unloading && combine.waiting === 'reach') pr.push(['', 'Najeď přívěsem pod rouru kombajnu']);
  if (f && f.owned && !v.lowered && !withTrailer) pr.push(['Mezerník', 'Spustit ' + (v.type === 'tractor' ? IMPL[v.impl].name.toLowerCase() : HEADERS[v.header].short)]);
  if (f && f.owned && v.lowered && Math.abs(v.speed) < 0.3) pr.push(['W', 'Jeď, nářadí pracuje jen v pohybu']);
  if (v.type === 'combine' && full(v.tank) && !fa) pr.push(['', 'Zásobník je plný']);
  setHTML(ui.prompt, 'pr', pr.slice(0, 2).map(p => '<div>' + (p[0] ? '<kbd>' + p[0] + '</kbd>' : '') + '<span>' + p[1] + '</span></div>').join(''));
}

/** Twice a second: next-step hint and the price list. */
export function updSlowUI() {
  setText(ui.task, 'task', taskText());
  let h = '';
  CROPS.forEach((c, k) => {
    const p = price(k, G.gameMin), d = p - price(k, G.gameMin - 60);
    h += '<li><span>' + c.name + '</span><span>' + fmt2(p) + '</span><span class="' + (d >= 0 ? 'up' : 'down') + '">' + (d >= 0 ? '▲' : '▼') + '</span></li>';
  });
  const bp = balePrice(G.gameMin), bd = bp - balePrice(G.gameMin - 60);
  h += '<li class="sep"><span>Balík slámy</span><span>' + fmt(bp) + '</span><span class="' + (bd >= 0 ? 'up' : 'down') + '">' + (bd >= 0 ? '▲' : '▼') + '</span></li>';
  setHTML(ui.prices, 'prices', h);
}
