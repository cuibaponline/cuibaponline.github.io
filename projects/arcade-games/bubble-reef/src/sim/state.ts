import type { CreatureDef, Difficulty, DifficultyConfig, GuestEntry, ParadeEntry, SpecialEffect } from '../config';
import { SpatialGrid } from './collision';
import type { Path } from './paths';
import type { Rng } from './rng';

export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;

export const CORE_W = 1920;
export const CORE_H = 1280;

export interface ViewRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** How far the cannon sits above the bottom edge. Compact screens raise it clear of the home indicator. */
  seatInset?: number;
  /** World-unit forgiveness when tapping a fish to lock on, so a small fish on a phone is still a fair target. */
  tapSlop?: number;
}

export type Phase = 'wave' | 'parade' | 'transition' | 'boss' | 'bossOutro' | 'waveComplete' | 'wrapUp' | 'ended';
export type FishState = 'swim' | 'dive' | 'caught';

export interface Fish {
  uid: number;
  def: CreatureDef;
  state: FishState;
  x: number;
  y: number;
  px: number;
  py: number;
  heading: number;
  pheading: number;
  /** +1 art faces right, -1 faces left; for upright creatures. */
  face: number;
  /** Turned round to suit the far player, because it is on their half of the sea. */
  turned: boolean;
  /** Size as a multiple of its def, for a whale that grows from wave to wave. */
  scale: number;
  hp: number;
  maxHp: number;
  armoured: boolean;
  parade: boolean;
  slots: number;
  path: Path | null;
  dist: number;
  speed: number;
  /** Multiplier for rush-offs at the end of a wave. */
  rush: number;
  /** Formation offset, perpendicular to the path. */
  lateral: number;
  phase: number;
  age: number;
  burstSpeed: boolean;
  /** Counts down, seconds. */
  flash: number;
  hpRing: number;
  puff: number;
  caughtAge: number;
  /** Set for the seat that made the catch's animation; also used to fade dives. */
  diveT: number;
  isBoss: boolean;
  /** Boss roaming. */
  waypointX: number;
  waypointY: number;
  thresholds: number[];
  /** Dragon body: head history, sampled into chain positions. */
  trailX: number[];
  trailY: number[];
  chainX: number[];
  chainY: number[];
  escortOf: number;
  orbitAngle: number;
  orbitRadius: number;
  /** Last time this fish was flashed by the laser, to throttle feedback. */
  beamHitTick: number;
  /** Who gets the credit if this fish is caught. */
  lastHitSeat: number;
  /** Fish is leaving for good and is no longer spawn-budgeted. */
  leaving: boolean;
}

export interface Bubble {
  uid: number;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  r: number;
  level: number;
  damage: number;
  netRadius: number;
  bounces: number;
  life: number;
  lockUid: number;
  seatId: number;
  alive: boolean;
}

export interface Net {
  x: number;
  y: number;
  radius: number;
  age: number;
  level: number;
  damage: number;
  applied: boolean;
  lockUid: number;
  seatId: number;
}

export interface Seat {
  id: number;
  x: number;
  y: number;
  /** +1 shoots up the screen, -1 down it. Angles are from the seat's own forward, so its left stays its own left. */
  facing: 1 | -1;
  angle: number;
  pangle: number;
  aimAngle: number;
  aimActive: boolean;
  /** True while a finger is holding fire. */
  holding: boolean;
  autoFire: boolean;
  /** Fire one shot on the next tick even if the finger already lifted. */
  pendingShot: boolean;
  cooldown: number;
  level: number;
  maxLevel: number;
  energy: number;
  lockMode: boolean;
  lockUid: number;
  laserMeter: number;
  laserT: number;
  lastFireTick: number;
  firedEmpty: boolean;
}

export interface PopBubble {
  uid: number;
  x: number;
  y: number;
  px: number;
  py: number;
  r: number;
  wobble: number;
}

export interface BubblePopState {
  t: number;
  spawnT: number;
  bubbles: PopBubble[];
  popped: number;
}

export interface SessionStats {
  shots: number;
  hits: number;
  caught: number;
  caughtBySeat: number[];
  points: number;
  coins: number;
  bossesCaught: number;
  wavesCompleted: number;
  byFish: Record<string, number>;
}

export interface Unlocks {
  specials: string[];
  bosses: string[];
  oceans: string[];
  laser: boolean;
  maxCannonLevel: number;
}

