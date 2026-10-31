// Turns the written compositions (compositions.ts) into timed note events. Pure data, no audio APIs.

import type { MusicTrack } from './types';
import { mulberry32, type Inst } from './synth';

type Bars = ReadonlyArray<readonly [number, number]>;

interface PartBase {
  name: string;
  inst: Inst;
  vel: number;
  /** Reverb send, 0..1. */
  send: number;
  /** 1-based inclusive bar ranges; omitted means every bar. */
  bars?: Bars;
}

export interface LinePart extends PartBase {
  kind: 'line';
  notes: string;
  transpose?: number;
  melody?: boolean;
}

export interface PadPart extends PartBase {
  kind: 'pad';
  low: number;
}

export interface BassPart extends PartBase {
  kind: 'bass';
  low: number;
  /** [beat, scale step (1 | 3 | 5 | 8), duration in beats] */
  rhythm: ReadonlyArray<readonly [number, 1 | 3 | 5 | 8, number]>;
}

export interface ArpPart extends PartBase {
  kind: 'arp';
  low: number;
  /** [beat, chord tone index, duration in beats, optional velocity scale] */
  rhythm: ReadonlyArray<readonly [number, number, number, number?]>;
}

export interface HitPart extends PartBase {
  kind: 'hits';
  pitch: number;
  /** [beat, velocity scale] */
  rhythm: ReadonlyArray<readonly [number, number]>;
}

export interface DropPart extends PartBase {
  kind: 'drops';
  /** Chance per bar of a stray water drop. */
  chance: number;
  scale: readonly number[];
}

export type Part = LinePart | PadPart | BassPart | ArpPart | HitPart | DropPart;

export interface Composition {
  id: MusicTrack;
  key: string;
  feel: string;
  bpm: number;
  meter: number;
  bars: number;
  /** 0 = straight; 0.33 = triplet shuffle on the eighths. */
  swing?: number;
  seed: number;
  reverb: { seconds: number; damp: number; wet: number };
  /** RMS trim relative to the shared target. */
  level: number;
  /** Bars separated by '|', e.g. 'C | Dm7 G7 | Gm7:2 C7:1'. */
  chords: string;
  parts: readonly Part[];
}

export interface NoteEvent {
  /** Seconds from loop start. */
  t: number;
  dur: number;
  note: number;
  vel: number;
  inst: Inst;
  part: number;
}

export interface Chord {
  symbol: string;
  root: number;
  bass: number;
  tones: readonly number[];
}

export interface ChordSpan {
  bar: number;
  beat: number;
  beats: number;
  chord: Chord;
}

const PITCH_CLASS: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

export function midi(name: string): number {
  const m = /^([a-g])(#|b)?(\d)$/.exec(name);
  if (!m) throw new Error(`bad note "${name}"`);
  const base = PITCH_CLASS[m[1] ?? ''] ?? 0;
  const accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + base + accidental;
}

const QUALITIES: Record<string, readonly number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  '9': [0, 4, 7, 10, 14],
  add9: [0, 4, 7, 14],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '7sus': [0, 5, 7, 10],
};

function pitchClass(letter: string, accidental: string | undefined): number {
  const base = PITCH_CLASS[letter.toLowerCase()] ?? 0;
  return (base + (accidental === '#' ? 1 : accidental === 'b' ? 11 : 0)) % 12;
}

