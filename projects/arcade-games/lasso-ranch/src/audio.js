// All sound is synthesized with Web Audio: original, offline, and nothing to download.
const NOTE = { C3: 130.81, D3: 146.83, E3: 164.81, G2: 98, A2: 110, B2: 123.47, C2: 65.41, D2: 73.42, G3: 196, A3: 220, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, Fs4: 369.99, G4: 392, A4: 440, B4: 493.88, D5: 587.33, E5: 659.25 };

const CHORDS = {
  G: { root: NOTE.G2, fifth: NOTE.D3, roll: [NOTE.G3, NOTE.B3, NOTE.D4, NOTE.G4] },
  C: { root: NOTE.C3, fifth: NOTE.G2, roll: [NOTE.G3, NOTE.C4, NOTE.E4, NOTE.G4] },
  D: { root: NOTE.D3, fifth: NOTE.A2, roll: [NOTE.A3, NOTE.D4, NOTE.Fs4, NOTE.A4] },
  E: { root: NOTE.E3, fifth: NOTE.B2, roll: [NOTE.G3, NOTE.B3, NOTE.E4, NOTE.G4] },
};

const TRACKS = {
  menu: { bpm: 96, chords: ['G', 'C', 'G', 'D'], melody: [NOTE.B4, 0, NOTE.D5, 0, NOTE.B4, NOTE.A4, NOTE.G4, 0] },
  game: { bpm: 132, chords: ['G', 'G', 'C', 'G', 'D', 'C', 'G', 'D'], melody: [NOTE.G4, NOTE.B4, NOTE.D5, NOTE.B4, NOTE.E5, NOTE.D5, NOTE.B4, 0] },
  bonus: { bpm: 176, chords: ['G', 'C', 'D', 'G'], melody: [NOTE.D5, NOTE.E5, NOTE.D5, NOTE.B4, NOTE.G4, NOTE.B4, NOTE.D5, NOTE.E5] },
};

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.track = null;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.volumes = { music: 0.8, sfx: 1 };
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
      const length = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state !== 'running') this.ctx.resume();
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.musicGain.gain.value = this.volumes.music * 0.32;
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
    clearInterval(this.timer);
    this.timer = null;
    if (this.track && this.ctx) this.startScheduler();
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
      if (step % 4 === 0) this.bass(chord.root, this.nextTime, eighth * 1.8);
      if (step % 4 === 2) this.bass(chord.fifth, this.nextTime, eighth * 1.6);
      this.pluck(chord.roll[[0, 2, 1, 3, 2, 1, 3, 2][step % 8]], this.nextTime, 0.09);
      const melody = track.melody[step % track.melody.length];
      if (melody && Math.floor(step / 16) % 2 === 1) this.pluck(melody, this.nextTime, 0.16);
      this.step += 1;
      this.nextTime += eighth;
    }
  }

  pluck(freq, when, level) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, when);
    filter.frequency.exponentialRampToValueAtTime(700, when + 0.16);
    gain.gain.setValueAtTime(level, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.24);
    osc.connect(filter).connect(gain).connect(this.musicGain);
    osc.start(when);
    osc.stop(when + 0.26);
  }

  bass(freq, when, length) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.36, when);
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
}

const SOUNDS = {
  ui: (a) => a.tone({ type: 'triangle', from: 620, to: 880, length: 0.08, level: 0.3 }),
  throw: (a) => { a.burst({ length: 0.32, level: 0.4, from: 700, to: 2600 }); a.tone({ type: 'triangle', from: 280, to: 760, length: 0.26, level: 0.14 }); },
  blocked: (a) => a.tone({ type: 'square', from: 170, to: 150, length: 0.05, level: 0.09 }),
  miss: (a) => a.tone({ type: 'triangle', from: 420, to: 140, length: 0.34, level: 0.3 }),
  yank: (a) => { a.burst({ length: 0.1, level: 0.42, from: 2400, to: 600 }); a.tone({ type: 'square', from: 300, to: 620, length: 0.1, level: 0.13 }); },
  point: (a, points = 2) => {
    const base = 660 + Math.min(points, 50) * 14;
    a.tone({ type: 'triangle', from: base, length: 0.09, level: 0.26 });
    a.tone({ type: 'triangle', from: base * 1.5, length: 0.16, level: 0.26, delay: 0.08 });
  },
  moo: (a) => a.tone({ type: 'sawtooth', from: 210, to: 120, length: 0.6, level: 0.3, filter: 620 }),
  calf: (a) => a.tone({ type: 'sawtooth', from: 360, to: 250, length: 0.3, level: 0.26, filter: 900 }),
  bellow: (a) => { a.tone({ type: 'sawtooth', from: 120, to: 70, length: 0.7, level: 0.42, filter: 420 }); a.burst({ length: 0.2, level: 0.2, from: 500, to: 200 }); },
  snort: (a) => { a.burst({ length: 0.16, level: 0.4, from: 900, to: 300 }); a.burst({ length: 0.16, level: 0.34, from: 900, to: 300, delay: 0.18 }); },
  combo: (a) => [523, 659, 784].forEach((from, i) => a.tone({ type: 'square', from, length: 0.08, level: 0.13, delay: i * 0.06 })),
  star: (a, index = 0) => [0, 0.09].forEach((delay, i) => a.tone({ type: 'triangle', from: (660 + index * 150) * (i ? 1.5 : 1), length: 0.26, level: 0.3, delay })),
  fail: (a) => [392, 349, 311, 262].forEach((from, i) => a.tone({ type: 'triangle', from, length: 0.26, level: 0.3, delay: i * 0.19 })),
  stink: (a) => { a.burst({ length: 0.5, level: 0.42, from: 260, to: 90 }); a.tone({ type: 'square', from: 110, to: 60, length: 0.5, level: 0.14 }); },
  jam: (a) => { a.tone({ type: 'square', from: 900, to: 180, length: 0.2, level: 0.18 }); a.burst({ length: 0.14, level: 0.28, from: 2800, to: 1200 }); },
  fanfare: (a) => [392, 494, 587, 784, 988].forEach((from, i) => a.tone({ type: 'square', from, length: 0.16, level: 0.14, delay: i * 0.09 })),
  jingle: (a) => [523, 659, 784, 1047, 784, 1047].forEach((from, i) => a.tone({ type: 'triangle', from, length: 0.22, level: 0.3, delay: i * 0.13 })),
  sparkle: (a) => [1319, 1568, 1976].forEach((from, i) => a.tone({ type: 'sine', from, length: 0.2, level: 0.16, delay: i * 0.07 })),
};
