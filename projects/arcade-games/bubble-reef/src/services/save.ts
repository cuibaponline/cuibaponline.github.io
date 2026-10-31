import { createStore, del, get, set } from 'idb-keyval';
import { createDefaultSave, isValidSave, migrateSave, type SaveData } from './saveSchema';

export interface KeyValueStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
}

export interface SaveTimers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface SaveServiceOptions {
  storage: KeyValueStorage;
  timers?: SaveTimers;
  /** Quiet period for saveSoon(). Never below 2 s (§17.7). */
  debounceMs?: number;
  /** Longest saveSoon() may be pushed back, so steady play still meets the 10 s promise (US-21). */
  maxWaitMs?: number;
  /** Told once when saving starts to fail, not on every retry. */
  onError?: (error: unknown) => void;
}

/**
 * fresh: nothing was ever stored. ok: the current slot loaded.
 * fallback: the current slot was bad, an older one loaded. reset: everything was bad, defaults loaded.
 * unavailable: storage failed or holds a newer build's save; saving is off until the next launch.
 */
export type LoadStatus = 'fresh' | 'ok' | 'fallback' | 'reset' | 'unavailable';

export interface LoadResult {
  data: SaveData;
  recovered: boolean;
  status: LoadStatus;
}

type SlotName = 'a' | 'b';

type SlotRead =
  | { kind: 'empty' }
  | { kind: 'bad' }
  | { kind: 'future' }
  | { kind: 'good'; name: SlotName; seq: number; data: SaveData; migrated: boolean };

type GoodSlot = Extract<SlotRead, { kind: 'good' }>;

export const SAVE_KEYS = { a: 'save-slot-a', b: 'save-slot-b', current: 'save-current' } as const;

const MIN_DEBOUNCE_MS = 2000;
const DEFAULT_MAX_WAIT_MS = 8000;
const READ_ATTEMPTS = 2;

const realTimers: SaveTimers = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const slotChecksum = (seq: number, json: string): string => fnv1a(`${seq}:${json}`);

function encodeSlot(seq: number, json: string): string {
  return JSON.stringify({ seq, checksum: slotChecksum(seq, json), json });
}

function decodeSlot(name: SlotName, raw: unknown): SlotRead {
  if (raw === undefined) return { kind: 'empty' };
  if (typeof raw !== 'string') return { kind: 'bad' };
  try {
    const { seq, checksum, json } = JSON.parse(raw) as { seq: unknown; checksum: unknown; json: unknown };
    if (!Number.isSafeInteger(seq) || typeof json !== 'string') return { kind: 'bad' };
    if (checksum !== slotChecksum(seq as number, json)) return { kind: 'bad' };

    const result = migrateSave(JSON.parse(json));
    if (result.status === 'future') return { kind: 'future' };
    if (result.status === 'invalid') return { kind: 'bad' };
    return { kind: 'good', name, seq: seq as number, data: result.data, migrated: result.migrated };
  } catch {
    return { kind: 'bad' };
  }
}

/** Dual-slot save: a write only ever touches the slot that is not current. */
export class SaveService {
  /** The last write's failure, or null. Saving never rejects, so this is how to find out. */
  saveError: unknown = null;

  private readonly storage: KeyValueStorage;
  private readonly timers: SaveTimers;
  private readonly debounceMs: number;
  private readonly maxWaitMs: number;
  private readonly onError: (error: unknown) => void;

  private data: SaveData = createDefaultSave();
  private loaded = false;
  private writable = true;
  private dirty = false;
  private seq = 0;
  private currentSlot: SlotName | null = null;
  private queue: Promise<void> = Promise.resolve();
  private debounceTimer: unknown = null;
  private maxWaitTimer: unknown = null;

  constructor(options: SaveServiceOptions) {
    this.storage = options.storage;
    this.timers = options.timers ?? realTimers;
    this.debounceMs = Math.max(MIN_DEBOUNCE_MS, options.debounceMs ?? MIN_DEBOUNCE_MS);
    this.maxWaitMs = Math.max(this.debounceMs, options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS);
    this.onError = options.onError ?? (() => {});
  }

