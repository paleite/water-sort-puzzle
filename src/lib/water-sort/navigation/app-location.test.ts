import assert from "node:assert/strict";
import test from "node:test";

import { getAppHref, readAppLocation, type AppDestination } from "./app-location";

test("all application destinations round trip without changing the shell path", () => {
  const destinations: AppDestination[] = [
    { kind: "home" },
    { kind: "levels" },
    { kind: "game", levelId: "001" },
    { kind: "game", levelId: "650" },
    { kind: "game", levelId: "a&b" },
  ];
  for (const basePath of ["", "/water-sort-puzzle"]) {
    for (const destination of destinations) {
      const url = new URL(getAppHref(destination, basePath), "https://example.com");
      assert.equal(url.pathname, `${basePath}/`);
      assert.deepEqual(readAppLocation(url.search), destination);
    }
  }
});

test("level parameters take precedence and unknown views fall back to home", () => {
  assert.deepEqual(readAppLocation("?view=levels&level=001"), { kind: "game", levelId: "001" });
  assert.deepEqual(readAppLocation("?view=unknown"), { kind: "home" });
});
