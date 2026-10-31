// Dev contact sheet for src/art. Serve with `npx vite --port 5191`, open /tools/art-sheet.html.
// Query: only=creatures|shadows|dragon|oceans|caustics|cannons|fx|digits|otto|composite|timing|loops, ids=F01,F02, ppu=1.25,
// zoom=2, hit=1, frames=1 (first frame only), bg=#hex, ocean=coral.

import * as art from '../src/art/index';
import type { DigitStyle, FxId, OceanId, OttoPose, Sheet, SkinId, SpriteId } from '../src/art/types';
import fishCfg from '../config/fish.json';
import bossCfg from '../config/bosses.json';
import specialCfg from '../config/specials.json';

const q = new URLSearchParams(location.search);
const only = q.get('only');
const ppu = Number(q.get('ppu') ?? 1.25);
const zoom = Number(q.get('zoom') ?? 1);
const showHit = q.get('hit') === '1';
const firstOnly = q.get('frames') === '1';
const grid = q.get('grid') === '1';
const out = document.getElementById('out')!;
const logEl = document.getElementById('log')!;
const lines: string[] = [];

function log(s: string): void {
  lines.push(s);
  logEl.textContent = lines.join('\n');
  console.log(s);
}

function section(title: string): HTMLElement {
  const h = document.createElement('h2');
  h.textContent = title;
  out.append(h);
  const row = document.createElement('div');
  row.className = 'row';
  out.append(row);
  return row;
}

function cell(row: HTMLElement, c: HTMLCanvasElement, label: string): void {
  const d = document.createElement('div');
  d.className = 'cell';
  d.append(c);
  const s = document.createElement('span');
  s.textContent = label;
  d.append(s);
  row.append(d);
}

const ALL: SpriteId[] = ['F01', 'F02', 'F03', 'F04', 'F05', 'F05_puffed', 'F06', 'F07', 'F08', 'F09', 'F10', 'F11', 'F12', 'B01', 'B02', 'B02_segment', 'B02_tail', 'S01', 'S02', 'S03', 'S04', 'S05', 'S06'];
const idList = (q.get('ids')?.split(',') as SpriteId[] | undefined) ?? ALL;

const hitTable = new Map<string, number[][]>();
for (const c of [...fishCfg, ...bossCfg, ...specialCfg]) hitTable.set(c.id, c.hitCircles);

function frameCanvas(sheet: Sheet, i: number, id: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = sheet.frameWidth * zoom;
  c.height = sheet.frameHeight * zoom;
  const x = c.getContext('2d')!;
  const col = i % sheet.columns;
  const row = Math.floor(i / sheet.columns);
  x.imageSmoothingEnabled = zoom < 2;
  x.drawImage(sheet.canvas, col * sheet.frameWidth, row * sheet.frameHeight, sheet.frameWidth, sheet.frameHeight, 0, 0, c.width, c.height);
  if (showHit) {
    const hits = hitTable.get(id) ?? [];
    x.strokeStyle = '#ffff00';
    x.lineWidth = 1.5;
    x.fillStyle = 'rgba(255,255,0,0.12)';
    for (const h of hits) {
      x.beginPath();
      x.arc((sheet.originX + h[0]! * sheet.ppu) * zoom, (sheet.originY + h[1]! * sheet.ppu) * zoom, h[2]! * sheet.ppu * zoom, 0, Math.PI * 2);
      x.fill();
      x.stroke();
    }
    x.fillStyle = '#ff2';
    x.fillRect(sheet.originX * zoom - 2, sheet.originY * zoom - 2, 4, 4);
  }
  return c;
}

function creatures(): void {
  let gridRow: HTMLElement | undefined;
  let total = 0;
  let mem = 0;
  const rows: string[] = [];
  for (const id of idList) {
    const t0 = performance.now();
    const sheet = art.bakeSprite(id, ppu);
    const dt = performance.now() - t0;
    total += dt;
    const bytes = sheet.canvas.width * sheet.canvas.height * 4;
    mem += bytes;
    rows.push(`${id.padEnd(12)} ${dt.toFixed(1).padStart(7)} ms  ${sheet.canvas.width}x${sheet.canvas.height} f${sheet.frameWidth}x${sheet.frameHeight}x${sheet.frames} ${(bytes / 1048576).toFixed(2)} MB`);
    const row = grid ? (gridRow ??= section('Creatures')) : section(id);
    const n = firstOnly ? 1 : sheet.frames;
    for (let i = 0; i < n; i++) cell(row, frameCanvas(sheet, i, id), grid ? id : String(i));
  }
  log(rows.join('\n'));
  log(`TOTAL ${total.toFixed(1)} ms, ${(mem / 1048576).toFixed(2)} MB`);
}

