import { AudioService } from '../services/audio';
import { bootStep } from '../services/bootLog';
import type { Difficulty } from '../config';
import { shouldSuggestMedium, syncProgress, unlocksForLevel } from '../economy/economy';
import { GameSession, type SessionResults, type WaveSummary } from '../game/session';
import { InputSystem } from '../input/input';
import { isCompact } from '../render/layout';
import { World } from '../render/world';
import { holdSingleInstance, mayReloadAfterContextLoss } from '../services/guard';
import { ParentalService } from '../services/parental';
import { initPwa } from '../services/pwa';
import { createIdbStorage, requestPersistentStorage, SaveService } from '../services/save';
import { isSetupComplete } from '../services/saveSchema';
import { speak, stopSpeaking } from '../services/speech';
import type { OceanId, SkinId } from '../art/types';
import { SPRITE_IDS } from '../render/assets';
import { Simulation } from '../sim/simulation';
import { h } from './dom';
import { Hud } from './hud';
import { blockedScreen, parentScreen, pinGateScreen, saveErrorScreen, wizardScreen } from './parent';
import { homeScreen, intermissionScreen, pauseScreen, resultsScreen, titleScreen } from './screens';

type Screen<A> = (app: App, arg: A) => HTMLElement;

const nextFrame = (): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, 0));

export class App {
  readonly audio = new AudioService();
  readonly save = new SaveService({ storage: createIdbStorage(), onError: (e) => bootStep(`SAVE FAILED ${String(e)}`) });
  parental!: ParentalService;
  world!: World;
  hud!: Hud;
  private input!: InputSystem;
  session: GameSession | null = null;
  /** How many play next. Starts at one each launch, so a solo player never lands in a split game. */
  players: 1 | 2 = 1;
  private attract!: Simulation;
  private readonly ui = document.getElementById('ui') as HTMLElement;
  private readonly stage = document.getElementById('stage') as HTMLElement;
  private screenEl: HTMLElement | null = null;
  private dialogEl: HTMLElement | null = null;
  private leaveFns: (() => void)[] = [];
  private tapped = false;
  private inParentZone = false;
  private wrapUpPending = false;
  private saveUnreadable = false;
  /** Set once the GL context is gone for good: nothing may cover the rest screen or count as play time. */
  private halted = false;
  private ticker = 0;

  async boot(): Promise<void> {
    initPwa();
    this.lockDownBrowser();
    const fill = document.getElementById('boot-fill') as HTMLElement;

    const notice = h('div', { class: 'boot-note' });
    await holdSingleInstance(() => {
      notice.textContent = 'Bubble Reef is open in another tab. Close it to play here.';
      document.getElementById('boot')?.append(notice);
    });
    notice.remove();

    this.saveUnreadable = (await this.save.load()).status === 'unavailable';
    bootStep('save loaded');
    this.parental = new ParentalService(
      this.save,
      { wallNow: () => Date.now(), monoNow: () => performance.now() },
      { visible: document.visibilityState === 'visible' },
    );
    // Attached before the slow boot steps, so hiding the app during them can't credit play time.
    document.addEventListener('visibilitychange', () => this.onVisibility());
    void requestPersistentStorage();
    this.parental.on('warning', (minutes) => this.onWarning(minutes));
    this.parental.on('limit', () => this.onLimit());
    this.parental.on('parentZoneExpired', () => this.closeParentZone());
    this.save.update((d) => void syncProgress(d.profile));

    this.world = await World.create(this.stage, {
      onEvents: (events) => this.session?.onEvents(events),
      onCoinArrive: (coins) => {
        this.hud.addCoins(coins);
        this.audio.sfx('coin');
      },
      onFrame: (dt) => this.session?.frame(dt),
      onContextLost: () => void this.onContextLost(),
    });

    bootStep('phaser ready');
    const steps = this.world.assets.bootSteps();
    let done = 0;
    const total = steps.length + 2;
    for (const step of steps) {
      bootStep(`art ${SPRITE_IDS[done] ?? `effects ${done}`}`);
      step();
      fill.style.width = `${(++done / total) * 100}%`;
      await nextFrame();
      if (this.halted) return;
    }

    bootStep('art done');
    this.world.build();
    bootStep('world built');
    const { profile } = this.save.get();
    this.world.setOcean((profile.unlockedOceans[0] ?? 'coral') as OceanId);
    fill.style.width = `${(++done / total) * 100}%`;
    await nextFrame();
    this.world.setSkin(profile.selectedSkin as SkinId);
    this.applySettings();

    this.attract = this.newAttract();
    this.world.setSim(this.attract, false);

    this.hud = new Hud({
      pause: () => this.session?.actions().pause(),
      lock: (seat) => this.session?.actions().lock(seat),
      auto: (seat) => this.session?.actions().auto(seat),
      laser: (seat) => this.session?.actions().laser(seat),
      levelUp: (seat) => this.session?.actions().levelUp(seat),
      levelDown: (seat) => this.session?.actions().levelDown(seat),
      fire: (down) => this.session?.actions().fire(down),
    });
    this.ui.append(this.hud.root);

    this.input = new InputSystem(this.stage, {
      sim: () => (this.session && !this.session.paused ? this.session.sim : null),
      toWorld: (x, y) => this.world.toWorld(x, y),
      settings: () => this.save.get().settings,
      onStick: (stick) => this.hud.setStick(stick),
    });

    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('pagehide', () => void this.parental.flush());
    window.matchMedia('(orientation: portrait)').addEventListener('change', () => {
      this.pause();
      this.onResize();
    });
    document.addEventListener('pointerdown', (e) => this.onAnyPress(e), { capture: true });
    this.ticker = window.setInterval(() => {
      this.parental.tick();
      if (this.session) this.syncTimer();
    }, 1000);

    document.getElementById('boot')?.remove();
    this.route();
    bootStep('boot finished');
    if (import.meta.env.VITE_E2E) (await import('../game/e2eHooks')).installE2eHooks(this);
  }

