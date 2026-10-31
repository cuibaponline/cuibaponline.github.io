// Game rules with no DOM or canvas, so everything here runs in tests. The render layer only reads
// `animals`, `lasso` and the events drained each frame.
import {
  ANIMALS, BEHAVIOUR, COMBO, DIFFICULTY, HAZARD_PENALTY, HELPER_HORSE, LANES, LANE_WIDTH,
  LASSO_ORIGIN_Y, LEVELS, ROWS, SPAWN, STARS, TIMING,
} from './data.js';

export function levelConfig(level, difficulty, { helper = false } = {}) {
  const def = LEVELS[level - 1];
  const diff = DIFFICULTY[difficulty];
  const introduced = LEVELS.slice(0, level).flatMap((l) => l.introduce ?? []);
  const threeLanes = diff.threeLanesFrom !== null && level >= diff.threeLanesFrom;
  return {
    level,
    difficulty,
    time: def.time + diff.timeBonus,
    target: Math.round(def.target * diff.target),
    rows: def.rows,
    alternate: Boolean(def.alternate),
    bossAtRemaining: def.bossAtRemaining ?? null,
    pool: introduced.filter((id) => !ANIMALS[id].hazard || diff.hazards.includes(id)),
    lanes: LANES[threeLanes ? 3 : diff.lanes],
    catchWindow: diff.catchWindow,
    assist: diff.assist * LANE_WIDTH,
    travel: diff.travel,
    cooldownMiss: diff.cooldownMiss,
    speed: diff.speed * (helper ? HELPER_HORSE.speed : 1),
    combo: diff.combo,
    oneTap: diff.oneTap,
    helper,
  };
}

export function comboMultiplier(streak, enabled = true) {
  if (!enabled) return 1;
  return COMBO.find((step) => streak >= step.streak)?.multiplier ?? 1;
}

export function starsFor(total, target) {
  return STARS.filter((factor) => total >= target * factor).length;
}

export function pickWeighted(ids, rng) {
  const total = ids.reduce((sum, id) => sum + ANIMALS[id].weight, 0);
  let roll = rng() * total;
  for (const id of ids) {
    roll -= ANIMALS[id].weight;
    if (roll < 0) return id;
  }
  return ids[ids.length - 1];
}

const between = (rng, min, max) => min + rng() * (max - min);

export class Round {
  constructor({ config, bonus = false, attract = false, rng = Math.random, bounds = [-140, 1340] }) {
    this.config = config;
    this.bonus = bonus;
    this.attract = attract;
    this.rng = rng;
    this.bounds = bounds;
    this.time = bonus ? TIMING.bonusTime : config.time;
    this.duration = this.time;
    this.clock = 0;
    this.score = 0;
    this.streak = 0;
    this.missStreak = 0;
    this.finished = false;
    this.animals = [];
    this.events = [];
    this.stink = 0;
    this.selectedLane = 0;
    this.pool = bonus ? config.pool.filter((id) => !ANIMALS[id].hazard) : config.pool;
    this.rowIndexes = ROWS.map((_, i) => i).slice(0, bonus ? Math.max(config.rows, 2) : config.rows);
    this.rowTimers = this.rowIndexes.map((_, i) => 0.15 * i);
    this.lastHighValueAt = -Infinity;
    this.nextId = 1;
    this.lasso = { state: 'idle', lane: 0, x: config.lanes[0], y: LASSO_ORIGIN_Y, t: 0, caught: [], jam: false };

    this.goldenAt = null;
    if (!bonus && !attract && this.pool.includes('S1') && rng() < 0.8) {
      this.goldenAt = between(rng, 0.5, 0.85) * this.duration;
    }
    this.pool = this.pool.filter((id) => id !== 'S1');
    this.bossQueue = [];
    this.bossDone = bonus || config.bossAtRemaining === null;

    for (let t = 0; t < SPAWN.prewarm; t += 0.1) this.stepHerd(0.1);
    this.clock = 0;
    this.lastHighValueAt = -Infinity;
    this.events.length = 0;
  }

  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  get ready() {
    return this.lasso.state === 'idle';
  }

