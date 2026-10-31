import { describe, expect, it } from 'vitest';
import { holdSingleInstance, mayReloadAfterContextLoss } from '../../src/services/guard';

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

describe('holdSingleInstance', () => {
  it('goes ahead where the browser has no Web Locks', async () => {
    await expect(holdSingleInstance(() => {}, undefined)).resolves.toBeUndefined();
  });

  it('holds the lock for as long as the page lives', async () => {
    let held: Promise<unknown> | null = null;
    const locks = { request: (_: string, cb: () => Promise<unknown>) => { held = cb(); return held; } } as unknown as LockManager;
    await holdSingleInstance(() => {}, locks);
    let released = false;
    void held!.then(() => { released = true; });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(released).toBe(false);
  });

  it('goes ahead if the lock request fails', async () => {
    const locks = { request: () => Promise.reject(new Error('denied')) } as unknown as LockManager;
    await expect(holdSingleInstance(() => {}, locks)).resolves.toBeUndefined();
  });

  it('tells the player when another copy holds the lock', async () => {
    let waited = false;
    const locks = { request: () => new Promise(() => {}) } as unknown as LockManager;
    void holdSingleInstance(() => (waited = true), locks);
    await new Promise((r) => setTimeout(r, 1600));
    expect(waited).toBe(true);
  });
});
