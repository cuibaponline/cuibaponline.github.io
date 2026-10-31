import { describe, expect, it } from 'vitest';
import { ParentalService, dayKeyFor } from '../../src/services/parental';
import { DAY, HOUR, MIN, WEDNESDAY_NOON, local, rig } from './parentalRig';

declare const process: { env: Record<string, string | undefined> };

const JUNE_3 = '2026-06-03';
const JUNE_4 = '2026-06-04';
const JUNE_5 = '2026-06-05';

describe('dayKeyFor', () => {
  it.each([
    ['midday', local(2026, 6, 3, 12), '00:00', JUNE_3],
    ['the first second of the day', local(2026, 6, 3), '00:00', JUNE_3],
    ['one second before a 03:00 reset', local(2026, 6, 3, 2, 59, 59), '03:00', '2026-06-02'],
    ['exactly at a 03:00 reset', local(2026, 6, 3, 3), '03:00', JUNE_3],
    ['a month boundary', local(2026, 7, 1, 1), '05:00', '2026-06-30'],
    ['a year boundary', local(2027, 1, 1, 1), '02:00', '2026-12-31'],
  ])('handles %s', (_label, wall, reset, want) => {
    expect(dayKeyFor(wall, reset)).toBe(want);
  });

  it('keeps the reset at the configured local time on a DST change day', () => {
    const original = process.env['TZ'];
    process.env['TZ'] = 'America/New_York';
    try {
      // 03:30 EDT on the spring-forward day, when local time skipped 02:00-03:00.
      const wall = Date.UTC(2026, 2, 8, 7, 30);
      expect(new Date(wall).getHours()).toBe(3);
      expect(dayKeyFor(wall, '03:00')).toBe('2026-03-08');
    } finally {
      if (original === undefined) delete process.env['TZ'];
      else process.env['TZ'] = original;
    }
  });
});

describe('time accounting', () => {
  it('counts each second of visible time', async () => {
    const r = await rig();
    r.play(90);
    expect(r.svc.status().usedTodaySec).toBe(90);
  });

  it('does not count while hidden', async () => {
    const r = await rig();
    r.play(10);
    await r.svc.setVisible(false);
    for (let i = 0; i < 60; i++) {
      r.clock.advance(1000);
      r.svc.tick();
    }
    expect(r.svc.status().usedTodaySec).toBe(10);
  });

  it('gives no credit for the hidden period on return, not even one capped tick', async () => {
    const r = await rig();
    r.play(10);
    await r.svc.setVisible(false);
    r.clock.advance(5 * MIN);
    await r.svc.setVisible(true);
    r.svc.tick();
    expect(r.svc.status().usedTodaySec).toBe(10);
    r.play(1);
    expect(r.svc.status().usedTodaySec).toBe(11);
  });

  it('caps a single tick at 3 seconds when the page was frozen', async () => {
    const r = await rig();
    r.play(10);
    r.clock.advance(HOUR);
    r.svc.tick();
    expect(r.svc.status().usedTodaySec).toBe(13);
  });

  it('counts a slightly late tick in full', async () => {
    const r = await rig();
    r.clock.advance(2500);
    r.svc.tick();
    r.clock.advance(500);
    r.svc.tick();
    expect(r.svc.status().usedTodaySec).toBe(3);
  });

  it('gives no credit when only the wall clock moved', async () => {
    const r = await rig();
    r.play(10);
    r.clock.advanceWallOnly(HOUR);
    r.svc.tick();
    expect(r.svc.status().usedTodaySec).toBe(10);
  });

  it('survives performance.now() going backwards', async () => {
    const r = await rig();
    r.play(10);
    r.clock.restartMono();
    r.svc.tick();
    expect(r.svc.status().usedTodaySec).toBe(10);
  });

  it('does not over-count when ticked every frame', async () => {
    const r = await rig();
    for (let i = 0; i < 500; i++) {
      r.clock.advance(20);
      r.svc.tick();
    }
    expect(r.svc.status().usedTodaySec).toBe(10);
  });

  it('does not lose fractions across uneven ticks', async () => {
    const r = await rig();
    for (let i = 0; i < 10; i++) {
      r.clock.advance(400);
      r.svc.tick();
      r.clock.advance(700);
      r.svc.tick();
    }
    expect(r.svc.status().usedTodaySec).toBe(11);
  });

  it('credits the partial second up to a hide', async () => {
    const r = await rig();
    r.play(3);
    r.clock.advance(1000);
    await r.svc.setVisible(false);
    expect(r.svc.status().usedTodaySec).toBe(4);
  });

  it('counts nothing until the setup wizard has run', async () => {
    const r = await rig({ setupDone: false });
    r.play(60);
    expect(r.svc.status().usedTodaySec).toBe(0);
  });

  it('counts nothing when launched hidden, until the app is shown', async () => {
    const r = await rig();
    const hiddenLaunch = new ParentalService(r.store, r.clock, { visible: false });
    for (let i = 0; i < 30; i++) {
      r.clock.advance(1000);
      hiddenLaunch.tick();
    }
    expect(hiddenLaunch.status().usedTodaySec).toBe(0);

    await hiddenLaunch.setVisible(true);
    r.clock.advance(1000);
    hiddenLaunch.tick();
    expect(hiddenLaunch.status().usedTodaySec).toBe(1);
  });
});

