/**
 * Entropy-reverse level generator.
 *
 * Generates a solvable level by walking backwards from a solved state using
 * predecessor moves (reverse of legal forward pours). A simple heuristic
 * guides selection toward higher entropy and fewer solved vials.
 */

import fs from "node:fs";
import path from "node:path";

import { glob } from "glob";

import { GameState } from "../src/lib/game-state";
import { solvePuzzle } from "../src/lib/puzzle-solver";
import {
  createInitialState,
  evaluateLevel,
  hasDesirableProperties,
} from "../src/lib/puzzle-utils";
import { SeededRandom } from "../src/lib/seeded-random";
import type { Move } from "../src/lib/types/puzzle-types";
import { Vial } from "../src/lib/vial";

type Color = string;
type LevelState = Color[][];

type CandidateScore = Readonly<{
  score: number;
  entropy: number;
  dispersion: number;
  mixedVials: number;
  runsMinusOne: number;
  uniformFullVials: number;
  solvedVials: number;
}>;

type PredecessorCandidate = Readonly<{
  state: LevelState;
  move: Move;
  score: CandidateScore;
}>;

function assertDefined<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new TypeError(message);
  }

  return value;
}

function cloneState(state: LevelState): LevelState {
  return state.map((vial) => [...vial]);
}

function encodeState(state: LevelState): string {
  return state.map((vial) => vial.join(",")).join("|");
}

function getTopColor(vial: Color[]): Color | null {
  const top = vial.at(-1);
  return top ?? null;
}

function countTopRunLength(vial: Color[], color: Color): number {
  let count = 0;
  for (let i = vial.length - 1; i >= 0; i--) {
    if (vial[i] === color) {
      count++;
    } else {
      break;
    }
  }

  return count;
}

function applyMaximalPour(
  state: LevelState,
  sourceIndex: number,
  targetIndex: number,
  capacity: number,
): { state: LevelState; amount: number } | null {
  if (sourceIndex === targetIndex) {
    return null;
  }

  const sourceVial = state[sourceIndex];
  const targetVial = state[targetIndex];

  if (!sourceVial || !targetVial) {
    return null;
  }

  if (sourceVial.length === 0) {
    return null;
  }

  if (targetVial.length >= capacity) {
    return null;
  }

  const topColor = getTopColor(sourceVial);
  if (!topColor) {
    return null;
  }

  const targetTop = getTopColor(targetVial);
  if (targetTop !== null && targetTop !== topColor) {
    return null;
  }

  const runLength = countTopRunLength(sourceVial, topColor);
  const available = capacity - targetVial.length;
  const amount = Math.min(runLength, available);

  if (amount <= 0) {
    return null;
  }

  const nextState = cloneState(state);
  const nextSource = assertDefined(
    nextState[sourceIndex],
    `Expected source vial at index ${sourceIndex}.`,
  );
  const nextTarget = assertDefined(
    nextState[targetIndex],
    `Expected target vial at index ${targetIndex}.`,
  );

  for (let i = 0; i < amount; i++) {
    const removed = nextSource.pop();
    if (removed === undefined) {
      return null;
    }
    nextTarget.push(removed);
  }

  return { state: nextState, amount };
}

function countColorRuns(vial: Color[]): number {
  if (vial.length === 0) {
    return 0;
  }

  let runs = 1;
  for (let i = 1; i < vial.length; i++) {
    if (vial[i] !== vial[i - 1]) {
      runs++;
    }
  }

  return runs;
}

function countSolvedVials(state: LevelState, capacity: number): number {
  let solved = 0;
  for (const vial of state) {
    if (vial.length === 0) {
      continue;
    }
    const first = vial[0];
    if (first && vial.every((segment) => segment === first)) {
      solved++;
    }
  }

  return solved;
}

function isSolvedLevelState(state: LevelState, capacity: number): boolean {
  for (const vial of state) {
    if (vial.length === 0) {
      continue;
    }
    if (vial.length !== capacity) {
      return false;
    }
    const first = vial[0];
    if (!first || !vial.every((segment) => segment === first)) {
      return false;
    }
  }

  return true;
}

function hasPartialVials(state: LevelState, capacity: number): boolean {
  return state.some((vial) => vial.length > 0 && vial.length < capacity);
}

