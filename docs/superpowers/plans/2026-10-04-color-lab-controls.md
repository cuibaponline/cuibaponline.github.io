# Color Lab Controls Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One 3-state sound button (Sounds only → Voice + sounds → Silent), an always-visible EN+VI / EN / VI language button that also filters the tip text, collapsible tip bubble and control tray, and visible "Install app" help for Android, iPhone, Samsung Internet and in-app browsers, across the 8 Little Color Lab games, the Color Lab home page and the standalone Rainbow Maker.

**Architecture:** A new no-build shared script + stylesheet, `projects/little-color-lab/lab-kit.js` / `lab-kit.css`, owns settings (one `localStorage` key `cuibap-prefs` for the whole site), the top-bar sound/language buttons, panel folding, toasts and install help. Its pure helpers are exported for Node tests. Each game keeps its own `say()`/`tone()` and reads `LabKit.voiceOn`, `LabKit.sfxOn`, `LabKit.lang`. Service workers become network-first for same-origin JS/CSS so the kit never goes stale.

**Tech Stack:** Plain HTML/CSS/JS (ES2017) pages with three.js r128 from CDN, no build step. Node 24 `node:test` for kit logic. `playwright-core` + system Chromium (kept in the scratchpad, not the repo) for browser smoke checks.

**Spec:** `docs/superpowers/specs/2026-10-04-color-lab-controls-design.md`

**House rules for this repo:**
- Single `master` branch. Commit after each task; **do not push** (a push to master deploys to GitHub Pages). The user will push.
- Commit messages: one short subject line, optional short body. **No `Co-Authored-By` or session trailers.**
- Node: the default Node is 25 and unsupported here. Run Node via `mise exec node@24.21.0 -- node ...`.
- Match the surrounding code style: the game files use compact one-line functions, `$()` helpers, `try{}catch(e){}` around browser APIs.
- `SCRATCH` below means the session scratchpad: `/tmp/claude-1000/-home-duy-duy-github-cuibaponline-github-io/7842714c-ce51-4869-b8da-abc031b1e982/scratchpad`. Each Bash call is a fresh shell, so **write the literal path** (or `export SCRATCH=...;` at the start of every command); never rely on `$SCRATCH` being set.
- The working tree starts with an unrelated `M .gitignore` (a `.superpowers/` ignore line). Leave it alone: don't commit or revert it. Always `git add` explicit paths.

---

## File map

| File | Change | Responsibility |
|---|---|---|
| `projects/little-color-lab/lab-kit.js` | Create | Prefs, sound/lang buttons, toast, folds, install help. Pure core exported to Node. |
| `projects/little-color-lab/lab-kit.css` | Create | Styles for everything the kit adds; language filter for `#tipEn`/`#tipVi`. |
| `tests/little-color-lab/lab-kit.test.cjs` | Create | `node:test` tests for the pure core. Outside `projects/` so it is not deployed. |
| `projects/little-color-lab/sw.js` | Modify | Network-first for same-origin JS/CSS, precache kit, `v2`. |
| `projects/rainbow-maker/sw.js` | Modify | Same. |
| `projects/little-color-lab/*/index.html` (8 games) | Modify | Load kit, drop local sound/lang code, gate effects, install buttons. |
| `projects/little-color-lab/index.html` | Modify | Sound + language buttons, install banner, hide Back when installed. |
| `projects/rainbow-maker/index.html` | Modify | Load kit, 3-state sound, `both` language, folds, install. |
| `projects/little-color-lab/manifest.webmanifest`, `projects/rainbow-maker/manifest.webmanifest` | Modify | `screenshots`. |
| `projects/little-color-lab/screenshots/*.png`, `projects/rainbow-maker/screenshots/*.png` | Create | Install-sheet screenshots. |
| `projects/little-color-lab/README.md` | Modify | Document kit and settings. |
| `package.json` | Modify | `test:lab` script. |

---

## Chunk 1: The kit

### Task 1: Pure core with tests

**Files:**
- Create: `projects/little-color-lab/lab-kit.js` (core part only in this task)
- Create: `tests/little-color-lab/lab-kit.test.cjs`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Write the failing tests**

Create `tests/little-color-lab/lab-kit.test.cjs`:

```js
// Tests for the pure (no DOM) part of projects/little-color-lab/lab-kit.js.
// Run: mise exec node@24.21.0 -- node --test tests/little-color-lab/lab-kit.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const kit = require('../../projects/little-color-lab/lab-kit.js');

const mem = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

const UA = {
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  zalo: 'Mozilla/5.0 (Linux; Android 13; SM-A536E Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.146 Mobile Safari/537.36 Zalo android/12100630 ZaloTheme/light ZaloLanguage/vi',
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1',
  iphoneEdge: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/140.0.3485.54 Mobile/15E148 Safari/605.1.15',
  iphoneFacebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0.0;FBBV/1]',
  ipadAsMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
  linuxChrome: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
};

test('sound cycles sfx -> all -> off -> sfx, unknown starts at sfx', () => {
  assert.equal(kit.nextSound('sfx'), 'all');
  assert.equal(kit.nextSound('all'), 'off');
  assert.equal(kit.nextSound('off'), 'sfx');
  assert.equal(kit.nextSound('bogus'), 'sfx');
});

test('language cycles both -> en -> vi -> both', () => {
  assert.equal(kit.nextLang('both'), 'en');
  assert.equal(kit.nextLang('en'), 'vi');
  assert.equal(kit.nextLang('vi'), 'both');
});

test('flags per sound mode', () => {
  assert.deepEqual(kit.flags('sfx'), { voiceOn: false, sfxOn: true });
  assert.deepEqual(kit.flags('all'), { voiceOn: true, sfxOn: true });
  assert.deepEqual(kit.flags('off'), { voiceOn: false, sfxOn: false });
});

test('defaults when nothing is stored: sounds only, both languages', () => {
  const r = kit.readPrefs(mem(), 'rbm');
  assert.equal(r.migrated, false);
  assert.deepEqual(r.prefs, { sound: 'sfx', lang: 'both', collapsed: { bubble: false, tray: false }, installDismissedAt: 0 });
});

test('legacy mute and voice keys seed the new prefs', () => {
  const r = kit.readPrefs(mem({ 'rbm-voice': 'vi', 'rbm-mute': '1' }), 'rbm');
  assert.equal(r.migrated, true);
  assert.equal(r.prefs.sound, 'off');
  assert.equal(r.prefs.lang, 'vi');
});

test('legacy unmuted becomes the new default sfx (voice is opt-in now)', () => {
  const r = kit.readPrefs(mem({ 'cdl-mute': '0' }), 'cdl');
  assert.equal(r.prefs.sound, 'sfx');
  assert.equal(r.migrated, false);
});

test('stored prefs win over legacy keys', () => {
  const store = mem({ [kit.KEY]: JSON.stringify({ sound: 'all', lang: 'en' }), 'rbm-mute': '1' });
  const r = kit.readPrefs(store, 'rbm');
  assert.equal(r.prefs.sound, 'all');
  assert.equal(r.prefs.lang, 'en');
  assert.equal(r.migrated, false);
});

test('corrupt stored JSON falls back to legacy/defaults', () => {
  const r = kit.readPrefs(mem({ [kit.KEY]: '{oops', 'ww-voice': 'en' }), 'ww');
  assert.equal(r.prefs.lang, 'en');
  assert.equal(r.prefs.sound, 'sfx');
});

test('storage that throws gives defaults', () => {
  const bad = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(kit.readPrefs(bad, 'rbm').prefs.sound, 'sfx');
});

test('normalize drops junk values', () => {
  const p = kit.normalize({ sound: 'loud', lang: 'fr', collapsed: { bubble: 'yes', tray: true }, installDismissedAt: 'x' });
  assert.deepEqual(p, { sound: 'sfx', lang: 'both', collapsed: { bubble: false, tray: true }, installDismissedAt: 0 });
});

test('installMode picks the right help per browser', () => {
  const m = kit.installMode;
  assert.equal(m(UA.androidChrome, 5, true, true), 'installed');
  assert.equal(m(UA.zalo, 5, false, false), 'inapp');
  assert.equal(m(UA.iphoneFacebook, 5, false, false), 'inapp');
  assert.equal(m(UA.iphoneSafari, 5, false, false), 'ios-safari');
  assert.equal(m(UA.iphoneChrome, 5, false, false), 'ios-chrome');
  assert.equal(m(UA.iphoneEdge, 5, false, false), 'ios-chrome');
  assert.equal(m(UA.ipadAsMac, 5, false, false), 'ios-safari');
  assert.equal(m(UA.ipadAsMac, 0, false, false), 'none');
  assert.equal(m(UA.androidChrome, 5, false, true), 'prompt');
  assert.equal(m(UA.androidChrome, 5, false, false), 'none');
  assert.equal(m(UA.samsung, 5, false, true), 'prompt');
  assert.equal(m(UA.samsung, 5, false, false), 'samsung');
  assert.equal(m(UA.linuxChrome, 0, false, true), 'prompt');
});

test('install banner hides for 14 days after dismissal', () => {
  const day = 24 * 3600 * 1000, now = 100 * day;
  const p = (t) => kit.normalize({ installDismissedAt: t });
  assert.equal(kit.bannerVisible(p(0), 'prompt', now), true);
  assert.equal(kit.bannerVisible(p(now - 13 * day), 'prompt', now), false);
  assert.equal(kit.bannerVisible(p(now - 15 * day), 'ios-safari', now), true);
  assert.equal(kit.bannerVisible(p(0), 'none', now), false);
  assert.equal(kit.bannerVisible(p(0), 'installed', now), false);
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `mise exec node@24.21.0 -- node --test tests/little-color-lab/lab-kit.test.cjs`
Expected: FAIL, `Cannot find module '../../projects/little-color-lab/lab-kit.js'`.

- [ ] **Step 3: Write the core**

Create `projects/little-color-lab/lab-kit.js` with the core only. Task 2 replaces the `BROWSER PART` marker comment with the DOM code:

```js
/* Little Color Lab kit: shared sound + language settings, top-bar buttons, foldable panels and
   "install app" help. Plain script, no build step: load it in <head> before the page's own script.
   The pure helpers at the top have no DOM and are exported for the Node tests. */
