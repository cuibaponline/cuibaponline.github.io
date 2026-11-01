// Boot, game loop and screen flow.
import { LEVELS } from './data.js';
import { levelConfig, Round, starsFor } from './sim.js';
import { addSticker, boatExtras, defaultSave, loadSave, recordResult, writeSave } from './save.js';
import { TouchRouter } from './input.js';
import { GameAudio } from './audio.js';
import { View } from './render.js';
import { extraLine, t } from './strings.js';
import * as screens from './screens.js';

const $ = (id) => document.getElementById(id);

function showBootError(message) {
  const node = $('bootError');
  node.textContent = `Plop & Pull stopped: ${message}`;
  node.hidden = false;
}
window.addEventListener('error', (event) => showBootError(event.message));
window.addEventListener('unhandledrejection', (event) => showBootError(String(event.reason)));

const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => {} };
  }
})();

const END_PAUSE_MS = 1100;
const TURN_HINT_MS = 3000;
const landscapeQuery = window.matchMedia('(orientation: landscape)');

const save = loadSave(storage);
const audio = new GameAudio();
const view = new View($('sea'));
const screen = $('screen');
const attract = new Round({ config: levelConfig(3, 1), attract: true });

let state = 'splash';
let round = null;
let router = null;
let level = 1;
let lastFrame = performance.now();
let timers = [];
let turnTimer = 0;

function persist() {
  writeSave(storage, save);
}

function later(fn, ms) {
  timers.push(setTimeout(fn, ms));
}

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

function addToast(node) {
  $('toasts').append(node);
  setTimeout(() => node.remove(), 2800);
}

function toast(text) {
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = text;
  addToast(node);
}

function goto(name) {
  clearTimers();
  state = name;
  round = null;
  router = null;
  audio.setLine(null);
  view.setLevel(levelConfig(3, 1));
  $('hud').hidden = true;
  audio.setMusic('menu');
  if (name === 'menu') screens.menu(screen, save, installHintNeeded());
  else if (name === 'stickers') screens.stickers(screen, save);
  else if (name === 'settings') {
    screens.settings(screen, save, Math.round(view.memoryBytes() / 1048576));
    bindHoldToReset();
  }
}

function installHintNeeded() {
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  return iOS && !standalone && !save.installHintSeen;
}

function startLevel(number) {
  clearTimers();
  level = number;
  const config = levelConfig(level, save.players);
  round = new Round({ config, tutorial: level === 1 && !save.tutorialSeen });
  router = new TouchRouter({ players: save.players, bottom: view.bottom });
  view.setLevel(config, { reveal: true });
  screen.hidden = true;
  $('hud').hidden = false;
  state = 'play';
  audio.setMusic('game');
}

function award(type) {
  if (!addSticker(save, type)) return;
  persist();
  audio.play('sticker');
  addToast(screens.stickerToast(type));
}

function handleEvents() {
  for (const event of round.drainEvents()) {
    view.handleEvent(event, round);
    if (event.type === 'touch') audio.play('tick');
    else if (event.type === 'cast') audio.play('cast');
    else if (event.type === 'plop') audio.play('plop');
    else if (event.type === 'hop') audio.play('hop');
    else if (event.type === 'hopOn') audio.play('hopOn', event.count);
    else if (event.type === 'find') audio.play('find');
    else if (event.type === 'reel') audio.play('reel', event.height);
    else if (event.type === 'bubble') audio.play('bubble');
    else if (event.type === 'humRise' || event.type === 'humTug') audio.play('hum');
    else if (event.type === 'glow') {
      audio.liftKey();
      audio.play('sparkle');
    } else if (event.type === 'tutorialDone') {
      save.tutorialSeen = true;
      persist();
    } else if (event.type === 'leap') {
      audio.play('splash');
      audio.play('snap');
      event.riders.forEach((rider) => award(rider.type));
    } else if (event.type === 'breach') {
      audio.play('breach');
      award('hum');
    }
  }
}

function lineHeight() {
  const busy = round.boats.filter((boat) => boat.state === 'pull' || boat.state === 'tug');
  if (!busy.length) return null;
  return Math.max(...busy.map((boat) => round.heightOf(boat.ring.y)));
}

function finishRound() {
  state = 'ending';
  audio.setLine(null);
  router.reset();
  later(showResults, END_PAUSE_MS);
}

function showResults() {
  state = 'results';
  audio.setMusic(null);
  audio.play('jingle');
  const pearls = round.pearls;
  const stars = starsFor(pearls, round.config.stars);
  const outcome = recordResult(save, level, stars, pearls);
  persist();
  view.extras = boatExtras(save);
  const lit = screens.results(screen, { level, pearls, stars, best: outcome.best, newBest: outcome.newBest });
  lit.forEach((node, i) => later(() => {
    node.classList.add('lit');
    audio.play('star', i);
  }, 450 + i * 450));
  outcome.extras.forEach((item, i) => later(() => toast(extraLine(item.id)), 1800 + i * 900));
}

