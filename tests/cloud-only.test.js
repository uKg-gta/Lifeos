'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const backup=fs.readFileSync(path.join(root,'backup-ui.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const study=fs.readFileSync(path.join(root,'study-page.js'),'utf8');
test('workspace state is not read from or written to browser local storage',()=>{
  assert.doesNotMatch(app,/localStorage/);
  assert.doesNotMatch(backup,/localStorage/);
  assert.doesNotMatch(app,/lifeos-recovery-/);
});
test('sign-in loads the authenticated cloud workspace before setup',()=>{
  assert.match(app,/const remote=await fetchRemote\(\)/);
  assert.match(app,/window\.__lifeosCloudLoaded=true;cloudReady=true/);
  assert.match(app,/setSync\(remote\?'Loaded your cloud workspace\.'/);
});
test('offline continuation is not offered',()=>{
  assert.doesNotMatch(html,/id="continueOffline"/);
  assert.doesNotMatch(app,/continueOffline/);
});
test('service worker does not cache app files or workspace data',()=>{
  assert.doesNotMatch(worker,/caches\.open|cache\.addAll|cache\.put|respondWith/);
  assert.match(worker,/caches\.delete\(key\)/);
});
test('study page dependencies and delegated functions are wired',()=>{
  assert.match(app,/getPrefs:\(\)=>prefs/);
  assert.match(app,/function studyPage\(\)/);
  assert.match(app,/function sessionRow\(/);
  assert.match(app,/function wireSessions\(/);
  assert.match(study,/deps\.getPrefs\(\)\.studyTargetMins=total/);
});
test('entry modal receives subject-control refresh dependency',()=>{
  assert.match(app,/subjectOptions,refreshSubjectControls,habitHistory/);
  assert.match(fs.readFileSync(path.join(root,'entry-modal.js'),'utf8'),/refreshSubjectControls=\(\)=>\{\}/);
});
test('reset and image compression handlers are restored',()=>{
  assert.match(app,/function resetWorkspaceSafely\(/);
  assert.match(app,/function reset\(/);
  assert.match(app,/function resetPreferences\(/);
  assert.match(app,/function compressImage\(/);
});