  private newAttract(): Simulation {
    return new Simulation({
      difficulty: 'easy', seed: 7, view: this.world.currentLayout.view, unlocks: unlocksForLevel(1), attract: true,
    });
  }

  private lockDownBrowser(): void {
    const stop = (e: Event): void => e.preventDefault();
    document.addEventListener('gesturestart', stop);
    document.addEventListener('gesturechange', stop);
    document.addEventListener('dblclick', stop);
    document.addEventListener('contextmenu', stop);
    document.addEventListener(
      'touchmove',
      (e) => {
        if (!(e.target as Element).closest('.scroll, .screen, .dialog, input[type=range]')) e.preventDefault();
      },
      { passive: false },
    );
    // iOS only applies :active feedback when a touch listener exists.
    document.addEventListener('touchstart', () => {}, { passive: true });
  }

  private onAnyPress(e: PointerEvent): void {
    void this.audio.unlock();
    const target = e.target as Element;
    if (target.closest('button') && !target.closest('.hud')) this.audio.sfx('buttonTap');
    this.parental.parentActivity();
  }

  private onResize(): void {
    this.world.resize();
    const point = this.hud.coinPoint();
    this.world.setCoinTarget(point.x, point.y);
  }

  /** GL state can't be rebuilt from the freed art canvases, so the page reloads, with a stop in case it keeps happening. */
  private async onContextLost(): Promise<void> {
    await Promise.race([this.save.flush(), new Promise((resolve) => window.setTimeout(resolve, 300))]);
    let storage: Storage | null = null;
    try {
      storage = window.sessionStorage;
    } catch {
      // Blocked storage: treated below as being unable to count reloads.
    }
    if (storage && mayReloadAfterContextLoss(storage, Date.now())) {
      location.reload();
      return;
    }
    bootStep('giving up after repeated context loss');
    this.halted = true;
    window.clearInterval(this.ticker);
    this.parental.setVisible(false);
    this.audio.pause();
    document.getElementById('boot')?.remove();
    this.ui.append(h('div', { class: 'screen deep center', id: 'out-of-memory' }, h('h2', {}, 'Bubble Reef needs a rest'), h('p', {}, 'Close some other apps, then open the game again.')));
  }

  private onVisibility(): void {
    if (this.halted) return;
    const visible = document.visibilityState === 'visible';
    this.parental.setVisible(visible);
    if (visible) {
      this.audio.resume();
    } else {
      this.audio.pause();
      this.pause();
      void this.save.flush();
    }
  }

  /* ---------- Screens ---------- */

