import { CONFIG, type Difficulty } from '../config';
import { stepBubbles, stepNets } from './bullets';
import { aimAt, clampAim, laserFill, laserReady, lockAt, setLevel, stepCannons, toggleLock } from './cannon';
import { SpatialGrid } from './collision';
import { beginWave, releaseFish, startSwimAway, stepDirector } from './director';
import { rebuildGrid } from './hit';
import { initBossBody, stepFish } from './motion';
import { refitPath, type Path } from './paths';
import { fireLaser, popBubbleAt, resolveSpecials, stepBubblePop, stepFreeze, stepLaser } from './powerups';
import { Rng } from './rng';
import { helpActive, newSessionStats, TICK_HZ, type Command, type Seat, type SimEvent, type SimState, type Unlocks, type ViewRect } from './state';

export interface SimOptions {
  difficulty: Difficulty;
  seed: number;
  view: ViewRect;
  unlocks: Unlocks;
  attract?: boolean;
  /** One seat unless set to 2. */
  players?: number;
  autoFire?: boolean;
  startLevel?: number;
  oceanIndex?: number;
}

export interface HudSnapshot {
  phase: SimState['phase'];
  wave: number;
  /** 0..1 through the whole wave timeline, with Parade and Boss sections reported separately. */
  waveProgress: number;
  paradeProgress: number;
  isBossWave: boolean;
  bossHp: number;
  bossMaxHp: number;
  bossName: string | null;
  bossTimer: number;
  level: number;
  maxLevel: number;
  energy: number;
  energyMax: number;
  laserRatio: number;
  laserReady: boolean;
  laserActive: boolean;
  lockMode: boolean;
  locked: boolean;
  autoFire: boolean;
  freeze: boolean;
  help: boolean;
  bubblePopLeft: number;
}

/** The first seat has the bottom edge. A second sits across from it on the top edge, for an iPad flat on a table. */
function seatPosition(view: ViewRect, id: number): { x: number; y: number } {
  const inset = view.seatInset ?? 96;
  return { x: view.left + (view.right - view.left) * 0.5, y: id === 0 ? view.bottom - inset : view.top + inset };
}

function newSeat(id: number, view: ViewRect, opts: SimOptions): Seat {
  const pos = seatPosition(view, id);
  const energy = CONFIG.difficulty[opts.difficulty].energy;
  const maxLevel = opts.unlocks.maxCannonLevel;
  return {
    id, x: pos.x, y: pos.y, facing: id === 0 ? 1 : -1, angle: 0, pangle: 0, aimAngle: 0, aimActive: false, holding: false,
    autoFire: opts.autoFire === true, pendingShot: false, cooldown: 0,
    level: Math.min(opts.startLevel ?? maxLevel, maxLevel), maxLevel,
    energy: energy ? energy.max : 0, lockMode: false, lockUid: 0, laserMeter: 0, laserT: 0,
    lastFireTick: -999, firedEmpty: false,
  };
}

/** Keeps every fish at the same place on screen when the view changes shape, so turning the device never empties the sea. */
function refitFish(s: SimState, from: ViewRect, to: ViewRect): void {
  const scaleX = (to.right - to.left) / (from.right - from.left);
  const scaleY = (to.bottom - to.top) / (from.bottom - from.top);
  const mapX = (x: number): number => to.left + (x - from.left) * scaleX;
  const mapY = (y: number): number => to.top + (y - from.top) * scaleY;
  // Fish in a formation share one path.
  const refitted = new Map<Path, Path>();
  for (const f of s.fish) {
    f.x = f.px = mapX(f.x);
    f.y = f.py = mapY(f.y);
    f.waypointX = mapX(f.waypointX);
    f.waypointY = mapY(f.waypointY);
    if (f.path) {
      let path = refitted.get(f.path);
      if (!path) {
        path = refitPath(f.path, from, to);
        refitted.set(f.path, path);
      }
      f.dist *= path.length / (f.path.length || 1);
      f.path = path;
    }
    if (f.isBoss) initBossBody(f);
  }
}

export class Simulation {
  readonly s: SimState;
  private queue: Command[] = [];

  constructor(opts: SimOptions) {
    const cfg = CONFIG.difficulty[opts.difficulty];
    const seats = opts.players === 2 ? 2 : 1;
    this.s = {
      difficulty: opts.difficulty, cfg, rng: new Rng(opts.seed), seed: opts.seed >>> 0, tick: 0,
      attract: opts.attract === true, view: { ...opts.view }, unlocks: opts.unlocks,
      fish: [], bubbles: [], nets: [], seats: Array.from({ length: seats }, (_, id) => newSeat(id, opts.view, opts)),
      phase: 'wave', phaseT: 0, wave: 0, slotsUsed: 0, spawnCooldown: 0, specialT: 0, paradeQueue: [], guestQueue: [],
      oceanIndex: opts.oceanIndex ?? 0, freezeT: 0, noCatchT: 0, pendingSpecials: [], bubblePop: null, boss: null,
      bossTimer: 0, events: [], stats: newSessionStats(), waveShots: 0, waveHits: 0, nextUid: 1,
      grid: new SpatialGrid(200), pool: [],
    };
    beginWave(this.s);
  }

