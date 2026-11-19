'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const habit=fs.readFileSync(path.join(__dirname,'../habit-page.js'),'utf8');
const projects=fs.readFileSync(path.join(__dirname,'../projects-page.js'),'utf8');
test('static application template styles are represented by CSS classes',()=>{
  assert.doesNotMatch(app,/style="font-size:13\.5px/);
  assert.doesNotMatch(app,/style="font-size:12px;font-weight:600/);
  assert.doesNotMatch(app,/style="padding:13px 3px 4px/);
  assert.doesNotMatch(app,/style="margin:0(?: 0 7px)?"/);
  assert.doesNotMatch(app,/style="cursor:pointer"/);
  assert.doesNotMatch(app,/style="text-align:right"/);
  assert.doesNotMatch(app,/style="width:100%;text-align:left;background:transparent;border:0"/);
  for(const cls of ['modal-confirm-copy','prompt-label','task-group-heading','is-editable-row','budget-row','goal-actions','global-result-row']){
    assert.match(html,new RegExp('\\.'+cls+'\\s*\\{'),cls+' CSS should exist');
  }
});
test('runtime-generated values retain their dynamic inline styles',()=>{
  assert.ok(habit.includes("style=\"background:'+style[0]+'!important;border-color:'+style[1]+'!important\""));
  assert.ok(projects.includes("style=\"width:'+percent+'%\""));
  assert.match(app,/style="display:\$\{dsel===/);
});
