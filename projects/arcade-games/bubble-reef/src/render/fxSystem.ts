import Phaser from 'phaser';
import type { DigitStyle } from '../art/types';
import { clamp, lerp, TAU } from '../sim/math';
import type { Assets } from './assets';

type Img = Phaser.GameObjects.Image;

export class ImagePool {
  private readonly free: Img[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly layer: Phaser.GameObjects.Layer,
    private readonly key: string,
    private readonly blend: Phaser.BlendModes = Phaser.BlendModes.NORMAL,
  ) {}

  get(frame?: number): Img {
    const img = this.free.pop() ?? this.create();
    if (frame !== undefined) img.setFrame(frame);
    img.setVisible(true).setAlpha(1).setRotation(0).clearTint();
    return img;
  }

  put(img: Img): void {
    img.setVisible(false);
    this.free.push(img);
  }

  private create(): Img {
    const img = this.scene.add.image(0, 0, this.key).setBlendMode(this.blend);
    this.layer.add(img);
    return img;
  }
}

interface Transient {
  img: Img;
  pool: ImagePool;
  age: number;
  life: number;
  update: (img: Img, t: number) => void;
  done?: () => void;
}

const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);

export interface CoinTarget {
  x: number;
  y: number;
}

/** Short-lived effects. Everything is pooled; gameplay state stays in the simulation. */
export class FxSystem {
  private readonly transients: Transient[] = [];
  private readonly digits = new Map<DigitStyle, ImagePool>();
  private readonly coinPool: ImagePool;
  private readonly ringPool: ImagePool;
  private readonly glowPool: ImagePool;
  private readonly sparkle: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly droplets: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly trail: Phaser.GameObjects.Particles.ParticleEmitter;
  private lastFlash = -10;
  reduceFlashing = false;
  coinTarget: CoinTarget = { x: 600, y: 40 };
  onCoinArrive: (coins: number) => void = () => {};

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly assets: Assets,
    layer: Phaser.GameObjects.Layer,
    private readonly flashRect: Phaser.GameObjects.Rectangle,
  ) {
    for (const style of ['white', 'yellow', 'orange', 'rainbow'] as DigitStyle[]) {
      this.digits.set(style, new ImagePool(scene, layer, `digits_${style}`));
    }
    this.coinPool = new ImagePool(scene, layer, 'fx_coin');
    this.ringPool = new ImagePool(scene, layer, 'fx_hitRing', Phaser.BlendModes.ADD);
    this.glowPool = new ImagePool(scene, layer, 'fx_softDot', Phaser.BlendModes.ADD);

    this.trail = scene.add.particles(0, 0, 'fx_trail', {
      lifespan: 320, scale: { start: 0.9, end: 0.2 }, alpha: { start: 0.65, end: 0 }, emitting: false, maxParticles: 60,
    });
    this.droplets = scene.add.particles(0, 0, 'fx_softDot', {
      speed: { min: 60, max: 260 }, lifespan: { min: 280, max: 520 }, scale: { start: 0.5, end: 0 },
      alpha: { start: 0.85, end: 0 }, tint: [0xffffff, 0x9fe8ff, 0x6ad8ff], emitting: false, maxParticles: 120,
    });
    this.sparkle = scene.add.particles(0, 0, 'fx_sparkle', {
      speed: { min: 90, max: 340 }, lifespan: { min: 340, max: 720 }, scale: { start: 1, end: 0 }, alpha: { start: 1, end: 0 },
      rotate: { min: 0, max: 360 }, blendMode: Phaser.BlendModes.ADD, emitting: false, maxParticles: 120,
    });
    layer.add([this.trail, this.droplets, this.sparkle]);
  }

  private add(t: Omit<Transient, 'age'>): void {
    this.transients.push({ ...t, age: 0 });
    t.update(t.img, 0);
  }

  update(dt: number): void {
    let write = 0;
    for (const item of this.transients) {
      item.age += dt;
      const t = item.age / item.life;
      if (t >= 1) {
        item.pool.put(item.img);
        item.done?.();
      } else {
        item.update(item.img, t);
        this.transients[write++] = item;
      }
    }
    this.transients.length = write;
  }

  bubbleTrail(x: number, y: number): void {
    this.trail.emitParticleAt(x, y, 1);
  }

  splash(x: number, y: number, count: number): void {
    this.droplets.explode(count, x, y);
  }

  sparkles(x: number, y: number, count: number): void {
    this.sparkle.explode(count, x, y);
  }

  ring(x: number, y: number, radius: number, tint = 0xffffff, life = 0.45): void {
    const img = this.ringPool.get().setPosition(x, y).setTint(tint);
    this.add({
      img, pool: this.ringPool, life,
      update: (i, t) => i.setScale((radius * easeOut(t)) / 64).setAlpha(1 - t),
    });
  }

  glow(x: number, y: number, radius: number, tint: number, life = 0.4): void {
    const img = this.glowPool.get().setPosition(x, y).setTint(tint);
    this.add({
      img, pool: this.glowPool, life,
      update: (i, t) => i.setScale((radius * (0.5 + 0.5 * easeOut(t))) / 16).setAlpha((1 - t) * 0.8),
    });
  }

  /** Points popup: size scales with value, colour by band (15.3). */
  popup(x: number, y: number, value: number): void {
    const style: DigitStyle = value >= 200 ? 'rainbow' : value >= 50 ? 'orange' : value >= 10 ? 'yellow' : 'white';
    const pool = this.digits.get(style);
    const advance = this.assets.digitAdvance.get(style);
    if (!pool || !advance) return;

    const text = `+${value}`;
    const size = clamp(0.72 + Math.log10(value) * 0.34, 0.72, 1.7);
    let width = 0;
    for (const ch of text) width += advance[ch === '+' ? 10 : Number(ch)] ?? 0;
    let cx = x - (width * size) / 2;
    for (const ch of text) {
      const index = ch === '+' ? 10 : Number(ch);
      const adv = (advance[index] ?? 0) * size;
      const dx = cx + adv / 2;
      cx += adv;
      const img = pool.get(index).setPosition(dx, y).setDepth(10);
      this.add({
        img, pool, life: 0.95,
        update: (i, t) => {
          const pop = t < 0.18 ? lerp(0.5, 1.15, t / 0.18) : t < 0.3 ? lerp(1.15, 1, (t - 0.18) / 0.12) : 1;
          i.setScale(size * pop).setY(y - 70 * easeOut(t)).setAlpha(t > 0.72 ? (1 - t) / 0.28 : 1);
        },
      });
    }
  }

  /** Coins arc up to the coin counter, and only then does the counter tick. */
  coins(x: number, y: number, total: number): void {
    const count = clamp(1 + Math.floor(Math.log2(total + 1)), 1, 10);
    const each = Math.floor(total / count);
    let left = total;
    for (let i = 0; i < count; i++) {
      const worth = i === count - 1 ? left : each;
      left -= worth;
      const startX = x + (i - count / 2) * 16;
      const startY = y + ((i * 37) % 30) - 15;
      const delay = i * 0.04;
      const life = 0.62 + delay;
      const swing = ((i * 53) % 120) - 60;
      const img = this.coinPool.get();
      this.add({
        img, pool: this.coinPool, life,
        update: (c, t) => {
          const u = clamp((t * life - delay) / 0.62, 0, 1);
          const e = u * u * (3 - 2 * u);
          c.setPosition(
            lerp(startX, this.coinTarget.x, e) + Math.sin(u * Math.PI) * swing,
            lerp(startY, this.coinTarget.y, e) - Math.sin(u * Math.PI) * 90,
          );
          c.setScale(lerp(1.05, 0.7, e)).setAlpha(u <= 0 ? 0 : 1).setRotation(u * TAU);
        },
        done: () => this.onCoinArrive(worth),
      });
    }
  }

  lightning(g: Phaser.GameObjects.Graphics, ax: number, ay: number, bx: number, by: number, alpha: number, seed: number): void {
    const soft = this.reduceFlashing ? 0.45 : 1;
    const steps = 7;
    const nx = -(by - ay);
    const ny = bx - ax;
    const len = Math.hypot(nx, ny) || 1;
    const path: [number, number][] = [[ax, ay]];
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const jitter = (Math.sin(seed * 7.3 + i * 12.9) * 0.5 + Math.sin(seed * 3.1 + i * 4.7) * 0.5) * 38;
      path.push([lerp(ax, bx, t) + (nx / len) * jitter, lerp(ay, by, t) + (ny / len) * jitter]);
    }
    path.push([bx, by]);
    for (const [width, colour, a] of [[16, 0x7fd8ff, 0.28], [6, 0xffffff, 0.95]] as const) {
      g.lineStyle(width, colour, a * alpha * soft);
      g.beginPath();
      path.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
      g.strokePath();
    }
  }

  /** A single soft full-screen pulse, spaced out to stay well under 3 flashes a second (NFR-07). */
  flash(colour: number, strength: number): void {
    const now = this.scene.time.now / 1000;
    if (this.reduceFlashing || now - this.lastFlash < 0.5) return;
    this.lastFlash = now;
    this.flashRect.setFillStyle(colour, 1).setAlpha(strength).setVisible(true);
    this.scene.tweens.add({ targets: this.flashRect, alpha: 0, duration: 320, onComplete: () => this.flashRect.setVisible(false) });
  }

  shake(ms: number, strength: number): void {
    if (!this.reduceFlashing) this.scene.cameras.main.shake(ms, strength);
  }
}
