'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const worker=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');

test('offline app shell precaches the complete application JavaScript',()=>{
  assert.match(worker,/const CACHE_NAME = 'lifeos-shell-v5'/);
  for(const file of ['app.js','sync-core.js','study-utils.js','date-utils.js','format-utils.js','profile-ui.js','focus-timer.js','modal-ui.js','search-ui.js','study-page.js','task-page.js','habit-page.js','notes-page.js','calendar-page.js','library-page.js','projects-page.js','finance-page.js','backup-ui.js']) {
    assert.match(worker,new RegExp(`['"]\\./${file}['"]`),file+' must be available offline');
  }
});

test('service worker removes prior LifeOS shell caches on activation',()=>{
  assert.match(worker,/key\.startsWith\('lifeos-shell-'\) && key !== CACHE_NAME/);
  assert.match(worker,/caches\.delete\(key\)/);
});
