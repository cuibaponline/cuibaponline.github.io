import { CONFIG } from '../config';
import { isUpright, type Fish, type SimState } from './state';

const puffMul = CONFIG.powerups.puff.hitboxMul;

/** Scale applied to a fish's hit circles right now. */
export function hitScale(s: SimState, f: Fish): number {
  return s.cfg.hitboxScale * f.scale * (f.puff > 0 ? puffMul : 1);
}

/** Calls `visit` for each world-space hit circle. Return true to stop early. */
export function forEachCircle(s: SimState, f: Fish, visit: (x: number, y: number, r: number) => boolean): boolean {
  const scale = hitScale(s, f);
  const upright = isUpright(f.def.id);
  const cos = Math.cos(f.heading);
  const sin = Math.sin(f.heading);
  for (const [cx, cy, cr] of f.def.hitCircles) {
    const ox = cx * scale;
    const oy = cy * scale;
    const wx = upright ? ox * f.face : ox * cos - oy * sin;
    const wy = upright ? (f.turned ? -oy : oy) : ox * sin + oy * cos;
    if (visit(f.x + wx, f.y + wy, cr * scale)) return true;
  }
  const chain = f.def.chain;
  if (chain) {
    const r = chain.radius * scale;
    for (let i = 0; i < f.chainX.length; i++) {
      if (visit(f.chainX[i]!, f.chainY[i]!, r)) return true;
    }
  }
  return false;
}

export function touchesCircle(s: SimState, f: Fish, x: number, y: number, r: number): boolean {
  return forEachCircle(s, f, (cx, cy, cr) => {
    const dx = cx - x;
    const dy = cy - y;
    const reach = cr + r;
    return dx * dx + dy * dy <= reach * reach;
  });
}

/** Does the fish touch a beam of half-width `half` from (x, y) along unit (dx, dy)? */
export function touchesBeam(s: SimState, f: Fish, x: number, y: number, dx: number, dy: number, half: number): boolean {
  return forEachCircle(s, f, (cx, cy, cr) => {
    const rx = cx - x;
    const ry = cy - y;
    const along = rx * dx + ry * dy;
    if (along < 0) return false;
    const across = Math.abs(rx * dy - ry * dx);
    return across <= cr + half;
  });
}

export function rebuildGrid(s: SimState): void {
  s.grid.clear();
  for (const f of s.fish) {
    if (f.state !== 'swim') continue;
    forEachCircle(s, f, (x, y, r) => {
      s.grid.insert(f, x, y, r);
      return false;
    });
  }
}