(function () {
  'use strict';
  const KEY = 'cuibap-prefs';
  const SOUNDS = ['sfx', 'all', 'off'];          // tap order; first is the default
  const LANGS = ['both', 'en', 'vi'];
  const SNOOZE_MS = 14 * 24 * 3600 * 1000;       // install banner stays hidden this long after "not now"
  const IN_APP = /Zalo|FBAN|FBAV|FB_IAB|Instagram|musical_ly|BytedanceWebview/i;

  const nextIn = (list, v) => list[(list.indexOf(v) + 1) % list.length];
  function normalize(raw) {
    const p = raw && typeof raw === 'object' ? raw : {};
    const c = p.collapsed && typeof p.collapsed === 'object' ? p.collapsed : {};
    return {
      sound: SOUNDS.includes(p.sound) ? p.sound : 'sfx',
      lang: LANGS.includes(p.lang) ? p.lang : 'both',
      collapsed: { bubble: c.bubble === true, tray: c.tray === true },
      installDismissedAt: typeof p.installDismissedAt === 'number' ? p.installDismissedAt : 0,
    };
  }
  // legacy: the game's old key prefix ('rbm', 'cdl', ...), used once when KEY is missing
  function readPrefs(store, legacy) {
    let raw = null;
    try { raw = store.getItem(KEY); } catch (e) {}
    if (raw) { try { return { prefs: normalize(JSON.parse(raw)), migrated: false }; } catch (e) {} }
    const seed = {};
    if (legacy) {
      try {
        const v = store.getItem(legacy + '-voice');
        if (LANGS.includes(v)) seed.lang = v;
        if (store.getItem(legacy + '-mute') === '1') seed.sound = 'off';
      } catch (e) {}
    }
    return { prefs: normalize(seed), migrated: Object.keys(seed).length > 0 };
  }
  const flags = (sound) => ({ voiceOn: sound === 'all', sfxOn: sound !== 'off' });
  function installMode(ua, touchPoints, standalone, canPrompt) {
    if (standalone) return 'installed';
    if (IN_APP.test(ua)) return 'inapp';
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return /CriOS|EdgiOS/.test(ua) ? 'ios-chrome' : 'ios-safari';
    if (canPrompt) return 'prompt';
    if (/SamsungBrowser/.test(ua)) return 'samsung';
    return 'none';
  }
  const bannerVisible = (prefs, mode, now) => mode !== 'none' && mode !== 'installed' && now - prefs.installDismissedAt > SNOOZE_MS;

  const core = { KEY, SOUNDS, LANGS, nextSound: (v) => nextIn(SOUNDS, v), nextLang: (v) => nextIn(LANGS, v), normalize, readPrefs, flags, installMode, bannerVisible };
  if (typeof window === 'undefined') { if (typeof module === 'object') module.exports = core; return; }

  /* BROWSER PART (Task 2) */
})();
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `mise exec node@24.21.0 -- node --test tests/little-color-lab/lab-kit.test.cjs`
Expected: `# pass 12`, `# fail 0`.

- [ ] **Step 5: Add the npm script**

In `package.json` `"scripts"`, add after `"test": "ng test"` (remember the comma):

```json
    "test:lab": "node --test tests/little-color-lab/lab-kit.test.cjs"
```

Run: `mise exec node@24.21.0 -- npm run test:lab`. Expected: 12 pass.

- [ ] **Step 6: Commit**

```bash
git add projects/little-color-lab/lab-kit.js tests/little-color-lab/lab-kit.test.cjs package.json
git commit -m "Add Color Lab kit core: shared prefs, sound modes, install detection"
```

### Task 2: Browser part of the kit + stylesheet

**Files:**
- Modify: `projects/little-color-lab/lab-kit.js` (replace the `/* BROWSER PART (Task 2) */` line)
- Create: `projects/little-color-lab/lab-kit.css`

- [ ] **Step 1: Replace the marker line with the browser code**

Replace `  /* BROWSER PART (Task 2) */` with:

