import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { DEG } from '../../src/sim/math';
import { emptySim, fire, placeFish, run, runSec, stopFire } from './helpers';

describe('US-01 hold to aim and fire', () => {
  it('starts turning within one tick and fires the first bubble on the next tick', () => {
    const sim = emptySim();
    fire(sim, 1800, 300);
    sim.step();
    expect(sim.localSeat.angle).not.toBe(0);
    expect(sim.s.bubbles).toHaveLength(1);
  });

  it('fires in the touched direction even while the barrel is still turning', () => {
    const sim = emptySim();
    const seat = sim.localSeat;
    fire(sim, 1800, seat.y - 200);
    sim.step();
    const b = sim.s.bubbles[0]!;
    expect(Math.atan2(b.vx, -b.vy)).toBeCloseTo(seat.aimAngle, 5);
    expect(Math.abs(seat.angle)).toBeLessThan(Math.abs(seat.aimAngle));
  });

  it('fires 4 bubbles per second while held', () => {
    const sim = emptySim('easy');
    fire(sim, 960, 100);
    run(sim, 60);
    expect(sim.s.stats.shots).toBe(4);
  });

  it('stops when the finger lifts, unless auto-fire is on', () => {
    const sim = emptySim('easy');
    fire(sim, 960, 100);
    sim.step();
    stopFire(sim);
    runSec(sim, 1);
    expect(sim.s.stats.shots).toBe(1);

    sim.enqueue({ tick: sim.tick, seatId: 0, type: 'ToggleAuto' });
    runSec(sim, 1);
    expect(sim.s.stats.shots).toBeGreaterThanOrEqual(4);
  });

  it('never loses a quick tap that lifts before the next tick', () => {
    const sim = emptySim('easy');
    fire(sim, 960, 100);
    stopFire(sim);
    sim.step();
    expect(sim.s.stats.shots).toBe(1);
  });

  it('pauses at 12 bubbles until one bursts', () => {
    const sim = emptySim('easy');
    sim.s.cfg = { ...sim.s.cfg, aimAssistDeg: 0 };
    fire(sim, 960, 100);
    runSec(sim, 3.7);
    expect(sim.s.bubbles).toHaveLength(CONFIG.cannon.maxBubbles);
    runSec(sim, 1);
    expect(sim.s.bubbles.length).toBeLessThanOrEqual(CONFIG.cannon.maxBubbles);
    expect(sim.s.stats.shots).toBeGreaterThan(CONFIG.cannon.maxBubbles);
  });

  it('clamps aim to +/-85 degrees for a touch beside or below the cannon', () => {
    const sim = emptySim();
    const seat = sim.localSeat;
    sim.enqueue({ tick: 0, seatId: 0, type: 'Aim', x: 1900, y: seat.y + 50 });
    sim.step();
    expect(seat.aimAngle).toBeCloseTo(85 * DEG, 5);
    sim.enqueue({ tick: sim.tick, seatId: 0, type: 'Aim', x: 10, y: seat.y + 50 });
    sim.step();
    expect(seat.aimAngle).toBeCloseTo(-85 * DEG, 5);
  });

  it('turns at no more than 720 degrees per second', () => {
    const sim = emptySim();
    sim.enqueue({ tick: 0, seatId: 0, type: 'Aim', x: 1900, y: 100 });
    sim.step();
    expect(Math.abs(sim.localSeat.angle)).toBeCloseTo(12 * DEG, 5);
  });
});

describe('cannon levels', () => {
  it('uses the best unlocked level on Easy', () => {
    const sim = emptySim('easy');
    sim.step();
    expect(sim.localSeat.level).toBe(5);
  });

  it('moves between 1 and the unlocked max on Medium', () => {
    const sim = emptySim('medium', { startLevel: 1 });
    const seat = sim.localSeat;
    sim.enqueue({ tick: 0, seatId: 0, type: 'LevelDown' });
    sim.step();
    expect(seat.level).toBe(1);
    for (let i = 0; i < 9; i++) sim.enqueue({ tick: sim.tick, seatId: 0, type: 'LevelUp' });
    sim.step();
    expect(seat.level).toBe(5);
  });
});

describe('energy (6.6)', () => {
  it('spends the level cost per shot and regenerates over time', () => {
    const sim = emptySim('medium', { startLevel: 3 });
    const seat = sim.localSeat;
    fire(sim, 960, 100);
    sim.step();
    expect(seat.energy).toBeCloseTo(100 - 3, 5);
    stopFire(sim);
    seat.energy = 50;
    runSec(sim, 1);
    expect(seat.energy).toBeCloseTo(58, 0);
  });

  it('at zero energy still fires free level 1 at the slow rate', () => {
    const sim = emptySim('medium', { startLevel: 5 });
    const seat = sim.localSeat;
    sim.s.cfg = { ...sim.s.cfg, energy: { ...sim.s.cfg.energy!, regenPerSec: 0.001 } };
    seat.energy = 0;
    sim.s.cfg = { ...sim.s.cfg, ricochets: 0 };
    fire(sim, 960, 100);
    runSec(sim, 2);
    expect(sim.s.stats.shots).toBe(4);
    expect(seat.energy).toBeLessThan(1);
    expect(sim.s.bubbles.every((b) => b.level === 1)).toBe(true);
  });

  it('refunds 50 % of fish points on a catch', () => {
    const sim = emptySim('medium', { startLevel: 1 });
    const seat = sim.localSeat;
    const fish = placeFish(sim, 'F01', seat.x, seat.y - 300);
    seat.energy = 10;
    fire(sim, fish.x, fish.y);
    sim.step();
    stopFire(sim);
    const afterShot = seat.energy;
    runSec(sim, 0.6);
    expect(fish.state).toBe('caught');
    expect(seat.energy).toBeCloseTo(afterShot + 8 * 0.6 + 1, 0);
  });

  it('has no energy on Easy and never limits shots', () => {
    const sim = emptySim('easy');
    fire(sim, 960, 100);
    runSec(sim, 1);
    expect(sim.s.stats.shots).toBe(4);
    expect(sim.hud().energyMax).toBe(0);
  });
});
