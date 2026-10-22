import { fmt } from '../core/util.js';
import { G, dayOf } from './state.js';
import { CROPS } from './crops.js';
import { has } from './machines.js';
import { FIELDS } from '../world/fields.js';
import { toast } from '../ui/toast.js';

/**
 * Goals give the farm a direction: a sequence of tasks with a cash reward each. The first three
 * unfinished ones are active; finishing one pays out and opens the next. Statistics feed them.
 * Field cells are 1 m², so 10 000 cells = 1 ha; a field is about 0,23 ha (50 × 45 m).
 */
export const emptyStats = () => ({
  harvest: CROPS.map(() => 0), // litres harvested for yourself, per crop
  cult: 0, plough: 0, sown: 0, fert: 0, // m² worked (own fields and contracts)
  bales: 0, hay: 0, mown: 0, trees: 0, wood: 0, contracts: 0, deliveries: 0,
  earned: 0, // Kč from sales and contracts (not loans, not selling machines)
});

/** Called from the game wherever something worth counting happens. */
export function stat(key, n = 1, crop = -1) {
  const s = G.stats;
  if (key === 'harvest') s.harvest[crop] += n;
  else s[key] += n;
}
export const earn = kc => { G.stats.earned += kc; };

const ha = m2 => String((m2 / 10000).toFixed(2)).replace('.', ',') + ' ha';
const l = n => fmt(n) + ' l';
const kc = n => fmt(n) + ' Kč';
const owned = () => FIELDS.filter(f => f.owned).length;
const cropsHarvested = () => G.stats.harvest.filter(x => x > 0).length;

/** cur() and target give the progress; fmt formats both for the progress line. */
export const GOALS = [
  { id: 'wheat', title: 'První žně', desc: 'Skliď 15 000 l pšenice.', target: 15000, cur: () => G.stats.harvest[0], fmt: l, reward: 30000 },
  { id: 'sell', title: 'Na trh', desc: 'Vydělej prodejem 100 000 Kč.', target: 100000, cur: () => G.stats.earned, fmt: kc, reward: 20000 },
  { id: 'cult', title: 'Připravená půda', desc: 'Zkultivuj nebo zoři 0,4 ha strniště.', target: 4000, cur: () => G.stats.cult + G.stats.plough, fmt: ha, reward: 25000 },
  { id: 'sow', title: 'Zaseto', desc: 'Osej 0,4 ha.', target: 4000, cur: () => G.stats.sown, fmt: ha, reward: 30000 },
  { id: 'contract', title: 'Dobrý soused', desc: 'Dokonči zakázku pro souseda.', target: 1, cur: () => G.stats.contracts, fmt: fmt, reward: 25000 },
  { id: 'bales', title: 'Sláma pod střechou', desc: 'Slisuj 10 balíků slámy.', target: 10, cur: () => G.stats.bales, fmt: fmt, reward: 30000 },
  { id: 'hay', title: 'Seno na zimu', desc: 'Kup žací lištu, poseč louku a slisuj 5 balíků sena.', target: 5, cur: () => G.stats.hay, fmt: fmt, reward: 45000 },
  { id: 'field', title: 'Další pole', desc: 'Kup třetí pole (u cedule klávesou F nebo v Kanceláři).', target: 3, cur: owned, fmt: fmt, reward: 60000 },
  { id: 'animals', title: 'Hospodář', desc: 'Kup kravín nebo kurník.', target: 1, cur: () => (has('cows') || has('hens') ? 1 : 0), fmt: fmt, reward: 40000 },
  { id: 'fert', title: 'Výživa', desc: 'Pohnoj 0,6 ha.', target: 6000, cur: () => G.stats.fert, fmt: ha, reward: 25000 },
  { id: 'crops', title: 'Pestrý osevní postup', desc: 'Skliď čtyři různé plodiny.', target: 4, cur: cropsHarvested, fmt: fmt, reward: 80000 },
  { id: 'trees', title: 'Dřevař', desc: 'Pokácej 10 stromů harvestorem.', target: 10, cur: () => G.stats.trees, fmt: fmt, reward: 60000 },
  { id: 'contracts5', title: 'Spolehlivý', desc: 'Dokonči 5 zakázek.', target: 5, cur: () => G.stats.contracts, fmt: fmt, reward: 100000 },
  { id: 'fields5', title: 'Velkostatek', desc: 'Vlastni 5 polí.', target: 5, cur: owned, fmt: fmt, reward: 150000 },
  { id: 'year', title: 'Celý rok', desc: 'Hospodař celý rok (12 dní).', target: 12, cur: () => dayOf(G.gameMin), fmt: n => fmt(n) + ' d', reward: 100000 },
  { id: 'million', title: 'Milion z polí', desc: 'Vydělej prodejem celkem 1 000 000 Kč.', target: 1000000, cur: () => G.stats.earned, fmt: kc, reward: 150000 },
  { id: 'fields12', title: 'Statkář', desc: 'Vlastni 12 polí nebo luk.', target: 12, cur: owned, fmt: fmt, reward: 400000 },
  { id: 'fieldsAll', title: 'Celý kraj', desc: 'Vlastni všech 26 polí a luk.', target: 26, cur: owned, fmt: fmt, reward: 1500000 },
];
export const ACTIVE_COUNT = 3;

export const progressOf = g => Math.min(1, Math.max(0, g.cur() / g.target));
export const isDone = g => G.goals.includes(g.id);
export const activeGoals = () => GOALS.filter(g => !isDone(g)).slice(0, ACTIVE_COUNT);
export const progressText = g => g.fmt(Math.min(g.target, Math.floor(g.cur()))) + ' / ' + g.fmt(g.target);

/** A few times a second: pays out every active goal that is complete. Returns true if one was. */
export function checkGoals() {
  let any = false;
  for (const g of activeGoals()) {
    if (progressOf(g) < 1) continue;
    G.goals.push(g.id);
    G.money += g.reward; G.flashT = 0.4;
    toast('Cíl splněn: ' + g.title + ' · odměna ' + fmt(g.reward) + ' Kč', 'good');
    any = true;
  }
  return any;
}

/** Loads saved stats; anything missing or invalid starts at zero. */
export function loadStats(d) {
  const s = emptyStats();
  if (d && typeof d === 'object') {
    for (const k in s) {
      if (k === 'harvest') s.harvest = s.harvest.map((_, i) => Math.max(0, +d.harvest?.[i] || 0));
      else s[k] = Math.max(0, +d[k] || 0);
    }
  }
  return s;
}
export const loadGoals = d => (Array.isArray(d) ? d.filter(id => GOALS.some(g => g.id === id)) : []);
