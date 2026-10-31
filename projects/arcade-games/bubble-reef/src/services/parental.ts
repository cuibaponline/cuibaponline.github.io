import {
  generateRecoveryCode,
  hashSecret,
  isTrivialPin,
  normalizeRecoveryCode,
  verifySecret,
} from './pin';
import {
  GRANT_UNLIMITED,
  createDefaultSave,
  isSetupComplete,
  type PlayWindow,
  type SaveData,
  type UsageDay,
} from './saveSchema';

const MAX_TICK_CREDIT_MS = 3000;
const PERSIST_EVERY_MS = 10_000;
const CLOCK_JUMP_MS = 5 * 60_000;
const HISTORY_DAYS = 30;
const WARNING_MINUTES = [1, 5] as const; // lowest first, so a jump past both reports the nearer one
const WRAP_UP_CAP_MS = 30_000;
const PARENT_ZONE_IDLE_MS = 60_000;
const LOCKOUT_AFTER_ATTEMPTS = 5;
const LOCKOUT_BASE_MS = 60_000;
const LOCKOUT_MAX_MS = 15 * 60_000;

export interface ParentalClock {
  wallNow(): number; // Date.now()
  monoNow(): number; // performance.now()
}

/** `saveNow` must not reject; SaveService reports failures through `saveError` instead. */
export interface ParentalStore {
  get(): SaveData;
  update(fn: (data: SaveData) => void): void;
  saveNow(): Promise<void>;
}

export type LimitKind = 'daily' | 'session' | 'break' | 'window';
export type BlockReason = 'ok' | 'daily' | 'break' | 'window';
export type GrantAmount = 10 | 20 | 30 | 'unlimited';

export interface ParentalStatus {
  allowed: boolean;
  reason: BlockReason;
  /** Seconds until the next stop of any kind. 0 when blocked, null when nothing limits play. */
  remainingSec: number | null;
  nextLimit: LimitKind | null;
  /** Null when the daily limit is off or unlimited time was granted. */
  dailyRemainingSec: number | null;
  breakRemainingSec: number;
  usedTodaySec: number;
  dayKey: string;
  /** A limit fired and the game has not called wrapUpFinished() yet. `allowed` is already false. */
  wrappingUp: boolean;
  parentZoneOpen: boolean;
  pinLockedSec: number;
  setupComplete: boolean;
  showTimerToChild: boolean;
}

export interface ParentalEvents {
  warning: (minutes: 1 | 5) => void;
  limit: (kind: LimitKind) => void;
  parentZoneExpired: () => void;
}

type ParentalData = SaveData['parental'];

export type ParentalSettings = Pick<
  ParentalData,
  | 'dailyLimitMin'
  | 'weekendLimitMin'
  | 'sessionLimitMin'
  | 'breakEveryMin'
  | 'breakLengthMin'
  | 'playWindow'
  | 'dayResetTime'
  | 'difficultyLock'
  | 'showTimerToChild'
>;

const SETTING_KEYS = [
  'dailyLimitMin',
  'weekendLimitMin',
  'sessionLimitMin',
  'breakEveryMin',
  'breakLengthMin',
  'playWindow',
  'dayResetTime',
  'difficultyLock',
  'showTimerToChild',
] as const;

export interface SetupInput {
  pin: string;
  confirmPin: string;
  /** Pass the code from generateRecoveryCode() the wizard showed; otherwise one is generated. */
  recoveryCode?: string;
  dailyLimitMin?: number | null;
  playWindow?: PlayWindow | null;
}

export type SetupResult =
  | { ok: true; recoveryCode: string }
  | { ok: false; error: 'already-set' | 'pin-mismatch' | 'trivial-pin' | 'invalid-settings' };

export interface PinResult {
  ok: boolean;
  lockedForSec: number;
  attemptsLeft: number;
}

export type PinChangeResult =
  | { ok: true }
  | { ok: false; error: 'wrong-pin' | 'locked' | 'trivial-pin'; lockedForSec: number };

