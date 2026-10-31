// B01 Golden Whale and B02 Coral Dragon, whose body is a chain of soft-ended segments.

import type { CreatureDef } from './rig';
import { Builder, blush, eye, finPart, smile, swim, swimDy, tube, type S, type SwimOpts } from './rig';
import { COOL, WARM } from './fish';
import {
  TAU,
  blit,
  blitAt,
  circle,
  clamp,
  clipped,
  ellipse,
  fillPath,
  lerp,
  linear,
  makeRng,
  rotatePts,
  strokePath,
  trace,
  warpCols,
  type Ctx,
  type P,
  type Part,
  type Rgb,
} from './paint';

const GOLD_SHADOW: Rgb = [0.86, 0.46, 0.26];

// ---------------------------------------------------------------- B01 Golden Whale

const whaleBody: P[] = [
  [50, 5], [49.5, -8], [43, -19], [30, -26], [12, -28], [-8, -26], [-24, -21], [-36, -16], [-43, -14], [-47, -14], [-47, -9], [-43, -4], [-35, 3], [-24, 11], [-7, 21], [12, 26.5], [30, 25.5], [43, 19], [49.5, 12],
];

function sparkle(x: Ctx, cx: number, cy: number, r: number, a: number): void {
  if (a <= 0.01) return;
  x.save();
  x.translate(cx, cy);
  x.globalAlpha = clamp(a);
  x.fillStyle = '#fffbe0';
  x.beginPath();
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4;
    const q = i % 2 ? r * 0.16 : r;
    x.lineTo(Math.cos(ang) * q, Math.sin(ang) * q);
  }
  x.closePath();
  x.fill();
  x.restore();
}

