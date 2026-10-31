// Shared painting helpers: canvases, seeded noise, paths, gradients, and the per-pixel "inflate and light" pass
// that gives flat silhouettes their pre-rendered 3D volume.

export type Ctx = CanvasRenderingContext2D;
export type Cnv = HTMLCanvasElement;
export type Stops = ReadonlyArray<readonly [number, string]>;
/** x, y and an optional flag: 1 marks a sharp corner. */
export type P = readonly [number, number, number?];
export type Rgb = readonly [number, number, number];

export function newCanvas(w: number, h: number): Cnv {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export function ctxOf(c: Cnv, readback = false): Ctx {
  const x = c.getContext('2d', readback ? { willReadFrequently: true } : undefined);
  if (!x) throw new Error('2D canvas context unavailable');
  return x;
}

export function free(...cs: Array<Cnv | null | undefined>): void {
  for (const c of cs) {
    if (c) {
      c.width = 0;
      c.height = 0;
    }
  }
}

export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TAU = Math.PI * 2;
export const clamp = (v: number, a = 0, b = 1): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (a: number, b: number, v: number): number => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- colour

export function hexRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function css(c: Rgb, a = 1): string {
  return a >= 1
    ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
    : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
}

export function alpha(hex: string, a: number): string {
  return css(hexRgb(hex), a);
}

export function mix(a: string, b: string, t: number): string {
  const x = hexRgb(a);
  const y = hexRgb(b);
  const h = (v: number): string => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
  return `#${h(lerp(x[0], y[0], t))}${h(lerp(x[1], y[1], t))}${h(lerp(x[2], y[2], t))}`;
}

export function hsl(h: number, s: number, l: number, a = 1): string {
  return `hsla(${h},${s}%,${l}%,${a})`;
}

// ---------------------------------------------------------------- gradients

export function linear(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: Stops): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export function radial(
  ctx: Ctx,
  x0: number,
  y0: number,
  r0: number,
  x1: number,
  y1: number,
  r1: number,
  stops: Stops,
): CanvasGradient {
  const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

// ---------------------------------------------------------------- paths

/** Catmull-Rom spline through the points. Points flagged 1 become sharp corners. */
export function trace(ctx: Ctx, pts: readonly P[], closed = true, tight = 1 / 6): void {
  const n = pts.length;
  if (n < 2) return;
  const at = (i: number): P => pts[closed ? (i + n) % n : clamp(i, 0, n - 1)]!;
  ctx.moveTo(pts[0]![0], pts[0]![1]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1[2] ? p1[0] : p1[0] + (p2[0] - p0[0]) * tight;
    const c1y = p1[2] ? p1[1] : p1[1] + (p2[1] - p0[1]) * tight;
    const c2x = p2[2] ? p2[0] : p2[0] - (p3[0] - p1[0]) * tight;
    const c2y = p2[2] ? p2[1] : p2[1] - (p3[1] - p1[1]) * tight;
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2[0], p2[1]);
  }
  if (closed) ctx.closePath();
}

export function fillPath(ctx: Ctx, pts: readonly P[], fill: string | CanvasGradient, closed = true): void {
  ctx.beginPath();
  trace(ctx, pts, closed);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function strokePath(ctx: Ctx, pts: readonly P[], stroke: string | CanvasGradient, width: number, closed = false): void {
  ctx.beginPath();
  trace(ctx, pts, closed);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot: number, fill: string | CanvasGradient): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function circle(ctx: Ctx, x: number, y: number, r: number, fill: string | CanvasGradient): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.abs(r), 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stroke: string | CanvasGradient, width: number): void {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
}

export function clipped(ctx: Ctx, pts: readonly P[], paint: () => void): void {
  ctx.save();
  ctx.beginPath();
  trace(ctx, pts, true);
  ctx.clip();
  paint();
  ctx.restore();
}

export function mirrorY(pts: readonly P[]): P[] {
  return pts.map((p) => [p[0], -p[1], p[2]] as P).reverse();
}

export function mirrorX(pts: readonly P[]): P[] {
  return pts.map((p) => [-p[0], p[1], p[2]] as P).reverse();
}

export function rotatePts(pts: readonly P[], ang: number, cx = 0, cy = 0): P[] {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return pts.map((p) => {
    const x = p[0] - cx;
    const y = p[1] - cy;
    return [cx + x * c - y * s, cy + x * s + y * c, p[2]] as P;
  });
}

// ---------------------------------------------------------------- soft shapes

/** Blurs a canvas in place by shrinking and regrowing it, for Safari where ctx.filter is missing. */
export function softBlur(c: Cnv, factor: number): void {
  const w = c.width;
  const h = c.height;
  const sw = Math.max(2, Math.round(w / factor));
  const sh = Math.max(2, Math.round(h / factor));
  const mid = newCanvas(Math.max(sw, Math.round(w / 2)), Math.max(sh, Math.round(h / 2)));
  const small = newCanvas(sw, sh);
  const mx = ctxOf(mid);
  const sx = ctxOf(small);
  mx.imageSmoothingEnabled = true;
  sx.imageSmoothingEnabled = true;
  mx.drawImage(c, 0, 0, mid.width, mid.height);
  sx.drawImage(mid, 0, 0, sw, sh);
  const x = ctxOf(c);
  x.save();
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalCompositeOperation = 'copy';
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  mx.globalCompositeOperation = 'copy';
  mx.drawImage(small, 0, 0, mid.width, mid.height);
  x.drawImage(mid, 0, 0, w, h);
  x.restore();
  free(mid, small);
}

/** Replaces all colour in a canvas with one flat colour, keeping alpha. */
export function flatten(c: Cnv, color: string): void {
  const x = ctxOf(c);
  x.save();
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  x.restore();
}

// ---------------------------------------------------------------- inflate and light

export interface LitOpts {
  /** Rounded edge radius in px: how far from the silhouette the surface keeps rising. */
  dome: number;
  /** Multiplies the surface height. Lower is flatter. */
  depth?: number;
  /** Blur radius in px for the height field. */
  soften?: number;
  /** Greyscale bump canvas, same size as the target. Mid grey is neutral. */
  bump?: Cnv | null;
  /** Height of a full-white bump, in px. */
  bumpPx?: number;
  /** Unit-ish vector pointing at the light. */
  light?: Rgb;
  /** 0..1: how dark the shaded side gets. */
  shade?: number;
  /** Multiplier applied in shadow, tints the shaded side. */
  tint?: Rgb;
  spec?: number;
  gloss?: number;
  /** Broad soft specular. */
  sheen?: number;
  rim?: number;
  rimColor?: Rgb;
  /** Outline width in px. Drawn inward so the silhouette is unchanged. */
  line?: number;
  /** 0..1 how strongly the outline darkens. */
  lineDark?: number;
  /** 0..1 how much the outline raises alpha, so translucent fins keep a crisp edge. */
  lineSolid?: number;
}

const pool: Float32Array[] = [];

function scratch(slot: number, n: number): Float32Array {
  let a = pool[slot];
  if (!a || a.length < n) {
    a = new Float32Array(Math.ceil(n * 1.3));
    pool[slot] = a;
  }
  return a;
}

/** Releases the shared float buffers. Call after a large bake. */
export function releaseScratch(): void {
  pool.length = 0;
}

function boxBlur(src: Float32Array, tmp: Float32Array, w: number, h: number, r: number): void {
  if (r < 1) return;
  const norm = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let i = -r; i <= r; i++) sum += src[row + clamp(i, 0, w - 1)]!;
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum * norm;
      const a = x + r + 1;
      const b = x - r;
      sum += src[row + (a < w ? a : w - 1)]! - src[row + (b > 0 ? b : 0)]!;
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let i = -r; i <= r; i++) sum += tmp[clamp(i, 0, h - 1) * w + x]!;
    for (let y = 0; y < h; y++) {
      src[y * w + x] = sum * norm;
      const a = y + r + 1;
      const b = y - r;
      sum += tmp[(a < h ? a : h - 1) * w + x]! - tmp[(b > 0 ? b : 0) * w + x]!;
    }
  }
}

