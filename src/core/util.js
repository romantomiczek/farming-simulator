import * as THREE from 'three';

export const fmtInt = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 });
export const fmtDec = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmt = n => fmtInt.format(n);
export const fmt2 = n => fmtDec.format(n);
/** Czech plural: plural(1, 'balík', 'balíky', 'balíků') → '1 balík'. */
export const plural = (n, one, few, many) => n + ' ' + (n === 1 ? one : n >= 2 && n <= 4 ? few : many);

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const hash2 = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };

export function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
}
export const fbm = (x, z) => vnoise(x, z) * 0.55 + vnoise(x * 2.1 + 9, z * 2.1) * 0.3 + vnoise(x * 4.3, z * 4.3 + 5) * 0.15;

/** Seeded PRNG (mulberry32), so the world layout is the same on every start. */
export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** sRGB hex → THREE.Color (three converts to linear working space itself). */
export const col = h => new THREE.Color(h);
export const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const angDiff = (a, b) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};