export const B01: CreatureDef = {
  id: 'B01', size: 600, box: [-62, -44, 56, 46], art: [-56, -36, 52, 40], frames: 6, fps: 6, facing: 'side', ss: 1,
  build(b) {
    const flukeLit = { dome: 7, soften: 0.7, tint: GOLD_SHADOW, spec: 0.5, gloss: 34, sheen: 0.14, line: 2.2, lineDark: 0.66, rimColor: [1, 0.95, 0.7] as Rgb };
    const heart: P[] = rotatePts(
      [[2, -2], [-2, -8], [-7, -15], [-13, -20], [-15, -17], [-14, -10], [-10.5, -3], [-9, 0], [-10.5, 3], [-14, 10], [-15, 17], [-13, 20], [-7, 15], [-2, 8], [2, 2]].map((p) => [p[0]! * 0.86 - 42.5, p[1]! * 1.04 - 11.5] as P),
      -0.3, -42.5, -11.5,
    );
    const fluke = b.part({
      box: [-62, -42, -34, 20],
      paint: (x) => {
        fillPath(x, heart, linear(x, -44, 0, -60, 0, [[0, '#f8ae1e'], [1, '#ffd65a']]));
        clipped(x, heart, () => {
          x.strokeStyle = 'rgba(170,90,0,0.32)';
          x.lineWidth = 0.8;
          x.beginPath();
          for (let i = 0; i < 7; i++) {
            x.moveTo(-46, -12);
            x.lineTo(-62, -40 + i * 10);
          }
          x.stroke();
        });
      },
      lit: flukeLit,
    });
    const dorsal = b.part({
      box: [-30, -32, -8, -16],
      paint: (x) => fillPath(x, [[-11, -22], [-17, -26.5], [-22, -27], [-24, -24], [-25, -17], [-12, -18]], linear(x, 0, -28, 0, -18, [[0, '#ffc53c'], [1, '#f6a820']])),
      lit: flukeLit,
    });
    const grooves: Array<readonly P[]> = [];
    for (let i = 0; i < 7; i++) {
      const front = 45 - i * 1.3;
      const fy = 12.5 + i * 2;
      const rear = -3 + i * 3.4;
      const ry = 15 + i * 1.8;
      grooves.push([[front, fy], [30, fy + 2.8], [14, fy + 3], [rear, ry]]);
    }
    const freckles: Array<[number, number, number]> = [];
    const rand = makeRng(301);
    for (let i = 0; i < 40; i++) {
      freckles.push([lerp(-30, 44, rand()), lerp(-25, 0, rand()), lerp(0.3, 0.8, rand())]);
    }
    const body = b.part({
      box: [-50, -31, 54, 31],
      paint: (x) => {
        x.beginPath();
        trace(x, whaleBody);
        x.fillStyle = linear(x, 0, -28, 0, 27, [[0, '#e88a08'], [0.3, '#fbab14'], [0.55, '#ffc62c'], [0.72, '#ffd868'], [1, '#ffeeb0']]);
        x.fill();
        clipped(x, whaleBody, () => {
          for (const [px, py, r] of freckles) circle(x, px, py, r, 'rgba(255,240,170,0.55)');
          // pale throat that tapers along the belly, with pleats
          fillPath(x, [[56, 9], [42, 10.5], [26, 12], [8, 12], [-8, 13.5], [-18, 15], [-6, 24], [12, 30], [56, 30]], 'rgba(255,246,214,0.82)');
          for (const g of grooves) strokePath(x, g, 'rgba(208,132,30,0.55)', 0.75);
        });
        blush(x, 34, 12.5, 6, 3.6, 'rgba(255,100,70,0.6)');
      },
      bump: (x) => {
        for (const g of grooves) strokePath(x, g, 'rgba(10,10,10,0.75)', 1);
        circle(x, 32, 1.5, 5.8, 'rgba(50,50,50,0.5)');
        strokePath(x, [[50, 8.5], [42, 10.5], [33, 10.5], [26, 8], [22, 4]], 'rgba(30,30,30,0.7)', 1.2);
        circle(x, 24, -26, 2, 'rgba(40,40,40,0.8)');
      },
      lit: { dome: 25, soften: 1.8, tint: GOLD_SHADOW, spec: 0.6, gloss: 30, sheen: 0.16, rim: 0.7, rimColor: [1, 0.92, 0.6], line: 2.2, lineDark: 0.62, bumpPx: 3, shade: 0.8 },
    });
    b.over(body, (x) => {
      eye(x, 32, 1.5, 5.6, { rim: 'rgba(120,60,0,0.85)', iris: '#2f7fd6', look: [0.12, 0.05] });
      strokePath(x, [[50.5, 8.2], [43, 10.2], [34, 10.4], [27, 8.2], [22.5, 4.4]], 'rgba(120,60,0,0.9)', 0.95);
    });
    const pecPts: P[] = [[23, 13], [16, 18], [8, 26], [0, 32], [-5, 32], [-5, 26], [1, 17], [8, 10], [17, 9]];
    const pec = b.part({
      box: [-9, 5, 28, 36],
      paint: (x) => {
        fillPath(x, pecPts, linear(x, 18, 8, -4, 32, [[0, '#ffbc2c'], [1, '#ffdd6e']]));
        clipped(x, pecPts, () => {
          x.strokeStyle = 'rgba(190,110,10,0.34)';
          x.lineWidth = 0.7;
          x.beginPath();
          for (let i = 0; i < 4; i++) {
            x.moveTo(20 - i, 12 + i);
            x.lineTo(-2 + i * 3, 31);
          }
          x.stroke();
        });
      },
      lit: flukeLit,
    });
    b.fadeRoot(pec, 22, 8, 16, 15);
    const glints: ReadonlyArray<readonly [number, number, number, number]> = [
      [14, -24, 4.6, 0], [-14, -18, 3.6, 0.33], [40, -12, 3.4, 0.66], [-30, -12, 2.8, 0.17], [2, -14, 2.4, 0.5],
    ];
    const all = b.stack([-62, -44, 56, 46], fluke, dorsal, body);
    const o: SwimOpts = { head: 4, tail: -60, amp: 8.4, waves: 0.42, fore: 0 };
    return (ctx, phase, v) => {
      swim(ctx, v, all, phase, { ...o, step: 2 });
      blitAt(ctx, pec, 20, 10, Math.sin(TAU * phase) * 0.12, 1, 1, 0, swimDy(20, phase, o));
      for (const [gx, gy, r, ph] of glints) {
        const q = 0.5 + 0.5 * Math.sin(TAU * (phase + ph));
        sparkle(ctx, gx, gy + swimDy(gx, phase, o), r * (0.5 + q * 0.6), q * q * 1.1);
      }
    };
  },
};

