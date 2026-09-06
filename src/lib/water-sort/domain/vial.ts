import type { ColorId } from "./colors";
import type { Vial } from "./types";

export function getTopColor(vial: Vial): ColorId | null {
  return vial.at(-1) ?? null;
}

export function getFreeCapacity(vial: Vial, capacity: number): number {
  return capacity - vial.length;
}

export function getTopRunLength(vial: Vial): number {
  const topColor = getTopColor(vial);
  if (topColor === null) return 0;

  let runLength = 0;
  for (let index = vial.length - 1; index >= 0; index -= 1) {
    if (vial[index] !== topColor) break;
    runLength += 1;
  }
  return runLength;
}