export type SimEvent =
  | { t: 'fire'; seat: number; level: number; x: number; y: number; angle: number; empty: boolean }
  | { t: 'net'; x: number; y: number; radius: number; level: number }
  | { t: 'pop'; x: number; y: number }
  | { t: 'hit'; uid: number; x: number; y: number }
  | { t: 'caught'; uid: number; id: string; x: number; y: number; points: number; coins: number; parade: boolean }
  | { t: 'specialAppear'; id: string }
  | { t: 'burst'; x: number; y: number; radius: number }
  | { t: 'freeze'; sec: number }
  | { t: 'freezeEnd' }
  | { t: 'chain'; x: number; y: number; targets: { x: number; y: number }[] }
  | { t: 'sameKind'; id: string; x: number; y: number }
  | { t: 'laserFilled' }
  | { t: 'laserReady' }
  | { t: 'laserStart'; seat: number }
  | { t: 'laserEnd'; seat: number }
  | { t: 'lock'; uid: number }
  | { t: 'phase'; phase: Phase; wave: number }
  | { t: 'paradeStart' }
  | { t: 'oceanChange'; ocean: string }
  | { t: 'bossSpawn'; id: string }
  | { t: 'bossEnd'; id: string; caught: boolean }
  | { t: 'bossPhase'; id: string; kind: 'ring' | 'dive' | 'surface'; x: number; y: number }
  | { t: 'waveComplete'; wave: number; shots: number; hits: number }
  | { t: 'bubblePopStart' }
  | { t: 'bubblePopEnd'; popped: number; coins: number }
  | { t: 'bubblePopped'; x: number; y: number; coins: number };

export type Command =
  | { tick: number; seatId: number; type: 'Aim'; x: number; y: number }
  | { tick: number; seatId: number; type: 'AimAngle'; angle: number }
  | { tick: number; seatId: number; type: 'FireStart' }
  | { tick: number; seatId: number; type: 'FireStop' }
  | { tick: number; seatId: number; type: 'LockTarget'; x: number; y: number }
  | { tick: number; seatId: number; type: 'ToggleLock' }
  | { tick: number; seatId: number; type: 'ToggleAuto' }
  | { tick: number; seatId: number; type: 'Laser' }
  | { tick: number; seatId: number; type: 'LevelUp' }
  | { tick: number; seatId: number; type: 'LevelDown' }
  | { tick: number; seatId: number; type: 'PopBubble'; x: number; y: number };

export interface SimState {
  difficulty: Difficulty;
  cfg: DifficultyConfig;
  rng: Rng;
  seed: number;
  tick: number;
  attract: boolean;
  view: ViewRect;
  unlocks: Unlocks;
  fish: Fish[];
  bubbles: Bubble[];
  nets: Net[];
  seats: Seat[];
  phase: Phase;
  phaseT: number;
  wave: number;
  slotsUsed: number;
  spawnCooldown: number;
  specialT: number;
  paradeQueue: ParadeEntry[];
  guestQueue: GuestEntry[];
  oceanIndex: number;
  freezeT: number;
  noCatchT: number;
  /** Special fish caught this tick, resolved after hit resolution so effects never recurse. */
  pendingSpecials: { effect: SpecialEffect; x: number; y: number; seat: number }[];
  bubblePop: BubblePopState | null;
  boss: Fish | null;
  bossTimer: number;
  events: SimEvent[];
  stats: SessionStats;
  waveShots: number;
  waveHits: number;
  nextUid: number;
  grid: SpatialGrid<Fish>;
  pool: Fish[];
}

export function newSessionStats(): SessionStats {
  return { shots: 0, hits: 0, caught: 0, caughtBySeat: [0, 0], points: 0, coins: 0, bossesCaught: 0, wavesCompleted: 0, byFish: {} };
}

export const isVisible = (s: SimState, f: Fish, margin = 0): boolean =>
  f.x >= s.view.left + margin && f.x <= s.view.right - margin && f.y >= s.view.top + margin && f.y <= s.view.bottom - margin;

export const isCatchable = (f: Fish): boolean => f.state === 'swim';

/** Easy's adaptive help: after a dry spell shots hit harder and bubbles curve more, until the next catch. */
export function helpActive(s: SimState): boolean {
  const help = s.cfg.adaptiveHelp;
  return help !== null && s.noCatchT >= help.noCatchSec;
}

/** Creatures that stay upright (mirrors src/art facing), so their circles do not rotate with the heading. */
const UPRIGHT = new Set(['F04', 'F07', 'F11', 'S02', 'S04', 'S05']);
export const isUpright = (id: string): boolean => UPRIGHT.has(id);
