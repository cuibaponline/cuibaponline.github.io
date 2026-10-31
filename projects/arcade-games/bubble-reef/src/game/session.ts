import type { OceanId } from '../art/types';
import { CONFIG, type Difficulty } from '../config';
import { applyCatch, type LevelUp, unlocksForLevel } from '../economy/economy';
import type { Hud, HudActions } from '../ui/hud';
import type { InputSystem } from '../input/input';
import type { World } from '../render/world';
import type { AudioService, MusicTrack, SfxName } from '../services/audio';
import type { SaveService } from '../services/save';
import { Simulation } from '../sim/simulation';
import type { SimEvent, Unlocks } from '../sim/state';

export interface SessionResults {
  difficulty: Difficulty;
  coins: number;
  caught: number;
  wave: number;
  wavesCompleted: number;
  bossesCaught: number;
  newFish: string[];
  levelUps: LevelUp[];
}

export interface WaveSummary {
  wave: number;
  coins: number;
  caught: number;
  newFish: string[];
  levelUps: LevelUp[];
  boss: boolean;
}

export interface SessionDeps {
  world: World;
  hud: Hud;
  input: InputSystem;
  audio: AudioService;
  save: SaveService;
  onPause(): void;
  onWaveComplete(summary: WaveSummary): void;
  onEnded(results: SessionResults): void;
}

const CATCH_SFX: Record<string, SfxName> = {
  small: 'catchSmall', medium: 'catchMedium', special: 'catchMedium', large: 'catchLarge', boss: 'catchBoss',
};

const OCEAN_TRACK: Record<string, MusicTrack> = { coral: 'coral', kelp: 'kelp', ship: 'ship', glow: 'glow', arctic: 'arctic' };

export class GameSession {
  readonly sim: Simulation;
  private readonly newFish: string[] = [];
  private readonly levelUps: LevelUp[] = [];
  private waveCoinsAt = 0;
  private waveCaughtAt = 0;
  private waveNewAt = 0;
  private waveLevelAt = 0;
  private lastHitSfx = 0;
  private bannerLeft = 0;
  private lastCatchLeft: number | null = null;
  private ended = false;
  private inIntermission = false;
  paused = false;
  private ocean: string;

  constructor(private readonly deps: SessionDeps, readonly difficulty: Difficulty, seed: number) {
    const { profile, settings } = deps.save.get();
    const unlocks = this.unlocks();
    this.ocean = unlocks.oceans[seed % unlocks.oceans.length] ?? 'coral';
    this.sim = new Simulation({
      difficulty, seed, view: deps.world.currentLayout.view, unlocks,
      autoFire: settings.autoFire[difficulty],
      startLevel: profile.maxCannonLevel,
      oceanIndex: unlocks.oceans.indexOf(this.ocean),
    });
    deps.hud.configure(difficulty, {
      joystick: settings.controlMode === 'joystick',
      leftHanded: settings.leftHanded,
      laserUnlocked: unlocks.laser,
    });
    deps.hud.setCoins(profile.coins, true);
    deps.hud.setBanner(null);
  }

  private unlocks(): Unlocks {
    return unlocksForLevel(this.deps.save.get().profile.level);
  }

  get currentOcean(): OceanId {
    return this.ocean as OceanId;
  }

  get oceanTrack(): MusicTrack {
    return OCEAN_TRACK[this.ocean] ?? 'coral';
  }

  /** Holds the ocean now on screen and the next one, baked ahead so the mid-wave change can't hitch. */
  prepareOceans(): void {
    const { oceans } = this.sim.s.unlocks;
    const next = oceans[(this.sim.s.oceanIndex + 1) % Math.max(1, oceans.length)] ?? this.ocean;
    this.deps.world.keepOceans([this.currentOcean, next as OceanId]);
    this.deps.world.prepareOcean(next as OceanId);
  }

  get atIntermission(): boolean {
    return this.inIntermission;
  }

