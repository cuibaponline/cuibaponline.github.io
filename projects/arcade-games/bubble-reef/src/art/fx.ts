// Effects, digit atlases. Everything is white-ish or lightly coloured so the renderer can tint it.

import type { DigitAtlas, DigitStyle, FxId } from './types';
import {
  TAU,
  circle,
  ctxOf,
  free,
  hsl,
  linear,
  lit,
  makeRng,
  mix,
  newCanvas,
  radial,
  softBlur,
  trace,
  type Cnv,
  type Ctx,
  type P,
} from './paint';

function square(size: number, paint: (x: Ctx, r: number) => void): Cnv {
  const c = newCanvas(size, size);
  const x = ctxOf(c);
  x.translate(size / 2, size / 2);
  paint(x, size / 2);
  return c;
}

function glossBubble(x: Ctx, r: number, wall: number, tint = 1): void {
  x.fillStyle = radial(x, 0, 0, r * 0.2, 0, 0, r, [[0, `rgba(190,235,255,${0.05 * tint})`], [0.7, `rgba(170,230,255,${0.12 * tint})`], [0.93, `rgba(190,240,255,${0.5 * tint})`], [1, 'rgba(255,255,255,0.05)']]);
  x.beginPath();
  x.arc(0, 0, r * 0.985, 0, TAU);
  x.fill();
  x.lineWidth = r * wall;
  x.strokeStyle = 'rgba(255,255,255,0.86)';
  x.beginPath();
  x.arc(0, 0, r * (0.96 - wall / 2), 0, TAU);
  x.stroke();
  // Soft rainbow sheen on the lower rim.
  x.save();
  x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    x.strokeStyle = hsl(180 + i * 34, 100, 72, 0.3);
    x.lineWidth = r * 0.05;
    const a = 0.5 + i * 0.3;
    x.beginPath();
    x.arc(0, 0, r * 0.86, a, a + 0.34);
    x.stroke();
  }
  x.restore();
  x.fillStyle = 'rgba(255,255,255,0.95)';
  x.beginPath();
  x.ellipse(-r * 0.38, -r * 0.42, r * 0.22, r * 0.13, -0.75, 0, TAU);
  x.fill();
  x.fillStyle = 'rgba(255,255,255,0.75)';
  x.beginPath();
  x.arc(-r * 0.09, -r * 0.62, r * 0.05, 0, TAU);
  x.fill();
  x.strokeStyle = 'rgba(255,255,255,0.44)';
  x.lineWidth = r * 0.05;
  x.lineCap = 'round';
  x.beginPath();
  x.arc(0, 0, r * 0.76, 0.3, 1.1);
  x.stroke();
}

function star4(x: Ctx, r: number, waist = 0.14): void {
  x.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const q = i % 2 ? r * waist : r;
    x.lineTo(Math.cos(a) * q, Math.sin(a) * q);
  }
  x.closePath();
}

function shellPath(x: Ctx, r: number): void {
  // Scallop: a fan on a small hinge.
  const pts: P[] = [];
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + ((i + 0) / n) * Math.PI;
    pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.92 + r * 0.1]);
    if (i < n) {
      const m = Math.PI + ((i + 0.5) / n) * Math.PI;
      pts.push([Math.cos(m) * r * 0.9, Math.sin(m) * r * 0.82 + r * 0.1]);
    }
  }
  pts.push([r * 0.46, r * 0.64], [r * 0.3, r * 0.88, 1], [-r * 0.3, r * 0.88, 1], [-r * 0.46, r * 0.64]);
  trace(x, pts);
}

function shellRibs(x: Ctx, r: number, color: string, width: number): void {
  x.strokeStyle = color;
  x.lineWidth = width;
  x.lineCap = 'round';
  x.beginPath();
  for (let i = 1; i < 7; i++) {
    const a = Math.PI + (i / 7) * Math.PI;
    x.moveTo(0, r * 0.68);
    x.lineTo(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.78 + r * 0.1);
  }
  x.stroke();
}

