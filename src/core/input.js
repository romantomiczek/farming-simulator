/** Currently held keys by KeyboardEvent.code. Touch buttons write into the same map. */
export const keys = {};
const PREVENT = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export const touchMode = matchMedia('(hover: none) and (pointer: coarse)').matches;

/** onAction(code) is called once per key press (not on auto-repeat) and for touch taps. */
export function bindInput(onAction) {
  addEventListener('keydown', e => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (PREVENT.has(e.code)) e.preventDefault();
    keys[e.code] = true;
    if (!e.repeat) onAction(e.code);
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', releaseAll);

  if (touchMode) {
    document.body.classList.add('touch');
    document.getElementById('touch').hidden = false;
  }
  document.querySelectorAll('#touch [data-hold]').forEach(b => {
    const k = b.dataset.hold;
    const on = e => { e.preventDefault(); keys[k] = true; b.classList.add('held'); };
    const off = () => { keys[k] = false; b.classList.remove('held'); };
    b.addEventListener('pointerdown', on);
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, off);
  });
  document.querySelectorAll('#touch [data-tap]').forEach(b =>
    b.addEventListener('pointerdown', e => { e.preventDefault(); onAction(b.dataset.tap); }));
}

export function releaseAll() { for (const k in keys) keys[k] = false; }

/** Throttle and steering from the held keys: { thr, st } in -1..1. */
export function driveInput() {
  return {
    thr: (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0),
    st: (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0),
  };
}
