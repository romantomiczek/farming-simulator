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
    const z0 = () => window.__zl;
    const save = await import('/src/game/save.js'); const menu = await import('/src/ui/menu.js');
    const machines = await import('/src/game/machines.js');
    save.newGame(); menu.hideMenu();
    window.__startFoot = z0().G.onFoot; z0().seat(z0().G.active); // a new game starts on foot; the checks drive
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
    for (const k of ['cows', 'sheep', 'pigs', 'mixer', 'trailer', 'watertank']) if (!M.has(k)) M.buy(k);
    const t = V.firstOf('tractor'); z.G.active = t;
    z.attach('trailer', t); const tr = t.tool;
    const place = (x, zz) => { Object.assign(t, { x, z: zz, h: 0, speed: 0 }); Object.assign(tr, { x, z: zz - 5, h: 0 }); z.step(3, 0.02); };
    tr.bales = 3; tr.hay = 3;
    place(L.SHEEP_PEN.feed.x, L.SHEEP_PEN.feed.z + 8); const hay = A.fAction()?.kind; A.doF();
    const sheep = z.G.farm.sheepFeed;
    z.G.farm.cowFeed = 9000; Object.assign(z.G.farm.mix, { grain: 5000, hay: 2000, beet: 2000 }); z.G.farm.milk = 0; F.farmTick(4);
    const milk = z.G.farm.milk;
    z.attach('watertank', t); place(L.MILK_LOAD.x, L.MILK_LOAD.z); A.doF();
    const m0 = z.G.money; place(L.DAIRY.x, L.DAIRY.z); const sell = A.fAction()?.kind; A.doF();
    z.attach('cultivator', t);
    return { hay, sheep, milk, sell, paid: Math.round(z.G.money - m0) };
  });
  check('zvířata a mlékárna', farm.hay === 'feedHay' && farm.sheep === 3000 && farm.milk === 2000 && farm.sell === 'sellMilk' && farm.paid === 24000,
    'seno ovcím ' + farm.sheep + ' l · mléko se směsí ' + farm.milk + ' l · mlékárna ' + farm.paid + ' Kč');

  // the fleet: a second tractor and trailer park in the machine park, the office lists every piece
  const park = await page.evaluate(async () => {
    const M = await import('/src/game/machines.js'), V = await import('/src/vehicles/vehicles.js'), L = await import('/src/world/layout.js'), O = await import('/src/ui/office.js');
    M.buy('tractor'); M.buy('trailer');
    const t2 = V.vehicles.filter(v => v.type === 'tractor')[1], tr2 = V.tools.filter(t => t.key === 'trailer').pop();
    O.openOffice('fleet'); const rows = document.querySelectorAll('#officeBody .row').length; O.closeOffice();
    const inPark = (x, z) => x > L.PARK.x0 && z > L.PARK.z0 && z < L.PARK.z1;
    return { t2: inPark(t2.x, t2.z), hitched: tr2.on === t2, rows, pieces: V.vehicles.length + V.tools.length };
  });
  check('vozový park', park.t2 && park.hitched && park.rows === park.pieces, 'druhý traktor na odstavné ploše s přívěsem · ' + park.rows + ' řádků v Kanceláři');

  // a helper with the second tractor fetches a plough from the yard, hitches it and drives to field 2; a second helper is refused
  const fetch = await page.evaluate(async () => {
    const V = await import('/src/vehicles/vehicles.js'), M = await import('/src/game/machines.js'), H = await import('/src/game/helpers.js'), z = window.__zl;
    for (const v of V.vehicles) if (v.helper) H.dismiss(v);
    z.G.money = 5e7; M.buy('pluh-5');
    const pl = V.tools.filter(t => t.key === 'plough').pop(), t2 = V.vehicles.filter(v => v.type === 'tractor')[1], f2 = z.fields.find(x => x.id === 2);
    const sent = H.sendHelper(t2, f2, pl);
    const block = H.canHire(V.firstOf('combine'), z.fields.find(x => x.id === 1)).why || '';
    const modes = [t2.helper?.mode];
    for (let i = 0; i < 2400 && t2.helper && t2.helper.mode !== 'field'; i++) { z.step(1, 0.05); if (modes[modes.length - 1] !== t2.helper?.mode) modes.push(t2.helper?.mode); }
    const hitched = pl.on === t2;
    if (t2.helper) H.dismiss(t2);
    return { sent, block: block.includes('jen jeden'), modes: modes.join(' → '), hitched };
  });
  check('pomocník dojede pro nářadí', fetch.sent && fetch.block && fetch.hitched && fetch.modes === 'fetch → travel → field', fetch.modes + (fetch.block ? ' · druhého pomocníka nepustí' : ' · DRUHÝ POMOCNÍK PROŠEL'));

  // level of detail: the parked second tractor far from the camera uses the simplified model, near it the detailed one
  const lod = await page.evaluate(async () => {
    const V = await import('/src/vehicles/vehicles.js'), z = window.__zl, t2 = V.vehicles.filter(v => v.type === 'tractor')[1];
    const nearShown = () => { let n = 0; t2.group.traverse(o => { if (o.isMesh && o.visible) n++; }); return n > 0; };
    V.updLOD({ x: t2.x + 500, y: 50, z: t2.z }, 70); const far = t2.lodFar && !nearShown();
    V.updLOD({ x: t2.x + 10, y: 10, z: t2.z }, 70); const near = !t2.lodFar && nearShown();
    return { far, near, tris: V.farStats()[t2.model] };
  });
  check('vzdálené stroje', lod.far && lod.near && lod.tris < 8000, 'zjednodušený traktor ' + lod.tris + ' △');

  // the shop: every tab renders cards, a tractor bought with the old one as a trade-in keeps its implement
  const shopCheck = await page.evaluate(async () => {
    const O = await import('/src/ui/office.js'), V = await import('/src/vehicles/vehicles.js'), z = window.__zl;
    O.openOffice('shop');
    const tabs = [...document.querySelectorAll('button[data-act="shopgrp"]')].map(b => b.dataset.key), cards = {};
    for (const k of tabs) { document.querySelector(`button[data-act="shopgrp"][data-key="${k}"]`).click(); cards[k] = document.querySelectorAll('#officeBody .mcard, #officeBody .row').length; }
    document.querySelector('button[data-act="shopgrp"][data-key="tractor"]').click();
    document.querySelector('button[data-act="model"][data-key="jd-6r250"]').click();
    const sel = document.querySelector('select[data-trade]'), old = V.vehicles.find(v => v.type === 'tractor' && v.tool && !v.helper && v !== z.G.active);
    sel.value = old.id; sel.dispatchEvent(new Event('change', { bubbles: true }));
    const tool = old.tool, m0 = z.G.money;
    document.querySelector('button[data-act="trade"]').click();
    const jd = V.vehicles.filter(v => v.model === 'jd-6r250').pop();
    O.closeOffice();
    return { cards, gone: !V.vehicles.includes(old), hitched: tool.on === jd, paid: Math.round(m0 - z.G.money) };
  });
  check('obchod', Object.values(shopCheck.cards).every(n => n > 0) && shopCheck.gone && shopCheck.hitched && shopCheck.paid > 0 && shopCheck.paid < 3000000,
    Object.entries(shopCheck.cards).map(([k, n]) => k + ' ' + n).join(', ') + ' · protiúčet: doplaceno ' + shopCheck.paid + ' Kč');

  // shop pictures: the cards of a tab get their photos, the detail shows the model turning (not an empty canvas)
  const shots = await page.evaluate(async () => {
    const O = await import('/src/ui/office.js'), z = window.__zl, idle = z.renderer.render;
    z.renderer.render = z.realRender; // the studio draws with the game's renderer
    const spread = (src, w, h) => { // how much the picture's brightness varies: an empty or one-colour picture has ~0
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.drawImage(src, 0, 0, w, h);
      const d = x.getImageData(0, 0, w, h).data; let lo = 255, hi = 0;
      for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; lo = Math.min(lo, l); hi = Math.max(hi, l); }
      return hi - lo;
    };
    const frames = n => new Promise(r => { const f = () => (--n ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); });
    O.openOffice('shop');
    document.querySelector('button[data-act="shopgrp"][data-key="tools"]').click();
    const want = document.querySelectorAll('#officeBody .mcard .mthumb').length;
    for (let i = 0; i < 120 && document.querySelectorAll('#officeBody .mcard .mthumb img').length < want; i++) await frames(1);
    const imgs = [...document.querySelectorAll('#officeBody .mcard .mthumb img')];
    await Promise.all(imgs.map(im => im.decode()));
    const flat = imgs.filter(im => spread(im, 108, 40) < 40).length;
    document.querySelector('#officeBody .mcard').click();
    await frames(5);
    const view = document.querySelector('#officeBody canvas.mview'), turn = view ? spread(view, 150, 95) : 0;
    O.closeOffice(); z.renderer.render = idle;
    return { want, got: imgs.length, flat, turn: Math.round(turn) };
  });
  check('náhledy v obchodě', shots.want > 0 && shots.got === shots.want && !shots.flat && shots.turn > 40,
    shots.got + '/' + shots.want + ' fotek' + (shots.flat ? ', prázdných ' + shots.flat : '') + ' · otočný model kontrast ' + shots.turn);

  // sound: the engine recordings load, the machine you sit in plays its model's set, a machine you
  // just left is heard nearby and stops after a few seconds, the music files are there
  const snd = await page.evaluate(async () => {
    const A = await import('/src/audio.js'), E = await import('/src/audio/engines.js'), M = await import('/src/audio/music.js');
    const V = await import('/src/vehicles/vehicles.js'), z = window.__zl;
    if (!A.sound.on) A.toggleSound();
    await E.enginesReady();
    const t = V.firstOf('tractor'), c = V.firstOf('combine'), was = z.G.active;
    for (const v of [t, c]) Object.assign(v, { speed: 0, helper: null, fuel: v.fuelCap });
    Object.assign(c, { x: t.x + 20, z: t.z });
    z.G.active = c; z.step(20);
    z.G.active = t; z.step(30);
    const farm = () => E.engineVoices().filter(v => !v.traffic);
    const both = farm().map(v => v.set + (v.id === t.id ? '*' : '')).sort().join(',');
    z.step(240);
    const after = farm().map(v => v.set).join(',');
    const music = await Promise.all(M.TRACKS.map(tr => fetch(M.MUSIC_URL + tr.file, { method: 'HEAD' }).then(r => r.ok)));
    A.toggleSound(); z.G.active = was;
    return { ...E.engineFiles, both, after, music: music.filter(Boolean).length, tracks: M.TRACKS.length };
  });
  check('zvuk', snd.loaded === snd.total && !snd.failed && snd.both === 'big,tractor*' && snd.after === 'tractor' && snd.music === snd.tracks,
    'nahrávky ' + snd.loaded + '/' + snd.total + ' · slyšet ' + snd.both + ' → po 8 s ' + snd.after + ' · hudba ' + snd.music + '/' + snd.tracks);

  // driving and crashes: a car at top speed with full lock stays within the grip of the tyres; it
  // stops at a wall without going into it, glances off a wall at a shallow angle keeping most of
  // its speed, and passes a gap a little wider than itself
  const phys = await page.evaluate(async () => {
    const V = await import('/src/vehicles/vehicles.js'), L = await import('/src/world/layout.js'), M = await import('/src/game/machines.js'), z = window.__zl;
    if (!V.vehicles.some(v => v.model === 'dacia-duster')) { z.G.money += 1e7; M.buy('dacia-duster'); }
    const car = V.vehicles.filter(v => v.model === 'dacia-duster').pop(), f = z.fields.find(x => x.id === 2), dt = 1 / 60;
    const others = V.vehicles.filter(v => v !== car).map(v => ({ v, x: v.x, z: v.z }));
    others.forEach((o, i) => { o.v.x = -600 - i * 20; o.v.z = -600; });
    const cx = f.x0 + f.w / 2, cz = f.z0 + f.h / 2, wet = V.surface.wet, snow = V.surface.snow;
    V.surface.wet = false; V.surface.snow = false;
    const reset = (x, zz, h, speed) => Object.assign(car, { x, z: zz, h, speed, steer: 0, yaw: 0, lat: 0, hit: 0, knock: 0, offRoad: false, offT: 99 });
    // grip: the path's sideways acceleration
    reset(cx, cz, 0, car.vmax);
    let g = 0, px = car.x, pz = car.z, pd = null;
    for (let i = 0; i < 90 && !car.hit; i++) {
      V.drive(car, dt, { thr: 1, st: 1 });
      const vx = (car.x - px) / dt, vz = (car.z - pz) / dt, d = Math.atan2(vx, vz);
      if (pd != null && i > 20) g = Math.max(g, (Math.abs(((d - pd + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) / dt) * Math.hypot(vx, vz) / 9.81);
      pd = d; px = car.x; pz = car.z;
    }
    const wall = { x0: cx - 60, x1: cx + 60, z0: cz + 30, z1: cz + 31 };
    L.boxes.push(wall);
    const crash = ang => {
      reset(cx, wall.z0 - 2.4 - 16.7 * Math.cos(ang) * 0.3, ang, 16.7);
      let deep = 0;
      for (let i = 0; i < 60; i++) {
        V.drive(car, dt, null);
        const p = car.parts[0], s = Math.sin(car.h), c = Math.cos(car.h);
        for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) deep = Math.max(deep, car.z - a * p.hx * s + b * p.hz * c - wall.z0);
      }
      return { deep, kmh: car.speed * 3.6 };
    };
    const head = crash(0), glance = crash(1.22);
    L.boxes.splice(L.boxes.indexOf(wall), 1);
    const posts = [{ x: cx - 1.5, z: cz + 20, r: 0.3 }, { x: cx + 1.5, z: cz + 20, r: 0.3 }];
    L.circles.push(...posts);
    reset(cx, cz + 5, 0, 5);
    for (let i = 0; i < 300; i++) { V.drive(car, dt, { thr: 0.3, st: 0 }); car.speed = Math.min(car.speed, 5); }
    const through = car.z > cz + 23;
    L.circles.splice(L.circles.indexOf(posts[0]), 2);
    for (const o of others) { o.v.x = o.x; o.v.z = o.z; }
    V.surface.wet = wet; V.surface.snow = snow;
    return { g, head, glance, through };
  });
  check('jízda a nárazy', phys.g > 0.8 && phys.g < 1.1 && phys.head.deep < 0.05 && phys.head.kmh <= 0 && phys.head.kmh > -10 && phys.glance.deep < 0.05 && phys.glance.kmh > 35 && phys.through,
    'auto v plném rejdu ' + phys.g.toFixed(2) + ' g · čelně do zdi ' + Math.round(phys.head.kmh) + ' km/h, ve zdi ' + phys.head.deep.toFixed(2) + ' m · šikmo 20° dál ' + Math.round(phys.glance.kmh) + ' km/h · mezera 2,4 m ' + (phys.through ? 'projel' : 'neprojel'));

  // on foot: a new game starts at the farmhouse; E gets into the tractor beside you and out again
  // beside its cab; W walks the way he faces, A turns him; the farmhouse wall stops him; Tab seats you
  const foot = await page.evaluate(async () => {
    const V = await import('/src/vehicles/vehicles.js'), P = await import('/src/world/person.js'), z = window.__zl, out = { start: window.__startFoot };
    const was = z.G.active, t = V.firstOf('tractor');
    Object.assign(t, { speed: 0, helper: null });
    // stand 1.5 m left of the tractor's cab and press E
    z.G.onFoot = true; Object.assign(z.person, { x: t.x + Math.cos(t.h) * (t.bodyPart.hx + 1.5), z: t.z - Math.sin(t.h) * (t.bodyPart.hx + 1.5), speed: 0 });
    z.act('KeyE'); z.step(1);
    out.in = !z.G.onFoot && z.G.active === t;
    out.sits = z.person.group.parent === t.group && z.person.group.visible; // seen sitting in the cab
    // V: the camera at his eyes in the cab, his hands on the wheel; V again: back behind the tractor
    const C = (await import('/src/render/camera.js')), camera = (await import('/src/render/core.js')).camera;
    z.act('KeyV'); z.step(2);
    const eye = t.group.localToWorld(new (camera.position.constructor)(t.seat.x, t.seat.y + 0.62, t.seat.z + 0.05));
    out.cab = camera.position.distanceTo(eye) < 0.05 && camera.near < 0.1;
    z.act('KeyV'); z.step(2);
    out.cab = out.cab && camera.near === 0.5 && !C.cam.cab;
    z.act('KeyE');
    out.out = z.G.onFoot && Math.hypot(z.person.x - t.x, z.person.z - t.z) < t.bodyPart.hz + 3;
    // walk 2 s straight ahead
    const x0 = z.person.x, z0 = z.person.z;
    z.hold('KeyW', 60);
    out.walked = Math.hypot(z.person.x - x0, z.person.z - z0);
    // walk into the farmhouse wall (box x −38.6…−29.4, z −22.6…−15.4) from the south
    Object.assign(z.person, { x: -34, z: -12, speed: 0, h: Math.PI }); z.G.active = t; // facing north, the house
    z.hold('KeyW', 90);
    out.wall = z.person.z;
    // A turns him left without moving him
    const h0 = z.person.h, at = [z.person.x, z.person.z];
    z.hold('KeyA', 15);
    out.turn = z.person.h - h0; out.still = Math.hypot(z.person.x - at[0], z.person.z - at[1]) < 0.3;
    // Tab from foot: into the nearest machine
    z.act('Tab');
    out.tab = !z.G.onFoot;
    P.seat(was);
    return out;
  });
  check('chůze a nastupování', foot.start && foot.in && foot.sits && foot.cab && foot.out && foot.walked > 3 && foot.wall >= -15.4 + 0.3 && foot.wall < -14.5 && foot.turn > 1 && foot.still && foot.tab,
    'nová hra pěšky ' + (foot.start ? 'ano' : 'ne') + ' · nastoupil ' + (foot.in ? 'ano' : 'ne') + (foot.sits ? ', sedí v kabině' : ', v kabině není vidět') + (foot.cab ? ' · pohled z kabiny ano' : ' · pohled z kabiny ne') + ' · vystoupil vedle kabiny ' + (foot.out ? 'ano' : 'ne') + ' · ušel ' + foot.walked.toFixed(1) + ' m · u zdi domu z ' + foot.wall.toFixed(2) + ' · A otočí o ' + foot.turn.toFixed(2) + ' rad · Tab ' + (foot.tab ? 'do stroje' : 'nic'));

  // every model in the catalog: buy one piece, it has the catalog's numbers
  const models = await page.evaluate(async () => {
    const M = await import('/src/game/machines.js'), V = await import('/src/vehicles/vehicles.js'), C = await import('/src/game/catalog.js'), z = window.__zl;
    z.G.money = 1e11; const bad = [];
    for (const m of C.MODELS) {
      if (!M.buy(m.id)) { bad.push(m.id + ' nejde koupit'); continue; }
      const p = [...V.vehicles, ...V.tools].filter(x => x.model === m.id).pop();
      if (m.width && Math.abs(p.width - m.width) > 1e-6) bad.push(m.id + ' záběr ' + p.width);
      if (m.cap && (p.tank?.cap ?? p.waterCap) !== m.cap) bad.push(m.id + ' objem');
      if (m.header && p.toolW !== m.header) bad.push(m.id + ' lišta');
      if (m.tank && p.tank.cap !== m.tank) bad.push(m.id + ' zásobník');
      if (m.kmh && Math.round(p.vmax * 3.6) !== m.kmh) bad.push(m.id + ' rychlost');
      if (m.logs && p.logCap !== m.logs) bad.push(m.id + ' dřevo');
    }
    z.step(3);
    for (const p of [...V.vehicles, ...V.tools]) if (!Number.isFinite(p.x ?? p.group.position.x)) bad.push(p.id + ' poloha');
    return { n: C.MODELS.length, bad };
  });
  check('všechny modely', models.bad.length === 0, models.n + ' modelů' + (models.bad.length ? ' · ' + models.bad.slice(0, 6).join(', ') : ''));

  // tractor power: a 10 m cultivator works slower behind the 140 hp Brázda than behind the Fendt; a full big trailer slows it down
  const power = await page.evaluate(async () => {
    const V = await import('/src/vehicles/vehicles.js'), z = window.__zl;
    const br = V.vehicles.find(v => v.model === 'brazda-140'), fe = V.vehicles.find(v => v.model === 'fendt-942');
    const h10 = V.tools.find(t => t.model === 'horsch-terrano-10'), an = V.tools.find(t => t.model === 'annaburger-40');
    V.attachTool(br, h10); const brWork = br.vwork / h10.speed;
    V.attachTool(fe, h10); const feWork = fe.vwork / h10.speed;
    V.attachTool(br, an); const empty = V.towShare(br); an.tank = { crop: 0, amount: an.tank.cap, cap: an.tank.cap }; const full = V.towShare(br);
    an.tank = { crop: -1, amount: 0, cap: an.tank.cap };
    return { brWork: +brWork.toFixed(2), feWork: +feWork.toFixed(2), empty: +empty.toFixed(2), full: +full.toFixed(2) };
  });
  check('výkon traktoru', power.brWork === 0.4 && power.feWork === 1 && power.empty === 1 && power.full < 0.6,
    'Horsch 10 m: Brázda ' + Math.round(power.brWork * 100) + ' %, Fendt ' + Math.round(power.feWork * 100) + ' % · plný Annaburger za Brázdou ' + Math.round(power.full * 100) + ' %');

  // an hour of game time at full speed: traffic, animals, growth, helpers' world
  await page.evaluate(() => { const z = window.__zl; z.G.tsIdx = 2; z.step(1800, 0.05); z.G.tsIdx = 0; });
  check('hodina herního času', true);

  // save and load: money, a field, every machine and implement with its id, hitch and load
  const saved = await page.evaluate(async () => {
    const save = await import('/src/game/save.js'), z = window.__zl;
    const fleet = () => z.vehicles.map(v => v.id + (v.tool ? '+' + v.tool.id : '')).join(' ') + ' | ' + z.tools.map(t => t.id + (t.tank ? ':' + Math.round(t.tank.amount) : '')).join(' ');
    const tr = z.tools.find(t => t.key === 'trailer'); tr.tank = { crop: 1, amount: 4321, cap: tr.tank.cap };
    const f1 = z.fields.find(x => x.id === 1), before = { money: Math.round(z.G.money), cut: f1.state.filter(s => s === 0).length, fleet: fleet() };
    save.saveLocal(); z.G.money = 1;
    const ok = save.loadLocal();
    return { ok, before, after: { money: Math.round(z.G.money), cut: z.fields.find(x => x.id === 1).state.filter(s => s === 0).length, fleet: fleet() } };
  });
  check('uložení a načtení', saved.ok && saved.after.money === saved.before.money && saved.after.cut === saved.before.cut && saved.after.fleet === saved.before.fleet,
    'peníze ' + saved.after.money + ' · ' + saved.after.fleet);

  // a save from before the fleet (version 4): one piece of every owned machine, loads and the hitch carried over
  const old = await page.evaluate(async () => {
    const save = await import('/src/game/save.js'), z = window.__zl, d = save.serialize();
    const v4 = { ...d, v: 4, active: 'combine', fleet: undefined, tools: undefined };
    v4.veh = [
      { x: 10, z: -30, h: 0, impl: 'trailer', seedCrop: 2, fuel: 100 },
      { x: -5, z: 0, h: 1, tank: { crop: 0, amount: 3000, cap: 9000 }, header: 'grain', fuel: 400 },
      { x: 18, z: -27, h: 0 }, { x: 0, z: 116, h: 0 }, { x: -27, z: -27, h: 0 },
    ];
    v4.machines = { tractor: 'own', combine: 'own', cultivator: 'own', seeder: 'lease', trailer: 'own', forest: 'own', cows: 'own', upTrailer: 'own' };
    v4.cond = { tractor: 0.5, trailer: 0.8 };
    v4.trailer = { tank: { crop: 0, amount: 7000 }, bales: 0, hay: 0 }; v4.logs = 6;
    const ok = save.applySave(v4);
    const t = z.vehicles.find(v => v.type === 'tractor'), c = z.vehicles.find(v => v.type === 'combine'), f = z.vehicles.find(v => v.type === 'forest');
    return {
      ok, types: z.vehicles.map(v => v.type).join(','), tools: z.tools.map(x => x.key + (x.own === 'lease' ? '*' : '')).join(','),
      hitch: t.tool?.key, trailer: Math.round(t.tool?.tank.amount || 0), trailerModel: t.tool?.model, trailerCap: t.tool?.tank.cap, cond: t.cond, seed: t.seedCrop, combine: Math.round(c.tank.amount), logs: f?.logs, active: z.G.active.type, cows: !!z.G.machines.cows,
    };
  });
  check('převod uložení z verze 4', old.ok && old.types === 'tractor,combine,forest' && old.tools === 'cultivator,seeder*,trailer' && old.hitch === 'trailer' && old.trailer === 7000 &&
    old.cond === 0.5 && old.seed === 2 && old.combine === 3000 && old.logs === 6 && old.active === 'combine' && old.cows && old.trailerModel === 'fliegl-22' && old.trailerCap === 22000, JSON.stringify(old));

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