```js
  /* ---------- browser ---------- */
  const doc = document, html = doc.documentElement;
  const $ = (s) => (typeof s === 'string' ? doc.querySelector(s) : s);
  const $$ = (s) => Array.from(doc.querySelectorAll(s));
  let store = null;
  try { store = window.localStorage; } catch (e) {}
  let state = readPrefs(store || { getItem: () => null }, null).prefs;
  const save = () => { try { if (store) store.setItem(KEY, JSON.stringify(state)); } catch (e) {} };
  const handlers = {};
  const fire = (name, arg) => { try { if (handlers[name]) handlers[name](arg); } catch (e) { console.error(e); } };
  const safeParse = (s) => { try { return JSON.parse(s); } catch (e) { return null; } };
  const cancelSpeech = () => { try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {} };

  const SOUND_TEXT = { sfx: ['Sounds only', 'Chỉ âm thanh'], all: ['Voice + sounds', 'Giọng nói + âm thanh'], off: ['Silent', 'Tắt tiếng'] };
  const LANG_LABEL = { both: 'EN + VI', en: 'EN', vi: 'VI' };
  const LANG_TEXT = { both: ['English + Vietnamese', 'Tiếng Anh + tiếng Việt'], en: ['English', 'Tiếng Anh'], vi: ['Vietnamese', 'Tiếng Việt'] };
  const FOLD_TEXT = { bubble: ['tip', 'lời nhắc'], tray: ['Controls', 'Điều khiển'] };
  const svg = (w) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  const SPEAKER = '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/>';
  const ICONS = {
    sfx: svg(2.4) + '>' + SPEAKER + '<path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
    all: svg(2.2) + '><path d="M2 10h3l4-3.5v11L5 14H2z" fill="currentColor"/><path d="M13 4.5h7.5A1.5 1.5 0 0 1 22 6v5.5a1.5 1.5 0 0 1-1.5 1.5H18l-3 2.8V13h-2a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 13 4.5z"/></svg>',
    off: svg(2.4) + '>' + SPEAKER + '<path d="M17 9l5 6M22 9l-5 6"/></svg>',
  };
  const CHEVRON = svg(3) + ' class="lk-ic-chev"><path d="M6 15l6-6 6 6"/></svg>';
  const CHAT = svg(2) + ' class="lk-ic-chat"><path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="currentColor" stroke="none"/><path d="M8 10.5h.01M12 10.5h.01M16 10.5h.01" stroke="#fff" stroke-width="3"/></svg>';

  /* settings + buttons */
  const soundBtns = [], langBtns = [], folds = [];
  function applyAttrs() { html.setAttribute('data-lk-sound', state.sound); html.setAttribute('data-lk-lang', state.lang); }
  function paint() {
    const st = SOUND_TEXT[state.sound], lt = LANG_TEXT[state.lang];
    soundBtns.forEach((b) => { b.innerHTML = ICONS[state.sound]; b.title = st[0]; b.setAttribute('aria-label', 'Sound: ' + st[0] + ' / ' + st[1]); b.removeAttribute('aria-pressed'); });
    langBtns.forEach((b) => { b.textContent = LANG_LABEL[state.lang]; b.title = lt[0]; b.setAttribute('aria-label', 'Language: ' + lt[0] + ' / ' + lt[1]); });
    folds.forEach(paintFold);
  }
  let toastEl = null, toastT = 0;
  function toast(en, vi) {
    if (!toastEl) {
      toastEl = doc.createElement('div'); toastEl.className = 'lk-toast';
      toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
      toastEl.innerHTML = '<b></b><i lang="vi"></i>'; doc.body.appendChild(toastEl);
    }
    toastEl.firstChild.textContent = en; toastEl.lastChild.textContent = vi;
    toastEl.classList.add('show'); clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('show'), 1600);
  }
  function setSound(s) {
    state.sound = SOUNDS.includes(s) ? s : 'sfx'; save(); applyAttrs(); paint();
    if (!flags(state.sound).voiceOn) cancelSpeech();
    fire('onSound', state.sound);
  }
  function setLang(l) {
    state.lang = LANGS.includes(l) ? l : 'both'; save(); applyAttrs(); paint();
    fire('onLang', state.lang); afterLayout();   // bubble text changes height
  }
  function cycleSound() { setSound(core.nextSound(state.sound)); toast(...SOUND_TEXT[state.sound]); }
  function cycleLang() { setLang(core.nextLang(state.lang)); toast(...LANG_TEXT[state.lang]); }

  /* foldable panels */
  const afterLayout = () => requestAnimationFrame(() => requestAnimationFrame(() => fire('onPanels')));
  function foldable(el, kind) {
    el = $(el);
    if (!el || el.hasAttribute('data-lk-fold')) return;
    const b = doc.createElement('button');
    b.type = 'button'; b.className = 'lk-fold lk-fold-' + kind;
    b.innerHTML = CHEVRON + (kind === 'bubble' ? CHAT : '') + '<span class="lk-fold-t"><b></b><i lang="vi"></i></span>';
    b.querySelector('b').textContent = FOLD_TEXT[kind][0]; b.querySelector('i').textContent = FOLD_TEXT[kind][1];
    b.addEventListener('click', (e) => { e.stopPropagation(); setFolded(kind, !state.collapsed[kind]); });
    el.classList.add('lk-foldable'); el.setAttribute('data-lk-fold', kind); el.appendChild(b);
    folds.push(el); paintFold(el);
  }
  function paintFold(el) {
    const kind = el.getAttribute('data-lk-fold'), c = state.collapsed[kind], b = el.querySelector('.lk-fold');
    el.classList.toggle('lk-collapsed', c);
    b.setAttribute('aria-expanded', String(!c));
    b.setAttribute('aria-label', kind === 'tray' ? (c ? 'Show controls' : 'Hide controls') : (c ? 'Show tip' : 'Hide tip'));
  }
  function setFolded(kind, c) { state.collapsed[kind] = !!c; save(); folds.forEach(paintFold); afterLayout(); }
  function notifyTip() {
    if (!state.collapsed.bubble) return;
    folds.forEach((el) => {
      if (el.getAttribute('data-lk-fold') !== 'bubble') return;
      el.classList.remove('lk-pulse'); void el.offsetWidth; el.classList.add('lk-pulse');
    });
  }

  /* install help */
  let deferred = null, justInstalled = false, hintEl = null;
  const realStandalone = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } };
  const installModeNow = () => installMode(navigator.userAgent || '', navigator.maxTouchPoints || 0, realStandalone() || justInstalled, !!deferred);
  function refreshInstall() {
    const m = installModeNow();
    html.classList.toggle('lk-standalone', realStandalone());
    $$('[data-lk-install]').forEach((b) => { b.hidden = m === 'none' || m === 'installed'; });
    $$('[data-lk-install-banner]').forEach((el) => { el.hidden = !bannerVisible(state, m, Date.now()); });
  }
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; refreshInstall(); });
  window.addEventListener('appinstalled', () => { deferred = null; justInstalled = true; refreshInstall(); });
  const STEPS = {
    'ios-safari': [['Tap ⋯ (or Share ⬆) in Safari', 'Bấm ⋯ (hoặc Chia sẻ ⬆) trong Safari'], ['Choose “Add to Home Screen”', 'Chọn “Thêm vào MH chính”'], ['Tap Add', 'Bấm Thêm']],
    'ios-chrome': [['Tap Share ⬆ in the address bar', 'Bấm Chia sẻ ⬆ trên thanh địa chỉ'], ['Choose “Add to Home Screen” (scroll down if needed)', 'Chọn “Thêm vào MH chính” (kéo xuống nếu cần)'], ['Tap Add', 'Bấm Thêm']],
    samsung: [['Tap the ☰ menu', 'Bấm menu ☰'], ['Choose “Add page to”, then “Home screen”', 'Chọn “Thêm trang vào”, rồi “Màn hình chờ”'], ['Tap Add', 'Bấm Thêm']],
  };
  function install() {
    const m = installModeNow();
    if (m === 'prompt' && deferred) {
      const d = deferred; deferred = null;
      try { d.prompt(); d.userChoice.then((c) => { if (c && c.outcome === 'accepted') justInstalled = true; refreshInstall(); }, () => {}); } catch (e) {}
      refreshInstall(); return;
    }
    if (m !== 'none' && m !== 'installed') showHint(m);
  }
  function showHint(m) {
    closeHint();
    const line = (en, vi) => en + '<br><i lang="vi">' + vi + '</i>';
    const body = m === 'inapp'
      ? '<p>' + line('This app’s browser cannot install games. Open this page in Chrome or Safari, then install it from there.', 'Trình duyệt trong ứng dụng này không cài được. Hãy mở trang này bằng Chrome hoặc Safari rồi cài từ đó.') + '</p>'
        + '<input class="lk-url" readonly aria-label="Page link">'
        + '<button class="lk-install" type="button" data-lk-copy>Copy link <i lang="vi">Sao chép liên kết</i></button>'
      : '<ol>' + STEPS[m].map((s) => '<li>' + line(s[0], s[1]) + '</li>').join('') + '</ol>'
        + '<p>' + line('Then open it from the new icon: full screen, and it works offline.', 'Sau đó mở từ biểu tượng mới: toàn màn hình, chơi được cả khi không có mạng.') + '</p>';
    hintEl = doc.createElement('div'); hintEl.className = 'lk-sheet';
    hintEl.innerHTML = '<div class="lk-box" role="dialog" aria-modal="true" aria-labelledby="lkHintTitle">'
      + '<button class="lk-x" type="button" data-lk-close aria-label="Close">✕</button>'
      + '<h2 id="lkHintTitle">Install app</h2><p class="lk-vi" lang="vi">Cài ứng dụng</p>' + body + '</div>';
    const url = hintEl.querySelector('.lk-url'); if (url) url.value = location.href.split('#')[0];
    doc.body.appendChild(hintEl); hintEl.querySelector('[data-lk-close]').focus();
  }
  function closeHint() { if (hintEl) { hintEl.remove(); hintEl = null; } }
  function copyLink(btn) {
    const input = hintEl && hintEl.querySelector('.lk-url'), url = location.href.split('#')[0];
    const done = () => { btn.innerHTML = 'Copied! <i lang="vi">Đã sao chép!</i>'; };
    const fallback = () => { if (!input) return; input.focus(); input.select(); try { if (doc.execCommand('copy')) done(); } catch (e) {} };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, fallback); else fallback();
  }
  doc.addEventListener('click', (e) => {
    const t = e.target instanceof Element ? e.target : null; if (!t) return;
    if (t.closest('[data-lk-install]')) { e.preventDefault(); install(); }
    else if (t.closest('[data-lk-banner-close]')) { state.installDismissedAt = Date.now(); save(); refreshInstall(); }
    else if (t.closest('[data-lk-copy]')) copyLink(t.closest('[data-lk-copy]'));
    else if (t.closest('[data-lk-close]') || t.classList.contains('lk-sheet')) closeHint();
  });
  doc.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeHint(); });

  /* other tabs changed the settings */
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    const before = state.sound;
    state = normalize(safeParse(e.newValue)); applyAttrs(); paint(); refreshInstall();
    if (before !== state.sound && !flags(state.sound).voiceOn) cancelSpeech();
    fire('onSync'); afterLayout();
  });

  /* opts: legacy ('rbm'), soundBtn/langBtn (selector, default '#muteBtn'/'#langBtn', false = none),
     fold ([[selector, 'bubble'|'tray'], ...], default bubble + tray), onLang, onSound, onPanels, onSync */
  function init(opts = {}) {
    Object.assign(handlers, { onLang: opts.onLang, onSound: opts.onSound, onPanels: opts.onPanels, onSync: opts.onSync });
    if (opts.legacy && store) { const r = readPrefs(store, opts.legacy); if (r.migrated) { state = r.prefs; save(); } }
    applyAttrs();
    const sb = opts.soundBtn === false ? null : $(opts.soundBtn || '#muteBtn');
    const lb = opts.langBtn === false ? null : $(opts.langBtn || '#langBtn');
    if (sb) { soundBtns.push(sb); sb.addEventListener('click', cycleSound); }
    if (lb) { langBtns.push(lb); lb.addEventListener('click', cycleLang); }
    (opts.fold || [['.bubble', 'bubble'], ['.tray', 'tray']]).forEach(([sel, kind]) => foldable(sel, kind));
    paint(); refreshInstall();
  }

  window.LabKit = {
    init, setSound, setLang, cycleSound, cycleLang, foldable, notifyTip, toast, install, refreshInstall,
    vibrate: (ms) => { if (flags(state.sound).sfxOn && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} } },
    soundIcon: (m) => ICONS[m || state.sound], SOUND_TEXT, LANG_LABEL, LANG_TEXT, core,
    get prefs() { return { sound: state.sound, lang: state.lang }; },
    get sound() { return state.sound; }, get lang() { return state.lang; },
    get voiceOn() { return flags(state.sound).voiceOn; }, get sfxOn() { return flags(state.sound).sfxOn; },
  };
  applyAttrs();
  html.classList.toggle('lk-standalone', realStandalone());
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', refreshInstall); else refreshInstall();
```

