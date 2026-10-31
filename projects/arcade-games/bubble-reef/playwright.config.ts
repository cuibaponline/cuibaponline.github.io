import { defineConfig } from '@playwright/test';

const PORT = 4179;

// WebKit is the engine that matters: the game ships to Safari on iPad. Both target screen sizes run every test.
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
  ],
  webServer: {
    command: `npx vite build --mode e2e && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
