import type { App } from '../ui/app';

/** Test-only window hooks. The dynamic import in app.ts is compiled out unless built with --mode e2e. */
export function installE2eHooks(app: App): void {
  (window as unknown as { __br: unknown }).__br = {
    state() {
      const session = app.session;
      const sim = session?.sim;
      const layout = app.world.currentLayout;
      return {
        screen: document.querySelector('.screen')?.id ?? '',
        coins: app.save.get().profile.coins,
        shots: sim?.s.stats.shots ?? 0,
        caught: sim?.s.stats.caught ?? 0,
        level: app.save.get().profile.level,
        phase: sim?.s.phase ?? null,
        fps: app.world.fps,
        fish: (sim?.s.fish ?? [])
          .filter((f) => f.state === 'swim')
          .map((f) => ({
            id: f.def.id,
            tier: f.def.tier,
            x: f.x,
            y: f.y,
            cssX: (f.x - layout.view.left) * layout.zoom,
            cssY: (f.y - layout.view.top) * layout.zoom,
          })),
      };
    },
    setUsed(sec: number) {
      const key = app.parental.status().dayKey;
      app.save.update((d) => {
        d.usage.days[key] = { activeSec: sec, sessions: d.usage.days[key]?.sessions ?? 1 };
      });
    },
    setXp(xp: number) {
      app.save.update((d) => {
        d.profile.xp = xp;
      });
    },
    giveCoins(n: number) {
      app.save.update((d) => {
        d.profile.coins += n;
      });
    },
    endWave() {
      const s = app.session?.sim.s;
      if (!s) return;
      s.phase = 'transition';
      s.phaseT = 10;
    },
    setControlMode(mode: 'tap' | 'joystick') {
      app.save.update((d) => {
        d.settings.controlMode = mode;
      });
    },
    startBreak(sec: number) {
      app.save.update((d) => {
        d.usage.breakUntil = Date.now() + sec * 1000;
      });
    },
    skipPhase() {
      const s = app.session?.sim.s;
      if (s) s.phaseT = 1e4;
    },
    audio: () => app.audio.stats(),
    flush: () => app.save.saveNow(),
    tick: () => app.parental.tick(),
  };
}
