import test from 'node:test';
import assert from 'node:assert/strict';
import { addSticker, boatExtras, defaultSave, loadSave, recordResult, SAVE_KEY, totalStars, writeSave } from '../../projects/arcade-games/plop-and-pull/src/save.js';

function memory(text) {
  return { getItem: () => text, setItem() {} };
}

test('a new player starts on Level 1 with nothing collected', () => {
  const save = defaultSave();
  assert.equal(save.unlocked, 1);
  assert.deepEqual(save.stickers, []);
  assert.equal(save.tutorialSeen, false);
});

test('anything unreadable falls back to a fresh save', () => {
  assert.deepEqual(loadSave(memory('{not json')), defaultSave());
  assert.deepEqual(loadSave(memory('{"schemaVersion":99}')), defaultSave());
  assert.deepEqual(loadSave(memory(null)), defaultSave());
  const throwing = { getItem() { throw new Error('blocked'); } };
  assert.deepEqual(loadSave(throwing), defaultSave());
});

test('bad values inside a good save are repaired', () => {
  const raw = {
    schemaVersion: 1,
    settings: { music: 9, sfx: 'loud' },
    players: 7,
    unlocked: 40,
    levels: { 1: { stars: 9, best: -3 }, 8: { stars: 2, best: 5 } },
    stickers: ['bobble', 'dragon'],
  };
  const save = loadSave(memory(JSON.stringify(raw)));
  assert.equal(save.settings.music, 1);
  assert.equal(save.settings.sfx, defaultSave().settings.sfx);
  assert.equal(save.players, 1);
  assert.equal(save.unlocked, 3);
  assert.deepEqual(save.levels, { 1: { stars: 3, best: 0 } });
  assert.deepEqual(save.stickers, ['bobble']);
});

test('a saved game comes back the same', () => {
  const save = defaultSave();
  recordResult(save, 1, 2, 20);
  addSticker(save, 'stripes');
  let stored = null;
  writeSave({ setItem: (key, text) => { assert.equal(key, SAVE_KEY); stored = text; } }, save);
  assert.deepEqual(loadSave(memory(stored)), save);
});

test('a full storage does not break the game', () => {
  assert.equal(writeSave({ setItem() { throw new Error('full'); } }, defaultSave()), false);
});

test('finishing a level always opens the next, whatever the stars', () => {
  const save = defaultSave();
  recordResult(save, 1, 1, 0);
  assert.equal(save.unlocked, 2);
  recordResult(save, 3, 1, 0);
  assert.equal(save.unlocked, 3);
});

test('stars and best pearls only ever go up', () => {
  const save = defaultSave();
  assert.equal(recordResult(save, 1, 3, 50).newBest, true);
  const again = recordResult(save, 1, 1, 10);
  assert.equal(again.newBest, false);
  assert.deepEqual(save.levels[1], { stars: 3, best: 50 });
});

test('boat extras arrive as total stars grow, and each is announced once', () => {
  const save = defaultSave();
  assert.deepEqual(recordResult(save, 1, 2, 20).extras, []);
  assert.deepEqual(recordResult(save, 2, 1, 20).extras.map((item) => item.id), ['flag']);
  assert.deepEqual(boatExtras(save), ['flag']);
  assert.equal(totalStars(save), 3);
  recordResult(save, 1, 3, 40);
  recordResult(save, 2, 3, 40);
  recordResult(save, 3, 3, 40);
  assert.deepEqual(boatExtras(save), ['flag', 'parasol', 'lights']);
});

test('a sticker is only new the first time', () => {
  const save = defaultSave();
  assert.equal(addSticker(save, 'boot'), true);
  assert.equal(addSticker(save, 'boot'), false);
});
