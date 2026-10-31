// Original pieces, written for this game. Lines are 'note:beats' tokens, bars split by '|'.

import type { MusicTrack } from './types';
import type { Composition } from './score';

const bars = (...phrases: string[]): string => phrases.join(' | ');
const rests = (count: number, meter: number): string => Array<string>(count).fill(`r:${meter}`).join(' | ');

const EIGHTHS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 0, 0.5, 1],
  [0.5, 2, 0.5, 0.7],
  [1, 1, 0.5, 0.82],
  [1.5, 3, 0.5, 0.7],
  [2, 2, 0.5, 0.92],
  [2.5, 1, 0.5, 0.7],
  [3, 3, 0.5, 0.82],
  [3.5, 2, 0.5, 0.7],
];

const OFFBEATS: ReadonlyArray<readonly [number, number]> = [
  [0.5, 1],
  [1.5, 0.75],
  [2.5, 1],
  [3.5, 0.75],
];

// Bright reef: marimba, a light calypso lilt in the bass.
const coralHook = bars(
  'e5:1.5 g5:.5 a5:1 g5:1',
  'e5:1.5 c5:.5 d5:1 e5:1',
  'f5:1.5 a5:.5 c6:1 a5:1',
  'g5:3 r:1',
);
const coralMelody = bars(
  coralHook,
  'e5:1.5 g5:.5 a5:1 g5:1',
  'a5:1.5 f5:.5 g5:1 a5:1',
  'c6:1 a5:1 f5:1 d5:1',
  'b4:1 d5:1 g5:2',

  coralHook,
  'c6:1.5 b5:.5 a5:1 e5:1',
  'f5:1 a5:1 g5:1 f5:1',
  'd5:1 f5:1 d5:1 b4:1',
  'c5:2 r:1 g5:.5 a5:.5',

  'c6:2 a5:1 c6:1',
  'b5:2 g5:2',
  'b5:1.5 g5:.5 e5:2',
  'a5:3 r:.5 e5:.5',
  'a5:1 f5:1 d5:1 f5:1',
  'g5:1.5 f5:.5 d5:2',
  'e5:1 g5:1 c6:1 e6:1',
  'a5:1 c6:1 d6:1 b5:1',

  coralHook,
  'c6:1.5 b5:.5 a5:1 e5:1',
  'f5:1 a5:1 c6:1 a5:1',
  'b5:1 g5:1 f5:1 d5:1',
  'c5:1 e5:1 d5:1 b4:1',
);

const coral: Composition = {
  id: 'coral',
  key: 'C major',
  feel: 'bright marimba reef, calypso lilt',
  bpm: 120,
  meter: 4,
  bars: 32,
  seed: 11,
  level: 1,
  reverb: { seconds: 1.5, damp: 4200, wet: 0.8 },
  chords: bars(
    'C | Am7 | Fmaj7 | G7sus G7 | C/E | F | Dm7 | G7',
    'C | Am7 | Fmaj7 | G7sus G7 | Am7 | F | Dm7 G7 | C',
    'Fmaj7 | G | Em7 | Am7 | Dm7 | G7 | C/E | F G7',
    'C | Am7 | Fmaj7 | G7sus G7 | Am7 | Dm7 | G7 | C G7',
  ),
  parts: [
    { name: 'melody', kind: 'line', melody: true, inst: 'marimba', notes: coralMelody, vel: 0.8, send: 0.34 },
    {
      name: 'sparkle',
      kind: 'line',
      inst: 'bell',
      notes: coralMelody,
      transpose: 12,
      vel: 0.075,
      send: 0.6,
      bars: [[9, 16], [25, 28]],
    },
    {
      name: 'mallets',
      kind: 'arp',
      inst: 'marimba',
      low: 57,
      rhythm: EIGHTHS,
      vel: 0.22,
      send: 0.3,
      bars: [[1, 16], [25, 32]],
    },
    { name: 'tines', kind: 'arp', inst: 'kalimba', low: 62, rhythm: EIGHTHS, vel: 0.2, send: 0.36, bars: [[17, 24]] },
    {
      name: 'bass',
      kind: 'bass',
      inst: 'bass',
      low: 40,
      rhythm: [[0, 1, 1.3], [1.5, 5, 0.4], [2, 1, 1.3], [3.5, 5, 0.4]],
      vel: 0.16,
      send: 0.05,
    },
    { name: 'pad', kind: 'pad', inst: 'pad', low: 55, vel: 0.022, send: 0.7 },
    { name: 'shaker', kind: 'hits', inst: 'shaker', pitch: 60, rhythm: OFFBEATS, vel: 0.06, send: 0.1 },
    { name: 'drops', kind: 'drops', inst: 'drop', chance: 0.3, scale: [84, 86, 88, 91, 93], vel: 0.08, send: 0.8 },
  ],
};

