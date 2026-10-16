import { fmt } from '../core/util.js';
import { G, DEV, TIME_SCALES, dayOf } from '../game/state.js';
import { WX, season, seasonIdx, SEASONS, dayInSeason, DAYS_PER_SEASON } from '../game/weather.js';
import { PRESETS, settings, saveSettings, quality, gpuName, startAntialias } from '../core/settings.js';
import { renderer } from '../render/core.js';
import { cam } from '../render/camera.js';
import { skyParts } from '../render/sky.js';
import { wind } from '../render/wind.js';
import { particleMesh } from '../fx/particles.js';
import { vehicles, tools, attachTool } from '../vehicles/vehicles.js';
import { CATALOG, applyOwnership, has, buy } from '../game/machines.js';
import { MARKETS } from '../game/markets.js';
import { BUILDINGS, waterCap } from '../game/farm.js';
import { activeGoals, emptyStats } from '../game/goals.js';
import { S_SOWN, S_RIPE, S_NONE } from '../game/crops.js';
import { FIELDS, refreshField, flushFields, countFields, drawSigns } from '../world/fields.js';
import { SAWMILL, POND } from '../world/layout.js';
import { saveLocal } from '../game/save.js';
import { toast } from './toast.js';
import { toggleMapEditor } from './mapeditor.js';
import { MODELS, modelName } from '../game/catalog.js';
import { engineTest, engineInfo } from '../audio/engines.js';

/** Machines with an engine, for the engine sound test. */
const ENGINE_MODELS = MODELS.filter(m => ['tractor', 'combine', 'beet', 'forest', 'jeep'].includes(m.kind));

/**
 * Developer panel (F9): time, weather, graphics details, world switches, cheats and live info.
 * Available in the development server, or in a build opened with ?dev in the address.
 */
export const devEnabled = import.meta.env.DEV || /[?&]dev\b/.test(location.search);

let box = null, hooks = null, infoT = 0;
const $ = sel => box.querySelector(sel);
const hhmm = m => { const h = Math.floor((m / 60) % 24), mm = Math.floor(m % 60); return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };

const PLACES = [
  ['Dvůr', -10, -28],
  ...FIELDS.map(f => ['Pole ' + f.id, f.x0 - 3, f.z0 + f.h / 2]),
  ...MARKETS.map(m => [m.name, m.x, m.z + 6]),
  ['Pila', SAWMILL.x + 6, SAWMILL.z - 6],
  ['Rybník', POND.x, POND.z + POND.r + 6],
  ['Les (cesta)', 60, 106],
];

/* ---------- markup ---------- */
const sec = (title, inner, open = true) => `<details${open ? ' open' : ''}><summary>${title}</summary><div class="devsec">${inner}</div></details>`;
const range = (id, label, min, max, step) => `<label class="devrow"><span>${label} <output id="${id}Out"></output></span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}"></label>`;
const check = (id, label) => `<label class="devcheck"><input type="checkbox" id="${id}"> ${label}</label>`;
const button = (act, label) => `<button class="chipbtn" data-dev="${act}">${label}</button>`;
const select = (id, label, opts) => `<label class="devrow"><span>${label}</span><select id="${id}">${opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}</select></label>`;

