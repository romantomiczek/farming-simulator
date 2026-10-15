// Economy overview: what each crop, building and machine earns and how fast it pays back,
// straight from the game's own numbers (src/game/balance.js, crops.js, layout.js).
// Run with `npm run ekonomika`.
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const load = p => server.ssrLoadModule(p);
const B = await load('/src/game/balance.js');
const { CROPS } = await load('/src/game/crops.js');
const { FOREST_PLOTS } = await load('/src/world/layout.js');
await server.close();

const kc = n => Math.round(n).toLocaleString('cs-CZ').replace(/ /g, ' ') + ' Kč';
const days = n => (Number.isFinite(n) && n > 0 ? n.toFixed(1).replace('.', ',') + ' dne' : 'nikdy');
const table = (head, rows) => {
  const w = head.map((h, i) => Math.max(h.length, ...rows.map(r => String(r[i]).length)));
  const line = r => r.map((c, i) => (i ? String(c).padStart(w[i]) : String(c).padEnd(w[i]))).join('   ');
  console.log(line(head)); console.log(w.map(n => '─'.repeat(n)).join('   ')); rows.forEach(r => console.log(line(r))); console.log();
};

console.log('Herní hodina = 1 minuta při rychlosti 1×, herní den = 24 minut.\n');

console.log('POLE (1 ha, bez hnojení a orby)');
table(['Plodina', 'Tržba', 'Osivo', 'Zisk', 'Růst', 'Cena pole', 'Návratnost'], CROPS.map(c => {
  const sale = c.yield * 10000 * c.price, seed = c.seed * 10000, net = sale - seed;
  return [c.name, kc(sale), kc(seed), kc(net), c.hours + ' h', kc(B.FIELD_PER_HA), (B.FIELD_PER_HA / net).toFixed(1).replace('.', ',') + ' sklizně'];
}));

const cheapest = idx => Math.min(...idx.map(i => CROPS[i].price));
const animal = (name, a, perHour, price, eats) => {
  const income = perHour * 24 * price, feed = a.feedPerHour * 24 * cheapest(eats), net = income - feed;
  return [name, kc(a.price), kc(income), kc(feed), kc(net), days(a.price / net), (a.feedStore / (a.feedPerHour * 24)).toFixed(1).replace('.', ',') + ' dne'];
};
console.log('BUDOVY (za herní den; krmivo počítané nejlevnější plodinou)');
const gh = B.GREENHOUSE, ghNet = gh.kgPerHour * 24 * gh.kgPrice;
table(['Budova', 'Cena', 'Tržba', 'Krmivo/voda', 'Zisk', 'Návratnost', 'Zásoba vydrží'], [
  animal('Kravín', B.COWS, B.COWS.milkPerHour, B.COWS.milkPrice, [1, 3, 5]),
  animal('Kurník', B.HENS, B.HENS.eggsPerHour, B.HENS.eggPrice, [0, 1]),
  ['Skleník', kc(gh.price), kc(ghNet), 'voda z rybníka', kc(ghNet), days(gh.price / ghNet), (gh.waterStore / (gh.waterPerHour * 24)).toFixed(1).replace('.', ',') + ' dne'],
]);

// trees are planted on an 8.5 m grid in each plot, the same way as src/world/forest.js
let trees = 0;
for (const P of FOREST_PLOTS) for (let x = P.x0 + 4; x < P.x1 - 2; x += 8.5) for (let z = P.z0 + 4; z < P.z1 - 2; z += 8.5) trees++;
const w = B.WOOD, perTree = w.treeM3 * 0.9, cycle = trees * perTree * w.pricePerM3, cycleDays = w.growDays * 0.85;
console.log('LES');
table(['Položka', 'Hodnota'], [
  ['Stromů v parcelách', trees],
  ['Dřevo z dospělého stromu', perTree.toFixed(1).replace('.', ',') + ' m³ · ' + kc(perTree * w.pricePerM3)],
  ['Jedna jízda harvestoru', w.logCap + ' m³ · ' + kc(w.logCap * w.pricePerM3)],
  ['Celý les jednou', kc(cycle) + ' · doroste za ' + days(cycleDays)],
  ['Harvestor', kc(w.harvesterPrice) + ' · návratnost ' + (w.harvesterPrice / cycle).toFixed(1).replace('.', ',') + ' vytěžení lesa (' + days(w.harvesterPrice / cycle * cycleDays) + ')'],
]);

console.log('POMOCNÍK');
const wheat = CROPS[0], ha = wheat.yield * 10000 * wheat.price;
table(['Položka', 'Hodnota'], [
  ['Mzda', kc(B.HELPER_WAGE) + ' za herní hodinu práce (= minuta při 1×)'],
  ['Sklizeň 1 ha pšenice kombajnem', 'asi 11 minut, ' + kc(ha) + ' tržba, mzda ' + kc(B.HELPER_WAGE * 11) + ' (' + Math.round((B.HELPER_WAGE * 11 / ha) * 100) + ' %)'],
]);
