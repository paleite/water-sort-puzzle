/**
 * High-entropy level generator: start from a sorted state, add exactly
 * two empty vials, shuffle until entropy is high, then verify solvability.
 */

import fs from "node:fs";
import path from "node:path";

import { glob } from "glob";

import { GameState } from "../src/lib/game-state";
import { solvePuzzle } from "../src/lib/puzzle-solver";
import {
  calculateEntropy,
  createInitialState,
  evaluateLevel,
  hasDesirableProperties,
  randomizeVials,
} from "../src/lib/puzzle-utils";
import { SeededRandom } from "../src/lib/seeded-random";
import type { Move } from "../src/lib/types/puzzle-types";
import { Vial } from "../src/lib/vial";

function assertDefined<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new TypeError(message);
  }

  return value;
}

function generateLevelFilename(): string {
  const existingLevels = glob.sync("levels/level-*.json");
  const levelNumbers = existingLevels.map((filename: string) => {
    const match = new RegExp(/level-(\d+)\.json/).exec(filename);
    if (!match?.[1]) {
      return 0;
    }

    return Number.parseInt(match[1], 10);
  });

  const highestNumber = levelNumbers.length > 0 ? Math.max(...levelNumbers) : 0;

  return `levels/level-${highestNumber + 1}.json`;
}

function serializeLevel(
  state: GameState,
  solutionMoves: Move[],
  metrics: { difficulty: number; entropy: number; fragmentation: number },
): string {
  const colorSet = new Set<string>();
  for (const vial of state.vials) {
    for (const segment of vial.segments) {
      colorSet.add(segment);
    }
  }

  const firstVial = assertDefined(
    state.vials[0],
    "Expected at least one vial in state.",
  );
  const vialHeight = firstVial.capacity;

  const sortedVials: Vial[] = [];
  for (const color of colorSet) {
    const vial = new Vial(vialHeight);
    for (let i = 0; i < vialHeight; i++) {
      vial.segments.push(color);
    }
    sortedVials.push(vial);
  }

  for (let i = 0; i < state.emptyVialCount; i++) {
    sortedVials.push(new Vial(vialHeight));
  }

  const sortedState = new GameState(
    sortedVials,
    colorSet.size,
    state.emptyVialCount,
  );

  const levelData = {
    initialState: {
      vials: sortedState.vials.map((vial) => ({
        segments: vial.segments,
      })),
      colorCount: colorSet.size,
      emptyVialCount: state.emptyVialCount,
    },
    shuffledState: {
      vials: state.vials.map((vial) => ({
        segments: vial.segments,
      })),
    },
    solutionMoves: solutionMoves.map((move) => ({
      source: move.sourceVialIndex,
      target: move.targetVialIndex,
      amount: move.colorsToPour,
    })),
    metadata: {
      vialCapacity: firstVial.capacity,
      totalVials: state.totalVials,
      difficulty: metrics.difficulty,
      entropy: metrics.entropy,
      fragmentation: metrics.fragmentation,
      estimatedSolutionSteps: solutionMoves.length,
      generationMethod: "entropy-shuffle-with-solver",
    },
  };

  return JSON.stringify(levelData, null, 2);
}

type EntropyGeneratorOptions = {
  seed?: number | string;
  colorCount?: number;
  vialHeight?: number;
  attempts?: number;
  timeoutMs?: number;
  maxSteps?: number;
  maxSolutionSteps?: number;
  entropyFactor?: number;
  outputPath?: string;
};

export default function generateHighEntropyLevel(
  options: EntropyGeneratorOptions = {},
): string | null {
  const {
    seed = Date.now(),
    colorCount = 10,
    vialHeight = 4,
    attempts = 20,
    timeoutMs = 45000,
    maxSteps = 80000,
    maxSolutionSteps = 40,
    entropyFactor = 2.0,
    outputPath,
  } = options;

  const rng = new SeededRandom(seed);
  const levelPath = outputPath || generateLevelFilename();

  const initialState = createInitialState(colorCount, vialHeight, 2);
  const minEntropy = colorCount * vialHeight * entropyFactor;

  console.log(`Starting high-entropy generation with seed: ${seed}`);
  console.log(
    `Parameters: colors=${colorCount}, height=${vialHeight}, entropy>=${minEntropy.toString()}`,
  );

  let lastSolutionSteps: number | null = null;

  for (let i = 0; i < attempts; i++) {
    const candidate = randomizeVials(initialState, rng);
    if (!hasDesirableProperties(candidate)) {
      continue;
    }

    const entropy = calculateEntropy(candidate);
    if (Math.random() < 0.2) {
      console.log(
        `🔎 Shuffle ${i + 1}/${attempts}: entropy ${entropy.toString()}.`,
      );
    }
    if (entropy < minEntropy) {
      continue;
    }

    console.log(
      `🧪 Candidate ${i + 1} meets entropy (${entropy.toString()}); solving with cap ${maxSolutionSteps.toString()} steps.`,
    );
    const solutionResult = solvePuzzle(candidate, timeoutMs, maxSteps, {
      progress: { logEveryMs: 1000, logEveryStates: 2000 },
      preferCanonical: false,
    });
    if (!solutionResult.solved || !solutionResult.path) {
      console.log(
        `❌ Candidate ${i + 1} unsolved (solver breadth cap: ${maxSteps.toString()} states, timeout ${timeoutMs.toString()}ms).`,
      );
      continue;
    }
    if (solutionResult.path.length > maxSolutionSteps) {
      console.log(
        `❌ Candidate ${i + 1} solved in ${solutionResult.path.length.toString()} steps (over cap ${maxSolutionSteps.toString()}).`,
      );
      continue;
    }

    const metrics = evaluateLevel(candidate, solutionResult.path);
    if (!metrics.isValid) {
      continue;
    }

    console.log(
      `✅ Candidate ${i + 1} solved in ${solutionResult.path.length.toString()} steps (entropy ${metrics.entropy.toString()}).`,
    );
    if (lastSolutionSteps === null) {
      console.log(
        `ℹ️ Solution steps initialized at ${solutionResult.path.length.toString()}.`,
      );
    } else if (solutionResult.path.length !== lastSolutionSteps) {
      console.log(
        `ℹ️ Solution steps changed from ${lastSolutionSteps.toString()} to ${solutionResult.path.length.toString()}.`,
      );
    }
    lastSolutionSteps = solutionResult.path.length;

    const levelJson = serializeLevel(candidate, solutionResult.path, metrics);

    const dir = path.dirname(levelPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(levelPath, levelJson);

    console.log(`Generated new level: ${levelPath}`);
    console.log(`- Colors: ${colorCount}`);
    console.log(`- Empty vials: 2`);
    console.log(`- Vial height: ${vialHeight}`);
    console.log(`- Entropy: ${metrics.entropy}`);
    console.log(`- Difficulty: ${metrics.difficulty}`);
    console.log(`- Solution steps: ${solutionResult.path.length}`);

    return levelPath;
  }

  console.error("Failed to generate a solvable high-entropy level.");

  return null;
}

if (import.meta.main) {
  generateHighEntropyLevel({
    seed: Date.now(),
    colorCount: 10,
    vialHeight: 4,
    attempts: 25,
    timeoutMs: 120_000,
    maxSteps: 1_000_000,
    maxSolutionSteps: 40,
    entropyFactor: 2.0,
  });
}
