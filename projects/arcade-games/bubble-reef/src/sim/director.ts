import { CONFIG, type CreatureDef, type ParadeEntry, type Tier } from '../config';
import { TAU } from './math';
import { initBossBody } from './motion';
import { buildPath, firstEntryDistance, straightPath, type Path } from './paths';
import { Rng } from './rng';
import { DT, isVisible, type Fish, type SimState } from './state';

const { waves, powerups } = CONFIG;

function blankFish(): Fish {
  return {
    uid: 0, def: CONFIG.fish[0]!, state: 'swim', x: 0, y: 0, px: 0, py: 0, heading: 0, pheading: 0, face: 1,
    hp: 1, maxHp: 1, armoured: false, parade: false, slots: 0, path: null, dist: 0, speed: 0, rush: 1, lateral: 0,
    phase: 0, age: 0, burstSpeed: false, flash: 0, hpRing: 0, puff: 0, caughtAge: 0, diveT: 0, isBoss: false,
    waypointX: 0, waypointY: 0, thresholds: [], trailX: [], trailY: [], chainX: [], chainY: [], escortOf: 0,
    orbitAngle: 0, orbitRadius: 0, beamHitTick: -999, leaving: false,
  };
}

interface SpawnOpts {
  path: Path | null;
  dist: number;
  lateral: number;
  parade?: boolean;
  slots: number;
}

function placeOnPath(f: Fish): void {
  const { path } = f;
  if (!path) return;
  // Step the fish once so position and heading are valid on its first rendered frame.
  const first = samplePoint(path, f.dist);
  const next = samplePoint(path, f.dist + 4);
  f.heading = Math.atan2(next.y - first.y, next.x - first.x);
  f.pheading = f.heading;
  f.x = first.x - Math.sin(f.heading) * f.lateral;
  f.y = first.y + Math.cos(f.heading) * f.lateral;
  f.px = f.x;
  f.py = f.y;
  f.face = Math.cos(f.heading) >= 0 ? 1 : -1;
}

function samplePoint(path: Path, dist: number): { x: number; y: number } {
  const last = path.xs.length - 1;
  if (dist <= 0) {
    const dx = path.xs[1]! - path.xs[0]!;
    const dy = path.ys[1]! - path.ys[0]!;
    const len = Math.hypot(dx, dy) || 1;
    return { x: path.xs[0]! + (dx / len) * dist, y: path.ys[0]! + (dy / len) * dist };
  }
  for (let i = 1; i <= last; i++) {
    if (path.ls[i]! >= dist) {
      const span = path.ls[i]! - path.ls[i - 1]! || 1;
      const t = (dist - path.ls[i - 1]!) / span;
      return { x: path.xs[i - 1]! + (path.xs[i]! - path.xs[i - 1]!) * t, y: path.ys[i - 1]! + (path.ys[i]! - path.ys[i - 1]!) * t };
    }
  }
  return { x: path.xs[last]!, y: path.ys[last]! };
}

export function spawnFish(s: SimState, def: CreatureDef, o: SpawnOpts): Fish {
  const f = s.pool.pop() ?? blankFish();
  const hp = def.hp[s.difficulty];
  f.uid = s.nextUid++;
  f.def = def;
  f.state = 'swim';
  f.hp = hp;
  f.maxHp = hp;
  f.armoured = s.cfg.armouredFish.includes(def.id);
  f.parade = o.parade === true;
  f.slots = o.slots;
  f.path = o.path;
  f.dist = o.dist;
  f.speed = def.speed * s.cfg.fishSpeedMul * (o.parade ? powerups.parade.speedMul : 1);
  f.rush = 1;
  f.lateral = o.lateral;
  f.phase = s.rng.range(0, TAU);
  f.age = 0;
  f.burstSpeed = s.difficulty === 'hard' && s.rng.chance(0.25);
  f.flash = 0;
  f.hpRing = 0;
  f.puff = 0;
  f.caughtAge = 0;
  f.diveT = 0;
  f.isBoss = false;
  f.thresholds = [];
  f.trailX.length = 0;
  f.trailY.length = 0;
  f.chainX.length = 0;
  f.chainY.length = 0;
  f.escortOf = 0;
  f.beamHitTick = -999;
  f.leaving = false;
  s.slotsUsed += o.slots;
  placeOnPath(f);
  s.fish.push(f);
  return f;
}

export function releaseFish(s: SimState, f: Fish): void {
  s.slotsUsed -= f.slots;
  f.slots = 0;
  f.path = null;
  s.pool.push(f);
}

const tierSlots = (tier: Tier): number => waves.tierSlots[tier];

function randomPath(s: SimState): Path {
  const allowed = CONFIG.paths.filter((p) => s.cfg.pathTags.includes(p.tag));
  return buildPath(s.rng.pick(allowed), s.view, s.rng.chance(0.5), s.rng.chance(0.5));
}

