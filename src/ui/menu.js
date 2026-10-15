import { settings, PRESETS, saveSettings, gpuName, isIntegrated, startAntialias } from '../core/settings.js';

const $ = id => document.getElementById(id);
const menu = $('menu'), main = $('menuMain'), gfx = $('menuGfx');
let handlers = null;
let started = false;

export const menuOpen = () => !menu.hidden;

/**
 * h = { onPlay, onNew, onQuality, onExport, onImport(file) → Promise<bool>, hasProgress() }
 */
export function initMenu(h) {
  handlers = h;
  $('playBtn').onclick = () => hideMenu();
  const newBtn = $('newBtn');
  let armed = 0;
  newBtn.onclick = () => {
    // in-page confirmation: the first click arms the button for 3 seconds
    if (!armed) {
      newBtn.textContent = 'Opravdu? Klikni znovu';
      newBtn.classList.add('danger');
      armed = setTimeout(() => { armed = 0; newBtn.textContent = 'Nová hra'; newBtn.classList.remove('danger'); }, 3000);
      return;
    }
    clearTimeout(armed); armed = 0;
    newBtn.textContent = 'Nová hra'; newBtn.classList.remove('danger');
    handlers.onNew();
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
    settings.preset = k; saveSettings(); renderGfx(); handlers.onQuality();
  };
  $('fpsCheck').onchange = e => { settings.showFps = e.target.checked; saveSettings(); };
  $('gpuName').textContent = gpuName;
  $('gpuWarn').hidden = !isIntegrated;
  renderGfx();
}

function renderGfx() {
  for (const b of $('presetSeg').children) b.setAttribute('aria-checked', String(b.dataset.p === settings.preset));
  $('presetDesc').textContent = PRESETS[settings.preset].desc;
  $('fpsCheck').checked = settings.showFps;
  $('aaNote').hidden = PRESETS[settings.preset].antialias === startAntialias;
}

function showGfx(on) {
  main.hidden = on; gfx.hidden = !on;
  (on ? $('presetSeg').querySelector('[aria-checked="true"]') : $('gfxBtn'))?.focus();
}

function refreshButtons() {
  const progress = started || handlers.hasProgress();
  $('playBtn').textContent = progress ? 'Pokračovat' : 'Hrát';
  $('newBtn').hidden = !progress;
}

export function showMenu() {
  refreshButtons();
  showGfx(false);
  menu.hidden = false;
  $('playBtn').focus();
  handlers.onPause?.();
}

export function hideMenu() {
  menu.hidden = true;
  started = true;
  handlers.onPlay();
}
