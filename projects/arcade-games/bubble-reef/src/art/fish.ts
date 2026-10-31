// F01-F12, plus the pufferfish and jellyfish rigs the specials reuse. Each species is authored in a -50..50 box.

import type { CreatureDef, FramePainter } from './rig';
import { Builder, blush, eye, finPart, sampleSpine, smile, swim, swimDy, tube, type Box, type FinSpec, type S, type SwimOpts } from './rig';
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
  line,
  linear,
  makeRng,
  mirrorY,
  mix,
  radial,
  strokePath,
  trace,
  warpCols,
  warpRows,
  type Ctx,
  type P,
  type Part,
  type Rgb,
} from './paint';

export const WARM: Rgb = [0.78, 0.36, 0.5];
export const COOL: Rgb = [0.4, 0.5, 0.86];
export const TOP_LIGHT: Rgb = [0.03, -0.32, 0.95];

// ---------------------------------------------------------------- F01 Clownfish

const clownBody: P[] = [
  [50, 5], [47, -7], [38, -17], [24, -24], [6, -26], [-10, -22], [-22, -13], [-30, -7], [-33, 0], [-30, 7],
  [-22, 12], [-10, 19], [6, 24], [24, 24], [38, 20], [47, 13],
];
const clownInk = '#2a1712';

function clownFin(rim: P[], base: P[], rays: number): FinSpec {
  return {
    rim, base, rays, root: '#ff9426', tip: '#ff7a14', ray: 'rgba(190,60,0,0.45)',
    extra: (x) => strokePath(x, rim, clownInk, 4.6),
  };
}

export const F01: CreatureDef = {
  id: 'F01', size: 60, box: [-58, -46, 56, 46], art: [-54, -38, 52, 36], frames: 8, fps: 12, facing: 'side', ss: 1.7,
  build(b) {
    const fins = [
      finPart(b, [-58, -28, -18, 28], clownFin(
        [[-30, -9], [-42, -21], [-51, -17], [-54, 0], [-51, 17], [-42, 21], [-30, 9]], [[-24, -7], [-24, 0], [-24, 7]], 7)),
      finPart(b, [-32, -42, 34, -2], clownFin(
        [[29, -19], [21, -31], [9, -37], [-3, -34], [-8, -28], [-15, -32], [-23, -25], [-27, -10]], [[26, -16], [8, -18], [-10, -14], [-24, -7]], 8)),
      finPart(b, [-30, 4, 8, 38], clownFin(
        [[2, 19], [-4, 30], [-14, 33], [-21, 28], [-25, 10]], [[0, 16], [-12, 13], [-22, 8]], 5)),
      finPart(b, [0, 10, 30, 38], clownFin(
        [[24, 20], [20, 31], [10, 35], [4, 23]], [[22, 18], [14, 18], [8, 19]], 4)),
    ];
    const body = b.part({
      box: [-36, -28, 54, 28],
      paint: (x) => {
        x.beginPath();
        trace(x, clownBody);
        x.fillStyle = linear(x, 0, -24, 0, 24, [[0, '#ff7a14'], [0.55, '#ff9426'], [1, '#ffc060']]);
        x.fill();
        clipped(x, clownBody, () => {
          const band = (pts: P[]): void => {
            x.beginPath();
            trace(x, pts);
            x.fillStyle = clownInk;
            x.fill();
            x.lineWidth = 2;
            x.strokeStyle = clownInk;
            x.stroke();
            x.fillStyle = linear(x, 0, -24, 0, 24, [[0, '#ffffff'], [1, '#eef2ff']]);
            x.fill();
          };
          band([[26, -30], [20, -14], [18, 0], [20, 14], [25, 30], [15, 30], [10, 12], [8, 0], [10, -14], [16, -30]]);
          band([[-3, -30], [-7, -12], [0, 0], [-7, 12], [-5, 30], [-17, 30], [-17, 10], [-11, 0], [-17, -12], [-15, -30]]);
          band([[-22, -14], [-24, 0], [-22, 14], [-28, 14], [-30, 0], [-28, -14]]);
        });
        blush(x, 33, 9, 7, 5, 'rgba(255,70,70,0.55)');
      },
      bump: (x) => {
        circle(x, 34, -8, 11, 'rgba(50,50,50,0.5)');
      },
      lit: { dome: 25, soften: 2, tint: WARM, spec: 0.6, line: 1.1, lineDark: 0.8, bumpPx: 0.7 },
    });
    b.over(body, (x) => {
      eye(x, 34, -8, 9.8, { rim: 'rgba(120,40,0,0.8)' });
      smile(x, 38, 8, 49, 6, 3.2, 2);
    });
    const pec = finPart(b, [-8, -2, 22, 26], clownFin(
      [[12, 2], [3, 8], [-3, 16], [4, 22], [14, 16], [18, 7]], [[12, 2], [15, 3], [18, 7]], 4));
    const all = b.stack([-58, -46, 56, 46], ...fins, body);
    const o: SwimOpts = { head: 24, tail: -54, amp: 7.5, waves: 0.8, fore: 0.16, foreFrom: -28 };
    return (ctx, phase, v) => {
      swim(ctx, v, all, phase, o);
      blitAt(ctx, pec, 13, 3, 0.1 + Math.sin(TAU * phase) * 0.34, 1, 1, 0, swimDy(13, phase, o));
    };
  },
};

// ---------------------------------------------------------------- F02 Blue Tang

const tangBody: P[] = [
  [50, 3], [47, -8], [36, -22], [20, -30], [2, -31], [-13, -26], [-24, -16], [-31, -7], [-34, 0], [-31, 7], [-24, 15],
  [-13, 24], [2, 29], [20, 28], [36, 21], [47, 11],
];

export const F02: CreatureDef = {
  id: 'F02', size: 70, box: [-58, -46, 56, 44], art: [-53, -40, 52, 39], frames: 8, fps: 12, facing: 'side', ss: 1.7,
  build(b) {
    const ink = '#101a44';
    const blueFin = (rim: P[], base: P[], rays: number): FinSpec => ({
      rim, base, rays, root: '#1f62e8', tip: '#3f9bff', ray: 'rgba(8,30,120,0.5)', tipAlpha: 0.92,
      extra: (x) => strokePath(x, rim, ink, 3.6),
    });
    const fins = [
      finPart(b, [-58, -28, -20, 28], {
        rim: [[-31, -8], [-45, -24], [-53, -24], [-49, -8], [-47, 0], [-49, 8], [-53, 24], [-45, 24], [-31, 8]],
        base: [[-27, -6], [-27, 0], [-27, 6]],
        rays: 6, root: '#ffd21f', tip: '#ffe74f', ray: 'rgba(190,120,0,0.5)',
        extra: (x) => {
          strokePath(x, [[-31, -10], [-45, -25], [-53, -25]], ink, 4.5);
          strokePath(x, [[-31, 10], [-45, 25], [-53, 25]], ink, 4.5);
        },
      }),
      finPart(b, [-30, -44, 40, -8], blueFin(
        [[34, -22], [22, -35], [6, -39], [-10, -37], [-22, -30], [-29, -10]], [[32, -20], [10, -22], [-10, -18], [-26, -8]], 11)),
      finPart(b, [-30, 8, 34, 42], blueFin(
        [[24, 25], [14, 35], [0, 38], [-12, 35], [-22, 28], [-29, 9]], [[22, 23], [4, 22], [-12, 16], [-26, 8]], 10)),
    ];
    const body = b.part({
      box: [-36, -34, 54, 32],
      paint: (x) => {
        x.beginPath();
        trace(x, tangBody);
        x.fillStyle = linear(x, 0, -30, 0, 30, [[0, '#1650e0'], [0.5, '#1e78ff'], [1, '#5cc0ff']]);
        x.fill();
        clipped(x, tangBody, () => {
          fillPath(x, [
            [35, -17], [24, -27], [6, -27], [-12, -23], [-24, -13], [-34, -3], [-34, 2], [-24, 1], [-13, 5], [2, 7], [16, 5], [27, 1], [33, -6],
          ], ink);
          ellipse(x, 3, -10, 15.5, 6.8, -0.04, linear(x, 0, -17, 0, -3, [[0, '#1b5eea'], [1, '#2a8bff']]));
          // yellow tab where the tail starts
          fillPath(x, [[-27, -6], [-36, -7], [-36, 7], [-27, 6], [-25, 0]], '#ffd21f');
        });
        blush(x, 34, 11, 7, 5, 'rgba(255,120,190,0.5)');
      },
      bump: (x) => {
        circle(x, 34, -7, 11, 'rgba(50,50,50,0.5)');
      },
      lit: { dome: 26, soften: 2, tint: COOL, spec: 0.46, sheen: 0.1, line: 1.1, lineDark: 0.85, bumpPx: 0.7 },
    });
    b.over(body, (x) => {
      eye(x, 34, -7, 10, { rim: 'rgba(6,14,70,0.85)', iris: '#2f8f7a' });
      smile(x, 39, 9, 49.5, 6.5, 3.2, 2, 'rgba(6,14,60,0.9)');
    });
    const pec = finPart(b, [-12, -6, 24, 26], {
      rim: [[12, 3], [2, 6], [-8, 14], [-6, 20], [6, 20], [15, 12], [18, 6]], base: [[12, 3], [15, 4], [18, 6]],
      rays: 4, root: '#ffd21f', tip: '#ffe874', ray: 'rgba(180,110,0,0.5)', tipAlpha: 0.95,
    });
    const all = b.stack([-58, -46, 56, 44], ...fins, body);
    const o: SwimOpts = { head: 22, tail: -53, amp: 7, waves: 0.8, fore: 0.16, foreFrom: -30 };
    return (ctx, phase, v) => {
      swim(ctx, v, all, phase, o);
      blitAt(ctx, pec, 13, 4, 0.05 + Math.sin(TAU * phase + 1) * 0.34, 1, 1, 0, swimDy(13, phase, o));
    };
  },
};

