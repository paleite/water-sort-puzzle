# Level Generator Design Document

## Overview

This document outlines the design and implementation of a Water Sort Puzzle level generator based on the reverse-engineering approach described in theory-master.md. The generator produces guaranteed-solvable puzzle configurations through a reverse solving process.

## Core Concepts

The level generator follows these key principles:

- Start from a solved state
- Apply valid reverse moves to create a scrambled initial state
- Ensure all moves are reversible within the constraints of the game
- Optimize for puzzle quality metrics (entropy, difficulty, etc.)

## Data Structures

### Vial

```typescript
interface Vial {
  segments: Color[];
  capacity: number; // Usually 4
  isEmpty(): boolean;
  isFull(): boolean;
  isComplete(): boolean; // Contains only one color type and is full
  getTopColor(): Color | null;
  canReceive(color: Color): boolean;
  pour(targetVial: Vial): boolean;
}
```

### GameState

```typescript
interface GameState {
  vials: Vial[];
  colorCount: number;
  emptyVialCount: number;
  totalVials: number;
  isComplete(): boolean; // All vials are either complete or empty
  getAvailableMoves(): Move[];
  applyMove(move: Move): GameState;
  getStateHash(): string; // For detecting duplicate states
}
```

### Move

```typescript
interface Move {
  sourceVialIndex: number;
  targetVialIndex: number;
  colorsToPour: number; // How many segments of the same color to pour
}
```

## Algorithm Workflow

### 1. Initialization

```typescript
function initializeGenerator(
  colorCount: number,
  vialHeight: number,
  emptyVials: number,
): GameState {
  // 1. Create a solved state with colorCount vials, each containing a unique color
  // 2. Add emptyVials empty vials
  // 3. Return the initial state
}
```

### 2. Reverse Shuffle Process

```typescript
function generateLevel(
  initialSolvedState: GameState,
  targetShuffleMoves: number,
): {
  shuffledState: GameState;
  shuffleMoves: Move[];
} {
  const visitedStates = new Set<string>();
  let currentState = initialSolvedState;
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
      break;
    }

    // Select a move using a heuristic (e.g., maximize entropy)
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
```

### 3. Valid Reverse Move Generation

```typescript
function getValidReverseMoves(state: GameState): Move[] {
  const moves: Move[] = [];

  // For each vial
  for (let i = 0; i < state.totalVials; i++) {
    const sourceVial = state.vials[i];

    // Skip empty vials as source
    if (sourceVial.isEmpty()) continue;

    const topColor = sourceVial.getTopColor();

    // Find all valid target vials
    for (let j = 0; j < state.totalVials; j++) {
      // Skip same vial
      if (i === j) continue;

      const targetVial = state.vials[j];

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
```

### 4. Applying a Reverse Move

```typescript
function applyReverseMove(state: GameState, move: Move): GameState {
  // Create a deep copy of the state
  const newState = deepCopy(state);

  const sourceVial = newState.vials[move.sourceVialIndex];
  const targetVial = newState.vials[move.targetVialIndex];

  // Get the color to pour
  const colorToPour = sourceVial.getTopColor();

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
```

### 5. Selecting Optimal Reverse Move

```typescript
function selectOptimalReverseMove(
  moves: Move[],
  currentState: GameState,
): Move {
  // Calculate scores for each move based on heuristics
  const scoredMoves = moves.map((move) => {
    const resultState = applyReverseMove(currentState, move);
    return {
      move,
      entropy: calculateEntropy(resultState),
      fragmentation: calculateFragmentation(resultState),
      // Additional heuristics as needed
    };
  });

  // Sort moves by composite score (entropy + fragmentation)
  scoredMoves.sort((a, b) => {
    const scoreA = a.entropy * 0.7 + a.fragmentation * 0.3;
    const scoreB = b.entropy * 0.7 + b.fragmentation * 0.3;
    return scoreB - scoreA; // Higher score is better
  });

  // Return move with highest score
  return scoredMoves[0].move;
}
```

