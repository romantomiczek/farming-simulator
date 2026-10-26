import * as THREE from 'three';
import { scene } from '../render/core.js';
import { col } from '../core/util.js';
import { groundH } from './terrain.js';
import { CROPS } from '../game/crops.js';

/**
 * Heaps lying on the ground: grain, chaff or silage tipped from a trailer next to the field or the barn,
 * manure or silage put down by a loader. Each heap is a cone that grows with its volume (a slope of
 * about 30°); a loader scoops from it (game/loader.js) and tips into a trailer.
 * { x, z, what: 'crop' | 'manure' | 'silage' | 'chaff', crop: crop index (or -1), l: litres }
 */
export const heaps = [];
export const HEAP_WHAT = ['crop', 'manure', 'silage', 'chaff'];
const MAX_L = 80000; // a heap takes at most this much, the rest starts a new one beside it
const GEO = new THREE.ConeGeometry(1, 1, 20, 1).translate(0, 0.5, 0);
const COL = { manure: col('#4a3a26'), silage: col('#8f8a3e'), chaff: col('#7d9a3c') };
const NAME = { manure: 'hnoje', silage: 'siláže', chaff: 'řezanky' };

/** Radius and height of a 30° cone holding l litres. */
const sizeOf = l => { const r = Math.max(0.35, Math.cbrt(l / 1000 / 0.604)); return { r, h: r * 0.577 }; };
/** "pšenice", "hnoje": what heap h is made of, in the genitive. */
export const heapName = h => (h.what === 'crop' ? CROPS[h.crop].gen : NAME[h.what]);
const same = (h, what, crop) => h.what === what && (what !== 'crop' || h.crop === crop);

function show(h) {
  if (!h.mesh) {
    h.mesh = new THREE.Mesh(GEO, new THREE.MeshStandardMaterial({ color: h.what === 'crop' ? CROPS[h.crop].heapCol : COL[h.what], roughness: 1, flatShading: true }));
    h.mesh.castShadow = true; h.mesh.receiveShadow = true;
    scene.add(h.mesh);
  }
  const { r, h: hh } = sizeOf(h.l);
  h.mesh.position.set(h.x, groundH(h.x, h.z) - 0.04, h.z);
  h.mesh.scale.set(r, hh, r);
}
function drop(h) {
  scene.remove(h.mesh); h.mesh?.material.dispose();
  heaps.splice(heaps.indexOf(h), 1);
}

/** The heap whose foot lies within r metres of (x, z), the nearest one, or null. */
export function heapAt(x, z, r = 1.5) {
  let best = null, bd = Infinity;
  for (const h of heaps) {
    const d = Math.hypot(h.x - x, h.z - z) - sizeOf(h.l).r;
    if (d < r && d < bd) { best = h; bd = d; }
  }
  return best;
}
/** Puts l litres of what (crop) down at (x, z): onto the heap of the same thing there, or a new one. Returns the heap. */
export function addToHeap(x, z, what, crop, l) {
  let h = heaps.find(o => same(o, what, crop) && o.l < MAX_L && Math.hypot(o.x - x, o.z - z) < sizeOf(o.l).r + 1);
  if (!h) { h = { x, z, what, crop: what === 'crop' ? crop : -1, l: 0 }; heaps.push(h); }
  h.l += l;
  show(h);
  return h;
}
/** Takes up to l litres from heap h; an empty heap disappears. Returns how much was taken. */
export function takeFromHeap(h, l) {
  const take = Math.min(l, h.l);
  h.l -= take;
  if (h.l < 5) drop(h); else show(h);
  return take;
}

export const serializeHeaps = () => heaps.map(h => ({ x: +h.x.toFixed(2), z: +h.z.toFixed(2), what: h.what, crop: h.crop, l: Math.round(h.l) }));
export function setHeaps(list) {
  while (heaps.length) drop(heaps[heaps.length - 1]);
  for (const d of Array.isArray(list) ? list : []) {
    if (!d || !Number.isFinite(d.x) || !Number.isFinite(d.z) || !HEAP_WHAT.includes(d.what) || !(d.l > 5)) continue;
    if (d.what === 'crop' && !(Number.isInteger(d.crop) && d.crop >= 0 && d.crop < CROPS.length)) continue;
    const h = { x: d.x, z: d.z, what: d.what, crop: d.what === 'crop' ? d.crop : -1, l: Math.min(MAX_L, d.l) };
    heaps.push(h); show(h);
  }
}
