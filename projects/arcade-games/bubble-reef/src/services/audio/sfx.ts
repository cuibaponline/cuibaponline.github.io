// Every effect is rendered once into an AudioBuffer. The palette stays soft on purpose:
// sine bubbles, mallets and bells, with no raw square or saw anywhere.

import type { SfxName } from './types';
import { impulse, mulberry32, playNote, puff, sweep, type Inst } from './synth';
import { midi } from './score';
import { breathe, offlineContext, renderOffline } from './offline';

export const SFX_SAMPLE_RATE = 32000;

interface Stage {
  ctx: BaseAudioContext;
  /** Direct path. */
  dry: AudioNode;
  /** Same sound with a small room behind it. */
  room: AudioNode;
  rnd: () => number;
}

interface Spec {
  seconds: number;
  peak: number;
  variants?: number;
  build: (s: Stage) => void;
}

const strike = (s: Stage, inst: Inst, t: number, name: string, vel: number, dur = 0.4) =>
  playNote(s.ctx, s.room, inst, t, midi(name), vel, dur);

function bubbles(s: Stage, count: number, from: number, span: number, amp: number, low = 320, high = 1100): void {
  for (let i = 0; i < count; i++) {
    const t = from + s.rnd() * span;
    const f = low + s.rnd() * (high - low);
    sweep(s.ctx, s.dry, t, f, f * (1.5 + s.rnd()), 0.05, amp * (0.5 + s.rnd() * 0.5), 0.09);
  }
}

