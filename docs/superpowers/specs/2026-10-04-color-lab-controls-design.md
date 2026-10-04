# Color Lab controls: sound modes, language, collapsible panels, mobile PWA

Scope: the 8 games in `projects/little-color-lab/*/`, the Color Lab home page
(`projects/little-color-lab/index.html`) and the standalone app `projects/rainbow-maker/`.

## Current state

- Each Color Lab game has the same copy-pasted block: `langBtn` cycles `both → en → vi` (speech only;
  on-screen text is always bilingual), `muteBtn` toggles one `soundOn` flag that gates speech (`say`)
  and every sound effect (`tone`, `noise`/`pourNoise`, vibration in `click`/`buzz`). Settings are saved
  per game (`rbm-voice`, `cdl-mute`, ...; rainbow-milk reuses rainbow-maker's `rbm-*` keys).
- `#langBtn` is hidden on narrow screens in 6 games: at `max-width:400px` in colored-shadows,
  light-and-color, paint-mixing, rainbow-maker, walking-water; at `max-width:360px` in rainbow-milk
  (that rule also hides `.cbtn b`).
- The tip `.bubble` and bottom `.tray` cannot be collapsed. All games have `fitCamera()`/`placeCamera()`;
  most have a `refitSoon()` that only reacts to bubble height changes over 20px (color-dancing has none).
- PWA files exist and deploy correctly, but there is no in-app install entry point: iOS has no install
  prompt, Android only offers it in the browser menu. The maskable icon reuses `icon-512.png`.
- Standalone `/rainbow-maker` differs: full UI translation `en ↔ vi` via `T[lang]`, a `speakBtn` talk
  on/off toggle, a `cleanBtn` that hides all panels, its own manifest and service worker. It saves no
  settings (`state` is hard-coded) and its sound effects (`chime` and friends) are not gated at all.

## Approach

A shared, no-build `projects/little-color-lab/lab-kit.js` + `lab-kit.css`, loaded by each Color Lab game
and the home page. It owns preferences, the sound and language buttons, panel collapsing and the install
entry point. Each game keeps its scene logic and its own `say()`/`tone()`, which read flags from the kit.
The standalone `/rainbow-maker` has a different UI architecture, so it gets the same behavior inline,
sharing the same preferences key and the same states, icons and wording.

### Kit interface

Loaded with `<link rel="stylesheet" href="../lab-kit.css">` and `<script src="../lab-kit.js"></script>`
in `<head>`, before the game's inline `<script>`.

- `LabKit.prefs` → `{sound, lang}`; getters `LabKit.voiceOn`, `LabKit.sfxOn`, `LabKit.lang`.
- `LabKit.init({onLang, onSound, onPanels})`: wires `#muteBtn` (sound), `#langBtn`, `.bubble`, `.tray`
  and the install button already in the page's markup. Callbacks:
  - `onLang(lang)`: game re-speaks its tip (`sayTip()`); the kit has already toggled `#tipEn`/`#tipVi`.
  - `onSound(mode)`: optional; the kit has already cancelled speech when voice turned off.
  - `onPanels()`: fired after the collapse/expand transition ends; game calls `fitCamera(); placeCamera();`
    and resets its cached bubble height (`lastBubbleH`) where it has one.
- `LabKit.vibrate(ms)`: vibrates only when `sfxOn`.
- `LabKit.notifyTip()`: game calls it from `setTip()`; pulses the collapsed bubble chip.

Each game: delete its local `soundOn`/`voiceMode`/storage/`syncTools`/button handlers; `say()` checks
`LabKit.voiceOn` (or `force` from the say-again button) and `LabKit.lang`; every other former `soundOn`
check (`tone`, `noise`, `pourNoise`, vibration) checks `LabKit.sfxOn`; rainbow-maker:737's
`voiceMode==='both'&&soundOn?1500:900` uses `LabKit.lang==='both'&&LabKit.voiceOn`.

## 1. Sound mode (one button, 3 states)

Tap cycles: **Sounds only → Voice + sounds → Silent**. Default is **Sounds only**: the voice is
browser text-to-speech, which is not good enough yet to be on by default.

| Mode     | `voiceOn` | `sfxOn` | Icon        | Toast (EN / VI)                 |
|----------|-----------|---------|-------------|---------------------------------|
| `sfx` (default) | no | yes    | speaker     | Sounds only / Chỉ âm thanh      |
| `all`    | yes       | yes     | speaker + mouth | Voice + sounds / Giọng nói + âm thanh |
| `off`    | no        | no      | speaker crossed | Silent / Tắt tiếng          |

- An explicit tap on the bubble's "say it again" button speaks once in `sfx` mode too (the user asked
  for it); never in `off`.
- Leaving `all` calls `speechSynthesis.cancel()`.
- A short toast near the top bar announces the new mode (also via `aria-live`); the button's
  `aria-label` names the current mode.
- Standalone `/rainbow-maker`: `speakBtn` becomes this 3-state button; its effects (`chime` and the other
  WebAudio sounds) get gated on `sfxOn`; its "hear" button follows the say-again rule.

## 2. Language (EN + VI / EN / VI)

