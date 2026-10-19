import * as THREE from 'three';
import { scene } from '../render/core.js';

/**
 * A falling stream of grain: a thin column from the spout down to where it lands, one per machine
 * that pours (a harvester's pipe, a tipping trailer). pourStream() every frame while it pours; a
 * stream not fed for a moment disappears.
 */
const geo = new THREE.CylinderGeometry(1, 0.8, 1, 8, 1, true).translate(0, -0.5, 0); // top at 0, hanging down
const streams = new Map(); // owner → { mesh, t }

/** Pours from (x, y, z) down to height y1, width w (m), colour c (THREE.Color). */
export function pourStream(owner, x, y, z, y1, c, w = 0.2) {
  let s = streams.get(owner);
  if (!s) {
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: c.clone(), transparent: true, opacity: 0.9, depthWrite: false }));
    mesh.castShadow = false; mesh.renderOrder = 1;
    scene.add(mesh);
    streams.set(owner, (s = { mesh, t: 0 }));
  }
  s.t = 0.15;
  const m = s.mesh, len = Math.max(0.2, y - y1), wob = 1 + Math.sin(performance.now() / 70) * 0.08;
  m.visible = true;
  m.material.color.copy(c);
  m.position.set(x, y, z);
  m.scale.set(w * wob, len, w * wob);
}

/** Is owner's stream showing now (for the smoke test)? */
export const streamShown = owner => !!streams.get(owner)?.mesh.visible;

/** Every frame: streams that are no longer fed vanish. */
export function updStreams(dt) {
  for (const s of streams.values()) if ((s.t -= dt) <= 0) s.mesh.visible = false;
}
