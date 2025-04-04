# Random Level Generator with Solution Verification

## Overview

This document outlines the design and implementation of a Water Sort Puzzle level generator that uses seeded randomization to create puzzle configurations, followed by algorithm-based validation to ensure solvability. Unlike the reverse-engineering approach, this generator creates random configurations first, then verifies their solvability using efficient search algorithms.

## Core Concepts

- Use seeded random generation to create reproducible but randomized levels
- Validate levels using a breadth-first search (BFS) solver algorithm
- Incrementally add empty vials if no solution is found, up to a defined limit
- Score generated puzzles using the same metrics as the reverse-engineered generator
- Generate a complete level package with solution path for gameplay

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

### 1. Seeded Random Level Generation

```typescript
function generateRandomLevel(
  seed: number | string,
  colorCount: number,
  vialHeight: number,
  maxEmptyVials: number = 2,
): {
  state: GameState;
  solutionMoves: Move[] | null;
  emptyVials: number;
} {
  // Initialize a random number generator with the provided seed
  const rng = new SeededRandom(seed);

  // Create a solved state with colorCount vials, each containing a unique color
  const initialState = createInitialState(colorCount, vialHeight, 0);

  // Randomize only the filled vials (not changing empty vial positions)
  const randomizedState = randomizeVials(initialState, rng);

  // Start with just 1 empty vial
  let currentEmptyVials = 1;
  let solutionState = null;
  let solutionMoves = null;

  // Try solving with incrementally more empty vials until we find a solution
  // or reach the maximum allowed empty vials
  while (currentEmptyVials <= maxEmptyVials && solutionMoves === null) {
    // Add empty vials to the randomized state
    const stateWithEmptyVials = addEmptyVials(
      randomizedState,
      currentEmptyVials,
    );

    // Attempt to solve the puzzle
    solutionState = solvePuzzle(stateWithEmptyVials);

    if (solutionState) {
      solutionMoves = solutionState.path;
      break;
    }

    // If no solution, try with one more empty vial
    currentEmptyVials++;
  }

  // If we still don't have a solution, return null for solutionMoves
  return {
    state: stateWithEmptyVials,
    solutionMoves: solutionMoves,
    emptyVials: currentEmptyVials,
  };
}
```

### 2. Randomize Vials

```typescript
function randomizeVials(state: GameState, rng: SeededRandom): GameState {
  const newState = state.clone();
  const filledVialIndices = [];

  // Identify vials with colors (non-empty vials)
  for (let i = 0; i < newState.vials.length; i++) {
    if (!newState.vials[i].isEmpty()) {
      filledVialIndices.push(i);
    }
  }

  // Flatten all color segments from filled vials
  const allSegments = [];
  for (const index of filledVialIndices) {
    allSegments.push(...newState.vials[index].segments);
    newState.vials[index].segments = [];
  }

  // Shuffle the segments using the seeded RNG
  shuffleArray(allSegments, rng);

  // Redistribute the segments to the original filled vials
  let segmentIndex = 0;
  for (const vialIndex of filledVialIndices) {
    const vial = newState.vials[vialIndex];

    // Fill each vial to capacity
    for (
      let i = 0;
      i < vial.capacity && segmentIndex < allSegments.length;
      i++
    ) {
      vial.segments.push(allSegments[segmentIndex]);
      segmentIndex++;
    }
  }

  return newState;
}
```

### 3. Add Empty Vials

```typescript
function addEmptyVials(state: GameState, emptyVialCount: number): GameState {
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
  for (let i = 0; i < vialCountToAdd; i++) {
    newState.vials.push(new Vial(newState.vials[0].capacity));
  }

  // Update state properties
  newState.emptyVialCount = emptyVialCount;
  newState.totalVials = newState.vials.length;

  return newState;
}
```

### 4. Puzzle Solver (BFS Algorithm)

