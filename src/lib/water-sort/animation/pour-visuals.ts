import {GAME_TIMING} from "./timing";

export interface PourVisualPhase {
  transferProgress: number;
  streamStrength: number;
  streamWidthScale: number;
  splashProgress: number;
  splashOpacity: number;
  terminalDropletProgress: number;
  terminalDropletOpacity: number;
  surfaceActivity: number;
}

const SPLASH_DELAY_SECONDS = 0.045;
const SPLASH_DURATION_SECONDS = 0.24;
const TERMINAL_DROPLET_DURATION_SECONDS = 0.14;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function smoothstep01(value: number): number {
  const progress = clamp(value, 0, 1);
  return progress * progress * (3 - 2 * progress);
}

export function getPourVisualPhase(timeSeconds: number): PourVisualPhase {
  const transferProgress = clamp(
    (timeSeconds - GAME_TIMING.pour.transferStartSeconds) / GAME_TIMING.pour.transferSeconds,
    0,
    1,
  );
  const openProgress = smoothstep01(
    (timeSeconds - GAME_TIMING.pour.streamStartSeconds) / GAME_TIMING.pour.streamOpenSeconds,
  );
  const closeProgress = smoothstep01(
    (GAME_TIMING.pour.streamCloseEndSeconds - timeSeconds)
      / GAME_TIMING.pour.streamCloseDurationSeconds,
  );
  const streamStrength = Math.min(openProgress, closeProgress);
  const impactTime = GAME_TIMING.pour.transferStartSeconds + SPLASH_DELAY_SECONDS;
  const splashProgress = timeSeconds >= impactTime && timeSeconds <= impactTime + SPLASH_DURATION_SECONDS
    ? clamp((timeSeconds - impactTime) / SPLASH_DURATION_SECONDS, 0, 1)
    : 0;
  const splashOpacity = splashProgress > 0 ? Math.sin(Math.PI * splashProgress) : 0;
  const terminalStart = GAME_TIMING.pour.streamCloseSeconds;
  const terminalDropletProgress = timeSeconds >= terminalStart
    && timeSeconds <= terminalStart + TERMINAL_DROPLET_DURATION_SECONDS
    ? clamp((timeSeconds - terminalStart) / TERMINAL_DROPLET_DURATION_SECONDS, 0, 1)
    : 0;
  const terminalDropletOpacity = terminalDropletProgress > 0 ? 1 - terminalDropletProgress : 0;
  const surfaceActivity = clamp(streamStrength * 0.65 + splashOpacity * 0.35, 0, 1);

  return {
    transferProgress,
    streamStrength,
    streamWidthScale: 0.55 + 0.45 * streamStrength,
    splashProgress,
    splashOpacity,
    terminalDropletProgress,
    terminalDropletOpacity,
    surfaceActivity,
  };
}
