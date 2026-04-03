import { assets } from './assets.js';

export let audioCtx = null;
export let masterGain = null;

// Позиция слушателя (камера/танк игрока)
let listenerX = 0;
let listenerY = 0;

export function setListener(x, y) {
  listenerX = x;
  listenerY = y;
}

/** Вычисляет pan (-1 лево, +1 право) от позиции звука к слушателю */
export function calcPan(sx, sy) {
  const dx = sx - listenerX;
  return Math.max(-1, Math.min(1, dx / 960));
}

/** Вычисляет громкость (0–1) по расстоянию от камеры до источника звука */
export function calcVol(sx, sy, maxDist) {
  const dist = Math.hypot(sx - listenerX, sy - listenerY);
  return Math.max(0, 1 - dist / maxDist);
}

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

function getMasterVolume() {
  const slider = document.getElementById('volumeSlider');
  return slider ? Number(slider.value) / 100 : 1;
}

/** Воспроизводит UI-звук (без панорамы, просто громкость). */
export function playUISound(audioEl, vol = 0.5) {
  const clone = audioEl.cloneNode(true);
  clone.volume = Math.max(0, Math.min(1, vol * getMasterVolume()));
  clone.play().catch(() => { });
}

/**
 * Воспроизводит HTML Audio через Web Audio API с панорамой и громкостью.
 * Если audioCtx недоступен — фоллбэк на обычный .play().
 */
function playSample(audioEl, vol, pan) {
  if (!audioCtx || !masterGain) {
    audioEl.volume = Math.max(0, Math.min(1, vol * getMasterVolume()));
    audioEl.play().catch(() => { });
    return;
  }
  const source = audioCtx.createMediaElementSource(audioEl);
  const panner = audioCtx.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan));
  const gain = audioCtx.createGain();
  gain.gain.value = Math.max(0, Math.min(1, vol));
  source.connect(panner);
  panner.connect(gain);
  gain.connect(masterGain);
  audioEl.play().catch(() => { });
  audioEl.addEventListener('ended', () => {
    source.disconnect(); panner.disconnect(); gain.disconnect();
  }, { once: true });
}

export function playSound_Shot(vol = 1, pan = 0) {
  const s = assets.sounds.shoot.cloneNode(true);
  playSample(s, vol, pan);
}

export function playSound_ShotHeavy(vol = 1, pan = 0) {
  const s = assets.sounds.shootHeavy.cloneNode(true);
  playSample(s, vol, pan);
}

export function playSound_Hit(vol = 1, pan = 0) {
  const s = assets.sounds.hit.cloneNode(true);
  playSample(s, vol, pan);
}

export function playSound_Explosion(vol = 1, pan = 0) {
  const s = assets.sounds.explosion.cloneNode(true);
  playSample(s, vol, pan);
}

const brickHitVariants = ['brickHit1', 'brickHit2', 'brickHit3'];
export function playSound_BrickHit(vol = 1, pan = 0) {
  const key = brickHitVariants[Math.floor(Math.random() * 3)];
  const s = assets.sounds[key].cloneNode(true);
  s.playbackRate = 0.9 + Math.random() * 0.5; // pitch 0.9–1.4
  playSample(s, vol * 0.35, pan);
}

export function playSound_StoneHit(vol = 1, pan = 0) {
  const s = assets.sounds.brickHit1.cloneNode(true);
  s.playbackRate = 0.9 + Math.random() * 0.5;
  playSample(s, vol * 0.35, pan);
}

export function playSound_Heal(vol = 1, pan = 0) {
  const s = assets.sounds.repair.cloneNode(true);
  playSample(s, vol, pan);
}

export function playSound_Speed() {
  for (let i = 0; i < 5; i++) setTimeout(() => tone(300 + i * 100, 0.04, 'square', 0.08), i * 20);
}

export function playSound_PickBonus(vol = 1) {
  const s = assets.sounds.pickBonus1.cloneNode(true);
  playSample(s, vol, 0);
}

export function playSound_Damage() {
  tone(300, 0.05, 'triangle', 0.15);
  setTimeout(() => tone(150, 0.1, 'sawtooth', 0.2), 50);
}

export function playSound_Smoke() {
  noise(0.5, 100, 1, 0.2, 'lowpass', 0.2);
  tone(100, 0.3, 'sine', 0.1);
}

export function playBombBeep(vol = 1, pan = 0) {
  const v = 0.15 * Math.max(0, Math.min(1, vol));
  for (let i = 0; i < 5; i++) tone(1500, 0.05, 'square', v, null, i * 0.1, pan);
}

export function playAlert() {
  tone(880, 0.2, 'sawtooth', 0.15);
  tone(880, 0.2, 'sawtooth', 0.1, null, 0.25);
}

export function playRocketFlyBy(pan = 0) {
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
  const panner = audioCtx.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan));
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.001, audioCtx.currentTime);
  g.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 2);
  src.connect(flt);
  flt.connect(panner);
  panner.connect(g);
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

export function noise(d, f, q, v, t, dec, pan = 0) {
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
  const panner = audioCtx.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan));
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(v, audioCtx.currentTime);
  g.gain.setTargetAtTime(0.001, audioCtx.currentTime, dec);
  src.connect(flt);
  flt.connect(panner);
  panner.connect(g);
  g.connect(masterGain);
  src.start();
  src.stop(audioCtx.currentTime + d);
}

export function tone(f, d, ty, v, s = null, delay = 0, pan = 0) {
  if (!audioCtx || !masterGain) return;
  const o = audioCtx.createOscillator();
  const panner = audioCtx.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan));
  const g = audioCtx.createGain();
  o.type = ty;
  o.frequency.setValueAtTime(f, audioCtx.currentTime + delay);
  if (s) o.frequency.setTargetAtTime(s, audioCtx.currentTime + delay, d * 0.4);
  g.gain.setValueAtTime(v, audioCtx.currentTime + delay);
  g.gain.setTargetAtTime(0.001, audioCtx.currentTime + delay, d * 0.5);
  o.connect(panner);
  panner.connect(g);
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
    master.gain.value = 0;
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = 0;
    master.connect(panner);
    panner.connect(masterGain);
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
    this.nodes = { master, panner, oscs, trackFlt, trackGain, lfo };
  }

  update(dt, speedRatio, distFactor, pan) {
    if (!this.nodes) return;
    // Громкость по расстоянию (0..0.2), пан лево-право
    const tv = 0.24 * distFactor;
    this.nodes.master.gain.setTargetAtTime(tv, this.ctx.currentTime, 0.1);
    if (typeof pan === 'number') {
      this.nodes.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), this.ctx.currentTime, 0.05);
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