## Heuristic Functions

### 1. Entropy Calculation

```typescript
function calculateEntropy(state: GameState): number {
  // Higher entropy means more disorder and color mixing
  let entropy = 0;

  // For each vial, count color transitions
  for (const vial of state.vials) {
    if (vial.segments.length <= 1) continue;

    // Count color changes in the vial
    let colorChanges = 0;
    for (let i = 1; i < vial.segments.length; i++) {
      if (vial.segments[i] !== vial.segments[i - 1]) {
        colorChanges++;
      }
    }

    entropy += colorChanges;
  }

  return entropy;
}
```

### 2. Fragmentation Calculation

```typescript
function calculateFragmentation(state: GameState): number {
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
```

### 3. Fairness Validation

```typescript
function validateFairness(state: GameState): boolean {
  // Verify all colors have the same number of segments
  const colorCounts = new Map<Color, number>();

  for (const vial of state.vials) {
    for (const color of vial.segments) {
      colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
    }
  }

  // All colors should have the same count (vial height)
  const counts = Array.from(colorCounts.values());
  return counts.every((count) => count === counts[0]);
}
```

## Level Quality Verification

### 1. Difficulty Estimation

```typescript
function estimateDifficulty(state: GameState): number {
  // Composite score based on:
  // 1. Entropy
  // 2. Fragmentation
  // 3. Minimum solution steps (optional, requires solver)

  const entropy = calculateEntropy(state);
  const fragmentation = calculateFragmentation(state);

  // Optional: Run simplified solver to estimate minimum steps
  const minSteps = estimateMinimumSolutionSteps(state);

  // Calculate weighted difficulty score
  return entropy * 0.4 + fragmentation * 0.4 + minSteps * 0.2;
}
```

### 2. Solution Steps Estimation

```typescript
function estimateMinimumSolutionSteps(state: GameState): number {
  // Simplified BFS to estimate solution length
  // (Full implementation would be a complete solver)

  // For estimation purposes, can use number of non-complete vials
  // or more sophisticated heuristics

  let nonCompleteVials = 0;
  for (const vial of state.vials) {
    if (!vial.isEmpty() && !vial.isComplete()) {
      nonCompleteVials++;
    }
  }

  // Rough estimate: each non-complete vial needs at least 2 moves
  return nonCompleteVials * 2;
}
```

## Level Serialization

### 1. Game State to JSON

```typescript
function serializeLevel(
  initialState: GameState,
  shuffledState: GameState,
  shuffleMoves: Move[],
): string {
  // Ensure no partially filled vials in the shuffled state
  const finalState = ensureNoPartiallyFilledVials(shuffledState);

  // Solution moves are the reverse of the shuffle moves
  const solutionMoves = [...shuffleMoves].reverse().map((move) => ({
    sourceVialIndex: move.targetVialIndex,
    targetVialIndex: move.sourceVialIndex,
    colorsToPour: move.colorsToPour,
  }));

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
      vials: finalState.vials.map((vial) => ({
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
      vialCapacity: initialState.vials[0].capacity,
      totalVials: initialState.totalVials,
      difficulty: estimateDifficulty(finalState),
      entropy: calculateEntropy(finalState),
      fragmentation: calculateFragmentation(finalState),
      estimatedSolutionSteps: solutionMoves.length,
    },
  };

  return JSON.stringify(levelData, null, 2);
}

/**
 * Ensures there are no partially filled vials in the final state
 * by redistributing colors through legal moves
 */
function ensureNoPartiallyFilledVials(state: GameState): GameState {
  const newState = deepCopy(state);
  let hasPartiallyFilledVials = true;

  while (hasPartiallyFilledVials) {
    hasPartiallyFilledVials = false;

    // Find partially filled vials
    for (let i = 0; i < newState.vials.length; i++) {
      const vial = newState.vials[i];

      // Skip empty or full vials
      if (vial.isEmpty() || vial.isFull()) continue;

      // Found a partially filled vial
      hasPartiallyFilledVials = true;
      const topColor = vial.getTopColor();
      const topCount = countTopSegmentsOfSameColor(vial, topColor);

      // Find a target vial (prefer empty vials first)
      let foundTarget = false;

      // Try empty vials first
      for (let j = 0; j < newState.vials.length; j++) {
        if (i === j) continue;

        const targetVial = newState.vials[j];
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
          if (i === j) continue;

          const targetVial = newState.vials[j];
          if (!targetVial.isFull() && targetVial.getTopColor() === topColor) {
            // Calculate how many can be poured
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

      // If still couldn't find a target, try another vial
      if (!foundTarget) continue;
    }
  }

  return newState;
}

/**
 * Generates a new level filename with incremented number
 */
function generateLevelFilename(): string {
  // Find existing level files
  const existingLevels = glob("level-*.json");

  // Extract numbers from filenames
  const levelNumbers = existingLevels.map((filename) => {
    const match = filename.match(/level-(\d+)\.json/);
    return match ? parseInt(match[1], 10) : 0;
  });

  // Find the highest number
  const highestNumber = Math.max(0, ...levelNumbers);

  // Generate new filename with incremented number
  return `level-${highestNumber + 1}.json`;
}
```

