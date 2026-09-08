export interface Point {x: number; y: number}
export interface PourGeometry {
  direction: "left" | "right";
  translationX: number;
  translationY: number;
  rotationDegrees: number;
  streamStart: Point;
  streamEnd: Point;
}

function centerOfRect(rect: DOMRect): Point {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function relativePoint(point: Point, containerRect: DOMRect): Point {
  return {
    x: point.x - containerRect.left,
    y: point.y - containerRect.top,
  };
}

export function calculatePourGeometry(
  boardElement: HTMLElement,
  sourceElement: HTMLElement,
  destinationElement: HTMLElement,
): PourGeometry {
  const boardRect = boardElement.getBoundingClientRect();
  const sourceRect = sourceElement.getBoundingClientRect();
  const destinationRect = destinationElement.getBoundingClientRect();
  const direction = destinationRect.left + destinationRect.width / 2
    >= sourceRect.left + sourceRect.width / 2
    ? "right"
    : "left";

  const sourceMouthAnchor = sourceElement.querySelector<SVGCircleElement>(
    direction === "right" ? "[data-vial-mouth-right]" : "[data-vial-mouth-left]",
  );
  const destinationMouthAnchor = destinationElement.querySelector<SVGCircleElement>(
    direction === "right" ? "[data-vial-mouth-left]" : "[data-vial-mouth-right]",
  );

  if (sourceMouthAnchor === null || destinationMouthAnchor === null) {
    throw new Error("Missing vial mouth anchor required for pour geometry.");
  }

  const sourceMouth = relativePoint(
    centerOfRect(sourceMouthAnchor.getBoundingClientRect()),
    boardRect,
  );
  const destinationMouth = relativePoint(
    centerOfRect(destinationMouthAnchor.getBoundingClientRect()),
    boardRect,
  );
  const targetMouth = {
    x: destinationMouth.x,
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
