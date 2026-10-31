import type { PathConfig } from '../config';
import type { ViewRect } from './state';

/** An arc-length parameterised polyline a fish can follow. */
export interface Path {
  xs: Float32Array;
  ys: Float32Array;
  /** Cumulative length at each vertex. */
  ls: Float32Array;
  length: number;
}

export interface PathSample {
  x: number;
  y: number;
  /** Unit tangent. */
  tx: number;
  ty: number;
}

const STEPS_PER_SEGMENT = 16;

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (3 * p1 - p0 - 3 * p2 + p3) * t2 * t);
}

function fromPoints(px: number[], py: number[]): Path {
  const xs = new Float32Array(px);
  const ys = new Float32Array(py);
  const ls = new Float32Array(xs.length);
  let length = 0;
  for (let i = 1; i < xs.length; i++) {
    length += Math.hypot(xs[i]! - xs[i - 1]!, ys[i]! - ys[i - 1]!);
    ls[i] = length;
  }
  return { xs, ys, ls, length };
}

export function straightPath(x0: number, y0: number, x1: number, y1: number): Path {
  return fromPoints([x0, x1], [y0, y1]);
}

/** Lays an authored spline onto the current view, with optional mirroring for variety. */
export function buildPath(config: PathConfig, view: ViewRect, mirrorX: boolean, mirrorY: boolean): Path {
  const w = view.right - view.left;
  const h = view.bottom - view.top;
  const cx: number[] = [];
  const cy: number[] = [];
  for (const [u, v] of config.points) {
    cx.push(view.left + (mirrorX ? 1 - u : u) * w);
    cy.push(view.top + (mirrorY ? 1 - v : v) * h);
  }

  const px: number[] = [];
  const py: number[] = [];
  const last = cx.length - 1;
  for (let i = 0; i < last; i++) {
    const a = Math.max(0, i - 1);
    const d = Math.min(last, i + 2);
    for (let s = 0; s < STEPS_PER_SEGMENT; s++) {
      const t = s / STEPS_PER_SEGMENT;
      px.push(catmullRom(cx[a]!, cx[i]!, cx[i + 1]!, cx[d]!, t));
      py.push(catmullRom(cy[a]!, cy[i]!, cy[i + 1]!, cy[d]!, t));
    }
  }
  px.push(cx[last]!);
  py.push(cy[last]!);
  return fromPoints(px, py);
}

/** The same path stretched from one view onto another, keeping each point at the same place on screen. */
export function refitPath(path: Path, from: ViewRect, to: ViewRect): Path {
  const scaleX = (to.right - to.left) / (from.right - from.left);
  const scaleY = (to.bottom - to.top) / (from.bottom - from.top);
  return fromPoints(
    Array.from(path.xs, (x) => to.left + (x - from.left) * scaleX),
    Array.from(path.ys, (y) => to.top + (y - from.top) * scaleY),
  );
}

/** Before the start and past the end a path continues along its end tangent, so formations can queue off screen. */
export function samplePath(path: Path, dist: number, out: PathSample): PathSample {
  const { xs, ys, ls, length } = path;
  const last = xs.length - 1;

  if (dist <= 0 || dist >= length) {
    const i = dist <= 0 ? 0 : last - 1;
    const dx = xs[i + 1]! - xs[i]!;
    const dy = ys[i + 1]! - ys[i]!;
    const seg = Math.hypot(dx, dy) || 1;
    out.tx = dx / seg;
    out.ty = dy / seg;
    const base = dist <= 0 ? 0 : last;
    const over = dist <= 0 ? dist : dist - length;
    out.x = xs[base]! + out.tx * over;
    out.y = ys[base]! + out.ty * over;
    return out;
  }

  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ls[mid]! <= dist) lo = mid;
    else hi = mid;
  }
  const dx = xs[hi]! - xs[lo]!;
  const dy = ys[hi]! - ys[lo]!;
  const seg = ls[hi]! - ls[lo]! || 1;
  const t = (dist - ls[lo]!) / seg;
  out.x = xs[lo]! + dx * t;
  out.y = ys[lo]! + dy * t;
  out.tx = dx / seg;
  out.ty = dy / seg;
  return out;
}

/** Distance along the path at which it first enters the rect, or 0 if it starts inside. */
export function firstEntryDistance(path: Path, view: ViewRect): number {
  for (let i = 0; i < path.xs.length; i++) {
    const x = path.xs[i]!;
    const y = path.ys[i]!;
    if (x >= view.left && x <= view.right && y >= view.top && y <= view.bottom) return path.ls[i]!;
  }
  return 0;
}
