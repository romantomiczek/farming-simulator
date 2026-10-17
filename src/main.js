import './styles.css';
import { renderer, scene, camera, canvas, resize, applyRenderQuality, setShadowSize } from './render/core.js';
import { quality, settings, saveSettings } from './core/settings.js';
import { updTerrainLOD, buildTerrain } from './world/terrain.js';
import { buildFarm, updLabels } from './world/buildings.js';
import { buildVegetation } from './world/vegetation.js';
import { FIELDS, flushFields, growFields, countSomeFields, drawSigns, setCropShadows, setCropDetail, updFieldLOD, fieldAt } from './world/fields.js';
import { roadAt } from './world/layout.js';
import { vehicles, tools, drive, visual, updateTrailers, attachTool, updLOD, surface } from './vehicles/vehicles.js';
import { CROPS } from './game/crops.js';
import { work, updateLogistics } from './game/work.js';
import { G, TIME_SCALES, DEV } from './game/state.js';
import { newGame, loadLocal, saveLocal, exportFile, importFile } from './game/save.js';
import { toggleTool, switchVehicle, doF, cycleSeed, cycleTime, pickInShed, repairHere, toggleHelper, toggleSeat } from './game/actions.js';
import { person, walk, showPerson, seat } from './world/person.js';
import { helperTick } from './game/helpers.js';
import { buildFarmstead } from './world/farmstead.js';
import { buildWildlife } from './world/wildlife.js';
import { buildTraffic } from './world/traffic.js';
import { growForest, trees as forestTrees } from './world/forest.js';
import { farmTick, sellProducts } from './game/farm.js';
import { forestryTick } from './game/forestry.js';
import { has, ownershipHooks } from './game/machines.js';
import { upkeep, chargeDays } from './game/economy.js';
import { generateOffers, checkContract } from './game/contracts.js';
import { checkGoals } from './game/goals.js';
import { initOffice, openOffice, closeOffice, officeOpen } from './ui/office.js';
import { flushBales, bales, addBale } from './world/bales.js';
import { bindInput, driveInput, releaseAll, keys } from './core/input.js';
import { cam, bindCamera, updateCamera, shakeCamera } from './render/camera.js';
import { updEnv, updSeasonTint, snapSeasonTint } from './render/environment.js';
import { updSnow, snapSnow } from './render/snow.js';
import { WX, updateWeather, season, isWinter } from './game/weather.js';
import { updRain } from './fx/rain.js';
import { updTracks } from './fx/tracks.js';
import { updWind } from './render/wind.js';
import { updParticles } from './fx/particles.js';
import { updUI, updSlowUI } from './ui/hud.js';
import { sizeMinimap, drawMinimap, toggleBigMap, bigMapOpen } from './ui/minimap.js';
import { initMenu, showMenu, hideMenu, menuOpen } from './ui/menu.js';
import { perfSample } from './ui/perf.js';
import { pumpPreviews } from './render/previews.js';
import { toast } from './ui/toast.js';
import { initDev, toggleDev, updDev, devEnabled } from './ui/devpanel.js';
import { mapEditorOpen } from './ui/mapeditor.js';
import { toggleSound, updAudio, sound, playImpact, playStep } from './audio.js';

/* ---------- world ---------- */
const terrain = buildTerrain(scene);
const { rotors } = buildFarm(scene);
const vegetation = buildVegetation(scene);
const farmstead = buildFarmstead();
const wildlife = buildWildlife();
const traffic = buildTraffic();
ownershipHooks.push(() => { for (const k of ['cows', 'hens', 'sheep', 'pigs', 'mixer', 'greenhouse1', 'greenhouse2']) farmstead.setOwned(k, has(k)); });

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
snapSnow(isWinter());
/** Who the player is right now: the farmer on foot or the machine he drives. */
const player = () => (G.onFoot ? person : G.active);
cam.yaw = player().h;
wildlife.update(0.001, { vehicles, active: player(), hour: 12, cows: false, hens: false }); // place the animals before the first frame
traffic.update(0.001, { vehicles, listener: player() });
cam.t.set(player().x, 1, player().z);

