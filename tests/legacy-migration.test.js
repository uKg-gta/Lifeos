'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const migration=require('../legacy-migration');
class MemoryStorage{
 constructor(entries={}){this.values=new Map(Object.entries(entries))}
 get length(){return this.values.size}
 key(index){return [...this.values.keys()][index]??null}
 getItem(key){return this.values.has(key)?this.values.get(key):null}
 setItem(key,value){this.values.set(key,String(value))}
 removeItem(key){this.values.delete(key)}
}
const workspace={tasks:[{id:1,title:'Legacy task'}],habits:[]};
test('legacy migration exposes only entries belonging to the authenticated account',()=>{
 const storage=new MemoryStorage({
  'lifeos-sync-meta':JSON.stringify({user:'user-a'}),
  'lifeos-review-v2':JSON.stringify(workspace),
  'lifeos-review-prefs':JSON.stringify({theme:'light'}),
  'lifeos-recovery-user-b-1':JSON.stringify({sourceUserId:'user-b',workspace:JSON.stringify(workspace)})
 });
 const found=migration.create(storage).read('user-a');
 assert.equal(found.length,1);
 assert.equal(found[0].source,'active');
 assert.equal(found[0].workspace.tasks[0].title,'Legacy task');
});
test('verified migration cleanup removes only the migrated account copies',()=>{
 const archiveKey='lifeos-recovery-user-a-1';
 const storage=new MemoryStorage({
  'lifeos-sync-meta':JSON.stringify({user:'user-a'}),
  'lifeos-review-v2':JSON.stringify(workspace),
  'lifeos-review-prefs':'{}',
  'lifeos-cloud-base':'{}',
  [archiveKey]:JSON.stringify({sourceUserId:'user-a',workspace:JSON.stringify(workspace)}),
  'lifeos-recovery-user-b-1':JSON.stringify({sourceUserId:'user-b',workspace:JSON.stringify(workspace)})
 });
 migration.create(storage).clear('user-a',['active',archiveKey]);
 assert.equal(storage.getItem('lifeos-review-v2'),null);
 assert.equal(storage.getItem('lifeos-sync-meta'),null);
 assert.equal(storage.getItem(archiveKey),null);
 assert.notEqual(storage.getItem('lifeos-recovery-user-b-1'),null);
});
