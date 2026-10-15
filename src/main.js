import './styles.css';
import { renderer, scene, camera, canvas, resize, applyRenderQuality, setShadowSize } from './render/core.js';
import { quality, settings, saveSettings } from './core/settings.js';
import { buildTerrain } from './world/terrain.js';
import { buildFarm } from './world/buildings.js';
import { buildVegetation } from './world/vegetation.js';
import { FIELDS, flushFields, growFields, countFields, drawSigns, setCropShadows, setCropDetail } from './world/fields.js';
import { vehicles, trailer, drive, visual, updateTrailer, attachImpl } from './vehicles/vehicles.js';
import { CROPS } from './game/crops.js';
import { work, updateLogistics } from './game/work.js';
import { G, TIME_SCALES } from './game/state.js';
import { newGame, loadLocal, saveLocal, exportFile, importFile } from './game/save.js';
import { toggleTool, switchVehicle, doF, cycleSeed, cycleTime, pickInShed, repairHere, toggleHelper } from './game/actions.js';
import { helperTick } from './game/helpers.js';
import { buildFarmstead } from './world/farmstead.js';
import { growForest, trees as forestTrees } from './world/forest.js';
import { farmTick, sellProducts } from './game/farm.js';
import { forestryTick } from './game/forestry.js';
import { has, ownershipHooks } from './game/machines.js';
import { upkeep, chargeDays } from './game/economy.js';
import { generateOffers, checkContract } from './game/contracts.js';
import { initOffice, openOffice, closeOffice, officeOpen } from './ui/office.js';
import { flushBales, bales, addBale } from './world/bales.js';
import { bindInput, driveInput, releaseAll } from './core/input.js';
import { cam, bindCamera, updateCamera } from './render/camera.js';
import { updEnv, updSeasonTint, snapSeasonTint } from './render/environment.js';
import { WX, updateWeather, season, isWinter } from './game/weather.js';
import { updRain } from './fx/rain.js';
import { updParticles } from './fx/particles.js';
import { updUI, updSlowUI } from './ui/hud.js';
import { sizeMinimap, drawMinimap } from './ui/minimap.js';
import { initMenu, showMenu, hideMenu, menuOpen } from './ui/menu.js';
import { perfSample } from './ui/perf.js';
import { toast } from './ui/toast.js';
import { toggleSound, updAudio, sound } from './audio.js';

/* ---------- world ---------- */
const terrain = buildTerrain(scene);
const { rotors } = buildFarm(scene);
const vegetation = buildVegetation(scene);
const farmstead = buildFarmstead();
ownershipHooks.push(() => { for (const k of ['cows', 'hens', 'greenhouse1', 'greenhouse2']) farmstead.setOwned(k, has(k)); });

function applyQuality() {
  const q = quality();
  applyRenderQuality();
  vegetation.setDensity(q.trees);
  setCropShadows(q.cropShadows);
  setCropDetail(!!q.cropDetail);
}

/* ---------- game start ---------- */
const hasSave = loadLocal();
if (!hasSave) newGame();
snapSeasonTint(terrain.material, vegetation.leafMat, season());
cam.yaw = G.active.h;
cam.t.set(G.active.x, 1, G.active.z);

/* ---------- input & menu ---------- */
const ACTIONS = { Space: toggleTool, Tab: switchVehicle, KeyF: doF, KeyC: cycleSeed, KeyT: cycleTime, KeyR: repairHere, KeyK: () => openOffice(), KeyH: toggleHelper };
bindInput(code => {
  if (menuOpen()) { if (code === 'Escape' || code === 'Enter') hideMenu(); return; }
  if (officeOpen()) { if (code === 'Escape' || code === 'KeyK') closeOffice(); return; }
  if (code === 'Escape') { showMenu(); return; }
  if (/^Digit[1-7]$/.test(code)) { pickInShed(+code.slice(5)); return; }
  ACTIONS[code]?.();
});
bindCamera(canvas);
initMenu({
  hasProgress: () => hasSave,
  onPlay: () => { G.playing = true; releaseAll(); if (settings.sound && !sound.on) setSound(toggleSound()); },
  onPause: () => { G.playing = false; saveLocal(); },
  onNew: () => { newGame(); saveLocal(); cam.manual = -99; toast('Nová sezóna začíná. Pole 1 je zralé.'); },
  onQuality: applyQuality,
  onExport: () => { saveLocal(); exportFile(); },
  onImport: async file => { const ok = await importFile(file); if (ok) cam.manual = -99; return ok; },
});
initOffice({
  onOpen: () => { G.playing = false; releaseAll(); },
  onClose: () => { if (!menuOpen()) G.playing = true; releaseAll(); },
  onChange: saveLocal,
});
document.getElementById('officeBtn').onclick = () => openOffice();
document.getElementById('speedBtn').onclick = cycleTime;
document.getElementById('menuBtn').onclick = showMenu;
// sound starts with the first click on "Hrát" (browsers only allow audio after a click) unless turned off
function setSound(on) { document.getElementById('soundBtn').textContent = on ? 'Zvuk: zap.' : 'Zvuk: vyp.'; }
document.getElementById('soundBtn').onclick = () => { const on = toggleSound(); setSound(on); settings.sound = on; saveSettings(); };

