import test from 'node:test';
import assert from 'node:assert/strict';
import { ANIMALS, DIFFICULTY, LANES, LASSO_ORIGIN_Y, LEVELS, ROWS, SPAWN, TIMING } from '../../projects/arcade-games/lasso-ranch/src/data.js';
import { comboMultiplier, levelConfig, Round, starsFor } from '../../projects/arcade-games/lasso-ranch/src/sim.js';

import { playRound } from './bot.mjs';

const DT = 1 / 60;

function seeded(seed) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
}

function emptyRound(level, mode, options = {}) {
  const round = new Round({ config: levelConfig(level, mode), rng: seeded(7), ...options });
  round.animals = [];
  round.rowTimers = round.rowTimers.map(() => 999);
  round.drainEvents();
  return round;
}

function place(round, type, row, x) {
  const animal = round.spawn(type, row);
  animal.x = x;
  animal.dir = 1;
  return animal;
}

function run(round, seconds) {
  for (let t = 0; t < seconds; t += DT) round.update(DT);
}

function freezeHerd(round) {
  round.stepHerd = () => {};
}

test('a throw is ignored during cooldown', () => {
  const round = emptyRound(1, 'medium');
  assert.equal(round.throwLasso(0), true);
  assert.equal(round.throwLasso(0), false);
  assert.ok(round.drainEvents().some((event) => event.type === 'blocked'));
});

test('catching takes the animal under the lane and scores its points', () => {
  const round = emptyRound(1, 'medium');
  freezeHerd(round);
  const lane = LANES[2][0];
  const cow = place(round, 'A2', 0, lane);
  round.throwLasso(0);
  run(round, 0.3);
  assert.equal(cow.state, 'caught');
  assert.equal(round.score, ANIMALS.A2.points);
  assert.equal(round.lasso.state, 'dragging');
  run(round, TIMING.cooldownCatch + 0.05);
  assert.equal(round.lasso.state, 'idle');
  assert.equal(round.animals.length, 0);
});

test('the front-most animal wins when two rows overlap the lane', () => {
  const round = emptyRound(9, 'medium');
  freezeHerd(round);
  const lane = LANES[2][0];
  const back = place(round, 'A5', 2, lane);
  const front = place(round, 'A1', 0, lane);
  round.throwLasso(0);
  run(round, 0.5);
  assert.equal(front.state, 'caught');
  assert.notEqual(back.state, 'caught');
});

test('a miss retracts, resets combo and applies the mode cooldown', () => {
  for (const mode of Object.keys(DIFFICULTY)) {
    const round = emptyRound(9, mode);
    freezeHerd(round);
    round.streak = 4;
    round.throwLasso(0);
    run(round, DIFFICULTY[mode].travel + 0.05);
    assert.equal(round.lasso.state, 'retracting');
    assert.equal(round.streak, 0);
    run(round, TIMING.retract + 0.02);
    assert.equal(round.lasso.state, 'cooldown');
    assert.equal(round.ready, false);
    run(round, DIFFICULTY[mode].cooldownMiss + 0.02);
    assert.equal(round.ready, true, mode);
  }
});

test('the rope reaches the back row in the travel time for each mode', () => {
  for (const [mode, diff] of Object.entries(DIFFICULTY)) {
    const round = emptyRound(9, mode);
    freezeHerd(round);
    round.throwLasso(0);
    run(round, diff.travel - 0.04);
    assert.equal(round.lasso.state, 'throwing', mode);
    run(round, 0.08);
    assert.equal(round.lasso.state, 'retracting', mode);
  }
});

test('catch window and aim assist scale with difficulty', () => {
  const lane = LANES[2][0];
  const reach = (mode) => {
    const round = emptyRound(1, mode);
    return ANIMALS.A2.hw * round.config.catchWindow + round.config.assist;
  };
  assert.ok(reach('easy') > reach('medium') && reach('medium') > reach('hard'));

  const hit = (mode, offset) => {
    const round = emptyRound(1, mode);
    freezeHerd(round);
    const cow = place(round, 'A2', 0, lane + offset);
    round.throwLasso(0);
    run(round, 0.3);
    return cow.state === 'caught';
  };
  assert.equal(hit('easy', reach('easy') - 2), true);
  assert.equal(hit('easy', reach('easy') + 2), false);
  assert.equal(hit('hard', reach('hard') + 2), false);
});

test('hop lifts the hitbox out of reach at the top of the bounce', () => {
  const round = emptyRound(5, 'medium');
  freezeHerd(round);
  const cow = place(round, 'A4', 0, LANES[2][0]);
  cow.hop = 60;
  round.throwLasso(0);
  run(round, 0.3);
  assert.notEqual(cow.state, 'caught');
});

