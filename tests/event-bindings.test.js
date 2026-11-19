'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
test('application event handlers use the replacement-safe event binding helper',()=>{
  assert.match(app,/const eventBindings=new WeakMap\(\)/);
  assert.match(app,/target\.removeEventListener\(type,previous\)/);
  assert.match(app,/target\.addEventListener\(type,handler\)/);
  assert.doesNotMatch(app,/\.(?:onclick|onchange|oninput|onkeydown|onerror|onload)\s*=/);
});
test('modal close controls each receive their own click handler',()=>{
  assert.match(app,/bindEvent\(\$\('#modalClose'\),'click',closeModal\);bindEvent\(\$\('#modalCancel'\),'click',closeModal\)/);
});
