// Boot, game loop and screen flow.
import { ANIMALS, BREAK_AFTER_SECONDS, COSMETICS, DIFFICULTY, HELPER_HORSE, LEVELS, ROWS } from './data.js';
import { levelConfig, Round, starsFor } from './sim.js';
import { addSticker, loadSave, recordResult, unlockCosmetics, writeSave, defaultSave } from './save.js';
import { GameAudio } from './audio.js';
import { portrait } from './art.js';
import { View } from './render.js';
import { t } from './strings.js';
import * as screens from './screens.js';

const $ = (id) => document.getElementById(id);
const storage = (() => {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => {} };
  }
})();

const CATCH_SOUND = { A1: 'calf', A2: 'moo', A3: 'bellow', A4: 'moo', A5: 'snort', S1: 'sparkle' };
const HIDDEN_RESET_MS = 5 * 60 * 1000;
const INTRO_MS = 2200;
const portraitQuery = window.matchMedia('(orientation: portrait)');

const save = loadSave(storage);
const audio = new GameAudio();
const view = new View($('field'));
const screen = $('screen');
const banner = $('banner');

let state = 'splash';
let round = null;
let config = null;
let attract = null;
let level = 1;
let helper = false;
let mainScore = 0;
let total = 0;
const fails = {};
let lastFrame = performance.now();
let playedSeconds = 0;
let hiddenAt = 0;
let breakPending = false;
let timers = [];

function persist() {
  writeSave(storage, save);
}

function later(fn, ms) {
  const id = setTimeout(fn, ms);
  timers.push(id);
}

function clearTimers() {
  timers.forEach(clearTimeout);
  timers = [];
}

function applyCosmetics() {
  const rope = COSMETICS.rope.find((item) => item.id === save.cosmetics.equipped.rope);
  view.ropeColors = rope.colors;
  view.hat = save.cosmetics.equipped.hat;
  view.setTheme(save.cosmetics.equipped.background);
}

function showBanner(html, className = '') {
  banner.className = className;
  banner.innerHTML = html;
  banner.hidden = false;
}

function hideBanner() {
  banner.hidden = true;
}

function toast(text) {
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = text;
  $('toasts').append(node);
  setTimeout(() => node.remove(), 2600);
}

function gameplayVisible(visible) {
  $('hud').hidden = !visible;
  $('controls').hidden = !visible;
}

function showAttract() {
  if (!attract) attract = new Round({ config: levelConfig(8, 'easy'), attract: true, bounds: view.bounds });
  round = null;
  document.body.classList.remove('bonus');
  gameplayVisible(false);
  hideBanner();
  audio.setMusic('menu');
}

function goto(name) {
  clearTimers();
  state = name;
  showAttract();
  if (name === 'menu') {
    screens.menu(screen, installHintNeeded());
  } else if (name === 'difficulty') {
    screens.difficulty(screen, save);
  } else if (name === 'map') {
    screens.levelMap(screen, save);
  } else if (name === 'stickers') {
    screens.stickers(screen, save);
  } else if (name === 'wardrobe') {
    screens.wardrobe(screen, save);
  } else if (name === 'settings') {
    screens.settings(screen, save);
    bindHoldToReset();
  }
  offerBreak();
}

function installHintNeeded() {
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  return iOS && !standalone && !save.installHintSeen;
}

function offerBreak() {
  if (!breakPending || !save.settings.breakReminder) return;
  breakPending = false;
  playedSeconds = 0;
  screens.breakCard(screen);
}

