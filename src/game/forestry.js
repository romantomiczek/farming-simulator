import { fmt, angDiff } from '../core/util.js';
import { G } from './state.js';
import { forester } from '../vehicles/vehicles.js';
import { trees, volume, nearestMature, startFell, stepFell } from '../world/forest.js';
import { WOOD_BUYERS } from '../world/layout.js';
import { toast } from '../ui/toast.js';
import { stat, earn } from './goals.js';
import { WOOD } from './balance.js';

/** Felling with the harvester and selling wood at the sawmill or the timber yard. */
export const REACH = 9; // metres from the harvester to a tree it can cut
/** The wood buyer whose ring v stands in, or null. */
export const woodBuyerAt = v => WOOD_BUYERS.find(b => Math.hypot(v.x - b.x, v.z - b.z) < b.r) || null;
export const inSawmill = v => !!woodBuyerAt(v);
/** Kč per m³ at buyer b (default: the sawmill) at game minute t. */
export const logPrice = (t, b = WOOD_BUYERS[0]) => Math.round(WOOD.pricePerM3 * b.mult * (1 + 0.08 * Math.sin((t / 1440) * 2 * Math.PI / 2.7 + b.phase)));
/** The buyer paying the most for wood right now: { b, p }. */
export function bestWood(t) {
  let best = null;
  for (const b of WOOD_BUYERS) { const p = logPrice(t, b); if (!best || p > best.p) best = { b, p }; }
  return best;
}

export function treeInReach(v) { return v.logs < v.logCap - 0.5 ? nearestMature(v.x, v.z, REACH) : -1; }

export function fell(v, i) {
  const t = trees[i];
  v.cutting = { i, vol: volume(t), ang: angDiff(v.h, Math.atan2(t.x - v.x, t.z - v.z)) };
  v.speed = 0;
  startFell(i, v.x, v.z);
}

/** Runs every frame: animates the falling tree and loads the wood when it is down. */
export function forestryTick(dt) {
  const v = forester, c = v.cutting;
  if (!c) return;
  if (!stepFell(c.i, dt)) return;
  const got = Math.min(c.vol, v.logCap - v.logs);
  v.logs = +(v.logs + got).toFixed(2);
  v.cutting = null;
  stat('trees'); stat('wood', got);
  toast('Pokáceno: ' + String(got.toFixed(1)).replace('.', ',') + ' m³ dřeva · v harvestoru ' + String(v.logs.toFixed(1)).replace('.', ',') + ' / ' + v.logCap + ' m³. Na místě vyroste nový strom.', 'good');
}

export function sellLogs(v, onDone) {
  const b = woodBuyerAt(v) || WOOD_BUYERS[0], p = logPrice(G.gameMin, b), money = Math.round(v.logs * p);
  G.money += money; earn(money); G.flashT = 0.4;
  toast(b.name + ' koupil' + (b.id === 'saw' ? 'a ' : ' ') + String(v.logs.toFixed(1)).replace('.', ',') + ' m³ dřeva za ' + fmt(money) + ' Kč', 'good');
  v.logs = 0;
  onDone?.();
}
