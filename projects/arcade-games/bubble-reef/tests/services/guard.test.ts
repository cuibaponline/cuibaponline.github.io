import { describe, expect, it } from 'vitest';
import { mayReloadAfterContextLoss } from '../../src/services/guard';

const memory = (): Pick<Storage, 'getItem' | 'setItem'> => {
  const items = new Map<string, string>();
  return { getItem: (k) => items.get(k) ?? null, setItem: (k, v) => void items.set(k, v) };
};

describe('mayReloadAfterContextLoss', () => {
  it('stops reloading after the second loss in a row', () => {
    const store = memory();
    expect(mayReloadAfterContextLoss(store, 1000)).toBe(true);
    expect(mayReloadAfterContextLoss(store, 2000)).toBe(false);
  });

  it('forgets a loss from long ago', () => {
    const store = memory();
    mayReloadAfterContextLoss(store, 1000);
    expect(mayReloadAfterContextLoss(store, 200_000)).toBe(true);
  });

  it('treats a damaged record as no losses', () => {
    const store = memory();
    store.setItem('bubble-reef-context-losses', '{nope');
    expect(mayReloadAfterContextLoss(store, 1000)).toBe(true);
  });

  it('will not reload blindly when it cannot keep count', () => {
    const store = { getItem: () => null, setItem: () => { throw new Error('full'); } };
    expect(mayReloadAfterContextLoss(store, 1000)).toBe(false);
  });
});