// ---------------------------------------------------------------- F03 Butterflyfish

const flyBody: P[] = [
  [51, 4], [48, -1.5], [39, -12], [24, -25], [4, -32], [-14, -29], [-26, -19], [-32, -8], [-34, 0], [-32, 8], [-26, 17],
  [-14, 28], [4, 31], [24, 25], [39, 14], [48, 9],
];

export const F03: CreatureDef = {
  id: 'F03', size: 70, box: [-58, -50, 58, 48], art: [-52, -46, 53, 43], frames: 8, fps: 10, facing: 'side', ss: 1.7,
  build(b) {
    const finY = (rim: P[], base: P[], rays: number, extra?: (x: Ctx) => void): FinSpec => ({
      rim, base, rays, root: '#ffd21a', tip: '#ffe95a', ray: 'rgba(200,120,0,0.42)', tipAlpha: 0.94, extra: (x) => {
        strokePath(x, rim, '#ff9f1c', 3);
        extra?.(x);
      },
    });
    const fins = [
      finPart(b, [-56, -24, -22, 24], finY(
        [[-30, -9], [-41, -16], [-50, -13], [-52, 0], [-50, 13], [-41, 16], [-30, 9]], [[-27, -6], [-27, 0], [-27, 6]], 7)),
      finPart(b, [-40, -50, 34, -10], finY(
        [[26, -24], [12, -36], [-6, -38], [-20, -37], [-34, -45], [-30, -33], [-31, -10]], [[24, -22], [4, -26], [-14, -23], [-28, -9]], 11)),
      finPart(b, [-36, 8, 28, 46], finY(
        [[18, 27], [8, 36], [-8, 38], [-22, 35], [-30, 26], [-31, 9]], [[16, 25], [0, 26], [-14, 21], [-28, 9]], 9)),
    ];
    const body = b.part({
      box: [-36, -36, 56, 34],
      paint: (x) => {
        x.beginPath();
        trace(x, flyBody);
        x.fillStyle = linear(x, 44, 0, -32, 0, [[0, '#fff7e0'], [0.3, '#fffbe9'], [0.62, '#ffe34d'], [1, '#ffc414']]);
        x.fill();
        clipped(x, flyBody, () => {
          x.strokeStyle = 'rgba(70,60,120,0.75)';
          x.lineCap = 'round';
          x.lineWidth = 1.7;
          x.beginPath();
          for (let i = 0; i < 6; i++) {
            const ox = 16 - i * 8;
            x.moveTo(ox + 12, -32);
            x.quadraticCurveTo(ox - 3, -8, ox + 4, 2);
            x.moveTo(ox + 4, 2);
            x.quadraticCurveTo(ox + 1, 16, ox + 14, 32);
          }
          x.stroke();
          // The band runs behind the eye so the real eye stays on the pale face, and the eyespot stays a plain dot.
          fillPath(x, [[29, -26], [23, -8], [20, 4], [22, 32], [11, 32], [10, 4], [12, -10], [16, -30]], '#1a1a3a');
          circle(x, -22, -9, 4.4, '#2c2c58');
          // warm nose
          fillPath(x, [[56, 3], [45, -9], [39, -2], [39, 9], [45, 14]], linear(x, 39, 0, 52, 0, [[0, 'rgba(255,200,90,0)'], [0.4, '#ffc84f'], [1, '#ffb33c']]));
        });
        blush(x, 38, 11, 5.5, 4, 'rgba(255,90,110,0.45)');
      },
      bump: (x) => {
        circle(x, 28, -6, 11.9, 'rgba(50,50,50,0.5)');
      },
      lit: { dome: 25, soften: 2, tint: WARM, spec: 0.58, line: 1.1, lineDark: 0.72, bumpPx: 0.7 },
    });
    b.over(body, (x) => {
      eye(x, 28, -6, 10.6, { rim: 'rgba(10,10,40,0.95)', iris: '#7a4a14' });
      smile(x, 41, 8, 51, 5.5, 2.6, 1.9);
    });
    const pec = finPart(b, [-12, -6, 22, 24], {
      rim: [[10, 2], [-2, 4], [-9, 11], [-5, 18], [6, 17], [14, 10], [15, 5]], base: [[10, 2], [13, 3], [15, 5]],
      rays: 4, root: '#ffe66a', tip: '#fff4b0', ray: 'rgba(200,130,0,0.45)', tipAlpha: 0.9,
    });
    const all = b.stack([-58, -50, 58, 48], ...fins, body);
    const o: SwimOpts = { head: 18, tail: -52, amp: 6, waves: 0.75, fore: 0.14, foreFrom: -30 };
    return (ctx, phase, v) => {
      swim(ctx, v, all, phase, o);
      blitAt(ctx, pec, 11, 3, 0.05 + Math.sin(TAU * phase + 2) * 0.3, 1, 1, 0, swimDy(11, phase, o));
    };
  },
};

// ---------------------------------------------------------------- F04 Seahorse (upright)

const horseSpine: S[] = [
  [1, -30, 13], [-8, -19, 10.5], [-10, -7, 13.5], [-6, 7, 15.5], [-6, 19, 12], [-10, 30, 9], [-9, 40, 6.8], [-1, 46, 5.4], [7, 43.5, 4.4], [9.5, 37, 3.6], [5, 33, 2.8],
];

function ringLines(x: Ctx, width: number, color: string): void {
  const s = sampleSpine(horseSpine, 5);
  x.strokeStyle = color;
  x.lineWidth = width;
  x.lineCap = 'round';
  x.beginPath();
  for (let i = 8; i < s.length - 7; i += 2) {
    const p = s[i]!;
    const q = s[i + 1]!;
    const ang = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2;
    x.moveTo(p[0] + Math.cos(ang) * p[2], p[1] + Math.sin(ang) * p[2]);
    x.lineTo(p[0] - Math.cos(ang) * p[2], p[1] - Math.sin(ang) * p[2]);
  }
  x.stroke();
}

export const F04: CreatureDef = {
  id: 'F04', size: 70, box: [-42, -58, 44, 56], art: [-36, -52, 38, 50], frames: 8, fps: 9, facing: 'upright', ss: 1.7,
  build(b) {
    const outline = tube(horseSpine, 5);
    const snout: P[] = [[6, -43], [16, -41], [25, -40.5], [33, -41], [37, -37], [35, -31], [26, -30], [15, -26], [6, -21]];
    const crown: P[] = [[-13, -40], [-14, -50], [-9, -46], [-5, -54], [-1, -47], [5, -54], [8, -46], [13, -49], [11, -38]];
    const dorsalPart = finPart(b, [-42, -22, -10, 24], {
      rim: [[-17, -16], [-29, -18], [-37, -8], [-38, 6], [-30, 18], [-18, 20]], base: [[-15, -16], [-19, 2], [-15, 20]],
      rays: 8, root: '#ff8a3c', tip: '#ffc27a', ray: 'rgba(170,50,20,0.5)', tipAlpha: 0.92,
    });
    const pecPart = finPart(b, [-6, -28, 22, -4], {
      rim: [[2, -19], [11, -26], [18, -19], [14, -9], [4, -9]], base: [[2, -19], [1, -14], [4, -9]],
      rays: 4, root: '#ffb04a', tip: '#ffd98a', ray: 'rgba(170,70,20,0.5)', tipAlpha: 0.9,
    });
    const body = b.part({
      box: [-30, -56, 42, 54],
      paint: (x) => {
        const g = linear(x, -24, 0, 14, 0, [[0, '#ff8a1e'], [0.5, '#ffb320'], [1, '#ffe46a']]);
        fillPath(x, crown, '#ff7a3c');
        fillPath(x, outline, g);
        fillPath(x, snout, linear(x, 0, -43, 0, -26, [[0, '#ffa22a'], [1, '#ffdc6a']]));
        ellipse(x, 0, -34, 15, 13.5, 0, g);
        ringLines(x, 1.6, 'rgba(200,80,10,0.55)');
        fillPath(x, tube([[4, -16, 2.4], [8, -6, 6.6], [9, 7, 7.6], [5, 19, 3.6], [0, 26, 1]], 5), 'rgba(255,244,170,0.8)');
        blush(x, 13, -28, 6.4, 4.8, 'rgba(255,70,90,0.6)');
      },
      bump: (x) => {
        ringLines(x, 1.8, 'rgba(40,40,40,0.6)');
        circle(x, 5, -36, 10.5, 'rgba(50,50,50,0.5)');
      },
      lit: { dome: 13, soften: 1, tint: WARM, spec: 0.55, gloss: 34, line: 1.1, lineDark: 0.75, bumpPx: 0.8 },
    });
    b.over(body, (x) => {
      eye(x, 5, -36, 9.8, { rim: 'rgba(130,50,0,0.8)' });
      smile(x, 26, -32.5, 36.5, -35, 1.8, 1.8);
    });
    return (ctx, phase, v) => {
      const sway = (y: number): number => Math.sin(TAU * phase - (y + 50) * 0.03) * clamp((y + 10) / 60) * 3.6 + Math.sin(TAU * phase + 1) * 0.7;
      const flutter = Math.sin(TAU * phase * 2);
      blitAt(ctx, dorsalPart, -16, 2, 0, 1 + flutter * 0.1, 1, sway(2), 0);
      warpRows(ctx, v, body, sway);
      blitAt(ctx, pecPart, 2, -14, flutter * 0.32 + 0.1, 1, 1, sway(-14), 0);
    };
  },
};

