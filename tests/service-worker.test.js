'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const worker=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');

test('offline app shell precaches the application JavaScript',()=>{
  assert.match(worker,/const CACHE_NAME = 'lifeos-shell-v4'/);
  assert.match(worker,/['"]\.\/app\.js['"]/);
  assert.match(worker,/['"]\.\/sync-core\.js['"]/);
});

test('service worker removes prior LifeOS shell caches on activation',()=>{
  assert.match(worker,/key\.startsWith\('lifeos-shell-'\) && key !== CACHE_NAME/);
  assert.match(worker,/caches\.delete\(key\)/);
});
