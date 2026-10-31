import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SAVE_KEYS,
  SaveService,
  fnv1a,
  requestPersistentStorage,
  type SaveTimers,
} from '../../src/services/save';
import { createDefaultSave, type SaveData } from '../../src/services/saveSchema';
import { v0Fixture } from './fixtures';
import { MemoryKv } from './helpers';

const { a: SLOT_A, b: SLOT_B, current: POINTER } = SAVE_KEYS;

const open = (kv: MemoryKv, options: Partial<ConstructorParameters<typeof SaveService>[0]> = {}) =>
  new SaveService({ storage: kv, ...options });

async function reload(kv: MemoryKv) {
  kv.relaunch();
  return open(kv).load();
}

/** A disk holding coins=1 in slot A and coins=2 (the current one) in slot B. */
async function twoGoodSlots(): Promise<MemoryKv> {
  const kv = new MemoryKv();
  const svc = open(kv);
  await svc.load();
  for (const coins of [1, 2]) {
    svc.update((d) => {
      d.profile.coins = coins;
    });
    await svc.saveNow();
  }
  return kv;
}

const slotWrites = (kv: MemoryKv) => kv.log.filter((op) => op === `set ${SLOT_A}` || op === `set ${SLOT_B}`).length;

describe('fnv1a', () => {
  // Published FNV-1a 32-bit test vectors.
  it.each([
    ['', '811c9dc5'],
    ['a', 'e40c292c'],
    ['foobar', 'bf9cf968'],
  ])('hashes %j to %s', (text, want) => {
    expect(fnv1a(text)).toBe(want);
  });
});

describe('load', () => {
  it('starts from defaults on a fresh install and does not call that a recovery', async () => {
    const result = await open(new MemoryKv()).load();
    expect(result.data).toEqual(createDefaultSave());
    expect(result.recovered).toBe(false);
    expect(result.status).toBe('fresh');
  });

  it('restores what was saved', async () => {
    const kv = await twoGoodSlots();
    const result = await reload(kv);
    expect(result.data.profile.coins).toBe(2);
    expect(result.recovered).toBe(false);
    expect(result.status).toBe('ok');
  });

  it('makes the loaded data available from get()', async () => {
    const kv = await twoGoodSlots();
    const svc = open(kv);
    await svc.load();
    expect(svc.get().profile.coins).toBe(2);
  });

  it('prefers a verified newer slot when the kill came before the pointer moved', async () => {
    const kv = await twoGoodSlots();
    kv.map.set(POINTER, 'a'); // pointer stale: says the older slot is current
    const result = await reload(kv);
    expect(result.data.profile.coins).toBe(2);
    expect(result.recovered).toBe(false);
  });

  it.each([
    ['missing', undefined],
    ['garbage', 'not json'],
  ])('uses the newest good slot when the pointer is %s', async (_label, pointer) => {
    const kv = await twoGoodSlots();
    if (pointer === undefined) kv.map.delete(POINTER);
    else kv.map.set(POINTER, pointer);
    const result = await reload(kv);
    expect(result.data.profile.coins).toBe(2);
    expect(result.recovered).toBe(false);
  });
});

