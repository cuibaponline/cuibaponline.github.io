import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../../projects/arcade-games/plop-and-pull/src/data.js';
import { summarise } from './bot.mjs';

const GAMES = 40;

for (const players of [1, 2]) {
  for (const { level } of LEVELS) {
    test(`Level ${level} with ${players} boat(s) is kind to a child tapping at random`, () => {
      const s = summarise(level, players, 'random', GAMES);
      assert.ok(s.two >= 0.95, `2 stars ${s.two}`);
      assert.ok(s.three <= 0.1, `3 stars ${s.three}`);
      assert.ok(s.creatures >= 0.8, `creatures ${s.creatures}`);
      assert.equal(s.empty, 0);
      assert.ok(s.gap <= 7, `longest gap ${s.gap}`);
      if (players === 1) assert.ok(s.casts >= 15, `casts ${s.casts}`);
    });

    test(`Level ${level} with ${players} boat(s) keeps three stars for playing with intent`, () => {
      assert.ok(summarise(level, players, 'masher', GAMES).three <= 0.25, 'masher');
      const focused = summarise(level, players, 'focused', GAMES);
      assert.ok(focused.three >= 0.9, 'focused');
      assert.ok(focused.top <= 0.5, 'one species took over');
    });

    test(`Level ${level} with ${players} boat(s) does not punish holding instead of tapping`, () => {
      const random = summarise(level, players, 'random', GAMES).pearls;
      const holder = summarise(level, players, 'holder', GAMES).pearls;
      assert.ok(holder >= random * 0.8, `holder ${holder} random ${random}`);
    });
  }
}

test('every Level 3 run gets the Big Hum breach, whatever the child does', () => {
  for (const strategy of ['random', 'holder']) {
    assert.equal(summarise(3, 1, strategy, GAMES).breached, 1);
  }
});
