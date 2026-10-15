import { fmt } from '../core/util.js';
import { G } from '../game/state.js';
import { has, hasCondition, CATALOG, sellValue, leaseUpfront, leaseDaily, blockReason, buy, lease, release, dailyLeaseCost } from '../game/machines.js';
import { takeLoan, repayLoan, dailyInterest, emergencyFuel, LOAN_MAX, LOAN_STEP, INTEREST_DAILY, EMERGENCY } from '../game/economy.js';
import { CTYPES, accept, cancelActive, canDo, needsLabel, progress } from '../game/contracts.js';
import { CROPS } from '../game/crops.js';
import { BUILDINGS, GREENHOUSE, daysLeft, greenhouses, waterCap } from '../game/farm.js';
import { trees, matureCount } from '../world/forest.js';
import { forester } from '../vehicles/vehicles.js';
import { toast } from './toast.js';
import { GOALS, activeGoals, isDone, progressOf, progressText } from '../game/goals.js';
import { FIELDS } from '../world/fields.js';
import { S_STUB, S_CULT, S_SOWN, S_RIPE } from '../game/crops.js';
import { buyField } from '../game/actions.js';

// The farm office (K): machine shop, neighbour contracts, the farm and its fields, goals and finances.
// Time stops while it is open.
const $ = id => document.getElementById(id);
const box = $('office'), body = $('officeBody'), tabs = $('officeTabs');
let tab = 'shop', h = null;

export const officeOpen = () => !box.hidden;
const pct = x => Math.round(x * 100) + ' %';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const btn = (act, key, label, disabled, cls = '') =>
  `<button class="btn small ${cls}" data-act="${act}" data-key="${esc(key)}"${disabled ? ' disabled' : ''}>${label}</button>`;

/** handlers = { onOpen, onClose, onChange } */
export function initOffice(handlers) {
  h = handlers;
  tabs.onclick = e => { const t = e.target.closest('[data-tab]')?.dataset.tab; if (t) { tab = t; render(); } };
  $('officeClose').onclick = closeOffice;
  body.onclick = e => {
    const b = e.target.closest('button[data-act]');
    if (!b || b.disabled) return;
    act(b.dataset.act, b.dataset.key);
  };
}

export function openOffice(t) {
  if (t) tab = t;
  box.hidden = false;
  render();
  h.onOpen();
  tabs.querySelector('[aria-selected="true"]')?.focus();
}
export function closeOffice() {
  box.hidden = true;
  h.onClose();
}

function act(a, key) {
  let ok = true;
  switch (a) {
    case 'buy': ok = buy(key); if (ok) toast('Koupeno: ' + CATALOG.find(c => c.key === key).name, 'good'); break;
    case 'lease': ok = lease(key); if (ok) toast('Pronajato: ' + CATALOG.find(c => c.key === key).name, 'good'); break;
    case 'sell': case 'return': {
      const name = CATALOG.find(c => c.key === key).name, value = sellValue(key), was = G.machines[key];
      ok = release(key);
      if (ok) toast(was === 'own' ? 'Prodáno: ' + name + ' za ' + fmt(value) + ' Kč' : 'Vráceno z pronájmu: ' + name, 'good');
      break;
    }
    case 'accept': ok = accept(key); break;
    case 'cancel': cancelActive(); break;
    case 'loan': takeLoan(); break;
    case 'repay': repayLoan(); break;
    case 'fuel': ok = emergencyFuel(); break;
    case 'field': ok = buyField(FIELDS.find(f => f.id === +key)); break;
  }
  if (ok) h.onChange();
  render();
}

function render() {
  for (const b of tabs.children) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  $('officeMoney').textContent = fmt(G.money) + ' Kč';
  body.innerHTML = tab === 'shop' ? shopHTML() : tab === 'jobs' ? jobsHTML() : tab === 'farm' ? farmHTML() : tab === 'goals' ? goalsHTML() : finHTML();
}

