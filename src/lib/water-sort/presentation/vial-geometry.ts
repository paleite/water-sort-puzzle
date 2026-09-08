// Shared geometry for the static vial, animated liquid, stream anchors, and debug guides.
export const VIAL_VIEWBOX_WIDTH = 100;
export const VIAL_VIEWBOX_HEIGHT = 272;

export const VIAL_INNER_LEFT = 13;
export const VIAL_INNER_RIGHT = 87;
export const VIAL_INNER_TOP = 12;
export const VIAL_INNER_BOTTOM = 260;
export const VIAL_INNER_WIDTH = VIAL_INNER_RIGHT - VIAL_INNER_LEFT;
export const VIAL_INNER_HEIGHT = VIAL_INNER_BOTTOM - VIAL_INNER_TOP;

export const VIAL_INTERIOR_PATH =
  "M 13 12 H 87 V 214 C 87 245 71 260 50 260 C 29 260 13 245 13 214 Z";

export const VIAL_OUTLINE_PATH =
  "M 10 12 V 214 C 10 248 28 266 50 266 C 72 266 90 248 90 214 V 12";

export const VIAL_MOUTH = {
  left: {x: VIAL_INNER_LEFT, y: VIAL_INNER_TOP},
  right: {x: VIAL_INNER_RIGHT, y: VIAL_INNER_TOP},
} as const;

export function fillToVialY(fill: number, capacity: number): number {
  const fraction = Math.max(0, Math.min(1, capacity <= 0 ? 0 : fill / capacity));
  return VIAL_INNER_BOTTOM - fraction * VIAL_INNER_HEIGHT;
}

export function liquidLayerRect(
  layerIndex: number,
  capacity: number,
): {x: number; y: number; width: number; height: number} {
  const top = fillToVialY(layerIndex + 1, capacity);
  const bottom = fillToVialY(layerIndex, capacity);

  return {
    x: VIAL_INNER_LEFT,
    y: top,
    width: VIAL_INNER_WIDTH,
    height: bottom - top,
  };
}
