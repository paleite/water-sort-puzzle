import { countTopSegmentsOfSameColor } from "./puzzle-utils";
import type { Move } from "./types/puzzle-types";
import type { Vial } from "./vial";

/**
 * Represents the entire game state
 */
export class GameState {
  vials: Vial[];
  colorCount: number;
  emptyVialCount: number;
  totalVials: number;

  constructor(vials: Vial[], colorCount: number, emptyVialCount: number) {
    this.vials = vials;
    this.colorCount = colorCount;
    this.emptyVialCount = emptyVialCount;
    this.totalVials = vials.length;
  }

  isComplete(): boolean {
    return this.vials.every((vial) => vial.isComplete());
  }

  getAvailableMoves(): Move[] {
    const moves: Move[] = [];

    // For each vial
    for (let i = 0; i < this.totalVials; i++) {
      const sourceVial = this.vials[i];
      if (!sourceVial) {
        continue;
      }

      // Skip empty vials as source
      if (sourceVial.isEmpty()) {
        continue;
      }

      const topColor = sourceVial.getTopColor();
      if (topColor === null) {
        continue;
      }

      // Find all valid target vials
      for (let j = 0; j < this.totalVials; j++) {
        // Skip same vial
        if (i === j) {
          continue;
        }

        const targetVial = this.vials[j];
        if (!targetVial) {
          continue;
        }

        // Move is valid if target can receive the color
        if (targetVial.canReceive(topColor)) {
          // Calculate number of segments of same color at the top of source vial
          const colorsToPour = countTopSegmentsOfSameColor(
            sourceVial,
            topColor,
          );

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

  applyMove(move: Move): GameState {
    const newState = this.clone();

    const sourceVial = newState.vials[move.sourceVialIndex];
    const targetVial = newState.vials[move.targetVialIndex];

    if (!sourceVial || !targetVial) {
      return newState; // Return unchanged state if vials don't exist
    }

    // Get the color to pour
    const colorToPour = sourceVial.getTopColor();
    if (colorToPour === null) {
      return newState; // Return unchanged state if source is empty
    }

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

  getStateHash(): string {
    // Create a hash of the current state for detecting duplicates
    return this.vials.map((vial) => vial.segments.join(",")).join("|");
  }

  clone(): GameState {
    const newVials = this.vials.map((vial) => vial.clone());
    return new GameState(newVials, this.colorCount, this.emptyVialCount);
  }
}
