import { fmt, fmt2 } from '../core/util.js';
import { G, TIME_SCALES } from '../game/state.js';
import { CROPS, STATE_NAMES, S_STUB, S_CULT, S_SOWN, S_RIPE, price } from '../game/crops.js';
import { FIELDS, fieldAt } from '../world/fields.js';
import { IMPL, tractor, combine } from '../vehicles/vehicles.js';
import { inSell } from '../game/work.js';
import { inShed, nearSign, otherImpl } from '../game/actions.js';

const $ = id => document.getElementById(id);
const ui = {
  money: $('money'), moneyBox: $('moneyBox'), day: $('day'), time: $('time'), speed: $('speedBtn'), task: $('task'),
  prices: $('priceList'), vName: $('vName'), vChip: $('vChip'), vSpeed: $('vSpeed'), vKv: $('vKv'), vTank: $('vTank'),
  vTankTxt: $('vTankTxt'), vTankBar: $('vTankBar'), vField: $('vField'), prompt: $('prompt'),
};

// Only touch the DOM when a value actually changed: layout work is expensive on weak machines.
const last = {};
function setText(el, key, txt) { if (last[key] !== txt) { last[key] = txt; el.textContent = txt; } }
function setHTML(el, key, html) { if (last[key] !== html) { last[key] = html; el.innerHTML = html; } }

function taskText() {
  const owned = FIELDS.filter(f => f.owned), sum = k => owned.reduce((a, f) => a + f.cnt[k], 0);
  const ripe = owned.filter(f => f.cnt[S_RIPE] > 0).map(f => f.id);
  let t;
  if (combine.tank.amount >= combine.tank.cap - 10) t = 'Zásobník kombajnu je plný. Zajeď do žlutého kruhu u sil a stiskni F.';
  else if (ripe.length) t = 'Skliď zralé plodiny kombajnem na poli ' + ripe.join(' a ') + '. Spusť lištu mezerníkem.';
  else if (combine.tank.amount > 0) t = 'Prodej zrno z kombajnu ve výkupu u sil (F).';
  else if (sum(S_STUB) > 0) t = tractor.impl === 'cultivator' ? 'Zkultivuj strniště traktorem. Tab přepne stroj.' : 'Na strniště potřebuješ kultivátor. Vyměníš ho v kůlně klávesou F.';
  else if (sum(S_CULT) > 0) t = tractor.impl === 'seeder' ? 'Zasej zkultivovanou půdu. Osivo změníš klávesou C.' : 'Připoj v kůlně secí stroj (F) a zasej.';
  else if (sum(S_SOWN) > 0) t = 'Plodiny rostou. Klávesa T zrychlí čas.';
  else t = 'Všechno je hotové.';
  const cheapest = FIELDS.filter(f => !f.owned).sort((a, b) => a.price - b.price)[0];
  if (cheapest && G.money >= cheapest.price) t += ' Máš na koupi pole ' + cheapest.id + '.';
  return t;
}

/** Every frame: money, clock, vehicle panel and key prompts. */
export function updUI() {
  setText(ui.money, 'money', fmt(G.money));
  ui.moneyBox.classList.toggle('flash', G.flashT > 0);
  const day = Math.floor(G.gameMin / 1440) + 1, m = Math.floor(G.gameMin % 1440);
  setText(ui.day, 'day', 'Den ' + day);
  setText(ui.time, 'time', String((m / 60) | 0).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
  setText(ui.speed, 'ts', TIME_SCALES[G.tsIdx] + '×');

  const v = G.active;
  setText(ui.vName, 'vname', v.name);
  const working = v.lowered && v.speed > 0.3;
  const chip = v.unloading ? ['Vykládá', 'warn'] : working ? ['Pracuje', 'on'] : v.lowered ? ['Spuštěno', 'warn'] : ['Zvednuto', ''];
  setText(ui.vChip, 'chip', chip[0]);
  ui.vChip.className = 'chip ' + chip[1];
  setText(ui.vSpeed, 'spd', String(Math.round(Math.abs(v.speed) * 3.6)));
  let kv;
  if (v.type === 'tractor') {
    const im = IMPL[v.impl], c = CROPS[v.seedCrop];
    kv = '<dt>Nářadí</dt><dd>' + im.name + ' ' + String(im.width).replace('.', ',') + ' m</dd>';
    if (v.impl === 'seeder') kv += '<dt>Osivo <kbd>C</kbd></dt><dd>' + c.name + ' · ' + c.seed + ' Kč/m²</dd>';
  } else kv = '<dt>Nářadí</dt><dd>Žací lišta 5,4 m</dd>';
  setHTML(ui.vKv, 'kv', kv);
  ui.vTank.hidden = v.type !== 'combine';
  if (v.type === 'combine') {
    setText(ui.vTankTxt, 'tank', fmt(v.tank.amount) + ' / ' + fmt(v.tank.cap) + ' l' + (v.tank.crop >= 0 && v.tank.amount > 0 ? ' · ' + CROPS[v.tank.crop].name : ''));
    ui.vTankBar.style.width = ((v.tank.amount / v.tank.cap) * 100).toFixed(1) + '%';
  }

  const f = fieldAt(v.x, v.z);
  ui.vField.hidden = !f;
  if (f) {
    const parts = [];
    f.cnt.forEach((c, k) => { if (c > 0) parts.push([c, STATE_NAMES[k] + (k === S_SOWN ? ' (zralost ' + Math.round(f.prog * 100) + ' %)' : '')]); });
    parts.sort((a, b) => b[0] - a[0]);
    setHTML(ui.vField, 'fl', '<b>Pole ' + f.id + '</b>' + (f.owned ? '' : ' · cizí') + ' · ' +
      parts.slice(0, 2).map(p => Math.max(1, Math.round((p[0] / f.n) * 100)) + ' % ' + p[1]).join(', '));
  }

  const pr = [];
  if (v.type === 'combine' && inSell(v) && v.tank.amount > 0) {
    pr.push(['F', v.unloading ? 'Zastavit vykládku' : 'Prodat ' + fmt(v.tank.amount) + ' l ' + CROPS[v.tank.crop].gen + ' za ' + fmt(v.tank.amount * price(v.tank.crop, G.gameMin)) + ' Kč']);
  }
  if (v.type === 'tractor' && inShed(v)) pr.push(['F', 'Vyměnit za ' + IMPL[otherImpl()].name.toLowerCase()]);
  const s = nearSign(v);
  if (s) pr.push(['F', 'Koupit pole ' + s.f.id + ' za ' + fmt(s.f.price) + ' Kč']);
  if (f && f.owned && !v.lowered) pr.push(['Mezerník', 'Spustit ' + (v.type === 'tractor' ? IMPL[v.impl].name.toLowerCase() : 'žací lištu')]);
  if (f && f.owned && v.lowered && Math.abs(v.speed) < 0.3) pr.push(['W', 'Jeď, nářadí pracuje jen v pohybu']);
  if (v.type === 'combine' && v.tank.amount >= v.tank.cap - 10 && !inSell(v)) pr.push(['', 'Zásobník je plný']);
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
  setHTML(ui.prices, 'prices', h);
}
