'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const profileModule=require('../profile-ui');

test('creates a profile UI controller with stable public operations',()=>{
  const controller=profileModule.create({$:()=>({}),$$:()=>[],getPrefs:()=>({name:'',theme:'dark'}),save(){},toast(){},safe:String,safePic:value=>value,updateDateLabels(){},nav(){}});
  for(const method of ['saveProfile','applyPrefs','applyModuleVisibility','applySummaries','toggleTheme','toggleSidebar','getLifeOSGreeting','updateLifeOSGreeting'])assert.equal(typeof controller[method],'function');
});
