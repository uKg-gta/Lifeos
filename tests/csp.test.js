'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

test('Content Security Policy hash matches the exact inline application script', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const inlineScripts = [...html.matchAll(/<script>([\s\\S]*?)<\/script>/g)];
  assert.equal(inlineScripts.length, 1, 'expected one hash-protected inline application script');

  const policy = html.match(/script-src[^;]*'sha256-([^']+)'/);
  assert.ok(policy, 'expected a SHA-256 script hash in the Content Security Policy');

  const actual = crypto.createHash('sha256').update(inlineScripts[0][1], 'utf8').digest('base64');
  assert.equal(policy[1], actual, 'CSP hash must be regenerated whenever inline application code changes');
});
