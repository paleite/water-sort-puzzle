export interface Point {x: number; y: number}
export interface PourGeometry {
  direction: "left" | "right";
  translationX: number;
  translationY: number;
  rotationDegrees: number;
  streamStart: Point;
  streamEnd: Point;
}

export function calculatePourGeometry(
  boardElement: HTMLElement,
  sourceElement: HTMLElement,
  destinationElement: HTMLElement,
): PourGeometry {
  const boardRect = boardElement.getBoundingClientRect();
  const sourceRect = sourceElement.getBoundingClientRect();
  const destinationRect = destinationElement.getBoundingClientRect();

  const sourceMouth = {
    x: sourceRect.left - boardRect.left + sourceRect.width / 2,
    y: sourceRect.top - boardRect.top + 5,
  };
  const destinationMouth = {
    x: destinationRect.left - boardRect.left + destinationRect.width / 2,
    y: destinationRect.top - boardRect.top + 6,
  };
  const direction = destinationMouth.x >= sourceMouth.x ? "right" : "left";
  const horizontalOffset = Math.min(20, sourceRect.width * 0.3);
  const targetMouth = {
    x: destinationMouth.x + (direction === "right" ? -horizontalOffset : horizontalOffset),
    y: destinationMouth.y - 28,
  };

  return {
    direction,
    translationX: targetMouth.x - sourceMouth.x,
    translationY: targetMouth.y - sourceMouth.y,
    rotationDegrees: direction === "right" ? 68 : -68,
    streamStart: targetMouth,
    streamEnd: destinationMouth,
  };
}