  get multiplier() {
    return comboMultiplier(this.streak, this.config.combo);
  }

  selectLane(index) {
    if (index >= 0 && index < this.config.lanes.length) this.selectedLane = index;
  }

  throwLasso(laneIndex = this.selectedLane) {
    const canThrow = this.ready && (this.attract || this.time > 0) && !this.finished;
    if (!canThrow) {
      this.events.push({ type: 'blocked' });
      return false;
    }
    this.selectLane(laneIndex);
    const lasso = this.lasso;
    lasso.state = 'throwing';
    lasso.lane = this.selectedLane;
    lasso.x = this.config.lanes[lasso.lane];
    lasso.y = LASSO_ORIGIN_Y;
    lasso.caught = [];
    lasso.jam = false;
    this.events.push({ type: 'throw', lane: lasso.lane, mega: this.bonus });
    return true;
  }

  update(dt) {
    if (this.finished) return;
    this.clock += dt;
    const before = this.time;
    if (!this.attract) this.time = Math.max(0, this.time - dt);
    if (before > 10 && this.time <= 10 && !this.bonus) this.events.push({ type: 'hurry' });
    this.stink = Math.max(0, this.stink - dt);
    this.stepHerd(dt);
    this.stepLasso(dt);
    const busy = this.lasso.state === 'throwing' || this.lasso.state === 'dragging';
    if (!this.attract && this.time <= 0 && !busy) this.finished = true;
  }

  stepHerd(dt) {
    this.spawnWave();
    this.rowIndexes.forEach((row, i) => {
      this.rowTimers[i] -= dt;
      if (this.rowTimers[i] > 0 || this.entryBlocked(row)) return;
      this.rowTimers[i] = between(this.rng, SPAWN.minGap, SPAWN.maxGap) / (this.bonus ? SPAWN.bonusRate : 1);
      if (this.activeCount() < SPAWN.maxOnScreen) this.spawn(this.pickType(), row);
    });
    for (const animal of this.animals) this.moveAnimal(animal, dt);
    const [left, right] = this.bounds;
    this.animals = this.animals.filter((a) => a.state === 'caught' || (a.x >= left - 10 && a.x <= right + 10));
  }

  spawnWave() {
    const elapsed = this.duration - this.time;
    if (this.goldenAt !== null && elapsed >= this.goldenAt) {
      this.goldenAt = null;
      this.spawn('S1', this.rowIndexes[this.rowIndexes.length - 1]);
      this.events.push({ type: 'golden' });
    }
    if (!this.bossDone && this.time <= this.config.bossAtRemaining) {
      this.bossDone = true;
      for (let i = 0; i < TIMING.bossCount; i++) this.bossQueue.push(this.clock + i * TIMING.bossGap);
      this.events.push({ type: 'boss' });
    }
    while (this.bossQueue.length && this.clock >= this.bossQueue[0]) {
      const i = this.bossQueue.length;
      this.bossQueue.shift();
      this.spawn('A5', this.rowIndexes[i % this.rowIndexes.length]);
    }
  }

  // Slow herds would otherwise pile up at the gate and hide each other's numbers. The stampede is meant to pile up.
  entryBlocked(row) {
    if (this.bonus) return false;
    const [left, right] = this.bounds;
    const dir = this.config.alternate && row % 2 === 1 ? -1 : 1;
    const gate = dir > 0 ? left : right;
    const clear = SPAWN.minSpacing * ROWS[row].scale;
    return this.animals.some((a) => a.row === row && a.state !== 'caught' && Math.abs(a.x - gate) < clear);
  }

  activeCount() {
    return this.animals.filter((a) => a.state !== 'caught').length;
  }

