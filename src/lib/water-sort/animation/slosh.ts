import gsap from "gsap";

type Timeline = ReturnType<typeof gsap.timeline>;

export interface SourceSloshOptions {
  surfaceElement: HTMLElement;
  bottleRotationDegrees: number;
  tiltStartSeconds: number;
  tiltEndSeconds: number;
  returnStartSeconds: number;
  returnEndSeconds: number;
  settleEndSeconds: number;
}

/**
 * Keeps the source free surface roughly horizontal in world space while still
 * allowing one readable lag/overshoot during acceleration and return.
 *
 * These phases deliberately do not overlap on `rotation`. The old version had
 * competing rotation tweens, which made the intended slosh hard to read.
 */
export function addSourceSlosh(
  timeline: Timeline,
  {
    surfaceElement,
    bottleRotationDegrees,
    tiltStartSeconds,
    tiltEndSeconds,
    returnStartSeconds,
    returnEndSeconds,
    settleEndSeconds,
  }: SourceSloshOptions,
): void {
  const counterRotation = -bottleRotationDegrees;
  const lagStartSeconds = tiltStartSeconds + 0.03;
  const returnMidSeconds = (returnStartSeconds + returnEndSeconds) / 2;

  timeline.to(
    surfaceElement,
    {
      rotation: counterRotation * 0.9,
      duration: Math.max(0.01, tiltEndSeconds - lagStartSeconds),
      ease: "power2.out",
    },
    lagStartSeconds,
  );

  timeline.to(
    surfaceElement,
    {
      rotation: counterRotation,
      duration: 0.12,
      ease: "sine.out",
    },
    tiltEndSeconds,
  );

  timeline.to(
    surfaceElement,
    {
      rotation: counterRotation * 0.45,
      duration: returnMidSeconds - returnStartSeconds,
      ease: "power2.inOut",
    },
    returnStartSeconds,
  );

  timeline.to(
    surfaceElement,
    {
      rotation: counterRotation * 0.06,
      duration: returnEndSeconds - returnMidSeconds,
      ease: "sine.inOut",
    },
    returnMidSeconds,
  );

  timeline.to(
    surfaceElement,
    {
      rotation: 0,
      duration: Math.max(0.01, settleEndSeconds - returnEndSeconds),
      ease: "sine.out",
    },
    returnEndSeconds,
  );
}

export interface DestinationSloshOptions {
  surfaceElement: HTMLElement;
  impactPlumeElement: HTMLElement | null;
  transferStartSeconds: number;
  transferEndSeconds: number;
  streamCloseEndSeconds: number;
}

/**
 * Animates the *visible incoming* surface rather than the destination's old,
 * buried surface. A short-lived impact plume grows, sways, and is absorbed as
 * the stream closes so the receiving-side purple shape never reads as static.
 */
export function addDestinationSlosh(
  timeline: Timeline,
  {
    surfaceElement,
    impactPlumeElement,
    transferStartSeconds,
    transferEndSeconds,
    streamCloseEndSeconds,
  }: DestinationSloshOptions,
): void {
  const impactStartSeconds = transferStartSeconds + 0.04;

  timeline.to(
    surfaceElement,
    {
      rotation: 4.5,
      scaleY: 0.88,
      duration: 0.08,
      ease: "power1.out",
    },
    impactStartSeconds,
  );

  timeline.to(
    surfaceElement,
    {
      rotation: -2.75,
      scaleY: 1.08,
      duration: 0.1,
      ease: "sine.inOut",
    },
    impactStartSeconds + 0.08,
  );

  timeline.to(
    surfaceElement,
    {
      rotation: 0,
      scaleY: 1,
      duration: Math.max(0.12, transferEndSeconds - (impactStartSeconds + 0.18)),
      ease: "sine.out",
    },
    impactStartSeconds + 0.18,
  );

  if (impactPlumeElement === null) return;

  timeline.to(
    impactPlumeElement,
    {
      opacity: 0.86,
      scaleY: 1,
      x: 0,
      duration: 0.08,
      ease: "power2.out",
    },
    impactStartSeconds,
  );

  timeline.to(
    impactPlumeElement,
    {
      x: 2,
      scaleY: 1.08,
      duration: 0.08,
      ease: "sine.inOut",
    },
    impactStartSeconds + 0.08,
  );

  timeline.to(
    impactPlumeElement,
    {
      x: -2,
      scaleY: 0.92,
      duration: 0.08,
      ease: "sine.inOut",
    },
    impactStartSeconds + 0.16,
  );

  timeline.to(
    impactPlumeElement,
    {
      x: 0,
      scaleY: 1,
      duration: Math.max(0.06, transferEndSeconds - (impactStartSeconds + 0.24)),
      ease: "sine.out",
    },
    impactStartSeconds + 0.24,
  );

  timeline.to(
    impactPlumeElement,
    {
      opacity: 0,
      scaleY: 0.45,
      duration: Math.max(0.06, streamCloseEndSeconds - transferEndSeconds),
      ease: "power1.in",
    },
    transferEndSeconds,
  );
}
