'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const searchModule=require('../search-ui');

test('creates the global search controller without touching the document',()=>{
  const controller=searchModule.create({$:()=>({}),queryAll:()=>[],getState:()=>({tasks:[],notes:[],syllabus:[],resources:[]}),safe:String,nav(){},closeSearchModal(){},setSearchReturnFocus(){}});
  assert.equal(typeof controller.search,'function');
});
