import test from 'node:test';
import assert from 'node:assert/strict';
import { BIG_TUG, CAST, CREATURES, DAY, FIND_ORDER, HOP, LEVELS, PULL, WORLD } from '../../projects/arcade-games/plop-and-pull/src/data.js';
import { levelConfig, Round, starsFor } from '../../projects/arcade-games/plop-and-pull/src/sim.js';

const DT = 1 / 60;

function seeded(seed) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
}

function quiet(level = 1, players = 1, overrides = {}) {
  const config = { ...levelConfig(level, players), fish: 0, bubbles: [], ...overrides };
  return new Round({ config, rng: seeded(7) });
}

function run(round, seconds) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) round.update(DT);
}

function until(round, done, limit = 40) {
  for (let t = 0; t < limit; t += DT) {
    if (done()) return;
    round.update(DT);
  }
  assert.fail('condition never became true');
}

const pulling = (round, boat = 0) => () => round.boats[boat].state === 'pull';
const landed = (round, boat = 0) => () => round.boats[boat].state === 'ready';
const eventsOf = (round, type) => round.drainEvents().filter((event) => event.type === type);

test('there are exactly three levels and each opens more of the sea', () => {
  assert.equal(LEVELS.length, 3);
  assert.ok(LEVELS[0].floor < LEVELS[1].floor && LEVELS[1].floor < LEVELS[2].floor);
});

test('two boats get more fish and higher jar lines than one', () => {
  for (const { level } of LEVELS) {
    const one = levelConfig(level, 1);
    const two = levelConfig(level, 2);
    assert.ok(two.fish > one.fish);
    assert.ok(two.stars[0] > one.stars[0]);
  }
});

test('every level finishes with at least one star, even with no pearls', () => {
  assert.equal(starsFor(0, [18, 36]), 1);
  assert.equal(starsFor(18, [18, 36]), 2);
  assert.equal(starsFor(36, [18, 36]), 3);
});

test('touching near a fish stops it and sends the ring to it', () => {
  const round = quiet();
  const fish = round.addFish('bobble', 300, 450);
  round.touch(0, 300 + CAST.snap, 450);
  assert.equal(round.boats[0].state, 'drop');
  assert.equal(fish.state, 'waiting');
  const x = fish.x;
  run(round, 0.1);
  assert.equal(fish.x, x);
  assert.equal(round.boats[0].targetX, 300);
});

test('a fish on the ring goes up with it', () => {
  const round = quiet();
  const fish = round.addFish('bobble', 300, 450);
  round.touch(0, 300, 450);
  until(round, pulling(round));
  assert.equal(fish.state, 'riding');
  assert.deepEqual(round.boats[0].riders, [fish]);
});

test('with no fish in reach of the touch the ring goes to the touch, kept above the floor', () => {
  const round = quiet();
  round.touch(0, 300, 1100);
  assert.equal(round.boats[0].targetX, 300);
  assert.equal(round.boats[0].targetY, LEVELS[0].floor - CAST.floorGap);
});

test('a fish within lure reach swims over to an empty ring', () => {
  const round = quiet();
  const fish = round.addFish('stripes', 300 + CAST.snap + CREATURES.stripes.radius + 20, 500, -1);
  round.touch(0, 300, 500);
  assert.equal(round.boats[0].fish, null);
  until(round, pulling(round));
  assert.equal(fish.state, 'riding');
});

test('a cast with no fish around brings up a Funny Find, in a fixed rotation', () => {
  const round = quiet();
  const seen = [];
  for (let i = 0; i < FIND_ORDER.length + 1; i++) {
    round.touch(0, 300, 500);
    until(round, pulling(round));
    seen.push(round.boats[0].riders[0].type);
    until(round, landed(round));
  }
  assert.deepEqual(seen, [...FIND_ORDER, FIND_ORDER[0]]);
  assert.equal(round.pearls, FIND_ORDER.length + 1);
});

test('no cast ever comes up empty', () => {
  const round = new Round({ config: levelConfig(3, 1), rng: seeded(11) });
  const random = seeded(5);
  round.drainEvents();
  let casts = 0;
  let leaps = 0;
  while (!round.finished) {
    if (round.boats[0].state === 'ready' && random() < 0.05) {
      round.touch(0, random() * WORLD.width, WORLD.surface + random() * 900);
      casts += round.boats[0].state === 'drop' ? 1 : 0;
    }
    round.update(DT);
    for (const event of round.drainEvents()) {
      if (event.type === 'breach') leaps += 1;
      if (event.type !== 'leap') continue;
      leaps += 1;
      assert.ok(event.riders.length >= 1);
    }
  }
  assert.ok(casts > 5);
  assert.ok(leaps >= casts - 1);
});