export type PinRecoveryResult = { ok: true } | { ok: false; error: 'wrong-code' | 'trivial-pin' };

export interface UsageEntry {
  dayKey: string;
  activeSec: number;
  sessions: number;
  clockChanged: boolean;
}

const HM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function hmToMinutes(hm: string): number {
  const match = HM_PATTERN.exec(hm);
  return match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
}

function formatDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Local calendar fields rather than subtracting the offset, so DST days reset at the right time. */
export function dayKeyFor(wall: number, resetTime: string): string {
  const now = new Date(wall);
  const beforeReset = now.getHours() * 60 + now.getMinutes() < hmToMinutes(resetTime);
  return formatDay(beforeReset ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1) : now);
}

function parseDayKey(key: string): [year: number, month: number, day: number] {
  const [year = 0, month = 1, day = 1] = key.split('-').map(Number);
  return [year, month, day];
}

function isWeekendKey(key: string): boolean {
  const [year, month, day] = parseDayKey(key);
  const weekday = new Date(year, month - 1, day).getDay();
  return weekday === 0 || weekday === 6;
}

function shiftDayKey(key: string, days: number): string {
  const [year, month, day] = parseDayKey(key);
  return formatDay(new Date(year, month - 1, day + days));
}

function daysBetween(a: string, b: string): number {
  const utc = (key: string): number => {
    const [year, month, day] = parseDayKey(key);
    return Date.UTC(year, month - 1, day);
  };
  return (utc(a) - utc(b)) / 86_400_000;
}

/** Start inclusive, end exclusive; `end` before `start` wraps past midnight. */
function isInsideWindow(wall: number, window: PlayWindow): boolean {
  const now = new Date(wall);
  const seconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const start = hmToMinutes(window.start) * 60;
  const end = hmToMinutes(window.end) * 60;
  return start <= end ? seconds >= start && seconds < end : seconds >= start || seconds < end;
}

function secondsUntil(wall: number, hm: string): number {
  const now = new Date(wall);
  const minutes = hmToMinutes(hm);
  const at = (dayOffset: number): number =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, 0, minutes).getTime();
  const target = at(0) > wall ? at(0) : at(1);
  return Math.ceil((target - wall) / 1000);
}

function ensureDay(data: SaveData, key: string): UsageDay {
  const { days, sessionSec } = data.usage;
  const existing = days[key];
  if (existing) return existing;

  const day: UsageDay = { activeSec: 0, sessions: sessionSec > 0 ? 1 : 0 };
  days[key] = day;
  // Measured from the current key, which may not be the newest if the clock was wound back.
  for (const other of Object.keys(days)) {
    if (Math.abs(daysBetween(other, key)) >= HISTORY_DAYS) delete days[other];
  }
  return day;
}

function lockoutMs(failedAttempts: number): number {
  if (failedAttempts < LOCKOUT_AFTER_ATTEMPTS) return 0;
  const doublings = failedAttempts - LOCKOUT_AFTER_ATTEMPTS;
  return Math.min(LOCKOUT_BASE_MS * 2 ** doublings, LOCKOUT_MAX_MS);
}

function isLimitChoice(value: number | null, min: number, max: number, step: number): boolean {
  if (value === null) return true;
  return Number.isInteger(value) && value >= min && value <= max && (value - min) % step === 0;
}

function isValidPlayWindow(window: PlayWindow | null): boolean {
  if (window === null) return true;
  const { start, end } = window;
  return HM_PATTERN.test(start) && HM_PATTERN.test(end) && start !== end;
}

