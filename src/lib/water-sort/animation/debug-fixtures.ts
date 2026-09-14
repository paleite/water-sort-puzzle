import type { AppliedMove, Board, Move } from "../domain/types";
import { applyMove } from "../domain/moves";
import { GAME_TIMING } from "./timing";

export interface AnimationDebugScenario {
  id: string;
  title: string;
  description: string;
  capacity: number;
  initialBoard: Board;
  move: AppliedMove;
  moves: readonly AppliedMove[];
  settledBoard: Board;
}

export interface PourDebugCheckpoint {
  id: string;
  label: string;
  timeSeconds: number;
}

function createScenario({
  id,
  title,
  description,
  capacity,
  board,
  sourceVialIndex,
  destinationVialIndex,
}: {
  id: string;
  title: string;
  description: string;
  capacity: number;
  board: Board;
  sourceVialIndex: number;
  destinationVialIndex: number;
}): AnimationDebugScenario {
  const move = applyMove(board, {sourceVialIndex, destinationVialIndex}, capacity);
  return {
    id,
    title,
    description,
    capacity,
    initialBoard: board,
    move,
    moves: [move],
    settledBoard: move.nextBoard,
  };
}

function createConcurrentScenario({
  id,
  title,
  description,
  capacity,
  board,
  requestedMoves,
}: {
  id: string;
  title: string;
  description: string;
  capacity: number;
  board: Board;
  requestedMoves: readonly Move[];
}): AnimationDebugScenario {
  let currentBoard = board;
  const moves: AppliedMove[] = [];

  for (const requestedMove of requestedMoves) {
    const move = applyMove(currentBoard, requestedMove, capacity);
    moves.push(move);
    currentBoard = move.nextBoard;
  }

  const primaryMove = moves[0];
  if (primaryMove === undefined) {
    throw new Error("A concurrent debug scenario must contain at least one move.");
  }

  return {
    id,
    title,
    description,
    capacity,
    initialBoard: board,
    move: primaryMove,
    moves,
    settledBoard: currentBoard,
  };
}

const NORMAL_BOARD: Board = [
  ["amber", "violet"],
  ["teal", "violet"],
];

const EMPTY_DESTINATION_BOARD: Board = [
  ["amber", "sky", "sky"],
  [],
];

const MULTI_POUR_BOARD: Board = [
  ["coral", "violet"],
  ["violet", "violet"],
  ["teal", "violet"],
  ["amber", "sky"],
];

export const ANIMATION_DEBUG_SCENARIOS: readonly AnimationDebugScenario[] = [
  createScenario({
    id: "normal-non-empty",
    title: "Normal pour into non-empty vial",
    description: "Moves one violet unit into a non-empty destination with a violet top.",
    capacity: 4,
    board: NORMAL_BOARD,
    sourceVialIndex: 0,
    destinationVialIndex: 1,
  }),
  createScenario({
    id: "empty-destination",
    title: "Pour into empty vial",
    description: "Moves a two-unit sky run into an empty destination.",
    capacity: 4,
    board: EMPTY_DESTINATION_BOARD,
    sourceVialIndex: 0,
    destinationVialIndex: 1,
  }),
  createConcurrentScenario({
    id: "multi-unit",
    title: "Two-source parallel pour",
    description: "Runs two independent violet source presentations at the same time into one shared destination.",
    capacity: 4,
    board: MULTI_POUR_BOARD,
    requestedMoves: [
      {sourceVialIndex: 0, destinationVialIndex: 1},
      {sourceVialIndex: 2, destinationVialIndex: 1},
    ],
  }),
] as const;

export const POUR_DEBUG_CHECKPOINTS: readonly PourDebugCheckpoint[] = [
  {id: "idle", label: "Idle", timeSeconds: 0},
  {id: "tilt-start", label: "Tilt start", timeSeconds: GAME_TIMING.pour.tiltStartSeconds},
  {id: "travel-end", label: "Travel end", timeSeconds: GAME_TIMING.pour.travelSeconds},
  {id: "stream-start", label: "Stream start", timeSeconds: GAME_TIMING.pour.streamStartSeconds},
  {id: "transfer-start", label: "Transfer start", timeSeconds: GAME_TIMING.pour.transferStartSeconds},
  {
    id: "mid-transfer",
    label: "Mid-transfer",
    timeSeconds: GAME_TIMING.pour.transferStartSeconds + GAME_TIMING.pour.transferSeconds / 2,
  },
  {
    id: "transfer-end",
    label: "Transfer end",
    timeSeconds: GAME_TIMING.pour.transferStartSeconds + GAME_TIMING.pour.transferSeconds,
  },
  {id: "return-start", label: "Return starts", timeSeconds: GAME_TIMING.pour.returnRotationSeconds},
  {id: "return-travel", label: "Travel home", timeSeconds: GAME_TIMING.pour.returnTravelSeconds},
  {
    id: "upright",
    label: "Upright",
    timeSeconds: GAME_TIMING.pour.returnRotationSeconds + GAME_TIMING.pour.returnRotationDurationSeconds,
  },
  {
    id: "home",
    label: "Home",
    timeSeconds: GAME_TIMING.pour.returnTravelSeconds + GAME_TIMING.pour.returnTravelDurationSeconds,
  },
  {id: "settled", label: "Settled", timeSeconds: GAME_TIMING.pour.totalSeconds},
] as const;