```typescript
function solvePuzzle(
  initialState: GameState,
  maxSteps: number = 500,
): {
  solved: boolean;
  path: Move[] | null;
} {
  // Initialize BFS queue with the initial state
  const queue = [{ state: initialState, path: [] }];
  const visited = new Set<string>();
  visited.add(initialState.getStateHash());

  // BFS loop
  while (queue.length > 0 && queue.length < maxSteps) {
    const { state, path } = queue.shift();

    // Check if puzzle is solved
    if (state.isComplete()) {
      return { solved: true, path };
    }

    // Get all available moves from current state
    const moves = state.getAvailableMoves();

    // Process each move
    for (const move of moves) {
      // Apply the move to get the new state
      const newState = state.applyMove(move);
      const stateHash = newState.getStateHash();

      // If this state hasn't been visited, add it to the queue
      if (!visited.has(stateHash)) {
        visited.add(stateHash);
        queue.push({
          state: newState,
          path: [...path, move],
        });
      }
    }
  }

  // If queue is empty and no solution found, or if we exceed maxSteps
  return { solved: false, path: null };
}
```

### 5. Seeded Random Number Generator

```typescript
class SeededRandom {
  private seed: number;

  constructor(seed: number | string) {
    // Convert string seeds to numeric value
    if (typeof seed === "string") {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0; // Convert to integer
      }
      this.seed = hash;
    } else {
      this.seed = seed;
    }
  }

  // Generate a random number between 0 and 1
  next(): number {
    // Simple LCG implementation
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  // Generate a random integer between min (inclusive) and max (exclusive)
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }
}
```

### 6. Array Shuffling with Seeded RNG

```typescript
function shuffleArray<T>(array: T[], rng: SeededRandom): T[] {
  // Fisher-Yates shuffle algorithm
  for (let i = array.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
```

## Quality Metrics and Validation

### 1. Evaluating Valid Levels

```typescript
function evaluateLevel(
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
```

### 2. Checking for Desirable Properties

```typescript
function hasDesirableProperties(state: GameState): boolean {
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
```

## Level Generation and Selection

### 1. Generate Multiple Levels and Select the Best

```typescript
function generateBestLevel(
  baseSeed: number | string,
  colorCount: number,
  vialHeight: number,
  maxEmptyVials: number = 2,
  attempts: number = 10,
): {
  level: GameState;
  solutionMoves: Move[];
  metrics: any;
} {
  const candidates = [];

  // Generate multiple candidate levels
  for (let i = 0; i < attempts; i++) {
    // Derive a new seed for each attempt
    const seed = `${baseSeed}-${i}`;

    // Generate a random level
    const { state, solutionMoves, emptyVials } = generateRandomLevel(
      seed,
      colorCount,
      vialHeight,
      maxEmptyVials,
    );

    // If a valid solution was found, evaluate the level
    if (solutionMoves) {
      const metrics = evaluateLevel(state, solutionMoves);

      // Store the candidate if it meets our criteria
      if (metrics.isValid && hasDesirableProperties(state)) {
        candidates.push({
          state,
          solutionMoves,
          metrics,
          emptyVials,
        });
      }
    }
  }

  // Sort candidates by difficulty (or other criteria)
  candidates.sort((a, b) => b.metrics.difficulty - a.metrics.difficulty);

  // Return the best candidate
  return candidates[0] || null;
}
```

### 2. Level Serialization

```typescript
function serializeLevel(state: GameState, solutionMoves: Move[]): string {
  // Convert state to JSON format
  const levelData = {
    // Initial state
    initialState: {
      vials: state.vials.map((vial) => ({
        segments: vial.segments,
      })),
      colorCount: state.colorCount,
      emptyVialCount: state.emptyVialCount,
    },

    // Solution path
    solutionMoves: solutionMoves.map((move) => ({
      source: move.sourceVialIndex,
      target: move.targetVialIndex,
      amount: move.colorsToPour,
    })),

    // Metadata
    metadata: {
      vialCapacity: state.vials[0].capacity,
      totalVials: state.totalVials,
      difficulty: evaluateLevel(state, solutionMoves).difficulty,
      entropy: calculateEntropy(state),
      fragmentation: calculateFragmentation(state),
      estimatedSolutionSteps: solutionMoves.length,
      generationMethod: "random-with-bfs-solver",
    },
  };

  return JSON.stringify(levelData, null, 2);
}
```

### 3. Save to Next Available Level File

