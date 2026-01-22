/**
 * Water Sort Puzzle Random Level Generator with Solution Verification
 *
 * This script generates randomized but solvable puzzle levels using a
 * seeded random generator and a breadth-first search (BFS) solver.
 */

import fs from "fs";
import { glob } from "glob";
import path from "path";

import { GameState } from "../src/lib/game-state";
import { solvePuzzle } from "../src/lib/puzzle-solver";
import {
  addEmptyVials,
  createInitialState,
  evaluateLevel,
  hasDesirableProperties,
  randomizeVials,
} from "../src/lib/puzzle-utils";
import { SeededRandom } from "../src/lib/seeded-random";
import type { Move } from "../src/lib/types/puzzle-types";
import { Vial } from "../src/lib/vial";

function assertDefined<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new TypeError(message);
  }
  return value;
}

/**
 * Generate a random level and verify its solvability with BFS
 */
function generateRandomLevelCandidate(
  seed: number | string,
  colorCount: number,
  vialHeight: number,
  maxEmptyVials: number = 2,
  timeoutMs: number = 5000,
  maxSteps: number = 50000, // Much higher max steps to allow more thorough search
): {
  state: GameState;
  solutionMoves: Move[] | null;
  emptyVials: number;
  metrics: any | null;
} {
  // Initialize a random number generator with the provided seed
  const rng = new SeededRandom(seed);

  // Create a solved state with colorCount vials, each containing a unique color
  const initialState = createInitialState(colorCount, vialHeight, 0);

  // Randomize only the filled vials (not changing empty vial positions)
  const randomizedState = randomizeVials(initialState, rng);

  // Start with just 1 empty vial
  let currentEmptyVials = 1;
  let solutionResult = null;
  let stateWithEmptyVials: GameState | undefined;

  console.log(
    `Trying to generate level with seed: ${seed}, colors: ${colorCount}`,
  );

  // Try solving with incrementally more empty vials until we find a solution
  // or reach the maximum allowed empty vials
  while (currentEmptyVials <= maxEmptyVials && !solutionResult?.solved) {
    console.log(`Attempting solution with ${currentEmptyVials} empty vials...`);

    // Add empty vials to the randomized state
    stateWithEmptyVials = addEmptyVials(randomizedState, currentEmptyVials);

    // Attempt to solve the puzzle with increased max steps
    solutionResult = solvePuzzle(stateWithEmptyVials, timeoutMs, maxSteps);

    if (solutionResult.timedOut) {
      console.log(`Solver timed out with ${currentEmptyVials} empty vials.`);
    } else if (solutionResult.solved) {
      console.log(
        `Found solution with ${currentEmptyVials} empty vials. Solution length: ${solutionResult.path!.length} moves.`,
      );
      break;
    } else {
      console.log(`No solution found with ${currentEmptyVials} empty vials.`);
    }

    // If no solution, try with one more empty vial
    currentEmptyVials++;
  }

  let metrics = null;

  // Calculate metrics if we found a solution
  if (solutionResult && solutionResult.solved && solutionResult.path) {
    const solvedState = assertDefined(
      stateWithEmptyVials,
      "Expected state with empty vials when computing metrics.",
    );
    metrics = evaluateLevel(solvedState, solutionResult.path);
    console.log(
      `Level metrics: Entropy: ${metrics.entropy}, Fragmentation: ${metrics.fragmentation}, Difficulty: ${metrics.difficulty}`,
    );
  }

  // Return the state, solution, and number of empty vials used
  const finalState = assertDefined(
    stateWithEmptyVials,
    "Expected state with empty vials to be generated.",
  );
  return {
    state: finalState,
    solutionMoves: solutionResult?.solved ? solutionResult.path : null,
    emptyVials: currentEmptyVials,
    metrics,
  };
}

/**
 * Generate multiple levels and select the best one
 */
function generateBestLevel(
  baseSeed: number | string,
  colorCount: number,
  vialHeight: number,
  maxEmptyVials: number = 2,
  attempts: number = 10,
  timeoutMs: number = 5000,
): {
  state: GameState;
  solutionMoves: Move[];
  metrics: any;
  emptyVials: number;
} | null {
  const candidates = [];

  console.log(`Generating ${attempts} candidate levels...`);

  // Generate multiple candidate levels
  for (let i = 0; i < attempts; i++) {
    // Derive a new seed for each attempt
    const seed = `${baseSeed}-${i}`;

    // Generate a random level
    const result = generateRandomLevelCandidate(
      seed,
      colorCount,
      vialHeight,
      maxEmptyVials,
      timeoutMs,
    );

    // If a valid solution was found, evaluate the level
    if (result.solutionMoves && result.metrics) {
      // Store the candidate if it meets our criteria
      if (result.metrics.isValid && hasDesirableProperties(result.state)) {
        candidates.push({
          state: result.state,
          solutionMoves: result.solutionMoves,
          metrics: result.metrics,
          emptyVials: result.emptyVials,
        });

        console.log(`✅ Candidate ${i + 1} is valid and desirable.`);
      } else {
        console.log(
          `❌ Candidate ${i + 1} has a solution but doesn't meet quality criteria.`,
        );
      }
    } else {
      console.log(
        `❌ Candidate ${i + 1} has no solution within the constraints.`,
      );
    }
  }

  console.log(`Found ${candidates.length} valid candidates.`);

  if (candidates.length === 0) {
    return null;
  }

  // Sort candidates by difficulty (higher is better)
  candidates.sort((a, b) => b.metrics.difficulty - a.metrics.difficulty);

  const bestCandidate = assertDefined(
    candidates[0],
    "Expected at least one candidate after sorting.",
  );
  console.log(`Best candidate difficulty: ${bestCandidate.metrics.difficulty}`);

  // Return the best candidate
  return bestCandidate;
}