### 2. JSON to Game State

```typescript
function deserializeLevel(jsonData: string): {
  initialState: GameState;
  shuffledState: GameState;
  generationMoves: Move[];
  solutionMoves: Move[];
} {
  const data = JSON.parse(jsonData);

  // Create initial state
  const initialVials = data.initialState.vials.map((vialData) => {
    const vial = new Vial(data.metadata.vialCapacity);
    vial.segments = vialData.segments;
    return vial;
  });

  const initialState = new GameState(
    initialVials,
    data.initialState.colorCount,
    data.initialState.emptyVialCount,
  );

  // Create shuffled state
  const shuffledVials = data.shuffledState.vials.map((vialData) => {
    const vial = new Vial(data.metadata.vialCapacity);
    vial.segments = vialData.segments;
    return vial;
  });

  const shuffledState = new GameState(
    shuffledVials,
    data.initialState.colorCount,
    data.initialState.emptyVialCount,
  );

  // Convert generation moves
  const generationMoves = data.generationMoves.map((move) => ({
    sourceVialIndex: move.source,
    targetVialIndex: move.target,
    colorsToPour: move.amount,
  }));

  // Convert solution moves
  const solutionMoves = data.solutionMoves.map((move) => ({
    sourceVialIndex: move.source,
    targetVialIndex: move.target,
    colorsToPour: move.amount,
  }));

  return {
    initialState,
    shuffledState,
    generationMoves,
    solutionMoves,
  };
}
```

## Implementation Recommendations

1. **Start Simple**: Begin with a basic implementation of the reverse shuffle algorithm
2. **Incremental Enhancement**: Add heuristics and quality metrics incrementally
3. **Validation**: Implement a solver to verify level solvability
4. **Tuning**: Adjust parameters based on player testing and feedback
5. **Progressive Difficulty**: Generate levels across different difficulty tiers by adjusting:
   - Number of colors
   - Number of empty vials
   - Shuffle depth
   - Target entropy/fragmentation

## Performance Considerations

1. **State Hashing**: Use efficient hashing for state representation to detect duplicates
2. **Pruning**: Aggressively prune moves that decrease puzzle quality
3. **Batching**: Generate multiple puzzles in parallel
4. **Caching**: Cache intermediate states during generation

## Testing Strategy

1. **Unit Tests**:
   - Test individual functions (move generation, state transitions)
   - Verify heuristic functions return expected values
2. **Integration Tests**:
   - Ensure generated levels are solvable
   - Verify difficulty estimates correlate with actual solution complexity
3. **Validation Tests**:
   - Run automated solver on generated levels
   - Track solver metrics (steps, time) to validate difficulty
