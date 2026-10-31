import type { Difficulty } from '../../src/config';
import { Simulation, type SimOptions } from '../../src/sim/simulation';
import type { Fish, Unlocks, ViewRect } from '../../src/sim/state';
import { spawnFish } from '../../src/sim/director';
import { straightPath } from '../../src/sim/paths';
import { CONFIG } from '../../src/config';

export const VIEW: ViewRect = { left: 0, top: 0, right: 1920, bottom: 1280 };

export const ALL_UNLOCKS: Unlocks = {
  specials: ['S01', 'S02', 'S03', 'S04', 'S05', 'S06'],
  bosses: ['B01', 'B02'],
  oceans: ['coral', 'kelp'],
  laser: true,
  maxCannonLevel: 5,
};

export const START_UNLOCKS: Unlocks = { specials: ['S01'], bosses: ['B01'], oceans: ['coral'], laser: false, maxCannonLevel: 2 };

export function makeSim(difficulty: Difficulty = 'medium', over: Partial<SimOptions> = {}): Simulation {
  return new Simulation({ difficulty, seed: 1234, view: VIEW, unlocks: ALL_UNLOCKS, ...over });
}

/** An empty sea, so a test can place exactly the fish it wants. */
export function emptySim(difficulty: Difficulty = 'medium', over: Partial<SimOptions> = {}): Simulation {
  const sim = makeSim(difficulty, over);
  const s = sim.s;
  s.fish.length = 0;
  s.slotsUsed = 0;
  s.spawnCooldown = 1e9;
  s.specialT = 1e9;
  s.cfg = { ...s.cfg, minSmallFish: 0 };
  sim.drainEvents();
  return sim;
}

/** A motionless fish at (x, y). */
export function placeFish(sim: Simulation, id: string, x: number, y: number): Fish {
  const s = sim.s;
  const def = CONFIG.creatures.get(id);
  if (!def) throw new Error(id);
  const f = spawnFish(s, def, { path: straightPath(x, y, x + 1, y), dist: 0, lateral: 0, slots: 0 });
  f.x = x;
  f.y = y;
  f.px = x;
  f.py = y;
  f.speed = 0;
  f.def = { ...def, behaviours: def.behaviours.filter((b) => b === 'puffOnHit') };
  return f;
}

export function run(sim: Simulation, ticks: number): void {
  for (let i = 0; i < ticks; i++) sim.step();
}

export const runSec = (sim: Simulation, sec: number): void => run(sim, Math.round(sec * 60));

export function fire(sim: Simulation, x: number, y: number): void {
  sim.enqueue({ tick: sim.tick, seatId: 0, type: 'Aim', x, y });
  sim.enqueue({ tick: sim.tick, seatId: 0, type: 'FireStart' });
}

export function stopFire(sim: Simulation): void {
  sim.enqueue({ tick: sim.tick, seatId: 0, type: 'FireStop' });
}