function searchForGoalState(
  startState: LevelState,
  capacity: number,
  maxNodes: number,
  predicate: (state: LevelState) => boolean,
): { state: LevelState; reverseMoves: Move[] } | null {
  const queue: Array<{ state: LevelState; reverseMoves: Move[] }> = [
    { state: startState, reverseMoves: [] },
  ];
  const visited = new Set<string>();
  visited.add(encodeState(startState));

  while (queue.length > 0 && visited.size < maxNodes) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    if (predicate(current.state)) {
      return current;
    }

    const nextCandidates = generatePredecessors(current.state, capacity);
    for (const candidate of nextCandidates) {
      const key = encodeState(candidate.state);
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      queue.push({
        state: candidate.state,
        reverseMoves: [...current.reverseMoves, candidate.move],
      });
    }
  }

  return null;
}

function normalizeToFullOrEmpty(
  state: LevelState,
  capacity: number,
  emptyVials: number,
  rng: SeededRandom,
): LevelState {
  const segments: Color[] = [];
  for (const vial of state) {
    segments.push(...vial);
  }

  const colorCounts = new Map<Color, number>();
  for (const color of segments) {
    colorCounts.set(color, (colorCounts.get(color) ?? 0) + 1);
  }

  const arranged: Color[] = [];
  let lastColor: Color | null = null;
  while (arranged.length < segments.length) {
    const sorted = [...colorCounts.entries()].sort((a, b) => b[1] - a[1]);
    let picked: Color | null = null;
    for (const [color, count] of sorted) {
      if (count <= 0) {
        continue;
      }
      if (color !== lastColor) {
        picked = color;
        break;
      }
    }
    if (!picked) {
      const fallback = sorted.find(([, count]) => count > 0);
      picked = fallback ? fallback[0] : null;
    }
    if (!picked) {
      break;
    }
    arranged.push(picked);
    colorCounts.set(picked, (colorCounts.get(picked) ?? 1) - 1);
    lastColor = picked;
  }

  const totalVials = state.length;
  const fullVials = Math.max(0, totalVials - emptyVials);
  const normalized: LevelState = [];

  let cursor = 0;
  for (let i = 0; i < fullVials; i++) {
    const vialSegments = arranged.slice(cursor, cursor + capacity);
    cursor += capacity;
    normalized.push(vialSegments);
  }

  while (normalized.length < totalVials) {
    normalized.push([]);
  }

  if (isSolvedLevelState(normalized, capacity) && normalized.length >= 2) {
    const vialA = normalized[0];
    const vialB = normalized[1];
    if (
      vialA &&
      vialB &&
      vialA.length === capacity &&
      vialB.length === capacity
    ) {
      const topA = vialA.pop();
      const topB = vialB.pop();
      if (topA && topB) {
        vialA.push(topB);
        vialB.push(topA);
      }
    }
  }

  return normalized;
}

function calculateEntropyScore(
  state: LevelState,
  capacity: number,
): CandidateScore {
  let runsMinusOne = 0;
  let mixedVials = 0;
  let uniformFullVials = 0;
  const colorDistribution = new Map<Color, number>();

  for (const vial of state) {
    if (vial.length === 0) {
      continue;
    }

    const runCount = countColorRuns(vial);
    if (runCount > 1) {
      runsMinusOne += runCount - 1;
    }

    const isFullUniform =
      vial.length === capacity && vial.every((segment) => segment === vial[0]);
    if (!isFullUniform) {
      mixedVials++;
    } else {
      uniformFullVials++;
    }

    const vialColors = new Set(vial);
    for (const color of vialColors) {
      colorDistribution.set(color, (colorDistribution.get(color) ?? 0) + 1);
    }
  }

  let dispersion = 0;
  for (const count of colorDistribution.values()) {
    if (count > 1) {
      dispersion += count - 1;
    }
  }

  const entropy = runsMinusOne + mixedVials + dispersion;
  const score =
    dispersion * 3 + runsMinusOne * 2 + mixedVials * 2 - uniformFullVials;

  return {
    score,
    entropy,
    dispersion,
    mixedVials,
    runsMinusOne,
    uniformFullVials,
    solvedVials: countSolvedVials(state, capacity),
  };
}

