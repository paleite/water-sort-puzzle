/**
 * Water Sort Puzzle Level Generator (Reverse-Shuffle Approach)
 *
 * This script generates guaranteed-solvable puzzle configurations through a reverse solving process.
 * It starts from a solved state, applies random moves in reverse, then ensures the level meets quality standards.
 */

import fs from "node:fs";
import path from "node:path";

import { glob } from "glob";

import { GameState } from "../src/lib/game-state";
import { solvePuzzle } from "../src/lib/puzzle-solver";
import type { Color, Move } from "../src/lib/types/puzzle-types";
import { Vial } from "../src/lib/vial";

// Constants
const DEFAULT_VIAL_HEIGHT = 4;
const DEFAULT_EMPTY_VIALS = 2;
const DEFAULT_COLORS = 6;
const DEFAULT_SHUFFLE_MOVES = 25;

function assertDefined<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new TypeError(message);
  }

  return value;
}

/**
 * Uses shared core GameState/Vial logic from src/lib to align with canonical rules.
 */

/**
 * Counts the number of segments of the same color at the top of a vial
 */
function countTopSegmentsOfSameColor(vial: Vial, color: Color): number {
  let count = 0;
  for (let i = vial.segments.length - 1; i >= 0; i--) {
    if (vial.segments[i] === color) {
      count++;
    } else {
      break;
    }
  }

  return count;
}

/**
 * Initializes the generator with a solved state
 */
function initializeGenerator(
  colorCount: number,
  vialHeight: number,
  emptyVials: number,
): GameState {
  const vials: Vial[] = [];

  // Available colors
  const colorPalette = [
    "red",
    "blue",
    "green",
    "yellow",
    "purple",
    "orange",
    "cyan",
    "magenta",
    "lime",
    "pink",
    "brown",
    "teal",
  ];

  // Ensure we have enough colors in our palette
  if (colorCount > colorPalette.length) {
    throw new Error(
      `Not enough colors in palette. Max is ${colorPalette.length}`,
    );
  }

  // Create completely filled vials, each with a unique color
  for (let i = 0; i < colorCount; i++) {
    const vial = new Vial(vialHeight);
    const color = assertDefined(
      colorPalette[i],
      `Expected color palette entry at index ${i}.`,
    );

    // Fill vial with the same color
    for (let j = 0; j < vialHeight; j++) {
      vial.segments.push(color);
    }

    vials.push(vial);
  }

  // Add empty vials
  for (let i = 0; i < emptyVials; i++) {
    vials.push(new Vial(vialHeight));
  }

  return new GameState(vials, colorCount, emptyVials);
}

/**
 * Generates a level by applying reverse moves to a solved state
 */
function generateShuffledLevel(
  initialSolvedState: GameState,
  targetShuffleMoves: number,
): {
  shuffledState: GameState;
  shuffleMoves: Move[];
} {
  const visitedStates = new Set<string>();
  let currentState = initialSolvedState.clone();
  visitedStates.add(currentState.getStateHash());

  const shuffleMoves: Move[] = [];

  while (shuffleMoves.length < targetShuffleMoves) {
    // Get all possible reverse moves from current state
    const reverseMoves = getValidReverseMoves(currentState);

    // Filter moves that would lead to already visited states
    const uniqueReverseMoves = filterToUniqueResultStates(
      reverseMoves,
      currentState,
      visitedStates,
    );

    if (uniqueReverseMoves.length === 0) {
      // No more unique moves possible, break early
      console.log(
        `No more unique moves available after ${shuffleMoves.length} moves`,
      );
      break;
    }

    // Select a move using a heuristic
    const selectedMove = selectOptimalReverseMove(
      uniqueReverseMoves,
      currentState,
    );

    // Apply the move and update current state
    currentState = applyReverseMove(currentState, selectedMove);
    shuffleMoves.push(selectedMove);

    // Add new state to visited states
    visitedStates.add(currentState.getStateHash());
  }

  // Return both the shuffled state and the moves used to create it
  return {
    shuffledState: currentState,
    shuffleMoves,
  };
}

/**
 * Get valid reverse moves from a state
 */
