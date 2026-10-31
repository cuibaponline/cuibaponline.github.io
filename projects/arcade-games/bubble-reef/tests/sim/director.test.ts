import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { isVisible, type SimEvent } from '../../src/sim/state';
import { ALL_UNLOCKS, makeSim, run, runSec, START_UNLOCKS, VIEW } from './helpers';

const stateHash = (sim: ReturnType<typeof makeSim>): string =>
  JSON.stringify(sim.s.fish.map((f) => [f.uid, f.def.id, f.x.toFixed(3), f.y.toFixed(3), f.hp]));

function collect(sim: ReturnType<typeof makeSim>, ticks: number): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    sim.step();
    out.push(...sim.drainEvents());
  }
  return out;
}

describe('determinism (17.4)', () => {
  it('same seed and commands replay exactly', () => {
    const play = () => {
      const sim = makeSim('hard', { seed: 42 });
      for (let i = 0; i < 1800; i++) {
        if (i % 37 === 0) sim.enqueue({ tick: i, seatId: 0, type: 'Aim', x: 200 + (i % 1500), y: 300 });
        if (i % 90 === 0) sim.enqueue({ tick: i, seatId: 0, type: 'FireStart' });
        sim.step();
      }
      return stateHash(sim) + JSON.stringify(sim.s.stats);
    };
    expect(play()).toBe(play());
  });

  it('different seeds give different seas', () => {
    const a = makeSim('medium', { seed: 1 });
    const b = makeSim('medium', { seed: 2 });
    runSec(a, 5);
    runSec(b, 5);
    expect(stateHash(a)).not.toBe(stateHash(b));
  });
});

describe('spawn director (6.8)', () => {
  it('opens at about 50 % of the cap, so the sea is never empty on start', () => {
    const sim = makeSim('medium');
    expect(sim.s.slotsUsed).toBeGreaterThan(CONFIG.difficulty.medium.maxFishSlots * 0.4);
    expect(sim.s.fish.filter((f) => isVisible(sim.s, f)).length).toBeGreaterThan(5);
  });

  it('ramps to the cap by 60 % of the wave and never exceeds it', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      const sim = makeSim(d, { unlocks: { ...ALL_UNLOCKS, specials: [] } });
      const { maxFishSlots, waveSec, minSmallFish } = CONFIG.difficulty[d];
      let peak = 0;
      for (let i = 0; i < waveSec * 60 - 10; i++) {
        sim.step();
        peak = Math.max(peak, sim.s.slotsUsed);
      }
      expect(peak).toBeLessThanOrEqual(maxFishSlots + minSmallFish + 1);
      expect(peak).toBeGreaterThanOrEqual(maxFishSlots - 3);
    }
  });

  it('Easy keeps at least 3 small fish on screen even if everything is being caught', () => {
    const sim = makeSim('easy');
    let low = Infinity;
    for (let i = 0; i < 60 * 60; i++) {
      for (const f of sim.s.fish) if (f.def.tier === 'small' && i % 90 === 0 && f.state === 'swim' && i > 0) f.state = 'caught';
      sim.step();
      const n = sim.s.fish.filter((f) => f.def.tier === 'small' && f.state === 'swim' && isVisible(sim.s, f)).length;
      low = Math.min(low, n);
    }
    expect(low).toBeGreaterThanOrEqual(CONFIG.difficulty.easy.minSmallFish);
  });

  it('only one special fish at a time, roughly on its interval', () => {
    const sim = makeSim('easy');
    const events = collect(sim, 140 * 60);
    expect(sim.s.fish.filter((f) => f.def.tier === 'special').length).toBeLessThanOrEqual(1);
    const appears = events.filter((e) => e.t === 'specialAppear').length;
    expect(appears).toBeGreaterThanOrEqual(3);
    expect(appears).toBeLessThanOrEqual(10);
  });

  it('never spawns a special the player has not unlocked', () => {
    const sim = makeSim('easy', { unlocks: START_UNLOCKS });
    const ids = collect(sim, 120 * 60).flatMap((e) => (e.t === 'specialAppear' ? [e.id] : []));
    expect(new Set(ids)).toEqual(new Set(['S01']));
  });

  it('new fish start outside the view', () => {
    const sim = makeSim('medium');
    const seen = new Set(sim.s.fish.map((f) => f.uid));
    for (let i = 0; i < 1200; i++) {
      sim.step();
      for (const f of sim.s.fish) {
        if (seen.has(f.uid)) continue;
        seen.add(f.uid);
        if (f.def.tier === 'small') continue;
        expect(isVisible(sim.s, f)).toBe(false);
      }
    }
  });
});

