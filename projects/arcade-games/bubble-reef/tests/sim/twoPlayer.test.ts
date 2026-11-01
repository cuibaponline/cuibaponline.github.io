import { describe, expect, it } from 'vitest';
import { CONFIG, type Difficulty } from '../../src/config';
import { laserFill } from '../../src/sim/cannon';
import { spawnFish } from '../../src/sim/director';
import { forEachCircle } from '../../src/sim/hit';
import { straightPath } from '../../src/sim/paths';
import type { Simulation } from '../../src/sim/simulation';
import { emptySim, placeFish, run, runSec, VIEW } from './helpers';

const twoPlayers = (difficulty: Difficulty = 'medium'): Simulation => emptySim(difficulty, { players: 2 });

function fireFrom(sim: Simulation, seatId: number, x: number, y: number): void {
  sim.enqueue({ tick: sim.tick, seatId, type: 'Aim', x, y });
  sim.enqueue({ tick: sim.tick, seatId, type: 'FireStart' });
}

const effectFish = (effect: string): string => {
  for (const def of CONFIG.creatures.values()) if (def.effect === effect) return def.id;
  throw new Error(effect);
};

describe('seats', () => {
  it('keeps one player at the bottom centre', () => {
    const sim = emptySim();
    expect(sim.s.seats).toHaveLength(1);
    expect(sim.localSeat.x).toBe(960);
  });

  it('seats two players across from each other, the second turned to face the first', () => {
    const [blue, red] = twoPlayers().s.seats;
    expect(blue!.x).toBe(960);
    expect(red!.x).toBe(960);
    expect(blue!.y).toBeGreaterThan(640);
    expect(red!.y).toBeLessThan(640);
    expect(blue!.facing).toBe(1);
    expect(red!.facing).toBe(-1);
  });

  it('keeps both seats at their own edge when the view changes shape', () => {
    const sim = twoPlayers();
    sim.setView({ ...VIEW, top: -200, bottom: 1480 });
    const [blue, red] = sim.s.seats;
    expect(blue!.y).toBe(1480 - 96);
    expect(red!.y).toBe(-200 + 96);
  });
});

describe('shooting', () => {
  it('lets each player aim and fire without moving the other cannon', () => {
    const sim = twoPlayers();
    const [blue, red] = sim.s.seats;
    fireFrom(sim, 1, red!.x + 300, red!.y + 300);
    sim.step();
    expect(sim.s.bubbles.map((b) => b.seatId)).toEqual([1]);
    expect(red!.aimAngle).not.toBe(0);
    expect(blue!.aimAngle).toBe(0);
  });

  it('fires the far player\'s shots down the screen, towards where they aimed', () => {
    const sim = twoPlayers();
    const red = sim.s.seats[1]!;
    fireFrom(sim, 1, red.x + 300, red.y + 300);
    runSec(sim, 0.4);
    const bubble = sim.s.bubbles[0]!;
    expect(bubble.vy).toBeGreaterThan(0);
    expect(bubble.vx).toBeGreaterThan(0);
    expect(bubble.y).toBeGreaterThan(red.y);
  });

  it('sweeps the far player\'s laser down the screen', () => {
    const sim = twoPlayers();
    const red = sim.s.seats[1]!;
    sim.s.unlocks = { ...sim.s.unlocks, laser: true };
    red.laserMeter = laserFill(sim.s);
    const f = placeFish(sim, 'F12', red.x, red.y + 500);
    const before = f.hp;
    sim.enqueue({ tick: sim.tick, seatId: 1, type: 'Laser' });
    runSec(sim, 0.5);
    expect(f.hp).toBeLessThan(before);
  });

  it('gives each player their own bubble limit, so one on Auto cannot starve the other', () => {
    const sim = twoPlayers();
    fireFrom(sim, 0, 500, 100);
    sim.step();
    const first = sim.s.bubbles[0]!;
    while (sim.s.bubbles.length < CONFIG.cannon.maxBubbles) sim.s.bubbles.push({ ...first, uid: 1000 + sim.s.bubbles.length });
    sim.localSeat.cooldown = 0;
    fireFrom(sim, 1, 1500, 100);
    sim.step();
    expect(sim.s.bubbles.filter((b) => b.seatId === 0)).toHaveLength(CONFIG.cannon.maxBubbles);
    expect(sim.s.bubbles.filter((b) => b.seatId === 1)).toHaveLength(1);
  });

  it('keeps the HUD figures for each player separate', () => {
    const sim = twoPlayers();
    sim.enqueue({ tick: sim.tick, seatId: 1, type: 'ToggleAuto' });
    sim.enqueue({ tick: sim.tick, seatId: 1, type: 'LevelDown' });
    sim.step();
    expect(sim.hud(1).autoFire).toBe(true);
    expect(sim.hud().autoFire).toBe(false);
    expect(sim.hud(1).level).toBe(sim.hud(0).level - 1);
  });
});

