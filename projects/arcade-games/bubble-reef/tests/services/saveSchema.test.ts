import { describe, expect, it } from 'vitest';
import progression from '@config/progression.json';
import {
  CURRENT_SCHEMA_VERSION,
  createDefaultSave,
  isSetupComplete,
  isValidSave,
  migrateSave,
  runMigrations,
  type SaveData,
} from '../../src/services/saveSchema';
import { v0Fixture } from './fixtures';

function mutated(fn: (s: any) => void): unknown {
  const s = createDefaultSave();
  fn(s);
  return s;
}

describe('createDefaultSave', () => {
  it('produces a structurally valid save', () => {
    expect(isValidSave(createDefaultSave())).toBe(true);
  });

  it('starts the player on the first row of progression.json', () => {
    const first = progression.levels[0]!;
    const { profile } = createDefaultSave();
    expect(profile.level).toBe(first.level);
    expect(profile.xp).toBe(first.xp);
    expect(profile.maxCannonLevel).toBe(first.maxCannonLevel);
    expect(profile.unlockedOceans).toEqual(first.oceans);
    expect(profile.ownedSkins).toEqual(['classic']);
    expect(profile.selectedSkin).toBe('classic');
  });

  it('applies the parental defaults from section 13.3', () => {
    const { parental } = createDefaultSave();
    expect(parental).toMatchObject({
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
    });
  });

  it('applies the child settings defaults from section 14', () => {
    expect(createDefaultSave().settings).toEqual({
      musicVolume: 0.7,
      sfxVolume: 0.7,
      controlMode: 'tap',
      leftHanded: false,
      reduceFlashing: false,
      readAloud: true,
      autoFire: { easy: false, medium: false, hard: false },
      lastDifficulty: 'easy',
    });
  });

  it('includes the extra profile fields', () => {
    expect(createDefaultSave().profile).toMatchObject({
      easyWaveShots: 0,
      easyWaveHits: 0,
      lastMediumPromptDay: null,
      levelSeen: 1,
    });
  });

  it('returns independent copies', () => {
    const a = createDefaultSave();
    a.profile.unlockedOceans.push('kelp');
    a.settings.autoFire.easy = true;
    expect(createDefaultSave().profile.unlockedOceans).toEqual(['coral']);
    expect(createDefaultSave().settings.autoFire.easy).toBe(false);
  });

  it('survives a JSON round trip unchanged', () => {
    const save = createDefaultSave();
    expect(JSON.parse(JSON.stringify(save))).toEqual(save);
  });
});

describe('isSetupComplete', () => {
  const complete = () => {
    const s = createDefaultSave();
    s.parental.pinHash = 'a';
    s.parental.pinSalt = 'b';
    s.parental.recoveryHash = 'c';
    s.parental.recoverySalt = 'd';
    return s;
  };

  it('is false on a fresh save', () => {
    expect(isSetupComplete(createDefaultSave())).toBe(false);
  });

  it('is true once all four secrets are present', () => {
    expect(isSetupComplete(complete())).toBe(true);
  });

  it.each(['pinHash', 'pinSalt', 'recoveryHash', 'recoverySalt'] as const)(
    'is false when only %s is missing',
    (field) => {
      const s = complete();
      s.parental[field] = '';
      expect(isSetupComplete(s)).toBe(false);
    },
  );
});

describe('isValidSave', () => {
  it.each([
    ['null', null],
    ['a string', 'save'],
    ['an array', []],
    ['an empty object', {}],
  ])('rejects %s', (_label, value) => {
    expect(isValidSave(value)).toBe(false);
  });

  it.each<[string, (s: any) => void]>([
    ['wrong schema version', (s) => { s.schemaVersion = 2; }],
    ['missing profile', (s) => { delete s.profile; }],
    ['missing settings', (s) => { delete s.settings; }],
    ['missing parental', (s) => { delete s.parental; }],
    ['missing usage', (s) => { delete s.usage; }],
    ['coins as a string', (s) => { s.profile.coins = '5'; }],
    ['NaN coins', (s) => { s.profile.coins = NaN; }],
    ['infinite xp', (s) => { s.profile.xp = Infinity; }],
    ['cannon level out of range', (s) => { s.profile.maxCannonLevel = 6; }],
    ['non-string ocean', (s) => { s.profile.unlockedOceans = [1]; }],
    ['fish entry without a date', (s) => { s.profile.fishBook = { F01: { caught: 1 } }; }],
    ['bestWave missing a difficulty', (s) => { s.profile.bestWave = { easy: 0, medium: 0 }; }],
    ['missing extra profile field', (s) => { delete s.profile.levelSeen; }],
    ['lastMediumPromptDay as a number', (s) => { s.profile.lastMediumPromptDay = 1; }],
    ['unknown control mode', (s) => { s.settings.controlMode = 'gamepad'; }],
    ['autoFire missing a difficulty', (s) => { s.settings.autoFire = { easy: true }; }],
    ['unknown lastDifficulty', (s) => { s.settings.lastDifficulty = 'nightmare'; }],
    ['pinHash not a string', (s) => { s.parental.pinHash = 0; }],
    ['daily limit undefined', (s) => { s.parental.dailyLimitMin = undefined; }],
    ['malformed play window', (s) => { s.parental.playWindow = { start: '07:00' }; }],
    ['unknown difficulty lock', (s) => { s.parental.difficultyLock = 'expert'; }],
    ['usage day without sessions', (s) => { s.usage.days = { '2026-10-31': { activeSec: 1 } }; }],
    ['clockChanged not boolean', (s) => {
      s.usage.days = { '2026-10-31': { activeSec: 1, sessions: 1, clockChanged: 'yes' } };
    }],
    ['grantSec as null', (s) => { s.usage.grantSec = null; }],
    ['breakUntil as a string', (s) => { s.usage.breakUntil = 'soon'; }],
    ['malformed clock pin', (s) => { s.usage.clockPin = { dayKey: '2026-10-31' }; }],
  ])('rejects %s', (_label, change) => {
    expect(isValidSave(mutated(change))).toBe(false);
  });

  it('accepts the optional and nullable forms', () => {
    const save = mutated((s) => {
      s.usage.days = { '2026-10-31': { activeSec: 1, sessions: 1, clockChanged: true } };
      s.parental.playWindow = { start: '07:00', end: '19:30' };
      s.parental.lockoutUntil = 5;
      s.usage.breakUntil = 9;
      s.usage.clockPin = { dayKey: '2026-10-31', wallDayKey: '2026-10-30' };
      s.profile.lastMediumPromptDay = '2026-10-31';
    });
    expect(isValidSave(save)).toBe(true);
  });
});

