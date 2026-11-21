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

self.addEventListener('push',event=>{
  let payload={title:'LifeOS',body:'You have a reminder.',url:'./'};
  try{if(event.data)payload={...payload,...event.data.json()}}catch(error){if(event.data)payload.body=event.data.text()}
  event.waitUntil(self.registration.showNotification(payload.title,{
    body:payload.body,icon:'./icons/icon-192.png',badge:'./icons/icon-192.png',
    tag:payload.category||'lifeos-reminder',data:{url:payload.url||'./'}
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||'./',self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{
    for(const client of clients){if(new URL(client.url).origin===self.location.origin){client.navigate(target);return client.focus()}}
    return self.clients.openWindow(target);
  }));
});