4. **User Tests**:
   - Gather feedback on level quality and engagement
   - Adjust generation parameters based on user metrics

## Generating and Saving Levels

```typescript
/**
 * Main function to generate a new level and save it with an auto-incremented filename
 */
function generateAndSaveNewLevel(
  colorCount: number,
  vialHeight: number,
  emptyVials: number,
  targetShuffleMoves: number,
): string {
  // Initialize the generator with the solved state
  const initialState = initializeGenerator(colorCount, vialHeight, emptyVials);

  // Generate the shuffled state and record the moves
  const { shuffledState, shuffleMoves } = generateLevel(
    initialState,
    targetShuffleMoves,
  );

  // Ensure no partially filled vials in the final state
  const finalState = ensureNoPartiallyFilledVials(shuffledState);

  // Serialize the level data
  const levelData = serializeLevel(initialState, finalState, shuffleMoves);

  // Generate new filename with auto-incremented number
  const filename = generateLevelFilename();

  // Save to file
  fs.writeFileSync(filename, levelData);

  console.log(`Generated new level: ${filename}`);
  console.log(`- Colors: ${colorCount}`);
  console.log(`- Empty vials: ${emptyVials}`);
  console.log(`- Vial height: ${vialHeight}`);
  console.log(`- Difficulty: ${estimateDifficulty(finalState)}`);
  console.log(`- Solution steps: ${shuffleMoves.length}`);

  return filename;
}
```

## Implementation Learnings

During the implementation of the level generator, several important insights and additions were discovered that weren't fully articulated in the initial design. These are critical for producing high-quality, playable puzzles:

### 1. Vial Capacity Enforcement

```typescript
/**
 * Ensures no vial exceeds its capacity
 */
function enforceVialCapacity(vial: Vial): void {
  // Critical to check capacity limits in multiple places
  if (vial.segments.length > vial.capacity) {
    // Fix by removing excess segments
    while (vial.segments.length > vial.capacity) {
      vial.segments.pop();
    }
  }
}
```

**Key Learning**: Vial capacity constraints must be enforced at multiple points:

- When redistributing colors from partially filled vials
- After breaking up sorted vials
- When applying moves during shuffle
- Before saving the final state

Violations of capacity constraints can happen unexpectedly during shuffling or when breaking up sorted vials, so redundant checks are essential for puzzle integrity.

### 2. Color Pattern Diversity

Initial implementation produced predictable "mirror image" patterns (eg. [A,A,B,B] and [B,B,A,A]) which made puzzles feel artificially constructed and less engaging. The solution was to implement a variety of pattern types:

```typescript
// Clear vials first to ensure clean state
vialA.segments = [];
vialB.segments = [];

// Choose pattern type randomly
const patternType = Math.floor(Math.random() * 3);

if (patternType === 0) {
  // Pattern: 1+3 distribution
  vialA.segments.push(colorA);
  vialA.segments.push(colorB);
  vialA.segments.push(colorB);
  vialA.segments.push(colorB);
} else if (patternType === 1) {
  // Pattern: Fully interleaved ABAB
  vialA.segments.push(colorA);
  vialA.segments.push(colorB);
  vialA.segments.push(colorA);
  vialA.segments.push(colorB);
} else {
  // Pattern: 2+2 distribution
  vialA.segments.push(colorA);
  vialA.segments.push(colorA);
  vialA.segments.push(colorB);
  vialA.segments.push(colorB);
}
```

**Key Learning**: Using different pattern types (1+3, 3+1, 2+2, 1+1+1+1, etc.) and applying them differently to different vial groups creates much more engaging and realistic puzzles. Completely clearing and rebuilding vials with specific patterns is more reliable than using pours.

### 3. Enhanced Heuristics for Move Selection

The original heuristics prioritized entropy but didn't specifically target breaking up sorted vials or creating interesting distributions. Enhanced heuristics provide dramatically better results:

