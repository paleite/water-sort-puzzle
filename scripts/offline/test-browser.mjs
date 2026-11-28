/* global document, fetch, localStorage, performance, process, console, URL */

import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { createRequire } from "node:module";

const loadPackage = createRequire(import.meta.url);
const { chromium, webkit } = loadPackage(process.env.PLAYWRIGHT_PACKAGE ?? "playwright");
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const output = resolve("out");
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};
const hits = [];
let originUnavailable = false;
const blocked = [];
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  hits.push(url.pathname);
  if (originUnavailable) {
    blocked.push(url.pathname);
    // No HTTP response can be served, even to a service worker's own fetch.
    request.socket.destroy();
    return;
  }
  if (!url.pathname.startsWith(`${basePath}/`)) {
    response.writeHead(404).end();
    return;
  }
  const relative = decodeURIComponent(url.pathname.slice(basePath.length + 1));
  const filename = resolve(output, relative === "" ? "index.html" : relative);
  if (!filename.startsWith(output + sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    let servedFilename = filename;
    let bytes;
    try {
      bytes = await readFile(filename);
    } catch {
      servedFilename = filename + ".html";
      bytes = await readFile(servedFilename);
    }
    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(servedFilename)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    }).end(bytes);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const root = `http://127.0.0.1:${server.address().port}${basePath}/`;
const storageKey = "water-sort:progress:v1";

async function progress(page) {
  return JSON.parse(await page.evaluate((key) => localStorage.getItem(key), storageKey));
}

async function waitForLevel(page, levelId) {
  await page.getByText(`Level ${levelId}`, { exact: true }).waitFor();
  await page.locator("canvas").first().waitFor({ state: "attached" });
  await page.waitForFunction(
    ({ key, level }) => JSON.parse(localStorage.getItem(key) ?? "null")?.savedGame?.levelId === level,
    { key: storageKey, level: levelId },
  );
}

async function chooseLevel(page, levelId) {
  await page.locator(`a[href="${basePath}/?level=${levelId}"]`).click();
  await waitForLevel(page, levelId);
}

function nearCompletion(board, capacity) {
  const counts = new Map();
  for (const color of board.flat()) counts.set(color, (counts.get(color) ?? 0) + 1);
  const prepared = [];
  for (const [color, count] of counts) {
    assert.equal(count % capacity, 0);
    for (let index = 0; index < count / capacity; index++) {
      prepared.push(Array(capacity).fill(color));
    }
  }
  assert.ok(prepared.length < board.length);
  const color = prepared[0].pop();
  const sourceIndex = prepared.length;
  prepared.push([color]);
  while (prepared.length < board.length) prepared.push([]);
  return { board: prepared, sourceIndex };
}

function assertNoApplicationRequests(start, label) {
  const attempted = hits.slice(start);
  // Browser-managed service worker update checks bypass its fetch handler.
  // They may fail offline without affecting any application resource.
  const unexpected = attempted.filter((path) => path !== `${basePath}/sw.js`);
  assert.deepEqual(unexpected, [], `${label}: unexpected origin requests`);
}

function observePage(page, browserName) {
  page.on("pageerror", (error) => console.error(`[${browserName}] page error:`, error));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      console.log(`[${browserName}] ${message.type()}: ${message.text()}`);
    }
  });
  page.on("requestfailed", (request) => {
    console.log(`[${browserName}] failed request: ${request.url()} ${request.failure()?.errorText}`);
  });
  page.on("crash", () => console.error(`[${browserName}] page crashed`));
}

