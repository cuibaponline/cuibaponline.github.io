import { CORE_H, CORE_W, type ViewRect } from '../sim/state';

export interface Layout {
  cssW: number;
  cssH: number;
  /** CSS pixels per design unit. */
  zoom: number;
  view: ViewRect;
}

/** The 1920 x 1280 core is always fully visible; the world bleeds wider or taller to fill the screen (6.1). */
export function computeLayout(cssW: number, cssH: number): Layout {
  const zoom = Math.min(cssW / CORE_W, cssH / CORE_H);
  const halfW = cssW / zoom / 2;
  const halfH = cssH / zoom / 2;
  return {
    cssW,
    cssH,
    zoom,
    view: { left: CORE_W / 2 - halfW, right: CORE_W / 2 + halfW, top: CORE_H / 2 - halfH, bottom: CORE_H / 2 + halfH },
  };
}
