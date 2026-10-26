import { G } from './state.js';
import { CROPS } from './crops.js';
import { LOADER, SUPPLY, PALLET, PRODUCTION } from './balance.js';
import { fmt, plural } from '../core/util.js';
import { toast } from '../ui/toast.js';
import { bales, addBale, removeBale } from '../world/bales.js';
import { heapAt, addToHeap, takeFromHeap, heapName } from '../world/heaps.js';
import { tools, trailerCircles, HOPPER } from '../vehicles/vehicles.js';
import { MANURE_HEAP, segDist } from '../world/layout.js';
import { DUNG } from './balance.js';
import { hayFeederAt, marketAt, accepts, marketPrice } from './markets.js';
import { BUILDINGS, feedHay, space, addFeed, partOf } from './farm.js';
import { atHall, palletsHere, palletsReady, palletValue, PALLETS } from './animals.js';
import { isSupply, SUPPLIES, atStore, supplyPick, pourInto, toolAt } from './supply.js';
import { forageIn, inBunker, atCows, deliverForage } from './forage.js';
import { sale } from './silo.js';
import { earn } from './goals.js';
import { atProd, prodTake, prodIn } from './production.js';

/**
 * Loaders: the telehandler and the front loader on a tractor (L), as in Farming Simulator. Empty, L takes
 * what lies in front of the head: round bales (the grab, up to its count), a pallet or big bag from a
 * trailer, the store or a building's pallets (the forks), or a bucket from a heap on the ground, the
 * manure heap or the silage bunker. Loaded, L puts it where the head is: bales or pallets onto a trailer,
 * hay or silage bales into a feeder, a big bag into the hopper of a seeder, spreader or sprayer, a pallet
 * of products at the market hall; a bucket into a trailer, the manure spreader, a feeder or a buyer's pit,
 * else onto a heap on the ground. v.ld = { carry, lift } (vehicles.js poses the boom and shows the load):
 * carry = { kind: 'bale', bales: [kinds] } | { kind: 'pallet', p, left } | { kind: 'heap', what, crop, l }.
 */
export const hasLoader = v => !!v && (v.type === 'loader' || !!v.fl);
const bucketOf = v => (v.type === 'loader' ? v.bucketCap : LOADER.frontBucket);
const balesOf = v => (v.type === 'loader' ? v.baleCap : LOADER.frontBales);

/** The point in front of the head where the loader picks up and puts down. */
export function headPoint(v) {
  const z = (v.type === 'loader' ? 4.4 : 3.9) * v.scale, s = Math.sin(v.h), c = Math.cos(v.h);
  return { x: v.x + s * z, z: v.z + c * z };
}
const R = 2.4;
/** The trailer whose body (from its first collision circle to the last) is under point p, or null. */
function trailerAt(p) {
  for (const t of tools) {
    if (t.key !== 'trailer') continue;
    const cs = trailerCircles(t), a = cs[0], b = cs[cs.length - 1];
    if (segDist(p.x, p.z, a.x, a.z, b.x, b.z) < a.r + 0.9) return t;
  }
  return null;
}
/** The hopper implement (seeder, spreader, sprayer) at point p, or null. */
const hopperAt = p => tools.find(t => HOPPER[t.key] && (() => { const q = toolAt(t); return Math.hypot(q.x - p.x, q.z - p.z) < 3; })()) || null;
const bareTrailer = t => !t.tank.amount && !t.bales && !forageIn(t) && !t.pickup;
const heapInto = (t, c) => (c.what === 'crop' ? !t.bales && !t.pallets.length && !forageIn(t) && (t.tank.amount <= 0 || t.tank.crop === c.crop) && t.tank.amount < t.tank.cap - 1
  : (c.what === 'silage' || c.what === 'chaff') && !t.tank.amount && !t.bales && !t.pallets.length && (!forageIn(t) || t.forage.kind === c.what) && forageIn(t) < t.tank.cap - 1);
const mspreader = p => tools.find(t => t.key === 'manure' && (() => { const q = t.on ? { x: t.x, z: t.z } : t; return Math.hypot(q.x - p.x, q.z - p.z) < 4.5; })()) || null;

