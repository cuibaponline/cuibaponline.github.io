import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { SaveService, createIdbStorage } from '../../src/services/save';

describe('createIdbStorage', () => {
  it('stores, reads and deletes values', async () => {
    const storage = createIdbStorage('kv-test');
    await expect(storage.get('missing')).resolves.toBeUndefined();
    await storage.set('k', 'v');
    await expect(storage.get('k')).resolves.toBe('v');
    await storage.del('k');
    await expect(storage.get('k')).resolves.toBeUndefined();
  });

  it('carries a save across a relaunch through real IndexedDB semantics', async () => {
    const first = new SaveService({ storage: createIdbStorage('reef-test') });
    await first.load();
    first.update((d) => {
      d.profile.coins = 321;
      d.profile.fishBook['F01'] = { caught: 1, firstCaughtAt: '2026-10-31T10:00:00.000Z' };
    });
    await first.saveNow();

    const second = new SaveService({ storage: createIdbStorage('reef-test') });
    const { data, status } = await second.load();
    expect(status).toBe('ok');
    expect(data.profile.coins).toBe(321);
    expect(data.profile.fishBook['F01']?.caught).toBe(1);
  });
});
