// Minimal pass-through service worker. It caches nothing and leaves every request to the
// network; its only job is the fetch handler Chrome still checks before it fires
// `beforeinstallprompt` (see docs/research-notes.md, "PWA installability").
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