function pauseGame() {
  if (state !== 'play') return;
  state = 'pause';
  router.reset();
  round.setHolds(router.holds());
  audio.setLine(null);
  audio.setMusic(null);
  screens.pause(screen);
}

function resumeGame() {
  screen.hidden = true;
  state = 'play';
  audio.setMusic('game');
}

const actions = {
  start() {
    audio.setVolumes(save.settings.music, save.settings.sfx);
    audio.unlock();
    goto('menu');
  },
  home: () => goto('menu'),
  stickers: () => goto('stickers'),
  settings: () => goto('settings'),
  players(id) {
    save.players = Number(id);
    persist();
    goto('menu');
  },
  'dismiss-install'() {
    save.installHintSeen = true;
    persist();
    screen.querySelector('.install')?.remove();
  },
  level: (id) => startLevel(Number(id)),
  next: () => startLevel(Math.min(level + 1, LEVELS.length)),
  retry: () => startLevel(level),
  resume: resumeGame,
  goodnight() {
    audio.play('lullaby');
    state = 'night';
    screens.goodnight(screen, save);
  },
  sticker: (id) => screens.stickers(screen, save, id),
};

function bindHoldToReset() {
  const hold = $('resetHold');
  let timer = 0;
  hold.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    hold.classList.add('holding');
    timer = setTimeout(() => {
      hold.classList.remove('holding');
      Object.assign(save, defaultSave(), { settings: save.settings });
      persist();
      view.extras = boatExtras(save);
      toast(t('resetDone'));
    }, 3000);
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
    hold.addEventListener(type, () => {
      clearTimeout(timer);
      hold.classList.remove('holding');
    });
  }
}

screen.addEventListener('click', (event) => {
  const node = state === 'splash' ? screen : event.target.closest('[data-act]');
  if (!node) return;
  const act = state === 'splash' ? 'start' : node.dataset.act;
  audio.unlock();
  actions[act]?.(node.dataset.id, node);
  audio.play('ui');
});

screen.addEventListener('input', (event) => {
  const key = event.target.dataset.input;
  if (!key) return;
  save.settings[key] = Number(event.target.value);
  audio.setVolumes(save.settings.music, save.settings.sfx);
  persist();
});

$('btnPause').addEventListener('pointerdown', (event) => {
  event.preventDefault();
  pauseGame();
});

// Touches go in on the way down, because small hands often slide before they lift.
$('sea').addEventListener('pointerdown', (event) => {
  if (state !== 'play') return;
  event.preventDefault();
  audio.unlock();
  const point = view.toWorld(event.clientX, event.clientY);
  const tap = router.down(event.pointerId, point.x, point.y, event.timeStamp);
  if (tap) round.touch(tap.boat, tap.x, tap.y);
});

window.addEventListener('pointermove', (event) => {
  if (router) router.move(event.pointerId, view.toWorld(event.clientX, event.clientY).x);
});

for (const type of ['pointerup', 'pointercancel']) {
  window.addEventListener(type, (event) => router?.up(event.pointerId));
}

for (const type of ['gesturestart', 'gesturechange', 'dblclick', 'contextmenu']) {
  document.addEventListener(type, (event) => event.preventDefault());
}
document.addEventListener('touchmove', (event) => {
  if (!event.target.closest?.('.scroll, input')) event.preventDefault();
}, { passive: false });

// A sideways iPad still plays, in a centred column. This is a nudge, never a wall.
function applyOrientation() {
  clearTimeout(turnTimer);
  $('turn').hidden = !landscapeQuery.matches;
  if (landscapeQuery.matches) turnTimer = setTimeout(() => { $('turn').hidden = true; }, TURN_HINT_MS);
}
landscapeQuery.addEventListener('change', applyOrientation);

window.addEventListener('resize', () => {
  view.resize();
  if (router) router.bottom = view.bottom;
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseGame();
    audio.suspend();
  } else {
    audio.resume();
  }
});
document.addEventListener('pointerdown', () => audio.ctx?.state === 'interrupted' && audio.ctx.resume());

function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (state === 'play' || state === 'ending') {
    if (state === 'play') round.setHolds(router.holds());
    round.update(dt);
    handleEvents();
    audio.setLine(state === 'play' ? lineHeight() : null);
    if (state === 'play' && round.finished) finishRound();
  } else if (!round) {
    attract.update(dt);
  }
  const active = round ?? attract;
  view.draw(active, dt, { playing: Boolean(round), boat: !round });
  requestAnimationFrame(frame);
}

function boot() {
  view.extras = boatExtras(save);
  view.onPearl = () => audio.pearl();
  view.onStar = (i) => audio.play('star', i);
  view.onSplash = () => audio.play('boom');
  $('btnPause').setAttribute('aria-label', t('pauseLabel'));
  $('turn').innerHTML = `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round" aria-hidden="true"><rect x="10" y="26" width="80" height="48" rx="8"/><circle cx="80" cy="50" r="3" fill="currentColor"/></svg>${t('turn')}`;
  screens.splash(screen);
  applyOrientation();
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

boot();
