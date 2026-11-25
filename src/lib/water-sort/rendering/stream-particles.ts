/** Decorative stream particles; their positions never affect the poured volume. */
export interface StreamParticleSample {
  progress: number;
  lateralOffset: number;
  radius: number;
  streakLength: number;
  opacity: number;
}

const STREAM_PARTICLE_COUNT = 7;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function deterministicUnit(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

/**
 * Sample a fixed number of highlights along a pouring stream, without any
 * mutable particle state. The pour timeline is the clock, so seek/replay and
 * concurrent pours each produce the correct visual frame.
 */
export function getStreamParticleSamples({
  timeSeconds,
  visualSeed,
  opacity,
}: {
  timeSeconds: number;
  visualSeed: number;
  opacity: number;
}): readonly StreamParticleSample[] {
  if (opacity <= 0.001) return [];
  const boundedOpacity = clamp(opacity, 0, 1);

  return Array.from({length: STREAM_PARTICLE_COUNT}, (_, particleIndex) => {
    const seed = visualSeed + particleIndex * 31.7;
    const speed = 0.9 + deterministicUnit(seed + 2) * 0.65;
    const cycle = timeSeconds * speed + deterministicUnit(seed + 1);
    const phase = cycle - Math.floor(cycle);
    const edgeFade = Math.min(1, phase * 6, (1 - phase) * 6);

    return {
      progress: 0.08 + phase * 0.84,
      lateralOffset: (deterministicUnit(seed + 3) - 0.5) * 0.38,
      radius: 0.75 + deterministicUnit(seed + 4) * 0.6,
      streakLength: 2 + deterministicUnit(seed + 5) * 3.2,
      opacity: boundedOpacity * (0.20 + deterministicUnit(seed + 6) * 0.22) * edgeFade,
    };
  });
}