function bakeCoin(size: number): Cnv {
  const c = newCanvas(size, size);
  const x = ctxOf(c);
  const r = size / 2 - 1;
  x.translate(size / 2, size / 2);
  circle(x, 0, 0, r, linear(x, 0, -r, 0, r, [[0, '#ffe680'], [1, '#f4a81c']]));
  circle(x, 0, 0, r * 0.76, linear(x, 0, -r, 0, r, [[0, '#ffcf48'], [1, '#ffe78a']]));
  x.save();
  x.scale(0.56, 0.56);
  x.translate(0, -r * 0.12);
  x.beginPath();
  shellPath(x, r);
  x.fillStyle = '#ffb526';
  x.fill();
  shellRibs(x, r, 'rgba(176,96,8,0.75)', r * 0.08);
  x.restore();
  const b = newCanvas(size, size);
  const bx = ctxOf(b, true);
  bx.fillStyle = 'rgb(128,128,128)';
  bx.fillRect(0, 0, size, size);
  bx.translate(size / 2, size / 2);
  bx.strokeStyle = 'rgba(40,40,40,0.8)';
  bx.lineWidth = r * 0.07;
  bx.beginPath();
  bx.arc(0, 0, r * 0.76, 0, TAU);
  bx.stroke();
  bx.scale(0.56, 0.56);
  bx.translate(0, -r * 0.12);
  bx.beginPath();
  shellPath(bx, r);
  bx.fillStyle = 'rgba(255,255,255,0.8)';
  bx.fill();
  shellRibs(bx, r, 'rgba(0,0,0,0.6)', r * 0.08);
  lit(c, { dome: r * 0.42, soften: 1, bump: b, bumpPx: r * 0.07, tint: [0.86, 0.46, 0.26], spec: 0.75, gloss: 26, sheen: 0.22, rim: 0.5, rimColor: [1, 0.95, 0.7], line: Math.max(1, r * 0.06), lineDark: 0.62 });
  free(b);
  return c;
}

function bakeShellBadge(size: number): Cnv {
  const c = newCanvas(size, size);
  const x = ctxOf(c);
  const r = size / 2 - 3;
  x.translate(size / 2, size / 2 + r * 0.04);
  x.beginPath();
  shellPath(x, r);
  x.fillStyle = linear(x, 0, -r, 0, r, [[0, '#a8d8f0'], [1, '#5a8cc0']]);
  x.fill();
  shellRibs(x, r, 'rgba(30,60,110,0.6)', r * 0.05);
  const b = newCanvas(size, size);
  const bx = ctxOf(b, true);
  bx.fillStyle = 'rgb(128,128,128)';
  bx.fillRect(0, 0, size, size);
  bx.translate(size / 2, size / 2 + r * 0.04);
  shellRibs(bx, r, 'rgba(0,0,0,0.75)', r * 0.07);
  lit(c, { dome: r * 0.5, soften: 1, bump: b, bumpPx: r * 0.05, tint: [0.42, 0.5, 0.9], spec: 0.7, gloss: 34, sheen: 0.2, rim: 0.5, line: Math.max(1.4, r * 0.06), lineDark: 0.72 });
  free(b);
  return c;
}

