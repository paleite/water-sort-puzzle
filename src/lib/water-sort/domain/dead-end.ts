import { getLegalMoves } from "./legal-moves";
import { isSolved } from "./solved";
import type { Board } from "./types";

export function isDeadEnd(board: Board, capacity: number): boolean {
  return !isSolved(board, capacity) && getLegalMoves(board, capacity).length === 0;
}
