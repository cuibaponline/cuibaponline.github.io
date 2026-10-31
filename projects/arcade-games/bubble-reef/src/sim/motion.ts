import { CONFIG } from '../config';
import { DEG, rotateToward } from './math';
import { samplePath, straightPath, type PathSample } from './paths';
import { DT, isUpright, type Fish, type SimState } from './state';

const sample: PathSample = { x: 0, y: 0, tx: 1, ty: 0 };

/** Behaviour-driven speed multiplier. Jet is a 0.5 s pause then a 0.5 s dash. */
function behaviourSpeed(f: Fish): number {
  let mul = 1;
  for (const b of f.def.behaviours) {
    if (b === 'jet') mul *= (f.age + f.phase) % 1 < 0.5 ? 0.12 : 1.88;
    else if (b === 'pulse') mul *= 0.45 + 1.1 * Math.max(0, Math.sin((f.age + f.phase) * 2.6));
  }
  if (f.burstSpeed) mul *= 1 + 0.7 * Math.max(0, Math.sin((f.age + f.phase) * 1.4) - 0.6) * 2.5;
  return mul;
}

/** Side-to-side offset on top of the formation offset. */
function behaviourLateral(f: Fish): number {
  const t = f.age + f.phase;
  let off = 0;
  for (const b of f.def.behaviours) {
    if (b === 'wavy') off += Math.sin(t * 3.2) * 16;
    else if (b === 'gentle') off += Math.sin(t * 1.5) * 10;
    else if (b === 'slowTurn') off += Math.sin(t * 0.9) * 14;
    else if (b === 'wideArc') off += Math.sin(t * 0.55) * 70;
    else if (b === 'patrol') off += Math.sin(t * 0.8) * 16;
    else if (b === 'glide') off += Math.sin(t * 0.7) * 10;
  }
  return off;
}

const TURN_RATE: Record<string, number> = { slowTurn: 70, wideArc: 60, patrol: 110, glide: 80 };

function turnRate(f: Fish): number {
  for (const b of f.def.behaviours) {
    const rate = TURN_RATE[b];
    if (rate !== undefined) return rate * DEG;
  }
  return 240 * DEG;
}

function pointHeading(f: Fish, dx: number, dy: number): void {
  if (dx * dx + dy * dy < 1e-4) return;
  if (isUpright(f.def.id)) {
    if (dx > 0.05) f.face = 1;
    else if (dx < -0.05) f.face = -1;
  }
  f.heading = rotateToward(f.heading, Math.atan2(dy, dx), turnRate(f) * DT);
}

function stepPathFish(f: Fish): void {
  const path = f.path;
  if (!path) return;
  f.dist += f.speed * behaviourSpeed(f) * f.rush * DT;
  samplePath(path, f.dist, sample);
  const off = f.lateral + behaviourLateral(f);
  let x = sample.x - sample.ty * off;
  let y = sample.y + sample.tx * off;
  if (f.def.behaviours.includes('bob')) y += Math.sin((f.age + f.phase) * 2.2) * 34;
  pointHeading(f, x - f.x, y - f.y);
  f.x = x;
  f.y = y;
}

function stepEscort(s: SimState, f: Fish): void {
  const boss = s.boss;
  if (!boss || boss.uid !== f.escortOf) {
    // The boss has gone: scatter straight out.
    const out = Math.atan2(f.y - 640, f.x - 960);
    f.path = straightPath(f.x, f.y, f.x + Math.cos(out) * 2600, f.y + Math.sin(out) * 2600);
    f.dist = 0;
    f.lateral = 0;
    f.escortOf = 0;
    f.rush = Math.max(f.rush, 2);
    return;
  }
  f.orbitAngle += 0.55 * DT;
  const x = boss.x + Math.cos(f.orbitAngle) * f.orbitRadius;
  const y = boss.y + Math.sin(f.orbitAngle) * f.orbitRadius * 0.7;
  pointHeading(f, x - f.x, y - f.y);
  f.x = x;
  f.y = y;
}

function pickWaypoint(s: SimState, f: Fish): void {
  const v = s.view;
  f.waypointX = s.rng.range(v.left + 360, v.right - 360);
  f.waypointY = s.rng.range(v.top + 300, v.bottom - 460);
}

