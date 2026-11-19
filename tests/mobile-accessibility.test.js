'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

test('mobile navigation uses consistent SVG icons rather than platform glyphs', () => {
  const start = html.indexOf('<nav class="bottomnav"');
  const end = html.indexOf('</nav>', start);
  assert.notEqual(start, -1, 'mobile navigation should exist');
  assert.notEqual(end, -1, 'mobile navigation should close');
  const nav = html.slice(start, end);
  assert.equal((nav.match(/<svg\b/g) || []).length, 13, 'all mobile navigation entries, including More, should use SVG icons');
  assert.doesNotMatch(nav, /[⌂☷▤◷•••]/, 'platform-dependent text glyphs should not be used as mobile navigation icons');
  assert.match(nav, /data-page="habits"[\s\S]*data-page="profile"/, 'More menu should retain Habits and Profile entries');
});

test('mobile interactive controls have a 44px minimum touch target', () => {
  assert.match(html, /@media\(max-width:760px\)\{\s*button,input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\):not\(\[type="file"\]\),select,textarea\{min-height:44px\}/);
  assert.match(html, /\.collapse\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s);
  assert.match(html, /\.linkbtn,\.textbtn\{min-width:44px/);
});

test('mobile text overrides the small desktop labels to at least 12px', () => {
  assert.match(html, /\.tiny,\.small,\.brand small,\.profile small,\.habitlabel small,\.metric small,\.metric p,\.eyebrow,\.tag,\.pill,\.rowsub\{font-size:12px\}/);
  assert.match(html, /\.status,\.taskmeta,\.lifeos-auth-gate \.auth-brand-kicker,\.lifeos-auth-gate \.auth-eyebrow,\.lifeos-auth-gate \.auth-form-eyebrow,\.lifeos-auth-gate \.auth-divider small\{font-size:12px\}/);
});

test('Focus form labels are explicitly associated with their controls', () => {
  assert.match(html, /<label for="timerSubject">Subject \(optional\)<\/label><select id="timerSubject"/);
  assert.match(html, /<label for="timerTopic">Topic \(optional\)<\/label><input id="timerTopic"/);
});

test('built-in avatar choices have descriptive accessible names', () => {
  const choices = [...html.matchAll(/<button[^>]*data-profile-avatar="([^"]+)"[^>]*>/g)];
  assert.equal(choices.length, 5);
  for (const [avatarButton] of choices) {
    assert.match(avatarButton, /aria-label="Use (?:initials|circle|star|leaf|sun) avatar"/);
  }
});