// Mellow kelp: a slow waltz that sways, electric piano over warm pad.
const kelpMelody = bars(
  'a4:2 c5:1 | d5:2 c5:1 | bb4:2 a4:1 | g4:3',
  'a4:2 c5:1 | f5:2 e5:1 | d5:1 c5:1 bb4:1 | c5:2 r:1',
  'a4:2 c5:1 | d5:2 f5:1 | g5:2 f5:1 | e5:2 c5:1',
  'e5:2 a5:1 | a5:2 f5:1 | g5:1 f5:1 e5:1 | f5:3',
  'd5:1 f5:1 a5:1 | g5:2 e5:1 | c5:1 e5:1 g5:1 | f5:2 d5:1',
  'bb4:1 d5:1 f5:1 | e5:2 c5:1 | e5:1 c5:1 a4:1 | bb4:2 c5:1',
  'a4:2 c5:1 | d5:2 c5:1 | bb4:2 d5:1 | c5:3',
  'e5:2 c5:1 | f5:2 a5:1 | g5:2 e5:1 | f5:2 c5:1',
);

const kelp: Composition = {
  id: 'kelp',
  key: 'F major',
  feel: 'mellow swaying waltz',
  bpm: 88,
  meter: 3,
  bars: 32,
  seed: 23,
  level: 0.96,
  reverb: { seconds: 2.2, damp: 2800, wet: 0.65 },
  chords: bars(
    'Fmaj7 | Bbmaj7 | Gm7 | C7sus | Fmaj7 | Dm7 | Bbmaj7 | C7',
    'Fmaj7 | Bbmaj7 | Gm7 | C7 | Am7 | Dm7 | Gm7:2 C7:1 | F',
    'Bbmaj7 | C/Bb | Am7 | Dm7 | Gm7 | C7 | Am7 | Gm7:2 C7sus:1',
    'Fmaj7 | Bbmaj7 | Gm7 | C7 | Am7 | Dm7 | Gm7:2 C7:1 | F:2 C7sus:1',
  ),
  parts: [
    { name: 'melody', kind: 'line', melody: true, inst: 'epiano', notes: kelpMelody, vel: 0.5, send: 0.4 },
    {
      name: 'flute',
      kind: 'line',
      inst: 'flute',
      notes: bars(
        rests(16, 3),
        'a4:3 | g4:3 | g4:3 | f4:3 | f4:3 | e4:3 | e4:3 | f4:3',
        rests(8, 3),
      ),
      vel: 0.1,
      send: 0.7,
    },
    {
      name: 'strum',
      kind: 'arp',
      inst: 'pluck',
      low: 53,
      rhythm: [[1, 1, 0.9, 1], [1, 3, 0.9, 0.7], [2, 0, 0.9, 0.85], [2, 2, 0.9, 0.6]],
      vel: 0.13,
      send: 0.4,
    },
    { name: 'bass', kind: 'bass', inst: 'bass', low: 41, rhythm: [[0, 1, 2.7]], vel: 0.16, send: 0.06 },
    { name: 'pad', kind: 'pad', inst: 'pad', low: 53, vel: 0.03, send: 0.8 },
    { name: 'drops', kind: 'drops', inst: 'drop', chance: 0.2, scale: [77, 79, 81, 84, 86], vel: 0.07, send: 0.9 },
  ],
};

