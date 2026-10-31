// S01-S06. The specials reuse the pufferfish and jellyfish rigs and repaint them; the rest are their own creatures.

import type { CreatureDef } from './rig';
import { blush, eye, finPart, sampleSpine, smile, swim, swimDy, tube, type S, type SwimOpts } from './rig';
import { COOL, WARM, jellyRig, puffedRig, type JellyColors, type PufferColors } from './fish';
import {
  TAU,
  blit,
  blitAt,
  circle,
  clamp,
  clipped,
  ellipse,
  fillPath,
  hsl,
  lerp,
  line,
  linear,
  makeRng,
  radial,
  rotatePts,
  strokePath,
  trace,
  warpCols,
  type Ctx,
  type P,
} from './paint';

// ---------------------------------------------------------------- S01 Burst Puffer

const BURST: PufferColors = {
  top: '#e81f7a', mid: '#ff5ca3', belly: '#fff0dc', spot: '#ffe14a', fin: '#ff8a3c', finTip: '#ffd04f', ray: 'rgba(170,20,60,0.5)',
  rim: 'rgba(130,0,70,0.85)', iris: '#7a2fbf', stars: true, tint: [0.8, 0.34, 0.66],
};

export const S01: CreatureDef = {
  id: 'S01', size: 100, box: [-56, -54, 54, 54], art: [-53, -50, 50, 50], frames: 6, fps: 9, facing: 'side', ss: 1.5,
  build: (b) => puffedRig(b, BURST, 16, 8.5),
};

// ---------------------------------------------------------------- S02 Ice Jelly

const ICE: JellyColors = {
  crown: '#5cd6ff', mid: '#a8ecff', skirt: '#eafcff', inner: 'rgba(255,255,255,0.9)', frill: '#c8f4ff', frillDark: '#5cb8f0', strand: 'rgba(205,245,255,0.85)',
  iris: '#2a7fd6', blush: 'rgba(120,170,255,0.6)', tint: [0.36, 0.62, 0.96],
  extra: (x) => {
    // A snowflake glowing on top of the bell, above the face.
    x.save();
    x.translate(0, -37);
    x.strokeStyle = 'rgba(255,255,255,0.96)';
    x.lineWidth = 2;
    x.lineCap = 'round';
    x.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const c = Math.cos(a);
      const s = Math.sin(a);
      x.moveTo(0, 0);
      x.lineTo(c * 9.5, s * 9.5);
      for (const q of [0.6]) {
        const bx = c * 9.5 * q;
        const by = s * 9.5 * q;
        x.moveTo(bx, by);
        x.lineTo(bx + Math.cos(a + 0.9) * 3.4, by + Math.sin(a + 0.9) * 3.4);
        x.moveTo(bx, by);
        x.lineTo(bx + Math.cos(a - 0.9) * 3.4, by + Math.sin(a - 0.9) * 3.4);
      }
    }
    x.stroke();
    x.restore();
  },
};

export const S02: CreatureDef = {
  id: 'S02', size: 110, box: [-50, -56, 50, 56], art: [-42, -52, 42, 52], frames: 8, fps: 9, facing: 'upright', ss: 1.4,
  build: (b) => jellyRig(b, ICE),
};

// ---------------------------------------------------------------- S03 Spark Eel

const eelSpine: S[] = [
  [51, 2, 2.6], [46, 1, 9], [37, -1, 11.4], [23, -3, 12], [7, 1, 11.6], [-9, 5, 10.6], [-24, 3, 9], [-36, -2, 6.8], [-46, -5, 3.8], [-53, -5, 1],
];

function bolt(x: Ctx, pts: Array<[number, number]>, core: string, glow: string, w: number): void {
  x.save();
  x.lineJoin = 'round';
  x.lineCap = 'round';
  x.beginPath();
  pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])));
  x.globalCompositeOperation = 'lighter';
  x.strokeStyle = glow;
  x.lineWidth = w * 4;
  x.stroke();
  x.lineWidth = w * 2.2;
  x.stroke();
  x.strokeStyle = core;
  x.lineWidth = w;
  x.stroke();
  x.restore();
}