  // Hazards never follow a high-value animal closely, so nobody gets an unavoidable penalty.
  pickType() {
    const type = pickWeighted(this.pool, this.rng);
    const tooClose = this.clock - this.lastHighValueAt < SPAWN.hazardBehindHighValue;
    if (ANIMALS[type].hazard && tooClose) return pickWeighted(this.pool.filter((id) => !ANIMALS[id].hazard), this.rng);
    return type;
  }

  spawn(type, row) {
    const def = ANIMALS[type];
    const dir = this.config.alternate && row % 2 === 1 ? -1 : 1;
    const [left, right] = this.bounds;
    const animal = {
      id: this.nextId++, type, row, dir,
      x: dir > 0 ? left : right,
      y: ROWS[row].y,
      hop: 0,
      state: 'run',
      phase: this.rng(),
      burst: 0,
      timer: this.behaviourTimer(def.behaviour, 'walk'),
      dragFromX: 0,
      dragFromY: 0,
    };
    if (def.points >= SPAWN.highValue) this.lastHighValueAt = this.clock;
    this.animals.push(animal);
    return animal;
  }

  behaviourTimer(behaviour, step) {
    if (behaviour === 'graze') {
      const b = BEHAVIOUR.graze;
      return step === 'walk' ? between(this.rng, b.walkMin, b.walkMax) : between(this.rng, b.stopMin, b.stopMax);
    }
    if (behaviour === 'charge') {
      const b = BEHAVIOUR.charge;
      return step === 'walk' ? between(this.rng, b.calmMin, b.calmMax) : b.burst;
    }
    return 0;
  }

  moveAnimal(animal, dt) {
    if (animal.state === 'caught') return;
    const def = ANIMALS[animal.type];
    let speed = def.speed * ROWS[animal.row].speed * this.config.speed;

    if (def.behaviour === 'graze') {
      animal.timer -= dt;
      if (animal.timer <= 0) {
        const stopping = animal.state === 'run';
        animal.state = stopping ? 'graze' : 'run';
        animal.timer = this.behaviourTimer('graze', stopping ? 'stop' : 'walk');
      }
      if (animal.state === 'graze') speed = 0;
    } else if (def.behaviour === 'hop') {
      animal.phase += dt / BEHAVIOUR.hop.period;
      animal.hop = Math.abs(Math.sin(animal.phase * Math.PI)) * BEHAVIOUR.hop.height * ROWS[animal.row].scale;
    } else if (def.behaviour === 'charge') {
      animal.timer -= dt;
      if (animal.timer <= 0) {
        animal.burst = animal.burst ? 0 : 1;
        animal.timer = this.behaviourTimer('charge', animal.burst ? 'burst' : 'walk');
      }
      if (animal.burst) speed *= BEHAVIOUR.charge.burstSpeed;
    }
    animal.x += speed * animal.dir * dt;
  }

  stepLasso(dt) {
    const lasso = this.lasso;
    lasso.t += dt;
    if (lasso.state === 'throwing') this.stepThrow(dt);
    else if (lasso.state === 'dragging') this.stepDrag();
    else if (lasso.state === 'retracting') {
      lasso.y = lasso.fromY + (LASSO_ORIGIN_Y - lasso.fromY) * Math.min(1, lasso.t / TIMING.retract);
      if (lasso.t >= TIMING.retract) this.enter('cooldown', this.config.cooldownMiss);
    } else if (lasso.state === 'cooldown') {
      if (lasso.t >= lasso.wait) this.enter('idle');
    }
  }

  enter(state, wait = 0) {
    const lasso = this.lasso;
    lasso.state = state;
    lasso.t = 0;
    lasso.wait = wait;
    if (state === 'idle' || state === 'cooldown') {
      lasso.y = LASSO_ORIGIN_Y;
      lasso.x = this.config.lanes[lasso.lane];
    }
  }