- [ ] **Step 2: Create the stylesheet**

Create `projects/little-color-lab/lab-kit.css`:

```css
/* Little Color Lab kit styles. Uses the page's --card/--ink/--marker/--sun/--line tokens when present. */
html[data-lk-lang="en"] #tipVi, html[data-lk-lang="vi"] #tipEn { display: none !important; }
html.lk-standalone [data-lk-leaves-app] { display: none !important; }

/* top-bar button for pages without their own .tool style (home page) */
.lk-tool { min-width: 48px; height: 48px; border: 0; border-radius: 14px; padding: 0 12px; display: inline-grid; place-items: center; cursor: pointer;
  background: var(--card, #fff); color: var(--ink, #1e2b44); box-shadow: 0 4px 0 var(--line, #d5ddca); font: 800 .95rem var(--f-display, system-ui, sans-serif); }
.lk-tool svg { width: 24px; height: 24px; }
.lk-tool:focus-visible, .lk-fold:focus-visible, .lk-install:focus-visible { outline: 3px solid var(--marker, #2c68b2); outline-offset: 2px; }

/* toast */
.lk-toast { position: fixed; left: 50%; top: calc(env(safe-area-inset-top, 0px) + 72px); z-index: 40; max-width: calc(100vw - 32px);
  transform: translate(-50%, -8px); opacity: 0; pointer-events: none; transition: opacity .2s, transform .2s;
  background: var(--card, #fff); color: var(--ink, #1e2b44); border-radius: 16px; padding: 8px 16px; text-align: center; box-shadow: 0 8px 24px rgba(10, 14, 24, .25); }
.lk-toast.show { opacity: 1; transform: translate(-50%, 0); }
.lk-toast b { display: block; font: 800 1rem var(--f-display, system-ui, sans-serif); }
.lk-toast i { display: block; font-style: normal; color: var(--marker, #2c68b2); }

/* fold buttons: a small tab while open, a chip / pill while folded */
.lk-foldable { position: relative; }
.lk-fold { position: absolute; z-index: 2; display: grid; place-items: center; border: 0; padding: 0; cursor: pointer; pointer-events: auto; font: inherit;
  background: var(--card, #fff); color: var(--ink, #1e2b44); box-shadow: 0 2px 8px rgba(10, 14, 24, .25); }
.lk-fold::before { content: ''; position: absolute; inset: -8px; }   /* tap target >= 44px */
.lk-fold svg { width: 18px; height: 18px; }
.lk-fold .lk-ic-chat, .lk-fold .lk-fold-t { display: none; }
.lk-fold-bubble { left: 50%; bottom: -14px; transform: translateX(-50%); width: 48px; height: 26px; border-radius: 13px; }   /* bottom-centre: clear of the say button */
.lk-fold-tray { top: -14px; left: 50%; transform: translateX(-50%); width: 48px; height: 26px; border-radius: 13px; }
.lk-fold-tray .lk-ic-chev { transform: rotate(180deg); }

.lk-collapsed[data-lk-fold]:not([hidden]) { display: flex !important; flex-direction: row !important; align-items: center !important; gap: 6px !important;
  align-self: auto !important; width: auto !important; min-width: 0 !important; max-width: none !important; padding: 6px !important; }
.lk-collapsed[data-lk-fold="tray"]:not([hidden]) { align-self: center !important; }   /* .hud stretches children; keep the pill small */
.lk-collapsed[data-lk-fold] > :not(.lk-fold):not(.say) { display: none !important; }
.lk-collapsed .lk-fold { position: static; transform: none; box-shadow: none; }
.lk-collapsed .lk-fold-bubble { width: 44px; height: 44px; background: var(--sun, #ffcd34); }
.lk-collapsed .lk-fold-bubble .lk-ic-chev { display: none; }
.lk-collapsed .lk-fold-bubble .lk-ic-chat { display: block; width: 24px; height: 24px; }
.lk-collapsed .lk-fold-tray { width: auto; height: 44px; padding: 0 14px; border-radius: 14px; display: flex; gap: 8px; align-items: center; }
.lk-collapsed .lk-fold-tray .lk-ic-chev { transform: none; }
.lk-collapsed .lk-fold-tray .lk-fold-t { display: flex; gap: 6px; align-items: baseline; }
.lk-fold-t b { font: 800 1rem var(--f-display, system-ui, sans-serif); }
.lk-fold-t i { font-style: normal; color: var(--marker, #2c68b2); }
.lk-pulse { animation: lk-pulse 1.1s ease-out 1; }
@keyframes lk-pulse { from { box-shadow: 0 0 0 0 rgba(255, 205, 52, .9); } to { box-shadow: 0 0 0 16px rgba(255, 205, 52, 0); } }

/* install button, banner and help sheet */
.lk-install { display: inline-flex; align-items: baseline; gap: 6px; min-height: 44px; padding: 10px 16px; border: 0; border-radius: 14px; cursor: pointer;
  background: var(--sun, #ffcd34); color: var(--ink, #1e2b44); font: 800 1rem var(--f-display, system-ui, sans-serif); }
.lk-install i { font-style: normal; font-weight: 600; }
.lk-install[hidden], .lk-banner[hidden] { display: none !important; }
.lk-banner { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 20px; background: var(--card, #fff); color: var(--ink, #1e2b44);
  box-shadow: 0 5px 0 var(--line, #d5ddca), 0 12px 26px rgba(30, 43, 68, .12); }
.lk-banner img { width: 48px; height: 48px; border-radius: 12px; flex: none; }
.lk-banner .lk-bt { flex: 1; min-width: 0; line-height: 1.25; }
.lk-banner .lk-bt b { display: block; font: 800 1.05rem var(--f-display, system-ui, sans-serif); }
.lk-banner .lk-bt span { display: block; font-size: .9rem; color: #4a5670; }
.lk-banner .lk-x, .lk-sheet .lk-x { flex: none; width: 44px; height: 44px; border: 0; border-radius: 50%; background: #eef1f6; color: var(--ink, #1e2b44); font-weight: 800; font-size: 1.1rem; cursor: pointer; }
@media (max-width: 420px) { .lk-banner { flex-wrap: wrap; } .lk-banner .lk-bt { flex-basis: calc(100% - 116px); } .lk-banner .lk-install { order: 3; flex: 1; justify-content: center; } }
.lk-sheet { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; padding: 16px; background: rgba(10, 14, 24, .55); }
.lk-sheet .lk-box { width: 100%; max-width: 440px; max-height: 100%; overflow: auto; background: var(--card, #fff); color: var(--ink, #1e2b44); border-radius: 24px; padding: 20px 22px 22px; }
.lk-sheet .lk-x { float: right; }
.lk-sheet h2 { margin: 0; font: 800 1.5rem var(--f-display, system-ui, sans-serif); }
.lk-sheet .lk-vi { margin: 0 0 8px; color: var(--marker, #2c68b2); }
.lk-sheet ol { margin: 8px 0; padding-left: 22px; line-height: 1.45; }
.lk-sheet li { margin: 8px 0; font-weight: 700; }
.lk-sheet i { font-style: normal; font-weight: 600; color: var(--marker, #2c68b2); }
.lk-sheet .lk-url { display: block; width: 100%; margin: 8px 0 12px; padding: 10px; border: 2px solid #d8dde6; border-radius: 12px; font: inherit; }

@media (prefers-reduced-motion: reduce) { .lk-pulse { animation: none; outline: 3px solid var(--sun, #ffcd34); } .lk-toast { transition: none; } }
```

