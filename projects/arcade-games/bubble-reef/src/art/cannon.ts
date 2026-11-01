// Seven cannon skins across five levels. Skins differ only in look; barrel layouts follow the level table in the GDD.

import type { CannonBake, CannonSkinId, SkinId } from './types';
import {
  TAU,
  alpha,
  circle,
  clamp,
  clipped,
  ctxOf,
  ellipse,
  free,
  hsl,
  linear,
  lit,
  mix,
  newCanvas,
  radial,
  trace,
  type Cnv,
  type Ctx,
  type P,
  type Rgb,
} from './paint';

const BASE_W = 160;
const CANVAS_W = 216;
const CANVAS_H = 152;
const BARREL_W = 230;
const BARREL_H = 256;
const PIVOT_Y = 226;

interface Skin {
  barrel: readonly [string, string];
  ring: string;
  muzzle: string;
  base: readonly [string, string];
  trim: string;
  glow: string;
  hub?: readonly [string, string];
  spec: number;
  gloss: number;
  tint: Rgb;
  /** Extra painting on one barrel, in barrel space: x across, y up from 0 at the root to -len at the muzzle. */
  barrelArt?(x: Ctx, w: number, len: number, out: P[]): void;
  barrelBump?(x: Ctx, w: number, len: number): void;
  baseArt?(x: Ctx, shape: P[]): void;
  baseBump?(x: Ctx): void;
  shape?: P[];
}

const dome: P[] = [[80, 8], [76, -22], [58, -46], [28, -60], [0, -64], [-28, -60], [-58, -46], [-76, -22], [-80, 8], [-72, 40], [-44, 56], [0, 62], [44, 56], [72, 40]];

function rings(x: Ctx, w: number, ys: readonly number[], color: string, h: number): void {
  x.fillStyle = color;
  for (const y of ys) x.fillRect(-w * 1.4, y - h / 2, w * 2.8, h);
}

function rivets(x: Ctx, pts: ReadonlyArray<readonly [number, number]>, r: number, color: string): void {
  for (const [px, py] of pts) circle(x, px, py, r, color);
}

function radialRibs(x: Ctx, n: number, r0: number, r1: number, color: string, width: number): void {
  x.strokeStyle = color;
  x.lineWidth = width;
  x.lineCap = 'round';
  x.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    x.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    x.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
  }
  x.stroke();
}

function centerHub(x: Ctx, r: number, a: string, b: string): void {
  circle(x, 0, 0, r, radial(x, -r * 0.3, -r * 0.3, r * 0.1, 0, 0, r, [[0, a], [1, b]]));
}

/** The first cannon, which also comes in red for Player 2. */
function plainSkin(barrel: Skin['barrel'], base: Skin['base'], hub: readonly [string, string], glow: string, tint: Rgb): Skin {
  return {
    barrel, ring: '#ffd34f', muzzle: '#ffffff', base, trim: '#ffd34f', glow, spec: 0.62, gloss: 46, tint,
    barrelArt: (x, w, len) => rings(x, w, [-len * 0.3], '#ffffff', 7),
    baseArt: (x) => {
      x.strokeStyle = '#ffd34f';
      x.lineWidth = 5;
      x.beginPath();
      x.arc(0, 0, 54, 0, TAU);
      x.stroke();
      rivets(x, [[-68, -6], [68, -6], [-52, 34], [52, 34], [0, 50]], 4, '#ffffff');
      centerHub(x, 40, hub[0], hub[1]);
    },
    baseBump: (x) => {
      x.strokeStyle = 'rgba(255,255,255,0.8)';
      x.lineWidth = 5;
      x.beginPath();
      x.arc(0, 0, 54, 0, TAU);
      x.stroke();
      rivets(x, [[-68, -6], [68, -6], [-52, 34], [52, 34], [0, 50]], 4, 'rgba(255,255,255,0.9)');
    },
  };
}

