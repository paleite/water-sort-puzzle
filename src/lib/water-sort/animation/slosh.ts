import gsap from "gsap";

import {
  fillToVialY,
  VIAL_INNER_BOTTOM,
  VIAL_INNER_HEIGHT,
  VIAL_INNER_LEFT,
  VIAL_INNER_RIGHT,
  VIAL_INNER_TOP,
  VIAL_INNER_WIDTH,
} from "../presentation/vial-geometry";
import type { AppliedMove } from "../domain/types";
import { GAME_TIMING } from "./timing";

const SURFACE_POINT_COUNT = 11;
const GRAVITY_METRES_PER_SECOND_SQUARED = 9.81;
const SOURCE_NATURAL_FREQUENCY = 22;
const SOURCE_DAMPING_RATIO = 0.34;
const DESTINATION_SPRING = 118;
const DESTINATION_DAMPING = 12.5;
const DESTINATION_COUPLING = 86;
const DESTINATION_IMPACT_FORCE = 210;
const MAX_SOURCE_WORLD_ANGLE_DEGREES = 14;
const MAX_DESTINATION_DISPLACEMENT = 6.5;
const SPLINE_TENSION = 0.82;

interface Point {
  x: number;
  y: number;
}

interface LiquidSimulationElements {
  sourceElement: HTMLElement;
  sourceLayerElements: readonly SVGPathElement[];
  sourceSurfaceElement: SVGPathElement | null;
  destinationLiquidElement: SVGPathElement | null;
  destinationSurfaceElement: SVGPathElement | null;
  destinationDebugPointElements?: readonly SVGCircleElement[];
}

export interface LiquidSimulationSnapshot {
  timeSeconds: number;
  sourceWorldAngleDegrees: number;
  sourceAngularVelocity: number;
  destinationMaximumDisplacement: number;
}