// ---------------------------------------------------------------- B02 Coral Dragon

const LEAF_A = '#1fb8a0';
const LEAF_B = '#7ce8c0';
const SKIN_TOP = '#ff5a4e';
const SKIN_MID = '#ff8058';
const SKIN_PALE = '#ffe6b0';

function leaf(x: Ctx, ax: number, ay: number, ang: number, len: number, w: number): void {
  const pts: P[] = [];
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const shape: ReadonlyArray<readonly [number, number]> = [[0, -0.2], [0.3, -0.75], [0.46, -0.45], [0.66, -0.68], [0.8, -0.34], [1, 0], [0.8, 0.34], [0.66, 0.68], [0.46, 0.45], [0.3, 0.75], [0, 0.2]];
  for (const [u, v] of shape) {
    const lx = u * len;
    const ly = v * w;
    pts.push([ax + lx * c - ly * s, ay + lx * s + ly * c]);
  }
  fillPath(x, pts, linear(x, ax, ay, ax + c * len, ay + s * len, [[0, LEAF_A], [1, LEAF_B]]));
  x.strokeStyle = 'rgba(4,90,90,0.45)';
  x.lineWidth = Math.max(0.5, w * 0.06);
  x.lineCap = 'round';
  x.beginPath();
  x.moveTo(ax, ay);
  x.lineTo(ax + c * len * 0.92, ay + s * len * 0.92);
  x.stroke();
}

function coralBranch(x: Ctx, ax: number, ay: number, ang: number, len: number, w: number, depth: number, rand: () => number): void {
  const bx = ax + Math.cos(ang) * len;
  const by = ay + Math.sin(ang) * len;
  fillPath(x, tube([[ax, ay, w], [(ax + bx) / 2, (ay + by) / 2, w * 0.85], [bx, by, w * 0.75]], 2), linear(x, ax, ay, bx, by, [[0, '#ff7fa0'], [1, '#ffc4d4']]));
  if (depth <= 0) {
    circle(x, bx, by, w * 0.86, '#ffd6e0');
    return;
  }
  coralBranch(x, bx, by, ang - 0.46 - rand() * 0.2, len * 0.72, w * 0.76, depth - 1, rand);
  coralBranch(x, bx, by, ang + 0.42 + rand() * 0.2, len * 0.66, w * 0.76, depth - 1, rand);
}

const leafLit = { dome: 3, soften: 0.4, spec: 0.42, gloss: 28, sheen: 0.1, shade: 0.5, rim: 0.3, tint: COOL, line: 1, lineDark: 0.62 };

const dragonHead: P[] = [
  [52, 7], [51, -3], [45, -8.5], [36, -10], [29, -15], [20, -25], [0, -33], [-20, -31], [-33, -18], [-38, -2], [-34, 15], [-22, 28], [-4, 33], [14, 30], [30, 25], [44, 21], [51, 15],
];

