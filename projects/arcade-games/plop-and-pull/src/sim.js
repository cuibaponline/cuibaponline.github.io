// Game rules with no DOM or canvas, so everything here runs in tests. The render layer only reads
// the round's state and the events drained each frame.
import {
  BIG_TUG, BOATS, BUBBLES, CAST, CREATURES, DAY, FIND_ORDER, FINDS, HOP, LEVELS, PULL, RIDER_SLOTS, SPAWN, WORLD,
} from './data.js';

const between = (rng, min, max) => min + rng() * (max - min);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const toward = (value, target, step) => (Math.abs(target - value) <= step ? target : value + Math.sign(target - value) * step);

const RING_REST = WORLD.surface - 34;
const RING_TOP = WORLD.surface + 60;

export function levelConfig(level, players = 1) {
  const def = LEVELS[level - 1];
  return {
    level,
    players,
    time: def.time,
    floor: def.floor,
    fish: def.fish[players],
    weights: def.weights,
    hopOns: def.hopOns,
    bubbles: def.bubbles,
    bigTug: def.bigTug,
    stars: def.stars[players],
  };
}

// Finishing is the first star, so there is no way to fail a level.
export function starsFor(pearls, lines) {
  return 1 + lines.filter((line) => pearls >= line).length;
}

export function pickWeighted(weights, rng) {
  const entries = Object.entries(weights);
  let roll = rng() * entries.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [id, weight] of entries) {
    roll -= weight;
    if (roll < 0) return id;
  }
  return entries[entries.length - 1][0];
}

export class Round {
  constructor({ config, rng = Math.random, attract = false, tutorial = false }) {
    this.config = config;
    this.rng = rng;
    this.attract = attract;
    this.tutorial = tutorial;
    this.duration = config.time;
    this.day = 0;
    this.clock = 0;
    this.idle = 0;
    this.pearls = 0;
    this.doubleLeft = 0;
    this.finished = false;
    this.glowed = false;
    this.events = [];
    this.fish = [];
    this.bubbles = [];
    this.refills = [];
    this.bubbleTimes = [...config.bubbles];
    this.bubbleTurn = 0;
    this.findTurn = 0;
    this.nextId = 1;
    this.hum = config.bigTug ? { state: 'hidden', x: BIG_TUG.x, y: BIG_TUG.startY, t: 0 } : null;
    this.boats = attract ? [] : BOATS[config.players].map((boat, index) => ({
      index,
      rider: boat.rider,
      x: boat.x,
      min: boat.min,
      max: boat.max,
      state: 'ready',
      t: 0,
      wait: 0,
      ring: { x: boat.x, y: RING_REST },
      targetX: boat.x,
      targetY: RING_REST,
      fish: null,
      riders: [],
      toHum: false,
      bigRing: false,
      plopped: false,
      held: 0,
      leanX: null,
    }));

    if (tutorial) {
      for (const boat of this.boats) {
        const fish = this.addFish('bobble', boat.x, 470);
        fish.held = true;
      }
    } else {
      for (let i = 0; i < config.fish; i++) {
        const type = pickWeighted(config.weights, rng);
        this.addFish(type, between(rng, 60, WORLD.width - 60), this.bandY(type), rng() < 0.5 ? 1 : -1);
      }
    }
  }

  drainEvents() {
    const events = this.events;
    this.events = [];
    return events;
  }

  get golden() {
    return !this.attract && !this.tutorial && this.duration - this.day <= DAY.glow;
  }

  get multiplier() {
    return this.doubleLeft > 0 || this.golden ? DAY.glowMultiplier : 1;
  }

  get paused() {
    const tugging = this.hum?.state === 'tug' || this.hum?.state === 'breach';
    return this.tutorial || tugging || this.idle >= DAY.idlePause;
  }

  get sunset() {
    return this.day >= this.duration;
  }

