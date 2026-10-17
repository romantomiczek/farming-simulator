import { settings } from '../core/settings.js';

/**
 * Background music: calm guitar and piano pieces by Kevin MacLeod (incompetech.com, CC BY 4.0) in
 * random order, never the same piece twice in a row, with one to three minutes of quiet between
 * them so the music does not tire. The pieces stream from an <audio> element (they are not decoded
 * into memory) and fade in and out. settings.musicStyle picks guitar, piano or both; a piece that no
 * longer fits the choice fades out.
 */
export const TRACKS = [
  { file: 'windswept.ogg', title: 'Windswept', style: 'guitar' },
  { file: 'morning.ogg', title: 'Morning', style: 'guitar' },
  { file: 'fresh-air.ogg', title: 'Fresh Air', style: 'piano' },
  { file: 'friday-morning.ogg', title: 'Friday Morning', style: 'piano' },
  { file: 'facile.ogg', title: 'Facile', style: 'piano' },
];
export const MUSIC_URL = import.meta.env.BASE_URL + 'audio/music/';
const FADE = 3; // seconds

let ac = null, el = null, g = null;
let state = 'rest', wait = 6, cur = null, last = null; // state: rest (quiet between pieces), play, fade
const fits = tr => settings.musicStyle === 'both' || tr.style === settings.musicStyle;

export function initMusic(ctx, dest) {
  ac = ctx;
  el = new Audio(); el.preload = 'auto';
  g = ac.createGain(); g.gain.value = 0;
  ac.createMediaElementSource(el).connect(g); g.connect(dest);
  el.addEventListener('ended', () => rest());
  el.addEventListener('error', () => { if (state === 'play') { console.warn('Hudba se nenačetla: ' + cur?.file); rest(20); } });
}

function rest(sec = 60 + Math.random() * 120) { state = 'rest'; wait = sec; cur = null; }
function start() {
  const pool = TRACKS.filter(fits), fresh = pool.filter(x => x !== last), list = fresh.length ? fresh : pool;
  cur = last = list[Math.floor(Math.random() * list.length)];
  state = 'play';
  el.src = MUSIC_URL + cur.file;
  const t = ac.currentTime;
  g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0, t); g.gain.setTargetAtTime(1, t + 0.1, FADE / 3);
  el.play().catch(() => rest(15)); // the browser may refuse before the first click: try again later
}

/** Per frame. on = sound on, music volume above zero and the page visible. */
export function updMusic(dt, on) {
  if (!el) return;
  if (!on) { if (!el.paused) el.pause(); return; }
  const t = ac.currentTime;
  if (state === 'play') {
    if (el.paused && !el.ended) el.play().catch(() => {}); // carries on after the music was off
    if (!fits(cur)) { state = 'fade'; wait = 2; g.gain.setTargetAtTime(0, t, 0.5); }
    else if ((el.duration || Infinity) - el.currentTime < FADE) g.gain.setTargetAtTime(0, t, FADE / 3);
  } else if (state === 'fade') {
    if ((wait -= dt) <= 0) { el.pause(); rest(3); }
  } else if ((wait -= dt) <= 0) start();
}

/** The piece playing now, or null. */
export const nowPlaying = () => (state === 'play' ? cur : null);
/** For the smoke test: rest / play / fade, seconds until the next piece, position in the piece. */
export const musicState = () => ({ state, wait, time: el ? el.currentTime : 0 });
