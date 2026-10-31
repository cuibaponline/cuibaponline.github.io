// Creature rig: lit parts built once per bake, then posed per frame. Art is authored in "art units": the creature's
// long axis spans 100 of them, so every species is drawn in a -50..50 box whatever its in-game size.

import type { FacingMode, SpriteId } from './types';
import {
  TAU,
  blit,
  clamp,
  ctxOf,
  free,
  lerp,
  lit,
  newCanvas,
  radial,
  smoothstep,
  trace,
  warpCols,
  type Cnv,
  type Ctx,
  type LitOpts,
  type P,
  type Part,
  type View,
} from './paint';

export type Box = readonly [number, number, number, number];

export interface PartSpec {
  box: Box;
  paint(ctx: Ctx): void;
  bump?(ctx: Ctx): void;
  /** Dome and soften are in art units; line and bumpPx are in design units. null skips lighting. */
  lit?: Partial<LitOpts> | null;
}

export type FramePainter = (ctx: Ctx, phase: number, v: View) => void;

export interface CreatureDef {
  id: SpriteId;
  /** Long axis in design units. */
  size: number;
  /** Frame extents in art units, with room for the animation. */
  box: Box;
  /** The drawn creature, used to centre and fit it in drawCreature. Defaults to box. */
  art?: Box;
  frames: number;
  fps: number;
  facing: FacingMode;
  /** Part supersampling. */
  ss: number;
  build(b: Builder): FramePainter;
}

const PAD_PX = 3;

export class Builder {
  private readonly owned: Cnv[] = [];

  /** @param s part px per art unit. @param k design units per art unit. */
  constructor(
    readonly s: number,
    readonly k: number,
  ) {}

  blank(box: Box, paint?: (ctx: Ctx) => void): Part {
    // Whole-pixel box edges keep warp strips on the source grid, so frames stay equally sharp.
    const x0 = Math.floor(box[0] * this.s) - PAD_PX;
    const y0 = Math.floor(box[1] * this.s) - PAD_PX;
    const x1 = Math.ceil(box[2] * this.s) + PAD_PX;
    const y1 = Math.ceil(box[3] * this.s) + PAD_PX;
    const canvas = newCanvas(x1 - x0, y1 - y0);
    const part: Part = { canvas, x: x0 / this.s, y: y0 / this.s, w: canvas.width / this.s, h: canvas.height / this.s, s: this.s };
    this.owned.push(canvas);
    if (paint) this.over(part, paint);
    return part;
  }

  /** Paints on top of a part, in art units. */
  over(part: Part, paint: (ctx: Ctx) => void): void {
    const x = ctxOf(part.canvas, true);
    x.save();
    x.setTransform(this.s, 0, 0, this.s, -part.x * this.s, -part.y * this.s);
    paint(x);
    x.restore();
  }

  part(spec: PartSpec): Part {
    const part = this.blank(spec.box);
    this.over(part, spec.paint);
    if (spec.lit !== null) {
      let bump: Cnv | null = null;
      if (spec.bump) {
        bump = newCanvas(part.canvas.width, part.canvas.height);
        const bx = ctxOf(bump, true);
        bx.fillStyle = 'rgb(128,128,128)';
        bx.fillRect(0, 0, bump.width, bump.height);
        bx.setTransform(this.s, 0, 0, this.s, -part.x * this.s, -part.y * this.s);
        spec.bump(bx);
      }
      const o = spec.lit ?? {};
      const px = this.s * this.k > 0 ? this.s / this.k : 1; // px per design unit
      const opts: LitOpts = {
        ...o,
        dome: (o.dome ?? 18) * this.s,
        bump,
        bumpPx: (o.bumpPx ?? 1.2) * px,
        line: (o.line ?? 1.3) * px,
      };
      if (o.soften !== undefined) opts.soften = o.soften * this.s;
      lit(part.canvas, opts);
      free(bump);
    }
    return part;
  }

  /** Stacks several parts into one canvas so they warp together, and frees the sources. */
  stack(box: Box, ...parts: Part[]): Part {
    const out = this.blank(box);
    this.over(out, (x) => {
      for (const p of parts) blit(x, p);
    });
    for (const p of parts) this.release(p);
    return out;
  }

  /** Fades a part to nothing toward (x0,y0), so a fin melts into the body instead of ending in a hard edge. */
  fadeRoot(part: Part, x0: number, y0: number, x1: number, y1: number): void {
    this.over(part, (x) => {
      x.globalCompositeOperation = 'destination-out';
      const g = x.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g;
      x.fillRect(part.x, part.y, part.w, part.h);
    });
  }

  release(p: Part): void {
    const i = this.owned.indexOf(p.canvas);
    if (i >= 0) this.owned.splice(i, 1);
    free(p.canvas);
  }

