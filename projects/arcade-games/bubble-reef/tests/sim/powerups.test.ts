import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { emptySim, fire, makeSim, placeFish, run, runSec, stopFire } from './helpers';
import { catchFish, damageFish } from '../../src/sim/damage';
import { straightPath } from '../../src/sim/paths';
import { laserFill } from '../../src/sim/cannon';

const send = (sim: ReturnType<typeof emptySim>, type: 'ToggleLock' | 'ToggleAuto' | 'Laser') =>
  sim.enqueue({ tick: sim.tick, seatId: 0, type });

describe('US-06 lock-on', () => {
  it('locks a tapped fish, tracks it, and bubbles home onto it', () => {
    const sim = emptySim('medium', { startLevel: 1 });
    const seat = sim.localSeat;
    const target = placeFish(sim, 'F12', seat.x + 700, seat.y - 500);
    send(sim, 'ToggleLock');
    sim.enqueue({ tick: sim.tick, seatId: 0, type: 'LockTarget', x: target.x, y: target.y });
    sim.step();
    expect(seat.lockUid).toBe(target.uid);
    runSec(sim, 0.3);
    expect(seat.angle).toBeCloseTo(Math.atan2(target.x - seat.x, seat.y - target.y), 2);

    sim.enqueue({ tick: sim.tick, seatId: 0, type: 'Aim', x: 0, y: 0 });
    sim.enqueue({ tick: sim.tick, seatId: 0, type: 'FireStart' });
    sim.step();
    stopFire(sim);
    runSec(sim, 1.2);
    expect(target.hp).toBeLessThan(target.maxHp);
  });

  it('locked bubbles pass other fish to reach the target', () => {
    const sim = emptySim('medium', { startLevel: 1 });
    const seat = sim.localSeat;
    const target = placeFish(sim, 'F12', seat.x, seat.y - 800);
    const blocker = placeFish(sim, 'F12', seat.x, seat.y - 350);
    send(sim, 'ToggleLock');
    sim.enqueue({ tick: sim.tick, seatId: 0, type: 'LockTarget', x: target.x, y: target.y });
    sim.step();
    fire(sim, 0, 0);
    sim.step();
    stopFire(sim);
    runSec(sim, 1.2);
    expect(target.hp).toBeLessThan(target.maxHp);
    expect(blocker.hp).toBe(blocker.maxHp);
  });

  it('clears when the fish is caught or leaves; Lock again turns it off', () => {
    const sim = emptySim('medium');
    const seat = sim.localSeat;
    const a = placeFish(sim, 'F01', 900, 500);
    send(sim, 'ToggleLock');
    sim.enqueue({ tick: sim.tick, seatId: 0, type: 'LockTarget', x: a.x, y: a.y });
    sim.step();
    catchFish(sim.s, a);
    sim.step();
    expect(seat.lockUid).toBe(0);

    const b = placeFish(sim, 'F01', 900, 500);
    sim.enqueue({ tick: sim.tick, seatId: 0, type: 'LockTarget', x: b.x, y: b.y });
    sim.step();
    expect(seat.lockUid).toBe(b.uid);
    b.path = straightPath(-500, 500, -499, 500);
    sim.step();
    expect(seat.lockUid).toBe(0);

    send(sim, 'ToggleLock');
    sim.step();
    expect(seat.lockMode).toBe(false);
  });

  it('Auto-lock on Easy always targets the highest-value fish and re-targets', () => {
    const sim = emptySim('easy');
    const seat = sim.localSeat;
    placeFish(sim, 'F01', 500, 400);
    const shark = placeFish(sim, 'F12', 900, 400);
    const turtle = placeFish(sim, 'F09', 1300, 400);
    send(sim, 'ToggleLock');
    sim.step();
    expect(seat.lockUid).toBe(shark.uid);
    catchFish(sim.s, shark);
    sim.step();
    expect(seat.lockUid).toBe(turtle.uid);
  });
});

describe('US-08 laser', () => {
  function ready(difficulty: 'easy' | 'medium' = 'medium') {
    const sim = emptySim(difficulty);
    sim.localSeat.laserMeter = laserFill(sim.s);
    return sim;
  }

  it('needs a full meter and the laser unlock', () => {
    const sim = emptySim();
    send(sim, 'Laser');
    sim.step();
    expect(sim.localSeat.laserT).toBe(0);

    const locked = emptySim('medium', { unlocks: { specials: [], bosses: ['B01'], oceans: ['coral'], laser: false, maxCannonLevel: 2 } });
    locked.localSeat.laserMeter = 400;
    send(locked, 'Laser');
    locked.step();
    expect(locked.localSeat.laserT).toBe(0);
  });

  it('fills from points at the difficulty rate and reports ready once', () => {
    const sim = emptySim('medium');
    const seat = sim.localSeat;
    seat.laserMeter = 395;
    catchFish(sim.s, placeFish(sim, 'F12', 900, 500));
    const events = sim.drainEvents();
    expect(seat.laserMeter).toBe(400);
    expect(events.filter((e) => e.t === 'laserReady')).toHaveLength(1);
  });

  it('runs 3 s, pierces, and deals 8 damage per second to everything in the beam', () => {
    const sim = ready();
    const seat = sim.localSeat;
    const near = placeFish(sim, 'F12', seat.x, seat.y - 400);
    const far = placeFish(sim, 'F12', seat.x, seat.y - 900);
    const aside = placeFish(sim, 'F12', seat.x + 800, seat.y - 400);
    send(sim, 'Laser');
    runSec(sim, 1);
    expect(near.hp).toBeCloseTo(near.maxHp - 8, 0);
    expect(far.hp).toBeCloseTo(far.maxHp - 8, 0);
    expect(aside.hp).toBe(aside.maxHp);
    runSec(sim, 2.1);
    expect(sim.localSeat.laserT).toBeLessThanOrEqual(0);
    expect(near.hp).toBeCloseTo(near.maxHp - 24, 0);
  });

  it('holds fire while the beam is on', () => {
    const sim = ready();
    send(sim, 'Laser');
    fire(sim, 960, 100);
    runSec(sim, 2);
    expect(sim.s.stats.shots).toBe(0);
  });
});

