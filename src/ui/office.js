import { fmt } from '../core/util.js';
import { G } from '../game/state.js';
import {
  has, hasCondition, CATALOG, byKey, sellValue, leaseUpfront, leaseDaily, blockReason, buy, lease, release, dailyLeaseCost, status, condOf,
  isMachine, piecesOf, sellValueOf, blockReasonOf, releasePiece,
} from '../game/machines.js';
import { takeLoan, repayLoan, dailyInterest, emergencyFuel, LOAN_MAX, LOAN_STEP, INTEREST_DAILY, EMERGENCY } from '../game/economy.js';
import { CTYPES, accept, cancelActive, canDo, needsLabel, progress } from '../game/contracts.js';
import { CROPS } from '../game/crops.js';
import { BUILDINGS, GREENHOUSE, daysLeft, greenhouses, waterCap, eatsText, mixShares, mixOk } from '../game/farm.js';
import { COWS, MIXER } from '../game/balance.js';
import { trees, matureCount } from '../world/forest.js';
import { vehicles, tools, IMPL_ORDER, VEHICLE_TYPES, labelOf } from '../vehicles/vehicles.js';
import { PAD, PARK, inRect } from '../world/layout.js';
import { MARKETS } from '../game/markets.js';
import { fieldAt } from '../world/fields.js';
import { cam } from '../render/camera.js';
import { WAGE, canHire, sendHelper, dismiss, helperStatus, jobName } from '../game/helpers.js';
import { toast } from './toast.js';
import { GOALS, activeGoals, isDone, progressOf, progressText } from '../game/goals.js';
import { FIELDS } from '../world/fields.js';
import { S_STUB, S_CULT, S_SOWN, S_RIPE } from '../game/crops.js';
import { buyField } from '../game/actions.js';

// The farm office (K): machine shop, the fleet, neighbour contracts, the farm and its fields, goals and finances.
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
    case 'buy': ok = buy(key); if (ok) toast('Koupeno: ' + byKey[key].name + (isMachine(key) ? ' · ' + parkedAt(key) : ''), 'good'); break;
    case 'lease': ok = lease(key); if (ok) toast('Pronajato: ' + byKey[key].name + (isMachine(key) ? ' · ' + parkedAt(key) : ''), 'good'); break;
    case 'drive': {
      const v = vehicles.find(x => x.id === key);
      if (v && !v.helper) { G.active = v; cam.manual = -99; toast('Sedíš v: ' + labelOf(v)); closeOffice(); return; }
      break;
    }
    case 'sellp': {
      const pc = [...vehicles, ...tools].find(x => x.id === key);
      if (!pc) break;
      const name = labelOf(pc), value = sellValueOf(pc), was = pc.own;
      ok = releasePiece(pc);
      if (ok) toast(was === 'own' ? 'Prodáno: ' + name + ' za ' + fmt(value) + ' Kč' : 'Vráceno z pronájmu: ' + name, 'good');
      break;
    }
    case 'sell': case 'return': {
      const name = CATALOG.find(c => c.key === key).name, value = sellValue(key), was = status(key);
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
    case 'send': {
      const v = vehicles.find(x => x.id === key), val = $('hsel-' + key)?.value;
      ok = !!v && !!val && sendHelper(v, val === 'wood' ? null : FIELDS.find(f => f.id === +val));
      break;
    }
    case 'fire': { const v = vehicles.find(x => x.id === key); if (v?.helper) dismiss(v); break; }
  }
  if (ok) h.onChange();
  render();
}

function render() {
  for (const b of tabs.children) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  $('officeMoney').textContent = fmt(G.money) + ' Kč';
  body.innerHTML = tab === 'shop' ? shopHTML() : tab === 'fleet' ? fleetHTML() : tab === 'jobs' ? jobsHTML() : tab === 'farm' ? farmHTML() : tab === 'goals' ? goalsHTML() : finHTML();
}

