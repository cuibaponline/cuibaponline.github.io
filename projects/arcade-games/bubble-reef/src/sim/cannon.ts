import { CONFIG } from '../config';
import { angleToPoint, cannonDirX, cannonDirY, clamp, DEG, rotateToward } from './math';
import { touchesCircle } from './hit';
import { DT, helpActive, isVisible, type Bubble, type Fish, type Seat, type SimState } from './state';

const { cannon } = CONFIG;
const AIM_LIMIT = cannon.aimLimitDeg * DEG;
const MUZZLE = 110;

export const clampAim = (angle: number): number => clamp(angle, -AIM_LIMIT, AIM_LIMIT);

export function aimAt(seat: Seat, x: number, y: number): void {
  seat.aimAngle = clampAim(angleToPoint(seat.x, seat.y, x, y));
  seat.aimActive = true;
}

export function findFish(s: SimState, uid: number): Fish | null {
  if (uid === 0) return null;
  for (const f of s.fish) if (f.uid === uid) return f;
  return null;
}

export function fishAt(s: SimState, x: number, y: number): Fish | null {
  let best: Fish | null = null;
  let bestPoints = -1;
  for (const f of s.fish) {
    if (f.state !== 'swim' || !isVisible(s, f)) continue;
    if (touchesCircle(s, f, x, y, 36) && f.def.points > bestPoints) {
      best = f;
      bestPoints = f.def.points;
    }
  }
  return best;
}

function bestTarget(s: SimState): Fish | null {
  let best: Fish | null = null;
  let bestPoints = -1;
  for (const f of s.fish) {
    if (f.state !== 'swim' || f.leaving || !isVisible(s, f, 40)) continue;
    if (f.def.points > bestPoints) {
      best = f;
      bestPoints = f.def.points;
    }
  }
  return best;
}

function setLock(s: SimState, seat: Seat, uid: number): void {
  if (seat.lockUid === uid) return;
  seat.lockUid = uid;
  s.events.push({ t: 'lock', uid });
}

export function toggleLock(s: SimState, seat: Seat): void {
  seat.lockMode = !seat.lockMode;
  if (!seat.lockMode) setLock(s, seat, 0);
}

export function lockAt(s: SimState, seat: Seat, x: number, y: number): boolean {
  const f = fishAt(s, x, y);
  if (!f) return false;
  setLock(s, seat, f.uid);
  return true;
}

function stepLock(s: SimState, seat: Seat): void {
  const target = findFish(s, seat.lockUid);
  if (seat.lockUid !== 0 && (!target || target.state !== 'swim' || !isVisible(s, target))) setLock(s, seat, 0);
  if (seat.lockMode && s.cfg.autoLock && seat.lockUid === 0) {
    const best = bestTarget(s);
    if (best) setLock(s, seat, best.uid);
  }
  const locked = findFish(s, seat.lockUid);
  if (locked) aimAt(seat, locked.x, locked.y);
}

export const laserFill = (s: SimState): number => s.cfg.laserFillPoints;
export const laserReady = (s: SimState, seat: Seat): boolean => s.unlocks.laser && seat.laserMeter >= laserFill(s) && seat.laserT <= 0;

export function addLaserPoints(s: SimState, seat: Seat, points: number): void {
  if (seat.laserT > 0) return;
  const wasReady = seat.laserMeter >= laserFill(s);
  seat.laserMeter = Math.min(laserFill(s), seat.laserMeter + points);
  if (!wasReady && seat.laserMeter >= laserFill(s) && s.unlocks.laser) s.events.push({ t: 'laserReady' });
}

export function setLevel(seat: Seat, level: number): void {
  seat.level = clamp(level, 1, seat.maxLevel);
}

function canShoot(s: SimState): boolean {
  if (s.bubblePop || s.attract) return false;
  return s.phase === 'wave' || s.phase === 'parade' || s.phase === 'boss' || s.phase === 'bossOutro' || s.phase === 'transition';
}

function spawnBubble(s: SimState, seat: Seat, level: number, damageMul: number, angle: number): void {
  const spec = cannon.levels[level - 1]!;
  const b: Bubble = {
    uid: s.nextUid++,
    x: seat.x + cannonDirX(angle) * MUZZLE,
    y: seat.y + cannonDirY(angle) * MUZZLE,
    px: 0,
    py: 0,
    vx: cannonDirX(angle) * cannon.bubble.speed,
    vy: cannonDirY(angle) * cannon.bubble.speed,
    r: cannon.bubble.radius + cannon.bubble.radiusPerLevel * (level - 1),
    level,
    damage: spec.damage * damageMul,
    netRadius: spec.netRadius,
    bounces: s.cfg.ricochets,
    life: cannon.bubble.lifetimeSec,
    lockUid: seat.lockUid,
    seatId: seat.id,
    alive: true,
  };
  b.px = b.x;
  b.py = b.y;
  s.bubbles.push(b);
}

function tryFire(s: SimState, seat: Seat): void {
  if (s.bubbles.length >= cannon.maxBubbles) return;

  let level = seat.level;
  let rate = cannon.fireRate;
  let empty = false;
  const energy = s.cfg.energy;
  if (energy) {
    const cost = cannon.levels[level - 1]!.energyCost;
    if (seat.energy >= cost) {
      seat.energy -= cost;
    } else {
      level = 1;
      rate = energy.emptyFireRate;
      empty = true;
    }
  }
  const help = helpActive(s) ? (s.cfg.adaptiveHelp?.damageMul ?? 1) : 1;
  spawnBubble(s, seat, level, help, seat.aimAngle);
  seat.cooldown = 1 / rate;
  seat.pendingShot = false;
  seat.lastFireTick = s.tick;
  seat.firedEmpty = empty;
  s.stats.shots++;
  s.waveShots++;
  s.events.push({ t: 'fire', seat: seat.id, level, x: seat.x, y: seat.y, angle: seat.aimAngle, empty });
}

export function stepCannons(s: SimState): void {
  for (const seat of s.seats) {
    seat.pangle = seat.angle;
    if (s.cfg.showLevelButtons === false) seat.level = seat.maxLevel;
    stepLock(s, seat);
    seat.angle = rotateToward(seat.angle, seat.aimAngle, cannon.turnRateDegPerSec * DEG * DT);

    const energy = s.cfg.energy;
    if (energy) seat.energy = Math.min(energy.max, seat.energy + energy.regenPerSec * DT);

    if (seat.cooldown > 0) seat.cooldown -= DT;
    if (seat.laserT > 0 || !canShoot(s)) {
      seat.pendingShot = false;
      continue;
    }
    if ((seat.holding || seat.autoFire || seat.pendingShot) && seat.cooldown <= 0) tryFire(s, seat);
  }
}