  actions(): HudActions {
    const cmd = (type: 'ToggleLock' | 'ToggleAuto' | 'Laser' | 'LevelUp' | 'LevelDown') => {
      this.sim.enqueue({ tick: this.sim.tick, seatId: 0, type });
    };
    return {
      pause: () => this.deps.onPause(),
      lock: () => {
        this.deps.audio.sfx('buttonTap');
        cmd('ToggleLock');
      },
      auto: () => {
        this.deps.audio.sfx('buttonTap');
        cmd('ToggleAuto');
        this.deps.save.update((d) => {
          d.settings.autoFire[this.difficulty] = !this.sim.localSeat.autoFire;
        });
        this.deps.save.saveSoon();
      },
      laser: () => cmd('Laser'),
      levelUp: () => {
        this.deps.audio.sfx('buttonTap');
        cmd('LevelUp');
      },
      levelDown: () => {
        this.deps.audio.sfx('buttonTap');
        cmd('LevelDown');
      },
      fire: (down) => this.deps.input.setFireButton(down),
    };
  }

  private banner(text: string, seconds: number): void {
    if (this.lastCatchLeft !== null) return;
    this.deps.hud.setBanner(text);
    this.bannerLeft = seconds;
  }

  private onCaught(id: string, points: number, coins: number): void {
    const { save, audio, hud } = this.deps;
    const def = CONFIG.creatures.get(id);
    audio.sfx(CATCH_SFX[def?.tier ?? 'small'] ?? 'catchSmall');

    let isNew = false;
    let gained: LevelUp[] = [];
    save.update((d) => {
      const result = applyCatch(d.profile, id, points, coins, new Date().toISOString());
      isNew = result.newSpecies;
      gained = result.levelUps;
    });
    if (isNew) {
      this.newFish.push(id);
      hud.toast(`New for your Fish Book: ${def?.name ?? id}!`, 'cheer', 2600);
      void save.saveNow();
    } else {
      save.saveSoon();
    }
    if (gained.length > 0) this.onLevelUp(gained);
  }

  private onLevelUp(gained: LevelUp[]): void {
    const { hud, audio, save } = this.deps;
    this.levelUps.push(...gained);
    audio.sfx('levelUp');
    for (const up of gained) hud.toast(`Level ${up.level}!`, 'cheer', 3200);
    const unlocks = this.unlocks();
    // New oceans join at the next intermission, where baking them can't cause a hitch mid-wave.
    this.sim.setUnlocks({ ...unlocks, oceans: this.sim.s.unlocks.oceans });
    hud.setLaserUnlocked(unlocks.laser);
    void save.saveNow();
  }

  private onWaveComplete(wave: number, shots: number, hits: number): void {
    const { save, audio } = this.deps;
    audio.sfx('waveComplete');
    save.update((d) => {
      d.profile.bestWave[this.difficulty] = Math.max(d.profile.bestWave[this.difficulty], wave);
      if (this.difficulty === 'easy') {
        d.profile.easyWavesCompleted++;
        d.profile.easyWaveShots += shots;
        d.profile.easyWaveHits += hits;
      }
    });
    void save.saveNow();

    if (this.lastCatchLeft !== null) {
      this.lastCatchLeft = 0;
      return;
    }
    const stats = this.sim.s.stats;
    const summary: WaveSummary = {
      wave,
      coins: stats.coins - this.waveCoinsAt,
      caught: stats.caught - this.waveCaughtAt,
      newFish: this.newFish.slice(this.waveNewAt),
      levelUps: this.levelUps.slice(this.waveLevelAt),
      boss: wave % CONFIG.waves.bossEveryWaves === 0,
    };
    this.waveCoinsAt = stats.coins;
    this.waveCaughtAt = stats.caught;
    this.waveNewAt = this.newFish.length;
    this.waveLevelAt = this.levelUps.length;
    this.inIntermission = true;
    this.deps.onWaveComplete(summary);
  }

