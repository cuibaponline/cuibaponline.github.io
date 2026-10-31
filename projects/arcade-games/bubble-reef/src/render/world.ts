import Phaser from 'phaser';
import type { OceanId, SkinId } from '../art/types';
import { CONFIG } from '../config';
import { cannonDirX, cannonDirY, clamp, lerp, lerpAngle, TAU } from '../sim/math';
import type { Simulation } from '../sim/simulation';
import { DT, type SimEvent } from '../sim/state';
import { Assets, type CannonTextures } from './assets';
import { FishViews } from './fishViews';
import { FxSystem, ImagePool } from './fxSystem';
import { computeLayout, type Layout } from './layout';

const CAUSTICS_FRAG = `
precision highp float;
uniform float time;
uniform vec2 resolution;
uniform sampler2D iChannel0;
uniform vec3 tint;
uniform float strength;
varying vec2 fragCoord;
void main() {
  vec2 uv = fragCoord / resolution.y;
  float a = texture2D(iChannel0, uv * 0.82 + fract(vec2(time * 0.021, time * 0.013))).r;
  float b = texture2D(iChannel0, uv * 1.13 + fract(vec2(-time * 0.017, time * 0.019))).r;
  float c = min(a, b);
  gl_FragColor = vec4(tint * c * strength * 1.25, 0.0);
}`;

export interface WorldHooks {
  onEvents(events: SimEvent[]): void;
  onCoinArrive(coins: number): void;
  onFrame(dt: number): void;
}

const colourVec = (c: number): { r: number; g: number; b: number } => ({
  r: ((c >> 16) & 255) / 255,
  g: ((c >> 8) & 255) / 255,
  b: (c & 255) / 255,
});

class WorldScene extends Phaser.Scene {
  ready!: () => void;
  constructor() {
    super('world');
  }
  create(): void {
    this.ready();
  }
}

export class World {
  private readonly game: Phaser.Game;
  private scene!: Phaser.Scene;
  assets!: Assets;
  private fx!: FxSystem;
  private fish!: FishViews;
  private layout: Layout;

  private layers!: Record<'bg' | 'shadows' | 'fish' | 'flashes' | 'nets' | 'bubbles' | 'cannon' | 'badges' | 'fx' | 'overlay', Phaser.GameObjects.Layer>;
  private seabed!: Phaser.GameObjects.Image;
  private midground!: Phaser.GameObjects.Image;
  private seabedNext!: Phaser.GameObjects.Image;
  private midgroundNext!: Phaser.GameObjects.Image;
  private caustics: Phaser.GameObjects.Shader | null = null;
  private vignette!: Phaser.GameObjects.Image;
  private frost!: Phaser.GameObjects.Image;
  private rays: Phaser.GameObjects.Image[] = [];
  private flashRect!: Phaser.GameObjects.Rectangle;
  private ambient!: Phaser.GameObjects.Particles.ParticleEmitter;
  private cannonBase!: Phaser.GameObjects.Image;
  private cannonBarrel!: Phaser.GameObjects.Image;
  private cannonTex!: CannonTextures;
  private lockRing!: Phaser.GameObjects.Image;
  private beamGlow!: Phaser.GameObjects.Image;
  private beamCore!: Phaser.GameObjects.Image;
  private shapes!: Phaser.GameObjects.Graphics;
  private bubblePool!: ImagePool;
  private netPool!: ImagePool;
  private popPool!: ImagePool;
  private bubbleImgs: Phaser.GameObjects.Image[] = [];
  private netImgs: Phaser.GameObjects.Image[] = [];
  private popImgs: Phaser.GameObjects.Image[] = [];

  private sim: Simulation | null = null;
  private acc = 0;
  private paused = false;
  private clock = 0;
  private frostLevel = 0;
  private sparks: { ax: number; ay: number; bx: number; by: number; age: number; seed: number }[] = [];
  private trailToggle = 0;
  private oceanId: OceanId | null = null;
  private crossfade = 1;
  private cannonLevelShown = -1;

  private renderScale = 2;
  private slowFor = 0;
  private fastFor = 0;
  /** Average frames per second, smoothed. Exposed for the dynamic-resolution check and tests. */
  fps = 60;

