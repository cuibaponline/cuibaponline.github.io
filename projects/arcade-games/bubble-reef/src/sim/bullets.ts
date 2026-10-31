import { CONFIG } from '../config';
import { findFish } from './cannon';
import { damageFish } from './damage';
import { touchesCircle } from './hit';
import { angleDelta, DEG, rotateToward } from './math';
import { DT, helpActive, isVisible, type Bubble, type Fish, type SimState } from './state';

const { cannon } = CONFIG;
const ASSIST_TURN = cannon.bubble.assistTurnDegPerSec * DEG * DT;
const HOMING_TURN = cannon.bubble.homingTurnDegPerSec * DEG * DT;

function steer(b: Bubble, toward: number, maxTurn: number): void {
  const speed = Math.hypot(b.vx, b.vy);
  const angle = rotateToward(Math.atan2(b.vy, b.vx), toward, maxTurn);
  b.vx = Math.cos(angle) * speed;
  b.vy = Math.sin(angle) * speed;
}

function assistTarget(s: SimState, b: Bubble, coneRad: number): Fish | null {
  const heading = Math.atan2(b.vy, b.vx);
  let best: Fish | null = null;
  let bestDist = Infinity;
  for (const f of s.fish) {
    if (f.state !== 'swim' || !isVisible(s, f)) continue;
    const dx = f.x - b.x;
    const dy = f.y - b.y;
    if (Math.abs(angleDelta(heading, Math.atan2(dy, dx))) > coneRad) continue;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = f;
    }
  }
  return best;
}

function assistCone(s: SimState): number {
  const extra = helpActive(s) ? (s.cfg.adaptiveHelp?.extraAssistDeg ?? 0) : 0;
  return (s.cfg.aimAssistDeg + extra) * DEG;
}

function ricochet(s: SimState, b: Bubble): boolean {
  const { left, top, right, bottom } = s.view;
  let bounced = false;
  if (b.x - b.r < left && b.vx < 0) {
    b.x = left + b.r;
    b.vx = -b.vx;
    bounced = true;
  } else if (b.x + b.r > right && b.vx > 0) {
    b.x = right - b.r;
    b.vx = -b.vx;
    bounced = true;
  }
  if (b.y - b.r < top && b.vy < 0) {
    b.y = top + b.r;
    b.vy = -b.vy;
    bounced = true;
  } else if (b.y + b.r > bottom && b.vy > 0) {
    b.y = bottom - b.r;
    b.vy = -b.vy;
    bounced = true;
  }
  return bounced;
}

function spawnNet(s: SimState, b: Bubble): void {
  s.nets.push({ x: b.x, y: b.y, radius: b.netRadius, age: 0, level: b.level, damage: b.damage, applied: false, lockUid: b.lockUid });
  s.events.push({ t: 'net', x: b.x, y: b.y, radius: b.netRadius, level: b.level });
}

/** First fish this bubble touches. A locked bubble flies past everything except its target. */
function contact(s: SimState, b: Bubble, locked: Fish | null): Fish | null {
  if (locked) return touchesCircle(s, locked, b.x, b.y, b.r) ? locked : null;
  let hit: Fish | null = null;
  s.grid.query(b.x, b.y, b.r + 60, (f) => {
    if (touchesCircle(s, f, b.x, b.y, b.r)) {
      hit = f;
      return true;
    }
    return false;
  });
  return hit;
}

export function stepBubbles(s: SimState): void {
  const cone = assistCone(s);
  for (const b of s.bubbles) {
    b.px = b.x;
    b.py = b.y;
    b.life -= DT;

    const locked = b.lockUid !== 0 ? findFish(s, b.lockUid) : null;
    const target = locked && locked.state === 'swim' ? locked : null;
    if (target) {
      steer(b, Math.atan2(target.y - b.y, target.x - b.x), HOMING_TURN);
    } else if (cone > 0) {
      const near = assistTarget(s, b, cone);
      if (near) steer(b, Math.atan2(near.y - b.y, near.x - b.x), ASSIST_TURN);
    }

    b.x += b.vx * DT;
    b.y += b.vy * DT;

    if (ricochet(s, b) && --b.bounces < 0) b.alive = false;
    if (b.life <= 0) b.alive = false;
    if (!b.alive) {
      s.events.push({ t: 'pop', x: b.x, y: b.y });
      continue;
    }

    if (contact(s, b, target)) {
      spawnNet(s, b);
      b.alive = false;
      s.stats.hits++;
      s.waveHits++;
    }
  }
  if (s.bubbles.some((b) => !b.alive)) s.bubbles = s.bubbles.filter((b) => b.alive);
}

export function stepNets(s: SimState): void {
  const { expandSec, holdSec, fadeSec } = cannon.net;
  const total = expandSec + holdSec + fadeSec;
  for (const net of s.nets) {
    net.age += DT;
    if (!net.applied && net.age >= expandSec) {
      net.applied = true;
      for (const f of s.fish) {
        if (f.state === 'swim' && touchesCircle(s, f, net.x, net.y, net.radius)) damageFish(s, f, net.damage);
      }
    }
  }
  if (s.nets.some((n) => n.age >= total)) s.nets = s.nets.filter((n) => n.age < total);
}
