import type { Difficulty } from '../config';

export type { Difficulty };

export const CURRENT_SCHEMA_VERSION = 1;

/** `usage.grantSec` value for "unlimited for the rest of today". Infinity would not survive JSON. */
export const GRANT_UNLIMITED = -1;

export interface PlayWindow {
  start: string; // "07:00"
  end: string;
}

export interface UsageDay {
  activeSec: number;
  sessions: number;
  clockChanged?: boolean;
}

/** Day key held after the clock went backwards, until `wallDayKey` stops being the wall-clock day. */
export interface ClockPin {
  dayKey: string;
  wallDayKey: string;
}

export interface SaveData {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  profile: {
    coins: number;
    xp: number;
    level: number;
    maxCannonLevel: 1 | 2 | 3 | 4 | 5;
    unlockedOceans: string[];
    ownedSkins: string[];
    selectedSkin: string;
    fishBook: Record<string, { caught: number; firstCaughtAt: string }>;
    bestWave: Record<Difficulty, number>;
    easyWavesCompleted: number;
    easyWaveShots: number;
    easyWaveHits: number;
    lastMediumPromptDay: string | null;
    levelSeen: number;
  };
  settings: {
    musicVolume: number; // 0..1
    sfxVolume: number; // 0..1
    controlMode: 'tap' | 'joystick';
    leftHanded: boolean;
    reduceFlashing: boolean;
    readAloud: boolean;
    autoFire: Record<Difficulty, boolean>;
    lastDifficulty: Difficulty;
  };
  parental: {
    pinHash: string;
    pinSalt: string;
    recoveryHash: string;
    recoverySalt: string;
    dailyLimitMin: number | null; // null = off
    weekendLimitMin: number | null; // null = same as weekdays
    sessionLimitMin: number | null;
    breakEveryMin: number | null;
    breakLengthMin: number;
    playWindow: PlayWindow | null;
    dayResetTime: string; // "00:00"
    difficultyLock: Difficulty | null;
    showTimerToChild: boolean;
    failedAttempts: number;
    lockoutUntil: number | null; // epoch ms
  };
  usage: {
    days: Record<string, UsageDay>;
    grantSec: number; // extra time granted today; GRANT_UNLIMITED = unlimited
    grantDayKey: string;
    breakUntil: number | null; // epoch ms
    lastSeenWallClock: number; // epoch ms
    // Not in §17.6: these must survive a relaunch and nothing there can hold them.
    sessionSec: number; // counted seconds since the last break or long absence
    clockPin: ClockPin | null;
  };
}

export function createDefaultSave(): SaveData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: {
      coins: 0,
      xp: 0,
      level: 1,
      maxCannonLevel: 2,
      unlockedOceans: ['coral'],
      ownedSkins: ['classic'],
      selectedSkin: 'classic',
      fishBook: {},
      bestWave: { easy: 0, medium: 0, hard: 0 },
      easyWavesCompleted: 0,
      easyWaveShots: 0,
      easyWaveHits: 0,
      lastMediumPromptDay: null,
      levelSeen: 1,
    },
    settings: {
      musicVolume: 0.7,
      sfxVolume: 0.7,
      controlMode: 'tap',
      leftHanded: false,
      reduceFlashing: false,
      readAloud: true,
      autoFire: { easy: false, medium: false, hard: false },
      lastDifficulty: 'easy',
    },
    parental: {
      pinHash: '',
      pinSalt: '',
      recoveryHash: '',
      recoverySalt: '',
      dailyLimitMin: 30,
      weekendLimitMin: null,
      sessionLimitMin: null,
      breakEveryMin: null,
      breakLengthMin: 5,
      playWindow: null,
      dayResetTime: '00:00',
      difficultyLock: null,
      showTimerToChild: true,
      failedAttempts: 0,
      lockoutUntil: null,
    },
    usage: {
      days: {},
      grantSec: 0,
      grantDayKey: '',
      breakUntil: null,
      lastSeenWallClock: 0,
      sessionSec: 0,
      clockPin: null,
    },
  };
}