  // The fish a ghost hand points at when nobody has touched the screen for a while.
  get hintFish() {
    if (this.attract || this.idle < DAY.hint) return null;
    const boat = this.boats.find((b) => b.state === 'ready');
    if (!boat) return null;
    const near = this.fish.filter((f) => f.state === 'swim' && f.x > 60 && f.x < WORLD.width - 60);
    near.sort((a, b) => Math.hypot(a.x - boat.x, a.y - WORLD.surface) - Math.hypot(b.x - boat.x, b.y - WORLD.surface));
    return near[0] ?? null;
  }

  addFish(type, x, y, dir = 1) {
    const def = CREATURES[type];
    const vary = 1 + between(this.rng, -SPAWN.speedVary, SPAWN.speedVary);
    const fish = {
      id: this.nextId++, type, x, y, baseY: y, dir, speed: def.speed * vary, state: 'swim',
      phase: this.rng() * 10, reservedBy: null, held: false,
    };
    this.fish.push(fish);
    return fish;
  }

  addBubble(kind, x, y) {
    const bubble = { id: this.nextId++, kind, x, y };
    this.bubbles.push(bubble);
    return bubble;
  }

  bandY(type) {
    const def = CREATURES[type];
    const max = Math.min(def.band[1], this.config.floor - def.radius * 0.6);
    let y = between(this.rng, def.band[0], max);
    for (let i = 1; i < SPAWN.tries; i++) {
      const blocked = this.fish.some((f) => Math.abs(f.y - y) < SPAWN.clearY && (f.dir > 0 ? f.x < SPAWN.clearX : f.x > WORLD.width - SPAWN.clearX));
      if (!blocked) break;
      y = between(this.rng, def.band[0], max);
    }
    return y;
  }

  spawn() {
    const type = pickWeighted(this.config.weights, this.rng);
    const dir = this.rng() < 0.5 ? 1 : -1;
    this.addFish(type, dir > 0 ? -WORLD.margin + 10 : WORLD.width + WORLD.margin - 10, this.bandY(type), dir);
  }

  onSide(boat, fish) {
    if (this.config.players === 1) return true;
    return boat.index === 0 ? fish.x < WORLD.halfway : fish.x >= WORLD.halfway;
  }

  nearest(boat, x, y, reach, withRadius) {
    let best = null;
    let bestDistance = Infinity;
    for (const fish of this.fish) {
      if (fish.state !== 'swim' || !this.onSide(boat, fish)) continue;
      const distance = Math.hypot(fish.x - x, fish.y - y);
      const limit = reach + (withRadius ? CREATURES[fish.type].radius : 0);
      if (distance <= limit && distance < bestDistance) {
        best = fish;
        bestDistance = distance;
      }
    }
    return best;
  }

  onHum(x, y) {
    const hum = this.hum;
    if (hum?.state !== 'waiting') return false;
    const nx = (x - hum.x) / (BIG_TUG.halfW + BIG_TUG.grabGap);
    const ny = (y - hum.y) / (BIG_TUG.halfH + BIG_TUG.grabGap);
    return nx * nx + ny * ny <= 1;
  }

  // Every touch does something: it casts, lifts the line, or at the very least makes a ripple.
  touch(index, x, y) {
    if (this.finished || this.attract) return;
    const boat = this.boats[index];
    this.idle = 0;
    this.events.push({ type: 'touch', boat: index, x, y });
    this.burstBubbles(boat, x, y);
    if (this.hum?.state === 'tug') {
      this.hum.y -= BIG_TUG.tap;
      this.events.push({ type: 'reel', boat: index, height: this.heightOf(this.hum.y) });
    } else if (boat.state === 'ready') {
      if (!this.sunset) this.cast(boat, x, y);
    } else if (boat.state === 'pull') {
      boat.ring.y -= PULL.tap / this.loadOf(boat);
      this.events.push({ type: 'reel', boat: index, height: this.heightOf(boat.ring.y) });
    }
  }

  heightOf(y) {
    return clamp(1 - (y - WORLD.surface) / (WORLD.height - WORLD.surface), 0, 1);
  }

