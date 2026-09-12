import {
  DEFAULT_VIAL_LIQUID_BOUNDS,
  DEFAULT_VIAL_SKIN,
} from "./vial-skins";

// Shared geometry for static layout, animated liquid, stream anchors, and debug guides.
export const VIAL_VIEWBOX_WIDTH = DEFAULT_VIAL_SKIN.viewBox.width;
export const VIAL_VIEWBOX_HEIGHT = DEFAULT_VIAL_SKIN.viewBox.height;

export const VIAL_INNER_LEFT = DEFAULT_VIAL_LIQUID_BOUNDS.left;
export const VIAL_INNER_RIGHT = DEFAULT_VIAL_LIQUID_BOUNDS.right;
export const VIAL_INNER_TOP = DEFAULT_VIAL_LIQUID_BOUNDS.top;
export const VIAL_INNER_BOTTOM = DEFAULT_VIAL_LIQUID_BOUNDS.bottom;
export const VIAL_INNER_WIDTH = DEFAULT_VIAL_LIQUID_BOUNDS.width;
export const VIAL_INNER_HEIGHT = DEFAULT_VIAL_LIQUID_BOUNDS.height;

export const VIAL_MOUTH = DEFAULT_VIAL_SKIN.mouth;

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
