// The five oceans and the caustics tile. Seabeds are lit noise fields baked small and scaled up, so they stay soft;
// the midground is lit props pushed to the edges, sharing one ground-shadow pass.

import type { OceanBake, OceanId } from './types';
import {
  TAU,
  circle,
  clamp,
  clipped,
  ctxOf,
  ellipse,
  fillPath,
  flatten,
  free,
  css,
  hexRgb,
  lerp,
  linear,
  lit,
  makeRng,
  mix,
  newCanvas,
  radial,
  releaseScratch,
  smoothstep,
  softBlur,
  strokePath,
  trace,
  type Cnv,
  type Ctx,
  type LitOpts,
  type P,
  type Rgb,
} from './paint';
import { sampleSpine, tube, type S } from './rig';

const MAX_SIDE = 2048;
const SIDE_LIGHT: Rgb = [-0.34, -0.5, 0.8];

// ---------------------------------------------------------------- noise

class Noise {
  private readonly grid = new Float32Array(256 * 256);

  constructor(seed: number) {
    const r = makeRng(seed);
    for (let i = 0; i < this.grid.length; i++) this.grid[i] = r();
  }

  at(x: number, y: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const g = this.grid;
    const a = g[(yi & 255) * 256 + (xi & 255)]!;
    const b = g[(yi & 255) * 256 + ((xi + 1) & 255)]!;
    const c = g[((yi + 1) & 255) * 256 + (xi & 255)]!;
    const d = g[((yi + 1) & 255) * 256 + ((xi + 1) & 255)]!;
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  fbm(x: number, y: number, oct: number): number {
    let s = 0;
    let a = 0.5;
    let f = 1;
    let n = 0;
    for (let i = 0; i < oct; i++) {
      s += this.at(x * f + i * 17, y * f - i * 11) * a;
      n += a;
      a *= 0.5;
      f *= 2.03;
    }
    return s / n;
  }
}

// ---------------------------------------------------------------- seabed

interface BedSpec {
  seed: number;
  dark: string;
  mid: string;
  light: string;
  /** Second material, patched in by low-frequency noise. */
  patch?: string;
  patchAt?: number;
  ripple: number;
  rippleFreq: number;
  rippleAngle: number;
  grain: number;
  relief: number;
  /** Centre brightness lift, so fish read best where they swim. */
  pool: number;
  /** Edge darkening. */
  edge: number;
}

function bakeSeabed(W: number, H: number, s: number, b: BedSpec): Cnv {
  const small = 3;
  const w = Math.ceil(W / small);
  const h = Math.ceil(H / small);
  const n = new Noise(b.seed);
  const field = new Float32Array(w * h);
  const tone = new Float32Array(w * h);
  const k = small / s; // design units per low-res pixel
  const ca = Math.cos(b.rippleAngle);
  const sa = Math.sin(b.rippleAngle);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ux = x * k;
      const uy = y * k;
      const low = n.fbm(ux * 0.0028, uy * 0.0028, 3);
      const mid = n.fbm(ux * 0.012 + 5, uy * 0.012 + 3, 4);
      const fine = n.fbm(ux * 0.05 + 9, uy * 0.05 + 1, 3);
      const warp = (low - 0.5) * 34 + (mid - 0.5) * 9;
      const r = Math.sin((ux * ca + uy * sa) * b.rippleFreq + warp);
      const sharp = r > 0 ? r * r * (3 - 2 * r) : -(r * r);
      const nx = x / w - 0.5;
      const ny = y / h - 0.5;
      const e = smoothstep(0.2, 0.62, Math.hypot(nx, ny * 1.1));
      field[y * w + x] = (low - 0.5) * 18 * b.relief + (mid - 0.5) * 4.5 * b.relief + fine * b.grain * 1.1 + sharp * b.ripple * (0.4 + e * 0.8);
      tone[y * w + x] = low * 0.85 + mid * 0.4 - 0.1 + sharp * 0.05;
    }
  }
  const dark = hexRgb(b.dark);
  const midC = hexRgb(b.mid);
  const lightC = hexRgb(b.light);
  const patch = b.patch ? hexRgb(b.patch) : null;
  const canvas = newCanvas(w, h);
  const cx = ctxOf(canvas);
  const img = cx.createImageData(w, h);
  const px = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const hx = field[y * w + (x + 1 < w ? x + 1 : x)]! - field[y * w + (x > 0 ? x - 1 : x)]!;
      const hy = field[(y + 1 < h ? y + 1 : y) * w + x]! - field[(y > 0 ? y - 1 : y) * w + x]!;
      const shade = 1 + clamp((-hx * SIDE_LIGHT[0] - hy * SIDE_LIGHT[1]) * -0.12, -0.2, 0.2);
      const t = clamp(tone[i]! * 1.25 - 0.1);
      let r: number;
      let g: number;
      let bl: number;
      if (t < 0.5) {
        const q = t * 2;
        r = lerp(dark[0], midC[0], q);
        g = lerp(dark[1], midC[1], q);
        bl = lerp(dark[2], midC[2], q);
      } else {
        const q = (t - 0.5) * 2;
        r = lerp(midC[0], lightC[0], q);
        g = lerp(midC[1], lightC[1], q);
        bl = lerp(midC[2], lightC[2], q);
      }
      if (patch) {
        const p = smoothstep((b.patchAt ?? 0.6) - 0.1, (b.patchAt ?? 0.6) + 0.12, n.fbm(x * k * 0.0042 + 31, y * k * 0.0042 + 7, 3)) * 0.8;
        r = lerp(r, patch[0], p);
        g = lerp(g, patch[1], p);
        bl = lerp(bl, patch[2], p);
      }
      const nx = x / w - 0.5;
      const ny = y / h - 0.5;
      const d = Math.hypot(nx, ny * 1.15);
      const v = (1 + (1 - smoothstep(0, 0.4, d)) * b.pool) * (1 - smoothstep(0.26, 0.74, d) * b.edge) * shade;
      const p = i * 4;
      px[p] = r * v;
      px[p + 1] = g * v;
      px[p + 2] = bl * v;
      px[p + 3] = 255;
    }
  }
  cx.putImageData(img, 0, 0);
  const out = newCanvas(W, H);
  const ox = ctxOf(out);
  ox.imageSmoothingEnabled = true;
  ox.imageSmoothingQuality = 'high';
  ox.drawImage(canvas, 0, 0, W, H);
  free(canvas);
  return out;
}

// ---------------------------------------------------------------- placing things

interface World {
  W: number;
  H: number;
  /** Pixels per design unit. */
  s: number;
  r: () => number;
}

function keepOut(w: World, x: number, y: number, m = 1): boolean {
  const dx = (x / w.W - 0.5) / (0.33 * m);
  const dy = (y / w.H - 0.47) / (0.3 * m);
  return dx * dx + dy * dy < 1;
}

/** A random spot outside the clear middle of the view. */
function edgeSpot(w: World, m = 1): [number, number] {
  for (let i = 0; i < 30; i++) {
    const x = w.r() * w.W;
    const y = w.r() * w.H;
    if (!keepOut(w, x, y, m)) return [x, y];
  }
  return [w.r() * w.W, w.r() < 0.5 ? 0 : w.H];
}

interface StampOpts {
  size: readonly [number, number];
  paint(x: Ctx): void;
  bump?(x: Ctx): void;
  /** Blurs the bump map, for lumpy surfaces with no creases. */
  bumpSoft?: number;
  lit?: LitOpts | null;
  rot?: number;
}

/** Paints and lights a prop around (0, 0) on its own canvas, then places it at (x, y) on the target. */
function stamp(target: Ctx, x: number, y: number, o: StampOpts): void {
  const w = Math.ceil(o.size[0]);
  const h = Math.ceil(o.size[1]);
  const c = newCanvas(w, h);
  const cx = ctxOf(c);
  cx.translate(w / 2, h / 2);
  o.paint(cx);
  if (o.lit) {
    let bump: Cnv | null = null;
    if (o.bump) {
      bump = newCanvas(w, h);
      const bx = ctxOf(bump);
      bx.fillStyle = 'rgb(128,128,128)';
      bx.fillRect(0, 0, w, h);
      bx.translate(w / 2, h / 2);
      o.bump(bx);
      if (o.bumpSoft) softBlur(bump, o.bumpSoft);
    }
    lit(c, { ...o.lit, bump });
    free(bump);
  }
  target.save();
  target.translate(x, y);
  if (o.rot) target.rotate(o.rot);
  target.drawImage(c, -w / 2, -h / 2);
  target.restore();
  free(c);
}

