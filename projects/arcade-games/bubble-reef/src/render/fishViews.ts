import Phaser from 'phaser';
import type { FxId, SpriteId } from '../art/types';
import { CONFIG } from '../config';
import { clamp, lerp, lerpAngle } from '../sim/math';
import { isUpright, type Fish, type SimState } from '../sim/state';
import { CAUGHT_FLOAT_SEC } from '../sim/motion';
import type { Assets, SheetInfo } from './assets';

type Img = Phaser.GameObjects.Image;

const SPECIAL_ICON: Record<string, FxId> = {
  burst: 'iconBurst', snow: 'iconSnow', spark: 'iconSpark', rainbow: 'iconRainbow', chest: 'iconChest', beam: 'iconBeam',
};

interface FishView {
  gen: number;
  sheet: SheetInfo;
  body: Img;
  shadow: Img;
  flash: Img | null;
  aura: Img | null;
  icon: Img | null;
  shell: Img | null;
  bubble: Img | null;
  segments: Img[];
  anim: number;
  flip: number;
  wobble: number;
  lastHp: number;
  puffed: boolean;
}

export interface FishLayers {
  shadows: Phaser.GameObjects.Layer;
  fish: Phaser.GameObjects.Layer;
  flashes: Phaser.GameObjects.Layer;
  badges: Phaser.GameObjects.Layer;
}