/** Where the newest piece of key waits (for the purchase message). */
function parkedAt(key) {
  const ps = piecesOf(key), p = ps[ps.length - 1];
  if (!p) return '';
  if (p.on) return 'připojený k: ' + labelOf(p.on);
  return p.slot >= 0 ? 'stojí na odstavné ploše jižně od dvora' : 'stojí na dvoře u kůlny';
}

function shopHTML() {
  let out = '<p class="lede small">Strojů a nářadí můžeš mít kolik chceš, i víc kusů stejného druhu. Další kusy parkují na odstavné ploše jižně od dvora. Prodej a vrácení jednotlivých kusů najdeš v záložce Vozový park.</p>';
  for (const kind of [...new Set(CATALOG.map(c => c.kind))]) {
    out += `<h3 class="grp">${kind}</h3>`;
    for (const c of CATALOG.filter(x => x.kind === kind)) {
      if (isMachine(c.key)) { out += machineRow(c); continue; }
      const st = status(c.key);
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
        <div class="rstate">${chip}${st && hasCondition(c) ? `<span class="muted">stav ${pct(condOf(c.key))}</span>` : ''}</div>
        <div class="ract">${actions}</div></div>`;
    }
  }
  return out;
}

/** A machine or implement in the shop: how many you have, buy or lease one more. */
function machineRow(c) {
  const ps = piecesOf(c.key), own = ps.filter(p => p.own === 'own').length, leased = ps.length - own;
  const chips = [own ? `<span class="chip on">Vlastníš ${own}</span>` : '', leased ? `<span class="chip warn">Pronájem ${leased} · ${fmt(leaseDaily(c.key) * leased)} Kč/den</span>` : ''].join('') || '<span class="chip">Nevlastníš</span>';
  const more = ps.length ? ' další' : '';
  const actions = btn('buy', c.key, 'Koupit' + more + ' · ' + fmt(c.price) + ' Kč', G.money < c.price) +
    (c.noLease ? '' : btn('lease', c.key, 'Pronajmout' + more + ' · ' + fmt(leaseUpfront(c.key)) + ' Kč + ' + fmt(leaseDaily(c.key)) + ' Kč/den', G.money < leaseUpfront(c.key), 'ghost'));
  return `<div class="row"><div class="rmain"><b>${c.name}</b><span>${c.desc}</span></div>
    <div class="rstate">${chips}</div><div class="ract">${actions}</div></div>`;
}

/* ---------- fleet ---------- */
const posOf = p => (p.type ? p : p.on ? p.on : p.key === 'trailer' ? p : { x: p.group.position.x, z: p.group.position.z });
/** Where piece p is: a field, the yard, the machine park, a buyer, or out in the country. */
function whereText(p) {
  const { x, z } = posOf(p), f = fieldAt(x, z);
  if (f) return (f.meadow ? 'louka ' : 'pole ') + f.id;
  if (inRect(x, z, PAD, 4)) return 'na dvoře';
  if (x > PARK.x0 - 2 && z > PARK.z0 - 2 && z < PARK.z1 + 2 && x < PARK.x0 + 200) return 'odstavná plocha';
  const m = MARKETS.find(k => Math.hypot(x - k.x, z - k.z) < 25);
  return m ? 'u výkupu ' + m.short : 'v terénu';
}
/** What piece p is doing or carrying right now. */
function doingText(p) {
  const out = [];
  if (p === G.active) out.push('řídíš');
  if (p.helper) out.push('pomocník: ' + helperStatus(p));
  if (p.type === 'tractor') out.push(p.tool ? 'nářadí: ' + labelOf(p.tool).toLowerCase() : 'bez nářadí');
  if (p.on) out.push('na traktoru ' + labelOf(p.on));
  if (p.harvester && p.tank.amount > 0) out.push('zásobník ' + fmt(p.tank.amount) + ' l ' + CROPS[p.tank.crop].gen);
  if (p.logs > 0) out.push('dřevo ' + String(p.logs.toFixed(1)).replace('.', ',') + ' m³');
  if (p.key === 'trailer' && p.tank.amount > 0) out.push(fmt(p.tank.amount) + ' l ' + CROPS[p.tank.crop].gen);
  if (p.key === 'trailer' && p.bales) out.push(p.bales + ' balíků');
  if (p.key === 'watertank' && p.water > 0) out.push(fmt(p.water) + ' l ' + (p.milk ? 'mléka' : 'vody'));
  return out.join(' · ');
}
function fleetHTML() {
  const all = [...vehicles, ...tools], value = all.reduce((a, p) => a + (p.own === 'own' ? sellValueOf(p) : 0), 0);
  let out = `<p class="lede small">Všechny stroje a nářadí. Přesednout můžeš i odsud, nebo klávesou Tab (stroje v okolí) a Shift+Tab (všechny). Opravuje se v kůlně (R).</p>
    <div class="stats"><div><span>Strojů</span><b>${vehicles.length}</b></div><div><span>Nářadí a přívěsů</span><b>${tools.length}</b></div>
    <div><span>Hodnota při prodeji</span><b>${fmt(value)} Kč</b></div><div><span>Pronájmy za den</span><b>${fmt(dailyLeaseCost())} Kč</b></div></div>`;
  const row = p => {
    const why = blockReasonOf(p), key = p.type || p.key, lease = p.own === 'lease';
    const chips = (lease ? `<span class="chip warn">Pronájem · ${fmt(leaseDaily(key))} Kč/den</span>` : '<span class="chip on">Vlastníš</span>') +
      `<span class="muted">stav ${pct(p.cond)}${p.type ? ' · nafta ' + Math.round((p.fuel / p.fuelCap) * 100) + ' %' : ''}</span>`;
    const acts = (p.type ? btn('drive', p.id, 'Přesednout', p === G.active || !!p.helper) : '') +
      btn('sellp', p.id, lease ? 'Vrátit' : 'Prodat · ' + fmt(sellValueOf(p)) + ' Kč', !!why, 'ghost');
    return `<div class="row${p === G.active ? ' active' : ''}"><div class="rmain"><b>${labelOf(p)}</b><span>${whereText(p)}${doingText(p) ? ' · ' + doingText(p) : ''}</span>${why && why !== 'Právě v něm sedíš.' ? `<p class="why">${why}</p>` : ''}</div>
      <div class="rstate">${chips}</div><div class="ract">${acts}</div></div>`;
  };
  out += '<h3 class="grp">Stroje</h3>';
  for (const type of VEHICLE_TYPES) for (const v of vehicles.filter(x => x.type === type)) out += row(v);
  out += '<h3 class="grp">Nářadí a přívěsy</h3>';
  if (!tools.length) out += '<p class="empty">Nemáš žádné nářadí. Koupíš ho v Obchodě.</p>';
  for (const key of IMPL_ORDER) for (const t of tools.filter(x => x.key === key)) out += row(t);
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
  let out = '<p class="lede small">Mléko, vejce, vlna, vepřové a rajčata se odvážejí a platí o půlnoci. Krmivo vyložíš klávesou F ve sklízeči nebo přívěsem v kruhu u budovy (krávy a ovce berou i balíky sena), vodu přivezeš cisternou z rybníka. Mléko můžeš cisternou odvézt do mlékárny v městečku za ' + COWS.dairyPrice + ' Kč/l místo ' + COWS.milkPrice + '.</p>';
  out += helpersHTML();
  out += fieldsHTML();
  out += '<h3 class="grp">Budovy a les</h3>';
  for (const key in BUILDINGS) {
    const b = BUILDINGS[key];
    if (!has(key)) { out += row(b.name, 'Koupíš v Obchodě.', '<span class="chip">Nevlastníš</span>'); continue; }
    const more = key === 'cows' && mixOk() ? 1 + MIXER.bonus : 1;
    let extra = '<span class="muted">Na odvoz: ' + fmt(F[b.out]) + ' ' + b.unit + ' · ' + fmt(b.make * more * 24) + ' ' + b.unit + ' denně po ' + b.price + ' Kč</span>';
    if (key === 'cows' && has('mixer')) {
      const sh = mixShares(), p = x => Math.round(x * 100) + ' %';
      extra += '<span class="muted">Krmná směs: zrno ' + p(sh.grain) + ' · seno ' + p(sh.hay) + ' · cukrovka ' + p(sh.beet)
        + (mixOk() ? ' · vyvážená, +' + Math.round(MIXER.bonus * 100) + ' % mléka' : ' · pro víc mléka potřebuje každé aspoň ' + Math.round(MIXER.minShare * 100) + ' %') + '</span>';
    }
    out += row(b.name, 'Krmivo ' + fmt(F[b.store]) + ' / ' + fmt(b.cap) + ' l (' + eatsText(key) + ') · vystačí ' + days(daysLeft(key)),
      F.hungry[key] ? '<span class="chip warn">Hladoví</span>' : '<span class="chip on">V pořádku</span>', extra);
  }
  const n = greenhouses();
  out += n
    ? row('Skleníky (' + n + ')', 'Voda ' + fmt(F.water) + ' / ' + fmt(waterCap()) + ' l · vystačí ' + days(daysLeft('water')),
      F.dry ? '<span class="chip warn">Bez vody</span>' : '<span class="chip on">V pořádku</span>',
      '<span class="muted">Na odvoz: ' + fmt(F.tomatoes) + ' kg rajčat · ' + fmt(GREENHOUSE.make * 24 * n) + ' kg denně po ' + GREENHOUSE.price + ' Kč</span>')
    : row('Skleníky', 'Koupíš v Obchodě.', '<span class="chip">Nevlastníš</span>');
  out += row('Les na severu', matureCount() + ' z ' + trees.length + ' stromů je vzrostlých' + (has('forest') ? ' · v harvestoru ' + String(vehicles.reduce((a, v) => a + (v.logs || 0), 0).toFixed(1)).replace('.', ',') + ' m³' : ''),
    has('forest') ? '<span class="chip on">Harvestor</span>' : '<span class="chip">Bez harvestoru</span>');
  return out;
}

const ha = m2 => String((m2 / 10000).toFixed(2)).replace('.', ',') + ' ha';

/** Every field: size, what is on it and, for the neighbours' fields, the price. */
/** Machines a helper can drive: send one to a field or the forest, or let a working one go. */
function helpersHTML() {
  let out = '<h3 class="grp">Pomocníci</h3><p class="lede small">Pošli stroj s pomocníkem na pole nebo do lesa. Dojede po silnicích, plný zásobník odveze na nejlepší výkup a po práci se vrátí na dvůr. Mzda ' + fmt(WAGE) + ' Kč za herní hodinu, platí se i cesta.</p>';
  for (const v of vehicles.filter(x => x.type !== 'jeep')) {
    const name = v.name + (v.type === 'tractor' ? ' · ' + (v.tool ? v.tool.name.toLowerCase() : 'bez nářadí') : '');
    if (v.helper) {
      out += `<div class="row"><div class="rmain"><b>${name}</b><span>${helperStatus(v)} · mzda ${fmt(v.helper.wage)} Kč</span></div>
        <div class="rstate">${btn('fire', v.id, 'Propustit', false, 'ghost')}</div></div>`;
      continue;
    }
    const opts = v.type === 'forest'
      ? (canHire(v).wood ? [['wood', 'Les: těžba vzrostlých stromů']] : [])
      : FIELDS.filter(f => !canHire(v, f).why).map(f => [f.id, (f.meadow ? 'Louka ' : 'Pole ') + f.id + (f.owned ? '' : ' (zakázka)') + ' · ' + jobName(v)]);
    const why = opts.length ? '' : (canHire(v, v.type === 'forest' ? null : FIELDS.find(f => f.owned)).why || 'Teď s ním není kde pracovat.');
    out += `<div class="row"><div class="rmain"><b>${name}</b>${why ? `<span>${why}</span>`
      : `<label class="hselect"><span class="sr">Kam</span><select id="hsel-${v.id}">${opts.map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select></label>`}</div>
      <div class="rstate">${btn('send', v.id, 'Poslat', !opts.length)}</div></div>`;
  }
  return out;
}

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
  const leased = CATALOG.filter(c => status(c.key) === 'lease');
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