export const S03: CreatureDef = {
  id: 'S03', size: 170, box: [-58, -38, 58, 38], art: [-54, -24, 52, 26], frames: 8, fps: 10, facing: 'side', ss: 1.15,
  build(b) {
    const outline = tube(eelSpine, 4);
    const finSpine: S[] = eelSpine.slice(2).map((p, i, all) => [p[0], p[1], p[2] + 8.5 * Math.sin(((i + 0.6) / all.length) * Math.PI)]);
    const finOutline = tube(finSpine, 4);
    const ribbon = b.part({
      box: [-56, -24, 42, 28],
      paint: (x) => {
        fillPath(x, finOutline, linear(x, 0, -22, 0, 26, [[0, '#7cf0d4'], [0.5, '#14c8c8'], [1, '#7cf0d4']]));
        clipped(x, finOutline, () => {
          x.strokeStyle = 'rgba(0,70,110,0.45)';
          x.lineWidth = 0.9;
          x.beginPath();
          const s2 = sampleSpine(finSpine, 4);
          for (let i = 1; i < s2.length; i += 2) {
            const q = s2[i]!;
            x.moveTo(q[0], q[1] - 30);
            x.lineTo(q[0] - 4, q[1] + 30);
          }
          x.stroke();
        });
      },
      lit: { dome: 3, soften: 0.4, spec: 0.3, gloss: 24, sheen: 0.06, shade: 0.5, rim: 0.3, tint: COOL, lineSolid: 0.8, line: 0.9 },
    });
    const body = b.part({
      box: [-56, -17, 55, 19],
      paint: (x) => {
        x.beginPath();
        trace(x, outline);
        x.fillStyle = linear(x, 0, -14, 0, 15, [[0, '#123f9a'], [0.42, '#1868d8'], [0.62, '#2cc8e8'], [1, '#c8fff0']]);
        x.fill();
        clipped(x, outline, () => {
          // the lightning stripe along the flank
          const zig: P[] = [[32, -3, 1], [25, -7, 1], [19, -1, 1], [12, -5, 1], [6, 2, 1], [-1, -3, 1], [-7, 4, 1], [-14, 0, 1], [-20, 5, 1], [-27, 0, 1], [-33, 2, 1], [-44, -5, 1]];
          x.beginPath();
          trace(x, zig, false, 0.02);
          x.strokeStyle = '#ffe433';
          x.lineWidth = 3.2;
          x.lineJoin = 'round';
          x.stroke();
        });
        blush(x, 38, 6, 5, 3.4, 'rgba(255,90,170,0.6)');
      },
      bump: (x) => circle(x, 37, -4, 7.2, 'rgba(50,50,50,0.5)'),
      lit: { dome: 12, soften: 1, tint: COOL, spec: 0.7, gloss: 50, sheen: 0.16, line: 1.2, lineDark: 0.75, rim: 0.7, bumpPx: 0.7 },
    });
    b.over(body, (x) => {
      eye(x, 37, -4, 7.2, { rim: 'rgba(6,20,80,0.9)', iris: '#17a79a' });
      smile(x, 40, 6, 50.5, 3.6, 2.2, 1.5, 'rgba(6,20,70,0.9)');
    });
    const pec = finPart(b, [8, 0, 36, 20], {
      rim: [[28, 5], [19, 6], [12, 11], [14, 15], [23, 15], [29, 10]], base: [[28, 5], [29, 7], [29, 10]],
      rays: 4, root: '#ffe433', tip: '#fff6a0', ray: 'rgba(170,110,0,0.5)', tipAlpha: 0.95,
    });
    const all = b.stack([-58, -38, 58, 38], ribbon, body);
    const o: SwimOpts = { head: 34, tail: -54, amp: 11, waves: 1.05, fore: 0 };
    return (ctx, phase, v) => {
      swim(ctx, v, all, phase, o);
      blitAt(ctx, pec, 28, 7, Math.sin(TAU * phase * 2) * 0.3, 1, 1, 0, swimDy(28, phase, o));
      const frame = Math.round(phase * 8);
      const rand = makeRng(77 + frame * 13);
      for (let i = 0; i < 2; i++) {
        const side = i ? -1 : 1;
        const x0 = lerp(-30, 22, rand());
        const pts: Array<[number, number]> = [];
        const base = swimDy(x0, phase, o) + side * lerp(9, 13, rand());
        let px = x0;
        let py = base;
        for (let k = 0; k < 4; k++) {
          pts.push([px, py]);
          px += k % 2 ? 3.4 : -3.4;
          py += side * lerp(2.6, 4.2, rand());
        }
        bolt(ctx, pts, '#fffde0', 'rgba(255,214,50,0.3)', 1.1);
      }
    };
  },
};