function getValidReverseMoves(state: GameState): Move[] {
  const moves: Move[] = [];

  // For each vial
  for (let i = 0; i < state.totalVials; i++) {
    const sourceVial = assertDefined(
      state.vials[i],
      `Expected source vial at index ${i}.`,
    );

    // Skip empty vials as source
    if (sourceVial.isEmpty()) {
      continue;
    }

    const topColor = sourceVial.getTopColor() as Color;

    // Find all valid target vials
    for (let j = 0; j < state.totalVials; j++) {
      // Skip same vial
      if (i === j) {
        continue;
      }

      const targetVial = assertDefined(
        state.vials[j],
        `Expected target vial at index ${j}.`,
      );

      // Reverse move is valid if:
      // 1. Target is not full
      // 2. Target is either empty or its top color matches the source top color
      if (
        !targetVial.isFull() &&
        (targetVial.isEmpty() || targetVial.getTopColor() === topColor)
      ) {
        // Calculate number of segments of same color at the top of source vial
        const colorsToPour = countTopSegmentsOfSameColor(sourceVial, topColor);

        // Calculate how many can be poured based on target capacity
        const maxPour = Math.min(
          colorsToPour,
          targetVial.capacity - targetVial.segments.length,
        );

        if (maxPour > 0) {
          moves.push({
            sourceVialIndex: i,
            targetVialIndex: j,
            colorsToPour: maxPour,
          });
        }
      }
    }
  }

  return moves;
}

/**
 * Filters moves to only include those that lead to unique states
 */
function filterToUniqueResultStates(
  moves: Move[],
  currentState: GameState,
  visitedStates: Set<string>,
): Move[] {
  return moves.filter((move) => {
    const resultState = applyReverseMove(currentState, move);
    const stateHash = resultState.getStateHash();

    return !visitedStates.has(stateHash);
  });
}

/**
 * Apply a reverse move to a state
 */
function applyReverseMove(state: GameState, move: Move): GameState {
  // Create a deep copy of the state
  const newState = state.clone();

  const sourceVial = assertDefined(
    newState.vials[move.sourceVialIndex],
    `Expected source vial at index ${move.sourceVialIndex}.`,
  );
  const targetVial = assertDefined(
    newState.vials[move.targetVialIndex],
    `Expected target vial at index ${move.targetVialIndex}.`,
  );

  // Get the color to pour
  const colorToPour = sourceVial.getTopColor() as Color;

  // Remove segments from source
  for (let i = 0; i < move.colorsToPour; i++) {
    sourceVial.segments.pop();
  }

  // Add segments to target
  for (let i = 0; i < move.colorsToPour; i++) {
    targetVial.segments.push(colorToPour);
  }

  return newState;
}

/**
 * Selects the optimal reverse move based on heuristics that maximize mixing
 */
function selectOptimalReverseMove(
  moves: Move[],
  currentState: GameState,
): Move {
  // Calculate scores for each move based on heuristics
  const scoredMoves = moves.map((move) => {
    const resultState = currentState.applyMove(move);

    // Base metrics
    const entropy = calculateEntropy(resultState);
    const fragmentation = calculateFragmentation(resultState);

    // Additional mixing metrics
    const breaksSortedVial = evaluateBreaksSortedVial(move, currentState);
    const mixesDifferentColors = evaluateMixesDifferentColors(
      move,
      currentState,
    );
    const distributesColor = evaluateDistributesColor(move, currentState);

    return {
      move,
      entropy,
      fragmentation,
      breaksSortedVial,
      mixesDifferentColors,
      distributesColor,
    };
  });

  // Sort moves by composite score with more weight on mixing metrics
  scoredMoves.sort((a, b) => {
    const scoreA =
      a.entropy * 0.3 +
      a.fragmentation * 0.2 +
      a.breaksSortedVial * 10 +
      a.mixesDifferentColors * 5 +
      a.distributesColor * 5;

    const scoreB =
      b.entropy * 0.3 +
      b.fragmentation * 0.2 +
      b.breaksSortedVial * 10 +
      b.mixesDifferentColors * 5 +
      b.distributesColor * 5;

    return scoreB - scoreA; // Higher score is better
  });

  // Return move with highest score or a random move from the top 3 (adds variability)
  const randomIndex = Math.floor(
    Math.random() * Math.min(3, scoredMoves.length),
  );
  const chosenMove = assertDefined(
    scoredMoves[randomIndex],
    `Expected scored move at index ${randomIndex}.`,
  );

  return chosenMove.move;
}

/**
 * Evaluates whether a move breaks up a sorted vial
 */