  dispose(): void {
    free(...this.owned);
    this.owned.length = 0;
  }
}

// ---------------------------------------------------------------- swim

export interface SwimOpts {
  /** Art x where the body starts to bend. */
  head: number;
  /** Art x of the tail tip. */
  tail: number;
  /** Peak sway in art units at the tail tip. */
  amp: number;
  /** Wave count along the body. */
  waves?: number;
  /** Tail foreshortening strength, 0..1. */
  fore?: number;
  /** Art x where foreshortening starts. */
  foreFrom?: number;
  /** Small counter-sway at the head. */
  nod?: number;
  step?: number;
}

export function swim(ctx: Ctx, v: View, part: Part, phase: number, o: SwimOpts): void {
  const span = o.head - o.tail;
  const waves = o.waves ?? 0.75;
  const nod = o.nod ?? 0;
  const dy = (x: number): number => {
    const u = clamp((o.head - x) / span);
    return o.amp * u * u * Math.sin(TAU * (phase - waves * u)) + nod * (1 - u) * Math.sin(TAU * (phase + 0.3));
  };
  let map: ((x: number) => number) | null = null;
  const fore = o.fore ?? 0;
  if (fore > 0) {
    const from = o.foreFrom ?? lerp(o.head, o.tail, 0.62);
    const q = 1 - fore * (0.5 - 0.5 * Math.cos(TAU * phase * 2));
    map = (x) => (x >= from ? x : from + (x - from) / q);
  }
  warpCols(ctx, v, part, dy, map, null, o.step ?? 1);
}

/** Vertical shift at x for the same swim, so a pectoral fin can ride along. */
export function swimDy(x: number, phase: number, o: SwimOpts): number {
  const span = o.head - o.tail;
  const u = clamp((o.head - x) / span);
  const w = o.waves ?? 0.75;
  const nod = o.nod ?? 0;
  return o.amp * u * u * Math.sin(TAU * (phase - w * u)) + nod * (1 - u) * Math.sin(TAU * (phase + 0.3));
}

// ---------------------------------------------------------------- tubes

/** Spine point: x, y, half-width. */
export type S = readonly [number, number, number];

export function sampleSpine(spine: readonly S[], res = 6): S[] {
  const n = spine.length;
  const out: S[] = [];
  const at = (i: number): S => spine[clamp(i, 0, n - 1)]!;
  const cr = (a: number, b: number, c: number, d: number, t: number): number =>
    0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  for (let i = 0; i < n - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    for (let j = 0; j < res; j++) {
      const t = j / res;
      out.push([cr(p0[0], p1[0], p2[0], p3[0], t), cr(p0[1], p1[1], p2[1], p3[1], t), Math.max(0.05, cr(p0[2], p1[2], p2[2], p3[2], t))]);
    }
  }
  out.push(spine[n - 1]!);
  return out;
}

/** Outline of a tapered tube along a spine. */
export function tube(spine: readonly S[], res = 6): P[] {
  const s = sampleSpine(spine, res);
  const left: P[] = [];
  const right: P[] = [];
  for (let i = 0; i < s.length; i++) {
    const a = s[Math.max(0, i - 1)]!;
    const b = s[Math.min(s.length - 1, i + 1)]!;
    const c = s[i]!;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    const nx = -dy / l;
    const ny = dx / l;
    left.push([c[0] + nx * c[2], c[1] + ny * c[2]]);
    right.unshift([c[0] - nx * c[2], c[1] - ny * c[2]]);
  }
  return [...left, ...right];
}

// ---------------------------------------------------------------- fins

export interface FinSpec {
  /** Outer edge, tip to tip. */
  rim: readonly P[];
  /** Where it joins the body, in the same direction. Tucked under the body. */
  base: readonly P[];
  rays: number;
  root: string;
  tip: string;
  ray: string;
  rayWidth?: number;
  /** 0..1 opacity at the tip. */
  tipAlpha?: number;
  /** Extra painting clipped to the fin, such as a dark edge band. */
  extra?(ctx: Ctx): void;
}

function polyAt(pts: readonly P[], t: number): [number, number] {
  const n = pts.length - 1;
  const f = clamp(t) * n;
  const i = Math.min(n - 1, Math.floor(f));
  const a = pts[i]!;
  const b = pts[i + 1]!;
  const u = f - i;
  return [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
}

function finOutline(f: FinSpec): P[] {
  return [...f.rim, ...[...f.base].reverse()];
}

function finRays(ctx: Ctx, f: FinSpec, color: string, width: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= f.rays; i++) {
    const t = (i + 0.5) / (f.rays + 1);
    const a = polyAt(f.base, t);
    const b = polyAt(f.rim, t);
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo(lerp(a[0], b[0], 0.55), lerp(a[1], b[1], 0.45), b[0], b[1]);
  }
  ctx.stroke();
}

