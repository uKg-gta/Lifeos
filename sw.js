'use strict';

// LifeOS is online-only. This worker only retires old offline workspace caches;
// it does not cache application pages, scripts, or user data.
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('lifeos-shell-')).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