function bakeNet(size: number): Cnv {
  return square(size, (x, r) => {
    const R = r * 0.92;
    // Diamond mesh bulged like a fisheye, so it reads as a net thrown over the fish.
    const bulge = (u: number, v: number): readonly [number, number] => {
      const d = Math.hypot(u, v);
      const q = d > 0 ? (Math.sin(Math.min(d, 1) * 1.45) / Math.sin(1.45) / d) * R : R;
      return [u * q, v * q];
    };
    const n = 6;
    const mesh = (): void => {
      x.beginPath();
      for (let i = -n; i <= n; i++) {
        const c = i / n;
        for (let pass = 0; pass < 2; pass++) {
          let pen = false;
          for (let k = 0; k <= 40; k++) {
            const t = -1 + k / 20;
            const a = pass ? (c + t) * Math.SQRT1_2 : (c - t) * Math.SQRT1_2;
            const b = pass ? (t - c) * Math.SQRT1_2 : (c + t) * Math.SQRT1_2;
            if (Math.hypot(a, b) > 1) {
              pen = false;
              continue;
            }
            const [px, py] = bulge(a, b);
            if (pen) x.lineTo(px, py);
            else x.moveTo(px, py);
            pen = true;
          }
        }
      }
    };
    circle(x, 0, 0, R, radial(x, 0, 0, r * 0.2, 0, 0, R, [[0, 'rgba(150,235,255,0.06)'], [0.8, 'rgba(150,235,255,0.15)'], [1, 'rgba(150,235,255,0.26)']]));
    x.lineCap = 'round';
    x.lineJoin = 'round';
    mesh();
    x.strokeStyle = 'rgba(120,225,255,0.36)';
    x.lineWidth = size * 0.024;
    x.stroke();
    mesh();
    x.strokeStyle = 'rgba(248,255,255,0.97)';
    x.lineWidth = size * 0.0095;
    x.stroke();
    for (let i = -n; i <= n; i++) {
      for (let j = -n; j <= n; j++) {
        const a = ((i + j) / n) * Math.SQRT1_2;
        const b = ((j - i) / n) * Math.SQRT1_2;
        if (Math.hypot(a, b) >= 0.97) continue;
        const [px, py] = bulge(a, b);
        circle(x, px, py, size * 0.0115, '#ffffff');
      }
    }
    // Rope hoop: a soft glow, the rope, then twist marks.
    const hoop = (w: number, c: string, dash?: number[]): void => {
      x.save();
      x.lineWidth = w;
      x.strokeStyle = c;
      if (dash) x.setLineDash(dash);
      x.beginPath();
      x.arc(0, 0, R, 0, TAU);
      x.stroke();
      x.restore();
    };
    hoop(size * 0.05, 'rgba(120,225,255,0.3)');
    hoop(size * 0.028, '#ffffff');
    hoop(size * 0.028, 'rgba(90,190,235,0.75)', [size * 0.012, size * 0.03]);
  });
}

function iconBubble(size: number, paint: (x: Ctx, r: number) => void): Cnv {
  return square(size, (x, r) => {
    circle(x, 0, 0, r * 0.97, radial(x, -r * 0.2, -r * 0.3, r * 0.1, 0, 0, r, [[0, 'rgba(240,252,255,0.96)'], [0.72, 'rgba(160,226,255,0.93)'], [1, 'rgba(70,170,230,0.95)']]));
    x.save();
    x.scale(0.72, 0.72);
    paint(x, r);
    x.restore();
    x.lineWidth = r * 0.07;
    x.strokeStyle = 'rgba(255,255,255,0.95)';
    x.beginPath();
    x.arc(0, 0, r * 0.93, 0, TAU);
    x.stroke();
    x.fillStyle = 'rgba(255,255,255,0.86)';
    x.beginPath();
    x.ellipse(-r * 0.42, -r * 0.5, r * 0.2, r * 0.1, -0.75, 0, TAU);
    x.fill();
  });
}

function outlined(x: Ctx, fill: string | CanvasGradient, ink: string, w: number): void {
  x.lineJoin = 'round';
  x.lineWidth = w;
  x.strokeStyle = ink;
  x.stroke();
  x.fillStyle = fill;
  x.fill();
}

function iconBurst(x: Ctx, r: number): void {
  x.beginPath();
  const n = 9;
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * TAU - Math.PI / 2;
    const q = i % 2 ? r * 0.42 : r * 0.9;
    x.lineTo(Math.cos(a) * q, Math.sin(a) * q);
  }
  x.closePath();
  outlined(x, radial(x, 0, 0, r * 0.1, 0, 0, r * 0.9, [[0, '#fff27a'], [0.5, '#ffa61e'], [1, '#ff4f6a']]), '#a8204a', r * 0.11);
}

