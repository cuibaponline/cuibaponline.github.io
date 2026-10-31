import test from 'node:test';
import assert from 'node:assert/strict';
import { addSticker, defaultSave, loadSave, recordResult, SAVE_KEY, totalStars, unlockCosmetics, writeSave } from '../../projects/arcade-games/lasso-ranch/src/save.js';

function memory(initial) {
  const data = new Map(initial === undefined ? [] : [[SAVE_KEY, initial]]);
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test('a fresh device starts from defaults', () => {
  assert.deepEqual(loadSave(memory()), defaultSave());
});

test('progress survives a save and load', () => {
  const storage = memory();
  const save = defaultSave();
  recordResult(save, 'easy', 1, 3, 92);
  addSticker(save, 'A1');
  writeSave(storage, save);
  const loaded = loadSave(storage);
  assert.deepEqual(loaded.progress.easy.levels[1], { stars: 3, best: 92 });
  assert.equal(loaded.progress.easy.unlockedLevel, 2);
  assert.deepEqual(loaded.stickers, ['A1']);
});

test('corrupted saves fall back to defaults without throwing', () => {
  for (const bad of ['{not json', 'null', '[]', '42', '{"schemaVersion":99}', '{"schemaVersion":1,"progress":"x","settings":3,"stickers":{},"cosmetics":[]}']) {
    const save = loadSave(memory(bad));
    assert.equal(save.progress.easy.unlockedLevel, 1, bad);
    assert.equal(save.cosmetics.equipped.rope, 'rope_yellow', bad);
  }
});

test('bad values inside a valid save are cleaned up', () => {
  const save = loadSave(memory(JSON.stringify({
    schemaVersion: 1,
    settings: { music: 9, sfx: 'loud', tapOnLane: 'yes' },
    progress: { easy: { unlockedLevel: 99, levels: { 1: { stars: 7, best: -5 }, 40: { stars: 1, best: 1 }, 2: 'x' } } },
    stickers: ['A1', 'ZZ'],
    cosmetics: { owned: ['rope_red', 'stolen'], equipped: { rope: 'rope_blue', hat: 'hat_crown' } },
  })));
  assert.equal(save.settings.music, 1);
  assert.equal(save.settings.sfx, 1);
  assert.equal(save.settings.tapOnLane, false);
  assert.equal(save.progress.easy.unlockedLevel, 12);
  assert.deepEqual(save.progress.easy.levels, { 1: { stars: 3, best: 0 } });
  assert.deepEqual(save.stickers, ['A1']);
  assert.ok(save.cosmetics.owned.includes('rope_red') && !save.cosmetics.owned.includes('stolen'));
  assert.equal(save.cosmetics.equipped.rope, 'rope_yellow');
  assert.equal(save.cosmetics.equipped.hat, null);
});

test('storage that throws never reaches the game', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('full'); } };
  assert.deepEqual(loadSave(broken), defaultSave());
  assert.equal(writeSave(broken, defaultSave()), false);
});

test('a result keeps the best stars and score and unlocks the next level', () => {
  const save = defaultSave();
  assert.equal(recordResult(save, 'medium', 1, 2, 80).newBest, true);
  const worse = recordResult(save, 'medium', 1, 1, 40);
  assert.equal(worse.newBest, false);
  assert.deepEqual(save.progress.medium.levels[1], { stars: 2, best: 80 });
  assert.equal(save.progress.medium.unlockedLevel, 2);
  assert.equal(save.progress.easy.unlockedLevel, 1, 'progress is stored per mode');
});

test('cosmetics unlock from total stars across modes', () => {
  const save = defaultSave();
  recordResult(save, 'easy', 1, 3, 10);
  assert.ok(save.cosmetics.owned.includes('hat_cowboy'));
  assert.ok(!save.cosmetics.owned.includes('rope_red'));
  const { unlocked } = recordResult(save, 'hard', 1, 3, 10);
  assert.equal(totalStars(save), 6);
  assert.deepEqual(unlocked.map((item) => item.id), ['rope_red']);
  assert.deepEqual(unlockCosmetics(save), []);
});

test('a sticker is only awarded once', () => {
  const save = defaultSave();
  assert.equal(addSticker(save, 'A2'), true);
  assert.equal(addSticker(save, 'A2'), false);
});
