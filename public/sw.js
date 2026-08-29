// Conquête — minimal service worker, present only so the app satisfies PWA
// installability criteria. It intentionally caches nothing: this is a live
// multiplayer GPS game, so serving stale data offline would be worse than no
// offline support at all. Every request just goes straight to the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
