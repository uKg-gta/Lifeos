'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const taskPageModule=require('../task-page');

test('renders task titles safely and exposes edit and delete controls',()=>{
  const controller=taskPageModule.create({$:()=>({}),getState:()=>({tasks:[]}),getTaskView:()=>'all',safe:value=>String(value).replace(/</g,'&lt;').replace(/>/g,'&gt;'),wire(){}});
  const html=controller.taskRow({id:7,title:'<Task>',priority:'High',category:'Study',status:'todo'},true);
  assert.match(html,/&lt;Task&gt;/);
  assert.match(html,/data-edit-task="7"/);
  assert.match(html,/data-delete-task="7"/);
});
test('classifies tasks into the five task sections',()=>{
  const controller=taskPageModule.create({$:()=>({}),getState:()=>({tasks:[]}),getTaskView:()=>'today',getToday:()=>'2026-11-22',safe:String,wire(){}});
  assert.equal(controller.bucket({status:'todo',due:'2026-11-22'},'2026-11-22'),'today');
  assert.equal(controller.bucket({status:'todo',due:'2026-11-21'},'2026-11-22'),'overdue');
  assert.equal(controller.bucket({status:'todo',due:'2026-11-23'},'2026-11-22'),'upcoming');
  assert.equal(controller.bucket({status:'done',due:'2026-11-22'},'2026-11-22'),'completed');
  assert.equal(controller.bucket({status:'todo',date:'none'},'2026-11-22'),'none');
});
test('renders only the selected task section',()=>{
  const elements={taskList:{innerHTML:''},taskSearch:{value:''},taskPriority:{value:'all'}};
  const controller=taskPageModule.create({$:selector=>elements[selector.slice(1)],getState:()=>({tasks:[
    {id:1,title:'Overdue item',category:'Study',priority:'High',status:'todo',due:'2026-11-21'},
    {id:2,title:'Completed item',category:'Work',priority:'Low',status:'done',due:'2026-11-22'}
  ]}),getTaskView:()=>'overdue',getToday:()=>'2026-11-22',safe:String,wire(){}});
  controller.tasksPage();
  assert.match(elements.taskList.innerHTML,/Overdue item/);
  assert.doesNotMatch(elements.taskList.innerHTML,/Completed item/);
});