function blobPts(r: () => number, rx: number, ry: number, n = 11, jitter = 0.2): P[] {
  const out: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const q = 1 - jitter + r() * jitter * 2;
    out.push([Math.cos(a) * rx * q, Math.sin(a) * ry * q]);
  }
  return out;
}

/** Soft blots used for rock texture. */
function blots(x: Ctx, r: () => number, rx: number, ry: number, n: number, color: string, size: number): void {
  x.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r());
    x.beginPath();
    x.ellipse(Math.cos(a) * rx * d, Math.sin(a) * ry * d, size * (0.4 + r()), size * (0.3 + r() * 0.8), r() * TAU, 0, TAU);
    x.fill();
  }
}

/** Stains with feathered edges, for broad flat surfaces where a hard oval would read as a shape. */
function softBlots(x: Ctx, r: () => number, rx: number, ry: number, n: number, color: string, size: number): void {
  const clear = color.replace(/[\d.]+\)$/, '0)');
  for (let i = 0; i < n; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r());
    const px = Math.cos(a) * rx * d;
    const py = Math.sin(a) * ry * d;
    const q = size * (0.8 + r());
    x.save();
    x.translate(px, py);
    x.scale(1, 0.6 + r() * 0.4);
    x.rotate(r() * TAU);
    x.fillStyle = radial(x, 0, 0, 0, 0, 0, q, [[0, color], [0.55, color], [1, clear]]);
    x.fillRect(-q, -q, q * 2, q * 2);
    x.restore();
  }
}

interface RockColors {
  hi: string;
  lo: string;
  blot: string;
  moss?: string;
}

function rock(w: World, t: Ctx, x: number, y: number, ru: number, c: RockColors, squash = 0.74): void {
  const r = ru * w.s;
  const seed = w.r() * 1e6;
  const pts = blobPts(w.r, r, r * squash, 11, 0.22);
  stamp(t, x, y, {
    size: [r * 2.7, r * 2.2],
    rot: w.r() * TAU,
    paint: (p) => {
      fillPath(p, pts, linear(p, -r, -r, r, r, [[0, c.hi], [1, c.lo]]));
      clipped(p, pts, () => {
        const q = makeRng(seed);
        blots(p, q, r, r * squash, 14, c.blot, r * 0.14);
        if (c.moss) blots(p, q, r * 0.8, r * squash * 0.8, 10, c.moss, r * 0.24);
      });
    },
    bumpSoft: 5,
    bump: (p) => {
      const q = makeRng(seed + 1);
      blots(p, q, r, r * squash, 26, 'rgba(255,255,255,0.42)', r * 0.22);
      blots(p, q, r, r * squash, 20, 'rgba(0,0,0,0.42)', r * 0.16);
    },
    lit: { dome: r * 0.62, soften: Math.max(1, r * 0.05), light: SIDE_LIGHT, shade: 0.88, tint: [0.42, 0.5, 0.74], spec: 0.1, gloss: 14, sheen: 0.05, rim: 0.2, line: 1.4 * w.s, lineDark: 0.5, bumpPx: r * 0.14 },
  });
}

function brainCoral(w: World, t: Ctx, x: number, y: number, ru: number, a: string, b: string): void {
  const r = ru * w.s;
  const pts = blobPts(w.r, r, r * 0.9, 12, 0.07);
  const rings = (p: Ctx, color: string, width: number): void => {
    p.strokeStyle = color;
    p.lineWidth = width;
    p.lineCap = 'round';
    p.lineJoin = 'round';
    for (let k = 1; k <= 7; k++) {
      const q = (k / 7.5) * r;
      p.beginPath();
      for (let i = 0; i <= 64; i++) {
        const an = (i / 64) * TAU;
        const wob = 1 + 0.13 * Math.sin(an * (6 + k) + k * 1.7) + 0.05 * Math.sin(an * 3 + k);
        const px = Math.cos(an) * q * wob;
        const py = Math.sin(an) * q * wob * 0.9;
        if (i) p.lineTo(px, py);
        else p.moveTo(px, py);
      }
      p.stroke();
    }
  };
  stamp(t, x, y, {
    size: [r * 2.3, r * 2.2],
    paint: (p) => {
      fillPath(p, pts, radial(p, -r * 0.2, -r * 0.2, r * 0.1, 0, 0, r, [[0, a], [1, b]]));
      clipped(p, pts, () => rings(p, 'rgba(255,240,220,0.32)', r * 0.05));
    },
    bump: (p) => {
      p.save();
      p.beginPath();
      trace(p, pts);
      p.clip();
      rings(p, 'rgba(255,255,255,0.8)', r * 0.06);
      p.restore();
    },
    lit: { dome: r * 0.9, soften: Math.max(1, r * 0.04), light: SIDE_LIGHT, shade: 0.8, tint: [0.5, 0.42, 0.7], spec: 0.14, gloss: 18, sheen: 0.08, rim: 0.28, line: 1.5 * w.s, lineDark: 0.5, bumpPx: Math.max(1, r * 0.035) },
  });
}

function branch(p: Ctx, x: number, y: number, ang: number, len: number, wid: number, depth: number, q: () => number, colors: readonly [string, string]): void {
  const bx = x + Math.cos(ang) * len;
  const by = y + Math.sin(ang) * len;
  const mx = (x + bx) / 2 + Math.cos(ang + 1.57) * len * 0.12 * (q() - 0.5);
  const my = (y + by) / 2 + Math.sin(ang + 1.57) * len * 0.12 * (q() - 0.5);
  fillPath(p, tube([[x, y, wid], [mx, my, wid * 0.88], [bx, by, wid * 0.74]], 3), depth > 0 ? colors[0] : mix(colors[0], colors[1], 0.5));
  if (depth <= 0) {
    circle(p, bx, by, wid * 0.8, colors[1]);
    return;
  }
  const n = depth > 2 ? 3 : 2;
  for (let i = 0; i < n; i++) {
    branch(p, bx, by, ang + lerp(-0.62, 0.62, i / (n - 1)) + (q() - 0.5) * 0.3, len * (0.68 + q() * 0.14), wid * 0.74, depth - 1, q, colors);
  }
}

function stagCoral(w: World, t: Ctx, x: number, y: number, ru: number, colors: readonly [string, string]): void {
  const r = ru * w.s;
  const seed = w.r() * 1e6;
  stamp(t, x, y, {
    size: [r * 2.4, r * 2.4],
    rot: w.r() * TAU,
    paint: (p) => {
      const q = makeRng(seed);
      const arms = 6;
      for (let i = 0; i < arms; i++) {
        branch(p, 0, 0, (i / arms) * TAU + q() * 0.5, r * 0.34, r * 0.075, 3, q, colors);
      }
      circle(p, 0, 0, r * 0.14, colors[0]);
    },
    lit: { dome: r * 0.075, soften: 1, light: SIDE_LIGHT, shade: 0.82, tint: [0.5, 0.42, 0.72], spec: 0.2, gloss: 20, sheen: 0.06, rim: 0.3, line: 1.1 * w.s, lineDark: 0.55 },
  });
}

function tubeSponge(w: World, t: Ctx, x: number, y: number, ru: number, a: string, b: string): void {
  const r = ru * w.s;
  const seed = w.r() * 1e6;
  const tubes: Array<[number, number, number]> = [];
  const q = makeRng(seed);
  for (let i = 0; i < 9; i++) {
    const an = q() * TAU;
    const d = Math.sqrt(q()) * r * 0.62;
    tubes.push([Math.cos(an) * d, Math.sin(an) * d, r * (0.2 + q() * 0.17)]);
  }
  tubes.sort((m, n) => m[1] - n[1]);
  stamp(t, x, y, {
    size: [r * 2.6, r * 2.6],
    paint: (p) => {
      for (const [tx, ty, tr] of tubes) {
        circle(p, tx, ty, tr, radial(p, tx - tr * 0.3, ty - tr * 0.3, tr * 0.1, tx, ty, tr, [[0, a], [1, b]]));
        circle(p, tx, ty, tr * 0.5, 'rgba(24,14,40,0.9)');
      }
    },
    bump: (p) => {
      for (const [tx, ty, tr] of tubes) circle(p, tx, ty, tr * 0.55, 'rgba(0,0,0,0.9)');
    },
    lit: { dome: r * 0.2, soften: 1, light: SIDE_LIGHT, shade: 0.8, tint: [0.5, 0.42, 0.72], spec: 0.16, gloss: 18, sheen: 0.06, rim: 0.28, line: 1.2 * w.s, lineDark: 0.55, bumpPx: r * 0.1 },
  });
}