interface Slot {
  dist: number;
  lateral: number;
}

/** Offsets behind a path's head, always <= 0 so every member starts off screen. */
export function formationSlots(s: SimState, formation: string, count: number, size: number, gap?: number): Slot[] {
  const out: Slot[] = [];
  const spacing = gap ?? size * 1.25;
  if (formation === 'line') {
    for (let i = 0; i < count; i++) out.push({ dist: -i * spacing, lateral: 0 });
  } else if (formation === 'school') {
    const spread = size * Math.max(2, count * 0.75);
    const width = size * 1.3;
    for (let i = 0; i < count; i++) out.push({ dist: -s.rng.range(0, spread), lateral: s.rng.range(-width, width) });
  } else if (formation === 'cluster') {
    for (let i = 0; i < count; i++) {
      const row = i === 0 ? 0 : 1;
      out.push({ dist: -row * spacing, lateral: i === 0 ? 0 : (i % 2 === 0 ? 1 : -1) * spacing * 0.8 * Math.ceil(i / 2) });
    }
  } else if (formation === 'vee') {
    const mid = (count - 1) / 2;
    for (let i = 0; i < count; i++) {
      const away = Math.abs(i - mid);
      out.push({ dist: -away * spacing, lateral: (i - mid) * spacing * 0.75 });
    }
  } else if (formation === 'ring') {
    const radius = gap ?? size * 1.5;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      out.push({ dist: -radius * (1 + Math.cos(a)), lateral: radius * Math.sin(a) });
    }
  } else {
    for (let i = 0; i < count; i++) out.push({ dist: 0, lateral: 0 });
  }
  return out;
}

function chooseTier(s: SimState): Tier {
  const mix = waves.tierMix;
  return s.rng.weighted(['small', 'medium', 'large'] as const, (t) => mix[t]);
}

function speciesWeight(s: SimState, def: CreatureDef): number {
  const oceanId = s.unlocks.oceans[s.oceanIndex % Math.max(1, s.unlocks.oceans.length)];
  const ocean = CONFIG.progression.oceans.find((o) => o.id === oceanId);
  return (def.spawnWeight?.[s.difficulty] ?? 1) * (ocean?.bias[def.id] ?? 1);
}

function spawnGroup(s: SimState, room: number, startDist: (path: Path) => number): void {
  let tier = chooseTier(s);
  if (tierSlots(tier) > room) tier = 'small';
  if (tierSlots(tier) > room) return;
  const def = s.rng.weighted(CONFIG.fish.filter((f) => f.tier === tier), (f) => speciesWeight(s, f));
  const group = def.group ?? { min: 1, max: 1, formation: 'single' as const };
  const fits = Math.floor(room / tierSlots(tier));
  const count = Math.min(s.rng.int(group.min, group.max), fits);
  if (count <= 0) return;

  let formation: string = group.formation;
  if (s.difficulty !== 'easy' && count >= 5 && s.rng.chance(0.35)) formation = s.rng.pick(['line', 'vee', 'ring']);

  const path = randomPath(s);
  const base = startDist(path);
  for (const slot of formationSlots(s, formation, count, def.size)) {
    spawnFish(s, def, { path, dist: base + slot.dist, lateral: slot.lateral, slots: tierSlots(tier) });
  }
}

const offScreenStart = (): number => 0;

function targetSlots(s: SimState): number {
  const { startRatio, rampEndRatio } = waves.density;
  const t = s.phaseT / s.cfg.waveSec;
  const ratio = t >= rampEndRatio ? 1 : startRatio + ((1 - startRatio) * t) / rampEndRatio;
  return s.cfg.maxFishSlots * ratio;
}

/** A sea that starts empty would keep a child waiting, so the opening fish begin part-way along their paths. */
export function seedField(s: SimState): void {
  const target = s.cfg.maxFishSlots * waves.density.startRatio;
  let guard = 0;
  while (s.slotsUsed < target && guard++ < 40) {
    spawnGroup(s, target - s.slotsUsed, (path) => firstEntryDistance(path, s.view) + s.rng.range(0.15, 0.7) * path.length + 300);
  }
}

function keepSmallFishOnScreen(s: SimState): void {
  const min = s.cfg.minSmallFish;
  if (min === 0) return;
  let visible = 0;
  for (const f of s.fish) {
    if (f.def.tier === 'small' && f.state === 'swim' && !f.leaving && isVisible(s, f)) visible++;
  }
  if (visible >= min) return;

  const small = CONFIG.fish.filter((f) => f.tier === 'small');
  for (let i = visible; i < min; i++) {
    const def = s.rng.weighted(small, (f) => speciesWeight(s, f));
    const path = randomPath(s);
    spawnFish(s, def, { path, dist: firstEntryDistance(path, s.view) + 6, lateral: 0, slots: tierSlots('small') });
  }
}

