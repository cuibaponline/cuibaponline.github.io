// Turns raw fingers into taps and holds, with no DOM so it runs in tests. Works in world units.
import { INPUT, WORLD } from './data.js';

export class TouchRouter {
  constructor({ players, bottom }) {
    this.players = players;
    this.bottom = bottom;
    this.fingers = new Map();
    this.last = null;
  }

  // Returns the tap to send to the round, or null for a resting wrist or a palm rolling on.
  down(id, x, y, now) {
    if (y > this.bottom - INPUT.deadZone) return null;
    const same = this.last !== null
      && now - this.last.at < INPUT.sameTouchMs
      && Math.hypot(x - this.last.x, y - this.last.y) < INPUT.sameTouchGap;
    const boat = same ? this.last.boat : this.boatAt(x);
    this.fingers.set(id, { boat, x });
    this.last = { at: now, x, y, boat };
    return same ? null : { boat, x, y };
  }

  boatAt(x) {
    return this.players === 2 && x >= WORLD.halfway ? 1 : 0;
  }

  // A finger keeps the boat it started on, however far it drags. Moving it makes it the newest for leaning.
  move(id, x) {
    const finger = this.fingers.get(id);
    if (!finger) return;
    finger.x = x;
    this.fingers.delete(id);
    this.fingers.set(id, finger);
  }

  up(id) {
    this.fingers.delete(id);
  }

  reset() {
    this.fingers.clear();
    this.last = null;
  }

  holds() {
    const holds = Array.from({ length: this.players }, () => ({ count: 0, leanX: null }));
    for (const finger of this.fingers.values()) {
      holds[finger.boat].count += 1;
      holds[finger.boat].leanX = finger.x;
    }
    return holds;
  }
}