describe('persistence of counted time', () => {
  it('has written nothing before 10 seconds', async () => {
    const r = await rig();
    r.play(9);
    await r.relaunch();
    expect(r.svc.status().usedTodaySec).toBe(0);
  });

  it('writes every 10 seconds, so a kill loses at most that', async () => {
    const r = await rig();
    await r.playLive(19);
    await r.relaunch();
    expect(r.svc.status().usedTodaySec).toBe(10);
  });

  it('writes on hide', async () => {
    const r = await rig();
    r.play(7);
    await r.svc.setVisible(false);
    await r.relaunch();
    expect(r.svc.status().usedTodaySec).toBe(7);
  });

  it('flush credits the time so far and writes it, for a pagehide with no hide event first', async () => {
    const r = await rig();
    r.play(3);
    r.clock.advance(1000);
    await r.svc.flush();
    await r.relaunch();
    expect(r.svc.status().usedTodaySec).toBe(4);
  });

  it('accumulates across relaunches', async () => {
    const r = await rig();
    r.play(7);
    await r.svc.setVisible(false);
    await r.relaunch(MIN);
    r.play(5);
    await r.svc.setVisible(false);
    await r.relaunch(MIN);
    expect(r.svc.status().usedTodaySec).toBe(12);
  });
});

describe('sessions', () => {
  const sessions = (r: Awaited<ReturnType<typeof rig>>) => r.save.usage.days[JUNE_3]?.sessions;

  it('starts counting with the first counted second, not at launch', async () => {
    const r = await rig();
    expect(sessions(r)).toBe(0);
    r.play(1);
    expect(sessions(r)).toBe(1);
  });

  it('does not count a quick relaunch as a new session', async () => {
    const r = await rig();
    r.play(30);
    await r.svc.setVisible(false);
    await r.relaunch(MIN);
    r.play(30);
    expect(sessions(r)).toBe(1);
  });

  it('counts a new session after an absence as long as the break length', async () => {
    const r = await rig();
    r.play(30);
    await r.svc.setVisible(false);
    await r.relaunch(5 * MIN);
    r.play(30);
    expect(sessions(r)).toBe(2);
  });

  it('counts a new session after a long hide without a relaunch', async () => {
    const r = await rig();
    r.play(30);
    await r.svc.setVisible(false);
    r.clock.advance(5 * MIN);
    await r.svc.setVisible(true);
    r.play(5);
    expect(sessions(r)).toBe(2);
  });
});

