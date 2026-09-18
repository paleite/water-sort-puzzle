import type {Level} from "../domain/types";
import {
  LEVEL_IDS,
  LEVELS,
  type LevelId,
} from "./levels.generated";

export {
  LEVEL_IDS,
  type LevelId,
};

const LEVEL_ID_SET: ReadonlySet<string> = new Set(LEVEL_IDS);

export function isLevelId(value: string): value is LevelId {
  return LEVEL_ID_SET.has(value);
}

export function getLevel(levelId: string): Level | null {
  if (!isLevelId(levelId)) return null;
  return LEVELS[levelId];
}

export function getNextLevelId(levelId: string): LevelId | null {
  const index = LEVEL_IDS.findIndex((candidate) => candidate === levelId);
  if (index < 0) return null;
  return LEVEL_IDS[index + 1] ?? null;
}
