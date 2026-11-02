import assert from "node:assert/strict";
import test from "node:test";

import { createCanonicalBoardKey } from "../domain/board";
import type { Board } from "../domain/types";
import { findLastSolvableHistoryIndex } from "./rewind-search";

function createHistoryBoards(count: number): Board[] {
  return Array.from({length: count}, (_, index): Board => [
    ["coral"],
    ...Array.from({length: index}, (): Board[number] => ["sky"]),
  ]);
}

test("searches backwards from the most recent move, not the initial board", () => {
  const boards = createHistoryBoards(17);
  const calls: number[] = [];
  const result = findLastSolvableHistoryIndex(boards, 4, {}, (board) => {
    const index = boards.indexOf(board);
    calls.push(index);
    return {status: index <= 9 ? "found" : "unsolvable", exploredStateCount: 2};
  });
  assert.equal(result.status, "found");
  if (result.status === "found") assert.equal(result.historyIndex, 9);
  assert.deepEqual(calls, [16, 15, 14, 13, 12, 11, 10, 9]);
  assert.equal(result.exploredStateCount, 16);
  assert.equal(result.learnedUnsolvableKeys.length, 7);
});

test("reuses Hint knowledge without launching any solver search", () => {
  const boards = createHistoryBoards(8);
  const key = (index: number) => createCanonicalBoardKey(boards[index]!);
  const knownUnsolvableKeys = new Set(boards.slice(4).map(createCanonicalBoardKey));
  const result = findLastSolvableHistoryIndex(boards, 4, {
    knownPolicyKeys: new Set([key(3)]),
    knownUnsolvableKeys,
  }, () => {
    throw new Error("Solver should never be invoked for cached proofs");
  });
  assert.equal(result.status, "found");
  if (result.status === "found") assert.equal(result.historyIndex, 3);
  assert.equal(result.exploredStateCount, 0);
});

test("stops on the first unknown position instead of guessing an older checkpoint", () => {
  const boards = createHistoryBoards(8);
  const calls: number[] = [];
  const result = findLastSolvableHistoryIndex(boards, 4, {}, (board) => {
    const index = boards.indexOf(board);
    calls.push(index);
    return {status: index === 7 ? "unsolvable" : "limit-reached", exploredStateCount: 3};
  });
  assert.equal(result.status, "unavailable");
  if (result.status === "unavailable") assert.equal(result.reason, "search-limit");
  assert.deepEqual(calls, [7, 6]);
  assert.equal(result.learnedUnsolvableKeys.length, 1);
});

test("returns the initial state when every later checkpoint is unsolvable", () => {
  const boards = createHistoryBoards(5);
  const result = findLastSolvableHistoryIndex(boards, 4, {}, (board) => ({
    status: boards.indexOf(board) === 0 ? "found" : "unsolvable",
    exploredStateCount: 1,
  }));
  assert.equal(result.status, "found");
  if (result.status === "found") assert.equal(result.historyIndex, 0);
});

test("returns unavailable when the initial position is also unsolvable", () => {
  const boards = createHistoryBoards(3);
  const result = findLastSolvableHistoryIndex(boards, 4, {}, () => ({
    status: "unsolvable", exploredStateCount: 2,
  }));
  assert.equal(result.status, "unavailable");
  if (result.status === "unavailable") assert.equal(result.reason, "initial-unsolvable");
});

test("shares paths discovered by fresh successful probes", () => {
  const boards = createHistoryBoards(2);
  const result = findLastSolvableHistoryIndex(boards, 4, {}, (board) => ({
    status: "found",
    exploredStateCount: 4,
    boards: [board, [["coral", "coral"]]],
  }));
  assert.equal(result.status, "found");
  if (result.status === "found") assert.equal(result.historyIndex, 1);
  assert.equal(result.learnedPaths.length, 1);
  assert.equal(result.learnedPaths[0]?.length, 2);
});

test("returns unavailable for an empty history", () => {
  const result = findLastSolvableHistoryIndex([], 4);
  assert.equal(result.status, "unavailable");
  if (result.status === "unavailable") assert.equal(result.reason, "empty-history");
  assert.equal(result.exploredStateCount, 0);
});
