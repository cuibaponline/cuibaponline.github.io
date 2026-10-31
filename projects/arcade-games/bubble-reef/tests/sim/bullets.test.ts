import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { emptySim, fire, placeFish, run, runSec, stopFire } from './helpers';

const { net } = CONFIG.cannon;

describe('bubbles', () => {
  it('moves at 1000 u/s in a straight line with no assist target', () => {
    const sim = emptySim('hard');
    fire(sim, 960, 100);
    sim.step();
    stopFire(sim);
    const b = sim.s.bubbles[0]!;
    const y0 = b.y;
    run(sim, 30);
    expect(y0 - b.y).toBeCloseTo(500, 0);
  });

  it('ricochets 3 times on Medium and then pops', () => {
    const sim = emptySim('medium', { startLevel: 1 });
    sim.s.cfg = { ...sim.s.cfg, aimAssistDeg: 0 };
    fire(sim, 1800, sim.localSeat.y - 500);
    sim.step();
    stopFire(sim);
    const b = sim.s.bubbles[0]!;
    let bounces = 0;
    let vx = b.vx;
    let vy = b.vy;
    for (let i = 0; i < 240 && b.alive; i++) {
      sim.step();
      if (Math.sign(b.vx) !== Math.sign(vx) || Math.sign(b.vy) !== Math.sign(vy)) bounces++;
      vx = b.vx;
      vy = b.vy;
    }
    expect(b.alive).toBe(false);
    expect(bounces).toBe(3);
  });

  it('expires after its 4 s lifetime', () => {
    const sim = emptySim('easy');
    sim.s.cfg = { ...sim.s.cfg, ricochets: 999, aimAssistDeg: 0 };
    fire(sim, 1700, 300);
    sim.step();
    stopFire(sim);
    runSec(sim, 3.9);
    expect(sim.s.bubbles).toHaveLength(1);
    runSec(sim, 0.2);
    expect(sim.s.bubbles).toHaveLength(0);
  });

  it('aim assist curves a near miss onto a fish on Easy, but not on Hard', () => {
    for (const [difficulty, expectHit] of [['easy', true], ['hard', false]] as const) {
      const sim = emptySim(difficulty);
      const seat = sim.localSeat;
      const fish = placeFish(sim, 'F12', seat.x + 240, seat.y - 900);
      fire(sim, seat.x, seat.y - 900);
      sim.step();
      stopFire(sim);
      run(sim, 70);
      expect(fish.flash > 0 || fish.hp < fish.maxHp).toBe(expectHit);
    }
  });
});

describe('nets (6.4)', () => {
  it('bursts on first contact and damages once at full expansion, not before', () => {
    const sim = emptySim('medium', { startLevel: 1 });
    const seat = sim.localSeat;
    const fish = placeFish(sim, 'F12', seat.x, seat.y - 300);
    fire(sim, fish.x, fish.y);
    sim.step();
    stopFire(sim);
    while (sim.s.nets.length === 0) sim.step();
    expect(fish.hp).toBe(fish.maxHp);
    run(sim, Math.ceil(net.expandSec * 60) + 1);
    expect(fish.hp).toBeCloseTo(fish.maxHp - 1, 5);
    runSec(sim, 1);
    expect(fish.hp).toBeCloseTo(fish.maxHp - 1, 5);
    expect(sim.s.nets).toHaveLength(0);
  });

  it('net lifetime is 120 + 250 + 200 ms', () => {
    const sim = emptySim('medium', { startLevel: 1 });
    const seat = sim.localSeat;
    placeFish(sim, 'F12', seat.x, seat.y - 200);
    fire(sim, seat.x, seat.y - 200);
    sim.step();
    stopFire(sim);
    while (sim.s.nets.length === 0) sim.step();
    run(sim, 32);
    expect(sim.s.nets).toHaveLength(1);
    run(sim, 3);
    expect(sim.s.nets).toHaveLength(0);
  });

  it('damages every fish inside the circle (area of effect)', () => {
    const sim = emptySim('medium', { startLevel: 5 });
    const seat = sim.localSeat;
    const a = placeFish(sim, 'F12', seat.x, seat.y - 400);
    const b = placeFish(sim, 'F12', seat.x + 150, seat.y - 400);
    const far = placeFish(sim, 'F12', seat.x + 900, seat.y - 400);
    fire(sim, a.x, a.y);
    sim.step();
    stopFire(sim);
    runSec(sim, 1);
    expect(a.hp).toBeLessThan(a.maxHp);
    expect(b.hp).toBeLessThan(b.maxHp);
    expect(far.hp).toBe(far.maxHp);
  });
});