// ---------------------------------------------------------------- S04 Rainbow Starfish

function starOutline(): P[] {
  const pts: P[] = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * TAU) / 5;
    const inner = a + TAU / 10;
    const sp = 0.2;
    pts.push([Math.cos(a - sp) * 42, Math.sin(a - sp) * 42 + 3]);
    pts.push([Math.cos(a) * 49.5, Math.sin(a) * 49.5 + 3]);
    pts.push([Math.cos(a + sp) * 42, Math.sin(a + sp) * 42 + 3]);
    pts.push([Math.cos(inner) * 25, Math.sin(inner) * 25 + 3]);
  }
  return pts;
}

export const S04: CreatureDef = {
  id: 'S04', size: 110, box: [-56, -56, 56, 56], art: [-48, -48, 48, 46], frames: 8, fps: 8, facing: 'upright', ss: 1.4,
  build(b) {
    const out = starOutline();
    const bumps: Array<[number, number, number]> = [];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * TAU) / 5;
      for (let j = 0; j < 4; j++) {
        const r = 22 + j * 7;
        bumps.push([Math.cos(a) * r, Math.sin(a) * r + 3, 2.5 - j * 0.32]);
        if (j < 2) {
          for (const s of [-1, 1]) {
            const q = a + (s * 5.2) / r;
            bumps.push([Math.cos(q) * r, Math.sin(q) * r + 3, 1.7]);
          }
        }
      }
    }
    const body = b.part({
      box: [-52, -50, 52, 52],
      paint: (x) => {
        x.beginPath();
        trace(x, out);
        x.fillStyle = '#fff';
        x.fill();
        clipped(x, out, () => {
          const n = 90;
          for (let i = 0; i < n; i++) {
            const a0 = -Math.PI / 2 - 0.63 + (i / n) * TAU;
            const a1 = a0 + TAU / n + 0.02;
            x.beginPath();
            x.moveTo(0, 3);
            x.arc(0, 3, 60, a0, a1);
            x.closePath();
            x.fillStyle = hsl((i / n) * 330, 95, 58);
            x.fill();
          }
          x.fillStyle = radial(x, 0, 3, 6, 0, 3, 26, [[0, '#fff3b8'], [0.55, 'rgba(255,238,170,0.92)'], [1, 'rgba(255,238,170,0)']]);
          x.fillRect(-30, -30, 60, 60);
          for (const [px, py, r] of bumps) circle(x, px, py, r, 'rgba(255,255,255,0.72)');
        });
        blush(x, -14, 11, 5.6, 4, 'rgba(255,90,130,0.6)');
        blush(x, 14, 11, 5.6, 4, 'rgba(255,90,130,0.6)');
      },
      bump: (x) => {
        for (const [px, py, r] of bumps) circle(x, px, py, r, 'rgba(255,255,255,0.85)');
      },
      lit: { dome: 17, soften: 1.3, tint: [0.6, 0.42, 0.8], spec: 0.62, gloss: 34, sheen: 0.2, rim: 0.55, line: 1.2, lineDark: 0.62, bumpPx: 0.9 },
    });
    b.over(body, (x) => {
      eye(x, -9.5, 0, 7.8, { rim: 'rgba(120,60,20,0.75)', iris: '#a0522d', look: [0.12, 0.05] });
      eye(x, 9.5, 0, 7.8, { rim: 'rgba(120,60,20,0.75)', iris: '#a0522d', look: [0.12, 0.05] });
      smile(x, -5.5, 10, 5.5, 10, 3.2, 2, 'rgba(120,30,40,0.9)');
    });
    return (ctx, phase) => {
      const t = Math.sin(TAU * phase);
      blitAt(ctx, body, 0, 3, t * 0.085, 1 + t * 0.022, 1 - t * 0.022);
    };
  },
};