  get tick(): number {
    return this.s.tick;
  }

  get localSeat(): Seat {
    return this.s.seats[0]!;
  }

  enqueue(command: Command): void {
    this.queue.push(command);
  }

  private apply(c: Command): void {
    const s = this.s;
    const seat = s.seats[c.seatId];
    if (!seat) return;
    switch (c.type) {
      case 'Aim':
        if (seat.lockUid === 0) aimAt(seat, c.x, c.y);
        break;
      case 'AimAngle':
        if (seat.lockUid === 0) {
          seat.aimAngle = clampAim(c.angle);
          seat.aimActive = true;
        }
        break;
      case 'FireStart':
        seat.holding = true;
        seat.pendingShot = true;
        break;
      case 'FireStop':
        seat.holding = false;
        break;
      case 'LockTarget':
        lockAt(s, seat, c.x, c.y);
        break;
      case 'ToggleLock':
        toggleLock(s, seat);
        break;
      case 'ToggleAuto':
        seat.autoFire = !seat.autoFire;
        break;
      case 'Laser':
        fireLaser(s, seat.id);
        break;
      case 'LevelUp':
        setLevel(seat, seat.level + 1);
        break;
      case 'LevelDown':
        setLevel(seat, seat.level - 1);
        break;
      case 'PopBubble':
        popBubbleAt(s, c.x, c.y);
        break;
    }
  }

  private applyQueued(): void {
    if (this.queue.length === 0) return;
    const later: Command[] = [];
    for (const c of this.queue) {
      if (c.tick <= this.s.tick) this.apply(c);
      else later.push(c);
    }
    this.queue = later;
  }

  /** One fixed 60 Hz tick. */
  step(): void {
    const s = this.s;
    this.applyQueued();

    const paused = s.bubblePop !== null;
    const frozen = paused || s.freezeT > 0;
    if (paused) stepBubblePop(s);
    else stepDirector(s);

    let write = 0;
    for (const f of s.fish) {
      if (stepFish(s, f, frozen)) s.fish[write++] = f;
      else releaseFish(s, f);
    }
    s.fish.length = write;

    rebuildGrid(s);
    stepCannons(s);
    stepBubbles(s);
    stepNets(s);
    stepLaser(s);
    resolveSpecials(s);
    stepFreeze(s);
    if (!paused) s.noCatchT += 1 / TICK_HZ;
    s.tick++;
  }

  drainEvents(): SimEvent[] {
    const out = this.s.events;
    this.s.events = [];
    return out;
  }

  setView(view: ViewRect): void {
    const from = this.s.view;
    const moved = from.left !== view.left || from.right !== view.right || from.top !== view.top || from.bottom !== view.bottom;
    this.s.view = { ...view };
    if (moved) refitFish(this.s, from, view);
    for (const seat of this.s.seats) {
      const pos = seatPosition(view, seat.id);
      seat.x = pos.x;
      seat.y = pos.y;
    }
  }

  /** Applied live, for level-ups mid-wave. */
  setUnlocks(unlocks: Unlocks): void {
    this.s.unlocks = unlocks;
    for (const seat of this.s.seats) {
      const wasBest = seat.level === seat.maxLevel;
      seat.maxLevel = unlocks.maxCannonLevel;
      if (wasBest) seat.level = seat.maxLevel;
    }
  }

  nextWave(): void {
    beginWave(this.s);
  }

  swimAway(): void {
    startSwimAway(this.s);
  }

  hud(seatId = 0): HudSnapshot {
    const s = this.s;
    const seat = s.seats[seatId] ?? this.localSeat;
    const boss = s.boss;
    const energy = s.cfg.energy;
    return {
      phase: s.phase,
      wave: s.wave,
      waveProgress: s.phase === 'wave' ? Math.min(1, s.phaseT / s.cfg.waveSec) : 1,
      paradeProgress: s.phase === 'parade' ? Math.min(1, s.phaseT / CONFIG.powerups.parade.durationSec) : s.phase === 'wave' ? 0 : 1,
      isBossWave: s.wave % CONFIG.waves.bossEveryWaves === 0,
      bossHp: boss ? boss.hp : 0,
      bossMaxHp: boss ? boss.maxHp : 0,
      bossName: boss ? boss.def.name : null,
      bossTimer: boss ? s.bossTimer : 0,
      level: seat.level,
      maxLevel: seat.maxLevel,
      energy: seat.energy,
      energyMax: energy ? energy.max : 0,
      laserRatio: seat.laserT > 0 ? seat.laserT / CONFIG.powerups.laser.durationSec : seat.laserMeter / laserFill(s),
      laserReady: laserReady(s, seat),
      laserActive: seat.laserT > 0,
      lockMode: seat.lockMode,
      locked: seat.lockUid !== 0,
      autoFire: seat.autoFire,
      freeze: s.freezeT > 0,
      help: helpActive(s),
      bubblePopLeft: s.bubblePop ? s.bubblePop.t : 0,
    };
  }
}