  show<A>(screen: Screen<A>, arg: A): void;
  show(screen: Screen<undefined>): void;
  show<A>(screen: Screen<A>, arg?: A): void {
    if (this.halted) return;
    this.leave();
    const el = screen(this, arg as A);
    this.screenEl = el;
    this.ui.append(el);
    this.world.setAsleep(el.matches('.deep, .sleep'));
  }

  private leave(): void {
    for (const fn of this.leaveFns) fn();
    this.leaveFns = [];
    this.screenEl?.remove();
    this.screenEl = null;
    this.world.setAsleep(false);
    this.closeDialog();
    stopSpeaking();
  }

  onLeave(fn: () => void): void {
    this.leaveFns.push(fn);
  }

  private closeDialog(): void {
    this.dialogEl?.remove();
    this.dialogEl = null;
  }

  dialog(build: (close: () => void) => HTMLElement): void {
    this.closeDialog();
    const close = (): void => this.closeDialog();
    this.dialogEl = h('div', { class: 'dialog' }, build(close));
    this.ui.append(this.dialogEl);
  }

  confirm(title: string, text: string, yes: () => void): void {
    this.dialog((close) =>
      h(
        'div',
        { class: 'panel' },
        h('h2', {}, title),
        h('div', {}, text),
        h(
          'div',
          { class: 'row' },
          h('button', { class: 'btn coral small', id: 'confirm-yes', onTap: () => (close(), yes()) }, 'Yes'),
          h('button', { class: 'btn ghost small', onTap: close }, 'No'),
        ),
      ),
    );
  }

  /** Decides where the app belongs right now. */
  route(): void {
    if (this.session) return;
    // A failed read looks like a first run, and the wizard would let a child set their own PIN.
    if (this.saveUnreadable) {
      this.show(saveErrorScreen);
      return;
    }
    if (!isSetupComplete(this.save.get())) {
      this.show(wizardScreen);
      return;
    }
    const status = this.parental.status();
    if (!status.allowed) {
      this.audio.playMusic('lullaby');
      this.show(blockedScreen);
      return;
    }
    this.audio.playMusic('menu');
    this.show(this.tapped ? homeScreen : titleScreen);
  }

  onFirstTap(): void {
    bootStep('first tap');
    this.tapped = true;
    void this.audio.unlock();
    this.route();
  }

  /** False when the PIN could not be stored. Plain http:// has no WebCrypto, so setup throws there. */
  async finishSetup(pin: string, code: string, dailyLimitMin: number | null): Promise<boolean> {
    const result = await this.parental
      .setupParent({ pin, confirmPin: pin, recoveryCode: code, dailyLimitMin })
      .catch(() => null);
    // already-set is a retry: the PIN reached memory last time, but saving it failed.
    if (!result?.ok && result?.error !== 'already-set') return false;
    if (!result.ok) await this.parental.updateSettings({ dailyLimitMin });
    await this.save.saveNow();
    if (this.save.saveError) return false;
    await requestPersistentStorage();
    this.route();
    return true;
  }

  applyAudioSettings(): void {
    const { musicVolume, sfxVolume } = this.save.get().settings;
    this.audio.setMusicVolume(musicVolume);
    this.audio.setSfxVolume(sfxVolume);
  }

  applySettings(): void {
    this.applyAudioSettings();
    this.world.setReduceFlashing(this.save.get().settings.reduceFlashing);
  }

  speak(text: string): void {
    speak(text);
  }

  /* ---------- Playing ---------- */

  /** Two pairs of hands need a tablet: a phone has no room for a second set of buttons. */
  get roomForTwo(): boolean {
    const { cssW, cssH } = this.world.currentLayout;
    return !isCompact(cssW, cssH);
  }

  startGame(difficulty: Difficulty): void {
    if (!this.parental.status().allowed) {
      this.route();
      return;
    }
    this.save.update((d) => {
      d.settings.lastDifficulty = difficulty;
    });
    this.beginSession(difficulty);
  }