// ---------------------------------------------------------------- F05 Pufferfish and its specials sibling

export interface PufferColors {
  top: string;
  mid: string;
  belly: string;
  spot: string;
  fin: string;
  finTip: string;
  ray: string;
  rim: string;
  iris: string;
  /** Spot shape: dots or little stars. */
  stars?: boolean;
  tint: Rgb;
}

export const PUFFER: PufferColors = {
  top: '#c9a23a', mid: '#f0cc58', belly: '#fff8e4', spot: '#7a5a22', fin: '#ffb83c', finTip: '#ffdc7a', ray: 'rgba(160,80,10,0.5)',
  rim: 'rgba(110,70,10,0.8)', iris: '#3c8a66', tint: WARM,
};

function star(x: Ctx, cx: number, cy: number, r: number, color: string): void {
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const q = i % 2 ? r * 0.5 : r;
    x.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q);
  }
  x.closePath();
  x.fillStyle = color;
  x.fill();
  x.lineWidth = r * 0.3;
  x.lineJoin = 'round';
  x.strokeStyle = color;
  x.stroke();
}

const pufferSpots: ReadonlyArray<readonly [number, number, number]> = [
  [-12, -24, 5.5], [4, -29, 4], [-27, -16, 4.2], [-16, -9, 3.6], [18, -24, 3.2], [-2, -15, 3], [-31, -3, 2.8], [8, -17, 2.2],
];

export function pufferRig(b: Builder, c: PufferColors): FramePainter {
  const body0: P[] = [[50, 8], [46, -8], [36, -23], [18, -32], [-2, -34], [-20, -30], [-33, -19], [-39, -7], [-41, 0], [-39, 9], [-32, 22], [-18, 31], [0, 34], [20, 32], [36, 24], [46, 16]];
  const fin = (rim: P[], base: P[], rays: number): FinSpec => ({ rim, base, rays, root: c.fin, tip: c.finTip, ray: c.ray, tipAlpha: 0.92 });
  const fins = [
    finPart(b, [-56, -18, -30, 18], fin([[-36, -6], [-46, -13], [-53, -9], [-54, 0], [-53, 9], [-46, 13], [-36, 6]], [[-33, -4], [-33, 0], [-33, 4]], 5)),
    finPart(b, [-30, -44, 0, -20], fin([[-4, -28], [-10, -40], [-20, -41], [-27, -24]], [[-5, -27], [-14, -27], [-24, -22]], 5)),
    finPart(b, [-28, 22, 2, 44], fin([[-3, 30], [-10, 40], [-20, 40], [-26, 22]], [[-4, 28], [-14, 27], [-24, 20]], 5)),
  ];
  const nubs: Array<[number, number]> = [];
  const rand = makeRng(5);
  for (let i = 0; i < 26; i++) nubs.push([lerp(-30, 34, rand()), lerp(6, 32, rand())]);
  const body = b.part({
    box: [-44, -38, 54, 38],
    paint: (x) => {
      x.beginPath();
      trace(x, body0);
      x.fillStyle = linear(x, 0, -34, 0, 34, [[0, c.top], [0.42, c.mid], [0.62, c.belly], [1, c.belly]]);
      x.fill();
      clipped(x, body0, () => {
        for (const [px, py, r] of pufferSpots) {
          if (c.stars) star(x, px, py, r * 1.35, c.spot);
          else ellipse(x, px, py, r, r * 0.86, 0.3, c.spot);
        }
        for (const [px, py] of nubs) {
          x.fillStyle = mix(c.belly.slice(0, 7), c.spot.slice(0, 7), 0.35);
          x.beginPath();
          x.arc(px, py, 0.9, 0, TAU);
          x.fill();
        }
      });
      blush(x, 32, 12, 7, 5, 'rgba(255,90,110,0.55)');
    },
    bump: (x) => {
      circle(x, 28, -11, 12, 'rgba(50,50,50,0.5)');
      for (const [px, py] of nubs) circle(x, px, py, 1.2, 'rgba(255,255,255,0.7)');
    },
    lit: { dome: 34, soften: 2.5, tint: c.tint, spec: 0.75, gloss: 40, line: 1.2, lineDark: 0.72, bumpPx: 0.7 },
  });
  b.over(body, (x) => {
    eye(x, 28, -11, 11.5, { rim: c.rim, iris: c.iris });
    ellipse(x, 48.5, 9, 3.2, 4.8, 0, '#ff8f7a');
    ellipse(x, 49.4, 9, 1.4, 2.5, 0, '#a83a3a');
    smile(x, 40, 13, 47, 14, 1.2, 1.5);
  });
  const pec = finPart(b, [-10, -6, 22, 24], fin([[14, 2], [4, 3], [-5, 8], [-4, 15], [6, 17], [13, 11], [16, 6]], [[14, 2], [15, 4], [16, 6]], 4));
  const all = b.stack([-58, -46, 56, 46], ...fins, body);
  const o: SwimOpts = { head: -26, tail: -55, amp: 5, waves: 0.5, fore: 0.3, foreFrom: -36 };
  return (ctx, phase, v) => {
    const bob = Math.sin(TAU * phase) * 0.5;
    ctx.save();
    ctx.translate(0, bob);
    swim(ctx, { ...v, oy: v.oy + Math.round(bob * v.s) }, all, phase, o);
    ctx.restore();
    blitAt(ctx, pec, 15, 4, Math.sin(TAU * phase * 2) * 0.42, 1, 1, 0, bob);
  };
}

export function puffedRig(b: Builder, c: PufferColors, spikes: number, spikeLen: number): FramePainter {
  const R = 40;
  const out: P[] = [];
  // Soft nubs, not needles: each spike has a rounded tip.
  const pitch = TAU / spikes;
  for (let i = 0; i < spikes; i++) {
    const a = (i + 0.5) * pitch;
    const pt = (ang: number, r: number): P => [Math.cos(ang) * r, Math.sin(ang) * r];
    out.push(pt(a - pitch * 0.5, R));
    out.push(pt(a - pitch * 0.17, R + spikeLen * 0.74));
    out.push(pt(a, R + spikeLen));
    out.push(pt(a + pitch * 0.17, R + spikeLen * 0.74));
  }
  const fin = (rim: P[], base: P[], rays: number): FinSpec => ({ rim, base, rays, root: c.fin, tip: c.finTip, ray: c.ray, tipAlpha: 0.92 });
  const tail = finPart(b, [-55, -14, -33, 14], fin([[-37, -5], [-46, -11], [-50, -8], [-51, 0], [-50, 8], [-46, 11], [-37, 5]], [[-35, -3], [-35, 0], [-35, 3]], 4));
  const nubs: Array<[number, number]> = [];
  const rand = makeRng(9);
  for (let i = 0; i < 40; i++) {
    const a = rand() * TAU;
    const r = Math.sqrt(rand()) * 37;
    const y = Math.sin(a) * r;
    if (y > 3) nubs.push([Math.cos(a) * r, y]);
  }
  const body = b.part({
    box: [-50, -50, 50, 50],
    paint: (x) => {
      x.beginPath();
      trace(x, out);
      x.fillStyle = radial(x, 0, 0, 0, 0, 0, 50, [[0, c.belly], [1, c.belly]]);
      x.fill();
      clipped(x, out, () => {
        x.fillStyle = linear(x, 0, -44, 0, 44, [[0, c.top], [0.35, c.mid], [0.53, c.belly], [1, c.belly]]);
        x.fillRect(-52, -52, 104, 104);
        for (const [px, py, r] of pufferSpots) {
          if (c.stars) star(x, px * 1.05 - 2, py * 1.2, r * 1.4, c.spot);
          else ellipse(x, px * 1.05 - 2, py * 1.2, r, r * 0.86, 0.3, c.spot);
        }
      });
      blush(x, 34, 8, 6, 4.2, 'rgba(255,90,110,0.6)');
      blush(x, 6, 7, 6, 4.2, 'rgba(255,90,110,0.5)');
    },
    bump: (x) => {
      circle(x, 30, -12, 13, 'rgba(50,50,50,0.5)');
      circle(x, 6, -15, 10, 'rgba(50,50,50,0.5)');
      for (const [px, py] of nubs) circle(x, px, py, 1.3, 'rgba(255,255,255,0.6)');
    },
    lit: { dome: 40, soften: 1.8, tint: c.tint, spec: 0.8, gloss: 46, line: 1.3, lineDark: 0.72, bumpPx: 0.7 },
  });
  b.over(body, (x) => {
    eye(x, 30, -12, 11.8, { rim: c.rim, iris: c.iris, look: [0.05, 0] });
    eye(x, 6, -15, 9.2, { rim: c.rim, iris: c.iris, look: [0.1, 0] });
    ellipse(x, 21, 9, 5.2, 6.2, 0, '#ff8f7a');
    ellipse(x, 21.5, 9.3, 2.9, 3.9, 0, '#8a2f35');
  });
  const pec = finPart(b, [-24, 4, 2, 30], fin([[-6, 10], [-14, 10], [-21, 15], [-19, 22], [-10, 23], [-5, 18], [-4, 13]], [[-6, 10], [-5, 12], [-4, 13]], 3));
  return (ctx, phase) => {
    const s = 1 + Math.sin(TAU * phase) * 0.018;
    const wig = Math.sin(TAU * phase * 2) * 0.28;
    blitAt(ctx, tail, -35, 0, wig * 0.5, 1 - Math.abs(wig) * 0.4);
    ctx.save();
    ctx.scale(s, 1 / s);
    blit(ctx, body);
    ctx.restore();
    blitAt(ctx, pec, -5, 12, wig, 1, 1);
  };
}

