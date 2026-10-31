// Renders the procedural app icon to PNG with Playwright, so public/icons stays in step with src/art.
// Run with the Vite dev server up: npx vite --port 5193 & npm run icons
import { webkit } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const browser = await webkit.launch();
const page = await browser.newPage();
await page.goto('http://localhost:5193/tools/icon.html');
await page.waitForFunction(() => window.renderIcon !== undefined);
for (const size of [180, 192, 512]) {
  const data = await page.evaluate((s) => window.renderIcon(s), size);
  writeFileSync(`public/icons/icon-${size}.png`, Buffer.from(data.split(',')[1], 'base64'));
}
await browser.close();