```typescript
function saveToNextAvailableFile(levelJson: string): string {
  // Find existing level files
  const existingLevels = glob.sync("levels/level-*.json");

  // Extract numbers from filenames
  const levelNumbers = existingLevels.map((filename) => {
    const match = filename.match(/level-(\d+)\.json/);
    return match ? parseInt(match[1], 10) : 0;
  });

  // Find the highest number
  const highestNumber = levelNumbers.length > 0 ? Math.max(...levelNumbers) : 0;

  // Generate new filename with incremented number
  const filename = `levels/level-${highestNumber + 1}.json`;

  // Save to file
  fs.writeFileSync(filename, levelJson);

  return filename;
}
```

### 4. Main Level Generation Function

```typescript
function generateAndSaveLevel(
  seed: number | string = Date.now(),
  colorCount: number = 8,
  vialHeight: number = 4,
  maxEmptyVials: number = 2,
): string {
  // Ensure output directory exists
  if (!fs.existsSync("levels")) {
    fs.mkdirSync("levels");
  }

  // Generate the best level from multiple attempts
  const result = generateBestLevel(
    seed,
    colorCount,
    vialHeight,
    maxEmptyVials,
    20,
  );

  if (!result) {
    throw new Error("Failed to generate a valid level after multiple attempts");
  }

  // Serialize the level to JSON
  const levelJson = serializeLevel(result.level, result.solutionMoves);

  // Save to file
  const filename = saveToNextAvailableFile(levelJson);

  console.log(`Generated new level: ${filename}`);
  console.log(`- Colors: ${colorCount}`);
  console.log(`- Empty vials: ${result.emptyVials}`);
  console.log(`- Vial height: ${vialHeight}`);
  console.log(`- Difficulty: ${result.metrics.difficulty}`);
  console.log(`- Solution steps: ${result.solutionMoves.length}`);

  return filename;
}
```

## Performance Optimizations

### 1. Efficient State Representation

For BFS solver performance, the state representation should be efficient:

```typescript
function getStateHash(state: GameState): string {
  // Use a more efficient representation than JSON.stringify
  return state.vials.map((vial) => vial.segments.join(",")).join("|");
}
```

### 2. Pruning Invalid Moves

```typescript
function getEffectiveMoves(state: GameState): Move[] {
  const allMoves = state.getAvailableMoves();
  const prunedMoves = [];

  for (const move of allMoves) {
    // Skip trivial moves (pouring from one empty vial to another)
    if (state.vials[move.sourceVialIndex].isEmpty()) continue;

    // Skip moves that just undo the previous move
    // This requires tracking previous move in the search
    if (isUndoMove(move, previousMove)) continue;

    // Skip moves to empty vials if there's already an empty vial that could receive it
    // This prevents duplicate states where only the empty vials are different
    if (
      state.vials[move.targetVialIndex].isEmpty() &&
      hasBetterEmptyTarget(state, move)
    )
      continue;

    prunedMoves.push(move);
  }

  return prunedMoves;
}
```

### 3. Move Prioritization for BFS

```typescript
function prioritizeMoves(moves: Move[], state: GameState): Move[] {
  // Score moves based on heuristics
  const scoredMoves = moves.map((move) => {
    // Prefer moves that complete vials
    const completesVial = wouldCompleteVial(move, state);

    // Prefer moves that consolidate colors
    const sourceVial = state.vials[move.sourceVialIndex];
    const targetVial = state.vials[move.targetVialIndex];
    const consolidatesColors =
      !targetVial.isEmpty() &&
      targetVial.getTopColor() === sourceVial.getTopColor();

    // Calculate score
    let score = 0;
    if (completesVial) score += 10;
    if (consolidatesColors) score += 5;

    return { move, score };
  });

  // Sort by score (higher first)
  scoredMoves.sort((a, b) => b.score - a.score);

  // Return prioritized moves
  return scoredMoves.map((scored) => scored.move);
}
```

## Implementation Considerations

### 1. BFS vs. A\* for Puzzle Solving

The design uses BFS as the core algorithm, which is guaranteed to find the shortest solution path if one exists. However, for puzzles with large state spaces, A\* with an admissible heuristic may be more efficient.