const SKINS: Record<CannonSkinId, Skin> = {
  classic: plainSkin(['#2f7fd8', '#5fb4ff'], ['#2a64b8', '#1c4a92'], ['#8fd2ff', '#2f7fd8'], '#7fe0ff', [0.44, 0.5, 0.9]),
  red: plainSkin(['#d8342f', '#ff7a6b'], ['#b82a2a', '#921c1c'], ['#ff9a8f', '#d8342f'], '#ffb0a0', [0.9, 0.46, 0.42]),
  seashell: {
    barrel: ['#ffc6d4', '#fff0e4'], ring: '#ff9fb8', muzzle: '#ffb6c8', base: ['#ffd8d8', '#f0a8b8'], trim: '#ff9fb8', glow: '#ffd0f0', spec: 0.8, gloss: 56, tint: [0.84, 0.54, 0.74],
    barrelArt: (x, w, len) => {
      x.strokeStyle = 'rgba(220,110,150,0.5)';
      x.lineWidth = 2.4;
      x.beginPath();
      for (let i = 0; i < 9; i++) {
        const y = -((i + 1) / 10) * len;
        x.moveTo(-w, y + 6);
        x.quadraticCurveTo(0, y - 6, w, y + 6);
      }
      x.stroke();
    },
    barrelBump: (x, w, len) => {
      x.strokeStyle = 'rgba(30,30,30,0.7)';
      x.lineWidth = 2.6;
      x.beginPath();
      for (let i = 0; i < 9; i++) {
        const y = -((i + 1) / 10) * len;
        x.moveTo(-w, y + 6);
        x.quadraticCurveTo(0, y - 6, w, y + 6);
      }
      x.stroke();
    },
    shape: [[84, 14], [72, -14], [80, -24], [60, -44], [64, -56], [38, -60], [32, -72], [0, -70], [-32, -72], [-38, -60], [-64, -56], [-60, -44], [-80, -24], [-72, -14], [-84, 14], [-70, 42], [-40, 58], [0, 62], [40, 58], [70, 42]],
    baseArt: (x) => {
      x.translate(0, 56);
      radialRibs(x, 40, 16, 150, 'rgba(216,100,140,0.55)', 3.4);
      x.translate(0, -56);
      centerHub(x, 34, '#fff4e8', '#ffb8c8');
    },
    baseBump: (x) => {
      x.translate(0, 56);
      radialRibs(x, 40, 16, 150, 'rgba(255,255,255,0.8)', 6);
      x.translate(0, -56);
    },
  },
  coral: {
    barrel: ['#f2544c', '#ff9068'], ring: '#ffc25a', muzzle: '#ffd9a0', base: ['#e8554a', '#a83242'], trim: '#ffc25a', glow: '#ffb080', spec: 0.5, gloss: 34, tint: [0.78, 0.36, 0.5],
    barrelArt: (x, w, len) => {
      for (let i = 0; i < 16; i++) {
        const a = i * 2.4;
        const px = Math.sin(a) * w * 0.74;
        const py = -((i + 1) / 17) * len * 0.8 - 6;
        circle(x, px, py, 3.2, '#ffc9a8');
        circle(x, px, py, 1.3, '#a83242');
      }
    },
    barrelBump: (x, w, len) => {
      for (let i = 0; i < 16; i++) {
        const a = i * 2.4;
        circle(x, Math.sin(a) * w * 0.74, -((i + 1) / 17) * len * 0.8 - 6, 3.8, 'rgba(255,255,255,0.85)');
      }
    },
    shape: [[80, 10], [86, -14], [68, -26], [74, -46], [52, -48], [46, -66], [22, -58], [4, -72], [-16, -58], [-40, -66], [-48, -46], [-74, -44], [-68, -24], [-86, -12], [-80, 12], [-70, 40], [-44, 56], [0, 62], [44, 56], [70, 40]],
    baseArt: (x) => {
      for (let i = 0; i < 60; i++) {
        const a = i * 2.399;
        const r = 16 + Math.sqrt(i / 60) * 62;
        circle(x, Math.cos(a) * r, Math.sin(a) * r * 0.85, 3.4, 'rgba(255,190,150,0.8)');
      }
      centerHub(x, 34, '#ffbe80', '#e8554a');
    },
    baseBump: (x) => {
      for (let i = 0; i < 60; i++) {
        const a = i * 2.399;
        const r = 16 + Math.sqrt(i / 60) * 62;
        circle(x, Math.cos(a) * r, Math.sin(a) * r * 0.85, 4, 'rgba(255,255,255,0.85)');
      }
    },
  },
  submarine: {
    barrel: ['#ffc72e', '#ffe36a'], ring: '#f0802a', muzzle: '#f0802a', base: ['#ffc72e', '#e89a14'], trim: '#f0802a', glow: '#fff08a', spec: 0.68, gloss: 50, tint: [0.78, 0.42, 0.4],
    barrelArt: (x, w, len) => {
      rings(x, w, [-len * 0.36, -len * 0.7], '#f0802a', 6);
      for (const y of [0.12, 0.5, 0.86]) rivets(x, [[-w * 0.62, -len * y], [w * 0.62, -len * y]], 2.2, '#b86a10');
    },
    baseArt: (x) => {
      x.fillStyle = '#f0802a';
      x.fillRect(-90, 14, 180, 8);
      rivets(x, [[-70, 30], [-48, 40], [-20, 44], [20, 44], [48, 40], [70, 30], [-70, -6], [70, -6], [-52, -34], [52, -34]], 3.2, '#b86a10');
      for (const px of [-52, 52]) {
        circle(x, px, -6, 15, '#d8dee8');
        circle(x, px, -6, 10.5, radial(x, px - 3, -9, 1, px, -6, 10.5, [[0, '#a8ecff'], [1, '#2a78b0']]));
      }
      centerHub(x, 32, '#ffe36a', '#f0a81e');
    },
    baseBump: (x) => {
      rivets(x, [[-70, 30], [-48, 40], [-20, 44], [20, 44], [48, 40], [70, 30], [-70, -6], [70, -6], [-52, -34], [52, -34]], 3.4, 'rgba(255,255,255,0.9)');
      for (const px of [-52, 52]) circle(x, px, -6, 15, 'rgba(255,255,255,0.75)');
    },
  },
  rainbow: {
    barrel: ['#ffffff', '#ffffff'], ring: '#ffffff', muzzle: '#ffffff', base: ['#ffffff', '#ffffff'], trim: '#ffe27a', glow: '#ffffff', hub: ['#ffd98a', '#ff66b4'], spec: 0.7, gloss: 50, tint: [0.6, 0.46, 0.84],
    barrelArt: (x, w, len, out) => {
      x.save();
      x.beginPath();
      trace(x, out);
      x.clip();
      const n = 7;
      for (let i = 0; i < n; i++) {
        x.fillStyle = hsl((i / n) * 320, 92, 62);
        x.fillRect(-w * 1.5, -len - 20 + ((len + 40) * i) / n, w * 3, (len + 40) / n + 1);
      }
      x.restore();
    },
    baseArt: (x) => {
      x.translate(0, 62);
      for (let i = 0; i < 7; i++) {
        const r = 150 - i * 18;
        x.fillStyle = hsl((i / 7) * 320, 90, 64);
        x.beginPath();
        x.arc(0, 0, r, 0, TAU);
        x.fill();
      }
      x.translate(0, -62);
      centerHub(x, 34, '#fffbe0', '#ffd0e8');
    },
  },
  robotcrab: {
    barrel: ['#59626e', '#8e99a8'], ring: '#e8442f', muzzle: '#e8442f', base: ['#d94432', '#8e2a26'], trim: '#c2ccd8', glow: '#ff8a6a', spec: 0.78, gloss: 60, tint: [0.56, 0.42, 0.66],
    barrelArt: (x, w, len) => {
      rings(x, w, [-len * 0.3, -len * 0.62], '#e8442f', 7);
      for (const y of [0.16, 0.46, 0.78]) rivets(x, [[-w * 0.64, -len * y], [w * 0.64, -len * y]], 2, '#2c323c');
    },
    shape: [[92, -6], [100, -36], [86, -54], [72, -42], [78, -26], [62, -30], [44, -56], [0, -64], [-44, -56], [-62, -30], [-78, -26], [-72, -42], [-86, -54], [-100, -36], [-92, -6], [-72, 40], [-44, 56], [0, 62], [44, 56], [72, 40]],
    baseArt: (x) => {
      x.fillStyle = '#c2ccd8';
      x.fillRect(-90, 26, 180, 6);
      rivets(x, [[-64, 8], [64, 8], [-40, 44], [40, 44], [-46, -34], [46, -34]], 3.2, '#c2ccd8');
      for (const px of [-28, 28]) {
        circle(x, px, 40, 9.5, '#2c323c');
        circle(x, px, 40, 6.2, radial(x, px - 1.5, 38.5, 0.5, px, 40, 6.2, [[0, '#ffffff'], [0.4, '#7cf4ff'], [1, '#1ea8d8']]));
      }
      centerHub(x, 34, '#aab4c2', '#59626e');
    },
    baseBump: (x) => {
      rivets(x, [[-64, 8], [64, 8], [-40, 44], [40, 44], [-46, -34], [46, -34]], 3.4, 'rgba(255,255,255,0.9)');
      for (const px of [-28, 28]) circle(x, px, 40, 9.5, 'rgba(255,255,255,0.7)');
    },
  },
  golden: {
    barrel: ['#c98310', '#ffc838'], ring: '#fff0a0', muzzle: '#ffe88a', base: ['#f0ae22', '#a0640a'], trim: '#ffe88a', glow: '#ffe88a', hub: ['#ffc838', '#a86a0a'], spec: 0.62, gloss: 30, tint: [0.72, 0.36, 0.22],
    barrelArt: (x, w, len) => {
      rings(x, w, [-len * 0.34, -len * 0.68], '#fff3b0', 6);
      x.strokeStyle = 'rgba(160,96,6,0.5)';
      x.lineWidth = 1.8;
      x.beginPath();
      x.moveTo(0, -len * 0.42);
      x.lineTo(0, -len * 0.6);
      x.stroke();
    },
    baseArt: (x) => {
      // shell-stamped medallion
      x.save();
      x.translate(0, 30);
      radialRibs(x, 18, 8, 30, 'rgba(160,96,6,0.5)', 2.2);
      x.restore();
      x.strokeStyle = '#fff3b0';
      x.lineWidth = 4;
      x.beginPath();
      x.arc(0, 0, 58, 0, TAU);
      x.stroke();
      centerHub(x, 36, '#fff6c4', '#e8a018');
    },
    baseBump: (x) => {
      x.strokeStyle = 'rgba(255,255,255,0.85)';
      x.lineWidth = 4;
      x.beginPath();
      x.arc(0, 0, 58, 0, TAU);
      x.stroke();
    },
  },
};

