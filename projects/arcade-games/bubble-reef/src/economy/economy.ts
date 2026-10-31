import { CONFIG, type CreatureDef } from '../config';
import type { SaveData } from '../services/saveSchema';
import type { Unlocks } from '../sim/state';

type Profile = SaveData['profile'];

const { progression } = CONFIG;

export type Badge = 'none' | 'bronze' | 'silver' | 'gold';

export function xpForLevel(level: number): number {
  const known = progression.levels.find((l) => l.level === level);
  if (known) return known.xp;
  const last = progression.levels[progression.levels.length - 1]!;
  return last.xp + (level - last.level) * progression.xpPerLevelAfter10;
}

export function levelForXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

export function levelProgress(xp: number): { level: number; into: number; needed: number; ratio: number } {
  const level = levelForXp(xp);
  const floor = xpForLevel(level);
  const needed = xpForLevel(level + 1) - floor;
  const into = xp - floor;
  return { level, into, needed, ratio: into / needed };
}

/** Everything the given player level has opened up, accumulated from level 1. */
export function unlocksForLevel(level: number): Unlocks {
  const out: Unlocks = { specials: [], bosses: [], oceans: [], laser: false, maxCannonLevel: 1 };
  for (const l of progression.levels) {
    if (l.level > level) break;
    out.specials.push(...l.specials);
    out.bosses.push(...l.bosses);
    out.oceans.push(...l.oceans);
    out.maxCannonLevel = Math.max(out.maxCannonLevel, l.maxCannonLevel);
    if (l.features.includes('laser')) out.laser = true;
  }
  return out;
}

export function skinsForLevel(level: number): string[] {
  return progression.levels.filter((l) => l.level <= level).flatMap((l) => l.skins);
}

export const fishBookEntries = (): CreatureDef[] => [...CONFIG.fish, ...CONFIG.bosses, ...CONFIG.specials];

export function badgeFor(caught: number): Badge {
  const { bronze, silver, gold } = progression.badges;
  if (caught >= gold) return 'gold';
  if (caught >= silver) return 'silver';
  if (caught >= bronze) return 'bronze';
  return 'none';
}

export function fishBookComplete(profile: Profile): boolean {
  return fishBookEntries().every((def) => (profile.fishBook[def.id]?.caught ?? 0) > 0);
}

export interface LevelUp {
  level: number;
  /** Short, child-facing unlock labels, empty for levels above 10. */
  unlocks: string[];
}

function describeLevel(level: number): string[] {
  const entry = progression.levels.find((l) => l.level === level);
  if (!entry) return ['A star for your badge'];
  const out: string[] = [];
  for (const id of entry.oceans) out.push(`New ocean: ${progression.oceans.find((o) => o.id === id)?.name ?? id}`);
  const previous = progression.levels.find((l) => l.level === level - 1);
  if (previous && entry.maxCannonLevel > previous.maxCannonLevel) out.push(`Cannon level ${entry.maxCannonLevel}`);
  for (const id of entry.specials) out.push(`New special: ${CONFIG.creatures.get(id)?.name ?? id}`);
  for (const id of entry.bosses) out.push(`New boss: ${CONFIG.creatures.get(id)?.name ?? id}`);
  if (entry.features.includes('laser')) out.push('Laser');
  for (const id of entry.skins) out.push(`Free skin: ${progression.skins.find((s) => s.id === id)?.name ?? id}`);
  return out;
}

/** Brings level-derived fields up to date with XP. Returns any levels gained. */
export function syncProgress(profile: Profile): LevelUp[] {
  const level = levelForXp(profile.xp);
  const gained: LevelUp[] = [];
  for (let l = profile.level + 1; l <= level; l++) gained.push({ level: l, unlocks: describeLevel(l) });
  profile.level = level;

  const unlocks = unlocksForLevel(level);
  profile.maxCannonLevel = unlocks.maxCannonLevel as Profile['maxCannonLevel'];
  for (const ocean of unlocks.oceans) if (!profile.unlockedOceans.includes(ocean)) profile.unlockedOceans.push(ocean);
  for (const skin of skinsForLevel(level)) if (!profile.ownedSkins.includes(skin)) profile.ownedSkins.push(skin);
  if (fishBookComplete(profile) && !profile.ownedSkins.includes('golden')) profile.ownedSkins.push('golden');
  return gained;
}

export interface CatchResult {
  newSpecies: boolean;
  levelUps: LevelUp[];
}

export function applyCatch(profile: Profile, id: string, points: number, coins: number, nowIso: string): CatchResult {
  profile.coins += coins;
  profile.xp += points;
  const entry = profile.fishBook[id];
  const newSpecies = entry === undefined;
  if (entry) entry.caught++;
  else profile.fishBook[id] = { caught: 1, firstCaughtAt: nowIso };
  return { newSpecies, levelUps: syncProgress(profile) };
}

export type SkinState = 'equipped' | 'owned' | 'buy' | 'locked';

export function skinState(profile: Profile, skinId: string): SkinState {
  if (profile.selectedSkin === skinId) return 'equipped';
  if (profile.ownedSkins.includes(skinId)) return 'owned';
  const skin = progression.skins.find((s) => s.id === skinId);
  return skin?.how === 'coins' ? 'buy' : 'locked';
}

export function buySkin(profile: Profile, skinId: string): boolean {
  const skin = progression.skins.find((s) => s.id === skinId);
  if (!skin || skin.how !== 'coins' || profile.ownedSkins.includes(skinId) || profile.coins < skin.price) return false;
  profile.coins -= skin.price;
  profile.ownedSkins.push(skinId);
  return true;
}

export function equipSkin(profile: Profile, skinId: string): boolean {
  if (!profile.ownedSkins.includes(skinId)) return false;
  profile.selectedSkin = skinId;
  return true;
}

/** Captain Otto's "Want to try Medium?": at most daily, after enough accurate Easy waves. */
export function shouldSuggestMedium(profile: Profile, dayKey: string, difficultyLocked: boolean): boolean {
  if (difficultyLocked || profile.lastMediumPromptDay === dayKey) return false;
  const { afterEasyWaves, minCatchRate } = progression.suggestMedium;
  if (profile.easyWavesCompleted < afterEasyWaves || profile.easyWaveShots === 0) return false;
  return profile.easyWaveHits / profile.easyWaveShots >= minCatchRate;
}
