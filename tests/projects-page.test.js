'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const projectsModule=require('../projects-page');

test('creates projects and goals page controller',()=>{
  const controller=projectsModule.create({$:()=>({}),queryAll:()=>[],getState:()=>({projects:[],goals:[]}),safe:String,save(){},render(){},toast(){},modal(){},inPageConfirm(){},bindModalClose(){},showModal(){},closeModal(){}});
  for(const method of ['renderProjectCards','projectsPage','openGoal'])assert.equal(typeof controller[method],'function');
});