// Sunken ship: tiptoeing A Dorian. The raised sixth keeps the mystery friendly.
const shipTiptoe = 'a4:.5 r:.5 c5:.5 r:.5 e5:1 d5:1 | f#4:.5 r:.5 a4:.5 r:.5 d5:1 c5:1 | a4:.5 r:.5 c5:.5 r:.5 e5:1 g5:1';
const shipMelody = bars(
  shipTiptoe,
  'f#5:1.5 e5:.5 d5:2',
  'g5:1.5 e5:.5 c5:1 e5:1',
  'd5:1.5 b4:.5 g4:1 b4:1',
  'c5:1 e5:1 a5:1 g5:1',
  'f#5:2 d5:1 r:1',

  'e5:1 g5:1 b5:2 | a5:1 g5:1 d5:2',
  'c5:1 e5:1 a5:2 | g5:1 e5:1 b4:2',
  'c5:1 f5:1 a5:2 | g5:1 e5:1 c5:2',
  'd5:1 f5:1 a5:1 c6:1 | b5:2 g#5:2',

  shipTiptoe,
  'f#5:1.5 e5:.5 d5:1 f#5:1',
  'g5:1.5 e5:.5 c5:1 e5:1',
  'd5:1.5 b4:.5 g4:2',
  'a4:1 c5:1 b4:1 g4:1',
  'a4:2 g#4:1 b4:1',
);

const ship: Composition = {
  id: 'ship',
  key: 'A Dorian',
  feel: 'mysterious but friendly tiptoe',
  bpm: 96,
  meter: 4,
  bars: 24,
  seed: 37,
  level: 0.96,
  reverb: { seconds: 2.6, damp: 2400, wet: 0.7 },
  chords: bars(
    'Am7 | D9 | Am7 | D9 | Cmaj7 | G | Am7 | D7',
    'Cmaj7 | G/B | Am7 | Em7 | Fmaj7 | C/E | Dm7 | E7sus E7',
    'Am7 | D9 | Am7 | D9 | Cmaj7 | G | Am7 Em7 | Am7 E7',
  ),
  parts: [
    { name: 'melody', kind: 'line', melody: true, inst: 'bell', notes: shipMelody, vel: 0.5, send: 0.42 },
    {
      name: 'flute',
      kind: 'line',
      inst: 'flute',
      notes: shipMelody,
      transpose: -12,
      vel: 0.07,
      send: 0.7,
      bars: [[9, 16]],
    },
    {
      name: 'bass',
      kind: 'bass',
      inst: 'pizz',
      low: 40,
      rhythm: [[0, 1, 0.6], [1, 5, 0.6], [2, 8, 0.6], [3, 5, 0.6]],
      vel: 0.26,
      send: 0.3,
    },
    {
      name: 'answer',
      kind: 'arp',
      inst: 'musicbox',
      low: 60,
      rhythm: [[1.5, 2, 0.5, 0.8], [3.5, 3, 0.5, 1]],
      vel: 0.1,
      send: 0.6,
    },
    { name: 'pad', kind: 'pad', inst: 'pad', low: 50, vel: 0.02, send: 0.8 },
    { name: 'tick', kind: 'hits', inst: 'wood', pitch: 79, rhythm: [[1, 0.7], [3, 1]], vel: 0.05, send: 0.4 },
    { name: 'drops', kind: 'drops', inst: 'drop', chance: 0.25, scale: [69, 72, 74, 76, 79], vel: 0.07, send: 0.9 },
  ],
};

