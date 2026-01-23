/**
 * Random level generator that picks a color count in a fixed range,
 * ensures solvability, and stores the level in ./levels as the next number.
 */

import generateRandomLevel from "./random-level-generator";

import { SeededRandom } from "../src/lib/seeded-random";

type GeneratorOptions = {
  seed?: number | string;
  minColors?: number;
  maxColors?: number;
  vialHeight?: number;
  maxEmptyVials?: number;
  attempts?: number;
  timeoutMs?: number;
};

function pickColorCount(
  rng: SeededRandom,
  minColors: number,
  maxColors: number,
): number {
  const min = Math.min(minColors, maxColors);
  const max = Math.max(minColors, maxColors);

  return rng.nextInt(min, max + 1);
}

export function generateRandomLevelFile(
  options: GeneratorOptions = {},
): string {
  const {
    seed = Date.now(),
    minColors = 10,
    maxColors = 12,
    vialHeight = 4,
    maxEmptyVials = 3,
    attempts = 12,
    timeoutMs = 90000,
  } = options;

  const rng = new SeededRandom(seed);
  const colorCount = pickColorCount(rng, minColors, maxColors);

  const levelPath = generateRandomLevel({
    seed,
    colorCount,
    vialHeight,
    maxEmptyVials,
    attempts,
    timeoutMs,
  });

  if (!levelPath) {
    throw new Error(
      `Failed to generate a solvable level for ${colorCount} colors.`,
    );
  }

  console.log(`Generated random level at ${levelPath}`);
  console.log(`- Colors: ${colorCount}`);
  console.log(`- Seed: ${seed}`);

  return levelPath;
}

if (import.meta.main) {
  generateRandomLevelFile();
}
