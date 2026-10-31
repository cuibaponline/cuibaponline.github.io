import { describe, expect, it, vi } from 'vitest';
import type { SaveData } from '../../src/services/saveSchema';
import { GRANT_UNLIMITED } from '../../src/services/saveSchema';
import { DAY, HOUR, MIN, WEDNESDAY_NOON, local, rig, type RigOptions } from './parentalRig';

const JUNE_3 = '2026-06-03';

const SATURDAY_NOON = local(2026, 6, 6, 12);
const FRIDAY_NOON = local(2026, 6, 5, 12);

/** 30 minute limit with `usedSec` already spent today. */
const spent = (usedSec: number, more?: (d: SaveData) => void, at = WEDNESDAY_NOON): RigOptions => ({
  at,
  configure: (d) => {
    d.usage.days[new Date(at).toLocaleDateString('sv')] = { activeSec: usedSec, sessions: 1 };
    more?.(d);
  },
});

describe('daily limit', () => {
  it('reports the time left', async () => {
    const r = await rig(spent(600));
    const status = r.svc.status();
    expect(status.allowed).toBe(true);
    expect(status.reason).toBe('ok');
    expect(status.remainingSec).toBe(1200);
    expect(status.dailyRemainingSec).toBe(1200);
  });

  it('blocks when the limit is reached', async () => {
    const r = await rig(spent(1795));
    r.play(5);
    const status = r.svc.status();
    expect(status.allowed).toBe(false);
    expect(status.reason).toBe('daily');
    expect(status.remainingSec).toBe(0);
  });

  it('allows until the very last second', async () => {
    const r = await rig(spent(1795));
    r.play(4);
    expect(r.svc.status().allowed).toBe(true);
    expect(r.svc.status().remainingSec).toBe(1);
  });

  it('reports null and never blocks when the limit is off', async () => {
    const r = await rig({
      configure: (d) => {
        d.parental.dailyLimitMin = null;
      },
    });
    r.play(4000);
    const status = r.svc.status();
    expect(status.allowed).toBe(true);
    expect(status.remainingSec).toBeNull();
    expect(status.dailyRemainingSec).toBeNull();
  });

  it('uses the weekday limit on a Friday', async () => {
    const r = await rig({
      at: FRIDAY_NOON,
      configure: (d) => {
        d.parental.dailyLimitMin = 30;
        d.parental.weekendLimitMin = 60;
      },
    });
    expect(r.svc.status().dailyRemainingSec).toBe(1800);
  });

  it.each([
    ['Saturday', SATURDAY_NOON],
    ['Sunday', local(2026, 6, 7, 12)],
  ])('uses the weekend limit on %s', async (_label, at) => {
    const r = await rig({
      at,
      configure: (d) => {
        d.parental.weekendLimitMin = 60;
      },
    });
    expect(r.svc.status().dailyRemainingSec).toBe(3600);
  });

  it('treats a null weekend limit as the weekday limit', async () => {
    const r = await rig({ at: SATURDAY_NOON });
    expect(r.svc.status().dailyRemainingSec).toBe(1800);
  });

  it('decides the weekend from the day key, not the calendar date', async () => {
    const r = await rig({
      at: local(2026, 6, 6, 1), // 01:00 Saturday, still Friday's day with a 03:00 reset
      configure: (d) => {
        d.parental.dayResetTime = '03:00';
        d.parental.weekendLimitMin = 60;
      },
    });
    expect(r.svc.status().dailyRemainingSec).toBe(1800);
  });

  it('lifts the block at the day reset', async () => {
    const r = await rig({ ...spent(1800), at: WEDNESDAY_NOON });
    r.svc.tick();
    expect(r.svc.status().reason).toBe('daily');
    r.clock.advance(12 * HOUR);
    r.svc.tick();
    expect(r.svc.status().allowed).toBe(true);
    expect(r.svc.status().remainingSec).toBe(1800);
  });

  it('shows the same block after a relaunch until the day resets', async () => {
    const r = await rig(spent(1800));
    await r.relaunch(HOUR);
    expect(r.svc.status().reason).toBe('daily');
    await r.relaunch(11 * HOUR);
    expect(r.svc.status().allowed).toBe(true);
  });

  it('does not charge the Time’s up screen against the child', async () => {
    const r = await rig(spent(1800));
    r.play(600);
    expect(r.svc.status().usedTodaySec).toBe(1800);
  });
});

