// Graphics presets. "Nízká" and "Střední" keep older laptops (Intel HD 5500, GeForce 840M) playable;
// "Vysoká" and "Ultra" spend a modern graphics card on detail: full resolution on high-DPI screens,
// sharper shadows, sculpted crops and a denser forest. pixelCap limits devicePixelRatio.
// Level of detail (metres from the camera target): terrain tiles closer than terrainFine use the 5 m
// grid, closer than terrainMid 10 m, beyond that 20 m; trees closer than treeNear use the detailed
// models; beyond treeFar only treeFarKeep of the trees in the playable area are drawn (all keep their
// collisions); hedgeLow = simple hedge bushes; casterK scales the radius of tree shadows.
const KEY = 'zlate-lany-settings-v1';

export const PRESETS = {
  low: {
    label: 'Nízká', scale: 0.7, pixelCap: 1.5, shadowMap: 1024, cropShadows: false, trees: 0.4, view: 320, cropLod: 110, antialias: false,
    terrainFine: 60, terrainMid: 320, treeNear: 0, treeFar: 170, treeFarKeep: 0.45, hedgeLow: true, casterK: 0.6, machineLod: 70,
    desc: 'Vykresluje v 70 % rozlišení, plodiny nevrhají stíny, na kopcích je méně stromů a dohled je kratší. Pro integrovanou grafiku Intel.',
  },
  medium: {
    label: 'Střední', scale: 0.85, pixelCap: 1.5, shadowMap: 1024, cropShadows: true, trees: 0.7, view: 460, cropLod: 160, antialias: true,
    terrainFine: 160, terrainMid: 600, treeNear: 90, treeFar: 300, treeFarKeep: 0.7, hedgeLow: true, casterK: 0.8, machineLod: 90,
    desc: 'Vykresluje v 85 % rozlišení s vyhlazováním hran a stíny všech objektů. Pro slabší samostatné karty, třeba GeForce 840M.',
  },
  high: {
    label: 'Vysoká', scale: 1, pixelCap: 2, shadowMap: 2048, cropShadows: true, trees: 1, view: 620, cropLod: 240, antialias: true,
    terrainFine: 420, terrainMid: Infinity, treeNear: 170, treeFar: Infinity, treeFarKeep: 1, hedgeLow: false, casterK: 1, machineLod: 120,
    desc: 'Plné rozlišení i na displejích s jemnými pixely, ostřejší stíny, všechny stromy a nejdelší dohled.',
  },
  ultra: {
    label: 'Ultra', scale: 1, pixelCap: 2, shadowMap: 4096, cropShadows: true, cropDetail: true, trees: 2, view: 620, cropLod: 400, antialias: true,
    terrainFine: Infinity, terrainMid: Infinity, treeNear: 300, treeFar: Infinity, treeFarKeep: 1, hedgeLow: false, casterK: 1, machineLod: 160,
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

/** Volume of each sound group, 0..1 (Nastavení zvuku in the menu). */
export const VOL_DEFAULT = { music: 0.45, engines: 0.8, ambient: 0.7, effects: 0.8 };
/** Which music plays: guitar pieces, piano pieces or both. */
export const MUSIC_STYLES = { both: 'Obojí', guitar: 'Kytara', piano: 'Klavír' };

export const settings = { preset: isIntegrated ? 'low' : 'high', showFps: true, showPrices: false, sound: true, custom: null, vol: { ...VOL_DEFAULT }, musicStyle: 'both' };
try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* storage unavailable */ }
if (!PRESETS[settings.preset]) settings.preset = 'medium';
settings.vol = { ...VOL_DEFAULT, ...settings.vol };
if (!MUSIC_STYLES[settings.musicStyle]) settings.musicStyle = 'both';

/** Antialiasing can only be chosen when the WebGL context is created, so remember the start value. */
export const startAntialias = PRESETS[settings.preset].antialias;
/** The chosen preset, with the developer panel's overrides (settings.custom) on top. */
export const quality = () => (settings.custom ? { ...PRESETS[settings.preset], ...settings.custom } : PRESETS[settings.preset]);
export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* storage unavailable */ }
}
