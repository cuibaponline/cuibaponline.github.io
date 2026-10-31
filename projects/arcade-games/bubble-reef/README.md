# Bubble Reef

A kid-friendly, offline fish-catching game for iPad, built from the Bubble Reef GDD/BRD (`§` references below point to it).
Touch the water to fire bubbles, catch fish in nets, fill the Fish Book and unlock new oceans. Shots are free,
catches are decided by fish HP rather than dice, and coins only ever buy cosmetic cannon skins.

Play it at `https://cuibaponline.github.io/bubble-reef/`, then use Share > Add to Home Screen on the iPad.

## Stack

TypeScript (strict), Phaser 3 (WebGL), Vite, `vite-plugin-pwa`, IndexedDB via `idb-keyval`, Zod, Vitest, Playwright.
Fredoka is bundled from npm, so there are no runtime network requests.

There are no image or sound files. All art is drawn with Canvas 2D at boot and uploaded as textures, and all music
and sound effects are synthesized with Web Audio. This replaces the GDD's pre-rendered sprites and audio sprites.

## Layout

- `config/*.json` : every balance number, validated with Zod at load (`src/config`)
- `src/sim/` : the game rules as plain data, a fixed 60 Hz step and a seeded PRNG, with no Phaser in it. Players
  act through commands (`{ tick, seatId, type }`), so online seats and replays can be added later
- `src/economy/` : points, coins, XP, levels, unlocks, Fish Book, skins
- `src/render/` : Phaser view of the simulation, with interpolation, effects and dynamic resolution
- `src/art/` : procedural creatures, oceans, cannons, effects and Captain Otto
- `src/ui/` : DOM menus, HUD, Parent Zone
- `src/services/` : save (dual-slot), parental limits, PIN hashing, audio, read-aloud, PWA
- `tools/` : dev-only pages for reviewing art and audio

## Commands

```sh
npm install
npm run dev            # dev server; open it from the iPad using the Network URL
npm test               # simulation, economy, save and parental tests
npm run test:coverage  # the same, with a 70 % line-coverage gate (NFR-09). Audio is excluded: it needs a browser
npm run test:e2e       # WebKit at both iPad sizes
npm run build          # type check and production build to dist/
```

PIN hashing needs WebCrypto, which browsers only offer over HTTPS or on localhost. On an iPad, test against the
deployed site rather than the dev server's Network URL once you reach the setup wizard.

`.github/workflows/deploy.yml` runs the tests and build on every push to `master`, and a failure stops the deploy.

## Decisions that differ from the GDD

- Locked bubbles fly past other fish to reach their target. §6.4 says a bubble bursts on any fish, but then a school
  could absorb every shot aimed at a boss, which undoes US-06. The arcade cabinet behaves this way too.
- `waves.json` holds the parade timeline and `bosses.json`, `specialsCommon.json` hold boss and special-fish data,
  alongside the files named in §17.5.
- A special fish's shared stats and hit circles are tuned to the drawn art rather than to a sprite sheet.
- A new version takes over at the next launch instead of waiting for a parent to apply it (§17.8). Waiting would trap
  any build that crashes before the Parent Zone can open.
- Phaser's preFX, postFX and canvas MSAA are switched off. On an iPad screen the FX pipelines alone reserve over 800 MB
  of render targets, which crashes Safari and can restart the iPad. Leave them off unless the game really needs them.
- Music loops run 55 to 65 s instead of 90 to 120 s, which keeps each decoded track near 5 MB.

Not built: Captain Otto's Aquarium (§12.5, US-26), a Could item for Phase 3.