const DEFAULT_LIGHT: Rgb = [0.18, -0.62, 0.76];
const specLut = new Float32Array(256);
const sheenLut = new Float32Array(256);
let lutGloss = -1;

function fillSpec(gloss: number): void {
  if (gloss === lutGloss) return;
  lutGloss = gloss;
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    specLut[i] = Math.pow(v, gloss);
    sheenLut[i] = Math.pow(v, 9);
  }
}

/** Bounds of every non-transparent pixel plus a margin, clamped to the image: x, y, width, height. */
function paintedBox(img: ImageData, margin: number): [number, number, number, number] {
  const { width: w, height: h, data: d } = img;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (d[(row + x) * 4 + 3] !== 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
    }
  }
  if (x1 < 0) return [0, 0, 0, 0];
  x0 = Math.max(0, x0 - margin);
  y0 = Math.max(0, y0 - margin);
  x1 = Math.min(w - 1, x1 + margin);
  y1 = Math.min(h - 1, y1 + margin);
  return [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}

/** Treats the canvas's alpha as a silhouette, inflates it into a height field, and lights the painted colours. */
export function lit(c: Cnv, o: LitOpts): void {
  const x2 = ctxOf(c, true);
  const full = x2.getImageData(0, 0, c.width, c.height);
  // Every pass below runs on the painted area only. The margin covers the blur, so results match an uncropped run.
  const R0 = Math.max(1, o.dome);
  const blur0 = Math.round(o.soften ?? Math.min(R0 / 5, 8));
  const crop = paintedBox(full, blur0 + Math.ceil(blur0 / 2) + 3);
  const cx0 = crop[0];
  const cy0 = crop[1];
  const W = crop[2];
  const H = crop[3];
  const n = W * H;
  if (n === 0) return;
  const img = x2.getImageData(cx0, cy0, W, H);
  const px = img.data;

  const D = scratch(0, n);
  const T = scratch(1, n);
  const Z = scratch(2, n);

  for (let i = 0; i < n; i++) D[i] = px[i * 4 + 3]! < 48 ? 0 : 1e6;
  for (let x = 0; x < W; x++) {
    D[x] = 0;
    D[n - 1 - x] = 0;
  }
  for (let y = 0; y < H; y++) {
    D[y * W] = 0;
    D[y * W + W - 1] = 0;
  }
  const S2 = Math.SQRT2;
  for (let y = 1; y < H - 1; y++) {
    const row = y * W;
    for (let x = 1; x < W - 1; x++) {
      const i = row + x;
      let v = D[i]!;
      if (v === 0) continue;
      let t = D[i - 1]! + 1;
      if (t < v) v = t;
      t = D[i - W]! + 1;
      if (t < v) v = t;
      t = D[i - W - 1]! + S2;
      if (t < v) v = t;
      t = D[i - W + 1]! + S2;
      if (t < v) v = t;
      D[i] = v;
    }
  }
  for (let y = H - 2; y >= 1; y--) {
    const row = y * W;
    for (let x = W - 2; x >= 1; x--) {
      const i = row + x;
      let v = D[i]!;
      if (v === 0) continue;
      let t = D[i + 1]! + 1;
      if (t < v) v = t;
      t = D[i + W]! + 1;
      if (t < v) v = t;
      t = D[i + W + 1]! + S2;
      if (t < v) v = t;
      t = D[i + W - 1]! + S2;
      if (t < v) v = t;
      D[i] = v;
    }
  }

  const R = Math.max(1, o.dome);
  const depth = (o.depth ?? 1) * R;
  const inv = 1 / R;
  for (let i = 0; i < n; i++) {
    const t = D[i]! * inv;
    Z[i] = t >= 1 ? depth : depth * Math.sqrt(t * (2 - t));
  }
  const blurR = Math.round(o.soften ?? Math.min(R / 5, 8));
  if (blurR >= 1) {
    boxBlur(Z, T, W, H, blurR);
    if (blurR >= 3) boxBlur(Z, T, W, H, Math.max(1, Math.round(blurR / 2)));
  }

  if (o.bump) {
    const bx = ctxOf(o.bump, true);
    const bd = bx.getImageData(cx0, cy0, W, H).data;
    const amt = (o.bumpPx ?? 2) / 127;
    for (let i = 0; i < n; i++) Z[i] = Z[i]! + (bd[i * 4]! - 128) * amt;
  }

  const L = o.light ?? DEFAULT_LIGHT;
  const ll = Math.hypot(L[0], L[1], L[2]);
  const lx = L[0] / ll;
  const ly = L[1] / ll;
  const lz = L[2] / ll;
  const hl = Math.hypot(lx, ly, lz + 1);
  const hx = lx / hl;
  const hy = ly / hl;
  const hz = (lz + 1) / hl;

  const shade = o.shade ?? 0.72;
  const tint = o.tint ?? ([0.56, 0.44, 0.78] as Rgb);
  const spec = (o.spec ?? 0.55) * 255;
  const sheen = (o.sheen ?? 0.14) * 255;
  const rim = (o.rim ?? 0.5) * 255;
  const rc = o.rimColor ?? ([0.72, 0.9, 1] as Rgb);
  const lineW = o.line ?? 0;
  const lineDark = o.lineDark ?? 0.72;
  const lineSolid = o.lineSolid ?? 0;
  fillSpec(o.gloss ?? 42);

  for (let y = 1; y < H - 1; y++) {
    const row = y * W;
    for (let x = 1; x < W - 1; x++) {
      const i = row + x;
      const p = i * 4;
      const a = px[p + 3]!;
      if (a === 0) continue;
      const gx = (Z[i - 1]! - Z[i + 1]!) * 0.5;
      const gy = (Z[i - W]! - Z[i + W]!) * 0.5;
      const il = 1 / Math.sqrt(gx * gx + gy * gy + 1);
      const nx = gx * il;
      const ny = gy * il;
      const nz = il;

      const dot = nx * lx + ny * ly + nz * lz;
      const wrap = (dot + 0.35) / 1.35;
      const dif = wrap < 0 ? 0 : wrap;
      const s = (1 - dif) * shade;

      let r = px[p]!;
      let g = px[p + 1]!;
      let b = px[p + 2]!;
      // Shadows keep their hue: bright channels fall less than dim ones.
      const rn = r / 255;
      const gn = g / 255;
      const bn = b / 255;
      r *= 1 - s * (1 - tint[0] * (0.3 + 0.7 * rn));
      g *= 1 - s * (1 - tint[1] * (0.3 + 0.7 * gn));
      b *= 1 - s * (1 - tint[2] * (0.3 + 0.7 * bn));

      if (lineW > 0) {
        const d = D[i]!;
        if (d < lineW + 1) {
          let e = 1 - (d - 0.5) / lineW;
          e = e < 0 ? 0 : e > 1 ? 1 : e;
          e = e * e * (3 - 2 * e) * lineDark;
          r = r * (1 - e) + (r * r * 0.0028) * e;
          g = g * (1 - e) + (g * g * 0.0028) * e;
          b = b * (1 - e) + (b * b * 0.0034) * e;
          if (lineSolid > 0) px[p + 3] = a + (255 - a) * e * lineSolid;
        }
      }

      const ndh = nx * hx + ny * hy + nz * hz;
      if (ndh > 0) {
        const idx = (ndh * 255) | 0;
        const glint = specLut[idx]! * spec + sheenLut[idx]! * sheen;
        r += glint;
        g += glint;
        b += glint;
      }
      const edge = 1 - nz;
      if (edge > 0.02) {
        const top = 0.5 - ny * 0.5;
        const f = edge * edge * top * rim;
        r += f * rc[0];
        g += f * rc[1];
        b += f * rc[2];
      }
      px[p] = r;
      px[p + 1] = g;
      px[p + 2] = b;
    }
  }
  x2.putImageData(img, cx0, cy0);
}

