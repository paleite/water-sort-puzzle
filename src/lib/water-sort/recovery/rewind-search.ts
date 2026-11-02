import { createCanonicalBoardKey } from "../domain/board";
import { isDeadEnd } from "../domain/dead-end";
import type { Board } from "../domain/types";
import { searchForHintPath } from "../hints/hint-search";

export type RewindSearchResult = (
  | {status: "found"; historyIndex: number}
  | {status: "unavailable"; reason: "empty-history" | "initial-unsolvable" | "search-limit"}
) & {
  exploredStateCount: number;
  learnedUnsolvableKeys: readonly string[];
  learnedPaths: readonly (readonly Board[])[];
};

export interface RewindSearchKnowledge {
  knownPolicyKeys?: ReadonlySet<string>;
  knownUnsolvableKeys?: ReadonlySet<string>;
}

export interface RewindProbe {
  status: "found" | "unsolvable" | "limit-reached";
  exploredStateCount: number;
  boards?: readonly Board[];
}

export type RewindClassifier = (
  board: Board,
  capacity: number,
  maxExploredStates: number,
  knownPolicyKeys: ReadonlySet<string>,
) => RewindProbe;

const MAX_STATES_PER_CHECK = 250_000;
const MAX_STATES_TOTAL = 2_000_000;

/**
 * Each historyBoards[i] is the board before turn i; the currently displayed
 * board is known unsolvable. Probe from the most recent checkpoint backwards
 * so small, constrained dead-end positions are classified before broad early
 * game positions. Every checked unsolvable state rules out itself, but a
 * solver limit never proves anything.
 */
export function findLastSolvableHistoryIndex(
  historyBoards: readonly Board[],
  capacity: number,
  knowledge: RewindSearchKnowledge = {},
  classify: RewindClassifier = (board, vialCapacity, maxStates, knownPolicyKeys) =>
    searchForHintPath(board, vialCapacity, knownPolicyKeys, maxStates),
): RewindSearchResult {
  const learnedUnsolvableKeys: string[] = [];
  const learnedPaths: (readonly Board[])[] = [];
  let exploredStateCount = 0;

  const result = (
    outcome: {status: "found"; historyIndex: number}
      | {status: "unavailable"; reason: "empty-history" | "initial-unsolvable" | "search-limit"},
  ): RewindSearchResult => ({
    ...outcome,
    exploredStateCount,
    learnedUnsolvableKeys,
    learnedPaths,
  });

  if (historyBoards.length === 0) {
    return result({status: "unavailable", reason: "empty-history"});
  }

  const knownPolicyKeys = new Set(knowledge.knownPolicyKeys ?? []);
  const knownUnsolvableKeys = new Set(knowledge.knownUnsolvableKeys ?? []);

  for (let index = historyBoards.length - 1; index >= 0; index -= 1) {
    const board = historyBoards[index]!;
    const key = createCanonicalBoardKey(board);

    // A known hint-policy state has a verified continuation to the solution.
    if (knownPolicyKeys.has(key)) return result({status: "found", historyIndex: index});
    if (knownUnsolvableKeys.has(key)) continue;

    if (isDeadEnd(board, capacity)) {
      knownUnsolvableKeys.add(key);
      learnedUnsolvableKeys.push(key);
      continue;
    }

    const remaining = MAX_STATES_TOTAL - exploredStateCount;
    if (remaining <= 0) return result({status: "unavailable", reason: "search-limit"});

    const outcome = classify(board, capacity, Math.min(MAX_STATES_PER_CHECK, remaining), knownPolicyKeys);
    exploredStateCount += outcome.exploredStateCount;

    if (outcome.status === "found") {
      if (outcome.boards !== undefined && outcome.boards.length > 1) {
        learnedPaths.push(outcome.boards);
      }
      return result({status: "found", historyIndex: index});
    }
    if (outcome.status === "limit-reached") {
      // We cannot skip an unknown checkpoint and claim an earlier one is "last".
      return result({status: "unavailable", reason: "search-limit"});
    }

    knownUnsolvableKeys.add(key);
    learnedUnsolvableKeys.push(key);
  }

  return result({status: "unavailable", reason: "initial-unsolvable"});
}
