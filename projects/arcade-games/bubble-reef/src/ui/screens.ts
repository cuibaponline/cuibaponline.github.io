import { drawCannonPreview, drawCreature, drawOtto } from '../art';
import type { CreatureId, OttoPose, SkinId } from '../art/types';
import { CONFIG, DIFFICULTIES, type Difficulty } from '../config';
import { badgeFor, buySkin, equipSkin, fishBookEntries, levelProgress, skinState, type LevelUp } from '../economy/economy';
import type { SessionResults, WaveSummary } from '../game/session';
import { formatNumber, h, hiDpiCanvas, onHold } from './dom';
import { icon } from './icons';
import type { App } from './app';

export const otto = (pose: OttoPose, height: number): HTMLCanvasElement =>
  hiDpiCanvas(height, height, (ctx) => drawOtto(ctx, pose, height / 2, height - 2, height - 6));

const levelLabel = (level: number): string => (level > 10 ? `Level ${level} ★` : `Level ${level}`);

function coinPill(app: App): HTMLElement {
  return h('div', { class: 'pill', html: icon('coin') }, formatNumber(app.save.get().profile.coins));
}

function topbar(app: App, title: string, back: () => void, extra?: Node): HTMLElement {
  return h('div', { class: 'topbar' }, h('button', { class: 'round-btn', html: icon('back'), label: 'Back', onTap: back }), h('h1', {}, title), extra ?? coinPill(app));
}

export function titleScreen(app: App): HTMLElement {
  const el = h(
    'div',
    { class: 'screen dim center', id: 'title' },
    h('div', { class: 'logo', html: 'Bubble <span>Reef</span>' }),
    otto('cheer', Math.min(300, window.innerHeight * 0.42)),
    h('div', { class: 'tap-hint' }, 'Tap to start'),
  );
  el.addEventListener('pointerdown', () => app.onFirstTap());
  return el;
}

export function homeScreen(app: App): HTMLElement {
  const { profile } = app.save.get();
  const lock = h('button', { class: 'round-btn parent-lock', html: icon('lock'), label: 'Grown-ups: press and hold' });
  onHold(lock, 2000, () => app.openParentZone());

  return h(
    'div',
    { class: 'screen dim', id: 'home' },
    h(
      'div',
      { class: 'home-top' },
      h('div', { class: 'group' }, h('div', { class: 'pill', html: icon('star') }, levelLabel(profile.level)), coinPill(app)),
      h(
        'div',
        { class: 'group' },
        h('button', { class: 'round-btn', html: icon('gear'), label: 'Settings', onTap: () => app.show(settingsScreen) }),
        lock,
      ),
    ),
    h(
      'div',
      { class: 'home-mid' },
      otto('idle', Math.min(340, window.innerHeight * 0.52)),
      h(
        'div',
        { class: 'home-menu' },
        h('div', { class: 'logo', style: { fontSize: 'clamp(48px, 9vh, 76px)' }, html: 'Bubble <span>Reef</span>' }),
        h('button', { class: 'btn huge', id: 'play', html: icon('play'), onTap: () => app.show(difficultyScreen) }),
        h(
          'div',
          { class: 'home-row' },
          h('button', { class: 'btn sea', id: 'open-book', html: icon('book'), label: 'Fish Book', onTap: () => app.show(fishBookScreen) }),
          h('button', { class: 'btn coral', id: 'open-workshop', html: icon('wrench'), label: 'Cannon Workshop', onTap: () => app.show(workshopScreen) }),
        ),
      ),
    ),
  );
}

export function difficultyScreen(app: App): HTMLElement {
  const lock = app.save.get().parental.difficultyLock;
  const names: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
  const cards = DIFFICULTIES.map((d, i) => {
    const locked = lock !== null && lock !== d;
    const fish = Array.from({ length: i + 1 }, () => h('div', { class: 'f', html: icon('fish') }));
    return h(
      'button',
      { class: `diff-card ${d}`, id: `diff-${d}`, label: names[d], disabled: locked, onTap: () => app.startGame(d) },
      h('div', { class: 'diff-fish' }, ...fish),
      names[d],
      locked && h('div', { class: 'padlock', html: icon('lock') }),
    );
  });
  return h('div', { class: 'screen dim' }, topbar(app, 'How tricky?', () => app.show(homeScreen)), h('div', { class: 'cards' }, ...cards));
}

