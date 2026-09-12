import assert from "node:assert/strict";
import test from "node:test";

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
