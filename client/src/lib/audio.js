import { assets } from './assets.js';

export let audioCtx = null;
export let masterGain = null;

export function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  if (!masterGain) {
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    updateVolume();
  }
}

export function updateVolume() {
  if (!masterGain || !audioCtx) return;
  const slider = document.getElementById('volumeSlider');
  const v = slider ? Number(slider.value) / 100 : 1;
  masterGain.gain.setValueAtTime(v, audioCtx.currentTime);
}

export function playSound_Shot(vol = 1) {
  const s = assets.sounds.shoot.cloneNode(true);
  s.volume = vol;
  s.play().catch(() => { });
}

export function playSound_Hit(vol = 1) {
  const s = assets.sounds.hit.cloneNode(true);
  s.volume = Math.max(0, Math.min(1, vol));
  s.play().catch(() => { });
}

export function playSound_Explosion(vol = 1) {
  const s = assets.sounds.explosion.cloneNode(true);
  s.volume = Math.max(0, Math.min(1, vol));
  s.play().catch(() => { });
}

export function playSound_BrickHit(vol = 1) {
  const s = assets.sounds.brickHit.cloneNode(true);
  s.volume = vol;
  s.play().catch(() => { });
}

export function playSound_Heal() {
  for (let i = 0; i < 3; i++) setTimeout(() => tone(500 + i * 150, 0.06, 'sine', 0.1), i * 40);
}

export function playSound_Speed() {
  for (let i = 0; i < 5; i++) setTimeout(() => tone(300 + i * 100, 0.04, 'square', 0.08), i * 20);
}

export function playSound_Damage() {
  tone(300, 0.05, 'triangle', 0.15);
  setTimeout(() => tone(150, 0.1, 'sawtooth', 0.2), 50);
}

export function playSound_Smoke() {
  noise(0.5, 100, 1, 0.2, 'lowpass', 0.2);
  tone(100, 0.3, 'sine', 0.1);
}

export function playBombBeep(vol = 1) {
  const v = 0.15 * Math.max(0, Math.min(1, vol));
  for (let i = 0; i < 5; i++) tone(1500, 0.05, 'square', v, null, i * 0.1);
}

export function playAlert() {
  tone(880, 0.2, 'sawtooth', 0.15);
  tone(880, 0.2, 'sawtooth', 0.1, null, 0.25);
}

export function playRocketFlyBy() {
  if (!audioCtx || !masterGain) return;
  const len = audioCtx.sampleRate * 2;
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const flt = audioCtx.createBiquadFilter();
  flt.type = 'bandpass';
  flt.frequency.value = 1200;
  flt.Q.value = 2;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.001, audioCtx.currentTime);
  g.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 1);
  g.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 2);
  src.connect(flt);
  flt.connect(g);
  g.connect(masterGain);
  src.start();
  src.stop(audioCtx.currentTime + 2);
}

export function playSound_Victory() {
  const m = [
    { f: 523, t: 0 },
    { f: 523, t: 100 },
    { f: 659, t: 200 },
    { f: 784, t: 350 },
    { f: 659, t: 500 },
    { f: 784, t: 650 },
    { f: 1047, t: 800 },
  ];
  m.forEach((n) =>
    setTimeout(() => {
      tone(n.f, 0.4, 'square', 0.1);
      tone(n.f * 0.5, 0.4, 'triangle', 0.08);
    }, n.t),
  );
}

export function playSound_StartMusic() {
  const n = [
    { f: 262, d: 0.12 },
    { f: 330, d: 0.12 },
    { f: 392, d: 0.12 },
    { f: 523, d: 0.25 },
    { f: 392, d: 0.12 },
    { f: 523, d: 0.35 },
  ];
  let t = 0;
  n.forEach((x) => {
    setTimeout(() => {
      tone(x.f, x.d, 'square', 0.12);
      tone(x.f * 0.5, x.d, 'triangle', 0.08);
    }, t);
    t += x.d * 1000;
  });
}

export function noise(d, f, q, v, t, dec) {
  if (!audioCtx || !masterGain) return;
  const len = audioCtx.sampleRate * d;
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  const flt = audioCtx.createBiquadFilter();
  flt.type = t;
  flt.frequency.value = f;
  flt.Q.value = q;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(v, audioCtx.currentTime);
  g.gain.setTargetAtTime(0.001, audioCtx.currentTime, dec);
  src.connect(flt);
  flt.connect(g);
  g.connect(masterGain);
  src.start();
  src.stop(audioCtx.currentTime + d);
}

