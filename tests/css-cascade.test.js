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
