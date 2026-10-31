// A simulated player used to check level targets. `accuracy` is how often a throw is well judged.
import { ANIMALS, LASSO_ORIGIN_Y, ROWS } from '../../projects/arcade-games/lasso-ranch/src/data.js';
import { levelConfig, Round } from '../../projects/arcade-games/lasso-ranch/src/sim.js';

const DT = 1 / 60;

export function seeded(seed) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
}

function bestLane(round) {
  const { config } = round;
  const ropeSpeed = (LASSO_ORIGIN_Y - ROWS[ROWS.length - 1].y) / config.travel;
  let best = null;
  for (const animal of round.animals) {
    const def = ANIMALS[animal.type];
    if (animal.state === 'caught' || def.hazard) continue;
    const row = ROWS[animal.row];
    const arrival = (LASSO_ORIGIN_Y - row.y) / ropeSpeed;
    const speed = animal.state === 'graze' ? 0 : def.speed * row.speed * config.speed;
    const x = animal.x + speed * animal.dir * arrival;
    config.lanes.forEach((lane, index) => {
      const window = def.hw * row.scale * config.catchWindow * 0.7;
      if (Math.abs(x - lane) <= window && (!best || def.points > best.points)) best = { index, points: def.points };
    });
  }
  return best;
}

export function playRound(level, mode, accuracy, seed, options = {}) {
  const rng = seeded(seed);
  const config = levelConfig(level, mode, options);
  const round = new Round({ config, rng, bonus: options.bonus ?? false, bounds: [-200, 1400] });
  let think = 0;
  let throws = 0;
  let wasReady = true;
  while (!round.finished) {
    round.update(DT);
    round.drainEvents();
    // Time to react starts when the rope is back in hand. Tuned to about 45 throws a minute.
    if (round.ready && !wasReady) think = 0.1 + rng() * 0.4;
    wasReady = round.ready;
    think -= DT;
    if (!round.ready || think > 0) continue;
    const target = rng() < accuracy ? bestLane(round) : null;
    if (target) round.throwLasso(target.index);
    else if (rng() < 1 - accuracy) round.throwLasso(Math.floor(rng() * config.lanes.length));
    else continue;
    throws += 1;
    wasReady = false;
  }
  return { score: round.score, target: config.target, throws, time: config.time };
}

if (process.argv[1].endsWith('bot.mjs')) {
  const skills = { easy: 0.6, medium: 0.7, hard: 0.8 };
  const games = 60;
  for (const [mode, accuracy] of Object.entries(skills)) {
    console.log(`\n${mode} at ${accuracy * 100}% accuracy`);
    for (let level = 1; level <= 12; level++) {
      const runs = Array.from({ length: games }, (_, i) => playRound(level, mode, accuracy, (i + 1) * 7919 + level));
      const passed = runs.filter((r) => r.score >= r.target).length;
      const avg = runs.reduce((sum, r) => sum + r.score, 0) / games;
      const rate = runs.reduce((sum, r) => sum + (r.throws * 60) / r.time, 0) / games;
      console.log(`L${String(level).padStart(2)} target ${String(runs[0].target).padStart(3)}  avg ${avg.toFixed(0).padStart(4)}  ratio ${(avg / runs[0].target).toFixed(2)}  pass ${Math.round((passed / games) * 100)}%  throws/min ${rate.toFixed(0)}`);
    }
  }
}