function html() {
  return `<div class="devhead"><b>Vývojářský režim</b><span class="muted">F9</span><button class="chipbtn" data-dev="close">Zavřít</button></div>
  ${sec('Čas', `
    <p class="devread" id="devTime"></p>
    ${range('devHour', 'Hodina', 0, 23.75, 0.25)}
    <div class="devbtns">${button('dayBack', '− 1 den')}${button('dayFwd', '+ 1 den')}${button('season', 'Další období')}</div>
    ${select('devSpeed', 'Rychlost času', TIME_SCALES.map((s, i) => [i, s + '×']))}
    ${select('devMult', 'Násobič navíc', [1, 2, 5, 10, 30, 60].map(m => [m, m + '×']))}
    ${check('devFreeze', 'Zastavit čas (stroje dál jezdí)')}`)}
  ${sec('Počasí', `
    <p class="devread" id="devWx"></p>
    <div class="devbtns">${button('wx:auto', 'Podle předpovědi')}${button('wx:clear', 'Jasno')}${button('wx:cloudy', 'Oblačno')}${button('wx:rain', 'Déšť')}</div>`)}
  ${sec('Grafika', `
    ${select('devPreset', 'Předvolba', Object.entries(PRESETS).map(([k, p]) => [k, p.label]))}
    ${range('devScale', 'Rozlišení', 0.4, 1, 0.05)}
    ${select('devShadowMap', 'Stínová mapa', [512, 1024, 2048, 4096].map(n => [n, n + ' px']))}
    ${range('devView', 'Dohled (m)', 250, 900, 10)}
    ${range('devTrees', 'Hustota stromů', 0, 2, 0.1)}
    ${range('devExposure', 'Expozice', 0.6, 1.6, 0.05)}
    ${check('devShadows', 'Stíny')}
    ${check('devCropShadows', 'Stíny plodin')}
    ${check('devCropDetail', 'Plastické plodiny (snopky)')}
    <div class="devbtns">${button('gfxReset', 'Zpět na předvolbu')}</div>
    <p class="muted" id="devGfxNote"></p>`)}
  ${sec('Svět', `
    ${check('devSky', 'Obloha a hvězdy')}
    ${check('devClouds', 'Mraky')}
    ${check('devAnimals', 'Zvířata')}
    ${check('devWind', 'Vítr ve vegetaci')}
    ${check('devTracks', 'Stopy kol a prach')}
    ${check('devParticles', 'Částice (prach, kouř, plevy)')}
    ${check('devHud', 'Skrýt HUD (na snímky obrazovky)')}`, false)}
  ${sec('Mapa', `
    <p class="muted">Přesouvej a měň pole, louky, cesty, rybníky a lesy. Změny se uloží do src/world/map.json.</p>
    <div class="devbtns">${button('mapEdit', 'Editor mapy')}</div>`)}
  ${sec('Zvuk motoru', `
    <p class="muted">Stroj, ve kterém sedíš, hraje motor zvoleného modelu v zadaných otáčkách a zátěži, i v menu.</p>
    ${check('devSndTest', 'Zkoušet zvuk motoru')}
    ${select('devSndModel', 'Model', ENGINE_MODELS.map(m => [m.id, modelName(m)]))}
    ${range('devSndRpm', 'Otáčky', 0, 1, 0.01)}
    ${range('devSndLoad', 'Zátěž', 0, 1, 0.01)}
    <pre class="devinfo" id="devSnd"></pre>`, false)}
  ${sec('Hra', `
    <div class="devbtns">${button('money1', '+ 100 000 Kč')}${button('money2', '+ 1 000 000 Kč')}</div>
    <div class="devbtns">${button('unlock', 'Všechny stroje a budovy')}${button('service', 'Natankovat a opravit')}</div>
    <div class="devbtns">${button('ripen', 'Dozrát osetá pole')}${button('ripeAll', 'Vlastní pole zralá')}</div>
    <div class="devbtns">${button('fields', 'Koupit všechna pole')}${button('feed', 'Plné krmivo a voda')}</div>
    <div class="devbtns">${button('goal', 'Splnit aktivní cíl')}${button('goalsReset', 'Vynulovat cíle')}</div>
    ${select('devPlace', 'Přesunout stroj', PLACES.map(([n], i) => [i, n]))}
    <div class="devbtns">${button('teleport', 'Přesunout')}</div>`, false)}
  ${sec('Info', `<pre class="devinfo" id="devInfo"></pre>`)}`;
}