- [ ] **Step 3: Re-run the unit tests (the browser part must not break Node loading)**

Run: `mise exec node@24.21.0 -- npm run test:lab`
Expected: 12 pass.

- [ ] **Step 4: Syntax-check the whole file as browser code**

Run: `mise exec node@24.21.0 -- node --check projects/little-color-lab/lab-kit.js`
Expected: no output, exit 0.

- [ ] **Step 5: Commit**

```bash
git add projects/little-color-lab/lab-kit.js projects/little-color-lab/lab-kit.css
git commit -m "Add Color Lab kit browser layer: buttons, toast, folds, install help"
```

### Task 3: Service workers

**Files:**
- Modify: `projects/little-color-lab/sw.js`
- Modify: `projects/rainbow-maker/sw.js`

- [ ] **Step 1: Color Lab SW**

In `projects/little-color-lab/sw.js`:
- `const VERSION = 'v1';` → `const VERSION = 'v2';`
- In `PRECACHE`, after `'./icons/icon-192.png',` add `'./lab-kit.js',` and `'./lab-kit.css',`.
- Update the header comment's first line to: `// Offline support: pages and same-origin JS/CSS are network-first (so updates show up), everything else`
- Replace the `if (req.mode === 'navigate') {` condition and its fallback so the block reads:

```js
  const url = new URL(req.url);
  const fresh = req.mode === 'navigate' || (url.origin === self.location.origin && /\.(js|css)$/.test(url.pathname));
  if (fresh) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true })
          .then((hit) => hit || (req.mode === 'navigate' ? caches.match('./') : Response.error())))
    );
    return;
  }
```

- [ ] **Step 2: Standalone SW**

Same edits in `projects/rainbow-maker/sw.js`: `VERSION` → `'v2'`, same comment and `fresh` block, and in `PRECACHE` after `'./icons/icon-192.png',` add `'../little-color-lab/lab-kit.js',` and `'../little-color-lab/lab-kit.css',`.

- [ ] **Step 3: Syntax check**

Run: `for f in projects/little-color-lab/sw.js projects/rainbow-maker/sw.js; do mise exec node@24.21.0 -- node --check $f && echo ok $f; done`
Expected: `ok` twice.

- [ ] **Step 4: Commit**

```bash
git add projects/little-color-lab/sw.js projects/rainbow-maker/sw.js
git commit -m "Service workers: network-first for same-origin JS/CSS, precache kit"
```

---

## Chunk 2: Color Lab games and home page

### Task 4: Smoke-test harness (scratchpad, not committed)

**Files:**
- Create: `$SCRATCH/smoke/package.json`, `$SCRATCH/smoke/smoke.mjs`

- [ ] **Step 1: Install playwright-core in the scratchpad**

```bash
mkdir -p $SCRATCH/smoke && cd $SCRATCH/smoke && mise exec node@24.21.0 -- npm init -y >/dev/null && mise exec node@24.21.0 -- npm i playwright-core@1.63.0
```

- [ ] **Step 2: Start a static server (background) from the repo root**

Run in background: `python3 -m http.server 8765 -d /home/duy/duy-github/cuibaponline.github.io/projects`
Pages are then at `http://localhost:8765/little-color-lab/...` (localhost counts as a secure context, so service workers run).

- [ ] **Step 3: Write `$SCRATCH/smoke/smoke.mjs`**

```js
// Usage: node smoke.mjs <game-dir> [<game-dir> ...]   e.g. node smoke.mjs rainbow-maker paint-mixing
// Checks one Color Lab game at phone size: buttons visible, 3 sound modes, 3 languages, folds, no errors.
import { chromium } from 'playwright-core';
const BASE = 'http://localhost:8765/little-color-lab/';
const OUT = new URL('./shots/', import.meta.url).pathname;
import { mkdirSync } from 'node:fs'; mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
let failed = 0;
const check = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) failed++; };
for (const game of process.argv.slice(2)) {
  for (const vp of [{ width: 360, height: 740 }, { width: 740, height: 360 }]) {
    console.log(`${game} ${vp.width}x${vp.height}`);
    const ctx = await browser.newContext({ viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    // Count utterances instead of speaking: window.__spoken gets one entry (the lang) per speak() call.
    await ctx.addInitScript(() => {
      window.__spoken = [];
      if (window.speechSynthesis) speechSynthesis.speak = (u) => { window.__spoken.push(u.lang); };
    });
    const page = await ctx.newPage();
    const spoken = () => page.evaluate(() => window.__spoken.slice());
    const resetSpoken = () => page.evaluate(() => { window.__spoken.length = 0; });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.goto(BASE + game + '/');
    await page.waitForSelector('#goBtn:not([disabled])', { timeout: 30000 });
    check(await page.locator('#startScreen [data-lk-install]').count() === 1, 'install button on start screen');
    check(await page.isVisible('#startScreen [data-lk-install]') === false, 'install button hidden on desktop Chromium without prompt');
    await page.click('#goBtn');
    await page.waitForTimeout(1500);
    check((await spoken()).length === 0, 'no speech after start in default sfx mode');
    const attr = (n) => page.evaluate((n) => document.documentElement.getAttribute(n), n);
    for (const id of ['#langBtn', '#muteBtn', '#infoBtn']) {
      const b = await page.locator(id).boundingBox();
      check(b && b.x >= 0 && b.x + b.width <= vp.width + 0.5 && b.y >= 0, `${id} visible inside viewport`);
    }
    const overlap = await page.evaluate(() => {
      const t = document.querySelector('.top > :first-child').getBoundingClientRect(), b = document.querySelector('.tools').getBoundingClientRect();
      return t.right > b.left + 1 && t.bottom > b.top && t.top < b.bottom;
    });
    check(!overlap, 'title does not overlap the top-bar buttons');
    check(await attr('data-lk-sound') === 'sfx', 'default sound = sfx');
    await resetSpoken(); await page.click('#sayBtn');
    check((await spoken()).join() === 'en-US,vi-VN', 'say button speaks EN then VI in sfx mode');
    await page.click('#muteBtn'); check(await attr('data-lk-sound') === 'all', 'tap -> all');
    await resetSpoken(); await page.click('#langBtn'); await page.click('#langBtn'); await page.click('#langBtn');   // en, vi, back to both
    check((await spoken()).join() === 'en-US,vi-VN,en-US,vi-VN', 'language change re-speaks in voice mode (en, vi, both)');
    await page.click('#muteBtn'); check(await attr('data-lk-sound') === 'off', 'tap -> off');
    await resetSpoken(); await page.click('#sayBtn'); check((await spoken()).length === 0, 'say button silent in off mode');
    await page.click('#muteBtn'); check(await attr('data-lk-sound') === 'sfx', 'tap -> sfx');
    await page.click('#langBtn'); check(await attr('data-lk-lang') === 'en' && !(await page.isVisible('#tipVi')) && await page.isVisible('#tipEn'), 'lang en hides #tipVi');
    await page.click('#langBtn'); check(await attr('data-lk-lang') === 'vi' && !(await page.isVisible('#tipEn')) && await page.isVisible('#tipVi'), 'lang vi hides #tipEn');
    await page.click('#langBtn'); check(await attr('data-lk-lang') === 'both' && await page.isVisible('#tipEn') && await page.isVisible('#tipVi'), 'lang both shows both');
    await page.screenshot({ path: `${OUT}${game}-${vp.width}-open.png` });
    await page.click('.bubble .lk-fold'); await page.waitForTimeout(100);
    check(!(await page.isVisible('#tipEn')) && await page.isVisible('#sayBtn'), 'bubble folds, say button stays');
    await page.click('.tray .lk-fold'); await page.waitForTimeout(100);
    check(await page.evaluate(() => document.querySelector('.tray').classList.contains('lk-collapsed')), 'tray folds');
    await page.screenshot({ path: `${OUT}${game}-${vp.width}-folded.png` });
    await page.reload(); await page.waitForSelector('#goBtn:not([disabled])', { timeout: 30000 }); await page.click('#goBtn');
    check(await page.evaluate(() => document.querySelector('.bubble').classList.contains('lk-collapsed')), 'fold state survives reload');
    await page.click('.bubble .lk-fold'); await page.click('.tray .lk-fold');
    await page.click('#infoBtn'); await page.waitForTimeout(100);
    check(await page.locator('#info [data-lk-install]').count() === 1, 'install button present in grown-ups sheet');
    check(errors.length === 0, 'no page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await ctx.close();
  }
}
await browser.close();
console.log(failed ? `${failed} check(s) FAILED` : 'all checks passed');
process.exit(failed ? 1 : 0);
```

