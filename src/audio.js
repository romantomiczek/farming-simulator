// Sound in four groups, each with its own volume (settings.vol, Nastavení zvuku in the menu):
//   music   – background pieces (audio/music.js), quieter while you work, fuller in the menu and the office
//   engines – machines from recordings (audio/engines.js), threshing and soil synthesized here
//   ambient – synthesized wind, rain, birds by day, crickets at night and animal calls (playAt)
//   effects – a till when money comes in, horns
// Engines and ambience are silent in the menu and the office, the music plays on. Nothing runs
// until the player turns sound on (browsers need a click first anyway).
import { settings } from './core/settings.js';
import { initEngines, updEngines, engineLoud, engineTest } from './audio/engines.js';
import { initMusic, updMusic } from './audio/music.js';

let A = null;
export const sound = { on: false };

function noiseBuffer(ac) {
  const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function build() {
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const gain = (v = 0) => { const g = ac.createGain(); g.gain.value = v; return g; };
  const master = gain(0); master.connect(ac.destination);
  const bus = { music: gain(0), engines: gain(0), ambient: gain(0), effects: gain(0) };
  for (const k in bus) bus[k].connect(master);
  const noise = noiseBuffer(ac);
  const src = () => { const s = ac.createBufferSource(); s.buffer = noise; s.loop = true; s.start(0, Math.random() * 2); return s; };
  const filt = (type, f, q = 0.7) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };

  // field work: threshing (combine), soil (tools in the ground)
  const thresh = chain(src(), filt('bandpass', 1300, 0.8), gain());
  const threshLow = chain(src(), filt('lowpass', 220), gain());
  const soil = chain(src(), filt('lowpass', 420, 0.9), gain());
  [thresh, threshLow, soil].forEach(n => n.connect(bus.engines));

  // ambience: wind gusts and rain
  const windF = filt('bandpass', 380, 0.6), wind = chain(src(), windF, gain());
  const rain = chain(src(), filt('highpass', 1800), gain());
  const rainLow = chain(src(), filt('lowpass', 600), gain());
  [wind, rain, rainLow].forEach(n => n.connect(bus.ambient));

  initEngines(ac, bus.engines, noise);
  initMusic(ac, bus.music);
  return { ac, master, bus, noise, thresh, threshLow, soil, wind, windF, rain, rainLow, gain, filt, nextBird: 2, nextCricket: 1, lastFlash: 0, lastMoney: 0, nextTill: 0 };
}

export function toggleSound() {
  if (!A) { try { A = build(); } catch { return false; } }
  sound.on = !sound.on;
  if (A.ac.state === 'suspended') A.ac.resume();
  return sound.on;
}
// a hidden page goes quiet (the music pauses where it was)
document.addEventListener('visibilitychange', () => {
  if (!A) return;
  if (document.hidden) A.ac.suspend();
  else if (sound.on) A.ac.resume();
});

const set = (p, v, t, tau = 0.15) => p.setTargetAtTime(v, t, tau);

/* ---------- one-shots ---------- */
function tone(type, f0, f1, at, dur, vol, dest, filter) {
  const o = A.ac.createOscillator(), g = A.gain();
  o.type = type;
  o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + dur);
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + Math.min(0.03, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  if (filter) { o.connect(filter); filter.connect(g); } else o.connect(g);
  g.connect(dest);
  o.start(at); o.stop(at + dur + 0.05);
}
function bird(at, vol) {
  const base = 2600 + Math.random() * 1800, n = 2 + ((Math.random() * 5) | 0);
  for (let i = 0; i < n; i++) {
    const t = at + i * (0.09 + Math.random() * 0.07), up = Math.random() < 0.6;
    tone('sine', base * (up ? 0.85 : 1.15), base * (up ? 1.2 : 0.8), t, 0.05 + Math.random() * 0.06, vol, A.bus.ambient);
  }
}
function cricket(at, vol) {
  for (let i = 0; i < 3; i++) tone('triangle', 4300, 4250, at + i * 0.045, 0.03, vol, A.bus.ambient);
}
function till() {
  const t = A.ac.currentTime;
  tone('triangle', 1760, 1740, t, 0.18, 0.05, A.bus.effects);
  tone('triangle', 2640, 2600, t + 0.07, 0.3, 0.04, A.bus.effects);
}

/** A crash of the machine you drive: a dull thump, crunching and, for a hard hit, a clank. strength 0..1. */
export function playImpact(strength) {
  if (!A || !sound.on) return;
  const t = A.ac.currentTime, k = Math.min(1, Math.max(0, strength)), fx = A.bus.effects;
  tone('sine', 75, 38, t, 0.35, 0.05 + 0.25 * k, fx);
  const s = A.ac.createBufferSource(), f = A.filt('bandpass', 700 + 900 * k, 0.9), g = A.gain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.04 + 0.2 * k, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12 + 0.25 * k);
  s.buffer = A.noise; s.connect(f); f.connect(g); g.connect(fx); s.start(t, Math.random()); s.stop(t + 0.5);
  if (k > 0.35) for (const fr of [310, 467]) tone('square', fr, fr * 0.96, t + 0.02, 0.25, 0.02 * k, fx, A.filt('bandpass', fr * 2, 6));
}