  setHolds(holds) {
    holds.forEach((hold, i) => {
      const boat = this.boats[i];
      boat.held = hold.count;
      boat.leanX = hold.leanX;
      if (hold.count) this.idle = 0;
    });
  }

  cast(boat, x, y) {
    if (this.onHum(x, y)) {
      this.castAtHum(boat, x);
      return;
    }
    const fish = this.tutorial ? this.fish.find((f) => f.held && this.onSide(boat, f)) : this.nearest(boat, x, y, CAST.snap, true);
    if (fish) this.reserve(boat, fish, 'waiting');
    this.launch(boat, fish ? fish.x : x, fish ? fish.y : y);
  }

  castAtHum(boat, x) {
    boat.toHum = true;
    this.launch(boat, x, BIG_TUG.y - 40);
  }

  reserve(boat, fish, state) {
    fish.state = state;
    fish.reservedBy = boat.index;
    boat.fish = fish;
  }

  launch(boat, x, y) {
    boat.targetX = clamp(x, boat.min, boat.max);
    boat.targetY = clamp(y, RING_TOP, this.config.floor - CAST.floorGap);
    boat.state = 'drop';
    boat.plopped = false;
    this.events.push({ type: 'cast', boat: boat.index });
  }

  update(dt) {
    if (this.finished) return;
    this.clock += dt;
    this.stepDay(dt);
    this.stepFish(dt);
    this.stepBubbles(dt);
    this.stepHum(dt);
    for (const boat of this.boats) this.stepBoat(boat, dt);
    this.stepRefill();
    const busy = this.boats.some((b) => b.state !== 'ready' && b.state !== 'pop') || this.hum?.state === 'breach';
    if (!this.attract && this.sunset && !busy) this.finished = true;
  }

  stepDay(dt) {
    if (this.attract) return;
    this.idle += dt;
    this.doubleLeft = Math.max(0, this.doubleLeft - dt);
    if (!this.paused) this.day = Math.min(this.duration, this.day + dt);
    if (this.golden && !this.glowed) {
      this.glowed = true;
      this.events.push({ type: 'glow' });
    }
    if (this.sunset && !this.setting) {
      this.setting = true;
      this.events.push({ type: 'sunset' });
    }
  }

  stepFish(dt) {
    for (const fish of this.fish) {
      if (fish.state !== 'swim' || fish.held) continue;
      fish.x += fish.speed * fish.dir * dt;
      const bob = CREATURES[fish.type].bob;
      if (bob) {
        fish.phase += dt * 1.6;
        fish.y = fish.baseY + Math.sin(fish.phase) * bob;
      }
    }
    const left = -WORLD.margin;
    const right = WORLD.width + WORLD.margin;
    this.fish = this.fish.filter((f) => f.state !== 'swim' || (f.x >= left && f.x <= right));
  }

  stepBubbles(dt) {
    while (this.bubbleTimes.length && this.day >= this.bubbleTimes[0]) {
      this.bubbleTimes.shift();
      const kind = BUBBLES.order[this.bubbleTurn++ % BUBBLES.order.length];
      this.addBubble(kind, between(this.rng, 120, WORLD.width - 120), this.config.floor - CAST.floorGap);
    }
    for (const bubble of this.bubbles) bubble.y -= BUBBLES.speed * dt;
    this.bubbles = this.bubbles.filter((bubble) => bubble.y > WORLD.surface);
  }

  burstBubbles(boat, x, y) {
    const reach = BUBBLES.radius + BUBBLES.touchGap;
    this.bubbles = this.bubbles.filter((bubble) => {
      if (Math.hypot(bubble.x - x, bubble.y - y) > reach) return true;
      if (bubble.kind === 'double') this.doubleLeft = BUBBLES.doubleTime;
      else boat.bigRing = true;
      this.events.push({ type: 'bubble', kind: bubble.kind, boat: boat.index, x: bubble.x, y: bubble.y });
      return false;
    });
  }

