// Captain Otto and the app icon. Otto's parts are baked once per size, then posed cheaply every frame.

import type { OttoPose } from './types';
import { Builder, tube, type S } from './rig';
import { F01 } from './fish';
import {
  TAU,
  blit,
  blitAt,
  circle,
  clipped,
  ctxOf,
  ellipse,
  fillPath,
  free,
  line,
  linear,
  makeRng,
  newCanvas,
  radial,
  releaseScratch,
  type Ctx,
  type P,
  type Part,
  type Rgb,
} from './paint';

const FUR_TOP = '#a8723f';
const FUR_MID = '#8f5c2e';
const FUR_DARK = '#6f4522';
const CREAM = '#ffe9c8';
const SHADOW: Rgb = [0.74, 0.48, 0.5];
const furLit = { tint: SHADOW, spec: 0.14, gloss: 14, sheen: 0.05, rim: 0.42, rimColor: [1, 0.9, 0.76] as Rgb, line: 1, lineDark: 0.66 };

interface OttoRig {
  b: Builder;
  tail: Part;
  body: Part;
  feet: Part;
  headOpen: Part;
  headClosed: Part;
  headHappy: Part;
  hat: Part;
  armDown: Part;
  armUp: Part;
  armPoint: Part;
  armRest: Part;
}

function armPart(b: Builder, spine: S[], paw: readonly [number, number]): Part {
  const box = [
    Math.min(...spine.map((p) => p[0])) - 12,
    Math.min(...spine.map((p) => p[1])) - 12,
    Math.max(...spine.map((p) => p[0])) + 12,
    Math.max(...spine.map((p) => p[1])) + 12,
  ] as const;
  const first = spine[0]!;
  return b.part({
    box,
    paint: (x) => {
      const fill = linear(x, first[0], first[1], paw[0], paw[1], [[0, FUR_MID], [1, FUR_DARK]]);
      fillPath(x, tube(spine, 4), fill);
      circle(x, first[0], first[1], first[2], FUR_MID);
      circle(x, paw[0], paw[1], 6.8, FUR_DARK);
    },
    lit: { ...furLit, dome: 7, soften: 0.7 },
  });
}

/** Bead eyes: an otter's are small, dark and shiny, which is also what makes him cute rather than startled. */
function beadEye(x: Ctx, cx: number, cy: number): void {
  circle(x, cx, cy, 5.4, radial(x, cx - 0.8, cy - 1.2, 0.5, cx, cy, 5.4, [[0, '#4a2c20'], [0.7, '#20100c'], [1, '#120806']]));
  ellipse(x, cx - 1.6, cy - 2, 1.9, 1.7, 0, '#ffffff');
  circle(x, cx + 1.9, cy + 1.9, 0.85, 'rgba(255,255,255,0.8)');
}

function headPart(b: Builder, face: 'open' | 'closed' | 'happy'): Part {
  const skull: P[] = [[0, -89], [15, -87], [25, -77], [26, -65], [21, -54], [10, -48], [0, -47], [-10, -48], [-21, -54], [-26, -65], [-25, -77], [-15, -87]];
  const head = b.part({
    box: [-34, -96, 34, -42],
    paint: (x) => {
      for (const s of [-1, 1]) {
        circle(x, s * 22, -84, 6.2, FUR_MID);
        circle(x, s * 22, -83.4, 3.3, '#e8a890');
      }
      fillPath(x, skull, linear(x, 0, -89, 0, -47, [[0, FUR_TOP], [0.6, FUR_MID], [1, '#a06a38']]));
      clipped(x, skull, () => {
        ellipse(x, 0, -56.5, 17, 11.5, 0, CREAM);
        ellipse(x, -7, -72, 7, 6, 0, 'rgba(255,233,200,0.32)');
        ellipse(x, 7, -72, 7, 6, 0, 'rgba(255,233,200,0.32)');
      });
      for (const s of [-1, 1]) {
        x.fillStyle = radial(x, s * 16, -58, 0, s * 16, -58, 6, [[0, 'rgba(255,110,110,0.6)'], [1, 'rgba(255,110,110,0)']]);
        x.fillRect(s * 16 - 7, -65, 14, 14);
      }
    },
    bump: (x) => {
      ellipse(x, 0, -56, 17, 11, 0, 'rgba(255,255,255,0.7)');
    },
    lit: { ...furLit, dome: 22, soften: 1.6, bumpPx: 1.6 },
  });
  b.over(head, (x) => {
    fillPath(x, [[-4.2, -64], [0, -66], [4.2, -64], [3, -60.6], [0, -59], [-3, -60.6]], linear(x, 0, -66, 0, -59, [[0, '#4a2c20'], [1, '#2a1610']]));
    ellipse(x, -1.2, -63.7, 1.3, 0.8, -0.3, 'rgba(255,255,255,0.85)');
    x.strokeStyle = '#3a2016';
    x.lineWidth = 1.3;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(0, -59);
    x.lineTo(0, -56.6);
    if (face === 'happy') {
      x.stroke();
      fillPath(x, [[-8, -56.6], [0, -55.8], [8, -56.6], [6, -51.5], [0, -49.6], [-6, -51.5]], '#8e2f35');
      ellipse(x, 0, -51.4, 4, 2.2, 0, '#ff8f8f');
    } else {
      x.moveTo(-6.4, -57.4);
      x.quadraticCurveTo(-3, -54.6, 0, -56.6);
      x.quadraticCurveTo(3, -54.6, 6.4, -57.4);
      x.stroke();
    }
    const whisk = (y: number, tilt: number): void => {
      for (const s of [-1, 1]) line(x, s * 12, y, s * 26, y + tilt, 'rgba(70,40,24,0.55)', 0.7);
    };
    whisk(-60, -3);
    whisk(-57.5, 0);
    whisk(-55, 3);
    if (face === 'closed') {
      for (const s of [-1, 1]) {
        x.beginPath();
        x.moveTo(s * 5.4, -70);
        x.quadraticCurveTo(s * 11, -66, s * 16.6, -70);
        x.strokeStyle = '#3a2016';
        x.lineWidth = 1.7;
        x.stroke();
      }
    } else {
      beadEye(x, -11, -70.5);
      beadEye(x, 11, -70.5);
    }
  });
  return head;
}