export function isSetupComplete(save: SaveData): boolean {
  const { pinHash, pinSalt, recoveryHash, recoverySalt } = save.parental;
  return Boolean(pinHash && pinSalt && recoveryHash && recoverySalt);
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isDifficulty = (v: unknown): v is Difficulty => v === 'easy' || v === 'medium' || v === 'hard';
const isNumOrNull = (v: unknown): boolean => v === null || isNum(v);
const isStrList = (v: unknown): boolean => Array.isArray(v) && v.every(isStr);

const perDifficulty = (v: unknown, check: (x: unknown) => boolean): boolean =>
  isObj(v) && check(v['easy']) && check(v['medium']) && check(v['hard']);

const isPlayWindow = (v: unknown): boolean => isObj(v) && isStr(v['start']) && isStr(v['end']);
const isClockPin = (v: unknown): boolean => isObj(v) && isStr(v['dayKey']) && isStr(v['wallDayKey']);

const isFishEntry = (v: unknown): boolean => isObj(v) && isNum(v['caught']) && isStr(v['firstCaughtAt']);

const isUsageDay = (v: unknown): boolean =>
  isObj(v) &&
  isNum(v['activeSec']) &&
  isNum(v['sessions']) &&
  (v['clockChanged'] === undefined || isBool(v['clockChanged']));

function isProfile(p: unknown): boolean {
  return (
    isObj(p) &&
    isNum(p['coins']) &&
    isNum(p['xp']) &&
    isNum(p['level']) &&
    [1, 2, 3, 4, 5].includes(p['maxCannonLevel'] as number) &&
    isStrList(p['unlockedOceans']) &&
    isStrList(p['ownedSkins']) &&
    isStr(p['selectedSkin']) &&
    isObj(p['fishBook']) &&
    Object.values(p['fishBook']).every(isFishEntry) &&
    perDifficulty(p['bestWave'], isNum) &&
    isNum(p['easyWavesCompleted']) &&
    isNum(p['easyWaveShots']) &&
    isNum(p['easyWaveHits']) &&
    (p['lastMediumPromptDay'] === null || isStr(p['lastMediumPromptDay'])) &&
    isNum(p['levelSeen'])
  );
}

function isSettings(s: unknown): boolean {
  return (
    isObj(s) &&
    isNum(s['musicVolume']) &&
    isNum(s['sfxVolume']) &&
    (s['controlMode'] === 'tap' || s['controlMode'] === 'joystick') &&
    isBool(s['leftHanded']) &&
    isBool(s['reduceFlashing']) &&
    isBool(s['readAloud']) &&
    perDifficulty(s['autoFire'], isBool) &&
    isDifficulty(s['lastDifficulty'])
  );
}

function isParental(p: unknown): boolean {
  return (
    isObj(p) &&
    isStr(p['pinHash']) &&
    isStr(p['pinSalt']) &&
    isStr(p['recoveryHash']) &&
    isStr(p['recoverySalt']) &&
    isNumOrNull(p['dailyLimitMin']) &&
    isNumOrNull(p['weekendLimitMin']) &&
    isNumOrNull(p['sessionLimitMin']) &&
    isNumOrNull(p['breakEveryMin']) &&
    isNum(p['breakLengthMin']) &&
    (p['playWindow'] === null || isPlayWindow(p['playWindow'])) &&
    isStr(p['dayResetTime']) &&
    (p['difficultyLock'] === null || isDifficulty(p['difficultyLock'])) &&
    isBool(p['showTimerToChild']) &&
    isNum(p['failedAttempts']) &&
    isNumOrNull(p['lockoutUntil'])
  );
}

function isUsage(u: unknown): boolean {
  return (
    isObj(u) &&
    isObj(u['days']) &&
    Object.values(u['days']).every(isUsageDay) &&
    isNum(u['grantSec']) &&
    isStr(u['grantDayKey']) &&
    isNumOrNull(u['breakUntil']) &&
    isNum(u['lastSeenWallClock']) &&
    isNum(u['sessionSec']) &&
    (u['clockPin'] === null || isClockPin(u['clockPin']))
  );
}

export function isValidSave(value: unknown): value is SaveData {
  return (
    isObj(value) &&
    value['schemaVersion'] === CURRENT_SCHEMA_VERSION &&
    isProfile(value['profile']) &&
    isSettings(value['settings']) &&
    isParental(value['parental']) &&
    isUsage(value['usage'])
  );
}

export type Migration = (save: Obj) => Obj;
export type MigrationTable = Record<number, Migration>;

function migrateV0ToV1(save: Obj): Obj {
  const profile = save['profile'] as Obj;
  const usage = save['usage'] as Obj;
  return {
    ...save,
    profile: {
      ...profile,
      easyWaveShots: 0,
      easyWaveHits: 0,
      lastMediumPromptDay: null,
      levelSeen: profile['level'],
    },
    usage: { ...usage, sessionSec: 0, clockPin: null },
  };
}

export const MIGRATIONS: MigrationTable = { 0: migrateV0ToV1 };

/** Runs every step from the save's version up to `target`. Throws if a step is missing. */
export function runMigrations(save: Obj, migrations: MigrationTable, target: number): Obj {
  let current = save;
  for (let version = current['schemaVersion'] as number; version < target; version++) {
    const step = migrations[version];
    if (!step) throw new Error(`No migration from schema v${version}`);
    current = { ...step(current), schemaVersion: version + 1 };
  }
  return current;
}

export type MigrationResult =
  | { status: 'ok'; data: SaveData; migrated: boolean }
  | { status: 'future' }
  | { status: 'invalid' };

/** Never throws. `future` means a newer build wrote this save, which is not the same as it being bad. */
export function migrateSave(raw: unknown): MigrationResult {
  if (!isObj(raw)) return { status: 'invalid' };
  const version = raw['schemaVersion'] ?? 0;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    return { status: 'invalid' };
  }
  if (version > CURRENT_SCHEMA_VERSION) return { status: 'future' };

  try {
    const copy = structuredClone({ ...raw, schemaVersion: version });
    const data = runMigrations(copy, MIGRATIONS, CURRENT_SCHEMA_VERSION);
    if (!isValidSave(data)) return { status: 'invalid' };
    return { status: 'ok', data, migrated: version < CURRENT_SCHEMA_VERSION };
  } catch {
    return { status: 'invalid' };
  }
}
