// Turns creature rigs into sprite sheets, shadows and one-off Fish Book drawings.

import type { CreatureId, Sheet, SpriteId } from './types';
import { Builder, type CreatureDef, type FramePainter } from './rig';
import { ctxOf, flatten, free, newCanvas, releaseScratch, type Cnv, type Ctx, type View } from './paint';
import { FISH } from './fish';
import { SPECIALS } from './specials';
import { BOSSES, dragonPieces } from './bosses';

const MAX_SHEET = 2048;

const DEFS: Partial<Record<SpriteId, CreatureDef>> = {};
for (const d of [...FISH, ...SPECIALS, ...BOSSES]) DEFS[d.id] = d;

export function defOf(id: SpriteId): CreatureDef {
  const d = DEFS[id];
  if (!d) throw new Error(`No art for ${id}`);
  return d;
}

interface Layout {
  ppu: number;
  frameW: number;
  frameH: number;
  columns: number;
  rows: number;
  ox: number;
  oy: number;
}

function layout(d: CreatureDef, ppu: number): Layout {
  const k = d.size / 100;
  const bw = (d.box[2] - d.box[0]) * k;
  const bh = (d.box[3] - d.box[1]) * k;
  let p = ppu;
  for (;;) {
    const frameW = Math.ceil(bw * p) + 2;
    const frameH = Math.ceil(bh * p) + 2;
    const maxCols = Math.floor(MAX_SHEET / frameW);
    const maxRows = Math.floor(MAX_SHEET / frameH);
    if (maxCols >= 1 && maxRows >= 1 && maxCols * maxRows >= d.frames) {
      // Squarest grid that fits.
      let columns = Math.min(maxCols, Math.ceil(Math.sqrt((d.frames * frameH) / frameW)));
      columns = Math.max(columns, Math.ceil(d.frames / maxRows));
      const rows = Math.ceil(d.frames / columns);
      return {
        ppu: p,
        frameW,
        frameH,
        columns,
        rows,
        ox: Math.round(-d.box[0] * k * p) + 1,
        oy: Math.round(-d.box[1] * k * p) + 1,
      };
    }
    p *= 0.94;
  }
}

function buildRig(d: CreatureDef, ppu: number): { b: Builder; paint: FramePainter } {
  const k = d.size / 100;
  const b = new Builder(ppu * k * d.ss, k);
  return { b, paint: d.build(b) };
}

function renderFrame(ctx: Ctx, paint: FramePainter, phase: number, v: View): void {
  ctx.save();
  ctx.setTransform(v.s, 0, 0, v.s, v.ox, v.oy);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  paint(ctx, phase, v);
  ctx.restore();
}

let firstFrame: { key: string; canvas: Cnv } | null = null;

export function bakeSprite(id: SpriteId, ppu: number): Sheet {
  const d = defOf(id);
  const l = layout(d, ppu);
  const canvas = newCanvas(l.frameW * l.columns, l.frameH * l.rows);
  const ctx = ctxOf(canvas);
  const { b, paint } = buildRig(d, l.ppu);
  const s = l.ppu * (d.size / 100);
  for (let i = 0; i < d.frames; i++) {
    const col = i % l.columns;
    const row = Math.floor(i / l.columns);
    const cx = col * l.frameW;
    const cy = row * l.frameH;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx, cy, l.frameW, l.frameH);
    ctx.clip();
    renderFrame(ctx, paint, i / d.frames, { ox: cx + l.ox, oy: cy + l.oy, s });
    ctx.restore();
  }
  b.dispose();
  // The renderer asks for the shadow right after the sheet, so keep frame 0 and spare it a whole rig build.
  free(firstFrame?.canvas);
  const first = newCanvas(l.frameW, l.frameH);
  ctxOf(first).drawImage(canvas, 0, 0, l.frameW, l.frameH, 0, 0, l.frameW, l.frameH);
  firstFrame = { key: `${id}:${l.ppu}`, canvas: first };
  return {
    canvas,
    frameWidth: l.frameW,
    frameHeight: l.frameH,
    frames: d.frames,
    columns: l.columns,
    ppu: l.ppu,
    originX: l.ox,
    originY: l.oy,
    fps: d.fps,
    facing: d.facing,
  };
}

/** A true Gaussian from shadowBlur: a resize blur stair-steps on thin tentacles. */
function shadowOf(frame: Cnv, ppu: number): Cnv {
  const out = newCanvas(frame.width, frame.height);
  const x = ctxOf(out);
  const off = frame.width + frame.height + 64;
  x.shadowColor = '#000';
  x.shadowBlur = 7 * ppu;
  x.shadowOffsetX = off;
  x.drawImage(frame, -off, 0);
  return out;
}

