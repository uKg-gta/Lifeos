'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const entryModal=require('../entry-modal');

function setup(){
  const state={tasks:[],notes:[],transactions:[],sessions:[],habits:[],resources:[],assets:[],investments:[],liabilities:[],budgets:[],routines:[],subjects:[],syllabus:[],goals:[],projects:[]};
  const elements=new Map();
  const $=selector=>{
    if(!elements.has(selector))elements.set(selector,{value:'',textContent:'',innerHTML:'',onclick:null,onchange:null,checked:false,style:{},focus(){}});
    return elements.get(selector);
  };
  let saved=0,rendered=0,closed=0;
  const controller=entryModal.create({
    $,queryAll:()=>[],getState:()=>state,safe:value=>String(value??''),
    dayKey:()=> '2026-11-20',addDays:(n,date=new Date('2026-11-20T12:00:00'))=>{const d=new Date(date);d.setDate(d.getDate()+n);return d},
    dayRe:/^\d{4}-\d{2}-\d{2}$/,toast(){},newRecordId:()=>100,
    transactionDate:item=>item.date,subjectOptions:()=>'<option>Polity</option>',habitHistory:()=>[],
    showModal(){},closeModal(){closed++},save(){saved++},render(){rendered++},bindModalClose(){}
  });
  return {state,elements,$,controller,getCounts:()=>({saved,rendered,closed})};
}

test('creates a task form and saves a new task through the shared modal flow',()=>{
  const {state,$,controller,getCounts}=setup();
  controller.modal('task');
  assert.equal($('#modalTitle').textContent,'New task');
  assert.match($('#modalBody').innerHTML,/id="fTitle"/);
  $('#fTitle').value='Revise polity';
  $('#fDate').value='today';
  $('#fPriority').value='High';
  $('#fCategory').value='Study';
  $('#fEstimate').value='25';
  $('#modalSave').onclick();
  assert.equal(state.tasks.length,1);
  assert.deepEqual(state.tasks[0],{id:100,title:'Revise polity',date:'today',due:'2026-11-20',priority:'High',category:'Study',estimate:25,status:'todo'});
  assert.deepEqual(getCounts(),{saved:1,rendered:1,closed:1});
});

test('edits an existing task without creating a duplicate record',()=>{
  const {state,$,controller}=setup();
  const task={id:7,title:'Old title',date:'today',due:'2026-11-20',priority:'Medium',category:'Study',estimate:0,status:'todo'};
  state.tasks.push(task);
  controller.modal('task',task);
  $('#fTitle').value='Updated title';
  $('#fDate').value='today';
  $('#fPriority').value='Low';
  $('#fCategory').value='Personal';
  $('#fEstimate').value='10';
  $('#modalSave').onclick();
  assert.equal(state.tasks.length,1);
  assert.equal(state.tasks[0].id,7);
  assert.equal(state.tasks[0].title,'Updated title');
  assert.equal(state.tasks[0].priority,'Low');
});
