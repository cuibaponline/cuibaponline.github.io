// Versioned save in localStorage. Anything unreadable falls back to defaults, never a crash.
import { ANIMALS, COSMETICS, DIFFICULTY, LEVELS, STARTER_COSMETICS } from './data.js';

export const SAVE_KEY = 'lasso-ranch-save';
export const SCHEMA_VERSION = 1;

export function defaultSave() {
  const progress = {};
  for (const mode of Object.keys(DIFFICULTY)) progress[mode] = { unlockedLevel: 1, levels: {} };
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { music: 0.8, sfx: 1, tapOnLane: false, breakReminder: true },
    progress,
    stickers: [],
    cosmetics: { owned: [...STARTER_COSMETICS], equipped: { rope: 'rope_yellow', hat: null, background: 'bg_sunny' } },
    difficulty: 'easy',
    installHintSeen: false,
  };
}

const unit = (value, fallback) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function readProgress(raw) {
  if (!isObject(raw)) return { unlockedLevel: 1, levels: {} };
  const unlockedLevel = Number.isInteger(raw.unlockedLevel) ? raw.unlockedLevel : 1;
  const levels = {};
  if (isObject(raw.levels)) {
    for (const [key, value] of Object.entries(raw.levels)) {
      const number = Number(key);
      if (!Number.isInteger(number) || number < 1 || number > LEVELS.length || !isObject(value)) continue;
      const stars = Number.isInteger(value.stars) ? Math.min(3, Math.max(0, value.stars)) : 0;
      const best = Number.isFinite(value.best) ? Math.max(0, value.best) : 0;
      levels[key] = { stars, best };
    }
  }
  return { unlockedLevel: Math.min(LEVELS.length, Math.max(1, unlockedLevel)), levels };
}

function sanitize(raw) {
  const base = defaultSave();
  if (!isObject(raw) || raw.schemaVersion !== SCHEMA_VERSION) return base;
  const settings = isObject(raw.settings) ? raw.settings : {};
  base.settings.music = unit(settings.music, base.settings.music);
  base.settings.sfx = unit(settings.sfx, base.settings.sfx);
  base.settings.tapOnLane = settings.tapOnLane === true;
  base.settings.breakReminder = settings.breakReminder !== false;

  for (const mode of Object.keys(DIFFICULTY)) base.progress[mode] = readProgress(raw.progress?.[mode]);
  if (Array.isArray(raw.stickers)) base.stickers = raw.stickers.filter((id) => id in ANIMALS);
  if (raw.difficulty in DIFFICULTY) base.difficulty = raw.difficulty;
  base.installHintSeen = raw.installHintSeen === true;

  if (isObject(raw.cosmetics)) {
    const known = COSMETICS.rope.concat(COSMETICS.hat, COSMETICS.background).map((item) => item.id);
    const owned = Array.isArray(raw.cosmetics.owned) ? raw.cosmetics.owned.filter((id) => known.includes(id)) : [];
    base.cosmetics.owned = [...new Set([...STARTER_COSMETICS, ...owned])];
    const equipped = isObject(raw.cosmetics.equipped) ? raw.cosmetics.equipped : {};
    for (const slot of ['rope', 'hat', 'background']) {
      if (base.cosmetics.owned.includes(equipped[slot])) base.cosmetics.equipped[slot] = equipped[slot];
    }
  }
  return base;
}

export function loadSave(storage) {
  try {
    const text = storage.getItem(SAVE_KEY);
    return text ? sanitize(JSON.parse(text)) : defaultSave();
  } catch {
    return defaultSave();
  }
}

export function writeSave(storage, save) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function totalStars(save) {
  let total = 0;
  for (const mode of Object.values(save.progress)) {
    for (const level of Object.values(mode.levels)) total += level.stars;
  }
  return total;
}

// Returns what changed so the results screen can celebrate it.
export function recordResult(save, mode, level, stars, score) {
  const progress = save.progress[mode];
  const previous = progress.levels[level] ?? { stars: 0, best: 0 };
  const newBest = score > previous.best;
  progress.levels[level] = { stars: Math.max(previous.stars, stars), best: Math.max(previous.best, score) };
  if (stars >= 1 && level < LEVELS.length) progress.unlockedLevel = Math.max(progress.unlockedLevel, level + 1);
  return { newBest, best: progress.levels[level].best, unlocked: unlockCosmetics(save) };
}

export function unlockCosmetics(save) {
  const stars = totalStars(save);
  const unlocked = COSMETICS.rope.concat(COSMETICS.hat, COSMETICS.background)
    .filter((item) => stars >= item.stars && !save.cosmetics.owned.includes(item.id));
  save.cosmetics.owned.push(...unlocked.map((item) => item.id));
  return unlocked;
}

export function addSticker(save, id) {
  if (save.stickers.includes(id)) return false;
  save.stickers.push(id);
  return true;
}
