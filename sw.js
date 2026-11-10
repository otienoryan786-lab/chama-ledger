// Service worker: keeps the app working with no internet.
// It tries the network first, so updates arrive as soon as you are online, and falls back to the saved copy.
const CACHE = "chama-ledger-v4";
const ASSETS = ["./", "index.html", "app.html", "statement.html", "style.css", "design.css", "welcome.css", "statement.css", "theme.js", "engine.js", "insights.js", "governance.js", "calculators.js", "ui.js", "trust.js", "meetings.js", "design.js", "app.js", "statement.js", "welcome.js", "logo.svg", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png"];

self.addEventListener("install", (e) => {
  // Add files one by one so a single missing file cannot stop the app from installing
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(ASSETS.map((a) => c.add(a).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // fonts and other sites are not saved
  e.respondWith(
    fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("app.html")))
  );
});
