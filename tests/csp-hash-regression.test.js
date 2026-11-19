'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

test('strict CSP hash matches the inline application script', () => {
  const scripts = [...html.matchAll(/<script>([\\s\\S]*?)<\\/script>/g)];
  assert.equal(scripts.length, 1, 'expected exactly one inline application script');
  const actual = crypto.createHash('sha256').update(scripts[0][1], 'utf8').digest('base64');
  const declared = html.match(/script-src[^>]*'sha256-([^']+)'/);
  assert.ok(declared, 'strict CSP should declare an inline script hash');
  assert.equal(declared[1], actual, `CSP hash must match the inline script; expected sha256-${actual}`);
});