function evaluateBreaksSortedVial(move: Move, state: GameState): number {
  const sourceVial = assertDefined(
    state.vials[move.sourceVialIndex],
    `Expected source vial at index ${move.sourceVialIndex}.`,
  );

  // If the source vial has only one color, breaking it up is good
  const colors = new Set(sourceVial.segments);
  if (colors.size === 1 && sourceVial.segments.length > 1) {
    return 1;
  }

  return 0;
}

/**
 * Evaluates whether a move mixes different colors in the target vial
 */
function evaluateMixesDifferentColors(move: Move, state: GameState): number {
  const sourceVial = assertDefined(
    state.vials[move.sourceVialIndex],
    `Expected source vial at index ${move.sourceVialIndex}.`,
  );
  const targetVial = assertDefined(
    state.vials[move.targetVialIndex],
    `Expected target vial at index ${move.targetVialIndex}.`,
  );

  // If target is empty, no mixing occurs
  if (targetVial.isEmpty()) {
    return 0;
  }

  // If source color is different from target's top color, this creates a mix
  const sourceColor = sourceVial.getTopColor();
  const targetColor = targetVial.getTopColor();

  if (sourceColor !== targetColor) {
    return 1;
  }

  return 0;
}

/**
 * Evaluates whether a move distributes a color that's currently concentrated
 */
function evaluateDistributesColor(move: Move, state: GameState): number {
  const sourceVial = assertDefined(
    state.vials[move.sourceVialIndex],
    `Expected source vial at index ${move.sourceVialIndex}.`,
  );
  const color = sourceVial.getTopColor() as Color;

  // Count how many segments of this color are in the source vial
  let colorCount = 0;
  for (const segment of sourceVial.segments) {
    if (segment === color) {
      colorCount++;
    }
  }

  // If this color is concentrated (3+ segments), distributing it is good
  if (colorCount >= 3) {
    return 1;
  }

  return 0;
}

/**
 * Calculate entropy (disorder) in the state
 */
function calculateEntropy(state: GameState): number {
  let entropy = 0;

  // For each vial, count color transitions
  for (const vial of state.vials) {
    if (vial.segments.length <= 1) {
      continue;
    }

    // Count color changes in the vial
    let colorChanges = 0;
    for (let i = 1; i < vial.segments.length; i++) {
      if (vial.segments[i] !== vial.segments[i - 1]) {
        colorChanges++;
      }
    }

    // Weight color changes by position - changes near the bottom are harder to resolve
    let positionWeightedChanges = 0;
    for (let i = 1; i < vial.segments.length; i++) {
      if (vial.segments[i] !== vial.segments[i - 1]) {
        // Weight by position - bottom changes count more (inverse position)
        positionWeightedChanges += i * 0.5;
      }
    }

    entropy += colorChanges + positionWeightedChanges;
  }

  // Additional entropy from distribution of colors
  const colorDistribution = new Map<Color, number>();
  for (const vial of state.vials) {
    const colors = new Set(vial.segments);
    for (const color of colors) {
      colorDistribution.set(color, (colorDistribution.get(color) || 0) + 1);
    }
  }

  // The more vials a color appears in, the higher the entropy
  let distributionEntropy = 0;
  for (const [_, count] of colorDistribution.entries()) {
    if (count > 1) {
      distributionEntropy += (count - 1) * 2;
    }
  }

  return entropy + distributionEntropy;
}

/**
 * Calculate fragmentation (color spread) across vials
 */
function calculateFragmentation(state: GameState): number {
  // Creates a map of color to locations
  const colorLocations = new Map<Color, number[][]>();

  // Populate the map
  for (let vialIndex = 0; vialIndex < state.vials.length; vialIndex++) {
    const vial = assertDefined(
      state.vials[vialIndex],
      `Expected vial at index ${vialIndex}.`,
    );

    for (
      let segmentIndex = 0;
      segmentIndex < vial.segments.length;
      segmentIndex++
    ) {
      const color = assertDefined(
        vial.segments[segmentIndex],
        `Expected segment color in vial ${vialIndex} at index ${segmentIndex}.`,
      );

      if (!colorLocations.has(color)) {
        colorLocations.set(color, []);
      }

      colorLocations.get(color)!.push([vialIndex, segmentIndex]);
    }
  }

  // Calculate fragmentation score (higher means more fragmented)
  let fragmentation = 0;

  for (const [_, locations] of colorLocations.entries()) {
    // Count vials containing this color
    const vialsWithColor = new Set(locations.map((loc) => loc[0]));
    fragmentation += vialsWithColor.size - 1;
  }

  return fragmentation;
}