/**
 * Serialize level to JSON format
 */
function serializeLevel(
  state: GameState,
  solutionMoves: Move[],
  metrics: any,
): string {
  // For a random generator, the "initial" state would be the solved state
  // which we can derive by applying the solution moves in reverse

  // Create a fully sorted state based on unique colors in the current state
  const colorSet = new Set<string>();
  for (const vial of state.vials) {
    for (const segment of vial.segments) {
      colorSet.add(segment);
    }
  }

  // Create the sorted state with one vial per color
  const sortedVials: Vial[] = [];
  const firstVial = assertDefined(
    state.vials[0],
    "Expected at least one vial in state.",
  );
  const vialHeight = firstVial.capacity;

  // Add one sorted vial per color
  for (const color of colorSet) {
    const vial = new Vial(vialHeight);
    // Fill with the same color
    for (let i = 0; i < vialHeight; i++) {
      vial.segments.push(color);
    }
    sortedVials.push(vial);
  }

  // Add empty vials
  for (let i = 0; i < state.emptyVialCount; i++) {
    sortedVials.push(new Vial(vialHeight));
  }

  const sortedState = new GameState(
    sortedVials,
    colorSet.size,
    state.emptyVialCount,
  );

  // Convert state to JSON format
  const levelData = {
    // Initial state (the solved state)
    initialState: {
      vials: sortedState.vials.map((vial) => ({
        segments: vial.segments,
      })),
      colorCount: colorSet.size,
      emptyVialCount: state.emptyVialCount,
    },

    // Shuffled state (the randomly generated state that we verified is solvable)
    shuffledState: {
      vials: state.vials.map((vial) => ({
        segments: vial.segments,
      })),
    },

    // Solution path
    solutionMoves: solutionMoves.map((move) => ({
      source: move.sourceVialIndex,
      target: move.targetVialIndex,
      amount: move.colorsToPour,
    })),

    // Metadata
    metadata: {
      vialCapacity: assertDefined(
        state.vials[0],
        "Expected at least one vial in state.",
      ).capacity,
      totalVials: state.totalVials,
      difficulty: metrics.difficulty,
      entropy: metrics.entropy,
      fragmentation: metrics.fragmentation,
      estimatedSolutionSteps: solutionMoves.length,
      generationMethod: "random-with-bfs-solver",
    },
  };

  return JSON.stringify(levelData, null, 2);
}

/**
 * Generate a new level filename with incremented number
 */
function generateLevelFilename(): string {
  // Find existing level files
  const existingLevels = glob.sync("levels/level-*.json");

  // Extract numbers from filenames
  const levelNumbers = existingLevels.map((filename: string) => {
    const match = filename.match(/level-(\d+)\.json/);
    if (!match?.[1]) {
      return 0;
    }
    return parseInt(match[1], 10);
  });

  // Find the highest number
  const highestNumber = levelNumbers.length > 0 ? Math.max(...levelNumbers) : 0;

  // Generate new filename with incremented number
  return `levels/level-${highestNumber + 1}.json`;
}

/**
 * Main function for the random level generator that supports both direct execution
 * and importing as a module for testing
 */
type RandomLevelGeneratorOptions = {
  seed: number | string;
  colorCount: number;
  vialHeight: number;
  maxEmptyVials: number;
  attempts: number;
  timeoutMs: number;
  outputPath?: string;
};

export default function generateRandomLevel(
  options: RandomLevelGeneratorOptions,
): string | null {
  const {
    seed = Date.now(),
    colorCount = 4,
    vialHeight = 3,
    maxEmptyVials = 2,
    attempts = 2,
    timeoutMs = 30000,
    outputPath,
  } = options;

  // Use the specified output path or generate one
  const levelPath = outputPath || generateLevelFilename();

  // Ensure output directory exists
  const dir = path.dirname(levelPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log(`Starting level generation with seed: ${seed}`);
  console.log(
    `Parameters: colors=${colorCount}, height=${vialHeight}, maxEmpty=${maxEmptyVials}`,
  );

  // Generate the best level from multiple attempts
  const result = generateBestLevel(
    seed,
    colorCount,
    vialHeight,
    maxEmptyVials,
    attempts,
    timeoutMs,
  );

  if (!result) {
    console.error("Failed to generate a valid level after multiple attempts");
    return null;
  }

  // Serialize the level to JSON
  const levelJson = serializeLevel(
    result.state,
    result.solutionMoves,
    result.metrics,
  );

  // Save to file
  fs.writeFileSync(levelPath, levelJson);

  console.log(`Generated new level: ${levelPath}`);
  console.log(`- Colors: ${colorCount}`);
  console.log(`- Empty vials: ${result.emptyVials}`);
  console.log(`- Vial height: ${vialHeight}`);
  console.log(`- Difficulty: ${result.metrics.difficulty}`);
  console.log(`- Solution steps: ${result.solutionMoves.length}`);

  return levelPath;
}

// If this module is executed directly (not imported)
if (import.meta.main) {
  // Generate a very simple level (4 colors) with longer timeout
  console.log("Generating very simple level...");
  generateRandomLevel({
    seed: "very-simple-level",
    colorCount: 4,
    vialHeight: 3,
    maxEmptyVials: 2,
    attempts: 2,
    timeoutMs: 60000,
  });

  // Generate a simple level (5 colors) with longer timeout
  console.log("\nGenerating simple level...");
  generateRandomLevel({
    seed: "simple-level",
    colorCount: 5,
    vialHeight: 4,
    maxEmptyVials: 2,
    attempts: 2,
    timeoutMs: 60000,
  });
}
