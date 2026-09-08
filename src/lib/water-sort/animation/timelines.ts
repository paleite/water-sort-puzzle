import gsap from "gsap";

import type { AppliedMove } from "../domain/types";
import type { PourGeometry } from "./pour-geometry";
import {
  createLiquidSimulation,
  type LiquidSimulationSnapshot,
} from "./slosh";
import { GAME_TIMING } from "./timing";

const DEBUG_SEEK_STEP_SECONDS = 1 / 120;

interface PourTimelineElements {
  sourceElement: HTMLElement;
  destinationElement: HTMLElement;
  streamElement: SVGPathElement;
  sourceLayerElements: readonly SVGPathElement[];
  sourceSurfaceElement: SVGPathElement | null;
  destinationLiquidElement: SVGPathElement | null;
  destinationSurfaceElement: SVGPathElement | null;
}

interface PourDebugMarker {
  label: string;
  timeSeconds: number;
}

export interface PourPresentationSnapshot {
  timeSeconds: number;
  progress: number;
  sourceX: number;
  sourceY: number;
  sourceRotationDegrees: number;
  liquid: LiquidSimulationSnapshot;
}

export interface PourPresentation {
  timeline: gsap.core.Timeline;
  seek(timeSeconds: number): void;
  getSnapshot(): PourPresentationSnapshot;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function getGsapNumber(element: HTMLElement, property: string): number {
  const value = gsap.getProperty(element, property);
  if (typeof value === "number") return value;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function createStreamPath(
  sourceX: number,
  sourceY: number,
  destinationX: number,
  destinationY: number,
): string {
  const deltaX = destinationX - sourceX;
  const deltaY = destinationY - sourceY;
  const length = Math.max(0.001, Math.hypot(deltaX, deltaY));
  const normalX = -deltaY / length;
  const normalY = deltaX / length;
  const sourceHalfWidth = 2.4;
  const destinationHalfWidth = 0.9;
  const middleX = (sourceX + destinationX) / 2;
  const middleY = (sourceY + destinationY) / 2 + Math.min(2.5, length * 0.04);
  const middleHalfWidth = 1.55;

  const sourceTop = {
    x: sourceX + normalX * sourceHalfWidth,
    y: sourceY + normalY * sourceHalfWidth,
  };
  const sourceBottom = {
    x: sourceX - normalX * sourceHalfWidth,
    y: sourceY - normalY * sourceHalfWidth,
  };
  const destinationTop = {
    x: destinationX + normalX * destinationHalfWidth,
    y: destinationY + normalY * destinationHalfWidth,
  };
  const destinationBottom = {
    x: destinationX - normalX * destinationHalfWidth,
    y: destinationY - normalY * destinationHalfWidth,
  };
  const middleTop = {
    x: middleX + normalX * middleHalfWidth,
    y: middleY + normalY * middleHalfWidth,
  };
  const middleBottom = {
    x: middleX - normalX * middleHalfWidth,
    y: middleY - normalY * middleHalfWidth,
  };

  return [
    `M ${sourceTop.x.toFixed(2)} ${sourceTop.y.toFixed(2)}`,
    `Q ${middleTop.x.toFixed(2)} ${middleTop.y.toFixed(2)} ${destinationTop.x.toFixed(2)} ${destinationTop.y.toFixed(2)}`,
    `L ${destinationBottom.x.toFixed(2)} ${destinationBottom.y.toFixed(2)}`,
    `Q ${middleBottom.x.toFixed(2)} ${middleBottom.y.toFixed(2)} ${sourceBottom.x.toFixed(2)} ${sourceBottom.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

export function createPourTimeline({
  elements,
  geometry,
  move,
  capacity,
  onComplete,
  onDebug,
  onFrame,
  paused = false,
}: {
  elements: PourTimelineElements;
  geometry: PourGeometry;
  move: AppliedMove;
  capacity: number;
  onComplete: () => void;
  onDebug?: (event: string, timeSeconds: number) => void;
  onFrame?: (snapshot: PourPresentationSnapshot) => void;
  paused?: boolean;
}): PourPresentation {
  const {
    sourceElement,
    destinationElement,
    streamElement,
    sourceLayerElements,
    sourceSurfaceElement,
    destinationLiquidElement,
    destinationSurfaceElement,
  } = elements;

  const streamSvg = streamElement.ownerSVGElement;
  if (streamSvg === null) {
    throw new Error("Pour stream must belong to an SVG element.");
  }

  const sourceMouthAnchor = sourceElement.querySelector<SVGCircleElement>(
    geometry.direction === "right" ? "[data-vial-mouth-right]" : "[data-vial-mouth-left]",
  );
  const destinationLiquidViewport = destinationElement.querySelector<SVGSVGElement>(
    "[data-liquid-viewport]",
  );
  if (sourceMouthAnchor === null || destinationLiquidViewport === null) {
    throw new Error("Missing SVG geometry anchor required for pour presentation.");
  }

  const destinationVialIndex = move.move.destinationVialIndex;
  const previousDestinationFill = move.previousBoard[destinationVialIndex]?.length ?? 0;

  function syncStreamViewport(): DOMRect {
    const streamRect = streamSvg.getBoundingClientRect();
    streamSvg.setAttribute(
      "viewBox",
      `0 0 ${Math.max(1, streamRect.width)} ${Math.max(1, streamRect.height)}`,
    );
    streamSvg.setAttribute("preserveAspectRatio", "none");
    return streamRect;
  }

  function updateStreamGeometry(timeSeconds: number): void {
    const streamRect = syncStreamViewport();
    const sourceMouthRect = sourceMouthAnchor.getBoundingClientRect();
    const destinationViewportRect = destinationLiquidViewport.getBoundingClientRect();

    const sourceMouthX =
      sourceMouthRect.left + sourceMouthRect.width / 2 - streamRect.left;
    const sourceMouthY =
      sourceMouthRect.top + sourceMouthRect.height / 2 - streamRect.top;

    const transferProgress = clamp(
      (timeSeconds - GAME_TIMING.pour.transferStartSeconds) / GAME_TIMING.pour.transferSeconds,
      0,
      1,
    );
    const destinationFill = previousDestinationFill + move.amount * transferProgress;
    const destinationImpactX =
      destinationViewportRect.left - streamRect.left
      + destinationViewportRect.width * (geometry.direction === "right" ? 0.28 : 0.72);
    const destinationSurfaceY =
      destinationViewportRect.top - streamRect.top
      + destinationViewportRect.height * (1 - destinationFill / capacity);

    streamElement.setAttribute(
      "d",
      createStreamPath(
        sourceMouthX,
        sourceMouthY,
        destinationImpactX,
        destinationSurfaceY,
      ),
    );
  }

  gsap.set(sourceElement, {transformOrigin: "50% 4px", zIndex: 20});
  gsap.set(streamElement, {opacity: 0});

  const liquidSimulation = createLiquidSimulation({
    elements: {
      sourceElement,
      sourceLayerElements,
      sourceSurfaceElement,
      destinationLiquidElement,
      destinationSurfaceElement,
    },
    move,
    capacity,
  });

  const debugMarkers: PourDebugMarker[] = [
    {label: "tilt:start", timeSeconds: GAME_TIMING.pour.tiltStartSeconds},
    {label: "travel:end", timeSeconds: GAME_TIMING.pour.travelSeconds},
    {label: "stream:start", timeSeconds: GAME_TIMING.pour.streamStartSeconds},
    {
      label: "tilt:end",
      timeSeconds: GAME_TIMING.pour.tiltStartSeconds + GAME_TIMING.pour.tiltSeconds,
    },
    {label: "transfer:start", timeSeconds: GAME_TIMING.pour.transferStartSeconds},
    {
      label: "transfer:end",
      timeSeconds: GAME_TIMING.pour.transferStartSeconds + GAME_TIMING.pour.transferSeconds,
    },
    {label: "stream:close:start", timeSeconds: GAME_TIMING.pour.streamCloseSeconds},
    {
      label: "stream:close:end",
      timeSeconds: GAME_TIMING.pour.streamCloseSeconds + GAME_TIMING.pour.streamCloseDurationSeconds,
    },
    {label: "return:rotation:start", timeSeconds: GAME_TIMING.pour.returnRotationSeconds},
    {label: "return:travel:start", timeSeconds: GAME_TIMING.pour.returnTravelSeconds},
    {
      label: "return:rotation:end",
      timeSeconds:
        GAME_TIMING.pour.returnRotationSeconds
        + GAME_TIMING.pour.returnRotationDurationSeconds,
    },
    {
      label: "return:travel:end",
      timeSeconds:
        GAME_TIMING.pour.returnTravelSeconds
        + GAME_TIMING.pour.returnTravelDurationSeconds,
    },
  ].sort((first, second) => first.timeSeconds - second.timeSeconds);
  let nextDebugMarkerIndex = 0;

  const timeline = gsap.timeline({
    defaults: {overwrite: "auto"},
    paused,
  });

  function getSnapshot(): PourPresentationSnapshot {
    const timeSeconds = timeline.time();
    return {
      timeSeconds,
      progress: GAME_TIMING.pour.totalSeconds <= 0
        ? 0
        : timeSeconds / GAME_TIMING.pour.totalSeconds,
      sourceX: getGsapNumber(sourceElement, "x"),
      sourceY: getGsapNumber(sourceElement, "y"),
      sourceRotationDegrees: getGsapNumber(sourceElement, "rotation"),
      liquid: liquidSimulation.getSnapshot(),
    };
  }

  function emitFrame(): void {
    onFrame?.(getSnapshot());
  }

  timeline.eventCallback("onStart", () => onDebug?.("timeline:start", 0));
  timeline.eventCallback("onUpdate", () => {
    const timeSeconds = timeline.time();
    updateStreamGeometry(timeSeconds);
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
    updateStreamGeometry(GAME_TIMING.pour.totalSeconds);
    emitFrame();
    onComplete();
  });

  updateStreamGeometry(0);
  liquidSimulation.update(0);

  timeline.to(
    sourceElement,
    {
      x: geometry.translationX,
      y: geometry.translationY,
      duration: GAME_TIMING.pour.travelSeconds,
      ease: "power2.inOut",
    },
    0,
  );

  timeline.to(
    sourceElement,
    {
      rotation: geometry.rotationDegrees,
      duration: GAME_TIMING.pour.tiltSeconds,
      ease: "power2.inOut",
    },
    GAME_TIMING.pour.tiltStartSeconds,
  );

  timeline.to(
    streamElement,
    {
      opacity: 1,
      duration: GAME_TIMING.pour.streamOpenSeconds,
      ease: "power1.out",
    },
    GAME_TIMING.pour.streamStartSeconds,
  );

  timeline.to(
    streamElement,
    {
      opacity: 0,
      duration: GAME_TIMING.pour.streamCloseDurationSeconds,
      ease: "power1.in",
    },
    GAME_TIMING.pour.streamCloseSeconds,
  );

  if (move.newlyCompletedVialIndices.includes(destinationVialIndex)) {
    timeline.to(
      destinationElement,
      {
        scale: 1.04,
        duration: GAME_TIMING.completedVialSeconds / 2,
        ease: "power2.out",
        yoyo: true,
        repeat: 1,
      },
      GAME_TIMING.pour.streamCloseSeconds,
    );
  }

  timeline.to(
    sourceElement,
    {
      rotation: 0,
      duration: GAME_TIMING.pour.returnRotationDurationSeconds,
      ease: "power2.inOut",
    },
    GAME_TIMING.pour.returnRotationSeconds,
  );

  timeline.to(
    sourceElement,
    {
      x: 0,
      y: 0,
      duration: GAME_TIMING.pour.returnTravelDurationSeconds,
      ease: "power2.inOut",
    },
    GAME_TIMING.pour.returnTravelSeconds,
  );

  timeline.set(streamElement, {opacity: 0}, GAME_TIMING.pour.totalSeconds);

  function seek(timeSeconds: number): void {
    const targetTime = gsap.utils.clamp(
      0,
      GAME_TIMING.pour.totalSeconds,
      timeSeconds,
    );

    timeline.pause();
    timeline.time(0, true);
    liquidSimulation.reset();
    updateStreamGeometry(0);
    liquidSimulation.update(0);

    let cursor = DEBUG_SEEK_STEP_SECONDS;
    while (cursor < targetTime) {
      timeline.time(cursor, true);
      updateStreamGeometry(cursor);
      liquidSimulation.update(cursor);
      cursor += DEBUG_SEEK_STEP_SECONDS;
    }

    timeline.time(targetTime, true);
    updateStreamGeometry(targetTime);
    if (targetTime >= GAME_TIMING.pour.totalSeconds - 0.0001) {
      liquidSimulation.finish();
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

  return {timeline, seek, getSnapshot};
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
