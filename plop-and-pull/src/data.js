// All tuning lives here so the game can be rebalanced without touching logic.
// World units: a portrait sea 820 wide and 1180 tall. y grows downward; deeper is worth more.

export const WORLD = { width: 820, height: 1180, surface: 270, halfway: 410, margin: 150 };

export const BOATS = {
  1: [{ x: 410, min: 70, max: 750, rider: 'capy' }],
  2: [
    { x: 205, min: 70, max: 380, rider: 'capy' },
    { x: 615, min: 440, max: 750, rider: 'duck' },
  ],
};

export const CAST = {
  dropSpeed: 1100,
  boatSpeed: 1400,
  snap: 120,
  lure: 280,
  lureSpeed: 300,
  arrive: 10,
  floorGap: 40,
  popTime: 0.25,
};

export const PULL = { idle: 190, hold: 520, tap: 55, lean: 260 };
export const HOP = { reach: 35, radiusShare: 0.35, extras: 3, bigExtras: 5, bigReach: 2 };

// Where riders hang below the ring: first catch, then each friend who hops on.
export const RIDER_SLOTS = [[0, 50], [-74, 34], [74, 34], [-44, 112], [44, 112], [0, 170]];

export const DAY = {
  idlePause: 8,
  hint: 6,
  glow: 10,
  glowMultiplier: 2,
};

export const SPAWN = { refill: 0.6, stagger: 0.25, tries: 6, clearY: 62, clearX: 180, speedVary: 0.15 };

export const BUBBLES = { speed: 60, radius: 58, touchGap: 34, doubleTime: 8, order: ['double', 'bigRing'] };

export const BIG_TUG = {
  riseAt: 0.7,
  takeAt: 0.85,
  x: 410,
  y: 960,
  startY: 1320,
  riseSpeed: 220,
  halfW: 280,
  halfH: 110,
  grabGap: 60,
  speeds: [95, 170, 300],
  tap: 24,
  breachY: 330,
  breachTime: 2.4,
  pearls: 20,
};

export const INPUT = { deadZone: 60, sameTouchMs: 120, sameTouchGap: 60 };

// The art is painted large so stickers stay sharp. Friends swim at this share of it, which is about the w and h below.
export const SEA_SCALE = 0.72;

// Pearl values follow the arcade's depth ladder of about 1 : 3 : 5 : 20, so a deep catch is a long pull and a big thank-you.
export const CREATURES = {
  bobble: { name: 'Bobble', band: [340, 480], pearls: 1, speed: 45, w: 110, h: 100, radius: 62, weight: 1 },
  stripes: { name: 'Stripes', band: [340, 560], pearls: 1, speed: 60, w: 120, h: 100, radius: 62, weight: 1 },
  hoppa: { name: 'Hoppa', band: [420, 600], pearls: 2, speed: 30, w: 100, h: 140, radius: 70, weight: 1, bob: 30 },
  boxy: { name: 'Boxy', band: [560, 700], pearls: 3, speed: 55, w: 140, h: 100, radius: 75, weight: 1.1 },
  shelby: { name: 'Shelby', band: [640, 810], pearls: 4, speed: 40, w: 180, h: 120, radius: 95, weight: 1.2 },
  glim: { name: 'Glim', band: [830, 960], pearls: 5, speed: 50, w: 170, h: 120, radius: 90, weight: 1.2 },
  swoop: { name: 'Swoop', band: [860, 1030], pearls: 7, speed: 70, w: 240, h: 130, radius: 125, weight: 1.3 },
  hum: { name: 'Big Hum', pearls: BIG_TUG.pearls, w: 560, h: 220, radius: 280, weight: 1 },
};

export const FINDS = {
  boot: { name: 'Old Boot', pearls: 1, weight: 1 },
  teapot: { name: 'Teapot', pearls: 1, weight: 1 },
  ducky: { name: 'Rubber Duck', pearls: 1, weight: 1 },
  sock: { name: 'Stripy Sock', pearls: 1, weight: 1 },
};
export const FIND_ORDER = ['boot', 'teapot', 'ducky', 'sock'];

export const STICKER_ORDER = ['bobble', 'stripes', 'hoppa', 'boxy', 'shelby', 'glim', 'swoop', 'hum', ...FIND_ORDER];

export const LEVELS = [
  {
    level: 1,
    time: 45,
    floor: 640,
    fish: { 1: 7, 2: 9 },
    weights: { bobble: 4, stripes: 4, hoppa: 2 },
    hopOns: false,
    bubbles: [],
    bigTug: false,
    stars: { 1: [18, 50], 2: [34, 80] },
  },
  {
    level: 2,
    time: 60,
    floor: 850,
    fish: { 1: 10, 2: 14 },
    weights: { bobble: 2, stripes: 2, hoppa: 2, boxy: 3, shelby: 2 },
    hopOns: true,
    bubbles: [20, 40],
    bigTug: false,
    stars: { 1: [45, 150], 2: [112, 270] },
  },
  {
    level: 3,
    time: 75,
    floor: 1070,
    fish: { 1: 12, 2: 16 },
    weights: { stripes: 1, hoppa: 1, boxy: 2, shelby: 2, glim: 3, swoop: 2 },
    hopOns: true,
    bubbles: [15, 35, 55],
    bigTug: true,
    stars: { 1: [85, 290], 2: [187, 480] },
  },
];

// Total stars across the three levels dress up the boat. Nothing is bought.
export const BOAT_EXTRAS = [
  { id: 'flag', stars: 3 },
  { id: 'parasol', stars: 6 },
  { id: 'lights', stars: 9 },
];
