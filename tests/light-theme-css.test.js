'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/i) || [])[1] || '';

function rulesFor(selector) {
  const rules = [];
  let from = 0;
  while (true) {
    const start = css.indexOf(selector, from);
    if (start < 0) break;
    const open = css.indexOf('{', start + selector.length);
    const close = open < 0 ? -1 : css.indexOf('}', open + 1);
    if (open >= 0 && close >= 0) rules.push(css.slice(open + 1, close));
    from = start + selector.length;
  }
  return rules;
}

test('light theme base and accent overrides each have one consolidated CSS rule', () => {
  for (const selector of [
    '[data-theme="light"]',
    '[data-theme="light"][data-accent="amber"]',
    '[data-theme="light"][data-accent="green"]',
    '[data-theme="light"][data-accent="coral"]',
    '[data-theme="light"][data-accent="slate"]'
  ]) {
    assert.equal(rulesFor(selector).length, 1, selector + ' should be defined once');
  }
});

test('consolidated light theme keeps the final contrast values', () => {
  const light = rulesFor('[data-theme="light"]')[0];
  assert.match(light, /--panel2:\s*#eef2f7/);
  assert.match(light, /--muted:\s*#475569/);
  assert.match(light, /--mint:\s*#047857/);

  const amber = rulesFor('[data-theme="light"][data-accent="amber"]')[0];
  const green = rulesFor('[data-theme="light"][data-accent="green"]')[0];
  const coral = rulesFor('[data-theme="light"][data-accent="coral"]')[0];
  const slate = rulesFor('[data-theme="light"][data-accent="slate"]')[0];
  assert.match(amber, /--accent:\s*#b45309/);
  assert.match(green, /--accent:\s*#047857/);
  assert.match(coral, /--accent:\s*#9a3412/);
  assert.match(slate, /--accent:\s*#334155/);
});
