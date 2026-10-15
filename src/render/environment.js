import * as THREE from 'three';
import { scene, sun, hemi } from './core.js';
import { col, lerp, smooth } from '../core/util.js';
import { lampMat } from './materials.js';

const C_SKY = col('#bfd9e3'), C_DUSK = col('#f0c8a2'), C_NIGHT = col('#26344c');
const C_NOON = col('#fff0d4'), C_DAWN = col('#ffb67a'), C_MOON = col('#9cb2ff');
const C_HSKY = col('#d5e6ef'), C_HGROUND = col('#9aa36c'), C_HNIGHT = col('#4a5a80');
const c1 = new THREE.Color(), sky = new THREE.Color();
const dir = new THREE.Vector3();
const PI = Math.PI;

/** Day/night cycle: sun from 5:00 to 21:00, warm light at dawn and dusk, moonlight at night. */
export function updEnv(target, gameMin, vehicles, active) {
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
  sun.intensity = lerp(0.35, 1.45, day) * PI;
  hemi.color.copy(C_HNIGHT).lerp(C_HSKY, day);
  hemi.groundColor.copy(C_HNIGHT).lerp(C_HGROUND, day);
  hemi.intensity = lerp(0.38, 0.62, day) * PI;
  sky.copy(C_SKY).lerp(C_DUSK, dawn * 0.75).lerp(C_NIGHT, 1 - day);
  scene.background = sky;
  scene.fog.color.copy(sky);
  const night = 1 - day;
  lampMat.emissiveIntensity = night * 1.6;
  for (const v of vehicles) v.spot.intensity = (v === active ? night * 2.2 : night * 0.8) * PI;
  return day;
}