function iconSnow(x: Ctx, r: number): void {
  const draw = (w: number, color: string): void => {
    x.strokeStyle = color;
    x.lineWidth = w;
    x.lineCap = 'round';
    x.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const c = Math.cos(a);
      const s = Math.sin(a);
      x.moveTo(0, 0);
      x.lineTo(c * r * 0.84, s * r * 0.84);
      for (const q of [0.56]) {
        const bx = c * r * 0.84 * q;
        const by = s * r * 0.84 * q;
        x.moveTo(bx, by);
        x.lineTo(bx + Math.cos(a + 0.85) * r * 0.27, by + Math.sin(a + 0.85) * r * 0.27);
        x.moveTo(bx, by);
        x.lineTo(bx + Math.cos(a - 0.85) * r * 0.27, by + Math.sin(a - 0.85) * r * 0.27);
      }
    }
    x.stroke();
  };
  draw(r * 0.2, '#1c6fc0');
  draw(r * 0.095, '#ffffff');
}

function iconSpark(x: Ctx, r: number): void {
  const pts: Array<[number, number]> = [[0.14, -0.92], [-0.5, 0.1], [-0.06, 0.1], [-0.2, 0.92], [0.56, -0.2], [0.08, -0.2], [0.38, -0.92]];
  x.beginPath();
  pts.forEach((p, i) => (i ? x.lineTo(p[0] * r, p[1] * r) : x.moveTo(p[0] * r, p[1] * r)));
  x.closePath();
  outlined(x, linear(x, 0, -r, 0, r, [[0, '#fff27a'], [1, '#ffb01e']]), '#a85a08', r * 0.11);
}

function iconRainbow(x: Ctx, r: number): void {
  const cols = ['#ff5a5a', '#ffa23a', '#ffe14a', '#5fd86a', '#4aa8ff', '#a06aff'];
  x.lineCap = 'round';
  cols.forEach((c, i) => {
    x.strokeStyle = c;
    x.lineWidth = r * 0.145;
    x.beginPath();
    x.arc(0, r * 0.4, r * (0.92 - i * 0.135), Math.PI + 0.05, TAU - 0.05);
    x.stroke();
  });
}

function iconChest(x: Ctx, r: number): void {
  const w = r * 0.86;
  x.beginPath();
  x.roundRect(-w, -r * 0.12, w * 2, r * 0.78, r * 0.08);
  outlined(x, linear(x, 0, -r * 0.1, 0, r * 0.66, [[0, '#c4762f'], [1, '#8a4c1c']]), '#4e2a0e', r * 0.09);
  x.beginPath();
  x.moveTo(-w, -r * 0.12);
  x.lineTo(-w, -r * 0.34);
  x.quadraticCurveTo(-w, -r * 0.74, -w * 0.58, -r * 0.74);
  x.lineTo(w * 0.58, -r * 0.74);
  x.quadraticCurveTo(w, -r * 0.74, w, -r * 0.34);
  x.lineTo(w, -r * 0.12);
  x.closePath();
  outlined(x, linear(x, 0, -r * 0.74, 0, -r * 0.1, [[0, '#e0924a'], [1, '#b5682a']]), '#4e2a0e', r * 0.09);
  x.fillStyle = '#ffd24a';
  x.fillRect(-w * 0.72, -r * 0.74, w * 0.2, r * 1.4);
  x.fillRect(w * 0.52, -r * 0.74, w * 0.2, r * 1.4);
  circle(x, 0, -r * 0.12, r * 0.2, '#ffd24a');
  x.fillStyle = '#6a3a14';
  x.beginPath();
  x.ellipse(0, -r * 0.1, r * 0.055, r * 0.1, 0, 0, TAU);
  x.fill();
}

