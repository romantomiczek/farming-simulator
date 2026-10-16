import { WOOD } from './balance.js';

/**
 * Machine models you can buy. kind = what the piece is in the game (vehicle type or implement key);
 * every kind has a start model (the one the farm begins with, and old saves are converted to).
 * Prices in Kč, game values inspired by the real machines. look = how the model is built
 * (colours, size, extras), read by the builders in vehicles/models.js. Brand names are used as
 * names only, the machines carry no logos.
 */
export const MODELS = [
  /* ---------- tractors: hp = power, kmh = top speed, fuel = tank in litres ---------- */
  {
    id: 'zetor-major-80', kind: 'tractor', brand: 'Zetor', name: 'Major 80', price: 800000, hp: 80, kmh: 40, fuel: 150,
    look: { body: '#c8352b', dark: '#a52a22', rim: '#d9dcdc', roof: '#ecebe6', frame: '#2f3335', scale: 0.86, weights: false, brand: 'ZETOR', model: 'MAJOR 80', text: '#fbf7ee', stroke: '#3a1410', stripe: false },
    desc: 'Malý a levný traktor na menší nářadí a přejezdy. Na široké stroje mu nestačí síla.',
  },
  {
    id: 'brazda-140', kind: 'tractor', brand: 'Brázda', name: '140', title: 'Traktor Brázda 140', price: 1450000, hp: 140, kmh: 40, fuel: 250, start: true,
    look: {},
    desc: 'Spolehlivý střední traktor, se kterým farma začíná. Utáhne běžné nářadí i přívěs.',
  },
  {
    id: 'zetor-forterra-150', kind: 'tractor', brand: 'Zetor', name: 'Forterra 150 HD', price: 1600000, hp: 150, kmh: 40, fuel: 260,
    look: { body: '#c8352b', dark: '#a52a22', rim: '#d9dcdc', roof: '#2a2d2f', frame: '#2f3335', scale: 1.03, brand: 'ZETOR', model: 'FORTERRA 150', text: '#fbf7ee', stroke: '#3a1410', stripe: false },
    desc: 'Česká klasika s o něco větším výkonem a nádrží než Brázda.',
  },
  {
    id: 'mf-6s165', kind: 'tractor', brand: 'Massey Ferguson', name: '6S.165', price: 1850000, hp: 165, kmh: 40, fuel: 290,
    look: { body: '#b8252b', dark: '#931d22', rim: '#8e9396', roof: '#b8252b', frame: '#55595c', scale: 1.06, brand: 'MASSEY FERGUSON', model: '6S.165', text: '#fbf7ee', stroke: '#3a1410', stripe: false },
    desc: 'Univerzální traktor s pohodlnou kabinou, zvládne i širší secí stroj.',
  },
  {
    id: 'case-puma-185', kind: 'tractor', brand: 'Case IH', name: 'Puma 185', price: 2200000, hp: 185, kmh: 50, fuel: 330,
    look: { body: '#b32025', dark: '#8d181c', rim: '#c9ccce', roof: '#2a2d2f', frame: '#232527', scale: 1.1, brand: 'CASE IH', model: 'PUMA 185', text: '#fbf7ee', stroke: '#1d1f20', stripe: false },
    desc: 'Na silnici jede až 50 km/h, s výkonem na šestimetrové nářadí.',
  },
  {
    id: 'nh-t7-210', kind: 'tractor', brand: 'New Holland', name: 'T7.210', price: 2500000, hp: 210, kmh: 50, fuel: 380,
    look: { body: '#1f4f9c', dark: '#173d7a', rim: '#eceae4', roof: '#eceae4', frame: '#2f3335', scale: 1.14, brand: 'NEW HOLLAND', model: 'T7.210', text: '#fbf7ee', stroke: '#0f2346', stripe: false },
    desc: 'Silný traktor s velkou nádrží na celý den práce.',
  },
  {
    id: 'jd-6r250', kind: 'tractor', brand: 'John Deere', name: '6R 250', price: 3000000, hp: 250, kmh: 50, fuel: 450,
    look: { body: '#367c2b', dark: '#2a6221', rim: '#f2c200', roof: '#367c2b', frame: '#2a2d2f', scale: 1.19, brand: 'JOHN DEERE', model: '6R 250', text: '#f2c200', stroke: '#1c3a16', stripe: false },
    desc: 'Výkonný traktor pro velké pluhy a secí stroje, s předním závažím.',
  },
  {
    id: 'claas-axion-870', kind: 'tractor', brand: 'Claas', name: 'Axion 870', price: 3500000, hp: 295, kmh: 50, fuel: 500,
    look: { body: '#a9bf2b', dark: '#8fa323', rim: '#d9dcd8', roof: '#f1f1ec', frame: '#5d6366', scale: 1.24, brand: 'CLAAS', model: 'AXION 870', text: '#fbf7ee', stroke: '#3d4a10', stripe: false },
    desc: 'Těžký traktor na nejširší nářadí a velké návěsy.',
  },
  {
    id: 'fendt-942', kind: 'tractor', brand: 'Fendt', name: '942 Vario', price: 4800000, hp: 420, kmh: 60, fuel: 800,
    look: { body: '#4d7a32', dark: '#3d6127', rim: '#b9bcbd', roof: '#4d7a32', frame: '#3b3f40', scale: 1.32, duals: true, brand: 'FENDT', model: '942 VARIO', text: '#fbf7ee', stroke: '#1d2b14', stripe: false },
    desc: 'Vlajková loď: 420 koní, dvojmontáž zadních kol, 60 km/h. Utáhne cokoli.',
  },

  /* ---------- the rest: start models (more come with the next builders) ---------- */
  { id: 'klas-7', kind: 'combine', brand: 'Klas', name: '7', title: 'Kombajn Klas 7', price: 3200000, start: true, look: {}, desc: 'Obilí, řepka; s řádkovým adaptérem i kukuřice a slunečnice. Zásobník 9 000 l.' },
  { id: 'bulva-6', kind: 'beet', brand: 'Bulva', name: '6', title: 'Sklízeč cukrovky Bulva 6', price: 4100000, start: true, look: {}, desc: 'Šestiřádkový samojízdný sklízeč, zásobník 20 000 l.' },
  { id: 'les-8', kind: 'forest', brand: 'Les', name: '8', title: 'Harvestor Les 8', price: WOOD.harvesterPrice, start: true, look: {}, desc: 'Kácí vzrostlé stromy v lesních parcelách a veze až ' + WOOD.logCap + ' m³ dřeva na pilu nebo do dřevoskladu.' },
  { id: 'lesak', kind: 'jeep', brand: 'Jeep', name: 'Lesák 4×4', price: 290000, start: true, look: {}, desc: 'Rychlý terénní vůz, až 80 km/h. Nic netáhne a nepracuje, ale rychle tě doveze k poli, do lesa i do městečka. Mezerník troubí.' },
  { id: 'kult-42', kind: 'cultivator', brand: '', name: 'Kultivátor', price: 180000, start: true, look: {}, desc: 'Záběr 4,2 m, připraví strniště k setí.' },
  { id: 'pluh-5', kind: 'plough', brand: '', name: 'Pluh', price: 220000, start: true, look: {}, desc: 'Záběr 3,2 m, pomalejší, ale +15 % výnosu.' },
  { id: 'seci-4', kind: 'seeder', brand: '', name: 'Secí stroj', price: 260000, start: true, look: {}, desc: 'Záběr 4 m, seje všech šest plodin.' },
  { id: 'rozm-12', kind: 'spreader', brand: '', name: 'Rozmetadlo', price: 90000, start: true, look: {}, desc: 'Záběr 12 m, hnojivo +25 % výnosu.' },
  { id: 'lis', kind: 'baler', brand: '', name: 'Lis na balíky', price: 480000, start: true, look: {}, desc: 'Lisuje slámu za kombajnem a seno z luk do kulatých balíků.' },
  { id: 'zaci-3', kind: 'mower', brand: '', name: 'Žací lišta', price: 140000, start: true, look: {}, desc: 'Záběr 3 m. Poseče louku a nechá řádek sena pro lis; tráva pak sama doroste.' },
  { id: 'privez-14', kind: 'trailer', brand: '', name: 'Sklápěcí přívěs', price: 150000, start: true, look: {}, desc: '14 000 l zrna nebo 8 balíků.' },
  { id: 'cisterna-8', kind: 'watertank', brand: '', name: 'Cisterna', price: 70000, start: true, look: {}, desc: '8 000 l vody z rybníka pro skleníky, nebo mléka z kravína do mlékárny. V kůlně klávesa 7.' },
];

export const MODEL = Object.fromEntries(MODELS.map(m => [m.id, m]));
/** The start model of each kind (new game, old saves). */
export const START_MODEL = Object.fromEntries(MODELS.filter(m => m.start).map(m => [m.kind, m.id]));
/** Full display name: title, or brand and model ("Zetor Major 80"); implements without a brand keep their name. */
export const modelName = m => m.title || (m.brand ? m.brand + ' ' + m.name : m.name);
