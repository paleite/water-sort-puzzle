import assert from "node:assert/strict";
import test from "node:test";

import { createCanonicalBoardKey } from "../domain/board";
import { applyMove } from "../domain/moves";
import type { Board } from "../domain/types";
import {
  createRunLayoutKey,
  searchForFunctionalExhaustion,
  shouldSearchForExhaustion,
} from "./functional-exhaustion";

// All four colors occur exactly four times. Only the two exposed coral runs
// can move; pouring either way leaves both buried colors covered.
const oneColorLoop: Board = [
  ["sky", "coral", "coral"],
  ["emerald", "coral", "coral"],
  ["lemon", "sky", "sky"],
  ["lemon", "emerald", "emerald"],
  ["sky", "emerald", "lemon", "lemon"],
];

// Two independent mobile color groups, each stuck on top of other colors.
// All six colors appear exactly four times, capacity four.
const twoColorLoops: Board = [
  ["lemon", "coral", "coral"],
  ["emerald", "coral", "coral"],
  ["sky", "cobalt", "cobalt"],
  ["magenta", "cobalt", "cobalt"],
  ["lemon", "lemon", "lemon", "emerald"],
  ["emerald", "emerald", "sky", "sky"],
  ["sky", "magenta", "magenta", "magenta"],
];

test("two-vial redirection loop has legal moves but no changed run layout", () => {
  assert.equal(shouldSearchForExhaustion(oneColorLoop, 4), true);
  const result = searchForFunctionalExhaustion(oneColorLoop, 4);
  assert.equal(result.status, "exhausted");
  assert.ok(result.exploredStateCount > 1);
});

test("independent multi-color transfer loops also exhaust a small region", () => {
  assert.equal(shouldSearchForExhaustion(twoColorLoops, 4), true);
  const result = searchForFunctionalExhaustion(twoColorLoops, 4);
  assert.equal(result.status, "exhausted");
});

test("exposing a buried color keeps gameplay active, even when the board may be unsolvable", () => {
  const board: Board = [["sky", "coral"], ["coral"], [], ["sky", "sky"]];
  const next = applyMove(board, {sourceVialIndex: 0, destinationVialIndex: 1}, 4).nextBoard;
  assert.notEqual(createRunLayoutKey(board), createRunLayoutKey(next));
  assert.equal(shouldSearchForExhaustion(board, 4), false);
  assert.equal(searchForFunctionalExhaustion(board, 4).status, "playable");
});

test("vial permutations have the same canonical and structural key", () => {
  const reordered: Board = [...oneColorLoop].reverse();
  assert.equal(createCanonicalBoardKey(reordered), createCanonicalBoardKey(oneColorLoop));
  assert.equal(createRunLayoutKey(reordered), createRunLayoutKey(oneColorLoop));
});

test("a time budget limit is unknown, never a deadlock", () => {
  let milliseconds = 0;
  const result = searchForFunctionalExhaustion(oneColorLoop, 4, {
    maxMilliseconds: 20,
    now: () => (milliseconds += 30),
  });
  assert.equal(result.status, "unknown");
});

test("a state budget limit is unknown, never a deadlock", () => {
  assert.equal(searchForFunctionalExhaustion(oneColorLoop, 4, {maxStates: 1}).status, "unknown");
});

test("zero legal moves remain the responsibility of the existing instant detector", () => {
  const noMoves: Board = [
    ["sky", "coral", "coral", "coral"],
    ["emerald", "lemon", "lemon", "lemon"],
  ];
  assert.equal(shouldSearchForExhaustion(noMoves, 4), false);
});

test("completed boards never trigger automatic exhaustion search", () => {
  const solved: Board = [
    ["coral", "coral", "coral", "coral"],
    ["sky", "sky", "sky", "sky"],
    [],
  ];
  assert.equal(shouldSearchForExhaustion(solved, 4), false);
  assert.equal(searchForFunctionalExhaustion(solved, 4).status, "playable");
});

test("completed-vial relocation alone does not count as fresh structural progress", () => {
  const board: Board = [
    ["coral", "coral", "coral", "coral"],
    [],
    ["sky", "lemon", "emerald", "sky"],
  ];
  const next = applyMove(board, {sourceVialIndex: 0, destinationVialIndex: 1}, 4).nextBoard;
  assert.equal(createRunLayoutKey(next), createRunLayoutKey(board));
});