describe('corrupted-slot fallback', () => {
  const corruptions: [string, (stored: string, kv: MemoryKv) => void][] = [
    ['truncated', (s, kv) => kv.map.set(SLOT_B, s.slice(0, s.length - 20))],
    ['truncated to almost nothing', (s, kv) => kv.map.set(SLOT_B, s.slice(0, 3))],
    ['a flipped character in the payload', (s, kv) => kv.map.set(SLOT_B, s.replace('"coins\\":2', '"coins\\":9'))],
    ['removed', (_s, kv) => kv.map.delete(SLOT_B)],
    ['not a string', (_s, kv) => kv.map.set(SLOT_B, { seq: 99 })],
    ['null', (_s, kv) => kv.map.set(SLOT_B, null)],
    ['an empty string', (_s, kv) => kv.map.set(SLOT_B, '')],
    ['valid JSON of the wrong shape', (_s, kv) => kv.map.set(SLOT_B, '{"seq":99}')],
    ['a JSON array', (_s, kv) => kv.map.set(SLOT_B, '[1,2,3]')],
    [
      'a raised sequence number',
      (s, kv) => kv.map.set(SLOT_B, JSON.stringify({ ...JSON.parse(s), seq: 99 })),
    ],
    [
      'a good checksum over a broken save',
      (_s, kv) => {
        const json = JSON.stringify({ schemaVersion: 1, profile: 'lost' });
        kv.map.set(SLOT_B, JSON.stringify({ seq: 99, checksum: fnv1a(`99:${json}`), json }));
      },
    ],
  ];

  it.each(corruptions)('falls back to the last good slot when the current one is %s', async (_label, corrupt) => {
    const kv = await twoGoodSlots();
    corrupt(kv.map.get(SLOT_B) as string, kv);
    const result = await reload(kv);
    expect(result.data.profile.coins).toBe(1);
    expect(result.recovered).toBe(true);
    expect(result.status).toBe('fallback');
  });

  it('is quiet when only the older slot is bad', async () => {
    const kv = await twoGoodSlots();
    kv.map.set(SLOT_A, 'garbage');
    const result = await reload(kv);
    expect(result.data.profile.coins).toBe(2);
    expect(result.recovered).toBe(false);
  });

  it('reports a recovery when a slot is bad and the pointer cannot say which was current', async () => {
    const kv = await twoGoodSlots();
    kv.map.set(SLOT_B, 'garbage');
    kv.map.delete(POINTER);
    const result = await reload(kv);
    expect(result.data.profile.coins).toBe(1);
    expect(result.recovered).toBe(true);
  });

  it('starts from defaults and reports it when both slots are bad', async () => {
    const kv = await twoGoodSlots();
    kv.map.set(SLOT_A, 'x');
    kv.map.set(SLOT_B, 'y');
    const result = await reload(kv);
    expect(result.data).toEqual(createDefaultSave());
    expect(result.recovered).toBe(true);
    expect(result.status).toBe('reset');
  });

  it('reports a reset, not a fresh install, when both slots vanished but the pointer survived', async () => {
    const kv = await twoGoodSlots();
    kv.map.delete(SLOT_A);
    kv.map.delete(SLOT_B);
    const result = await reload(kv);
    expect(result.recovered).toBe(true);
    expect(result.status).toBe('reset');
  });

  it('keeps saving normally after both slots were bad', async () => {
    const kv = await twoGoodSlots();
    kv.map.set(SLOT_A, 'x');
    kv.map.set(SLOT_B, 'y');
    kv.relaunch();
    const svc = open(kv);
    await svc.load();
    svc.update((d) => {
      d.profile.coins = 50;
    });
    await svc.saveNow();
    expect((await reload(kv)).data.profile.coins).toBe(50);
  });

  it('heals by writing over the bad slot, never the only good one', async () => {
    const kv = await twoGoodSlots();
    kv.map.set(SLOT_B, 'garbage');
    const goodSlot = kv.map.get(SLOT_A);
    kv.relaunch();
    const svc = open(kv);
    await svc.load();
    await svc.saveNow();
    expect(kv.map.get(SLOT_A)).toBe(goodSlot);
    expect(kv.map.get(SLOT_B)).not.toBe('garbage');
    expect((await reload(kv)).recovered).toBe(false);
  });

  it('writes the recovered data back without being asked twice', async () => {
    const kv = await twoGoodSlots();
    kv.map.set(SLOT_B, 'garbage');
    kv.relaunch();
    const svc = open(kv);
    await svc.load();
    await svc.flush();
    expect(kv.map.get(SLOT_B)).not.toBe('garbage');
  });

  it('continues the sequence past a recovered slot', async () => {
    const kv = await twoGoodSlots();
    kv.map.set(SLOT_B, 'garbage');
    kv.relaunch();
    const svc = open(kv);
    await svc.load();
    svc.update((d) => {
      d.profile.coins = 3;
    });
    await svc.saveNow();
    svc.update((d) => {
      d.profile.coins = 4;
    });
    await svc.saveNow();
    expect((await reload(kv)).data.profile.coins).toBe(4);
  });
});

