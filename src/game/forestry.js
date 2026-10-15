import { fmt, angDiff } from '../core/util.js';
import { G } from './state.js';
import { forester } from '../vehicles/vehicles.js';
import { trees, volume, nearestMature, startFell, stepFell } from '../world/forest.js';
import { SAWMILL } from '../world/layout.js';
import { toast } from '../ui/toast.js';
import { stat, earn } from './goals.js';

/** Felling with the harvester and selling wood at the sawmill. */
export const REACH = 9; // metres from the harvester to a tree it can cut
export const inSawmill = v => Math.hypot(v.x - SAWMILL.x, v.z - SAWMILL.z) < SAWMILL.r;
export const logPrice = t => Math.round(950 * (1 + 0.08 * Math.sin((t / 1440) * 2 * Math.PI / 2.7 + 0.9)));

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
  const p = logPrice(G.gameMin), money = Math.round(v.logs * p);
  G.money += money; earn(money); G.flashT = 0.4;
  toast('Pila koupila ' + String(v.logs.toFixed(1)).replace('.', ',') + ' m³ dřeva za ' + fmt(money) + ' Kč', 'good');
  v.logs = 0;
  onDone?.();
}