// Glow deep: E flat Lydian bells over slow, drifting chords.
const glowMelody = bars(
  'bb5:2 g5:1 f5:1 | a5:3 r:1 | g5:2 bb5:1 d6:1 | c6:3 r:1',
  'eb6:2 d6:1 bb5:1 | c6:2 g5:2 | f5:1 g5:1 bb5:1 c6:1 | d6:3 r:1',
  'bb5:2 f5:2 | g5:2 eb5:2 | c6:2 g5:1 eb5:1 | g5:3 r:1',
  'ab5:2 c6:1 eb6:1 | c6:2 bb5:2 | g5:2 f5:1 d5:1 | c5:1 f5:1 a5:2',
  'bb5:2 g5:1 f5:1 | a5:2 c6:2 | eb6:1 c6:1 g5:2 | f5:3 r:1',
);

const glow: Composition = {
  id: 'glow',
  key: 'E flat Lydian',
  feel: 'dreamy bioluminescent bells',
  bpm: 76,
  meter: 4,
  bars: 20,
  seed: 41,
  level: 0.9,
  reverb: { seconds: 3.4, damp: 3000, wet: 0.7 },
  chords: bars(
    'Ebmaj9 | F/Eb | Ebmaj9 | F/Eb | Cm9 | Abmaj7 | Bbsus4 | Bb',
    'Gm7 | Cm9 | Abmaj7 | Eb/G | Fm9 | Bb7sus | Ebmaj9 | F/Eb',
    'Ebmaj9 | F/Eb | Abmaj7 | Bbsus4',
  ),
  parts: [
    { name: 'melody', kind: 'line', melody: true, inst: 'bell', notes: glowMelody, vel: 0.46, send: 0.55 },
    {
      name: 'shimmer',
      kind: 'arp',
      inst: 'glass',
      low: 63,
      rhythm: [
        [0, 0, 0.5, 1],
        [0.5, 2, 0.5, 0.6],
        [1, 3, 0.5, 0.8],
        [1.5, 1, 0.5, 0.6],
        [2, 4, 0.5, 0.9],
        [2.5, 2, 0.5, 0.6],
        [3, 3, 0.5, 0.8],
        [3.5, 1, 0.5, 0.6],
      ],
      vel: 0.075,
      send: 0.75,
    },
    { name: 'bass', kind: 'bass', inst: 'bass', low: 39, rhythm: [[0, 1, 3.7]], vel: 0.12, send: 0.12 },
    { name: 'pad', kind: 'pad', inst: 'pad', low: 55, vel: 0.026, send: 0.9 },
    { name: 'drops', kind: 'drops', inst: 'drop', chance: 0.35, scale: [75, 77, 79, 82, 84, 86], vel: 0.07, send: 1 },
  ],
};

// Arctic: open E major, glassy 3+3+2 arpeggios, thirds kept out of the bass for a cold, wide feel.
const arcticHook = 'b5:1.5 g#5:1.5 f#5:1 | e5:1.5 g#5:1.5 b5:1 | c#6:1.5 b5:1.5 a5:1';
const arcticMelody = bars(
  arcticHook,
  'e5:3 r:1',
  'b5:1.5 g#5:1.5 f#5:1',
  'e5:1.5 g#5:1.5 c#6:1',
  'a5:1.5 f#5:1.5 e5:1',
  'f#5:2 d#5:2',

  'e5:1 a5:1 b5:2 | g#5:1 b5:1 e6:2 | c#6:1.5 a5:1.5 f#5:1 | g#5:3 r:1',
  'e5:1 a5:1 c#6:2 | d#6:1 b5:1 f#5:2 | g#5:1.5 b5:1.5 d#6:1 | e6:2 f#5:2',

  arcticHook,
  'e5:2 f#5:2',
  'e5:1 a5:1 c#6:2',
  'f#5:1 a5:1 b5:1 d#6:1',
  'e6:3 r:1',
  'c#6:1 b5:1 a5:1 f#5:1',
);