export const F05: CreatureDef = {
  id: 'F05', size: 100, box: [-58, -46, 56, 46], art: [-54, -42, 52, 42], frames: 8, fps: 9, facing: 'side', ss: 1.7,
  build: (b) => pufferRig(b, PUFFER),
};

export const F05_puffed: CreatureDef = {
  id: 'F05_puffed', size: 160, box: [-54, -52, 54, 52], art: [-52, -50, 50, 50], frames: 6, fps: 8, facing: 'side', ss: 1.3,
  build: (b) => puffedRig(b, PUFFER, 22, 10),
};

// ---------------------------------------------------------------- F06 Lionfish

const lionBody: P[] = [
  [48, 8], [45, -6], [34, -17], [14, -22], [-6, -20], [-22, -13], [-32, -7], [-36, 0], [-32, 6], [-22, 11], [-6, 17], [14, 21], [34, 20], [45, 14],
];
const LION_A = '#c8241f';
const LION_B = '#fff1dc';

/** A long spine with a red and cream band pattern, ending in a soft bead. */
function bandedRay(x: Ctx, ax: number, ay: number, bx: number, by: number, w: number, bands: number): void {
  const dx = bx - ax;
  const dy = by - ay;
  const l = Math.hypot(dx, dy);
  const nx = -dy / l;
  const ny = dx / l;
  for (let i = 0; i < bands; i++) {
    const t0 = i / bands;
    const t1 = (i + 1) / bands;
    const w0 = lerp(w, w * 0.4, t0);
    const w1 = lerp(w, w * 0.4, t1);
    x.fillStyle = i % 2 ? LION_B : LION_A;
    x.beginPath();
    x.moveTo(ax + dx * t0 + nx * w0, ay + dy * t0 + ny * w0);
    x.lineTo(ax + dx * t1 + nx * w1, ay + dy * t1 + ny * w1);
    x.lineTo(ax + dx * t1 - nx * w1, ay + dy * t1 - ny * w1);
    x.lineTo(ax + dx * t0 - nx * w0, ay + dy * t0 - ny * w0);
    x.closePath();
    x.fill();
  }
  circle(x, bx, by, w * 0.82, LION_B);
}

function lionFan(cx: number, cy: number, a0: number, a1: number, r: number, n: number): { web: P[]; tips: Array<[number, number]> } {
  const web: P[] = [[cx, cy, 1]];
  const tips: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = lerp(a0, a1, t);
    const q = r * (0.8 + 0.2 * Math.sin(t * Math.PI));
    const tip: [number, number] = [cx + Math.cos(a) * q, cy + Math.sin(a) * q];
    tips.push(tip);
    web.push([tip[0], tip[1]]);
    if (i < n - 1) {
      const a2 = lerp(a0, a1, (i + 0.5) / (n - 1));
      web.push([cx + Math.cos(a2) * q * 0.86, cy + Math.sin(a2) * q * 0.86]);
    }
  }
  return { web, tips };
}

function fanPart(b: Builder, box: Box, f: { web: P[]; tips: Array<[number, number]> }, cx: number, cy: number): Part {
  return b.part({
    box,
    paint: (x) => {
      fillPath(x, f.web, radial(x, cx, cy, 2, cx, cy, 42, [[0, 'rgba(255,120,90,0.92)'], [0.7, 'rgba(255,176,140,0.85)'], [1, 'rgba(255,214,190,0.8)']]));
      for (const t of f.tips) bandedRay(x, cx, cy, t[0], t[1], 1.5, 5);
    },
    bump: (x) => {
      for (const t of f.tips) line(x, cx, cy, t[0], t[1], 'rgba(255,255,255,0.8)', 2.4);
    },
    lit: { dome: 2, soften: 0.3, spec: 0.3, gloss: 24, sheen: 0.05, shade: 0.45, rim: 0.2, tint: WARM, line: 0.8, lineSolid: 0.7, lineDark: 0.55, bumpPx: 0.6 },
  });
}

export const F06: CreatureDef = {
  id: 'F06', size: 120, box: [-58, -58, 58, 56], art: [-52, -52, 52, 50], frames: 8, fps: 8, facing: 'side', ss: 1.4,
  build(b) {
    const tail = finPart(b, [-56, -18, -28, 18], {
      rim: [[-34, -5], [-44, -13], [-51, -11], [-52, 0], [-51, 11], [-44, 13], [-34, 5]], base: [[-32, -4], [-32, 0], [-32, 4]],
      rays: 6, root: '#ffb9a0', tip: '#ffe6d6', ray: 'rgba(190,40,30,0.7)', rayWidth: 1.1, tipAlpha: 0.92,
    });
    const dorsal = fanPart(b, [-50, -58, 30, -6], lionFan(-4, -8, -2.5, -0.95, 47, 10), -4, -8);
    const farFan = fanPart(b, [-48, -6, 36, 52], lionFan(10, 8, 2.75, 1.25, 43, 7), 10, 8);
    const anal = finPart(b, [-30, 4, 2, 32], {
      rim: [[-4, 14], [-9, 26], [-20, 27], [-27, 8]], base: [[-5, 13], [-14, 11], [-24, 7]],
      rays: 5, root: '#ffb9a0', tip: '#ffe6d6', ray: 'rgba(190,40,30,0.7)', tipAlpha: 0.92,
    });
    const body = b.part({
      box: [-40, -24, 54, 24],
      paint: (x) => {
        x.beginPath();
        trace(x, lionBody);
        x.fillStyle = LION_B;
        x.fill();
        clipped(x, lionBody, () => {
          for (let i = 0; i < 8; i++) {
            const cx = 28 - i * 9.4;
            const w = 3 - i * 0.12;
            fillPath(x, [[cx + 3, -24], [cx - 2, -8], [cx + 3, 6], [cx - 2, 24], [cx - 2 - w * 2, 24], [cx + 3 - w * 2, 6], [cx - 2 - w * 2, -8], [cx + 3 - w * 2, -24]], i % 3 === 2 ? '#7a1420' : LION_A);
          }
          fillPath(x, [[46, -8], [36, -16], [33, 0], [38, 8], [48, 7]], LION_A);
          fillPath(x, [[37, 3], [33, 18], [29, 18], [31, 3]], '#7a1420');
        });
        blush(x, 39, 10, 5.5, 4, 'rgba(255,90,120,0.5)');
      },
      bump: (x) => {
        circle(x, 33, -7, 9, 'rgba(50,50,50,0.5)');
      },
      lit: { dome: 17, soften: 1.5, tint: WARM, spec: 0.55, line: 1.1, lineDark: 0.75, bumpPx: 0.7 },
    });
    b.over(body, (x) => {
      eye(x, 33, -7, 8.6, { rim: 'rgba(110,20,20,0.85)', iris: '#a8561a' });
      smile(x, 37, 9, 47.5, 7.5, 2.8, 1.8);
    });
    const nearFan = fanPart(b, [-46, -8, 34, 54], lionFan(12, 9, 2.6, 1.1, 41, 7), 12, 9);
    const all = b.stack([-58, -22, 56, 34], tail, anal, body);
    const o: SwimOpts = { head: 18, tail: -52, amp: 4.2, waves: 0.7, fore: 0.1, foreFrom: -34 };
    return (ctx, phase, v) => {
      const t = Math.sin(TAU * phase);
      blitAt(ctx, dorsal, -4, -8, t * 0.06, 1 + t * 0.03, 1 + t * 0.03);
      blitAt(ctx, farFan, 10, 8, -t * 0.1 - 0.05, 1 - t * 0.04, 1 - t * 0.04);
      swim(ctx, v, all, phase, o);
      blitAt(ctx, nearFan, 12, 9, t * 0.11, 1 + t * 0.04, 1 + t * 0.04);
    };
  },
};

// ---------------------------------------------------------------- F07 Jellyfish and its specials sibling

export interface JellyColors {
  crown: string;
  mid: string;
  skirt: string;
  inner: string;
  frill: string;
  frillDark: string;
  strand: string;
  iris: string;
  blush: string;
  tint: Rgb;
  extra?(x: Ctx): void;
}

export const JELLY: JellyColors = {
  crown: '#ff6fc4', mid: '#ff9ad8', skirt: '#ffd0ee', inner: 'rgba(255,240,170,0.9)', frill: '#ffb3e6', frillDark: '#d65ab8', strand: 'rgba(255,190,235,0.8)',
  iris: '#a03a9a', blush: 'rgba(255,80,150,0.6)', tint: [0.72, 0.42, 0.9],
};