  private constructor(
    private readonly parent: HTMLElement,
    private readonly hooks: WorldHooks,
    readyCb: (w: World) => void,
  ) {
    this.layout = computeLayout(parent.clientWidth || 1180, parent.clientHeight || 820);
    this.renderScale = Math.min(window.devicePixelRatio || 1, 2);
    const scene = new WorldScene();
    scene.ready = () => {
      this.scene = scene;
      this.assets = new Assets(scene);
      readyCb(this);
    };
    this.game = new Phaser.Game({
      type: Phaser.WEBGL,
      parent,
      width: Math.round(this.layout.cssW * this.renderScale),
      height: Math.round(this.layout.cssH * this.renderScale),
      backgroundColor: '#04395e',
      banner: false,
      audio: { noAudio: true },
      input: { keyboard: false, mouse: false, touch: false, gamepad: false },
      scale: { mode: Phaser.Scale.NONE },
      render: { antialias: true, powerPreference: 'high-performance', batchSize: 4096 },
      disableContextMenu: true,
      scene,
    });
  }

  static create(parent: HTMLElement, hooks: WorldHooks): Promise<World> {
    return new Promise((resolve) => {
      new World(parent, hooks, resolve);
    });
  }

  get canvas(): HTMLCanvasElement {
    return this.game.canvas;
  }

  get currentLayout(): Layout {
    return this.layout;
  }

  /** Runs after boot-time art is baked. */
  build(): void {
    const scene = this.scene;
    const layer = (name: string): Phaser.GameObjects.Layer => {
      const l = scene.add.layer();
      l.name = name;
      return l;
    };
    this.layers = {
      bg: layer('bg'), shadows: layer('shadows'), fish: layer('fish'), flashes: layer('flashes'), nets: layer('nets'),
      bubbles: layer('bubbles'), cannon: layer('cannon'), badges: layer('badges'), fx: layer('fx'), overlay: layer('overlay'),
    };

    this.seabed = scene.add.image(960, 640, '__DEFAULT');
    this.seabedNext = scene.add.image(960, 640, '__DEFAULT').setVisible(false);
    this.layers.bg.add([this.seabed, this.seabedNext]);
    this.buildCaustics();
    this.midground = scene.add.image(960, 640, '__DEFAULT');
    this.midgroundNext = scene.add.image(960, 640, '__DEFAULT').setVisible(false);
    this.layers.bg.add([this.midground, this.midgroundNext]);

    this.fish = new FishViews(scene, this.assets, {
      shadows: this.layers.shadows, fish: this.layers.fish, flashes: this.layers.flashes, badges: this.layers.badges,
    });

    this.bubblePool = new ImagePool(scene, this.layers.bubbles, 'fx_bubble');
    this.netPool = new ImagePool(scene, this.layers.nets, 'fx_net');
    this.popPool = new ImagePool(scene, this.layers.badges, 'fx_popBubble');

    this.beamGlow = scene.add.image(0, 0, 'fx_beamGlow').setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.beamCore = scene.add.image(0, 0, 'fx_beamCore').setOrigin(0, 0.5).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.layers.bubbles.add([this.beamGlow, this.beamCore]);

    this.cannonBase = scene.add.image(0, 0, '__DEFAULT').setVisible(false);
    this.cannonBarrel = scene.add.image(0, 0, '__DEFAULT').setVisible(false);
    this.layers.cannon.add([this.cannonBarrel, this.cannonBase]);

    this.lockRing = scene.add.image(0, 0, 'fx_lockRing').setVisible(false);
    this.shapes = scene.add.graphics();
    this.layers.badges.add([this.lockRing, this.shapes]);

    this.flashRect = scene.add.rectangle(960, 640, 4000, 3000, 0xffffff).setVisible(false).setAlpha(0);
    this.fx = new FxSystem(scene, this.assets, this.layers.fx, this.flashRect);
    this.fx.onCoinArrive = (coins) => this.hooks.onCoinArrive(coins);

    this.ambient = scene.add.particles(0, 0, 'fx_trail', {
      x: { min: -200, max: 2120 }, y: 1460, speedY: { min: -120, max: -55 }, speedX: { min: -14, max: 14 },
      lifespan: 13000, scale: { min: 0.7, max: 2.2 }, alpha: { start: 0.55, end: 0.05 }, frequency: 420, maxParticles: 34,
    });
    for (let i = 0; i < 4; i++) {
      const ray = scene.add.image(180 + i * 520, 640, 'fx_lightRay').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.13);
      ray.setScale(5.2, 3.4).setRotation(0.2);
      this.rays.push(ray);
    }
    this.vignette = scene.add.image(960, 640, 'fx_vignette').setDisplaySize(2400, 1700).setAlpha(0.55);
    this.frost = scene.add.image(960, 640, 'fx_frost').setDisplaySize(2400, 1700).setAlpha(0).setVisible(false);
    this.layers.overlay.add([this.ambient, ...this.rays, this.vignette, this.frost, this.flashRect]);