/** Animal and other calls at a world position; quieter with distance (heard up to range metres). */
export function playAt(kind, x, z, listener, range = 90) {
  if (!A || !sound.on) return;
  const d = Math.hypot(x - listener.x, z - listener.z), k = Math.max(0, 1 - d / range);
  if (k <= 0.02) return;
  const t = A.ac.currentTime, v = 0.09 * k * k, amb = A.bus.ambient, fx = A.bus.effects;
  if (kind === 'moo') {
    const f = A.filt('bandpass', 520, 2.5);
    tone('sawtooth', 128, 102, t, 1.1 + Math.random() * 0.5, v * 1.6, amb, f);
  } else if (kind === 'bark') {
    for (let i = 0; i < 2; i++) tone('square', 420, 260, t + i * 0.22, 0.11, v, amb, A.filt('lowpass', 1400));
  } else if (kind === 'cluck') {
    for (let i = 0; i < 3; i++) tone('square', 900, 650, t + i * 0.14, 0.05, v * 0.6, amb, A.filt('bandpass', 1200, 3));
  } else if (kind === 'meow') {
    tone('sawtooth', 620, 880, t, 0.18, v * 0.6, amb, A.filt('bandpass', 1100, 4));
    tone('sawtooth', 880, 520, t + 0.18, 0.35, v * 0.6, amb, A.filt('bandpass', 1100, 4));
  } else if (kind === 'honk') {
    for (const f of [415, 523]) tone('square', f, f, t, 0.35, v * 0.9, fx, A.filt('lowpass', 1800));
  } else if (kind === 'horn') {
    // two-tone train horn
    for (const [f, dt] of [[330, 0], [262, 0.55]]) tone('sawtooth', f, f * 0.99, t + dt, 0.5, v * 1.4, fx, A.filt('lowpass', 1200));
  } else if (kind === 'crow') {
    tone('sawtooth', 700, 500, t, 0.25, v * 0.5, amb, A.filt('bandpass', 1500, 3));
  }
}

/**
 * Per frame. env = { playing, rain (0..1), hour, flash, money, winter, active (the machine you sit
 * in), vehicles, traffic (background cars), ear: { x, z, rx, rz } (listening point and the camera's
 * right direction) }.
 */
export function updAudio(dt, env) {
  if (!A) return;
  const t = A.ac.currentTime, on = sound.on, vol = settings.vol, play = env.playing;
  set(A.master.gain, on ? 1 : 0, t, 0.25);
  updMusic(dt, on && vol.music > 0.001 && !document.hidden);
  if (!on) { A.lastFlash = env.flash; A.lastMoney = env.money; return; }
  updEngines(dt, env);
  // the music steps back while the engine works and fills in when the game stands
  set(A.bus.music.gain, vol.music * (play ? 0.8 - 0.35 * engineLoud() : 1), t, 0.5);
  set(A.bus.engines.gain, vol.engines * (play || engineTest.on ? 1 : 0), t, 0.25);
  set(A.bus.ambient.gain, vol.ambient * (play ? 1 : 0), t, 0.25);
  set(A.bus.effects.gain, vol.effects, t, 0.1);
  if (!play) {
    for (const n of [A.thresh, A.threshLow, A.soil]) set(n.gain, 0, t, 0.2); // quiet under the engine test
    A.lastFlash = env.flash; A.lastMoney = env.money;
    return;
  }

  // work sounds of the machine you sit in
  const v = env.active, working = v.lowered && Math.abs(v.speed) > 0.3, threshing = v.harvester && v.lowered;
  set(A.thresh.gain, threshing ? 0.022 + (working ? 0.025 : 0) : 0, t, 0.3);
  set(A.threshLow.gain, threshing ? 0.06 : 0, t, 0.3);
  set(A.soil.gain, v.type === 'tractor' && working ? 0.05 + Math.abs(v.speed) * 0.006 : 0, t, 0.2);

  // ambience
  const gust = 0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.13 + 1);
  set(A.wind.gain, 0.012 + gust * 0.018 + env.rain * 0.02, t, 0.8);
  set(A.windF.frequency, 300 + gust * 250, t, 0.8);
  set(A.rain.gain, env.rain * (env.winter ? 0.008 : 0.03), t, 0.6);
  set(A.rainLow.gain, env.rain * (env.winter ? 0.01 : 0.03), t, 0.6);

  const h = env.hour, dayBirds = h > 4.5 && h < 20.5 && env.rain < 0.3 && !env.winter;
  const dawnChorus = (h > 4.5 && h < 8) || (h > 18 && h < 20.5) ? 2.2 : 1;
  if (dayBirds && t > A.nextBird) {
    bird(t + 0.05, 0.012 + Math.random() * 0.015);
    A.nextBird = t + (2 + Math.random() * 7) / dawnChorus;
  }
  const night = h < 4.5 || h > 21;
  if (night && !env.winter && env.rain < 0.3 && t > A.nextCricket) {
    for (let i = 0; i < 4; i++) cricket(t + i * 0.32 + Math.random() * 0.05, 0.006 + Math.random() * 0.006);
    A.nextCricket = t + 1.6 + Math.random() * 2.5;
  }

  // the money flash restarts at 0.4 on every payment; one till per sale, not per unloading frame
  if (env.flash > A.lastFlash + 0.2 && env.money > A.lastMoney && t > A.nextTill) { till(); A.nextTill = t + 1; }
  A.lastFlash = env.flash; A.lastMoney = env.money;
}
