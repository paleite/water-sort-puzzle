export const DIFFICULTY_SCORE_VERSION = 1 as const;

const REFERENCE = {
  optimalMoveCount: {
    easiest: 33,
    hardest: 45,
    weight: 0.6,
  },
  exploredStateCount: {
    easiest: 1_409,
    hardest: 173_220,
    weight: 0.4,
  },
} as const;

export interface DifficultyInputs {
  optimalMoveCount: number;
  exploredStateCount: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizeLinear(value: number, minimum: number, maximum: number): number {
  if (maximum <= minimum) return 0;
  return clamp01((value - minimum) / (maximum - minimum));
}

function normalizeLogarithmic(value: number, minimum: number, maximum: number): number {
  if (value < 0 || minimum < 0 || maximum <= minimum) return 0;
  return normalizeLinear(Math.log1p(value), Math.log1p(minimum), Math.log1p(maximum));
}

export function calculateDifficultyScore(inputs: DifficultyInputs): number {
  const optimalMoveScore = normalizeLinear(
    inputs.optimalMoveCount,
    REFERENCE.optimalMoveCount.easiest,
    REFERENCE.optimalMoveCount.hardest,
  );
  const exploredStateScore = normalizeLogarithmic(
    inputs.exploredStateCount,
    REFERENCE.exploredStateCount.easiest,
    REFERENCE.exploredStateCount.hardest,
  );

  const score =
    REFERENCE.optimalMoveCount.weight * optimalMoveScore +
    REFERENCE.exploredStateCount.weight * exploredStateScore;

  return Number(score.toFixed(4));
}