export function jellyRig(b: Builder, c: JellyColors): FramePainter {
  const bellPts: P[] = [
    [0, -50], [17, -47.5], [30, -38], [37, -24], [39, -10], [36, -4], [30, -7], [24, -2], [17, -6], [11, -1], [4, -5], [-4, -1], [-11, -5], [-17, -1], [-24, -6], [-30, -2], [-36, -6], [-39, -10],
    [-37, -24], [-30, -38], [-17, -47.5],
  ];
  const bell = b.part({
    box: [-44, -54, 44, 6],
    paint: (x) => {
      x.beginPath();
      trace(x, bellPts);
      x.fillStyle = linear(x, 0, -50, 0, 0, [[0, c.crown], [0.5, c.mid], [1, c.skirt]]);
      x.fill();
      clipped(x, bellPts, () => {
        ellipse(x, 0, -10, 36, 13, 0, 'rgba(255,255,255,0.28)');
        c.extra?.(x);
      });
    },
    bump: (x) => {
      x.strokeStyle = 'rgba(70,70,70,0.45)';
      x.lineWidth = 2;
      x.beginPath();
      for (let i = -3; i <= 3; i++) {
        x.moveTo(i * 3, -42);
        x.quadraticCurveTo(i * 8.6, -28, i * 11.5, -4);
      }
      x.stroke();
    },
    lit: { dome: 34, soften: 2, depth: 1, tint: c.tint, spec: 0.85, gloss: 60, sheen: 0.22, rim: 0.9, rimColor: [1, 0.86, 1], line: 1.1, lineDark: 0.5, bumpPx: 0.7, shade: 0.6 },
  });
  b.over(bell, (x) => {
    eye(x, -14, -22, 8.6, { rim: 'rgba(120,30,110,0.7)', iris: c.iris, look: [0.1, 0.1] });
    eye(x, 14, -22, 8.6, { rim: 'rgba(120,30,110,0.7)', iris: c.iris, look: [0.1, 0.1] });
    smile(x, -5.5, -14, 5.5, -14, 3, 1.9, 'rgba(120,20,110,0.9)');
    blush(x, -23, -14, 6, 4, c.blush);
    blush(x, 23, -14, 6, 4, c.blush);
  });

  const arms: Array<{ x: number; len: number; w: number; ph: number }> = [
    { x: -14, len: 50, w: 4.2, ph: 0.1 },
    { x: 13, len: 53, w: 4.4, ph: 0.55 },
    { x: -2, len: 56, w: 5, ph: 0.8 },
  ];
  const strands: Array<{ x: number; len: number; ph: number }> = [
    { x: -30, len: 42, ph: 0.0 }, { x: -22, len: 50, ph: 0.3 }, { x: -7, len: 54, ph: 0.6 }, { x: 7, len: 52, ph: 0.15 }, { x: 22, len: 50, ph: 0.75 }, { x: 30, len: 42, ph: 0.45 },
  ];
  return (ctx, phase) => {
    const pulse = Math.sin(TAU * phase);
    const sx = 1 + pulse * 0.075;
    const sy = 1 - pulse * 0.095;
    const lift = -pulse * 2.4;
    const stretch = 1 - pulse * 0.07;
    for (const s of strands) {
      const n = 10;
      const pts: P[] = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const y = -4 + t * s.len * stretch;
        const xx = s.x * sx * (1 + t * 0.12) + Math.sin(TAU * (phase + s.ph - t * 0.9)) * (0.8 + t * 5.5);
        pts.push([xx, y + lift]);
      }
      strokePath(ctx, pts, c.strand, 1.5);
    }
    for (const a of arms) {
      const spine: S[] = [];
      const n = 7;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const y = -4 + t * a.len * stretch;
        const xx = a.x * sx + Math.sin(TAU * (phase + a.ph - t * 0.75)) * (1 + t * 5);
        spine.push([xx, y + lift, a.w * (1 - t * 0.8) + 0.5 * Math.sin(t * 16)]);
      }
      const out = tube(spine, 3);
      fillPath(ctx, out, linear(ctx, 0, 0, 0, 52, [[0, c.frill], [1, c.frillDark]]));
      ctx.save();
      ctx.beginPath();
      trace(ctx, out);
      ctx.clip();
      for (let i = 0; i < n; i++) {
        const q = spine[i]!;
        ellipse(ctx, q[0] - q[2] * 0.3, q[1] + 1, q[2] * 0.55, 1.6, 0.4, 'rgba(255,255,255,0.5)');
      }
      ctx.restore();
    }
    ctx.save();
    ctx.translate(0, -2 + lift * 0.6);
    ctx.scale(sx, sy);
    ctx.translate(0, 2);
    blit(ctx, bell);
    ctx.restore();
  };
}

export const F07: CreatureDef = {
  id: 'F07', size: 110, box: [-50, -56, 50, 56], art: [-42, -52, 42, 52], frames: 8, fps: 9, facing: 'upright', ss: 1.4,
  build: (b) => jellyRig(b, JELLY),
};

// ---------------------------------------------------------------- F08 Red Snapper

const snapBody: P[] = [
  [50, 6], [47, -3], [38, -13], [22, -21], [3, -24], [-15, -20], [-29, -12], [-38, -6], [-41, 0], [-38, 5], [-29, 8], [-13, 15], [6, 19], [24, 19], [39, 15], [47, 11],
];

export const F08: CreatureDef = {
  id: 'F08', size: 140, box: [-58, -42, 56, 40], art: [-54, -36, 52, 33], frames: 8, fps: 10, facing: 'side', ss: 1.4,
  build(b) {
    const red = (rim: P[], base: P[], rays: number): FinSpec => ({
      rim, base, rays, root: '#ee3a3a', tip: '#ff8a7a', ray: 'rgba(130,10,20,0.5)', tipAlpha: 0.95,
    });
    const fins = [
      finPart(b, [-58, -28, -30, 28], red(
        [[-37, -7], [-44, -17], [-52, -25], [-55, -21], [-53, -9], [-49, 0], [-53, 9], [-55, 21], [-52, 25], [-44, 17], [-37, 7]], [[-34, -5], [-34, 0], [-34, 5]], 9)),
      finPart(b, [-34, -40, 32, -8], red(
        [[26, -18], [20, -29], [12, -35], [5, -30], [-1, -33], [-8, -28], [-15, -30], [-22, -24], [-28, -28], [-33, -10]], [[24, -16], [4, -20], [-14, -16], [-30, -9]], 13)),
      finPart(b, [-30, 6, 0, 32], red(
        [[-6, 16], [-11, 26], [-20, 26], [-27, 8]], [[-7, 15], [-16, 12], [-25, 7]], 6)),
      finPart(b, [2, 12, 30, 34], red(
        [[20, 17], [14, 28], [4, 31], [6, 17]], [[18, 16], [12, 16], [8, 16]], 5)),
    ];
    const scales: Array<[number, number]> = [];
    for (let i = 0; i < 12; i++) {
      for (let j = -3; j <= 3; j++) {
        scales.push([28 - i * 6 - (j & 1) * 3, j * 5.6]);
      }
    }
    const body = b.part({
      box: [-44, -28, 54, 24],
      paint: (x) => {
        x.beginPath();
        trace(x, snapBody);
        x.fillStyle = linear(x, 0, -24, 0, 19, [[0, '#d91f2d'], [0.45, '#f4444a'], [0.72, '#ff9d8e'], [1, '#fff0e0']]);
        x.fill();
        clipped(x, snapBody, () => {
          x.strokeStyle = 'rgba(150,10,30,0.3)';
          x.lineWidth = 0.9;
          x.beginPath();
          for (const [sx, sy] of scales) {
            x.moveTo(sx + 2, sy - 3);
            x.quadraticCurveTo(sx - 3, sy, sx + 2, sy + 3);
          }
          x.stroke();
          strokePath(x, [[30, -9], [8, -11], [-16, -7], [-38, -1]], 'rgba(255,220,200,0.5)', 1.3);
          // cheek plate
          fillPath(x, [[32, -14], [24, -4], [24, 8], [30, 16], [44, 16], [50, 0], [44, -10]], 'rgba(255,120,110,0.28)');
        });
        blush(x, 37, 9, 6, 4.2, 'rgba(255,60,90,0.5)');
      },
      bump: (x) => {
        x.save();
        x.beginPath();
        trace(x, snapBody);
        x.clip();
        x.strokeStyle = 'rgba(255,255,255,0.5)';
        x.lineWidth = 1.2;
        x.beginPath();
        for (const [sx, sy] of scales) {
          x.moveTo(sx + 2, sy - 3);
          x.quadraticCurveTo(sx - 3, sy, sx + 2, sy + 3);
        }
        x.stroke();
        x.restore();
        strokePath(x, [[25, -12], [21, -2], [24, 9], [28, 16]], 'rgba(30,30,30,0.7)', 2);
        circle(x, 35, -5.5, 8.5, 'rgba(50,50,50,0.5)');
      },
      lit: { dome: 19, soften: 1.4, tint: WARM, spec: 0.65, gloss: 38, line: 1.2, lineDark: 0.74, bumpPx: 0.34 },
    });
    b.over(body, (x) => {
      eye(x, 35, -5.5, 7.6, { rim: 'rgba(110,10,20,0.85)', iris: '#b8681c' });
      smile(x, 38, 9.5, 49.5, 7, 2.6, 1.7);
    });
    const pec = finPart(b, [-4, -4, 26, 22], {
      rim: [[20, 3], [9, 4], [1, 8], [0, 13], [9, 14], [18, 11], [21, 6]], base: [[20, 3], [21, 5], [21, 6]],
      rays: 5, root: '#ffb9a4', tip: '#ffe0d0', ray: 'rgba(170,40,40,0.5)', tipAlpha: 0.95,
    });
    const all = b.stack([-58, -42, 56, 40], ...fins, body);
    const o: SwimOpts = { head: 16, tail: -54, amp: 6, waves: 0.8, fore: 0.14, foreFrom: -36 };
    return (ctx, phase, v) => {
      swim(ctx, v, all, phase, o);
      blitAt(ctx, pec, 20, 4, Math.sin(TAU * phase) * 0.28, 1, 1, 0, swimDy(20, phase, o));
    };
  },
};

