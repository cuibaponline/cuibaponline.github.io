import Phaser from 'phaser';
import * as art from '../art';
import type { CannonBake, CannonSkinId, DigitStyle, FacingMode, FxId, OceanBake, OceanId, Sheet, SpriteId } from '../art/types';

export const SPRITE_PPU = 1.25;
export const OCEAN_PPU = 0.8;
const OCEAN_W = 2300;
const OCEAN_H = 1560;

export const SPRITE_IDS: SpriteId[] = [
  'F01', 'F02', 'F03', 'F04', 'F05', 'F05_puffed', 'F06', 'F07', 'F08', 'F09', 'F10', 'F11', 'F12', 'F13', 'F14', 'F15', 'F16',
  'S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'B01', 'B02', 'B02_segment', 'B02_tail',
];

const FX_IDS: FxId[] = [
  'bubble', 'net', 'coin', 'sparkle', 'softDot', 'trail', 'lockRing', 'hitRing', 'catchBubble', 'beamCore', 'beamGlow', 'beamGlowRed',
  'shellBadge', 'aura', 'popBubble', 'iconBurst', 'iconSnow', 'iconSpark', 'iconRainbow', 'iconChest', 'iconBeam',
  'frost', 'vignette', 'lightRay',
];

export interface SheetInfo {
  key: string;
  shadowKey: string;
  frames: number;
  fps: number;
  facing: FacingMode;
  originX: number;
  originY: number;
  scale: number;
}

export interface OceanTextures {
  seabed: string;
  midground: string;
  bake: Omit<OceanBake, 'seabed' | 'midground'>;
}

export interface CannonTextures {
  base: string;
  barrels: string[];
  pivotX: number;
  pivotY: number;
  scale: number;
}

const DIGIT_CHARS = '0123456789+';

/**
 * GL holds its own copy once a canvas is uploaded. Shrinking the canvas gives its memory back, which matters on
 * iPadOS where total canvas memory is capped. A lost WebGL context reloads the page rather than re-uploading (see world.ts).
 */
function freeCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 1;
  canvas.height = 1;
}

/** Bakes procedural art and uploads it as Phaser textures. */
export class Assets {
  readonly sheets = new Map<SpriteId, SheetInfo>();
  readonly digitAdvance = new Map<DigitStyle, number[]>();
  readonly digitHeight = 72;
  private readonly oceans = new Map<OceanId, OceanTextures>();
  private readonly cannons = new Map<CannonSkinId, CannonTextures>();

  constructor(private readonly scene: Phaser.Scene) {}

  private addCanvas(key: string, canvas: HTMLCanvasElement): void {
    const textures = this.scene.textures;
    if (textures.exists(key)) textures.remove(key);
    // Not addCanvas: a CanvasTexture keeps a full ImageData copy of itself on the JS heap for as long as it lives.
    textures.create(key, canvas, canvas.width, canvas.height)?.add('__BASE', 0, 0, 0, canvas.width, canvas.height);
  }

  private addSheet(id: SpriteId, sheet: Sheet): void {
    const key = `sprite_${id}`;
    this.addCanvas(key, sheet.canvas);
    const texture = this.scene.textures.get(key);
    for (let i = 0; i < sheet.frames; i++) {
      const col = i % sheet.columns;
      const row = Math.floor(i / sheet.columns);
      texture.add(i, 0, col * sheet.frameWidth, row * sheet.frameHeight, sheet.frameWidth, sheet.frameHeight);
    }
    const shadowKey = `shadow_${id}`;
    const shadow = art.bakeShadow(id, sheet.ppu);
    this.addCanvas(shadowKey, shadow);
    freeCanvas(shadow);
    this.sheets.set(id, {
      key,
      shadowKey,
      frames: sheet.frames,
      fps: sheet.fps,
      facing: sheet.facing,
      originX: sheet.originX / sheet.frameWidth,
      originY: sheet.originY / sheet.frameHeight,
      scale: 1 / sheet.ppu,
    });
    freeCanvas(sheet.canvas);
  }

  /** One unit of boot work per call, so the caller can yield between them and keep the progress bar moving. */
  bootSteps(): (() => void)[] {
    const steps: (() => void)[] = SPRITE_IDS.map((id) => () => this.addSheet(id, art.bakeSprite(id, SPRITE_PPU)));
    steps.push(() => {
      const fx = art.bakeFx(1);
      for (const id of FX_IDS) {
        this.addCanvas(`fx_${id}`, fx[id]);
        freeCanvas(fx[id]);
      }
    });
    steps.push(() => {
      const size = 512;
      // Not freed: Phaser's Shader re-uploads its channel textures from the source canvas when it binds them.
      this.addCanvas('caustics', art.bakeCausticsTile(size));
    });
    for (const style of ['white', 'yellow', 'orange', 'rainbow'] as DigitStyle[]) {
      steps.push(() => {
        const atlas = art.bakeDigits(style, this.digitHeight);
        const key = `digits_${style}`;
        this.addCanvas(key, atlas.canvas);
        const texture = this.scene.textures.get(key);
        for (let i = 0; i < DIGIT_CHARS.length; i++) texture.add(i, 0, i * atlas.cellWidth, 0, atlas.cellWidth, atlas.cellHeight);
        this.digitAdvance.set(style, atlas.advance);
        freeCanvas(atlas.canvas);
      });
    }
    return steps;
  }

  ocean(id: OceanId): OceanTextures {
    const known = this.oceans.get(id);
    if (known) return known;
    const { seabed, midground, ...bake } = art.bakeOcean(id, OCEAN_W, OCEAN_H, OCEAN_PPU);
    const textures: OceanTextures = { seabed: `seabed_${id}`, midground: `midground_${id}`, bake };
    this.addCanvas(textures.seabed, seabed);
    this.addCanvas(textures.midground, midground);
    freeCanvas(seabed);
    freeCanvas(midground);
    this.oceans.set(id, textures);
    return textures;
  }

  /** Oceans are the largest textures here, at 17.5 MB each, so only the ones in use stay on the GPU. */
  evictOceans(keep: (id: OceanId, textures: OceanTextures) => boolean): void {
    for (const [id, textures] of this.oceans) {
      if (keep(id, textures)) continue;
      this.scene.textures.remove(textures.seabed);
      this.scene.textures.remove(textures.midground);
      this.oceans.delete(id);
    }
  }

  cannon(skin: CannonSkinId): CannonTextures {
    const known = this.cannons.get(skin);
    if (known) return known;
    const bake: CannonBake = art.bakeCannon(skin, SPRITE_PPU);
    const textures: CannonTextures = {
      base: `cannon_${skin}_base`,
      barrels: bake.barrels.map((_, i) => `cannon_${skin}_barrel${i + 1}`),
      pivotX: 0.5,
      pivotY: 0.5,
      scale: 1 / bake.ppu,
    };
    this.addCanvas(textures.base, bake.base);
    bake.barrels.forEach((canvas, i) => {
      const key = textures.barrels[i]!;
      textures.pivotX = bake.barrelPivot.x / canvas.width;
      textures.pivotY = bake.barrelPivot.y / canvas.height;
      this.addCanvas(key, canvas);
      freeCanvas(canvas);
    });
    freeCanvas(bake.base);
    this.cannons.set(skin, textures);
    return textures;
  }
}
