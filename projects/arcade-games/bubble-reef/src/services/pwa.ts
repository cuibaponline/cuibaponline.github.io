import { registerSW } from 'virtual:pwa-register';

/** Registers the service worker. A new version installs quietly and runs from the next launch. */
export function initPwa(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  registerSW({ immediate: true });
}
