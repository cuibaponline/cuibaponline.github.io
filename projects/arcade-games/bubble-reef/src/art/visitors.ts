// F13 Dolphin, F14 Seal and F15 Penguin, the animals that visit the reef on cue every wave, and the Blue Whale from the boss rigs.

import type { CreatureDef } from './rig';
import { eye, blush, smile, swim, swimDy, type Box, type SwimOpts } from './rig';
import { COOL } from './fish';
import { F16 } from './bosses';
import { TAU, blitAt, circle, clipped, ellipse, fillPath, linear, makeRng, strokePath, trace, type P, type Part } from './paint';

const finLit = { dome: 6, soften: 0.5, tint: COOL, spec: 0.46, gloss: 30, sheen: 0.14, line: 1.4, lineDark: 0.62 };

// ---------------------------------------------------------------- F13 Dolphin

const dolphinBody: P[] = [
  [57, 6.5], [57, 4], [50, 2.5], [44, 0], [41, -6], [34, -13], [22, -18], [6, -20], [-10, -18.5], [-24, -14], [-36, -8.5], [-46, -4], [-50, -2], [-50, 2], [-42, 5], [-30, 9.5], [-12, 14.5], [6, 17], [22, 16], [34, 13], [44, 10.5], [52, 9.5],
];

export const F13: CreatureDef = {
  id: 'F13', size: 160, box: [-61, -36, 60, 32], art: [-59, -33, 58, 29], frames: 6, fps: 9, facing: 'side', ss: 1.3,
  build(b) {
    const top = '#3f86ba';
    const mid = '#6fb0d8';
    const fin = (box: Box, pts: P[]): Part =>
      b.part({ box, paint: (x) => fillPath(x, pts, linear(x, box[0], box[1], box[0], box[3], [[0, top], [1, mid]])), lit: finLit });
    const fluke = fin([-61, -26, -40, 22], [[-44, -3], [-49, -11], [-55, -21], [-59, -23], [-59, -14], [-55, -5], [-53, 0], [-55, 6], [-59, 15], [-54, 17], [-48, 9], [-44, 3]]);
    const dorsal = fin([-16, -36, 12, -12], [[10, -16], [2, -26], [-8, -33], [-13, -33], [-13, -25], [-12, -14]]);
    b.fadeRoot(dorsal, 0, -10, 0, -19);
    const body = b.part({
      box: [-52, -22, 60, 20],
      paint: (x) => {
        x.beginPath();
        trace(x, dolphinBody);
        x.fillStyle = linear(x, 0, -20, 0, 17, [[0, top], [0.5, mid], [1, '#a7d5ee']]);
        x.fill();
        clipped(x, dolphinBody, () => {
          fillPath(x, [[60, 6], [46, 5.5], [36, 7], [22, 5], [6, 7], [-12, 5], [-30, 3], [-52, 1], [-52, 22], [60, 22]], linear(x, 0, 4, 0, 17, [[0, '#eaf7ff'], [1, '#ffffff']]));
        });
        blush(x, 37, 9, 4.6, 2.8, 'rgba(255,120,150,0.6)');
      },
      bump: (x) => strokePath(x, [[57, 6.5], [46, 8], [34, 6]], 'rgba(30,30,30,0.6)', 1.2),
      lit: { dome: 15, soften: 1.2, tint: COOL, spec: 0.64, gloss: 46, sheen: 0.18, rim: 0.6, line: 1.6, lineDark: 0.62, bumpPx: 1.4 },
    });
    b.over(body, (x) => {
      eye(x, 33, -3, 5.8, { rim: 'rgba(20,48,84,0.85)', iris: '#2f6fa8' });
      smile(x, 33.5, 5.4, 56.5, 6, 3.4, 1.2, 'rgba(24,56,96,0.92)');
    });
    const pec = fin([-8, 7, 20, 30], [[16, 11], [9, 19], [0, 26], [-5, 27], [-4, 18], [2, 10]]);
    b.fadeRoot(pec, 0, 6, 0, 13);
    const all = b.stack([-61, -36, 60, 32], fluke, dorsal, body);
    const o: SwimOpts = { head: 10, tail: -59, amp: 7.5, waves: 0.55, step: 1 };
    return (ctx, phase, v) => {
      swim(ctx, v, all, phase, o);
      blitAt(ctx, pec, 14, 11, Math.sin(TAU * phase) * 0.16, 1, 1, 0, swimDy(14, phase, o));
    };
  },
};