/** What L would do now with v's loader: { kind, … } or null. Shared by doL() and the HUD prompts. */
export function lAction(v) {
  if (!hasLoader(v)) return null;
  const c = v.ld.carry, p = headPoint(v);
  if (!c) {
    const near = bales.filter(b => Math.hypot(b.x - p.x, b.z - p.z) < R);
    if (near.length) return { kind: 'grabBales', n: Math.min(near.length, balesOf(v)) };
    const t = trailerAt(p);
    if (t && t.pallets.length) return { kind: 'takePallet', t, p: t.pallets[t.pallets.length - 1] };
    const stock = palletsHere(p);
    if (stock) return { kind: 'takeStock', p: stock };
    if (atStore(p)) { const k = supplyPick(); return { kind: 'takeBag', p: k, cost: SUPPLY[k].bag * SUPPLY[k].price }; }
    const h = heapAt(p.x, p.z, 1.2);
    if (h) return { kind: 'scoop', h, l: Math.min(h.l, bucketOf(v)) };
    if (Math.hypot(p.x - MANURE_HEAP.x, p.z - MANURE_HEAP.z) < 5 && G.farm.manure >= 50) return { kind: 'scoopManure', l: Math.min(G.farm.manure, bucketOf(v)) };
    const bk = G.farm.bunker;
    if (inBunker(p) && !bk.covered && bk.silage >= 50) return { kind: 'scoopSilage', l: Math.min(bk.silage, bucketOf(v)) };
    return null;
  }
  const t = trailerAt(p);
  if (c.kind === 'bale') {
    if (t && bareTrailer(t) && !t.pallets.length && t.bales < t.baleCap) return { kind: 'balesTrailer', t };
    const m = hayFeederAt(p), eats = m && c.bales.filter(k => k === 'hay' || (k === 'silage' && m.feed === 'cows')).length;
    if (m && eats) return { kind: 'balesFeed', m };
    return { kind: 'dropBales' };
  }
  if (c.kind === 'pallet') {
    if (t && bareTrailer(t) && t.pallets.length < t.baleCap) return { kind: 'palletTrailer', t };
    if (isSupply(c.p)) {
      const im = hopperAt(p);
      if (im && (im.fill.amount < 1 || im.fill.kind === c.p) && im.fill.amount < im.fillCap - 1 && SUPPLY_FOR[im.key].includes(c.p)) return { kind: 'palletHopper', im };
      if (atStore(p)) return { kind: 'returnBag' };
    } else if (c.p === 'flour' && atProd(p, 'bakery')) return { kind: 'palletProd' };
    else if (atHall(p)) return { kind: 'sellPallet', money: palletValue(c.p) };
    return { kind: 'palletNowhere' };
  }
  if (t && heapInto(t, c)) return { kind: 'bucketTrailer', t };
  if (c.what === 'manure') {
    const im = mspreader(p);
    if (im && im.load < im.loadCap - 1) return { kind: 'bucketSpreader', im };
    if (Math.hypot(p.x - MANURE_HEAP.x, p.z - MANURE_HEAP.z) < 5) return { kind: 'bucketBack' };
  }
  if (c.what === 'silage' && atCows(p)) return { kind: 'bucketCows' };
  if (c.what === 'crop') {
    const m = marketAt(p);
    if (m && accepts(m, c.crop)) return m.feed ? (space(m.feed) >= 1 ? { kind: 'bucketFeed', m } : { kind: 'feedFull', m }) : { kind: 'bucketSell', m };
  }
  return { kind: 'bucketGround' };
}
/** Implements and what their hoppers take from a bag. */
const SUPPLY_FOR = { seeder: ['seed'], spreader: ['fert', 'lime'], sprayer: ['herb'] };