function isValidSettings(patch: Partial<ParentalSettings>): boolean {
  const { dailyLimitMin, weekendLimitMin, sessionLimitMin, breakEveryMin } = patch;
  const { breakLengthMin, playWindow, dayResetTime, difficultyLock, showTimerToChild } = patch;
  return (
    (dailyLimitMin === undefined || isLimitChoice(dailyLimitMin, 10, 180, 5)) &&
    (weekendLimitMin === undefined || isLimitChoice(weekendLimitMin, 10, 180, 5)) &&
    (sessionLimitMin === undefined || isLimitChoice(sessionLimitMin, 10, 60, 1)) &&
    (breakEveryMin === undefined || breakEveryMin === null || [15, 20, 30].includes(breakEveryMin)) &&
    (breakLengthMin === undefined || [2, 5, 10].includes(breakLengthMin)) &&
    (playWindow === undefined || isValidPlayWindow(playWindow)) &&
    (dayResetTime === undefined || hmToMinutes(dayResetTime) <= 5 * 60) &&
    (difficultyLock === undefined || [null, 'easy', 'medium', 'hard'].includes(difficultyLock)) &&
    (showTimerToChild === undefined || typeof showTimerToChild === 'boolean')
  );
}

export class ParentalService {
  private readonly store: ParentalStore;
  private readonly clock: ParentalClock;
  private readonly listeners: { [E in keyof ParentalEvents]: Set<ParentalEvents[E]> } = {
    warning: new Set(),
    limit: new Set(),
    parentZoneExpired: new Set(),
  };

  private visible: boolean;
  private lastMono: number;
  private lastPersistMono: number;
  private carryMs = 0;
  private wasAllowed: boolean;
  private lastRemaining: number | null;
  private wrapUp: { kind: LimitKind; countedMs: number } | null = null;
  private zone: { wall: number; mono: number } | null = null;
  private pinPassed = false;
  private pinQueue: Promise<unknown> = Promise.resolve();

  /** Create after the store has loaded. Pass `visible: false` if the app launched hidden. */
  constructor(store: ParentalStore, clock: ParentalClock, options: { visible?: boolean } = {}) {
    this.store = store;
    this.clock = clock;
    this.visible = options.visible ?? true;
    this.lastMono = clock.monoNow();
    this.lastPersistMono = this.lastMono;
    // A limit already in force at launch is not a new crossing, so it raises no event.
    const status = this.status();
    this.wasAllowed = status.allowed;
    this.lastRemaining = status.allowed ? status.remainingSec : null;
  }