describe('catching (6.5)', () => {
  it('is deterministic: a fish needs exactly hp / damage hits', () => {
    const sim = emptySim('medium', { startLevel: 1 });
    const seat = sim.localSeat;
    const fish = placeFish(sim, 'F08', seat.x, seat.y - 300);
    for (let i = 0; i < 5; i++) {
      fire(sim, fish.x, fish.y);
      sim.step();
      stopFire(sim);
      runSec(sim, 0.8);
      expect(fish.state).toBe('swim');
    }
    fire(sim, fish.x, fish.y);
    sim.step();
    stopFire(sim);
    runSec(sim, 0.4);
    expect(fish.state).toBe('caught');
  });

  it('awards points, coins with the difficulty multiplier, and removes the fish after 600 ms', () => {
    const sim = emptySim('hard', { startLevel: 5 });
    const seat = sim.localSeat;
    const fish = placeFish(sim, 'F06', seat.x, seat.y - 300);
    fish.hp = 0.5;
    fire(sim, fish.x, fish.y);
    sim.step();
    stopFire(sim);
    runSec(sim, 0.35);
    const caught = sim.drainEvents().find((e) => e.t === 'caught');
    expect(caught).toMatchObject({ id: 'F06', points: 10, coins: 15 });
    expect(sim.s.stats.caught).toBe(1);
    runSec(sim, 0.7);
    expect(sim.s.fish).toHaveLength(0);
  });

  it('shows the HP ring only for fish with at least 6 HP', () => {
    const sim = emptySim('easy');
    const seat = sim.localSeat;
    const big = placeFish(sim, 'F12', seat.x, seat.y - 400);
    fire(sim, big.x, big.y);
    sim.step();
    stopFire(sim);
    runSec(sim, 0.5);
    expect(big.hpRing).toBeGreaterThan(0);
    runSec(sim, 1.6);
    expect(big.hpRing).toBeLessThanOrEqual(0);
  });

  it('pufferfish grows its hitbox when hit, for 2 s', () => {
    const sim = emptySim('hard', { startLevel: 1 });
    const seat = sim.localSeat;
    const fish = placeFish(sim, 'F05', seat.x, seat.y - 300);
    fire(sim, fish.x, fish.y);
    sim.step();
    stopFire(sim);
    runSec(sim, 0.4);
    expect(fish.puff).toBeGreaterThan(1);
    runSec(sim, 2);
    expect(fish.puff).toBeLessThanOrEqual(0);
  });

  it('armoured fish take half damage until below 50 % HP (Hard only)', () => {
    const sim = emptySim('hard', { startLevel: 5 });
    const seat = sim.localSeat;
    const turtle = placeFish(sim, 'F09', seat.x, seat.y - 300);
    expect(turtle.armoured).toBe(true);
    fire(sim, turtle.x, turtle.y);
    sim.step();
    stopFire(sim);
    runSec(sim, 0.5);
    expect(turtle.hp).toBeCloseTo(turtle.maxHp - 1.5, 5);
    turtle.hp = turtle.maxHp * 0.4;
    const before = turtle.hp;
    fire(sim, turtle.x, turtle.y);
    sim.step();
    stopFire(sim);
    runSec(sim, 0.5);
    expect(turtle.hp).toBeCloseTo(before - 3, 5);
    expect(emptySim('medium').s.cfg.armouredFish).toEqual([]);
  });
});