function startLevel(number, { useHelper = false } = {}) {
  clearTimers();
  level = number;
  helper = useHelper;
  config = levelConfig(level, save.difficulty, { helper });
  screen.hidden = true;
  round = new Round({ config, bounds: view.bounds, rng: Math.random });
  round.drainEvents();
  setupControls();
  gameplayVisible(true);
  document.body.classList.remove('bonus');
  updateHud();
  state = 'intro';
  audio.setMusic('game');

  const def = LEVELS[level - 1];
  const fresh = (def.introduce ?? []).find((id) => config.pool.includes(id));
  const hazard = fresh && ANIMALS[fresh].hazard;
  const lines = [`<h2>${t('level', { n: level })}</h2><p>${t('target', { n: config.target })}</p>`];
  if (fresh) lines.unshift('<div id="introFace"></div>');
  if (fresh) lines.push(`<p>${t(hazard ? 'newHazard' : 'newFriend', { name: ANIMALS[fresh].name })}</p>`);
  if (helper) lines.push(`<p>${t('helperActive')}</p>`);
  showBanner(lines.join(''));
  if (fresh) $('introFace').append(portrait(fresh, 150));
  later(() => {
    hideBanner();
    state = 'play';
    audio.play('fanfare');
    showTutorial(def);
  }, INTRO_MS);
}

function showTutorial(def) {
  const key = def.tutorial === 'hazard' && config.pool.includes('H1') ? 'tutorialHazard'
    : def.tutorial === 'throw' ? (config.oneTap ? 'tutorialEasy' : 'tutorialStandard') : null;
  if (!key) return;
  showBanner(`<p>${t(key)}</p>`, 'tip');
  if (def.tutorial === 'throw') document.querySelectorAll('#controls .lane-btn').forEach((b) => b.classList.add('nudge'));
  later(() => {
    hideBanner();
    document.querySelectorAll('.nudge').forEach((b) => b.classList.remove('nudge'));
  }, 5000);
}

function setupControls() {
  const three = config.lanes.length === 3;
  $('controls').className = config.oneTap ? 'one-tap' : '';
  $('btnThrow').hidden = config.oneTap;
  $('btnCentre').hidden = !three;
  $('btnThrow').textContent = t('throw');
  $('btnLeft').setAttribute('aria-label', t('left'));
  $('btnRight').setAttribute('aria-label', t('right'));
  $('btnCentre').setAttribute('aria-label', t('centre'));
  $('hudLevel').textContent = t('level', { n: level });
}

function laneIndexFor(button) {
  const last = config.lanes.length - 1;
  if (button === 'left') return 0;
  if (button === 'right') return last;
  return 1;
}

function pressLane(button) {
  if (state !== 'play' && state !== 'bonus') return;
  const lane = laneIndexFor(button);
  if (config.oneTap) round.throwLasso(lane);
  else round.selectLane(lane);
}

function pressThrow() {
  if (state === 'play' || state === 'bonus') round.throwLasso();
}

function press(button, action) {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    button.classList.add('pressed');
    setTimeout(() => button.classList.remove('pressed'), 100);
    action();
  });
}

function updateHud() {
  const shown = state === 'bonus' ? total + round.score : round.score;
  const progress = Math.min(1, shown / config.target);
  $('hudBar').style.width = `${progress * 100}%`;
  $('hudBar').classList.toggle('met', progress >= 1);
  $('hudGoal').textContent = `${shown} / ${config.target}`;
  $('hudScore').textContent = shown;
  const seconds = Math.ceil(round.time);
  $('hudTime').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  $('hudTime').classList.toggle('urgent', seconds <= 10);
  const multiplier = round.multiplier;
  const combo = $('hudCombo');
  combo.hidden = multiplier <= 1;
  if (multiplier > 1) combo.textContent = `x${multiplier}`;

  const lanes = config.lanes.length;
  $('btnLeft').classList.toggle('on', !config.oneTap && round.selectedLane === 0);
  $('btnRight').classList.toggle('on', !config.oneTap && round.selectedLane === lanes - 1);
  $('btnCentre').classList.toggle('on', !config.oneTap && lanes === 3 && round.selectedLane === 1);
  $('controls').classList.toggle('cooling', !round.ready);
}