describe('warnings', () => {
  it('warns at 5 minutes and 1 minute left, once each', async () => {
    const r = await rig(spent(1490));
    r.play(9);
    expect(r.warnings).toEqual([]);
    r.play(1);
    expect(r.warnings).toEqual([5]);
    r.play(239);
    expect(r.warnings).toEqual([5]);
    r.play(1);
    expect(r.warnings).toEqual([5, 1]);
    r.play(70);
    expect(r.warnings).toEqual([5, 1]);
  });

  it('does not repeat after a relaunch the same day', async () => {
    const r = await rig(spent(1495));
    r.play(10);
    expect(r.warnings).toEqual([5]);
    await r.svc.setVisible(false);
    await r.relaunch(MIN);
    r.play(10);
    expect(r.warnings).toEqual([]);
  });

  it('does not repeat when killed right after warning, before the 10 s save', async () => {
    const r = await rig(spent(1495));
    r.play(5); // warns at exactly 1500 s used
    expect(r.warnings).toEqual([5]);
    await r.relaunch();
    r.play(10);
    expect(r.warnings).toEqual([]);
  });

  it('does not warn on launch when already inside a mark', async () => {
    const r = await rig(spent(1600));
    r.play(3);
    expect(r.warnings).toEqual([]);
  });

  it('does not warn right after a grant', async () => {
    const r = await rig(spent(1800));
    r.svc.tick();
    await r.svc.grant(10);
    r.play(5);
    expect(r.warnings).toEqual([]);
  });

  it('warns again once a grant’s time crosses the marks', async () => {
    const r = await rig(spent(1800));
    r.svc.tick();
    await r.svc.grant(10);
    r.play(300);
    expect(r.warnings).toEqual([5]);
    r.play(240);
    expect(r.warnings).toEqual([5, 1]);
  });

  it('stays silent when a grant lands the time between the marks going up', async () => {
    const r = await rig(spent(1785));
    r.svc.tick();
    await r.svc.grant(10); // remaining goes from 15 s to 615 s
    r.play(10);
    expect(r.warnings).toEqual([]);
  });

  it('does not fire when a parent lowers the limit past a mark', async () => {
    const r = await rig(spent(1000, undefined));
    r.svc.tick();
    await r.svc.updateSettings({ dailyLimitMin: 20 }); // 200 s left, past the 5 min mark
    r.play(5);
    expect(r.warnings).toEqual([]);
  });

  it('does not warn while hidden, and warns on return if the mark passed', async () => {
    const r = await rig({
      at: local(2026, 6, 3, 18, 50),
      configure: (d) => {
        d.parental.playWindow = { start: '07:00', end: '19:00' };
      },
    });
    r.svc.tick();
    await r.svc.setVisible(false);
    r.clock.advance(6 * MIN);
    r.svc.tick();
    expect(r.warnings).toEqual([]);
    await r.svc.setVisible(true);
    expect(r.warnings).toEqual([5]);
  });

  it('does not warn when the day rolls over', async () => {
    const r = await rig(spent(1600, undefined, local(2026, 6, 3, 23, 59, 50)));
    r.play(30);
    expect(r.warnings).toEqual([]);
  });

  it('does not warn with no limit set', async () => {
    const r = await rig({
      configure: (d) => {
        d.parental.dailyLimitMin = null;
      },
    });
    r.play(2000);
    expect(r.warnings).toEqual([]);
  });

  it('warns before the play window closes even with plenty of daily time', async () => {
    const r = await rig({
      at: local(2026, 6, 3, 18, 54, 50),
      configure: (d) => {
        d.parental.playWindow = { start: '07:00', end: '19:00' };
      },
    });
    r.play(11);
    expect(r.warnings).toEqual([5]);
    expect(r.svc.status().nextLimit).toBe('window');
  });

  it('warns before a session limit', async () => {
    const r = await rig({
      configure: (d) => {
        d.parental.sessionLimitMin = 10;
        d.usage.sessionSec = 295;
      },
    });
    r.play(6);
    expect(r.warnings).toEqual([5]);
    expect(r.svc.status().nextLimit).toBe('session');
  });

  it('keeps a broken toast from stopping the limit', async () => {
    const r = await rig(spent(1495));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    r.svc.on('warning', () => {
      throw new Error('toast failed');
    });
    r.play(305);
    expect(r.warnings).toEqual([5, 1]);
    expect(r.limits).toEqual(['daily']);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('limit reached mid-wave', () => {
  it('fires once and marks the wrap-up', async () => {
    const r = await rig(spent(1795));
    r.play(5);
    expect(r.limits).toEqual(['daily']);
    const status = r.svc.status();
    expect(status.wrappingUp).toBe(true);
    expect(status.allowed).toBe(false);
  });

  it('does not fire again during the wrap-up or on the Time’s up screen', async () => {
    const r = await rig(spent(1795));
    r.play(5);
    r.play(15);
    r.svc.wrapUpFinished();
    r.play(60);
    expect(r.limits).toEqual(['daily']);
  });

  it('counts the 15 s wrap-up, so a later grant is not 15 s too generous', async () => {
    const r = await rig(spent(1795));
    r.play(5);
    r.play(15);
    r.svc.wrapUpFinished();
    await r.svc.grant(10);
    expect(r.svc.status().usedTodaySec).toBe(1815);
    expect(r.svc.status().remainingSec).toBe(585);
  });

  it('stays blocked after the wrap-up', async () => {
    const r = await rig(spent(1795));
    r.play(5);
    r.play(15);
    const status = r.svc.wrapUpFinished();
    expect(status.wrappingUp).toBe(false);
    expect(status.allowed).toBe(false);
    expect(status.reason).toBe('daily');
    expect(status.remainingSec).toBe(0);
  });

  it('writes to disk at the moment the limit is reached', async () => {
    const r = await rig(spent(1795));
    r.play(5);
    await r.relaunch();
    expect(r.svc.status().usedTodaySec).toBe(1800);
    expect(r.svc.status().reason).toBe('daily');
  });

  it('shows Time’s up with no second wrap-up if killed during the wrap-up', async () => {
    const r = await rig(spent(1795));
    r.play(8);
    await r.relaunch(MIN);
    expect(r.svc.status().reason).toBe('daily');
    expect(r.svc.status().wrappingUp).toBe(false);
    r.play(5);
    expect(r.limits).toEqual([]);
  });

  it('ends a wrap-up the game never finished', async () => {
    const r = await rig(spent(1795));
    r.play(5);
    r.play(40);
    const status = r.svc.status();
    expect(status.wrappingUp).toBe(false);
    expect(status.allowed).toBe(false);
    expect(status.usedTodaySec).toBeLessThanOrEqual(1830);
  });

  it('ignores wrapUpFinished when nothing is wrapping up', async () => {
    const r = await rig();
    r.play(5);
    const status = r.svc.wrapUpFinished();
    expect(status.allowed).toBe(true);
    expect(r.save.usage.breakUntil).toBeNull();
  });
});

describe('limit reached in a menu or intermission', () => {
  it.each(['menu', 'intermission'])('finishes immediately from the %s', async () => {
    const r = await rig(spent(1795));
    r.svc.on('limit', () => {
      r.svc.wrapUpFinished();
    });
    r.play(5);
    const status = r.svc.status();
    expect(r.limits).toEqual(['daily']);
    expect(status.wrappingUp).toBe(false);
    expect(status.reason).toBe('daily');
  });

  it('adds no more time once finished', async () => {
    const r = await rig(spent(1795));
    r.svc.on('limit', () => {
      r.svc.wrapUpFinished();
    });
    r.play(60);
    expect(r.svc.status().usedTodaySec).toBe(1800);
  });
});

describe('backgrounded at the limit', () => {
  it('does not reach the limit while hidden', async () => {
    const r = await rig(spent(1799));
    await r.svc.setVisible(false);
    r.clock.advance(HOUR);
    r.svc.tick();
    expect(r.limits).toEqual([]);
    expect(r.svc.status().allowed).toBe(true);
    expect(r.svc.status().remainingSec).toBe(1);
  });

  it('reaches it after returning, with no credit for the hidden time', async () => {
    const r = await rig(spent(1799));
    await r.svc.setVisible(false);
    r.clock.advance(HOUR);
    await r.svc.setVisible(true);
    expect(r.limits).toEqual([]);
    r.play(1);
    expect(r.limits).toEqual(['daily']);
    expect(r.svc.status().usedTodaySec).toBe(1800);
  });

  it('pauses the wrap-up clock while hidden', async () => {
    const r = await rig(spent(1795));
    r.play(5);
    await r.svc.setVisible(false);
    r.clock.advance(HOUR);
    await r.svc.setVisible(true);
    expect(r.svc.status().wrappingUp).toBe(true);
    r.play(15);
    r.svc.wrapUpFinished();
    expect(r.svc.status().usedTodaySec).toBe(1815);
  });

  it('holds a limit event raised during a hide until the app is back', async () => {
    const r = await rig({
      at: local(2026, 6, 3, 18, 59),
      configure: (d) => {
        d.parental.playWindow = { start: '07:00', end: '19:00' };
      },
    });
    r.svc.tick();
    await r.svc.setVisible(false);
    r.clock.advance(5 * MIN);
    r.svc.tick();
    expect(r.limits).toEqual([]);
    await r.svc.setVisible(true);
    expect(r.limits).toEqual(['window']);
  });
});

describe('grants', () => {
  it.each([
    [10, 600],
    [20, 1200],
    [30, 1800],
  ] as const)('+%i minutes unlocks that long', async (minutes, seconds) => {
    const r = await rig(spent(1800));
    await r.svc.grant(minutes);
    expect(r.svc.status().allowed).toBe(true);
    expect(r.svc.status().remainingSec).toBe(seconds);
  });

  it('adds up', async () => {
    const r = await rig(spent(1800));
    await r.svc.grant(10);
    await r.svc.grant(20);
    expect(r.svc.status().remainingSec).toBe(1800);
  });

  it('is not eaten by time spent waiting on the Time’s up screen', async () => {
    const r = await rig(spent(1800));
    r.play(1200);
    await r.svc.grant(10);
    expect(r.svc.status().remainingSec).toBe(600);
  });

  it('can run out again and fires a fresh limit', async () => {
    const r = await rig(spent(1800));
    await r.svc.grant(10);
    r.play(600);
    expect(r.limits).toEqual(['daily']);
    expect(r.svc.status().allowed).toBe(false);
  });

  it('grants unlimited for the rest of the day', async () => {
    const r = await rig(spent(1800));
    await r.svc.grant('unlimited');
    r.play(4000);
    expect(r.svc.status().allowed).toBe(true);
    expect(r.svc.status().remainingSec).toBeNull();
    expect(r.limits).toEqual([]);
  });

  it('survives a relaunch, including unlimited', async () => {
    const r = await rig(spent(1800));
    await r.svc.grant('unlimited');
    await r.relaunch(MIN);
    expect(r.svc.status().allowed).toBe(true);
    expect(r.store.get().usage.grantSec).toBe(GRANT_UNLIMITED);
  });

  it('stays unlimited if a timed grant follows', async () => {
    const r = await rig(spent(1800));
    await r.svc.grant('unlimited');
    await r.svc.grant(10);
    expect(r.svc.status().remainingSec).toBeNull();
  });

  it('expires at the day reset', async () => {
    const r = await rig(spent(1800));
    await r.svc.grant('unlimited');
    r.clock.advanceWallOnly(12 * HOUR);
    r.svc.tick();
    expect(r.svc.status().remainingSec).toBe(1800);
    expect(r.save.usage.grantSec).toBe(0);
  });

  it('expires at a configured 03:00 reset, not at midnight', async () => {
    const r = await rig(
      spent(1800, (d) => {
        d.parental.dayResetTime = '03:00';
      }, local(2026, 6, 3, 23)),
    );
    await r.svc.grant(30);
    r.clock.advance(2 * HOUR); // 01:00, same parental day
    r.svc.tick();
    expect(r.save.usage.grantSec).toBe(1800);
    r.clock.advance(2 * HOUR); // 03:00
    r.svc.tick();
    expect(r.save.usage.grantSec).toBe(0);
  });

  it('does not come back if the clock is wound back to the granted day', async () => {
    const r = await rig(spent(1800));
    await r.svc.grant('unlimited');
    r.clock.advance(DAY);
    r.svc.tick();
    r.clock.setWall(WEDNESDAY_NOON + HOUR);
    r.svc.tick();
    expect(r.svc.status().dayKey).toBe('2026-06-04');
    expect(r.svc.status().dailyRemainingSec).toBeLessThanOrEqual(1800);
    expect(r.save.usage.grantSec).toBe(0);
  });

  it('does not open a closed play window', async () => {
    const r = await rig({
      at: local(2026, 6, 3, 20),
      configure: (d) => {
        d.parental.playWindow = { start: '07:00', end: '19:00' };
      },
    });
    await r.svc.grant('unlimited');
    expect(r.svc.status().reason).toBe('window');
  });

  it('does not lift a locked break', async () => {
    const r = await rig({
      configure: (d) => {
        d.usage.breakUntil = WEDNESDAY_NOON + 3 * MIN;
      },
    });
    await r.svc.grant(10);
    expect(r.svc.status().reason).toBe('break');
  });
});

describe('session limit', () => {
  const limit20 = (more?: (d: SaveData) => void): RigOptions => ({
    configure: (d) => {
      d.parental.dailyLimitMin = 120;
      d.parental.sessionLimitMin = 20;
      d.parental.breakLengthMin = 5;
      more?.(d);
    },
  });

  it('fires after 20 counted minutes', async () => {
    const r = await rig(limit20());
    r.play(1199);
    expect(r.limits).toEqual([]);
    r.play(1);
    expect(r.limits).toEqual(['session']);
  });

  it('runs the wrap-up first, then locks for the break length', async () => {
    const r = await rig(limit20());
    r.play(1200);
    expect(r.svc.status().wrappingUp).toBe(true);
    r.play(15);
    const status = r.svc.wrapUpFinished();
    expect(status.allowed).toBe(false);
    expect(status.reason).toBe('break');
    expect(status.breakRemainingSec).toBe(300);
  });

  it('resumes after the break if daily time remains', async () => {
    const r = await rig(limit20());
    r.play(1200);
    r.play(15);
    r.svc.wrapUpFinished();
    r.play(299);
    expect(r.svc.status().allowed).toBe(false);
    r.play(1);
    const status = r.svc.status();
    expect(status.allowed).toBe(true);
    expect(status.breakRemainingSec).toBe(0);
  });

  it('starts a full new session after the break', async () => {
    const r = await rig(limit20());
    r.play(1200);
    r.play(15);
    r.svc.wrapUpFinished();
    r.play(300);
    expect(r.limits).toEqual(['session']);
    r.play(1199);
    expect(r.limits).toEqual(['session']);
    r.play(1);
    expect(r.limits).toEqual(['session', 'session']);
  });

  it('does not charge the break against the daily allowance', async () => {
    const r = await rig(limit20());
    r.play(1200);
    r.play(15);
    r.svc.wrapUpFinished();
    r.play(300);
    expect(r.svc.status().usedTodaySec).toBe(1215);
  });

  it('counts the break as a new session in the history', async () => {
    const r = await rig(limit20());
    r.play(1200);
    r.svc.wrapUpFinished();
    r.play(301);
    expect(r.save.usage.days[JUNE_3]?.sessions).toBe(2);
  });

  it('is not escaped by killing the app and relaunching', async () => {
    const r = await rig(limit20());
    r.play(600);
    await r.svc.setVisible(false);
    await r.relaunch(MIN);
    r.play(600);
    expect(r.limits).toEqual(['session']);
  });

  it('is not escaped by killing the app during the wrap-up', async () => {
    const r = await rig(limit20());
    r.play(1205);
    await r.relaunch(10_000);
    expect(r.svc.status().reason).toBe('break');
    expect(r.svc.status().breakRemainingSec).toBeGreaterThan(280);
  });

  it('does not stack a second break after a kill during the wrap-up', async () => {
    const r = await rig(limit20());
    r.play(1205);
    await r.relaunch(10_000);
    r.play(285); // sits out the rest of the break on the lock screen
    expect(r.svc.status().allowed).toBe(true);
    r.play(5);
    expect(r.svc.status().allowed).toBe(true);
    expect(r.limits).toEqual([]);
  });

  it('starts a fresh session after Time’s up, once a parent grants more', async () => {
    const r = await rig({
      configure: (d) => {
        d.parental.dailyLimitMin = 10;
        d.parental.sessionLimitMin = 20;
      },
    });
    r.play(600);
    expect(r.limits).toEqual(['daily']);
    r.svc.wrapUpFinished();
    await r.svc.grant(30);
    r.play(1199);
    expect(r.limits).toEqual(['daily']);
    r.play(1);
    expect(r.limits).toEqual(['daily', 'session']);
  });

  it('does not count hidden time', async () => {
    const r = await rig(limit20());
    r.play(600);
    await r.svc.setVisible(false);
    r.clock.advance(4 * MIN);
    await r.svc.setVisible(true);
    r.play(599);
    expect(r.limits).toEqual([]);
    r.play(1);
    expect(r.limits).toEqual(['session']);
  });

  it('starts over after an absence as long as the break', async () => {
    const r = await rig(limit20());
    r.play(600);
    await r.svc.setVisible(false);
    await r.relaunch(5 * MIN);
    r.play(1199);
    expect(r.limits).toEqual([]);
  });

  it('does not start over after a shorter absence', async () => {
    const r = await rig(limit20());
    r.play(600);
    await r.svc.setVisible(false);
    await r.relaunch(5 * MIN - 1000);
    r.play(600);
    expect(r.limits).toEqual(['session']);
  });

  it('continues across midnight', async () => {
    const r = await rig({
      ...limit20(),
      at: local(2026, 6, 3, 23, 55),
    });
    r.play(1200);
    expect(r.limits).toEqual(['session']);
  });

  it('is not cleared by moving the clock backwards', async () => {
    const r = await rig(limit20());
    r.play(600);
    r.clock.setWall(WEDNESDAY_NOON - 3 * HOUR);
    r.svc.tick();
    r.play(599);
    expect(r.limits).toEqual([]);
    r.play(1);
    expect(r.limits).toEqual(['session']);
  });

  it('gives way to the daily limit when both hit together', async () => {
    const r = await rig({
      configure: (d) => {
        d.parental.dailyLimitMin = 20;
        d.parental.sessionLimitMin = 20;
      },
    });
    r.play(1200);
    expect(r.limits).toEqual(['daily']);
    r.svc.wrapUpFinished();
    expect(r.save.usage.breakUntil).toBeNull();
    expect(r.svc.status().reason).toBe('daily');
  });

  it('ends on Time’s up, not a countdown, when the daily limit lands during the wrap-up', async () => {
    const r = await rig({
      configure: (d) => {
        d.parental.dailyLimitMin = 20;
        d.parental.sessionLimitMin = 10;
        d.usage.days[JUNE_3] = { activeSec: 1190, sessions: 1 };
        d.usage.sessionSec = 595;
      },
    });
    r.play(5);
    expect(r.limits).toEqual(['session']);
    r.play(15);
    expect(r.limits).toEqual(['session']);
    expect(r.svc.wrapUpFinished().reason).toBe('daily');
  });
});

describe('break reminder', () => {
  const every15 = (more?: (d: SaveData) => void): RigOptions => ({
    configure: (d) => {
      d.parental.dailyLimitMin = 120;
      d.parental.breakEveryMin = 15;
      d.parental.breakLengthMin = 2;
      more?.(d);
    },
  });

  it('fires, wraps up, and locks with the configured length', async () => {
    const r = await rig(every15());
    r.play(900);
    expect(r.limits).toEqual(['break']);
    r.play(15);
    const status = r.svc.wrapUpFinished();
    expect(status.reason).toBe('break');
    expect(status.breakRemainingSec).toBe(120);
  });

  it('fires again after the next interval', async () => {
    const r = await rig(every15());
    r.play(900);
    r.svc.wrapUpFinished();
    r.play(120);
    r.play(899);
    expect(r.limits).toEqual(['break']);
    r.play(1);
    expect(r.limits).toEqual(['break', 'break']);
  });

  it('shares one clock with the session limit: any break resets both', async () => {
    const r = await rig(
      every15((d) => {
        d.parental.sessionLimitMin = 20;
      }),
    );
    r.play(900);
    r.svc.wrapUpFinished();
    r.play(120);
    r.play(600); // 25 minutes in, but only 10 since the break
    expect(r.limits).toEqual(['break']);
  });
});

describe('killed during a locked break', () => {
  const inBreak = async () => {
    const r = await rig({
      configure: (d) => {
        d.parental.dailyLimitMin = 120;
        d.parental.sessionLimitMin = 20;
        d.parental.breakLengthMin = 5;
      },
    });
    r.play(1200);
    r.svc.wrapUpFinished();
    return r;
  };

  it('still shows the break after a relaunch', async () => {
    const r = await inBreak();
    await r.relaunch(MIN);
    const status = r.svc.status();
    expect(status.allowed).toBe(false);
    expect(status.reason).toBe('break');
    expect(status.breakRemainingSec).toBe(240);
  });

  it('does not fire a new limit on the relaunch', async () => {
    const r = await inBreak();
    await r.relaunch(MIN);
    r.play(5);
    expect(r.limits).toEqual([]);
  });

  it('counts the time the app was closed toward the break', async () => {
    const r = await inBreak();
    await r.relaunch(5 * MIN);
    expect(r.svc.status().allowed).toBe(true);
    expect(r.save.usage.breakUntil).toBeNull();
  });

  it('counts hidden time toward the break', async () => {
    const r = await inBreak();
    await r.svc.setVisible(false);
    r.clock.advance(5 * MIN);
    await r.svc.setVisible(true);
    expect(r.svc.status().allowed).toBe(true);
  });

  it('runs across midnight', async () => {
    const r = await rig({
      at: local(2026, 6, 3, 23, 40),
      configure: (d) => {
        d.parental.sessionLimitMin = 20;
        d.parental.breakLengthMin = 5;
      },
    });
    r.play(1200);
    r.svc.wrapUpFinished();
    r.play(60);
    expect(r.svc.status().reason).toBe('break');
    expect(r.svc.status().breakRemainingSec).toBe(240);
  });

  it('is not stretched by winding the clock back', async () => {
    const r = await inBreak();
    r.clock.setWall(r.clock.wallNow() - 6 * HOUR);
    r.svc.tick();
    expect(r.svc.status().breakRemainingSec).toBeLessThanOrEqual(300);
    r.play(300);
    expect(r.svc.status().allowed).toBe(true);
  });

  it('is not stretched by winding the clock back while closed', async () => {
    const r = await inBreak();
    await r.relaunch(-6 * HOUR);
    expect(r.svc.status().breakRemainingSec).toBeLessThanOrEqual(300);
  });

  it('ends early if the clock is pushed forward: a documented limit of a web app', async () => {
    const r = await inBreak();
    r.clock.advanceWallOnly(HOUR);
    r.svc.tick();
    expect(r.svc.status().allowed).toBe(true);
  });

  it('can be ended by a parent', async () => {
    const r = await inBreak();
    await r.svc.endBreak();
    expect(r.svc.status().allowed).toBe(true);
    await r.relaunch();
    expect(r.svc.status().allowed).toBe(true);
  });

  it('shortens with the setting', async () => {
    const r = await inBreak();
    await r.svc.updateSettings({ breakLengthMin: 2 });
    expect(r.svc.status().breakRemainingSec).toBe(120);
  });

  it('ends a wrap-up whose break already passed while hidden', async () => {
    const r = await rig({
      configure: (d) => {
        d.parental.sessionLimitMin = 20;
        d.parental.breakLengthMin = 2;
      },
    });
    r.play(1200);
    expect(r.svc.status().wrappingUp).toBe(true);
    await r.svc.setVisible(false);
    r.clock.advance(3 * MIN);
    await r.svc.setVisible(true);
    expect(r.svc.status().allowed).toBe(true);
    expect(r.svc.status().wrappingUp).toBe(false);
    expect(r.svc.wrapUpFinished().allowed).toBe(true);
  });
});

describe('play window', () => {
  const window = (start: string, end: string) => (d: SaveData) => {
    d.parental.playWindow = { start, end };
    d.parental.dailyLimitMin = null;
  };

  it.each([
    ['one second before opening', local(2026, 6, 3, 6, 59, 59), false],
    ['exactly at opening', local(2026, 6, 3, 7), true],
    ['in the middle', local(2026, 6, 3, 12), true],
    ['one second before closing', local(2026, 6, 3, 19, 29, 59), true],
    ['exactly at closing', local(2026, 6, 3, 19, 30), false],
    ['after closing', local(2026, 6, 3, 22), false],
  ])('07:00-19:30 at %s', async (_label, at, allowed) => {
    const r = await rig({ at, configure: window('07:00', '19:30') });
    const status = r.svc.status();
    expect(status.allowed).toBe(allowed);
    expect(status.reason).toBe(allowed ? 'ok' : 'window');
  });

  it.each([
    ['before opening', local(2026, 6, 3, 18, 59, 59), false],
    ['at opening', local(2026, 6, 3, 19), true],
    ['before midnight', local(2026, 6, 3, 23, 59), true],
    ['at midnight', local(2026, 6, 4, 0), true],
    ['after midnight', local(2026, 6, 4, 0, 59, 59), true],
    ['at closing', local(2026, 6, 4, 1), false],
    ['the next morning', local(2026, 6, 4, 9), false],
  ])('19:00-01:00 wrapping past midnight %s', async (_label, at, allowed) => {
    const r = await rig({ at, configure: window('19:00', '01:00') });
    expect(r.svc.status().allowed).toBe(allowed);
  });

  it('reports the time to closing as the remaining time', async () => {
    const r = await rig({ at: local(2026, 6, 3, 19), configure: window('07:00', '19:30') });
    expect(r.svc.status().remainingSec).toBe(1800);
    expect(r.svc.status().nextLimit).toBe('window');
  });

  it('reports the time to closing across midnight', async () => {
    const r = await rig({ at: local(2026, 6, 3, 23, 30), configure: window('19:00', '01:00') });
    expect(r.svc.status().remainingSec).toBe(90 * 60);
  });

  it('reports the earlier of the daily limit and the window', async () => {
    const r = await rig({
      at: local(2026, 6, 3, 19),
      configure: (d) => {
        d.parental.playWindow = { start: '07:00', end: '19:30' };
        d.parental.dailyLimitMin = 10;
      },
    });
    expect(r.svc.status().remainingSec).toBe(600);
    expect(r.svc.status().nextLimit).toBe('daily');
  });

  it('runs the wrap-up when it closes during play', async () => {
    const r = await rig({ at: local(2026, 6, 3, 19, 29, 50), configure: window('07:00', '19:30') });
    r.play(10);
    expect(r.limits).toEqual(['window']);
    expect(r.svc.status().wrappingUp).toBe(true);
    r.play(15);
    expect(r.svc.wrapUpFinished().reason).toBe('window');
  });

  it('opens straight to the sleeping reef with no limit event', async () => {
    const r = await rig({ at: local(2026, 6, 3, 22), configure: window('07:00', '19:30') });
    r.play(3);
    const status = r.svc.status();
    expect(status.reason).toBe('window');
    expect(status.remainingSec).toBe(0);
    expect(status.nextLimit).toBeNull();
    expect(r.limits).toEqual([]);
  });

  it('does not count time on the sleeping reef', async () => {
    const r = await rig({ at: local(2026, 6, 3, 22), configure: window('07:00', '19:30') });
    r.play(60);
    expect(r.svc.status().usedTodaySec).toBe(0);
  });

  it('opens up by itself when the window starts', async () => {
    const r = await rig({ at: local(2026, 6, 3, 6, 59, 50), configure: window('07:00', '19:30') });
    r.play(5);
    expect(r.svc.status().allowed).toBe(false);
    r.play(5);
    expect(r.svc.status().allowed).toBe(true);
  });

  it('shows the daily block first when both apply', async () => {
    const r = await rig({
      at: local(2026, 6, 3, 22),
      configure: (d) => {
        d.parental.playWindow = { start: '07:00', end: '19:30' };
        d.usage.days[JUNE_3] = { activeSec: 1800, sessions: 1 };
      },
    });
    expect(r.svc.status().reason).toBe('daily');
  });
});

describe('Parent Zone', () => {
  const inZone = async (options: RigOptions = {}) => {
    const r = await rig({ ...options, setupDone: false });
    await r.svc.setupParent({ pin: '4829', confirmPin: '4829' });
    await r.svc.verifyPin('4829');
    expect(r.svc.enterParentZone()).toBe(true);
    return r;
  };

  it('stops the clock', async () => {
    const r = await inZone();
    for (let i = 0; i < 30; i++) {
      r.clock.advance(1000);
      r.svc.parentActivity();
      r.svc.tick();
    }
    expect(r.svc.status().usedTodaySec).toBe(0);
    expect(r.svc.status().parentZoneOpen).toBe(true);
  });

  it('does not count toward the session', async () => {
    const r = await inZone({
      configure: (d) => {
        d.parental.sessionLimitMin = 10;
      },
    });
    r.clock.advance(50_000);
    r.svc.tick();
    expect(r.save.usage.sessionSec).toBe(0);
  });

  it('gives no credit for its time after exit', async () => {
    const r = await inZone();
    r.clock.advance(50_000);
    r.svc.exitParentZone();
    r.svc.tick();
    expect(r.svc.status().usedTodaySec).toBe(0);
    r.play(2);
    expect(r.svc.status().usedTodaySec).toBe(2);
  });

  it('closes after 60 seconds without input', async () => {
    const r = await inZone();
    r.clock.advance(59_000);
    r.svc.tick();
    expect(r.svc.status().parentZoneOpen).toBe(true);
    r.clock.advance(1000);
    r.svc.tick();
    expect(r.svc.status().parentZoneOpen).toBe(false);
    expect(r.zoneExpiries).toBe(1);
  });

  it('stays open while there is input', async () => {
    const r = await inZone();
    for (let i = 0; i < 5; i++) {
      r.clock.advance(50_000);
      r.svc.parentActivity();
      r.svc.tick();
    }
    expect(r.svc.status().parentZoneOpen).toBe(true);
    expect(r.zoneExpiries).toBe(0);
  });

  it('fires the expiry event once', async () => {
    const r = await inZone();
    r.clock.advance(70_000);
    r.svc.tick();
    r.play(5);
    expect(r.zoneExpiries).toBe(1);
  });

  it('is not reopened by late input', async () => {
    const r = await inZone();
    r.clock.advance(61_000);
    r.svc.parentActivity();
    expect(r.svc.status().parentZoneOpen).toBe(false);
    expect(r.zoneExpiries).toBe(1);
  });

  it('resumes counting after it expires, without crediting the idle minute', async () => {
    const r = await inZone();
    r.clock.advance(60_000);
    r.svc.tick();
    r.svc.tick();
    expect(r.svc.status().usedTodaySec).toBe(0);
    r.play(3);
    expect(r.svc.status().usedTodaySec).toBe(3);
  });

  it('gives no credit for the idle minute when status() is what closes it', async () => {
    const r = await inZone();
    r.clock.advance(60_000);
    expect(r.svc.status().parentZoneOpen).toBe(false);
    r.svc.tick();
    expect(r.svc.status().usedTodaySec).toBe(0);
  });

  it('expires by wall clock when performance.now() stalled while the iPad slept', async () => {
    const r = await inZone();
    await r.svc.setVisible(false);
    r.clock.advanceWallOnly(10 * MIN);
    await r.svc.setVisible(true);
    expect(r.svc.status().parentZoneOpen).toBe(false);
  });

  it('expires by monotonic clock if the wall clock is wound back', async () => {
    const r = await inZone();
    r.clock.advance(61_000);
    r.clock.setWall(r.clock.wallNow() - HOUR);
    r.svc.tick();
    expect(r.svc.status().parentZoneOpen).toBe(false);
  });

  it('is closed by a relaunch', async () => {
    const r = await inZone();
    await r.relaunch();
    expect(r.svc.status().parentZoneOpen).toBe(false);
  });

  it('cannot be opened without a verified PIN, so a child cannot pause the clock', async () => {
    const r = await rig();
    expect(r.svc.enterParentZone()).toBe(false);
    r.play(5);
    expect(r.svc.status().usedTodaySec).toBe(5);
  });

  it('holds back a limit until the zone closes', async () => {
    const r = await inZone(spent(1000));
    await r.svc.updateSettings({ dailyLimitMin: 10 });
    r.svc.parentActivity();
    r.clock.advance(5000);
    r.svc.tick();
    expect(r.limits).toEqual([]);
    r.svc.exitParentZone();
    r.play(1);
    expect(r.limits).toEqual(['daily']);
  });
});