function plateCoral(w: World, t: Ctx, x: number, y: number, ru: number, a: string, b: string): void {
  const r = ru * w.s;
  const seed = w.r() * 1e6;
  const q = makeRng(seed);
  const discs: Array<[number, number, number]> = [];
  for (let i = 0; i < 4; i++) {
    const an = q() * TAU;
    discs.push([Math.cos(an) * r * 0.42, Math.sin(an) * r * 0.42, r * (0.5 + q() * 0.22)]);
  }
  for (const [dx, dy, dr] of discs) {
    const pts = blobPts(q, dr, dr * 0.9, 16, 0.08);
    stamp(t, x + dx, y + dy, {
      size: [dr * 2.3, dr * 2.3],
      paint: (p) => {
        fillPath(p, pts, radial(p, 0, 0, dr * 0.1, 0, 0, dr, [[0, b], [1, a]]));
        clipped(p, pts, () => {
          p.strokeStyle = 'rgba(255,245,225,0.22)';
          p.lineWidth = Math.max(1, dr * 0.018);
          p.beginPath();
          for (let i = 0; i < 44; i++) {
            const an = (i / 44) * TAU;
            p.moveTo(Math.cos(an) * dr * 0.1, Math.sin(an) * dr * 0.1);
            p.lineTo(Math.cos(an) * dr, Math.sin(an) * dr);
          }
          p.stroke();
        });
      },
      lit: { dome: dr * 0.22, soften: 1, light: SIDE_LIGHT, shade: 0.76, tint: [0.5, 0.42, 0.72], spec: 0.16, gloss: 18, sheen: 0.08, rim: 0.3, line: 1.3 * w.s, lineDark: 0.5 },
    });
  }
}

function anemone(w: World, t: Ctx, x: number, y: number, ru: number): void {
  const r = ru * w.s;
  const size = Math.ceil(r * 2.4);
  const c = newCanvas(size, size);
  const p = ctxOf(c);
  p.translate(size / 2, size / 2);
  const q = makeRng(w.r() * 1e6);
  const rings: ReadonlyArray<readonly [number, number, number, number]> = [
    [1, 0.46, 34, 0.074], [0.82, 0.38, 28, 0.07], [0.62, 0.3, 22, 0.064], [0.44, 0.2, 15, 0.058],
  ];
  for (const [reach, start, count, wid] of rings) {
    for (let i = 0; i < count; i++) {
      const an = (i / count) * TAU + reach * 3 + (q() - 0.5) * 0.12;
      const len = r * reach * (0.88 + q() * 0.16);
      const swirl = 0.42 + (q() - 0.5) * 0.3;
      const s0 = r * start * 0.72;
      const sx = Math.cos(an);
      const sy = Math.sin(an);
      const pts: S[] = [];
      for (let k = 0; k <= 4; k++) {
        const u = k / 4;
        const rad = lerp(s0, len, u);
        const ang = an + swirl * u * u;
        pts.push([Math.cos(ang) * rad, Math.sin(ang) * rad, r * wid * lerp(0.86, 1.05, Math.sin(u * 2.6))]);
      }
      const outline = tube(pts, 3);
      const tip = pts[pts.length - 1]!;
      const hueT = q();
      fillPath(p, outline, linear(p, sx * s0, sy * s0, tip[0], tip[1], [[0, mix('#6d3f8a', '#8a4a86', hueT)], [0.6, mix('#b35a9c', '#c26a92', hueT)], [1, '#e8a0c0']]));
      const mid = pts[2]!;
      strokePath(p, [[pts[1]![0], pts[1]![1]], [mid[0] - tip[2] * 0.2, mid[1] - tip[2] * 0.3], [pts[3]![0] - tip[2] * 0.2, pts[3]![1] - tip[2] * 0.3]], 'rgba(255,220,240,0.26)', tip[2] * 0.42);
      circle(p, tip[0], tip[1], tip[2] * 0.98, radial(p, tip[0] - tip[2] * 0.3, tip[1] - tip[2] * 0.3, 0, tip[0], tip[1], tip[2], [[0, '#ffe2ee'], [0.55, '#f0a8c8'], [1, '#b8609c']]));
    }
  }
  const dr = r * 0.26;
  circle(p, 0, 0, dr * 1.25, radial(p, 0, 0, dr * 0.2, 0, 0, dr * 1.25, [[0, 'rgba(60,20,70,0.95)'], [0.8, 'rgba(90,40,100,0.9)'], [1, 'rgba(90,40,100,0)']]));
  circle(p, 0, 0, dr, radial(p, -dr * 0.25, -dr * 0.25, dr * 0.1, 0, 0, dr, [[0, '#d88cb0'], [0.7, '#a85a96'], [1, '#6d3a80']]));
  p.strokeStyle = 'rgba(60,20,70,0.5)';
  p.lineWidth = Math.max(1, dr * 0.04);
  p.beginPath();
  for (let i = 0; i < 18; i++) {
    const an = (i / 18) * TAU;
    p.moveTo(Math.cos(an) * dr * 0.3, Math.sin(an) * dr * 0.3);
    p.lineTo(Math.cos(an) * dr * 0.95, Math.sin(an) * dr * 0.95);
  }
  p.stroke();
  ellipse(p, 0, 0, dr * 0.26, dr * 0.17, 0.4, '#3a1740');
  t.drawImage(c, x - size / 2, y - size / 2);
  free(c);
}

// ---------------------------------------------------------------- kelp

function kelpFrond(t: Ctx, x0: number, y0: number, ang: number, len: number, wid: number, c: readonly [string, string, string], q: () => number): void {
  const bend = (q() - 0.5) * 1.5;
  const n = 7;
  const spine: S[] = [];
  let x = x0;
  let y = y0;
  const step = len / n;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const a = ang + bend * u + Math.sin(u * 5 + q()) * 0.2;
    spine.push([x, y, wid * 0.34 * (1 - u * 0.5)]);
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
  }
  const s = sampleSpine(spine, 3);
  // Long ribbon blades from a thin stipe, each with a gas float at its base: the real giant kelp shape.
  for (let i = s.length - 2; i >= 2; i -= 2) {
    const a = s[i]!;
    const b = s[i + 1]!;
    const dir = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const side = i % 4 === 0 ? 1 : -1;
    const u = i / s.length;
    const l = wid * (4.6 + q() * 2.2) * (1 - u * 0.45);
    const an = dir + side * (0.34 + q() * 0.2);
    const px = a[0] + Math.cos(an) * l;
    const py = a[1] + Math.sin(an) * l;
    const cx = a[0] + Math.cos(an + side * 0.22) * l * 0.55;
    const cy = a[1] + Math.sin(an + side * 0.22) * l * 0.55;
    const wv = wid * (0.64 + q() * 0.2);
    const blade = tube([[a[0], a[1], wid * 0.1], [lerp(a[0], cx, 0.5), lerp(a[1], cy, 0.5), wv * 0.92], [cx, cy, wv], [lerp(cx, px, 0.55), lerp(cy, py, 0.55), wv * 0.76], [px, py, wid * 0.06]], 3);
    fillPath(t, blade, linear(t, a[0], a[1], px, py, [[0, c[0]], [0.6, c[1]], [1, mix(c[1], c[2], 0.5)]]));
    strokePath(t, [[a[0], a[1]], [cx, cy], [px, py]], 'rgba(238,234,170,0.2)', Math.max(0.8, wid * 0.07));
    circle(t, a[0] + Math.cos(an) * wid * 0.32, a[1] + Math.sin(an) * wid * 0.32, wid * 0.3, c[2]);
  }
  fillPath(t, tube(spine, 3), linear(t, x0, y0, x, y, [[0, c[0]], [1, c[1]]]));
}

