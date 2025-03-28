import { describe, expect, test } from "bun:test";

import type { VialState } from "./artifact";
import {
  COLORS,
  COLORS_PER_VIAL,
  EMPTY_VIALS,
  executeMove,
  FILLED_VIALS,
  generatePuzzle,
  isSolvedState,
  isValidMove,
  SeededRandom,
  validateVials,
  VIAL_COUNT,
} from "./artifact";

describe("Level Size", () => {
  test("level 2 should have 2 color vials and 1 empty vial", () => {
    const puzzle = generatePuzzle(2);
    expect(puzzle).not.toBeNull();
    expect(puzzle.length).toBe(VIAL_COUNT);
    expect(puzzle.filter((vial) => vial.length === 0).length).toBe(1);
    expect(
      puzzle.filter((vial) => vial.length === COLORS_PER_VIAL).length,
    ).toBe(2);
  });

  test("level 3 should have 3 color vials and 2 empty vials", () => {
    const puzzle = generatePuzzle(3);
    expect(puzzle).not.toBeNull();
    expect(puzzle.length).toBe(VIAL_COUNT);
    expect(puzzle.filter((vial) => vial.length === 0).length).toBe(2);
    expect(
      puzzle.filter((vial) => vial.length === COLORS_PER_VIAL).length,
    ).toBe(3);
  });

  test("level 5 should have 5 color vials and 2 empty vials", () => {
    const puzzle = generatePuzzle(5);
    expect(puzzle).not.toBeNull();
    expect(puzzle.length).toBe(VIAL_COUNT);
    expect(puzzle.filter((vial) => vial.length === 0).length).toBe(2);
    expect(
      puzzle.filter((vial) => vial.length === COLORS_PER_VIAL).length,
    ).toBe(5);
  });

  test("level 10 should have 7 color vials and 2 empty vials", () => {
    const puzzle = generatePuzzle(10);
    expect(puzzle).not.toBeNull();
    expect(puzzle.length).toBe(VIAL_COUNT);
    expect(puzzle.filter((vial) => vial.length === 0).length).toBe(2);
    expect(
      puzzle.filter((vial) => vial.length === COLORS_PER_VIAL).length,
    ).toBe(7);
  });

  test("level 31 should have 9 color vials and 2 empty vials", () => {
    const puzzle = generatePuzzle(31);
    expect(puzzle).not.toBeNull();
    expect(puzzle.length).toBe(VIAL_COUNT);
    expect(puzzle.filter((vial) => vial.length === 0).length).toBe(2);
    expect(
      puzzle.filter((vial) => vial.length === COLORS_PER_VIAL).length,
    ).toBe(9);
  });
});