function buildOtto(scale: number): OttoRig {
  const b = new Builder(scale, 1);
  const tail = b.part({
    box: [-50, -46, -8, 0],
    paint: (x) => {
      const out = tube([[-12, -11, 8.6], [-26, -8.6, 9], [-38, -13, 7.6], [-44, -24, 5.4], [-44, -34, 2.4]], 4);
      fillPath(x, out, linear(x, -14, 0, -42, 0, [[0, FUR_MID], [1, FUR_DARK]]));
      circle(x, -44, -34.4, 2.4, FUR_DARK);
    },
    lit: { ...furLit, dome: 7, soften: 0.6 },
  });
  const feet = b.part({
    box: [-28, -11, 28, 0],
    paint: (x) => {
      ellipse(x, -13, -4.8, 12, 5, 0.1, FUR_DARK);
      ellipse(x, 13, -4.8, 12, 5, -0.1, FUR_DARK);
    },
    lit: { ...furLit, dome: 5, soften: 0.4 },
  });
  const bodyPts: P[] = [[0, -56], [14, -53], [23, -41], [27, -24], [24, -10], [13, -3], [0, -2], [-13, -3], [-24, -10], [-27, -24], [-23, -41], [-14, -53]];
  const body = b.part({
    box: [-31, -60, 31, 0],
    paint: (x) => {
      fillPath(x, bodyPts, linear(x, 0, -56, 0, -2, [[0, FUR_TOP], [1, FUR_MID]]));
      clipped(x, bodyPts, () => {
        ellipse(x, 0, -25, 17.5, 25, 0, linear(x, 0, -50, 0, 0, [[0, CREAM], [1, '#ffdcae']]));
      });
    },
    bump: (x) => ellipse(x, 0, -25, 17.5, 25, 0, 'rgba(255,255,255,0.55)'),
    lit: { ...furLit, dome: 25, soften: 1.6, bumpPx: 1 },
  });
  const crown: P[] = [[-20, -85], [-27, -93], [-24, -103], [-10, -109], [10, -109], [24, -103], [27, -93], [20, -85]];
  const hat = b.part({
    box: [-30, -112, 30, -78],
    paint: (x) => {
      fillPath(x, crown, linear(x, 0, -109, 0, -86, [[0, '#f6f9fc'], [1, '#c6d4e4']]));
      x.fillStyle = '#1c3f78';
      x.beginPath();
      x.roundRect(-21.4, -91, 42.8, 7.4, 2);
      x.fill();
      x.fillStyle = '#ffd24a';
      x.fillRect(-21, -91.6, 42, 1.3);
      fillPath(x, [[-22, -84.4], [-12, -86], [12, -86], [22, -84.4], [17, -79.6], [0, -78.2], [-17, -79.6]], linear(x, 0, -86, 0, -78, [[0, '#2a2f44'], [1, '#121522']]));
      // shell emblem
      circle(x, 0, -92, 5.8, '#ffd24a');
      x.strokeStyle = '#b5780c';
      x.lineWidth = 0.9;
      x.lineCap = 'round';
      x.beginPath();
      for (let i = -2; i <= 2; i++) {
        x.moveTo(0, -87.4);
        x.lineTo(i * 2.2, -96);
      }
      x.stroke();
    },
    lit: { ...furLit, tint: [0.56, 0.58, 0.9], dome: 9, soften: 0.7, spec: 0.22, gloss: 26, rim: 0.2 },
  });
  return {
    b,
    tail,
    feet,
    body,
    hat,
    headOpen: headPart(b, 'open'),
    headClosed: headPart(b, 'closed'),
    headHappy: headPart(b, 'happy'),
    armDown: armPart(b, [[19, -45, 7.4], [27, -37, 6.8], [30, -27, 6.2]], [30.4, -26]),
    armUp: armPart(b, [[19, -45, 7.4], [30, -54, 6.8], [36, -68, 6.2]], [36.6, -69.4]),
    armPoint: armPart(b, [[19, -45, 7.4], [33, -49, 6.8], [47, -52, 6.2]], [48.4, -52.3]),
    armRest: armPart(b, [[21, -42, 7.2], [23, -32, 6.6], [10, -25, 6.2]], [9, -25]),
  };
}