```typescript
function solvePuzzleAStar(initialState: GameState): {
  solved: boolean;
  path: Move[] | null;
} {
  // Priority queue instead of regular queue
  const openSet = new PriorityQueue();
  openSet.enqueue(initialState, 0);

  const cameFrom = new Map();
  const gScore = new Map();
  gScore.set(initialState.getStateHash(), 0);

  const fScore = new Map();
  fScore.set(initialState.getStateHash(), heuristic(initialState));

  while (!openSet.isEmpty()) {
    const current = openSet.dequeue().element;

    if (current.isComplete()) {
      return reconstructPath(cameFrom, current);
    }

    const moves = current.getAvailableMoves();

    for (const move of moves) {
      const neighbor = current.applyMove(move);
      const neighborHash = neighbor.getStateHash();

      // Tentative gScore
      const tentativeGScore = gScore.get(current.getStateHash()) + 1;

      if (
        !gScore.has(neighborHash) ||
        tentativeGScore < gScore.get(neighborHash)
      ) {
        // This path is better than any previous one
        cameFrom.set(neighborHash, { state: current, move });
        gScore.set(neighborHash, tentativeGScore);
        fScore.set(neighborHash, tentativeGScore + heuristic(neighbor));

        if (!openSet.contains(neighbor)) {
          openSet.enqueue(neighbor, fScore.get(neighborHash));
        }
      }
    }
  }

  // No solution found
  return { solved: false, path: null };
}

function heuristic(state: GameState): number {
  // Count how many segments are not in their "home" vial
  let score = 0;

  // Map of color -> ideal vial index
  const colorVialMap = new Map();

  // First, identify ideal vials for each color
  for (let i = 0; i < state.vials.length; i++) {
    const vial = state.vials[i];
    if (vial.isComplete()) {
      colorVialMap.set(vial.segments[0], i);
    }
  }

  // For each vial, count misplaced segments
  for (let i = 0; i < state.vials.length; i++) {
    const vial = state.vials[i];

    for (const color of vial.segments) {
      if (colorVialMap.has(color) && colorVialMap.get(color) !== i) {
        score++;
      }
    }
  }

  return score;
}
```

### 2. Handling Timeout for Complex Puzzles

For complex puzzles, the solver might take too long:

```typescript
function solvePuzzleWithTimeout(
  state: GameState,
  timeoutMs: number = 5000,
): {
  solved: boolean;
  path: Move[] | null;
  timedOut: boolean;
} {
  const startTime = Date.now();

  // Initialize BFS
  const queue = [{ state, path: [] }];
  const visited = new Set();
  visited.add(state.getStateHash());

  while (queue.length > 0) {
    // Check for timeout
    if (Date.now() - startTime > timeoutMs) {
      return { solved: false, path: null, timedOut: true };
    }

    // Continue with regular BFS
    const { state, path } = queue.shift();

    if (state.isComplete()) {
      return { solved: true, path, timedOut: false };
    }

    // Process moves...
    // [BFS implementation as before]
  }

  return { solved: false, path: null, timedOut: false };
}
```

## Testing and Validation

1. **Unit Tests**:
   - Test state representation and hashing
   - Verify move generation and application
   - Test seeded randomization produces consistent results
2. **Integration Tests**:
   - Verify BFS solver finds solutions for known solvable puzzles
   - Test level generation with different parameters
   - Ensure proper serialization and deserialization
3. **Stress Tests**:
   - Generate and solve puzzles with increasing complexity
   - Measure solver performance and timeout behavior
   - Monitor memory usage during large searches

## Advantages of this Approach

1. **Highly Variable Levels**: By using randomization, this approach can generate a wider variety of levels than the reverse-engineering method.

2. **Guaranteed Solvability**: The BFS solver verifies that each generated level has at least one solution.

3. **Optimal Solutions**: BFS finds the shortest possible solution path, which is useful for providing hints or optimal move counts.

4. **Tunable Difficulty**: By adjusting the number of colors and empty vials, the difficulty can be controlled.

5. **Reproducibility**: Using seeded randomization allows regenerating the exact same puzzle when needed.

## Conclusion

This design for a random level generator with solution verification combines the unpredictability of randomization with the certainty of algorithm-based verification. By using BFS as the core solving algorithm and incrementally adding empty vials as needed, it ensures that generated puzzles are both solvable and engaging.

The approach offers a complementary method to the reverse-engineering generator, providing a different distribution of puzzles while maintaining the same quality criteria for entropy, difficulty, and playability.
