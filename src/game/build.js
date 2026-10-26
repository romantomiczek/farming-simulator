import { G } from './state.js';
import { BUILDS } from './balance.js';
import { fmt } from '../core/util.js';
import { toast } from '../ui/toast.js';
import { FIELDS, fieldAt, refreshField, applyMask } from '../world/fields.js';
import { S_NONE, S_STUB } from './crops.js';
import { addBox, boxes, nearShapes, roadAt, inRect, BUILD_LAND } from '../world/layout.js';
import { vehicles, tools } from '../vehicles/vehicles.js';
import { groundH } from '../world/terrain.js';
import { extraSilo, SILO_CAP } from './silo.js';
import { HERD } from './balance.js';
import { extraCap } from './animals.js';
import { place, unplace, showGhost } from '../world/placed.js';

/**
 * Building on your own land, as in Farming Simulator: silos, a machine shed, a cow shed and the
 * production buildings (game/production.js) stand wherever the player puts them, on his own fields or
 * on the building plot by the village street (BUILD_LAND), not over roads, buildings, trees or machines.
 * Build mode (office → Stavby, or B) shows the building in front of you: R turns it, F builds it, Esc
 * leaves. On a field the cells under it stop being part of the field until it is pulled down again.
 * G.built = [{ id, type, x, z, rot }]; rot = quarter turns, the door and its ring face local +z.
 */
export const BUILD_INFO = {
  silo: { name: 'Obilné silo', mine: 'Tvoje silo', desc: 'Dalších ' + fmt(BUILDS.silo.silo) + ' l v silech statku. Uskladníš do něj úrodu klávesou G a naložíš z něj klávesou F, obojí v kruhu před ním.' },
  shed: { name: 'Strojní kůlna', mine: 'Tvoje kůlna', desc: 'Další dílna: uvnitř opravíš stroj (R), vyměníš adaptér kombajnu a nasadíš čelní nakladač.' },
  cowshed: { name: 'Kravín', mine: 'Tvůj kravín', desc: 'Místo pro dalších ' + BUILDS.cowshed.cows + ' krav: stádo z kravína se rozroste víc (krmí se a dojí dál v kravíně u statku). Potřebuje kravín.' },
  mill: { name: 'Mlýn', mine: 'Tvůj mlýn', desc: 'Mele pšenici a ječmen na mouku: 800 l obilí za hodinu dá 600 kg mouky na paletách. Mouku prodáš v tržnici, nebo ji upečeš v pekárně.' },
  bakery: { name: 'Pekárna', mine: 'Tvoje pekárna', desc: 'Peče chléb z mouky (palety z tvého mlýna): 300 kg mouky za hodinu dá 400 bochníků. Chléb prodáš v tržnici.' },
  oilmill: { name: 'Olejna', mine: 'Tvoje olejna', desc: 'Lisuje řepku a slunečnici na olej: 400 l semen za hodinu dá 160 l oleje na paletách.' },
  sawmill: { name: 'Pila', mine: 'Tvoje pila', desc: 'Řeže kulatinu z harvestoru (F v kruhu před pilou) na prkna: 2 m³ za hodinu dají 1,5 m³ prken.' },
};
export const BUILD_KEYS = Object.keys(BUILD_INFO);
const live = new Map(); // id → { p: the model (placed.js), boxes: collision boxes, cells: [[field, cell]] }