// ---------------------------------------------------------------- F09 Sea Turtle (seen from above)

const shell: P[] = [
  [34, 0], [31, -15], [21, -28], [3, -36], [-16, -34], [-32, -24], [-42, -10], [-45, 0], [-42, 10], [-32, 24], [-16, 34], [3, 36], [21, 28], [31, 15],
];

interface Plate {
  pts: P[];
  cx: number;
  cy: number;
}

// The real scute plan: a row of hexagons down the spine, with a row of wide plates on each side reaching the rim.
function scutes(): Plate[] {
  const X = [22.5, 10.5, -5, -20.5, -34.5];
  const w0 = 6.5;
  const w1 = 10.5;
  const ring = (x: number, y: number): [number, number] => {
    const cx = -6;
    const dx = x - cx;
    const l = Math.hypot(dx / 28.5, y / 26.5);
    return [cx + dx / l, y / l];
  };
  const out: Plate[] = [];
  const mids: number[] = [];
  for (let i = 0; i < 4; i++) {
    const xf = X[i]!;
    const xb = X[i + 1]!;
    const xm = (xf + xb) / 2;
    mids.push(xm);
    out.push({
      pts: [[xf, -w0, 1], [xm, -w1, 1], [xb, -w0, 1], [xb, w0, 1], [xm, w1, 1], [xf, w0, 1]],
      cx: xm,
      cy: 0,
    });
  }
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const inA: [number, number] = i === 0 ? [X[0]!, s * w0] : [mids[i - 1]!, s * w1];
      const edge: [number, number] = [i === 0 ? mids[0]! : X[i]!, s * (i === 0 ? w1 : w0)];
      const inB: [number, number] = i === 3 ? [X[4]!, s * w0] : [mids[i]!, s * w1];
      const o0 = i === 0 ? inA : ring(inA[0] + (inA[0] + 6) * 0.3, inA[1]);
      const o1 = ring(inB[0] + (inB[0] + 6) * 0.3, inB[1]);
      const omid = ring((o0[0] + o1[0]) / 2, (o0[1] + o1[1]) / 2);
      const pts: P[] = i === 0
        ? [[inA[0], inA[1], 1], [edge[0], edge[1], 1], [o1[0], o1[1], 1], [omid[0], omid[1], 1], [o0[0], o0[1], 1]]
        : [[inA[0], inA[1], 1], [edge[0], edge[1], 1], [inB[0], inB[1], 1], [o1[0], o1[1], 1], [omid[0], omid[1], 1], [o0[0], o0[1], 1]];
      const cx = pts.reduce((v, q) => v + q[0], 0) / pts.length;
      const cy = pts.reduce((v, q) => v + q[1], 0) / pts.length;
      out.push({ pts, cx, cy });
    }
  }
  return out;
}

function polygon(x: Ctx, pts: readonly P[]): void {
  x.beginPath();
  pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
  x.closePath();
}

export const F09: CreatureDef = {
  id: 'F09', size: 170, box: [-56, -62, 58, 62], art: [-50, -56, 52, 56], frames: 8, fps: 8, facing: 'top', ss: 1.2,
  build(b) {
    const skinA = '#9fdc74';
    const skinB = '#62b850';
    const flipperPaint = (pts: P[], spots: Array<[number, number, number]>) => (x: Ctx): void => {
      fillPath(x, pts, linear(x, 0, -60, 0, 60, [[0, skinB], [0.5, skinA], [1, skinB]]));
      clipped(x, pts, () => {
        for (const [px, py, r] of spots) ellipse(x, px, py, r, r * 0.8, 0.5, 'rgba(44,120,70,0.6)');
      });
    };
    const flipLit = { dome: 7, soften: 0.7, light: TOP_LIGHT, tint: COOL, spec: 0.45, gloss: 30, line: 1.2, lineDark: 0.7 };
    const front: P[] = [[22, -27], [26, -35], [22, -46], [12, -55], [-1, -60], [-10, -59], [-7, -50], [0, -41], [5, -31], [10, -25]];
    const frontParts = [front, front.map((p) => [p[0], -p[1]] as P).reverse()].map((pts, i) =>
      b.part({
        box: i === 0 ? [-14, -62, 30, -20] : [-14, 20, 30, 62],
        paint: flipperPaint(pts, [[10, (i ? 1 : -1) * 38, 3.4], [4, (i ? 1 : -1) * 47, 3], [-3, (i ? 1 : -1) * 54, 2.2], [15, (i ? 1 : -1) * 47, 2.4], [17, (i ? 1 : -1) * 33, 2.6]]),
        lit: flipLit,
      }),
    );
    const rear: P[] = [[-35, -22], [-45, -30], [-53, -30], [-54, -23], [-47, -16], [-39, -13]];
    const rearParts = [rear, rear.map((p) => [p[0], -p[1]] as P).reverse()].map((pts, i) =>
      b.part({
        box: i === 0 ? [-58, -34, -31, -10] : [-58, 10, -31, 34],
        paint: flipperPaint(pts, [[-47, (i ? 1 : -1) * 24, 2.4], [-41, (i ? 1 : -1) * 20, 2]]),
        lit: flipLit,
      }),
    );
    const tailPart = b.part({
      box: [-54, -6, -40, 6],
      paint: (x) => fillPath(x, [[-42, -4], [-51, 0], [-42, 4]], skinA),
      lit: flipLit,
    });
    const headPts: P[] = [[54, 0], [52.5, -8.5], [45, -14], [34, -14.5], [22, -11], [22, 11], [34, 14.5], [45, 14], [52.5, 8.5]];
    const head = b.part({
      box: [18, -18, 56, 18],
      paint: (x) => {
        fillPath(x, headPts, linear(x, 22, 0, 53, 0, [[0, skinB], [0.5, skinA], [1, '#d0f090']]));
        clipped(x, headPts, () => {
          ellipse(x, 33, 0, 3.8, 3, 0, 'rgba(44,120,70,0.5)');
          ellipse(x, 28, -8, 2.4, 2, 0, 'rgba(44,120,70,0.5)');
          ellipse(x, 28, 8, 2.4, 2, 0, 'rgba(44,120,70,0.5)');
        });
      },
      lit: { dome: 14, soften: 1, light: TOP_LIGHT, tint: COOL, spec: 0.55, gloss: 36, line: 1.2, lineDark: 0.7 },
    });
    b.over(head, (x) => {
      eye(x, 44, -8.4, 5.4, { rim: 'rgba(20,70,30,0.8)', look: [0.2, 0.05] });
      eye(x, 44, 8.4, 5.4, { rim: 'rgba(20,70,30,0.8)', look: [0.2, -0.05] });
      x.beginPath();
      x.moveTo(49.6, -4.6);
      x.quadraticCurveTo(53.4, 0, 49.6, 4.6);
      x.strokeStyle = 'rgba(30,60,30,0.85)';
      x.lineWidth = 1.7;
      x.lineCap = 'round';
      x.stroke();
    });
    const plates = scutes();
    const shellPart = b.part({
      box: [-49, -39, 38, 39],
      paint: (x) => {
        x.beginPath();
        trace(x, shell);
        x.fillStyle = '#c99a42';
        x.fill();
        clipped(x, shell, () => {
          x.strokeStyle = 'rgba(92,54,14,0.8)';
          x.lineWidth = 1.5;
          x.beginPath();
          for (let i = 0; i < 26; i++) {
            const a = ((i + 0.5) / 26) * TAU;
            x.moveTo(-6 + Math.cos(a) * 28, Math.sin(a) * 26);
            x.lineTo(-6 + Math.cos(a) * 46, Math.sin(a) * 42);
          }
          x.stroke();
          ellipse(x, -6, 0, 29.4, 27.4, 0, '#245f3e');
          for (const p of plates) {
            polygon(x, p.pts);
            x.fillStyle = radial(x, p.cx, p.cy, 1, p.cx, p.cy, 13, [[0, '#b78a3a'], [0.55, '#6f8a42'], [1, '#2c7a50']]);
            x.fill();
            x.strokeStyle = '#1e5236';
            x.lineWidth = 1.4;
            x.lineJoin = 'round';
            x.stroke();
          }
        });
      },
      bump: (x) => {
        x.save();
        x.beginPath();
        trace(x, shell);
        x.clip();
        x.strokeStyle = 'rgba(30,30,30,0.5)';
        x.lineWidth = 1.4;
        x.beginPath();
        for (let i = 0; i < 26; i++) {
          const a = ((i + 0.5) / 26) * TAU;
          x.moveTo(-6 + Math.cos(a) * 29, Math.sin(a) * 27);
          x.lineTo(-6 + Math.cos(a) * 46, Math.sin(a) * 42);
        }
        x.stroke();
        ellipse(x, -6, 0, 30, 28, 0, 'rgba(70,70,70,0.6)');
        for (const p of plates) {
          polygon(x, p.pts);
          x.fillStyle = 'rgba(200,200,200,0.9)';
          x.fill();
          x.lineWidth = 1.5;
          x.lineJoin = 'round';
          x.strokeStyle = 'rgba(20,20,20,0.9)';
          x.stroke();
        }
        x.restore();
      },
      lit: { dome: 36, soften: 2, light: TOP_LIGHT, tint: COOL, spec: 0.3, gloss: 30, sheen: 0.08, rim: 0.5, line: 1.3, lineDark: 0.72, bumpPx: 1.1, shade: 0.8 },
    });
    return (ctx, phase) => {
      const s = Math.sin(TAU * phase);
      const c = Math.cos(TAU * phase);
      blit(ctx, tailPart);
      blitAt(ctx, rearParts[0]!, -37, -18, -c * 0.2, 1, 1);
      blitAt(ctx, rearParts[1]!, -37, 18, c * 0.2, 1, 1);
      blitAt(ctx, frontParts[0]!, 17, -27, s * 0.34 - 0.1, 1, 1 - s * 0.1);
      blitAt(ctx, frontParts[1]!, 17, 27, -s * 0.34 + 0.1, 1, 1 - s * 0.1);
      blitAt(ctx, head, 24, 0, Math.sin(TAU * phase + 1) * 0.05, 1, 1);
      blit(ctx, shellPart);
    };
  },
};

