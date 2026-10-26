import { settings, PRESETS, saveSettings, gpuName, isIntegrated, startAntialias, MUSIC_STYLES } from '../core/settings.js';
import { nowPlaying } from '../audio/music.js';
import { sound } from '../audio.js';

const $ = id => document.getElementById(id);
const menu = $('menu'), main = $('menuMain'), gfx = $('menuGfx'), snd = $('menuSnd'), fresh = $('menuNew');
/** How a new game can start (balance.js MODES has the numbers). */
const MODE_CARDS = [
  ['farmer', 'Nový farmář', 'Statek s poli 1 a 2, traktorem, kombajnem, kultivátorem, secím strojem a přívěsem, 150 000 Kč. Pole 1 je zralé, můžeš hned sklízet. Pro první hru.'],
  ['manager', 'Správce farmy', 'Statek a 1 500 000 Kč, ale žádná pole ani stroje. Co koupíš, kde budeš hospodařit a čím, je na tobě.'],
  ['scratch', 'Začátek od nuly', 'Jen auto a 500 000 Kč, žádná pole ani stroje, a výkupy platí o 10 % méně. Začni zakázkami u sousedů se stroji, které ti půjčí.'],
];
const VOLS = [['music', 'Hudba'], ['engines', 'Motory'], ['ambient', 'Okolí'], ['effects', 'Efekty']];
let handlers = null;
let started = false;

export const menuOpen = () => !menu.hidden;

/**
 * h = { onPlay, onNew, onQuality, onExport, onImport(file) → Promise<bool>, hasProgress() }
 */
export function initMenu(h) {
  handlers = h;
  $('playBtn').onclick = () => hideMenu();
  // a new game: pick how to start; choosing one is the confirmation (the note warns that the game in progress goes)
  $('newBtn').onclick = () => showNew(true);
  $('newBack').onclick = () => showNew(false);
  $('modeList').innerHTML = MODE_CARDS.map(([k, name, desc]) => `<button class="btn ghost mode" data-mode="${k}"><b>${name}</b><span>${desc}</span></button>`).join('');
  $('modeList').onclick = e => {
    const k = e.target.closest('[data-mode]')?.dataset.mode;
    if (!k) return;
    showNew(false);
    handlers.onNew(k);
    hideMenu();
  };
  $('gfxBtn').onclick = () => showGfx(true);
  $('gfxBack').onclick = () => showGfx(false);
  $('exportBtn').onclick = () => { handlers.onExport(); $('saveNote').textContent = 'Uloženo do souboru ve složce Stažené soubory.'; };
  $('importBtn').onclick = () => $('importFile').click();
  $('importFile').onchange = async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const ok = await handlers.onImport(file);
    $('saveNote').textContent = ok ? 'Hra načtena ze souboru ' + file.name + '.' : 'Soubor ' + file.name + ' není uložená hra Zlatých lánů.';
    if (ok) refreshButtons();
  };

  // graphics panel
  const seg = $('presetSeg');
  seg.innerHTML = Object.entries(PRESETS).map(([k, p]) => `<button role="radio" data-p="${k}">${p.label}</button>`).join('');
  seg.onclick = e => {
    const k = e.target.closest('button')?.dataset.p;
    if (!k) return;
    settings.preset = k; settings.custom = null; saveSettings(); renderGfx(); handlers.onQuality();
  };
  $('fpsCheck').onchange = e => { settings.showFps = e.target.checked; saveSettings(); };
  $('gpuName').textContent = gpuName;
  $('gpuWarn').hidden = !isIntegrated;
  renderGfx();

  // sound panel: a volume per group and the music style; the game reads settings every frame
  $('sndBtn').onclick = () => showSnd(true);
  $('sndBack').onclick = () => showSnd(false);
  $('volRows').innerHTML = VOLS.map(([k, label]) =>
    `<label class="vol"><span>${label}</span><input type="range" min="0" max="100" step="5" data-vol="${k}" aria-label="Hlasitost: ${label}"><output></output></label>`).join('');
  $('volRows').oninput = e => {
    const k = e.target.dataset.vol;
    if (!k) return;
    settings.vol[k] = e.target.value / 100; saveSettings(); renderSnd();
  };
  $('musicSeg').innerHTML = Object.entries(MUSIC_STYLES).map(([k, label]) => `<button role="radio" data-m="${k}">${label}</button>`).join('');
  $('musicSeg').onclick = e => {
    const k = e.target.closest('button')?.dataset.m;
    if (!k) return;
    settings.musicStyle = k; saveSettings(); renderSnd();
  };
}

let sndTimer = 0;
function renderSnd() {
  for (const el of $('volRows').querySelectorAll('input')) {
    const v = settings.vol[el.dataset.vol];
    el.value = Math.round(v * 100); el.nextElementSibling.textContent = Math.round(v * 100) + ' %';
  }
  for (const b of $('musicSeg').children) b.setAttribute('aria-checked', String(b.dataset.m === settings.musicStyle));
  const tr = nowPlaying();
  $('nowPlaying').textContent = !sound.on ? 'Zvuk je vypnutý. Zapneš ho tlačítkem Zvuk nahoře nebo spuštěním hry.'
    : tr ? 'Hraje: ' + tr.title + ' (Kevin MacLeod)' : 'Mezi skladbami je chvíle ticha.';
}
function showSnd(on) {
  main.hidden = on; snd.hidden = !on;
  clearInterval(sndTimer);
  if (on) { renderSnd(); sndTimer = setInterval(renderSnd, 1000); }
  (on ? $('volRows').querySelector('input') : $('sndBtn'))?.focus();
}

function renderGfx() {
  for (const b of $('presetSeg').children) b.setAttribute('aria-checked', String(b.dataset.p === settings.preset));
  $('presetDesc').textContent = PRESETS[settings.preset].desc;
  $('fpsCheck').checked = settings.showFps;
  $('aaNote').hidden = PRESETS[settings.preset].antialias === startAntialias;
}

function showNew(on) {
  main.hidden = on; fresh.hidden = !on; gfx.hidden = true; snd.hidden = true;
  $('newNote').textContent = 'Vyber, jak chceš začít.' + (started || handlers.hasProgress() ? ' Rozehraná hra se přepíše.' : '');
  (on ? $('modeList').querySelector('button') : $('newBtn'))?.focus();
}

function showGfx(on) {
  main.hidden = on; gfx.hidden = !on; snd.hidden = true; fresh.hidden = true;
  (on ? $('presetSeg').querySelector('[aria-checked="true"]') : $('gfxBtn'))?.focus();
}

function refreshButtons() {
  const progress = started || handlers.hasProgress();
  $('playBtn').textContent = progress ? 'Pokračovat' : 'Hrát';
}

export function showMenu() {
  refreshButtons();
  showGfx(false);
  clearInterval(sndTimer);
  menu.hidden = false;
  $('playBtn').focus();
  handlers.onPause?.();
}

export function hideMenu() {
  menu.hidden = true;
  started = true;
  handlers.onPlay();
}