function barrelOutline(w: number, len: number): P[] {
  const m = w * 1.24;
  return [
    [-w * 1.02, 4, 1], [-w * 0.92, -len * 0.3], [-w * 0.84, -len * 0.72], [-w * 0.92, -len * 0.82], [-m, -len * 0.84], [-m * 1.04, -len * 0.92], [-m, -len, 1], [m, -len, 1], [m * 1.04, -len * 0.92], [m, -len * 0.84], [w * 0.92, -len * 0.82], [w * 0.84, -len * 0.72], [w * 0.92, -len * 0.3], [w * 1.02, 4, 1],
  ];
}

interface Tube {
  x: number;
  w: number;
  len: number;
  splay: number;
}

const LEVELS: Tube[][] = [
  [{ x: 0, w: 22, len: 102, splay: 0 }],
  [{ x: 0, w: 28, len: 122, splay: 0 }],
  [{ x: -23, w: 20, len: 118, splay: -0.05 }, { x: 23, w: 20, len: 118, splay: 0.05 }],
  [{ x: -25, w: 22, len: 126, splay: -0.05 }, { x: 25, w: 22, len: 126, splay: 0.05 }],
  [{ x: -30, w: 19, len: 116, splay: -0.16 }, { x: 30, w: 19, len: 116, splay: 0.16 }, { x: 0, w: 24, len: 142, splay: 0 }],
];

