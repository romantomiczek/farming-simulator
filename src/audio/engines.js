import { profileOf } from './profiles.js';

/**
 * Engines from recordings (public/audio/engines, authors in public/audio/CREDITS.md). Each set has
 * loops of one engine held at a steady speed (rpm of the recording). A running machine plays all
 * loops of its set at once: the two nearest its engine speed are heard (equal-power crossfade on a
 * log scale of rpm) and each is played faster or slower to that speed, times the model's pitch.
 * Load (pulling, working, accelerating) makes the engine louder and opens a low-pass filter; letting
 * go of the throttle muffles it. Distance quiets and muffles it, and it sits left or right of the
 * camera. Up to VOICES machines are heard at once: the one you drive and the nearest running ones.
 * A machine starts with a starter when someone gets in (or a helper takes it) and stops STOP_AFTER
 * seconds after it is left.
 */
const LOOPS = {
  old: [['old/idle', 987], ['old/high', 1590]],
  tractor: [['tractor/idle', 807], ['tractor/mid', 1185], ['tractor/high', 1680]],
  big: [['big/idle', 530], ['big/high', 1440]],
  diesel: [['diesel/idle', 720], ['diesel/mid', 1110], ['diesel/high', 1500], ['diesel/top', 2100]],
  petrol: [['petrol/idle', 854], ['petrol/mid', 1152], ['petrol/high', 1584]],
};
const ONESHOTS = ['start-diesel', 'start-petrol', 'saw'];
const VOICES = 4, HEAR = 170, STOP_AFTER = 6, START_DELAY = 1.1;
const BASE = import.meta.env.BASE_URL + 'audio/engines/';
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const set = (p, v, t, tau) => p.setTargetAtTime(v, t, tau);

let ac = null, dest = null, noise = null, loading = null;
const buf = {};
/** Resolves when the recordings are loaded (null before sound was first turned on). */
export const enginesReady = () => loading;
/** Loaded and failed files (for the smoke test and the developer panel). */
export const engineFiles = { loaded: 0, failed: 0, total: Object.values(LOOPS).flat().length + ONESHOTS.length };
/**
 * Developer panel's engine test: the machine you sit in plays model's engine at rpm and load (0..1),
 * also in the menu.
 */
export const engineTest = { on: false, model: 'brazda-140', rpm: 0.3, load: 0.3 };

/** Starts loading the recordings; the promise resolves when all are decoded (or failed). */
export function initEngines(ctx, out, noiseBuf) {
  ac = ctx; dest = out; noise = noiseBuf;
  loading ||= Promise.all(Object.values(LOOPS).flat().map(l => l[0]).concat(ONESHOTS).map(async name => {
    try {
      const r = await fetch(BASE + name + '.ogg');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      buf[name] = await ac.decodeAudioData(await r.arrayBuffer());
      engineFiles.loaded++;
    } catch (e) {
      engineFiles.failed++;
      console.warn('Zvuk motoru se nenačetl: ' + name, e);
    }
  }));
  return loading;
}

const gainNode = v => { const g = ac.createGain(); g.gain.value = v; return g; };
function loopSrc(b) {
  const s = ac.createBufferSource();
  s.buffer = b; s.loop = true;
  s.start(ac.currentTime, Math.random() * b.duration);
  return s;
}