export function pauseScreen(app: App): HTMLElement {
  return h(
    'div',
    { class: 'screen dim center', id: 'pause' },
    h('h2', {}, 'Paused'),
    h('button', { class: 'btn huge', id: 'resume', html: icon('play'), label: 'Resume', onTap: () => app.resume() }),
    h(
      'div',
      { class: 'panel', style: { width: 'min(620px, 90vw)' } },
      volumeRow(app, 'Music', 'musicVolume'),
      volumeRow(app, 'Sounds', 'sfxVolume'),
    ),
    h(
      'button',
      {
        class: 'btn ghost small', id: 'pause-home', html: icon('home'), label: 'Home',
        onTap: () => app.confirm('Go home?', 'Your coins and fish are saved.', () => app.quitToResults()),
      },
    ),
  );
}

function volumeRow(app: App, label: string, key: 'musicVolume' | 'sfxVolume'): HTMLElement {
  const input = h('input', {}) as HTMLInputElement;
  input.type = 'range';
  input.min = '0';
  input.max = '100';
  input.value = String(Math.round(app.save.get().settings[key] * 100));
  input.setAttribute('aria-label', `${label} volume`);
  input.addEventListener('input', () => {
    const value = Number(input.value) / 100;
    app.save.update((d) => {
      d.settings[key] = value;
    });
    app.applyAudioSettings();
  });
  input.addEventListener('change', () => app.save.saveSoon());
  return h('label', { class: 'setting' }, label, input);
}

function xpBar(app: App): HTMLElement {
  const p = levelProgress(app.save.get().profile.xp);
  const fill = h('div', { class: 'xp-fill', style: { width: '0%' } });
  requestAnimationFrame(() => requestAnimationFrame(() => (fill.style.width = `${Math.round(p.ratio * 100)}%`)));
  return h(
    'div',
    { class: 'xp' },
    h('div', { class: 'xp-label' }, h('span', {}, levelLabel(p.level)), h('span', {}, `${formatNumber(p.into)} / ${formatNumber(p.needed)}`)),
    h('div', { class: 'xp-track' }, fill),
  );
}

function fishThumb(id: string, size: number): HTMLCanvasElement {
  return hiDpiCanvas(size, size, (ctx) => drawCreature(ctx, id as CreatureId, size / 2, size / 2, size * 0.92));
}

function unlockList(ups: LevelUp[]): HTMLElement | null {
  const lines = ups.flatMap((u) => u.unlocks);
  if (ups.length === 0) return null;
  return h('div', { class: 'unlock-list' }, h('b', {}, `Level ${ups[ups.length - 1]!.level}!`), lines.length > 0 ? ` ${lines.join(' · ')}` : '');
}

export function intermissionScreen(app: App, data: { summary: WaveSummary; suggestMedium: boolean }): HTMLElement {
  const { summary, suggestMedium } = data;
  // Counts down only while the game can be seen, so a wave never starts behind the rotate overlay or the Home Screen.
  let leftMs = CONFIG.waves.intermissionSec * 1000 + (summary.levelUps.length > 0 ? 4000 : 0);
  const auto = window.setInterval(() => {
    if (document.hidden || window.matchMedia('(orientation: portrait)').matches) return;
    leftMs -= 250;
    if (leftMs > 0) return;
    window.clearInterval(auto);
    app.keepPlaying();
  }, 250);
  const keep = (): void => {
    window.clearInterval(auto);
    app.keepPlaying();
  };
  const stop = (): void => {
    window.clearInterval(auto);
    app.takeBreak();
  };
  const el = h(
    'div',
    { class: 'screen dim center', id: 'intermission' },
    h('h2', {}, summary.boss ? 'Boss wave done!' : 'Wave complete!'),
    h(
      'div',
      { class: 'tally' },
      h('div', { class: 'stat' }, h('b', { html: icon('coin') }, formatNumber(summary.coins)), h('span', {}, 'coins')),
      h('div', { class: 'stat' }, h('b', { html: icon('fish') }, formatNumber(summary.caught)), h('span', {}, 'fish')),
    ),
    summary.newFish.length > 0 && h('div', { class: 'new-fish' }, ...summary.newFish.slice(0, 6).map((id) => fishThumb(id, 72))),
    unlockList(summary.levelUps),
    xpBar(app),
    suggestMedium &&
      h(
        'div',
        { class: 'otto-tip' },
        otto('point', 60),
        'Want to try Medium?',
        h('button', { class: 'btn small sea', id: 'try-medium', onTap: () => (window.clearInterval(auto), app.switchToMedium()) }, 'Yes!'),
      ),
    h(
      'div',
      { class: 'row' },
      h('button', { class: 'btn', id: 'keep-playing', html: icon('play'), onTap: keep }, 'Keep playing'),
      h('button', { class: 'btn ghost', id: 'take-break', onTap: stop }, 'Take a break'),
    ),
  );
  app.onLeave(() => window.clearInterval(auto));
  return el;
}