function paintTube(ctxScale: number, skin: Skin, t: Tube): Cnv {
  const s = ctxScale;
  const c = newCanvas(BARREL_W * s, BARREL_H * s);
  const out = barrelOutline(t.w, t.len);
  const x = ctxOf(c);
  x.setTransform(s, 0, 0, s, (BARREL_W / 2) * s, PIVOT_Y * s);
  x.beginPath();
  trace(x, out);
  x.fillStyle = linear(x, -t.w, 0, t.w, 0, [[0, skin.barrel[0]], [0.5, skin.barrel[1]], [1, skin.barrel[0]]]);
  x.fill();
  clipped(x, out, () => {
    skin.barrelArt?.(x, t.w, t.len, out);
    x.fillStyle = skin.ring;
    x.fillRect(-t.w * 1.5, -t.len * 0.86, t.w * 3, t.len * 0.04);
    x.fillStyle = skin.muzzle;
    x.fillRect(-t.w * 1.5, -t.len - 2, t.w * 3, t.len * 0.1);
  });
  let bump: Cnv | null = null;
  const b = newCanvas(c.width, c.height);
  const bx = ctxOf(b);
  bx.fillStyle = 'rgb(128,128,128)';
  bx.fillRect(0, 0, b.width, b.height);
  bx.setTransform(s, 0, 0, s, (BARREL_W / 2) * s, PIVOT_Y * s);
  skin.barrelBump?.(bx, t.w, t.len);
  bx.fillStyle = 'rgba(255,255,255,0.7)';
  bx.fillRect(-t.w * 1.5, -t.len * 0.87, t.w * 3, t.len * 0.05);
  bump = b;
  lit(c, { dome: t.w * s, soften: 1, bump, bumpPx: 1.6 * s, tint: skin.tint, spec: skin.spec, gloss: skin.gloss, sheen: 0.18, rim: 0.6, line: 1.6 * s, lineDark: 0.7, light: [0.1, -0.2, 0.96] });
  x.setTransform(s, 0, 0, s, (BARREL_W / 2) * s, PIVOT_Y * s);
  // the dark bore
  ellipse(x, 0, -t.len + 1, t.w * 0.92, 4.6, 0, linear(x, 0, -t.len - 4, 0, -t.len + 6, [[0, '#0c1a30'], [1, '#26405e']]));
  free(bump);
  return c;
}