Note: the harness is expected to fail until a game is migrated (Task 5).

### Task 5: Migrate the in-lab Rainbow Maker (pilot)

**Files:**
- Modify: `projects/little-color-lab/rainbow-maker/index.html`

Line numbers below are from the current file; re-check with `grep -n` before editing.

- [ ] **Step 1: Run the smoke test to see it fail**

Run: `cd $SCRATCH/smoke && mise exec node@24.21.0 -- node smoke.mjs rainbow-maker`
Expected: FAIL (`default sound = sfx` fails because `data-lk-sound` is null).

- [ ] **Step 2: Load the kit**

After line 144 (`<script>if('serviceWorker' ...` ) add:

```html
<link rel="stylesheet" href="../lab-kit.css">
<script src="../lab-kit.js"></script>
```

- [ ] **Step 3: Keep the language button on small phones**

Line 128: `@media (max-width:400px){ .tools #langBtn{display:none} .title .arc{display:none} }` → `@media (max-width:400px){ .title .arc{display:none} }`

- [ ] **Step 4: Let the kit paint the sound button**

Replace the whole `<button class="tool" id="muteBtn" ...>...</button>` (lines 160-163, including both `<svg>`s) with:

```html
      <button class="tool" id="muteBtn" aria-label="Sound"></button>
```

- [ ] **Step 5: Install buttons**

After the start screen's `<button class="go" id="goBtn" disabled>...</button>` line add:

```html
    <button class="lk-install" type="button" data-lk-install hidden>Install app <i lang="vi">Cài ứng dụng</i></button>
```

After the grown-ups sheet's `<p class="vi" lang="vi">Dành cho ba mẹ</p>` line add:

```html
    <p><button class="lk-install" type="button" data-lk-install hidden>Install app <i lang="vi">Cài ứng dụng</i></button></p>
```

Check the start-screen container stacks it nicely; if `.start` is not a column flex/grid, add `.start .lk-install{margin-top:10px}` to the page `<style>`.

- [ ] **Step 6: Replace the local settings code**

Replace lines 281-288 (from `let soundOn=true, voiceMode='both';` through the `muteBtn.onclick=...` line, i.e. the `try{...localStorage...}`, `langBtn/muteBtn` consts, `LANG_LABEL`, `syncTools`, `syncTools();`, `langBtn.onclick`, `muteBtn.onclick`) with:

```js
LabKit.init({ legacy:'rbm', onLang:()=>sayTip(), onPanels:()=>{ fitCamera(); placeCamera(); lastBubbleH=$('.bubble').offsetHeight; } });
```

- [ ] **Step 7: Gate voice and effects on the kit**

- `function say(en,vi){` + `  if(!soundOn) return;` → `function say(en,vi,force){` + `  if(!(LabKit.voiceOn||(force&&LabKit.sfxOn))) return;`
- `if(voiceMode!=='vi')` → `if(LabKit.lang!=='vi')`; `if(voiceMode!=='en')` → `if(LabKit.lang!=='en')`
- In `tone()`: `if(!soundOn||!ac) return;` → `if(!LabKit.sfxOn||!ac) return;`
- `click`: `try{ if(soundOn&&navigator.vibrate) navigator.vibrate(12);}catch(e){}` → `LabKit.vibrate(12);`
- `setTip`: append `LabKit.notifyTip();` before the closing `}` (after `if(speak!==false) say(en,vi);`).
- `function sayTip(){ say(tip.en,tip.vi); }` → `function sayTip(force){ say(tip.en,tip.vi,force); }`
- `$('#sayBtn').onclick=()=>{unlock();sayTip();};` → `$('#sayBtn').onclick=()=>{unlock();sayTip(true);};`
- Line ~737: `const gap=voiceMode==='both'&&soundOn?1500:900;` → `const gap=LabKit.lang==='both'&&LabKit.voiceOn?1500:900;`

- [ ] **Step 8: Confirm nothing old is left**

Run: `grep -nE "soundOn|voiceMode|syncTools|LANG_LABEL|rbm-(voice|mute)" projects/little-color-lab/rainbow-maker/index.html`
Expected: no output.

- [ ] **Step 9: Run the smoke test**

Run: `cd $SCRATCH/smoke && mise exec node@24.21.0 -- node smoke.mjs rainbow-maker`
Expected: `all checks passed`.

- [ ] **Step 10: Look at the screenshots**

Read `$SCRATCH/smoke/shots/rainbow-maker-360-open.png`, `-360-folded.png`, `-740-open.png`, `-740-folded.png`. Check:
- the title still fits next to the Back, EN + VI, sound and ? buttons;
- the bubble's fold tab doesn't cover the say button or the text;
- the tray tab sits on the tray's top edge;
- the folded chip and the "Controls" pill look tidy;
- the camera refit uses the space freed by folding.
Adjust `lab-kit.css` if needed. If `lab-kit.css` changes, re-run Step 9.

- [ ] **Step 11: Commit**

```bash
git add projects/little-color-lab/rainbow-maker/index.html projects/little-color-lab/lab-kit.css
git commit -m "Rainbow Maker (lab): use kit for sound, language, folds, install"
```

### Task 6: Migrate the other 7 games

Apply the Task 5 recipe (Steps 2-10) to each game below, one commit per game (`<Game>: use kit for sound, language, folds, install`). Use the table for game-specific differences. All games have `#muteBtn` with two inner SVGs, `#langBtn`, `#goBtn`, `#infoTitle` + `<p class="vi" lang="vi">Dành cho ba mẹ</p>`, `say(en,vi)`, `setTip`, `sayTip`, `#sayBtn`, `tone()`, `fitCamera()`/`placeCamera()`.

| Game dir | `legacy` | `#langBtn` hide rule → becomes | Extra `soundOn` sites → `LabKit.sfxOn` | Vibration | `onPanels` |
|---|---|---|---|---|---|
| `color-dancing` | `cdl` | none to remove; **also** add `pointer-events:auto` to its `.bubble{...}` rule (line ~57; it inherits `none` from `.col`, so the say button and fold chip are dead today) | `pourNoise` (`if(!soundOn\|\|!ac) return;`) | `buzz` → `const buzz=ms=>LabKit.vibrate(ms);` | `()=>{ fitCamera(); placeCamera(); }` (no `lastBubbleH`) |
| `colored-shadows` | `cs` | line 145 → delete the whole `@media (max-width:400px){...}` rule | none | `buzz` | `()=>{ fitCamera(); placeCamera(); lastBubbleH=$('.bubble').offsetHeight; }` |
| `color-hunt` | `chunt` | none to remove | none | `buzz` | same as colored-shadows |
| `light-and-color` | `lcl` | line 129 → `@media (max-width:400px){ .tab i{font-size:.8rem} }` | none | `click` inline → `LabKit.vibrate(12);` | same |
| `paint-mixing` | `pml` | line 156 → delete the whole rule | `noise` (`if(!soundOn\|\|!ac) return;`) | `buzz` | same |
| `rainbow-milk` | `rbm` | line 131 → `@media (max-width:360px){ .cbtn b{display:none} }` | `noise` | `buzz` | same |
| `walking-water` | `ww` | line 139 → delete the whole rule | `noise` | `buzz` | same |

For each game:

- [ ] **Step 1:** Make the edits (kit tags, CSS rule, `#muteBtn` markup, install buttons, `LabKit.init({ legacy:'<prefix>', onLang:()=>sayTip(), onPanels:<from table> })` in place of the settings block, `say`/`tone`/extra sound fns/vibration/`setTip`/`sayTip`/`#sayBtn` changes).
- [ ] **Step 2:** `grep -nE "soundOn|voiceMode|syncTools|LANG_LABEL|-(voice|mute)'" projects/little-color-lab/<game>/index.html` → no output.
- [ ] **Step 3:** `cd $SCRATCH/smoke && mise exec node@24.21.0 -- node smoke.mjs <game>` → `all checks passed`.
- [ ] **Step 4:** Look at the 4 screenshots for that game (same checklist as Task 5 Step 10). Narrow titles: if the title wraps badly at 360px, hide its decorative icon at `max-width:400px` like rainbow-maker does, or shrink its font. Don't hide any button.
- [ ] **Step 5:** Commit that game.