function kelpClump(w: World, t: Ctx, x: number, y: number, inward: number, reach: number, q: () => number): void {
  const palettes: ReadonlyArray<readonly [string, string, string]> = [
    ['#4a6a2a', '#7f8c3c', '#a8a050'],
    ['#3c5f34', '#66803c', '#9a9a50'],
    ['#5a6a2c', '#94944a', '#b8a856'],
  ];
  for (let i = 0; i < 9; i++) {
    const c = palettes[Math.floor(q() * palettes.length)]!;
    kelpFrond(t, x + (q() - 0.5) * 70 * w.s, y + (q() - 0.5) * 70 * w.s, inward + (q() - 0.5) * 1.5, reach * w.s * (0.55 + q() * 0.5), 19 * w.s * (0.75 + q() * 0.4), c, q);
  }
  ellipse(t, x, y, 34 * w.s, 26 * w.s, q() * 3, '#3a3a24');
}

// ---------------------------------------------------------------- wreck

function hullPiece(w: World, t: Ctx, x: number, y: number, rot: number, flip: number): void {
  const s = w.s;
  const L = 560 * s;
  const B = 190 * s;
  const seed = w.r() * 1e6;
  const outline: P[] = [
    [L, 0], [L * 0.8, -B * 0.62], [L * 0.45, -B * 0.92], [0, -B], [-L * 0.46, -B * 0.97], [-L * 0.62, -B * 0.6, 1], [-L * 0.53, -B * 0.42, 1], [-L * 0.69, -B * 0.16, 1], [-L * 0.57, B * 0.1, 1], [-L * 0.72, B * 0.34, 1], [-L * 0.55, B * 0.62, 1], [-L * 0.46, B * 0.97], [0, B], [L * 0.45, B * 0.92], [L * 0.8, B * 0.62],
  ];
  const deck: P[] = outline.map((p) => [p[0] * 0.9, p[1] * 0.82, p[2]] as P);
  stamp(t, x, y, {
    size: [L * 3.6, B * 3.4],
    rot,
    paint: (p) => {
      p.scale(1, flip);
      fillPath(p, outline, linear(p, 0, -B, 0, B, [[0, '#6c5a48'], [0.5, '#54483c'], [1, '#3a3430']]));
      fillPath(p, deck, '#6e6252');
      clipped(p, deck, () => {
        p.strokeStyle = 'rgba(32,26,22,0.6)';
        p.lineWidth = Math.max(1, 1.6 * s);
        p.beginPath();
        for (let i = -9; i <= 9; i++) {
          p.moveTo(-L, (i * B) / 9.5);
          p.lineTo(L, (i * B) / 9.5);
        }
        const q = makeRng(seed);
        for (let i = 0; i < 70; i++) {
          const yy = Math.round((q() - 0.5) * 18) * (B / 9.5);
          const xx = (q() - 0.5) * L * 1.9;
          p.moveTo(xx, yy);
          p.lineTo(xx, yy + B / 9.5);
        }
        p.stroke();
        softBlots(p, q, L, B, 26, 'rgba(70,110,92,0.3)', 46 * s);
        softBlots(p, q, L, B, 18, 'rgba(24,30,34,0.26)', 36 * s);
        // hatch, a broken hole with ribs and the mast step
        const hx = L * 0.32;
        p.fillStyle = '#2e2a26';
        p.fillRect(hx - 70 * s, -60 * s, 140 * s, 120 * s);
        p.strokeStyle = '#7c6c58';
        p.lineWidth = 8 * s;
        p.beginPath();
        for (let i = -2; i <= 2; i++) {
          p.moveTo(hx + i * 28 * s, -60 * s);
          p.lineTo(hx + i * 28 * s, 60 * s);
        }
        for (let i = -1; i <= 1; i++) {
          p.moveTo(hx - 70 * s, i * 30 * s);
          p.lineTo(hx + 70 * s, i * 30 * s);
        }
        p.stroke();
        p.strokeStyle = '#8a7a62';
        p.lineWidth = 6 * s;
        p.strokeRect(hx - 70 * s, -60 * s, 140 * s, 120 * s);
        const hole: P[] = [[-L * 0.12, -80 * s], [-L * 0.04, -40 * s], [-L * 0.1, 30 * s], [-L * 0.2, 70 * s], [-L * 0.31, 30 * s], [-L * 0.29, -46 * s]];
        fillPath(p, hole, '#1c1c20');
        clipped(p, hole, () => {
          p.strokeStyle = '#54483c';
          p.lineWidth = 12 * s;
          p.beginPath();
          for (let i = 0; i < 6; i++) {
            const rx = -L * 0.32 + i * 46 * s;
            p.moveTo(rx, -100 * s);
            p.lineTo(rx, 100 * s);
          }
          p.stroke();
        });
        circle(p, L * 0.05, 0, 34 * s, '#4a3e34');
        circle(p, L * 0.05, 0, 23 * s, '#7c6c58');
      });
    },
    bump: (p) => {
      p.scale(1, flip);
      p.strokeStyle = 'rgba(30,30,30,0.5)';
      p.lineWidth = Math.max(1, 2 * s);
      p.beginPath();
      for (let i = -9; i <= 9; i++) {
        p.moveTo(-L, (i * B) / 9.5);
        p.lineTo(L, (i * B) / 9.5);
      }
      p.stroke();
      strokePathClosed(p, deck, 'rgba(255,255,255,0.7)', 10 * s);
    },
    lit: { dome: 34 * s, soften: 2, light: SIDE_LIGHT, shade: 0.82, tint: [0.42, 0.5, 0.74], spec: 0.08, gloss: 12, sheen: 0.04, rim: 0.2, line: 2 * s, lineDark: 0.55, bumpPx: 1.6 * s },
  });
}

function strokePathClosed(p: Ctx, pts: readonly P[], color: string, width: number): void {
  p.beginPath();
  trace(p, pts);
  p.strokeStyle = color;
  p.lineWidth = width;
  p.stroke();
}

function barrel(w: World, t: Ctx, x: number, y: number, ru: number): void {
  const r = ru * w.s;
  stamp(t, x, y, {
    size: [r * 2.6, r * 2.6],
    paint: (p) => {
      circle(p, 0, 0, r, '#6f5a42');
      p.strokeStyle = 'rgba(30,22,16,0.6)';
      p.lineWidth = Math.max(1, r * 0.04);
      p.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        p.moveTo(0, 0);
        p.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      p.stroke();
      p.strokeStyle = '#5c6068';
      p.lineWidth = r * 0.14;
      p.beginPath();
      p.arc(0, 0, r * 0.9, 0, TAU);
      p.stroke();
    },
    lit: { dome: r * 0.45, soften: 1, light: SIDE_LIGHT, shade: 0.82, tint: [0.42, 0.5, 0.74], spec: 0.1, gloss: 14, sheen: 0.05, rim: 0.2, line: 1.2 * w.s, lineDark: 0.55 },
  });
}

function crate(w: World, t: Ctx, x: number, y: number, ru: number): void {
  const r = ru * w.s;
  stamp(t, x, y, {
    size: [r * 3, r * 3],
    rot: w.r() * 1.5,
    paint: (p) => {
      p.fillStyle = '#75624a';
      p.fillRect(-r, -r, r * 2, r * 2);
      p.strokeStyle = 'rgba(30,22,16,0.6)';
      p.lineWidth = Math.max(1, r * 0.05);
      p.beginPath();
      for (let i = 1; i < 5; i++) {
        p.moveTo(-r, -r + (i * r) / 2.5);
        p.lineTo(r, -r + (i * r) / 2.5);
      }
      p.stroke();
      p.strokeStyle = '#5e4e3a';
      p.lineWidth = r * 0.22;
      p.strokeRect(-r * 0.89, -r * 0.89, r * 1.78, r * 1.78);
      p.beginPath();
      p.moveTo(-r, -r);
      p.lineTo(r, r);
      p.stroke();
    },
    lit: { dome: r * 0.24, soften: 1, light: SIDE_LIGHT, shade: 0.82, tint: [0.42, 0.5, 0.74], spec: 0.08, gloss: 14, sheen: 0.04, rim: 0.2, line: 1.2 * w.s, lineDark: 0.55 },
  });
}

