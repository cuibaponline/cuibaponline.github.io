import assert from 'node:assert/strict';
import test from 'node:test';

import { creatureBox } from '../../projects/arcade-games/plop-and-pull/src/art.js';
import { CREATURES, SEA_SCALE, WORLD } from '../../projects/arcade-games/plop-and-pull/src/data.js';

const swimmers = Object.keys(CREATURES).filter((type) => type !== 'hum');
const seaWidth = (type) => creatureBox(type)[0] * SEA_SCALE;

test('no swimming friend fills more than 30% of the sea width', () => {
  for (const type of swimmers) {
    assert.ok(seaWidth(type) <= WORLD.width * 0.3, `${type} is ${Math.round(seaWidth(type))} wide`);
  }
});

test('every swimming friend stays big enough to see and aim at', () => {
  for (const type of swimmers) {
    assert.ok(seaWidth(type) >= 100, `${type} is ${Math.round(seaWidth(type))} wide`);
  }
});

test('every part of a swimming friend sits inside its tap circle', () => {
  for (const type of swimmers) {
    assert.ok(CREATURES[type].radius >= seaWidth(type) / 2, `${type} pokes out of its tap circle`);
  }
});