/** One heard engine: its loops, turbo hiss, gearbox whine and saw, through a filter, level and pan. */
class Voice {
  constructor(p) {
    this.p = p; this.srcs = []; this.born = ac.currentTime;
    this.mix = gainNode(1);
    this.lp = ac.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 3000; this.lp.Q.value = 0.4;
    this.out = gainNode(0);
    this.pan = ac.createStereoPanner();
    this.mix.connect(this.lp); this.lp.connect(this.out); this.out.connect(this.pan); this.pan.connect(dest);
    this.loops = LOOPS[p.set].filter(([n]) => buf[n]).map(([n, rpm]) => {
      const s = loopSrc(buf[n]), g = gainNode(0);
      s.connect(g); g.connect(this.mix); this.srcs.push(s);
      return { s, g, rpm };
    });
    if (p.turbo > 0) {
      const s = loopSrc(noise), f = ac.createBiquadFilter(), g = gainNode(0);
      f.type = 'bandpass'; f.Q.value = 5; f.frequency.value = 2500;
      s.connect(f); f.connect(g); g.connect(this.mix); this.srcs.push(s);
      this.turbo = { f, g };
    }
    if (p.cvt) {
      const o = ac.createOscillator(), g = gainNode(0);
      o.type = 'triangle'; o.frequency.value = 250; o.start();
      o.connect(g); g.connect(this.mix); this.srcs.push(o);
      this.whine = { o, g };
    }
    if (p.saw && buf.saw) {
      const s = loopSrc(buf.saw), g = gainNode(0);
      s.connect(g); g.connect(this.out); this.srcs.push(s); // after the filter: the saw stays sharp
      this.saw = g;
    }
  }
  /** The starter: plays now, the engine loops come in after it catches. */
  start(level) {
    const b = buf['start-' + this.p.fuel];
    this.born = ac.currentTime + (b ? START_DELAY : 0);
    if (!b) return;
    // the petrol starter (a Honda) is much sharper than the muffled petrol loops: quieter
    const s = ac.createBufferSource(), g = gainNode((this.p.fuel === 'petrol' ? 0.5 : 0.9) * level);
    s.buffer = b; s.connect(g); g.connect(this.pan); s.start();
  }
  /** rpm, load 0..1, s = engine speed share 0..1, u = road speed share, att = distance level, pan -1..1. */
  update(rpm, load, s, u, att, pan, dist, cutting) {
    const p = this.p, t = ac.currentTime, L = this.loops;
    if (!L.length) return;
    let i = 0;
    while (i < L.length - 2 && rpm > L[i + 1].rpm) i++;
    const x = L.length === 1 ? 0 : clamp(Math.log(rpm / L[i].rpm) / Math.log(L[i + 1].rpm / L[i].rpm), 0, 1);
    L.forEach((l, k) => {
      const w = k === i ? Math.cos((x * Math.PI) / 2) : k === i + 1 ? Math.sin((x * Math.PI) / 2) : 0;
      set(l.g.gain, w, t, 0.04);
      set(l.s.playbackRate, clamp((rpm / l.rpm) * p.pitch, 0.45, 2.2), t, 0.04);
    });
    const fadeIn = clamp((t - this.born) / 0.6, 0, 1);
    set(this.out.gain, p.gain * (0.5 + 0.25 * s + 0.35 * load) * att * fadeIn, t, 0.08);
    set(this.lp.frequency, clamp((1800 + 2500 * s + 9000 * load) / (1 + dist / 30), 400, 16000), t, 0.08);
    set(this.pan.pan, pan, t, 0.1);
    if (this.turbo) {
      set(this.turbo.g.gain, 0.15 * p.turbo * s * s * (0.3 + 0.7 * load), t, 0.15);
      set(this.turbo.f.frequency, 1800 + 3500 * s, t, 0.15);
    }
    if (this.whine) {
      set(this.whine.g.gain, 0.02 * u * (0.5 + 0.5 * load), t, 0.2);
      set(this.whine.o.frequency, 220 + 700 * u, t, 0.2);
    }
    if (this.saw) set(this.saw.gain, cutting ? 0.6 : 0, t, 0.1);
  }
  /** Engine off: speed and level sink, then everything stops and disconnects. */
  release() {
    const t = ac.currentTime;
    set(this.out.gain, 0, t, 0.25);
    for (const l of this.loops) set(l.s.playbackRate, l.s.playbackRate.value * 0.6, t, 0.35);
    for (const s of this.srcs) s.stop(t + 1.5);
    this.srcs[0]?.addEventListener('ended', () => this.pan.disconnect());
  }
}