describe('who caught it', () => {
  it('starts both players at zero', () => {
    expect(twoPlayers().s.stats.caughtBySeat).toEqual([0, 0]);
  });

  it('credits a net to the player who fired it', () => {
    const sim = twoPlayers();
    const red = sim.s.seats[1]!;
    placeFish(sim, 'F01', red.x, red.y + 500);
    fireFrom(sim, 1, red.x, red.y + 500);
    runSec(sim, 2);
    expect(sim.s.stats.caughtBySeat).toEqual([0, 1]);
    expect(sim.s.stats.caught).toBe(1);
  });

  it('credits a laser catch to the player who fired the laser', () => {
    const sim = twoPlayers();
    const red = sim.s.seats[1]!;
    red.laserMeter = sim.s.cfg.laserFillPoints;
    placeFish(sim, 'F01', red.x, red.y + 500);
    sim.enqueue({ tick: sim.tick, seatId: 1, type: 'Laser' });
    runSec(sim, 3);
    expect(sim.s.stats.caughtBySeat).toEqual([0, 1]);
  });

  it('credits fish caught by a burst to the player who set it off', () => {
    const sim = twoPlayers();
    const red = sim.s.seats[1]!;
    placeFish(sim, effectFish('burst'), red.x, red.y + 500);
    placeFish(sim, 'F01', red.x - 200, red.y + 500);
    fireFrom(sim, 1, red.x, red.y + 500);
    runSec(sim, 3);
    expect(sim.s.stats.caughtBySeat).toEqual([0, 2]);
  });

  it('forgets who hit a fish when it is reused for a new one', () => {
    const sim = twoPlayers();
    const f = placeFish(sim, 'F01', 500, 500);
    f.lastHitSeat = 1;
    const g = spawnFish(sim.s, f.def, { path: straightPath(0, 0, 1, 0), dist: 0, lateral: 0, slots: 0 });
    expect(g.lastHitSeat).toBe(0);
  });
});

describe('teamwork', () => {
  it('Auto-lock picks different fish for the two players when it can', () => {
    const sim = twoPlayers('easy');
    const best = placeFish(sim, 'F12', 960, 400);
    const other = placeFish(sim, 'F01', 600, 400);
    for (const seatId of [0, 1]) sim.enqueue({ tick: sim.tick, seatId, type: 'ToggleLock' });
    run(sim, 2);
    const [blue, red] = sim.s.seats;
    expect(blue!.lockUid).toBe(best.uid);
    expect(red!.lockUid).toBe(other.uid);
  });

  it('lets both players lock the only fish there is', () => {
    const sim = twoPlayers('easy');
    const only = placeFish(sim, 'F01', 960, 400);
    for (const seatId of [0, 1]) sim.enqueue({ tick: sim.tick, seatId, type: 'ToggleLock' });
    run(sim, 2);
    expect(sim.s.seats.map((seat) => seat.lockUid)).toEqual([only.uid, only.uid]);
  });

  it('gives a boss extra health for two players, and leaves other fish alone', () => {
    const boss = CONFIG.creatures.get('B01')!;
    const fish = CONFIG.creatures.get('F01')!;
    const spawn = { path: straightPath(0, 0, 1, 0), dist: 0, lateral: 0, slots: 0 };
    const sim = twoPlayers();
    expect(spawnFish(sim.s, boss, spawn).maxHp).toBeCloseTo(boss.hp.medium * CONFIG.powerups.twoPlayer.bossHpMul, 5);
    expect(spawnFish(sim.s, fish, spawn).maxHp).toBe(fish.hp.medium);
    expect(spawnFish(emptySim().s, boss, spawn).maxHp).toBe(boss.hp.medium);
  });
});

describe('turning animals to face the players', () => {
  const MID = 640;

  it('turns an animal to the far player once it is over on their half', () => {
    const sim = twoPlayers();
    const far = placeFish(sim, 'F04', 960, 200);
    const near = placeFish(sim, 'F04', 960, 1000);
    sim.step();
    expect(far.turned).toBe(true);
    expect(near.turned).toBe(false);
  });

  it('leaves an animal as it is while it is on the line, so it cannot flap back and forth', () => {
    const sim = twoPlayers();
    const f = placeFish(sim, 'F04', 960, MID + 10);
    f.turned = true;
    sim.step();
    expect(f.turned).toBe(true);
  });

  it('waits until all of a big animal is over the line', () => {
    const sim = twoPlayers();
    const size = CONFIG.creatures.get('F12')!.size;
    const f = placeFish(sim, 'F12', 960, MID - size / 4);
    sim.step();
    expect(f.turned).toBe(false);
  });

  it('never turns an animal for one player', () => {
    const sim = emptySim();
    const f = placeFish(sim, 'F04', 960, 200);
    sim.step();
    expect(f.turned).toBe(false);
  });

  it('turns an upright animal\'s hit circles with it', () => {
    const offCentre = CONFIG.creatures.get('F04')!.hitCircles.find(([, y]) => y !== 0)!;
    const sim = twoPlayers();
    const f = placeFish(sim, 'F04', 960, 200);
    const ys = (): number[] => {
      const found: number[] = [];
      forEachCircle(sim.s, f, (_, y) => {
        found.push(y - f.y);
        return false;
      });
      return found;
    };
    const upright = ys();
    sim.step();
    const turned = ys();
    expect(offCentre).toBeDefined();
    expect(turned[0]).toBeCloseTo(-upright[0]!, 5);
  });
});