test('the line rises by itself, faster when held, and heavier friends rise slower', () => {
  const round = quiet(3);
  round.addFish('bobble', 300, 700);
  round.touch(0, 300, 700);
  until(round, pulling(round));
  let y = round.boats[0].ring.y;
  run(round, 1);
  assert.ok(Math.abs(y - round.boats[0].ring.y - PULL.idle) < 6);

  y = round.boats[0].ring.y;
  round.setHolds([{ count: 1, leanX: null }]);
  run(round, 0.25);
  assert.ok(Math.abs(y - round.boats[0].ring.y - PULL.hold * 0.25) < 8);

  const heavy = quiet(3);
  heavy.addFish('swoop', 300, 800);
  heavy.touch(0, 300, 800);
  until(heavy, pulling(heavy));
  y = heavy.boats[0].ring.y;
  run(heavy, 1);
  assert.ok(Math.abs(y - heavy.boats[0].ring.y - PULL.idle / CREATURES.swoop.weight) < 6);
});

test('each tap during a pull lifts the ring a step', () => {
  const round = quiet();
  round.addFish('bobble', 300, 550);
  round.touch(0, 300, 550);
  until(round, pulling(round));
  const y = round.boats[0].ring.y;
  round.touch(0, 500, 500);
  assert.equal(round.boats[0].ring.y, y - PULL.tap);
});

test('a held finger leans the ring toward it, at a limited speed', () => {
  const round = quiet(3);
  round.addFish('bobble', 300, 1000);
  round.touch(0, 300, 1000);
  until(round, pulling(round));
  const x = round.boats[0].ring.x;
  round.setHolds([{ count: 1, leanX: 700 }]);
  run(round, 0.5);
  assert.ok(Math.abs(round.boats[0].ring.x - x - PULL.lean * 0.5) < 6);
});

test('on Level 1 the rising ring collects nobody else', () => {
  const round = quiet(1);
  round.addFish('bobble', 300, 600);
  const other = round.addFish('stripes', 300, 400);
  other.speed = 0;
  round.touch(0, 300, 600);
  until(round, pulling(round));
  until(round, () => round.boats[0].ring.y < 380);
  assert.equal(round.boats[0].riders.length, 1);
});

test('from Level 2 friends hop on the way up, to a limit', () => {
  const round = quiet(2);
  round.addFish('boxy', 300, 700);
  const friends = [640, 600, 560, 520, 480].map((y) => {
    const fish = round.addFish('bobble', 300, y);
    fish.speed = 0;
    return fish;
  });
  round.touch(0, 300, 700);
  until(round, pulling(round));
  until(round, () => round.boats[0].ring.y < 450);
  assert.equal(round.boats[0].riders.length, 1 + HOP.extras);
  assert.equal(friends.filter((fish) => fish.state === 'riding').length, HOP.extras);
});

test('nobody hops onto a Funny Find', () => {
  const round = quiet(2);
  round.touch(0, 300, 790);
  until(round, pulling(round));
  round.addFish('bobble', 300, 400).speed = 0;
  assert.ok(FIND_ORDER.includes(round.boats[0].riders[0].type));
  until(round, () => round.boats[0].ring.y < 380);
  assert.equal(round.boats[0].riders.length, 1);
});

test('breaking the surface pays the pearls, leaps the riders, then readies the boat', () => {
  const round = quiet();
  const fish = round.addFish('hoppa', 300, 500);
  round.touch(0, 300, 500);
  until(round, () => round.boats[0].state === 'pop');
  const [leap] = eventsOf(round, 'leap');
  assert.equal(leap.pearls, CREATURES.hoppa.pearls);
  assert.equal(leap.riders[0].type, 'hoppa');
  assert.equal(round.pearls, CREATURES.hoppa.pearls);
  assert.ok(!round.fish.includes(fish));
  run(round, CAST.popTime + 0.02);
  assert.equal(round.boats[0].state, 'ready');
});

test('fish that leave or are caught are replaced from off screen', () => {
  const round = new Round({ config: levelConfig(1, 1), rng: seeded(3) });
  const target = round.config.fish;
  assert.equal(round.fish.length, target);
  const fish = round.fish[0];
  round.touch(0, fish.x, fish.y);
  until(round, () => round.boats[0].state === 'ready' && round.pearls > 0);
  run(round, 1);
  assert.equal(round.fish.length, target);
});

test('the sun runs while playing and pauses after a stretch with no touches', () => {
  const round = quiet();
  run(round, DAY.idlePause + 5);
  assert.ok(Math.abs(round.day - DAY.idlePause) < 0.05);
  round.touch(0, 300, 500);
  run(round, 2);
  assert.ok(round.day > DAY.idlePause + 1);
});