export const B02: CreatureDef = {
  id: 'B02', size: 200, box: [-64, -74, 62, 58], art: [-56, -70, 56, 54], frames: 6, fps: 7, facing: 'side', ss: 1.05,
  build(b) {
    const horns = b.part({
      box: [-52, -74, 22, -14],
      paint: (x) => {
        const r = makeRng(12);
        coralBranch(x, 2, -28, -1.75, 16, 4.6, 2, r);
        coralBranch(x, -18, -26, -2.2, 15, 4.2, 2, r);
      },
      lit: { dome: 3.4, soften: 0.3, tint: WARM, spec: 0.5, gloss: 30, line: 1, lineDark: 0.6 },
    });
    const crest = finPart(b, [-44, -48, 20, -14], {
      rim: [[14, -27], [6, -37], [-3, -35], [-11, -42], [-19, -38], [-27, -39], [-32, -29], [-40, -28], [-38, -12]],
      base: [[12, -24], [-6, -28], [-22, -24], [-34, -14]],
      rays: 11, root: LEAF_A, tip: LEAF_B, ray: 'rgba(4,90,90,0.5)', tipAlpha: 0.96,
    });
    const frills = b.part({
      box: [-66, -32, -12, 56],
      paint: (x) => {
        leaf(x, -28, -14, 3.5, 32, 11);
        leaf(x, -30, 3, 3.0, 31, 11);
        leaf(x, -26, 18, 2.6, 30, 11);
        leaf(x, -16, 26, 2.1, 26, 10);
      },
      lit: leafLit,
    });
    const chin = b.part({
      box: [14, 12, 46, 54],
      paint: (x) => {
        leaf(x, 32, 22, 1.7, 24, 8);
        leaf(x, 23, 24, 2.05, 22, 8);
      },
      lit: leafLit,
    });
    const head = b.part({
      box: [-42, -37, 56, 37],
      paint: (x) => {
        x.beginPath();
        trace(x, dragonHead);
        x.fillStyle = linear(x, 0, -33, 0, 33, [[0, SKIN_TOP], [0.5, SKIN_MID], [0.72, '#ffc48a'], [1, SKIN_PALE]]);
        x.fill();
        clipped(x, dragonHead, () => {
          // pale muzzle and jaw
          fillPath(x, [[60, 8], [46, 5.5], [34, 7], [22, 10], [10, 20], [6, 36], [60, 36]], 'rgba(255,232,190,0.9)');
          for (const [px, py, r] of [[-12, -22, 3.8], [-25, -8, 3.2], [-4, -10, 2.4], [-28, 9, 2.6], [-14, 5, 2.2], [-6, 17, 2]] as const) circle(x, px, py, r, 'rgba(255,214,120,0.85)');
        });
        blush(x, 30, 15, 7, 4.6, 'rgba(255,60,100,0.6)');
      },
      bump: (x) => {
        circle(x, 15, -9, 12.5, 'rgba(50,50,50,0.5)');
        circle(x, 45, -3, 4, 'rgba(255,255,255,0.8)');
        circle(x, 45, -3, 1.5, 'rgba(10,10,10,0.9)');
        strokePath(x, [[3, -19], [14, -24], [26, -18]], 'rgba(255,255,255,0.8)', 3.4);
        for (const [px, py, r] of [[-12, -22, 3.8], [-25, -8, 3.2], [-4, -10, 2.4]] as const) circle(x, px, py, r, 'rgba(255,255,255,0.7)');
      },
      lit: { dome: 27, soften: 1.8, tint: WARM, spec: 0.56, gloss: 44, sheen: 0.16, rim: 0.65, rimColor: [1, 0.9, 0.8], line: 1.5, lineDark: 0.72, bumpPx: 2 },
    });
    b.over(head, (x) => {
      eye(x, 15, -9, 12, { rim: 'rgba(130,20,30,0.85)', iris: '#17a79a' });
      smile(x, 21, 9.5, 52, 10, 7.5, 2.1, 'rgba(110,16,30,0.9)');
      smile(x, 19, 6, 22, 11.4, 1.8, 1.8, 'rgba(110,16,30,0.75)');
      ellipse(x, 45.5, -3, 1.5, 1.1, 0.4, 'rgba(110,16,30,0.85)');
    });
    return (ctx, phase) => {
      const t = Math.sin(TAU * phase);
      const c = Math.cos(TAU * phase);
      blitAt(ctx, frills, -24, 8, t * 0.08, 1, 1);
      blitAt(ctx, chin, 28, 21, c * 0.14, 1, 1);
      blit(ctx, horns);
      blitAt(ctx, crest, -10, -22, t * 0.025, 1, 1 + c * 0.05);
      blit(ctx, head);
      for (const [y0, sign, w] of [[-5.5, -1, 1.7], [-1, 1, 1.9]] as const) {
        const pts: P[] = [];
        for (let i = 0; i <= 8; i++) {
          const q = i / 8;
          pts.push([46.5 + q * 11 - q * q * 26, y0 + sign * q * 14 + Math.sin(TAU * (phase - q * 0.8)) * q * 4]);
        }
        strokePath(ctx, pts, '#ffe0a8', w);
      }
    };
  },
};