// ---------------------------------------------------------------- F14 Seal

const sealBody: P[] = [
  [53, 3], [52, -6], [46, -14], [36, -19.5], [22, -23], [2, -23], [-16, -18], [-32, -10.5], [-45, -4], [-49, 0], [-45, 4], [-32, 11], [-16, 17.5], [4, 22.5], [24, 23], [40, 18.5], [49, 10.5],
];

export const F14: CreatureDef = {
  id: 'F14', size: 130, box: [-61, -27, 58, 38], art: [-59, -25, 55, 36], frames: 6, fps: 8, facing: 'side', ss: 1.4,
  build(b) {
    const back = '#7b8ca3';
    const side = '#a6b5c7';
    const fin = (box: Box, pts: P[]): Part =>
      b.part({ box, paint: (x) => fillPath(x, pts, linear(x, box[0], box[1], box[2], box[3], [[0, '#8a9ab0'], [1, '#6c7d95']])), lit: finLit });
    const hind = fin([-61, -18, -40, 18], [[-44, -3], [-50, -12], [-57, -16], [-59, -9], [-54, -2], [-59, 5], [-58, 13], [-50, 12], [-44, 3]]);
    const spots: Array<[number, number, number]> = [];
    const rand = makeRng(114);
    for (let i = 0; i < 18; i++) spots.push([-36 + rand() * 70, -19 + rand() * 18, 0.9 + rand() * 1.6]);
    const body = b.part({
      box: [-50, -25, 56, 25],
      paint: (x) => {
        x.beginPath();
        trace(x, sealBody);
        x.fillStyle = linear(x, 0, -23, 0, 22, [[0, back], [0.45, side], [1, '#c7d2de']]);
        x.fill();
        clipped(x, sealBody, () => {
          for (const [px, py, r] of spots) circle(x, px, py, r, 'rgba(70,84,108,0.55)');
          fillPath(x, [[56, 7], [46, 8], [32, 8], [14, 9], [-6, 9], [-24, 6], [-50, 1], [-50, 26], [56, 26]], linear(x, 0, 6, 0, 22, [[0, '#eef3f8'], [1, '#fbfdff']]));
        });
        blush(x, 39, 10, 4.8, 3, 'rgba(255,120,150,0.6)');
      },
      lit: { dome: 15, soften: 1.2, tint: COOL, spec: 0.5, gloss: 34, sheen: 0.14, rim: 0.5, line: 1.5, lineDark: 0.62, bumpPx: 1 },
    });
    b.over(body, (x) => {
      eye(x, 36, -4.5, 7.4, { rim: 'rgba(22,30,50,0.9)', iris: '#2c3f66' });
      ellipse(x, 51.5, 2.2, 2.3, 1.7, 0, '#30384e');
      smile(x, 43.5, 7, 50.5, 5.2, 1.5, 1, 'rgba(36,44,68,0.9)');
      for (const [ey, by] of [[4.2, 2.4], [5.8, 6.4], [7.2, 10]] as const) strokePath(x, [[46, ey], [55, by]], 'rgba(255,255,255,0.8)', 0.5);
    });
    const pec = fin([-8, 11, 24, 38], [[20, 16], [12, 25], [2, 33], [-5, 34], [-4, 24], [5, 15]]);
    b.fadeRoot(pec, 0, 10, 0, 17);
    const all = b.stack([-61, -27, 58, 27], hind, body);
    const o: SwimOpts = { head: 14, tail: -59, amp: 8, waves: 0.5, nod: 1, step: 1 };
    return (ctx, phase, v) => {
      swim(ctx, v, all, phase, o);
      blitAt(ctx, pec, 16, 16, Math.sin(TAU * phase) * 0.22, 1, 1, 0, swimDy(16, phase, o));
    };
  },
};

