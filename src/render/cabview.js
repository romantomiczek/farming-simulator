import * as THREE from 'three';

/**
 * What the driver sees in the cab view (V): the instrument cluster behind the wheel and the terminal
 * on the right post show the machine's state (one canvas shared by all cabs, drawn only for the
 * machine you sit in), and the mirrors show the road behind (a small render target, one mirror
 * rendered every other frame, only while in the cab).
 */
const DW = 512, DH = 256;
const dashCanvas = document.createElement('canvas');
dashCanvas.width = DW; dashCanvas.height = DH;
const dctx = dashCanvas.getContext('2d');
const dashTex = new THREE.CanvasTexture(dashCanvas);
dashTex.colorSpace = THREE.SRGBColorSpace;
dashTex.anisotropy = 4;
/** Lit screens: not shaded, not tone mapped, so they stay readable in the dark cab and at night. */
export const dashMat = new THREE.MeshBasicMaterial({ map: dashTex, toneMapped: false });
/** Parts of the shared canvas: the cluster on the left half, the terminal on the right half. */
export const DASH_UV = { cluster: [0, 0.5, 0, 1], terminal: [0.5, 1, 0, 1] };

// mirrors: left mirror in the left half of the target, right mirror in the right half
const MW = 256, MH = 224;
const mirrorRT = new THREE.WebGLRenderTarget(MW, MH, { depthBuffer: true });
mirrorRT.texture.generateMipmaps = false;
export const mirrorMat = new THREE.MeshBasicMaterial({ map: mirrorRT.texture, color: 0xd8dde0 });
/** Texture u range of each mirror's glass, flipped like a mirror image (sx = +1 is the left side). */
export const MIRROR_UV = { 1: [0.5, 0], [-1]: [1, 0.5] };
const mirrorCam = new THREE.PerspectiveCamera(42, MW / 2 / MH, 0.3, 260);

let cleared = false, side = 0, drawT = 0, frame = 0;
const _p = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion();

/** Grey glass until the first rear view is rendered (the target starts out black). */
function clearMirrors(renderer) {
  const old = renderer.getRenderTarget(), c = renderer.getClearColor(new THREE.Color()), a = renderer.getClearAlpha();
  renderer.setRenderTarget(mirrorRT);
  renderer.setClearColor(0x8a9aa2, 1); renderer.clear();
  renderer.setRenderTarget(old); renderer.setClearColor(c, a);
  cleared = true;
}

/** Renders one mirror of machine v (its markers in v.mirrors) into its half of the target. */
function renderMirror(renderer, scene, v, m) {
  v.group.updateMatrixWorld(true);
  _p.set(m.x, m.y, m.z); v.group.localToWorld(_p);
  // backwards and a little outwards and down, as a driver sets the mirror
  _d.set(m.sx * 0.16, -0.07, -1).normalize().applyQuaternion(v.group.getWorldQuaternion(_q));
  mirrorCam.position.copy(_p);
  mirrorCam.lookAt(_p.add(_d));
  const half = m.sx > 0 ? 0 : MW / 2, old = renderer.getRenderTarget(), shadows = renderer.shadowMap.autoUpdate;
  renderer.shadowMap.autoUpdate = false; // the main view renders the shadows once per frame
  mirrorMat.visible = false; // the mirrors must not see their own picture
  mirrorRT.viewport.set(half, 0, MW / 2, MH); mirrorRT.scissor.set(half, 0, MW / 2, MH); mirrorRT.scissorTest = true;
  renderer.setRenderTarget(mirrorRT);
  renderer.render(scene, mirrorCam);
  renderer.setRenderTarget(old);
  renderer.shadowMap.autoUpdate = shadows;
  mirrorMat.visible = true;
}

