// Synthesized sound (no audio files): engine with load, field work, wind, rain, birds by day,
// crickets at night, a till sound when money comes in and short animal calls (see playAt).
// Nothing runs until the player turns sound on (browsers need a click first anyway).
let A = null;
export const sound = { on: false };

function noiseBuffer(ac) {
  const b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function build() {
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
  const noise = noiseBuffer(ac);
  const src = () => { const s = ac.createBufferSource(); s.buffer = noise; s.loop = true; s.start(0, Math.random() * 2); return s; };
  const filt = (type, f, q = 0.7) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const gain = (v = 0) => { const g = ac.createGain(); g.gain.value = v; return g; };
  const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };

  // engine: diesel firing pulse (rich harmonics) + sub + combustion noise, lowpass opens with load
  const real = new Float32Array(16), imag = new Float32Array(16);
  for (let k = 1; k < 16; k++) imag[k] = (k % 2 ? 1 : 0.6) / k ** 1.15;
  const wave = ac.createPeriodicWave(real, imag);
  const o1 = ac.createOscillator(), o2 = ac.createOscillator(), sub = ac.createOscillator();
  o1.setPeriodicWave(wave); o2.setPeriodicWave(wave); sub.type = 'sine';
  const eLp = filt('lowpass', 300, 1.2), eGain = gain();
  o1.connect(eLp); o2.connect(eLp); chain(sub, gain(0.6), eLp);
  const eNoise = chain(src(), filt('bandpass', 180, 1.5), gain(0.5));
  eNoise.connect(eLp);
  // "chug": amplitude wobble at half the firing rate
  const chug = ac.createOscillator(), chugDepth = gain(0.25), eAmp = gain(0.75);
  chain(chug, chugDepth, eAmp.gain);
  chain(eLp, eAmp, eGain, master);
  const turbo = ac.createOscillator(), tGain = gain(); turbo.type = 'sine'; chain(turbo, tGain, master);
  [o1, o2, sub, chug, turbo].forEach(o => o.start());

  // field work: threshing (combine), soil (tools in the ground)
  const thresh = chain(src(), filt('bandpass', 1300, 0.8), gain());
  const threshLow = chain(src(), filt('lowpass', 220), gain());
  const soil = chain(src(), filt('lowpass', 420, 0.9), gain());
  [thresh, threshLow, soil].forEach(n => n.connect(master));

  // ambience: wind gusts and rain
  const windF = filt('bandpass', 380, 0.6), wind = chain(src(), windF, gain());
  const rain = chain(src(), filt('highpass', 1800), gain());
  const rainLow = chain(src(), filt('lowpass', 600), gain());
  [wind, rain, rainLow].forEach(n => n.connect(master));

  return { ac, master, o1, o2, sub, chug, eLp, eGain, turbo, tGain, thresh, threshLow, soil, wind, windF, rain, rainLow, gain, filt, src, nextBird: 2, nextCricket: 1, lastFlash: 0, lastMoney: 0, nextTill: 0 };
}

export function toggleSound() {
  if (!A) { try { A = build(); } catch { return false; } }
  sound.on = !sound.on;
  if (A.ac.state === 'suspended') A.ac.resume();
  return sound.on;
}

const set = (p, v, t, tau = 0.15) => p.setTargetAtTime(v, t, tau);

/* ---------- one-shots ---------- */
function tone(type, f0, f1, at, dur, vol, dest, filter) {
  const o = A.ac.createOscillator(), g = A.gain();
  o.type = type;
  o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + dur);
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + Math.min(0.03, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  if (filter) { o.connect(filter); filter.connect(g); } else o.connect(g);
  g.connect(dest || A.master);
  o.start(at); o.stop(at + dur + 0.05);
}
function bird(at, vol) {
  const base = 2600 + Math.random() * 1800, n = 2 + ((Math.random() * 5) | 0);
  for (let i = 0; i < n; i++) {
    const t = at + i * (0.09 + Math.random() * 0.07), up = Math.random() < 0.6;
    tone('sine', base * (up ? 0.85 : 1.15), base * (up ? 1.2 : 0.8), t, 0.05 + Math.random() * 0.06, vol);
  }
}
function cricket(at, vol) {
  for (let i = 0; i < 3; i++) tone('triangle', 4300, 4250, at + i * 0.045, 0.03, vol);
}
function till() {
  const t = A.ac.currentTime;
  tone('triangle', 1760, 1740, t, 0.18, 0.05);
  tone('triangle', 2640, 2600, t + 0.07, 0.3, 0.04);
}