test('the idle hint appears before the sun pauses', () => {
  const round = quiet();
  round.addFish('bobble', 300, 450).speed = 0;
  run(round, DAY.hint - 0.5);
  assert.equal(round.hintFish, null);
  run(round, 1);
  assert.equal(round.hintFish.type, 'bobble');
  round.touch(0, 300, 450);
  assert.equal(round.hintFish, null);
});

test('at sunset a pull in progress still lands and no new cast starts', () => {
  const round = quiet();
  round.addFish('bobble', 300, 600);
  round.day = round.duration - 0.05;
  round.touch(0, 300, 600);
  run(round, 0.2);
  assert.equal(round.finished, false);
  until(round, () => round.finished);
  assert.ok(round.pearls > 0);
  const pearls = round.pearls;
  round.touch(0, 300, 500);
  run(round, 2);
  assert.equal(round.pearls, pearls);
});

test('the last seconds of the day are Golden Glow, doubling pearls', () => {
  const round = quiet();
  round.day = round.duration - DAY.glow - 0.5;
  assert.equal(round.multiplier, 1);
  round.touch(0, 300, 500);
  run(round, 0.6);
  assert.ok(round.golden);
  assert.equal(eventsOf(round, 'glow').length, 1);
  assert.equal(round.multiplier, DAY.glowMultiplier);
});

test('a Double bubble doubles pearls for a while and does not stack with Golden Glow', () => {
  const round = quiet(2);
  round.addBubble('double', 300, 500);
  round.touch(0, 300, 500);
  assert.equal(round.multiplier, 2);
  round.day = round.duration - 1;
  assert.equal(round.multiplier, 2);
  round.day = 0;
  run(round, 9);
  assert.equal(round.multiplier, 1);
});

test('bubbles arrive on schedule, take turns, and rising ones pop harmlessly at the surface', () => {
  const round = new Round({ config: { ...levelConfig(2, 1), fish: 0 }, rng: seeded(9) });
  for (let i = 0; i < 20.1 * 60; i++) {
    round.update(DT);
    round.idle = 0;
  }
  assert.equal(round.bubbles.length, 1);
  assert.equal(round.bubbles[0].kind, 'double');
  for (let i = 0; i < 20 * 60; i++) {
    round.update(DT);
    round.idle = 0;
  }
  assert.ok(round.bubbles.some((bubble) => bubble.kind === 'bigRing'));
});

test('a Big Ring gives the next pull a wider reach and more riders', () => {
  const round = quiet(2);
  round.addBubble('bigRing', 300, 750);
  round.addFish('boxy', 300, 700);
  round.touch(0, 300, 750);
  assert.equal(round.boats[0].bigRing, true);
  const wide = (35 + 0.35 * 62) * 1.5;
  const friends = [640, 580, 520, 460, 400, 360].map((y, i) => {
    const fish = round.addFish('bobble', 300 + (i % 2 ? wide : -wide), y);
    fish.speed = 0;
    return fish;
  });
  until(round, () => round.boats[0].state === 'pop');
  assert.equal(friends.filter((fish) => !round.fish.includes(fish)).length, HOP.bigExtras);
  assert.equal(round.boats[0].bigRing, false);
});

test('Big Hum rises late in the day on Level 3 only', () => {
  const round = quiet(3);
  assert.equal(quiet(2).hum, null);
  round.day = round.duration * BIG_TUG.riseAt - 0.5;
  round.idle = 0;
  run(round, 0.2);
  assert.equal(round.hum.state, 'hidden');
  round.touch(0, 300, 500);
  run(round, 1);
  assert.equal(round.hum.state, 'rising');
  round.touch(0, 300, 500);
  until(round, () => round.hum.state === 'waiting');
  assert.equal(round.hum.y, BIG_TUG.y);
});

function tugging(players = 1) {
  const round = quiet(3, players);
  round.hum.state = 'waiting';
  round.hum.y = BIG_TUG.y;
  round.day = round.duration * BIG_TUG.riseAt;
  round.touch(0, 300, BIG_TUG.y);
  until(round, () => round.hum.state === 'tug');
  return round;
}

test('a cast on Big Hum starts the Big Tug and holds the sun still', () => {
  const round = tugging();
  const day = round.day;
  round.idle = 0;
  run(round, 1);
  assert.equal(round.day, day);
});

