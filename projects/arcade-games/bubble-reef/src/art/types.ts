// Contract between the procedural art module (src/art) and the renderer / DOM UI (src/render, src/ui).

export type FishId = 'F01' | 'F02' | 'F03' | 'F04' | 'F05' | 'F06' | 'F07' | 'F08' | 'F09' | 'F10' | 'F11' | 'F12';
export type BossId = 'B01' | 'B02';
export type SpecialId = 'S01' | 'S02' | 'S03' | 'S04' | 'S05' | 'S06';
export type CreatureId = FishId | BossId | SpecialId;

/** Sprites that are not creatures of their own: the puffed pufferfish and the Coral Dragon's body parts. */
export type ExtraSpriteId = 'F05_puffed' | 'B02_segment' | 'B02_tail';
export type SpriteId = CreatureId | ExtraSpriteId;

export type OceanId = 'coral' | 'kelp' | 'ship' | 'glow' | 'arctic';
export type SkinId = 'classic' | 'seashell' | 'coral' | 'submarine' | 'rainbow' | 'robotcrab' | 'golden';
export type OttoPose = 'idle' | 'cheer' | 'sleep' | 'point';
export type DigitStyle = 'white' | 'yellow' | 'orange' | 'rainbow';

/**
 * How a sprite follows its heading. Art is always drawn facing +x (right).
 * - 'side': side-on fish. Rotates to the heading; the renderer flips it so the eye stays on top.
 * - 'top': seen from above (turtle, manta). Rotates freely, never flipped.
 * - 'upright': stays upright (seahorse, jellyfish, octopus, crab, starfish). Mirrored left/right only.
 */
export type FacingMode = 'side' | 'top' | 'upright';

export interface Sheet {
  canvas: HTMLCanvasElement;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  columns: number;
  /** Pixels per design unit this sheet was baked at. */
  ppu: number;
  /** Pixel offset inside a frame where the simulation's (x, y) sits. */
  originX: number;
  originY: number;
  /** Frames per second at normal swim speed. */
  fps: number;
  facing: FacingMode;
}

export type FxId =
  | 'bubble' // glossy player bubble, ~64 px across at ppu 1
  | 'net' // web-like net, unit diameter 256 px, renderer scales it
  | 'coin' // friendly shell-stamped coin (no casino look), 48 px
  | 'sparkle' // 4-point star, 32 px
  | 'softDot' // round soft white dot, 32 px, for tinted particles
  | 'trail' // tiny soft bubble, 16 px
  | 'lockRing' // golden targeting ring, 256 px
  | 'hitRing' // thin white shock ring, 128 px
  | 'catchBubble' // big bubble a caught fish spins inside, 256 px
  | 'beamCore' // laser beam, tiles along +x: 64 x 64, white core
  | 'beamGlow' // laser beam glow, 64 x 64
  | 'shellBadge' // armour shell badge, 64 px
  | 'aura' // special fish sparkle aura, 256 px
  | 'popBubble' // Bubble Pop bonus bubble, 160 px
  | 'iconBurst' | 'iconSnow' | 'iconSpark' | 'iconRainbow' | 'iconChest' | 'iconBeam' // 96 px icon bubbles
  | 'frost' // vignette frost overlay, stretched to the view, 512 x 512
  | 'vignette' // soft dark corners, stretched to the view, 512 x 512
  | 'lightRay'; // soft vertical light shaft, 128 x 512

export interface OceanBake {
  /** Opaque full-view seabed. */
  seabed: HTMLCanvasElement;
  /** Transparent rocks, coral and kelp above the seabed. */
  midground: HTMLCanvasElement;
  /** Tint for the caustics overlay, as 0xRRGGBB. */
  causticTint: number;
  /** 0..1 strength for the caustics overlay. */
  causticStrength: number;
  /** Tint for ambient rising bubbles, as 0xRRGGBB. */
  bubbleTint: number;
  /** CSS colour used behind the canvas while this ocean loads. */
  backdrop: string;
}

export interface CannonBake {
  base: HTMLCanvasElement;
  /** One barrel image per cannon level, index 0 is level 1. Barrel points up (-y). */
  barrels: HTMLCanvasElement[];
  /** Pixel pivot inside each barrel image (where it meets the base). */
  barrelPivot: { x: number; y: number };
  ppu: number;
}

export interface DigitAtlas {
  canvas: HTMLCanvasElement;
  /** Characters in order: "0123456789+". Laid out in one row. */
  cellWidth: number;
  cellHeight: number;
  /** Advance width for each char, in px, same order. */
  advance: number[];
}

/** Everything src/art/index.ts must export. */
export interface ArtApi {
  bakeSprite(id: SpriteId, ppu: number): Sheet;
  /** One soft, blurred dark silhouette, for the drop shadow on the seabed. Black on transparent. */
  bakeShadow(id: SpriteId, ppu: number): HTMLCanvasElement;
  /** Draw one creature to any 2D context at any size, for the Fish Book. (x, y) is its centre, `size` fits its long axis. */
  drawCreature(
    ctx: CanvasRenderingContext2D,
    id: CreatureId,
    x: number,
    y: number,
    size: number,
    opts?: { silhouette?: boolean; phase?: number },
  ): void;
  bakeOcean(id: OceanId, widthU: number, heightU: number, ppu: number): OceanBake;
  /** Greyscale, seamlessly tiling, power-of-two caustics pattern on black. */
  bakeCausticsTile(size: number): HTMLCanvasElement;
  bakeCannon(skin: SkinId, ppu: number): CannonBake;
  /** (x, y) is the centre of the base; `size` is the base width in px. */
  drawCannonPreview(ctx: CanvasRenderingContext2D, skin: SkinId, level: number, x: number, y: number, size: number): void;
  bakeFx(ppu: number): Record<FxId, HTMLCanvasElement>;
  bakeDigits(style: DigitStyle, heightPx: number): DigitAtlas;
  /** (x, y) is bottom-centre, `height` is the total height. `t` is seconds, for gentle idle motion. */
  drawOtto(ctx: CanvasRenderingContext2D, pose: OttoPose, x: number, y: number, height: number, t?: number): void;
  /** Full-bleed square app icon. */
  drawAppIcon(ctx: CanvasRenderingContext2D, size: number): void;
}