const arctic: Composition = {
  id: 'arctic',
  key: 'E major',
  feel: 'crystalline, open, 3+3+2 glass',
  bpm: 104,
  meter: 4,
  bars: 24,
  seed: 53,
  level: 0.9,
  reverb: { seconds: 2.8, damp: 4800, wet: 0.72 },
  chords: bars(
    'Eadd9 | C#m7 | Aadd9 | B7sus | Eadd9 | C#m7 | F#m7 | B7sus B7',
    'Aadd9 | E/G# | F#m7 | C#m7 | Aadd9 | B | G#m7 | C#m7 B7sus',
    'Eadd9 | C#m7 | Aadd9 | B7sus | Aadd9 | B7sus B7 | Eadd9 | Aadd9 B7sus',
  ),
  parts: [
    { name: 'melody', kind: 'line', melody: true, inst: 'glass', notes: arcticMelody, vel: 0.56, send: 0.48 },
    {
      name: 'crystals',
      kind: 'arp',
      inst: 'glass',
      low: 64,
      rhythm: [
        [0, 0, 0.5, 1],
        [0.5, 2, 0.5, 0.6],
        [1, 3, 0.5, 0.6],
        [1.5, 1, 0.5, 0.9],
        [2, 2, 0.5, 0.6],
        [2.5, 4, 0.5, 0.6],
        [3, 3, 0.5, 0.9],
        [3.5, 2, 0.5, 0.6],
      ],
      vel: 0.085,
      send: 0.6,
    },
    { name: 'bass', kind: 'bass', inst: 'bass', low: 40, rhythm: [[0, 1, 2.6], [3, 5, 0.9]], vel: 0.13, send: 0.1 },
    { name: 'pad', kind: 'pad', inst: 'pad', low: 59, vel: 0.024, send: 0.85 },
    { name: 'drops', kind: 'drops', inst: 'drop', chance: 0.25, scale: [88, 90, 92, 95, 97], vel: 0.06, send: 1 },
  ],
};

// Boss: bouncy D Mixolydian adventure. Busy, but major and rounded, with no minor-key dread.
const bossRiff = 'a4:.5 d5:.5 f#5:.5 a5:1 f#5:.5 a5:1 | g5:.5 e5:.5 c5:.5 e5:1 g5:.5 e5:1';
const bossA = bars(
  bossRiff,
  'd5:.5 g5:.5 b5:.5 d6:1 b5:.5 g5:1',
  'd5:1 e5:1 c#5:1 e5:1',
  bossRiff,
  'd5:.5 g5:.5 b5:.5 d6:1 e6:.5 d6:1',
  'c#6:1 a5:1 g5:1 e5:1',
);
const bossMelody = bars(
  bossA,
  'f#5:1.5 d5:.5 b4:1 d5:1 | g5:1.5 d5:.5 b4:1 g5:1 | e5:1 g5:1 b5:1 a5:1 | c#6:2 a5:2',
  'd6:1.5 b5:.5 f#5:1 a5:1 | b5:1.5 g5:.5 d5:1 g5:1 | e5:1 g5:1 a5:1 c#6:1 | d6:2 a5:1 r:1',
  bossA,
  'b5:2 d6:2 | c#6:2 e6:2 | c#6:1.5 a5:.5 f#5:2 | d6:3 r:1',
  'b5:2 d6:2 | c#6:2 e6:2 | d6:1 b5:1 a5:1 f#5:1 | d5:1 e5:1 g5:1 e5:1',
);

