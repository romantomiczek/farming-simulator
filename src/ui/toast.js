const box = document.getElementById('toasts');

/** Short message at the top of the screen. kind: '' | 'good' | 'bad'. */
export function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = msg;
  box.prepend(t);
  while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 3200);
}

const last = {};
/** Like toast(), but shows the same warning at most once every 4 seconds. */
export function warn(key, msg, kind = 'bad') {
  const t = performance.now();
  if (last[key] && t - last[key] < 4000) return;
  last[key] = t;
  toast(msg, kind);
}