function isBetterScore(a: CandidateScore, b: CandidateScore): boolean {
  if (a.score !== b.score) {
    return a.score > b.score;
  }
  if (a.solvedVials !== b.solvedVials) {
    return a.solvedVials < b.solvedVials;
  }
  if (a.entropy !== b.entropy) {
    return a.entropy > b.entropy;
  }

  return a.dispersion > b.dispersion;
}

function generatePredecessors(
  state: LevelState,
  capacity: number,
): PredecessorCandidate[] {
  const candidates: PredecessorCandidate[] = [];
  const stateKey = encodeState(state);

  for (let sourceIndex = 0; sourceIndex < state.length; sourceIndex++) {
    for (let targetIndex = 0; targetIndex < state.length; targetIndex++) {
      if (sourceIndex === targetIndex) {
        continue;
      }

      const sourceVial = state[sourceIndex];
      const targetVial = state[targetIndex];
      if (!sourceVial || !targetVial) {
        continue;
      }

      if (targetVial.length === 0) {
        continue;
      }

      const targetTop = getTopColor(targetVial);
      if (!targetTop) {
        continue;
      }

      const runLength = countTopRunLength(targetVial, targetTop);
      const sourceSpace = capacity - sourceVial.length;
      if (sourceSpace <= 0) {
        continue;
      }

      const maxMove = Math.min(runLength, sourceSpace);
      for (let amount = 1; amount <= maxMove; amount++) {
        const predecessor = cloneState(state);
        const predecessorSource = assertDefined(
          predecessor[sourceIndex],
          `Expected predecessor source at index ${sourceIndex}.`,
        );
        const predecessorTarget = assertDefined(
          predecessor[targetIndex],
          `Expected predecessor target at index ${targetIndex}.`,
        );

        let ok = true;
        for (let i = 0; i < amount; i++) {
          const moved = predecessorTarget.pop();
          if (moved === undefined) {
            ok = false;
            break;
          }
          predecessorSource.push(moved);
        }

        if (!ok) {
          continue;
        }

        const forward = applyMaximalPour(
          predecessor,
          sourceIndex,
          targetIndex,
          capacity,
        );
        if (!forward) {
          continue;
        }

        if (encodeState(forward.state) !== stateKey) {
          continue;
        }

        const score = calculateEntropyScore(predecessor, capacity);
        candidates.push({
          state: predecessor,
          move: {
            sourceVialIndex: sourceIndex,
            targetVialIndex: targetIndex,
            colorsToPour: forward.amount,
          },
          score,
        });
      }
    }
  }

  return candidates;
}

function pickCandidate(
  candidates: PredecessorCandidate[],
  rng: SeededRandom,
  beamWidth: number,
  epsilon: number,
  currentScore: CandidateScore,
): PredecessorCandidate | null {
  if (candidates.length === 0) {
    return null;
  }

  const sorted = [...candidates].sort((a, b) => {
    if (a.score.score !== b.score.score) {
      return b.score.score - a.score.score;
    }
    if (a.score.solvedVials !== b.score.solvedVials) {
      return a.score.solvedVials - b.score.solvedVials;
    }
    if (a.score.entropy !== b.score.entropy) {
      return b.score.entropy - a.score.entropy;
    }

    return b.score.dispersion - a.score.dispersion;
  });

  const beam = sorted.slice(0, beamWidth);
  if (beam.length === 0) {
    return null;
  }

  const improving = beam.filter((candidate) =>
    isBetterScore(candidate.score, currentScore),
  );

  if (improving.length === 0) {
    return null;
  }

  if (rng.next() < epsilon) {
    const index = rng.nextInt(0, improving.length);
    return improving[index] ?? improving[0] ?? null;
  }

  return improving[0] ?? null;
}

