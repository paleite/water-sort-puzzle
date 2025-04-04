import { GameState } from "./game-state";
import type { SeededRandom } from "./seeded-random";
import type { Color, Move } from "./types/puzzle-types";
import { Vial } from "./vial";

/**
 * Counts the number of segments of the same color at the top of a vial
 */
export function countTopSegmentsOfSameColor(vial: Vial, color: Color): number {
  let count = 0;
  // Start from the top segment
  for (let i = vial.segments.length - 1; i >= 0; i--) {
    const segment = vial.segments[i];
    // If the segment has the same color as what we're looking for, count it
    if (segment === color) {
      count++;
    } else {
      // Stop counting when we hit a different color
      break;
    }
  }
  return count;
}

/**
 * Creates an initial state with colorCount vials, each with a unique color
 */
export function createInitialState(
  colorCount: number,
  vialHeight: number,
  emptyVialCount: number,
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
      `Not enough colors in palette. Max is ${colorPalette.length.toString()}`,
    );
  }

  // Create completely filled vials, each with a unique color
  for (let i = 0; i < colorCount; i++) {
    const vial = new Vial(vialHeight);
    const color = colorPalette[i];

    // Fill vial with the same color
    for (let j = 0; j < vialHeight; j++) {
      if (color) {
        vial.segments.push(color);
      }
    }

    vials.push(vial);
  }

  // Add empty vials
  for (let i = 0; i < emptyVialCount; i++) {
    vials.push(new Vial(vialHeight));
  }

  return new GameState(vials, colorCount, emptyVialCount);
}

/**
 * Randomizes the content of filled vials, preserving empty vials
 */
export function randomizeVials(state: GameState, rng: SeededRandom): GameState {
  const newState = state.clone();
  const filledVialIndices = [];

  // Identify vials with colors (non-empty vials)
  for (let i = 0; i < newState.vials.length; i++) {
    const vial = newState.vials[i];
    if (vial && !vial.isEmpty()) {
      filledVialIndices.push(i);
    }
  }

  // Flatten all color segments from filled vials
  const allSegments: Color[] = [];
  for (const index of filledVialIndices) {
    const vial = newState.vials[index];
    if (vial) {
      allSegments.push(...vial.segments);
      vial.segments = [];
    }
  }

  // Shuffle the segments using the seeded RNG
  const shuffledSegments = shuffleArray(allSegments, rng);

  // Redistribute the segments to the original filled vials
  let segmentIndex = 0;
  for (const vialIndex of filledVialIndices) {
    const vial = newState.vials[vialIndex];

    // Fill each vial to capacity
    if (vial) {
      for (
        let i = 0;
        i < vial.capacity && segmentIndex < shuffledSegments.length;
        i++
      ) {
        const segment = shuffledSegments[segmentIndex];
        if (segment) {
          vial.segments.push(segment);
        }
        segmentIndex++;
      }
    }
  }

  return newState;
}

/**
 * Add empty vials to a state
 */
export function addEmptyVials(
  state: GameState,
  emptyVialCount: number,
): GameState {
  const newState = state.clone();

  // Count current empty vials
  let currentEmptyVials = 0;
  for (const vial of newState.vials) {
    if (vial.isEmpty()) {
      currentEmptyVials++;
    }
  }

  // Add more empty vials if needed
  const vialCountToAdd = emptyVialCount - currentEmptyVials;
  if (newState.vials.length > 0 && newState.vials[0]) {
    const vialCapacity = newState.vials[0].capacity;
    for (let i = 0; i < vialCountToAdd; i++) {
      newState.vials.push(new Vial(vialCapacity));
    }
  }

  // Update state properties
  newState.emptyVialCount = emptyVialCount;
  newState.totalVials = newState.vials.length;

  return newState;
}

/**
 * Check if a move would complete a vial
 */
export function wouldCompleteVial(state: GameState, move: Move): boolean {
  const sourceVial = state.vials[move.sourceVialIndex];
  const targetVial = state.vials[move.targetVialIndex];

  if (!sourceVial || !targetVial) {
    return false;
  }

  const topColor = sourceVial.getTopColor();
  if (topColor === null) {
    return false;
  }

  // Check if source vial would be emptied by this move
  if (sourceVial.segments.length === move.colorsToPour) {
    return true;
  }

  // If the target vial would be filled to capacity after the move
  if (targetVial.segments.length + move.colorsToPour === targetVial.capacity) {
    // If we're filling an empty vial to capacity with a single color
    if (targetVial.isEmpty() && move.colorsToPour === targetVial.capacity) {
      return true;
    }

    // Check if all segments in target vial (including those to be poured) are the same color
    const targetColors = new Set([...targetVial.segments, topColor]);
    return targetColors.size === 1;
  }

  return false;
}

/**
 * Prioritize moves based on heuristics
 */
