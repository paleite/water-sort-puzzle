/**
 * Seeded random number generator for reproducible randomization
 */
export class SeededRandom {
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

/**
 * Fisher-Yates shuffle algorithm with seeded randomness
 */
export function shuffleArray<T>(array: T[], rng: SeededRandom): T[] {
  // Make a copy of the array to avoid modifying the original
  const result = [...array];

  // Fisher-Yates shuffle
  for (let i = result.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i + 1);
    const temp = result[i];
    if (temp !== undefined && result[j] !== undefined) {
      result[i] = result[j];
      result[j] = temp;
    }
  }

  return result;
}
