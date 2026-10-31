import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self' blob: data:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

/** Production builds only: the dev server needs its websocket for hot reload (NFR-03, 17.8). */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'bubble-reef-csp',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
  };
}

// Relative base: the same build works at /bubble-reef/ on GitHub Pages and at / on any other host.
export default defineConfig({
  base: './',
  resolve: { alias: { '@config': path.resolve(import.meta.dirname, 'config') } },
  build: {
    target: 'safari16',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
    sourcemap: false,
  },
  server: { host: true },
  plugins: [
    contentSecurityPolicy(),
    VitePWA({
      // 'prompt' only so the page never reloads itself mid-game. skipWaiting below means a new version takes over at the
      // next launch: waiting for a parent (§17.8) would trap a build that crashes before the Parent Zone can open.
      registerType: 'prompt',
      injectRegister: false,
      includeManifestIcons: false,
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,woff2,png}'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
      manifest: {
        id: './',
        name: 'Bubble Reef',
        short_name: 'Bubble Reef',
        description: "Fire bubbles, catch fish in sparkly nets and fill Captain Otto's Fish Book.",
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#04395e',
        theme_color: '#04395e',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    include: ['tests/sim/**/*.test.ts', 'tests/services/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/sim/**', 'src/economy/**', 'src/services/**', 'src/config/**'],
      exclude: ['src/services/audio.ts', 'src/services/audio/**', 'src/services/pwa.ts', 'src/services/speech.ts'],
      reporter: ['text-summary'],
      thresholds: { lines: 70 },
    },
  },
});
