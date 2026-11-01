// Menu screens as DOM on top of the canvas. Buttons carry data-act; main.js owns what each one does.
import { CREATURES, FINDS, LEVELS, STICKER_ORDER } from './data.js';
import { boatPortrait, portrait } from './art.js';
import { fact, levelName, t } from './strings.js';

const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zm2 0h6V7a3 3 0 0 0-6 0z"/></svg>';
const LEVEL_FRIENDS = ['bobble', 'shelby', 'hum'];

const nameOf = (id) => (CREATURES[id] ?? FINDS[id]).name;

const header = (title, side = '') => `
  <div class="panel-head">
    <button class="pop-btn small plain" data-act="home">${t('back')}</button>
    <h2>${title}</h2>
    <div class="side">${side}</div>
  </div>`;

function fill(screen, html, { dim = false } = {}) {
  screen.className = dim ? 'dim' : '';
  screen.innerHTML = html;
  screen.hidden = false;
}

function place(screen, selector, make) {
  screen.querySelectorAll(selector).forEach((slot) => slot.replaceChildren(make(slot.dataset.id, slot)));
}

const logo = () => `<h1 class="logo">Plop <span>&amp;</span> Pull</h1>`;

export function splash(screen) {
  fill(screen, `<div class="title-stack">${logo()}<p class="tagline">${t('tapToStart')}</p></div>`);
}

export function menu(screen, save, showInstall) {
  const depths = LEVELS.map(({ level }) => {
    const locked = level > save.unlocked;
    const stars = save.levels[level]?.stars ?? 0;
    const row = locked ? '' : `<span class="depth-stars"><b>${'★'.repeat(stars)}</b>${'★'.repeat(3 - stars)}</span>`;
    return `<button class="depth depth-${level} ${locked ? 'locked' : ''} ${level === save.unlocked && !stars ? 'current' : ''}"
      ${locked ? `disabled aria-label="${t('locked')}"` : `data-act="level" data-id="${level}"`}>
      <span class="depth-num">${locked ? LOCK : level}</span>
      <span class="depth-name">${levelName(level)}${row}</span>
      <span class="slot" data-id="${LEVEL_FRIENDS[level - 1]}" data-locked="${locked ? 'yes' : ''}"></span>
    </button>`;
  }).join('');
  fill(screen, `
    ${logo()}
    <div class="depths">${depths}</div>
    <div class="menu-row">
      <button class="pick ${save.players === 1 ? 'on' : ''}" data-act="players" data-id="1" aria-label="${t('onePlayer')}"><span class="boat-slot" data-id="capy"></span></button>
      <button class="pick ${save.players === 2 ? 'on' : ''}" data-act="players" data-id="2" aria-label="${t('twoPlayers')}"><span class="boat-slot" data-id="capy"></span><span class="boat-slot flip" data-id="duck"></span></button>
      <button class="pop-btn small" data-act="stickers">${t('stickers')}</button>
      <button class="pop-btn small plain" data-act="settings">${t('settings')}</button>
    </div>
    ${showInstall ? `<div class="install"><b>${t('installTitle')}</b>${t('installBody')}<br><button class="pop-btn small plain" data-act="dismiss-install">${t('ok')}</button></div>` : ''}`);
  place(screen, '.depth .slot', (id) => portrait(id, 96));
  place(screen, '.boat-slot', (id) => boatPortrait(id, 76));
}

export function pause(screen) {
  fill(screen, `<div class="panel narrow"><h2 class="solo">${t('pause')}</h2>
    <div class="btn-row">
      <button class="pop-btn green" data-act="resume">${t('resume')}</button>
      <button class="pop-btn" data-act="retry">${t('restart')}</button>
      <button class="pop-btn plain" data-act="home">${t('home')}</button>
    </div></div>`, { dim: true });
}

export function results(screen, { level, pearls, stars, best, newBest }) {
  const last = level === LEVELS.length;
  fill(screen, `<div class="panel narrow">
    <h2 class="solo">${levelName(level)}</h2>
    <div class="stars">${[0, 1, 2].map((i) => `<span data-star="${i}">★</span>`).join('')}</div>
    <div class="score-line"><i class="pearl-dot"></i>${pearls}</div>
    <div class="best-line">${newBest ? `<span class="new-best">${t('newBest')}</span>` : t('best', { n: best })}</div>
    <div class="btn-row">
      <button class="pop-btn green" data-act="${last ? 'goodnight' : 'next'}">${t(last ? 'goodnight' : 'next')}</button>
      <button class="pop-btn" data-act="retry">${t('again')}</button>
      <button class="pop-btn plain" data-act="home">${t('home')}</button>
    </div></div>`, { dim: true });
  return Array.from({ length: stars }, (_, i) => screen.querySelector(`[data-star="${i}"]`));
}

export function goodnight(screen, save) {
  const friends = STICKER_ORDER.filter((id) => save.stickers.includes(id) && id in CREATURES);
  fill(screen, `<div class="night">
    <div class="moon"></div>
    <h2>${t('nightTitle')}</h2>
    <p>${t('nightBody')}</p>
    <div class="night-friends">${friends.map((id) => `<span class="slot" data-id="${id}"></span>`).join('')}</div>
    <button class="pop-btn" data-act="home">${t('home')}</button>
  </div>`);
  place(screen, '.night-friends .slot', (id) => portrait(id, 112, { happy: true }));
}

export function stickers(screen, save, selected = null) {
  const tiles = STICKER_ORDER.map((id) => {
    const got = save.stickers.includes(id);
    return `<button class="sticker ${got ? 'got' : ''} ${id === selected ? 'on' : ''}" data-act="sticker" data-id="${id}">
      <span class="slot" data-id="${id}"></span>${got ? nameOf(id) : '?'}</button>`;
  }).join('');
  const text = selected ? (save.stickers.includes(selected) ? fact(selected) : t('stickerLocked')) : '';
  fill(screen, `<div class="panel tall">
    ${header(t('stickers'), t('stickerProgress', { n: save.stickers.length, total: STICKER_ORDER.length }))}
    <div class="scroll"><div class="sticker-grid">${tiles}</div></div>
    <div class="fact">${text}</div></div>`, { dim: true });
  place(screen, '.sticker .slot', (id) => portrait(id, 128));
}

export function settings(screen, save, memoryMb) {
  const s = save.settings;
  fill(screen, `<div class="panel">
    ${header(t('settings'))}
    <label class="setting">${t('music')}<input type="range" min="0" max="1" step="0.05" value="${s.music}" data-input="music"></label>
    <label class="setting">${t('sfx')}<input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-input="sfx"></label>
    <button class="hold" id="resetHold"><i></i><span>${t('resetHold')}</span></button>
    <p class="fine">${t('memory', { n: memoryMb })}</p>
  </div>`, { dim: true });
}

export function stickerToast(id) {
  const node = document.createElement('div');
  node.className = 'toast sticker-toast';
  node.append(portrait(id, 72));
  node.append(t('newSticker', { name: nameOf(id) }));
  return node;
}