/* ---------- state → controls ---------- */
function syncControls() {
  const q = quality();
  const hour = (G.gameMin / 60) % 24;
  setVal('devHour', Math.floor(hour * 4) / 4, hhmm(G.gameMin));
  $('#devSpeed').value = G.tsIdx; $('#devMult').value = DEV.timeMult; $('#devFreeze').checked = DEV.freezeTime;
  $('#devPreset').value = settings.preset;
  setVal('devScale', q.scale, Math.round(q.scale * 100) + ' %');
  $('#devShadowMap').value = q.shadowMap;
  setVal('devView', q.view, q.view);
  setVal('devTrees', q.trees, String(q.trees.toFixed(1)).replace('.', ','));
  setVal('devExposure', q.exposure ?? 1, String((q.exposure ?? 1).toFixed(2)).replace('.', ','));
  $('#devShadows').checked = q.shadows !== false;
  $('#devCropShadows').checked = !!q.cropShadows;
  $('#devCropDetail').checked = !!q.cropDetail;
  $('#devGfxNote').textContent = (settings.custom ? 'Vlastní úpravy předvolby ' + PRESETS[settings.preset].label + '. ' : '') +
    'Vyhlazování hran se mění jen v menu a po obnovení stránky' + (q.antialias !== startAntialias ? ' (čeká na obnovení).' : '.');
  $('#devSky').checked = skyParts.dome.visible; $('#devClouds').checked = skyParts.clouds.visible;
  $('#devAnimals').checked = DEV.wildlife; $('#devWind').checked = DEV.wind; $('#devTracks').checked = DEV.tracks;
  $('#devParticles').checked = particleMesh.visible; $('#devHud').checked = document.body.classList.contains('dev-nohud');
  $('#devSndTest').checked = engineTest.on; $('#devSndModel').value = engineTest.model;
  setVal('devSndRpm', engineTest.rpm, Math.round(engineTest.rpm * 100) + ' %');
  setVal('devSndLoad', engineTest.load, Math.round(engineTest.load * 100) + ' %');
}
function setVal(id, v, shown) { $('#' + id).value = v; $('#' + id + 'Out').textContent = shown; }

function info() {
  const v = G.active, r = renderer.info.render, q = quality();
  $('#devTime').textContent = 'Den ' + (dayOf(G.gameMin) + 1) + ' · ' + hhmm(G.gameMin) + ' · ' + season().name + ' (den ' + dayInSeason() + ' ze ' + DAYS_PER_SEASON + ')' + (DEV.freezeTime ? ' · stojí' : '');
  $('#devWx').textContent = 'Teď: ' + WX.kind + (WX.force ? ' (vynuceno)' : ' (předpověď)') + ' · déšť ' + WX.rain.toFixed(2) + ' · oblačnost ' + WX.cloud.toFixed(2);
  if (document.activeElement !== $('#devHour')) setVal('devHour', Math.floor(((G.gameMin / 60) % 24) * 4) / 4, hhmm(G.gameMin));
  $('#devInfo').textContent = [
    'GPU: ' + gpuName,
    'Předvolba: ' + PRESETS[settings.preset].label + (settings.custom ? ' + úpravy' : '') + ' · ' + renderer.domElement.width + '×' + renderer.domElement.height + ' px',
    'Volání: ' + r.calls + ' · trojúhelníky: ' + fmt(r.triangles),
    'Geometrie: ' + renderer.info.memory.geometries + ' · textury: ' + renderer.info.memory.textures + ' · shadery: ' + renderer.info.programs.length,
    'Stroj: ' + v.name + ' · x ' + v.x.toFixed(1) + ' z ' + v.z.toFixed(1) + ' · směr ' + Math.round(((v.h * 180) / Math.PI) % 360) + '°',
    'Rychlost: ' + (Math.abs(v.speed) * 3.6).toFixed(1) + ' km/h · nafta ' + Math.round(v.fuel) + ' l',
    'Čas hry: ' + Math.round(G.gameMin) + ' min · vítr ' + wind.strength.value.toFixed(2) + ' · stín ' + (quality().shadowMap) + ' px',
    'Kamera: vzdálenost ' + cam.dist.toFixed(0) + ' m · sklon ' + cam.pitch.toFixed(2),
    q.cropDetail ? 'Plodiny: snopky' : 'Plodiny: kvádry',
  ].join('\n');
  $('#devSnd').textContent = engineInfo(v);
}