function handleEvents() {
  for (const event of round.drainEvents()) {
    view.handleEvent(event, round);
    if (event.type === 'throw') audio.play('throw');
    else if (event.type === 'blocked') audio.play('blocked');
    else if (event.type === 'miss') audio.play('miss');
    else if (event.type === 'golden') audio.play('sparkle');
    else if (event.type === 'jam') audio.play('jam');
    else if (event.type === 'boss') audio.play('bellow');
    else if (event.type === 'catch') {
      audio.play('yank');
      audio.play('point', event.points);
      audio.play(CATCH_SOUND[event.animal.type]);
      if ([3, 6].includes(event.streak)) audio.play('combo');
      award(event.animal.type);
    } else if (event.type === 'hazard') {
      audio.play(event.hazard === 'stink' ? 'stink' : 'jam');
      award(event.animal.type);
    }
  }
}

function award(type) {
  if (!addSticker(save, type)) return;
  persist();
  toast(t('newSticker', { name: ANIMALS[type].name }));
}

function finishRound() {
  if (state === 'play') {
    mainScore = round.score;
    if (mainScore >= config.target) startBonus();
    else showFail();
  } else if (state === 'bonus') {
    total = mainScore + round.score;
    showResults();
  }
}

function startBonus() {
  state = 'bonusIntro';
  showBanner(`<h2>${t('stampede')}</h2><p>${t('stampedeHint')}</p>`, 'stampede');
  audio.setMusic(null);
  audio.play('fanfare');
  view.celebrate();
  later(() => {
    hideBanner();
    total = mainScore;
    round = new Round({ config, bonus: true, bounds: view.bounds });
    round.drainEvents();
    document.body.classList.add('bonus');
    state = 'bonus';
    audio.setMusic('bonus');
    if (document.hidden || portraitQuery.matches) pauseGame();
  }, 1800);
}

function showFail() {
  state = 'fail';
  audio.setMusic(null);
  audio.play('fail');
  view.say('wince', t('failTitle'), '', 4);
  const key = `${save.difficulty}-${level}`;
  fails[key] = (fails[key] ?? 0) + 1;
  const gentle = DIFFICULTY[save.difficulty].gentleFail;
  const showHelper = save.difficulty === 'easy' && fails[key] >= HELPER_HORSE.afterFails && !helper;
  screens.fail(screen, { score: mainScore, target: config.target, gentle, showHelper, hat: save.cosmetics.equipped.hat });
  offerBreak();
}

function showResults() {
  state = 'results';
  document.body.classList.remove('bonus');
  audio.setMusic(null);
  audio.play('jingle');
  view.celebrate();
  delete fails[`${save.difficulty}-${level}`];
  const stars = starsFor(total, config.target);
  const outcome = recordResult(save, save.difficulty, level, stars, total);
  persist();
  const lit = screens.results(screen, {
    level, score: total, stars, best: outcome.best, newBest: outcome.newBest, hasNext: level < LEVELS.length, hat: save.cosmetics.equipped.hat,
  });
  lit.forEach((node, i) => later(() => {
    node.classList.add('lit');
    audio.play('star', i);
  }, 450 + i * 450));
  outcome.unlocked.forEach((item, i) => later(() => toast(t('unlockedItem', { label: item.label })), 1800 + i * 900));
  later(offerBreak, 2600);
}

function pauseGame() {
  if (state === 'play' || state === 'bonus') {
    state = { play: 'pause', bonus: 'pauseBonus' }[state];
    audio.setMusic(null);
    screens.pause(screen);
  } else if (state === 'intro') {
    clearTimers();
    hideBanner();
    state = 'pause';
    audio.setMusic(null);
    screens.pause(screen);
  }
}

function resumeGame() {
  const bonus = state === 'pauseBonus';
  screen.hidden = true;
  state = bonus ? 'bonus' : 'play';
  audio.setMusic(bonus ? 'bonus' : 'game');
}