const SPECS: Record<SfxName, Spec> = {
  fire: {
    seconds: 0.24,
    peak: 0.46,
    variants: 2,
    build(s) {
      const j = 1 + (s.rnd() - 0.5) * 0.08;
      sweep(s.ctx, s.dry, 0, 290 * j, 760 * j, 0.1, 0.85, 0.17);
      sweep(s.ctx, s.dry, 0.006, 580 * j, 1450 * j, 0.08, 0.13, 0.1);
      puff(s.ctx, s.dry, 0, 'bandpass', 1500, 900, 0.8, 0.14, 0.05);
    },
  },
  netPop: {
    seconds: 0.3,
    peak: 0.5,
    variants: 3,
    build(s) {
      const j = 1 + (s.rnd() - 0.5) * 0.14;
      sweep(s.ctx, s.dry, 0, 980 * j, 330 * j, 0.055, 0.8, 0.13, 0.002);
      puff(s.ctx, s.dry, 0, 'bandpass', 2000, 1100, 0.9, 0.22, 0.04, 0.001);
      playNote(s.ctx, s.room, 'kalimba', 0.018, midi('g6'), 0.1, 0.1);
    },
  },
  hit: {
    seconds: 0.14,
    peak: 0.34,
    variants: 3,
    build(s) {
      const j = 1 + (s.rnd() - 0.5) * 0.16;
      playNote(s.ctx, s.dry, 'wood', 0, 74 + (j - 1) * 20, 0.9, 0.1);
      sweep(s.ctx, s.dry, 0, 470 * j, 300 * j, 0.03, 0.5, 0.07, 0.0015);
    },
  },
  catchSmall: {
    seconds: 0.75,
    peak: 0.5,
    build(s) {
      strike(s, 'marimba', 0, 'g5', 0.8);
      strike(s, 'kalimba', 0.075, 'c6', 0.8);
    },
  },
  catchMedium: {
    seconds: 1,
    peak: 0.56,
    build(s) {
      strike(s, 'kalimba', 0, 'c5', 0.75);
      strike(s, 'kalimba', 0.075, 'e5', 0.8);
      strike(s, 'kalimba', 0.15, 'g5', 0.85);
      strike(s, 'bell', 0.15, 'c6', 0.2);
      bubbles(s, 3, 0.05, 0.3, 0.14);
    },
  },
  catchLarge: {
    seconds: 1.5,
    peak: 0.62,
    build(s) {
      playNote(s.ctx, s.dry, 'conga', 0, midi('c3'), 0.45, 0.2);
      ['c5', 'e5', 'g5', 'c6'].forEach((n, i) => strike(s, 'marimba', i * 0.07, n, 0.7 + i * 0.05));
      strike(s, 'bell', 0.28, 'e6', 0.3);
      strike(s, 'bell', 0.34, 'g6', 0.2);
      bubbles(s, 7, 0.1, 0.65, 0.16, 400, 1300);
    },
  },
  catchBoss: {
    seconds: 2.8,
    peak: 0.72,
    build(s) {
      const beat = 0.15;
      [
        [0, 'g4'],
        [1, 'c5'],
        [2, 'e5'],
        [3, 'g5'],
        [5, 'e5'],
        [6, 'g5'],
      ].forEach(([b, n]) => {
        strike(s, 'marimba', Number(b) * beat, String(n), 0.75);
        strike(s, 'kalimba', Number(b) * beat, String(n), 0.32);
      });
      playNote(s.ctx, s.dry, 'conga', 0, midi('g2'), 0.5, 0.2);
      playNote(s.ctx, s.dry, 'conga', 3 * beat, midi('g2'), 0.4, 0.2);
      const peak = 7 * beat;
      playNote(s.ctx, s.dry, 'conga', peak, midi('c2'), 0.7, 0.3);
      ['c5', 'e5', 'g5', 'c6', 'e6'].forEach((n, i) => {
        strike(s, 'marimba', peak + i * 0.018, n, 0.72);
        strike(s, 'bell', peak + 0.05 + i * 0.05, n, 0.26);
      });
      playNote(s.ctx, s.room, 'pad', peak, midi('c4'), 0.1, 1.1);
      playNote(s.ctx, s.room, 'pad', peak, midi('g4'), 0.08, 1.1);
      ['c6', 'd6', 'e6', 'g6', 'a6', 'c7'].forEach((n, i) => strike(s, 'glass', peak + 0.32 + i * 0.09, n, 0.17));
      bubbles(s, 12, peak, 1.2, 0.13, 400, 1400);
    },
  },
  coin: {
    seconds: 0.5,
    peak: 0.4,
    build(s) {
      strike(s, 'kalimba', 0, 'e6', 0.72);
      strike(s, 'bell', 0.004, 'e6', 0.26);
    },
  },
  specialAppear: {
    seconds: 1.9,
    peak: 0.52,
    build(s) {
      ['c5', 'd5', 'e5', 'g5', 'a5', 'c6', 'd6', 'e6'].forEach((n, i) =>
        strike(s, 'glass', i * 0.055, n, 0.32 + i * 0.03),
      );
      strike(s, 'bell', 0.44, 'g6', 0.26);
      strike(s, 'bell', 0.5, 'c7', 0.16);
      playNote(s.ctx, s.room, 'pad', 0.1, midi('c4'), 0.1, 0.6);
    },
  },
  burst: {
    seconds: 1.5,
    peak: 0.68,
    build(s) {
      sweep(s.ctx, s.dry, 0, 170, 52, 0.26, 0.95, 0.65, 0.006);
      puff(s.ctx, s.dry, 0, 'lowpass', 1500, 180, 0.6, 0.34, 0.7, 0.008);
      bubbles(s, 18, 0.03, 0.85, 0.2, 260, 1200);
      strike(s, 'marimba', 0.02, 'c4', 0.4);
    },
  },
  freeze: {
    seconds: 2.2,
    peak: 0.58,
    build(s) {
      puff(s.ctx, s.room, 0, 'bandpass', 5200, 1500, 1.4, 0.09, 1.1, 0.12);
      ['b6', 'f#6', 'e6', 'b5', 'f#5'].forEach((n, i) => strike(s, 'glass', 0.02 + i * 0.1, n, 0.42 - i * 0.03));
      strike(s, 'bell', 0.42, 'e5', 0.28);
      playNote(s.ctx, s.room, 'pad', 0.05, midi('b3'), 0.06, 0.8);
      playNote(s.ctx, s.room, 'pad', 0.05, midi('f#4'), 0.05, 0.8);
    },
  },
  spark: {
    seconds: 0.85,
    peak: 0.4,
    variants: 2,
    build(s) {
      for (let i = 0; i < 9; i++) {
        const t = s.rnd() * 0.32;
        const f = 1900 + s.rnd() * 2200;
        sweep(s.ctx, s.room, t, f, f * 0.72, 0.012, 0.12 + s.rnd() * 0.16, 0.05, 0.001);
      }
      sweep(s.ctx, s.room, 0, 900, 2400, 0.12, 0.34, 0.26);
      strike(s, 'glass', 0.05, 'e6', 0.3);
    },
  },
  levelUp: {
    seconds: 2,
    peak: 0.68,
    build(s) {
      ['g4', 'c5', 'e5', 'g5', 'c6'].forEach((n, i) => {
        strike(s, 'marimba', i * 0.08, n, 0.72);
        strike(s, 'kalimba', i * 0.08, n, 0.26);
      });
      ['c5', 'e5', 'g5', 'c6', 'e6'].forEach((n, i) => {
        strike(s, 'kalimba', 0.46 + i * 0.016, n, 0.5);
        strike(s, 'bell', 0.5 + i * 0.04, n, 0.24);
      });
      ['g6', 'a6', 'c7'].forEach((n, i) => strike(s, 'glass', 0.82 + i * 0.09, n, 0.18));
      playNote(s.ctx, s.dry, 'conga', 0.46, midi('c3'), 0.4, 0.2);
    },
  },
  buttonTap: {
    seconds: 0.14,
    peak: 0.42,
    build(s) {
      sweep(s.ctx, s.dry, 0, 880, 620, 0.03, 0.8, 0.075, 0.0015);
      sweep(s.ctx, s.dry, 0, 1760, 1240, 0.02, 0.1, 0.03, 0.001);
    },
  },
  warningChime: {
    seconds: 1.9,
    peak: 0.52,
    build(s) {
      strike(s, 'bell', 0, 'g5', 0.62);
      strike(s, 'bell', 0.3, 'e5', 0.62);
      playNote(s.ctx, s.room, 'pad', 0, midi('c4'), 0.05, 0.5);
    },
  },
  wrongPin: {
    seconds: 0.95,
    peak: 0.46,
    build(s) {
      // A falling minor third: the "uh-oh" of a playground call, not an alarm.
      const low = s.ctx.createBiquadFilter();
      low.type = 'lowpass';
      low.frequency.value = 620;
      low.connect(s.dry);
      playNote(s.ctx, low, 'pizz', 0, midi('g3'), 0.7, 0.1);
      playNote(s.ctx, low, 'pizz', 0.16, midi('e3'), 0.8, 0.1);
    },
  },
  paradeSting: {
    seconds: 3.2,
    peak: 0.72,
    build(s) {
      const beat = 0.16;
      [
        [0, 'g4'],
        [1, 'c5'],
        [2, 'e5'],
        [3, 'g5'],
        [4.5, 'e5'],
        [5, 'g5'],
        [6, 'a5'],
        [7, 'g5'],
        [8, 'c6'],
      ].forEach(([b, n]) => {
        strike(s, 'kalimba', Number(b) * beat, String(n), 0.72);
        strike(s, 'marimba', Number(b) * beat, String(n), 0.3);
      });
      for (let b = 0; b < 16; b++) {
        playNote(s.ctx, s.dry, 'shaker', b * beat * 0.5, 60, b % 2 ? 0.03 : 0.05, 0.05);
      }
      [0, 3, 6, 8].forEach((b) => playNote(s.ctx, s.dry, 'conga', b * beat, midi('c3'), 0.42, 0.2));
      const peak = 8 * beat;
      ['c4', 'g4', 'c5', 'e5', 'g5', 'c6', 'e6'].forEach((n, i) => strike(s, 'marimba', peak + i * 0.02, n, 0.5));
      playNote(s.ctx, s.room, 'pad', peak, midi('c4'), 0.09, 1.1);
      playNote(s.ctx, s.room, 'pad', peak, midi('e4'), 0.08, 1.1);
      playNote(s.ctx, s.room, 'pad', peak, midi('g4'), 0.08, 1.1);
      ['c6', 'e6', 'g6', 'a6', 'c7', 'e7'].forEach((n, i) => strike(s, 'glass', peak + 0.2 + i * 0.1, n, 0.2));
      bubbles(s, 10, peak, 1.2, 0.12, 400, 1400);
    },
  },
  bubblePop: {
    seconds: 0.14,
    peak: 0.42,
    variants: 3,
    build(s) {
      const f = 430 + s.rnd() * 240;
      sweep(s.ctx, s.dry, 0, f, f * 3, 0.035, 0.85, 0.07, 0.002);
    },
  },
  waveComplete: {
    seconds: 1.7,
    peak: 0.62,
    build(s) {
      [
        [0, 'e5'],
        [0.11, 'g5'],
        [0.22, 'a5'],
        [0.33, 'c6'],
      ].forEach(([t, n]) => strike(s, 'kalimba', Number(t), String(n), 0.75));
      ['c5', 'g5', 'c6', 'e6'].forEach((n, i) => {
        strike(s, 'marimba', 0.33 + i * 0.015, n, 0.42);
        strike(s, 'bell', 0.37 + i * 0.05, n, 0.2);
      });
      bubbles(s, 5, 0.3, 0.6, 0.12);
    },
  },
  unlock: {
    seconds: 2.4,
    peak: 0.62,
    build(s) {
      ['c6', 'e6', 'g6'].forEach((n, i) => strike(s, 'glass', i * 0.1, n, 0.42));
      ['g5', 'c6', 'e6', 'g6', 'c7'].forEach((n, i) => strike(s, 'bell', 0.32 + i * 0.03, n, 0.3));
      playNote(s.ctx, s.room, 'pad', 0.3, midi('c4'), 0.1, 0.9);
      playNote(s.ctx, s.room, 'pad', 0.3, midi('g4'), 0.08, 0.9);
      ['c7', 'd7', 'e7'].forEach((n, i) => strike(s, 'glass', 0.7 + i * 0.09, n, 0.12));
    },
  },
};

