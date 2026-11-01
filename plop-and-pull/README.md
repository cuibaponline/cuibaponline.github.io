# Plop & Pull

An offline fishing game for iPad, built from [`../plop-and-pull-game-spec.md`](../plop-and-pull-game-spec.md) and played
upright. Touch the sea to plop a soft swim ring down, then pull a friend up
the whole tall screen and watch it leap over the boat. Deeper friends take longer to pull and give more pearls, so the
screen's height is the game. Three levels open more of the sea, ending with Big Hum the whale.

A child can't fail: no touch is ever wrong, every cast brings something up, and every level ends at sunset with at least
one star. Nothing is random about a catch, nothing costs anything, and fish get a ride, a photo and a splash home.

Plain ES modules and Canvas 2D with no build step and no dependencies. All art is drawn in code and all audio is
synthesized, so the game has no asset files and makes no network calls of its own.

- `src/data.js` : every tuning number (levels, creatures, speeds, star lines)
- `src/strings.js` : every player-facing line, ready for a Vietnamese table
- `src/sim.js` : the rules, with no DOM, so they run in tests
- `src/input.js` : fingers to taps and holds, with no DOM. Wrist rest, palm filter, two-boat sides
- `src/save.js` : versioned `localStorage` save that falls back to defaults
- `src/art.js`, `src/render.js` : characters and the sea
- `src/audio.js` : sound effects and marimba music
- `src/screens.js`, `src/main.js` : menus, screen flow, game loop
- `sw.js` : offline cache. Bump `VERSION` when you add a file, and list it in `PRECACHE`

Run it: serve this folder with any static server, for example `npx serve .`.

Tests: `npm run test:plop`. Balance report from simulated players: `npm run balance:plop`.

Deployed by `.github/workflows/deploy.yml` to `/plop-and-pull/`.

## For grown-ups

- **Seating:** in two-boat mode, two children sit side by side with the iPad flat or on a stand, one on each half of the
  sea. They share one pearl jar and one sticker book. There is no winner.
- **Guided Access:** small palms can trigger system gestures. Settings > Accessibility > Guided Access keeps them in
  the game, and Add to Home Screen gives the full screen.
- **Grown-ups screen:** volume, a hold-to-reset for progress, and the game's canvas memory figure.
- **When the sun sets the round ends,** with no countdown and no warning, and the results wait for a tap. They never
  roll into another round, so it's a natural place to stop.

## Notes

- Portrait and sideways both play. iOS ignores the manifest's `orientation`, so a sideways iPad gets the same sea in a
  centred column between rock walls, plus a three-second nudge. Play is never blocked.
- `view.memoryBytes()` adds up the main canvas, the baked sea and the sprite cache. The budget is 64 MB, and the sea
  canvas is emptied as soon as it's replaced because Safari holds on to canvas memory.
- Friends are painted large so stickers stay sharp, then swim at `SEA_SCALE` in `data.js`. Changing it moves nothing in
  the rules, because tap reach comes from each friend's `radius`. `sizes.test.mjs` keeps them from crowding the sea.
- Star lines come from `tests/plop-and-pull/bot.mjs`. A random tapper should reach two stars, a masher should rarely
  reach three, and a child who picks deep friends and leans for hop-ons should reach three. `balance.test.mjs` enforces
  this, so change the lines in `data.js` and re-run it when the rules change.
- Nothing about a real child playing has been measured yet. The speeds and star lines are starting values.

Known limit: iOS can evict site data that goes unused for a long time. Installing to the Home Screen makes progress
more durable.
