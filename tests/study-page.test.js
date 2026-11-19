'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const studyPageModule=require('../study-page');

test('creates study page controller with subject and page operations',()=>{
  const controller=studyPageModule.create({$:()=>({}),queryAll:()=>[],getState:()=>({subjects:[],syllabus:[],sessions:[],exams:[]}),getPrefs:()=>({}),safe:String,examDaysLeft:()=>'',formatMinutes:()=>'',studyWeekMins:()=>0,studyTodayMins:()=>0,studyTargetMins:()=>180,studyProgressText:()=>'',formatHoursMinutes:()=>'',save(){},render(){},toast(){},sessionDateLabel:()=>''});
  for(const method of ['subjectNames','subjectOptions','refreshSubjectControls','sessionRow','studyPage','wireSessions'])assert.equal(typeof controller[method],'function');
});
test('subject options include a selected value not yet in the saved subject list',()=>{
  const controller=studyPageModule.create({$:()=>({}),queryAll:()=>[],getState:()=>({subjects:['History'],syllabus:[],sessions:[],exams:[]}),getPrefs:()=>({}),safe:String,examDaysLeft:()=>'',formatMinutes:()=>'',studyWeekMins:()=>0,studyTodayMins:()=>0,studyTargetMins:()=>180,studyProgressText:()=>'',formatHoursMinutes:()=>'',save(){},render(){},toast(){},sessionDateLabel:()=>''});
  assert.equal(controller.subjectOptions('Polity'),'<option >History</option><option selected>Polity</option>');
});
