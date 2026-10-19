import * as THREE from 'three';
import { scene, sun, hemi, fogBase } from './core.js';
import { col, lerp, smooth } from '../core/util.js';
import { lampMat } from './materials.js';
import { updSky } from './sky.js';

// horizon (= fog) and zenith colours for day, dusk, night and overcast
const C_SKY = col('#c3dbe4'), C_DUSK = col('#f6c584'), C_NIGHT = col('#1d2940');
const C_ZEN = col('#6c9fd0'), C_ZDUSK = col('#8fa6c8'), C_ZNIGHT = col('#0a1222');
const C_GREY = col('#9ea9ae'), C_ZGREY = col('#87949b');
const C_NOON = col('#fff0d4'), C_DAWN = col('#ffa865'), C_MOON = col('#9cb2ff'), C_GLOW = col('#ffa040');
const C_HSKY = col('#d5e6ef'), C_HGROUND = col('#9aa36c'), C_HNIGHT = col('#4a5a80'), C_HWARM = col('#ffd2a6');
const c1 = new THREE.Color(), sky = new THREE.Color(), zen = new THREE.Color();
const dir = new THREE.Vector3(), sunVisual = new THREE.Vector3();
/** Direction to the visible sun (it really sets), for the rainbow. */
export const sunDir = sunVisual;
const skyEnv = { horizon: sky, zenith: zen, sunDir: sunVisual, sunCol: C_GLOW, day: 1, dawn: 0, overcast: 0, rain: 0 };
let lastT = performance.now();
const PI = Math.PI;

/** Headlight spots shared by all machines: a fixed number, so buying machines never adds lights (and shader work). */
const SPOTS = [0, 1, 2].map(() => { const s = new THREE.SpotLight(0xfff1c8, 0, 48, 0.75, 0.6, 0); scene.add(s, s.target); return s; });
const lit = [];

/**
 * Day/night cycle: sun from 5:00 to 21:00, warm light at dawn and dusk, moonlight at night.
 * wx = { rain, cloud } 0..1 dims the sun, greys the sky and pulls the fog in.
 */
export function updEnv(target, gameMin, vehicles, active, wx) {
  const hour = (gameMin / 60) % 24, df = (hour - 5) / 16;
  const e = Math.sin(df * PI) * 1.05, az = df * PI;
  const day = smooth(-0.12, 0.22, e);
  const dawn = (1 - smooth(0.05, 0.55, e)) * day;
  if (e > 0.05) dir.set(Math.cos(az) * Math.cos(Math.max(e, 0.3)), Math.sin(Math.max(e, 0.3)), -0.5).normalize();
  else dir.set(0.35, 0.85, 0.4).normalize();
  sun.position.copy(target).addScaledVector(dir, 180);
  sun.target.position.copy(target);
  // the light keeps a minimum elevation for nice shadows; the visible sun really sets
  sunVisual.set(Math.cos(az) * Math.cos(e), Math.sin(e), -0.5 * Math.cos(e)).normalize();
  c1.copy(C_NOON).lerp(C_DAWN, Math.min(1, dawn * 1.15));
  sun.color.copy(C_MOON).lerp(c1, day);
  const overcast = Math.max(wx.cloud * 0.45, wx.rain * 0.8);
  sun.intensity = lerp(0.35, 1.45, day) * PI * (1 - overcast);
  hemi.color.copy(C_HNIGHT).lerp(c1.copy(C_HSKY).lerp(C_HWARM, dawn * 0.55), day);
  hemi.groundColor.copy(C_HNIGHT).lerp(C_HGROUND, day);
  hemi.intensity = lerp(0.38, 0.62, day) * PI * (1 - overcast * 0.35);
  sky.copy(C_SKY).lerp(C_DUSK, dawn * 0.8).lerp(C_GREY, overcast * 0.8).lerp(C_NIGHT, 1 - day);
  zen.copy(C_ZEN).lerp(C_ZDUSK, dawn * 0.7).lerp(C_ZGREY, overcast * 0.85).lerp(C_ZNIGHT, 1 - day);
  scene.background = sky;
  const now = performance.now();
  Object.assign(skyEnv, { day, dawn, overcast, rain: wx.rain });
  updSky(Math.min(0.1, (now - lastT) / 1000), skyEnv);
  lastT = now;
  scene.fog.color.copy(sky);
  scene.fog.far = fogBase.far * (1 - wx.rain * 0.4 - wx.cloud * 0.1);
  scene.fog.near = Math.min(fogBase.near, scene.fog.far * 0.45);
  const night = 1 - day;
  lampMat.emissiveIntensity = night * 1.6;
  // the few spot lights go to the machine you drive and the nearest ones working or driving
  lit.length = 0;
  if (night > 0.05) {
    for (const v of vehicles) if (v === active || v.helper || Math.abs(v.speed) > 0.5) lit.push(v);
    lit.sort((a, b) => (a === active ? -1 : b === active ? 1 : Math.hypot(a.x - target.x, a.z - target.z) - Math.hypot(b.x - target.x, b.z - target.z)));
  }
  SPOTS.forEach((s, i) => {
    const v = lit[i];
    s.intensity = v ? (v === active ? night * 2.2 : night * 0.8) * PI : 0;
    if (!v) return;
    v.group.updateWorldMatrix(true, false);
    s.position.copy(v.spot.pos).applyMatrix4(v.group.matrixWorld);
    s.target.position.copy(v.spot.target).applyMatrix4(v.group.matrixWorld);
  });
  return day;
}

const tintT = new THREE.Color(), tintL = new THREE.Color();
/** Eases the terrain and leaf colour multipliers toward the current season's; wet ground (0..1) is darker. */
export function updSeasonTint(dt, terrainMat, leafMat, season, wet = 0) {
  const k = Math.min(1, dt * 0.25);
  tintT.setRGB(...season.terrain).multiplyScalar(1 - 0.2 * wet); tintL.setRGB(...season.leaves);
  terrainMat.color.lerp(tintT, k);
  leafMat.color.lerp(tintL, k);
}
/** Jumps straight to the season's colours (after loading a game). */
export function snapSeasonTint(terrainMat, leafMat, season) {
  terrainMat.color.setRGB(...season.terrain); leafMat.color.setRGB(...season.leaves);
}
