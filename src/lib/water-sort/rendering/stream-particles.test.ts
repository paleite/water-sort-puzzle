import assert from "node:assert/strict";
import test from "node:test";

import {getStreamParticleSamples} from "./stream-particles";

test("moving stream highlights are deterministic at any timeline position", () => {
  const options = {timeSeconds: 0.73, visualSeed: 167, opacity: 0.8};
  assert.deepEqual(getStreamParticleSamples(options), getStreamParticleSamples(options));
  assert.notDeepEqual(
    getStreamParticleSamples(options),
    getStreamParticleSamples({...options, timeSeconds: options.timeSeconds + 0.13}),
  );
  assert.notDeepEqual(
    getStreamParticleSamples(options),
    getStreamParticleSamples({...options, visualSeed: options.visualSeed + 53}),
  );
});

test("stream particles remain in the ribbon interior with bounded opacity", () => {
  for (const opacity of [0.2, 0.75, 1, 1.5]) {
    const particles = getStreamParticleSamples({timeSeconds: 0.91, visualSeed: 26, opacity});
    assert.equal(particles.length, 7);
    for (const particle of particles) {
      assert.ok(particle.progress >= 0.08 && particle.progress <= 0.92);
      assert.ok(Math.abs(particle.lateralOffset) <= 0.19);
      assert.ok(particle.radius > 0 && particle.streakLength > 0);
      assert.ok(particle.opacity >= 0 && particle.opacity <= 1);
    }
  }
});

test("stream highlights disappear when the real pouring ribbon is absent", () => {
  assert.deepEqual(getStreamParticleSamples({timeSeconds: 1, visualSeed: 2, opacity: 0}), []);
  assert.deepEqual(getStreamParticleSamples({timeSeconds: 1, visualSeed: 2, opacity: 0.001}), []);
});
