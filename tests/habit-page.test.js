'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const habitModule=require('../habit-page');

test('calculates scheduled days and check-ins from history',()=>{
  const state={habits:[],routines:[]};
  const controller=habitModule.create({$:()=>({}),queryAll:()=>[],getState:()=>state,dayKey:()=> '2026-11-20',save(){},render(){},toast(){},wire(){},safe:String,modal(){},inPageConfirm(){}});
  const habit={days:[5],history:['2026-11-20']};
  assert.equal(controller.habitScheduled(habit),true);
  assert.equal(controller.habitDone(habit),true);
  assert.deepEqual(controller.habitHistory(habit),['2026-11-20']);
});
test('creates habit page controller with routine and habit operations',()=>{
  const controller=habitModule.create({$:()=>({}),queryAll:()=>[],getState:()=>({habits:[],routines:[]}),dayKey:()=> '2026-11-20',save(){},render(){},toast(){},wire(){},safe:String,modal(){},inPageConfirm(){}});
  for(const method of ['habitScheduledOn','habitScheduled','habitHistory','habitDone','habitStreak','habitStats','habitRow','habitsPage'])assert.equal(typeof controller[method],'function');
});