function iconBeam(x: Ctx, r: number): void {
  x.save();
  x.rotate(-0.72);
  x.fillStyle = linear(x, 0, -r * 0.42, 0, r * 0.42, [[0, 'rgba(255,60,190,0)'], [0.3, '#ff4fc4'], [0.5, '#ffffff'], [0.7, '#4fe4ff'], [1, 'rgba(60,200,255,0)']]);
  x.beginPath();
  x.roundRect(-r * 1.02, -r * 0.42, r * 2.04, r * 0.84, r * 0.42);
  x.fill();
  x.restore();
  x.save();
  x.translate(r * 0.46, -r * 0.5);
  star4(x, r * 0.5);
  x.fillStyle = '#ffffff';
  x.fill();
  x.restore();
}

function bakeFrost(size: number): Cnv {
  const c = newCanvas(size, size);
  const x = ctxOf(c);
  const r = makeRng(808);
  // dendrites growing in from all four edges
  const grow = (px: number, py: number, ang: number, len: number, w: number, depth: number): void => {
    let cx = px;
    let cy = py;
    const steps = 5;
    const l = len / steps;
    x.lineWidth = w;
    x.beginPath();
    x.moveTo(cx, cy);
    const branches: Array<[number, number, number]> = [];
    for (let i = 0; i < steps; i++) {
      cx += Math.cos(ang) * l;
      cy += Math.sin(ang) * l;
      x.lineTo(cx, cy);
      if (depth > 0) {
        branches.push([cx, cy, ang + 0.9]);
        branches.push([cx, cy, ang - 0.9]);
      }
    }
    x.stroke();
    if (depth > 0) for (const [bx, by, a] of branches) grow(bx, by, a, len * (0.34 + r() * 0.16), w * 0.6, depth - 1);
  };
  x.strokeStyle = 'rgba(235,250,255,0.9)';
  x.lineCap = 'round';
  const n = 34;
  for (let i = 0; i < n; i++) {
    const t = (i + r() * 0.7) / n;
    const side = i % 4;
    const a = side === 0 ? 1.57 : side === 1 ? -1.57 : side === 2 ? 0 : 3.14;
    const px = side < 2 ? t * size : side === 2 ? 0 : size;
    const py = side === 0 ? 0 : side === 1 ? size : t * size;
    grow(px, py, a + (r() - 0.5) * 0.6, size * (0.11 + r() * 0.07), size * 0.006, 2);
  }
  // pale haze filling the rim
  const fog = newCanvas(size, size);
  const f = ctxOf(fog);
  f.fillStyle = radial(f, size / 2, size / 2, size * 0.34, size / 2, size / 2, size * 0.74, [[0, 'rgba(210,240,255,0)'], [0.5, 'rgba(210,240,255,0.32)'], [1, 'rgba(235,250,255,0.9)']]);
  f.fillRect(0, 0, size, size);
  x.globalCompositeOperation = 'destination-over';
  x.drawImage(fog, 0, 0);
  free(fog);
  x.globalCompositeOperation = 'destination-out';
  x.fillStyle = radial(x, size / 2, size / 2, size * 0.2, size / 2, size / 2, size * 0.42, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]);
  x.fillRect(0, 0, size, size);
  return c;
}