const boss: Composition = {
  id: 'boss',
  key: 'D Mixolydian',
  feel: 'bouncy, upbeat, never tense',
  bpm: 132,
  meter: 4,
  bars: 32,
  seed: 67,
  level: 1,
  reverb: { seconds: 1.3, damp: 3800, wet: 0.9 },
  chords: bars(
    'D | C | G | A7sus A7 | D | C | G | A7',
    'Bm7 | G | Em7 | A7 | Bm7 | G | Em7 A7 | D',
    'D | C | G | A7sus A7 | D | C | G | A7',
    'G | A | F#m7 | Bm7 | G | A | G D/F# | A7sus A7',
  ),
  parts: [
    { name: 'melody', kind: 'line', melody: true, inst: 'kalimba', notes: bossMelody, vel: 0.62, send: 0.26 },
    {
      name: 'double',
      kind: 'line',
      inst: 'marimba',
      notes: bossMelody,
      vel: 0.26,
      send: 0.26,
      bars: [[17, 32]],
    },
    {
      name: 'bass',
      kind: 'bass',
      inst: 'bass',
      low: 38,
      rhythm: [
        [0, 1, 0.42],
        [0.5, 8, 0.32],
        [1, 5, 0.42],
        [1.5, 8, 0.32],
        [2, 1, 0.42],
        [2.5, 8, 0.32],
        [3, 5, 0.42],
        [3.5, 8, 0.32],
      ],
      vel: 0.15,
      send: 0.04,
    },
    {
      name: 'stabs',
      kind: 'arp',
      inst: 'pluck',
      low: 57,
      rhythm: [[0.5, 0, 0.3], [0.5, 1, 0.3], [0.5, 2, 0.3], [2.5, 0, 0.3], [2.5, 1, 0.3], [2.5, 2, 0.3], [3.5, 1, 0.3, 0.7], [3.5, 2, 0.3, 0.7]],
      vel: 0.075,
      send: 0.26,
    },
    { name: 'pad', kind: 'pad', inst: 'pad', low: 57, vel: 0.02, send: 0.6, bars: [[9, 16], [25, 32]] },
    {
      name: 'conga',
      kind: 'hits',
      inst: 'conga',
      pitch: 50,
      rhythm: [[0, 1], [1.5, 0.55], [2, 0.85], [3.5, 0.55]],
      vel: 0.15,
      send: 0.12,
    },
    { name: 'shaker', kind: 'hits', inst: 'shaker', pitch: 60, rhythm: OFFBEATS, vel: 0.06, send: 0.1 },
  ],
};

// Menu: a lazy shuffle in G with a ukulele-like off-beat and a flute that joins on the repeat.
const menuHook =
  'r:.5 b4:.5 d5:.5 g5:1 e5:.5 d5:1 | r:.5 b4:.5 e5:.5 g5:1 f#5:.5 e5:1 | r:.5 c5:.5 e5:.5 g5:1 a5:.5 g5:1 | f#5:1 a5:1 d5:2';
const menuMelody = bars(
  menuHook,
  'r:.5 b4:.5 d5:.5 g5:1 e5:.5 d5:1 | r:.5 e5:.5 g5:.5 b5:1 a5:.5 g5:1 | a5:1.5 e5:.5 c5:1 e5:1 | d5:1 f#5:1 a5:1 c6:1',
  'c6:1.5 b5:.5 g5:1 e5:1 | d5:.5 f#5:.5 a5:1 d6:2 | b5:1.5 a5:.5 f#5:1 d5:1 | e5:.5 g5:.5 b5:1 e6:2',
  'e6:1.5 d6:.5 c6:1 g5:1 | a5:1.5 g5:.5 f#5:1 d5:1 | c5:1 e5:1 d5:1 f#5:1 | g5:3 r:1',
  menuHook,
  'r:.5 c5:.5 e5:.5 a5:1 g5:.5 e5:1 | r:.5 d5:.5 f#5:.5 a5:1 c6:.5 a5:1 | b5:1 g5:1 e5:1 d5:1 | g4:1 b4:.5 d5:.5 c5:1 a4:1',
);

