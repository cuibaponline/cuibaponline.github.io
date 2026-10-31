import { CORE_H, CORE_W, type ViewRect } from '../sim/state';

export interface Layout {
  cssW: number;
  cssH: number;
  /** CSS pixels per design unit. */
  zoom: number;
  view: ViewRect;
}

/** Matches the compact media query in styles.css: the screens that get the smaller HUD. */
export const isCompact = (cssW: number, cssH: number): boolean => cssW <= 740 || cssH <= 500;

/** Centre of the compact HUD's bottom row above the safe area, where the cannon sits between the level buttons. */
const COMPACT_SEAT_CSS = 44;
const TAP_SLOP_CSS = 22;

/**
 * A landscape tablet always shows the whole 1920 x 1280 core and bleeds wider or taller to fill the screen (6.1).
 * Anything else shows the same world area in the screen's own shape, so fish stay a sensible size and just as dense
 * in portrait and on phones. Fitting the core there would shrink a fish to 12 CSS px.
 */
export function computeLayout(cssW: number, cssH: number, safeBottom = 0): Layout {
  const tabletLandscape = cssW > cssH && cssH >= 600;
  const zoom = tabletLandscape ? Math.min(cssW / CORE_W, cssH / CORE_H) : Math.sqrt((cssW * cssH) / (CORE_W * CORE_H));
  const halfW = cssW / zoom / 2;
  const halfH = cssH / zoom / 2;
  return {
    cssW,
    cssH,
    zoom,
    view: {
      left: CORE_W / 2 - halfW,
      right: CORE_W / 2 + halfW,
      top: CORE_H / 2 - halfH,
      bottom: CORE_H / 2 + halfH,
      seatInset: isCompact(cssW, cssH) ? (safeBottom + COMPACT_SEAT_CSS) / zoom : 96,
      tapSlop: Math.max(36, TAP_SLOP_CSS / zoom),
    },
  };
}