/** Mimics the renderer: tail first, then segments, then the head, along an S curve at the configured 66 u spacing. */
function dragonChain(): void {
  const row = section('Coral Dragon chain (66 u spacing, as the game will draw it)');
  const c = document.createElement('canvas');
  c.width = 1500;
  c.height = 560;
  const x = c.getContext('2d')!;
  x.fillStyle = '#17557a';
  x.fillRect(0, 0, c.width, c.height);
  const phase = Number(q.get('phase') ?? 0);
  const head = art.bakeSprite('B02', ppu);
  const seg = art.bakeSprite('B02_segment', ppu);
  const tail = art.bakeSprite('B02_tail', ppu);
  const path = (d: number): [number, number] => [1160 - d * 0.98, 280 + Math.sin(d / 130 + phase) * 90];
  const put = (s: Sheet, frame: number, d: number): void => {
    const [px, py] = path(d);
    const [qx, qy] = path(d - 4);
    const a = Math.atan2(qy - py, qx - px);
    const col = frame % s.columns;
    const r = Math.floor(frame / s.columns);
    x.save();
    x.translate(px, py);
    x.rotate(a);
    x.drawImage(s.canvas, col * s.frameWidth, r * s.frameHeight, s.frameWidth, s.frameHeight, -s.originX, -s.originY, s.frameWidth, s.frameHeight);
    x.restore();
  };
  put(tail, 0, 66 * 8 * ppu);
  for (let i = 7; i >= 1; i--) put(seg, i % seg.frames, 66 * i * ppu);
  put(head, 0, 0);
  cell(row, c, 'tail -> segments -> head');
}

function oceans(): void {
  const ids = (q.get('ocean')?.split(',') ?? ['coral', 'kelp', 'ship', 'glow', 'arctic']) as OceanId[];
  const scale = Number(q.get('scale') ?? 0.4);
  for (const id of ids) {
    const t0 = performance.now();
    const o = art.bakeOcean(id, 2100, 1400, 1);
    const dt = performance.now() - t0;
    log(`ocean ${id}: ${dt.toFixed(0)} ms ${o.seabed.width}x${o.seabed.height}`);
    const row = section(`${id}: seabed + midground, then seabed alone`);
    const c = document.createElement('canvas');
    c.width = o.seabed.width * scale;
    c.height = o.seabed.height * scale;
    const x = c.getContext('2d')!;
    x.imageSmoothingQuality = 'high';
    x.drawImage(o.seabed, 0, 0, c.width, c.height);
    x.drawImage(o.midground, 0, 0, c.width, c.height);
    cell(row, c, 'full');
    if (q.get('bedonly') === '1') {
      const d = document.createElement('canvas');
      d.width = c.width;
      d.height = c.height;
      d.getContext('2d')!.drawImage(o.seabed, 0, 0, c.width, c.height);
      cell(row, d, 'seabed');
    }
  }
}

function caustics(): void {
  const row = section('Caustics tile, 2x2 to prove seamless, then min(a, b) of two scrolled copies');
  const t0 = performance.now();
  const n = art.bakeCausticsTile(512);
  log(`caustics ${n.width}x${n.height} ${(performance.now() - t0).toFixed(0)} ms`);
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 1024;
  const x = c.getContext('2d')!;
  for (let i = 0; i < 4; i++) x.drawImage(n, (i % 2) * n.width, (i >> 1) * n.height);
  cell(row, c, '2x2');
  const m = document.createElement('canvas');
  m.width = 1024;
  m.height = 1024;
  const y = m.getContext('2d')!;
  y.fillStyle = '#fff';
  y.fillRect(0, 0, 1024, 1024);
  y.globalCompositeOperation = 'darken';
  y.fillStyle = y.createPattern(n, 'repeat')!;
  y.save();
  y.translate(37, 91);
  y.fillRect(-100, -100, 1300, 1300);
  y.restore();
  y.save();
  y.translate(211, 301);
  y.rotate(0.3);
  y.scale(1.2, 1.2);
  y.fillRect(-500, -500, 2000, 2000);
  y.restore();
  cell(row, m, 'min');
}

function blank(w: number, h: number, bg?: string): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d')!;
  if (bg) {
    x.fillStyle = bg;
    x.fillRect(0, 0, w, h);
  }
  return [c, x];
}