function anchor(w: World, t: Ctx, x: number, y: number, ru: number, rot: number): void {
  const r = ru * w.s;
  stamp(t, x, y, {
    size: [r * 3.2, r * 3.2],
    rot,
    paint: (p) => {
      const c = '#5e6a72';
      fillPath(p, tube([[0, -r * 1.2, r * 0.1], [0, 0, r * 0.11], [0, r * 1.1, r * 0.13]], 3), c);
      fillPath(p, tube([[-r * 0.46, -r * 0.82, r * 0.08], [0, -r * 0.84, r * 0.09], [r * 0.46, -r * 0.82, r * 0.08]], 3), c);
      fillPath(p, tube([[-r, r * 0.45, r * 0.03], [-r * 0.82, r * 0.92, r * 0.13], [-r * 0.32, r * 1.22, r * 0.13], [0, r * 1.15, r * 0.13], [r * 0.32, r * 1.22, r * 0.13], [r * 0.82, r * 0.92, r * 0.13], [r, r * 0.45, r * 0.03]], 4), c);
      p.strokeStyle = c;
      p.lineWidth = r * 0.1;
      p.beginPath();
      p.arc(0, -r * 1.34, r * 0.2, 0, TAU);
      p.stroke();
    },
    lit: { dome: r * 0.12, soften: 1, light: SIDE_LIGHT, shade: 0.8, tint: [0.42, 0.5, 0.74], spec: 0.22, gloss: 22, sheen: 0.06, rim: 0.25, line: 1.2 * w.s, lineDark: 0.5 },
  });
}

function logMast(w: World, t: Ctx, x: number, y: number, lu: number, rot: number): void {
  const l = lu * w.s;
  const r = 20 * w.s;
  stamp(t, x, y, {
    size: [l * 2.2, r * 7],
    rot,
    paint: (p) => {
      fillPath(p, tube([[-l, 0, r * 1.05], [0, 0, r], [l, 0, r * 0.72]], 4), linear(p, 0, -r, 0, r, [[0, '#7a664e'], [1, '#54463a']]));
      p.strokeStyle = 'rgba(30,22,16,0.4)';
      p.lineWidth = Math.max(1, 1.5 * w.s);
      p.beginPath();
      for (let i = -3; i <= 3; i++) {
        p.moveTo(-l, i * r * 0.26);
        p.lineTo(l, i * r * 0.2);
      }
      p.stroke();
      for (const u of [-0.5, 0.1, 0.62]) {
        p.fillStyle = '#5c6068';
        p.fillRect(l * u - 6 * w.s, -r * 1.05, 12 * w.s, r * 2.1);
      }
    },
    lit: { dome: r, soften: 1, light: SIDE_LIGHT, shade: 0.82, tint: [0.42, 0.5, 0.74], spec: 0.08, gloss: 14, sheen: 0.04, rim: 0.2, line: 1.3 * w.s, lineDark: 0.55 },
  });
}

function wheel(w: World, t: Ctx, x: number, y: number, ru: number): void {
  const r = ru * w.s;
  stamp(t, x, y, {
    size: [r * 2.8, r * 2.8],
    rot: w.r() * TAU,
    paint: (p) => {
      p.strokeStyle = '#7a664e';
      p.lineWidth = r * 0.18;
      p.beginPath();
      p.arc(0, 0, r * 0.85, 0, TAU);
      p.stroke();
      p.lineWidth = r * 0.12;
      p.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        p.moveTo(0, 0);
        p.lineTo(Math.cos(a) * r * 1.16, Math.sin(a) * r * 1.16);
      }
      p.stroke();
      circle(p, 0, 0, r * 0.22, '#5c6068');
    },
    lit: { dome: r * 0.1, soften: 1, light: SIDE_LIGHT, shade: 0.8, tint: [0.42, 0.5, 0.74], spec: 0.1, gloss: 16, sheen: 0.05, rim: 0.2, line: 1 * w.s, lineDark: 0.5 },
  });
}

// ---------------------------------------------------------------- glow deep

function mushroom(w: World, t: Ctx, halo: Ctx, x: number, y: number, ru: number, core: string, edge: string, glow: string): void {
  const r = ru * w.s;
  const hr = r * 2.9;
  halo.fillStyle = radial(halo, x, y, r * 0.3, x, y, hr, [[0, glow], [0.45, glow.replace(/[\d.]+\)$/, '0.14)')], [1, glow.replace(/[\d.]+\)$/, '0)')]]);
  halo.fillRect(x - hr, y - hr, hr * 2, hr * 2);
  const seed = w.r() * 1e6;
  stamp(t, x, y, {
    size: [r * 2.5, r * 2.5],
    paint: (p) => {
      circle(p, 0, 0, r, radial(p, 0, 0, r * 0.05, 0, 0, r, [[0, mix(edge, core, 0.5)], [0.42, edge], [0.82, mix(edge, '#1a2050', 0.42)], [1, mix(edge, '#1a2050', 0.7)]]));
      p.strokeStyle = 'rgba(255,255,255,0.3)';
      p.lineWidth = Math.max(0.8, r * 0.03);
      p.beginPath();
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * TAU;
        p.moveTo(Math.cos(a) * r * 0.26, Math.sin(a) * r * 0.26);
        p.lineTo(Math.cos(a) * r * 0.94, Math.sin(a) * r * 0.94);
      }
      p.stroke();
      const q = makeRng(seed);
      for (let i = 0; i < 7; i++) {
        const a = q() * TAU;
        const d = r * (0.36 + q() * 0.46);
        circle(p, Math.cos(a) * d, Math.sin(a) * d, r * (0.05 + q() * 0.06), core);
      }
      circle(p, 0, 0, r * 0.2, core);
    },
    lit: { dome: r * 0.8, soften: 1, light: SIDE_LIGHT, shade: 0.5, tint: [0.56, 0.56, 0.96], spec: 0.24, gloss: 26, sheen: 0.08, rim: 0.42, rimColor: [0.7, 0.9, 1], line: 1.1 * w.s, lineDark: 0.5 },
  });
}

function crystal(w: World, t: Ctx, halo: Ctx, x: number, y: number, ru: number, c: string, glow: string): void {
  const r = ru * w.s;
  const hr = r * 2.3;
  halo.fillStyle = radial(halo, x, y, r * 0.2, x, y, hr, [[0, glow], [1, glow.replace(/[\d.]+\)$/, '0)')]]);
  halo.fillRect(x - hr, y - hr, hr * 2, hr * 2);
  const seed = w.r() * 1e6;
  stamp(t, x, y, {
    size: [r * 2.8, r * 2.8],
    paint: (p) => {
      const q = makeRng(seed);
      for (let i = 0; i < 6; i++) {
        const a = q() * TAU;
        const l = r * (0.6 + q() * 0.6);
        const wd = r * (0.16 + q() * 0.1);
        const ax = Math.cos(a);
        const ay = Math.sin(a);
        const nx = -ay;
        const ny = ax;
        p.beginPath();
        p.moveTo(nx * wd, ny * wd);
        p.lineTo(ax * l * 0.8 + nx * wd * 0.8, ay * l * 0.8 + ny * wd * 0.8);
        p.lineTo(ax * l, ay * l);
        p.lineTo(ax * l * 0.8 - nx * wd * 0.8, ay * l * 0.8 - ny * wd * 0.8);
        p.lineTo(-nx * wd, -ny * wd);
        p.closePath();
        p.fillStyle = linear(p, 0, 0, ax * l, ay * l, [[0, mix(c, '#141a44', 0.5)], [1, c]]);
        p.fill();
        p.strokeStyle = 'rgba(255,255,255,0.3)';
        p.lineWidth = Math.max(0.8, r * 0.02);
        p.beginPath();
        p.moveTo(0, 0);
        p.lineTo(ax * l, ay * l);
        p.stroke();
      }
    },
    lit: { dome: r * 0.1, soften: 0, light: SIDE_LIGHT, shade: 0.55, tint: [0.56, 0.56, 0.96], spec: 0.36, gloss: 30, sheen: 0.08, rim: 0.34, line: 0.9 * w.s, lineDark: 0.5 },
  });
}

// ---------------------------------------------------------------- arctic

/**
 * One connected shelf of ice around the whole view: a pale top with a blue cliff dropping to the seabed.
 * Baked at half size and well past the canvas edge, so lighting sees no border and arctic stays fast.
 */