describe('day rollover', () => {
  const nearMidnight = local(2026, 6, 3, 23, 59, 50);

  it('moves counting to the new day during play', async () => {
    const r = await rig({
      at: nearMidnight,
      configure: (d) => {
        d.usage.days[JUNE_3] = { activeSec: 100, sessions: 1 };
        d.usage.sessionSec = 100;
      },
    });
    r.play(20);
    expect(r.save.usage.days[JUNE_3]?.activeSec).toBe(109);
    expect(r.save.usage.days[JUNE_4]?.activeSec).toBe(11);
  });

  it('carries a running session into the new day exactly once', async () => {
    const r = await rig({
      at: nearMidnight,
      configure: (d) => {
        d.usage.days[JUNE_3] = { activeSec: 100, sessions: 1 };
        d.usage.sessionSec = 100;
      },
    });
    r.play(20);
    expect(r.save.usage.days[JUNE_4]?.sessions).toBe(1);
  });

  it('honours a 03:00 reset instead of midnight', async () => {
    const r = await rig({
      at: local(2026, 6, 4, 2, 59, 50),
      configure: (d) => {
        d.parental.dayResetTime = '03:00';
      },
    });
    r.play(5);
    expect(r.svc.status().dayKey).toBe(JUNE_3);
    r.play(10);
    expect(r.svc.status().dayKey).toBe(JUNE_4);
  });

  it('notices the new day straight after a hide spanning midnight', async () => {
    const r = await rig({ at: nearMidnight });
    r.play(1);
    await r.svc.setVisible(false);
    r.clock.advance(MIN);
    await r.svc.setVisible(true);
    expect(r.svc.status().dayKey).toBe(JUNE_4);
  });

  it('retains 30 days of history and always the current one', async () => {
    const r = await rig();
    for (let i = 0; i < 40; i++) {
      r.clock.advance(DAY);
      r.svc.tick();
    }
    const keys = Object.keys(r.save.usage.days).sort();
    expect(keys).toHaveLength(30);
    expect(keys.at(-1)).toBe('2026-07-13');
    expect(keys[0]).toBe('2026-06-14');
  });

  it('keeps the current day when an old clock makes it sort first', async () => {
    const r = await rig({
      configure: (d) => {
        d.usage.days['2026-06-02'] = { activeSec: 5, sessions: 1 };
      },
    });
    r.clock.setWall(local(2024, 1, 1, 12));
    r.svc.tick();
    r.clock.advance(DAY);
    r.svc.tick();
    expect(r.save.usage.days['2024-01-02']).toBeDefined();
  });
});

describe('clock moved backwards', () => {
  const flagged = (r: Awaited<ReturnType<typeof rig>>, key: string) => r.save.usage.days[key]?.clockChanged;

  it('flags a jump of more than 5 minutes on the day in use', async () => {
    const r = await rig();
    r.play(10);
    r.clock.setWall(WEDNESDAY_NOON - HOUR);
    r.svc.tick();
    expect(flagged(r, JUNE_3)).toBe(true);
  });

  it('does not flag a jump of exactly 5 minutes', async () => {
    const r = await rig();
    r.play(10);
    r.clock.setWall(r.clock.wallNow() - 5 * MIN);
    r.svc.tick();
    expect(flagged(r, JUNE_3)).toBeUndefined();
  });

  it('flags one second past 5 minutes', async () => {
    const r = await rig();
    r.play(10);
    r.clock.setWall(r.clock.wallNow() - 5 * MIN - 1000);
    r.svc.tick();
    expect(flagged(r, JUNE_3)).toBe(true);
  });

  async function spentThursday() {
    const r = await rig({
      at: local(2026, 6, 4, 0, 10),
      configure: (d) => {
        d.usage.days[JUNE_3] = { activeSec: 60, sessions: 1 };
        d.usage.days[JUNE_4] = { activeSec: 1800, sessions: 1 };
      },
    });
    r.svc.tick();
    r.clock.setWall(local(2026, 6, 3, 23, 0));
    return r;
  }

  it('cannot reach yesterday’s unused allowance', async () => {
    const r = await spentThursday();
    r.svc.tick();
    const status = r.svc.status();
    expect(status.dayKey).toBe(JUNE_4);
    expect(status.allowed).toBe(false);
    expect(status.reason).toBe('daily');
    expect(flagged(r, JUNE_4)).toBe(true);
  });

  it('keeps holding the day on the ticks after detection', async () => {
    const r = await spentThursday();
    r.svc.tick();
    r.play(30);
    expect(r.svc.status().dayKey).toBe(JUNE_4);
    expect(r.svc.status().reason).toBe('daily');
  });

  it('reports the held day from dayKey(), so "once a day" prompts follow it too', async () => {
    const r = await spentThursday();
    r.svc.tick();
    expect(r.svc.dayKey()).toBe(JUNE_4);
  });

  it('keeps holding the day after a relaunch', async () => {
    const r = await spentThursday();
    r.svc.tick();
    await r.svc.setVisible(false);
    await r.relaunch(MIN);
    expect(r.svc.status().dayKey).toBe(JUNE_4);
    expect(r.svc.status().reason).toBe('daily');
  });

  it('detects a jump made while the app was closed', async () => {
    const r = await rig({
      at: local(2026, 6, 4, 0, 10),
      configure: (d) => {
        d.usage.days[JUNE_4] = { activeSec: 1800, sessions: 1 };
      },
    });
    r.svc.tick();
    await r.svc.setVisible(false);
    await r.relaunch(-2 * HOUR);
    expect(r.svc.status().dayKey).toBe(JUNE_4);
    expect(r.svc.status().reason).toBe('daily');
    expect(flagged(r, JUNE_4)).toBe(true);
  });

  it('does not flip the day on a small correction across midnight', async () => {
    const r = await rig({ at: local(2026, 6, 4, 0, 2) });
    r.svc.tick();
    r.clock.setWall(local(2026, 6, 3, 23, 59));
    r.svc.tick();
    expect(r.svc.status().dayKey).toBe(JUNE_4);
    expect(flagged(r, JUNE_4)).toBeUndefined();
  });

  it('lets go at the next day reset of the new clock, so a wrong clock cannot freeze the game', async () => {
    const r = await rig({
      at: local(2027, 6, 3, 12),
      configure: (d) => {
        d.usage.days['2027-06-03'] = { activeSec: 1800, sessions: 1 };
      },
    });
    r.svc.tick();
    r.clock.setWall(WEDNESDAY_NOON);
    r.svc.tick();
    expect(r.svc.status().dayKey).toBe('2027-06-03');
    expect(r.svc.status().allowed).toBe(false);

    r.clock.advance(13 * HOUR);
    r.svc.tick();
    expect(r.svc.status().dayKey).toBe(JUNE_4);
    expect(r.svc.status().allowed).toBe(true);
  });

  it('cannot refill a spent day by leaving the clock wrong past a reset and then correcting it', async () => {
    const r = await rig({
      at: local(2026, 6, 4, 12),
      configure: (d) => {
        d.usage.days[JUNE_4] = { activeSec: 1800, sessions: 1 };
      },
    });
    r.svc.tick();
    r.clock.setWall(local(2026, 6, 1, 12));
    r.svc.tick();
    r.clock.advance(13 * HOUR); // 2 June on the wrong clock: the hold lets go
    r.svc.tick();
    expect(r.svc.status().dayKey).toBe('2026-06-02');

    r.clock.setWall(local(2026, 6, 4, 12, 5));
    r.svc.tick();
    expect(r.svc.status().dayKey).toBe(JUNE_4);
    expect(r.svc.status().reason).toBe('daily');
  });

  it('returns to normal when the clock is corrected', async () => {
    const r = await rig({ at: local(2026, 6, 4, 12) });
    r.play(10);
    r.clock.setWall(local(2026, 6, 3, 12));
    r.svc.tick();
    r.clock.setWall(local(2026, 6, 4, 12, 5));
    r.svc.tick();
    expect(r.svc.status().dayKey).toBe(JUNE_4);
    r.clock.setWall(local(2026, 6, 5, 12));
    r.svc.tick();
    expect(r.svc.status().dayKey).toBe(JUNE_5);
  });

  it('keeps the original day across repeated jumps', async () => {
    const r = await rig({ at: local(2026, 6, 4, 12) });
    r.play(5);
    r.clock.setWall(local(2026, 6, 3, 12));
    r.svc.tick();
    r.clock.setWall(local(2026, 6, 2, 12));
    r.svc.tick();
    expect(r.svc.status().dayKey).toBe(JUNE_4);
  });

  it('adds no play time for the jump', async () => {
    const r = await rig();
    r.play(10);
    r.clock.setWall(WEDNESDAY_NOON - 2 * HOUR);
    r.svc.tick();
    expect(r.svc.status().usedTodaySec).toBe(10);
  });
});