export function tone(f, d, ty, v, s = null, delay = 0) {
  if (!audioCtx || !masterGain) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = ty;
  o.frequency.setValueAtTime(f, audioCtx.currentTime + delay);
  if (s) o.frequency.setTargetAtTime(s, audioCtx.currentTime + delay, d * 0.4);
  g.gain.setValueAtTime(v, audioCtx.currentTime + delay);
  g.gain.setTargetAtTime(0.001, audioCtx.currentTime + delay, d * 0.5);
  o.connect(g);
  g.connect(masterGain);
  o.start(audioCtx.currentTime + delay);
  o.stop(audioCtx.currentTime + delay + d);
}

export class TankEngine {
  constructor(ctx, isEnemy) {
    this.ctx = ctx;
    this.isEnemy = isEnemy;
    this.rpm = 600;
    this.targetRPM = 600;
    this.variant = {
      baseFreq: 32,
      harmonics: [1, 0.7, 0.5, 0.3, 0.15, 0.08],
      trackNoise: 0.18,
      rpmMin: 600,
      rpmMax: 2200,
    };
    this.nodes = null;
  }

  start() {
    const master = this.ctx.createGain();
    master.gain.value = this.isEnemy ? 0 : 0.2;
    master.connect(masterGain);
    const oscs = [];
    this.variant.harmonics.forEach((amp, i) => {
      const h = i + 1;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const flt = this.ctx.createBiquadFilter();
      osc.type = h === 1 ? 'sawtooth' : 'triangle';
      osc.frequency.value = this.variant.baseFreq * h;
      flt.type = 'lowpass';
      flt.frequency.value = 200 + h * 50;
      gain.gain.value = amp * 0.12;
      osc.connect(flt);
      flt.connect(gain);
      gain.connect(master);
      osc.start();
      oscs.push({ osc, gain, filter: flt, baseFreq: this.variant.baseFreq * h, baseAmp: amp });
    });
    const bufSize = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const nd = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) nd[i] = Math.random() * 2 - 1;
    const trackSrc = this.ctx.createBufferSource();
    trackSrc.buffer = buf;
    trackSrc.loop = true;
    const trackFlt = this.ctx.createBiquadFilter();
    trackFlt.type = 'bandpass';
    trackFlt.frequency.value = 100;
    trackFlt.Q.value = 2;
    const trackGain = this.ctx.createGain();
    trackGain.gain.value = this.variant.trackNoise * 0.2;
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 6;
    lfoGain.gain.value = 20;
    lfo.connect(lfoGain);
    lfoGain.connect(trackFlt.frequency);
    lfo.start();
    trackSrc.connect(trackFlt);
    trackFlt.connect(trackGain);
    trackGain.connect(master);
    trackSrc.start();
    this.nodes = { master, oscs, trackFlt, trackGain, lfo };
  }

  update(dt, speedRatio, distFactor) {
    if (!this.nodes) return;
    if (this.isEnemy) {
      const tv = 0.2 * distFactor;
      this.nodes.master.gain.setTargetAtTime(tv, this.ctx.currentTime, 0.1);
    }
    this.targetRPM = this.variant.rpmMin + (this.variant.rpmMax - this.variant.rpmMin) * speedRatio;
    const step = (this.variant.rpmMax - this.variant.rpmMin) * dt * 2;
    if (this.rpm < this.targetRPM) this.rpm = Math.min(this.rpm + step, this.targetRPM);
    else this.rpm = Math.max(this.rpm - step * 0.8, this.targetRPM);
    const norm = (this.rpm - this.variant.rpmMin) / (this.variant.rpmMax - this.variant.rpmMin);
    const factor = 0.8 + norm * 0.25;
    this.nodes.oscs.forEach((o, i) => {
      o.osc.frequency.setTargetAtTime(o.baseFreq * factor, this.ctx.currentTime, 0.02);
      o.gain.gain.setTargetAtTime(o.baseAmp * 0.12 * (0.6 + norm * 0.4), this.ctx.currentTime, 0.02);
      o.filter.frequency.setTargetAtTime(200 + (i + 1) * 50 + norm * 150, this.ctx.currentTime, 0.05);
    });
    this.nodes.trackFlt.frequency.setTargetAtTime(100 + norm * 120, this.ctx.currentTime, 0.05);
    this.nodes.trackGain.gain.setTargetAtTime(this.variant.trackNoise * 0.2 * (0.5 + norm * 0.5), this.ctx.currentTime, 0.02);
    this.nodes.lfo.frequency.setTargetAtTime(6 + norm * 8, this.ctx.currentTime, 0.05);
  }
}
