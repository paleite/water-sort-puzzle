import assert from "node:assert/strict";
import test from "node:test";

import { createCanonicalBoardKey } from "../domain/board";
import { applyMove } from "../domain/moves";
import type { Board } from "../domain/types";
import { mergeHintPath, resolveHintMove } from "./hint-policy";
import { searchForHintPath } from "./hint-search";

test("canonical hint transitions survive vial permutations", () => {
  const board: Board = [["coral"], ["coral"], [], []];
  const move = {sourceVialIndex: 0, destinationVialIndex: 1};
  const nextBoard = applyMove(board, move, 4).nextBoard;
  const permuted: Board = [[], ["coral"], [], ["coral"]];

  const resolved = resolveHintMove(permuted, 4, createCanonicalBoardKey(nextBoard));
  assert.notEqual(resolved, null);
  assert.equal(
    createCanonicalBoardKey(applyMove(permuted, resolved!, 4).nextBoard),
    createCanonicalBoardKey(nextBoard),
  );
});

test("merging a path creates canonical next-state policy entries", () => {
  const first: Board = [["coral"], ["coral"], [], []];
  const second = applyMove(first, {sourceVialIndex: 0, destinationVialIndex: 1}, 4).nextBoard;
  const policy = new Map<string, string>();
  mergeHintPath(policy, [first, second]);
  assert.equal(policy.get(createCanonicalBoardKey(first)), createCanonicalBoardKey(second));
});

test("hint search can join an existing canonical policy state", () => {
  const board: Board = [["coral"], ["coral"], [], []];
  const joined = applyMove(board, {sourceVialIndex: 0, destinationVialIndex: 1}, 4).nextBoard;
  const outcome = searchForHintPath(board, 4, new Set([createCanonicalBoardKey(joined)]), 100);
  assert.equal(outcome.status, "found");
  if (outcome.status === "found") assert.equal(outcome.moves.length, 1);
});
