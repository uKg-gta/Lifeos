'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const timerModule=require('../focus-timer');

test('creates a focus timer controller with the expected public operations',()=>{
  const controller=timerModule.create({$:()=>({value:''}),getState:()=>({timer:{mode:'countdown',duration:1500,remaining:1500,running:false,paused:false,startedAt:null},sessions:[]}),formatClock:()=>'',save(){},newRecordId:()=>1,dayKey:()=> '2026-11-20',render(){},toast(){},formatMinutes:()=>''});
  for(const method of ['timerSeconds','timerRender','timerTick','ensureTick','timerStart','logFocusSession','timerComplete','timerPause','timerReset','timerFinish'])assert.equal(typeof controller[method],'function');
});
test('logs a focus session against the current selected subject and date',()=>{
  const state={timer:{},sessions:[]};
  const values={'#timerSubject':{value:'Polity'},'#timerTopic':{value:'Parliament'},'#examSelect':{value:'UPSC'}};
  const controller=timerModule.create({$:selector=>values[selector],getState:()=>state,formatClock:()=>'',save(){},newRecordId:()=>42,dayKey:()=> '2026-11-20',render(){},toast(){},formatMinutes:()=>''});
  assert.equal(controller.logFocusSession(3600),60);
  assert.deepEqual(state.sessions,[{id:42,subject:'Polity',topic:'Parliament',date:'2026-11-20',minutes:60,type:'Study',exam:'UPSC'}]);
});
