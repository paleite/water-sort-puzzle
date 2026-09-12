import type { ColorId } from "./colors";

export const DEFAULT_VIAL_CAPACITY = 4 as const;
export type Vial = readonly ColorId[];
export type Board = readonly Vial[];

export interface Move { sourceVialIndex: number; destinationVialIndex: number; }
export interface AppliedMove { move: Move; color: ColorId; amount: number; previousBoard: Board; nextBoard: Board; newlyCompletedVialIndices: readonly number[]; }
export interface AppliedPourTransfer { move: Move; color: ColorId; amount: number; }
export interface AppliedPourBatch { transfers: readonly AppliedPourTransfer[]; previousBoard: Board; nextBoard: Board; newlyCompletedVialIndices: readonly number[]; }
export type AppliedTurn = AppliedMove | AppliedPourBatch;
export type InvalidMoveReason = "destination-full" | "different-top-color" | "destination-missing";
export type InteractionResolution =
  | {type: "source-selected"; vialIndex: number}
  | {type: "source-unselected"}
  | {type: "move"; move: Move}
  | {type: "invalid-move"; sourceVialIndex: number; destinationVialIndex: number; reason: InvalidMoveReason}
  | {type: "ignored-empty-source"; vialIndex: number};

export interface LevelDevelopmentMetadata {
  optimalMoveCount: number;
  exploredStateCount: number;
  maximumBranchingFactor: number;
  meanVialEntropy: number;
  boundaryRate: number;
  totalRunCount: number;
  generationDepth?: number;
  generator?: "uniform-shuffle";
  generationSeed?: number;
  solverElapsedMilliseconds?: number;
  difficultyScore?: number;
  difficultyScoreVersion?: number;
}

export interface Level { id: string; capacity: number; board: Board; development?: LevelDevelopmentMetadata; }
