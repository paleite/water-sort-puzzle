import type { GameState } from "./game-state";
import { prioritizeMoves, wouldCompleteVial } from "./puzzle-utils";
import type { Move } from "./types/puzzle-types";

/**
 * Use BFS to find a solution path, with optimizations
 */
export function solvePuzzle(
  initialState: GameState,
  timeoutMs: number = 5000,
  maxSteps: number = 1000,
): {
  solved: boolean;
  path: Move[] | null;
  timedOut: boolean;
} {
  const startTime = Date.now();

  // Initialize BFS queue with the initial state
  const queue: { state: GameState; path: Move[]; lastMove?: Move }[] = [
    { state: initialState, path: [] },
  ];
  const visited = new Set<string>();
  visited.add(initialState.getStateHash());

  // Stats for debugging
  let statesExplored = 0;
  let statesPruned = 0;

  // BFS loop
  while (queue.length > 0 && statesExplored < maxSteps) {
    // Check for timeout
    if (Date.now() - startTime > timeoutMs) {
      console.log(
        `Solver timed out after exploring ${statesExplored.toString()} states (pruned ${statesPruned.toString()}).`,
      );
      return { solved: false, path: null, timedOut: true };
    }

    const current = queue.shift();
    if (!current) {
      break;
    }

    const { state, path, lastMove } = current;
    statesExplored++;

    // Check if puzzle is solved
    if (state.isComplete()) {
      console.log(
        `Found solution after exploring ${statesExplored.toString()} states (pruned ${statesPruned.toString()}).`,
      );
      return { solved: true, path, timedOut: false };
    }

    // Get all available moves from current state
    const moves = state.getAvailableMoves();
    const effectiveMoves: Move[] = [];

    // Filter out ineffective moves
    for (const move of moves) {
      const sourceVial = state.vials[move.sourceVialIndex];
      const targetVial = state.vials[move.targetVialIndex];

      if (!sourceVial || !targetVial) {
        continue;
      }

      // Skip trivial moves (e.g., moving between empty vials)
      if (sourceVial.isEmpty()) {
        statesPruned++;
        continue;
      }

      // Skip moves that pour to an empty vial if we've already poured to another empty vial
      // This prevents exploring symmetric states where only empty vials are different
      if (targetVial.isEmpty()) {
        let hasAnotherEmptyTarget = false;

        // If there's more than one empty vial and we've already poured to one recently,
        // skip this to avoid exploring symmetric states
        for (let i = 0; i < move.targetVialIndex; i++) {
          const vial = state.vials[i];
          if (vial && vial.isEmpty()) {
            statesPruned++;
            hasAnotherEmptyTarget = true;
            break;
          }
        }

        if (hasAnotherEmptyTarget) {
          continue;
        }
      }

      // Skip moves that undo the last move
      if (
        lastMove &&
        move.sourceVialIndex === lastMove.targetVialIndex &&
        move.targetVialIndex === lastMove.sourceVialIndex
      ) {
        statesPruned++;
        continue;
      }

      // Also skip moves where we're moving from a vial that we just poured into,
      // unless it would empty the vial or complete another vial
      if (
        lastMove &&
        move.sourceVialIndex === lastMove.targetVialIndex &&
        sourceVial.segments.length > 1 &&
        !wouldCompleteVial(state, move)
      ) {
        statesPruned++;
        continue;
      }

      // This is an effective move
      effectiveMoves.push(move);
    }

    // Prioritize moves - prefer moves that:
    // 1. Complete a vial
    // 2. Empty a vial
    // 3. Consolidate the same color
    const prioritizedMoves = prioritizeMoves(effectiveMoves, state);

    // Process each move
    for (const move of prioritizedMoves) {
      // Apply the move to get the new state
      const newState = state.applyMove(move);
      const stateHash = newState.getStateHash();

      // If this state hasn't been visited, add it to the queue
      if (!visited.has(stateHash)) {
        visited.add(stateHash);
        queue.push({
          state: newState,
          path: [...path, move],
          lastMove: move,
        });
      }
    }
  }

  console.log(
    `Search exhausted after exploring ${statesExplored.toString()} states (pruned ${statesPruned.toString()}).`,
  );

  // If queue is empty or we exceeded maxSteps
  return {
    solved: false,
    path: null,
    timedOut: statesExplored >= maxSteps,
  };
}
