import {
  boardsEqual,
  createCanonicalBoardKey,
} from "../../src/lib/water-sort/domain/board";
import type { ColorId } from "../../src/lib/water-sort/domain/colors";
import { applyMove, canPour } from "../../src/lib/water-sort/domain/moves";
import { isCompleteVial } from "../../src/lib/water-sort/domain/solved";
import type { Board, Move } from "../../src/lib/water-sort/domain/types";

export interface ReversePredecessor {
  predecessorBoard: Board;
  restoringMove: Move;
}
export interface StructuralMetrics {
  meanVialEntropy: number;
  boundaryRate: number;
  totalRunCount: number;
  mixedVialRatio: number;
  sameColorAdjacencyCount: number;
  withinVialDuplicateCount: number;
  completedVialCount: number;
}
export interface GeneratorState {
  board: Board;
  restoringMoves: readonly Move[];
  score: number;
  depth: number;
}
export interface BeamScrambleOptions {
  capacity: number;
  maximumDepth: number;
  beamWidth: number;
  childrenPerState: number;
  random: () => number;
}

export function createSolvedBoard(
  colors: readonly ColorId[],
  capacity: number,
  emptyVialCount: number,
): Board {
  return [
    ...colors.map((color) => Array.from({length: capacity}, () => color)),
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

  let emptyCount = 0;
  for (const vial of board) {
    if (vial.length === 0) {
      emptyCount += 1;
      continue;
    }
    if (vial.length !== capacity) return false;
  }

  return emptyCount === emptyVialCount;
}

/**
 * Normalize a reverse-generated candidate into the conventional starting shape:
 * every playable vial is full and the configured spare vials are empty.
 *
 * Full vials are preserved verbatim. Only liquid from partial vials is repacked,
 * in stable bottom-to-top / vial order, into the existing non-full slots. The
 * independent A* verification that follows generation remains authoritative for
 * solvability after this normalization step.
 */
export function cleanGeneratedBoard(
  board: Board,
  capacity: number,
  emptyVialCount: number,
): Board {
  if (capacity <= 0) throw new Error("Capacity must be positive.");
  if (emptyVialCount < 0 || emptyVialCount > board.length) {
    throw new Error("Invalid empty vial count.");
  }

  const expectedUnitCount = (board.length - emptyVialCount) * capacity;
  const actualUnitCount = board.reduce((sum, vial) => sum + vial.length, 0);
  if (actualUnitCount !== expectedUnitCount) {
    throw new Error(
      `Cannot clean board with ${actualUnitCount} units; expected ${expectedUnitCount}.`,
    );
  }

  const result: ColorId[][] = board.map((vial) =>
    vial.length === capacity ? [...vial] : [],
  );
  const nonFullIndices: number[] = [];
  const partialUnits: ColorId[] = [];

  board.forEach((vial, vialIndex) => {
    if (vial.length === capacity) return;
    nonFullIndices.push(vialIndex);
    partialUnits.push(...vial);
  });

  if (partialUnits.length % capacity !== 0) {
    throw new Error("Partial-vial unit count is not divisible by capacity.");
  }

  let unitOffset = 0;
  for (const vialIndex of nonFullIndices) {
    if (unitOffset >= partialUnits.length) break;
    result[vialIndex] = partialUnits.slice(unitOffset, unitOffset + capacity);
    unitOffset += capacity;
  }

  if (unitOffset !== partialUnits.length) {
    throw new Error("Failed to repack all partial-vial liquid.");
  }
  if (!isCleanGeneratedBoard(result, capacity, emptyVialCount)) {
    throw new Error("Generated board cleanup invariant failed.");
  }

  return result;
}

export function enumerateReversePredecessors(
  parentBoard: Board,
  capacity: number,
): readonly ReversePredecessor[] {
  const candidates: ReversePredecessor[] = [];

  for (
    let destinationVialIndex = 0;
    destinationVialIndex < parentBoard.length;
    destinationVialIndex += 1
  ) {
    const parentDestination = parentBoard[destinationVialIndex];
    if (parentDestination === undefined || parentDestination.length === 0) continue;
    const movedColor = parentDestination.at(-1);
    if (movedColor === undefined) continue;

    let destinationTopRunLength = 0;
    for (let index = parentDestination.length - 1; index >= 0; index -= 1) {
      if (parentDestination[index] !== movedColor) break;
      destinationTopRunLength += 1;
    }

    for (let amount = 1; amount <= destinationTopRunLength; amount += 1) {
      for (
        let sourceVialIndex = 0;
        sourceVialIndex < parentBoard.length;
        sourceVialIndex += 1
      ) {
        if (sourceVialIndex === destinationVialIndex) continue;
        const parentSource = parentBoard[sourceVialIndex];
        if (parentSource === undefined || parentSource.length + amount > capacity) continue;

        const predecessorBoard: Board = parentBoard.map((vial, vialIndex) => {
          if (vialIndex === destinationVialIndex) {
            return vial.slice(0, vial.length - amount);
          }
          if (vialIndex === sourceVialIndex) {
            return [...vial, ...Array.from({length: amount}, () => movedColor)];
          }
          return vial;
        });

        const restoringMove = {sourceVialIndex, destinationVialIndex};

        if (!canPour(predecessorBoard, restoringMove, capacity)) continue;
        const restoredBoard = applyMove(
          predecessorBoard,
          restoringMove,
          capacity,
        ).nextBoard;
        if (!boardsEqual(restoredBoard, parentBoard)) continue;

        candidates.push({predecessorBoard, restoringMove});
      }
    }
  }

  return candidates;
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
    const unique = new Set(vial);
    if (unique.size > 1) mixedVialCount += 1;
    withinVialDuplicateCount += vial.length - unique.size;
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

export function scoreBoard(board: Board, capacity: number): number {
  const metrics = calculateStructuralMetrics(board, capacity);
  return (
    4 * metrics.meanVialEntropy +
    4 * metrics.boundaryRate +
    0.2 * metrics.totalRunCount +
    2 * metrics.mixedVialRatio -
    2.5 * metrics.sameColorAdjacencyCount -
    1.5 * metrics.withinVialDuplicateCount -
    8 * metrics.completedVialCount
  );
}

function shuffle<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

export function beamScramble(
  solvedBoard: Board,
  options: BeamScrambleOptions,
): GeneratorState {
  let beam: GeneratorState[] = [{
    board: solvedBoard,
    restoringMoves: [],
    score: scoreBoard(solvedBoard, options.capacity),
    depth: 0,
  }];

  for (let depth = 1; depth <= options.maximumDepth; depth += 1) {
    const candidateByKey = new Map<string, GeneratorState>();

    for (const state of beam) {
      const predecessors = shuffle(
        enumerateReversePredecessors(state.board, options.capacity),
        options.random,
      ).slice(0, options.childrenPerState);

      for (const predecessor of predecessors) {
        const candidate: GeneratorState = {
          board: predecessor.predecessorBoard,
          restoringMoves: [predecessor.restoringMove, ...state.restoringMoves],
          score: scoreBoard(predecessor.predecessorBoard, options.capacity),
          depth,
        };
        const key = createCanonicalBoardKey(candidate.board);
        const existing = candidateByKey.get(key);
        if (existing === undefined || candidate.score > existing.score) {
          candidateByKey.set(key, candidate);
        }
      }
    }

    const candidates = [...candidateByKey.values()].sort((a, b) => b.score - a.score);
    if (candidates.length === 0) break;
    beam = candidates.slice(0, options.beamWidth);
  }

  beam.sort((a, b) => b.score - a.score);
  const topCount = Math.min(8, beam.length);
  const selected = beam[Math.floor(options.random() * topCount)];
  if (selected === undefined) throw new Error("Beam scramble produced no candidate.");
  return selected;
}

export function verifyGenerationCertificate(
  board: Board,
  restoringMoves: readonly Move[],
  capacity: number,
): boolean {
  let currentBoard = board;
  for (const move of restoringMoves) {
    if (!canPour(currentBoard, move, capacity)) return false;
    currentBoard = applyMove(currentBoard, move, capacity).nextBoard;
  }
  return currentBoard.every(
    (vial) => vial.length === 0 || isCompleteVial(vial, capacity),
  );
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