function searchForNoSolvedVials(
  startState: LevelState,
  capacity: number,
  maxNodes: number,
): { state: LevelState; reverseMoves: Move[] } | null {
  const startKey = encodeState(startState);
  const queue: Array<{ state: LevelState; reverseMoves: Move[] }> = [
    { state: startState, reverseMoves: [] },
  ];
  const visited = new Set<string>();
  visited.add(startKey);

  while (queue.length > 0 && visited.size < maxNodes) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    if (countSolvedVials(current.state, capacity) === 0) {
      return current;
    }

    const nextCandidates = generatePredecessors(current.state, capacity);
    for (const candidate of nextCandidates) {
      const key = encodeState(candidate.state);
      if (visited.has(key)) {
        continue;
      }
      visited.add(key);
      queue.push({
        state: candidate.state,
        reverseMoves: [...current.reverseMoves, candidate.move],
      });
    }
  }

  return null;
}

function buildSolvedState(
  colorCount: number,
  vialHeight: number,
  emptyVials: number,
): LevelState {
  const state: LevelState = [];
  const palette = [
    "red",
    "blue",
    "green",
    "yellow",
    "purple",
    "orange",
    "cyan",
    "magenta",
    "lime",
    "pink",
    "brown",
    "teal",
  ];

  for (let i = 0; i < colorCount; i++) {
    const color = assertDefined(
      palette[i],
      `Expected color palette entry at index ${i}.`,
    );
    state.push(Array.from({ length: vialHeight }, () => color));
  }

  for (let i = 0; i < emptyVials; i++) {
    state.push([]);
  }

  return state;
}

function toGameState(
  state: LevelState,
  colorCount: number,
  emptyVials: number,
  vialHeight: number,
): GameState {
  const vials = state.map((segments) => {
    const vial = new Vial(vialHeight);
    vial.segments = [...segments];
    return vial;
  });

  return new GameState(vials, colorCount, emptyVials);
}

function serializeLevel(
  initialState: GameState,
  shuffledState: GameState,
  solutionMoves: Move[],
  metrics: { difficulty: number; entropy: number; fragmentation: number },
): string {
  const levelData = {
    initialState: {
      vials: initialState.vials.map((vial) => ({ segments: vial.segments })),
      colorCount: initialState.colorCount,
      emptyVialCount: initialState.emptyVialCount,
    },
    shuffledState: {
      vials: shuffledState.vials.map((vial) => ({ segments: vial.segments })),
    },
    solutionMoves: solutionMoves.map((move) => ({
      source: move.sourceVialIndex,
      target: move.targetVialIndex,
      amount: move.colorsToPour,
    })),
    metadata: {
      vialCapacity: assertDefined(
        initialState.vials[0],
        "Expected at least one vial in initial state.",
      ).capacity,
      totalVials: initialState.totalVials,
      difficulty: metrics.difficulty,
      entropy: metrics.entropy,
      fragmentation: metrics.fragmentation,
      estimatedSolutionSteps: solutionMoves.length,
      generationMethod: "entropy-reverse",
    },
  };

  return JSON.stringify(levelData, null, 2);
}

type GenerateLevelOptions = {
  seed?: number | string;
  colorCount?: number;
  vialHeight?: number;
  emptyVials?: number;
  targetShuffleMoves?: number;
  entropyThreshold?: number;
  beamWidth?: number;
  epsilon?: number;
  attempts?: number;
  relaxEntropy?: boolean;
  allowPartialVials?: boolean;
  maxDurationMs?: number;
  maximizeEntropy?: boolean;
  outputPath?: string;
};