async function renderVariant(name: SfxName, spec: Spec, variant: number): Promise<AudioBuffer> {
  const sr = SFX_SAMPLE_RATE;
  const frames = Math.ceil(spec.seconds * sr);
  const ctx = offlineContext(1, frames, sr);

  const verb = ctx.createConvolver();
  verb.normalize = true;
  verb.buffer = impulse(ctx, 0.7, 4600);
  const wet = ctx.createGain();
  wet.gain.value = 0.4;
  const room = ctx.createGain();
  room.connect(ctx.destination);
  room.connect(verb);
  verb.connect(wet);
  wet.connect(ctx.destination);

  const seed = name.length * 7919 + name.charCodeAt(0) * 131 + name.charCodeAt(1) + variant * 101;
  spec.build({ ctx, dry: ctx.destination, room, rnd: mulberry32(seed) });

  const buffer = await renderOffline(ctx);
  const data = buffer.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] ?? 0));
  const scale = spec.peak / Math.max(peak, 1e-6);
  // Bells ring past any sensible buffer, so the last quarter closes on a curve instead of being cut.
  const fade = Math.max(Math.round(0.012 * sr), Math.round(data.length * 0.25));
  for (let i = 0; i < data.length; i++) {
    const left = data.length - 1 - i;
    const close = left < fade ? Math.sin(((left / fade) * Math.PI) / 2) ** 2 : 1;
    data[i] = (data[i] ?? 0) * scale * close;
  }
  return buffer;
}

