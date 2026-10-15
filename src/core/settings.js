// Graphics presets. Budget: 60 FPS at 1080p on a GeForce 840M on "Střední",
// at least 30 FPS on Intel HD 5500 on "Nízká".
const KEY = 'zlate-lany-settings-v1';

export const PRESETS = {
  low: {
    label: 'Nízká', scale: 0.7, shadowMap: 1024, cropShadows: false, trees: 0.4, view: 320, antialias: false,
    desc: 'Vykresluje v 70 % rozlišení, plodiny nevrhají stíny, na kopcích je méně stromů a dohled je kratší. Pro integrovanou grafiku Intel.',
  },
  medium: {
    label: 'Střední', scale: 0.85, shadowMap: 1024, cropShadows: true, trees: 0.7, view: 460, antialias: true,
    desc: 'Vykresluje v 85 % rozlišení s vyhlazováním hran a stíny všech objektů. Pro slabší samostatné karty, třeba GeForce 840M.',
  },
  high: {
    label: 'Vysoká', scale: 1, shadowMap: 2048, cropShadows: true, trees: 1, view: 620, antialias: true,
    desc: 'Plné rozlišení, ostřejší stíny, všechny stromy a nejdelší dohled.',
  },
};

function detectGPU() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return 'WebGL není dostupné';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return String(name || 'neznámá');
  } catch {
    return 'neznámá';
  }
}

export const gpuName = detectGPU();
export const isIntegrated = /intel|uhd|hd graphics|iris|swiftshader|llvmpipe/i.test(gpuName) && !/\barc\b|nvidia|radeon|geforce/i.test(gpuName);

export const settings = { preset: isIntegrated ? 'low' : 'medium', showFps: true };
try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* storage unavailable */ }
if (!PRESETS[settings.preset]) settings.preset = 'medium';

/** Antialiasing can only be chosen when the WebGL context is created, so remember the start value. */
export const startAntialias = PRESETS[settings.preset].antialias;
export const quality = () => PRESETS[settings.preset];
export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* storage unavailable */ }
}