  async load(): Promise<LoadResult> {
    const stored = await this.readStored();
    if (!stored) {
      // A failed read says nothing about the save, so it must not be replaced by these defaults.
      this.writable = false;
      this.loaded = true;
      return { data: this.data, recovered: true, status: 'unavailable' };
    }

    const { a, b, pointer } = stored;
    const slots = [a, b];
    const good = slots.filter((slot): slot is GoodSlot => slot.kind === 'good');
    const best = good.reduce<GoodSlot | null>((top, slot) => {
      if (!top || slot.seq > top.seq) return slot;
      return slot.seq === top.seq && slot.name === pointer ? slot : top;
    }, null);
    const anyDamage = slots.some((slot) => slot.kind === 'bad');
    const pointedAt = pointer === 'a' ? a : pointer === 'b' ? b : null;
    const currentLost = pointedAt ? pointedAt.kind === 'bad' || pointedAt.kind === 'empty' : anyDamage;

    if (best) {
      this.data = best.data;
      this.seq = best.seq;
      this.currentSlot = best.name;
    }
    this.dirty = best ? best.migrated || currentLost : false;
    this.loaded = true;

    if (slots.some((slot) => slot.kind === 'future')) {
      this.writable = false;
      return { data: this.data, recovered: true, status: 'unavailable' };
    }
    if (!best) {
      const status = anyDamage || pointer !== null ? 'reset' : 'fresh';
      return { data: this.data, recovered: status === 'reset', status };
    }
    return currentLost
      ? { data: this.data, recovered: true, status: 'fallback' }
      : { data: this.data, recovered: false, status: 'ok' };
  }

  /** The live save. Change it through update(). */
  get(): SaveData {
    return this.data;
  }

  update(fn: (data: SaveData) => void): void {
    fn(this.data);
    this.dirty = true;
  }

  /** Writes the current state; resolves once it is on disk or the attempt failed (see saveError). */
  saveNow(): Promise<void> {
    this.dirty = true;
    return this.flush();
  }

  /** Writes only if something changed, and waits for any write already in flight. */
  flush(): Promise<void> {
    this.cancelTimers();
    return this.enqueueWrite();
  }

  saveSoon(): void {
    this.dirty = true;
    if (this.debounceTimer !== null) this.timers.clearTimeout(this.debounceTimer);
    const fire = (): void => {
      void this.flush();
    };
    this.debounceTimer = this.timers.setTimeout(fire, this.debounceMs);
    this.maxWaitTimer ??= this.timers.setTimeout(fire, this.maxWaitMs);
  }

  private cancelTimers(): void {
    if (this.debounceTimer !== null) this.timers.clearTimeout(this.debounceTimer);
    if (this.maxWaitTimer !== null) this.timers.clearTimeout(this.maxWaitTimer);
    this.debounceTimer = null;
    this.maxWaitTimer = null;
  }

  private enqueueWrite(): Promise<void> {
    this.queue = this.queue.then(() => this.write());
    return this.queue;
  }

  private async write(): Promise<void> {
    if (!this.loaded || !this.dirty) return;
    if (!this.writable) {
      this.fail(new Error('Saving is off: the stored save could not be read'));
      return;
    }

    // Cleared before the first await so a change made during the write stays pending.
    this.dirty = false;
    const target: SlotName = this.currentSlot === 'a' ? 'b' : 'a';
    const key = SAVE_KEYS[target];
    try {
      if (!isValidSave(this.data)) throw new Error('Refusing to persist an invalid save');
      const seq = this.seq + 1;
      const payload = encodeSlot(seq, JSON.stringify(this.data));
      await this.storage.set(key, payload);
      if ((await this.storage.get(key)) !== payload) throw new Error('Save failed its read-back check');

      // Verified, so this slot is current even if the pointer write below fails.
      this.seq = seq;
      this.currentSlot = target;
      await this.storage.set(SAVE_KEYS.current, target);
      this.saveError = null;
    } catch (error) {
      this.dirty = true;
      this.fail(error);
    }
  }

  private fail(error: unknown): void {
    if (this.saveError === null) this.onError(error);
    this.saveError = error;
  }

  private async readStored(): Promise<{ a: SlotRead; b: SlotRead; pointer: SlotName | null } | null> {
    for (let attempt = 0; attempt < READ_ATTEMPTS; attempt++) {
      try {
        const rawA = await this.storage.get(SAVE_KEYS.a);
        const rawB = await this.storage.get(SAVE_KEYS.b);
        const pointer = await this.storage.get(SAVE_KEYS.current);
        return {
          a: decodeSlot('a', rawA),
          b: decodeSlot('b', rawB),
          pointer: pointer === 'a' || pointer === 'b' ? pointer : null,
        };
      } catch {
        // Safari can drop an IndexedDB connection; one retry reopens it.
      }
    }
    return null;
  }
}

export function createIdbStorage(dbName = 'bubble-reef', storeName = 'save'): KeyValueStorage {
  const store = createStore(dbName, storeName);
  return {
    get: (key) => get(key, store),
    set: (key, value) => set(key, value, store),
    del: (key) => del(key, store),
  };
}

/** Asks the browser not to evict the save. False if refused or unsupported. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await globalThis.navigator?.storage?.persist?.()) === true;
  } catch {
    return false;
  }
}