export async function renderSfx(name: SfxName): Promise<AudioBuffer[]> {
  const spec = SPECS[name];
  const out: AudioBuffer[] = [];
  for (let v = 0; v < (spec.variants ?? 1); v++) {
    out.push(await renderVariant(name, spec, v));
    await breathe();
  }
  return out;
}

const LASER_SECONDS = 2;

/** Warm hum. Each partial fits a whole number of cycles in the buffer, so it loops without a seam. */
export async function renderLaser(ctx: BaseAudioContext): Promise<AudioBuffer> {
  const sr = SFX_SAMPLE_RATE;
  const n = LASER_SECONDS * sr;
  const buffer = ctx.createBuffer(1, n, sr);
  const data = buffer.getChannelData(0);
  const partials: ReadonlyArray<readonly [number, number]> = [
    [110, 0.5],
    [110.5, 0.3],
    [220, 0.2],
    [221, 0.14],
    [330.5, 0.1],
    [660, 0.05],
    [880.5, 0.04],
  ];
  const tau = (2 * Math.PI) / sr;
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (const [f, a] of partials) v += a * Math.sin(tau * f * i);
    data[i] = v * (0.85 + 0.15 * Math.sin(tau * 6 * i)) * 0.42;
    if (i % 8192 === 8191) await breathe();
  }
  return buffer;
}
