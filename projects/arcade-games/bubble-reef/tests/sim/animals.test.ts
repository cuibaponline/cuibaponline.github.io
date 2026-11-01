import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { catchFish, catchPoints } from '../../src/sim/damage';
import { spawnFish } from '../../src/sim/director';
import { touchesCircle } from '../../src/sim/hit';
import { straightPath } from '../../src/sim/paths';
import { Simulation } from '../../src/sim/simulation';
import { isVisible, type Fish } from '../../src/sim/state';
import { emptySim, makeSim, placeFish, run, runSec, START_UNLOCKS, VIEW } from './helpers';

const DOLPHIN = 'F13';
const SEAL = 'F14';
const PENGUIN = 'F15';
const WHALE = 'F16';
const { whale } = CONFIG.waves;

/** Runs a fresh game on to `wave`, stopping as its Fish Parade begins. */
function toParade(wave: number, difficulty: 'easy' | 'medium' | 'hard' = 'easy', over = {}): Simulation {
  const sim = makeSim(difficulty, over);
  sim.s.wave = wave - 1;
  sim.nextWave();
  while (sim.s.phase !== 'parade') sim.step();
  return sim;
}

const whaleIn = (sim: Simulation): Fish | undefined => sim.s.fish.find((f) => f.def.id === WHALE);

describe('the whale at the end of every wave', () => {
  it('swims in with the Fish Parade on the very first wave', () => {
    expect(whaleIn(toParade(1))).toBeDefined();
  });

  it('is bigger every wave', () => {
    const sizes = [1, 2, 3, 4].map((wave) => whaleIn(toParade(wave))!.scale);
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]!).toBeGreaterThan(sizes[i - 1]!);
  });

  it('stops growing once it reaches its full size', () => {
    expect(whaleIn(toParade(60))!.scale).toBe(whale.maxScale);
  });

  it('is on screen during the parade and gone before the wave ends, in a wide or a narrow sea', () => {
    for (const view of [VIEW, { left: -200, top: 0, right: 2120, bottom: 1280 }]) {
      const sim = toParade(1, 'easy', { view });
      const swimmer = whaleIn(sim)!;
      let seen = false;
      while (sim.s.phase === 'parade') {
        sim.step();
        seen ||= isVisible(sim.s, swimmer);
      }
      expect(seen).toBe(true);
      expect(swimmer.x < view.left || swimmer.x > view.right).toBe(true);
    }
  });

  it('never joins the ordinary mix of fish', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      for (const seed of [1, 2, 3]) {
        const sim = makeSim(difficulty, { seed });
        for (let i = 0; i < 90 * 60; i++) {
          sim.step();
          expect(whaleIn(sim)).toBeUndefined();
        }
      }
    }
  });

  it('leaves the Golden Whale where it was, straight after the wave 3 parade', () => {
    const sim = toParade(3, 'easy', { unlocks: START_UNLOCKS });
    expect(whaleIn(sim)).toBeDefined();
    expect(sim.s.boss).toBeNull();
    while (sim.s.phase !== 'boss') sim.step();
    expect(sim.s.boss!.def.id).toBe('B01');
  });

  it('brings no Golden Whale on wave 1', () => {
    const sim = toParade(1);
    while (sim.s.phase !== 'waveComplete') sim.step();
    expect(sim.s.stats.bossesCaught).toBe(0);
    expect(sim.s.fish.some((f) => f.def.id === 'B01')).toBe(false);
  });

  it('takes more catching and pays more as it grows', () => {
    const small = whaleIn(toParade(1))!;
    const big = whaleIn(toParade(6))!;
    expect(big.maxHp / small.maxHp).toBeCloseTo(big.scale / small.scale);
    expect(catchPoints(big)).toBeGreaterThan(catchPoints(small));
  });

  it('can be hit all the way along its grown body', () => {
    const sim = emptySim('medium');
    const swimmer = placeFish(sim, WHALE, 900, 600);
    const reach = swimmer.def.hitCircles[0]![0] + swimmer.def.hitCircles[0]![2];
    const justPast = 900 + reach * sim.s.cfg.hitboxScale + 80;
    expect(touchesCircle(sim.s, swimmer, justPast, 600, 0)).toBe(false);
    swimmer.scale = 1.5;
    expect(touchesCircle(sim.s, swimmer, justPast, 600, 0)).toBe(true);
  });

  it('turns for the far player only once the whole of its grown body is across the middle', () => {
    const sim = emptySim('medium', { players: 2 });
    const middle = (VIEW.top + VIEW.bottom) / 2;
    const swimmer = placeFish(sim, WHALE, 900, middle - swimmer0Clear() - 10);
    swimmer.scale = 1.5;
    run(sim, 1);
    expect(swimmer.turned).toBe(false);
    swimmer.y = middle - swimmer.def.size * 0.75 - 70;
    run(sim, 1);
    expect(swimmer.turned).toBe(true);
  });

  it('hands the next fish from the pool back at its normal size', () => {
    const sim = toParade(6);
    const swimmer = whaleIn(sim)!;
    catchFish(sim.s, swimmer);
    while (sim.s.fish.includes(swimmer)) sim.step();
    const def = CONFIG.fish[0]!;
    const next = spawnFish(sim.s, def, { path: straightPath(0, 0, 100, 0), dist: 0, lateral: 0, slots: 0 });
    expect(next.scale).toBe(1);
  });
});

function swimmer0Clear(): number {
  return CONFIG.creatures.get(WHALE)!.size / 2 + 60;
}

describe('dolphins, seals and penguins', () => {
  const firstSeen = (sim: Simulation, id: string, maxSec: number): number | null => {
    for (let t = 0; t < maxSec * 60; t++) {
      if (sim.s.fish.some((f) => f.def.id === id)) return t / 60;
      sim.step();
    }
    return null;
  };

  it('all turn up early in the first wave', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      for (const seed of [1, 2, 3]) {
        for (const id of [DOLPHIN, PENGUIN, SEAL]) {
          expect(firstSeen(makeSim(difficulty, { seed }), id, 70)).not.toBeNull();
        }
      }
    }
  });

  it('come back in the next wave too', () => {
    const sim = toParade(1);
    while (sim.s.phase !== 'waveComplete') sim.step();
    sim.nextWave();
    sim.s.fish.length = 0;
    expect(firstSeen(sim, DOLPHIN, 20)).not.toBeNull();
  });

  it('swim on screen once they have arrived', () => {
    const sim = makeSim('easy', { seed: 5 });
    const entry = CONFIG.waves.guests.find((g) => g.fish === DOLPHIN)!;
    runSec(sim, entry.at + 8);
    expect(sim.s.fish.some((f) => f.def.id === DOLPHIN && isVisible(sim.s, f))).toBe(true);
  });

  it('are also in the ordinary mix of fish', () => {
    for (const id of [DOLPHIN, PENGUIN, SEAL]) {
      const weight = CONFIG.creatures.get(id)!.spawnWeight!;
      expect(Math.min(weight.easy, weight.medium, weight.hard)).toBeGreaterThan(0);
    }
  });

  it('do not get the sea stuck over its fish limit', () => {
    const sim = makeSim('easy');
    runSec(sim, 100);
    expect(sim.s.slotsUsed).toBeLessThanOrEqual(sim.s.cfg.maxFishSlots + 8);
  });
});
