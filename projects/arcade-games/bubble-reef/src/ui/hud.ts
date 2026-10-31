import type { Difficulty } from '../config';
import { CONFIG } from '../config';
import type { HudSnapshot } from '../sim/simulation';
import { formatNumber, h, hiDpiCanvas, onPress } from './dom';
import { icon } from './icons';
import { drawOtto } from '../art';

export interface HudActions {
  pause(): void;
  lock(): void;
  auto(): void;
  laser(): void;
  levelUp(): void;
  levelDown(): void;
  fire(down: boolean): void;
}

const RING_R = 42;
const RING_LEN = 2 * Math.PI * RING_R;

function setClass(el: HTMLElement, name: string, on: boolean): void {
  if (el.classList.contains(name) !== on) el.classList.toggle(name, on);
}

/** The gameplay HUD (10.2). A DOM layer above the canvas; each field is written only when it changes. */
export class Hud {
  readonly root: HTMLDivElement;
  private readonly coinValue: HTMLSpanElement;
  readonly coinBox: HTMLDivElement;
  private readonly waveFill: HTMLDivElement;
  private readonly waveLabel: HTMLSpanElement;
  private readonly paradeMark: HTMLDivElement;
  private readonly bossMark: HTMLDivElement;
  private readonly bossBar: HTMLDivElement;
  private readonly bossFill: HTMLDivElement;
  private readonly bossName: HTMLSpanElement;
  private readonly timer: HTMLDivElement;
  private readonly laserBtn: HTMLButtonElement;
  private readonly laserRing: SVGCircleElement;
  private readonly lockBtn: HTMLButtonElement;
  private readonly autoBtn: HTMLButtonElement;
  private readonly levelBox: HTMLDivElement;
  private readonly levelValue: HTMLSpanElement;
  private readonly fireBtn: HTMLButtonElement;
  private readonly banner: HTMLDivElement;
  private readonly bannerText: HTMLSpanElement;
  private readonly toasts: HTMLDivElement;
  private readonly stick: HTMLDivElement;
  private readonly stickKnob: HTMLDivElement;

  private coinsTarget = 0;
  private coinsShown = 0;
  private coinsText = '';
  private last: Partial<Record<string, string | number | boolean>> = {};

  constructor(actions: HudActions) {
    this.coinValue = h('span', { class: 'coin-value' }, '0');
    this.coinBox = h('div', { class: 'coin-box', html: icon('coin') });
    this.coinBox.append(this.coinValue);

    this.waveFill = h('div', { class: 'wave-fill' });
    this.waveLabel = h('span', { class: 'wave-label' }, 'Wave 1');
    this.paradeMark = h('div', { class: 'wave-mark parade', html: icon('fish'), label: 'Fish Parade' });
    this.bossMark = h('div', { class: 'wave-mark boss', html: icon('star'), label: 'Boss' });
    const wave = h('div', { class: 'wave' }, this.waveLabel, h('div', { class: 'wave-track' }, this.waveFill), this.paradeMark, this.bossMark);

    this.timer = h('div', { class: 'timer hidden', html: icon('clock') });
    const pause = h('button', { class: 'hud-btn pause', html: icon('pause'), label: 'Pause' });
    onPress(pause, () => actions.pause());

    this.bossFill = h('div', { class: 'boss-fill' });
    this.bossName = h('span', { class: 'boss-name' });
    this.bossBar = h('div', { class: 'boss-bar hidden' }, this.bossName, h('div', { class: 'boss-track' }, this.bossFill));

    this.bannerText = h('span');
    this.banner = h('div', { class: 'banner hidden' }, this.bannerText);
    this.toasts = h('div', { class: 'toasts' });

    this.laserBtn = h('button', { class: 'hud-btn laser', label: 'Laser' });
    this.laserBtn.innerHTML = `<svg class="ring" viewBox="0 0 96 96"><circle cx="48" cy="48" r="${RING_R}" class="ring-bg"/><circle cx="48" cy="48" r="${RING_R}" class="ring-fill" stroke-dasharray="${RING_LEN}" stroke-dashoffset="${RING_LEN}" transform="rotate(-90 48 48)"/></svg>${icon('laser')}`;
    this.laserRing = this.laserBtn.querySelector('.ring-fill') as SVGCircleElement;
    onPress(this.laserBtn, () => actions.laser());

    this.lockBtn = h('button', { class: 'hud-btn lock', html: icon('target'), label: 'Lock' });
    onPress(this.lockBtn, () => actions.lock());
    this.autoBtn = h('button', { class: 'hud-btn auto', html: icon('auto'), label: 'Auto fire' });
    onPress(this.autoBtn, () => actions.auto());

    const minus = h('button', { class: 'hud-btn level', html: icon('minus'), label: 'Weaker cannon' });
    onPress(minus, () => actions.levelDown());
    const plus = h('button', { class: 'hud-btn level', html: icon('plus'), label: 'Stronger cannon' });
    onPress(plus, () => actions.levelUp());
    this.levelValue = h('span', { class: 'level-value' }, '1');
    this.levelBox = h('div', { class: 'level-box' }, minus, this.levelValue, plus);

    this.fireBtn = h('button', { class: 'hud-btn fire hidden', label: 'Fire' }, 'FIRE');
    onPress(this.fireBtn, () => actions.fire(true), () => actions.fire(false));

    this.stickKnob = h('div', { class: 'stick-knob' });
    this.stick = h('div', { class: 'stick hidden' }, this.stickKnob);

    this.root = h(
      'div',
      { class: 'hud hidden', id: 'hud' },
      h('div', { class: 'hud-top' }, pause, this.coinBox, wave, this.timer),
      this.bossBar,
      this.banner,
      this.toasts,
      this.laserBtn,
      this.levelBox,
      h('div', { class: 'hud-actions' }, this.lockBtn, this.autoBtn),
      this.fireBtn,
      this.stick,
    );
  }

