// All sound is synthesized with Web Audio: original, offline, and nothing to download.
// There are no failure sounds, because nothing in this game fails.
const NOTE = { C3: 130.81, F3: 174.61, G3: 196, A3: 220, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99 };

const CHORDS = {
  C: { root: NOTE.C3, roll: [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5] },
  Am: { root: NOTE.A3 / 2, roll: [NOTE.A3, NOTE.C4, NOTE.E4, NOTE.A4] },
  F: { root: NOTE.F3, roll: [NOTE.A3, NOTE.C4, NOTE.F4, NOTE.A4] },
  G: { root: NOTE.G3, roll: [NOTE.G3, NOTE.B4 / 2, NOTE.D4, NOTE.G4] },
};

const PEARL_SCALE = [NOTE.C5, NOTE.D5, NOTE.E5, NOTE.G5, NOTE.G4 * 3, NOTE.C5 * 2];

const TRACKS = {
  menu: { bpm: 84, chords: ['C', 'Am', 'F', 'G'], melody: [NOTE.E5, 0, NOTE.G4, 0, NOTE.A4, NOTE.G4, 0, 0] },
  game: { bpm: 108, chords: ['C', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'], melody: [NOTE.G4, NOTE.C5, NOTE.E5, NOTE.D5, NOTE.C5, 0, NOTE.A4, NOTE.G4] },
};

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.track = null;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.volumes = { music: 0.7, sfx: 1 };
    this.pitch = 1;
    this.pearlStep = 0;
    this.pearlAt = 0;
  }

  // iOS only starts audio from inside a user gesture, so this runs on the first tap.
  unlock() {
    const Context = window.AudioContext ?? window.webkitAudioContext;
    if (!Context) return;
    if (!this.ctx) {
      this.ctx = new Context();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);
      this.applyVolumes();
      const length = this.ctx.sampleRate * 0.6;
      this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      this.lineOsc = this.ctx.createOscillator();
      this.lineGain = this.ctx.createGain();
      this.lineOsc.type = 'triangle';
      this.lineOsc.frequency.value = 180;
      this.lineGain.gain.value = 0;
      this.lineOsc.connect(this.lineGain).connect(this.sfxGain);
      this.lineOsc.start();
    }
    if (this.ctx.state !== 'running') this.ctx.resume();
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.musicGain.gain.value = this.volumes.music * 0.3;
    this.sfxGain.gain.value = this.volumes.sfx * 0.7;
  }

  setVolumes(music, sfx) {
    this.volumes = { music, sfx };
    this.applyVolumes();
  }

  suspend() {
    if (this.ctx?.state === 'running') this.ctx.suspend();
    clearInterval(this.timer);
    this.timer = null;
  }

  resume() {
    if (!this.ctx) return;
    this.ctx.resume();
    if (this.track && !this.timer) this.startScheduler();
  }

  setMusic(name) {
    if (this.track === (name ? TRACKS[name] : null)) return;
    this.track = name ? TRACKS[name] : null;
    this.step = 0;
    this.pitch = 1;
    clearInterval(this.timer);
    this.timer = null;
    if (this.track && this.ctx) this.startScheduler();
  }

  // Golden Glow lifts the whole tune by a whole step.
  liftKey() {
    this.pitch = 2 ** (2 / 12);
  }

  // The line hums while something is on it, and rises as it nears the surface. height is 0..1, or null for silence.
  setLine(height) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (height === null) {
      this.lineGain.gain.setTargetAtTime(0, now, 0.04);
      return;
    }
    this.lineOsc.frequency.setTargetAtTime(150 + height * 330, now, 0.05);
    this.lineGain.gain.setTargetAtTime(0.05, now, 0.04);
  }

  startScheduler() {
    this.nextTime = this.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 40);
  }

  schedule() {
    if (!this.ctx || !this.track) return;
    const track = this.track;
    const eighth = 30 / track.bpm;
    while (this.nextTime < this.ctx.currentTime + 0.18) {
      const step = this.step;
      const chord = CHORDS[track.chords[Math.floor(step / 8) % track.chords.length]];
      if (step % 4 === 0) this.bass(chord.root * this.pitch, this.nextTime, eighth * 2.6);
      this.marimba(chord.roll[[0, 2, 1, 3, 2, 1, 3, 2][step % 8]] * this.pitch, this.nextTime, 0.1);
      const melody = track.melody[step % track.melody.length];
      if (melody && Math.floor(step / 16) % 2 === 1) this.marimba(melody * this.pitch, this.nextTime, 0.17);
      this.step += 1;
      this.nextTime += eighth;
    }
  }

  marimba(freq, when, level) {
    for (const [ratio, share, decay] of [[1, 1, 0.34], [4, 0.14, 0.09]]) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq * ratio;
      gain.gain.setValueAtTime(level * share, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + decay);
      osc.connect(gain).connect(this.musicGain);
      osc.start(when);
      osc.stop(when + decay + 0.02);
    }
  }

  bass(freq, when, length) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + length);
    osc.connect(gain).connect(this.musicGain);
    osc.start(when);
    osc.stop(when + length + 0.02);
  }

  tone({ type = 'sine', from, to = from, length = 0.15, level = 0.4, delay = 0, filter = 0 }) {
    const when = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, when);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), when + length);
    gain.gain.setValueAtTime(level, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + length);
    let tail = osc;
    if (filter) {
      const lowpass = this.ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = filter;
      tail = osc.connect(lowpass);
    }
    tail.connect(gain).connect(this.sfxGain);
    osc.start(when);
    osc.stop(when + length + 0.02);
  }

  burst({ length = 0.2, level = 0.3, from = 1200, to = 300, delay = 0 }) {
    const when = this.ctx.currentTime + delay;
    const source = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    source.buffer = this.noise;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(from, when);
    filter.frequency.exponentialRampToValueAtTime(to, when + length);
    gain.gain.setValueAtTime(level, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + length);
    source.connect(filter).connect(gain).connect(this.sfxGain);
    source.start(when);
    source.stop(when + length);
  }

  play(name, value) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    SOUNDS[name]?.(this, value);
  }

  // Pearls climb a scale as they land, then start over after a pause.
  pearl() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (now - this.pearlAt > 0.6) this.pearlStep = 0;
    this.pearlAt = now;
    const from = PEARL_SCALE[Math.min(this.pearlStep++, PEARL_SCALE.length - 1)];
    this.tone({ from, length: 0.16, level: 0.2 });
  }
}