/* ---------- input & menu ---------- */
/** Big map: clicking one of your machines puts you in it. */
const openMap = () => toggleBigMap(undefined, v => { seat(v); cam.manual = -99; releaseAll(); toggleBigMap(false); toast('Řídíš: ' + v.name); });
const ACTIONS = { KeyE: toggleSeat, KeyM: openMap, Space: toggleTool, Tab: switchVehicle, KeyF: doF, KeyC: cycleSeed, KeyT: cycleTime, KeyR: repairHere, KeyK: () => openOffice(), KeyH: toggleHelper };
bindInput(code => {
  if (mapEditorOpen()) return; // the map editor handles its own keys
  if (code === 'F9' && devEnabled) { toggleDev(); return; }
  if (menuOpen()) { if (code === 'Escape' || code === 'Enter') hideMenu(); return; }
  if (officeOpen()) { if (code === 'Escape' || code === 'KeyK') closeOffice(); return; }
  if (code === 'Escape' && bigMapOpen()) { toggleBigMap(false); return; }
  if (code === 'Escape') { showMenu(); return; }
  if (/^Digit[1-8]$/.test(code)) { pickInShed(+code.slice(5)); return; }
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
initDev({ applyQuality, wildlife });
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
let slowT = 0, mapT = 0, forestHours = 0, growHours = 0;
const ear = { x: 0, z: 0, rx: 1, rz: 0 };
function tick(dt) {
  if (G.playing) {
    const gm = DEV.freezeTime ? 0 : dt * TIME_SCALES[G.tsIdx] * DEV.timeMult;
    updSnow(gm / 60, isWinter(), WX.rain > 0.05);
    G.gameMin += gm;
    updateWeather(dt);
    growHours += (gm / 60) * season().growth * (WX.kind === 'rain' ? 1.1 : 1);
    farmTick(gm / 60);
    forestHours += gm / 60;
    upkeep(dt);
    if (chargeDays()) { sellProducts(); generateOffers(); saveLocal(); }
  }
  const input = G.playing ? driveInput() : null;
  // tyres hold less on wet ground (in the rain and until it dries) and on snow
  surface.wet = WX.rain > 0.15 || G.gameMin < WX.wetUntil; surface.snow = isWinter();
  for (const v of vehicles) {
    if (v.helper && G.playing) helperTick(v, dt);
    else if (!v.helper) drive(v, dt, v === G.active && !G.onFoot && !v.cutting ? input : null);
    work(v, dt);
    visual(v, dt, v.tank.crop >= 0 ? CROPS[v.tank.crop].heapCol : null);
  }
  updateTrailers(dt);
  if (G.onFoot && G.playing) walk(dt, input, cam.yaw, keys.ShiftLeft || keys.ShiftRight);
  showPerson(dt);
  if (person.step) { // footsteps: crunching on the roads, soft on the fields and the grass
    person.step = false;
    playStep(isWinter() ? 'snow' : roadAt(person.x, person.z, 0.5) ? 'gravel' : fieldAt(person.x, person.z) ? 'soil' : 'grass', person.speed > 3);
  }
  // a crash of the machine you drive: the view shakes and it is heard (small knocks only shake a little)
  const hit = G.onFoot ? 0 : G.active.hit || 0;
  if (hit > 0.8) { const k = Math.min(1, (hit - 0.8) / 8); shakeCamera(0.15 + 0.6 * k); playImpact(k); }
  for (const v of vehicles) v.hit = 0;
  if (DEV.tracks) updTracks(dt, vehicles, WX.rain < 0.2 && !isWinter() && G.gameMin > WX.wetUntil);
  updateLogistics(dt, saveLocal);
  flushFields();
  flushBales();
  forestryTick(dt);
  farmstead.update(dt);
  if (G.playing) traffic.update(dt, { vehicles, listener: player() });
  if (G.playing && DEV.wildlife) wildlife.update(dt, { vehicles, active: player(), hour: (G.gameMin / 60) % 24, cows: has('cows'), hens: has('hens') });
  updParticles(dt);
  for (const r of rotors) r.rotation.z += dt * 0.9;

  updateCamera(dt, player());
  updLOD(camera.position, quality().machineLod);
  setShadowSize(Math.min(150, Math.max(55, cam.dist * 1.5)));
  updEnv(cam.t, G.gameMin, vehicles, G.onFoot ? null : G.active, WX);
  updSeasonTint(dt, terrain.material, vegetation.leafMat, season());
  updRain(dt, cam.t, WX.rain, isWinter());
  if (DEV.wind) updWind(dt, WX.rain, WX.cloud);
  if (G.flashT > 0) G.flashT -= dt;
  updUI();
  updDev(dt);
  { // we listen at the camera's target; the camera's right side is the right ear
    const e = camera.matrixWorld.elements, n = Math.hypot(e[0], e[2]) || 1;
    Object.assign(ear, { x: cam.t.x, z: cam.t.z, rx: e[0] / n, rz: e[2] / n });
  }
  updAudio(dt, { playing: G.playing, rain: WX.rain, hour: (G.gameMin / 60) % 24, flash: G.flashT, money: G.money, winter: isWinter(), active: G.onFoot ? null : G.active, vehicles, traffic: traffic.cars, ear });
  slowT -= dt; if (slowT <= 0) { slowT = 0.5; growFields(growHours); growHours = 0; countSomeFields(player().x, player().z); checkContract(saveLocal); if (checkGoals()) saveLocal(); growForest(forestHours, isWinter() ? 0.25 : 1); forestHours = 0; updSlowUI(); }
  mapT -= dt; if (mapT <= 0) { mapT = 0.12; drawMinimap(); updFieldLOD(cam.t.x, cam.t.z, quality().cropLod); { const q = quality(); vegetation.updLOD(cam.t.x, cam.t.z, Math.min(150, Math.max(55, cam.dist * 1.5)), q); updTerrainLOD(cam.t.x, cam.t.z, q.terrainFine, q.terrainMid); } updLabels(cam.t.x, cam.t.z); }
  if (shadersReady) { pumpPreviews(dt); renderer.render(scene, camera); }
}

// Compile all shaders in parallel without blocking the page (KHR_parallel_shader_compile); until then
// the menu is usable and the 3D view stays empty. Compiling them on the first frame instead froze
// the page for several seconds on Intel graphics.
let shadersReady = false;
updateCamera(0, player());
renderer.compileAsync(scene, camera).catch(() => {}).finally(() => { shadersReady = true; });

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
    G, vehicles, tools, renderer, wildlife, traffic, pick: pickInShed, person, seat,
    /** Hitches the first piece of implement key to tractor v (default: the first tractor). */
    attach: (key, v = vehicles.find(x => x.type === 'tractor')) => attachTool(v, tools.find(t => t.key === key && t.on === v) || tools.find(t => t.key === key && !t.on) || tools.find(t => t.key === key)), fields: FIELDS, forest: forestTrees, bales, addBale,
    size(w, h) { renderer.setPixelRatio(1); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); },
  };
}