export function resultsScreen(app: App, data: { results: SessionResults; then: () => void }): HTMLElement {
  const { results } = data;
  return h(
    'div',
    { class: 'screen dim center', id: 'results' },
    h('h2', {}, 'Great catching!'),
    h(
      'div',
      { class: 'tally' },
      h('div', { class: 'stat' }, h('b', { html: icon('coin') }, formatNumber(results.coins)), h('span', {}, 'coins')),
      h('div', { class: 'stat' }, h('b', { html: icon('fish') }, formatNumber(results.caught)), h('span', {}, 'fish')),
      h('div', { class: 'stat' }, h('b', { html: icon('star') }, formatNumber(results.wavesCompleted)), h('span', {}, 'waves')),
    ),
    results.newFish.length > 0 &&
      h('div', {}, h('div', { class: 'note' }, 'New in your Fish Book'), h('div', { class: 'new-fish' }, ...results.newFish.slice(0, 8).map((id) => fishThumb(id, 72)))),
    unlockList(results.levelUps),
    xpBar(app),
    h('button', { class: 'btn', id: 'results-done', html: icon('check'), label: 'Done', onTap: data.then }),
  );
}

export function fishBookScreen(app: App): HTMLElement {
  const { fishBook } = app.save.get().profile;
  const entries = fishBookEntries();
  const found = entries.filter((def) => fishBook[def.id]).length;
  const cards = entries.map((def) => {
    const entry = fishBook[def.id];
    const size = 104;
    const art = hiDpiCanvas(size, size, (ctx) =>
      drawCreature(ctx, def.id as CreatureId, size / 2, size / 2, size * 0.94, { silhouette: !entry }),
    );
    const badge = entry ? badgeFor(entry.caught) : 'none';
    return h(
      'button',
      { class: 'card', label: entry ? def.name : 'Not found yet', dataset: { fish: def.id }, onTap: () => entry && openFishCard(app, def.id) },
      badge !== 'none' && h('div', { class: `badge ${badge}` }),
      entry && h('div', { class: 'count' }, formatNumber(entry.caught)),
      art,
      h('div', { class: 'name' }, entry ? def.name : '???'),
    );
  });
  return h(
    'div',
    { class: 'screen deep', id: 'book' },
    topbar(app, 'Fish Book', () => app.show(homeScreen), h('div', { class: 'pill' }, `${found} / ${entries.length}`)),
    h('div', { class: 'scroll' }, h('div', { class: 'book-grid' }, ...cards)),
  );
}

function openFishCard(app: App, id: string): void {
  const def = CONFIG.creatures.get(id);
  const entry = app.save.get().profile.fishBook[id];
  if (!def || !entry) return;
  const { readAloud } = app.save.get().settings;
  const speak = (): void => app.speak(`${def.name}. ${def.fact}`);
  const badge = badgeFor(entry.caught);
  app.dialog((close) =>
    h(
      'div',
      { class: 'panel' },
      h(
        'div',
        { class: 'detail' },
        fishThumb(id, 240),
        h(
          'div',
          { style: { textAlign: 'left' } },
          h('h2', {}, def.name),
          h('div', { class: 'fact' }, def.fact),
          h('div', { class: 'note' }, `Caught ${formatNumber(entry.caught)}${badge !== 'none' ? ` · ${badge} badge` : ''}`),
        ),
      ),
      h(
        'div',
        { class: 'row' },
        readAloud && h('button', { class: 'btn sea small', html: icon('speaker'), label: 'Read aloud', onTap: speak }),
        h('button', { class: 'btn small', html: icon('check'), label: 'Close', onTap: close }),
      ),
    ),
  );
}