```typescript
// Calculate scores with multiple factors
const scoredMoves = moves.map((move) => {
  const resultState = currentState.applyMove(move);

  // Base metrics
  const entropy = calculateEntropy(resultState);
  const fragmentation = calculateFragmentation(resultState);

  // Additional mixing metrics
  const breaksSortedVial = evaluateBreaksSortedVial(move, currentState);
  const mixesDifferentColors = evaluateMixesDifferentColors(move, currentState);
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

// Weight mixing metrics heavily
const scoreA =
  a.entropy * 0.3 +
  a.fragmentation * 0.2 +
  a.breaksSortedVial * 10 +
  a.mixesDifferentColors * 5 +
  a.distributesColor * 5;
```

**Key Learning**: Explicitly rewarding moves that break up sorted vials or distribute colors across multiple vials leads to much better puzzles than merely maximizing entropy.

### 4. Handling Partially Filled Vials

The challenge of eliminating partially filled vials is more complex than initially expected. The solution requires multiple fallback strategies:

```typescript
// If primary strategies fail, try these fallbacks:

// Try distributing segments to vials with matching colors
if (!foundTarget && vial.segments.length > 0) {
  const segmentsToMove = [...vial.segments];
  vial.segments = [];

  for (const segment of segmentsToMove) {
    let placed = false;

    // Try to find a vial with matching top color
    for (let j = 0; j < newState.vials.length; j++) {
      if (i === j) continue;

      const targetVial = newState.vials[j];
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
```

**Key Learning**: Multiple fallback strategies must be implemented for handling partially filled vials, including:

1. Moving to empty vials
2. Moving to vials with matching top colors
3. Distributing segments individually to compatible vials
4. Using temporary storage in other vials

### 5. Randomization for Variety

Adding randomization to several parts of the generation process significantly improves puzzle variety:

```typescript
// Add randomization to move selection from top candidates
const randomIndex = Math.floor(Math.random() * Math.min(3, scoredMoves.length));
return scoredMoves[randomIndex].move;
```

**Key Learning**: Deterministic algorithms can produce predictable patterns. Adding controlled randomization to pattern selection, move selection, and color distributions creates more varied and interesting puzzles.

### 6. Complex Multi-Color Patterns

Working with 3+ vials in coordinated patterns produces more interesting puzzles than just working with pairs:

```typescript
// Process 3 vials together for more complex patterns
const vialA = newState.vials[sortedVialIndices[i]];
const vialB = newState.vials[sortedVialIndices[i + 1]];
const vialC = newState.vials[sortedVialIndices[i + 2]];

// Pattern: Cyclic distribution
// A[1C+3A], B[2A+2B], C[3B+1C]
vialA.segments.push(colorC);
vialA.segments.push(colorA);
vialA.segments.push(colorA);
vialA.segments.push(colorA);
```

**Key Learning**: Working with 3+ vials simultaneously allows creating more complex interrelated color patterns, which significantly increases puzzle complexity and engagement.

## Extensions

1. **Targeted Difficulty**: Generate levels with specific difficulty targets
2. **Theme-Based Generation**: Create levels with visual patterns or color distributions
3. **Tutorial Levels**: Generate simplified levels for tutorial purposes
4. **Challenge Modes**: Create levels with special constraints or objectives
5. **Level Sequences**: Generate progression of levels with gradually increasing difficulty
6. **Level Validation**: Add validation to ensure levels meet design requirements:
   - No partially filled vials (only completely full or empty)
   - No vials already completely sorted
   - Distribution of colors across vials is sufficiently mixed
7. **Solution Verification**: Run a solver on generated levels to verify solvability and solution length
8. **Advanced Pattern Recognition**: Detect and avoid patterns that make puzzles too easy or trivial
9. **Capacity Constraint Enforcement**: Multiple validation points to ensure vial capacities are never exceeded
10. **Fallback Strategies**: Robust handling of edge cases in color distribution and vial handling