export function bakeFx(ppu: number): Record<FxId, Cnv> {
  const p = (px: number): number => Math.ceil(px * ppu);
  const fx = {} as Record<FxId, Cnv>;
  fx.bubble = square(p(64), (x, r) => glossBubble(x, r, 0.06));
  fx.net = bakeNet(256);
  fx.coin = bakeCoin(p(48));
  fx.sparkle = square(p(32), (x, r) => {
    circle(x, 0, 0, r * 0.9, radial(x, 0, 0, 0, 0, 0, r * 0.9, [[0, 'rgba(255,255,255,0.8)'], [0.3, 'rgba(255,255,255,0.2)'], [1, 'rgba(255,255,255,0)']]));
    star4(x, r * 0.98, 0.1);
    x.fillStyle = '#ffffff';
    x.fill();
  });
  fx.softDot = square(32, (x, r) => circle(x, 0, 0, r, radial(x, 0, 0, 0, 0, 0, r, [[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']])));
  fx.trail = square(p(16), (x, r) => {
    circle(x, 0, 0, r * 0.9, radial(x, 0, 0, r * 0.2, 0, 0, r * 0.9, [[0, 'rgba(220,245,255,0.18)'], [0.75, 'rgba(220,245,255,0.34)'], [1, 'rgba(255,255,255,0)']]));
    x.lineWidth = Math.max(1, r * 0.16);
    x.strokeStyle = 'rgba(255,255,255,0.86)';
    x.beginPath();
    x.arc(0, 0, r * 0.74, 0, TAU);
    x.stroke();
    circle(x, -r * 0.28, -r * 0.3, r * 0.17, '#ffffff');
  });
  fx.lockRing = square(256, (x, r) => {
    const ring = (w: number, color: string): void => {
      x.lineWidth = w;
      x.strokeStyle = color;
      x.beginPath();
      x.arc(0, 0, r * 0.8, 0, TAU);
      x.stroke();
    };
    ring(r * 0.16, 'rgba(255,200,60,0.2)');
    ring(r * 0.09, 'rgba(255,190,50,0.6)');
    ring(r * 0.05, '#ffe27a');
    ring(r * 0.016, '#fffbe0');
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      x.save();
      x.rotate(a);
      x.translate(r * 0.8, 0);
      star4(x, r * 0.17, 0.22);
      x.fillStyle = '#fff3b0';
      x.fill();
      x.lineWidth = r * 0.012;
      x.strokeStyle = '#e8961c';
      x.stroke();
      x.restore();
    }
  });
  fx.hitRing = square(128, (x, r) => {
    x.lineWidth = r * 0.22;
    x.strokeStyle = 'rgba(255,255,255,0.16)';
    x.beginPath();
    x.arc(0, 0, r * 0.82, 0, TAU);
    x.stroke();
    x.lineWidth = r * 0.06;
    x.strokeStyle = '#ffffff';
    x.beginPath();
    x.arc(0, 0, r * 0.82, 0, TAU);
    x.stroke();
  });
  fx.catchBubble = square(256, (x, r) => glossBubble(x, r, 0.022, 0.8));
  fx.beamCore = (() => {
    const c = newCanvas(64, 64);
    const x = ctxOf(c);
    const g = linear(x, 0, 0, 0, 64, [[0, 'rgba(255,255,255,0)'], [0.24, 'rgba(190,245,255,0.2)'], [0.38, 'rgba(235,252,255,0.95)'], [0.5, '#ffffff'], [0.62, 'rgba(235,252,255,0.95)'], [0.76, 'rgba(190,245,255,0.2)'], [1, 'rgba(255,255,255,0)']]);
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return c;
  })();
  fx.beamGlow = (() => {
    const c = newCanvas(64, 64);
    const x = ctxOf(c);
    x.fillStyle = linear(x, 0, 0, 0, 64, [[0, 'rgba(90,200,255,0)'], [0.26, 'rgba(100,210,255,0.22)'], [0.5, 'rgba(150,235,255,0.72)'], [0.74, 'rgba(100,210,255,0.22)'], [1, 'rgba(90,200,255,0)']]);
    x.fillRect(0, 0, 64, 64);
    // energy ripple, whole cycles across the tile so it repeats cleanly
    x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 64; i++) {
      const a = 0.08 + 0.08 * Math.sin((i / 64) * TAU * 2);
      x.fillStyle = `rgba(255,255,255,${a})`;
      x.fillRect(i, 18, 1, 28);
    }
    return c;
  })();
  fx.shellBadge = bakeShellBadge(p(64));
  fx.aura = (() => {
    const c = square(256, (x, r) => {
      circle(x, 0, 0, r, radial(x, 0, 0, r * 0.3, 0, 0, r, [[0, 'rgba(255,240,170,0.24)'], [0.68, 'rgba(255,225,140,0.15)'], [1, 'rgba(255,220,130,0)']]));
      const q = makeRng(99);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + q() * 0.3;
        const d = r * (0.66 + q() * 0.24);
        x.save();
        x.translate(Math.cos(a) * d, Math.sin(a) * d);
        star4(x, r * (0.05 + q() * 0.07), 0.16);
        x.fillStyle = 'rgba(255,252,220,0.95)';
        x.fill();
        x.restore();
      }
    });
    return c;
  })();
  fx.popBubble = square(p(160), (x, r) => {
    glossBubble(x, r, 0.05, 1.4);
    circle(x, 0, 0, r * 0.94, radial(x, r * 0.1, r * 0.2, r * 0.1, 0, 0, r * 0.94, [[0, 'rgba(255,220,250,0.1)'], [1, 'rgba(255,160,230,0.22)']]));
    x.save();
    x.translate(r * 0.04, r * 0.08);
    star4(x, r * 0.32, 0.34);
    x.fillStyle = 'rgba(255,250,200,0.9)';
    x.fill();
    x.restore();
  });
  fx.iconBurst = iconBubble(p(96), iconBurst);
  fx.iconSnow = iconBubble(p(96), iconSnow);
  fx.iconSpark = iconBubble(p(96), iconSpark);
  fx.iconRainbow = iconBubble(p(96), iconRainbow);
  fx.iconChest = iconBubble(p(96), iconChest);
  fx.iconBeam = iconBubble(p(96), iconBeam);
  fx.frost = bakeFrost(512);
  fx.vignette = (() => {
    const c = newCanvas(512, 512);
    const x = ctxOf(c);
    x.fillStyle = radial(x, 256, 256, 150, 256, 256, 362, [[0, 'rgba(0,14,34,0)'], [0.6, 'rgba(0,14,34,0.14)'], [1, 'rgba(0,14,34,0.62)']]);
    x.fillRect(0, 0, 512, 512);
    return c;
  })();
  fx.lightRay = (() => {
    const c = newCanvas(128, 512);
    const x = ctxOf(c);
    const g = x.createLinearGradient(0, 0, 128, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 512);
    softBlur(c, 3);
    x.globalCompositeOperation = 'destination-out';
    x.fillStyle = linear(x, 0, 0, 0, 512, [[0, 'rgba(0,0,0,0.05)'], [0.5, 'rgba(0,0,0,0.42)'], [1, 'rgba(0,0,0,1)']]);
    x.fillRect(0, 0, 128, 512);
    return c;
  })();
  return fx;
}

// ---------------------------------------------------------------- digits

type Glyph = (x: Ctx) => void;

const GLYPHS: Record<string, { paint: Glyph; adv: number }> = {
  '0': { adv: 66, paint: (x) => { x.moveTo(30 + 19, 50); x.ellipse(30, 50, 19, 39, 0, 0, TAU); } },
  '1': { adv: 48, paint: (x) => { x.moveTo(9, 27); x.lineTo(25, 12); x.lineTo(25, 89); } },
  '2': { adv: 64, paint: (x) => { x.moveTo(10, 31); x.bezierCurveTo(10, 2, 50, 4, 49, 31); x.bezierCurveTo(48, 50, 14, 68, 10, 89); x.lineTo(50, 89); } },
  '3': { adv: 62, paint: (x) => { x.moveTo(11, 21); x.bezierCurveTo(19, 4, 49, 6, 48, 28); x.bezierCurveTo(47, 42, 34, 46, 25, 47); x.bezierCurveTo(36, 47, 50, 52, 49, 69); x.bezierCurveTo(48, 95, 17, 96, 9, 78); } },
  '4': { adv: 68, paint: (x) => { x.moveTo(41, 89); x.lineTo(41, 12); x.lineTo(8, 65); x.lineTo(54, 65); } },
  '5': { adv: 62, paint: (x) => { x.moveTo(46, 12); x.lineTo(16, 12); x.lineTo(13, 45); x.bezierCurveTo(24, 37, 50, 39, 50, 63); x.bezierCurveTo(50, 90, 19, 95, 9, 78); } },
  '6': { adv: 64, paint: (x) => { x.moveTo(43, 12); x.bezierCurveTo(24, 22, 10, 42, 10, 63); x.bezierCurveTo(10, 83, 22, 90, 31, 90); x.bezierCurveTo(44, 90, 51, 78, 51, 65); x.bezierCurveTo(51, 50, 41, 41, 30, 41); x.bezierCurveTo(20, 41, 12, 48, 10, 60); } },
  '7': { adv: 60, paint: (x) => { x.moveTo(9, 12); x.lineTo(49, 12); x.lineTo(22, 89); } },
  '8': { adv: 66, paint: (x) => { x.moveTo(47, 29); x.ellipse(30, 29, 17, 18, 0, 0, TAU); x.moveTo(51, 69); x.ellipse(30, 69, 21, 21, 0, 0, TAU); } },
  '9': { adv: 64, paint: (x) => { x.moveTo(17, 88); x.bezierCurveTo(36, 78, 50, 58, 50, 37); x.bezierCurveTo(50, 17, 38, 10, 29, 10); x.bezierCurveTo(16, 10, 9, 22, 9, 35); x.bezierCurveTo(9, 50, 19, 59, 30, 59); x.bezierCurveTo(40, 59, 48, 52, 50, 40); } },
  '+': { adv: 66, paint: (x) => { x.moveTo(30, 29); x.lineTo(30, 75); x.moveTo(8, 52); x.lineTo(52, 52); } },
};

const ORDER = '0123456789+';

const DIGIT_STYLES: Record<DigitStyle, { top: string; bottom: string; ink: string }> = {
  white: { top: '#ffffff', bottom: '#cfe8fa', ink: '#123a66' },
  yellow: { top: '#ffec70', bottom: '#ffb81e', ink: '#7a3e00' },
  orange: { top: '#ffc46a', bottom: '#ff6a1e', ink: '#6e1a00' },
  rainbow: { top: '#ffffff', bottom: '#ffffff', ink: '#3a1a78' },
};

export function bakeDigits(style: DigitStyle, heightPx: number): DigitAtlas {
  const pad = 0.1;
  const k = heightPx / (100 * (1 + pad * 2));
  const cellWidth = Math.ceil(84 * k);
  const cellHeight = Math.ceil(heightPx);
  const canvas = newCanvas(cellWidth * ORDER.length, cellHeight);
  const x = ctxOf(canvas);
  const st = DIGIT_STYLES[style];
  const advance: number[] = [];
  for (let i = 0; i < ORDER.length; i++) {
    const ch = ORDER[i]!;
    const g = GLYPHS[ch]!;
    advance.push(Math.ceil(g.adv * k));
    const cell = newCanvas(cellWidth, cellHeight);
    const c = ctxOf(cell);
    c.setTransform(k, 0, 0, k, ((84 - 60) / 2) * k, 10 * k);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    // A dropped copy of the outline gives the numeral a chunky lower lip.
    c.save();
    c.translate(0, 4);
    c.beginPath();
    g.paint(c);
    c.strokeStyle = st.ink;
    c.lineWidth = 34;
    c.stroke();
    c.restore();
    c.beginPath();
    g.paint(c);
    c.strokeStyle = st.ink;
    c.lineWidth = 34;
    c.stroke();
    let fill: CanvasGradient = linear(c, 0, 4, 0, 96, [[0, mix(st.top, '#ffffff', 0.3)], [0.4, st.top], [1, st.bottom]]);
    if (style === 'rainbow') {
      const hue = (i / ORDER.length) * 300;
      fill = linear(c, 0, 4, 0, 96, [[0, hsl(hue, 100, 84)], [0.4, hsl(hue + 30, 100, 64)], [1, hsl(hue + 100, 100, 56)]]);
    }
    c.beginPath();
    g.paint(c);
    c.strokeStyle = fill;
    c.lineWidth = 20;
    c.stroke();
    x.drawImage(cell, i * cellWidth, 0);
    free(cell);
  }
  return { canvas, cellWidth, cellHeight, advance };
}