describe('special fish (7.2)', () => {
  function caught(id: string, difficulty: 'easy' | 'medium' | 'hard' = 'medium') {
    const sim = emptySim(difficulty);
    const special = placeFish(sim, id, 960, 500);
    catchFish(sim.s, special);
    return sim;
  }

  it('Burst deals 10 to non-boss fish within 500 u, 700 u on Easy', () => {
    const sim = emptySim();
    const inside = placeFish(sim, 'F12', 960 + 450, 500);
    const outside = placeFish(sim, 'F12', 960 + 620, 500);
    catchFish(sim.s, placeFish(sim, 'S01', 960, 500));
    sim.step();
    expect(inside.hp).toBe(inside.maxHp - 10);
    expect(outside.hp).toBe(outside.maxHp);

    const easy = emptySim('easy');
    const reach = placeFish(easy, 'F12', 960 + 620, 500);
    catchFish(easy.s, placeFish(easy, 'S01', 960, 500));
    easy.step();
    expect(reach.hp).toBe(reach.maxHp - 10);
  });

  it('Freeze stops every fish, for 5 s on Medium, then they move on', () => {
    const sim = makeSim('medium');
    catchFish(sim.s, placeFish(sim, 'S02', 960, 500));
    sim.step();
    const before = sim.s.fish.filter((f) => f.state === 'swim').map((f) => [f.uid, f.x]);
    runSec(sim, 4.8);
    for (const [uid, x] of before) expect(sim.s.fish.find((f) => f.uid === uid)?.x).toBe(x);
    runSec(sim, 0.5);
    expect(sim.s.freezeT).toBeLessThanOrEqual(0);
    runSec(sim, 1);
    const moved = before.some(([uid, x]) => sim.s.fish.find((f) => f.uid === uid)?.x !== x);
    expect(moved).toBe(true);
  });

  it('Spark jumps to the 6 nearest fish for 5 damage each', () => {
    const sim = emptySim();
    const near = Array.from({ length: 7 }, (_, i) => placeFish(sim, 'F12', 960 + (i + 1) * 100, 500));
    catchFish(sim.s, placeFish(sim, 'S03', 960, 500));
    sim.step();
    const hit = near.filter((f) => f.hp < f.maxHp);
    expect(hit).toHaveLength(6);
    expect(hit.every((f) => f.hp === f.maxHp - 5)).toBe(true);
    expect(near[6]!.hp).toBe(near[6]!.maxHp);
  });

  it('Rainbow catches every fish of the most common species, never bosses', () => {
    const sim = emptySim();
    const tangs = [1, 2, 3].map((i) => placeFish(sim, 'F02', 300 + i * 100, 300));
    const shark = placeFish(sim, 'F12', 900, 800);
    catchFish(sim.s, placeFish(sim, 'S04', 960, 500));
    sim.step();
    expect(tangs.every((f) => f.state === 'caught')).toBe(true);
    expect(shark.state).toBe('swim');
  });

  it('Treasure Crab runs a 6 s Bubble Pop: 5 coins a bubble, fish paused, no random prize', () => {
    const sim = caught('S05');
    sim.step();
    expect(sim.s.bubblePop).not.toBeNull();
    const coins = sim.s.stats.coins;
    runSec(sim, 2);
    const b = sim.s.bubblePop!.bubbles[0]!;
    sim.enqueue({ tick: sim.tick, seatId: 0, type: 'PopBubble', x: b.x, y: b.y });
    sim.step();
    expect(sim.s.stats.coins).toBe(coins + CONFIG.powerups.bubblePop.coinsEach);
    const waveT = sim.s.phaseT;
    runSec(sim, 4.1);
    expect(sim.s.bubblePop).toBeNull();
    expect(sim.s.phaseT).toBeLessThan(waveT + 0.2);
  });

  it('Laser Shrimp fills the meter', () => {
    const sim = caught('S06');
    sim.step();
    expect(sim.localSeat.laserMeter).toBe(laserFill(sim.s));
  });
});

