'use strict';

const CACHE_NAME = 'lifeos-shell-v6';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './sync-core.js',
  './study-utils.js',
  './date-utils.js',
  './format-utils.js',
  './profile-ui.js',
  './focus-timer.js',
  './modal-ui.js',
  './search-ui.js',
  './study-page.js',
  './task-page.js',
  './habit-page.js',
  './notes-page.js',
  './calendar-page.js',
  './library-page.js',
  './projects-page.js',
  './finance-page.js',
  './entry-modal.js',
  './backup-ui.js',
  './app.js',
  './vendor/supabase.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith('lifeos-shell-') && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch {
      const cached = await cache.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        return await cache.match(new URL('./index.html', self.registration.scope))
          || await cache.match(new URL('./', self.registration.scope));
      }
      return Response.error();
    }
  })());
});