function nextSpecialDelay(s: SimState): number {
  const j = waves.specialJitter;
  return s.cfg.specialIntervalSec * s.rng.range(1 - j, 1 + j);
}

function stepSpecials(s: SimState): void {
  s.specialT -= DT;
  if (s.specialT > 0) return;
  s.specialT = nextSpecialDelay(s);
  if (s.fish.some((f) => f.def.tier === 'special' && f.state === 'swim')) return;
  const unlocked = s.unlocks.specials;
  if (unlocked.length === 0) return;
  const def = CONFIG.creatures.get(s.rng.pick(unlocked));
  if (!def) return;
  const allowed = CONFIG.paths.filter((p) => p.tag === 'gentle');
  const path = buildPath(s.rng.pick(allowed), s.view, s.rng.chance(0.5), s.rng.chance(0.5));
  spawnFish(s, def, { path, dist: 0, lateral: 0, slots: tierSlots('special') });
  s.events.push({ t: 'specialAppear', id: def.id });
}

function setPhase(s: SimState, phase: SimState['phase']): void {
  s.phase = phase;
  s.phaseT = 0;
  s.events.push({ t: 'phase', phase, wave: s.wave });
}

/** Sends every remaining fish off screen. They stop counting toward the spawn cap straight away. */
export function rushOff(s: SimState, rush: number): void {
  for (const f of s.fish) {
    if (f.state === 'caught') continue;
    f.rush = Math.max(f.rush, rush);
    f.leaving = true;
    s.slotsUsed -= f.slots;
    f.slots = 0;
  }
}

function startParade(s: SimState): void {
  setPhase(s, 'parade');
  s.paradeQueue = [...waves.parade];
  rushOff(s, 2.2);
  s.events.push({ t: 'paradeStart' });
}

function spawnParadeEntry(s: SimState, entry: ParadeEntry): void {
  const def = CONFIG.creatures.get(entry.fish);
  if (!def) return;
  const v = s.view;
  const y = v.top + entry.lane * (v.bottom - v.top) * 0.82;
  const margin = waves.spawnOutsideU + def.size / 2;
  const reverse = entry.reverse === true;
  const path = reverse
    ? straightPath(v.right + margin, y, v.left - margin, y)
    : straightPath(v.left - margin, y, v.right + margin, y);
  for (const slot of formationSlots(s, entry.formation, entry.count, def.size, entry.gap)) {
    spawnFish(s, def, { path, dist: slot.dist, lateral: slot.lateral, parade: true, slots: 0 });
  }
}

function changeOcean(s: SimState): void {
  const oceans = s.unlocks.oceans;
  if (oceans.length < 2) return;
  s.oceanIndex = (s.oceanIndex + 1) % oceans.length;
  s.events.push({ t: 'oceanChange', ocean: oceans[s.oceanIndex]! });
}

function isBossWave(s: SimState): boolean {
  return s.wave % waves.bossEveryWaves === 0;
}

function spawnBoss(s: SimState): void {
  const bosses = s.unlocks.bosses;
  const id = bosses[(Math.floor(s.wave / waves.bossEveryWaves) - 1) % bosses.length] ?? 'B01';
  const def = CONFIG.creatures.get(id);
  if (!def) return;

  const v = s.view;
  const fromLeft = s.rng.chance(0.5);
  const f = spawnFish(s, def, { path: null, dist: 0, lateral: 0, slots: tierSlots('boss') });
  f.isBoss = true;
  f.x = fromLeft ? v.left - def.size / 2 - 150 : v.right + def.size / 2 + 150;
  f.y = v.top + (v.bottom - v.top) * 0.4;
  f.px = f.x;
  f.py = f.y;
  f.heading = fromLeft ? 0 : Math.PI;
  f.pheading = f.heading;
  f.waypointX = (v.left + v.right) / 2;
  f.waypointY = f.y;
  f.speed = def.speed * s.cfg.fishSpeedMul;
  f.thresholds = def.chain ? [...powerups.boss.dragonDiveAt] : [0.5];
  initBossBody(f);
  s.boss = f;
  s.bossTimer = s.cfg.bossTimerSec;
  s.events.push({ t: 'bossSpawn', id });

  const escort = CONFIG.creatures.get(powerups.boss.escorts.fish);
  if (!escort) return;
  const n = powerups.boss.escorts.count;
  for (let i = 0; i < n; i++) {
    const e = spawnFish(s, escort, { path: null, dist: 0, lateral: 0, slots: tierSlots('small') });
    e.escortOf = f.uid;
    e.orbitAngle = (i / n) * TAU;
    e.orbitRadius = powerups.boss.escorts.orbit;
    e.x = f.x + Math.cos(e.orbitAngle) * e.orbitRadius;
    e.y = f.y + Math.sin(e.orbitAngle) * e.orbitRadius * 0.7;
    e.px = e.x;
    e.py = e.y;
  }
}