// ---------------------------------------------------------------- F10 Manta Ray (seen from above)

const mantaHalf: P[] = [
  [29, -5], [26, -10], [21, -15], [13, -24], [3, -35], [-7, -45], [-14, -50], [-19, -47], [-20, -38], [-22, -26], [-25, -15], [-29, -7], [-34, -3],
];
const mantaBody: P[] = [...mantaHalf, ...mirrorY(mantaHalf)];

export const F10: CreatureDef = {
  id: 'F10', size: 280, box: [-62, -56, 46, 56], art: [-58, -51, 42, 51], frames: 6, fps: 7, facing: 'top', ss: 1,
  build(b) {
    const hornPts = (s: number): P[] => [[18, s * 11], [27, s * 14], [35, s * 13.5], [40, s * 10], [40.5, s * 5.6], [36, s * 3.6], [30, s * 4.2], [22, s * 5]];
    const horn = (s: number): Part =>
      b.part({
        box: s < 0 ? [16, -18, 45, 0] : [16, 0, 45, 18],
        paint: (x) => fillPath(x, hornPts(s), linear(x, 22, 0, 38, 0, [[0, '#26408f'], [1, '#4f8fe0']])),
        lit: { dome: 5, soften: 0.5, light: TOP_LIGHT, tint: COOL, spec: 0.5, gloss: 30, line: 1.4, lineDark: 0.7 },
      });
    const tail = b.part({
      box: [-62, -5, -24, 5],
      paint: (x) => fillPath(x, tube([[-26, 0, 2.2], [-40, 0, 1.3], [-58, 0, 0.35]], 4), '#1f2f70'),
      lit: { dome: 2, soften: 0.3, light: TOP_LIGHT, tint: COOL, spec: 0.4, line: 0.9 },
    });
    const spots: Array<[number, number, number]> = [];
    const rand = makeRng(21);
    for (let i = 0; i < 22; i++) {
      const y = lerp(-42, 42, rand());
      spots.push([lerp(-20, 6, rand()) - Math.abs(y) * 0.12, y, lerp(0.9, 2.2, rand())]);
    }
    const body = b.part({
      box: [-38, -54, 34, 54],
      paint: (x) => {
        x.beginPath();
        trace(x, mantaBody);
        x.fillStyle = radial(x, 8, 0, 4, 2, 0, 56, [[0, '#2c4aa8'], [0.45, '#2a3f96'], [0.8, '#3560c0'], [1, '#65a8ee']]);
        x.fill();
        clipped(x, mantaBody, () => {
          // white shoulder chevrons, the species' real marking
          for (const s of [-1, 1]) {
            fillPath(x, [[16, s * 14], [6, s * 16], [-2, s * 23], [-7, s * 30], [-13, s * 28], [-9, s * 18], [-3, s * 11], [8, s * 9]], 'rgba(235,246,255,0.95)');
          }
          for (const [sx, sy, r] of spots) circle(x, sx, sy, r, 'rgba(10,20,70,0.5)');
          
        });
      },
      bump: (x) => {
        // the thick middle of the body, a soft swell with no edges
        x.save();
        x.translate(0, 0);
        x.scale(1, 0.42);
        x.fillStyle = radial(x, 0, 0, 0, 0, 0, 32, [[0, 'rgba(255,255,255,0.95)'], [0.55, 'rgba(210,210,210,0.6)'], [1, 'rgba(128,128,128,0)']]);
        x.fillRect(-40, -80, 80, 160);
        x.restore();
      },
      lit: { dome: 15, soften: 2.2, depth: 0.9, light: TOP_LIGHT, tint: COOL, spec: 0.34, gloss: 26, sheen: 0.1, rim: 0.65, line: 1.4, lineDark: 0.7, bumpPx: 4 },
    });
    b.over(body, (x) => {
      eye(x, 18.5, -14, 4.6, { rim: 'rgba(6,14,50,0.9)', look: [0.2, -0.05] });
      eye(x, 18.5, 14, 4.6, { rim: 'rgba(6,14,50,0.9)', look: [0.2, 0.05] });
      x.beginPath();
      x.moveTo(23.5, -7.4);
      x.quadraticCurveTo(31, 0, 23.5, 7.4);
      x.strokeStyle = 'rgba(214,236,255,0.98)';
      x.lineWidth = 1.5;
      x.lineCap = 'round';
      x.stroke();
    });
    const horns = [horn(-1), horn(1)];
    return (ctx, phase, v) => {
      const f = Math.sin(TAU * phase);
      const tailDy = (x: number): number => Math.sin(TAU * phase + x * 0.09) * clamp((-30 - x) / 28) * 3;
      warpCols(ctx, v, tail, tailDy, null, null, 2);
      const lift = 0.5 + 0.5 * f;
      const shift = (y: number): number => {
        const t = clamp((Math.abs(y) - 8) / 42);
        return t * t * 7.5 * f;
      };
      const map = (y: number): number => y / (1 - 0.07 * lift);
      warpRows(ctx, v, body, shift, map, null, 2);
      const h = f * 0.07;
      blitAt(ctx, horns[0]!, 24, -5, -h, 1, 1);
      blitAt(ctx, horns[1]!, 24, 5, h, 1, 1);
    };
  },
};

// ---------------------------------------------------------------- F11 Octopus (upright, arms re-lit every frame)

const octoHead: P[] = [
  [0, -50], [17, -47], [29, -37], [34, -22], [31, -7], [22, 4], [10, 9], [0, 10], [-10, 9], [-22, 4], [-31, -7], [-34, -22], [-29, -37], [-17, -47],
];

interface OctoArm {
  base: readonly [number, number];
  dir: number;
  curl: number;
  len: number;
  r: number;
  ph: number;
  back: boolean;
}

const octoArms: OctoArm[] = [
  { base: [-6, 4], dir: 1.8, curl: 2.6, len: 48, r: 6.2, ph: 0.65, back: true },
  { base: [6, 4], dir: 1.34, curl: -2.6, len: 48, r: 6.2, ph: 0.15, back: true },
  { base: [-22, 2], dir: 2.2, curl: 2.2, len: 46, r: 6.4, ph: 0.4, back: true },
  { base: [22, 2], dir: 0.94, curl: -2.2, len: 46, r: 6.4, ph: 0.9, back: true },
  { base: [-26, -4], dir: 2.9, curl: -2.5, len: 38, r: 6.8, ph: 0.0, back: false },
  { base: [26, -4], dir: 0.24, curl: 2.5, len: 38, r: 6.8, ph: 0.5, back: false },
  { base: [-14, 7], dir: 2.0, curl: -2.2, len: 46, r: 7.2, ph: 0.25, back: false },
  { base: [14, 7], dir: 1.14, curl: 2.2, len: 46, r: 7.2, ph: 0.75, back: false },
];

function armSpine(a: OctoArm, phase: number): S[] {
  const n = 11;
  const pts: S[] = [];
  let x = a.base[0];
  let y = a.base[1];
  const step = a.len / n;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const ang = a.dir + a.curl * t * t + Math.sin(TAU * (phase + a.ph - t * 0.8)) * (0.08 + t * 0.42);
    pts.push([x, y, Math.max(0.7, a.r * Math.pow(1 - t, 0.78) + 0.5)]);
    x += Math.cos(ang) * step;
    y += Math.sin(ang) * step;
  }
  return pts;
}

