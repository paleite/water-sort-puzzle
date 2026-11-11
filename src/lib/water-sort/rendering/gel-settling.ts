/**
 * A cosmetic, per-vial gel response. The renderer advances this state on its
 * existing Pixi ticker, so it survives the final React pour frame.
 *
 * There is intentionally no slot/color index here: depth is evaluated
 * continuously per fragment in the shader.
 */
export interface GelSettlingState {
  elapsedSeconds: number;
  strength: number;
  receiving: boolean;
}

export const GEL_SETTLING_DECAY_SECONDS = 2.4;
export const GEL_MAX_FRAME_SECONDS = 0.05;

export function createGelSettlingState(): GelSettlingState {
  return {elapsedSeconds: 0, strength: 0, receiving: false};
}

export function advanceGelSettling(
  current: GelSettlingState,
  elapsedSeconds: number,
  receiving: boolean,
  reducedMotion = false,
): GelSettlingState {
  if (reducedMotion) return createGelSettlingState();
  const deltaSeconds = Math.max(0, Math.min(GEL_MAX_FRAME_SECONDS, elapsedSeconds));

  // A fresh incoming pour starts a new disturbance. Consecutive frames of
  // the same pour advance one response instead of restarting it every frame.
  if (receiving && !current.receiving) {
    return {elapsedSeconds: deltaSeconds, strength: 1, receiving: true};
  }

  const strength = receiving
    ? 1
    : current.strength * Math.exp(-deltaSeconds / GEL_SETTLING_DECAY_SECONDS);

  return {
    elapsedSeconds: Math.min(20, current.elapsedSeconds + deltaSeconds),
    strength: strength < 0.001 ? 0 : strength,
    receiving,
  };
}

/**
 * Reference model for the GPU's continuous depth response.
 * 0 is the disturbed surface; 1 is the bottom boundary.
 */
export function getGelScanlineDisplacement(
  depthFromSurface: number,
  state: GelSettlingState,
): number {
  const depth = Math.max(0, Math.min(1, depthFromSurface));
  const delayedTime = Math.max(0, state.elapsedSeconds - depth * 0.70);
  const arrivalProgress = Math.min(1, delayedTime / 0.18);
  const arrived = arrivalProgress * arrivalProgress * (3 - 2 * arrivalProgress);
  const attenuation = Math.exp(-2.6 * depth) * Math.pow(1 - depth, 1.6);
  return 0.037 * state.strength * attenuation * arrived
    * Math.sin(delayedTime * 5.2);
}