// ---------------------------------------------------------------- S05 Treasure Crab

export const S05: CreatureDef = {
  id: 'S05', size: 120, box: [-58, -56, 58, 52], art: [-52, -50, 52, 46], frames: 8, fps: 10, facing: 'upright', ss: 1.3,
  build(b) {
    const shellA = '#f4502a';
    const shellB = '#ff8a4a';
    const litLimb = { dome: 5, soften: 0.6, tint: WARM, spec: 0.6, gloss: 34, line: 1.2, lineDark: 0.72 };
    const legPaint = (x: Ctx, side: number): void => {
      for (let i = 0; i < 3; i++) {
        const y0 = 10 + i * 8.5;
        const pts: S[] = [[side * 24, y0, 4.4], [side * (38 - i * 1.5), y0 + 2 + i, 3.5], [side * (46 - i * 3), y0 + 12 + i * 2, 1.4]];
        fillPath(x, tube(pts, 4), linear(x, 0, y0, 0, y0 + 16, [[0, shellB], [1, shellA]]));
      }
    };
    const legs = [-1, 1].map((s) =>
      b.part({ box: s < 0 ? [-54, 2, -18, 46] : [18, 2, 54, 46], paint: (x) => legPaint(x, s), lit: litLimb }),
    );
    const clawPts = (s: number, big: number): { arm: S[]; pinch: P[]; low: P[] } => {
      const cx = s * 41;
      const cy = -13;
      const r = 13 * big;
      return {
        arm: [[s * 24, 2, 4.6], [s * 36, 0, 4.4], [cx, cy + 7, 5]],
        pinch: [[cx - s * r * 0.98, cy + r * 0.2], [cx - s * r * 0.96, cy - r * 0.45], [cx - s * r * 0.4, cy - r * 1.2], [cx + s * r * 0.42, cy - r * 1.24], [cx + s * r * 0.3, cy - r * 0.55], [cx + s * r * 0.02, cy - r * 0.08, 1], [cx + s * r * 0.86, cy - r * 0.32], [cx + s * r * 0.95, cy + r * 0.42], [cx + s * r * 0.3, cy + r * 0.92]],
        low: [],
      };
    };
    const claws = [-1, 1].map((s) => {
      const c = clawPts(s, s > 0 ? 1.12 : 0.95);
      return b.part({
        box: s < 0 ? [-58, -34, -18, 12] : [18, -36, 58, 12],
        paint: (x) => {
          fillPath(x, tube(c.arm, 4), shellA);
          fillPath(x, c.pinch, linear(x, 0, -30, 0, 4, [[0, '#ff6a3a'], [1, '#f43f2a']]));
        },
        lit: { ...litLimb, dome: 12, soften: 1, spec: 0.72, gloss: 44 },
      });
    });
    const chestPts: P[] = [[-18, -22, 1], [-18, -41], [-14, -49], [14, -49], [18, -41], [18, -22, 1]];
    const chest = b.part({
      box: [-22, -53, 22, -18],
      paint: (x) => {
        fillPath(x, chestPts, linear(x, 0, -49, 0, -22, [[0, '#c4762f'], [1, '#8a4c1c']]));
        clipped(x, chestPts, () => {
          x.fillStyle = '#ffd24a';
          x.fillRect(-19, -40, 38, 3);
          x.fillRect(-11.5, -51, 3.2, 32);
          x.fillRect(8.3, -51, 3.2, 32);
          x.strokeStyle = 'rgba(70,30,6,0.5)';
          x.lineWidth = 0.8;
          x.beginPath();
          for (const yy of [-45, -31, -26]) {
            x.moveTo(-18, yy);
            x.lineTo(18, yy);
          }
          x.stroke();
        });
        circle(x, 0, -38, 4.6, '#ffd24a');
        ellipse(x, 0, -37.6, 1.3, 2.1, 0, '#7f4418');
      },
      lit: { dome: 8, soften: 0.7, tint: WARM, spec: 0.6, gloss: 40, line: 1.2, lineDark: 0.72 },
    });
    const bodyPts: P[] = [[0, -19], [18, -18], [32, -10], [37, 3], [32, 15], [19, 24], [0, 27], [-19, 24], [-32, 15], [-37, 3], [-32, -10], [-18, -18]];
    const body = b.part({
      box: [-41, -24, 41, 32],
      paint: (x) => {
        x.beginPath();
        trace(x, bodyPts);
        x.fillStyle = linear(x, 0, -19, 0, 27, [[0, '#f2441f'], [0.55, '#ff7a42'], [1, '#ffc48a']]);
        x.fill();
        clipped(x, bodyPts, () => {
          for (const [px, py, r] of [[-24, -7, 2.8], [24, -7, 2.8], [-29, 5, 2], [29, 5, 2], [-14, -13, 2], [14, -13, 2]] as const) circle(x, px, py, r, 'rgba(255,214,120,0.85)');
        });
        blush(x, -21, 12, 6.4, 4.4, 'rgba(255,60,90,0.6)');
        blush(x, 21, 12, 6.4, 4.4, 'rgba(255,60,90,0.6)');
      },
      bump: (x) => {
        circle(x, -24, -7, 3, 'rgba(255,255,255,0.8)');
        circle(x, 24, -7, 3, 'rgba(255,255,255,0.8)');
      },
      lit: { dome: 24, soften: 1.6, tint: WARM, spec: 0.72, gloss: 44, sheen: 0.2, line: 1.3, lineDark: 0.72, bumpPx: 1 },
    });
    b.over(body, (x) => smile(x, -10, 12, 10, 12, 5, 2.3, 'rgba(110,20,30,0.9)'));
    const stalks = b.part({
      box: [-28, -26, 28, 0],
      paint: (x) => {
        fillPath(x, tube([[-15, -8, 3.4], [-19, -14, 2.8], [-20, -18, 2.6]], 3), shellB);
        fillPath(x, tube([[15, -8, 3.4], [19, -14, 2.8], [20, -18, 2.6]], 3), shellB);
      },
      lit: litLimb,
    });
    const eyes = b.blank([-32, -34, 32, -8], (x) => {
      eye(x, -20, -20, 8.6, { rim: 'rgba(130,40,10,0.85)', look: [0.14, 0.1] });
      eye(x, 20, -20, 8.6, { rim: 'rgba(130,40,10,0.85)', look: [0.14, 0.1] });
    });
    return (ctx, phase) => {
      const t = Math.sin(TAU * phase);
      const u = Math.sin(TAU * phase * 2);
      const bob = u * 0.9;
      blitAt(ctx, legs[0]!, -24, 14, u * 0.09);
      blitAt(ctx, legs[1]!, 24, 14, -u * 0.09);
      ctx.save();
      ctx.translate(0, bob);
      blitAt(ctx, chest, 0, -18, t * 0.03);
      blit(ctx, stalks);
      blitAt(ctx, claws[0]!, -24, 2, 0.05 + t * 0.12);
      blitAt(ctx, claws[1]!, 24, 2, -0.05 + t * 0.1);
      blit(ctx, body);
      blit(ctx, eyes);
      ctx.restore();
    };
  },
};

