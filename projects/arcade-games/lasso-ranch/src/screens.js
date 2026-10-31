// Menu screens as DOM on top of the canvas. Buttons carry data-act; main.js owns what each one does.
import { ANIMALS, COSMETICS, DIFFICULTY, LEVELS, STICKER_ORDER } from './data.js';
import { portrait, hatIcon, drawMascot } from './art.js';
import { fact, t } from './strings.js';
import { totalStars } from './save.js';

const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zm2 0h6V7a3 3 0 0 0-6 0z"/></svg>';
// A little ranch behind the level trail. Stretches with the map, so it stays simple.
const SCENERY = `<svg class="scenery" viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true">
  <circle cx="700" cy="56" r="38" fill="#fff0a0"/>
  <g fill="#fff"><ellipse cx="170" cy="62" rx="62" ry="20"/><circle cx="150" cy="50" r="24"/><circle cx="192" cy="44" r="30"/><ellipse cx="620" cy="44" rx="48" ry="16"/><circle cx="606" cy="34" r="19"/><circle cx="638" cy="30" r="23"/></g>
  <path d="M0 150 C160 84 300 150 470 118 S800 70 1000 134 V560 H0Z" fill="#8fd962"/>
  <path d="M0 250 C200 190 340 262 560 214 S860 200 1000 240 V560 H0Z" fill="#74cb4f"/>
  <path d="M0 400 C220 350 420 420 640 372 S900 362 1000 396 V560 H0Z" fill="#62bd45"/>
  <g stroke="#2d6b1c" stroke-width="4" stroke-linejoin="round">
    <g fill="#57b548"><circle cx="92" cy="134" r="26"/><circle cx="60" cy="146" r="20"/><circle cx="124" cy="146" r="20"/><circle cx="938" cy="172" r="22"/><circle cx="966" cy="184" r="18"/><circle cx="910" cy="184" r="17"/><circle cx="520" cy="96" r="18"/><circle cx="498" cy="106" r="14"/><circle cx="542" cy="106" r="14"/></g>
  </g>
  <g stroke="#4c1d13" stroke-width="4" stroke-linejoin="round">
    <path d="M744 170v-58l26-30h56l26 30v58z" fill="#d8452f"/><path d="M732 116l34-42h64l34 42-12 4-28-34h-52l-28 34z" fill="#6f5243"/><rect x="778" y="128" width="40" height="42" fill="#fff"/><path d="M778 128l40 42m0-42l-40 42" stroke="#d8452f" stroke-width="4"/>
  </g>
  <g fill="#fff"><circle cx="330" cy="470" r="5"/><circle cx="740" cy="500" r="5"/><circle cx="130" cy="330" r="5"/><circle cx="910" cy="440" r="5"/></g>
  <g fill="#ff8fb5"><circle cx="520" cy="500" r="6"/><circle cx="60" cy="480" r="6"/><circle cx="690" cy="300" r="5"/></g>
  <g fill="#ffd23f"><circle cx="230" cy="510" r="5"/><circle cx="860" cy="520" r="5"/><circle cx="440" cy="290" r="4"/></g>
</svg>`;
// Where a level's new animal stands to stay clear of the trail, which falls, bottoms out, climbs, then peaks.
const FRIEND_SPOT = ['lower-left', 'lower-right', 'up-left', 'up-right'];
const SCENES = { bg_sunny: 'linear-gradient(#54b8f0 55%, #8ed44f 55%)', bg_sunset: 'linear-gradient(#f2734f, #ffd27f 55%, #c2bf4a 55%)', bg_blossom: 'linear-gradient(#8fd3f4, #fbe0ee 55%, #a3e27a 55%)' };

const header = (title, side = '') => `
  <div class="panel-head">
    <button class="wood-btn small plain" data-act="back">${t('back')}</button>
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

const logo = () => `<div class="sign">
  <span class="slot sign-friend left" data-id="A1"></span>
  <h1 class="logo">${t('title')}</h1>
  <span class="slot sign-friend right" data-id="A2"></span>
