import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateLiquidProjectionGeometry,
  DEFAULT_LIQUID_PROJECTION_POLYGON,
  getProjectedAreaFractionAtOrAboveThreshold,
} from "./liquid-projection";

const CAPACITY = 4;
const REGRESSION_ANGLES = [
  0,
  12.118,
  -87.757,
  -85.264,
  -79.333,
  -89.999,
  -90,
  -90.001,
] as const;

function assertClose(actual: number, expected: number, tolerance = 1e-8): void {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}.`,
  );
}

test("tilted two-band liquid preserves both band volumes", () => {
  for (const surfaceAngleDegrees of REGRESSION_ANGLES) {
    const geometry = calculateLiquidProjectionGeometry({
      surfaceAngleDegrees,
      bandVolumes: [1, 1],
      capacity: CAPACITY,
    });

    const bottomBandArea = getProjectedAreaFractionAtOrAboveThreshold(
      DEFAULT_LIQUID_PROJECTION_POLYGON,
      geometry.normal,
      geometry.bandThresholds[0],
    );
    const totalLiquidArea = getProjectedAreaFractionAtOrAboveThreshold(
      DEFAULT_LIQUID_PROJECTION_POLYGON,
      geometry.normal,
      geometry.freeSurfaceThreshold,
    );

    assertClose(bottomBandArea, 0.25);
    assertClose(totalLiquidArea, 0.5);
    assertClose(geometry.bandThresholds[1], geometry.freeSurfaceThreshold);
    assert.ok(
      geometry.bandThresholds[0] > geometry.bandThresholds[1],
      `Bottom-band threshold must stay below the free surface at ${surfaceAngleDegrees} degrees.`,
    );
  }
});

test("partial top band preserves its volume during the same tilt range", () => {
  for (const surfaceAngleDegrees of REGRESSION_ANGLES) {
    const geometry = calculateLiquidProjectionGeometry({
      surfaceAngleDegrees,
      bandVolumes: [1, 0.5],
      capacity: CAPACITY,
    });

    const bottomBandArea = getProjectedAreaFractionAtOrAboveThreshold(
      DEFAULT_LIQUID_PROJECTION_POLYGON,
      geometry.normal,
      geometry.bandThresholds[0],
    );
    const totalLiquidArea = getProjectedAreaFractionAtOrAboveThreshold(
      DEFAULT_LIQUID_PROJECTION_POLYGON,
      geometry.normal,
      geometry.freeSurfaceThreshold,
    );

    assertClose(bottomBandArea, 0.25);
    assertClose(totalLiquidArea, 0.375);
  }
});

test("projection thresholds stay continuous through a vertical surface", () => {
  const before = calculateLiquidProjectionGeometry({
    surfaceAngleDegrees: -89.9,
    bandVolumes: [1, 1],
    capacity: CAPACITY,
  });
  const vertical = calculateLiquidProjectionGeometry({
    surfaceAngleDegrees: -90,
    bandVolumes: [1, 1],
    capacity: CAPACITY,
  });
  const after = calculateLiquidProjectionGeometry({
    surfaceAngleDegrees: -90.1,
    bandVolumes: [1, 1],
    capacity: CAPACITY,
  });

  assert.ok(Math.abs(before.freeSurfaceThreshold - vertical.freeSurfaceThreshold) < 0.01);
  assert.ok(Math.abs(after.freeSurfaceThreshold - vertical.freeSurfaceThreshold) < 0.01);
  assert.ok(Math.abs(before.bandThresholds[0] - vertical.bandThresholds[0]) < 0.01);
  assert.ok(Math.abs(after.bandThresholds[0] - vertical.bandThresholds[0]) < 0.01);
});
