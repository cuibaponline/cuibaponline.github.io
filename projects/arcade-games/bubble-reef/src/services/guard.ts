const INSTANCE_LOCK = 'bubble-reef-instance';
const LOSS_KEY = 'bubble-reef-context-losses';
const WAITING_NOTICE_MS = 1500;
const MAX_RELOADS = 1;
/** Losses further apart than this are unrelated, and the count starts again. */
const LOSS_WINDOW_MS = 60_000;

type Locks = Pick<LockManager, 'request'>;

/**
 * Resolves once this is the only copy of the game running, and keeps it that way until the tab closes. Each tab holds
 * its own copy of the save, so a second one would let a child play past a limit and overwrite progress with stale data.
 */
export function holdSingleInstance(onWaiting: () => void, locks: Locks | undefined = globalThis.navigator?.locks): Promise<void> {
  if (!locks) return Promise.resolve();
  return new Promise((resolve) => {
    // A reload briefly overlaps the page it replaces, so say nothing unless the wait goes on.
    const notice = setTimeout(onWaiting, WAITING_NOTICE_MS);
    const acquired = (): void => {
      clearTimeout(notice);
      resolve();
    };
    locks
      .request(INSTANCE_LOCK, () => {
        acquired();
        return new Promise<never>(() => {});
      })
      .catch(acquired);
  });
}

/** False once reloading has stopped helping, so a memory failure at boot can't reload for ever. */
export function mayReloadAfterContextLoss(storage: Pick<Storage, 'getItem' | 'setItem'>, now: number): boolean {
  let count = 0;
  let last = 0;
  try {
    const stored = JSON.parse(storage.getItem(LOSS_KEY) ?? '{}') as { count?: number; last?: number };
    count = stored.count ?? 0;
    last = stored.last ?? 0;
  } catch {
    // A damaged record counts as none.
  }
  count = now - last > LOSS_WINDOW_MS ? 1 : count + 1;
  try {
    storage.setItem(LOSS_KEY, JSON.stringify({ count, last: now }));
  } catch {
    return false;
  }
  return count <= MAX_RELOADS;
}