function mirrored(ctx: Ctx, draw: () => void): void {
  ctx.save();
  ctx.scale(-1, 1);
  draw();
  ctx.restore();
}

interface CacheEntry {
  key: number;
  rig: OttoRig;
}

const cache: CacheEntry[] = [];

function rigFor(scale: number): OttoRig {
  const key = Math.round(scale * 8) / 8;
  let e = cache.find((c) => c.key === key);
  if (!e) {
    e = { key, rig: buildOtto(key) };
    releaseScratch();
    cache.push(e);
    if (cache.length > 3) cache.shift()!.rig.b.dispose();
  }
  return e.rig;
}

function poseOtto(ctx: Ctx, r: OttoRig, pose: OttoPose, t: number): void {
  const breathe = Math.sin(t * 2.1);
  if (pose === 'cheer') {
    const hop = Math.abs(Math.sin(t * 4.2)) * 3.4;
    const wave = Math.sin(t * 8.4) * 0.14;
    blit(ctx, r.feet);
    ctx.save();
    ctx.translate(0, -hop);
    blitAt(ctx, r.tail, -14, -10, Math.sin(t * 8.4) * 0.14);
    blitAt(ctx, r.armUp, 19, -45, -wave);
    mirrored(ctx, () => blitAt(ctx, r.armUp, 19, -45, wave));
    blit(ctx, r.body);
    blitAt(ctx, r.headHappy, 0, -50, Math.sin(t * 4.2) * 0.05);
    blitAt(ctx, r.hat, 0, -50, Math.sin(t * 4.2) * 0.05, 1, 1, 0, -hop * 0.3);
    ctx.restore();
    return;
  }
  if (pose === 'sleep') {
    const slow = Math.sin(t * 1.1);
    ctx.save();
    blit(ctx, r.feet);
    blitAt(ctx, r.tail, -14, -10, slow * 0.02);
    ctx.save();
    ctx.translate(0, -2);
    ctx.scale(1 + slow * 0.012, 1 - slow * 0.016);
    ctx.translate(0, 2);
    blit(ctx, r.body);
    ctx.restore();
    blit(ctx, r.armRest);
    mirrored(ctx, () => blit(ctx, r.armRest));
    const tilt = 0.14 + slow * 0.012;
    blitAt(ctx, r.headClosed, 0, -50, tilt);
    blitAt(ctx, r.hat, 0, -50, tilt + 0.05);
    // A slow bubble from the nose instead of any letters.
    const cyc = (t * 0.32) % 1;
    const rr = 1.6 + cyc * 8.4;
    const bx = 7 + rr * 0.74;
    const by = -60.5 + rr * 0.4;
    ctx.globalAlpha = cyc > 0.92 ? (1 - cyc) * 12 : 1;
    circle(ctx, bx, by, rr, radial(ctx, bx, by, rr * 0.2, bx, by, rr, [[0, 'rgba(170,226,255,0.4)'], [0.82, 'rgba(170,226,255,0.56)'], [1, 'rgba(255,255,255,0.95)']]));
    ctx.lineWidth = Math.max(0.5, rr * 0.08);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(bx, by, rr, 0, TAU);
    ctx.stroke();
    circle(ctx, bx - rr * 0.34, by - rr * 0.36, rr * 0.2, '#ffffff');
    ctx.restore();
    return;
  }
  blit(ctx, r.feet);
  const sw = Math.sin(t * 1.6);
  blitAt(ctx, r.tail, -14, -10, sw * 0.05);
  const nod = Math.sin(t * 1.3) * 0.03;
  if (pose === 'point') blitAt(ctx, r.armPoint, 19, -45, Math.sin(t * 3) * 0.04);
  else blitAt(ctx, r.armDown, 19, -45, breathe * 0.02);
  mirrored(ctx, () => blitAt(ctx, r.armDown, 19, -45, breathe * 0.02));
  ctx.save();
  ctx.translate(0, -2);
  ctx.scale(1 + breathe * 0.009, 1 - breathe * 0.012);
  ctx.translate(0, 2);
  blit(ctx, r.body);
  ctx.restore();
  if (pose === 'point') {
    blitAt(ctx, r.headOpen, 0, -50, 0.05 + nod);
    blitAt(ctx, r.hat, 0, -50, 0.05 + nod);
    return;
  }
  blitAt(ctx, r.headOpen, 0, -50, nod);
  blitAt(ctx, r.hat, 0, -50, nod);
}

