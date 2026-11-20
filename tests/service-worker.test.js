'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const worker=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
test('service worker does not cache application files or workspace data',()=>{
  assert.doesNotMatch(worker,/caches\.open|cache\.addAll|cache\.put|respondWith/);
  assert.match(worker,/caches\.delete\(key\)/);
  assert.match(worker,/lifeos-shell-/);
});
test('service worker retires legacy offline caches on activation',()=>{
  assert.match(worker,/self\.addEventListener\('activate'/);
  assert.match(worker,/self\.clients\.claim\(\)/);
});
