import { CONFIG } from '../config';
import { addLaserPoints } from './cannon';
import { endBoss, releaseWhaleRing } from './director';
import { beginDive } from './motion';
import { isCatchable, type Fish, type SimState } from './state';

const { powerups } = CONFIG;

/** Fish points for this catch: parade fish are worth +50 %. */
export function catchPoints(f: Fish): number {
  return Math.round(f.def.points * (f.parade ? powerups.parade.pointsMul : 1));
}

export function catchFish(s: SimState, f: Fish): void {
  if (f.state !== 'swim' && f.state !== 'dive') return;
  f.state = 'caught';
  f.caughtAge = 0;
  f.hp = 0;

  const points = catchPoints(f);
  const coins = Math.round(points * s.cfg.coinMul);
  s.stats.caught++;
  s.stats.points += points;
  s.stats.coins += coins;
  s.stats.byFish[f.def.id] = (s.stats.byFish[f.def.id] ?? 0) + 1;
  s.noCatchT = 0;

  for (const seat of s.seats) {
    if (seat.lockUid === f.uid) {
      seat.lockUid = 0;
      s.events.push({ t: 'lock', uid: 0 });
    }
    addLaserPoints(s, seat, points);
    const energy = s.cfg.energy;
    if (energy) seat.energy = Math.min(energy.max, seat.energy + points * energy.refundRatio);
  }

  s.events.push({ t: 'caught', uid: f.uid, id: f.def.id, x: f.x, y: f.y, points, coins, parade: f.parade });
  if (f.def.effect) s.pendingSpecials.push({ effect: f.def.effect, x: f.x, y: f.y });
  if (s.boss === f) endBoss(s, true);
}

/** Applies damage, handling armour, feedback and boss thresholds. `quiet` skips per-hit feedback for the laser's ticks. */
export function damageFish(s: SimState, f: Fish, amount: number, quiet = false): void {
  if (!isCatchable(f)) return;

  let dealt = amount;
  if (f.armoured && f.hp / f.maxHp >= powerups.armour.untilHpRatio) dealt *= powerups.armour.damageMul;
  f.hp -= dealt;

  if (!quiet) {
    f.flash = 0.08;
    s.events.push({ t: 'hit', uid: f.uid, x: f.x, y: f.y });
  }
  if (f.maxHp >= powerups.hpRing.minHp) f.hpRing = powerups.hpRing.showSec;
  if (f.def.behaviours.includes('puffOnHit')) f.puff = powerups.puff.durationSec;

  if (f.hp <= 1e-6) {
    catchFish(s, f);
    return;
  }
  while (f.thresholds.length > 0 && f.hp / f.maxHp <= f.thresholds[0]!) {
    f.thresholds.shift();
    if (f.def.chain) beginDive(s, f);
    else releaseWhaleRing(s, f);
  }
}
