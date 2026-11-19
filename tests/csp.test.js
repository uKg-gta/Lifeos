'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

test('Content Security Policy hash matches the exact inline application script', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const startTag = '<script>';
  const endTag = '</script>';
  const scriptStart = html.indexOf(startTag);
  assert.notEqual(scriptStart, -1, 'expected the inline application script');
  const contentStart = scriptStart + startTag.length;
  const scriptEnd = html.indexOf(endTag, contentStart);
  assert.notEqual(scriptEnd, -1, 'expected the inline application script to close');
  assert.equal(html.indexOf(startTag, contentStart), -1, 'expected exactly one inline application script');

  const inlineScript = html.slice(contentStart, scriptEnd);
  const policy = html.match(/script-src[^;]*'sha256-([^']+)'/);
  assert.ok(policy, 'expected a SHA-256 script hash in the Content Security Policy');

  const actual = crypto.createHash('sha256').update(inlineScript, 'utf8').digest('base64');
  assert.equal(policy[1], actual, 'CSP hash must be regenerated whenever inline application code changes');
});
