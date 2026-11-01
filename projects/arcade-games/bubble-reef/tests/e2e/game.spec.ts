import { spawn } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { completeSetup, enterPin, PIN, startGame, startTwoPlayers, startTwoPlayersAtHighLevel, tapToHome, watchProblems } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __e2e: boolean }).__e2e = true;
  });
});

test.describe('first run (US-16)', () => {
  test('the wizard comes first, rejects bad PINs, and cannot be skipped', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('#wizard')).toBeVisible();
    await expect(page.locator('#title')).toHaveCount(0);
    await page.locator('#wizard-next').click();

    await enterPin(page, '1234');
    await expect(page.locator('.pin-msg')).toContainText('too easy');

    await enterPin(page, PIN);
    await enterPin(page, '7393');
    await expect(page.locator('.pin-msg')).toContainText('match');

    await enterPin(page, PIN);
    await enterPin(page, PIN);
    await expect(page.locator('.code')).toHaveText(/^[A-Z2-9]{8}$/);
    await expect(page.locator('#wizard-next')).toBeDisabled();
    await page.locator('#saved-code').click();
    await page.locator('#wizard-next').click();
    await page.locator('#wizard-finish').click();
    await expect(page.locator('#title')).toBeVisible();

    await page.reload();
    await expect(page.locator('#title')).toBeVisible();
    await expect(page.locator('#wizard')).toHaveCount(0);
  });
});

