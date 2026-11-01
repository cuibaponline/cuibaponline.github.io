import { expect, type Page } from '@playwright/test';

export const PIN = '7392';

declare global {
  interface Window {
    __br: {
      state(): {
        screen: string;
        coins: number;
        shots: number;
        caught: number;
        fish: { id: string; x: number; y: number; cssX: number; cssY: number; tier: string }[];
        level: number;
        phase: string | null;
        fps: number;
        caughtBySeat: number[];
        seats: { x: number; y: number; aimAngle: number; fired: boolean; level: number; autoFire: boolean }[];
        bossMaxHp: number;
      };
      setUsed(sec: number): void;
      setXp(xp: number): void;
      endWave(): void;
      skipPhase(): void;
      startBreak(sec: number): void;
      setControlMode(mode: 'tap' | 'joystick'): void;
      audio(): { state: string; currentTrack: string | null; sfxReady: number; warned: boolean };
      giveCoins(n: number): void;
      catchFor(seat: number): void;
      fillLasers(): void;
      flush(): Promise<void>;
      tick(): void;
    };
  }
}

/** Fails a test on any page error, CSP violation or request off this origin. */
export function watchProblems(page: Page): { errors: string[]; external: string[] } {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const text = m.text();
    if (m.type() === 'error' && !text.includes('favicon')) errors.push(`console: ${text}`);
    if (text.includes('Content Security Policy') || text.includes('Refused to')) errors.push(`csp: ${text}`);
  });
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.protocol.startsWith('http') && url.hostname !== 'localhost') external.push(r.url());
  });
  return { errors, external };
}

export async function enterPin(page: Page, pin: string): Promise<void> {
  for (const digit of pin) await page.locator(`.pin-pad button[data-digit="${digit}"]`).click();
}

/** Completes the first-run wizard with the given limit left at its default. */
export async function completeSetup(page: Page): Promise<void> {
  await page.goto('./');
  await expect(page.locator('#wizard')).toBeVisible();
  await page.locator('#wizard-next').click();
  await enterPin(page, PIN);
  await enterPin(page, PIN);
  await page.locator('#saved-code').click();
  await page.locator('#wizard-next').click();
  await page.locator('#wizard-finish').click();
  await expect(page.locator('#title')).toBeVisible();
}

export async function tapToHome(page: Page): Promise<void> {
  await page.locator('#title').click();
  await expect(page.locator('#home')).toBeVisible();
}

export async function startTwoPlayers(page: Page, difficulty: 'easy' | 'medium' = 'easy'): Promise<void> {
  await page.locator('#play').click();
  await page.locator('#players-2').click();
  await page.locator(`#diff-${difficulty}`).click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.waitForFunction(() => window.__br.state().phase === 'wave');
}

/** Enough XP for every button, which arrives with the next catch. */
export async function startTwoPlayersAtHighLevel(page: Page): Promise<void> {
  await page.evaluate(() => window.__br.setXp(60000));
  await startTwoPlayers(page, 'medium');
  await page.waitForFunction(() => window.__br.state().fish.length > 0);
  await page.evaluate(() => window.__br.catchFor(0));
  await expect(page.locator('.hud-btn.laser').first()).toBeVisible();
}

export async function startGame(page: Page, difficulty: 'easy' | 'medium' = 'easy'): Promise<void> {
  await page.locator('#play').click();
  await page.locator(`#diff-${difficulty}`).click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.waitForFunction(() => window.__br.state().phase === 'wave');
}