/** Keeps one set of sprites per simulated fish, reusing sprites by species. */
export class FishViews {
  private readonly views = new Map<number, FishView>();
  private readonly free = new Map<string, Img[]>();
  private gen = 0;
  /** World-space positions used by the lock ring and HP rings this frame. */
  readonly positions = new Map<number, { x: number; y: number; r: number }>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly assets: Assets,
    private readonly layers: FishLayers,
  ) {}

  private take(key: string, layer: Phaser.GameObjects.Layer, poolKey = `${key}:${layer.name}`): Img {
    const list = this.free.get(poolKey);
    const img = list?.pop();
    if (img) return img.setVisible(true).setAlpha(1).clearTint().setRotation(0);
    const made = this.scene.add.image(0, 0, key);
    made.setData('pool', poolKey);
    layer.add(made);
    return made;
  }

  private give(img: Img | null): void {
    if (!img) return;
    img.setVisible(false);
    const key = img.getData('pool') as string;
    const list = this.free.get(key);
    if (list) list.push(img);
    else this.free.set(key, [img]);
  }

  private sheetFor(id: string): SheetInfo {
    const sheet = this.assets.sheets.get(id as SpriteId);
    if (!sheet) throw new Error(`No sheet for ${id}`);
    return sheet;
  }

  private create(f: Fish): FishView {
    const sheet = this.sheetFor(f.def.id);
    const body = this.take(sheet.key, this.layers.fish);
    // Big creatures swim underneath small ones, so nothing catchable gets hidden.
    // setTexture, not setFrame: a pufferfish caught while puffed comes back from the pool with the puffed sheet.
    body.setTexture(sheet.key, 0).setOrigin(sheet.originX, sheet.originY).setDepth(-f.def.size);
    const shadow = this.take(sheet.shadowKey, this.layers.shadows);
    shadow.setAlpha(0.26).setScale(sheet.scale * 1.05);

    const view: FishView = {
      gen: this.gen, sheet, body, shadow, flash: null, aura: null, icon: null, shell: null, bubble: null,
      segments: [], anim: f.phase * 3, flip: Math.cos(f.heading) >= 0 ? 1 : -1, wobble: 0, lastHp: f.hp, puffed: false,
    };

    if (f.def.tier === 'special') {
      view.aura = this.take('fx_aura', this.layers.flashes).setBlendMode(Phaser.BlendModes.ADD);
      const iconId = SPECIAL_ICON[f.def.icon ?? ''];
      if (iconId) view.icon = this.take(`fx_${iconId}`, this.layers.badges);
    }
    if (f.armoured) view.shell = this.take('fx_shellBadge', this.layers.badges);

    if (f.def.chain) {
      const seg = this.sheetFor('B02_segment');
      const tail = this.sheetFor('B02_tail');
      for (let i = 0; i < f.def.chain.segments; i++) {
        const last = i === f.def.chain.segments - 1;
        const info = last ? tail : seg;
        const img = this.take(info.key, this.layers.fish).setOrigin(info.originX, info.originY).setFrame(0);
        view.segments.push(img);
      }
      // Tail furthest back, so each section overlaps the next one along.
      view.segments.forEach((img, i) => img.setDepth(body.depth - 0.1 * (i + 1)));
    }
    return view;
  }

  private release(view: FishView): void {
    this.give(view.body);
    this.give(view.shadow);
    this.give(view.flash);
    this.give(view.aura);
    this.give(view.icon);
    this.give(view.shell);
    this.give(view.bubble);
    view.segments.forEach((s) => this.give(s));
  }

  private bodyTransform(f: Fish, view: FishView, heading: number, dt: number, s: number): void {
    const { sheet, body } = view;
    const wobble = Math.sin(view.wobble * 40) * view.wobble * 1.4;
    if (sheet.facing === 'side') {
      const target = Math.cos(heading) >= 0 ? 1 : -1;
      view.flip += (target - view.flip) * Math.min(1, dt * 11);
      const y = Math.abs(view.flip) < 0.12 ? 0.12 * Math.sign(view.flip || 1) : view.flip;
      body.setRotation(heading + wobble).setScale(s, s * y);
    } else if (sheet.facing === 'top') {
      body.setRotation(heading + wobble).setScale(s);
    } else {
      view.flip += (f.face - view.flip) * Math.min(1, dt * 9);
      const x = Math.abs(view.flip) < 0.12 ? 0.12 * Math.sign(view.flip || 1) : view.flip;
      const tilt = clamp(Math.cos(heading) * 0.12, -0.12, 0.12);
      body.setRotation(tilt + wobble).setScale(s * x, s);
    }
  }

  private syncCaught(f: Fish, view: FishView, x: number, y: number): void {
    const t = clamp(f.caughtAge / CAUGHT_FLOAT_SEC, 0, 1);
    const { body, sheet } = view;
    const lift = 170 * t * t + 30 * t;
    const squish = sheet.scale * lerp(1.1, 0.72, t);
    body.setPosition(x, y - lift).setRotation(body.rotation + 0.26).setAlpha(1 - t * t).setScale(squish);
    view.shadow.setVisible(false);
    view.aura?.setVisible(false);
    view.icon?.setVisible(false);
    view.shell?.setVisible(false);
    view.flash?.setVisible(false);
    if (!view.bubble) view.bubble = this.take('fx_catchBubble', this.layers.badges);
    const radius = Math.max(70, Math.min(f.def.size * 0.72, 320));
    view.bubble.setPosition(x, y - lift).setScale((radius / 128) * lerp(0.85, 1.14, t)).setAlpha(Math.min(1, (1 - t) * 1.7));
    for (const seg of view.segments) seg.setAlpha(1 - t);
  }

  private syncSegments(f: Fish, view: FishView, alpha: number): void {
    const chain = f.def.chain;
    if (!chain) return;
    const n = view.segments.length;
    for (let i = 0; i < n; i++) {
      const img = view.segments[i]!;
      const x = f.chainX[i] ?? f.x;
      const y = f.chainY[i] ?? f.y;
      const ax = i === 0 ? f.x : (f.chainX[i - 1] ?? f.x);
      const ay = i === 0 ? f.y : (f.chainY[i - 1] ?? f.y);
      const info = this.sheetFor(i === n - 1 ? 'B02_tail' : 'B02_segment');
      const taper = lerp(1, 0.72, i / n);
      img.setPosition(x, y).setRotation(Math.atan2(ay - y, ax - x)).setScale(info.scale * taper).setAlpha(alpha);
    }
  }

  sync(s: SimState, alpha: number, dt: number, frozen: boolean): void {
    this.gen++;
    this.positions.clear();

    for (const f of s.fish) {
      let view = this.views.get(f.uid);
      if (!view) {
        view = this.create(f);
        this.views.set(f.uid, view);
      }
      view.gen = this.gen;

      const x = lerp(f.px, f.x, alpha);
      const y = lerp(f.py, f.y, alpha);
      const heading = lerpAngle(f.pheading, f.heading, alpha);
      if (f.state === 'caught') {
        this.syncCaught(f, view, x, y);
        continue;
      }

      const { body, shadow, sheet } = view;
      if (f.hp < view.lastHp) view.wobble = 0.16;
      view.lastHp = f.hp;
      view.wobble = Math.max(0, view.wobble - dt);

      if (!frozen) {
        const rushed = clamp(f.speed * f.rush / Math.max(1, f.def.speed), 0.5, 2.4);
        view.anim += dt * sheet.fps * rushed;
      }
      const frame = Math.floor(view.anim) % sheet.frames;

      const puffed = f.puff > 0 && f.def.id === 'F05';
      if (puffed !== view.puffed) {
        view.puffed = puffed;
        const next = this.sheetFor(puffed ? 'F05_puffed' : 'F05');
        body.setTexture(next.key, 0).setOrigin(next.originX, next.originY);
      }
      const active = puffed ? this.sheetFor('F05_puffed') : sheet;
      body.setFrame(frame % active.frames);
      body.setPosition(x, y);
      this.bodyTransform(f, view, heading, dt, active.scale);

      const diving = f.state === 'dive';
      const fade = diving ? clamp(f.diveT / CONFIG.powerups.boss.dragonDiveSec, 0, 1) : 1;
      const fadeOut = diving ? clamp(1 - (1 - fade) * 4, 0, 1) : 1;
      body.setAlpha(fadeOut);
      this.syncSegments(f, view, fadeOut);

      const lift = f.isBoss ? 46 : clamp(f.def.size * 0.16, 12, 34);
      shadow.setPosition(x + lift * 0.7, y + lift).setRotation(sheet.facing === 'upright' ? 0 : heading).setAlpha(0.26 * fadeOut);

      if (frozen) body.setTint(0xa8e4ff);
      else body.clearTint();

      if (f.flash > 0) {
        if (!view.flash) {
          view.flash = this.take(active.key, this.layers.flashes, `flash:${active.key}`).setBlendMode(Phaser.BlendModes.ADD);
          view.flash.setOrigin(active.originX, active.originY);
        }
        view.flash
          .setVisible(true)
          .setFrame(body.frame.name)
          .setPosition(x, y)
          .setRotation(body.rotation)
          .setScale(body.scaleX, body.scaleY)
          .setAlpha(clamp(f.flash / 0.08, 0, 1) * 0.85);
      } else if (view.flash) {
        this.give(view.flash);
        view.flash = null;
      }

      if (view.aura) {
        const r = f.def.size * 1.05;
        view.aura.setPosition(x, y).setRotation(f.age * 0.8).setScale((r / 128) * (1 + Math.sin(f.age * 4) * 0.08)).setAlpha(0.75);
      }
      if (view.icon) view.icon.setPosition(x, y - f.def.size * 0.72 - Math.sin(f.age * 3) * 6).setScale(0.62);
      if (view.shell) {
        const armoured = f.hp / f.maxHp >= CONFIG.powerups.armour.untilHpRatio;
        view.shell.setVisible(armoured).setPosition(x + f.def.size * 0.3, y - f.def.size * 0.3).setScale(0.62);
      }

      this.positions.set(f.uid, { x, y, r: f.def.size * (isUpright(f.def.id) ? 0.56 : 0.5) });
    }

    for (const [uid, view] of this.views) {
      if (view.gen !== this.gen) {
        this.release(view);
        this.views.delete(uid);
      }
    }
  }

  clear(): void {
    for (const view of this.views.values()) this.release(view);
    this.views.clear();
    this.positions.clear();
  }
}