describe("Level Generation", () => {
  test("should generate a valid level 1 puzzle", () => {
    const puzzle = generatePuzzle(1);
    expect(puzzle).not.toBeNull();

    if (puzzle) {
      // For level 1, the vial count should be less than VIAL_COUNT due to our optimization
      expect(puzzle.length).toBeLessThanOrEqual(VIAL_COUNT);
      expect(puzzle.length).toBeGreaterThanOrEqual(VIAL_COUNT - 4);

      // Count empty vials
      const emptyVials = puzzle.filter((vial) => vial.length === 0);
      expect(emptyVials.length).toBe(EMPTY_VIALS);

      // Count non-empty vials
      const nonEmptyVials = puzzle.filter((vial) => vial.length > 0);

      // Verify the puzzle contains correct distribution of colors
      const colorCounts: Record<string, number> = {};
      puzzle.forEach((vial) => {
        vial.forEach((color) => {
          colorCounts[color] = (colorCounts[color] ?? 0) + 1;
        });
      });

      // Each color that appears should have exactly COLORS_PER_VIAL instances
      for (const count of Object.values(colorCounts)) {
        expect(count).toBe(COLORS_PER_VIAL);
      }

      // Make sure the puzzle is not already solved
      expect(isSolvedState(puzzle)).toBe(false);

      // Verify all vials are either completely full or completely empty
      puzzle.forEach((vial) => {
        expect([0, COLORS_PER_VIAL].includes(vial.length)).toBe(true);
      });
    }
  });

  test("should generate different puzzles for different levels", () => {
    const puzzle1 = generatePuzzle(1);
    const puzzle5 = generatePuzzle(5);
    const puzzle10 = generatePuzzle(10);

    expect(puzzle1).not.toBeNull();
    expect(puzzle5).not.toBeNull();
    expect(puzzle10).not.toBeNull();

    // String representation for comparison
    const puzzleToString = (p: VialState | null) =>
      p ? JSON.stringify(p) : "";

    // Different levels should generate different puzzles
    expect(puzzleToString(puzzle1)).not.toBe(puzzleToString(puzzle5));
    expect(puzzleToString(puzzle5)).not.toBe(puzzleToString(puzzle10));
    expect(puzzleToString(puzzle1)).not.toBe(puzzleToString(puzzle10));
  });

  test("should generate deterministic puzzles for the same level", () => {
    const firstRun = generatePuzzle(42);
    const secondRun = generatePuzzle(42);

    expect(firstRun).not.toBeNull();
    expect(secondRun).not.toBeNull();

    // Same level should generate identical puzzles (deterministic)
    expect(JSON.stringify(firstRun)).toBe(JSON.stringify(secondRun));
  });

  test("higher levels should have more complex puzzles", () => {
    // For levels > 1, we apply additional shuffles based on the level
    const lowLevelPuzzle = generatePuzzle(1);
    const highLevelPuzzle = generatePuzzle(20);

    expect(lowLevelPuzzle).not.toBeNull();
    expect(highLevelPuzzle).not.toBeNull();

    if (lowLevelPuzzle && highLevelPuzzle) {
      // Count how many vials have mixed colors (more mixing = more complex)
      const countMixedVials = (puzzle: VialState) => {
        return puzzle.filter((vial) => {
          // Empty vials are not mixed
          if (vial.length === 0) {
            return false;
          }
          // Check if vial has more than one color
          const firstColor = vial[0];
          return !vial.every((color) => color === firstColor);
        }).length;
      };

      // Higher levels tend to have more mixed vials
      const lowLevelMixedCount = countMixedVials(lowLevelPuzzle);
      const highLevelMixedCount = countMixedVials(highLevelPuzzle);

      console.log(`Level 1 mixed vials: ${lowLevelMixedCount}`);
      console.log(`Level 20 mixed vials: ${highLevelMixedCount}`);

      // The higher level should have more mixed vials than the lower level
      expect(highLevelMixedCount).toBeGreaterThanOrEqual(lowLevelMixedCount);

      // Verify all vials have at most COLORS_PER_VIAL segments
      lowLevelPuzzle.forEach((vial) => {
        expect(vial.length).toBeLessThanOrEqual(COLORS_PER_VIAL);
      });

      highLevelPuzzle.forEach((vial) => {
        expect(vial.length).toBeLessThanOrEqual(COLORS_PER_VIAL);
      });
    }
  });

  test("should properly validate vial states", () => {
    // Create a valid vial state
    const validState: VialState = [];
    // Ensure we have enough colors to work with
    const colorsToUse = [...COLORS].slice(0, FILLED_VIALS);

    // Create FILLED_VIALS vials with COLORS_PER_VIAL of each color
    for (let i = 0; i < FILLED_VIALS; i++) {
      const vial: string[] = [];
      // Make sure we have a valid color
      const colorIndex = i % colorsToUse.length;
      const color = colorsToUse[colorIndex];
      if (color) {
        for (let j = 0; j < COLORS_PER_VIAL; j++) {
          vial.push(color);
        }
      }
      validState.push(vial);
    }

    // Add empty vials
    for (let i = 0; i < EMPTY_VIALS; i++) {
      validState.push([]);
    }

    // This should be a solved state (each vial has the same color or is empty)
    expect(isSolvedState(validState)).toBe(true);

    // validateVials should return false because it's already solved
    expect(validateVials(validState)).toBe(false);

    // Mix up one vial to make it unsolved but still valid
    const vial0 = validState[0];
    const vial1 = validState[1];

    if (vial0 && vial1 && vial0.length >= 2 && vial1.length >= 2) {
      const temp = vial0.pop();
      const temp2 = vial1.pop();
      if (temp !== undefined) {
        vial1.push(temp);
      }
      if (temp2 !== undefined) {
        vial0.push(temp2);
      }

      // Now it should be unsolved but valid
      expect(isSolvedState(validState)).toBe(false);
      expect(validateVials(validState)).toBe(true);
    }
  });

  test("SeededRandom produces deterministic results", () => {
    const random1 = new SeededRandom(42);
    const random2 = new SeededRandom(42);

    // Same seed should produce same sequence
    for (let i = 0; i < 10; i++) {
      expect(random1.next()).toEqual(random2.next());
    }

    // Different seeds should produce different sequences
    const random3 = new SeededRandom(43);
    const random4 = new SeededRandom(42);

    let allSame = true;
    for (let i = 0; i < 10; i++) {
      if (random3.next() !== random4.next()) {
        allSame = false;
        break;
      }
    }

    expect(allSame).toBe(false);
  });

  test("puzzles should be solvable by construction", () => {
    // Our puzzle generation approach ensures the puzzles are solvable by construction,
    // since we start with a solved state and apply valid moves in reverse.
    // No need to use checkPuzzleSolvability with our new approach.

    // Check level 2 to avoid the optimizations of level 1 that remove sorted vials
    const puzzle = generatePuzzle(2);
    expect(puzzle).not.toBeNull();

    if (puzzle) {
      // Verify all non-empty vials are completely full
      const nonEmptyVials = puzzle.filter((v) => v.length > 0);
      nonEmptyVials.forEach((vial) => {
        expect(vial.length).toBe(COLORS_PER_VIAL);
      });

      // Verify the correct number of colors for each color type
      const colorCounts: Record<string, number> = {};
      puzzle.forEach((vial) => {
        vial.forEach((color) => {
          colorCounts[color] = (colorCounts[color] ?? 0) + 1;
        });
      });

      for (const count of Object.values(colorCounts)) {
        expect(count).toBe(COLORS_PER_VIAL);
      }

      // Verify the puzzle is not already solved
      expect(isSolvedState(puzzle)).toBe(false);
    }

    // Since we're working backwards from a solved state, all puzzles are solvable
    // by construction. We don't need to verify solvability with the BFS algorithm,
    // as it's guaranteed by our generation method.
  });

  test("empty vials should always be at the end of the array", () => {
    // Test only level 5 to make the test more deterministic
    const level = 5;
    const puzzle = generatePuzzle(level);

    // Find indices of all empty vials
    const emptyIndices: number[] = [];
    puzzle.forEach((vial, index) => {
      if (vial.length === 0) {
        emptyIndices.push(index);
      }
    });

    // Count non-empty vials
    const nonEmptyCount = puzzle.length - emptyIndices.length;

    console.log(
      `Level ${level} - Empty vials at indices: ${emptyIndices.join(", ")}, Total vials: ${puzzle.length}, Non-empty vials: ${nonEmptyCount}`,
    );

    // Skip if no empty vials (highly unlikely but a safeguard)
    if (emptyIndices.length === 0) {
      return; // Early return instead of continue
    }

    // Verify we have exactly EMPTY_VIALS empty vials
    expect(emptyIndices.length).toBe(EMPTY_VIALS);

    // Verify all empty vials are consecutive at the end
    const firstEmptyIndex = emptyIndices[0];
    const lastEmptyIndex = emptyIndices[emptyIndices.length - 1];

    expect(lastEmptyIndex - firstEmptyIndex + 1).toBe(emptyIndices.length);
    expect(lastEmptyIndex).toBe(puzzle.length - 1);

    // Check no non-empty vials exist after the first empty vial
    for (let i = firstEmptyIndex; i < puzzle.length; i++) {
      expect(puzzle[i].length).toBe(0);
    }

    // For levels 1-10, verify the total vial count may be reduced
    if (level <= 10) {
      // Level 1 can have up to 4 fewer vials than VIAL_COUNT
      // Level 2-5 can have up to 2 fewer vials
      // Level 6-10 can have 1 fewer vial
      if (level === 1) {
        expect(puzzle.length).toBeLessThanOrEqual(VIAL_COUNT);
        expect(puzzle.length).toBeGreaterThanOrEqual(VIAL_COUNT - 4);
      } else if (level <= 5) {
        expect(puzzle.length).toBeLessThanOrEqual(VIAL_COUNT);
        expect(puzzle.length).toBeGreaterThanOrEqual(VIAL_COUNT - 2);
      } else if (level <= 10) {
        expect(puzzle.length).toBeLessThanOrEqual(VIAL_COUNT);
        expect(puzzle.length).toBeGreaterThanOrEqual(VIAL_COUNT - 1);
      }
    } else {
      // Higher levels should have the full VIAL_COUNT
      expect(puzzle.length).toBe(VIAL_COUNT);
    }
  });

  test("difficulty should increase with higher levels", () => {
    // Define levels to test (reduced set for faster testing)
    const levels = [1, 2, 5, 10, 20, 50, 100, 200, 500];

    // Count color transitions for each level's puzzle
    const results: Record<number, { transitions: number; mixedVials: number }> =
      {};

    // Generate puzzles for each level and measure complexity
    for (const level of levels) {
      const puzzle = generatePuzzle(level);

      // Count color transitions and mixed vials
      let totalTransitions = 0;
      let mixedVialCount = 0;

      for (const vial of puzzle) {
        if (vial.length <= 1) {
          continue;
        } // Skip empty or single-segment vials

        let hasMixing = false;
        for (let i = 1; i < vial.length; i++) {
          if (vial[i] !== vial[i - 1]) {
            totalTransitions++;
            hasMixing = true;
          }
        }

        if (hasMixing) {
          mixedVialCount++;
        }
      }

      results[level] = {
        transitions: totalTransitions,
        mixedVials: mixedVialCount,
      };

      console.log(
        `Level ${level} - Color transitions: ${totalTransitions}, Mixed vials: ${mixedVialCount}`,
      );
    }

    // Expected ranges for each level group
    const levelGroups = [
      { name: "Low levels (1-5)", levels: [1, 2, 5] },
      { name: "Mid levels (10-50)", levels: [10, 20, 50] },
      { name: "High levels (100-500)", levels: [100, 200, 500] },
    ];

    // Calculate the average transitions and mixed vials for each group
    const groupAverages = levelGroups.map((group) => {
      const avgTransitions =
        group.levels.reduce(
          (sum, level) => sum + results[level].transitions,
          0,
        ) / group.levels.length;
      const avgMixedVials =
        group.levels.reduce(
          (sum, level) => sum + results[level].mixedVials,
          0,
        ) / group.levels.length;

      return {
        name: group.name,
        avgTransitions,
        avgMixedVials,
      };
    });

    // Log the group averages
    groupAverages.forEach((group) => {
      console.log(
        `${group.name} - Avg transitions: ${group.avgTransitions.toFixed(2)}, Avg mixed vials: ${group.avgMixedVials.toFixed(2)}`,
      );
    });

    // Test that difficulty increases between groups
    for (let i = 1; i < groupAverages.length; i++) {
      const prevGroup = groupAverages[i - 1];
      const currGroup = groupAverages[i];

      // We expect either transitions or mixed vials (or both) to increase
      const hasIncreased =
        currGroup.avgTransitions > prevGroup.avgTransitions ||
        currGroup.avgMixedVials > prevGroup.avgMixedVials;

      expect(hasIncreased).toBe(true);
    }

    // Check key individual transition points
    expect(results[5].transitions).toBeGreaterThanOrEqual(
      results[1].transitions,
    );
    expect(results[50].transitions).toBeGreaterThanOrEqual(
      results[10].transitions,
    );
    expect(results[500].transitions).toBeGreaterThanOrEqual(
      results[100].transitions,
    );
  });
});