  private changed(key: string, value: string | number | boolean): boolean {
    if (this.last[key] === value) return false;
    this.last[key] = value;
    return true;
  }

  configure(difficulty: Difficulty, opts: { joystick: boolean; leftHanded: boolean; laserUnlocked: boolean }): void {
    const cfg = CONFIG.difficulty[difficulty];
    setClass(this.root, 'lefty', opts.leftHanded);
    setClass(this.levelBox, 'hidden', !cfg.showLevelButtons);
    setClass(this.fireBtn, 'hidden', !opts.joystick);
    this.lockBtn.setAttribute('aria-label', cfg.autoLock ? 'Auto-lock' : 'Lock');
    setClass(this.lockBtn, 'autolock', cfg.autoLock);
    this.setLaserUnlocked(opts.laserUnlocked);
    this.last = {};
  }

  setLaserUnlocked(on: boolean): void {
    setClass(this.laserBtn, 'hidden', !on);
  }

  show(on: boolean): void {
    setClass(this.root, 'hidden', !on);
  }

  setCoins(total: number, instant = false): void {
    this.coinsTarget = total;
    if (instant) this.coinsShown = total;
  }

  addCoins(amount: number): void {
    this.coinsTarget += amount;
  }

  /** Top-of-canvas point coins fly to, in CSS pixels. */
  coinPoint(): { x: number; y: number } {
    const rect = this.coinBox.getBoundingClientRect();
    return { x: rect.left + 26, y: rect.top + rect.height / 2 };
  }

  update(snap: HudSnapshot, dt: number): void {
    const diff = this.coinsTarget - this.coinsShown;
    if (diff !== 0) {
      const step = Math.max(1, Math.ceil(Math.abs(diff) * Math.min(1, dt * 9)));
      this.coinsShown += Math.sign(diff) * Math.min(step, Math.abs(diff));
    }
    const text = formatNumber(this.coinsShown);
    if (text !== this.coinsText) {
      this.coinsText = text;
      this.coinValue.textContent = text;
    }

    if (this.changed('wave', snap.wave)) this.waveLabel.textContent = `Wave ${snap.wave}`;
    const fill = Math.round((0.72 * snap.waveProgress + 0.28 * snap.paradeProgress) * 200) / 2;
    if (this.changed('fill', fill)) this.waveFill.style.width = `${fill}%`;
    if (this.changed('bossWave', snap.isBossWave)) setClass(this.bossMark, 'hidden', !snap.isBossWave);
    if (this.changed('parade', snap.phase === 'parade')) setClass(this.paradeMark, 'active', snap.phase === 'parade');

    const showBoss = snap.bossName !== null;
    if (this.changed('bossShown', showBoss)) setClass(this.bossBar, 'hidden', !showBoss);
    if (showBoss) {
      if (this.changed('bossName', snap.bossName ?? '')) this.bossName.textContent = snap.bossName ?? '';
      const ratio = Math.round((snap.bossHp / Math.max(1, snap.bossMaxHp)) * 200) / 2;
      if (this.changed('bossHp', ratio)) this.bossFill.style.width = `${Math.max(0, ratio)}%`;
    }

    if (this.changed('level', snap.level)) this.levelValue.textContent = String(snap.level);
    if (this.changed('lockOn', snap.lockMode)) setClass(this.lockBtn, 'on', snap.lockMode);
    if (this.changed('autoOn', snap.autoFire)) setClass(this.autoBtn, 'on', snap.autoFire);

    const ratio = Math.round(Math.min(1, snap.laserRatio) * 100) / 100;
    if (this.changed('laserRatio', ratio)) this.laserRing.setAttribute('stroke-dashoffset', String(RING_LEN * (1 - ratio)));
    if (this.changed('laserReady', snap.laserReady)) setClass(this.laserBtn, 'ready', snap.laserReady);
    if (this.changed('laserActive', snap.laserActive)) setClass(this.laserBtn, 'firing', snap.laserActive);
  }

  setTimer(minutesLeft: number | null): void {
    if (!this.changed('timer', minutesLeft ?? -1)) return;
    setClass(this.timer, 'hidden', minutesLeft === null);
    if (minutesLeft !== null) {
      const label = minutesLeft <= 1 ? '<1 min' : `${minutesLeft} min`;
      this.timer.replaceChildren(h('span', { html: icon('clock') }), label);
    }
  }

  setBanner(text: string | null): void {
    setClass(this.banner, 'hidden', text === null);
    if (text !== null) this.bannerText.textContent = text;
  }

  toast(message: string, pose: 'idle' | 'cheer' | 'point' = 'point', ms = 4200): void {
    const otto = hiDpiCanvas(64, 64, (ctx) => drawOtto(ctx, pose, 32, 62, 60));
    const el = h('div', { class: 'toast' }, otto, h('span', {}, message));
    this.toasts.append(el);
    window.setTimeout(() => {
      el.classList.add('leaving');
      window.setTimeout(() => el.remove(), 320);
    }, ms);
  }

  setStick(stick: { baseX: number; baseY: number; knobX: number; knobY: number } | null): void {
    setClass(this.stick, 'hidden', stick === null);
    if (!stick) return;
    this.stick.style.transform = `translate(${stick.baseX}px, ${stick.baseY}px)`;
    this.stickKnob.style.transform = `translate(${stick.knobX - stick.baseX}px, ${stick.knobY - stick.baseY}px)`;
  }
}