test('combo multiplier follows the spec steps, and Easy stays at x1', () => {
  assert.deepEqual([1, 2, 3, 5, 6, 9].map((n) => comboMultiplier(n)), [1, 1, 1.5, 1.5, 2, 2]);
  assert.equal(comboMultiplier(6, false), 1);

  const round = emptyRound(1, 'medium');
  freezeHerd(round);
  let expected = 0;
  [1, 1, 1.5, 1.5, 1.5, 2].forEach((multiplier) => {
    place(round, 'A2', 0, LANES[2][0]);
    round.throwLasso(0);
    run(round, 1);
    expected += Math.round(ANIMALS.A2.points * multiplier);
  });
  assert.equal(round.score, expected);

  const easy = emptyRound(1, 'easy');
  freezeHerd(easy);
  for (let i = 0; i < 6; i++) {
    place(easy, 'A2', 0, LANES[2][0]);
    easy.throwLasso(0);
    run(easy, 1.2);
  }
  assert.equal(easy.score, ANIMALS.A2.points * 6);
});

test('a skunk costs points but the score never goes below zero', () => {
  const round = emptyRound(7, 'medium');
  freezeHerd(round);
  round.score = 4;
  place(round, 'H1', 0, LANES[2][0]);
  round.throwLasso(0);
  run(round, 0.3);
  assert.equal(round.score, 0);
  assert.ok(round.stink > 0);
  assert.equal(round.streak, 0);
});

test('a porcupine jams the lasso for 1.5 seconds', () => {
  const round = emptyRound(11, 'hard');
  freezeHerd(round);
  place(round, 'H2', 0, LANES[3][0]);
  round.score = 20;
  round.throwLasso(0);
  run(round, 0.2 + TIMING.cooldownCatch + 0.05);
  assert.equal(round.lasso.state, 'cooldown');
  assert.equal(round.score, 20);
  run(round, TIMING.jam - 0.3);
  assert.equal(round.ready, false);
  run(round, 0.4);
  assert.equal(round.ready, true);
});

test('Mega Lasso catches up to three animals in one throw, and only in the bonus', () => {
  const bonus = emptyRound(3, 'medium', { bonus: true });
  freezeHerd(bonus);
  const lane = LANES[2][0];
  const herd = [place(bonus, 'A1', 0, lane - 20), place(bonus, 'A1', 0, lane + 20), place(bonus, 'A2', 1, lane), place(bonus, 'A2', 1, lane + 10)];
  bonus.throwLasso(0);
  run(bonus, 0.5);
  assert.equal(herd.filter((a) => a.state === 'caught').length, 3);

  const main = emptyRound(3, 'medium');
  freezeHerd(main);
  const pair = [place(main, 'A1', 0, lane - 20), place(main, 'A1', 0, lane + 20)];
  main.throwLasso(0);
  run(main, 0.5);
  assert.equal(pair.filter((a) => a.state === 'caught').length, 1);
});

test('the bonus round is 15 seconds, hazard-free, and spawns three times as fast', () => {
  const config = levelConfig(9, 'hard');
  assert.ok(config.pool.includes('H1'));
  const bonus = new Round({ config, bonus: true, rng: seeded(3) });
  assert.equal(bonus.time, 15);
  const seen = new Set();
  for (let t = 0; t < 15; t += DT) {
    bonus.update(DT);
    bonus.animals.forEach((a) => seen.add(a.type));
  }
  assert.ok(![...seen].some((id) => ANIMALS[id].hazard));

  const count = (isBonus) => {
    const round = new Round({ config: { ...levelConfig(4, 'medium'), pool: ['A5'] }, bonus: isBonus, rng: seeded(11), bounds: [-99999, 99999] });
    const before = round.nextId;
    round.activeCount = () => 0;
    for (let t = 0; t < 12; t += DT) round.stepHerd(DT);
    return round.nextId - before;
  };
  const ratio = count(true) / count(false);
  assert.ok(ratio > 2.6 && ratio < 3.4, `ratio ${ratio}`);
});

test('never more than the on-screen cap of animals', () => {
  const round = new Round({ config: levelConfig(12, 'hard'), bonus: true, rng: seeded(5), bounds: [-300, 1500] });
  for (let t = 0; t < 15; t += DT) {
    round.update(DT);
    assert.ok(round.activeCount() <= SPAWN.maxOnScreen);
  }
});

test('hazards stay clear of high-value animals', () => {
  const round = new Round({ config: levelConfig(12, 'hard'), rng: seeded(9), bounds: [-99999, 99999] });
  const spawned = [];
  const original = round.spawn.bind(round);
  round.spawn = (type, row) => {
    spawned.push({ type, at: round.clock });
    return original(type, row);
  };
  round.activeCount = () => 0;
  for (let t = 0; t < 600; t += DT) {
    round.clock += DT;
    round.stepHerd(DT);
  }
  assert.ok(spawned.some((s) => ANIMALS[s.type].hazard));
  spawned.forEach((s, i) => {
    if (!ANIMALS[s.type].hazard) return;
    for (const earlier of spawned.slice(Math.max(0, i - 6), i)) {
      if (ANIMALS[earlier.type].points >= SPAWN.highValue) {
        assert.ok(s.at - earlier.at >= SPAWN.hazardBehindHighValue - DT);
      }
    }
  });
});