  stepHum(dt) {
    const hum = this.hum;
    if (!hum) return;
    if (hum.state === 'hidden') {
      if (this.day >= this.duration * BIG_TUG.riseAt) {
        hum.state = 'rising';
        this.events.push({ type: 'humRise' });
      }
    } else if (hum.state === 'rising') {
      hum.y = toward(hum.y, BIG_TUG.y, BIG_TUG.riseSpeed * dt);
      if (hum.y === BIG_TUG.y) hum.state = 'waiting';
    } else if (hum.state === 'waiting') {
      if (this.day >= this.duration * BIG_TUG.takeAt) {
        const boat = this.boats.find((b) => b.state === 'ready');
        if (boat) this.castAtHum(boat, hum.x);
      }
    } else if (hum.state === 'tug') {
      const fingers = this.boats.reduce((sum, boat) => sum + boat.held, 0);
      hum.y -= BIG_TUG.speeds[Math.min(fingers, BIG_TUG.speeds.length - 1)] * dt;
      if (hum.y <= BIG_TUG.breachY) this.breach();
    } else if (hum.state === 'breach') {
      hum.t += dt;
      if (hum.t >= BIG_TUG.breachTime) hum.state = 'gone';
    }
  }

  breach() {
    const hum = this.hum;
    hum.state = 'breach';
    hum.t = 0;
    this.pearls += BIG_TUG.pearls;
    for (const boat of this.boats) {
      if (boat.state === 'tug') this.rest(boat, 'pop', BIG_TUG.breachTime);
    }
    this.events.push({ type: 'breach', pearls: BIG_TUG.pearls, x: hum.x });
  }

  stepBoat(boat, dt) {
    boat.t += dt;
    if (boat.state === 'ready') {
      if (this.hum?.state === 'tug' && !this.sunset) this.castAtHum(boat, this.hum.x);
    } else if (boat.state === 'drop') this.stepDrop(boat, dt);
    else if (boat.state === 'hop') this.stepHop(boat, dt);
    else if (boat.state === 'pull') this.stepPull(boat, dt);
    else if (boat.state === 'tug') {
      boat.ring.y = this.hum.y - 40;
    } else if (boat.state === 'pop' && boat.t >= boat.wait) {
      boat.state = 'ready';
      boat.t = 0;
    }
  }

  stepDrop(boat, dt) {
    boat.x = toward(boat.x, boat.targetX, CAST.boatSpeed * dt);
    boat.ring.x = boat.x;
    boat.ring.y = Math.min(boat.targetY, boat.ring.y + CAST.dropSpeed * dt);
    if (!boat.plopped && boat.ring.y >= WORLD.surface) {
      boat.plopped = true;
      this.events.push({ type: 'plop', boat: boat.index, x: boat.x });
    }
    if (boat.x === boat.targetX && boat.ring.y === boat.targetY) this.arrive(boat);
  }

  arrive(boat) {
    if (boat.toHum) {
      boat.toHum = false;
      if (this.hum.state === 'waiting') {
        this.hum.state = 'tug';
        this.events.push({ type: 'humTug' });
      }
      if (this.hum.state === 'tug') {
        boat.state = 'tug';
        return;
      }
    }
    if (!boat.fish) {
      const lured = this.nearest(boat, boat.ring.x, boat.ring.y, CAST.lure, false);
      if (lured) this.reserve(boat, lured, 'lured');
    }
    if (boat.fish) {
      boat.state = 'hop';
      return;
    }
    const type = FIND_ORDER[this.findTurn++ % FIND_ORDER.length];
    boat.riders = [{ type, find: true, x: boat.ring.x, y: boat.ring.y + RIDER_SLOTS[0][1], dir: 1, phase: 0, state: 'riding' }];
    boat.state = 'pull';
    this.events.push({ type: 'find', boat: boat.index, find: type });
  }

