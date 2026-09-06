import type { Board } from "./types";

export function boardsEqual(left: Board, right: Board): boolean {
  if (left.length !== right.length) return false;
  return left.every((leftVial, vialIndex) => {
    const rightVial = right[vialIndex];
    return rightVial !== undefined &&
      leftVial.length === rightVial.length &&
      leftVial.every((color, colorIndex) => color === rightVial[colorIndex]);
  });
}

export function createCanonicalBoardKey(board: Board): string {
  return JSON.stringify(
    board.map((vial) => JSON.stringify(vial)).sort((a, b) => a.localeCompare(b)),
  );
}