/* ---------- actions ---------- */
function setCustom(key, value) {
  settings.custom = { ...(settings.custom || {}), [key]: value };
  saveSettings(); hooks.applyQuality(); syncControls();
}
function setHour(h) { G.gameMin = dayOf(G.gameMin) * 1440 + h * 60; }
function addDays(n) {
  G.gameMin = Math.max(0, G.gameMin + n * 1440);
  if (n < 0) G.lastDay = dayOf(G.gameMin); // no double charges when going back
}
function nextSeason() {
  const day = dayOf(G.gameMin), next = (Math.floor(day / DAYS_PER_SEASON) + 1) * DAYS_PER_SEASON;
  G.gameMin = next * 1440 + (G.gameMin % 1440);
  toast('Období: ' + SEASONS[seasonIdx(next)].name);
}
function forceWeather(k) {
  WX.force = k === 'auto' ? null : k;
  if (WX.force) { WX.kind = k; WX.rain = k === 'rain' ? 1 : 0; WX.cloud = k === 'clear' ? 0 : 1; }
}
function ripen(all) {
  for (const f of FIELDS) {
    if (!f.owned) continue;
    for (let i = 0; i < f.n; i++) {
      if (f.state[i] === S_NONE) continue;
      if (f.state[i] === S_SOWN || all) {
        if (f.state[i] !== S_SOWN && f.state[i] !== S_RIPE) f.crop[i] = 0;
        f.state[i] = S_RIPE; f.stage[i] = 4; f.straw[i] = 0;
      }
    }
    refreshField(f);
  }
  flushFields(); countFields();
}
function teleport(i) {
  const [name, x, z] = PLACES[i], v = G.active;
  if (v.helper) { toast('Stroj řídí pomocník.', 'bad'); return; }
  Object.assign(v, { x, z, speed: 0 });
  if (v.tool) attachTool(v, v.tool); // puts the trailer or tool back behind the tractor
  cam.t.set(x, 1, z);
  toast(v.name + ': ' + name);
}

const ACTS = {
  close: () => toggleDev(false),
  dayBack: () => addDays(-1), dayFwd: () => addDays(1), season: nextSeason,
  'wx:auto': () => forceWeather('auto'), 'wx:clear': () => forceWeather('clear'), 'wx:cloudy': () => forceWeather('cloudy'), 'wx:rain': () => forceWeather('rain'),
  gfxReset: () => { settings.custom = null; saveSettings(); hooks.applyQuality(); syncControls(); },
  money1: () => { G.money += 100000; G.flashT = 0.4; }, money2: () => { G.money += 1000000; G.flashT = 0.4; },
  unlock: () => {
    const money = G.money; G.money = 1e12;
    for (const c of CATALOG) if (!has(c.key)) buy(c.key);
    G.money = money; applyOwnership(); toast('Vlastníš všechny stroje, budovy a vylepšení.', 'good');
  },
  service: () => { for (const p of [...vehicles, ...tools]) p.cond = 1; for (const v of vehicles) v.fuel = v.fuelCap; for (const k in G.cond) G.cond[k] = 1; toast('Stroje natankované a opravené.', 'good'); },
  ripen: () => ripen(false), ripeAll: () => ripen(true),
  fields: () => {
    for (const f of FIELDS) f.owned = true;
    G.contracts.active = null; G.contracts.offers = [];
    drawSigns(); countFields(); toast('Všechna pole jsou tvoje.', 'good');
  },
  feed: () => { for (const k in BUILDINGS) G.farm[BUILDINGS[k].store] = BUILDINGS[k].cap; for (const p in G.farm.mix) G.farm.mix[p] = BUILDINGS.cows.cap / 3; G.farm.water = waterCap(); toast('Krmelce a voda jsou plné.', 'good'); },
  goal: () => { const g = activeGoals()[0]; if (g) { G.goals.push(g.id); toast('Cíl označen jako splněný: ' + g.title); } },
  goalsReset: () => { G.goals = []; G.stats = emptyStats(); toast('Cíle a statistiky vynulovány.'); },
  teleport: () => teleport(+$('#devPlace').value),
  mapEdit: () => { toggleDev(false); toggleMapEditor(true); },
};
// actions that change the saved game are saved right away
const SAVES = new Set(['unlock', 'service', 'ripen', 'ripeAll', 'fields', 'feed', 'goal', 'goalsReset', 'money1', 'money2', 'dayBack', 'dayFwd', 'season']);

