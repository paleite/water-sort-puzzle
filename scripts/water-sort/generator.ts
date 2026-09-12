import type { ColorId } from "../../src/lib/water-sort/domain/colors";
import { isCompleteVial } from "../../src/lib/water-sort/domain/solved";
import type { Board } from "../../src/lib/water-sort/domain/types";

export interface StructuralMetrics {
  meanVialEntropy: number;
  boundaryRate: number;
  totalRunCount: number;
  mixedVialRatio: number;
  sameColorAdjacencyCount: number;
  withinVialDuplicateCount: number;
  completedVialCount: number;
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

export function createUniformShuffledBoard(
  colors: readonly ColorId[],
  capacity: number,
  emptyVialCount: number,
  random: () => number,
): Board {
  if (!Number.isInteger(capacity) || capacity <= 0) {
    throw new Error("Capacity must be a positive integer.");
  }
  if (!Number.isInteger(emptyVialCount) || emptyVialCount < 0) {
    throw new Error("Empty vial count must be a non-negative integer.");
  }

  const liquidUnits = shuffle(
    colors.flatMap((color) => Array.from({length: capacity}, () => color)),
    random,
  );

  const filledVials: ColorId[][] = [];
  for (let offset = 0; offset < liquidUnits.length; offset += capacity) {
    filledVials.push(liquidUnits.slice(offset, offset + capacity));
  }

  return [
    ...filledVials,
    ...Array.from({length: emptyVialCount}, () => [] as ColorId[]),
  ];
}

export function isCleanGeneratedBoard(
  board: Board,
  capacity: number,
  emptyVialCount: number,
): boolean {
  if (capacity <= 0 || emptyVialCount < 0 || emptyVialCount > board.length) {
    return false;
  }

  const firstEmptyIndex = board.findIndex((vial) => vial.length === 0);
  const expectedFirstEmptyIndex = board.length - emptyVialCount;
  if (firstEmptyIndex !== expectedFirstEmptyIndex) return false;

  return board.every((vial, vialIndex) =>
    vialIndex < expectedFirstEmptyIndex
      ? vial.length === capacity
      : vial.length === 0,
  );
}

function vialEntropy(vial: readonly ColorId[]): number {
  if (vial.length === 0) return 0;
  const counts = new Map<ColorId, number>();
  for (const color of vial) counts.set(color, (counts.get(color) ?? 0) + 1);

  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / vial.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

export function calculateStructuralMetrics(
  board: Board,
  capacity: number,
): StructuralMetrics {
  const nonEmptyVials = board.filter((vial) => vial.length > 0);
  const meanVialEntropy =
    nonEmptyVials.length === 0
      ? 0
      : nonEmptyVials.reduce((sum, vial) => sum + vialEntropy(vial), 0) /
        nonEmptyVials.length;

  let adjacentPairs = 0;
  let differentAdjacentPairs = 0;
  let totalRunCount = 0;
  let sameColorAdjacencyCount = 0;
  let withinVialDuplicateCount = 0;
  let mixedVialCount = 0;

  for (const vial of nonEmptyVials) {
    const uniqueColors = new Set(vial);
    if (uniqueColors.size > 1) mixedVialCount += 1;
    withinVialDuplicateCount += vial.length - uniqueColors.size;
    totalRunCount += 1;

    for (let index = 1; index < vial.length; index += 1) {
      adjacentPairs += 1;
      if (vial[index] === vial[index - 1]) {
        sameColorAdjacencyCount += 1;
      } else {
        differentAdjacentPairs += 1;
        totalRunCount += 1;
      }
    }
  }

  return {
    meanVialEntropy,
    boundaryRate:
      adjacentPairs === 0 ? 0 : differentAdjacentPairs / adjacentPairs,
    totalRunCount,
    mixedVialRatio:
      nonEmptyVials.length === 0 ? 0 : mixedVialCount / nonEmptyVials.length,
    sameColorAdjacencyCount,
    withinVialDuplicateCount,
    completedVialCount: board.filter((vial) => isCompleteVial(vial, capacity)).length,
  };
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}