const SOUNDS = {
  ui: (a) => a.tone({ type: 'triangle', from: 620, to: 880, length: 0.08, level: 0.26 }),
  tick: (a) => a.tone({ type: 'sine', from: 900, to: 640, length: 0.05, level: 0.1 }),
  cast: (a) => a.burst({ length: 0.22, level: 0.2, from: 900, to: 2400 }),
  plop: (a) => { a.tone({ from: 620, to: 150, length: 0.2, level: 0.42 }); a.burst({ length: 0.14, level: 0.24, from: 1500, to: 500 }); },
  hop: (a) => [523, 784].forEach((from, i) => a.tone({ type: 'triangle', from, length: 0.14, level: 0.24, delay: i * 0.07 })),
  hopOn: (a, count = 2) => [392, 494, 587, 698, 784, 988].slice(0, count).forEach((from) => a.tone({ type: 'triangle', from, length: 0.3, level: 0.12 })),
  find: (a) => a.tone({ type: 'square', from: 240, to: 320, length: 0.2, level: 0.12, filter: 900 }),
  reel: (a, height = 0) => { const from = 380 + height * 700; a.tone({ type: 'square', from, to: from * 1.1, length: 0.04, level: 0.09, filter: 2400 }); },
  splash: (a) => { a.burst({ length: 0.34, level: 0.4, from: 1800, to: 500 }); a.tone({ from: 300, to: 110, length: 0.24, level: 0.24 }); },
  snap: (a) => { a.burst({ length: 0.05, level: 0.26, from: 4200, to: 3000, delay: 0.32 }); a.tone({ from: 1700, length: 0.04, level: 0.1, delay: 0.32 }); },
  bubble: (a) => [460, 700, 980].forEach((from, i) => a.tone({ from, to: from * 1.4, length: 0.09, level: 0.2, delay: i * 0.05 })),
  sticker: (a) => [784, 988, 1175, 1568].forEach((from, i) => a.tone({ type: 'triangle', from, length: 0.2, level: 0.2, delay: i * 0.08 })),
  star: (a, index = 0) => [0, 0.09].forEach((delay, i) => a.tone({ type: 'triangle', from: (660 + index * 150) * (i ? 1.5 : 1), length: 0.26, level: 0.28, delay })),
  sparkle: (a) => [1319, 1568, 1976].forEach((from, i) => a.tone({ from, length: 0.2, level: 0.14, delay: i * 0.07 })),
  hum: (a) => { a.tone({ type: 'sawtooth', from: 72, to: 58, length: 1.4, level: 0.34, filter: 340 }); a.tone({ from: 145, to: 120, length: 1.4, level: 0.16 }); },
  breach: (a) => { a.tone({ type: 'sawtooth', from: 60, to: 150, length: 0.8, level: 0.36, filter: 500 }); a.burst({ length: 0.5, level: 0.42, from: 1400, to: 300 }); },
  boom: (a) => { a.burst({ length: 0.55, level: 0.55, from: 900, to: 160 }); a.tone({ from: 140, to: 44, length: 0.5, level: 0.5 }); },
  jingle: (a) => [523, 659, 784, 1047, 784, 1047].forEach((from, i) => a.tone({ type: 'triangle', from, length: 0.22, level: 0.28, delay: i * 0.13 })),
  lullaby: (a) => [523, 440, 392, 330, 392, 262].forEach((from, i) => a.tone({ from, length: 0.6, level: 0.24, delay: i * 0.42 })),
};