  // The fish swims into the ring itself, which is why nothing about this catch is unkind.
  stepHop(boat, dt) {
    const fish = boat.fish;
    const x = boat.ring.x + RIDER_SLOTS[0][0];
    const y = boat.ring.y + RIDER_SLOTS[0][1];
    const distance = Math.hypot(x - fish.x, y - fish.y);
    const step = CAST.lureSpeed * dt;
    if (distance > CAST.arrive) {
      fish.x += ((x - fish.x) / distance) * Math.min(step, distance);
      fish.y += ((y - fish.y) / distance) * Math.min(step, distance);
      return;
    }
    fish.state = 'riding';
    boat.riders = [fish];
    boat.state = 'pull';
    this.events.push({ type: 'hop', boat: boat.index, fish });
  }

  loadOf(boat) {
    return Math.max(...boat.riders.map((rider) => (rider.find ? FINDS[rider.type] : CREATURES[rider.type]).weight));
  }

  stepPull(boat, dt) {
    const load = this.loadOf(boat);
    boat.ring.y -= (boat.held ? PULL.hold : PULL.idle) / load * dt;
    if (boat.held && boat.leanX !== null) {
      boat.ring.x = clamp(toward(boat.ring.x, boat.leanX, PULL.lean * dt), boat.min, boat.max);
      boat.x = boat.ring.x;
    }
    this.burstBubbles(boat, boat.ring.x, boat.ring.y);
    this.collect(boat);
    boat.riders.forEach((rider, i) => {
      rider.x = boat.ring.x + RIDER_SLOTS[i][0];
      rider.y = boat.ring.y + RIDER_SLOTS[i][1];
    });
    if (boat.ring.y <= WORLD.surface) this.land(boat);
  }

  collect(boat) {
    if (!this.config.hopOns || boat.riders[0].find) return;
    const limit = 1 + (boat.bigRing ? HOP.bigExtras : HOP.extras);
    for (const fish of this.fish) {
      if (boat.riders.length >= limit) return;
      if (fish.state !== 'swim' || !this.onSide(boat, fish)) continue;
      const reach = (HOP.reach + HOP.radiusShare * CREATURES[fish.type].radius) * (boat.bigRing ? HOP.bigReach : 1);
      if (Math.hypot(fish.x - boat.ring.x, fish.y - boat.ring.y) > reach) continue;
      fish.state = 'riding';
      fish.reservedBy = boat.index;
      boat.riders.push(fish);
      this.events.push({ type: 'hopOn', boat: boat.index, fish, count: boat.riders.length });
    }
  }

  land(boat) {
    const riders = boat.riders;
    const base = riders.reduce((sum, rider) => sum + (rider.find ? FINDS[rider.type] : CREATURES[rider.type]).pearls, 0);
    const multiplier = this.multiplier;
    const pearls = base * multiplier;
    this.pearls += pearls;
    this.events.push({
      type: 'leap',
      boat: boat.index,
      x: boat.ring.x,
      pearls,
      multiplier,
      riders: riders.map((rider) => ({ type: rider.type, find: Boolean(rider.find), x: rider.x, y: rider.y })),
    });
    this.fish = this.fish.filter((fish) => !riders.includes(fish));
    boat.bigRing = false;
    this.rest(boat, 'pop', CAST.popTime);
    if (this.tutorial) {
      this.tutorial = false;
      for (const fish of this.fish) fish.held = false;
      this.events.push({ type: 'tutorialDone' });
    }
  }

  rest(boat, state, wait) {
    boat.state = state;
    boat.t = 0;
    boat.wait = wait;
    boat.riders = [];
    boat.fish = null;
    boat.ring.x = boat.x;
    boat.ring.y = RING_REST;
  }

  stepRefill() {
    if (this.tutorial) return;
    const missing = this.config.fish - this.fish.length - this.refills.length;
    for (let i = 0; i < missing; i++) this.refills.push(this.clock + SPAWN.refill + i * SPAWN.stagger);
    if (missing > 0) this.refills.sort((a, b) => a - b);
    while (this.refills.length && this.refills[0] <= this.clock) {
      this.refills.shift();
      this.spawn();
    }
  }
}
