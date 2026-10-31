export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Shortest signed turn from a to b, in (-PI, PI]. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

export function rotateToward(from: number, to: number, maxStep: number): number {
  const d = angleDelta(from, to);
  if (Math.abs(d) <= maxStep) return to;
  return from + Math.sign(d) * maxStep;
}

/** Cannon angles are measured from straight up, positive to the right. */
export const cannonDirX = (angle: number): number => Math.sin(angle);
export const cannonDirY = (angle: number): number => -Math.cos(angle);
export const angleToPoint = (fromX: number, fromY: number, x: number, y: number): number => Math.atan2(x - fromX, fromY - y);

/** Interpolates an angle the short way round. */
export const lerpAngle = (from: number, to: number, t: number): number => from + angleDelta(from, to) * t;