function shopHTML() {
  let out = '';
  for (const kind of [...new Set(CATALOG.map(c => c.kind))]) {
    out += `<h3 class="grp">${kind}</h3>`;
    for (const c of CATALOG.filter(x => x.kind === kind)) {
      const st = G.machines[c.key];
      const chip = st === 'own' ? '<span class="chip on">Vlastníš</span>'
        : st === 'lease' ? `<span class="chip warn">Pronájem · ${fmt(leaseDaily(c.key))} Kč/den</span>`
        : '<span class="chip">Nevlastníš</span>';
      let actions = '', note = '';
      if (!st) {
        actions = btn('buy', c.key, 'Koupit · ' + fmt(c.price) + ' Kč', G.money < c.price) +
          (c.noLease ? '' : btn('lease', c.key, 'Pronajmout · ' + fmt(leaseUpfront(c.key)) + ' Kč + ' + fmt(leaseDaily(c.key)) + ' Kč/den', G.money < leaseUpfront(c.key), 'ghost'));
      } else if (!c.fixed) {
        const why = blockReason(c.key);
        actions = st === 'own' ? btn('sell', c.key, 'Prodat · ' + fmt(sellValue(c.key)) + ' Kč', !!why, 'ghost') : btn('return', c.key, 'Vrátit', !!why, 'ghost');
        if (why) note = `<p class="why">${why}</p>`;
      }
      out += `<div class="row"><div class="rmain"><b>${c.name}</b><span>${c.desc}</span>${note}</div>
        <div class="rstate">${chip}${st && hasCondition(c) ? `<span class="muted">stav ${pct(G.cond[c.key] ?? 1)}</span>` : ''}</div>
        <div class="ract">${actions}</div></div>`;
    }
  }
  return out;
}

function jobLine(c) {
  const crop = c.crop >= 0 ? CROPS[c.crop].name + ' · ' : '';
  return `${crop}${fmt(c.target)} m² · potřebuješ ${needsLabel(c)}`;
}

function jobsHTML() {
  const a = G.contracts.active;
  let out = '<p class="lede small">Sousedovi obděláš pole, která ti nepatří, dokud je nekoupíš. Osivo a hnojivo dodá on, úrodu si odveze sám. Odměnu dostaneš, když dokončíš 90 % práce do dvou dnů.</p>';
  if (a) {
    const left = Math.max(0, a.deadline - G.gameMin);
    out += `<div class="row active"><div class="rmain"><b>${CTYPES[a.type].name} · pole ${a.field}</b><span>${jobLine(a)}</span>
      <div class="bar"><i style="width:${(progress(a) * 100).toFixed(1)}%"></i></div>
      <span class="muted">Hotovo ${pct(progress(a))} · zbývá ${Math.floor(left / 60)} h ${Math.floor(left % 60)} min</span></div>
      <div class="rstate"><span class="chip on">Rozpracováno</span><b>${fmt(a.reward)} Kč</b></div>
      <div class="ract">${btn('cancel', '', 'Zrušit zakázku', false, 'ghost')}</div></div>`;
  }
  if (!G.contracts.offers.length) out += '<p class="empty">Sousedé teď nic nepotřebují. Nové zakázky přicházejí s každým novým dnem.</p>';
  for (const o of G.contracts.offers) {
    const can = canDo(o);
    out += `<div class="row"><div class="rmain"><b>${CTYPES[o.type].name} · pole ${o.field}</b><span>${jobLine(o)}</span>
      ${can ? '' : '<p class="why">Ten stroj nemáš. Koupíš nebo pronajmeš ho v Obchodě.</p>'}</div>
      <div class="rstate"><b>${fmt(o.reward)} Kč</b></div>
      <div class="ract">${btn('accept', o.id, 'Přijmout', !!a || !can)}</div></div>`;
  }
  return out;
}

const days = d => (d === Infinity ? '—' : d >= 10 ? 'víc než 10 dní' : String(d.toFixed(1)).replace('.', ',') + ' dne');