/** Animal and other calls at a world position; quieter with distance (heard up to range metres). */
export function playAt(kind, x, z, listener, range = 90) {
  if (!A || !sound.on) return;
  const d = Math.hypot(x - listener.x, z - listener.z), k = Math.max(0, 1 - d / range);
  if (k <= 0.02) return;
  const t = A.ac.currentTime, v = 0.09 * k * k;
  if (kind === 'moo') {
    const f = A.filt('bandpass', 520, 2.5);
    tone('sawtooth', 128, 102, t, 1.1 + Math.random() * 0.5, v * 1.6, null, f);
  } else if (kind === 'bark') {
    for (let i = 0; i < 2; i++) tone('square', 420, 260, t + i * 0.22, 0.11, v, null, A.filt('lowpass', 1400));
  } else if (kind === 'cluck') {
    for (let i = 0; i < 3; i++) tone('square', 900, 650, t + i * 0.14, 0.05, v * 0.6, null, A.filt('bandpass', 1200, 3));
  } else if (kind === 'meow') {
    tone('sawtooth', 620, 880, t, 0.18, v * 0.6, null, A.filt('bandpass', 1100, 4));
    tone('sawtooth', 880, 520, t + 0.18, 0.35, v * 0.6, null, A.filt('bandpass', 1100, 4));
  } else if (kind === 'horn') {
    // two-tone train horn
    for (const [f, dt] of [[330, 0], [262, 0.55]]) tone('sawtooth', f, f * 0.99, t + dt, 0.5, v * 1.4, null, A.filt('lowpass', 1200));
  } else if (kind === 'crow') {
    tone('sawtooth', 700, 500, t, 0.25, v * 0.5, null, A.filt('bandpass', 1500, 3));
  }
}

/**
 * Per frame. v = active vehicle; env = { playing, rain (0..1), hour, money, wet (rain kind), winter }.
 */
export function updAudio(v, env) {
  if (!A) return;
  const t = A.ac.currentTime, on = sound.on && env.playing;
  set(A.master.gain, on ? 1 : 0, t, 0.25);
  if (!on) { A.lastFlash = env.flash; A.lastMoney = env.money; return; }

  // engine: idle ~ 13 Hz firing, rises with speed and throttle; harvesters run high while working
  const working = v.lowered && Math.abs(v.speed) > 0.3;
  const big = v.type === 'combine' || v.type === 'beet' || v.type === 'forest';
  const load = Math.max(0, v.thr) * 0.6 + (working ? 0.5 : 0) + (v.cutting ? 0.6 : 0);
  const rpm = Math.min(1, Math.abs(v.speed) / 10 * 0.6 + load * 0.5 + (v.lowered && v.harvester ? 0.35 : 0));
  const f = (big ? 11 : 13) + rpm * (big ? 15 : 19);
  const engineOn = v.fuel > 0;
  set(A.o1.frequency, f * 2, t); set(A.o2.frequency, f * 2 * 1.007, t); set(A.sub.frequency, f, t); set(A.chug.frequency, f / 2, t);
  set(A.eLp.frequency, 260 + rpm * 900 + load * 300, t, 0.2);
  set(A.eGain.gain, engineOn ? 0.055 + rpm * 0.05 + load * 0.02 : 0, t, 0.25);
  set(A.turbo.frequency, 1800 + rpm * 2600, t, 0.3);
  set(A.tGain.gain, engineOn ? rpm * rpm * 0.006 : 0, t, 0.3);

  // work sounds
  const threshing = v.harvester && v.lowered;
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
