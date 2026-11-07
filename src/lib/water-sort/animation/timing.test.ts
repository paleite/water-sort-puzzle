import assert from "node:assert/strict";
import test from "node:test";

import { applyMove } from "../domain/moves";
import { createPourTimeline } from "./timelines";
import { getQueuedSameSourceSuccessor } from "./presentation-scheduler";
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

test("queued same-source pour retains its airborne position without a landing squash", () => {
  const initialBoard = [["coral", "coral"] as const, [] as const, [] as const];
  const firstMove = applyMove(initialBoard, {sourceVialIndex: 0, destinationVialIndex: 1}, 4);
  const secondMove = applyMove(firstMove.nextBoard, {sourceVialIndex: 0, destinationVialIndex: 2}, 4);
  const first = createPourTimeline({
    geometry: {
      direction: "right", translationX: 80, translationY: -45,
      rotationDegrees: 62,
      streamStart: {x: 100, y: 40}, streamEnd: {x: 140, y: 130},
    },
    move: firstMove, sourceWidthPixels: 60, paused: true, onComplete: () => {},
  });
  const second = createPourTimeline({
    geometry: {
      direction: "right", translationX: 160, translationY: -35,
      rotationDegrees: 62,
      streamStart: {x: 100, y: 40}, streamEnd: {x: 210, y: 130},
    },
    move: secondMove, sourceWidthPixels: 60, paused: true, onComplete: () => {},
  });

  try {
    assert.equal(first.requestDirectHandoff(), true);
    first.seek(0.995);
    assert.equal(first.getSnapshot().sourceScaleX, 1);
    assert.equal(first.getSnapshot().sourceScaleY, 1);
    first.seek(GAME_TIMING.pour.totalSeconds);
    const previousPose = first.getSnapshot();
    assert.equal(previousPose.sourceX, 80);
    assert.equal(previousPose.sourceY, -45);
    assert.equal(previousPose.sourceRotationDegrees, 0);

    second.setStartingPose({x: previousPose.sourceX, y: previousPose.sourceY});
    assert.equal(second.getSnapshot().sourceX, previousPose.sourceX);
    assert.equal(second.getSnapshot().sourceY, previousPose.sourceY);

    second.seek(0.045);
    assert.equal(second.getSnapshot().sourceScaleX, 1);
    assert.equal(second.getSnapshot().sourceScaleY, 1);
    second.seek(GAME_TIMING.pour.totalSeconds);
    assert.equal(second.getSnapshot().sourceX, 0);
    assert.equal(second.getSnapshot().sourceY, 0);
    assert.equal(second.getSnapshot().sourceScaleX, 1);
    assert.equal(second.getSnapshot().sourceScaleY, 1);
  } finally {
    first.timeline.kill();
    second.timeline.kill();
  }
});

test("only the earliest queued interaction with the same vial can hand off its pose", () => {
  const initialBoard = [["coral", "coral"] as const, ["coral"] as const, [] as const];
  const first = applyMove(initialBoard, {sourceVialIndex: 0, destinationVialIndex: 1}, 4);
  const second = applyMove(first.nextBoard, {sourceVialIndex: 0, destinationVialIndex: 2}, 4);
  const runtimeStates = new Map([
    [1, {started: true, contentCommitted: true}],
    [2, {started: false, contentCommitted: false}],
  ]);
  const firstPresentation = {id: 1, move: first};
  const secondPresentation = {id: 2, move: second};
  assert.equal(
    getQueuedSameSourceSuccessor(firstPresentation, [firstPresentation, secondPresentation], runtimeStates)?.id,
    2,
  );

  const incoming = {...secondPresentation, move: {
    ...second, move: {sourceVialIndex: 1, destinationVialIndex: 0},
  }};
  assert.equal(
    getQueuedSameSourceSuccessor(firstPresentation, [firstPresentation, incoming, {id: 3, move: second}], runtimeStates),
    null,
  );
});