const BALE_NAME = { straw: 'slámy', hay: 'sena', grass: 'trávy', silage: 'senáže' };
const nBales = n => plural(n, 'balík', 'balíky', 'balíků');
/** L: the loader's action. Returns true when something changed (the caller saves). */
export function doL(v) {
  if (!hasLoader(v)) return false;
  const a = lAction(v), ld = v.ld;
  if (!a) {
    toast(v.type === 'loader' ? 'Před manipulátorem nic není. Najeď hlavou k balíkům, paletám, k hromadě, k hnojišti nebo do silážního žlabu a stiskni L.'
      : 'Před nakladačem nic není. Najeď lopatou k balíkům, paletám nebo k hromadě a stiskni L.');
    return false;
  }
  const p = headPoint(v);
  switch (a.kind) {
    case 'grabBales': {
      const list = [];
      for (let i = bales.length - 1; i >= 0 && list.length < a.n; i--) {
        const b = bales[i];
        if (Math.hypot(b.x - p.x, b.z - p.z) < R) { list.push(b.kind); removeBale(i); }
      }
      ld.carry = { kind: 'bale', bales: list };
      toast('Kleště drží ' + nBales(list.length) + '. Polož je klávesou L na přívěs, do krmelce nebo na zem.');
      return true;
    }
    case 'takePallet': ld.carry = { kind: 'pallet', p: a.t.pallets.pop() }; toast('Na vidlích: ' + palletName(ld.carry.p) + '.'); return true;
    case 'takeStock': G.farm[a.p] -= PALLET[a.p]; ld.carry = { kind: 'pallet', p: a.p }; toast('Na vidlích: paleta ' + PALLETS[a.p].label + '. Polož ji na přívěs (L), v tržnici ji prodáš.'); return true;
    case 'takeBag':
      if (G.money < a.cost) { toast('Na ' + SUPPLIES[a.p].bag + ' nemáš peníze (' + fmt(a.cost) + ' Kč).', 'bad'); return false; }
      G.money -= a.cost; G.flashT = 0.4; ld.carry = { kind: 'pallet', p: a.p };
      toast('Koupen ' + SUPPLIES[a.p].bag + ' za ' + fmt(a.cost) + ' Kč. Vysyp ho klávesou L do zásobníku stroje, nebo ho polož na přívěs.', 'good');
      return true;
    case 'scoop': { const l = takeFromHeap(a.h, a.l); ld.carry = { kind: 'heap', what: a.h.what, crop: a.h.crop, l }; return true; }
    case 'scoopManure': G.farm.manure -= a.l; ld.carry = { kind: 'heap', what: 'manure', crop: -1, l: a.l }; return true;
    case 'scoopSilage': G.farm.bunker.silage -= a.l; ld.carry = { kind: 'heap', what: 'silage', crop: -1, l: a.l }; return true;
    case 'balesTrailer': {
      const t = a.t, n = Math.min(ld.carry.bales.length, t.baleCap - t.bales);
      for (const k of ld.carry.bales.splice(0, n)) { t.bales++; if (k === 'hay') t.hay = (t.hay || 0) + 1; else if (k === 'grass') t.grass = (t.grass || 0) + 1; else if (k === 'silage') t.silage = (t.silage || 0) + 1; }
      done(ld); toast('Na přívěsu: ' + nBales(t.bales) + ' z ' + t.baleCap + '.', 'good');
      return true;
    }
    case 'balesFeed': {
      const c = ld.carry, food = c.bales.filter(k => k === 'hay' || (k === 'silage' && a.m.feed === 'cows'));
      const n = feedHay(a.m.feed, food.length);
      if (!n) { toast('Krmelec (' + BUILDINGS[a.m.feed].name + ') je plný.', 'bad'); return false; }
      for (let k = 0; k < n; k++) c.bales.splice(c.bales.indexOf(food[k]), 1);
      done(ld); toast('Do krmelce: ' + nBales(n) + ' · ' + a.m.short, 'good');
      return true;
    }
    case 'dropBales': {
      const s = Math.sin(v.h), c = Math.cos(v.h);
      ld.carry.bales.forEach((k, i) => addBale(p.x + c * (i - (ld.carry.bales.length - 1) / 2) * 1.5, p.z - s * (i - (ld.carry.bales.length - 1) / 2) * 1.5, v.h + Math.PI / 2, k));
      ld.carry = null; ld.lift = 0;
      return true;
    }
    case 'palletTrailer': a.t.pallets.push(ld.carry.p); toast('Na přívěsu: ' + plural(a.t.pallets.length, 'paleta', 'palety', 'palet') + '.', 'good'); ld.carry = null; ld.lift = 0.8; return true;
    case 'palletHopper': {
      const c = ld.carry, left = c.left ?? SUPPLY[c.p].bag, l = pourInto(a.im, c.p, left);
      c.left = left - l;
      toast('Do zásobníku ' + (c.left >= 1 ? 'se vešlo ' : 'vysypáno ') + fmt(l) + ' ' + SUPPLIES[c.p].unit + ' ' + SUPPLIES[c.p].gen + (c.left >= 1 ? ', v bagu zbývá ' + fmt(c.left) : '') + '.', 'good');
      if (c.left < 1) done(ld); else { ld.lift = 0.8; ld.tipped = false; }
      return true;
    }
    case 'returnBag': {
      const c = ld.carry, money = Math.round((c.left ?? SUPPLY[c.p].bag) * SUPPLY[c.p].price);
      G.money += money; G.flashT = 0.4; ld.carry = null;
      toast('Sklad vzal ' + SUPPLIES[c.p].bag + ' zpátky za ' + fmt(money) + ' Kč.');
      return true;
    }
    case 'palletProd':
      if (PRODUCTION.bakery.store - prodIn('bakery') < PALLET.flour) { toast('Pekárna má plný sklad.', 'bad'); return false; }
      prodTake('bakery', PALLET.flour);
      toast('Paleta mouky je v pekárně.', 'good'); done(ld); return true;
    case 'sellPallet': G.money += a.money; earn(a.money); G.flashT = 0.4; toast('Tržnice koupila paletu (' + PALLETS[ld.carry.p].label + ') za ' + fmt(a.money) + ' Kč.', 'good'); done(ld); return true;
    case 'palletNowhere': toast(isSupply(ld.carry.p) ? 'Big bag vysyp do zásobníku secího stroje, rozmetadla nebo postřikovače (najeď k němu), nebo ho polož na přívěs.' : 'Paletu polož na prázdný přívěs, nebo ji prodej v tržnici v městečku.', 'bad'); return false;
    case 'bucketTrailer': {
      const c = ld.carry, t = a.t;
      if (c.what === 'crop') { const l = Math.min(c.l, t.tank.cap - t.tank.amount); t.tank.crop = c.crop; t.tank.amount += l; c.l -= l; }
      else { const l = Math.min(c.l, t.tank.cap - forageIn(t)); t.forage = { kind: c.what, l: forageIn(t) + l }; c.l -= l; }
      tipped(ld, c);
      return true;
    }
    case 'bucketSpreader': { const c = ld.carry, l = Math.min(c.l, a.im.loadCap - a.im.load); a.im.load += l; c.l -= l; tipped(ld, c); return true; }
    case 'bucketBack': G.farm.manure = Math.min(DUNG.manureCap, G.farm.manure + ld.carry.l); ld.carry = null; return true;
    case 'bucketCows': { const c = ld.carry, l = deliverForage('cows', 'silage', c.l, {}); c.l -= l; if (!l) { toast('Krmelec u kravína je plný.', 'bad'); return false; } tipped(ld, c); return true; }
    case 'bucketFeed': { const c = ld.carry, l = Math.min(c.l, space(a.m.feed)); addFeed(a.m.feed, l, partOf(c.crop)); c.l -= l; tipped(ld, c); toast('Do krmelce ' + fmt(l) + ' l ' + CROPS[c.crop].gen + ' · ' + a.m.short, 'good'); return true; }
    case 'feedFull': toast('Krmelec (' + BUILDINGS[a.m.feed].name + ') je plný.', 'bad'); return false;
    case 'bucketSell': {
      const c = ld.carry, money = sale(a.m, c.crop, c.l);
      G.money += money; earn(money); G.flashT = 0.4;
      toast('Prodáno ' + fmt(c.l) + ' l ' + CROPS[c.crop].gen + ' za ' + fmt(money) + ' Kč · ' + a.m.name, 'good');
      c.l = 0; tipped(ld, c);
      return true;
    }
    case 'bucketGround': { const c = ld.carry; addToHeap(p.x, p.z, c.what, c.crop, c.l); c.l = 0; tipped(ld, c); return true; }
  }
  return false;
}
const done = ld => { if (ld.carry?.kind === 'bale' && ld.carry.bales.length) return; ld.carry = null; ld.lift = 0.9; ld.tipped = false; };
/** After tipping the bucket: up and tilted for a moment, empty unless something is left. */
function tipped(ld, c) { ld.lift = 0.9; ld.tipped = true; if (c.l < 1) ld.carry = null; }