function bind() {
  box.addEventListener('click', e => {
    const a = e.target.closest('[data-dev]')?.dataset.dev;
    if (!a) return;
    ACTS[a]?.();
    if (SAVES.has(a)) saveLocal();
    if (box.hidden) return;
    syncControls(); info();
  });
  const on = (id, ev, fn) => $('#' + id).addEventListener(ev, e => { fn(e.target); if (!box.hidden) info(); });
  on('devHour', 'input', t => { setHour(+t.value); $('#devHourOut').textContent = hhmm(G.gameMin); });
  on('devSpeed', 'change', t => { G.tsIdx = +t.value; });
  on('devMult', 'change', t => { DEV.timeMult = +t.value; });
  on('devFreeze', 'change', t => { DEV.freezeTime = t.checked; });
  on('devPreset', 'change', t => { settings.preset = t.value; settings.custom = null; saveSettings(); hooks.applyQuality(); syncControls(); });
  on('devScale', 'change', t => setCustom('scale', +t.value));
  on('devShadowMap', 'change', t => setCustom('shadowMap', +t.value));
  on('devView', 'change', t => setCustom('view', +t.value));
  on('devTrees', 'change', t => setCustom('trees', +t.value));
  on('devExposure', 'input', t => setCustom('exposure', +t.value));
  on('devShadows', 'change', t => setCustom('shadows', t.checked));
  on('devCropShadows', 'change', t => setCustom('cropShadows', t.checked));
  on('devCropDetail', 'change', t => setCustom('cropDetail', t.checked));
  on('devSky', 'change', t => { skyParts.dome.visible = skyParts.stars.visible = t.checked; });
  on('devClouds', 'change', t => { skyParts.clouds.visible = t.checked; });
  on('devAnimals', 'change', t => { DEV.wildlife = t.checked; hooks.wildlife.setVisible(t.checked); });
  on('devWind', 'change', t => { DEV.wind = t.checked; if (!t.checked) wind.strength.value = 0; });
  on('devTracks', 'change', t => { DEV.tracks = t.checked; });
  on('devParticles', 'change', t => { particleMesh.visible = t.checked; });
  on('devHud', 'change', t => { document.body.classList.toggle('dev-nohud', t.checked); });
  on('devSndTest', 'change', t => { engineTest.on = t.checked; });
  on('devSndModel', 'change', t => { engineTest.model = t.value; });
  on('devSndRpm', 'input', t => { engineTest.rpm = +t.value; $('#devSndRpmOut').textContent = Math.round(t.value * 100) + ' %'; });
  on('devSndLoad', 'input', t => { engineTest.load = +t.value; $('#devSndLoadOut').textContent = Math.round(t.value * 100) + ' %'; });
  // live labels while dragging
  for (const [id, f] of [['devScale', v => Math.round(v * 100) + ' %'], ['devView', v => v], ['devTrees', v => String((+v).toFixed(1)).replace('.', ',')]]) {
    $('#' + id).addEventListener('input', e => { $('#' + id + 'Out').textContent = f(e.target.value); });
  }
}

/** hooks = { applyQuality, wildlife } */
export function initDev(h) {
  if (!devEnabled) return;
  hooks = h;
  box = document.createElement('aside');
  box.id = 'devPanel'; box.className = 'devpanel'; box.hidden = true;
  box.setAttribute('aria-label', 'Vývojářský režim');
  box.innerHTML = html();
  document.body.append(box);
  bind();
  const chip = document.createElement('button');
  chip.className = 'chipbtn'; chip.textContent = 'Dev'; chip.title = 'Vývojářský režim (F9)';
  chip.onclick = () => toggleDev();
  document.getElementById('menuBtn').after(chip);
}

export function toggleDev(on = box?.hidden) {
  if (!box) return;
  box.hidden = !on;
  if (on) { syncControls(); info(); }
}

/** Per frame from the main loop: refreshes the readouts twice a second while open. */
export function updDev(dt) {
  if (!box || box.hidden) return;
  if ((infoT -= dt) > 0) return;
  infoT = 0.5;
  info();
}
