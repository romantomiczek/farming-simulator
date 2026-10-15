// Graphics presets. "Nízká" and "Střední" keep older laptops (Intel HD 5500, GeForce 840M) playable;
// "Vysoká" and "Ultra" spend a modern graphics card on detail: full resolution on high-DPI screens,
// sharper shadows, sculpted crops and a denser forest. pixelCap limits devicePixelRatio.
const KEY = 'zlate-lany-settings-v1';

export const PRESETS = {
  low: {
    label: 'Nízká', scale: 0.7, pixelCap: 1.5, shadowMap: 1024, cropShadows: false, trees: 0.4, view: 320, cropLod: 110, antialias: false,
    desc: 'Vykresluje v 70 % rozlišení, plodiny nevrhají stíny, na kopcích je méně stromů a dohled je kratší. Pro integrovanou grafiku Intel.',
  },
  medium: {
    label: 'Střední', scale: 0.85, pixelCap: 1.5, shadowMap: 1024, cropShadows: true, trees: 0.7, view: 460, cropLod: 160, antialias: true,
    desc: 'Vykresluje v 85 % rozlišení s vyhlazováním hran a stíny všech objektů. Pro slabší samostatné karty, třeba GeForce 840M.',
  },
  high: {
    label: 'Vysoká', scale: 1, pixelCap: 2, shadowMap: 2048, cropShadows: true, trees: 1, view: 620, cropLod: 240, antialias: true,
    desc: 'Plné rozlišení i na displejích s jemnými pixely, ostřejší stíny, všechny stromy a nejdelší dohled.',
  },
  ultra: {
    label: 'Ultra', scale: 1, pixelCap: 2, shadowMap: 4096, cropShadows: true, cropDetail: true, trees: 2, view: 620, cropLod: 400, antialias: true,
    desc: 'Jako Vysoká, navíc nejostřejší stíny, plastické plodiny ze snopků místo kvádrů a dvakrát hustší les na kopcích. Pro výkonné grafické karty.',
  },
};

for (const k in PRESETS) PRESETS[k].key = k;

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

export const settings = { preset: isIntegrated ? 'low' : 'high', showFps: true, sound: true, custom: null };
try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* storage unavailable */ }
if (!PRESETS[settings.preset]) settings.preset = 'medium';

/** Antialiasing can only be chosen when the WebGL context is created, so remember the start value. */
export const startAntialias = PRESETS[settings.preset].antialias;
/** The chosen preset, with the developer panel's overrides (settings.custom) on top. */
export const quality = () => (settings.custom ? { ...PRESETS[settings.preset], ...settings.custom } : PRESETS[settings.preset]);
export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* storage unavailable */ }
}