export function prioritizeMoves(moves: Move[], state: GameState): Move[] {
  // Score each move
  const scoredMoves = moves.map((move) => {
    let score = 0;

    const sourceVial = state.vials[move.sourceVialIndex];
    const targetVial = state.vials[move.targetVialIndex];

    if (!sourceVial || !targetVial) {
      return { move, score: -999 };
    } // Deprioritize invalid moves

    // Prefer moves that complete a vial (either by filling with same color or emptying)
    if (wouldCompleteVial(state, move)) {
      score += 100;
    }

    const sourceTopColor = sourceVial.getTopColor();
    const targetTopColor = targetVial.getTopColor();

    // Prefer moves that consolidate the same color
    if (
      !targetVial.isEmpty() &&
      targetTopColor !== null &&
      sourceTopColor !== null &&
      targetTopColor === sourceTopColor
    ) {
      score += 50;
    }

    // Prefer moves that move a color that exists in multiple vials
    const colorCounts = new Map<Color, number>();

    for (const vial of state.vials) {
      const colors = new Set(vial.segments.filter(Boolean));
      for (const color of colors) {
        if (color) {
          colorCounts.set(color, (colorCounts.get(color) ?? 0) + 1);
        }
      }
    }

    if (sourceTopColor !== null) {
      const colorCount = colorCounts.get(sourceTopColor) ?? 0;

      if (colorCount > 1) {
        score += 20 * (colorCount - 1);
      }
    }

    return { move, score };
  });

  // Sort by score (higher first)
  scoredMoves.sort((a, b) => b.score - a.score);

  // Return prioritized moves
  return scoredMoves.map((scored) => scored.move);
}

/**
 * Calculate entropy (disorder) in the state
 */
export function calculateEntropy(state: GameState): number {
  let entropy = 0;

  // For each vial, count color transitions
  for (const vial of state.vials) {
    if (vial.segments.length <= 1) {
      continue;
    }

    // Count color changes in the vial
    let colorChanges = 0;
    for (let i = 1; i < vial.segments.length; i++) {
      const current = vial.segments[i];
      const previous = vial.segments[i - 1];
      if (current && previous && current !== previous) {
        colorChanges++;
      }
    }

    // Weight color changes by position - changes near the bottom are harder to resolve
    let positionWeightedChanges = 0;
    for (let i = 1; i < vial.segments.length; i++) {
      const current = vial.segments[i];
      const previous = vial.segments[i - 1];
      if (current && previous && current !== previous) {
        // Weight by position - bottom changes count more (inverse position)
        positionWeightedChanges += i * 0.5;
      }
    }

    entropy += colorChanges + positionWeightedChanges;
  }

  // Additional entropy from distribution of colors
  const colorDistribution = new Map<Color, number>();
  for (const vial of state.vials) {
    const colors = new Set(vial.segments.filter(Boolean));
    for (const color of colors) {
      if (color) {
        colorDistribution.set(color, (colorDistribution.get(color) ?? 0) + 1);
      }
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
export function calculateFragmentation(state: GameState): number {
  // Creates a map of color to locations
  const colorLocations = new Map<Color, number[][]>();

  // Populate the map
  for (let vialIndex = 0; vialIndex < state.vials.length; vialIndex++) {
    const vial = state.vials[vialIndex];

    for (
      let segmentIndex = 0;
      segmentIndex < vial.segments.length;
      segmentIndex++
    ) {
      const color = vial.segments[segmentIndex];
      if (!color) {
        continue;
      }

      if (!colorLocations.has(color)) {
        colorLocations.set(color, []);
      }

      const locations = colorLocations.get(color);
      if (locations) {
        locations.push([vialIndex, segmentIndex]);
      }
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
 * Evaluate level quality and validity
 */
export function evaluateLevel(
  state: GameState,
  solutionPath: Move[],
): {
  difficulty: number;
  entropy: number;
  fragmentation: number;
  solutionSteps: number;
  isValid: boolean;
} {
  // Calculate standard puzzle metrics
  const entropy = calculateEntropy(state);
  const fragmentation = calculateFragmentation(state);

  // Check for partial vials
  const hasPartialVials = state.vials.some(
    (vial) => !vial.isEmpty() && !vial.isFull(),
  );

  // Check for initially solved vials (excluding empty ones)
  const hasSolvedVials = state.vials.some(
    (vial) => !vial.isEmpty() && vial.isComplete(),
  );

  // Calculate composite difficulty score
  const difficulty =
    entropy * 0.4 + fragmentation * 0.4 + solutionPath.length * 0.2;

  return {
    difficulty,
    entropy,
    fragmentation,
    solutionSteps: solutionPath.length,
    isValid: !hasPartialVials && !hasSolvedVials,
  };
}

/**
 * Check if state has desirable properties for a good puzzle
 */
export function hasDesirableProperties(state: GameState): boolean {
  // No initially solved vials
  const hasSolvedVials = state.vials.some(
    (vial) => !vial.isEmpty() && vial.isComplete(),
  );

  // No partially filled vials
  const hasPartialVials = state.vials.some(
    (vial) => !vial.isEmpty() && !vial.isFull(),
  );

  // Has sufficient "entropy" (intermingled colors)
  const entropy = calculateEntropy(state);
  const sufficientEntropy = entropy > state.colorCount * 0.8;

  return !hasSolvedVials && !hasPartialVials && sufficientEntropy;
}

// Import shuffleArray from seeded-random
import { shuffleArray } from "./seeded-random";
