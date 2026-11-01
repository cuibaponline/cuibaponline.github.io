import { z } from 'zod';
import fishJson from '@config/fish.json';
import bossesJson from '@config/bosses.json';
import specialsJson from '@config/specials.json';
import specialsCommonJson from '@config/specialsCommon.json';
import difficultyJson from '@config/difficulty.json';
import cannonJson from '@config/cannon.json';
import powerupsJson from '@config/powerups.json';
import wavesJson from '@config/waves.json';
import pathsJson from '@config/paths.json';
import progressionJson from '@config/progression.json';

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

const positive = z.number().positive();
const perDifficulty = z.object({ easy: positive, medium: positive, hard: positive });
const hitCircle = z.tuple([z.number(), z.number(), positive]);

const fishSchema = z.object({
  id: z.string().regex(/^F\d\d$/),
  name: z.string().min(1),
  tier: z.enum(['small', 'medium', 'large']),
  size: positive,
  speed: positive,
  hp: perDifficulty,
  points: positive,
  hitCircles: z.array(hitCircle).min(1).max(4),
  spawnWeight: perDifficulty,
  group: z.object({
    min: z.number().int().positive(),
    max: z.number().int().positive(),
    formation: z.enum(['single', 'line', 'school', 'cluster']),
  }),
  behaviours: z.array(z.string()),
  fact: z.string().min(1),
});

const bossSchema = z.object({
  id: z.string().regex(/^B\d\d$/),
  name: z.string().min(1),
  tier: z.literal('boss'),
  size: positive,
  speed: positive,
  hp: perDifficulty,
  points: positive,
  hitCircles: z.array(hitCircle).min(1).max(5),
  behaviours: z.array(z.string()),
  chain: z.object({ segments: z.number().int().positive(), spacing: positive, radius: positive }).optional(),
  fact: z.string().min(1),
});

const specialSchema = z.object({
  id: z.string().regex(/^S\d\d$/),
  name: z.string().min(1),
  tier: z.literal('special'),
  size: positive,
  effect: z.enum(['burst', 'freeze', 'chain', 'sameKind', 'bubblePop', 'laserFill']),
  icon: z.string(),
  hitCircles: z.array(hitCircle).min(1).max(4),
  fact: z.string().min(1),
});

const difficultySchema = z.object({
  fishSpeedMul: positive,
  hitboxScale: positive,
  aimAssistDeg: z.number().min(0),
  ricochets: z.number().int().min(0),
  energy: z.object({ max: positive, regenPerSec: positive, refundRatio: z.number().min(0), emptyFireRate: positive }).nullable(),
  showLevelButtons: z.boolean(),
  autoLock: z.boolean(),
  specialIntervalSec: positive,
  laserFillPoints: positive,
  freezeSec: positive,
  bossTimerSec: positive,
  waveSec: positive,
  maxFishSlots: z.number().int().positive(),
  adaptiveHelp: z.object({ noCatchSec: positive, damageMul: positive, extraAssistDeg: z.number() }).nullable(),
  coinMul: positive,
  armouredFish: z.array(z.string()),
  burstRadius: positive,
  minSmallFish: z.number().int().min(0),
  pathTags: z.array(z.enum(['gentle', 'curve', 'zigzag'])).min(1),
});

const cannonSchema = z.object({
  aimLimitDeg: positive,
  turnRateDegPerSec: positive,
  fireRate: positive,
  maxBubbles: z.number().int().positive(),
  bubble: z.object({
    speed: positive,
    radius: positive,
    radiusPerLevel: z.number().min(0),
    lifetimeSec: positive,
    assistTurnDegPerSec: positive,
    homingTurnDegPerSec: positive,
  }),
  net: z.object({ expandSec: positive, holdSec: positive, fadeSec: positive }),
  levels: z
    .array(
      z.object({
        level: z.number().int().positive(),
        damage: positive,
        netRadius: positive,
        energyCost: z.number().min(0),
        barrels: z.number().int().positive(),
        glow: z.number().min(0),
      }),
    )
    .length(5),
});

const powerupsSchema = z.object({
  laser: z.object({ durationSec: positive, width: positive, dps: positive }),
  armour: z.object({ damageMul: positive, untilHpRatio: positive }),
  puff: z.object({ hitboxMul: positive, durationSec: positive }),
  hpRing: z.object({ minHp: positive, showSec: positive }),
  burst: z.object({ damage: positive }),
  chain: z.object({ targets: z.number().int().positive(), damage: positive }),
  bubblePop: z.object({ durationSec: positive, coinsEach: positive, spawnEverySec: positive, riseSpeed: positive, radius: positive }),
  boss: z.object({
    whaleRingCount: z.number().int().positive(),
    whaleRingFish: z.string(),
    dragonDiveAt: z.array(positive),
    dragonDiveSec: positive,
    escorts: z.object({ count: z.number().int().min(0), fish: z.string(), orbit: positive }),
  }),
  parade: z.object({ durationSec: positive, speedMul: positive, pointsMul: positive }),
  swimAway: z.object({ durationSec: positive, speed: positive }),
  lastCatchSec: positive,
  twoPlayer: z.object({ bossHpMul: positive }),
});