export function parseChord(symbol: string): Chord {
  const m = /^([A-G])(#|b)?([a-z0-9]*)(?:\/([A-G])(#|b)?)?$/.exec(symbol);
  const tones = m ? QUALITIES[m[3] ?? ''] : undefined;
  if (!m || !tones) throw new Error(`bad chord "${symbol}"`);
  const root = pitchClass(m[1] ?? 'C', m[2]);
  const bass = m[4] ? pitchClass(m[4], m[5]) : root;
  return { symbol, root, bass, tones };
}

export function parseChords(comp: Composition): ChordSpan[] {
  const bars = comp.chords.split('|').map((s) => s.trim());
  if (bars.length !== comp.bars) {
    throw new Error(`${comp.id}: ${bars.length} chord bars, expected ${comp.bars}`);
  }
  const spans: ChordSpan[] = [];
  bars.forEach((text, i) => {
    const tokens = text.split(/\s+/);
    let beat = 0;
    for (const token of tokens) {
      const [symbol = '', length] = token.split(':');
      const beats = length ? Number(length) : comp.meter / tokens.length;
      spans.push({ bar: i + 1, beat: i * comp.meter + beat, beats, chord: parseChord(symbol) });
      beat += beats;
    }
    if (Math.abs(beat - comp.meter) > 1e-6) throw new Error(`${comp.id}: chord bar ${i + 1} is ${beat} beats`);
  });
  return spans;
}

export interface WrittenNote {
  bar: number;
  /** Beat within the loop. */
  beat: number;
  beats: number;
  note: number | null;
}

export function parseLine(comp: Composition, notes: string): WrittenNote[] {
  const bars = notes.split('|').map((s) => s.trim());
  if (bars.length !== comp.bars) throw new Error(`${comp.id}: ${bars.length} line bars, expected ${comp.bars}`);
  const out: WrittenNote[] = [];
  bars.forEach((text, i) => {
    let beat = 0;
    for (const token of text.split(/\s+/)) {
      const [name = '', length = ''] = token.split(':');
      const beats = Number(length);
      if (!(beats > 0)) throw new Error(`${comp.id}: bad token "${token}" in bar ${i + 1}`);
      out.push({ bar: i + 1, beat: i * comp.meter + beat, beats, note: name === 'r' ? null : midi(name) });
      beat += beats;
    }
    if (Math.abs(beat - comp.meter) > 1e-6) throw new Error(`${comp.id}: line bar ${i + 1} is ${beat} beats`);
  });
  return out;
}

/** Close voicing from `low` up, in whichever inversion moves least from `prev`. */
function voice(chord: Chord, low: number, prev: readonly number[] | null): number[] {
  let pcs = chord.tones.map((i) => (chord.root + i) % 12);
  if (pcs.length > 4) pcs = pcs.slice(1); // the bass carries the root
  const n = pcs.length;
  let best: number[] = [];
  let bestCost = Infinity;
  for (let rot = 0; rot < n; rot++) {
    const candidate: number[] = [];
    let last = low - 1;
    for (let k = 0; k < n; k++) {
      const pc = pcs[(rot + k) % n] ?? 0;
      let m = last + 1;
      while (m % 12 !== pc) m++;
      candidate.push(m);
      last = m;
    }
    let cost = rot * 1e-3;
    if (prev) {
      for (let k = 0; k < Math.min(n, prev.length); k++) {
        cost += Math.abs((candidate[k] ?? 0) - (prev[k] ?? 0));
      }
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = candidate;
    }
  }
  return best;
}

const inBars = (part: Part, bar: number): boolean =>
  !part.bars || part.bars.some(([from, to]) => bar >= from && bar <= to);

export function loopSeconds(comp: Composition): number {
  return (comp.bars * comp.meter * 60) / comp.bpm;
}

export function buildScore(comp: Composition): NoteEvent[] {
  const spb = 60 / comp.bpm;
  const swing = comp.swing ?? 0;
  const seconds = (beat: number): number => {
    if (!swing) return beat * spb;
    const whole = Math.floor(beat);
    const frac = beat - whole;
    const shifted = frac <= 0.5 ? frac * (1 + swing) : 0.5 + swing / 2 + (frac - 0.5) * (1 - swing);
    return (whole + shifted) * spb;
  };
  const spans = parseChords(comp);
  const chordAt = (beat: number): ChordSpan => {
    for (let i = spans.length - 1; i >= 0; i--) {
      const span = spans[i];
      if (span && span.beat <= beat + 1e-6) return span;
    }
    throw new Error(`${comp.id}: no chord at beat ${beat}`);
  };

  const events: NoteEvent[] = [];
  comp.parts.forEach((part, index) => {
    const rnd = mulberry32(comp.seed * 31 + index);
    const push = (beat: number, beats: number, note: number, velocity: number) => {
      const jitter = (rnd() - 0.5) * 0.007;
      const scale = 1 + (rnd() - 0.5) * 0.12;
      events.push({
        t: Math.max(0, seconds(beat) + jitter),
        dur: beats * spb,
        note,
        vel: velocity * scale,
        inst: part.inst,
        part: index,
      });
    };

    switch (part.kind) {
      case 'line': {
        for (const n of parseLine(comp, part.notes)) {
          if (n.note === null || !inBars(part, n.bar)) continue;
          // accent the bar line a touch so phrases breathe
          const onBar = n.beat % comp.meter === 0 ? 1.08 : 1;
          push(n.beat, n.beats, n.note + (part.transpose ?? 0), part.vel * onBar);
        }
        break;
      }
      case 'pad': {
        let prev: number[] | null = null;
        for (const span of spans) {
          const voicing = voice(span.chord, part.low, prev);
          prev = voicing;
          if (!inBars(part, span.bar)) continue;
          for (const note of voicing) push(span.beat, span.beats, note, part.vel);
        }
        break;
      }
      case 'bass': {
        for (let bar = 1; bar <= comp.bars; bar++) {
          if (!inBars(part, bar)) continue;
          const barBeat = (bar - 1) * comp.meter;
          for (const [beat, step, beats] of part.rhythm) {
            const { chord } = chordAt(barBeat + beat);
            const pc = step === 1 || step === 8 ? chord.bass : (chord.root + (chord.tones[step === 3 ? 1 : 2] ?? 7)) % 12;
            let note = part.low;
            while (note % 12 !== pc) note++;
            push(barBeat + beat, beats, note + (step === 8 ? 12 : 0), part.vel);
          }
        }
        break;
      }
      case 'arp': {
        let prev: number[] | null = null;
        for (const span of spans) {
          const voicing = voice(span.chord, part.low, prev);
          prev = voicing;
          const barBeat = (span.bar - 1) * comp.meter;
          if (!inBars(part, span.bar)) continue;
          for (const [beat, index2, beats, scale = 1] of part.rhythm) {
            const at = barBeat + beat;
            if (at < span.beat - 1e-6 || at >= span.beat + span.beats - 1e-6) continue;
            const n = voicing.length;
            const note = (voicing[index2 % n] ?? part.low) + 12 * Math.floor(index2 / n);
            push(at, beats, note, part.vel * scale);
          }
        }
        break;
      }
      case 'hits': {
        for (let bar = 1; bar <= comp.bars; bar++) {
          if (!inBars(part, bar)) continue;
          for (const [beat, scale] of part.rhythm) {
            push((bar - 1) * comp.meter + beat, 0.25, part.pitch, part.vel * scale);
          }
        }
        break;
      }
      case 'drops': {
        for (let bar = 1; bar <= comp.bars; bar++) {
          if (!inBars(part, bar) || rnd() > part.chance) continue;
          const slot = Math.floor(rnd() * comp.meter * 2) / 2;
          const note = part.scale[Math.floor(rnd() * part.scale.length)] ?? 84;
          push((bar - 1) * comp.meter + slot, 0.25, note, part.vel);
        }
        break;
      }
    }
  });
  return events.sort((a, b) => a.t - b.t);
}