const actions = {
  start() {
    audio.setVolumes(save.settings.music, save.settings.sfx);
    audio.unlock();
    goto('menu');
  },
  play: () => goto('difficulty'),
  stickers: () => goto('stickers'),
  wardrobe: () => goto('wardrobe'),
  settings: () => goto('settings'),
  back: () => goto('menu'),
  modes: () => goto('difficulty'),
  'dismiss-install'() {
    save.installHintSeen = true;
    persist();
    screen.querySelector('.install')?.remove();
  },
  mode(id) {
    save.difficulty = id;
    persist();
    goto('map');
  },
  level: (id) => startLevel(Number(id)),
  next: () => startLevel(level + 1),
  retry: () => startLevel(level),
  helper: () => startLevel(level, { useHelper: true }),
  map: () => goto('map'),
  resume: resumeGame,
  sticker: (id) => screens.stickers(screen, save, id),
  equip(id, node) {
    save.cosmetics.equipped[node.dataset.slot] = id || null;
    persist();
    applyCosmetics();
    screens.wardrobe(screen, save);
  },
  toggle(id) {
    save.settings[id] = !save.settings[id];
    persist();
    screens.settings(screen, save);
    bindHoldToReset();
  },
  'break-continue'() {
    goto(state === 'results' || state === 'fail' ? 'map' : state);
  },
  'break-stop': () => goto('menu'),
};

function bindHoldToReset() {
  const hold = $('resetHold');
  let timer = 0;
  hold.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    hold.classList.add('holding');
    timer = setTimeout(() => {
      hold.classList.remove('holding');
      const fresh = defaultSave();
      Object.assign(save, fresh, { settings: save.settings });
      persist();
      applyCosmetics();
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

press($('btnLeft'), () => pressLane('left'));
press($('btnRight'), () => pressLane('right'));
press($('btnCentre'), () => pressLane('centre'));
press($('btnThrow'), pressThrow);
press($('btnPause'), pauseGame);

$('field').addEventListener('pointerdown', (event) => {
  if (!save.settings.tapOnLane || (state !== 'play' && state !== 'bonus')) return;
  const point = view.toWorld(event.clientX, event.clientY);
  if (point.y > ROWS[0].y) return;
  const lanes = config.lanes;
  const nearest = lanes.reduce((best, x, i) => (Math.abs(x - point.x) < Math.abs(lanes[best] - point.x) ? i : best), 0);
  round.throwLasso(nearest);
});

for (const type of ['gesturestart', 'gesturechange', 'dblclick', 'contextmenu']) {
  document.addEventListener(type, (event) => event.preventDefault());
}
document.addEventListener('touchmove', (event) => {
  if (!event.target.closest?.('.scroll, input')) event.preventDefault();
}, { passive: false });

function applyOrientation() {
  const upright = portraitQuery.matches;
  $('rotate').hidden = !upright;
  if (upright) pauseGame();
}
portraitQuery.addEventListener('change', applyOrientation);

window.addEventListener('resize', () => {
  view.resize();
  if (round) round.bounds = view.bounds;
  if (attract) attract.bounds = view.bounds;
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    pauseGame();
    audio.suspend();
  } else {
    if (Date.now() - hiddenAt > HIDDEN_RESET_MS) playedSeconds = 0;
    audio.resume();
  }
});
document.addEventListener('pointerdown', () => audio.ctx?.state === 'interrupted' && audio.ctx.resume());

function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (!document.hidden && state !== 'splash') {
    playedSeconds += dt;
    if (playedSeconds >= BREAK_AFTER_SECONDS) breakPending = true;
  }

  if (state === 'play' || state === 'bonus') {
    round.update(dt);
    handleEvents();
    updateHud();
    if (round.finished) finishRound();
  } else if (state === 'intro' || state === 'bonusIntro') {
    round.stepHerd(dt);
    round.drainEvents();
  } else if (!round) {
    attract.update(dt);
    attract.drainEvents();
  }
  view.draw(round ?? attract, dt, { playing: Boolean(round), mascot: state !== 'results' && state !== 'fail' });
  requestAnimationFrame(frame);
}

function boot() {
  $('rotate').innerHTML = `<svg viewBox="0 0 100 100" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round" aria-hidden="true"><rect x="26" y="10" width="48" height="80" rx="8"/><circle cx="50" cy="80" r="3" fill="#fff"/></svg>${t('rotate')}`;
  unlockCosmetics(save);
  applyCosmetics();
  attract = new Round({ config: levelConfig(8, 'easy'), attract: true, bounds: view.bounds });
  screens.splash(screen);
  applyOrientation();
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

boot();
