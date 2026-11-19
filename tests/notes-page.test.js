'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const notesModule=require('../notes-page');

test('creates notes page renderer',()=>{
  const controller=notesModule.create({$:()=>({value:'',innerHTML:''}),queryAll:()=>[],getState:()=>({notes:[]}),safe:String,modal(){},save(){},toast(){}});
  assert.equal(typeof controller.notesPage,'function');
});
