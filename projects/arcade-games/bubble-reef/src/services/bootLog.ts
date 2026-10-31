const KEY = 'bubble-reef-boot-log';
const KEEP_ATTEMPTS = 4;

interface Attempt {
  build: string;
  at: string;
  steps: string[];
}

function read(): Attempt[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Attempt[];
  } catch {
    return [];
  }
}

const attempts = read().slice(-(KEEP_ATTEMPTS - 1));
const current: Attempt = { build: import.meta.url.split('/').pop() ?? '', at: new Date().toISOString(), steps: [] };
attempts.push(current);

/**
 * Records how far this launch got. A crashed tab can't report anything, so each step is written straight to
 * localStorage, and the standalone page in diag/ reads it back afterwards.
 */
export function bootStep(step: string): void {
  current.steps.push(`${(performance.now() / 1000).toFixed(2)}s ${step}`);
  try {
    localStorage.setItem(KEY, JSON.stringify(attempts));
  } catch {
    // Diagnostics must never get in the way of the game.
  }
}

export const lastSteps = (n: number): string[] => current.steps.slice(-n);

/** Replaces the boot screen, or brings it back if start-up had already finished. */
export function showFailure(detail: string): void {
  const boot = document.getElementById('boot') ?? document.body.appendChild(Object.assign(document.createElement('div'), { id: 'boot' }));
  boot.textContent = 'Something went wrong. Please close the game and open it again.';
  const pre = document.createElement('pre');
  pre.style.cssText = 'max-width:92vw;margin-top:16px;font:13px/1.35 monospace;white-space:pre-wrap;word-break:break-word;text-align:left';
  pre.textContent = `${lastSteps(3).join('\n')}\n${detail}`.slice(0, 1400);
  boot.append(pre);
}

window.addEventListener('error', (e) => bootStep(`ERROR ${e.message} at ${e.filename}:${e.lineno}`));
window.addEventListener('unhandledrejection', (e) => bootStep(`REJECTED ${String(e.reason)}`));
bootStep('script started');
