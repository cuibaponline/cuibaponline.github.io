import test from 'node:test';
import assert from 'node:assert/strict';
import { INPUT, WORLD } from '../../projects/arcade-games/plop-and-pull/src/data.js';
import { TouchRouter } from '../../projects/arcade-games/plop-and-pull/src/input.js';

const bottom = 1180;

test('a touch registers on the way down and belongs to boat one in single play', () => {
  const router = new TouchRouter({ players: 1, bottom });
  assert.deepEqual(router.down(1, 700, 500, 0), { boat: 0, x: 700, y: 500 });
});

test('touches near the bottom edge are resting wrists, not taps', () => {
  const router = new TouchRouter({ players: 1, bottom });
  assert.equal(router.down(1, 400, bottom - INPUT.deadZone + 1, 0), null);
  assert.equal(router.holds()[0].count, 0);
});

test('a second contact right beside the last one counts as the same touch', () => {
  const router = new TouchRouter({ players: 1, bottom });
  router.down(1, 400, 500, 1000);
  assert.equal(router.down(2, 420, 510, 1000 + INPUT.sameTouchMs - 1), null);
  router.up(1);
  assert.equal(router.holds()[0].count, 1);
});

test('a later or farther touch is a new touch', () => {
  const router = new TouchRouter({ players: 1, bottom });
  router.down(1, 400, 500, 1000);
  assert.ok(router.down(2, 420, 510, 1000 + INPUT.sameTouchMs + 1));
  assert.ok(router.down(3, 400 + INPUT.sameTouchGap + 90, 500, 1000 + INPUT.sameTouchMs + 2));
});

test('with two boats a touch belongs to the half it started on, wherever it drags', () => {
  const router = new TouchRouter({ players: 2, bottom });
  assert.equal(router.down(1, WORLD.halfway - 10, 500, 0).boat, 0);
  assert.equal(router.down(2, WORLD.halfway + 10, 700, 500).boat, 1);
  router.move(1, 780, 500);
  const holds = router.holds();
  assert.equal(holds[0].count, 1);
  assert.equal(holds[0].leanX, 780);
  assert.equal(holds[1].count, 1);
});

test('lifting a finger or the system cancelling it ends the hold', () => {
  const router = new TouchRouter({ players: 1, bottom });
  router.down(1, 400, 500, 0);
  router.down(2, 600, 500, 500);
  assert.equal(router.holds()[0].count, 2);
  router.up(1);
  router.up(2);
  assert.deepEqual(router.holds()[0], { count: 0, leanX: null });
});

test('reset forgets every finger, so a pause cannot leave a stuck hold', () => {
  const router = new TouchRouter({ players: 1, bottom });
  router.down(1, 400, 500, 0);
  router.reset();
  assert.equal(router.holds()[0].count, 0);
});
