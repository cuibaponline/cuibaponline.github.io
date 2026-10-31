// Procedural art: see types.ts for the contract with the renderer.

import type { ArtApi } from './types';
import { bakeShadow, bakeSprite, drawCreature } from './bake';
import { bakeCannon, drawCannonPreview } from './cannon';
import { bakeDigits, bakeFx } from './fx';
import { bakeCausticsTile, bakeOcean } from './ocean';
import { drawAppIcon, drawOtto } from './otto';

export { bakeCannon, bakeCausticsTile, bakeDigits, bakeFx, bakeOcean, bakeShadow, bakeSprite, drawAppIcon, drawCannonPreview, drawCreature, drawOtto };

export type * from './types';

export const art = {
  bakeSprite,
  bakeShadow,
  drawCreature,
  bakeOcean,
  bakeCausticsTile,
  bakeCannon,
  drawCannonPreview,
  bakeFx,
  bakeDigits,
  drawOtto,
  drawAppIcon,
} satisfies ArtApi;
