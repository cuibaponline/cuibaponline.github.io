type Child = Node | string | number | null | undefined | false;

export interface Props {
  class?: string;
  id?: string;
  /** Raw markup for trusted, static icons only. */
  html?: string;
  title?: string;
  label?: string;
  disabled?: boolean;
  onTap?: (e: Event) => void;
  dataset?: Record<string, string>;
  style?: Partial<CSSStyleDeclaration>;
  type?: string;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.id) el.id = props.id;
  if (props.html !== undefined) el.innerHTML = props.html;
  if (props.title) el.title = props.title;
  if (props.label) el.setAttribute('aria-label', props.label);
  if (props.disabled) (el as HTMLButtonElement).disabled = true;
  if (props.type) el.setAttribute('type', props.type);
  if (props.onTap) el.addEventListener('click', props.onTap);
  if (props.dataset) Object.assign(el.dataset, props.dataset);
  if (props.style) Object.assign(el.style, props.style);
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

export function clear(el: HTMLElement): void {
  el.replaceChildren();
}

/** A press handler for in-game buttons: multi-touch never synthesises `click` while another finger is down. */
export function onPress(el: HTMLElement, down: () => void, up?: () => void): void {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.classList.add('pressed');
    down();
  });
  const release = (e: Event): void => {
    e.preventDefault();
    el.classList.remove('pressed');
    up?.();
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('pointerleave', release);
}

/** Press and hold for `ms`. The only hidden gesture in the game: the Parent Zone entry. */
export function onHold(el: HTMLElement, ms: number, fire: () => void): void {
  let timer = 0;
  const start = (e: Event): void => {
    e.preventDefault();
    el.classList.add('holding');
    timer = window.setTimeout(() => {
      el.classList.remove('holding');
      fire();
    }, ms);
  };
  const stop = (): void => {
    el.classList.remove('holding');
    window.clearTimeout(timer);
  };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
  el.addEventListener('pointerleave', stop);
}

export const formatNumber = (n: number): string => Math.round(n).toLocaleString('en-US');

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** A canvas sized for crisp drawing at the device's pixel density. */
export function hiDpiCanvas(cssW: number, cssH: number, draw: (ctx: CanvasRenderingContext2D) => void, className?: string): HTMLCanvasElement {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(cssW * ratio);
  canvas.height = Math.round(cssH * ratio);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  if (className) canvas.className = className;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(ratio, ratio);
    draw(ctx);
  }
  return canvas;
}
