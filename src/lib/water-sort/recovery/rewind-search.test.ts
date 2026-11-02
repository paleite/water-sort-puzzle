import assert from "node:assert/strict";
import test from "node:test";

import type { Board } from "../domain/types";
import { findLastSolvableHistoryIndex } from "./rewind-search";

function createHistoryBoards(count: number): Board[] {
  return Array.from({length: count}, (_, index): Board => [
    ["coral"],
    ...Array.from({length: index}, (): Board[number] => ["sky"]),
  ]);
}

test("finds the latest solvable checkpoint using logarithmic searches", () => {
  const boards = createHistoryBoards(17);
  let calls = 0;
  const result = findLastSolvableHistoryIndex(boards, 4, (board) => {
    calls += 1;
    return {status: boards.indexOf(board) <= 9 ? "found" : "unsolvable", exploredStateCount: 2};
  });
  assert.deepEqual(result, {status: "found", historyIndex: 9, exploredStateCount: calls * 2});
  assert.ok(calls <= 6);
});

test("rewinds a single turn when only the initial position is solvable", () => {
  const boards = createHistoryBoards(1);
  const outcome = findLastSolvableHistoryIndex(boards, 4, () => ({
    status: "found", exploredStateCount: 1,
  }));
  assert.equal(outcome.status, "found");
  if (outcome.status === "found") assert.equal(outcome.historyIndex, 0);
});

test("does not guess a checkpoint when a search reaches its limit", () => {
  const boards = createHistoryBoards(8);
  const outcome = findLastSolvableHistoryIndex(boards, 4, (board) => ({
    status: boards.indexOf(board) === 0 ? "found" : "limit-reached",
    exploredStateCount: 3,
  }));
  assert.equal(outcome.status, "unavailable");
  if (outcome.status === "unavailable") assert.equal(outcome.reason, "search-limit");
});

test("refuses recovery when even the initial position is unsolvable", () => {
  const boards = createHistoryBoards(3);
  const outcome = findLastSolvableHistoryIndex(boards, 4, () => ({
    status: "unsolvable", exploredStateCount: 2,
  }));
  assert.equal(outcome.status, "unavailable");
  if (outcome.status === "unavailable") assert.equal(outcome.reason, "initial-unsolvable");
});

test("returns unavailable when no past turns exist", () => {
  assert.deepEqual(
    findLastSolvableHistoryIndex([], 4),
    {status: "unavailable", reason: "empty-history", exploredStateCount: 0},
  );
});
