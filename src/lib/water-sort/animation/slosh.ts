import gsap from "gsap";

export interface SloshOptions {
  surfaceElement: HTMLElement;
  bottleRotationDegrees: number;
  tiltStartSeconds: number;
  transferStartSeconds: number;
  returnStartSeconds: number;
}

/**
 * Adds a lightweight "liquid has mass" illusion without physics simulation.
 *
 * The bottle rotates normally while the free surface counter-rotates with
 * deliberate lag, slight overshoot, and a damped settle. The values are kept
 * small so the liquid still reads as stable rather than gelatinous.
 */
export function addSourceSlosh(
  timeline: gsap.core.Timeline,
  {
    surfaceElement,
    bottleRotationDegrees,
    tiltStartSeconds,
    transferStartSeconds,
    returnStartSeconds,
  }: SloshOptions,
): void {
  const counterRotation = -bottleRotationDegrees;

  timeline.to(
    surfaceElement,
    {
      rotation: counterRotation * 0.78,
      duration: 0.12,
      ease: "power2.out",
    },
    tiltStartSeconds + 0.03,
  );

  timeline.to(
    surfaceElement,
    {
      rotation: counterRotation * 1.06,
      duration: 0.08,
      ease: "sine.inOut",
    },
    transferStartSeconds - 0.02,
  );

  timeline.to(
    surfaceElement,
    {
      rotation: counterRotation,
      duration: 0.12,
      ease: "sine.out",
    },
    transferStartSeconds + 0.06,
  );

  timeline.to(
    surfaceElement,
    {
      rotation: bottleRotationDegrees * 0.07,
      duration: 0.09,
      ease: "power1.out",
    },
    returnStartSeconds + 0.04,
  );

  timeline.to(
    surfaceElement,
    {
      rotation: -bottleRotationDegrees * 0.035,
      duration: 0.08,
      ease: "sine.inOut",
    },
    returnStartSeconds + 0.13,
  );

  timeline.to(
    surfaceElement,
    {
      rotation: 0,
      duration: 0.1,
      ease: "sine.out",
    },
    returnStartSeconds + 0.21,
  );
}

/**
 * Adds one restrained wobble to the receiving liquid surface as the incoming
 * liquid settles. This is intentionally much smaller than the source slosh.
 */
export function addDestinationSlosh(
  timeline: gsap.core.Timeline,
  surfaceElement: HTMLElement,
  startSeconds: number,
): void {
  timeline.to(
    surfaceElement,
    {
      rotation: 3.5,
      scaleY: 0.94,
      duration: 0.07,
      ease: "power1.out",
    },
    startSeconds,
  );

  timeline.to(
    surfaceElement,
    {
      rotation: -2,
      scaleY: 1.03,
      duration: 0.08,
      ease: "sine.inOut",
    },
    startSeconds + 0.07,
  );

  timeline.to(
    surfaceElement,
    {
      rotation: 0,
      scaleY: 1,
      duration: 0.1,
      ease: "sine.out",
    },
    startSeconds + 0.15,
  );
}
