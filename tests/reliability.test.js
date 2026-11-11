'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const core=require('../sync-core');

test('record IDs are numeric safe integers compatible with existing UI lookups',()=>{
  const id=core.createRecordId(()=>0.314159);
  assert.equal(Number.isSafeInteger(id),true);
  assert.equal(id>=0,true);
  assert.equal(typeof id,'number');
  assert.throws(()=>core.createRecordId(()=>1),/Invalid record ID entropy/);
});

test('record IDs vary for distinct entropy within the same second',()=>{
  const a=core.createRecordId(()=>0.1);
  const b=core.createRecordId(()=>0.9);
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

test('revision mismatch is exposed to the sync layer as a conflict signal',()=>{
  assert.equal(core.hasRevisionConflict(4,5),true);
  assert.equal(core.hasRevisionConflict('5',5),false);
});

test('offline merge keeps different entries created on separate devices',()=>{
  const base={workspace:{tasks:[{id:1,title:'Existing',_lifeosUpdatedAt:10}]},preferences:{}};
  const local={workspace:{tasks:[...base.workspace.tasks,{id:2,title:'Phone entry',_lifeosUpdatedAt:20}]},preferences:{}};
  const remote={workspace:{tasks:[...base.workspace.tasks,{id:3,title:'PC entry',_lifeosUpdatedAt:30}]},preferences:{}};
  const merged=core.mergeSnapshots(base,local,remote);
  assert.deepEqual(merged.workspace.tasks.map(task=>task.id).sort(),[1,2,3]);
});

test('offline merge keeps the later timestamp when both devices edit one entry',()=>{
  const base={workspace:{tasks:[{id:1,title:'Original',_lifeosUpdatedAt:10}]},preferences:{}};
  const local={workspace:{tasks:[{id:1,title:'Phone edit',_lifeosUpdatedAt:20}]},preferences:{}};
  const remote={workspace:{tasks:[{id:1,title:'PC edit',_lifeosUpdatedAt:30}]},preferences:{}};
  const merged=core.mergeSnapshots(base,local,remote);
  assert.equal(merged.workspace.tasks[0].title,'PC edit');
});

test('offline merge keeps a newer deletion instead of restoring an older entry',()=>{
  const base={workspace:{tasks:[{id:1,title:'Remove me',_lifeosUpdatedAt:10}]},preferences:{}};
  const local={workspace:{tasks:[],_lifeosSync:{tombstones:{tasks:{'i:1':40}}}},preferences:{}};
  const remote={workspace:{tasks:[{id:1,title:'Older edit',_lifeosUpdatedAt:30}]},preferences:{}};
  const merged=core.mergeSnapshots(base,local,remote);
  assert.deepEqual(merged.workspace.tasks,[]);
});

test('legacy-write migration increments revision only when caller did not',()=>{
  const fs=require('node:fs');
  const sql=fs.readFileSync(require('node:path').join(__dirname,'../supabase/migrations/20261109090000_bump_workspace_revision_for_legacy_writes.sql'),'utf8');
  assert.match(sql,/BEFORE UPDATE ON public\.lifeos_workspace/i);
  assert.match(sql,/NEW\.revision IS NOT DISTINCT FROM OLD\.revision/i);
  assert.match(sql,/NEW\.revision := OLD\.revision \+ 1/i);
});
