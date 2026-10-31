import { describe, expect, it } from 'vitest';
import { CONFIG, parseConfig } from '../../src/config';
import { buildPath, samplePath, straightPath } from '../../src/sim/paths';
import { Rng } from '../../src/sim/rng';
import { SpatialGrid } from '../../src/sim/collision';
import { VIEW } from './helpers';

describe('config', () => {
  it('parses and has the full roster', () => {
    const cfg = parseConfig();
    expect(cfg.fish).toHaveLength(12);
    expect(cfg.bosses).toHaveLength(2);
    expect(cfg.specials).toHaveLength(6);
    expect(cfg.creatures.size).toBe(20);
  });

  it('matches the GDD HP table for spot-checked fish', () => {
    expect(CONFIG.creatures.get('F12')!.hp).toEqual({ easy: 18, medium: 26, hard: 38 });
    expect(CONFIG.creatures.get('B02')!.hp).toEqual({ easy: 80, medium: 130, hard: 200 });
    expect(CONFIG.creatures.get('S04')!.hp).toEqual({ easy: 3, medium: 4, hard: 6 });
  });

  it('every creature has a fact for the Fish Book', () => {
    for (const def of CONFIG.creatures.values()) expect(def.fact.length).toBeGreaterThan(10);
  });
});

describe('paths', () => {
  it('every authored path begins and ends off screen, and stays roughly in the play area', () => {
    for (const p of CONFIG.paths) {
      const path = buildPath(p, VIEW, false, false);
      const start = { x: path.xs[0]!, y: path.ys[0]! };
      const end = { x: path.xs[path.xs.length - 1]!, y: path.ys[path.ys.length - 1]! };
      const outside = (q: { x: number; y: number }) => q.x < 0 || q.x > 1920 || q.y < 0 || q.y > 1280;
      expect(outside(start)).toBe(true);
      expect(outside(end)).toBe(true);
      expect(path.length).toBeGreaterThan(1500);
    }
  });

  it('mirroring reflects the path', () => {
    const cfg = CONFIG.paths[0]!;
    const a = buildPath(cfg, VIEW, false, false);
    const b = buildPath(cfg, VIEW, true, false);
    expect(b.xs[0]).toBeCloseTo(1920 - a.xs[0]!, 2);
  });

  it('samples by arc length and extrapolates past both ends', () => {
    const path = straightPath(0, 0, 100, 0);
    const out = { x: 0, y: 0, tx: 0, ty: 0 };
    expect(samplePath(path, 40, out).x).toBeCloseTo(40);
    expect(samplePath(path, -30, out).x).toBeCloseTo(-30);
    expect(samplePath(path, 130, out).x).toBeCloseTo(130);
    expect(out.tx).toBeCloseTo(1);
  });
});

describe('rng', () => {
  it('is repeatable and in range', () => {
    const a = new Rng(5);
    const b = new Rng(5);
    for (let i = 0; i < 100; i++) {
      const v = a.next();
      expect(v).toBe(b.next());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('weighted picks respect zero weight', () => {
    const r = new Rng(9);
    for (let i = 0; i < 50; i++) expect(r.weighted(['a', 'b'], (x) => (x === 'a' ? 0 : 1))).toBe('b');
  });
});

describe('grid', () => {
  it('finds nearby items once and misses far ones', () => {
    const g = new SpatialGrid<string>(200);
    g.insert('big', 500, 500, 300);
    g.insert('far', 1500, 1500, 10);
    const seen: string[] = [];
    g.query(500, 500, 400, (x) => void seen.push(x));
    expect(seen).toEqual(['big']);
    g.clear();
    const after: string[] = [];
    g.query(500, 500, 400, (x) => void after.push(x));
    expect(after).toEqual([]);
  });
});
