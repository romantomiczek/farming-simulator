import { markTrack, fieldAt } from '../world/fields.js';
import { emit } from './particles.js';
import { col } from '../core/util.js';
import { groundH } from '../world/terrain.js';

/**
 * Wheel ruts in the fields and dust behind the wheels in dry weather.
 * Wheel positions per vehicle type: [half track width, axle z] in the vehicle's local frame
 * (the big driving wheels, which leave the deepest ruts).
 */
const AXLE = { tractor: [1.0, -0.7], combine: [1.5, 1.25], beet: [1.6, 1.4], forest: [1.2, 0], jeep: [0.86, -1.3] };
const DUST = col('#cdb995'), DUST_DARK = col('#a58f6e');

function wheels(x, z, h, [hw, az], fn) {
  const s = Math.sin(h), c = Math.cos(h);
  const cx = x + s * az, cz = z + c * az;
  fn(cx + c * hw, cz - s * hw); fn(cx - c * hw, cz + s * hw);
}

/** vehicles: all machines (a towed trailer leaves its own track); dry: no rain, not winter. */
export function updTracks(dt, vehicles, dry) {
  for (const v of vehicles) {
    if (Math.abs(v.speed) < 0.3) continue;
    const ax = AXLE[v.type];
    if (!ax) continue;
    wheels(v.x, v.z, v.h, ax, (x, z) => markTrack(x, z, v.h));
    const t = v.impl === 'trailer' ? v.tool : null;
    if (t) wheels(t.x, t.z, t.h, [1.15, 0], (x, z) => markTrack(x, z, t.h));

    // dust: only on the fields (roads and the yard are paved), dry weather, at a decent speed
    v.dustT = (v.dustT || 0) - dt;
    if (!dry || Math.abs(v.speed) < 2.2 || v.dustT > 0 || !fieldAt(v.x, v.z)) continue;
    v.dustT = 0.09;
    wheels(v.x, v.z, v.h, ax, (x, z) => {
      const back = -Math.sign(v.speed) * 0.8;
      emit(x + Math.sin(v.h) * back, 0.35 + groundH(x, z), z + Math.cos(v.h) * back, Math.random() < 0.5 ? DUST_DARK : DUST, 0.5 + Math.random() * 0.3,
        (Math.random() - 0.5) * 0.6, 0.5 + Math.random() * 0.4, (Math.random() - 0.5) * 0.6, 1.4 + Math.random() * 0.6);
    });
  }
}
