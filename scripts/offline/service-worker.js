/* global self, caches, fetch, Response, URL, crypto, CACHE_VERSION, PRECACHE_ENTRIES */

const scope = new URL(self.registration.scope);
const cachePrefix = `water-sort:${scope.pathname}:`;
const cacheName = cachePrefix + CACHE_VERSION;
const assets = new Map(PRECACHE_ENTRIES.map(({ path, sha256 }) => [
  new URL(path, scope).href, sha256,
]));
const shell = new URL("index.html", scope).href;

async function cacheAsset(cache, url, expectedHash) {
  const response = await fetch(url, { cache: "reload", credentials: "same-origin" });
  if (!response.ok || response.status !== 200) {
    await response.body?.cancel();
    throw new Error(`Offline asset unavailable: ${url}`);
  }
  const bytes = await response.clone().arrayBuffer();
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const actualHash = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (actualHash !== expectedHash) {
    await response.body?.cancel();
    throw new Error(`Offline asset version mismatch: ${url}`);
  }
  await cache.put(url, response);
}

async function install() {
  const cache = await caches.open(cacheName);
  try {
    const entries = [...assets];
    // Bound concurrent transfers; settle the complete batch before cleanup.
    for (let index = 0; index < entries.length; index += 4) {
      const results = await Promise.allSettled(
        entries.slice(index, index + 4).map(([url, hash]) => cacheAsset(cache, url, hash)),
      );
      const failure = results.find((result) => result.status === "rejected");
      if (failure) throw failure.reason;
    }
  } catch (error) {
    await caches.delete(cacheName);
    throw error;
  }
}

self.addEventListener("install", (event) => {
  // Do not skip waiting: existing clients keep their matching release.
  event.waitUntil(install());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(cachePrefix) && name !== cacheName) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

async function cachedOrNetwork(key, request) {
  const cache = await caches.open(cacheName);
  return (await cache.match(key)) ?? fetch(request);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  if (request.mode === "navigate") {
    const relativePath = url.pathname.slice(scope.pathname.length);
    if (relativePath === "" || relativePath === "index.html") {
      event.respondWith(cachedOrNetwork(shell, request));
      return;
    }
    // Preserve old deep links even after going offline.
    const level = /^game\/([0-9]+)(?:\.html|\/)?$/.exec(relativePath);
    if (level !== null || /^levels(?:\.html|\/)?$/.test(relativePath)) {
      const destination = new URL(scope);
      if (level !== null) destination.searchParams.set("level", level[1]);
      else destination.searchParams.set("view", "levels");
      event.respondWith(Promise.resolve(Response.redirect(destination.href, 302)));
    }
    return;
  }

  // Only exported, versioned assets are eligible. Never cache API responses.
  const key = new URL(url.pathname, scope.origin).href;
  if (assets.has(key) && !request.headers.has("range")) {
    event.respondWith(cachedOrNetwork(key, request));
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CHECK_OFFLINE" || !event.ports[0]) return;
  const port = event.ports[0];
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(cacheName);
      const keys = new Set((await cache.keys()).map((request) => request.url));
      port.postMessage([...assets.keys()].every((url) => keys.has(url)));
    } catch {
      port.postMessage(false);
    }
  })());
});