function farmHTML() {
  const F = G.farm, row = (title, sub, state, extra = '') =>
    `<div class="row"><div class="rmain"><b>${title}</b><span>${sub}</span>${extra}</div><div class="rstate">${state}</div></div>`;
  let out = '<p class="lede small">Mléko, vejce a rajčata se odvážejí a platí o půlnoci. Krmivo vyložíš klávesou F ve sklízeči nebo přívěsem v kruhu u budovy, vodu přivezeš cisternou z rybníka.</p>';
  out += fieldsHTML();
  out += '<h3 class="grp">Budovy a les</h3>';
  for (const key of ['cows', 'hens']) {
    const b = BUILDINGS[key];
    if (!has(key)) { out += row(b.name, 'Koupíš v Obchodě.', '<span class="chip">Nevlastníš</span>'); continue; }
    const eats = b.eats.map(i => CROPS[i].name.toLowerCase()).join(', ');
    out += row(b.name, 'Krmivo ' + fmt(F[b.store]) + ' / ' + fmt(b.cap) + ' l (' + eats + ') · vystačí ' + days(daysLeft(key)),
      F.hungry[key] ? '<span class="chip warn">Hladoví</span>' : '<span class="chip on">V pořádku</span>',
      '<span class="muted">Na odvoz: ' + fmt(F[b.out]) + ' ' + b.unit + ' · ' + fmt(b.make * 24) + ' ' + b.unit + ' denně po ' + b.price + ' Kč</span>');
  }
  const n = greenhouses();
  out += n
    ? row('Skleníky (' + n + ')', 'Voda ' + fmt(F.water) + ' / ' + fmt(waterCap()) + ' l · vystačí ' + days(daysLeft('water')),
      F.dry ? '<span class="chip warn">Bez vody</span>' : '<span class="chip on">V pořádku</span>',
      '<span class="muted">Na odvoz: ' + fmt(F.tomatoes) + ' kg rajčat · ' + fmt(GREENHOUSE.make * 24 * n) + ' kg denně po ' + GREENHOUSE.price + ' Kč</span>')
    : row('Skleníky', 'Koupíš v Obchodě.', '<span class="chip">Nevlastníš</span>');
  out += row('Les na severu', matureCount() + ' z ' + trees.length + ' stromů je vzrostlých' + (has('forest') ? ' · v harvestoru ' + String(forester.logs.toFixed(1)).replace('.', ',') + ' m³' : ''),
    has('forest') ? '<span class="chip on">Harvestor</span>' : '<span class="chip">Bez harvestoru</span>');
  return out;
}

const ha = m2 => String((m2 / 10000).toFixed(2)).replace('.', ',') + ' ha';

/** Every field: size, what is on it and, for the neighbours' fields, the price. */
function fieldsHTML() {
  let out = '<h3 class="grp">Pozemky</h3>';
  for (const f of FIELDS) {
    const parts = (f.meadow ? [[S_RIPE, 'k posečení'], [S_STUB, 'dorůstá']] : [[S_RIPE, 'zralé'], [S_SOWN, 'oseto'], [S_CULT, 'připraveno'], [S_STUB, 'strniště']])
      .filter(([k]) => f.cnt[k] / f.area >= 0.05).map(([k, name]) => name + ' ' + pct(f.cnt[k] / f.area));
    const state = f.owned ? '<span class="chip on">Tvoje</span>' : '<span class="chip">Soused</span>';
    const buyBtn = f.owned ? '' : `<div class="ract">${btn('field', f.id, 'Koupit · ' + fmt(f.price) + ' Kč', G.money < f.price)}</div>`;
    out += `<div class="row"><div class="rmain"><b>${f.meadow ? 'Louka' : 'Pole'} ${f.id} · ${ha(f.area)}${f.q !== 1 ? ' · půda ' + Math.round(f.q * 100) + ' %' : ''}</b><span>${parts.join(' · ') || '—'}</span></div><div class="rstate">${state}</div>${buyBtn}</div>`;
  }
  return out;
}

