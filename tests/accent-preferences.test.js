'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const profile = fs.readFileSync(path.join(__dirname, '../profile-ui.js'), 'utf8');

const accents = ['gold', 'green', 'orange', 'grey', 'royal-blue', 'rose-pink', 'crimson-red', 'teal'];

test('accent preferences support all eight colours and preserve legacy saved names', () => {
  assert.ok(app.includes("['gold','green','orange','grey','royal-blue','rose-pink','crimson-red','teal']"));
  assert.match(app, /accentVersion:2/);
  assert.match(app, /p\.accentVersion===2\|\|supportedAccents\.includes\(savedAccent\)/);
  assert.match(app, /Keep an explicitly saved modern accent/);
  assert.match(app, /accentVersion:over\.accentVersion/);
  assert.match(app, /accent:'gold'/);
  assert.ok(app.includes("amber:'gold',coral:'orange',slate:'grey'"));
  assert.match(profile, /dataset\.accent=prefs\.accent\|\|'gold'/);
  assert.match(profile, /\$\('#prefAccent'\)\.value=prefs\.accent\|\|'gold'/);
});

test('legacy accent names are migrated instead of being separate CSS themes', () => {
  assert.doesNotMatch(html, /\[data-accent="(?:amber|coral|slate)"\]/);
  assert.doesNotMatch(html, /\[data-theme="light"\]\[data-accent="(?:amber|coral|slate)"\]/);
});

test('Settings exposes exactly the eight supported accent values', () => {
  const settings = html.match(/<select id="prefAccent">([\s\S]*?)<\/select>/);
  assert.ok(settings, 'accent selector should exist');
  const values = [...settings[1].matchAll(/<option value="([^"]+)"/g)].map(x => x[1]);
  assert.deepEqual(values, accents);
  assert.match(settings[1], /value="gold" selected>Antique Gold/);
  for (const label of ['Sage', 'Terracotta', 'Grey', 'Dusty Blue', 'Dusty Rose', 'Muted Crimson', 'Teal']) assert.ok(settings[1].includes('>' + label + '</option>'));
  for (const accent of accents) {
    assert.ok(html.includes('[data-accent="' + accent + '"]'), 'missing dark palette for ' + accent);
    assert.ok(html.includes('[data-theme="light"][data-accent="' + accent + '"]'), 'missing light palette for ' + accent);
  }
});