test.describe('playing', () => {
  test('a child can start and catch a fish by tapping, with no reading (G1, US-01..03)', async ({ page }) => {
    const problems = watchProblems(page);
    await completeSetup(page);
    await tapToHome(page);
    await startGame(page);

    for (let i = 0; i < 40; i++) {
      const fish = await page.evaluate(() => {
        const list = window.__br.state().fish.filter((f) => f.cssX > 60 && f.cssX < innerWidth - 60 && f.cssY > 110 && f.cssY < innerHeight - 170);
        return list[0] ?? null;
      });
      if (fish) await page.touchscreen.tap(fish.cssX, fish.cssY);
      if ((await page.evaluate(() => window.__br.state().caught)) > 0) break;
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(900);
    const state = await page.evaluate(() => window.__br.state());
    expect(state.shots).toBeGreaterThan(0);
    expect(state.caught).toBeGreaterThan(0);
    expect(state.coins).toBeGreaterThan(0);
    await expect(page.locator('.coin-value')).not.toHaveText('0');
    expect(problems.errors).toEqual([]);
    expect(problems.external).toEqual([]);
  });

  test('a touch that starts on a HUD button never fires the cannon (10.2)', async ({ page }) => {
    await completeSetup(page);
    await tapToHome(page);
    await startGame(page, 'medium');
    // Real touches, so they go through hit testing. Auto would fire by design, so this uses the level buttons.
    for (const button of await page.locator('.hud-btn.level').all()) {
      const box = await button.boundingBox();
      if (!box) throw new Error('level button has no box');
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    }
    await page.waitForTimeout(300);
    expect((await page.evaluate(() => window.__br.state())).shots).toBe(0);
  });

  test('three fingers at once: aim, then Lock and Auto while held (10.3)', async ({ page }) => {
    await completeSetup(page);
    await tapToHome(page);
    await startGame(page);
    await page.evaluate(() => {
      const stage = document.querySelector('#stage') as HTMLElement;
      const fire = (el: Element, type: string, pointerId: number, x: number, y: number) =>
        el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId, pointerType: 'touch', clientX: x, clientY: y, isPrimary: pointerId === 1 }));
      fire(stage, 'pointerdown', 1, 500, 300);
      fire(document.querySelector('.hud-btn.lock')!, 'pointerdown', 2, 0, 0);
      fire(document.querySelector('.hud-btn.auto')!, 'pointerdown', 3, 0, 0);
      fire(document.querySelector('.hud-btn.auto')!, 'pointerup', 3, 0, 0);
      fire(document.querySelector('.hud-btn.lock')!, 'pointerup', 2, 0, 0);
    });
    await page.waitForTimeout(500);
    await expect(page.locator('.hud-btn.lock')).toHaveClass(/on/);
    await expect(page.locator('.hud-btn.auto')).toHaveClass(/on/);
    expect((await page.evaluate(() => window.__br.state())).shots).toBeGreaterThan(0);
  });

  test('two players: each half of the screen works its own cannon and buttons', async ({ page, viewport }) => {
    await completeSetup(page);
    await tapToHome(page);
    await startTwoPlayers(page);
    const { width, height } = viewport!;
    await expect(page.locator('.hud-btn.lock')).toHaveCount(2);

    await page.evaluate(({ w, h }) => {
      const stage = document.querySelector('#stage') as HTMLElement;
      const fire = (type: string, pointerId: number, x: number, y: number) =>
        stage.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId, pointerType: 'touch', clientX: x, clientY: y, isPrimary: pointerId === 1 }));
      fire('pointerdown', 1, w * 0.1, h * 0.75);
      fire('pointerdown', 2, w * 0.1, h * 0.25);
    }, { w: width, h: height });
    await page.waitForFunction(() => window.__br.state().seats.every((seat) => seat.fired));
    const held = (await page.evaluate(() => window.__br.state())).seats;
    expect(held).toHaveLength(2);
    expect(held[0]!.y).toBeGreaterThan(held[1]!.y);
    // The same spot on the screen is to Blue's left and to Red's right.
    expect(held[0]!.aimAngle).toBeLessThan(0);
    expect(held[1]!.aimAngle).toBeGreaterThan(0);

    // A finger keeps its cannon when it slides over to the other player's half.
    await page.evaluate(({ w, h }) => {
      const stage = document.querySelector('#stage') as HTMLElement;
      stage.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'touch', clientX: w * 0.9, clientY: h * 0.25 }));
      for (const pointerId of [1, 2]) stage.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId, pointerType: 'touch' }));
    }, { w: width, h: height });
    await page.waitForFunction(() => window.__br.state().seats[0]!.aimAngle > 0);

    await page.locator('.hud-btn.auto').nth(1).dispatchEvent('pointerdown');
    await page.locator('.hud-btn.auto').nth(1).dispatchEvent('pointerup');
    await page.waitForFunction(() => window.__br.state().seats[1]!.autoFire);
    expect((await page.evaluate(() => window.__br.state())).seats[0]!.autoFire).toBe(false);
  });

  test('two players see their own catches, and the next solo game goes back to one cannon', async ({ page }) => {
    await completeSetup(page);
    await tapToHome(page);
    await startTwoPlayers(page);
    await page.waitForFunction(() => window.__br.state().fish.length > 2);
    await page.evaluate(() => {
      window.__br.catchFor(0);
      window.__br.catchFor(0);
      window.__br.catchFor(1);
    });
    await page.waitForFunction(() => window.__br.state().caught === 3);

    await page.locator('.hud-btn.pause').dispatchEvent('pointerdown');
    await page.locator('#pause-home').click();
    await page.locator('#confirm-yes').click();
    await expect(page.locator('#results .stat.p1 b')).toHaveText('2');
    await expect(page.locator('#results .stat.p2 b')).toHaveText('1');

    await page.locator('#results-done').click();
    await page.locator('#play').click();
    await page.locator('#players-1').click();
    await page.locator('#diff-easy').click();
    await expect(page.locator('#hud')).toBeVisible();
    await expect(page.locator('.hud-btn.lock')).toHaveCount(1);
    await expect(page.locator('#hud')).not.toHaveClass(/two/);
    expect((await page.evaluate(() => window.__br.state())).seats).toHaveLength(1);
  });

  test('each player fires their own laser', async ({ page }) => {
    await completeSetup(page);
    await tapToHome(page);
    await startTwoPlayersAtHighLevel(page);
    await page.evaluate(() => window.__br.fillLasers());
    await expect(page.locator('.hud-btn.laser.p2')).toHaveClass(/ready/);

    await page.locator('.hud-btn.laser.p2').dispatchEvent('pointerdown');
    await page.locator('.hud-btn.laser.p2').dispatchEvent('pointerup');
    await expect(page.locator('.hud-btn.laser.p2')).toHaveClass(/firing/);
    await expect(page.locator('.hud-btn.laser.p1')).not.toHaveClass(/firing/);
    await expect(page.locator('.hud-btn.laser.p1')).toHaveClass(/ready/);
  });

  test('joystick mode: touching the left side aims only, and FIRE shoots (10.3)', async ({ page }) => {
    await completeSetup(page);
    await tapToHome(page);
    await page.evaluate(() => window.__br.setControlMode('joystick'));
    await startGame(page);
    const fire = page.locator('.hud-btn.fire');
    await expect(fire).toBeVisible();

    await page.touchscreen.tap(120, 400);
    await page.waitForTimeout(300);
    expect((await page.evaluate(() => window.__br.state())).shots).toBe(0);

    await fire.dispatchEvent('pointerdown', { pointerId: 9 });
    await page.waitForFunction(() => window.__br.state().shots > 0);
    await fire.dispatchEvent('pointerup', { pointerId: 9 });
  });

  test('pause stops the world, and going home keeps progress and shows Results', async ({ page }) => {
    await completeSetup(page);
    await tapToHome(page);
    await startGame(page);
    await page.locator('.hud-btn.pause').dispatchEvent('pointerdown');
    await expect(page.locator('#pause')).toBeVisible();
    const a = await page.evaluate(() => window.__br.state().fish[0]?.x);
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__br.state().fish[0]?.x)).toBe(a);
    await page.locator('#pause-home').click();
    await page.locator('#confirm-yes').click();
    await expect(page.locator('#results')).toBeVisible();
    await page.locator('#results-done').click();
    await expect(page.locator('#home')).toBeVisible();
  });

  test('pausing with a finger down lets go of the cannon, so it does not fire by itself after Resume', async ({ page }) => {
    await completeSetup(page);
    await tapToHome(page);
    await startGame(page);
    await page.locator('#stage').dispatchEvent('pointerdown', { pointerId: 5, clientX: 500, clientY: 300 });
    await page.waitForFunction(() => window.__br.state().shots > 0);
    await page.locator('.hud-btn.pause').dispatchEvent('pointerdown');
    await page.locator('#resume').click();
    await page.waitForTimeout(250);
    const shots = (await page.evaluate(() => window.__br.state())).shots;
    await page.waitForTimeout(900);
    expect((await page.evaluate(() => window.__br.state())).shots).toBe(shots);
  });

  test('the HUD timer counts down during play (10.2)', async ({ page }) => {
    await completeSetup(page);
    await tapToHome(page);
    await startGame(page);
    await expect(page.locator('.timer')).toContainText('30 min');
    await page.evaluate(() => window.__br.setUsed(12 * 60));
    await expect(page.locator('.timer')).toContainText('18 min');
  });

  test('turning the device during the intermission keeps the countdown going (6.1)', async ({ page, viewport }) => {
    await completeSetup(page);
    await tapToHome(page);
    await startGame(page);
    await page.evaluate(() => window.__br.endWave());
    await expect(page.locator('#intermission')).toBeVisible();
    await page.setViewportSize({ width: viewport!.height, height: viewport!.width });
    await expect(page.locator('#intermission')).toBeHidden({ timeout: 20_000 });
  });

  test('wave end shows the intermission with Keep playing and Take a break (5.4)', async ({ page }) => {
    await completeSetup(page);
    await tapToHome(page);
    await startGame(page);
    await page.evaluate(() => window.__br.endWave());
    await expect(page.locator('#intermission')).toBeVisible();
    await page.locator('#keep-playing').click();
    await expect(page.locator('#intermission')).toHaveCount(0);
    await expect(page.locator('.wave-label')).toHaveText('Wave 2');
  });
});

