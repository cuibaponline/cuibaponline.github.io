import type { Simulation } from '../sim/simulation';

export interface InputDeps {
  sim(): Simulation | null;
  /** CSS pixels, relative to the canvas, to world units. */
  toWorld(cssX: number, cssY: number): { x: number; y: number };
  settings(): { controlMode: 'tap' | 'joystick'; leftHanded: boolean };
  /** Called so the HUD can draw the floating stick. Null hides it. */
  onStick(stick: { baseX: number; baseY: number; knobX: number; knobY: number } | null): void;
}

const STICK_RADIUS = 70;
const DEAD_ZONE = 0.12;

/**
 * Pointer events to simulation commands (10.1). Every finger is tracked by pointerId so aiming, Laser and Lock can
 * be held at once. HUD buttons sit above the canvas, so a touch that starts on one never reaches this class.
 */
export class InputSystem {
  private aimPointer: number | null = null;
  private stickPointer: number | null = null;
  private stickX = 0;
  private stickY = 0;
  private fireHeld = false;

  constructor(
    private readonly el: HTMLElement,
    private readonly deps: InputDeps,
  ) {
    el.addEventListener('pointerdown', this.down);
    el.addEventListener('pointermove', this.move);
    el.addEventListener('pointerup', this.up);
    el.addEventListener('pointercancel', this.up);
    el.addEventListener('lostpointercapture', this.up);
  }

  private point(e: PointerEvent): { cssX: number; cssY: number; world: { x: number; y: number } } {
    const rect = this.el.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    return { cssX, cssY, world: this.deps.toWorld(cssX, cssY) };
  }

  private down = (e: PointerEvent): void => {
    const sim = this.deps.sim();
    if (!sim) return;
    e.preventDefault();
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      // Capture is best effort; synthetic pointers in tests have no active pointer to capture.
    }
    const { cssX, cssY, world } = this.point(e);
    const tick = sim.tick;

    if (sim.s.bubblePop) {
      sim.enqueue({ tick, seatId: 0, type: 'PopBubble', x: world.x, y: world.y });
      return;
    }

    const seat = sim.localSeat;
    if (seat.lockMode && !sim.s.cfg.autoLock) sim.enqueue({ tick, seatId: 0, type: 'LockTarget', x: world.x, y: world.y });

    const { controlMode, leftHanded } = this.deps.settings();
    if (controlMode === 'joystick') {
      const width = this.el.clientWidth;
      const inZone = leftHanded ? cssX > width * (2 / 3) : cssX < width / 3;
      if (inZone && this.stickPointer === null) {
        this.stickPointer = e.pointerId;
        this.stickX = cssX;
        this.stickY = cssY;
        this.deps.onStick({ baseX: cssX, baseY: cssY, knobX: cssX, knobY: cssY });
      }
      return;
    }

    if (this.aimPointer !== null) return;
    this.aimPointer = e.pointerId;
    sim.enqueue({ tick, seatId: 0, type: 'Aim', x: world.x, y: world.y });
    sim.enqueue({ tick, seatId: 0, type: 'FireStart' });
  };

  private move = (e: PointerEvent): void => {
    const sim = this.deps.sim();
    if (!sim) return;
    const { cssX, cssY, world } = this.point(e);
    if (e.pointerId === this.aimPointer) {
      sim.enqueue({ tick: sim.tick, seatId: 0, type: 'Aim', x: world.x, y: world.y });
    } else if (e.pointerId === this.stickPointer) {
      const dx = cssX - this.stickX;
      const dy = cssY - this.stickY;
      const len = Math.hypot(dx, dy);
      const reach = Math.min(len, STICK_RADIUS);
      const ux = len > 0 ? dx / len : 0;
      const uy = len > 0 ? dy / len : 0;
      this.deps.onStick({ baseX: this.stickX, baseY: this.stickY, knobX: this.stickX + ux * reach, knobY: this.stickY + uy * reach });
      if (reach / STICK_RADIUS > DEAD_ZONE) {
        // Stick up is straight up; pulled below the horizon the angle clamps to the cannon's limit.
        const angle = Math.atan2(ux, -uy);
        sim.enqueue({ tick: sim.tick, seatId: 0, type: 'AimAngle', angle: Math.max(-Math.PI, Math.min(Math.PI, angle)) });
      }
    }
  };

  private up = (e: PointerEvent): void => {
    const sim = this.deps.sim();
    if (e.pointerId === this.aimPointer) {
      this.aimPointer = null;
      if (sim) sim.enqueue({ tick: sim.tick, seatId: 0, type: 'FireStop' });
    } else if (e.pointerId === this.stickPointer) {
      this.stickPointer = null;
      this.deps.onStick(null);
    }
  };

  /** The on-screen FIRE button in Joystick mode. */
  setFireButton(down: boolean): void {
    const sim = this.deps.sim();
    if (!sim || this.fireHeld === down) return;
    this.fireHeld = down;
    sim.enqueue({ tick: sim.tick, seatId: 0, type: down ? 'FireStart' : 'FireStop' });
  }

  /** Lets go of everything, e.g. when pausing with a finger still down. */
  release(): void {
    const sim = this.deps.sim();
    if (sim && (this.aimPointer !== null || this.fireHeld)) sim.enqueue({ tick: sim.tick, seatId: 0, type: 'FireStop' });
    this.aimPointer = null;
    this.stickPointer = null;
    this.fireHeld = false;
    this.deps.onStick(null);
  }
}