After all 7: run `mise exec node@24.21.0 -- node smoke.mjs color-dancing colored-shadows color-hunt light-and-color paint-mixing rainbow-maker rainbow-milk walking-water` → `all checks passed`.

### Task 7: Color Lab home page

**Files:**
- Modify: `projects/little-color-lab/index.html`

- [ ] **Step 1: Load the kit**

After the `<script>if('serviceWorker' ...` line add:

```html
<link rel="stylesheet" href="lab-kit.css">
<script src="lab-kit.js"></script>
```

- [ ] **Step 2: Top row with Back, language and sound**

Wrap the existing Back `<a href="/" ...>...</a>` in a row with the two kit buttons, and mark Back as leaving the app:
- Add `data-lk-leaves-app` to the `<a href="/"`.
- Remove `align-self:flex-start` from that link's inline style.
- Put it inside `<div class="hubtop">` … `</div>`. Inside the same div, after the link, add `<span class="hubtools"><button class="lk-tool" id="langBtn"></button><button class="lk-tool" id="muteBtn" aria-label="Sound"></button></span>`.
- Add to the page `<style>`: `.hubtop{display:flex;align-items:center;gap:8px}.hubtools{margin-left:auto;display:flex;gap:8px}`.

- [ ] **Step 3: Install banner**

After the `<div>` containing the `<h1>` and `.sub`, add:

```html
  <div class="lk-banner" data-lk-install-banner hidden>
    <img src="icons/icon-192.png" alt="">
    <div class="lk-bt"><b>Install Color Lab</b><span>Play from your home screen, even offline. · Chơi ngay từ màn hình chính, cả khi không có mạng.</span></div>
    <button class="lk-install" type="button" data-lk-install>Install <i lang="vi">Cài</i></button>
    <button class="lk-x" type="button" data-lk-banner-close aria-label="Not now">✕</button>
  </div>
```

- [ ] **Step 4: Init and footer**

Before `</body>` add `<script>LabKit.init({ fold: [] });</script>`.

Change the footer sentence `Works best on a phone with the sound on.` to `Works best on a phone with the sound on. The speaker button switches between sounds only, voice + sounds, and silent.`

- [ ] **Step 5: Check in the browser**

Use a quick Playwright snippet (or extend smoke.mjs with a `--home` mode) at 360×740:
- the Back, EN + VI and sound buttons are on one row;
- tapping sound cycles `data-lk-sound`;
- the banner is hidden in plain desktop Chromium (no prompt);
- with the iPhone Chrome user agent (from the unit test file) the banner shows, and tapping Install opens `.lk-sheet` containing "address bar";
- with the Zalo user agent the sheet contains "Copy link";
- with the Samsung user agent it contains "Add page to";
- tapping ✕ on the banner hides it, and it stays hidden after a reload.

Take screenshots and look at them.

- [ ] **Step 6: Commit**

```bash
git add projects/little-color-lab/index.html
git commit -m "Color Lab home: sound and language buttons, install banner"
```

---

## Chunk 3: Standalone Rainbow Maker

### Task 8: Standalone Rainbow Maker on the kit

**Files:**
- Modify: `projects/rainbow-maker/index.html`

Read the file's `T` dictionaries (lines ~333-415), `state` (~416), `say`/`pickVoice`/`note` (~432-465), `applyLang` (~474), `updateHint` (~492), and the control handlers (~510-530) before editing.

- [ ] **Step 1: Load the kit**

After the `<script>if('serviceWorker' ...` line add:

```html
<link rel="stylesheet" href="../little-color-lab/lab-kit.css">
<script src="../little-color-lab/lab-kit.js"></script>
```

Add `data-lk-leaves-app` to the Back `<a class="chip-btn" href="/"`.

- [ ] **Step 2: Make "Hide panels" still win over folding**

`#app.clean .hint, #app.clean .controls { display: none; }` → `#app.clean .hint, #app.clean .controls { display: none !important; }`

- [ ] **Step 3: Markup**

- Keep the hear button on the folded hint chip: add to the `<style>` `#hint.lk-collapsed > .msg-row { display: flex !important; } #hint.lk-collapsed .msgs { display: none !important; }`

- Sound button: `<button class="chip-btn" id="speakBtn" aria-pressed="true"><span aria-hidden="true">🗣️</span><span class="lbl" data-i="readAloud"></span></button>` → `<button class="chip-btn" id="speakBtn"><span class="ic" aria-hidden="true"></span><span class="lbl"></span></button>`, and add `.chip-btn .ic svg{width:20px;height:20px;display:block}` to the `<style>`.
- Message: `<div class="msg-row"><p class="msg" id="msg"></p>` → `<div class="msg-row"><div class="msgs"><p class="msg" id="msgEn" lang="en" hidden></p><p class="msg" id="msg"></p></div>`. Add `.msgs{flex:1;min-width:0}.msgs .msg + .msg{margin-top:.2rem}` to the `<style>`.
- Install banner, right after `</header>` (inside `.overlay-top`): the same `.lk-banner` markup as Task 7 Step 3, with `src="icons/icon-192.png"`, title `Install Rainbow Maker`, and an extra class `lk-banner-float`. Add `.lk-banner-float{pointer-events:auto;margin:0 auto .5rem;max-width:30rem}` to the `<style>`.
- In the grown-ups sheet, after the `<div class="card-head">...</div>` line: `<p><button class="lk-install" type="button" data-lk-install hidden>Install app <i lang="vi">Cài ứng dụng</i></button></p>`.

- [ ] **Step 4: State and UI language**

- `const state = { lang: 'vi', ... speak: true, ... }` → `lang: LabKit.lang`, and remove `speak: true`.
- Right after `state`, add: `const ui = () => (state.lang === 'en' ? 'en' : 'vi');   // 'both' shows the Vietnamese UI with both hint lines`
- Replace every `T[state.lang]` with `T[ui()]`. Check with `grep -n "T\[state.lang\]"`, which should give no output.
- In `applyLang`: `document.documentElement.lang = state.lang;` → `document.documentElement.lang = ui();`, and the language button labels become `$('langLong').textContent = LabKit.LANG_TEXT[state.lang][ui() === 'en' ? 0 : 1]; $('langShort').textContent = LabKit.LANG_LABEL[state.lang]; $('langBtn').setAttribute('aria-label', 'Language: ' + LabKit.LANG_TEXT[state.lang][0]);`. Replace `labelSpeak()` calls there with `paintSpeak()`.

- [ ] **Step 5: Speech**

- `pickVoice()` takes the language: `function pickVoice(lang) { const want = lang === 'vi' ? 'vi' : 'en'; ...`
- Replace `say(text, force)` with a queue version:

```js
// items: [[text, 'en'|'vi'], ...]; plays in order. force = a tap on a "hear it" button.
function speak(items, force) {
  if (!(LabKit.voiceOn || (force && LabKit.sfxOn))) return;
  if (!hasSpeech) { note('noSpeech'); return; }
  try {
    loadVoices();
    const us = items.filter((it) => it[0]).map(([text, lang]) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === 'vi' ? 'vi-VN' : 'en-US'; u.rate = 0.88; u.pitch = 1.1; u.volume = 1;
      const v = pickVoice(lang);
      if (v) { u.voice = v; note(null); } else note(voices.length ? 'noVoice' : 'noSpeech');
      return u;
    });
    const go = () => { try { speechSynthesis.resume(); us.forEach((u) => speechSynthesis.speak(u)); } catch (e) {} };
    if (speechSynthesis.speaking || speechSynthesis.pending) { speechSynthesis.cancel(); setTimeout(go, 80); } else go();
  } catch (e) {}
}
const say = (text, force) => speak([[text, ui()]], force);
// get(L) picks a string from one T dictionary; in 'both' it is spoken in English, then Vietnamese
const sayKey = (get, force) => speak(state.lang === 'both' ? [[get(T.en), 'en'], [get(T.vi), 'vi']] : [[get(T[ui()]), ui()]], force);
function sayMsg(force) { speak(state.lang === 'both' ? [[$('msgEn').textContent, 'en'], [$('msg').textContent, 'vi']] : [[$('msg').textContent, ui()]], force); }
```

- `$('hearBtn').onclick`: `say($('msg').textContent, true)` → `sayMsg(true)`, and only show the `muteTip` note when sound isn't off: wrap the `setTimeout(...)` part in `if (LabKit.sfxOn) { ... }`.
- Legend taps (`$('legend').onclick`, ~line 523): `if (b) say(b.textContent, true);` → `if (b) sayKey((L) => L.colors[+b.dataset.c], true);`
- Drop-view narration (~lines 1032, 1037, 1038): `say(T[...].d[dropStep])` → `sayKey((L) => L.d[dropStep])`, and both `say(T[...].d[0])` → `sayKey((L) => L.d[0])`.