describe('storage that cannot be read', () => {
  it('does not throw, and reports it', async () => {
    const kv = await twoGoodSlots();
    kv.onGet = () => {
      throw new Error('Connection to Indexed Database server lost');
    };
    const result = await reload(kv);
    expect(result.data).toEqual(createDefaultSave());
    expect(result.recovered).toBe(true);
    expect(result.status).toBe('unavailable');
  });

  it('never overwrites a save it could not read', async () => {
    const kv = await twoGoodSlots();
    const [a, b] = [kv.map.get(SLOT_A), kv.map.get(SLOT_B)];
    kv.onGet = () => {
      throw new Error('Connection to Indexed Database server lost');
    };
    kv.relaunch();
    const svc = open(kv);
    await svc.load();
    svc.update((d) => {
      d.profile.coins = 999;
    });
    await svc.saveNow();
    await svc.saveNow();
    expect(kv.map.get(SLOT_A)).toBe(a);
    expect(kv.map.get(SLOT_B)).toBe(b);
    expect(svc.saveError).not.toBeNull();
  });

  it('survives a transient read failure', async () => {
    const kv = await twoGoodSlots();
    let failures = 1;
    kv.onGet = () => {
      if (failures-- > 0) throw new Error('transient');
    };
    const result = await reload(kv);
    expect(result.data.profile.coins).toBe(2);
    expect(result.status).toBe('ok');
  });
});

describe('migration on load', () => {
  function slotHolding(raw: unknown, seq: number): string {
    const json = JSON.stringify(raw);
    return JSON.stringify({ seq, checksum: fnv1a(`${seq}:${json}`), json });
  }

  it('upgrades a v0 slot and keeps the progress', async () => {
    const kv = new MemoryKv();
    kv.map.set(SLOT_A, slotHolding(v0Fixture(), 4));
    kv.map.set(POINTER, 'a');
    const result = await open(kv).load();
    expect(result.data.schemaVersion).toBe(1);
    expect(result.data.profile.coins).toBe(1234);
    expect(result.data.profile.levelSeen).toBe(5);
    expect(result.recovered).toBe(false);
  });

  it('writes the upgraded save to the other slot, leaving the v0 original until that succeeds', async () => {
    const kv = new MemoryKv();
    const original = slotHolding(v0Fixture(), 4);
    kv.map.set(SLOT_A, original);
    kv.map.set(POINTER, 'a');
    const svc = open(kv);
    await svc.load();
    await svc.flush();
    expect(kv.map.get(SLOT_A)).toBe(original);
    expect(kv.map.has(SLOT_B)).toBe(true);
    expect((await reload(kv)).data.profile.xp).toBe(2900);
  });

  it('will not overwrite a slot written by a newer build', async () => {
    const kv = await twoGoodSlots();
    const future = slotHolding({ ...createDefaultSave(), schemaVersion: 2 }, 3);
    kv.map.set(SLOT_B, future);
    kv.relaunch();
    const svc = open(kv);
    const result = await svc.load();
    expect(result.status).toBe('unavailable');
    svc.update((d) => {
      d.profile.coins = 7;
    });
    await svc.saveNow();
    expect(kv.map.get(SLOT_B)).toBe(future);
  });
});

