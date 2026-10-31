const LOSS_KEY = 'bubble-reef-context-losses';
const MAX_RELOADS = 1;
/** Losses further apart than this are unrelated, and the count starts again. */
const LOSS_WINDOW_MS = 60_000;

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
