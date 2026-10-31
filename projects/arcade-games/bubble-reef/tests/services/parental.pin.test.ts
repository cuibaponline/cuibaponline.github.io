import { describe, expect, it, vi } from 'vitest';
import { verifySecret } from '../../src/services/pin';
import { isSetupComplete } from '../../src/services/saveSchema';
import { DAY, HOUR, MIN, WEDNESDAY_NOON, local, rig, type Rig } from './parentalRig';

const PIN = '4829';
const OTHER_PIN = '7031';
const WRONG = '5038';

async function parent(): Promise<{ r: Rig; recoveryCode: string }> {
  const r = await rig({ setupDone: false });
  const result = await r.svc.setupParent({ pin: PIN, confirmPin: PIN });
  if (!result.ok) throw new Error('setup failed');
  return { r, recoveryCode: result.recoveryCode };
}

async function wrongAttempts(r: Rig, times: number) {
  for (let i = 0; i < times; i++) await r.svc.verifyPin(WRONG);
}

describe('setupParent', () => {
  it('completes setup and returns the recovery code', async () => {
    const { r, recoveryCode } = await parent();
    expect(isSetupComplete(r.save)).toBe(true);
    expect(recoveryCode).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);
  });

  it('is on disk by the time it resolves', async () => {
    const { r } = await parent();
    await r.relaunch();
    expect(isSetupComplete(r.save)).toBe(true);
  });

  it('stores only salted hashes of both secrets', async () => {
    const { r, recoveryCode } = await parent();
    const { pinHash, pinSalt, recoveryHash, recoverySalt } = r.save.parental;
    const stored = JSON.stringify(r.save);
    expect(stored).not.toContain(`"${PIN}"`);
    expect(stored).not.toContain(recoveryCode);
    await expect(verifySecret(PIN, pinHash, pinSalt)).resolves.toBe(true);
    await expect(verifySecret(recoveryCode, recoveryHash, recoverySalt)).resolves.toBe(true);
  });

  it('uses the code the wizard already showed, so a kill mid-wizard restarts cleanly', async () => {
    const r = await rig({ setupDone: false });
    const result = await r.svc.setupParent({ pin: PIN, confirmPin: PIN, recoveryCode: 'ab3d-ef7h' });
    expect(result).toEqual({ ok: true, recoveryCode: 'AB3DEF7H' });
    await expect(
      verifySecret('AB3DEF7H', r.save.parental.recoveryHash, r.save.parental.recoverySalt),
    ).resolves.toBe(true);
  });

  it('applies the wizard’s limit and play window', async () => {
    const r = await rig({ setupDone: false });
    await r.svc.setupParent({
      pin: PIN,
      confirmPin: PIN,
      dailyLimitMin: 45,
      playWindow: { start: '07:00', end: '19:30' },
    });
    expect(r.save.parental.dailyLimitMin).toBe(45);
    expect(r.save.parental.playWindow).toEqual({ start: '07:00', end: '19:30' });
  });

  it('keeps the default limit when the wizard does not change it', async () => {
    const { r } = await parent();
    expect(r.save.parental.dailyLimitMin).toBe(30);
  });

  it('can turn the daily limit off', async () => {
    const r = await rig({ setupDone: false });
    await r.svc.setupParent({ pin: PIN, confirmPin: PIN, dailyLimitMin: null });
    expect(r.save.parental.dailyLimitMin).toBeNull();
  });

  it.each([
    ['the two entries differ', PIN, OTHER_PIN, 'pin-mismatch'],
    ['the PIN is trivial', '1234', '1234', 'trivial-pin'],
    ['the PIN is too short', '123', '123', 'trivial-pin'],
  ])('refuses when %s', async (_label, pin, confirmPin, error) => {
    const r = await rig({ setupDone: false });
    await expect(r.svc.setupParent({ pin, confirmPin })).resolves.toEqual({ ok: false, error });
    expect(isSetupComplete(r.save)).toBe(false);
  });

  it('refuses limits outside the allowed options', async () => {
    const r = await rig({ setupDone: false });
    const result = await r.svc.setupParent({ pin: PIN, confirmPin: PIN, dailyLimitMin: 7 });
    expect(result).toEqual({ ok: false, error: 'invalid-settings' });
    expect(isSetupComplete(r.save)).toBe(false);
  });

  it('cannot overwrite an existing PIN', async () => {
    const { r } = await parent();
    const hash = r.save.parental.pinHash;
    const result = await r.svc.setupParent({ pin: OTHER_PIN, confirmPin: OTHER_PIN });
    expect(result).toEqual({ ok: false, error: 'already-set' });
    expect(r.save.parental.pinHash).toBe(hash);
  });

  it('allows only one of two simultaneous setups', async () => {
    const r = await rig({ setupDone: false });
    const results = await Promise.all([
      r.svc.setupParent({ pin: PIN, confirmPin: PIN }),
      r.svc.setupParent({ pin: OTHER_PIN, confirmPin: OTHER_PIN }),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
  });

  it('starts counting time once done', async () => {
    const { r } = await parent();
    r.play(5);
    expect(r.svc.status().usedTodaySec).toBe(5);
  });
});

describe('verifyPin', () => {
  it('accepts the right PIN', async () => {
    const { r } = await parent();
    await expect(r.svc.verifyPin(PIN)).resolves.toEqual({ ok: true, lockedForSec: 0, attemptsLeft: 5 });
  });

  it('counts down the attempts left', async () => {
    const { r } = await parent();
    await expect(r.svc.verifyPin(WRONG)).resolves.toEqual({ ok: false, lockedForSec: 0, attemptsLeft: 4 });
    await expect(r.svc.verifyPin(WRONG)).resolves.toEqual({ ok: false, lockedForSec: 0, attemptsLeft: 3 });
  });

  it('does not lock on the 4th wrong PIN', async () => {
    const { r } = await parent();
    await wrongAttempts(r, 4);
    expect(r.save.parental.lockoutUntil).toBeNull();
    await expect(r.svc.verifyPin(PIN)).resolves.toMatchObject({ ok: true });
  });

  it('locks for 60 seconds on the 5th', async () => {
    const { r } = await parent();
    await wrongAttempts(r, 4);
    await expect(r.svc.verifyPin(WRONG)).resolves.toEqual({ ok: false, lockedForSec: 60, attemptsLeft: 0 });
    expect(r.save.parental.lockoutUntil).toBe(WEDNESDAY_NOON + 60_000);
  });

  it('refuses even the right PIN during a lockout', async () => {
    const { r } = await parent();
    await wrongAttempts(r, 5);
    r.clock.advance(59_000);
    await expect(r.svc.verifyPin(PIN)).resolves.toEqual({ ok: false, lockedForSec: 1, attemptsLeft: 0 });
  });

  it('does not count attempts made during a lockout', async () => {
    const { r } = await parent();
    await wrongAttempts(r, 5);
    await wrongAttempts(r, 3);
    expect(r.save.parental.failedAttempts).toBe(5);
    expect(r.save.parental.lockoutUntil).toBe(WEDNESDAY_NOON + 60_000);
  });

  it('accepts the right PIN once the lockout ends', async () => {
    const { r } = await parent();
    await wrongAttempts(r, 5);
    r.clock.advance(60_000);
    await expect(r.svc.verifyPin(PIN)).resolves.toMatchObject({ ok: true });
  });

  it('doubles with each further failure up to 15 minutes', async () => {
    const { r } = await parent();
    await wrongAttempts(r, 4);
    const lockouts: number[] = [];
    for (let i = 0; i < 8; i++) {
      const { lockedForSec } = await r.svc.verifyPin(WRONG);
      lockouts.push(lockedForSec);
      r.clock.advance(lockedForSec * 1000);
    }
    expect(lockouts).toEqual([60, 120, 240, 480, 900, 900, 900, 900]);
  });

  it('resets everything on success', async () => {
    const { r } = await parent();
    await wrongAttempts(r, 5);
    r.clock.advance(60_000);
    await r.svc.verifyPin(PIN);
    expect(r.save.parental.failedAttempts).toBe(0);
    expect(r.save.parental.lockoutUntil).toBeNull();
    await expect(r.svc.verifyPin(WRONG)).resolves.toEqual({ ok: false, lockedForSec: 0, attemptsLeft: 4 });
  });

  it('survives a relaunch', async () => {
    const { r } = await parent();
    await wrongAttempts(r, 5);
    await r.relaunch(10_000);
    await expect(r.svc.verifyPin(PIN)).resolves.toEqual({ ok: false, lockedForSec: 50, attemptsLeft: 0 });
  });

  it('keeps escalating after a relaunch', async () => {
    const { r } = await parent();
    await wrongAttempts(r, 5);
    await r.relaunch(60_000);
    await expect(r.svc.verifyPin(WRONG)).resolves.toMatchObject({ lockedForSec: 120 });
  });

  it('cannot be raced past the lockout by simultaneous attempts', async () => {
    const { r } = await parent();
    const results = await Promise.all(Array.from({ length: 8 }, () => r.svc.verifyPin(WRONG)));
    expect(r.save.parental.failedAttempts).toBe(5);
    expect(results.at(-1)).toMatchObject({ lockedForSec: 60 });
  });

  it('does not let a lockout outlast its length when the clock is wound back', async () => {
    const { r } = await parent();
    await wrongAttempts(r, 5);
    r.clock.setWall(WEDNESDAY_NOON - DAY);
    const { lockedForSec } = await r.svc.verifyPin(PIN);
    expect(lockedForSec).toBeLessThanOrEqual(60);
    expect(lockedForSec).toBeGreaterThan(0);
  });

  it('still counts down and ends after the clock is wound back', async () => {
    const { r } = await parent();
    await wrongAttempts(r, 5);
    r.clock.setWall(WEDNESDAY_NOON - DAY);
    await r.svc.verifyPin(PIN);
    r.clock.advance(60_000);
    await expect(r.svc.verifyPin(PIN)).resolves.toMatchObject({ ok: true });
  });

  it('reports the lockout without using an attempt', async () => {
    const { r } = await parent();
    await wrongAttempts(r, 5);
    expect(r.svc.status().pinLockedSec).toBe(60);
    expect(r.save.parental.failedAttempts).toBe(5);
  });
});

describe('changePin', () => {
  it('replaces the PIN', async () => {
    const { r } = await parent();
    await expect(r.svc.changePin(PIN, OTHER_PIN)).resolves.toEqual({ ok: true });
    await expect(r.svc.verifyPin(OTHER_PIN)).resolves.toMatchObject({ ok: true });
    await expect(r.svc.verifyPin(PIN)).resolves.toMatchObject({ ok: false });
  });

  it('is on disk by the time it resolves', async () => {
    const { r } = await parent();
    await r.svc.changePin(PIN, OTHER_PIN);
    await r.relaunch();
    await expect(r.svc.verifyPin(OTHER_PIN)).resolves.toMatchObject({ ok: true });
  });

  it('needs the current PIN, and a wrong one counts as a failure', async () => {
    const { r } = await parent();
    await expect(r.svc.changePin(WRONG, OTHER_PIN)).resolves.toEqual({ ok: false, error: 'wrong-pin', lockedForSec: 0 });
    expect(r.save.parental.failedAttempts).toBe(1);
    await expect(r.svc.verifyPin(PIN)).resolves.toMatchObject({ ok: true });
  });

  it('is blocked by a lockout', async () => {
    const { r } = await parent();
    await wrongAttempts(r, 5);
    await expect(r.svc.changePin(PIN, OTHER_PIN)).resolves.toEqual({ ok: false, error: 'locked', lockedForSec: 60 });
  });

  it('rejects a trivial new PIN without using an attempt', async () => {
    const { r } = await parent();
    await expect(r.svc.changePin(PIN, '1111')).resolves.toEqual({ ok: false, error: 'trivial-pin', lockedForSec: 0 });
    expect(r.save.parental.failedAttempts).toBe(0);
    await expect(r.svc.verifyPin(PIN)).resolves.toMatchObject({ ok: true });
  });
});

describe('recovery-code flow', () => {
  it('sets a new PIN', async () => {
    const { r, recoveryCode } = await parent();
    await expect(r.svc.resetPinWithRecovery(recoveryCode, OTHER_PIN)).resolves.toEqual({ ok: true });
    await expect(r.svc.verifyPin(OTHER_PIN)).resolves.toMatchObject({ ok: true });
    await expect(r.svc.verifyPin(PIN)).resolves.toMatchObject({ ok: false });
  });

  it('forgives case, spaces and hyphens in a hand-copied code', async () => {
    const { r, recoveryCode } = await parent();
    const typed = `${recoveryCode.slice(0, 4).toLowerCase()}-${recoveryCode.slice(4)} `;
    await expect(r.svc.resetPinWithRecovery(typed, OTHER_PIN)).resolves.toEqual({ ok: true });
  });

  it('refuses a wrong code and keeps the old PIN', async () => {
    const { r } = await parent();
    await expect(r.svc.resetPinWithRecovery('ZZZZZZZZ', OTHER_PIN)).resolves.toEqual({ ok: false, error: 'wrong-code' });
    await expect(r.svc.verifyPin(PIN)).resolves.toMatchObject({ ok: true });
  });

  it('refuses a trivial new PIN', async () => {
    const { r, recoveryCode } = await parent();
    await expect(r.svc.resetPinWithRecovery(recoveryCode, '0000')).resolves.toEqual({ ok: false, error: 'trivial-pin' });
    await expect(r.svc.verifyPin(PIN)).resolves.toMatchObject({ ok: true });
  });

  it('works during a PIN lockout, the moment a forgetful parent needs it', async () => {
    const { r, recoveryCode } = await parent();
    await wrongAttempts(r, 9);
    await expect(r.svc.resetPinWithRecovery(recoveryCode, OTHER_PIN)).resolves.toEqual({ ok: true });
    expect(r.save.parental.failedAttempts).toBe(0);
    expect(r.save.parental.lockoutUntil).toBeNull();
    await expect(r.svc.verifyPin(OTHER_PIN)).resolves.toMatchObject({ ok: true });
  });

  it('keeps the same code working afterwards', async () => {
    const { r, recoveryCode } = await parent();
    await r.svc.resetPinWithRecovery(recoveryCode, OTHER_PIN);
    await expect(r.svc.resetPinWithRecovery(recoveryCode, PIN)).resolves.toEqual({ ok: true });
  });

  it('is on disk by the time it resolves', async () => {
    const { r, recoveryCode } = await parent();
    await r.svc.resetPinWithRecovery(recoveryCode, OTHER_PIN);
    await r.relaunch();
    await expect(r.svc.verifyPin(OTHER_PIN)).resolves.toMatchObject({ ok: true });
  });

  it('lets the parent straight into the Parent Zone', async () => {
    const { r, recoveryCode } = await parent();
    await r.svc.resetPinWithRecovery(recoveryCode, OTHER_PIN);
    expect(r.svc.enterParentZone()).toBe(true);
  });

  it('does not open the Parent Zone on a wrong code', async () => {
    const { r } = await parent();
    await r.svc.resetPinWithRecovery('ZZZZZZZZ', OTHER_PIN);
    expect(r.svc.enterParentZone()).toBe(false);
  });
});

describe('Parent Zone access', () => {
  it('opens once per verified PIN', async () => {
    const { r } = await parent();
    await r.svc.verifyPin(PIN);
    expect(r.svc.enterParentZone()).toBe(true);
    r.svc.exitParentZone();
    expect(r.svc.enterParentZone()).toBe(false);
  });

  it('does not open after a wrong PIN', async () => {
    const { r } = await parent();
    await r.svc.verifyPin(WRONG);
    expect(r.svc.enterParentZone()).toBe(false);
  });

  it('does not open just because changePin checked the PIN', async () => {
    const { r } = await parent();
    await r.svc.changePin(PIN, OTHER_PIN);
    expect(r.svc.enterParentZone()).toBe(false);
  });
});

describe('updateSettings', () => {
  it('applies valid changes and writes them', async () => {
    const r = await rig();
    await expect(
      r.svc.updateSettings({
        dailyLimitMin: 45,
        weekendLimitMin: 90,
        sessionLimitMin: 30,
        breakEveryMin: 20,
        breakLengthMin: 10,
        playWindow: { start: '19:00', end: '01:00' },
        dayResetTime: '04:30',
        difficultyLock: 'easy',
        showTimerToChild: false,
      }),
    ).resolves.toBe(true);
    await r.relaunch();
    expect(r.save.parental).toMatchObject({
      dailyLimitMin: 45,
      weekendLimitMin: 90,
      sessionLimitMin: 30,
      breakEveryMin: 20,
      breakLengthMin: 10,
      playWindow: { start: '19:00', end: '01:00' },
      dayResetTime: '04:30',
      difficultyLock: 'easy',
      showTimerToChild: false,
    });
  });

  it.each([
    [{ dailyLimitMin: null }],
    [{ dailyLimitMin: 10 }],
    [{ dailyLimitMin: 180 }],
    [{ weekendLimitMin: null }],
    [{ sessionLimitMin: null }],
    [{ sessionLimitMin: 10 }],
    [{ sessionLimitMin: 60 }],
    [{ breakEveryMin: null }],
    [{ breakEveryMin: 15 }],
    [{ breakLengthMin: 2 }],
    [{ playWindow: null }],
    [{ dayResetTime: '00:00' }],
    [{ dayResetTime: '05:00' }],
    [{ difficultyLock: null }],
  ])('accepts %j', async (patch) => {
    const r = await rig();
    await expect(r.svc.updateSettings(patch)).resolves.toBe(true);
  });

  it.each([
    [{ dailyLimitMin: 5 }],
    [{ dailyLimitMin: 185 }],
    [{ dailyLimitMin: 33 }],
    [{ dailyLimitMin: NaN }],
    [{ weekendLimitMin: 7 }],
    [{ sessionLimitMin: 5 }],
    [{ sessionLimitMin: 61 }],
    [{ breakEveryMin: 10 }],
    [{ breakLengthMin: 3 }],
    [{ playWindow: { start: '7:00', end: '19:00' } }],
    [{ playWindow: { start: '07:00', end: '24:00' } }],
    [{ playWindow: { start: '07:60', end: '19:00' } }],
    [{ playWindow: { start: '07:00', end: '07:00' } }],
    [{ dayResetTime: '05:30' }],
    [{ dayResetTime: '06:00' }],
    [{ dayResetTime: 'noon' }],
  ])('refuses %j and changes nothing', async (patch) => {
    const r = await rig();
    const before = JSON.stringify(r.save.parental);
    await expect(r.svc.updateSettings(patch)).resolves.toBe(false);
    expect(JSON.stringify(r.save.parental)).toBe(before);
  });

  it.each([
    [{ difficultyLock: 'expert' }],
    [{ showTimerToChild: 'yes' }],
  ])('refuses %j, which would otherwise make every later save fail validation', async (patch) => {
    const r = await rig();
    await expect(r.svc.updateSettings(patch as never)).resolves.toBe(false);
    await r.svc.flush();
    expect(r.store.saveError).toBeNull();
  });

  it('applies nothing when one field of a patch is invalid', async () => {
    const r = await rig();
    await r.svc.updateSettings({ dailyLimitMin: 60, breakLengthMin: 3 });
    expect(r.save.parental.dailyLimitMin).toBe(30);
  });

  it('cannot touch the PIN or the lockout', async () => {
    const r = await rig();
    await r.svc.updateSettings({ pinHash: 'x', failedAttempts: 0 } as never);
    expect(r.save.parental.pinHash).toBe('stub');
  });

  it('turns a lowered limit into a block', async () => {
    const r = await rig();
    r.play(700);
    await r.svc.updateSettings({ dailyLimitMin: 10 });
    expect(r.svc.status().reason).toBe('daily');
    r.play(1);
    expect(r.limits).toEqual(['daily']);
  });

  it('lifts a block when the limit is raised', async () => {
    const r = await rig({
      configure: (d) => {
        d.usage.days['2026-06-03'] = { activeSec: 1800, sessions: 1 };
      },
    });
    await r.svc.updateSettings({ dailyLimitMin: 60 });
    expect(r.svc.status().allowed).toBe(true);
    expect(r.svc.status().remainingSec).toBe(1800);
  });
});

describe('usageHistory', () => {
  it('returns one entry per day, oldest first, ending today', async () => {
    const r = await rig({
      configure: (d) => {
        d.usage.days['2026-06-01'] = { activeSec: 120, sessions: 2 };
        d.usage.days['2026-05-30'] = { activeSec: 60, sessions: 1, clockChanged: true };
      },
    });
    r.play(30);
    const history = r.svc.usageHistory(14);
    expect(history).toHaveLength(14);
    expect(history[0]?.dayKey).toBe('2026-05-21');
    expect(history[13]).toEqual({ dayKey: '2026-06-03', activeSec: 30, sessions: 1, clockChanged: false });
    expect(history[11]).toEqual({ dayKey: '2026-06-01', activeSec: 120, sessions: 2, clockChanged: false });
    expect(history[9]).toEqual({ dayKey: '2026-05-30', activeSec: 60, sessions: 1, clockChanged: true });
    expect(history[12]).toEqual({ dayKey: '2026-06-02', activeSec: 0, sessions: 0, clockChanged: false });
  });

  it('walks across a month boundary with no gaps or repeats', async () => {
    const r = await rig({ at: local(2026, 3, 2, 12) });
    expect(r.svc.usageHistory(3).map((day) => day.dayKey)).toEqual(['2026-02-28', '2026-03-01', '2026-03-02']);
  });

  it('gives copies, so a chart cannot change the record', async () => {
    const r = await rig();
    r.play(5);
    r.svc.usageHistory(1)[0]!.activeSec = 0;
    expect(r.svc.status().usedTodaySec).toBe(5);
  });
});

describe('resetProgress', () => {
  async function played() {
    const { r } = await parent();
    await r.svc.grant(10);
    r.store.update((d) => {
      d.profile.coins = 900;
      d.profile.xp = 5000;
      d.profile.level = 6;
      d.profile.fishBook['F01'] = { caught: 3, firstCaughtAt: '2026-06-03T00:00:00.000Z' };
      d.settings.musicVolume = 0.1;
      d.parental.dailyLimitMin = 45;
    });
    r.play(30);
    return r;
  }

  it('clears the child’s progress', async () => {
    const r = await played();
    await r.svc.resetProgress();
    const { profile } = r.save;
    expect(profile.coins).toBe(0);
    expect(profile.xp).toBe(0);
    expect(profile.level).toBe(1);
    expect(profile.fishBook).toEqual({});
  });

  it('keeps the PIN and every limit', async () => {
    const r = await played();
    const before = { ...r.save.parental };
    await r.svc.resetProgress();
    expect(r.save.parental).toEqual(before);
    await expect(r.svc.verifyPin(PIN)).resolves.toMatchObject({ ok: true });
  });

  it('keeps today’s usage, so it cannot refill the allowance', async () => {
    const r = await played();
    await r.svc.resetProgress();
    expect(r.svc.status().usedTodaySec).toBe(30);
    expect(r.save.usage.grantSec).toBe(600);
  });

  it('keeps the child’s own settings', async () => {
    const r = await played();
    await r.svc.resetProgress();
    expect(r.save.settings.musicVolume).toBe(0.1);
  });

  it('is on disk by the time it resolves', async () => {
    const r = await played();
    await r.svc.resetProgress();
    await r.relaunch();
    expect(r.save.profile.coins).toBe(0);
  });
});

describe('endBreak', () => {
  it('does nothing harmful with no break running', async () => {
    const r = await rig();
    r.play(5);
    await r.svc.endBreak();
    expect(r.svc.status().allowed).toBe(true);
    expect(r.svc.status().usedTodaySec).toBe(5);
  });
});

describe('events', () => {
  it('can be unsubscribed', async () => {
    const r = await rig({
      configure: (d) => {
        d.usage.days['2026-06-03'] = { activeSec: 1799, sessions: 1 };
      },
    });
    const listener = vi.fn();
    const off = r.svc.on('limit', listener);
    off();
    r.play(1);
    expect(listener).not.toHaveBeenCalled();
    expect(r.limits).toEqual(['daily']);
  });
});

describe('status details', () => {
  it('passes on the show-timer setting', async () => {
    const r = await rig({
      configure: (d) => {
        d.parental.showTimerToChild = false;
      },
    });
    expect(r.svc.status().showTimerToChild).toBe(false);
  });

  it('reports whether setup is done', async () => {
    const r = await rig({ setupDone: false });
    expect(r.svc.status().setupComplete).toBe(false);
  });

  it('does not treat being hidden as absence while checking status', async () => {
    const r = await rig({
      configure: (d) => {
        d.parental.sessionLimitMin = 20;
      },
    });
    r.play(600);
    await r.svc.setVisible(false);
    r.clock.advance(3 * MIN);
    r.svc.status(); // must not move the "last seen" time forward and hide the absence
    r.clock.advance(3 * MIN);
    await r.svc.setVisible(true);
    expect(r.save.usage.sessionSec).toBe(0);
  });

  it('ends a day-long absence with a fresh session', async () => {
    const r = await rig({
      configure: (d) => {
        d.parental.sessionLimitMin = 20;
      },
    });
    r.play(600);
    await r.svc.setVisible(false);
    await r.relaunch(HOUR);
    expect(r.save.usage.sessionSec).toBe(0);
  });
});
