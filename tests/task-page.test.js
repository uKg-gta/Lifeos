'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const taskPageModule=require('../task-page');

test('renders task titles safely and exposes edit and delete controls',()=>{
  const controller=taskPageModule.create({$:()=>({}),getState:()=>({tasks:[]}),getTaskView:()=>'all',safe:value=>String(value).replace(/</g,'&lt;'),wire(){}});
  const html=controller.taskRow({id:7,title:'<Task>',priority:'High',category:'Study',status:'todo'},true);
  assert.match(html,/&lt;Task&gt;/);
  assert.match(html,/data-edit-task="7"/);
  assert.match(html,/data-delete-task="7"/);
});
test('creates task page renderer',()=>{
  const controller=taskPageModule.create({$:()=>({value:'',innerHTML:''}),getState:()=>({tasks:[]}),getTaskView:()=>'all',safe:String,wire(){}});
  assert.equal(typeof controller.tasksPage,'function');
});
