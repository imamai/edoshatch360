/* EDOS Hatch360 service worker.
 *
 * Deliberately conservative. The app's real offline capability is the
 * IndexedDB record queue, not a cache of stale pages — so this worker:
 *   - never caches an authenticated HTML response (that would risk showing
 *     one user's farm to the next person on a shared phone),
 *   - serves a clear offline page when a navigation cannot be fulfilled,
 *   - caches only immutable build assets and the app's own static files.
 */

const VERSION = "hatch360-v1";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline.html";

const PRECACHE = [OFFLINE_URL, "/icons/icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept Supabase auth or API traffic.
  if (url.pathname.startsWith("/auth/")) return;

  // Navigations: network first, offline page as the fallback. No caching of
  // the HTML itself — farm data must never be served from a stale cache.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((r) => r ?? Response.error()),
      ),
    );
    return;
  }

  // Build output is content-hashed and immutable: cache first is safe and
  // makes a repeat visit on a slow connection dramatically faster.
  const isImmutable =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/images/");

  if (isImmutable) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
