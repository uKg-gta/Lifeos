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
    const after = css.slice(start + selector.length);
    const opening = after.match(/^\s*\{/);
    if (opening) {
      const open = start + selector.length + opening[0].length - 1;
      const close = css.indexOf('}', open + 1);
      if (close >= 0) rules.push(css.slice(open + 1, close));
    }
    from = start + selector.length;
  }
  return rules;
}

test('light theme base and accent overrides each have one consolidated CSS rule', () => {
  for (const selector of [
    '[data-theme="light"]',
    '[data-theme="light"][data-accent="gold"]',
    '[data-theme="light"][data-accent="green"]',
    '[data-theme="light"][data-accent="orange"]',
    '[data-theme="light"][data-accent="grey"]',
    '[data-theme="light"][data-accent="royal-blue"]',
    '[data-theme="light"][data-accent="rose-pink"]',
    '[data-theme="light"][data-accent="crimson-red"]',
    '[data-theme="light"][data-accent="teal"]'
  ]) {
    assert.equal(rulesFor(selector).length, 1, selector + ' should be defined once');
  }
});

test('consolidated light theme keeps the final contrast values', () => {
  const light = rulesFor('[data-theme="light"]')[0];
  assert.match(light, /--panel2:\s*#eef2f7/);
  assert.match(light, /--muted:\s*#475569/);
  assert.match(light, /--mint:\s*#047857/);

  const gold = rulesFor('[data-theme="light"][data-accent="gold"]')[0];
  const green = rulesFor('[data-theme="light"][data-accent="green"]')[0];
  const orange = rulesFor('[data-theme="light"][data-accent="orange"]')[0];
  const grey = rulesFor('[data-theme="light"][data-accent="grey"]')[0];
  const royalBlue = rulesFor('[data-theme="light"][data-accent="royal-blue"]')[0];
  const rosePink = rulesFor('[data-theme="light"][data-accent="rose-pink"]')[0];
  const crimsonRed = rulesFor('[data-theme="light"][data-accent="crimson-red"]')[0];
  const teal = rulesFor('[data-theme="light"][data-accent="teal"]')[0];
  assert.match(gold, /--accent:\s*#8A6B35/);
  assert.match(green, /--accent:\s*#456B53/);
  assert.match(orange, /--accent:\s*#92563F/);
  assert.match(grey, /--accent:\s*#586575/);
  assert.match(royalBlue, /--accent:\s*#496483/);
  assert.match(rosePink, /--accent:\s*#87566F/);
  assert.match(crimsonRed, /--accent:\s*#87474F/);
  assert.match(teal, /--accent:\s*#286F68/);
});

test('small branding, navigation, and account labels remain readable', () => {
  const checks = [
    ['.brand small', /font-size:\s*11px/],
    ['.label', /font-size:\s*11px/],
    ['.profile small', /font-size:\s*11px/],
    ['.eyebrow', /font-size:\s*11px/],
    ['.lifeos-auth-gate .auth-brand-kicker', /font-size:\s*11px/],
    ['.lifeos-auth-gate .auth-divider small', /font-size:\s*11px/]
  ];
  for (const [selector, expected] of checks) {
    const rule = rulesFor(selector)[0] || '';
    assert.match(rule, expected, selector + ' should use an 11px minimum');
  }
});

test('navigation icon hover and active styles are consolidated without changing their final effects', () => {
  const hover = rulesFor('.nav:hover .ico');
  const active = rulesFor('.nav.active .ico');
  assert.equal(hover.length, 1, 'hover icon rule should be defined once');
  assert.equal(active.length, 1, 'active icon rule should be defined once');
  assert.match(hover[0], /transform:\s*scale\(1\.14\)/);
  assert.match(hover[0], /filter:\s*drop-shadow\(0 0 10px currentColor\)/);
  assert.match(active[0], /transform:\s*scale\(1\.08\)/);
  assert.match(active[0], /filter:\s*drop-shadow\(0 0 10px currentColor\)/);
});


test('task and row layout utilities remain defined only in their shared base rules', () => {
  assert.equal((css.match(/\.taskmain\s*,\s*\.rowmain/g) || []).length, 1);
  assert.equal((css.match(/\.taskname\s*,\s*\.rowtitle/g) || []).length, 1);
  const layout = rulesFor('.taskmain, .rowmain')[0] || '';
  const titles = rulesFor('.taskname, .rowtitle')[0] || '';
  assert.match(layout, /min-width:\s*0/);
  assert.match(titles, /overflow-wrap:\s*anywhere/);
});


test('muted accent palette and default are applied consistently', () => {
  const expected = {
    gold: '#B89A62', green: '#789681', orange: '#B17F68', grey: '#89939E',
    'royal-blue': '#7189AA', 'rose-pink': '#B1849B', 'crimson-red': '#A66F75', teal: '#57958D'
  };
  for (const [key, color] of Object.entries(expected)) {
    const rule = rulesFor('[data-accent="' + key + '"]')[0] || '';
    assert.match(rule, new RegExp('--accent:\\s*' + color));
  }
  assert.match(css, /--accent:\\s*#B89A62/);
  assert.match(html, /value="gold" selected>Antique Gold/);
});
