// Versioned save in localStorage. Anything unreadable falls back to defaults, never a crash.
import { BOAT_EXTRAS, LEVELS, STICKER_ORDER } from './data.js';

export const SAVE_KEY = 'plop-and-pull-save';
export const SCHEMA_VERSION = 1;

export function defaultSave() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { music: 0.7, sfx: 1 },
    players: 1,
    unlocked: 1,
    levels: {},
    stickers: [],
    tutorialSeen: false,
    installHintSeen: false,
  };
}

const unit = (value, fallback) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function sanitize(raw) {
  const base = defaultSave();
  if (!isObject(raw) || raw.schemaVersion !== SCHEMA_VERSION) return base;
  const settings = isObject(raw.settings) ? raw.settings : {};
  base.settings.music = unit(settings.music, base.settings.music);
  base.settings.sfx = unit(settings.sfx, base.settings.sfx);
  base.players = raw.players === 2 ? 2 : 1;
  if (Number.isInteger(raw.unlocked)) base.unlocked = Math.min(LEVELS.length, Math.max(1, raw.unlocked));
  if (isObject(raw.levels)) {
    for (const [key, value] of Object.entries(raw.levels)) {
      const number = Number(key);
      if (!Number.isInteger(number) || number < 1 || number > LEVELS.length || !isObject(value)) continue;
      const stars = Number.isInteger(value.stars) ? Math.min(3, Math.max(0, value.stars)) : 0;
      const best = Number.isFinite(value.best) ? Math.max(0, value.best) : 0;
      base.levels[key] = { stars, best };
    }
  }
  if (Array.isArray(raw.stickers)) base.stickers = raw.stickers.filter((id) => STICKER_ORDER.includes(id));
  base.tutorialSeen = raw.tutorialSeen === true;
  base.installHintSeen = raw.installHintSeen === true;
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
  return Object.values(save.levels).reduce((sum, level) => sum + level.stars, 0);
}

export function boatExtras(save) {
  const stars = totalStars(save);
  return BOAT_EXTRAS.filter((item) => stars >= item.stars).map((item) => item.id);
}

// Finishing always opens the next level. Returns what changed so the results screen can celebrate it.
export function recordResult(save, level, stars, pearls) {
  const before = boatExtras(save);
  const previous = save.levels[level] ?? { stars: 0, best: 0 };
  const newBest = pearls > previous.best;
  save.levels[level] = { stars: Math.max(previous.stars, stars), best: Math.max(previous.best, pearls) };
  save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, level + 1));
  const extras = BOAT_EXTRAS.filter((item) => boatExtras(save).includes(item.id) && !before.includes(item.id));
  return { newBest, best: save.levels[level].best, extras };
}

export function addSticker(save, id) {
  if (save.stickers.includes(id)) return false;
  save.stickers.push(id);
  return true;
}