const SKINS: SkinId[] = ['classic', 'seashell', 'coral', 'submarine', 'rainbow', 'robotcrab', 'golden'];

function cannons(): void {
  const t0 = performance.now();
  const z = Number(q.get('zoom') ?? 0.62);
  for (const skin of SKINS) {
    const row = section(skin);
    const b = art.bakeCannon(skin, ppu);
    for (let lv = 0; lv < 5; lv++) {
      const w = 250 * ppu * z;
      const h = 280 * ppu * z;
      const [c, x] = blank(w, h, '#1b6583');
      x.save();
      x.scale(z, z);
      x.translate(125 * ppu, 200 * ppu);
      const bar = b.barrels[lv]!;
      x.drawImage(b.base, -b.base.width / 2, -b.base.height / 2);
      x.drawImage(bar, -b.barrelPivot.x, -b.barrelPivot.y);
      x.restore();
      cell(row, c, `L${lv + 1}`);
    }
  }
  log(`7 cannon skins ${(performance.now() - t0).toFixed(0)} ms`);
}

function fxSheet(): void {
  const t0 = performance.now();
  const fx = art.bakeFx(ppu);
  log(`fx ${(performance.now() - t0).toFixed(0)} ms`);
  const row = section('FX on sea blue');
  const row2 = section('FX on dark');
  for (const id of Object.keys(fx) as FxId[]) {
    const f = fx[id];
    const scale = id === 'frost' || id === 'vignette' ? 0.5 : id === 'lightRay' ? 0.5 : 1;
    for (const [r, bg] of [[row, '#1b6583'], [row2, '#0b1034']] as const) {
      const [c, x] = blank(Math.max(70, f.width * scale + 8), f.height * scale + 8, bg);
      x.drawImage(f, 4, 4, f.width * scale, f.height * scale);
      cell(r, c, id);
    }
  }
}

function digits(): void {
  for (const style of ['white', 'yellow', 'orange', 'rainbow'] as DigitStyle[]) {
    const row = section(style);
    for (const h of [64, 32]) {
      const d = art.bakeDigits(style, h);
      const [c, x] = blank(d.canvas.width + 8, d.cellHeight + 8, '#1b6583');
      x.drawImage(d.canvas, 4, 4);
      cell(row, c, `atlas ${h}`);
      const [c2, y] = blank(300, d.cellHeight + 8, '#1b6583');
      let px = 4;
      for (const ch of '+1234567890') {
        const i = '0123456789+'.indexOf(ch);
        y.drawImage(d.canvas, i * d.cellWidth, 0, d.cellWidth, d.cellHeight, px, 4, d.cellWidth, d.cellHeight);
        px += d.advance[i]!;
      }
      cell(row, c2, 'advances');
    }
  }
}

function otto(): void {
  const row = section('Captain Otto');
  for (const pose of ['idle', 'cheer', 'sleep', 'point'] as OttoPose[]) {
    for (const t of [0.3, 1.4]) {
      const [c, x] = blank(320, 360, '#1b6583');
      const t0 = performance.now();
      art.drawOtto(x, pose, 150, 346, 330, t);
      cell(row, c, `${pose} t=${t} ${(performance.now() - t0).toFixed(1)} ms`);
    }
  }
  const row2 = section('App icon, then Fish Book drawCreature');
  for (const size of [512, 192, 64]) {
    const [c, x] = blank(size, size);
    art.drawAppIcon(x, size);
    cell(row2, c, String(size));
  }
  const row3 = section('drawCreature (Fish Book) and silhouettes, drawCannonPreview');
  const list = ['F01', 'F04', 'F09', 'F10', 'F11', 'B01', 'B02', 'S03', 'S05'] as const;
  for (const id of list) {
    const [c, x] = blank(170, 170, '#f4f0e4');
    art.drawCreature(x, id, 85, 85, 150);
    x.strokeStyle = 'rgba(255,0,0,0.3)';
    x.strokeRect(10, 10, 150, 150);
    cell(row3, c, id);
  }
  for (const id of ['F12', 'B01', 'B02'] as const) {
    const [c, x] = blank(170, 170, '#f4f0e4');
    art.drawCreature(x, id, 85, 85, 150, { silhouette: true });
    cell(row3, c, `${id} sil`);
  }
  for (const skin of SKINS) {
    const [c, x] = blank(170, 170, '#f4f0e4');
    art.drawCannonPreview(x, skin, 5, 85, 125, 100);
    cell(row3, c, skin);
  }
}

