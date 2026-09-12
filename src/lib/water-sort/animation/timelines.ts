import gsap from "gsap";

import type { AppliedMove } from "../domain/types";
import type { PourGeometry } from "./pour-geometry";
import {
  createLiquidSimulation,
  type LiquidSimulationSnapshot,
} from "./slosh";
import { GAME_TIMING } from "./timing";

const DEBUG_SEEK_STEP_SECONDS = 1 / 120;

interface PourDebugMarker {
  label: string;
  timeSeconds: number;
}

interface PourMotionState {
  x: number;
  y: number;
  rotationDegrees: number;
  streamOpacity: number;
  destinationScale: number;
}

export interface PourPresentationSnapshot {
  timeSeconds: number;
  progress: number;
  sourceX: number;
  sourceY: number;
  sourceRotationDegrees: number;
  streamOpacity: number;
  destinationScale: number;
  liquid: LiquidSimulationSnapshot;
}

export interface PourPresentation {
  timeline: gsap.core.Timeline;
  seek(timeSeconds: number): void;
  getSnapshot(): PourPresentationSnapshot;
  requestExpeditedReturn(): void;
}

export function createPourTimeline({
  geometry,
  move,
  sourceWidthPixels,
  onComplete,
  onDebug,
  onFrame,
  paused = false,
}: {
  geometry: PourGeometry;
  move: AppliedMove;
  sourceWidthPixels: number;
  onComplete: () => void;
  onDebug?: (event: string, timeSeconds: number) => void;
  onFrame?: (snapshot: PourPresentationSnapshot) => void;
  paused?: boolean;
}): PourPresentation {
  const destinationVialIndex = move.move.destinationVialIndex;
  const motion: PourMotionState = {
    x: 0,
    y: 0,
    rotationDegrees: 0,
    streamOpacity: 0,
    destinationScale: 1,
  };

  const liquidSimulation = createLiquidSimulation({
    sourceWidthPixels,
    getSourceMotion: () => ({
      x: motion.x,
      y: motion.y,
      rotationDegrees: motion.rotationDegrees,
    }),
  });

  const debugMarkers: PourDebugMarker[] = [
    {label: "tilt:start", timeSeconds: GAME_TIMING.pour.tiltStartSeconds},
    {label: "travel:end", timeSeconds: GAME_TIMING.pour.travelEndSeconds},
    {label: "stream:start", timeSeconds: GAME_TIMING.pour.streamStartSeconds},
    {label: "tilt:end", timeSeconds: GAME_TIMING.pour.tiltEndSeconds},
    {label: "transfer:start", timeSeconds: GAME_TIMING.pour.transferStartSeconds},
    {label: "transfer:end", timeSeconds: GAME_TIMING.pour.transferEndSeconds},
    {label: "stream:close:start", timeSeconds: GAME_TIMING.pour.streamCloseSeconds},
    {label: "stream:close:end", timeSeconds: GAME_TIMING.pour.streamCloseEndSeconds},
    {label: "return:rotation:start", timeSeconds: GAME_TIMING.pour.returnRotationSeconds},
    {label: "return:travel:start", timeSeconds: GAME_TIMING.pour.returnTravelSeconds},
    {label: "return:rotation:end", timeSeconds: GAME_TIMING.pour.returnRotationEndSeconds},
    {label: "return:travel:end", timeSeconds: GAME_TIMING.pour.returnTravelEndSeconds},
  ].sort((first, second) => first.timeSeconds - second.timeSeconds);
  let nextDebugMarkerIndex = 0;
  let expeditedReturnRequested = false;

  const timeline = gsap.timeline({
    defaults: {overwrite: "auto"},
    paused,
  });

  function updateTimelineSpeed(): void {
    const shouldExpedite =
      expeditedReturnRequested
      && timeline.time() >= GAME_TIMING.pour.returnStartSeconds;
    const targetTimeScale = shouldExpedite
      ? GAME_TIMING.pour.expeditedReturnTimeScale
      : 1;
    if (Math.abs(timeline.timeScale() - targetTimeScale) > 0.001) {
      timeline.timeScale(targetTimeScale);
    }
  }

  function getSnapshot(): PourPresentationSnapshot {
    const timeSeconds = timeline.time();
    return {
      timeSeconds,
      progress: GAME_TIMING.pour.totalSeconds <= 0
        ? 0
        : timeSeconds / GAME_TIMING.pour.totalSeconds,
      sourceX: motion.x,
      sourceY: motion.y,
      sourceRotationDegrees: motion.rotationDegrees,
      streamOpacity: motion.streamOpacity,
      destinationScale: motion.destinationScale,
      liquid: liquidSimulation.getSnapshot(),
    };
  }

  function emitFrame(): void {
    onFrame?.(getSnapshot());
  }

  timeline.eventCallback("onStart", () => onDebug?.("timeline:start", 0));
  timeline.eventCallback("onUpdate", () => {
    updateTimelineSpeed();
    const timeSeconds = timeline.time();
    liquidSimulation.update(timeSeconds);
    emitFrame();

    while (
      nextDebugMarkerIndex < debugMarkers.length
      && timeSeconds >= (debugMarkers[nextDebugMarkerIndex]?.timeSeconds ?? Number.POSITIVE_INFINITY)
    ) {
      const marker = debugMarkers[nextDebugMarkerIndex];
      if (marker !== undefined) onDebug?.(marker.label, timeSeconds);
      nextDebugMarkerIndex += 1;
    }
  });
  timeline.eventCallback("onInterrupt", () => {
    onDebug?.("timeline:interrupt", timeline.time());
  });
  timeline.eventCallback("onComplete", () => {
    onDebug?.("timeline:complete", timeline.time());
    liquidSimulation.finish();
    motion.streamOpacity = 0;
    emitFrame();
    onComplete();
  });

  liquidSimulation.update(0);

  timeline.to(
    motion,
    {
      x: geometry.translationX,
      y: geometry.translationY,
      duration: GAME_TIMING.pour.travelSeconds,
      ease: "power2.inOut",
    },
    0,
  );

  timeline.to(
    motion,
    {
      rotationDegrees: geometry.rotationDegrees,
      duration: GAME_TIMING.pour.tiltSeconds,
      ease: "power2.inOut",
    },
    GAME_TIMING.pour.tiltStartSeconds,
  );

  timeline.to(
    motion,
    {
      streamOpacity: 1,
      duration: GAME_TIMING.pour.streamOpenSeconds,
      ease: "power1.out",
    },
    GAME_TIMING.pour.streamStartSeconds,
  );

  timeline.to(
    motion,
    {
      streamOpacity: 0,
      duration: GAME_TIMING.pour.streamCloseDurationSeconds,
      ease: "power1.in",
    },
    GAME_TIMING.pour.streamCloseSeconds,
  );

  if (move.newlyCompletedVialIndices.includes(destinationVialIndex)) {
    timeline.to(
      motion,
      {
        destinationScale: 1.04,
        duration: GAME_TIMING.completedVialSeconds / 2,
        ease: "power2.out",
        yoyo: true,
        repeat: 1,
      },
      GAME_TIMING.pour.streamCloseSeconds,
    );
  }

  timeline.to(
    motion,
    {
      rotationDegrees: 0,
      duration: GAME_TIMING.pour.returnRotationDurationSeconds,
      ease: "power2.inOut",
    },
    GAME_TIMING.pour.returnRotationSeconds,
  );

  timeline.to(
    motion,
    {
      x: 0,
      y: 0,
      duration: GAME_TIMING.pour.returnTravelDurationSeconds,
      ease: "power2.inOut",
    },
    GAME_TIMING.pour.returnTravelSeconds,
  );

  timeline.set(motion, {streamOpacity: 0}, GAME_TIMING.pour.totalSeconds);

  function seek(timeSeconds: number): void {
    const targetTime = gsap.utils.clamp(0, GAME_TIMING.pour.totalSeconds, timeSeconds);

    timeline.pause();
    timeline.timeScale(1);
    timeline.time(0, true);
    liquidSimulation.reset();
    liquidSimulation.update(0);

    let cursor = DEBUG_SEEK_STEP_SECONDS;
    while (cursor < targetTime) {
      timeline.time(cursor, true);
      liquidSimulation.update(cursor);
      cursor += DEBUG_SEEK_STEP_SECONDS;
    }

    timeline.time(targetTime, true);
    if (targetTime >= GAME_TIMING.pour.totalSeconds - 0.0001) {
      liquidSimulation.finish();
      motion.streamOpacity = 0;
    } else {
      liquidSimulation.update(targetTime);
    }

    const firstFutureMarkerIndex = debugMarkers.findIndex(
      (marker) => marker.timeSeconds > targetTime,
    );
    nextDebugMarkerIndex = firstFutureMarkerIndex === -1
      ? debugMarkers.length
      : firstFutureMarkerIndex;

    emitFrame();
  }

  function requestExpeditedReturn(): void {
    expeditedReturnRequested = true;
    updateTimelineSpeed();
  }

  return {timeline, seek, getSnapshot, requestExpeditedReturn};
}

export function createUndoTimeline(
  sourceElement: HTMLElement,
  destinationElement: HTMLElement,
  onComplete: () => void,
): gsap.core.Timeline {
  return gsap
    .timeline({onComplete})
    .to([sourceElement, destinationElement], {
      scale: 0.97,
      opacity: 0.72,
      duration: GAME_TIMING.undoSeconds / 2,
      ease: "power2.out",
    })
    .to([sourceElement, destinationElement], {
      scale: 1,
      opacity: 1,
      duration: GAME_TIMING.undoSeconds / 2,
      ease: "power2.in",
    });
}

export function createRestartTimeline(
  boardElement: HTMLElement,
  onComplete: () => void,
): gsap.core.Timeline {
  return gsap.timeline({onComplete}).fromTo(
    boardElement,
    {opacity: 0.45, scale: 0.985},
    {opacity: 1, scale: 1, duration: GAME_TIMING.restartSeconds, ease: "power2.out"},
  );
}
