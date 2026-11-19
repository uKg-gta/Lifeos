'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

test('mobile dashboard grid stacks without an unnecessary important override',()=>{
  assert.match(html,/@media\s*\(max-width:\s*760px\)[\s\S]*?\.dashgrid\s*\{\s*grid-template-columns:\s*1fr;\s*\}/);
  assert.doesNotMatch(html,/\.dashgrid\s*\{[^}]*grid-template-columns:\s*1fr\s*!important/i);
});

test('habit weekday grid keeps its responsive layout without an important flag',()=>{
  assert.match(html,/\.daychoices\s*\{[^}]*display:\s*grid;/);
  assert.match(html,/@media\s*\(max-width:\s*520px\)[\s\S]*?\.daychoices\s*\{\s*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\);/);
  assert.doesNotMatch(html,/\.daychoices\s*\{[^}]*display:\s*grid\s*!important/i);
});

test('quick add button uses its stronger ID selector instead of important overrides',()=>{
  const button=html.match(/#quickAdd\\.primary\\s*\\{([^}]*)\\}/);
  const hover=html.match(/#quickAdd\\.primary:hover\\s*\\{([^}]*)\\}/);
  assert.ok(button,'quick add button rule should exist');
  assert.ok(hover,'quick add hover rule should exist');
  assert.match(button[1],/background:\\s*var\\(--accent\\);/);
  assert.match(button[1],/border:\\s*1px solid var\\(--accent\\);/);
  assert.match(button[1],/color:\\s*#ffffff;/);
  assert.match(button[1],/box-shadow:\\s*0 4px 16px var\\(--accent-glow\\);/);
  assert.match(hover[1],/box-shadow:\\s*0 6px 22px var\\(--accent-glow\\);/);
  assert.doesNotMatch(button[1]+hover[1],/!important/i);
});
