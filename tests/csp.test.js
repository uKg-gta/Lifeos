'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');

test('application logic is loaded from a same-origin external script after its dependencies', () => {
  const supabase = html.indexOf('<script src="./vendor/supabase.js"');
  const syncCore = html.indexOf('<script src="./sync-core.js"');
  const appScript = html.indexOf('<script src="./app.js"');
  assert.ok(supabase >= 0 && syncCore > supabase && appScript > syncCore);
  assert.doesNotMatch(html, /<script>/, 'index.html should not contain inline scripts');
  assert.ok(app.includes('function render()') || app.includes('function applyPrefs()'), 'application logic should be present in app.js');
});

test('CSP permits same-origin scripts without enabling inline JavaScript', () => {
  const policy = html.match(/script-src([^;]*)/);
  assert.ok(policy, 'script-src directive should exist');
  assert.match(policy[1], /'self'/);
  assert.doesNotMatch(policy[1], /unsafe-inline|sha256-/);
});