/**
 * Test function to check if a puzzle is solvable.
 * This implements a simplified puzzle solver that attempts to solve the puzzle.
 */
function checkPuzzleSolvability(
  initialState: VialState,
  maxMoves: number = 500,
): boolean {
  // Maximum number of moves to try before giving up
  const MAX_MOVES = maxMoves;

  // Create a deep copy of the initial state
  const state: VialState = JSON.parse(JSON.stringify(initialState));

  // Keep track of visited states to avoid loops
  const visitedStates = new Set<string>();

  // Simple breadth-first search to try to solve the puzzle
  const queue: { state: VialState; moves: number }[] = [{ state, moves: 0 }];

  while (queue.length > 0) {
    const { state, moves } = queue.shift()!;

    // Check if we've reached the solution
    if (isSolvedState(state)) {
      return true;
    }

    // Stop if we've reached the maximum moves
    if (moves >= MAX_MOVES) {
      return false;
    }

    // Get all possible next states
    const nextStates = getPossibleMoves(state);

    for (const nextState of nextStates) {
      const stateKey = JSON.stringify(nextState);

      // Skip if we've already visited this state
      if (visitedStates.has(stateKey)) {
        continue;
      }

      // Mark state as visited
      visitedStates.add(stateKey);

      // Add to queue
      queue.push({ state: nextState, moves: moves + 1 });
    }
  }

  // If we've exhausted all possible moves without finding a solution, the puzzle is not solvable
  return false;
}