test.describe('saving (US-21)', () => {
  test('coins survive a reload', async ({ page }) => {
    await completeSetup(page);
    await page.evaluate(async () => {
      window.__br.giveCoins(321);
      await window.__br.flush();
    });
    await page.reload();
    await expect(page.locator('#title')).toBeVisible();
    await tapToHome(page);
    await expect(page.locator('#home .pill').nth(1)).toContainText('321');
  });
});

test.describe('collection', () => {
  test('Fish Book shows 20 silhouettes on a new save; Workshop lists 7 skins', async ({ page }) => {
    await completeSetup(page);
    await tapToHome(page);
    await page.locator('#open-book').click();
    await expect(page.locator('.card')).toHaveCount(20);
    await expect(page.locator('.card .name').first()).toHaveText('???');
    await page.locator('.round-btn').first().click();
    await page.locator('#open-workshop').click();
    await expect(page.locator('.skin')).toHaveCount(7);
  });

  test('buying and equipping a skin spends coins', async ({ page }) => {
    await completeSetup(page);
    await page.evaluate(() => window.__br.giveCoins(600));
    await tapToHome(page);
    await page.locator('#open-workshop').click();
    await page.locator('[data-buy="coral"]').click();
    await page.locator('[data-equip="coral"]').click();
    await expect(page.locator('.skin.equipped .name')).toHaveText('Coral');
    await expect(page.locator('.topbar .pill')).toContainText('100');
  });
});

