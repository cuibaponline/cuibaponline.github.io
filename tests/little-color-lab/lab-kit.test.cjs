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
  iphoneLine: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.10.0',
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
  assert.equal(m(UA.iphoneLine, 5, false, false), 'inapp');
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