- [ ] **Step 6: Both-language hint**

In `updateHint`, after `const msgText = ...;` add:

```js
  const enText = state.lang === 'both' ? (key === 'success' ? `${T.en[key]} ${T.en.doubleBow}` : T.en[key]) : '';
  $('msgEn').textContent = enText; $('msgEn').hidden = !enText;
```

and change `if (msgText !== lastMsg) { if (lastMsg) say(msgText); lastMsg = msgText; }` to:

```js
  const said = enText + '|' + msgText;
  if (said !== lastMsg) { if (lastMsg) { sayMsg(); LabKit.notifyTip(); } lastMsg = said; }
```

- [ ] **Step 7: Sound button, language button, effects**

Replace the `$('langBtn').onclick`, `$('speakBtn').onclick` and `labelSpeak` lines with:

```js
$('langBtn').onclick = () => LabKit.cycleLang();
$('speakBtn').onclick = () => { audio(); LabKit.cycleSound(); };
function paintSpeak() {
  const t = LabKit.SOUND_TEXT[LabKit.sound];
  $('speakBtn').querySelector('.ic').innerHTML = LabKit.soundIcon();
  $('speakBtn').querySelector('.lbl').textContent = t[ui() === 'en' ? 0 : 1];
  $('speakBtn').setAttribute('aria-label', t[0] + ' / ' + t[1]);
}
LabKit.init({
  soundBtn: false, langBtn: false,
  fold: [['#hint', 'bubble'], ['.controls .tray', 'tray']],
  onLang: (l) => { state.lang = l; applyLang(); if (LabKit.voiceOn) sayMsg(); },   // applyLang resets lastMsg, so speak here
  onSound: () => { paintSpeak(); if (!LabKit.voiceOn) note(null); },
  onSync: () => { state.lang = LabKit.lang; applyLang(); paintSpeak(); },
});
```

- At the top of `chime()` and `trumpet()`, and any other function that creates an oscillator or plays a sound (`grep -n "createOscillator\|createBufferSource" projects/rainbow-maker/index.html` to find them), add `if (!LabKit.sfxOn) return;` as the first line.
- Make sure `applyLang()` calls `paintSpeak()` and that `applyLang()` runs once at startup (it already does; keep that call **after** `LabKit.init`, or call `paintSpeak()` right after init).
- Remove the now-unused `readAloud`, `readAloudOff` keys from both `T.en` and `T.vi` only if nothing else references them (`grep -n "readAloud"`).

- [ ] **Step 8: Leftovers**

`grep -nE "state\.speak|labelSpeak|T\[state\.lang\]" projects/rainbow-maker/index.html` → no output.

- [ ] **Step 9: Browser check**

Write `$SCRATCH/smoke/standalone.mjs` (same harness style) for `http://localhost:8765/rainbow-maker/` at 360×740 and 740×360. Check that:
- `#speakBtn` cycles `data-lk-sound` sfx → all → off → sfx and its label changes;
- `#langBtn` cycles both → en → vi;
- in `both`, `#msgEn` is visible with English text and `#msg` shows Vietnamese, and `html[lang]` is `vi`;
- in `en`, `#msgEn` is hidden and `html[lang]` is `en`;
- with the same `speechSynthesis.speak` counter as smoke.mjs: no speech in `sfx` until `#hearBtn` is tapped, `#hearBtn` in `both` speaks `en-US,vi-VN`, nothing in `off`; folded hint still shows `#hearBtn`;
- `#hint .lk-fold` folds the hint;
- `.controls .tray .lk-fold` folds the tray;
- the clean button still hides both even when folded;
- there are no page errors.

Then take screenshots and look at them.

Then check sharing with Color Lab: set the sound to `all` here, open `http://localhost:8765/little-color-lab/rainbow-maker/` in the same context, and confirm `data-lk-sound` is `all`.

- [ ] **Step 10: Commit**

```bash
git add projects/rainbow-maker/index.html
git commit -m "Standalone Rainbow Maker: shared settings, 3-state sound, EN+VI, folds, install"
```

---

## Chunk 4: Install sheet polish and wrap-up

### Task 9: Manifest screenshots

**Files:**
- Create: `projects/little-color-lab/screenshots/narrow.png`, `wide.png`; `projects/rainbow-maker/screenshots/narrow.png`, `wide.png`
- Modify: both `manifest.webmanifest`

- [ ] **Step 1: Capture**

With Playwright (deviceScaleFactor 2), after starting the game and dismissing nothing else:
- Color Lab: `little-color-lab/rainbow-maker/` at viewport 360×640 → 720×1280 `narrow.png`, and 640×360 → 1280×720 `wide.png`. Wait ~2s after Let's play so the scene renders.
- Standalone: `rainbow-maker/` at the same two sizes.

Before capturing, set `localStorage['cuibap-prefs']` to `{"sound":"sfx","lang":"both"}`. Verify the sizes with `file projects/*/screenshots/*.png`.

- [ ] **Step 2: Manifests**

Add after `"icons": [...]` in each manifest (labels: "Rainbow Maker in Little Color Lab" / "Make a rainbow with Elephant"):

```json
  "screenshots": [
    { "src": "screenshots/narrow.png", "sizes": "720x1280", "type": "image/png", "form_factor": "narrow", "label": "..." },
    { "src": "screenshots/wide.png", "sizes": "1280x720", "type": "image/png", "form_factor": "wide", "label": "..." }
  ]
```

Validate: `for f in projects/*/manifest.webmanifest; do python3 -m json.tool $f >/dev/null && echo ok $f; done`.

- [ ] **Step 3: Installability check**

With Playwright + CDP on `http://localhost:8765/little-color-lab/` and `/rainbow-maker/`: `const s = await page.context().newCDPSession(page); await s.send('Page.getInstallabilityErrors')` should return `{ installabilityErrors: [] }`. Also `Page.getAppManifest` should return no `errors`.

- [ ] **Step 4: Commit**

```bash
git add projects/little-color-lab/screenshots projects/rainbow-maker/screenshots projects/little-color-lab/manifest.webmanifest projects/rainbow-maker/manifest.webmanifest
git commit -m "Add install-sheet screenshots to both manifests"
```

### Task 10: Docs and final verification

**Files:**
- Modify: `projects/little-color-lab/README.md`

- [ ] **Step 1: README**

Replace the last paragraph ("Each game is a single `index.html` ... need an internet connection.") with:

```markdown
Each game is a single `index.html` with no build step. They share `lab-kit.js` and `lab-kit.css`
(also used by the standalone `/rainbow-maker`): one saved setting for sound (sounds only, voice + sounds,
silent) and language (EN + VI, EN, VI), the foldable tip bubble and control tray, and the "Install app"
help for Android, iPhone, Samsung Internet and in-app browsers like Zalo. Settings live in
`localStorage['cuibap-prefs']`. three.js (r128) and the fonts load from public CDNs; after the first
visit the service worker keeps everything available offline.

Tests for the kit's logic: `mise exec node@24.21.0 -- npm run test:lab`.
```

- [ ] **Step 2: Full verification**

- `mise exec node@24.21.0 -- npm run test:lab` → 12 pass.
- `cd $SCRATCH/smoke && mise exec node@24.21.0 -- node smoke.mjs color-dancing colored-shadows color-hunt light-and-color paint-mixing rainbow-maker rainbow-milk walking-water` → `all checks passed`.
- `mise exec node@24.21.0 -- node standalone.mjs` → passes.
- `git status --short` shows only the README edit and the pre-existing ` M .gitignore` (leave that one alone); `grep -rnE "soundOn|voiceMode" projects/little-color-lab projects/rainbow-maker` → no output.
- Make sure the deploy workflow needs no change: it copies `projects/little-color-lab` and `projects/rainbow-maker` whole, so `lab-kit.*` and `screenshots/` ship. `tests/` is not copied.

- [ ] **Step 3: Commit**

```bash
git add projects/little-color-lab/README.md
git commit -m "Color Lab README: shared kit, settings, tests"
```

- [ ] **Step 4: Hand back to the user (do not push)**

Report what was verified automatically and what needs real devices:
- iPhone Safari and Chrome (hint wording, Add to Home Screen opens full screen);
- Android Chrome and Samsung Internet (one-tap install);
- a link opened from Zalo (open-in-browser hint);
- whether the Vietnamese menu names in the hints match the phones.

Remind them that pushing to master deploys.
