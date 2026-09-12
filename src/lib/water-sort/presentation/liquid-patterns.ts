import type { ColorId } from "../domain/colors";

export const LIQUID_PATTERN_IDS = {
  coral: 0,
  amber: 1,
  lemon: 2,
  lime: 3,
  emerald: 4,
  teal: 5,
  sky: 6,
  cobalt: 7,
  violet: 8,
  magenta: 9,
  rose: 10,
  cocoa: 11,
} as const satisfies Record<ColorId, number>;