/** Active goals with progress, what comes next, finished ones and the farm's statistics. */
function goalsHTML() {
  const S = G.stats, act = activeGoals(), next = GOALS.filter(g => !isDone(g) && !act.includes(g)).slice(0, 3);
  let out = '<p class="lede small">Za každý splněný cíl dostaneš odměnu. Aktivní jsou vždy tři, po splnění se odemkne další.</p>';
  out += '<h3 class="grp">Aktivní cíle</h3>';
  out += act.map(g => `<div class="row active"><div class="rmain"><b>${g.title}</b><span>${g.desc}</span>
      <div class="bar"><i style="width:${(progressOf(g) * 100).toFixed(1)}%"></i></div><span class="muted">${progressText(g)}</span></div>
      <div class="rstate"><span class="chip warn">${fmt(g.reward)} Kč</span></div></div>`).join('') || '<p class="lede small">Všechny cíle jsou splněné. Gratuluju!</p>';
  if (next.length) out += '<h3 class="grp">Další na řadě</h3>' + next.map(g => `<div class="row slim"><div class="rmain"><b>${g.title}</b><span class="muted">${g.desc}</span></div><div class="rstate"><span class="muted">${fmt(g.reward)} Kč</span></div></div>`).join('');
  const done = GOALS.filter(isDone);
  if (done.length) out += '<h3 class="grp">Splněno (' + done.length + ' z ' + GOALS.length + ')</h3>' + done.map(g => `<div class="row slim"><div class="rmain"><b>${g.title}</b></div><div class="rstate"><span class="chip on">Hotovo</span></div></div>`).join('');
  const crops = CROPS.map((c, i) => [c.name, S.harvest[i]]).filter(([, n]) => n > 0);
  out += `<h3 class="grp">Statistiky</h3><div class="stats">
      <div><span>Vyděláno prodejem</span><b>${fmt(S.earned)} Kč</b></div>
      <div><span>Sklizeno celkem</span><b>${fmt(S.harvest.reduce((a, b) => a + b, 0))} l</b></div>
      <div><span>Zkultivováno a zoráno</span><b>${ha(S.cult + S.plough)}</b></div>
      <div><span>Oseto</span><b>${ha(S.sown)}</b></div>
      <div><span>Pohnojeno</span><b>${ha(S.fert)}</b></div>
      <div><span>Balíky slámy</span><b>${fmt(S.bales)}</b></div>
      <div><span>Balíky sena</span><b>${fmt(S.hay)}</b></div>
      <div><span>Pokácené stromy</span><b>${fmt(S.trees)}</b></div>
      <div><span>Zakázky</span><b>${fmt(S.contracts)}</b></div>
    </div>`;
  if (crops.length) out += '<div class="stats">' + crops.map(([n, l]) => `<div><span>${n}</span><b>${fmt(l)} l</b></div>`).join('') + '</div>';
  return out;
}

function finHTML() {
  const v = G.active;
  const leased = CATALOG.filter(c => G.machines[c.key] === 'lease');
  return `<div class="stats">
      <div><span>Peníze</span><b class="${G.money < 0 ? 'down' : ''}">${fmt(G.money)} Kč</b></div>
      <div><span>Úvěr</span><b>${fmt(G.loan)} Kč</b></div>
      <div><span>Úroky za den</span><b>${fmt(dailyInterest())} Kč</b></div>
      <div><span>Leasing za den</span><b>${fmt(dailyLeaseCost())} Kč</b></div>
    </div>
    <h3 class="grp">Úvěr</h3>
    <p class="lede small">Banka půjčí až ${fmt(LOAN_MAX)} Kč po ${fmt(LOAN_STEP)} Kč s úrokem ${String(INTEREST_DAILY * 100).replace('.', ',')} % denně. Úroky a leasing se strhávají o půlnoci.</p>
    <div class="actions">${btn('loan', '', 'Půjčit ' + fmt(LOAN_STEP) + ' Kč', G.loan + LOAN_STEP > LOAN_MAX)}${btn('repay', '', 'Splatit ' + fmt(Math.min(LOAN_STEP, G.loan)) + ' Kč', G.loan <= 0 || G.money < Math.min(LOAN_STEP, G.loan), 'ghost')}</div>
    <h3 class="grp">Nafta</h3>
    <p class="lede small">Natankovat můžeš u čerpací stanice vedle kůlny (červený kruh, klávesa F) za 36 Kč/l. Když nafta dojde v poli, dovezeme ${EMERGENCY.liters} l do stroje, ve kterém sedíš.</p>
    <div class="actions">${btn('fuel', '', 'Dovézt ' + EMERGENCY.liters + ' l do stroje ' + v.name + ' · ' + fmt(EMERGENCY.price) + ' Kč', G.money < EMERGENCY.price || v.fuel >= v.fuelCap - 1, 'ghost')}</div>
    ${leased.length ? '<h3 class="grp">Pronajaté stroje</h3>' + leased.map(c => `<div class="row slim"><div class="rmain"><b>${c.name}</b></div><div class="rstate"><span class="muted">${fmt(leaseDaily(c.key))} Kč/den</span></div></div>`).join('') : ''}`;
}