describe('migrateSave', () => {
  it('upgrades the v0 fixture to a valid current save', () => {
    const result = migrateSave(v0Fixture());
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.migrated).toBe(true);
    expect(result.data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(isValidSave(result.data)).toBe(true);
  });

  it('keeps everything the child and parent already had', () => {
    const result = migrateSave(v0Fixture());
    if (result.status !== 'ok') throw new Error('expected ok');
    const { profile, parental, usage, settings } = result.data;
    expect(profile.coins).toBe(1234);
    expect(profile.xp).toBe(2900);
    expect(profile.fishBook).toEqual({ F01: { caught: 7, firstCaughtAt: '2026-01-02T03:04:05.000Z' } });
    expect(profile.bestWave).toEqual({ easy: 4, medium: 2, hard: 0 });
    expect(parental.pinHash).toBe('aabb');
    expect(parental.recoverySalt).toBe('5566');
    expect(parental.dailyLimitMin).toBe(45);
    expect(settings.musicVolume).toBe(0.25);
    expect(usage.days['2026-01-02']).toEqual({ activeSec: 600, sessions: 2 });
  });

  it('fills the new fields so returning players see no replayed level-ups', () => {
    const result = migrateSave(v0Fixture());
    if (result.status !== 'ok') throw new Error('expected ok');
    expect(result.data.profile).toMatchObject({
      easyWaveShots: 0,
      easyWaveHits: 0,
      lastMediumPromptDay: null,
      levelSeen: 5,
    });
    expect(result.data.usage.sessionSec).toBe(0);
    expect(result.data.usage.clockPin).toBeNull();
  });

  it('treats a save with no schemaVersion as v0', () => {
    const raw = v0Fixture() as Record<string, unknown>;
    delete raw['schemaVersion'];
    const result = migrateSave(raw);
    expect(result.status).toBe('ok');
  });

  it('leaves a current save alone and reports no migration', () => {
    const save = createDefaultSave();
    const result = migrateSave(save);
    expect(result).toEqual({ status: 'ok', data: save, migrated: false });
  });

  it('does not mutate its input', () => {
    const raw = v0Fixture();
    const before = JSON.stringify(raw);
    migrateSave(raw);
    expect(JSON.stringify(raw)).toBe(before);
  });

  it('reports a newer save as future rather than invalid, so it is not discarded', () => {
    expect(migrateSave({ ...createDefaultSave(), schemaVersion: 2 }).status).toBe('future');
  });

  it.each([
    ['null', null],
    ['a number', 42],
    ['a string', 'x'],
    ['an array', []],
    ['a non-numeric version', { schemaVersion: '1' }],
    ['a fractional version', { schemaVersion: 0.5 }],
    ['a negative version', { schemaVersion: -1 }],
    ['an empty v0 save', { schemaVersion: 0 }],
    ['a v0 save with broken sections', { schemaVersion: 0, profile: 7, settings: {}, parental: {}, usage: {} }],
    ['a v1 save with no content', { schemaVersion: 1 }],
  ])('reports %s as invalid without throwing', (_label, raw) => {
    expect(migrateSave(raw).status).toBe('invalid');
  });
});

describe('runMigrations', () => {
  it('applies each step in order and stamps the version', () => {
    const seen: number[] = [];
    const result = runMigrations(
      { schemaVersion: 0, trail: [] as string[] },
      {
        0: (s) => { seen.push(s['schemaVersion'] as number); return { ...s, trail: ['zero'] }; },
        1: (s) => {
          seen.push(s['schemaVersion'] as number);
          return { ...s, trail: [...(s['trail'] as string[]), 'one'] };
        },
      },
      2,
    );
    expect(seen).toEqual([0, 1]);
    expect(result).toEqual({ schemaVersion: 2, trail: ['zero', 'one'] });
  });

  it('starts from the version the save is at, skipping earlier steps', () => {
    const result = runMigrations(
      { schemaVersion: 1 },
      {
        0: () => { throw new Error('must not run'); },
        1: (s) => ({ ...s, upgraded: true }),
      },
      2,
    );
    expect(result).toEqual({ schemaVersion: 2, upgraded: true });
  });

  it('refuses to skip a missing step', () => {
    expect(() => runMigrations({ schemaVersion: 0 }, {}, 1)).toThrow();
  });
});

describe('SaveData type', () => {
  it('accepts a fully populated value', () => {
    const save: SaveData = createDefaultSave();
    save.profile.maxCannonLevel = 5;
    save.settings.controlMode = 'joystick';
    expect(isValidSave(save)).toBe(true);
  });
});