function paintTurret(s: number, skin: Skin, r: number): Cnv {
  const c = newCanvas(BARREL_W * s, BARREL_H * s);
  const x = ctxOf(c);
  x.setTransform(s, 0, 0, s, (BARREL_W / 2) * s, PIVOT_Y * s);
  const [hi, lo] = skin.hub ?? skin.barrel;
  circle(x, 0, 0, r, radial(x, -r * 0.3, -r * 0.34, r * 0.1, 0, 0, r, [[0, mix(hi, '#ffffff', 0.3)], [0.55, hi], [1, lo]]));
  x.lineWidth = r * 0.12;
  x.strokeStyle = skin.trim;
  x.beginPath();
  x.arc(0, 0, r * 0.72, 0, TAU);
  x.stroke();
  lit(c, { dome: r * 0.6, soften: 1, tint: skin.tint, spec: skin.spec, gloss: skin.gloss, sheen: 0.2, rim: 0.5, line: 1.7 * s, lineDark: 0.7, light: [0.05, -0.42, 0.9] });
  return c;
}

const HUB = [31, 34, 37, 37, 42];

function bakeBarrel(s: number, skin: Skin, level: number, glow: number): Cnv {
  const tubes = LEVELS[level]!;
  const c = newCanvas(BARREL_W * s, BARREL_H * s);
  const x = ctxOf(c);
  const px = (BARREL_W / 2) * s;
  const py = PIVOT_Y * s;
  const muzzles = tubes.map((t) => ({ x: px + (t.x + Math.sin(t.splay) * t.len) * s, y: py - Math.cos(t.splay) * t.len * s, w: t.w * s }));
  if (glow > 0) {
    for (const m of muzzles) {
      const r = m.w * (glow > 1 ? 2.5 : 1.8) + 10 * s;
      x.fillStyle = radial(x, m.x, m.y, 0, m.x, m.y, r, [[0, alpha(skin.glow, glow > 1 ? 0.95 : 0.7)], [0.4, alpha(skin.glow, glow > 1 ? 0.5 : 0.32)], [1, alpha(skin.glow, 0)]]);
      x.fillRect(m.x - r, m.y - r, r * 2, r * 2);
    }
  }
  for (const t of tubes) {
    const tc = paintTube(s, skin, t);
    x.save();
    x.translate(px + t.x * s, py);
    x.rotate(t.splay);
    x.translate(-px, -py);
    x.drawImage(tc, 0, 0);
    x.restore();
    free(tc);
  }
  const hub = paintTurret(s, skin, HUB[level]!);
  x.drawImage(hub, 0, 0);
  free(hub);
  if (glow > 0) {
    x.save();
    x.globalCompositeOperation = 'lighter';
    for (const m of muzzles) {
      const r = m.w * 1.1;
      x.fillStyle = radial(x, m.x, m.y, 0, m.x, m.y, r, [[0, `rgba(255,255,255,${glow > 1 ? 0.6 : 0.36})`], [1, 'rgba(255,255,255,0)']]);
      x.fillRect(m.x - r, m.y - r, r * 2, r * 2);
    }
    x.restore();
  }
  return c;
}

