import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/render/layout';
import { DT } from '../../src/sim/state';
import { makeSim } from './helpers';

const PORTRAIT = computeLayout(390, 844, 34).view;
const LANDSCAPE = computeLayout(844, 390, 21).view;

describe('changing view', () => {
  it('keeps swimming fish on screen after a rotate', () => {
    const sim = makeSim('easy');
    sim.setView(LANDSCAPE);
    for (let i = 0; i < 1200; i++) sim.step();
    const seen = sim.s.fish.filter((f) => f.x > LANDSCAPE.left && f.x < LANDSCAPE.right && f.y > LANDSCAPE.top && f.y < LANDSCAPE.bottom);
    expect(seen.length).toBeGreaterThan(0);
    sim.setView(PORTRAIT);
    for (let i = 0; i < 1 / DT; i++) sim.step();
    const still = seen.filter((f) => sim.s.fish.includes(f) && f.x > PORTRAIT.left - 200 && f.x < PORTRAIT.right + 200);
    expect(still.length / seen.length).toBeGreaterThan(0.8);
    for (const f of sim.s.fish) {
      expect(Number.isFinite(f.x)).toBe(true);
      expect(Number.isFinite(f.y)).toBe(true);
    }
  });

  it('keeps each fish at the same share of the way along its path', () => {
    const sim = makeSim('easy');
    for (let i = 0; i < 600; i++) sim.step();
    const fish = sim.s.fish.find((f) => f.path !== null);
    expect(fish).toBeDefined();
    const before = fish!.dist / fish!.path!.length;
    sim.setView(PORTRAIT);
    expect(fish!.dist / fish!.path!.length).toBeCloseTo(before);
  });

  it('gives fish in a formation one shared path after a refit', () => {
    const sim = makeSim('easy');
    for (let i = 0; i < 600; i++) sim.step();
    const before = new Set(sim.s.fish.map((f) => f.path)).size;
    sim.setView(PORTRAIT);
    expect(new Set(sim.s.fish.map((f) => f.path)).size).toBe(before);
  });

  it('leaves everything alone when the view has not moved', () => {
    const sim = makeSim('easy');
    for (let i = 0; i < 600; i++) sim.step();
    const path = sim.s.fish[0]?.path;
    sim.setView({ ...sim.s.view });
    expect(sim.s.fish[0]?.path).toBe(path);
  });

  it('raises the cannon by the view\'s seat inset', () => {
    const sim = makeSim('easy');
    sim.setView(PORTRAIT);
    expect(sim.localSeat.y).toBeCloseTo(PORTRAIT.bottom - (PORTRAIT.seatInset ?? 0));
  });
});