test('the golden calf appears at most once, in the second half, from level 6', () => {
  for (let seed = 1; seed < 40; seed++) {
    const round = new Round({ config: levelConfig(6, 'medium'), rng: seeded(seed * 991) });
    let golden = 0;
    const original = round.spawn.bind(round);
    round.spawn = (type, row) => {
      if (type === 'S1') {
        golden += 1;
        assert.ok(round.time < round.duration / 2);
      }
      return original(type, row);
    };
    run(round, round.duration + 1);
    assert.ok(golden <= 1);
  }
  assert.ok(!levelConfig(5, 'medium').pool.includes('S1'));
});

test('level 12 sends a Rusty stampede at 0:20', () => {
  const round = new Round({ config: levelConfig(12, 'medium'), rng: seeded(21) });
  while (round.time > 20.1) round.update(DT);
  const rusties = () => round.nextId;
  const before = rusties();
  const original = round.spawn.bind(round);
  let wave = 0;
  round.spawn = (type, row) => {
    if (type === 'A5') wave += 1;
    return original(type, row);
  };
  run(round, 3);
  assert.ok(wave >= TIMING.bossCount, `wave ${wave}`);
  assert.ok(rusties() > before);
});

test('difficulty settings shape each level', () => {
  const easy = levelConfig(7, 'easy');
  const medium = levelConfig(7, 'medium');
  const hard = levelConfig(11, 'hard');
  assert.equal(easy.time, medium.time + 15);
  assert.equal(easy.target, Math.round(170 * 0.7));
  assert.equal(levelConfig(7, 'hard').target, Math.round(170 * 1.25));
  assert.ok(!easy.pool.includes('H1'));
  assert.ok(medium.pool.includes('H1'));
  assert.ok(!levelConfig(11, 'medium').pool.includes('H2'));
  assert.ok(hard.pool.includes('H2'));
  assert.equal(levelConfig(4, 'hard').lanes.length, 2);
  assert.equal(levelConfig(5, 'hard').lanes.length, 3);
  assert.equal(levelConfig(5, 'medium').lanes.length, 2);
  assert.ok(Math.abs(levelConfig(1, 'easy', { helper: true }).speed - 0.56) < 1e-9);
});

test('rows alternate direction from level 10', () => {
  const round = emptyRound(10, 'medium');
  assert.equal(round.spawn('A1', 0).dir, 1);
  assert.equal(round.spawn('A1', 1).dir, -1);
  assert.equal(emptyRound(9, 'medium').spawn('A1', 1).dir, 1);
});

test('stars follow the 1, 1.5 and 2 thresholds', () => {
  assert.deepEqual([29, 30, 44, 45, 59, 60].map((score) => starsFor(score, 30)), [0, 1, 1, 2, 2, 3]);
});

test('the round waits for a flying lasso before finishing', () => {
  const round = emptyRound(1, 'medium');
  freezeHerd(round);
  place(round, 'A2', 0, LANES[2][0]);
  round.time = 0.05;
  round.throwLasso(0);
  round.update(0.1);
  assert.equal(round.finished, false);
  run(round, 1);
  assert.equal(round.finished, true);
  assert.equal(round.score, ANIMALS.A2.points);
});

test('slow herds keep a gap at the gate', () => {
  const round = new Round({ config: { ...levelConfig(1, 'easy'), pool: ['A1'] }, rng: seeded(13) });
  for (let t = 0; t < 20; t += DT) {
    round.update(DT);
    const xs = round.animals.map((a) => a.x).sort((a, b) => a - b);
    xs.slice(1).forEach((x, i) => assert.ok(x - xs[i] >= SPAWN.minSpacing - 1));
  }
});

test('an Easy player with 60% accuracy clears every level', () => {
  for (let level = 1; level <= LEVELS.length; level++) {
    const runs = Array.from({ length: 20 }, (_, i) => playRound(level, 'easy', 0.6, (i + 1) * 7919 + level));
    const passed = runs.filter((run) => run.score >= run.target).length;
    assert.ok(passed >= 16, `level ${level}: ${passed}/20`);
  }
});

test('all data is consistent', () => {
  assert.equal(LEVELS.length, 12);
  assert.ok(ROWS.every((row) => row.y < LASSO_ORIGIN_Y));
  for (const level of LEVELS) for (const id of level.introduce ?? []) assert.ok(ANIMALS[id]);
});