  /** Called by the world for every batch of simulation events. */
  onEvents(events: SimEvent[]): void {
    const { audio, world, save } = this.deps;
    for (const e of events) {
      switch (e.t) {
        case 'fire':
          audio.sfx('fire', { pitch: 1.14 - e.level * 0.07, gain: e.empty ? 0.45 : 0.7 });
          break;
        case 'net':
          audio.sfx('netPop');
          break;
        case 'hit': {
          const now = performance.now();
          if (now - this.lastHitSfx > 70) {
            this.lastHitSfx = now;
            audio.sfx('hit');
          }
          break;
        }
        case 'caught':
          this.onCaught(e.id, e.points, e.coins);
          break;
        case 'specialAppear':
          audio.sfx('specialAppear');
          break;
        case 'burst':
          audio.sfx('burst');
          break;
        case 'freeze':
          audio.sfx('freeze');
          audio.setUnderwaterMuffle(true);
          break;
        case 'freezeEnd':
          audio.setUnderwaterMuffle(false);
          break;
        case 'chain':
          audio.sfx('spark');
          break;
        case 'laserStart':
          audio.setLaser(true);
          break;
        case 'laserEnd':
          audio.setLaser(false);
          break;
        case 'laserReady':
        case 'laserFilled':
          audio.sfx('unlock');
          break;
        case 'paradeStart':
          audio.sfx('paradeSting');
          this.banner('Fish Parade!', 2.6);
          break;
        case 'oceanChange':
          this.ocean = e.ocean;
          world.setOcean(e.ocean as OceanId);
          audio.playMusic(this.oceanTrack);
          break;
        case 'bossSpawn':
          audio.duck(2.5);
          audio.playMusic('boss');
          this.banner(`${CONFIG.creatures.get(e.id)?.name ?? 'Boss'}!`, 3);
          break;
        case 'bossEnd':
          audio.playMusic(this.oceanTrack);
          if (e.caught) this.banner('You caught it!', 2.4);
          else this.banner('It got away this time', 2.4);
          break;
        case 'bossPhase':
          audio.sfx(e.kind === 'ring' ? 'burst' : 'netPop');
          break;
        case 'bubblePopStart':
          this.banner('Pop the bubbles!', 2.5);
          audio.sfx('specialAppear');
          break;
        case 'bubblePopped':
          audio.sfx('bubblePop');
          save.update((d) => {
            d.profile.coins += e.coins;
          });
          save.saveSoon();
          break;
        case 'waveComplete':
          this.onWaveComplete(e.wave, e.shots, e.hits);
          break;
        case 'phase':
          if (e.phase === 'ended') this.finish();
          break;
        default:
          break;
      }
    }
  }

  frame(dt: number): void {
    const { hud } = this.deps;
    hud.update(this.sim.hud(), this.paused ? 0 : dt);

    if (this.lastCatchLeft !== null && this.lastCatchLeft > 0) {
      this.lastCatchLeft -= dt;
      hud.setBanner(`Last catch! ${Math.max(1, Math.ceil(this.lastCatchLeft))}`);
      if (this.lastCatchLeft <= 0) this.swimAwayNow();
    } else if (this.lastCatchLeft !== null && this.sim.s.phase !== 'wrapUp' && this.sim.s.phase !== 'ended') {
      this.swimAwayNow();
    } else if (this.bannerLeft > 0) {
      this.bannerLeft -= dt;
      if (this.bannerLeft <= 0) hud.setBanner(null);
    }
  }

  private swimAwayNow(): void {
    if (this.paused) {
      this.finish();
      return;
    }
    this.deps.hud.setBanner('The fish are swimming home');
    this.sim.swimAway();
  }

  /** The 15 s wrap-up when a time limit is reached mid-wave (13.4). */
  beginLastCatch(): void {
    if (this.lastCatchLeft !== null || this.ended) return;
    if (this.inIntermission) {
      this.finish();
      return;
    }
    this.lastCatchLeft = CONFIG.powerups.lastCatchSec;
  }

  keepPlaying(): void {
    const { save, hud } = this.deps;
    this.inIntermission = false;
    const unlocks = this.unlocks();
    this.sim.setUnlocks(unlocks);
    this.prepareOceans();
    hud.setLaserUnlocked(unlocks.laser);
    this.sim.nextWave();
    void save.saveNow();
  }

  /** Ends the session and hands back its results. Safe to call more than once. */
  finish(): void {
    if (this.ended) return;
    this.ended = true;
    const { audio, input, save, hud } = this.deps;
    input.release();
    audio.setLaser(false);
    audio.setUnderwaterMuffle(false);
    hud.setBanner(null);
    const stats = this.sim.s.stats;
    void save.saveNow();
    this.deps.onEnded({
      difficulty: this.difficulty,
      coins: stats.coins,
      caught: stats.caught,
      wave: this.sim.s.wave,
      wavesCompleted: stats.wavesCompleted,
      bossesCaught: stats.bossesCaught,
      newFish: this.newFish,
      levelUps: this.levelUps,
    });
  }
}