describe('clock moved forwards', () => {
  it('adds no play time within the day', async () => {
    const r = await rig();
    r.play(10);
    r.clock.advanceWallOnly(3 * HOUR);
    r.svc.tick();
    expect(r.svc.status().usedTodaySec).toBe(10);
  });

  it('rolls the day when it crosses the reset, as real time passing would', async () => {
    const r = await rig({
      configure: (d) => {
        d.usage.days[JUNE_3] = { activeSec: 1800, sessions: 1 };
      },
    });
    r.svc.tick();
    expect(r.svc.status().allowed).toBe(false);
    r.clock.advanceWallOnly(DAY);
    r.svc.tick();
    expect(r.svc.status().dayKey).toBe(JUNE_4);
    expect(r.svc.status().allowed).toBe(true);
  });

  it('cannot be undone to win back the day: going back again is flagged and stays spent', async () => {
    const r = await rig();
    r.clock.advanceWallOnly(DAY);
    r.play(1800);
    expect(r.svc.status().reason).toBe('daily');
    r.clock.setWall(WEDNESDAY_NOON + 31 * MIN);
    r.svc.tick();
    expect(r.svc.status().dayKey).toBe(JUNE_4);
    expect(r.svc.status().reason).toBe('daily');
    expect(r.save.usage.days[JUNE_4]?.clockChanged).toBe(true);
  });
});