test.describe('parental controls', () => {
  test('daily limit: warning, Last catch, Results, Time up, and it survives relaunch (US-17)', async ({ page }) => {
    await completeSetup(page);
    await tapToHome(page);
    await startGame(page);
    await page.evaluate(() => {
      window.__br.setUsed(30 * 60 - 301);
      window.__br.tick();
      window.__br.tick();
    });
    await expect(page.locator('.toast').first()).toContainText('5');

    await page.evaluate(() => {
      window.__br.setUsed(30 * 60 + 1);
      window.__br.tick();
    });
    await expect(page.locator('.banner')).toContainText('Last catch');
    await expect(page.locator('#results')).toBeVisible({ timeout: 25_000 });
    await page.locator('#results-done').click();
    await expect(page.locator('#blocked')).toBeVisible();

    await page.reload();
    await expect(page.locator('#blocked')).toBeVisible();
    await expect(page.locator('#title')).toHaveCount(0);
  });

  test('a parent can grant more time with the PIN (US-18)', async ({ page }) => {
    await completeSetup(page);
    await page.evaluate(() => {
      window.__br.setUsed(30 * 60 + 5);
      window.__br.tick();
    });
    await expect(page.locator('#blocked')).toBeVisible();
    await page.locator('#grown-ups').click();
    await enterPin(page, '0000');
    await expect(page.locator('.pin-msg')).toContainText('again');
    await enterPin(page, PIN);
    await page.locator('[data-grant="10"]').click();
    await page.locator('#pz-close').click();
    await expect(page.locator('#blocked')).toHaveCount(0);
    await expect(page.locator('#title, #home').first()).toBeVisible();
  });

  test('a parent can end a locked break early', async ({ page }) => {
    await completeSetup(page);
    await page.evaluate(async () => {
      window.__br.startBreak(240);
      await window.__br.flush();
    });
    await page.reload();
    await expect(page.locator('#blocked')).toBeVisible();
    await page.locator('#grown-ups').click();
    await enterPin(page, PIN);
    await expect(page.locator('#parent')).toBeVisible();
    await page.locator('#end-break').click();
    await expect(page.locator('#end-break')).toBeHidden();
    await page.locator('#pz-close').click();
    await expect(page.locator('#title')).toBeVisible();
  });

  test('the Parent Zone opens only on a 2 s hold, and time stops while it is open', async ({ page }) => {
    await completeSetup(page);
    await tapToHome(page);
    const lock = page.locator('.parent-lock');
    await lock.dispatchEvent('pointerdown');
    await page.waitForTimeout(500);
    await lock.dispatchEvent('pointerup');
    await page.waitForTimeout(1800);
    await expect(page.locator('.pin')).toHaveCount(0);

    await lock.dispatchEvent('pointerdown');
    await page.waitForTimeout(2200);
    await expect(page.locator('.pin')).toBeVisible();
    await enterPin(page, PIN);
    await expect(page.locator('#parent')).toBeVisible();
    await expect(page.locator('.usage .day')).toHaveCount(14);
  });

  test('a locked difficulty shows padlocks on the others', async ({ page }) => {
    await completeSetup(page);
    await tapToHome(page);
    const lock = page.locator('.parent-lock');
    await lock.dispatchEvent('pointerdown');
    await page.waitForTimeout(2200);
    await enterPin(page, PIN);
    await page.locator('[data-lock="easy"]').click();
    await page.locator('#pz-close').click();
    await page.locator('#play').click();
    await expect(page.locator('#diff-hard')).toBeDisabled();
    await expect(page.locator('#diff-easy')).toBeEnabled();
  });
});