  on<E extends keyof ParentalEvents>(event: E, fn: ParentalEvents[E]): () => void {
    const listeners = this.listeners[event] as Set<ParentalEvents[E]>;
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  /** Call about once a second. Safe at any rate, and after any gap. */
  tick(): void {
    const mono = this.clock.monoNow();
    const elapsed = Math.min(Math.max(mono - this.lastMono, 0), MAX_TICK_CREDIT_MS);
    this.lastMono = mono;

    const zoneWasOpen = this.zone !== null;
    this.closeIdleParentZone();
    if (!this.visible) return;

    const dayKey = this.sync(this.clock.wallNow());
    if (!isSetupComplete(this.store.get())) return;

    // wasAllowed is the state when this interval began, so lock-screen time is never charged,
    // while the wrap-up is, so it cannot become free time after a grant.
    if (!zoneWasOpen && (this.wasAllowed || this.wrapUp)) this.credit(elapsed, dayKey);
    if (this.wrapUp && !zoneWasOpen) {
      this.wrapUp.countedMs += elapsed;
      if (this.wrapUp.countedMs >= WRAP_UP_CAP_MS) this.wrapUpFinished();
    }
    if (!this.zone) this.enforce();
    if (mono - this.lastPersistMono >= PERSIST_EVERY_MS) void this.persist();
  }

  /** Call from visibilitychange and pagehide. Resolves once the hide has been written. */
  setVisible(visible: boolean): Promise<void> {
    if (visible) {
      if (!this.visible) {
        this.visible = true;
        this.lastMono = this.clock.monoNow();
        this.tick();
      }
      return Promise.resolve();
    }
    if (this.visible) {
      this.tick();
      this.visible = false;
    }
    return this.persist();
  }

  status(): ParentalStatus {
    this.closeIdleParentZone();
    const wall = this.clock.wallNow();
    const dayKey = this.sync(wall);
    const save = this.store.get();
    const { parental: p, usage: u } = save;

    const daily = this.dailyRemaining(save, dayKey);
    const breakRemainingSec = u.breakUntil === null ? 0 : Math.max(0, Math.ceil((u.breakUntil - wall) / 1000));

    let reason: BlockReason = 'ok';
    if (daily === 0) reason = 'daily';
    else if (p.playWindow && !isInsideWindow(wall, p.playWindow)) reason = 'window';
    else if (breakRemainingSec > 0) reason = 'break';
    const allowed = reason === 'ok';

    const stops: [LimitKind, number | null][] = [
      ['daily', daily],
      ['window', p.playWindow ? secondsUntil(wall, p.playWindow.end) : null],
      ['session', p.sessionLimitMin === null ? null : Math.max(0, p.sessionLimitMin * 60 - u.sessionSec)],
      ['break', p.breakEveryMin === null ? null : Math.max(0, p.breakEveryMin * 60 - u.sessionSec)],
    ];
    let remainingSec: number | null = null;
    let nextLimit: LimitKind | null = null;
    for (const [kind, seconds] of stops) {
      if (seconds !== null && (remainingSec === null || seconds < remainingSec)) {
        remainingSec = seconds;
        nextLimit = kind;
      }
    }

    return {
      allowed,
      reason,
      remainingSec: allowed ? remainingSec : 0,
      nextLimit: allowed ? nextLimit : null,
      dailyRemainingSec: daily,
      breakRemainingSec,
      usedTodaySec: u.days[dayKey]?.activeSec ?? 0,
      dayKey,
      wrappingUp: this.wrapUp !== null,
      parentZoneOpen: this.zone !== null,
      pinLockedSec: Math.ceil(this.lockRemainingMs(wall) / 1000),
      setupComplete: isSetupComplete(save),
      showTimerToChild: p.showTimerToChild,
    };
  }

  /** The game calls this when "Last catch!" ends, or at once from a menu. Starts any locked break. */
  wrapUpFinished(): ParentalStatus {
    if (this.wrapUp) {
      const { kind } = this.wrapUp;
      this.wrapUp = null;
      if (kind === 'session' || kind === 'break') this.startBreak();
      this.store.update((d) => {
        d.usage.sessionSec = 0;
      });
      void this.persist();
    }
    return this.status();
  }

  async grant(amount: GrantAmount): Promise<void> {
    const dayKey = this.sync(this.clock.wallNow());
    this.store.update((d) => {
      const unlimited = amount === 'unlimited' || d.usage.grantSec === GRANT_UNLIMITED;
      d.usage.grantSec = unlimited ? GRANT_UNLIMITED : d.usage.grantSec + amount * 60;
      d.usage.grantDayKey = dayKey;
    });
    this.rebaseline();
    await this.persist();
  }

  /** A parent's early release from a locked break. */
  async endBreak(): Promise<void> {
    this.store.update((d) => {
      if (d.usage.breakUntil === null) return;
      d.usage.breakUntil = null;
      d.usage.sessionSec = 0;
    });
    this.rebaseline();
    await this.persist();
  }

  /** Applies all of `patch` or, if any field is outside §13.3's options, none of it. */
  async updateSettings(patch: Partial<ParentalSettings>): Promise<boolean> {
    if (!isValidSettings(patch)) return false;
    this.store.update((d) => {
      for (const key of SETTING_KEYS) {
        if (patch[key] !== undefined) Object.assign(d.parental, { [key]: patch[key] });
      }
    });
    this.rebaseline();
    await this.persist();
    return true;
  }

  usageHistory(days = 14): UsageEntry[] {
    const today = this.sync(this.clock.wallNow());
    const record = this.store.get().usage.days;
    return Array.from({ length: days }, (_, index) => {
      const dayKey = shiftDayKey(today, index - days + 1);
      const day = record[dayKey];
      return {
        dayKey,
        activeSec: day?.activeSec ?? 0,
        sessions: day?.sessions ?? 0,
        clockChanged: day?.clockChanged === true,
      };
    });
  }

  /** Clears the child's progress. PIN, limits, settings and usage stay. */
  async resetProgress(): Promise<void> {
    this.store.update((d) => {
      d.profile = createDefaultSave().profile;
    });
    await this.persist();
  }

  setupParent(input: SetupInput): Promise<SetupResult> {
    return this.serialised(async (): Promise<SetupResult> => {
      const { pin, confirmPin, dailyLimitMin, playWindow } = input;
      if (isSetupComplete(this.store.get())) return { ok: false, error: 'already-set' };
      if (pin !== confirmPin) return { ok: false, error: 'pin-mismatch' };
      if (isTrivialPin(pin)) return { ok: false, error: 'trivial-pin' };
      if (!isValidSettings({ dailyLimitMin, playWindow })) return { ok: false, error: 'invalid-settings' };

      const recoveryCode = normalizeRecoveryCode(input.recoveryCode ?? generateRecoveryCode());
      const pinSecret = await hashSecret(pin);
      const recoverySecret = await hashSecret(recoveryCode);
      this.store.update((d) => {
        const p = d.parental;
        p.pinHash = pinSecret.hash;
        p.pinSalt = pinSecret.salt;
        p.recoveryHash = recoverySecret.hash;
        p.recoverySalt = recoverySecret.salt;
        if (dailyLimitMin !== undefined) p.dailyLimitMin = dailyLimitMin;
        if (playWindow !== undefined) p.playWindow = playWindow;
      });
      this.rebaseline();
      await this.persist();
      return { ok: true, recoveryCode };
    });
  }

  /** Success also unlocks one enterParentZone(). */
  verifyPin(pin: string): Promise<PinResult> {
    return this.serialised(async () => {
      const result = await this.attemptPin(pin);
      if (result.ok) this.pinPassed = true;
      return result;
    });
  }

  changePin(currentPin: string, newPin: string): Promise<PinChangeResult> {
    return this.serialised(async (): Promise<PinChangeResult> => {
      if (isTrivialPin(newPin)) return { ok: false, error: 'trivial-pin', lockedForSec: 0 };

      this.sync(this.clock.wallNow());
      const lockedMs = this.lockRemainingMs(this.clock.wallNow());
      if (lockedMs > 0) return { ok: false, error: 'locked', lockedForSec: Math.ceil(lockedMs / 1000) };

      const attempt = await this.attemptPin(currentPin);
      if (!attempt.ok) return { ok: false, error: 'wrong-pin', lockedForSec: attempt.lockedForSec };
      await this.storePin(newPin);
      return { ok: true };
    });
  }

  /** Not subject to the PIN lockout: it is the way out of one, and 8 random characters resist guessing. */
  resetPinWithRecovery(code: string, newPin: string): Promise<PinRecoveryResult> {
    return this.serialised(async (): Promise<PinRecoveryResult> => {
      if (isTrivialPin(newPin)) return { ok: false, error: 'trivial-pin' };
      const { recoveryHash, recoverySalt } = this.store.get().parental;
      if (!(await verifySecret(normalizeRecoveryCode(code), recoveryHash, recoverySalt))) {
        return { ok: false, error: 'wrong-code' };
      }
      await this.storePin(newPin);
      this.pinPassed = true;
      return { ok: true };
    });
  }

  /** Requires a fresh verifyPin(): otherwise leaving a PIN pad open would pause the clock. */
  enterParentZone(): boolean {
    if (!this.pinPassed) return false;
    this.pinPassed = false;
    this.tick();
    this.zone = { wall: this.clock.wallNow(), mono: this.clock.monoNow() };
    return true;
  }

  exitParentZone(): void {
    if (!this.zone) return;
    this.zone = null;
    this.lastMono = this.clock.monoNow();
    void this.persist();
  }

  /** Call on any input inside the Parent Zone. */
  parentActivity(): void {
    this.closeIdleParentZone();
    if (this.zone) this.zone = { wall: this.clock.wallNow(), mono: this.clock.monoNow() };
  }

  /** The day in use, which may differ from the calendar date: see §13.5 and the day reset time. */
  dayKey(): string {
    return this.sync(this.clock.wallNow());
  }

  /** Credits the time so far and writes it. For pagehide, which can arrive with no hide event. */
  flush(): Promise<void> {
    this.tick();
    return this.persist();
  }

  /** Writes without crediting. Prefer flush() from app code. */
  persist(): Promise<void> {
    this.lastPersistMono = this.clock.monoNow();
    return this.store.saveNow();
  }

  private emit<E extends keyof ParentalEvents>(event: E, ...args: Parameters<ParentalEvents[E]>): void {
    for (const fn of this.listeners[event]) {
      try {
        (fn as (...a: Parameters<ParentalEvents[E]>) => void)(...args);
      } catch (error) {
        // A broken toast must not stop the limit behind it.
        console.error(error);
      }
    }
  }

  private serialised<T>(task: () => Promise<T>): Promise<T> {
    const run = this.pinQueue.then(task);
    this.pinQueue = run.catch(() => undefined);
    return run;
  }

  private sync(wall: number): string {
    let dayKey = '';
    this.store.update((d) => {
      dayKey = this.syncUsage(d, wall);
    });
    return dayKey;
  }

  /** Brings stored usage up to `wall`: clock changes, breaks, the day in use. Idempotent. */
  private syncUsage(d: SaveData, wall: number): string {
    const { usage: u, parental: p } = d;
    const seen = u.lastSeenWallClock;
    const wallKey = dayKeyFor(wall, p.dayResetTime);
    const breakMs = p.breakLengthMin * 60_000;

    if (seen > 0 && wall < seen) {
      const heldKey = u.clockPin?.dayKey ?? dayKeyFor(seen, p.dayResetTime);
      const jumped = seen - wall > CLOCK_JUMP_MS;
      if (jumped || wallKey !== heldKey) u.clockPin = { dayKey: heldKey, wallDayKey: wallKey };
      if (jumped) ensureDay(d, heldKey).clockChanged = true;
      u.lastSeenWallClock = wall;
    } else if (u.clockPin && wallKey !== u.clockPin.wallDayKey) {
      // The new clock reached its next day, so a wrong clock cannot hold one day for ever.
      u.clockPin = null;
    }

    // Time away as long as the locked break counts as having taken it. A shorter one does not,
    // or killing the app would reset the session.
    if (seen > 0 && wall - seen >= breakMs) u.sessionSec = 0;

    // A clock wound back must not stretch either wait, and the stored end has to move as well
    // or the wait would stop counting down until the clock caught up.
    if (u.breakUntil !== null && u.breakUntil - wall > breakMs) u.breakUntil = wall + breakMs;
    if (u.breakUntil !== null && wall >= u.breakUntil) {
      u.breakUntil = null;
      u.sessionSec = 0;
    }
    const lockMaxMs = lockoutMs(p.failedAttempts);
    if (p.lockoutUntil !== null && p.lockoutUntil - wall > lockMaxMs) p.lockoutUntil = wall + lockMaxMs;

    const dayKey = u.clockPin?.dayKey ?? wallKey;
    ensureDay(d, dayKey);
    if (u.grantDayKey !== dayKey) {
      u.grantSec = 0;
      u.grantDayKey = dayKey;
    }
    if (this.visible) u.lastSeenWallClock = wall;
    return dayKey;
  }

  private dailyRemaining(save: SaveData, dayKey: string): number | null {
    const { parental: p, usage: u } = save;
    const weekend = isWeekendKey(dayKey) && p.weekendLimitMin !== null;
    const limitMin = weekend ? p.weekendLimitMin : p.dailyLimitMin;
    if (limitMin === null || u.grantSec === GRANT_UNLIMITED) return null;
    return Math.max(0, limitMin * 60 + u.grantSec - (u.days[dayKey]?.activeSec ?? 0));
  }

  private credit(elapsedMs: number, dayKey: string): void {
    this.carryMs += elapsedMs;
    const seconds = Math.floor(this.carryMs / 1000);
    if (seconds === 0) return;
    this.carryMs -= seconds * 1000;
    this.store.update((d) => {
      const day = ensureDay(d, dayKey);
      if (d.usage.sessionSec === 0) day.sessions += 1;
      day.activeSec += seconds;
      d.usage.sessionSec += seconds;
    });
  }

  private enforce(): void {
    const before = this.status();
    // Only session and break stops can reach zero while play is still allowed.
    const due = before.allowed && before.remainingSec === 0 ? before.nextLimit : null;
    // Armed now, not at wrapUpFinished(), so killing the app during "Last catch!" can't dodge it.
    if (due) this.startBreak();
    const now = due ? this.status() : before;

    const crossed = (this.wasAllowed || before.allowed) && !now.allowed;
    this.wasAllowed = now.allowed;
    if (now.allowed) this.wrapUp = null;

    this.fireWarning(now);
    if (!crossed) return;
    const kind = due ?? (now.reason as LimitKind);
    this.wrapUp = { kind, countedMs: 0 };
    void this.persist();
    this.emit('limit', kind);
  }

  private fireWarning(status: ParentalStatus): void {
    const previous = this.lastRemaining;
    const remaining = status.allowed ? status.remainingSec : null;
    this.lastRemaining = remaining;
    if (previous === null || remaining === null) return;

    const mark = WARNING_MINUTES.find((minutes) => previous > minutes * 60 && remaining <= minutes * 60);
    if (mark === undefined) return;
    // Written now: the 10 s save could lag, and a relaunch would then cross this mark again.
    void this.persist();
    this.emit('warning', mark);
  }

  /** After a parent changes the numbers, so the jump in remaining time is not read as a crossing. */
  private rebaseline(): void {
    const status = this.status();
    this.lastRemaining = status.allowed ? status.remainingSec : null;
    this.wasAllowed ||= status.allowed;
  }

  private startBreak(): void {
    const wall = this.clock.wallNow();
    this.store.update((d) => {
      d.usage.breakUntil = wall + d.parental.breakLengthMin * 60_000;
    });
  }

  private closeIdleParentZone(): void {
    if (!this.zone) return;
    const wall = this.clock.wallNow();
    const mono = this.clock.monoNow();
    // Either clock alone can lie: mono may stall in sleep, and the wall clock can be wound back.
    if (Math.max(wall - this.zone.wall, mono - this.zone.mono) < PARENT_ZONE_IDLE_MS) return;
    this.zone = null;
    this.lastMono = mono;
    this.emit('parentZoneExpired');
  }

  private lockRemainingMs(wall: number): number {
    const { lockoutUntil } = this.store.get().parental;
    return lockoutUntil === null ? 0 : Math.max(0, lockoutUntil - wall);
  }

  private async attemptPin(pin: string): Promise<PinResult> {
    this.sync(this.clock.wallNow());
    const lockedMs = this.lockRemainingMs(this.clock.wallNow());
    if (lockedMs > 0) return { ok: false, lockedForSec: Math.ceil(lockedMs / 1000), attemptsLeft: 0 };

    const { pinHash, pinSalt } = this.store.get().parental;
    const correct = await verifySecret(pin, pinHash, pinSalt);
    const wall = this.clock.wallNow();
    this.store.update(({ parental: p }) => {
      p.failedAttempts = correct ? 0 : p.failedAttempts + 1;
      const lockMs = lockoutMs(p.failedAttempts);
      p.lockoutUntil = lockMs > 0 ? wall + lockMs : null;
    });
    await this.persist();

    const { failedAttempts } = this.store.get().parental;
    return {
      ok: correct,
      lockedForSec: lockoutMs(failedAttempts) / 1000,
      attemptsLeft: Math.max(0, LOCKOUT_AFTER_ATTEMPTS - failedAttempts),
    };
  }

  private async storePin(pin: string): Promise<void> {
    const { hash, salt } = await hashSecret(pin);
    this.store.update(({ parental: p }) => {
      p.pinHash = hash;
      p.pinSalt = salt;
      p.failedAttempts = 0;
      p.lockoutUntil = null;
    });
    await this.persist();
  }
}