const palletName = p => (isSupply(p) ? SUPPLIES[p].bag : 'paleta ' + PALLETS[p].label);
/** "2 balíky sena", "big bag osiva", "1 800 l pšenice": what the loader carries. */
export function carryText(c) {
  if (!c) return 'prázdný';
  if (c.kind === 'bale') { const k = c.bales[0]; return nBales(c.bales.length) + ' ' + (c.bales.every(x => x === k) ? BALE_NAME[k] : ''); }
  if (c.kind === 'pallet') return palletName(c.p) + (c.left != null ? ' · zbývá ' + fmt(c.left) + ' ' + SUPPLIES[c.p].unit : '');
  return fmt(c.l) + ' l ' + heapName(c);
}
/** HUD prompt for the action. */
export function lPrompt(v) {
  const a = lAction(v);
  if (!a) return null;
  const c = v.ld.carry;
  switch (a.kind) {
    case 'grabBales': return 'Vzít ' + nBales(a.n);
    case 'takePallet': return 'Vzít z přívěsu: ' + palletName(a.p);
    case 'takeStock': return 'Vzít paletu: ' + PALLETS[a.p].label + ' · připraveno ' + palletsReady(a.p);
    case 'takeBag': return 'Koupit ' + SUPPLIES[a.p].bag + ' za ' + fmt(a.cost) + ' Kč · C jiný';
    case 'scoop': return 'Nabrat ' + fmt(a.l) + ' l ' + heapName(a.h);
    case 'scoopManure': return 'Nabrat ' + fmt(a.l) + ' l hnoje';
    case 'scoopSilage': return 'Nabrat ' + fmt(a.l) + ' l siláže';
    case 'balesTrailer': return 'Naložit ' + nBales(c.bales.length) + ' na přívěs';
    case 'balesFeed': return 'Dát balíky do krmelce · ' + a.m.short;
    case 'dropBales': return 'Položit ' + nBales(c.bales.length) + ' na zem';
    case 'palletTrailer': return 'Položit na přívěs: ' + palletName(c.p);
    case 'palletHopper': return 'Vysypat do zásobníku: ' + SUPPLIES[c.p].gen;
    case 'returnBag': return 'Vrátit do skladu';
    case 'sellPallet': return 'Prodat paletu za ' + fmt(a.money) + ' Kč';
    case 'palletProd': return 'Mouku do pekárny';
    case 'palletNowhere': return null;
    case 'bucketTrailer': return 'Vysypat do přívěsu: ' + fmt(c.l) + ' l';
    case 'bucketSpreader': return 'Naložit hnůj do rozmetadla';
    case 'bucketBack': return 'Vrátit hnůj na hnojiště';
    case 'bucketCows': return 'Siláž do krmelce · Kravín';
    case 'bucketFeed': return 'Do krmelce · ' + a.m.short;
    case 'feedFull': return 'Krmelec je plný';
    case 'bucketSell': return 'Prodat ' + fmt(c.l) + ' l za ' + fmt(c.l * marketPrice(a.m, c.crop, G.gameMin)) + ' Kč';
    case 'bucketGround': return 'Vysypat na hromadu';
  }
  return null;
}
