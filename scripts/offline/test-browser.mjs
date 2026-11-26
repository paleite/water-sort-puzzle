/* global localStorage, performance, process, console, URL */

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
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  hits.push(url.pathname);
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

async function exercise(browserType) {
  const browser = await browserType.launch();
  try {
    const context = await browser.newContext({ serviceWorkers: "allow", viewport: { width: 900, height: 900 } });
    try {
      let page = await context.newPage();
      page.setDefaultTimeout(30_000);
      await page.goto(root);
      await page.getByText("Ready to play offline", { exact: true }).waitFor({ timeout: 120_000 });
      await context.setOffline(true);
      const beforeOffline = hits.length;
      const initialDocument = await page.evaluate(() => performance.timeOrigin);
      await page.locator(`a[href="${basePath}/?view=levels"]`).click();
      await chooseLevel(page, "001");
      const original = (await progress(page)).savedGame.board;
      const firstEmpty = original.findIndex((vial) => vial.length === 0);
      assert.ok(firstEmpty > 0);
      await page.getByRole("button", { name: /^Vial 1,/ }).click();
      await page.getByRole("button", { name: new RegExp(`^Vial ${firstEmpty + 1},`) }).click();
      await page.waitForFunction((key) => JSON.parse(localStorage.getItem(key)).savedGame.history.length > 0, storageKey);
      assert.equal(await page.evaluate(() => performance.timeOrigin), initialDocument);
      assert.equal(hits.length, beforeOffline, "offline gameplay contacted the server");

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
      await page.goto(root + "game/650");
      await waitForLevel(page, "650");
      assert.equal(new URL(page.url()).searchParams.get("level"), "650");
      assert.equal(hits.length, beforeOffline, "offline navigation contacted the server");
      await context.setOffline(false);
      console.log(`${browserType.name()} passed offline navigation, progress, reload and deep link checks.`);
    } finally {
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

try {
  for (const browserType of [chromium, webkit]) await exercise(browserType);
} finally {
  await new Promise((done, reject) => server.close((error) => error ? reject(error) : done()));
}