addEventListener('resize', () => { resize(); sizeMinimap(); });
applyQuality();
sizeMinimap();
updSlowUI();
showMenu();
document.fonts?.ready.then(() => { drawSigns(); sizeMinimap(); });

setInterval(() => { if (G.playing) saveLocal(); }, 20000);
addEventListener('pagehide', saveLocal);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveLocal(); });

/* ---------- main loop ---------- */
let slowT = 0, mapT = 0, forestHours = 0;
function tick(dt) {
  if (G.playing) {
    const gm = dt * TIME_SCALES[G.tsIdx];
    G.gameMin += gm;
    updateWeather(dt);
    growFields((gm / 60) * season().growth * (WX.kind === 'rain' ? 1.1 : 1));
    farmTick(gm / 60);
    forestHours += gm / 60;
    upkeep(dt);
    if (chargeDays()) { sellProducts(); generateOffers(); saveLocal(); }
  }
  const input = G.playing ? driveInput() : null;
  for (const v of vehicles) {
    if (v.helper && G.playing) helperTick(v, dt);
    else if (!v.helper) drive(v, dt, v === G.active && !v.cutting ? input : null);
    work(v, dt);
    visual(v, dt, v.tank.crop >= 0 ? CROPS[v.tank.crop].heapCol : null);
  }
  updateTrailer(dt, trailer.tank.crop >= 0 ? CROPS[trailer.tank.crop].heapCol : null);
  updateLogistics(dt, saveLocal);
  flushFields();
  flushBales();
  forestryTick(dt);
  farmstead.update(dt);
  updParticles(dt);
  for (const r of rotors) r.rotation.z += dt * 0.9;

  updateCamera(dt, G.active);
  setShadowSize(Math.min(150, Math.max(55, cam.dist * 1.5)));
  updEnv(cam.t, G.gameMin, vehicles, G.active, WX);
  updSeasonTint(dt, terrain.material, vegetation.leafMat, season());
  updRain(dt, cam.t, WX.rain, isWinter());
  if (G.flashT > 0) G.flashT -= dt;
  updUI();
  updAudio(G.active, { playing: G.playing, rain: WX.rain, hour: (G.gameMin / 60) % 24, flash: G.flashT, money: G.money, winter: isWinter() });
  slowT -= dt; if (slowT <= 0) { slowT = 0.5; countFields(); checkContract(saveLocal); growForest(forestHours, isWinter() ? 0.25 : 1); forestHours = 0; updSlowUI(); }
  mapT -= dt; if (mapT <= 0) { mapT = 0.12; drawMinimap(); }
  renderer.render(scene, camera);
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000;
  last = now;
  perfSample(raw);
  tick(Math.min(0.05, raw));
}
requestAnimationFrame(frame);

// Test hook for automated checks during development only; not part of the production build.
if (import.meta.env.DEV) {
  window.__zl = {
    step(n = 1, dt = 1 / 30) { for (let i = 0; i < n; i++) tick(dt); },
    act: code => ACTIONS[code]?.(),
    set: o => Object.assign(G.active, o),
    G, vehicles, trailer, renderer, attach: attachImpl, pick: pickInShed, fields: FIELDS, forest: forestTrees, bales, addBale,
    size(w, h) { renderer.setPixelRatio(1); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); },
  };
}
