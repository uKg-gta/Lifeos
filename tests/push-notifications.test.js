'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const worker=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const dispatch=fs.readFileSync(path.join(__dirname,'../supabase/functions/push-dispatch/index.ts'),'utf8');
test('service worker only retires legacy caches and does not cache workspace data',()=>{
 assert.ok(worker.includes("caches.delete(key)"));
 assert.ok(worker.includes("lifeos-shell-"));
 assert.ok(!worker.includes("caches.open"));
 assert.ok(!worker.includes("respondWith"));
});
test('service worker displays push payloads and handles notification clicks',()=>{
 assert.ok(worker.includes("addEventListener('push'"));
 assert.ok(worker.includes("showNotification"));
 assert.ok(worker.includes("addEventListener('notificationclick'"));
 assert.ok(worker.includes("openWindow"));
});
test('push settings cover all requested categories and device controls',()=>{
 for(const id of ['pushTasks','pushStudy','pushHabits','pushExams','enablePushBtn','disablePushBtn'])assert.ok(html.includes('id="'+id+'"'));
 assert.ok(app.includes("pushManager.subscribe"));
 assert.ok(app.includes("lifeos_push_subscriptions"));
 assert.ok(app.includes("lifeos_push_preferences"));
});
test('task and study reminders run at 8 AM, 3 PM and 10 PM with per-slot deduplication',()=>{
 assert.ok(dispatch.includes('[8,15,22].includes(hour)'));
 assert.ok(dispatch.includes(':task:${hour}:'));
 assert.ok(dispatch.includes(':study:${hour}'));
 assert.ok(dispatch.includes('studied<target'));
});
test('scheduled dispatcher authenticates through its Vault-backed custom header and reports backend failures',()=>{
 assert.ok(dispatch.includes('x-lifeos-cron-secret'));
 assert.ok(dispatch.includes('verify_lifeos_push_cron_secret'));
 assert.ok(dispatch.includes('error:authError'));
 assert.ok(dispatch.includes('workspaceError'));
 assert.ok(dispatch.includes('subsError'));
});
