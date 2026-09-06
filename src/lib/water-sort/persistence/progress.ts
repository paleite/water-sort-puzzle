import { z } from "zod";

import { COLOR_IDS } from "../domain/colors";
import type { AppliedMove, Board } from "../domain/types";

const ColorIdSchema = z.enum(COLOR_IDS);
const BoardSchema = z.array(z.array(ColorIdSchema));
const MoveSchema = z.object({
  sourceVialIndex: z.number().int().nonnegative(),
  destinationVialIndex: z.number().int().nonnegative(),
});
const AppliedMoveSchema = z.object({
  move: MoveSchema,
  color: ColorIdSchema,
  amount: z.number().int().positive(),
  previousBoard: BoardSchema,
  nextBoard: BoardSchema,
  newlyCompletedVialIndices: z.array(z.number().int().nonnegative()),
});
const SavedGameSchema = z.object({
  levelId: z.string(),
  board: BoardSchema,
  history: z.array(AppliedMoveSchema),
});
const PersistedProgressSchema = z.object({
  version: z.literal(1),
  currentLevelId: z.string().nullable(),
  completedLevelIds: z.array(z.string()),
  savedGame: SavedGameSchema.nullable(),
});

export interface SavedGame {
  levelId: string;
  board: Board;
  history: readonly AppliedMove[];
}
export interface PersistedProgress {
  version: 1;
  currentLevelId: string | null;
  completedLevelIds: readonly string[];
  savedGame: SavedGame | null;
}

const STORAGE_KEY = "water-sort:progress:v1";

export function createEmptyProgress(): PersistedProgress {
  return {version: 1, currentLevelId: null, completedLevelIds: [], savedGame: null};
}

export function loadProgress(): PersistedProgress {
  if (typeof window === "undefined") return createEmptyProgress();
  const serialized = window.localStorage.getItem(STORAGE_KEY);
  if (serialized === null) return createEmptyProgress();
  try {
    const parsed: unknown = JSON.parse(serialized);
    const result = PersistedProgressSchema.safeParse(parsed);
    return result.success ? result.data : createEmptyProgress();
  } catch {
    return createEmptyProgress();
  }
}

export function saveProgress(progress: PersistedProgress): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}
