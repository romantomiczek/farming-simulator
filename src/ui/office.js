import { fmt } from '../core/util.js';
import { seat } from '../world/person.js';
import { G } from '../game/state.js';
import {
  has, hasCondition, CATALOG, byKey, sellValue, leaseUpfront, leaseDaily, blockReason, buy, lease, release, dailyLeaseCost, status, condOf,
  isMachine, piecesOf, sellValueOf, blockReasonOf, releasePiece, tradeBlock, buyWithTrade,
} from '../game/machines.js';
import { takeLoan, repayLoan, dailyInterest, emergencyFuel, LOAN_MAX, LOAN_STEP, INTEREST_DAILY, EMERGENCY } from '../game/economy.js';
import { CTYPES, accept, cancelActive, canDo, needsLabel, progress } from '../game/contracts.js';
import { neighbourOf, neighbourJobs } from '../world/neighbours.js';
import { CROPS } from '../game/crops.js';
import { BUILDINGS, GREENHOUSE, daysLeft, greenhouses, waterCap, eatsText, mixShares, mixOk } from '../game/farm.js';
import { COWS, MIXER } from '../game/balance.js';
import { trees, matureCount } from '../world/forest.js';
import { vehicles, tools, IMPL_ORDER, VEHICLE_TYPES, labelOf, powerShare, MIN_POWER } from '../vehicles/vehicles.js';
import { MODEL, MODELS, modelName } from '../game/catalog.js';
import { thumbURL, setThumbHandler, setViewer } from '../render/previews.js';
import { PAD, PARK, inRect } from '../world/layout.js';
import { MARKETS, accepts, marketPrice, bestMarket } from '../game/markets.js';
import { SILO_CAP, siloTotal, deliveryMarket, deliveryPrice, acceptDelivery, canAcceptDelivery } from '../game/silo.js';
import { fmt2, plural } from '../core/util.js';
import { fieldAt } from '../world/fields.js';
import { cam } from '../render/camera.js';
import { WAGE, canHire, sendHelper, dismiss, helperStatus, jobName, helperTools, busyHelper } from '../game/helpers.js';
import { toast } from './toast.js';
import { GOALS, activeGoals, isDone, progressOf, progressText } from '../game/goals.js';
import { FIELDS } from '../world/fields.js';
import { S_STUB, S_CULT, S_SOWN, S_RIPE } from '../game/crops.js';
import { buyField } from '../game/actions.js';
import { fieldYield, WITHER_H, LIME_DUE } from '../game/agro.js';
import { herd, herdName, PALLETS, palletsReady } from '../game/animals.js';
import { HERD, DUNG, PALLET, SILAGE } from '../game/balance.js';
import { bunkerState } from '../game/forage.js';
import { SEASONS, seasonIdx } from '../game/weather.js';
import { dayOf } from '../game/state.js';

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
  // choosing a tractor's implement for a helper changes which fields are offered
  body.onchange = e => {
    const t = e.target;
    if (t.dataset.tool) picks[t.dataset.tool] = t.value;
    else if (t.dataset.trade) shop.trade = t.value || null;
    else if (t.dataset.filter === 'afford') shop.afford = t.checked;
    else if (t.dataset.filter === 'sort') shop.sort = t.value;
    else return;
    render();
  };
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
  setViewer(null, null);
  h.onClose();
}

