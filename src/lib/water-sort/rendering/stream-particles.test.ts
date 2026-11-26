import assert from "node:assert/strict";
import test from "node:test";

import {getImpactRippleSample, getStreamParticleSamples} from "./stream-particles";

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

test("impact ripple expands within the available surface and remains visible beyond the old splash", () => {
  const early = getImpactRippleSample(0.43, 8);
  const peak = getImpactRippleSample(0.575, 8);
  const late = getImpactRippleSample(0.70, 8);
  assert.ok(early && peak && late);
  assert.ok(early.radiusX < peak.radiusX && peak.radiusX < late.radiusX);
  assert.ok(late.radiusX <= 8);
  assert.ok(peak.opacity > 0.7);
  assert.ok(late.opacity > 0.25);
  assert.equal(peak.radiusY, peak.radiusX * 0.34);
  assert.equal(getImpactRippleSample(0.39, 8), null);
  assert.equal(getImpactRippleSample(0.76, 8), null);
  assert.equal(getImpactRippleSample(0.575, 0), null);
  assert.ok((getImpactRippleSample(0.575, 0.5)?.radiusX ?? 1) <= 0.5);
});