export function workshopScreen(app: App): HTMLElement {
  const render = (): HTMLElement[] =>
    CONFIG.progression.skins.map((skin) => {
      const { profile } = app.save.get();
      const state = skinState(profile, skin.id);
      const preview = hiDpiCanvas(150, 124, (ctx) => drawCannonPreview(ctx, skin.id as SkinId, profile.maxCannonLevel, 75, 94, 96));

      let action: HTMLElement;
      if (state === 'equipped') {
        action = h('div', { class: 'pill', html: icon('check') });
      } else if (state === 'owned') {
        action = h('button', {
          class: 'btn small sea', dataset: { equip: skin.id }, html: icon('check'), label: `Use ${skin.name}`,
          onTap: () => {
            app.save.update((d) => void equipSkin(d.profile, skin.id));
            void app.save.saveNow();
            app.world.setSkin(skin.id as SkinId);
            app.show(workshopScreen);
          },
        });
      } else if (state === 'buy') {
        const afford = profile.coins >= skin.price;
        action = h(
          'button',
          {
            class: 'btn small price', dataset: { buy: skin.id }, html: icon('coin'), label: `Buy ${skin.name}`, disabled: !afford,
            onTap: () => {
              app.save.update((d) => void buySkin(d.profile, skin.id));
              void app.save.saveNow();
              app.audio.sfx('unlock');
              app.show(workshopScreen);
            },
          },
          formatNumber(skin.price),
        );
      } else {
        const why = skin.how === 'level' ? `Level ${skin.level}` : 'Finish the Fish Book';
        action = h('div', { class: 'note' }, why);
      }
      return h('div', { class: `skin${state === 'equipped' ? ' equipped' : ''}` }, preview, h('div', { class: 'name' }, skin.name), action);
    });

  return h(
    'div',
    { class: 'screen deep', id: 'workshop' },
    topbar(app, 'Cannon Workshop', () => app.show(homeScreen)),
    h('div', { class: 'scroll' }, h('div', { class: 'skin-grid' }, ...render())),
  );
}

function toggleRow(app: App, label: string, hint: string | null, read: () => boolean, write: (on: boolean) => void): HTMLElement {
  const button = h('button', { class: `toggle${read() ? ' on' : ''}`, label });
  button.addEventListener('click', () => {
    const next = !read();
    write(next);
    button.classList.toggle('on', next);
    void app.save.saveNow();
    app.applySettings();
  });
  return h('div', { class: 'setting' }, h('span', {}, label, hint && h('span', { class: 'hint' }, hint)), button);
}

export function settingsScreen(app: App): HTMLElement {
  const settings = (): ReturnType<typeof app.save.get>['settings'] => app.save.get().settings;
  const mode = h(
    'div',
    { class: 'segmented' },
    ...(['tap', 'joystick'] as const).map((value) =>
      h(
        'button',
        {
          class: settings().controlMode === value ? 'on' : '',
          onTap: () => {
            app.save.update((d) => {
              d.settings.controlMode = value;
            });
            void app.save.saveNow();
            app.show(settingsScreen);
          },
        },
        value === 'tap' ? 'Tap' : 'Joystick',
      ),
    ),
  );

  return h(
    'div',
    { class: 'screen deep', id: 'settings' },
    topbar(app, 'Settings', () => app.show(homeScreen), h('span')),
    h(
      'div',
      { class: 'scroll' },
      h(
        'div',
        { class: 'settings' },
        volumeRow(app, 'Music', 'musicVolume'),
        volumeRow(app, 'Sounds', 'sfxVolume'),
        h('div', { class: 'setting' }, 'Controls', mode),
        toggleRow(app, 'Left-handed layout', null, () => settings().leftHanded, (on) => app.save.update((d) => void (d.settings.leftHanded = on))),
        toggleRow(app, 'Reduce flashing', 'No screen flashes or shaking', () => settings().reduceFlashing, (on) => app.save.update((d) => void (d.settings.reduceFlashing = on))),
        toggleRow(app, 'Read aloud', 'For the Fish Book', () => settings().readAloud, (on) => app.save.update((d) => void (d.settings.readAloud = on))),
      ),
    ),
  );
}
