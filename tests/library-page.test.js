'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const libraryModule=require('../library-page');

test('creates library page renderer',()=>{
  const controller=libraryModule.create({$:()=>({value:'all',innerHTML:'',style:{}}),queryAll:()=>[],getState:()=>({resources:[]}),getBookView:()=>'cards',safe:String,save(){},toast(){},modal(){},inPageConfirm(){}});
  assert.equal(typeof controller.libraryPage,'function');
});
