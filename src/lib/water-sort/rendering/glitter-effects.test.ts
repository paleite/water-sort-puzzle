import assert from "node:assert/strict";
import test from "node:test";

import {getStreamGlitterFlecks, STREAM_GLITTER_FLECK_COUNT} from "./glitter-effects";

test("stream flecks are deterministic for the same seed and pour progress", () => {
  const first = getStreamGlitterFlecks({visualSeed: 117, flowProgress: 0.34});
  const second = getStreamGlitterFlecks({visualSeed: 117, flowProgress: 0.34});
  assert.deepEqual(first, second);
  assert.equal(first.length, STREAM_GLITTER_FLECK_COUNT);
  assert.notDeepEqual(first, getStreamGlitterFlecks({visualSeed: 119, flowProgress: 0.34}));
  assert.notDeepEqual(first, getStreamGlitterFlecks({visualSeed: 117, flowProgress: 0.84}));
});

test("dense flecks remain bounded inside the stream silhouette at every pour progress", () => {
  for (const flowProgress of [-1, 0, 0.2, 0.5, 0.9, 1, 2]) {
    for (const fleck of getStreamGlitterFlecks({visualSeed: 199, flowProgress})) {
      assert.ok(fleck.pathProgress >= 0 && fleck.pathProgress < 1);
      assert.ok(Math.abs(fleck.normalOffset) <= 0.6);
      assert.ok(fleck.radius >= 0.32 && fleck.radius <= 0.78);
      assert.ok(fleck.brightness >= 0.4 && fleck.brightness <= 1);
    }
  }
  assert.deepEqual(
    getStreamGlitterFlecks({visualSeed: 199, flowProgress: -1}),
    getStreamGlitterFlecks({visualSeed: 199, flowProgress: 0}),
  );
});

test("reduced-motion uses fewer samples and input count is bounded", () => {
  assert.equal(getStreamGlitterFlecks({visualSeed: 0, flowProgress: 0, count: 12}).length, 12);
  assert.deepEqual(getStreamGlitterFlecks({visualSeed: 0, flowProgress: 0, count: 0}), []);
  assert.throws(() => getStreamGlitterFlecks({visualSeed: 0, flowProgress: 0, count: -1}), RangeError);
  assert.throws(() => getStreamGlitterFlecks({visualSeed: 0, flowProgress: 0, count: 65}), RangeError);
});