function iceRing(w: World, t: Ctx): void {
  const { W, H, s } = w;
  const q = makeRng(w.r() * 1e6);
  const k = 0.5;
  const pad = 70;
  const cw = Math.ceil(W * k) + pad * 2;
  const ch = Math.ceil(H * k) + pad * 2;
  const n = 34;
  const inner: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const ex = Math.sign(c) * Math.pow(Math.abs(c), 0.46);
    const ey = Math.sign(sn) * Math.pow(Math.abs(sn), 0.46);
    const j = 0.8 + q() * 0.13;
    inner.push([W / 2 + (ex * W * j) / 2, H / 2 + (ey * H * j) / 2, i % 4 === 0 ? 1 : undefined] as P);
  }
  const ring = (p: Ctx, grow: number): void => {
    p.setTransform(k, 0, 0, k, pad, pad);
    p.beginPath();
    p.rect(-pad / k, -pad / k, W + (pad * 2) / k, H + (pad * 2) / k);
    trace(p, inner.map((pt): P => [W / 2 + (pt[0] - W / 2) * grow, H / 2 + (pt[1] - H / 2) * grow, pt[2]]));
  };
  const seed = q() * 1e6;

  const cliff = newCanvas(cw, ch);
  const cx = ctxOf(cliff);
  ring(cx, 0.955);
  cx.fillStyle = '#2c6a98';
  cx.fill('evenodd');
  lit(cliff, { dome: 6, soften: 1, light: SIDE_LIGHT, shade: 0.74, tint: [0.3, 0.5, 0.9], spec: 0.1, gloss: 16, sheen: 0.04, rim: 0.14, line: 1.2 * k * s, lineDark: 0.62 });

  const top = newCanvas(cw, ch);
  const tx = ctxOf(top);
  ring(tx, 1);
  tx.fillStyle = '#a2c9de';
  tx.fill('evenodd');
  // Drifts and hollows, blurred on their own so the shelf edge stays crisp.
  const z = makeRng(seed);
  const drift = newCanvas(cw, ch);
  const dx = ctxOf(drift);
  dx.setTransform(k, 0, 0, k, pad + (W / 2) * k, pad + (H / 2) * k);
  blots(dx, z, W * 0.6, H * 0.6, 120, 'rgba(226,242,250,0.42)', 70 * s);
  blots(dx, z, W * 0.6, H * 0.6, 90, 'rgba(96,152,192,0.34)', 56 * s);
  softBlur(drift, 7);
  dx.setTransform(k, 0, 0, k, pad, pad);
  dx.strokeStyle = 'rgba(84,140,182,0.5)';
  dx.lineWidth = Math.max(1, 2.2 * s);
  dx.lineJoin = 'round';
  dx.lineCap = 'round';
  dx.beginPath();
  for (let i = 0; i < 70; i++) {
    let x = z() * W;
    let y = z() * H;
    if (keepOut(w, x, y, 1.45)) continue;
    let a = z() * TAU;
    dx.moveTo(x, y);
    for (let j = 0; j < 5; j++) {
      a += (z() - 0.5) * 1.1;
      x += Math.cos(a) * 46 * s;
      y += Math.sin(a) * 46 * s;
      dx.lineTo(x, y);
    }
  }
  dx.stroke();
  tx.setTransform(1, 0, 0, 1, 0, 0);
  tx.globalCompositeOperation = 'source-atop';
  tx.drawImage(drift, 0, 0);
  tx.globalCompositeOperation = 'source-over';
  free(drift);
  lit(top, { dome: 15, soften: 3, light: SIDE_LIGHT, shade: 0.72, tint: [0.4, 0.6, 0.9], spec: 0.1, gloss: 18, sheen: 0.06, rim: 0.2, rimColor: [0.8, 0.94, 1], line: 1.6 * k * s, lineDark: 0.42 });

  t.save();
  t.imageSmoothingQuality = 'high';
  t.drawImage(cliff, -pad / k, -pad / k, cw / k, ch / k);
  t.drawImage(top, -pad / k, -pad / k, cw / k, ch / k);
  t.restore();
  free(cliff);
  free(top);
}

function floe(w: World, t: Ctx, x: number, y: number, ru: number): void {
  const r = ru * w.s;
  const n = 7;
  const q = makeRng(w.r() * 1e6);
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + q() * 0.4;
    const d = r * (0.72 + q() * 0.34);
    pts.push([Math.cos(a) * d, Math.sin(a) * d * 0.8]);
  }
  stamp(t, x, y, {
    size: [r * 2.5, r * 2.2],
    paint: (p) => {
      p.beginPath();
      pts.forEach((pt, i) => (i ? p.lineTo(pt[0], pt[1]) : p.moveTo(pt[0], pt[1])));
      p.closePath();
      p.fillStyle = linear(p, -r, -r, r, r, [[0, '#d4ecf8'], [1, '#8ec0dc']]);
      p.fill();
    },
    lit: { dome: r * 0.34, soften: 1, light: SIDE_LIGHT, shade: 0.7, tint: [0.42, 0.62, 0.92], spec: 0.24, gloss: 22, sheen: 0.12, rim: 0.3, rimColor: [0.8, 0.95, 1], line: 1.5 * w.s, lineDark: 0.45 },
  });
}

// ---------------------------------------------------------------- seabed dressing

function pebbles(w: World, t: Ctx, n: number, colors: readonly string[], minU: number, maxU: number): void {
  for (let i = 0; i < n; i++) {
    const [x, y] = edgeSpot(w, 0.82);
    const r = lerp(minU, maxU, w.r() ** 2) * w.s;
    const c = colors[Math.floor(w.r() * colors.length)]!;
    ellipse(t, x + r * 0.25, y + r * 0.3, r * 1.1, r * 0.9, 0, 'rgba(0,10,30,0.22)');
    ellipse(t, x, y, r, r * 0.8, w.r() * 3, c);
    ellipse(t, x - r * 0.25, y - r * 0.25, r * 0.4, r * 0.28, 0, 'rgba(255,255,255,0.16)');
  }
}

function seaweedTufts(w: World, t: Ctx, n: number, c: string, lenU: number): void {
  t.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const [x, y] = edgeSpot(w, 0.92);
    const blades = 5 + Math.floor(w.r() * 5);
    for (let k = 0; k < blades; k++) {
      const a = w.r() * TAU;
      const l = lenU * w.s * (0.5 + w.r() * 0.7);
      t.beginPath();
      t.moveTo(x, y);
      t.quadraticCurveTo(x + Math.cos(a) * l * 0.6 + w.r() * 8, y + Math.sin(a) * l * 0.6 - w.r() * 8, x + Math.cos(a + 0.5) * l, y + Math.sin(a + 0.5) * l);
      t.strokeStyle = c;
      t.lineWidth = 2.2 * w.s;
      t.stroke();
    }
  }
}

function shellDecor(w: World, t: Ctx, n: number, color: string): void {
  for (let i = 0; i < n; i++) {
    const [x, y] = edgeSpot(w, 0.86);
    const r = lerp(8, 15, w.r()) * w.s;
    t.save();
    t.translate(x, y);
    t.rotate(w.r() * TAU);
    t.fillStyle = color;
    t.beginPath();
    t.moveTo(0, r * 0.7);
    for (let k = 0; k <= 8; k++) {
      const a = Math.PI + (k / 8) * Math.PI;
      t.arc(Math.cos(a) * r, Math.sin(a) * r, r * 0.2, 0, TAU);
    }
    t.closePath();
    t.fill();
    ellipse(t, 0, -r * 0.1, r, r * 0.86, 0, color);
    t.strokeStyle = 'rgba(60,40,40,0.25)';
    t.lineWidth = Math.max(0.7, w.s * 0.8);
    t.beginPath();
    for (let k = -3; k <= 3; k++) {
      t.moveTo(0, r * 0.6);
      t.lineTo((k / 3) * r * 0.86, -r * 0.8);
    }
    t.stroke();
    t.restore();
  }
}

// ---------------------------------------------------------------- compositions

function groundShadow(mid: Cnv, s: number, dx: number, dy: number, alphaV: number, blur: number): void {
  const sh = newCanvas(mid.width, mid.height);
  const sx = ctxOf(sh);
  sx.drawImage(mid, 0, 0);
  flatten(sh, '#001020');
  softBlur(sh, blur);
  const m = ctxOf(mid);
  m.save();
  m.globalCompositeOperation = 'destination-over';
  m.globalAlpha = alphaV;
  m.drawImage(sh, dx * s, dy * s);
  m.restore();
  free(sh);
}