export default function generateEntropyReverseLevel(
  options: GenerateLevelOptions,
): string | null {
  const {
    seed = Date.now(),
    colorCount = 6,
    vialHeight = 4,
    emptyVials = 2,
    targetShuffleMoves = 25,
    entropyThreshold,
    beamWidth = 6,
    epsilon = 0.15,
    attempts = 20,
    relaxEntropy = true,
    allowPartialVials = false,
    maxDurationMs = 120000,
    maximizeEntropy = false,
    outputPath,
  } = options;

  const maxSteps = Math.max(targetShuffleMoves, colorCount * 2);
  const threshold =
    entropyThreshold ?? Math.max(1, Math.floor(colorCount * vialHeight * 0.6));

  const initialState = createInitialState(colorCount, vialHeight, emptyVials);
  const solvedState = buildSolvedState(colorCount, vialHeight, emptyVials);

  console.log(`Starting entropy-reverse generation with seed: ${seed}`);
  console.log(
    `Parameters: colors=${colorCount}, height=${vialHeight}, entropy>=${threshold.toString()}`,
  );

  const startedAt = Date.now();
  let bestResult: {
    state: LevelState;
    moves: Move[];
    metrics: ReturnType<typeof evaluateLevel>;
  } | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (Date.now() - startedAt > maxDurationMs) {
      break;
    }
    const attemptSeed =
      typeof seed === "number" ? seed + attempt : `${seed}-${attempt}`;
    const rng = new SeededRandom(attemptSeed);
    const attemptThreshold = relaxEntropy
      ? Math.max(1, threshold - attempt)
      : threshold;

    let current = solvedState;
    let currentScore = calculateEntropyScore(current, vialHeight);
    let bestState = current;
    let bestScore = currentScore;
    let bestReverseMoves: Move[] = [];
    let bestNoSolvedState: LevelState | null = null;
    let bestNoSolvedScore: CandidateScore | null = null;
    let bestNoSolvedMoves: Move[] = [];

    const reverseMoves: Move[] = [];
    const visited = new Set<string>();
    visited.add(encodeState(current));
    let lastMoveKey: string | null = null;

    for (let step = 0; step < maxSteps; step++) {
      if (Date.now() - startedAt > maxDurationMs) {
        break;
      }
      const minLowerBound = Math.max(1, Math.floor(attemptThreshold * 0.5));
      const candidates = generatePredecessors(current, vialHeight).filter(
        (candidate) => {
          if (visited.has(encodeState(candidate.state))) {
            return false;
          }
          if (
            lastMoveKey &&
            `${candidate.move.sourceVialIndex}->${candidate.move.targetVialIndex}` ===
              lastMoveKey
          ) {
            return false;
          }
          if (!maximizeEntropy && candidate.score.entropy < minLowerBound) {
            return false;
          }

          return true;
        },
      );

      const nextCandidate = pickCandidate(
        candidates,
        rng,
        beamWidth,
        epsilon,
        currentScore,
      );

      if (!nextCandidate) {
        break;
      }

      current = nextCandidate.state;
      currentScore = nextCandidate.score;
      reverseMoves.push(nextCandidate.move);
      visited.add(encodeState(current));
      lastMoveKey = `${nextCandidate.move.sourceVialIndex}->${nextCandidate.move.targetVialIndex}`;

      if (isBetterScore(currentScore, bestScore)) {
        bestState = current;
        bestScore = currentScore;
        bestReverseMoves = [...reverseMoves];
      }

      if (currentScore.solvedVials === 0) {
        if (
          !bestNoSolvedScore ||
          isBetterScore(currentScore, bestNoSolvedScore)
        ) {
          bestNoSolvedState = current;
          bestNoSolvedScore = currentScore;
          bestNoSolvedMoves = [...reverseMoves];
        }
      }

      const isReady = currentScore.entropy >= attemptThreshold;
      if (isReady) {
        bestState = current;
        bestScore = currentScore;
        bestReverseMoves = [...reverseMoves];
        break;
      }
    }

    if (bestReverseMoves.length === 0) {
      const candidates = generatePredecessors(current, vialHeight);
      const fallback = pickCandidate(
        candidates,
        rng,
        beamWidth,
        epsilon,
        currentScore,
      );
      if (fallback) {
        bestState = fallback.state;
        bestScore = fallback.score;
        bestReverseMoves = [fallback.move];
      }
    }

    if (bestReverseMoves.length === 0) {
      continue;
    }

    let selectedState = bestState;
    let selectedScore = bestScore;
    let selectedMoves = bestReverseMoves;

    if (bestNoSolvedState && bestNoSolvedScore) {
      selectedState = bestNoSolvedState;
      selectedScore = bestNoSolvedScore;
      selectedMoves = bestNoSolvedMoves;
    } else {
      const rescue = searchForNoSolvedVials(bestState, vialHeight, 200000);
      if (rescue) {
        selectedState = rescue.state;
        selectedScore = calculateEntropyScore(selectedState, vialHeight);
        selectedMoves = [...bestReverseMoves, ...rescue.reverseMoves];
      }
    }

    if (selectedState.every((vial) => vial.length === 0)) {
      continue;
    }

    if (
      isSolvedLevelState(selectedState, vialHeight) ||
      hasPartialVials(selectedState, vialHeight)
    ) {
      const goal = (state: LevelState) =>
        !isSolvedLevelState(state, vialHeight) &&
        !hasPartialVials(state, vialHeight);
      const fixup = searchForGoalState(selectedState, vialHeight, 200000, goal);
      if (!fixup) {
        continue;
      }
      selectedState = fixup.state;
      selectedScore = calculateEntropyScore(selectedState, vialHeight);
      selectedMoves = [...selectedMoves, ...fixup.reverseMoves];
    }

    let finalState = selectedState;
    let solutionMoves = [...selectedMoves].reverse();

    if (!allowPartialVials) {
      if (
        hasPartialVials(finalState, vialHeight) ||
        isSolvedLevelState(finalState, vialHeight)
      ) {
        finalState = normalizeToFullOrEmpty(
          finalState,
          vialHeight,
          emptyVials,
          rng,
        );
        const normalizedGameState = toGameState(
          finalState,
          colorCount,
          emptyVials,
          vialHeight,
        );
        const solveResult = solvePuzzle(normalizedGameState, 20000, 100000);
        if (!solveResult.solved || !solveResult.path) {
          continue;
        }
        solutionMoves = solveResult.path;
      }
    } else if (isSolvedLevelState(finalState, vialHeight)) {
      continue;
    }

    const shuffledState = toGameState(
      finalState,
      colorCount,
      emptyVials,
      vialHeight,
    );

    const metrics = evaluateLevel(shuffledState, solutionMoves);
    if (metrics.entropy < attemptThreshold && !maximizeEntropy) {
      continue;
    }

    if (!bestResult || metrics.entropy > bestResult.metrics.entropy) {
      bestResult = { state: finalState, moves: solutionMoves, metrics };
    }

    if (maximizeEntropy) {
      if (Date.now() - startedAt > maxDurationMs) {
        break;
      }
      continue;
    }
    const levelJson = serializeLevel(
      initialState,
      shuffledState,
      solutionMoves,
      metrics,
    );

    const levelPath = outputPath || generateLevelFilename();
    const dir = path.dirname(levelPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(levelPath, levelJson);

    console.log(`Generated new level: ${levelPath}`);
    console.log(`- Colors: ${colorCount}`);
    console.log(`- Empty vials: ${emptyVials}`);
    console.log(`- Vial height: ${vialHeight}`);
    console.log(`- Entropy: ${metrics.entropy}`);
    console.log(`- Difficulty: ${metrics.difficulty}`);
    console.log(`- Solution steps: ${solutionMoves.length}`);

    return levelPath;
  }

  if (bestResult) {
    const shuffledState = toGameState(
      bestResult.state,
      colorCount,
      emptyVials,
      vialHeight,
    );
    const levelJson = serializeLevel(
      initialState,
      shuffledState,
      bestResult.moves,
      bestResult.metrics,
    );

    const levelPath = outputPath || generateLevelFilename();
    const dir = path.dirname(levelPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(levelPath, levelJson);

    console.log(`Generated new level: ${levelPath}`);
    console.log(`- Colors: ${colorCount}`);
    console.log(`- Empty vials: ${emptyVials}`);
    console.log(`- Vial height: ${vialHeight}`);
    console.log(`- Entropy: ${bestResult.metrics.entropy}`);
    console.log(`- Difficulty: ${bestResult.metrics.difficulty}`);
    console.log(`- Solution steps: ${bestResult.moves.length}`);

    return levelPath;
  }

  console.error("Failed to generate a valid entropy-reverse level.");
  return null;
}

function generateLevelFilename(): string {
  const existingLevels = glob.sync("levels/level-*.json");
  const levelNumbers = existingLevels.map((filename: string) => {
    const match = filename.match(/level-(\d+)\.json/);
    if (!match?.[1]) {
      return 0;
    }

    return Number.parseInt(match[1], 10);
  });

  const highestNumber = levelNumbers.length > 0 ? Math.max(...levelNumbers) : 0;

  return `levels/level-${highestNumber + 1}.json`;
}

if (import.meta.main) {
  generateEntropyReverseLevel({
    seed: Date.now(),
    colorCount: 6,
    vialHeight: 4,
    emptyVials: 2,
    targetShuffleMoves: 25,
  });
}
