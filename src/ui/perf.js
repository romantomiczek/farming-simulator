import { renderer } from '../render/core.js';
import { settings } from '../core/settings.js';
import { fmt } from '../core/util.js';

// FPS meter: average frame time, worst frame, time the processor spends on a frame (game logic and
// handing the draw calls to the graphics card), draw calls and triangles of the last frame.
// CPU time well below the frame time means the graphics card is the limit; close to it, the processor.
const el = document.getElementById('perf');
let acc = 0, n = 0, worst = 0, cpu = 0;
const ms = s => (s * 1000).toFixed(1).replace('.', ',');

/** dt = seconds since the previous frame, cpuMs = milliseconds the processor spent on this one. */
export function perfSample(dt, cpuMs) {
  acc += dt; n++; cpu += cpuMs;
  if (dt > worst) worst = dt;
  if (acc < 0.5) return;
  el.hidden = !settings.showFps;
  if (!el.hidden) {
    const fps = n / acc, info = renderer.info.render;
    el.innerHTML = '<b>' + Math.round(fps) + ' FPS</b>' +
      '<span>' + ms(acc / n) + ' ms · nejhorší ' + Math.round(worst * 1000) + ' ms</span>' +
      '<span>procesor ' + ms(cpu / n / 1000) + ' ms</span>' +
      '<span>' + info.calls + ' volání · ' + fmt(info.triangles / 1000) + ' tis. △</span>';
    el.classList.toggle('bad', fps < 30);
  }
  acc = 0; n = 0; worst = 0; cpu = 0;
}
