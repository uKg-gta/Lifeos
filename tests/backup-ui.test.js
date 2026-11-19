'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
global.window={};
const backupModule=require('../backup-ui');

test('creates a backup controller with export, preview and restore operations',()=>{
 const controller=backupModule.create({getState:()=>({tasks:[],habits:[]}),getPrefs:()=>({}),setPrefs(){},normalizeWorkspace:x=>x,mergeWorkspace:(a)=>a,mergePrefs:(a)=>a,safe:String,toast(){},confirm(){},save(){},applyPrefs(){},render(){},nav(){},pushCloud:async()=>true,storage:{setItem(){}}});
 for(const method of ['exportData','backupPreview','restoreBackup','validBackup','backupArrays'])assert.equal(typeof controller[method],'function');
});

test('validates the required workspace arrays and optional categories',()=>{
 const controller=backupModule.create({getState:()=>({}),getPrefs:()=>({}),setPrefs(){},normalizeWorkspace:x=>x,mergeWorkspace:(a)=>a,mergePrefs:(a)=>a,safe:String,toast(){},confirm(){},save(){},applyPrefs(){},render(){},nav(){},pushCloud:async()=>true,storage:{setItem(){}}});
 assert.equal(controller.validBackup({tasks:[],habits:[]}),true);
 assert.equal(controller.validBackup({workspace:{tasks:[],habits:[],transactions:[]}}),true);
 assert.equal(controller.validBackup({tasks:[],habits:[],transactions:{}}),false);
 assert.equal(controller.validBackup({tasks:[]}),false);
 assert.equal(controller.validBackup(null),false);
});

test('lists only supported backup data categories',()=>{
 const controller=backupModule.create({getState:()=>({}),getPrefs:()=>({}),setPrefs(){},normalizeWorkspace:x=>x,mergeWorkspace:(a)=>a,mergePrefs:(a)=>a,safe:String,toast(){},confirm(){},save(){},applyPrefs(){},render(){},nav(){},pushCloud:async()=>true,storage:{setItem(){}}});
 assert.deepEqual(controller.backupArrays({tasks:[],habits:[],transactions:[],unknown:[]}),['tasks','habits','transactions']);
});
