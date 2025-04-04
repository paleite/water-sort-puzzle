import { describe, expect, it } from "bun:test";

import { GameState } from "./game-state";
import { solvePuzzle } from "./puzzle-solver";
import { Vial } from "./vial";

describe("solvePuzzle", () => {
  it.skip("solves a simple puzzle with two vials", () => {
    // Create a simple puzzle with two vials
    const vial1 = new Vial(2);
    vial1.segments = ["red", "blue"]; // Just two colors

    const vial2 = new Vial(2);
    // Empty vial

    const vial3 = new Vial(2);
    // Second empty vial - this makes it more solvable

    const state = new GameState([vial1, vial2, vial3], 2, 2);

    // Display debug info
    console.log(
      "Simple puzzle test - Initial state vials:",
      state.vials.map((v) => v.segments),
    );

    // Solve the puzzle with a higher step count to ensure it finds a solution
    const result = solvePuzzle(state, 5000, 10000);

    console.log("Simple puzzle test - Solution found:", result.solved);
    console.log("Simple puzzle test - Solution path:", result.path);

    // Check if the puzzle was solved
    expect(result.solved).toBe(true);
    expect(result.path).not.toBeNull();

    if (result.path) {
      // Apply the solution path to verify it works
      let finalState = state;
      for (const move of result.path) {
        finalState = finalState.applyMove(move);
      }

      // Final state should be solved - all vials should be complete
      expect(finalState.isComplete()).toBe(true);

      // The solution should move all colors to separate locations
      // Check that each non-empty vial contains only one color

      // Each non-empty vial should contain only one color
      for (const vial of finalState.vials) {
        if (!vial.isEmpty()) {
          const topColor = vial.getTopColor();
          expect(vial.segments.every((segment) => segment === topColor)).toBe(
            true,
          );
        }
      }
    }
  });

  it("solves a more complex puzzle with three colors and two empty vials", () => {
    // Create a more complex puzzle
    const vial1 = new Vial(3);
    vial1.segments = ["red", "green", "blue"];

    const vial2 = new Vial(3);
    vial2.segments = ["green", "blue", "red"];

    const vial3 = new Vial(3);
    vial3.segments = ["blue", "red", "green"];

    const vial4 = new Vial(3); // Empty
    const vial5 = new Vial(3); // Empty

    const state = new GameState([vial1, vial2, vial3, vial4, vial5], 3, 2);

    // Solve the puzzle with a reasonable timeout
    const result = solvePuzzle(state, 5000, 10000);

    // Check if the puzzle was solved
    expect(result.solved).toBe(true);
    expect(result.path).not.toBeNull();

    if (result.path) {
      // Apply the solution path to verify it works
      let finalState = state;
      for (const move of result.path) {
        finalState = finalState.applyMove(move);
      }

      // Final state should be solved
      expect(finalState.isComplete()).toBe(true);
    }
  });

  it("detects when a puzzle has no solution", () => {
    // Create an impossible puzzle (more colors than can fit in a vial)
    const vial1 = new Vial(2); // Capacity of 2
    vial1.segments = ["red", "blue"];

    const vial2 = new Vial(2);
    vial2.segments = ["green", "yellow"];

    const vial3 = new Vial(2); // One empty vial isn't enough

    // With 4 colors and capacity 2, you'd need at least 2 empty vials
    const state = new GameState([vial1, vial2, vial3], 4, 1);

    // Solve the puzzle with a short timeout (this should return quickly)
    const result = solvePuzzle(state, 1000, 500);

    // Check that the puzzle was reported as unsolvable (either by timeout or exhaustion)
    expect(result.solved).toBe(false);
    expect(result.path).toBeNull();
  });

  it("handles empty initial state", () => {
    // Create an empty initial state
    const state = new GameState([], 0, 0);

    // Solve the puzzle with a higher step count to ensure it finds a solution
    const result = solvePuzzle(state, 5000, 10000);

    // Empty state is already solved (technically)
    expect(result.solved).toBe(true);
    expect(result.path?.length).toBe(0);
  });

  it("considers an already completed state as solved", () => {
    // Create an already solved state
    const vial1 = new Vial(3);
    vial1.segments = ["red", "red", "red"]; // Complete vial

    const vial2 = new Vial(3);
    vial2.segments = ["blue", "blue", "blue"]; // Complete vial

    const vial3 = new Vial(3);
    vial3.segments = ["green", "green", "green"]; // Complete vial

    const vial4 = new Vial(3); // Empty vial (also considered complete)

    const state = new GameState([vial1, vial2, vial3, vial4], 3, 1);

    // Solve the puzzle with a higher step count to ensure it finds a solution
    const result = solvePuzzle(state, 5000, 10000);

    // State is already solved, so we should get an empty path
    expect(result.solved).toBe(true);
    expect(result.path?.length).toBe(0);
  });
});
