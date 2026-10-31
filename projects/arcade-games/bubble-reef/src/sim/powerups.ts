import { CONFIG, type SpecialEffect } from '../config';
import { laserFill } from './cannon';
import { catchFish, damageFish } from './damage';
import { touchesBeam } from './hit';
import { cannonDirX, cannonDirY } from './math';
import { DT, isVisible, type Fish, type SimState } from './state';

const { powerups } = CONFIG;

function burst(s: SimState, x: number, y: number): void {
  const radius = s.cfg.burstRadius;
  s.events.push({ t: 'burst', x, y, radius });
  for (const f of s.fish) {
    if (f.state !== 'swim' || f.isBoss) continue;
    if (Math.hypot(f.x - x, f.y - y) <= radius) damageFish(s, f, powerups.burst.damage);
  }
}

function chain(s: SimState, x: number, y: number): void {
  const near = s.fish
    .filter((f) => f.state === 'swim' && isVisible(s, f))
    .map((f) => ({ f, d: Math.hypot(f.x - x, f.y - y) }))
    .sort((a, b) => a.d - b.d || a.f.uid - b.f.uid)
    .slice(0, powerups.chain.targets);
  s.events.push({ t: 'chain', x, y, targets: near.map(({ f }) => ({ x: f.x, y: f.y })) });
  for (const { f } of near) damageFish(s, f, powerups.chain.damage);
}

function sameKind(s: SimState, x: number, y: number): void {
  const counts = new Map<string, Fish[]>();
  for (const f of s.fish) {
    if (f.state !== 'swim' || f.isBoss || f.def.tier === 'special' || !isVisible(s, f)) continue;
    const list = counts.get(f.def.id);
    if (list) list.push(f);
    else counts.set(f.def.id, [f]);
  }
  let best: Fish[] = [];
  for (const list of counts.values()) {
    if (list.length > best.length || (list.length === best.length && (list[0]?.def.points ?? 0) > (best[0]?.def.points ?? 0))) best = list;
  }
  const id = best[0]?.def.id;
  if (!id) return;
  s.events.push({ t: 'sameKind', id, x, y });
  for (const f of best) catchFish(s, f);
}

function applyEffect(s: SimState, effect: SpecialEffect, x: number, y: number): void {
  switch (effect) {
    case 'burst':
      burst(s, x, y);
      break;
    case 'freeze':
      s.freezeT = s.cfg.freezeSec;
      s.events.push({ t: 'freeze', sec: s.cfg.freezeSec });
      break;
    case 'chain':
      chain(s, x, y);
      break;
    case 'sameKind':
      sameKind(s, x, y);
      break;
    case 'bubblePop':
      s.bubblePop = { t: powerups.bubblePop.durationSec, spawnT: 0, bubbles: [], popped: 0 };
      s.events.push({ t: 'bubblePopStart' });
      break;
    case 'laserFill':
      for (const seat of s.seats) seat.laserMeter = laserFill(s);
      s.events.push({ t: 'laserFilled' });
      break;
  }
}

export function resolveSpecials(s: SimState): void {
  while (s.pendingSpecials.length > 0) {
    const next = s.pendingSpecials.shift()!;
    applyEffect(s, next.effect, next.x, next.y);
  }
}

export function stepFreeze(s: SimState): void {
  if (s.freezeT <= 0) return;
  s.freezeT -= DT;
  if (s.freezeT <= 0) s.events.push({ t: 'freezeEnd' });
}

export function fireLaser(s: SimState, seatId: number): void {
  const seat = s.seats[seatId];
  if (!seat || !s.unlocks.laser || seat.laserT > 0 || seat.laserMeter < laserFill(s)) return;
  seat.laserT = powerups.laser.durationSec;
  seat.laserMeter = 0;
  s.events.push({ t: 'laserStart', seat: seat.id });
}

export function stepLaser(s: SimState): void {
  for (const seat of s.seats) {
    if (seat.laserT <= 0) continue;
    seat.laserT -= DT;
    if (seat.laserT <= 0) s.events.push({ t: 'laserEnd', seat: seat.id });

    const dx = cannonDirX(seat.angle);
    const dy = cannonDirY(seat.angle);
    const half = powerups.laser.width / 2;
    const dmg = powerups.laser.dps * DT;
    for (const f of s.fish) {
      if (f.state !== 'swim') continue;
      if (!touchesBeam(s, f, seat.x, seat.y, dx, dy, half)) continue;
      const pulse = s.tick - f.beamHitTick >= 15;
      if (pulse) f.beamHitTick = s.tick;
      damageFish(s, f, dmg, !pulse);
    }
  }
}

export function stepBubblePop(s: SimState): void {
  const pop = s.bubblePop;
  if (!pop) return;
  const cfg = powerups.bubblePop;
  pop.t -= DT;
  pop.spawnT -= DT;

  const v = s.view;
  if (pop.spawnT <= 0 && pop.t > 0.8) {
    pop.spawnT = cfg.spawnEverySec;
    const x = s.rng.range(v.left + 200, v.right - 200);
    pop.bubbles.push({ uid: s.nextUid++, x, y: v.bottom + cfg.radius, px: x, py: v.bottom + cfg.radius, r: cfg.radius, wobble: s.rng.next() * 6 });
  }
  for (const b of pop.bubbles) {
    b.px = b.x;
    b.py = b.y;
    b.wobble += DT * 2.4;
    b.y -= cfg.riseSpeed * DT;
    b.x += Math.sin(b.wobble) * 34 * DT;
  }
  pop.bubbles = pop.bubbles.filter((b) => b.y > v.top - b.r);

  if (pop.t <= 0) {
    s.events.push({ t: 'bubblePopEnd', popped: pop.popped, coins: pop.popped * cfg.coinsEach });
    s.bubblePop = null;
  }
}

export function popBubbleAt(s: SimState, x: number, y: number): void {
  const pop = s.bubblePop;
  if (!pop) return;
  // Small fingers and moving targets: a touch counts a little outside the bubble.
  const slop = 18;
  for (let i = 0; i < pop.bubbles.length; i++) {
    const b = pop.bubbles[i]!;
    if (Math.hypot(b.x - x, b.y - y) > b.r + slop) continue;
    pop.bubbles.splice(i, 1);
    pop.popped++;
    const coins = powerups.bubblePop.coinsEach;
    s.stats.coins += coins;
    s.events.push({ t: 'bubblePopped', x: b.x, y: b.y, coins });
    return;
  }
}
