import gsap from "gsap";

import type { AppliedMove } from "../domain/types";
import { GAME_TIMING } from "./timing";

const VIEWBOX_SIZE = 100;
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

function fillToY(fillFraction: number): number {
  return VIEWBOX_SIZE * (1 - fillFraction);
}

function getGsapNumber(element: HTMLElement, property: string): number {
  const value = gsap.getProperty(element, property);
  if (typeof value === "number") return value;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function createXCoordinates(): number[] {
  return Array.from(
    {length: SURFACE_POINT_COUNT},
    (_, index) => (index / (SURFACE_POINT_COUNT - 1)) * VIEWBOX_SIZE,
  );
}

const X_COORDINATES = createXCoordinates();

function trapezoidAreaBelowSurface(
  intercept: number,
  offsets: readonly number[],
): number {
  let area = 0;
  const segmentWidth = VIEWBOX_SIZE / (SURFACE_POINT_COUNT - 1);

  for (let index = 0; index < SURFACE_POINT_COUNT - 1; index += 1) {
    const firstY = clamp(intercept + (offsets[index] ?? 0), 0, VIEWBOX_SIZE);
    const secondY = clamp(intercept + (offsets[index + 1] ?? 0), 0, VIEWBOX_SIZE);
    const firstHeight = VIEWBOX_SIZE - firstY;
    const secondHeight = VIEWBOX_SIZE - secondY;
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
    return X_COORDINATES.map((x) => ({x, y: VIEWBOX_SIZE}));
  }
  if (clampedFill >= 1) {
    return X_COORDINATES.map((x) => ({x, y: 0}));
  }

  const safeAngle = clamp(angleDegrees, -86, 86);
  const slope = Math.tan((safeAngle * Math.PI) / 180);
  const offsets = X_COORDINATES.map((x, index) =>
    slope * (x - VIEWBOX_SIZE / 2) + (waveOffsets[index] ?? 0)
  );
  const targetArea = clampedFill * VIEWBOX_SIZE * VIEWBOX_SIZE;

  let lowerIntercept = -VIEWBOX_SIZE * 6;
  let upperIntercept = VIEWBOX_SIZE * 6;

  for (let iteration = 0; iteration < 34; iteration += 1) {
    const midpoint = (lowerIntercept + upperIntercept) / 2;
    const area = trapezoidAreaBelowSurface(midpoint, offsets);
    if (area > targetArea) lowerIntercept = midpoint;
    else upperIntercept = midpoint;
  }

  const intercept = (lowerIntercept + upperIntercept) / 2;
  return X_COORDINATES.map((x, index) => ({
    x,
    y: clamp(intercept + (offsets[index] ?? 0), 0, VIEWBOX_SIZE),
  }));
}

function splineCommands(points: readonly Point[], includeMove: boolean): string {
  if (points.length === 0) return "";

  const first = points[0];
  if (first === undefined) return "";

  const commands: string[] = [];
  if (includeMove) commands.push(`M ${first.x.toFixed(2)} ${first.y.toFixed(2)}`);

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

function layerPath(upperBoundary: readonly Point[], lowerBoundary: readonly Point[]): string {
  if (upperBoundary.length === 0 || lowerBoundary.length === 0) return "";
  return `${splineCommands(upperBoundary, true)} ${splineCommands([...lowerBoundary].reverse(), false)} Z`;
}

function surfacePath(boundary: readonly Point[]): string {
  return splineCommands(boundary, true);
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

  const sourceHeight = Math.max(1, sourceElement.offsetHeight);
  const sourceWidth = Math.max(1, sourceElement.offsetWidth);
  const pivotToCenter = sourceHeight / 2 - 4;
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
    const translationX = getGsapNumber(sourceElement, "x");
    const translationY = getGsapNumber(sourceElement, "y");
    const rotationDegrees = getGsapNumber(sourceElement, "rotation");
    const radians = (rotationDegrees * Math.PI) / 180;

    return {
      x: translationX - pivotToCenter * Math.sin(radians),
      y: translationY + pivotToCenter * Math.cos(radians),
      rotationDegrees,
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

    const sourceBoundaries: Point[][] = [];
    for (let fill = 0; fill <= nextSourceFill; fill += 1) {
      sourceBoundaries.push(boundaryForFill(fill / capacity, localSourceAngle, sourceWaveOffsets));
    }

    for (let layerIndex = 0; layerIndex < nextSourceFill; layerIndex += 1) {
      const lowerBoundary = sourceBoundaries[layerIndex];
      const upperBoundary = sourceBoundaries[layerIndex + 1];
      const layerElement = sourceLayerElements[layerIndex];
      if (lowerBoundary === undefined || upperBoundary === undefined || layerElement === undefined) continue;
      layerElement.setAttribute("d", layerPath(upperBoundary, lowerBoundary));
      layerElement.style.opacity = "1";
    }

    const outgoingLayerElement = sourceLayerElements[nextSourceFill];
    const outgoingLowerBoundary = sourceBoundaries[nextSourceFill]
      ?? boundaryForFill(nextSourceFill / capacity, localSourceAngle, sourceWaveOffsets);
    const remainingOutgoingFill = move.amount * (1 - transferProgress);
    const outgoingUpperFillFraction = (nextSourceFill + remainingOutgoingFill) / capacity;
    const outgoingUpperBoundary = boundaryForFill(
      outgoingUpperFillFraction,
      localSourceAngle,
      sourceWaveOffsets,
    );

    if (outgoingLayerElement !== undefined) {
      outgoingLayerElement.setAttribute("d", layerPath(outgoingUpperBoundary, outgoingLowerBoundary));
      outgoingLayerElement.style.opacity = remainingOutgoingFill > 0.001 ? "1" : "0";
    }

    if (sourceSurfaceElement !== null) {
      sourceSurfaceElement.setAttribute("d", surfacePath(outgoingUpperBoundary));
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
      const upperBoundary = boundaryForFill(
        destinationTopFillFraction,
        0,
        destinationWaveOffsets,
      );
      const baseY = fillToY(destinationBaseFillFraction);
      const clippedUpperBoundary = upperBoundary.map((point) => ({
        x: point.x,
        y: Math.min(point.y, baseY),
      }));
      const lowerBoundary = X_COORDINATES.map((x) => ({x, y: baseY}));

      destinationLiquidElement.setAttribute(
        "d",
        layerPath(clippedUpperBoundary, lowerBoundary),
      );
      destinationSurfaceElement.setAttribute("d", surfacePath(clippedUpperBoundary));
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
