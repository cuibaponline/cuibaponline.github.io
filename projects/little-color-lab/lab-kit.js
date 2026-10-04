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
