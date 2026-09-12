import assert from "node:assert/strict";
import test from "node:test";

import type { PourGeometry } from "../animation/pour-geometry";
import type { PourPresentationSnapshot } from "../animation/timelines";
import { GAME_TIMING } from "../animation/timing";
import { applyMove } from "../domain/moves";
import type { AppliedMove, Board } from "../domain/types";
import { applyPresentationMoveToBoard } from "../presentation/visual-board";
import {
  buildConcurrentPourBoardRenderState,
  type ConcurrentPourPresentation,
  type VialAnchor,
} from "./render-state";

const CAPACITY = 4;
const GEOMETRY: PourGeometry = {
  direction: "right",
  translationX: 80,
  translationY: -40,
  rotationDegrees: 68,
  streamStart: {x: 100, y: 40},
  streamEnd: {x: 120, y: 120},
};

const ANCHORS: readonly VialAnchor[] = Array.from({length: 4}, (_, index) => ({
  x: index * 100,
  y: 0,
  width: 60,
  height: 160,
}));

function snapshot(
  timeSeconds: number,
  overrides: Partial<PourPresentationSnapshot> = {},
): PourPresentationSnapshot {
  return {
    timeSeconds,
    progress: timeSeconds / GAME_TIMING.pour.totalSeconds,
    sourceX: 0,
    sourceY: 0,
    sourceRotationDegrees: 0,
    streamOpacity: 0,
    destinationScale: 1,
    liquid: {
      timeSeconds,
      sourceWorldAngleDegrees: 0,
      sourceLocalAngleDegrees: 0,
      sourceAngularVelocity: 0,
      sourceCurvatureAmplitude: 0,
      destinationMaximumDisplacement: 0,
      destinationDisplacements: [],
    },
    ...overrides,
  };
}

function presentation(
  move: AppliedMove,
  timeSeconds: number,
  {
    started,
    contentCommitted,
    sourceX = 0,
  }: {
    started: boolean;
    contentCommitted: boolean;
    sourceX?: number;
  },
): ConcurrentPourPresentation {
  return {
    move,
    geometry: GEOMETRY,
    presentation: snapshot(timeSeconds, {sourceX}),
    started,
    contentCommitted,
  };
}

function getBands(state: ReturnType<typeof buildConcurrentPourBoardRenderState>, vialIndex: number) {
  return state.vials[vialIndex]?.bands ?? [];
}

test("queued dependent moves do not foreshadow future vial colors", () => {
  const initialBoard: Board = [["coral"], [], [], []];
  const firstMove = applyMove(
    initialBoard,
    {sourceVialIndex: 0, destinationVialIndex: 1},
    CAPACITY,
  );
  const secondMove = applyMove(
    firstMove.nextBoard,
    {sourceVialIndex: 1, destinationVialIndex: 2},
    CAPACITY,
  );
  const transferMidpoint =
    GAME_TIMING.pour.transferStartSeconds + GAME_TIMING.pour.transferSeconds / 2;

  const state = buildConcurrentPourBoardRenderState({
    board: initialBoard,
    anchors: ANCHORS,
    presentations: [
      presentation(firstMove, transferMidpoint, {
        started: true,
        contentCommitted: false,
      }),
      presentation(secondMove, 0, {
        started: false,
        contentCommitted: false,
        sourceX: 999,
      }),
    ],
    selectedSourceVialIndex: null,
    capacity: CAPACITY,
  });

  assert.equal(getBands(state, 0)[0]?.color, "coral");
  assert.equal(getBands(state, 0)[0]?.volume, 0.5);
  assert.equal(getBands(state, 1)[0]?.color, "coral");
  assert.equal(getBands(state, 1)[0]?.volume, 0.5);
  assert.deepEqual(getBands(state, 2), []);
});

test("a queued successor stays invisible after the current transfer commits", () => {
  const initialBoard: Board = [["coral"], [], [], []];
  const firstMove = applyMove(
    initialBoard,
    {sourceVialIndex: 0, destinationVialIndex: 1},
    CAPACITY,
  );
  const secondMove = applyMove(
    firstMove.nextBoard,
    {sourceVialIndex: 1, destinationVialIndex: 2},
    CAPACITY,
  );
  const visibleAfterFirst = applyPresentationMoveToBoard(
    initialBoard,
    firstMove,
    CAPACITY,
  );

  const state = buildConcurrentPourBoardRenderState({
    board: visibleAfterFirst,
    anchors: ANCHORS,
    presentations: [
      presentation(firstMove, GAME_TIMING.pour.returnStartSeconds, {
        started: true,
        contentCommitted: true,
      }),
      presentation(secondMove, 0, {
        started: false,
        contentCommitted: false,
        sourceX: 999,
      }),
    ],
    selectedSourceVialIndex: null,
    capacity: CAPACITY,
  });

  assert.deepEqual(getBands(state, 0), []);
  assert.deepEqual(getBands(state, 1), [{color: "coral", volume: 1}]);
  assert.deepEqual(getBands(state, 2), []);
  assert.equal(state.vials[1]?.translationX, 0);
});

test("independent running pours still interpolate concurrently", () => {
  const initialBoard: Board = [["coral"], ["amber"], [], []];
  const firstMove = applyMove(
    initialBoard,
    {sourceVialIndex: 0, destinationVialIndex: 2},
    CAPACITY,
  );
  const secondMove = applyMove(
    firstMove.nextBoard,
    {sourceVialIndex: 1, destinationVialIndex: 3},
    CAPACITY,
  );
  const transferMidpoint =
    GAME_TIMING.pour.transferStartSeconds + GAME_TIMING.pour.transferSeconds / 2;

  const state = buildConcurrentPourBoardRenderState({
    board: initialBoard,
    anchors: ANCHORS,
    presentations: [
      presentation(firstMove, transferMidpoint, {
        started: true,
        contentCommitted: false,
      }),
      presentation(secondMove, transferMidpoint, {
        started: true,
        contentCommitted: false,
      }),
    ],
    selectedSourceVialIndex: null,
    capacity: CAPACITY,
  });

  assert.equal(getBands(state, 2)[0]?.color, "coral");
  assert.equal(getBands(state, 2)[0]?.volume, 0.5);
  assert.equal(getBands(state, 3)[0]?.color, "amber");
  assert.equal(getBands(state, 3)[0]?.volume, 0.5);
});