  private beginSession(difficulty: Difficulty): void {
    bootStep(`game starting: ${difficulty}`);
    this.leave();
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
    const players = this.players === 2 && this.roomForTwo ? 2 : 1;
    // Blue and red tell the players apart, so the Workshop skin only applies to one player.
    this.world.setCannonSkins(players === 2 ? ['classic', 'red'] : [this.save.get().profile.selectedSkin as SkinId]);
    const session = new GameSession(
      {
        world: this.world, hud: this.hud, input: this.input, audio: this.audio, save: this.save,
        onPause: () => this.pause(),
        onWaveComplete: (summary) => this.onWaveComplete(summary),
        onEnded: (results) => this.onSessionEnded(results),
      },
      difficulty,
      seed,
      players,
    );
    this.session = session;
    this.world.setOcean(session.currentOcean, true);
    session.prepareOceans();
    this.world.setSim(session.sim, true);
    this.world.setPaused(false);
    this.hud.show(true);
    const point = this.hud.coinPoint();
    this.world.setCoinTarget(point.x, point.y);
    this.audio.playMusic(session.oceanTrack);
    this.syncTimer();
  }

  private syncTimer(): void {
    const status = this.parental.status();
    const show = this.save.get().parental.showTimerToChild && status.remainingSec !== null;
    this.hud.setTimer(show ? Math.ceil((status.remainingSec ?? 0) / 60) : null);
  }

  pause(): void {
    const session = this.session;
    if (!session || session.paused || session.atIntermission) return;
    // Before `paused` is set: the input system can only send FireStop to a running sim.
    this.input.release();
    session.paused = true;
    this.world.setPaused(true);
    this.audio.setLaser(false);
    this.show(pauseScreen);
  }

  resume(): void {
    const session = this.session;
    if (!session) return;
    session.paused = false;
    this.world.setPaused(false);
    this.leave();
    if (session.sim.s.seats.some((seat) => seat.laserT > 0)) this.audio.setLaser(true);
  }

  private onWaveComplete(summary: WaveSummary): void {
    const { dayKey } = this.parental.status();
    const { save } = this;
    const session = this.session;
    if (!session) return;
    const locked = save.get().parental.difficultyLock !== null;
    const suggest = session.difficulty === 'easy' && shouldSuggestMedium(save.get().profile, dayKey, locked);
    if (suggest) {
      save.update((d) => {
        d.profile.lastMediumPromptDay = dayKey;
      });
    }
    this.show(intermissionScreen, { summary, suggestMedium: suggest });
  }

  keepPlaying(): void {
    this.leave();
    this.session?.keepPlaying();
  }

  takeBreak(): void {
    this.leave();
    this.session?.finish();
  }

  switchToMedium(): void {
    this.leave();
    const session = this.session;
    if (!session) return;
    this.wrapUpPending = false;
    this.session = null;
    session.finish();
    this.beginSession('medium');
  }

  quitToResults(): void {
    const session = this.session;
    if (!session) return;
    session.paused = false;
    this.world.setPaused(false);
    this.leave();
    session.finish();
  }

  private onSessionEnded(results: SessionResults): void {
    if (this.session === null) return;
    this.session = null;
    this.hud.show(false);
    this.world.setSim(this.attract, false);
    this.world.setPaused(false);
    if (this.wrapUpPending) {
      this.wrapUpPending = false;
      this.parental.wrapUpFinished();
    }
    this.audio.playMusic('menu');
    this.show(resultsScreen, { results, then: () => this.route() });
  }

  private onWarning(minutes: number): void {
    this.audio.sfx('warningChime');
    if (this.session) {
      this.hud.toast(minutes === 1 ? '1 minute left!' : `${minutes} minutes left!`, 'point');
    }
    this.syncTimer();
  }

  /** A limit was reached (13.4): wrap up if playing, otherwise go straight to the sleeping screen. */
  private onLimit(): void {
    if (this.session) {
      this.wrapUpPending = true;
      if (this.session.atIntermission) {
        this.leave();
        this.session.finish();
      } else {
        this.session.beginLastCatch();
      }
      return;
    }
    this.parental.wrapUpFinished();
    if (!this.inParentZone) this.route();
  }

  /* ---------- Parent Zone ---------- */

  openParentZone(): void {
    this.show(pinGateScreen, () => {
      this.inParentZone = true;
      this.parental.enterParentZone();
      this.show(parentScreen);
    });
  }

  closeParentZone(): void {
    if (!this.inParentZone) return;
    this.inParentZone = false;
    this.parental.exitParentZone();
    this.route();
  }

  afterReset(): void {
    this.world.setSkin('classic');
    this.show(parentScreen);
  }
}