export const F11: CreatureDef = {
  id: 'F11', size: 220, box: [-60, -54, 60, 60], art: [-54, -52, 54, 54], frames: 6, fps: 8, facing: 'upright', ss: 1,
  build(b) {
    const head = b.part({
      box: [-38, -54, 38, 14],
      paint: (x) => {
        x.beginPath();
        trace(x, octoHead);
        x.fillStyle = linear(x, 0, -50, 0, 10, [[0, '#f04f8a'], [0.55, '#ff6f9f'], [1, '#ffb4c4']]);
        x.fill();
        clipped(x, octoHead, () => {
          const spots: Array<[number, number, number]> = [[-16, -38, 4], [8, -42, 3.2], [20, -30, 3], [-25, -22, 2.6], [-2, -33, 2.3], [26, -14, 2]];
          for (const [sx, sy, r] of spots) circle(x, sx, sy, r, 'rgba(190,30,110,0.5)');
        });
        blush(x, -21, -6, 7, 5, 'rgba(255,50,110,0.6)');
        blush(x, 21, -6, 7, 5, 'rgba(255,50,110,0.6)');
      },
      bump: (x) => {
        circle(x, -13, -15, 12, 'rgba(70,70,70,0.5)');
        circle(x, 13, -15, 12, 'rgba(70,70,70,0.5)');
      },
      lit: { dome: 32, soften: 2, tint: WARM, spec: 0.78, gloss: 44, sheen: 0.2, rim: 0.7, rimColor: [1, 0.85, 0.95], line: 1.5, lineDark: 0.7, bumpPx: 2.4 },
    });
    b.over(head, (x) => {
      eye(x, -13, -15, 10.5, { rim: 'rgba(120,20,70,0.8)', iris: '#7a3fbf', look: [0.14, 0.1] });
      eye(x, 13, -15, 10.5, { rim: 'rgba(120,20,70,0.8)', iris: '#7a3fbf', look: [0.14, 0.1] });
      smile(x, -7, -2.5, 7, -2.5, 3.4, 2, 'rgba(110,10,60,0.9)');
    });
    const armCache = new Map<string, Part>();
    const armsAt = (phase: number): Part => {
      const key = phase.toFixed(3);
      const hit = armCache.get(key);
      if (hit) return hit;
      const paintArms = (x: Ctx, back: boolean): void => {
        for (const a of octoArms) {
          if (a.back !== back) continue;
          const s = armSpine(a, phase);
          const out = tube(s, 2);
          fillPath(x, out, back ? '#c8387a' : '#f25c92');
        }
      };
      const part = b.part({
        box: [-60, -6, 60, 60],
        paint: (x) => {
          paintArms(x, true);
          paintArms(x, false);
          for (const a of octoArms) {
            const s = sampleSpine(armSpine(a, phase), 2);
            const side = a.curl > 0 ? 1 : -1;
            for (let i = 2; i < s.length - 4; i += 2) {
              const p = s[i]!;
              const q = s[i + 1]!;
              const ang = Math.atan2(q[1] - p[1], q[0] - p[0]) + (Math.PI / 2) * side;
              const r = p[2] * 0.36;
              if (r < 0.7) continue;
              circle(x, p[0] + Math.cos(ang) * p[2] * 0.42, p[1] + Math.sin(ang) * p[2] * 0.42, r, a.back ? '#f4a8c0' : '#ffd0dc');
            }
          }
        },
        lit: { dome: 7, soften: 0.8, tint: WARM, spec: 0.55, gloss: 34, sheen: 0.18, line: 1.5, lineDark: 0.7, rim: 0.5, rimColor: [1, 0.85, 0.95] },
      });
      armCache.set(key, part);
      return part;
    };
    return (ctx, phase) => {
      const t = Math.sin(TAU * phase);
      blit(ctx, armsAt(phase));
      ctx.save();
      ctx.translate(0, 8);
      ctx.scale(1 + t * 0.02, 1 - t * 0.024);
      ctx.translate(0, -8);
      blit(ctx, head);
      ctx.restore();
    };
  },
};

// ---------------------------------------------------------------- F12 Reef Shark

const sharkBody: P[] = [
  [52, 2], [48, -6.5], [38, -14], [22, -19.5], [3, -20.5], [-16, -17], [-30, -11], [-41, -5], [-46, -2], [-46, 2], [-38, 5], [-26, 10], [-10, 15], [8, 19], [26, 19.5], [40, 15.5], [49, 8.5],
];

export const F12: CreatureDef = {
  id: 'F12', size: 340, box: [-58, -40, 56, 38], art: [-54, -37, 52, 35], frames: 6, fps: 8, facing: 'side', ss: 1,
  build(b) {
    const grey = '#5f8db6';
    const greyDark = '#44719c';
    const flatLit = { dome: 6, soften: 0.5, tint: COOL, spec: 0.46, gloss: 30, sheen: 0.14, line: 1.5, lineDark: 0.62 };
    const finShape = (box: Box, pts: P[]): Part =>
      b.part({ box, paint: (x) => fillPath(x, pts, linear(x, box[0], box[1], box[0], box[3], [[0, greyDark], [1, grey]])), lit: flatLit });
    const tail = finShape([-58, -38, -32, 32], [[-38, -6], [-42, -18], [-47, -30], [-51, -35], [-53.5, -30], [-52.5, -18], [-50, -8], [-49, 0], [-51, 9], [-54, 19], [-50, 18], [-43, 10], [-38, 4]]);
    const dorsal = finShape([-14, -40, 18, -12], [[16, -16], [6, -29], [-3, -37], [-8, -37], [-8.5, -28], [-10, -14]]);
    const dorsal2 = finShape([-32, -20, -18, -6], [[-20, -13], [-26, -18], [-29.5, -17], [-29, -9]]);
    const anal = finShape([-30, 2, -14, 18], [[-18, 9], [-24, 15], [-27.5, 15], [-27, 5]]);
    const pelvic = finShape([-12, 8, 10, 28], [[4, 14], [-2, 23], [-9, 25], [-9, 12]]);
    const farPec = finShape([8, 8, 32, 32], [[28, 13], [21, 24], [13, 30], [14, 13]]);
    b.fadeRoot(dorsal, 0, -8, 0, -18);
    const body = b.part({
      box: [-48, -23, 54, 22],
      paint: (x) => {
        x.beginPath();
        trace(x, sharkBody);
        x.fillStyle = linear(x, 0, -20, 0, 19, [[0, greyDark], [0.5, '#79a7cf'], [1, '#96c0e0']]);
        x.fill();
        clipped(x, sharkBody, () => {
          fillPath(x, [[56, 2], [44, 1.5], [34, 3.5], [20, 2.5], [6, 4.5], [-12, 2], [-30, 0], [-50, 1], [-50, 24], [56, 24]], linear(x, 0, 2, 0, 19, [[0, '#f6fbff'], [1, '#ffffff']]));
          x.strokeStyle = 'rgba(40,70,110,0.55)';
          x.lineWidth = 1;
          x.lineCap = 'round';
          x.beginPath();
          for (let i = 0; i < 3; i++) {
            const gx = 19 - i * 3.6;
            x.moveTo(gx, -8);
            x.quadraticCurveTo(gx - 2.6, -1, gx - 0.8, 6);
          }
          x.stroke();
        });
        blush(x, 37, 10.6, 5, 3, 'rgba(255,110,140,0.7)');
      },
      bump: (x) => {
        for (let i = 0; i < 3; i++) {
          const gx = 19 - i * 3.6;
          strokePath(x, [[gx, -8], [gx - 1.6, -1], [gx - 0.8, 6]], 'rgba(20,20,20,0.7)', 1.2);
        }
        circle(x, 33, -5, 7.2, 'rgba(60,60,60,0.5)');
        strokePath(x, [[52, 7], [44, 10], [33, 8.5]], 'rgba(30,30,30,0.6)', 1.4);
      },
      lit: { dome: 17, soften: 1.2, tint: COOL, spec: 0.6, gloss: 46, sheen: 0.16, rim: 0.6, line: 1.7, lineDark: 0.62, bumpPx: 1.6 },
    });
    b.over(body, (x) => {
      eye(x, 33, -5, 7.2, { rim: 'rgba(20,40,70,0.85)', iris: '#2f6fa8' });
      // a big closed-lip grin with a dimple, no teeth
      smile(x, 30.5, 6, 51.8, 5, 5, 1.3, 'rgba(36,58,100,0.92)');
      smile(x, 29, 3.8, 31.4, 7, 1.2, 1.1, 'rgba(36,58,100,0.85)');
    });
    const pec = finShape([0, 4, 34, 38], [[29, 9], [22, 21], [12, 31], [5, 33], [7, 24], [11, 9]]);
    b.fadeRoot(pec, 0, 4, 0, 14);
    const all = b.stack([-58, -40, 56, 38], tail, dorsal, dorsal2, anal, pelvic, farPec, body);
    const o: SwimOpts = { head: 8, tail: -54, amp: 8, waves: 0.65, fore: 0.1, foreFrom: -38, step: 1 };
    return (ctx, phase, v) => {
      swim(ctx, v, all, phase, o);
      blitAt(ctx, pec, 20, 8, Math.sin(TAU * phase) * 0.14, 1, 1, 0, swimDy(20, phase, o));
    };
  },
};

export const FISH: CreatureDef[] = [F01, F02, F03, F04, F05, F05_puffed, F06, F07, F08, F09, F10, F11, F12];