describe('saveNow', () => {
  it('alternates slots, so the previous good save stays intact', async () => {
    const kv = new MemoryKv();
    const svc = open(kv);
    await svc.load();
    await svc.saveNow();
    const first = kv.map.get(SLOT_A) ?? kv.map.get(SLOT_B);
    const firstKey = kv.map.has(SLOT_A) ? SLOT_A : SLOT_B;
    svc.update((d) => {
      d.profile.coins = 1;
    });
    await svc.saveNow();
    expect(kv.map.get(firstKey)).toBe(first);
    expect(kv.map.has(firstKey === SLOT_A ? SLOT_B : SLOT_A)).toBe(true);
  });

  it('writes, then reads back, then marks current, in that order', async () => {
    const kv = new MemoryKv();
    const svc = open(kv);
    await svc.load();
    kv.log.length = 0;
    await svc.saveNow();
    const slot = kv.log[0]!.replace('set ', '');
    expect(kv.log).toEqual([`set ${slot}`, `get ${slot}`, `set ${POINTER}`]);
  });

  it('does not write before load, so defaults cannot clobber a real save', async () => {
    const kv = await twoGoodSlots();
    kv.log.length = 0;
    const svc = open(kv);
    await svc.saveNow();
    await svc.flush();
    expect(kv.log).toEqual([]);
  });

  it('leaves the good slot current when the read-back differs', async () => {
    const kv = await twoGoodSlots();
    kv.relaunch();
    const svc = open(kv);
    await svc.load();
    const pointer = kv.map.get(POINTER);
    kv.onSet = (key, value) => (key === POINTER ? value : String(value).slice(0, 12));
    svc.update((d) => {
      d.profile.coins = 3;
    });
    await svc.saveNow();
    kv.onSet = null;
    expect(kv.map.get(POINTER)).toBe(pointer);
    expect(svc.saveError).not.toBeNull();
    expect((await reload(kv)).data.profile.coins).toBe(2);
  });

  it('resolves and keeps the data pending when storage is full', async () => {
    const kv = await twoGoodSlots();
    kv.relaunch();
    const svc = open(kv);
    await svc.load();
    kv.onSet = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    svc.update((d) => {
      d.profile.coins = 3;
    });
    await expect(svc.saveNow()).resolves.toBeUndefined();
    expect(svc.saveError).not.toBeNull();

    kv.onSet = null;
    await svc.flush();
    expect(svc.saveError).toBeNull();
    expect((await reload(kv)).data.profile.coins).toBe(3);
  });

  it('reports a failed save once, and again if it fails after recovering', async () => {
    const kv = await twoGoodSlots();
    kv.relaunch();
    const onError = vi.fn();
    const svc = open(kv, { onError });
    await svc.load();
    kv.onSet = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    await svc.saveNow();
    await svc.saveNow();
    expect(onError).toHaveBeenCalledTimes(1);

    kv.onSet = null;
    await svc.saveNow();
    kv.onSet = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    await svc.saveNow();
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('keeps alternating when only the pointer write failed', async () => {
    const kv = await twoGoodSlots();
    kv.relaunch();
    const svc = open(kv);
    await svc.load();
    const slotA = kv.map.get(SLOT_A);
    kv.onSet = (key, value) => {
      if (key === POINTER) throw new Error('flaky');
      return value;
    };
    svc.update((d) => {
      d.profile.coins = 3;
    });
    await svc.saveNow(); // lands in A
    expect(kv.map.get(SLOT_A)).not.toBe(slotA);
    const newest = kv.map.get(SLOT_A);
    svc.update((d) => {
      d.profile.coins = 4;
    });
    await svc.saveNow(); // must land in B, not over the newest save
    expect(kv.map.get(SLOT_A)).toBe(newest);
    expect((await reload(kv)).data.profile.coins).toBe(4);
  });

  it('refuses to persist a save that would not load back', async () => {
    const kv = await twoGoodSlots();
    kv.relaunch();
    const svc = open(kv);
    await svc.load();
    kv.log.length = 0;
    svc.update((d) => {
      d.profile.coins = NaN;
    });
    await svc.saveNow();
    expect(slotWrites(kv)).toBe(0);
    expect(svc.saveError).not.toBeNull();
    expect((await reload(kv)).data.profile.coins).toBe(2);
  });

  it('writes state changed directly through get() when asked to', async () => {
    const kv = new MemoryKv();
    const svc = open(kv);
    await svc.load();
    svc.get().profile.coins = 11;
    await svc.saveNow();
    expect((await reload(kv)).data.profile.coins).toBe(11);
  });
});

describe('overlapping writes', () => {
  it('never interleaves the steps of two writes', async () => {
    const kv = new MemoryKv();
    const svc = open(kv);
    await svc.load();
    kv.log.length = 0;
    const calls: Promise<void>[] = [];
    for (let coins = 1; coins <= 4; coins++) {
      svc.update((d) => {
        d.profile.coins = coins;
      });
      calls.push(svc.saveNow());
      await Promise.resolve(); // lands while the previous write is between its awaits
    }
    await Promise.all(calls);

    expect(slotWrites(kv)).toBeGreaterThan(1);
    expect(kv.log.length % 3).toBe(0);
    for (let i = 0; i < kv.log.length; i += 3) {
      const slot = kv.log[i]!.replace('set ', '');
      expect([SLOT_A, SLOT_B]).toContain(slot);
      expect(kv.log.slice(i, i + 3)).toEqual([`set ${slot}`, `get ${slot}`, `set ${POINTER}`]);
    }
  });

  it('coalesces a burst into the write in flight plus one more', async () => {
    const kv = new MemoryKv();
    const svc = open(kv);
    await svc.load();
    kv.log.length = 0;
    kv.hold();
    const calls = Array.from({ length: 10 }, () => svc.saveNow());
    kv.release();
    await Promise.all(calls);
    expect(slotWrites(kv)).toBeLessThanOrEqual(2);
  });

  it('ends with the latest state on disk', async () => {
    const kv = new MemoryKv();
    const svc = open(kv);
    await svc.load();
    kv.hold();
    svc.update((d) => {
      d.profile.coins = 1;
    });
    const first = svc.saveNow();
    await Promise.resolve();
    svc.update((d) => {
      d.profile.coins = 2;
    });
    const second = svc.saveNow();
    kv.release();
    await Promise.all([first, second]);
    expect((await reload(kv)).data.profile.coins).toBe(2);
  });

  it('only resolves a later call once its own state is on disk', async () => {
    const kv = new MemoryKv();
    const svc = open(kv);
    await svc.load();
    kv.hold();
    const first = svc.saveNow();
    await Promise.resolve();
    svc.update((d) => {
      d.profile.coins = 5;
    });
    let secondDone = false;
    const second = svc.saveNow().then(() => {
      secondDone = true;
    });
    kv.release();
    await first;
    expect(secondDone).toBe(false);
    await second;
    expect((await reload(kv)).data.profile.coins).toBe(5);
  });

  it('does not lose a change made during a write', async () => {
    const kv = new MemoryKv();
    const svc = open(kv);
    await svc.load();
    kv.hold();
    const inFlight = svc.saveNow();
    await Promise.resolve();
    svc.update((d) => {
      d.profile.coins = 8;
    });
    kv.release();
    await inFlight;
    await svc.flush();
    expect((await reload(kv)).data.profile.coins).toBe(8);
  });

  it('keeps working after a failed write in the queue', async () => {
    const kv = new MemoryKv();
    const svc = open(kv);
    await svc.load();
    let failures = 1;
    kv.onSet = (_key, value) => {
      if (failures-- > 0) throw new Error('flaky');
      return value;
    };
    await svc.saveNow();
    svc.update((d) => {
      d.profile.coins = 6;
    });
    await svc.saveNow();
    expect((await reload(kv)).data.profile.coins).toBe(6);
  });
});

describe('kill mid-write', () => {
  async function killedAt(ops: number) {
    const kv = await twoGoodSlots();
    kv.relaunch();
    const svc = open(kv);
    await svc.load();
    svc.update((d) => {
      d.profile.coins = 3;
    });
    kv.killAfter(ops);
    await svc.saveNow();
    return reload(kv);
  }

  it('loses at most the save in progress, wherever the kill lands', async () => {
    for (let ops = 0; ops <= 6; ops++) {
      const { data } = await killedAt(ops);
      expect([2, 3]).toContain(data.profile.coins);
    }
  });

  it('drops a half-written slot and keeps the previous save', async () => {
    const { data, recovered } = await killedAt(0);
    expect(data.profile.coins).toBe(2);
    expect(recovered).toBe(false);
  });

  it('keeps a slot that was fully written even if the pointer never moved', async () => {
    const { data } = await killedAt(2);
    expect(data.profile.coins).toBe(3);
  });

  it('keeps saving correctly after every kill point', async () => {
    for (let ops = 0; ops <= 6; ops++) {
      const kv = await twoGoodSlots();
      kv.relaunch();
      const before = open(kv);
      await before.load();
      kv.killAfter(ops);
      await before.saveNow();
      kv.relaunch();
      const after = open(kv);
      await after.load();
      after.update((d) => {
        d.profile.coins = 100;
      });
      await after.saveNow();
      expect((await reload(kv)).data.profile.coins).toBe(100);
    }
  });
});

describe('saveSoon', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps what is on disk within 10 seconds of play throughout steady catches (US-21)', async () => {
    const kv = new MemoryKv();
    const svc = open(kv);
    await svc.load();
    for (let second = 1; second <= 60; second++) {
      svc.update((d) => {
        d.profile.coins = second;
      });
      svc.saveSoon();
      await vi.advanceTimersByTimeAsync(1000);

      const disk = await open(kv).load();
      expect(second - disk.data.profile.coins).toBeLessThanOrEqual(10);
    }
  });

  async function loaded() {
    const kv = new MemoryKv();
    const svc = open(kv);
    await svc.load();
    kv.log.length = 0;
    return { kv, svc };
  }

  it('waits at least 2 seconds', async () => {
    const { kv, svc } = await loaded();
    svc.saveSoon();
    await vi.advanceTimersByTimeAsync(1999);
    expect(slotWrites(kv)).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(slotWrites(kv)).toBe(1);
  });

  it('coalesces a burst into one write', async () => {
    const { kv, svc } = await loaded();
    for (let i = 0; i < 5; i++) {
      svc.saveSoon();
      await vi.advanceTimersByTimeAsync(100);
    }
    await vi.advanceTimersByTimeAsync(5000);
    expect(slotWrites(kv)).toBe(1);
  });

  it('restarts the wait when called again', async () => {
    const { kv, svc } = await loaded();
    svc.saveSoon();
    await vi.advanceTimersByTimeAsync(1500);
    svc.saveSoon();
    await vi.advanceTimersByTimeAsync(1500);
    expect(slotWrites(kv)).toBe(0);
    await vi.advanceTimersByTimeAsync(500);
    expect(slotWrites(kv)).toBe(1);
  });

  it('cannot be starved past the 10 second durability promise by constant catches', async () => {
    const { kv, svc } = await loaded();
    svc.update((d) => {
      d.profile.coins = 1;
    });
    for (let t = 0; t < 10; t++) {
      svc.saveSoon();
      await vi.advanceTimersByTimeAsync(1000);
    }
    expect(slotWrites(kv)).toBeGreaterThanOrEqual(1);
  });

  it('never goes below 2 seconds even if configured lower', async () => {
    const kv = new MemoryKv();
    const svc = open(kv, { debounceMs: 100 });
    await svc.load();
    kv.log.length = 0;
    svc.saveSoon();
    await vi.advanceTimersByTimeAsync(1999);
    expect(slotWrites(kv)).toBe(0);
  });

  it('is cancelled by saveNow', async () => {
    const { kv, svc } = await loaded();
    svc.saveSoon();
    await svc.saveNow();
    const writes = slotWrites(kv);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(slotWrites(kv)).toBe(writes);
  });

  it('is cancelled by flush', async () => {
    const { kv, svc } = await loaded();
    svc.update((d) => {
      d.profile.coins = 1;
    });
    svc.saveSoon();
    await svc.flush();
    expect(slotWrites(kv)).toBe(1);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(slotWrites(kv)).toBe(1);
  });

  it('runs on injected timers', async () => {
    const pending: (() => void)[] = [];
    const delays: number[] = [];
    const timers: SaveTimers = {
      setTimeout: (fn, ms) => {
        pending.push(fn);
        delays.push(ms);
        return pending.length;
      },
      clearTimeout: () => {},
    };
    const kv = new MemoryKv();
    const svc = open(kv, { timers });
    await svc.load();
    kv.log.length = 0;
    svc.saveSoon();
    expect(delays[0]).toBeGreaterThanOrEqual(2000);
    pending[0]!();
    await svc.flush();
    expect(slotWrites(kv)).toBe(1);
  });
});