function act(a, key) {
  let ok = true;
  switch (a) {
    case 'buy': ok = buy(key); if (ok) toast('Koupeno: ' + byKey[key].name + (isMachine(key) ? ' · ' + parkedAt(key) : ''), 'good'); break;
    case 'lease': ok = lease(key); if (ok) toast('Pronajato: ' + byKey[key].name + (isMachine(key) ? ' · ' + parkedAt(key) : ''), 'good'); break;
    case 'shopgrp': shop.tab = key; shop.sel = null; break;
    case 'model': shop.sel = shop.sel === key ? null : key; shop.trade = null; break;
    case 'unmodel': shop.sel = null; break;
    case 'trade': {
      const old = [...vehicles, ...tools].find(x => x.id === shop.trade), name = old && labelOf(old), value = old && sellValueOf(old);
      ok = buyWithTrade(key, old);
      if (ok) { toast('Koupeno: ' + byKey[key].name + ' · ' + name + ' prodán za ' + fmt(value) + ' Kč', 'good'); shop.trade = null; }
      break;
    }
    case 'drive': {
      const v = vehicles.find(x => x.id === key);
      if (v && !v.helper) { seat(v); cam.manual = -99; toast('Sedíš v: ' + labelOf(v)); closeOffice(); return; }
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
    case 'dlv': ok = acceptDelivery(key); break;
    case 'cancel': cancelActive(); break;
    case 'loan': takeLoan(); break;
    case 'repay': repayLoan(); break;
    case 'fuel': ok = emergencyFuel(); break;
    case 'field': ok = buyField(FIELDS.find(f => f.id === +key)); break;
    case 'send': {
      const v = vehicles.find(x => x.id === key), val = $('hsel-' + key)?.value, im = toolPick(v);
      ok = !!v && !!val && sendHelper(v, val === 'wood' ? null : FIELDS.find(f => f.id === +val), im);
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
  const top = body.scrollTop;
  body.innerHTML = tab === 'shop' ? shopHTML() : tab === 'fleet' ? fleetHTML() : tab === 'jobs' ? jobsHTML() : tab === 'market' ? marketHTML() : tab === 'farm' ? farmHTML() : tab === 'goals' ? goalsHTML() : finHTML();
  body.scrollTop = top;
  // the detail of a model in the shop shows it turning
  const view = body.querySelector('canvas.mview');
  setViewer(view, view ? shop.sel : null);
}

/** Where the newest piece of key waits (for the purchase message). */
function parkedAt(key) {
  const ps = piecesOf(key), p = ps[ps.length - 1];
  if (!p) return '';
  if (p.on) return 'připojený k: ' + labelOf(p.on);
  return p.slot >= 0 ? 'stojí na odstavné ploše jižně od dvora' : 'stojí na dvoře u kůlny';
}

/* ---------- shop ---------- */
/** Shop tabs: machine kinds (one row of cards each, cheapest first) or the buildings. */
const SHOP = [
  { id: 'tractor', name: 'Traktory', kinds: ['tractor'] },
  { id: 'harvest', name: 'Sklízeče', kinds: ['combine', 'beet', 'chopper'], extra: ['cornHeader'] },
  { id: 'tools', name: 'Nářadí', kinds: ['cultivator', 'plough', 'seeder', 'spreader', 'sprayer', 'roller', 'mulcher', 'mower', 'tedder', 'windrower', 'baler', 'wrapper'] },
  { id: 'haul', name: 'Přívěsy a cisterny', kinds: ['trailer', 'watertank', 'livestock', 'manure', 'slurry'] },
  { id: 'forest', name: 'Lesnictví', kinds: ['forest'] },
  { id: 'cars', name: 'Auta', kinds: ['jeep'] },
  { id: 'build', name: 'Budovy' },
];
const KIND_TITLE = {
  tractor: 'Traktory', combine: 'Kombajny', beet: 'Sklízeče cukrovky', cultivator: 'Kultivátory', plough: 'Pluhy', seeder: 'Secí stroje',
  spreader: 'Rozmetadla', manure: 'Rozmetadla hnoje', slurry: 'Cisterny na kejdu', livestock: 'Přívěsy na zvířata', sprayer: 'Postřikovače', roller: 'Válce', mulcher: 'Mulčovače', mower: 'Žací lišty', baler: 'Lisy', trailer: 'Přívěsy', watertank: 'Cisterny', forest: 'Harvestory', jeep: 'Auta',
};
const n1 = x => String(Math.round(x * 10) / 10).replace('.', ',');
/** The numbers a card shows for each kind: [label, value, text, more is better]. */
const STATS = {
  tractor: m => [['Výkon', m.hp, m.hp + ' k', 1], ['Rychlost', m.kmh, m.kmh + ' km/h', 1], ['Nádrž', m.fuel, fmt(m.fuel) + ' l', 1]],
  combine: m => [['Lišta', m.header, n1(m.header) + ' m', 1], ['Zásobník', m.tank, fmt(m.tank) + ' l', 1], ['Vykládání', m.unload, fmt(m.unload) + ' l/s', 1]],
  beet: m => [['Řádky', m.rows, m.rows + '', 1], ['Zásobník', m.tank, fmt(m.tank) + ' l', 1], ['Sklizeň', m.work || 1, Math.round((m.work || 1) * 100) + ' %', 1]],
  forest: m => [['Náklad', m.logs, m.logs + ' m³', 1], ['Kácení', m.cut, Math.round(m.cut * 100) + ' %', 1]],
  jeep: m => [['Rychlost', m.kmh, m.kmh + ' km/h', 1], ['Mimo cesty', m.kmh * m.offroad, Math.round(m.kmh * m.offroad) + ' km/h', 1]],
  baler: m => [['Rychlost', m.speed, Math.round(m.speed * 3.6) + ' km/h', 1], ['Potřebuje', m.hp, m.hp + ' k', 0]],
  trailer: m => [['Objem', m.cap, fmt(m.cap) + ' l', 1], ['Potřebuje', m.hp, m.hp + ' k', 0]],
  watertank: m => [['Objem', m.cap, fmt(m.cap) + ' l', 1], ['Potřebuje', m.hp, m.hp + ' k', 0]],
};
const statsOf = m => (STATS[m.kind] || (x => [['Záběr', x.width, n1(x.width) + ' m', 1], ['Potřebuje', x.hp, x.hp + ' k', 0]]))(m);
const shop = { tab: 'tractor', sel: null, afford: false, sort: 'price' };

/**
 * Picture of model m: its photo from the studio (render/previews.js), or until it is made the model's
 * colours and brand. big = the turning model in the detail.
 */
function thumbHTML(m, big) {
  const L = m.look || {}, c1 = L.body || L.color || '#5f9c7c', c2 = L.dark || L.bodyLt || L.light || L.accent || c1;
  const word = (m.brand || m.name).toUpperCase(), url = big ? null : thumbURL(m.id);
  const inner = big ? '<canvas class="mview" width="600" height="380" aria-label="Model stroje, otáčíš ho tažením myši"></canvas><em>Otoč tažením</em>'
    : url ? `<img src="${url}" alt="">` : `<span>${esc(word)}</span>`;
  return `<div class="mthumb${big ? ' big' : ''}${url || big ? ' shot' : ''}" style="--c1:${c1};--c2:${c2}" data-model="${esc(m.id)}">${inner}</div>`;
}
// a picture that was made while the shop is open goes straight into its card
setThumbHandler(id => {
  for (const el of document.querySelectorAll(`.mthumb[data-model="${CSS.escape(id)}"]:not(.big)`)) { el.classList.add('shot'); el.innerHTML = `<img src="${thumbURL(id)}" alt="">`; }
});
/** Compared with the best piece of the kind you own: "+50 % výkon". */
function compareText(m) {
  const own = MODELS.filter(x => x.kind === m.kind && piecesOf(x.id).length);
  if (!own.length) return '';
  const [label, v, , more] = statsOf(m)[0], best = Math.max(...own.map(x => statsOf(x)[0][1]));
  if (Math.abs(v - best) < 1e-6) return '<span class="cmp">' + label.toLowerCase() + ' jako tvůj nejlepší</span>';
  const d = Math.round((v / best - 1) * 100), good = (d > 0) === !!more;
  return `<span class="cmp ${good ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d} % ${label.toLowerCase()}</span>`;
}
function cardHTML(m) {
  const ps = piecesOf(m.id), own = ps.filter(p => p.own === 'own').length, leased = ps.length - own;
  const stats = statsOf(m), max = stats.map((s, i) => Math.max(...MODELS.filter(x => x.kind === m.kind).map(x => statsOf(x)[i][1])));
  const chips = (own ? `<span class="chip on">Vlastníš ${own}</span>` : '') + (leased ? `<span class="chip warn">Pronájem ${leased}</span>` : '');
  return `<button class="mcard${shop.sel === m.id ? ' on' : ''}${G.money < m.price ? ' dear' : ''}" data-act="model" data-key="${esc(m.id)}">
    ${thumbHTML(m)}
    <span class="mname"><b>${esc(modelName(m))}</b>${chips}</span>
    <span class="mprice">${fmt(m.price)} Kč</span>
    ${stats.map(([label, v, txt, more], i) => `<span class="mstat${more ? '' : ' less'}"><i>${label}</i><em><s style="width:${Math.max(6, (v / max[i]) * 100).toFixed(0)}%"></s></em><b>${txt}</b></span>`).join('')}
    ${compareText(m)}
  </button>`;
}
/** The chosen model: picture, all numbers, what you own of it, buy, lease or buy with a trade-in. */
function detailHTML(m) {
  const c = byKey[m.id], ps = piecesOf(m.id), same = [...vehicles, ...tools].filter(p => (p.type || p.key) === m.kind && p.own === 'own');
  const trade = same.filter(p => !tradeBlock(p)), pick = trade.find(p => p.id === shop.trade) || null;
  const pay = c.price - (pick ? sellValueOf(pick) : 0);
  const tradeSel = same.length ? `<label class="hselect"><span>Protiúčet</span><select data-trade="1">
      <option value="">Bez protiúčtu</option>${trade.map(p => `<option value="${p.id}"${p === pick ? ' selected' : ''}>Prodat ${esc(labelOf(p))} · stav ${pct(p.cond)} · ${fmt(sellValueOf(p))} Kč</option>`).join('')}
    </select></label>` : '';
  return `<div class="mdetail">
    ${thumbHTML(m, true)}
    <div class="mdbody">
      <div class="mdhead"><h3>${esc(modelName(m))}</h3>${btn('unmodel', '', 'Zavřít', false, 'ghost')}</div>
      <p>${esc(c.desc)}</p>
      <div class="mdstats">${statsOf(m).map(([label, , txt]) => `<div><span>${label}</span><b>${txt}</b></div>`).join('')}<div><span>Cena</span><b>${fmt(c.price)} Kč</b></div></div>
      ${powerNote(m)}
      ${ps.length ? `<p class="muted">Máš ${ps.length} ${ps.length === 1 ? 'kus' : ps.length < 5 ? 'kusy' : 'kusů'}: ${ps.map(p => esc(labelOf(p))).join(', ')}. Prodej najdeš ve Vozovém parku.</p>` : ''}
      ${tradeSel}
      <div class="ract">${pick
        ? btn('trade', m.id, 'Koupit a prodat starý · doplatíš ' + fmt(pay) + ' Kč', G.money < pay)
        : btn('buy', m.id, 'Koupit · ' + fmt(c.price) + ' Kč', G.money < c.price)}
        ${c.noLease ? '' : btn('lease', m.id, 'Pronajmout · ' + fmt(leaseUpfront(m.id)) + ' Kč + ' + fmt(leaseDaily(m.id)) + ' Kč/den', G.money < leaseUpfront(m.id), 'ghost')}</div>
      ${same.length && !trade.length ? '<p class="muted">Na protiúčet teď nic nejde: stroje jsou v práci, ve kterém sedíš, nebo mají náklad.</p>' : ''}
    </div>
  </div>`;
}

function shopHTML() {
  const g = SHOP.find(x => x.id === shop.tab) || SHOP[0];
  let out = `<div class="shopnav">${SHOP.map(x => `<button class="chipbtn${x === g ? ' on' : ''}" data-act="shopgrp" data-key="${x.id}">${x.name}</button>`).join('')}</div>`;
  if (g.id === 'build') return out + buildingsHTML();
  out += `<div class="shopfilter"><label><input type="checkbox" data-filter="afford"${shop.afford ? ' checked' : ''}> Jen na co mám</label>
    <label>Řadit <select data-filter="sort"><option value="price"${shop.sort === 'price' ? ' selected' : ''}>od nejlevnějšího</option><option value="best"${shop.sort === 'best' ? ' selected' : ''}>od nejlepšího</option></select></label>
    <span class="muted">Další kusy parkují na odstavné ploše jižně od dvora.</span></div>`;
  const sel = MODEL[shop.sel];
  if (sel && g.kinds.includes(sel.kind)) out += detailHTML(sel);
  for (const kind of g.kinds) {
    let list = MODELS.filter(m => m.kind === kind && (!shop.afford || m.price <= G.money));
    list = shop.sort === 'best' ? list.sort((a, b) => statsOf(b)[0][1] - statsOf(a)[0][1] || b.price - a.price) : list.sort((a, b) => a.price - b.price);
    out += `<h3 class="grp">${KIND_TITLE[kind]}</h3>`;
    out += list.length ? `<div class="mcards">${list.map(cardHTML).join('')}</div>` : '<p class="empty">Na žádný model teď nemáš.</p>';
  }
  for (const key of g.extra || []) out += `<h3 class="grp">${byKey[key].kind}</h3>` + buildingRow(byKey[key]);
  return out;
}

/** A building or the row header: one row with buy, lease or sell. */
function buildingRow(c) {
  const st = status(c.key);
  const chip = st === 'own' ? '<span class="chip on">Vlastníš</span>'
    : st === 'lease' ? `<span class="chip warn">Pronájem · ${fmt(leaseDaily(c.key))} Kč/den</span>`
    : '<span class="chip">Nevlastníš</span>';
  let actions = '', note = '';
  if (!st) {
    actions = btn('buy', c.key, 'Koupit · ' + fmt(c.price) + ' Kč', G.money < c.price) +
      (c.noLease ? '' : btn('lease', c.key, 'Pronajmout · ' + fmt(leaseUpfront(c.key)) + ' Kč + ' + fmt(leaseDaily(c.key)) + ' Kč/den', G.money < leaseUpfront(c.key), 'ghost'));
  } else {
    const why = blockReason(c.key);
    actions = st === 'own' ? btn('sell', c.key, 'Prodat · ' + fmt(sellValue(c.key)) + ' Kč', !!why, 'ghost') : btn('return', c.key, 'Vrátit', !!why, 'ghost');
    if (why) note = `<p class="why">${why}</p>`;
  }
  return `<div class="row"><div class="rmain"><b>${c.name}</b><span>${c.desc}</span>${note}</div>
    <div class="rstate">${chip}${st && hasCondition(c) ? `<span class="muted">stav ${pct(condOf(c.key))}</span>` : ''}</div>
    <div class="ract">${actions}</div></div>`;
}
const buildingsHTML = () => '<h3 class="grp">Budovy</h3>' + CATALOG.filter(c => c.kind === 'Budovy').map(buildingRow).join('');

/** Shop: how a tractor copes with your implements, or how fast an implement goes with your strongest tractor. */
function powerNote(m) {
  if (!m) return '';
  const share = (hp, need) => Math.max(MIN_POWER, Math.min(1, hp / need));
  if (m.kind === 'tractor') {
    const slow = tools.filter(t => t.need > m.hp).sort((a, b) => b.need - a.need);
    if (!tools.length) return '';
    if (!slow.length) return '<span class="muted">Utáhne naplno všechno tvoje nářadí.</span>';
    return '<p class="why">Pomaleji: ' + slow.slice(0, 3).map(t => labelOf(t) + ' na ' + pct(share(m.hp, t.need))).join(', ') + '.</p>';
  }
  if (!m.hp) return '';
  const best = Math.max(0, ...vehicles.filter(v => v.type === 'tractor').map(v => v.hp));
  if (!best) return '';
  const sh = share(best, m.hp), load = m.kind === 'trailer' || m.kind === 'watertank';
  if (sh >= 1) return '<span class="muted">S tvým nejsilnějším traktorem (' + best + ' k) ' + (load ? 'pojede plný naplno.' : 'pojede naplno.') + '</span>';
  return '<p class="why">S tvým nejsilnějším traktorem (' + best + ' k) ' + (load ? 'pojede plný na ' + pct(Math.max(0.45, sh)) : 'bude pracovat na ' + pct(sh)) + '.</p>';
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
  if (p === G.active && !G.onFoot) out.push('řídíš');
  if (p.helper) out.push('pomocník: ' + helperStatus(p));
  if (p.type === 'tractor') out.push(p.tool ? 'nářadí: ' + labelOf(p.tool).toLowerCase() : 'bez nářadí');
  if (p.on) out.push('na traktoru ' + labelOf(p.on));
  if (p.harvester && p.tank.amount > 0) out.push('zásobník ' + fmt(p.tank.amount) + ' l ' + (p.type === 'chopper' ? 'řezanky' : CROPS[p.tank.crop].gen));
  if (p.logs > 0) out.push('dřevo ' + String(p.logs.toFixed(1)).replace('.', ',') + ' m³');
  if (p.key === 'trailer' && p.tank.amount > 0) out.push(fmt(p.tank.amount) + ' l ' + CROPS[p.tank.crop].gen);
  if (p.key === 'trailer' && p.bales) out.push(p.bales + ' balíků');
  if (p.key === 'trailer' && p.forage?.l > 0) out.push(fmt(p.forage.l) + ' l ' + (p.forage.kind === 'silage' ? 'siláže' : 'řezanky'));
  if (p.key === 'watertank' && p.water > 0) out.push(fmt(p.water) + ' l ' + (p.milk ? 'mléka' : 'vody'));
  return out.join(' · ');
}
function fleetHTML() {
  const all = [...vehicles, ...tools], value = all.reduce((a, p) => a + (p.own === 'own' ? sellValueOf(p) : 0), 0);
  let out = `<p class="lede small">Všechny stroje a nářadí. Přesednout můžeš i odsud, nebo klávesou Tab (stroje v okolí) a Shift+Tab (všechny). Opravuje se v kůlně (R).</p>
    <div class="stats"><div><span>Strojů</span><b>${vehicles.length}</b></div><div><span>Nářadí a přívěsů</span><b>${tools.length}</b></div>
    <div><span>Hodnota při prodeji</span><b>${fmt(value)} Kč</b></div><div><span>Pronájmy za den</span><b>${fmt(dailyLeaseCost())} Kč</b></div></div>`;
  const row = p => {
    const why = blockReasonOf(p), key = p.model, lease = p.own === 'lease';
    const chips = (lease ? `<span class="chip warn">Pronájem · ${fmt(leaseDaily(key))} Kč/den</span>` : '<span class="chip on">Vlastníš</span>') +
      `<span class="muted">stav ${pct(p.cond)}${p.type ? ' · nafta ' + Math.round((p.fuel / p.fuelCap) * 100) + ' %' : ''}</span>`;
    const acts = (p.type ? btn('drive', p.id, 'Přesednout', (p === G.active && !G.onFoot) || !!p.helper) : '') +
      btn('sellp', p.id, lease ? 'Vrátit' : 'Prodat · ' + fmt(sellValueOf(p)) + ' Kč', !!why, 'ghost');
    return `<div class="row${p === G.active && !G.onFoot ? ' active' : ''}"><div class="rmain"><b>${labelOf(p)}</b><span>${whereText(p)}${doingText(p) ? ' · ' + doingText(p) : ''}</span>${why && why !== 'Právě v něm sedíš.' ? `<p class="why">${why}</p>` : ''}</div>
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
  let out = '<p class="lede small">Sousedům obděláš pole, která ti nepatří, dokud je nekoupíš. Osivo a hnojivo dodají oni, úrodu si odvezou sami. Odměnu dostaneš, když dokončíš 90 % práce do dvou dnů. Když nabídku asi čtyři hodiny nepřijmeš, soused práci udělá sám svým strojem.</p>';
  for (const j of neighbourJobs()) out += `<p class="muted">${j.who} teď sám dělá ${CTYPES[j.type].name.toLowerCase()} pole ${j.field} (${Math.round((j.seg / j.of) * 100)} %).</p>`;
  if (a) {
    const left = Math.max(0, a.deadline - G.gameMin);
    out += `<div class="row active"><div class="rmain"><b>${CTYPES[a.type].name} · pole ${a.field}</b><span>Pro: ${neighbourOf(a.field).full} · ${jobLine(a)}</span>
      <div class="bar"><i style="width:${(progress(a) * 100).toFixed(1)}%"></i></div>
      <span class="muted">Hotovo ${pct(progress(a))} · zbývá ${Math.floor(left / 60)} h ${Math.floor(left % 60)} min</span></div>
      <div class="rstate"><span class="chip on">Rozpracováno</span><b>${fmt(a.reward)} Kč</b></div>
      <div class="ract">${btn('cancel', '', 'Zrušit zakázku', false, 'ghost')}</div></div>`;
  }
  if (!G.contracts.offers.length) out += '<p class="empty">Sousedé teď nic nepotřebují. Nové zakázky přicházejí s každým novým dnem.</p>';
  for (const o of G.contracts.offers) {
    const can = canDo(o);
    const nb = neighbourOf(o.field), wait = Math.max(0, 240 - (G.gameMin - (o.at ?? G.gameMin)));
    out += `<div class="row"><div class="rmain"><b>${CTYPES[o.type].name} · pole ${o.field}</b><span>${nb.full}: „${nb.ask}“</span><span>${jobLine(o)} · čeká ještě ${Math.floor(wait / 60)} h ${Math.floor(wait % 60)} min</span>
      ${can ? '' : '<p class="why">Ten stroj nemáš. Koupíš nebo pronajmeš ho v Obchodě.</p>'}</div>
      <div class="rstate"><b>${fmt(o.reward)} Kč</b></div>
      <div class="ract">${btn('accept', o.id, 'Přijmout', !!a || !can)}</div></div>`;
  }
  return deliveriesHTML() + '<h3 class="grp">Práce na polích sousedů</h3>' + out;
}

/** Delivery contracts: the active ones with their progress, then the day's offers. */
function deliveriesHTML() {
  const D = G.deliveries, left = d => { const m = Math.max(0, d.deadline - G.gameMin), hh = Math.floor(m / 60); return hh >= 24 ? Math.floor(hh / 24) + ' d ' + (hh % 24) + ' h' : hh + ' h ' + Math.floor(m % 60) + ' min'; };
  let out = '<h3 class="grp">Dodávky do výkupů</h3><p class="lede small">Výkup chce určité množství plodiny do několika dnů a platí za ni příplatek. Každý litr té plodiny prodaný v tom výkupu se počítá. Úrodu můžeš vozit z pole nebo ze sila. Najednou můžeš mít dvě dodávky; nesplněná propadne bez pokuty, jen přijdeš o příplatek.</p>';
  for (const d of D.active) {
    const m = deliveryMarket(d), share = d.done / d.amount;
    out += `<div class="row active"><div class="rmain"><b>${fmt(d.amount)} l ${CROPS[d.crop].gen} · ${m.name}</b>
      <span>Příplatek +${Math.round(d.bonus * 100)} % · teď ${fmt2(deliveryPrice(d))} Kč/l · v silu ${fmt(G.silo.stock[d.crop])} l</span>
      <div class="bar"><i style="width:${(share * 100).toFixed(1)}%"></i></div>
      <span class="muted">Dovezeno ${fmt(d.done)} l (${pct(share)}) · zbývá ${left(d)}</span></div>
      <div class="rstate"><span class="chip on">Rozpracováno</span></div></div>`;
  }
  if (!D.offers.length) out += '<p class="empty">Výkupy dnes nic dalšího nechtějí. Nové nabídky přicházejí každý den.</p>';
  for (const o of D.offers) {
    const m = deliveryMarket(o), pr = marketPrice(m, o.crop, G.gameMin) * (1 + o.bonus);
    out += `<div class="row"><div class="rmain"><b>${fmt(o.amount)} l ${CROPS[o.crop].gen} · ${m.name}</b>
      <span>Do ${o.days} dnů · příplatek +${Math.round(o.bonus * 100)} % · teď ${fmt2(pr)} Kč/l · v silu ${fmt(G.silo.stock[o.crop])} l</span></div>
      <div class="rstate"><b>asi ${fmt(o.amount * pr)} Kč</b></div>
      <div class="ract">${btn('dlv', o.id, 'Přijmout dodávku', !canAcceptDelivery())}</div></div>`;
  }
  return out;
}

/**
 * Price chart of crop k over the last DAYS days, hour by hour: a thin line per buyer that takes it
 * and the best price in bold, the price now and the 5-day average as a dashed line.
 */
const CH_DAYS = 5, CW = 360, CHH = 110;
function priceChart(k) {
  const now = G.gameMin, t0 = now - CH_DAYS * 1440, ms = MARKETS.filter(m => accepts(m, k)), N = CH_DAYS * 24;
  const series = ms.map(m => Array.from({ length: N + 1 }, (_, i) => marketPrice(m, k, t0 + i * 60)));
  const best = series[0].map((_, i) => Math.max(...series.map(s => s[i])));
  const all = series.flat(), lo = Math.min(...all) * 0.97, hi = Math.max(...all) * 1.02;
  const X = i => 30 + (i / N) * (CW - 38), Y = p => 8 + (1 - (p - lo) / (hi - lo)) * (CHH - 26);
  const path = s => s.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p).toFixed(1)).join('');
  const avg = best.reduce((a, b) => a + b, 0) / best.length;
  let svg = `<svg viewBox="0 0 ${CW} ${CHH}" class="pchart" role="img" aria-label="Vývoj ceny: ${CROPS[k].name}">`;
  for (let d = 0; d <= CH_DAYS; d++) { const x = X(d * 24); svg += `<line x1="${x}" y1="6" x2="${x}" y2="${CHH - 18}" class="grid"/><text x="${x}" y="${CHH - 5}" class="ax" text-anchor="${d === CH_DAYS ? 'end' : 'middle'}">${d === CH_DAYS ? 'teď' : '−' + (CH_DAYS - d) + ' d'}</text>`; }
  for (const p of [lo + (hi - lo) * 0.1, (lo + hi) / 2, hi - (hi - lo) * 0.1]) svg += `<text x="2" y="${Y(p) + 3}" class="ax">${fmt2(p)}</text>`;
  series.forEach((s, j) => { svg += `<path d="${path(s)}" class="mline" stroke="${ms[j].color}"/>`; });
  svg += `<line x1="30" x2="${CW - 8}" y1="${Y(avg)}" y2="${Y(avg)}" class="avg"/>`;
  svg += `<path d="${path(best)}" class="best"/><circle cx="${X(N)}" cy="${Y(best[N])}" r="3.5" class="dot"/></svg>`;
  return { svg, avg, now: best[N], ms };
}

/** Prices and the silo: what is stored, what it is worth, how prices went in the last days. */
function marketHTML() {
  const st = siloTotal();
  let out = `<p class="lede small">Úrodu nemusíš prodat hned. V kruhu Družstva na statku ji klávesou <kbd>G</kbd> uskladníš v silech (každou plodinu zvlášť, dohromady ${fmt(SILO_CAP)} l). Když cena vyskočí, přistav přívěs do bílého kruhu „Výdej ze sila“ na severní straně sil, klávesou <kbd>F</kbd> ho naplníš (<kbd>C</kbd> vybere plodinu) a odvezeš do výkupu, který zrovna platí nejvíc.</p>`;
  out += `<div class="row"><div class="rmain"><b>Sila na statku</b><span>${fmt(st)} / ${fmt(SILO_CAP)} l</span><div class="bar"><i style="width:${((st / SILO_CAP) * 100).toFixed(1)}%"></i></div></div>
    <div class="rstate"><b>${fmt(G.silo.stock.reduce((a, l, k) => a + (l > 0 ? l * bestMarket(k, G.gameMin).p : 0), 0))} Kč</b><span class="muted">při dnešních cenách</span></div></div>`;
  out += '<div class="charts">';
  CROPS.forEach((c, k) => {
    const ch = priceChart(k), b = bestMarket(k, G.gameMin), diff = ch.now / ch.avg - 1, l = G.silo.stock[k];
    out += `<div class="chartcard"><div class="mdhead"><b>${c.name}</b><span class="${diff >= 0 ? 'up' : 'down'}">${fmt2(ch.now)} Kč/l · ${diff >= 0 ? '+' : ''}${Math.round(diff * 100)} % proti průměru</span></div>
      ${ch.svg}
      <span class="muted">Nejvíc teď platí ${b.m.name} · ${ch.ms.map(m => `<i class="sw" style="background:${m.color}"></i>${m.short}`).join(' ')}</span>
      <span class="muted">V silu ${fmt(l)} l${l ? ' · ' + fmt(l * b.p) + ' Kč' : ''}</span></div>`;
  });
  return out + '</div>';
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
    const h = herd(key), sh = HERD[key];
    extra += '<span class="muted">Stádo: ' + herdName(key, h.n) + ' z ' + sh.cap + ' · zdraví ' + pct(h.health) +
      (h.n >= sh.cap ? ' · budova je plná, prodej zvířata na dobytčím trhu' : h.health >= 0.75 && !F.hungry[key] ? ' · přibývají (' + sh.young + ')' : ' · nepřibývají, dokud nejsou zdravá a nakrmená') + '</span>';
    extra += '<div class="bar"><i style="width:' + (h.health * 100).toFixed(0) + '%"></i></div>';
    out += row(b.name, 'Krmivo ' + fmt(F[b.store]) + ' / ' + fmt(b.cap) + ' l (' + eatsText(key) + ') · vystačí ' + days(daysLeft(key)),
      F.hungry[key] ? '<span class="chip warn">Hladoví</span>' : h.health < 0.5 ? '<span class="chip warn">Nemocná</span>' : '<span class="chip on">V pořádku</span>', extra);
  }
  out += row('Jímka na kejdu a hnojiště', 'Kejda ' + fmt(F.slurry) + ' / ' + fmt(DUNG.slurryCap) + ' l · hnůj ' + fmt(F.manure) + ' / ' + fmt(DUNG.manureCap) + ' l',
    '<span class="chip">' + Math.round(Math.max(F.slurry / DUNG.slurryCap, F.manure / DUNG.manureCap) * 100) + ' %</span>',
    '<span class="muted">Kejdu dávají krávy a prasata, hnůj krávy, ovce a slepice. Cisternou na kejdu nebo rozmetadlem hnoje ji vyvezeš na pole, kde hnojí jako hnojivo (i druhá dávka), zdarma. Plní se v kruzích vedle jímky a před hnojištěm.</span>');
  const bk = F.bunker, bkFill = (bk.chaff + bk.silage) / SILAGE.cap;
  out += row('Silážní žlab', bunkerState() + ' · místo na ' + fmt(SILAGE.cap) + ' l',
    bk.covered ? '<span class="chip warn">Kvasí</span>' : bk.silage >= 1 ? '<span class="chip on">Siláž</span>' : '<span class="chip">' + Math.round(bkFill * 100) + ' %</span>',
    '<span class="muted">Řezanku z řezačky nebo samosběracího vozu vysyp ve žlabu za kravínem, udusej ji traktorem (aspoň na ' + Math.round(SILAGE.packNeed * 100) + ' %) a zakryj plachtou (F). Za ' + SILAGE.fermentH + ' h je z ní siláž: krávy ji žerou jako seno, bioplynka u cukrovaru ji koupí za ' + fmt2(SILAGE.silagePrice) + ' Kč/l (řezanku za ' + fmt2(SILAGE.chaffPrice) + ').</span>' +
    (bk.covered ? '<div class="bar"><i style="width:' + Math.min(100, (bk.ferment / SILAGE.fermentH) * 100).toFixed(0) + '%"></i></div>' : ''));
  const waiting = Object.keys(PALLETS).filter(p => palletsReady(p) > 0).map(p => plural(palletsReady(p), 'paleta', 'palety', 'palet') + ' ' + PALLETS[p].label);
  if (waiting.length) out += row('Palety k odvozu', waiting.join(' · '), '<span class="chip warn">Čekají</span>', '<span class="muted">Přívěsem (prázdným, v kruhu u budovy, F) je odvez do tržnice v městečku: zaplatí o ' + Math.round(PALLET.bonus * 100) + ' % víc. Co zůstane, odvezou o půlnoci za základní cenu.</span>');
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
/** The implement chosen for a helper on tractor v (remembered while the office is open). */
const picks = {};
function toolPick(v) {
  if (v?.type !== 'tractor') return undefined;
  const list = helperTools(v);
  return list.find(t => t.id === picks[v.id]) || (list.includes(v.tool) ? v.tool : list[0]) || v.tool;
}
/** "Pole 5 · kultivace": the field and what the helper does there with v (and implement im). */
const fieldLabel = (f, v, im) => (f.meadow ? 'Louka ' : 'Pole ') + f.id + (f.owned ? '' : ' (zakázka)') + ' · ' + jobName(im ? Object.assign(Object.create(v), { impl: im.key }) : v);

/** Machines a helper can drive: send one (a tractor with the implement of your choice) to a field or the forest, or let him go. */
function helpersHTML() {
  const busy = busyHelper(null);
  let out = '<h3 class="grp">Pomocník</h3><p class="lede small">Pošli stroj s pomocníkem na pole nebo do lesa. U traktoru vyber nářadí: pro jiné, než má zapojené, si pomocník nejdřív dojede. Na pole jede po silnicích, plný zásobník odveze na nejlepší výkup a po práci se vrátí na dvůr. Najednou pracuje jen jeden pomocník. Mzda ' + fmt(WAGE) + ' Kč za herní hodinu, platí se i cesta.</p>';
  for (const v of vehicles.filter(x => x.type !== 'jeep')) {
    const name = labelOf(v) + (v.type === 'tractor' ? ' · ' + (v.tool ? labelOf(v.tool).toLowerCase() : 'bez nářadí') : '');
    if (v.helper) {
      out += `<div class="row active"><div class="rmain"><b>${name}</b><span>${helperStatus(v)} · mzda ${fmt(v.helper.wage)} Kč</span></div>
        <div class="rstate">${btn('fire', v.id, 'Propustit', false, 'ghost')}</div></div>`;
      continue;
    }
    if (busy) continue; // only one helper at a time: the others wait until he is done
    const im = toolPick(v), list = v.type === 'tractor' ? helperTools(v) : [];
    const toolSel = list.length > 1 || (list.length && list[0] !== v.tool)
      ? `<label class="hselect"><span class="sr">Nářadí</span><select data-tool="${v.id}">${list.map(t => `<option value="${t.id}"${t === im ? ' selected' : ''}>${labelOf(t)}${t === v.tool ? ' (zapojené)' : ''}${powerShare(v, t) < 1 ? ' · práce ' + pct(powerShare(v, t)) : ''}</option>`).join('')}</select></label>` : '';
    const opts = v.type === 'forest'
      ? (canHire(v).wood ? [['wood', 'Les: těžba vzrostlých stromů']] : [])
      : FIELDS.filter(f => !canHire(v, f, im).why).map(f => [f.id, fieldLabel(f, v, im) + (im && powerShare(v, im) < 1 ? ' · práce na ' + pct(powerShare(v, im)) : '')]);
    const why = opts.length ? '' : (canHire(v, v.type === 'forest' ? null : FIELDS.find(f => f.owned), im).why || 'Teď s ním není kde pracovat.');
    out += `<div class="row"><div class="rmain"><b>${name}</b>${toolSel}${why ? `<span>${why}</span>`
      : `<label class="hselect"><span class="sr">Kam</span><select id="hsel-${v.id}">${opts.map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select></label>`}</div>
      <div class="rstate">${btn('send', v.id, 'Poslat', !opts.length)}</div></div>`;
  }
  if (busy) out += `<p class="muted">Ostatní stroje počkají, až pomocník (${labelOf(busy)}) skončí nebo ho propustíš.</p>`;
  return out;
}

/** Sowing calendar: in which seasons each crop is sown, how long it ripens, now highlighted. */
function calendarHTML() {
  const now = seasonIdx(dayOf(G.gameMin));
  let out = '<h3 class="grp">Kalendář setí</h3><p class="lede small">Každá plodina se seje jen v některých ročních obdobích, v zimě se neseje nic. Zralá plodina, kterou do ' + WITHER_H + ' hodin nesklidíš, přezraje a dá jen polovinu.</p><table class="cal"><tr><th></th>';
  SEASONS.forEach((s, k) => { out += `<th class="${k === now ? 'now' : ''}">${s.name}</th>`; });
  out += '<th>Zraje</th></tr>';
  for (const c of CROPS) {
    out += `<tr><td>${c.name}</td>` + SEASONS.map((_, k) => `<td class="${k === now ? 'now' : ''}">${c.sowIn.includes(k) ? '<i class="sow" title="seje se"></i>' : ''}</td>`).join('') + `<td>${c.hours} h</td></tr>`;
  }
  return out + '</table>';
}
/** The yield breakdown of a field, as Farming Simulator shows it: each factor in per cent. */
function yieldHTML(f) {
  const y = fieldYield(f), rows = y.rows.filter(r => Math.abs(r.v) >= 0.005 || ['Hnojení', 'Plevel', 'Vápnění'].includes(r.label));
  const cell = r => `<span class="${r.v > 0 ? 'up' : r.v < 0 ? 'down' : 'muted'}">${r.label} ${r.v > 0 ? '+' : r.v < 0 ? '−' : '±'}${Math.round(Math.abs(r.v) * 100)} %</span>`;
  return `<div class="yrow">${rows.map(cell).join('')}${f.q !== 1 ? `<span class="${f.q > 1 ? 'up' : 'down'}">Půda ${Math.round(f.q * 100)} %</span>` : ''}${y.stones > 0.005 ? '<span class="down">Kameny ' + pct(y.stones) + '</span>' : ''}</div>`;
}
function fieldsHTML() {
  let out = calendarHTML() + '<h3 class="grp">Pozemky</h3><p class="lede small">U každého tvého pole je rozpis výnosu: co ho zvedá (hnojení dvakrát, orba, válení, mulčování strniště, jiná plodina než minule) a co ho bere (plevel, kyselá půda po ' + LIME_DUE + ' sklizních bez vápnění, přezrálé plodiny). Kameny po orbě výnos neberou, ale ničí lištu: uválcuj je.</p>';
  for (const f of FIELDS) {
    const parts = (f.meadow ? [[S_RIPE, 'k posečení'], [S_STUB, 'dorůstá']] : [[S_RIPE, 'zralé'], [S_SOWN, 'oseto'], [S_CULT, 'připraveno'], [S_STUB, 'strniště']])
      .filter(([k]) => f.cnt[k] / f.area >= 0.05).map(([k, name]) => name + ' ' + pct(f.cnt[k] / f.area));
    const state = f.owned ? '<span class="chip on">Tvoje</span>' : '<span class="chip">Soused</span>';
    const buyBtn = f.owned ? '' : `<div class="ract">${btn('field', f.id, 'Koupit · ' + fmt(f.price) + ' Kč', G.money < f.price)}</div>`;
    const yld = f.owned && !f.meadow ? `<b class="ytot">Výnos ${Math.round(fieldYield(f).total * f.q * 100)} %</b>` : '';
    out += `<div class="row"><div class="rmain"><b>${f.meadow ? 'Louka' : 'Pole'} ${f.id} · ${ha(f.area)}${f.q !== 1 ? ' · půda ' + Math.round(f.q * 100) + ' %' : ''}</b><span>${parts.join(' · ') || '—'}</span>${f.owned && !f.meadow ? yieldHTML(f) : ''}</div><div class="rstate">${state}${yld}</div>${buyBtn}</div>`;
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
