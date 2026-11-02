import { createCanonicalBoardKey } from "../domain/board";
import type { Board } from "../domain/types";
import { searchForHintPath } from "../hints/hint-search";

export type RewindSearchResult =
  | {status: "found"; historyIndex: number; exploredStateCount: number}
  | {status: "unavailable"; reason: "empty-history" | "initial-unsolvable" | "search-limit"; exploredStateCount: number};

const MAX_STATES_PER_CHECK = 50_000;
const MAX_STATES_TOTAL = 300_000;

/**
 * historyBoards[i] is the board before turn i, so returning i rolls back
 * turns i..end. The *current* board is known to be unsolvable by the caller.
 *
 * Solvability is monotone along a valid played history: if a position is
 * unsolvable, every later state reached by legal pours is also unsolvable.
 * Do not interpret a solver search limit as evidence either way.
 */
export function findLastSolvableHistoryIndex(
  historyBoards: readonly Board[],
  capacity: number,
  classify: (board: Board, capacity: number, maxStates: number) =>
    {status: "found" | "unsolvable" | "limit-reached"; exploredStateCount: number}
    = (board, vialCapacity, maxStates) =>
      searchForHintPath(board, vialCapacity, new Set<string>(), maxStates),
): RewindSearchResult {
  if (historyBoards.length === 0) {
    return {status: "unavailable", reason: "empty-history", exploredStateCount: 0};
  }

  let exploredStateCount = 0;
  const knownResults = new Map<string, "found" | "unsolvable">();

  function check(index: number): "found" | "unsolvable" | "limit-reached" {
    const board = historyBoards[index]!;
    const key = createCanonicalBoardKey(board);
    const cached = knownResults.get(key);
    if (cached !== undefined) return cached;

    const remaining = MAX_STATES_TOTAL - exploredStateCount;
    if (remaining <= 0) return "limit-reached";
    const outcome = classify(board, capacity, Math.min(MAX_STATES_PER_CHECK, remaining));
    exploredStateCount += outcome.exploredStateCount;
    if (outcome.status !== "limit-reached") knownResults.set(key, outcome.status);
    return outcome.status;
  }

  const initial = check(0);
  if (initial !== "found") {
    return {
      status: "unavailable",
      reason: initial === "unsolvable" ? "initial-unsolvable" : "search-limit",
      exploredStateCount,
    };
  }

  let latestSolvable = 0;
  let firstUnsolvable = historyBoards.length; // The current, proven-deadlocked state.
  while (firstUnsolvable - latestSolvable > 1) {
    const midpoint = Math.floor((latestSolvable + firstUnsolvable) / 2);
    const outcome = check(midpoint);
    if (outcome === "limit-reached") {
      return {status: "unavailable", reason: "search-limit", exploredStateCount};
    }
    if (outcome === "found") latestSolvable = midpoint;
    else firstUnsolvable = midpoint;
  }

  return {status: "found", historyIndex: latestSolvable, exploredStateCount};
}