test('Big Tug rises by itself, faster with one finger, fastest with two', () => {
  const speed = (holds) => {
    const round = tugging();
    round.setHolds([holds]);
    const y = round.hum.y;
    run(round, 1);
    return y - round.hum.y;
  };
  assert.ok(Math.abs(speed({ count: 0, leanX: null }) - BIG_TUG.speeds[0]) < 4);
  assert.ok(Math.abs(speed({ count: 1, leanX: null }) - BIG_TUG.speeds[1]) < 4);
  assert.ok(Math.abs(speed({ count: 2, leanX: null }) - BIG_TUG.speeds[2]) < 6);
});

test('in two boats both children count toward the Big Tug', () => {
  const round = tugging(2);
  round.setHolds([{ count: 1, leanX: null }, { count: 1, leanX: null }]);
  const y = round.hum.y;
  run(round, 1);
  assert.ok(Math.abs(y - round.hum.y - BIG_TUG.speeds[2]) < 6);
});

test('Big Tug pays out at the breach and then the day carries on', () => {
  const round = tugging();
  const before = round.pearls;
  until(round, () => round.hum.state === 'breach');
  assert.equal(round.pearls - before, BIG_TUG.pearls);
  until(round, () => round.hum.state === 'gone');
  assert.equal(round.boats[0].state, 'ready');
  const day = round.day;
  round.touch(0, 300, 500);
  run(round, 1);
  assert.ok(round.day > day);
});

test('Big Hum takes the ring by itself if nobody casts on it', () => {
  const round = quiet(3);
  round.hum.state = 'waiting';
  round.hum.y = BIG_TUG.y;
  round.day = round.duration * BIG_TUG.takeAt + 0.1;
  round.update(DT);
  assert.equal(round.boats[0].state, 'drop');
  until(round, () => round.hum.state === 'tug');
});

test('a boat that was busy joins the Big Tug when it lands', () => {
  const round = quiet(3, 2);
  round.hum.state = 'waiting';
  round.hum.y = BIG_TUG.y;
  round.touch(1, 500, 600);
  round.touch(0, 300, BIG_TUG.y);
  until(round, () => round.hum.state === 'tug');
  until(round, () => round.boats[1].state === 'tug');
  assert.equal(round.boats[0].state, 'tug');
});

test('a ring still dropping when Big Hum breaches does not start a second tug', () => {
  const round = tugging(2);
  round.hum.y = BIG_TUG.breachY + 1;
  run(round, 0.1);
  assert.equal(round.hum.state, 'breach');
  const paid = round.pearls;
  run(round, BIG_TUG.breachTime + 3);
  assert.equal(round.hum.state, 'gone');
  assert.equal(round.boats[1].state, 'ready');
  assert.ok(round.pearls - paid < BIG_TUG.pearls);
});

test('two boats stay on their own side of the sea', () => {
  const round = quiet(1, 2);
  round.touch(0, 790, 450);
  assert.ok(round.boats[0].targetX <= round.boats[0].max);
  assert.ok(round.boats[0].max < WORLD.halfway);
});

test('a boat only snaps to fish on its own side', () => {
  const round = quiet(1, 2);
  const fish = round.addFish('bobble', WORLD.halfway + 30, 450);
  round.touch(0, WORLD.halfway - 20, 450);
  assert.equal(fish.state, 'swim');
});

test('a tapped fish cannot be taken by the other boat', () => {
  const round = quiet(1, 2);
  const fish = round.addFish('bobble', 400, 450);
  round.touch(0, 400, 450);
  assert.equal(fish.reservedBy, 0);
  fish.x = 430;
  round.touch(1, 430, 450);
  assert.equal(round.boats[1].fish, null);
});

test('the first-ever round waits with one glowing fish, and any touch catches it', () => {
  const config = levelConfig(1, 1);
  const round = new Round({ config, rng: seeded(4), tutorial: true });
  assert.equal(round.fish.length, 1);
  run(round, 12);
  assert.equal(round.day, 0);
  round.touch(0, 780, 1000);
  assert.equal(round.boats[0].fish, round.fish[0]);
  until(round, () => round.pearls > 0);
  run(round, 3);
  assert.ok(round.day > 0);
  assert.ok(round.fish.length > 1);
});

test('two boats each get a tutorial fish on their own side', () => {
  const round = new Round({ config: levelConfig(1, 2), rng: seeded(4), tutorial: true });
  assert.equal(round.fish.length, 2);
  round.touch(1, 700, 900);
  assert.ok(round.boats[1].fish.x > WORLD.halfway);
});

test('the same seed and the same touches give the same score', () => {
  const play = () => {
    const round = new Round({ config: levelConfig(2, 1), rng: seeded(21) });
    const random = seeded(8);
    while (!round.finished) {
      if (random() < 0.05) round.touch(0, random() * WORLD.width, WORLD.surface + random() * 800);
      round.update(DT);
    }
    return round.pearls;
  };
  assert.equal(play(), play());
});
