import { countTopSegmentsOfSameColor } from "./puzzle-utils";
import type { Move } from "./types/puzzle-types";
import type { Vial } from "./vial";

function assertDefined<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new TypeError(message);
  }
  return value;
}

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
      const sourceVial = assertDefined(
        this.vials[i],
        `Expected source vial at index ${i}.`,
      );

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

        const targetVial = assertDefined(
          this.vials[j],
          `Expected target vial at index ${j}.`,
        );

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

    const sourceVial = assertDefined(
      newState.vials[move.sourceVialIndex],
      `Expected source vial at index ${move.sourceVialIndex}.`,
    );
    const targetVial = assertDefined(
      newState.vials[move.targetVialIndex],
      `Expected target vial at index ${move.targetVialIndex}.`,
    );

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