describe('flush', () => {
  it('writes when there are unsaved changes', async () => {
    const kv = new MemoryKv();
    const svc = open(kv);
    await svc.load();
    svc.update((d) => {
      d.profile.coins = 1;
    });
    await svc.flush();
    expect((await reload(kv)).data.profile.coins).toBe(1);
  });

  it('writes after update', async () => {
    const kv = new MemoryKv();
    const svc = open(kv);
    await svc.load();
    svc.update((d) => {
      d.profile.coins = 2;
    });
    await svc.flush();
    expect((await reload(kv)).data.profile.coins).toBe(2);
  });

  it('writes nothing when clean', async () => {
    const kv = await twoGoodSlots();
    kv.relaunch();
    const svc = open(kv);
    await svc.load();
    kv.log.length = 0;
    await svc.flush();
    expect(kv.log).toEqual([]);
  });

  it('waits for a write already in flight', async () => {
    const kv = new MemoryKv();
    const svc = open(kv);
    await svc.load();
    kv.hold();
    const write = svc.saveNow();
    let flushed = false;
    const flush = svc.flush().then(() => {
      flushed = true;
    });
    await Promise.resolve();
    expect(flushed).toBe(false);
    kv.release();
    await Promise.all([write, flush]);
    expect(flushed).toBe(true);
  });
});

describe('update', () => {
  it('applies the change to get() immediately, before any write', async () => {
    const svc = open(new MemoryKv());
    await svc.load();
    svc.update((d: SaveData) => {
      d.profile.xp = 40;
    });
    expect(svc.get().profile.xp).toBe(40);
  });
});

describe('requestPersistentStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports false when the API is absent', async () => {
    vi.stubGlobal('navigator', {});
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it('reports false when there is no navigator at all', async () => {
    vi.stubGlobal('navigator', undefined);
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });

  it('passes on what the browser granted', async () => {
    vi.stubGlobal('navigator', { storage: { persist: async () => true } });
    await expect(requestPersistentStorage()).resolves.toBe(true);
  });

  it('reports false rather than rejecting', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        persist: async () => {
          throw new Error('denied');
        },
      },
    });
    await expect(requestPersistentStorage()).resolves.toBe(false);
  });
});
