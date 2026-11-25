// IronPulse service worker: app-shell caching + offline fallback.
// API calls and auth are never cached (always live data).
const VERSION = 'ip-v1'
const STATIC = `${VERSION}-static`
const PAGES = `${VERSION}-pages`
const PRECACHE = ['/offline.html', '/manifest.json', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  // Hashed build assets never change: cache-first.
  if (url.pathname.startsWith('/_next/static/') || PRECACHE.includes(url.pathname)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(STATIC).then((c) => c.put(req, copy)) }
        return res
      }))
    )
    return
  }

  // Pages: network-first, fall back to the last copy, then the offline page.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(PAGES).then((c) => c.put(req, copy)) }
        return res
      }).catch(() => caches.match(req).then((hit) => hit || caches.match('/offline.html')))
    )
  }
})
