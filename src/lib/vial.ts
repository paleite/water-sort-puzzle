import type { Color } from "./types/puzzle-types";

/**
 * Represents a single vial in the puzzle
 */
export class Vial {
  private segments: Color[];
  private capacity: number;

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
    return (
      this.isEmpty() ||
      (this.isFull() &&
        this.segments.every((segment) => segment === this.segments[0]))
    );
  }

  getTopColor(): Color | null {
    return this.isEmpty() ? null : this.segments[this.segments.length - 1];
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