function timing(): void {
  // Every sprite in one page load, in boot order, twice: cold JIT first, then warm.
  for (const pass of ['cold', 'warm']) {
    let sum = 0;
    let shadows = 0;
    let bytes = 0;
    const lines: string[] = [];
    for (const id of ALL) {
      const t = performance.now();
      const sheet = art.bakeSprite(id, ppu);
      // Reading a pixel forces any deferred drawing to finish, as the GL upload does in the game.
      sheet.canvas.getContext('2d')!.getImageData(0, 0, 1, 1);
      const ms = performance.now() - t;
      sum += ms;
      bytes += sheet.canvas.width * sheet.canvas.height * 4;
      lines.push(`${id} ${ms.toFixed(0)}ms ${sheet.canvas.width}x${sheet.canvas.height}/${sheet.frames}`);
      const t2 = performance.now();
      const sh = art.bakeShadow(id, ppu);
      sh.getContext('2d')!.getImageData(0, 0, 1, 1);
      shadows += performance.now() - t2;
      bytes += sh.width * sh.height * 4;
      sh.width = 0;
      sheet.canvas.width = 0;
    }
    if (pass === 'cold') log(lines.join(' | '));
    log(`${pass}: sprites ${sum.toFixed(0)} ms, shadows ${shadows.toFixed(0)} ms, sheets+shadows ${(bytes / 1048576).toFixed(1)} MB`);
  }
}

function loops(): void {
  // Mean pixel change between neighbouring frames. A seam shows as a wrap value far above the rest.
  const lines: string[] = [];
  for (const id of ALL) {
    const s = art.bakeSprite(id, ppu);
    const d = s.canvas.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, s.canvas.width, s.canvas.height).data;
    const cw = s.canvas.width;
    const at = (f: number, px: number, py: number, c: number): number => d[((Math.floor(f / s.columns) * s.frameHeight + py) * cw + (f % s.columns) * s.frameWidth + px) * 4 + c]!;
    const diffs: number[] = [];
    for (let f = 0; f < s.frames; f++) {
      let sum = 0;
      for (let py = 0; py < s.frameHeight; py += 2) {
        for (let px = 0; px < s.frameWidth; px += 2) {
          sum += Math.abs(at(f, px, py, 3) - at((f + 1) % s.frames, px, py, 3)) + Math.abs(at(f, px, py, 1) - at((f + 1) % s.frames, px, py, 1));
        }
      }
      diffs.push(sum / (s.frameWidth * s.frameHeight));
    }
    const wrap = diffs[diffs.length - 1]!;
    const rest = diffs.slice(0, -1);
    const mean = rest.reduce((a, b) => a + b, 0) / rest.length;
    lines.push(`${id} ${s.frames}f wrap ${wrap.toFixed(2)} mean ${mean.toFixed(2)} max ${Math.max(...rest).toFixed(2)} ratio ${(wrap / mean).toFixed(2)}`);
    s.canvas.width = 0;
  }
  log(lines.join('\n'));
}

function shadows(): void {
  const row = section('Shadows, as the fish layer sits over them');
  for (const id of ALL) {
    const sheet = art.bakeSprite(id, ppu);
    const shadow = art.bakeShadow(id, ppu);
    const scale = Math.min(1, 230 / shadow.width);
    const [c, x] = blank(shadow.width * scale + 30, shadow.height * scale + 30, '#5f9f9c');
    x.save();
    x.scale(scale, scale);
    x.globalAlpha = 0.5;
    x.drawImage(shadow, 26, 26);
    x.globalAlpha = 1;
    x.drawImage(sheet.canvas, 0, 0, sheet.frameWidth, sheet.frameHeight, 6, 6, sheet.frameWidth, sheet.frameHeight);
    x.restore();
    cell(row, c, id);
  }
}

