# Lasso Ranch

An offline arcade game for iPad, built from [`../lasso-ranch-game-spec.md`](../lasso-ranch-game-spec.md).
Throw a lasso up a lane to catch ranch animals, reach the level target, then enjoy a Stampede bonus round.

Plain ES modules and Canvas 2D with no build step and no dependencies. All art is drawn in code and all audio
is synthesized, so the game has no asset files and makes no network calls of its own.

- `src/data.js` : every tuning number (levels, animals, difficulty, rewards)
- `src/strings.js` : every player-facing line, ready for a Vietnamese table
- `src/sim.js` : the rules, with no DOM, so they run in tests
- `src/save.js` : versioned `localStorage` save that falls back to defaults
- `src/art.js`, `src/render.js` : characters and the field
- `src/audio.js` : sound effects and banjo music
- `src/screens.js`, `src/main.js` : menus, screen flow, game loop
- `sw.js` : offline cache. Bump `VERSION` when you add a file, and list it in `PRECACHE`

Differences from the spec's suggested stack: no Phaser, TypeScript, Vite or Workbox, to match the other static
games in this repo. Sprites are generated at runtime. Tuning lives in a JS module instead of JSON.

Run it: serve this folder with any static server, for example `npx serve .`.

Tests: `npm run test:lasso`. Balance report from a simulated player: `npm run balance:lasso`.

Deployed by `.github/workflows/deploy.yml` to `/lasso-ranch/`.

Known limit: iOS can evict site data that goes unused for a long time. Installing to the Home Screen makes
progress more durable.