/**
 * Check if any non-empty vial is completely sorted (all segments are the same color)
 */
function checkForSortedVials(state: GameState): boolean {
  for (const vial of state.vials) {
    // Skip empty vials
    if (vial.isEmpty()) {
      continue;
    }

    // Skip partially filled vials (they should be gone by now)
    if (!vial.isFull()) {
      continue;
    }

    // Check if all segments are the same color
    const firstColor = vial.segments[0];
    const isComplete = vial.segments.every((segment) => segment === firstColor);

    if (isComplete) {
      // Found a completely sorted vial
      return true;
    }
  }

  return false;
}

/**
 * Breaks up completely sorted vials by creating varied color patterns
 */
function breakUpSortedVials(state: GameState): GameState {
  const newState = state.clone();

  const getSortedIndices = () =>
    newState.vials.flatMap((vial, index) => {
      if (vial.isEmpty() || !vial.isFull()) {
        return [];
      }
      const firstColor = vial.segments[0];
      if (!firstColor) {
        return [];
      }
      const isComplete = vial.segments.every(
        (segment) => segment === firstColor,
      );

      return isComplete ? [index] : [];
    });

  for (let pass = 0; pass < 3; pass++) {
    const sortedVialIndices = getSortedIndices();
    if (sortedVialIndices.length === 0) {
      break;
    }

    for (const sortedIndex of sortedVialIndices) {
      const sortedVial = assertDefined(
        newState.vials[sortedIndex],
        `Expected vial at index ${sortedIndex}.`,
      );
      const sortedColor = sortedVial.segments[0];
      if (!sortedColor) {
        continue;
      }

      let partnerIndex = -1;
      for (let i = 0; i < newState.vials.length; i++) {
        if (i === sortedIndex) {
          continue;
        }
        const candidate = assertDefined(
          newState.vials[i],
          `Expected vial at index ${i}.`,
        );
        if (!candidate.isFull()) {
          continue;
        }
        const candidateTop = candidate.segments.at(-1);
        if (candidateTop && candidateTop !== sortedColor) {
          partnerIndex = i;
          break;
        }
      }

      if (partnerIndex < 0) {
        continue;
      }

      const partnerVial = assertDefined(
        newState.vials[partnerIndex],
        `Expected vial at index ${partnerIndex}.`,
      );
      const sortedTop = sortedVial.segments.pop();
      const partnerTop = partnerVial.segments.pop();
      if (sortedTop && partnerTop) {
        sortedVial.segments.push(partnerTop);
        partnerVial.segments.push(sortedTop);
      }
    }
  }

  // Final check to ensure no vial exceeds capacity
  for (let i = 0; i < newState.vials.length; i++) {
    const vial = assertDefined(
      newState.vials[i],
      `Expected vial at index ${i}.`,
    );
    if (vial.segments.length > vial.capacity) {
      // Fix by removing excess segments
      while (vial.segments.length > vial.capacity) {
        vial.segments.pop();
      }
    }
  }

  return newState;
}

/**
 * Ensures there are no partially filled vials in the final state
 * by redistributing colors through legal moves, and ensures no vial is completely sorted
 * Also verifies that no vial exceeds its capacity
 */
