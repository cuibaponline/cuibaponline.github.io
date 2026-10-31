// All tuning lives here (spec sections 3-5, 6, 11) so the game can be rebalanced without touching logic.

export const WORLD = { width: 1200, height: 820, safeWidth: 1100, safeHeight: 744 };

// Herd rows, front first. Back rows are smaller and slower.
export const ROWS = [
  { y: 572, scale: 1, speed: 1 },
  { y: 472, scale: 0.84, speed: 0.88 },
  { y: 392, scale: 0.7, speed: 0.76 },
];

export const LASSO_ORIGIN_Y = 700;
export const LANE_WIDTH = 240;
export const LANES = { 2: [480, 720], 3: [400, 600, 800] };

export const SPAWN = {
  minGap: 0.9,
  maxGap: 1.5,
  bonusRate: 3,
  maxOnScreen: 18,
  hazardBehindHighValue: 0.5,
  highValue: 17,
  prewarm: 5,
  minSpacing: 150,
};

export const TIMING = {
  retract: 0.18,
  cooldownCatch: 0.6,
  jam: 1.5,
  bonusTime: 15,
  megaLassoCatches: 3,
  skunkStink: 2.5,
  bossCount: 6,
  bossGap: 0.4,
};

export const COMBO = [
  { streak: 6, multiplier: 2 },
  { streak: 3, multiplier: 1.5 },
];

export const STARS = [1, 1.5, 2];
export const HAZARD_PENALTY = 10;
export const HELPER_HORSE = { afterFails: 2, speed: 0.8 };
export const BREAK_AFTER_SECONDS = 30 * 60;

// hw / hh: half the hitbox at row scale 1, in world units.
export const ANIMALS = {
  A1: { name: 'Daisy', kind: 'yellow calf', points: 2, speed: 105, behaviour: 'walk', weight: 40, hw: 62, hh: 46 },
  A2: { name: 'Patch', kind: 'spotted dairy cow', points: 5, speed: 165, behaviour: 'walk', weight: 35, hw: 68, hh: 50 },
  A3: { name: 'Bluebell', kind: 'sleepy blue bull', points: 9, speed: 165, behaviour: 'graze', weight: 20, hw: 72, hh: 52 },
  A4: { name: 'Captain Moo', kind: 'caped show cow', points: 17, speed: 235, behaviour: 'hop', weight: 10, hw: 66, hh: 44 },
  A5: { name: 'Rusty', kind: 'grumpy red bison', points: 23, speed: 290, behaviour: 'charge', weight: 5, hw: 74, hh: 54 },
  S1: { name: 'Golden Calf', kind: 'very rare calf', points: 50, speed: 235, behaviour: 'walk', weight: 0, hw: 62, hh: 46, special: true },
  H1: { name: 'Skunk', kind: 'stinky skunk', points: -HAZARD_PENALTY, speed: 165, behaviour: 'walk', weight: 10, hw: 58, hh: 36, hazard: 'stink' },
  H2: { name: 'Porcupine', kind: 'prickly porcupine', points: 0, speed: 105, behaviour: 'walk', weight: 10, hw: 50, hh: 36, hazard: 'jam' },
};

export const STICKER_ORDER = ['A1', 'A2', 'A3', 'A4', 'A5', 'S1', 'H1', 'H2'];

export const BEHAVIOUR = {
  graze: { walkMin: 1.5, walkMax: 3, stopMin: 1, stopMax: 2 },
  hop: { height: 60, period: 0.8 },
  charge: { calmMin: 1.5, calmMax: 2.5, burst: 0.6, burstSpeed: 1.8 },
};

export const LEVELS = [
  { level: 1, time: 60, target: 30, rows: 1, introduce: ['A1', 'A2'], tutorial: 'throw' },
  { level: 2, time: 60, target: 50, rows: 1 },
  { level: 3, time: 60, target: 70, rows: 1, introduce: ['A3'] },
  { level: 4, time: 60, target: 100, rows: 2 },
  { level: 5, time: 60, target: 120, rows: 2, introduce: ['A4'] },
  { level: 6, time: 60, target: 150, rows: 2, introduce: ['S1'] },
  { level: 7, time: 55, target: 170, rows: 2, introduce: ['H1'], tutorial: 'hazard' },
  { level: 8, time: 55, target: 200, rows: 2, introduce: ['A5'] },
  { level: 9, time: 55, target: 230, rows: 3 },
  { level: 10, time: 50, target: 260, rows: 3, alternate: true },
  { level: 11, time: 50, target: 290, rows: 3, alternate: true, introduce: ['H2'] },
  { level: 12, time: 50, target: 330, rows: 3, alternate: true, bossAtRemaining: 20 },
];

export const DIFFICULTY = {
  easy: {
    label: 'Easy', ages: '4-6', speed: 0.7, assist: 0.15, catchWindow: 1.3, hazards: [], lanes: 2,
    threeLanesFrom: null, target: 0.7, timeBonus: 15, combo: false, oneTap: true, gentleFail: true,
    travel: 0.45, cooldownMiss: 0.4,
  },
  medium: {
    label: 'Medium', ages: '7-10', speed: 1, assist: 0.05, catchWindow: 1, hazards: ['H1'], lanes: 2,
    threeLanesFrom: null, target: 1, timeBonus: 0, combo: true, oneTap: false, gentleFail: false,
    travel: 0.4, cooldownMiss: 0.7,
  },
  hard: {
    label: 'Hard', ages: '10+', speed: 1.3, assist: 0, catchWindow: 0.8, hazards: ['H1', 'H2'], lanes: 2,
    threeLanesFrom: 5, target: 1.25, timeBonus: 0, combo: true, oneTap: false, gentleFail: false,
    travel: 0.35, cooldownMiss: 1,
  },
};

// Unlocked by total stars across all difficulties. No currency, no shop.
export const COSMETICS = {
  rope: [
    { id: 'rope_yellow', label: 'Sunny', stars: 0, colors: ['#f7c62e', '#fff0a6'] },
    { id: 'rope_red', label: 'Chili', stars: 6, colors: ['#e5412f', '#ffb4a3'] },
    { id: 'rope_blue', label: 'River', stars: 12, colors: ['#2e8fe5', '#b4e0ff'] },
    { id: 'rope_pink', label: 'Candy', stars: 18, colors: ['#ee5da8', '#ffd1ea'] },
    { id: 'rope_rainbow', label: 'Rainbow', stars: 27, colors: ['#e5412f', '#f7c62e', '#3fbf5f', '#2e8fe5', '#9a5de5'] },
  ],
  hat: [
    { id: 'hat_cowboy', label: 'Cowboy', stars: 3 },
    { id: 'hat_straw', label: 'Straw', stars: 9 },
    { id: 'hat_sheriff', label: 'Sheriff', stars: 15 },
    { id: 'hat_party', label: 'Party', stars: 21 },
    { id: 'hat_crown', label: 'Crown', stars: 33 },
  ],
  background: [
    { id: 'bg_sunny', label: 'Sunny', stars: 0 },
    { id: 'bg_sunset', label: 'Sunset', stars: 10 },
    { id: 'bg_blossom', label: 'Blossom', stars: 24 },
  ],
};

export const STARTER_COSMETICS = COSMETICS.rope.concat(COSMETICS.hat, COSMETICS.background)
  .filter((item) => item.stars === 0)
  .map((item) => item.id);
