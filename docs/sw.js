/* global self, caches, fetch */
// Replaced by scripts/build-sw.mjs at build time.
const CACHE_NAME = "base-rebuild-8c36a71b93d0c2d9"
const FILES = ["./assets/index-Cp_DpPA1.css","./assets/index-DYk7VQf9.js","./icons/base-icon.svg","./icons/icon-180.png","./icons/icon-192.png","./icons/icon-512.png","./images/base-room-photo-v2.jpeg","./index.html","./manifest.webmanifest"]
const OFFLINE_INDEX = new URL('./index.html', self.registration.scope).href

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(FILES.map(path => new URL(path, self.registration.scope).href))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith('base-rebuild-') && key !== CACHE_NAME).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname)) return

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME)
          await cache.put(OFFLINE_INDEX, response.clone())
        }
        return response
      } catch {
        return (await caches.match(OFFLINE_INDEX)) || Response.error()
      }
    })())
    return
  }

  event.respondWith((async () => {
    const cached = await caches.match(request)
    if (cached) return cached
    try {
      const response = await fetch(request)
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME)
        await cache.put(request, response.clone())
      }
      return response
    } catch {
      return Response.error()
    }
  })())
})
