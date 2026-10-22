import * as THREE from 'three';
import { quality, startAntialias } from '../core/settings.js';

export const canvas = document.getElementById('c');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: startAntialias, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.info.autoReset = false; // main.js resets it once per frame

// Colour grade right after tone mapping (no extra pass): ACES leaves colours pale, so they get a touch
// more saturation (kept low for natural tones) and a gentle S-curve in display space (black and white stay where they are).
// The sky dome is not tone mapped and has its colours picked to match.
const GRADE_SAT = '1.06', GRADE_CURVE = '0.28';
/** The grade on gl_FragColor.rgb after tone mapping (shared with the post-processing's final pass). */
export const GRADE_GLSL = /* glsl */`
  vec3 gradeC = clamp( gl_FragColor.rgb, 0.0, 1.0 );
  float gradeL = dot( gradeC, vec3( 0.2126, 0.7152, 0.0722 ) );
  gradeC = max( mix( vec3( gradeL ), gradeC, ${GRADE_SAT} ), 0.0 );
  vec3 gradeD = pow( gradeC, vec3( 1.0 / 2.2 ) );
  gradeD = mix( gradeD, gradeD * gradeD * ( 3.0 - 2.0 * gradeD ), ${GRADE_CURVE} );
  gl_FragColor.rgb = pow( clamp( gradeD, 0.0, 1.0 ), vec3( 2.2 ) );`;
THREE.ShaderChunk.tonemapping_fragment = /* glsl */`
#if defined( TONE_MAPPING )
  gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
  ${GRADE_GLSL}
#endif
`;

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 900);
scene.fog = new THREE.Fog(0xb4cbd9, 200, 560);

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

/** Fog distances of the current preset; weather shortens them from here. */
export const fogBase = { near: 200, far: 560 };

export function resize() {
  const w = innerWidth, h = innerHeight;
  if (!w || !h) return;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, quality().pixelCap) * quality().scale);
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
  sun.castShadow = q.shadows !== false; // only the developer panel turns shadows off
  renderer.toneMappingExposure = q.exposure ?? 1;
  fogBase.near = scene.fog.near = Math.max(140, q.view * 0.4);
  fogBase.far = scene.fog.far = q.view;
  camera.far = q.view + 150;
  camera.updateProjectionMatrix();
}
