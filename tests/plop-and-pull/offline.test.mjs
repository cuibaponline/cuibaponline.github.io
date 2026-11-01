import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const root = new URL('../../projects/arcade-games/plop-and-pull/', import.meta.url);

test('the service worker precaches every source module and icon', () => {
  const worker = readFileSync(new URL('sw.js', root), 'utf8');
  for (const file of readdirSync(new URL('src/', root))) assert.ok(worker.includes(`./src/${file}`), file);
  for (const file of readdirSync(new URL('icons/', root))) assert.ok(worker.includes(`./icons/${file}`), file);
});

test('the game loads nothing from the network', () => {
  const page = readFileSync(new URL('index.html', root), 'utf8') + readFileSync(new URL('style.css', root), 'utf8');
  assert.ok(!/(src|href)="https?:/.test(page));
  assert.ok(!/url\(/.test(page));
  for (const file of readdirSync(new URL('src/', root))) {
    assert.ok(!/fetch\(|XMLHttpRequest|https?:\/\//.test(readFileSync(new URL(`src/${file}`, root), 'utf8')), file);
  }
});