function composite(): void {
  const id = (q.get('ocean') ?? 'coral') as OceanId;
  const scale = Number(q.get('scale') ?? 1.22); // iPad at 2x: device pixels per design unit
  const [c, x] = blank(1920 * scale, 1280 * scale, '#000');
  const o = art.bakeOcean(id, 2300, 1560, 0.8);
  x.imageSmoothingQuality = 'high';
  x.save();
  x.scale(scale, scale);
  x.translate(-190, -140);
  x.drawImage(o.seabed, 0, 0, 2300, 1560);
  // The game's shader: min of two samples of the tile, added on top.
  const tile = art.bakeCausticsTile(512);
  const [web, w] = blank(1150, 780);
  const sample = (k: number, dx: number): void => {
    const pattern = w.createPattern(tile, 'repeat')!;
    pattern.setTransform(new DOMMatrix([(780 / 512) / k, 0, 0, (780 / 512) / k, dx, 0]));
    w.fillStyle = pattern;
    w.fillRect(0, 0, 1150, 780);
  };
  sample(0.82, 40);
  w.globalCompositeOperation = 'darken';
  sample(1.13, 300);
  x.globalCompositeOperation = 'lighter';
  x.globalAlpha = Math.min(1, o.causticStrength * 1.7);
  x.drawImage(web, 0, 0, 2300, 1560);
  x.globalCompositeOperation = 'source-over';
  x.globalAlpha = 1;
  x.drawImage(o.midground, 0, 0, 2300, 1560);
  x.restore();
  type Spot = readonly [SpriteId, number, number, number];
  const spots: Spot[] = [
    ['F01', 420, 300, 0.1], ['F01', 520, 350, 0.1], ['F01', 340, 380, 0.1], ['F01', 470, 430, 0.1], ['F01', 600, 270, 0.1],
    ['F02', 760, 240, -0.2], ['F02', 830, 300, -0.2], ['F02', 700, 320, -0.2],
    ['F03', 1120, 200, Math.PI - 0.1], ['F03', 1200, 250, Math.PI - 0.1], ['F03', 1060, 280, Math.PI - 0.1],
    ['F04', 1500, 300, 0], ['F05', 1660, 360, Math.PI], ['F05_puffed', 1480, 520, 0], ['F06', 980, 480, 0.2], ['F06', 1100, 530, 0.2],
    ['F07', 300, 640, 0], ['F08', 620, 620, 0.1], ['F09', 960, 760, -0.3], ['F10', 1320, 720, Math.PI + 0.1], ['F11', 1670, 720, 0], ['F12', 560, 950, 0],
    ['S01', 240, 860, 0], ['S02', 1120, 370, 0], ['S03', 820, 880, 0], ['S04', 1020, 1000, 0], ['S05', 1280, 1020, 0], ['S06', 1520, 940, 0],
  ];
  for (const [sid, px, py, rot] of spots) {
    const s = art.bakeSprite(sid, 1.25);
    const k = (scale * 1) / s.ppu;
    const left = Math.cos(rot) < 0;
    const r = s.facing === 'upright' ? 0 : rot;
    const flipX = s.facing === 'upright' && left ? -1 : 1;
    const flipY = s.facing === 'side' && left ? -1 : 1;
    const shadow = art.bakeShadow(sid, 1.25);
    x.save();
    x.translate((px + 40) * scale, (py + 48) * scale);
    x.rotate(r);
    x.scale(k * 1.05 * flipX, k * 1.05 * flipY);
    x.globalAlpha = 0.26;
    x.drawImage(shadow, -s.originX, -s.originY);
    x.restore();
    x.save();
    x.translate(px * scale, py * scale);
    x.rotate(r);
    x.scale(k * flipX, k * flipY);
    const f = (sid.length * 3) % s.frames;
    x.drawImage(s.canvas, (f % s.columns) * s.frameWidth, Math.floor(f / s.columns) * s.frameHeight, s.frameWidth, s.frameHeight, -s.originX, -s.originY, s.frameWidth, s.frameHeight);
    x.restore();
    s.canvas.width = 0;
    shadow.width = 0;
  }
  const row = section(`${id} composite at ${scale} px/u`);
  row.appendChild(c);
}

function run(): void {
  const t0 = performance.now();
  // No `only` lays out everything. timing, loops and composite run on request, as each one takes its own bake pass.
  const on = (name: string): boolean => !only || only === name;
  if (only === 'timing') timing();
  if (only === 'loops') loops();
  if (only === 'composite') composite();
  if (on('creatures')) creatures();
  if (on('shadows')) shadows();
  if (on('dragon')) dragonChain();
  if (on('oceans')) oceans();
  if (on('caustics')) caustics();
  if (on('cannons')) cannons();
  if (on('fx')) fxSheet();
  if (on('digits')) digits();
  if (on('otto')) otto();
  log(`done in ${(performance.now() - t0).toFixed(0)} ms`);
  document.body.dataset.ready = '1';
}

try {
  run();
} catch (e) {
  log(`ERROR ${(e as Error).stack ?? e}`);
  document.body.dataset.ready = '1';
}
