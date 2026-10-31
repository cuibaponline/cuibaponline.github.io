import type { MusicTrack, SfxName, SfxOptions } from './types';
import { SFX_NAMES } from './types';
import { MUFFLE_CLOSED_HZ, MUFFLE_OPEN_HZ, MUSIC_TRIM, buildGraph, volumeToGain, type OutputGraph } from './graph';
import { renderLaser, renderSfx } from './sfx';
import { renderTrack } from './music';
import { breathe } from './offline';
import { mulberry32 } from './synth';

const MAX_VOICES = 16;
const CROSSFADE = 0.8;
const MAX_CACHED_TRACKS = 3;
const COINS_PER_SECOND = 8;
const COIN_STREAK_MS = 1000;
const COIN_SPACING = 0.06;
const COIN_LADDER = [0, 2, 4, 7, 9, 12, 14, 16];
const RETRIGGER_S = 0.025;
const DUCK_LEVEL = 0.32;
const LASER_LEVEL = 0.34;
const QUEUE_MAX_AGE_MS = 220;
const UNLOCK_TIMEOUT_MS = 1200;
const RESUME_RETRY_MS = 400;
const RESUME_RETRIES = 5;
const CLOCK_CHECK_MS = 700;
const CLOCK_STALL_MS = 250;
const REBUILD_MIN_MS = 5000;
const REBUILD_MAX_MS = 60000;

const JITTERED: ReadonlySet<SfxName> = new Set<SfxName>(['netPop', 'hit', 'bubblePop', 'spark']);

interface Voice {
  src: AudioBufferSourceNode;
  gain: GainNode;
  level: number;
  begin: number;
  end: number;
}

interface Loop {
  track: MusicTrack;
  src: AudioBufferSourceNode;
  gain: GainNode;
  buffer: AudioBuffer;
  startedAt: number;
}

interface QueuedSfx {
  name: SfxName;
  opts: SfxOptions | undefined;
  at: number;
}

interface RenderJob {
  track: MusicTrack;
  cancelled: boolean;
}

export interface AudioStats {
  state: string;
  sfxReady: number;
  voices: number;
  peakVoices: number;
  voicesEvicted: number;
  coinsPlayed: number;
  coinsDropped: number;
  lastCoinRate: number;
  wantedTrack: MusicTrack | null;
  currentTrack: MusicTrack | null;
  cachedTracks: MusicTrack[];
  rendering: MusicTrack | null;
  laser: boolean;
  rebuilds: number;
  resumeCalls: number;
  disabled: boolean;
  warned: boolean;
}

type ContextCtor = new (options?: AudioContextOptions) => AudioContext;