/** Same frame size and origin as the matching sheet, so it can be placed exactly like a frame. */
export function bakeShadow(id: SpriteId, ppu: number): Cnv {
  const d = defOf(id);
  const l = layout(d, ppu);
  const key = `${id}:${l.ppu}`;
  let frame: Cnv;
  if (firstFrame?.key === key) {
    frame = firstFrame.canvas;
    firstFrame = null;
  } else {
    frame = newCanvas(l.frameW, l.frameH);
    const { b, paint } = buildRig(d, l.ppu);
    renderFrame(ctxOf(frame), paint, 0, { ox: l.ox, oy: l.oy, s: l.ppu * (d.size / 100) });
    b.dispose();
  }
  const out = shadowOf(frame, l.ppu);
  free(frame);
  return out;
}

function currentScale(ctx: Ctx): number {
  const m = ctx.getTransform();
  return Math.max(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d)) || 1;
}

interface Portrait {
  canvas: Cnv;
  /** Tight painted bounds in canvas pixels. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Canvas pixels per requested pixel. */
  density: number;
}

const portraitCache = new Map<string, Portrait>();
const PORTRAIT_LIMIT = 40;

function renderPiece(d: CreatureDef, scale: number, phase: number): { canvas: Cnv; ox: number; oy: number } {
  const ox = Math.ceil(-d.box[0] * scale) + 2;
  const oy = Math.ceil(-d.box[1] * scale) + 2;
  const canvas = newCanvas((d.box[2] - d.box[0]) * scale + 4, (d.box[3] - d.box[1]) * scale + 4);
  const b = new Builder(scale * d.ss, d.size / 100);
  const paint = d.build(b);
  renderFrame(ctxOf(canvas), paint, phase, { ox, oy, s: scale });
  b.dispose();
  return { canvas, ox, oy };
}

/** Frame painters work in device pixels, so each dragon piece renders on its own and is then placed. */
function wholeDragon(px: number, phase: number): Cnv {
  const unit = px / 780;
  const canvas = newCanvas(px, px * 0.56);
  const ctx = ctxOf(canvas);
  ctx.imageSmoothingQuality = 'high';
  const left = canvas.width * 0.72;
  const top = canvas.height / 2;
  for (const p of dragonPieces()) {
    const piece = renderPiece(p.def, unit * (p.def.size / 100), phase);
    ctx.save();
    ctx.translate(left + p.x * unit, top + p.y * unit);
    ctx.rotate(p.rot);
    ctx.drawImage(piece.canvas, -piece.ox, -piece.oy);
    ctx.restore();
    free(piece.canvas);
  }
  return canvas;
}

function paintedBounds(c: Cnv): [number, number, number, number] {
  const { width: w, height: h } = c;
  const data = ctxOf(c, true).getImageData(0, 0, w, h).data;
  let x0 = w;
  let y0 = h;
  let x1 = 0;
  let y1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3]! > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 >= x0 ? [x0, y0, x1 + 1, y1 + 1] : [0, 0, w, h];
}

function portrait(id: CreatureId, size: number, density: number, phase: number, silhouette: boolean): Portrait {
  const d = defOf(id);
  const px = Math.max(16, Math.round(size * density));
  const key = `${id}:${px}:${phase.toFixed(3)}:${silhouette ? 1 : 0}`;
  const hit = portraitCache.get(key);
  if (hit) {
    portraitCache.delete(key);
    portraitCache.set(key, hit);
    return hit;
  }
  // The art box can be looser than the painted art, so render a little over size and fit to the real bounds.
  const over = 1.2;
  const long = Math.max(d.box[2] - d.box[0], d.box[3] - d.box[1]);
  const canvas = id === 'B02' ? wholeDragon(Math.ceil(px * over), phase) : renderPiece(d, (px * over) / long, phase).canvas;
  releaseScratch();
  const [x0, y0, x1, y1] = paintedBounds(canvas);
  if (silhouette) flatten(canvas, '#0a2740');
  const made: Portrait = { canvas, x0, y0, x1, y1, density: Math.max(x1 - x0, y1 - y0) / size };
  portraitCache.set(key, made);
  if (portraitCache.size > PORTRAIT_LIMIT) {
    const oldest = portraitCache.keys().next().value;
    if (oldest !== undefined) {
      free(portraitCache.get(oldest)?.canvas);
      portraitCache.delete(oldest);
    }
  }
  return made;
}

export function drawCreature(
  ctx: CanvasRenderingContext2D,
  id: CreatureId,
  x: number,
  y: number,
  size: number,
  opts?: { silhouette?: boolean; phase?: number },
): void {
  const p = portrait(id, size, currentScale(ctx), opts?.phase ?? 0.1, opts?.silhouette ?? false);
  const w = (p.x1 - p.x0) / p.density;
  const h = (p.y1 - p.y0) / p.density;
  ctx.drawImage(p.canvas, p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0, x - w / 2, y - h / 2, w, h);
}