export const builtOf = type => G.built.filter(b => b.type === type);
const half = (type, rot) => { const s = BUILDS[type], odd = rot % 2; return [(odd ? s.d : s.w) / 2, (odd ? s.w : s.d) / 2]; };
const rect = (type, x, z, rot, m = 0) => { const [hx, hz] = half(type, rot); return { x0: x - hx - m, x1: x + hx + m, z0: z - hz - m, z1: z + hz + m }; };
export const rectOf = b => rect(b.type, b.x, b.z, b.rot);
const frontOf = rot => [Math.sin((rot * Math.PI) / 2), Math.cos((rot * Math.PI) / 2)];
/** The ring in front of building b's door: where F unloads, loads pallets, stores. */
export function ringOf(b) {
  const [fx, fz] = frontOf(b.rot), k = BUILDS[b.type].d / 2 + 5;
  return { x: b.x + fx * k, z: b.z + fz * k, r: 5 };
}
/** Inside a shed the player built (repairs, headers, the front loader)? */
export const inBuiltShed = v => builtOf('shed').some(b => inRect(v.x, v.z, rectOf(b), -1));
const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
/** Your land: your own fields and meadows, and the building plot east of the farm (where no neighbour's field lies). */
export const ownLand = (x, z) => { const f = fieldAt(x, z); return f ? f.owned : BUILD_LAND.some(r => inRect(x, z, r)); };

