import { describe, expect, it } from 'vitest';
import { computeLayout, isCompact } from '../../src/render/layout';
import { CORE_H, CORE_W } from '../../src/sim/state';

const area = (w: number, h: number): number => {
  const { view } = computeLayout(w, h);
  return (view.right - view.left) * (view.bottom - view.top);
};

describe('computeLayout', () => {
  it('keeps the whole core visible on a landscape tablet', () => {
    const { view, zoom } = computeLayout(1366, 1024);
    expect(zoom).toBeCloseTo(1366 / CORE_W);
    expect(view.left).toBeCloseTo(0);
    expect(view.right).toBeCloseTo(CORE_W);
    expect(view.top).toBeLessThanOrEqual(0);
    expect(view.bottom).toBeGreaterThanOrEqual(CORE_H);
    expect(view.seatInset).toBe(96);
  });

  it.each([[390, 844], [844, 390], [768, 1024]])('shows the same world area at %i x %i', (w, h) => {
    expect(area(w, h)).toBeCloseTo(CORE_W * CORE_H, 0);
  });

  it('keeps fish large enough to tap on a portrait phone', () => {
    const { zoom } = computeLayout(390, 844);
    expect(zoom * 60).toBeGreaterThan(20);
  });

  it('always centres on the core, where the camera looks', () => {
    for (const [w, h] of [[390, 844], [844, 390], [768, 1024], [1180, 820]] as const) {
      const { view } = computeLayout(w, h);
      expect((view.left + view.right) / 2).toBeCloseTo(CORE_W / 2);
      expect((view.top + view.bottom) / 2).toBeCloseTo(CORE_H / 2);
    }
  });

  it('seats the cannon in the compact bottom row, above the home indicator', () => {
    const { zoom, view } = computeLayout(390, 844, 34);
    expect((view.seatInset ?? 0) * zoom).toBeCloseTo(78);
  });

  it('makes a lock tap at least 22 CSS px wide on a phone', () => {
    const { zoom, view } = computeLayout(390, 844);
    expect((view.tapSlop ?? 0) * zoom).toBeCloseTo(22);
  });

  it('agrees with the compact media query at its edges', () => {
    expect(isCompact(390, 844)).toBe(true);
    expect(isCompact(844, 390)).toBe(true);
    expect(isCompact(768, 1024)).toBe(false);
    expect(isCompact(744, 1133)).toBe(false);
    expect(isCompact(1180, 820)).toBe(false);
  });
});