function coralOcean(w: World, bed: Ctx, mid: Ctx): void {
  const rockC: RockColors = { hi: '#7d8b8e', lo: '#465a66', blot: 'rgba(40,52,62,0.4)', moss: 'rgba(82,120,92,0.42)' };
  const pinkA = '#c07a84';
  const pinkB = '#8c4e68';
  const orange = ['#c08a58', '#e0c090'] as const;
  const violet = ['#7f68a4', '#c0b0dc'] as const;
  const teal = ['#4e9288', '#a4d4c0'] as const;
  pebbles(w, bed, 90, ['#7f8f8c', '#6a7c80', '#94a098'], 3, 12);
  shellDecor(w, bed, 16, '#c8bfae');
  seaweedTufts(w, bed, 26, 'rgba(70,120,84,0.5)', 54);
  for (let i = 0; i < 12; i++) {
    const [x, y] = edgeSpot(w, 1.02);
    rock(w, mid, x, y, lerp(60, 130, w.r()), rockC);
  }
  anemone(w, mid, w.W * 0.14, w.H * 0.8, 215);
  brainCoral(w, mid, w.W * 0.885, w.H * 0.24, 118, '#b09a64', '#74683e');
  brainCoral(w, mid, w.W * 0.06, w.H * 0.22, 84, '#a87a72', '#6e4a52');
  plateCoral(w, mid, w.W * 0.9, w.H * 0.74, 130, '#7f9a8c', '#5a7a74');
  plateCoral(w, mid, w.W * 0.36, w.H * 0.05, 96, '#8f8ab0', '#62608a');
  stagCoral(w, mid, w.W * 0.73, w.H * 0.9, 120, orange);
  stagCoral(w, mid, w.W * 0.04, w.H * 0.5, 104, violet);
  stagCoral(w, mid, w.W * 0.62, w.H * 0.08, 104, teal);
  stagCoral(w, mid, w.W * 0.97, w.H * 0.48, 104, orange);
  stagCoral(w, mid, w.W * 0.17, w.H * 0.08, 92, orange);
  tubeSponge(w, mid, w.W * 0.3, w.H * 0.93, 70, '#a8789c', '#6a4a7c');
  tubeSponge(w, mid, w.W * 0.78, w.H * 0.12, 62, '#b89a60', '#7c6838');
  brainCoral(w, mid, w.W * 0.53, w.H * 0.96, 74, pinkA, pinkB);
  tubeSponge(w, mid, w.W * 0.97, w.H * 0.92, 64, '#a8789c', '#6a4a7c');
  const small = [orange, violet, teal] as const;
  for (let i = 0; i < 16; i++) {
    const [x, y] = edgeSpot(w, 1.16);
    const pick = w.r();
    if (pick < 0.4) stagCoral(w, mid, x, y, lerp(48, 72, w.r()), small[Math.floor(w.r() * 3)]!);
    else if (pick < 0.7) tubeSponge(w, mid, x, y, lerp(34, 52, w.r()), '#b89a60', '#7c6838');
    else brainCoral(w, mid, x, y, lerp(38, 58, w.r()), pinkA, pinkB);
  }
}

function kelpOcean(w: World, bed: Ctx, mid: Ctx): void {
  const rockC: RockColors = { hi: '#5f7a6c', lo: '#34504c', blot: 'rgba(30,44,40,0.45)', moss: 'rgba(90,120,60,0.42)' };
  pebbles(w, bed, 140, ['#5e7264', '#4a6058', '#7a8c76'], 4, 15);
  seaweedTufts(w, bed, 40, 'rgba(90,120,60,0.5)', 70);
  const q = makeRng(7777);
  for (let i = 0; i < 10; i++) {
    const [x, y] = edgeSpot(w, 1.04);
    rock(w, mid, x, y, lerp(50, 110, w.r()), rockC);
  }
  const clumps: ReadonlyArray<readonly [number, number, number]> = [
    [0.02, 0.1, 0.5], [0.03, 0.5, 0.1], [0.02, 0.92, -0.5], [0.2, -0.01, 1.2], [0.22, 1.01, -1.25], [0.5, -0.02, 1.57], [0.52, 1.02, -1.5],
    [0.78, -0.01, 1.9], [0.8, 1.01, -1.9], [0.98, 0.1, 2.5], [0.98, 0.5, 3.1], [0.98, 0.9, -2.5],
  ];
  for (const [u, v, a] of clumps) kelpClump(w, mid, u * w.W, v * w.H, a, 430, q);
}

function shipOcean(w: World, bed: Ctx, mid: Ctx): void {
  const rockC: RockColors = { hi: '#6a7a80', lo: '#3c4c58', blot: 'rgba(30,38,46,0.45)', moss: 'rgba(70,104,90,0.4)' };
  pebbles(w, bed, 110, ['#5a6a70', '#6a7878', '#4c5c64'], 3, 13);
  seaweedTufts(w, bed, 22, 'rgba(70,104,88,0.45)', 54);
  hullPiece(w, mid, w.W * 0.09, w.H * 0.87, -0.44, 1);
  hullPiece(w, mid, w.W * 0.93, w.H * 0.1, 2.74, -1);
  for (let i = 0; i < 7; i++) {
    const [x, y] = edgeSpot(w, 1.1);
    rock(w, mid, x, y, lerp(46, 96, w.r()), rockC);
  }
  logMast(w, mid, w.W * 0.86, w.H * 0.82, 250, -0.42);
  logMast(w, mid, w.W * 0.13, w.H * 0.1, 190, 0.3);
  barrel(w, mid, w.W * 0.74, w.H * 0.93, 38);
  barrel(w, mid, w.W * 0.79, w.H * 0.96, 34);
  barrel(w, mid, w.W * 0.06, w.H * 0.34, 36);
  crate(w, mid, w.W * 0.64, w.H * 0.95, 40);
  crate(w, mid, w.W * 0.3, w.H * 0.05, 36);
  anchor(w, mid, w.W * 0.95, w.H * 0.55, 92, 0.5);
  wheel(w, mid, w.W * 0.05, w.H * 0.56, 56);
  barrel(w, mid, w.W * 0.42, w.H * 0.04, 30);
}

function glowOcean(w: World, bed: Ctx, mid: Ctx, halo: Ctx): void {
  const rockC: RockColors = { hi: '#34407e', lo: '#161e4c', blot: 'rgba(10,14,44,0.55)', moss: 'rgba(60,70,150,0.36)' };
  for (let i = 0; i < 400; i++) {
    const x = w.r() * w.W;
    const y = w.r() * w.H;
    const r = lerp(0.8, 2.6, w.r() ** 2) * w.s;
    const c = w.r() < 0.5 ? 'rgba(120,230,255,' : 'rgba(210,140,255,';
    const a = keepOut(w, x, y, 0.9) ? 0.14 : 0.42;
    circle(bed, x, y, r * 3, `${c}${a * 0.2})`);
    circle(bed, x, y, r, `${c}${a})`);
  }
  for (let i = 0; i < 14; i++) {
    const [x, y] = edgeSpot(w, 1.02);
    rock(w, mid, x, y, lerp(60, 150, w.r()), rockC);
  }
  const caps: ReadonlyArray<readonly [string, string, string]> = [
    ['#c8fff0', '#2eb8ac', 'rgba(70,240,220,0.3)'],
    ['#ffd8f8', '#b850c4', 'rgba(230,110,240,0.3)'],
    ['#dce8ff', '#5472e0', 'rgba(120,150,255,0.3)'],
  ];
  const clusters: ReadonlyArray<readonly [number, number]> = [
    [0.08, 0.14], [0.05, 0.62], [0.13, 0.9], [0.34, 0.06], [0.42, 0.95], [0.66, 0.05], [0.7, 0.93], [0.92, 0.16], [0.96, 0.56], [0.88, 0.88],
  ];
  for (const [u, v] of clusters) {
    const c = caps[Math.floor(w.r() * caps.length)]!;
    const n = 3 + Math.floor(w.r() * 4);
    for (let i = 0; i < n; i++) {
      const a = w.r() * TAU;
      const d = w.r() * 96 * w.s;
      mushroom(w, mid, halo, u * w.W + Math.cos(a) * d, v * w.H + Math.sin(a) * d, lerp(24, 56, w.r()), c[0], c[1], c[2]);
    }
  }
  crystal(w, mid, halo, w.W * 0.2, w.H * 0.09, 86, '#7a8cff', 'rgba(120,140,255,0.38)');
  crystal(w, mid, halo, w.W * 0.83, w.H * 0.1, 76, '#cc7cff', 'rgba(200,120,255,0.38)');
  crystal(w, mid, halo, w.W * 0.04, w.H * 0.38, 70, '#4fe0e0', 'rgba(80,230,230,0.38)');
  crystal(w, mid, halo, w.W * 0.97, w.H * 0.34, 84, '#7a8cff', 'rgba(120,140,255,0.38)');
  crystal(w, mid, halo, w.W * 0.57, w.H * 0.96, 74, '#4fe0e0', 'rgba(80,230,230,0.38)');
  crystal(w, mid, halo, w.W * 0.26, w.H * 0.95, 66, '#cc7cff', 'rgba(200,120,255,0.38)');
}

