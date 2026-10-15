// Smoke test: starts the development server, opens the game in a headless browser and plays the
// main loop (driving, harvesting, selling, cultivating, saving, the developer panel and the map
// editor), then reports errors from the browser console. Run with `npm test`.
// First run on a new computer: `npx playwright install chromium`.
import { createServer } from 'vite';
import { chromium } from 'playwright';

const results = [];
const check = (name, ok, info = '') => {
  results.push({ name, ok });
  console.log((ok ? 'OK   ' : 'CHYBA') + ' ' + name + (info ? '  — ' + info : ''));
};

const server = await createServer({ server: { port: 5199, strictPort: false }, logLevel: 'error' });
await server.listen();
const url = server.resolvedUrls.local[0];
// without a graphics card (servers, CI) Chromium renders in software
const browser = await chromium.launch({ args: process.platform === 'linux' ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

try {
  await page.goto(url);
  await page.waitForFunction(() => window.__zl, null, { timeout: 120000 });

  // a new game with rendering paused while the simulation runs (software rendering is slow)
  await page.evaluate(async () => {
    const save = await import('/src/game/save.js'); const menu = await import('/src/ui/menu.js');
    const machines = await import('/src/game/machines.js');
    save.newGame(); menu.hideMenu();
    const z = window.__zl; z.G.playing = true; z.G.tsIdx = 0; z.G.money = 5e7;
    for (const k of ['beet', 'forest', 'jeep']) machines.buy(k);
    z.realRender = z.renderer.render; z.renderer.render = () => {};
    z.hold = (code, frames) => {
      for (const c of [].concat(code)) window.dispatchEvent(new KeyboardEvent('keydown', { code: c, key: c }));
      z.step(frames);
      for (const c of [].concat(code)) window.dispatchEvent(new KeyboardEvent('keyup', { code: c, key: c }));
    };
  });

  // every machine drives across an open field
  const drive = await page.evaluate(() => {
    const { G, vehicles, fields } = window.__zl, f = fields.find(x => x.id === 2), out = {};
    for (const v of vehicles.filter(x => x.available)) {
      vehicles.forEach((o, i) => { if (o !== v) Object.assign(o, { x: -400 + i * 20, z: -400 }); });
      Object.assign(v, { x: f.x0 + 5, z: f.z0 + 5, h: Math.atan2(f.w, f.h), speed: 0 });
      G.active = v;
      window.__zl.hold('KeyW', 120);
      out[v.type] = Math.round(Math.hypot(v.x - f.x0 - 5, v.z - f.z0 - 5));
    }
    return out;
  });
  check('všechny stroje jezdí', Object.values(drive).every(m => m > 12), Object.entries(drive).map(([k, m]) => k + ' ' + m + ' m').join(', '));

  // the combine harvests field 1 and sells the grain at the co-op
  const harvest = await page.evaluate(async () => {
    const { G, vehicles, fields } = window.__zl, f = fields.find(x => x.id === 1), c = vehicles.find(v => v.type === 'combine');
    const { MARKETS } = await import('/src/game/markets.js'), coop = MARKETS.find(m => m.id === 'coop');
    Object.assign(c, { x: f.x0 + 6, z: f.z0 + 2, h: 0, speed: 0 }); G.active = c;
    window.__zl.act('Space');
    window.__zl.hold('KeyW', 300);
    const tank = c.tank.amount;
    window.__zl.act('Space');
    Object.assign(c, { x: coop.x, z: coop.z, speed: 0 });
    const money = G.money;
    window.__zl.act('KeyF');
    window.__zl.step(600);
    return { tank: Math.round(tank), left: Math.round(c.tank.amount), paid: Math.round(G.money - money) };
  });
  check('kombajn sklízí', harvest.tank > 0, harvest.tank + ' l');
  check('družstvo vykoupí obilí', harvest.paid > 0 && harvest.left === 0, harvest.paid + ' Kč');

  // the tractor cultivates stubble on field 2
  const cult = await page.evaluate(() => {
    const { G, vehicles, fields, attach } = window.__zl, f = fields.find(x => x.id === 2), t = vehicles.find(v => v.type === 'tractor');
    attach('cultivator'); G.active = t;
    Object.assign(t, { x: f.x0 + 10, z: f.z0 + 3, h: 0, speed: 0 });
    const before = f.state.filter(s => s === 1).length;
    window.__zl.act('Space');
    window.__zl.hold('KeyW', 300);
    window.__zl.act('Space');
    return f.state.filter(s => s === 1).length - before;
  });
  check('kultivátor zpracuje strniště', cult > 0, cult + ' m²');

  // a helper sent from the office: drives to field 2 along the roads, cultivates it and comes home
  const helper = await page.evaluate(async () => {
    const H = await import('/src/game/helpers.js');
    const { vehicles, fields, attach } = window.__zl, t = vehicles.find(v => v.type === 'tractor'), f = fields.find(x => x.id === 2);
    attach('cultivator');
    Object.assign(t, { x: t.home[0], z: t.home[1], h: 0, speed: 0 });
    if (!H.sendHelper(t, f)) return { modes: [] };
    const modes = [];
    for (let i = 0; i < 8000 && t.helper; i++) {
      window.__zl.step(1, 0.05);
      if (t.helper && modes[modes.length - 1] !== t.helper.mode) modes.push(t.helper.mode);
    }
    const hp = t.helper;
    const rest = []; for (let i = 0; i < f.n; i++) if (f.state[i] === 0 && rest.length < 8) rest.push((i % f.w) + ',' + ((i / f.w) | 0));
    const near = vehicles.filter(o => o !== t && o.available && o.x > f.x0 - 5 && o.x < f.x0 + f.w + 5 && o.z > f.z0 - 5 && o.z < f.z0 + f.h + 5).map(o => o.type + '@' + Math.round(o.x - f.x0) + ',' + Math.round(o.z - f.z0));
    return { modes, done: !hp, left: H.workLeft(f, t), area: f.area, rest: rest.join(' ') + ' | stroje na poli: ' + near.join(' '), state: hp && `${hp.mode}/${hp.wait} seg ${hp.seg}/${hp.path.length} @${Math.round(t.x)},${Math.round(t.z)} doma ${t.home}` };
  });
  // corners the tool cannot reach without leaving the field may stay undone
  check('pomocník z Kanceláře', helper.done && helper.left <= helper.area * 0.02 && ['travel', 'field', 'home'].every(m => helper.modes.includes(m)), helper.modes.join(' → ') + ' · zbývá ' + helper.left + ' m²' + (helper.state ? ' · ' + helper.state : ''));

  // the forestry harvester on a field (used to freeze the picture)
  const forest = await page.evaluate(() => {
    const { G, vehicles, fields } = window.__zl, f = fields.find(x => x.id === 1), v = vehicles.find(x => x.type === 'forest');
    Object.assign(v, { x: f.x0 + 20, z: f.z0 + 20, speed: 0 }); G.active = v;
    window.__zl.step(30);
    return true;
  });
  check('harvestor na poli', forest);

  // animals: hay bales to the sheep, a balanced mix for the cows, milk by tank to the dairy
  const farm = await page.evaluate(async () => {
    const z = window.__zl, M = await import('/src/game/machines.js'), A = await import('/src/game/actions.js');
    const V = await import('/src/vehicles/vehicles.js'), L = await import('/src/world/layout.js'), F = await import('/src/game/farm.js');
    for (const k of ['cows', 'sheep', 'pigs', 'mixer', 'trailer', 'watertank']) M.buy(k);
    const t = V.tractor; z.G.active = t;
    const place = (x, zz) => { Object.assign(t, { x, z: zz, h: 0, speed: 0 }); Object.assign(V.trailer, { x, z: zz - 5, h: 0 }); z.step(3, 0.02); };
    V.attachImpl('trailer'); V.trailer.bales = 3; V.trailer.hay = 3;
    place(L.SHEEP_PEN.feed.x, L.SHEEP_PEN.feed.z + 8); const hay = A.fAction()?.kind; A.doF();
    const sheep = z.G.farm.sheepFeed;
    z.G.farm.cowFeed = 9000; Object.assign(z.G.farm.mix, { grain: 5000, hay: 2000, beet: 2000 }); z.G.farm.milk = 0; F.farmTick(4);
    const milk = z.G.farm.milk;
    V.attachImpl('watertank'); place(L.MILK_LOAD.x, L.MILK_LOAD.z); A.doF();
    const m0 = z.G.money; place(L.DAIRY.x, L.DAIRY.z); const sell = A.fAction()?.kind; A.doF();
    V.attachImpl('cultivator');
    return { hay, sheep, milk, sell, paid: Math.round(z.G.money - m0) };
  });
  check('zvířata a mlékárna', farm.hay === 'feedHay' && farm.sheep === 3000 && farm.milk === 2000 && farm.sell === 'sellMilk' && farm.paid === 24000,
    'seno ovcím ' + farm.sheep + ' l · mléko se směsí ' + farm.milk + ' l · mlékárna ' + farm.paid + ' Kč');

  // an hour of game time at full speed: traffic, animals, growth, helpers' world
  await page.evaluate(() => { const z = window.__zl; z.G.tsIdx = 2; z.step(1800, 0.05); z.G.tsIdx = 0; });
  check('hodina herního času', true);

  // save and load
  const saved = await page.evaluate(async () => {
    const save = await import('/src/game/save.js'), z = window.__zl;
    const f1 = z.fields.find(x => x.id === 1), before = { money: Math.round(z.G.money), cut: f1.state.filter(s => s === 0).length };
    save.saveLocal(); z.G.money = 1;
    const ok = save.loadLocal();
    return { ok, before, after: { money: Math.round(z.G.money), cut: z.fields.find(x => x.id === 1).state.filter(s => s === 0).length } };
  });
  check('uložení a načtení', saved.ok && saved.after.money === saved.before.money && saved.after.cut === saved.before.cut, JSON.stringify(saved.after));

  // rendering on every preset
  await page.evaluate(() => { const z = window.__zl; z.renderer.render = z.realRender; });
  const presets = await page.evaluate(() => {
    const out = {};
    for (const k of ['low', 'medium', 'high', 'ultra']) {
      document.querySelector(`#presetSeg button[data-p="${k}"]`).click();
      window.__zl.step(2);
      const i = window.__zl.renderer.info.render;
      out[k] = i.calls + ' volání / ' + Math.round(i.triangles / 1000) + ' tis. △';
    }
    document.querySelector('#presetSeg button[data-p="high"]').click();
    return out;
  });
  check('všechny předvolby kreslí', Object.keys(presets).length === 4, Object.entries(presets).map(([k, v]) => k + ' ' + v).join(' · '));

  // developer panel and the map editor (opened and closed without saving)
  {
    await page.keyboard.press('F9');
    await page.click('[data-dev="mapEdit"]');
    await page.waitForSelector('.mapedit:not([hidden])');
    await page.click('[data-me="addField"]');
    const warn = await page.evaluate(() => document.querySelectorAll('.mewarn li').length);
    await page.click('[data-me="close"]'); await page.click('[data-me="close"]');
    const closed = await page.evaluate(() => document.querySelector('.mapedit').hidden);
    check('editor mapy', closed && warn > 0, 'nové pole na dvoře hlásí ' + warn + ' varování');
  }

  check('konzole prohlížeče bez chyb', errors.length === 0, [...new Set(errors)].slice(0, 5).join(' || '));
} catch (e) {
  check('test doběhl', false, String(e.message || e));
} finally {
  await browser.close();
  await server.close();
}

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} v pořádku`);
process.exit(failed.length ? 1 : 0);
