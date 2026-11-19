'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

test('accent preferences are normalized to the four colours offered in Settings', () => {
  assert.match(html, /accent:pick\(p\.accent,\['amber','green','coral','slate'\],p\.accent==='blue'\?'amber':p\.accent==='violet'\?'green':d\.accent\)/);
  assert.match(html, /dataset\.accent=prefs\.accent\|\|'amber'/);
  assert.match(html, /\$\('#prefAccent'\)\.value=prefs\.accent\|\|'amber'/);
});

test('legacy accent names are migrated instead of being separate CSS themes', () => {
  assert.doesNotMatch(html, /\[data-accent="(?:blue|violet)"\]/);
  assert.doesNotMatch(html, /\[data-theme="light"\]\[data-accent="(?:blue|violet)"\]/);
});

test('Settings exposes only supported accent values', () => {
  const settings = html.match(/<select id="prefAccent">([\s\S]*?)<\/select>/);
  assert.ok(settings, 'accent selector should exist');
  const values = [...settings[1].matchAll(/<option value="([^"]+)"/g)].map(x => x[1]);
  assert.deepEqual(values, ['amber', 'green', 'coral', 'slate']);
});
