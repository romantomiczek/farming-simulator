import { fmt } from '../core/util.js';
import { G } from '../game/state.js';
import { CATALOG, sellValue, leaseUpfront, leaseDaily, blockReason, buy, lease, release, dailyLeaseCost } from '../game/machines.js';
import { takeLoan, repayLoan, dailyInterest, emergencyFuel, LOAN_MAX, LOAN_STEP, INTEREST_DAILY, EMERGENCY } from '../game/economy.js';
import { CTYPES, accept, cancelActive, canDo, needsLabel, progress } from '../game/contracts.js';
import { CROPS } from '../game/crops.js';
import { toast } from './toast.js';

// The farm office (K): machine shop, neighbour contracts and finances. Time stops while it is open.
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
  }
  if (ok) h.onChange();
  render();
}

function render() {
  for (const b of tabs.children) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  $('officeMoney').textContent = fmt(G.money) + ' Kč';
  body.innerHTML = tab === 'shop' ? shopHTML() : tab === 'jobs' ? jobsHTML() : finHTML();
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
          btn('lease', c.key, 'Pronajmout · ' + fmt(leaseUpfront(c.key)) + ' Kč + ' + fmt(leaseDaily(c.key)) + ' Kč/den', G.money < leaseUpfront(c.key), 'ghost');
      } else if (!c.fixed) {
        const why = blockReason(c.key);
        actions = st === 'own' ? btn('sell', c.key, 'Prodat · ' + fmt(sellValue(c.key)) + ' Kč', !!why, 'ghost') : btn('return', c.key, 'Vrátit', !!why, 'ghost');
        if (why) note = `<p class="why">${why}</p>`;
      }
      out += `<div class="row"><div class="rmain"><b>${c.name}</b><span>${c.desc}</span>${note}</div>
        <div class="rstate">${chip}${st ? `<span class="muted">stav ${pct(G.cond[c.key] ?? 1)}</span>` : ''}</div>
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