function arcticOcean(w: World, bed: Ctx, mid: Ctx): void {
  pebbles(w, bed, 100, ['#6a93ac', '#7ea4ba', '#5a84a0'], 3, 14);
  iceRing(w, mid);
  const spots: ReadonlyArray<readonly [number, number, number]> = [
    [0.17, 0.3, 66], [0.84, 0.26, 58], [0.13, 0.72, 74], [0.87, 0.74, 70], [0.3, 0.17, 44], [0.68, 0.84, 48], [0.32, 0.86, 36], [0.7, 0.16, 38],
  ];
  for (const [u, v, r] of spots) floe(w, mid, u * w.W, v * w.H, r);
}

interface OceanSpec {
  bed: BedSpec;
  causticTint: number;
  causticStrength: number;
  bubbleTint: number;
  backdrop: string;
  /** How much water colour lies over the props. */
  waterTint: number;
}

const OCEANS: Record<OceanId, OceanSpec> = {
  coral: {
    bed: { seed: 11, dark: '#3a7f8c', mid: '#5f9f9c', light: '#90bfa8', ripple: 2.4, rippleFreq: 0.052, rippleAngle: 0.5, grain: 1, relief: 1, pool: 0.08, edge: 0.3 },
    causticTint: 0xcff6ff, causticStrength: 0.33, bubbleTint: 0xd8f6ff, backdrop: '#1e6c80', waterTint: 0.2,
  },
  kelp: {
    bed: { seed: 22, dark: '#285a52', mid: '#3f7a66', light: '#6f9a70', patch: '#335a4e', patchAt: 0.56, ripple: 1.3, rippleFreq: 0.04, rippleAngle: 1.1, grain: 1.4, relief: 1.2, pool: 0.08, edge: 0.34 },
    causticTint: 0xd8ffd0, causticStrength: 0.28, bubbleTint: 0xdcffe4, backdrop: '#1a4e46', waterTint: 0.24,
  },
  ship: {
    bed: { seed: 33, dark: '#234a5c', mid: '#3a6474', light: '#5a8088', patch: '#2c4e5e', patchAt: 0.58, ripple: 1.6, rippleFreq: 0.046, rippleAngle: -0.4, grain: 1.2, relief: 1.1, pool: 0.08, edge: 0.34 },
    causticTint: 0xb8e4ff, causticStrength: 0.24, bubbleTint: 0xc8e8f8, backdrop: '#183e50', waterTint: 0.14,
  },
  glow: {
    bed: { seed: 44, dark: '#0c1238', mid: '#141e52', light: '#22306c', patch: '#17164e', patchAt: 0.56, ripple: 1, rippleFreq: 0.04, rippleAngle: 0.9, grain: 1, relief: 1, pool: 0.22, edge: 0.3 },
    causticTint: 0x7ea8ff, causticStrength: 0.15, bubbleTint: 0x9fd8ff, backdrop: '#0b1034', waterTint: 0.05,
  },
  arctic: {
    bed: { seed: 55, dark: '#3f7296', mid: '#5a8eae', light: '#83b0c6', ripple: 1.2, rippleFreq: 0.03, rippleAngle: 0.2, grain: 0.7, relief: 0.8, pool: 0.06, edge: 0.2 },
    causticTint: 0xe4f6ff, causticStrength: 0.30, bubbleTint: 0xeafaff, backdrop: '#2c6684', waterTint: 0.12,
  },
};

export function bakeOcean(id: OceanId, widthU: number, heightU: number, ppu: number): OceanBake {
  const spec = OCEANS[id];
  const s = Math.min(ppu, MAX_SIDE / widthU, MAX_SIDE / heightU);
  const W = Math.round(widthU * s);
  const H = Math.round(heightU * s);
  const seabed = bakeSeabed(W, H, s, spec.bed);
  const midground = newCanvas(W, H);
  const w: World = { W, H, s, r: makeRng(spec.bed.seed * 97) };
  const bed = ctxOf(seabed);
  const mid = ctxOf(midground);
  let halo: Cnv | null = null;
  if (id === 'coral') coralOcean(w, bed, mid);
  else if (id === 'kelp') kelpOcean(w, bed, mid);
  else if (id === 'ship') shipOcean(w, bed, mid);
  else if (id === 'arctic') arcticOcean(w, bed, mid);
  else {
    halo = newCanvas(W, H);
    glowOcean(w, bed, mid, ctxOf(halo));
  }
  mid.save();
  mid.globalCompositeOperation = 'source-atop';
  mid.fillStyle = css(hexRgb(spec.backdrop), spec.waterTint);
  mid.fillRect(0, 0, W, H);
  mid.restore();
  groundShadow(midground, s, 12, 18, 0.5, 10);
  groundShadow(midground, s, 4, 6, 0.3, 3);
  if (halo) {
    // Under everything in the midground, so the glow lights the floor and the fungi keep their colour.
    mid.save();
    mid.globalCompositeOperation = 'destination-over';
    mid.drawImage(halo, 0, 0);
    mid.restore();
    free(halo);
  }
  releaseScratch();
  return {
    seabed,
    midground,
    causticTint: spec.causticTint,
    causticStrength: spec.causticStrength,
    bubbleTint: spec.bubbleTint,
    backdrop: spec.backdrop,
  };
}

// ---------------------------------------------------------------- caustics

export function bakeCausticsTile(size: number): Cnv {
  let N = 2;
  while (N * 2 <= size) N *= 2;
  if (size - N > N * 2 - size) N *= 2;
  const cells = 7;
  const r = makeRng(4242);
  const px: number[] = [];
  const py: number[] = [];
  // Limited jitter keeps seeds apart, so no cell wall smears out into a wide blob.
  for (let i = 0; i < cells * cells; i++) {
    px.push(0.5 + (r() - 0.5) * 0.72);
    py.push(0.5 + (r() - 0.5) * 0.72);
  }
  const canvas = newCanvas(N, N);
  const c = ctxOf(canvas);
  const img = c.createImageData(N, N);
  const d = img.data;
  const f = TAU / N;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      // Periodic warp keeps it tiling and bends the cell walls into caustic curves.
      const wx = x + (Math.sin(y * f * 2 + 1.3) * 0.5 + Math.sin(x * f * 3 + y * f + 0.7) * 0.5) * N * 0.045;
      const wy = y + (Math.sin(x * f * 2 + 4.1) * 0.5 + Math.sin(y * f * 3 - x * f + 2.2) * 0.5) * N * 0.045;
      const ux = (wx / N) * cells;
      const uy = (wy / N) * cells;
      const cx = Math.floor(ux);
      const cy = Math.floor(uy);
      let f1 = 1e9;
      let f2 = 1e9;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const gx = cx + i;
          const gy = cy + j;
          const k = (((gy % cells) + cells) % cells) * cells + ((gx % cells) + cells) % cells;
          const dx = gx + px[k]! - ux;
          const dy = gy + py[k]! - uy;
          const dd = dx * dx + dy * dy;
          if (dd < f1) {
            f2 = f1;
            f1 = dd;
          } else if (dd < f2) {
            f2 = dd;
          }
        }
      }
      const edge = Math.sqrt(f2) - Math.sqrt(f1);
      const v = Math.pow(clamp(1 - edge / 0.36), 2.6);
      const o = (y * N + x) * 4;
      const g = v * 255;
      d[o] = g;
      d[o + 1] = g;
      d[o + 2] = g;
      d[o + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  return canvas;
}