function bakeBase(s: number, skin: Skin): Cnv {
  const c = newCanvas(CANVAS_W * s, CANVAS_H * s);
  const x = ctxOf(c);
  const shape = skin.shape ?? dome;
  const tf = (q: Ctx): void => q.setTransform(s, 0, 0, s * 0.92, (CANVAS_W / 2) * s, (CANVAS_H / 2) * s);
  tf(x);
  x.beginPath();
  trace(x, shape);
  x.fillStyle = linear(x, 0, -70, 0, 62, [[0, skin.base[0]], [1, skin.base[1]]]);
  x.fill();
  clipped(x, shape, () => skin.baseArt?.(x, shape));
  const b = newCanvas(c.width, c.height);
  const bx = ctxOf(b);
  bx.fillStyle = 'rgb(128,128,128)';
  bx.fillRect(0, 0, b.width, b.height);
  tf(bx);
  skin.baseBump?.(bx);
  lit(c, { dome: 40 * s, soften: 2, bump: b, bumpPx: 2.4 * s, tint: skin.tint, spec: skin.spec, gloss: skin.gloss, sheen: 0.2, rim: 0.6, line: 1.8 * s, lineDark: 0.72, light: [0.05, -0.42, 0.9] });
  free(b);
  return c;
}

export function bakeCannon(skinId: CannonSkinId, ppu: number): CannonBake {
  const skin = SKINS[skinId];
  const s = ppu;
  const glowSteps = [0, 0, 0, 1, 2];
  const barrels = LEVELS.map((_, i) => bakeBarrel(s, skin, i, glowSteps[i]!));
  return { base: bakeBase(s, skin), barrels, barrelPivot: { x: (BARREL_W / 2) * s, y: PIVOT_Y * s }, ppu: s };
}

interface PreviewEntry {
  key: string;
  bake: CannonBake;
}

const previews: PreviewEntry[] = [];

export function drawCannonPreview(ctx: CanvasRenderingContext2D, skin: SkinId, level: number, x: number, y: number, size: number): void {
  const m = ctx.getTransform();
  const density = Math.max(Math.hypot(m.a, m.b), 0.1);
  const px = (size / BASE_W) * density;
  const key = `${skin}:${px.toFixed(2)}`;
  let e = previews.find((p) => p.key === key);
  if (!e) {
    e = { key, bake: bakeCannon(skin, px) };
    previews.push(e);
    if (previews.length > 14) {
      const old = previews.shift()!;
      free(old.bake.base, ...old.bake.barrels);
    }
  }
  const b = e.bake;
  const scale = 1 / density;
  const lv = clamp(Math.round(level), 1, b.barrels.length) - 1;
  const barrel = b.barrels[lv]!;
  ctx.drawImage(b.base, x - (b.base.width * scale) / 2, y - (b.base.height * scale) / 2, b.base.width * scale, b.base.height * scale);
  ctx.drawImage(barrel, x - b.barrelPivot.x * scale, y - b.barrelPivot.y * scale, barrel.width * scale, barrel.height * scale);
}