/* ---------- engine speed ---------- */
const GEARS = [0.16, 0.33, 0.52, 0.75, 1]; // top of each gear as a share of the car's top speed
/** Engine speed share 0..1 of a car: rises through each gear and drops when it shifts up. */
function gearbox(st, u, thr, reverse) {
  if (u < 0.03) { st.gear = 0; return thr > 0 ? 0.3 : 0; }
  if (reverse) return clamp(0.15 + u * 3, 0, 0.8);
  const g = st.gear, lo = g ? GEARS[g - 1] * 0.7 : 0, x = clamp((u - lo) / (GEARS[g] - lo), 0, 1);
  if (x > 0.92 && g < GEARS.length - 1 && thr > 0) st.gear = g + 1;
  else if (x < 0.2 && g > 0) st.gear = g - 1;
  return 0.12 + (g === GEARS.length - 1 ? 0.6 : 0.88) * x; // the top gear is long: a quiet cruise
}
/** Where machine v's engine wants to be: [speed share 0..1, load 0..1]. */
function demand(v, st, p, dt) {
  const sp = Math.abs(v.speed || 0), u = Math.min(1, sp / (v.vmax || 10));
  let thr = Math.max(0, v.thr || 0);
  if (v.helper && sp > 0.5) thr = Math.max(thr, 0.5);
  if (st.traffic) thr = sp < (v.vmax || 10) * 0.95 ? 0.7 : 0.25; // speeding up, then cruising
  const working = !!v.lowered && sp > 0.3, accel = (sp - st.sp) / Math.max(dt, 1e-3) > 0.3 ? 0.25 : 0;
  st.sp = sp;
  if (p.set === 'big') {
    // combines and harvesters run at their working speed whenever they move or work
    const busy = sp > 0.3 || v.lowered || v.unloading || v.cutting || thr > 0;
    return [busy ? 0.84 + 0.08 * thr : 0, clamp((working ? 0.6 : 0) + 0.4 * thr + (v.cutting ? 0.5 : 0) + (v.unloading ? 0.3 : 0) + accel, 0, 1)];
  }
  if (p.car) return [gearbox(st, u, thr, v.speed < -0.1), thr > 0 ? clamp(0.4 + 0.6 * thr * (1 - u * 0.5) + accel, 0, 1) : 0];
  const load = clamp(0.5 * thr + (working ? 0.6 : 0) + accel, 0, 1);
  if (p.cvt) return [clamp(0.08 + 0.3 * u + (working ? 0.5 : 0) + 0.15 * thr, 0, 1), load];
  return [clamp(0.04 + 0.55 * u + 0.2 * thr + (working ? 0.35 : 0), 0, 1), load];
}

/* ---------- per frame ---------- */
const states = new Map(); // vehicle or traffic car → { on, off, rpm, sp, gear, voice, s, load, traffic }
// cars of the background traffic sound like the cars you can buy
const TRAFFIC_MODELS = ['dacia-duster', 'lesak', 'toyota-hilux'];
const trafficModel = new WeakMap();
let trafficN = 0;
const modelOf = v => v.model || trafficModel.get(v) || (trafficModel.set(v, TRAFFIC_MODELS[trafficN++ % 3]), trafficModel.get(v));
let loud = 0;
/** How loud the engine you sit in is, 0..1 (the music steps back under it). */
export const engineLoud = () => loud;

/**
 * env = { vehicles, traffic (background cars, always running), active, ear: { x, z, rx, rz }
 * (listening point and the camera's right direction), playing }. Engines only change state while
 * the game runs (or the engine test is on).
 */
