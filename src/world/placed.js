import * as THREE from 'three';
import { scene } from '../render/core.js';
import { M, MT, B, CY, mk, bake, flatten, winMat } from '../render/materials.js';
import { col } from '../core/util.js';
import { gable, label, dropLabel } from './buildings.js';

/**
 * The buildings the player puts up (game/build.js): their 3D models, the ring in front of the door and
 * the see-through preview in build mode. A model is built in its own frame: centred on (0, 0), w along
 * x, d along z, the front with the door and the ring towards +z; place() turns it by quarter turns.
 */
const NAME = { silo: 'Silo', shed: 'Kůlna', cowshed: 'Kravín', mill: 'Mlýn', bakery: 'Pekárna', oilmill: 'Olejna', sawmill: 'Pila' };
const RING_COL = { silo: '#dfe1dc', mill: '#d9a441', bakery: '#c98f4e', oilmill: '#c9b13a', sawmill: '#8a6a4a' };

const MODEL = {
  silo(g, w, d) {
    CY(3.6, 3.6, 13, 20, MT('#dfe1dc', 'rings'), 0, 6.5, -0.5, g);
    for (let k = 1; k < 5; k++) CY(3.65, 3.65, 0.18, 20, '#b9bdb7', 0, k * 2.7, -0.5, g);
    mk(new THREE.ConeGeometry(3.8, 2.6, 20), '#c9cdc7', 0, 14.3, -0.5, g);
    // outlet: a chute over the ring in front, the intake pit beside it
    B(0.45, 0.35, 4.2, M('#c9a24a', { roughness: 0.6 }), 1.2, 5.6, d / 2 + 1.2, g).rotation.x = 0.35;
    for (const sx of [-1, 1]) B(0.16, 5.6, 0.16, M('#9aa2a6', { roughness: 0.45, metalness: 0.5 }), 1.2 + sx * 0.6, 2.8, d / 2 - 0.6, g);
    B(3.0, 0.08, 2.4, '#4a4f52', -1.4, 0.06, d / 2 - 0.4, g);
  },
  shed(g, w, d) {
    const sheet = MT('#a7afb0', 'metal');
    B(w, 5.2, 0.4, sheet, 0, 2.6, -d / 2 + 0.2, g);
    for (const sx of [-1, 1]) B(0.4, 5.2, d, sheet, sx * (w / 2 - 0.2), 2.6, 0, g);
    B(w + 1, 0.3, d + 0.8, MT('#6c777d', 'metal'), 0, 5.45, 0.2, g).rotation.x = -0.05;
    B(w - 0.8, 0.06, d - 0.6, MT('#c5c0b4', 'concrete'), 0, 0.03, 0.1, g);
  },
  cowshed(g, w, d) {
    const wall = new THREE.Group(); g.add(wall);
    gable(w, d, 4.2, '#d9cbb3', '#7b5a4e', wall, { wall: 'wood' });
    for (let k = 0; k < 5; k++) B(1.6, 0.6, 0.1, winMat(), -w / 2 + 2 + k * 3.5, 3.2, d / 2 + 0.04, g);
    B(3.2, 3.2, 0.12, MT('#8a6a52', 'wood'), w / 2 - 3, 1.6, d / 2 + 0.05, g);
    // a fenced run in front of it
    const wood = MT('#8a6a52', 'wood');
    for (let k = 0; k <= 6; k++) B(0.14, 1.2, 0.14, wood, -w / 2 + 1 + k * 2.2, 0.6, d / 2 + 2.4, g);
    for (const y of [0.45, 0.95]) B(13.4, 0.1, 0.06, wood, -w / 2 + 7.6, y, d / 2 + 2.4, g);
  },
  mill(g, w, d) {
    const b = new THREE.Group(); b.position.z = -0.5; g.add(b);
    gable(w - 3, d - 1, 9, '#efe6d6', '#8a5a44', b);
    for (const x of [-3, 0, 3]) for (const y of [3, 6.5]) B(1.1, 1.3, 0.1, winMat(), x - 1.5, y, (d - 1) / 2 + 0.03, b);
    CY(1.6, 1.6, 11, 14, MT('#dfe1dc', 'rings'), w / 2 - 1.6, 5.5, -1, g); mk(new THREE.ConeGeometry(1.7, 1.5, 14), '#c9cdc7', w / 2 - 1.6, 11.7, -1, g);
    B(2.6, 0.08, 2.0, '#4a4f52', 1, 0.06, d / 2 + 0.6, g);
  },
  bakery(g, w, d) {
    const b = new THREE.Group(); g.add(b);
    gable(w, d, 4.4, '#f1e2cf', '#a35a44', b);
    for (const x of [-4, -1.5, 3.5]) B(1.2, 1.2, 0.1, winMat(), x, 2.6, d / 2 + 0.03, g);
    B(1.4, 2.4, 0.12, MT('#8a6a52', 'wood'), 1.2, 1.2, d / 2 + 0.05, g);
    B(1.1, 3.0, 1.1, MT('#b9a89a', 'brick'), -w / 2 + 2, 6.0, -1, g); // oven chimney
    B(2.4, 0.15, 1.6, M('#e8e4da'), 1.2, 2.8, d / 2 + 0.8, g); // awning over the door
  },
  oilmill(g, w, d) {
    B(w - 4, 5, d - 2, MT('#d9dcd8', 'metal'), -2, 2.5, -1, g);
    B(w - 3.4, 0.3, d - 1.4, MT('#6c777d', 'metal'), -2, 5.15, -1, g);
    for (const z of [-2.2, 1.6]) { CY(1.5, 1.5, 6, 16, MT('#e8e2c8', 'rings'), w / 2 - 1.7, 3, z, g); CY(1.55, 1.55, 0.3, 16, '#c9b13a', w / 2 - 1.7, 6.1, z, g); }
    B(2.6, 2.6, 0.12, MT('#7b8286', 'metal'), -2, 1.3, d / 2 - 0.95, g);
  },
  sawmill(g, w, d) {
    const wood = MT('#8a6a52', 'wood');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(0.3, 4.4, 0.3, wood, sx * (w / 2 - 1), 2.2, sz * (d / 2 - 1.5), g);
    B(w, 0.3, d - 1.6, MT('#6c777d', 'metal'), 0, 4.5, -0.3, g).rotation.x = 0.06;
    B(8, 0.9, 1.2, M('#5d6366'), -1, 0.45, -1, g); // the saw bench
    CY(0.9, 0.9, 0.06, 20, M('#c9cfd2', { metalness: 0.7, roughness: 0.3 }), -1, 1.2, -1, g).rotation.x = Math.PI / 2;
    const bark = M('#7a5a3c'), cut = M('#d9b98a');
    for (let k = 0; k < 9; k++) { const l = CY(0.32, 0.32, 6, 10, k % 3 ? bark : cut, w / 2 - 3.5 + (k % 3) * 0.66, 0.35 + Math.floor(k / 3) * 0.58, 1.5, g); l.rotation.x = Math.PI / 2; }
    for (let k = 0; k < 4; k++) B(4, 0.2, 1.2, MT('#d9b98a', 'wood'), -w / 2 + 3, 0.1 + k * 0.22, 2.4, g);
  },
};

