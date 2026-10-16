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

  /* ---------- combines: header = cutting width (m), tank (l), unload (l/s), fuel (l) ---------- */
  {
    id: 'sampo-sr2045', kind: 'combine', brand: 'Sampo Rosenlew', name: 'SR2045', price: 1600000, header: 3.9, tank: 4500, unload: 1200, fuel: 300,
    look: { body: '#c8352b', bodyLt: '#d64a3d', light: '#f1f1ec', frame: '#2f3335', rim: '#d9dcdc', scale: 0.82, header: 3.9, brand: 'SAMPO', model: 'SR2045', stroke: '#3a1410' },
    desc: 'Malý levný kombajn na menší pole. Úzká lišta a malý zásobník, často jezdí k silům.',
  },
  {
    id: 'klas-7', kind: 'combine', brand: 'Klas', name: '7', title: 'Kombajn Klas 7', price: 3200000, header: 5.4, tank: 9000, unload: 1800, fuel: 500, start: true, look: {},
    desc: 'Obilí, řepka; s řádkovým adaptérem i kukuřice a slunečnice.',
  },
  {
    id: 'claas-tucano-450', kind: 'combine', brand: 'Claas', name: 'Tucano 450', price: 3900000, header: 6.0, tank: 9500, unload: 2000, fuel: 600,
    look: { body: '#a9bf2b', bodyLt: '#b8cc3e', light: '#f1f1ec', frame: '#5d6366', rim: '#d9dcd8', brand: 'CLAAS', text: '#fbf7ee', stroke: '#3d4a10', scale: 1.04, header: 6.0, model: 'TUCANO 450' },
    desc: 'Střední kombajn s o něco širší lištou a rychlejším vykládáním.',
  },
  {
    id: 'df-c6205', kind: 'combine', brand: 'Deutz-Fahr', name: 'C6205', price: 4200000, header: 6.3, tank: 10000, unload: 2100, fuel: 650,
    look: { body: '#7aa53b', bodyLt: '#8cb64a', light: '#dcdcd6', frame: '#4a4f52', rim: '#c9ccce', scale: 1.06, header: 6.3, brand: 'DEUTZ-FAHR', model: 'C6205', stroke: '#2b3d14' },
    desc: 'Lišta 6,3 m a zásobník 10 000 l.',
  },
  {
    id: 'caseih-7250', kind: 'combine', brand: 'Case IH', name: 'Axial-Flow 7250', price: 5600000, header: 7.6, tank: 12300, unload: 2600, fuel: 900,
    look: { body: '#b32025', bodyLt: '#c42b2f', light: '#2a2d2f', frame: '#232527', rim: '#c9ccce', scale: 1.15, header: 7.6, brand: 'CASE IH', model: 'AXIAL-FLOW 7250', stroke: '#1d1f20' },
    desc: 'Velký rotorový kombajn s lištou 7,6 m.',
  },
  {
    id: 'jd-s790', kind: 'combine', brand: 'John Deere', name: 'S790', price: 7400000, header: 10.7, tank: 14100, unload: 3000, fuel: 1000,
    look: { body: '#367c2b', bodyLt: '#418f34', light: '#f2c200', frame: '#2a2d2f', rim: '#f2c200', scale: 1.25, header: 10.7, brand: 'JOHN DEERE', model: 'S790', text: '#f2c200', stroke: '#1c3a16' },
    desc: 'Lišta 10,7 m: pole sklidí skoro dvakrát rychleji než Klas 7.',
  },
  {
    id: 'claas-lexion-8900', kind: 'combine', brand: 'Claas', name: 'Lexion 8900', price: 8900000, header: 12.3, tank: 18000, unload: 3600, fuel: 1150,
    look: { body: '#a9bf2b', bodyLt: '#b8cc3e', light: '#f1f1ec', frame: '#5d6366', rim: '#d9dcd8', brand: 'CLAAS', text: '#fbf7ee', stroke: '#3d4a10', scale: 1.32, header: 12.3, model: 'LEXION 8900' },
    desc: 'Největší kombajn: lišta 12,3 m a zásobník 18 000 l.',
  },

  /* ---------- beet harvesters: rows, tank (l), work = working speed factor ---------- */
  { id: 'bulva-6', kind: 'beet', brand: 'Bulva', name: '6', title: 'Sklízeč cukrovky Bulva 6', price: 4100000, rows: 6, tank: 20000, fuel: 600, start: true, look: {}, desc: 'Šestiřádkový samojízdný sklízeč.' },
  {
    id: 'grimme-rexor-620', kind: 'beet', brand: 'Grimme', name: 'Rexor 620', price: 4900000, rows: 6, tank: 26000, fuel: 700,
    look: { body: '#c1272d', dark: '#9e1f24', light: '#d9dcd8', rim: '#d9dcd8', scale: 1.05, brand: 'GRIMME', model: 'REXOR 620', stroke: '#3a1410' },
    desc: 'Šest řádků a větší bunkr, méně cest k výkupu.',
  },
  {
    id: 'holmer-t440', kind: 'beet', brand: 'Holmer', name: 'Terra Dos T4-40', price: 5800000, rows: 6, tank: 30000, fuel: 800, work: 1.15,
    look: { body: '#4f8f3a', dark: '#3f7430', light: '#2a2d2f', rim: '#c9ccce', scale: 1.1, brand: 'HOLMER', model: 'TERRA DOS T4-40', stroke: '#1c3a16' },
    desc: 'Šest řádků, o 15 % rychlejší sklizeň a bunkr 30 000 l.',
  },
  {
    id: 'ropa-tiger-6s', kind: 'beet', brand: 'Ropa', name: 'Tiger 6S', price: 7200000, rows: 9, tank: 35000, fuel: 900,
    look: { body: '#e9e9e2', dark: '#3c7f3a', light: '#3c7f3a', rim: '#3c7f3a', scale: 1.15, rows: 9, brand: 'ROPA', model: 'TIGER 6S', text: '#3c7f3a', stroke: null },
    desc: 'Devět řádků najednou a bunkr 35 000 l.',
  },

  /* ---------- forestry harvesters: logs = load (m³), cut = felling speed factor ---------- */
  {
    id: 'les-6', kind: 'forest', brand: 'Les', name: '6', title: 'Harvestor Les 6', price: 1100000, logs: 16, cut: 0.8, fuel: 220,
    look: { scale: 0.9, model: '6' }, desc: 'Menší a levnější harvestor, kácí pomaleji a uveze 16 m³.',
  },
  { id: 'les-8', kind: 'forest', brand: 'Les', name: '8', title: 'Harvestor Les 8', price: WOOD.harvesterPrice, logs: WOOD.logCap, cut: 1, fuel: 300, start: true, look: {}, desc: 'Kácí vzrostlé stromy v lesních parcelách a veze dřevo na pilu nebo do dřevoskladu.' },
  {
    id: 'komatsu-931', kind: 'forest', brand: 'Komatsu', name: '931XC', price: 2300000, logs: 28, cut: 1.2, fuel: 350,
    look: { body: '#d9a320', dark: '#bf8d1a', frame: '#3b3f40', scale: 1.06, brand: 'KOMATSU', model: '931XC' }, desc: 'Rychlejší kácení a 28 m³ dřeva.',
  },
  {
    id: 'jd-1270g', kind: 'forest', brand: 'John Deere', name: '1270G', price: 2600000, logs: 30, cut: 1.25, fuel: 380,
    look: { body: '#367c2b', dark: '#2a6221', rim: '#f2c200', scale: 1.08, brand: 'JOHN DEERE', model: '1270G', text: '#f2c200', stroke: '#1c3a16' }, desc: 'Silný harvestor na 30 m³.',
  },
  {
    id: 'ponsse-scorpion', kind: 'forest', brand: 'Ponsse', name: 'Scorpion King', price: 3100000, logs: 32, cut: 1.4, fuel: 400,
    look: { body: '#f0b400', dark: '#2a2d2f', frame: '#2a2d2f', scale: 1.1, brand: 'PONSSE', model: 'SCORPION KING' }, desc: 'Nejrychlejší kácení a 32 m³ dřeva.',
  },

  /* ---------- the rest: start models (more come with the next builders) ---------- */
  /* ---------- cars: kmh = top speed, offroad = speed off the roads (share of kmh), r/wb = size ---------- */
  { id: 'lesak', kind: 'jeep', brand: 'Jeep', name: 'Lesák 4×4', price: 290000, kmh: 80, fuel: 70, offroad: 1, start: true, look: {}, desc: 'Otevřený terénní vůz. Mimo cesty jede stejně rychle jako po nich.' },
  {
    id: 'dacia-duster', kind: 'jeep', brand: 'Dacia', name: 'Duster 4×4', price: 420000, kmh: 95, fuel: 50, offroad: 0.75, r: 1.65, wb: 2.66,
    look: { builder: 'suv' }, desc: 'Uzavřené SUV: po silnici rychlejší, v poli a v lese pomalejší než Lesák.',
  },
  {
    id: 'toyota-hilux', kind: 'jeep', brand: 'Toyota', name: 'Hilux', price: 750000, kmh: 100, fuel: 80, offroad: 0.9, r: 1.85, wb: 3.1,
    look: { builder: 'pickup' }, desc: 'Pickup s korbou: nejrychlejší auto a v terénu skoro jako Lesák.',
  },
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
