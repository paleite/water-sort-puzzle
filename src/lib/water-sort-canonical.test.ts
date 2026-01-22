import { describe, expect, it } from "vitest";

import {
  applyPour,
  canPour,
  EMPTY_TOKEN,
  isSolved,
  parsePuzzleJsonToState,
  serializeStateToPuzzleJson,
  type SlotToken,
  SOLUTION_40_MOVES,
  solveShortestBfs,
  STARTING_PUZZLE_JSON,
  UNSOLVABLE_CANDIDATE_PREFIX,
  verifyMoveList,
} from "./water-sort-canonical";

const makeVial = (
  a: SlotToken,
  b: SlotToken,
  c: SlotToken,
  d: SlotToken,
): [SlotToken, SlotToken, SlotToken, SlotToken] => [a, b, c, d];

describe("water-sort-canonical", () => {
  it("parses and serializes the starting puzzle", () => {
    const state = parsePuzzleJsonToState(STARTING_PUZZLE_JSON);
    const serialized = serializeStateToPuzzleJson(state);
    expect(serialized).toEqual(STARTING_PUZZLE_JSON);
  });

  it("rejects non-4 capacity puzzles", () => {
    expect(() =>
      parsePuzzleJsonToState({
        capacity: 3,
        empty_token: "EMPTY",
        vials: [["EMPTY", "EMPTY", "EMPTY"]],
      }),
    ).toThrow("Only capacity=4 is supported");
  });

  it("applies maximal pours", () => {
    const state = [
      makeVial("EMPTY", "red", "red", "red"),
      makeVial("EMPTY", "EMPTY", "light_blue", "light_blue"),
      makeVial("EMPTY", "EMPTY", "EMPTY", "EMPTY"),
    ] as const;

    expect(canPour(state, 0, 2)).toBe(true);

    const next = applyPour(state, 0, 2);

    expect(next[0]).toEqual(makeVial("EMPTY", "EMPTY", "EMPTY", "EMPTY"));
    expect(next[2]).toEqual(makeVial("EMPTY", "red", "red", "red"));
  });

  it("detects solved and unsolved states", () => {
    const solvedState = [
      makeVial("red", "red", "red", "red"),
      makeVial("EMPTY", "EMPTY", "EMPTY", "EMPTY"),
    ] as const;

    const unsolvedState = [
      makeVial("EMPTY", "red", "red", "light_blue"),
      makeVial("EMPTY", "EMPTY", "EMPTY", "EMPTY"),
    ] as const;

    expect(isSolved(solvedState)).toBe(true);
    expect(isSolved(unsolvedState)).toBe(false);
  });

  it("verifies the provided 40-move solution", () => {
    const state = parsePuzzleJsonToState(STARTING_PUZZLE_JSON);
    const result = verifyMoveList(state, SOLUTION_40_MOVES);

    expect(result.ok).toBe(true);
  });

  it("rejects the unsolvable candidate prefix at step 1", () => {
    const state = parsePuzzleJsonToState(STARTING_PUZZLE_JSON);
    const result = verifyMoveList(state, UNSOLVABLE_CANDIDATE_PREFIX);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedAtStepIndex).toBe(1);
    }
  });

  it("returns an empty solution when already solved", () => {
    const solvedState = [
      makeVial("red", "red", "red", "red"),
      makeVial(EMPTY_TOKEN, EMPTY_TOKEN, EMPTY_TOKEN, EMPTY_TOKEN),
    ] as const;

    const result = solveShortestBfs(solvedState);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.moveCount).toBe(0);
      expect(result.moves).toEqual([]);
    }
  });

  it("finds the shortest path on a one-move puzzle", () => {
    const state = [
      makeVial("red", "red", "red", "red"),
      makeVial("EMPTY", "EMPTY", "light_blue", "light_blue"),
      makeVial("EMPTY", "EMPTY", "EMPTY", "EMPTY"),
      makeVial("EMPTY", "EMPTY", "light_blue", "light_blue"),
    ] as const;

    const result = solveShortestBfs(state);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.moveCount).toBe(1);
      const verification = verifyMoveList(state, result.moves);
      expect(verification.ok).toBe(true);
    }
  });
});