function stepBoss(s: SimState, f: Fish): void {
  const dragon = f.def.chain !== undefined;

  if (f.state === 'dive') {
    f.diveT -= DT;
    if (f.diveT <= 0) {
      pickWaypoint(s, f);
      f.state = 'swim';
      f.x = f.waypointX;
      f.y = f.waypointY;
      f.px = f.x;
      f.py = f.y;
      resetTrail(f);
      pickWaypoint(s, f);
      s.events.push({ t: 'bossPhase', id: f.def.id, kind: 'surface', x: f.x, y: f.y });
    }
    return;
  }

  let v = f.speed * f.rush;
  if (f.leaving) {
    const toX = f.x < (s.view.left + s.view.right) / 2 ? s.view.left - 900 : s.view.right + 900;
    f.heading = rotateToward(f.heading, Math.atan2(0, toX - f.x), 90 * DEG * DT);
  } else {
    const onStage = f.x > s.view.left + 240 && f.x < s.view.right - 240;
    if (!onStage) v = Math.max(v, 240);
    const toWp = Math.atan2(f.waypointY - f.y, f.waypointX - f.x);
    let desired = toWp;
    if (dragon) desired += Math.sin(f.age * 1.3) * 0.75;
    f.heading = rotateToward(f.heading, desired, (dragon ? 70 : 34) * DEG * DT);
    if (Math.hypot(f.waypointX - f.x, f.waypointY - f.y) < 140) pickWaypoint(s, f);
  }
  f.x += Math.cos(f.heading) * v * DT;
  f.y += Math.sin(f.heading) * v * DT;
  if (dragon) updateChain(f);
}

function resetTrail(f: Fish): void {
  const chain = f.def.chain;
  if (!chain) return;
  f.trailX.length = 0;
  f.trailY.length = 0;
  const backX = -Math.cos(f.heading);
  const backY = -Math.sin(f.heading);
  const steps = Math.ceil((chain.segments * chain.spacing) / 8) + 4;
  for (let i = 0; i < steps; i++) {
    f.trailX.push(f.x + backX * i * 8);
    f.trailY.push(f.y + backY * i * 8);
  }
  updateChain(f);
}

function updateChain(f: Fish): void {
  const chain = f.def.chain;
  if (!chain) return;
  const dx = f.x - (f.trailX[0] ?? f.x);
  const dy = f.y - (f.trailY[0] ?? f.y);
  if (dx * dx + dy * dy >= 64) {
    f.trailX.unshift(f.x);
    f.trailY.unshift(f.y);
    f.trailX.pop();
    f.trailY.pop();
  }
  const perSegment = Math.round(chain.spacing / 8);
  for (let i = 0; i < chain.segments; i++) {
    const idx = Math.min(f.trailX.length - 1, (i + 1) * perSegment);
    f.chainX[i] = f.trailX[idx] ?? f.x;
    f.chainY[i] = f.trailY[idx] ?? f.y;
  }
}

export function initBossBody(f: Fish): void {
  resetTrail(f);
}

export function beginDive(s: SimState, f: Fish): void {
  f.state = 'dive';
  f.diveT = CONFIG.powerups.boss.dragonDiveSec;
  s.events.push({ t: 'bossPhase', id: f.def.id, kind: 'dive', x: f.x, y: f.y });
}

export const CAUGHT_FLOAT_SEC = 0.6;

/** Advances one fish. Returns false when it should leave the simulation. */
export function stepFish(s: SimState, f: Fish, frozen: boolean): boolean {
  f.px = f.x;
  f.py = f.y;
  f.pheading = f.heading;
  if (f.flash > 0) f.flash -= DT;
  if (f.hpRing > 0) f.hpRing -= DT;

  if (f.state === 'caught') {
    f.caughtAge += DT;
    return f.caughtAge < CAUGHT_FLOAT_SEC;
  }
  if (frozen) return true;

  f.age += DT;
  if (f.puff > 0) f.puff -= DT;

  if (f.isBoss) {
    stepBoss(s, f);
    return !(f.leaving && (f.x < s.view.left - 800 || f.x > s.view.right + 800));
  }
  if (f.escortOf !== 0) {
    stepEscort(s, f);
    return true;
  }
  stepPathFish(f);
  const path = f.path;
  return path !== null && f.dist < path.length + 200;
}
