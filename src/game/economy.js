import { fmt } from '../core/util.js';
import { G, dayOf } from './state.js';
import { repairCost, dailyLeaseCost } from './machines.js';
import { fuelZone } from '../world/layout.js';
import { toast, warn } from '../ui/toast.js';
import { vehicles } from '../vehicles/vehicles.js';

export const DIESEL = 36; // Kč/l
export const INTEREST_DAILY = 0.004; // 0,4 % of the loan per game day
export const LOAN_STEP = 100000;
export const LOAN_MAX = 1000000;
export const EMERGENCY = { liters: 60, price: 4500 };

export const inFuel = v => Math.hypot(v.x - fuelZone.x, v.z - fuelZone.z) < fuelZone.r;
export const refuelLiters = v => Math.max(0, Math.min(v.fuelCap - v.fuel, Math.floor(Math.max(0, G.money) / DIESEL)));

export function refuel(v) {
  const l = refuelLiters(v);
  if (l < 1) { toast(v.fuel >= v.fuelCap - 1 ? 'Nádrž je plná.' : 'Nemáš peníze na naftu.', 'bad'); return; }
  v.fuel += l; G.money -= l * DIESEL; G.flashT = 0.4;
  toast('Natankováno ' + fmt(l) + ' l nafty za ' + fmt(l * DIESEL) + ' Kč', 'good');
}

/** Emergency delivery to the active vehicle, so an empty tank never strands the player. */
export function emergencyFuel() {
  const v = G.active;
  if (G.money < EMERGENCY.price) { toast('Na dovoz nafty nemáš peníze. Zkus si půjčit.', 'bad'); return false; }
  G.money -= EMERGENCY.price; G.flashT = 0.4;
  v.fuel = Math.min(v.fuelCap, v.fuel + EMERGENCY.liters);
  toast('Dovezli ' + EMERGENCY.liters + ' l nafty do stroje ' + v.name + '.', 'good');
  return true;
}

/** Repair cost for the active vehicle plus its attached tool. */
export function repairQuote(v) {
  let c = repairCost(v.type);
  if (v.type === 'tractor') c += repairCost(v.impl);
  return c;
}
export function repair(v) {
  const c = repairQuote(v);
  if (c < 1) { toast('Stroj je v pořádku, není co opravovat.'); return; }
  if (G.money < c) { toast('Na opravu chybí ' + fmt(c - G.money) + ' Kč.', 'bad'); return; }
  G.money -= c; G.flashT = 0.4;
  G.cond[v.type] = 1;
  if (v.type === 'tractor') G.cond[v.impl] = 1;
  toast('Opraveno za ' + fmt(c) + ' Kč.', 'good');
}

export function takeLoan() {
  if (G.loan + LOAN_STEP > LOAN_MAX) { toast('Banka víc než ' + fmt(LOAN_MAX) + ' Kč nepůjčí.', 'bad'); return; }
  G.loan += LOAN_STEP; G.money += LOAN_STEP; G.flashT = 0.4;
}
export function repayLoan() {
  const a = Math.min(LOAN_STEP, G.loan);
  if (a <= 0) return;
  if (G.money < a) { toast('Na splátku nemáš dost peněz.', 'bad'); return; }
  G.loan -= a; G.money -= a; G.flashT = 0.4;
}
export const dailyInterest = () => Math.round(G.loan * INTEREST_DAILY);

/**
 * Fuel and wear of the vehicle the player drives and of vehicles driven by helpers
 * (the rest stand still). Litres per real second, so speeding up time does not burn more diesel.
 */
export function upkeep(dt) {
  for (const v of vehicles) if (v === G.active || v.helper) burn(v, dt, v === G.active);
}

function burn(v, dt, player) {
  const moving = Math.abs(v.speed) > 0.2, working = moving && v.lowered;
  const cond = G.cond[v.type] ?? 1;
  if (moving || v.thr) {
    const rate = (working ? v.fuelWork : v.fuelDrive) * (1 + (1 - cond) * 0.4);
    v.fuel = Math.max(0, v.fuel - rate * dt);
  }
  if (!player) { wearDown(v, dt, moving, working, cond); return; }
  if (v.fuel <= 0) warn('fuel', 'Došla nafta. Dovoz objednáš v Kanceláři (K), nebo dotlač stroj k čerpací stanici.');
  else if (v.fuel < v.fuelCap * 0.12) warn('fuelLow', 'Dochází nafta. Natankuješ u čerpací stanice vedle kůlny (F).', '');
  wearDown(v, dt, moving, working, cond);
  if (G.cond[v.type] < 0.3 && moving) warn('cond', 'Stroj je opotřebovaný (' + Math.round(G.cond[v.type] * 100) + ' %). Oprav ho v kůlně klávesou R.');
}

function wearDown(v, dt, moving, working, cond) {
  const wear = working ? 0.00006 : moving ? 0.00002 : 0; // ~22 % per hour of real field work
  if (!wear) return;
  G.cond[v.type] = Math.max(0, cond - wear * dt);
  if (working && v.type === 'tractor') G.cond[v.impl] = Math.max(0, (G.cond[v.impl] ?? 1) - wear * dt);
}

/** Charges leases and loan interest for every day that passed. Returns true on a new day. */
export function chargeDays() {
  const day = dayOf(G.gameMin);
  if (day <= G.lastDay) return false;
  const n = day - G.lastDay;
  G.lastDay = day;
  const lease = dailyLeaseCost() * n, interest = dailyInterest() * n;
  if (lease + interest > 0) {
    G.money -= lease + interest;
    const parts = [];
    if (lease) parts.push('leasing ' + fmt(lease) + ' Kč');
    if (interest) parts.push('úroky ' + fmt(interest) + ' Kč');
    toast('Den ' + (day + 1) + ': ' + parts.join(', '), G.money < 0 ? 'bad' : '');
  }
  return true;
}
