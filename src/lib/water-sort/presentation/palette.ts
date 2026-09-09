import type { ColorId } from "../domain/colors";

export const LIQUID_COLORS = {
  coral: "#ff6b6b",
  amber: "#fcab10",
  lemon: "#fada4f",
  lime: "#c1ed38",
  emerald: "#39ba7d",
  teal: "#37c6bd",
  sky: "#64b5fa",
  cobalt: "#3c68de",
  violet: "#8545fc",
  magenta: "#de70fe",
  rose: "#f1156d",
  cocoa: "#9b6e46",
} as const satisfies Record<ColorId, string>;
