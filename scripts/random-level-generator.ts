/**
 * Water Sort Puzzle Random Level Generator with Solution Verification
 *
 * This script generates randomized but solvable puzzle levels using a
 * seeded random generator and a breadth-first search (BFS) solver.
 */

import fs from "node:fs";
import path from "node:path";

import { glob } from "glob";

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

function hasSolvedVials(state: GameState): boolean {
  return state.vials.some((vial) => !vial.isEmpty() && vial.isComplete());
}

function breakSolvedVials(state: GameState, rng: SeededRandom): GameState {
  const nextState = state.clone();
  let attempts = 0;
  const maxAttempts = nextState.vials.length * 3;

  while (hasSolvedVials(nextState) && attempts < maxAttempts) {
    const solvedIndex = nextState.vials.findIndex(
      (vial) => !vial.isEmpty() && vial.isFull() && vial.isComplete(),
    );
    if (solvedIndex < 0) {
      break;
    }

    const solvedVial = assertDefined(
      nextState.vials[solvedIndex],
      `Expected vial at index ${solvedIndex}.`,
    );
    const solvedTop = solvedVial.getTopColor();
    if (!solvedTop) {
      break;
    }

    const candidateIndices = nextState.vials
      .map((vial, index) => ({ vial, index }))
      .filter(
        ({ vial, index }) =>
          index !== solvedIndex &&
          !vial.isEmpty() &&
          vial.getTopColor() !== solvedTop,
      )
      .map(({ index }) => index);

    if (candidateIndices.length === 0) {
      break;
    }

    const partnerIndex =
      candidateIndices[rng.nextInt(0, candidateIndices.length)];
    if (partnerIndex === undefined) {
      break;
    }

    const partnerVial = assertDefined(
      nextState.vials[partnerIndex],
      `Expected vial at index ${partnerIndex}.`,
    );

    const solvedSwap = solvedVial.segments.pop();
    const partnerSwap = partnerVial.segments.pop();
    if (solvedSwap && partnerSwap) {
      solvedVial.segments.push(partnerSwap);
      partnerVial.segments.push(solvedSwap);
    }

    attempts++;
  }

  return nextState;
}

function forceMixSolvedVials(state: GameState): GameState {
  const nextState = state.clone();
  const fullIndices = nextState.vials.flatMap((vial, index) => {
    if (vial.isEmpty() || !vial.isFull()) {
      return [];
    }

    return [index];
  });

  if (fullIndices.length < 2) {
    return nextState;
  }

  const tops = fullIndices.map((index) => {
    const vial = assertDefined(
      nextState.vials[index],
      `Expected vial at index ${index}.`,
    );

    return vial.segments.at(-1);
  });

  if (tops.some((top) => top === undefined)) {
    return nextState;
  }

  for (let i = 0; i < fullIndices.length; i++) {
    const index = assertDefined(
      fullIndices[i],
      `Expected full vial index at position ${i}.`,
    );
    const vial = assertDefined(
      nextState.vials[index],
      `Expected vial at index ${index}.`,
    );
    vial.segments.pop();
    const replacement = tops[(i + 1) % tops.length] ?? vial.segments.at(-1);
    if (replacement) {
      vial.segments.push(replacement);
    }
  }

  return nextState;
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

  if (maxEmptyVials < 2) {
    throw new Error("maxEmptyVials must be at least 2.");
  }

  // Prefer starting at 3 empty vials, but never below 2.
  const trialEmptyVials: number[] = [];
  if (maxEmptyVials >= 3) {
    for (let i = 3; i <= maxEmptyVials; i++) {
      trialEmptyVials.push(i);
    }
  } else {
    trialEmptyVials.push(2);
  }

  if (!trialEmptyVials.includes(2) && maxEmptyVials >= 2) {
    trialEmptyVials.push(2);
  }

  let currentEmptyVials = trialEmptyVials[0] ?? 2;
  let solutionResult = null;
  let stateWithEmptyVials: GameState | undefined;

  console.log(
    `Trying to generate level with seed: ${seed}, colors: ${colorCount}`,
  );

  for (let shuffleAttempt = 0; shuffleAttempt < 5; shuffleAttempt++) {
    let randomizedState = randomizeVials(initialState, rng);
    for (let i = 0; i < 3; i++) {
      if (!hasSolvedVials(randomizedState)) {
        break;
      }
      randomizedState = randomizeVials(initialState, rng);
    }
    randomizedState = breakSolvedVials(randomizedState, rng);
    if (hasSolvedVials(randomizedState)) {
      randomizedState = forceMixSolvedVials(randomizedState);
    }

    currentEmptyVials = trialEmptyVials[0] ?? 2;
    solutionResult = null;

    for (const emptyVials of trialEmptyVials) {
      if (solutionResult?.solved) {
        break;
      }

      currentEmptyVials = emptyVials;
      console.log(
        `Attempting solution with ${currentEmptyVials} empty vials...`,
      );

      stateWithEmptyVials = addEmptyVials(randomizedState, currentEmptyVials);

      if (hasSolvedVials(stateWithEmptyVials)) {
        console.log("Shuffled state contains solved vials, retrying.");
        break;
      }

      solutionResult = solvePuzzle(stateWithEmptyVials, timeoutMs, maxSteps);

      if (solutionResult.timedOut) {
        console.log(`Solver timed out with ${currentEmptyVials} empty vials.`);
      } else if (solutionResult.solved) {
        const moveCount = solutionResult.path?.length ?? 0;
        console.log(
          `Found solution with ${currentEmptyVials} empty vials. Solution length: ${moveCount} moves.`,
        );
        break;
      } else {
        console.log(`No solution found with ${currentEmptyVials} empty vials.`);
      }
    }

    if (solutionResult?.solved) {
      break;
    }
  }

  let metrics = null;

  // Calculate metrics if we found a solution
  if (solutionResult?.solved) {
    const solvedState = assertDefined(
      stateWithEmptyVials,
      "Expected state with empty vials when computing metrics.",
    );
    metrics = evaluateLevel(solvedState, solutionResult.path ?? []);
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
    solutionMoves: solutionResult?.solved ? (solutionResult.path ?? []) : null,
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
  let fallbackCandidate: {
    state: GameState;
    solutionMoves: Move[];
    metrics: any;
    emptyVials: number;
  } | null = null;

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
      fallbackCandidate ??= {
        state: result.state,
        solutionMoves: result.solutionMoves,
        metrics: result.metrics,
        emptyVials: result.emptyVials,
      };

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
    if (fallbackCandidate) {
      console.log("Falling back to first solvable candidate.");

      return fallbackCandidate;
    }

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

    return Number.parseInt(match[1], 10);
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
