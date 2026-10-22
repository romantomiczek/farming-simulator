import { G } from './state.js';
import { SILAGE } from './balance.js';
import { fmt } from '../core/util.js';
import { toast } from '../ui/toast.js';
import { earn } from './goals.js';
import { BUNKER, COW_PEN, BUYER_AT } from '../world/layout.js';
import { has } from './machines.js';
import { space, addFeed } from './farm.js';

/**
 * Silage, the team job of Farming Simulator. Chaff (chopped maize from the chopper, chopped grass
 * from the forage wagon or the chopper's pickup) goes in a trailer; it is tipped in the bunker silo
 * north of the cow shed, packed by driving over it, covered with a sheet (F in the bunker's ring)
 * and ferments for SILAGE.fermentH game hours into silage. Silage feeds the cows (tipped in their
 * ring, it counts as roughage in the feed mix) or goes to the biogas plant at the sugar factory;
 * so does fresh chaff, for less. Trailers carry it in t.forage = { kind: 'chaff' | 'silage', l }.
 */
export const emptyBunker = () => ({ chaff: 0, packed: 0, covered: false, ferment: 0, silage: 0 });
const bk = () => G.farm.bunker;
export const inBunker = p => p.x > BUNKER.x0 && p.x < BUNKER.x1 && p.z > BUNKER.z0 && p.z < BUNKER.z1;
export const atBunkerRing = p => Math.hypot(p.x - BUNKER.ring.x, p.z - BUNKER.ring.z) < BUNKER.ring.r;
export const atCows = p => has('cows') && Math.hypot(p.x - COW_PEN.feed.x, p.z - COW_PEN.feed.z) < COW_PEN.feed.r;
const BIOGAS = BUYER_AT.sugar;
export const atBiogas = p => Math.hypot(p.x - BIOGAS.x, p.z - BIOGAS.z) < 8;
export const foragePrice = kind => (kind === 'silage' ? SILAGE.silagePrice : SILAGE.chaffPrice);
export const forageName = kind => (kind === 'silage' ? 'siláže' : 'řezanky');
/** Litres of forage in trailer t (0 when it carries none). */
export const forageIn = t => t?.forage?.l || 0;
/** Can trailer t take amt litres of chaff (it carries nothing else)? */
export const takesChaff = t => !t.tank.amount && !t.bales && !t.pallets.length && (!forageIn(t) || t.forage.kind === 'chaff');
/** Puts amt litres of chaff into trailer t, as far as it fits; returns what went in. */
export function addChaff(t, amt) {
  const take = Math.max(0, Math.min(amt, t.tank.cap - forageIn(t)));
  if (take > 0) t.forage = { kind: 'chaff', l: forageIn(t) + take };
  return take;
}

/** Chaff into the bunker (it has to be open); returns how much went in. Fresh chaff loosens the heap. */
export function intoBunker(amt) {
  const b = bk();
  if (b.covered) return 0;
  const take = Math.min(amt, SILAGE.cap - b.chaff - b.silage);
  if (take <= 0) return 0;
  b.packed = (b.packed * b.chaff) / (b.chaff + take);
  b.chaff += take;
  return take;
}

/** Every frame: machines driving over the open heap pack it (heavier and faster = more), a bigger heap takes longer. */
export function packTick(dt, vehicles) {
  const b = bk();
  if (b.covered || b.chaff < 1 || b.packed >= 1) return;
  for (const v of vehicles) {
    if (!inBunker(v) || Math.abs(v.speed) < 0.8) continue;
    const mass = v.harvester ? 1.6 : v.type === 'tractor' ? 1 + (v.hp || 100) / 300 : 0.4;
    b.packed = Math.min(1, b.packed + (dt * 0.035 * mass * Math.min(2, Math.abs(v.speed) / 3)) / (0.3 + b.chaff / 100000));
  }
}