function ensureNoPartiallyFilledVials(state: GameState): GameState {
  const newState = state.clone();

  // First, check for any vials exceeding capacity
  for (let i = 0; i < newState.vials.length; i++) {
    const vial = assertDefined(
      newState.vials[i],
      `Expected vial at index ${i}.`,
    );
    if (vial.segments.length > vial.capacity) {
      // Fix by removing excess segments
      while (vial.segments.length > vial.capacity) {
        vial.segments.pop();
      }
    }
  }

  let hasPartiallyFilledVials = true;

  while (hasPartiallyFilledVials) {
    hasPartiallyFilledVials = false;

    // Find partially filled vials
    for (let i = 0; i < newState.vials.length; i++) {
      const vial = assertDefined(
        newState.vials[i],
        `Expected vial at index ${i}.`,
      );

      // Skip empty or full vials
      if (vial.isEmpty() || vial.isFull()) {
        continue;
      }

      // Found a partially filled vial
      hasPartiallyFilledVials = true;
      const topColor = vial.getTopColor() as Color;
      const topCount = countTopSegmentsOfSameColor(vial, topColor);

      // Find a target vial (prefer empty vials first)
      let foundTarget = false;

      // Try empty vials first
      for (let j = 0; j < newState.vials.length; j++) {
        if (i === j) {
          continue;
        }

        const targetVial = assertDefined(
          newState.vials[j],
          `Expected target vial at index ${j}.`,
        );
        if (targetVial.isEmpty()) {
          // Pour all segments of this color to the empty vial
          for (let k = 0; k < topCount; k++) {
            vial.segments.pop();
            targetVial.segments.push(topColor);
          }
          foundTarget = true;
          break;
        }
      }

      // If no empty vial, try vials with matching top color
      if (!foundTarget) {
        for (let j = 0; j < newState.vials.length; j++) {
          if (i === j) {
            continue;
          }

          const targetVial = assertDefined(
            newState.vials[j],
            `Expected target vial at index ${j}.`,
          );
          if (!targetVial.isFull() && targetVial.getTopColor() === topColor) {
            // Calculate how many can be poured based on capacity
            const maxPour = Math.min(
              topCount,
              targetVial.capacity - targetVial.segments.length,
            );

            if (maxPour > 0) {
              // Pour segments
              for (let k = 0; k < maxPour; k++) {
                vial.segments.pop();
                targetVial.segments.push(topColor);
              }
              foundTarget = true;
              break;
            }
          }
        }
      }

      // If still couldn't find a target, try another vial or if all else fails, try creating a new completely full vial
      if (!foundTarget) {
        if (vial.segments.length === 0) {
          continue;
        } // If we've emptied it, continue

        // Try to find another vial with compatible color but not the same one
        for (let j = 0; j < newState.vials.length; j++) {
          if (i === j) {
            continue;
          }

          const targetVial = assertDefined(
            newState.vials[j],
            `Expected target vial at index ${j}.`,
          );
          if (targetVial.isEmpty()) {
            // Move all remaining segments to this empty vial
            while (vial.segments.length > 0) {
              const color = vial.segments.pop() as Color;
              targetVial.segments.push(color);
            }
            foundTarget = true;
            break;
          }
        }

        // If still no target, we'll need to empty this vial completely if possible
        if (!foundTarget && vial.segments.length > 0) {
          // Try to distribute segments to other vials with matching colors or space
          const segmentsToMove = [...vial.segments];
          vial.segments = [];

          for (const segment of segmentsToMove) {
            let placed = false;

            // Try to find a vial with matching top color
            for (let j = 0; j < newState.vials.length; j++) {
              if (i === j) {
                continue;
              }

              const targetVial = assertDefined(
                newState.vials[j],
                `Expected target vial at index ${j}.`,
              );
              if (
                !targetVial.isFull() &&
                (targetVial.isEmpty() || targetVial.getTopColor() === segment)
              ) {
                targetVial.segments.push(segment);
                placed = true;
                break;
              }
            }

            // If couldn't place, put it back
            if (!placed) {
              vial.segments.push(segment);
            }
          }
        }
      }
    }
  }

  // After fixing partially filled vials, check for completely sorted vials
  const hasSortedVials = checkForSortedVials(newState);

  // If we have sorted vials, break them up by shuffling a bit more
  if (hasSortedVials) {
    return breakUpSortedVials(newState);
  }

  // Final capacity check
  for (let i = 0; i < newState.vials.length; i++) {
    const vial = assertDefined(
      newState.vials[i],
      `Expected vial at index ${i}.`,
    );
    if (vial.segments.length > vial.capacity) {
      // Fix by removing excess segments
      while (vial.segments.length > vial.capacity) {
        vial.segments.pop();
      }
    }
  }

  return newState;
}

/**
 * Estimates the difficulty of a level
 */
function estimateDifficulty(state: GameState, solutionSteps: number): number {
  // Composite score based on:
  // 1. Entropy
  // 2. Fragmentation
  // 3. Minimum solution steps (optional, requires solver)

  const entropy = calculateEntropy(state);
  const fragmentation = calculateFragmentation(state);

  // Optional: Run simplified solver to estimate minimum steps
  // Calculate weighted difficulty score
  return entropy * 0.4 + fragmentation * 0.4 + solutionSteps * 0.2;
}

/**
 * Serializes a level to JSON
 */
