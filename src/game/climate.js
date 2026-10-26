import { G, dayOf } from './state.js';
import { WX, slotOf, isWinter } from './weather.js';
import { FIELDS } from '../world/fields.js';
import { S_SOWN, S_RIPE } from './crops.js';
import { hash2 } from '../core/util.js';
import { toast } from '../ui/toast.js';

/**
 * What the weather does to the crops, as in Farming Simulator 25. Hail (some of the thunderstorms)
 * knocks down part of the growing and the ripe crop on most fields it crosses, HAIL per cent a cell;
 * a summer drought day takes DROUGHT_PER_H per cent an hour from the growing crops. The loss is kept
 * per cell (f.dmg, per cent, at most MAX_LOSS), shows in the yield breakdown as "Počasí" and goes
 * with the harvest or the next sowing. Meadows are not hurt.
 */
const HAIL = { chance: 0.65, min: 8, max: 30 }, DROUGHT_PER_H = 0.9, MAX_LOSS = 70;
let hailSlot = -1, dryAcc = 0, dryDay = -1;

/** Every frame with the game minutes that passed, in hours. */
export function climateTick(dh) {
  if (isWinter()) { dryAcc = 0; return; }
  if (WX.kind === 'hail') {
    const slot = slotOf(G.gameMin);
    if (slot !== hailSlot) { hailSlot = slot; hail(slot); }
  }
  if (!WX.drought) { dryAcc = 0; return; }
  const day = dayOf(G.gameMin);
  if (dryDay !== day) { dryDay = day; toast('Sucho: dnes nezaprší a rostoucí plodiny ztrácejí výnos, každou hodinu kousek. Zralé sklízej hned.', 'bad'); }
  dryAcc += dh;
  if (dryAcc >= 1) { const h = Math.floor(dryAcc); dryAcc -= h; drought(h); }
}

/** A hail storm: most fields get hit, the cells with a crop lose HAIL.min–max per cent. */
export function hail(slot = slotOf(G.gameMin)) {
  const hit = [];
  for (const f of FIELDS) {
    if (f.meadow || hash2(f.id * 7.3 + slot * 0.37, 2.9) > HAIL.chance) continue;
    let n = 0, sum = 0;
    for (let i = 0; i < f.n; i++) {
      const s = f.state[i];
      if (!(s === S_RIPE || (s === S_SOWN && f.stage[i] >= 1))) continue;
      const was = f.dmg[i], d = HAIL.min + (HAIL.max - HAIL.min) * ((f.jit[i] * 13.7 + slot * 0.61) % 1);
      f.dmg[i] = Math.min(MAX_LOSS, was + Math.round(d));
      n++; sum += f.dmg[i] - was;
    }
    if (f.owned && n > f.area * 0.05) hit.push({ id: f.id, loss: sum / n });
  }
  if (hit.length) toast('Krupobití potlouklo úrodu na ' + (hit.length === 1 ? 'poli ' : 'polích ') + hit.map(h => h.id).join(', ') + ' (výnos asi −' + Math.round(hit.reduce((a, h) => a + h.loss, 0) / hit.length) + ' %).', 'bad');
  else toast('Padají kroupy. Tvoje plodiny tentokrát nezasáhly.');
  return hit;
}

/** h hours of drought on the growing crops. */
function drought(h) {
  for (const f of FIELDS) {
    if (f.meadow || (f.counted && !f.cnt[S_SOWN])) continue;
    for (let i = 0; i < f.n; i++) {
      if (f.state[i] !== S_SOWN || f.dmg[i] >= MAX_LOSS) continue;
      f.dmg[i] = Math.min(MAX_LOSS, f.dmg[i] + Math.floor(DROUGHT_PER_H * h + ((f.jit[i] * 7.7 + G.gameMin * 0.013) % 1)));
    }
  }
}
