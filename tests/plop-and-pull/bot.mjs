// Simulated players used to check that the game stays easy. `npm run balance:plop` prints the full table.
import { CREATURES, LEVELS, WORLD } from '../../projects/arcade-games/plop-and-pull/src/data.js';
import { TouchRouter } from '../../projects/arcade-games/plop-and-pull/src/input.js';
import { levelConfig, Round, starsFor } from '../../projects/arcade-games/plop-and-pull/src/sim.js';

const DT = 1 / 30;

export function seeded(seed) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
}

const randomPoint = (rng, round) => ({ x: rng() * WORLD.width, y: WORLD.surface + rng() * (round.config.floor - WORLD.surface) });

// Taps all over the sea, as a very small child would.
function tapper(rate) {
  return ({ round, rng, router, id, now }) => {
    if (rng() >= rate * DT) return;
    const p = randomPoint(rng, round);
    const tap = router.down(id(), p.x, p.y, now);
    if (tap) round.touch(tap.boat, tap.x, tap.y);
    router.reset();
  };
}

// Presses for two seconds, lifts briefly, and presses somewhere else. With two boats, one child does this on each side.
function holder() {
  const hands = [];
  return ({ round, rng, router, id, now }) => {
    round.boats.forEach((boat) => {
      const hand = hands[boat.index] ??= { next: boat.index * 350, finger: null };
      if (now < hand.next) return;
      if (hand.finger === null) {
        const p = randomPoint(rng, round);
        if (round.config.players === 2) p.x = boat.min + rng() * (boat.max - boat.min);
        hand.finger = id();
        const tap = router.down(hand.finger, p.x, p.y, now);
        if (tap) round.touch(tap.boat, tap.x, tap.y);
        hand.next = now + 2000;
      } else {
        router.up(hand.finger);
        hand.finger = null;
        hand.next = now + 700;
      }
    });
  };
}

// Picks the catch worth most for the time it takes, holds to pull, and leans toward friends on the way up.
function focused() {
  return ({ round, router, id }) => {
    router.reset();
    round.boats.forEach((boat) => {
      if (boat.state === 'ready') {
        if (round.hum?.state === 'waiting') {
          round.touch(boat.index, round.hum.x, round.hum.y);
          return;
        }
        const options = round.fish.filter((f) => f.state === 'swim' && f.x > 60 && f.x < WORLD.width - 60 && round.onSide(boat, f));
        options.sort((a, b) => score(b) - score(a));
        if (options[0]) round.touch(boat.index, options[0].x, options[0].y);
      } else if (boat.state === 'pull' || boat.state === 'tug') {
        const above = round.fish
          .filter((f) => f.state === 'swim' && f.y < boat.ring.y && round.onSide(boat, f))
          .sort((a, b) => Math.abs(a.x - boat.ring.x) + (boat.ring.y - a.y) * 0.5 - Math.abs(b.x - boat.ring.x) - (boat.ring.y - b.y) * 0.5);
        const x = above[0]?.x ?? boat.x;
        router.fingers.set(id(), { boat: boat.index, x });
      }
    });
  };
}

const score = (fish) => CREATURES[fish.type].pearls / (0.6 + (fish.y - WORLD.surface) / 520);

export const STRATEGIES = { random: () => tapper(1.5), masher: () => tapper(4), holder, focused };

export function playRound(level, players, strategy, seed) {
  const rng = seeded(seed);
  const config = levelConfig(level, players);
  const round = new Round({ config, rng });
  const router = new TouchRouter({ players, bottom: WORLD.height });
  const act = STRATEGIES[strategy]();
  const stats = { casts: 0, creatures: 0, empty: 0, gap: 0, species: {} };
  let fingers = 0;
  let last = 0;
  let now = 0;
  while (!round.finished) {
    now += DT * 1000;
    act({ round, rng, router, now, id: () => ++fingers });
    round.setHolds(router.holds());
    round.update(DT);
    for (const event of round.drainEvents()) {
      if (event.type === 'cast') stats.casts += 1;
      if (event.type === 'leap' || event.type === 'breach') {
        stats.gap = Math.max(stats.gap, round.clock - last);
        last = round.clock;
      }
      if (event.type === 'leap') {
        if (!event.riders.length) stats.empty += 1;
        if (!event.riders[0].find) stats.creatures += 1;
        for (const rider of event.riders) stats.species[rider.type] = (stats.species[rider.type] ?? 0) + 1;
      }
    }
    // The bots never walk away, so the idle pause must not hide a slow pace.
    if (now > 3_600_000) throw new Error(`level ${level} never ended`);
  }
  return { pearls: round.pearls, stars: starsFor(round.pearls, config.stars), lines: config.stars, ...stats, hum: round.hum?.state ?? null };
}

export function summarise(level, players, strategy, games) {
  const runs = Array.from({ length: games }, (_, i) => playRound(level, players, strategy, (i + 1) * 7919 + level * 13 + players));
  const share = (stars) => runs.filter((r) => r.stars >= stars).length / games;
  const mean = (read) => runs.reduce((sum, r) => sum + read(r), 0) / games;
  const species = {};
  for (const run of runs) {
    for (const [type, count] of Object.entries(run.species)) species[type] = (species[type] ?? 0) + count;
  }
  const catches = Object.values(species).reduce((sum, count) => sum + count, 0);
  return {
    two: share(2),
    three: share(3),
    pearls: mean((r) => r.pearls),
    casts: mean((r) => r.casts),
    creatures: mean((r) => r.creatures / Math.max(1, r.casts)),
    empty: mean((r) => r.empty),
    gap: mean((r) => r.gap),
    top: Math.max(...Object.values(species)) / catches,
    breached: runs.filter((r) => r.hum === 'gone' || r.hum === 'breach').length / games,
  };
}

if (process.argv[1].endsWith('bot.mjs')) {
  const games = Number(process.argv[2] ?? 300);
  const pct = (value) => `${Math.round(value * 100)}%`.padStart(5);
  for (const strategy of Object.keys(STRATEGIES)) {
    console.log(`\n${strategy}`);
    for (const players of [1, 2]) {
      for (const { level } of LEVELS) {
        const s = summarise(level, players, strategy, games);
        console.log(`  L${level} ${players}P  pearls ${s.pearls.toFixed(0).padStart(4)}  2★ ${pct(s.two)}  3★ ${pct(s.three)}  casts ${s.casts.toFixed(1).padStart(5)}  creatures ${pct(s.creatures)}  empty ${s.empty}  longest gap ${s.gap.toFixed(1)}s  top species ${pct(s.top)}${level === 3 ? `  breach ${pct(s.breached)}` : ''}`);
      }
    }
  }
}
