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
  distinctColors: number;
  topDiversity: number;
  partialVials: number;
  emptyVials: number;
  adjacentDuplicates: number;
  averageDistinctColors: number;
}>;

type PredecessorCandidate = Readonly<{
  state: LevelState;
  move: Move;
  score: CandidateScore;
}>;

type GenerationPhase = "mix" | "pack";

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

function hasAdjacentDuplicates(state: LevelState): boolean {
  for (const vial of state) {
    if (vial.length <= 1) {
      continue;
    }
    for (let i = 1; i < vial.length; i++) {
      if (vial[i] === vial[i - 1]) {
        return true;
      }
    }
  }

  return false;
}

function countAdjacentDuplicates(state: LevelState): number {
  let duplicates = 0;
  for (const vial of state) {
    if (vial.length <= 1) {
      continue;
    }
    for (let i = 1; i < vial.length; i++) {
      if (vial[i] === vial[i - 1]) {
        duplicates++;
      }
    }
  }

  return duplicates;
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
    const candidates = sorted.filter(([, count]) => count > 0);
    let picked: Color | null = null;
    const pickCount = Math.min(3, candidates.length);
    const startIndex = pickCount > 0 ? rng.nextInt(0, pickCount) : 0;
    for (let offset = 0; offset < candidates.length; offset++) {
      const entry = candidates[(startIndex + offset) % candidates.length];
      if (!entry) {
        continue;
      }
      const [color, count] = entry;
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

function buildHighEntropyFullState(
  state: LevelState,
  capacity: number,
  emptyVials: number,
  rng: SeededRandom,
): LevelState {
  const segments: Color[] = [];
  for (const vial of state) {
    segments.push(...vial);
  }

  const totalVials = state.length;
  const fullVials = Math.max(0, totalVials - emptyVials);
  const vials: LevelState = Array.from({ length: fullVials }, () => []);

  const remaining = new Map<Color, number>();
  for (const color of segments) {
    remaining.set(color, (remaining.get(color) ?? 0) + 1);
  }

  const presenceByColor = new Map<Color, number>();

  for (let slot = 0; slot < capacity; slot++) {
    for (let vialIndex = 0; vialIndex < fullVials; vialIndex++) {
      const vial = vials[vialIndex];
      if (!vial) {
        continue;
      }

      const lastColor = vial[vial.length - 1] ?? null;
      const candidates = [...remaining.entries()]
        .filter(([, count]) => count > 0)
        .map(([color, count]) => {
          const presence = presenceByColor.get(color) ?? 0;
          const penalty = color === lastColor ? 1 : 0;

          return { color, count, presence, penalty };
        })
        .sort((a, b) => {
          if (a.penalty !== b.penalty) {
            return a.penalty - b.penalty;
          }
          if (a.presence !== b.presence) {
            return a.presence - b.presence;
          }
          return b.count - a.count;
        });

      const pickCount = Math.min(3, candidates.length);
      const pick = candidates[rng.nextInt(0, pickCount)] ?? candidates[0];
      if (!pick) {
        continue;
      }

      vial.push(pick.color);
      remaining.set(pick.color, (remaining.get(pick.color) ?? 1) - 1);
      presenceByColor.set(
        pick.color,
        (presenceByColor.get(pick.color) ?? 0) + 1,
      );
    }
  }

  while (vials.length < totalVials) {
    vials.push([]);
  }

  return vials;
}

function buildNoAdjacentFullState(
  state: LevelState,
  capacity: number,
  emptyVials: number,
  rng: SeededRandom,
  maxAttempts: number,
): LevelState | null {
  const segments: Color[] = [];
  for (const vial of state) {
    segments.push(...vial);
  }

  const totalVials = state.length;
  const fullVials = Math.max(0, totalVials - emptyVials);
  if (fullVials <= 0) {
    return null;
  }

  const colorCounts = new Map<Color, number>();
  for (const color of segments) {
    colorCounts.set(color, (colorCounts.get(color) ?? 0) + 1);
  }

  const colors = [...colorCounts.keys()];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const remaining = new Map<Color, number>(colorCounts);
    const vials: LevelState = Array.from({ length: fullVials }, () => []);

    let failed = false;
    for (let vialIndex = 0; vialIndex < fullVials; vialIndex++) {
      const vial = vials[vialIndex];
      if (!vial) {
        failed = true;
        break;
      }
      let lastColor: Color | null = null;
      for (let slot = 0; slot < capacity; slot++) {
        const candidates = colors.filter((color) => {
          const count = remaining.get(color) ?? 0;
          if (count <= 0) {
            return false;
          }
          return color !== lastColor;
        });

        if (candidates.length === 0) {
          failed = true;
          break;
        }

        const pick = candidates[rng.nextInt(0, candidates.length)];
        if (!pick) {
          failed = true;
          break;
        }

        vial.push(pick);
        remaining.set(pick, (remaining.get(pick) ?? 1) - 1);
        lastColor = pick;
      }

      if (failed) {
        break;
      }
    }

    if (failed) {
      continue;
    }

    while (vials.length < totalVials) {
      vials.push([]);
    }

    if (!hasAdjacentDuplicates(vials)) {
      return vials;
    }
  }

  return null;
}

function calculateEntropyScore(
  state: LevelState,
  capacity: number,
): CandidateScore {
  let runsMinusOne = 0;
  let mixedVials = 0;
  let uniformFullVials = 0;
  let distinctColors = 0;
  let topDiversity = 0;
  let partialVials = 0;
  let emptyVials = 0;
  let adjacentDuplicates = 0;
  let totalVials = 0;
  const colorDistribution = new Map<Color, number>();
  const topColors = new Set<Color>();

  for (const vial of state) {
    if (vial.length === 0) {
      emptyVials++;
      continue;
    }
    totalVials++;
    if (vial.length < capacity) {
      partialVials++;
    }

    distinctColors += new Set(vial).size;
    const runCount = countColorRuns(vial);
    if (runCount > 1) {
      runsMinusOne += runCount - 1;
    }
    for (let i = 1; i < vial.length; i++) {
      if (vial[i] === vial[i - 1]) {
        adjacentDuplicates++;
      }
    }

    const isFullUniform =
      vial.length === capacity && vial.every((segment) => segment === vial[0]);
    if (!isFullUniform) {
      mixedVials++;
    } else {
      uniformFullVials++;
    }

    const topColor = vial[vial.length - 1];
    if (topColor) {
      topColors.add(topColor);
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

  topDiversity = topColors.size;
  const averageDistinctColors =
    totalVials > 0 ? distinctColors / totalVials : 0;
  const entropy =
    runsMinusOne +
    mixedVials +
    dispersion +
    topDiversity +
    averageDistinctColors;
  const score =
    dispersion * 5 +
    distinctColors * 5 +
    averageDistinctColors * 6 +
    topDiversity * 3 +
    runsMinusOne * 3 +
    mixedVials * 2 -
    uniformFullVials * 4 -
    partialVials -
    adjacentDuplicates * 5;

  return {
    score,
    entropy,
    dispersion,
    mixedVials,
    runsMinusOne,
    uniformFullVials,
    solvedVials: countSolvedVials(state, capacity),
    distinctColors,
    topDiversity,
    partialVials,
    emptyVials,
    adjacentDuplicates,
    averageDistinctColors,
  };
}

function scoreForPhase(
  score: CandidateScore,
  phase: GenerationPhase,
  targetEmptyVials: number,
): number {
  if (phase === "mix") {
    return score.score;
  }

  const emptyDistance = Math.abs(score.emptyVials - targetEmptyVials);
  return (
    -emptyDistance * 12 -
    score.partialVials * 10 +
    score.dispersion * 3 +
    score.topDiversity * 2 +
    score.runsMinusOne -
    score.uniformFullVials * 2 -
    score.adjacentDuplicates * 6
  );
}

function isBetterScoreForPhase(
  a: CandidateScore,
  b: CandidateScore,
  phase: GenerationPhase,
  targetEmptyVials: number,
): boolean {
  const scoreA = scoreForPhase(a, phase, targetEmptyVials);
  const scoreB = scoreForPhase(b, phase, targetEmptyVials);
  if (scoreA !== scoreB) {
    return scoreA > scoreB;
  }

  if (phase === "mix") {
    if (a.entropy !== b.entropy) {
      return a.entropy > b.entropy;
    }
    if (a.averageDistinctColors !== b.averageDistinctColors) {
      return a.averageDistinctColors > b.averageDistinctColors;
    }
    if (a.dispersion !== b.dispersion) {
      return a.dispersion > b.dispersion;
    }
    if (a.topDiversity !== b.topDiversity) {
      return a.topDiversity > b.topDiversity;
    }
    if (a.adjacentDuplicates !== b.adjacentDuplicates) {
      return a.adjacentDuplicates < b.adjacentDuplicates;
    }
    return a.solvedVials < b.solvedVials;
  }

  if (a.partialVials !== b.partialVials) {
    return a.partialVials < b.partialVials;
  }
  if (a.adjacentDuplicates !== b.adjacentDuplicates) {
    return a.adjacentDuplicates < b.adjacentDuplicates;
  }
  const emptyDistanceA = Math.abs(a.emptyVials - targetEmptyVials);
  const emptyDistanceB = Math.abs(b.emptyVials - targetEmptyVials);
  if (emptyDistanceA !== emptyDistanceB) {
    return emptyDistanceA < emptyDistanceB;
  }

  if (a.dispersion !== b.dispersion) {
    return a.dispersion > b.dispersion;
  }

  return a.topDiversity > b.topDiversity;
}

function shuffleInPlace<T>(items: T[], rng: SeededRandom): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.nextInt(0, i + 1);
    const temp = items[i];
    items[i] = items[j];
    items[j] = temp;
  }
}

function sortCandidatesForPhase(
  candidates: PredecessorCandidate[],
  phase: GenerationPhase,
  targetEmptyVials: number,
): PredecessorCandidate[] {
  return [...candidates].sort((a, b) => {
    if (
      isBetterScoreForPhase(a.score, b.score, phase, targetEmptyVials) &&
      !isBetterScoreForPhase(b.score, a.score, phase, targetEmptyVials)
    ) {
      return -1;
    }
    if (
      isBetterScoreForPhase(b.score, a.score, phase, targetEmptyVials) &&
      !isBetterScoreForPhase(a.score, b.score, phase, targetEmptyVials)
    ) {
      return 1;
    }
    return 0;
  });
}

function isBetterScore(
  a: CandidateScore,
  b: CandidateScore,
  targetEmptyVials: number,
): boolean {
  return isBetterScoreForPhase(a, b, "mix", targetEmptyVials);
}

function isImprovement(
  candidate: CandidateScore,
  current: CandidateScore,
  phase: GenerationPhase,
  targetEmptyVials: number,
): boolean {
  return isBetterScoreForPhase(candidate, current, phase, targetEmptyVials);
}

function isNotWorseForPhase(
  candidate: CandidateScore,
  current: CandidateScore,
  phase: GenerationPhase,
  targetEmptyVials: number,
): boolean {
  const candidateScore = scoreForPhase(candidate, phase, targetEmptyVials);
  const currentScore = scoreForPhase(current, phase, targetEmptyVials);

  if (candidateScore < currentScore) {
    return false;
  }

  if (phase === "mix") {
    return candidate.entropy >= current.entropy;
  }

  return candidate.partialVials <= current.partialVials;
}

function isPhaseReady(
  score: CandidateScore,
  phase: GenerationPhase,
  entropyThreshold: number,
): boolean {
  if (phase === "mix") {
    return score.entropy >= entropyThreshold;
  }

  return score.partialVials === 0;
}

function isPackComplete(
  score: CandidateScore,
  entropyThreshold: number,
  targetEmptyVials: number,
): boolean {
  return (
    score.entropy >= entropyThreshold &&
    score.partialVials === 0 &&
    score.emptyVials === targetEmptyVials &&
    score.adjacentDuplicates === 0
  );
}

function selectImprovingCandidate(
  candidates: PredecessorCandidate[],
  rng: SeededRandom,
  phase: GenerationPhase,
  targetEmptyVials: number,
  currentScore: CandidateScore,
  allowPlateau: boolean,
): PredecessorCandidate | null {
  if (candidates.length === 0) {
    return null;
  }

  const pool = [...candidates];
  shuffleInPlace(pool, rng);
  const sorted = sortCandidatesForPhase(pool, phase, targetEmptyVials);
  for (const candidate of sorted) {
    const isCandidateOk = allowPlateau
      ? isNotWorseForPhase(
          candidate.score,
          currentScore,
          phase,
          targetEmptyVials,
        )
      : isImprovement(candidate.score, currentScore, phase, targetEmptyVials);
    if (isCandidateOk) {
      return candidate;
    }
  }

  return null;
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
  phase: GenerationPhase,
  targetEmptyVials: number,
  allowPlateau: boolean,
): PredecessorCandidate | null {
  if (candidates.length === 0) {
    return null;
  }

  const shuffled = [...candidates];
  shuffleInPlace(shuffled, rng);
  const sorted = sortCandidatesForPhase(shuffled, phase, targetEmptyVials);

  const beam = sorted.slice(0, beamWidth);
  if (beam.length === 0) {
    return null;
  }

  const improving = beam.filter((candidate) => {
    return allowPlateau
      ? isNotWorseForPhase(
          candidate.score,
          currentScore,
          phase,
          targetEmptyVials,
        )
      : isImprovement(candidate.score, currentScore, phase, targetEmptyVials);
  });

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
  minimumSolutionSteps?: number;
  entropyThreshold?: number;
  beamWidth?: number;
  epsilon?: number;
  attempts?: number;
  relaxEntropy?: boolean;
  relaxSolutionSteps?: boolean;
  allowPartialVials?: boolean;
  maxDurationMs?: number;
  maximizeEntropy?: boolean;
  plateauLimit?: number;
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
    minimumSolutionSteps,
    entropyThreshold,
    beamWidth = 6,
    epsilon = 0.15,
    attempts = 20,
    relaxEntropy = true,
    relaxSolutionSteps = false,
    allowPartialVials = false,
    maxDurationMs = 120000,
    maximizeEntropy = false,
    plateauLimit = 25,
    outputPath,
  } = options;

  const maxSteps = Math.max(targetShuffleMoves, colorCount * 2);
  const threshold =
    entropyThreshold ?? Math.max(1, Math.floor(colorCount * vialHeight * 0.6));
  const minSolutionSteps = Math.max(
    1,
    minimumSolutionSteps ?? Math.floor(targetShuffleMoves * 0.7),
  );

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
    if (Date.now() - startedAt > maxDurationMs * 0.7) {
      break;
    }
    const attemptStartedAt = Date.now();
    const attemptSeed =
      typeof seed === "number" ? seed + attempt : `${seed}-${attempt}`;
    const rng = new SeededRandom(attemptSeed);
    const attemptThreshold = relaxEntropy
      ? Math.max(1, threshold - attempt)
      : threshold;
    const attemptMinSteps = relaxSolutionSteps
      ? Math.max(1, minSolutionSteps - attempt)
      : minSolutionSteps;

    console.log(
      `Attempt ${attempt + 1}/${attempts} seed=${attemptSeed} entropy>=${attemptThreshold} minSteps>=${attemptMinSteps}`,
    );

    let current = solvedState;
    let currentScore = calculateEntropyScore(current, vialHeight);
    let phase: GenerationPhase = "mix";
    let bestState = current;
    let bestScore = currentScore;
    let bestReverseMoves: Move[] = [];
    let bestNoSolvedState: LevelState | null = null;
    let bestNoSolvedScore: CandidateScore | null = null;
    let bestNoSolvedMoves: Move[] = [];
    let stepsSinceBest = 0;

    const reverseMoves: Move[] = [];
    const visited = new Set<string>();
    visited.add(encodeState(current));
    let lastMoveKey: string | null = null;

    for (let step = 0; step < maxSteps; step++) {
      if (Date.now() - startedAt > maxDurationMs) {
        break;
      }
      if (step > 0 && step % 10 === 0) {
        console.log(
          `  step=${step} phase=${phase} entropy=${currentScore.entropy.toFixed(
            1,
          )} score=${currentScore.score.toFixed(1)} solvedVials=${currentScore.solvedVials} partial=${currentScore.partialVials} empty=${currentScore.emptyVials} bestEntropy=${bestScore.entropy.toFixed(
            1,
          )}`,
        );
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
          if (
            phase === "mix" &&
            !maximizeEntropy &&
            candidate.score.entropy < minLowerBound
          ) {
            return false;
          }

          return true;
        },
      );

      const allowPlateau = reverseMoves.length < attemptMinSteps;
      let nextCandidate = pickCandidate(
        candidates,
        rng,
        beamWidth,
        epsilon,
        currentScore,
        phase,
        emptyVials,
        allowPlateau,
      );

      if (!nextCandidate) {
        nextCandidate = selectImprovingCandidate(
          candidates,
          rng,
          phase,
          emptyVials,
          currentScore,
          allowPlateau,
        );
      }

      if (!nextCandidate) {
        break;
      }

      current = nextCandidate.state;
      currentScore = nextCandidate.score;
      reverseMoves.push(nextCandidate.move);
      visited.add(encodeState(current));
      lastMoveKey = `${nextCandidate.move.sourceVialIndex}->${nextCandidate.move.targetVialIndex}`;

      if (isBetterScore(currentScore, bestScore, emptyVials)) {
        bestState = current;
        bestScore = currentScore;
        bestReverseMoves = [...reverseMoves];
        stepsSinceBest = 0;
      } else {
        stepsSinceBest += 1;
      }

      if (currentScore.solvedVials === 0) {
        if (
          !bestNoSolvedScore ||
          isBetterScore(currentScore, bestNoSolvedScore, emptyVials)
        ) {
          bestNoSolvedState = current;
          bestNoSolvedScore = currentScore;
          bestNoSolvedMoves = [...reverseMoves];
        }
      }

      const phaseReady = isPhaseReady(currentScore, phase, attemptThreshold);
      if (phase === "mix" && phaseReady) {
        phase = "pack";
      }

      if (phase === "pack") {
        if (
          isPackComplete(currentScore, attemptThreshold, emptyVials) &&
          reverseMoves.length >= attemptMinSteps
        ) {
          bestState = current;
          bestScore = currentScore;
          bestReverseMoves = [...reverseMoves];
          break;
        }
      }

      if (stepsSinceBest >= plateauLimit) {
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
        phase,
        emptyVials,
        true,
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

    if (hasAdjacentDuplicates(selectedState)) {
      const goal = (state: LevelState) =>
        !isSolvedLevelState(state, vialHeight) && !hasAdjacentDuplicates(state);
      const fixup = searchForGoalState(selectedState, vialHeight, 600000, goal);
      if (!fixup) {
        continue;
      }
      selectedState = fixup.state;
      selectedScore = calculateEntropyScore(selectedState, vialHeight);
      selectedMoves = [...selectedMoves, ...fixup.reverseMoves];

      if (hasPartialVials(selectedState, vialHeight)) {
        const packGoal = (state: LevelState) =>
          !isSolvedLevelState(state, vialHeight) &&
          !hasPartialVials(state, vialHeight) &&
          !hasAdjacentDuplicates(state);
        const packFix = searchForGoalState(
          selectedState,
          vialHeight,
          600000,
          packGoal,
        );
        if (!packFix) {
          continue;
        }
        selectedState = packFix.state;
        selectedScore = calculateEntropyScore(selectedState, vialHeight);
        selectedMoves = [...selectedMoves, ...packFix.reverseMoves];
      }
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

    let metrics = evaluateLevel(shuffledState, solutionMoves);
    if (metrics.entropy < attemptThreshold) {
      const highEntropyState = buildHighEntropyFullState(
        finalState,
        vialHeight,
        emptyVials,
        rng,
      );
      const candidateGameState = toGameState(
        highEntropyState,
        colorCount,
        emptyVials,
        vialHeight,
      );
      const candidateSolution = solvePuzzle(candidateGameState, 20000, 100000);
      if (candidateSolution.solved && candidateSolution.path) {
        const candidateMetrics = evaluateLevel(
          candidateGameState,
          candidateSolution.path,
        );
        if (candidateMetrics.entropy > metrics.entropy) {
          finalState = highEntropyState;
          solutionMoves = candidateSolution.path;
          metrics = candidateMetrics;
        }
      }
    }
    if (metrics.entropy < attemptThreshold && !maximizeEntropy) {
      continue;
    }
    if (solutionMoves.length < attemptMinSteps) {
      continue;
    }
    if (hasAdjacentDuplicates(finalState)) {
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
    console.log(
      `- Attempt time: ${((Date.now() - attemptStartedAt) / 1000).toFixed(1)}s`,
    );

    return levelPath;
  }

  if (bestResult === null) {
    const rng = new SeededRandom(seed);
    const noAdjacentState = buildNoAdjacentFullState(
      solvedState,
      vialHeight,
      emptyVials,
      rng,
      500,
    );
    if (noAdjacentState) {
      const candidateGameState = toGameState(
        noAdjacentState,
        colorCount,
        emptyVials,
        vialHeight,
      );
      const candidateSolution = solvePuzzle(candidateGameState, 20000, 150000);
      if (candidateSolution.solved && candidateSolution.path) {
        const candidateMetrics = evaluateLevel(
          candidateGameState,
          candidateSolution.path,
        );
        if (candidateMetrics.entropy >= threshold) {
          const levelJson = serializeLevel(
            initialState,
            candidateGameState,
            candidateSolution.path,
            candidateMetrics,
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
          console.log(`- Entropy: ${candidateMetrics.entropy}`);
          console.log(`- Difficulty: ${candidateMetrics.difficulty}`);
          console.log(`- Solution steps: ${candidateSolution.path.length}`);
          console.log(
            `- Total time: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
          );
          return levelPath;
        }
      }
    }
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
    console.log(
      `- Total time: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
    );

    return levelPath;
  }

  console.log(
    `Generation exhausted after ${((Date.now() - startedAt) / 1000).toFixed(1)}s without a valid level.`,
  );
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
    targetShuffleMoves: 35,
    minimumSolutionSteps: 15,
    entropyThreshold: 18,
    attempts: 40,
    maxDurationMs: 120000,
    beamWidth: 10,
    relaxSolutionSteps: true,
    relaxEntropy: true,
  });
}
