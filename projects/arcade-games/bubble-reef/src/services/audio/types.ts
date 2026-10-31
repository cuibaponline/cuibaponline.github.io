export type MusicTrack = 'menu' | 'coral' | 'kelp' | 'ship' | 'glow' | 'arctic' | 'boss' | 'lullaby';

export type SfxName =
  | 'fire'
  | 'netPop'
  | 'hit'
  | 'catchSmall'
  | 'catchMedium'
  | 'catchLarge'
  | 'catchBoss'
  | 'coin'
  | 'specialAppear'
  | 'burst'
  | 'freeze'
  | 'spark'
  | 'levelUp'
  | 'buttonTap'
  | 'warningChime'
  | 'wrongPin'
  | 'paradeSting'
  | 'bubblePop'
  | 'waveComplete'
  | 'unlock';

export interface SfxOptions {
  /** Playback-rate multiplier. */
  pitch?: number;
  /** Linear gain multiplier. */
  gain?: number;
}

export const MUSIC_TRACKS: readonly MusicTrack[] = [
  'menu',
  'coral',
  'kelp',
  'ship',
  'glow',
  'arctic',
  'boss',
  'lullaby',
];

/** Render order doubles as priority: the sounds a first tap can reach come first. */
export const SFX_NAMES: readonly SfxName[] = [
  'buttonTap',
  'fire',
  'netPop',
  'hit',
  'coin',
  'catchSmall',
  'catchMedium',
  'bubblePop',
  'catchLarge',
  'catchBoss',
  'specialAppear',
  'burst',
  'freeze',
  'spark',
  'levelUp',
  'warningChime',
  'wrongPin',
  'paradeSting',
  'waveComplete',
  'unlock',
];
