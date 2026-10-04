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
  let toastEl = null, toastT = 0, inited = false;
  function ensureToast() {
    if (toastEl) return;
    toastEl = doc.createElement('div'); toastEl.className = 'lk-toast';
    toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
    toastEl.innerHTML = '<b></b><i lang="vi"></i>'; doc.body.appendChild(toastEl);
  }
  function toast(en, vi) {
    ensureToast();
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
  function setFolded(kind, c) { state.collapsed[kind] = !!c; save(); folds.forEach((el) => { el.classList.remove('lk-pulse'); paintFold(el); }); afterLayout(); }
  function notifyTip() {
    if (!state.collapsed.bubble) return;
    folds.forEach((el) => {
      if (el.getAttribute('data-lk-fold') !== 'bubble') return;
      el.classList.remove('lk-pulse'); void el.offsetWidth; el.classList.add('lk-pulse');
      const off = () => el.classList.remove('lk-pulse');
      el.addEventListener('animationend', off, { once: true }); setTimeout(off, 1300);   // timer covers reduced-motion (no animation)
    });
  }

  /* install help */
  let deferred = null, justInstalled = false, hintEl = null, hintReturn = null, inerted = [];
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
      try { Promise.resolve(d.prompt()).catch(() => {}); d.userChoice.then((c) => { if (c && c.outcome === 'accepted') justInstalled = true; refreshInstall(); }, () => {}); } catch (e) {}
      refreshInstall(); return;
    }
    if (m !== 'none' && m !== 'installed') showHint(m);
  }
  function showHint(m) {
    closeHint(); hintReturn = doc.activeElement;
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
    doc.body.appendChild(hintEl);
    inerted = Array.from(doc.body.children).filter((el) => el !== hintEl && !el.inert);
    inerted.forEach((el) => { el.inert = true; });
    hintEl.querySelector('[data-lk-close]').focus();
  }
  function closeHint() {
    if (!hintEl) return;
    hintEl.remove(); hintEl = null;
    inerted.forEach((el) => { el.inert = false; }); inerted = [];
    if (hintReturn && doc.contains(hintReturn)) { try { hintReturn.focus(); } catch (e) {} }
    hintReturn = null;
  }
  function copyLink(btn) {
    const input = hintEl && hintEl.querySelector('.lk-url'), url = location.href.split('#')[0];
    const done = () => { btn.innerHTML = 'Copied! <i lang="vi">Đã sao chép!</i>'; };
    const fallback = () => { if (!input) return; input.focus(); input.select(); input.setSelectionRange(0, input.value.length); try { if (doc.execCommand('copy')) done(); } catch (e) {} };
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
    if (inited) return;
    inited = true;
    Object.assign(handlers, { onLang: opts.onLang, onSound: opts.onSound, onPanels: opts.onPanels, onSync: opts.onSync });
    if (opts.legacy && store) { const r = readPrefs(store, opts.legacy); if (r.migrated) { state = r.prefs; save(); } }
    applyAttrs();
    const sb = opts.soundBtn === false ? null : $(opts.soundBtn || '#muteBtn');
    const lb = opts.langBtn === false ? null : $(opts.langBtn || '#langBtn');
    if (sb) { soundBtns.push(sb); sb.addEventListener('click', cycleSound); }
    if (lb) { langBtns.push(lb); lb.addEventListener('click', cycleLang); }
    (opts.fold || [['.bubble', 'bubble'], ['.tray', 'tray']]).forEach(([sel, kind]) => foldable(sel, kind));
    if (doc.body) ensureToast();
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
})();
