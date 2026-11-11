import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceGelSettling,
  createGelSettlingState,
  GEL_SETTLING_DECAY_SECONDS,
  getGelScanlineDisplacement,
} from "./gel-settling";

test("incoming pour triggers once and the gel continues settling after the stream ends", () => {
  const started = advanceGelSettling(createGelSettlingState(), 1 / 60, true);
  assert.equal(started.receiving, true);
  assert.equal(started.strength, 1);
  const duringPour = advanceGelSettling(started, 0.04, true);
  assert.ok(duringPour.elapsedSeconds > started.elapsedSeconds);
  assert.equal(duringPour.strength, 1);
  const afterPour = advanceGelSettling(duringPour, 0.04, false);
  assert.equal(afterPour.receiving, false);
  assert.ok(afterPour.strength > 0);
  assert.ok(afterPour.strength < duringPour.strength);
  assert.ok(afterPour.elapsedSeconds > duringPour.elapsedSeconds);
  const anotherPour = advanceGelSettling(afterPour, 0.01, true);
  assert.equal(anotherPour.strength, 1);
  assert.equal(anotherPour.elapsedSeconds, 0.01);
});

test("a disturbance is continuous across scanlines, delayed with depth and anchored at the bottom", () => {
  const state = {elapsedSeconds: 0.26, strength: 1, receiving: false};
  const surface = Math.abs(getGelScanlineDisplacement(0, state));
  const nearSurface = Math.abs(getGelScanlineDisplacement(0.08, state));
  const middle = Math.abs(getGelScanlineDisplacement(0.45, state));
  const bottom = getGelScanlineDisplacement(1, state);

  assert.ok(surface > nearSurface);
  assert.ok(nearSurface > middle);
  assert.equal(middle, 0, "mid-depth perturbation has not arrived yet");
  assert.equal(bottom, 0, "glass-bottom boundary has no displacement");

  const laterState = {...state, elapsedSeconds: 0.95};
  assert.ok(Math.abs(getGelScanlineDisplacement(0.45, laterState)) > 0);
  assert.equal(getGelScanlineDisplacement(1, laterState), 0);
  const acrossBoundary = Math.abs(
    getGelScanlineDisplacement(0.499, laterState)
    - getGelScanlineDisplacement(0.501, laterState),
  );
  assert.ok(acrossBoundary < 0.001, "adjacent scanlines cannot jump at a color-slot boundary");
});

test("settling persists longer than the pour and decays over seconds", () => {
  let state = advanceGelSettling(createGelSettlingState(), 0.016, true);
  for (let step = 0; step < 120; step += 1) {
    state = advanceGelSettling(state, 1 / 60, false);
  }
  assert.ok(state.strength > 0.35 && state.strength < 0.5);
  assert.ok(GEL_SETTLING_DECAY_SECONDS > 2);
  for (let step = 0; step < 1200; step += 1) {
    state = advanceGelSettling(state, 1 / 60, false);
  }
  assert.equal(state.strength, 0);
});

test("reduced motion immediately stops ornamental gel settling", () => {
  const active = {elapsedSeconds: 0.5, strength: 1, receiving: true};
  assert.deepEqual(advanceGelSettling(active, 0.016, true, true), createGelSettlingState());
  assert.deepEqual(advanceGelSettling(active, 0.016, false, true), createGelSettlingState());
});

test("frame spikes are capped and invalid negative elapsed time cannot reverse the simulation", () => {
  const original = {elapsedSeconds: 0.5, strength: 1, receiving: false};
  assert.equal(advanceGelSettling(original, 5, false).elapsedSeconds, 0.55);
  assert.equal(advanceGelSettling(original, -1, false).elapsedSeconds, 0.5);
});