/**
 * Builds building b ({ type, x, z, rot }) at height y; w, d = its footprint. Returns { group, label } to
 * take it away again with unplace().
 */
export function place(b, y, w, d) {
  const g = new THREE.Group();
  MODEL[b.type](g, w, d);
  const rc = RING_COL[b.type];
  bake(flatten(g));
  g.position.set(b.x, y, b.z); g.rotation.y = (b.rot * Math.PI) / 2;
  if (rc) { // the ring in front of the door: unload, load pallets, store
    const ring = new THREE.Mesh(new THREE.RingGeometry(4.5, 5, 40), new THREE.MeshBasicMaterial({ color: col(rc), transparent: true, opacity: 0.75 }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.07, d / 2 + 5); g.add(ring);
  }
  scene.add(g);
  // the name board over the door, in world space (updLabels in buildings.js hides far ones by their position)
  const s = Math.sin(g.rotation.y), c = Math.cos(g.rotation.y), lz = b.type === 'silo' ? 3.2 : d / 2 + 0.25, ly = b.type === 'silo' ? 4 : b.type === 'shed' ? 5.9 : 4.9;
  const lab = label(scene, NAME[b.type], b.x + s * lz, y + ly, b.z + c * lz, g.rotation.y);
  return { group: g, label: lab };
}
export function unplace(p) {
  scene.remove(p.group);
  p.group.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
  dropLabel(p.label);
}

/** The see-through preview in build mode: green where it can stand, red where not. */
const ghostMat = new THREE.MeshBasicMaterial({ color: col('#5fbf6a'), transparent: true, opacity: 0.35, depthWrite: false });
const ghost = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), ghostMat);
const ghostRing = new THREE.Mesh(new THREE.RingGeometry(4.5, 5, 40), new THREE.MeshBasicMaterial({ color: col('#ffffff'), transparent: true, opacity: 0.6, depthWrite: false }));
ghostRing.rotation.x = -Math.PI / 2;
ghost.visible = ghostRing.visible = false;
scene.add(ghost, ghostRing);
export function showGhost(on, x, y, z, w, d, h, rot, ok, ring) {
  ghost.visible = on; ghostRing.visible = on && !!ring;
  if (!on) return;
  ghost.position.set(x, y, z); ghost.rotation.y = (rot * Math.PI) / 2; ghost.scale.set(w, h, d);
  ghostMat.color.set(ok ? '#5fbf6a' : '#d9534f');
  if (ring) ghostRing.position.set(ring.x, y + 0.08, ring.z);
}
