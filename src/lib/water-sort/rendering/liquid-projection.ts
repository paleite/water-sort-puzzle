import {
  VIAL_INNER_HEIGHT,
  VIAL_INNER_LEFT,
  VIAL_INNER_TOP,
  VIAL_INNER_WIDTH,
} from "../presentation/vial-geometry";
import {DEFAULT_VIAL_SKIN} from "../presentation/vial-skins";

const AREA_EPSILON = 1e-10;
const THRESHOLD_ITERATIONS = 48;

export interface LiquidProjectionPoint {
  x: number;
  y: number;
}

export interface LiquidProjectionGeometry {
  normal: LiquidProjectionPoint;
  interiorAspect: number;
  freeSurfaceThreshold: number;
  bandThresholds: readonly [number, number, number, number];
}

export const DEFAULT_LIQUID_PROJECTION_POLYGON: readonly LiquidProjectionPoint[] =
  DEFAULT_VIAL_SKIN.liquidPolygon.map(({x, y}) => ({
    x: (x - VIAL_INNER_LEFT) / VIAL_INNER_HEIGHT,
    y: (y - VIAL_INNER_TOP) / VIAL_INNER_HEIGHT,
  }));

export const DEFAULT_LIQUID_INTERIOR_ASPECT =
  VIAL_INNER_WIDTH / VIAL_INNER_HEIGHT;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function dot(point: LiquidProjectionPoint, normal: LiquidProjectionPoint): number {
  return point.x * normal.x + point.y * normal.y;
}

function polygonArea(points: readonly LiquidProjectionPoint[]): number {
  if (points.length < 3) return 0;

  let twiceArea = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    if (current === undefined || next === undefined) continue;
    twiceArea += current.x * next.y - next.x * current.y;
  }

  return Math.abs(twiceArea) / 2;
}

function clipPolygonAtOrAboveThreshold(
  polygon: readonly LiquidProjectionPoint[],
  normal: LiquidProjectionPoint,
  threshold: number,
): LiquidProjectionPoint[] {
  if (polygon.length === 0) return [];

  const clipped: LiquidProjectionPoint[] = [];
  let previous = polygon[polygon.length - 1];
  if (previous === undefined) return [];
  let previousProjection = dot(previous, normal);
  let previousInside = previousProjection >= threshold;

  for (const current of polygon) {
    const currentProjection = dot(current, normal);
    const currentInside = currentProjection >= threshold;

    if (previousInside !== currentInside) {
      const denominator = currentProjection - previousProjection;
      const progress = Math.abs(denominator) <= AREA_EPSILON
        ? 0
        : (threshold - previousProjection) / denominator;

      clipped.push({
        x: previous.x + (current.x - previous.x) * progress,
        y: previous.y + (current.y - previous.y) * progress,
      });
    }

    if (currentInside) clipped.push(current);

    previous = current;
    previousProjection = currentProjection;
    previousInside = currentInside;
  }

  return clipped;
}

export function getProjectedAreaFractionAtOrAboveThreshold(
  polygon: readonly LiquidProjectionPoint[],
  normal: LiquidProjectionPoint,
  threshold: number,
): number {
  const totalArea = polygonArea(polygon);
  if (totalArea <= AREA_EPSILON) return 0;

  return polygonArea(clipPolygonAtOrAboveThreshold(polygon, normal, threshold)) / totalArea;
}

export function getLiquidSurfaceNormal(
  surfaceAngleDegrees: number,
): LiquidProjectionPoint {
  const angleRadians = (surfaceAngleDegrees * Math.PI) / 180;
  return {
    x: -Math.sin(angleRadians),
    y: Math.cos(angleRadians),
  };
}

function findThresholdForAreaFraction(
  polygon: readonly LiquidProjectionPoint[],
  normal: LiquidProjectionPoint,
  requestedFraction: number,
): number {
  const fraction = clamp(requestedFraction, 0, 1);
  const projections = polygon.map((point) => dot(point, normal));
  const minimumProjection = Math.min(...projections);
  const maximumProjection = Math.max(...projections);

  if (fraction <= AREA_EPSILON) return maximumProjection + AREA_EPSILON;
  if (fraction >= 1 - AREA_EPSILON) return minimumProjection - AREA_EPSILON;

  let lowerThreshold = minimumProjection;
  let upperThreshold = maximumProjection;

  for (let iteration = 0; iteration < THRESHOLD_ITERATIONS; iteration += 1) {
    const threshold = (lowerThreshold + upperThreshold) / 2;
    const areaFraction = getProjectedAreaFractionAtOrAboveThreshold(
      polygon,
      normal,
      threshold,
    );

    if (areaFraction > fraction) {
      lowerThreshold = threshold;
    } else {
      upperThreshold = threshold;
    }
  }

  return (lowerThreshold + upperThreshold) / 2;
}

export function calculateLiquidProjectionGeometry({
  surfaceAngleDegrees,
  bandVolumes,
  capacity,
  polygon = DEFAULT_LIQUID_PROJECTION_POLYGON,
}: {
  surfaceAngleDegrees: number;
  bandVolumes: readonly number[];
  capacity: number;
  polygon?: readonly LiquidProjectionPoint[];
}): LiquidProjectionGeometry {
  const normal = getLiquidSurfaceNormal(surfaceAngleDegrees);
  const safeCapacity = Math.max(capacity, AREA_EPSILON);
  const thresholds: [number, number, number, number] = [0, 0, 0, 0];

  let cumulativeVolume = 0;
  for (let index = 0; index < thresholds.length; index += 1) {
    const volume = clamp(bandVolumes[index] ?? 0, 0, safeCapacity);
    cumulativeVolume += volume;

    if (volume > AREA_EPSILON) {
      thresholds[index] = findThresholdForAreaFraction(
        polygon,
        normal,
        cumulativeVolume / safeCapacity,
      );
    }
  }

  const totalVolume = bandVolumes.reduce(
    (sum, volume) => sum + clamp(volume, 0, safeCapacity),
    0,
  );

  return {
    normal,
    interiorAspect: DEFAULT_LIQUID_INTERIOR_ASPECT,
    freeSurfaceThreshold: findThresholdForAreaFraction(
      polygon,
      normal,
      totalVolume / safeCapacity,
    ),
    bandThresholds: thresholds,
  };
}
