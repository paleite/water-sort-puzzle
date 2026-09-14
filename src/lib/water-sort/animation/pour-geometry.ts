import {
  VIAL_INNER_HEIGHT,
  VIAL_INNER_WIDTH,
  VIAL_MOUTH,
  VIAL_VIEWBOX_HEIGHT,
  VIAL_VIEWBOX_WIDTH,
} from "../presentation/vial-geometry";

export interface Point {x: number; y: number}
export type PourDirection = "left" | "right";
export interface PourGeometry {
  direction: PourDirection;
  translationX: number;
  translationY: number;
  rotationDegrees: number;
  drainRotationDegrees: number;
  streamStart: Point;
  streamEnd: Point;
}

export function getDestinationImpactXNormalized(direction: PourDirection): number {
  return direction === "right" ? 0.28 : 0.72;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function centerOfRect(rect: DOMRect): Point {
  return {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2};
}

function relativePoint(point: Point, containerRect: DOMRect): Point {
  return {x: point.x - containerRect.left, y: point.y - containerRect.top};
}

function vialLocalPointInRect(rect: DOMRect, point: Point): Point {
  return {
    x: rect.left + (point.x / VIAL_VIEWBOX_WIDTH) * rect.width,
    y: rect.top + (point.y / VIAL_VIEWBOX_HEIGHT) * rect.height,
  };
}

function getUnsignedPourAngleDegrees(fillUnits: number, capacity: number): number {
  if (capacity <= 0) return 84;

  const fillFraction = clamp(fillUnits / capacity, 0, 1);
  if (fillFraction <= 0.0001) return 84;

  const heightToWidth = VIAL_INNER_HEIGHT / VIAL_INNER_WIDTH;
  const tangent = 2 * (1 - fillFraction) * heightToWidth;
  const contactAngleDegrees = Math.atan(tangent) * (180 / Math.PI);

  return clamp(contactAngleDegrees + 3.5, 62, 84);
}

export function calculatePourGeometry(
  boardElement: HTMLElement,
  sourceElement: HTMLElement,
  destinationElement: HTMLElement,
  preferredDirection?: PourDirection,
  sourceFillUnits = 2,
  transferAmount = 1,
  capacity = 4,
): PourGeometry {
  const boardRect = boardElement.getBoundingClientRect();
  const sourceRect = sourceElement.getBoundingClientRect();
  const destinationRect = destinationElement.getBoundingClientRect();
  const sourceCenter = centerOfRect(sourceRect);
  const destinationCenter = centerOfRect(destinationRect);
  const direction = preferredDirection
    ?? (destinationCenter.x >= sourceCenter.x ? "right" : "left");
  const sourceMouthLocal = direction === "right" ? VIAL_MOUTH.right : VIAL_MOUTH.left;
  const destinationMouthLocal = direction === "right" ? VIAL_MOUTH.left : VIAL_MOUTH.right;
  const sourceMouth = relativePoint(vialLocalPointInRect(sourceRect, sourceMouthLocal), boardRect);
  const destinationMouth = relativePoint(vialLocalPointInRect(destinationRect, destinationMouthLocal), boardRect);
  const targetMouth = {x: destinationMouth.x, y: destinationMouth.y - 28};
  const directionSign = direction === "right" ? 1 : -1;
  const startAngle = getUnsignedPourAngleDegrees(sourceFillUnits, capacity);
  const remainingFillUnits = Math.max(0, sourceFillUnits - transferAmount);
  const drainAngle = Math.max(
    startAngle,
    getUnsignedPourAngleDegrees(remainingFillUnits, capacity),
  );

  return {
    direction,
    translationX: targetMouth.x - sourceMouth.x,
    translationY: targetMouth.y - sourceMouth.y,
    rotationDegrees: directionSign * startAngle,
    drainRotationDegrees: directionSign * drainAngle,
    streamStart: targetMouth,
    streamEnd: destinationMouth,
  };
}
