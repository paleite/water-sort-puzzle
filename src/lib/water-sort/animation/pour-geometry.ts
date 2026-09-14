import {
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
  streamStart: Point;
  streamEnd: Point;
}

export function getDestinationImpactXNormalized(direction: PourDirection): number {
  return direction === "right" ? 0.28 : 0.72;
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

export function calculatePourGeometry(
  boardElement: HTMLElement,
  sourceElement: HTMLElement,
  destinationElement: HTMLElement,
  preferredDirection?: PourDirection,
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

  return {
    direction,
    translationX: targetMouth.x - sourceMouth.x,
    translationY: targetMouth.y - sourceMouth.y,
    rotationDegrees: direction === "right" ? 68 : -68,
    streamStart: targetMouth,
    streamEnd: destinationMouth,
  };
}