</div>`;

function paintBiscuit(canvas, state, hat) {
  const c = canvas.getContext('2d');
  c.scale(1.2, 1.2);
  c.translate(150, 390);
  drawMascot(c, state, 0, hat);
}

function addBuddy(screen, state, hat) {
  const canvas = document.createElement('canvas');
  canvas.className = 'buddy';
  canvas.width = 400;
  canvas.height = 480;
  paintBiscuit(canvas, state, hat);
  screen.append(canvas);
}

export function splash(screen) {
  fill(screen, `${logo()}<p class="tagline">${t('tapToStart')}</p>`);
  place(screen, '.sign-friend', (id) => portrait(id, 130, 'run', true));
}

export function menu(screen, showInstall) {
  fill(screen, `
    ${logo()}
    <div class="menu-btns">
      <button class="wood-btn green play" data-act="play">${t('play')}</button>
      <button class="wood-btn" data-act="stickers">${t('stickers')}</button>
      <button class="wood-btn" data-act="wardrobe">${t('wardrobe')}</button>
      <button class="wood-btn" data-act="settings">${t('settings')}</button>
    </div>
    ${showInstall ? `<div class="install"><b>${t('installTitle')}</b>${t('installBody')}<br><button class="wood-btn small plain" data-act="dismiss-install">${t('ok')}</button></div>` : ''}`);
  place(screen, '.sign-friend', (id) => portrait(id, 130, 'run', true));
}

export function difficulty(screen, save) {
  const icons = { easy: 'A1', medium: 'A2', hard: 'A5' };
  const cards = Object.entries(DIFFICULTY).map(([id, mode]) => {
    const done = Object.values(save.progress[id].levels).reduce((sum, level) => sum + level.stars, 0);
    return `<button class="mode-card ${id === save.difficulty ? 'on' : ''}" data-act="mode" data-id="${id}">
      <span class="slot" data-id="${icons[id]}"></span>${mode.label}<small>${mode.ages}</small><em>★ ${done}</em>
    </button>`;
  }).join('');
  fill(screen, `<div class="panel">${header(t('chooseMode'))}<div class="mode-grid">${cards}</div></div>`, { dim: true });
  place(screen, '.slot', (id) => portrait(id, 118));
}

export function levelMap(screen, save) {
  const mode = save.progress[save.difficulty];
  const position = (i) => ({
    x: 6 + (i * 88) / (LEVELS.length - 1),
    y: 46 + Math.sin((i * Math.PI) / 2) * 30,
  });
  const trail = LEVELS.map((_, i) => position(i)).map((p, i, all) => {
    if (!i) return `M${p.x} ${p.y}`;
    const mid = (all[i - 1].x + p.x) / 2;
    return `C${mid} ${all[i - 1].y} ${mid} ${p.y} ${p.x} ${p.y}`;
  }).join(' ');
  const nodes = LEVELS.map((level, i) => {
    const p = position(i);
    const number = level.level;
    const locked = number > mode.unlockedLevel;
    const stars = mode.levels[number]?.stars ?? 0;
    const current = number === mode.unlockedLevel;
    const row = locked ? '' : `<span class="node-stars"><b>${'★'.repeat(stars)}</b>${'★'.repeat(3 - stars)}</span>`;
    const friend = level.introduce ? `<span class="slot map-friend ${i ? FRIEND_SPOT[i % 4] : 'up-right'}" data-id="${level.introduce[0]}" data-got="${locked ? '' : 'yes'}"></span>` : '';
    return `<button class="map-node ${locked ? 'locked' : ''} ${current ? 'current' : ''}" style="left:${p.x}%;top:${p.y}%"
      ${locked ? 'disabled aria-label="Locked"' : `data-act="level" data-id="${number}"`}>${locked ? LOCK : number}${row}${friend}</button>`;
  }).join('');
  const road = (color, width, dash = '') => `<path d="${trail}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" ${dash} vector-effect="non-scaling-stroke"/>`;
  fill(screen, `<div class="panel wide">
    ${header(t('chooseLevel'), `<button class="wood-btn small plain" data-act="modes">${DIFFICULTY[save.difficulty].label}</button>`)}
    <div class="map">${SCENERY}<svg class="trail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${road('#8a6236', 26)}${road('#f0d7a2', 18)}${road('#fff8e6', 3, 'stroke-dasharray="14 16"')}</svg>${nodes}</div>
  </div>`, { dim: true });
  place(screen, '.map-friend', (id, slot) => portrait(id, 74, 'run', slot.dataset.got === 'yes'));
}

export function pause(screen) {
  fill(screen, `<div class="panel narrow"><h2 class="solo">${t('pause')}</h2>
    <div class="btn-row">
      <button class="wood-btn green" data-act="resume">${t('resume')}</button>
      <button class="wood-btn" data-act="retry">${t('restart')}</button>
      <button class="wood-btn plain" data-act="map">${t('map')}</button>
    </div></div>`, { dim: true });
}

export function fail(screen, { score, target, gentle, showHelper, hat }) {
  fill(screen, `<div class="panel narrow">
    <h2 class="solo">${gentle ? t('failGentle') : t('failTitle')}</h2>
    <p>${t('failScore', { score, target })}</p>
    ${gentle ? `<p>${t('hintEasy')}</p>` : ''}
    ${showHelper ? `<p>${t('helperOffer')}</p>` : ''}
    <div class="btn-row">
      ${showHelper ? `<button class="wood-btn green" data-act="helper">${t('helperAccept')}</button>` : ''}
      <button class="wood-btn ${showHelper ? '' : 'green'}" data-act="retry">${t('retry')}</button>
      <button class="wood-btn plain" data-act="map">${t('map')}</button>
    </div></div>`, { dim: true });
  addBuddy(screen, 'wince', hat);
}

export function results(screen, { level, score, stars, best, newBest, hasNext, hat }) {
  fill(screen, `<div class="panel narrow">
    <h2 class="solo">${t('level', { n: level })}</h2>
    <div class="stars">${[0, 1, 2].map((i) => `<span data-star="${i}">★</span>`).join('')}</div>
    <div class="score-line">${score}</div>
    <div class="best-line">${newBest ? `<span class="new-best">${t('newBest')}</span>` : t('best', { n: best })}</div>
    ${hasNext ? '' : `<p>${t('allDone')}</p>`}
    <div class="btn-row">
      ${hasNext ? `<button class="wood-btn green" data-act="next">${t('next')}</button>` : ''}
      <button class="wood-btn" data-act="retry">${t('retry')}</button>
      <button class="wood-btn plain" data-act="map">${t('map')}</button>
    </div></div>`, { dim: true });
  addBuddy(screen, 'laugh', hat);
  return Array.from({ length: stars }, (_, i) => screen.querySelector(`[data-star="${i}"]`));
}

export function stickers(screen, save, selected = null) {
  const tiles = STICKER_ORDER.map((id) => {
    const got = save.stickers.includes(id);
    return `<button class="sticker ${got ? 'got' : ''} ${ANIMALS[id].special ? 'gold' : ''} ${id === selected ? 'on' : ''}" data-act="sticker" data-id="${id}">
      <span class="slot" data-id="${id}" data-got="${got ? 'yes' : ''}"></span>${got ? ANIMALS[id].name : '?'}</button>`;
  }).join('');
  const text = selected ? (save.stickers.includes(selected) ? fact(selected) : t('stickerLocked')) : '';
  fill(screen, `<div class="panel">
    ${header(t('stickers'), t('stickerProgress', { n: save.stickers.length, total: STICKER_ORDER.length }))}
    <div class="scroll"><div class="sticker-grid">${tiles}</div></div>
    <div class="fact">${text}</div></div>`, { dim: true });
  place(screen, '.slot', (id, slot) => portrait(id, 132, 'run', slot.dataset.got === 'yes'));
}

export function wardrobe(screen, save) {
  const owned = save.cosmetics.owned;
  const equipped = save.cosmetics.equipped;
  const tile = (slot, item, inner) => {
    const unlocked = owned.includes(item.id);
    return `<button class="tile ${equipped[slot] === item.id ? 'on' : ''} ${unlocked ? '' : 'locked'}"
      ${unlocked ? `data-act="equip" data-slot="${slot}" data-id="${item.id}"` : 'disabled'}>
      ${inner}<span class="${unlocked ? '' : 'need'}">${unlocked ? item.label : `★ ${item.stars}`}</span></button>`;
  };
  const ropes = COSMETICS.rope.map((item) => tile('rope', item, `<span class="swatch" style="background:linear-gradient(90deg,${item.colors.join(',')})"></span>`)).join('');
  const hats = `<button class="tile ${equipped.hat ? '' : 'on'}" data-act="equip" data-slot="hat" data-id=""><span>${t('noHat')}</span></button>` +
    COSMETICS.hat.map((item) => tile('hat', item, `<span class="slot" data-id="${item.id}"></span>`)).join('');
  const scenes = COSMETICS.background.map((item) => tile('background', item, `<span class="scene" style="background:${SCENES[item.id]}"></span>`)).join('');

  fill(screen, `<div class="panel">
    ${header(t('wardrobe'), `★ ${totalStars(save)}`)}
    <div class="ward"><canvas id="wardMascot" width="400" height="480"></canvas>
      <div class="ward-rows scroll">
        <div class="ward-row"><h3>${t('rope')}</h3><div class="tiles">${ropes}</div></div>
        <div class="ward-row"><h3>${t('hat')}</h3><div class="tiles">${hats}</div></div>
        <div class="ward-row"><h3>${t('background')}</h3><div class="tiles">${scenes}</div></div>
      </div></div></div>`, { dim: true });
  place(screen, '.slot', (id) => hatIcon(id, 58));

  paintBiscuit(screen.querySelector('#wardMascot'), 'cheer', equipped.hat);
}

export function settings(screen, save) {
  const s = save.settings;
  fill(screen, `<div class="panel">
    ${header(t('settings'))}
    <div class="scroll">
      <label class="setting">${t('music')}<input type="range" min="0" max="1" step="0.05" value="${s.music}" data-input="music"></label>
      <label class="setting">${t('sfx')}<input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-input="sfx"></label>
      <div class="setting">${t('tapOnLane')}<button class="toggle ${s.tapOnLane ? 'on' : ''}" data-act="toggle" data-id="tapOnLane" aria-label="${t('tapOnLane')}"></button></div>
      <div class="setting">${t('breakReminder')}<button class="toggle ${s.breakReminder ? 'on' : ''}" data-act="toggle" data-id="breakReminder" aria-label="${t('breakReminder')}"></button></div>
      <button class="hold" id="resetHold"><i></i><span>${t('resetHold')}</span></button>
    </div></div>`, { dim: true });
}

export function breakCard(screen) {
  fill(screen, `<div class="panel narrow"><h2 class="solo">${t('breakTitle')}</h2><p>${t('breakBody')}</p>
    <div class="btn-row">
      <button class="wood-btn green" data-act="break-continue">${t('continue')}</button>
      <button class="wood-btn plain" data-act="break-stop">${t('stop')}</button>
    </div></div>`, { dim: true });
}