export interface LiquidSimulation {
  update(timeSeconds: number): void;
  reset(): void;
  finish(): void;
  getSnapshot(): LiquidSimulationSnapshot;
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

const X_COORDINATES = Array.from(
  {length: SURFACE_POINT_COUNT},
  (_, index) =>
    VIAL_INNER_LEFT
    + (index / (SURFACE_POINT_COUNT - 1)) * VIAL_INNER_WIDTH,
);

function trapezoidAreaBelowSurface(
  intercept: number,
  offsets: readonly number[],
): number {
  let area = 0;
  const segmentWidth = VIAL_INNER_WIDTH / (SURFACE_POINT_COUNT - 1);

  for (let index = 0; index < SURFACE_POINT_COUNT - 1; index += 1) {
    const firstY = clamp(
      intercept + (offsets[index] ?? 0),
      VIAL_INNER_TOP,
      VIAL_INNER_BOTTOM,
    );
    const secondY = clamp(
      intercept + (offsets[index + 1] ?? 0),
      VIAL_INNER_TOP,
      VIAL_INNER_BOTTOM,
    );
    const firstHeight = VIAL_INNER_BOTTOM - firstY;
    const secondHeight = VIAL_INNER_BOTTOM - secondY;
    area += ((firstHeight + secondHeight) / 2) * segmentWidth;
  }

  return area;
}

function boundaryForFill(
  fillFraction: number,
  angleDegrees: number,
  waveOffsets: readonly number[],
): Point[] {
  const clampedFill = clamp(fillFraction, 0, 1);
  if (clampedFill <= 0) {
    return X_COORDINATES.map((x) => ({x, y: VIAL_INNER_BOTTOM}));
  }
  if (clampedFill >= 1) {
    return X_COORDINATES.map((x) => ({x, y: VIAL_INNER_TOP}));
  }

  const safeAngle = clamp(angleDegrees, -86, 86);
  const slope = Math.tan((safeAngle * Math.PI) / 180);
  const centerX = (VIAL_INNER_LEFT + VIAL_INNER_RIGHT) / 2;
  const offsets = X_COORDINATES.map((x, index) =>
    slope * (x - centerX) + (waveOffsets[index] ?? 0)
  );
  const targetArea = clampedFill * VIAL_INNER_WIDTH * VIAL_INNER_HEIGHT;

  let lowerIntercept = VIAL_INNER_TOP - VIAL_INNER_HEIGHT * 6;
  let upperIntercept = VIAL_INNER_BOTTOM + VIAL_INNER_HEIGHT * 6;

  for (let iteration = 0; iteration < 34; iteration += 1) {
    const midpoint = (lowerIntercept + upperIntercept) / 2;
    const area = trapezoidAreaBelowSurface(midpoint, offsets);
    if (area > targetArea) lowerIntercept = midpoint;
    else upperIntercept = midpoint;
  }

  const intercept = (lowerIntercept + upperIntercept) / 2;
  return X_COORDINATES.map((x, index) => ({
    x,
    y: clamp(
      intercept + (offsets[index] ?? 0),
      VIAL_INNER_TOP,
      VIAL_INNER_BOTTOM,
    ),
  }));
}

function splineCommands(points: readonly Point[]): string {
  const first = points[0];
  if (first === undefined) return "";

  const commands = [`M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`];

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)] ?? first;
    const p1 = points[index] ?? first;
    const p2 = points[index + 1] ?? p1;
    const p3 = points[Math.min(points.length - 1, index + 2)] ?? p2;
    const scale = SPLINE_TENSION / 6;
    const cp1 = {
      x: p1.x + (p2.x - p0.x) * scale,
      y: p1.y + (p2.y - p0.y) * scale,
    };
    const cp2 = {
      x: p2.x - (p3.x - p1.x) * scale,
      y: p2.y - (p3.y - p1.y) * scale,
    };

    commands.push(
      `C ${cp1.x.toFixed(2)} ${cp1.y.toFixed(2)} ${cp2.x.toFixed(2)} ${cp2.y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    );
  }

  return commands.join(" ");
}

function liquidBodyPath(
  upperBoundary: readonly Point[],
  baseY: number,
): string {
  const first = upperBoundary[0];
  const last = upperBoundary.at(-1);
  if (first === undefined || last === undefined) return "";

  return [
    splineCommands(upperBoundary),
    `L ${VIAL_INNER_RIGHT} ${baseY.toFixed(2)}`,
    `L ${VIAL_INNER_LEFT} ${baseY.toFixed(2)}`,
    "Z",
  ].join(" ");
}

function surfacePath(boundary: readonly Point[]): string {
  return splineCommands(boundary);
}

function clampBoundaryAboveBase(
  boundary: readonly Point[],
  baseY: number,
): Point[] {
  return boundary.map((point) => ({
    x: point.x,
    y: Math.min(point.y, baseY),
  }));
}

function streamStrengthAt(timeSeconds: number): number {
  const transferStart = GAME_TIMING.pour.transferStartSeconds;
  const transferEnd = transferStart + GAME_TIMING.pour.transferSeconds;
  if (timeSeconds <= transferStart || timeSeconds >= transferEnd) return 0;

  const rampIn = clamp((timeSeconds - transferStart) / 0.06, 0, 1);
  const rampOut = clamp((transferEnd - timeSeconds) / 0.08, 0, 1);
  return Math.min(rampIn, rampOut);
}

function setPathVisibility(path: SVGPathElement | null, visible: boolean): void {
  if (path === null) return;
  path.style.opacity = visible ? "1" : "0";
}

export function createLiquidSimulation({
  elements,
  move,
  capacity,
}: {
  elements: LiquidSimulationElements;
  move: AppliedMove;
  capacity: number;
}): LiquidSimulation {
  const {
    sourceElement,
    sourceLayerElements,
    sourceSurfaceElement,
    destinationLiquidElement,
    destinationSurfaceElement,
    destinationDebugPointElements = [],
  } = elements;

  const sourceIndex = move.move.sourceVialIndex;
  const destinationIndex = move.move.destinationVialIndex;
  const previousSourceFill = move.previousBoard[sourceIndex]?.length ?? 0;
  const nextSourceFill = move.nextBoard[sourceIndex]?.length ?? 0;
  const previousDestinationVial = move.previousBoard[destinationIndex] ?? [];
  const previousDestinationFill = previousDestinationVial.length;

  let destinationDynamicBaseFill = previousDestinationFill;
  while (
    destinationDynamicBaseFill > 0
    && previousDestinationVial[destinationDynamicBaseFill - 1] === move.color
  ) {
    destinationDynamicBaseFill -= 1;
  }

  const sourceWidth = Math.max(1, sourceElement.offsetWidth);
  const metresPerPixel = 0.06 / sourceWidth;
  const homeTimeSeconds =
    GAME_TIMING.pour.returnTravelSeconds + GAME_TIMING.pour.returnTravelDurationSeconds;

  let previousTimeSeconds: number | null = null;
  let previousCenterX = 0;
  let previousCenterY = 0;
  let previousVelocityX = 0;
  let previousVelocityY = 0;
  let filteredAccelerationX = 0;
  let filteredAccelerationY = 0;
  let sourceWorldAngle = 0;
  let sourceAngularVelocity = 0;
  let impactTriggered = false;
  let currentTimeSeconds = 0;

  const destinationDisplacements = Array.from({length: SURFACE_POINT_COUNT}, () => 0);
  const destinationVelocities = Array.from({length: SURFACE_POINT_COUNT}, () => 0);

  function getSourceCenter(): {x: number; y: number; rotationDegrees: number} {
    const rect = sourceElement.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      rotationDegrees: getGsapNumber(sourceElement, "rotation"),
    };
  }

  function integrate(
    deltaSeconds: number,
    equilibriumWorldAngle: number,
    integrationTimeSeconds: number,
  ): void {
    const substepCount = Math.max(1, Math.ceil(deltaSeconds / (1 / 120)));
    const substepSeconds = deltaSeconds / substepCount;
    const settleBlend = clamp((integrationTimeSeconds - homeTimeSeconds) / 0.28, 0, 1);
    const sourceDampingRatio = SOURCE_DAMPING_RATIO + settleBlend * 0.5;
    const destinationDamping = DESTINATION_DAMPING + settleBlend * 14;

    for (let step = 0; step < substepCount; step += 1) {
      const sourceAcceleration =
        SOURCE_NATURAL_FREQUENCY * SOURCE_NATURAL_FREQUENCY
        * (equilibriumWorldAngle - sourceWorldAngle)
        - 2 * sourceDampingRatio * SOURCE_NATURAL_FREQUENCY * sourceAngularVelocity;

      sourceAngularVelocity += sourceAcceleration * substepSeconds;
      sourceWorldAngle = clamp(
        sourceWorldAngle + sourceAngularVelocity * substepSeconds,
        -MAX_SOURCE_WORLD_ANGLE_DEGREES,
        MAX_SOURCE_WORLD_ANGLE_DEGREES,
      );

      const previousDisplacements = [...destinationDisplacements];
      const previousVelocities = [...destinationVelocities];
      const flow = streamStrengthAt(integrationTimeSeconds);

      for (let pointIndex = 0; pointIndex < SURFACE_POINT_COUNT; pointIndex += 1) {
        const left = pointIndex > 0
          ? previousDisplacements[pointIndex - 1] ?? 0
          : previousDisplacements[pointIndex] ?? 0;
        const right = pointIndex < SURFACE_POINT_COUNT - 1
          ? previousDisplacements[pointIndex + 1] ?? 0
          : previousDisplacements[pointIndex] ?? 0;
        const displacement = previousDisplacements[pointIndex] ?? 0;
        const velocity = previousVelocities[pointIndex] ?? 0;
        const neighborForce = DESTINATION_COUPLING * (left + right - 2 * displacement);
        const distanceFromImpact = Math.abs(pointIndex - 2.5);
        const impactWeight = Math.exp(-(distanceFromImpact * distanceFromImpact) / 5.2);
        const impactForce = DESTINATION_IMPACT_FORCE * flow * impactWeight;
        const acceleration =
          -DESTINATION_SPRING * displacement
          -destinationDamping * velocity
          + neighborForce
          + impactForce;

        destinationVelocities[pointIndex] = velocity + acceleration * substepSeconds;
        destinationDisplacements[pointIndex] = clamp(
          displacement + (destinationVelocities[pointIndex] ?? 0) * substepSeconds,
          -MAX_DESTINATION_DISPLACEMENT,
          MAX_DESTINATION_DISPLACEMENT,
        );
      }
    }
  }

  function updateDebugSurfacePoints(boundary: readonly Point[]): void {
    destinationDebugPointElements.forEach((element, index) => {
      const point = boundary[index];
      if (point === undefined) return;
      element.setAttribute("cx", point.x.toFixed(2));
      element.setAttribute("cy", point.y.toFixed(2));
    });
  }

  function render(timeSeconds: number, rotationDegrees: number): void {
    const transferProgress = clamp(
      (timeSeconds - GAME_TIMING.pour.transferStartSeconds) / GAME_TIMING.pour.transferSeconds,
      0,
      1,
    );

    const localSourceAngle = sourceWorldAngle - rotationDegrees;
    const curvatureAmplitude = clamp(sourceAngularVelocity * 0.045, -3.2, 3.2);
    const sourceWaveOffsets = X_COORDINATES.map((_, index) => {
      const normalized = index / (SURFACE_POINT_COUNT - 1);
      return curvatureAmplitude * Math.sin(Math.PI * normalized);
    });

    const sourceDynamicElement = sourceLayerElements[0];
    const sourceBaseY = fillToVialY(nextSourceFill, capacity);
    const remainingOutgoingFill = move.amount * (1 - transferProgress);
    const outgoingTopFillFraction = (nextSourceFill + remainingOutgoingFill) / capacity;
    const outgoingBoundary = clampBoundaryAboveBase(
      boundaryForFill(outgoingTopFillFraction, localSourceAngle, sourceWaveOffsets),
      sourceBaseY,
    );

    if (sourceDynamicElement !== undefined) {
      sourceDynamicElement.setAttribute("d", liquidBodyPath(outgoingBoundary, sourceBaseY));
      sourceDynamicElement.style.opacity = remainingOutgoingFill > 0.001 ? "1" : "0";
    }

    if (sourceSurfaceElement !== null) {
      sourceSurfaceElement.setAttribute("d", surfacePath(outgoingBoundary));
      setPathVisibility(sourceSurfaceElement, remainingOutgoingFill > 0.001);
    }

    if (destinationLiquidElement !== null && destinationSurfaceElement !== null) {
      const incomingFill = (move.amount * transferProgress) / capacity;
      const destinationTopFillFraction = previousDestinationFill / capacity + incomingFill;
      const destinationBaseFillFraction = destinationDynamicBaseFill / capacity;
      const waveScale = clamp(transferProgress * 3, 0, 1);
      const destinationWaveOffsets = destinationDisplacements.map(
        (value) => value * waveScale,
      );
      const destinationBaseY = fillToVialY(destinationDynamicBaseFill, capacity);
      const upperBoundary = clampBoundaryAboveBase(
        boundaryForFill(destinationTopFillFraction, 0, destinationWaveOffsets),
        destinationBaseY,
      );

      destinationLiquidElement.setAttribute(
        "d",
        liquidBodyPath(upperBoundary, destinationBaseY),
      );
      destinationSurfaceElement.setAttribute("d", surfacePath(upperBoundary));
      updateDebugSurfacePoints(upperBoundary);

      const visible = destinationTopFillFraction - destinationBaseFillFraction > 0.0005;
      setPathVisibility(destinationLiquidElement, visible);
      setPathVisibility(destinationSurfaceElement, visible);
    }
  }

  function update(timeSeconds: number): void {
    currentTimeSeconds = timeSeconds;
    const center = getSourceCenter();

    if (previousTimeSeconds === null) {
      previousTimeSeconds = timeSeconds;
      previousCenterX = center.x;
      previousCenterY = center.y;
      render(timeSeconds, center.rotationDegrees);
      return;
    }

    const deltaSeconds = timeSeconds - previousTimeSeconds;
    if (deltaSeconds > 0.0001) {
      const velocityX = (center.x - previousCenterX) / deltaSeconds;
      const velocityY = (center.y - previousCenterY) / deltaSeconds;
      const accelerationX = (velocityX - previousVelocityX) / deltaSeconds;
      const accelerationY = (velocityY - previousVelocityY) / deltaSeconds;
      const lowPassBlend = deltaSeconds / (0.025 + deltaSeconds);

      filteredAccelerationX += lowPassBlend * (accelerationX - filteredAccelerationX);
      filteredAccelerationY += lowPassBlend * (accelerationY - filteredAccelerationY);

      if (timeSeconds >= homeTimeSeconds) {
        const decay = Math.exp(-deltaSeconds * 11);
        filteredAccelerationX *= decay;
        filteredAccelerationY *= decay;
      }

      const horizontalAcceleration = filteredAccelerationX * metresPerPixel;
      const verticalAcceleration = filteredAccelerationY * metresPerPixel;
      const denominator = Math.max(2, GRAVITY_METRES_PER_SECOND_SQUARED - verticalAcceleration);
      const equilibriumWorldAngle = clamp(
        (Math.atan2(horizontalAcceleration, denominator) * 180) / Math.PI,
        -18,
        18,
      );

      integrate(deltaSeconds, equilibriumWorldAngle, timeSeconds);

      const impactTime = GAME_TIMING.pour.transferStartSeconds + 0.045;
      if (!impactTriggered && timeSeconds >= impactTime) {
        impactTriggered = true;
        destinationVelocities[1] = (destinationVelocities[1] ?? 0) + 12;
        destinationVelocities[2] = (destinationVelocities[2] ?? 0) + 28;
        destinationVelocities[3] = (destinationVelocities[3] ?? 0) + 24;
        destinationVelocities[4] = (destinationVelocities[4] ?? 0) + 12;
      }

      previousVelocityX = velocityX;
      previousVelocityY = velocityY;
      previousCenterX = center.x;
      previousCenterY = center.y;
      previousTimeSeconds = timeSeconds;
    }

    render(timeSeconds, center.rotationDegrees);
  }

  function reset(): void {
    previousTimeSeconds = null;
    previousCenterX = 0;
    previousCenterY = 0;
    previousVelocityX = 0;
    previousVelocityY = 0;
    filteredAccelerationX = 0;
    filteredAccelerationY = 0;
    sourceWorldAngle = 0;
    sourceAngularVelocity = 0;
    impactTriggered = false;
    currentTimeSeconds = 0;
    destinationDisplacements.fill(0);
    destinationVelocities.fill(0);

    for (const sourceLayerElement of sourceLayerElements) {
      sourceLayerElement.style.opacity = "0";
    }
    setPathVisibility(sourceSurfaceElement, false);
    setPathVisibility(destinationLiquidElement, false);
    setPathVisibility(destinationSurfaceElement, false);
  }

  function finish(): void {
    currentTimeSeconds = GAME_TIMING.pour.totalSeconds;
    sourceWorldAngle = 0;
    sourceAngularVelocity = 0;
    filteredAccelerationX = 0;
    filteredAccelerationY = 0;
    destinationDisplacements.fill(0);
    destinationVelocities.fill(0);
    render(GAME_TIMING.pour.totalSeconds, 0);
  }

  function getSnapshot(): LiquidSimulationSnapshot {
    return {
      timeSeconds: currentTimeSeconds,
      sourceWorldAngleDegrees: sourceWorldAngle,
      sourceAngularVelocity,
      destinationMaximumDisplacement: Math.max(
        0,
        ...destinationDisplacements.map((value) => Math.abs(value)),
      ),
    };
  }

  if (previousSourceFill <= 0) {
    setPathVisibility(sourceSurfaceElement, false);
  }
  setPathVisibility(destinationLiquidElement, false);
  setPathVisibility(destinationSurfaceElement, false);

  return {update, reset, finish, getSnapshot};
}
