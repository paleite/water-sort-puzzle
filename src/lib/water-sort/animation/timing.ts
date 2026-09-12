const COMPLETED_VIAL_SECONDS = 0.26;

const POUR_SEGMENTS = {
  travelSeconds: 0.23,
  tiltStartSeconds: 0.09,
  tiltSeconds: 0.24,
  streamStartSeconds: 0.3,
  streamOpenSeconds: 0.07,
  transferStartSeconds: 0.35,
  transferSeconds: 0.34,
  streamCloseSeconds: 0.69,
  streamCloseDurationSeconds: 0.08,
  returnRotationSeconds: 0.79,
  returnRotationDurationSeconds: 0.18,
  returnTravelSeconds: 0.86,
  returnTravelDurationSeconds: 0.18,
} as const;

const POUR_ENDPOINTS = {
  travelEndSeconds: POUR_SEGMENTS.travelSeconds,
  tiltEndSeconds: POUR_SEGMENTS.tiltStartSeconds + POUR_SEGMENTS.tiltSeconds,
  streamOpenEndSeconds: POUR_SEGMENTS.streamStartSeconds + POUR_SEGMENTS.streamOpenSeconds,
  transferEndSeconds: POUR_SEGMENTS.transferStartSeconds + POUR_SEGMENTS.transferSeconds,
  streamCloseEndSeconds:
    POUR_SEGMENTS.streamCloseSeconds + POUR_SEGMENTS.streamCloseDurationSeconds,
  completedVialEndSeconds: POUR_SEGMENTS.streamCloseSeconds + COMPLETED_VIAL_SECONDS,
  returnRotationEndSeconds:
    POUR_SEGMENTS.returnRotationSeconds + POUR_SEGMENTS.returnRotationDurationSeconds,
  returnTravelEndSeconds:
    POUR_SEGMENTS.returnTravelSeconds + POUR_SEGMENTS.returnTravelDurationSeconds,
} as const;

const POUR_TOTAL_SECONDS = Math.max(...Object.values(POUR_ENDPOINTS));

export const GAME_TIMING = {
  selectSeconds: 0.14,
  pour: {
    ...POUR_SEGMENTS,
    ...POUR_ENDPOINTS,
    returnStartSeconds: Math.min(
      POUR_SEGMENTS.returnRotationSeconds,
      POUR_SEGMENTS.returnTravelSeconds,
    ),
    expeditedReturnTimeScale: 1.8,
    totalSeconds: POUR_TOTAL_SECONDS,
  },
  undoSeconds: 0.24,
  restartSeconds: 0.22,
  completedVialSeconds: COMPLETED_VIAL_SECONDS,
  completionHoldSeconds: 0.25,
} as const;
