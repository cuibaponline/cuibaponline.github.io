# Little Color Lab

Nine bilingual (English + Vietnamese) color science games for young kids, built with three.js.
Open `index.html` for the home page.

Colors in water
- `color-dancing/` : water, dish soap and food coloring
- `walking-water/` : paper towels carry colored water between cups
- `rainbow-milk/` : food coloring on milk, burst with dish soap
- `paint-mixing/` : mix red, yellow, blue, white and black paint, then paint
- `paint-mixing-2/` : the same paints, mixed in a six-cup tray, then painted on a big easel sheet (made for phones)

Light and color
- `light-and-color/` : glowing bottles, white light, colored flashlights on fruit
- `rainbow-maker/` : a prism splits white light into a rainbow
- `colored-shadows/` : red, green and blue lamps make colored light and shadows
- `color-hunt/` : find things by color, then see them under red light

## Put it on GitHub Pages

1. Copy this whole folder into your repository (for example as `/little-color-lab`).
2. Commit and push.
3. In the repository: Settings > Pages > Source: deploy from your branch.
4. Open `https://<your-name>.github.io/<repo>/little-color-lab/`.

Each game is a single `index.html` with no build step. They share `lab-kit.js` and `lab-kit.css`
(also used by the standalone `/rainbow-maker`): one saved setting for sound (sounds only, voice + sounds,
silent) and language (EN + VI, EN, VI), the foldable tip bubble and control tray, and the "Install app"
help for Android, iPhone, Samsung Internet and in-app browsers like Zalo. Settings live in
`localStorage['cuibap-prefs']`. three.js (r128) and the fonts load from public CDNs; after the first
visit the service worker keeps everything available offline.

Tests for the kit's logic: `mise exec node@24.21.0 -- npm run test:lab`.
