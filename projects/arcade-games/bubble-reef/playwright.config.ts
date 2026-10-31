import { defineConfig } from '@playwright/test';

const PORT = 4179;

// WebKit is the engine that matters: the game ships to Safari on iPad. Both iPad sizes run every test. The portrait and
// phone sizes run only the @responsive tests, which keeps a full run light enough for this Mac.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/`,
    browserName: 'webkit',
    hasTouch: true,
    isMobile: false,
    deviceScaleFactor: 2,
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'ipad-mini', use: { viewport: { width: 1133, height: 744 } } },
    { name: 'ipad-11', use: { viewport: { width: 1180, height: 820 } } },
    { name: 'ipad-portrait', grep: /@responsive/, use: { viewport: { width: 768, height: 1024 } } },
    { name: 'phone-portrait', grep: /@responsive/, use: { viewport: { width: 390, height: 844 } } },
    { name: 'phone-landscape', grep: /@responsive/, use: { viewport: { width: 844, height: 390 } } },
  ],
  webServer: {
    command: `npx vite build --mode e2e && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