async function exercise(browserType) {
  const browser = await browserType.launch();
  try {
    const context = await browser.newContext({ serviceWorkers: "allow", viewport: { width: 900, height: 900 } });
    try {
      let page = await context.newPage();
      observePage(page, browserType.name());
      page.setDefaultTimeout(30_000);
      await page.goto(root);
      await page.getByText("Ready to play offline", { exact: true }).waitFor({ timeout: 120_000 });
      const graphics = await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
        const supported = context !== null;
        context?.getExtension("WEBGL_lose_context")?.loseContext();
        return supported;
      });
      assert.ok(graphics, `${browserType.name()} requires a working WebGL test environment`);

      // The decorative home scene must use the real renderer without altering progress.
      const homeHero = page.locator("[data-home-hero]");
      const homeCanvas = homeHero.locator("canvas");
      const initialProgress = await page.evaluate((key) => localStorage.getItem(key), storageKey);
      await homeCanvas.waitFor({ state: "visible" });
      assert.equal(await homeHero.getAttribute("data-vial-skin"), "classic");
      assert.equal(await homeHero.getAttribute("data-palette"), "reoptimized_cue_balanced");
      assert.equal(await page.locator("main").getAttribute("data-background"), "midnight");
      await page.locator('[data-home-hero][data-phase="selecting"]').waitFor();
      await page.locator('[data-home-hero][data-phase="pouring"]').waitFor();
      await page.locator('[data-home-hero][data-phase="settled"]').waitFor();
      await page.locator('[data-home-hero][data-phase="ready"]').waitFor();
      assert.equal(await homeCanvas.count(), 1);
      assert.equal(await page.evaluate((key) => localStorage.getItem(key), storageKey), initialProgress);

      // A mobile resize restarts the scene, and reduced motion stops its timeline.
      await page.setViewportSize({ width: 390, height: 844 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.locator('[data-home-hero][data-phase="still"]').waitFor();
      const stillImage = await homeCanvas.screenshot();
      await page.waitForTimeout(1500);
      assert.equal(await homeHero.getAttribute("data-phase"), "still");
      assert.deepEqual(await homeCanvas.screenshot(), stillImage);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.setViewportSize({ width: 900, height: 900 });
      await page.locator('[data-home-hero][data-phase="pouring"]').waitFor();

      // Fail the origin itself for both engines. WebKit's offline emulation can
      // reject even responses synthesized by an active service worker.
      originUnavailable = true;
      if (browserType.name() === "chromium") await context.setOffline(true);
      const probeFailed = await page.evaluate(async () => {
        try {
          await fetch("offline-network-probe", { cache: "no-store" });
          return false;
        } catch {
          return true;
        }
      });
      assert.ok(probeFailed, "uncached network probe must fail");
      // On WebKit the origin must have refused the probe, not returned a 404.
      if (browserType.name() === "webkit") {
        assert.ok(blocked.includes(`${basePath}/offline-network-probe`));
      }
      const beforeOffline = hits.length;
      const initialDocument = await page.evaluate(() => performance.timeOrigin);
      await page.locator(`a[href="${basePath}/?view=levels"]`).click();
      assert.equal(await homeCanvas.count(), 0);
      await page.goBack();
      await homeCanvas.waitFor({ state: "visible" });
      await page.locator('[data-home-hero][data-phase="settled"]').waitFor();
      await page.locator(`a[href="${basePath}/?view=levels"]`).click();
      assert.equal(await homeCanvas.count(), 0);
      await chooseLevel(page, "001");
      assert.equal(await page.locator("main").getAttribute("data-vial-skin"), "classic");
      assert.equal(await page.locator("main").getAttribute("data-palette"), "reoptimized_cue_balanced");
      assert.equal(await page.locator("main").getAttribute("data-background"), "midnight");
      const original = (await progress(page)).savedGame.board;
      const firstEmpty = original.findIndex((vial) => vial.length === 0);
      assert.ok(firstEmpty > 0);
      await page.getByRole("button", { name: /^Vial 1,/ }).click();
      await page.getByRole("button", { name: new RegExp(`^Vial ${firstEmpty + 1},`) }).click();
      await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).savedGame.history.length > 0, storageKey);
      assert.equal(await page.evaluate(() => performance.timeOrigin), initialDocument);
      assertNoApplicationRequests(beforeOffline, "offline gameplay");

      // A real offline reload must preserve the move, not merely the URL.
      await page.reload();
      await waitForLevel(page, "001");
      assert.ok((await progress(page)).savedGame.history.length > 0);

      // Construct a legal near-completion fixture from the actual level colors.
      // Exercise the real final pour and Next Level control, not a simulated click handler.
      await page.getByRole("link", { name: "Choose level" }).click();
      const prepared = nearCompletion(original, 4);
      await page.evaluate(({ key, board }) => {
        localStorage.setItem(key, JSON.stringify({
          version: 1, currentLevelId: "001", completedLevelIds: [],
          savedGame: { levelId: "001", board, history: [] },
        }));
      }, { key: storageKey, board: prepared.board });
      await chooseLevel(page, "001");
      const documentBeforeNext = await page.evaluate(() => performance.timeOrigin);
      await page.getByRole("button", { name: new RegExp(`^Vial ${prepared.sourceIndex + 1},`) }).click();
      await page.getByRole("button", { name: /^Vial 1,/ }).click();
      await page.getByRole("heading", { name: "Level complete" }).waitFor();
      await page.getByRole("button", { name: "Next level" }).click();
      await waitForLevel(page, "002");
      assert.equal(await page.evaluate(() => performance.timeOrigin), documentBeforeNext);
      assert.ok((await progress(page)).completedLevelIds.includes("001"));

      // Exercise the cached alternate artwork and far end of the installed catalog.
      for (let index = 0; index < 3; index++) {
        await page.getByRole("button", { name: "Change vial style" }).click();
      }
      await page.getByRole("link", { name: "Choose level" }).click();
      await chooseLevel(page, "650");
      await page.goBack();
      await page.getByRole("heading", { name: "Levels" }).waitFor();
      await page.goForward();
      await waitForLevel(page, "650");

      // A fresh document and an old deep link both work with the same installed cache.
      await page.close();
      page = await context.newPage();
      observePage(page, browserType.name());
      await page.goto(root + "game/650");
      await waitForLevel(page, "650");
      assert.equal(new URL(page.url()).searchParams.get("level"), "650");
      assertNoApplicationRequests(beforeOffline, "offline navigation");
      console.log(`Blocked origin requests: ${JSON.stringify(blocked)}`);
      await context.setOffline(false);
      console.log(`${browserType.name()} passed offline navigation, progress, reload and deep link checks.`);
    } finally {
      await context.close();
      originUnavailable = false;
      blocked.length = 0;
    }
  } finally {
    await browser.close();
  }
}

try {
  const browserName = process.env.OFFLINE_BROWSER;
  const browsers = { chromium, webkit };
  if (browserName === undefined) {
    for (const browserType of Object.values(browsers)) await exercise(browserType);
  } else {
    assert.ok(Object.hasOwn(browsers, browserName), `Unknown browser: ${browserName}`);
    await exercise(browsers[browserName]);
  }
} finally {
  await new Promise((done, reject) => server.close((error) => error ? reject(error) : done()));
}