export function paintFin(ctx: Ctx, f: FinSpec): void {
  const b = polyAt(f.base, 0.5);
  const r = polyAt(f.rim, 0.5);
  const dist = Math.hypot(r[0] - b[0], r[1] - b[1]) * 1.25;
  const pts = finOutline(f);
  ctx.save();
  ctx.beginPath();
  trace(ctx, pts);
  ctx.globalAlpha = 1;
  const g = ctx.createRadialGradient(b[0], b[1], dist * 0.1, b[0], b[1], dist);
  g.addColorStop(0, f.root);
  g.addColorStop(1, f.tip);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  finRays(ctx, f, f.ray, f.rayWidth ?? 0.9);
  f.extra?.(ctx);
  if (f.tipAlpha !== undefined && f.tipAlpha < 1) {
    ctx.globalCompositeOperation = 'destination-out';
    const e = ctx.createRadialGradient(b[0], b[1], dist * 0.45, b[0], b[1], dist);
    e.addColorStop(0, 'rgba(0,0,0,0)');
    e.addColorStop(1, `rgba(0,0,0,${1 - f.tipAlpha})`);
    ctx.fillStyle = e;
    ctx.fillRect(b[0] - dist * 2, b[1] - dist * 2, dist * 4, dist * 4);
  }
  ctx.restore();
}

export function bumpFin(ctx: Ctx, f: FinSpec): void {
  ctx.save();
  ctx.beginPath();
  trace(ctx, finOutline(f));
  ctx.clip();
  finRays(ctx, f, 'rgba(255,255,255,0.8)', (f.rayWidth ?? 0.9) * 1.5);
  ctx.restore();
}

export function finPart(b: Builder, box: Box, f: FinSpec, o?: Partial<LitOpts>): Part {
  return b.part({
    box,
    paint: (x) => paintFin(x, f),
    bump: (x) => bumpFin(x, f),
    lit: { dome: 3, soften: 0.5, spec: 0.28, gloss: 26, sheen: 0.06, shade: 0.5, rim: 0.3, lineSolid: 0.8, line: 0.9, bumpPx: 0.5, ...o },
  });
}

// ---------------------------------------------------------------- faces

export interface EyeOpts {
  /** Dark hue around the eye. */
  rim?: string;
  iris?: string;
  /** Where the pupil looks, in eye radii. */
  look?: readonly [number, number];
  /** 0..1 how far the top lid comes down. */
  lid?: number;
  lidColor?: string;
}

/** The big glossy friendly eye every creature shares. */
export function eye(ctx: Ctx, x: number, y: number, r: number, o: EyeOpts = {}): void {
  const rim = o.rim ?? 'rgba(20,28,60,0.75)';
  const iris = o.iris ?? '#2a55a8';
  const lx = (o.look?.[0] ?? 0.14) * r;
  const ly = (o.look?.[1] ?? 0.08) * r;
  ctx.save();
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.09, 0, TAU);
  ctx.fill();
  ctx.fillStyle = radial(ctx, x - r * 0.2, y - r * 0.3, r * 0.1, x, y, r, [
    [0, '#ffffff'],
    [0.7, '#f4f8ff'],
    [1, '#bfd0ea'],
  ]);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();

  const ir = r * 0.76;
  const ix = x + lx;
  const iy = y + ly;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  ctx.fillStyle = radial(ctx, ix, iy + ir * 0.35, ir * 0.1, ix, iy, ir, [
    [0, iris],
    [0.55, '#10183a'],
    [1, '#070a1c'],
  ]);
  ctx.beginPath();
  ctx.arc(ix, iy, ir, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.ellipse(ix, iy + ir * 0.58, ir * 0.55, ir * 0.24, 0, 0, TAU);
  ctx.fill();
  if (o.lid) {
    ctx.fillStyle = o.lidColor ?? '#886';
    ctx.beginPath();
    ctx.ellipse(x, y - r * (1.75 - o.lid * 1.1), r * 1.5, r, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(ix - ir * 0.3, iy - ir * 0.38, r * 0.34, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ix + ir * 0.36, iy + ir * 0.3, r * 0.13, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** A gentle smile as a tapered curve. `lift` raises the corners. */
export function smile(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, sag: number, width: number, color = 'rgba(40,18,40,0.85)'): void {
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const nx = -(y1 - y0);
  const ny = x1 - x0;
  const l = Math.hypot(nx, ny) || 1;
  const cx = mx + (nx / l) * sag;
  const cy = my + (ny / l) * sag;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

export function blush(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.fillStyle = radial(ctx, 0, 0, 0, 0, 0, rx, [
    [0, color],
    [1, color.replace(/[\d.]+\)$/, '0)')],
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export { smoothstep };