// ---------------------------------------------------------------- warps

export interface View {
  /** Pixel position of the art origin in the target. */
  ox: number;
  oy: number;
  /** Output pixels per art unit. */
  s: number;
}

export interface Part {
  canvas: Cnv;
  /** Box in art units. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Part pixels per art unit. */
  s: number;
}

export function blit(ctx: Ctx, part: Part): void {
  ctx.drawImage(part.canvas, part.x, part.y, part.w, part.h);
}

/** Draws a part rotated and squashed about a pivot given in art units. */
export function blitAt(ctx: Ctx, part: Part, px: number, py: number, rot: number, sx = 1, sy = 1, dx = 0, dy = 0): void {
  ctx.save();
  ctx.translate(px + dx, py + dy);
  ctx.rotate(rot);
  ctx.scale(sx, sy);
  ctx.translate(-px, -py);
  blit(ctx, part);
  ctx.restore();
}

/**
 * Column warp. `dy(x)` moves each column vertically; `map(x)` chooses the source column, which is how tails
 * foreshorten as they swing; `sy(x)` squashes a column about y = 0.
 */
export function warpCols(
  ctx: Ctx,
  v: View,
  part: Part,
  dy: (x: number) => number,
  map?: ((x: number) => number) | null,
  sy?: ((x: number) => number) | null,
  step = 1,
): void {
  const src = part.canvas;
  const c0 = Math.floor(part.x * v.s + v.ox);
  const c1 = Math.ceil((part.x + part.w) * v.s + v.ox);
  const baseY = Math.round(part.y * v.s + v.oy);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let c = c0; c < c1; c += step) {
    const xa = (c - v.ox) / v.s;
    const xb = (c + step - v.ox) / v.s;
    const sa = map ? map(xa) : xa;
    const sb = map ? map(xb) : xb;
    let s0 = (sa - part.x) * part.s;
    let s1 = (sb - part.x) * part.s;
    if (s1 <= 0 || s0 >= src.width) continue;
    if (s0 < 0) s0 = 0;
    if (s1 > src.width) s1 = src.width;
    if (s1 - s0 < 0.01) continue;
    const mid = (xa + xb) * 0.5;
    const off = dy(mid) * v.s;
    const k = sy ? sy(mid) : 1;
    const top = k === 1 ? baseY : part.y * k * v.s + v.oy;
    ctx.drawImage(src, s0, 0, s1 - s0, src.height, c, top + off, step, part.h * k * v.s);
  }
  ctx.restore();
}

