import type { AppliedMove, Board } from "../domain/types";
import { applyMove } from "../domain/moves";
import { GAME_TIMING } from "./timing";

export interface AnimationDebugScenario {
  id: string;
  title: string;
  description: string;
  capacity: number;
  initialBoard: Board;
  move: AppliedMove;
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
  return {
    id,
    title,
    description,
    capacity,
    initialBoard: board,
    move: applyMove(board, {sourceVialIndex, destinationVialIndex}, capacity),
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

const MULTI_UNIT_BOARD: Board = [
  ["coral", "violet", "violet"],
  ["amber", "violet"],
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
  createScenario({
    id: "multi-unit",
    title: "Multi-unit pour",
    description: "Moves a two-unit violet run into a partially filled violet destination.",
    capacity: 4,
    board: MULTI_UNIT_BOARD,
    sourceVialIndex: 0,
    destinationVialIndex: 1,
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