describe('wave timeline (5.4)', () => {
  const phases = (events: SimEvent[]) => events.flatMap((e) => (e.t === 'phase' ? [e.phase] : []));

  it('runs wave, parade, transition, then complete on a normal wave', () => {
    const sim = makeSim('easy');
    sim.drainEvents();
    const events = collect(sim, (150 + 25 + 3) * 60);
    expect(phases(events)).toEqual(['parade', 'transition', 'waveComplete']);
    expect(events.some((e) => e.t === 'paradeStart')).toBe(true);
    expect(sim.s.stats.wavesCompleted).toBe(1);
  });

  it('parade fish are worth +50 % and swim 1.5x faster', () => {
    const sim = makeSim('medium');
    run(sim, CONFIG.difficulty.medium.waveSec * 60 + 300);
    const parade = sim.s.fish.find((f) => f.parade && f.def.id === 'F01');
    expect(parade).toBeDefined();
    expect(parade!.speed).toBeCloseTo(CONFIG.creatures.get('F01')!.speed * 1.5, 5);
  });

  it('the ocean changes at the end of the parade when more than one is unlocked', () => {
    const sim = makeSim('easy');
    const events = collect(sim, (150 + 27) * 60);
    expect(events.find((e) => e.t === 'oceanChange')).toMatchObject({ ocean: 'kelp' });
  });

  it('every third wave has a boss; on timeout it swims away with no penalty', () => {
    const sim = makeSim('hard');
    const coinsBefore = sim.s.stats.coins;
    sim.s.wave = 2;
    sim.nextWave();
    const events = collect(sim, (180 + 25 + 3 + 45 + 4) * 60);
    expect(events.find((e) => e.t === 'bossSpawn')).toMatchObject({ id: 'B01' });
    expect(events.find((e) => e.t === 'bossEnd')).toMatchObject({ caught: false });
    expect(phases(events)).toContain('waveComplete');
    expect(sim.s.stats.coins).toBe(coinsBefore);
  });

  it('boss stays on stage for the whole timer', () => {
    const sim = makeSim('easy');
    sim.s.wave = 2;
    sim.nextWave();
    run(sim, (150 + 25 + 2.4) * 60);
    const boss = sim.s.boss!;
    expect(boss).not.toBeNull();
    runSec(sim, 12);
    for (let i = 0; i < 70; i++) {
      runSec(sim, 1);
      expect(boss.x).toBeGreaterThan(VIEW.left);
      expect(boss.x).toBeLessThan(VIEW.right);
      expect(boss.y).toBeGreaterThan(VIEW.top);
      expect(boss.y).toBeLessThan(VIEW.bottom);
    }
  });

  it('the second boss wave brings the Coral Dragon once it is unlocked', () => {
    const sim = makeSim('hard');
    sim.s.wave = 5;
    sim.nextWave();
    const events = collect(sim, (180 + 25 + 3) * 60);
    expect(events.find((e) => e.t === 'bossSpawn')).toMatchObject({ id: 'B02' });
  });

  it('nextWave starts a fresh wave and reseeds', () => {
    const sim = makeSim('easy');
    run(sim, (150 + 28) * 60);
    expect(sim.s.phase).toBe('waveComplete');
    sim.nextWave();
    expect(sim.s.phase).toBe('wave');
    expect(sim.s.wave).toBe(2);
    expect(sim.s.fish.length).toBeGreaterThan(5);
  });

  it('swim away clears the sea and ends the session in 3 s', () => {
    const sim = makeSim('medium');
    runSec(sim, 30);
    sim.swimAway();
    runSec(sim, 3.1);
    expect(sim.s.phase).toBe('ended');
    expect(sim.s.fish.filter((f) => isVisible(sim.s, f)).length).toBe(0);
  });
});

describe('soak', () => {
  it('survives long continuous play on every difficulty without NaN or leaks', () => {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      const sim = makeSim(d, { startLevel: 3 });
      sim.enqueue({ tick: 0, seatId: 0, type: 'ToggleAuto' });
      sim.enqueue({ tick: 0, seatId: 0, type: 'ToggleLock' });
      for (let i = 0; i < 60 * 60 * 12; i++) {
        if (i % 30 === 0) {
          sim.enqueue({ tick: i, seatId: 0, type: 'Aim', x: 100 + (i * 7) % 1700, y: 200 + (i * 3) % 700 });
          sim.enqueue({ tick: i, seatId: 0, type: 'LockTarget', x: 100 + (i * 7) % 1700, y: 200 + (i * 3) % 700 });
          sim.enqueue({ tick: i, seatId: 0, type: 'Laser' });
          sim.enqueue({ tick: i, seatId: 0, type: 'PopBubble', x: 500, y: 500 });
        }
        sim.step();
        sim.drainEvents();
        if (sim.s.phase === 'waveComplete') sim.nextWave();
        for (const f of sim.s.fish) {
          if (!Number.isFinite(f.x + f.y + f.heading + f.hp)) throw new Error(`NaN on ${f.def.id} at tick ${i}`);
        }
      }
      expect(sim.s.stats.caught).toBeGreaterThan(50);
      expect(sim.s.fish.length).toBeLessThan(150);
      expect(sim.s.pool.length).toBeLessThan(300);
      expect(sim.s.slotsUsed).toBeGreaterThanOrEqual(0);
      expect(sim.s.wave).toBeGreaterThan(2);
    }
  }, 120_000);
});