// ---------------------------------------------------------------- S06 Laser Shrimp

const shrimpSpine: S[] = [
  [42, -13, 7.5], [32, -14, 14], [17, -14, 17.5], [1, -11, 17.5], [-14, -2, 16], [-24, 11, 13.5], [-27, 25, 10], [-22, 36, 6.5],
];

export const S06: CreatureDef = {
  id: 'S06', size: 110, box: [-48, -56, 76, 58], art: [-44, -50, 58, 52], frames: 8, fps: 10, facing: 'side', ss: 1.4,
  build(b) {
    const out = tube(shrimpSpine, 5);
    const seg = sampleSpine(shrimpSpine, 5);
    const bands: number[] = [12, 15, 18, 21, 24, 27, 30];
    const body = b.part({
      box: [-44, -36, 52, 46],
      paint: (x) => {
        x.beginPath();
        trace(x, out);
        x.fillStyle = linear(x, 44, -30, -30, 40, [[0, '#ff7fb2'], [0.5, '#ff5f9a'], [1, '#ff9a6a']]);
        x.fill();
        clipped(x, out, () => {
          x.lineCap = 'butt';
          for (const i of bands) {
            const p = seg[i]!;
            const q = seg[i + 1]!;
            const a = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2;
            x.beginPath();
            x.moveTo(p[0] + Math.cos(a) * 22, p[1] + Math.sin(a) * 22);
            x.quadraticCurveTo(p[0] + 2 * Math.cos(a - Math.PI / 2), p[1] + 2 * Math.sin(a - Math.PI / 2), p[0] - Math.cos(a) * 22, p[1] - Math.sin(a) * 22);
            x.strokeStyle = 'rgba(70,240,255,0.95)';
            x.lineWidth = 3;
            x.stroke();
          }
          fillPath(x, [[60, 0], [30, 2], [8, 6], [-6, 12], [-14, 24], [-20, 40], [-40, 40], [-4, 56], [60, 40]], 'rgba(255,238,214,0.6)');
        });
        blush(x, 35, -4, 5.4, 3.8, 'rgba(255,40,120,0.6)');
      },
      bump: (x) => {
        for (const i of bands) {
          const p = seg[i]!;
          const q = seg[i + 1]!;
          const a = Math.atan2(q[1] - p[1], q[0] - p[0]) + Math.PI / 2;
          line(x, p[0] + Math.cos(a) * 20, p[1] + Math.sin(a) * 20, p[0] - Math.cos(a) * 20, p[1] - Math.sin(a) * 20, 'rgba(40,40,40,0.7)', 2);
        }
        circle(x, 30, -20, 9, 'rgba(255,255,255,0.4)');
      },
      lit: { dome: 17, soften: 1.2, tint: [0.76, 0.38, 0.66], spec: 0.72, gloss: 42, sheen: 0.2, rim: 0.65, line: 1.2, lineDark: 0.7, bumpPx: 0.9 },
    });
    const rostrum = b.part({
      box: [26, -36, 60, -18],
      paint: (x) => fillPath(x, [[28, -25], [40, -26], [47, -29], [49, -26.5], [42, -21], [30, -20]], '#ff7fb2'),
      lit: { dome: 3, soften: 0.4, tint: WARM, spec: 0.5, line: 1, lineDark: 0.7 },
    });
    b.over(body, (x) => {
      eye(x, 30, -20, 8.8, { rim: 'rgba(130,0,70,0.85)', iris: '#17a79a' });
      smile(x, 36, -6, 47, -9, 2.4, 1.7, 'rgba(110,0,60,0.9)');
    });
    const tailFan = b.part({
      box: [-46, 26, 2, 58],
      paint: (x) => {
        for (const a of [2.75, 2.25, 1.75, 1.25, 0.75]) {
          const pts = rotatePts([[0, -2.6], [10, -5.6], [18.5, -3.4], [20.5, 0], [18.5, 3.4], [10, 5.6], [0, 2.6]], a, 0, 0).map((p) => [p[0] - 22, p[1] + 35] as P);
          fillPath(x, pts, radial(x, -22, 35, 3, -22, 35, 21, [[0, '#ff7a84'], [0.6, '#ff9ac6'], [1, '#6ae8ff']]));
        }
      },
      lit: { dome: 2.6, soften: 0.3, tint: WARM, spec: 0.5, line: 0.9, lineDark: 0.7, shade: 0.5 },
    });
    const clawBody: P[] = [[26, 9], [34, 4], [44, 3], [53, 8], [55, 16], [50, 23], [40, 26], [30, 23], [25, 16]];
    const clawFinger: P[] = [[36, 4], [43, -2], [52, -4], [59, 0], [59, 5], [52, 7], [42, 8]];
    const claw = b.part({
      box: [8, -8, 64, 30],
      paint: (x) => {
        fillPath(x, tube([[8, 3, 3.2], [18, 9, 3.8], [28, 13, 5]], 3), '#ff6fa8');
        fillPath(x, clawFinger, linear(x, 38, 3, 60, 2, [[0, '#ff4f8f'], [1, '#8af4ff']]));
        fillPath(x, clawBody, linear(x, 28, 4, 54, 24, [[0, '#ff4f8f'], [0.6, '#ff72c4'], [1, '#a890ff']]));
      },
      lit: { dome: 11, soften: 0.9, tint: [0.76, 0.38, 0.66], spec: 0.72, gloss: 46, line: 1.2, lineDark: 0.72 },
    });
    const all = b.stack([-46, -36, 54, 58], tailFan, rostrum, body);
    return (ctx, phase, v) => {
      const t = Math.sin(TAU * phase);
      const flick = Math.sin(TAU * phase - 0.8);
      // antennae, far side first
      for (const [ph, up] of [[0, 1], [0.4, 0.82]] as const) {
        const pts: P[] = [];
        for (let i = 0; i <= 7; i++) {
          const q = i / 7;
          pts.push([lerp(47, 10, q) + Math.sin(TAU * (phase + ph - q)) * q * 2.5, -22 - Math.sin(q * 2.7) * 28 * up + q * q * 8 + Math.cos(TAU * (phase + ph - q * 0.6)) * q * 3]);
        }
        strokePath(ctx, pts, '#ff9ac6', 1.3);
      }
      // swimmerets paddling in sequence
      for (let i = 0; i < 4; i++) {
        const px = 10 - i * 10;
        const py = 7 + i * 3.4 + (i > 1 ? (i - 1) * 3 : 0);
        const ang = 1.4 + Math.sin(TAU * (phase - i * 0.16)) * 0.3 + i * 0.26;
        strokePath(ctx, [[px, py], [px + Math.cos(ang) * 8, py + Math.sin(ang) * 8], [px + Math.cos(ang + 0.3) * 14, py + Math.sin(ang + 0.3) * 14]], '#ffb0d0', 3.4);
      }
      warpCols(ctx, v, all, (x) => (clamp((-6 - x) / 40) ** 2) * flick * 3, null, null, 1);
      blitAt(ctx, claw, 10, 2, t * 0.05, 1, 1);
      const r = 11 + t * 2;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      circle(ctx, 60, 2, r, radial(ctx, 60, 2, 0, 60, 2, r, [[0, 'rgba(170,250,255,0.85)'], [0.35, 'rgba(90,220,255,0.34)'], [1, 'rgba(60,180,255,0)']]));
      ctx.restore();
    };
  },
};

export const SPECIALS: CreatureDef[] = [S01, S02, S03, S04, S05, S06];

