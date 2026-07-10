/*
 * Patram service worker — makes "works offline once loaded" a real promise.
 *
 * Shell files (same-origin): network-first, cache fallback — updates land on
 * the next visit, offline still works. Engine assets (versioned CDN URLs and
 * the font pack): cache-first — immutable, downloaded once. Only cors/basic
 * responses are stored (opaque responses are quota-padded and unusable under
 * a future cross-origin-isolated deployment).
 */
const VERSION = "patram-sw-v1";
const CORE = [
  "./", "./index.html", "./styles.css", "./app.js",
  "./worker.js", "./qpdf-worker.js", "./pdf_tools.py", "./fonts/manifest.json",
];
const ENGINE_HOSTS = new Set([
  "cdn.jsdelivr.net",          // pyodide, pdf.js, tesseract.js, jszip, qpdf
  "files.pythonhosted.org",    // wheels fetched by micropip
  "pypi.org",                  // micropip metadata (cached → offline installs)
  "fonts.googleapis.com", "fonts.gstatic.com",
]);

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await Promise.allSettled(CORE.map((u) => cache.add(u)));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !ENGINE_HOSTS.has(url.hostname)) return;

  const isEngineAsset = !sameOrigin || url.pathname.includes("/fonts/");
  e.respondWith(isEngineAsset ? cacheFirst(req) : networkFirst(req));
});

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok && res.type !== "opaque") {
    (await caches.open(VERSION)).put(req, res.clone());
  }
  return res;
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok) (await caches.open(VERSION)).put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await caches.match(req);
    if (hit) return hit;
    if (req.mode === "navigate") {
      const shell = await caches.match("./index.html");
      if (shell) return shell;
    }
    throw err;
  }
}
