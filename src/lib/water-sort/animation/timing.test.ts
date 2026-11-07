import assert from "node:assert/strict";
import test from "node:test";

import { applyMove } from "../domain/moves";
import { createPourTimeline } from "./timelines";
import { GAME_TIMING } from "./timing";

test("pour duration is inferred from the latest animation endpoint", () => {
  const endpoints = [
    GAME_TIMING.pour.travelEndSeconds,
    GAME_TIMING.pour.tiltEndSeconds,
    GAME_TIMING.pour.streamOpenEndSeconds,
    GAME_TIMING.pour.transferEndSeconds,
    GAME_TIMING.pour.streamCloseEndSeconds,
    GAME_TIMING.pour.completedVialEndSeconds,
    GAME_TIMING.pour.returnRotationEndSeconds,
    GAME_TIMING.pour.returnTravelEndSeconds,
  ];

  assert.equal(GAME_TIMING.pour.totalSeconds, Math.max(...endpoints));
  assert.equal(
    GAME_TIMING.pour.totalSeconds,
    GAME_TIMING.pour.returnTravelEndSeconds,
  );
});

test("expedited return starts only after the pour has finished transferring", () => {
  assert.ok(
    GAME_TIMING.pour.returnStartSeconds > GAME_TIMING.pour.transferEndSeconds,
  );
  assert.ok(GAME_TIMING.pour.expeditedReturnTimeScale > 1);
});

test("pickup and landing squash/stretch restore identity at every stable stage", () => {
  const initialBoard = [["coral"] as const, [] as const];
  const move = applyMove(initialBoard, {sourceVialIndex: 0, destinationVialIndex: 1}, 4);
  const animation = createPourTimeline({
    geometry: {
      direction: "right",
      translationX: 70,
      translationY: -38,
      rotationDegrees: 65,
      streamStart: {x: 100, y: 40},
      streamEnd: {x: 120, y: 120},
    },
    move,
    sourceWidthPixels: 60,
    paused: true,
    onComplete: () => {},
  });

  try {
    animation.seek(0.045);
    assert.ok(animation.getSnapshot().sourceScaleX > 1);
    assert.ok(animation.getSnapshot().sourceScaleY < 1);

    animation.seek(0.12);
    assert.ok(animation.getSnapshot().sourceScaleX < 1);
    assert.ok(animation.getSnapshot().sourceScaleY > 1);

    animation.seek(GAME_TIMING.pour.transferStartSeconds);
    assert.equal(animation.getSnapshot().sourceScaleX, 1);
    assert.equal(animation.getSnapshot().sourceScaleY, 1);

    animation.seek(0.995);
    assert.ok(animation.getSnapshot().sourceScaleX > 1);
    assert.ok(animation.getSnapshot().sourceScaleY < 1);

    animation.seek(GAME_TIMING.pour.totalSeconds);
    assert.equal(animation.getSnapshot().sourceScaleX, 1);
    assert.equal(animation.getSnapshot().sourceScaleY, 1);
  } finally {
    animation.timeline.kill();
  }
});