/** Can building type stand at x, z turned rot? { ok, why, field: cells of a field it would take, y }. */
export function check(type, x, z, rot) {
  const s = BUILDS[type], r = rect(type, x, z, rot), info = BUILD_INFO[type];
  if (builtOf(type).length >= s.max) return { ok: false, why: info.name + ': víc jich postavit nejde (nejvíc ' + s.max + ').' };
  if (type === 'cowshed' && !G.machines.cows) return { ok: false, why: 'Kravín rozšiřuje stádo z kravína u statku. Nejdřív kup kravín (Obchod → Budovy).' };
  if (G.money < s.price) return { ok: false, why: 'Na stavbu ti chybí ' + fmt(s.price - G.money) + ' Kč.' };
  let field = 0, lo = Infinity, hi = -Infinity;
  for (let px = r.x0; px <= r.x1 + 1e-6; px += Math.min(2, (r.x1 - r.x0) / 2)) {
    for (let pz = r.z0; pz <= r.z1 + 1e-6; pz += Math.min(2, (r.z1 - r.z0) / 2)) {
      if (!ownLand(px, pz)) return { ok: false, why: 'Stavět můžeš jen na svém: na svých polích a na stavebním pozemku u vesnické silnice, za polem 5.' };
      if (roadAt(px, pz, 1)) return { ok: false, why: 'Přes cestu stavět nejde.' };
      const f = fieldAt(px, pz);
      if (f) field++;
      const y = groundH(px, pz); lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
  }
  if (hi - lo > 1.6) return { ok: false, why: 'Tady je moc velký svah.' };
  let hit = null;
  const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, R = Math.hypot(r.x1 - r.x0, r.z1 - r.z0) / 2 + 1;
  nearShapes(cx, cz, R, c => { if (!hit && Math.hypot(c.x - Math.max(r.x0, Math.min(c.x, r.x1)), c.z - Math.max(r.z0, Math.min(c.z, r.z1))) < c.r + 0.3) hit = 'Překáží tu strom nebo stavba.'; },
    b => { if (!hit && !b.off && overlap(b, rect(type, x, z, rot, 0.3))) hit = 'Překáží tu jiná stavba.'; });
  if (hit) return { ok: false, why: hit };
  for (const b of G.built) if (overlap(rectOf(b), rect(type, x, z, rot, 2))) return { ok: false, why: 'Je to moc blízko jiné tvé stavby.' };
  for (const p of [...vehicles, ...tools]) { const q = p.type || p.trailed ? p : p.on || p; if (inRect(q.x, q.z, r, 1.5)) return { ok: false, why: 'Stojí tu stroj. Odjeď s ním.' }; }
  return { ok: true, why: field ? 'Budova zabere ' + Math.round(field * 4) + ' m² pole.' : '', y: lo };
}

/** Builds everything in G.built again: models, collisions, the cells of fields under them, extra silo room and herd places. */
export function syncBuilt(refresh = false) {
  const touched = new Set();
  for (const L of live.values()) { unplace(L.p); for (const b of L.boxes) b.off = true; for (const [f] of L.cells) touched.add(f); }
  live.clear();
  for (const f of FIELDS) if (f.built) f.built.fill(0);
  for (const b of G.built) {
    const s = BUILDS[b.type], r = rectOf(b), y = Math.min(...[[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]].map(([x, z]) => groundH(x, z)));
    const p = place(b, y, s.w, s.d), bx = [], cells = [];
    if (b.type === 'shed') { // open at the front: machines drive in
      const [fx, fz] = frontOf(b.rot), t = 0.5;
      const walls = [[r.x0, r.x0 + t, r.z0, r.z1], [r.x1 - t, r.x1, r.z0, r.z1], [r.x0, r.x1, r.z0, r.z0 + t], [r.x0, r.x1, r.z1 - t, r.z1]];
      const open = fx > 0.5 ? 1 : fx < -0.5 ? 0 : fz > 0.5 ? 3 : 2; // the wall on the side the front faces stays open
      walls.forEach((w, k) => { if (k !== open) { addBox(...w); bx.push(boxes[boxes.length - 1]); } });
    } else { addBox(r.x0, r.x1, r.z0, r.z1); bx.push(boxes[boxes.length - 1]); }
    // the field cells under it (and half a metre round) leave the field
    for (const f of FIELDS) {
      if (!overlap(r, { x0: f.x0 - 1, x1: f.x0 + f.w + 1, z0: f.z0 - 1, z1: f.z0 + f.h + 1 })) continue;
      f.built ||= new Uint8Array(f.n);
      for (let iz = Math.max(0, Math.floor(r.z0 - 0.5 - f.z0)); iz < Math.min(f.h, Math.ceil(r.z1 + 0.5 - f.z0)); iz++) {
        for (let ix = Math.max(0, Math.floor(r.x0 - 0.5 - f.x0)); ix < Math.min(f.w, Math.ceil(r.x1 + 0.5 - f.x0)); ix++) { const i = iz * f.w + ix; f.built[i] = 1; cells.push([f, i]); }
      }
      touched.add(f);
    }
    live.set(b.id, { p, boxes: bx, cells });
  }
  for (const f of touched) { applyMask(f); f.area = f.n - f.state.reduce((a, s) => a + (s === S_NONE ? 1 : 0), 0); if (refresh) refreshField(f); }
  extraSilo.cap = builtOf('silo').length * BUILDS.silo.silo;
  extraSilo.loads = builtOf('silo').map(ringOf);
  extraCap.cows = builtOf('cowshed').length * BUILDS.cowshed.cows;
}

let seq = 0;
/** Puts up building type at x, z turned rot (checked first). */
export function construct(type, x, z, rot) {
  const c = check(type, x, z, rot);
  if (!c.ok) { toast(c.why, 'bad'); return false; }
  const s = BUILDS[type];
  G.money -= s.price; G.flashT = 0.4;
  for (const b of G.built) seq = Math.max(seq, +String(b.id).slice(1) || 0);
  G.built.push({ id: 'b' + ++seq, type, x, z, rot });
  syncBuilt(true);
  toast(BUILD_INFO[type].name + ' stojí, stálo ' + fmt(s.price) + ' Kč.' + (type !== 'shed' && type !== 'cowshed' ? ' Pracuje se s ním v kruhu před vraty (F).' : ''), 'good');
  return true;
}
/** Why building b cannot come down now, or null. */
export function demolishBlock(b) {
  if (b.type === 'silo') { const now = G.silo.stock.reduce((a, l) => a + l, 0); if (now > SILO_CAP + (builtOf('silo').length - 1) * BUILDS.silo.silo) return 'V silech je víc, než by se po zbourání vešlo. Nejdřív část prodej.'; }
  if (b.type === 'cowshed') { const h = G.farm.herd?.cows; if (h && h.n > HERD.cows.cap + (builtOf('cowshed').length - 1) * BUILDS.cowshed.cows) return 'Bez něj by se stádo do kravína nevešlo. Nejdřív prodej část krav.'; }
  return null;
}
/** Pulls building id down: refund of part of the price, a field gets its cells back as stubble. */
export function demolish(id) {
  const b = G.built.find(x => x.id === id), why = b && demolishBlock(b);
  if (!b || why) { if (why) toast(why, 'bad'); return false; }
  const back = Math.round(BUILDS[b.type].price * BUILDS.refund);
  for (const [f, i] of live.get(id)?.cells || []) {
    f.built[i] = 0;
    if (!f.mask || f.mask[i]) { f.state[i] = S_STUB; f.crop[i] = 0; f.growth[i] = 0; f.stage[i] = 0; f.bonus[i] = 0; f.straw[i] = 0; f.dmg[i] = 0; }
  }
  G.built.splice(G.built.indexOf(b), 1);
  G.money += back; G.flashT = 0.4;
  syncBuilt(true);
  for (const f of FIELDS) refreshField(f);
  toast(BUILD_INFO[b.type].name + ' zbourána. Vrátilo se ' + fmt(back) + ' Kč.', 'good');
  return true;
}
/** Saved buildings, checked. */
export const loadBuilt = list => (Array.isArray(list) ? list : []).filter(b => b && BUILD_INFO[b.type] && Number.isFinite(b.x) && Number.isFinite(b.z))
  .map((b, k) => ({ id: typeof b.id === 'string' ? b.id : 'b' + (k + 1), type: b.type, x: b.x, z: b.z, rot: ((b.rot | 0) % 4 + 4) % 4 }));

/* ---------- build mode ---------- */
/** The building being placed: type, turn, where it would stand, and whether it can (check). */
export const BM = { type: null, rot: 0, x: 0, z: 0, c: null, t: 0 };
export const buildActive = () => !!BM.type;
export function startBuild(type) {
  if (!BUILD_INFO[type]) return false;
  if (builtOf(type).length >= BUILDS[type].max) { toast(BUILD_INFO[type].name + ': víc jich postavit nejde.', 'bad'); return false; }
  Object.assign(BM, { type, c: null, t: 0 });
  toast('Stavba: ' + BUILD_INFO[type].name + '. Najeď nebo dojdi, kam ji chceš (zelený náhled), R ji otočí, F postaví, Esc zruší.');
  return true;
}
export function stopBuild() { BM.type = null; showGhost(false); }
/** Every frame in build mode: the building stands a little in front of who (the farmer or the machine). */
export function updBuild(dt, who) {
  if (!BM.type) return;
  const s = BUILDS[BM.type], [, hz] = half(BM.type, BM.rot), [hx] = half(BM.type, BM.rot);
  const reach = Math.max(hx, hz) + (who.bodyPart ? who.bodyPart.hz + who.bodyPart.cz : 1) + 3;
  BM.x = Math.round(who.x + Math.sin(who.h) * reach); BM.z = Math.round(who.z + Math.cos(who.h) * reach);
  if ((BM.t -= dt) <= 0 || !BM.c) { BM.t = 0.15; BM.c = check(BM.type, BM.x, BM.z, BM.rot); }
  const y = BM.c.y ?? groundH(BM.x, BM.z), odd = BM.rot % 2;
  showGhost(true, BM.x, y, BM.z, odd ? s.d : s.w, odd ? s.w : s.d, BM.type === 'silo' ? 15 : 6, 0, BM.c.ok, BM.type !== 'shed' && BM.type !== 'cowshed' ? ringOf(BM) : null);
}
/** Keys in build mode: R turns, F or Enter builds, Esc or B leaves. True when the key was used. */
export function buildKey(code) {
  if (!BM.type) return false;
  if (code === 'KeyR') { BM.rot = (BM.rot + 1) % 4; BM.c = null; return true; }
  if (code === 'Escape' || code === 'KeyB') { stopBuild(); toast('Stavba zrušena.'); return true; }
  if (code === 'KeyF' || code === 'Enter') { if (construct(BM.type, BM.x, BM.z, BM.rot)) stopBuild(); return true; }
  return false;
}
