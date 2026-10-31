import { AudioService } from '../services/audio';
import type { Difficulty } from '../config';
import { shouldSuggestMedium, syncProgress, unlocksForLevel } from '../economy/economy';
import { GameSession, type SessionResults, type WaveSummary } from '../game/session';
import { InputSystem } from '../input/input';
import { World } from '../render/world';
import { ParentalService } from '../services/parental';
import { initPwa } from '../services/pwa';
import { createIdbStorage, requestPersistentStorage, SaveService } from '../services/save';
import { isSetupComplete } from '../services/saveSchema';
import { speak, stopSpeaking } from '../services/speech';
import type { OceanId, SkinId } from '../art/types';
import { Simulation } from '../sim/simulation';
import { h } from './dom';
import { Hud } from './hud';
import { blockedScreen, parentScreen, pinGateScreen, saveErrorScreen, wizardScreen } from './parent';
import { homeScreen, intermissionScreen, pauseScreen, resultsScreen, titleScreen } from './screens';

type Screen<A> = (app: App, arg: A) => HTMLElement;

const nextFrame = (): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, 0));

export class App {
  readonly audio = new AudioService();
  readonly save = new SaveService({ storage: createIdbStorage() });
  parental!: ParentalService;
  world!: World;
  hud!: Hud;
  private input!: InputSystem;
  session: GameSession | null = null;
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

  async boot(): Promise<void> {
    initPwa();
    this.lockDownBrowser();
    const fill = document.getElementById('boot-fill') as HTMLElement;

    this.saveUnreadable = (await this.save.load()).status === 'unavailable';
    this.parental = new ParentalService(this.save, {
      wallNow: () => Date.now(),
      monoNow: () => performance.now(),
    });
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
    });

    const steps = this.world.assets.bootSteps();
    let done = 0;
    const total = steps.length + 2;
    for (const step of steps) {
      step();
      fill.style.width = `${(++done / total) * 100}%`;
      await nextFrame();
    }

    this.world.build();
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
      lock: () => this.session?.actions().lock(),
      auto: () => this.session?.actions().auto(),
      laser: () => this.session?.actions().laser(),
      levelUp: () => this.session?.actions().levelUp(),
      levelDown: () => this.session?.actions().levelDown(),
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
    document.addEventListener('visibilitychange', () => this.onVisibility());
    window.addEventListener('pagehide', () => void this.parental.flush());
    window.matchMedia('(orientation: portrait)').addEventListener('change', (e) => {
      if (e.matches) this.pause();
    });
    document.addEventListener('pointerdown', (e) => this.onAnyPress(e), { capture: true });
    window.setInterval(() => {
      this.parental.tick();
      if (this.session) this.syncTimer();
    }, 1000);

    document.getElementById('boot')?.remove();
    this.route();
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
        if (!(e.target as Element).closest('.scroll, input[type=range]')) e.preventDefault();
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

  private onVisibility(): void {
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
    this.leave();
    const el = screen(this, arg as A);
    this.screenEl = el;
    this.ui.append(el);
  }

  private leave(): void {
    for (const fn of this.leaveFns) fn();
    this.leaveFns = [];
    this.screenEl?.remove();
    this.screenEl = null;
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
    this.tapped = true;
    void this.audio.unlock();
    this.route();
  }

  /** False when the PIN could not be stored. Plain http:// has no WebCrypto, so setup throws there. */
  async finishSetup(pin: string, code: string, dailyLimitMin: number | null): Promise<boolean> {
    const result = await this.parental
      .setupParent({ pin, confirmPin: pin, recoveryCode: code, dailyLimitMin })
      .catch(() => null);
    if (!result?.ok) return false;
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
    this.leave();
    const seed = crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
    const session = new GameSession(
      {
        world: this.world, hud: this.hud, input: this.input, audio: this.audio, save: this.save,
        onPause: () => this.pause(),
        onWaveComplete: (summary) => this.onWaveComplete(summary),
        onEnded: (results) => this.onSessionEnded(results),
      },
      difficulty,
      seed,
    );
    this.session = session;
    for (const ocean of this.save.get().profile.unlockedOceans) this.world.prepareOcean(ocean as OceanId);
    this.world.setOcean(session.currentOcean, true);
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
    if (session.sim.localSeat.laserT > 0) this.audio.setLaser(true);
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
    this.world.setOcean((this.save.get().profile.unlockedOceans[0] ?? 'coral') as OceanId, true);
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