- Button always visible in the top bar at every width: remove all six `#langBtn` hide rules (keep
  rainbow-milk's `.cbtn b` hiding). To make room on narrow phones the title shrinks / drops its
  decorative icon (rainbow-maker already drops `.title .arc`).
- Controls speech **and the tip bubble text**: `en` hides `#tipVi`, `vi` hides `#tipEn`, `both` shows both.
  Button labels, start screen and the grown-ups sheet stay bilingual.
- Changing language re-speaks the current tip when voice is on.
- Standalone `/rainbow-maker` gains the third state:
  - `en` / `vi`: as today (full UI translation via `T[lang]`, speech in that language).
  - `both`: UI from `T.vi`, `document.documentElement.lang = 'vi'` (never `"both"`), the hint shows the
    message from `T.en` and `T.vi` on two lines, and `say()` queues two utterances (en-US, then vi-VN), each
    with its own voice pick (`pickVoice` takes the language as a parameter instead of reading `state.lang`).

## 3. Shared preferences

- One `localStorage` key for the whole site origin: `cuibap-prefs` =
  `{"sound":"sfx|all|off","lang":"both|en|vi","collapsed":{"bubble":bool,"tray":bool}}`.
- Read by every Color Lab game, the Color Lab home page and standalone `/rainbow-maker`; a change in one
  page applies in the others, also live across open tabs via the `storage` event.
- Migration (Color Lab games only): if `cuibap-prefs` is missing, seed it from the visited game's old
  keys: `*-voice` → `lang`, `*-mute` = `'1'` → `sound:'off'`. Anything else starts at `sfx`.
  Standalone has nothing to migrate.
- All storage access in `try/catch`; defaults (`sfx`, `both`, nothing collapsed) when storage is unavailable.
- The Color Lab home page shows the same sound and language buttons so settings can be chosen before playing.

## 4. Collapsible panels

The two floating panels in every game get a small chevron button (≥ 44px tap target):

- **Tip bubble** → collapses to a round chip with the speech icon. Tapping the chip expands it; the
  say-again action stays available on the chip. While collapsed, a new tip pulses the chip once; speech
  still plays per sound mode. Anything nested in the bubble (walking-water `#mix`, colored-shadows `.venn`)
  collapses with it.
- **Control tray** → collapses to a "▴ Controls / Điều khiển" pill at the bottom edge.
- Result cards (`#mix` in color-dancing and paint-mixing) are not collapsible: they auto-hide after ~6s.
- After a collapse/expand the kit fires `onPanels()` once the transition ends, and the game refits its
  camera (see Kit interface). `freeBand()`-style measurements then see the smaller panels.
- Collapse state is remembered per panel kind in `cuibap-prefs.collapsed`, shared across games.
- Standalone `/rainbow-maker`: same chevrons on its `.hint` section and `.controls` tray, refitting its
  camera the same way; keeps its existing `cleanBtn` "Hide panels" toggle.

## 5. Mobile PWA install

Applies to the Color Lab manifest and the standalone `/rainbow-maker` manifest.

- **Install button** "Install app / Cài ứng dụng" on the Color Lab home page and inside each game's
  "For grown-ups" sheet (standalone: its grown-ups sheet).
  - Chrome / Edge / Samsung Internet on Android (and desktop): capture `beforeinstallprompt`, show the
    button, call `prompt()` on tap; hide on `appinstalled`.
  - iOS / iPadOS, any browser (all are WebKit; Safari, and Chrome/Edge on iOS 16.4+, can Add to Home
    Screen from the share menu): the button opens a short hint with icons:
    "Tap ⋯ or Share ⬆, then Add to Home Screen / Bấm ⋯ hoặc Chia sẻ ⬆, rồi chọn Thêm vào MH chính".
    Detect iPadOS reporting as Mac via `navigator.maxTouchPoints > 1`.
  - Other browsers with neither: button hidden.
  - Hidden when already installed (`matchMedia('(display-mode: standalone)')` or `navigator.standalone`).
- **Installed mode:** hide links that leave the app scope (Color Lab home's "Back" to `/`; standalone's
  back link to `/`), since they would open outside the app.
- **Manifest fixes:** a real maskable icon (`icons/icon-maskable-512.png`, artwork inside the 80% safe
  zone on the theme background, `purpose: "maskable"`); `screenshots`: one portrait with
  `form_factor: "narrow"` and one landscape with `form_factor: "wide"`, each with `sizes` and `type`.
- **Service workers** (both apps): same-origin `.js`/`.css` become network-first like pages, so an updated
  `lab-kit.*` is never served stale; Color Lab precaches `lab-kit.js`, `lab-kit.css` and the new icons;
  standalone precaches its new icons only; bump `VERSION` to `v2` in both.

## Testing

No test framework covers these static pages; verification is manual in a browser:

- Chrome DevTools at 360×740, 390×844 and a landscape phone size: top bar fits with Back, language,
  sound and ? visible; panels collapse/expand and the scene refits; no horizontal scroll.
- Each of the 3 sound modes (first visit starts in Sounds only): speech and effects behave per the
  table, in every game and the standalone app.
- Language: bubble text and speech follow the setting; the setting carries over between games, the home
  page and the standalone app.
- DevTools → Application → Manifest: no installability errors, maskable icon preview looks right.
- Real-device check by the user on iPhone (Add to Home Screen hint) and Android Chrome (Install button).

## Out of scope

Translating Color Lab button labels, start screens and grown-ups notes per language; collapsing the
auto-hiding result cards; changes to the Angular `animal-learning` app or the root landing page.
