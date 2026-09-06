import type { Board, Vial } from "./types";

export function isCompleteVial(vial: Vial, capacity: number): boolean {
  if (vial.length !== capacity) return false;
  const firstColor = vial[0];
  return firstColor !== undefined && vial.every((color) => color === firstColor);
}

export function isSolved(board: Board, capacity: number): boolean {
  return board.every((vial) => vial.length === 0 || isCompleteVial(vial, capacity));
}
