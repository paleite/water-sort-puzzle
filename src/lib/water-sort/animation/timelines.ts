import gsap from "gsap";

import type { AppliedMove } from "../domain/types";
import type { PourGeometry } from "./pour-geometry";
import { addDestinationSlosh, addSourceSlosh } from "./slosh";
import { GAME_TIMING } from "./timing";

interface PourTimelineElements {
  sourceElement: HTMLElement;
  destinationElement: HTMLElement;
  streamElement: SVGLineElement;
  sourceTransferredElements: readonly HTMLElement[];
  sourceSurfaceElement: HTMLElement | null;
  incomingLiquidElement: HTMLElement | null;
  incomingSurfaceElement: HTMLElement | null;
  impactPlumeElement: HTMLElement | null;
}

export function createPourTimeline({
  elements,
  geometry,
  move,
  capacity,
  onComplete,
}: {
  elements: PourTimelineElements;
  geometry: PourGeometry;
  move: AppliedMove;
  capacity: number;
  onComplete: () => void;
}): gsap.core.Timeline {
  const {
    sourceElement,
    destinationElement,
    streamElement,
    sourceTransferredElements,
    sourceSurfaceElement,
    incomingLiquidElement,
    incomingSurfaceElement,
    impactPlumeElement,
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

  const sourceVialIndex = move.move.sourceVialIndex;
  const destinationVialIndex = move.move.destinationVialIndex;
  const nextSourceFill = move.nextBoard[sourceVialIndex]?.length ?? 0;
  const previousDestinationFill = move.previousBoard[destinationVialIndex]?.length ?? 0;
  const nextDestinationFill = move.nextBoard[destinationVialIndex]?.length ?? previousDestinationFill;
  const previousDestinationPercent = (previousDestinationFill / capacity) * 100;
  const nextDestinationPercent = (nextDestinationFill / capacity) * 100;

  if (incomingLiquidElement !== null) {
    gsap.set(incomingLiquidElement, {scaleY: 0, transformOrigin: "bottom center"});
  }

  if (sourceSurfaceElement !== null) {
    gsap.set(sourceSurfaceElement, {transformOrigin: "50% 50%"});
  }

  if (incomingSurfaceElement !== null) {
    gsap.set(incomingSurfaceElement, {
      opacity: 0,
      bottom: `calc(${previousDestinationPercent}% - 4px)`,
      rotation: 0,
      scaleY: 1,
      transformOrigin: "50% 50%",
    });
  }

  if (impactPlumeElement !== null) {
    gsap.set(impactPlumeElement, {
      opacity: 0,
      bottom: `calc(${previousDestinationPercent}% - 4px)`,
      x: 0,
      y: 24,
      scaleY: 0,
      transformOrigin: "top center",
    });
  }

  const timeline = gsap.timeline({onComplete, defaults: {overwrite: "auto"}});

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

  if (sourceTransferredElements.length > 0) {
    timeline.to(
      sourceTransferredElements,
      {
        scaleY: 0,
        opacity: 0.15,
        transformOrigin: "bottom center",
        duration: GAME_TIMING.pour.transferSeconds,
        ease: "none",
      },
      GAME_TIMING.pour.transferStartSeconds,
    );
  }

  if (sourceSurfaceElement !== null) {
    timeline.to(
      sourceSurfaceElement,
      {
        bottom: `calc(${(nextSourceFill / capacity) * 100}% - 3px)`,
        duration: GAME_TIMING.pour.transferSeconds,
        ease: "none",
      },
      GAME_TIMING.pour.transferStartSeconds,
    );

    addSourceSlosh(timeline, {
      surfaceElement: sourceSurfaceElement,
      bottleRotationDegrees: geometry.rotationDegrees,
      tiltStartSeconds: GAME_TIMING.pour.tiltStartSeconds,
      tiltEndSeconds: GAME_TIMING.pour.tiltStartSeconds + GAME_TIMING.pour.tiltSeconds,
      returnStartSeconds: GAME_TIMING.pour.returnRotationSeconds,
      returnEndSeconds:
        GAME_TIMING.pour.returnRotationSeconds + GAME_TIMING.pour.returnRotationDurationSeconds,
      settleEndSeconds: GAME_TIMING.pour.totalSeconds,
    });
  }

  if (incomingLiquidElement !== null) {
    timeline.to(
      incomingLiquidElement,
      {
        scaleY: 1,
        duration: GAME_TIMING.pour.transferSeconds,
        ease: "none",
      },
      GAME_TIMING.pour.transferStartSeconds,
    );
  }

  if (incomingSurfaceElement !== null) {
    timeline.to(
      incomingSurfaceElement,
      {
        opacity: 1,
        duration: 0.04,
        ease: "power1.out",
      },
      GAME_TIMING.pour.transferStartSeconds,
    );

    timeline.to(
      incomingSurfaceElement,
      {
        bottom: `calc(${nextDestinationPercent}% - 4px)`,
        duration: GAME_TIMING.pour.transferSeconds,
        ease: "none",
      },
      GAME_TIMING.pour.transferStartSeconds,
    );

    if (impactPlumeElement !== null) {
      timeline.to(
        impactPlumeElement,
        {
          bottom: `calc(${nextDestinationPercent}% - 4px)`,
          duration: GAME_TIMING.pour.transferSeconds,
          ease: "none",
        },
        GAME_TIMING.pour.transferStartSeconds,
      );
    }

    addDestinationSlosh(timeline, {
      surfaceElement: incomingSurfaceElement,
      impactPlumeElement,
      transferStartSeconds: GAME_TIMING.pour.transferStartSeconds,
      transferEndSeconds: GAME_TIMING.pour.transferStartSeconds + GAME_TIMING.pour.transferSeconds,
      streamCloseEndSeconds:
        GAME_TIMING.pour.streamCloseSeconds + GAME_TIMING.pour.streamCloseDurationSeconds,
    });
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