/** The ring of bonus fish the Golden Whale lets go at half health. */
export function releaseWhaleRing(s: SimState, boss: Fish): void {
  const def = CONFIG.creatures.get(powerups.boss.whaleRingFish);
  if (!def) return;
  const n = powerups.boss.whaleRingCount;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const path = straightPath(boss.x, boss.y, boss.x + Math.cos(a) * 2600, boss.y + Math.sin(a) * 2600);
    const f = spawnFish(s, def, { path, dist: 90, lateral: 0, slots: 0 });
    f.speed *= 1.6;
  }
  s.events.push({ t: 'bossPhase', id: boss.def.id, kind: 'ring', x: boss.x, y: boss.y });
}

export function endBoss(s: SimState, caught: boolean): void {
  const boss = s.boss;
  if (!boss) return;
  s.boss = null;
  s.events.push({ t: 'bossEnd', id: boss.def.id, caught });
  if (caught) s.stats.bossesCaught++;
  if (!caught) {
    boss.leaving = true;
    boss.rush = 6;
  }
  setPhase(s, 'bossOutro');
}

function completeWave(s: SimState): void {
  setPhase(s, 'waveComplete');
  s.stats.wavesCompleted++;
  s.events.push({ t: 'waveComplete', wave: s.wave, shots: s.waveShots, hits: s.waveHits });
}

export function beginWave(s: SimState): void {
  s.wave++;
  s.rng = new Rng((s.seed ^ Math.imul(s.wave, 0x9e3779b1)) >>> 0);
  s.waveShots = 0;
  s.waveHits = 0;
  s.spawnCooldown = 0.2;
  s.specialT = Math.min(8, nextSpecialDelay(s));
  setPhase(s, 'wave');
  seedField(s);
}

/** Ends play after "Last catch!": every fish swims away, then the session is over. */
export function startSwimAway(s: SimState): void {
  if (s.boss) {
    s.boss.leaving = true;
    s.boss.rush = 6;
    s.boss = null;
  }
  setPhase(s, 'wrapUp');
  for (const f of s.fish) {
    if (f.state === 'caught') continue;
    f.rush = powerups.swimAway.speed / Math.max(1, f.speed);
    f.leaving = true;
    s.slotsUsed -= f.slots;
    f.slots = 0;
  }
}

export function stepDirector(s: SimState): void {
  if (s.attract) {
    if (s.spawnCooldown > 0) s.spawnCooldown -= DT;
    else if (s.slotsUsed < s.cfg.maxFishSlots * 0.7) {
      spawnGroup(s, s.cfg.maxFishSlots * 0.7 - s.slotsUsed, offScreenStart);
      s.spawnCooldown = 0.8;
    }
    return;
  }

  s.phaseT += DT;
  switch (s.phase) {
    case 'wave': {
      if (s.spawnCooldown > 0) s.spawnCooldown -= DT;
      const target = targetSlots(s);
      if (s.spawnCooldown <= 0 && s.slotsUsed < target) {
        spawnGroup(s, target - s.slotsUsed, offScreenStart);
        s.spawnCooldown = 0.4;
      }
      stepSpecials(s);
      keepSmallFishOnScreen(s);
      if (s.phaseT >= s.cfg.waveSec) startParade(s);
      break;
    }
    case 'parade': {
      while (s.paradeQueue.length > 0 && s.paradeQueue[0]!.at <= s.phaseT) {
        spawnParadeEntry(s, s.paradeQueue.shift()!);
      }
      if (s.phaseT >= powerups.parade.durationSec) {
        rushOff(s, 3);
        changeOcean(s);
        setPhase(s, 'transition');
      }
      break;
    }
    case 'transition': {
      if (s.phaseT >= 2.2) {
        if (isBossWave(s)) {
          setPhase(s, 'boss');
          spawnBoss(s);
        } else {
          completeWave(s);
        }
      }
      break;
    }
    case 'boss': {
      s.bossTimer -= DT;
      if (s.spawnCooldown > 0) s.spawnCooldown -= DT;
      const target = s.cfg.maxFishSlots * 0.4;
      if (s.spawnCooldown <= 0 && s.slotsUsed < target) {
        spawnGroup(s, target - s.slotsUsed, offScreenStart);
        s.spawnCooldown = 1;
      }
      keepSmallFishOnScreen(s);
      if (s.bossTimer <= 0) endBoss(s, false);
      break;
    }
    case 'bossOutro': {
      if (s.phaseT >= 2.5) {
        rushOff(s, 2.5);
        completeWave(s);
      }
      break;
    }
    case 'wrapUp': {
      if (s.phaseT >= powerups.swimAway.durationSec) setPhase(s, 'ended');
      break;
    }
    default:
      break;
  }
}
