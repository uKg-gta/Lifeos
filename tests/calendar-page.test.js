'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const calendarModule=require('../calendar-page');

test('creates calendar page renderer',()=>{
  const controller=calendarModule.create({$:()=>({}),getState:()=>({tasks:[]}),dateLabel:()=>'',addDays:()=>new Date(),dayKey:()=>'',safe:String,getWeekOffset:()=>0});
  assert.equal(typeof controller.calendarPage,'function');
});
