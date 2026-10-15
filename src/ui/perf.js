import { renderer } from '../render/core.js';
import { settings } from '../core/settings.js';
import { fmt } from '../core/util.js';

// FPS meter: average frame time, worst frame, draw calls and triangles of the last frame.
const el = document.getElementById('perf');
let acc = 0, n = 0, worst = 0;

export function perfSample(dt) {
  acc += dt; n++;
  if (dt > worst) worst = dt;
  if (acc < 0.5) return;
  el.hidden = !settings.showFps;
  if (!el.hidden) {
    const fps = n / acc, info = renderer.info.render;
    el.innerHTML = '<b>' + Math.round(fps) + ' FPS</b>' +
      '<span>' + ((acc / n) * 1000).toFixed(1).replace('.', ',') + ' ms · nejhorší ' + Math.round(worst * 1000) + ' ms</span>' +
      '<span>' + info.calls + ' volání · ' + fmt(info.triangles / 1000) + ' tis. △</span>';
    el.classList.toggle('bad', fps < 30);
  }
  acc = 0; n = 0; worst = 0;
}