/** Fermentation over dh game hours: a covered bunker turns its chaff into silage. */
export function forageTick(dh) {
  const b = bk();
  if (!b.covered || b.chaff < 1) return;
  b.ferment += dh;
  if (b.ferment >= SILAGE.fermentH) {
    b.silage += b.chaff; b.chaff = 0; b.covered = false; b.ferment = 0; b.packed = 0;
    toast('Siláž ve žlabu je hotová: ' + fmt(b.silage) + ' l. Nalož ji prázdným přívěsem v kruhu žlabu (F) a odvez kravám nebo do bioplynky.', 'good');
  }
}

/** What F does at the bunker's ring (t = the trailer you tow, or null on foot or in another machine). */
export function bunkerAction(t) {
  const b = bk();
  if (forageIn(t) && t.forage.kind === 'chaff') return b.covered ? { kind: 'bunkerShut' } : { kind: 'tipBunker', t };
  if (t && !forageIn(t) && !t.tank.amount && !t.bales && !t.pallets.length && b.silage >= 1 && !b.covered) return { kind: 'loadSilage', t, l: Math.min(b.silage, t.tank.cap) };
  if (!b.covered && b.chaff >= SILAGE.coverMin) return b.packed >= SILAGE.packNeed ? { kind: 'cover' } : { kind: 'packMore', p: b.packed };
  return null;
}
export function cover() {
  const b = bk();
  b.covered = true; b.ferment = 0;
  toast('Žlab je zakrytý plachtou. Za ' + SILAGE.fermentH + ' herních hodin z ' + fmt(b.chaff) + ' l řezanky vznikne siláž.', 'good');
}
export function loadSilage(t, l) {
  bk().silage -= l; t.forage = { kind: 'silage', l };
  toast('Naloženo ' + fmt(l) + ' l siláže. Vysyp ji u kravína (krmivo) nebo ji prodej v bioplynce u cukrovaru (F).', 'good');
}

/** Where trailer centre p could tip forage of kind: 'bunker', 'cows', 'biogas' or null. */
export function forageTarget(p, kind) {
  if (kind === 'chaff' && atBunkerRing(p) && !bk().covered) return 'bunker';
  if (kind === 'silage' && atCows(p)) return 'cows';
  if (atBiogas(p)) return 'biogas';
  return null;
}
/** Hands amt litres of forage of kind to target; returns how much was taken. who gathers the totals for the toast. */
export function deliverForage(target, kind, amt, who) {
  let take = 0;
  if (target === 'bunker') take = intoBunker(amt);
  else if (target === 'cows') { take = Math.min(amt, space('cows')); addFeed('cows', take, 'hay'); }
  else if (target === 'biogas') { take = amt; const money = take * foragePrice(kind); G.money += money; earn(money); G.flashT = 0.4; who.forageMoney = (who.forageMoney || 0) + money; }
  who.forageDone = (who.forageDone || 0) + take; who.forageTo = target; who.forageKind = kind;
  return take;
}
const TO = { bunker: 'do silážního žlabu', cows: 'do krmelce u kravína', biogas: 'v bioplynce' };
/** The toast after tipping forage; resets the totals. */
export function forageToast(who) {
  if (!(who.forageDone > 0)) return false;
  const what = fmt(who.forageDone) + ' l ' + forageName(who.forageKind);
  toast(who.forageTo === 'biogas' ? 'Prodáno ' + what + ' za ' + fmt(who.forageMoney) + ' Kč v bioplynce' : 'Vysypáno ' + what + ' ' + TO[who.forageTo] + (who.forageTo === 'bunker' ? ' · ' + bunkerState() : ''), 'good');
  who.forageDone = 0; who.forageMoney = 0;
  return true;
}

export const bunkerState = () => {
  const b = bk();
  if (b.covered) return 'zakrytý, kvasí · ' + Math.round((b.ferment / SILAGE.fermentH) * 100) + ' %';
  if (b.chaff >= 1) return 'řezanka ' + fmt(b.chaff) + ' l · udusáno ' + Math.round(b.packed * 100) + ' %' + (b.silage >= 1 ? ' · siláž ' + fmt(b.silage) + ' l' : '');
  return b.silage >= 1 ? 'siláž ' + fmt(b.silage) + ' l' : 'prázdný';
};