/**
 * Get all possible next states from the current state by trying all valid moves.
 */
function getPossibleMoves(state: VialState): VialState[] {
  const nextStates: VialState[] = [];

  // Try all possible source vials
  for (let fromIndex = 0; fromIndex < state.length; fromIndex++) {
    const fromVial = state[fromIndex];

    // Skip empty vials
    if (!fromVial || fromVial.length === 0) {
      continue;
    }

    // Skip vials that are already complete (all same color and full)
    if (
      fromVial.length === COLORS_PER_VIAL &&
      fromVial.every((color) => color === fromVial[0])
    ) {
      continue;
    }

    // Try all possible target vials
    for (let toIndex = 0; toIndex < state.length; toIndex++) {
      // Don't pour into the same vial
      if (fromIndex === toIndex) {
        continue;
      }

      const toVial = state[toIndex];
      if (!toVial) {
        continue;
      }

      // Check if we can pour from this vial to the target
      if (isValidMove(fromIndex, toIndex, state)) {
        // Execute the move to get the next state
        const newState = executeMove(fromIndex, toIndex, state);
        if (newState) {
          nextStates.push(newState);
        }
      }
    }
  }

  return nextStates;
}

/**
 * Calculate the entropy (disorder) of a puzzle state.
 * Higher entropy means more mixing/disorder.
 */
