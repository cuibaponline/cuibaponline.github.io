import { ParentalService, type LimitKind } from '../../src/services/parental';
import { SaveService } from '../../src/services/save';
import type { SaveData } from '../../src/services/saveSchema';
import { MemoryKv, manualClock, type ManualClock } from './helpers';

/** Local wall time, so tests read the same in every timezone. Month is 1-based. */
export function local(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
  return new Date(year, month - 1, day, hour, minute, second).getTime();
}

// June has no DST change in any common zone. 2026-06-03 is a Wednesday.
export const WEDNESDAY_NOON = local(2026, 6, 3, 12);

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

export interface RigOptions {
  at?: number;
  /** Adjust the save before the service starts. Parental secrets are already filled in. */
  configure?: (save: SaveData) => void;
  setupDone?: boolean;
}

/** A ParentalService on a real SaveService. Only the disk and the clocks are fake. */
export class Rig {
  readonly kv = new MemoryKv();
  readonly clock: ManualClock;
  store!: SaveService;
  svc!: ParentalService;
  warnings: number[] = [];
  limits: LimitKind[] = [];
  zoneExpiries = 0;

  constructor(at: number) {
    this.clock = manualClock(at);
  }

  private attach(): void {
    this.svc = new ParentalService(this.store, this.clock);
    this.svc.on('warning', (minutes) => this.warnings.push(minutes));
    this.svc.on('limit', (kind) => this.limits.push(kind));
    this.svc.on('parentZoneExpired', () => {
      this.zoneExpiries++;
    });
  }

  async start(options: RigOptions): Promise<this> {
    this.store = new SaveService({ storage: this.kv });
    await this.store.load();
    if (options.setupDone !== false) {
      this.store.update((d) => {
        d.parental.pinHash = 'stub';
        d.parental.pinSalt = 'stub';
        d.parental.recoveryHash = 'stub';
        d.parental.recoverySalt = 'stub';
      });
    }
    if (options.configure) this.store.update(options.configure);
    await this.store.saveNow();
    this.attach();
    return this;
  }

  get save(): SaveData {
    return this.store.get();
  }

  /** One-second ticks of real time. */
  play(seconds: number): void {
    for (let i = 0; i < seconds; i++) {
      this.clock.advance(1000);
      this.svc.tick();
    }
  }

  /** As play(), but queued saves run between ticks the way they do on a device. */
  async playLive(seconds: number): Promise<void> {
    for (let i = 0; i < seconds; i++) {
      this.play(1);
      await settle();
    }
  }

  /** The process dies, `awayMs` passes, the app opens again. Whatever was not written is gone. */
  async relaunch(awayMs = 0): Promise<void> {
    await settle();
    this.kv.relaunch();
    this.clock.advanceWallOnly(awayMs);
    this.clock.restartMono();
    this.store = new SaveService({ storage: this.kv });
    await this.store.load();
    this.warnings = [];
    this.limits = [];
    this.attach();
  }
}

export const rig = (options: RigOptions = {}): Promise<Rig> =>
  new Rig(options.at ?? WEDNESDAY_NOON).start(options);
