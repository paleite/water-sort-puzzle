import gsap from "gsap";

import type { AppliedMove } from "../domain/types";
import type { PourGeometry } from "./pour-geometry";
import { createLiquidSimulation } from "./slosh";
import { GAME_TIMING } from "./timing";

interface PourTimelineElements {
  sourceElement: HTMLElement;
  destinationElement: HTMLElement;
  streamElement: SVGLineElement;
  sourceLayerElements: readonly SVGPathElement[];
  sourceSurfaceElement: SVGPathElement | null;
  destinationLiquidElement: SVGPathElement | null;
  destinationSurfaceElement: SVGPathElement | null;
  destinationBaseSurfaceElement: HTMLElement | null;
}

interface PourDebugMarker {
  label: string;
  timeSeconds: number;
}

export function createPourTimeline({
  elements,
  geometry,
  move,
  capacity,
  onComplete,
  onDebug,
}: {
  elements: PourTimelineElements;
  geometry: PourGeometry;
  move: AppliedMove;
  capacity: number;
  onComplete: () => void;
  onDebug?: (event: string, timeSeconds: number) => void;
}): gsap.core.Timeline {
  const {
    sourceElement,
    destinationElement,
    streamElement,
    sourceLayerElements,
    sourceSurfaceElement,
    destinationLiquidElement,
    destinationSurfaceElement,
    destinationBaseSurfaceElement,
  } = elements;

  const streamLength = Math.hypot(
    geometry.streamEnd.x - geometry.streamStart.x,
    geometry.streamEnd.y - geometry.streamStart.y,
  );

  streamElement.setAttribute("x1", String(geometry.streamStart.x));
  streamElement.setAttribute("y1", String(geometry.streamStart.y));
  streamElement.setAttribute("x2", String(geometry.streamEnd.x));
  streamElement.setAttribute("y2", String(geometry.streamEnd.y));

  gsap.set(sourceElement, {transformOrigin: "50% 4px", zIndex: 20});
  gsap.set(streamElement, {
    opacity: 0,
    strokeDasharray: streamLength,
    strokeDashoffset: streamLength,
  });

  if (destinationBaseSurfaceElement !== null) {
    gsap.set(destinationBaseSurfaceElement, {opacity: 1});
  }

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
  });
  timeline.eventCallback("onStart", () => onDebug?.("timeline:start", 0));
  timeline.eventCallback("onUpdate", () => {
    const timeSeconds = timeline.time();
    liquidSimulation.update(timeSeconds);

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
    onComplete();
  });

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
      strokeDashoffset: 0,
      duration: GAME_TIMING.pour.streamOpenSeconds,
      ease: "power1.out",
    },
    GAME_TIMING.pour.streamStartSeconds,
  );

  if (destinationBaseSurfaceElement !== null) {
    timeline.to(
      destinationBaseSurfaceElement,
      {
        opacity: 0,
        duration: 0.05,
        ease: "power1.out",
      },
      GAME_TIMING.pour.transferStartSeconds,
    );
  }

  timeline.to(
    streamElement,
    {
      opacity: 0,
      strokeDashoffset: -streamLength,
      duration: GAME_TIMING.pour.streamCloseDurationSeconds,
      ease: "power1.in",
    },
    GAME_TIMING.pour.streamCloseSeconds,
  );

  const destinationVialIndex = move.move.destinationVialIndex;
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

  timeline.set(
    streamElement,
    {opacity: 0},
    GAME_TIMING.pour.totalSeconds,
  );

  return timeline;
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
