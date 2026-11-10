/** Deterministic glitter samples for a flowing ribbon; no timers or random state. */
export interface StreamGlitterFleck {
  /** Position along the current stream curve, 0–1. */
  pathProgress: number;
  /** Fraction of the stream's local half-width, always within its silhouette. */
  normalOffset: number;
  /** Radius in pixels at CSS-pixel board scale. */
  radius: number;
  brightness: number;
}

export const STREAM_GLITTER_FLECK_COUNT = 22;

function fractional(value: number): number {
  return value - Math.floor(value);
}

function seededUnit(seed: number): number {
  return fractional(Math.sin(seed * 12.9898) * 43758.5453);
}

/** A pure, replayable distribution that follows the *actual* stream curve. */
export function getStreamGlitterFlecks({
  visualSeed,
  flowProgress,
  count = STREAM_GLITTER_FLECK_COUNT,
}: {
  visualSeed: number;
  flowProgress: number;
  count?: number;
}): StreamGlitterFleck[] {
  if (!Number.isInteger(count) || count < 0 || count > 64) {
    throw new RangeError("Stream glitter count must be an integer from 0 to 64.");
  }

  const progress = Math.max(0, Math.min(1, flowProgress));
  return Array.from({length: count}, (_, index) => {
    const seed = visualSeed * 53 + index * 17;
    const jitter = (seededUnit(seed + 1) - 0.5) * 0.55;
    const travel = progress * (0.45 + seededUnit(seed + 2) * 0.18);
    const pathProgress = fractional((index + 0.5 + jitter) / count + travel);
    const normalOffset = (seededUnit(seed + 3) * 2 - 1) * 0.60;
    const radius = 0.32 + seededUnit(seed + 4) * 0.46;
    const phase = seededUnit(seed + 5) * Math.PI * 2;
    const brightness = 0.40 + 0.60 * Math.pow(
      0.5 + 0.5 * Math.sin(progress * Math.PI * 7 + phase),
      3,
    );
    return {pathProgress, normalOffset, radius, brightness};
  });
}
