// Inline SVG icons: the core game has to work without reading (C4).
const svg = (body: string, viewBox = '0 0 48 48'): string =>
  `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  pause: svg('<rect x="13" y="10" width="7" height="28" rx="2.5" fill="currentColor"/><rect x="28" y="10" width="7" height="28" rx="2.5" fill="currentColor"/>'),
  play: svg('<path d="M16 10 L38 24 L16 38 Z" fill="currentColor"/>'),
  gear: svg('<circle cx="24" cy="24" r="7"/><path d="M24 5v7M24 36v7M5 24h7M36 24h7M10.6 10.6l5 5M32.4 32.4l5 5M37.4 10.6l-5 5M15.6 32.4l-5 5"/>'),
  lock: svg('<rect x="10" y="21" width="28" height="21" rx="5" fill="currentColor"/><path d="M16 21v-6a8 8 0 0 1 16 0v6"/>'),
  book: svg('<path d="M24 12c-5-4-12-5-18-4v30c6-1 13 0 18 4 5-4 12-5 18-4V8c-6-1-13 0-18 4Z"/><path d="M24 12v30"/>'),
  wrench: svg('<path d="M36 8a10 10 0 0 0-13 13L8 36a4 4 0 0 0 6 6l15-15a10 10 0 0 0 13-13l-7 7-6-2-2-6 7-7Z" fill="currentColor"/>'),
  home: svg('<path d="M8 24 24 9l16 15"/><path d="M13 21v18h22V21"/>'),
  back: svg('<path d="M29 9 14 24l15 15"/>'),
  close: svg('<path d="M12 12l24 24M36 12 12 36"/>'),
  speaker: svg('<path d="M8 19v10h7l10 8V11l-10 8H8Z" fill="currentColor"/><path d="M32 17a10 10 0 0 1 0 14M37 12a17 17 0 0 1 0 24"/>'),
  target: svg('<circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="5" fill="currentColor"/><path d="M24 2v9M24 37v9M2 24h9M37 24h9"/>'),
  auto: svg('<path d="M38 24a14 14 0 1 1-4.2-10"/><path d="M36 5v10H26"/><circle cx="24" cy="24" r="4" fill="currentColor"/>'),
  laser: svg('<path d="M24 4v18"/><path d="M15 15l9 9 9-9"/><circle cx="24" cy="33" r="10" fill="currentColor"/>'),
  plus: svg('<path d="M24 10v28M10 24h28"/>', '0 0 48 48'),
  minus: svg('<path d="M10 24h28"/>', '0 0 48 48'),
  check: svg('<path d="M9 25l10 10 20-22"/>'),
  fish: svg('<path d="M5 24c7-11 21-13 29-4l9-8v24l-9-8c-8 9-22 7-29-4Z" fill="currentColor" stroke="none"/><circle cx="16" cy="21" r="2.6" fill="#fff" stroke="none"/>'),
  coin: svg('<circle cx="24" cy="24" r="18" fill="#ffd34d" stroke="#c98a12"/><path d="M24 14c-7 7-7 14 0 20 7-6 7-13 0-20Z" stroke="#c98a12" stroke-width="3"/>'),
  backspace: svg('<path d="M18 10h22v28H18L5 24l13-14Z"/><path d="M24 18l10 12M34 18 24 30"/>'),
  clock: svg('<circle cx="24" cy="24" r="18"/><path d="M24 13v12l8 5"/>'),
  star: svg('<path d="M24 5l6 13 14 2-10 10 2 14-12-7-12 7 2-14L4 20l14-2 6-13Z" fill="currentColor"/>'),
} as const;

export const icon = (name: keyof typeof ICONS): string => ICONS[name];
