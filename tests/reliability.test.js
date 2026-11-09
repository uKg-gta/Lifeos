'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../sync-core');

test('record IDs are numeric safe integers compatible with existing UI lookups',()=>{
  const id=core.createRecordId(1794200000000,()=>0.314159);
  assert.equal(Number.isSafeInteger(id),true);
  assert.equal(id>=0,true);
  assert.equal(typeof id,'number');
});

test('record IDs vary for distinct entropy within the same second',()=>{
  const a=core.createRecordId(1794200000000,()=>0.1);
  const b=core.createRecordId(1794200000000,()=>0.9);
  assert.notEqual(a,b);
});

test('RPC save result parses PostgREST table responses',()=>{
  assert.deepEqual(core.parseSaveResult([{saved:true,new_revision:'8'}]),{saved:true,newRevision:8});
  assert.deepEqual(core.parseSaveResult({saved:false,new_revision:null}),{saved:false,newRevision:null});
});

test('RPC save result rejects malformed or unsafe revisions',()=>{
  assert.throws(()=>core.parseSaveResult([]),/Unexpected workspace save response/);
  assert.throws(()=>core.parseSaveResult({saved:true,new_revision:'not-a-number'}),/invalid revision/);
  assert.throws(()=>core.parseSaveResult({saved:true,new_revision:'9007199254740992'}),/invalid revision/);
});

test('revision mismatch is treated as a conflict, never an automatic merge',()=>{
  assert.equal(core.hasRevisionConflict(4,5),true);
  assert.equal(core.hasRevisionConflict('5',5),false);
});

test('legacy-write migration increments revision only when caller did not',()=>{
  const fs=require('node:fs');
  const sql=fs.readFileSync(require('node:path').join(__dirname,'../supabase/migrations/20261109090000_bump_workspace_revision_for_legacy_writes.sql'),'utf8');
  assert.match(sql,/BEFORE UPDATE ON public\.lifeos_workspace/i);
  assert.match(sql,/NEW\.revision IS NOT DISTINCT FROM OLD\.revision/i);
  assert.match(sql,/NEW\.revision := OLD\.revision \+ 1/i);
});
