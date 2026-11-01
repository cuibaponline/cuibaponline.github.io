import { laserFill } from '../sim/cannon';
import { damageFish } from '../sim/damage';
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
        caughtBySeat: sim?.s.stats.caughtBySeat ?? [],
        seats: (sim?.s.seats ?? []).map((seat) => ({ x: seat.x, y: seat.y, aimAngle: seat.aimAngle, fired: seat.lastFireTick >= 0, level: seat.level, autoFire: seat.autoFire })),
        bossMaxHp: sim?.s.boss?.maxHp ?? 0,
        fps: app.world.fps,
        fish: (sim?.s.fish ?? [])
          .filter((f) => f.state === 'swim')
          .map((f) => ({
            id: f.def.id,
            tier: f.def.tier,
            scale: f.scale,
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
    setWave(wave: number) {
      const s = app.session?.sim.s;
      if (s) s.wave = wave;
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
    catchFor(seat: number) {
      const s = app.session?.sim.s;
      const fish = s?.fish.find((f) => f.state === 'swim');
      if (s && fish) damageFish(s, fish, fish.hp + 1, seat);
    },
    fillLasers() {
      const s = app.session?.sim.s;
      if (s) for (const seat of s.seats) seat.laserMeter = laserFill(s);
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
