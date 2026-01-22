import type { Color } from "./types/puzzle-types";

/**
 * Represents a single vial in the puzzle
 */
export class Vial {
  segments: Color[];
  capacity: number;

  constructor(capacity: number) {
    this.segments = [];
    this.capacity = capacity;
  }

  isEmpty(): boolean {
    return this.segments.length === 0;
  }

  isFull(): boolean {
    return this.segments.length === this.capacity;
  }

  isComplete(): boolean {
    if (this.isEmpty()) {
      return true;
    }
    const firstColor = this.segments[0];
    if (firstColor === undefined) {
      throw new TypeError("Expected a top segment color in a vial.");
    }

    const allSame = this.segments.every((segment) => segment === firstColor);
    if (!allSame) {
      return false;
    }

    return this.isFull() || this.capacity <= 2;
  }

  getTopColor(): Color | null {
    if (this.isEmpty()) {
      return null;
    }
    const topColor = this.segments.at(-1);
    if (topColor === undefined) {
      throw new TypeError("Expected a top segment color in a non-empty vial.");
    }

    return topColor;
  }

  canReceive(color: Color): boolean {
    return !this.isFull() && (this.isEmpty() || this.getTopColor() === color);
  }

  clone(): Vial {
    const newVial = new Vial(this.capacity);
    newVial.segments = [...this.segments];

    return newVial;
  }
}