const wavesSchema = z.object({
  spawnOutsideU: positive,
  bossEveryWaves: z.number().int().positive(),
  density: z.object({ startRatio: positive, rampEndRatio: positive }),
  tierMix: z.object({ small: positive, medium: positive, large: positive }),
  tierSlots: z.object({ small: positive, medium: positive, large: positive, boss: positive, special: positive }),
  specialJitter: z.number().min(0).max(1),
  intermissionSec: positive,
  parade: z.array(
    z.object({
      at: z.number().min(0),
      formation: z.enum(['line', 'vee', 'ring']),
      fish: z.string(),
      count: z.number().int().positive(),
      gap: positive,
      lane: z.number().min(0).max(1),
      reverse: z.boolean().optional(),
    }),
  ),
});

const pathsSchema = z.array(
  z.object({
    id: z.string(),
    tag: z.enum(['gentle', 'curve', 'zigzag']),
    points: z.array(z.tuple([z.number(), z.number()])).min(2),
  }),
);

const progressionSchema = z.object({
  levels: z
    .array(
      z.object({
        level: z.number().int().positive(),
        xp: z.number().min(0),
        maxCannonLevel: z.number().int().min(1).max(5),
        oceans: z.array(z.string()),
        specials: z.array(z.string()),
        bosses: z.array(z.string()),
        features: z.array(z.string()),
        skins: z.array(z.string()),
      }),
    )
    .min(1),
  xpPerLevelAfter10: positive,
  badges: z.object({ bronze: positive, silver: positive, gold: positive }),
  skins: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      price: z.number().min(0),
      how: z.enum(['default', 'level', 'coins', 'fishbook']),
      level: z.number().optional(),
    }),
  ),
  oceans: z.array(z.object({ id: z.string(), name: z.string(), bias: z.record(z.string(), z.number()) })),
  suggestMedium: z.object({ afterEasyWaves: positive, minCatchRate: positive }),
});

const specialCommonSchema = z.object({ hp: perDifficulty, points: positive, speed: positive });

export type FishDefRaw = z.infer<typeof fishSchema>;
export type DifficultyConfig = z.infer<typeof difficultySchema>;
export type CannonConfig = z.infer<typeof cannonSchema>;
export type PowerupsConfig = z.infer<typeof powerupsSchema>;
export type WavesConfig = z.infer<typeof wavesSchema>;
export type PathConfig = z.infer<typeof pathsSchema>[number];
export type ProgressionConfig = z.infer<typeof progressionSchema>;
export type ParadeEntry = WavesConfig['parade'][number];
export type SpecialEffect = z.infer<typeof specialSchema>['effect'];
export type Tier = 'small' | 'medium' | 'large' | 'boss' | 'special';

/** One shape for every swimming thing, so the simulation has a single code path. */
export interface CreatureDef {
  id: string;
  name: string;
  tier: Tier;
  size: number;
  speed: number;
  hp: Record<Difficulty, number>;
  points: number;
  hitCircles: [number, number, number][];
  behaviours: string[];
  fact: string;
  spawnWeight?: Record<Difficulty, number>;
  group?: FishDefRaw['group'];
  effect?: SpecialEffect;
  icon?: string;
  chain?: { segments: number; spacing: number; radius: number };
}

export interface GameConfig {
  fish: CreatureDef[];
  bosses: CreatureDef[];
  specials: CreatureDef[];
  creatures: Map<string, CreatureDef>;
  difficulty: Record<Difficulty, DifficultyConfig>;
  cannon: CannonConfig;
  powerups: PowerupsConfig;
  waves: WavesConfig;
  paths: PathConfig[];
  progression: ProgressionConfig;
}

export function parseConfig(): GameConfig {
  const fish = z.array(fishSchema).length(12).parse(fishJson) as CreatureDef[];
  const bosses = z.array(bossSchema).length(2).parse(bossesJson) as CreatureDef[];
  const common = specialCommonSchema.parse(specialsCommonJson);
  const specials: CreatureDef[] = z
    .array(specialSchema)
    .length(6)
    .parse(specialsJson)
    .map((s) => ({ ...s, ...common, behaviours: ['gentle'], hitCircles: s.hitCircles as [number, number, number][] }));

  const creatures = new Map<string, CreatureDef>();
  for (const def of [...fish, ...bosses, ...specials]) creatures.set(def.id, def);

  const waves = wavesSchema.parse(wavesJson);
  for (const entry of waves.parade) {
    if (!creatures.has(entry.fish)) throw new Error(`waves.json: unknown parade fish ${entry.fish}`);
  }
  const powerups = powerupsSchema.parse(powerupsJson);
  for (const id of [powerups.boss.whaleRingFish, powerups.boss.escorts.fish]) {
    if (!creatures.has(id)) throw new Error(`powerups.json: unknown fish ${id}`);
  }

  return {
    fish,
    bosses,
    specials,
    creatures,
    difficulty: z.object({ easy: difficultySchema, medium: difficultySchema, hard: difficultySchema }).parse(difficultyJson),
    cannon: cannonSchema.parse(cannonJson),
    powerups,
    waves,
    paths: pathsSchema.parse(pathsJson),
    progression: progressionSchema.parse(progressionJson),
  };
}

export const CONFIG: GameConfig = parseConfig();

export function creature(id: string): CreatureDef {
  const def = CONFIG.creatures.get(id);
  if (!def) throw new Error(`Unknown creature ${id}`);
  return def;
}