    scene.events.on(Phaser.Scenes.Events.UPDATE, (_: number, delta: number) => this.update(delta));
    this.game.canvas.addEventListener('webglcontextlost', () => window.setTimeout(() => location.reload(), 400));
    this.resize();
  }

  private buildCaustics(): void {
    try {
      const base = new Phaser.Display.BaseShader('caustics', CAUSTICS_FRAG, undefined, {
        tint: { type: '3f', value: { x: 1, y: 1, z: 1 } },
        strength: { type: '1f', value: 0.3 },
      });
      const shader = this.scene.add.shader(base, 960, 640, 2500, 1800, ['caustics']);
      this.layers.bg.add(shader);
      this.caustics = shader;
    } catch (err) {
      console.warn('Caustics shader unavailable', err);
      this.caustics = null;
    }
  }

  /** Bakes up front; a mid-game bake would hitch, so callers do this behind a loading moment. */
  prepareOcean(id: OceanId): void {
    this.assets.ocean(id);
  }

  setOcean(id: OceanId, instant = false): void {
    if (id === this.oceanId) return;
    const textures = this.assets.ocean(id);
    const first = this.oceanId === null;
    this.oceanId = id;
    const { causticTint, causticStrength } = textures.bake;
    if (this.caustics) {
      const c = colourVec(causticTint);
      this.caustics.setUniform('tint.value', { x: c.r, y: c.g, z: c.b });
      this.caustics.setUniform('strength.value', causticStrength);
    }
    this.ambient.setParticleTint(textures.bake.bubbleTint);

    if (first || instant) {
      this.seabed.setTexture(textures.seabed).setVisible(true).setAlpha(1);
      this.midground.setTexture(textures.midground).setVisible(true).setAlpha(1);
      this.seabedNext.setVisible(false);
      this.midgroundNext.setVisible(false);
      this.crossfade = 1;
      this.fitOcean();
      return;
    }
    this.seabedNext.setTexture(textures.seabed).setVisible(true).setAlpha(0);
    this.midgroundNext.setTexture(textures.midground).setVisible(true).setAlpha(0);
    this.crossfade = 0;
    this.fitOcean();
  }

  private fitOcean(): void {
    const { view } = this.layout;
    const w = view.right - view.left + 60;
    const h = view.bottom - view.top + 60;
    for (const img of [this.seabed, this.midground, this.seabedNext, this.midgroundNext]) {
      if (img.texture.key === '__DEFAULT') continue;
      const scale = Math.max(w / img.width, h / img.height, 1 / 0.8);
      img.setScale(scale);
    }
  }

  setSkin(skin: SkinId): void {
    this.cannonTex = this.assets.cannon(skin);
    this.cannonBase.setTexture(this.cannonTex.base).setScale(this.cannonTex.scale);
    this.cannonLevelShown = -1;
  }

  setSim(sim: Simulation | null, showCannon: boolean): void {
    if (this.sim !== sim) {
      this.fish?.clear();
      for (const img of this.bubbleImgs) this.bubblePool.put(img);
      for (const img of this.netImgs) this.netPool.put(img);
      for (const img of this.popImgs) this.popPool.put(img);
      this.bubbleImgs = [];
      this.netImgs = [];
      this.popImgs = [];
    }
    this.sim = sim;
    this.acc = 0;
    this.cannonBase.setVisible(showCannon);
    this.cannonBarrel.setVisible(showCannon);
    this.lockRing.setVisible(false);
    this.beamGlow.setVisible(false);
    this.beamCore.setVisible(false);
    if (sim) sim.setView(this.layout.view);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  setReduceFlashing(on: boolean): void {
    this.fx.reduceFlashing = on;
    for (const ray of this.rays) ray.setAlpha(on ? 0.07 : 0.13);
  }

  /** Where coins fly to, given a screen point in CSS pixels. */
  setCoinTarget(cssX: number, cssY: number): void {
    const { x, y } = this.toWorld(cssX, cssY);
    this.fx.coinTarget = { x, y };
  }

  toWorld(cssX: number, cssY: number): { x: number; y: number } {
    const { zoom, view } = this.layout;
    return { x: view.left + cssX / zoom, y: view.top + cssY / zoom };
  }

  resize(): void {
    this.layout = computeLayout(this.parent.clientWidth || 1, this.parent.clientHeight || 1);
    this.applyScale();
    this.sim?.setView(this.layout.view);
    if (this.oceanId) this.fitOcean();
  }

  private applyScale(): void {
    const { cssW, cssH, zoom } = this.layout;
    const r = this.renderScale;
    const w = Math.round(cssW * r);
    const h = Math.round(cssH * r);
    this.game.scale.resize(w, h);
    const cam = this.scene.cameras.main;
    cam.setViewport(0, 0, w, h);
    cam.setZoom(zoom * r);
    cam.centerOn(960, 640);
    const canvas = this.game.canvas;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
  }

  /** 17.2: step down when the frame rate sags for 3 s, back up after it has been steady for a while. */
  private adaptResolution(dt: number): void {
    this.fps = lerp(this.fps, 1 / Math.max(dt, 1 / 240), 0.05);
    const top = Math.min(window.devicePixelRatio || 1, 2);
    if (this.fps < 50) {
      this.slowFor += dt;
      this.fastFor = 0;
    } else {
      this.slowFor = 0;
      if (this.fps > 57) this.fastFor += dt;
    }
    if (this.slowFor >= 3 && this.renderScale > Math.min(1.25, top)) {
      this.renderScale = this.renderScale > 1.5 ? 1.5 : 1.25;
      this.slowFor = 0;
      this.applyScale();
    } else if (this.fastFor >= 30 && this.renderScale < top) {
      this.renderScale = Math.min(top, this.renderScale >= 1.5 ? top : 1.5);
      this.fastFor = 0;
      this.applyScale();
    }
  }

  private update(delta: number): void {
    const dt = Math.min(delta, 100) / 1000;
    this.clock += dt;
    this.adaptResolution(dt);

    const sim = this.sim;
    if (sim && !this.paused) {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= DT && steps < 6) {
        sim.step();
        this.acc -= DT;
        steps++;
      }
      if (steps === 6) this.acc = 0;
      const events = sim.drainEvents();
      if (events.length > 0) {
        for (const e of events) this.onEvent(e);
        this.hooks.onEvents(events);
      }
    }

    if (sim) this.syncState(sim, this.acc / DT, this.paused ? 0 : dt);
    this.fx.update(this.paused ? 0 : dt);
    this.drawAmbient(dt);
    this.hooks.onFrame(dt);
  }

  private drawAmbient(dt: number): void {
    const t = this.clock;
    const px = Math.sin(t * 0.13) * 9;
    const py = Math.cos(t * 0.09) * 6;
    this.midground.setPosition(960 + px, 640 + py);
    this.midgroundNext.setPosition(960 + px, 640 + py);
    this.rays.forEach((ray, i) => {
      ray.x = 180 + i * 520 - px * 2 + Math.sin(t * 0.21 + i) * 40;
      ray.rotation = 0.2 + Math.sin(t * 0.17 + i * 1.7) * 0.05;
    });
    if (this.crossfade < 1) {
      this.crossfade = Math.min(1, this.crossfade + dt / 1.6);
      this.seabedNext.setAlpha(this.crossfade);
      this.midgroundNext.setAlpha(this.crossfade);
      if (this.crossfade >= 1) {
        this.seabed.setTexture(this.seabedNext.texture.key).setScale(this.seabedNext.scaleX);
        this.midground.setTexture(this.midgroundNext.texture.key).setScale(this.midgroundNext.scaleX);
        this.seabedNext.setVisible(false);
        this.midgroundNext.setVisible(false);
      }
    }
    const frozen = this.sim?.s.freezeT ?? 0;
    this.frostLevel += ((frozen > 0 ? 1 : 0) - this.frostLevel) * Math.min(1, dt * 5);
    this.frost.setVisible(this.frostLevel > 0.01).setAlpha(this.frostLevel);
  }

  private syncList<T>(list: T[], imgs: Phaser.GameObjects.Image[], pool: ImagePool, apply: (img: Phaser.GameObjects.Image, item: T) => void): void {
    while (imgs.length < list.length) imgs.push(pool.get());
    while (imgs.length > list.length) pool.put(imgs.pop()!);
    for (let i = 0; i < list.length; i++) apply(imgs[i]!, list[i]!);
  }

  private syncState(sim: Simulation, alpha: number, dt: number): void {
    const s = sim.s;
    const frozen = s.freezeT > 0 || s.bubblePop !== null;
    this.fish.sync(s, alpha, dt, frozen);

    this.syncList(s.bubbles, this.bubbleImgs, this.bubblePool, (img, b) => {
      img.setPosition(lerp(b.px, b.x, alpha), lerp(b.py, b.y, alpha)).setScale((b.r * 2.6) / 64);
    });
    if (s.bubbles.length > 0 && ++this.trailToggle % 2 === 0) {
      for (const b of s.bubbles) this.fx.bubbleTrail(b.x, b.y);
    }

    const { expandSec, holdSec, fadeSec } = CONFIG.cannon.net;
    this.syncList(s.nets, this.netImgs, this.netPool, (img, n) => {
      const grow = clamp(n.age / expandSec, 0, 1);
      const eased = 1 - (1 - grow) * (1 - grow);
      const fade = clamp((n.age - expandSec - holdSec) / fadeSec, 0, 1);
      img.setPosition(n.x, n.y).setScale(((n.radius * 2) / 256) * eased).setAlpha(1 - fade).setRotation(n.age * 0.8);
    });

    const pop = s.bubblePop;
    this.syncList(pop ? pop.bubbles : [], this.popImgs, this.popPool, (img, b) => {
      img.setPosition(lerp(b.px, b.x, alpha), lerp(b.py, b.y, alpha)).setScale((b.r * 2) / 160);
    });

    this.syncCannon(sim, alpha);
    this.syncShapes(sim, dt);
  }

  private syncCannon(sim: Simulation, alpha: number): void {
    const seat = sim.localSeat;
    if (!this.cannonBase.visible) return;
    if (this.cannonLevelShown !== seat.level && this.cannonTex) {
      this.cannonLevelShown = seat.level;
      const key = this.cannonTex.barrels[seat.level - 1];
      if (key) this.cannonBarrel.setTexture(key).setOrigin(this.cannonTex.pivotX, this.cannonTex.pivotY).setScale(this.cannonTex.scale);
    }
    const angle = lerpAngle(seat.pangle, seat.angle, alpha);
    const since = sim.tick - seat.lastFireTick;
    const recoil = since < 9 ? (1 - since / 9) * 14 : 0;
    const dx = cannonDirX(angle);
    const dy = cannonDirY(angle);
    this.cannonBase.setPosition(seat.x, seat.y);
    this.cannonBarrel.setPosition(seat.x - dx * recoil, seat.y - dy * recoil).setRotation(angle);

    const on = seat.laserT > 0;
    this.beamGlow.setVisible(on);
    this.beamCore.setVisible(on);
    if (on) {
      const reduce = this.fx.reduceFlashing;
      const width = CONFIG.powerups.laser.width;
      const pulse = reduce ? 1 : 1 + Math.sin(this.clock * 34) * 0.08;
      const heading = angle - Math.PI / 2;
      const x = seat.x + dx * 96;
      const y = seat.y + dy * 96;
      this.beamGlow.setPosition(x, y).setRotation(heading).setDisplaySize(3000, width * 2.6 * pulse).setAlpha(reduce ? 0.3 : 0.65);
      this.beamCore.setPosition(x, y).setRotation(heading).setDisplaySize(3000, width * pulse).setAlpha(reduce ? 0.55 : 1);
    }

    const locked = seat.lockUid !== 0 ? this.fish.positions.get(seat.lockUid) : undefined;
    this.lockRing.setVisible(locked !== undefined);
    if (locked) {
      const r = Math.max(locked.r * 1.25, 62);
      this.lockRing.setPosition(locked.x, locked.y).setRotation(this.clock * 1.4).setScale(((r * 2) / 256) * (1 + Math.sin(this.clock * 6) * 0.05));
    }
  }

  private syncShapes(sim: Simulation, dt: number): void {
    const g = this.shapes;
    g.clear();
    const s = sim.s;

    for (const f of s.fish) {
      if (f.hpRing <= 0 || f.state !== 'swim' || f.isBoss) continue;
      const p = this.fish.positions.get(f.uid);
      if (!p) continue;
      const r = Math.max(p.r * 0.95, 44);
      const a = clamp(f.hpRing / 0.4, 0, 1);
      g.lineStyle(9, 0x062a44, 0.45 * a);
      g.beginPath();
      g.arc(p.x, p.y, r, 0, TAU);
      g.strokePath();
      g.lineStyle(7, f.hp / f.maxHp > 0.33 ? 0x7dffb0 : 0xffd166, 0.95 * a);
      g.beginPath();
      g.arc(p.x, p.y, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(f.hp / f.maxHp, 0, 1));
      g.strokePath();
    }

    const seat = sim.localSeat;
    const energy = s.cfg.energy;
    if (energy && this.cannonBase.visible) {
      const r = 118;
      const from = Math.PI * 1.12;
      const span = Math.PI * 0.76;
      g.lineStyle(16, 0x04283f, 0.6);
      g.beginPath();
      g.arc(seat.x, seat.y, r, from, from + span);
      g.strokePath();
      const ratio = clamp(seat.energy / energy.max, 0, 1);
      g.lineStyle(10, ratio > 0.25 ? 0x62e6ff : 0xffa94d, 1);
      g.beginPath();
      g.arc(seat.x, seat.y, r, from, from + span * ratio);
      g.strokePath();
    }

    if (this.sparks.length > 0) {
      for (const spark of this.sparks) {
        spark.age += dt;
        const a = clamp(1 - spark.age / 0.4, 0, 1);
        this.fx.lightning(g, spark.ax, spark.ay, spark.bx, spark.by, a, spark.seed + Math.floor(spark.age * 30));
      }
      this.sparks = this.sparks.filter((p) => p.age < 0.4);
    }
  }

  private onEvent(e: SimEvent): void {
    const fx = this.fx;
    switch (e.t) {
      case 'net':
        fx.splash(e.x, e.y, 10);
        break;
      case 'pop':
        fx.splash(e.x, e.y, 4);
        break;
      case 'hit':
        fx.sparkles(e.x, e.y, 2);
        break;
      case 'caught': {
        const big = e.points >= 200;
        fx.sparkles(e.x, e.y, big ? 40 : e.points >= 50 ? 18 : 7);
        fx.ring(e.x, e.y, big ? 620 : e.points >= 50 ? 240 : 120, 0xfff2b0);
        fx.popup(e.x, e.y - 20, e.points);
        fx.coins(e.x, e.y, e.coins);
        if (big) {
          fx.flash(0xfff0c0, 0.32);
          fx.shake(380, 0.009);
        } else if (e.points >= 50) {
          fx.shake(160, 0.0035);
        }
        break;
      }
      case 'burst':
        fx.ring(e.x, e.y, e.radius, 0xffe08a, 0.6);
        fx.ring(e.x, e.y, e.radius * 0.7, 0xffffff, 0.45);
        fx.glow(e.x, e.y, e.radius * 0.8, 0xffc36b, 0.5);
        fx.sparkles(e.x, e.y, 34);
        fx.flash(0xfff0c0, 0.25);
        fx.shake(260, 0.006);
        break;
      case 'freeze':
        fx.flash(0xcfefff, 0.3);
        break;
      case 'chain':
        e.targets.forEach((p, i) => {
          const from = i === 0 ? { x: e.x, y: e.y } : e.targets[i - 1]!;
          this.sparks.push({ ax: from.x, ay: from.y, bx: p.x, by: p.y, age: 0, seed: i * 3.7 });
          fx.glow(p.x, p.y, 120, 0x7fd8ff, 0.35);
        });
        break;
      case 'sameKind':
        fx.ring(e.x, e.y, 900, 0xffc6ff, 0.7);
        fx.sparkles(e.x, e.y, 30);
        break;
      case 'laserFilled':
        fx.sparkles(this.sim?.localSeat.x ?? 960, (this.sim?.localSeat.y ?? 1100) - 60, 20);
        break;
      case 'bossPhase':
        fx.ring(e.x, e.y, 520, e.kind === 'ring' ? 0xffe08a : 0x9fe8ff, 0.6);
        fx.splash(e.x, e.y, 30);
        break;
      case 'bubblePopped':
        fx.splash(e.x, e.y, 16);
        fx.sparkles(e.x, e.y, 8);
        fx.coins(e.x, e.y, e.coins);
        break;
      default:
        break;
    }
  }

  destroy(): void {
    this.game.destroy(true);
  }
}
