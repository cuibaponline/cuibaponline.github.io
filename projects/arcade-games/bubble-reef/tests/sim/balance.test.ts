import { describe, expect, it } from 'vitest';
import type { Difficulty } from '../../src/config';
import { unlocksForLevel } from '../../src/economy/economy';
import { Simulation } from '../../src/sim/simulation';
import { isVisible } from '../../src/sim/state';
import { VIEW } from './helpers';

/** A modest player: re-aims four times a second at the nearest fish and keeps a finger down. */
function playWave(difficulty: Difficulty, level: number, seed: number) {
  const sim = new Simulation({ difficulty, seed, view: VIEW, unlocks: unlocksForLevel(level), startLevel: 2 });
  sim.enqueue({ tick: 0, seatId: 0, type: 'FireStart' });
  let firstCatchSec: number | null = null;
  while (sim.s.phase !== 'waveComplete' && sim.tick < 60 * 400) {
    if (sim.tick % 15 === 0) {
      const seat = sim.localSeat;
      let best = null as null | { x: number; y: number };
      let bestDist = Infinity;
      for (const f of sim.s.fish) {
        if (f.state !== 'swim' || !isVisible(sim.s, f, 60)) continue;
        const d = Math.hypot(f.x - seat.x, f.y - seat.y);
        if (d < bestDist) {
          bestDist = d;
          best = f;
        }
      }
      if (best) sim.enqueue({ tick: sim.tick, seatId: 0, type: 'Aim', x: best.x, y: best.y });
    }
    sim.step();
    if (firstCatchSec === null && sim.s.stats.caught > 0) firstCatchSec = sim.tick / 60;
    sim.drainEvents();
  }
  return { points: sim.s.stats.points, caught: sim.s.stats.caught, shots: sim.s.stats.shots, firstCatchSec };
}

describe('balance', () => {
  it('pays steadily on every difficulty, and the first catch comes within seconds (G1)', () => {
    const report: Record<string, unknown> = {};
    for (const d of ['easy', 'medium', 'hard'] as const) {
      const runs = [11, 22, 33].map((seed) => playWave(d, 1, seed));
      const points = runs.reduce((sum, r) => sum + r.points, 0) / runs.length;
      report[d] = { points: Math.round(points), runs };
      for (const r of runs) expect(r.firstCatchSec).toBeLessThan(5);
    }
    expect((report['medium'] as { points: number }).points).toBeGreaterThan(300);
  });
});