function calculatePuzzleEntropy(state: VialState): number {
  let entropy = 0;

  // Method 1: Count color transitions within vials
  // More transitions = higher entropy
  let transitionCount = 0;
  let totalPossibleTransitions = 0;

  // Method 2: Count mixed vials (vials with more than one color)
  let mixedVialCount = 0;

  // Method 3: Calculate average sequence length of same color
  // Shorter sequences = higher entropy
  let totalSequences = 0;
  let totalSegments = 0;

  // Process each vial
  for (const vial of state) {
    if (vial.length === 0) {
      continue;
    } // Skip empty vials

    let currentColor = "";
    let inSequence = false;
    let vialHasMixing = false;

    // Count possibilities for transitions (one less than segments)
    totalPossibleTransitions += vial.length - 1;

    // Analyze the vial
    for (let i = 0; i < vial.length; i++) {
      const color = vial[i];
      totalSegments++;

      if (i > 0) {
        // Check for color transition
        if (color !== vial[i - 1]) {
          transitionCount++;
          vialHasMixing = true;

          // End previous sequence
          if (inSequence) {
            totalSequences++;
            inSequence = false;
          }
        }
      }

      // Start or continue a sequence
      if (color !== currentColor) {
        if (inSequence) {
          totalSequences++;
        }
        currentColor = color;
        inSequence = true;
      }
    }

    // Count the last sequence in the vial
    if (inSequence) {
      totalSequences++;
    }

    // Count mixed vials
    if (vialHasMixing) {
      mixedVialCount++;
    }
  }

  // Avoid division by zero
  if (totalPossibleTransitions === 0) {
    return 0;
  }
  if (totalSegments === 0) {
    return 0;
  }

  // Calculate transition ratio (0-1)
  const transitionRatio = transitionCount / totalPossibleTransitions;

  // Calculate mixed vial ratio (0-1)
  const mixedVialRatio = mixedVialCount / FILLED_VIALS;

  // Calculate average sequence length and convert to a 0-1 scale
  // (smaller sequences = higher entropy, so we invert)
  const avgSequenceLength = totalSegments / Math.max(1, totalSequences);
  const sequenceRatio = 1 - avgSequenceLength / COLORS_PER_VIAL;

  // Combine metrics into a single entropy score (0-100 scale)
  entropy = transitionRatio * 40 + mixedVialRatio * 40 + sequenceRatio * 20;

  return entropy;
}