test.describe('device', () => {
  test('turning the device pauses play, and the game carries on afterwards @responsive', async ({ page, viewport }) => {
    await completeSetup(page);
    await tapToHome(page);
    await startGame(page);
    await page.setViewportSize({ width: viewport!.height, height: viewport!.width });
    await expect(page.locator('#pause')).toBeVisible();
    await page.locator('#resume').click();
    await expect(page.locator('#pause')).toBeHidden();
    const box = await page.locator('#stage canvas').boundingBox();
    expect(box?.width).toBeCloseTo(viewport!.height, 0);
    expect(box?.height).toBeCloseTo(viewport!.width, 0);
  });

  test('2 Players is offered only where there is room for two sets of buttons @responsive', async ({ page, viewport }) => {
    await completeSetup(page);
    await tapToHome(page);
    await page.locator('#play').click();
    const compact = viewport!.width <= 740 || viewport!.height <= 500;
    await expect(page.locator('#players-2')).toHaveCount(compact ? 0 : 1);
  });

  test('two sets of buttons stay on screen and clear of each other @responsive', async ({ page, viewport }) => {
    test.skip(viewport!.width <= 740 || viewport!.height <= 500, 'Phones play alone');
    await completeSetup(page);
    await tapToHome(page);
    await startTwoPlayersAtHighLevel(page);
    const boxes = await page.locator('.hud-btn:not(.pause):not(.fire)').evaluateAll((els) =>
      els.filter((el) => el.getClientRects().length > 0).map((el) => {
        const { left, top, right, bottom } = el.getBoundingClientRect();
        return { name: el.getAttribute('aria-label'), left, top, right, bottom };
      }),
    );
    expect(boxes).toHaveLength(10);
    for (const box of boxes) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(viewport!.width);
      expect(box.bottom).toBeLessThanOrEqual(viewport!.height);
    }
    const touching = boxes.flatMap((a, i) =>
      boxes.slice(i + 1).filter((b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom).map((b) => `${a.name} / ${b.name}`),
    );
    expect(touching).toEqual([]);
  });

  test('every screen a child needs fits this size @responsive', async ({ page, viewport }) => {
    const inside = async (selector: string): Promise<void> => {
      const box = (await page.locator(selector).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport!.width);
    };
    await completeSetup(page);
    await tapToHome(page);
    await inside('#play');
    await page.locator('#play').click();
    for (const id of ['#diff-easy', '#diff-medium', '#diff-hard']) await inside(id);
    await page.locator('#diff-medium').click();
    await expect(page.locator('#hud')).toBeVisible();

    const selectors = ['.hud-btn.pause', '.hud-btn.lock', '.hud-btn.auto', '.level-box .hud-btn:first-child', '.level-box .hud-btn:last-child'];
    const boxes = [];
    for (const selector of selectors) {
      const box = (await page.locator(selector).boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport!.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport!.height);
      boxes.push(box);
    }
    for (const a of boxes) {
      for (const b of boxes) {
        if (a === b) continue;
        const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlap).toBe(false);
      }
    }
    const state = await page.evaluate(() => window.__br.state());
    expect(state.fish.length).toBeGreaterThan(0);
  });

  test('the world fills the screen with no letterbox at this size (6.1) @responsive', async ({ page, viewport }) => {
    await completeSetup(page);
    const box = await page.locator('#stage canvas').boundingBox();
    expect(box?.width).toBeCloseTo(viewport!.width, 0);
    expect(box?.height).toBeCloseTo(viewport!.height, 0);
  });

  test('buttons meet the size rules and stay inside the screen (10.3)', async ({ page, viewport }) => {
    await completeSetup(page);
    await tapToHome(page);
    await startGame(page);
    for (const selector of ['.hud-btn.lock', '.hud-btn.auto']) {
      const box = (await page.locator(selector).boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(80);
      expect(box.height).toBeGreaterThanOrEqual(80);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport!.width - 24);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport!.height - 24);
    }
  });
});

