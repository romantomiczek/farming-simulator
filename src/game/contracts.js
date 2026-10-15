import { fmt } from '../core/util.js';
import { G, dayOf } from './state.js';
import { CROPS, S_STUB, S_CULT, S_SOWN, S_RIPE } from './crops.js';
import { has, setContractNeeds } from './machines.js';
import { FIELDS, countFields, drawSigns } from '../world/fields.js';
import { toast } from '../ui/toast.js';
import { season } from './weather.js';

/**
 * Field work for the neighbour on fields the player does not own. One contract at a time.
 * The neighbour supplies seed and fertiliser and collects the harvest himself, the player
 * gets the reward when 90 % of the work is done. Contracts move the neighbour's fields
 * through the whole cycle: harvest → cultivate/plough → sow → fertilise → grow → harvest.
 */
export const CTYPES = {
  harvest: { name: 'Sklizeň', rate: 9, state: S_RIPE },
  cultivate: { name: 'Kultivace', rate: 4, state: S_STUB, impl: 'cultivator' },
  plough: { name: 'Orba', rate: 6, state: S_STUB, impl: 'plough' },
  sow: { name: 'Setí', rate: 5, state: S_CULT, impl: 'seeder' },
  fertilize: { name: 'Hnojení', rate: 3, state: S_SOWN, impl: 'spreader' },
};
const DONE_SHARE = 0.9;
const DAYS_TO_FINISH = 2;

/** Catalog key of the machine a contract needs. */
export function needs(c) {
  if (c.type !== 'harvest') return CTYPES[c.type].impl;
  const h = CROPS[c.crop].header;
  return h === 'beet' ? 'beet' : h === 'corn' ? 'cornHeader' : 'combine';
}
setContractNeeds(needs);
export const needsLabel = c => {
  if (c.type !== 'harvest') return { cultivator: 'kultivátor', plough: 'pluh', seeder: 'secí stroj', spreader: 'rozmetadlo' }[CTYPES[c.type].impl];
  const h = CROPS[c.crop].header;
  return h === 'beet' ? 'sklízeč cukrovky' : h === 'corn' ? 'kombajn s řádkovým adaptérem' : 'kombajn se žací lištou';
};
export const canDo = c => has(needs(c)) && (c.type !== 'harvest' || CROPS[c.crop].header !== 'corn' || has('combine'));

function dominantCrop(f, state) {
  const n = new Array(CROPS.length).fill(0);
  for (let i = 0; i < f.n; i++) if (f.state[i] === state) n[f.crop[i]]++;
  return n.indexOf(Math.max(...n));
}

function offer(type, f, crop = -1) {
  const target = f.cnt[CTYPES[type].state];
  const day = dayOf(G.gameMin);
  return {
    id: type + '-' + f.id + '-' + day, type, field: f.id, crop, target,
    reward: Math.round((target * CTYPES[type].rate) / 100) * 100,
    deadline: G.gameMin + DAYS_TO_FINISH * 1440,
  };
}

/** New offers from the current state of the fields the player does not own. */
export function generateOffers() {
  countFields();
  const day = dayOf(G.gameMin), offers = [];
  for (const f of FIELDS) {
    if (f.owned || G.contracts.active?.field === f.id) continue;
    const share = k => f.cnt[k] / f.n;
    if (share(S_RIPE) > 0.5) offers.push(offer('harvest', f, dominantCrop(f, S_RIPE)));
    else if (share(S_STUB) > 0.5) { offers.push(offer('cultivate', f)); offers.push(offer('plough', f)); }
    else if (share(S_CULT) > 0.5 && season().sow) offers.push(offer('sow', f, (day * 7 + f.id * 3) % CROPS.length)); // the neighbour picks the crop
    else if (share(S_SOWN) > 0.5 && f.fertShare < 0.3) offers.push(offer('fertilize', f));
  }
  G.contracts.offers = offers;
}

export function accept(id) {
  if (G.contracts.active) return false;
  const c = G.contracts.offers.find(o => o.id === id);
  if (!c || !canDo(c)) return false;
  G.contracts.active = { ...c, done: 0, deadline: G.gameMin + DAYS_TO_FINISH * 1440 };
  G.contracts.offers = G.contracts.offers.filter(o => o.field !== c.field);
  drawSigns();
  toast('Zakázka přijata: ' + CTYPES[c.type].name.toLowerCase() + ' pole ' + c.field + '.', 'good');
  return true;
}

export function cancelActive(reason) {
  const c = G.contracts.active;
  if (!c) return;
  G.contracts.active = null;
  drawSigns();
  generateOffers();
  toast(reason || 'Zakázka zrušena.', reason ? 'bad' : '');
}

/** May vehicle v work field f because of the active contract? */
export function contractAllows(f, v) {
  const c = G.contracts.active;
  if (!c || c.field !== f.id) return false;
  if (c.type === 'harvest') return !!v.harvester;
  return v.type === 'tractor' && v.impl === CTYPES[c.type].impl;
}

/** Called for every cell the player finishes on the contract field. */
export function contractCell() {
  if (G.contracts.active) G.contracts.active.done++;
}

/** Pays out a finished contract, or drops it after the deadline. Call a few times a second. */
export function checkContract(onDone) {
  const c = G.contracts.active;
  if (!c) return;
  if (c.done >= c.target * DONE_SHARE) {
    G.money += c.reward; G.flashT = 0.4;
    G.contracts.active = null;
    drawSigns();
    generateOffers();
    toast('Zakázka splněna: ' + CTYPES[c.type].name.toLowerCase() + ' pole ' + c.field + '. Odměna ' + fmt(c.reward) + ' Kč.', 'good');
    onDone?.();
  } else if (G.gameMin > c.deadline) {
    cancelActive('Zakázka na poli ' + c.field + ' propadla, nestihl jsi ji včas.');
  }
}

export const progress = c => Math.min(1, c.done / Math.max(1, c.target * DONE_SHARE));