export function updEngines(dt, env) {
  if (!ac) return;
  const { active, ear } = env, test = engineTest.on, cars = env.traffic || [], vehicles = env.vehicles.concat(cars);
  for (const [v, st] of states) if (!vehicles.includes(v)) { st.voice?.release(); states.delete(v); }
  for (const v of vehicles) {
    let st = states.get(v);
    if (!st) states.set(v, (st = { on: false, off: 0, rpm: 0, sp: 0, gear: 0, voice: null, s: 0, load: 0, traffic: cars.includes(v) }));
    if (st.traffic) { if (!st.on) { st.on = true; st.rpm = profileOf(modelOf(v)).idle; } continue; }
    if (!env.playing && !(test && v === active)) continue;
    const wants = (test && v === active) || (v.fuel > 0 && (v === active || v.helper || v.cutting || v.unloading));
    if (wants) {
      st.off = 0;
      if (!st.on) { st.on = true; st.fresh = true; st.rpm = profileOf(v.model).idle * 0.6; st.gear = 0; }
    } else if (st.on && (v.fuel <= 0 || (st.off += dt) > STOP_AFTER)) st.on = false;
  }

  // voices: the machine you sit in, then the nearest running ones
  const heard = [];
  for (const v of vehicles) {
    const st = states.get(v);
    if (!st.on) continue;
    const d = Math.hypot(v.x - ear.x, v.z - ear.z);
    if (v === active || d < HEAR) heard.push({ v, st, d });
  }
  // the farm's machines come before the traffic: a car counts as twice as far, at most two are heard
  const far = h => h.d * (h.st.traffic ? 2 : 1);
  heard.sort((a, b) => (b.v === active) - (a.v === active) || far(a) - far(b));
  let nCars = 0;
  const chosen = heard.filter(h => !(h.st.traffic && ++nCars > 2)).slice(0, VOICES);
  const keep = new Set(chosen.map(h => h.v));
  for (const [v, st] of states) if (st.voice && (!keep.has(v) || !st.on)) { st.voice.release(); st.voice = null; }

  loud = 0;
  for (const { v, st, d } of chosen) {
    const p = profileOf(test && v === active ? engineTest.model : modelOf(v));
    if (st.voice && st.voice.p !== p) { st.voice.release(); st.voice = null; }
    const att = 1 / Math.sqrt(1 + (d / 14) ** 2);
    if (!st.voice) {
      if (!LOOPS[p.set].some(([n]) => buf[n])) continue; // recordings not loaded (yet)
      st.voice = new Voice(p);
      if (st.fresh) st.voice.start(att);
    }
    st.fresh = false;
    const [s, load] = test && v === active ? [engineTest.rpm, engineTest.load] : demand(v, st, p, dt);
    const target = p.idle + (p.max - p.idle) * s, up = target > st.rpm;
    const tau = p.car ? (up ? 0.25 : 0.12) : up ? 0.45 : 0.7;
    st.rpm += (target - st.rpm) * (1 - Math.exp(-dt / tau));
    st.load += (load - st.load) * (1 - Math.exp(-dt / 0.2));
    st.s = clamp((st.rpm - p.idle) / (p.max - p.idle), 0, 1);
    const side = d < 1 ? 0 : clamp(((v.x - ear.x) * ear.rx + (v.z - ear.z) * ear.rz) / d, -1, 1) * Math.min(1, d / 8) * 0.85;
    st.voice.update(st.rpm, st.load, st.s, Math.min(1, Math.abs(v.speed || 0) / (v.vmax || 10)), att, side, d, !!v.cutting);
    if (v === active) loud = clamp(0.4 * st.s + 0.6 * st.load, 0, 1);
  }
  // the starter is heard only when the machine starts within earshot, not when it drives into it
  for (const st of states.values()) if (!st.voice) st.fresh = false;
}

/** One line about the engine of v for the developer panel. */
export function engineInfo(v) {
  const st = states.get(v);
  if (!ac) return 'Zvuk je vypnutý (tlačítko Zvuk nahoře).';
  if (!st?.voice) return 'Motor neběží' + (engineFiles.loaded < engineFiles.total ? ' · načteno ' + engineFiles.loaded + '/' + engineFiles.total : '') + '.';
  const p = st.voice.p, L = st.voice.loops;
  return 'Sada ' + p.set + ' · ' + Math.round(st.rpm) + ' ot./min · zátěž ' + Math.round(st.load * 100) + ' %' +
    (p.car ? ' · ' + (st.gear + 1) + '. rychlost' : '') + '\nSmyčky: ' + L.map(l => l.rpm + ' ' + l.g.gain.value.toFixed(2) + '×' + l.s.playbackRate.value.toFixed(2)).join(', ');
}
/** For the smoke test: the set and engine speed of every heard machine and car. */
export const engineVoices = () => [...states.entries()].filter(([, st]) => st.voice).map(([v, st]) => ({ id: v.id, model: modelOf(v), set: st.voice.p.set, rpm: Math.round(st.rpm), traffic: st.traffic }));