const menu: Composition = {
  id: 'menu',
  key: 'G major',
  feel: 'cheerful lazy shuffle',
  bpm: 104,
  meter: 4,
  bars: 24,
  swing: 0.3,
  seed: 71,
  level: 1,
  reverb: { seconds: 1.4, damp: 3600, wet: 0.85 },
  chords: bars(
    'G | Em7 | C | D7 | G | Em7 | Am7 | D7',
    'C | D | Bm7 | Em7 | C | D | Am7 D7 | G',
    'G | Em7 | C | D7 | Am7 | D7 | G Em7 | G D7',
  ),
  parts: [
    { name: 'melody', kind: 'line', melody: true, inst: 'kalimba', notes: menuMelody, vel: 0.64, send: 0.3 },
    {
      name: 'flute',
      kind: 'line',
      inst: 'flute',
      notes: menuMelody,
      vel: 0.08,
      send: 0.45,
      bars: [[9, 24]],
    },
    {
      name: 'uke',
      kind: 'arp',
      inst: 'pluck',
      low: 59,
      rhythm: [
        [0.5, 0, 0.4],
        [0.5, 1, 0.4],
        [0.5, 2, 0.4],
        [1.5, 1, 0.4, 0.75],
        [1.5, 2, 0.4, 0.75],
        [2.5, 0, 0.4],
        [2.5, 1, 0.4],
        [2.5, 2, 0.4],
        [3.5, 1, 0.4, 0.75],
        [3.5, 2, 0.4, 0.75],
      ],
      vel: 0.085,
      send: 0.3,
    },
    {
      name: 'bass',
      kind: 'bass',
      inst: 'pizz',
      low: 38,
      rhythm: [[0, 1, 1], [1.5, 5, 0.5], [2, 5, 1], [3.5, 1, 0.5]],
      vel: 0.3,
      send: 0.08,
    },
    { name: 'pad', kind: 'pad', inst: 'pad', low: 55, vel: 0.018, send: 0.6 },
    { name: 'wood', kind: 'hits', inst: 'wood', pitch: 81, rhythm: [[1, 1], [3, 0.8]], vel: 0.05, send: 0.25 },
  ],
};

// Lullaby: music box, breathing slowly, always falling back home.
const lullabyMelody = bars(
  'f5:2 d5:1 | bb4:2 d5:1 | eb5:2 g5:1 | f5:3',
  'd5:2 f5:1 | bb5:2 g5:1 | eb5:2 c5:1 | a4:3',
  'f5:2 d5:1 | f5:2 a5:1 | g5:2 eb5:1 | d5:3',
  'eb5:2 g5:1 | f5:1 eb5:1 c5:1 | d5:3 | bb4:2 c5:1',
  'g5:2 bb5:1 | f5:2 d5:1 | eb5:2 g5:1 | f5:3',
  'g5:1 f5:1 eb5:1 | f5:1 d5:1 a4:1 | eb5:2 c5:1 | bb4:3',
);

const lullaby: Composition = {
  id: 'lullaby',
  key: 'B flat major',
  feel: 'calm music-box lullaby',
  bpm: 69,
  meter: 3,
  bars: 24,
  seed: 83,
  level: 0.72,
  reverb: { seconds: 3, damp: 2200, wet: 0.62 },
  chords: bars(
    'Bbmaj7 | Gm7 | Ebmaj7 | F7sus | Bbmaj7 | Gm7 | Cm7 | F7',
    'Bbmaj7 | Dm7 | Ebmaj7 | Bb/D | Cm7 | F7 | Bbmaj7 | Bbmaj7:2 F7sus:1',
    'Ebmaj7 | Bb/D | Cm7 | F7 | Ebmaj7 | Dm7 | Cm7:2 F7:1 | Bbmaj7',
  ),
  parts: [
    { name: 'melody', kind: 'line', melody: true, inst: 'musicbox', notes: lullabyMelody, vel: 0.5, send: 0.5 },
    {
      name: 'rocking',
      kind: 'arp',
      inst: 'musicbox',
      low: 53,
      rhythm: [[0, 0, 1, 0.9], [1, 2, 1, 0.65], [2, 1, 1, 0.65]],
      vel: 0.12,
      send: 0.55,
    },
    { name: 'bass', kind: 'bass', inst: 'bass', low: 41, rhythm: [[0, 1, 2.8]], vel: 0.1, send: 0.14 },
    { name: 'pad', kind: 'pad', inst: 'pad', low: 53, vel: 0.02, send: 0.9 },
  ],
};

export const COMPOSITIONS: Record<MusicTrack, Composition> = { menu, coral, kelp, ship, glow, arctic, boss, lullaby };