// One scale row every 66 u of chain, so the pattern carries across neighbouring segments.
const SCALE_PITCH = 41.25 / 3;

/** Paints the tube skin, cut with soft ends so overlapping neighbours melt into one long body. */
function tubeSkin(b: Builder, halfY: number, fade0: number, fade1: number): Part {
  const left = -SCALE_PITCH * 6;
  const right = -left;
  const scales = (x: Ctx, stroke: string, width: number): void => {
    x.strokeStyle = stroke;
    x.lineWidth = width;
    x.lineCap = 'round';
    x.beginPath();
    for (let i = -6; i <= 6; i++) {
      for (let j = -3; j <= 3; j++) {
        const px = i * SCALE_PITCH + (j & 1 ? SCALE_PITCH / 2 : 0);
        const py = j * 9.6;
        x.moveTo(px + 1, py - 6);
        x.quadraticCurveTo(px - 8, py, px + 1, py + 6);
      }
    }
    x.stroke();
  };
  const part = b.part({
    box: [left - 6, -halfY - 2, right + 6, halfY + 2],
    paint: (x) => {
      x.fillStyle = linear(x, 0, -halfY, 0, halfY, [[0, '#ffc088'], [0.22, SKIN_MID], [0.5, SKIN_TOP], [0.78, SKIN_MID], [1, '#ffc088']]);
      x.fillRect(left - 6, -halfY, right - left + 12, halfY * 2);
      scales(x, 'rgba(170,30,30,0.3)', 1);
      for (let i = -6; i <= 6; i++) {
        const px = i * SCALE_PITCH;
        ellipse(x, px, 0, 4.2, 3.4, 0, '#ffd47a');
      }
    },
    bump: (x) => {
      scales(x, 'rgba(255,255,255,0.55)', 1.5);
      for (let i = -6; i <= 6; i++) ellipse(x, i * SCALE_PITCH, 0, 4.2, 3.4, 0, 'rgba(255,255,255,0.9)');
    },
    lit: { dome: halfY, soften: 0.8, light: [0.02, -0.34, 0.94], tint: WARM, spec: 0.32, gloss: 30, sheen: 0.1, rim: 0.42, rimColor: [1, 0.9, 0.8], line: 1.6, lineDark: 0.74, bumpPx: 0.9 },
  });
  b.over(part, (x) => {
    x.globalCompositeOperation = 'destination-out';
    for (const s of [-1, 1]) {
      x.fillStyle = linear(x, s * fade0, 0, s * fade1, 0, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
      x.fillRect(s < 0 ? part.x : fade0, part.y, -part.x - fade0, part.h);
    }
  });
  return part;
}

export const B02_segment: CreatureDef = {
  id: 'B02_segment', size: 160, box: [-52, -56, 52, 56], frames: 6, fps: 7, facing: 'top', ss: 1,
  build(b) {
    const fronds = [-1, 1].map((s) =>
      b.part({
        box: s < 0 ? [-30, -56, 30, -22] : [-30, 22, 30, 56],
        paint: (x) => {
          leaf(x, 13, s * 29, s * 2.05, 25, 8.5);
          leaf(x, 0, s * 29, s * 1.57, 26, 9.5);
          leaf(x, -13, s * 29, s * 1.09, 25, 8.5);
        },
        lit: leafLit,
      }),
    );
    const skin = tubeSkin(b, 35, 20, 40);
    return (ctx, phase) => {
      const t = Math.sin(TAU * phase);
      blitAt(ctx, fronds[0]!, 0, -30, t * 0.14, 1, 1);
      blitAt(ctx, fronds[1]!, 0, 30, -t * 0.14, 1, 1);
      blit(ctx, skin);
    };
  },
};

export const B02_tail: CreatureDef = {
  id: 'B02_tail', size: 200, box: [-60, -46, 30, 46], art: [-54, -42, 26, 42], frames: 6, fps: 7, facing: 'top', ss: 1.05,
  build(b) {
    const fan = b.part({
      box: [-60, -46, -14, 46],
      paint: (x) => {
        leaf(x, -20, -3, 3.75, 36, 12);
        leaf(x, -22, 0, 3.14, 38, 14);
        leaf(x, -20, 3, 2.53, 36, 12);
      },
      lit: leafLit,
    });
    const spine: S[] = [[60, 0, 28], [30, 0, 28], [14, 0, 26], [0, 0, 20], [-14, 0, 12], [-24, 0, 5]];
    const out = tube(spine, 4);
    const body = b.part({
      box: [-30, -30, 64, 30],
      paint: (x) => {
        x.beginPath();
        trace(x, out);
        x.fillStyle = linear(x, 0, -28, 0, 28, [[0, '#ffc088'], [0.22, SKIN_MID], [0.5, SKIN_TOP], [0.78, SKIN_MID], [1, '#ffc088']]);
        x.fill();
        for (const [px, r] of [[22, 3.4], [11, 3], [0, 2.6], [-11, 2]] as const) ellipse(x, px, 0, r * 1.2, r, 0, '#ffd47a');
      },
      lit: { dome: 24, soften: 1, light: [0.02, -0.34, 0.94], tint: WARM, spec: 0.32, gloss: 30, sheen: 0.1, rim: 0.42, rimColor: [1, 0.9, 0.8], line: 1.6, lineDark: 0.74 },
    });
    b.over(body, (x) => {
      x.globalCompositeOperation = 'destination-out';
      x.fillStyle = linear(x, 8, 0, 29, 0, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,1)']]);
      x.fillRect(8, -32, 60, 64);
    });
    return (ctx, phase, v) => {
      const f = (px: number): number => Math.sin(TAU * phase + px * 0.05) * clamp((-px + 8) / 60) ** 1.4 * 7;
      warpCols(ctx, v, fan, f, null, null, 1);
      warpCols(ctx, v, body, f, null, null, 1);
    };
  },
};

/** The whole Coral Dragon in an S curve, for the Fish Book. `long` is the width to fill, in px. */
export interface DragonPiece {
  def: CreatureDef;
  x: number;
  y: number;
  rot: number;
}

/** The dragon laid out in a gentle wave, tail first, in design units. The chain spacing matches the game's. */
export function dragonPieces(): DragonPiece[] {
  const at = (i: number): [number, number, number] => {
    const u = i * 66;
    const wave = (q: number): number => Math.sin(q / 118) * 46;
    return [-u, wave(u), Math.atan2(wave(u - 4) - wave(u), 4)];
  };
  const out: DragonPiece[] = [];
  for (let i = 8; i >= 0; i--) {
    const [x, y, rot] = at(i);
    out.push({ def: i === 8 ? B02_tail : i === 0 ? B02 : B02_segment, x, y, rot });
  }
  return out;
}

export const BOSSES: CreatureDef[] = [B01, B02, B02_segment, B02_tail];

