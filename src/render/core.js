import * as THREE from 'three';
import { quality, startAntialias } from '../core/settings.js';

export const canvas = document.getElementById('c');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: startAntialias, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 900);
scene.fog = new THREE.Fog(0xcfe0d8, 200, 560);

// Light intensities are physical (three r155+): roughly π × the old "legacy" values.
export const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.9);
scene.add(hemi);
export const sun = new THREE.DirectionalLight(0xffffff, 4.5);
sun.castShadow = true;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 400;
scene.add(sun, sun.target);

let shadowSize = 0;
export function setShadowSize(s) {
  if (Math.abs(s - shadowSize) < 4) return;
  shadowSize = s;
  const c = sun.shadow.camera;
  c.left = -s; c.right = s; c.top = s; c.bottom = -s;
  c.updateProjectionMatrix();
}
setShadowSize(70);

export function resize() {
  const w = innerWidth, h = innerHeight;
  if (!w || !h) return;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5) * quality().scale);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

/** Applies the renderer-level part of the current preset (resolution, shadow map, view distance). */
export function applyRenderQuality() {
  const q = quality();
  resize();
  if (sun.shadow.mapSize.x !== q.shadowMap) {
    sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  }
  scene.fog.near = Math.max(140, q.view * 0.4);
  scene.fog.far = q.view;
  camera.far = q.view + 150;
  camera.updateProjectionMatrix();
}
