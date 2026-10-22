import { CROPS, GRASS, S_STUB, S_CULT, S_SOWN, S_RIPE, S_NONE, B_FERT, B_PLOW, B_FERT2, B_STONE } from '../game/crops.js';
import { weedLevel, LIME_DUE, yieldLine } from '../game/agro.js';
import { G } from '../game/state.js';
import { NEIGHBOURS, neighbourOf } from '../world/neighbours.js';
import { fmt, fmt2, hexRgb } from '../core/util.js';

/**
 * Views of the big map as in Farming Simulator: what grows where, how far it is, what each field
 * needs next and whose it is. Each view colours every 1 m cell of every field and says what the
 * colours mean (with the area of each in hectares). key = the view, name = its button.
 */
const cat = (label, hex) => ({ label, hex, rgb: hexRgb(hex) });
const CROP_COL = ['#e3c04f', '#d9a46a', '#f2e33a', '#4f9e44', '#f08c2a', '#a35fa0'];
export const VIEWS = [
  { key: 'map', name: 'Mapa' },
  {
    key: 'crop', name: 'Plodiny',
    cats: [...CROPS.map((c, k) => cat(c.name, CROP_COL[k])), cat('Tráva na louce', '#7fbf6a'), cat('Bez plodiny', '#cdc3a6')],
    of(f, i) {
      if (f.meadow) return CROPS.length;
      const s = f.state[i];
      return s === S_SOWN || s === S_RIPE ? f.crop[i] : CROPS.length + 1;
    },
  },
  {
    key: 'growth', name: 'Růst',
    cats: [cat('Zaseto', '#d8ecb0'), cat('Klíčí', '#a6d27a'), cat('Roste', '#6fb04f'), cat('Před zralostí', '#3f8a3a'), cat('Zralé', '#f0c22e'), cat('Nic neroste', '#cdc3a6'), cat('Přezrálé', '#8a6a3a')],
    of(f, i) {
      const s = f.state[i];
      if (f.meadow) return s === S_RIPE ? 4 : Math.min(3, Math.floor((f.growth[i] / GRASS.hours) * 4));
      if (s === S_RIPE) return f.stage[i] === 5 ? 6 : 4;
      if (s === S_SOWN) return Math.min(3, f.stage[i]);
      return 5;
    },
  },
  {
    key: 'soil', name: 'Stav půdy',
    cats: [cat('Kultivovat nebo zorat', '#d65a3a'), cat('Sláma nebo seno k lisování', '#e8c95a'), cat('Připraveno k setí', '#5a8fd6'), cat('Zoráno, k setí', '#3a63b0'),
      cat('Pohnojit', '#e8902a'), cat('Roste, hotovo', '#5aa64a'), cat('Sklidit / posekat', '#9b59b6'),
      cat('Postříkat plevel', '#c7e03a'), cat('Kameny: uválcovat', '#9a9a92'), cat('Vápnit (kyselá půda)', '#e8e0d0'), cat('Pohnojit podruhé', '#f2b86a'), cat('Přezrálé: sklidit hned', '#7a3a2a')],
    of(f, i) {
      const s = f.state[i], b = f.bonus[i];
      if (f.straw[i]) return 1;
      if (s === S_RIPE) return f.stage[i] === 5 ? 11 : 6;
      if (f.meadow) return 5;
      if (b & B_STONE) return 8;
      if (s === S_STUB) return 0;
      if (f.lime[i] >= LIME_DUE) return 9;
      if (s === S_CULT) return b & B_PLOW ? 3 : 2;
      if (weedLevel(f, i)) return 7;
      if (!(b & B_FERT)) return 4;
      return f.stage[i] >= 2 && !(b & B_FERT2) ? 10 : 5;
    },
  },
  {
    key: 'owner', name: 'Vlastnictví',
    cats: [cat('Tvoje', '#7ed957'), cat('Zakázka', '#3fb6e8'), ...NEIGHBOURS.map((n, k) => cat(n.name + ' · na prodej', ['#a58fd0', '#d08fae', '#e0a83a'][k]))],
    /** The whole field has one colour: yours, the contract field, or the neighbour who owns it (and sells it). */
    field(f) {
      if (f.owned) return 0;
      if (G.contracts.active?.field === f.id) return 1;
      return 2 + NEIGHBOURS.indexOf(neighbourOf(f.id));
    },
    of(f) { return this.field(f); },
  },
];
export const viewOf = key => VIEWS.find(v => v.key === key) || VIEWS[0];