  stepThrow(dt) {
    const lasso = this.lasso;
    const speed = (LASSO_ORIGIN_Y - ROWS[ROWS.length - 1].y) / this.config.travel;
    const previous = lasso.y;
    lasso.y -= speed * dt;
    const laneX = this.config.lanes[lasso.lane];
    const limit = this.bonus ? TIMING.megaLassoCatches : 1;

    for (const row of this.rowIndexes) {
      const rowY = ROWS[row].y;
      if (previous <= rowY || lasso.y > rowY) continue;
      const hits = this.findHits(row, laneX, rowY).slice(0, limit - lasso.caught.length);
      for (const hit of hits) this.catchAnimal(hit);
      if (lasso.caught.length >= limit) {
        lasso.y = rowY;
        this.beginDrag();
        return;
      }
    }

    const lastRowY = ROWS[this.rowIndexes[this.rowIndexes.length - 1]].y;
    if (lasso.y <= lastRowY) {
      lasso.y = lastRowY;
      if (lasso.caught.length) this.beginDrag();
      else this.miss();
    }
  }

  findHits(row, laneX, rowY) {
    const scale = ROWS[row].scale;
    return this.animals
      .filter((a) => a.row === row && a.state !== 'caught')
      .filter((a) => {
        const def = ANIMALS[a.type];
        const reachX = def.hw * scale * this.config.catchWindow + this.config.assist;
        const reachY = def.hh * scale * this.config.catchWindow;
        return Math.abs(a.x - laneX) <= reachX && a.hop <= reachY;
      })
      .sort((a, b) => Math.abs(a.x - laneX) - Math.abs(b.x - laneX));
  }

  catchAnimal(animal) {
    const def = ANIMALS[animal.type];
    animal.state = 'caught';
    animal.dragFromX = animal.x;
    animal.dragFromY = animal.y - animal.hop;
    animal.hop = 0;
    this.lasso.caught.push(animal);
    this.missStreak = 0;

    if (def.hazard) {
      this.streak = 0;
      const lost = def.hazard === 'stink' ? Math.min(this.score, HAZARD_PENALTY) : 0;
      this.score -= lost;
      if (def.hazard === 'stink') this.stink = TIMING.skunkStink;
      else this.lasso.jam = true;
      this.events.push({ type: 'hazard', hazard: def.hazard, animal, points: -lost, x: animal.x, y: animal.y });
      return;
    }

    this.streak += 1;
    const multiplier = this.multiplier;
    const points = Math.round(def.points * multiplier);
    this.score += points;
    this.events.push({ type: 'catch', animal, points, multiplier, streak: this.streak, x: animal.x, y: animal.y });
  }

  beginDrag() {
    const lasso = this.lasso;
    lasso.fromY = lasso.y;
    lasso.state = 'dragging';
    lasso.t = 0;
  }

  stepDrag() {
    const lasso = this.lasso;
    const progress = Math.min(1, lasso.t / TIMING.cooldownCatch);
    const eased = progress * progress;
    const laneX = this.config.lanes[lasso.lane];
    lasso.y = lasso.fromY + (LASSO_ORIGIN_Y - lasso.fromY) * eased;
    if (lasso.caught.length) {
      const lead = lasso.caught[0];
      lasso.x = lead.dragFromX + (laneX - lead.dragFromX) * eased;
    }
    for (const animal of lasso.caught) {
      animal.x = animal.dragFromX + (laneX - animal.dragFromX) * eased;
      animal.y = animal.dragFromY + (LASSO_ORIGIN_Y - 30 - animal.dragFromY) * eased;
    }
    if (progress < 1) return;
    this.animals = this.animals.filter((a) => !lasso.caught.includes(a));
    lasso.caught = [];
    if (lasso.jam) {
      this.events.push({ type: 'jam' });
      this.enter('cooldown', TIMING.jam);
    } else {
      this.enter('idle');
    }
  }

  miss() {
    const lasso = this.lasso;
    this.streak = 0;
    this.missStreak += 1;
    lasso.fromY = lasso.y;
    lasso.state = 'retracting';
    lasso.t = 0;
    this.events.push({ type: 'miss', missStreak: this.missStreak, x: lasso.x, y: lasso.y });
  }
}
