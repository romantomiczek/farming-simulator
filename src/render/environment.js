import * as THREE from 'three';
import { scene, sun, hemi, fogBase } from './core.js';
import { col, lerp, smooth } from '../core/util.js';
import { lampMat } from './materials.js';

const C_SKY = col('#bfd9e3'), C_DUSK = col('#f0c8a2'), C_NIGHT = col('#26344c');
const C_NOON = col('#fff0d4'), C_DAWN = col('#ffb67a'), C_MOON = col('#9cb2ff');
const C_HSKY = col('#d5e6ef'), C_HGROUND = col('#9aa36c'), C_HNIGHT = col('#4a5a80');
const C_GREY = col('#9ea9ae');
const c1 = new THREE.Color(), sky = new THREE.Color();
const dir = new THREE.Vector3();
const PI = Math.PI;

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
  c1.copy(C_NOON).lerp(C_DAWN, dawn);
  sun.color.copy(C_MOON).lerp(c1, day);
  const overcast = Math.max(wx.cloud * 0.45, wx.rain * 0.8);
  sun.intensity = lerp(0.35, 1.45, day) * PI * (1 - overcast);
  hemi.color.copy(C_HNIGHT).lerp(C_HSKY, day);
  hemi.groundColor.copy(C_HNIGHT).lerp(C_HGROUND, day);
  hemi.intensity = lerp(0.38, 0.62, day) * PI * (1 - overcast * 0.35);
  sky.copy(C_SKY).lerp(C_DUSK, dawn * 0.75).lerp(C_GREY, overcast * 0.8).lerp(C_NIGHT, 1 - day);
  scene.background = sky;
  scene.fog.color.copy(sky);
  scene.fog.far = fogBase.far * (1 - wx.rain * 0.4 - wx.cloud * 0.1);
  scene.fog.near = Math.min(fogBase.near, scene.fog.far * 0.45);
  const night = 1 - day;
  lampMat.emissiveIntensity = night * 1.6;
  for (const v of vehicles) v.spot.intensity = (v === active ? night * 2.2 : night * 0.8) * PI;
  return day;
}

const tintT = new THREE.Color(), tintL = new THREE.Color();
/** Eases the terrain and leaf colour multipliers toward the current season's. */
export function updSeasonTint(dt, terrainMat, leafMat, season) {
  const k = Math.min(1, dt * 0.25);
  tintT.setRGB(...season.terrain); tintL.setRGB(...season.leaves);
  terrainMat.color.lerp(tintT, k);
  leafMat.color.lerp(tintL, k);
}
/** Jumps straight to the season's colours (after loading a game). */
export function snapSeasonTint(terrainMat, leafMat, season) {
  terrainMat.color.setRGB(...season.terrain); leafMat.color.setRGB(...season.leaves);
}