export function drawOtto(ctx: CanvasRenderingContext2D, pose: OttoPose, x: number, y: number, height: number, t = 0): void {
  const m = ctx.getTransform();
  const density = Math.max(Math.hypot(m.a, m.b), 0.1);
  const k = height / 112;
  const rig = rigFor(k * density);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  poseOtto(ctx, rig, pose, t);
  ctx.restore();
}

/** Full-bleed icon: Otto with a clownfish in a bubble, on ocean blue, with no text. */
export function drawAppIcon(ctx: CanvasRenderingContext2D, size: number): void {
  const c = newCanvas(size, size);
  const x = ctxOf(c);
  x.fillStyle = radial(x, size * 0.5, size * 0.28, size * 0.05, size * 0.5, size * 0.5, size * 0.78, [[0, '#5fd4f2'], [0.5, '#1787c8'], [1, '#04395e']]);
  x.fillRect(0, 0, size, size);
  x.save();
  x.globalCompositeOperation = 'lighter';
  for (const [u, w, a] of [[0.24, 0.1, 0.13], [0.5, 0.15, 0.16], [0.76, 0.09, 0.12]] as const) {
    x.fillStyle = linear(x, 0, 0, 0, size, [[0, `rgba(190,245,255,${a})`], [1, 'rgba(190,245,255,0)']]);
    x.beginPath();
    x.moveTo(size * (u - w * 0.4), 0);
    x.lineTo(size * (u + w * 0.4), 0);
    x.lineTo(size * (u + w * 1.3), size);
    x.lineTo(size * (u - w * 1.3), size);
    x.closePath();
    x.fill();
  }
  x.restore();
  const r = makeRng(31);
  for (let i = 0; i < 12; i++) {
    const bx = r() * size;
    const by = r() * size;
    const br = size * (0.008 + r() * 0.018);
    x.strokeStyle = 'rgba(220,250,255,0.55)';
    x.lineWidth = Math.max(1, size * 0.003);
    x.beginPath();
    x.arc(bx, by, br, 0, TAU);
    x.stroke();
    circle(x, bx - br * 0.3, by - br * 0.3, br * 0.22, 'rgba(255,255,255,0.8)');
  }
  // Otto, head and shoulders, filling the frame
  const k = (size / 112) * 1.36;
  const rig = buildOtto(k);
  x.save();
  x.translate(size * 0.42, size * 1.44);
  x.scale(k, k);
  x.imageSmoothingQuality = 'high';
  blit(x, rig.body);
  blitAt(x, rig.headHappy, 0, -50, -0.05);
  blitAt(x, rig.hat, 0, -50, -0.05);
  x.restore();
  rig.b.dispose();
  // a fish in a bubble
  const fr = size * 0.21;
  const fx = size * 0.77;
  const fy = size * 0.77;
  const def = F01;
  const b = new Builder((fr * 1.5) / 100 * 2, 0.6);
  const paint = def.build(b);
  x.save();
  x.translate(fx, fy);
  const fs = (fr * 1.5) / 100;
  x.scale(fs, fs);
  paint(x, 0.08, { ox: fx, oy: fy, s: fs });
  x.restore();
  b.dispose();
  circle(x, fx, fy, fr, radial(x, fx, fy, fr * 0.3, fx, fy, fr, [[0, 'rgba(190,240,255,0.06)'], [0.82, 'rgba(190,240,255,0.16)'], [1, 'rgba(235,252,255,0.6)']]));
  x.lineWidth = Math.max(1.5, fr * 0.05);
  x.strokeStyle = 'rgba(255,255,255,0.92)';
  x.beginPath();
  x.arc(fx, fy, fr * 0.97, 0, TAU);
  x.stroke();
  x.fillStyle = 'rgba(255,255,255,0.92)';
  x.beginPath();
  x.ellipse(fx - fr * 0.42, fy - fr * 0.46, fr * 0.2, fr * 0.11, -0.75, 0, TAU);
  x.fill();
  releaseScratch();
  ctx.drawImage(c, 0, 0, size, size);
  free(c);
}