// ---------------------------------------------------------------- F15 Penguin

const penguinBody: P[] = [
  [45, 0], [43, -8], [36, -15], [24, -19], [8, -20], [-10, -17.5], [-26, -12.5], [-38, -7], [-45, -2.5], [-43, 3], [-32, 10], [-16, 16], [4, 19.5], [24, 18], [37, 12], [44, 6],
];

export const F15: CreatureDef = {
  id: 'F15', size: 90, box: [-60, -24, 60, 34], art: [-58, -22, 58, 31], frames: 6, fps: 10, facing: 'side', ss: 1.7,
  build(b) {
    const navy = '#22344f';
    const steel = '#3a5578';
    const orange = '#ff9a2e';
    const feet = b.part({
      box: [-60, -12, -36, 12],
      paint: (x) => fillPath(x, [[-40, -3], [-50, -8], [-58, -9], [-55, -3], [-58, 1], [-55, 5], [-58, 9], [-50, 7], [-40, 3]], linear(x, -40, 0, -58, 0, [[0, '#f58a24'], [1, '#ffb45a']])),
      lit: { ...finLit, tint: [0.78, 0.36, 0.5] },
    });
    const beak = b.part({
      box: [40, -8, 60, 9],
      paint: (x) => {
        fillPath(x, [[41, -5], [50, -3.5], [58, 0.8], [50, 3], [41, 6]], linear(x, 0, -5, 0, 6, [[0, '#ffc15a'], [1, orange]]));
        strokePath(x, [[43, 1.2], [58, 0.8]], 'rgba(150,70,10,0.7)', 0.7);
      },
      lit: { ...finLit, tint: [0.78, 0.36, 0.5] },
    });
    const body = b.part({
      box: [-46, -22, 47, 22],
      paint: (x) => {
        x.beginPath();
        trace(x, penguinBody);
        x.fillStyle = linear(x, 0, -20, 0, 8, [[0, navy], [1, steel]]);
        x.fill();
        clipped(x, penguinBody, () => {
          fillPath(x, [[50, 4], [40, 3], [30, 5], [14, 3], [-8, 4], [-28, 2], [-48, 0], [-48, 24], [50, 24]], linear(x, 0, 3, 0, 20, [[0, '#ffffff'], [1, '#f3efe2']]));
          ellipse(x, 32, -6, 8.6, 7.6, 0, '#ffffff');
          fillPath(x, [[24, -2], [18, 4.5], [10, 9], [16, 12], [26, 7]], 'rgba(255,190,70,0.75)');
        });
        blush(x, 35, 4, 4, 2.4, 'rgba(255,120,150,0.65)');
      },
      lit: { dome: 15, soften: 1.1, tint: COOL, spec: 0.6, gloss: 44, sheen: 0.18, rim: 0.55, line: 1.4, lineDark: 0.7, bumpPx: 1 },
    });
    b.over(body, (x) => eye(x, 33, -6, 5.4, { rim: 'rgba(14,22,40,0.9)', iris: '#26334f' }));
    const wing = b.part({
      box: [-24, -8, 28, 28],
      paint: (x) => fillPath(x, [[24, -2], [16, -6], [2, 2], [-14, 14], [-21, 23], [-15, 25], [0, 19], [14, 11], [24, 4]], linear(x, 22, 0, -16, 22, [[0, steel], [1, navy]])),
      lit: { ...finLit, line: 1.2 },
    });
    b.fadeRoot(wing, 26, 0, 18, 1);
    const all = b.stack([-60, -24, 60, 24], feet, beak, body);
    const o: SwimOpts = { head: 6, tail: -58, amp: 4.5, waves: 0.5, nod: 1.2, step: 1 };
    return (ctx, phase, v) => {
      swim(ctx, v, all, phase, o);
      blitAt(ctx, wing, 22, 0, Math.sin(TAU * phase) * 0.42 - 0.08, 1, 1, 0, swimDy(22, phase, o));
    };
  },
};

export const VISITORS: CreatureDef[] = [F13, F14, F15, F16];
