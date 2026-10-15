// Simple synthesized engine hum; starts only after the player turns sound on.
let audio = null;
export const sound = { on: false };

export function toggleSound() {
  if (!audio) {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const o1 = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
      o1.type = 'sawtooth'; o2.type = 'square'; lp.type = 'lowpass'; lp.frequency.value = 320; g.gain.value = 0;
      o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(ac.destination);
      o1.start(); o2.start();
      audio = { ac, o1, o2, g };
    } catch { return false; }
  }
  sound.on = !sound.on;
  if (audio.ac.state === 'suspended') audio.ac.resume();
  return sound.on;
}

export function updAudio(v, playing) {
  if (!audio) return;
  const t = audio.ac.currentTime, base = v.type === 'combine' ? 30 : 36;
  const f = base + Math.abs(v.speed) * 4.5 + Math.max(0, v.thr) * 9 + (v.lowered ? 6 : 0);
  audio.o1.frequency.setTargetAtTime(f, t, 0.15);
  audio.o2.frequency.setTargetAtTime(f * 0.5, t, 0.15);
  audio.g.gain.setTargetAtTime(sound.on && playing ? 0.035 + Math.max(0, v.thr) * 0.02 : 0, t, 0.2);
}
