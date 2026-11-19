'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const studyPage = fs.readFileSync(path.join(__dirname, '../study-page.js'), 'utf8');

test('Study page describes the weekly goal relative to the saved daily target', () => {
  assert.match(html, /<p>Weekly target: 7 × your saved daily target<\/p>/);
  assert.doesNotMatch(html, /Against a 21h weekly target/);
  assert.match(app, /studyTargetMins\(\)/, 'the daily target must remain the source of truth');
  assert.match(studyPage, /getPrefs\(\)\.studyTargetMins=total/, 'the Study target control must persist the user-selected daily target');
});