function audioContextCtor(): ContextCtor | null {
  const w = globalThis as unknown as { AudioContext?: ContextCtor; webkitAudioContext?: ContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

const finite = (value: number | undefined, fallback: number): number =>
  value !== undefined && Number.isFinite(value) ? value : fallback;

/** Piecewise equal-power fade; plain ramps can always be cancelled, unlike value curves. */
function fade(param: AudioParam, from: number, to: number, at: number, seconds: number): void {
  const steps = 6;
  param.cancelScheduledValues(at);
  param.setValueAtTime(from, at);
  for (let i = 1; i <= steps; i++) {
    const x = i / steps;
    const shape = to > from ? Math.sin((x * Math.PI) / 2) : 1 - Math.cos((x * Math.PI) / 2);
    param.linearRampToValueAtTime(from + (to - from) * shape, at + x * seconds);
  }
}

export class AudioService {
  private ctx: AudioContext | null = null;
  private graph: OutputGraph | null = null;
  private musicVolume = 0.7;
  private sfxVolume = 0.7;

  private disabled = false;
  private warned = false;
  private listening = false;

  private appPaused = false;
  private hidden = false;
  private needsRebuild = false;
  private retries = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private clockTimer: ReturnType<typeof setTimeout> | null = null;
  private clockSeen = 0;
  private clockMovedAt = 0;
  private rebuildDelay = REBUILD_MIN_MS;
  private rebuildNotBefore = 0;

  private readonly sfxBuffers = new Map<SfxName, AudioBuffer[]>();
  private sfxLoading = false;
  private readonly roundRobin = new Map<SfxName, number>();
  private readonly lastPlayed = new Map<SfxName, number>();
  private readonly jitter = mulberry32(0x5eed);
  private voices: Voice[] = [];
  private queue: QueuedSfx[] = [];

  private coinTimes: number[] = [];
  private coinStep = 0;
  private lastCoinMs = -Infinity;
  private nextCoinAt = 0;

  private laserBuffer: AudioBuffer | null = null;
  private laserOn = false;
  private laserVoice: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

  private muffled = false;
  private duckUntil = 0;

  private wanted: MusicTrack | null = null;
  private loop: Loop | null = null;
  private job: RenderJob | null = null;
  /** Insertion order is recency: oldest first. */
  private readonly trackCache = new Map<MusicTrack, AudioBuffer>();

  private peakVoices = 0;
  private voicesEvicted = 0;
  private coinsPlayed = 0;
  private coinsDropped = 0;
  private lastCoinRate = 0;
  private rebuilds = 0;
  private resumeCalls = 0;

  unlock(): Promise<void> {
    try {
      if (this.disabled) return Promise.resolve();
      const first = !this.ctx;
      if (first) this.createContext();
      else this.rebuildIfNeeded();
      const ctx = this.ctx;
      if (!ctx) return Promise.resolve();
      // Games tend to call this on every press, so the settled path has to cost nothing.
      if (!first && ctx.state === 'running') return Promise.resolve();
      this.listen();
      this.pokeOutput(ctx);
      const resumed = this.tryResume();
      void this.loadSfx();
      this.syncMusic();
      const timeout = new Promise<void>((resolve) => setTimeout(resolve, UNLOCK_TIMEOUT_MS));
      return Promise.race([resumed, timeout]);
    } catch (err) {
      this.fail('unlock', err);
      return Promise.resolve();
    }
  }

  setMusicVolume(v: number): void {
    this.guard('setMusicVolume', () => {
      this.musicVolume = v;
      if (this.ctx && this.graph) {
        this.graph.musicBus.gain.setTargetAtTime(volumeToGain(v) * MUSIC_TRIM, this.ctx.currentTime, 0.03);
      }
    });
  }

  setSfxVolume(v: number): void {
    this.guard('setSfxVolume', () => {
      this.sfxVolume = v;
      if (this.ctx && this.graph) {
        this.graph.sfxBus.gain.setTargetAtTime(volumeToGain(v), this.ctx.currentTime, 0.03);
      }
    });
  }

  playMusic(track: MusicTrack): void {
    this.guard('playMusic', () => {
      if (this.wanted === track) return;
      this.wanted = track;
      this.syncMusic();
    });
  }

  stopMusic(): void {
    this.guard('stopMusic', () => {
      this.wanted = null;
      if (this.job) this.job.cancelled = true;
      if (this.ctx) this.releaseLoop(this.ctx.currentTime, CROSSFADE);
    });
  }

  sfx(name: SfxName, opts?: SfxOptions): void {
    this.guard('sfx', () => {
      const ctx = this.ctx;
      if (!ctx || this.disabled) return;
      const variants = this.sfxBuffers.get(name);
      if (variants && ctx.state === 'running' && !this.clockStalled(ctx)) {
        this.startVoice(ctx, name, variants, opts);
      } else if (this.queue.length < 4) {
        // The tap that unlocks audio usually wants a sound before the context is up.
        this.queue.push({ name, opts, at: performance.now() });
      }
    });
  }

  setLaser(on: boolean): void {
    this.guard('setLaser', () => {
      this.laserOn = on;
      this.syncLaser();
    });
  }

  setUnderwaterMuffle(on: boolean): void {
    this.guard('setUnderwaterMuffle', () => {
      this.muffled = on;
      if (!this.ctx || !this.graph) return;
      const frequency = this.graph.muffle.frequency;
      const t = this.ctx.currentTime;
      frequency.cancelScheduledValues(t);
      frequency.setTargetAtTime(on ? MUFFLE_CLOSED_HZ : MUFFLE_OPEN_HZ, t, on ? 0.12 : 0.25);
    });
  }

  duck(seconds: number): void {
    this.guard('duck', () => {
      if (!this.ctx || !this.graph) return;
      const t = this.ctx.currentTime;
      const attack = 0.12;
      const until = Math.max(this.duckUntil, t + attack + Math.max(0, finite(seconds, 0)));
      this.duckUntil = until;
      const param = this.graph.duck.gain;
      param.cancelScheduledValues(t);
      param.setValueAtTime(param.value, t);
      param.linearRampToValueAtTime(DUCK_LEVEL, t + attack);
      param.setValueAtTime(DUCK_LEVEL, until);
      param.linearRampToValueAtTime(1, until + 0.5);
    });
  }

  pause(): void {
    this.guard('pause', () => {
      this.appPaused = true;
      this.applyRunState();
    });
  }

  resume(): void {
    this.guard('resume', () => {
      this.appPaused = false;
      this.applyRunState();
    });
  }

  /** Read-only snapshot for tools and debug overlays. */
  stats(): AudioStats {
    const now = this.ctx?.currentTime ?? 0;
    return {
      state: this.ctx ? (this.ctx.state as string) : 'none',
      sfxReady: this.sfxBuffers.size,
      voices: this.voices.filter((v) => v.end > now).length,
      peakVoices: this.peakVoices,
      voicesEvicted: this.voicesEvicted,
      coinsPlayed: this.coinsPlayed,
      coinsDropped: this.coinsDropped,
      lastCoinRate: this.lastCoinRate,
      wantedTrack: this.wanted,
      currentTrack: this.loop?.track ?? null,
      cachedTracks: [...this.trackCache.keys()],
      rendering: this.job?.track ?? null,
      laser: this.laserVoice !== null,
      rebuilds: this.rebuilds,
      resumeCalls: this.resumeCalls,
      disabled: this.disabled,
      warned: this.warned,
    };
  }

  private guard(where: string, fn: () => void): void {
    try {
      fn();
    } catch (err) {
      this.fail(where, err);
    }
  }

  private fail(where: string, err: unknown): void {
    if (this.warned) return;
    this.warned = true;
    console.warn(`[audio] ${where} failed; carrying on quietly.`, err);
  }

  private createContext(): void {
    const Ctor = audioContextCtor();
    if (!Ctor) {
      this.disabled = true;
      this.fail('init', new Error('Web Audio is not available'));
      return;
    }
    const ctx = new Ctor();
    ctx.addEventListener('statechange', this.onStateChange);
    this.ctx = ctx;
    this.graph = buildGraph(ctx, this.musicVolume, this.sfxVolume);
    this.needsRebuild = false;
    if (this.muffled) this.graph.muffle.frequency.value = MUFFLE_CLOSED_HZ;
  }

  /** iOS only opens the output once something has been started inside a gesture. */
  private pokeOutput(ctx: AudioContext): void {
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    src.connect(ctx.destination);
    src.start(0);
  }

  private listen(): void {
    if (this.listening || typeof window === 'undefined') return;
    this.listening = true;
    const capture = { capture: true, passive: true } as const;
    for (const type of ['pointerup', 'touchend', 'click', 'keydown']) {
      window.addEventListener(type, this.onGesture, capture);
    }
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('pageshow', this.onVisibility);
    window.addEventListener('focus', this.onVisibility);
  }

  private readonly onGesture = (): void => {
    this.guard('gesture', () => {
      const ctx = this.ctx;
      if (!ctx || this.disabled) return;
      this.rebuildIfNeeded();
      // On iOS a touch's pointerdown isn't an activation; this tap's pointerup is what truly unlocks.
      const live = this.ctx;
      if (live && live.state !== 'running' && this.shouldRun()) this.pokeOutput(live);
      void this.tryResume();
    });
  };

  private readonly onVisibility = (): void => {
    this.guard('visibility', () => {
      this.hidden = document.visibilityState === 'hidden';
      this.applyRunState();
    });
  };

  private readonly onPageHide = (): void => {
    this.guard('pagehide', () => {
      this.hidden = true;
      this.applyRunState();
    });
  };

  private readonly onStateChange = (): void => {
    this.guard('statechange', () => {
      const ctx = this.ctx;
      if (!ctx) return;
      const state = ctx.state as string;
      if (state === 'running') {
        // iOS can resume by itself once a call ends, whether or not the game is paused.
        if (!this.shouldRun()) {
          ctx.suspend().catch(() => undefined);
          return;
        }
        this.retries = 0;
        this.clockMovedAt = performance.now();
        this.watchClock(ctx);
        this.flushQueue();
        this.syncMusic();
        this.syncLaser();
      } else if (state === 'closed') {
        this.needsRebuild = true;
      } else if (this.shouldRun()) {
        // 'suspended' or WebKit's 'interrupted' that we didn't ask for: a call, Siri, a route change.
        this.scheduleRetry();
      }
    });
  };

  private shouldRun(): boolean {
    return !this.appPaused && !this.hidden;
  }

  private applyRunState(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.shouldRun()) {
      this.retries = 0;
      void this.tryResume();
      void this.loadSfx();
      this.syncMusic();
    } else if (ctx.state === 'running') {
      ctx.suspend().catch(() => undefined);
    }
  }

  private tryResume(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx || !this.shouldRun()) return Promise.resolve();
    const state = ctx.state as string;
    if (state === 'closed') return Promise.resolve();
    this.watchClock(ctx);
    if (state === 'running') return Promise.resolve();
    this.resumeCalls++;
    // A resume during an interruption may never settle, so nothing downstream waits on it alone.
    return ctx.resume().catch(() => undefined);
  }

  private scheduleRetry(): void {
    if (this.retryTimer !== null || this.retries >= RESUME_RETRIES) return;
    this.retries++;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.guard('retry', () => {
        void this.tryResume();
        const state = this.ctx?.state as string | undefined;
        if (state && state !== 'running' && state !== 'closed' && this.shouldRun()) this.scheduleRetry();
      });
    }, RESUME_RETRY_MS);
  }

  /**
   * After a long interruption iOS can report 'running' with a frozen clock and no sound.
   * A pending check is left alone, or a child tapping steadily would postpone it forever.
   */
  private watchClock(ctx: AudioContext): void {
    if (this.clockTimer !== null) return;
    const before = ctx.currentTime;
    this.clockTimer = setTimeout(() => {
      this.clockTimer = null;
      if (ctx !== this.ctx || ctx.state !== 'running' || !this.shouldRun()) return;
      if (ctx.currentTime === before) {
        this.needsRebuild = true; // a new context needs a gesture, so the next tap does it
      } else {
        this.needsRebuild = false;
        this.rebuildDelay = REBUILD_MIN_MS;
        this.rebuildNotBefore = 0;
      }
    }, CLOCK_CHECK_MS);
  }

  /** Scheduling into frozen time would release everything at once when the clock thaws. */
  private clockStalled(ctx: AudioContext): boolean {
    const now = performance.now();
    if (ctx.currentTime !== this.clockSeen) {
      this.clockSeen = ctx.currentTime;
      this.clockMovedAt = now;
      return false;
    }
    return now - this.clockMovedAt > CLOCK_STALL_MS;
  }

  /** Backs off, because a dead output device kills each new context too. */
  private rebuildIfNeeded(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const closed = (ctx.state as string) === 'closed';
    if (!closed && !this.needsRebuild) return;
    const now = performance.now();
    if (!closed && now < this.rebuildNotBefore) return;
    this.rebuildNotBefore = now + this.rebuildDelay;
    this.rebuildDelay = Math.min(this.rebuildDelay * 2, REBUILD_MAX_MS);
    this.rebuild();
  }

  private rebuild(): void {
    const old = this.ctx;
    const loop = this.loop;
    const position = old && loop ? Math.max(0, old.currentTime - loop.startedAt) : 0;
    this.loop = null;
    this.laserVoice = null;
    this.voices = [];
    this.nextCoinAt = 0;
    this.duckUntil = 0;
    if (this.clockTimer !== null) clearTimeout(this.clockTimer);
    this.clockTimer = null;
    if (old) {
      old.removeEventListener('statechange', this.onStateChange);
      if ((old.state as string) !== 'closed') old.close().catch(() => undefined);
    }
    this.rebuilds++;
    this.createContext();
    if (!this.ctx) return;
    this.pokeOutput(this.ctx);
    if (loop) this.startLoop(loop.track, loop.buffer, position % loop.buffer.duration);
    this.syncLaser();
  }

  /** Fills in whatever is missing, so a render lost to a background freeze comes back later. */
  private async loadSfx(): Promise<void> {
    if (this.sfxLoading) return;
    this.sfxLoading = true;
    for (const name of SFX_NAMES) {
      if (this.sfxBuffers.has(name)) continue;
      try {
        this.sfxBuffers.set(name, await renderSfx(name));
        this.flushQueue();
      } catch (err) {
        this.fail(`render ${name}`, err);
      }
      await breathe();
    }
    try {
      if (this.ctx && !this.laserBuffer) this.laserBuffer = await renderLaser(this.ctx);
      this.syncLaser();
    } catch (err) {
      this.fail('render laser', err);
    }
    this.sfxLoading = false;
  }

  private flushQueue(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || this.clockStalled(ctx)) return;
    const now = performance.now();
    const pending = this.queue;
    this.queue = [];
    for (const item of pending) {
      if (now - item.at > QUEUE_MAX_AGE_MS) continue;
      const variants = this.sfxBuffers.get(item.name);
      if (variants) this.startVoice(ctx, item.name, variants, item.opts);
      else this.queue.push(item);
    }
  }

  private startVoice(ctx: AudioContext, name: SfxName, variants: AudioBuffer[], opts?: SfxOptions): void {
    const graph = this.graph;
    if (!graph) return;
    const now = ctx.currentTime;
    let when = now;
    let rate = finite(opts?.pitch, 1);

    if (name === 'coin') {
      const stepped = this.nextCoin(now);
      if (stepped === null) return;
      when = stepped.when;
      rate *= stepped.rate;
    } else {
      const last = this.lastPlayed.get(name);
      if (last !== undefined && now - last < RETRIGGER_S && now >= last) return;
      this.lastPlayed.set(name, now);
      if (JITTERED.has(name)) rate *= 0.98 + this.jitter() * 0.04;
    }

    const turn = this.roundRobin.get(name) ?? 0;
    this.roundRobin.set(name, turn + 1);
    const buffer = variants[turn % variants.length];
    if (!buffer) return;

    const limit = MAX_VOICES - (this.laserVoice ? 1 : 0);
    this.voices = this.voices.filter((v) => v.end > now);
    while (this.voices.length >= limit) this.evictQuietest(now);

    rate = Math.min(4, Math.max(0.25, rate));
    const level = Math.max(0, Math.min(1.5, finite(opts?.gain, 1)));
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = level;
    src.connect(gain);
    gain.connect(graph.sfxBus);
    src.onended = () => {
      src.disconnect();
      gain.disconnect();
    };
    src.start(when);

    this.voices.push({ src, gain, level, begin: when, end: when + buffer.duration / rate });
    this.peakVoices = Math.max(this.peakVoices, this.voices.length);
  }

  private nextCoin(now: number): { when: number; rate: number } | null {
    const nowMs = performance.now();
    if (nowMs - this.lastCoinMs > COIN_STREAK_MS) this.coinStep = 0;
    this.lastCoinMs = nowMs;
    this.coinTimes = this.coinTimes.filter((t) => nowMs - t < 1000);
    if (this.coinTimes.length >= COINS_PER_SECOND) {
      this.coinsDropped++;
      return null;
    }
    this.coinTimes.push(nowMs);
    const semitones = COIN_LADDER[Math.min(this.coinStep, COIN_LADDER.length - 1)] ?? 0;
    this.coinStep++;
    const when = Math.max(now, this.nextCoinAt);
    this.nextCoinAt = when + COIN_SPACING;
    const rate = 2 ** (semitones / 12);
    this.coinsPlayed++;
    this.lastCoinRate = rate;
    return { when, rate };
  }

  /** Whichever voice has the least left to give: loud-but-ending or quiet-from-the-start. */
  private evictQuietest(now: number): void {
    let index = 0;
    let lowest = Infinity;
    this.voices.forEach((v, i) => {
      const left = (v.end - now) / Math.max(v.end - v.begin, 1e-3);
      const score = v.level * Math.min(1, left);
      if (score < lowest) {
        lowest = score;
        index = i;
      }
    });
    const [voice] = this.voices.splice(index, 1);
    if (!voice) return;
    this.voicesEvicted++;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0, now, 0.008);
    voice.src.stop(now + 0.05);
  }

  private syncLaser(): void {
    const ctx = this.ctx;
    const graph = this.graph;
    if (!ctx || !graph) return;
    const t = ctx.currentTime;
    if (this.laserOn && !this.laserVoice && this.laserBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.laserBuffer;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain);
      gain.connect(graph.sfxBus);
      fade(gain.gain, 0, LASER_LEVEL, t, 0.09);
      src.start(t);
      this.laserVoice = { src, gain };
    } else if (!this.laserOn && this.laserVoice) {
      const { src, gain } = this.laserVoice;
      this.laserVoice = null;
      fade(gain.gain, gain.gain.value, 0, t, 0.14);
      src.onended = () => {
        src.disconnect();
        gain.disconnect();
      };
      src.stop(t + 0.16);
    }
  }

  private syncMusic(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const want = this.wanted;
    if (this.job && this.job.track !== want) this.job.cancelled = true;
    if (!want || this.loop?.track === want) return;
    const cached = this.trackCache.get(want);
    if (cached) {
      this.trackCache.delete(want);
      this.trackCache.set(want, cached);
      this.startLoop(want, cached, 0);
    } else if (!this.job) {
      this.renderMusic(want);
    }
  }

  private renderMusic(track: MusicTrack): void {
    const job: RenderJob = { track, cancelled: false };
    this.job = job;
    renderTrack(track, { isCancelled: () => job.cancelled })
      .then((buffer) => {
        this.job = null;
        if (buffer) this.storeTrack(track, buffer);
        this.syncMusic();
      })
      .catch((err: unknown) => {
        this.job = null;
        this.fail(`render ${track}`, err);
      });
  }

  private storeTrack(track: MusicTrack, buffer: AudioBuffer): void {
    this.trackCache.delete(track);
    this.trackCache.set(track, buffer);
    for (const key of this.trackCache.keys()) {
      if (this.trackCache.size <= MAX_CACHED_TRACKS) break;
      if (key !== track && key !== this.loop?.track && key !== this.wanted) this.trackCache.delete(key);
    }
  }

  private startLoop(track: MusicTrack, buffer: AudioBuffer, offset: number): void {
    const ctx = this.ctx;
    const graph = this.graph;
    if (!ctx || !graph) return;
    const t = ctx.currentTime + 0.02;
    this.releaseLoop(t, CROSSFADE);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain);
    gain.connect(graph.musicIn);
    fade(gain.gain, 0, 1, t, CROSSFADE);
    src.start(t, offset);
    this.loop = { track, src, gain, buffer, startedAt: t - offset };
  }

  private releaseLoop(at: number, seconds: number): void {
    const loop = this.loop;
    if (!loop) return;
    this.loop = null;
    const { src, gain } = loop;
    fade(gain.gain, gain.gain.value, 0, at, seconds);
    src.onended = () => {
      src.disconnect();
      gain.disconnect();
    };
    src.stop(at + seconds + 0.04);
  }
}