/** Row warp, the same idea turned 90 degrees, for upright creatures and flapping wings. */
export function warpRows(
  ctx: Ctx,
  v: View,
  part: Part,
  dx: (y: number) => number,
  map?: ((y: number) => number) | null,
  sx?: ((y: number) => number) | null,
  step = 1,
): void {
  const src = part.canvas;
  const r0 = Math.floor(part.y * v.s + v.oy);
  const r1 = Math.ceil((part.y + part.h) * v.s + v.oy);
  const baseX = Math.round(part.x * v.s + v.ox);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let r = r0; r < r1; r += step) {
    const ya = (r - v.oy) / v.s;
    const yb = (r + step - v.oy) / v.s;
    const sa = map ? map(ya) : ya;
    const sb = map ? map(yb) : yb;
    let s0 = (sa - part.y) * part.s;
    let s1 = (sb - part.y) * part.s;
    if (s1 <= 0 || s0 >= src.height) continue;
    if (s0 < 0) s0 = 0;
    if (s1 > src.height) s1 = src.height;
    if (s1 - s0 < 0.01) continue;
    const mid = (ya + yb) * 0.5;
    const off = dx(mid) * v.s;
    const k = sx ? sx(mid) : 1;
    const left = k === 1 ? baseX : part.x * k * v.s + v.ox;
    ctx.drawImage(src, 0, s0, src.width, s1 - s0, left + off, r, part.w * k * v.s, step);
  }
  ctx.restore();
}
