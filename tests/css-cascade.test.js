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
  const button=html.match(/#quickAdd\.primary\s*\{([^}]*)\}/);
  const hover=html.match(/#quickAdd\.primary:hover\s*\{([^}]*)\}/);
  assert.ok(button,'quick add button rule should exist');
  assert.ok(hover,'quick add hover rule should exist');
  assert.match(button[1],/background:\s*var\(--accent\);/);
  assert.match(button[1],/border:\s*1px solid var\(--accent\);/);
  assert.match(button[1],/color:\s*#ffffff;/);
  assert.match(button[1],/box-shadow:\s*0 4px 16px var\(--accent-glow\);/);
  assert.match(hover[1],/box-shadow:\s*0 6px 22px var\(--accent-glow\);/);
  assert.doesNotMatch(button[1]+hover[1],/!important/i);
});

test('habit icon theme styles rely on selector specificity, not important flags',()=>{
  const base=html.indexOf('.habiticon {');
  const vibrant=html.indexOf('.habiticon {',base+1);
  const light=html.indexOf('[data-theme="light"] .habiticon {');
  assert.ok(base>=0 && vibrant>base && light>vibrant,'base, vibrant, and light-theme rules should remain in cascade order');
  const vibrantRule=html.slice(vibrant,html.indexOf('}',vibrant)+1);
  const lightRule=html.slice(light,html.indexOf('}',light)+1);
  assert.match(vibrantRule,/background:\s*linear-gradient/);
  assert.match(vibrantRule,/color:\s*#34d399;/);
  assert.match(lightRule,/color:\s*#047857;/);
  assert.match(lightRule,/background:\s*rgba\(4, 120, 87, 0\.08\);/);
  assert.doesNotMatch(vibrantRule+lightRule,/!important/i);
});

test('productivity score card theme overrides use the normal cascade',()=>{
  const dark=html.match(/\/\* Vibrant gradients on card accents \*\/\s*\.score\s*\{([^}]*)\}/);
  const darkGlow=html.match(/\.score::after\s*\{([^}]*)\}\s*\[data-theme="light"\] \.score/);
  const light=html.match(/\[data-theme="light"\] \.score\s*\{([^}]*)\}/);
  const lightGlow=html.match(/\[data-theme="light"\] \.score::after\s*\{([^}]*)\}/);
  assert.ok(dark && darkGlow && light && lightGlow,'dark and light score card rules should exist');
  assert.match(dark[1],/background:\s*linear-gradient/);
  assert.match(dark[1],/border:\s*1px solid/);
  assert.match(light[1],/background:\s*linear-gradient/);
  assert.match(light[1],/border-color:\s*var\(--line\)/);
  assert.match(darkGlow[1],/opacity:\s*0\.7;/);
  assert.match(lightGlow[1],/opacity:\s*0\.7;/);
  assert.doesNotMatch(dark[1]+darkGlow[1]+light[1]+lightGlow[1],/!important/i);
});