/* ---------- screens ---------- */
const C = { bg: '#0d1210', panel: '#161d1a', line: '#2a3430', ink: '#e9efe6', muted: '#8d9b92', acc: '#9fcf45', warn: '#f0b43c', bad: '#ec6a50', fuel: '#7cc0e8' };
const font = (w, px) => w + ' ' + px + 'px Figtree, "Segoe UI", sans-serif';
/** Round dial with a needle: value f 0..1 over 240°, label in the middle. */
function dial(x, y, r, f, label, value, col) {
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, a = a0 + (a1 - a0) * Math.max(0, Math.min(1, f));
  const c = dctx;
  c.fillStyle = '#0a0e0c'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.lineWidth = 2; c.strokeStyle = C.line; c.stroke();
  c.lineCap = 'round';
  for (let k = 0; k <= 12; k++) {
    const t = a0 + ((a1 - a0) * k) / 12, big = k % 2 === 0, r0 = r * 0.86, r1 = r * (big ? 0.72 : 0.78);
    c.strokeStyle = k >= 10 && label === 'ot/min' ? C.bad : '#c9d2cb'; c.lineWidth = big ? 2.5 : 1.5;
    c.beginPath(); c.moveTo(x + Math.cos(t) * r0, y + Math.sin(t) * r0); c.lineTo(x + Math.cos(t) * r1, y + Math.sin(t) * r1); c.stroke();
  }
  c.strokeStyle = col; c.lineWidth = 4;
  c.beginPath(); c.arc(x, y, r * 0.93, a0, a); c.stroke();
  c.strokeStyle = '#ff7a3c'; c.lineWidth = 3.5;
  c.beginPath(); c.moveTo(x - Math.cos(a) * r * 0.12, y - Math.sin(a) * r * 0.12); c.lineTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7); c.stroke();
  c.fillStyle = '#3a4440'; c.beginPath(); c.arc(x, y, r * 0.1, 0, Math.PI * 2); c.fill();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = C.ink; c.font = font(800, r * 0.34); c.fillText(value, x, y + r * 0.42);
  c.fillStyle = C.muted; c.font = font(600, r * 0.17); c.fillText(label, x, y + r * 0.7);
}
function bar(x, y, w, h, f, col) {
  dctx.fillStyle = C.line; dctx.fillRect(x, y, w, h);
  dctx.fillStyle = col; dctx.fillRect(x, y, w * Math.max(0, Math.min(1, f)), h);
}
/** s = state of the machine (see cabScreen in hud.js). */
function drawCluster(s) {
  const c = dctx;
  c.fillStyle = C.bg; c.fillRect(0, 0, DW / 2, DH);
  dial(66, 112, 56, s.rpm / 2400, 'ot/min', String(Math.round(s.rpm / 10) * 10), C.acc);
  dial(190, 112, 56, s.kmh / s.top, 'km/h', String(Math.round(s.kmh)), C.acc);
  // fuel and temperature bars, warning lamps
  c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = font(700, 15);
  c.fillStyle = C.muted; c.fillText('NAFTA', 14, 210);
  bar(76, 204, 162, 12, s.fuel, s.fuel < 0.15 ? C.bad : C.fuel);
  const lamps = [['P', s.kmh < 0.5, C.bad], ['NÁŘ', s.lowered, C.warn], ['PTO', s.working, C.acc], ['!', s.fuel < 0.15 || s.cond < 0.3, C.bad]];
  lamps.forEach(([t, on, col], i) => {
    c.fillStyle = on ? col : '#1f2723'; c.fillRect(14 + i * 58, 228, 50, 20);
    c.fillStyle = on ? '#0d1210' : '#55625a'; c.font = font(800, 13); c.textAlign = 'center'; c.fillText(t, 39 + i * 58, 239);
  });
  c.textAlign = 'center'; c.fillStyle = s.gear === 'R' ? C.warn : C.ink; c.font = font(800, 26); c.fillText(s.gear, 128, 30);
}
function drawTerminal(s) {
  const c = dctx, x0 = DW / 2;
  c.fillStyle = C.bg; c.fillRect(x0, 0, DW / 2, DH);
  c.fillStyle = C.panel; c.fillRect(x0, 0, DW / 2, 34);
  c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillStyle = C.acc; c.font = font(800, 16); c.fillText('TERMINÁL', x0 + 12, 17);
  c.textAlign = 'right'; c.fillStyle = C.muted; c.font = font(700, 15); c.fillText(s.clock, x0 + 244, 17);
  c.textAlign = 'left'; c.fillStyle = C.ink; c.font = font(700, 18);
  c.fillText(fit(s.tool, 232), x0 + 12, 56);
  // big state of the implement
  const st = s.working ? ['PRACUJE', C.acc] : s.lowered ? ['SPUŠTĚNO', C.warn] : s.hasTool ? ['ZVEDNUTO', C.muted] : ['BEZ NÁŘADÍ', C.muted];
  c.fillStyle = st[1]; c.fillRect(x0 + 12, 72, 232, 44);
  c.fillStyle = '#0d1210'; c.textAlign = 'center'; c.font = font(800, 24); c.fillText(st[0], x0 + 128, 95);
  c.textAlign = 'left';
  let y = 140;
  if (s.fill != null) {
    c.fillStyle = C.muted; c.font = font(600, 15); c.fillText(s.fillLabel, x0 + 12, y);
    c.textAlign = 'right'; c.fillStyle = C.ink; c.font = font(800, 15); c.fillText(Math.round(s.fill * 100) + ' %', x0 + 244, y); c.textAlign = 'left';
    bar(x0 + 12, y + 11, 232, 10, s.fill, C.warn);
    y += 40;
  }
  c.fillStyle = C.muted; c.font = font(600, 15); c.fillText(fit(s.field || 'Mimo pole', 232), x0 + 12, y);
  y += 26;
  c.fillText('Stav ' + Math.round(s.cond * 100) + ' %', x0 + 12, y);
  c.textAlign = 'right'; c.fillText(Math.round(s.fuelL) + ' l', x0 + 244, y);
}
const fit = (t, w) => { let s = t; while (s.length > 3 && dctx.measureText(s).width > w) s = s.slice(0, -2) + '…'; return s; };

/**
 * Every frame: while v is seen from the cab, redraws the screens five times a second from
 * screen() (a function returning the machine state) and renders one of its mirrors every other frame.
 */
export function updCabView(dt, renderer, scene, v, inCab, screen) {
  if (!cleared) { clearMirrors(renderer); drawCluster(screen()); drawTerminal(screen()); dashTex.needsUpdate = true; }
  if (!inCab || !v) return;
  drawT -= dt;
  if (drawT <= 0) {
    drawT = 0.2;
    const s = screen();
    drawCluster(s); drawTerminal(s);
    dashTex.needsUpdate = true;
  }
  if (v.mirrors?.length && (frame++ & 1) === 0) {
    side = (side + 1) % v.mirrors.length;
    renderMirror(renderer, scene, v, v.mirrors[side]);
  }
}
