import { createCanonicalBoardKey } from "../domain/board";
import { getLegalMoves } from "../domain/legal-moves";
import { applyMove } from "../domain/moves";
import { isSolved } from "../domain/solved";
import type { Board } from "../domain/types";

/**
 * This detector intentionally does NOT attempt to prove general unsolvability.
 * It warns only after exhausting a small region in which the color-run layout
 * never changes. Moving a top run without unlocking any buried color leaves
 * this signature unchanged; exposing a color or emptying a vial changes it.
 */
export function createRunLayoutKey(board: Board): string {
  return JSON.stringify(
    board.map((vial) => {
      const runs = vial.filter((color, index) => index === 0 || color !== vial[index - 1]);
      return JSON.stringify(runs);
    }).sort(),
  );
}

export function shouldSearchForExhaustion(
  board: Board,
  capacity: number,
  maxDistinctSuccessors = 3,
): boolean {
  if (isSolved(board, capacity)) return false;
  const moves = getLegalMoves(board, capacity);
  if (moves.length === 0) return false; // Existing instant hard-deadlock check.

  const layout = createRunLayoutKey(board);
  const successors = new Set<string>();
  for (const move of moves) {
    const next = applyMove(board, move, capacity).nextBoard;
    // An immediately visible structural change means the player has choices.
    if (createRunLayoutKey(next) !== layout) return false;
    successors.add(createCanonicalBoardKey(next));
    if (successors.size > maxDistinctSuccessors) return false;
  }
  return true;
}

export interface ExhaustionSearchOptions {
  maxStates?: number;
  maxMilliseconds?: number;
  now?: () => number;
}

export type ExhaustionSearchResult = {
  status: "exhausted" | "playable" | "unknown";
  exploredStateCount: number;
};

export function searchForFunctionalExhaustion(
  board: Board,
  capacity: number,
  options: ExhaustionSearchOptions = {},
): ExhaustionSearchResult {
  const maxStates = options.maxStates ?? 500;
  const maxMilliseconds = options.maxMilliseconds ?? 20;
  const now = options.now ?? (() => performance.now());
  if (maxStates < 1 || maxMilliseconds <= 0) {
    return {status: "unknown", exploredStateCount: 0};
  }

  const startedAt = now();
  const originalLayout = createRunLayoutKey(board);
  const queue: Board[] = [board];
  const visited = new Set([createCanonicalBoardKey(board)]);
  let explored = 0;

  for (let head = 0; head < queue.length; head += 1) {
    if (now() - startedAt >= maxMilliseconds) {
      return {status: "unknown", exploredStateCount: explored};
    }
    const current = queue[head]!;
    explored += 1;
    if (isSolved(current, capacity) || createRunLayoutKey(current) !== originalLayout) {
      return {status: "playable", exploredStateCount: explored};
    }

    for (const move of getLegalMoves(current, capacity)) {
      const next = applyMove(current, move, capacity).nextBoard;
      // One reachable structural change means the position still offers
      // something to discover, even if the full puzzle is unsolvable.
      if (createRunLayoutKey(next) !== originalLayout || isSolved(next, capacity)) {
        return {status: "playable", exploredStateCount: explored};
      }
      const key = createCanonicalBoardKey(next);
      if (visited.has(key)) continue;
      if (visited.size >= maxStates) {
        return {status: "unknown", exploredStateCount: explored};
      }
      visited.add(key);
      queue.push(next);
    }
  }

  // Every reachable configuration was explored and all preserve the run layout.
  // The player can only shuffle exposed layers, not reveal or consolidate them.
  return {status: "exhausted", exploredStateCount: explored};
}
