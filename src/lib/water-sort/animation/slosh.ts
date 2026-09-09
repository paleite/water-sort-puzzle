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

export interface SourceMotionSnapshot {
  x: number;
  y: number;
  rotationDegrees: number;
}

export interface LiquidSimulationSnapshot {
  timeSeconds: number;
  sourceWorldAngleDegrees: number;
  sourceLocalAngleDegrees: number;
  sourceAngularVelocity: number;
  sourceCurvatureAmplitude: number;
  destinationMaximumDisplacement: number;
  destinationDisplacements: readonly number[];
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

function streamStrengthAt(timeSeconds: number): number {
  const transferStart = GAME_TIMING.pour.transferStartSeconds;
  const transferEnd = transferStart + GAME_TIMING.pour.transferSeconds;
  if (timeSeconds <= transferStart || timeSeconds >= transferEnd) return 0;

  const rampIn = clamp((timeSeconds - transferStart) / 0.06, 0, 1);
  const rampOut = clamp((transferEnd - timeSeconds) / 0.08, 0, 1);
  return Math.min(rampIn, rampOut);
}

export function createLiquidSimulation({
  sourceWidthPixels,
  getSourceMotion,
}: {
  sourceWidthPixels: number;
  getSourceMotion: () => SourceMotionSnapshot;
}): LiquidSimulation {
  const metresPerPixel = 0.06 / Math.max(1, sourceWidthPixels);
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
  let currentRotationDegrees = 0;

  const destinationDisplacements = Array.from({length: SURFACE_POINT_COUNT}, () => 0);
  const destinationVelocities = Array.from({length: SURFACE_POINT_COUNT}, () => 0);

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
          - destinationDamping * velocity
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

  function update(timeSeconds: number): void {
    currentTimeSeconds = timeSeconds;
    const motion = getSourceMotion();
    currentRotationDegrees = motion.rotationDegrees;

    if (previousTimeSeconds === null) {
      previousTimeSeconds = timeSeconds;
      previousCenterX = motion.x;
      previousCenterY = motion.y;
      return;
    }

    const deltaSeconds = timeSeconds - previousTimeSeconds;
    if (deltaSeconds <= 0.0001) return;

    const velocityX = (motion.x - previousCenterX) / deltaSeconds;
    const velocityY = (motion.y - previousCenterY) / deltaSeconds;
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
    previousCenterX = motion.x;
    previousCenterY = motion.y;
    previousTimeSeconds = timeSeconds;
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
    currentRotationDegrees = 0;
    destinationDisplacements.fill(0);
    destinationVelocities.fill(0);
  }

  function finish(): void {
    currentTimeSeconds = GAME_TIMING.pour.totalSeconds;
    sourceWorldAngle = 0;
    sourceAngularVelocity = 0;
    filteredAccelerationX = 0;
    filteredAccelerationY = 0;
    currentRotationDegrees = 0;
    destinationDisplacements.fill(0);
    destinationVelocities.fill(0);
  }

  function getSnapshot(): LiquidSimulationSnapshot {
    const sourceCurvatureAmplitude = clamp(sourceAngularVelocity * 0.045, -3.2, 3.2);
    return {
      timeSeconds: currentTimeSeconds,
      sourceWorldAngleDegrees: sourceWorldAngle,
      sourceLocalAngleDegrees: sourceWorldAngle - currentRotationDegrees,
      sourceAngularVelocity,
      sourceCurvatureAmplitude,
      destinationMaximumDisplacement: Math.max(
        0,
        ...destinationDisplacements.map((value) => Math.abs(value)),
      ),
      destinationDisplacements: [...destinationDisplacements],
    };
  }

  return {update, reset, finish, getSnapshot};
}