test.describe('sound', () => {
  test('after a relaunch the first tap unlocks audio and the menu music starts', async ({ page }) => {
    await completeSetup(page);
    await page.reload();
    await expect(page.locator('#title')).toBeVisible();
    expect(await page.evaluate(() => window.__br.audio().state)).toBe('none');

    await tapToHome(page);
    await expect.poll(() => page.evaluate(() => window.__br.audio().state)).toBe('running');
    await expect.poll(() => page.evaluate(() => window.__br.audio().currentTrack), { timeout: 15_000 }).toBe('menu');
    await expect.poll(() => page.evaluate(() => window.__br.audio().sfxReady), { timeout: 15_000 }).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__br.audio().warned)).toBe(false);
  });
});

test.describe('recovery', () => {
  test('a save that cannot be read never shows the setup wizard', async ({ page }) => {
    await page.addInitScript(() => {
      indexedDB.open = () => {
        throw new Error('storage unavailable');
      };
    });
    await page.goto('./');
    await expect(page.locator('#save-error')).toBeVisible();
    await expect(page.locator('#wizard')).not.toBeAttached();
  });

  test('a lost graphics context reloads the game with progress intact', async ({ page }) => {
    await completeSetup(page);
    await tapToHome(page);
    await page.evaluate(async () => {
      window.__br.giveCoins(77);
      await window.__br.flush();
    });
    const reloaded = page.waitForEvent('load');
    const lost = await page.evaluate(() => {
      const gl = document.querySelector('canvas')?.getContext('webgl');
      const extension = gl?.getExtension('WEBGL_lose_context');
      extension?.loseContext();
      return extension !== null && extension !== undefined;
    });
    expect(lost).toBe(true);
    await reloaded;
    await expect(page.locator('#title')).toBeVisible();
    expect((await page.evaluate(() => window.__br.state())).coins).toBe(77);
  });
});

test.describe('offline (NFR-02)', () => {
  // context.setOffline makes WebKit's reload die with an internal error, so this takes the real server away instead.
  const port = 4180;
  test.use({ baseURL: `http://localhost:${port}/` });

  test('after the first load the game relaunches with no server', async ({ page }) => {
    const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { detached: true, stdio: 'ignore' });
    let stopped = false;
    const stopServer = (): void => {
      if (stopped || !server.pid) return;
      stopped = true;
      process.kill(-server.pid);
    };
    try {
      await expect(async () => {
        expect((await fetch(`http://localhost:${port}/`)).ok).toBe(true);
      }).toPass({ timeout: 15_000 });

      await completeSetup(page);
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.reload();
      await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

      stopServer();
      await expect(async () => {
        await expect(fetch(`http://localhost:${port}/`)).rejects.toThrow();
      }).toPass({ timeout: 5_000 });

      await page.reload();
      await expect(page.locator('#title')).toBeVisible({ timeout: 20_000 });
    } finally {
      stopServer();
    }
  });
});
