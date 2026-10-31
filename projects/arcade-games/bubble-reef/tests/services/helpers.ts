import type { KeyValueStorage } from '../../src/services/save';

/** In-memory KV with failure injection. `map` is the "disk"; it outlives any service using it. */
export class MemoryKv implements KeyValueStorage {
  readonly map = new Map<string, unknown>();
  readonly log: string[] = [];
  /** Rewrites a value on its way to disk (simulates a bad write) or throws (simulates quota). */
  onSet: ((key: string, value: unknown) => unknown) | null = null;
  onGet: ((key: string) => void) | null = null;

  private gate: Promise<void> | null = null;
  private openGate: (() => void) | null = null;
  private opsUntilKill: number | null = null;
  private dead = false;

  /** Holds every later `set` until `release()`. */
  hold(): void {
    this.gate = new Promise((resolve) => {
      this.openGate = resolve;
    });
  }

  release(): void {
    this.openGate?.();
    this.gate = null;
  }

  /** After `ops` more operations the process is gone: a `set` in progress lands truncated. */
  killAfter(ops: number): void {
    this.opsUntilKill = ops;
  }

  /** A fresh launch sees the same disk. */
  relaunch(): void {
    this.dead = false;
    this.opsUntilKill = null;
    this.gate = null;
  }

  private step(): 'run' | 'dying' {
    if (this.dead) throw new Error('killed');
    if (this.opsUntilKill === null) return 'run';
    if (this.opsUntilKill-- > 0) return 'run';
    this.dead = true;
    return 'dying';
  }

  async get(key: string): Promise<unknown> {
    if (this.step() === 'dying') throw new Error('killed');
    this.log.push(`get ${key}`);
    this.onGet?.(key);
    return this.map.get(key);
  }

  async set(key: string, value: unknown): Promise<void> {
    if (this.gate) await this.gate;
    if (this.step() === 'dying') {
      if (typeof value === 'string') this.map.set(key, value.slice(0, value.length >> 1));
      throw new Error('killed');
    }
    this.log.push(`set ${key}`);
    this.map.set(key, this.onSet ? this.onSet(key, value) : value);
  }

  async del(key: string): Promise<void> {
    if (this.step() === 'dying') throw new Error('killed');
    this.log.push(`del ${key}`);
    this.map.delete(key);
  }
}

export interface ManualClock {
  wallNow(): number;
  monoNow(): number;
  /** Real time passing: both clocks advance. */
  advance(ms: number): void;
  /** Time passing while the page is frozen and performance.now() does not move. */
  advanceWallOnly(ms: number): void;
  /** Someone changing the device clock. */
  setWall(epochMs: number): void;
  /** performance.now() restarting on a relaunch. */
  restartMono(): void;
}

export function manualClock(startWall: number): ManualClock {
  let wall = startWall;
  let mono = 0;
  return {
    wallNow: () => wall,
    monoNow: () => mono,
    advance(ms) {
      wall += ms;
      mono += ms;
    },
    advanceWallOnly(ms) {
      wall += ms;
    },
    setWall(epochMs) {
      wall = epochMs;
    },
    restartMono() {
      mono = 0;
    },
  };
}
