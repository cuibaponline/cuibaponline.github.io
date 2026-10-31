import { registerSW } from 'virtual:pwa-register';

let updateReady = false;
let apply: ((reload?: boolean) => Promise<void>) | null = null;
const listeners = new Set<() => void>();

/** Registers the service worker. A new version waits until a parent applies it from the Parent Zone (17.8). */
export function initPwa(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  apply = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateReady = true;
      for (const fn of listeners) fn();
    },
  });
}

export const isUpdateReady = (): boolean => updateReady;

export function onUpdateReady(fn: () => void): void {
  listeners.add(fn);
}

export function applyUpdate(): void {
  void apply?.(true);
}