function serializeLevel(
  initialState: GameState,
  shuffledState: GameState,
  shuffleMoves: Move[],
  solutionMoves: Move[],
): string {
  // Convert state to JSON format
  const levelData = {
    // Initial state (solved state)
    initialState: {
      vials: initialState.vials.map((vial) => ({
        segments: vial.segments,
      })),
      colorCount: initialState.colorCount,
      emptyVialCount: initialState.emptyVialCount,
    },

    // Shuffled state (puzzle starting state)
    shuffledState: {
      vials: shuffledState.vials.map((vial) => ({
        segments: vial.segments,
      })),
    },

    // Generation process
    generationMoves: shuffleMoves.map((move) => ({
      source: move.sourceVialIndex,
      target: move.targetVialIndex,
      amount: move.colorsToPour,
    })),

    // Solution path
    solutionMoves: solutionMoves.map((move) => ({
      source: move.sourceVialIndex,
      target: move.targetVialIndex,
      amount: move.colorsToPour,
    })),

    // Metadata
    metadata: {
      vialCapacity: assertDefined(
        initialState.vials[0],
        "Expected at least one vial in initial state.",
      ).capacity,
      totalVials: initialState.totalVials,
      difficulty: estimateDifficulty(shuffledState, solutionMoves.length),
      entropy: calculateEntropy(shuffledState),
      fragmentation: calculateFragmentation(shuffledState),
      estimatedSolutionSteps: solutionMoves.length,
      generationMethod: "reverse-shuffle",
    },
  };

  return JSON.stringify(levelData, null, 2);
}

/**
 * Generates a new level filename with incremented number
 */
function generateLevelFilename(): string {
  // Find existing level files
  const existingLevels = glob.sync("levels/level-*.json");

  // Extract numbers from filenames
  const levelNumbers = existingLevels.map((filename: string) => {
    const match = new RegExp(/level-(\d+)\.json/).exec(filename);
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
 * Options for the level generator
 */
type GenerateLevelOptions = {
  colorCount?: number;
  vialHeight?: number;
  emptyVials?: number;
  targetShuffleMoves?: number;
  outputPath?: string;
};

/**
 * Main function to generate a new level
 */
export default function generateLevel(options: GenerateLevelOptions): string {
  const {
    colorCount = DEFAULT_COLORS,
    vialHeight = DEFAULT_VIAL_HEIGHT,
    emptyVials = DEFAULT_EMPTY_VIALS,
    targetShuffleMoves = DEFAULT_SHUFFLE_MOVES,
    outputPath,
  } = options;

  // Ensure the output directory exists
  const dir = path.dirname(outputPath || "levels/dummy.json");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Initialize the generator with the solved state
  const initialState = initializeGenerator(colorCount, vialHeight, emptyVials);

  let finalState: GameState | null = null;
  let shuffleMoves: Move[] = [];
  let solutionMoves: Move[] = [];

  for (let attempt = 0; attempt < 5; attempt++) {
    const result = generateShuffledLevel(initialState, targetShuffleMoves);
    shuffleMoves = result.shuffleMoves;

    const cleanedState = ensureNoPartiallyFilledVials(result.shuffledState);
    const solveResult = solvePuzzle(cleanedState, 10000, 50000);

    if (solveResult.solved && solveResult.path && solveResult.path.length > 0) {
      finalState = cleanedState;
      solutionMoves = solveResult.path;
      break;
    }
  }

  if (!finalState) {
    throw new Error("Failed to generate a solvable level after retries.");
  }

  // Serialize the level data
  const levelData = serializeLevel(
    initialState,
    finalState,
    shuffleMoves,
    solutionMoves,
  );

  // Determine filename
  const filename = outputPath || generateLevelFilename();

  // Save to file
  fs.writeFileSync(filename, levelData);

  console.log(`Generated new level: ${filename}`);
  console.log(`- Colors: ${colorCount}`);
  console.log(`- Empty vials: ${emptyVials}`);
  console.log(`- Vial height: ${vialHeight}`);
  console.log(
    `- Difficulty: ${estimateDifficulty(finalState, solutionMoves.length)}`,
  );
  console.log(`- Solution steps: ${solutionMoves.length}`);

  return filename;
}

// If this module is executed directly (not imported)
if (import.meta.main) {
  // Generate a standard level
  console.log("Generating standard level...");
  generateLevel({
    colorCount: 6,
    vialHeight: 4,
    emptyVials: 2,
    targetShuffleMoves: 25,
  });

  // Generate a harder level
  console.log("\nGenerating harder level...");
  generateLevel({
    colorCount: 8,
    vialHeight: 4,
    emptyVials: 2,
    targetShuffleMoves: 40,
  });
}