/**
 * Paints field f in view v into its own small canvas (1 px per cell) and adds its cells to the
 * area of each category in area[]. Cells outside the outline stay transparent.
 */
export function paintField(f, v, area) {
  if (!f.vCanvas) {
    f.vCanvas = document.createElement('canvas'); f.vCanvas.width = f.w; f.vCanvas.height = f.h;
    f.vCtx = f.vCanvas.getContext('2d'); f.vImg = f.vCtx.createImageData(f.w, f.h);
  }
  const d = f.vImg.data, fieldCat = v.field?.(f);
  for (let i = 0; i < f.n; i++) {
    const o = i * 4;
    if (f.state[i] === S_NONE) { d[o + 3] = 0; continue; }
    const k = fieldCat ?? v.of(f, i), c = v.cats[k].rgb;
    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
    area[k]++;
  }
  f.vCtx.putImageData(f.vImg, 0, 0);
}

/** One line about field f for the map's info box: size, owner, what grows and what it needs. */
export function fieldInfo(f) {
  const ha = fmt2(f.area / 10000) + ' ha', job = G.contracts.active?.field === f.id;
  const who = f.owned ? 'tvoje' : job ? 'zakázka · ' + neighbourOf(f.id).name : 'patří: ' + neighbourOf(f.id).full + ' · na prodej za ' + fmt(f.price) + ' Kč';
  const c = f.cnt, share = k => Math.round((c[k] / Math.max(1, f.area)) * 100);
  let grow = '';
  if (f.meadow) grow = c[S_RIPE] > f.area * 0.4 ? 'tráva k posečení' : 'tráva roste';
  else if (c[S_SOWN] + c[S_RIPE] > 0) {
    let k0 = 0, best = -1;
    const counts = new Array(CROPS.length).fill(0);
    for (let i = 0; i < f.n; i += 7) if (f.state[i] === S_SOWN || f.state[i] === S_RIPE) counts[f.crop[i]]++;
    counts.forEach((n, k) => { if (n > best) { best = n; k0 = k; } });
    grow = CROPS[k0].name + (c[S_RIPE] ? ' · zralé ' + share(S_RIPE) + ' %' : ' · zralost ' + Math.round(f.prog * 100) + ' %');
  } else grow = c[S_STUB] > c[S_CULT] ? 'strniště' : 'zkultivováno';
  const need = [];
  if (f.strawCnt > 40) need.push(f.meadow ? 'slisovat seno' : 'slisovat slámu');
  if (!f.meadow && c[S_STUB] > f.area * 0.05) need.push('kultivovat ' + share(S_STUB) + ' %');
  if (!f.meadow && c[S_CULT] > f.area * 0.05) need.push('zasít ' + share(S_CULT) + ' %');
  if (!f.meadow && c[S_SOWN] > f.area * 0.3 && f.fertShare < 0.5) need.push('pohnojit');
  if (c[S_RIPE] > f.area * 0.05) need.push(f.meadow ? 'posekat' : 'sklidit');
  if (!f.meadow && f.weedShare > 0.05) need.push('postříkat plevel');
  if (!f.meadow && f.limeShare > 0.3) need.push('vyvápnit');
  if (!f.meadow && f.stoneShare > 0.005) need.push('uválcovat kameny');
  if (f.witherShare > 0.02) need.push('sklidit, přezrává');
  return { title: (f.meadow ? 'Louka ' : 'Pole ') + f.id, line: ha + ' · ' + who, grow, need: need.length ? 'Potřebuje: ' + need.join(', ') : 'Nic nepotřebuje', yield: f.meadow ? '' : yieldLine(f) };
}