describe('bosses (7.1)', () => {
  function withBoss(id: 'B01' | 'B02', difficulty: 'easy' | 'hard' = 'hard') {
    const sim = makeSim(difficulty, { unlocks: { specials: [], bosses: [id], oceans: ['coral'], laser: true, maxCannonLevel: 5 } });
    sim.s.wave = 2;
    sim.nextWave();
    sim.s.phaseT = sim.s.cfg.waveSec - 0.05;
    run(sim, 10);
    sim.s.phaseT = CONFIG.powerups.parade.durationSec;
    run(sim, 150);
    return { sim, boss: sim.s.boss! };
  }

  it('Whale releases a ring of 8 fish once, on crossing 50 %', () => {
    const { sim, boss } = withBoss('B01');
    expect(boss.def.id).toBe('B01');
    boss.hp = boss.maxHp * 0.52;
    sim.drainEvents();
    const before = sim.s.fish.length;
    damageFish(sim.s, boss, boss.maxHp * 0.01, 0);
    expect(sim.s.fish.length).toBe(before);
    damageFish(sim.s, boss, boss.maxHp * 0.02, 0);
    expect(sim.s.fish.length).toBe(before + CONFIG.powerups.boss.whaleRingCount);
    damageFish(sim.s, boss, boss.maxHp * 0.02, 0);
    expect(sim.s.fish.length).toBe(before + CONFIG.powerups.boss.whaleRingCount);
    expect(sim.drainEvents().filter((e) => e.t === 'bossPhase' && e.kind === 'ring')).toHaveLength(1);
  });

  it('catching a boss ends the phase with a win and awards its points', () => {
    const { sim, boss } = withBoss('B01');
    catchFish(sim.s, boss);
    sim.step();
    expect(sim.s.phase).toBe('bossOutro');
    expect(sim.s.boss).toBeNull();
    expect(sim.s.stats.bossesCaught).toBe(1);
    expect(sim.drainEvents().find((e) => e.t === 'caught' && e.id === 'B01')).toMatchObject({ points: 300 });
    runSec(sim, 2.6);
    expect(sim.s.phase).toBe('waveComplete');
  });

  it('Dragon dives untouchable at 66 % and 33 %, then surfaces elsewhere', () => {
    const { sim, boss } = withBoss('B02');
    expect(boss.def.chain).toBeDefined();
    expect(boss.chainX.length).toBe(boss.def.chain!.segments);
    boss.hp = boss.maxHp * 0.67;
    placeFish(sim, 'F12', -1000, -1000);
    sim.localSeat.laserMeter = laserFill(sim.s);
    const seat = sim.localSeat;
    sim.enqueue({ tick: sim.tick, seatId: 0, type: 'Aim', x: boss.x, y: boss.y });
    sim.enqueue({ tick: sim.tick, seatId: 0, type: 'Laser' });
    let dived = false;
    for (let i = 0; i < 180 && !dived; i++) {
      sim.enqueue({ tick: sim.tick, seatId: 0, type: 'Aim', x: boss.x, y: boss.y });
      sim.step();
      dived = boss.state === 'dive';
    }
    expect(dived).toBe(true);
    const hp = boss.hp;
    const x = boss.x;
    runSec(sim, 1.5);
    expect(boss.state).toBe('dive');
    expect(boss.hp).toBe(hp);
    runSec(sim, 0.6);
    expect(boss.state).toBe('swim');
    expect(boss.x).not.toBe(x);
    expect(seat.laserT).toBeGreaterThanOrEqual(0);
  });

  it('escorts orbit the boss and scatter when it goes', () => {
    const { sim, boss } = withBoss('B01');
    const escorts = sim.s.fish.filter((f) => f.escortOf === boss.uid);
    expect(escorts).toHaveLength(CONFIG.powerups.boss.escorts.count);
    catchFish(sim.s, boss);
    runSec(sim, 1);
    expect(sim.s.fish.filter((f) => f.escortOf !== 0)).toHaveLength(0);
  });
});

describe('US-11 Easy assistance', () => {
  it('uses the configured Easy values', () => {
    const c = CONFIG.difficulty.easy;
    expect([c.hitboxScale, c.aimAssistDeg, c.fishSpeedMul, c.showLevelButtons]).toEqual([1.3, 20, 0.75, false]);
  });

  it('after 8 s without a catch shots deal +50 % until the next catch', () => {
    const sim = emptySim('easy');
    sim.enqueue({ tick: 0, seatId: 0, type: 'Aim', x: 960, y: 100 });
    runSec(sim, 7.9);
    expect(sim.hud().help).toBe(false);
    runSec(sim, 0.2);
    expect(sim.hud().help).toBe(true);
    fire(sim, 960, 100);
    sim.step();
    stopFire(sim);
    expect(sim.s.bubbles[0]!.damage).toBeCloseTo(CONFIG.cannon.levels[4]!.damage * 1.5, 5);

    catchFish(sim.s, placeFish(sim, 'F01', 900, 500));
    sim.step();
    expect(sim.hud().help).toBe(false);
  });

  it('never has adaptive help on Medium or Hard', () => {
    const sim = emptySim('medium');
    runSec(sim, 20);
    expect(sim.hud().help).toBe(false);
  });
});
