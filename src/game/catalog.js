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

  /* ---------- implements: width = working width (m), hp = power they need for full speed, speed = work speed (m/s) ---------- */
  { id: 'bednar-fenix-3', kind: 'cultivator', brand: 'Bednar', name: 'Fenix 3 m', price: 120000, width: 3.0, hp: 60, look: { color: '#d8661c', frame: '#2a2d2f', width: 3.0, brand: 'BEDNAR' }, desc: 'Úzký kultivátor pro malé traktory.' },
  { id: 'kult-42', kind: 'cultivator', brand: '', name: 'Kultivátor', price: 180000, width: 4.2, hp: 100, start: true, look: {}, desc: 'Připraví strniště k setí.' },
  { id: 'lemken-karat-5', kind: 'cultivator', brand: 'Lemken', name: 'Karat 5', price: 320000, width: 5.0, hp: 160, look: { color: '#1f5aa6', width: 5.0, brand: 'LEMKEN' }, desc: 'Těžší kultivátor se záběrem 5 m.' },
  { id: 'horsch-terrano-6', kind: 'cultivator', brand: 'Horsch', name: 'Terrano 6 FX', price: 450000, width: 6.0, hp: 200, look: { color: '#c4262e', width: 6.0, brand: 'HORSCH' }, desc: 'Šestimetrový kultivátor pro silné traktory.' },
  { id: 'horsch-terrano-10', kind: 'cultivator', brand: 'Horsch', name: 'Terrano 10 FX', price: 850000, width: 10.0, hp: 350, look: { color: '#c4262e', width: 10.0, brand: 'HORSCH' }, desc: 'Desetimetrový kultivátor na velké lány.' },

  { id: 'kverneland-3', kind: 'plough', brand: 'Kverneland', name: 'ES 3 radlice', price: 150000, width: 1.9, hp: 70, look: { color: '#c62828', bottoms: 3, brand: 'KVERNELAND' }, desc: 'Malý tříradličný pluh, +15 % výnosu.' },
  { id: 'pluh-5', kind: 'plough', brand: '', name: 'Pluh', price: 220000, width: 3.2, hp: 130, start: true, look: {}, desc: 'Pět radlic, pomalejší než kultivátor, ale +15 % výnosu.' },
  { id: 'lemken-juwel-6', kind: 'plough', brand: 'Lemken', name: 'Juwel 8, 6 radlic', price: 420000, width: 3.8, hp: 180, look: { color: '#1f5aa6', bottoms: 6, brand: 'LEMKEN' }, desc: 'Šestiradličný pluh, +15 % výnosu.' },
  { id: 'kuhn-varimaster-8', kind: 'plough', brand: 'Kuhn', name: 'Vari-Master, 8 radlic', price: 650000, width: 5.1, hp: 260, look: { color: '#c42b2f', bottoms: 8, brand: 'KUHN' }, desc: 'Osmiradličný pluh pro nejsilnější traktory, +15 % výnosu.' },

  { id: 'seci-3', kind: 'seeder', brand: '', name: 'Secí stroj 3 m', price: 180000, width: 3.0, hp: 70, look: { width: 3.0 }, desc: 'Malý secí stroj na všech šest plodin.' },
  { id: 'seci-4', kind: 'seeder', brand: '', name: 'Secí stroj', price: 260000, width: 4.0, hp: 110, start: true, look: {}, desc: 'Seje všech šest plodin.' },
  { id: 'amazone-cirrus-6', kind: 'seeder', brand: 'Amazone', name: 'Cirrus 6003', price: 550000, width: 6.0, hp: 180, look: { body: '#ef7d00', light: '#f4f4f0', width: 6.0, brand: 'AMAZONE' }, desc: 'Šestimetrový secí stroj.' },
  { id: 'vaderstad-rapid-8', kind: 'seeder', brand: 'Väderstad', name: 'Rapid 800S', price: 800000, width: 8.0, hp: 250, look: { body: '#f2c200', light: '#2a2d2f', width: 8.0, brand: 'VÄDERSTAD', text: '#26282a', stroke: null }, desc: 'Osmimetrový secí stroj.' },
  { id: 'horsch-pronto-12', kind: 'seeder', brand: 'Horsch', name: 'Pronto 12 SW', price: 1300000, width: 12.0, hp: 380, look: { body: '#c4262e', light: '#d9dcd8', width: 12.0, brand: 'HORSCH' }, desc: 'Dvanáctimetrový secí stroj na největší pole.' },

  { id: 'rozm-12', kind: 'spreader', brand: '', name: 'Rozmetadlo', price: 90000, width: 12, hp: 60, start: true, look: {}, desc: 'Hnojivo +25 % výnosu.' },
  { id: 'amazone-zats-24', kind: 'spreader', brand: 'Amazone', name: 'ZA-TS 24 m', price: 220000, width: 24, hp: 90, look: { body: '#f4f4f0', accent: '#ef7d00', hopper: 1.25, brand: 'AMAZONE', text: '#ef7d00', stroke: null }, desc: 'Dvojnásobný záběr, pole pohnojíš za polovinu času.' },
  { id: 'rauch-axis-30', kind: 'spreader', brand: 'Rauch', name: 'Axis 30 m', price: 320000, width: 30, hp: 110, look: { body: '#e8e8e4', accent: '#1f4f9c', hopper: 1.4, brand: 'RAUCH', text: '#1f4f9c', stroke: null }, desc: 'Největší rozmetadlo se záběrem 30 m.' },

  { id: 'zaci-3', kind: 'mower', brand: '', name: 'Žací lišta', price: 140000, width: 3.0, hp: 60, start: true, look: {}, desc: 'Poseče louku a nechá řádek sena pro lis; tráva pak sama doroste.' },
  { id: 'pottinger-novacat-35', kind: 'mower', brand: 'Pöttinger', name: 'Novacat 352', price: 190000, width: 3.5, hp: 70, look: { color: '#2f8f3a', width: 3.5, brand: 'PÖTTINGER' }, desc: 'Lišta se záběrem 3,5 m.' },
  { id: 'krone-easycut-87', kind: 'mower', brand: 'Krone', name: 'EasyCut B 870', price: 450000, width: 8.7, hp: 150, look: { color: '#1f7a3a', width: 8.7, brand: 'KRONE' }, desc: 'Motýlková kombinace tří lišt, záběr 8,7 m.' },

  { id: 'lis', kind: 'baler', brand: '', name: 'Lis na balíky', price: 480000, speed: 3.6, hp: 90, start: true, look: {}, desc: 'Lisuje slámu za kombajnem a seno z luk do kulatých balíků.' },
  { id: 'jd-v461r', kind: 'baler', brand: 'John Deere', name: 'V461R', price: 600000, speed: 4.3, hp: 110, look: { body: '#367c2b', accent: '#f2c200', brand: 'JOHN DEERE', text: '#f2c200', stroke: '#1c3a16' }, desc: 'Rychlejší lis, pojede o 20 % rychleji.' },
  { id: 'krone-comprima-v150', kind: 'baler', brand: 'Krone', name: 'Comprima V150', price: 800000, speed: 5.0, hp: 130, look: { body: '#1f7a3a', accent: '#c4262e', brand: 'KRONE' }, desc: 'Nejrychlejší lis, o 40 % rychleji.' },

  { id: 'bss-10', kind: 'trailer', brand: 'BSS', name: 'PS 10 t', price: 100000, cap: 10000, hp: 80, look: { body: '#2f5f9c', rib: '#264f82', trim: '#5b84bd', len: 4.8, height: 1.15, axles: 1, brand: 'BSS' }, desc: 'Malý jednonápravový přívěs.' },
  { id: 'privez-14', kind: 'trailer', brand: '', name: 'Sklápěcí přívěs', price: 150000, cap: 14000, hp: 110, start: true, look: {}, desc: 'Dvounápravový sklápěcí přívěs.' },
  { id: 'fliegl-22', kind: 'trailer', brand: 'Fliegl', name: 'TMK 22', price: 260000, cap: 22000, hp: 150, look: { body: '#2f6f5a', rib: '#265c4a', trim: '#4f8f78', len: 6.4, height: 1.6, brand: 'FLIEGL' }, desc: 'Velký tandem s vyššími bočnicemi.' },
  { id: 'krampe-bandit-30', kind: 'trailer', brand: 'Krampe', name: 'Bandit 750', price: 420000, cap: 30000, hp: 190, look: { body: '#c8352b', rib: '#a52a22', trim: '#e05a4e', len: 7.4, height: 1.75, axles: 3, brand: 'KRAMPE' }, desc: 'Třínápravový návěs na 30 000 l.' },
  { id: 'annaburger-40', kind: 'trailer', brand: 'Annaburger', name: 'HTS 34', price: 600000, cap: 40000, hp: 260, look: { body: '#3b7f3a', rib: '#306a30', trim: '#5a9a52', len: 8.6, height: 1.9, axles: 3, brand: 'ANNABURGER' }, desc: 'Největší návěs: 40 000 l.' },

  { id: 'cisterna-5', kind: 'watertank', brand: '', name: 'Cisterna 5 000 l', price: 50000, cap: 5000, hp: 60, look: { len: 2.8, r: 0.85 }, desc: 'Malá cisterna na vodu nebo mléko.' },
  { id: 'cisterna-8', kind: 'watertank', brand: '', name: 'Cisterna', price: 70000, cap: 8000, hp: 90, start: true, look: {}, desc: 'Voda z rybníka pro skleníky, nebo mléko z kravína do mlékárny. V kůlně klávesa 7.' },
  { id: 'joskin-modulo-11', kind: 'watertank', brand: 'Joskin', name: 'Modulo2 11000', price: 160000, cap: 11000, hp: 130, look: { body: '#3b8f3a', dark: '#2f7230', len: 4.4, r: 1.0, brand: 'JOSKIN' }, desc: 'Cisterna na 11 000 l.' },
  { id: 'zunhammer-18', kind: 'watertank', brand: 'Zunhammer', name: 'SKE 18.5', price: 300000, cap: 18500, hp: 190, look: { body: '#d9dcd8', dark: '#1f4f9c', len: 5.6, r: 1.1, axles: 2, brand: 'ZUNHAMMER', text: '#1f4f9c', stroke: null }, desc: 'Tandemová cisterna na 18 500 l.' },
];

export const MODEL = Object.fromEntries(MODELS.map(m => [m.id, m]));
/** The start model of each kind (new game, old saves). */
export const START_MODEL = Object.fromEntries(MODELS.filter(m => m.start).map(m => [m.kind, m.id]));
/** Full display name: title, or brand and model ("Zetor Major 80"); implements without a brand keep their name. */
export const modelName = m => m.title || (m.brand ? m.brand + ' ' + m.name : m.name);
